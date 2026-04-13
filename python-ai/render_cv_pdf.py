"""
CV PDF Renderer — converts Markdown CV content to styled PDF.
Uses Jinja2 for HTML templates and xhtml2pdf for PDF conversion.

Usage:
    echo '{"content": "...", "format": "standard", "photoUrl": "..."}' | python render_cv_pdf.py

Output: raw PDF bytes on stdout (binary mode).
Errors: JSON on stderr.
"""

import sys
import json
import io
import re
import os
import base64
import mimetypes
from pathlib import Path
from urllib.request import pathname2url

from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup
from xhtml2pdf import pisa
from reportlab.lib.fonts import addMapping
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


SCRIPT_DIR = Path(__file__).parent
TEMPLATE_DIR = SCRIPT_DIR / "templates"
FONTS_DIR = SCRIPT_DIR / "fonts"

# Register Computer Modern font for LaTeX-style PDFs
try:
    pdfmetrics.registerFont(TTFont("CMUSerif", str(FONTS_DIR / "cmunrm.ttf")))
    pdfmetrics.registerFont(TTFont("CMUSerif-Bold", str(FONTS_DIR / "cmunbx.ttf")))
    pdfmetrics.registerFont(TTFont("CMUSerif-Italic", str(FONTS_DIR / "cmunti.ttf")))
    pdfmetrics.registerFont(TTFont("CMUSerif-BoldItalic", str(FONTS_DIR / "cmunbi.ttf")))
    addMapping("CMUSerif", 0, 0, "CMUSerif")
    addMapping("CMUSerif", 1, 0, "CMUSerif-Bold")
    addMapping("CMUSerif", 0, 1, "CMUSerif-Italic")
    addMapping("CMUSerif", 1, 1, "CMUSerif-BoldItalic")
except Exception:
    pass  # Fonts not available, fallback to Times New Roman


def parse_markdown_to_sections(content: str) -> dict:
    """Parse markdown CV content into structured sections."""
    result = {
        "name": "",
        "title": "",
        "contact": "",
        "summary": "",
        "experience": [],
        "education": [],
        "skills": [],
        "projects": [],
        "languages": [],
        "interests": [],
        "certifications": [],
        "publications": [],
        "extra_sections": {},
    }

    # Detect SIDEBAR/CORPS format (used by european AI-generated CVs)
    if "---SIDEBAR---" in content or "---CORPS---" in content:
        # Pre-initialize contact_info for sidebar parsing
        result["contact_info"] = {"email": "", "phone": "", "location": "", "website": "", "linkedin": ""}
        _parse_sidebar_corps(content, result)
    else:
        _parse_standard_markdown(content, result)

    # Extract contact from content if not found
    if not result["contact"]:
        contact_lines = [l for l in content.split("\n") if "@" in l or "+" in l or "http" in l]
        result["contact"] = "\n".join(contact_lines[:3])

    # Parse contact into structured data (only if not already set by sidebar parser)
    if "contact_info" not in result or not result["contact_info"].get("email"):
        result["contact_info"] = _parse_contact(result["contact"])

    return result


def _parse_sidebar_corps(content: str, result: dict):
    """Parse SIDEBAR/CORPS format used by European AI-generated CVs."""
    # Split into sidebar and corps parts
    sidebar_text = ""
    corps_text = ""

    # Find the markers (they may be wrapped in #, **, or other markdown)
    # Use [^\n]* instead of \s* at the end to avoid matching across lines
    sidebar_marker = re.search(r"[#*-]*\s*---SIDEBAR---[^\n]*", content)
    corps_marker = re.search(r"[#*-]*\s*---CORPS---[^\n]*", content)

    if sidebar_marker and corps_marker:
        sidebar_text = content[sidebar_marker.end():corps_marker.start()]
        corps_text = content[corps_marker.end():]
    elif corps_marker:
        corps_text = content[corps_marker.end():]
    else:
        corps_text = content

    # ── Parse sidebar (contact, skills, languages, interests) ──
    if sidebar_text:
        _parse_sidebar(sidebar_text, result)

    # ── Extract name from before SIDEBAR marker (# Name at the beginning) ──
    if sidebar_marker:
        pre_sidebar = content[:sidebar_marker.start()].strip()
        if pre_sidebar:
            for pre_line in pre_sidebar.split("\n"):
                pre_line = pre_line.strip()
                if pre_line.startswith("# ") and not pre_line.startswith("## "):
                    result["name"] = re.sub(r"\*+", "", pre_line[2:]).strip()
                    break

    # ── Parse CORPS sections (# headers = sections, not name) ──
    if corps_text:
        _parse_corps(corps_text, result)


