-- Supabase Complete Database Schema for SoL
-- Combines:
--   1) supabase-schema.sql (core lobby schema)
--   2) supabase-2v2-migration.sql (2v2/custom/matchmaking additions)
--   3) supabase-p2p-schema.sql (P2P signaling schema)
--
-- Run this file once in Supabase SQL Editor for a complete setup.
-- The statements are intended to be additive/idempotent where possible.

-- ============================================================================
-- SECTION 1: CORE LOBBY SCHEMA (supabase-schema.sql)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Game Rooms Table
CREATE TABLE IF NOT EXISTS game_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    host_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')),
    max_players INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    game_settings JSONB DEFAULT '{}'::jsonb
);

-- Room Players Table
CREATE TABLE IF NOT EXISTS room_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL,
    username TEXT NOT NULL,
    is_host BOOLEAN NOT NULL DEFAULT false,
    is_ready BOOLEAN NOT NULL DEFAULT false,
    faction TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, player_id)
);

-- Game State Table (optional, for persistence)
CREATE TABLE IF NOT EXISTS game_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    tick INTEGER NOT NULL,
    state_data JSONB NOT NULL,
    state_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_rooms_created_at ON game_rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_player_id ON room_players(player_id);
CREATE INDEX IF NOT EXISTS idx_game_states_room_id ON game_states(room_id);
CREATE INDEX IF NOT EXISTS idx_game_states_tick ON game_states(room_id, tick);

-- Enable Row Level Security (RLS)
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;


-- Helper functions for JWT and room membership checks.
-- SECURITY DEFINER prevents recursive RLS evaluation when checking room_players membership.
CREATE OR REPLACE FUNCTION auth_player_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT current_setting('request.jwt.claims', true)::json->>'sub';
$$;

CREATE OR REPLACE FUNCTION is_room_member(target_room_id UUID, target_player_id TEXT DEFAULT auth_player_id())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM room_players rp
        WHERE rp.room_id = target_room_id
          AND rp.player_id = target_player_id
    );
$$;


CREATE OR REPLACE FUNCTION add_ai_player_to_room(
    p_room_id UUID,
    p_ai_player_id TEXT,
    p_team_id INTEGER DEFAULT NULL,
    p_ai_difficulty TEXT DEFAULT 'normal',
    p_username TEXT DEFAULT 'AI Player',
    p_faction TEXT DEFAULT 'Radiant'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM game_rooms
        WHERE id = p_room_id
          AND host_id = auth_player_id()
    ) THEN
        RAISE EXCEPTION 'Only room host can add AI players'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO room_players (
        room_id,
        player_id,
        username,
        is_host,
        is_ready,
        team_id,
        slot_type,
        ai_difficulty,
        faction
    )
    VALUES (
        p_room_id,
        p_ai_player_id,
        p_username,
        FALSE,
        TRUE,
        p_team_id,
        'ai',
        p_ai_difficulty,
        p_faction
    );
END;
$$;

-- RLS Policies for game_rooms
CREATE POLICY "Anyone can view waiting rooms"
    ON game_rooms FOR SELECT
    USING (status = 'waiting');

CREATE POLICY "Players can view their room"
    ON game_rooms FOR SELECT
    USING (is_room_member(id));

CREATE POLICY "Anyone can create room"
    ON game_rooms FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Host can update room"
    ON game_rooms FOR UPDATE
    USING (host_id = auth_player_id());

CREATE POLICY "Host can delete room"
    ON game_rooms FOR DELETE
    USING (host_id = auth_player_id());

-- RLS Policies for room_players
CREATE POLICY "Players can view room members"
    ON room_players FOR SELECT
    USING (is_room_member(room_id));

CREATE POLICY "Anyone can join room"
    ON room_players FOR INSERT
    WITH CHECK (
        player_id = auth_player_id()
        OR (
            slot_type = 'ai'
            AND room_id IN (
                SELECT id
                FROM game_rooms
                WHERE host_id = auth_player_id()
            )
        )
    );

CREATE POLICY "Players can update self"
    ON room_players FOR UPDATE
    USING (
        player_id = auth_player_id()
        OR room_id IN (
            SELECT id
            FROM game_rooms
            WHERE host_id = auth_player_id()
        )
    );

CREATE POLICY "Players can leave"
    ON room_players FOR DELETE
    USING (
        player_id = auth_player_id()
        OR room_id IN (
            SELECT id
            FROM game_rooms
            WHERE host_id = auth_player_id()
        )
    );

-- RLS Policies for game_states
CREATE POLICY "Players can view game states"
    ON game_states FOR SELECT
    USING (is_room_member(room_id));

CREATE POLICY "Players can save game states"
    ON game_states FOR INSERT
    WITH CHECK (
        room_id IN (
            SELECT room_id FROM room_players
            WHERE player_id = auth_player_id()
        )
    );

