export type ProposalAction = 'CREATE_TASK' | 'LOG_EXPENSE';

export type AssistantProposal = {
  action: ProposalAction;
  title: string;
  details: string;
};

export function buildAssistantProposal(input: string): AssistantProposal {
  const lower = input.toLowerCase();
  if (lower.includes('pay') || lower.includes('spent') || lower.includes('expense')) {
    return {
      action: 'LOG_EXPENSE',
      title: 'Log Expense',
      details: 'Create an expense entry from your message.',
    };
  }
  return {
    action: 'CREATE_TASK',
    title: 'Create Task',
    details: 'Create a task reminder from your message.',
  };
}

export function parseExpenseAmount(input: string) {
  const match = input.match(/(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  const raw = match[1].trim();
  let normalized = raw;

  if (raw.includes(',') && raw.includes('.')) {
    normalized = raw.replace(/,/g, '');
  } else if (raw.includes(',') && !raw.includes('.')) {
    normalized = /^\d{1,3}(,\d{3})+$/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseExpenseMerchant(input: string) {
  const fromAt = input.match(/(?:at|to)\s+([a-z0-9 .&'-]{2,})/i);
  if (fromAt?.[1]) return fromAt[1].trim();
  const words = input.trim().split(/\s+/);
  return words.slice(0, 2).join(' ') || 'Manual Expense';
}

export type AssistantFlowDeps = {
  createTask: (input: { title: string; deadline: number }) => Promise<string>;
  createExpense: (input: {
    amount: number;
    merchant: string;
    category: string;
    source: 'Manual';
    transactionType: 'PAID';
  }) => Promise<string>;
  enqueueSyncPush: () => Promise<void>;
  runSync: () => Promise<void>;
  now: () => number;
};

export async function confirmAssistantProposal(input: {
  action: ProposalAction;
  sourceInput: string;
  deps: AssistantFlowDeps;
}) {
  if (input.action === 'CREATE_TASK') {
    const title = input.sourceInput.slice(0, 80) || 'New task from assistant';
    const id = await input.deps.createTask({
      title,
      deadline: input.deps.now() + 24 * 60 * 60 * 1000,
    });
    await input.deps.enqueueSyncPush();
    await input.deps.runSync();
    return {
      id,
      message: `Task created (${id}).`,
    };
  }

  const amount = parseExpenseAmount(input.sourceInput) ?? 0;
  const merchant = parseExpenseMerchant(input.sourceInput);
  const id = await input.deps.createExpense({
    amount,
    merchant,
    category: 'Other',
    source: 'Manual',
    transactionType: 'PAID',
  });
  await input.deps.enqueueSyncPush();
  await input.deps.runSync();
  return {
    id,
    message: `Expense logged (${id}).`,
  };
}
