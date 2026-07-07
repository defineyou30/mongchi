import { describe, expect, it } from "vitest";

import type { Conversation, ConversationMessage } from "@mongchi/shared";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { createPostgresChatRepository } from "../postgresChatRepository";

class QueueDatabaseClient implements ApiDatabaseMigrationClient {
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  private readonly queuedRows: unknown[][];

  constructor(queuedRows: unknown[][]) {
    this.queuedRows = [...queuedRows];
  }

  async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<ApiDatabaseQueryResult<Row>> {
    this.queries.push(params ? { sql, params } : { sql });

    return {
      rows: (this.queuedRows.shift() ?? []) as Row[]
    };
  }
}

const conversation: Conversation = {
  id: "conv_miso_001",
  userId: "user_demo_001",
  petId: "pet_miso_001",
  type: "premium_ai_chat",
  status: "open",
  disclosureAcceptedAt: "2026-06-24T09:00:00.000Z",
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const conversationRow = (currentConversation: Conversation) => ({
  id: currentConversation.id,
  user_id: currentConversation.userId,
  pet_id: currentConversation.petId,
  type: currentConversation.type,
  status: currentConversation.status,
  disclosure_accepted_at: currentConversation.disclosureAcceptedAt ?? null,
  deleted_at: currentConversation.deletedAt ?? null,
  created_at: currentConversation.createdAt,
  updated_at: currentConversation.updatedAt
});

const userMessage: ConversationMessage = {
  id: "msg_miso_user_001",
  conversationId: conversation.id,
  sender: "user",
  text: "오늘은 정원이 어때?",
  safetyFlags: ["ko", "mock_checked"],
  createdAt: "2026-06-24T09:01:00.000Z"
};

const petMessage: ConversationMessage = {
  id: "msg_miso_pet_001",
  conversationId: conversation.id,
  sender: "pet_ai",
  text: "잎사귀들이 기분 좋게 흔들렸어.",
  safetyFlags: [],
  createdAt: "2026-06-24T09:01:01.000Z"
};

const messageRow = (message: ConversationMessage) => ({
  id: message.id,
  conversation_id: message.conversationId,
  sender: message.sender,
  text: message.text,
  safety_flags: JSON.stringify(message.safetyFlags),
  created_at: message.createdAt
});

describe("Postgres chat repository", () => {
  it("upserts, reads, and lists owned conversations", async () => {
    const client = new QueueDatabaseClient([
      [conversationRow(conversation)],
      [conversationRow(conversation)],
      [conversationRow(conversation)]
    ]);
    const repository = createPostgresChatRepository(client);

    await expect(repository.upsertConversation(conversation)).resolves.toEqual(conversation);
    await expect(repository.findOwnedConversation(conversation.userId, conversation.id)).resolves.toEqual(conversation);
    await expect(repository.listOpenConversationsForPet(conversation.userId, conversation.petId, "premium_ai_chat")).resolves.toEqual([
      conversation
    ]);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.conversations");
    expect(client.queries[0]?.sql).not.toContain(conversation.id);
    expect(client.queries[0]?.params).toEqual([
      conversation.id,
      conversation.userId,
      conversation.petId,
      conversation.type,
      conversation.status,
      conversation.disclosureAcceptedAt,
      null,
      conversation.createdAt,
      conversation.updatedAt
    ]);
    expect(client.queries[1]?.sql).toContain("status <> 'deleted'");
    expect(client.queries[2]?.params).toEqual([conversation.userId, conversation.petId, conversation.type]);
  });

  it("upserts and reads messages through a conversation ownership join", async () => {
    const client = new QueueDatabaseClient([[messageRow(userMessage)], [messageRow(userMessage), messageRow(petMessage)]]);
    const repository = createPostgresChatRepository(client);

    await expect(repository.upsertMessage(userMessage)).resolves.toEqual(userMessage);
    await expect(repository.listMessagesForOwnedConversation(conversation.userId, conversation.id)).resolves.toEqual([
      userMessage,
      petMessage
    ]);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.conversation_messages");
    expect(client.queries[0]?.params).toEqual([
      userMessage.id,
      userMessage.conversationId,
      userMessage.sender,
      userMessage.text,
      JSON.stringify(userMessage.safetyFlags),
      userMessage.createdAt
    ]);
    expect(client.queries[1]?.sql).toContain("JOIN public.conversations c ON c.id = cm.conversation_id");
    expect(client.queries[1]?.sql).toContain("c.user_id = $1");
  });

  it("upserts multiple messages and touches an owned conversation", async () => {
    const touchedConversation: Conversation = {
      ...conversation,
      updatedAt: petMessage.createdAt
    };
    const client = new QueueDatabaseClient([
      [messageRow(userMessage)],
      [messageRow(petMessage)],
      [conversationRow(touchedConversation)]
    ]);
    const repository = createPostgresChatRepository(client);

    await expect(repository.upsertMessages([userMessage, petMessage])).resolves.toEqual([userMessage, petMessage]);
    await expect(repository.touchOwnedConversation(conversation.userId, conversation.id, petMessage.createdAt)).resolves.toEqual(
      touchedConversation
    );

    expect(client.queries[0]?.params?.[0]).toBe(userMessage.id);
    expect(client.queries[1]?.params?.[0]).toBe(petMessage.id);
    expect(client.queries[2]?.sql).toContain("UPDATE public.conversations");
    expect(client.queries[2]?.params).toEqual([conversation.userId, conversation.id, petMessage.createdAt]);
  });

  it("soft-deletes one owned conversation and removes its messages", async () => {
    const deletedAt = "2026-06-24T09:10:00.000Z";
    const deletedConversation: Conversation = {
      ...conversation,
      status: "deleted",
      deletedAt,
      updatedAt: deletedAt
    };
    const client = new QueueDatabaseClient([
      [conversationRow(deletedConversation)],
      [{ id: userMessage.id }, { id: petMessage.id }]
    ]);
    const repository = createPostgresChatRepository(client);

    await expect(repository.deleteOwnedConversation(conversation.userId, conversation.id, deletedAt)).resolves.toEqual({
      conversation: deletedConversation,
      deletedMessageIds: [userMessage.id, petMessage.id]
    });

    expect(client.queries[0]?.sql).toContain("status = 'deleted'");
    expect(client.queries[0]?.params).toEqual([conversation.userId, conversation.id, deletedAt]);
    expect(client.queries[1]?.sql).toContain("DELETE FROM public.conversation_messages");
    expect(client.queries[1]?.params).toEqual([conversation.id]);
  });

  it("soft-deletes all user chat history and removes messages in one bounded deletion", async () => {
    const deletedAt = "2026-06-24T09:12:00.000Z";
    const client = new QueueDatabaseClient([
      [{ id: conversation.id }, { id: "conv_miso_002" }],
      [{ id: userMessage.id }, { id: petMessage.id }]
    ]);
    const repository = createPostgresChatRepository(client);

    await expect(repository.deleteChatHistoryForUser(conversation.userId, deletedAt)).resolves.toEqual({
      deletedConversationIds: [conversation.id, "conv_miso_002"],
      deletedMessageIds: [userMessage.id, petMessage.id],
      deletedAt
    });

    expect(client.queries[0]?.sql).toContain("WHERE user_id = $1 AND status <> 'deleted'");
    expect(client.queries[0]?.params).toEqual([conversation.userId, deletedAt]);
    expect(client.queries[1]?.sql).toContain("conversation_id = ANY($1::text[])");
    expect(client.queries[1]?.params).toEqual([[conversation.id, "conv_miso_002"]]);
  });

  it("purges expired messages in bounded created-at order", async () => {
    const deletedBefore = "2026-06-24T09:30:00.000Z";
    const client = new QueueDatabaseClient([[{ id: userMessage.id }, { id: petMessage.id }]]);
    const repository = createPostgresChatRepository(client);

    await expect(repository.purgeExpiredMessages(deletedBefore, 250)).resolves.toEqual({
      deletedMessageIds: [userMessage.id, petMessage.id],
      deletedBefore
    });

    expect(client.queries[0]?.sql).toContain("WHERE created_at < $1");
    expect(client.queries[0]?.sql).toContain("ORDER BY created_at ASC, id ASC");
    expect(client.queries[0]?.sql).toContain("LIMIT $2");
    expect(client.queries[0]?.params).toEqual([deletedBefore, 250]);
  });
});
