import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { API_BASE_URL, API_ENDPOINTS, API_HEADERS } from '../config/azureApi';

interface ChatResponse {
  text?: string;
  audio_url: string;
}

class ChatService {
  private isSafari: boolean;

  constructor() {
    this.isSafari = Platform.OS === 'ios';
  }

  async transcribeAudio(audioPath: string): Promise<string> {
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
        throw new Error('Failed to transcribe audio');
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

  async getChatResponse(text: string): Promise<ChatResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHAT}`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error('Failed to get chat response');
      }

      const data = await response.json();
      if (!data.audio_url) {
        throw new Error('No audio response received');
      }

      return data as ChatResponse;
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
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