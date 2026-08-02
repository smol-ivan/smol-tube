// domain/chat-message.ts
//
// Forma de un mensaje de chat. Deliberadamente NO incluimos un
// "messageId" persistente ni asumimos que esto se guarda en ningún
// lado -- según decidiste, el historial de chat puede ser puro
// pasa-through (Lambda recibe -> reenvía a todos -> no guarda nada).
//
// Si en el futuro decides sí guardar los últimos N mensajes (por
// ejemplo, para que alguien que se conecta tarde vea contexto), esta
// misma forma sirve tanto para el mensaje "en vuelo" como para un
// registro persistido -- no hace falta otra entidad.

export interface ChatMessage {
    fromUserId: string;
    fromDisplayName: string;
    text: string;
    sentAt: number; // epoch seconds
}

// Reglas mínimas de validación que SÍ viven en domain/ porque son
// negocio puro, no infraestructura (a diferencia del rate-limiting,
// que si decides tenerlo, probablemente necesite estado compartido
// entre invocaciones -- eso va en un repository, no aquí).
const MAX_MESSAGE_LENGTH = 320;

export function isValidChatMessage(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;
}
