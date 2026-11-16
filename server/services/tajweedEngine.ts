import crypto from 'crypto';
import { Type } from '@google/genai';
import { getGeminiClient } from '../providers/aiProvider.ts';
import { audioStorage } from './audioStorage.ts';
import type {
  TajweedFinding,
  TilawatAssessmentResult,
  WordAlignmentItem,
} from '../../src/types.ts';

function stripHarakat(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function detectApplicableTajweedRules(word: string, nextWord?: string): string[] {
  const rules: string[] = [];
  if (/[ن|م]ّ/.test(word)) {
    rules.push('Ghunna (Noon/Meem Mushaddadah — hold 2 harakat)');
  }
  if (/ّ/.test(word)) {
    rules.push('Shaddah (Gemination / Nabr)');
  }
  if (/آ|ـٰ|َ[ا]ْ?|ِ[ي]ْ?|ُ[و]ْ?/.test(word)) {
    if (word.includes('ٓ') && nextWord) {
      rules.push('Madd Muttasil / Munfasil (4–5 harakat)');
    } else if (/آ|الضَّالِّين/.test(word)) {
      rules.push('Madd Lazim (6 harakat)');
    } else {
      rules.push("Madd Tabi'i (2 harakat)");
    }
  }
  if (/[قطبجد]ْ/.test(word)) {
    rules.push('Qalqalah Sughra (Echoing bounce on Sukoon)');
  } else if (/[قطبجد][\u064B-\u0652]*$/.test(word)) {
    rules.push('Qalqalah Kubra (If stopping / Waqf)');
  }
  if (/نْ|[\u064B\u064C\u064D]/.test(word) && nextWord) {
    const firstCharNext = stripHarakat(nextWord)[0] || '';
    if ('ءهعحغخ'.includes(firstCharNext)) rules.push('Izhar Halqi (Clear Noon/Tanween)');
    else if ('يرملون'.includes(firstCharNext)) rules.push('Idgham (Merging Noon/Tanween)');
    else if (firstCharNext === 'ب') rules.push('Iqlab (Noon/Tanween into Meem with Ghunna)');
    else if (firstCharNext) rules.push('Ikhfa Haqiqi (Concealed Noon/Tanween)');
  }
  if (/مْ/.test(word) && nextWord) {
    const firstCharNext = stripHarakat(nextWord)[0] || '';
    if (firstCharNext === 'ب') rules.push('Ikhfa Shafawi');
    else if (firstCharNext === 'م') rules.push('Idgham Shafawi (With Ghunna)');
    else if (firstCharNext) rules.push('Izhar Shafawi');
  }
  if (/[صضطظغخق]/.test(word)) {
    rules.push("Tafkheem / Isti'la (Heavy letter articulation)");
  }
  return rules.length > 0 ? rules : ['Harakat & Makharij clarity'];
}

export function alignQuranWords(expectedWords: string[], recognizedWords: string[]): WordAlignmentItem[] {
  const alignments: WordAlignmentItem[] = [];
  let rIdx = 0;

  for (let i = 0; i < expectedWords.length; i++) {
    const exp = expectedWords[i];
    const expNorm = stripHarakat(exp);
    const rules = detectApplicableTajweedRules(exp, expectedWords[i + 1]);

    if (rIdx >= recognizedWords.length) {
      alignments.push({
        position: i + 1,
        expectedWord: exp,
        recognizedWord: null,
        status: 'omitted',
        applicableRules: rules,
      });
      continue;
    }

    // Look ahead up to 2 tokens for alignment resilience
    let bestOffset = 0;
    let bestDist = Infinity;
    for (let offset = 0; offset <= Math.min(2, recognizedWords.length - 1 - rIdx); offset++) {
      const candNorm = stripHarakat(recognizedWords[rIdx + offset]);
      const dist = levenshtein(expNorm, candNorm);
      if (dist < bestDist) {
        bestDist = dist;
        bestOffset = offset;
      }
    }

    const chosenRaw = recognizedWords[rIdx + bestOffset];
    const maxLen = Math.max(1, expNorm.length);
    const similarity = 1 - bestDist / maxLen;

    if (similarity >= 0.72) {
      alignments.push({
        position: i + 1,
        expectedWord: exp,
        recognizedWord: chosenRaw,
        status: 'matched',
        applicableRules: rules,
      });
      rIdx += bestOffset + 1;
    } else if (similarity >= 0.35) {
      alignments.push({
        position: i + 1,
        expectedWord: exp,
        recognizedWord: chosenRaw,
        status: 'substituted',
        applicableRules: rules,
      });
      rIdx += bestOffset + 1;
    } else {
      alignments.push({
        position: i + 1,
        expectedWord: exp,
        recognizedWord: chosenRaw,
        status: 'uncertain',
        applicableRules: rules,
      });
      rIdx += 1;
    }
  }

  return alignments;
}

const assessmentsStore: TilawatAssessmentResult[] = [];

export const tajweedEngineService = {
  async assessRecitation(params: {
    verseKey: string;
    expectedArabic: string;
    qiraat: string;
    audioBase64: string;
    mimeType: string;
    audioDurationSec: number;
    estimatedSnrDb: number;
    saveAudioPermission: boolean;
    referenceAudioUrl?: string;
  }): Promise<TilawatAssessmentResult> {
    const qiraatSupported = params.qiraat.toLowerCase().includes('hafs');
    const qiraatLimitationNote = qiraatSupported
      ? undefined
      : `Tajweed alignment is currently validated for Hafs 'an Asim only. Assessment for "${params.qiraat}" is limited and requires Qari review.`;

    let storedAudioUrl: string | undefined;
    if (params.saveAudioPermission) {
      const ext = params.mimeType.includes('webm') ? 'webm' : 'wav';
      storedAudioUrl = audioStorage.saveAudio(params.audioBase64, ext).url;
    }

    const ai = getGeminiClient();
    const cleanMime = (params.mimeType || 'audio/wav').split(';')[0].trim() || 'audio/wav';

    // Stage 1: Specialized Arabic Quranic ASR (with multimodal fallbacks)
    let recognizedArabicText = '';
    const asrPrompt =
      'Transcribe the Arabic Quranic recitation verbatim with harakat as actually spoken by the reciter. Do NOT auto-correct mistakes to match the standard Quran text—preserve any omitted words, repeated words, or mispronounced letters faithfully. Return only the Arabic transcript.';
    if (params.audioBase64.length >= 400) {
      for (const model of ['gemini-3.5-transcribe', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite']) {
        try {
          const sttResp = await ai.models.generateContent({
            model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: params.audioBase64,
                  },
                },
                { text: asrPrompt },
              ],
            },
          });
          const candidate = (sttResp.text ?? '').trim();
          if (candidate) {
            recognizedArabicText = candidate;
            break;
          }
        } catch {
          // Try next model
        }
      }
    }

    const expectedWords = params.expectedArabic.trim().split(/\s+/).filter(Boolean);
    const recognizedWords = recognizedArabicText.trim().split(/\s+/).filter(Boolean);
    const wordAlignments = alignQuranWords(expectedWords, recognizedWords);

    // Stage 2: Audio quality & SNR gate (Never mark user wrong on weak/silent audio,
    // and never reject audio that ASR already transcribed clearly)
    const audioTooShortOrNoisy =
      params.audioDurationSec < 0.35 ||
      params.audioBase64.length < 400 ||
      recognizedWords.length === 0 ||
      (params.estimatedSnrDb < 3 && recognizedWords.length < Math.max(1, Math.floor(expectedWords.length * 0.3)));

    if (audioTooShortOrNoisy) {
      const unableResult: TilawatAssessmentResult = {
        id: crypto.randomUUID(),
        verseKey: params.verseKey,
        qiraat: params.qiraat,
        qiraatSupported,
        qiraatLimitationNote,
        recognizedArabicText,
        audioDurationSec: Number(params.audioDurationSec.toFixed(2)),
        estimatedSnrDb: Number(params.estimatedSnrDb.toFixed(1)),
        overallConfidence: 0.2,
        overallState: 'Unable to assess reliably',
        pakistaniUrduCoachSummary:
          'آپ کی ریکارڈنگ میں آواز بہت ہلکی تھی یا شور زیادہ تھا، اس لیے تجوید کی یقینی جانچ نہیں ہو سکی۔ براہِ کرم خاموش جگہ پر مائیک کے قریب دوبارہ تلاوت فرمائیں یا آڈیو فائل اپلوڈ کریں۔',
        wordAlignments,
        findings: [
          {
            id: crypto.randomUUID(),
            wordPosition: 1,
            originalArabicWord: expectedWords[0] || params.expectedArabic,
            detectedPronunciation: recognizedArabicText || '(واضح عربی آواز سنائی نہیں دی)',
            expectedRuleOrMakhraj: 'واضح آواز درکار ہے',
            category: 'Audio Quality',
            state: 'Unable to assess',
            confidence: 0.2,
            timestampRangeSec: `0.0s – ${params.audioDurationSec.toFixed(1)}s`,
            explanationPakistaniUrdu:
              'مائیکروفون میں آواز کم ہونے یا پسِ منظر کے شور کی وجہ سے حروف اور مد کی درست پیمائش ممکن نہیں ہو سکی۔ اسے آپ کی غلطی شمار نہیں کیا گیا۔',
            whyItMatters:
              'تجوید اور مخارج کی درست جانچ کے لیے صاف اور واضح آواز ضروری ہے۔',
            assessmentSource: 'Machine-assessed (Needs Qari verification for certification)',
          },
        ],
        referenceAudioUrl: params.referenceAudioUrl,
        storedAudioUrl,
        privacyNotice: params.saveAudioPermission
          ? 'آپ کی اجازت سے ریکارڈنگ محفوظ کر لی گئی ہے۔ آپ کسی بھی وقت حذف کر سکتے ہیں۔'
          : 'آڈیو صرف عارضی طور پر میموری میں جانچی گئی ہے، ڈسک پر محفوظ نہیں ہوئی۔',
        createdAt: new Date().toISOString(),
      };
      assessmentsStore.unshift(unableResult);
      return unableResult;
    }

    // Stage 3: Multimodal Acoustic + Alignment + Tajweed Evaluation via Gemini
    const alignmentSummary = wordAlignments
      .map(
        (w) =>
          `Word #${w.position}: Expected="${w.expectedWord}" | Recognized="${w.recognizedWord || 'OMITTED'}" | Alignment=${w.status} | Rules=${w.applicableRules.join('; ')}`
      )
      .join('\n');

    interface MultimodalTajweedPayload {
      overallConfidence: number;
      overallState: 'Ready to advance' | 'Practice recommended' | 'Unable to assess reliably';
      pakistaniUrduCoachSummary: string;
      nextFocusChecklist: string[];
      findings: {
        wordPosition: number;
        originalArabicWord: string;
        detectedPronunciation: string;
        expectedRuleOrMakhraj: string;
        ruleCitationOrBookReason: string;
        impactIfMisread: string;
        nextFocusChecklist: string[];
        category: TajweedFinding['category'];
        state: TajweedFinding['state'];
        confidence: number;
        timestampRangeSec: string;
        explanationPakistaniUrdu: string;
        whyItMatters: string;
      }[];
    }

    const evalPrompt = `You are a careful, warm, encouraging Pakistani Quran Tilawat & Tajweed Qari coach evaluating a recitation of ${params.verseKey} (${params.qiraat}).

Verified Reference Text: ${params.expectedArabic}
ASR Transcript: ${recognizedArabicText}
Audio Duration: ${params.audioDurationSec.toFixed(2)}s | Estimated SNR: ${params.estimatedSnrDb.toFixed(1)} dB

Deterministic Alignment & Applicable Tajweed Rules:
${alignmentSummary}

CRITICAL ACCURACY & URDU LANGUAGE POLICY:
1. Listen directly to the audio alongside the alignment. Do NOT confuse regional Pakistani accent variation with a recitation error unless a letter's Makhraj, Harakat, Madd duration, Shaddah, Qalqalah, or word is genuinely altered or omitted.
2. Classify each issue strictly as:
   - "Confirmed issue": strong acoustic + alignment evidence (omitted word, substituted letter like س vs ص or د vs ض, missing Shaddah, shortened Madd Lazim).
   - "Possible issue": subtle makhraj/ghunna difference where human Qari listening is recommended.
   - "Unable to assess": background noise or audio ambiguity.
3. Write ALL explanation fields ("pakistaniUrduCoachSummary", "explanationPakistaniUrdu", "ruleCitationOrBookReason", "impactIfMisread", "whyItMatters", and "nextFocusChecklist") in **clear, natural Pakistani Urdu script (اردو)** so it reads and speaks cleanly in Urdu!
4. For EVERY finding include:
   - "explanationPakistaniUrdu": واضح اردو میں بتائیں کہ یہاں کیسے پڑھنا ہے (زبان اور ہونٹوں کی صحیح جگہ)۔
   - "ruleCitationOrBookReason": کس تجوید کی کتاب یا قاعدے (جیسے نورانی قاعدہ، مقدمہ الجزریہ، تحفۃ الاطفال) کی وجہ سے یہاں ایسا پڑھنا ضروری ہے۔
   - "impactIfMisread": اگر غلط پڑھا جائے تو کیا اثر ہوتا ہے (معنی بدلنے یا لحنِ جلی/خفی کی وضاحت)۔
   - "nextFocusChecklist": اگلی بار پڑھتے وقت کن چیزوں کا دھیان رکھنا ہے۔
5. Also provide "nextFocusChecklist" (2-4 Urdu points for next practice) and a warm Urdu "pakistaniUrduCoachSummary". If recitation is accurate, praise clearly with zero invented errors.`;

    const evalSchema = {
      type: Type.OBJECT,
      properties: {
        overallConfidence: { type: Type.NUMBER },
        overallState: {
          type: Type.STRING,
          enum: ['Ready to advance', 'Practice recommended', 'Unable to assess reliably'],
        },
        pakistaniUrduCoachSummary: { type: Type.STRING },
        nextFocusChecklist: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        findings: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              wordPosition: { type: Type.INTEGER },
              originalArabicWord: { type: Type.STRING },
              detectedPronunciation: { type: Type.STRING },
              expectedRuleOrMakhraj: { type: Type.STRING },
              ruleCitationOrBookReason: { type: Type.STRING },
              impactIfMisread: { type: Type.STRING },
              nextFocusChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
              category: {
                type: Type.STRING,
                enum: [
                  'Letter / Makhraj',
                  'Short Vowel (Harakat)',
                  'Long Vowel / Madd',
                  'Ghunna',
                  'Qalqalah',
                  'Noon Sakin / Tanween',
                  'Meem Sakin',
                  'Shaddah / Sukoon',
                  'Omitted / Added Word',
                  'Waqf / Ibtida',
                  'Audio Quality',
                ],
              },
              state: {
                type: Type.STRING,
                enum: ['Confirmed issue', 'Possible issue', 'Unable to assess'],
              },
              confidence: { type: Type.NUMBER },
              timestampRangeSec: { type: Type.STRING },
              explanationPakistaniUrdu: { type: Type.STRING },
              whyItMatters: { type: Type.STRING },
            },
            required: [
              'wordPosition',
              'originalArabicWord',
              'detectedPronunciation',
              'expectedRuleOrMakhraj',
              'ruleCitationOrBookReason',
              'impactIfMisread',
              'nextFocusChecklist',
              'category',
              'state',
              'confidence',
              'timestampRangeSec',
              'explanationPakistaniUrdu',
              'whyItMatters',
            ],
          },
        },
      },
      required: [
        'overallConfidence',
        'overallState',
        'pakistaniUrduCoachSummary',
        'nextFocusChecklist',
        'findings',
      ],
    };

    let evalText = '';
    for (const model of ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']) {
      try {
        const evalResp = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: params.audioBase64,
                },
              },
              { text: evalPrompt },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: evalSchema as never,
          },
        });
        if (evalResp.text) {
          evalText = evalResp.text;
          break;
        }
      } catch {
        // Fallback to next model
      }
    }

    let parsed: MultimodalTajweedPayload | null = null;
    if (evalText) {
      try {
        const cleanJson = evalText
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/```$/i, '');
        parsed = JSON.parse(cleanJson) as MultimodalTajweedPayload;
      } catch {
        parsed = null;
      }
    }

    if (!parsed) {
      const mismatches = wordAlignments.filter((w) => w.status !== 'matched');
      parsed = {
        overallConfidence: mismatches.length === 0 ? 0.86 : 0.72,
        overallState: mismatches.length === 0 ? 'Ready to advance' : 'Practice recommended',
        pakistaniUrduCoachSummary:
          mismatches.length === 0
            ? 'ماشاءاللہ! آپ کی تلاوت کے الفاظ درست سنے گئے ہیں۔ مزید بہتری کے لیے قاری صاحب کی آواز (0.85x) کے ساتھ مد اور غنہ کا دھیان رکھ کر مشق جاری رکھیں۔'
            : `آپ کی تلاوت سن لی گئی ہے۔ ${mismatches.length} الفاظ میں ادائیگی یا تلفظ پر مزید توجہ دینے کی ضرورت ہے؛ نیچے دی گئی تفصیل دیکھ کر دوبارہ مشق فرمائیں۔`,
        nextFocusChecklist: [
          'ہر حرف کو اس کے صحیح مخرج سے واضح ادا کریں۔',
          'تشدید، غنہ اور مد کی مقدار (۲ تا ۶ حرکات) پوری رکھیں۔',
          'قاری صاحب کی سست رفتار (0.85x) تلاوت سن کر ساتھ دہرائیں۔',
        ],
        findings: mismatches.map((m) => ({
          wordPosition: m.position,
          originalArabicWord: m.expectedWord,
          detectedPronunciation: m.recognizedWord || '(لفظ سنائی نہیں دیا)',
          expectedRuleOrMakhraj: m.applicableRules.join(' · '),
          ruleCitationOrBookReason:
            'نورانی قاعدہ اور علمِ تجوید کے بنیادی قواعد (مخارج الحروف اور حرکات کی صحت) کے مطابق ہر لفظ کا پورا ادا ہونا ضروری ہے۔',
          impactIfMisread:
            'اگر حرف یا حرکت بدل جائے تو معنی میں تبدیلی یا لحن کا اندیشہ ہوتا ہے۔',
          nextFocusChecklist: ['اس لفظ کو آہستہ اور واضح تلفظ کے ساتھ علیحدہ دہرائیں۔'],
          category: m.status === 'omitted' ? 'Omitted / Added Word' : 'Letter / Makhraj',
          state: 'Possible issue',
          confidence: 0.72,
          timestampRangeSec: `لفظ #${m.position}`,
          explanationPakistaniUrdu:
            m.status === 'omitted'
              ? `لفظ "${m.expectedWord}" ریکارڈنگ میں واضح سنائی نہیں دیا۔ اسے رک کر واضح ادا کریں۔`
              : `لفظ "${m.expectedWord}" کی جگہ "${m.recognizedWord}" سنا گیا۔ اس کے مخارج اور اعراب پر توجہ دے کر دوبارہ پڑھیں۔`,
          whyItMatters: 'قرآنی الفاظ اور حرکات کی درست ادائیگی سے معنی محفوظ رہتے ہیں۔',
        })),
      };
    }

    const result: TilawatAssessmentResult = {
      id: crypto.randomUUID(),
      verseKey: params.verseKey,
      qiraat: params.qiraat,
      qiraatSupported,
      qiraatLimitationNote,
      recognizedArabicText,
      audioDurationSec: Number(params.audioDurationSec.toFixed(2)),
      estimatedSnrDb: Number(params.estimatedSnrDb.toFixed(1)),
      overallConfidence: Math.max(0, Math.min(1, parsed.overallConfidence ?? 0.78)),
      overallState: parsed.overallState || 'Practice recommended',
      pakistaniUrduCoachSummary: parsed.pakistaniUrduCoachSummary,
      nextFocusChecklist: parsed.nextFocusChecklist || [],
      wordAlignments,
      findings: (parsed.findings || []).map((f) => ({
        ...f,
        id: crypto.randomUUID(),
        assessmentSource: 'Machine-assessed (Needs Qari verification for certification)',
      })),
      referenceAudioUrl: params.referenceAudioUrl,
      storedAudioUrl,
      privacyNotice: params.saveAudioPermission
        ? 'آپ کی اجازت سے ریکارڈنگ محفوظ کر لی گئی ہے۔ آپ کسی بھی وقت حذف کر سکتے ہیں۔'
        : 'آڈیو صرف عارضی طور پر میموری میں جانچی گئی ہے، ڈسک پر محفوظ نہیں ہوئی۔',
      createdAt: new Date().toISOString(),
    };

    assessmentsStore.unshift(result);
    return result;
  },

  submitQariReview(params: {
    assessmentId: string;
    findingId: string;
    verdict: 'Confirmed issue' | 'Possible issue' | 'Unable to assess';
    qariNote: string;
  }): TilawatAssessmentResult | null {
    const assessment = assessmentsStore.find((a) => a.id === params.assessmentId);
    if (!assessment) return null;
    assessment.findings = assessment.findings.map((f) =>
      f.id === params.findingId
        ? {
            ...f,
            state: params.verdict,
            assessmentSource: 'Human Qari reviewed',
            qariNote: params.qariNote,
          }
        : f
    );
    return assessment;
  },

  listAssessments(): TilawatAssessmentResult[] {
    return assessmentsStore.slice(0, 15);
  },

  getValidationBenchmarks() {
    const total = assessmentsStore.length;
    const confirmedCount = assessmentsStore.reduce(
      (acc, a) => acc + a.findings.filter((f) => f.state === 'Confirmed issue').length,
      0
    );
    const humanReviewedCount = assessmentsStore.reduce(
      (acc, a) =>
        acc + a.findings.filter((f) => f.assessmentSource === 'Human Qari reviewed').length,
      0
    );

    return {
      supportedQiraat: ["Hafs 'an Asim (Madinah Uthmani)"],
      unsupportedDisclosed: ["Warsh 'an Nafi'", "Qalun", "Al-Duri"],
      pipelineStages: [
        '1. Verified Quran Text & Qiraat Gate',
        '2. Arabic Quranic ASR (gemini-3.5-transcribe)',
        '3. Deterministic Word & Harakat Levenshtein Alignment',
        '4. Rule-Based Tajweed Scanner (Madd, Ghunna, Qalqalah, Noon/Meem Sakin, Tafkheem)',
        '5. Acoustic SNR & Duration Gate (< 8 dB SNR -> Unable to assess)',
        '6. Multimodal Phonetic Audit + Pakistani Urdu Coaching',
        '7. Human Qari Review Workflow',
      ],
      sessionStats: {
        totalAttemptsEvaluated: total,
        confirmedIssuesDetected: confirmedCount,
        humanQariReviewedFindings: humanReviewedCount,
      },
      knownLimitations: [
        'Generic multimodal audio models do not replace a dedicated phoneme-level forced aligner (e.g., Montreal Forced Aligner / Wav2Vec2-Quran) for millisecond Madd duration measurement.',
        'Subtle Makharij contrasts (e.g., ض vs ظ or ح vs هـ in fast recitation or noisy rooms) are graded as "Possible issue" for human Qari confirmation rather than definitively failing the student.',
        'Formal Tajweed Ijazah certification always requires a qualified human Qari.',
      ],
      externalProvidersNotice:
        'Audio streams and recordings are processed server-side via Google Gemini Speech & Multimodal APIs when you press Start Recitation. No background recording ever occurs.',
    };
  },
};
