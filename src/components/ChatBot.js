import React, { useState, useRef, useEffect } from 'react';
import TypewriterMarkdown from './TypewriterMarkdown';
import './ChatBot.css';

const ChatBot = ({ onBack }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const chatWindowRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        setMessages([{ 
            sender: 'bot', 
            text: 'Hello, I am the REACH Assistant. Ask me questions about the lesson content or topics related to childhood cancer care.' 
        }]);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedInput = input.trim();
        if (!trimmedInput) return;

        const userMessage = { sender: 'user', text: trimmedInput };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:5000/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: trimmedInput }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const botMessage = { sender: 'bot', text: data.answer || 'Sorry, I could not get a response.' };
            setMessages(prev => [...prev, botMessage]);

        } catch (error) {
            console.error('Fetch error:', error);
            const errorMessage = { 
                sender: 'bot', 
                text: 'I apologize, but I encountered an error. Please try again later.', 
                isError: true 
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
        <button onClick={onBack} className="back-button top-left-back">
                Back
        </button>
        <div className="chatbot-container">
            
            
            
            <div className="chatbot-header">
                <h2>Ask REACH Assistant</h2>
                <p>Get support and information about childhood cancer care</p>
            </div>
            
            <div className="chat-window" ref={chatWindowRef}> 
                {messages.map((msg, index) => (
                    <div 
                        key={index} 
                        className={`message ${msg.sender} ${msg.isError ? 'error' : ''}`}
                    >
                        {msg.sender === 'bot' ? (
                            <TypewriterMarkdown 
                                content={msg.text} 
                                scrollContainerRef={chatWindowRef} 
                            />
                        ) : (
                            msg.text // Render user messages as plain text
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="message bot typing-indicator">
                        <span>.</span><span>.</span><span>.</span>
                    </div>
                )}
                <div ref={messagesEndRef} /> 
            </div>

            <form onSubmit={handleSubmit} className="chat-input">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your question here..."
                    disabled={isLoading}
                    aria-label="Chat input"
                />
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send'} 
                </button>
            </form>

        </div>
        </>
    );
};

export default ChatBot;
