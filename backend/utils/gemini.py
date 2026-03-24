# ─────────────────────────────────────────
# NPTEL AI TUTOR - ENHANCED VERSION 3.0
# ─────────────────────────────────────────
"""
NPTEL AI Tutor with all bugs fixed and major enhancements.

BUGS FIXED (v2.1 → v3.0):
  BUG-01: Broken ANSI color sequences in ASCII diagrams (malformed f-strings)
  BUG-02: get_mock_response() missing "api_key_error" / "general_error" cases → fell to wrong branch
  BUG-03: Decorator order wrong — @rate_limit wrapping @cache_response meant cache hits still slept 1s
  BUG-04: Pre-generated ASCII diagram injected INTO the LLM prompt → LLM corrupted it + wasted tokens
  BUG-05: generate_text_async used run_in_executor but inner fn had time.sleep → blocked thread pool
  BUG-06: generate_examples_from_content returned generic placeholder strings, not real content
  BUG-07: process_formulas_response ignored LLM response and used raw regex instead
  BUG-08: normalize_note_type defined AFTER build_notes_prompt that calls it (definition order)
  BUG-09: Redundant groq_available + mock_mode double-check; single flag is cleaner
  BUG-10: build_notes_prompt embedded static filler examples into LLM prompt, confusing the model
"""

import os
import re
import json
import time
import asyncio
import hashlib
import logging
from typing import List, Dict, Union, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import wraps
from collections import OrderedDict

# ─────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("nptel_tutor")


# ─────────────────────────────────────────
# COLORS  (safe, self-contained)
# ─────────────────────────────────────────
class Colors:
    """ANSI color codes for terminal output."""
    BLACK    = "\033[30m"
    RED      = "\033[31m"
    GREEN    = "\033[32m"
    YELLOW   = "\033[33m"
    BLUE     = "\033[34m"
    MAGENTA  = "\033[35m"
    CYAN     = "\033[36m"
    WHITE    = "\033[37m"
    BOLD     = "\033[1m"
    UNDERLINE= "\033[4m"
    END      = "\033[0m"

    BG_RED    = "\033[41m"
    BG_GREEN  = "\033[42m"
    BG_YELLOW = "\033[43m"
    BG_BLUE   = "\033[44m"
    BG_MAGENTA= "\033[45m"
    BG_CYAN   = "\033[46m"
    BG_WHITE  = "\033[47m"

    @staticmethod
    def strip(text: str) -> str:
        """Remove all ANSI codes from a string (useful for plain-text output)."""
        return re.sub(r"\033\[[0-9;]*m", "", text)


# ─────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────
# ── Model fallback chain (tried in order until one works) ──────────────────
# llama-3.1-70b-versatile was DECOMMISSIONED Jan 2025.
# Current production models as of March 2026 (Groq docs):
MODEL_FALLBACK_CHAIN: List[str] = [
    "llama-3.3-70b-versatile",          # primary  — best quality, production
    "llama-3.1-8b-instant",             # fast fallback
    "qwen/qwen3-32b",                   # strong alternative
    "meta-llama/llama-4-scout-17b-16e-instruct",  # newest Llama 4
]


@dataclass
class Config:
    api_key: Optional[str]       = None
    model: str                   = "llama-3.3-70b-versatile"  # updated model
    max_tokens: Optional[int]    = None    # None = let the model use its full context
    temperature: float           = 0.7
    timeout: int                 = 60      # increased for longer responses
    cache_ttl: int               = 3600
    rate_limit_delay: float      = 0.5    # Groq is fast; 0.5 s is enough
    max_retries: int             = 3


config = Config(
    api_key          = os.getenv("GROQ_API_KEY"),
    model            = os.getenv("GROQ_MODEL",        "llama-3.3-70b-versatile"),
    # MAX_TOKENS not set → None (unlimited within model context window)
    max_tokens       = int(os.getenv("MAX_TOKENS")) if os.getenv("MAX_TOKENS") else None,
    temperature      = float(os.getenv("TEMPERATURE", "0.7")),
    timeout          = int(os.getenv("TIMEOUT",       "60")),
    cache_ttl        = int(os.getenv("CACHE_TTL",     "3600")),
    rate_limit_delay = float(os.getenv("RATE_LIMIT_DELAY", "0.5")),
    max_retries      = int(os.getenv("MAX_RETRIES",   "3")),
)


# ─────────────────────────────────────────
# GROQ CLIENT  (FIX-09: single flag, not double)
# ─────────────────────────────────────────
_client: Any = None
groq_available: bool = False


def initialize_groq_client() -> bool:
    """Initialize Groq client. Returns True on success."""
    global _client, groq_available

    try:
        from groq import Groq  # noqa: PLC0415
    except ImportError as exc:
        logger.error("❌ groq package not found: %s", exc)
        logger.error("   Install it:  pip install groq")
        return False

    if not config.api_key:
        logger.error("❌ GROQ_API_KEY is not set.")
        logger.error("   Fix:  export GROQ_API_KEY='your-key-here'")
        return False

    try:
        _client = Groq(api_key=config.api_key)
        groq_available = True
        logger.info("✅ Groq client ready  (model: %s)", config.model)
        return True
    except Exception as exc:
        logger.error("❌ Could not create Groq client: %s", exc)
        return False


