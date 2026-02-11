-- Migration: Add 2v2 Support to Existing Schema
-- This migration adds team-based gameplay support to the existing game_rooms and room_players tables
-- Run this after the base supabase-schema.sql has been applied

-- ============================================================================
-- UPDATE game_rooms TABLE
-- ============================================================================
-- Add game_mode column to distinguish between 1v1, 2v2, and custom lobbies
ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT '1v1' 
CHECK (game_mode IN ('1v1', '2v2', 'custom'));

-- Add index for game mode filtering
CREATE INDEX IF NOT EXISTS idx_game_rooms_game_mode ON game_rooms(game_mode);

-- ============================================================================
-- UPDATE room_players TABLE
-- ============================================================================
-- Add team_id for team assignment (0 or 1 for teams, null for spectators)
ALTER TABLE room_players 
ADD COLUMN IF NOT EXISTS team_id INTEGER CHECK (team_id IN (0, 1) OR team_id IS NULL);

-- Add is_spectator flag
ALTER TABLE room_players 
ADD COLUMN IF NOT EXISTS is_spectator BOOLEAN DEFAULT false;

-- Add slot_type to distinguish between player, AI, spectator, or empty slots
ALTER TABLE room_players 
ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'player' 
CHECK (slot_type IN ('player', 'ai', 'spectator', 'empty'));

-- Add AI difficulty for AI-controlled slots
ALTER TABLE room_players 
ADD COLUMN IF NOT EXISTS ai_difficulty TEXT 
CHECK (ai_difficulty IN ('easy', 'normal', 'hard') OR ai_difficulty IS NULL);

-- Add player color customization
ALTER TABLE room_players 
ADD COLUMN IF NOT EXISTS player_color TEXT;

-- Add indexes for team-based queries
CREATE INDEX IF NOT EXISTS idx_room_players_team_id ON room_players(team_id);
CREATE INDEX IF NOT EXISTS idx_room_players_slot_type ON room_players(slot_type);

-- ============================================================================
-- MATCHMAKING QUEUE TABLE
-- ============================================================================
-- Create table for 2v2 matchmaking queue
CREATE TABLE IF NOT EXISTS matchmaking_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    mmr INTEGER NOT NULL,
    game_mode TEXT NOT NULL CHECK (game_mode IN ('1v1', '2v2')),
    faction TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'matched', 'cancelled'))
);

-- Indexes for matchmaking performance
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_game_mode ON matchmaking_queue(game_mode);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_mmr ON matchmaking_queue(mmr);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_status ON matchmaking_queue(status);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_joined_at ON matchmaking_queue(joined_at);

-- Enable RLS
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for matchmaking_queue
-- Players can view all searching players (for transparency)
CREATE POLICY "Players can view queue"
    ON matchmaking_queue FOR SELECT
    USING (status = 'searching');

-- Players can join queue (insert themselves)
CREATE POLICY "Players can join queue"
    ON matchmaking_queue FOR INSERT
    WITH CHECK (
        player_id = current_setting('request.jwt.claims', true)::json->>'sub'
    );

-- Players can update their own queue entry
CREATE POLICY "Players can update own queue entry"
    ON matchmaking_queue FOR UPDATE
    USING (player_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Players can leave queue (delete themselves)
CREATE POLICY "Players can leave queue"
    ON matchmaking_queue FOR DELETE
    USING (player_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ============================================================================
-- CLEANUP FUNCTIONS UPDATE
-- ============================================================================
-- Update cleanup function to handle matchmaking queue
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS void AS $$
BEGIN
    -- Clean up finished rooms older than 1 hour
    DELETE FROM game_rooms
    WHERE status = 'finished'
    AND created_at < NOW() - INTERVAL '1 hour';
    
    -- Clean up stale matchmaking entries (older than 10 minutes)
    DELETE FROM matchmaking_queue
    WHERE joined_at < NOW() - INTERVAL '10 minutes';
    
    -- Clean up cancelled matchmaking entries
    DELETE FROM matchmaking_queue
    WHERE status = 'cancelled'
    AND joined_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTIONS FOR 2v2
-- ============================================================================

-- Function to get available teams in a room
CREATE OR REPLACE FUNCTION get_room_team_slots(p_room_id UUID)
RETURNS TABLE(team_id INTEGER, slot_count BIGINT, player_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rp.team_id,
        COUNT(*) as slot_count,
        COUNT(*) FILTER (WHERE rp.slot_type = 'player' AND NOT rp.is_spectator) as player_count
    FROM room_players rp
    WHERE rp.room_id = p_room_id
    AND rp.team_id IS NOT NULL
    GROUP BY rp.team_id
    ORDER BY rp.team_id;
END;
$$ LANGUAGE plpgsql;

-- Function to find matchmaking candidates
CREATE OR REPLACE FUNCTION find_matchmaking_candidates(
    p_player_mmr INTEGER,
    p_game_mode TEXT,
    p_mmr_range INTEGER DEFAULT 100
)
RETURNS TABLE(
    player_id TEXT,
    username TEXT,
    mmr INTEGER,
    faction TEXT,
    joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mq.player_id,
        mq.username,
        mq.mmr,
        mq.faction,
        mq.joined_at
    FROM matchmaking_queue mq
    WHERE mq.game_mode = p_game_mode
    AND mq.status = 'searching'
    AND mq.mmr BETWEEN (p_player_mmr - p_mmr_range) AND (p_player_mmr + p_mmr_range)
    ORDER BY ABS(mq.mmr - p_player_mmr), mq.joined_at
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ANONYMOUS ACCESS POLICIES UPDATE (for development/beta)
-- ============================================================================
-- To enable anonymous access for matchmaking queue, uncomment:

/*
DROP POLICY IF EXISTS "Players can view queue" ON matchmaking_queue;
DROP POLICY IF EXISTS "Players can join queue" ON matchmaking_queue;
DROP POLICY IF EXISTS "Players can update own queue entry" ON matchmaking_queue;
DROP POLICY IF EXISTS "Players can leave queue" ON matchmaking_queue;

CREATE POLICY "Anon can view queue"
    ON matchmaking_queue FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can join queue"
    ON matchmaking_queue FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Anon can update queue"
    ON matchmaking_queue FOR UPDATE
    TO anon
    USING (true);

CREATE POLICY "Anon can leave queue"
    ON matchmaking_queue FOR DELETE
    TO anon
    USING (true);
*/

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This migration is additive and non-breaking
-- 2. Existing 1v1 games continue to work (default game_mode='1v1')
-- 3. New columns have sensible defaults and NULL constraints
-- 4. All new indexes improve query performance for team-based features
-- 5. Matchmaking queue is separate from lobbies for clean separation
-- 6. Helper functions simplify common 2v2 operations
-- 7. Cleanup function updated to handle matchmaking queue
