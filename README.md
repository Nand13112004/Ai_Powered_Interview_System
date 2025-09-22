# 🤖 MockMate AI Interview Platform

A comprehensive, AI-powered mock interview platform featuring real-time communication, advanced proctoring, automated scoring, and intelligent candidate evaluation. Built for both candidates and interviewers to conduct professional technical interviews with enterprise-grade security and monitoring.

![MockMate AI](https://img.shields.io/badge/MockMate%20AI-Interview%20Platform-blue) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Node.js](https://img.shields.io/badge/Node.js-18-green) ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green) ![Socket.io](https://img.shields.io/badge/Socket.io-Real--time-orange) ![AI Powered](https://img.shields.io/badge/AI-Powered-purple)

## 🌟 Features

### For Candidates
- **AI-Powered Interviews**: Engage with intelligent AI interviewers that adapt to your responses
- **Real-Time Communication**: Seamless audio/video communication with WebRTC
- **Text & Voice Responses**: Support for both typed and spoken answers
- **Progress Tracking**: Real-time progress monitoring and question navigation
- **Secure Environment**: Advanced proctoring with face detection and behavior monitoring
- **Session Management**: Resume incomplete interviews, automatic session recovery
- **Answer Storage**: All responses automatically saved to database

### For Interviewers
- **Interview Management**: Create, schedule, and manage multiple interviews
- **Question Bank**: Curated technical questions with difficulty levels
- **Live Monitoring**: Real-time interview observation and intervention
- **Response Review**: View all candidate answers with timestamps
- **Analytics Dashboard**: Comprehensive reporting and candidate insights
- **Code-Based Access**: Secure interview access with unique codes and passwords

### Advanced Features
- **🔒 Advanced Proctoring**
  - Face detection and recognition
  - Tab switching detection (2-second warning)
  - Copy/paste monitoring
  - Fullscreen enforcement (3-second warning)
  - DevTools detection
  - Multiple face detection
  - Speech pattern analysis
  - Window focus monitoring

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
│   │   ├── create-interview/ # Interview creation
│   │   └── dashboard/     # Interviewer management
│   ├── interviewroom/     # Interview interface
│   │   └── [id]/         # Dynamic interview pages
│   └── page.tsx          # Landing page
├── components/            # Reusable UI components
│   ├── InterviewRoom.tsx # Main interview interface
│   ├── InterviewRoom_Updated.tsx # Enhanced interview room
│   ├── Dashboard.tsx     # User dashboard
│   ├── InterviewerDashboard.tsx # Interviewer interface
│   ├── InterviewCompletionModal.tsx # Completion modal
│   ├── JoinByCode.tsx    # Code-based interview joining
│   ├── LandingPage.tsx   # Marketing page
│   └── ui/               # ShadCN UI components
├── contexts/             # React contexts
│   └── AuthContext.tsx   # Authentication state
├── lib/                  # Utilities and services
│   ├── api.ts           # API client with interceptors
│   ├── socket.ts        # WebSocket client
│   ├── supabaseClient.js # Database client
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
│   ├── answers.js      # Answer processing
│   ├── responses.js    # Response management
│   └── generateQuestions.js # AI question generation
├── models/             # MongoDB models
│   ├── User.js        # User schema
│   ├── Interview.js   # Interview schema
│   ├── Session.js     # Session schema
│   ├── Question.js    # Question schema
│   ├── Answer.js      # Answer schema
│   ├── Response.js    # Response schema
│   └── ProctorEvent.js # Proctoring events
├── socket/             # WebSocket handlers
│   ├── handlers.js     # Socket event handlers
│   └── interviewHandler.js # Interview-specific logic
├── services/           # Business logic
│   └── aiService.js   # AI integration service
├── middleware/         # Express middleware
│   └── auth.js        # JWT authentication
├── utils/             # Backend utilities
│   ├── mongo.js       # Database connection
│   ├── logger.js      # Logging utility
│   └── mailer.js      # Email services
├── prisma/            # Database schema
│   ├── schema.prisma  # Prisma schema definition
│   └── migrations/    # Database migrations
├── scripts/           # Utility scripts
│   └── seed.js       # Database seeding
├── test-gemini.js     # AI integration testing
└── index.js           # Server entry point
```

### Database Schema (MongoDB + Prisma)
- **Users**: Authentication and profile management
- **Interviews**: Interview templates and configurations
- **Sessions**: Active interview instances with status tracking
- **Questions**: Interview questions with metadata
- **Answers**: Candidate responses stored in Answer collection
- **Responses**: Candidate responses stored in Response collection (for interviewer view)
- **ProctorEvents**: Security and monitoring events

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas or local MongoDB
- npm or yarn
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd hackathon
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
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mockmate
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/mockmate

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
CLIENT_URL=http://localhost:3000

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

# Seed the database (optional)
npm run seed
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
   - Enter password for secure access
   - Grant camera and microphone permissions
   - System automatically enters fullscreen mode

3. **During Interview**
   - Answer questions using voice (recording) or text input
   - Navigate between questions using "Next Question" button
   - Monitor progress and time remaining
   - System enforces anti-cheating measures:
     - Must stay in fullscreen mode
     - Tab switching detected (2-second warning)
     - Window focus monitoring
     - Copy/paste detection
   - Complete interview when finished using "Finish Interview" button

4. **Interview Completion**
   - All answers automatically submitted to database
   - Session marked as completed
   - Redirected to dashboard
   - Answers visible to interviewer

### For Interviewers

1. **Create Interview**
   - Login to interviewer dashboard
   - Click "Create New Interview"
   - Select role and difficulty level
   - Configure interview parameters (duration, questions)
   - Generate or manually add questions
   - Set secure password for interview access
   - System generates unique interview code

2. **Share Interview**
   - Provide interview code and password to candidates
   - Monitor active interviews in dashboard
   - View real-time candidate progress

3. **Review Results**
   - Click "View Details" on any interview
   - Review all candidate responses
   - View timestamps and answer quality
   - Analyze performance metrics
   - Export results if needed

## 🔧 Configuration

### Interview Settings
- **Duration**: 15-120 minutes
- **Difficulty**: Entry, Junior, Mid, Senior, Expert
- **Roles**: Frontend, Backend, Fullstack, DevOps, Data Science
- **Proctoring Level**: Basic, Standard, Strict (currently set to Strict)

### AI Configuration
- **Model Selection**: GPT-4, Gemini Pro, Claude
- **Response Style**: Professional, Casual, Technical
- **Scoring Algorithm**: Weighted, Binary, Detailed

### Security Settings
- **Strict Mode**: Enabled by default
- **Fullscreen Enforcement**: Required for interview start
- **Tab Switch Detection**: 2-second warning, then termination
- **Window Focus**: 2-second warning, then termination
- **Fullscreen Exit**: 3-second warning, then termination

## 🔒 Security Features

### Proctoring System
- **Visual Monitoring**: Face detection and recognition
- **Behavioral Analysis**: Tab switching, copy/paste detection
- **Environment Control**: Fullscreen enforcement
- **Technical Prevention**: DevTools and debugging prevention
- **Incident Tracking**: All violations logged with timestamps

### Data Protection
- **Encryption**: JWT tokens with secure secrets
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API request throttling
- **CORS Protection**: Secure cross-origin policies
- **Session Management**: Secure session handling with resumption

### Anti-Cheating Measures
- **Fullscreen Required**: Must stay in fullscreen mode
- **Tab Switch Detection**: Immediate warning, termination after 2 seconds
- **Window Focus**: Must maintain window focus
- **Copy/Paste Prevention**: Detected and logged
- **Context Menu Disabled**: Right-click disabled
- **Keyboard Shortcuts**: Ctrl+C/V/X detected
- **Face Detection**: Multiple faces detected (if camera available)
- **Audio Analysis**: Speech without face detected

## 🤖 AI Integration

### Question Generation
- Dynamic question creation based on role and level
- Context-aware follow-up questions
- Technical accuracy validation
- AI-powered question difficulty adjustment

### Response Analysis
- Natural language processing
- Technical concept extraction
- Sentiment and confidence analysis
- Automated scoring algorithms
- Real-time feedback generation

### Real-Time Processing
- Speech-to-text conversion
- Text-to-speech synthesis
- Real-time response generation
- Live feedback provision
- Context-aware AI interviewer responses

## 📊 Analytics & Reporting

### Performance Metrics
- **Response Time**: Average answer time per question
- **Accuracy Score**: Technical correctness assessment
- **Communication Score**: Clarity and confidence metrics
- **Problem-Solving Score**: Logic and approach evaluation
- **Incident Count**: Proctoring violations tracked

### Visual Analytics
- **Progress Charts**: Real-time progress visualization
- **Heat Maps**: Question difficulty analysis
- **Trend Analysis**: Performance over time
- **Comparative Reports**: Candidate benchmarking
- **Session Analytics**: Interview completion rates

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

# Test interview completion
node test-interview-completion.js
```

### Test Categories
- **Unit Tests**: Component and utility functions
- **Integration Tests**: API endpoints and database operations
- **E2E Tests**: Complete user workflows
- **Performance Tests**: Load testing and optimization
- **Security Tests**: Proctoring and anti-cheating validation

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
- **Database**: MongoDB Atlas, Supabase
- **File Storage**: AWS S3, CloudFlare R2

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-production-jwt-secret
OPENAI_API_KEY=your-production-openai-key
GEMINI_API_KEY=your-production-gemini-key
CLIENT_URL=https://your-frontend-domain.com
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
- `GET /api/interviews/:id/responses` - Get interview responses
- `POST /api/interviews/join-by-code` - Join interview by code

### Sessions
- `POST /api/sessions` - Start interview session
- `GET /api/sessions/:id` - Get session details
- `PUT /api/sessions/:id` - Update session
- `POST /api/sessions/fresh` - Create fresh session

### Answers & Responses
- `POST /api/answers` - Submit answer
- `GET /api/answers/by-interview/:interviewId` - Get answers by interview
- `GET /api/answers/my-answers/:interviewId` - Get user's answers
- `POST /api/responses` - Submit response
- `GET /api/responses/my-responses/:interviewId` - Get user's responses

### WebSocket Events
- `join_interview` - Join interview room
- `text_message` - Send text response
- `audio_data` - Send audio data
- `ai_response` - Receive AI response
- `interview_completed` - Interview completion
- `proctor_event` - Proctoring incident
- `proctor_threshold_breach` - Security violation

## 🔧 Recent Updates & Fixes

### Session Management
- ✅ Fixed session creation and resumption
- ✅ Resolved "already attempted" errors
- ✅ Improved session ID handling
- ✅ Added session recovery mechanisms

### Interview Flow
- ✅ Fixed Finish Interview button functionality
- ✅ Improved answer submission and storage
- ✅ Enhanced question navigation
- ✅ Added proper completion flow

### Security & Proctoring
- ✅ Implemented strict fullscreen enforcement
- ✅ Added tab switching detection with warnings
- ✅ Enhanced window focus monitoring
- ✅ Improved incident tracking and reporting

### Answer Storage
- ✅ Dual storage system (Answer + Response collections)
- ✅ Real-time answer submission
- ✅ Interviewer view of all responses
- ✅ Complete answer history tracking

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
- **MongoDB** team for the excellent database
- **TailwindCSS** for the utility-first CSS framework
- **ShadCN** for beautiful UI components
- **Socket.io** for real-time communication

## 📞 Support

- **Documentation**: [docs.mockmate.ai](https://docs.mockmate.ai)
- **Issues**: [GitHub Issues](https://github.com/your-username/mockmate-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/mockmate-ai/discussions)
- **Email**: support@mockmate.ai

## 🗺️ Roadmap

### Phase 1 (Current) ✅
- ✅ Basic interview functionality
- ✅ Real-time communication
- ✅ User authentication
- ✅ Advanced proctoring
- ✅ Answer storage and retrieval
- ✅ Session management
- ✅ Anti-cheating measures

### Phase 2 (Next)
- 🔄 Advanced AI interviewer with personality
- 🔄 Comprehensive analytics dashboard
- 🔄 Mobile application
- 🔄 Multi-language support
- 🔄 Video recording capabilities

### Phase 3 (Future)
- 🔄 VR interview environments
- 🔄 Advanced behavioral analysis
- 🔄 Integration with ATS systems
- 🔄 White-label solutions
- 🔄 AI-powered interview coaching

---

**Built with ❤️ for the future of technical interviews**

*MockMate AI - Revolutionizing the way we assess technical talent*

## 🎯 Key Features Summary

### What Makes MockMate AI Special:

1. **🔒 Enterprise-Grade Security**: Advanced proctoring with real-time monitoring
2. **🤖 AI-Powered**: Intelligent interviewers that adapt to candidate responses
3. **📊 Complete Analytics**: Comprehensive reporting and performance metrics
4. **🔄 Real-Time**: Live communication with WebSocket technology
5. **💾 Reliable Storage**: Dual database system for answer persistence
6. **🎯 User-Friendly**: Intuitive interface for both candidates and interviewers
7. **⚡ High Performance**: Optimized for speed and scalability
8. **🛡️ Anti-Cheating**: Multiple layers of security and monitoring

### Perfect For:
- **Tech Companies**: Conducting technical interviews
- **Recruitment Agencies**: Screening candidates efficiently
- **Educational Institutions**: Practice interviews for students
- **Individual Developers**: Preparing for technical interviews
- **HR Teams**: Streamlining interview processes

---

*Start your journey with MockMate AI today and experience the future of technical interviews!*