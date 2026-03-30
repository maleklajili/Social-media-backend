# API AI CV — Documentation Postman

## Configuration

| Variable   | Valeur par défaut       | Description                                |
| ---------- | ----------------------- | ------------------------------------------ |
| `BASE_URL` | `http://localhost:6000` | URL du serveur backend                     |
| `TOKEN`    | _(vide)_                | JWT obtenu après login                     |
| `CV_ID`    | _(vide)_                | ObjectId du CV (auto-rempli par les tests) |

**Authentification** : Tous les endpoints nécessitent un header `Authorization: Bearer <TOKEN>`.

---

## Endpoints

### 1. POST `/ai-cv/generate` — Générer un CV

Génère un CV à partir du profil utilisateur via Ollama (llama3).

**Body (JSON) :**

```json
{
  "language": "fr",
  "section": "full",
  "format": "standard",
  "customPrompt": ""
}
```

| Champ          | Type   | Requis | Défaut       | Valeurs possibles                                                              |
| -------------- | ------ | ------ | ------------ | ------------------------------------------------------------------------------ |
| `language`     | string | Non    | `"fr"`       | `"fr"`, `"en"`, etc.                                                           |
| `section`      | string | Non    | `"full"`     | `"full"`, `"summary"`, `"experience"`, `"education"`, `"skills"`, `"projects"` |
| `format`       | string | Non    | `"standard"` | `"standard"`, `"canadian"`, `"latex"`, `"modern"`, `"european"`                |
| `customPrompt` | string | Non    | —            | Instructions personnalisées                                                    |

**Réponse 200 :**

```json
{
  "success": true,
  "data": {
    "_id": "6789...",
    "userId": "6789...",
    "title": "CV Complet - Français",
    "content": "# Prénom Nom\n## Profil\n...",
    "section": "full",
    "format": "standard",
    "status": "generated",
    "language": "fr",
    "version": 1,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### 2. GET `/ai-cv/my-cvs` — Lister mes CVs

Récupère tous les CVs de l'utilisateur connecté.

**Réponse 200 :**

```json
{
  "success": true,
  "data": [
    {
      "_id": "6789...",
      "title": "CV Complet - Français",
      "content": "...",
      "section": "full",
      "format": "standard",
      "status": "generated",
      "language": "fr",
      "version": 1,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 3. POST `/ai-cv/reformulate/:id` — Reformuler un CV

Crée une nouvelle version reformulée d'un CV existant.

**Path :** `:id` = ObjectId du CV à reformuler

**Body (JSON) :**

```json
{
  "instructions": "Rendre le CV plus concis et mettre en avant les compétences techniques"
}
```

| Champ          | Type   | Requis | Description                   |
| -------------- | ------ | ------ | ----------------------------- |
| `instructions` | string | Non    | Instructions de reformulation |

**Réponse 200 :**

```json
{
  "success": true,
  "data": {
    "_id": "6789...",
    "title": "CV Complet - Français (v2)",
    "content": "...",
    "status": "reformulated",
    "version": 2,
    "parentId": "6789... (CV original)"
  }
}
```

---

### 4. GET `/ai-cv/download-pdf/:id` — Télécharger en PDF

Génère le PDF côté serveur (Jinja2 + xhtml2pdf) et le retourne en téléchargement.

**Path :** `:id` = ObjectId du CV

**Réponse 200 :**

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="Titre du CV.pdf"`
- Body : fichier PDF binaire

> **Postman** : Cliquer sur "Save Response" → "Save to a file" pour sauvegarder le PDF.

---

### 5. DELETE `/ai-cv/delete/:id` — Supprimer un CV

**Path :** `:id` = ObjectId du CV à supprimer

**Réponse 200 :**

```json
{
  "success": true,
  "data": "CV supprimé avec succès"
}
```

**Réponse 404 :**

```json
{
  "success": false,
  "error": "CV non trouvé"
}
```

---

## Erreurs communes

| Code | Message                                   | Cause                                                  |
| ---- | ----------------------------------------- | ------------------------------------------------------ |
| 401  | `Missing or invalid token`                | Token JWT manquant ou invalide                         |
| 400  | `ID du CV invalide`                       | L'ID n'est pas un ObjectId valide (24 hex)             |
| 404  | `CV non trouvé`                           | Le CV n'existe pas ou n'appartient pas à l'utilisateur |
| 404  | `Utilisateur non trouvé`                  | Le profil utilisateur n'existe pas                     |
| 500  | `Erreur lors de la génération du CV: ...` | Erreur Ollama ou serveur                               |

---

## Import dans Postman

1. Ouvrir Postman
2. **File** → **Import**
3. Sélectionner le fichier `AI-CV-API.postman_collection.json`
4. Remplir la variable `TOKEN` avec un JWT valide
5. Lancer les requêtes dans l'ordre (1 → 5)

> Le `CV_ID` est automatiquement sauvegardé après les requêtes Generate et Reformulate.
