import { Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { Voice } from '@react-native-voice/voice';
import Sound from 'react-native-sound';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import RNFS from 'react-native-fs';
import { AZURE_API_BASE_URL } from '../config/azureApi';

// Enable playback in silence mode and configure Sound
Sound.setCategory('Playback');
Sound.setMode('Default');

class AudioService {
  constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer();
    this.voice = Voice;
    this.isRecording = false;
    this.audioPath = null;
    this.audioChunks = [];
    this.speechDetected = false;
    this.silenceTimer = null;
    this.analyserNode = null;
    this.audioContext = null;
    this.mediaStreamSource = null;
    this.isSafari = Platform.OS === 'ios';
    this.onTranscription = null;
    this.onAudioLevel = null;
    this.consecutiveIdenticalTranscriptions = 0;
    this.lastTranscription = '';
    this.currentPlayer = null;
  }

  async initializeComponents() {
    try {
      console.log('Initializing audio components...');
      
      // Check microphone permission
      const permission = await check(PERMISSIONS.IOS.MICROPHONE);
      console.log('Permission status:', permission);
      
      if (permission === RESULTS.DENIED) {
        console.log('Requesting microphone permission...');
        const result = await request(PERMISSIONS.IOS.MICROPHONE);
        console.log('Permission request result:', result);
        if (result !== RESULTS.GRANTED) {
          throw new Error('Microphone permission not granted');
        }
      } else if (permission === RESULTS.BLOCKED) {
        throw new Error('Microphone permission is blocked. Please enable it in settings.');
      }

      // Initialize voice recognition
      const isAvailable = await this.voice.isAvailable();
      console.log('Voice recognition available:', isAvailable);
      
      if (!isAvailable) {
        throw new Error('Voice recognition is not available');
      }

      // Initialize audio recorder
      await this.audioRecorderPlayer.setSubscriptionDuration(0.1);
      this.audioRecorderPlayer.addRecordBackListener((e) => {
        if (this.onAudioLevel) {
          const level = Math.min(1, Math.max(0, e.currentMetering / 60));
          this.onAudioLevel(level);
        }
      });

      console.log('Audio components initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize audio components:', error);
      throw error;
    }
  }

  async startRecording() {
    try {
      if (this.isRecording) {
        console.warn('Recording is already in progress');
        return;
      }

      console.log('Starting recording...');
      this.isRecording = true;
      this.audioChunks = [];
      this.speechDetected = false;

      // Start voice recognition
      await this.voice.start('en-US');

      // Start audio recording
      const path = Platform.select({
        ios: `${RNFS.DocumentDirectoryPath}/audio.m4a`,
        android: `${RNFS.DocumentDirectoryPath}/audio.mp4`,
      });
      
      await this.audioRecorderPlayer.startRecorder(path);
      this.audioPath = path;
      
      // Set maximum recording time
      this.longRecordingTimer = setTimeout(() => {
        if (this.isRecording) {
          console.log('Maximum recording time reached');
          this.stopRecording();
        }
      }, 20000); // 20 seconds max

      return path;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  async stopRecording() {
    try {
      if (!this.isRecording) {
        console.warn('No recording in progress');
        return null;
      }

      console.log('Stopping recording...');
      this.isRecording = false;
      
      // Clear timers
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      if (this.longRecordingTimer) {
        clearTimeout(this.longRecordingTimer);
        this.longRecordingTimer = null;
      }

      // Stop voice recognition
      await this.voice.stop();

      // Stop audio recording
      await this.audioRecorderPlayer.stopRecorder();
      this.audioRecorderPlayer.removeRecordBackListener();

      // Verify the audio file exists and has content
      if (this.audioPath) {
        const fileInfo = await RNFS.stat(this.audioPath);
        if (fileInfo.size < 1000) { // Less than 1KB is probably just noise
          throw new Error('Audio too quiet or too short');
        }
        if (fileInfo.size > 25 * 1024 * 1024) { // 25MB limit
          throw new Error('Audio too long');
        }
        return this.audioPath;
      }

      return null;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  handleSilence() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    
    this.silenceTimer = setTimeout(() => {
      if (this.isRecording && this.speechDetected) {
        console.log('Silence detected, stopping recording');
        this.stopRecording();
      }
    }, 1500);
  }

  async playAudio(audioUrl) {
    try {
      console.log('Playing audio from URL:', audioUrl);
      
      // Stop any currently playing audio
      if (this.currentPlayer) {
        await this.stopAudio();
      }

      // Download the audio file if it's a URL
      let audioPath = audioUrl;
      if (audioUrl.startsWith('http')) {
        const filename = audioUrl.split('/').pop();
        audioPath = `${RNFS.DocumentDirectoryPath}/${filename}`;
        await RNFS.downloadFile({
          fromUrl: audioUrl,
          toFile: audioPath,
        }).promise;
      }

      // Play the audio
      this.currentPlayer = new Sound(audioPath, '', (error) => {
        if (error) {
          console.error('Failed to load audio:', error);
          return;
        }
        this.currentPlayer.play((success) => {
          if (!success) {
            console.error('Playback failed');
          }
          this.currentPlayer.release();
          this.currentPlayer = null;
        });
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw error;
    }
  }

  async stopAudio() {
    try {
      if (this.currentPlayer) {
        this.currentPlayer.stop();
        this.currentPlayer.release();
        this.currentPlayer = null;
      }
    } catch (error) {
      console.error('Error stopping audio:', error);
      throw error;
    }
  }

  handleSpeechStart(e) {
    console.log('Speech started', e);
    this.speechDetected = true;
  }

  handleSpeechEnd(e) {
    console.log('Speech ended', e);
    this.speechDetected = false;
  }

  handleSpeechResults(e) {
    console.log('Speech results', e);
    if (this.onTranscription && e.value && e.value.length > 0) {
      const transcription = e.value[0];
      if (transcription === this.lastTranscription) {
        this.consecutiveIdenticalTranscriptions++;
        if (this.consecutiveIdenticalTranscriptions >= 3) {
          this.stopRecording();
        }
      } else {
        this.consecutiveIdenticalTranscriptions = 0;
      }
      this.lastTranscription = transcription;
      this.onTranscription(transcription);
    }
  }

  handleSpeechError(e) {
    console.error('Speech error:', e);
  }

  async destroy() {
    try {
      console.log('Destroying audio service...');
      
      // Stop any ongoing recording
      if (this.isRecording) {
        await this.stopRecording();
      }
      
      // Stop any playing audio
      await this.stopAudio();
      
      // Stop voice recognition
      await this.voice.destroy();
      
      // Clean up audio files
      if (this.audioPath) {
        await RNFS.unlink(this.audioPath).catch(() => {});
      }
      
      // Reset state
      this.isRecording = false;
      this.audioPath = null;
      this.audioChunks = [];
      this.speechDetected = false;
      this.silenceTimer = null;
      this.analyserNode = null;
      this.audioContext = null;
      this.mediaStreamSource = null;
      this.consecutiveIdenticalTranscriptions = 0;
      this.lastTranscription = '';
      this.currentPlayer = null;
      
      console.log('Audio service destroyed successfully');
    } catch (error) {
      console.error('Error destroying audio service:', error);
      throw error;
    }
  }

  async stopAll() {
    try {
      console.log('Stopping all audio services...');
      await this.stopRecording();
      await this.stopAudio();
      console.log('All audio services stopped');
    } catch (error) {
      console.error('Error stopping all audio services:', error);
      throw error;
    }
  }

  async sendAudioToAzure(audioPath) {
    try {
      console.log('=== Starting Azure Audio Processing ===');
      console.log('Audio path:', audioPath);

      // Read the audio file
      const audioData = await RNFS.readFile(audioPath, 'base64');
      console.log('Audio data read successfully');

      // Send to Azure for transcription
      const response = await fetch(`${AZURE_API_BASE_URL}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_data: audioData,
          format: Platform.OS === 'ios' ? 'm4a' : 'mp4',
        }),
      });

      if (!response.ok) {
        throw new Error(`Azure API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Azure transcription result:', result);
      return result;
    } catch (error) {
      console.error('Error sending audio to Azure:', error);
      throw error;
    }
  }

  async processVoiceChat(transcription) {
    try {
      console.log('Processing voice chat with transcription:', transcription);
      
      // Send transcription to Azure for processing
      const response = await fetch(`${AZURE_API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: transcription,
        }),
      });

      if (!response.ok) {
        throw new Error(`Azure API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received response from Azure:', data);

      // Play the audio response
      if (data.audio_url) {
        await this.playAudio(data.audio_url);
      }

      return data;
    } catch (error) {
      console.error('Error processing voice chat:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const audioService = new AudioService();
export default audioService;