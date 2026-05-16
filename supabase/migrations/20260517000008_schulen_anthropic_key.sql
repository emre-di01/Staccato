-- Schulen können ihren eigenen Anthropic API Key hinterlegen (KI-Rechnungserkennung)
ALTER TABLE public.schulen
  ADD COLUMN IF NOT EXISTS anthropic_api_key text;
