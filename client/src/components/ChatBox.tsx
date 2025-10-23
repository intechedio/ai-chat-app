import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';

interface ChatBoxProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  isInCall: boolean;
  isVoiceMode: boolean;
  onToggleMode: () => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({
  onSendMessage,
  isLoading,
  onStartCall,
  onEndCall,
  isInCall,
  isVoiceMode,
  onToggleMode
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleVoiceToggle = () => {
    if (isInCall) {
      onEndCall();
    } else {
      onStartCall();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200; // maxHeight from inline style
      const minHeight = 48; // minHeight from inline style
      
      // Set height within bounds
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
      
      // Hide scrollbar when content fits, show when it exceeds maxHeight
      if (scrollHeight <= maxHeight) {
        textarea.style.overflow = 'hidden';
      } else {
        textarea.style.overflow = 'auto';
      }
    }
  }, [message]);

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-200">Chat Mode</span>
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={onToggleMode}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                !isVoiceMode 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Text
            </button>
            <button
              onClick={onToggleMode}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isVoiceMode 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Voice
            </button>
          </div>
        </div>
        
        {isVoiceMode && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-300">Voice:</span>
            <button
              onClick={handleVoiceToggle}
              disabled={isLoading}
              className={`p-2 rounded-full transition-colors ${
                isInCall
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isInCall ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          </div>
        )}
      </div>

      {!isVoiceMode && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
                disabled={isLoading}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 overflow-hidden"
                rows={1}
                maxLength={2000}
                style={{ minHeight: '48px', maxHeight: '200px' }}
              />
            </div>
            
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send size={20} />
            </button>
          </div>
          
          <div className="text-right text-xs text-gray-400">
            {message.length}/2000
          </div>
        </form>
      )}

      {isVoiceMode && (
        <div className="text-center py-4">
          <p className="text-gray-300 mb-4">
            {isInCall 
              ? 'In call... Click the microphone to end call' 
              : 'Click the microphone to start a call'
            }
          </p>
        </div>
      )}
    </div>
  );
};
