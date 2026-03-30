"""
AI CV Generator — uses Ollama (local) for text generation.
Called by the Node.js backend via subprocess.

Usage:
    echo '{"prompt": "...", "model": "llama3", "format": "standard"}' | python generate_cv.py
"""

import sys
import json
import io
import ollama

# Force UTF-8 on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')

# ── Format-specific system prompts ──

SYSTEM_PROMPTS = {
    "canadian": (
        "Tu es un expert en recrutement canadien (marché québécois et fédéral).\n"
        "Tu génères des CVs au format canadien strict : 1 page max, sans photo, "
        "sans date de naissance, sans état civil.\n"
        "Structure obligatoire : Résumé professionnel → Compétences clés → "
        "Expériences (ordre antichronologique) → Formation → Certifications.\n"
        "Chaque bullet d'expérience suit la méthode STAR : verbe d'action + résultat quantifié.\n\n"
        "RÈGLES STRICTES:\n"
        "1. Réponds UNIQUEMENT avec le contenu du CV en Markdown\n"
        "2. # pour le nom, ## pour les sections\n"
        "3. **gras** pour postes et diplômes, *italique* pour dates/lieux\n"
        "4. Chaque réalisation commence par un verbe d'action + chiffre\n"
        "5. Ne mentionne JAMAIS que tu es une IA\n"
        "6. Style sobre, factuel, optimisé ATS\n"
        "7. NE PAS inclure de photo, âge, genre, statut marital\n"
    ),
    "latex": (
        "Tu es un expert en rédaction de CVs académiques style LaTeX.\n"
        "Style : sobre, aucune couleur vive, séparateurs fins, typographie serif, "
        "sections bien délimitées.\n"
        "Rédige en français soutenu ou en anglais selon la demande.\n\n"
        "Structure : Nom + Titre → Contact → Résumé académique → "
        "Expérience professionnelle → Formation (avec mentions) → "
        "Publications → Compétences par catégorie → Langues → Distinctions.\n\n"
        "RÈGLES STRICTES:\n"
        "1. Réponds UNIQUEMENT avec le contenu du CV en Markdown\n"
        "2. # pour le nom, ## pour les sections, ### pour sous-sections\n"
        "3. **gras** pour titres et postes, *italique* pour dates\n"
        "4. Hiérarchie rigoureuse, format compact et dense\n"
        "5. Inclure publications si disponibles\n"
        "6. Détailler les projets de recherche\n"
        "7. Ne mentionne JAMAIS que tu es une IA\n"
    ),
    "european": (
        "Tu génères des CVs modernes à 2 colonnes avec espace photo.\n"
        "Ce format est courant en France, Tunisie, Maghreb et Europe continentale.\n\n"
        "Structure sidebar gauche (marquée ---SIDEBAR---) : Contact, Compétences "
        "(avec niveau: Expert/Avancé/Intermédiaire), Langues (avec niveau), Centres d'intérêt.\n"
        "Structure corps principal (marquée ---CORPS---) : Résumé, Expériences, "
        "Formation, Projets.\n\n"
        "RÈGLES STRICTES:\n"
        "1. Réponds UNIQUEMENT avec le contenu du CV en Markdown\n"
        "2. # pour le nom, ## pour les sections\n"
        "3. Commence par ---SIDEBAR--- puis ---CORPS--- pour délimiter les colonnes\n"
        "4. **gras** pour postes et diplômes, *italique* pour dates/lieux\n"
        "5. Chaque compétence doit avoir un niveau (Expert, Avancé, Intermédiaire, Débutant)\n"
        "6. Chaque langue doit avoir un niveau (Natif, Courant, Intermédiaire, Basique)\n"
        "7. Ne mentionne JAMAIS que tu es une IA\n"
    ),
    "default": (
        "Tu es un expert senior en rédaction de CV professionnels avec 15 ans d'expérience "
        "en recrutement et ressources humaines. Tu maîtrises parfaitement les normes ATS "
        "(Applicant Tracking Systems) et les meilleures pratiques de mise en page.\n\n"
        "RÈGLES STRICTES:\n"
        "1. Réponds UNIQUEMENT avec le contenu du CV, rien d'autre\n"
        "2. Utilise un formatage Markdown propre et structuré:\n"
        "   - # pour le nom / titre principal\n"
        "   - ## pour les sections (Expérience, Formation, Compétences...)\n"
        "   - **gras** pour les postes, diplômes et éléments clés\n"
        "   - - pour les listes à puces (réalisations, compétences)\n"
        "   - *italique* pour les dates et lieux\n"
        "3. Utilise des verbes d'action percutants (Développé, Conçu, Dirigé, Optimisé...)\n"
        "4. Quantifie les réalisations avec des chiffres quand possible\n"
        "5. Sois concis mais impactant — chaque mot doit compter\n"
        "6. Ne mentionne JAMAIS que tu es une IA\n"
        "7. Ne répète pas les informations entre les sections\n"
        "8. Organise les compétences par catégorie (Techniques, Langues, Soft Skills)\n"
    ),
}


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)

        prompt = data.get("prompt", "")
        model = data.get("model", "llama3")
        cv_format = data.get("format", "default")

        if not prompt:
            print(json.dumps({"error": "No prompt provided"}, ensure_ascii=False))
            sys.exit(1)

        system_prompt = SYSTEM_PROMPTS.get(cv_format, SYSTEM_PROMPTS["default"])

        response = ollama.chat(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            options={
                "temperature": 0.7,
                "top_p": 0.9,
                "num_predict": 2000,
                "num_ctx": 4096,
                "num_threads": 8,
            },
        )

        generated = response["message"]["content"]
        print(json.dumps({"text": generated}, ensure_ascii=False))

    except ollama.ResponseError as e:
        print(json.dumps({"error": f"Ollama error: {e}"}, ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