def _parse_sidebar(text: str, result: dict):
    """Parse sidebar content for contact, skills, languages, interests."""
    lines = text.split("\n")
    current_block = ""
    buffer = []

    for line in lines:
        # Strip list markers (* or -) but preserve **bold** markers
        trimmed = line.strip()
        trimmed = re.sub(r"^(?:[*-]\s+)+", "", trimmed).strip()

        # Detect ### or ## section headers (e.g., ### Compétences)
        header_match = re.match(r"^#{2,4}\s+(.+)$", trimmed)
        if header_match:
            label = re.sub(r"\*+", "", header_match.group(1)).strip().lower()
            # Save previous block
            if current_block and buffer:
                _save_sidebar_block(current_block, buffer, result)
                buffer = []
            if any(k in label for k in ["contact"]):
                current_block = "contact"
            elif any(k in label for k in ["compétence", "competence", "skill"]):
                current_block = "skills"
            elif any(k in label for k in ["langue", "language"]):
                current_block = "languages"
            elif any(k in label for k in ["intérêt", "interet", "centre", "loisir", "hobby"]):
                current_block = "interests"
            else:
                current_block = label
            continue

        # Detect bold section labels like **Contact**, **Compétences**, etc.
        bold_match = re.match(r"\*\*(.+?)\*\*", trimmed)
        if bold_match:
            label = bold_match.group(1).lower()
            # Save previous block
            if current_block and buffer:
                _save_sidebar_block(current_block, buffer, result)
                buffer = []
            if any(k in label for k in ["contact"]):
                current_block = "contact"
            elif any(k in label for k in ["compétence", "competence", "skill"]):
                current_block = "skills"
            elif any(k in label for k in ["langue", "language"]):
                current_block = "languages"
            elif any(k in label for k in ["intérêt", "interet", "centre", "loisir", "hobby"]):
                current_block = "interests"
            else:
                current_block = label
            # Check if there's content after the bold label on the same line
            rest = trimmed[bold_match.end():].strip()
            if rest:
                buffer.append(rest)
            continue

        if trimmed and not trimmed.startswith("![") and not re.match(r"^\[Photo", trimmed):
            buffer.append(trimmed)
        else:
            # Try to extract name from photo: ![Photo de Name](...) or [Photo de Name](...)
            alt_match = re.match(r"!?\[(?:Photo\s+de\s+)?(.+?)\]\(", trimmed)
            if alt_match and not result["name"]:
                name = alt_match.group(1).strip()
                if name.lower() not in ("photo", "profile", "profil"):
                    result["name"] = name

    # Save last block
    if current_block and buffer:
        _save_sidebar_block(current_block, buffer, result)


def _save_sidebar_block(block: str, buffer: list, result: dict):
    """Save a parsed sidebar block into result."""
    text = "\n".join(buffer)

    if block == "contact":
        # Extract contact details from sidebar list items
        contact_parts = []
        for line in buffer:
            clean = re.sub(r"\*+|_+", "", line).strip()
            clean = re.sub(r"^(?:[*-]\s+)+", "", clean).strip()
            clean = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", clean)  # [text](url) -> text
            clean = re.sub(r"\\?\[", "", clean)  # remove stray [ or \[
            if not clean:
                continue
            # Remove label prefixes like "Email :", "Téléphone :", etc.
            if ":" in clean:
                parts = clean.split(":", 1)
                label_lower = parts[0].strip().lower()
                value = parts[1].strip()
                if any(k in label_lower for k in ["email", "mail", "courriel"]):
                    email_match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", value or clean)
                    if email_match:
                        result["contact_info"]["email"] = email_match.group()
                    contact_parts.append(clean)
                elif any(k in label_lower for k in ["téléphone", "telephone", "tel", "phone", "mobile"]):
                    result["contact_info"]["phone"] = re.sub(r"[^\d+\s()-]", "", value).strip()
                    contact_parts.append(clean)
                elif any(k in label_lower for k in ["site", "web", "portfolio"]):
                    url_match = re.search(r"https?://\S+", value or clean)
                    result["contact_info"]["website"] = url_match.group() if url_match else value
                    contact_parts.append(clean)
                elif any(k in label_lower for k in ["linkedin"]):
                    url_match = re.search(r"https?://\S+", value or clean)
                    result["contact_info"]["linkedin"] = url_match.group() if url_match else value
                    contact_parts.append(clean)
                elif any(k in label_lower for k in ["adresse", "ville", "location", "lieu"]):
                    result["contact_info"]["location"] = value
                    contact_parts.append(clean)
                else:
                    contact_parts.append(clean)
            else:
                contact_parts.append(clean)
        result["contact"] = " | ".join(contact_parts)

    elif block == "skills":
        # Parse skills - handle markdown table format and list format
        for line in buffer:
            clean = re.sub(r"\*+|_+", "", line).strip()
            clean = re.sub(r"^(?:[*-]\s+)+", "", clean).strip()
            # Skip table headers, separators, and sub-headers (#### ...)
            if not clean or clean.startswith("|--") or clean.startswith("|-"):
                continue
            if re.match(r"^#{2,4}\s+", clean):
                continue
            # Skip header rows containing column labels
            lower_clean = clean.lower()
            if any(k in lower_clean for k in ["| niveau", "| compétence", "| competence",
                                                "| skill", "| barre"]):
                # Check if it's a header row (has multiple pipes and generic labels)
                if lower_clean.count("|") >= 2 and any(k in lower_clean for k in ["niveau", "compétence", "competence"]):
                    continue
            # Markdown table row: | Value1 | Value2 | Value3 | (3-col: level | skill | level)
            three_col = re.match(r"\|?\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|?\s*$", clean)
            if three_col:
                col1 = three_col.group(1).strip()
                col2 = three_col.group(2).strip()
                col3 = three_col.group(3).strip()
                # Filter separator rows
                if re.match(r"^[-\s]+$", col1) or re.match(r"^[-\s]+$", col2):
                    continue
                # Determine which column is the skill name (the longest text or the one that's not a level)
                level_words = ["expert", "avancé", "avance", "intermédiaire", "intermediaire",
                               "débutant", "debutant", "natif", "courant", "basique",
                               "advanced", "intermediate", "beginner"]
                c1_is_level = any(k in col1.lower() for k in level_words)
                c3_is_level = any(k in col3.lower() for k in level_words)
                if c1_is_level:
                    name, level = col2, col1
                elif c3_is_level:
                    name, level = col2, col3
                else:
                    name, level = col1, col2
                if not name or not re.search(r"[a-zA-ZÀ-ÿ]", name):
                    continue
                # Check if language
                lang_lower = name.lower()
                if any(k in lang_lower for k in ["français", "anglais", "arabe", "espagnol",
                    "italien", "allemand", "french", "english", "arabic", "spanish", "italian", "german"]):
                    result["languages"].append({"name": name, "level": level})
                else:
                    result["skills"].append({"name": name, "category": "", "level": level})
                continue
            # 2-column table: | Skill | Level |
            table_match = re.match(r"\|?\s*(.+?)\s*\|\s*(.+?)\s*\|?$", clean)
            if table_match:
                name = table_match.group(1).strip()
                level = table_match.group(2).strip()
                if not name or re.match(r"^[\s|*-]*$", name) or not re.search(r"[a-zA-ZÀ-ÿ]", name):
                    continue
                if not level or re.match(r"^[\s|*-]*$", level):
                    continue
                lang_lower = name.lower()
                if any(k in lang_lower for k in ["langue", "français", "anglais", "arabe", "espagnol",
                    "italien", "allemand", "french", "english", "arabic", "spanish", "italian", "german"]):
                    result["languages"].append({"name": name, "level": level})
                else:
                    result["skills"].append({"name": name, "category": "", "level": level})
                continue
            # "Skill : Level" or "Skill (Level)"
            match = re.match(r"(.+?)\s*[:\-(]\s*(.+?)\)?\s*$", clean)
            if match:
                result["skills"].append({"name": match.group(1).strip(), "category": "", "level": match.group(2).strip()})
            elif clean and re.search(r"[a-zA-ZÀ-ÿ]", clean):
                result["skills"].append({"name": clean, "category": "", "level": ""})

    elif block == "languages":
        level_words = {"expert", "avancé", "avance", "intermédiaire", "intermediaire",
                       "débutant", "debutant", "natif", "courant", "bilingue",
                       "professionnel", "scolaire", "notions", "basique",
                       "native", "fluent", "advanced", "intermediate", "beginner", "basic"}
        for line in buffer:
            clean = re.sub(r"\*+|_+", "", line).strip()
            clean = re.sub(r"^(?:[*-]\s+)+", "", clean).strip()
            if not clean:
                continue
            # Skip table header separators and column label rows
            if re.match(r"^[\s|:-]+$", clean):
                continue
            lower_clean = clean.lower()
            if any(k in lower_clean for k in ["niveau", "langue", "language", "level"]):
                if lower_clean.count("|") >= 2:
                    continue
            # Skip sub-headers (#### ...)
            if re.match(r"^#{2,4}\s+", clean):
                continue
            # 3-column table: | Level | Language | Level | (AI European format)
            three_col = re.match(r"\|?\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|?$", clean)
            if three_col:
                col1, col2, col3 = [c.strip() for c in three_col.groups()]
                if col1.startswith("--") or col2.startswith("--") or col3.startswith("--"):
                    continue
                # Detect which column is the level vs the language name
                c1_is_level = col1.lower() in level_words
                c3_is_level = col3.lower() in level_words
                if c1_is_level:
                    name, level = col2, col1
                elif c3_is_level:
                    name, level = col2, col3
                else:
                    name, level = col1, col2
                if name and re.search(r"[a-zA-ZÀ-ÿ]", name):
                    result["languages"].append({"name": name, "level": level})
                continue
            # 2-column table: | Language | Level |
            table_match = re.match(r"\|?\s*(.+?)\s*\|\s*(.+?)\s*\|?$", clean)
            if table_match:
                name = table_match.group(1).strip()
                level = table_match.group(2).strip()
                if name and not name.startswith("--"):
                    result["languages"].append({"name": name, "level": level})
                continue
            match = re.match(r"(.+?)\s*[:\-(]\s*(.+?)\)?\s*$", clean)
            if match:
                result["languages"].append({"name": match.group(1).strip(), "level": match.group(2).strip()})
            else:
                result["languages"].append({"name": clean, "level": ""})

    elif block == "interests":
        for line in buffer:
            clean = re.sub(r"\*+|_+", "", line).strip()
            clean = re.sub(r"^(?:[*-]\s+)+", "", clean).strip()
            if clean and not re.match(r"^[-=*_\s]+$", clean):
                result["interests"].append(clean)


