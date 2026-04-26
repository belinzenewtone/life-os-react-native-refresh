import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { buildRoute } from '@/core/navigation/routes';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

const tools = [
  {
    title: 'Budgets',
    description: 'Set spending limits by category and track progress',
    icon: 'account-balance' as const,
    route: buildRoute('budget'),
  },
  {
    title: 'Income',
    description: 'Log and review income sources',
    icon: 'monetization-on' as const,
    route: buildRoute('income'),
  },
  {
    title: 'Recurring',
    description: 'Subscriptions, salaries, and scheduled payments',
    icon: 'loop' as const,
    route: buildRoute('recurring'),
  },
  {
    title: 'Loans & Fuliza',
    description: 'Track outstanding Fuliza draws and repayment history',
    icon: 'account-balance-wallet' as const,
    route: buildRoute('loans'),
  },
  {
    title: 'Search Finance',
    description: 'Search transactions, budgets, and recurring entries',
    icon: 'search' as const,
    route: buildRoute('search'),
  },
  {
    title: 'Export',
    description: 'Export your data as CSV or share a report',
    icon: 'file-download' as const,
    route: buildRoute('export'),
  },
];

export default function PlannerScreen() {
  const router = useRouter();
  const colors = useLifeOSColors();

  return (
    <PageScaffold title="Finance Hub" subtitle="Finance tools hub" eyebrow="Hub" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {tools.map((tool) => (
          <Pressable
            key={tool.route}
            style={[
              styles.card,
              { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
            ]}
            onPress={() => router.push(tool.route as never)}
          >
            <View style={styles.cardContent}>
              <MaterialIcons
                name={tool.icon}
                size={28}
                color={colors.primary}
                style={styles.icon}
              />
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  {tool.title}
                </Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                  {tool.description}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 220 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    marginRight: 4,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: { ...LifeOSTypography.titleSmall },
  description: { ...LifeOSTypography.bodySmall },
});
