import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { clearFCMToken, getFCMToken, isFCMAvailable, requestUserPermission } from '../lib/fcm-safe';
import { apiUrl } from '../lib/fetch/constants';

export default function FCMAdvancedTest() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 10)); // Keep last 10 logs
  };

  const initializeFCMTest = async () => {
    setIsLoading(true);
    addLog('Starting FCM initialization test...');

    // Check if FCM is available
    const fcmAvailable = isFCMAvailable();
    if (!fcmAvailable) {
      addLog('⚠️ FCM not available - Running in Expo Go');
      addLog('ℹ️ Use development build for FCM testing');
      addLog('✅ Expo notifications will work instead');
      setIsLoading(false);
      return;
    }

    try {
      // Request permission
      addLog('Requesting notification permission...');
      const permission = await requestUserPermission();
      setHasPermission(permission);
      addLog(`Permission result: ${permission ? 'GRANTED' : 'DENIED'}`);

      if (permission) {
        // Get FCM token
        addLog('Getting FCM token...');
        const token = await getFCMToken();
        setFcmToken(token);

        if (token) {
          addLog(`FCM Token obtained: ${token.substring(0, 20)}...`);
          addLog('Token registered with backend automatically');
        } else {
          addLog('Failed to get FCM token');
        }
      }
    } catch (error) {
      addLog(`Error: ${error}`);
      console.error('Error in FCM test:', error);
    } finally {
      setIsLoading(false);
    }
  }; const testNotificationSend = async () => {
    if (!fcmToken) {
      Alert.alert('Error', 'No FCM token available');
      return;
    }

    setIsLoading(true);
    addLog('Testing notification send...');

    try {
      const response = await fetch(`${apiUrl}/esp32/door/test-fcm-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'FCM Test Notification',
          body: 'This is a test notification from FCM',
          data: {
            test: 'true',
            timestamp: new Date().toISOString()
          },
          isCritical: false
        }),
      });

      const result = await response.json();
      addLog(`Test notification response: ${result.message}`);

      if (result.success) {
        addLog(`✅ Sent to ${result.notificationCount} devices`);
        Alert.alert('Success', `Test notification sent to ${result.notificationCount} devices!`);
      } else {
        addLog('❌ Failed to send test notification');
        Alert.alert('Error', result.message || 'Failed to send test notification');
      }
    } catch (error) {
      addLog(`Test notification error: ${error}`);
      Alert.alert('Error', `Network error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testCriticalNotification = async () => {
    if (!fcmToken) {
      Alert.alert('Error', 'No FCM token available');
      return;
    }

    setIsLoading(true);
    addLog('Testing CRITICAL notification...');

    try {
      const response = await fetch(`${apiUrl}/esp32/door/test-fcm-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'CRITICAL ALERT TEST',
          body: 'This is a critical alarm test - should use nuclear_alarm sound',
          data: {
            alarm: 'true',
            critical: 'true',
            test: 'true',
            timestamp: new Date().toISOString()
          },
          isCritical: true
        }),
      });

      const result = await response.json();
      addLog(`Critical notification response: ${result.message}`);

      if (result.success) {
        addLog(`🚨 Critical alert sent to ${result.notificationCount} devices!`);
        Alert.alert('Critical Test Sent!', `Alarm sent to ${result.notificationCount} devices - check notification with alarm sound`);
      } else {
        addLog('❌ Failed to send critical notification');
        Alert.alert('Error', result.message || 'Failed to send critical notification');
      }
    } catch (error) {
      addLog(`Critical notification error: ${error}`);
      Alert.alert('Error', `Network error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearTokenTest = async () => {
    setIsLoading(true);
    addLog('Clearing FCM token...');

    try {
      await clearFCMToken();
      setFcmToken(null);
      addLog('✅ FCM token cleared successfully');
      Alert.alert('Success', 'FCM token cleared');
    } catch (error) {
      addLog(`Clear token error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showFullToken = () => {
    if (fcmToken) {
      Alert.alert(
        'Full FCM Token',
        fcmToken,
        [
          { text: 'Copy to Clipboard', onPress: () => addLog('Token copied to clipboard') },
          { text: 'OK' }
        ]
      );
      console.log('Full FCM Token:', fcmToken);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔥 FCM Advanced Testing</Text>

      {/* Expo Go Warning */}
      {!isFCMAvailable() && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningTitle}>⚠️ Expo Go Detected</Text>
          <Text style={styles.warningText}>
            Firebase Cloud Messaging is not available in Expo Go.{'\n'}
            Create a development build to test FCM:{'\n'}
            npx expo run:android
          </Text>
        </View>
      )}

      {/* Status Display */}
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Permission:</Text>
          <Text style={[styles.status, hasPermission ? styles.success : styles.error]}>
            {hasPermission ? '✅ Granted' : '❌ Denied'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.label}>FCM Token:</Text>
          <Text style={[styles.status, fcmToken ? styles.success : styles.error]}>
            {fcmToken ? '✅ Available' : '❌ Not Available'}
          </Text>
        </View>

        {fcmToken && (
          <TouchableOpacity onPress={showFullToken} style={styles.tokenButton}>
            <Text style={styles.tokenText}>
              Token: {fcmToken.substring(0, 30)}... (tap to view full)
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Test Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={initializeFCMTest}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? '⏳ Testing...' : '🔄 Initialize FCM'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={testNotificationSend}
          disabled={isLoading || !fcmToken}
        >
          <Text style={styles.buttonText}>📱 Send Test Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.criticalButton]}
          onPress={testCriticalNotification}
          disabled={isLoading || !fcmToken}
        >
          <Text style={styles.buttonText}>🚨 Send Critical Alert</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={clearTokenTest}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>🗑️ Clear Token</Text>
        </TouchableOpacity>
      </View>

      {/* Logs Display */}
      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>📋 Test Logs:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
        {logs.length === 0 && (
          <Text style={styles.noLogs}>No logs yet. Run a test to see logs.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
  tokenButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e9ecef',
    borderRadius: 5,
  },
  tokenText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  testButton: {
    backgroundColor: '#28a745',
  },
  criticalButton: {
    backgroundColor: '#fd7e14',
  },
  dangerButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 5,
    color: '#666',
    backgroundColor: '#f8f9fa',
    padding: 5,
    borderRadius: 3,
  },
  noLogs: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#999',
    textAlign: 'center',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});
