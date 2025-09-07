@echo off
echo 🚀 Setting up AI Interview Platform...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

echo ✅ Node.js is installed

REM Install root dependencies
echo 📦 Installing root dependencies...
call npm install

REM Install server dependencies
echo 📦 Installing server dependencies...
cd server
call npm install

REM Install client dependencies
echo 📦 Installing client dependencies...
cd ..\client
call npm install
cd ..

REM Create environment files
echo ⚙️ Setting up environment files...

REM Server environment
if not exist server\.env (
    copy server\env.example server\.env
    echo 📝 Created server\.env file. Please update it with your API keys.
)

REM Client environment
if not exist client\.env.local (
    copy client\env.example client\.env.local
    echo 📝 Created client\.env.local file.
)

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next steps:
echo 1. Update server\.env with your API keys:
echo    - OPENAI_API_KEY=your_openai_api_key
echo    - ELEVENLABS_API_KEY=your_elevenlabs_api_key
echo    - JWT_SECRET=your_jwt_secret
echo.
echo 2. Set up PostgreSQL database:
echo    - Install PostgreSQL
echo    - Create database: ai_interview
echo    - Update DATABASE_URL in server\.env
echo.
echo 3. Start the development servers:
echo    npm run dev
echo.
echo 🌐 Access the application:
echo    Frontend: http://localhost:3000
echo    Backend API: http://localhost:5000
echo.
echo 📚 Documentation: README.md
echo.
echo Happy interviewing! 🎤
pause
