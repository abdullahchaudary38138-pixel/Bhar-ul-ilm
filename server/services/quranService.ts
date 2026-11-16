import {
  JUZ_LIST,
  SURAH_LIST,
  VERIFIED_EXTRA_AYAHS,
  VERIFIED_FATIHA_AYAHS,
  VERIFIED_RECITERS,
  buildEveryAyahUrl,
} from '../corpus/quranData.ts';
import { defaultAIProvider } from '../providers/aiProvider.ts';
import type {
  QiraatEdition,
  QuranAyah,
  QuranJuzMeta,
  QuranSurahMeta,
  QuranWord,
  WebSourceCitation,
} from '../../src/types.ts';

const surahCache = new Map<string, QuranAyah[]>();
const pageCache = new Map<number, QuranAyah[]>();
const juzCache = new Map<number, QuranAyah[]>();

interface QuranComWord {
  position: number;
  text_uthmani?: string;
  text?: string;
  transliteration?: { text?: string };
  translation?: { text?: string };
  audio_url?: string;
  char_type_name?: string;
}

interface QuranComVerse {
  verse_number: number;
  verse_key: string;
  juz_number?: number;
  page_number?: number;
  text_uthmani: string;
  text_indopak?: string;
  words?: QuranComWord[];
  translations?: { resource_id: number; text: string }[];
}

