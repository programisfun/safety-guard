import React from 'react';
import { View, Text, Button, Alert, StyleSheet, SafeAreaView } from 'react-native';
import * as Location from 'expo-location';

// 1. Define the background task (MUST be OUTSIDE the component)
Location.defineTask('background-location-task', async ({ error, location }) => {
  if (error) {
    console.error("Task Error:", error);
    return;
  }
  if (location) {
    console.log("Background Location Received:", location);
    
    // 2. SEND DATA TO YOUR SERVER
    try {
      const response = await fetch('https://your-api.com/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp,
        }),
      });
      if (response.ok) {
        console.log("Location synced successfully");
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    }
  }
});

export default function SafetyScreen() {
  const startTracking = async () => {
    // Request permissions
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

    if (fgStatus === 'granted' && bgStatus === 'granted') {
      try {
        await Location.startLocationUpdatesAsync('background-location-task', {
          accuracy: Location.Accuracy.High,
          // 60000ms = 1 minute
          timeInterval: 60000, 
          // Only update if the user moves more than 10 meters
          distanceInterval: 10,
          // Required for Android to keep the service alive
          showsForegroundNotification: true, 
        });
        Alert.alert("Success", "Safety tracking started every 1 minute.");
      } catch (err) {
        Alert.alert("Error", err.message);
      }
    } else {
      Alert.alert("Permission Denied", "Background location is required for Safety.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Safety Guard</Text>
        <Text style={styles.subtitle}>Background tracking is active</Text>
        <Button title="Start Safety Tracking" onPress={startTracking} color="#FF3B30" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
});