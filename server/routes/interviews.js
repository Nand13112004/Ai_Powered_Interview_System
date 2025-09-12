const express = require("express");
const Joi = require("joi");
const { PrismaClient } = require("@prisma/client");
const { logger } = require("../utils/logger");

const router = express.Router();

// Initialize Prisma client with error handling
let prisma;
try {
  prisma = new PrismaClient();
} catch (error) {
  logger.error('Failed to initialize Prisma client in interviews routes:', error);
  prisma = null;
}

// Validation schema
const createInterviewSchema = Joi.object({
  title: Joi.string().min(3).required(),
  description: Joi.string().optional(),
  role: Joi.string().required(),
  level: Joi.string().valid("junior", "mid", "senior").required(),
  duration: Joi.number().min(15).max(120).required(),
  questions: Joi.array().items(Joi.string()).min(1).required(),
  rubric: Joi.object().required(),
});

// ✅ Get all interviews
router.get("/", async (req, res) => {
  try {
    let whereClause = { isActive: true };

    // If user is not a candidate, only show their own interviews
    if (req.user.role !== "candidate") {
      whereClause.userId = req.user.id;
    }

    const interviews = await prisma.interview.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        role: true,
        level: true,
        duration: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ interviews });
  } catch (error) {
    logger.error("Error fetching interviews:", error);
    res.status(500).json({ error: "Failed to fetch interviews" });
  }
});

// ✅ Get interview by ID (with questions)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const interview = await prisma.interview.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { number: "asc" },
        },
      },
    });

    if (!interview) {
      return res.status(404).json({ error: "Interview not found" });
    }

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

    const responsesRaw = await prisma.response.findMany({
      where: { interviewId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        question: { select: { id: true, text: true, number: true } },
        session: { select: { id: true } }
      }
    });
    const responses = responsesRaw.map(r => ({
      ...r,
      audioData: r.audioData ? Buffer.from(r.audioData).toString('base64') : null
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

    const { error, value } = createInterviewSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { title, description, role, level, duration, questions, rubric } =
      value;

    // ✅ Create interview and related questions
    const interview = await prisma.interview.create({
      data: {
        title,
        description,
        role,
        level,
        duration,
        rubric,
        userId: req.user.id,
        questions: {
          create: questions.map((q, i) => ({
            text: q,
            type: "technical", // default
            category: "general",
            difficulty: level,
            number: i + 1, // keep order
          })),
        },
      },
      include: { questions: true },
    });

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

    const { title, description, role, level, duration, questions, rubric } =
      value;

    // Update interview base fields
    await prisma.interview.update({
      where: { id },
      data: {
        title,
        description,
        role,
        level,
        duration,
        rubric,
      },
    });

    // Replace existing questions with new ones
    await prisma.question.deleteMany({
      where: { interviewId: id },
    });

    await prisma.question.createMany({
      data: questions.map((q, i) => ({
        text: q,
        type: "technical",
        category: "general",
        difficulty: level,
        number: i + 1,
        interviewId: id,
      })),
    });

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

    await prisma.interview.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info(`Interview deactivated: ${id} by ${req.user.email}`);

    res.json({ message: "Interview deleted successfully" });
  } catch (error) {
    logger.error("Error deleting interview:", error);
    res.status(500).json({ error: "Failed to delete interview" });
  }
});

module.exports = router;
