
import { setNotificationHandler } from 'expo-notifications';
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DoorProvider } from "./(context)/DoorContext";

setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  return (
    <DoorProvider>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </SafeAreaProvider>
    </DoorProvider>
  );
}