def _parse_corps(text: str, result: dict):
    """Parse CORPS section where #/##/### is used for section headers."""
    lines = text.split("\n")
    current_section = ""
    buffer = []

    for line in lines:
        trimmed = line.strip()

        # #### Entry header — convert to ### for entry parsers
        if trimmed.startswith("#### "):
            buffer.append("### " + re.sub(r"\*+", "", trimmed[5:]).strip())
            continue

        # #, ##, or ### Header = section header (in CORPS, all are sections, NOT name)
        header_match = re.match(r"^#{1,3}\s+(.+)$", trimmed)
        if header_match:
            section_name = re.sub(r"\*+", "", header_match.group(1)).strip().lower()
            classified = _classify_section(section_name)
            # Only treat as section if it matches a known section keyword
            if classified != section_name:
                # Save previous section
                if current_section and buffer:
                    _save_section(current_section, buffer, result)
                buffer = []
                current_section = classified
            else:
                # Unknown header — if no name yet, use as name
                if not result["name"]:
                    result["name"] = re.sub(r"\*+", "", header_match.group(1)).strip()
                elif not result["title"]:
                    result["title"] = re.sub(r"\*+", "", header_match.group(1)).strip()
                else:
                    # Unknown section
                    if current_section and buffer:
                        _save_section(current_section, buffer, result)
                    buffer = []
                    current_section = classified
            continue

        if trimmed:
            buffer.append(trimmed)

    # Save last section
    if current_section and buffer:
        _save_section(current_section, buffer, result)


def _is_section_keyword(text: str) -> bool:
    """Check if text matches a known CV section keyword (not a person's name)."""
    lower = text.lower().strip()
    section_keywords = [
        "résumé", "resume", "profil", "summary", "objectif",
        "expérience", "experience", "emploi", "parcours",
        "formation", "education", "étude", "etude", "diplôme", "diplome",
        "compétence", "competence", "skill", "aptitude", "technique",
        "projet", "project", "réalisation", "realisation",
        "langue", "language",
        "intérêt", "interet", "centre", "loisir", "hobby", "interest",
        "certification", "certificat",
        "publication", "article", "recherche", "distinction",
        "contact", "cv", "curriculum", "vitae",
        "profil personnel", "professional summary", "about me", "à propos",
    ]
    return any(k in lower for k in section_keywords)


