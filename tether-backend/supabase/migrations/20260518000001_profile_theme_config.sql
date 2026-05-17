-- Migration: add theme_config column to profiles
-- Stores the creator's chosen public profile theme as a JSONB object.
-- Shape: { theme, typography, palette, texture, layout }
-- NULL = not yet set (falls back to the default Glassmorphic theme).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT NULL;