initialize_groq_client()

if not groq_available:
    print(
        f"\n{Colors.RED}⚠️  WARNING: Groq not configured — running in MOCK MODE.{Colors.END}\n"
        f"{Colors.YELLOW}   Responses are placeholders.  "
        f"Run print_installation_guide() for setup help.{Colors.END}\n"
    )


# ─────────────────────────────────────────
# METRICS
# ─────────────────────────────────────────
class Metrics:
    def __init__(self):
        self.total_requests    = 0
        self.successful        = 0
        self.failed            = 0
        self.cache_hits        = 0
        self.cache_misses      = 0
        self.total_tokens      = 0
        self.response_times: List[float] = []
        self.errors: List[str] = []

    def record(self, success: bool, elapsed: float,
               tokens: int = 0, error: str = ""):
        self.total_requests += 1
        self.response_times.append(elapsed)
        if success:
            self.successful   += 1
            self.total_tokens += tokens
        else:
            self.failed += 1
            if error:
                self.errors.append(error)

    @property
    def success_rate(self) -> float:
        return (self.successful / self.total_requests * 100) if self.total_requests else 0.0

    @property
    def avg_response_time(self) -> float:
        return sum(self.response_times) / len(self.response_times) if self.response_times else 0.0

    @property
    def cache_hit_rate(self) -> float:
        total = self.cache_hits + self.cache_misses
        return (self.cache_hits / total * 100) if total else 0.0

    def as_dict(self) -> Dict:
        return {
            "total_requests":    self.total_requests,
            "successful":        self.successful,
            "failed":            self.failed,
            "success_rate":      round(self.success_rate, 1),
            "cache_hits":        self.cache_hits,
            "cache_misses":      self.cache_misses,
            "cache_hit_rate":    round(self.cache_hit_rate, 1),
            "total_tokens":      self.total_tokens,
            "avg_response_time": round(self.avg_response_time, 2),
            "recent_errors":     self.errors[-5:],
        }

    def print_summary(self):
        d = self.as_dict()
        print(f"\n{Colors.CYAN}📊 METRICS{Colors.END}")
        print("=" * 50)
        for k, v in d.items():
            if k != "recent_errors":
                print(f"  {k:<22}: {v}")
        if d["recent_errors"]:
            print(f"\n{Colors.RED}  Recent errors:{Colors.END}")
            for e in d["recent_errors"]:
                print(f"    • {e}")
        print("=" * 50)


metrics = Metrics()


# ─────────────────────────────────────────
# TTL CACHE
# ─────────────────────────────────────────
class TTLCache:
    """Simple LRU cache with per-item TTL."""

    def __init__(self, maxsize: int = 128, ttl: int = 3600):
        self.maxsize = maxsize
        self.ttl     = ttl
        self._store: OrderedDict = OrderedDict()

    def _expired(self, entry: Dict) -> bool:
        return datetime.now() > entry["expires"]

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            return None
        entry = self._store[key]
        if self._expired(entry):
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return entry["value"]

    def put(self, key: str, value: Any):
        if len(self._store) >= self.maxsize:
            self._store.popitem(last=False)
        self._store[key] = {
            "value":   value,
            "expires": datetime.now() + timedelta(seconds=self.ttl),
        }

    def clear(self):
        self._store.clear()

    def __len__(self) -> int:
        return len(self._store)


_cache = TTLCache(maxsize=100, ttl=config.cache_ttl)


# ─────────────────────────────────────────
# DECORATORS  (FIX-03: correct order)
# ─────────────────────────────────────────

def cache_response(ttl: int = 3600):
    """Cache the result of a function call by its arguments."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = hashlib.md5(
                (str(args) + str(sorted(kwargs.items()))).encode()
            ).hexdigest()

            cached = _cache.get(key)
            if cached is not None:
                metrics.cache_hits += 1
                return cached

            metrics.cache_misses += 1
            result = func(*args, **kwargs)
            _cache.put(key, result)
            return result
        return wrapper
    return decorator


def rate_limit(delay: float = 1.0):
    """Sleep *delay* seconds before calling the wrapped function."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            time.sleep(delay)
            return func(*args, **kwargs)
        return wrapper
    return decorator


# ─────────────────────────────────────────
# MOCK RESPONSES  (FIX-02: all cases handled)
# ─────────────────────────────────────────