def _parse_standard_markdown(content: str, result: dict):
    """Parse standard markdown CV format (# Name, ## Section or ### Section)."""
    lines = content.split("\n")
    current_section = ""
    buffer = []
    name_found = False
    header_done = False

    for line in lines:
        trimmed = line.strip()

        # H1 = Name (but only if NOT a known section keyword)
        if trimmed.startswith("# ") and not trimmed.startswith("## "):
            h1_text = re.sub(r"\*+", "", trimmed[2:]).strip()
            if not name_found and not _is_section_keyword(h1_text):
                result["name"] = h1_text
                name_found = True
            else:
                # Known section keyword or second H1 — treat as section
                header_done = True
                _save_section(current_section, buffer, result)
                buffer = []
                section_name = h1_text.lower()
                current_section = _classify_section(section_name)
            continue

        # Lines right after name = title / contact (only before first ## or ###)
        if name_found and not header_done and not trimmed.startswith("#") and trimmed:
            clean = re.sub(r"\*+|_+", "", trimmed).strip()
            if not clean:
                continue
            if "@" in clean or "http" in clean or "linkedin" in clean.lower():
                result["contact"] += clean + "\n"
                continue
            if "|" in clean and ("+" in clean or "@" in clean or re.search(r"\d{3,}", clean)):
                result["contact"] += clean + "\n"
                continue
            if not result["title"] and not trimmed.startswith("-") and len(clean) < 100:
                result["title"] = clean
                continue
            if not result["title"]:
                if "+" in clean or re.search(r"\d{8,}", clean):
                    result["contact"] += clean + "\n"
                    continue

        # H2 = Section header OR professional title (if doesn't match a section)
        if trimmed.startswith("## ") and not trimmed.startswith("### "):
            section_name = re.sub(r"\*+", "", trimmed[3:]).strip().lower()
            classified = _classify_section(section_name)
            # If it matches a known section keyword, treat as section
            if classified != section_name:
                header_done = True
                _save_section(current_section, buffer, result)
                buffer = []
                current_section = classified
            else:
                # Doesn't match any known section — treat as professional title
                if not result["title"]:
                    result["title"] = re.sub(r"\*+", "", trimmed[3:]).strip()
                else:
                    # Already have a title, treat as unknown section
                    header_done = True
                    _save_section(current_section, buffer, result)
                    buffer = []
                    current_section = classified
            continue

        # H3 = Section header (AI often uses ### for sections under ## title)
        if trimmed.startswith("### ") and not trimmed.startswith("#### "):
            section_name = re.sub(r"\*+", "", trimmed[4:]).strip().lower()
            classified = _classify_section(section_name)
            if classified != section_name:
                header_done = True
                _save_section(current_section, buffer, result)
                buffer = []
                current_section = classified
                continue
            # Unknown ### header — could be a subsection label, add to buffer
            # but only if we're already inside a section
            if current_section:
                buffer.append(trimmed)
                continue
            # Otherwise treat as section
            header_done = True
            _save_section(current_section, buffer, result)
            buffer = []
            current_section = classified
            continue

        # H4 = entry header within a section (#### Job Title chez Company)
        # Keep in buffer for _parse_experience / _parse_education to handle
        if trimmed.startswith("#### "):
            # Convert #### to ### so entry parsers can split on ###
            buffer.append("### " + trimmed[5:])
            continue

        if trimmed:
            buffer.append(trimmed)

    # Save last section
    _save_section(current_section, buffer, result)


def _classify_section(name: str) -> str:
    if any(k in name for k in ["profil", "summary", "résumé", "resume", "objectif", "académique"]):
        return "summary"
    if any(k in name for k in ["expérience", "experience", "emploi", "parcours"]):
        return "experience"
    if any(k in name for k in ["formation", "education", "étude", "etude", "diplôme", "diplome"]):
        return "education"
    if any(k in name for k in ["compétence", "competence", "skill", "aptitude", "technique"]):
        return "skills"
    if any(k in name for k in ["projet", "project", "réalisation", "realisation"]):
        return "projects"
    if any(k in name for k in ["langue", "language"]):
        return "languages"
    if any(k in name for k in ["intérêt", "interet", "centre", "loisir", "hobby", "interest"]):
        return "interests"
    if any(k in name for k in ["certification", "certificat"]):
        return "certifications"
    if any(k in name for k in ["publication", "article", "recherche", "distinction"]):
        return "publications"
    if any(k in name for k in ["contact"]):
        return "contact"
    return name


def _save_section(section: str, buffer: list, result: dict):
    if not buffer:
        return
    text = "\n".join(buffer).strip()
    if not text:
        return

    if section == "summary":
        result["summary"] = _clean_markdown(text)
    elif section == "contact":
        result["contact"] = text
    elif section == "experience":
        result["experience"] = _parse_experience(text)
    elif section == "education":
        result["education"] = _parse_education(text)
    elif section == "skills":
        result["skills"] = _parse_skills(text)
    elif section == "projects":
        result["projects"] = _parse_projects(text)
    elif section == "languages":
        result["languages"] = _parse_languages(text)
    elif section == "interests":
        result["interests"] = [_clean_markdown(l.lstrip("-* ")) for l in text.split("\n") if l.strip()]
    elif section == "certifications":
        result["certifications"] = _parse_certifications(text)
    elif section == "publications":
        result["publications"] = [_clean_markdown(l.lstrip("-* ")) for l in text.split("\n") if l.strip()]
    elif section:
        result["extra_sections"][section] = _clean_markdown(text)


