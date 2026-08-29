export interface MessagingEvent {
  id: string;
  type: "conversation.created" | "message.created" | "receipt.updated";
  conversationId: string;
  messageId?: string;
  actorUserId: string;
  createdAt: string;
}

type MessagingEventListener = (event: MessagingEvent) => void;

class MessagingEventsService {
  private readonly listeners = new Map<string, Set<MessagingEventListener>>();

  subscribe(userId: string, listener: MessagingEventListener): () => void {
    const key = String(userId || "").trim();
    const existing = this.listeners.get(key) ?? new Set<MessagingEventListener>();
    existing.add(listener);
    this.listeners.set(key, existing);

    return () => {
      const current = this.listeners.get(key);
      current?.delete(listener);
      if (!current?.size) this.listeners.delete(key);
    };
  }

  publish(userIds: string[], event: Omit<MessagingEvent, "id" | "createdAt">): MessagingEvent {
    const message: MessagingEvent = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };

    new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean)).forEach((userId) => {
      this.listeners.get(userId)?.forEach((listener) => listener(message));
    });

    return message;
  }
}

export const messagingEventsService = new MessagingEventsService();
