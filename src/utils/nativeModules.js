import { NativeModules, NativeEventEmitter } from 'react-native';
import Sound from 'react-native-sound';
import Tts from 'react-native-tts';
import Voice from '@react-native-voice/voice';

// Initialize modules with safe defaults
let voiceEmitter = null;
let TTS = null;

// Debug logging
console.log('NativeModules:', NativeModules);
console.log('Voice module available:', !!Voice);

try {
  // Initialize Voice module
  if (Voice && typeof Voice === 'object' && Voice.getConstants) {
    console.log('Voice module initialized:', Voice);
    
    // Only create emitter if we have a valid Voice module with getConstants
    voiceEmitter = new NativeEventEmitter(Voice);
    console.log('Voice emitter created:', voiceEmitter);
  } else {
    console.warn('Voice module is not properly initialized');
  }
} catch (error) {
  console.error('Voice module initialization failed:', error);
}

try {
  // Initialize TTS module
  TTS = NativeModules.TTS;
  console.log('TTS module initialized:', TTS);
} catch (error) {
  console.warn('TTS module initialization failed:', error);
}

// Initialize Sound module with error handling
try {
  Sound.setCategory('Playback');
  console.log('Sound module initialized');
} catch (error) {
  console.warn('Sound module initialization failed:', error);
}

// Initialize TTS with error handling
try {
  Tts.setDefaultLanguage('en-US');
  console.log('TTS language set to en-US');
} catch (error) {
  console.warn('TTS language setting failed:', error);
}

export { Voice, voiceEmitter, Sound, TTS }; 