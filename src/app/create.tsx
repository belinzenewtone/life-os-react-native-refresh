import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useAuthSession } from '@/core/auth/session-context';
import { ReminderScheduler } from '@/core/notifications/reminder-scheduler';
import { EventRepository } from '@/core/repositories/event-repository';
import { TaskRepository, type TaskRecord } from '@/core/repositories/task-repository';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSSpacing, LifeOSTypography } from '@/core/ui/design/tokens';

type ComposerKind = 'TASK' | 'EVENT' | 'BIRTHDAY' | 'ANNIVERSARY' | 'COUNTDOWN';
type EventCategory = 'WORK' | 'PERSONAL' | 'HEALTH' | 'FINANCE' | 'OTHER';
type EventPriority = 'NEUTRAL' | 'IMPORTANT' | 'CRITICAL';
type RepeatRule = 'NEVER' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

const KIND_LABELS: { key: ComposerKind; label: string }[] = [
  { key: 'TASK', label: 'Task' },
  { key: 'EVENT', label: 'Event' },
  { key: 'BIRTHDAY', label: 'Birthday' },
  { key: 'ANNIVERSARY', label: 'Anniversary' },
  { key: 'COUNTDOWN', label: 'Countdown' },
];

const REPEAT_ORDER: RepeatRule[] = ['NEVER', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const GENERAL_REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 1440, 10080];
const BIRTHDAY_REMINDER_PRESETS = [0, 1440, 2880, 4320, 10080];

function dateInput(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeInput(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toTimestamp(date: string, time?: string) {
  if (!date.trim()) return Number.NaN;
  const combined = `${date.trim()}T${(time?.trim() || '00:00')}:00`;
  const ts = new Date(combined).getTime();
  return Number.isNaN(ts) ? Number.NaN : ts;
}

function getDefaultKind(input: string | undefined): ComposerKind {
  if (!input) return 'TASK';
  const upper = input.toUpperCase();
  if (upper === 'TASK' || upper === 'EVENT' || upper === 'BIRTHDAY' || upper === 'ANNIVERSARY' || upper === 'COUNTDOWN') {
    return upper;
  }
  return 'TASK';
}

function mapTaskPriority(priority: EventPriority): TaskRecord['priority'] {
  if (priority === 'CRITICAL') return 'CRITICAL';
  if (priority === 'IMPORTANT') return 'HIGH';
  return 'MEDIUM';
}

function mapTaskPriorityBack(priority: TaskRecord['priority']): EventPriority {
  if (priority === 'CRITICAL') return 'CRITICAL';
  if (priority === 'HIGH') return 'IMPORTANT';
  return 'NEUTRAL';
}

function mapKindToEventKind(kind: Exclude<ComposerKind, 'TASK'>): 'EVENT' | 'BIRTHDAY' | 'ANNIVERSARY' | 'COUNTDOWN' {
  if (kind === 'EVENT') return 'EVENT';
  if (kind === 'BIRTHDAY') return 'BIRTHDAY';
  if (kind === 'ANNIVERSARY') return 'ANNIVERSARY';
  return 'COUNTDOWN';
}

function parseReminderOffsets(raw: string | undefined | null): number[] {
  if (!raw || raw.trim().length === 0) return [];
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n));
}

function remindersToString(arr: number[]): string {
  return arr.join(',');
}

