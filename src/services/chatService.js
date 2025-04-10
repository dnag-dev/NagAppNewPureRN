import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { API_BASE_URL, API_ENDPOINTS, API_HEADERS, API_ERRORS } from '../config/azureApi';

class ChatService {
  constructor() {
    this.isSafari = Platform.OS === 'ios';
  }

  async transcribeAudio(audioPath) {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: audioPath,
        type: 'audio/wav',
        name: 'audio.wav'
      });

      if (this.isSafari) {
        formData.append('browser', 'safari');
        formData.append('format', 'wav');
        formData.append('sample_rate', '16000');
      }

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TRANSCRIBE}`, {
        method: 'POST',
        headers: {
          ...API_HEADERS,
          'Content-Type': 'multipart/form-data',
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(API_ERRORS.API_FAILURE);
      }

      const data = await response.json();
      const transcription = data.transcription || data.transcript;

      if (!transcription || transcription.trim() === '') {
        throw new Error('No speech detected');
      }

      return transcription;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  async getChatResponse(text) {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHAT}`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(API_ERRORS.API_FAILURE);
      }

      const data = await response.json();
      if (!data.audio_url) {
        throw new Error('No audio response received');
      }

      return data;
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }

  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.HEALTH}`, {
        headers: API_HEADERS
      });
      return response.ok;
    } catch (error) {
      console.error('Health check error:', error);
      return false;
    }
  }
}

export default new ChatService(); 