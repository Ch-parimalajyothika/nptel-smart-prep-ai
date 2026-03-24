"""
routes/weeks.py
GET    /api/weeks/<course_id>/<week>          → get week data
POST   /api/weeks/<course_id>/<week>/transcript → save transcript
POST   /api/weeks/<course_id>/<week>/notes      → generate notes
POST   /api/weeks/<course_id>/<week>/mcqs       → generate MCQs
POST   /api/weeks/<course_id>/youtube           → fetch YT transcript
"""
import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import get_db, dict_from_row
from utils.gemini import generate_text, build_notes_prompt, build_mcq_prompt
from utils.rag    import store_chunks
from utils.youtube_transcript import fetch_youtube_transcript

weeks_bp = Blueprint("weeks", __name__)

NOTE_FIELDS = {
    "summary":   "summary_notes",
    "detailed":  "detailed_notes",
    "keypoints": "key_concepts",
    "formulas":  "formulas",
    "revision":  "revision_notes",
}


def _get_or_create_week(conn, course_id, user_id, week_number):
    row = conn.execute(
        "SELECT * FROM weeks WHERE course_id=? AND user_id=? AND week_number=?",
        (course_id, user_id, week_number)
    ).fetchone()
    if not row:
        conn.execute(
            "INSERT INTO weeks (course_id, user_id, week_number) VALUES (?,?,?)",
            (course_id, user_id, week_number)
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM weeks WHERE course_id=? AND user_id=? AND week_number=?",
            (course_id, user_id, week_number)
        ).fetchone()
    return row


# ── GET week data ─────────────────────────────────────
@weeks_bp.route("/<int:cid>/<int:wnum>", methods=["GET"])
@jwt_required()
def get_week(cid, wnum):
    uid = int(get_jwt_identity())
    conn = get_db()
    try:
        # Verify course ownership
        course = conn.execute(
            "SELECT * FROM courses WHERE id=? AND user_id=?", (cid, uid)
        ).fetchone()
        if not course:
            return jsonify({"error": "Course not found."}), 404

        row = conn.execute(
            "SELECT * FROM weeks WHERE course_id=? AND user_id=? AND week_number=?",
            (cid, uid, wnum)
        ).fetchone()
        d = dict_from_row(row) if row else {
            "course_id": cid, "week_number": wnum, "transcript": None,
            "summary_notes": None, "detailed_notes": None,
            "key_concepts": None, "formulas": None, "revision_notes": None,
            "mcqs": None,
        }
        # Parse MCQs JSON if present
        if d.get("mcqs"):
            try: d["mcqs"] = json.loads(d["mcqs"])
            except: pass
        return jsonify(d), 200
    finally:
        conn.close()


# ── Save transcript ───────────────────────────────────
@weeks_bp.route("/<int:cid>/<int:wnum>/transcript", methods=["POST"])
@jwt_required()
def save_transcript(cid, wnum):
    uid  = int(get_jwt_identity())
    data = request.get_json()
    transcript = (data.get("transcript") or "").strip()
    title      = (data.get("title") or f"Week {wnum}").strip()

    if not transcript:
        return jsonify({"error": "Transcript text is required."}), 400

    conn = get_db()
    try:
        course = conn.execute(
            "SELECT title FROM courses WHERE id=? AND user_id=?", (cid, uid)
        ).fetchone()
        if not course:
            return jsonify({"error": "Course not found."}), 404

        _get_or_create_week(conn, cid, uid, wnum)
        conn.execute(
            """UPDATE weeks SET transcript=?, title=?, updated_at=datetime('now')
               WHERE course_id=? AND user_id=? AND week_number=?""",
            (transcript, title, cid, uid, wnum)
        )
        conn.commit()

        # Get week id for RAG
        wrow = conn.execute(
            "SELECT id FROM weeks WHERE course_id=? AND user_id=? AND week_number=?",
            (cid, uid, wnum)
        ).fetchone()
        if wrow:
            store_chunks(uid, wrow["id"], "week", transcript)

        return jsonify({"message": "Transcript saved.", "chars": len(transcript)}), 200
    finally:
        conn.close()


