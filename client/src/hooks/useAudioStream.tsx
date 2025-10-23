import { useState, useCallback, useRef, useEffect } from 'react';

export interface AudioStreamState {
  isConnected: boolean;
  isInCall: boolean;
  audioLevel: number;
  error: string | null;
  sessionReady: boolean;
  isPlayingResponse: boolean;
  isReceivingResponse: boolean;
}

export const useAudioStream = (onAddMessage?: (message: { role: string; content: string; isStreaming?: boolean; messageId?: string; isUpdate?: boolean }) => void) => {
  const [state, setState] = useState<AudioStreamState>({
    isConnected: false,
    isInCall: false,
    audioLevel: 0,
    error: null,
    sessionReady: false,
    isPlayingResponse: false,
    isReceivingResponse: false
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sessionReadyRef = useRef<boolean>(false);
  const lastAudioSendTime = useRef<number>(0);
  const conversationItemCreated = useRef<boolean>(false);
  const isInCallActive = useRef<boolean>(false);
  const audioResponseBuffer = useRef<string>('');
  const currentStreamingMessageId = useRef<string | null>(null);
  const currentStreamingContent = useRef<string>('');
  const userSpeechBuffer = useRef<string>('');
  const userSpeechMessageId = useRef<string | null>(null);

  const playAudioResponse = useCallback(async (base64Audio: string) => {
    try {
      if (!base64Audio) {
        console.log('No audio data to play');
        return;
      }

      // Convert base64 to PCM16 data
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert bytes to Int16Array (PCM16 format)
      const pcm16Data = new Int16Array(bytes.buffer);
      
      // Create audio context
      const audioContext = new AudioContext({ sampleRate: 24000 });
      
      // Create audio buffer from PCM16 data
      const audioBuffer = audioContext.createBuffer(1, pcm16Data.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      // Convert PCM16 to Float32Array for Web Audio API
      for (let i = 0; i < pcm16Data.length; i++) {
        channelData[i] = pcm16Data[i] / 32768.0; // Convert from 16-bit to float
      }
      
      // Create and play audio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();

      // Clean up when audio finishes
      source.onended = () => {
        audioContext.close();
        setState(prev => ({ ...prev, isPlayingResponse: false }));
      };

    } catch (error) {
      console.error('Error playing audio response:', error);
      setState(prev => ({ ...prev, isPlayingResponse: false, error: 'Failed to play audio response' }));
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5198';
      const wsUrl = apiBaseUrl.replace('http', 'ws') + '/api/realtime';
      
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Wait for WebSocket to be ready and session to be established
      await new Promise<void>((resolve, reject) => {
        let sessionEstablished = false;
        
        ws.onopen = () => {
          console.log('WebSocket connected successfully');
          setState(prev => ({ ...prev, isConnected: true }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('Received message:', message.type);
            
            if (message.type === 'session.created' || message.type === 'session.updated') {
              console.log('Session established successfully');
              console.log('Session message:', message);
              sessionEstablished = true;
              sessionReadyRef.current = true;
              setState(prev => ({ ...prev, sessionReady: true }));
              resolve();
            } else if (message.type === 'error') {
              console.error('Session error:', message.error);
              setState(prev => ({ ...prev, error: `Session error: ${message.error?.message || 'Unknown error'}` }));
              reject(new Error(`Session error: ${message.error?.message || 'Unknown error'}`));
            } else if (message.type === 'response.output_audio.delta') {
              // Handle audio response from the AI
              console.log('Received audio response delta');
              if (message.delta) {
                audioResponseBuffer.current += message.delta;
              }
            } else if (message.type === 'response.output_audio_transcript.delta') {
              // Handle real-time transcript streaming
              console.log('Received transcript delta:', message.delta);
              if (message.delta) {
                currentStreamingContent.current += message.delta;
                
                // Create or update streaming message
                if (!currentStreamingMessageId.current) {
                  currentStreamingMessageId.current = Date.now().toString();
                  if (onAddMessage) {
                    onAddMessage({
                      role: 'assistant',
                      content: currentStreamingContent.current,
                      isStreaming: true,
                      messageId: currentStreamingMessageId.current
                    });
                  }
                } else {
                  // Update existing streaming message
                  if (onAddMessage) {
                    onAddMessage({
                      role: 'assistant',
                      content: currentStreamingContent.current,
                      isStreaming: true,
                      messageId: currentStreamingMessageId.current,
                      isUpdate: true
                    });
                  }
                }
              }
            } else if (message.type === 'response.output_audio.delta') {
              // Handle real-time audio streaming
              console.log('Received audio response delta');
              if (message.delta) {
                audioResponseBuffer.current += message.delta;
                setState(prev => ({ ...prev, isReceivingResponse: true }));
                
                // Play audio chunks as they arrive for real-time playback
                if (audioResponseBuffer.current.length > 1000) { // Play when we have enough data
                  playAudioResponse(audioResponseBuffer.current);
                  audioResponseBuffer.current = ''; // Clear buffer after playing
                }
              }
            } else if (message.type === 'response.output_audio.done') {
              console.log('Audio response completed');
              setState(prev => ({ ...prev, isPlayingResponse: true }));
              
              // Play any remaining audio
              if (audioResponseBuffer.current) {
                playAudioResponse(audioResponseBuffer.current);
              }
            } else if (message.type === 'response.done') {
              console.log('Response completed');
              setState(prev => ({ ...prev, isPlayingResponse: false, isReceivingResponse: false }));
              
              // Finalize the streaming message
              if (currentStreamingMessageId.current && onAddMessage) {
                onAddMessage({
                  role: 'assistant',
                  content: currentStreamingContent.current,
                  isStreaming: false,
                  messageId: currentStreamingMessageId.current,
                  isUpdate: true
                });
              }
              
              // Reset buffers for next response
              audioResponseBuffer.current = '';
              currentStreamingMessageId.current = null;
              currentStreamingContent.current = '';
            } else if (message.type === 'input_audio_buffer.speech_started') {
              console.log('User speech started');
              // Reset user speech buffer
              userSpeechMessageId.current = null;
              userSpeechBuffer.current = '';
            } else if (message.type === 'input_audio_buffer.speech_stopped') {
              console.log('User speech stopped');
              // Add user speech transcript to chat if we have content
              if (userSpeechBuffer.current && onAddMessage) {
                onAddMessage({
                  role: 'user',
                  content: userSpeechBuffer.current,
                  isStreaming: false
                });
              }
              // Reset user speech buffer
              userSpeechMessageId.current = null;
              userSpeechBuffer.current = '';
            } else if (message.type === 'conversation.item.input_audio_transcript.delta') {
              // Handle user speech transcription
              console.log('User speech transcript delta:', message.delta);
              if (message.delta) {
                userSpeechBuffer.current += message.delta;
                
                // Create or update user speech message
                if (!userSpeechMessageId.current) {
                  userSpeechMessageId.current = Date.now().toString();
                  if (onAddMessage) {
                    onAddMessage({
                      role: 'user',
                      content: userSpeechBuffer.current,
                      isStreaming: true,
                      messageId: userSpeechMessageId.current
                    });
                  }
                } else {
                  // Update existing user speech message
                  if (onAddMessage) {
                    onAddMessage({
                      role: 'user',
                      content: userSpeechBuffer.current,
                      isStreaming: true,
                      messageId: userSpeechMessageId.current,
                      isUpdate: true
                    });
                  }
                }
              }
            }
          } catch (error) {
            console.log('Received non-JSON message (likely binary audio data)');
          }
        };

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          sessionReadyRef.current = false;
          setState(prev => ({ ...prev, isConnected: false, isRecording: false, sessionReady: false }));
          if (!sessionEstablished) {
            reject(new Error(`WebSocket closed before session established: ${event.code} ${event.reason}`));
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setState(prev => ({ ...prev, error: 'WebSocket connection failed' }));
          reject(new Error('WebSocket connection failed'));
        };

        // Timeout after 10 seconds if session is not established
        setTimeout(() => {
          if (!sessionEstablished) {
            reject(new Error('Session establishment timeout'));
          }
        }, 10000);
      });

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      mediaStreamRef.current = stream;

      // Setup audio context for analysis
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      
      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      try {
        console.log('Loading AudioWorklet...');
        await audioContext.audioWorklet.addModule('/audio-processor.js');
        console.log('AudioWorklet loaded successfully');
      } catch (error) {
        console.error('Failed to load AudioWorklet:', error);
        setState(prev => ({ ...prev, error: 'Failed to initialize audio processor' }));
        return;
      }

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source.connect(analyser);

      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setState(prev => ({ ...prev, audioLevel: average / 255 }));
        }
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to access microphone'
      }));
    }
  }, []);

  const startCall = useCallback(() => {
    console.log('Starting call...');
    console.log('WebSocket state:', wsRef.current?.readyState);
    console.log('Session ready:', sessionReadyRef.current);
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected:', wsRef.current?.readyState);
      setState(prev => ({ ...prev, error: 'Not connected to voice service' }));
      return;
    }

    if (!sessionReadyRef.current) {
      console.error('Session not ready for call');
      setState(prev => ({ ...prev, error: 'Session not ready. Please wait for connection to be established.' }));
      return;
    }

    if (!mediaStreamRef.current) {
      console.error('Media stream not available');
      setState(prev => ({ ...prev, error: 'Microphone not available' }));
      return;
    }

    console.log('Setting call state to true');
    isInCallActive.current = true;
    setState(prev => ({ ...prev, isInCall: true, error: null }));

    // We'll create the conversation item when we have the first audio data
    // This avoids the "missing required parameter" error

    // Create audio processor for real-time audio streaming using AudioWorklet
    const audioContext = audioContextRef.current!;
    const source = audioContext.createMediaStreamSource(mediaStreamRef.current);
    
    // Create AudioWorkletNode
    const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');
    audioWorkletNodeRef.current = audioWorkletNode;
    
    // Handle audio data from worklet
    audioWorkletNode.port.onmessage = (event) => {
      if (event.data.type === 'audioData') {
        // Check if call is still active and WebSocket is ready
        if (!isInCallActive.current) {
          console.log('Call ended, ignoring audio data');
          return;
        }
        
        if (wsRef.current?.readyState === WebSocket.OPEN && sessionReadyRef.current) {
          try {
            const inputBuffer = event.data.data;
            
            // Throttle audio sending to prevent overwhelming the API
            const now = Date.now();
            if (now - lastAudioSendTime.current < 100) { // Send max every 100ms
              return;
            }
            lastAudioSendTime.current = now;
            
            // Convert Float32Array to PCM16
            const pcm16 = new Int16Array(inputBuffer.length);
            for (let i = 0; i < inputBuffer.length; i++) {
              pcm16[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32768));
            }
            
            // Convert PCM16 to base64 for JSON transmission
            const uint8Array = new Uint8Array(pcm16.buffer);
            const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
            
            // Create conversation item with first audio data if not created yet
            if (!conversationItemCreated.current) {
              const startMessage = {
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "user",
                  content: [
                    {
                      type: "input_audio",
                      audio: base64Audio
                    }
                  ]
                }
              };
              
              console.log('Creating conversation item with first audio data');
              wsRef.current.send(JSON.stringify(startMessage));
              conversationItemCreated.current = true;
            } else {
              // Append subsequent audio data
              const audioMessage = {
                type: "input_audio_buffer.append",
                audio: base64Audio
              };
              
              console.log('Sending audio message:', { type: audioMessage.type, audioLength: base64Audio.length });
              wsRef.current.send(JSON.stringify(audioMessage));
            }
          } catch (error) {
            console.error('Error processing audio data:', error);
            setState(prev => ({ ...prev, error: 'Audio processing error', isRecording: false }));
          }
        } else {
          // WebSocket not ready - stop recording to prevent data loss
          console.log('WebSocket not ready for audio data:', {
            wsState: wsRef.current?.readyState,
            sessionReady: sessionReadyRef.current
          });
          setState(prev => ({ ...prev, isRecording: false, error: 'Connection lost during recording' }));
        }
      }
    };

    source.connect(audioWorkletNode);
    // Don't connect to destination to avoid feedback
  }, []);

  const endCall = useCallback(() => {
    console.log('Ending call...');
    isInCallActive.current = false;
    
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    conversationItemCreated.current = false;
    setState(prev => ({ ...prev, isInCall: false }));
  }, []);

  const disconnect = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }


    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    sessionReadyRef.current = false;
    conversationItemCreated.current = false;
    isInCallActive.current = false;
    audioResponseBuffer.current = '';
    currentStreamingMessageId.current = null;
    currentStreamingContent.current = '';
    userSpeechBuffer.current = '';
    userSpeechMessageId.current = null;

    setState({
      isConnected: false,
      isInCall: false,
      audioLevel: 0,
      error: null,
      sessionReady: false,
      isPlayingResponse: false,
      isReceivingResponse: false
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    startCall,
    endCall
  };
};
