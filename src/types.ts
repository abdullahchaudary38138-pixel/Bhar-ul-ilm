export type SupportedLanguage = 'Roman Urdu' | 'Urdu' | 'Arabic' | 'English' | 'Mixed';

export interface CodeSwitchSegment {
  text: string;
  language: SupportedLanguage;
}

export interface UncertainSpan {
  phrase: string;
  reason: string;
  alternatives: string[];
}

export interface TranscriptResult {
  transcript: string;
  detectedLanguages: SupportedLanguage[];
  primaryLanguage: SupportedLanguage;
  codeSwitchingSegments: CodeSwitchSegment[];
  confidence: number;
  lowConfidenceWarning: boolean;
  warningMessage?: string;
  uncertainSpans: UncertainSpan[];
  audioId?: string;
  latencyMs: number;
}

export type UnderstandingStatus = 'proceed' | 'clarify' | 'confirm_understanding';

export interface ExtractedEntities {
  names: string[];
  events: string[];
  dates: string[];
  books: string[];
  references: string[];
}

export interface UnderstandingAnalysis {
  subject: string;
  intentType:
    | 'simple_lookup'
    | 'comparative_research'
    | 'ambiguous_query'
    | 'follow_up'
    | 'claim_verification'
    | 'clarification_response';
  entities: ExtractedEntities;
  confirmedInfo: string[];
  assumptions: string[];
  ambiguities: string[];
  missingDetails: string[];
  status: UnderstandingStatus;
  clarificationQuestion?: string;
  confirmationPrompt?: string;
  detectedLanguages: SupportedLanguage[];
}

export type SourceType =
  | 'Quran'
  | 'Hadith'
  | 'Tafsir'
  | 'Seerah'
  | 'Book'
  | 'Scholar'
  | 'Historical Event'
  | 'Arabic Root'
  | 'Uploaded Document';

export type MatchType =
  | 'Exact Quotation'
  | 'Keyword Match'
  | 'Arabic Root Match'
  | 'Approximate Semantic Match'
  | 'Cross-Reference';

export interface CorpusPassage {
  id: string;
  sourceType: SourceType;
  title: string;
  book: string;
  author: string;
  edition: string;
  page: string;
  collection: string;
  date: string;
  tradition: string;
  arabicText?: string;
  urduTranslation?: string;
  englishTranslation: string;
  arabicRoots?: string[];
  keywords: string[];
  verificationStatus:
    | 'Verified Primary Source'
    | 'Authenticated Classical Text'
    | 'User Uploaded Source'
    | 'OCR Uncertain';
  matchType?: MatchType;
  score?: number;
}

export type VerificationOutcome =
  | 'Supported by the cited source'
  | 'Partially supported'
  | 'Context missing'
  | 'Disputed'
  | 'Misattributed'
  | 'Not found in available sources'
  | 'Unable to verify';

export interface MediaBreakdown {
  exactTranscript: string;
  translation: string;
  interpretation: string;
  aiSummary: string;
}

export interface WebSourceCitation {
  title: string;
  url: string;
}

export interface VerificationReport {
  id: string;
  claim: string;
  whatNeedsVerification: string[];
  outcome: VerificationOutcome;
  earliestTraceableSource: string;
  evidenceComparison: string;
  explanation: string;
  confidenceNote: string;
  citations: CorpusPassage[];
  webSources?: WebSourceCitation[];
  mediaBreakdown?: MediaBreakdown;
  createdAt: string;
}

export interface DiagramData {
  title: string;
  nodes: { id: string; label: string; detail?: string }[];
  edges: { from: string; to: string; label?: string }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  arabicQuote?: string;
  spokenSummary?: string;
  detectedLanguages?: SupportedLanguage[];
  understanding?: UnderstandingAnalysis;
  citations?: CorpusPassage[];
  webSources?: WebSourceCitation[];
  diagram?: DiagramData;
  audioUrl?: string;
  latencyMs?: number;
  timestamp: string;
  requiresConfirmation?: boolean;
  confirmationResolved?: 'accepted' | 'rejected';
  originalQueryForConfirmation?: string;
}

