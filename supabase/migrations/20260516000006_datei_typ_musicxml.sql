-- Add musicxml to datei_typ enum
ALTER TYPE "public"."datei_typ" ADD VALUE IF NOT EXISTS 'musicxml';
