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
  const conversationItemCreated = useRef<boolean>(false);
  const isInCallActive = useRef<boolean>(false);
  const audioResponseBuffer = useRef<string>('');
  const currentStreamingMessageId = useRef<string | null>(null);
  const currentStreamingContent = useRef<string>('');
  const userSpeechBuffer = useRef<string>('');
  const userSpeechMessageId = useRef<string | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingAudioRef = useRef<boolean>(false);
  const hasUncommittedAudioRef = useRef<boolean>(false);
  const responseInProgressRef = useRef<boolean>(false);
  const uncommittedSamplesRef = useRef<number>(0);
  const speechStopTimeoutRef = useRef<number | null>(null);
  const pendingCreateTimeoutRef = useRef<number | null>(null);
  const lastCommitAtRef = useRef<number>(0);

  // Commit at least 100ms of audio (24kHz = 2400 samples)
  const MIN_COMMIT_SAMPLES = 2400;
  // Wait briefly after speech_stopped to accumulate tail audio
  const COMMIT_GRACE_MS = 120;
  // Safety net: if server doesn't auto-create after commit, try once
  const CREATE_FALLBACK_MS = 800;

  const processAudioQueue = useCallback(async () => {
    if (isPlayingAudioRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingAudioRef.current = true;
    setState(prev => ({ ...prev, isPlayingResponse: true }));

    while (audioQueueRef.current.length > 0) {
      const audioBuffer = audioQueueRef.current.shift();
      if (!audioBuffer) break;

      try {
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current!.destination);
        
        await new Promise<void>((resolve) => {
          source.onended = () => resolve();
          source.start();
        });
      } catch (error) {
        console.error('Error playing audio buffer:', error);
      }
    }

    isPlayingAudioRef.current = false;
    setState(prev => ({ ...prev, isPlayingResponse: false }));
  }, []);

  const addAudioToQueue = useCallback(async (base64Audio: string) => {
    try {
      if (!base64Audio || !audioContextRef.current) {
        console.log('No audio data or context to play');
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
      
      // Create audio buffer from PCM16 data
      const audioBuffer = audioContextRef.current.createBuffer(1, pcm16Data.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      // converting PCM16 to Float32Array for Web Audio API
      for (let i = 0; i < pcm16Data.length; i++) {
        channelData[i] = pcm16Data[i] / 32768.0;
      }
      
      // Add to queue
      audioQueueRef.current.push(audioBuffer);
      
      // Process queue
      processAudioQueue();

    } catch (error) {
      console.error('Error processing audio response:', error);
      setState(prev => ({ ...prev, error: 'Failed to process audio response' }));
    }
  }, [processAudioQueue]);

  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5198';
      const wsUrl = apiBaseUrl.replace('http', 'ws') + '/api/realtime';
      
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // waiting for WebSocket to be ready and session to be established
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
              // Handle common realtime errors gracefully without surfacing to UI
              const code = message.error?.code;
              if (code === 'input_audio_buffer_commit_empty') {
                console.warn('Commit rejected: not enough audio since last commit');
                // Reset tracking so next commit can proceed when enough audio is present
                hasUncommittedAudioRef.current = false;
                uncommittedSamplesRef.current = 0;
                return;
              }
              if (code === 'conversation_already_has_active_response') {
                console.warn('Response already active; suppressing duplicate create');
                return;
              }
              console.error('Session error:', message.error);
              setState(prev => ({ ...prev, error: `Session error: ${message.error?.message || 'Unknown error'}` }));
              responseInProgressRef.current = false;
              hasUncommittedAudioRef.current = false;
              reject(new Error(`Session error: ${message.error?.message || 'Unknown error'}`));
            } else if (message.type === 'response.created') {
              console.log('Response created');
              responseInProgressRef.current = true;
              // Cancel any fallback create if it was scheduled
              if (pendingCreateTimeoutRef.current) {
                clearTimeout(pendingCreateTimeoutRef.current);
                pendingCreateTimeoutRef.current = null;
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
                
                // Play audio chunks immediately for real-time playback
                // Use larger threshold for smoother audio without pops/clicks
                if (audioResponseBuffer.current.length >= 1500) { // ~>20ms worth; tweak 1500–3000
                  addAudioToQueue(audioResponseBuffer.current);
                  audioResponseBuffer.current = ''; // Clear buffer after playing
                }
              }
            } else if (message.type === 'response.output_audio.done') {
              console.log('Audio response completed');
              
              // Play any remaining audio
              if (audioResponseBuffer.current) {
                addAudioToQueue(audioResponseBuffer.current);
              }
            } else if (message.type === 'response.cancelled') {
              console.log('Response cancelled');
              responseInProgressRef.current = false;
            } else if (message.type === 'response.done') {
              console.log('Response completed');
              setState(prev => ({ ...prev, isPlayingResponse: false, isReceivingResponse: false }));
              responseInProgressRef.current = false;
              
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
              // Reset commit timers and counters
              if (speechStopTimeoutRef.current) {
                clearTimeout(speechStopTimeoutRef.current);
                speechStopTimeoutRef.current = null;
              }
              if (pendingCreateTimeoutRef.current) {
                clearTimeout(pendingCreateTimeoutRef.current);
                pendingCreateTimeoutRef.current = null;
              }
              uncommittedSamplesRef.current = 0;
            } else if (message.type === 'input_audio_buffer.speech_stopped') {
              console.log('User speech stopped');
              
              // finalize user text bubble (unchanged)
              if (userSpeechBuffer.current && onAddMessage) {
                onAddMessage({ role: 'user', content: userSpeechBuffer.current, isStreaming: false });
              }

              // If a response is still in progress, cancel it before the next turn
              if (responseInProgressRef.current) {
                wsRef.current!.send(JSON.stringify({ type: "response.cancel" }));
              }

              // Defer commit slightly to accumulate tail-end audio; ensure >=100ms appended
              if (speechStopTimeoutRef.current) {
                clearTimeout(speechStopTimeoutRef.current);
              }
              speechStopTimeoutRef.current = window.setTimeout(() => {
                if (hasUncommittedAudioRef.current && uncommittedSamplesRef.current >= MIN_COMMIT_SAMPLES) {
                  wsRef.current!.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
                  lastCommitAtRef.current = Date.now();
                  hasUncommittedAudioRef.current = false;
                  uncommittedSamplesRef.current = 0;
                  // Schedule a safe fallback create in case server doesn't auto-create
                  if (!responseInProgressRef.current) {
                    if (pendingCreateTimeoutRef.current) {
                      clearTimeout(pendingCreateTimeoutRef.current);
                    }
                    pendingCreateTimeoutRef.current = window.setTimeout(() => {
                      if (!responseInProgressRef.current) {
                        wsRef.current!.send(JSON.stringify({ type: "response.create" }));
                        responseInProgressRef.current = true;
                      }
                      pendingCreateTimeoutRef.current = null;
                    }, CREATE_FALLBACK_MS);
                  }
                } else {
                  console.log('Skipping commit – insufficient audio since last commit', {
                    hasUncommitted: hasUncommittedAudioRef.current,
                    samples: uncommittedSamplesRef.current
                  });
                }
                speechStopTimeoutRef.current = null;
              }, COMMIT_GRACE_MS);

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
            
            // Send audio immediately for lowest latency
            
            // Convert Float32Array to PCM16
            const pcm16 = new Int16Array(inputBuffer.length);
            for (let i = 0; i < inputBuffer.length; i++) {
              pcm16[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32768));
            }
            
            // Convert PCM16 to base64 for JSON transmission
            const uint8Array = new Uint8Array(pcm16.buffer);
            const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
            
            // Send every packet as soon as we get it (tiny debounce is fine, but not 100 ms)
            const audioMessage = {
              type: "input_audio_buffer.append",
              audio: base64Audio
            };
            
            hasUncommittedAudioRef.current = true; // mark new audio present
            uncommittedSamplesRef.current += inputBuffer.length;
            console.log('Sending audio message:', { type: audioMessage.type, audioLength: base64Audio.length });
            wsRef.current.send(JSON.stringify(audioMessage));
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

    if (speechStopTimeoutRef.current) {
      clearTimeout(speechStopTimeoutRef.current);
      speechStopTimeoutRef.current = null;
    }
    if (pendingCreateTimeoutRef.current) {
      clearTimeout(pendingCreateTimeoutRef.current);
      pendingCreateTimeoutRef.current = null;
    }

    sessionReadyRef.current = false;
    conversationItemCreated.current = false;
    isInCallActive.current = false;
    audioResponseBuffer.current = '';
    currentStreamingMessageId.current = null;
    currentStreamingContent.current = '';
    userSpeechBuffer.current = '';
    userSpeechMessageId.current = null;
    hasUncommittedAudioRef.current = false;
    responseInProgressRef.current = false;
    uncommittedSamplesRef.current = 0;
    lastCommitAtRef.current = 0;

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

  // Cleanup on disconnection
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