def _clean_markdown(text: str) -> str:
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)  # Strip backticks
    return text.strip()


def _find_date_range(text: str) -> str:
    """Extract a date range from text, handling YYYY-MM-DD, YYYY-MM, and YYYY formats."""
    # Try patterns with spaces around the separator dash (to avoid matching inside YYYY-MM-DD)
    match = re.search(
        r"(\d{4}(?:[/-]\d{1,2}(?:[/-]\d{1,2})?)?)"
        r"\s+[-–]\s+"
        r"((?:\d{4}(?:[/-]\d{1,2}(?:[/-]\d{1,2})?)?)|[Pp]résent|[Cc]urrent|[Aa]ujourd'\w*|[Ee]n\s*cours)",
        text
    )
    if match:
        return match.group(0).strip()
    # Fallback: simple YYYY - YYYY / YYYY - Présent
    match = re.search(
        r"(\d{4})\s*[-–]\s*(\d{4}|[Pp]résent|[Cc]urrent|[Aa]ujourd'\w*|[Ee]n\s*cours)",
        text
    )
    if match:
        return match.group(0).strip()
    return ""


def _parse_contact(text: str) -> dict:
    info = {"email": "", "phone": "", "location": "", "website": "", "linkedin": ""}
    # First, split |-separated lines into individual parts
    parts = []
    for line in text.split("\n"):
        line = _clean_markdown(line.strip().lstrip("-* "))
        if not line:
            continue
        if "|" in line:
            parts.extend(p.strip() for p in line.split("|") if p.strip())
        else:
            parts.append(line)
    # Now classify each part
    for part in parts:
        lower = part.lower()
        if "@" in part and "linkedin" not in lower and not info["email"]:
            match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", part)
            if match:
                info["email"] = match.group()
        elif "linkedin" in lower or "linkedin.com" in lower:
            match = re.search(r"https?://\S+", part)
            info["linkedin"] = match.group() if match else part
        elif "http" in lower:
            match = re.search(r"https?://\S+", part)
            info["website"] = match.group() if match else part
        elif "+" in part or re.search(r"\d{8,}", part):
            if not info["phone"]:
                info["phone"] = re.sub(r"[^\d+\s()-]", "", part).strip()
        else:
            if not info["location"]:
                info["location"] = part
    return info


def _parse_experience(text: str) -> list:
    # Split on ### headers if present; otherwise fall back to ** bold
    if "###" in text:
        entries = re.split(r"\n(?=###)", text)
    else:
        entries = re.split(r"\n(?=\*\*)", text)
    result = []
    for entry in entries:
        lines = [l for l in entry.split("\n") if l.strip()]
        if not lines:
            continue
        # First line = job title (strip ### and markdown)
        first = _clean_markdown(lines[0].lstrip("#- "))
        if not first:
            continue
        company = ""
        dates = ""
        achievements = []

        # Try "Title chez Company, Location (dates)" pattern
        chez_match = re.match(
            r"(.+?)\s+chez\s+(.+?)(?:,\s*(.+?))?\s*\((.+?)\)\s*$",
            first
        )
        if chez_match:
            post = chez_match.group(1).strip()
            company = chez_match.group(2).strip()
            location = chez_match.group(3)
            if location:
                company += ", " + location.strip()
            dates = chez_match.group(4).strip()
            first = post  # Keep only the job title
        else:
            # Try "Title at Company, Location (dates)" pattern
            at_match = re.match(
                r"(.+?)\s+(?:at|@|à)\s+(.+?)(?:,\s*(.+?))?\s*\((.+?)\)\s*$",
                first
            )
            if at_match:
                post = at_match.group(1).strip()
                company = at_match.group(2).strip()
                location = at_match.group(3)
                if location:
                    company += ", " + location.strip()
                dates = at_match.group(4).strip()
                first = post

        for i, l in enumerate(lines[1:], 1):
            clean = _clean_markdown(l.strip())
            stripped = l.strip()
            # Strip bullet markers for content analysis
            bullet_content = _clean_markdown(stripped.lstrip("-*• "))
            # Skip "Description :" and "Réalisations :" labels, keep their values
            label_match = re.match(r"(?:Description|Réalisations?)\s*:\s*(.*)", bullet_content)
            if label_match:
                value = label_match.group(1).strip()
                # Remove HTML tags like <p>...</p>
                value = re.sub(r"<[^>]+>", "", value)
                if value and value not in (':', ''):
                    achievements.append(value)
                continue
            # Try to extract company and dates from "Company | dates" pattern
            if not company and ("|" in clean or i == 1):
                if "|" in clean:
                    parts = clean.split("|", 1)
                    company = parts[0].strip()
                    dates = parts[1].strip()
                elif i == 1 and not company:
                    date_match = _find_date_range(clean)
                    if date_match:
                        dates = date_match
                        company = clean[:clean.find(dates)].strip().rstrip("|-–")
                    else:
                        company = clean
                continue
            if not dates and i <= 3:
                date_match = _find_date_range(clean)
                if date_match:
                    dates = date_match
                    continue
            # Bullet points = achievements (including + sub-bullets)
            if stripped.startswith("-") or stripped.startswith("*") or stripped.startswith("•") or stripped.startswith("+"):
                ach = _clean_markdown(stripped.lstrip("-*•+ \t"))
                # Clean up list-like strings ["item"]
                ach = re.sub(r'^\[?"?|"?\]?$', '', ach).strip()
                # Remove HTML tags
                ach = re.sub(r"<[^>]+>", "", ach).strip()
                # Strip "Description :" and "Réalisations :" label prefixes
                ach = re.sub(r"^(?:Description|Réalisations?)\s*:\s*", "", ach).strip()
                if ach:
                    achievements.append(ach)
            elif clean and i > 1:
                clean = re.sub(r"<[^>]+>", "", clean).strip()
                if clean:
                    achievements.append(clean)
        result.append({
            "post": first,
            "company": company,
            "dates": dates,
            "achievements": achievements,
        })
    return result


