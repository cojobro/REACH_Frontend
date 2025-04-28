// load environment variables first
require('dotenv').config();

const express = require('express');
const { ChatOpenAI } = require('@langchain/openai');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { PineconeStore } = require('@langchain/pinecone');
const { Pinecone } = require('@pinecone-database/pinecone');
const { RunnableSequence } = require('@langchain/core/runnables');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const NodeCache = require('node-cache');
const { performance } = require('perf_hooks');
const cors = require('cors');

/*
configuration
*/

const config = {
    server: {
        port: process.env.PORT || 5000,
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        chatModel: "gpt-4-turbo-preview",
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
        chatTemperature: 0,
        maxTokens: 1024,
    },
    pinecone: {
        apiKey: process.env.PINECONE_API_KEY,
        indexName: "reachdocs",
        namespace: "",
    },
    retriever: {
        k: 10,
        minDocsThreshold: 4,
        expandedQuerySuffix: " dementia symptoms management",
    },
    cache: {
        retrievalTTL: 3600,
        responseTTL: 3600,
        checkPeriod: 600,
    },
};

/*
constants
*/

const QA_PROMPT_TEMPLATE = `
Context: {context}
Question: {question}

Instructions:
- Be warm and supportive in tone
- Provide accurate, evidence-based information
- If medical advice is sought, remind them to consult healthcare providers
- Focus on practical, actionable information when possible
- Respond using brief, conversational paragraphs

Answer:
`;

const LESSON_SLIDE_PROMPT_TEMPLATE = `
Persona: You are a professional health advisor and empathetic counselor specializing in supporting parents of children diagnosed with cancer. Your goal is to provide clear, supportive, and actionable information in a concise slide format.

Context based on retrieved documents:
{context}

Topic for this slide:
{topic}

Instructions for generating the slide content:
-
- Maintain a warm, supportive, and understanding tone suitable for parents facing this challenge.
- Focus on the key aspects of the given {topic}.
-- Present the information clearly, using a mix of the following formats where appropriate for readability:
--    - Short paragraphs (2-3 sentences each).
--    - Bulleted lists (using '*' or '-') for concise points or steps.
--    - Numbered lists for sequences or instructions.
- Format the output using standard Markdown:
    - Use double newlines to separate paragraphs (2-3 sentences each is ideal).
    - Use '*' or '-' for bullet points.
    - Use '1.', '2.', etc. for numbered lists.
- Ensure information is accurate and aligns with general best practices.
- If discussing treatments or medical specifics, include a reminder to consult their child's oncology team for personalized advice.
- The output should ONLY be the content for the slide body, do not include a title or "Slide:" prefix.

Slide Content (Markdown format):
`;

/*
globals (initialized at startup)
*/

let llm;
let embeddings;
let vectorStore;
let enhancedRetriever;
let qaChain;
let lessonChain;
const retrievalCache = new NodeCache({ stdTTL: config.cache.retrievalTTL, checkperiod: config.cache.checkPeriod });
const responseCache = new NodeCache({ stdTTL: config.cache.responseTTL, checkperiod: config.cache.checkPeriod });

/*
helper functions
*/

const log = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, data || '');
};

const cleanDocumentContent = (content) => {
    if (!content || typeof content !== 'string') return '';
    return content
        .replace(/\[SECTION:.*?\]/gi, '')
        .replace(/TABLE OF CONTENTS/gi, '')
        .replace(/Introduction\]/gi, '')
        .replace(/Notes:/gi, '')
        .replace(/⬜/g, '')
        .replace(/\.\s*\.+/g, '.')
        .replace(/(\r\n|\n|\r){2,}/g, '\n')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

const deduplicateDocuments = (docs) => {
    const seenSignatures = new Set();
    const uniqueDocs = [];
    for (const doc of docs) {
        const signature = doc.pageContent.slice(0, 150).toLowerCase();
        if (!seenSignatures.has(signature)) {
            seenSignatures.add(signature);
            uniqueDocs.push(doc);
        }
    }
    return uniqueDocs;
};

