-- Supabase Database Schema for P2P Multiplayer with Deterministic Lockstep
-- This schema is designed for Phase 1: P2P with Supabase signaling only
-- Supabase is NOT authoritative and does NOT simulate gameplay

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- MATCHES TABLE
-- ============================================================================
-- Stores match metadata and lifecycle state
-- Supabase responsibility: matchmaking, lobby coordination, lifecycle tracking
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('open', 'connecting', 'active', 'ended')),
    host_player_id UUID NOT NULL,
    game_seed INTEGER NOT NULL, -- For deterministic RNG
    tick_rate INTEGER NOT NULL DEFAULT 30, -- Fixed timestep (ticks per second)
    lockstep_enabled BOOLEAN NOT NULL DEFAULT false, -- For future Phase 2
    max_players INTEGER NOT NULL DEFAULT 2,
    match_name TEXT,
    game_settings JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- MATCH_PLAYERS TABLE
-- ============================================================================
-- Tracks players in each match and their connection status
CREATE TABLE IF NOT EXISTS match_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('host', 'client')),
    connected BOOLEAN NOT NULL DEFAULT false,
    username TEXT NOT NULL,
    faction TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(match_id, player_id)
);

-- ============================================================================
-- SIGNALING_MESSAGES TABLE
-- ============================================================================
-- WebRTC signaling messages (SDP offers, answers, ICE candidates)
-- Used ONLY for P2P connection establishment, not for gameplay
CREATE TABLE IF NOT EXISTS signaling_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    recipient_id UUID, -- NULL means broadcast to all
    type TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice')),
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player_id ON match_players(player_id);
CREATE INDEX IF NOT EXISTS idx_signaling_messages_match_id ON signaling_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_signaling_messages_recipient ON signaling_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_signaling_messages_created_at ON signaling_messages(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE signaling_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for matches
-- Anyone can view open matches (for matchmaking)
CREATE POLICY "Anyone can view open matches"
    ON matches FOR SELECT
    USING (status = 'open');

-- Players in a match can view their match
CREATE POLICY "Players can view their match"
    ON matches FOR SELECT
    USING (
        id IN (
            SELECT match_id FROM match_players 
            WHERE player_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- Anyone can create a match
CREATE POLICY "Anyone can create match"
    ON matches FOR INSERT
    WITH CHECK (true);

-- Only host can update match
CREATE POLICY "Host can update match"
    ON matches FOR UPDATE
    USING (host_player_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

-- Host can delete match
CREATE POLICY "Host can delete match"
    ON matches FOR DELETE
    USING (host_player_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for match_players
-- Players in match can view all players in that match
CREATE POLICY "Players can view match members"
    ON match_players FOR SELECT
    USING (
        match_id IN (
            SELECT match_id FROM match_players 
            WHERE player_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- Anyone can join a match (insert themselves)
CREATE POLICY "Anyone can join match"
    ON match_players FOR INSERT
    WITH CHECK (
        player_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    );

-- Players can update their own record
CREATE POLICY "Players can update self"
    ON match_players FOR UPDATE
    USING (player_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

-- Players can leave (delete themselves)
CREATE POLICY "Players can leave"
    ON match_players FOR DELETE
    USING (player_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for signaling_messages
-- Players in match can view signaling messages for their match
CREATE POLICY "Players can view signaling messages"
    ON signaling_messages FOR SELECT
    USING (
        match_id IN (
            SELECT match_id FROM match_players 
            WHERE player_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- Players can insert signaling messages for their match
CREATE POLICY "Players can send signaling messages"
    ON signaling_messages FOR INSERT
    WITH CHECK (
        match_id IN (
            SELECT match_id FROM match_players 
            WHERE player_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
        )
        AND sender_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    );

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================
-- Function to clean up old finished matches (call periodically)
CREATE OR REPLACE FUNCTION cleanup_old_matches()
RETURNS void AS $$
BEGIN
    -- Clean up finished matches older than 1 hour
    DELETE FROM matches
    WHERE status = 'ended'
    AND created_at < NOW() - INTERVAL '1 hour';
    
    -- Clean up old signaling messages (they're only needed during connection)
    DELETE FROM signaling_messages
    WHERE created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ANONYMOUS ACCESS POLICIES (for development/beta)
-- ============================================================================
-- NOTE: For production, implement proper authentication via Supabase Auth
-- To enable anonymous access, uncomment the following policies:

/*
-- Drop JWT-based policies
DROP POLICY IF EXISTS "Anyone can view open matches" ON matches;
DROP POLICY IF EXISTS "Players can view their match" ON matches;
DROP POLICY IF EXISTS "Anyone can create match" ON matches;
DROP POLICY IF EXISTS "Host can update match" ON matches;
DROP POLICY IF EXISTS "Host can delete match" ON matches;

-- Anonymous policies for matches
CREATE POLICY "Anon can view all matches"
    ON matches FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can create matches"
    ON matches FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Anon can update any match"
    ON matches FOR UPDATE
    TO anon
    USING (true);

CREATE POLICY "Anon can delete any match"
    ON matches FOR DELETE
    TO anon
    USING (true);

-- Anonymous policies for match_players
DROP POLICY IF EXISTS "Players can view match members" ON match_players;
DROP POLICY IF EXISTS "Anyone can join match" ON match_players;
DROP POLICY IF EXISTS "Players can update self" ON match_players;
DROP POLICY IF EXISTS "Players can leave" ON match_players;

CREATE POLICY "Anon can view match players"
    ON match_players FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can join matches"
    ON match_players FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Anon can update match players"
    ON match_players FOR UPDATE
    TO anon
    USING (true);

CREATE POLICY "Anon can leave matches"
    ON match_players FOR DELETE
    TO anon
    USING (true);

-- Anonymous policies for signaling_messages
DROP POLICY IF EXISTS "Players can view signaling messages" ON signaling_messages;
DROP POLICY IF EXISTS "Players can send signaling messages" ON signaling_messages;

CREATE POLICY "Anon can view signaling"
    ON signaling_messages FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can send signaling"
    ON signaling_messages FOR INSERT
    TO anon
    WITH CHECK (true);
*/

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Supabase is used ONLY for:
--    - Matchmaking (creating and listing matches)
--    - Lobby coordination (tracking players)
--    - Signaling (WebRTC SDP/ICE exchange)
--    - Match lifecycle state (open/connecting/active/ended)
--
-- 2. Supabase does NOT:
--    - Simulate gameplay
--    - Store game state during active match
--    - Act as authoritative server
--    - Relay game commands (P2P handles this)
--
-- 3. After P2P connection is established:
--    - All gameplay commands go through WebRTC data channels
--    - Supabase is no longer in the hot path
--    - Simulation is deterministic on all clients
--
-- 4. Phase 2 migration path:
--    - lockstep_enabled flag can be used to enable server relay
--    - game_seed ensures deterministic replay/verification
--    - tick_rate ensures fixed timestep
