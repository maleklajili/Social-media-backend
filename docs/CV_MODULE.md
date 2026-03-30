# Documentation : Module CV (Manuel & IA)

Ce document explique l'architecture et le fonctionnement du module de génération de CV dans le backend.

---

## Vue d'ensemble

Le système propose **deux modes** de création de CV :

| Mode           | Description                                                              | Endpoint Prefix |
| -------------- | ------------------------------------------------------------------------ | --------------- |
| **CV Manuel**  | L'utilisateur remplit un formulaire structuré                            | `/manual-cv`    |
| **CV avec IA** | Le CV est généré automatiquement par l'IA à partir du profil utilisateur | `/ai-cv`        |

Les deux modes partagent le même **pipeline de rendu PDF** (Python + Jinja2 + xhtml2pdf).

---

## Architecture des fichiers

```
Social-media-backend/
├── src/
│   ├── models/
│   │   ├── manual-cv.ts          # Modèle MongoDB du CV manuel
│   │   └── ai-cv.ts              # Modèle MongoDB du CV IA
│   ├── controllers/
│   │   ├── manual-cv-controller.ts   # Routes du CV manuel
│   │   └── ai-cv-controller.ts       # Routes du CV IA
│   ├── services/
│   │   ├── manual-cv-service.ts      # Logique métier CV manuel
│   │   └── ai-cv-service.ts          # Logique métier CV IA
│   ├── repositories/
│   │   ├── manual-cv-repository.ts   # Accès DB CV manuel
│   │   └── ai-cv-repository.ts       # Accès DB CV IA
│   ├── interfaces/
│   │   ├── manual-cv/
│   │   │   ├── i-manual-cv-service.ts
│   │   │   └── i-manual-cv-repository.ts
│   │   └── ai-cv/
│   │       ├── i-ai-cv-service.ts
│   │       └── i-ai-cv-repository.ts
│   └── utils/
│       └── cv-pdf-renderer.ts     # Appelle le script Python pour le rendu PDF
│
└── python-ai/
    ├── generate_cv.py             # Génération de texte CV via Ollama (IA locale)
    ├── render_cv_pdf.py           # Conversion Markdown → HTML → PDF
    └── templates/
        ├── standard.html          # Template classique noir/gris
        ├── canadian.html          # Template bleu, style canadien
        ├── european.html          # Template vert teal, style Europass
        ├── modern.html            # Template avec sidebar latérale sombre
        └── latex.html             # Template serif, style académique LaTeX
```

---

## 1. CV Manuel

### Modèle (`models/manual-cv.ts`)

```typescript
interface ManualCv {
  userId: ObjectId;
  title: string; // Titre du CV (ex: "Mon CV Dev")
  format: ManualCvFormat; // "standard" | "canadian" | "modern" | "european"
  language: string; // "fr" | "en"
  personalInfo: ManualCvPersonalInfo; // Nom, email, téléphone, résumé...
  experiences: ManualCvExperience[]; // Liste des expériences pro
  educations: ManualCvEducation[]; // Liste des formations
  skills: ManualCvSkill[]; // Compétences (nom + niveau)
  languages: ManualCvLanguage[]; // Langues (nom + niveau)
  projects: string[]; // Projets
  certifications: string[]; // Certifications
  interests: string[]; // Centres d'intérêt
}
```

### Endpoints (`controllers/manual-cv-controller.ts`)

Tous les endpoints nécessitent l'authentification (`authMiddleware`).

| Méthode  | Route                         | Description                             |
| -------- | ----------------------------- | --------------------------------------- |
| `POST`   | `/manual-cv/create`           | Créer un nouveau CV                     |
| `GET`    | `/manual-cv/my-cvs`           | Lister tous les CV de l'utilisateur     |
| `GET`    | `/manual-cv/get/:id`          | Récupérer un CV par son ID              |
| `PUT`    | `/manual-cv/update/:id`       | Mettre à jour un CV                     |
| `DELETE` | `/manual-cv/delete/:id`       | Supprimer un CV                         |
| `GET`    | `/manual-cv/download-pdf/:id` | Télécharger le CV en PDF                |
| `POST`   | `/manual-cv/import-profile`   | Créer un CV pré-rempli depuis le profil |

