// domain/chat-message.ts
//
// Shape of a chat message. There is deliberately no persistent
// "messageId": chat is pass-through (Lambda receives -> broadcasts to
// everyone -> stores nothing).
//
// If the last N messages are ever kept (e.g. so late joiners get some
// context), this same shape works for both the in-flight message and
// the stored record -- no extra entity needed.

export interface ChatMessage {
    fromUserId: string;
    fromDisplayName: string;
    text: string;
    sentAt: number; // epoch seconds
}

// Minimal validation lives in domain/ because it is pure business
// logic, not infrastructure (unlike rate limiting, which would need
// state shared across invocations -- that belongs in a repository).
const MAX_MESSAGE_LENGTH = 320;

export function isValidChatMessage(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;
}
