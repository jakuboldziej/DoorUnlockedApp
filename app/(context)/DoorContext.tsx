import { checkIfValidationNeeded } from "@/lib/fetch/door";
import { createContext, Dispatch, PropsWithChildren, SetStateAction, use, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface DoorContextTypes {
  doorsUnlocked: boolean;
  setDoorsUnlocked: Dispatch<SetStateAction<boolean>>;
  isValidationNeeded: boolean;
}

const DoorContext = createContext<DoorContextTypes>({
  doorsUnlocked: false,
  setDoorsUnlocked: () => { },
  isValidationNeeded: false
});

export function useDoor() {
  const value = use(DoorContext);

  if (!value) throw new Error('useDoor must be wrapped in a <DoorProvider />');

  return value
};

export function DoorProvider({ children }: PropsWithChildren) {
  const [doorsUnlocked, setDoorsUnlocked] = useState(false);
  const [isValidationNeeded, setIsValidationNeeded] = useState(false);

  useEffect(() => {
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
      console.log('Socket.IO connected');

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

    socket.on('esp32:doorState-response', (state) => {
      setDoorsUnlocked(state === 1);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
    });

    socket.on('connect_error', (err: unknown) => {
      console.error('Socket.IO connection error:', err);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (doorsUnlocked === true) {

    }
  }, [doorsUnlocked]);

  return (
    <DoorContext
      value={{
        doorsUnlocked,
        setDoorsUnlocked,
        isValidationNeeded
      }}
    >
      {children}
    </DoorContext>
  )
};