### Flux de création

```
1. L'utilisateur remplit le formulaire (Flutter)
2. POST /manual-cv/create → sauvegarde en MongoDB
3. GET /manual-cv/download-pdf/:id →
   a. Récupère le CV depuis la DB
   b. Convertit les données en Markdown (convertToMarkdown)
   c. Récupère la photo de profil de l'utilisateur
   d. Appelle CvPdfRenderer.renderPdf(markdown, format, photoUrl)
   e. Retourne le binaire PDF
```

### Import depuis le profil

`POST /manual-cv/import-profile` permet de créer un CV pré-rempli à partir des données existantes du profil utilisateur (expériences, formations, compétences). Le body accepte :

- `format` : format du template (optionnel, défaut: `"standard"`)
- `language` : langue (optionnel, défaut: `"fr"`)

---

## 2. CV avec IA

### Modèle (`models/ai-cv.ts`)

```typescript
interface AiCv {
  userId: ObjectId;
  title: string;
  content: string; // Contenu Markdown généré par l'IA
  section: AiCvSection; // "full" | "summary" | "experience" | "education" | "skills" | "projects"
  format: AiCvFormat; // "standard" | "canadian" | "latex" | "modern" | "european"
  status: AiCvStatus; // "generated" | "reformulated" | "draft"
  language: string;
  promptUsed?: string;
  version: number; // Numéro de version (incrémenté lors des reformulations)
  parentId?: ObjectId; // Référence au CV parent si reformulé
}
```

### Endpoints (`controllers/ai-cv-controller.ts`)

| Méthode  | Route                     | Description                            |
| -------- | ------------------------- | -------------------------------------- |
| `POST`   | `/ai-cv/generate`         | Générer un nouveau CV avec l'IA        |
| `POST`   | `/ai-cv/reformulate/:id`  | Reformuler/améliorer un CV existant    |
| `GET`    | `/ai-cv/my-cvs`           | Lister tous les CV IA de l'utilisateur |
| `GET`    | `/ai-cv/download-pdf/:id` | Télécharger le CV en PDF               |
| `DELETE` | `/ai-cv/delete/:id`       | Supprimer un CV                        |

### Body de génération (`POST /ai-cv/generate`)

```json
{
  "language": "fr", // "fr" ou "en" (défaut: "fr")
  "section": "full", // Section à générer (défaut: "full")
  "format": "standard", // Template à utiliser (défaut: "standard")
  "customPrompt": "..." // Instructions personnalisées (optionnel)
}
```

### Flux de génération IA

```
1. POST /ai-cv/generate →
   a. Récupère le profil complet de l'utilisateur (user, expériences, formations, skills, projets)
   b. Construit un prompt détaillé avec les données du profil
   c. Envoie le prompt à HuggingFace (ou Ollama en local) via generate_cv.py
   d. L'IA retourne du contenu Markdown structuré
   e. Sauvegarde le CV en MongoDB avec status: "generated"
   f. Retourne le CV créé

2. POST /ai-cv/reformulate/:id →
   a. Récupère le CV existant
   b. Envoie le contenu + instructions au modèle IA
   c. Crée une nouvelle version (version + 1, parentId = ancien CV)
   d. Sauvegarde avec status: "reformulated"
```

### Formats avec prompts spécialisés

Chaque format a un **system prompt** dédié dans `generate_cv.py` :

| Format     | Style      | Particularités                                     |
| ---------- | ---------- | -------------------------------------------------- |
| `standard` | Classique  | ATS-optimisé, sections standard                    |
| `canadian` | Canadien   | Sans photo/âge, méthode STAR, résultats quantifiés |
| `latex`    | Académique | Style LaTeX, serif, compact, publications          |
| `european` | Europass   | 2 colonnes, photo, niveaux de compétences          |
| `modern`   | Moderne    | Design épuré, sidebar, barres de compétences       |

