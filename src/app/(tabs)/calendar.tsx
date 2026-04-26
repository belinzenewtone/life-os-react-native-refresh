import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useAuthSession } from '@/core/auth/session-context';
import { useMonthEvents } from '@/core/hooks/use-month-events';
import type { EventRecord } from '@/core/repositories/event-repository';
import { AppCard } from '@/core/ui/components/AppCard';
import { EntityFormSheet, type FieldDef } from '@/core/ui/components/EntityFormSheet';
import { FadeInView } from '@/core/ui/components/FadeInView';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { ShimmerSkeleton } from '@/core/ui/components/ShimmerSkeleton';
import { SwipeActionWrapper } from '@/core/ui/components/SwipeActionWrapper';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

const EVENT_FIELDS: FieldDef[] = [
  { name: 'title', kind: 'text', label: 'Title' },
  { name: 'date', kind: 'date', label: 'Date (YYYY-MM-DD)' },
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

const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function keyForDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function buildCalendarCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const cells: { date: number; day: number; inMonth: boolean }[] = [];

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(start);
    cellDate.setDate(start.getDate() + index);
    cells.push({
      date: cellDate.getTime(),
      day: cellDate.getDate(),
      inMonth: cellDate.getMonth() === month,
    });
  }

  return cells;
}

