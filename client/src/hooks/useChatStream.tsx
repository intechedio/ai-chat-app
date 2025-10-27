import { useState, useCallback, useRef } from 'react';

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

  const abortRef = useRef<AbortController | null>(null);

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

      // cancel any in-flight request first
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          messages: [...state.messages, userMessage].map(m => ({ role: m.role, content: m.content }))
        }),
        signal: abortRef.current.signal
      });

      if (!response.ok || !response.body) {
        const msg = `HTTP ${response.status}`;
        throw new Error(msg);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage]
      }));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });

        // split on LF, keep remainder in pending
        const parts = pending.split('\n');
        pending = parts.pop() ?? '';

        for (let raw of parts) {
          const line = raw.trimEnd();
          if (!line) {
            // event delimiter — good time to flush UI
            continue;
          }

          if (!line.startsWith('data:')) {
            continue;
          }

          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            setState(prev => ({
              ...prev,
              isLoading: false,
              messages: prev.messages.map(msg =>
                msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
              )
            }));
            abortRef.current = null;
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content ?? '';

            if (content) {
              setState(prev => ({
                ...prev,
                messages: prev.messages.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + content, isStreaming: true }
                    : msg
                )
              }));

              await new Promise(r => setTimeout(r, 0));
            }
          } catch {
            setState(prev => ({
              ...prev,
              error: data
            }));
          }
        }
      }

      // stream ended without [DONE]
      setState(prev => ({
        ...prev,
        isLoading: false,
        messages: prev.messages.map(msg =>
          msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
        )
      }));
      abortRef.current = null;
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // user canceled
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Stream error'
      }));
      abortRef.current = null;
    }
  }, [state.messages]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ messages: [], isLoading: false, error: null });
  }, []);

  const addMessage = useCallback((content: string, role: 'user' | 'assistant' = 'assistant', options?: { isStreaming?: boolean; messageId?: string; isUpdate?: boolean }) => {
    const messageId = options?.messageId || Date.now().toString();

    if (options?.isUpdate) {
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId ? { ...msg, content: content.trim(), isStreaming: options.isStreaming } : msg
        )
      }));
    } else {
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
    addMessage,
    cancel
  };
};
