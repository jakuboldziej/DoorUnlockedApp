import { apiUrl } from "./constants";

export const checkIfValidationNeeded = async () => {
  try {
    const response = await fetch(`${apiUrl}/esp32/door/check-if-validation-needed`);

    return await response.json();
  } catch (error: unknown) {
    console.error("Error in checkIfValidationNeeded:", error);
    throw error;
  }
}

export const validateDoor = async (secretCode: string) => {
  try {
    const response = await fetch(`${apiUrl}/esp32/door/validate`, {
      method: "POST",
      headers: {
        "Content-type": "application/json"
      },
      body: JSON.stringify({
        secretCode
      })
    });

    return await response.json();
  } catch (error: unknown) {
    console.error("Error in checkIfValidationNeeded:", error);
    throw error;
  }
}