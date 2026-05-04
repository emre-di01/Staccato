-- Add 'kurs' to nachricht_typ enum
-- Must be in a separate file: PostgreSQL cannot use a new enum value
-- in the same transaction it was added.
ALTER TYPE "public"."nachricht_typ" ADD VALUE IF NOT EXISTS 'kurs';