const enhanceRetriever = (baseRetriever) => {
    const originalGetRelevantDocuments = baseRetriever.getRelevantDocuments.bind(baseRetriever);

    return {
        ...baseRetriever,
        getRelevantDocuments: async (query) => {
            const cacheKey = `retrieval:${query}`;
            const cachedDocs = retrievalCache.get(cacheKey);
            if (cachedDocs) {
                log('info', `[Cache Hit] Retrieval cache for query: "${query}"`);
                return cachedDocs;
            }
            log('info', `[Cache Miss] Retrieving documents for query: "${query}"`);

            const startTime = performance.now();
            let allDocs = [];

            try {
                const initialDocs = await originalGetRelevantDocuments(query);
                allDocs.push(...initialDocs);
                log('debug', `Initial retrieval found ${initialDocs.length} docs.`);

                let processedDocs = initialDocs.map(doc => ({
                    ...doc,
                    pageContent: cleanDocumentContent(doc.pageContent),
                }));
                processedDocs = deduplicateDocuments(processedDocs);

                log('debug', `Processed initial docs: ${processedDocs.length} remaining.`);

                if (processedDocs.length < config.retriever.minDocsThreshold) {
                    log('info', `Insufficient docs (${processedDocs.length}), attempting expanded query.`);
                    const expandedQuery = query + config.retriever.expandedQuerySuffix;
                    const expandedDocsRaw = await originalGetRelevantDocuments(expandedQuery);
                    log('debug', `Expanded retrieval found ${expandedDocsRaw.length} docs.`);

                    const expandedDocsProcessed = expandedDocsRaw.map(doc => ({
                        ...doc,
                        pageContent: cleanDocumentContent(doc.pageContent),
                    }));
                    allDocs = deduplicateDocuments([...processedDocs, ...expandedDocsProcessed]);
                    log('debug', `Combined and deduplicated docs: ${allDocs.length} remaining.`);
                } else {
                    allDocs = processedDocs;
                }

                if (allDocs.length < config.retriever.minDocsThreshold) {
                    log('warn', `Still low document count (${allDocs.length}) for query: "${query}" after expansion.`);
                }

                retrievalCache.set(cacheKey, allDocs);
                log('info', `Retrieved and processed ${allDocs.length} docs in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
                return allDocs;

            } catch (error) {
                log('error', `Error during enhanced document retrieval for query "${query}":`, error);
                return [];
            }
        }
    };
};

/*
initialization function
*/

async function initializeRAGSystem() {
    log('info', 'Initializing RAG System...');
    const startTime = performance.now();

    try {
        llm = new ChatOpenAI({
            apiKey: config.openai.apiKey,
            modelName: config.openai.chatModel,
            temperature: config.openai.chatTemperature,
            maxTokens: config.openai.maxTokens,
        });
        log('info', 'LLM initialized.');

        embeddings = new OpenAIEmbeddings({
            apiKey: config.openai.apiKey,
            modelName: config.openai.embeddingModel,
            dimensions: config.openai.embeddingDimensions,
        });
        log('info', 'Embeddings initialized.');

        const pinecone = new Pinecone({ apiKey: config.pinecone.apiKey });
        const index = pinecone.Index(config.pinecone.indexName);
        vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
            textKey: "text",
            namespace: config.pinecone.namespace || undefined,
        });
        log('info', `VectorStore connected to Pinecone index "${config.pinecone.indexName}".`);

        const baseRetriever = vectorStore.asRetriever({
            k: config.retriever.k,
        });
        log('info', 'Base retriever created.');

        enhancedRetriever = enhanceRetriever(baseRetriever);
        log('info', 'Retriever enhanced with caching and processing.');

        const qaPrompt = ChatPromptTemplate.fromTemplate(QA_PROMPT_TEMPLATE);
        qaChain = RunnableSequence.from([
            {
                context: async ({ question }) => {
                    const docs = await enhancedRetriever.getRelevantDocuments(question);
                    return docs.map(doc => doc.pageContent).join('\n\n');
                },
                question: input => input.question
            },
            qaPrompt,
            llm,
            new StringOutputParser()
        ]);
        log('info', 'QA chain created successfully.');

        const lessonPrompt = ChatPromptTemplate.fromTemplate(LESSON_SLIDE_PROMPT_TEMPLATE);
        lessonChain = RunnableSequence.from([
            {
                context: async ({ topic }) => {
                    const retrievalQuery = `Information relevant to: ${topic} for parents of children with cancer.`;
                    const docs = await enhancedRetriever.getRelevantDocuments(retrievalQuery);
                    return docs.map(doc => doc.pageContent).join('\n\n');
                },
                topic: input => input.topic
            },
            lessonPrompt,
            llm,
            new StringOutputParser()
        ]);
        log('info', 'Lesson slide chain created successfully.');

        log('info', `RAG System initialized successfully in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
        return true;

    } catch (error) {
        log('error', 'FATAL: RAG System initialization failed:', error);
        return false;
    }
}

/*
express app setup
*/

const app = express();

/*
middleware
*/

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    const start = performance.now();
    res.on('finish', () => {
        const duration = ((performance.now() - start) / 1000).toFixed(2);
        log('info', `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}s`);
    });
    next();
});

/*
api endpoints
*/

app.post('/api/query', async (req, res, next) => {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: "Question is required" });
        }

        const cacheKey = `response:qa:${question}`;
        const cachedResponse = responseCache.get(cacheKey);
        if (cachedResponse) {
            log('info', `[Cache Hit] Serving cached QA response for: "${question}"`);
            return res.json({ answer: cachedResponse });
        }
        log('info', `[Cache Miss] Generating QA response for: "${question}"`);

        const generationStartTime = performance.now();
        const result = await qaChain.invoke({ question });

        const answer = result;

        responseCache.set(cacheKey, answer);

        log('info', `QA response generation for "${question}" completed in ${((performance.now() - generationStartTime) / 1000).toFixed(2)}s`);
        return res.json({ answer });

    } catch (error) {
        next(error);
    }
});