function cleanTranslationText(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapVerseToAyah(
  v: QuranComVerse,
  reciterCdnFolder: string,
  qiraat: QiraatEdition,
  fallbackSurahNumber?: number
): QuranAyah {
  const keyParts = v.verse_key?.split(':') || [];
  const surahNumber = Number(keyParts[0]) || fallbackSurahNumber || 1;
  const ayahNumber = Number(keyParts[1]) || v.verse_number || 1;

  const urd = cleanTranslationText(v.translations?.find((t) => t.resource_id === 97)?.text);
  const eng = cleanTranslationText(v.translations?.find((t) => t.resource_id === 131)?.text);

  const words: QuranWord[] = (v.words || [])
    .filter((w) => w.char_type_name !== 'end')
    .map((w) => ({
      position: w.position,
      arabic: w.text_uthmani || w.text || '',
      transliteration: w.transliteration?.text || '',
      urduMeaning: w.translation?.text || '',
      englishMeaning: '',
      audioUrl: w.audio_url ? `https://audio.qurancdn.com/${w.audio_url}` : undefined,
    }));

  return {
    surahNumber,
    ayahNumber,
    verseKey: v.verse_key || `${surahNumber}:${ayahNumber}`,
    juzNumber: v.juz_number,
    mushafPage: v.page_number,
    qiraat,
    arabicUthmani: v.text_uthmani,
    arabicIndoPak: v.text_indopak,
    romanUrduTranslation: '',
    urduTranslation: urd,
    englishTranslation: eng,
    translationSources: {
      urdu: 'Maulana Fateh Muhammad Jalandhari (API 97)',
      english: 'Dr. Mustafa Khattab, The Clear Quran (API 131)',
    },
    audioUrl: buildEveryAyahUrl(reciterCdnFolder, surahNumber, ayahNumber),
    words,
  };
}

export const quranService = {
  getSurahList(): QuranSurahMeta[] {
    return SURAH_LIST;
  },

  getJuzList(): QuranJuzMeta[] {
    return JUZ_LIST;
  },

  getReciters() {
    return VERIFIED_RECITERS;
  },

  async getSurahAyahs(params: {
    surahNumber: number;
    reciterId?: number;
    qiraat?: QiraatEdition;
  }): Promise<{
    surah: QuranSurahMeta;
    ayahs: QuranAyah[];
    reciter: (typeof VERIFIED_RECITERS)[number];
    sourceNote: string;
  }> {
    const surahMeta =
      SURAH_LIST.find((s) => s.number === params.surahNumber) || SURAH_LIST[0];
    const reciter =
      VERIFIED_RECITERS.find((r) => r.id === params.reciterId) || VERIFIED_RECITERS[0];
    const qiraat: QiraatEdition = params.qiraat || "Hafs 'an Asim (Madinah Uthmani)";

    if (surahMeta.number === 1 && qiraat === "Hafs 'an Asim (Madinah Uthmani)") {
      return {
        surah: surahMeta,
        ayahs: VERIFIED_FATIHA_AYAHS.map((a) => ({
          ...a,
          audioUrl: buildEveryAyahUrl(reciter.cdnFolder, 1, a.ayahNumber),
        })),
        reciter,
        sourceNote: "Verified local Madinah Mushaf (Hafs 'an Asim) + Urdu Word Morphology",
      };
    }

    if (VERIFIED_EXTRA_AYAHS[String(surahMeta.number)] && qiraat === "Hafs 'an Asim (Madinah Uthmani)") {
      return {
        surah: surahMeta,
        ayahs: VERIFIED_EXTRA_AYAHS[String(surahMeta.number)].map((a) => ({
          ...a,
          audioUrl: buildEveryAyahUrl(reciter.cdnFolder, surahMeta.number, a.ayahNumber),
        })),
        reciter,
        sourceNote: "Verified local Madinah Mushaf (Hafs 'an Asim) + Urdu Word Morphology",
      };
    }

    const cacheKey = `${surahMeta.number}`;
    if (surahCache.has(cacheKey)) {
      const cached = surahCache.get(cacheKey)!;
      return {
        surah: surahMeta,
        ayahs: cached.map((a) => ({
          ...a,
          qiraat,
          audioUrl: buildEveryAyahUrl(reciter.cdnFolder, surahMeta.number, a.ayahNumber),
        })),
        reciter,
        sourceNote: 'Quran.com Verified API v4 (Uthmani Script + Urdu Translation & Word Meanings)',
      };
    }

    try {
      const totalPages = Math.max(1, Math.ceil(surahMeta.versesCount / 50));
      const pagePromises = Array.from({ length: totalPages }, (_, idx) => {
        const page = idx + 1;
        const url = `https://api.quran.com/api/v4/verses/by_chapter/${surahMeta.number}?language=ur&words=true&word_fields=text_uthmani&fields=text_uthmani,text_indopak,juz_number,page_number&translations=97,131&per_page=50&page=${page}`;
        return fetch(url, { signal: AbortSignal.timeout(10000) }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<{ verses?: QuranComVerse[] }>;
        });
      });
      const pagesJson = await Promise.all(pagePromises);
      const verses = pagesJson.flatMap((j) => j.verses || []);

      const mapped = verses.map((v) => mapVerseToAyah(v, reciter.cdnFolder, qiraat, surahMeta.number));
      if (mapped.length > 0) {
        surahCache.set(cacheKey, mapped);
        return {
          surah: surahMeta,
          ayahs: mapped,
          reciter,
          sourceNote: 'Quran.com Verified API v4 (Uthmani Script + Jalandhari Urdu & Urdu Word Gloss)',
        };
      }
    } catch {
      // Fallback below
    }

    return {
      surah: SURAH_LIST[0],
      ayahs: VERIFIED_FATIHA_AYAHS,
      reciter,
      sourceNote: 'Offline fallback: Verified local Surah Al-Fatiha (External Quran API unreachable)',
    };
  },

  async getPageAyahs(params: {
    pageNumber: number;
    reciterId?: number;
    qiraat?: QiraatEdition;
  }): Promise<{
    pageNumber: number;
    juzNumber: number;
    ayahs: QuranAyah[];
    reciter: (typeof VERIFIED_RECITERS)[number];
    sourceNote: string;
  }> {
    const pageNumber = Math.max(1, Math.min(604, Math.floor(params.pageNumber) || 1));
    const reciter =
      VERIFIED_RECITERS.find((r) => r.id === params.reciterId) || VERIFIED_RECITERS[0];
    const qiraat: QiraatEdition = params.qiraat || "Hafs 'an Asim (Madinah Uthmani)";

    if (pageNumber === 1) {
      return {
        pageNumber: 1,
        juzNumber: 1,
        ayahs: VERIFIED_FATIHA_AYAHS.map((a) => ({
          ...a,
          qiraat,
          audioUrl: buildEveryAyahUrl(reciter.cdnFolder, 1, a.ayahNumber),
        })),
        reciter,
        sourceNote: 'Madinah Mushaf Page 1 (Para 1 — Alif Lam Meem)',
      };
    }

    if (pageCache.has(pageNumber)) {
      const cached = pageCache.get(pageNumber)!;
      return {
        pageNumber,
        juzNumber: cached[0]?.juzNumber || 1,
        ayahs: cached.map((a) => ({
          ...a,
          qiraat,
          audioUrl: buildEveryAyahUrl(reciter.cdnFolder, a.surahNumber, a.ayahNumber),
        })),
        reciter,
        sourceNote: `Madinah Mushaf Page ${pageNumber} (Para ${cached[0]?.juzNumber || 1})`,
      };
    }

    try {
      const url = `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?language=ur&words=true&word_fields=text_uthmani&fields=text_uthmani,text_indopak,juz_number,page_number&translations=97,131&per_page=50`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as { verses?: QuranComVerse[] };
      const mapped = (json.verses || []).map((v) => mapVerseToAyah(v, reciter.cdnFolder, qiraat));
      if (mapped.length > 0) {
        pageCache.set(pageNumber, mapped);
        return {
          pageNumber,
          juzNumber: mapped[0]?.juzNumber || 1,
          ayahs: mapped,
          reciter,
          sourceNote: `Madinah Mushaf Page ${pageNumber} · Para ${mapped[0]?.juzNumber || 1}`,
        };
      }
    } catch {
      // Fallback to Fatiha
    }

    return {
      pageNumber: 1,
      juzNumber: 1,
      ayahs: VERIFIED_FATIHA_AYAHS,
      reciter,
      sourceNote: 'Offline fallback: Madinah Mushaf Page 1',
    };
  },

  async getJuzAyahs(params: {
    juzNumber: number;
    reciterId?: number;
    qiraat?: QiraatEdition;
  }): Promise<{
    juz: QuranJuzMeta;
    ayahs: QuranAyah[];
    reciter: (typeof VERIFIED_RECITERS)[number];
    sourceNote: string;
  }> {
    const juzNumber = Math.max(1, Math.min(30, Math.floor(params.juzNumber) || 1));
    const juzMeta = JUZ_LIST.find((j) => j.number === juzNumber) || JUZ_LIST[0];
    const reciter =
      VERIFIED_RECITERS.find((r) => r.id === params.reciterId) || VERIFIED_RECITERS[0];
    const qiraat: QiraatEdition = params.qiraat || "Hafs 'an Asim (Madinah Uthmani)";

    if (juzCache.has(juzNumber)) {
      const cached = juzCache.get(juzNumber)!;
      return {
        juz: juzMeta,
        ayahs: cached.map((a) => ({
          ...a,
          qiraat,
          audioUrl: buildEveryAyahUrl(reciter.cdnFolder, a.surahNumber, a.ayahNumber),
        })),
        reciter,
        sourceNote: `${juzMeta.nameEnglish} · Mushaf Pages ${juzMeta.startPage}–${juzMeta.endPage}`,
      };
    }

    try {
      const firstUrl = `https://api.quran.com/api/v4/verses/by_juz/${juzNumber}?language=ur&words=true&word_fields=text_uthmani&fields=text_uthmani,text_indopak,juz_number,page_number&translations=97,131&per_page=50&page=1`;
      const firstResp = await fetch(firstUrl, { signal: AbortSignal.timeout(10000) });
      if (!firstResp.ok) throw new Error(`HTTP ${firstResp.status}`);
      const firstJson = (await firstResp.json()) as {
        verses?: QuranComVerse[];
        pagination?: { total_pages?: number };
      };
      const totalPages = Math.min(12, Math.max(1, firstJson.pagination?.total_pages || 1));
      let allVerses = firstJson.verses || [];

      if (totalPages > 1) {
        const restPromises = Array.from({ length: totalPages - 1 }, (_, i) => {
          const p = i + 2;
          const url = `https://api.quran.com/api/v4/verses/by_juz/${juzNumber}?language=ur&words=true&word_fields=text_uthmani&fields=text_uthmani,text_indopak,juz_number,page_number&translations=97,131&per_page=50&page=${p}`;
          return fetch(url, { signal: AbortSignal.timeout(10000) })
            .then((r) => (r.ok ? (r.json() as Promise<{ verses?: QuranComVerse[] }>) : { verses: [] }))
            .catch(() => ({ verses: [] }));
        });
        const rest = await Promise.all(restPromises);
        allVerses = allVerses.concat(rest.flatMap((r) => r.verses || []));
      }

      const mapped = allVerses.map((v) => mapVerseToAyah(v, reciter.cdnFolder, qiraat));
      if (mapped.length > 0) {
        juzCache.set(juzNumber, mapped);
        return {
          juz: juzMeta,
          ayahs: mapped,
          reciter,
          sourceNote: `${juzMeta.nameEnglish} · Mushaf Pages ${juzMeta.startPage}–${juzMeta.endPage}`,
        };
      }
    } catch {
      // Fallback to page 1 of Para
    }

    const fallbackPage = await this.getPageAyahs({
      pageNumber: juzMeta.startPage,
      reciterId: params.reciterId,
      qiraat,
    });
    return {
      juz: juzMeta,
      ayahs: fallbackPage.ayahs,
      reciter,
      sourceNote: `${juzMeta.nameEnglish} (Starting Mushaf Page ${juzMeta.startPage})`,
    };
  },

  async searchQuranSEO(query: string): Promise<{
    answer: string;
    matchedRefs: { verseKey: string; surahNumber: number; ayahNumber: number; snippet: string }[];
    webSources: WebSourceCitation[];
  }> {
    const cleanQ = query.trim();
    if (!cleanQ) {
      return { answer: '', matchedRefs: [], webSources: [] };
    }

    const quranComMatches: { verseKey: string; surahNumber: number; ayahNumber: number; snippet: string }[] = [];
    try {
      const apiResp = await fetch(
        `https://api.quran.com/api/v4/search?q=${encodeURIComponent(cleanQ)}&size=6&language=ur`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (apiResp.ok) {
        const json = (await apiResp.json()) as {
          search?: { results?: { verse_key?: string; text?: string; translations?: { text?: string }[] }[] };
        };
        for (const r of json.search?.results || []) {
          if (r.verse_key) {
            const [s, a] = r.verse_key.split(':').map(Number);
            if (s >= 1 && s <= 114 && a >= 1) {
              quranComMatches.push({
                verseKey: r.verse_key,
                surahNumber: s,
                ayahNumber: a,
                snippet: cleanTranslationText(r.translations?.[0]?.text || r.text || ''),
              });
            }
          }
        }
      }
    } catch {
      // Ignore if query is Roman Urdu keyword not indexed directly by Quran.com search
    }

    let answer = '';
    let webSources: WebSourceCitation[] = [];
    try {
      const grounded = await defaultAIProvider.generateGroundedAnswer({
        systemInstruction: `You are Bahr-ul-Ilm AI's Smart Quranic Topic & Verse Finder ("SEO-style natural search").
The user can ask ANY Quran-related question in ANY style (Roman Urdu, Urdu script, Arabic, or English — e.g., "pareshani aur depression ka Quran mein kya hal hai", "Surah Kahf ki pehli 10 ayat", "rizq mein barkat ki ayat", "Ayat ul Kursi", "walidain ke huqooq").
INSTRUCTIONS:
1. Write the ENTIRE answer in **clear, simple, respectful Urdu script (اردو)** so it reads clearly and speaks naturally in Urdu audio. (Never answer in Roman Urdu).
2. Cite exact Surah names and Ayah references clearly as [Surah:Ayah] e.g. [2:255], [94:5], [17:23] and provide exact Urdu translation.
3. NEVER invent Quran verses or Arabic wording. Only cite verified Surah:Ayah numbers.
4. Explicitly state which Surah, Para (Juz), and Tafseer source the answer came from.`,
        prompt: `User Quran Search Query: "${cleanQ}"\n\nQuran.com Search Hits:\n${
          quranComMatches.length > 0
            ? quranComMatches.map((m) => `${m.verseKey}: ${m.snippet}`).join('\n')
            : 'No literal keyword hit in Quran.com search index — interpret user intent semantically and provide exact verified Surah:Ayah references in Urdu.'
        }`,
      });
      answer = grounded.text;
      webSources = grounded.webSources;
    } catch {
      const lower = cleanQ.toLowerCase();
      for (const s of SURAH_LIST) {
        if (
          s.nameEnglish.toLowerCase().includes(lower) ||
          s.meaningEnglish.toLowerCase().includes(lower) ||
          s.nameArabic.includes(cleanQ)
        ) {
          if (!quranComMatches.some((m) => m.surahNumber === s.number)) {
            quranComMatches.push({
              verseKey: `${s.number}:1`,
              surahNumber: s.number,
              ayahNumber: 1,
              snippet: `سورۃ ${s.nameArabic} (${s.nameEnglish})`,
            });
          }
        }
      }
      answer =
        quranComMatches.length > 0
          ? `قرآن مجید میں "${cleanQ}" سے متعلق یہ آیات ملی ہیں:\n` +
            quranComMatches.map((m) => `• [${m.verseKey}] ${m.snippet}`).join('\n')
          : `قرآن انڈیکس میں "${cleanQ}" کے لیے براہِ راست نتیجہ نہیں ملا۔ اوپر پارہ، سورت یا صفحہ منتخب کر کے پڑھیں۔`;
    }

    // Extract Surah:Ayah keys mentioned in grounded response
    const refRegex = /\b(\d{1,3}):(\d{1,3})\b/g;
    const seenKeys = new Set(quranComMatches.map((m) => m.verseKey));
    let match: RegExpExecArray | null;
    while ((match = refRegex.exec(answer)) !== null) {
      const s = Number(match[1]);
      const a = Number(match[2]);
      const key = `${s}:${a}`;
      const surahMeta = SURAH_LIST.find((item) => item.number === s);
      if (surahMeta && a >= 1 && a <= surahMeta.versesCount && !seenKeys.has(key)) {
        seenKeys.add(key);
        quranComMatches.push({
          verseKey: key,
          surahNumber: s,
          ayahNumber: a,
          snippet: `Surah ${surahMeta.nameEnglish} (${surahMeta.nameArabic}) · Ayah ${a}`,
        });
      }
    }

    return {
      answer,
      matchedRefs: quranComMatches.slice(0, 8),
      webSources: webSources.slice(0, 5),
    };
  },
};
