import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { theme } from '../theme';
import { fetchBuilding } from '../api';
import { getItem, setItem, StorageKeys } from '../storage';
import { BuildingData } from '../building';

const CURRENT_PC_IP = '172.26.49.42';

function getDefaultServerUrl(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
      }
      return `http://${window.location.hostname}:3000`;
    }
    return 'http://localhost:3000';
  }
  return `http://${CURRENT_PC_IP}:3000`;
}

interface Props {
  onConnected: (building: BuildingData, serverUrl: string, deviceToken: string) => void;
}

export function ConnectScreen({ onConnected }: Props) {
  const [serverUrl, setServerUrl] = useState(getDefaultServerUrl);
  const [deviceToken, setDeviceToken] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [verifiedBuilding, setVerifiedBuilding] = useState<BuildingData | null>(null);

  useEffect(() => {
    async function loadSaved() {
      const savedUrl = await getItem(StorageKeys.SERVER_URL);
      const savedToken = await getItem(StorageKeys.DEVICE_TOKEN);
      if (savedUrl && !savedUrl.includes('10.0.2.2') && !savedUrl.includes('10.212.53.42')) {
        setServerUrl(savedUrl);
      } else {
        setServerUrl(getDefaultServerUrl());
      }
      if (savedToken) setDeviceToken(savedToken);
    }
    void loadSaved();
  }, []);

  const handleTestConnection = async () => {
    if (!serverUrl.trim()) {
      setStatusMessage('Please enter a server URL.');
      setIsSuccess(false);
      return;
    }

    if (serverUrl.includes('10.0.2.2') || serverUrl.includes('10.212.53.42')) {
      const suggestion = getDefaultServerUrl();
      setStatusMessage(`Please use your current server address: ${suggestion}`);
      setIsSuccess(false);
      return;
    }

    setLoading(true);
    setStatusMessage('Connecting to server...');
    setIsSuccess(false);

    try {
      const clean = serverUrl.trim().replace(/\/+$/, '');
      const building = await fetchBuilding(clean);

      const floorCount = building.floors || 0;
      const apCount = building.aps?.length || 0;

      // Save credentials securely
      await setItem(StorageKeys.SERVER_URL, clean);
      await setItem(StorageKeys.DEVICE_TOKEN, deviceToken.trim());

      setVerifiedBuilding(building);
      setIsSuccess(true);
      setStatusMessage(`Connected! Found ${floorCount} floors and ${apCount} access points.`);
    } catch (err: unknown) {
      setIsSuccess(false);
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setStatusMessage(`Connection failed: ${msg}. Make sure your PC and phone are on the same Wi-Fi.`);
      setVerifiedBuilding(null);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (verifiedBuilding) {
      onConnected(verifiedBuilding, serverUrl.trim().replace(/\/+$/, ''), deviceToken.trim());
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>E</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>EMBER</Text>
            <Text style={styles.brandSubtitle}>RESPONDER SOS</Text>
          </View>
        </View>

        <Text style={styles.welcomeText}>Connect to Command Station</Text>
        <Text style={styles.infoText}>
          Enter the Ember server address. For your phone, use your PC Wi-Fi IP address.
        </Text>

        {/* Server URL Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder={getDefaultServerUrl()}
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <TouchableOpacity
              style={styles.quickIpButton}
              onPress={() => setServerUrl(`http://${CURRENT_PC_IP}:3000`)}
            >
              <Text style={styles.quickIpText}>👉 Use PC IP: http://{CURRENT_PC_IP}:3000</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={styles.quickIpButton}
                onPress={() => setServerUrl('http://localhost:3000')}
              >
                <Text style={styles.quickIpText}>👉 Use Localhost: http://localhost:3000</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Device Token Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Device Token (DEVICE_TOKEN)</Text>
          <TextInput
            style={styles.input}
            value={deviceToken}
            onChangeText={setDeviceToken}
            placeholder="e.g. demo123"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Test Connection Button */}
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleTestConnection}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.text} />
          ) : (
            <Text style={styles.primaryButtonText}>Test Connection</Text>
          )}
        </TouchableOpacity>

        {/* Status result */}
        {statusMessage && (
          <View style={[styles.statusBox, isSuccess ? styles.statusSuccess : styles.statusError]}>
            <Text style={[styles.statusText, isSuccess ? styles.statusTextSuccess : styles.statusTextError]}>
              {statusMessage}
            </Text>
          </View>
        )}

        {/* Continue Button */}
        {isSuccess && verifiedBuilding && (
          <TouchableOpacity
            style={[styles.button, styles.continueButton]}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue to Device Enrollment →</Text>
          </TouchableOpacity>
        )}

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            Classroom demo prototype. Not a certified life-safety device.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scroll: {
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.xxl + 20,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  brandMark: {
    width: 44,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandMarkText: {
    color: '#10151b',
    fontSize: 30,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.muted,
    letterSpacing: 1.2,
  },
  welcomeText: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.muted,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.panel,
    borderColor: theme.colors.line,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    minHeight: 50,
  },
  button: {
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: theme.spacing.sm,
  },
  primaryButton: {
    backgroundColor: theme.colors.panelElevated,
    borderColor: theme.colors.line,
    borderWidth: 1,
  },
  primaryButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statusBox: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  statusSuccess: {
    backgroundColor: 'rgba(139, 214, 190, 0.1)',
    borderColor: theme.colors.green,
  },
  statusError: {
    backgroundColor: 'rgba(255, 102, 94, 0.1)',
    borderColor: theme.colors.red,
  },
  statusText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  statusTextSuccess: {
    color: theme.colors.green,
  },
  statusTextError: {
    color: theme.colors.red,
  },
  continueButton: {
    backgroundColor: theme.colors.accent,
    marginTop: theme.spacing.lg,
  },
  continueButtonText: {
    color: '#10151b',
    fontSize: theme.fontSize.md,
    fontWeight: '800',
  },
  disclaimerBox: {
    marginTop: theme.spacing.xxl + 10,
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  quickIpButton: {
    marginTop: theme.spacing.xs,
    paddingVertical: 4,
  },
  quickIpText: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
});
