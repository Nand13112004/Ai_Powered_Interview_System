# Fix 400 Bad Request on Interview Creation

## Completed Tasks
- [x] Analyzed the error: Missing required fields (questions and rubric) in POST request
- [x] Updated frontend form to include questions input (dynamic list)
- [x] Updated frontend form to include rubric input (JSON textarea)
- [x] Updated handleSubmit to validate and send required fields
- [x] Fixed level input to use select dropdown with valid options (junior, mid, senior)
- [x] Fixed server to include userId when creating interviews

## Next Steps
- [ ] Start the server: `cd server && npm start`
- [ ] Start the client: `cd client && npm run dev`
- [ ] Navigate to the create interview page
- [ ] Fill out the form including at least one question and valid JSON rubric
- [ ] Submit the form and verify no 400 error occurs
- [ ] Check that the interview is created successfully
