const express = require("express");
const Joi = require("joi");
const { logger } = require("../utils/logger");
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Response = require('../models/Response');

const router = express.Router();

// Using Mongoose models, no Prisma



// Validation schema
const createInterviewSchema = Joi.object({
  title: Joi.string().min(3).required(),
  description: Joi.string().optional(),
  role: Joi.string().required(),
  level: Joi.string().valid("junior", "mid", "senior").required(),
  duration: Joi.number().min(1).max(120).required(),
  questions: Joi.array().items(Joi.string()).min(1).required(),
  password: Joi.string().min(4).max(32).required(), // interviewer sets password
  // Scheduling fields - explicitly allow these
  isScheduled: Joi.boolean().optional(),
  scheduledStartTime: Joi.date().allow(null).optional(),
  scheduledEndTime: Joi.date().allow(null).optional(),
  timeZone: Joi.string().optional(),
  requiresSchedule: Joi.boolean().optional(),
  allowMultipleAttempts: Joi.boolean().optional()
}).unknown(true); // Allow unknown fields

// ✅ Get all interviews
router.get("/", async (req, res) => {
  try {
    let whereClause = { isActive: true };

    // If user is not a candidate, only show their own interviews
    if (req.user.role !== "candidate") {
      whereClause.userId = req.user.id;
    }

    const interviews = await Interview.find(whereClause)
      .select('title description role level duration createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const mapped = interviews.map(d => ({
      id: d._id.toString(),
      title: d.title,
      description: d.description,
      role: d.role,
      level: d.level,
      duration: d.duration,
      createdAt: d.createdAt,
    }));

    res.json({ interviews: mapped });
  } catch (error) {
    logger.error("Error fetching interviews:", error);
    res.status(500).json({ error: "Failed to fetch interviews" });
  }
});

// ✅ Get interview by ID (with questions)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const interviewDoc = await Interview.findById(id).lean();
    if (!interviewDoc) {
      return res.status(404).json({ error: "Interview not found" });
    }
    const questions = await Question.find({ interviewId: id, isActive: true }).sort({ number: 1 }).lean();
    const interview = {
      id: interviewDoc._id.toString(),
      title: interviewDoc.title,
      description: interviewDoc.description,
      role: interviewDoc.role,
      level: interviewDoc.level,
      duration: interviewDoc.duration,
      rubric: interviewDoc.rubric || {},
      createdAt: interviewDoc.createdAt,
      questions: questions.map(q => ({
        id: q._id.toString(),
        text: q.text,
        type: q.type,
        category: q.category,
        difficulty: q.difficulty,
        number: q.number
      }))
    };

    res.json({ interview });
  } catch (error) {
    logger.error("Error fetching interview:", error);
    res.status(500).json({ error: "Failed to fetch interview" });
  }
});

// ✅ Get responses for an interview (interviewer/admin only)
router.get('/:id/responses', async (req, res) => {
  try {
    if (req.user.role === 'candidate') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const responsesRaw = await Response.find({ interviewId: id }).sort({ createdAt: 1 }).lean();
    
    // Get user and question information
    const userIds = [...new Set(responsesRaw.map(r => r.userId))];
    const questionIds = [...new Set(responsesRaw.map(r => r.questionId))];
    
    const User = require('../models/User');
    const Question = require('../models/Question');
    
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const questions = await Question.find({ _id: { $in: questionIds } }).lean();
    
    const userMap = new Map(users.map(u => [u._id.toString(), u]));
    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));
    
    const responses = responsesRaw.map(r => ({
      id: r._id.toString(),
      userId: r.userId,
      interviewId: r.interviewId,
      sessionId: r.sessionId,
      questionId: r.questionId,
      text: r.text,
      audioData: r.audioData ? r.audioData.toString('base64') : null,
      createdAt: r.createdAt,
      user: userMap.get(r.userId),
      question: questionMap.get(r.questionId)
    }));
    res.json({ responses });
  } catch (error) {
    logger.error('Error fetching responses:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// ✅ Create new interview
router.post("/", async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "interviewer") {
      return res
        .status(403)
        .json({ error: "Admin or interviewer access required" });
    }


    // Debug: Log the request body
    console.log('Received interview creation request:', JSON.stringify(req.body, null, 2));
    
    const { error, value } = createInterviewSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { title, description, role, level, duration, questions, password, isScheduled, scheduledStartTime, scheduledEndTime, timeZone, requiresSchedule, allowMultipleAttempts } = value;

    // Generate random code: A-Z, a-z, 0-9, length 8
    function generateRandomCode(length = 8) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let code = '';
      for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    }
    let code;
    let isUnique = false;
    while (!isUnique) {
      code = generateRandomCode();
      const existing = await Interview.findOne({ code }).lean();
      if (!existing) isUnique = true;
    }

    const createdInterview = await Interview.create({
      title,
      description,
      role,
      level,
      duration,
      rubric: {},
      userId: req.user.id,
      code,
      password,
      // Scheduling fields
      isScheduled: isScheduled || false,
      scheduledStartTime: scheduledStartTime || null,
      scheduledEndTime: scheduledEndTime || null,
      timeZone: timeZone || 'UTC',
      requiresSchedule: requiresSchedule || false,
      allowMultipleAttempts: allowMultipleAttempts || false,
    });
    const questionDocs = await Question.insertMany(questions.map((q, i) => ({
      text: q,
      type: 'technical',
      category: 'general',
      difficulty: level,
      number: i + 1,
      interviewId: createdInterview._id.toString(),
    })));
    const interview = {
      id: createdInterview._id.toString(),
      title: createdInterview.title,
      description: createdInterview.description,
      role: createdInterview.role,
      level: createdInterview.level,
      duration: createdInterview.duration,
      rubric: createdInterview.rubric,
      code: createdInterview.code,
      password: createdInterview.password,
      createdAt: createdInterview.createdAt,
      questions: questionDocs.map(q => ({
        id: q._id.toString(),
        text: q.text,
        type: q.type,
        category: q.category,
        difficulty: q.difficulty,
        number: q.number,
      })),
    };

    logger.info(`New interview created: ${title} by ${req.user.email}`);

    res.status(201).json({
      message: "Interview created successfully",
      interview,
    });
  } catch (error) {
    logger.error("Error creating interview:", error);
    console.error("Error creating interview:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to create interview" });
  }
});

