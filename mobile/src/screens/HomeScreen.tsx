import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { sendSos, cancelSos, DeviceStatusResponse } from '../api';
import { liveSocket } from '../socket';
import { heartbeatEngine, HeartbeatState } from '../heartbeat';
import { getRoomAt, BuildingData } from '../building';

interface Props {
  serverUrl: string;
  deviceToken: string;
  deviceId: string;
  building: BuildingData;
}

export function HomeScreen({ serverUrl, deviceToken, deviceId, building }: Props) {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatusResponse | null>(null);
  const [heartbeatState, setHeartbeatState] = useState<HeartbeatState>(heartbeatEngine.getState());
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  // SOS Countdown state
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const [isSosSent, setIsSosSent] = useState(false);
  const [sosError, setSosError] = useState<string | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for active SOS
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Subscribe to Socket.IO status updates
  useEffect(() => {
    const unsub = liveSocket.subscribeStatus(status => {
      setDeviceStatus(status);
      if (status?.status === 'active_sos') {
        setIsSosSent(true);
      } else if (status?.status === 'active' || status?.status === 'safe') {
        setIsSosSent(false);
      }
    });
    return unsub;
  }, []);

  // Subscribe to heartbeat engine state
  useEffect(() => {
    const unsub = heartbeatEngine.subscribe(state => {
      setHeartbeatState(state);
    });
    return unsub;
  }, []);

  // Ticking seconds-ago counter
  useEffect(() => {
    const interval = setInterval(() => {
      if (heartbeatState.lastSentTimestamp) {
        const diff = Math.max(0, Math.floor((Date.now() - heartbeatState.lastSentTimestamp) / 1000));
        setSecondsAgo(diff);
      } else {
        setSecondsAgo(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [heartbeatState.lastSentTimestamp]);

  // SOS Pulse animation
  useEffect(() => {
    if (isSosSent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSosSent]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const handleSosPress = async () => {
    if (isSosSent) return; // Already triggered

    // Haptic feedback
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Haptics not supported on platform
    }

    // Start 5-second accidental tap countdown
    setSosError(null);
    setSosCountdown(5);

    let remaining = 5;
    countdownTimerRef.current = setInterval(async () => {
      remaining -= 1;
      if (remaining > 0) {
        setSosCountdown(remaining);
      } else {
        // Countdown reached 0: dispatch SOS to server
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setSosCountdown(null);
        await dispatchSos();
      }
    }, 1000);
  };

  const handleCancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setSosCountdown(null);
  };

  const dispatchSos = async () => {
    try {
      await sendSos(serverUrl, deviceToken, deviceId);
      setIsSosSent(true);
      setSosError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SOS failed';
      setSosError(msg);
    }
  };

  const handleCancelSentSos = async () => {
    try {
      await cancelSos(serverUrl, deviceToken, deviceId);
      setIsSosSent(false);
      setSosError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancel SOS failed';
      setSosError(msg);
    }
  };

  // Strongest 3 APs
  const topAps = Object.entries(heartbeatState.lastRssi || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const roomName = getRoomAt(
    deviceStatus?.x ?? null,
    deviceStatus?.y ?? null,
    deviceStatus?.floor ?? null,
    building
  );

  const currentStatus = deviceStatus?.status || 'unaccounted';
  const statusColor = theme.statusColors[currentStatus] || theme.colors.muted;
  const statusLabel = theme.statusLabels[currentStatus] || currentStatus.toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Foreground Service Notice & Connection Header */}
      <View style={styles.topHeader}>
        <View style={styles.systemActiveRow}>
          <View style={styles.greenDot} />
          <Text style={styles.systemActiveText}>Fire Safety System: Active</Text>
        </View>

        <View style={[
          styles.connBadge,
          heartbeatState.isOffline ? styles.connBadgeOffline : styles.connBadgeOnline,
        ]}>
          <Text style={[
            styles.connBadgeText,
            heartbeatState.isOffline ? styles.connBadgeTextOffline : styles.connBadgeTextOnline,
          ]}>
            {heartbeatState.isOffline ? 'Offline (retrying)' : 'WiFi'}
          </Text>
        </View>
      </View>

      {/* Main SOS Section */}
      <View style={styles.sosSection}>
        {sosCountdown !== null ? (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownNumber}>{sosCountdown}</Text>
            <Text style={styles.countdownTitle}>Sending SOS in {sosCountdown}s...</Text>
            <TouchableOpacity
              style={styles.cancelTapButton}
              onPress={handleCancelCountdown}
            >
              <Text style={styles.cancelTapText}>Cancel (accidental tap)</Text>
            </TouchableOpacity>
          </View>
        ) : isSosSent ? (
          <Animated.View style={[styles.sosActiveBox, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.sosSentTitle}>🚨 SOS SENT</Text>
            <Text style={styles.sosSentSubtitle}>Help is on the way</Text>
            <TouchableOpacity
              style={styles.cancelGraceButton}
              onPress={handleCancelSentSos}
            >
              <Text style={styles.cancelGraceText}>Cancel SOS (False Alarm)</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.sosButtonWrap}>
            <TouchableOpacity
              style={styles.sosButton}
              onPress={handleSosPress}
              activeOpacity={0.8}
            >
              <Text style={styles.sosButtonText}>SOS</Text>
              <Text style={styles.sosButtonHint}>PRESS FOR HELP</Text>
            </TouchableOpacity>
          </View>
        )}

        {sosError && (
          <Text style={styles.sosErrorText}>{sosError}</Text>
        )}
      </View>

      {/* Live Heartbeat Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Live Sensor Heartbeat</Text>
          <Text style={styles.cardBadge}>RAW SENSORS ONLY</Text>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Raw Pressure</Text>
            <Text style={styles.metricValue}>
              {heartbeatState.lastPressure !== null ? `${heartbeatState.lastPressure} Pa` : 'Waiting...'}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Heartbeat Interval</Text>
            <Text style={styles.metricValue}>{heartbeatState.heartbeatIntervalSec} s</Text>
          </View>
        </View>

        {/* Strongest APs */}
        <Text style={styles.subHeading}>Strongest 3 APs (RSSI)</Text>
        <View style={styles.apPillsRow}>
          {topAps.length > 0 ? (
            topAps.map(([apId, rssi]) => (
              <View key={apId} style={styles.apPill}>
                <Text style={styles.apPillId}>{apId}</Text>
                <Text style={styles.apPillRssi}>{rssi} dBm</Text>
              </View>
            ))
          ) : (
            <Text style={styles.waitingText}>Scanning access points...</Text>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerInfo}>
            Last sent: {secondsAgo !== null ? `${secondsAgo}s ago` : 'None yet'}
          </Text>
          <Text style={styles.footerInfo}>
            Total sent: {heartbeatState.totalSentCount}
          </Text>
        </View>
      </View>

      {/* My Status Card (Backend Computed via /live Socket.IO) */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>My Computed Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Device & Occupant</Text>
            <Text style={styles.metricValue}>
              {deviceId} {deviceStatus?.name ? `• ${deviceStatus.name}` : ''}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Estimated Floor</Text>
            <Text style={[styles.metricValue, { color: theme.colors.green }]}>
              {deviceStatus?.floor ? `Floor ${deviceStatus.floor}` : 'Unknown'}
            </Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Room Location</Text>
            <Text style={styles.metricValue}>{roomName}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Grid Coordinates</Text>
            <Text style={styles.metricValue}>
              {deviceStatus?.x !== null && deviceStatus?.x !== undefined
                ? `x: ${deviceStatus.x}m, y: ${deviceStatus.y}m`
                : 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.matchDistanceBox}>
          <Text style={styles.matchDistanceLabel}>Signal Match Distance (Euclidean Residual)</Text>
          <Text style={styles.matchDistanceValue}>
            {deviceStatus?.match_distance_db !== null && deviceStatus?.match_distance_db !== undefined
              ? `${Math.round(deviceStatus.match_distance_db * 10) / 10} dB`
              : 'N/A'}{' '}
            <Text style={styles.matchDistanceNote}>(lower is better, not a probability)</Text>
          </Text>
        </View>
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  systemActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.green,
  },
  systemActiveText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  connBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  connBadgeOnline: {
    backgroundColor: 'rgba(139, 214, 190, 0.1)',
    borderColor: theme.colors.green,
  },
  connBadgeOffline: {
    backgroundColor: 'rgba(255, 208, 120, 0.1)',
    borderColor: theme.colors.amber,
  },
  connBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  connBadgeTextOnline: {
    color: theme.colors.green,
  },
  connBadgeTextOffline: {
    color: theme.colors.amber,
  },
  sosSection: {
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  sosButtonWrap: {
    shadowColor: theme.colors.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  sosButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: theme.colors.red,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#ff8981',
  },
  sosButtonText: {
    color: '#10151b',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sosButtonHint: {
    color: '#10151b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  countdownContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.panel,
    borderWidth: 2,
    borderColor: theme.colors.red,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '100%',
  },
  countdownNumber: {
    fontSize: 54,
    fontWeight: '900',
    color: theme.colors.red,
  },
  countdownTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginVertical: theme.spacing.sm,
  },
  cancelTapButton: {
    backgroundColor: theme.colors.panelHighlight,
    borderColor: theme.colors.line,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
  },
  cancelTapText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  sosActiveBox: {
    backgroundColor: 'rgba(255, 102, 94, 0.15)',
    borderWidth: 2,
    borderColor: theme.colors.red,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  sosSentTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '900',
    color: theme.colors.red,
  },
  sosSentSubtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginTop: 4,
    marginBottom: theme.spacing.lg,
  },
  cancelGraceButton: {
    backgroundColor: '#382226',
    borderWidth: 1,
    borderColor: theme.colors.red,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  cancelGraceText: {
    color: theme.colors.red,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  sosErrorText: {
    color: theme.colors.red,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.text,
  },
  cardBadge: {
    fontSize: 10,
    color: theme.colors.muted,
    borderWidth: 1,
    borderColor: theme.colors.line,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  statusBadgeText: {
    color: '#10151b',
    fontWeight: '800',
    fontSize: theme.fontSize.xs,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: '700',
  },
  subHeading: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  apPillsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  apPill: {
    backgroundColor: theme.colors.panelElevated,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  apPillId: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.amber,
  },
  apPillRssi: {
    fontSize: 10,
    color: theme.colors.text,
  },
  waitingText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  footerInfo: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  matchDistanceBox: {
    backgroundColor: theme.colors.panelElevated,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
    marginTop: theme.spacing.xs,
  },
  matchDistanceLabel: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  matchDistanceValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 2,
  },
  matchDistanceNote: {
    fontSize: 10,
    fontWeight: '400',
    color: theme.colors.muted,
  },
});
