import { checkIfValidationNeeded } from "@/lib/fetch/door";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import * as Device from 'expo-device';
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
      const token = await registerForPushNotificationsAsync();

      if (token) {
        setExpoPushToken(token);

        try {
          const baseUrl = process.env.EXPO_PUBLIC_API_URL;

          if (baseUrl) {
            const deviceId = Device.osInternalBuildId || 'unknown-device';

            const response = await fetch(`${baseUrl}/esp32/door/register-push-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                pushToken: token,
                deviceId: deviceId
              }),
            });

            const result = await response.json();

            if (!response.ok) {
              console.error('Failed to register push token:', result);
            }
          } else {
            console.error('EXPO_PUBLIC_API_URL is not defined');
          }
        } catch (error) {
          console.error('Network error sending push token to backend:', error);
        }
      } else {
        console.warn('No push token received from registerForPushNotificationsAsync');
      }
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