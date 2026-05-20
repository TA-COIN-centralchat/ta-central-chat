import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ExternalLink,
  X,
  Paperclip,
  Send,
  User,
  Info,
  MessageSquare,
  ArrowLeft,
  Headphones,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { semanticSearchFaqs, generateAiResponse, keywordSearchFaqs } from '../lib/vectorService';
import { useAgentConnection } from '../hooks/useAgentConnection';
import './ChatBot.css';

const BotIcon = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M8 18L6 21V18H6C4.89543 18 4 17.1046 4 16V9C4 7.89543 4.89543 7 6 7H18C19.1046 7 20 7.89543 20 9V16C20 17.1046 19.1046 18 18 18H8Z" />
    <path d="M12 7V4H15" />
    <path d="M2 12.5H4M20 12.5H22" />
    <rect x="9" y="10.5" width="1.5" height="3" rx="0.75" fill="currentColor" stroke="none" />
    <rect x="13.5" y="10.5" width="1.5" height="3" rx="0.75" fill="currentColor" stroke="none" />
  </svg>
);

const INITIAL_MESSAGES = [
  {
    role: 'bot',
    text: 'Hi there. How can we help you today?',
    options: ['FAQs', 'Connect to Agent'],
  },
];

const CATEGORY_OPTIONS = [
  'Getting Started',
  'Account & App',
  'Payments & Wallet',
  'Security',
  'Support',
  'Careers',
  'Legal',
];

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [supportForm, setSupportForm] = useState({ step: null, description: '' });
  const [mode, setMode] = useState('bot'); // 'bot' | 'agent'
  const messagesEndRef = useRef(null);

  // Supabase Realtime agent connection
  const {
    connectToAgent: startAgentSession,
    sendMessage: sendAgentMessage,
    disconnect: disconnectAgent,
    isConnected: agentConnected,
    isWaiting: agentWaiting,
    agentJoined,
    messages: agentMessages,
    session: agentSession,
    userId,
  } = useAgentConnection();

  const currentTime = useMemo(
    () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [messages.length],
  );

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentMessages, mode]);

  const toggleChat = () => setIsOpen((current) => !current);

  const showFaqCategories = () => {
    setMessages((current) => [
      ...current,
      {
        role: 'bot',
        text: 'Choose a category or type your question. I can handle small typos too.',
        options: CATEGORY_OPTIONS,
      },
    ]);
  };

  const showCategoryFaqs = async (category) => {
    if (!supabase) {
      setMessages((current) => [
        ...current,
        { role: 'bot', text: 'FAQ categories are not connected yet. Please configure Supabase first.' },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      let { data, error } = await supabase
        .from('support_faqs')
        .select('question, answer, category')
        .eq('is_published', true)
        .eq('category', category)
        .order('question', { ascending: true });

      if (error) throw error;

      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: data?.length
            ? `Here are common ${category} questions:`
            : `No published FAQs were found for ${category}.`,
          faqLinks: data || [],
        },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        { role: 'bot', text: `Could not load ${category} FAQs: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Connect to a live agent via Supabase Realtime
   */
  const connectToAgent = async (description) => {
    try {
      setIsLoading(true);
      await startAgentSession(description);
      setMode('agent');
      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: '🔄 Connecting you to a live agent. Please wait...',
        },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: `Failed to connect to agent: ${err.message}. Please try again later.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Return to bot mode from agent mode
   */
  const backToBot = () => {
    disconnectAgent();
    setMode('bot');
    setMessages((prev) => [
      ...prev,
      {
        role: 'bot',
        text: 'You have left the agent chat. How else can I help you?',
        options: ['FAQs', 'Connect to Agent'],
      },
    ]);
  };

  const handleFormInput = async (text) => {
    if (supportForm.step === 'description') {
      const description = text;
      setIsLoading(true);
      try {
        await connectToAgent(description);
        setSupportForm({ step: null, description: '' });
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', text: `Support request failed: ${err.message}` },
        ]);
        setSupportForm({ step: null, description: '' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleOption = async (option) => {
    setMessages((current) => [...current, { role: 'user', text: option }]);

    if (option === 'FAQs') {
      showFaqCategories();
      return;
    }

    if (CATEGORY_OPTIONS.includes(option)) {
      await showCategoryFaqs(option);
      return;
    }

    if (option === 'Connect to Agent') {
      setSupportForm({ step: 'description', description: '' });
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: 'Please describe your issue in detail:' },
      ]);
      return;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanMessage = input.trim();
    if (!cleanMessage || isLoading) return;

    setInput('');

    // ─── Agent Mode: send via Supabase Realtime ───
    if (mode === 'agent') {
      try {
        await sendAgentMessage(cleanMessage);
      } catch (err) {
        console.error('Failed to send agent message:', err);
      }
      return;
    }

    // ─── Bot Mode: FAQ / AI search ───
    setMessages((current) => [...current, { role: 'user', text: cleanMessage }]);

    if (supportForm.step) {
      await handleFormInput(cleanMessage);
      return;
    }

    setIsLoading(true);

    // Minimum confidence to show a direct answer vs. suggesting options
    const HIGH_CONFIDENCE = 0.65;
    const LOW_CONFIDENCE = 0.45;

    try {
      const results = await semanticSearchFaqs(cleanMessage);

      if (results && results.length > 0) {
        const topMatch = results[0];

        // HIGH confidence — show direct answer
        if (topMatch.score >= HIGH_CONFIDENCE) {
          const relatedResults = results.slice(1).filter((r) => r.score >= LOW_CONFIDENCE);

          // Try AI-generated summary, but fall back to the raw FAQ answer if it fails
          let responseText;
          try {
            responseText = await generateAiResponse(cleanMessage, results.slice(0, 3));
          } catch (aiErr) {
            console.warn('AI response generation failed, using direct FAQ answer:', aiErr);
            responseText = topMatch.answer;
          }

          setMessages((current) => [
            ...current,
            {
              role: 'bot',
              text: responseText,
              source: topMatch.question,
              category: topMatch.category,
              score: topMatch.score,
              related: relatedResults,
            },
          ]);
        } else {
          // LOW confidence — show "Did you mean?" with clickable FAQ suggestions
          const suggestions = results.filter((r) => r.score >= LOW_CONFIDENCE).slice(0, 4);

          if (suggestions.length > 0) {
            setMessages((current) => [
              ...current,
              {
                role: 'bot',
                text: "I'm not sure I understood your question. Did you mean one of these?",
                faqLinks: suggestions.map((s) => ({
                  question: s.question,
                  answer: s.answer,
                  category: s.category,
                })),
              },
            ]);
          } else {
            // No results above minimum threshold at all
            setMessages((current) => [
              ...current,
              {
                role: 'bot',
                text: "I couldn't find a matching answer. You can try rephrasing your question, browse our FAQs, or connect to a live agent.",
                options: ['FAQs', 'Connect to Agent'],
              },
            ]);
          }
        }
      } else {
        setMessages((current) => [
          ...current,
          {
            role: 'bot',
            text: "I couldn't find a matching answer. You can try rephrasing your question, browse our FAQs, or connect to a live agent.",
            options: ['FAQs', 'Connect to Agent'],
          },
        ]);
      }
    } catch (err) {
      // Last resort: try keyword search directly if everything else failed
      try {
        const fallbackResults = await keywordSearchFaqs(cleanMessage);
        if (fallbackResults && fallbackResults.length > 0) {
          const topFallback = fallbackResults[0];

          if (topFallback.score >= HIGH_CONFIDENCE) {
            setMessages((current) => [
              ...current,
              {
                role: 'bot',
                text: topFallback.answer,
                source: topFallback.question,
                category: topFallback.category,
                score: topFallback.score,
              },
            ]);
          } else {
            // Show as suggestions instead of a direct answer
            setMessages((current) => [
              ...current,
              {
                role: 'bot',
                text: "I found some topics that might help. Did you mean one of these?",
                faqLinks: fallbackResults.slice(0, 4).map((r) => ({
                  question: r.question,
                  answer: r.answer,
                  category: r.category,
                })),
              },
            ]);
          }
        } else {
          setMessages((current) => [
            ...current,
            {
              role: 'bot',
              text: "I couldn't find a matching answer. You can try rephrasing your question, browse our FAQs, or connect to a live agent.",
              options: ['FAQs', 'Connect to Agent'],
            },
          ]);
        }
      } catch (fallbackErr) {
        setMessages((current) => [
          ...current,
          {
            role: 'bot',
            text: "I'm having trouble searching our knowledge base right now. Would you like to connect to an agent?",
            options: ['Connect to Agent'],
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render: Agent Chat Mode ───
  const renderAgentChat = () => (
    <>
      <div className="chatbot-header agent-header">
        <button className="chat-back-btn" onClick={backToBot} title="Back to bot">
          <ArrowLeft size={18} />
        </button>
        <div className="agent-header-info">
          <Headphones size={18} />
          <h3>Live Agent</h3>
        </div>
        <div className="agent-status">
          {agentWaiting && <span className="status-waiting">Waiting...</span>}
          {agentJoined && <span className="status-connected">Connected</span>}
        </div>
        <button onClick={toggleChat}>
          <X size={18} />
        </button>
      </div>

      <div className="chatbot-messages">
        <div className="chat-timestamp">{currentTime}</div>

        {agentWaiting && !agentJoined && (
          <div className="chat-message-group bot">
            <div className="chat-avatar">
              <Headphones size={18} />
            </div>
            <div className="chat-message-content">
              <span className="chat-sender-name">System</span>
              <div className="chat-bubble">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p style={{ marginTop: '8px', fontSize: '12px', opacity: 0.7 }}>
                  Waiting for an agent to join...
                </p>
              </div>
            </div>
          </div>
        )}

        {agentJoined && (
          <div className="chat-message-group bot">
            <div className="chat-avatar">
              <Headphones size={18} />
            </div>
            <div className="chat-message-content">
              <span className="chat-sender-name">System</span>
              <div className="chat-bubble">
                ✅ An agent has joined the chat. You can now communicate in real time.
              </div>
            </div>
          </div>
        )}

        {agentMessages.map((msg) => {
          const isUser = msg.sender_role === 'user';
          const isAgent = msg.sender_role === 'agent';
          const isSystem = msg.sender_role === 'system' || msg.sender_role === 'bot';

          return (
            <div
              key={msg.id}
              className={`chat-message-group ${isUser ? 'user' : 'bot'}`}
            >
              <div className="chat-avatar">
                {isUser ? <User size={18} /> : isAgent ? <Headphones size={18} /> : <Info size={18} />}
              </div>
              <div className="chat-message-content">
                {!isUser && (
                  <span className="chat-sender-name">
                    {isAgent ? 'Agent' : 'System'}
                  </span>
                )}
                <div className="chat-bubble">
                  {msg.content}
                  <span className="chat-bubble-time">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
    </>
  );

  // ─── Render: Bot Chat Mode ───
  const renderBotChat = () => (
    <>
      <div className="chatbot-header">
        <h3>T.A Coin Support</h3>
        <button onClick={toggleChat}>
          <X size={18} />
        </button>
      </div>

      <div className="chatbot-messages">
        <div className="chat-timestamp">{currentTime}</div>

        {messages.map((item, index) => (
          <div
            key={`${item.role}-${index}`}
            className={`chat-message-group ${item.role === 'bot' ? 'bot' : 'user'}`}
          >
            <div className="chat-avatar">
              {item.role === 'bot' ? <Info size={18} /> : <User size={18} />}
            </div>
            <div className="chat-message-content">
              {item.role === 'bot' && (
                <span className="chat-sender-name">T.A Coin Assistant</span>
              )}
              <div className="chat-bubble">
                {item.text}
                {item.source && (
                  <div className="chat-rag-meta">
                    <span className="source-label">Source: {item.source}</span>
                    {item.score && (
                      <span className="confidence">
                        Confidence: {(item.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                )}
                {item.category && <div className="chat-category">{item.category}</div>}
                {item.related && item.related.length > 0 && (
                  <div className="chat-related-suggestions">
                    <p>Related topics:</p>
                    {item.related.map((rel, rIdx) => (
                      <button
                        key={rIdx}
                        className="chat-option-btn"
                        onClick={() =>
                          setMessages((prev) => [
                            ...prev,
                            {
                              role: 'bot',
                              text: rel.answer,
                              source: rel.question,
                            },
                          ])
                        }
                      >
                        {rel.question} <ExternalLink size={12} />
                      </button>
                    ))}
                  </div>
                )}
                {item.options && (
                  <div className="chat-options">
                    {item.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="chat-option-btn"
                        onClick={() => handleOption(option)}
                        disabled={isLoading}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
                {item.faqLinks && (
                  <div className="chat-options">
                    {item.faqLinks.map((faq) => (
                      <button
                        key={faq.question}
                        type="button"
                        className="chat-option-btn"
                        onClick={() =>
                          setMessages((current) => [
                            ...current,
                            { role: 'user', text: faq.question },
                            {
                              role: 'bot',
                              text: faq.answer,
                              source: faq.question,
                              category: faq.category,
                            },
                          ])
                        }
                      >
                        {faq.question} <ExternalLink size={14} />
                      </button>
                    ))}
                  </div>
                )}
                <span className="chat-bubble-time">{currentTime}</span>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-message-group bot">
            <div className="chat-avatar">
              <Info size={18} />
            </div>
            <div className="chat-message-content">
              <span className="chat-sender-name">T.A Coin Assistant</span>
              <div className="chat-bubble">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </>
  );

  return (
    <div className="chatbot-container">
      {!isOpen && (
        <button className="chatbot-fab" onClick={toggleChat}>
          <MessageSquare size={24} />
          <span>Need Help?</span>
        </button>
      )}

      {isOpen && (
        <div className="chatbot-window">
          {mode === 'agent' ? renderAgentChat() : renderBotChat()}

          <form className="chatbot-footer" onSubmit={handleSubmit}>
            <button className="chat-attach-btn" type="button" aria-label="Attach file">
              <Paperclip size={20} />
            </button>
            <div className="chat-input-wrapper">
              <input
                type="text"
                className="chat-input"
                placeholder={
                  mode === 'agent'
                    ? agentJoined
                      ? 'Type your message to agent...'
                      : 'Waiting for agent...'
                    : 'Type your message'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={mode === 'agent' && !agentJoined}
              />
            </div>
            <div className="chat-send-wrapper">
              <button
                className="chat-send-btn"
                type="submit"
                disabled={isLoading || !input.trim() || (mode === 'agent' && !agentJoined)}
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
