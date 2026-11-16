import { Type } from '@google/genai';
import { defaultAIProvider } from '../providers/aiProvider.ts';
import { languageDetectionService } from './languageDetection.ts';
import type { ChatMessage, UnderstandingAnalysis } from '../../src/types.ts';

export const intentClassifierService = {
  async analyzeIntent(params: {
    query: string;
    history: ChatMessage[];
    skipConfirmation?: boolean;
  }): Promise<UnderstandingAnalysis> {
    const langInfo = languageDetectionService.detect(params.query);
    const recentHistory = params.history
      .slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const systemInstruction = `You are the Intelligent Understanding Engine of Bahr-ul-Ilm AI, a multilingual Islamic scholarly research assistant supporting Roman Urdu, Urdu, Arabic, and English.

Before answering any question, analyze the user's actual intention rigorously:
1. Detect the question's subject.
2. Identify important names, events, dates, books, and references.
3. Understand conversational context from prior turns (do not confuse separate topics, and detect natural follow-ups like "Explain more simply", "Show the original Arabic", "Give the full reference", "Compare another scholar", "Search another book", "Read the source aloud", "Explain this with a diagram", "Continue from where we stopped", "Summarize everything", "Turn this research into notes").
4. Identify ambiguity and detect missing essential details.
5. Separate confirmed information from assumptions.
6. Decision rules for "status":
   - If the question is ambiguous, underspecified, or uses pronouns without a clear referent in history (for example: "Umar ke daur mein yeh kaise hua?", "Is mein kya hukm hai?", "Woh hadees sahi hai?"), set status = "clarify" and craft ONE clear, respectful clarification question in the SAME language/style as the user (e.g., Roman Urdu if the user wrote Roman Urdu, Urdu if Urdu, English if English). Do NOT guess.
   - Else if the request is complex, multi-step comparative research across Quran/Hadith/classical scholars, potentially sensitive (fiqhi dispute, historical controversy), or asks for document changes/bulk synthesis AND skipConfirmation is false, set status = "confirm_understanding" and write a concise confirmationPrompt restating your understanding (e.g., "Main aapki baat is tarah samajh raha hoon: aap Quran, Hadith aur classical Islamic books ki roshni mein is maslay ka comparative research chahte hain. Kya meri understanding sahi hai?" in the user's language).
   - Else (clear, unambiguous question or direct follow-up on the active topic), set status = "proceed".`;

    const prompt = `Conversation History:\n${recentHistory || '(New topic)'}\n\nskipConfirmation: ${Boolean(params.skipConfirmation)}\n\nCurrent User Message:\n"${params.query}"`;

    const analysis = await defaultAIProvider.generateStructured<Omit<UnderstandingAnalysis, 'detectedLanguages'>>({
      systemInstruction,
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          intentType: {
            type: Type.STRING,
            enum: [
              'simple_lookup',
              'comparative_research',
              'ambiguous_query',
              'follow_up',
              'claim_verification',
              'clarification_response',
            ],
          },
          entities: {
            type: Type.OBJECT,
            properties: {
              names: { type: Type.ARRAY, items: { type: Type.STRING } },
              events: { type: Type.ARRAY, items: { type: Type.STRING } },
              dates: { type: Type.ARRAY, items: { type: Type.STRING } },
              books: { type: Type.ARRAY, items: { type: Type.STRING } },
              references: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['names', 'events', 'dates', 'books', 'references'],
          },
          confirmedInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
          assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
          ambiguities: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingDetails: { type: Type.ARRAY, items: { type: Type.STRING } },
          status: {
            type: Type.STRING,
            enum: ['proceed', 'clarify', 'confirm_understanding'],
          },
          clarificationQuestion: { type: Type.STRING },
          confirmationPrompt: { type: Type.STRING },
        },
        required: [
          'subject',
          'intentType',
          'entities',
          'confirmedInfo',
          'assumptions',
          'ambiguities',
          'missingDetails',
          'status',
        ],
      },
    });

    return {
      ...analysis,
      detectedLanguages: langInfo.detectedLanguages,
    };
  },
};