app.post('/api/generateSlide', async (req, res) => {
    const { lessonHeader } = req.body;
    log('info', `Received slide generation request for: "${lessonHeader}"`);

    if (!lessonHeader) {
        return res.status(400).json({ error: 'lessonHeader is required' });
    }

    const cacheKey = `slide:${lessonHeader}`;
    const cachedContent = responseCache.get(cacheKey);
    if (cachedContent) {
        log('info', `[Cache Hit] Serving cached slide content for: "${lessonHeader}"`);
        return res.json({ slideContent: cachedContent });
    }
    log('info', `[Cache Miss] Generating slide content for: "${lessonHeader}"`);

    const startTime = performance.now();
    try {
        const generatedContent = await lessonChain.invoke({ topic: lessonHeader });

        responseCache.set(cacheKey, generatedContent);
        log('info', `Generated slide content in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
        res.json({ slideContent: generatedContent });

    } catch (error) {
        log('error', `Error processing slide generation for "${lessonHeader}":`, error);
        res.status(500).json({ error: 'Internal server error during slide generation.' });
    }
});

/*
global error handler
*/

app.use((err, req, res, next) => {
    log('error', `Unhandled error: ${err.message}`, err.stack);
    res.status(500).json({
        error: "An unexpected error occurred.",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});

/*
start server
*/

async function startServer() {
    const initialized = await initializeRAGSystem();
    if (initialized) {
        app.listen(config.server.port, () => {
            log('info', `Server listening on port ${config.server.port}`);
        });
    } else {
        log('error', 'Server failed to start due to initialization errors.');
        process.exit(1);
    }
}

startServer();