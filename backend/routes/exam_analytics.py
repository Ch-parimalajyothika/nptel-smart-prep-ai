"""
routes/exam_analytics.py
POST /api/exam/save       → save exam result
GET  /api/exam/results    → list past results
GET  /api/exam/stats      → aggregated stats + weak topics
DELETE /api/exam/results  → clear history
"""
import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import get_db, dict_from_row

exam_analytics_bp = Blueprint("exam_analytics", __name__)


# ── POST /api/exam/save ───────────────────────────────
@exam_analytics_bp.route("/save", methods=["POST"])
@jwt_required()
def save_result():
    uid  = int(get_jwt_identity())
    data = request.get_json()

    required = ["course_label", "total_q", "correct", "wrong", "score_pct"]
    for f in required:
        if f not in data:
            return jsonify({"error": f"Missing field: {f}"}), 400

    conn = get_db()
    try:
        cur = conn.execute(
            """INSERT INTO exam_results
               (user_id, course_id, course_label, total_q, correct, wrong, skipped,
                score_pct, duration_sec, weak_topics, answers_json)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (uid,
             data.get("course_id"),
             data["course_label"],
             int(data["total_q"]),
             int(data["correct"]),
             int(data["wrong"]),
             int(data.get("skipped", 0)),
             float(data["score_pct"]),
             data.get("duration_sec"),
             json.dumps(data.get("weak_topics", [])),
             json.dumps(data.get("answers", [])))
        )
        conn.commit()
        return jsonify({"id": cur.lastrowid, "message": "Result saved."}), 201
    finally:
        conn.close()


# ── GET /api/exam/results ─────────────────────────────
@exam_analytics_bp.route("/results", methods=["GET"])
@jwt_required()
def list_results():
    uid   = int(get_jwt_identity())
    limit = min(int(request.args.get("limit", 20)), 100)
    conn  = get_db()
    try:
        rows = conn.execute(
            """SELECT id, course_label, total_q, correct, wrong, skipped,
                      score_pct, duration_sec, taken_at
               FROM exam_results WHERE user_id=? ORDER BY taken_at DESC LIMIT ?""",
            (uid, limit)
        ).fetchall()
        return jsonify([dict_from_row(r) for r in rows]), 200
    finally:
        conn.close()


# ── GET /api/exam/stats ───────────────────────────────
@exam_analytics_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    uid = int(get_jwt_identity())
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT score_pct, correct, total_q, weak_topics, course_label, taken_at FROM exam_results WHERE user_id=? ORDER BY taken_at DESC",
            (uid,)
        ).fetchall()

        if not rows:
            return jsonify({
                "total_exams": 0, "avg_score": 0, "best_score": 0,
                "accuracy": 0, "weak_topics": [], "trend": [],
                "course_breakdown": {},
            }), 200

        scores       = [r["score_pct"] for r in rows]
        all_correct  = sum(r["correct"]  for r in rows)
        all_total    = sum(r["total_q"]  for r in rows)

        # Aggregate weak topics
        topic_counts = {}
        for r in rows:
            if r["weak_topics"]:
                try:
                    topics = json.loads(r["weak_topics"])
                    for t in topics:
                        topic_counts[t] = topic_counts.get(t, 0) + 1
                except: pass

        weak_sorted = sorted(topic_counts.items(), key=lambda x: -x[1])[:10]

        # Per-course breakdown
        course_map = {}
        for r in rows:
            cl = r["course_label"]
            if cl not in course_map:
                course_map[cl] = {"scores": [], "exams": 0}
            course_map[cl]["scores"].append(r["score_pct"])
            course_map[cl]["exams"] += 1
        course_breakdown = {
            k: {"avg": round(sum(v["scores"])/len(v["scores"]), 1), "exams": v["exams"]}
            for k, v in course_map.items()
        }

        # Score trend (last 10 exams, newest first → reverse for chart)
        trend = [{"score": r["score_pct"], "date": r["taken_at"][:10]} for r in rows[:10]]
        trend.reverse()

        return jsonify({
            "total_exams":      len(rows),
            "avg_score":        round(sum(scores) / len(scores), 1),
            "best_score":       round(max(scores), 1),
            "accuracy":         round(all_correct / max(all_total, 1) * 100, 1),
            "weak_topics":      [{"topic": t, "count": c} for t, c in weak_sorted],
            "trend":            trend,
            "course_breakdown": course_breakdown,
        }), 200
    finally:
        conn.close()


# ── DELETE /api/exam/results ──────────────────────────
@exam_analytics_bp.route("/results", methods=["DELETE"])
@jwt_required()
def clear_results():
    uid = int(get_jwt_identity())
    conn = get_db()
    try:
        conn.execute("DELETE FROM exam_results WHERE user_id=?", (uid,))
        conn.commit()
        return jsonify({"message": "Exam history cleared."}), 200
    finally:
        conn.close()
