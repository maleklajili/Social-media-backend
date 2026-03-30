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
from pathlib import Path
from urllib.request import pathname2url

from jinja2 import Environment, FileSystemLoader
from xhtml2pdf import pisa


SCRIPT_DIR = Path(__file__).parent
TEMPLATE_DIR = SCRIPT_DIR / "templates"


def parse_markdown_to_sections(content: str) -> dict:
    """Parse markdown CV content into structured sections."""
    lines = content.split("\n")
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

    current_section = ""
    buffer = []
    name_found = False
    header_done = False  # True after first ## section

    for line in lines:
        trimmed = line.strip()

        # H1 = Name
        if trimmed.startswith("# "):
            result["name"] = re.sub(r"\*+", "", trimmed[2:]).strip()
            name_found = True
            continue

        # Lines right after name = title / contact (only before first ##)
        if name_found and not header_done and not trimmed.startswith("##") and trimmed and not trimmed.startswith("# "):
            clean = re.sub(r"\*+|_+", "", trimmed).strip()
            if not clean:
                continue
            # Contact line (contains @ or + or http or multiple | separated)
            if "@" in clean or "http" in clean or "linkedin" in clean.lower():
                result["contact"] += clean + "\n"
                continue
            if "|" in clean and ("+" in clean or "@" in clean or re.search(r"\d{3,}", clean)):
                result["contact"] += clean + "\n"
                continue
            # Title (first non-contact, non-section line after name)
            if not result["title"] and not trimmed.startswith("-") and len(clean) < 100:
                result["title"] = clean
                continue
            # Additional contact line
            if not result["title"]:
                if "+" in clean or re.search(r"\d{8,}", clean):
                    result["contact"] += clean + "\n"
                    continue

        # H2 = Section
        if trimmed.startswith("## "):
            header_done = True
            _save_section(current_section, buffer, result)
            buffer = []
            section_name = trimmed[3:].lower()
            current_section = _classify_section(section_name)
            continue

        if trimmed:
            buffer.append(trimmed)

    # Save last section
    _save_section(current_section, buffer, result)

    # Extract contact from content if not found
    if not result["contact"]:
        contact_lines = [l for l in lines if "@" in l or "+" in l or "http" in l]
        result["contact"] = "\n".join(contact_lines[:3])

    # Parse contact into structured data
    result["contact_info"] = _parse_contact(result["contact"])

    return result


def _classify_section(name: str) -> str:
    if any(k in name for k in ["profil", "summary", "résumé", "resume", "objectif"]):
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
    if any(k in name for k in ["publication", "article", "recherche"]):
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
        result["certifications"] = [_clean_markdown(l.lstrip("-* ")) for l in text.split("\n") if l.strip()]
    elif section == "publications":
        result["publications"] = [_clean_markdown(l.lstrip("-* ")) for l in text.split("\n") if l.strip()]
    elif section:
        result["extra_sections"][section] = _clean_markdown(text)


def _clean_markdown(text: str) -> str:
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
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
        for i, l in enumerate(lines[1:], 1):
            clean = _clean_markdown(l.strip())
            stripped = l.strip()
            # Try to extract company and dates from "Company | dates" pattern
            if not company and ("|" in clean or i == 1):
                if "|" in clean:
                    parts = clean.split("|", 1)
                    company = parts[0].strip()
                    dates = parts[1].strip()
                elif i == 1 and not company:
                    # Line without |, try to extract dates
                    date_match = _find_date_range(clean)
                    if date_match:
                        dates = date_match
                        company = clean[:clean.find(dates)].strip().rstrip("|-–")
                    else:
                        company = clean
                continue
            # Try to extract dates from any of the first few lines
            if not dates and i <= 3:
                date_match = _find_date_range(clean)
                if date_match:
                    dates = date_match
                    continue
            # Bullet points = achievements
            if stripped.startswith("-") or stripped.startswith("*") or stripped.startswith("•"):
                achievements.append(_clean_markdown(stripped.lstrip("-*• ")))
            elif clean and i > 1:
                # Non-bullet description lines
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
    for line in text.split("\n"):
        clean = _clean_markdown(line.strip().lstrip("-* "))
        if not clean:
            continue
        if ":" in clean:
            parts = clean.split(":", 1)
            category = parts[0].strip()
            items = [i.strip() for i in re.split(r"[,|]", parts[1]) if i.strip()]
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
            result.append({"name": name, "category": "", "level": level})
    return result


def _parse_languages(text: str) -> list:
    result = []
    for line in text.split("\n"):
        clean = _clean_markdown(line.strip().lstrip("-* "))
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


def render_html(sections: dict, cv_format: str, photo_url: str = "") -> str:
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

    # Convert absolute file path to file:// URI for xhtml2pdf
    resolved_photo = ""
    if photo_url and os.path.isfile(photo_url):
        resolved_photo = "file:///" + pathname2url(os.path.abspath(photo_url)).lstrip("/")

    return template.render(
        cv=sections,
        photo_url=resolved_photo,
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

        if not content:
            sys.stderr.write(json.dumps({"error": "No content provided"}))
            sys.exit(1)

        # DEBUG: Save received content and parsed sections to file
        debug_path = SCRIPT_DIR / "debug_last_render.json"
        try:
            with open(debug_path, "w", encoding="utf-8") as df:
                json.dump({"content": content, "format": cv_format}, df, ensure_ascii=False, indent=2)
        except:
            pass

        # Step 1: Parse markdown into structured sections
        sections = parse_markdown_to_sections(content)

        # DEBUG: Save parsed sections
        try:
            with open(SCRIPT_DIR / "debug_last_sections.json", "w", encoding="utf-8") as df:
                json.dump(sections, df, ensure_ascii=False, indent=2)
        except:
            pass

        # Step 2: Render HTML from Jinja2 template
        html = render_html(sections, cv_format, photo_url)

        # DEBUG: Save rendered HTML
        try:
            with open(SCRIPT_DIR / "debug_last_html.html", "w", encoding="utf-8") as df:
                df.write(html)
        except:
            pass

        # Step 3: Convert HTML to PDF
        pdf_bytes = html_to_pdf(html)

        # Output raw PDF bytes
        sys.stdout.buffer.write(pdf_bytes)

    except Exception as e:
        sys.stderr.write(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
