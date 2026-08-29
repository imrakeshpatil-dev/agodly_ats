import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("messaging migration is additive and stores durable receipts and push subscriptions", async () => {
  const migration = await read("prisma/migrations/20260829090000_internal_messaging/migration.sql");
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b|\bDELETE\s+FROM\b/i);
  assert.match(migration, /CREATE TABLE "Conversation"/);
  assert.match(migration, /CREATE TABLE "ConversationMember"/);
  assert.match(migration, /"lastDeliveredAt" DATETIME/);
  assert.match(migration, /"lastReadAt" DATETIME/);
  assert.match(migration, /CREATE TABLE "Message"/);
  assert.match(migration, /CREATE TABLE "PushSubscription"/);
  assert.match(migration, /CREATE TABLE "NotificationPreference"/);
});

test("every messaging and push endpoint requires an authenticated session", async () => {
  const routeFiles = [
    "app/api/messages/users/route.ts",
    "app/api/messages/conversations/route.ts",
    "app/api/messages/conversations/[id]/route.ts",
    "app/api/messages/conversations/[id]/messages/route.ts",
    "app/api/messages/conversations/[id]/receipts/route.ts",
    "app/api/push/config/route.ts",
    "app/api/push/subscription/route.ts",
    "app/api/push/preferences/route.ts",
    "app/api/push/test/route.ts"
  ];
  for (const routeFile of routeFiles) assert.match(await read(routeFile), /auth: true/, routeFile);
  assert.match(await read("app/api/messages/events/route.ts"), /authenticateRequest/);
});

test("message receipts expose sent, delivered, and seen states without leaking message content in push", async () => {
  const service = await read("lib/server/services/messaging.service.ts");
  const push = await read("lib/server/services/push-notification.service.ts");
  assert.match(service, /status = !senderOwnsMessage/);
  assert.match(service, /\? "seen"/);
  assert.match(service, /\? "delivered"/);
  assert.match(service, /lastDeliveredMessageId/);
  assert.match(service, /lastReadMessageId/);
  assert.match(push, /Open the ATS to read it/);
  assert.doesNotMatch(push, /body:\s*input\.body/);
});

test("browser inbox provides direct and group chat, receipts, push controls, and responsive layout", async () => {
  const html = await read("index.html");
  const browser = await read("app.js");
  const styles = await read("styles.css");
  const worker = await read("public/sw.js");
  assert.match(html, /data-section="messages"/);
  assert.match(browser, /Direct, group, candidate and job conversations/);
  assert.match(browser, /message-receipt is-/);
  assert.match(browser, /Enable push notifications/);
  assert.match(browser, /consumeMessagingEventStream/);
  assert.match(browser, /mentionedUserIds/);
  assert.match(styles, /\.messages-layout/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(worker, /self\.addEventListener\("push"/);
  assert.match(worker, /notificationclick/);
});
