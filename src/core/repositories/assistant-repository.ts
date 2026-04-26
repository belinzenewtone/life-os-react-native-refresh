import { supabaseClient } from '@/core/supabase/client';

export class AssistantRepository {
  static async prompt(input: { prompt: string; context?: string }) {
    const functionUrl = process.env.EXPO_PUBLIC_ASSISTANT_PROXY_URL;

    if (functionUrl) {
      try {
        const accessToken = (await supabaseClient.auth.getSession()).data.session?.access_token;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ prompt: input.prompt, context: input.context ?? '' }),
        });

        if (!response.ok) {
          throw new Error(`assistant-proxy failed: ${response.status}`);
        }

        const json = (await response.json()) as { reply?: string };
        if (json.reply) {
          return { reply: json.reply };
        }
      } catch {
        // Fall through to deterministic local fallback.
      }
    }

    const lower = input.prompt.toLowerCase();
    if (lower.includes('spent') || lower.includes('expense') || lower.includes('pay')) {
      return { reply: 'I can help log this expense. I will prepare a confirmation card before any save.' };
    }
    if (lower.includes('task') || lower.includes('todo') || lower.includes('remind')) {
      return { reply: 'I can create this task and schedule reminders after you confirm.' };
    }
    return { reply: 'I understood your request. I will propose a safe action card for confirmation.' };
  }
}