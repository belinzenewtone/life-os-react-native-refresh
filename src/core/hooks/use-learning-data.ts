import { useState, useCallback } from 'react';

export type LearningCategory = 'FINANCE' | 'PRODUCTIVITY' | 'WELLNESS' | 'TECH';

export const LEARNING_CATEGORIES: { value: LearningCategory; label: string }[] = [
  { value: 'FINANCE', label: 'Finance' },
  { value: 'PRODUCTIVITY', label: 'Productivity' },
  { value: 'WELLNESS', label: 'Wellness' },
  { value: 'TECH', label: 'Tech' },
];

export type LearningSession = {
  id: string;
  title: string;
  description: string;
  category: LearningCategory;
  durationMinutes: number;
  progress: number; // 0-1
  isCompleted: boolean;
};

const SEED_SESSIONS: LearningSession[] = [
  { id: 'l1', title: 'Build a zero-based budget', description: 'Learn to allocate every shilling before the month starts.', category: 'FINANCE', durationMinutes: 12, progress: 0, isCompleted: false },
  { id: 'l2', title: 'Task batching fundamentals', description: 'Group similar tasks to reduce context-switching cost.', category: 'PRODUCTIVITY', durationMinutes: 8, progress: 0.5, isCompleted: false },
  { id: 'l3', title: 'Sleep and decision quality', description: 'How rest affects financial and professional judgment.', category: 'WELLNESS', durationMinutes: 10, progress: 0, isCompleted: false },
  { id: 'l4', title: 'Automate recurring rules', description: 'Set up rules that run without weekly manual input.', category: 'FINANCE', durationMinutes: 15, progress: 0, isCompleted: false },
  { id: 'l5', title: 'Fuliza cost awareness', description: 'Understand the true cost of short-term liquidity.', category: 'FINANCE', durationMinutes: 6, progress: 0, isCompleted: false },
];

export function useLearningData(userId: string | null) {
  const [sessions, setSessions] = useState<LearningSession[]>(SEED_SESSIONS);
  const [selectedCategory, setSelectedCategory] = useState<LearningCategory | null>(null);

  const filtered = selectedCategory
    ? sessions.filter((s) => s.category === selectedCategory)
    : sessions;

  const completedCount = sessions.filter((s) => s.isCompleted).length;

  const markCompleted = useCallback((id: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, isCompleted: true, progress: 1 } : s)));
  }, []);

  return { sessions, filtered, selectedCategory, setSelectedCategory, completedCount, markCompleted };
}
