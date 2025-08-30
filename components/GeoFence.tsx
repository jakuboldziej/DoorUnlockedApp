import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { checkGeoAuthorizationStatus } from '../lib/fetch/door';
import { useGeoFence } from '../lib/geolocation';
import { useDoor } from '../app/(context)/DoorContext';

export default function GeoFence() {
  const { isEnabled, toggleGeoFence, isNearDoor, distance, error } = useGeoFence();
  const { isValidationNeeded } = useDoor();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  useEffect(() => {
    const checkAuthorization = async () => {
      if (isValidationNeeded) return;

      setIsChecking(true);
      try {
        const deviceId = await AsyncStorage.getItem('device_unique_id');
        if (deviceId) {
          const result = await checkGeoAuthorizationStatus(deviceId);
          setIsAuthorized(result.authorized);
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error('Error checking authorization:', err);
        setIsAuthorized(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuthorization();
  }, [isValidationNeeded]);

  const handleToggle = async (value: boolean) => {
    if (isValidationNeeded) return;

    if (value && isAuthorized === false) {
      setIsChecking(true);
      try {
        const deviceId = await AsyncStorage.getItem('device_unique_id');
        if (deviceId) {
          const result = await checkGeoAuthorizationStatus(deviceId);
          setIsAuthorized(result.authorized);
          if (result.authorized) {
            await toggleGeoFence(value);
          }
        }
      } catch (err) {
        console.error('Error checking authorization:', err);
      } finally {
        setIsChecking(false);
      }
    } else {
      await toggleGeoFence(value);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.title}>Automatyczna weryfikacja kodu</Text>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          disabled={isChecking || isAuthorized === false}
        />
      </View>

      {isValidationNeeded && isEnabled && (
        <Text style={styles.validationText}>
          Automatyczna weryfikacja kodu w trakcie...
        </Text>
      )}

      {isAuthorized === false && (
        <Text style={styles.errorText}>
          To urządzenie nie jest autoryzowane do automatycznej weryfikacji kodu
        </Text>
      )}

      {isChecking && (
        <Text style={styles.statusText}>Sprawdzanie uprawnień...</Text>
      )}

      {isEnabled && isAuthorized !== false && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            Status: {isNearDoor ? 'Gotowy do weryfikacji' : 'Poza zasięgiem weryfikacji'}
          </Text>

          {distance !== null && (
            <Text style={styles.distanceText}>
              Odległość: {Math.round(distance)} m
            </Text>
          )}
          
          <Text style={styles.infoText}>
            Geolokalizacja zostanie użyta tylko do weryfikacji kodu, gdy będzie to potrzebne.
          </Text>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  statusText: {
    fontSize: 14,
  },
  distanceText: {
    fontSize: 14,
    marginTop: 4,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#007bff',
    fontStyle: 'italic',
    marginTop: 8,
  },
  validationText: {
    fontSize: 14,
    color: '#ff8c00',
    textAlign: 'center',
    fontWeight: '500',
  },
});
