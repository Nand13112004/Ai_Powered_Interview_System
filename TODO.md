# Fix Interview Visibility for Candidates

## Problem
When interviewers create new interviews, they do not appear in the candidate dashboard because the GET /interviews route filters by userId, meaning candidates only see interviews they created themselves.

## Solution
Modify the GET /interviews route in server/routes/interviews.js to:
- For candidates: Return all active interviews
- For interviewers/admins: Return only their own active interviews

## Steps
1. ✅ Update server/routes/interviews.js GET route to check user role
2. ✅ Fix InterviewerDashboard.tsx to use proper API client instead of fetch
3. Test that candidates can see all interviews
4. Test that interviewers still see only their own interviews
