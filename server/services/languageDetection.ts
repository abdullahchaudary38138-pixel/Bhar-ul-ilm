import type { CodeSwitchSegment, SupportedLanguage } from '../../src/types.ts';

const ARABIC_URDU_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const URDU_SPECIFIC_CHARS_REGEX = /[ٹڈڑںےھپچژگک]/;
const ROMAN_URDU_MARKERS = new Set([
  'kya', 'hai', 'hain', 'mein', 'main', 'ke', 'ki', 'ka', 'ko', 'aur', 'yeh', 'ye', 'woh', 'wo',
  'kaise', 'kyun', 'kahan', 'kab', 'kaun', 'aap', 'hum', 'tum', 'mera', 'meri', 'hamara', 'daur',
  'masla', 'maslay', 'roshni', 'bare', 'baat', 'kar', 'rahe', 'raha', 'rahi', 'chahte', 'chahta',
  'bataiye', 'batayein', 'samajh', 'sahi', 'ghalat', 'tariqa', 'hawala', 'kitaab', 'tafseer',
  'hadees', 'hadith', 'aayat', 'ayat', 'surah', 'hazrat', 'sahabi', 'ijma', 'qiyas', 'fiqh',
  'wuzu', 'namaz', 'roza', 'zakat', 'hajj', 'seerah', 'waqia', 'tareekh', 'zaroori', 'mukhtasar',
  'tafseel', 'samjha', 'samjhao', 'dobara', 'sunaiye', 'parhein', 'likhein', 'iska', 'iski', 'iske',
]);

const ARABIC_TRANSLITERATION_TERMS = new Set([
  'rahmah', 'rahim', 'rahman', 'ilm', 'ulama', 'adl', 'sabr', 'shura', 'hukm', 'hikmah',
  'taqwa', 'iman', 'ihsan', 'sunnah', 'shariah', 'khilafah', 'bayah', 'hijrah', 'ghazwah',
  'isnad', 'matn', 'sahih', 'hasan', 'daif', 'mawdu', 'mutawatir', 'ahad', 'maslaha', 'maqasid',
]);

export const languageDetectionService = {
  detect(text: string): {
    primaryLanguage: SupportedLanguage;
    detectedLanguages: SupportedLanguage[];
    codeSwitchingSegments: CodeSwitchSegment[];
  } {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return {
        primaryLanguage: 'English',
        detectedLanguages: ['English'],
        codeSwitchingSegments: [],
      };
    }

    const counts: Record<Exclude<SupportedLanguage, 'Mixed'>, number> = {
      Arabic: 0,
      Urdu: 0,
      'Roman Urdu': 0,
      English: 0,
    };

    const segments: CodeSwitchSegment[] = [];

    for (const token of tokens) {
      const cleaned = token.toLowerCase().replace(/[.,!?;:"'()\[\]؟،۔]/g, '');
      let lang: Exclude<SupportedLanguage, 'Mixed'> = 'English';

      if (ARABIC_URDU_SCRIPT_REGEX.test(token)) {
        if (URDU_SPECIFIC_CHARS_REGEX.test(token)) {
          lang = 'Urdu';
        } else {
          // Heuristic: classical diacritics or Arabic definite article al- suggest Arabic, otherwise check common Urdu script words
          const urduWords = ['کیا', 'ہے', 'ہیں', 'میں', 'اور', 'یہ', 'وہ', 'کیسے', 'کیوں', 'آپ', 'کے', 'کی', 'کا', 'کو', 'سے', 'پر', 'نہیں', 'ہو', 'تھا', 'تھے'];
          if (urduWords.includes(cleaned)) {
            lang = 'Urdu';
          } else {
            lang = 'Arabic';
          }
        }
      } else if (ROMAN_URDU_MARKERS.has(cleaned)) {
        lang = 'Roman Urdu';
      } else if (ARABIC_TRANSLITERATION_TERMS.has(cleaned)) {
        lang = 'Arabic';
      } else {
        lang = 'English';
      }

      counts[lang]++;
      const prev = segments[segments.length - 1];
      if (prev && prev.language === lang) {
        prev.text = `${prev.text} ${token}`;
      } else {
        segments.push({ text: token, language: lang });
      }
    }

    const active = (Object.entries(counts) as [Exclude<SupportedLanguage, 'Mixed'>, number][])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    const detectedLanguages: SupportedLanguage[] = active.map(([lang]) => lang);
    let primaryLanguage: SupportedLanguage = active[0]?.[0] ?? 'English';

    if (detectedLanguages.length > 1) {
      // If a secondary language has meaningful presence, classify primary as Mixed
      const secondaryCount = active[1]?.[1] ?? 0;
      if (secondaryCount >= 1 && tokens.length >= 3) {
        primaryLanguage = 'Mixed';
      }
    }

    return {
      primaryLanguage,
      detectedLanguages: detectedLanguages.length > 0 ? detectedLanguages : ['English'],
      codeSwitchingSegments: segments,
    };
  },
};
