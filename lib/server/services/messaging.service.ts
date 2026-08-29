import type { ConversationMember, Message, Prisma } from "@prisma/client";

import { AppError } from "../middleware/error.middleware";
import type { AuthUser } from "./auth.service";
import { appStateStoreService } from "./app-state-store.service";
import { authorizationService } from "./authorization.service";
import { candidateStoreService } from "./candidate-store.service";
import { jobService } from "./job.service";
import { messagingEventsService } from "./messaging-events.service";
import { prisma } from "./prisma.service";
import { pushNotificationService } from "./push-notification.service";

const conversationListInclude = {
  members: true,
  messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" as const }, take: 1 }
} satisfies Prisma.ConversationInclude;

type ConversationListRow = Prisma.ConversationGetPayload<{ include: typeof conversationListInclude }>;

interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
}

interface CreateConversationInput {
  type?: unknown;
  title?: unknown;
  memberIds?: unknown;
  candidateId?: unknown;
  jobId?: unknown;
}

interface SendMessageInput {
  body?: unknown;
  clientId?: unknown;
  mentionedUserIds?: unknown;
}

class MessagingService {
  async listDirectory(currentUser: AuthUser): Promise<DirectoryUser[]> {
    const users = await appStateStoreService.getUsers();
    const normalized = users
      .filter((record) => String(record.status || "Active").toLowerCase() !== "inactive")
      .map(normalizeDirectoryUser)
      .filter((user): user is DirectoryUser => Boolean(user));

    if (!normalized.some((user) => user.id === currentUser.id)) {
      normalized.unshift({ id: currentUser.id, name: currentUser.name, email: currentUser.email, role: currentUser.role, team: "Leadership" });
    }

    return normalized.sort((left, right) => left.name.localeCompare(right.name));
  }

