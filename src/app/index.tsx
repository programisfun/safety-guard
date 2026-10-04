import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager'; 
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TASK_NAME = 'background-location-task';

// Global reference array to hold logs we want to expose to the UI
let globalLogs: string[] = [];
let updateUiLogsCallback: ((logs: string[]) => void) | null = null;

function addDebugLog(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const formattedLog = `[${timestamp}] ${message}`;
  console.log(formattedLog);
  globalLogs = [formattedLog, ...globalLogs].slice(0, 50); // Keep last 50 logs
  if (updateUiLogsCallback) {
    updateUiLogsCallback(globalLogs);
  }
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
    
    addDebugLog(`📍 Parsed Coordinates -> Lat: ${latitude}, Lon: ${longitude} (±${accuracy}m)`);
    
    try {
      addDebugLog("📤 Attempting network database insert into Supabase...");
      
      // Explicitly forcing an auth recovery check right before insert to handle background memory isolation
      const { data: { session } } = await supabase.auth.getSession();
      addDebugLog(`🔑 BG Session Status: ${session ? 'Authenticated' : 'No Active Session'}`);

      const { data: dbData, error: dbError } = await supabase
        .from('locations')
        .insert([{ latitude, longitude }])
        .select();

      if (dbError) {
        addDebugLog(`❌ Supabase Database rejected write: ${JSON.stringify(dbError)}`);
      } else {
        addDebugLog(`✅ Saved row successfully! ID details: ${JSON.stringify(dbData)}`);
      }
    } catch (err: any) {
      addDebugLog(`❌ Critical System network failure inside task: ${err.message || err}`);
    }
  } else {
    addDebugLog("⚠️ Data layout is missing standard .locations array.");
  }
});

export default function IndexRouteScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [trackingActive, setTrackingActive] = useState(false);
  const [uiLogs, setUiLogs] = useState<string[]>([]);

  // Connect the global background logging utility to this component's local state hook
  useEffect(() => {
    updateUiLogsCallback = (logs) => setUiLogs(logs);
    setUiLogs(globalLogs);
    return () => {
      updateUiLogsCallback = null;
    };
  }, []);

  useEffect(() => {
    const setupAuth = async () => {
      addDebugLog("🔄 App Mounted. Checking existing session state...");
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          addDebugLog(`❌ Session fetch error: ${sessionError.message}`);
        }

        if (session) {
          addDebugLog(`✅ Active session found for User: ${session.user.id}`);
          setIsAuthenticated(true);
        } else {
          addDebugLog("🔄 No active session. Triggering silent Anonymous login...");
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            addDebugLog(`❌ Anonymous Auth failure: ${error.message}`);
            throw error;
          }
          if (data?.session) {
            addDebugLog(`✅ Anonymous Sign-In complete. User UUID: ${data.session.user.id}`);
            setIsAuthenticated(true);
          }
        }
      } catch (err: any) {
        addDebugLog(`❌ Execution path failed inside Auth routine: ${err.message}`);
        Alert.alert("Security Error", "Could not establish secure connection to database.");
      } finally {
        setAuthLoading(false);
      }
    };

    setupAuth();

    Location.hasStartedLocationUpdatesAsync(TASK_NAME).then((active) => {
      addDebugLog(`📋 OS Check: Is background task running? ${active}`);
      setTrackingActive(active);
    });
  }, []);

  const startTracking = async () => {
    addDebugLog("🚀 Start Tracking button pressed. Evaluation chain initialized.");
    
    if (!isAuthenticated) {
      addDebugLog("❌ Tracking blocked: Client is currently unauthenticated.");
      Alert.alert("Error", "Cannot track location without a secure server token.");
      return;
    }

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
        timeInterval: 10000, // Reduced to 10 seconds for easier debug testing
        distanceInterval: 2,  // Reduced to 2 meters for easier debug testing
        showsForegroundNotification: true,
        // Added required Android explicit background options to mitigate system termination crashes
        foregroundService: {
          notificationTitle: "Safety Guard Active",
          notificationBody: "Monitoring your background path safety logs.",
          notificationColor: "#FF3B30",
        }
      });
      
      setTrackingActive(true);
      addDebugLog(`🚀 Background task '${TASK_NAME}' successfully registered.`);
      Alert.alert("Success", "Safety tracking started in background.");
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
      addDebugLog(`❌ Error caught while destroying running task framework: ${err.message}`);
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

      {/* 🛠️ IN-APP VISUAL DEBUG LOG CONSOLE */}
      <View style={styles.debugConsole}>
        <Text style={styles.debugTitle}>🔧 Live In-App Logs:</Text>
        <ScrollView style={styles.debugScroll} nestedScrollEnabled={true}>
          {uiLogs.length === 0 ? (
            <Text style={styles.debugTextEmpty}>No activity logged yet.</Text>
          ) : (
            uiLogs.map((log, idx) => (
              <Text key={idx} style={styles.debugText}>
                {log}
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
  debugTextEmpty: { color: '#888', fontSize: 11, style: 'italic' }
});
