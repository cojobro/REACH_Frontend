require('dotenv').config();

const express = require('express');
const { ChatOpenAI } = require('@langchain/openai');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { PineconeStore } = require('@langchain/pinecone');
const { Pinecone } = require('@pinecone-database/pinecone');
const { createRetrievalChain } = require('langchain/chains/retrieval');
const { createStuffDocumentsChain } = require('langchain/chains/combine_documents');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const NodeCache = require('node-cache');

const app = express();
const PORT = 5000;

app.use(express.json());

// Create a cache for storing retrieval results and generated content
const retrievalCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const responseCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Create a combine-documents chain with the LLM.
const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
  modelName: "gpt-4-turbo-preview", 
  temperature: 0,
  maxTokens: 250  // Balanced token limit for concise but complete responses
});

const qaPromptTemplate = ChatPromptTemplate.fromTemplate(`
  Answer the question based on the following context about {input}. Be clear, but detailed
  
  If the context is not relevant, or if the query is more general, respond generally
  if query is brief, respond briefly

  Context:
  {context}

  Question: {input}

  Instructions:
  - Be direct and to the point
  - Never use lists
  - Remove any remaining formatting markers
  

  Answer:
`);

// Initialize Pinecone and vector store once at startup
let globalVectorStore = null;
let globalRetriever = null;