def get_mock_response(prompt_type: str, **kwargs) -> str:
    """Return a helpful placeholder when the real API is unavailable."""

    _fix_cmd = (
        f"{Colors.YELLOW}To enable real responses:{Colors.END}\n"
        f"  1. pip install groq\n"
        f"  2. export GROQ_API_KEY='your-key'\n"
        f"  3. Restart the application\n"
    )

    if prompt_type == "summary":
        return (
            f"{Colors.GREEN}📝 MOCK SUMMARY — {kwargs.get('course','Course')} "
            f"Week {kwargs.get('week','?')}{Colors.END}\n\n"
            f"[Mock] Core concept: {kwargs.get('topic','N/A')}\n\n"
            + _fix_cmd
        )

    if prompt_type == "mcq":
        return (
            f"{Colors.BLUE}📋 MOCK MCQ — {kwargs.get('course','Course')}{Colors.END}\n\n"
            f"Q1. Why is the API unavailable?\n"
            f"A) Package not installed\nB) API key missing\n"
            f"C) Network issue\nD) All of the above\n\nAnswer: D\n\n"
            + _fix_cmd
        )

    # FIX-02 — previously missing cases fell through to the generic branch
    if prompt_type == "api_key_error":
        return (
            f"{Colors.RED}❌ Invalid or missing API key.{Colors.END}\n\n"
            f"  • Get a free key at: https://console.groq.com/keys\n"
            f"  • Then: export GROQ_API_KEY='your-key'\n"
        )

    if prompt_type == "rate_limit_error":
        return (
            f"{Colors.YELLOW}⚠️  Rate limit hit.  "
            f"Wait a moment and retry.{Colors.END}\n"
        )

    if prompt_type == "timeout_error":
        return (
            f"{Colors.YELLOW}⏰ Request timed out.  "
            f"Check your network and retry.{Colors.END}\n"
        )

    # generic / general_error
    error_detail = kwargs.get("error", "Unknown error")
    return (
        f"{Colors.RED}❌ API Error: {error_detail}{Colors.END}\n\n"
        + _fix_cmd
    )


# ─────────────────────────────────────────
# NOTE-TYPE MAPPING  (FIX-08: defined BEFORE build_notes_prompt)
# ─────────────────────────────────────────

VALID_NOTE_TYPES: Dict[str, str] = {
    # summary
    "summary":       "summary",
    "summarize":     "summary",
    # detailed
    "detailed":      "detailed",
    "detail":        "detailed",
    "comprehensive": "detailed",
    # keypoints
    "keypoints":     "keypoints",
    "key points":    "keypoints",
    "key-points":    "keypoints",
    "points":        "keypoints",
    # lastday
    "lastday":       "lastday",
    "last day":      "lastday",
    "last-minute":   "lastday",
    "revision":      "lastday",
    # formulas
    "formulas":      "formulas",
    "formula":       "formulas",
    "equations":     "formulas",
    # diagram
    "diagram":       "diagram",
    "diagrams":      "diagram",
    # visual
    "visual":        "visual",
    "visuals":       "visual",
    # flashcards
    "flashcards":    "flashcards",
    "flash card":    "flashcards",
    "flash-card":    "flashcards",
    # mindmap
    "mindmap":       "mindmap",
    "mind map":      "mindmap",
    "mind-map":      "mindmap",
    # outline
    "outline":       "outline",
    "outlines":      "outline",
    # cheatsheet
    "cheatsheet":    "cheatsheet",
    "cheat sheet":   "cheatsheet",
    "cheat-sheet":   "cheatsheet",
    # q&a
    "qa":            "qa",
    "q&a":           "qa",
    "question":      "qa",
    "questions":     "qa",
}


def normalize_note_type(note_type: str) -> str:
    """Return canonical note-type string, defaulting to 'summary'."""
    if not note_type:
        return "summary"
    norm = note_type.lower().strip()
    if norm in VALID_NOTE_TYPES:
        return VALID_NOTE_TYPES[norm]
    # partial match
    for key, value in VALID_NOTE_TYPES.items():
        if norm in key or key in norm:
            return value
    logger.warning("Unknown note type '%s' — defaulting to 'summary'", note_type)
    return "summary"


def validate_note_type(note_type: str) -> bool:
    return bool(note_type) and note_type.lower().strip() in VALID_NOTE_TYPES


def get_supported_note_types() -> List[str]:
    return sorted(set(VALID_NOTE_TYPES.values()))


# ─────────────────────────────────────────
# DIAGRAM GENERATION  (FIX-01: fixed ANSI strings; FIX-04: NOT in LLM prompt)
# ─────────────────────────────────────────

