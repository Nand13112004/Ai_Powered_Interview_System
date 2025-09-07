# AI Interview Platform - Deployment Guide

This guide covers different deployment options for the AI Interview Platform.

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Git

### Setup
1. Clone the repository
2. Run the setup script:
   ```bash
   # On Windows
   setup.bat
   
   # On macOS/Linux
   chmod +x setup.sh && ./setup.sh
   ```
3. Update environment variables in `server/.env`
4. Start development servers:
   ```bash
   npm run dev
   ```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd ai-interview-platform
   ```

2. **Configure environment**:
   ```bash
   cp server/env.example server/.env
   cp client/env.example client/.env.local
   ```

3. **Update environment variables**:
   ```bash
   # server/.env
   OPENAI_API_KEY=your_openai_api_key
   ELEVENLABS_API_KEY=your_elevenlabs_api_key
   JWT_SECRET=your_super_secret_jwt_key
   ```

4. **Start services**:
   ```bash
   docker-compose up -d
   ```

5. **Initialize database**:
   ```bash
   docker-compose exec backend npx prisma migrate dev
   docker-compose exec backend node scripts/seed.js
   ```

### Access Points
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Database: localhost:5432

## ☁️ Cloud Deployment

### AWS Deployment

#### Using AWS ECS with Fargate

1. **Build and push Docker images**:
   ```bash
   # Build images
   docker build -t ai-interview-backend ./server
   docker build -t ai-interview-frontend ./client
   
   # Tag for ECR
   docker tag ai-interview-backend:latest <account>.dkr.ecr.<region>.amazonaws.com/ai-interview-backend:latest
   docker tag ai-interview-frontend:latest <account>.dkr.ecr.<region>.amazonaws.com/ai-interview-frontend:latest
   
   # Push to ECR
   docker push <account>.dkr.ecr.<region>.amazonaws.com/ai-interview-backend:latest
   docker push <account>.dkr.ecr.<region>.amazonaws.com/ai-interview-frontend:latest
   ```

2. **Create RDS PostgreSQL instance**:
   ```bash
   aws rds create-db-instance \
     --db-instance-identifier ai-interview-db \
     --db-instance-class db.t3.micro \
     --engine postgres \
     --master-username postgres \
     --master-user-password <password> \
     --allocated-storage 20
   ```

3. **Deploy with ECS**:
   - Create ECS cluster
   - Create task definitions
   - Create services
   - Configure load balancer

#### Using AWS App Runner

1. **Create apprunner.yaml**:
   ```yaml
   version: 1.0
   runtime: docker
   build:
     commands:
       build:
         - echo "Build started on `date`"
         - docker build -t ai-interview .
   run:
     runtime-version: latest
     command: npm start
     network:
       port: 5000
       env: PORT
     env:
       - name: NODE_ENV
         value: production
   ```

### Google Cloud Platform

#### Using Cloud Run

1. **Build and deploy**:
   ```bash
   # Build and push to GCR
   gcloud builds submit --tag gcr.io/PROJECT-ID/ai-interview-backend ./server
   gcloud builds submit --tag gcr.io/PROJECT-ID/ai-interview-frontend ./client
   
   # Deploy to Cloud Run
   gcloud run deploy ai-interview-backend \
     --image gcr.io/PROJECT-ID/ai-interview-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

2. **Setup Cloud SQL**:
   ```bash
   gcloud sql instances create ai-interview-db \
     --database-version=POSTGRES_13 \
     --tier=db-f1-micro \
     --region=us-central1
   ```

### Vercel (Frontend Only)

1. **Deploy frontend**:
   ```bash
   cd client
   npx vercel --prod
   ```

2. **Configure environment variables** in Vercel dashboard:
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_WS_URL`

## 🔧 Environment Configuration

### Required Environment Variables

#### Backend (`server/.env`)
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ai_interview"

# JWT
JWT_SECRET="your_super_secret_jwt_key_here"

# OpenAI
OPENAI_API_KEY="sk-your_openai_api_key_here"

# ElevenLabs
ELEVENLABS_API_KEY="your_elevenlabs_api_key_here"

# Server
PORT=5000
NODE_ENV=production

# CORS
CLIENT_URL="https://yourdomain.com"
```

#### Frontend (`client/.env.local`)
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
```

## 📊 Database Setup

### PostgreSQL Setup

1. **Create database**:
   ```sql
   CREATE DATABASE ai_interview;
   CREATE USER ai_interview_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE ai_interview TO ai_interview_user;
   ```

2. **Run migrations**:
   ```bash
   cd server
   npx prisma migrate deploy
   npx prisma generate
   ```

3. **Seed data** (optional):
   ```bash
   node scripts/seed.js
   ```

## 🔒 Security Considerations

### Production Security Checklist

- [ ] Use strong JWT secrets (32+ characters)
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Use environment variables for secrets
- [ ] Enable database SSL connections
- [ ] Set up proper firewall rules
- [ ] Regular security updates
- [ ] Monitor logs and errors
- [ ] Backup database regularly

### SSL/TLS Setup

#### Using Let's Encrypt with Nginx
```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📈 Monitoring and Logging

### Application Monitoring

1. **Health Checks**:
   - Backend: `GET /health`
   - Database connectivity
   - External API availability

2. **Logging**:
   - Application logs in `server/logs/`
   - Error tracking with Sentry
   - Performance monitoring

3. **Metrics**:
   - Response times
   - Error rates
   - User sessions
   - API usage

### Database Monitoring

```sql
-- Monitor active connections
SELECT count(*) FROM pg_stat_activity;

-- Check database size
SELECT pg_size_pretty(pg_database_size('ai_interview'));

-- Monitor slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to AWS
        run: |
          # Your deployment commands here
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   - Check DATABASE_URL format
   - Verify database server is running
   - Check firewall/network settings

2. **WebSocket Connection Issues**:
   - Verify WebSocket URL configuration
   - Check proxy/load balancer settings
   - Ensure proper CORS configuration

3. **Audio Recording Issues**:
   - Check browser permissions
   - Verify HTTPS for microphone access
   - Test with different browsers

4. **AI API Issues**:
   - Verify API keys are correct
   - Check API rate limits
   - Monitor API usage and costs

### Performance Optimization

1. **Database Optimization**:
   - Add proper indexes
   - Optimize queries
   - Use connection pooling

2. **Frontend Optimization**:
   - Enable Next.js optimizations
   - Use CDN for static assets
   - Implement caching strategies

3. **Backend Optimization**:
   - Use Redis for caching
   - Implement request compression
   - Optimize WebSocket connections

## 📞 Support

For deployment issues:
1. Check the logs in `server/logs/`
2. Review environment configuration
3. Test database connectivity
4. Verify external API access

## 🔄 Updates and Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Monitor error logs
   - Check database performance
   - Review API usage

2. **Monthly**:
   - Update dependencies
   - Review security patches
   - Backup database

3. **Quarterly**:
   - Performance review
   - Security audit
   - Capacity planning
