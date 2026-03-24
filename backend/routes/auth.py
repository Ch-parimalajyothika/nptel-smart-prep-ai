"""
routes/auth.py — Authentication endpoints
GET  /api/auth/me      → return current user info
POST /api/auth/signup  → register new user
POST /api/auth/login   → authenticate and return JWT
"""

import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from database import get_db, dict_from_row

auth_bp = Blueprint("auth", __name__)


# ─── Helper: hash a password ──────────────────────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ─── POST /api/auth/signup ────────────────────────────
@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    name     = (data.get("name")     or "").strip()
    email    = (data.get("email")    or "").strip().lower()
    password = (data.get("password") or "").strip()

    # Basic validation
    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if "@" not in email:
        return jsonify({"error": "Invalid email address."}), 400

    conn = get_db()
    try:
        # Check for duplicate email
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            return jsonify({"error": "An account with this email already exists."}), 409

        hashed = hash_password(password)
        cursor = conn.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (name, email, hashed)
        )
        conn.commit()
        user_id = cursor.lastrowid

        # Issue JWT
        token = create_access_token(identity=str(user_id))
        return jsonify({
            "token": token,
            "user":  {"id": user_id, "name": name, "email": email}
        }), 201
    finally:
        conn.close()


# ─── POST /api/auth/login ─────────────────────────────
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email    = (data.get("email")    or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    conn = get_db()
    try:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not user or not check_password(password, user["password"]):
            return jsonify({"error": "Invalid email or password."}), 401

        token = create_access_token(identity=str(user["id"]))
        return jsonify({
            "token": token,
            "user":  {"id": user["id"], "name": user["name"], "email": user["email"]}
        }), 200
    finally:
        conn.close()


# ─── GET /api/auth/me ─────────────────────────────────
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        user = conn.execute("SELECT id, name, email, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            return jsonify({"error": "User not found."}), 404
        return jsonify(dict_from_row(user)), 200
    finally:
        conn.close()
