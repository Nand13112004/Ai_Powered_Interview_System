const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { logger } = require('../utils/logger');
const { sendVerificationEmail } = require('../utils/mailer');
const User = require('../models/User');

const router = express.Router();

// Using Mongoose models, no Prisma

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).required(),
  role: Joi.string().valid('candidate', 'interviewer', 'admin').default('candidate')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, name, role } = value;

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

    // Create user with verification fields
    const created = await User.create({
      email,
      password: hashedPassword,
      name,
      role,
      isVerified: false,
      verificationCode,
      verificationExpires
    });

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
      process.env.JWT_SECRET || 'my_super_secret',
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
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
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }
  try {
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
