"""
database.py — PostgreSQL version (Render production ready)
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor


# ✅ Connect to PostgreSQL (Render provides DATABASE_URL)
def get_db():
    return psycopg2.connect(
        os.getenv("DATABASE_URL"),
        cursor_factory=RealDictCursor
    )


def init_db():
    conn = get_db()
    c = conn.cursor()

    # ── Users ──────────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── Courses ────────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title TEXT NOT NULL,
        code TEXT,
        description TEXT,
        total_weeks INTEGER DEFAULT 12,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── Weeks ──────────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS weeks (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id),
        user_id INTEGER REFERENCES users(id),
        week_number INTEGER NOT NULL,
        title TEXT,
        transcript TEXT,
        summary_notes TEXT,
        detailed_notes TEXT,
        key_concepts TEXT,
        formulas TEXT,
        revision_notes TEXT,
        mcqs TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(course_id, week_number)
    )
    """)

    # ── Exam Results ───────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS exam_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        course_id INTEGER REFERENCES courses(id),
        course_label TEXT NOT NULL,
        total_q INTEGER,
        correct INTEGER,
        wrong INTEGER,
        skipped INTEGER DEFAULT 0,
        score_pct REAL,
        duration_sec INTEGER,
        weak_topics TEXT,
        answers_json TEXT,
        taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── RAG Chunks ─────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS rag_chunks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        source_id INTEGER,
        source_type TEXT,
        chunk_text TEXT,
        keywords TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── Uploads ────────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS uploads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type TEXT,
        filename TEXT,
        filepath TEXT,
        source_url TEXT,
        transcript TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── Chat History ───────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        role TEXT,
        content TEXT,
        sources TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── Progress ───────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        course TEXT,
        week INTEGER,
        topic TEXT,
        completed INTEGER DEFAULT 0,
        score REAL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course, week)
    )
    """)

    # ── Notes ──────────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        course TEXT,
        week INTEGER,
        type TEXT,
        topic TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ── Questions ──────────────────────────────────────
    c.execute("""
    CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        course TEXT,
        week INTEGER,
        type TEXT,
        count INTEGER DEFAULT 5,
        topic TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    c.close()
    conn.close()

    print("✅ PostgreSQL database initialized!")


def dict_from_row(row):
    return dict(row) if row else None