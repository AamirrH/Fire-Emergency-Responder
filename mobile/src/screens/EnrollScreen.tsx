import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../theme';
import { claimDevice } from '../api';
import { setItem, StorageKeys } from '../storage';

const ROSTER_NAMES: Record<string, string> = {
  D001: 'Aarav Mehta',
  D002: 'Aisha Khan',
  D003: 'Alex Morgan',
  D004: 'Ananya Rao',
  D005: 'Arjun Patel',
  D006: 'Beatrice Lewis',
  D007: 'Carlos Mendes',
  D008: 'Chloe Martin',
  D009: 'Daniel Kim',
  D010: 'Diya Shah',
  D011: 'Elena Garcia',
  D012: 'Ethan Brooks',
  D013: 'Fatima Noor',
  D014: 'Grace Wilson',
  D015: 'Hannah Lee',
  D016: 'Ibrahim Ali',
  D017: 'Isla Turner',
  D018: 'Jack Carter',
  D019: 'Jaya Nair',
  D020: 'Jonas Weber',
  D021: 'Kavya Iyer',
  D022: 'Leo Thompson',
  D023: 'Liam Chen',
  D024: 'Maya Singh',
  D025: 'Mia Johnson',
  D026: 'Nikhil Das',
  D027: 'Noah Williams',
  D028: 'Olivia Brown',
  D029: 'Omar Haddad',
  D030: 'Priya Kapoor',
  D031: 'Ravi Menon',
  D032: 'Riya Bose',
  D033: 'Sam Taylor',
  D034: 'Sara Rossi',
  D035: 'Sofia Martinez',
  D036: 'Theo Evans',
};

// STRICT RULE: Only D001 - D036; NEVER D037 - D040
const ROSTER_DEVICES = Array.from({ length: 36 }, (_, i) => {
  const id = `D${String(i + 1).padStart(3, '0')}`;
  return { id, name: ROSTER_NAMES[id] || `Occupant ${i + 1}` };
});

interface Props {
  serverUrl: string;
  deviceToken: string;
  onEnrolled: (deviceId: string) => void;
  onBackToConnect?: () => void;
}

export function EnrollScreen({ serverUrl, deviceToken, onEnrolled, onBackToConnect }: Props) {
  const [search, setSearch] = useState('');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollStepText, setEnrollStepText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filtered = ROSTER_DEVICES.filter(
    d => d.id.toLowerCase().includes(search.toLowerCase()) ||
         d.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectDevice = async (deviceId: string) => {
    setEnrollingId(deviceId);
    setErrorMessage(null);
    setEnrollStepText(`Logging in... linking to device ${deviceId}`);

    try {
      // Simulate authenticating/linking handshake step from design
      await new Promise(r => setTimeout(r, 600));

      // Call backend claim endpoint
      await claimDevice(serverUrl, deviceToken, deviceId);

      // Save choice securely
      await setItem(StorageKeys.CLAIMED_DEVICE, deviceId);

      setEnrollStepText(`Linked! Handing control to phone.`);
      await new Promise(r => setTimeout(r, 400));

      onEnrolled(deviceId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Enrollment failed';
      setErrorMessage(`Enrollment failed: ${msg}`);
      setEnrollingId(null);
      setEnrollStepText(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Enroll Device</Text>
          {onBackToConnect && (
            <TouchableOpacity onPress={onBackToConnect}>
              <Text style={styles.changeServerText}>Change Server</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.subtitle}>
          Select your assigned roster identity (D001–D036). The simulator will stop generating mock heartbeats for this ID.
        </Text>

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by ID (e.g. D005) or name..."
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Progress banner during claim */}
      {enrollStepText && (
        <View style={styles.progressBox}>
          <ActivityIndicator color={theme.colors.accent} size="small" />
          <Text style={styles.progressText}>{enrollStepText}</Text>
        </View>
      )}

      {/* Error message */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isSelected = enrollingId === item.id;
          return (
            <TouchableOpacity
              style={[styles.deviceCard, isSelected && styles.deviceCardActive]}
              onPress={() => handleSelectDevice(item.id)}
              disabled={enrollingId !== null}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.id}</Text>
              </View>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{item.name}</Text>
                <Text style={styles.deviceMeta}>Roster Handset • Available</Text>
              </View>
              {isSelected ? (
                <ActivityIndicator color={theme.colors.accent} />
              ) : (
                <Text style={styles.claimArrow}>→</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  changeServerText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.blue,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  progressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: 'rgba(255, 102, 94, 0.15)',
    borderBottomWidth: 1,
    borderColor: theme.colors.accent,
    padding: theme.spacing.md,
  },
  progressText: {
    color: theme.colors.accent,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 102, 94, 0.1)',
    borderColor: theme.colors.red,
    borderWidth: 1,
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  errorText: {
    color: theme.colors.red,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  list: {
    padding: theme.spacing.md,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  deviceCardActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.panelElevated,
  },
  badge: {
    backgroundColor: theme.colors.panelHighlight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
    marginRight: theme.spacing.md,
  },
  badgeText: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  deviceMeta: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  claimArrow: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
});
