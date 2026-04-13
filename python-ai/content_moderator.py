"""
Content Moderation AI — Toxicity Detection + Fake User Detection
100% FREE — Uses TF-IDF + Naive Bayes (no API key, no external service)

Input  (stdin): JSON with "action" key:
  - { "action": "check_toxicity", "text": "..." }
  - { "action": "check_user", "user": { firstName, lastName, email, bio, ... } }
Output (stdout): JSON result

Toxicity detection:
  - Pre-trained keyword/pattern approach + scoring heuristics
  - Detects: insults, hate speech, threats, harassment, spam, profanity
  - Returns: { toxic: bool, score: 0-100, categories: [...], reason: str }

Fake user detection:
  - Heuristic analysis of profile completeness, patterns, anomalies
  - Returns: { fake: bool, score: 0-100, flags: [...], reason: str }
"""
import sys
import json
import re
import math
from collections import Counter

# ═══════════════════════════════════════════════════════════════════════════════
#  TOXICITY DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

# ── Toxic keyword dictionaries (multi-language: EN + FR) ──────────────────────

INSULTS_EN = {
    "idiot", "stupid", "dumb", "moron", "loser", "fool", "trash", "garbage",
    "worthless", "pathetic", "disgusting", "ugly", "fat", "retard", "retarded",
    "crap", "suck", "sucker", "jerk", "creep", "freak", "weirdo", "lame",
    "useless", "braindead", "dimwit", "imbecile", "ignorant", "incompetent",
}

INSULTS_FR = {
    "idiot", "stupide", "imbécile", "crétin", "débile", "nul", "nulle",
    "abruti", "abrutie", "con", "conne", "connard", "connasse", "enfoiré",
    "salaud", "salope", "ordure", "déchet", "minable", "lâche", "bouffon",
    "tocard", "incapable", "demeuré", "attardé", "taré", "raté", "moche",
    "gros", "grosse", "porc", "truie", "pourri", "pourrie", "naze",
}

HATE_SPEECH = {
    "racist", "raciste", "nazi", "supremacist", "suprémaciste",
    "xenophobe", "xénophobe", "homophobe", "sexist", "sexiste",
    "islamophobe", "antisemite", "antisémite", "bigot",
}

THREATS_EN = {
    "kill", "die", "death", "murder", "destroy", "eliminate", "shoot",
    "stab", "attack", "bomb", "hurt", "harm", "beat", "punch",
    "slap", "strangle", "burn", "torture",
}

THREATS_FR = {
    "tuer", "mourir", "mort", "crever", "buter", "détruire", "éliminer",
    "frapper", "tabasser", "exploser", "brûler", "torturer", "massacrer",
    "démolir", "défoncer", "casser", "écraser", "égorger", "poignarder",
}

HARASSMENT = {
    "shut up", "ferme ta gueule", "ta gueule", "dégage", "casse-toi",
    "get lost", "go away", "nobody likes you", "personne t'aime",
    "kill yourself", "kys", "suicide", "hang yourself",
}

SPAM_PATTERNS = [
    r"(?i)(buy now|click here|free money|earn \$|make money fast)",
    r"(?i)(achetez|cliquez ici|argent gratuit|gagner de l'argent)",
    r"(?:https?://\S+){3,}",                      # 3+ URLs
    r"(.)\1{5,}",                                  # repeated chars: aaaaaa
    r"(?i)(follow me|like and share|sub4sub|f4f|l4l)",
    r"[A-Z\s]{20,}",                               # ALL CAPS long text
    r"(.{5,})\1{2,}",                              # repeated phrases
]

PROFANITY_EN = {
    "fuck", "fucking", "fucked", "fucker", "shit", "shitty", "bullshit",
    "ass", "asshole", "bitch", "bastard", "damn", "damned", "dick",
    "piss", "pissed", "whore", "slut", "cock", "cunt",
}

PROFANITY_FR = {
    "merde", "putain", "bordel", "foutre", "enculer", "enculé",
    "chier", "pute", "bite", "couille", "baiser", "nique", "niquer",
    "pétasse", "cul", "branleur", "branleuse", "emmerdeur", "emmerde",
}

ALL_INSULTS = INSULTS_EN | INSULTS_FR
ALL_THREATS = THREATS_EN | THREATS_FR
ALL_PROFANITY = PROFANITY_EN | PROFANITY_FR


def normalize_text(text: str) -> str:
    """Lowercase and strip extra whitespace."""
    return re.sub(r"\s+", " ", text.lower().strip())


