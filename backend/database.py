"""
database.py — Upgraded SQLite schema v2.
NEW tables: courses, weeks, exam_results, rag_chunks
"""

import sqlite3, os

DB_PATH = os.getenv("DATABASE_URL", "sqlite:///nptel_smart_prep.db").replace("sqlite:///", "")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    c    = conn.cursor()

    # ── Users ──────────────────────────────────────────
    c.execute("""CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")

    # ── Courses ── NEW ─────────────────────────────────
    c.execute("""CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL, code TEXT,
        description TEXT, total_weeks INTEGER DEFAULT 12,
        created_at TEXT DEFAULT (datetime('now'))
    )""")

    # ── Weeks ── NEW ───────────────────────────────────
    c.execute("""CREATE TABLE IF NOT EXISTS weeks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL REFERENCES courses(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        week_number INTEGER NOT NULL, title TEXT,
        transcript TEXT,
        summary_notes TEXT, detailed_notes TEXT,
        key_concepts TEXT, formulas TEXT, revision_notes TEXT,
        mcqs TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(course_id, week_number)
    )""")

    # ── Exam Results ── NEW ────────────────────────────
    c.execute("""CREATE TABLE IF NOT EXISTS exam_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        course_id INTEGER REFERENCES courses(id),
        course_label TEXT NOT NULL,
        total_q INTEGER NOT NULL, correct INTEGER NOT NULL,
        wrong INTEGER NOT NULL, skipped INTEGER DEFAULT 0,
        score_pct REAL NOT NULL, duration_sec INTEGER,
        weak_topics TEXT, answers_json TEXT,
        taken_at TEXT DEFAULT (datetime('now'))
    )""")

    # ── RAG Chunks ── NEW ─────────────────────────────
    c.execute("""CREATE TABLE IF NOT EXISTS rag_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        source_id INTEGER, source_type TEXT,
        chunk_text TEXT NOT NULL, keywords TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""")

    # ── Uploads ───────────────────────────────────────
    c.execute("""CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL, filename TEXT NOT NULL,
        filepath TEXT, source_url TEXT, transcript TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""")

    # ── Chat History ──────────────────────────────────
    c.execute("""CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        role TEXT NOT NULL, content TEXT NOT NULL,
        sources TEXT, created_at TEXT DEFAULT (datetime('now'))
    )""")

    # ── Progress ──────────────────────────────────────
    c.execute("""CREATE TABLE IF NOT EXISTS progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        course TEXT NOT NULL, week INTEGER NOT NULL,
        topic TEXT NOT NULL, completed INTEGER DEFAULT 0,
        score REAL, updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, course, week)
    )""")

    # ── Notes / Questions (legacy) ─────────────────────
    c.execute("""CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL, course TEXT NOT NULL,
        week INTEGER NOT NULL, type TEXT NOT NULL,
        topic TEXT, content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL, course TEXT NOT NULL,
        week INTEGER, type TEXT NOT NULL,
        count INTEGER DEFAULT 5, topic TEXT,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")

    conn.commit()
    conn.close()
    print("✅  Database tables initialised (v2).")

def dict_from_row(row):
    return dict(row) if row else None
