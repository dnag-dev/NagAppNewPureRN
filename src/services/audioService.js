import { Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Voice from '@react-native-voice/voice';
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
    this.recordingPath = Platform.select({
      ios: 'audio.m4a',
      android: 'audio.mp4',
    });
    this.isRecording = false;
    this.isPlaying = false;
    this.silenceTimeout = null;
    this.silenceThreshold = -50; // dB threshold for silence detection
    this.silenceDuration = 1500; // ms of silence before stopping
    this.noiseReductionEnabled = true;
    this.currentSound = null;

    // Initialize Voice recognition handlers
    Voice.onSpeechStart = this.handleSpeechStart.bind(this);
    Voice.onSpeechEnd = this.handleSpeechEnd.bind(this);
    Voice.onSpeechResults = this.handleSpeechResults.bind(this);
    Voice.onSpeechError = this.handleSpeechError.bind(this);
  }

  async initializeComponents() {
    try {
      console.log('Initializing audio components...');
      
      // Request microphone permission
      const permission = Platform.select({
        ios: PERMISSIONS.IOS.MICROPHONE,
        android: PERMISSIONS.ANDROID.RECORD_AUDIO,
      });

      console.log('Checking microphone permission...');
      const result = await check(permission);
      console.log('Permission status:', result);
      
      if (result !== RESULTS.GRANTED) {
        console.log('Requesting microphone permission...');
        const requestResult = await request(permission);
        console.log('Permission request result:', requestResult);
        
        if (requestResult !== RESULTS.GRANTED) {
          throw new Error('Microphone permission not granted');
        }
      }

      // Initialize Voice recognition
      const isVoiceAvailable = await Voice.isAvailable();
      console.log('Voice recognition available:', isVoiceAvailable);
      
      if (!isVoiceAvailable) {
        throw new Error('Voice recognition is not available on this device');
      }

      // Configure audio recorder settings
      await this.audioRecorderPlayer.setSubscriptionDuration(0.1); // 100ms

      console.log('Audio components initialized successfully');
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

      const audioSet = Platform.select({
        ios: {
          AVFormatIDKey: 'aac',
          AVSampleRateKey: 16000,
          AVNumberOfChannelsKey: 1,
          AVEncoderAudioQualityKey: 'high',
        },
        android: {
          AudioEncoder: 3, // AAC
          AudioSource: 6, // MIC
          OutputFormat: 2, // MPEG_4
          AudioSamplingRate: 16000,
          AudioChannels: 1,
          AudioEncodingBitRate: 128000,
        },
      });

      // Start recording with audio monitoring
      const uri = await this.audioRecorderPlayer.startRecorder(
        this.recordingPath,
        audioSet
      );

      // Start monitoring audio levels
      this.audioRecorderPlayer.addRecordBackListener((e) => {
        if (e.currentPosition > 0) {
          this.handleAudioLevel(e.currentMetering);
        }
      });

      console.log('Recording started at:', uri);
      return uri;
    } catch (error) {
      console.error('Error starting recording:', error);
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
      this.stopAudioLevelMonitoring();

      const result = await this.audioRecorderPlayer.stopRecorder();
      this.audioRecorderPlayer.removeRecordBackListener();
      console.log('Recording stopped:', result);
      return result;
    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    }
  }

  handleAudioLevel(metering) {
    if (metering < this.silenceThreshold) {
      if (!this.silenceTimeout) {
        this.silenceTimeout = setTimeout(() => {
          console.log('Silence detected, stopping recording...');
          this.stopRecording();
        }, this.silenceDuration);
      }
    } else {
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
    }
  }

  stopAudioLevelMonitoring() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  async startVoiceRecognition() {
    try {
      await Voice.start('en-US');
      console.log('Voice recognition started');
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      throw error;
    }
  }

  async stopVoiceRecognition() {
    try {
      await Voice.stop();
      console.log('Voice recognition stopped');
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      throw error;
    }
  }

  async playAudio(audioSource) {
    try {
      console.log('=== Starting Audio Playback Process ===');
      console.log('Audio source:', audioSource);
      
      if (this.isPlaying) {
        console.log('Stopping current audio playback...');
        await this.stopAudio();
      }

      this.isPlaying = true;
      
      // Create a temporary file path with mp3 extension
      const tempPath = `${RNFS.CachesDirectoryPath}/temp_audio_${Date.now()}.mp3`;
      console.log('Temporary file path:', tempPath);
      
      try {
        if (audioSource.startsWith('http')) {
          // Handle URL-based audio
          console.log('=== Starting Audio Download ===');
          console.log('Downloading from URL:', audioSource);
          
          // First, verify the URL is accessible
          console.log('Verifying URL accessibility...');
          const headResponse = await fetch(audioSource, { method: 'HEAD' });
          console.log('HEAD response status:', headResponse.status);
          
          if (!headResponse.ok) {
            throw new Error(`Audio URL is not accessible: ${headResponse.status}`);
          }
          
          const contentLength = headResponse.headers.get('content-length');
          const contentType = headResponse.headers.get('content-type');
          
          console.log('Audio file metadata:', {
            contentLength,
            contentType
          });
          
          if (!contentType || !contentType.includes('audio')) {
            throw new Error('URL does not point to an audio file');
          }
          
          console.log('Starting file download...');
          const response = await RNFS.downloadFile({
            fromUrl: audioSource,
            toFile: tempPath,
            progress: (response) => {
              const progress = (response.bytesWritten / response.contentLength) * 100;
              console.log(`Download progress: ${progress.toFixed(2)}%`);
            }
          }).promise;
          
          console.log('Download response status:', response.statusCode);
          if (response.statusCode !== 200) {
            throw new Error(`Failed to download audio: ${response.statusCode}`);
          }
          
          console.log('Successfully downloaded audio file');
        } else {
          // Handle base64 audio
          console.log('Writing base64 audio to file');
          await RNFS.writeFile(tempPath, audioSource, 'base64');
          console.log('Successfully wrote audio file');
        }

        // Verify file exists and has content
        const fileStats = await RNFS.stat(tempPath);
        console.log('File stats:', fileStats);
        
        if (!fileStats.isFile() || fileStats.size === 0) {
          throw new Error('Downloaded file is invalid or empty');
        }
        
        console.log('Audio file verified, size:', fileStats.size, 'bytes');
        
      } catch (writeError) {
        console.error('Error processing audio file:', writeError);
        throw writeError;
      }
      
      return new Promise((resolve, reject) => {
        console.log('=== Creating Sound Instance ===');
        // Configure sound before loading
        Sound.setCategory('Playback', true);
        Sound.setMode('Default');
        
        console.log('Creating Sound instance with file:', tempPath);
        
        // Create a new Sound instance with the temporary file
        this.currentSound = new Sound(tempPath, '', (error) => {
          if (error) {
            console.error('Error loading audio:', error);
            this.isPlaying = false;
            RNFS.unlink(tempPath).catch(err => 
              console.error('Error deleting temporary file:', err)
            );
            reject(error);
            return;
          }

          console.log('Audio loaded successfully');
          console.log('Audio duration:', this.currentSound.getDuration(), 'seconds');
          
          // Configure playback settings
          console.log('Configuring playback settings...');
          this.currentSound.setCategory('Playback');
          this.currentSound.setVolume(1.0);
          this.currentSound.setNumberOfLoops(0);
          
          // Play the audio
          console.log('Starting audio playback...');
          this.currentSound.play((success) => {
            console.log('Playback completed, success:', success);
            this.isPlaying = false;
            this.currentSound.release();
            this.currentSound = null;
            
            // Clean up the temporary file
            console.log('Cleaning up temporary file...');
            RNFS.unlink(tempPath).catch(err => 
              console.error('Error deleting temporary file:', err)
            );
            resolve(success);
          });
        });
      });
    } catch (error) {
      console.error('Error in playAudio:', error);
      this.isPlaying = false;
      throw error;
    }
  }

  async stopAudio() {
    try {
      if (this.currentSound) {
        console.log('Stopping current audio...');
        this.currentSound.stop();
        this.currentSound.release();
        this.currentSound = null;
      }
      this.isPlaying = false;
      console.log('Audio stopped successfully');
    } catch (error) {
      console.error('Error stopping audio:', error);
      throw error;
    }
  }

  handleSpeechStart(e) {
    console.log('Speech recognition started:', e);
  }

  handleSpeechEnd(e) {
    console.log('Speech recognition ended:', e);
  }

  handleSpeechResults(e) {
    console.log('Speech recognition results:', e);
    if (e.value && e.value.length > 0) {
      const transcription = e.value[0];
      console.log('Transcription:', transcription);
      // You can emit an event or call a callback here if needed
    }
  }

  handleSpeechError(e) {
    console.error('Speech recognition error:', e);
  }

  async destroy() {
    try {
      if (this.isPlaying) {
        await this.stopAudio();
      }
      
      if (this.isRecording) {
        await this.stopRecording();
      }
      
      this.audioRecorderPlayer.removeRecordBackListener();
      this.audioRecorderPlayer.removePlayBackListener();
      Voice.destroy().then(Voice.removeAllListeners);
      
      this.stopAudioLevelMonitoring();
      
      console.log('Audio service destroyed successfully');
    } catch (error) {
      console.error('Error destroying audio service:', error);
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

export default new AudioService(); 