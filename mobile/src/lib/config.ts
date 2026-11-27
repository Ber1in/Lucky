import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_BASE_URL = "http://192.168.5.14:18080";
const STORAGE_KEY = "lucky.baseUrl";

let currentBaseUrl = DEFAULT_BASE_URL;

export function getBaseUrl(): string {
  return currentBaseUrl;
}

export async function loadBaseUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    currentBaseUrl = stored.replace(/\/+$/, "");
  }
  return currentBaseUrl;
}

export async function saveBaseUrl(value: string): Promise<string> {
  const normalized = value.trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
  currentBaseUrl = normalized;
  await AsyncStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
}
