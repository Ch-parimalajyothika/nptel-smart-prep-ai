"""
routes/courses.py
GET    /api/courses/            → list user courses
POST   /api/courses/            → create course
GET    /api/courses/<id>        → course detail + weeks summary
PUT    /api/courses/<id>        → update course
DELETE /api/courses/<id>        → delete course + all weeks
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import get_db, dict_from_row

courses_bp = Blueprint("courses", __name__)

# Default NPTEL courses auto-added on first load
DEFAULT_COURSES = [
    {"title": "Artificial Intelligence",            "code": "AI",     "total_weeks": 12},
    {"title": "Machine Learning",                   "code": "ML",     "total_weeks": 12},
    {"title": "Human Computer Interaction",         "code": "HCI",    "total_weeks": 12},
    {"title": "Computer Vision",                    "code": "CV",     "total_weeks": 12},
    {"title": "Image Processing",                   "code": "IP",     "total_weeks": 12},
    {"title": "Blockchain Technology",              "code": "BC",     "total_weeks": 12},
    {"title": "Database Management Systems",        "code": "DBMS",   "total_weeks": 12},
    {"title": "Data Structures & Algorithms",       "code": "DSA",    "total_weeks": 12},
    {"title": "Computer Networks",                  "code": "CN",     "total_weeks": 12},
    {"title": "Operating Systems",                  "code": "OS",     "total_weeks": 12},
    {"title": "Cloud Computing",                    "code": "CLOUD",  "total_weeks": 8 },
    {"title": "Deep Learning",                      "code": "DL",     "total_weeks": 12},
]


# ── GET /api/courses/ ─────────────────────────────────
@courses_bp.route("/", methods=["GET"])
@jwt_required()
def list_courses():
    uid = int(get_jwt_identity())
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM courses WHERE user_id=? ORDER BY created_at ASC", (uid,)
        ).fetchall()

        # Seed defaults if user has no courses yet
        if not rows:
            conn.executemany(
                "INSERT INTO courses (user_id, title, code, total_weeks) VALUES (?,?,?,?)",
                [(uid, c["title"], c["code"], c["total_weeks"]) for c in DEFAULT_COURSES]
            )
            conn.commit()
            rows = conn.execute(
                "SELECT * FROM courses WHERE user_id=? ORDER BY created_at ASC", (uid,)
            ).fetchall()

        courses = []
        for r in rows:
            d = dict_from_row(r)
            # Count completed weeks
            done = conn.execute(
                "SELECT COUNT(*) as cnt FROM weeks WHERE course_id=? AND user_id=? AND transcript IS NOT NULL",
                (d["id"], uid)
            ).fetchone()["cnt"]
            d["weeks_done"] = done
            courses.append(d)
        return jsonify(courses), 200
    finally:
        conn.close()


# ── POST /api/courses/ ────────────────────────────────
@courses_bp.route("/", methods=["POST"])
@jwt_required()
def create_course():
    uid  = int(get_jwt_identity())
    data = request.get_json()
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Course title is required."}), 400
    conn = get_db()
    try:
        cur = conn.execute(
            "INSERT INTO courses (user_id, title, code, description, total_weeks) VALUES (?,?,?,?,?)",
            (uid, title, data.get("code",""), data.get("description",""), int(data.get("total_weeks", 12)))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM courses WHERE id=?", (cur.lastrowid,)).fetchone()
        d   = dict_from_row(row); d["weeks_done"] = 0
        return jsonify(d), 201
    finally:
        conn.close()


# ── GET /api/courses/<id> ─────────────────────────────
@courses_bp.route("/<int:cid>", methods=["GET"])
@jwt_required()
def get_course(cid):
    uid = int(get_jwt_identity())
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM courses WHERE id=? AND user_id=?", (cid, uid)
        ).fetchone()
        if not row:
            return jsonify({"error": "Course not found."}), 404
        d = dict_from_row(row)
        # Get weeks summary
        weeks = conn.execute(
            """SELECT week_number, title,
               CASE WHEN transcript IS NOT NULL THEN 1 ELSE 0 END as has_transcript,
               CASE WHEN summary_notes IS NOT NULL THEN 1 ELSE 0 END as has_notes,
               CASE WHEN mcqs IS NOT NULL THEN 1 ELSE 0 END as has_mcqs
               FROM weeks WHERE course_id=? AND user_id=? ORDER BY week_number""",
            (cid, uid)
        ).fetchall()
        d["weeks"] = [dict_from_row(w) for w in weeks]
        return jsonify(d), 200
    finally:
        conn.close()


# ── PUT /api/courses/<id> ─────────────────────────────
@courses_bp.route("/<int:cid>", methods=["PUT"])
@jwt_required()
def update_course(cid):
    uid  = int(get_jwt_identity())
    data = request.get_json()
    conn = get_db()
    try:
        conn.execute(
            "UPDATE courses SET title=?, code=?, description=?, total_weeks=? WHERE id=? AND user_id=?",
            (data.get("title",""), data.get("code",""), data.get("description",""),
             int(data.get("total_weeks",12)), cid, uid)
        )
        conn.commit()
        return jsonify({"message": "Updated."}), 200
    finally:
        conn.close()


# ── DELETE /api/courses/<id> ──────────────────────────
@courses_bp.route("/<int:cid>", methods=["DELETE"])
@jwt_required()
def delete_course(cid):
    uid = int(get_jwt_identity())
    conn = get_db()
    try:
        conn.execute("DELETE FROM weeks    WHERE course_id=? AND user_id=?", (cid, uid))
        conn.execute("DELETE FROM courses  WHERE id=?        AND user_id=?", (cid, uid))
        conn.commit()
        return jsonify({"message": "Course deleted."}), 200
    finally:
        conn.close()
