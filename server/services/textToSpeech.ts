import { defaultAIProvider } from '../providers/aiProvider.ts';
import { audioStorage } from './audioStorage.ts';

export type VoiceOption = 'Zephyr' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir';

export const textToSpeechService = {
  async synthesize(params: {
    text: string;
    voiceName?: VoiceOption;
    style?: string;
    saveToDisk?: boolean;
  }): Promise<{ audioBase64: string; mimeType: string; audioUrl?: string }> {
    const voice = params.voiceName || 'Charon';
    const result = await defaultAIProvider.synthesizeSpeech({
      text: params.text,
      voiceName: voice,
      style: params.style,
    });

    let audioUrl: string | undefined;
    if (params.saveToDisk && result.audioBase64) {
      const saved = audioStorage.saveAudio(result.audioBase64, 'wav');
      audioUrl = saved.url;
    }

    return {
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      audioUrl,
    };
  },
};
