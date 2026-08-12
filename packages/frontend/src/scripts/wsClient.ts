// src/wsClient.ts

type EventHandler = (data: any) => void;

export class WSClient {
    private ws: WebSocket | null = null;
    private listeners: Record<string, EventHandler[]> = {};
    private url: string;
    public connected = false;

    // Callbacks de ciclo de vida
    public onConnect?: () => void;
    public onDisconnect?: () => void;

    constructor(url: string) {
        this.url = url;
    }

    connect() {
        if (this.ws) return;

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.connected = true;
            if (this.onConnect) this.onConnect();
        };

        this.ws.onclose = () => {
            this.connected = false;
            this.ws = null;
            if (this.onDisconnect) this.onDisconnect();
        };

        this.ws.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                // AWS API Gateway nos devolverá cosas como { action: "chatMsg", data: {...} }
                const action = parsed.action;
                const payload = parsed.data;

                if (action && this.listeners[action]) {
                    this.listeners[action].forEach((cb) => cb(payload));
                }
            } catch (e) {
                console.error("Error parseando mensaje WS:", e);
            }
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    // Imita el socket.on("evento", callback)
    on(action: string, callback: EventHandler) {
        if (!this.listeners[action]) {
            this.listeners[action] = [];
        }
        this.listeners[action].push(callback);
    }

    // Imita el socket.once("connect", callback)
    once(action: string, callback: EventHandler) {
        if (action === "connect") {
            const check = setInterval(() => {
                if (this.connected) {
                    clearInterval(check);
                    callback({});
                }
            }, 50);
        }
    }

    // Imita el socket.emit("accion", payload, callback)
    emit(action: string, payload: any, callback?: Function) {
        if (this.ws && this.connected) {
            // El formato que requiere nuestra configuración de AWS SAM RouteSelectionExpression
            const message = JSON.stringify({ action, payload });
            this.ws.send(message);

            // SIMULADOR DE CALLBACKS:
            // Como AWS WS no responde directamente a este emit,
            // simulamos un 'ok: true' para que el frontend libere los botones (ej. loginModal).
            if (callback) {
                setTimeout(() => callback({ ok: true }), 150);
            }
        } else {
            if (callback)
                callback({ ok: false, error: "No conectado al servidor" });
        }
    }
}
