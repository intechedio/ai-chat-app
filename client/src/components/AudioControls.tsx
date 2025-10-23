import React from 'react';
import { Mic, MicOff, Wifi, WifiOff, Volume2 } from 'lucide-react';

interface AudioControlsProps {
  isConnected: boolean;
  isInCall: boolean;
  audioLevel: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartCall: () => void;
  onEndCall: () => void;
  error: string | null;
  isPlayingResponse: boolean;
  isReceivingResponse: boolean;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isConnected,
  isInCall,
  audioLevel,
  onConnect,
  onDisconnect,
  onStartCall,
  onEndCall,
  error,
  isPlayingResponse,
  isReceivingResponse
}) => {
  const handleCallToggle = () => {
    if (isInCall) {
      onEndCall();
    } else {
      onStartCall();
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Voice Controls</h3>
        
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <div className="flex items-center space-x-1 text-green-400">
              <Wifi size={16} />
              <span className="text-sm">Connected</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-red-400">
              <WifiOff size={16} />
              <span className="text-sm">Disconnected</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Connection Controls */}
        <div className="flex space-x-2">
          {!isConnected ? (
            <button
              onClick={onConnect}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Connect Voice
            </button>
          ) : (
            <button
              onClick={onDisconnect}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Call Controls */}
        {isConnected && (
          <div className="space-y-3">
            <button
              onClick={handleCallToggle}
              disabled={!isConnected}
              className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                isInCall
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isInCall ? (
                <>
                  <MicOff size={20} />
                  <span>End Call</span>
                </>
              ) : (
                <>
                  <Mic size={20} />
                  <span>Start Call</span>
                </>
              )}
            </button>

            {/* Audio Level Indicator */}
            {isInCall && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Volume2 size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-400">Audio Level</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${audioLevel * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Response Status */}
        {(isPlayingResponse || isReceivingResponse) && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Volume2 size={16} className="text-blue-400" />
              <span className="text-sm text-blue-400">
                {isReceivingResponse ? 'AI Responding...' : 'AI Speaking'}
              </span>
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-gray-400 space-y-1">
          <p>• Click "Connect Voice" to enable real-time voice chat</p>
          <p>• Grant microphone permissions when prompted</p>
          <p>• Use "Start Call" to begin voice conversation</p>
          <p>• The AI will respond with both text and voice in real-time</p>
        </div>
      </div>
    </div>
  );
};