export interface ResearchTopic {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeContext?: {
    surahNumber?: number;
    ayahNumber?: number;
    selectedWord?: string;
    bookId?: string;
    pageNumber?: number;
  };
  messages: ChatMessage[];
}

export interface ResearchNote {
  id: string;
  title: string;
  topicId?: string;
  summary: string;
  arabicReferences: string[];
  citations: CorpusPassage[];
  createdAt: string;
}

export interface VoiceMetrics {
  totalVoiceQueries: number;
  avgLatencyMs: number;
  avgRecognitionConfidence: number;
  arabicTermAccuracyEstimate: number;
  interruptionsHandled: number;
  userCorrections: number;
  clarificationsTriggered: number;
}

// ==========================================
// QURAN STUDIO, USTAAD & TAFSEER TYPES
// ==========================================

export type QiraatEdition = "Hafs 'an Asim (Madinah Uthmani)" | "Hafs 'an Asim (IndoPak)" | "Warsh 'an Nafi' (Display Only)";

export interface QuranWord {
  position: number;
  arabic: string;
  transliteration: string;
  urduMeaning: string;
  englishMeaning: string;
  root?: string;
  pos?: string; // Ism, Fi'l, Harf
  audioUrl?: string;
  tajweedTags?: string[];
}

export interface QuranAyah {
  surahNumber: number;
  ayahNumber: number;
  verseKey: string;
  juzNumber?: number;
  mushafPage?: number;
  qiraat: string;
  arabicUthmani: string;
  arabicIndoPak?: string;
  romanUrduTranslation: string;
  urduTranslation: string;
  englishTranslation: string;
  translationSources: {
    urdu: string;
    english: string;
  };
  audioUrl: string;
  words: QuranWord[];
}

export interface QuranJuzMeta {
  number: number;
  nameArabic: string;
  nameEnglish: string;
  startVerseKey: string;
  endVerseKey: string;
  startPage: number;
  endPage: number;
}

export interface QuranSurahMeta {
  number: number;
  nameArabic: string;
  nameEnglish: string;
  meaningEnglish: string;
  revelationPlace: 'Makkah' | 'Madinah';
  versesCount: number;
}

export interface WordDeepAnalysis {
  arabicWord: string;
  romanPronunciation: string;
  urduMeaning: string;
  englishMeaning: string;
  rootLetters: string;
  originalRootMeaning: string;
  sarfPattern: string;
  grammaticalCategory: string; // Ism / Fi'l / Harf
  morphologyDetails: string; // Singular/plural, gender, tense/person where applicable
  nahwIrabRole: string; // Mubtada, Khabar, Fa'il, Maf'ul, Majrur, etc.
  whyThisFormUsed: string;
  connectionToAdjacentWords: string;
  contextualMeaning: string;
  otherQuranicOccurrences: string[];
  multipleMeanings: string[];
  grammarImportanceInRomanUrdu: string;
  balaghaNote?: string;
}

export interface AyahGrammarTree {
  verseKey: string;
  sentenceType: string;
  structureNodes: {
    word: string;
    category: 'Ism' | "Fi'l" | 'Harf';
    role: string;
    irabCase: string;
    explanationRomanUrdu: string;
  }[];
  pronounReferences: string[];
  rhetoricalFeatures: string[];
  ayahConnectionPrevNext: string;
}

export interface TafseerScholarEntry {
  scholar: string;
  book: string;
  tradition: string;
  edition: string;
  pageOrVolume: string;
  summary: string;
  arabicExcerpt?: string;
}

