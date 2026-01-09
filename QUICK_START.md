# Guide de Démarrage Rapide

## ⚠️ Configuration requise avant le premier lancement

### 1. Créer le fichier `.env`

Créez un fichier `.env` à la racine du projet avec le contenu suivant :

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cse_padel_db?schema=public"

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Configurer la base de données

#### Option A : PostgreSQL local
1. Installer PostgreSQL
2. Créer une base de données : `createdb cse_padel_db`
3. Mettre à jour `DATABASE_URL` dans `.env`

#### Option B : Supabase (recommandé)
1. Créer un projet sur [supabase.com](https://supabase.com)
2. Récupérer l'URL de connexion dans Settings > Database
3. Mettre à jour `DATABASE_URL` dans `.env`

### 3. Initialiser la base de données

```bash
# Pousser le schéma vers la base
npm run db:push

# Initialiser les 3 terrains
npm run db:init
```

### 4. Configurer Supabase Auth

1. Aller dans Authentication > Settings
2. Configurer l'authentification email
3. (Optionnel) Ajouter un hook pour valider les emails @st.com

Voir `docs/SUPABASE_SETUP.md` pour plus de détails.

### 5. Créer un premier utilisateur admin (optionnel)

```bash
# Après vous être connecté une première fois
npm run admin:set votre.email@st.com
```

## 🚀 Lancer l'application

```bash
npm run dev
```

L'application sera accessible sur http://localhost:3000

## 📝 Notes importantes

- **Première connexion** : Vous devez créer un compte Supabase avec un email @st.com
- **Base de données** : Assurez-vous que PostgreSQL/Supabase est accessible
- **Variables d'environnement** : Toutes les variables `.env` sont requises

## 🔧 Dépannage

### Erreur "DATABASE_URL not found"
→ Vérifiez que le fichier `.env` existe et contient `DATABASE_URL`

### Erreur de connexion à la base
→ Vérifiez que PostgreSQL/Supabase est démarré et accessible

### Erreur Supabase Auth
→ Vérifiez que les clés Supabase dans `.env` sont correctes

### Page blanche ou erreur 500
→ Vérifiez les logs dans la console du terminal


