"""
routes/questions.py — Question generation endpoints
POST /api/questions/generate → generate AI questions
GET  /api/questions/         → list saved question sets
GET  /api/questions/<id>     → get single question set
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import get_db, dict_from_row
from utils.gemini import generate_text, build_questions_prompt

questions_bp = Blueprint("questions", __name__)

VALID_TYPES = {"mcq", "short", "long", "exam"}


# ─── POST /api/questions/generate ────────────────────
@questions_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_questions():
    user_id = int(get_jwt_identity())
    data    = request.get_json()

    course = (data.get("course") or "").strip().lower()
    week   = data.get("week")    # optional
    qtype  = (data.get("type") or "mcq").strip().lower()
    count  = min(max(int(data.get("count") or 5), 1), 20)
    topic  = (data.get("topic") or "").strip()

    if not course:
        return jsonify({"error": "Course is required."}), 400
    if qtype not in VALID_TYPES:
        return jsonify({"error": f"Type must be one of: {', '.join(VALID_TYPES)}"}), 400

    prompt = build_questions_prompt(course, week, qtype, count, topic)
    try:
        content = generate_text(prompt, temperature=0.7)
    except Exception as e:
        return jsonify({"error": f"AI generation failed: {str(e)}"}), 503

    # Save to DB
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO questions (user_id, course, week, type, count, topic, content) VALUES (?,?,?,?,?,?,?)",
            (user_id, course, week, qtype, count, topic, content)
        )
        conn.commit()
        qset_id = cursor.lastrowid
    finally:
        conn.close()

    return jsonify({
        "id":      qset_id,
        "course":  course,
        "week":    week,
        "type":    qtype,
        "count":   count,
        "topic":   topic,
        "content": content
    }), 201


# ─── GET /api/questions/ ─────────────────────────────
@questions_bp.route("/", methods=["GET"])
@jwt_required()
def list_questions():
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, course, week, type, count, topic, created_at FROM questions WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        ).fetchall()
        return jsonify([dict_from_row(r) for r in rows]), 200
    finally:
        conn.close()


# ─── GET /api/questions/<id> ─────────────────────────
@questions_bp.route("/<int:qset_id>", methods=["GET"])
@jwt_required()
def get_question_set(qset_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM questions WHERE id = ? AND user_id = ?", (qset_id, user_id)
        ).fetchone()
        if not row:
            return jsonify({"error": "Question set not found."}), 404
        return jsonify(dict_from_row(row)), 200
    finally:
        conn.close()
