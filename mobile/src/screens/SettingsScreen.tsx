import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Barometer } from 'expo-sensors';
import { theme } from '../theme';
import { releaseDevice } from '../api';
import { deleteItem, setItem, StorageKeys } from '../storage';
import { heartbeatEngine, HeartbeatState, SensorMode } from '../heartbeat';
import { extractPhysicsParams, computeFloor1Offset } from '../sensors';
import { BuildingData } from '../building';

interface Props {
  serverUrl: string;
  deviceToken: string;
  deviceId: string;
  building: BuildingData;
  onDeviceReleased: () => void;
  onResetConnection: () => void;
}

export function SettingsScreen({
  serverUrl,
  deviceToken,
  deviceId,
  building,
  onDeviceReleased,
  onResetConnection,
}: Props) {
  const [heartbeatState, setHeartbeatState] = useState<HeartbeatState>(heartbeatEngine.getState());
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationSuccess, setCalibrationSuccess] = useState<string | null>(null);

  useEffect(() => {
    const unsub = heartbeatEngine.subscribe(state => {
      setHeartbeatState(state);
    });
    return unsub;
  }, []);

  const handleToggleMode = (useBarometer: boolean) => {
    const mode: SensorMode = useBarometer ? 'barometer' : 'simulated';
    heartbeatEngine.setSensorMode(mode);
    void setItem(StorageKeys.SENSOR_MODE, mode);
  };

  const handleCalibrateBarometer = async () => {
    setCalibrating(true);
    setCalibrationSuccess(null);
    try {
      const isAvail = await Barometer.isAvailableAsync();
      if (!isAvail) {
        setCalibrationSuccess('Hardware Barometer sensor unavailable on this device.');
        setCalibrating(false);
        return;
      }

      // Read single reading
      const reading = await new Promise<{ pressure: number }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Sensor timeout')), 3000);
        const sub = Barometer.addListener(data => {
          clearTimeout(timeout);
          sub.remove();
          resolve(data);
        });
      });

      const physics = extractPhysicsParams(building);
      const offsetPa = computeFloor1Offset(reading.pressure, physics);
      heartbeatEngine.setBarometerOffset(offsetPa);
      await setItem(StorageKeys.BAROMETER_OFFSET, String(offsetPa));

      setCalibrationSuccess(
        `Calibrated! Ambient: ${reading.pressure.toFixed(2)} hPa. Offset: ${offsetPa.toFixed(1)} Pa.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Calibration failed';
      setCalibrationSuccess(`Calibration failed: ${msg}`);
    } finally {
      setCalibrating(false);
    }
  };

  const handleToggleSilence = () => {
    const next = !heartbeatState.isSilent;
    heartbeatEngine.setSilent(next);
  };

  const handleRelease = async () => {
    setReleasing(true);
    setReleaseError(null);
    try {
      await releaseDevice(serverUrl, deviceToken, deviceId);
      await deleteItem(StorageKeys.CLAIMED_DEVICE);
      heartbeatEngine.stop();
      onDeviceReleased();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Release failed';
      setReleaseError(`Release failed: ${msg}`);
    } finally {
      setReleasing(false);
    }
  };

  const isBaro = heartbeatState.sensorMode === 'barometer';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings & About</Text>
      <Text style={styles.subtitle}>Ember Responder SOS Handset Configuration</Text>

      {/* Prominent Disclaimer Banner */}
      <View style={styles.disclaimerBanner}>
        <Text style={styles.disclaimerBadge}>CLASSROOM DEMO ONLY</Text>
        <Text style={styles.disclaimerText}>
          This software is an academic fire-emergency occupant localization prototype, NOT a certified life-safety application. Do not rely on it during actual emergencies.
        </Text>
      </View>

      {/* Sensor Mode Switch */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sensor Mode</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchLabelWrap}>
            <Text style={styles.switchTitle}>Real Hardware Barometer (Experimental)</Text>
            <Text style={styles.switchSubtitle}>
              {isBaro
                ? 'Reading device pressure sensor (hPa). RSSI remains simulated.'
                : 'Using pure physics model from virtual coordinates (recommended).'}
            </Text>
          </View>
          <Switch
            value={isBaro}
            onValueChange={handleToggleMode}
            trackColor={{ false: theme.colors.line, true: theme.colors.accent }}
            thumbColor="#ffffff"
          />
        </View>

        {isBaro && (
          <View style={styles.baroBox}>
            <Text style={styles.baroInfo}>
              ℹ Real device Wi-Fi RSSI scanning is restricted on mobile OSes (iOS blocks private APIs; Android heavily throttles background scans). Ambient barometric pressure can be read directly:
            </Text>
            <TouchableOpacity
              style={styles.calibBtn}
              onPress={handleCalibrateBarometer}
              disabled={calibrating}
            >
              {calibrating ? (
                <ActivityIndicator color={theme.colors.text} size="small" />
              ) : (
                <Text style={styles.calibBtnText}>📍 Calibrate here as Floor 1</Text>
              )}
            </TouchableOpacity>
            {calibrationSuccess && (
              <Text style={styles.calibResult}>{calibrationSuccess}</Text>
            )}
          </View>
        )}
      </View>

      {/* Heartbeat Configuration & Simulate Dying */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Heartbeat & Telemetry</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Transmission Interval</Text>
          <Text style={styles.infoVal}>{heartbeatState.heartbeatIntervalSec} seconds (from server)</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payload Schema</Text>
          <Text style={styles.infoVal}>&#123; device_id, raw_pressure, raw_rssi &#125;</Text>
        </View>

        {/* Simulate Phone Dying */}
        <TouchableOpacity
          style={[styles.actionBtn, heartbeatState.isSilent ? styles.resumeBtn : styles.silenceBtn]}
          onPress={handleToggleSilence}
        >
          <Text style={styles.actionBtnText}>
            {heartbeatState.isSilent
              ? '▶ Resume Heartbeats'
              : '⚡ Simulate Phone Dying (Stop Heartbeats)'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.noteText}>
          {heartbeatState.isSilent
            ? 'Phone is silent. Dashboard will show "Signal Lost" after 8s silence timeout.'
            : 'Press to simulate sudden handset battery death or destruction. Last computed position freezes on command map.'}
        </Text>
      </View>

      {/* Handset Enrollment & Release */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Handset Enrollment</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Claimed Identity</Text>
          <Text style={styles.infoVal}>{deviceId}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Command Station</Text>
          <Text style={styles.infoVal}>{serverUrl}</Text>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, styles.releaseBtn]}
          onPress={handleRelease}
          disabled={releasing}
        >
          {releasing ? (
            <ActivityIndicator color={theme.colors.text} size="small" />
          ) : (
            <Text style={styles.actionBtnText}>Release Handset Back to Simulator</Text>
          )}
        </TouchableOpacity>

        {releaseError && <Text style={styles.errorText}>{releaseError}</Text>}

        <TouchableOpacity
          style={[styles.actionBtn, styles.changeServerBtn]}
          onPress={onResetConnection}
        >
          <Text style={styles.changeServerText}>Change Server Connection</Text>
        </TouchableOpacity>
      </View>

      {/* Architectural Background Note */}
      <View style={styles.archBox}>
        <Text style={styles.archTitle}>Background Service Architecture Note</Text>
        <Text style={styles.archText}>
          Screen keep-awake is active while foregrounded. True background operation in an emergency responder handset requires an Android Foreground Service with continuous wake lock, which requires a custom development build rather than Expo Go. iOS restricts Wi-Fi RSSI access and background sensor sampling.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + 10,
    paddingBottom: theme.spacing.xxl * 2,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginBottom: theme.spacing.lg,
  },
  disclaimerBanner: {
    backgroundColor: 'rgba(255, 102, 94, 0.12)',
    borderWidth: 1,
    borderColor: theme.colors.red,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  disclaimerBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.red,
    letterSpacing: 1,
    marginBottom: 4,
  },
  disclaimerText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    lineHeight: 18,
  },
  section: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  switchLabelWrap: {
    flex: 1,
  },
  switchTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
  },
  switchSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    marginTop: 2,
  },
  baroBox: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
  },
  baroInfo: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    lineHeight: 16,
    marginBottom: theme.spacing.sm,
  },
  calibBtn: {
    backgroundColor: theme.colors.panelHighlight,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  calibBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
  },
  calibResult: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.green,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  infoLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  infoVal: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  actionBtn: {
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  actionBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
  },
  silenceBtn: {
    backgroundColor: '#382226',
    borderWidth: 1,
    borderColor: theme.colors.amber,
  },
  resumeBtn: {
    backgroundColor: '#1b3229',
    borderWidth: 1,
    borderColor: theme.colors.green,
  },
  releaseBtn: {
    backgroundColor: theme.colors.panelHighlight,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  changeServerBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.line,
    marginTop: theme.spacing.sm,
  },
  changeServerText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.blue,
  },
  noteText: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
    lineHeight: 16,
  },
  errorText: {
    color: theme.colors.red,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing.xs,
  },
  archBox: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.panelElevated,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  archTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  archText: {
    fontSize: 11,
    color: theme.colors.muted,
    lineHeight: 16,
  },
});
