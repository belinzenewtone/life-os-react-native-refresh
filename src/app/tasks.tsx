import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuthSession } from '@/core/auth/session-context';
import { useTasks } from '@/core/hooks/use-tasks';
import type { TaskRecord } from '@/core/repositories/task-repository';
import { AppSnackbar } from '@/core/ui/components/AppSnackbar';
import { EntityFormSheet, type FieldDef } from '@/core/ui/components/EntityFormSheet';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { SwipeActionWrapper } from '@/core/ui/components/SwipeActionWrapper';
import { TaskRow, type TaskRowModel } from '@/core/ui/components/TaskRow';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

const TASK_FIELDS: FieldDef[] = [
  { name: 'title', kind: 'text', label: 'Title' },
  { name: 'description', kind: 'text', label: 'Description', multiline: true },
  {
    name: 'priority',
    kind: 'select',
    label: 'Priority',
    options: [
      { value: 'LOW', label: 'Low' },
      { value: 'MEDIUM', label: 'Medium' },
      { value: 'HIGH', label: 'High' },
      { value: 'CRITICAL', label: 'Critical' },
    ],
  },
  { name: 'deadline', kind: 'date', label: 'Deadline (YYYY-MM-DD)' },
];

function mapPriorityTone(priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): TaskRowModel['priorityTone'] {
  if (priority === 'CRITICAL' || priority === 'HIGH') return 'URGENT';
  if (priority === 'MEDIUM') return 'IMPORTANT';
  return 'NEUTRAL';
}

