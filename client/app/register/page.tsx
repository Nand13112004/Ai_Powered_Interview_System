
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'react-hot-toast'
import { Brain, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [role, setRole] = useState<'candidate' | 'interviewer' | ''>('')
  const [currentStep, setCurrentStep] = useState<number>(0) // 0 = role selection

  // Candidate state (A-D)
  const [candidatePersonal, setCandidatePersonal] = useState({
    name: '',
    email: '',
    phone: '',
    profilePhoto: '' as string | File | null,
    password: '',
    confirmPassword: ''
  })
  const [candidateEducation, setCandidateEducation] = useState({
    college: '',
    degree: '',
    branch: '',
    graduationYear: '',
    gpa: ''
  })
  const [candidateExperience, setCandidateExperience] = useState({
    organization: '',
    title: '',
    totalExperience: '',
    skills: ''
  })
  const [candidateApplication, setCandidateApplication] = useState({
    resume: null as File | null,
    coverLetter: '',
    interests: '',
    linkedin: '',
    github: '',
    portfolio: ''
  })

  // Interviewer state (A-B)
  const [interviewerPersonal, setInterviewerPersonal] = useState({
    name: '',
    email: '',
    phone: '',
    profilePhoto: '' as string | File | null,
    password: '',
    confirmPassword: ''
  })
  const [interviewerProfessional, setInterviewerProfessional] = useState({
    company: '',
    department: '',
    title: '',
    experienceYears: ''
  })

  // Email verification placeholders (kept for future integration)
  const [showVerify, setShowVerify] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const totalSteps = role === 'candidate' ? 4 : role === 'interviewer' ? 2 : 0

  const goNext = () => {
    if (role === '') {
      toast.error('Please select a role to continue')
      return
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    // Final validation before submit
    if (role === 'candidate') {
      if (!candidateApplication.resume || !candidateApplication.interests || !candidateApplication.linkedin || !candidateApplication.github || !candidateApplication.portfolio) {
        toast.error('Please fill all required fields')
        return
      }
      if (!candidatePersonal.password || candidatePersonal.password !== candidatePersonal.confirmPassword) {
        toast.error('Passwords must match')
        return
      }
    }
    if (role === 'interviewer') {
      if (!interviewerProfessional.company || !interviewerProfessional.department || !interviewerProfessional.title || !interviewerProfessional.experienceYears) {
        toast.error('Please fill all required fields')
        return
      }
      if (!interviewerPersonal.password || interviewerPersonal.password !== interviewerPersonal.confirmPassword) {
        toast.error('Passwords must match')
        return
      }
    }
    setSubmitting(true)
    try {
      // Register account to trigger verification email
      const registerPayload = role === 'candidate'
        ? { name: candidatePersonal.name, email: candidatePersonal.email, password: candidatePersonal.password, role }
        : { name: interviewerPersonal.name, email: interviewerPersonal.email, password: interviewerPersonal.password, role }
      await api.post('/auth/register', registerPayload)
      setShowVerify(true)
      toast.success('Registration successful! Check your email for the verification code.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Step-level validation
  const isCandidateStepValid = (step: number): boolean => {
    if (step === 1) {
      return Boolean(
        candidatePersonal.name &&
        candidatePersonal.email &&
        candidatePersonal.phone &&
        candidatePersonal.profilePhoto &&
        candidatePersonal.password &&
        candidatePersonal.confirmPassword &&
        candidatePersonal.password === candidatePersonal.confirmPassword
      )
    }
    if (step === 2) {
      return Boolean(
        candidateEducation.college &&
        candidateEducation.degree &&
        candidateEducation.branch &&
        candidateEducation.graduationYear
      )
    }
    if (step === 3) {
      // Optional step
      return true
    }
    if (step === 4) {
      return Boolean(
        candidateApplication.resume &&
        candidateApplication.interests &&
        candidateApplication.linkedin &&
        candidateApplication.github &&
        candidateApplication.portfolio
      )
    }
    return false
  }

  const isInterviewerStepValid = (step: number): boolean => {
    if (step === 1) {
      return Boolean(
        interviewerPersonal.name &&
        interviewerPersonal.email &&
        interviewerPersonal.phone &&
        interviewerPersonal.profilePhoto &&
        interviewerPersonal.password &&
        interviewerPersonal.confirmPassword &&
        interviewerPersonal.password === interviewerPersonal.confirmPassword
      )
    }
    if (step === 2) {
      return Boolean(
        interviewerProfessional.company &&
        interviewerProfessional.department &&
        interviewerProfessional.title &&
        interviewerProfessional.experienceYears
      )
    }
    return false
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyLoading(true)
    try {
      await api.post('/auth/verify-email', { email: (role === 'candidate' ? candidatePersonal.email : interviewerPersonal.email), code: verifyCode })
      toast.success('Email verified! You can now log in.')
      router.push('/login')
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message)
    } finally {
      setVerifyLoading(false)
    }
  }

  if (showVerify) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Brain className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">MockMate AI</h1>
            </div>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle>Verify Your Email</CardTitle>
              <CardDescription>
                We've sent a verification code to {role === 'candidate' ? candidatePersonal.email : interviewerPersonal.email}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verify-code">Verification Code</Label>
                  <Input
                    id="verify-code"
                    type="text"
                    placeholder="Enter verification code"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={verifyLoading}>
                  {verifyLoading ? 'Verifying...' : 'Verify Email'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Brain className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">MockMate AI</h1>
          </div>
        </div>

        {/* Multi-step Registration */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Register</CardTitle>
            <CardDescription>
              Select your role and complete the steps
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 0: Role Selection */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Select Role</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose Candidate or Interviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="candidate">Candidate</SelectItem>
                      <SelectItem value="interviewer">Interviewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={goNext}>
                  Continue
                </Button>
              </div>
            )}

            {/* Candidate Steps A-D */}
            {role === 'candidate' && currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">A. Personal Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="cand-name">Full Name</Label>
                  <Input id="cand-name" value={candidatePersonal.name} onChange={(e) => setCandidatePersonal({ ...candidatePersonal, name: e.target.value })} placeholder="Enter your full name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-email">Email ID</Label>
                  <Input id="cand-email" type="email" value={candidatePersonal.email} onChange={(e) => setCandidatePersonal({ ...candidatePersonal, email: e.target.value })} placeholder="Enter your email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-phone">Phone Number</Label>
                  <Input id="cand-phone" value={candidatePersonal.phone} onChange={(e) => setCandidatePersonal({ ...candidatePersonal, phone: e.target.value })} placeholder="Enter your phone number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-photo">Profile Photo</Label>
                  <Input id="cand-photo" type="file" accept="image/*" onChange={(e) => setCandidatePersonal({ ...candidatePersonal, profilePhoto: e.target.files?.[0] || null })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cand-pass">Password</Label>
                    <Input id="cand-pass" type="password" value={candidatePersonal.password} onChange={(e) => setCandidatePersonal({ ...candidatePersonal, password: e.target.value })} placeholder="Create a password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cand-cpass">Confirm Password</Label>
                    <Input id="cand-cpass" type="password" value={candidatePersonal.confirmPassword} onChange={(e) => setCandidatePersonal({ ...candidatePersonal, confirmPassword: e.target.value })} placeholder="Confirm password" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={goBack}>Back</Button>
                  <Button onClick={goNext} disabled={!isCandidateStepValid(1)}>Next</Button>
                </div>
              </div>
            )}

            {role === 'candidate' && currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">B. Education Details</h3>
                <div className="space-y-2">
                  <Label htmlFor="cand-college">College/University Name</Label>
                  <Input id="cand-college" value={candidateEducation.college} onChange={(e) => setCandidateEducation({ ...candidateEducation, college: e.target.value })} placeholder="e.g., ABC University" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-degree">Degree</Label>
                  <Input id="cand-degree" value={candidateEducation.degree} onChange={(e) => setCandidateEducation({ ...candidateEducation, degree: e.target.value })} placeholder="e.g., B.Tech, MBA" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-branch">Branch/Stream</Label>
                  <Input id="cand-branch" value={candidateEducation.branch} onChange={(e) => setCandidateEducation({ ...candidateEducation, branch: e.target.value })} placeholder="e.g., Computer Science" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-gradyear">Graduation Year</Label>
                  <Input id="cand-gradyear" value={candidateEducation.graduationYear} onChange={(e) => setCandidateEducation({ ...candidateEducation, graduationYear: e.target.value })} placeholder="e.g., 2025" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-gpa">GPA/Percentage (optional)</Label>
                  <Input id="cand-gpa" value={candidateEducation.gpa} onChange={(e) => setCandidateEducation({ ...candidateEducation, gpa: e.target.value })} placeholder="e.g., 8.5 CGPA" />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={goBack}>Back</Button>
                  <Button onClick={goNext} disabled={!isCandidateStepValid(2)}>Next</Button>
                </div>
              </div>
            )}

            {role === 'candidate' && currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">C. Professional / Work Experience (optional)</h3>
                <div className="space-y-2">
                  <Label htmlFor="cand-org">Current / Previous Organization</Label>
                  <Input id="cand-org" value={candidateExperience.organization} onChange={(e) => setCandidateExperience({ ...candidateExperience, organization: e.target.value })} placeholder="e.g., XYZ Pvt Ltd" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-title">Job Title / Role</Label>
                  <Input id="cand-title" value={candidateExperience.title} onChange={(e) => setCandidateExperience({ ...candidateExperience, title: e.target.value })} placeholder="e.g., Software Engineer" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-exp">Total Work Experience</Label>
                  <Input id="cand-exp" value={candidateExperience.totalExperience} onChange={(e) => setCandidateExperience({ ...candidateExperience, totalExperience: e.target.value })} placeholder="e.g., 2 years" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-skills">Skills / Technologies Known</Label>
                  <Input id="cand-skills" value={candidateExperience.skills} onChange={(e) => setCandidateExperience({ ...candidateExperience, skills: e.target.value })} placeholder="e.g., React, Node.js, SQL" />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={goBack}>Back</Button>
                  <Button onClick={goNext} disabled={!isCandidateStepValid(3)}>Next</Button>
                </div>
              </div>
            )}

            {role === 'candidate' && currentStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">D. Application Specific</h3>
                <div className="space-y-2">
                  <Label htmlFor="cand-resume">Resume/CV upload</Label>
                  <Input id="cand-resume" type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCandidateApplication({ ...candidateApplication, resume: e.target.files?.[0] || null })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-cover">Cover Letter (optional)</Label>
                  <Input id="cand-cover" value={candidateApplication.coverLetter} onChange={(e) => setCandidateApplication({ ...candidateApplication, coverLetter: e.target.value })} placeholder="Paste cover letter or notes" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cand-interests">Areas of interest / Preferred role</Label>
                  <Input id="cand-interests" value={candidateApplication.interests} onChange={(e) => setCandidateApplication({ ...candidateApplication, interests: e.target.value })} placeholder="e.g., Frontend, Data Science" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cand-linkedin">LinkedIn</Label>
                    <Input id="cand-linkedin" value={candidateApplication.linkedin} onChange={(e) => setCandidateApplication({ ...candidateApplication, linkedin: e.target.value })} placeholder="Profile URL" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cand-github">GitHub</Label>
                    <Input id="cand-github" value={candidateApplication.github} onChange={(e) => setCandidateApplication({ ...candidateApplication, github: e.target.value })} placeholder="Profile URL" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cand-portfolio">Portfolio</Label>
                    <Input id="cand-portfolio" value={candidateApplication.portfolio} onChange={(e) => setCandidateApplication({ ...candidateApplication, portfolio: e.target.value })} placeholder="Website URL" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={goBack}>Back</Button>
                  <Button onClick={handleSubmit} disabled={submitting || !isCandidateStepValid(4)}>{submitting ? 'Submitting...' : 'Submit'}</Button>
                </div>
              </div>
            )}

            {/* Interviewer Steps A-B */}
            {role === 'interviewer' && currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">A. Personal Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="int-name">Full Name</Label>
                  <Input id="int-name" value={interviewerPersonal.name} onChange={(e) => setInterviewerPersonal({ ...interviewerPersonal, name: e.target.value })} placeholder="Enter your full name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="int-email">Email ID</Label>
                  <Input id="int-email" type="email" value={interviewerPersonal.email} onChange={(e) => setInterviewerPersonal({ ...interviewerPersonal, email: e.target.value })} placeholder="Enter your email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="int-phone">Phone Number</Label>
                  <Input id="int-phone" value={interviewerPersonal.phone} onChange={(e) => setInterviewerPersonal({ ...interviewerPersonal, phone: e.target.value })} placeholder="Enter your phone number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="int-photo">Profile Photo</Label>
                  <Input id="int-photo" type="file" accept="image/*" onChange={(e) => setInterviewerPersonal({ ...interviewerPersonal, profilePhoto: e.target.files?.[0] || null })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="int-pass">Password</Label>
                    <Input id="int-pass" type="password" value={interviewerPersonal.password} onChange={(e) => setInterviewerPersonal({ ...interviewerPersonal, password: e.target.value })} placeholder="Create a password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="int-cpass">Confirm Password</Label>
                    <Input id="int-cpass" type="password" value={interviewerPersonal.confirmPassword} onChange={(e) => setInterviewerPersonal({ ...interviewerPersonal, confirmPassword: e.target.value })} placeholder="Confirm password" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={goBack}>Back</Button>
                  <Button onClick={goNext} disabled={!isInterviewerStepValid(1)}>Next</Button>
                </div>
              </div>
            )}

            {role === 'interviewer' && currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">B. Professional Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="int-company">Company Name</Label>
                  <Input id="int-company" value={interviewerProfessional.company} onChange={(e) => setInterviewerProfessional({ ...interviewerProfessional, company: e.target.value })} placeholder="e.g., ABC Corp" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="int-dept">Department / Team</Label>
                  <Input id="int-dept" value={interviewerProfessional.department} onChange={(e) => setInterviewerProfessional({ ...interviewerProfessional, department: e.target.value })} placeholder="e.g., Engineering" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="int-title">Job Title / Role</Label>
                  <Input id="int-title" value={interviewerProfessional.title} onChange={(e) => setInterviewerProfessional({ ...interviewerProfessional, title: e.target.value })} placeholder="e.g., Technical Lead" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="int-exp">Experience in years</Label>
                  <Input id="int-exp" value={interviewerProfessional.experienceYears} onChange={(e) => setInterviewerProfessional({ ...interviewerProfessional, experienceYears: e.target.value })} placeholder="e.g., 6" />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={goBack}>Back</Button>
                  <Button onClick={handleSubmit} disabled={submitting || !isInterviewerStepValid(2)}>{submitting ? 'Submitting...' : 'Submit'}</Button>
                </div>
              </div>
            )}

            {/* Footer link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
