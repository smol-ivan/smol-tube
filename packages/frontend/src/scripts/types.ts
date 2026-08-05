export type ChatMsg = {
    fromUserId: string;
    fromDisplayName: string;
    text: string;
    sentAt: number;
};

export type PlaylistItem = {
    itemId: string;
    videoId: string;
    title: string;
    addedByUserId: string;
    durationSeconds: number;
};

export type ConnectedUser = {
    userId: string;
    displayName: string;
    role?: string;
};