---

## 3. Pipeline de rendu PDF

Le rendu PDF est **commun** aux deux modes (manuel et IA).

### Étapes

```
Données CV → Markdown → parse_markdown_to_sections() → Jinja2 Template → HTML → xhtml2pdf → PDF binaire
```

### Fichiers impliqués

1. **`cv-pdf-renderer.ts`** (TypeScript) — Lance le script Python en subprocess :

   ```typescript
   CvPdfRenderer.renderPdf(content: string, format: string, photoUrl: string): Promise<Buffer>
   ```

   Envoie un JSON `{content, format, photoUrl}` via stdin au script Python.

2. **`render_cv_pdf.py`** (Python) — Reçoit le JSON, parse le Markdown en sections, charge le template Jinja2 correspondant, et génère le PDF.

3. **`templates/*.html`** — Templates Jinja2 HTML rendus par xhtml2pdf.

### Variables disponibles dans les templates

```
cv.name                    → Nom complet
cv.title                   → Titre professionnel
cv.contact_info.email      → Email
cv.contact_info.phone      → Téléphone
cv.contact_info.location   → Ville / Localisation
cv.contact_info.linkedin   → Profil LinkedIn
cv.contact_info.website    → Site web / Portfolio
cv.summary                 → Résumé / Profil professionnel

cv.experience[]            → Liste des expériences
  .post                    → Intitulé du poste
  .company                 → Entreprise
  .dates                   → Période (ex: "2020 - 2023")
  .achievements[]          → Liste des réalisations

cv.education[]             → Liste des formations
  .degree                  → Diplôme
  .school                  → Établissement
  .dates                   → Période

cv.skills[]                → Liste des compétences
  .name                    → Nom de la compétence
  .category                → Catégorie (optionnel)
  .level                   → Niveau (optionnel)

cv.languages[]             → Liste des langues
  .name                    → Nom de la langue
  .level                   → Niveau (A1-C2, Natif)

cv.certifications[]        → Liste de strings
cv.interests[]             → Liste de strings
cv.projects[]              → Liste de projets
  .title                   → Titre du projet
  .description             → Description

photo_url                  → URL de la photo de profil
```

### Filtre Jinja2 personnalisé

`level_to_percent` — Convertit un niveau textuel en pourcentage (utilisé pour les barres de progression) :

- Expert / C2 / Natif → 95%
- Avancé / C1 → 80%
- Intermédiaire / B2 → 65%
- Débutant / A1 → 30%

### Contrainte xhtml2pdf

Le moteur de rendu **xhtml2pdf** ne supporte **PAS** CSS Grid ni Flexbox. Tous les templates utilisent des **layouts basés sur `<table>`** pour les mises en page multi-colonnes.

---

## 5 Templates PDF

| Template        | Couleur                                     | Style                                                         | Photo                    |
| --------------- | ------------------------------------------- | ------------------------------------------------------------- | ------------------------ |
| `standard.html` | Noir / Gris                                 | Centré, classique, uppercase                                  | Centrée au-dessus du nom |
| `canadian.html` | Bleu (#1e3a8a)                              | Barres de section bleues, 2 colonnes de skills                | À gauche du nom          |
| `european.html` | Teal (#0f766e)                              | Titres soulignés, contact vertical                            | À gauche du nom          |
| `modern.html`   | Sidebar sombre (#2d3748) + Violet (#667eea) | Sidebar avec photo/contact/skills, contenu principal à droite | Dans la sidebar          |
| `latex.html`    | Noir minimaliste                            | Serif (Times New Roman), style académique                     | Centrée, petite          |

---

## Prérequis Python

Pour le rendu PDF, les dépendances Python suivantes sont nécessaires :

```bash
pip install jinja2 xhtml2pdf ollama
```

Le script `generate_cv.py` utilise **Ollama** (modèle Llama3 en local) pour la génération IA.
Le script `render_cv_pdf.py` utilise **Jinja2** + **xhtml2pdf** pour le rendu PDF.