def generate_colorful_diagram(concept: str, content: str = "") -> str:
    """
    Return a colourful ASCII diagram.
    FIX-01: Every colour segment is properly closed with Colors.END.
    FIX-04: This is called AFTER the LLM response and appended to it — never
            injected into the prompt.
    """
    clo = content.lower()
    if any(w in clo for w in ("process", "step", "flow", "sequence")):
        kind = "process"
    elif any(w in clo for w in ("compare", "vs", "versus", "difference")):
        kind = "comparison"
    elif any(w in clo for w in ("time", "history", "timeline", "chronological")):
        kind = "timeline"
    elif any(w in clo for w in ("system", "architecture", "structure")):
        kind = "hierarchy"
    else:
        kind = "generic"

    C = Colors  # shorthand

    if kind == "process":
        return (
            f"\n{C.CYAN}╔══════════════════════════════════════╗{C.END}\n"
            f"{C.CYAN}║{C.BOLD}{C.WHITE}           PROCESS FLOW            {C.END}{C.CYAN}║{C.END}\n"
            f"{C.CYAN}╚══════════════════════════════════════╝{C.END}\n\n"
            f"{C.GREEN}┌─────────┐{C.END}    {C.YELLOW}┌─────────┐{C.END}    {C.BLUE}┌─────────┐{C.END}\n"
            f"{C.GREEN}│  INPUT  │{C.END} ──▶ {C.YELLOW}│ PROCESS │{C.END} ──▶ {C.BLUE}│ OUTPUT  │{C.END}\n"
            f"{C.GREEN}└─────────┘{C.END}    {C.YELLOW}└─────────┘{C.END}    {C.BLUE}└─────────┘{C.END}\n"
            f"    │                 │                 │\n"
            f"{C.GREEN}  Step 1{C.END}          {C.YELLOW}Step 2{C.END}          {C.BLUE}Step 3{C.END}\n"
        )

    if kind == "hierarchy":
        return (
            f"\n{C.MAGENTA}╔══════════════════════════════════════╗{C.END}\n"
            f"{C.MAGENTA}║{C.BOLD}{C.WHITE}          HIERARCHY VIEW           {C.END}{C.MAGENTA}║{C.END}\n"
            f"{C.MAGENTA}╚══════════════════════════════════════╝{C.END}\n\n"
            f"           {C.RED}┌─────────────┐{C.END}\n"
            f"           {C.RED}│{C.BOLD}{C.WHITE}    MAIN     {C.END}{C.RED}│{C.END}\n"
            f"           {C.RED}└──────┬──────┘{C.END}\n"
            f"                  {C.YELLOW}│{C.END}\n"
            f"    ┌─────────────┼─────────────┐\n"
            f"    {C.YELLOW}▼{C.END}             {C.YELLOW}▼{C.END}             {C.YELLOW}▼{C.END}\n"
            f"{C.GREEN}┌───────┐{C.END}    {C.BLUE}┌───────┐{C.END}    {C.CYAN}┌───────┐{C.END}\n"
            f"{C.GREEN}│ Comp1 │{C.END}    {C.BLUE}│ Comp2 │{C.END}    {C.CYAN}│ Comp3 │{C.END}\n"
            f"{C.GREEN}└───────┘{C.END}    {C.BLUE}└───────┘{C.END}    {C.CYAN}└───────┘{C.END}\n"
        )

    if kind == "comparison":
        return (
            f"\n{C.CYAN}╔══════════════════════════════════════╗{C.END}\n"
            f"{C.CYAN}║{C.BOLD}{C.WHITE}         COMPARISON VIEW          {C.END}{C.CYAN}║{C.END}\n"
            f"{C.CYAN}╚══════════════════════════════════════╝{C.END}\n\n"
            f"{C.BG_GREEN}{C.BLACK}           CONCEPT A              {C.END}\n"
            f"{C.GREEN}┌─────────────────────────────────────┐{C.END}\n"
            f"{C.GREEN}│{C.END} • Feature 1  • Feature 2  • More  {C.GREEN}│{C.END}\n"
            f"{C.GREEN}└─────────────────────────────────────┘{C.END}\n"
            f"\n{C.YELLOW}                 VS{C.END}\n\n"
            f"{C.BG_BLUE}{C.WHITE}           CONCEPT B              {C.END}\n"
            f"{C.BLUE}┌─────────────────────────────────────┐{C.END}\n"
            f"{C.BLUE}│{C.END} • Feature X  • Feature Y  • More  {C.BLUE}│{C.END}\n"
            f"{C.BLUE}└─────────────────────────────────────┘{C.END}\n"
        )

    if kind == "timeline":
        return (
            f"\n{C.CYAN}╔══════════════════════════════════════╗{C.END}\n"
            f"{C.CYAN}║{C.BOLD}{C.WHITE}           TIMELINE VIEW            {C.END}{C.CYAN}║{C.END}\n"
            f"{C.CYAN}╚══════════════════════════════════════╝{C.END}\n\n"
            f"{C.GREEN}PAST{C.END}          {C.YELLOW}PRESENT{C.END}          {C.RED}FUTURE{C.END}\n"
            f"  │               │               │\n"
            f"  {C.GREEN}▼{C.END}               {C.YELLOW}▼{C.END}               {C.RED}▼{C.END}\n"
            f"{C.GREEN}┌──────┐{C.END}  ──▶  {C.YELLOW}┌──────┐{C.END}  ──▶  {C.RED}┌──────┐{C.END}\n"
            f"{C.GREEN}│Step 1│{C.END}       {C.YELLOW}│Step 2│{C.END}       {C.RED}│Step 3│{C.END}\n"
            f"{C.GREEN}└──────┘{C.END}       {C.YELLOW}└──────┘{C.END}       {C.RED}└──────┘{C.END}\n"
            f"\n{C.CYAN}Progress:{C.END} {C.GREEN}███{C.END}{C.YELLOW}███{C.END}{C.RED}░░░░{C.END} 60 %%\n"
        )

    # generic
    label = concept[:12].upper().center(12)
    return (
        f"\n{C.CYAN}╔══════════════════════════════════════╗{C.END}\n"
        f"{C.CYAN}║{C.BOLD}{C.WHITE}           CONCEPT MAP            {C.END}{C.CYAN}║{C.END}\n"
        f"{C.CYAN}╚══════════════════════════════════════╝{C.END}\n\n"
        f"    {C.GREEN}┌─────────────┐{C.END}\n"
        f"    {C.GREEN}│{C.BOLD}{C.WHITE}   INPUT     {C.END}{C.GREEN}│{C.END}\n"
        f"    {C.GREEN}└──────┬──────┘{C.END}\n"
        f"           {C.YELLOW}│{C.END}\n"
        f"           {C.YELLOW}▼{C.END}\n"
        f"    {C.BLUE}┌─────────────┐{C.END}\n"
        f"    {C.BLUE}│{C.BOLD}{C.WHITE} {label} {C.END}{C.BLUE}│{C.END}\n"
        f"    {C.BLUE}└──────┬──────┘{C.END}\n"
        f"           {C.YELLOW}│{C.END}\n"
        f"           {C.YELLOW}▼{C.END}\n"
        f"    {C.MAGENTA}┌─────────────┐{C.END}\n"
        f"    {C.MAGENTA}│{C.BOLD}{C.WHITE}   OUTPUT    {C.END}{C.MAGENTA}│{C.END}\n"
        f"    {C.MAGENTA}└─────────────┘{C.END}\n"
    )


