import { Platform } from 'react-native';
import AudioRecorderPlayer, { AudioSet, PlayBackType, RecordBackType } from 'react-native-audio-recorder-player';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Voice } from '@react-native-voice/voice';
import RNFS from 'react-native-fs';

interface AudioServiceConfig {
  maxDuration: number;
  silenceThreshold: number;
  subscriptionDuration: number;
}

interface AudioServiceCallbacks {
  onTranscription?: (text: string) => void;
  onAudioLevel?: (level: number) => void;
}

class AudioService {
  private audioRecorderPlayer: AudioRecorderPlayer;
  private isRecording: boolean;
  private audioChunks: string[];
  private speechDetected: boolean;
  private config: AudioServiceConfig;
  private callbacks: AudioServiceCallbacks;
  private recordingTimeout?: NodeJS.Timeout;

  constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer();
    this.isRecording = false;
    this.audioChunks = [];
    this.speechDetected = false;
    this.callbacks = {};
    this.config = {
      maxDuration: 20000, // 20 seconds
      silenceThreshold: 0.1,
      subscriptionDuration: 500,
    };
  }

  set onTranscription(callback: (text: string) => void) {
    this.callbacks.onTranscription = callback;
  }

  set onAudioLevel(callback: (level: number) => void) {
    this.callbacks.onAudioLevel = callback;
  }

  async initializeComponents(): Promise<void> {
    try {
      // Check and request microphone permission
      const permission = Platform.select({
        ios: PERMISSIONS.IOS.MICROPHONE,
        android: PERMISSIONS.ANDROID.RECORD_AUDIO,
      });

      if (!permission) {
        throw new Error('Platform not supported');
      }

      const permissionStatus = await check(permission);
      
      if (permissionStatus === RESULTS.DENIED) {
        const result = await request(permission);
        if (result !== RESULTS.GRANTED) {
          throw new Error('Microphone permission denied');
        }
      } else if (permissionStatus === RESULTS.BLOCKED) {
        throw new Error('Microphone permission is blocked. Please enable it in settings');
      }

      // Initialize voice recognition
      try {
        // Set up voice recognition listeners
        Voice.onSpeechResults = this.handleSpeechResults;
        Voice.onSpeechError = this.handleSpeechError;

        // Initialize Voice
        const isAvailable = await Voice.isAvailable();
        if (!isAvailable) {
          console.warn('Voice recognition is not available');
          return;
        }

        // Start and immediately stop to initialize
        await Voice.start('en-US');
        await Voice.cancel();
      } catch (voiceError) {
        console.error('Voice initialization error:', voiceError);
        // Continue without voice recognition
      }

      // Set up audio recorder
      const audioSet: AudioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: AVEncodingOption.aac,
      };

      await this.audioRecorderPlayer.setSubscriptionDuration(this.config.subscriptionDuration);
      await this.audioRecorderPlayer.prepare(audioSet);
    } catch (error) {
      console.error('Failed to initialize audio components:', error);
      throw error;
    }
  }

  async startRecording(): Promise<void> {
    try {
      if (!this.isRecording) {
        this.isRecording = true;
        this.audioChunks = [];
        this.speechDetected = false;

        // Start voice recognition
        try {
          await Voice.start('en-US');
        } catch (voiceError) {
          console.error('Failed to start voice recognition:', voiceError);
        }

        // Start audio recording
        const audioPath = Platform.select({
          ios: 'audio.wav',
          android: `${RNFS.CachesDirectoryPath}/audio.wav`,
        });

        if (!audioPath) {
          throw new Error('Could not determine audio path');
        }

        await this.audioRecorderPlayer.startRecorder(audioPath);
        this.audioRecorderPlayer.addRecordBackListener((e: RecordBackType) => {
          if (e.currentMetering) {
            const level = Math.max(0, Math.min(1, e.currentMetering / 160));
            if (this.callbacks.onAudioLevel) {
              this.callbacks.onAudioLevel(level);
            }
          }
        });

        // Set timeout for maximum recording duration
        this.recordingTimeout = setTimeout(() => {
          this.stopRecording().catch(console.error);
        }, this.config.maxDuration);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (!this.isRecording) {
        return null;
      }

      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
      }

      this.isRecording = false;
      const audioPath = await this.audioRecorderPlayer.stopRecorder();
      this.audioRecorderPlayer.removeRecordBackListener();

      // Stop voice recognition
      try {
        await Voice.cancel();
      } catch (voiceError) {
        console.error('Failed to stop voice recognition:', voiceError);
      }

      // Verify the audio file exists and has content
      const exists = await RNFS.exists(audioPath);
      if (!exists) {
        throw new Error('Audio file not found');
      }

      const stats = await RNFS.stat(audioPath);
      if (!stats || stats.size < 1000) { // Less than 1KB is probably too quiet
        throw new Error('Recording too short or too quiet');
      }

      return audioPath;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    }
  }

  async playAudio(url: string): Promise<void> {
    try {
      const localPath = `${RNFS.CachesDirectoryPath}/response_audio.wav`;
      
      // Download the file if it's a URL
      if (url.startsWith('http')) {
        await RNFS.downloadFile({
          fromUrl: url,
          toFile: localPath,
        }).promise;
      }

      await this.audioRecorderPlayer.startPlayer(localPath);
      
      // Clean up after playback
      this.audioRecorderPlayer.addPlayBackListener((e: PlayBackType) => {
        if (e.currentPosition === e.duration) {
          this.audioRecorderPlayer.removePlayBackListener();
        }
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw error;
    }
  }

  private handleSpeechResults = (e: SpeechResultsEvent): void => {
    if (e.value && e.value.length > 0) {
      const text = e.value[0];
      if (this.callbacks.onTranscription) {
        this.callbacks.onTranscription(text);
      }
    }
  };

  private handleSpeechError = (e: SpeechErrorEvent): void => {
    console.error('Speech recognition error:', e.error);
  };

  private handleSilence(): void {
    if (this.isRecording) {
      this.stopRecording().catch(console.error);
    }
  }

  async destroy(): Promise<void> {
    try {
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
      }

      if (this.isRecording) {
        await this.stopRecording();
      }

      await this.audioRecorderPlayer.stopPlayer();
      await Voice.destroy();
      
      this.isRecording = false;
      this.audioChunks = [];
      this.speechDetected = false;
      this.callbacks = {};
    } catch (error) {
      console.error('Error destroying audio service:', error);
      throw error;
    }
  }
}

export default new AudioService(); 