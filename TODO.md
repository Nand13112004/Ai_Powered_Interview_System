# Interview Flow Enhancements TODO

## Server-Side Enhancements
- [x] Update server/routes/sessions.js to enforce start time on session start and validate password
- [x] Ensure single attempt enforcement in session creation
- [x] Confirm scheduling enforcement in verify-entry endpoint

## Client-Side Enhancements
- [x] Enhance InterviewEntry.tsx to handle waiting room and password validation
- [x] Enhance InterviewRoom.tsx to enforce start time, show time remaining, and launch cheating detection
- [x] Confirm WaitingRoom.tsx countdown and auto redirect functionality

## Testing
- [ ] Test full flow end-to-end
- [ ] Verify password entry works
- [ ] Verify waiting room countdown
- [ ] Verify start time enforcement
- [ ] Verify cheating detection launch
- [ ] Verify media stream security
- [ ] Verify single attempt enforcement
