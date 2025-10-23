# OpenAI Chat + Realtime Voice Application

A modern web application that integrates OpenAI's GPT-4o Chat API with streaming responses and real-time voice communication using the Realtime API. Built with React, TypeScript, and .NET 8.

## Features

- **Text Chat**: Stream responses from GPT-4o with real-time typing effects
- **Voice Chat**: Real-time voice conversations using OpenAI's Realtime API
- **Text-to-Speech**: Convert AI responses to speech with multiple voice options
- **Modern UI**: Beautiful gradient design with TailwindCSS
- **Responsive**: Works on desktop and mobile devices
- **Real-time Streaming**: Server-Sent Events for smooth chat experience

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │   .NET Backend  │    │   OpenAI APIs   │
│                 │    │                 │    │                 │
│ • Chat UI       │◄──►│ • /api/chat     │◄──►│ • Chat API      │
│ • Voice UI      │    │ • /api/tts      │    │ • TTS API       │
│ • WebSocket     │◄──►│ • /api/realtime │◄──►│ • Realtime API  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **.NET 8 SDK**
- **OpenAI API Key** with access to:
  - GPT-4o (Chat Completions)
  - TTS-1 (Text-to-Speech)
  - GPT Realtime (Realtime)

## 🛠️ Setup Instructions

### 1. Clone and Navigate

```bash
git clone <repository-url>
cd ai-chat-app
```

### 2. Backend Setup (.NET 8)

```bash
cd server

# Restore packages (already done if you followed the build)
dotnet restore

# Set your OpenAI API key
# Option 1: Environment variable (recommended)
set OPENAI_API_KEY=your_api_key_here

# Option 2: Update appsettings.json
# Edit server/appsettings.json and add your API key to the "OpenAI.ApiKey" field

# Run the backend
dotnet run
```

The backend will start on `http://localhost:5198`.

### 3. Frontend Setup (React)

```bash
cd client

# Install dependencies
npm install

# Set API base URL (optional, defaults to http://localhost:5000)
# Create .env file with:
echo VITE_API_BASE_URL=http://localhost:5000 > .env

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:5173`.

### 4. Access the Application

Open your browser and navigate to `http://localhost:5173`.

## 🎯 Usage

### Text Chat Mode
1. Type your message in the input field
2. Press Enter or click Send
3. Watch the AI response stream in real-time
4. Click the speaker icon to hear the response

### Voice Chat Mode
1. Toggle to "Voice" mode
2. Click "Connect Voice" to establish connection
3. Grant microphone permissions when prompted
4. Click "Start Call" to begin voice conversation
5. Speak naturally - the AI will respond with both text and voice

### Settings
- Click the settings icon to change TTS voice
- Choose from 6 different voice options (Alloy, Echo, Fable, Onyx, Nova, Shimmer)

## 🔧 Configuration

### Backend Configuration (`server/appsettings.json`)

```json
{
  "OpenAI": {
    "ApiKey": "your_api_key_here",
    "ChatModel": "gpt-4o",
    "RealtimeModel": "gpt-realtime",
    "TtsModel": "tts-1"
  }
}
```

### Frontend Configuration (`client/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000
```

## 📡 API Endpoints

### Chat API
- **POST** `/api/chat`
- **Purpose**: Stream chat completions from GPT-4o
- **Request**: `{ "messages": [...], "model": "gpt-4o" }`
- **Response**: Server-Sent Events stream

### Text-to-Speech API
- **POST** `/api/tts`
- **Purpose**: Convert text to speech
- **Request**: `{ "text": "...", "voice": "alloy" }`
- **Response**: MP3 audio stream

### Realtime Voice API
- **WebSocket** `/api/realtime`
- **Purpose**: Real-time voice communication
- **Protocol**: WebSocket with audio streaming

## 🛡️ Security Notes

- API keys are handled server-side only
- CORS is configured for development
- No persistent storage (stateless design)
- Input validation on both client and server

## 🐛 Troubleshooting

### Common Issues

1. **"OpenAI API key not configured"**
   - Set the `OPENAI_API_KEY` environment variable
   - Or update `appsettings.json` with your API key

2. **CORS errors**
   - Ensure the backend is running on the correct port
   - Check that `VITE_API_BASE_URL` matches your backend URL

3. **Microphone access denied**
   - Grant microphone permissions in your browser
   - Use HTTPS in production (required for microphone access)

4. **WebSocket connection failed**
   - Check that the backend is running
   - Verify the WebSocket URL in the browser console

### Frontend
- Build: `npm run build`
- Deploy to Vercel, Netlify, or any static hosting
- Update `VITE_API_BASE_URL` to your production backend URL

## 📚 Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **TailwindCSS** for styling
- **Lucide React** for icons
- **React Markdown** for message rendering

### Backend
- **.NET 8** Minimal API
- **WebSockets** for real-time communication
- **System.Net.Http.Json** for HTTP client
- **CORS** for cross-origin requests

### APIs
- **OpenAI Chat Completions API** (GPT-4o)
- **OpenAI Text-to-Speech API** (TTS-1)
- **OpenAI Realtime API** (GPT Realtime)

## 📄 License

This project is for demonstration purposes.