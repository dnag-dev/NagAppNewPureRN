import { AZURE_API_KEY, AZURE_API_URL } from '@env';

export const API_BASE_URL = AZURE_API_URL;

export const API_ENDPOINTS = {
  CHAT: '/chat',
  TRANSCRIBE: '/transcribe',
  HEALTH: '/health'
};

export const API_HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': AZURE_API_KEY
};

export const API_ERRORS = {
  CONFIGURATION: 'Azure API configuration error',
  API_FAILURE: 'Azure API request failed'
};

export const HEALTH_CHECK_CONFIG = {
  timeout: 5000,
  retries: 3
};

export const checkApiHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.HEALTH}`, {
      headers: API_HEADERS,
      timeout: HEALTH_CHECK_CONFIG.timeout
    });
    return response.ok;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}; 