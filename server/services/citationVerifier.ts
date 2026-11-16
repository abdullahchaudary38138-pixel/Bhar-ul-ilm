import crypto from 'crypto';
import { Type } from '@google/genai';
import { getGeminiClient, defaultAIProvider } from '../providers/aiProvider.ts';
import { searchOrchestratorService } from './searchOrchestrator.ts';
import { speechRecognitionService } from './speechRecognition.ts';
import type {
  MediaBreakdown,
  VerificationOutcome,
  VerificationReport,
  WebSourceCitation,
} from '../../src/types.ts';

interface VerificationAIResponse {
  claim: string;
  whatNeedsVerification: string[];
  outcome: VerificationOutcome;
  earliestTraceableSource: string;
  evidenceComparison: string;
  explanation: string;
  confidenceNote: string;
  mediaBreakdown?: MediaBreakdown;
}

export const citationVerifierService = {
  async verifySubmission(params: {
    text?: string;
    sourceTypeLabel:
      | 'text'
      | 'quotation'
      | 'pdf'
      | 'screenshot'
      | 'image'
      | 'video_link'
      | 'video_file'
      | 'voice_recording'
      | 'video_transcript';
    fileBase64?: string;
    fileMimeType?: string;
    videoUrl?: string;
  }): Promise<VerificationReport> {
    let extractedText = (params.text || '').trim();
    let mediaTranscript = '';
    const webSources: WebSourceCitation[] = [];
    const ai = getGeminiClient();

    // 1. Voice recording / uploaded audio -> verbatim transcription
    if (params.sourceTypeLabel === 'voice_recording' && params.fileBase64 && params.fileMimeType) {
      const tr = await speechRecognitionService.transcribeAndAnalyze({
        audioBase64: params.fileBase64,
        mimeType: params.fileMimeType,
        saveAudio: true,
      });
      mediaTranscript = tr.transcript;
      extractedText = extractedText
        ? `${extractedText}\n\nTranscript:\n${mediaTranscript}`
        : mediaTranscript;
    }

    // 2. Uploaded video file -> multimodal speech + slide/caption extraction via Gemini
    if (params.sourceTypeLabel === 'video_file' && params.fileBase64 && params.fileMimeType) {
      const videoResp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: params.fileMimeType,
                data: params.fileBase64,
              },
            },
            {
              text: 'Listen to this video clip carefully and also read any visible Arabic, Urdu, Roman Urdu, or English text on screen. Return an exact verbatim transcript of spoken words and screen captions, preserving religious terms and citations faithfully.',
            },
          ],
        },
      });
      mediaTranscript = (videoResp.text ?? '').trim();
      extractedText = extractedText
        ? `${extractedText}\n\nVideo Content & Speech Transcript:\n${mediaTranscript}`
        : mediaTranscript;
    }

    // 3. PDF / image / screenshot -> OCR extraction
    if (
      (params.sourceTypeLabel === 'pdf' ||
        params.sourceTypeLabel === 'screenshot' ||
        params.sourceTypeLabel === 'image') &&
      params.fileBase64 &&
      params.fileMimeType
    ) {
      const ocrResp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: params.fileMimeType,
                data: params.fileBase64,
              },
            },
            {
              text: 'Extract all visible Arabic, Urdu, Roman Urdu, and English text and religious claims/citations from this document or screenshot accurately without altering any wording.',
            },
          ],
        },
      });
      const extractedDoc = (ocrResp.text ?? '').trim();
      extractedText = extractedText
        ? `${extractedText}\n\nExtracted Document Content:\n${extractedDoc}`
        : extractedDoc;
    }

    // 4. Video or Article Link -> inspect via urlContext + googleSearch
    let onlineVerificationNotes = '';
    if (params.videoUrl && params.videoUrl.trim()) {
      const cleanUrl = params.videoUrl.trim();
      extractedText = `${extractedText}\n\nSubmitted Reference URL: ${cleanUrl}`.trim();
      try {
        const urlResp = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Inspect and verify this submitted Islamic video or article link: ${cleanUrl}\nAdditional user context: ${
            params.text || 'None provided'
          }\nSummarize what religious claims or Quran/Hadith attributions appear at this URL and verify them against classical Quran/Hadith scholarship.`,
          config: {
            tools: [{ urlContext: {} }, { googleSearch: {} }],
          },
        });
        onlineVerificationNotes = (urlResp.text ?? '').trim();
        const chunks = urlResp.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        for (const chunk of chunks) {
          if (chunk?.web?.uri && !webSources.some((w) => w.url === chunk.web!.uri)) {
            webSources.push({
              title: chunk.web.title || chunk.web.uri,
              url: chunk.web.uri,
            });
          }
        }
      } catch {
        // Fallback to standard Google Search if URL is inaccessible
      }
    }

    // 5. Search indexed corpus + library books + live Google Search verification
    const [searchRes, libraryMatches] = await Promise.all([
      searchOrchestratorService.search(extractedText.slice(0, 300), { method: 'all' }),
      Promise.resolve(searchOrchestratorService.findBookLibraryMatches(extractedText.slice(0, 200))),
    ]);

    if (!onlineVerificationNotes && extractedText.trim().length > 5) {
      try {
        const grounded = await defaultAIProvider.generateGroundedAnswer({
          systemInstruction:
            'Verify the following Islamic claim, Hadith quote, or historical attribution using classical Quran, Sahih Bukhari/Muslim, Tafsir, and authentic scholarly sources.',
          prompt: extractedText.slice(0, 1200),
        });
        onlineVerificationNotes = grounded.text;
        for (const w of grounded.webSources) {
          if (!webSources.some((x) => x.url === w.url)) {
            webSources.push(w);
          }
        }
      } catch {
        // ignore search error
      }
    }

    const corpusContext = searchRes.results
      .map(
        (c) =>
          `[${c.id}] ${c.sourceType} | ${c.title} | Book: ${c.book} | Author: ${c.author} | Edition: ${c.edition} | Page: ${c.page}\nArabic: ${c.arabicText || 'N/A'}\nTranslation: ${c.englishTranslation}`
      )
      .join('\n---\n');

    const libraryContext = libraryMatches
      .map((b) => `[${b.bookTitle} by ${b.author}, ${b.printedPage}] ${b.snippet}`)
      .join('\n---\n');

    const isAudioOrVideo =
      params.sourceTypeLabel === 'voice_recording' ||
      params.sourceTypeLabel === 'video_file' ||
      params.sourceTypeLabel === 'video_transcript' ||
      params.sourceTypeLabel === 'video_link';

    const systemInstruction = `You are the Islamic Claim & Media Verification Engine of Bahr-ul-Ilm AI.
Your task:
1. Extract the core claim(s) from the user's submission.
2. Identify specifically what needs verification (isnad/chain, exact Quranic wording, historical date, attribution to a scholar, or context).
3. Compare against indexed primary corpus passages, library books, and online verification notes provided.
4. Assign EXACTLY ONE of these verification outcomes:
   - "Supported by the cited source"
   - "Partially supported"
   - "Context missing"
   - "Disputed"
   - "Misattributed"
   - "Not found in available sources"
   - "Unable to verify"
5. CRITICAL RULE: Never label a claim "false" or "fabricated" merely because a search did not find it in the indexed corpus. If absent from available sources, use "Not found in available sources" or "Unable to verify" and explain transparently what sources would be required to verify it further.
6. Write "claim", "whatNeedsVerification", "earliestTraceableSource", "evidenceComparison", "explanation", "confidenceNote", and "mediaBreakdown" (translation, interpretation, aiSummary) clearly in **natural Pakistani Urdu script (اردو)** so anyone can read and listen to it in Urdu.
7. ${
      isAudioOrVideo
        ? 'Because this is an audio/video submission, you MUST populate mediaBreakdown separating: exactTranscript, translation (in Urdu script), interpretation (in Urdu script), and aiSummary (in Urdu script).'
        : 'mediaBreakdown is optional unless audio/video text is analyzed.'
    }`;

    const prompt = `Submission Type: ${params.sourceTypeLabel}\n\nSubmitted Content:\n${
      extractedText || 'No readable text provided.'
    }\n\nIndexed Corpus Evidence:\n${corpusContext || 'No direct indexed passage matched.'}\n\nLibrary Books Evidence:\n${
      libraryContext || 'No direct library book match.'
    }\n\nOnline URL & Scholarly Verification Notes:\n${onlineVerificationNotes || 'None'}`;

    let aiReport: VerificationAIResponse;
    try {
      aiReport = await defaultAIProvider.generateStructured<VerificationAIResponse>({
        systemInstruction,
        prompt,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            claim: { type: Type.STRING },
            whatNeedsVerification: { type: Type.ARRAY, items: { type: Type.STRING } },
            outcome: {
              type: Type.STRING,
              enum: [
                'Supported by the cited source',
                'Partially supported',
                'Context missing',
                'Disputed',
                'Misattributed',
                'Not found in available sources',
                'Unable to verify',
              ],
            },
            earliestTraceableSource: { type: Type.STRING },
            evidenceComparison: { type: Type.STRING },
            explanation: { type: Type.STRING },
            confidenceNote: { type: Type.STRING },
            mediaBreakdown: {
              type: Type.OBJECT,
              properties: {
                exactTranscript: { type: Type.STRING },
                translation: { type: Type.STRING },
                interpretation: { type: Type.STRING },
                aiSummary: { type: Type.STRING },
              },
            },
          },
          required: [
            'claim',
            'whatNeedsVerification',
            'outcome',
            'earliestTraceableSource',
            'evidenceComparison',
            'explanation',
            'confidenceNote',
          ],
        },
      });
    } catch {
      const topCite = searchRes.results[0];
      const topLib = libraryMatches[0];
      aiReport = {
        claim: extractedText.slice(0, 280) || params.videoUrl || 'پیش کردہ دعویٰ یا بیان',
        whatNeedsVerification: [
          'قرآن، حدیث یا مستند تاریخی کتاب سے اصل حوالہ اور سند کی جانچ',
        ],
        outcome: 'Unable to verify',
        earliestTraceableSource: topCite
          ? `${topCite.book} (${topCite.author}، ${topCite.page})`
          : topLib
            ? `${topLib.bookTitle} (${topLib.author}، ${topLib.printedPage})`
            : 'مزید علمی تحقیق درکار ہے',
        evidenceComparison: topCite
          ? `قرآن و حدیث کا قریبی مستند حوالہ: ${topCite.title} — ${topCite.urduTranslation || topCite.englishTranslation}`
          : topLib
            ? `ذاتی لائبریری سے حوالہ: ${topLib.bookTitle} — ${topLib.snippet}`
            : 'مقامی انڈیکس میں براہِ راست حوالہ نہیں ملا اور اس وقت آن لائن تصدیق عارضی طور پر دستیاب نہیں۔',
        explanation:
          'اس وقت لائیو اے آئی تصدیقی ماڈل عارضی طور پر دستیاب نہیں ہے۔ نیچے دیے گئے مستند حوالہ جات دیکھیں یا کچھ دیر بعد دوبارہ کوشش کریں۔',
        confidenceNote: 'مقامی حوالہ جات چیک کر لیے گئے ہیں؛ لائیو اے آئی تصدیق عارضی طور پر محدود ہے۔',
      };
    }

    if (
      isAudioOrVideo &&
      mediaTranscript &&
      aiReport.mediaBreakdown &&
      !aiReport.mediaBreakdown.exactTranscript
    ) {
      aiReport.mediaBreakdown.exactTranscript = mediaTranscript;
    }

    return {
      id: crypto.randomUUID(),
      ...aiReport,
      citations: searchRes.results.slice(0, 4),
      webSources: webSources.length > 0 ? webSources.slice(0, 6) : undefined,
      createdAt: new Date().toISOString(),
    };
  },
};
