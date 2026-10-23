import * as SecureStore from 'expo-secure-store';

const memoryFallback = new Map<string, string>();

async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (await isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
  } catch {
    // fallback to memory
  }
  memoryFallback.set(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  try {
    if (await isSecureStoreAvailable()) {
      return await SecureStore.getItemAsync(key);
    }
  } catch {
    // fallback to memory
  }
  return memoryFallback.get(key) ?? null;
}

export async function deleteItem(key: string): Promise<void> {
  try {
    if (await isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
  } catch {
    // fallback to memory
  }
  memoryFallback.delete(key);
}

export const StorageKeys = {
  SERVER_URL: 'ember_server_url',
  DEVICE_TOKEN: 'ember_device_token',
  CLAIMED_DEVICE: 'ember_claimed_device',
  SENSOR_MODE: 'ember_sensor_mode',
  BAROMETER_OFFSET: 'ember_baro_offset',
  VIRTUAL_POS: 'ember_virtual_pos',
};
