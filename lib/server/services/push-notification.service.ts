import webpush from "web-push";
import { isIP } from "node:net";

import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import type { AuthUser } from "./auth.service";
import { prisma } from "./prisma.service";
import { logger } from "../utils/logger";

const PREFERENCE_FIELDS = [
  "pushEnabled",
  "directMessages",
  "groupMessages",
  "mentions",
  "candidateUpdates",
  "jobUpdates",
  "interviewReminders",
  "followUpReminders",
  "founderReviews"
] as const;

type PreferenceField = (typeof PREFERENCE_FIELDS)[number];

export interface PushSubscriptionInput {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  userAgent?: unknown;
}

export interface MessagePushInput {
  conversationId: string;
  conversationType: string;
  conversationTitle: string;
  sender: AuthUser;
  recipientIds: string[];
  mentionedUserIds: string[];
}

class PushNotificationService {
  private configured = false;

  constructor() {
    if (env.vapidPublicKey && env.vapidPrivateKey) {
      try {
        webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
        this.configured = true;
      } catch (error) {
        logger.error("Web Push VAPID configuration is invalid", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  getPublicConfig(): { configured: boolean; publicKey: string } {
    return { configured: this.configured, publicKey: this.configured ? env.vapidPublicKey : "" };
  }

  async subscribe(user: AuthUser, input: PushSubscriptionInput): Promise<void> {
    const endpoint = String(input.endpoint || "").trim();
    const p256dh = String(input.keys?.p256dh || "").trim();
    const auth = String(input.keys?.auth || "").trim();
    const userAgent = String(input.userAgent || "").trim().slice(0, 500) || null;
    if (!endpoint || !p256dh || !auth) throw new AppError("A complete push subscription is required", 400);
    if (endpoint.length > 2_048 || p256dh.length > 512 || auth.length > 512) throw new AppError("Push subscription is invalid", 400);
    assertSafePushEndpoint(endpoint);

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: user.id, endpoint, p256dh, auth, userAgent, active: true },
      update: { userId: user.id, p256dh, auth, userAgent, active: true, failureCount: 0 }
    });
  }

  async unsubscribe(user: AuthUser, endpointInput: unknown): Promise<void> {
    const endpoint = String(endpointInput || "").trim();
    if (!endpoint) return;
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint } });
  }

  async getPreferences(userId: string) {
    return prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
  }

  async updatePreferences(userId: string, input: Record<string, unknown>) {
    const data: Partial<Record<PreferenceField, boolean>> = {};
    PREFERENCE_FIELDS.forEach((field) => {
      if (typeof input[field] === "boolean") data[field] = input[field] as boolean;
    });
    return prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data
    });
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    return (await prisma.pushSubscription.count({ where: { userId, active: true } })) > 0;
  }

  async sendTestPush(user: AuthUser): Promise<void> {
    if (!this.configured) throw Object.assign(new Error("Browser push is not configured on the server"), { statusCode: 503 });
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: user.id, active: true } });
    if (!subscriptions.length) throw Object.assign(new Error("Enable notifications on this device first"), { statusCode: 409 });
    const payload = JSON.stringify({
      title: "Agodly ATS notifications",
      body: "Push notifications are enabled on this device.",
      tag: "agodly-push-test",
      url: "/?section=messages"
    });
    await Promise.all(subscriptions.map((subscription) => webpush.sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth }
    }, payload, { TTL: 300 })));
  }

  async sendMessagePush(input: MessagePushInput): Promise<void> {
    if (!this.configured || !input.recipientIds.length) return;

    const users = await Promise.all(input.recipientIds.map(async (userId) => ({
      userId,
      preferences: await this.getPreferences(userId),
      subscriptions: await prisma.pushSubscription.findMany({ where: { userId, active: true } })
    })));

    const mentioned = new Set(input.mentionedUserIds);
    await Promise.allSettled(users.flatMap(({ userId, preferences, subscriptions }) => {
      const categoryEnabled = input.conversationType === "DIRECT"
        ? preferences.directMessages
        : input.conversationType === "CANDIDATE"
          ? preferences.candidateUpdates
          : input.conversationType === "JOB"
            ? preferences.jobUpdates
            : preferences.groupMessages;
      const notificationEnabled = mentioned.has(userId) ? preferences.mentions : categoryEnabled;
      if (!preferences.pushEnabled || !notificationEnabled) return [];

      const payload = JSON.stringify({
        title: input.sender.name,
        body: `New message in ${input.conversationTitle || "Agodly ATS"}. Open the ATS to read it.`,
        tag: `message-${input.conversationId}`,
        url: `/?section=messages&conversation=${encodeURIComponent(input.conversationId)}`,
        conversationId: input.conversationId
      });

      return subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth }
          }, payload, { TTL: 60 * 60, urgency: "high" });
          await prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: { failureCount: 0, lastSuccessAt: new Date(), active: true }
          });
        } catch (error) {
          const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
          await prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: {
              failureCount: { increment: 1 },
              active: statusCode === 404 || statusCode === 410 ? false : subscription.active
            }
          });
          logger.warn("Web Push delivery failed", { userId, statusCode, conversationId: input.conversationId });
        }
      });
    }));
  }
}

export const pushNotificationService = new PushNotificationService();

const assertSafePushEndpoint = (endpoint: string): void => {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new AppError("Push endpoint is invalid", 400);
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new AppError("Push endpoint must use HTTPS", 400);
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new AppError("Push endpoint host is not allowed", 400);
  }
  if (isPrivateNetworkAddress(hostname)) throw new AppError("Push endpoint host is not allowed", 400);
};

const isPrivateNetworkAddress = (hostname: string): boolean => {
  if (!isIP(hostname)) return false;
  if (hostname.includes(":")) {
    const normalized = hostname.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
  }
  const [first, second] = hostname.split(".").map(Number);
  return first === 10 || first === 127 || first === 0 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
};