function toDateInput(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDateInput(s: string): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export default function TasksScreen() {
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const { tasks, toggleTask, setTaskCompleted, updateTask, deleteTask } = useTasks(state.userId);
  const [editing, setEditing] = useState<TaskRecord | null>(null);
  const [undoTaskId, setUndoTaskId] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const deepLinkHandled = useRef(false);

  const query = searchQuery.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    if (!query) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        (t.description ?? '').toLowerCase().includes(query)
    );
  }, [tasks, query]);

  const pendingTasks = useMemo(
    () => filteredTasks.filter((t) => t.status !== 'COMPLETED'),
    [filteredTasks]
  );
  const completedTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === 'COMPLETED'),
    [filteredTasks]
  );

  const pendingCount = pendingTasks.length;
  const completedCount = completedTasks.length;

  const urgentTasks = useMemo(
    () => pendingTasks.filter((t) => mapPriorityTone(t.priority) === 'URGENT'),
    [pendingTasks]
  );
  const importantTasks = useMemo(
    () => pendingTasks.filter((t) => mapPriorityTone(t.priority) === 'IMPORTANT'),
    [pendingTasks]
  );
  const neutralTasks = useMemo(
    () => pendingTasks.filter((t) => mapPriorityTone(t.priority) === 'NEUTRAL'),
    [pendingTasks]
  );

  const mapToRow = (task: TaskRecord): TaskRowModel => ({
    id: task.id,
    title: task.title,
    subtitle: task.deadline ? new Date(task.deadline).toLocaleString() : 'No due date',
    priorityTone: mapPriorityTone(task.priority),
    completed: task.status === 'COMPLETED',
  });

  useEffect(() => {
    if (itemId && tasks.length > 0 && !deepLinkHandled.current) {
      const task = tasks.find((t) => t.id === itemId);
      if (task) {
        setEditing(task);
        deepLinkHandled.current = true;
      }
    }
  }, [itemId, tasks]);

  const openEditor = (id: string) => {
    const t = tasks.find((x) => x.id === id) ?? null;
    setEditing(t);
  };

  const handleCompleteWithUndo = async (taskId: string, alreadyCompleted: boolean) => {
    if (alreadyCompleted) return;
    await setTaskCompleted(taskId, true);
    setUndoTaskId(taskId);
    setSnackbarVisible(true);
  };

  const handleUndoComplete = async () => {
    if (!undoTaskId) return;
    await setTaskCompleted(undoTaskId, false);
    setUndoTaskId(null);
    setSnackbarVisible(false);
  };

  const handleDelete = (task: TaskRecord) => {
    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTask(task.id) },
    ]);
  };

  const renderSection = (title: string, sectionTasks: TaskRecord[]) => {
    if (sectionTasks.length === 0) return null;
    return (
      <View key={title}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{title}</Text>
        {sectionTasks.map((task) => (
          <SwipeActionWrapper
            key={task.id}
            onSwipeRightComplete={() => handleCompleteWithUndo(task.id, task.status === 'COMPLETED')}
            onSwipeLeftDelete={() => handleDelete(task)}
          >
            <TaskRow task={mapToRow(task)} onToggleComplete={toggleTask} onPress={openEditor} />
          </SwipeActionWrapper>
        ))}
      </View>
    );
  };

  const renderCompletedSection = () => {
    if (completedTasks.length === 0) return null;
    const displayTasks = showCompleted ? completedTasks.slice(0, 20) : [];
    return (
      <View>
        <Pressable onPress={() => setShowCompleted((v) => !v)} style={styles.completedToggle}>
          <Text style={[LifeOSTypography.bodyMedium, { color: colors.textSecondary }]}>
            {showCompleted ? 'Hide completed' : 'Show completed'}
          </Text>
        </Pressable>
        {showCompleted && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Completed</Text>
            {displayTasks.map((task) => (
              <View key={task.id} style={styles.completedRow}>
                <SwipeActionWrapper
                  onSwipeRightComplete={() => handleCompleteWithUndo(task.id, task.status === 'COMPLETED')}
                  onSwipeLeftDelete={() => handleDelete(task)}
                >
                  <TaskRow task={mapToRow(task)} onToggleComplete={toggleTask} onPress={openEditor} />
                </SwipeActionWrapper>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <PageScaffold
      title="Task Manager"
      subtitle={`${pendingCount} open · ${completedCount} completed`}
      eyebrow="Execution"
      onBack={() => router.back()}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <MaterialIcons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search tasks..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {pendingCount === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="check-circle-outline" size={48} color={colors.textTertiary} />
            <Text style={[LifeOSTypography.titleSmall, { color: colors.textTertiary, marginTop: 12 }]}>
              All caught up
            </Text>
            <Text style={[LifeOSTypography.bodySmall, { color: colors.textTertiary, marginTop: 4 }]}>
              No open tasks right now. Tap + to add one.
            </Text>
          </View>
        ) : (
          <>
            {renderSection('Urgent', urgentTasks)}
            {renderSection('Important', importantTasks)}
            {renderSection('Neutral', neutralTasks)}
          </>
        )}

        {renderCompletedSection()}
      </ScrollView>

      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/create?kind=TASK' as never)}
        accessibilityRole="button"
      >
        <MaterialIcons name="add" size={24} color="#fff" />
      </Pressable>

      <EntityFormSheet
        visible={!!editing}
        title="Edit task"
        fields={TASK_FIELDS}
        initialValues={
          editing
            ? {
                title: editing.title,
                description: editing.description,
                priority: editing.priority,
                deadline: editing.deadline ? toDateInput(editing.deadline) : '',
              }
            : {}
        }
        destructiveLabel="Delete task"
        onDestructive={async () => {
          if (editing) await deleteTask(editing.id);
        }}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateTask(editing.id, {
            title: String(values.title ?? editing.title).trim(),
            description: String(values.description ?? editing.description ?? ''),
            priority: (values.priority as TaskRecord['priority']) ?? editing.priority,
            deadline: parseDateInput(String(values.deadline ?? '')) ?? editing.deadline,
          });
        }}
        onClose={() => setEditing(null)}
      />

      <AppSnackbar
        visible={snackbarVisible}
        message="Task completed"
        actionLabel="Undo"
        onAction={handleUndoComplete}
        onDismiss={() => {
          setSnackbarVisible(false);
          setUndoTaskId(null);
        }}
      />
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 220 },
  sectionTitle: { ...LifeOSTypography.titleSmall, marginTop: 4 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...LifeOSTypography.bodyMedium,
    paddingVertical: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  completedToggle: {
    marginTop: 8,
    paddingVertical: 8,
  },
  completedRow: {
    opacity: 0.5,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
