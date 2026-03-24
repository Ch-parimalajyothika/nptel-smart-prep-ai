"""
utils/pdf_generator.py — Generate professional PDF from Markdown notes.
Uses ReportLab for layout. Parses simple Markdown headings + bullets.
"""
import io
import re
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles    import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units     import cm
    from reportlab.lib           import colors
    from reportlab.platypus      import (SimpleDocTemplate, Paragraph, Spacer,
                                         HRFlowable, ListFlowable, ListItem,
                                         KeepTogether, Table, TableStyle)
    from reportlab.lib.enums     import TA_LEFT, TA_CENTER, TA_JUSTIFY
    REPORTLAB_OK = True
except ImportError:
    REPORTLAB_OK = False


# ─── Colour palette ───────────────────────────────────
TEAL       = colors.HexColor("#14b896")
DARK       = colors.HexColor("#0f172a")
MID        = colors.HexColor("#475569")
LIGHT_BG   = colors.HexColor("#f0fdf9")
BORDER     = colors.HexColor("#e2e8f0")


def _styles():
    base = getSampleStyleSheet()

    def add(name, **kw):
        base.add(ParagraphStyle(name=name, **kw))

    add("NPTELTitle",
        fontName="Helvetica-Bold", fontSize=22, textColor=DARK,
        spaceAfter=6, leading=28)
    add("NPTELSubtitle",
        fontName="Helvetica", fontSize=11, textColor=MID,
        spaceAfter=12, leading=16)
    add("NPTELH1",
        fontName="Helvetica-Bold", fontSize=16, textColor=TEAL,
        spaceBefore=14, spaceAfter=6, leading=20,
        borderPad=4)
    add("NPTELH2",
        fontName="Helvetica-Bold", fontSize=13, textColor=DARK,
        spaceBefore=10, spaceAfter=4, leading=17)
    add("NPTELH3",
        fontName="Helvetica-BoldOblique", fontSize=11, textColor=MID,
        spaceBefore=8, spaceAfter=2, leading=15)
    add("NPTELBody",
        fontName="Helvetica", fontSize=10, textColor=DARK,
        spaceAfter=4, leading=15, alignment=TA_JUSTIFY)
    add("NPTELBullet",
        fontName="Helvetica", fontSize=10, textColor=DARK,
        spaceAfter=2, leading=14, leftIndent=16, bulletIndent=6)
    add("NPTELCode",
        fontName="Courier", fontSize=9, textColor=colors.HexColor("#0d9478"),
        backColor=colors.HexColor("#f0fdf9"), leftIndent=12,
        spaceAfter=4, leading=13, borderColor=TEAL, borderWidth=0.5,
        borderPad=6, borderRadius=4)
    add("NPTELBold",
        fontName="Helvetica-Bold", fontSize=10, textColor=DARK,
        spaceAfter=4, leading=15)
    add("NPTELDisclaimer",
        fontName="Helvetica-Oblique", fontSize=8, textColor=MID,
        spaceAfter=2, leading=11)
    return base


def markdown_to_flowables(md_text: str, styles):
    """Convert simple Markdown to ReportLab flowables."""
    flowables  = []
    lines      = md_text.split("\n")
    in_code    = False
    code_lines = []

    def flush_code():
        nonlocal code_lines
        if code_lines:
            code_str = "\n".join(code_lines)
            # Escape XML special chars
            code_str = code_str.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            flowables.append(Paragraph(code_str.replace("\n", "<br/>"), styles["NPTELCode"]))
            flowables.append(Spacer(1, 4))
            code_lines = []

    for line in lines:
        # ── Code blocks ─────────────────────────────
        if line.strip().startswith("```"):
            if in_code:
                flush_code()
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        stripped = line.strip()

        # ── Headings ─────────────────────────────────
        if stripped.startswith("### "):
            txt = stripped[4:]
            flowables.append(Paragraph(_escape(txt), styles["NPTELH3"]))
        elif stripped.startswith("## "):
            txt = stripped[3:]
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4))
            flowables.append(Paragraph(_escape(txt), styles["NPTELH2"]))
        elif stripped.startswith("# "):
            txt = stripped[2:]
            flowables.append(Paragraph(_escape(txt), styles["NPTELH1"]))

        # ── Horizontal rule ───────────────────────────
        elif stripped.startswith("---"):
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=BORDER,
                                        spaceBefore=4, spaceAfter=4))

        # ── Bullet points ────────────────────────────
        elif stripped.startswith("- ") or stripped.startswith("* "):
            txt = stripped[2:]
            txt = _inline_format(txt)
            flowables.append(Paragraph(f"• {txt}", styles["NPTELBullet"]))

        # ── Numbered list ────────────────────────────
        elif re.match(r"^\d+\.\s", stripped):
            txt = re.sub(r"^\d+\.\s", "", stripped)
            txt = _inline_format(txt)
            flowables.append(Paragraph(f"&nbsp;&nbsp;{txt}", styles["NPTELBody"]))

        # ── Empty line ───────────────────────────────
        elif stripped == "":
            flowables.append(Spacer(1, 6))

        # ── Normal paragraph ─────────────────────────
        else:
            txt = _inline_format(stripped)
            if txt:
                flowables.append(Paragraph(txt, styles["NPTELBody"]))

    flush_code()
    return flowables


def _escape(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def _inline_format(text):
    """Handle inline **bold**, *italic*, `code`."""
    text = _escape(text)
    # Bold
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    # Italic
    text = re.sub(r"\*(.+?)\*",     r"<i>\1</i>", text)
    # Inline code
    text = re.sub(r"`(.+?)`",
                  r'<font name="Courier" color="#0d9478">\1</font>', text)
    return text


def generate_pdf(content: str, title: str, course: str, week: int,
                 note_type: str = "Notes") -> bytes:
    """
    Generate a PDF from Markdown content.
    Returns bytes of the PDF file.
    """
    if not REPORTLAB_OK:
        raise RuntimeError("reportlab not installed — run: pip install reportlab Pillow")

    buf    = io.BytesIO()
    styles = _styles()

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2.5*cm, bottomMargin=2.5*cm,
        title=f"{title} — {course}",
        author="NPTEL Smart Prep AI",
    )

    story = []

    # ── Cover block ───────────────────────────────────
    story.append(Paragraph(f"NPTEL Smart Prep AI", styles["NPTELSubtitle"]))
    story.append(Paragraph(_escape(title), styles["NPTELTitle"]))
    story.append(Paragraph(
        f"<font color='#14b896'>{_escape(course)}</font> &nbsp;|&nbsp; Week {week} &nbsp;|&nbsp; {note_type.title()}",
        styles["NPTELSubtitle"]
    ))
    story.append(HRFlowable(width="100%", thickness=2, color=TEAL, spaceBefore=6, spaceAfter=16))

    # ── Main content ──────────────────────────────────
    story.extend(markdown_to_flowables(content, styles))

    # ── Footer disclaimer ─────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Generated by NPTEL Smart Prep AI on {datetime.now().strftime('%B %d, %Y')}",
        styles["NPTELDisclaimer"]
    ))
    story.append(Paragraph(
        "⚠️ Disclaimer: This document is for educational purposes only. "
        "Original course content belongs to NPTEL / IITs. "
        "This AI-generated summary does not replace official course material.",
        styles["NPTELDisclaimer"]
    ))

    doc.build(story)
    return buf.getvalue()
