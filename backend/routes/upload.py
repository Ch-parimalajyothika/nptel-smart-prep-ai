"""
routes/upload.py — File upload with automatic RAG chunking.
POST /api/upload/pdf       → extract text, store RAG chunks
POST /api/upload/audio     → Whisper transcription, store RAG chunks
GET  /api/upload/          → list uploads
DELETE /api/upload/<id>    → delete upload + its RAG chunks
"""
import os, uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from database import get_db, dict_from_row
from utils.rag import store_chunks

upload_bp = Blueprint("upload", __name__)

ALLOWED_PDF   = {"pdf"}
ALLOWED_AUDIO = {"mp3","wav","m4a","ogg","flac","webm"}

def _allowed(filename, ext_set):
    return "." in filename and filename.rsplit(".",1)[1].lower() in ext_set

def _extract_pdf(path):
    try:
        import pdfplumber
        parts = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t: parts.append(t)
        return "\n\n".join(parts)
    except Exception:
        try:
            import PyPDF2
            parts = []
            with open(path,"rb") as f:
                for page in PyPDF2.PdfReader(f).pages:
                    t = page.extract_text()
                    if t: parts.append(t)
            return "\n\n".join(parts)
        except Exception as e:
            return f"[PDF extraction failed: {e}]"

def _transcribe(path):
    import openai
    key = os.getenv("OPENAI_API_KEY","")
    if not key:
        return "[OPENAI_API_KEY not set — add it to .env to enable Whisper transcription]"
    client = openai.OpenAI(api_key=key)
    with open(path,"rb") as f:
        result = client.audio.transcriptions.create(
            model="whisper-1", file=f, response_format="text"
        )
    return result


# ── POST /api/upload/pdf ─────────────────────────────
@upload_bp.route("/pdf", methods=["POST"])
@jwt_required()
def upload_pdf():
    uid = int(get_jwt_identity())
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400
    file = request.files["file"]
    if not file.filename or not _allowed(file.filename, ALLOWED_PDF):
        return jsonify({"error": "Only PDF files are allowed."}), 400

    safe  = secure_filename(file.filename)
    uname = f"{uuid.uuid4().hex}_{safe}"
    path  = os.path.join(current_app.config["UPLOAD_FOLDER"], uname)
    file.save(path)

    text    = _extract_pdf(path)
    preview = text[:500]

    conn = get_db()
    try:
        cur = conn.execute(
            "INSERT INTO uploads (user_id,type,filename,filepath,transcript) VALUES (?,?,?,?,?)",
            (uid,"pdf",safe,path,text)
        )
        conn.commit()
        uid_row = cur.lastrowid
    finally:
        conn.close()

    # Store RAG chunks
    if text and not text.startswith("["):
        store_chunks(uid, uid_row, "upload", text)

    return jsonify({"id":uid_row,"filename":safe,"text_preview":preview,"char_count":len(text)}), 201


# ── POST /api/upload/audio ───────────────────────────
@upload_bp.route("/audio", methods=["POST"])
@jwt_required()
def upload_audio():
    uid = int(get_jwt_identity())
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400
    file = request.files["file"]
    if not file.filename or not _allowed(file.filename, ALLOWED_AUDIO):
        return jsonify({"error": f"Allowed: {', '.join(ALLOWED_AUDIO)}"}), 400

    safe  = secure_filename(file.filename)
    uname = f"{uuid.uuid4().hex}_{safe}"
    path  = os.path.join(current_app.config["UPLOAD_FOLDER"], uname)
    file.save(path)

    try:
        transcript = _transcribe(path)
    except Exception as e:
        transcript = f"[Transcription failed: {e}]"

    conn = get_db()
    try:
        cur = conn.execute(
            "INSERT INTO uploads (user_id,type,filename,filepath,transcript) VALUES (?,?,?,?,?)",
            (uid,"audio",safe,path,transcript)
        )
        conn.commit()
        row_id = cur.lastrowid
    finally:
        conn.close()

    if transcript and not transcript.startswith("["):
        store_chunks(uid, row_id, "upload", transcript)

    return jsonify({"id":row_id,"filename":safe,"transcript":transcript}), 201


# ── GET /api/upload/ ─────────────────────────────────
@upload_bp.route("/", methods=["GET"])
@jwt_required()
def list_uploads():
    uid = int(get_jwt_identity())
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id,type,filename,source_url,created_at FROM uploads WHERE user_id=? ORDER BY created_at DESC",
            (uid,)
        ).fetchall()
        return jsonify([dict_from_row(r) for r in rows]), 200
    finally:
        conn.close()


# ── DELETE /api/upload/<id> ──────────────────────────
@upload_bp.route("/<int:uid_row>", methods=["DELETE"])
@jwt_required()
def delete_upload(uid_row):
    uid = int(get_jwt_identity())
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT filepath FROM uploads WHERE id=? AND user_id=?", (uid_row,uid)
        ).fetchone()
        if row and row["filepath"] and os.path.exists(row["filepath"]):
            os.remove(row["filepath"])
        conn.execute("DELETE FROM uploads    WHERE id=? AND user_id=?", (uid_row,uid))
        conn.execute("DELETE FROM rag_chunks WHERE source_id=? AND source_type='upload' AND user_id=?", (uid_row,uid))
        conn.commit()
        return jsonify({"message":"Deleted."}), 200
    finally:
        conn.close()
