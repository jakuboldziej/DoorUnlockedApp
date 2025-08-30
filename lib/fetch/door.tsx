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
    console.error("Error in validateDoor:", error);
    throw error;
  }
}

export const checkGeoAuthorizationStatus = async (deviceId: string) => {
  try {
    const response = await fetch(`${apiUrl}/esp32/door/check-geo-authorization`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify({ deviceId }),
    });

    return await response.json();
  } catch (error: unknown) {
    console.error('Error checking geolocation authorization:', error);
    return { authorized: false, message: 'Błąd sprawdzania uprawnień' };
  }
};

export const unlockDoorViaGeo = async (deviceId: string) => {
  try {
    const response = await fetch(`${apiUrl}/esp32/door/unlock-via-geo`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify({ deviceId }),
    });

    return await response.json();
  } catch (error: unknown) {
    console.error('Error unlocking door via geolocation:', error);
    throw error;
  }
};

export const autoValidateDoorWithGeo = async (deviceId: string) => {
  try {
    const isValidationNeeded = await checkIfValidationNeeded();
    if (!isValidationNeeded) {
      return { success: false, message: 'Validation not needed' };
    }

    const authResult = await checkGeoAuthorizationStatus(deviceId);
    if (!authResult.authorized) {
      return { success: false, message: 'Device not authorized' };
    }

    const response = await fetch(`${apiUrl}/esp32/door/validate-with-geo`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify({ deviceId }),
    });

    return await response.json();
  } catch (error: unknown) {
    console.error('Error auto-validating door with geo:', error);
    throw error;
  }
};