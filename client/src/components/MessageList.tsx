import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Volume2, VolumeX } from 'lucide-react';
import type { Message } from '../hooks/useChatStream';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onSpeak: (text: string, voice?: string) => void;
  isPlaying: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  onSpeak,
  isPlaying
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSpeak = (content: string) => {
    if (isPlaying) {
      // If already playing, we could implement a stop function here
      return;
    }
    onSpeak(content);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && !isLoading && (
        <div className="text-center text-gray-400 mt-8">
          <h2 className="text-xl font-semibold mb-2">Welcome to Atasayar AI Chat</h2>
          <p>Start a conversation by typing a message or using voice mode!</p>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`message-bubble ${
              message.role === 'user' ? 'message-user' : 'message-ai'
            }`}
          >
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-gray-600 px-1 py-0.5 rounded text-sm">
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-gray-800 p-3 rounded-lg text-sm overflow-x-auto">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="bg-gray-800 p-3 rounded-lg overflow-x-auto">
                      {children}
                    </pre>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-2 space-y-1">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-2 space-y-1">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="text-sm">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse"></span>
              )}
            </div>
            
            <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
              <div className="flex items-center space-x-2">
                <span>{formatTime(message.timestamp)}</span>
                {message.isStreaming && (
                  <span className="text-blue-400 flex items-center space-x-1">
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                    <span>Streaming...</span>
                  </span>
                )}
              </div>
              
              {message.role === 'assistant' && message.content && !message.isStreaming && (
                <button
                  onClick={() => handleSpeak(message.content)}
                  disabled={isPlaying}
                  className="flex items-center space-x-1 hover:text-white transition-colors disabled:opacity-50"
                >
                  {isPlaying ? (
                    <VolumeX size={14} />
                  ) : (
                    <Volume2 size={14} />
                  )}
                  <span>Speak</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="message-bubble message-ai">
            <div className="typing-indicator">
              <div className="typing-dot" style={{ animationDelay: '0ms' }}></div>
              <div className="typing-dot" style={{ animationDelay: '150ms' }}></div>
              <div className="typing-dot" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
