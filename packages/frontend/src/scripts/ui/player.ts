import { state } from "../state";
import { isLeader } from "../utils";
import { applyRemoteRoom } from "../handlers/room";
import { isSuppressEmit} from "../handlers/room";

let ytPlayer: any = null;
let ytReady = false;
let lastReportedTime = 0;
let lastPlayerState: number | null = null;
let currentControlsSetting = 0;

// FIX (bug: "el leader no ve el video que él mismo agregó, hasta
// recargar la página"): `new YT.Player(...)` asigna `ytPlayer` de
// forma SÍNCRONA, pero el player no está realmente operativo hasta
// que dispara `onReady` (asíncrono, tarda mientras el iframe de
// YouTube inicializa). Si createPlayerAndApply se llama de nuevo en
// esa ventana (ej. el leader agrega un video mientras el player
// todavía se está inicializando), antes se tomaba la rama "reusar
// player existente" -> applyPlaybackToPlayer, que llama métodos como
// loadVideoById/getVideoData sobre un player que aún no responde de
// forma confiable, fallando en silencio.
//
// Con este flag + variable, si createPlayerAndApply se llama antes de
// que onReady haya disparado, en vez de intentar aplicar de inmediato
// guardamos el pedido más reciente y lo aplicamos DENTRO de onReady
// una vez el player esté realmente listo.
let playerIsReady = false;
let pendingApply: {
    videoId: string | null;
    time: number;
    paused: boolean;
} | null = null;

export function ensureYouTubeApi(): Promise<void> {
    return new Promise((resolve) => {
        if ((window as any).YT && (window as any).YT.Player) {
            resolve();
            return;
        }
        const existing = document.querySelector("script[data-yt-api]");
        if (!existing) {
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            tag.setAttribute("data-yt-api", "1");
            document.head.appendChild(tag);
        }
        (window as any).onYouTubeIframeAPIReady = () => {
            resolve();
        };
    });
}

export async function createPlayerAndApply(
    remoteVideoId: string | null,
    remoteTime: number,
    remotePaused: boolean,
): Promise<void> {
    const shouldHaveControls = isLeader() ? 1 : 0;
    const needsNewPlayer =
        !ytPlayer || currentControlsSetting !== shouldHaveControls;

    if (needsNewPlayer) {
        await ensureYouTubeApi();

        // FIX (bug: "pantalla negra al convertirte en leader"):
        // YT.Player(elementOrId, ...) NO usa el elemento como
        // contenedor -- lo REEMPLAZA por el <iframe> (así lo dice la
        // documentación oficial: "The IFrame API will replace the
        // specified element with the <iframe> element"). Y
        // player.destroy() elimina ese iframe del DOM por completo.
        //
        // El código anterior guardaba `container` como el
        // <div id="yt-player"> original y trataba de usar su
        // `.parentElement` DESPUÉS de destruir el player -- pero ese
        // div original ya no estaba en el DOM desde la primera vez
        // que se creó un player (fue reemplazado por el iframe), así
        // que `container` era una referencia obsoleta/desconectada,
        // y la recreación fallaba en silencio.
        //
        // Solución: usamos un ANCLA estable (el <div> con el id fijo,
        // que nunca se le pasa directo a YT.Player) y montamos dentro
        // de ella un HIJO desechable nuevo en cada recreación. El
        // ancla nunca es tocada por YouTube, así que siempre podemos
        // ubicarla de forma confiable con getElementById.
        const anchor = document.getElementById("yt-player");
        if (!anchor) return;

        if (ytPlayer && typeof ytPlayer.destroy === "function") {
            try {
                ytPlayer.destroy();
            } catch (e) {
                console.warn("failed to destroy old player", e);
            }
            ytPlayer = null;
        }

        // Limpiamos el ancla y creamos un hijo desechable fresco --
        // este es el nodo que YT.Player reemplazará por el iframe.
        anchor.innerHTML = "";
        const mountPoint = document.createElement("div");
        mountPoint.className = "aspect-video w-full max-h-[70vh]";
        anchor.appendChild(mountPoint);

        currentControlsSetting = shouldHaveControls;
        playerIsReady = false;
        // Guardamos el pedido actual como pendiente -- si llegan más
        // actualizaciones antes de que onReady dispare, se sobrescribe
        // aquí mismo y onReady aplicará siempre la más reciente.
        pendingApply = {
            videoId: remoteVideoId,
            time: remoteTime,
            paused: remotePaused,
        };

        ytPlayer = new (window as any).YT.Player(mountPoint, {
            height: "100%",
            width: "100%",
            playerVars: { controls: shouldHaveControls, rel: 0 },
            events: {
                onReady: () => {
                    ytReady = true;
                    playerIsReady = true;

                    // Aplica el estado más reciente conocido, sea el que
                    // teníamos al momento de crear el player o uno más
                    // nuevo que haya llegado mientras se inicializaba.
                    const toApply = pendingApply ?? {
                        videoId: state.playback.videoId,
                        time: state.playback.currentTime,
                        paused: state.playback.paused,
                    };
                    pendingApply = null;

                    if (toApply.videoId) {
                        ytPlayer.cueVideoById(toApply.videoId, toApply.time);
                        if (!toApply.paused) ytPlayer.playVideo();
                    }

                    // Iniciar el ping de sincronización (ver Problema 2)
                    startContinuousSync();
                },
                onStateChange: (ev: any) => {
                    handlePlayerStateChange(ev);
                },
            },
        });
    } else if (playerIsReady) {
        applyPlaybackToPlayer(remoteVideoId, remoteTime, remotePaused);
    } else {
        // El player existe pero onReady todavía no ha disparado --
        // NO llamamos a sus métodos todavía (fallarían en silencio).
        // Actualizamos el pedido pendiente; onReady lo aplicará.
        pendingApply = {
            videoId: remoteVideoId,
            time: remoteTime,
            paused: remotePaused,
        };
    }
}

