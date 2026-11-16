import { Type } from '@google/genai';
import { defaultAIProvider } from '../providers/aiProvider.ts';
import type { AyahGrammarTree, WordDeepAnalysis } from '../../src/types.ts';

export const quranUstaadService = {
  async explainWord(params: {
    verseKey: string;
    arabicAyah: string;
    arabicWord: string;
    wordPosition: number;
    previousWord?: string;
    nextWord?: string;
  }): Promise<WordDeepAnalysis> {
    const systemInstruction = `You are an expert Quranic Arabic Ustaad teaching in clear, simple **Urdu script (اردو)**.
Analyze the selected Arabic word inside its exact Quranic Ayah.
CRITICAL RULES:
1. Write ALL explanations ("urduMeaning", "originalRootMeaning", "grammaticalCategory", "morphologyDetails", "nahwIrabRole", "whyThisFormUsed", "connectionToAdjacentWords", "contextualMeaning", "grammarImportanceInRomanUrdu", "balaghaNote") in **pure, easy-to-understand Urdu script (اردو)** so any Pakistani user can read and listen to it in Urdu.
2. Never invent grammatical categories that do not apply to the word (e.g., if it is a Harf, write "حرف (صیغہ یا زمانہ لاگو نہیں ہوتا)").
3. Provide real Quranic occurrences where the same root appears.`;

    const prompt = `Ayah (${params.verseKey}): ${params.arabicAyah}
Selected Word (#${params.wordPosition}): ${params.arabicWord}
Previous Word: ${params.previousWord || '(آیت کی ابتدا)'}
Next Word: ${params.nextWord || '(آیت کا اختتام)'}

Provide the complete word-by-word linguistic breakdown in simple, clear Urdu (اردو).`;

    return defaultAIProvider.generateStructured<WordDeepAnalysis>({
      systemInstruction,
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          arabicWord: { type: Type.STRING },
          romanPronunciation: { type: Type.STRING },
          urduMeaning: { type: Type.STRING },
          englishMeaning: { type: Type.STRING },
          rootLetters: { type: Type.STRING, description: 'مادہ / جذر (Root letters) یا حرف' },
          originalRootMeaning: { type: Type.STRING },
          sarfPattern: { type: Type.STRING, description: 'صرفی وزن / باب (اگر لاگو ہو)' },
          grammaticalCategory: { type: Type.STRING, description: 'اسم، فعل یا حرف مع وضاحت' },
          morphologyDetails: { type: Type.STRING, description: 'تعداد، جنس، زمانہ (جہاں لاگو ہو) اردو میں' },
          nahwIrabRole: { type: Type.STRING, description: 'نحوی کردار اور اعراب اردو میں' },
          whyThisFormUsed: { type: Type.STRING },
          connectionToAdjacentWords: { type: Type.STRING },
          contextualMeaning: { type: Type.STRING },
          otherQuranicOccurrences: { type: Type.ARRAY, items: { type: Type.STRING } },
          multipleMeanings: { type: Type.ARRAY, items: { type: Type.STRING } },
          grammarImportanceInRomanUrdu: { type: Type.STRING, description: 'سادہ اردو میں تفصیلی وضاحت' },
          balaghaNote: { type: Type.STRING },
        },
        required: [
          'arabicWord',
          'romanPronunciation',
          'urduMeaning',
          'englishMeaning',
          'rootLetters',
          'originalRootMeaning',
          'sarfPattern',
          'grammaticalCategory',
          'morphologyDetails',
          'nahwIrabRole',
          'whyThisFormUsed',
          'connectionToAdjacentWords',
          'contextualMeaning',
          'otherQuranicOccurrences',
          'multipleMeanings',
          'grammarImportanceInRomanUrdu',
        ],
      },
    });
  },

  async buildAyahGrammarTree(params: {
    verseKey: string;
    arabicAyah: string;
  }): Promise<AyahGrammarTree> {
    const systemInstruction = `You are a Quranic Arabic Nahw & Balagha teacher explaining in **clear, simple Urdu script (اردو)**.
Produce a structured grammatical breakdown of the entire Ayah, tagging every word as Ism, Fi'l, or Harf, its grammatical role, I'rab case, pronoun references, rhetorical features, and connection with previous/next Ayat — write ALL explanations ("sentenceType", "role", "irabCase", "explanationRomanUrdu", "pronounReferences", "rhetoricalFeatures", "ayahConnectionPrevNext") in easy Urdu script (اردو).`;

    return defaultAIProvider.generateStructured<AyahGrammarTree>({
      systemInstruction,
      prompt: `Analyze the complete Arabic grammar structure of Ayah ${params.verseKey}: ${params.arabicAyah}`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verseKey: { type: Type.STRING },
          sentenceType: { type: Type.STRING, description: 'جملہ اسمیہ / جملہ فعلیہ اردو میں' },
          structureNodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                category: { type: Type.STRING, enum: ['Ism', "Fi'l", 'Harf'] },
                role: { type: Type.STRING },
                irabCase: { type: Type.STRING },
                explanationRomanUrdu: { type: Type.STRING, description: 'سادہ اردو میں وضاحت' },
              },
              required: ['word', 'category', 'role', 'irabCase', 'explanationRomanUrdu'],
            },
          },
          pronounReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
          rhetoricalFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
          ayahConnectionPrevNext: { type: Type.STRING },
        },
        required: [
          'verseKey',
          'sentenceType',
          'structureNodes',
          'pronounReferences',
          'rhetoricalFeatures',
          'ayahConnectionPrevNext',
        ],
      },
    });
  },

  async askUstaadQuestion(params: {
    verseKey: string;
    arabicAyah: string;
    selectedWord?: string;
    question: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<string> {
    const systemInstruction = `You are an experienced, warm Pakistani Quran & Tafseer Ustaad in Bahr-ul-Ilm AI.
CRITICAL RULE: Write your entire answer in **clear, natural, everyday Urdu script (اردو)** so that both reading and Urdu voice playback sound completely natural and clear! Preserve Quranic Arabic words accurately.
Cover EVERY angle point-by-point when helpful:
1. اگر صارف کسی لفظ کی گرامر پوچھے: اس کا مادہ، اسم/فعل/حرف، اور جملے میں کردار آسان اردو میں سمجھائیں۔
2. اگر تفسیر یا واقعہ (شانِ نزول) پوچھے: ابن کثیر، طبری، قرطبی اور معارف القرآن کی روشنی میں مستند تفصیل دیں۔
3. اگر کسی مسئلے میں علماء کی آراء مختلف ہوں تو الگ الگ بیان کریں اور غیر مستند بات شامل نہ کریں۔`;

    const historyBlock =
      params.history && params.history.length > 0
        ? `\nPrevious Companion Chat:\n${params.history
            .slice(-6)
            .map((m) => `${m.role === 'user' ? 'Student' : 'Ustaad'}: ${m.content}`)
            .join('\n')}\n`
        : '';

    return defaultAIProvider.generateText({
      systemInstruction,
      prompt: `Active Ayah (${params.verseKey}): ${params.arabicAyah}
${params.selectedWord ? `Selected Word: ${params.selectedWord}` : ''}${historyBlock}
Student Question: "${params.question}"`,
    });
  },
};
