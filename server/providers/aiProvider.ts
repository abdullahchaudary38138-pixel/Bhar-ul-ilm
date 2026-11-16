import { GoogleGenAI } from '@google/genai';

export interface TranscribeOptions {
  audioBase64: string;
  mimeType: string;
  hintLanguages?: string[];
}

export interface GenerateTextOptions {
  systemInstruction: string;
  prompt: string;
  responseSchema?: Record<string, unknown>;
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SynthesizeSpeechOptions {
  text: string;
  voiceName: 'Zephyr' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir';
  style?: string;
}

export interface GroundedAnswerResult {
  text: string;
  webSources: { title: string; url: string }[];
}

export interface IAIProvider {
  readonly name: string;
  transcribeAudio(options: TranscribeOptions): Promise<string>;
  generateStructured<T>(options: GenerateTextOptions): Promise<T>;
  generateText(options: GenerateTextOptions): Promise<string>;
  generateGroundedAnswer(options: GenerateTextOptions): Promise<GroundedAnswerResult>;
  generateTextStream(options: GenerateTextOptions): AsyncIterable<string>;
  synthesizeSpeech(options: SynthesizeSpeechOptions): Promise<{ audioBase64: string; mimeType: string }>;
  embedText(text: string): Promise<number[]>;
}

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!cachedClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    cachedClient = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export class GeminiAIProvider implements IAIProvider {
  readonly name = 'gemini-provider';

  async transcribeAudio(options: TranscribeOptions): Promise<string> {
    const ai = getGeminiClient();
    const cleanMime = (options.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
    const promptText =
      'Transcribe this audio verbatim with accurate punctuation. The speaker may naturally mix Urdu, Roman Urdu, Quranic/classical Arabic, and English in the same sentence. Preserve Arabic religious terms and Quranic words accurately without silently replacing them. Return only the accurate transcription text.';

    for (const model of ['gemini-3.5-transcribe', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite']) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: options.audioBase64,
                },
              },
              { text: promptText },
            ],
          },
        });
        const text = (response.text ?? '').trim();
        if (text) return text;
      } catch {
        // try next model
      }
    }

    return '';
  }

  private isQuotaOrRateError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err || '');
    return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
  }

  async generateStructured<T>(options: GenerateTextOptions): Promise<T> {
    const ai = getGeminiClient();
    const run = async (model: string) => {
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: options.responseSchema as never,
        },
      });
      const raw = (response.text ?? '{}').trim();
      return JSON.parse(raw) as T;
    };

    try {
      return await run('gemini-4-hydrogen');
    } catch (err) {
      console.warn('[aiProvider] generateStructured failed on gemini-4-hydrogen, falling back to gemini-3.1-flash-lite:', err instanceof Error ? err.message : err);
      return await run('gemini-3.1-flash-lite');
    }
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    const ai = getGeminiClient();
    const run = async (model: string) => {
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
        },
      });
      return (response.text ?? '').trim();
    };

    try {
      return await run('gemini-4-hydrogen');
    } catch (err) {
      console.warn('[aiProvider] generateText failed on gemini-4-hydrogen, falling back to gemini-3.1-flash-lite:', err instanceof Error ? err.message : err);
      return await run('gemini-3.1-flash-lite');
    }
  }

  async generateGroundedAnswer(options: GenerateTextOptions): Promise<GroundedAnswerResult> {
    const ai = getGeminiClient();
    const run = async (model: string) => {
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const webSources: { title: string; url: string }[] = [];
      const seen = new Set<string>();
      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        if (uri && !seen.has(uri)) {
          seen.add(uri);
          webSources.push({
            title: chunk.web?.title || uri,
            url: uri,
          });
        }
      }

      return {
        text: (response.text ?? '').trim(),
        webSources,
      };
    };

    try {
      return await run('gemini-4-hydrogen');
    } catch (err1) {
      console.warn('[aiProvider] googleSearch failed on gemini-4-hydrogen:', err1 instanceof Error ? err1.message : err1);
      try {
        return await run('gemini-3.1-flash-lite');
      } catch (err2) {
        console.warn('[aiProvider] googleSearch failed on gemini-3.1-flash-lite, falling back to generateText:', err2 instanceof Error ? err2.message : err2);
        const text = await this.generateText(options);
        return { text, webSources: [] };
      }
    }
  }

  async *generateTextStream(options: GenerateTextOptions): AsyncIterable<string> {
    const ai = getGeminiClient();
    try {
      const stream = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
        },
      });
      for await (const chunk of stream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
    } catch (err) {
      if (!this.isQuotaOrRateError(err)) throw err;
      const stream = await ai.models.generateContentStream({
        model: 'gemini-3.1-flash-lite',
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
        },
      });
      for await (const chunk of stream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
    }
  }

  async synthesizeSpeech(options: SynthesizeSpeechOptions): Promise<{ audioBase64: string; mimeType: string }> {
    const ai = getGeminiClient();
    const styleInstruction =
      options.style ||
      'Warm, expressive, natural Pakistani Urdu speaker in everyday respectful conversation — clear classical Arabic pronunciation for Quranic verses and Islamic names, gentle natural pauses, never robotic.';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: options.text,
                speechMetadata: {
                  style: styleInstruction,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: options.voiceName },
            },
          },
        },
      });
      const part = response.candidates?.[0]?.content?.parts?.[0];
      const audioBase64 = part?.inlineData?.data ?? '';
      if (audioBase64) {
        return { audioBase64, mimeType: part?.inlineData?.mimeType ?? 'audio/wav' };
      }
    } catch {
      // Retry without speechMetadata in case endpoint only accepts plain text + speechConfig
    }

    const retryResp = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text: options.text }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: options.voiceName },
          },
        },
      },
    });
    const part = retryResp.candidates?.[0]?.content?.parts?.[0];
    const audioBase64 = part?.inlineData?.data ?? '';
    const mimeType = part?.inlineData?.mimeType ?? 'audio/wav';
    return { audioBase64, mimeType };
  }

  async embedText(text: string): Promise<number[]> {
    const ai = getGeminiClient();
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
    });
    return response.embeddings?.[0]?.values ?? [];
  }
}

export const defaultAIProvider: IAIProvider = new GeminiAIProvider();
