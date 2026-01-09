# Configuration Supabase pour restriction @st.com

## Méthode 1 : Politique RLS (Row Level Security) + Trigger

### 1. Créer une fonction de validation dans Supabase SQL

Exécuter dans l'éditeur SQL de Supabase :

```sql
-- Fonction pour valider le domaine email
CREATE OR REPLACE FUNCTION validate_st_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email ILIKE '%@st.com';
END;
$$ LANGUAGE plpgsql;

-- Trigger pour valider l'email lors de l'inscription
CREATE OR REPLACE FUNCTION check_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_st_email(NEW.email) THEN
    RAISE EXCEPTION 'Accès réservé aux employés STMicroelectronics. Email doit être @st.com';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur la table auth.users (si possible)
-- Note: Supabase peut avoir des restrictions sur auth.users
-- Dans ce cas, utiliser la méthode 2 avec les hooks
```

## Méthode 2 : Hooks Supabase (Recommandé)

### Configuration dans Supabase Dashboard

1. Aller dans **Authentication > Hooks**
2. Créer un nouveau hook pour `auth.users` table
3. Utiliser le code suivant :

```sql
-- Hook pour valider l'email lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier que l'email se termine par @st.com
  IF NOT (NEW.email ILIKE '%@st.com') THEN
    RAISE EXCEPTION 'Email non autorisé. Seuls les emails @st.com sont acceptés.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

## Méthode 3 : Validation côté client (Middleware)

Le middleware Next.js (`middleware.ts`) valide déjà les emails @st.com après authentification.

Pour une validation plus stricte, vous pouvez également :

1. Désactiver l'inscription publique dans Supabase
2. Créer un endpoint API pour l'inscription qui valide l'email avant de créer le compte

## Configuration recommandée

1. **Désactiver l'inscription publique** dans Supabase Dashboard :
   - Authentication > Settings > Disable "Enable email signup"

2. **Créer un endpoint d'inscription contrôlé** :
   - Valider l'email @st.com
   - Créer le compte via Supabase Admin API
   - Créer l'enregistrement User dans Prisma

3. **Utiliser le middleware** pour vérifier les sessions actives

## Test de la configuration

Pour tester que la restriction fonctionne :

1. Tenter de s'inscrire avec un email non-@st.com → doit échouer
2. Tenter de se connecter avec un email non-@st.com → doit être bloqué par le middleware
3. S'inscrire avec un email @st.com → doit réussir


