"""
Job Matching AI — TF-IDF + Cosine Similarity (100% free, no API key)
Input  (stdin): JSON { "profile": {...}, "jobs": [...] }
Output (stdout): JSON array of jobs with match_score (0-100)
"""
import sys
import json
import re
import math
from collections import Counter

# ──────────────── helpers ────────────────

def tokenize(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"[^a-z0-9àâäéèêëîïôùûüç\s]", " ", text)
    return [t for t in text.split() if len(t) > 2]


def build_doc(tokens: list[str]) -> Counter:
    return Counter(tokens)


def tf(term: str, doc: Counter) -> float:
    total = sum(doc.values()) or 1
    return doc[term] / total


def idf(term: str, docs: list[Counter]) -> float:
    df = sum(1 for d in docs if term in d)
    return math.log((len(docs) + 1) / (df + 1)) + 1.0   # smooth IDF


def tfidf_vector(doc: Counter, vocabulary: list[str], idf_map: dict[str, float]) -> list[float]:
    return [tf(t, doc) * idf_map[t] for t in vocabulary]


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1))
    n2 = math.sqrt(sum(b * b for b in v2))
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot / (n1 * n2)


# ──────────────── profile text builder ────────────────

def build_profile_text(profile: dict) -> str:
    parts: list[str] = []

    # Basic info
    for key in ("professionalTitle", "bio", "summary", "currentDomain", "previousDomain", "professionalCategory"):
        if profile.get(key):
            parts.append(str(profile[key]))

    # Keywords
    if profile.get("keywords"):
        parts.extend(profile["keywords"] if isinstance(profile["keywords"], list) else [str(profile["keywords"])])

    # Skills
    for skill in profile.get("skills", []):
        if isinstance(skill, dict):
            parts.append(skill.get("name", "") or skill.get("categorie", ""))
        else:
            parts.append(str(skill))

    # Technical skills
    for ts in profile.get("technicalSkills", []):
        if isinstance(ts, dict):
            parts.append(ts.get("name", "") or ts.get("categorie", ""))
        else:
            parts.append(str(ts))

    # Experience
    for exp in profile.get("experiences", []):
        if isinstance(exp, dict):
            parts.append(exp.get("post", ""))
            parts.append(exp.get("entreprise", ""))
            parts.append(exp.get("description", ""))
            for s in exp.get("skills", []):
                parts.append(s.get("name", "") if isinstance(s, dict) else str(s))

    # Education
    for edu in profile.get("education", []):
        if isinstance(edu, dict):
            parts.append(edu.get("degree", ""))
            parts.append(edu.get("school", ""))
            parts.append(edu.get("description", ""))

    # Projects (from ManualCV)
    for proj in profile.get("projects", []):
        if isinstance(proj, dict):
            parts.append(proj.get("name", ""))
            parts.append(proj.get("description", ""))

    # Certifications (from ManualCV)
    for cert in profile.get("certifications", []):
        if isinstance(cert, dict):
            parts.append(cert.get("name", ""))
            parts.append(cert.get("organization", ""))
            parts.append(cert.get("description", ""))

    # Interests (from ManualCV)
    for interest in profile.get("interests", []):
        if isinstance(interest, str):
            parts.append(interest)

    return " ".join(p for p in parts if p)


def build_job_text(job: dict) -> str:
    parts: list[str] = [
        job.get("title", ""),
        job.get("description", ""),
        job.get("location", ""),
        job.get("contractType", ""),
        job.get("experience", ""),
        job.get("remotePolicy", ""),
    ]
    for s in job.get("skills", []):
        parts.append(str(s))
    return " ".join(p for p in parts if p)


# ──────────────── skill overlap bonus ────────────────

def skill_overlap_score(profile: dict, job: dict) -> float:
    """Direct skill name comparison (normalised 0-1)."""
    profile_skills: set[str] = set()
    for s in profile.get("skills", []):
        name = (s.get("name", "") or s.get("categorie", "")).lower().strip() if isinstance(s, dict) else str(s).lower().strip()
        if name:
            profile_skills.add(name)
    for s in profile.get("technicalSkills", []):
        name = (s.get("name", "") or s.get("categorie", "")).lower().strip() if isinstance(s, dict) else str(s).lower().strip()
        if name:
            profile_skills.add(name)

    job_skills: set[str] = {str(s).lower().strip() for s in job.get("skills", [])}

    if not job_skills:
        return 0.5   # no job skills specified → neutral
    if not profile_skills:
        return 0.0

    overlap = len(profile_skills & job_skills)
    return overlap / len(job_skills)


# ──────────────── main ────────────────

def main():
    raw = sys.stdin.read()
    data = json.loads(raw)

    profile: dict = data.get("profile", {})
    jobs: list[dict] = data.get("jobs", [])

    if not jobs:
        print(json.dumps([]))
        return

    profile_text = build_profile_text(profile)
    job_texts = [build_job_text(j) for j in jobs]

    # Tokenise
    profile_tokens = tokenize(profile_text)
    job_token_lists = [tokenize(jt) for jt in job_texts]

    all_docs = [build_doc(profile_tokens)] + [build_doc(t) for t in job_token_lists]
    vocabulary = list({t for doc in all_docs for t in doc})

    if not vocabulary:
        # No text at all — return jobs with score 0
        result = [{**j, "matchScore": 0} for j in jobs]
        print(json.dumps(result))
        return

    idf_map = {t: idf(t, all_docs) for t in vocabulary}

    profile_vec = tfidf_vector(all_docs[0], vocabulary, idf_map)

    results = []
    for idx, job in enumerate(jobs):
        job_vec = tfidf_vector(all_docs[idx + 1], vocabulary, idf_map)

        # Weighted mix: 70 % TF-IDF cosine  +  30 % direct skill overlap
        cosine = cosine_similarity(profile_vec, job_vec)
        overlap = skill_overlap_score(profile, job)

        raw_score = 0.70 * cosine + 0.30 * overlap

        # Scale to 0-100 and clamp
        score = max(0, min(100, round(raw_score * 100)))

        results.append({**job, "matchScore": score})

    # Sort descending by score
    results.sort(key=lambda x: x["matchScore"], reverse=True)

    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
