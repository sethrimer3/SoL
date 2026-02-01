-- Supabase Database Schema for SoL Online Play
-- This SQL should be run in the Supabase SQL Editor to set up the database

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

-- RLS Policies for game_rooms
-- Anyone can read waiting rooms
CREATE POLICY "Anyone can view waiting rooms"
    ON game_rooms FOR SELECT
    USING (status = 'waiting');

-- Players in a room can view their room
CREATE POLICY "Players can view their room"
    ON game_rooms FOR SELECT
    USING (
        id IN (
            SELECT room_id FROM room_players 
            WHERE player_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- Anyone can create a room
CREATE POLICY "Anyone can create room"
    ON game_rooms FOR INSERT
    WITH CHECK (true);

-- Only host can update room
CREATE POLICY "Host can update room"
    ON game_rooms FOR UPDATE
    USING (host_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Host can delete room
CREATE POLICY "Host can delete room"
    ON game_rooms FOR DELETE
    USING (host_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for room_players
-- Players in room can view all players in that room
CREATE POLICY "Players can view room members"
    ON room_players FOR SELECT
    USING (
        room_id IN (
            SELECT room_id FROM room_players 
            WHERE player_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- Anyone can join a room (insert themselves)
CREATE POLICY "Anyone can join room"
    ON room_players FOR INSERT
    WITH CHECK (
        player_id = current_setting('request.jwt.claims', true)::json->>'sub'
    );

-- Players can update their own record
CREATE POLICY "Players can update self"
    ON room_players FOR UPDATE
    USING (player_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Players can leave (delete themselves)
CREATE POLICY "Players can leave"
    ON room_players FOR DELETE
    USING (player_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for game_states
-- Players in room can view game states
CREATE POLICY "Players can view game states"
    ON game_states FOR SELECT
    USING (
        room_id IN (
            SELECT room_id FROM room_players 
            WHERE player_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- Only host can insert game states
CREATE POLICY "Host can insert game states"
    ON game_states FOR INSERT
    WITH CHECK (
        room_id IN (
            SELECT id FROM game_rooms 
            WHERE host_id = current_setting('request.jwt.claims', true)::json->>'sub'
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

-- Note: For anonymous access (no authentication), you may need to adjust policies
-- or use service role key for development. For production, implement proper authentication.

-- Alternative policies for anonymous/anon key access (development/beta):
-- These policies allow anonymous users to interact with the system without authentication.
-- Replace the JWT-based policies above with these for anonymous access:

-- IMPORTANT: To use anonymous access, uncomment and run the following:

-- DROP POLICY IF EXISTS "Anyone can view waiting rooms" ON game_rooms;
-- DROP POLICY IF EXISTS "Players can view their room" ON game_rooms;
-- DROP POLICY IF EXISTS "Anyone can create room" ON game_rooms;
-- DROP POLICY IF EXISTS "Host can update room" ON game_rooms;
-- DROP POLICY IF EXISTS "Host can delete room" ON game_rooms;

-- CREATE POLICY "Anon can view waiting rooms"
--     ON game_rooms FOR SELECT
--     TO anon
--     USING (status = 'waiting');

-- CREATE POLICY "Anon can view all rooms"
--     ON game_rooms FOR SELECT
--     TO anon
--     USING (true);

-- CREATE POLICY "Anon can create rooms"
--     ON game_rooms FOR INSERT
--     TO anon
--     WITH CHECK (true);

-- CREATE POLICY "Anon can update any room"
--     ON game_rooms FOR UPDATE
--     TO anon
--     USING (true);

-- CREATE POLICY "Anon can delete any room"
--     ON game_rooms FOR DELETE
--     TO anon
--     USING (true);

-- For room_players table with anonymous access:
-- DROP POLICY IF EXISTS "Players can view room members" ON room_players;
-- DROP POLICY IF EXISTS "Anyone can join room" ON room_players;
-- DROP POLICY IF EXISTS "Players can update self" ON room_players;
-- DROP POLICY IF EXISTS "Players can leave" ON room_players;

-- CREATE POLICY "Anon can view room players"
--     ON room_players FOR SELECT
--     TO anon
--     USING (true);

-- CREATE POLICY "Anon can join rooms"
--     ON room_players FOR INSERT
--     TO anon
--     WITH CHECK (true);

-- CREATE POLICY "Anon can update room players"
--     ON room_players FOR UPDATE
--     TO anon
--     USING (true);

-- CREATE POLICY "Anon can leave rooms"
--     ON room_players FOR DELETE
--     TO anon
--     USING (true);

-- NOTE: Anonymous policies are less secure but suitable for beta testing.
-- For production, implement proper authentication via Supabase Auth.
