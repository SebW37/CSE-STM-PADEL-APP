# Application de Réservation Padel - CSE STMicroelectronics

Application de réservation de terrains de Padel dédiée aux employés STMicroelectronics.

## Architecture "Private Club" & SSO

### Contraintes spécifiques

- **Authentification** : Supabase Auth limitée aux emails `@st.com`
- **Base de données** : Prisma avec PostgreSQL
- **Réservations** : Maximum 2 réservations actives par employé
- **Terrains** : Exactement 3 terrains fixes
- **Règles métier** : Réservation possible 7 jours à l'avance maximum

## Structure de la base de données

### Modèle User
- `matricule` : Matricule employé (unique)
- `nom`, `prenom` : Nom et prénom
- `email` : Email @st.com (unique)
- `soldeCredits` : Solde de crédits pour les réservations
- `role` : Rôle utilisateur (USER ou ADMIN)

### Modèle Court
- `numero` : Numéro du terrain (1, 2, ou 3)
- `nom` : Nom du terrain
- `actif` : Disponibilité du terrain

### Modèle Booking
- `userId` : Référence à l'utilisateur
- `courtId` : Référence au terrain
- `date` : Date et heure de la réservation
- `duree` : Durée en minutes (défaut: 60)
- `statut` : CONFIRME, ANNULE, TERMINE
- `creditsUtilises` : Nombre de crédits utilisés

## Structure du projet

```
.
├── prisma/
│   └── schema.prisma          # Schéma Prisma avec User, Court, Booking
├── lib/
│   ├── prisma/
│   │   ├── client.ts          # Client Prisma singleton
│   │   └── rules.ts           # Règles métier (2 réservations max, 7 jours)
│   └── supabase/
│       ├── client.ts          # Clients Supabase (browser, server, admin)
│       ├── auth-helpers.ts    # Helpers d'authentification avec validation @st.com
│       └── server.ts          # Helpers pour Server Components
├── middleware.ts              # Middleware de sécurité Next.js
├── scripts/
│   └── init-db.ts            # Script d'initialisation des 3 terrains
├── app/
│   └── api/
│       └── bookings/
│           └── route.ts.example  # Exemple d'API route pour les réservations
└── docs/
    └── SUPABASE_SETUP.md     # Guide de configuration Supabase
```

## Installation

1. Installer les dépendances :
```bash
npm install
```

2. Configurer les variables d'environnement :
```bash
cp .env.example .env
# Puis remplir les valeurs dans .env
```

3. Configurer Supabase :
   - Créer un projet Supabase
   - Configurer l'authentification avec restriction aux emails @st.com
   - Voir `docs/SUPABASE_SETUP.md` pour les détails
   - Récupérer les clés API et les ajouter dans `.env`

4. Initialiser la base de données :
```bash
# Générer le client Prisma
npm run db:generate

# Pousser le schéma vers la base de données
npm run db:push

# Initialiser les 3 terrains
npm run db:init
```

5. Lancer l'application :
```bash
npm run dev
```

## Configuration Supabase Auth

Pour restreindre l'authentification aux emails @st.com, voir le guide détaillé dans `docs/SUPABASE_SETUP.md`.

**Méthodes disponibles :**
1. **Hooks Supabase** (Recommandé) : Validation au niveau base de données
2. **Middleware Next.js** : Validation côté application (déjà implémenté)
3. **Edge Functions** : Validation via fonction Supabase

Le middleware (`middleware.ts`) valide automatiquement que tous les utilisateurs connectés ont un email @st.com.

## Middleware de sécurité

Le middleware (`middleware.ts`) :
- Vérifie l'authentification sur toutes les routes (sauf publiques)
- Valide que l'email est @st.com
- Redirige vers `/auth/login` si non authentifié

## Routes publiques

- `/auth/login` : Page de connexion
- `/auth/callback` : Callback Supabase Auth
- `/api/auth/*` : Routes API d'authentification

## Règles métier implémentées

### Contraintes de réservation

1. **Maximum 2 réservations actives par employé**
   - Vérifié via `canUserCreateBooking()` dans `lib/prisma/rules.ts`
   - Seules les réservations avec statut `CONFIRME` et date future sont comptées

2. **Réservation 7 jours à l'avance maximum**
   - Vérifié via `isBookingDateValid()` dans `lib/prisma/rules.ts`
   - La date doit être dans le futur et dans les 7 prochains jours

3. **Exactement 3 terrains**
   - Schéma Prisma avec contrainte
   - Initialisation automatique via `scripts/init-db.ts`
   - Vérification via `ensureCourtsExist()`

### Validation de disponibilité

- `isCourtAvailable()` : Vérifie qu'un terrain n'est pas déjà réservé à une date/heure donnée
- Gère correctement les chevauchements de créneaux

## Utilisation des règles métier

Exemple d'utilisation dans une API route (voir `app/api/bookings/route.ts.example`) :

```typescript
import {
  canUserCreateBooking,
  isBookingDateValid,
  isCourtAvailable
} from '@/lib/prisma/rules'

// Vérifier si l'utilisateur peut créer une réservation
const canCreate = await canUserCreateBooking(userId)

// Vérifier si la date est valide
const isValid = isBookingDateValid(bookingDate)

// Vérifier si le terrain est disponible
const available = await isCourtAvailable(courtId, bookingDate, duree)
```

## Scripts disponibles

- `npm run dev` : Lancer le serveur de développement
- `npm run build` : Build de production
- `npm run db:generate` : Générer le client Prisma
- `npm run db:push` : Pousser le schéma vers la base de données
- `npm run db:migrate` : Créer une migration
- `npm run db:studio` : Ouvrir Prisma Studio
- `npm run db:init` : Initialiser les 3 terrains en base
- `npm run admin:set <email>` : Promouvoir un utilisateur en administrateur

## Panel d'Administration

Le panel d'administration (`/admin`) permet aux gestionnaires du CSE de :

- **Gestion de maintenance** : Bloquer/débloquer les terrains
- **Liste des membres** : Vue d'ensemble avec historique de jeu
- **Statistiques** : Graphiques de taux d'occupation avec Recharts
- **Export CSV** : Télécharger les réservations du mois

Voir `docs/ADMIN_PANEL.md` pour plus de détails.

### Configurer un administrateur

```bash
npm run admin:set john.doe@st.com
```

