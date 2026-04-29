-- Admin kann E-Mail eines Nutzers direkt setzen (ohne Bestätigungsmail)
CREATE OR REPLACE FUNCTION public.admin_set_email(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
begin
  if meine_rolle() not in ('admin','superadmin') then
    raise exception 'Keine Berechtigung';
  end if;
  update auth.users
  set email              = p_email,
      email_confirmed_at = now(),
      updated_at         = now()
  where id = p_user_id;
end;
$$;

ALTER FUNCTION public.admin_set_email(uuid, text) OWNER TO postgres;
