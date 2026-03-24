"""
routes/chat.py — RAG-powered AI chatbot
POST   /api/chat/message → send message, retrieve context, get AI reply
GET    /api/chat/history → fetch conversation history
DELETE /api/chat/history → clear history
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import get_db, dict_from_row
from utils.gemini import generate_text, build_rag_chat_prompt, build_chat_prompt
from utils.rag    import retrieve_chunks, has_context

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/message", methods=["POST"])
@jwt_required()
def send_message():
    uid     = int(get_jwt_identity())
    data    = request.get_json()
    message = (data.get("message") or "").strip()
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "Message cannot be empty."}), 400

    # ── RAG: retrieve relevant chunks ────────────────
    chunks  = retrieve_chunks(uid, message, top_k=5)
    sources = [{"source_type": c["source_type"], "source_id": c["source_id"]}
               for c in chunks]

    # ── Build prompt ──────────────────────────────────
    if chunks:
        prompt = build_rag_chat_prompt(message, chunks, history)
    else:
        # No context — fall back to general knowledge
        prompt = build_chat_prompt(message, history, "")

    # ── Generate reply ────────────────────────────────
    try:
        reply = generate_text(prompt, temperature=0.75, max_tokens=2048)
    except Exception as e:
        return jsonify({"error": f"AI unavailable: {e}"}), 503

    # ── Persist messages ──────────────────────────────
    import json
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO chat_history (user_id, role, content) VALUES (?,?,?)",
            (uid, "user", message)
        )
        conn.execute(
            "INSERT INTO chat_history (user_id, role, content, sources) VALUES (?,?,?,?)",
            (uid, "assistant", reply, json.dumps(sources) if sources else None)
        )
        conn.commit()
    finally:
        conn.close()

    return jsonify({
        "reply":       reply,
        "used_context": len(chunks) > 0,
        "sources":     sources,
    }), 200


@chat_bp.route("/history", methods=["GET"])
@jwt_required()
def get_history():
    uid   = int(get_jwt_identity())
    limit = min(int(request.args.get("limit", 60)), 200)
    conn  = get_db()
    try:
        rows = conn.execute(
            "SELECT role, content, sources, created_at FROM chat_history "
            "WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
            (uid, limit)
        ).fetchall()
        return jsonify(list(reversed([dict_from_row(r) for r in rows]))), 200
    finally:
        conn.close()


@chat_bp.route("/history", methods=["DELETE"])
@jwt_required()
def clear_history():
    uid = int(get_jwt_identity())
    conn = get_db()
    try:
        conn.execute("DELETE FROM chat_history WHERE user_id=?", (uid,))
        conn.commit()
        return jsonify({"message": "Cleared."}), 200
    finally:
        conn.close()