export default function CalendarScreen() {
  const router = useRouter();
  const { eventId, eventDate } = useLocalSearchParams<{ eventId?: string; eventDate?: string }>();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();

  const parsedEventDate = eventDate ? new Date(eventDate).getTime() : Number.NaN;
  const initialDate = Number.isFinite(parsedEventDate) ? parsedEventDate : Date.now();
  const initialView = new Date(initialDate);

  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth());
  const [selectedDate, setSelectedDate] = useState(startOfDay(initialDate));
  const [editing, setEditing] = useState<EventRecord | null>(null);

  const { events, updateEvent, setEventCompleted, deleteEvent, isLoading, reload } = useMonthEvents(
    state.userId,
    viewYear,
    viewMonth,
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const monthDate = new Date(viewYear, viewMonth, 1);
  const monthName = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const cells = useMemo(() => buildCalendarCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const isCurrentMonth = viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of events) {
      const key = keyForDate(event.date);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [events]);

  const selectedEvents = useMemo(
    () => events.filter((event) => keyForDate(event.date) === keyForDate(selectedDate)),
    [events, selectedDate],
  );

  const selectedEventsByKind = useMemo(
    () => ({
      EVENT: selectedEvents.filter((e) => e.kind === 'EVENT'),
      BIRTHDAY: selectedEvents.filter((e) => e.kind === 'BIRTHDAY'),
      ANNIVERSARY: selectedEvents.filter((e) => e.kind === 'ANNIVERSARY'),
      COUNTDOWN: selectedEvents.filter((e) => e.kind === 'COUNTDOWN'),
    }),
    [selectedEvents],
  );

  const todayStart = startOfDay(Date.now());

  const deepLinkHandled = useRef(false);

  useEffect(() => {
    if (deepLinkHandled.current) return;
    if (!eventId || isLoading || events.length === 0) return;

    const target = events.find((e) => e.id === eventId);
    if (target) {
      deepLinkHandled.current = true;
      const d = new Date(target.date);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelectedDate(startOfDay(target.date));
      setEditing(target);
    }
  }, [eventId, isLoading, events, setViewYear, setViewMonth, setSelectedDate, setEditing]);

  const gridOpacity = useRef(new Animated.Value(1)).current;

  const animateGridTransition = useCallback(() => {
    gridOpacity.setValue(0.5);
    Animated.timing(gridOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [gridOpacity]);

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    const activeMonthStart = new Date(next.getFullYear(), next.getMonth(), 1).getTime();
    setSelectedDate(startOfDay(activeMonthStart));
    animateGridTransition();
  }

  const swipeStartX = useRef(0);
  const swipeStartTime = useRef(0);

  const onTouchStart = (e: { nativeEvent: { pageX: number } }) => {
    swipeStartX.current = e.nativeEvent.pageX;
    swipeStartTime.current = Date.now();
  };

  const onTouchEnd = (e: { nativeEvent: { pageX: number } }) => {
    const dx = e.nativeEvent.pageX - swipeStartX.current;
    const dt = Date.now() - swipeStartTime.current;
    const velocity = Math.abs(dx) / Math.max(dt, 1);
    const threshold = 40;
    const velocityThreshold = 0.4;
    const minFastSwipeDx = 20;

    const isNextMonth = dx < 0;
    const isPrevMonth = dx > 0;
    const hasDisplacement = Math.abs(dx) > threshold;
    const hasVelocity = velocity > velocityThreshold && Math.abs(dx) > minFastSwipeDx;

    if ((hasDisplacement && isNextMonth) || (hasVelocity && isNextMonth)) {
      shiftMonth(1);
    } else if ((hasDisplacement && isPrevMonth) || (hasVelocity && isPrevMonth)) {
      shiftMonth(-1);
    }
  };

  function goToToday() {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDate(startOfDay(now.getTime()));
  }

  const renderEventCard = (event: EventRecord) => (
    <SwipeActionWrapper
      key={event.id}
      onSwipeRightComplete={() => setEventCompleted(event.id, true)}
      onSwipeLeftDelete={() => {
        Alert.alert('Delete event?', 'This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteEvent(event.id) },
        ]);
      }}
    >
      <Pressable onPress={() => setEditing(event)} accessibilityRole="button">
        <AppCard
          mode="elevated"
          style={[
            event.kind === 'BIRTHDAY' || event.kind === 'ANNIVERSARY'
              ? [styles.eventSecondary, { borderLeftColor: colors.warning }]
              : [styles.eventPrimary, { borderLeftColor: colors.primary }],
            eventId === event.id && [styles.eventHighlighted, { borderColor: `${colors.primary}40` }],
          ]}
        >
          <Text style={[styles.eventType, { color: colors.textTertiary }]}>{event.type}</Text>
          <Text
            style={[
              styles.eventTitle,
              { color: colors.textPrimary },
              event.status === 'COMPLETED' && styles.eventTitleCompleted,
            ]}
          >
            {event.title}
          </Text>
          <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>
            {new Date(event.date).toLocaleString()}
          </Text>
        </AppCard>
      </Pressable>
    </SwipeActionWrapper>
  );

  return (
    <PageScaffold title="Calendar" subtitle={monthName} eyebrow="Schedule" variant="COMPACT">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppCard mode="glass" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {isLoading ? (
            <ShimmerSkeleton width="100%" height={280} borderRadius={12} />
          ) : (
            <FadeInView style={{ flex: 1 }} duration={200}>
            <Animated.View style={{ opacity: gridOpacity }}>
              <View style={styles.monthHeader}>
                <Pressable style={styles.monthNavButton} onPress={() => shiftMonth(-1)} accessibilityLabel="Previous month">
                  <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
                </Pressable>
                <View style={styles.monthCenter}>
                  <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>{monthName}</Text>
                  <Pressable onPress={goToToday}>
                    <Text style={[styles.todayLink, { color: colors.primary }]}>Today</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.monthNavButton} onPress={() => shiftMonth(1)} accessibilityLabel="Next month">
                  <MaterialIcons name="chevron-right" size={24} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={styles.daysRow}>
                {days.map((day) => (
                  <Text key={day} style={[styles.dayLabel, { color: colors.textTertiary }]}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.grid}>
                {cells.map((cell) => {
                  const isToday = startOfDay(cell.date) === todayStart;
                  const isSelected = startOfDay(cell.date) === selectedDate;
                  const dayKey = keyForDate(cell.date);
                  const eventCount = eventsByDay.get(dayKey) ?? 0;

                  return (
                    <Pressable
                      key={cell.date}
                      style={[
                        styles.cell,
                        isToday && [styles.today, { backgroundColor: `${colors.primary}22` }],
                        isSelected && [styles.selected, { backgroundColor: colors.primary }],
                        !cell.inMonth && styles.outsideMonth,
                      ]}
                      onPress={() => setSelectedDate(startOfDay(cell.date))}
                    >
                      <Text style={[styles.cellText, { color: colors.textPrimary }, isSelected && styles.selectedText]}>
                        {cell.day}
                      </Text>
                      {eventCount > 0 ? (
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: colors.primary },
                            isSelected && [styles.dotSelected, { backgroundColor: '#fff' }],
                          ]}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
            </FadeInView>
          )}
        </AppCard>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {new Date(selectedDate).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}
        </Text>

        <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.searchInputWrap}>
            <MaterialIcons name="search" size={22} color={colors.textTertiary} />
            <Text style={[styles.searchText, { color: colors.textSecondary }]}>Search across all categories</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={{ gap: 10 }}>
            {[...Array(3)].map((_, i) => (
              <ShimmerSkeleton key={i} width="100%" height={60} borderRadius={8} />
            ))}
          </View>
        ) : (
          <>
            {selectedEventsByKind.EVENT.length > 0 && (
              <>
                <Text style={[styles.kindHeader, { color: colors.textTertiary }]}>Events</Text>
                {selectedEventsByKind.EVENT.map(renderEventCard)}
              </>
            )}

            {selectedEventsByKind.BIRTHDAY.length > 0 && (
              <>
                <Text style={[styles.kindHeader, { color: colors.textTertiary }]}>Birthdays</Text>
                {selectedEventsByKind.BIRTHDAY.map(renderEventCard)}
              </>
            )}

            {selectedEventsByKind.ANNIVERSARY.length > 0 && (
              <>
                <Text style={[styles.kindHeader, { color: colors.textTertiary }]}>Anniversaries</Text>
                {selectedEventsByKind.ANNIVERSARY.map(renderEventCard)}
              </>
            )}

            {selectedEventsByKind.COUNTDOWN.length > 0 && (
              <>
                <Text style={[styles.kindHeader, { color: colors.textTertiary }]}>Countdowns</Text>
                {selectedEventsByKind.COUNTDOWN.map(renderEventCard)}
              </>
            )}

            {!selectedEvents.length ? (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nothing for the day</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Tap + to add an event, birthday, countdown and more.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Pressable
        style={[
          styles.fab,
          { backgroundColor: colors.primary },
        ]}
        onPress={() =>
          router.push(
            `/create?kind=EVENT&date=${encodeURIComponent(new Date(selectedDate).toISOString().slice(0, 10))}` as never,
          )
        }
        accessibilityRole="button"
        accessibilityLabel="Create event"
      >
        <MaterialIcons name="add" size={24} color="#fff" />
      </Pressable>

      <EntityFormSheet
        visible={!!editing}
        title="Edit event"
        fields={EVENT_FIELDS}
        initialValues={
          editing
            ? {
                title: editing.title,
                date: toDateInput(editing.date),
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
  content: { gap: 14, paddingBottom: 220 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: {
    alignItems: 'center',
    gap: 2,
  },
  monthTitle: {
    ...LifeOSTypography.headlineMedium,
  },
  todayLink: {
    ...LifeOSTypography.titleSmall,
  },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayLabel: { ...LifeOSTypography.labelSmall, width: 42, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' },
  cell: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  outsideMonth: { opacity: 0.45 },
  today: {},
  selected: {},
  cellText: { ...LifeOSTypography.bodyMedium },
  selectedText: { color: '#fff', fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotSelected: {},
  sectionTitle: { ...LifeOSTypography.titleMedium, marginTop: 4 },
  searchRow: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 64,
    justifyContent: 'center',
  },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchText: { ...LifeOSTypography.bodyLarge },
  eventPrimary: { borderLeftWidth: 3 },
  eventSecondary: { borderLeftWidth: 3 },
  eventHighlighted: { borderWidth: 1 },
  eventType: { ...LifeOSTypography.labelSmall },
  eventTitle: { ...LifeOSTypography.titleSmall },
  eventTitleCompleted: { textDecorationLine: 'line-through', opacity: 0.72 },
  eventMeta: { ...LifeOSTypography.bodySmall },
  emptyWrap: { gap: 4, paddingVertical: 6 },
  emptyTitle: { ...LifeOSTypography.headlineMedium },
  emptyText: { ...LifeOSTypography.bodyLarge },
  kindHeader: { ...LifeOSTypography.titleSmall },
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
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