  async listConversations(user: AuthUser) {
    const rows = await prisma.conversation.findMany({
      where: { members: { some: { userId: user.id, leftAt: null } } },
      include: conversationListInclude,
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }]
    });

    return Promise.all(rows.map(async (row) => {
      const membership = row.members.find((member) => member.userId === user.id);
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: row.id,
          deletedAt: null,
          senderUserId: { not: user.id },
          ...(membership?.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {})
        }
      });
      return this.serializeConversation(row, user.id, unreadCount);
    }));
  }

  async createConversation(user: AuthUser, input: CreateConversationInput) {
    const directory = await this.listDirectory(user);
    const requestedIds = Array.isArray(input.memberIds) ? input.memberIds.map(String) : [];
    const memberIds = [...new Set([user.id, ...requestedIds.map((id) => id.trim()).filter(Boolean)])];
    if (memberIds.length < 2) throw new AppError("Choose at least one team member", 400);
    if (memberIds.length > 50) throw new AppError("A conversation can include at most 50 members", 400);

    const directoryById = new Map(directory.map((member) => [member.id, member]));
    const members = memberIds.map((id) => directoryById.get(id)).filter((member): member is DirectoryUser => Boolean(member));
    if (members.length !== memberIds.length) throw new AppError("One or more selected team members are unavailable", 400);

    const requestedType = String(input.type || "").trim().toUpperCase();
    const candidateId = String(input.candidateId || "").trim() || null;
    const jobId = String(input.jobId || "").trim() || null;
    const type = candidateId ? "CANDIDATE" : jobId ? "JOB" : memberIds.length === 2 && requestedType !== "GROUP" ? "DIRECT" : "GROUP";
    await this.assertContextAccess(user, candidateId, jobId);

    const directKey = type === "DIRECT" ? [...memberIds].sort().join(":") : null;
    if (directKey) {
      const existing = await prisma.conversation.findUnique({ where: { directKey }, include: conversationListInclude });
      if (existing) return this.serializeConversation(existing, user.id, 0);
    }

    const titleInput = String(input.title || "").trim().slice(0, 120);
    const defaultTitle = members.filter((member) => member.id !== user.id).map((member) => member.name).join(", ");
    const title = type === "DIRECT" ? null : titleInput || defaultTitle || "Team conversation";

    const created = await prisma.conversation.create({
      data: {
        type,
        title,
        directKey,
        candidateId,
        jobId,
        createdByUserId: user.id,
        createdByName: user.name,
        createdByEmail: user.email,
        members: {
          create: members.map((member) => ({
            userId: member.id,
            userName: member.name,
            userEmail: member.email
          }))
        }
      },
      include: conversationListInclude
    });

    messagingEventsService.publish(memberIds, {
      type: "conversation.created",
      conversationId: created.id,
      actorUserId: user.id
    });
    return this.serializeConversation(created, user.id, 0);
  }

  async getConversation(user: AuthUser, conversationId: string) {
    const conversation = await this.requireMembership(user, conversationId);
    const messages = await prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 200
    });
    return {
      conversation: this.serializeConversation({ ...conversation, messages: messages.slice(-1) }, user.id, 0),
      messages: messages.map((message) => serializeMessage(message, conversation.members, user.id))
    };
  }

  async sendMessage(user: AuthUser, conversationId: string, input: SendMessageInput) {
    const conversation = await this.requireMembership(user, conversationId);
    const body = String(input.body || "").replace(/\r\n/g, "\n").trim();
    if (!body) throw new AppError("Message cannot be empty", 400);
    if (body.length > 4000) throw new AppError("Messages are limited to 4,000 characters", 400);

    const clientId = String(input.clientId || "").trim().slice(0, 120) || null;
    if (clientId) {
      const existing = await prisma.message.findUnique({ where: { clientId } });
      if (existing) {
        if (existing.conversationId !== conversationId || existing.senderUserId !== user.id) {
          throw new AppError("Message client ID is already in use", 409);
        }
        return serializeMessage(existing, conversation.members, user.id);
      }
    }

    const memberIds = new Set(conversation.members.filter((member) => !member.leftAt).map((member) => member.userId));
    const mentionedUserIds = Array.isArray(input.mentionedUserIds)
      ? [...new Set(input.mentionedUserIds.map(String).map((id) => id.trim()).filter((id) => id && memberIds.has(id) && id !== user.id))]
      : [];
    const createdAt = new Date();
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          clientId,
          senderUserId: user.id,
          senderName: user.name,
          senderEmail: user.email,
          body,
          metadata: { mentionedUserIds }
        }
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: createdAt } });
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: user.id } },
        data: {
          lastDeliveredMessageId: created.id,
          lastDeliveredAt: created.createdAt,
          lastReadMessageId: created.id,
          lastReadAt: created.createdAt
        }
      });
      return created;
    });

    const recipientIds = conversation.members
      .filter((member) => !member.leftAt && member.userId !== user.id)
      .map((member) => member.userId);
    messagingEventsService.publish(conversation.members.map((member) => member.userId), {
      type: "message.created",
      conversationId,
      messageId: message.id,
      actorUserId: user.id
    });
    void pushNotificationService.sendMessagePush({
      conversationId,
      conversationType: conversation.type,
      conversationTitle: resolveConversationTitle(conversation, user.id),
      sender: user,
      recipientIds,
      mentionedUserIds
    });

    const refreshedMembers = await prisma.conversationMember.findMany({ where: { conversationId } });
    return serializeMessage(message, refreshedMembers, user.id);
  }

  async updateReceipt(
    user: AuthUser,
    conversationId: string,
    input: { deliveredThrough?: unknown; seenThrough?: unknown }
  ) {
    const conversation = await this.requireMembership(user, conversationId);
    const deliveredMessage = await this.resolveReceiptMessage(conversationId, input.deliveredThrough);
    const seenMessage = await this.resolveReceiptMessage(conversationId, input.seenThrough);
    const effectiveDelivered = laterMessage(deliveredMessage, seenMessage);
    if (!effectiveDelivered && !seenMessage) throw new AppError("A valid receipt message is required", 400);

    const membership = conversation.members.find((member) => member.userId === user.id);
    if (!membership) throw new AppError("Conversation not found", 404);
    const data: Prisma.ConversationMemberUpdateInput = {};
    if (effectiveDelivered && (!membership.lastDeliveredAt || effectiveDelivered.createdAt > membership.lastDeliveredAt)) {
      data.lastDeliveredMessageId = effectiveDelivered.id;
      data.lastDeliveredAt = effectiveDelivered.createdAt;
    }
    if (seenMessage && (!membership.lastReadAt || seenMessage.createdAt > membership.lastReadAt)) {
      data.lastReadMessageId = seenMessage.id;
      data.lastReadAt = seenMessage.createdAt;
    }
    if (Object.keys(data).length) {
      await prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: user.id } },
        data
      });
      messagingEventsService.publish(conversation.members.map((member) => member.userId), {
        type: "receipt.updated",
        conversationId,
        messageId: seenMessage?.id || effectiveDelivered?.id,
        actorUserId: user.id
      });
    }
    return { deliveredAt: effectiveDelivered?.createdAt || membership.lastDeliveredAt, seenAt: seenMessage?.createdAt || membership.lastReadAt };
  }

  private async requireMembership(user: AuthUser, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, members: { some: { userId: user.id, leftAt: null } } },
      include: { members: true }
    });
    if (!conversation) {
      await authorizationService.logUnauthorizedAccess({
        userId: user.id,
        endpoint: `/api/messages/conversations/${conversationId}`,
        entityType: "conversation",
        entityId: conversationId
      });
      throw new AppError("Conversation not found", 404);
    }
    return conversation;
  }

  private async assertContextAccess(user: AuthUser, candidateId: string | null, jobId: string | null): Promise<void> {
    if (!candidateId && !jobId) return;
    const context = await authorizationService.createContext(user);
    if (candidateId && !(await candidateStoreService.getCandidateForContext(context, candidateId))) {
      throw new AppError("Candidate not found", 404);
    }
    if (jobId) await jobService.getForContext(context, jobId);
  }

  private async resolveReceiptMessage(conversationId: string, idInput: unknown): Promise<Message | null> {
    const id = String(idInput || "").trim();
    if (!id) return null;
    return prisma.message.findFirst({ where: { id, conversationId, deletedAt: null } });
  }

  private serializeConversation(row: ConversationListRow, currentUserId: string, unreadCount: number) {
    const membership = row.members.find((member) => member.userId === currentUserId);
    const lastMessage = row.messages[0] || null;
    return {
      id: row.id,
      type: row.type,
      title: resolveConversationTitle(row, currentUserId),
      candidateId: row.candidateId,
      jobId: row.jobId,
      createdByUserId: row.createdByUserId,
      lastMessageAt: (row.lastMessageAt || row.updatedAt).toISOString(),
      unreadCount,
      muted: membership?.muted || false,
      pushEnabled: membership?.pushEnabled ?? true,
      members: row.members.filter((member) => !member.leftAt).map(serializeMember),
      lastMessage: lastMessage ? serializeMessage(lastMessage, row.members, currentUserId) : null
    };
  }
}