export interface AyahTafseerReport {
  verseKey: string;
  basicMeaning: string;
  detailedExplanation: string;
  asbabAlNuzul: string;
  surroundingAyatContext: string;
  quranCrossReferences: string[];
  authenticHadithLinks: string[];
  linguisticExplanation: string;
  historicalContext: string;
  personalitiesAndEvents: string[];
  practicalLessons: string[];
  ethicalSpiritualImplications: string;
  classicalMufassireen: TafseerScholarEntry[];
  contemporaryScholars: TafseerScholarEntry[];
  differentOrDisputedViews: string[];
  establishedVsUncertain: {
    established: string[];
    uncertainOrDisputed: string[];
  };
}

// ==========================================
// MODULE A: SPECIALIZED TAJWEED & TILAWAT ENGINE
// ==========================================

export type TajweedIssueState = 'Confirmed issue' | 'Possible issue' | 'Unable to assess';

export interface TajweedFinding {
  id: string;
  wordPosition: number;
  originalArabicWord: string;
  detectedPronunciation: string;
  expectedRuleOrMakhraj: string;
  ruleCitationOrBookReason?: string;
  impactIfMisread?: string;
  nextFocusChecklist?: string[];
  category:
    | 'Letter / Makhraj'
    | 'Short Vowel (Harakat)'
    | 'Long Vowel / Madd'
    | 'Ghunna'
    | 'Qalqalah'
    | 'Noon Sakin / Tanween'
    | 'Meem Sakin'
    | 'Shaddah / Sukoon'
    | 'Omitted / Added Word'
    | 'Waqf / Ibtida'
    | 'Audio Quality';
  state: TajweedIssueState;
  confidence: number;
  timestampRangeSec: string;
  explanationPakistaniUrdu: string;
  whyItMatters: string;
  assessmentSource: 'Machine-assessed (Needs Qari verification for certification)' | 'Human Qari reviewed';
  qariNote?: string;
}

export interface WordAlignmentItem {
  position: number;
  expectedWord: string;
  recognizedWord: string | null;
  status: 'matched' | 'substituted' | 'omitted' | 'uncertain';
  applicableRules: string[];
}

export interface TilawatAssessmentResult {
  id: string;
  verseKey: string;
  qiraat: string;
  qiraatSupported: boolean;
  qiraatLimitationNote?: string;
  recognizedArabicText: string;
  audioDurationSec: number;
  estimatedSnrDb: number;
  overallConfidence: number;
  overallState: 'Ready to advance' | 'Practice recommended' | 'Unable to assess reliably';
  pakistaniUrduCoachSummary: string;
  nextFocusChecklist?: string[];
  wordAlignments: WordAlignmentItem[];
  findings: TajweedFinding[];
  referenceAudioUrl?: string;
  storedAudioUrl?: string;
  privacyNotice: string;
  createdAt: string;
}

export interface CompanionChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citationNote?: string;
  timestamp: string;
}

// ==========================================
// ISLAMIC BOOK LIBRARY & READER TYPES
// ==========================================

export type LibraryCategory =
  | 'Quran and Tafseer'
  | 'Hadith'
  | 'Hadith Sciences'
  | 'Seerah'
  | 'Sahaba'
  | 'Ahl-e-Bayt'
  | 'Khulafa-e-Rashideen'
  | 'Imams'
  | 'Islamic Scholars'
  | 'Fiqh'
  | 'Aqeedah'
  | 'Islamic History'
  | 'Arabic Grammar'
  | 'Islamic Civilization'
  | 'Spiritual & Ethical'
  | 'Islamic Psychology & Tazkiyah'
  | 'Personal Uploads';

export interface BookPage {
  digitalPage: number;
  printedPage: string;
  chapter: string;
  text: string;
  arabicText?: string;
  urduTranslation?: string;
  romanUrduTranslation?: string;
  ocrUncertain?: boolean;
}

export interface IslamicBook {
  id: string;
  title: string;
  author: string;
  category: LibraryCategory;
  tradition: string;
  edition: string;
  publisher: string;
  volume: string;
  language: 'Arabic' | 'Urdu' | 'English' | 'Mixed';
  isPersonalUpload: boolean;
  personalityTag?: string;
  pages: BookPage[];
}

