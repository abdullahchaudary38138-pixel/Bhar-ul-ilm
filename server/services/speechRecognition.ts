import { Type } from '@google/genai';
import { defaultAIProvider } from '../providers/aiProvider.ts';
import { audioStorage } from './audioStorage.ts';
import { languageDetectionService } from './languageDetection.ts';
import type { TranscriptResult, UncertainSpan } from '../../src/types.ts';

interface AuditSchema {
  confidence: number;
  lowConfidenceWarning: boolean;
  warningMessage: string;
  uncertainSpans: UncertainSpan[];
}

export const speechRecognitionService = {
  async transcribeAndAnalyze(params: {
    audioBase64: string;
    mimeType: string;
    saveAudio?: boolean;
  }): Promise<TranscriptResult> {
    const start = Date.now();
    let audioId: string | undefined;

    if (params.saveAudio !== false) {
      const ext = params.mimeType.includes('webm')
        ? 'webm'
        : params.mimeType.includes('mp3')
          ? 'mp3'
          : params.mimeType.includes('ogg')
            ? 'ogg'
            : 'wav';
      const saved = audioStorage.saveAudio(params.audioBase64, ext);
      audioId = saved.url;
    }

    const transcript = await defaultAIProvider.transcribeAudio({
      audioBase64: params.audioBase64,
      mimeType: params.mimeType,
    });

    const langInfo = languageDetectionService.detect(transcript);

    // Audit transcript for uncertain religious terminology, Quranic references, or ambiguous proper nouns
    let audit: AuditSchema = {
      confidence: transcript.length > 0 ? 0.92 : 0.0,
      lowConfidenceWarning: transcript.length === 0,
      warningMessage: transcript.length === 0 ? 'No clear speech was detected in the recording.' : '',
      uncertainSpans: [],
    };

    if (transcript.length > 0) {
      try {
        audit = await defaultAIProvider.generateStructured<AuditSchema>({
          systemInstruction:
            'You audit multilingual speech-to-text transcripts (Roman Urdu, Urdu, Arabic, English) for an Islamic scholarship assistant. Identify if any proper names (e.g., Umar, Uthman, Bukhari), Quranic Surah/Ayah references, or Arabic religious terms appear ambiguous, phonetically clipped, or uncertain in context. NEVER silently replace uncertain words; flag them so the user can review before submission.',
          prompt: `Analyze this transcript for transcription confidence and any potentially uncertain names, Quranic references, or Arabic terminology:\n\n"${transcript}"`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              confidence: { type: Type.NUMBER, description: 'Estimated confidence between 0.0 and 1.0' },
              lowConfidenceWarning: { type: Type.BOOLEAN },
              warningMessage: { type: Type.STRING },
              uncertainSpans: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    phrase: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    alternatives: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                },
              },
            },
            required: ['confidence', 'lowConfidenceWarning', 'warningMessage', 'uncertainSpans'],
          },
        });
      } catch {
        // Graceful fallback if structured audit fails
      }
    }

    const latencyMs = Date.now() - start;

    return {
      transcript,
      detectedLanguages: langInfo.detectedLanguages,
      primaryLanguage: langInfo.primaryLanguage,
      codeSwitchingSegments: langInfo.codeSwitchingSegments,
      confidence: Math.max(0, Math.min(1, audit.confidence)),
      lowConfidenceWarning: audit.lowConfidenceWarning || audit.confidence < 0.78 || audit.uncertainSpans.length > 0,
      warningMessage: audit.warningMessage || undefined,
      uncertainSpans: audit.uncertainSpans ?? [],
      audioId,
      latencyMs,
    };
  },
};
