import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { SoLRoom } from './rooms/SoLRoom';

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: Date.now() });
});

// Create HTTP server
const httpServer = http.createServer(app);

// Create Colyseus Server
export const gameServer = new Server({
    transport: new WebSocketTransport({
        server: httpServer
    })
});

// Register SoL RTS game room
gameServer.define('sol_room', SoLRoom)
    .enableRealtimeListing();

// Export function to start server (useful for programmatic testing)
export function startServer(customPort?: number): Promise<http.Server> {
    const listenPort = customPort || port;
    return new Promise((resolve) => {
        httpServer.listen(listenPort, () => {
            console.log(`[SoL Server] Colyseus game server listening on ws://localhost:${listenPort}`);
            resolve(httpServer);
        });
    });
}

// Start server when executed directly
if (require.main === module) {
    startServer(port).catch((err) => {
        console.error('[SoL Server] Failed to start:', err);
        process.exit(1);
    });
}
