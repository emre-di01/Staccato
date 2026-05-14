-- Zahlungsdaten + Erziehungsberechtigte auf profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS iban                      text,
  ADD COLUMN IF NOT EXISTS bic                       text,
  ADD COLUMN IF NOT EXISTS kontoinhaber              text,
  ADD COLUMN IF NOT EXISTS zahlungsweise             text CHECK (zahlungsweise IN ('sepa','ueberweisung','bar')),
  ADD COLUMN IF NOT EXISTS zahlungsrhythmus          text CHECK (zahlungsrhythmus IN ('monatlich','quartalsweise','halbjaehrlich','jaehrlich')),
  ADD COLUMN IF NOT EXISTS mitgliedsbeitrag          numeric(8,2),
  ADD COLUMN IF NOT EXISTS erziehungsberechtigter_name     text,
  ADD COLUMN IF NOT EXISTS erziehungsberechtigter_telefon  text,
  ADD COLUMN IF NOT EXISTS erziehungsberechtigter_email    text;
