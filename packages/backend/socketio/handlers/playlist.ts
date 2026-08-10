import { Server, Socket } from "socket.io";
import { 
    Room, 
    applyPlaylistAdd, 
    applyPlaylistRemove, 
    applyPlaylistReorder, 
    applyPlaylistPlay, 
    applySkipVote, 
    applyTransitionToNext 
} from "@smol-tube/domain";
import { 
    AckFn, 
    PlaylistAddPayload, 
    PlaylistRemovePayload, 
    PlaylistReorderPayload,
    PlaylistPlayPayload,
    SkipVotePayload,
    TransitionNextPayload
} from "../types";
import { getConnectedContext, fail, ok } from "../utils";
import { roomRepository } from "../state";
import crypto from "node:crypto";

// Convierte duración ISO 8601 (ej. "PT4M13S", "PT1H2M3S") a segundos.
function parseIsoDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const h = parseInt(match[1] ?? "0", 10);
    const m = parseInt(match[2] ?? "0", 10);
    const s = parseInt(match[3] ?? "0", 10);
    return h * 3600 + m * 60 + s;
}

interface VideoMeta {
    title: string;
    durationSeconds: number;
    thumbnailUrl: string;
}

// Obtiene metadatos desde YouTube Data API v3.
// Si la API key no está configurada o la llamada falla, devuelve fallbacks.
async function fetchVideoMeta(videoId: string): Promise<VideoMeta> {
    const fallback: VideoMeta = {
        title: videoId,
        durationSeconds: 0,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        console.warn("[playlist] YOUTUBE_API_KEY no configurada — usando fallback de metadatos");
        return fallback;
    }

    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`[playlist] YouTube Data API respondió ${res.status} para videoId=${videoId}`);
            return fallback;
        }
        const data = (await res.json()) as {
            items?: Array<{
                snippet?: { title?: string; thumbnails?: { medium?: { url?: string } } };
                contentDetails?: { duration?: string };
            }>;
        };
        const item = data.items?.[0];
        if (!item) {
            console.warn(`[playlist] YouTube Data API: no se encontró el video ${videoId}`);
            return fallback;
        }
        return {
            title: item.snippet?.title ?? videoId,
            durationSeconds: parseIsoDuration(item.contentDetails?.duration ?? ""),
            thumbnailUrl:
                item.snippet?.thumbnails?.medium?.url ??
                `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        };
    } catch (err) {
        console.error("[playlist] Error al obtener metadatos de YouTube:", err);
        return fallback;
    }
}

export function handlePlaylistEvents(io: Server, socket: Socket) {
    socket.on(
        "playlistAdd",
        async (payload: PlaylistAddPayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            // El backend obtiene los metadatos — el frontend solo manda el videoId.
            const meta = await fetchVideoMeta(payload.videoId);

            const updatedRoom = applyPlaylistAdd(context.room, {
                requestingUser: context.user,
                addedVideo: {
                    itemId: crypto.randomUUID(),
                    videoId: payload.videoId,
                    title: meta.title,
                    thumbnailUrl: meta.thumbnailUrl,
                    addedByUserId: context.user.userId,
                    durationSeconds: meta.durationSeconds,
                },
                ...(payload.atTop !== undefined ? { atTop: payload.atTop } : {}),
            });

            if (!updatedRoom) {
                fail(ack, "playlistAdd rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );


    socket.on(
        "playlistRemove",
        async (payload: PlaylistRemovePayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const targetItem = context.room.playlist.find(item => item.itemId === payload.itemId);
            if (!targetItem) {
                fail(ack, "playlist item not found");
                return;
            }

            const updatedRoom = applyPlaylistRemove(context.room, {
                requestingUser: context.user,
                removedVideo: targetItem,
            });

            if (!updatedRoom) {
                fail(ack, "playlistRemove rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );

    socket.on(
        "playlistReorder",
        async (payload: PlaylistReorderPayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const updatedRoom = applyPlaylistReorder(context.room, {
                requestingUser: context.user,
                fromIndex: payload.fromIndex,
                toIndex: payload.toIndex,
            });

            if (!updatedRoom) {
                fail(ack, "playlistReorder rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );

    socket.on(
        "playlistPlay",
        async (payload: PlaylistPlayPayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const updatedRoom = applyPlaylistPlay(context.room, {
                requestingUser: context.user,
                itemId: payload.itemId,
            });

            if (!updatedRoom) {
                fail(ack, "playlistPlay rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );

    socket.on(
        "skipVote",
        async (payload: SkipVotePayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            let updatedRoom = applySkipVote(context.room, {
                requestingUser: context.user,
            });

            if (!updatedRoom) {
                fail(ack, "skipVote rejected by domain rules");
                return;
            }
            
            // Si la cantidad de votos supera la mitad de los clientes conectados (o algún umbral)
            // Por simplicidad, tomaremos > 50% de los sockets en la room, o 2 votos mínimo, etc.
            // io.sockets.adapter.rooms.get(context.room.roomId)?.size;
            const roomSize = io.sockets.adapter.rooms.get(context.room.roomId)?.size || 1;
            const requiredVotes = Math.ceil(roomSize / 2);
            
            if (updatedRoom.skipVotes.length >= requiredVotes) {
                // Hacer el skip
                const nextRoom = applyTransitionToNext(updatedRoom, {
                    requestingUser: context.user, // User forcing skip
                });
                if (nextRoom) {
                    updatedRoom = nextRoom;
                }
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );

    socket.on(
        "transitionNext",
        async (payload: TransitionNextPayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const updatedRoom = applyTransitionToNext(context.room, {
                requestingUser: context.user,
            });

            if (!updatedRoom) {
                fail(ack, "transitionNext rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );
}
