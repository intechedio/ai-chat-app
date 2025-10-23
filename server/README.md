# Backend API Documentation

This document describes the .NET 8 Minimal API backend that serves as a proxy between the React frontend and OpenAI's APIs.

## 🏗️ Architecture

The backend acts as a stateless proxy, forwarding requests to OpenAI's APIs while handling CORS, WebSocket connections, and error handling.

## 📡 API Endpoints

### 1. Chat Completions API

**Endpoint**: `POST /api/chat`

**Purpose**: Stream chat completions from OpenAI's GPT-4o model

**Request Body**:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "model": "gpt-4o",
  "max_tokens": 1000
}
```

**Response**: Server-Sent Events (SSE) stream
```
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":"!"}}]}

data: [DONE]
```

**Error Responses**:
- `400`: Invalid request body or missing messages
- `500`: OpenAI API key not configured
- `500`: Internal server error

### 2. Text-to-Speech API

**Endpoint**: `POST /api/tts`

**Purpose**: Convert text to speech using OpenAI's TTS API

**Request Body**:
```json
{
  "text": "Hello, this is a test message.",
  "voice": "alloy"
}
```

**Available Voices**:
- `alloy` (default)
- `echo`
- `fable`
- `onyx`
- `nova`
- `shimmer`

**Response**: MP3 audio stream (`audio/mpeg`)

**Error Responses**:
- `400`: Missing or invalid text
- `400`: Text exceeds 4096 characters
- `500`: OpenAI API key not configured

### 3. Realtime Voice API

**Endpoint**: `WebSocket /api/realtime`

**Purpose**: Real-time voice communication with OpenAI's Realtime API

**Connection**: WebSocket upgrade request

**Protocol**: Bidirectional audio streaming
- Client sends: PCM16 audio data (24kHz, mono)
- Server relays: Audio and text responses from OpenAI

**Error Handling**:
- Connection refused if API key not configured
- Automatic cleanup on disconnect
- Error logging for debugging

## ⚙️ Configuration

### Environment Variables

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### appsettings.json

```json
{
  "OpenAI": {
    "ApiKey": "",
    "ChatModel": "gpt-4o",
    "RealtimeModel": "gpt-4o-realtime-preview",
    "TtsModel": "tts-1"
  }
}
```

## 🔧 Development

### Running the Server

```bash
cd server
dotnet run
```

### Dependencies

- `Microsoft.AspNetCore.WebSockets` - WebSocket support
- `System.Net.Http.Json` - HTTP client with JSON support

### CORS Configuration

Configured to allow:
- Origins: `http://localhost:5173`, `http://localhost:3000`
- Methods: All
- Headers: All
- Credentials: Enabled

## 🛡️ Security

### API Key Management
- API keys are never exposed to the client
- Environment variable takes precedence over appsettings.json
- Validation on startup

### Input Validation
- Request body validation for all endpoints
- Text length limits for TTS (4096 characters)
- Message array validation for chat

### Error Handling
- Graceful error responses
- No sensitive data in error messages
- Proper HTTP status codes