const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'admin'
    }
  });

  // Create sample candidate
  const candidatePassword = await bcrypt.hash('candidate123', 12);
  const candidate = await prisma.user.upsert({
    where: { email: 'candidate@example.com' },
    update: {},
    create: {
      email: 'candidate@example.com',
      password: candidatePassword,
      name: 'John Doe',
      role: 'candidate'
    }
  });

  // Create sample interviews
  const interviews = [
    {
      title: 'Software Engineer - Backend',
      description: 'Comprehensive backend development interview covering system design, algorithms, and database optimization.',
      role: 'Software Engineer',
      level: 'senior',
      duration: 60,
      questions: [
        'Tell me about yourself and your experience with backend development.',
        'How would you design a scalable microservices architecture?',
        'Explain the difference between SQL and NoSQL databases.',
        'How would you handle database performance optimization?',
        'Describe a challenging technical problem you solved recently.'
      ],
      rubric: {
        communication: { weight: 0.2, criteria: ['Clarity', 'Structure', 'Engagement'] },
        technical: { weight: 0.4, criteria: ['Knowledge depth', 'Problem solving', 'Best practices'] },
        problemSolving: { weight: 0.3, criteria: ['Approach', 'Logic', 'Creativity'] },
        experience: { weight: 0.1, criteria: ['Relevance', 'Impact', 'Learning'] }
      }
    },
    {
      title: 'Frontend Developer - React',
      description: 'Frontend development interview focusing on React, JavaScript, and modern web development practices.',
      role: 'Frontend Developer',
      level: 'mid',
      duration: 45,
      questions: [
        'What is your experience with React and modern JavaScript?',
        'Explain the difference between functional and class components.',
        'How would you optimize a React application for performance?',
        'Describe your experience with state management solutions.',
        'How do you handle responsive design and cross-browser compatibility?'
      ],
      rubric: {
        communication: { weight: 0.2, criteria: ['Clarity', 'Structure', 'Engagement'] },
        technical: { weight: 0.4, criteria: ['React knowledge', 'JavaScript skills', 'Best practices'] },
        problemSolving: { weight: 0.3, criteria: ['Approach', 'Logic', 'Creativity'] },
        experience: { weight: 0.1, criteria: ['Relevance', 'Impact', 'Learning'] }
      }
    },
    {
      title: 'Data Scientist - Machine Learning',
      description: 'Data science interview covering machine learning, statistics, and data analysis techniques.',
      role: 'Data Scientist',
      level: 'senior',
      duration: 75,
      questions: [
        'Walk me through your experience with machine learning projects.',
        'How would you approach feature selection for a classification problem?',
        'Explain the bias-variance tradeoff in machine learning.',
        'How do you handle overfitting in your models?',
        'Describe a time when you had to explain complex statistical concepts to non-technical stakeholders.'
      ],
      rubric: {
        communication: { weight: 0.2, criteria: ['Clarity', 'Structure', 'Engagement'] },
        technical: { weight: 0.4, criteria: ['ML knowledge', 'Statistics', 'Tools'] },
        problemSolving: { weight: 0.3, criteria: ['Approach', 'Logic', 'Creativity'] },
        experience: { weight: 0.1, criteria: ['Relevance', 'Impact', 'Learning'] }
      }
    },
    {
      title: 'Product Manager - Technical',
      description: 'Product management interview focusing on technical product strategy, user research, and cross-functional collaboration.',
      role: 'Product Manager',
      level: 'senior',
      duration: 60,
      questions: [
        'Tell me about a product you managed from conception to launch.',
        'How do you prioritize features in a product roadmap?',
        'Describe your experience working with engineering teams.',
        'How do you measure product success and user engagement?',
        'Walk me through your user research and validation process.'
      ],
      rubric: {
        communication: { weight: 0.3, criteria: ['Clarity', 'Structure', 'Engagement'] },
        technical: { weight: 0.2, criteria: ['Product knowledge', 'Analytics', 'Tools'] },
        problemSolving: { weight: 0.3, criteria: ['Approach', 'Logic', 'Creativity'] },
        experience: { weight: 0.2, criteria: ['Relevance', 'Impact', 'Leadership'] }
      }
    }
  ];

  for (const interviewData of interviews) {
    await prisma.interview.upsert({
      where: { title: interviewData.title },
      update: {},
      create: interviewData
    });
  }

  // Create sample questions
  const questions = [
    {
      text: 'Tell me about yourself and your professional background.',
      type: 'behavioral',
      category: 'introduction',
      difficulty: 'easy',
      expectedAnswer: 'Should cover relevant experience, skills, and career goals.'
    },
    {
      text: 'Describe a challenging project you worked on and how you overcame obstacles.',
      type: 'behavioral',
      category: 'problem_solving',
      difficulty: 'medium',
      expectedAnswer: 'Should demonstrate problem-solving skills, persistence, and learning ability.'
    },
    {
      text: 'How do you stay updated with the latest technologies in your field?',
      type: 'behavioral',
      category: 'learning',
      difficulty: 'easy',
      expectedAnswer: 'Should show continuous learning mindset and specific examples.'
    },
    {
      text: 'Explain the concept of object-oriented programming.',
      type: 'technical',
      category: 'programming',
      difficulty: 'medium',
      expectedAnswer: 'Should cover encapsulation, inheritance, polymorphism, and abstraction.'
    },
    {
      text: 'How would you optimize a slow database query?',
      type: 'technical',
      category: 'database',
      difficulty: 'hard',
      expectedAnswer: 'Should cover indexing, query analysis, and optimization techniques.'
    }
  ];

  for (const questionData of questions) {
    await prisma.question.upsert({
      where: { text: questionData.text },
      update: {},
      create: questionData
    });
  }

  console.log('✅ Database seeding completed!');
  console.log('📧 Admin credentials: admin@example.com / admin123');
  console.log('📧 Candidate credentials: candidate@example.com / candidate123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
