import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { Voice } from '@react-native-voice/voice';
import AudioService from '../services/audioService';
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

  useEffect(() => {
    // Initialize AudioService
    initializeAudioService();
    
    // Only set up event listeners if Voice module exists
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;

    // Cleanup function to remove listeners
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      if (AudioService) {
        AudioService.destroy();
      }
    };
  }, []);

  const initializeAudioService = async () => {
    try {
      await AudioService.initializeComponents();
      
      // Set up callbacks
      AudioService.onTranscription = (text) => {
        setTranscript(text);
      };
      
      AudioService.onAudioLevel = (level) => {
        setAudioLevel(level);
      };
      
      console.log('Audio service initialized successfully in VoiceChatScreen');
    } catch (error) {
      console.error('Failed to initialize audio service in VoiceChatScreen:', error);
      setError('Failed to initialize audio service. Please restart the app.');
    }
  };

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
    if (e.value && e.value.length > 0) {
      setTranscript(e.value[0]);
    }
  };

  const onSpeechError = (e) => {
    console.error('Speech error', e);
    setIsListening(false);
    setError(`Speech recognition error: ${e.error?.message || 'Unknown error'}`);
  };

  const startListening = async () => {
    try {
      setError(null);
      setIsProcessing(true);
      console.log('Starting listening...');
      
      // Start recording with AudioService instead of Voice
      await AudioService.startRecording();
      await AudioService.startVoiceRecognition();
      
      setIsListening(true);
      setIsRecording(true);
      startPulseAnimation();
      console.log('Voice started successfully');
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      setError(`Failed to start voice recognition: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopListening = async () => {
    try {
      setIsProcessing(true);
      console.log('Stopping listening...');
      
      // Stop voice recognition first
      await AudioService.stopVoiceRecognition();
      
      // Then stop recording
      const audioPath = await AudioService.stopRecording();
      
      setIsListening(false);
      setIsRecording(false);
      stopPulseAnimation();
      
      console.log('Voice stopped successfully, audioPath:', audioPath);
      
      // Process the recording if we have a transcript
      if (transcript) {
        await processTranscription(transcript, audioPath);
      } else {
        setError('No speech detected. Please try again.');
      }
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      setError(`Failed to stop voice recognition: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const processTranscription = async (text, audioPath) => {
    try {
      setIsProcessing(true);
      console.log('Processing transcription:', text);
      
      // Get AI response using Azure API
      const result = await AudioService.processVoiceChat(text);
      
      if (result && result.response) {
        setResponse(result.response);
      } else {
        throw new Error('No response received from AI');
      }
    } catch (error) {
      console.error('Error processing transcription:', error);
      setError(`Failed to process speech: ${error.message}`);
    } finally {
      setIsProcessing(false);
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
    pulseAnim.stopAnimation();
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
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.buttonText}>
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </Text>
        )}
      </TouchableOpacity>
      
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>You said:</Text>
        <Text style={styles.resultText}>{transcript || 'Start speaking...'}</Text>
        
        {response && (
          <>
            <Text style={[styles.resultsTitle, {marginTop: 20}]}>Nag responds:</Text>
            <Text style={styles.resultText}>{response}</Text>
          </>
        )}
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
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
    backgroundColor: '#333333',
    padding: 15,
    borderRadius: 10,
    maxHeight: '50%',
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
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    padding: 10,
    borderRadius: 5,
    marginTop: 15,
  },
  errorText: {
    color: '#FF5555',
    fontSize: 14,
  },
});

export default VoiceChatScreen;