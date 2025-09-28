# Integration Plan for Python Cheating Detection

## Current Progress
- [x] Install dependencies: opencv-python, mediapipe, ultralytics (user handled)
- [x] Install python-socketio (completed)

## Steps to Complete

1. **Modify cheating_detection.py**
   - Add command-line argument parsing for sessionId and server URL (using argparse).
   - Integrate Socket.IO client to connect to the backend server.
   - Emit 'proctor_event' for detected incidents: 'face_not_detected', 'looking_away', 'object_detected' with metadata (e.g., timestamp, confidence).
   - Tune thresholds: head yaw > 25 degrees, object conf > 0.5.
   - Ensure the script runs continuously until interrupted (e.g., Ctrl+C).

2. **Update client/components/InterviewRoom.tsx**
   - [x] When 'interview_joined' event is received, prompt or automatically download/start the Python script.
   - [x] Pass sessionId and server URL (e.g., window.location.origin) as arguments.
   - [x] Use child_process or similar to spawn the Python process (but since it's client-side, suggest download and manual run, or use WebAssembly fallback).
   - [x] Add fallback: If Python not detected, use browser-based proctoring (existing face detection via FaceDetector/TensorFlow.js).

3. **Test Integration Locally**
- [x] Run the modified Python script with sample sessionId and server URL.
- [x] Verify events are received in server/socket/handlers.js (proctor_event).
- [x] Check ProctorEvent model in DB for logged events.
- [x] Simulate detections (e.g., look away, show phone) and confirm emissions.

4. **Handle Edge Cases**
- [x] Graceful shutdown: Emit disconnect event on script exit.
- [x] Error handling: Reconnect on Socket.IO disconnect.
- [x] Fallback for no Python: Enhance browser proctoring in InterviewRoom.tsx (e.g., integrate MediaPipe via JS if possible).
- [x] Security: Validate sessionId on backend for proctor events.

5. **Documentation and Next Steps**
   - Update README.md with setup instructions for candidates.
   - Tune thresholds based on testing.
   - Consider deploying Python script as a downloadable executable for easier distribution.

Update this file as steps are completed.