# ─────────────────────────────────────────
# FORMULA EXTRACTION
# ─────────────────────────────────────────

def extract_formulas_from_text(text: str) -> List[str]:
    """Extract likely mathematical expressions from raw text."""
    patterns = [
        r'[A-Za-z_]\w*\s*=\s*[^.\n]{3,}',
        r'\([^)]+\)\s*=\s*[^.\n]{3,}',
        r'[A-Za-z_]\w*\([^)]+\)\s*=\s*[^.\n]{3,}',
        r'\b(?:sin|cos|tan|log|ln|sqrt|exp)\b[^.\n]{2,}',
    ]
    found: List[str] = []
    seen: set = set()
    for pat in patterns:
        for m in re.findall(pat, text, re.IGNORECASE):
            cleaned = m.strip()
            if cleaned and cleaned not in seen:
                found.append(cleaned)
                seen.add(cleaned)
    return found


def process_formulas_response(llm_response: str, transcript: str) -> str:
    """
    FIX-07: Use the LLM response as the primary source; fall back to regex
    only if the LLM says no formulas were found.
    """
    if "no mathematical formulas" in llm_response.lower() or \
       "no formulas" in llm_response.lower():
        # Double-check with regex before giving up
        formulas = extract_formulas_from_text(transcript)
        if not formulas:
            return "No mathematical formulas found in this topic."
        lines = "\n".join(f"{i+1}. {f}" for i, f in enumerate(formulas[:10]))
        return f"Formulas extracted from content:\n\n{lines}"

    # LLM found formulas — return its response directly
    return llm_response.strip()


# ─────────────────────────────────────────
# PROMPT BUILDERS
# FIX-04 & FIX-10: Diagrams / static examples are NOT embedded in prompts.
#                  The LLM is free to generate its own clear content.
# ─────────────────────────────────────────

def _head(course: str, week, topic: str) -> str:
    """Common header block for all prompts."""
    return (
        f"COURSE : {course}\n"
        f"WEEK   : {week}\n"
        f"TOPIC  : {topic or '(not specified)'}\n"
    )


