import type {
  Conversation,
  ConversationId,
  ConversationMessage,
  ConversationSender,
  ConversationStatus,
  ConversationType,
  ISODateTime,
  PetId,
  UserId
} from "@mongchi/shared";

import type { ApiDatabaseMigrationClient } from "./dbMigrations";

interface ConversationRow {
  id: string;
  user_id: string;
  pet_id: string;
  type: ConversationType;
  status: ConversationStatus;
  disclosure_accepted_at: Date | string | null;
  deleted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  sender: ConversationSender;
  text: string;
  safety_flags: unknown;
  created_at: Date | string;
}

interface DeletedIdRow {
  id: string;
}

export interface DeleteConversationResult {
  conversation: Conversation;
  deletedMessageIds: string[];
}

export interface DeleteChatHistoryResult {
  deletedConversationIds: ConversationId[];
  deletedMessageIds: string[];
  deletedAt: ISODateTime;
}

export interface PurgeExpiredConversationMessagesResult {
  deletedMessageIds: string[];
  deletedBefore: ISODateTime;
}

const toIso = (value: Date | string): ISODateTime => (value instanceof Date ? value.toISOString() : value);
const nullableIso = (value: Date | string | null): ISODateTime | undefined => (value ? toIso(value) : undefined);

const parseJsonArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      return parsed as T[];
    }
  }

  return [];
};

