import cv2
import mediapipe as mp
from ultralytics import YOLO
import math
import time
import argparse
import socketio
import json
import signal
import sys

# -------------------------
# Mediapipe Face Mesh setup
# -------------------------
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(max_num_faces=1)
mp_drawing = mp.solutions.drawing_utils

# -------------------------
# YOLOv8 Object Detection setup
# -------------------------
yolo_model = YOLO('yolov8n.pt')  # small model, detects phones, can customize

# -------------------------
# Helper functions
# -------------------------
def get_head_pose(landmarks, frame_shape):
    # 3 points: nose tip, left eye corner, right eye corner
    # Using simple vector to approximate head direction
    h, w = frame_shape
    nose = landmarks[1]
    left_eye = landmarks[33]
    right_eye = landmarks[263]

    # Normalize
    nx, ny = nose.x, nose.y
    lx, ly = left_eye.x, left_eye.y
    rx, ry = right_eye.x, right_eye.y

    # Head orientation estimation
    dx = rx - lx
    dy = ry - ly
    yaw = math.atan2(dy, dx) * 180 / math.pi
    return yaw  # positive = right tilt, negative = left tilt

# -------------------------
# Socket.IO Client Setup
# -------------------------
sio = socketio.Client()

@sio.event
def connect():
    print('Connected to proctor server')

@sio.event
def disconnect():
    print('Disconnected from proctor server')
    # Attempt to reconnect after 5 seconds
    time.sleep(5)
    try:
        sio.connect(args.server_url + '/proctor')
        print('Reconnected to proctor server')
    except Exception as e:
        print(f'Reconnect failed: {e}')

def connect_proctor(session_id, server_url):
    sio.connect(server_url + '/proctor')
    print(f"Connecting to proctor server: {server_url}")

def disconnect_proctor():
    sio.disconnect()
    print("Disconnected from proctor server")

def emit_proctor_event(event_type, meta=None):
    if meta is None:
        meta = {}
    payload = {
        'sessionId': args.session_id,
        'type': event_type,
        'meta': json.dumps(meta),
        'at': time.time()
    }
    sio.emit('proctor_event', payload)
    print(f"Emitted proctor event: {event_type}, meta: {meta}")

# Graceful shutdown
def signal_handler(sig, frame):
    print('Interrupt received, shutting down...')
    disconnect_proctor()
    if 'cap' in globals():
        cap.release()
    cv2.destroyAllWindows()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# Parse arguments
parser = argparse.ArgumentParser(description='Cheating Detection Proctor')
parser.add_argument('--session-id', required=True, help='Session ID for proctoring')
parser.add_argument('--server-url', required=True, help='Server URL for Socket.IO (e.g., http://localhost:5000)')
parser.add_argument('--test', action='store_true', help='Run in test mode: connect, emit test event, disconnect')
args = parser.parse_args()

# Connect to server
connect_proctor(args.session_id, args.server_url)

if args.test:
    emit_proctor_event('test_connection')
    time.sleep(1)
    disconnect_proctor()
    sys.exit(0)

# -------------------------
# Webcam capture
# -------------------------
cap = cv2.VideoCapture(0)
cheating_score = 0
alert_display_time = 2  # seconds
last_alert_time = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    h, w, _ = frame.shape

    # -------------------------
    # Face landmarks detection
    # -------------------------
    results = face_mesh.process(frame_rgb)
    if results.multi_face_landmarks:
        landmarks = results.multi_face_landmarks[0].landmark
        mp_drawing.draw_landmarks(frame, results.multi_face_landmarks[0], mp_face_mesh.FACEMESH_CONTOURS)

        head_yaw = get_head_pose(landmarks, (h, w))
        if abs(head_yaw) > 25:  # looking away threshold
            if time.time() - last_alert_time > alert_display_time:
                cheating_score += 1
                cv2.putText(frame, "WARNING: Looking away!", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)
                emit_proctor_event('looking_away', {'yaw_angle': head_yaw})
                last_alert_time = time.time()
    else:
        # Face not detected
        if time.time() - last_alert_time > alert_display_time:
            cheating_score += 1
            cv2.putText(frame, "WARNING: Face not detected!", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)
            emit_proctor_event('face_not_detected')
            last_alert_time = time.time()

    # -------------------------
    # Object detection (phone/book)
    # -------------------------
    results_yolo = yolo_model(frame)
    for r in results_yolo:
        boxes = r.boxes
        for box in boxes:
            cls = int(box.cls[0])
            conf = box.conf[0]
            label = yolo_model.names[cls]
            if label in ["cell phone", "book"] and conf > 0.5:
                cheating_score += 1
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0,0,255), 2)
                cv2.putText(frame, f"Cheating Object: {label}", (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)
                emit_proctor_event('object_detected', {'label': label, 'confidence': float(conf)})

    # Display score
    cv2.putText(frame, f"Cheating Score: {cheating_score}", (10, h-10), cv2.FONT_HERSHEY_SIMPLEX, 1, (255,0,0), 2)
    cv2.imshow("Cheating Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

disconnect_proctor()
cap.release()
cv2.destroyAllWindows()
