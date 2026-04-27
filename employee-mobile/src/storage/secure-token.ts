import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const webPrefix = 'almham_secure_';

export async function getSecureItem(key: string) {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(`${webPrefix}${key}`);
  }

  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(`${webPrefix}${key}`, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(`${webPrefix}${key}`);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
