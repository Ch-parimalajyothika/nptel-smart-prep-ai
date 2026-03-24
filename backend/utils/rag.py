"""
utils/rag.py — Simple keyword-based RAG (Retrieval-Augmented Generation).

No vector DB needed — uses TF-IDF-style keyword overlap for retrieval.
Chunks are stored in the rag_chunks table and retrieved by keyword matching.
"""
import re
from database import get_db

# ─── Stop words to ignore ────────────────────────────
STOP = {
    "a","an","the","is","are","was","were","be","been","being",
    "have","has","had","do","does","did","will","would","could",
    "should","may","might","shall","can","need","dare","used",
    "to","of","in","for","on","with","at","by","from","as",
    "into","through","during","before","after","above","below",
    "up","down","out","off","over","under","again","then","once",
    "and","but","or","nor","so","yet","both","either","neither",
    "that","this","these","those","i","you","he","she","it","we","they",
    "what","which","who","whom","whose","how","when","where","why",
}

def _keywords(text: str) -> set:
    """Extract meaningful keywords from text."""
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    return {w for w in words if w not in STOP}

def chunk_text(text: str, chunk_size: int = 400, overlap: int = 80) -> list:
    """
    Split text into overlapping chunks.
    Returns list of (chunk_text, keywords_string).
    """
    words  = text.split()
    chunks = []
    step   = chunk_size - overlap
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size])
        if len(chunk.strip()) > 50:   # skip tiny chunks
            kws = " ".join(_keywords(chunk))
            chunks.append((chunk, kws))
    return chunks

def store_chunks(user_id: int, source_id: int, source_type: str, text: str):
    """Chunk a piece of text and store in rag_chunks table."""
    chunks = chunk_text(text)
    conn   = get_db()
    try:
        # Remove existing chunks for this source
        conn.execute(
            "DELETE FROM rag_chunks WHERE user_id=? AND source_id=? AND source_type=?",
            (user_id, source_id, source_type)
        )
        conn.executemany(
            "INSERT INTO rag_chunks (user_id, source_id, source_type, chunk_text, keywords) VALUES (?,?,?,?,?)",
            [(user_id, source_id, source_type, c, k) for c, k in chunks]
        )
        conn.commit()
    finally:
        conn.close()

def retrieve_chunks(user_id: int, query: str, top_k: int = 5) -> list:
    """
    Retrieve the most relevant chunks for a query using keyword overlap scoring.
    Returns list of dicts with chunk_text, score, source_type, source_id.
    """
    query_kws = _keywords(query)
    if not query_kws:
        return []

    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, source_id, source_type, chunk_text, keywords FROM rag_chunks WHERE user_id=?",
            (user_id,)
        ).fetchall()
    finally:
        conn.close()

    scored = []
    for row in rows:
        chunk_kws = set(row["keywords"].split()) if row["keywords"] else set()
        overlap   = len(query_kws & chunk_kws)
        if overlap > 0:
            # Normalise score by query length
            score = overlap / len(query_kws)
            scored.append({
                "chunk_text":  row["chunk_text"],
                "source_id":   row["source_id"],
                "source_type": row["source_type"],
                "score":       score,
            })

    # Sort by score descending, return top_k
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]

def has_context(user_id: int) -> bool:
    """Check if the user has any stored RAG chunks."""
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM rag_chunks WHERE user_id=?", (user_id,)
        ).fetchone()
        return row["cnt"] > 0
    finally:
        conn.close()
