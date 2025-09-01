import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Storage keys
const FCM_TOKEN_KEY = 'fcm_token';

// Check if we're running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Safely import Firebase modules only if not in Expo Go
let messaging: any = null;
let PermissionsAndroid: any = null;

const loadFirebaseModules = async (): Promise<void> => {
  if (!isExpoGo) {
    try {
      // Dynamic imports to avoid crashes in Expo Go
      const firebaseMessaging = await import('@react-native-firebase/messaging');
      messaging = firebaseMessaging.default;
      
      if (Platform.OS === 'android') {
        const RN = await import('react-native');
        PermissionsAndroid = RN.PermissionsAndroid;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Firebase modules not available:', errorMessage);
    }
  }
};

// Initialize modules
loadFirebaseModules();

/**
 * Request permission for notifications
 */
export const requestUserPermission = async (): Promise<boolean> => {
  if (isExpoGo) {
    console.warn('FCM not available in Expo Go - using Expo notifications instead');
    return false;
  }

  // Ensure modules are loaded
  await loadFirebaseModules();
  
  if (!messaging) {
    console.warn('Firebase messaging not available');
    return false;
  }

  try {
    if (Platform.OS === 'android' && PermissionsAndroid) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    const authStatus = await messaging.requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    return enabled;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error requesting FCM permission:', errorMessage);
    return false;
  }
};

/**
 * Get FCM token
 */
export const getFCMToken = async (): Promise<string | null> => {
  if (isExpoGo) {
    console.warn('FCM not available in Expo Go');
    return null;
  }

  // Ensure modules are loaded
  await loadFirebaseModules();
  
  if (!messaging) {
    console.warn('Firebase messaging not available');
    return null;
  }

  try {
    // Check if we have cached token
    const cachedToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);
    
    // Get fresh token from Firebase
    const token = await messaging.getToken();
    
    if (token) {
      // Cache the token
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      
      // Register with server if token is new or different
      if (token !== cachedToken) {
        // Import registerPushTokenWithServer dynamically to avoid circular dependency
        const { registerPushTokenWithServer } = await import('./fetch/notifications');
        await registerPushTokenWithServer(token, 'fcm');
      }
      
      return token;
    }
    
    return null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting FCM token:', errorMessage);
    return null;
  }
};

/**
 * Initialize FCM
 */
export const initializeFCM = async (): Promise<void> => {
  if (isExpoGo) {
    console.log('Skipping FCM initialization - not available in Expo Go');
    return;
  }

  // Ensure modules are loaded
  await loadFirebaseModules();
  
  if (!messaging) {
    console.warn('Firebase messaging not available');
    return;
  }

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
    messaging.onTokenRefresh(async (token: string) => {
      console.log('FCM token refreshed:', token);
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      const { registerPushTokenWithServer } = await import('./fetch/notifications');
      await registerPushTokenWithServer(token, 'fcm');
    });

    // Handle background messages
    messaging.setBackgroundMessageHandler(async (remoteMessage: any) => {
      console.log('Message handled in the background!', remoteMessage);
      
      // Handle critical notifications even in background
      if (remoteMessage.data?.critical === 'true' || remoteMessage.data?.alarm === 'true') {
        // You can schedule local notification here if needed
        console.log('Critical message received in background');
      }
    });

    console.log('FCM initialized successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error initializing FCM:', errorMessage);
  }
};

/**
 * Handle foreground messages
 */
export const setupForegroundMessageHandler = async () => {
  if (isExpoGo) {
    console.log('FCM foreground handler not available in Expo Go');
    return () => {}; // Return empty cleanup function
  }

  // Ensure modules are loaded
  await loadFirebaseModules();
  
  if (!messaging) {
    console.warn('Firebase messaging not available');
    return () => {};
  }

  try {
    return messaging.onMessage(async (remoteMessage: any) => {
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error setting up FCM foreground handler:', errorMessage);
    return () => {};
  }
};

/**
 * Handle notification opened app
 */
export const setupNotificationOpenedHandler = async () => {
  if (isExpoGo) {
    console.log('FCM notification opened handler not available in Expo Go');
    return;
  }

  // Ensure modules are loaded
  await loadFirebaseModules();
  
  if (!messaging) {
    console.warn('Firebase messaging not available');
    return;
  }

  try {
    // Handle notification when app is opened from background/quit state
    messaging.onNotificationOpenedApp((remoteMessage: any) => {
      console.log('Notification caused app to open from background state:', remoteMessage);
      
      // Navigate to specific screen based on notification data
      if (remoteMessage.data) {
        handleNotificationNavigation(remoteMessage.data);
      }
    });

    // Handle notification when app is opened from quit state
    messaging
      .getInitialNotification()
      .then((remoteMessage: any) => {
        if (remoteMessage) {
          console.log('Notification caused app to open from quit state:', remoteMessage);
          
          if (remoteMessage.data) {
            handleNotificationNavigation(remoteMessage.data);
          }
        }
      });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error setting up FCM notification opened handler:', errorMessage);
  }
};

/**
 * Handle navigation based on notification data
 */
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
    
    if (!isExpoGo) {
      // Ensure modules are loaded
      await loadFirebaseModules();
      
      if (messaging) {
        await messaging.deleteToken();
      }
    }
    
    console.log('FCM token cleared');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error clearing FCM token:', errorMessage);
  }
};

/**
 * Check if FCM is available
 */
export const isFCMAvailable = (): boolean => {
  return !isExpoGo && messaging !== null;
};
