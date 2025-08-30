import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { autoValidateDoorWithGeo, checkGeoAuthorizationStatus, checkIfValidationNeeded } from './fetch/door';

// Storage keys
const GEO_ENABLED_KEY = 'geo_location_enabled';
const LAST_UNLOCK_TIME_KEY = 'last_geo_unlock_time';

interface CoordsType {
  lat: number;
  lng: number;
}

const doorLocation = { lat: 51.3142398877287, lng: 16.91470516047976 };
const GEOFENCE_RADIUS = 100; // meters
const MIN_UNLOCK_INTERVAL = 2 * 60 * 1000; // 2 minutes in milliseconds

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function haversineDistance(coord1: CoordsType, coord2: CoordsType): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000; 
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}


export function useGeoFence() {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isNearDoor, setIsNearDoor] = useState<boolean>(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(GEO_ENABLED_KEY)
      .then(value => setIsEnabled(value === 'true'))
      .catch(() => setIsEnabled(false));
  }, []);

  const toggleGeoFence = async (enable: boolean) => {
    try {
      if (enable) {
        const deviceId = await AsyncStorage.getItem('device_unique_id');
        if (!deviceId) {
          setError('Nie udało się zidentyfikować urządzenia');
          return false;
        }
        
        const authResult = await checkGeoAuthorizationStatus(deviceId);
        if (!authResult.authorized) {
          Alert.alert(
            'Brak uprawnień',
            authResult.message || 'To urządzenie nie jest uprawnione do automatycznego odblokowywania drzwi.'
          );
          return false;
        }
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Brak uprawnień',
            'Aplikacja potrzebuje dostępu do lokalizacji, aby automatycznie odblokowywać drzwi.'
          );
          return false;
        }
        
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync()
          .catch(() => ({ status: 'denied' }));
        
        if (backgroundStatus !== 'granted') {
          Alert.alert(
            'Ograniczona funkcjonalność',
            'Automatyczne odblokowywanie drzwi będzie działać tylko gdy aplikacja jest otwarta.'
          );
        }
      }
      
      await AsyncStorage.setItem(GEO_ENABLED_KEY, enable ? 'true' : 'false');
      setIsEnabled(enable);
      return true;
    } catch (err) {
      console.error('Error toggling geofence:', err);
      setError('Nie udało się zmienić ustawień geolokalizacji');
      return false;
    }
  };


  const checkLocation = useCallback(async (): Promise<boolean> => {
    try {
      if (!isEnabled) return false;

      const deviceId = await AsyncStorage.getItem('device_unique_id');
      if (!deviceId) {
        setError('Nie udało się zidentyfikować urządzenia');
        return false;
      }

      const isValidationNeeded = await checkIfValidationNeeded();
      if (!isValidationNeeded) {
        return false;
      }
      
      const authResult = await checkGeoAuthorizationStatus(deviceId);
      if (!authResult.authorized) {
        setError('To urządzenie nie jest już autoryzowane');
        await AsyncStorage.setItem(GEO_ENABLED_KEY, 'false');
        setIsEnabled(false);
        return false;
      }

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Brak uprawnień do lokalizacji');
        return false;
      }

      const location = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Highest 
      });

      const currentDistance = haversineDistance(
        { lat: location.coords.latitude, lng: location.coords.longitude },
        doorLocation
      );
      
      setDistance(currentDistance);
      const isNear = currentDistance < GEOFENCE_RADIUS;
      setIsNearDoor(isNear);
      
      if (isNear && isValidationNeeded) {
        try {
          const autoValidationResult = await autoValidateDoorWithGeo(deviceId);
          if (autoValidationResult.success) {
            Alert.alert(
              'Automatyczna weryfikacja',
              'Kod został automatycznie zweryfikowany dzięki geolokalizacji.'
            );
            return true;
          }
        } catch (error) {
          console.error('Auto-validation error:', error);
        }
      }
      
      return false;
    } catch (err) {
      console.error('Error checking location:', err);
      setError('Błąd sprawdzania lokalizacji');
      return false;
    }
  }, [isEnabled, setIsEnabled, setDistance, setIsNearDoor, setError]);

  useEffect(() => {
    if (!isEnabled) return;

    checkLocation();
    
    const interval = setInterval(checkLocation, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [isEnabled, checkLocation]);

  return {
    isEnabled,
    isNearDoor,
    distance,
    error,
    toggleGeoFence,
    checkLocation
  };
}

export const startBackgroundLocationTask = async () => {
  try {
    const isEnabled = await AsyncStorage.getItem(GEO_ENABLED_KEY) === 'true';
    if (!isEnabled) return;
    
    const deviceId = await AsyncStorage.getItem('device_unique_id');
    if (!deviceId) return;
    
    const authResult = await checkGeoAuthorizationStatus(deviceId);
    if (!authResult.authorized) {
      console.log('Device not authorized for geolocation');
      await AsyncStorage.setItem(GEO_ENABLED_KEY, 'false');
      return;
    }
    
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') return;
    
    const TaskManager = await import('expo-task-manager');
    
    const isTaskDefined = await TaskManager.isTaskRegisteredAsync('door-unlock-background')
      .catch(() => false);
      
    if (!isTaskDefined) {
      registerBackgroundTask();
    }
    
    await Location.startLocationUpdatesAsync('door-unlock-background', {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000, // 30 seconds
      distanceInterval: 10, // 10 meters
      foregroundService: {
        notificationTitle: 'Drzwi odblokowane',
        notificationBody: 'Aplikacja monitoruje lokalizację, aby odblokować drzwi automatycznie'
      },
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: true
    });
  } catch (err) {
    console.error('Failed to start background location task:', err);
  }
};

export const registerBackgroundTask = () => {
  try {
    import('expo-task-manager').then((TaskManager) => {
      if (!TaskManager.isTaskRegisteredAsync('door-unlock-background')) {
        TaskManager.defineTask(
          'door-unlock-background', 
          async ({ data, error }) => {
            if (error) {
              console.error('Error in background location task:', error);
              return;
            }
            
            const taskData = data as any;
            const locations = taskData?.locations as Location.LocationObject[] | undefined;
            if (!locations || locations.length === 0) return;
            
            const location = locations[0];
            const currentDistance = haversineDistance(
              { lat: location.coords.latitude, lng: location.coords.longitude },
              doorLocation
            );
            
            if (currentDistance < GEOFENCE_RADIUS) {
              const now = Date.now();
              const lastUnlockTimeStr = await AsyncStorage.getItem(LAST_UNLOCK_TIME_KEY);
              const lastUnlockTime = lastUnlockTimeStr ? parseInt(lastUnlockTimeStr, 10) : 0;
              
              if (now - lastUnlockTime > MIN_UNLOCK_INTERVAL) {
                const deviceId = await AsyncStorage.getItem('device_unique_id');
                if (!deviceId) return;
                
                const authResult = await checkGeoAuthorizationStatus(deviceId);
                if (!authResult.authorized) {
                  await AsyncStorage.setItem(GEO_ENABLED_KEY, 'false');
                  return;
                }
                
                const isValidationNeeded = await checkIfValidationNeeded();
                
                if (isValidationNeeded) {
                  try {
                    await autoValidateDoorWithGeo(deviceId);
                    await AsyncStorage.setItem(LAST_UNLOCK_TIME_KEY, now.toString());
                  } catch (err) {
                    console.error('Failed to auto-validate with geolocation:', err);
                  }
                }
                
              }
            }
          }
        );
      }
    }).catch(err => console.error('Failed to import TaskManager:', err));
  } catch (err) {
    console.error('Failed to register background task:', err);
  }
};
