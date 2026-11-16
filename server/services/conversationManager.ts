import crypto from 'crypto';
import { Type } from '@google/genai';
import { defaultAIProvider } from '../providers/aiProvider.ts';
import { intentClassifierService } from './intentClassifier.ts';
import { clarificationHandlerService } from './clarificationHandler.ts';
import { searchOrchestratorService } from './searchOrchestrator.ts';
import type {
  ChatMessage,
  CorpusPassage,
  DiagramData,
  ResearchTopic,
  VoiceMetrics,
  WebSourceCitation,
} from '../../src/types.ts';

interface ScholarlyResponsePayload {
  answer: string;
  arabicQuote?: string;
  spokenSummary: string;
  diagram?: DiagramData;
}

const topics = new Map<string, ResearchTopic>();

const metrics: VoiceMetrics = {
  totalVoiceQueries: 0,
  avgLatencyMs: 0,
  avgRecognitionConfidence: 0.94,
  arabicTermAccuracyEstimate: 0.96,
  interruptionsHandled: 0,
  userCorrections: 0,
  clarificationsTriggered: 0,
};

let latencySamples: number[] = [];
let confidenceSamples: number[] = [];

export const conversationManagerService = {
  getTopics(): ResearchTopic[] {
    return Array.from(topics.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  createTopic(title = 'New Research Session'): ResearchTopic {
    const now = new Date().toISOString();
    const topic: ResearchTopic = {
      id: crypto.randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    topics.set(topic.id, topic);
    return topic;
  },

  getOrCreateTopic(topicId?: string): ResearchTopic {
    if (topicId && topics.has(topicId)) {
      return topics.get(topicId)!;
    }
    return this.createTopic();
  },

  getMetrics(): VoiceMetrics {
    return { ...metrics };
  },

  recordInterruption() {
    metrics.interruptionsHandled += 1;
  },

  recordCorrection() {
    metrics.userCorrections += 1;
  },

  recordRecognitionSample(confidence: number) {
    metrics.totalVoiceQueries += 1;
    confidenceSamples.push(confidence);
    const sum = confidenceSamples.reduce((a, b) => a + b, 0);
    metrics.avgRecognitionConfidence = Number((sum / confidenceSamples.length).toFixed(2));
  },

  recordLatency(ms: number) {
    latencySamples.push(ms);
    const sum = latencySamples.reduce((a, b) => a + b, 0);
    metrics.avgLatencyMs = Math.round(sum / latencySamples.length);
  },

  async processTurn(params: {
    topicId?: string;
    message: string;
    skipConfirmation?: boolean;
    voiceMode?: boolean;
    fromVoice?: boolean;
  }): Promise<{ topic: ResearchTopic; assistantMessage: ChatMessage }> {
    const start = Date.now();
    const topic = this.getOrCreateTopic(params.topicId);

    // Update topic title if first user message
    if (topic.messages.length === 0) {
      topic.title = params.message.slice(0, 56) + (params.message.length > 56 ? '…' : '');
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: params.message,
      timestamp: new Date().toISOString(),
    };
    topic.messages.push(userMsg);

    const understanding = await intentClassifierService.analyzeIntent({
      query: params.message,
      history: topic.messages.slice(0, -1),
      skipConfirmation: params.skipConfirmation,
    });
    userMsg.detectedLanguages = understanding.detectedLanguages;

    if (understanding.status === 'clarify') {
      metrics.clarificationsTriggered += 1;
      const clarificationText = clarificationHandlerService.buildClarificationResponse(understanding);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: clarificationText,
        spokenSummary: clarificationText,
        understanding,
        detectedLanguages: understanding.detectedLanguages,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
      topic.messages.push(assistantMessage);
      topic.updatedAt = new Date().toISOString();
      this.recordLatency(assistantMessage.latencyMs!);
      return { topic, assistantMessage };
    }

    if (understanding.status === 'confirm_understanding' && !params.skipConfirmation) {
      const confirmationText = clarificationHandlerService.buildConfirmationResponse(understanding);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: confirmationText,
        spokenSummary: confirmationText,
        understanding,
        detectedLanguages: understanding.detectedLanguages,
        requiresConfirmation: true,
        originalQueryForConfirmation: params.message,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
      topic.messages.push(assistantMessage);
      topic.updatedAt = new Date().toISOString();
      this.recordLatency(assistantMessage.latencyMs!);
      return { topic, assistantMessage };
    }

    // Retrieve primary citations from the Smart Search Orchestrator
    const searchQuery = [
      understanding.subject,
      ...understanding.entities.names,
      ...understanding.entities.books,
      ...understanding.entities.events,
      params.message,
    ]
      .filter(Boolean)
      .join(' ');

    const [searchResult, libraryMatches] = await Promise.all([
      searchOrchestratorService.search(searchQuery, { method: 'all' }),
      Promise.resolve(searchOrchestratorService.findBookLibraryMatches(searchQuery)),
    ]);
    const citations: CorpusPassage[] = searchResult.results.slice(0, 5);

    const wantsDiagram = /\b(diagram|chart|visual|flowchart|map|timeline|naqsha)\b/i.test(params.message);

    const citationContext = citations
      .map(
        (c) =>
          `[${c.sourceType}] ${c.title} — ${c.book} (${c.author}, ${c.edition}, ${c.page})\nArabic: ${c.arabicText || 'N/A'}\nUrdu: ${c.urduTranslation || 'N/A'}\nEnglish: ${c.englishTranslation}\nMatch Type: ${c.matchType}`
      )
      .join('\n\n');

    const libraryContext = libraryMatches
      .map(
        (b) =>
          `[${b.isPersonalUpload ? 'Personal Uploaded Book' : 'Digital Library Book'}] ${b.bookTitle} by ${b.author} (${b.category}, ${b.printedPage}, ${b.chapter})\nExcerpt: ${b.snippet}`
      )
      .join('\n\n');

    // Run SEO-style online scholarly grounding when local citations are limited or query benefits from online books/Hadith verification
    let webSources: WebSourceCitation[] = [];
    let onlineGroundingText = '';
    try {
      const grounded = await defaultAIProvider.generateGroundedAnswer({
        systemInstruction:
          'Briefly verify and gather authentic Islamic book, Quran, Hadith, or historical references relevant to the user question. Only state verified references.',
        prompt: `User Query: "${params.message}"\nSubject: ${understanding.subject}`,
      });
      webSources = grounded.webSources.slice(0, 6);
      onlineGroundingText = grounded.text.slice(0, 1400);
    } catch {
      webSources = [];
      onlineGroundingText = '';
    }

    const conversationHistory = topic.messages
      .slice(-8, -1)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const systemInstruction = `You are Bahr-ul-Ilm AI, a warm, knowledgeable Islamic learning & research companion.
CRITICAL INTEGRITY & VOICE RULES:
1. Honestly note you are an AI assistant if asked; never claim to be a real human scholar/Mufti.
2. Write the ENTIRE written answer and "spokenSummary" in **clear, natural Pakistani Urdu script (اردو)** so every translation, explanation, and voice playback is in clean Urdu (never Roman Urdu).
3. Cover Islamic books/history/personalities, Islamic Psychology/Tazkiyah, AND everyday life Islamic viewpoints grounded in Quran, authentic Sunnah, Library books, and recognized online Islamic sources.
4. PRESERVE QURANIC ARABIC VERBATIM: When quoting the Quran, reproduce the exact Arabic verse accurately and NEVER paraphrase Quranic text while presenting it as recitation or quotation.
5. ALWAYS tell the user clearly **"حوالہ جات (کہاں سے جواب لیا)"**: cite exact Quran Surah:Ayah, Hadith book/number, Library book + page, or online scholarly reference used.
6. Handle natural follow-up commands seamlessly ("مزید تفصیل سے بتائیں", "آسان الفاظ میں سمجھائیں", "عربی گرامر بتائیں", "چارٹ بنائیں", "خلاصہ کریں").
7. Provide a natural, human-sounding "spokenSummary" (2–4 conversational sentences in Pakistani Urdu script suitable for Urdu voice playback).`;

    const prompt = `Conversation History:\n${conversationHistory || '(Start of topic)'}\n\nUnderstanding Analysis:\nSubject: ${understanding.subject}\nConfirmed: ${understanding.confirmedInfo.join('; ')}\n\nIndexed Primary Sources:\n${citationContext || 'No direct indexed passage matched.'}\n\nPersonal Library Books:\n${libraryContext || 'None matched directly.'}\n\nOnline Scholarly Web Context:\n${onlineGroundingText || 'N/A'}\n\nUser Request:\n"${params.message}"\n\n${wantsDiagram ? 'The user requested a diagram/visual structure — please populate the "diagram" field with clear Urdu labels.' : ''}`;

    const aiPayload = await defaultAIProvider.generateStructured<ScholarlyResponsePayload>({
      systemInstruction,
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING, description: 'Full scholarly written answer in clear Urdu script (اردو) with source attribution.' },
          arabicQuote: { type: Type.STRING, description: 'Exact verbatim Arabic Quranic verse or Hadith matn if applicable.' },
          spokenSummary: { type: Type.STRING, description: 'Natural, conversational Pakistani Urdu script (اردو) spoken response (2-4 sentences).' },
          diagram: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              nodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    detail: { type: Type.STRING },
                  },
                  required: ['id', 'label'],
                },
              },
              edges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    from: { type: Type.STRING },
                    to: { type: Type.STRING },
                    label: { type: Type.STRING },
                  },
                  required: ['from', 'to'],
                },
              },
            },
          },
        },
        required: ['answer', 'spokenSummary'],
      },
    });

    const latencyMs = Date.now() - start;
    this.recordLatency(latencyMs);

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: aiPayload.answer,
      arabicQuote: aiPayload.arabicQuote,
      spokenSummary: aiPayload.spokenSummary,
      understanding,
      detectedLanguages: understanding.detectedLanguages,
      citations,
      webSources: webSources.length > 0 ? webSources : undefined,
      diagram: aiPayload.diagram && aiPayload.diagram.nodes?.length ? aiPayload.diagram : undefined,
      latencyMs,
      timestamp: new Date().toISOString(),
    };

    topic.messages.push(assistantMessage);
    topic.updatedAt = new Date().toISOString();

    return { topic, assistantMessage };
  },
};