# ── Fetch YouTube transcript ──────────────────────────
@weeks_bp.route("/<int:cid>/youtube", methods=["POST"])
@jwt_required()
def fetch_youtube(cid):
    uid  = int(get_jwt_identity())
    data = request.get_json()
    url  = (data.get("url") or "").strip()
    wnum = int(data.get("week_number", 1))

    if not url:
        return jsonify({"error": "YouTube URL is required."}), 400

    conn = get_db()
    try:
        course = conn.execute(
            "SELECT title FROM courses WHERE id=? AND user_id=?", (cid, uid)
        ).fetchone()
        if not course:
            return jsonify({"error": "Course not found."}), 404
    finally:
        conn.close()

    transcript, status = fetch_youtube_transcript(url)

    if not transcript:
        return jsonify({
            "success": False,
            "status":  status,
            "message": "Transcript not available from YouTube. Please upload audio instead.",
        }), 200

    # Save the transcript
    conn = get_db()
    try:
        _get_or_create_week(conn, cid, uid, wnum)
        conn.execute(
            """UPDATE weeks SET transcript=?, updated_at=datetime('now')
               WHERE course_id=? AND user_id=? AND week_number=?""",
            (transcript, cid, uid, wnum)
        )
        conn.commit()
        wrow = conn.execute(
            "SELECT id FROM weeks WHERE course_id=? AND user_id=? AND week_number=?",
            (cid, uid, wnum)
        ).fetchone()
        if wrow:
            store_chunks(uid, wrow["id"], "week", transcript)
    finally:
        conn.close()

    return jsonify({
        "success":    True,
        "status":     status,
        "transcript": transcript[:500] + "..." if len(transcript) > 500 else transcript,
        "length":     len(transcript),
    }), 200


# ── Generate notes ────────────────────────────────────
@weeks_bp.route("/<int:cid>/<int:wnum>/notes", methods=["POST"])
@jwt_required()
def generate_notes(cid, wnum):
    uid  = int(get_jwt_identity())
    data = request.get_json()
    note_type = (data.get("type") or "summary").lower()

    if note_type not in NOTE_FIELDS:
        return jsonify({"error": f"Valid types: {list(NOTE_FIELDS.keys())}"}), 400

    conn = get_db()
    try:
        course = conn.execute(
            "SELECT title FROM courses WHERE id=? AND user_id=?", (cid, uid)
        ).fetchone()
        if not course:
            return jsonify({"error": "Course not found."}), 404

        week_row = conn.execute(
            "SELECT * FROM weeks WHERE course_id=? AND user_id=? AND week_number=?",
            (cid, uid, wnum)
        ).fetchone()
        transcript = week_row["transcript"] if week_row else ""
        course_title = course["title"]
    finally:
        conn.close()

    prompt  = build_notes_prompt(course_title, wnum, note_type, "", transcript or "")
    try:
        content = generate_text(prompt, temperature=0.6)
    except Exception as e:
        return jsonify({"error": f"AI generation failed: {e}"}), 503

    db_field = NOTE_FIELDS[note_type]
    conn = get_db()
    try:
        _get_or_create_week(conn, cid, uid, wnum)
        conn.execute(
            f"UPDATE weeks SET {db_field}=?, updated_at=datetime('now') WHERE course_id=? AND user_id=? AND week_number=?",
            (content, cid, uid, wnum)
        )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"type": note_type, "content": content}), 200


# ── Generate MCQs ─────────────────────────────────────
@weeks_bp.route("/<int:cid>/<int:wnum>/mcqs", methods=["POST"])
@jwt_required()
def generate_mcqs(cid, wnum):
    uid  = int(get_jwt_identity())
    data = request.get_json()
    count = min(int(data.get("count", 20)), 30)

    conn = get_db()
    try:
        course = conn.execute(
            "SELECT title FROM courses WHERE id=? AND user_id=?", (cid, uid)
        ).fetchone()
        if not course:
            return jsonify({"error": "Course not found."}), 404

        week_row   = conn.execute(
            "SELECT transcript FROM weeks WHERE course_id=? AND user_id=? AND week_number=?",
            (cid, uid, wnum)
        ).fetchone()
        transcript = week_row["transcript"] if week_row else ""
    finally:
        conn.close()

    prompt = build_mcq_prompt(course["title"], wnum, count, "", transcript or "")
    try:
        raw = generate_text(prompt, temperature=0.7)
    except Exception as e:
        return jsonify({"error": f"AI generation failed: {e}"}), 503

    # Store as plain text AND as JSON-parseable list
    conn = get_db()
    try:
        _get_or_create_week(conn, cid, uid, wnum)
        conn.execute(
            "UPDATE weeks SET mcqs=?, updated_at=datetime('now') WHERE course_id=? AND user_id=? AND week_number=?",
            (raw, cid, uid, wnum)
        )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"content": raw, "week": wnum}), 200
