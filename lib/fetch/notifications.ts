import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { apiUrl } from './constants';

// Storage keys
const TOKEN_REGISTERED_KEY = 'push_token_registered';
const DEVICE_ID_KEY = 'device_unique_id';

const getDeviceId = async (): Promise<string> => {
  try {
    const savedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (savedDeviceId) {
      return savedDeviceId;
    }
    
    const newDeviceId = `${Device.manufacturer || ''}-${Device.modelName || ''}-${Device.modelId || ''}-${Date.now()}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, newDeviceId);
    return newDeviceId;
  } catch {
    return `${Device.manufacturer || ''}-${Device.modelName || ''}-${Device.modelId || ''}-${Date.now()}`;
  }
};

export const registerPushTokenWithServer = async (pushToken: string, tokenType: 'expo' | 'fcm' = 'fcm') => {
  try {
    const tokenRegistered = await AsyncStorage.getItem(TOKEN_REGISTERED_KEY);
    if (tokenRegistered === pushToken) {
      console.log(`${tokenType.toUpperCase()} push token already registered`);
      return true;
    }
    
    const deviceId = await getDeviceId();
    
    const response = await fetch(`${apiUrl}/esp32/door/register-push-token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pushToken,
        deviceId,
        tokenType, // Add token type to distinguish between Expo and FCM
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      await AsyncStorage.setItem(TOKEN_REGISTERED_KEY, pushToken);
    }
    
    console.log(`${tokenType.toUpperCase()} token registration result:`, result);
    return result.success;
  } catch (error) {
    console.error(`Failed to register ${tokenType.toUpperCase()} push token with server:`, error);
    return false;
  }
};