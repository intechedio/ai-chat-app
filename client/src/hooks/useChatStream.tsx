import { useState, useCallback } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatStreamState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export const useChatStream = () => {
  const [state, setState] = useState<ChatStreamState>({
    messages: [],
    isLoading: false,
    error: null
  });

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: null
    }));

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5198';
      
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...state.messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage]
      }));

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              setState(prev => ({ ...prev, isLoading: false }));
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                setState(prev => ({
                  ...prev,
                  messages: prev.messages.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: msg.content + content }
                      : msg
                  )
                }));
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }

      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    }
  }, [state.messages]);

  const clearMessages = useCallback(() => {
    setState({
      messages: [],
      isLoading: false,
      error: null
    });
  }, []);

  const addMessage = useCallback((content: string, role: 'user' | 'assistant' = 'assistant', options?: { isStreaming?: boolean; messageId?: string; isUpdate?: boolean }) => {
    const messageId = options?.messageId || Date.now().toString();
    
    if (options?.isUpdate) {
      // Update existing message
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: content.trim(), isStreaming: options.isStreaming }
            : msg
        )
      }));
    } else {
      // Add new message
      const message: Message = {
        id: messageId,
        role,
        content: content.trim(),
        timestamp: new Date(),
        isStreaming: options?.isStreaming
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, message]
      }));
    }
  }, []);

  return {
    ...state,
    sendMessage,
    clearMessages,
    addMessage
  };
};
