# 🤖 MockMate AI Interview Platform

A comprehensive, AI-powered mock interview platform featuring real-time communication, advanced proctoring, automated scoring, and intelligent candidate evaluation. Built for both candidates and interviewers to conduct professional technical interviews with enterprise-grade security and monitoring.

![MockMate AI](https://img.shields.io/badge/MockMate%20AI-Interview%20Platform-blue) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Node.js](https://img.shields.io/badge/Node.js-18-green) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue) ![Socket.io](https://img.shields.io/badge/Socket.io-Real--time-orange) ![AI Powered](https://img.shields.io/badge/AI-Powered-purple)

## 🌟 Features

### For Candidates
- **AI-Powered Interviews**: Engage with intelligent AI interviewers that adapt to your responses
- **Real-Time Communication**: Seamless audio/video communication with WebRTC
- **Text & Voice Responses**: Support for both typed and spoken answers
- **Progress Tracking**: Real-time progress monitoring and question navigation
- **Secure Environment**: Advanced proctoring with face detection and behavior monitoring

### For Interviewers
- **Interview Management**: Create, schedule, and manage multiple interviews
- **Question Bank**: Curated technical questions with difficulty levels
- **Live Monitoring**: Real-time interview observation and intervention
- **Automated Scoring**: AI-powered evaluation and feedback generation
- **Analytics Dashboard**: Comprehensive reporting and candidate insights

### Advanced Features
- **🔒 Advanced Proctoring**
  - Face detection and recognition
  - Tab switching detection
  - Copy/paste monitoring
  - Fullscreen enforcement
  - DevTools detection
  - Multiple face detection
  - Speech pattern analysis

- **🎯 AI Integration**
  - Dynamic question generation
  - Context-aware follow-ups
  - Real-time response analysis
  - Automated scoring algorithms
  - Sentiment analysis
  - Technical skill assessment

- **📊 Analytics & Reporting**
  - Performance metrics
  - Time-based analytics
  - Question difficulty analysis
  - Candidate comparison tools
  - Export capabilities

## 🏗️ Architecture

### Frontend (Next.js 14)
```
client/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Candidate dashboard
│   ├── interviewer/       # Interviewer dashboard
│   └── page.tsx          # Landing page
├── components/            # Reusable UI components
│   ├── InterviewRoom.tsx # Main interview interface
│   ├── Dashboard.tsx     # User dashboard
│   └── LandingPage.tsx   # Marketing page
├── contexts/             # React contexts
│   └── AuthContext.tsx   # Authentication state
├── lib/                  # Utilities and services
│   ├── api.ts           # API client
│   ├── socket.ts        # WebSocket client
│   └── utils.ts         # Helper functions
└── Dockerfile           # Container configuration
```

### Backend (Node.js/Express)
```
server/
├── routes/              # API endpoints
│   ├── auth.js         # Authentication routes
│   ├── interviews.js   # Interview management
│   ├── sessions.js     # Interview sessions
│   └── answers.js      # Answer processing
├── models/             # Database models
│   ├── User.js        # User schema
│   └── Answer.js      # Answer schema
├── utils/             # Backend utilities
│   ├── mongo.js       # Database connection
│   └── mailer.js      # Email services
├── test-gemini.js     # AI integration testing
└── index.js           # Server entry point
```

### Database Schema (Prisma)
- **Users**: Authentication and profile management
- **Interviews**: Interview templates and configurations
- **Sessions**: Active interview instances
- **Answers**: Candidate responses and evaluations
- **Analytics**: Performance metrics and reporting

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm or yarn
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd mockmate-ai-interview
```

2. **Install dependencies**
```bash
# Install all dependencies
npm run install-all

# Or install separately
cd client && npm install
cd ../server && npm install
```

3. **Environment Setup**

Create environment files:

**Server (.env)**
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/mockmate

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here

# AI Services
OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Server Configuration
PORT=5000
NODE_ENV=development

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

**Client (.env.local)**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Database Setup**
```bash
# Run Prisma migrations
cd server
npx prisma migrate dev
npx prisma generate
```

5. **Start Development Servers**

**Option A: Using npm scripts**
```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend
npm run client
```

**Option B: Using concurrent**
```bash
# Start both servers simultaneously
npm run dev
```

6. **Access the Application**

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **WebSocket**: ws://localhost:5000

## 📖 Usage Guide

### For Candidates

1. **Registration/Login**
   - Create account or login with existing credentials
   - Complete profile setup

2. **Join Interview**
   - Enter interview code provided by interviewer
   - Grant camera and microphone permissions
   - Wait for interview to begin

3. **During Interview**
   - Answer questions using voice or text
   - Navigate between questions
   - Monitor progress and time remaining
   - Complete interview when finished

### For Interviewers

1. **Create Interview**
   - Login to interviewer dashboard
   - Select role and difficulty level
   - Configure interview parameters
   - Generate or select questions

2. **Manage Sessions**
   - Monitor active interviews
   - View candidate progress
   - Access real-time analytics

3. **Review Results**
   - Review candidate responses
   - Analyze performance metrics
   - Generate detailed reports

## 🔧 Configuration

### Interview Settings
- **Duration**: 15-120 minutes
- **Difficulty**: Entry, Junior, Mid, Senior, Expert
- **Roles**: Frontend, Backend, Fullstack, DevOps, Data Science
- **Proctoring Level**: Basic, Standard, Strict

### AI Configuration
- **Model Selection**: GPT-4, Gemini Pro, Claude
- **Response Style**: Professional, Casual, Technical
- **Scoring Algorithm**: Weighted, Binary, Detailed

## 🔒 Security Features

### Proctoring System
- **Visual Monitoring**: Face detection and recognition
- **Behavioral Analysis**: Tab switching, copy/paste detection
- **Environment Control**: Fullscreen enforcement
- **Technical Prevention**: DevTools and debugging prevention

### Data Protection
- **Encryption**: JWT tokens with secure secrets
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API request throttling
- **CORS Protection**: Secure cross-origin policies

## 🤖 AI Integration

### Question Generation
- Dynamic question creation based on role and level
- Context-aware follow-up questions
- Technical accuracy validation

### Response Analysis
- Natural language processing
- Technical concept extraction
- Sentiment and confidence analysis
- Automated scoring algorithms

### Real-Time Processing
- Speech-to-text conversion
- Text-to-speech synthesis
- Real-time response generation
- Live feedback provision

## 📊 Analytics & Reporting

### Performance Metrics
- **Response Time**: Average answer time per question
- **Accuracy Score**: Technical correctness assessment
- **Communication Score**: Clarity and confidence metrics
- **Problem-Solving Score**: Logic and approach evaluation

### Visual Analytics
- **Progress Charts**: Real-time progress visualization
- **Heat Maps**: Question difficulty analysis
- **Trend Analysis**: Performance over time
- **Comparative Reports**: Candidate benchmarking

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Test Categories
- **Unit Tests**: Component and utility functions
- **Integration Tests**: API endpoints and database operations
- **E2E Tests**: Complete user workflows
- **Performance Tests**: Load testing and optimization

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Production build
docker build -t mockmate-ai ./client
docker build -t mockmate-server ./server
```

### Cloud Deployment
- **Frontend**: Vercel, Netlify
- **Backend**: Railway, Render, DigitalOcean
- **Database**: Supabase, PlanetScale, AWS RDS
- **File Storage**: AWS S3, CloudFlare R2

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL=your-production-database-url
JWT_SECRET=your-production-jwt-secret
OPENAI_API_KEY=your-production-openai-key
REDIS_URL=your-redis-url
```

## 📚 API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Interviews
- `GET /api/interviews` - List user interviews
- `POST /api/interviews` - Create new interview
- `GET /api/interviews/:id` - Get interview details
- `PUT /api/interviews/:id` - Update interview
- `DELETE /api/interviews/:id` - Delete interview

### Sessions
- `POST /api/sessions` - Start interview session
- `GET /api/sessions/:id` - Get session details
- `PUT /api/sessions/:id` - Update session
- `POST /api/sessions/:id/complete` - Complete session

### WebSocket Events
- `join_interview` - Join interview room
- `text_message` - Send text response
- `audio_data` - Send audio data
- `ai_response` - Receive AI response
- `interview_completed` - Interview completion

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Install dependencies: `npm run install-all`
4. Make your changes
5. Run tests: `npm run test`
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open Pull Request

### Code Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Airbnb configuration with custom rules
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality checks

### Commit Convention
```
feat: add new interview feature
fix: resolve proctoring issue
docs: update API documentation
style: improve component styling
refactor: optimize database queries
test: add unit tests for auth
chore: update dependencies
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for GPT models and AI capabilities
- **Google** for Gemini AI integration
- **Next.js** team for the amazing React framework
- **Prisma** team for the excellent ORM
- **TailwindCSS** for the utility-first CSS framework
- **ShadCN** for beautiful UI components

## 📞 Support

- **Documentation**: [docs.mockmate.ai](https://docs.mockmate.ai)
- **Issues**: [GitHub Issues](https://github.com/your-username/mockmate-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/mockmate-ai/discussions)
- **Email**: support@mockmate.ai

## 🗺️ Roadmap

### Phase 1 (Current)
- ✅ Basic interview functionality
- ✅ Real-time communication
- ✅ User authentication
- ✅ Basic proctoring

### Phase 2 (Next)
- 🔄 Advanced AI interviewer
- 🔄 Comprehensive analytics
- 🔄 Mobile application
- 🔄 Multi-language support

### Phase 3 (Future)
- 🔄 VR interview environments
- 🔄 Advanced behavioral analysis
- 🔄 Integration with ATS systems
- 🔄 White-label solutions

---

**Built with ❤️ for the future of technical interviews**

*MockMate AI - Revolutionizing the way we assess technical talent*