const mapConversationRow = (row: ConversationRow): Conversation => {
  const disclosureAcceptedAt = nullableIso(row.disclosure_accepted_at);
  const deletedAt = nullableIso(row.deleted_at);

  return {
    id: row.id,
    userId: row.user_id,
    petId: row.pet_id,
    type: row.type,
    status: row.status,
    ...(disclosureAcceptedAt ? { disclosureAcceptedAt } : {}),
    ...(deletedAt ? { deletedAt } : {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
};

const mapConversationMessageRow = (row: ConversationMessageRow): ConversationMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  sender: row.sender,
  text: row.text,
  safetyFlags: parseJsonArray<string>(row.safety_flags),
  createdAt: toIso(row.created_at)
});

const conversationSelectColumns = `
  id,
  user_id,
  pet_id,
  type,
  status,
  disclosure_accepted_at,
  deleted_at,
  created_at,
  updated_at
`;

const messageSelectColumns = `
  id,
  conversation_id,
  sender,
  text,
  safety_flags,
  created_at
`;

export const createPostgresChatRepository = (client: ApiDatabaseMigrationClient) => ({
  upsertConversation: async (conversation: Conversation): Promise<Conversation> => {
    const result = await client.query<ConversationRow>(
      `
INSERT INTO public.conversations (
  id,
  user_id,
  pet_id,
  type,
  status,
  disclosure_accepted_at,
  deleted_at,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    pet_id = EXCLUDED.pet_id,
    type = EXCLUDED.type,
    status = EXCLUDED.status,
    disclosure_accepted_at = EXCLUDED.disclosure_accepted_at,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = EXCLUDED.updated_at
RETURNING ${conversationSelectColumns}
`,
      [
        conversation.id,
        conversation.userId,
        conversation.petId,
        conversation.type,
        conversation.status,
        conversation.disclosureAcceptedAt ?? null,
        conversation.deletedAt ?? null,
        conversation.createdAt,
        conversation.updatedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert conversation.");
    }

    return mapConversationRow(row);
  },

  findOwnedConversation: async (userId: UserId, conversationId: ConversationId): Promise<Conversation | null> => {
    const result = await client.query<ConversationRow>(
      `
SELECT ${conversationSelectColumns}
FROM public.conversations
WHERE user_id = $1 AND id = $2 AND status <> 'deleted'
`,
      [userId, conversationId]
    );

    return result.rows[0] ? mapConversationRow(result.rows[0]) : null;
  },

  listOpenConversationsForPet: async (
    userId: UserId,
    petId: PetId,
    type?: ConversationType
  ): Promise<Conversation[]> => {
    const result = await client.query<ConversationRow>(
      `
SELECT ${conversationSelectColumns}
FROM public.conversations
WHERE user_id = $1
  AND pet_id = $2
  AND status = 'open'
  AND ($3::text IS NULL OR type = $3)
ORDER BY updated_at DESC, id DESC
`,
      [userId, petId, type ?? null]
    );

    return result.rows.map(mapConversationRow);
  },

  upsertMessage: async (message: ConversationMessage): Promise<ConversationMessage> => {
    const result = await client.query<ConversationMessageRow>(
      `
INSERT INTO public.conversation_messages (
  id,
  conversation_id,
  sender,
  text,
  safety_flags,
  created_at
)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
ON CONFLICT (id) DO UPDATE
SET sender = EXCLUDED.sender,
    text = EXCLUDED.text,
    safety_flags = EXCLUDED.safety_flags
RETURNING ${messageSelectColumns}
`,
      [
        message.id,
        message.conversationId,
        message.sender,
        message.text,
        JSON.stringify(message.safetyFlags),
        message.createdAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert conversation message.");
    }

    return mapConversationMessageRow(row);
  },

  upsertMessages: async (messages: readonly ConversationMessage[]): Promise<ConversationMessage[]> => {
    const storedMessages: ConversationMessage[] = [];

    for (const message of messages) {
      const result = await client.query<ConversationMessageRow>(
        `
INSERT INTO public.conversation_messages (
  id,
  conversation_id,
  sender,
  text,
  safety_flags,
  created_at
)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
ON CONFLICT (id) DO UPDATE
SET sender = EXCLUDED.sender,
    text = EXCLUDED.text,
    safety_flags = EXCLUDED.safety_flags
RETURNING ${messageSelectColumns}
`,
        [
          message.id,
          message.conversationId,
          message.sender,
          message.text,
          JSON.stringify(message.safetyFlags),
          message.createdAt
        ]
      );
      const row = result.rows[0];

      if (!row) {
        throw new Error("Failed to upsert conversation message.");
      }

      storedMessages.push(mapConversationMessageRow(row));
    }

    return storedMessages;
  },

  listMessagesForOwnedConversation: async (
    userId: UserId,
    conversationId: ConversationId
  ): Promise<ConversationMessage[]> => {
    const result = await client.query<ConversationMessageRow>(
      `
SELECT cm.${messageSelectColumns
        .trim()
        .split(",")
        .map((column) => column.trim())
        .join(", cm.")}
FROM public.conversation_messages cm
JOIN public.conversations c ON c.id = cm.conversation_id
WHERE c.user_id = $1
  AND c.id = $2
  AND c.status <> 'deleted'
ORDER BY cm.created_at ASC, cm.id ASC
`,
      [userId, conversationId]
    );

    return result.rows.map(mapConversationMessageRow);
  },

  touchOwnedConversation: async (
    userId: UserId,
    conversationId: ConversationId,
    updatedAt: ISODateTime
  ): Promise<Conversation | null> => {
    const result = await client.query<ConversationRow>(
      `
UPDATE public.conversations
SET updated_at = $3
WHERE user_id = $1 AND id = $2 AND status <> 'deleted'
RETURNING ${conversationSelectColumns}
`,
      [userId, conversationId, updatedAt]
    );

    return result.rows[0] ? mapConversationRow(result.rows[0]) : null;
  },

  deleteOwnedConversation: async (
    userId: UserId,
    conversationId: ConversationId,
    deletedAt: ISODateTime
  ): Promise<DeleteConversationResult | null> => {
    const conversationResult = await client.query<ConversationRow>(
      `
UPDATE public.conversations
SET status = 'deleted',
    deleted_at = $3,
    updated_at = $3
WHERE user_id = $1 AND id = $2 AND status <> 'deleted'
RETURNING ${conversationSelectColumns}
`,
      [userId, conversationId, deletedAt]
    );
    const conversationRow = conversationResult.rows[0];

    if (!conversationRow) {
      return null;
    }

    const deletedMessages = await client.query<DeletedIdRow>(
      `
DELETE FROM public.conversation_messages
WHERE conversation_id = $1
RETURNING id
`,
      [conversationId]
    );

    return {
      conversation: mapConversationRow(conversationRow),
      deletedMessageIds: deletedMessages.rows.map((row) => row.id)
    };
  },

  deleteChatHistoryForUser: async (
    userId: UserId,
    deletedAt: ISODateTime
  ): Promise<DeleteChatHistoryResult> => {
    const conversationResult = await client.query<DeletedIdRow>(
      `
UPDATE public.conversations
SET status = 'deleted',
    deleted_at = $2,
    updated_at = $2
WHERE user_id = $1 AND status <> 'deleted'
RETURNING id
`,
      [userId, deletedAt]
    );
    const deletedConversationIds = conversationResult.rows.map((row) => row.id as ConversationId);

    if (deletedConversationIds.length === 0) {
      return {
        deletedConversationIds: [],
        deletedMessageIds: [],
        deletedAt
      };
    }

    const deletedMessages = await client.query<DeletedIdRow>(
      `
DELETE FROM public.conversation_messages
WHERE conversation_id = ANY($1::text[])
RETURNING id
`,
      [deletedConversationIds]
    );

    return {
      deletedConversationIds,
      deletedMessageIds: deletedMessages.rows.map((row) => row.id),
      deletedAt
    };
  },

  purgeExpiredMessages: async (
    deletedBefore: ISODateTime,
    batchSize: number
  ): Promise<PurgeExpiredConversationMessagesResult> => {
    const safeBatchSize = Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 1;
    const deletedMessages = await client.query<DeletedIdRow>(
      `
WITH expired_messages AS (
  SELECT id
  FROM public.conversation_messages
  WHERE created_at < $1
  ORDER BY created_at ASC, id ASC
  LIMIT $2
)
DELETE FROM public.conversation_messages
WHERE id IN (SELECT id FROM expired_messages)
RETURNING id
`,
      [deletedBefore, safeBatchSize]
    );

    return {
      deletedMessageIds: deletedMessages.rows.map((row) => row.id),
      deletedBefore
    };
  }
});
