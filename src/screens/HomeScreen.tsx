import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  SafeAreaView, 
  StatusBar, 
  ViewStyle,
  TextStyle
} from 'react-native';
import RNFS from 'react-native-fs';
import audioService from '../services/audioService';
import chatService from '../services/chatService';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface Styles {
  container: ViewStyle;
  gradient: ViewStyle;
  content: ViewStyle;
  title: TextStyle;
  recordingContainer: ViewStyle;
  recordingButton: ViewStyle;
  button: ViewStyle;
  recording: ViewStyle;
  error: TextStyle;
  transcription: TextStyle;
}

const HomeScreen: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const pulseAnim = useRef<Animated.Value>(new Animated.Value(1)).current;
  const scaleAnim = useRef<Animated.Value>(new Animated.Value(1)).current;

  useEffect(() => {
    const initializeAudio = async (): Promise<void> => {
      try {
        await audioService.initializeComponents();

        audioService.onTranscription = (text: string) => {
          setTranscription(text);
        };

        audioService.onAudioLevel = (level: number) => {
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

  const startRecording = async (): Promise<void> => {
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

  const stopRecording = async (): Promise<void> => {
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

  const processAudio = async (audioPath: string): Promise<void> => {
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

  const getAIResponse = async (text: string): Promise<void> => {
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

  const startPulseAnimation = (): void => {
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

  const stopPulseAnimation = (): void => {
    pulseAnim.setValue(1);
  };

  const startScaleAnimation = (): void => {
    Animated.spring(scaleAnim, {
      toValue: 1.1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const stopScaleAnimation = (): void => {
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

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  gradient: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 40,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  recordingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  recordingButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4a4a4a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recording: {
    backgroundColor: '#ff4444',
  },
  error: {
    color: '#ff4444',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  transcription: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    fontSize: 16,
    lineHeight: 24,
  },
});

export default HomeScreen; 