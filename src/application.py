from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3


app = Flask()
CORS(app)

# DATABASE SETUP

def init_db():
    conn = sqlite3.connect("users.db")
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

    try:
        conn = sqlite3.connect("users.db")
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO users (email, username, password) VALUES (?, ?, ?)",
            (email, username, password)
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

    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()

    cursor.execute(
        "SELECT username, password, role FROM users WHERE email=?",
        (email,)
    )

    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    username, stored_password, role = user

    if password != stored_password:
        return jsonify({"error": "Incorrect password"}), 401

    return jsonify({
        "message": "Login successful",
        "username": username,
        "role": role
    })


# MAKE ADMIN (  need for event creation testing)

@app.route("/make_admin", methods=["POST"])
def make_admin():
    data = request.json
    email = data.get("email")

    conn = sqlite3.connect("users.db")
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
    app.run(debug=True)



