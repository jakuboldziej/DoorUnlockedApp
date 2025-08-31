import { Platform } from 'react-native';

export const SOUND_CONFIG = {
  CRITICAL_ALARM: 'nuclear_alarm',
  DEFAULT: 'default'
} as const;

export const getSoundName = (isCritical: boolean): string => {
  if (!isCritical) return SOUND_CONFIG.DEFAULT;
  
  if (Platform.OS === 'android') {
    return SOUND_CONFIG.CRITICAL_ALARM;
  } else if (Platform.OS === 'ios') {
    return `${SOUND_CONFIG.CRITICAL_ALARM}.mp3`;
  }
  
  return SOUND_CONFIG.CRITICAL_ALARM;
};

export const getChannelSoundName = (isCritical: boolean): string => {
  if (!isCritical) return SOUND_CONFIG.DEFAULT;
  
  return SOUND_CONFIG.CRITICAL_ALARM;
};
