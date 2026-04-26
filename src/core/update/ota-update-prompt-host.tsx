import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BinaryUpgradeService, type BinaryUpgradeDecision } from '@/core/update/binary-upgrade-service';
import { launchBinaryDownload } from '@/core/update/binary-upgrade-intent';
import { OtaUpdateService } from '@/core/update/ota-update-service';
import { LifeOSColors, LifeOSTypography } from '@/core/ui/design/tokens';

type UpdatePromptState =
  | { kind: 'NONE' }
  | { kind: 'OTA' }
  | { kind: 'BINARY'; decision: BinaryUpgradeDecision };

export function OtaUpdatePromptHost({ enabled = true }: { enabled?: boolean }) {
  const [prompt, setPrompt] = useState<UpdatePromptState>({ kind: 'NONE' });

  const isVisible = prompt.kind !== 'NONE';
  const isRequiredBinary = prompt.kind === 'BINARY' && prompt.decision.required;
  const isOptionalBinary = prompt.kind === 'BINARY' && !prompt.decision.required;

  useEffect(() => {
    let mounted = true;
    async function check() {
      if (!enabled) return;

      const binary = await BinaryUpgradeService.check();
      if (mounted && binary.available) {
        setPrompt({ kind: 'BINARY', decision: binary });
        return;
      }

      const ota = await OtaUpdateService.checkForUpdate();
      if (mounted && ota.available) setPrompt({ kind: 'OTA' });
    }
    check();
    return () => {
      mounted = false;
    };
  }, [enabled]);

  if (!isVisible) return null;

  if (isOptionalBinary) {
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Update available</Text>
        <Text style={styles.bannerBody}>{prompt.decision.message}</Text>
        <View style={styles.bannerActions}>
          <Pressable
            style={[styles.bannerButton, { backgroundColor: LifeOSColors.light.primary }]}
            onPress={() => {
              if (prompt.decision.storeUrl) {
                launchBinaryDownload(prompt.decision.storeUrl);
              }
            }}
          >
            <Text style={styles.bannerButtonText}>Open store</Text>
          </Pressable>
          <Pressable onPress={() => setPrompt({ kind: 'NONE' })}>
            <Text style={styles.bannerSkip}>Later</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const title = isRequiredBinary ? 'Update required' : 'Update available';
  const body =
    prompt.kind === 'BINARY'
      ? prompt.decision.message
      : 'A new version is ready. Install now for the latest fixes and features.';
  const primaryLabel = prompt.kind === 'BINARY' ? 'Open store' : 'Install update';

  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable
            style={styles.button}
            onPress={async () => {
              if (prompt.kind === 'BINARY') {
                if (prompt.decision.storeUrl) {
                  await launchBinaryDownload(prompt.decision.storeUrl);
                }
                return;
              }
              await OtaUpdateService.applyUpdate();
            }}
          >
            <Text style={styles.buttonText}>{primaryLabel}</Text>
          </Pressable>
          {!isRequiredBinary ? (
            <Pressable onPress={() => setPrompt({ kind: 'NONE' })}>
              <Text style={styles.skip}>Later</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12 },
  title: { ...LifeOSTypography.titleLarge, color: LifeOSColors.light.textPrimary },
  body: { ...LifeOSTypography.bodyMedium, color: LifeOSColors.light.textSecondary },
  button: { backgroundColor: LifeOSColors.light.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', ...LifeOSTypography.labelLarge },
  skip: { textAlign: 'center', ...LifeOSTypography.labelMedium, color: LifeOSColors.light.textSecondary },
  banner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  bannerTitle: { ...LifeOSTypography.titleMedium, color: LifeOSColors.light.textPrimary },
  bannerBody: { ...LifeOSTypography.bodySmall, color: LifeOSColors.light.textSecondary, marginTop: 4 },
  bannerActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  bannerButton: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  bannerButtonText: { color: '#fff', ...LifeOSTypography.labelMedium },
  bannerSkip: { ...LifeOSTypography.labelMedium, color: LifeOSColors.light.textSecondary },
});
