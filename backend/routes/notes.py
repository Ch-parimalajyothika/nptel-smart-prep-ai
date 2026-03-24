"""
routes/notes.py — Notes generation endpoints
Supports: summary, detailed, keypoints, lastday, formulas, diagram, mindmap, visual
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import get_db, dict_from_row
from utils.gemini import generate_text, build_notes_prompt, normalize_note_type

notes_bp = Blueprint("notes", __name__)

# ─── All accepted raw types (what the frontend sends) ────────────────────────
VALID_RAW_TYPES = {
    "summary",
    "detailed",
    "keypoints", "key-points", "key points",
    "lastday", "last-day", "last day", "revision", "revise", "review", "exam",
    "formulas", "formula", "equations",
    "diagram", "diagrams", "flowchart",
    "mindmap", "mind-map", "mind map",
    "visual", "visuals", "infographic",
}

# ─── Canonical types stored in DB and used in prompts ────────────────────────
CANONICAL_TYPES = {
    "summary", "detailed", "keypoints",
    "lastday", "formulas",
    "diagram", "mindmap", "visual",
}


def normalize_note_type(raw: str) -> str:
    """
    Map any raw frontend string → canonical DB/prompt type.
    Falls back to 'summary' for unknown inputs.
    """
    t = raw.strip().lower()
    mapping = {
        # keypoints variants
        "keypoints":   "keypoints",
        "key-points":  "keypoints",
        "key points":  "keypoints",
        # lastday / revision variants
        "lastday":     "lastday",
        "last-day":    "lastday",
        "last day":    "lastday",
        "revision":    "lastday",
        "revise":      "lastday",
        "review":      "lastday",
        "exam":        "lastday",
        # formula variants
        "formulas":    "formulas",
        "formula":     "formulas",
        "equations":   "formulas",
        # diagram variants
        "diagram":     "diagram",
        "diagrams":    "diagram",
        "flowchart":   "diagram",
        # mindmap variants  ← was missing before!
        "mindmap":     "mindmap",
        "mind-map":    "mindmap",
        "mind map":    "mindmap",
        # visual variants
        "visual":      "visual",
        "visuals":     "visual",
        "infographic": "visual",
    }
    return mapping.get(t, t if t in CANONICAL_TYPES else "summary")


def build_notes_prompt(course: str, week: int, topic: str, note_type: str, transcript: str = "") -> str:
    """
    Build a Gemini prompt tailored to the note type.
    For diagram/mindmap types, instructs the model to output valid Mermaid syntax.
    """
    subject = topic if topic else f"Week {week} core concepts"
    context = f"\n\nTranscript excerpt:\n{transcript[:3000]}" if transcript else ""

    base = f"You are an expert NPTEL tutor for '{course}'. Focus on Week {week}: {subject}.{context}\n\n"

    if note_type == "summary":
        return base + (
            "Write a concise 300–400 word summary in Markdown. "
            "Include: Overview, Core Ideas, Key Takeaways, and a Quick Revision checklist. "
            "Use **bold** for key terms."
        )

    if note_type == "detailed":
        return base + (
            "Write comprehensive detailed notes in Markdown (600–900 words). "
            "Include numbered sections: Introduction, Definitions, Algorithms/Methods, "
            "Examples with code snippets, Complexity Analysis, and Common Exam Traps. "
            "Use tables where comparisons help."
        )

    if note_type == "keypoints":
        return base + (
            "Generate bullet-point key notes in Markdown. "
            "Group under these headers: ### Definitions, ### Formulas, ### Properties, "
            "### Applications, ### Exam Tips. "
            "Each bullet must be one crisp, exam-ready sentence."
        )

    if note_type == "lastday":
        return base + (
            "Create a last-day revision sheet in Markdown. "
            "Sections: 🔑 Must-Know Definitions (5 max), ⚡ Critical Formulas, "
            "🚨 Common Mistakes, 🎯 Likely Exam Questions with one-line answers. "
            "Keep it under 300 words — every word must count."
        )

    if note_type == "formulas":
        return base + (
            "List ALL formulas and equations for this topic in Markdown. "
            "For each formula: name it, write it in a ```math or inline code block, "
            "explain each variable in one line, and state when to use it. "
            "Group by sub-topic. End with a Quick Reference table."
        )

    if note_type == "diagram":
        return base + (
            "Generate a Mermaid flowchart diagram that visualises the main algorithm or process.\n\n"
            "STRICT RULES:\n"
            "1. Output ONLY valid Mermaid syntax inside a ```mermaid code block.\n"
            "2. Use `flowchart TD` (top-down) or `flowchart LR` (left-right) as appropriate.\n"
            "3. Use descriptive node labels. Use diamond shapes `{...}` for decisions.\n"
            "4. Add a short markdown title (# heading) and a one-sentence explanation after the block.\n"
            "5. Do NOT include any prose paragraphs before the diagram — title first, then diagram.\n\n"
            "Example structure:\n"
            "# Topic — Algorithm Flow\n\n"
            "```mermaid\n"
            "flowchart TD\n"
            "    A([Start]) --> B[Step 1]\n"
            "    B --> C{Decision?}\n"
            "    C -->|Yes| D[Step 2a]\n"
            "    C -->|No| E[Step 2b]\n"
            "    D --> F([End])\n"
            "    E --> F\n"
            "```\n\n"
            "> Brief explanation here.\n\n"
            "Now generate a diagram for the requested topic following this exact structure."
        )

    if note_type == "mindmap":
        return base + (
            "Generate a Mermaid mind map that shows how all key concepts of this topic connect.\n\n"
            "STRICT RULES:\n"
            "1. Output ONLY valid Mermaid syntax inside a ```mermaid code block.\n"
            "2. Use `mindmap` as the diagram type.\n"
            "3. Root node should be the main topic in double parentheses: `root((Topic))`.\n"
            "4. Use 3–5 main branches, each with 2–4 sub-nodes.\n"
            "5. Keep node labels short (2–5 words).\n"
            "6. Add a markdown title before and a one-sentence tip after the block.\n\n"
            "Example structure:\n"
            "# Topic — Mind Map\n\n"
            "```mermaid\n"
            "mindmap\n"
            "  root((Topic))\n"
            "    Branch 1\n"
            "      Sub node A\n"
            "      Sub node B\n"
            "    Branch 2\n"
            "      Sub node C\n"
            "```\n\n"
            "> Tip here.\n\n"
            "Now generate a mind map for the requested topic following this exact structure."
        )

    if note_type == "visual":
        return base + (
            "Create rich visual notes in Markdown that combine diagrams AND written content.\n\n"
            "Structure:\n"
            "1. ## 📊 Process Flow — a `flowchart LR` Mermaid diagram showing the main pipeline.\n"
            "2. ## 🔑 Key Concepts — 4–6 emoji-prefixed bullet points with **bold** key terms.\n"
            "3. ## 🧩 Component Breakdown — a second Mermaid diagram (subgraph or flowchart) showing internal structure.\n"
            "4. ## 💡 Memory Tip — one vivid analogy in a blockquote (`>`).\n"
            "5. ## 📝 Exam Pattern — bullet list of question types likely to appear.\n\n"
            "RULES for Mermaid blocks:\n"
            "- Use valid Mermaid syntax inside ```mermaid blocks.\n"
            "- Keep node labels concise.\n"
            "- Do NOT use HTML inside Mermaid nodes.\n"
        )

    # fallback
    return base + "Write clear, well-structured notes in Markdown for this topic."


# ─── POST /api/notes/generate ────────────────────────────────────────────────
@notes_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_notes():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    course = (data.get("course") or "").strip().lower()
    week = data.get("week")
    raw_type = (data.get("type") or "summary").strip()
    note_type = normalize_note_type(raw_type)
    topic = (data.get("topic") or "").strip()
    transcript = data.get("transcript", "")

    # ── Validation ────────────────────────────────────────────────────────────
    if not course:
        return jsonify({"error": "Course is required."}), 400

    if not week or not str(week).isdigit() or not (1 <= int(week) <= 12):
        return jsonify({"error": "Week must be a number between 1 and 12."}), 400

    if note_type not in CANONICAL_TYPES:
        return jsonify({
            "error": (
                f"Invalid note type '{raw_type}'. "
                f"Valid types: {', '.join(sorted(CANONICAL_TYPES))}"
            )
        }), 400

    week = int(week)

    # ── Generate ──────────────────────────────────────────────────────────────
    prompt = build_notes_prompt(course, week, topic, note_type, transcript)

    try:
        content = generate_text(prompt, temperature=0.65)
    except Exception as e:
        return jsonify({"error": f"AI generation failed: {str(e)}"}), 503

    # ── Persist ───────────────────────────────────────────────────────────────
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO notes (user_id, course, week, type, topic, content) VALUES (?,?,?,?,?,?)",
            (user_id, course, week, note_type, topic, content),
        )
        conn.commit()
        note_id = cursor.lastrowid
    finally:
        conn.close()

    return jsonify({
        "id":      note_id,
        "course":  course,
        "week":    week,
        "type":    note_type,
        "topic":   topic,
        "content": content,
    }), 201


# ─── GET /api/notes/ ─────────────────────────────────────────────────────────
@notes_bp.route("/", methods=["GET"])
@jwt_required()
def list_notes():
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, course, week, type, topic, created_at "
            "FROM notes WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        return jsonify([dict_from_row(r) for r in rows]), 200
    finally:
        conn.close()


# ─── GET /api/notes/<id> ──────────────────────────────────────────────────────
@notes_bp.route("/<int:note_id>", methods=["GET"])
@jwt_required()
def get_note(note_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id),
        ).fetchone()
        if not row:
            return jsonify({"error": "Note not found."}), 404
        return jsonify(dict_from_row(row)), 200
    finally:
        conn.close()


# ─── DELETE /api/notes/<id> ───────────────────────────────────────────────────
# NEW CODE (paste this entire function)
@notes_bp.route("/<int:note_id>", methods=["DELETE"])
@jwt_required()
def delete_note(note_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    
    try:
        # First check if note exists and belongs to user
        cursor = conn.execute(
            "SELECT id, title FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id),
        )
        note = cursor.fetchone()
        
        if not note:
            return jsonify({
                "error": "Note not found",
                "message": "The note you're trying to delete doesn't exist or you don't have permission."
            }), 404
        
        # Perform the deletion
        cursor = conn.execute(
            "DELETE FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id),
        )
        
        # Check if deletion actually happened
        if cursor.rowcount == 0:
            return jsonify({
                "error": "Delete failed",
                "message": "Could not delete the note. Please try again."
            }), 500
        
        conn.commit()
        
        return jsonify({
            "success": True,
            "message": "Note deleted successfully.",
            "deleted_id": note_id
        }), 200
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error deleting note {note_id}: {str(e)}")
        return jsonify({
            "error": "Database error",
            "message": "An error occurred while deleting the note."
        }), 500
        
    finally:
        conn.close()

# ─── POST /api/notes/mcq ──────────────────────────────────────────────────────
@notes_bp.route("/mcq", methods=["POST"])
@jwt_required()
def generate_mcq():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    course = (data.get("course") or "").strip().lower()
    week = data.get("week")
    count = data.get("count", 5)
    topic = (data.get("topic") or "").strip()
    transcript = data.get("transcript", "")

    if not course:
        return jsonify({"error": "Course is required."}), 400
    if not week or not str(week).isdigit() or not (1 <= int(week) <= 12):
        return jsonify({"error": "Week must be a number between 1 and 12."}), 400
    if not count or not str(count).isdigit() or not (1 <= int(count) <= 20):
        return jsonify({"error": "Count must be a number between 1 and 20."}), 400

    week, count = int(week), int(count)

    from utils.gemini import build_mcq_prompt
    prompt = build_mcq_prompt(course, week, count, topic, transcript)

    try:
        content = generate_text(prompt, temperature=0.7)
    except Exception as e:
        return jsonify({"error": f"AI generation failed: {str(e)}"}), 503

    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO notes (user_id, course, week, type, topic, content) VALUES (?,?,?,?,?,?)",
            (user_id, course, week, "mcq", topic, content),
        )
        conn.commit()
        note_id = cursor.lastrowid
    finally:
        conn.close()

    return jsonify({
        "id":      note_id,
        "course":  course,
        "week":    week,
        "type":    "mcq",
        "topic":   topic,
        "content": content,
    }), 201