function handlePlayerStateChange(ev: any): void {
    const YT = (window as any).YT;
    if (!YT) return;
    const stateCode = ev.data;
    const currentTime = ytPlayer?.getCurrentTime?.() ?? 0;

    if (isSuppressEmit()) {
        lastReportedTime = currentTime;
        lastPlayerState = stateCode;
        return;
    }

    if (!isLeader()) {
        lastReportedTime = currentTime;
        lastPlayerState = stateCode;
        return;
    }

    if (
        stateCode === YT.PlayerState.PLAYING ||
        stateCode === YT.PlayerState.PAUSED
    ) {
        emitMediaUpdateFromPlayer();
    } else if (stateCode === YT.PlayerState.ENDED) {
        state.socket.emit(
            "transitionNext",
            {},
            (resp: { ok: boolean; error?: string; data?: { room?: any } }) => {
                if (!resp.ok) {
                    console.error("transitionNext failed:", resp.error);
                    return;
                }
                if (resp.data?.room) applyRemoteRoom(resp.data.room);
            },
        );
    }

    lastReportedTime = currentTime;
    lastPlayerState = stateCode;
}

function emitMediaUpdateFromPlayer(): void {
    if (!ytPlayer || !isLeader()) return;
    const videoData = ytPlayer.getVideoData?.() ?? {};
    const videoId = videoData.video_id ?? state.playback.videoId ?? null;
    const currentTime = Math.max(
        0,
        Math.floor(ytPlayer.getCurrentTime?.() ?? 0),
    );
    const YT = (window as any).YT;
    const currentCode = ytPlayer.getPlayerState?.();
    const paused = currentCode !== YT?.PlayerState?.PLAYING;

    if (!videoId) return;

    // DEBUG TEMPORAL: confirmar que el leader realmente está emitiendo.
    console.log("[DEBUG] emitMediaUpdateFromPlayer ->", {
        videoId,
        currentTime,
        paused,
    });

    state.socket.emit(
        "mediaUpdate",
        { videoId, currentTime, paused },
        (resp: { ok: boolean; error?: string; data?: { room?: any } }) => {
            // DEBUG TEMPORAL: confirmar la respuesta del servidor.
            console.log("[DEBUG] mediaUpdate ack ->", resp);
            if (!resp.ok) {
                console.error("mediaUpdate failed:", resp.error);
                return;
            }
            if (resp.data?.room) applyRemoteRoom(resp.data.room);
        },
    );
}