// ✅ Update interview (admin only)
router.put("/:id", async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const { error, value } = createInterviewSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { title, description, role, level, duration, questions } =
      value;

    await Interview.findByIdAndUpdate(id, { title, description, role, level, duration });

    await Question.deleteMany({ interviewId: id });
    await Question.insertMany(questions.map((q, i) => ({
      text: q,
      type: 'technical',
      category: 'general',
      difficulty: level,
      number: i + 1,
      interviewId: id,
    })));

    logger.info(`Interview updated: ${id} by ${req.user.email}`);

    res.json({
      message: "Interview updated successfully",
      interviewId: id,
    });
  } catch (error) {
    logger.error("Error updating interview:", error);
    res.status(500).json({ error: "Failed to update interview" });
  }
});

// ✅ Delete interview (admin only → soft delete)
router.delete("/:id", async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;

    await Interview.findByIdAndUpdate(id, { isActive: false });

    logger.info(`Interview deactivated: ${id} by ${req.user.email}`);

    res.json({ message: "Interview deleted successfully" });
  } catch (error) {
    logger.error("Error deleting interview:", error);
    res.status(500).json({ error: "Failed to delete interview" });
  }
});

// ✅ Candidate join by code and password
router.post("/join-by-code", async (req, res) => {
  try {
    const { code, password } = req.body;
    if (!code || !password) {
      return res.status(400).json({ error: "Code and password are required" });
    }

    // Find interview by code
    const interview = await Interview.findOne({ code }).lean();
    if (!interview) {
      return res.status(404).json({ error: "Invalid code" });
    }
    if (interview.password !== password) {
      return res.status(401).json({ error: "Invalid password" });
    }
    if (!interview.isActive) {
      return res.status(403).json({ error: "Interview is not active" });
    }

    // Optionally, create a session for the candidate here
    // const session = await prisma.session.create({ ... })

    res.json({ message: "Joined interview successfully", interviewId: interview._id.toString() });
  } catch (error) {
    logger.error("Error joining interview by code:", error);
    res.status(500).json({ error: "Failed to join interview" });
  }
});

// Get interview by code (public access for verification)
router.get("/by-code/:code", async (req, res) => {
  try {
    const { code } = req.params;
    
    const interview = await Interview.findOne({ code }).lean();
    
    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

    // Return basic interview info for verification
    res.json({
      id: interview._id.toString(),
      title: interview.title,
      code: interview.code,
      duration: interview.duration,
      scheduledStartTime: interview.scheduledStartTime,
      scheduledEndTime: interview.scheduledEndTime,
      isScheduled: interview.isScheduled,
      requiresSchedule: interview.requiresSchedule,
      allowLateJoin: interview.allowLateJoin || false,
      isActive: interview.isActive
    });

  } catch (error) {
    logger.error("Error fetching interview by code:", error);
    res.status(500).json({ error: "Failed to fetch interview" });
  }
});

module.exports = router;