export interface BookComparisonReport {
  subject: string;
  agreements: string[];
  differences: {
    aspect: string;
    accounts: { bookTitle: string; author: string; reference: string; account: string }[];
    differenceType: 'Factual' | 'Interpretive' | 'Transmission / Isnad';
  }[];
  timeline: { dateOrEra: string; event: string; source: string }[];
  missingOrDisputedEvidence: string[];
}

// ==========================================
// LEARNING PROGRESS & REVISION TYPES
// ==========================================

export interface LearningProgressState {
  surahsStudied: number[];
  ayatStudied: string[];
  vocabularyCount: number;
  grammarLessonsCompleted: string[];
  tajweedPracticeCount: number;
  mistakesLogged: number;
  mistakesCorrected: number;
  booksReadPages: { bookId: string; title: string; lastPage: number }[];
  revisionQueue: {
    id: string;
    label: string;
    type: 'Ayah' | 'Tajweed' | 'Grammar' | 'Book';
    dueDate: string;
    completed: boolean;
  }[];
  bookmarks: { id: string; label: string; targetType: 'ayah' | 'book'; targetRef: string; note?: string }[];
}

// ==========================================
// COMPARATIVE WORLD RELIGIONS & SCRIPTURES
// ==========================================

export type ReligionTraditionId =
  | 'torah'
  | 'zabur'
  | 'injil'
  | 'gita'
  | 'dhammapada'
  | 'guru_granth';

export interface ScriptureWordToken {
  position: number;
  original: string;
  transliteration: string;
  urduMeaning: string;
  grammarRole?: string;
}

export interface ScripturePassage {
  id: string;
  traditionId: ReligionTraditionId;
  traditionNameUrdu: string;
  bookNameUrdu: string;
  reference: string;
  originalLanguage: string;
  originalText: string;
  urduTranslation: string;
  traditionTafseerUrdu: string;
  islamicQuranicPovUrdu: string;
  quranicReferences: string[];
  words: ScriptureWordToken[];
}

export interface ScriptureWordAnalysis {
  originalWord: string;
  transliteration: string;
  pronunciationUrdu?: string;
  urduMeaning: string;
  meaningInOriginalLanguageUrdu?: string;
  originalLanguageNote?: string;
  whyThisWordUsedUrdu?: string;
  rootAndHistoryUrdu: string;
  usageInBookUrdu: string;
  quranicComparisonUrdu: string;
}

// ==========================================
// KIDS ACADEMY, HIFZ & 7-HOUR MOTION STORIES
// ==========================================

export interface KidsStoryScene {
  sceneNumber: number;
  titleUrdu: string;
  narrationUrdu: string;
  characterDialogueUrdu: string;
  imageUrl: string;
  durationSec: number;
}

export interface KidsStoryEpisode {
  id: string;
  titleUrdu: string;
  topic: string;
  moralUrdu: string;
  quranVerseArabic: string;
  quranVerseUrdu: string;
  verseRef: string;
  sunnahActionUrdu: string;
  createdAt: string;
  isAutoGenerated: boolean;
  scenes: KidsStoryScene[];
}

export interface ReligionChapterRef {
  id: string;
  chapterNumber: number;
  titleUrdu: string;
  reference: string;
  summaryUrdu: string;
}

export interface KalimaItem {
  number: number;
  titleUrdu: string;
  subtitleUrdu: string;
  arabicText: string;
  urduTranslation: string;
  childExplanationUrdu: string;
}

export interface WuduStep {
  stepNumber: number;
  titleUrdu: string;
  isFarz?: boolean;
  arabicDua?: string;
  instructionUrdu: string;
  tipUrdu: string;
}

export interface NamazStep {
  stepNumber: number;
  titleUrdu: string;
  postureUrdu: string;
  arabicText: string;
  urduTranslation: string;
  howToDoUrdu: string;
}

export interface NamazRakatRow {
  prayerNameUrdu: string;
  timeUrdu: string;
  rakatBreakdownUrdu: string;
  totalRakats: number;
}


