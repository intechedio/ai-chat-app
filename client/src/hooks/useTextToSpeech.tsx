import { useState, useCallback, useRef } from 'react';

export interface TtsState {
  isPlaying: boolean;
  error: string | null;
}

export const useTextToSpeech = () => {
  const [state, setState] = useState<TtsState>({
    isPlaying: false,
    error: null
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string, voice: string = 'alloy') => {
    if (!text.trim()) return;

    try {
      setState({ isPlaying: true, error: null });

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5198';
      
      const response = await fetch(`${apiBaseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice })
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Clean up previous audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setState(prev => ({ ...prev, isPlaying: false }));
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setState({ isPlaying: false, error: 'Failed to play audio' });
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      setState({
        isPlaying: false,
        error: error instanceof Error ? error.message : 'TTS failed'
      });
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  return {
    ...state,
    speak,
    stop
  };
};
