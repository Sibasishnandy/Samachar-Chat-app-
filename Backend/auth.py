from flask import Flask, jsonify, request  # flask microframework
from pymongo import MongoClient  # using for mongodb connection
from flask_cors import CORS  # cross platform integration frontend<----->backend
import bcrypt  # using for encryption and decryption of message
import cloudinary  # used for mainly uploading image purpose
import cloudinary.uploader
from cloudinary.utils import cloudinary_url
from flask_socketio import SocketIO, emit  # added for real-time communication
import datetime
import eventlet  # required for socketio
# eventlet.monkey_patch()  # patching for async operations

# configuring cloudinary (code copied from cloudinary tutorial website)
cloudinary.config(
    cloud_name="dselreycf",
    api_key="123755886523836",
    api_secret="ADLgppPThxqdCC5ifkrvrYaxPeo",
    secure=True
)

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")  # initializing socketio

# okay now i am going for mongodb connection
MONGODB_URI = "mongodb+srv://sibasishnandy:EkG8zHumLfR7Q1w3@sibasishmongocluster.nphnenz.mongodb.net/"
client = MongoClient(MONGODB_URI)

# connection done and now selecting or creating database
db = client["Samachar"]

# inside the Database:Samachar i will have multiple tables for this chatting app for registration purpose i am using registration_samachar
registration_samachar = db["registration_samachar"]
messages_samachar = db["messages_samachar"]

# in-memory dictionary to track online users
online_users = {}

# taking password as input and encoding it ex:12345(real) after encryption:@#$DFSBXXSES(encrypted)
def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

# during login i am checking password in db(hashed pw) and entered password for checking validity
def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed)


# =====================Registration======================#
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
        return jsonify({confirm_password: password}), 400

    # hashing of password
    hashed_pwd = hash_password(password)

    # uploading the image/pic in cloudinary website
    upload_result = cloudinary.uploader.upload(profile_pic)
    # getting the image url and adding it to db
    image_url = upload_result.get("secure_url")

    user = {
        "full_name": full_name,
        "email": email,
        "password": hashed_pwd,
        "profile_pic": image_url
    }

    # insertion in database
    result = registration_samachar.insert_one(user)
    return jsonify({
        "message": "User registered successfully",
        "user_id": str(result.inserted_id),
        "profile_pic": image_url
    }), 201


# ==================Login=====================#
@app.route('/login_api', methods=['POST'])
def login_samachar_function():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    # finding 1st if the person exists in database or not
    user = registration_samachar.find_one({"email": email})

    # user not found then return error message
    if not user:
        return jsonify({"error": "Invalid credentials"}), 404

    # Check password
    if not check_password(password, user["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({
        "message": "Login successful",
        "full_name": user["full_name"],
        "email": user["email"],
        "profile_pic": user["profile_pic"]
    }), 200


# ==========showing all the registered members in the app========#
@app.route('/getallusers_api', methods=['GET'])
def get_all_users():
    users = registration_samachar.find({}, {"_id": 0, "full_name": 1, "email": 1, "profile_pic": 1})
    user_list = list(users)
    return jsonify(user_list), 200

@app.route('/unread_count/<email>', methods=['GET'])
def get_unread_counts(email):
    pipeline = [
        {"$match": {"receiver": email, "is_read": False}},
        {"$group": {"_id": "$sender", "count": {"$sum": 1}}}
    ]
    counts = list(messages_samachar.aggregate(pipeline))
    return jsonify(counts), 200


# ===================Chat history==================== #
@app.route('/get_messages/<sender>/<receiver>', methods=['GET'])
def get_messages(sender, receiver):
    chats = list(messages_samachar.find({
        "$or": [
            {"sender": sender, "receiver": receiver},
            {"sender": receiver, "receiver": sender}
        ]
    }).sort("timestamp", 1))

    # Mark receiver's messages from sender as read
    messages_samachar.update_many(
        {"sender": receiver, "receiver": sender, "is_read": False},
        {"$set": {"is_read": True}}
    )

    for msg in chats:
        msg['_id'] = str(msg['_id'])
    return jsonify(chats), 200



# ===================Socket Events==================== #

@socketio.on('user_connected')
def handle_user_connected(email):
    print(f"User connected: {email}")
    online_users[email] = request.sid
    emit("update_online_users", list(online_users.keys()), broadcast=True)

    # Find unseen messages
    unseen_msgs = list(messages_samachar.find({
        "receiver": email
    }))

    print(f"Sending {len(unseen_msgs)} missed messages to {email}")

    for msg in unseen_msgs:
        emit("receive_message", {
            "sender": msg["sender"],
            "receiver": msg["receiver"],
            "text": msg["text"],
            "timestamp": msg["timestamp"]
        }, to=request.sid)


@socketio.on('send_message')
def handle_send_message(data):
    print("Message received on backend:", data)
    message = {
        "sender": data["sender"],
        "receiver": data["receiver"],
        "text": data["text"],
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "is_read": False  # NEW: Unread by default
    }
    messages_samachar.insert_one(message)

    # Emit to receiver if online
    receiver_sid = online_users.get(data["receiver"])
    if receiver_sid:
        emit('receive_message', message, to=receiver_sid)

    # Emit to sender for instant feedback
    sender_sid = online_users.get(data["sender"])
    if sender_sid:
        emit('receive_message', message, to=sender_sid)


@socketio.on('disconnect')
def handle_disconnect():
    disconnected_user = None
    for email, sid in online_users.copy().items():
        if sid == request.sid:
            disconnected_user = email
            break
    if disconnected_user:
        del online_users[disconnected_user]
        emit('update_online_users', list(online_users.keys()), broadcast=True)


# ===================Main Run==================== #
if __name__ == '__main__':
    socketio.run(app, debug=True,allow_unsafe_werkzeug=True)  # using socketio.run instead of app.run
