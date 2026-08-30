-- Internal conversations and browser push are no longer part of the ATS.
-- This intentionally removes their stored data and device subscriptions.
DROP TABLE IF EXISTS "Message";
DROP TABLE IF EXISTS "ConversationMember";
DROP TABLE IF EXISTS "Conversation";
DROP TABLE IF EXISTS "PushSubscription";
DROP TABLE IF EXISTS "NotificationPreference";
