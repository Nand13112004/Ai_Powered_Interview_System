import cv2
import mediapipe as mp
from ultralytics import YOLO
import math, time, argparse, socketio, signal, sys

# -------------------------
# Mediapipe Face Mesh setup
# -------------------------
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(max_num_faces=5)
mp_drawing = mp.solutions.drawing_utils

# -------------------------
# YOLOv8 Object Detection setup
# -------------------------
yolo_model = YOLO('yolov8n.pt')
CHEATING_OBJECTS = ["cell phone", "book", "laptop", "tablet", "earphone", "headphones", "notes"]

# -------------------------
# Socket.IO Client Setup
# -------------------------
sio = socketio.Client(reconnection=True, reconnection_attempts=5)

@sio.event
def connect():
    print('✅ Connected to proctor server')

@sio.event
def disconnect():
    print('❎ Disconnected from proctor server')

def emit_event(event_type, meta=None):
    payload = {
        'sessionId': args.session_id,
        'type': event_type,
        'meta': meta or {},
        'at': time.time()
    }
    sio.emit('proctor_event', payload, namespace="/proctor")
    print(f"➡️ Emitted event: {event_type}, meta={meta}")

def get_head_pose(landmarks):
    nose, left_eye, right_eye = landmarks[1], landmarks[33], landmarks[263]
    dx, dy = right_eye.x - left_eye.x, right_eye.y - left_eye.y
    yaw = math.atan2(dy, dx) * 180 / math.pi
    return yaw

# -------------------------
# Signal handling
# -------------------------
def signal_handler(sig, frame):
    print('⚠️ Interrupt received, shutting down...')
    if sio.connected:
        sio.disconnect()
    if 'cap' in globals():
        cap.release()
    cv2.destroyAllWindows()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# -------------------------
# CLI arguments
# -------------------------
parser = argparse.ArgumentParser()
parser.add_argument('--session-id', required=True)
parser.add_argument('--server-url', required=True)
parser.add_argument('--strict', action='store_true')
args = parser.parse_args()

CHEATING_THRESHOLD = 5 if args.strict else 10

# -------------------------
# Connect to server
# -------------------------
try:
    sio.connect(args.server_url, namespaces=["/proctor"])
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# -------------------------
# Webcam loop
# -------------------------
cap = cv2.VideoCapture(0)
cheating_score = 0
warnings = {"faces":0, "looking_away":0, "objects":0, "no_face":0}

while True:
    ret, frame = cap.read()
    if not ret:
        break
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    h, w, _ = frame.shape

    # --- Face detection ---
    results = face_mesh.process(frame_rgb)
    num_faces = len(results.multi_face_landmarks) if results.multi_face_landmarks else 0

    if num_faces > 1:
        cheating_score += 2
        warnings["faces"] += 1
        cv2.putText(frame, "⚠️ Multiple faces!", (30,50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255),2)
        emit_event('multiple_faces_detected', {'count': num_faces})
    elif num_faces == 1:
        landmarks = results.multi_face_landmarks[0].landmark
        mp_drawing.draw_landmarks(frame, results.multi_face_landmarks[0], mp_face_mesh.FACEMESH_CONTOURS)
        yaw = get_head_pose(landmarks)
        if abs(yaw) > 25:
            cheating_score += 1
            warnings["looking_away"] += 1
            cv2.putText(frame, "⚠️ Looking away!", (30,50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255),2)
            emit_event('looking_away', {'yaw': yaw})
    else:
        cheating_score += 1
        warnings["no_face"] += 1
        cv2.putText(frame, "⚠️ Face not detected!", (30,50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255),2)
        emit_event('face_not_detected')

    # --- Object detection ---
    results_yolo = yolo_model(frame)
    for r in results_yolo:
        for box in r.boxes:
            cls, conf = int(box.cls[0]), float(box.conf[0])
            label = yolo_model.names[cls]
            if label in CHEATING_OBJECTS and conf > 0.3:
                cheating_score += 2
                warnings["objects"] += 1
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cv2.rectangle(frame, (x1,y1),(x2,y2),(0,0,255),2)
                cv2.putText(frame, f"Cheating: {label}", (x1,y1-10), cv2.FONT_HERSHEY_SIMPLEX,0.8,(0,0,255),2)
                emit_event('object_detected', {'label': label, 'confidence': conf})

    cv2.putText(frame, f"Score: {cheating_score}", (10,h-10), cv2.FONT_HERSHEY_SIMPLEX,1,(255,0,0),2)

    if cheating_score >= CHEATING_THRESHOLD:
        emit_event('session_flagged', {'score': cheating_score, 'warnings': warnings})
        emit_event('interview_terminated', {'reason': 'cheating_detected', 'score': cheating_score, 'warnings': warnings})
        print(f"🚨 CHEATING DETECTED! Score: {cheating_score}, Threshold: {CHEATING_THRESHOLD}")
        print("🛑 Interview terminated due to cheating detection")
        break

    # Remove cv2.imshow to prevent face detection window from opening
    # cv2.imshow("Cheating Detection", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Clean shutdown
if sio.connected:
    sio.disconnect()
cap.release()
cv2.destroyAllWindows()

