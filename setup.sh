#!/bin/bash

# AI Interview Platform Setup Script
echo "🚀 Setting up AI Interview Platform..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL is not installed. Please install PostgreSQL and try again."
    echo "   On macOS: brew install postgresql"
    echo "   On Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    echo "   On Windows: Download from https://www.postgresql.org/download/"
    exit 1
fi

# Check if Docker is installed (optional)
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. You can still run the project locally."
    echo "   To use Docker, install Docker Desktop from https://www.docker.com/products/docker-desktop"
fi

echo "✅ Prerequisites check passed!"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install

# Install client dependencies
echo "📦 Installing client dependencies..."
cd ../client
npm install
cd ..

# Create environment files
echo "⚙️  Setting up environment files..."

# Server environment
if [ ! -f server/.env ]; then
    cp server/env.example server/.env
    echo "📝 Created server/.env file. Please update it with your API keys."
fi

# Client environment
if [ ! -f client/.env.local ]; then
    cp client/env.example client/.env.local
    echo "📝 Created client/.env.local file."
fi

# Database setup
echo "🗄️  Setting up database..."

# Check if database exists
DB_EXISTS=$(psql -U postgres -lqt | cut -d \| -f 1 | grep -w ai_interview | wc -l)

if [ $DB_EXISTS -eq 0 ]; then
    echo "Creating database..."
    createdb -U postgres ai_interview
    echo "✅ Database created successfully!"
else
    echo "✅ Database already exists!"
fi

# Run Prisma migrations
echo "🔄 Running database migrations..."
cd server
npx prisma migrate dev --name init
npx prisma generate

# Seed the database
echo "🌱 Seeding database with sample data..."
node scripts/seed.js

cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update server/.env with your API keys:"
echo "   - OPENAI_API_KEY=your_openai_api_key"
echo "   - ELEVENLABS_API_KEY=your_elevenlabs_api_key"
echo "   - JWT_SECRET=your_jwt_secret"
echo ""
echo "2. Start the development servers:"
echo "   npm run dev"
echo ""
echo "3. Or start with Docker:"
echo "   docker-compose up -d"
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo ""
echo "👤 Default credentials:"
echo "   Admin: admin@example.com / admin123"
echo "   Candidate: candidate@example.com / candidate123"
echo ""
echo "📚 Documentation: README.md"
echo "🐛 Issues: Check the logs in server/logs/"
echo ""
echo "Happy interviewing! 🎤"
