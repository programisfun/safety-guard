import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TASK_NAME = 'background-location-task';
const STORAGE_KEY = 'location_log';

async function saveLocations(points: any[]) {
  try {
    const existingRaw = await AsyncStorage.getItem(STORAGE_KEY);
    const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
    const entries = points.map((p: any) => ({
      timestamp: new Date(p.timestamp).toISOString(),
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      accuracy: p.coords.accuracy,
    }));
    const updated = [...entries, ...existing].slice(0, 200); // keep newest 200
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    console.log(`💾 Saved ${entries.length} location(s) to AsyncStorage.`);
  } catch (err) {
    console.log(`❌ Failed to save locations: ${err}`);
  }
}

function addDebugLog(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const formattedLog = `[${timestamp}] ${message}`;
  console.log(formattedLog);
}

// ✅ TaskManager definition
TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
  addDebugLog("⚠️ Background Task Triggered by OS!");

  if (error) {
    addDebugLog(`❌ OS Task Error: ${JSON.stringify(error)}`);
    return;
  }

  if (!data) {
    addDebugLog("⚠️ Task woke up but data object is completely empty.");
    return;
  }

  if (data && data.locations && data.locations.length > 0) {
    const points = data.locations;
    const latestLocation = points[points.length - 1];
    const { latitude, longitude, accuracy } = latestLocation.coords;
    const location = points;
    if (location) {
      await saveLocations(location);
    }
    addDebugLog(`📍 Parsed Coordinates -> Lat: ${latitude}, Lon: ${longitude} (±${accuracy}m)`);
  } else {
    addDebugLog("⚠️ Data layout is missing standard .locations array.");
  }
});

export default function IndexRouteScreen() {
  const [trackingActive, setTrackingActive] = useState(false);
  const [savedEntries, setSavedEntries] = useState<any[]>([]);

  const loadSavedEntries = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setSavedEntries(raw ? JSON.parse(raw) : []);
    } catch (err) {
      console.log(`❌ Failed to read stored locations: ${err}`);
    }
  };

  const clearSavedEntries = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setSavedEntries([]);
  };

  useEffect(() => {
    loadSavedEntries();
  }, []);

  useEffect(() => {
    addDebugLog("🔄 App Mounted.");
    Location.hasStartedLocationUpdatesAsync(TASK_NAME).then((active) => {
      addDebugLog(`📋 OS Check: Is background task running? ${active}`);
      setTrackingActive(active);
    });
  }, []);

  const startTracking = async () => {
    addDebugLog("🚀 Start Tracking button pressed.");

    addDebugLog("🔄 Step 1: Requesting Foreground Location Access...");
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    addDebugLog(`📋 Foreground Permission status: ${fgStatus}`);
    if (fgStatus !== 'granted') {
      Alert.alert("Permission Denied", "Foreground location permission is required.");
      return;
    }

    addDebugLog("🔄 Step 2: Requesting Background Location Access...");
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    addDebugLog(`📋 Background Permission status: ${bgStatus}`);
    if (bgStatus !== 'granted') {
      Alert.alert("Permission Denied", "Background location permission is required. Set your system setting to 'Allow all the time'.");
      return;
    }

    try {
      addDebugLog(`🔄 Step 3: Requesting OS to register background task '${TASK_NAME}'...`);
      await Location.startLocationUpdatesAsync(TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000, // Reduced to 1 seconds for easier debug testing
        distanceInterval: 2,  // Reduced to 2 meters for easier debug testing
        foregroundService: {
          notificationTitle: "Safety Guard Active!!!!!!!!!!!!!!!",
          notificationBody: "Monitoring your background location.",
          notificationColor: "#FF3B30",
        }
      });

      setTrackingActive(true);
      addDebugLog(`🚀 Background task '${TASK_NAME}' successfully registered.`);
      Alert.alert("Success", "Background tracking started.");
    } catch (err: any) {
      addDebugLog(`❌ Task registration aborted by system: ${err.message}`);
      Alert.alert("Registration Error", err.message);
    }
  };

  const stopTracking = async () => {
    addDebugLog("🛑 Stop Tracking button pressed.");
    try {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
      setTrackingActive(false);
      addDebugLog("🛑 Task removed. Location streaming stopped.");
      Alert.alert("Stopped", "Location tracking disabled.");
    } catch (err: any) {
      addDebugLog(`❌ Error caught while stopping task: ${err.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Safety Guard</Text>
        <Text style={styles.subtitle}>
          Status: {trackingActive ? "Active" : "Idle"}
        </Text>

        {!trackingActive ? (
          <Button title="Start Safety Tracking" onPress={startTracking} color="#FF3B30" />
        ) : (
          <Button title="Stop Tracking" onPress={stopTracking} color="#555" />
        )}
      </View>

      <View style={styles.savedSection}>
        <Text style={styles.savedTitle}>💾 Stored Locations ({savedEntries.length})</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <Button title="Refresh" onPress={loadSavedEntries} />
          <Button title="Clear" onPress={clearSavedEntries} color="#555" />
        </View>
        <ScrollView nestedScrollEnabled={true}>
          {savedEntries.length === 0 ? (
            <Text style={styles.debugTextEmpty}>Nothing saved yet.</Text>
          ) : (
            savedEntries.map((entry, idx) => (
              <Text key={idx} style={styles.debugText}>
                {entry.timestamp} — {entry.latitude.toFixed(5)}, {entry.longitude.toFixed(5)} (±{Math.round(entry.accuracy)}m)
              </Text>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 0.5, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30 },
  // Debug window styling
  debugConsole: { flex: 0.5, backgroundColor: '#1e1e1e', borderTopWidth: 2, borderTopColor: '#333', padding: 10 },
  debugTitle: { color: '#00FF00', fontWeight: 'bold', fontSize: 14, marginBottom: 5, fontFamily: 'monospace' },
  debugScroll: { flex: 1 },
  debugText: { color: '#ffffff', fontSize: 11, fontFamily: 'monospace', marginBottom: 3 },
  debugTextEmpty: { color: '#888', fontSize: 11, fontStyle: 'italic' },
  savedSection: { flex: 0.5, backgroundColor: '#1e1e1e', borderTopWidth: 2, borderTopColor: '#333', padding: 10 },
  savedTitle: { color: '#00FF00', fontWeight: 'bold', fontSize: 14, marginBottom: 5 }
});
