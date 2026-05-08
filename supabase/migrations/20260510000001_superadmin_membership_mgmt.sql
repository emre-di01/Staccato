-- Superadmin: Schulzugehörigkeiten für beliebige Nutzer verwalten

CREATE OR REPLACE FUNCTION public.nutzer_schulen(p_user_id uuid)
  RETURNS TABLE(
    schule_id uuid, name text, logo_url text, farbe text,
    rolle public.user_rolle, aktiv boolean
  ) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  IF public.meine_rolle() != 'superadmin' THEN
    RAISE EXCEPTION 'Nur Superadmin';
  END IF;
  RETURN QUERY
  SELECT sm.schule_id, s.name, s.logo_url, s.farbe, sm.rolle, sm.aktiv
  FROM public.schul_mitgliedschaften sm
  JOIN public.schulen s ON s.id = sm.schule_id
  WHERE sm.user_id = p_user_id
  ORDER BY s.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.mitgliedschaft_setzen(
  p_user_id   uuid,
  p_schule_id uuid,
  p_rolle     public.user_rolle
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF public.meine_rolle() != 'superadmin' THEN
    RAISE EXCEPTION 'Nur Superadmin';
  END IF;

  INSERT INTO public.schul_mitgliedschaften (user_id, schule_id, rolle, eingeladen_von, aktiv)
  VALUES (p_user_id, p_schule_id, p_rolle, auth.uid(), true)
  ON CONFLICT (user_id, schule_id) DO UPDATE SET rolle = p_rolle, aktiv = true;

  -- Wenn der Nutzer noch keine aktive Schule hat, diese als primäre setzen
  UPDATE public.profiles
  SET schule_id = p_schule_id, letzte_schule_id = p_schule_id, rolle = p_rolle
  WHERE id = p_user_id AND schule_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mitgliedschaft_entfernen(
  p_user_id   uuid,
  p_schule_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF public.meine_rolle() != 'superadmin' THEN
    RAISE EXCEPTION 'Nur Superadmin';
  END IF;

  DELETE FROM public.schul_mitgliedschaften
  WHERE user_id = p_user_id AND schule_id = p_schule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.nutzer_schulen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mitgliedschaft_setzen(uuid, uuid, public.user_rolle) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mitgliedschaft_entfernen(uuid, uuid) TO authenticated;
