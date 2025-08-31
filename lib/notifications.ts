import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { AndroidImportance, getExpoPushTokenAsync, getPermissionsAsync, requestPermissionsAsync, SchedulableTriggerInputTypes, scheduleNotificationAsync, setNotificationCategoryAsync, setNotificationChannelAsync } from "expo-notifications";
import { Platform } from "react-native";
import { registerPushTokenWithServer } from './fetch/notifications';

export const schedulePushNotification = async (
  title: string, 
  body: string, 
  data: Record<string, unknown>,
  isCritical: boolean = false
) => {
  try {
    const soundName = isCritical ? 'nuclear_alarm.mp3' : 'default';
    
    const result = await scheduleNotificationAsync({
      content: {
        title: isCritical ? `⚠️ ${title} ⚠️` : title,
        body,
        data: { ...data, critical: isCritical },
        sound: soundName,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
    
    if (isCritical) {
      await scheduleNotificationAsync({
        content: {
          title: `⚠️ ${title} ⚠️`,
          body,
          data: { ...data, critical: true, followUp: true },
          sound: soundName,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 4,
        },
      });
      
      await scheduleNotificationAsync({
        content: {
          title: `⚠️ UWAGA! ${title} ⚠️`,
          body: `${body} - Wymagana natychmiastowa uwaga!`,
          data: { ...data, critical: true, followUp: true },
          sound: soundName,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 8,
        },
      });
    }
    
    return result;
  } catch (err) {
    console.error('Failed to schedule notification:', err);
    return null;
  }
}

export const sendPushNotification = async (
  expoPushToken: string, 
  title: string, 
  body: string, 
  data?: Record<string, unknown>,
  isCritical: boolean = false
) => {
  const soundName = isCritical ? 'nuclear_alarm.mp3' : 'default';
  
  const message = {
    to: expoPushToken,
    sound: soundName,
    title: isCritical ? `⚠️ ${title} ⚠️` : title,
    body: body,
    data: { ...data, critical: isCritical },
    priority: 'high',
    badge: 1,
    channelId: isCritical ? 'criticalAlerts' : 'myNotificationChannel',
    _displayInForeground: true,
    ttl: 60 * 60 * 24, // 24 hours
    androidBigPicture: data?.imageUrl,
    androidBigText: body,
    androidStyle: {
      type: 'bigtext',
      text: body,
    },
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
    
    if (isCritical) {
      setTimeout(async () => {
        const followUpMessage = {
          ...message,
          title: `⚠️ UWAGA! ${title} ⚠️`,
          body: `${body} - Wymagana natychmiastowa uwaga!`,
          data: { ...data, critical: true, followUp: true },
          sound: soundName,
        };
        
        try {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(followUpMessage),
          });
        } catch (error) {
          console.error('Error sending follow-up push notification:', error);
        }
      }, 3000);
    }
    
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
        vibrationPattern: [0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000],
        lightColor: '#FF0000',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: 1,
        bypassDnd: true, 
      });
      
      await setNotificationChannelAsync('criticalAlerts', {
        name: 'Alarmy systemowe',
        description: 'Krytyczne powiadomienia o alarmach',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 1500, 500, 1500, 500, 1500, 500, 1500],
        lightColor: '#FF0000',
        sound: 'nuclear_alarm.mp3',
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