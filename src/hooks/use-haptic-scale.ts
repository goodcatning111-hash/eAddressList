import * as Haptics from 'expo-haptics';

export function useHapticScale() {
  return () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
}
