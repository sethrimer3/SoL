import express from 'express';
import cors from 'cors';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { SoLRoom } from './rooms/SoLRoom';

const port = Number(process.env.PORT || 2567);

// Create Colyseus Server with Express callback
export const gameServer = new Server({
    transport: new WebSocketTransport(),
    express: (app) => {
        app.use(cors());
        app.use(express.json());

        // Health check endpoint
        app.get('/health', (_req, res) => {
            res.json({ status: 'ok', time: Date.now() });
        });

        // API endpoint to query active matches
        app.get('/api/matches', async (_req, res) => {
            try {
                const rooms = await matchMaker.query({ name: 'sol_room' });
                res.json(rooms);
            } catch (error: any) {
                console.error('[SoL Server] Failed to query matches:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
});

// Register SoL RTS game room
gameServer.define('sol_room', SoLRoom)
    .enableRealtimeListing();

// Export function to start server (useful for programmatic testing)
export async function startServer(customPort?: number): Promise<Server> {
    const listenPort = customPort || port;
    await gameServer.listen(listenPort);
    console.log(`[SoL Server] Colyseus game server listening on ws://localhost:${listenPort}`);
    return gameServer;
}

// Start server when executed directly
if (require.main === module) {
    startServer(port).catch((err) => {
        console.error('[SoL Server] Failed to start:', err);
        process.exit(1);
    });
}
