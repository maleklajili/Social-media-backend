# ──────────────────────────────────────────────────────────────
#  Image Docker du backend CvTech (Bun + TypeScript)
#  - Bun exécute l'API + Socket.IO (port 9000)
#  - Python3 est inclus pour les scripts d'IA (CV, PDF, modération)
# ──────────────────────────────────────────────────────────────
FROM oven/bun:1 AS base
WORKDIR /app

# Python 3 (les scripts IA sont lancés via "python") + outils
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip python-is-python3 \
 && rm -rf /var/lib/apt/lists/*

# 1) Dépendances Bun (couche mise en cache tant que package.json ne change pas)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# 2) Dépendances Python du sidecar IA
COPY python-ai/requirements.txt ./python-ai/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r python-ai/requirements.txt

# 3) Code source de l'application
COPY . .

# Dossier des fichiers téléversés (à monter en volume en production)
RUN mkdir -p uploads

# Port HTTP (API REST + Socket.IO)
EXPOSE 9000

# Les variables d'environnement (DATABASE_URL, JWT, OLLAMA_HOST, …) sont
# fournies au démarrage via --env-file .env (voir README), jamais dans l'image.
CMD ["bun", "run", "src/server.ts"]
