import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export default function LaserDinosaur() {
  const position = useRef(new Animated.Value(-100)).current;
  const laser = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Dinosaur walks across screen
    Animated.timing(position, {
      toValue: 400,
      duration: 3000,
      useNativeDriver: true,
    }).start();

    // Laser shoots periodically
    const shootLaser = () => {
      Animated.sequence([
        Animated.timing(laser, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(laser, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const interval = setInterval(shootLaser, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: position }],
        },
      ]}
    >
      <View style={styles.dino}>
        <View style={styles.head}>
          <View style={styles.eye} />
        </View>
        <View style={styles.body} />
        <View style={styles.leg} />
        <View style={styles.leg2} />
        <View style={styles.tail} />
      </View>
      <Animated.View
        style={[
          styles.laser,
          {
            opacity: laser,
            transform: [{ scaleX: laser.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }],
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dino: {
    width: 60,
    height: 50,
    position: 'relative',
  },
  head: {
    width: 25,
    height: 20,
    backgroundColor: '#10b981',
    borderRadius: 8,
    position: 'absolute',
    top: 0,
    left: 35,
  },
  eye: {
    width: 4,
    height: 4,
    backgroundColor: '#000',
    borderRadius: 2,
    position: 'absolute',
    top: 6,
    right: 4,
  },
  body: {
    width: 35,
    height: 25,
    backgroundColor: '#10b981',
    borderRadius: 12,
    position: 'absolute',
    top: 15,
    left: 15,
  },
  leg: {
    width: 8,
    height: 15,
    backgroundColor: '#10b981',
    position: 'absolute',
    bottom: 0,
    left: 20,
    borderRadius: 4,
  },
  leg2: {
    width: 8,
    height: 15,
    backgroundColor: '#10b981',
    position: 'absolute',
    bottom: 0,
    left: 35,
    borderRadius: 4,
  },
  tail: {
    width: 20,
    height: 10,
    backgroundColor: '#10b981',
    borderRadius: 5,
    position: 'absolute',
    top: 20,
    left: 0,
  },
  laser: {
    width: 100,
    height: 3,
    backgroundColor: '#ef4444',
    marginLeft: 5,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
