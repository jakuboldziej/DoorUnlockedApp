import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { AndroidImportance, getExpoPushTokenAsync, getPermissionsAsync, requestPermissionsAsync, SchedulableTriggerInputTypes, scheduleNotificationAsync, setNotificationCategoryAsync, setNotificationChannelAsync } from "expo-notifications";
import { Platform } from "react-native";
import { registerPushTokenWithServer } from './fetch/notifications';

export const schedulePushNotification = async (title: string, body: string, data: Record<string, unknown>) => {
  try {
    const result = await scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });
  } catch (err) {
    console.error('Failed to schedule notification:', err);
  }
}

export const sendPushNotification = async (expoPushToken: string, title: string, body: string, data?: Record<string, unknown>) => {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

export const registerForPushNotificationsAsync = async () =>  {
  let token;

  if (Platform.OS === 'android') {
      await setNotificationChannelAsync('myNotificationChannel', {
        name: 'Odblokuj drzwi',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500, 500, 1000],
        lightColor: '#FF231F7C',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: 1,
        bypassDnd: true,
      });
  }

  await setNotificationCategoryAsync('chore_notification', [
    {
      identifier: 'view_chore',
      buttonTitle: 'Zobacz',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);

  if (Device.isDevice) {
    const { status: existingStatus } = await getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Zezwól aplikacji na wysyłanie powiadomień!');
      return;
    }
    
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        throw new Error('Project ID not found');
      }
      token = (
        await getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      
      if (token) {
        await registerPushTokenWithServer(token);
      }
    } catch (e) {
      token = `${e}`;
      console.error('Error getting Expo push token:', e);
    }
  } else {
    alert('Must use physical device for Push Notifications');
    console.warn('Push notifications require a physical device.');
  }

  return token;
}