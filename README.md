# Extended Edge Tracker

> Know if you're ahead, average, or already late.

## Pourquoi en local ?

L'API Extended (`api.starknet.extended.exchange`) **bloque les appels CORS depuis le navigateur**.
Toutes les requêtes doivent passer par un proxy serveur — c'est exactement ce que fait ce projet Next.js.

## Setup en 3 commandes

```bash
# 1. Installe les dépendances
npm install

# 2. Lance le serveur de dev
npm run dev

# 3. Ouvre dans le navigateur
open http://localhost:3000
```

## Variables d'environnement (optionnel)

Crée un fichier `.env.local` à la racine :

```env
# Activer le mode mock (données simulées, pas d'appel API réel)
NEXT_PUBLIC_MOCK_MODE=false

# URL de base de l'API Extended (déjà configurée par défaut)
EXTENDED_BASE_URL=https://api.starknet.extended.exchange/api/v1
```

## Structure

```
/app
  /page.tsx                        ← UI principale (hero + dashboard)
  /api/extended
    /connect/route.ts              ← Valide la clé API
    /analysis/route.ts             ← Endpoint principal (fetch + score + projection)
    /rewards/route.ts
    /trades/route.ts

/lib
  extended-client.ts               ← Client HTTP serveur (X-Api-Key)
  extended-mappers.ts              ← Transforme les réponses brutes Extended
  analysis.ts                      ← Orchestre l'assemblage final
  scoring.ts                       ← Edge Score (formule documentée)
  consistency.ts                   ← Streaks et jours actifs
  projections.ts                   ← Projections 7j / 30j
  recommendations.ts               ← Moteur de recommandations
  mock-data.ts                     ← Données simulées (feature flag)
  types.ts                         ← Tous les types TypeScript
  utils.ts                         ← Formatters
```

## Flow

```
Utilisateur colle sa clé API
        ↓
POST /api/extended/analysis   (serveur Next.js)
        ↓
Appels parallèles vers Extended API (avec X-Api-Key)
  - /user/account/info
  - /user/rewards/leaderboard/stats
  - /user/rewards/earned
  - /user/trades
        ↓
Mapping + scoring + projections + recommandations
        ↓
WalletAnalysis → Dashboard
```

## La clé API Extended

Trouve-la dans **Extended → Settings → API Keys**.
Le scope **read-only** suffit.
Elle n'est jamais stockée — utilisée uniquement le temps de la session.
