import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { useAuthSession } from '@/core/auth/session-context';
import { useMonthEvents } from '@/core/hooks/use-month-events';
import type { EventRecord } from '@/core/repositories/event-repository';
import { EntityFormSheet, type FieldDef } from '@/core/ui/components/EntityFormSheet';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { SwipeActionWrapper } from '@/core/ui/components/SwipeActionWrapper';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

const EVENT_FIELDS: FieldDef[] = [
  { name: 'title', kind: 'text', label: 'Title' },
  { name: 'date', kind: 'date', label: 'Date (YYYY-MM-DD)' },
  { name: 'end_date', kind: 'date', label: 'End date (YYYY-MM-DD, optional)' },
  {
    name: 'kind',
    kind: 'select',
    label: 'Kind',
    options: [
      { value: 'EVENT', label: 'Event' },
      { value: 'BIRTHDAY', label: 'Birthday' },
      { value: 'ANNIVERSARY', label: 'Anniversary' },
      { value: 'COUNTDOWN', label: 'Countdown' },
    ],
  },
  {
    name: 'type',
    kind: 'select',
    label: 'Type',
    options: [
      { value: 'WORK', label: 'Work' },
      { value: 'PERSONAL', label: 'Personal' },
      { value: 'HEALTH', label: 'Health' },
      { value: 'FINANCE', label: 'Finance' },
      { value: 'OTHER', label: 'Other' },
    ],
  },
  { name: 'all_day', kind: 'toggle', label: 'All day' },
];

function toDateInput(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDateInput(s: string): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function EventItem({
  event,
  colors,
  onPress,
  onComplete,
  onDelete,
}: {
  event: EventRecord;
  colors: ReturnType<typeof useLifeOSColors>;
  onPress: (event: EventRecord) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <SwipeActionWrapper
      onSwipeRightComplete={() => onComplete(event.id)}
      onSwipeLeftDelete={() =>
        Alert.alert('Delete event?', 'This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete(event.id) },
        ])
      }
    >
      <Pressable
        onPress={() => onPress(event)}
        accessibilityRole="button"
        style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
      >
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary },
            event.status === 'COMPLETED' && styles.completedTitle,
          ]}
        >
          {event.title}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {event.kind} · {event.type}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {new Date(event.date).toLocaleString()}
        </Text>
        {event.end_date ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Ends {new Date(event.end_date).toLocaleString()}
          </Text>
        ) : null}
        {event.all_day === 1 ? (
          <Text style={[styles.badge, { color: colors.primary }]}>All day</Text>
        ) : null}
      </Pressable>
    </SwipeActionWrapper>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const now = new Date();
  const { events, updateEvent, setEventCompleted, deleteEvent } = useMonthEvents(
    state.userId,
    now.getFullYear(),
    now.getMonth(),
  );
  const [editing, setEditing] = useState<EventRecord | null>(null);

  const handleComplete = useCallback((id: string) => setEventCompleted(id, true), [setEventCompleted]);
  const handleDelete = useCallback((id: string) => deleteEvent(id), [deleteEvent]);
  const handlePress = useCallback((event: EventRecord) => setEditing(event), []);

  const renderItem = useCallback(
    ({ item }: { item: EventRecord }) => (
      <EventItem event={item} colors={colors} onPress={handlePress} onComplete={handleComplete} onDelete={handleDelete} />
    ),
    [colors, handlePress, handleComplete, handleDelete],
  );

  const ListFooterComponent = useCallback(
    () => (
      <Pressable
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={() =>
          router.push(
            `/create?kind=EVENT&date=${encodeURIComponent(new Date().toISOString().slice(0, 10))}` as never,
          )
        }
        accessibilityRole="button"
        accessibilityLabel="Add event"
      >
        <Text style={styles.addButtonText}>+ Add event</Text>
      </Pressable>
    ),
    [colors.primary, router],
  );

  const ListEmptyComponent = useCallback(
    () => (
      <Text style={[styles.empty, { color: colors.textTertiary }]}>
        No events in this month.{'\n'}Tap "Add event" to create one.
      </Text>
    ),
    [colors.textTertiary],
  );

  return (
    <PageScaffold title="Events" subtitle="Upcoming schedule" eyebrow="Schedule" onBack={() => router.back()}>
      <FlashList
        data={events}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 220, paddingHorizontal: 16 }}
        ListFooterComponent={ListFooterComponent}
        ListEmptyComponent={ListEmptyComponent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      <EntityFormSheet
        visible={!!editing}
        title="Edit event"
        fields={EVENT_FIELDS}
        initialValues={
          editing
            ? {
                title: editing.title,
                date: toDateInput(editing.date),
                end_date: editing.end_date ? toDateInput(editing.end_date) : '',
                kind: editing.kind,
                type: editing.type,
                all_day: editing.all_day === 1,
              }
            : {}
        }
        destructiveLabel="Delete event"
        onDestructive={async () => {
          if (editing) await deleteEvent(editing.id);
        }}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateEvent(editing.id, {
            title: String(values.title ?? editing.title).trim(),
            date: parseDateInput(String(values.date ?? '')) ?? editing.date,
            end_date: parseDateInput(String(values.end_date ?? '')),
            kind: (values.kind as EventRecord['kind']) ?? editing.kind,
            type: (values.type as EventRecord['type']) ?? editing.type,
            all_day: values.all_day === true,
          });
        }}
        onClose={() => setEditing(null)}
      />
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  title: { ...LifeOSTypography.titleSmall },
  completedTitle: { textDecorationLine: 'line-through', opacity: 0.7 },
  meta: { ...LifeOSTypography.bodySmall },
  badge: { ...LifeOSTypography.labelSmall, fontWeight: '600' },
  empty: { ...LifeOSTypography.bodySmall, textAlign: 'center', marginTop: 32, lineHeight: 22 },
  addButton: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  addButtonText: { color: '#fff', ...LifeOSTypography.labelLarge },
});
