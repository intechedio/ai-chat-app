import { useState } from 'react';
import { MessageList } from './components/MessageList';
import { ChatBox } from './components/ChatBox';
import { AudioControls } from './components/AudioControls';
import { useChatStream } from './hooks/useChatStream';
import { useTextToSpeech } from './hooks/useTextToSpeech';
import { useAudioStream } from './hooks/useAudioStream';
import { Trash2, Settings } from 'lucide-react';

function App() {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('alloy');

  const { messages, isLoading, error, sendMessage, clearMessages, addMessage } = useChatStream();
  const { isPlaying, speak } = useTextToSpeech();
  const {
    isConnected,
    isInCall,
    audioLevel,
    connect,
    disconnect,
    startCall,
    endCall,
    error: audioError,
    isPlayingResponse,
    isReceivingResponse
  } = useAudioStream((message) => {
    // Add the AI response to the chat messages with streaming support
    addMessage(message.content, message.role as 'user' | 'assistant', {
      isStreaming: message.isStreaming,
      messageId: message.messageId,
      isUpdate: message.isUpdate
    });
  });

  const handleSendMessage = (message: string) => {
    sendMessage(message);
  };

  const handleSpeak = (text: string) => {
    speak(text, selectedVoice);
  };

  const handleToggleMode = () => {
    setIsVoiceMode(!isVoiceMode);
    if (isVoiceMode && isInCall) {
      endCall();
    }
  };

  const handleStartCall = async () => {
    if (!isConnected) {
      try {
        await connect();
        // After connection is established, start call
        startCall();
      } catch (error) {
        console.error('Failed to connect:', error);
      }
    } else {
      startCall();
    }
  };

  const handleEndCall = () => {
    endCall();
  };

  const voices = [
    { value: 'alloy', label: 'Alloy' },
    { value: 'echo', label: 'Echo' },
    { value: 'fable', label: 'Fable' },
    { value: 'onyx', label: 'Onyx' },
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-white">Atasayar AI Chat</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Settings size={20} />
            </button>
            
            <button
              onClick={clearMessages}
              disabled={messages.length === 0}
              className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-white mb-3">Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Text-to-Speech Voice
                </label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {voices.map(voice => (
                    <option key={voice.value} value={voice.value} className="bg-gray-800">
                      {voice.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {(error || audioError) && (
        <div className="bg-red-500/20 border-b border-red-500/50 p-4">
          <div className="max-w-4xl mx-auto">
            <p className="text-red-200 text-sm">
              {error || audioError}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex max-w-4xl mx-auto w-full">
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <MessageList
            messages={messages}
            isLoading={isLoading}
            onSpeak={handleSpeak}
            isPlaying={isPlaying}
          />

          {/* Chat Input */}
          <div className="p-4">
            <ChatBox
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onStartCall={handleStartCall}
              onEndCall={handleEndCall}
              isInCall={isInCall}
              isVoiceMode={isVoiceMode}
              onToggleMode={handleToggleMode}
            />
          </div>
        </div>

        {/* Voice Controls Sidebar */}
        {isVoiceMode && (
          <div className="w-80 p-4 border-l border-white/10">
            <AudioControls
              isConnected={isConnected}
              isInCall={isInCall}
              audioLevel={audioLevel}
              onConnect={connect}
              onDisconnect={disconnect}
              onStartCall={handleStartCall}
              onEndCall={handleEndCall}
              error={audioError}
              isPlayingResponse={isPlayingResponse}
              isReceivingResponse={isReceivingResponse}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-400 text-sm">
            Built by Wail Talha - Powered by OpenAI GPT-4o & Realtime API • Built with React & .NET 8
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
