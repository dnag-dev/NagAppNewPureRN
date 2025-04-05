import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { NativeEventEmitter, NativeModules } from 'react-native';
import Voice from '@react-native-voice/voice';
import { AudioService } from '../services/AudioService';
import { Animated } from 'react-native';

const VoiceChatScreen = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const voiceInitialized = useRef(false);

  useEffect(() => {
    // Check if Voice module exists and is properly initialized
    const voiceModule = Voice;
    
    // Only set up event listeners if Voice module exists
    if (voiceModule) {
      // Since we're now using @react-native-voice/voice, we use its API directly
      // rather than through NativeEventEmitter
      Voice.onSpeechResults = onSpeechResults;
      Voice.onSpeechStart = onSpeechStart;
      Voice.onSpeechEnd = onSpeechEnd;
      Voice.onSpeechError = onSpeechError;
    }

    // Cleanup function to remove listeners
    return () => {
      if (voiceModule) {
        Voice.destroy().then(Voice.removeAllListeners);
      }
    };
  }, []);

  const onSpeechStart = (e) => {
    console.log('Speech started', e);
    setIsListening(true);
  };

  const onSpeechEnd = (e) => {
    console.log('Speech ended', e);
    setIsListening(false);
  };

  const onSpeechResults = (e) => {
    console.log('Speech results', e);
    if (e.value) {
      setTranscript(e.value);
    }
  };

  const onSpeechError = (e) => {
    console.error('Speech error', e);
    setIsListening(false);
  };

  const startListening = async () => {
    try {
      console.log('Starting listening...');
      await Voice.start('en-US');
      setIsListening(true);
      setIsRecording(true);
      startPulseAnimation();
      console.log('Voice started successfully');
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      setError('Failed to start voice recognition');
    }
  };

  const stopListening = async () => {
    try {
      console.log('Stopping listening...');
      await Voice.stop();
      setIsListening(false);
      setIsRecording(false);
      stopPulseAnimation();
      console.log('Voice stopped successfully');
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      setError('Failed to stop voice recognition');
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Chat</Text>
      
      {isRecording && (
        <Animated.View
          style={[
            styles.orb,
            {
              transform: [{scale: pulseAnim}],
              opacity: pulseAnim.interpolate({
                inputRange: [1, 1.5],
                outputRange: [0.5, 1],
              }),
            },
          ]}
        />
      )}

      <TouchableOpacity 
        style={[styles.button, isListening ? styles.activeButton : {}]}
        onPress={isListening ? stopListening : startListening}
      >
        <Text style={styles.buttonText}>
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </Text>
      </TouchableOpacity>
      
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Results:</Text>
        {transcript && (
          <Text style={styles.resultText}>{transcript}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 20,
  },
  button: {
    padding: 16,
    backgroundColor: '#4285F4',
    borderRadius: 30,
    marginVertical: 20,
    width: 200,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#EA4335',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultsContainer: {
    marginTop: 30,
    width: '100%',
  },
  resultsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultText: {
    color: 'white',
    fontSize: 16,
    marginVertical: 5,
  },
  orb: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#007AFF',
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});

export default VoiceChatScreen; 