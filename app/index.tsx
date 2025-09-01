import FCMAdvancedTest from "@/components/FCMAdvancedTest";
import { validateDoor } from "@/lib/fetch/door";
import { registerBackgroundTask } from "@/lib/geolocation";
import { useEffect, useRef, useState } from "react";
import { Appearance, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDoor } from "./(context)/DoorContext";

export default function Index() {
  const { isValidationNeeded, doorsUnlocked } = useDoor();

  const [inputSecretCode, setInputSecretCode] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const inputRef = useRef<TextInput>(null);

  const colorScheme = Appearance.getColorScheme();

  useEffect(() => {
    registerBackgroundTask();
  }, []);

  const backgroundColor = colorScheme === "dark" ? "#222" : "#fff";
  const textColor = colorScheme === "dark" ? "#fff" : "#222";
  const inputBgColor = colorScheme === "dark" ? "#444" : "rgb(160, 163, 161)";
  const inputTextColor = colorScheme === "dark" ? "#fff" : "#222";

  const handleSecretCodeEnter = async () => {
    try {
      const response = await validateDoor(inputSecretCode);

      if (response.success) {
        setResponseMessage("Weryfikacja kodu poprawna!");
      } else {
        setResponseMessage("Nie udana weryfikacja kodu!");
      }
    } catch (error) {
      if (error instanceof Error) setResponseMessage(error.message);
      console.error(error);
    } finally {
      setInputSecretCode("");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }

  useEffect(() => {
    if (isValidationNeeded === false) {
      setInputSecretCode("");
    } else {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isValidationNeeded]);

  useEffect(() => {
    if (!responseMessage) return;

    const timer = setTimeout(() => {
      setResponseMessage("");
    }, 5000)

    return () => clearInterval(timer);
  }, [responseMessage]);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        alignItems: "center",
        gap: 20,
        backgroundColor: backgroundColor
      }}
    >
      <Text style={{ fontSize: 30, paddingTop: 50, fontWeight: "bold", color: textColor }}>Odblokuj drzwi</Text>
      <Text style={{ fontSize: 20, color: textColor }}>Stan drzwi: {doorsUnlocked === true ? "Otwarte" : "Zamknięte"}</Text>

      {isValidationNeeded && (
        <TextInput
          ref={inputRef}
          style={{ backgroundColor: inputBgColor, color: inputTextColor, width: 100, borderRadius: 20, textAlign: "center" }}
          keyboardType="numeric"
          value={inputSecretCode}
          onChangeText={setInputSecretCode}
          onSubmitEditing={() => handleSecretCodeEnter()}
          autoFocus
        />
      )}
      {responseMessage &&
        <Text
          style={{
            fontSize: 20,
            color: responseMessage.includes("Nie") ? "red" : "green"
          }}
        >
          {responseMessage}
        </Text>
      }

      {/* <GeoFence /> */}

      {/* FCM Advanced Test Component - Remove this in production */}
      <FCMAdvancedTest />
    </SafeAreaView>
  );
}
