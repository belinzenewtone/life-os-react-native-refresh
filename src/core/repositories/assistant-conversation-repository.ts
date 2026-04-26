import { getDatabase } from '@/core/data/database/client';

export type AssistantConversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AssistantMessage = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  action_type: string | null;
  action_payload: string | null;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export class AssistantConversationRepository {
  static async listConversations(userId: string): Promise<AssistantConversation[]> {
    const db = await getDatabase();
    return db.getAllAsync<AssistantConversation>(
      'SELECT id, title, created_at, updated_at, deleted_at FROM assistant_conversations WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
      userId,
    );
  }

  static async createConversation(userId: string, title: string): Promise<string> {
    const db = await getDatabase();
    const id = genId('conv');
    const now = nowIso();
    await db.runAsync(
      'INSERT INTO assistant_conversations (user_id, id, title, created_at, updated_at, deleted_at) VALUES (?,?,?,?,?,?)',
      userId,
      id,
      title,
      now,
      now,
      null,
    );
    return id;
  }

  static async addMessage(
    userId: string,
    conversationId: string,
    role: string,
    content: string,
    actionType?: string | null,
    actionPayload?: string | null,
  ): Promise<string> {
    const db = await getDatabase();
    const id = genId('msg');
    const now = nowIso();
    await db.runAsync(
      'INSERT INTO assistant_messages (user_id, id, conversation_id, role, content, action_type, action_payload, created_at) VALUES (?,?,?,?,?,?,?,?)',
      userId,
      id,
      conversationId,
      role,
      content,
      actionType ?? null,
      actionPayload ?? null,
      now,
    );
    return id;
  }

  static async listMessages(userId: string, conversationId: string): Promise<AssistantMessage[]> {
    const db = await getDatabase();
    return db.getAllAsync<AssistantMessage>(
      'SELECT id, conversation_id, role, content, action_type, action_payload, created_at FROM assistant_messages WHERE user_id = ? AND conversation_id = ? ORDER BY created_at ASC',
      userId,
      conversationId,
    );
  }

  static async deleteConversation(userId: string, id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE assistant_conversations SET deleted_at = ? WHERE user_id = ? AND id = ?',
      nowIso(),
      userId,
      id,
    );
  }
}
