import { promises as fs } from "fs";
import path from "path";

interface MemoryEntry {
  id: string;
  ownerUserId: string;
  prompt: string;
  explanation: string;
  toolCalls: string[];
  resultsPreview: string;
  helpful: boolean | null;
  correction: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ConversationThread {
  id: string;
  ownerUserId: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

interface AIMemoryStore {
  memories: MemoryEntry[];
  conversations: ConversationThread[];
}

interface RecordInteractionInput {
  ownerUserId?: string;
  prompt: string;
  explanation: string;
  toolCalls: string[];
  results: Record<string, unknown>[];
  conversationId: string;
}

interface FeedbackInput {
  interactionId: string;
  ownerUserId?: string;
  helpful: boolean;
  correction?: string;
}

const STORE_FILE = path.resolve(process.cwd(), "data", "ai-memory.json");

export class AIMemoryService {
  private initialized = false;
  private store: AIMemoryStore = { memories: [], conversations: [] };

  constructor(private readonly storeFile = STORE_FILE) {}

  async recordInteraction(input: RecordInteractionInput): Promise<string> {
    await this.ensureLoaded();

    const id = createId("mem");
    const now = new Date().toISOString();
    const preview = JSON.stringify(input.results.slice(0, 2));

    this.store.memories.unshift({
      id,
      ownerUserId: normalizeOwnerId(input.ownerUserId),
      prompt: String(input.prompt || "").trim(),
      explanation: String(input.explanation || "").trim(),
      toolCalls: Array.isArray(input.toolCalls) ? input.toolCalls.map((item) => String(item)) : [],
      resultsPreview: preview,
      helpful: null,
      correction: "",
      createdAt: now,
      updatedAt: now
    });

    this.store.memories = this.store.memories.slice(0, 1000);

    await this.appendConversationMessage(input.conversationId, "user", input.prompt, false, input.ownerUserId);
    await this.appendConversationMessage(input.conversationId, "assistant", input.explanation, false, input.ownerUserId);
    await this.persist();

    return id;
  }

  async applyFeedback(input: FeedbackInput): Promise<MemoryEntry> {
    await this.ensureLoaded();

    const ownerUserId = normalizeOwnerId(input.ownerUserId);
    const interaction = this.store.memories.find((item) =>
      item.id === input.interactionId && (!ownerUserId || item.ownerUserId === ownerUserId)
    );
    if (!interaction) {
      throw new Error("Interaction not found");
    }

    interaction.helpful = Boolean(input.helpful);
    interaction.correction = String(input.correction || "").trim();
    interaction.updatedAt = new Date().toISOString();

    await this.persist();
    return { ...interaction };
  }

  async getConversation(conversationId: string, ownerUserIdInput?: string): Promise<ConversationThread> {
    await this.ensureLoaded();
    const cleanId = String(conversationId || "").trim() || createId("conv");
    const ownerUserId = normalizeOwnerId(ownerUserIdInput);

    let thread = this.store.conversations.find((item) =>
      item.id === cleanId && (!ownerUserId || item.ownerUserId === ownerUserId)
    );
    if (!thread) {
      const now = new Date().toISOString();
      thread = {
        id: cleanId,
        ownerUserId,
        messages: [],
        createdAt: now,
        updatedAt: now
      };
      this.store.conversations.unshift(thread);
      this.store.conversations = this.store.conversations.slice(0, 200);
      await this.persist();
    }

    return {
      ...thread,
      messages: [...thread.messages]
    };
  }

  async appendConversationMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    persist = true,
    ownerUserIdInput?: string
  ): Promise<void> {
    await this.ensureLoaded();
    const ownerUserId = normalizeOwnerId(ownerUserIdInput);
    const thread = await this.getConversation(conversationId, ownerUserId);
    const index = this.store.conversations.findIndex((item) =>
      item.id === thread.id && (!ownerUserId || item.ownerUserId === ownerUserId)
    );
    if (index < 0) return;

    const now = new Date().toISOString();
    this.store.conversations[index].messages.push({
      role,
      content: String(content || "").trim(),
      createdAt: now
    });
    this.store.conversations[index].messages = this.store.conversations[index].messages.slice(-30);
    this.store.conversations[index].updatedAt = now;

    if (persist) {
      await this.persist();
    }
  }

  async findRelevantMemories(prompt: string, limit = 3, ownerUserIdInput?: string): Promise<MemoryEntry[]> {
    await this.ensureLoaded();

    const queryTerms = tokenize(prompt);
    if (!queryTerms.length) return [];
    const ownerUserId = normalizeOwnerId(ownerUserIdInput);

    const scored = this.store.memories
      .filter((item) => !ownerUserId || item.ownerUserId === ownerUserId)
      .map((item) => {
        const haystackTerms = tokenize(`${item.prompt} ${item.explanation} ${item.correction}`);
        const overlap = countOverlap(queryTerms, haystackTerms);
        const helpfulBoost = item.helpful === true ? 1 : item.helpful === false ? -0.4 : 0;
        const score = overlap + helpfulBoost;
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => ({ ...entry.item }));

    return scored;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(path.dirname(this.storeFile), { recursive: true });
    try {
      const raw = await fs.readFile(this.storeFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<AIMemoryStore>;
      this.store = {
        memories: Array.isArray(parsed.memories) ? parsed.memories.map((item) => normalizeMemoryEntry(item)) : [],
        conversations: Array.isArray(parsed.conversations) ? parsed.conversations.map((item) => normalizeConversation(item)) : []
      };
    } catch {
      this.store = { memories: [], conversations: [] };
      await this.persist();
    }

    this.initialized = true;
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.storeFile, JSON.stringify(this.store, null, 2), "utf8");
  }
}

const normalizeMemoryEntry = (item: Partial<MemoryEntry>): MemoryEntry => {
  const now = new Date().toISOString();
  return {
    id: String(item.id || createId("mem")),
    ownerUserId: normalizeOwnerId(item.ownerUserId),
    prompt: String(item.prompt || ""),
    explanation: String(item.explanation || ""),
    toolCalls: Array.isArray(item.toolCalls) ? item.toolCalls.map((entry) => String(entry)) : [],
    resultsPreview: String(item.resultsPreview || ""),
    helpful: typeof item.helpful === "boolean" ? item.helpful : null,
    correction: String(item.correction || ""),
    createdAt: String(item.createdAt || now),
    updatedAt: String(item.updatedAt || now)
  };
};

const normalizeConversation = (item: Partial<ConversationThread>): ConversationThread => {
  const now = new Date().toISOString();
  return {
    id: String(item.id || createId("conv")),
    ownerUserId: normalizeOwnerId(item.ownerUserId),
    messages: Array.isArray(item.messages)
      ? item.messages.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: String(message.content || ""),
          createdAt: String(message.createdAt || now)
        }))
      : [],
    createdAt: String(item.createdAt || now),
    updatedAt: String(item.updatedAt || now)
  };
};

const createId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeOwnerId = (value: unknown): string => String(value || "").trim().toLowerCase();

const tokenize = (value: string): string[] =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);

const countOverlap = (a: string[], b: string[]): number => {
  const setB = new Set(b);
  let count = 0;
  a.forEach((term) => {
    if (setB.has(term)) count += 1;
  });
  return count;
};

export const aiMemoryService = new AIMemoryService();
