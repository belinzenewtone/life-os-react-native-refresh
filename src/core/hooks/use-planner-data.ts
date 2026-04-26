import { useCallback, useEffect, useState } from 'react';

import {
  BudgetRepository,
  IncomeRepository,
  RecurringRepository,
  type BudgetRecord,
  type IncomeRecord,
  type RecurringRuleRecord,
} from '@/core/repositories/planner-repositories';

export function usePlannerData(userId: string | null) {
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRuleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [nextBudgets, nextIncomes, nextRecurring] = await Promise.all([
        BudgetRepository.list(userId),
        IncomeRepository.list(userId),
        RecurringRepository.list(userId),
      ]);
      setBudgets(nextBudgets);
      setIncomes(nextIncomes);
      setRecurringRules(nextRecurring);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    if (!userId) return;
    setIsLoading(true);
    Promise.all([
      BudgetRepository.list(userId),
      IncomeRepository.list(userId),
      RecurringRepository.list(userId),
    ])
      .then(([nextBudgets, nextIncomes, nextRecurring]) => {
        if (!mounted) return;
        setBudgets(nextBudgets);
        setIncomes(nextIncomes);
        setRecurringRules(nextRecurring);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  // Budgets
  const createBudget = useCallback(
    async (input: { category: string; limit_amount: number; month_key?: string }) => {
      if (!userId) return;
      await BudgetRepository.create(userId, input);
      await reload();
    },
    [userId, reload],
  );
  const updateBudget = useCallback(
    async (id: string, patch: Parameters<typeof BudgetRepository.update>[2]) => {
      if (!userId) return;
      await BudgetRepository.update(userId, id, patch);
      await reload();
    },
    [userId, reload],
  );
  const deleteBudget = useCallback(
    async (id: string) => {
      if (!userId) return;
      await BudgetRepository.remove(userId, id);
      await reload();
    },
    [userId, reload],
  );

  // Incomes
  const createIncome = useCallback(
    async (input: { source: string; amount: number; date?: number; note?: string }) => {
      if (!userId) return;
      await IncomeRepository.create(userId, input);
      await reload();
    },
    [userId, reload],
  );
  const updateIncome = useCallback(
    async (id: string, patch: Parameters<typeof IncomeRepository.update>[2]) => {
      if (!userId) return;
      await IncomeRepository.update(userId, id, patch);
      await reload();
    },
    [userId, reload],
  );
  const deleteIncome = useCallback(
    async (id: string) => {
      if (!userId) return;
      await IncomeRepository.remove(userId, id);
      await reload();
    },
    [userId, reload],
  );

  // Recurring rules
  const createRecurring = useCallback(
    async (input: Parameters<typeof RecurringRepository.create>[1]) => {
      if (!userId) return;
      await RecurringRepository.create(userId, input);
      await reload();
    },
    [userId, reload],
  );
  const updateRecurring = useCallback(
    async (id: string, patch: Parameters<typeof RecurringRepository.update>[2]) => {
      if (!userId) return;
      await RecurringRepository.update(userId, id, patch);
      await reload();
    },
    [userId, reload],
  );
  const toggleRecurring = useCallback(
    async (id: string) => {
      if (!userId) return;
      await RecurringRepository.toggleActive(userId, id);
      await reload();
    },
    [userId, reload],
  );
  const deleteRecurring = useCallback(
    async (id: string) => {
      if (!userId) return;
      await RecurringRepository.remove(userId, id);
      await reload();
    },
    [userId, reload],
  );

  return {
    budgets,
    incomes,
    recurringRules,
    isLoading,
    reload,
    createBudget,
    updateBudget,
    deleteBudget,
    createIncome,
    updateIncome,
    deleteIncome,
    createRecurring,
    updateRecurring,
    toggleRecurring,
    deleteRecurring,
  };
}