export function applyPlaybackToPlayer(
    videoId: string | null,
    time: number,
    paused: boolean,
): void {
    if (!ytPlayer) return;
    try {
        if (!videoId) return;

        const currentVideoId = ytPlayer.getVideoData?.()?.video_id ?? null;

        // DEBUG TEMPORAL: confirmar que esta función se llama y con qué datos.
        console.log("[DEBUG] applyPlaybackToPlayer ->", {
            currentVideoId,
            incomingVideoId: videoId,
            time,
            paused,
            currentTime: ytPlayer.getCurrentTime?.(),
        });

        if (currentVideoId !== videoId) {
            ytPlayer.loadVideoById(videoId, time);
        } else {
            if (isLeader()) return; // El leader nunca ajusta su propio tiempo/estado

            const YT = (window as any).YT;
            const stateCode = ytPlayer.getPlayerState?.();
            const currentTime = ytPlayer.getCurrentTime?.() ?? 0;

            const wantsPaused = paused;
            const isCurrentlyPlaying = stateCode === YT.PlayerState.PLAYING;
            const stateChanged = wantsPaused === isCurrentlyPlaying; // quiere pausado pero jugando, o viceversa

            // Threshold alto para drift puro durante reproducción normal.
            // Los heartbeats del leader llegan con el tiempo que tenía él en ese momento,
            // por eso el listener siempre parece "adelantado" en comparación — eso es normal.
            // Solo corregimos si el drift es verdaderamente grande (dessync real),
            // o si hubo un cambio de estado (play/pause/seek del leader).
            const DRIFT_THRESHOLD_SECONDS = 15;
            const drift = Math.abs(currentTime - time);
            const needsSeek = drift > DRIFT_THRESHOLD_SECONDS;

            if (stateChanged) {
                // Cambio real de play/pause — ajustar estado y tiempo solo si hay drift visible
                if (drift > 2) ytPlayer.seekTo(time, true);
                if (wantsPaused) ytPlayer.pauseVideo();
                else ytPlayer.playVideo();
            } else if (needsSeek) {
                // Dessync real (> 15s de diferencia) — corregir silenciosamente
                ytPlayer.seekTo(time, true);
            }
            // Si no hay cambio de estado y drift < 15s → no tocar al listener
        }
    } catch (e) {
        console.error("applyPlaybackToPlayer error", e);
    }
}

let syncInterval: number | null = null;

export function startContinuousSync(): void {
    // Evitar múltiples intervalos si se destruye y recrea el player
    if (syncInterval) clearInterval(syncInterval);

    // DEBUG TEMPORAL: confirmar que el intervalo arranca.
    console.log("[DEBUG] startContinuousSync arrancado, isLeader:", isLeader());

    syncInterval = window.setInterval(() => {
        const YT = (window as any).YT;
        if (!YT || !ytPlayer || !ytReady) return;

        // DEBUG TEMPORAL: ver el tick del intervalo cada 5s, sin filtrar.
        console.log("[DEBUG] syncInterval tick ->", {
            isLeader: isLeader(),
            playerState: ytPlayer.getPlayerState?.(),
            PLAYING: YT.PlayerState.PLAYING,
        });

        // Solo emitimos el "ping" si somos el leader y el video se está reproduciendo
        if (
            isLeader() &&
            ytPlayer.getPlayerState?.() === YT.PlayerState.PLAYING
        ) {
            emitMediaUpdateFromPlayer();
        }
    }, 5000); // Emite el estado cada 5 segundos
}
