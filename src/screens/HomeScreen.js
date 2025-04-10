import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, SafeAreaView, StatusBar, Alert } from 'react-native';
import RNFS from 'react-native-fs';
import audioService from '../services/audioService';
import chatService from '../services/chatService';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const HomeScreen = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        await audioService.initializeComponents();

        audioService.onTranscription = (text) => {
          setTranscription(text);
        };

        audioService.onAudioLevel = (level) => {
          setAudioLevel(level);
        };

        const isHealthy = await chatService.checkHealth();
        if (!isHealthy) {
          setError('Server is not responding. Please check your connection.');
        }
      } catch (error) {
        console.error('Failed to initialize audio service:', error);
        setError('Failed to initialize audio service. Please check permissions.');
      }
    };

    initializeAudio();

    return () => {
      audioService.destroy().catch(error => {
        console.error('Error cleaning up audio service:', error);
      });
    };
  }, []);

  const startRecording = async () => {
    try {
      setIsRecording(true);
      startPulseAnimation();
      startScaleAnimation();
      setError(null);
      
      await audioService.startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      stopPulseAnimation();
      stopScaleAnimation();
      setError('Failed to start recording. Please check permissions.');
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      stopPulseAnimation();
      stopScaleAnimation();
      
      const audioPath = await audioService.stopRecording();
      
      if (audioPath) {
        await processAudio(audioPath);
      } else {
        setError('No audio recorded. Please try again.');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError('Failed to process recording. Please try again.');
    }
  };

  const processAudio = async (audioPath) => {
    try {
      setIsProcessing(true);
      setError(null);
      
      const text = await chatService.transcribeAudio(audioPath);
      if (text) {
        setTranscription(text);
        await getAIResponse(text);
      } else {
        setError('No transcription available. Please try again.');
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      setError('Failed to transcribe audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getAIResponse = async (text) => {
    try {
      const response = await chatService.getChatResponse(text);
      if (response && response.audio_url) {
        await audioService.playAudio(response.audio_url);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      setError('Failed to get AI response. Please try again.');
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.setValue(1);
  };

  const startScaleAnimation = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const stopScaleAnimation = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1a1a1a', '#2a2a2a']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Voice Assistant</Text>
          
          <View style={styles.recordingContainer}>
            <Animated.View
              style={[
                styles.recordingButton,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                style={[
                  styles.button,
                  isRecording && styles.recording,
                ]}
                disabled={isProcessing}
              >
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <MaterialIcons
                    name={isRecording ? "stop" : "mic"}
                    size={32}
                    color="#fff"
                  />
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <Text style={styles.transcription}>
              {isProcessing ? 'Processing...' : transcription || 'Tap to speak'}
            </Text>
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 40,
    textAlign: 'center',
  },
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordingButton: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recording: {
    backgroundColor: '#FF3B30',
  },
  audioLevelContainer: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioLevel: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 10,
    width: '100%',
  },
  errorText: {
    marginLeft: 10,
    color: '#FF3B30',
    fontSize: 16,
  },
  transcriptionContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    width: '100%',
  },
  transcriptionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  transcriptionText: {
    fontSize: 16,
    color: 'white',
    lineHeight: 24,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
  },
  processingText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 16,
  },
  error: {
    color: '#FF3B30',
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 10,
    width: '100%',
  },
  transcription: {
    color: 'white',
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    width: '100%',
  },
});

export default HomeScreen;