import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';

const OrbAnimation = ({ color = '#4A90E2', size = 120, text = '' }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const innerPulseAnim = useRef(new Animated.Value(1)).current;
  const textScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Create continuous pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Create continuous glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.3,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Create continuous rotation animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Create ring rotation animation
    Animated.loop(
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Create inner pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(innerPulseAnim, {
          toValue: 1.2,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(innerPulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Create text scale animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(textScaleAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(textScaleAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ringSpin = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.orb,
          styles.outerGlow,
          {
            backgroundColor: color,
            opacity: 0.1,
            transform: [{ scale: glowAnim }],
          },
        ]}
      />
      
      {/* Rotating rings */}
      <Animated.View
        style={[
          styles.orb,
          styles.ring,
          {
            borderWidth: 2,
            borderColor: color,
            backgroundColor: 'transparent',
            transform: [{ rotate: ringSpin }],
          },
        ]}
      />
      
      {/* Main orb */}
      <Animated.View
        style={[
          styles.orb,
          {
            backgroundColor: color,
            transform: [
              { scale: pulseAnim },
              { rotate: spin }
            ],
          },
        ]}
      />
      
      {/* Inner glow */}
      <Animated.View
        style={[
          styles.orb,
          styles.innerGlow,
          {
            backgroundColor: color,
            opacity: 0.4,
            transform: [{ scale: innerPulseAnim }],
          },
        ]}
      />
      
      {/* Core */}
      <Animated.View
        style={[
          styles.orb,
          styles.core,
          {
            backgroundColor: color,
            opacity: 0.8,
            transform: [{ scale: innerPulseAnim.interpolate({
              inputRange: [1, 1.2],
              outputRange: [0.3, 0.4],
            }) }],
          },
        ]}
      />

      {/* Centered Text */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            transform: [{ scale: textScaleAnim }],
          },
        ]}
      >
        <Text style={styles.orbText}>{text}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  outerGlow: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  innerGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  core: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  orbText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default OrbAnimation; 