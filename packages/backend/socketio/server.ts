import express, { Request, Response } from "express";
import http from "node:http";
import { Server } from "socket.io";
import { ensureMainRoom, seedMockAccounts, DEFAULT_ROOM_ID } from "./seed";
import { handleConnectionEvents } from "./handlers/connection";
import { handleMediaEvents } from "./handlers/media";
import { handleChatEvents } from "./handlers/chat";
import { handleModerationEvents } from "./handlers/moderation";
import { handlePlaylistEvents } from "./handlers/playlist";

const DEFAULT_PORT = 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", roomId: DEFAULT_ROOM_ID });
});

io.on("connection", (socket) => {
    handleConnectionEvents(io, socket);
    handleMediaEvents(io, socket);
    handleChatEvents(io, socket);
    handleModerationEvents(io, socket);
    handlePlaylistEvents(io, socket);
});

async function bootstrap(): Promise<void> {
    await ensureMainRoom();
    await seedMockAccounts();

    const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);
    server.listen(port, () => {
        console.log(`Socket server listening on http://localhost:${port}`);
    });
}

void bootstrap();
