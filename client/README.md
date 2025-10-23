# Frontend Documentation

This document describes the React + TypeScript frontend application that provides the user interface for the OpenAI Chat & Voice application.

## 🏗️ Architecture

The frontend is built with React 18, TypeScript, and TailwindCSS, featuring a modern component-based architecture with custom hooks for state management.

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── App.tsx         # Main application component
│   ├── ChatBox.tsx     # Chat input and controls
│   ├── MessageList.tsx # Message display with markdown
│   └── AudioControls.tsx # Voice recording controls
├── hooks/              # Custom React hooks
│   ├── useChatStream.ts    # Chat streaming logic
│   ├── useTextToSpeech.ts  # TTS functionality
│   └── useAudioStream.ts   # WebRTC voice handling
├── style.css          # TailwindCSS styles
└── main.ts            # Application entry point
```

## 🎨 Components

### App.tsx
Main application component that orchestrates all features:
- Mode switching (Text/Voice)
- Settings panel
- Error handling
- Layout management

### ChatBox.tsx
Handles user input and mode controls:
- Text input with auto-resize
- Voice recording toggle
- Mode switching
- Character count
- Keyboard shortcuts (Enter to send)

### MessageList.tsx
Displays chat messages with rich formatting:
- Markdown rendering
- Message bubbles (user vs AI)
- Timestamps
- TTS playback buttons
- Typing indicators
- Auto-scroll to latest message

### AudioControls.tsx
Manages voice communication:
- Connection status
- Recording controls
- Audio level visualization
- Error display
- Usage instructions

## 🪝 Custom Hooks

### useChatStream
Manages chat functionality:
```typescript
interface ChatStreamState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

const { messages, isLoading, error, sendMessage, clearMessages } = useChatStream();
```

**Features**:
- Server-Sent Events (SSE) handling
- Message accumulation
- Error handling
- Loading states

### useTextToSpeech
Handles text-to-speech conversion:
```typescript
interface TtsState {
  isPlaying: boolean;
  error: string | null;
}

const { isPlaying, error, speak, stop } = useTextToSpeech();
```

**Features**:
- Audio playback management
- Multiple voice support
- Error handling
- Playback state tracking

### useAudioStream
Manages real-time voice communication:
```typescript
interface AudioStreamState {
  isConnected: boolean;
  isRecording: boolean;
  audioLevel: number;
  error: string | null;
}

const { 
  isConnected, isRecording, audioLevel, error,
  connect, disconnect, startRecording, stopRecording 
} = useAudioStream();
```

**Features**:
- WebSocket connection management
- Microphone access
- Audio level monitoring
- WebRTC audio processing
- Connection lifecycle

## 🎨 Styling

### TailwindCSS Configuration
- Custom gradient backgrounds
- Component-specific classes
- Responsive design
- Dark theme optimized

### Key Styles
```css
.message-bubble {
  @apply max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-lg;
}

.message-user {
  @apply bg-blue-600 text-white ml-auto;
}

.message-ai {
  @apply bg-gray-700 text-gray-100 mr-auto;
}
```

## 🔧 Configuration

### Environment Variables
```env
VITE_API_BASE_URL=http://localhost:5000
```

### Build Configuration
- Vite for fast development and building
- TypeScript for type safety
- PostCSS for TailwindCSS processing

## 🚀 Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
cd client
npm install
npm run dev
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 📱 Features

### Text Chat Mode
- Real-time message streaming
- Markdown support
- TTS playback
- Message history
- Auto-scroll

### Voice Chat Mode
- Real-time voice communication
- Audio level visualization
- Connection status
- Recording controls
- Bidirectional audio

### Settings
- Voice selection (6 options)
- Mode switching
- Clear conversation
- Error display

## 🎯 User Experience

### Responsive Design
- Mobile-first approach
- Adaptive layouts
- Touch-friendly controls
- Optimized for various screen sizes

### Accessibility
- Keyboard navigation
- Screen reader support
- High contrast colors
- Focus indicators

### Performance
- Lazy loading
- Efficient re-renders
- Optimized audio processing
- Minimal bundle size

## 🔌 API Integration

### Chat API
```typescript
const response = await fetch(`${apiBaseUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages })
});
```

### TTS API
```typescript
const response = await fetch(`${apiBaseUrl}/api/tts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, voice })
});
```

### WebSocket API
```typescript
const ws = new WebSocket(`${wsUrl}/api/realtime`);
```

## 🛡️ Error Handling

### Network Errors
- Connection timeouts
- API failures
- WebSocket disconnections
- User-friendly error messages

### User Errors
- Input validation
- Permission denied
- Invalid responses
- Graceful degradation

## 🧪 Testing

### Manual Testing
- Cross-browser compatibility
- Mobile responsiveness
- Voice functionality
- Error scenarios

### Recommended Browsers
- Chrome (best WebRTC support)
- Firefox
- Safari (limited WebRTC)
- Edge

## 🚀 Production Build

### Build Process
```bash
npm run build
```

### Output
- Optimized bundle
- Minified code
- Tree-shaken dependencies
- Static assets

### Deployment
- Static hosting (Vercel, Netlify)
- CDN distribution
- Environment variable configuration

## 🔧 Customization

### Adding New Voices
1. Update voice options in App.tsx
2. Ensure backend supports the voice
3. Test TTS functionality

### Styling Changes
1. Modify TailwindCSS classes
2. Update component styles
3. Test responsive design

### Feature Extensions
1. Add new hooks for functionality
2. Create new components
3. Update App.tsx integration

## 📊 Performance Monitoring

### Key Metrics
- Bundle size
- Load time
- Audio latency
- Memory usage

### Optimization Tips
- Code splitting
- Lazy loading
- Audio buffer optimization
- Efficient re-renders
