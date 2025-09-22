const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { sendVerificationEmail } = require('../utils/mailer');
const User = require('../models/User');

const router = express.Router();

// Using Mongoose models, no Prisma

// Secure JWT secret validation
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('JWT_SECRET environment variable is required in production');
    process.exit(1);
  } else {
    // Generate a random secret for development only
    const devSecret = crypto.randomBytes(64).toString('hex');
    logger.warn('JWT_SECRET not found, using generated secret for development only');
    process.env.JWT_SECRET = devSecret;
  }
}

// Enhanced validation schemas with stricter rules
const registerSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required'
  }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
  name: Joi.string().min(2).max(50).trim().required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name must not exceed 50 characters'
  }),
  role: Joi.string().valid('candidate', 'interviewer', 'admin').default('candidate'),

  // Personal Information (common)
  phone: Joi.string().min(10).max(15).optional().messages({
    'string.min': 'Phone number must be at least 10 characters long',
    'string.max': 'Phone number must not exceed 15 characters'
  }),
  profilePhoto: Joi.string().optional(),

  // Candidate-specific fields
  education: Joi.object({
    college: Joi.string().optional(),
    degree: Joi.string().optional(),
    branch: Joi.string().optional(),
    graduationYear: Joi.string().optional(),
    gpa: Joi.string().optional()
  }).optional(),

  experience: Joi.object({
    organization: Joi.string().optional(),
    jobTitle: Joi.string().optional(),
    totalExperience: Joi.string().optional(),
    skills: Joi.array().items(Joi.string()).optional()
  }).optional(),

  application: Joi.object({
    resume: Joi.string().optional(),
    coverLetter: Joi.string().optional(),
    areasOfInterest: Joi.array().items(Joi.string()).optional(),
    links: Joi.object({
      linkedin: Joi.string().optional(),
      github: Joi.string().optional(),
      portfolio: Joi.string().optional()
    }).optional()
  }).optional(),

  // Interviewer-specific fields
  professional: Joi.object({
    companyName: Joi.string().optional(),
    department: Joi.string().optional(),
    jobTitle: Joi.string().optional(),
    experienceYears: Joi.string().optional()
  }).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Please provide a valid email address'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required'
  })
});

// Email verification schema
const emailVerificationSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  code: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({
    'string.length': 'Verification code must be 6 digits',
    'string.pattern.base': 'Verification code must contain only numbers'
  })
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      email,
      password,
      name,
      role,
      phone,
      profilePhoto,
      education,
      experience,
      application,
      professional
    } = value;

    // Generate verification code and expiry (10 min)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with all fields
    const userData = {
      email,
      password: hashedPassword,
      name,
      role,
      isVerified: false,
      verificationCode,
      verificationExpires
    };

    // Add optional fields based on role
    if (phone) userData.phone = phone;
    if (profilePhoto) userData.profilePhoto = profilePhoto;

    if (role === 'candidate') {
      if (education) userData.education = education;
      if (experience) userData.experience = experience;
      if (application) userData.application = application;
    } else if (role === 'interviewer') {
      if (professional) userData.professional = professional;
    }

    const created = await User.create(userData);

    const user = {
      id: created._id.toString(),
      email: created.email,
      name: created.name,
      role: created.role,
      createdAt: created.createdAt,
      isVerified: created.isVerified
    };

    logger.info(`New user registered: ${email}`);
    await sendVerificationEmail(email, verificationCode);

    res.status(201).json({
      message: 'User registered successfully. Please check your email for the verification code.',
      user
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    const userDoc = await User.findOne({ email });
    if (!userDoc) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValidPassword = await bcrypt.compare(password, userDoc.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = { id: userDoc._id.toString(), email: userDoc.email, name: userDoc.name, role: userDoc.role };
    logger.info(`User logged in: ${email}`);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const userDoc = await User.findById(decoded.userId).select('email name role createdAt');
    const user = userDoc ? { id: userDoc._id.toString(), email: userDoc.email, name: userDoc.name, role: userDoc.role, createdAt: userDoc.createdAt } : null;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Email verification route
router.post('/verify-email', async (req, res) => {
  try {
    const { error, value } = emailVerificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, code } = value;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.isVerified) {
      return res.status(400).json({ error: 'User already verified' });
    }
    if (!user.verificationCode || !user.verificationExpires) {
      return res.status(400).json({ error: 'No verification code found' });
    }
    if (user.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    if (new Date() > user.verificationExpires) {
      return res.status(400).json({ error: 'Verification code expired' });
    }
    user.isVerified = true;
    user.verificationCode = null;
    user.verificationExpires = null;
    await user.save();
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