const normalizeDirectoryUser = (record: Record<string, unknown>): DirectoryUser | null => {
  const id = String(record.id || "").trim();
  const name = String(record.name || "").trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    email: String(record.email || "").trim().toLowerCase(),
    role: String(record.role || "Recruiter"),
    team: String(record.team || "Recruiting")
  };
};

const serializeMember = (member: ConversationMember) => ({
  userId: member.userId,
  name: member.userName,
  email: member.userEmail,
  deliveredAt: member.lastDeliveredAt?.toISOString() || null,
  seenAt: member.lastReadAt?.toISOString() || null
});

const serializeMessage = (message: Message, members: ConversationMember[], currentUserId: string) => {
  const recipients = members.filter((member) => !member.leftAt && member.userId !== message.senderUserId);
  const deliveredBy = recipients
    .filter((member) => member.lastDeliveredAt && member.lastDeliveredAt >= message.createdAt)
    .map((member) => ({ userId: member.userId, name: member.userName, at: member.lastDeliveredAt?.toISOString() }));
  const seenBy = recipients
    .filter((member) => member.lastReadAt && member.lastReadAt >= message.createdAt)
    .map((member) => ({ userId: member.userId, name: member.userName, at: member.lastReadAt?.toISOString() }));
  const senderOwnsMessage = message.senderUserId === currentUserId;
  const status = !senderOwnsMessage
    ? "received"
    : recipients.length > 0 && seenBy.length === recipients.length
      ? "seen"
      : recipients.length > 0 && deliveredBy.length === recipients.length
        ? "delivered"
        : "sent";
  const metadata = message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
    ? message.metadata as Record<string, unknown>
    : {};
  return {
    id: message.id,
    clientId: message.clientId,
    conversationId: message.conversationId,
    senderUserId: message.senderUserId,
    senderName: message.senderName,
    body: message.deletedAt ? "This message was deleted" : message.body,
    kind: message.kind,
    mentionedUserIds: Array.isArray(metadata.mentionedUserIds) ? metadata.mentionedUserIds.map(String) : [],
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() || null,
    isOwn: senderOwnsMessage,
    receipt: {
      status,
      recipientCount: recipients.length,
      deliveredCount: deliveredBy.length,
      seenCount: seenBy.length,
      deliveredBy,
      seenBy
    }
  };
};

const resolveConversationTitle = (
  conversation: { type: string; title: string | null; members: ConversationMember[] },
  currentUserId: string
): string => {
  if (conversation.type === "DIRECT") {
    return conversation.members.find((member) => !member.leftAt && member.userId !== currentUserId)?.userName || "Direct message";
  }
  return conversation.title || "Team conversation";
};

const laterMessage = (left: Message | null, right: Message | null): Message | null => {
  if (!left) return right;
  if (!right) return left;
  return left.createdAt >= right.createdAt ? left : right;
};

export const messagingService = new MessagingService();