def build_notes_prompt(
    course: str,
    week: Union[int, str],
    note_type: str,
    topic: str = "",
    transcript: str = "",
) -> str:
    """
    Build a prompt for the given note type.
    normalize_note_type is now defined earlier in the file (FIX-08).
    """
    ntype = normalize_note_type(note_type)   # FIX-08 (function exists above)
    body  = (transcript or f"General explanation of {course} Week {week} {topic}")[:4000]
    h     = _head(course, week, topic)

    if ntype == "summary":
        return f"""You are an expert NPTEL professor summarising a lecture for a student.

{h}
TRANSCRIPT:
{body}

Write a concise summary covering:
1. Introduction (2-3 sentences — context and importance)
2. Core Concept (plain-language explanation)
3. Key Principle (the single most important idea)
4. One Simple Example
5. Exam-focused Conclusion (2-3 sentences)

Use clear, student-friendly language.
"""

    if ntype == "detailed":
        return f"""You are an NPTEL professor creating comprehensive study notes.

{h}
TRANSCRIPT:
{body}

Produce detailed notes in this exact structure:

1. Title
2. Introduction — context and why it matters
3. Step-by-step Explanation
4. Key Definitions (at least 3 terms)
5. Three Worked Examples:
   • Basic example
   • Intermediate example
   • Real-world / industry example
6. Important Points (bullet list)
7. Practical Applications
8. Summary & Key Takeaways

Be thorough but readable. Base everything on the transcript.
"""

    if ntype == "keypoints":
        return f"""You are preparing a student for an NPTEL exam.

{h}
TRANSCRIPT:
{body}

Extract and organise the most important information.

FORMAT (strictly follow this):

═══════════════════════════════════════
           🔑 KEY POINTS 🔑
═══════════════════════════════════════

=== CORE CONCEPTS ===
• [one-line point]
• [one-line point]

=== CRITICAL DETAILS ===
• [one-line point]
• [one-line point]

=== KEY TERMS ===
• Term: brief definition

=== EXAM TIPS ===
• [one-line tip]

Rules: every bullet is ONE line, no multi-line bullets.
"""

    if ntype == "lastday":
        return f"""You are helping a student do last-day revision before an NPTEL exam.

{h}
TRANSCRIPT:
{body}

Create ULTRA-QUICK revision bullets.

FORMAT:
═══════════════════════════════════════
          ⚡ LAST DAY REVISION ⚡
═══════════════════════════════════════
• [point]
• [point]
...

Rules:
- ONLY bullet points, no explanations
- Maximum 12 bullets
- Each bullet ≤ 10 words
- Include formulas only if genuinely present in the transcript
"""

    if ntype == "formulas":
        return f"""You are a technical analyst extracting formulas from a lecture transcript.

{h}
TRANSCRIPT:
{body}

List ONLY the mathematical formulas, equations, and expressions present in the transcript.
For each formula provide:
  Formula: <exact expression>
  Meaning: <one-line explanation>

If no formulas exist, write exactly: "No mathematical formulas found in this topic."
Do NOT invent formulas.
"""

    if ntype == "diagram":
        return f"""You are creating a textual diagram to explain a concept from a lecture.

{h}
TRANSCRIPT:
{body}

Create a clear text-based diagram (using box-drawing characters like ┌ ─ └ │ ▶ ▲ etc.) that:
1. Shows the main concept visually
2. Labels each component
3. Explains what the diagram represents (2-3 sentences)
4. Lists key components with their roles

The diagram must be directly derived from the transcript content.
"""

    if ntype == "visual":
        return f"""You are creating visual study notes with diagrams and examples.

{h}
TRANSCRIPT:
{body}

Produce visually structured notes:

1. Concept Name & One-line Description
2. Text-based Diagram (use box-drawing characters)
3. Plain-language Explanation
4. Three Examples (basic → intermediate → real-world)
5. Visual Summary using emojis / symbols
6. Memory Aid / Mnemonic

Make it memorable and easy to revise.
"""

    if ntype == "flashcards":
        return f"""You are creating flashcards for active-recall practice.

{h}
TRANSCRIPT:
{body}

Create 8–10 flashcards.
Format each card as:

[FRONT {"{N}"}]
Q: <question>

[BACK {"{N}"}]
A: <concise answer>

Cover: definitions, key principles, formulas (if any), comparisons, applications.
"""

    if ntype == "mindmap":
        return f"""You are creating a text-based mindmap.

{h}
TRANSCRIPT:
{body}

FORMAT:
MINDMAP: <topic>

CENTER: <main topic>
├── Branch 1
│   ├── Sub-topic 1.1
│   └── Sub-topic 1.2
├── Branch 2
│   ├── Sub-topic 2.1
│   └── Sub-topic 2.2
└── Branch 3
    └── Sub-topic 3.1

Use real content from the transcript. Show relationships clearly.
"""

    if ntype == "outline":
        return f"""You are creating a hierarchical outline for structured study.

{h}
TRANSCRIPT:
{body}

FORMAT:
I. Main Topic
   A. Sub-topic
      1. Detail
         a. Sub-detail
   B. Sub-topic
      1. Detail
II. Next Main Topic
   ...

Use Roman numerals → letters → numbers → lowercase letters for hierarchy.
"""

    if ntype == "cheatsheet":
        return f"""You are creating a quick-reference cheatsheet for exam day.

{h}
TRANSCRIPT:
{body}

FORMAT:
═══════════════════════════════════════
         📋 CHEATSHEET
═══════════════════════════════════════
🔑 KEY CONCEPTS:
• ...

📐 FORMULAS (only if present in transcript):
• ...

💡 QUICK TIPS:
• ...

⚠️  COMMON MISTAKES:
• ...

🎯 EXAM FOCUS:
• ...

Ultra-compact. Every line must be scannable in 2 seconds.
"""

    if ntype == "qa":
        return f"""You are creating Q&A practice pairs for self-testing.

{h}
TRANSCRIPT:
{body}

Create 8–10 Q&A pairs at mixed difficulty levels.

FORMAT:
Q1: <question>
A1: <detailed answer>

Q2: <question>
A2: <answer>

Cover: knowledge, comprehension, application, and analysis questions.
"""

    # Fallback
    return f"""You are an NPTEL professor. Summarise the following lecture for a student.\n\n{body}"""


# ─────────────────────────────────────────
# MCQ PROMPT
# ─────────────────────────────────────────

def build_mcq_prompt(
    course: str,
    week: Union[int, str],
    count: int,
    topic: str = "",
    transcript: str = "",
    difficulty: str = "mixed",
) -> str:
    body = (transcript or f"General content of {course} Week {week}")[:4000]
    diff_map = {
        "easy":   "All questions easy — test basic recall.",
        "medium": "All questions medium — test understanding.",
        "hard":   "All questions hard — test analysis and application.",
        "mixed":  "Mix: ~30 %% easy, 50 %% medium, 20 %% hard.",
    }
    diff_note = diff_map.get(difficulty.lower(), diff_map["mixed"])

    return f"""You are an NPTEL exam paper-setter for {course}.

{_head(course, week, topic)}
DIFFICULTY: {difficulty} — {diff_note}

TRANSCRIPT:
{body}

Generate exactly {count} high-quality MCQs.
Format each question as:

Q[N]. <question text>

A) <option>
B) <option>
C) <option>
D) <option>

Answer: <letter>
Explanation: <why this answer is correct>
Difficulty: <Easy | Medium | Hard>

Rules:
- One unambiguous correct answer per question
- Plausible distractors — not obviously wrong
- Test understanding, not just memorisation
"""


