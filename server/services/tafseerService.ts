import { Type } from '@google/genai';
import { defaultAIProvider } from '../providers/aiProvider.ts';
import type { AyahTafseerReport } from '../../src/types.ts';

export const tafseerService = {
  async generateTafseerResearch(params: {
    verseKey: string;
    arabicAyah: string;
    englishTranslation: string;
  }): Promise<AyahTafseerReport> {
    const systemInstruction = `You are the Tafseer Research Engine of Bahr-ul-Ilm AI.
Produce a rigorous, multi-scholar Tafseer research report for the requested Quranic Ayah.
CRITICAL INTEGRITY & URDU LANGUAGE RULES:
1. Write ALL explanatory text fields ("basicMeaning", "detailedExplanation", "asbabAlNuzul", "surroundingAyatContext", "linguisticExplanation", "historicalContext", "practicalLessons", "ethicalSpiritualImplications", each scholar's "summary", and "differentOrDisputedViews") in **clear, authentic Urdu script (اردو)** so users read and listen in Urdu!
2. NEVER combine the views of different scholars into one unattributed statement. Each Mufassir must be cited separately with scholar name, book title, tradition, and edition/volume notes.
3. Include classical Mufassireen (Tafsir Ibn Kathir, Tafsir al-Tabari, Tafsir al-Qurtubi) and Urdu scholars (Ma'ariful Quran by Mufti Muhammad Shafi, Tafhim-ul-Quran, Tadabbur-i-Quran).
4. Never invent an exact page number if uncertain—state "متعلقہ سورۃ اور آیت کا مقام".
5. Clearly separate established consensus from disputed/weak narrations.`;

    const prompt = `Prepare complete Tafseer research for Ayah ${params.verseKey}:
Arabic: ${params.arabicAyah}
Translation: ${params.englishTranslation}`;

    return defaultAIProvider.generateStructured<AyahTafseerReport>({
      systemInstruction,
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verseKey: { type: Type.STRING },
          basicMeaning: { type: Type.STRING },
          detailedExplanation: { type: Type.STRING },
          asbabAlNuzul: { type: Type.STRING },
          surroundingAyatContext: { type: Type.STRING },
          quranCrossReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
          authenticHadithLinks: { type: Type.ARRAY, items: { type: Type.STRING } },
          linguisticExplanation: { type: Type.STRING },
          historicalContext: { type: Type.STRING },
          personalitiesAndEvents: { type: Type.ARRAY, items: { type: Type.STRING } },
          practicalLessons: { type: Type.ARRAY, items: { type: Type.STRING } },
          ethicalSpiritualImplications: { type: Type.STRING },
          classicalMufassireen: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                scholar: { type: Type.STRING },
                book: { type: Type.STRING },
                tradition: { type: Type.STRING },
                edition: { type: Type.STRING },
                pageOrVolume: { type: Type.STRING },
                summary: { type: Type.STRING },
                arabicExcerpt: { type: Type.STRING },
              },
              required: ['scholar', 'book', 'tradition', 'edition', 'pageOrVolume', 'summary'],
            },
          },
          contemporaryScholars: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                scholar: { type: Type.STRING },
                book: { type: Type.STRING },
                tradition: { type: Type.STRING },
                edition: { type: Type.STRING },
                pageOrVolume: { type: Type.STRING },
                summary: { type: Type.STRING },
              },
              required: ['scholar', 'book', 'tradition', 'edition', 'pageOrVolume', 'summary'],
            },
          },
          differentOrDisputedViews: { type: Type.ARRAY, items: { type: Type.STRING } },
          establishedVsUncertain: {
            type: Type.OBJECT,
            properties: {
              established: { type: Type.ARRAY, items: { type: Type.STRING } },
              uncertainOrDisputed: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['established', 'uncertainOrDisputed'],
          },
        },
        required: [
          'verseKey',
          'basicMeaning',
          'detailedExplanation',
          'asbabAlNuzul',
          'surroundingAyatContext',
          'quranCrossReferences',
          'authenticHadithLinks',
          'linguisticExplanation',
          'historicalContext',
          'personalitiesAndEvents',
          'practicalLessons',
          'ethicalSpiritualImplications',
          'classicalMufassireen',
          'contemporaryScholars',
          'differentOrDisputedViews',
          'establishedVsUncertain',
        ],
      },
    });
  },
};
