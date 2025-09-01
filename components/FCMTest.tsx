import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { getFCMToken, requestUserPermission } from '../lib/fcm';

export default function FCMTestComponent() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  useEffect(() => {
    initializeFCMTest();
  }, []);

  const initializeFCMTest = async () => {
    try {
      // Request permission
      const permission = await requestUserPermission();
      setHasPermission(permission);

      if (permission) {
        // Get FCM token
        const token = await getFCMToken();
        setFcmToken(token);

        if (token) {
          console.log('FCM Token obtained:', token.substring(0, 20) + '...');
        }
      }
    } catch (error) {
      console.error('Error in FCM test:', error);
    }
  };

  const showTokenInfo = () => {
    if (fcmToken) {
      Alert.alert(
        'FCM Token',
        `Token (first 50 chars): ${fcmToken.substring(0, 50)}...\n\nCheck console for full token.`,
        [{ text: 'OK' }]
      );
      console.log('Full FCM Token:', fcmToken);
    } else {
      Alert.alert('No Token', 'FCM token not available');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FCM Test Component</Text>

      <View style={styles.statusRow}>
        <Text style={styles.label}>Permission:</Text>
        <Text style={[styles.status, hasPermission ? styles.success : styles.error]}>
          {hasPermission ? '✅ Granted' : '❌ Denied'}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.label}>FCM Token:</Text>
        <Text style={[styles.status, fcmToken ? styles.success : styles.error]}>
          {fcmToken ? '✅ Obtained' : '❌ Not Available'}
        </Text>
      </View>

      {fcmToken && (
        <View style={styles.tokenContainer}>
          <Text style={styles.tokenText}>
            Token: {fcmToken.substring(0, 30)}...
          </Text>
          <Button title="Show Full Token" onPress={showTokenInfo} />
        </View>
      )}

      <Button
        title="Refresh FCM"
        onPress={initializeFCMTest}
        color="#FF6B35"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontSize: 16,
  },
  success: {
    color: '#28a745',
  },
  error: {
    color: '#dc3545',
  },
  tokenContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#e9ecef',
    borderRadius: 5,
  },
  tokenText: {
    fontSize: 12,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
});