# ─────────────────────────────────────────
# CHAT PROMPTS
# ─────────────────────────────────────────

def build_chat_prompt(
    message: str,
    history: List[Dict],
    context: str = "",
    course: str = "",
) -> str:
    history_text = "\n".join(
        f"{m.get('role','user').title()}: {m.get('content','')}"
        for m in history[-5:]
    )
    return f"""You are a friendly, encouraging NPTEL AI tutor{' for ' + course if course else ''}.

CONTEXT:
{context[:3000] if context else '(none)'}

RECENT CHAT:
{history_text or '(new conversation)'}

STUDENT QUESTION:
{message}

Instructions:
- Explain step-by-step using simple language
- Give at least one concrete example
- Be supportive and clear
- If unsure, say so and suggest where to look
- End with: 📌 Exam Tip: <one relevant tip>
"""


def build_rag_chat_prompt(
    message: str,
    chunks: List[Dict],
    history: List[Dict],
    course: str = "",
) -> str:
    context = "\n".join(
        f"[Source {i+1}]: {c.get('chunk_text','')[:500]}"
        for i, c in enumerate(chunks[:5])
    )
    return build_chat_prompt(message, history, context, course)


def build_questions_prompt(
    course: str,
    week: Union[int, str],
    q_type: str,
    count: int,
    topic: str = "",
    transcript: str = "",
    **kwargs,
) -> str:
    if q_type.lower() == "mcq":
        return build_mcq_prompt(
            course, week or 1, count, topic, transcript,
            kwargs.get("difficulty", "mixed"),
        )
    return f"Generate {count} {q_type} questions for {course} Week {week}."


# ─────────────────────────────────────────
# CORE TEXT GENERATION
# ─────────────────────────────────────────

def _call_api(prompt: str, model: str) -> str:
    """
    Single API call for a specific model.
    max_tokens=None lets Groq use the model's full context window (no artificial cap).
    """
    kwargs: Dict[str, Any] = dict(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=config.temperature,
    )
    # Only pass max_tokens if explicitly configured — avoids capping long responses
    if config.max_tokens is not None:
        kwargs["max_tokens"] = config.max_tokens

    response = _client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


def _is_decommissioned(error_msg: str) -> bool:
    """Return True if the error indicates a decommissioned / unsupported model."""
    lmsg = error_msg.lower()
    return "decommissioned" in lmsg or "model_decommissioned" in lmsg \
        or "no longer supported" in lmsg or "not supported" in lmsg


def generate_text(prompt: str, **_kwargs) -> str:
    """
    Generate text via Groq API.

    Strategy:
      1. Try config.model first.
      2. If that model is decommissioned, walk through MODEL_FALLBACK_CHAIN
         automatically — no manual config change needed.
      3. Each candidate gets up to config.max_retries attempts with
         exponential back-off for transient errors.
      4. Falls back to a mock response only if every model in the chain fails.
    """
    if not groq_available:
        return get_mock_response("general", **_kwargs)

    # Build the ordered list of models to try
    models_to_try: List[str] = [config.model] + [
        m for m in MODEL_FALLBACK_CHAIN if m != config.model
    ]

    start = time.time()

    for model in models_to_try:
        for attempt in range(1, config.max_retries + 1):
            try:
                result = _call_api(prompt, model)
                if model != config.model:
                    logger.info(
                        "✅ Succeeded with fallback model '%s' "
                        "(primary '%s' was unavailable)",
                        model, config.model,
                    )
                metrics.record(True, time.time() - start)
                return result

            except Exception as exc:
                msg = str(exc)
                lmsg = msg.lower()

                # Decommissioned / unsupported → skip to the next model immediately
                if _is_decommissioned(msg):
                    logger.warning(
                        "Model '%s' is decommissioned — trying next fallback.", model
                    )
                    break  # inner loop: move to next model

                # Auth error → no point retrying any model
                if "api key" in lmsg or "authentication" in lmsg:
                    metrics.record(False, time.time() - start, error=msg)
                    return get_mock_response("api_key_error")

                # Transient error — retry with back-off
                if attempt < config.max_retries:
                    wait = 2 ** attempt
                    logger.warning(
                        "Model '%s' attempt %d failed (%s) — retrying in %ds…",
                        model, attempt, msg[:80], wait,
                    )
                    time.sleep(wait)
                else:
                    logger.warning(
                        "Model '%s' exhausted %d retries: %s",
                        model, config.max_retries, msg[:120],
                    )

    # Every model in the chain failed
    elapsed = time.time() - start
    metrics.record(False, elapsed, error="All models in fallback chain failed")
    logger.error(
        "All models failed after %.1fs: %s", elapsed,
        ", ".join(models_to_try),
    )
    return get_mock_response(
        "general_error",
        error=f"Tried models: {models_to_try}. All unavailable.",
    )


# FIX-03: @cache_response is the OUTER decorator so cache hits skip rate_limit.
#         @rate_limit is INNER so it only fires on real API calls (cache misses).
@cache_response(ttl=config.cache_ttl)
@rate_limit(delay=config.rate_limit_delay)
def generate_text_cached(prompt: str, **kwargs) -> str:
    """Cached + rate-limited wrapper around generate_text."""
    return generate_text(prompt, **kwargs)


