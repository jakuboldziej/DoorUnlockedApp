import { initializeFCM, setupForegroundMessageHandler, setupNotificationOpenedHandler } from "@/lib/fcm-safe";
import { checkIfValidationNeeded } from "@/lib/fetch/door";
import { registerPushTokenWithServer } from "@/lib/fetch/notifications";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { createContext, Dispatch, PropsWithChildren, SetStateAction, use, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface DoorContextTypes {
  doorsUnlocked: boolean;
  setDoorsUnlocked: Dispatch<SetStateAction<boolean>>;
  isValidationNeeded: boolean;
  expoPushToken: string | null;
}

const DoorContext = createContext<DoorContextTypes>({
  doorsUnlocked: false,
  setDoorsUnlocked: () => { },
  isValidationNeeded: false,
  expoPushToken: null
});

export function useDoor() {
  const value = use(DoorContext);

  if (!value) throw new Error('useDoor must be wrapped in a <DoorProvider />');

  return value
};

export function DoorProvider({ children }: PropsWithChildren) {
  const [doorsUnlocked, setDoorsUnlocked] = useState(false);
  const [isValidationNeeded, setIsValidationNeeded] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    const initializeNotifications = async () => {
      console.log('Initializing notifications...');

      // Try to setup FCM (will be skipped in Expo Go)
      await initializeFCM();
      setupNotificationOpenedHandler();
      const unsubscribeForeground = await setupForegroundMessageHandler();

      // Always setup Expo notifications (works in both Expo Go and dev builds)
      try {
        const token = await registerForPushNotificationsAsync();

        if (token) {
          setExpoPushToken(token);

          try {
            // Register Expo token with tokenType
            await registerPushTokenWithServer(token, 'expo');
            console.log('Expo token registered successfully');
          } catch (error) {
            console.error('Network error sending expo push token to backend:', error);
          }
        } else {
          console.warn('No push token received from registerForPushNotificationsAsync');
        }
      } catch (error) {
        console.error('Error setting up Expo notifications:', error);
      }

      // Return cleanup function for FCM
      return () => {
        if (unsubscribeForeground) {
          unsubscribeForeground();
        }
      };
    };

    initializeNotifications();
    const baseUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!baseUrl) {
      console.error('EXPO_PUBLIC_API_URL is not defined.');
      return;
    }

    const socket: Socket = io(baseUrl.replace('/api', ''), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', async () => {
      console.info('Socket.IO connected');

      try {
        socket.emit("esp32:checkDoorsState", { requester: socket.id });

        const isValidationNeededResp = await checkIfValidationNeeded();
        setIsValidationNeeded(isValidationNeededResp);
      } catch (error) {
        console.error(error);
      }

    });

    socket.on('esp32:validation-state-changed', (validationState: boolean) => {
      setIsValidationNeeded(validationState);
    });

    socket.on('esp32:door-state-changed', (doorsState: number) => {
      setDoorsUnlocked(doorsState === 1);
    });

    socket.on('esp32:doorState-response', (state: number) => {
      setDoorsUnlocked(state === 1);
    });

    socket.on('disconnect', () => {
      console.info('Socket.IO disconnected');
    });

    socket.on('connect_error', (err: unknown) => {
      console.error('Socket.IO connection error:', err);
    });

    return () => {
      socket.disconnect();
      // Cleanup FCM listener if it exists
      // Note: The unsubscribeForeground is handled inside initializeNotifications
    };
  }, []);

  return (
    <DoorContext
      value={{
        doorsUnlocked,
        setDoorsUnlocked,
        isValidationNeeded,
        expoPushToken
      }}
    >
      {children}
    </DoorContext>
  )
};

// Add default export for the router
export default DoorProvider;