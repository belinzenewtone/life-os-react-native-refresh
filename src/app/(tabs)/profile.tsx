import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';

import { useAuthSession } from '@/core/auth/session-context';
import { useAppBootstrap } from '@/core/bootstrap/app-bootstrap-context';
import { SyncCoordinator } from '@/core/sync/sync-coordinator';
import { PageScaffold } from '@/core/ui/components/PageScaffold';
import { AppCard } from '@/core/ui/components/AppCard';
import { useLifeOSColors } from '@/core/ui/design/use-lifeos-colors';
import { LifeOSTypography } from '@/core/ui/design/tokens';

export default function ProfileScreen() {
  const { state, signOut } = useAuthSession();
  const { settings, updateSettings } = useAppBootstrap();
  const colors = useLifeOSColors();

  const [displayName, setDisplayName] = useState(state.userId || 'User');
  const [editedName, setEditedName] = useState(displayName);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const email = (state as any).userEmail || 'No email set';
  const phone = (state as any).userPhone || 'Not set';
  const avatarInitial = displayName.charAt(0).toUpperCase() || 'U';
  const activeSince = 'Apr 21, 2026'; // TODO: fetch from user metadata

  const appVersion = useMemo(
    () => `${Application.nativeApplicationVersion ?? '1.0.0'}${Application.nativeBuildVersion ? ` (${Application.nativeBuildVersion})` : ''}`,
    [],
  );

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  function handleSaveProfile() {
    setDisplayName(editedName.trim() || 'User');
    setIsEditing(false);
  }

  function handleCancelEdit() {
    setEditedName(displayName);
    setIsEditing(false);
  }

  async function handleBackup() {
    if (!state.userId) return;
    try {
      await SyncCoordinator.enqueueDefault(state.userId, 'USER_MANUAL_RETRY', ['PUSH_ALL']);
      await SyncCoordinator.runPending(state.userId);
      setSyncStatus('Backup queued successfully.');
      setTimeout(() => setSyncStatus(null), 2000);
    } catch {
      setSyncStatus('Failed to queue backup.');
      setTimeout(() => setSyncStatus(null), 2000);
    }
  }

  async function handleRestore() {
    if (!state.userId) return;
    try {
      await SyncCoordinator.enqueueDefault(state.userId, 'USER_PULL_TO_REFRESH', ['PULL_ALL']);
      await SyncCoordinator.runPending(state.userId);
      setSyncStatus('Restore queued successfully.');
      setTimeout(() => setSyncStatus(null), 2000);
    } catch {
      setSyncStatus('Failed to queue restore.');
      setTimeout(() => setSyncStatus(null), 2000);
    }
  }

  return (
    <PageScaffold title="Profile" subtitle="Account and app controls" eyebrow="Personal Space">
      <ScrollView contentContainerStyle={styles.content}>
        {/* Identity Card */}
        <AppCard mode="elevated">
          <View style={styles.identityCard}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
              {avatarUri ? (
                <Text style={[styles.avatarText, { color: colors.primary }]}>🖼️</Text>
              ) : (
                <Text style={[styles.avatarText, { color: colors.primary }]}>{avatarInitial}</Text>
              )}
            </View>
            <Text style={[styles.displayName, { color: colors.textPrimary }]}>{displayName}</Text>
            <Text style={[styles.emailText, { color: colors.textSecondary }]}>{email}</Text>
            <View style={styles.activeSinceRow}>
              <MaterialIcons name="person-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.activeSinceText, { color: colors.textTertiary }]}>Active since {activeSince}</Text>
            </View>
            <Pressable onPress={pickImage}>
              <Text style={[styles.changePhotoText, { color: colors.primary }]}>Change photo</Text>
            </Pressable>
          </View>
        </AppCard>

        {/* Details Card */}
        <AppCard mode="elevated">
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Details</Text>
            {!isEditing && (
              <Pressable onPress={() => setIsEditing(true)}>
                <Text style={[styles.editText, { color: colors.primary }]}>Edit</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.infoRow}>
            <MaterialIcons name="person-outline" size={24} color={colors.primary} />
            <View style={styles.infoText}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Display name</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{displayName}</Text>
            </View>
          </View>

          {isEditing && (
            <View style={styles.editRow}>
              <TextInput
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Display name"
                placeholderTextColor={colors.textTertiary}
                style={[styles.editInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
              />
              <View style={styles.editActions}>
                <Pressable style={[styles.editActionBtn, { borderColor: colors.border }]} onPress={handleCancelEdit}>
                  <Text style={[styles.editActionText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.editActionBtn, { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]} onPress={handleSaveProfile}>
                  <Text style={[styles.editActionText, { color: colors.primary }]}>Save</Text>
                </Pressable>
              </View>
            </View>
          )}
        </AppCard>

        {/* Personal Information Card */}
        <AppCard mode="elevated">
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personal Information</Text>
            <Pressable onPress={() => setIsEditing(true)}>
              <MaterialIcons name="edit" size={20} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.infoRow}>
            <MaterialIcons name="person-outline" size={22} color={colors.primary} />
            <View style={styles.infoText}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Name</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{displayName}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MaterialIcons name="mail-outline" size={22} color={colors.primary} />
            <View style={styles.infoText}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Email</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MaterialIcons name="phone" size={22} color={colors.primary} />
            <View style={styles.infoText}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Phone</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{phone}</Text>
            </View>
          </View>
        </AppCard>

        {/* Security Card */}
        <AppCard mode="elevated">
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Security</Text>

          <View style={[styles.innerItem, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <MaterialIcons name="fingerprint" size={26} color={colors.primary} />
            <View style={styles.innerItemText}>
              <Text style={[styles.innerTitle, { color: colors.textPrimary }]}>Biometric lock</Text>
            </View>
            <Switch
              value={settings.biometricEnabled}
              onValueChange={async (value) => {
                try {
                  if (!value) {
                    await updateSettings({ biometricEnabled: false });
                    return;
                  }

                  const hasHardware = await LocalAuthentication.hasHardwareAsync();
                  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                  if (!hasHardware || !isEnrolled) {
                    return;
                  }

                  const auth = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Enable biometric lock',
                    fallbackLabel: 'Use passcode',
                  });
                  if (!auth.success) {
                    return;
                  }

                  await updateSettings({ biometricEnabled: true });
                } catch {
                  await updateSettings({ biometricEnabled: !value }).catch(() => {});
                }
              }}
            />
          </View>

          <Pressable
            style={[styles.innerItem, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => setPwModalVisible(true)}
          >
            <MaterialIcons name="lock-outline" size={26} color={colors.primary} />
            <View style={styles.innerItemText}>
              <Text style={[styles.innerTitle, { color: colors.textPrimary }]}>Change password</Text>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Update your local app password</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
          </Pressable>
        </AppCard>

        {/* Preferences Card */}
        <AppCard mode="elevated">
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Preferences</Text>

          <View style={[styles.innerItem, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <MaterialIcons name="notifications-none" size={26} color={colors.primary} />
            <View style={styles.innerItemText}>
              <Text style={[styles.innerTitle, { color: colors.textPrimary }]}>Notifications</Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={async (value) => {
                try {
                  await updateSettings({ notificationsEnabled: value });
                } catch {
                  await updateSettings({ notificationsEnabled: !value }).catch(() => {});
                }
              }}
            />
          </View>

          <View style={styles.themeRowContainer}>
            <Text style={[styles.innerTitle, { color: colors.textPrimary }]}>Theme mode</Text>
            <View style={styles.themeRow}>
              {(['system', 'light', 'dark'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  style={[
                    styles.themeButton,
                    { borderColor: colors.border },
                    settings.themeMode === mode && [
                      styles.themeButtonActive,
                      { backgroundColor: colors.primary + '22', borderColor: colors.primary },
                    ],
                  ]}
                  onPress={() => updateSettings({ themeMode: mode })}
                >
                  <Text
                    style={[
                      styles.themeText,
                      { color: colors.textSecondary },
                      settings.themeMode === mode && [styles.themeTextActive, { color: colors.primary }],
                    ]}
                  >
                    {mode}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </AppCard>

        {/* Cloud Sync Card */}
        <AppCard mode="elevated">
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Cloud Sync</Text>

          <Pressable style={[styles.innerItem, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={handleBackup}>
            <MaterialIcons name="cloud-upload" size={26} color={colors.primary} />
            <View style={styles.innerItemText}>
              <Text style={[styles.innerTitle, { color: colors.textPrimary }]}>Backup to cloud</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.innerItem, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={handleRestore}>
            <MaterialIcons name="cloud-download" size={26} color={colors.primary} />
            <View style={styles.innerItemText}>
              <Text style={[styles.innerTitle, { color: colors.textPrimary }]}>Restore from cloud</Text>
            </View>
          </Pressable>

          {syncStatus ? (
            <Text style={[styles.syncStatus, { color: colors.textSecondary }]}>{syncStatus}</Text>
          ) : null}
        </AppCard>

        {/* App Info Card */}
        <AppCard mode="elevated">
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>App Info</Text>
          <Text style={[styles.appInfoLabel, { color: colors.textSecondary }]}>LifeOS RN</Text>
          <Text style={[styles.appInfoValue, { color: colors.textPrimary }]}>Version {appVersion}</Text>
        </AppCard>

        {/* Sign Out Button */}
        <Pressable style={[styles.signOutButton, { backgroundColor: '#4A1720' }]} onPress={signOut}>
          <MaterialIcons name="logout" size={22} color="#FF756B" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={pwModalVisible} transparent animationType="fade" onRequestClose={() => setPwModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPwModalVisible(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Change Password</Text>
            <View style={styles.modalInputs}>
              <TextInput
                value={currentPw}
                onChangeText={setCurrentPw}
                placeholder="Current Password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                style={[styles.modalInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
              />
              <TextInput
                value={newPw}
                onChangeText={setNewPw}
                placeholder="New Password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                style={[styles.modalInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
              />
              <TextInput
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder="Confirm Password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                style={[styles.modalInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPwModalVisible(false)}>
                <Text style={[styles.modalActionText, { color: colors.primary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (newPw !== confirmPw) {
                    return;
                  }
                  setPwModalVisible(false);
                  setCurrentPw('');
                  setNewPw('');
                  setConfirmPw('');
                }}
              >
                <Text style={[styles.modalActionText, { color: colors.primary }]}>Update</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </PageScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 220 },
  identityCard: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...LifeOSTypography.displayLarge, fontWeight: '700' },
  displayName: { ...LifeOSTypography.headlineMedium },
  emailText: { ...LifeOSTypography.bodyMedium },
  changePhotoText: { ...LifeOSTypography.labelLarge, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: { ...LifeOSTypography.headlineMedium },
  editText: { ...LifeOSTypography.labelLarge, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  infoText: { flex: 1 },
  infoLabel: { ...LifeOSTypography.bodySmall },
  infoValue: { ...LifeOSTypography.headlineSmall },
  editRow: { gap: 8, marginTop: 8 },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...LifeOSTypography.bodyLarge,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  editActionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editActionText: { ...LifeOSTypography.labelMedium },
  innerItem: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  innerItemText: { flex: 1, gap: 1 },
  innerTitle: { ...LifeOSTypography.headlineSmall },
  themeRowContainer: { marginTop: 6, gap: 8 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  themeButtonActive: {},
  themeText: { ...LifeOSTypography.labelMedium, textTransform: 'capitalize' },
  themeTextActive: {},
  syncStatus: { ...LifeOSTypography.bodySmall, marginTop: 4, textAlign: 'center' },
  appInfoLabel: { ...LifeOSTypography.bodyMedium, marginTop: 4 },
  appInfoValue: { ...LifeOSTypography.titleMedium, marginTop: 2 },
  signOutButton: {
    borderRadius: 14,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  signOutText: { ...LifeOSTypography.headlineSmall, color: '#FF756B' },
  activeSinceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  activeSinceText: { ...LifeOSTypography.bodySmall },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalSheet: {
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 340,
    gap: 16,
  },
  modalTitle: { ...LifeOSTypography.headlineMedium },
  modalInputs: { gap: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...LifeOSTypography.bodyLarge,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
    marginTop: 4,
  },
  modalActionText: { ...LifeOSTypography.labelLarge, fontWeight: '600' },
});
