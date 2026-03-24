"""
routes/progress.py — Study progress tracking

GET    /api/progress/       → get user's progress
POST   /api/progress/update → upsert a topic completion
DELETE /api/progress/       → reset all progress
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import get_db, dict_from_row

progress_bp = Blueprint("progress", __name__)


# ─── GET /api/progress/ ──────────────────────────────
@progress_bp.route("/", methods=["GET"])
@jwt_required()
def get_progress():
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT course, week, topic, completed, score, updated_at FROM progress WHERE user_id = ? ORDER BY course, week",
            (user_id,)
        ).fetchall()

        # Group by course for easier frontend consumption
        grouped = {}
        for row in rows:
            d = dict_from_row(row)
            c = d.pop("course")
            grouped.setdefault(c, []).append(d)

        return jsonify(grouped), 200
    finally:
        conn.close()


# ─── POST /api/progress/update ───────────────────────
@progress_bp.route("/update", methods=["POST"])
@jwt_required()
def update_progress():
    user_id = int(get_jwt_identity())
    data    = request.get_json()

    course    = (data.get("course")    or "").strip().lower()
    week      = data.get("week")
    topic     = (data.get("topic")     or "").strip()
    completed = int(bool(data.get("completed", True)))
    score     = data.get("score")   # float or None

    if not course or not week or not topic:
        return jsonify({"error": "course, week, and topic are required."}), 400

    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO progress (user_id, course, week, topic, completed, score, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(user_id, course, week)
            DO UPDATE SET completed = excluded.completed,
                          score     = excluded.score,
                          topic     = excluded.topic,
                          updated_at = datetime('now')
        """, (user_id, course, week, topic, completed, score))
        conn.commit()
        return jsonify({"message": "Progress updated."}), 200
    finally:
        conn.close()


# ─── DELETE /api/progress/ ───────────────────────────
@progress_bp.route("/", methods=["DELETE"])
@jwt_required()
def reset_progress():
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        conn.execute("DELETE FROM progress WHERE user_id = ?", (user_id,))
        conn.commit()
        return jsonify({"message": "Progress reset."}), 200
    finally:
        conn.close()
