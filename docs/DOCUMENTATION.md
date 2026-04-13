# CvTech — Documentation Technique Complète

> **Réseau social professionnel intelligent** avec génération de CV par IA, modération automatique de contenu, matching emploi et système de paiement intégré.

---

## Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Technologies utilisées](#2-technologies-utilisées)
3. [Architecture logique](#3-architecture-logique)
4. [Fonctionnalités](#4-fonctionnalités)
5. [Modules IA](#5-modules-ia)
6. [API Backend — Endpoints](#6-api-backend--endpoints)
7. [Application Mobile (Flutter)](#7-application-mobile-flutter)
8. [Application Web (Next.js)](#8-application-web-nextjs)
9. [Base de données](#9-base-de-données)
10. [Communication temps réel](#10-communication-temps-réel)
11. [Déploiement](#11-déploiement)

---

## 1. Vue d'ensemble

CvTech est une plateforme sociale professionnelle complète composée de 3 applications :

| Composant              | Technologie                | Rôle                                      |
| ---------------------- | -------------------------- | ----------------------------------------- |
| **Backend API**        | Bun + TypeScript + Express | Serveur REST, WebSocket, orchestration IA |
| **Application Mobile** | Flutter (Dart)             | Client mobile Android/iOS                 |
| **Application Web**    | Next.js 16 (React 19)      | Client web responsive                     |
| **Module IA**          | Python (Ollama, TF-IDF)    | CV generation, modération, job matching   |

### Arborescence du projet

```
PFE-Stage2026/
├── Social-media-backend/    # API REST + WebSocket + Python AI
│   ├── src/                 # Code TypeScript (controllers, services, models...)
│   └── python-ai/           # Scripts IA Python
├── CvTech-mobile/           # Application Flutter
│   └── lib/                 # Code Dart (presentation, data, core)
├── cv-te/social-media-front/# Application Next.js
│   └── app/                 # Pages et composants React
└── Rapport_PFE_App_Salary_Maxit_/ # Rapport LaTeX
```

---

## 2. Technologies utilisées

### Backend

| Technologie    | Version      | Usage                                            |
| -------------- | ------------ | ------------------------------------------------ |
| **Bun**        | Latest       | Runtime TypeScript haute performance             |
| **Express.js** | 5.2.1        | Framework HTTP REST                              |
| **MongoDB**    | 6.16.0       | Base de données NoSQL                            |
| **Socket.IO**  | 4.8.3        | Communication temps réel (chat, notifications)   |
| **JWT**        | jsonwebtoken | Authentification (access + refresh tokens)       |
| **SendGrid**   | 8.1.5        | Envoi d'emails (OTP, reset password)             |
| **Multer**     | 2.0.1        | Upload de fichiers (images, documents)           |
| **Python 3**   | —            | Scripts IA (génération CV, modération, matching) |
| **Ollama**     | Llama 3.2    | LLM local pour la génération de CV               |

### Mobile (Flutter)

| Technologie                    | Version    | Usage                           |
| ------------------------------ | ---------- | ------------------------------- |
| **Flutter**                    | SDK ^3.7.1 | Framework UI cross-platform     |
| **Dart**                       | —          | Langage de programmation        |
| **Provider**                   | ^6.1.5     | Gestion d'état (ChangeNotifier) |
| **Dio**                        | ^5.4.3+1   | Client HTTP                     |
| **Socket.IO Client**           | ^3.0.2     | Chat temps réel                 |
| **flutter_secure_storage**     | —          | Stockage sécurisé des tokens    |
| **pdf + printing**             | ^5.13.4    | Génération et impression PDF    |
| **image_picker + file_picker** | —          | Sélection fichiers/images       |
| **intl**                       | ^0.20.2    | Internationalisation (FR/EN)    |

### Frontend Web (Next.js)

| Technologie             | Version | Usage                                              |
| ----------------------- | ------- | -------------------------------------------------- |
| **Next.js**             | 16.1.1  | Framework React SSR/SSG                            |
| **React**               | 19.2.0  | Bibliothèque UI                                    |
| **Radix UI**            | —       | Composants accessibles (Dialog, Dropdown, Tabs...) |
| **Tiptap**              | —       | Éditeur de texte riche                             |
| **Socket.IO Client**    | 4.8.3   | Chat temps réel                                    |
| **html2canvas + jsPDF** | —       | Export PDF côté client                             |
| **React Hook Form**     | —       | Gestion de formulaires                             |
| **Tailwind CSS**        | —       | Framework CSS utilitaire                           |

---

## 3. Architecture logique

### Architecture globale (3-tiers)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Clients        │    │   Backend API    │    │   Données        │
│                  │    │                  │    │                  │
│  ┌────────────┐  │    │  ┌────────────┐  │    │  ┌────────────┐  │
│  │ Flutter    │──┼────┼──│ Express    │──┼────┼──│ MongoDB    │  │
│  │ Mobile     │  │    │  │ REST API   │  │    │  │ Atlas      │  │
│  └────────────┘  │    │  └────────────┘  │    │  └────────────┘  │
│                  │    │                  │    │                  │
│  ┌────────────┐  │    │  ┌────────────┐  │    │  ┌────────────┐  │
│  │ Next.js    │──┼────┼──│ Socket.IO  │  │    │  │ File       │  │
│  │ Web App    │  │    │  │ WebSocket  │  │    │  │ System     │  │
│  └────────────┘  │    │  └────────────┘  │    │  └────────────┘  │
│                  │    │                  │    │                  │
│                  │    │  ┌────────────┐  │    │                  │
│                  │    │  │ Python AI  │  │    │                  │
│                  │    │  │ (subprocess│  │    │                  │
│                  │    │  └────────────┘  │    │                  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Architecture Backend (Clean Architecture)

```
src/
├── controllers/       # 27 contrôleurs — Routing + validation des requêtes
│   └── base/          # BaseController générique (CRUD automatique)
├── services/          # Logique métier
│   └── base/          # BaseService générique
├── repositories/      # Accès données MongoDB
│   └── base/          # BaseRepository générique
├── models/            # Types TypeScript + schémas MongoDB
│   └── base/          # CollectionsManager (gestionnaire de collections)
├── middleware/         # Auth JWT, pagination, upload fichiers
├── routes/            # Décorateurs @Get, @Post, @Put, @Delete, @Patch
├── config/            # Configuration serveur, variables d'environnement
├── socket/            # Gestionnaires Socket.IO (chat, notifications)
└── utils/             # Helpers (réponses, clients IA, validation)

python-ai/
├── generate_cv.py     # Génération de CV via Ollama LLM
├── content_moderator.py # Détection toxicité + faux utilisateurs
├── job_matcher.py     # Matching emploi TF-IDF
├── render_cv_pdf.py   # Conversion HTML → PDF
└── templates/         # Templates HTML Jinja2 (5 formats de CV)
```

### Architecture Mobile Flutter (MVVM)

```
lib/
├── main.dart              # Point d'entrée, providers, MaterialApp
├── app.dart               # Configuration de l'application
├── constants/             # URLs API, couleurs, chaînes
├── core/                  # Réseau (ApiClient, Dio, intercepteurs)
├── data/
│   ├── models/            # Modèles de données (User, Post, Job, CV...)
│   └── repositories/      # Accès API (HTTP calls via Dio)
├── presentation/
│   ├── views/             # Écrans UI (pages)
│   └── views_models/      # ViewModels (logique + état)
├── theme/                 # Thème Material (clair/sombre)
└── utils/                 # Utilitaires, helpers
```

### Pattern de routage backend (décorateurs)

Le backend utilise un système de routage par **décorateurs TypeScript** :

```typescript
@Get("/endpoint", [authMiddleware])      // GET avec authentification
@Post("/endpoint", [authMiddleware])     // POST avec authentification
@Put("/endpoint/:id", [authMiddleware])  // PUT avec paramètre URL
@Delete("/endpoint/:id", [authMiddleware]) // DELETE
```

Les contrôleurs sont automatiquement enregistrés via `ControllerManager.getAllControllers()`.

### Format de réponse API standard

```json
{
  "success": true,
  "data": {
    /* payload */
  }
}
```

```json
{
  "success": false,
  "message": "Description de l'erreur"
}
```

---

## 4. Fonctionnalités

### 4.1 Authentification & Utilisateurs

| Fonctionnalité          | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| Inscription             | Création de compte avec vérification OTP par email (SendGrid) |
| Connexion               | JWT (access token 1j + refresh token 7j)                      |
| Reset mot de passe      | Envoi d'email avec lien de réinitialisation                   |
| Profil utilisateur      | Photo, bio, titre professionnel, ville, site web, téléphone   |
| Recherche utilisateurs  | Recherche par nom, filtre par compétences                     |
| Système follow/unfollow | Suivre/ne plus suivre des utilisateurs                        |

### 4.2 Réseau Social (Feed)

| Fonctionnalité  | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| Fil d'actualité | Feed mixte : posts + suggestions emploi + suggestions de personnes |
| Stories         | Barre de stories horizontale (style LinkedIn/Instagram)            |
| Publications    | Texte, images, vidéos, pièces jointes, sondages                    |
| Réactions       | Like, love, bravo, drôle, triste, intéressant                      |
| Commentaires    | Système de commentaires imbriqués                                  |
| Partage         | Partager un post avec commentaire personnel                        |
| Sauvegarde      | Sauvegarder des posts pour plus tard                               |
| Communautés     | Créer/rejoindre des groupes thématiques, posts communautaires      |
| Groupes d'amis  | Organiser ses contacts en groupes personnalisés                    |

### 4.3 Messagerie temps réel

| Fonctionnalité     | Description                                                    |
| ------------------ | -------------------------------------------------------------- |
| Chat privé         | Messagerie directe en temps réel (Socket.IO)                   |
| Notifications push | Notifications en temps réel pour likes, commentaires, messages |

### 4.4 Gestion de CV

| Fonctionnalité   | Description                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| CV manuel        | Création de CV étape par étape (infos perso, expériences, éducation, compétences, projets, certifications) |
| CV par IA        | Génération automatique via Ollama LLM (5 formats, 2 langues)                                               |
| Reformulation IA | Modifier un CV existant avec de nouvelles instructions                                                     |
| Export PDF       | Téléchargement PDF stylisé (couleurs, polices personnalisables)                                            |
| 5 templates      | Standard, Canadien, Européen, LaTeX, Modern                                                                |

### 4.5 Emplois & Recrutement

| Fonctionnalité       | Description                                                                           |
| -------------------- | ------------------------------------------------------------------------------------- |
| Offres d'emploi      | Publication d'offres (titre, description, compétences, localisation, type de contrat) |
| Candidatures         | Postuler avec CV, lettre de motivation, statut de suivi                               |
| Matching IA          | Recommandation d'emplois basée sur le profil (TF-IDF + cosine similarity)             |
| Gestion entreprise   | Profils d'entreprises, followers, offres publiées                                     |
| Classement candidats | Scoring et classement des candidatures par pertinence                                 |

### 4.6 Modération IA

| Fonctionnalité         | Description                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Détection toxicité     | Analyse automatique des posts à la création (score 0-100, seuil ≥ 30)                  |
| Catégories détectées   | Insultes, discours haineux, menaces, harcèlement, vulgarités, spam, ton agressif       |
| Détection faux comptes | Analyse automatique des inscriptions (score 0-100, seuil ≥ 50)                         |
| Indicateurs fake       | Profil incomplet, email jetable, username suspect, bio de bot, ratio followers anormal |
| Dashboard modération   | Stats, liste des posts/users flaggés, actions approve/reject/ban/unban                 |
| Vérification manuelle  | Outil admin pour tester la toxicité d'un texte                                         |

### 4.7 Système de Coins & Gamification

| Fonctionnalité | Description                                                        |
| -------------- | ------------------------------------------------------------------ |
| Portefeuille   | Balance de coins, historique de transactions                       |
| Missions       | Gagner des coins via des actions (compléter profil, publier, etc.) |
| Boutique       | Échanger des coins contre des avantages                            |

### 4.8 Paiement Premium (Flouci)

| Fonctionnalité  | Description                                  |
| --------------- | -------------------------------------------- |
| Plans premium   | Sélection de plans d'abonnement              |
| Paiement Flouci | Intégration passerelle de paiement Flouci    |
| Deep linking    | Retour automatique dans l'app après paiement |
| Historique      | Suivi des paiements et statuts               |

### 4.9 Profil Professionnel Complet

| Fonctionnalité | Description                           |
| -------------- | ------------------------------------- |
| Expériences    | Liste des postes occupés avec détails |
| Éducation      | Parcours scolaire et certifications   |
| Compétences    | Compétences générales et techniques   |
| Projets        | Portfolio de projets réalisés         |
| Avis           | Avis sur les entreprises              |

### 4.10 Paramètres

| Fonctionnalité | Description                     |
| -------------- | ------------------------------- |
| Thème          | Mode clair / sombre             |
| Langue         | Français / Anglais (i18n)       |
| Notifications  | Configuration des notifications |

---

## 5. Modules IA

### 5.1 Génération de CV par IA

```
Utilisateur → Backend (TypeScript) → Subprocess Python → Ollama LLM → Markdown CV
                                   → Jinja2 + xhtml2pdf → PDF stylisé
```

| Propriété       | Valeur                                                        |
| --------------- | ------------------------------------------------------------- |
| **Modèle**      | Llama 3.2 (via Ollama, exécution locale)                      |
| **Température** | 0.25 (haute précision)                                        |
| **Contexte**    | 4096 tokens                                                   |
| **Max output**  | 2500 tokens                                                   |
| **Formats**     | Standard, Canadien (CRHA), Européen (Europass), LaTeX, Modern |
| **Langues**     | Français, Anglais                                             |
| **Sections**    | full, summary, experience, education, skills, projects        |

**Flux :**

1. Le backend agrège le profil utilisateur (expériences, éducation, compétences, projets)
2. Un prompt système spécifique au format est sélectionné
3. Ollama génère le CV en Markdown
4. Le CV est stocké en base avec métadonnées (version, format, langue)
5. Pour le PDF : le Markdown est rendu dans un template HTML Jinja2 puis converti en PDF

### 5.2 Modération de Contenu

```
Nouveau post/inscription → Backend → Subprocess Python → Analyse → Flag si toxique/suspect
```

| Composant                | Détails                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **Détection toxicité**   | Matching de mots-clés (FR + EN) + patterns regex + heuristiques                           |
| **Catégories**           | insult, hate_speech, threat, harassment, profanity, spam, aggressive_tone                 |
| **Seuil toxicité**       | Score ≥ 30 / 100                                                                          |
| **Détection faux users** | Analyse profil : complétude, email jetable, username suspect, bio de bot, ratio followers |
| **Seuil fake user**      | Score ≥ 50 / 100                                                                          |
| **Intégration**          | Automatique à la création de post et à l'inscription                                      |

### 5.3 Matching Emploi Intelligent

```
Profil utilisateur + Offres actives → Python TF-IDF → Score 0-100 par offre → Tri décroissant
```

| Composant          | Détails                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| **Algorithme**     | TF-IDF + Cosine Similarity                                                                         |
| **Scoring**        | 70% similarité textuelle + 30% correspondance directe compétences                                  |
| **Données profil** | Titre pro, bio, compétences, expériences, éducation, projets, certifications, intérêts             |
| **Données emploi** | Titre, description, compétences requises, localisation, type contrat, expérience, politique remote |

---

## 6. API Backend — Endpoints

**Base URL :** `http://localhost:9000/api`
**Authentification :** Bearer Token JWT (header `Authorization: Bearer <token>`)

### 6.1 Authentification (`/auth`)

| Méthode | Endpoint                | Description                                                     |
| ------- | ----------------------- | --------------------------------------------------------------- |
| POST    | `/auth/login`           | Connexion (retourne access + refresh tokens)                    |
| POST    | `/auth/register`        | Inscription (déclenche vérification OTP + analyse fake user IA) |
| POST    | `/auth/verify-otp`      | Vérifier le code OTP                                            |
| POST    | `/auth/resend-otp`      | Renvoyer le code OTP                                            |
| POST    | `/auth/forgot-password` | Demander un email de réinitialisation                           |
| POST    | `/auth/reset-password`  | Réinitialiser le mot de passe                                   |
| POST    | `/auth/refresh-token`   | Rafraîchir le token                                             |
| POST    | `/auth/logout`          | Déconnexion                                                     |

### 6.2 Utilisateurs (`/user`)

| Méthode | Endpoint              | Description                    |
| ------- | --------------------- | ------------------------------ |
| GET     | `/user/profile`       | Mon profil                     |
| GET     | `/user/:id`           | Profil d'un utilisateur        |
| PUT     | `/user/update`        | Modifier mon profil            |
| PUT     | `/user/update-image`  | Changer la photo de profil     |
| PUT     | `/user/update-cover`  | Changer la photo de couverture |
| GET     | `/user/search`        | Rechercher des utilisateurs    |
| POST    | `/user/follow/:id`    | Suivre un utilisateur          |
| POST    | `/user/unfollow/:id`  | Ne plus suivre                 |
| GET     | `/user/followers/:id` | Liste des followers            |
| GET     | `/user/following/:id` | Liste des suivis               |
| GET     | `/user/suggestions`   | Suggestions de personnes       |

### 6.3 Publications (`/posts`)

| Méthode | Endpoint               | Description                                            |
| ------- | ---------------------- | ------------------------------------------------------ |
| GET     | `/posts/feed`          | Fil d'actualité (paginé)                               |
| POST    | `/posts/create`        | Créer un post (texte, image, vidéo, sondage)           |
| GET     | `/posts/:id`           | Détail d'un post                                       |
| PUT     | `/posts/:id`           | Modifier un post                                       |
| DELETE  | `/posts/:id`           | Supprimer un post                                      |
| POST    | `/posts/:id/vote`      | Réagir (like, love, bravo, drôle, triste, intéressant) |
| POST    | `/posts/:id/comment`   | Commenter                                              |
| GET     | `/posts/:id/comments`  | Lister les commentaires                                |
| POST    | `/posts/:id/share`     | Partager                                               |
| POST    | `/posts/:id/save`      | Sauvegarder                                            |
| GET     | `/posts/saved`         | Posts sauvegardés                                      |
| GET     | `/posts/user/:id`      | Posts d'un utilisateur                                 |
| GET     | `/posts/community/:id` | Posts d'une communauté                                 |

### 6.4 Communautés (`/communities`)

| Méthode | Endpoint                   | Description             |
| ------- | -------------------------- | ----------------------- |
| GET     | `/communities`             | Lister les communautés  |
| POST    | `/communities`             | Créer une communauté    |
| GET     | `/communities/:id`         | Détail d'une communauté |
| PUT     | `/communities/:id`         | Modifier                |
| DELETE  | `/communities/:id`         | Supprimer               |
| POST    | `/communities/:id/join`    | Rejoindre               |
| POST    | `/communities/:id/leave`   | Quitter                 |
| GET     | `/communities/:id/members` | Membres                 |
| GET     | `/communities/my`          | Mes communautés         |

### 6.5 CV par IA (`/ai-cv`)

| Méthode | Endpoint                  | Description                  |
| ------- | ------------------------- | ---------------------------- |
| POST    | `/ai-cv/generate`         | Générer un CV via Ollama LLM |
| POST    | `/ai-cv/reformulate/:id`  | Reformuler un CV existant    |
| GET     | `/ai-cv/my-cvs`           | Lister mes CVs IA            |
| GET     | `/ai-cv/download-pdf/:id` | Télécharger en PDF           |
| DELETE  | `/ai-cv/delete/:id`       | Supprimer un CV              |

### 6.6 CV Manuel (`/manual-cv`)

| Méthode | Endpoint            | Description            |
| ------- | ------------------- | ---------------------- |
| POST    | `/manual-cv`        | Créer un CV manuel     |
| GET     | `/manual-cv/my-cvs` | Lister mes CVs manuels |
| GET     | `/manual-cv/:id`    | Détail d'un CV         |
| PUT     | `/manual-cv/:id`    | Modifier               |
| DELETE  | `/manual-cv/:id`    | Supprimer              |

### 6.7 Emplois (`/jobs`)

| Méthode | Endpoint            | Description                                    |
| ------- | ------------------- | ---------------------------------------------- |
| GET     | `/jobs`             | Lister les offres                              |
| POST    | `/jobs`             | Publier une offre                              |
| GET     | `/jobs/:id`         | Détail d'une offre                             |
| PUT     | `/jobs/:id`         | Modifier                                       |
| DELETE  | `/jobs/:id`         | Supprimer                                      |
| GET     | `/jobs/matches`     | **IA : Offres recommandées** (TF-IDF matching) |
| GET     | `/jobs/company/:id` | Offres d'une entreprise                        |

### 6.8 Candidatures (`/job-applications`)

| Méthode | Endpoint                       | Description                 |
| ------- | ------------------------------ | --------------------------- |
| POST    | `/job-applications`            | Postuler à une offre        |
| GET     | `/job-applications/my`         | Mes candidatures            |
| GET     | `/job-applications/job/:id`    | Candidatures pour une offre |
| PUT     | `/job-applications/:id/status` | Changer le statut           |
| GET     | `/job-applications/:id`        | Détail d'une candidature    |

### 6.9 Modération IA (`/moderation`)

| Méthode | Endpoint                       | Description                       |
| ------- | ------------------------------ | --------------------------------- |
| GET     | `/moderation/flagged-posts`    | Posts signalés par l'IA           |
| GET     | `/moderation/flagged-users`    | Utilisateurs suspects             |
| GET     | `/moderation/stats`            | Statistiques de modération        |
| PUT     | `/moderation/check-text`       | Vérification manuelle de toxicité |
| PUT     | `/moderation/post/:id/approve` | Approuver un post                 |
| PUT     | `/moderation/post/:id/reject`  | Rejeter un post                   |
| PUT     | `/moderation/user/:id/ban`     | Bannir un utilisateur             |
| PUT     | `/moderation/user/:id/unban`   | Débannir                          |

### 6.10 Entreprises (`/companies`)

| Méthode | Endpoint                | Description            |
| ------- | ----------------------- | ---------------------- |
| GET     | `/companies`            | Lister les entreprises |
| POST    | `/companies`            | Créer une entreprise   |
| GET     | `/companies/:id`        | Détail                 |
| PUT     | `/companies/:id`        | Modifier               |
| DELETE  | `/companies/:id`        | Supprimer              |
| POST    | `/companies/:id/follow` | Suivre                 |
| GET     | `/companies/:id/jobs`   | Offres de l'entreprise |

### 6.11 Profil Professionnel

| Module                 | Base Path           | Endpoints          |
| ---------------------- | ------------------- | ------------------ |
| Expériences            | `/experience`       | CRUD (5 endpoints) |
| Éducation              | `/education`        | CRUD (5 endpoints) |
| Compétences            | `/skills`           | CRUD (5 endpoints) |
| Compétences techniques | `/technical-skills` | CRUD (4 endpoints) |
| Projets                | `/projects`         | CRUD (5 endpoints) |

### 6.12 Paiement (`/payment`)

| Méthode | Endpoint               | Description                 |
| ------- | ---------------------- | --------------------------- |
| POST    | `/payment/initiate`    | Initier un paiement Flouci  |
| GET     | `/payment/verify/:id`  | Vérifier le statut          |
| GET     | `/payment/my-payments` | Historique des paiements    |
| GET     | `/payment/callback`    | Callback Flouci (deep link) |

### 6.13 Transactions / Coins (`/transactions`)

| Méthode | Endpoint                | Description                 |
| ------- | ----------------------- | --------------------------- |
| GET     | `/transactions`         | Historique des transactions |
| GET     | `/transactions/balance` | Solde actuel de coins       |
| GET     | `/transactions/:type`   | Transactions par type       |

### 6.14 Autres

| Module         | Base Path        | Description                                         |
| -------------- | ---------------- | --------------------------------------------------- |
| Messages       | `/messages`      | Messagerie directe (2 endpoints)                    |
| Notifications  | `/notifications` | Notifications push (9 endpoints)                    |
| Groupes d'amis | `/friend-groups` | Organisation des contacts (10 endpoints)            |
| Avis           | `/reviews`       | Avis sur les entreprises (2 endpoints)              |
| Profil complet | `/profile`       | Profil agrégé avec toutes les données (2 endpoints) |

---

## 7. Application Mobile (Flutter)

### Écrans principaux

| Écran                | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| **Login / Register** | Authentification avec OTP                                            |
| **Home Feed**        | Fil d'actualité mixte (stories, posts, suggestions emploi/personnes) |
| **Explore**          | Découverte de contenus et utilisateurs                               |
| **Communities**      | Parcourir et gérer les communautés                                   |
| **Jobs**             | Offres d'emploi + candidatures + matching IA                         |
| **Messages**         | Chat temps réel (Socket.IO)                                          |
| **Profile**          | Profil complet avec expériences, éducation, compétences              |
| **CV Builder**       | Création de CV (manuel + IA)                                         |
| **AI CV Generator**  | Génération de CV par IA avec prévisualisation                        |
| **Notifications**    | Centre de notifications temps réel                                   |
| **Coins / Wallet**   | Portefeuille, missions, boutique                                     |
| **Premium**          | Plans d'abonnement, paiement Flouci                                  |
| **Settings**         | Thème (clair/sombre), langue (FR/EN)                                 |

### Pattern d'architecture

```
View (Widget) ←→ ViewModel (ChangeNotifier) ←→ Repository ←→ ApiClient (Dio) ←→ Backend
```

- **Provider** pour l'injection de dépendances et la gestion d'état
- **Dio** avec intercepteur JWT automatique (access token + refresh)
- **flutter_secure_storage** pour le stockage sécurisé des tokens

---

## 8. Application Web (Next.js)

### Pages principales

| Route                 | Description             |
| --------------------- | ----------------------- |
| `/login`, `/register` | Authentification        |
| `/home`               | Fil d'actualité         |
| `/explore`            | Exploration             |
| `/communities`        | Communautés             |
| `/jobs`               | Offres d'emploi         |
| `/messaging`          | Messagerie              |
| `/profile`            | Profil utilisateur      |
| `/notifications`      | Notifications           |
| `/company`            | Gestion d'entreprise    |
| `/create-post`        | Création de publication |

### Stack UI

- **Radix UI** : Composants accessibles et stylisés
- **Tiptap** : Éditeur de texte riche pour les publications
- **Tailwind CSS** : Stylisation utilitaire
- **html2canvas + jsPDF** : Export PDF côté client

---

## 9. Base de données

**Type :** MongoDB Atlas (cloud)
**Base :** `cv-techMA`

### Collections principales

| Collection        | Description                                   |
| ----------------- | --------------------------------------------- |
| `users`           | Utilisateurs (profil, auth, flags modération) |
| `posts`           | Publications (contenu, réactions, flags)      |
| `comments`        | Commentaires sur les posts                    |
| `communities`     | Communautés / groupes                         |
| `jobs`            | Offres d'emploi                               |
| `jobApplications` | Candidatures                                  |
| `companies`       | Profils d'entreprises                         |
| `experiences`     | Expériences professionnelles                  |
| `educations`      | Formations                                    |
| `skills`          | Compétences générales                         |
| `technicalSkills` | Compétences techniques                        |
| `projects`        | Projets portfolio                             |
| `aiCvs`           | CVs générés par IA                            |
| `manualCvs`       | CVs créés manuellement                        |
| `messages`        | Messages de chat                              |
| `notifications`   | Notifications                                 |
| `transactions`    | Transactions de coins                         |
| `payments`        | Paiements Flouci                              |
| `friendGroups`    | Groupes d'amis                                |
| `reviews`         | Avis entreprises                              |

---

## 10. Communication temps réel

**Technologie :** Socket.IO
**Port :** 9001 (séparé du port HTTP 9000)

### Événements Socket

| Événement          | Direction        | Description                  |
| ------------------ | ---------------- | ---------------------------- |
| `connection`       | Client → Serveur | Établissement de connexion   |
| `send-message`     | Client → Serveur | Envoyer un message           |
| `receive-message`  | Serveur → Client | Recevoir un message          |
| `new-notification` | Serveur → Client | Notification push temps réel |
| `new-post`         | Serveur → Client | Nouveau post dans le feed    |
| `typing`           | Bidirectionnel   | Indicateur de saisie         |

---

## 11. Déploiement

### Variables d'environnement requises

| Variable             | Description                    |
| -------------------- | ------------------------------ |
| `DATABASE_URL`       | URL de connexion MongoDB Atlas |
| `DATABASE_NAME`      | Nom de la base (cv-techMA)     |
| `PORT`               | Port HTTP (9000)               |
| `SOCKET_PORT`        | Port WebSocket (9001)          |
| `JWT_SECRET`         | Clé secrète JWT                |
| `EXP_ACCESS_TOKEN`   | Durée access token (1d)        |
| `EXP_REFRESH_TOKEN`  | Durée refresh token (7d)       |
| `SENDGRID_API_KEY`   | Clé API SendGrid (emails)      |
| `EMAIL_ADRESS`       | Adresse email expéditeur       |
| `HF_TOKEN`           | Token Hugging Face (optionnel) |
| `OLLAMA_MODEL`       | Modèle Ollama (llama3.2)       |
| `FLOUCI_APP_TOKEN`   | Token Flouci (paiement)        |
| `FLOUCI_APP_SECRET`  | Secret Flouci                  |
| `BACKEND_PUBLIC_URL` | URL publique du backend        |
| `FRONT_URL`          | URL du frontend                |

### Commandes de démarrage

```bash
# Backend
cd Social-media-backend
bun install
bun run dev          # Démarre le serveur sur le port 9000 + Socket.IO sur 9001

# Mobile
cd CvTech-mobile
flutter pub get
flutter run          # Démarre l'app Flutter

# Frontend Web
cd cv-te/social-media-front
npm install
npm run dev          # Démarre Next.js en mode développement
```

### Prérequis

- **Bun** (runtime TypeScript)
- **Python 3.x** (pour les scripts IA)
- **Ollama** avec le modèle `llama3.2` installé (pour la génération de CV)
- **Flutter SDK** ≥ 3.7.1
- **Node.js** ≥ 18 (pour Next.js)
- **MongoDB Atlas** (ou instance locale)

---

> **Auteur :** Équipe CvTech — PFE 2026
> **Dernière mise à jour :** Avril 2026
