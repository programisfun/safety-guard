import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager'; // ✅ Imported correctly
import { createClient } from '@supabase/supabase-js';

console.log("[DEBUG LOG] Initializing script. Checking env variables...");
console.log("[DEBUG LOG] EXPO_PUBLIC_SUPABASE_URL exists:", !!process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log("[DEBUG LOG] EXPO_PUBLIC_SUPABASE_ANON_KEY exists:", !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TASK_NAME = 'background-location-task';

// ✅ TaskManager is used instead of Location for registering the background system
TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
  console.log("[DEBUG LOG] ---- Background Task Triggered ----");
  
  if (error) {
    console.error("[DEBUG LOG] Task Error Received from OS:", error);
    return;
  }
  
  if (!data) {
    console.warn("[DEBUG LOG] Task woke up but data object is completely empty.");
    return;
  }

  console.log("[DEBUG LOG] Complete raw event data payload:", JSON.stringify(data));
  
  if (data && data.locations && data.locations.length > 0) {
    const points = data.locations;
    console.log(`[DEBUG LOG] Received ${points.length} location coordinates in this batch.`);
    
    // Process the latest coordinate point in the array batch
    const latestLocation = points[points.length - 1];
    const { latitude, longitude, accuracy } = latestLocation.coords;
    
    console.log(`[DEBUG LOG] Parsing Latest Point -> Lat: ${latitude}, Lon: ${longitude}, Accuracy: ${accuracy} meters`);
    
    try {
      console.log("[DEBUG LOG] Attempting network database insert into Supabase...");
      
      const { data: dbData, error: dbError } = await supabase
        .from('locations')
        .insert([
          {
            latitude: latitude,
            longitude: longitude,
          }
        ])
        .select();

      if (dbError) {
        console.error("[DEBUG LOG] ❌ Supabase Database rejected write:", JSON.stringify(dbError));
      } else {
        console.log("[DEBUG LOG] ✅ Supabase Database saved row successfully:", JSON.stringify(dbData));
      }
    } catch (err: any) {
      console.error("[DEBUG LOG] ❌ Critical System network failure inside task:", err.message || err);
    }
  } else {
    console.warn("[DEBUG LOG] Data layout is missing standard .locations array structural field.");
  }
});

// ✅ Renamed default component to match expected routing standards
export default function IndexRouteScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [trackingActive, setTrackingActive] = useState(false);

  useEffect(() => {
    const setupAuth = async () => {
      console.log("[DEBUG LOG] App Mounted. Checking existing session state...");
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("[DEBUG LOG] Session fetch check encountered error:", sessionError.message);
        }

        if (session) {
          console.log("[DEBUG LOG] Active session found for User UUID:", session.user.id);
          setIsAuthenticated(true);
        } else {
          console.log("[DEBUG LOG] No active session found. Triggering silent Anonymous login...");
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.error("[DEBUG LOG] ❌ Anonymous Authentication failure:", error.message);
            throw error;
          }
          if (data?.session) {
            console.log("[DEBUG LOG] ✅ Anonymous Sign-In complete. Generated User UUID:", data.session.user.id);
            setIsAuthenticated(true);
          }
        }
      } catch (err: any) {
        console.error("[DEBUG LOG] Execution path failed inside Auth startup routine:", err.message);
        Alert.alert("Security Error", "Could not establish secure connection to database.");
      } finally {
        setAuthLoading(false);
      }
    };

    setupAuth();

    Location.hasStartedLocationUpdatesAsync(TASK_NAME).then((active) => {
      console.log(`[DEBUG LOG] OS Check: Is background task '${TASK_NAME}' currently running?`, active);
      setTrackingActive(active);
    });
  }, []);

  const startTracking = async () => {
    console.log("[DEBUG LOG] Start Tracking button pressed. Evaluation chain initialized.");
    
    if (!isAuthenticated) {
      console.error("[DEBUG LOG] Tracking blocked: Client is currently unauthenticated.");
      Alert.alert("Error", "Cannot track location without a secure server token.");
      return;
    }

    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    console.log("[DEBUG LOG] Foreground status reply:", fgStatus);

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    console.log("[DEBUG LOG] Background status reply:", bgStatus);

    if (fgStatus === 'granted' && bgStatus === 'granted') {
      try {
        console.log(`[DEBUG LOG] Requesting OS to launch background task '${TASK_NAME}'...`);
        await Location.startLocationUpdatesAsync(TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: 60000, 
          distanceInterval: 10, 
          showsForegroundNotification: true,
        });
        
        setTrackingActive(true);
        console.log(`[DEBUG LOG] 🚀 Background task '${TASK_NAME}' successfully registered.`);
        Alert.alert("Success", "Safety tracking started in background.");
      } catch (err: any) {
        console.error("[DEBUG LOG] ❌ Task registration configuration aborted by system:", err.message);
        Alert.alert("Error", err.message);
      }
    } else {
      console.warn("[DEBUG LOG] Hardware tracking aborted due to missing permission grants.");
      Alert.alert("Permission Denied", "Both Foreground and Background location permissions are required.");
    }
  };

  const stopTracking = async () => {
    console.log("[DEBUG LOG] Stop Tracking button pressed.");
    try {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
      setTrackingActive(false);
      console.log("[DEBUG LOG] 🛑 Task removed. Location streaming stopped.");
      Alert.alert("Stopped", "Location tracking disabled.");
    } catch (err: any) {
      console.error("[DEBUG LOG] Error caught while trying to destroy running task framework:", err.message);
    }
  };

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#FF3B30" />
        <Text style={{ marginTop: 10 }}>Securing Connection...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Safety Guard</Text>
        <Text style={styles.subtitle}>
          Status: {trackingActive ? "Active & Syncing" : "Idle"}
        </Text>
        
        {!trackingActive ? (
          <Button title="Start Safety Tracking" onPress={startTracking} color="#FF3B30" />
        ) : (
          <Button title="Stop Tracking" onPress={stopTracking} color="#555" />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30 },
});
