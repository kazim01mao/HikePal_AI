-- ============================================================================
-- Migration: Update team_members role constraint to allow 'organizer'
-- Purpose: Add 'organizer' role to the valid_role CHECK constraint
-- Date: 2026-03-11
-- ============================================================================

-- Drop the old constraint and add the new one
ALTER TABLE team_members DROP CONSTRAINT valid_role;
ALTER TABLE team_members ADD CONSTRAINT valid_role CHECK (role IN ('leader', 'member', 'organizer'));

-- Verify the constraint was updated
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'team_members' AND constraint_type = 'CHECK';

-- Alternative verification (more detailed)
SELECT pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'team_members'::regclass AND contype = 'c';
