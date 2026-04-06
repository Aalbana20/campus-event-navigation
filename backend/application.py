from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os


app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])

# JWT config
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-before-deploy")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 60 * 60 * 24 * 7  # 7 days
jwt = JWTManager(app)

# Resolve DB path relative to this file
DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")

# DATABASE SETUP

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

# Users table for sql database
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        username TEXT,
        password TEXT,
        role TEXT DEFAULT 'user'
    )
    """)

# Events table for sql database
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        event_date TEXT,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id)
    )
    """)
    conn.commit()
    conn.close()

init_db()

# SIGNUP

@app.route("/signup", methods=["POST"])
def signup():
    data = request.json

    email = data.get("email")
    username = data.get("username")
    password = data.get("password")

    if not email or not username or not password:
        return jsonify({"error": "All fields required"}), 400

    hashed_password = generate_password_hash(password)

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO users (email, username, password) VALUES (?, ?, ?)",
            (email, username, hashed_password)
        )

        conn.commit()
        conn.close()

        return jsonify({"message": "Account created"}), 201

    except sqlite3.IntegrityError:
        return jsonify({"error": "User already exists"}), 400


# LOGIN

@app.route("/login", methods=["POST"])
def login():
    data = request.json

    email = data.get("email")
    password = data.get("password")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, username, password, role FROM users WHERE email=?",
        (email,)
    )

    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    user_id, username, stored_password, role = user

    if not check_password_hash(stored_password, password):
        return jsonify({"error": "Incorrect password"}), 401

    token = create_access_token(identity={"id": user_id, "username": username, "role": role})

    return jsonify({
        "message": "Login successful",
        "token": token,
        "username": username,
        "role": role
    })


# MAKE ADMIN (need for event creation testing)

@app.route("/make_admin", methods=["POST"])
@jwt_required()
def make_admin():
    current_user = get_jwt_identity()
    if current_user.get("role") != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json
    email = data.get("email")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE users SET role='admin' WHERE email=?",
        (email,)
    )

    conn.commit()
    conn.close()

    return jsonify({"message": "User promoted to admin"})


# ----------------------

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true")