def _parse_education(text: str) -> list:
    # Split on ### headers if present; otherwise fall back to ** or - bullet
    if "###" in text:
        entries = re.split(r"\n(?=###)", text)
    else:
        entries = re.split(r"\n(?=\*\*|###|-\s)", text)
    result = []
    for entry in entries:
        lines = [l for l in entry.split("\n") if l.strip()]
        if not lines:
            continue
        first = _clean_markdown(lines[0].lstrip("#-* "))
        if not first:
            continue
        school = ""
        dates = ""

        # Try "Degree à School (dates)" pattern (AI european format)
        a_match = re.match(r"(.+?)\s+à\s+(.+?)\s*\((.+?)\)\s*$", first)
        if a_match:
            first = a_match.group(1).strip()
            school = a_match.group(2).strip()
            dates = a_match.group(3).strip()
        else:
            # Try "Degree at School (dates)" pattern
            at_match = re.match(r"(.+?)\s+(?:at|@)\s+(.+?)\s*\((.+?)\)\s*$", first)
            if at_match:
                first = at_match.group(1).strip()
                school = at_match.group(2).strip()
                dates = at_match.group(3).strip()
            else:
                for i, l in enumerate(lines[1:], 1):
                    clean = _clean_markdown(l.strip())
                    if not school and ("|" in clean or i == 1):
                        if "|" in clean:
                            parts = clean.split("|", 1)
                            school = parts[0].strip()
                            dates = parts[1].strip()
                        elif i == 1:
                            school = clean
                        continue
                    if not dates and i <= 3:
                        date_match = _find_date_range(clean)
                        if date_match:
                            dates = date_match
        result.append({"degree": first, "school": school, "dates": dates})
    return result


def _parse_skills(text: str) -> list:
    result = []
    current_category = ""
    for line in text.split("\n"):
        stripped = line.strip()
        # ### or #### headers = skill category
        header_match = re.match(r"^#{2,4}\s+(.+)$", stripped)
        if header_match:
            current_category = _clean_markdown(header_match.group(1).strip())
            continue
        clean = _clean_markdown(stripped.lstrip("-*+ "))
        if not clean:
            continue
        if ":" in clean:
            parts = clean.split(":", 1)
            label = parts[0].strip()
            items_text = parts[1].strip()
            # Use header category if available, otherwise use the label
            category = current_category or label
            items = [i.strip() for i in re.split(r"[,|]", items_text) if i.strip()]
            for item in items:
                # Try to extract level
                level_match = re.search(r"\((\w+)\)$", item)
                level = level_match.group(1) if level_match else ""
                name = re.sub(r"\s*\(\w+\)\s*$", "", item).strip()
                result.append({"name": name, "category": category, "level": level})
        else:
            level_match = re.search(r"\((\w+)\)$", clean)
            level = level_match.group(1) if level_match else ""
            name = re.sub(r"\s*\(\w+\)\s*$", "", clean).strip()
            result.append({"name": name, "category": current_category, "level": level})
    return result


def _parse_languages(text: str) -> list:
    result = []
    for line in text.split("\n"):
        stripped = line.strip()
        # Skip ### headers
        if stripped.startswith("#"):
            continue
        clean = _clean_markdown(stripped.lstrip("-*+ "))
        if not clean:
            continue
        # "Français : Natif" or "Français (Natif)" or "Français - Natif"
        match = re.match(r"(.+?)\s*[:\-–(]\s*(.+?)\)?\s*$", clean)
        if match:
            result.append({"name": match.group(1).strip(), "level": match.group(2).strip()})
        else:
            result.append({"name": clean, "level": ""})
    return result


def _parse_projects(text: str) -> list:
    entries = re.split(r"\n(?=\*\*|###)", text)
    result = []
    for entry in entries:
        lines = [l for l in entry.split("\n") if l.strip()]
        if not lines:
            continue
        title = _clean_markdown(lines[0].lstrip("#-* "))
        desc = " ".join(_clean_markdown(l.lstrip("-* ")) for l in lines[1:])
        result.append({"title": title, "description": desc})
    return result


def _parse_certifications(text: str) -> list:
    entries = re.split(r"\n(?=\*\*|###)", text)
    result = []
    for entry in entries:
        lines = [l for l in entry.split("\n") if l.strip()]
        if not lines:
            continue
        title = _clean_markdown(lines[0].lstrip("#-* "))
        org = ""
        date = ""
        desc_parts = []
        for line in lines[1:]:
            clean = _clean_markdown(line.lstrip("-* "))
            if "|" in clean and not org:
                parts = [p.strip() for p in clean.split("|")]
                org = parts[0] if len(parts) > 0 else ""
                date = parts[1] if len(parts) > 1 else ""
            else:
                desc_parts.append(clean)
        result.append({
            "title": title,
            "organization": org,
            "date": date,
            "description": " ".join(desc_parts),
        })
    return result


def level_to_percent(level: str) -> int:
    """Convert skill/language level text to a percentage."""
    lower = level.lower() if level else ""
    if any(k in lower for k in ["expert", "natif", "native", "maternelle", "c2"]):
        return 95
    if any(k in lower for k in ["avancé", "advanced", "courant", "fluent", "c1"]):
        return 80
    if any(k in lower for k in ["intermédiaire", "intermediate", "b2", "b1"]):
        return 60
    if any(k in lower for k in ["débutant", "beginner", "basique", "basic", "a2", "a1"]):
        return 35
    return 70  # default


