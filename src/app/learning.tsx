import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useAuthSession } from '@/core/auth/session-context';
import {
  LEARNING_CATEGORIES,
  useLearningData,
} from '@/core/hooks/use-learning-data';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export default function LearningScreen() {
  const router = useRouter();
  const { state } = useAuthSession();
  const colors = useLifeOSColors();
  const {
    sessions,
    filtered,
    selectedCategory,
    setSelectedCategory,
    completedCount,
    markCompleted,
  } = useLearningData(state.userId);

  const handleCardPress = useCallback(
    (id: string) => {
      markCompleted(id);
    },
    [markCompleted]
  );

  return (
    <PageScaffold
      title="Learning"
      subtitle={`${completedCount} of ${sessions.length} sessions completed`}
      eyebrow="Learning"
      onBack={() => router.back()}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        <Pressable
          style={[
            styles.chip,
            {
              backgroundColor:
                selectedCategory === null
                  ? colors.primary
                  : colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.chipText,
              {
                color:
                  selectedCategory === null
                    ? colors.surfaceElevated
                    : colors.textPrimary,
              },
            ]}
          >
            All
          </Text>
        </Pressable>
        {LEARNING_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.value}
            style={[
              styles.chip,
              {
                backgroundColor:
                  selectedCategory === cat.value
                    ? colors.primary
                    : colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setSelectedCategory(cat.value)}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color:
                    selectedCategory === cat.value
                      ? colors.surfaceElevated
                      : colors.textPrimary,
                },
              ]}
            >
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {filtered.map((session) => (
          <Pressable
            key={session.id}
            style={[
              styles.card,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceElevated,
              },
            ]}
            onPress={() => handleCardPress(session.id)}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.category, { color: colors.primary }]}>
                {session.category}
              </Text>
              {session.isCompleted ? (
                <MaterialIcons
                  name="check-circle"
                  size={20}
                  color={colors.success}
                />
              ) : (
                <Text
                  style={[
                    styles.actionLabel,
                    { color: colors.primary },
                  ]}
                >
                  {session.progress > 0 ? 'Continue' : 'Start'}
                </Text>
              )}
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {session.title}
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {session.description}
            </Text>

            <View style={styles.metaRow}>
              <MaterialIcons
                name="timer"
                size={14}
                color={colors.textTertiary}
              />
              <Text style={[styles.duration, { color: colors.textTertiary }]}>
                {session.durationMinutes} min
              </Text>
            </View>

            {!session.isCompleted && session.progress > 0 && (
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${session.progress * 100}%`,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { ...LifeOSTypography.labelSmall },
  content: { gap: 10, paddingBottom: 220 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  category: { ...LifeOSTypography.labelSmall, textTransform: 'uppercase' },
  actionLabel: { ...LifeOSTypography.labelSmall },
  title: { ...LifeOSTypography.titleSmall },
  description: { ...LifeOSTypography.bodySmall },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  duration: { ...LifeOSTypography.bodySmall },
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
