import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { registerPushTokenWithServer } from './fetch/notifications';

// Storage keys
const FCM_TOKEN_KEY = 'fcm_token';

/**
 * Request permission for notifications
 */
export const requestUserPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  return enabled;
};

/**
 * Get FCM token
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    // Check if we have cached token
    const cachedToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);
    
    // Get fresh token from Firebase
    const token = await messaging().getToken();
    
    if (token) {
      // Cache the token
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      
      // Register with server if token is new or different
      if (token !== cachedToken) {
        await registerPushTokenWithServer(token, 'fcm');
      }
      
      return token;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Initialize FCM
 */
export const initializeFCM = async (): Promise<void> => {
  try {
    // Request permission
    const hasPermission = await requestUserPermission();
    
    if (!hasPermission) {
      console.warn('FCM permission not granted');
      return;
    }

    // Get and register token
    await getFCMToken();

    // Listen for token refresh
    messaging().onTokenRefresh(async (token) => {
      console.log('FCM token refreshed:', token);
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      await registerPushTokenWithServer(token, 'fcm');
    });

    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Message handled in the background!', remoteMessage);
      
      // Handle critical notifications even in background
      if (remoteMessage.data?.critical === 'true' || remoteMessage.data?.alarm === 'true') {
        // You can schedule local notification here if needed
        console.log('Critical message received in background');
      }
    });

    console.log('FCM initialized successfully');
  } catch (error) {
    console.error('Error initializing FCM:', error);
  }
};

/**
 * Handle foreground messages
 */
export const setupForegroundMessageHandler = () => {
  return messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
    console.log('FCM message received in foreground:', remoteMessage);
    
    // You can handle the message here, show local notification, etc.
    if (remoteMessage.notification) {
      const { title, body } = remoteMessage.notification;
      const isCritical = remoteMessage.data?.critical === 'true' || remoteMessage.data?.alarm === 'true';
      
      console.log(`FCM Notification - Title: ${title}, Body: ${body}, Critical: ${isCritical}`);
      
      // Handle critical notifications specially
      if (isCritical) {
        // You can trigger alarm sound, vibration, etc.
        console.log('Critical FCM notification received!');
      }
    }
  });
};

/**
 * Handle notification opened app
 */
export const setupNotificationOpenedHandler = () => {
  // Handle notification when app is opened from background/quit state
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('Notification caused app to open from background state:', remoteMessage);
    
    // Navigate to specific screen based on notification data
    if (remoteMessage.data) {
      handleNotificationNavigation(remoteMessage.data);
    }
  });

  // Handle notification when app is opened from quit state
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('Notification caused app to open from quit state:', remoteMessage);
        
        if (remoteMessage.data) {
          handleNotificationNavigation(remoteMessage.data);
        }
      }
    });
};

const handleNotificationNavigation = (data: { [key: string]: string | object }) => {
  console.log('Handling notification navigation with data:', data);
  
  // Convert data values to strings for safe comparison
  const stringData: { [key: string]: string } = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    stringData[key] = typeof value === 'string' ? value : String(value);
  });
  
  // Add your navigation logic here based on notification data
  if (stringData.doorsUnlocked === 'true') {
    // Navigate to door control screen
    console.log('Navigate to door control');
  } else if (stringData.validation === 'true') {
    // Navigate to validation screen
    console.log('Navigate to validation screen');
  }
  // Add more navigation cases as needed
};

/**
 * Clear cached FCM token (useful for logout)
 */
export const clearFCMToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);
    await messaging().deleteToken();
    console.log('FCM token cleared');
  } catch (error) {
    console.error('Error clearing FCM token:', error);
  }
};
