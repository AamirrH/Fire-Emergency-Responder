import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { theme } from './src/theme';
import { BuildingData } from './src/building';
import { getItem, setItem, deleteItem, StorageKeys } from './src/storage';
import { fetchBuilding } from './src/api';
import { liveSocket } from './src/socket';
import { heartbeatEngine } from './src/heartbeat';

// Screens
import { ConnectScreen } from './src/screens/ConnectScreen';
import { EnrollScreen } from './src/screens/EnrollScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MoveScreen } from './src/screens/MoveScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

type AppStep = 'loading' | 'connect' | 'enroll' | 'main';
type MainTab = 'home' | 'move' | 'settings';

export default function App() {
  // Keep the device awake while foregrounded
  useKeepAwake();

  const [step, setStep] = useState<AppStep>('loading');
  const [activeTab, setActiveTab] = useState<MainTab>('home');

  const [serverUrl, setServerUrl] = useState<string>('');
  const [deviceToken, setDeviceToken] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [building, setBuilding] = useState<BuildingData | null>(null);

  // Auto-restore previous session
  useEffect(() => {
    async function restoreSession() {
      try {
        const savedUrl = await getItem(StorageKeys.SERVER_URL);
        const savedToken = await getItem(StorageKeys.DEVICE_TOKEN);
        const savedDevice = await getItem(StorageKeys.CLAIMED_DEVICE);

        if (savedUrl && savedToken) {
          setServerUrl(savedUrl);
          setDeviceToken(savedToken);

          const bData = await fetchBuilding(savedUrl);
          setBuilding(bData);

          if (savedDevice) {
            setDeviceId(savedDevice);
            // Start heartbeat & socket
            heartbeatEngine.configure(savedUrl, savedToken, savedDevice, bData);
            heartbeatEngine.start();
            liveSocket.connect(savedUrl, savedDevice);
            setStep('main');
            return;
          } else {
            setStep('enroll');
            return;
          }
        }
      } catch {
        // Fallback to connect screen on any load error
      }
      setStep('connect');
    }

    void restoreSession();
  }, []);

  // When connection test passes on ConnectScreen
  const handleConnected = (bData: BuildingData, url: string, token: string) => {
    setBuilding(bData);
    setServerUrl(url);
    setDeviceToken(token);
    setStep('enroll');
  };

  // When device is chosen and claimed on EnrollScreen
  const handleEnrolled = (claimedId: string) => {
    setDeviceId(claimedId);
    if (building) {
      heartbeatEngine.configure(serverUrl, deviceToken, claimedId, building);
      heartbeatEngine.start();
      liveSocket.connect(serverUrl, claimedId);
    }
    setStep('main');
    setActiveTab('home');
  };

  // When device is released on SettingsScreen
  const handleDeviceReleased = () => {
    heartbeatEngine.stop();
    liveSocket.disconnect();
    setDeviceId('');
    setStep('enroll');
  };

  // When user wants to change server URL
  const handleResetConnection = async () => {
    heartbeatEngine.stop();
    liveSocket.disconnect();
    await deleteItem(StorageKeys.CLAIMED_DEVICE);
    setDeviceId('');
    setStep('connect');
  };

  if (step === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>E</Text>
        </View>
        <ActivityIndicator color={theme.colors.accent} size="large" style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Initializing Ember Responder SOS...</Text>
      </View>
    );
  }

  if (step === 'connect') {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />
        <ConnectScreen onConnected={handleConnected} />
      </SafeAreaView>
    );
  }

  if (step === 'enroll') {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />
        <EnrollScreen
          serverUrl={serverUrl}
          deviceToken={deviceToken}
          onEnrolled={handleEnrolled}
          onBackToConnect={() => setStep('connect')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />
      <View style={styles.mainContainer}>
        {/* Screen Content */}
        <View style={styles.screenArea}>
          {activeTab === 'home' && building && (
            <HomeScreen
              serverUrl={serverUrl}
              deviceToken={deviceToken}
              deviceId={deviceId}
              building={building}
            />
          )}
          {activeTab === 'move' && building && (
            <MoveScreen building={building} />
          )}
          {activeTab === 'settings' && building && (
            <SettingsScreen
              serverUrl={serverUrl}
              deviceToken={deviceToken}
              deviceId={deviceId}
              building={building}
              onDeviceReleased={handleDeviceReleased}
              onResetConnection={handleResetConnection}
            />
          )}
        </View>

        {/* Bottom Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'home' && styles.tabItemActive]}
            onPress={() => setActiveTab('home')}
          >
            <Text style={[styles.tabIcon, activeTab === 'home' && styles.tabIconActive]}>
              🚨
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>
              Status & SOS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'move' && styles.tabItemActive]}
            onPress={() => setActiveTab('move')}
          >
            <Text style={[styles.tabIcon, activeTab === 'move' && styles.tabIconActive]}>
              📍
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'move' && styles.tabLabelActive]}>
              Move Demo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
            onPress={() => setActiveTab('settings')}
          >
            <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabIconActive]}>
              ⚙
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandMark: {
    width: 60,
    height: 64,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandMarkText: {
    color: '#10151b',
    fontSize: 42,
    fontWeight: '900',
  },
  loadingText: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.md,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  screenArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 65,
    backgroundColor: theme.colors.panel,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: theme.colors.accent,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  tabLabelActive: {
    color: theme.colors.text,
    fontWeight: '800',
  },
});
