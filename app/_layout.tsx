import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DoorProvider } from "./(context)/DoorContext";

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