async function initializeVectorStore() {
  console.log("Initializing global vector store...");
  const startTime = performance.now();

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const index = pinecone.Index("caregivernotebook2");

  // Create vector store from the existing index.
  globalVectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({ 
      modelName: "text-embedding-3-small",
      dimensions: 1536
    }),
    { 
      pineconeIndex: index,
      textKey: "text",
      namespace: "" // Ensure we're searching all namespaces
    }
  );

  console.log(`Global vector store initialization: ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
  return globalVectorStore;
}

// Function to clean document content
const cleanDocument = (doc, topic) => {
  // First, extract the most relevant paragraph if the content is too long
  let content = doc.pageContent;
  if (content.length > 500) {
    const paragraphs = content.split(/\n\n+/);
    // Find the paragraph most relevant to the topic
    content = paragraphs.find(p => 
      p.toLowerCase().includes(topic.toLowerCase())
    ) || content;
  }

  const cleanContent = content
    .replace(/\[SECTION:.*?\]/g, '')
    .replace(/Introduction\]/g, '')
    .replace(/Notes:/g, '')
    .replace(/TABLE OF CONTENTS/g, '')
    .replace(/⬜/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\.\.\./g, '')
    .trim();

  // Skip if content is too short or just headers
  if (cleanContent.length < 100 || 
      cleanContent.includes('SECTION') || 
      cleanContent.includes('Contents')) {
    return null;
  }

  // Skip generic content about notebooks, healthcare, etc
  const skipPhrases = [
    'Caregiver Notebook will serve',
    'Your Notebook in an easy to find spot',
    'health care providers',
    "doctor's visit",
    'TABLE OF CONTENTS'
  ];
  
  if (skipPhrases.some(phrase => cleanContent.includes(phrase))) {
    return null;
  }

  return {
    ...doc,
    pageContent: cleanContent
  };
};

// Improved deduplication function
const deduplicateContent = (docs) => {
  const seen = new Set();
  return docs.filter(doc => {
    // Get first 100 chars as signature to detect near-duplicates
    const signature = doc.pageContent.slice(0, 100).toLowerCase();
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
};

// Build the retrieval chain for a given topic.
async function createRetrievalChainForTopic(topic, customPrompt = null) {
  console.log(`\nProcessing topic: "${topic}"`);
  const startTime = performance.now();

  // Check if we already have a cached chain for this topic and prompt
  const cacheKey = `${topic}-${customPrompt ? 'qa' : 'lesson'}`;
  const cachedChain = retrievalCache.get(cacheKey);
  if (cachedChain) {
    console.log(`Using cached retrieval chain for "${topic}"`);
    return cachedChain;
  }

  // Initialize the global vector store if it hasn't been initialized yet
  if (!globalVectorStore) {
    await initializeVectorStore();
  }

  // Create the retrieval chain with the retriever
  if (!globalRetriever) {
    globalRetriever = globalVectorStore.asRetriever({
      searchKwargs: {
        k: 20,
        score: true,
        filter: {
          text: {
            $not: {
              $contains: "TABLE OF CONTENTS"
            }
          }
        }
      }
    });

    // Wrap the original retriever's getRelevantDocuments method
    const originalGetRelevantDocuments = globalRetriever.getRelevantDocuments.bind(globalRetriever);
    globalRetriever.getRelevantDocuments = async (query) => {
      // Check if we have cached results for this query
      const retrievalCacheKey = `retrieval-${query}`;
      const cachedDocs = retrievalCache.get(retrievalCacheKey);
      

      const retrievalStartTime = performance.now();
      // Try first with exact query
      let docs = await originalGetRelevantDocuments(query);
      console.log(`Initial retrieval: ${((performance.now() - retrievalStartTime) / 1000).toFixed(2)}s`);
      
      const processingStartTime = performance.now();
      let cleanedDocs = docs
        .map(doc => cleanDocument(doc, query))
        .filter(doc => doc !== null);
      
      cleanedDocs = deduplicateContent(cleanedDocs);
      console.log(`Document processing: ${((performance.now() - processingStartTime) / 1000).toFixed(2)}s`);

      // If we don't have enough quality content, try with expanded query
      if (cleanedDocs.length < 4) {
        const expandedQueryStartTime = performance.now();
        const expandedQuery = `${query} dementia symptoms management`;
        const moreDocs = await originalGetRelevantDocuments(expandedQuery);
        const moreCleanedDocs = moreDocs
          .map(doc => cleanDocument(doc, query))
          .filter(doc => doc !== null);
        
        // Combine and deduplicate all results
        cleanedDocs = deduplicateContent([...cleanedDocs, ...moreCleanedDocs]);
        console.log(`Expanded query: ${((performance.now() - expandedQueryStartTime) / 1000).toFixed(2)}s`);

        // Only log warning if we still don't have enough after both attempts
        if (cleanedDocs.length < 4) {
          console.log(`\nNote: Found ${cleanedDocs.length} relevant documents for "${query}"`);
        }
      }

      // Cache the results
      retrievalCache.set(retrievalCacheKey, cleanedDocs);
      return cleanedDocs;
    };
  }

  

  // Create a combine-documents chain with the LLM.
  const prompt = customPrompt || ChatPromptTemplate.fromTemplate("{context}\n\n{input}");
  
  const chainCreationStartTime = performance.now();
  const combineDocsChain = await createStuffDocumentsChain({
    llm,
    prompt: prompt,
  });

  // Create the retrieval chain
  const chain = await createRetrievalChain({
    combineDocsChain,
    retriever: globalRetriever,
  });
  console.log(`Chain creation: ${((performance.now() - chainCreationStartTime) / 1000).toFixed(2)}s`);
  
  console.log(`Total RAG setup time: ${((performance.now() - startTime) / 1000).toFixed(2)}s`);

  // Cache the chain
  retrievalCache.set(cacheKey, chain);
  return chain;
}

// API handler
app.post('/api/generateLesson', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    // Check if we have a cached response for this topic
    const cacheKey = `lesson-${topic}`;
    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log(`Using cached lesson for "${topic}"`);
      return res.json({ slides: cachedResponse });
    }

    const startTime = performance.now();
    const chain = await createRetrievalChainForTopic(topic);
    
    const prompts = [
      `Write a brief introduction to the module ${topic} without including the module title, as short as possible.`,
      `Write the basic info a caregiver should know from the module ${topic}. Make it concise, in 4 sentences, numbering each thought.`,
      `List 2 common issues and solutions involving the module ${topic}. Number them and limit the response to 4 sentences.`,
      `Briefly explain, at a 6th-grade reading level, 4 unique approaches to common problems in the ${topic} module. Number each approach and keep each explanation to one sentence.`
    ];

    console.log(`\nGenerating ${prompts.length} responses for "${topic}"...`);
    
    const promptStartTime = performance.now();
    const responses = await Promise.all(
      prompts.map(async (prompt, index) => {
        try {
          // Check if we have a cached response for this specific prompt
          const promptCacheKey = `lesson-${topic}-${index}`;
          const cachedPromptResponse = responseCache.get(promptCacheKey);
          if (cachedPromptResponse) {
            console.log(`Using cached response for prompt ${index + 1}`);
            return cachedPromptResponse;
          }

          const promptTime = performance.now();
          const result = await chain.invoke({
            input: prompt
          });
          console.log(`Prompt ${index + 1} generation time: ${((performance.now() - promptTime) / 1000).toFixed(2)}s`);

          // Log response details
          console.log(`\nResponse ${index + 1}/${prompts.length}:`);
          if (result.context?.length > 0) {
            console.log('Context:', result.context.map(doc => doc.pageContent));
          } else {
            console.log('Warning: No context found for this response');
          }
          console.log('Answer:', result.answer);

          // Cache the individual prompt response
          responseCache.set(promptCacheKey, result.answer);
          return result.answer;
        } catch (error) {
          console.error(`Error generating response ${index + 1}:`, error.message);
          return "Error generating content.";
        }
      })
    );
    console.log(`All prompts generation time: ${((performance.now() - promptStartTime) / 1000).toFixed(2)}s`);

    console.log(`\nSuccessfully generated ${responses.length} responses for "${topic}"`);
    console.log(`Total API request time: ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
    
    // Cache the complete response
    responseCache.set(cacheKey, responses);
    return res.json({ slides: responses });
    
  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json(
      { error: "An error occurred while generating the lesson content." }
    );
  }
});


// API handler for chatbot
app.post('/api/ask', async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = performance.now();
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    // Check if we have a cached response for this question
    const cacheKey = `chatbot-${question}`;
    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log(`Using cached response for "${question}"`);
      return res.status(200).json({ answer: cachedResponse });
    }

    const chain = await createRetrievalChainForTopic(question, qaPromptTemplate);
    
    const invokeStartTime = performance.now();
    const result = await chain.invoke({
      input: question
    });
    console.log(`Chatbot response generation time: ${((performance.now() - invokeStartTime) / 1000).toFixed(2)}s`);
    console.log(`Total chatbot API request time: ${((performance.now() - startTime) / 1000).toFixed(2)}s`);

    // Cache the response
    responseCache.set(cacheKey, result.answer);
    return res.status(200).json({ 
      answer: result.answer 
    });
    
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ 
      error: "An error occurred while processing your question.",
      details: error.message 
    });
  }
});

// Initialize the vector store when the server starts
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await initializeVectorStore();
    console.log("Vector store initialized successfully");
  } catch (error) {
    console.error("Error initializing vector store:", error);
  }
});