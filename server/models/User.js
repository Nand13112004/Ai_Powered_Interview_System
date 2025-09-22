const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: String,
  name: String,
  role: { type: String, default: 'candidate' },
  isVerified: { type: Boolean, default: false },
  verificationCode: String,
  verificationExpires: Date,

  // Personal Information (common for both roles)
  phone: String,
  profilePhoto: String,

  // Candidate-specific fields
  education: {
    college: String,
    degree: String,
    branch: String,
    graduationYear: String,
    gpa: String
  },

  // Professional/Work Experience (candidate)
  experience: {
    organization: String,
    jobTitle: String,
    totalExperience: String,
    skills: [String]
  },

  // Application Specific (candidate)
  application: {
    resume: String,
    coverLetter: String,
    areasOfInterest: [String],
    links: {
      linkedin: String,
      github: String,
      portfolio: String
    }
  },

  // Interviewer-specific fields
  professional: {
    companyName: String,
    department: String,
    jobTitle: String,
    experienceYears: String
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