# ── Multi-language translation dictionaries ──
CV_TRANSLATIONS = {
    "fr": {
        "contact": "Contact",
        "phone": "Téléphone",
        "location": "Localisation",
        "education": "Formation",
        "skills": "Compétences",
        "languages": "Langues",
        "interests": "Intérêts",
        "profile": "Profil Professionnel",
        "experience": "Expérience Professionnelle",
        "certifications": "Certifications",
        "projects": "Projets",
        "technical_skills": "Compétences Techniques",
        "references": "Références",
        "publications": "Publications",
    },
    "en": {
        "contact": "Contact",
        "phone": "Phone",
        "location": "Location",
        "education": "Education",
        "skills": "Skills",
        "languages": "Languages",
        "interests": "Interests",
        "profile": "Professional Profile",
        "experience": "Work Experience",
        "certifications": "Certifications",
        "projects": "Projects",
        "technical_skills": "Technical Skills",
        "references": "References",
        "publications": "Publications",
    },
    "ar": {
        "contact": "الاتصال",
        "phone": "الهاتف",
        "location": "الموقع",
        "education": "التعليم",
        "skills": "المهارات",
        "languages": "اللغات",
        "interests": "الاهتمامات",
        "profile": "الملف المهني",
        "experience": "الخبرة المهنية",
        "certifications": "الشهادات",
        "projects": "المشاريع",
        "technical_skills": "المهارات التقنية",
        "references": "المراجع",
        "publications": "المنشورات",
    },
    "es": {
        "contact": "Contacto",
        "phone": "Teléfono",
        "location": "Ubicación",
        "education": "Formación",
        "skills": "Competencias",
        "languages": "Idiomas",
        "interests": "Intereses",
        "profile": "Perfil Profesional",
        "experience": "Experiencia Profesional",
        "certifications": "Certificaciones",
        "projects": "Proyectos",
        "technical_skills": "Competencias Técnicas",
        "references": "Referencias",
        "publications": "Publicaciones",
    },
    "de": {
        "contact": "Kontakt",
        "phone": "Telefon",
        "location": "Standort",
        "education": "Ausbildung",
        "skills": "Fähigkeiten",
        "languages": "Sprachen",
        "interests": "Interessen",
        "profile": "Berufsprofil",
        "experience": "Berufserfahrung",
        "certifications": "Zertifizierungen",
        "projects": "Projekte",
        "technical_skills": "Technische Fähigkeiten",
        "references": "Referenzen",
        "publications": "Veröffentlichungen",
    },
    "it": {
        "contact": "Contatto",
        "phone": "Telefono",
        "location": "Posizione",
        "education": "Formazione",
        "skills": "Competenze",
        "languages": "Lingue",
        "interests": "Interessi",
        "profile": "Profilo Professionale",
        "experience": "Esperienza Professionale",
        "certifications": "Certificazioni",
        "projects": "Progetti",
        "technical_skills": "Competenze Tecniche",
        "references": "Referenze",
        "publications": "Pubblicazioni",
    },
    "pt": {
        "contact": "Contato",
        "phone": "Telefone",
        "location": "Localização",
        "education": "Formação",
        "skills": "Competências",
        "languages": "Idiomas",
        "interests": "Interesses",
        "profile": "Perfil Profissional",
        "experience": "Experiência Profissional",
        "certifications": "Certificações",
        "projects": "Projetos",
        "technical_skills": "Competências Técnicas",
        "references": "Referências",
        "publications": "Publicações",
    },
    "tr": {
        "contact": "İletişim",
        "phone": "Telefon",
        "location": "Konum",
        "education": "Eğitim",
        "skills": "Beceriler",
        "languages": "Diller",
        "interests": "İlgi Alanları",
        "profile": "Profesyonel Profil",
        "experience": "İş Deneyimi",
        "certifications": "Sertifikalar",
        "projects": "Projeler",
        "technical_skills": "Teknik Beceriler",
        "references": "Referanslar",
        "publications": "Yayınlar",
    },
    "zh": {
        "contact": "联系方式",
        "phone": "电话",
        "location": "地点",
        "education": "教育背景",
        "skills": "专业技能",
        "languages": "语言能力",
        "interests": "兴趣爱好",
        "profile": "职业简介",
        "experience": "工作经验",
        "certifications": "证书",
        "projects": "项目经历",
        "technical_skills": "技术技能",
        "references": "推荐人",
        "publications": "发表文章",
    },
    "ja": {
        "contact": "連絡先",
        "phone": "電話番号",
        "location": "所在地",
        "education": "学歴",
        "skills": "スキル",
        "languages": "言語",
        "interests": "趣味",
        "profile": "職務要約",
        "experience": "職務経歴",
        "certifications": "資格",
        "projects": "プロジェクト",
        "technical_skills": "技術スキル",
        "references": "参照",
        "publications": "出版物",
    },
    "ko": {
        "contact": "연락처",
        "phone": "전화번호",
        "location": "위치",
        "education": "학력",
        "skills": "능력",
        "languages": "언어",
        "interests": "관심사",
        "profile": "직무 요약",
        "experience": "경력 사항",
        "certifications": "자격증",
        "projects": "프로젝트",
        "technical_skills": "기술 역량",
        "references": "참고인",
        "publications": "출판물",
    },
    "ru": {
        "contact": "Контакты",
        "phone": "Телефон",
        "location": "Местоположение",
        "education": "Образование",
        "skills": "Навыки",
        "languages": "Языки",
        "interests": "Интересы",
        "profile": "Профессиональный профиль",
        "experience": "Опыт работы",
        "certifications": "Сертификаты",
        "projects": "Проекты",
        "technical_skills": "Технические навыки",
        "references": "Рекомендации",
        "publications": "Публикации",
    },
    "nl": {
        "contact": "Contact",
        "phone": "Telefoon",
        "location": "Locatie",
        "education": "Opleiding",
        "skills": "Vaardigheden",
        "languages": "Talen",
        "interests": "Interesses",
        "profile": "Professioneel Profiel",
        "experience": "Werkervaring",
        "certifications": "Certificeringen",
        "projects": "Projecten",
        "technical_skills": "Technische Vaardigheden",
        "references": "Referenties",
        "publications": "Publicaties",
    },
    "hi": {
        "contact": "संपर्क",
        "phone": "फ़ोन",
        "location": "स्थान",
        "education": "शिक्षा",
        "skills": "कौशल",
        "languages": "भाषाएँ",
        "interests": "रुचियाँ",
        "profile": "पेशेवर प्रोफ़ाइल",
        "experience": "कार्य अनुभव",
        "certifications": "प्रमाणपत्र",
        "projects": "परियोजनाएँ",
        "technical_skills": "तकनीकी कौशल",
        "references": "संदर्भ",
        "publications": "प्रकाशन",
    },
}

