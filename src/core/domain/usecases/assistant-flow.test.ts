import { describe, expect, it, vi } from 'vitest';

import {
  buildAssistantProposal,
  confirmAssistantProposal,
  parseExpenseAmount,
  parseExpenseMerchant,
} from './assistant-flow';

describe('assistant flow usecases', () => {
  it('builds expense proposal for spending language', () => {
    const proposal = buildAssistantProposal('I spent 450 at Java House');
    expect(proposal.action).toBe('LOG_EXPENSE');
  });

  it('builds task proposal by default', () => {
    const proposal = buildAssistantProposal('Remind me to finalize board deck');
    expect(proposal.action).toBe('CREATE_TASK');
  });

  it('parses expense amount and merchant robustly', () => {
    expect(parseExpenseAmount('paid 1,250.50 to KPLC')).toBe(1250.5);
    expect(parseExpenseMerchant('paid 500 at Artisan Coffee')).toBe('Artisan Coffee');
    expect(parseExpenseMerchant('groceries')).toBe('groceries');
  });

  it('confirms CREATE_TASK action and runs sync push path', async () => {
    const createTask = vi.fn().mockResolvedValue('task_1');
    const createExpense = vi.fn().mockResolvedValue('tx_1');
    const enqueueSyncPush = vi.fn().mockResolvedValue(undefined);
    const runSync = vi.fn().mockResolvedValue(undefined);

    const result = await confirmAssistantProposal({
      action: 'CREATE_TASK',
      sourceInput: 'Finalize Q3 Board Deck',
      deps: {
        createTask,
        createExpense,
        enqueueSyncPush,
        runSync,
        now: () => 1_000_000,
      },
    });

    expect(createTask).toHaveBeenCalledWith({
      title: 'Finalize Q3 Board Deck',
      deadline: 1_000_000 + 24 * 60 * 60 * 1000,
    });
    expect(createExpense).not.toHaveBeenCalled();
    expect(enqueueSyncPush).toHaveBeenCalledTimes(1);
    expect(runSync).toHaveBeenCalledTimes(1);
    expect(result.message).toBe('Task created (task_1).');
  });

  it('confirms LOG_EXPENSE action and runs sync push path', async () => {
    const createTask = vi.fn().mockResolvedValue('task_1');
    const createExpense = vi.fn().mockResolvedValue('tx_9');
    const enqueueSyncPush = vi.fn().mockResolvedValue(undefined);
    const runSync = vi.fn().mockResolvedValue(undefined);

    const result = await confirmAssistantProposal({
      action: 'LOG_EXPENSE',
      sourceInput: 'I paid 450 at Java House',
      deps: {
        createTask,
        createExpense,
        enqueueSyncPush,
        runSync,
        now: () => 0,
      },
    });

    expect(createTask).not.toHaveBeenCalled();
    expect(createExpense).toHaveBeenCalledWith({
      amount: 450,
      merchant: 'Java House',
      category: 'Other',
      source: 'Manual',
      transactionType: 'PAID',
    });
    expect(enqueueSyncPush).toHaveBeenCalledTimes(1);
    expect(runSync).toHaveBeenCalledTimes(1);
    expect(result.message).toBe('Expense logged (tx_9).');
  });
});