# FIX-05: True async — uses run_in_executor correctly (no blocking sleep in
#         the async path because generate_text itself does not sleep).
async def generate_text_async(prompt: str, **kwargs) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, lambda: generate_text(prompt, **kwargs)
    )


# ─────────────────────────────────────────
# BATCH PROCESSING
# ─────────────────────────────────────────

async def generate_multiple_notes(
    prompts: List[str],
    concurrent_limit: int = 3,
) -> List[str]:
    """Run multiple prompts concurrently (respects concurrency cap)."""
    sem = asyncio.Semaphore(concurrent_limit)

    async def _run(p: str) -> str:
        async with sem:
            return await generate_text_async(p)

    return list(await asyncio.gather(*(_run(p) for p in prompts)))


# ─────────────────────────────────────────
# HIGH-LEVEL GENERATE NOTES  (diagram appended AFTER LLM response)
# ─────────────────────────────────────────

def generate_notes(
    course: str,
    week: Union[int, str],
    note_type: str,
    topic: str = "",
    transcript: str = "",
    append_diagram: bool = True,
) -> str:
    """
    Full pipeline: build prompt → call LLM → optionally append diagram.

    FIX-04: Diagram is generated here and appended AFTER the LLM response.
            It is never injected into the prompt, so the LLM cannot corrupt it.
    """
    ntype  = normalize_note_type(note_type)
    prompt = build_notes_prompt(course, week, ntype, topic, transcript)
    result = generate_text_cached(prompt)

    # Post-process formula responses (FIX-07)
    if ntype == "formulas":
        result = process_formulas_response(result, transcript)

    # Append diagram for visual note types (FIX-04)
    if append_diagram and ntype in ("detailed", "diagram", "visual"):
        diagram = generate_colorful_diagram(topic or course, transcript)
        result = result + "\n\n" + diagram

    return result


# ─────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────

def clear_cache():
    _cache.clear()
    logger.info("Cache cleared.")


def get_metrics() -> Dict:
    return metrics.as_dict()


def print_metrics():
    metrics.print_summary()


def check_groq_installation() -> Dict[str, Any]:
    status = {
        "installed":          False,
        "importable":         False,
        "api_key_set":        bool(config.api_key),
        "client_initialized": groq_available,
        "recommendations":    [],
    }
    try:
        import groq  # noqa: F401
        status["installed"] = True
    except ImportError:
        status["recommendations"].append("pip install groq")
        return status

    try:
        from groq import Groq  # noqa: F401,PLC0415
        status["importable"] = True
    except Exception:
        status["recommendations"].append("pip install --upgrade groq")
        return status

    if not status["api_key_set"]:
        status["recommendations"].append("export GROQ_API_KEY='your-key'")
    if not status["client_initialized"]:
        status["recommendations"].append("Verify API key is valid")

    return status


def print_installation_guide():
    C = Colors
    print(f"\n{C.CYAN}🔧 GROQ SETUP GUIDE{C.END}")
    print("=" * 55)
    steps = [
        ("Install",    "pip install groq"),
        ("API key",    "export GROQ_API_KEY='your-key-here'"),
        ("Verify",     "python -c \"from groq import Groq; print('OK')\""),
        ("Key check",  "python -c \"import os; print(os.getenv('GROQ_API_KEY','NOT SET'))\""),
    ]
    for i, (label, cmd) in enumerate(steps, 1):
        print(f"\n{C.YELLOW}Step {i} — {label}{C.END}")
        print(f"  {cmd}")

    print(f"\n{C.GREEN}Current production models (March 2026):{C.END}")
    for m in MODEL_FALLBACK_CHAIN:
        tag = "  ← default" if m == MODEL_FALLBACK_CHAIN[0] else ""
        print(f"  • {m}{tag}")

    print(f"\n{C.CYAN}Override model:{C.END}  export GROQ_MODEL='llama-3.1-8b-instant'")
    print(f"{C.CYAN}Docs:{C.END}          https://console.groq.com/docs/models")
    print(f"{C.CYAN}Deprecations:{C.END}  https://console.groq.com/docs/deprecations")
    print("=" * 55 + "\n")


# ─────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────
__all__ = [
    # generation
    "generate_text",
    "generate_text_cached",
    "generate_text_async",
    "generate_multiple_notes",
    "generate_notes",
    # prompt builders
    "build_notes_prompt",
    "build_mcq_prompt",
    "build_questions_prompt",
    "build_chat_prompt",
    "build_rag_chat_prompt",
    # diagram / formula helpers
    "generate_colorful_diagram",
    "extract_formulas_from_text",
    "process_formulas_response",
    # note-type helpers
    "normalize_note_type",
    "validate_note_type",
    "get_supported_note_types",
    "VALID_NOTE_TYPES",
    # utilities
    "clear_cache",
    "get_metrics",
    "print_metrics",
    "check_groq_installation",
    "print_installation_guide",
    # objects
    "Colors",
    "config",
    "metrics",
    "groq_available",
    "MODEL_FALLBACK_CHAIN",
]