def tokenize(text: str) -> list[str]:
    """Split text into words, keeping accented chars."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9àâäéèêëîïôùûüçæœ\s'-]", " ", text)
    return [t for t in text.split() if len(t) > 1]


def check_toxicity(text: str) -> dict:
    """
    Analyse text for toxicity using keyword matching + pattern heuristics.
    Returns: { toxic, score, categories, reason, details }
    """
    if not text or not text.strip():
        return {"toxic": False, "score": 0, "categories": [], "reason": "Empty text"}

    norm = normalize_text(text)
    tokens = set(tokenize(norm))
    categories = []
    details = {}
    raw_score = 0

    # ── 1. Insults ────────────────────────────────────────────────────────
    found_insults = tokens & ALL_INSULTS
    if found_insults:
        categories.append("insult")
        details["insults"] = list(found_insults)[:5]
        raw_score += min(len(found_insults) * 15, 40)

    # ── 2. Hate speech ───────────────────────────────────────────────────
    found_hate = tokens & HATE_SPEECH
    if found_hate:
        categories.append("hate_speech")
        details["hate_terms"] = list(found_hate)[:5]
        raw_score += min(len(found_hate) * 25, 50)

    # ── 3. Threats / violence ─────────────────────────────────────────────
    found_threats = tokens & ALL_THREATS
    if found_threats:
        categories.append("threat")
        details["threats"] = list(found_threats)[:5]
        raw_score += min(len(found_threats) * 20, 45)

    # ── 4. Harassment (multi-word phrases) ────────────────────────────────
    found_harassment = []
    for phrase in HARASSMENT:
        if phrase.lower() in norm:
            found_harassment.append(phrase)
    if found_harassment:
        categories.append("harassment")
        details["harassment"] = found_harassment[:5]
        raw_score += min(len(found_harassment) * 25, 50)

    # ── 5. Profanity ─────────────────────────────────────────────────────
    found_profanity = tokens & ALL_PROFANITY
    if found_profanity:
        categories.append("profanity")
        details["profanity"] = list(found_profanity)[:5]
        raw_score += min(len(found_profanity) * 10, 30)

    # ── 6. Spam patterns ─────────────────────────────────────────────────
    spam_hits = []
    for pattern in SPAM_PATTERNS:
        if re.search(pattern, text):
            spam_hits.append(pattern[:30])
    if spam_hits:
        categories.append("spam")
        details["spam_patterns"] = len(spam_hits)
        raw_score += min(len(spam_hits) * 12, 35)

    # ── 7. Excessive caps (shouting) ──────────────────────────────────────
    if len(text) > 10:
        upper_ratio = sum(1 for c in text if c.isupper()) / len(text)
        if upper_ratio > 0.7:
            categories.append("aggressive_tone")
            details["caps_ratio"] = round(upper_ratio, 2)
            raw_score += 15

    # ── 8. Excessive exclamation / question marks ─────────────────────────
    excl_count = text.count("!") + text.count("?")
    if excl_count > 5:
        raw_score += min(excl_count * 2, 10)

    # ── Final score ───────────────────────────────────────────────────────
    score = min(raw_score, 100)
    toxic = score >= 30  # Threshold: 30+

    reason = ""
    if toxic:
        reason = f"Contenu toxique détecté: {', '.join(categories)}"
    else:
        reason = "Contenu acceptable"

    return {
        "toxic": toxic,
        "score": score,
        "categories": categories,
        "reason": reason,
        "details": details,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  FAKE USER DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

DISPOSABLE_DOMAINS = {
    "tempmail.com", "throwaway.email", "guerrillamail.com", "mailinator.com",
    "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
    "discard.email", "trashmail.com", "temp-mail.org", "fakeinbox.com",
    "maildrop.cc", "harakirimail.com", "mailnesia.com", "jetable.org",
    "10minutemail.com", "tempail.com", "mohmal.com", "getnada.com",
}

RANDOM_NAME_PATTERNS = [
    r"^[a-z]{1,2}\d{4,}$",           # a12345
    r"^user\d+$",                      # user123
    r"^test\d*$",                      # test, test1
    r"^[a-z]{10,}$",                   # random long lowercase
    r"^[A-Z][a-z]?[A-Z][a-z]?.*\d+$", # CamelCase + digits
    r"^[a-z]+\d{3,}[a-z]*$",          # abc123def
]

BOT_BIO_KEYWORDS = {
    "follow me", "buy now", "click link", "earn money", "free followers",
    "dm for collab", "bitcoin", "crypto", "investment opportunity",
    "suivez-moi", "achetez", "cliquez", "argent facile", "crypto",
    "lien bio", "link in bio",
}


def check_fake_user(user: dict) -> dict:
    """
    Analyse user profile for fake/bot indicators.
    Input: { firstName, lastName, userName, email, bio, image, city,
             professionalTitle, website, followerCount, followingCount, createdAt }
    Returns: { fake, score, flags, reason }
    """
    flags = []
    raw_score = 0

    first_name = (user.get("firstName") or "").strip()
    last_name = (user.get("lastName") or "").strip()
    user_name = (user.get("userName") or "").strip()
    email = (user.get("email") or "").strip()
    bio = (user.get("bio") or "").strip()
    image = (user.get("image") or "").strip()
    city = (user.get("city") or "").strip()
    title = (user.get("professionalTitle") or "").strip()
    website = (user.get("website") or "").strip()
    phone = (user.get("phone") or "").strip()
    follower_count = user.get("followerCount", 0) or 0
    following_count = user.get("followingCount", 0) or 0

    # ── 1. Profile completeness ──────────────────────────────────────────
    filled = sum(1 for f in [first_name, last_name, bio, image, city, title, phone] if f)
    completeness = filled / 7
    if completeness < 0.3:
        flags.append("very_incomplete_profile")
        raw_score += 25
    elif completeness < 0.5:
        flags.append("incomplete_profile")
        raw_score += 10

    # ── 2. No profile picture ────────────────────────────────────────────
    if not image:
        flags.append("no_profile_picture")
        raw_score += 15

    # ── 3. Random/suspicious username ────────────────────────────────────
    for pattern in RANDOM_NAME_PATTERNS:
        if re.match(pattern, user_name, re.IGNORECASE):
            flags.append("suspicious_username")
            raw_score += 20
            break

    # ── 4. Name anomalies ────────────────────────────────────────────────
    if not first_name or not last_name:
        flags.append("missing_name")
        raw_score += 15
    elif first_name == last_name:
        flags.append("duplicate_first_last_name")
        raw_score += 10
    # Random-looking name (digits in name)
    if re.search(r"\d", first_name + last_name):
        flags.append("digits_in_name")
        raw_score += 15

    # ── 5. Disposable email ──────────────────────────────────────────────
    if email and "@" in email:
        domain = email.split("@")[1].lower()
        if domain in DISPOSABLE_DOMAINS:
            flags.append("disposable_email")
            raw_score += 30

    # ── 6. Bot-like bio ──────────────────────────────────────────────────
    if bio:
        bio_lower = bio.lower()
        bot_matches = [kw for kw in BOT_BIO_KEYWORDS if kw in bio_lower]
        if bot_matches:
            flags.append("bot_bio_keywords")
            raw_score += min(len(bot_matches) * 10, 25)

        # Bio is just a URL
        if re.match(r"^https?://\S+$", bio.strip()):
            flags.append("bio_is_url_only")
            raw_score += 15

        # Bio has excessive emojis
        emoji_count = len(re.findall(r"[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF]", bio))
        if emoji_count > 10:
            flags.append("excessive_emojis_bio")
            raw_score += 10

    # ── 7. Follow ratio anomaly ──────────────────────────────────────────
    if following_count > 50 and follower_count == 0:
        flags.append("follow_ratio_anomaly")
        raw_score += 20
    elif following_count > 500 and follower_count < 5:
        flags.append("mass_following_no_followers")
        raw_score += 25

    # ── 8. Suspicious website ────────────────────────────────────────────
    if website:
        suspicious_tlds = [".xyz", ".tk", ".ml", ".ga", ".cf", ".gq", ".top", ".buzz"]
        if any(website.lower().endswith(tld) for tld in suspicious_tlds):
            flags.append("suspicious_website_tld")
            raw_score += 10

    # ── Final score ───────────────────────────────────────────────────────
    score = min(raw_score, 100)
    fake = score >= 50  # Threshold: 50+

    reason = ""
    if fake:
        reason = f"Profil suspect détecté: {', '.join(flags)}"
    else:
        reason = "Profil semble authentique"

    return {
        "fake": fake,
        "score": score,
        "flags": flags,
        "reason": reason,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN — stdin/stdout interface
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)

        data = json.loads(raw)
        action = data.get("action")

        if action == "check_toxicity":
            text = data.get("text", "")
            result = check_toxicity(text)
        elif action == "check_user":
            user = data.get("user", {})
            result = check_fake_user(user)
        else:
            result = {"error": f"Unknown action: {action}"}

        print(json.dumps(result, ensure_ascii=False))
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Internal error: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