-- Function to clean up old finished rooms (call periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS void AS $$
BEGIN
    DELETE FROM game_rooms
    WHERE status = 'finished'
    AND created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 2: 2V2 / CUSTOM / MATCHMAKING MIGRATION (supabase-2v2-migration.sql)
-- ============================================================================

-- Add game_mode column to distinguish between 1v1, 2v2, and custom lobbies
ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT '1v1'
CHECK (game_mode IN ('1v1', '2v2', 'custom'));

-- Add index for game mode filtering
CREATE INDEX IF NOT EXISTS idx_game_rooms_game_mode ON game_rooms(game_mode);

-- Add team support columns to room_players
ALTER TABLE room_players
ADD COLUMN IF NOT EXISTS team_id INTEGER,
ADD COLUMN IF NOT EXISTS is_spectator BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'player' CHECK (slot_type IN ('player', 'ai', 'spectator', 'empty')),
ADD COLUMN IF NOT EXISTS ai_difficulty TEXT CHECK (ai_difficulty IN ('easy', 'normal', 'hard')),
ADD COLUMN IF NOT EXISTS player_color TEXT,
ADD COLUMN IF NOT EXISTS mmr INTEGER DEFAULT 1000;

CREATE INDEX IF NOT EXISTS idx_room_players_team_id ON room_players(room_id, team_id);
CREATE INDEX IF NOT EXISTS idx_room_players_slot_type ON room_players(room_id, slot_type);

-- Matchmaking queue table
CREATE TABLE IF NOT EXISTS matchmaking_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    mmr INTEGER NOT NULL DEFAULT 1000,
    game_mode TEXT NOT NULL CHECK (game_mode IN ('1v1', '2v2', 'custom')),
    faction TEXT,
    preferred_team INTEGER CHECK (preferred_team IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'matched', 'cancelled')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    matched_at TIMESTAMP WITH TIME ZONE,
    room_id UUID REFERENCES game_rooms(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_mode_mmr ON matchmaking_queue(game_mode, mmr);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_status ON matchmaking_queue(status, joined_at);

ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view queue"
    ON matchmaking_queue FOR SELECT
    USING (true);

CREATE POLICY "Players can join queue"
    ON matchmaking_queue FOR INSERT
    WITH CHECK (player_id = auth_player_id());

CREATE POLICY "Players can update own queue entry"
    ON matchmaking_queue FOR UPDATE
    USING (player_id = auth_player_id());

CREATE POLICY "Players can leave queue"
    ON matchmaking_queue FOR DELETE
    USING (player_id = auth_player_id());

-- Update cleanup function to include old queue entries
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS void AS $$
BEGIN
    DELETE FROM game_rooms
    WHERE status = 'finished'
    AND created_at < NOW() - INTERVAL '1 hour';

    DELETE FROM matchmaking_queue
    WHERE status IN ('cancelled', 'matched')
    AND joined_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- Helper function to count players by team
CREATE OR REPLACE FUNCTION get_team_counts(p_room_id UUID)
RETURNS TABLE(team_id INTEGER, player_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rp.team_id,
        COUNT(*) as player_count
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
-- SECTION 3: P2P SIGNALING SCHEMA (supabase-p2p-schema.sql)
-- ============================================================================

-- MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('open', 'connecting', 'active', 'ended')),
    host_player_id UUID NOT NULL,
    game_seed INTEGER NOT NULL,
    tick_rate INTEGER NOT NULL DEFAULT 30,
    lockstep_enabled BOOLEAN NOT NULL DEFAULT false,
    max_players INTEGER NOT NULL DEFAULT 2,
    match_name TEXT,
    game_settings JSONB DEFAULT '{}'::jsonb
);

-- MATCH_PLAYERS TABLE
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

-- SIGNALING_MESSAGES TABLE
CREATE TABLE IF NOT EXISTS signaling_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    recipient_id UUID,
    type TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice')),
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player_id ON match_players(player_id);
CREATE INDEX IF NOT EXISTS idx_signaling_messages_match_id ON signaling_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_signaling_messages_recipient ON signaling_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_signaling_messages_created_at ON signaling_messages(created_at);

-- RLS
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE signaling_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view open matches"
    ON matches FOR SELECT
    USING (status = 'open');

CREATE POLICY "Players can view their match"
    ON matches FOR SELECT
    USING (
        id IN (
            SELECT match_id FROM match_players
            WHERE player_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

CREATE POLICY "Anyone can create match"
    ON matches FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Host can update match"
    ON matches FOR UPDATE
    USING (host_player_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Host can delete match"
    ON matches FOR DELETE
    USING (host_player_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Players can view match members"
    ON match_players FOR SELECT
    USING (
        match_id IN (
            SELECT match_id FROM match_players
            WHERE player_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

CREATE POLICY "Anyone can join match"
    ON match_players FOR INSERT
    WITH CHECK (
        player_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    );

CREATE POLICY "Players can update self"
    ON match_players FOR UPDATE
    USING (player_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Players can leave"
    ON match_players FOR DELETE
    USING (player_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Players can view signaling messages"
    ON signaling_messages FOR SELECT
    USING (
        match_id IN (
            SELECT match_id FROM match_players
            WHERE player_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

CREATE POLICY "Players can send signaling messages"
    ON signaling_messages FOR INSERT
    WITH CHECK (
        match_id IN (
            SELECT match_id FROM match_players
            WHERE player_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
        )
        AND sender_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    );

-- Function to clean up old finished matches and signaling messages
CREATE OR REPLACE FUNCTION cleanup_old_matches()
RETURNS void AS $$
BEGIN
    DELETE FROM matches
    WHERE status = 'ended'
    AND created_at < NOW() - INTERVAL '1 hour';

    DELETE FROM signaling_messages
    WHERE created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;
