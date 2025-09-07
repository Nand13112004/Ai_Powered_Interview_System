# AI Interview Platform

A comprehensive AI-powered interview platform featuring real-time audio/video communication, AI interviewer, and automated scoring.

## Features

- 🎤 Real-time audio communication via WebRTC
- 🤖 AI interviewer powered by GPT-4
- 🎯 Speech-to-Text and Text-to-Speech integration
- 📊 Automated scoring and feedback
- 📈 Progress tracking and analytics
- 🔐 JWT authentication
- 💾 PostgreSQL database
- 🎨 Modern UI with TailwindCSS and ShadCN

## Tech Stack

### Frontend
- React.js with Next.js
- TailwindCSS + ShadCN UI components
- WebRTC for real-time communication
- MediaRecorder API for audio capture

### Backend
- Node.js with Express.js
- WebSockets for real-time communication
- JWT authentication
- PostgreSQL database

### AI/ML
- OpenAI GPT-4 for conversation
- OpenAI Whisper for Speech-to-Text
- ElevenLabs for Text-to-Speech
- Custom scoring algorithms

## Quick Start

1. Install dependencies:
```bash
npm run install-all
```

2. Set up environment variables:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

3. Start development servers:
```bash
npm run dev
```

## Environment Variables

### Server (.env)
```
DATABASE_URL=postgresql://username:password@localhost:5432/ai_interview
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
PORT=5000
```

### Client (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000
```

## Project Structure

```
├── client/                 # React/Next.js frontend
├── server/                 # Node.js/Express backend
├── shared/                 # Shared types and utilities
└── docs/                   # Documentation
```

## API Endpoints

- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/interviews` - Get user interviews
- `POST /api/interviews` - Start new interview
- `WebSocket /ws` - Real-time interview communication

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