SUPPORTED_LANGS = list(CV_TRANSLATIONS.keys())


def get_translations(lang: str) -> dict:
    """Return the translation dict for the given language code, fallback to French."""
    return CV_TRANSLATIONS.get(lang, CV_TRANSLATIONS["fr"])


def render_html(sections: dict, cv_format: str, photo_url: str = "", primary_color: str = "", accent_color: str = "", font_family: str = "", lang: str = "fr") -> str:
    """Render CV data into HTML using Jinja2 templates."""
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=True,
    )
    # Register custom filters
    env.filters["level_to_percent"] = lambda l: level_to_percent(l)

    template_file = f"{cv_format}.html"
    # Fallback to standard if template doesn't exist
    if not (TEMPLATE_DIR / template_file).exists():
        template_file = "standard.html"

    template = env.get_template(template_file)

    # Convert absolute file path to base64 data URI for xhtml2pdf
    resolved_photo = ""
    if photo_url and os.path.isfile(photo_url):
        abs_path = os.path.abspath(photo_url)
        mime_type = mimetypes.guess_type(abs_path)[0] or "image/jpeg"
        try:
            with open(abs_path, "rb") as img_f:
                img_data = base64.b64encode(img_f.read()).decode("ascii")
            resolved_photo = f"data:{mime_type};base64,{img_data}"
        except Exception:
            resolved_photo = ""

    # Validate color format (hex only, e.g. #2196F3)
    def validate_color(c: str) -> str:
        if c and re.match(r'^#[0-9a-fA-F]{6}$', c):
            return c
        return ""

    # Validate font family (whitelist safe values)
    ALLOWED_FONTS = {"Arial", "Times New Roman", "Georgia", "Courier New", "Helvetica", "Verdana", "Segoe UI", "Calibri", "Roboto", "Helvetica Neue"}
    safe_font = font_family if font_family in ALLOWED_FONTS else ""

    # Default font per template when none specified
    if not safe_font:
        safe_font = ""  # Let each template keep its own default font

    # Validate language code
    valid_lang = lang if lang in SUPPORTED_LANGS else "fr"
    translations = get_translations(valid_lang)

    return template.render(
        cv=sections,
        photo_url=Markup(resolved_photo) if resolved_photo else "",
        primary_color=validate_color(primary_color),
        accent_color=validate_color(accent_color),
        font_family=safe_font,
        t=translations,
        lang=valid_lang,
    )


def html_to_pdf(html_content: str) -> bytes:
    """Convert HTML to PDF using xhtml2pdf."""
    pdf_buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(
        io.StringIO(html_content),
        dest=pdf_buffer,
        encoding="utf-8",
    )
    if pisa_status.err:
        raise RuntimeError(f"PDF generation failed with {pisa_status.err} errors")
    return pdf_buffer.getvalue()


def main():
    try:
        raw = sys.stdin.buffer.read().decode("utf-8")
        data = json.loads(raw)

        content = data.get("content", "")
        cv_format = data.get("format", "standard")
        photo_url = data.get("photoUrl", "")
        user_name = data.get("userName", "")
        user_title = data.get("userTitle", "")
        user_email = data.get("userEmail", "")
        user_phone = data.get("userPhone", "")
        user_address = data.get("userAddress", "")
        user_website = data.get("userWebsite", "")
        primary_color = data.get("primaryColor", "")
        accent_color = data.get("accentColor", "")
        font_family = data.get("fontFamily", "")
        lang = data.get("lang", "fr")

        if not content:
            sys.stderr.write(json.dumps({"error": "No content provided"}))
            sys.exit(1)

        # Step 1: Parse markdown into structured sections
        sections = parse_markdown_to_sections(content)

        # Fallback: use user data from backend if parser didn't find them
        if not sections["name"] and user_name:
            sections["name"] = user_name
        if not sections["title"] and user_title:
            sections["title"] = user_title

        # Fallback: populate contact info from backend user data
        if "contact_info" not in sections:
            sections["contact_info"] = {"email": "", "phone": "", "location": "", "website": "", "linkedin": ""}
        ci = sections["contact_info"]
        if not ci.get("email") and user_email:
            ci["email"] = user_email
        if not ci.get("phone") and user_phone:
            ci["phone"] = user_phone
        if not ci.get("location") and user_address:
            ci["location"] = user_address
        if not ci.get("website") and user_website:
            ci["website"] = user_website

        # Step 2: Render HTML from Jinja2 template
        html = render_html(sections, cv_format, photo_url, primary_color, accent_color, font_family, lang)

        # Step 3: Convert HTML to PDF
        pdf_bytes = html_to_pdf(html)

        # Output raw PDF bytes
        sys.stdout.buffer.write(pdf_bytes)

    except Exception as e:
        sys.stderr.write(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