function reminderLabel(minutes: number): string {
  if (minutes === 0) return 'At time';
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return '1 hour';
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hours`;
  if (minutes === 1440) return '1 day';
  if (minutes === 10080) return '1 week';
  return `${Math.floor(minutes / 1440)} days`;
}

function formatDateDisplay(dateStr: string, kind?: ComposerKind, addYear?: boolean): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (kind === 'BIRTHDAY' && addYear === false) {
    return date.toLocaleDateString('en-US', { month: 'long', day: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function CreateScreen() {
  const router = useRouter();
  const colors = useLifeOSColors();
  const { state } = useAuthSession();
  const params = useLocalSearchParams<{
    kind?: string;
    date?: string;
    editingId?: string;
    editingType?: string;
  }>();

  const seedDate = useMemo(() => {
    if (!params.date) return Date.now();
    const parsed = new Date(params.date).getTime();
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }, [params.date]);

  const isEditing = Boolean(params.editingId && params.editingType);
  const editingId = params.editingId ?? '';
  const editingType = params.editingType ?? '';

  const [kind, setKind] = useState<ComposerKind>(getDefaultKind(params.kind));
  const [busy, setBusy] = useState(false);

  // Sync kind with route params when screen is re-entered (e.g. Calendar FAB -> Create)
  useEffect(() => {
    setKind(getDefaultKind(params.kind));
  }, [params.kind]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [priority, setPriority] = useState<EventPriority>('NEUTRAL');
  const [category, setCategory] = useState<EventCategory>('PERSONAL');
  const [repeat, setRepeat] = useState<RepeatRule>('NEVER');
  const [reminders, setReminders] = useState<number[]>([]);
  const [alarmEnabled, setAlarmEnabled] = useState(false);

  const [dateFrom, setDateFrom] = useState(dateInput(seedDate));
  const [timeFrom, setTimeFrom] = useState(timeInput(seedDate));
  const [dateTo, setDateTo] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [allDay, setAllDay] = useState(false);

  const [addYear, setAddYear] = useState(false);
  const [guests, setGuests] = useState('');
  const [countdownRemind3Days, setCountdownRemind3Days] = useState(false);

  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderTimeOfDay, setReminderTimeOfDay] = useState('08:00');

  // Date/Time picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | 'reminder'>('from');
  const [pickerValue, setPickerValue] = useState(new Date(seedDate));

  // Reminders modal
  const [remindersModalVisible, setRemindersModalVisible] = useState(false);

  // Repeat modal
  const [repeatModalVisible, setRepeatModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (repeatModalVisible) { setRepeatModalVisible(false); return true; }
        if (remindersModalVisible) { setRemindersModalVisible(false); return true; }
        if (pickerVisible) { setPickerVisible(false); return true; }
        return false;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [repeatModalVisible, remindersModalVisible, pickerVisible])
  );

  useEffect(() => {
    if (!isEditing || !state.userId) return;

    let cancelled = false;
    async function load() {
      try {
        if (editingType === 'task') {
          const task = await TaskRepository.findById(state.userId!, editingId);
          if (!task || cancelled) return;
          setKind('TASK');
          setTitle(task.title);
          setDescription(task.description);
          setPriority(mapTaskPriorityBack(task.priority));
          if (task.deadline) {
            setDateFrom(dateInput(task.deadline));
            setTimeFrom(timeInput(task.deadline));
          }
          setReminders(parseReminderOffsets(task.reminder_offsets));
          setAlarmEnabled(Boolean(task.alarm_enabled));
        } else if (editingType === 'event') {
          const event = await EventRepository.findById(state.userId!, editingId);
          if (!event || cancelled) return;
          setKind(event.kind as ComposerKind);
          setTitle(event.title);
          setDateFrom(dateInput(event.date));
          setTimeFrom(timeInput(event.date));
          if (event.end_date) {
            setDateTo(dateInput(event.end_date));
            setTimeTo(timeInput(event.end_date));
          }
          setCategory(event.type);
          setAllDay(Boolean(event.all_day));
        }
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isEditing, editingId, editingType, state.userId]);

  function openPicker(target: 'from' | 'to' | 'reminder', mode: 'date' | 'time') {
    setPickerTarget(target);
    setPickerMode(mode);
    let ts: number;
    if (target === 'to') {
      ts = toTimestamp(dateTo, timeTo) || seedDate;
    } else if (target === 'from') {
      ts = toTimestamp(dateFrom, timeFrom) || seedDate;
    } else {
      const [h, m] = reminderTimeOfDay.split(':').map(Number);
      const now = new Date();
      now.setHours(h, m, 0, 0);
      ts = now.getTime();
    }
    setPickerValue(new Date(ts));
    setPickerVisible(true);
  }

  function handlePickerChange(_event: unknown, selected?: Date) {
    if (!selected) {
      setPickerVisible(false);
      return;
    }
    if (pickerTarget === 'from') {
      if (pickerMode === 'date') {
        setDateFrom(dateInput(selected.getTime()));
      } else {
        setTimeFrom(timeInput(selected.getTime()));
      }
    } else if (pickerTarget === 'to') {
      if (pickerMode === 'date') {
        setDateTo(dateInput(selected.getTime()));
      } else {
        setTimeTo(timeInput(selected.getTime()));
      }
    } else if (pickerTarget === 'reminder') {
      setReminderTimeOfDay(timeInput(selected.getTime()));
    }
    setPickerVisible(false);
  }

  function toggleReminder(minutes: number) {
    setReminders((prev) => {
      if (prev.includes(minutes)) {
        return prev.filter((m) => m !== minutes);
      }
      return [...prev, minutes].sort((a, b) => a - b);
    });
  }

  function reminderRowLabel(): string {
    if (reminders.length === 0) return 'None';
    if (reminders.length === 1) return '1 reminder';
    return `${reminders.length} reminders`;
  }

  async function handleSave() {
    if (!state.userId || busy) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Required', 'Please enter a title.');
      return;
    }

    setBusy(true);
    let savedEntityId: string | null = null;
    let savedDeadlineMs: number | null = null;
    let savedOffsets: number[] = [];
    let savedAllDay = false;
    let savedTimeOfDayMinutes = 480;

    try {
      if (kind === 'TASK') {
        const deadline = toTimestamp(dateFrom, allDay ? '00:00' : timeFrom);
        if (Number.isNaN(deadline)) {
          Alert.alert('Invalid date', 'Please provide a valid task date/time.');
          return;
        }
        savedDeadlineMs = deadline;
        savedOffsets = reminders;
        if (isEditing && editingType === 'task') {
          await TaskRepository.update(state.userId, editingId, {
            title: trimmedTitle,
            description,
            priority: mapTaskPriority(priority),
            deadline,
          });
          savedEntityId = editingId;
        } else {
          savedEntityId = await TaskRepository.create(state.userId, {
            title: trimmedTitle,
            description,
            priority: mapTaskPriority(priority),
            deadline,
            reminder_offsets: remindersToString(reminders),
            alarm_enabled: alarmEnabled,
          });
        }
      } else {
        const eventKind = mapKindToEventKind(kind);
        const eventDate = toTimestamp(dateFrom, allDay ? '00:00' : timeFrom);
        if (Number.isNaN(eventDate)) {
          Alert.alert('Invalid date', 'Please provide a valid date/time.');
          return;
        }
        savedDeadlineMs = eventDate;
        savedOffsets =
          !remindersEnabled
            ? []
            : kind === 'COUNTDOWN' && countdownRemind3Days
              ? [4320]
              : remindersToString(reminders)
                  .split(',')
                  .map((s: string) => parseInt(s.trim(), 10))
                  .filter((n: number) => Number.isFinite(n) && n > 0);
        savedAllDay = allDay || kind === 'BIRTHDAY';

        let endDate: number | null = null;
        if (dateTo.trim()) {
          const parsedEnd = toTimestamp(dateTo, timeTo || '00:00');
          endDate = Number.isNaN(parsedEnd) ? null : parsedEnd;
        }

        const reminderOffsets =
          !remindersEnabled
            ? ''
            : kind === 'COUNTDOWN' && countdownRemind3Days
              ? '4320'
              : remindersToString(reminders);

        const reminderTimeOfDayMinutes = (() => {
          const [h, m] = reminderTimeOfDay.split(':').map(Number);
          return h * 60 + m;
        })();
        savedTimeOfDayMinutes = reminderTimeOfDayMinutes;

        if (isEditing && editingType === 'event') {
          await EventRepository.update(state.userId, editingId, {
            title: trimmedTitle,
            date: eventDate,
            end_date: endDate,
            kind: eventKind,
            type: category,
            all_day: savedAllDay,
            status: 'PENDING',
          });
          savedEntityId = editingId;
        } else {
          savedEntityId = await EventRepository.create(state.userId, {
            title: trimmedTitle,
            description,
            date: eventDate,
            end_date: endDate,
            kind: eventKind,
            type: category,
            importance: priority,
            all_day: savedAllDay,
            repeat_rule: repeat,
            reminder_offsets: reminderOffsets,
            alarm_enabled: alarmEnabled,
            has_reminder: reminderOffsets.length > 0 || alarmEnabled,
            guests,
            time_zone_id: 'Africa/Nairobi',
            reminder_time_of_day_minutes: reminderTimeOfDayMinutes,
          });
        }

        if (kind === 'BIRTHDAY' && !addYear) {
          // Keep no-op flag for UX parity (year intentionally ignored when disabled).
        }
      }

      // Schedule local reminders if enabled — gated by alarmEnabled toggle
      if (alarmEnabled && savedEntityId && savedDeadlineMs && savedOffsets.length > 0) {
        try {
          if (kind === 'TASK') {
            await ReminderScheduler.schedule('task', savedEntityId, trimmedTitle, savedDeadlineMs, savedOffsets);
          } else {
            await ReminderScheduler.schedule('event', savedEntityId, trimmedTitle, savedDeadlineMs, savedOffsets, {
              allDay: savedAllDay,
              timeOfDayMinutes: savedTimeOfDayMinutes,
            });
          }
        } catch {
          // Non-critical: reminders are best-effort
        }
      }

      await SyncCoordinator.enqueueDefault(state.userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(state.userId);
      router.back();
    } catch {
      Alert.alert('Save failed', 'Could not save item. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const screenTitle = useMemo(() => {
    const base =
      kind === 'TASK'
        ? 'Task'
        : kind === 'EVENT'
          ? 'Event'
          : kind === 'BIRTHDAY'
            ? 'Birthday'
            : kind === 'ANNIVERSARY'
              ? 'Anniversary'
              : 'Countdown';
    return isEditing ? `Edit ${base}` : `New ${base}`;
  }, [kind, isEditing]);

  const priorityConfig = useMemo(
    () => [
      { key: 'NEUTRAL' as EventPriority, label: 'Neutral', color: colors.info },
      { key: 'IMPORTANT' as EventPriority, label: 'Important', color: colors.warning },
      { key: 'CRITICAL' as EventPriority, label: 'Urgent', color: colors.error },
    ],
    [colors.info, colors.warning, colors.error],
  );

  const reminderPresets = kind === 'BIRTHDAY' ? BIRTHDAY_REMINDER_PRESETS : GENERAL_REMINDER_PRESETS;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{screenTitle}</Text>
        <Pressable onPress={handleSave} disabled={busy}>
          <Text style={[styles.saveText, { color: colors.primary }]}>{busy ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>

      <View style={styles.kindRow}>
        {KIND_LABELS.map((item) => {
          const selected = item.key === kind;
          return (
            <Pressable
              key={item.key}
              onPress={() => setKind(item.key)}
              style={[
                styles.kindChip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? `${colors.primary}26` : colors.surface,
                },
              ]}
            >
              <Text
                style={[styles.kindChipText, { color: selected ? colors.primary : colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={
            kind === 'TASK'
              ? 'Task title'
              : kind === 'BIRTHDAY'
                ? "Person's name"
                : kind === 'ANNIVERSARY'
                  ? 'Anniversary name'
                  : 'Event title'
          }
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
        />

        {kind === 'TASK' ? (
          <>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            />

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {priorityConfig.map((item) => {
                const selected = priority === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setPriority(item.key)}
                    style={[
                      styles.priorityChip,
                      {
                        backgroundColor: selected ? item.color : `${item.color}22`,
                        borderColor: item.color,
                      },
                    ]}
                  >
                    <Text style={[styles.priorityText, { color: selected ? '#fff' : item.color }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Deadline</Text>
            <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Pressable onPress={() => openPicker('from', 'date')} style={[styles.iconRow, { borderBottomColor: colors.border }]}>
                <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                <Text style={[styles.rowInput, { color: colors.textPrimary }]}>
                  {formatDateDisplay(dateFrom) || 'Select date'}
                </Text>
              </Pressable>
              <Pressable onPress={() => openPicker('from', 'time')} style={styles.iconRow}>
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                <Text style={[styles.rowInput, { color: colors.textPrimary }]}>
                  {formatTimeDisplay(timeFrom) || 'Select time'}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setRemindersModalVisible(true)}
              style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            >
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-none" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Reminders</Text>
              </View>
              <Text style={[styles.toggleValue, { color: colors.textSecondary }]}>{reminderRowLabel()}</Text>
            </Pressable>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-active" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Alarm reminders</Text>
              </View>
              <Pressable onPress={() => setAlarmEnabled((v) => !v)} style={[styles.switchTrack, { backgroundColor: alarmEnabled ? colors.primary : colors.border }]}>
                <View style={[styles.switchThumb, alarmEnabled && styles.switchThumbOn]} />
              </Pressable>
            </View>
          </>
        ) : null}

        {kind === 'EVENT' ? (
          <>
            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>All day</Text>
              <Pressable onPress={() => setAllDay((v) => !v)} style={[styles.switchTrack, { backgroundColor: allDay ? colors.primary : colors.border }]}>
                <View style={[styles.switchThumb, allDay && styles.switchThumbOn]} />
              </Pressable>
            </View>

            {allDay ? (
              <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                <Pressable onPress={() => openPicker('reminder', 'time')} style={styles.iconRow}>
                  <MaterialIcons name="schedule" size={20} color={colors.primary} />
                  <View style={styles.rowInputWrap}>
                    <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>Reminder time</Text>
                    <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatTimeDisplay(reminderTimeOfDay)}</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>When</Text>
            <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Pressable onPress={() => openPicker('from', 'date')} style={[styles.iconRow, { borderBottomColor: colors.border }]}>
                <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>From</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatDateDisplay(dateFrom) || 'Select date'}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => openPicker('from', 'time')} style={[styles.iconRow, { borderBottomColor: colors.border }]}>
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>Start time</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatTimeDisplay(timeFrom) || 'Select time'}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => openPicker('to', 'date')} style={[styles.iconRow, { borderBottomColor: colors.border }]}>
                <MaterialIcons name="calendar-month" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>To</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatDateDisplay(dateTo) || 'End date (optional)'}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => openPicker('to', 'time')} style={styles.iconRow}>
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>End time</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatTimeDisplay(timeTo) || 'End time (optional)'}</Text>
                </View>
              </Pressable>
            </View>

            {dateTo ? (
              <Pressable onPress={() => { setDateTo(''); setTimeTo(''); }} style={{ alignSelf: 'flex-start', marginTop: -6 }}>
                <Text style={{ color: colors.error, ...LifeOSTypography.labelLarge }}>Clear end date</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setRepeatModalVisible(true)}
              style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            >
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="repeat" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Repeat</Text>
              </View>
              <Text style={[styles.toggleValue, { color: colors.textSecondary }]}>{repeat === 'NEVER' ? 'Never' : repeat.toLowerCase()}</Text>
            </Pressable>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-none" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Enable reminders</Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <Pressable
              onPress={() => setRemindersModalVisible(true)}
              style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            >
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-none" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Reminders</Text>
              </View>
              <Text style={[styles.toggleValue, { color: colors.textSecondary }]}>{reminderRowLabel()}</Text>
            </Pressable>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-active" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Alarm reminders</Text>
              </View>
              <Pressable onPress={() => setAlarmEnabled((v) => !v)} style={[styles.switchTrack, { backgroundColor: alarmEnabled ? colors.primary : colors.border }]}>
                <View style={[styles.switchThumb, alarmEnabled && styles.switchThumbOn]} />
              </Pressable>
            </View>

            <TextInput
              value={guests}
              onChangeText={setGuests}
              placeholder="Add guests (optional)"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            />

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="public" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Time zone</Text>
              </View>
              <Text style={[styles.toggleValue, { color: colors.textSecondary }]}>Africa/Nairobi</Text>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Category</Text>
            <View style={styles.chipRow}>
              {(['WORK', 'PERSONAL', 'HEALTH', 'FINANCE', 'OTHER'] as EventCategory[]).map((option) => {
                const selected = category === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setCategory(option)}
                    style={[
                      styles.compactChip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? `${colors.primary}26` : colors.surface,
                      },
                    ]}
                  >
                    <Text style={[styles.compactChipText, { color: selected ? colors.primary : colors.textSecondary }]}>{option.toLowerCase()}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {priorityConfig.map((item) => {
                const selected = priority === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setPriority(item.key)}
                    style={[
                      styles.priorityChip,
                      {
                        backgroundColor: selected ? item.color : `${item.color}22`,
                        borderColor: item.color,
                      },
                    ]}
                  >
                    <Text style={[styles.priorityText, { color: selected ? '#fff' : item.color }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
            />
          </>
        ) : null}

        {kind === 'BIRTHDAY' ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Birthday</Text>
            <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Pressable onPress={() => openPicker('from', 'date')} style={styles.iconRow}>
                <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>Month and day</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>
                    {formatDateDisplay(dateFrom, 'BIRTHDAY', addYear) || 'Select date'}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Add year</Text>
              <Pressable onPress={() => setAddYear((v) => !v)} style={[styles.switchTrack, { backgroundColor: addYear ? colors.primary : colors.border }]}>
                <View style={[styles.switchThumb, addYear && styles.switchThumbOn]} />
              </Pressable>
            </View>

            <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Pressable onPress={() => openPicker('reminder', 'time')} style={styles.iconRow}>
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>Reminder time</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatTimeDisplay(reminderTimeOfDay)}</Text>
                </View>
              </Pressable>
            </View>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-none" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Enable reminders</Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <Pressable
              onPress={() => setRemindersModalVisible(true)}
              style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            >
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-none" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Reminders</Text>
              </View>
              <Text style={[styles.toggleValue, { color: colors.textSecondary }]}>{reminderRowLabel()}</Text>
            </Pressable>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-active" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Alarm reminders</Text>
              </View>
              <Pressable onPress={() => setAlarmEnabled((v) => !v)} style={[styles.switchTrack, { backgroundColor: alarmEnabled ? colors.primary : colors.border }]}>
                <View style={[styles.switchThumb, alarmEnabled && styles.switchThumbOn]} />
              </Pressable>
            </View>
          </>
        ) : null}

        {kind === 'ANNIVERSARY' ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Date</Text>
            <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Pressable onPress={() => openPicker('from', 'date')} style={styles.iconRow}>
                <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>Date</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatDateDisplay(dateFrom) || 'Select date'}</Text>
                </View>
              </Pressable>
            </View>

            <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Pressable onPress={() => openPicker('reminder', 'time')} style={styles.iconRow}>
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>Reminder time</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatTimeDisplay(reminderTimeOfDay)}</Text>
                </View>
              </Pressable>
            </View>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-none" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Enable reminders</Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <Pressable
              onPress={() => setRemindersModalVisible(true)}
              style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            >
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-none" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Reminders</Text>
              </View>
              <Text style={[styles.toggleValue, { color: colors.textSecondary }]}>{reminderRowLabel()}</Text>
            </Pressable>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-active" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Alarm reminders</Text>
              </View>
              <Pressable onPress={() => setAlarmEnabled((v) => !v)} style={[styles.switchTrack, { backgroundColor: alarmEnabled ? colors.primary : colors.border }]}>
                <View style={[styles.switchThumb, alarmEnabled && styles.switchThumbOn]} />
              </Pressable>
            </View>
          </>
        ) : null}

        {kind === 'COUNTDOWN' ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>When</Text>
            <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Pressable onPress={() => openPicker('from', 'date')} style={styles.iconRow}>
                <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>Date</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatDateDisplay(dateFrom) || 'Select date'}</Text>
                </View>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setRepeatModalVisible(true)}
              style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            >
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="repeat" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Repeat</Text>
              </View>
              <Text style={[styles.toggleValue, { color: colors.textSecondary }]}>{repeat === 'NEVER' ? 'Never' : repeat.toLowerCase()}</Text>
            </Pressable>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Remind me at</Text>
            <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Pressable onPress={() => openPicker('from', 'time')} style={styles.iconRow}>
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>Time</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatTimeDisplay(timeFrom) || 'Select time'}</Text>
                </View>
              </Pressable>
            </View>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Remind 3 days before</Text>
              <Pressable onPress={() => setCountdownRemind3Days((v) => !v)} style={[styles.switchTrack, { backgroundColor: countdownRemind3Days ? colors.primary : colors.border }]}>
                <View style={[styles.switchThumb, countdownRemind3Days && styles.switchThumbOn]} />
              </Pressable>
            </View>

            <View style={[styles.blockCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Pressable onPress={() => openPicker('reminder', 'time')} style={styles.iconRow}>
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                <View style={styles.rowInputWrap}>
                  <Text style={[styles.rowInputLabel, { color: colors.textTertiary }]}>Reminder time</Text>
                  <Text style={[styles.rowInput, { color: colors.textPrimary }]}>{formatTimeDisplay(reminderTimeOfDay)}</Text>
                </View>
              </Pressable>
            </View>

            <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.toggleLabelWrap}>
                <MaterialIcons name="notifications-none" size={22} color={colors.primary} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Enable reminders</Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Date/Time Picker Overlay */}
      {pickerVisible ? (
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setPickerVisible(false)} />
          <View style={[styles.pickerSheet, { backgroundColor: colors.surfaceElevated }]}>
            <DateTimePicker
              value={pickerValue}
              mode={pickerMode}
              display="spinner"
              onChange={handlePickerChange}
            />
          </View>
        </View>
      ) : null}

      {/* Reminders Modal */}
      <Modal visible={remindersModalVisible} transparent animationType="slide" onRequestClose={() => setRemindersModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setRemindersModalVisible(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Reminders</Text>
              <Pressable onPress={() => setRemindersModalVisible(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              {!remindersEnabled ? (
                <Text style={[styles.listRowText, { color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 }]}>Reminders disabled</Text>
              ) : (
                <View style={styles.chipRow}>
                  {reminderPresets.map((minutes) => {
                    const active = reminders.includes(minutes);
                    return (
                      <Pressable
                        key={minutes}
                        onPress={() => toggleReminder(minutes)}
                        style={[
                          styles.compactChip,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? `${colors.primary}26` : colors.surface,
                          },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: active ? colors.primary : colors.textSecondary }]}>{reminderLabel(minutes)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Repeat Modal */}
      <Modal visible={repeatModalVisible} transparent animationType="slide" onRequestClose={() => setRepeatModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setRepeatModalVisible(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Repeat</Text>
              <Pressable onPress={() => setRepeatModalVisible(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              {REPEAT_ORDER.map((option) => {
                const selected = repeat === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setRepeat(option);
                      setRepeatModalVisible(false);
                    }}
                    style={[styles.listRow, { borderBottomColor: colors.border }]}
                  >
                    <Text style={[styles.listRowText, { color: colors.textPrimary }]}>
                      {option === 'NEVER' ? 'Never' : option.charAt(0) + option.slice(1).toLowerCase()}
                    </Text>
                    {selected ? <MaterialIcons name="check" size={22} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    paddingHorizontal: LifeOSSpacing.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { ...LifeOSTypography.headlineSmall, flex: 1, marginLeft: 8 },
  saveText: { ...LifeOSTypography.labelLarge, minWidth: 46, textAlign: 'right' },
  kindRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: LifeOSSpacing.screenHorizontal,
    paddingTop: 14,
    paddingBottom: 14,
  },
  kindChip: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  kindChipText: { ...LifeOSTypography.titleSmall, textAlign: 'center' },
  content: { paddingHorizontal: LifeOSSpacing.screenHorizontal, paddingTop: 4, paddingBottom: 180, gap: 12 },
  sectionLabel: { ...LifeOSTypography.titleSmall },
  input: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...LifeOSTypography.headlineSmall,
  },
  blockCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowInputWrap: { flex: 1, gap: 2 },
  rowInputLabel: { ...LifeOSTypography.bodySmall },
  rowInput: {
    ...LifeOSTypography.headlineSmall,
    paddingVertical: 0,
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleLabel: { ...LifeOSTypography.headlineSmall },
  toggleValue: { ...LifeOSTypography.headlineSmall, textTransform: 'capitalize' },
  switchTrack: {
    width: 56,
    height: 34,
    borderRadius: 999,
    padding: 4,
    justifyContent: 'center',
  },
  switchThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  switchThumbOn: { transform: [{ translateX: 22 }] },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  priorityText: { ...LifeOSTypography.titleSmall, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compactChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  compactChipText: { ...LifeOSTypography.titleSmall, textTransform: 'capitalize' },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LifeOSSpacing.screenHorizontal,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { ...LifeOSTypography.headlineSmall },
  modalContent: {
    paddingHorizontal: LifeOSSpacing.screenHorizontal,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listRowText: { ...LifeOSTypography.headlineSmall },
});
