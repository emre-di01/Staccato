-- Der handle_new_user-Trigger war als Funktion definiert, aber nie per
-- CREATE TRIGGER an auth.users gebunden. Ohne diesen Trigger wird kein
-- profiles-Eintrag angelegt, wenn ein User via auth.admin.createUser
-- (z. B. accept-invitation Edge Function) erstellt wird.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
