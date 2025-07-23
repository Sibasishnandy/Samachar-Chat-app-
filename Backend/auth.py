from flask import Flask, jsonify, request
from pymongo import MongoClient
from flask_cors import CORS
import bcrypt
import cloudinary
import cloudinary.uploader
from flask_socketio import SocketIO, emit
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
import eventlet

load_dotenv()

# Cloudinary config
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

# Flask setup
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# MongoDB setup
MONGODB_URI = os.environ.get("MONGO_URI")
client = MongoClient(MONGODB_URI)
db = client["Samachar"]
registration_samachar = db["registration_samachar"]
messages_samachar = db["messages_samachar"]

# Online user tracking
online_users = {}

# Password utils
def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed)

# ============ API Routes ============ #

@app.route('/registration_api', methods=['POST'])
def registration_samachar_function():
    full_name = request.form.get("full_name")
    email = request.form.get("email")
    password = request.form.get("password")
    confirm_password = request.form.get("confirm_password")
    profile_pic = request.files.get("profile_pic")

    if registration_samachar.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 409

    if password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400

    hashed_pwd = hash_password(password)
    upload_result = cloudinary.uploader.upload(profile_pic)
    image_url = upload_result.get("secure_url")

    user = {
        "full_name": full_name,
        "email": email,
        "password": hashed_pwd,
        "profile_pic": image_url
    }

    result = registration_samachar.insert_one(user)
    return jsonify({
        "message": "User registered successfully",
        "user_id": str(result.inserted_id),
        "profile_pic": image_url
    }), 201

@app.route('/login_api', methods=['POST'])
def login_samachar_function():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    user = registration_samachar.find_one({"email": email})
    if not user or not check_password(password, user["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({
        "message": "Login successful",
        "full_name": user["full_name"],
        "email": user["email"],
        "profile_pic": user["profile_pic"]
    }), 200

@app.route('/getallusers_api', methods=['GET'])
def get_all_users():
    users = registration_samachar.find({}, {"_id": 0, "full_name": 1, "email": 1, "profile_pic": 1})
    return jsonify(list(users)), 200

@app.route('/unread_count/<email>', methods=['GET'])
def get_unread_counts(email):
    pipeline = [
        {"$match": {"receiver": email, "is_read": False}},
        {"$group": {"_id": "$sender", "count": {"$sum": 1}}}
    ]
    counts = list(messages_samachar.aggregate(pipeline))
    return jsonify(counts), 200

@app.route('/get_messages/<sender>/<receiver>', methods=['GET'])
def get_messages(sender, receiver):
    messages_samachar.update_many(
        {"sender": receiver, "receiver": sender, "is_read": False},
        {"$set": {"is_read": True}}
    )

    chats = list(messages_samachar.find({
        "$or": [
            {"sender": sender, "receiver": receiver},
            {"sender": receiver, "receiver": sender}
        ]
    }).sort("timestamp", 1))

    for msg in chats:
        msg['_id'] = str(msg['_id'])
    return jsonify(chats), 200

# ============ Socket Events ============ #

@socketio.on('user_connected')
def handle_user_connected(email):
    online_users[email] = request.sid
    emit("update_online_users", list(online_users.keys()), broadcast=True)

    unseen_msgs = list(messages_samachar.find({
        "receiver": email,
        "is_read": False
    }))

    for msg in unseen_msgs:
        emit("receive_message", {
            "sender": msg["sender"],
            "receiver": msg["receiver"],
            "text": msg["text"],
            "timestamp": msg["timestamp"]
        }, to=request.sid)

@socketio.on('send_message')
def handle_send_message(data):
    message = {
        "sender": data["sender"],
        "receiver": data["receiver"],
        "text": data["text"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_read": False
    }
    messages_samachar.insert_one(message)

    receiver_sid = online_users.get(data["receiver"])
    if receiver_sid:
        emit('receive_message', message, to=receiver_sid)

    sender_sid = online_users.get(data["sender"])
    if sender_sid:
        emit('receive_message', message, to=sender_sid)

@socketio.on('disconnect')
def handle_disconnect():
    disconnected_user = None
    for email, sid in list(online_users.items()):
        if sid == request.sid:
            disconnected_user = email
            break
    if disconnected_user:
        del online_users[disconnected_user]
        emit('update_online_users', list(online_users.keys()), broadcast=True)

# ============ Main for Render ============ #

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))  # Use Render-provided PORT or 5000 for local dev
    socketio.run(app, host="0.0.0.0", port=port)
