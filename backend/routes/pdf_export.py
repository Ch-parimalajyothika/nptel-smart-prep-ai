"""
routes/pdf_export.py
POST /api/pdf/generate → generate PDF from markdown content
GET  /api/pdf/week/<course_id>/<week> → generate PDF from stored week notes
"""
import io
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import get_db
from utils.pdf_generator import generate_pdf

pdf_bp = Blueprint("pdf", __name__)


# ── POST /api/pdf/generate ────────────────────────────
@pdf_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_from_content():
    """Generate a PDF from markdown content sent in the request body."""
    data      = request.get_json()
    content   = (data.get("content")   or "").strip()
    title     = (data.get("title")     or "Notes").strip()
    course    = (data.get("course")    or "NPTEL").strip()
    week      = int(data.get("week", 1))
    note_type = (data.get("note_type") or "notes").strip()

    if not content:
        return jsonify({"error": "Content is required."}), 400

    try:
        pdf_bytes = generate_pdf(content, title, course, week, note_type)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503

    buf      = io.BytesIO(pdf_bytes)
    filename = f"nptel-{course.lower().replace(' ','-')}-week{week}-{note_type}.pdf"
    return send_file(buf, mimetype="application/pdf",
                     as_attachment=True, download_name=filename)


# ── GET /api/pdf/week/<cid>/<wnum> ────────────────────
@pdf_bp.route("/week/<int:cid>/<int:wnum>", methods=["GET"])
@jwt_required()
def generate_from_week(cid, wnum):
    """Generate a PDF from stored week notes."""
    uid       = int(get_jwt_identity())
    note_type = request.args.get("type", "summary")

    FIELD_MAP = {
        "summary":   "summary_notes",
        "detailed":  "detailed_notes",
        "keypoints": "key_concepts",
        "formulas":  "formulas",
        "revision":  "revision_notes",
    }
    db_field = FIELD_MAP.get(note_type, "summary_notes")

    conn = get_db()
    try:
        course = conn.execute(
            "SELECT title FROM courses WHERE id=? AND user_id=?", (cid, uid)
        ).fetchone()
        if not course:
            return jsonify({"error": "Course not found."}), 404

        week_row = conn.execute(
            f"SELECT {db_field} FROM weeks WHERE course_id=? AND user_id=? AND week_number=?",
            (cid, uid, wnum)
        ).fetchone()

        content = week_row[db_field] if week_row and week_row[db_field] else None
        if not content:
            return jsonify({"error": "Notes not generated yet for this week. Please generate notes first."}), 404
    finally:
        conn.close()

    title     = f"Week {wnum} — {note_type.title()} Notes"
    try:
        pdf_bytes = generate_pdf(content, title, course["title"], wnum, note_type)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503

    buf      = io.BytesIO(pdf_bytes)
    filename = f"nptel-week{wnum}-{note_type}.pdf"
    return send_file(buf, mimetype="application/pdf",
                     as_attachment=True, download_name=filename)
