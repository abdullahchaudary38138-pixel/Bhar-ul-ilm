import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  Repeat,
  Bookmark,
  Volume2,
  BookOpenCheck,
  Mic,
  MicOff,
  Square,
  GitBranch,
  Send,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Search,
  BookOpen,
  SkipForward,
} from 'lucide-react';
import { MicrophoneRecorder, convertBlobToWav } from '../utils/audioUtils.ts';
import { playInlineUrduSpeech, stopInlineUrduSpeech } from '../utils/ttsPlayer.ts';
import type {
  AyahGrammarTree,
  AyahTafseerReport,
  CompanionChatMessage,
  QiraatEdition,
  QuranAyah,
  QuranJuzMeta,
  QuranSurahMeta,
  QuranWord,
  WebSourceCitation,
  WordDeepAnalysis,
} from '../types.ts';

interface Reciter {
  id: number;
  name: string;
  style: string;
  qiraat: string;
}

export interface QuranStudioViewProps {
  selectedSurah: number;
  selectedAyahNum: number;
  onChangeSurahAyah: (surah: number, ayah: number) => void;
  onPracticeTilawat: (ayah: QuranAyah) => void;
  onOpenInLiveVoice: (contextPrompt: string) => void;
  onSpeakText?: (text: string) => void;
}

type ReadingTheme = 'navy' | 'light' | 'parchment';
type InspectorTab = 'word' | 'tafseer' | 'chat';
type BrowseMode = 'surah' | 'para' | 'page';
type ReaderLayoutMode = 'mushaf' | 'ayah';

const DEFAULT_QIRAAT: QiraatEdition = "Hafs 'an Asim (Madinah Uthmani)";

function toArabicIndicDigits(n: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n)
    .split('')
    .map((d) => digits[Number(d)] ?? d)
    .join('');
}

export const QuranStudioView: React.FC<QuranStudioViewProps> = ({
  selectedSurah,
  selectedAyahNum,
  onChangeSurahAyah,
  onPracticeTilawat,
  onOpenInLiveVoice,
}) => {
  const [surahs, setSurahs] = useState<QuranSurahMeta[]>([]);
  const [juzs, setJuzs] = useState<QuranJuzMeta[]>([]);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [reciterId, setReciterId] = useState<number>(7);
  const [surahMeta, setSurahMeta] = useState<QuranSurahMeta | null>(null);
  const [ayahs, setAyahs] = useState<QuranAyah[]>([]);
  const [loadingSurah, setLoadingSurah] = useState<boolean>(false);

  // Browse Mode: 114 Surahs / 30 Paras / 604 Mushaf Pages
  const [browseMode, setBrowseMode] = useState<BrowseMode>('surah');
  const [selectedJuz, setSelectedJuz] = useState<number>(1);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [pageJumpInput, setPageJumpInput] = useState<string>('1');
  const [readerLayout, setReaderLayout] = useState<ReaderLayoutMode>('mushaf');

  // SEO Quran Search
  const [quranSearchQuery, setQuranSearchQuery] = useState<string>('');
  const [searchingQuran, setSearchingQuran] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<{
    answer: string;
    matchedRefs: { verseKey: string; surahNumber: number; ayahNumber: number; snippet: string }[];
    webSources: WebSourceCitation[];
  } | null>(null);
  const [searchMicRecording, setSearchMicRecording] = useState<boolean>(false);
  const searchRecorderRef = useRef<MicrophoneRecorder | null>(null);

  // Reading preferences (Pure Urdu by default)
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('navy');
  const [arabicFontPx, setArabicFontPx] = useState<number>(32);
  const [showUrdu, setShowUrdu] = useState<boolean>(true);
  const [showWordGloss, setShowWordGloss] = useState<boolean>(true);
  const [showEnglish, setShowEnglish] = useState<boolean>(false);

  // Audio playback, continuous mode, & voice-command Tilawat
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [continuousMode, setContinuousMode] = useState<boolean>(true);
  const [loopAyah, setLoopAyah] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [highlightedWordPos, setHighlightedWordPos] = useState<number | null>(null);
  const [voiceCmdActive, setVoiceCmdActive] = useState<boolean>(false);
  const [voiceCmdRecording, setVoiceCmdRecording] = useState<boolean>(false);
  const [voiceCmdStatus, setVoiceCmdStatus] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);
  const voiceCmdRecorderRef = useRef<MicrophoneRecorder | null>(null);
  const voiceCmdWantedRef = useRef<boolean>(false);
  const ayahsRef = useRef<QuranAyah[]>([]);
  const activeAyahRef = useRef<QuranAyah | null>(null);
  const continuousModeRef = useRef<boolean>(true);
  const loopAyahRef = useRef<boolean>(false);
  const playbackSpeedRef = useRef<number>(1.0);
  const isPlayingRef = useRef<boolean>(false);

  // Simplified 3-tab Ustaad panel
  const [selectedWord, setSelectedWord] = useState<QuranWord | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('word');
  const [wordAnalysis, setWordAnalysis] = useState<WordDeepAnalysis | null>(null);
  const [loadingWord, setLoadingWord] = useState<boolean>(false);
  const [grammarTree, setGrammarTree] = useState<AyahGrammarTree | null>(null);
  const [grammarVerseKey, setGrammarVerseKey] = useState<string | null>(null);
  const [loadingGrammar, setLoadingGrammar] = useState<boolean>(false);
  const [tafseerReport, setTafseerReport] = useState<AyahTafseerReport | null>(null);
  const [tafseerVerseKey, setTafseerVerseKey] = useState<string | null>(null);
  const [loadingTafseer, setLoadingTafseer] = useState<boolean>(false);

  // Ustaad Chat & Mic
  const [surahFilter, setSurahFilter] = useState<string>('');
  const [ustaadQuestion, setUstaadQuestion] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<CompanionChatMessage[]>([]);
  const [askingUstaad, setAskingUstaad] = useState<boolean>(false);
  const [micRecording, setMicRecording] = useState<boolean>(false);
  const [micTranscribing, setMicTranscribing] = useState<boolean>(false);
  const [bookmarkMessage, setBookmarkMessage] = useState<string | null>(null);
  const chatRecorderRef = useRef<MicrophoneRecorder | null>(null);

  useEffect(() => {
    fetch('/api/quran/surahs')
      .then((r) => r.json())
      .then((data) => {
        setSurahs(data.surahs || []);
        setJuzs(data.juzs || []);
        setReciters(data.reciters || []);
      })
      .catch(() => {});
    return () => {
      stopInlineUrduSpeech();
    };
  }, []);

  useEffect(() => {
    setLoadingSurah(true);
    let endpoint = `/api/quran/surah/${selectedSurah}?reciterId=${reciterId}&qiraat=${encodeURIComponent(DEFAULT_QIRAAT)}`;
    if (browseMode === 'para') {
      endpoint = `/api/quran/juz/${selectedJuz}?reciterId=${reciterId}&qiraat=${encodeURIComponent(DEFAULT_QIRAAT)}`;
    } else if (browseMode === 'page') {
      endpoint = `/api/quran/page/${selectedPage}?reciterId=${reciterId}&qiraat=${encodeURIComponent(DEFAULT_QIRAAT)}`;
    }

    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (data.surah) setSurahMeta(data.surah);
        setAyahs(data.ayahs || []);
        const target =
          (data.ayahs || []).find(
            (a: QuranAyah) => a.surahNumber === selectedSurah && a.ayahNumber === selectedAyahNum
          ) || data.ayahs?.[0];
        if (target && target.words?.length > 0) {
          setSelectedWord(target.words[0]);
        }
        if (target?.mushafPage) {
          setPageJumpInput(String(target.mushafPage));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSurah(false));
  }, [browseMode, selectedSurah, selectedJuz, selectedPage, reciterId]);

  const activeAyah =
    ayahs.find((a) => a.surahNumber === selectedSurah && a.ayahNumber === selectedAyahNum) ||
    ayahs[0] ||
    null;

  useEffect(() => {
    if (!activeAyah) return;
    fetch('/api/progress/ayah', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        surahNumber: activeAyah.surahNumber,
        verseKey: activeAyah.verseKey,
        vocabDelta: activeAyah.words.length,
      }),
    }).catch(() => {});
  }, [activeAyah?.verseKey]);

  useEffect(() => {
    ayahsRef.current = ayahs;
    activeAyahRef.current = activeAyah;
  }, [ayahs, activeAyah]);

  useEffect(() => {
    continuousModeRef.current = continuousMode;
    loopAyahRef.current = loopAyah;
    playbackSpeedRef.current = playbackSpeed;
    isPlayingRef.current = isPlaying;
  }, [continuousMode, loopAyah, playbackSpeed, isPlaying]);

  useEffect(() => {
    return () => {
      voiceCmdWantedRef.current = false;
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {
          // ignore
        }
        speechRecRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopTilawatAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setHighlightedWordPos(null);
  };

  const startPlayingAyah = async (ayah: QuranAyah, enableContinuous?: boolean) => {
    if (typeof enableContinuous === 'boolean') {
      setContinuousMode(enableContinuous);
      continuousModeRef.current = enableContinuous;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(ayah.audioUrl);
    audio.playbackRate = playbackSpeedRef.current;
    audio.loop = loopAyahRef.current;
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      if (!audio.duration || ayah.words.length === 0) return;
      const ratio = audio.currentTime / audio.duration;
      const idx = Math.min(ayah.words.length - 1, Math.floor(ratio * ayah.words.length));
      setHighlightedWordPos(ayah.words[idx]?.position ?? null);
    };

    audio.onended = () => {
      if (loopAyahRef.current) return;
      if (continuousModeRef.current) {
        const list = ayahsRef.current;
        const idx = list.findIndex((a) => a.verseKey === ayah.verseKey);
        if (idx >= 0 && idx < list.length - 1) {
          const nextAyah = list[idx + 1];
          onChangeSurahAyah(nextAyah.surahNumber, nextAyah.ayahNumber);
          void startPlayingAyah(nextAyah, true);
          return;
        }
      }
      setIsPlaying(false);
      setHighlightedWordPos(null);
    };

    audio.onerror = () => {
      setIsPlaying(false);
      setHighlightedWordPos(null);
    };

    try {
      setIsPlaying(true);
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  };

  const togglePlayAyah = async (ayah: QuranAyah) => {
    if (isPlaying && activeAyah?.verseKey === ayah.verseKey && audioRef.current) {
      stopTilawatAudio();
      return;
    }
    onChangeSurahAyah(ayah.surahNumber, ayah.ayahNumber);
    await startPlayingAyah(ayah);
  };

  const playNextAyah = () => {
    const list = ayahsRef.current;
    const current = activeAyahRef.current;
    if (list.length === 0) return;
    const idx = current ? list.findIndex((a) => a.verseKey === current.verseKey) : -1;
    const nextAyah = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : list[0];
    onChangeSurahAyah(nextAyah.surahNumber, nextAyah.ayahNumber);
    void startPlayingAyah(nextAyah, true);
  };

  const processTilawatVoiceCommand = (rawTranscript: string) => {
    const text = rawTranscript.trim().toLowerCase();
    if (!text) return;

    const showCmdNote = (msg: string) => {
      setVoiceCmdStatus(msg);
      window.setTimeout(() => {
        setVoiceCmdStatus((prev) => (prev === msg ? null : prev));
      }, 3200);
    };

    const stopWords = ['بند', 'روک', 'روکو', 'بس', 'خاموش', 'چپ', 'band', 'rok', 'roko', 'bas', 'stop', 'pause', 'quiet'];
    if (stopWords.some((w) => text.includes(w))) {
      stopTilawatAudio();
      showCmdNote('آواز کا حکم: تلاوت بند کر دی گئی');
      return;
    }

    const nextWords = ['اگلی', 'آگے', 'next', 'agli', 'aage'];
    if (nextWords.some((w) => text.includes(w))) {
      playNextAyah();
      showCmdNote('آواز کا حکم: اگلی آیت کی تلاوت');
      return;
    }

    const repeatWords = ['دہرا', 'دوبارہ', 'repeat', 'loop', 'dobara', 'dohrao'];
    if (repeatWords.some((w) => text.includes(w))) {
      setLoopAyah((v) => !v);
      showCmdNote('آواز کا حکم: آیت دہرانے کا موڈ تبدیل');
      return;
    }

    const startWords = ['شروع', 'پڑھ', 'چلا', 'تلاوت', 'سنا', 'shuru', 'parh', 'chala', 'tilawat', 'sunao', 'start', 'play', 'resume'];
    if (startWords.some((w) => text.includes(w))) {
      const target = activeAyahRef.current || ayahsRef.current[0];
      if (target) {
        void startPlayingAyah(target, true);
        showCmdNote(`آواز کا حکم: آیت ${target.verseKey} کی تلاوت شروع`);
      }
      return;
    }

    showCmdNote(`سنا گیا: "${rawTranscript.slice(0, 32)}" — حکم: شروع / بند / اگلی / دہراؤ`);
  };

  const toggleVoiceCommandControl = async () => {
    const SpeechRecCtor =
      (window as unknown as {
        SpeechRecognition?: new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
          start: () => void;
          stop: () => void;
        };
        webkitSpeechRecognition?: new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
          start: () => void;
          stop: () => void;
        };
      }).SpeechRecognition ||
      (window as unknown as {
        webkitSpeechRecognition?: new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          onerror: (() => void) | null;
          onend: (() => void) | null;
          start: () => void;
          stop: () => void;
        };
      }).webkitSpeechRecognition;

    // Hands-free Web Speech API command mode when supported
    if (SpeechRecCtor) {
      if (voiceCmdActive) {
        voiceCmdWantedRef.current = false;
        setVoiceCmdActive(false);
        if (speechRecRef.current) {
          try {
            speechRecRef.current.stop();
          } catch {
            // ignore
          }
          speechRecRef.current = null;
        }
        setVoiceCmdStatus('وائس کمانڈ بند');
        return;
      }

      const startRecognizer = () => {
        if (!voiceCmdWantedRef.current) return;
        const rec = new SpeechRecCtor();
        rec.lang = 'ur-PK';
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (ev) => {
          const lastIdx = ev.results.length - 1;
          const phrase = ev.results[lastIdx]?.[0]?.transcript || '';
          if (phrase) processTilawatVoiceCommand(phrase);
        };
        rec.onerror = () => {
          if (!voiceCmdWantedRef.current) {
            setVoiceCmdActive(false);
          }
        };
        rec.onend = () => {
          if (voiceCmdWantedRef.current) {
            window.setTimeout(() => {
              if (voiceCmdWantedRef.current) startRecognizer();
            }, 350);
          } else {
            setVoiceCmdActive(false);
          }
        };
        speechRecRef.current = rec;
        try {
          rec.start();
        } catch {
          voiceCmdWantedRef.current = false;
          setVoiceCmdActive(false);
        }
      };

      voiceCmdWantedRef.current = true;
      setVoiceCmdActive(true);
      setVoiceCmdStatus('بولیں: "شروع کرو" یا "بند کرو"');
      startRecognizer();
      return;
    }

    // Fallback: record short audio clip & transcribe via /api/voice/transcribe
    if (voiceCmdRecording && voiceCmdRecorderRef.current) {
      setVoiceCmdRecording(false);
      try {
        const { blob } = await voiceCmdRecorderRef.current.stop();
        voiceCmdRecorderRef.current = null;
        const wav = await convertBlobToWav(blob);
        const fd = new FormData();
        fd.append('audio', wav.wavBlob, 'tilawat-cmd.wav');
        fd.append('mimeType', wav.mimeType);
        fd.append('saveAudio', 'false');
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.transcript) {
          processTilawatVoiceCommand(data.transcript);
        }
      } catch {
        setVoiceCmdStatus('حکم سمجھ نہ سکا، دوبارہ کوشش کریں');
      }
      return;
    }

    try {
      const rec = new MicrophoneRecorder();
      voiceCmdRecorderRef.current = rec;
      setVoiceCmdRecording(true);
      setVoiceCmdStatus('حکم ریکارڈ ہو رہا ہے… ("شروع کرو" / "بند کرو")');
      await rec.start({ autoStopOnSilence: false });
    } catch {
      setVoiceCmdRecording(false);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.loop = loopAyah;
    }
  }, [playbackSpeed, loopAyah]);

  const playSingleWordAudio = (word: QuranWord) => {
    if (word.audioUrl) {
      const a = new Audio(word.audioUrl);
      a.playbackRate = playbackSpeed;
      a.play().catch(() => playInlineUrduSpeech(word.arabic));
    } else {
      playInlineUrduSpeech(word.arabic);
    }
  };

  const inspectWordDeeply = async (ayah: QuranAyah, word: QuranWord) => {
    onChangeSurahAyah(ayah.surahNumber, ayah.ayahNumber);
    setSelectedWord(word);
    setInspectorTab('word');
    setLoadingWord(true);
    setWordAnalysis(null);
    const idx = ayah.words.findIndex((w) => w.position === word.position);
    try {
      const res = await fetch('/api/quran/ustaad/word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verseKey: ayah.verseKey,
          arabicAyah: ayah.arabicUthmani,
          arabicWord: word.arabic,
          wordPosition: word.position,
          previousWord: idx > 0 ? ayah.words[idx - 1].arabic : undefined,
          nextWord: idx < ayah.words.length - 1 ? ayah.words[idx + 1].arabic : undefined,
        }),
      });
      const data = await res.json();
      if (data.analysis) setWordAnalysis(data.analysis);
    } finally {
      setLoadingWord(false);
    }
  };

  const loadGrammarTree = async (ayah: QuranAyah) => {
    setLoadingGrammar(true);
    try {
      const res = await fetch('/api/quran/ustaad/grammar-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verseKey: ayah.verseKey,
          arabicAyah: ayah.arabicUthmani,
        }),
      });
      const data = await res.json();
      if (data.tree) {
        setGrammarTree(data.tree);
        setGrammarVerseKey(ayah.verseKey);
      }
    } finally {
      setLoadingGrammar(false);
    }
  };

  const loadTafseer = async (ayah: QuranAyah) => {
    setInspectorTab('tafseer');
    setLoadingTafseer(true);
    try {
      const res = await fetch('/api/quran/tafseer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verseKey: ayah.verseKey,
          arabicAyah: ayah.arabicUthmani,
          englishTranslation: ayah.urduTranslation || ayah.englishTranslation,
        }),
      });
      const data = await res.json();
      if (data.report) {
        setTafseerReport(data.report);
        setTafseerVerseKey(ayah.verseKey);
      }
    } finally {
      setLoadingTafseer(false);
    }
  };

  const handleAskUstaad = async (questionText: string) => {
    if (!activeAyah || !questionText.trim()) return;
    const cleanQ = questionText.trim();
    setInspectorTab('chat');
    setAskingUstaad(true);

    const userEntry: CompanionChatMessage = {
      id: `q-u-${Date.now()}`,
      role: 'user',
      content: cleanQ,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...chatMessages, userEntry];
    setChatMessages(nextHistory);
    setUstaadQuestion('');

    try {
      const res = await fetch('/api/quran/ustaad/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verseKey: activeAyah.verseKey,
          arabicAyah: activeAyah.arabicUthmani,
          selectedWord: selectedWord?.arabic,
          question: cleanQ,
          history: nextHistory.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const answerText = data.answer || '';
      if (answerText) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `q-a-${Date.now()}`,
            role: 'assistant',
            content: answerText,
            citationNote: `سورہ ${activeAyah.surahNumber} · آیت ${activeAyah.verseKey}${
              selectedWord ? ` · لفظ ${selectedWord.arabic}` : ''
            }`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setAskingUstaad(false);
    }
  };

  const handleQuranSEOSearch = async (queryOverride?: string) => {
    const q = (queryOverride ?? quranSearchQuery).trim();
    if (!q) return;
    setSearchingQuran(true);
    try {
      const res = await fetch('/api/quran/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (res.ok) {
        setSearchResult(data);
      }
    } finally {
      setSearchingQuran(false);
    }
  };

  const toggleSearchMic = async () => {
    if (searchMicRecording && searchRecorderRef.current) {
      setSearchMicRecording(false);
      try {
        const { blob } = await searchRecorderRef.current.stop();
        searchRecorderRef.current = null;
        const wav = await convertBlobToWav(blob);
        const fd = new FormData();
        fd.append('audio', wav.wavBlob, 'quran-search.wav');
        fd.append('mimeType', wav.mimeType);
        fd.append('saveAudio', 'false');
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.transcript) {
          setQuranSearchQuery(data.transcript);
          void handleQuranSEOSearch(data.transcript);
        }
      } catch {
        // ignore
      }
      return;
    }

    try {
      const rec = new MicrophoneRecorder();
      searchRecorderRef.current = rec;
      setSearchMicRecording(true);
      await rec.start({ autoStopOnSilence: false });
    } catch {
      setSearchMicRecording(false);
    }
  };

  const toggleChatMic = async () => {
    if (micRecording && chatRecorderRef.current) {
      setMicRecording(false);
      setMicTranscribing(true);
      try {
        const { blob } = await chatRecorderRef.current.stop();
        chatRecorderRef.current = null;
        const wav = await convertBlobToWav(blob);
        const fd = new FormData();
        fd.append('audio', wav.wavBlob, 'quran-question.wav');
        fd.append('mimeType', wav.mimeType);
        fd.append('saveAudio', 'false');
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.transcript) {
          setUstaadQuestion(data.transcript);
          setInspectorTab('chat');
        }
      } finally {
        setMicTranscribing(false);
      }
      return;
    }

    try {
      const rec = new MicrophoneRecorder();
      chatRecorderRef.current = rec;
      setMicRecording(true);
      await rec.start({ autoStopOnSilence: false });
    } catch {
      setMicRecording(false);
    }
  };

  const handleBookmarkAyah = async (ayah: QuranAyah) => {
    await fetch('/api/progress/bookmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: `سورہ ${ayah.surahNumber} · آیت ${ayah.verseKey}`,
        targetType: 'ayah',
        targetRef: ayah.verseKey,
        note: (ayah.urduTranslation || ayah.englishTranslation).slice(0, 120),
      }),
    });
    setBookmarkMessage(`آیت ${ayah.verseKey} محفوظ ہو گئی`);
    window.setTimeout(() => setBookmarkMessage(null), 2200);
  };

  const readerThemeClass =
    readingTheme === 'light'
      ? 'reading-light'
      : readingTheme === 'parchment'
        ? 'reading-parchment'
        : 'reading-navy';

  const readerMutedText =
    readingTheme === 'navy' ? 'text-slate-300' : 'text-stone-600';

  const activePageHeading =
    browseMode === 'page'
      ? `صفحہ ${selectedPage} / 604 · پارہ ${ayahs[0]?.juzNumber || selectedJuz}`
      : browseMode === 'para'
        ? `${juzs.find((j) => j.number === selectedJuz)?.nameArabic || ''} · پارہ ${selectedJuz}`
        : `سورہ ${surahMeta?.nameArabic || ''} (${surahMeta?.nameEnglish || selectedSurah})`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-[1440px] px-5 py-6 space-y-5"
    >
      {/* Top Studio Header with Islamic Geometric Motion */}
      <div className="modern-panel relative overflow-hidden flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-gold)]/45 bg-[var(--color-navy)] shadow-lg">
            <motion.svg
              viewBox="0 0 64 64"
              className="h-9 w-9 text-[var(--color-gold-soft)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
              aria-hidden="true"
            >
              <rect
                x="14"
                y="14"
                width="36"
                height="36"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <rect
                x="14"
                y="14"
                width="36"
                height="36"
                rx="2"
                transform="rotate(45 32 32)"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle cx="32" cy="32" r="7" fill="none" stroke="var(--color-emerald)" strokeWidth="1.6" />
            </motion.svg>
          </div>
          <div dir="rtl" lang="ur" className="text-right">
            <h1 className="font-urdu-heavy text-2xl sm:text-3xl text-[var(--color-ink)]">
              قرآن اسٹوڈیو (۳۰ پارے · ۱۱۴ سورتیں · ۶۰۴ صفحات)
            </h1>
            <p className="mt-1 text-sm font-urdu text-[var(--color-ink-muted)]">
              ہر آیت کا مستند اردو ترجمہ، لفظ بہ لفظ معنی، گرامر، تفسیر اور آواز سے تلاوت کنٹرول۔
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-0.5">
            {(
              [
                { id: 'mushaf', label: 'مکمل صفحہ' },
                { id: 'ayah', label: 'ایک آیت' },
              ] as const
            ).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setReaderLayout(l.id)}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  readerLayout === l.id
                    ? 'bg-[var(--color-emerald-deep)] text-white'
                    : 'text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <select
            aria-label="قاری منتخب کریں"
            value={reciterId}
            onChange={(e) => setReciterId(Number(e.target.value))}
            className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-2.5 py-1.5 text-[var(--color-ink)]"
          >
            {reciters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-0.5">
            {(
              [
                { id: 'navy', label: 'ڈارک' },
                { id: 'light', label: 'لائٹ' },
                { id: 'parchment', label: 'کاغذ' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setReadingTheme(t.id)}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  readingTheme === t.id
                    ? 'bg-[var(--color-emerald-deep)] text-white'
                    : 'text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-[var(--color-ink-subtle)]">
            <span>حجم</span>
            <input
              type="range"
              min={24}
              max={46}
              value={arabicFontPx}
              onChange={(e) => setArabicFontPx(Number(e.target.value))}
              className="w-16 accent-[var(--color-emerald)]"
            />
          </label>
        </div>
      </div>

      {/* SEO Quran Search Bar */}
      <div className="modern-panel rounded-2xl p-4 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleQuranSEOSearch();
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleSearchMic}
            aria-label={searchMicRecording ? 'ریکارڈنگ روکیں' : 'بول کر قرآن میں تلاش کریں'}
            className={`rounded-lg p-2.5 transition-colors ${
              searchMicRecording
                ? 'bg-[#B91C1C] text-white'
                : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-emerald)]'
            }`}
          >
            {searchMicRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <input
            type="text"
            dir="auto"
            value={quranSearchQuery}
            onChange={(e) => setQuranSearchQuery(e.target.value)}
            placeholder="قرآن میں کسی بھی موضوع یا آیت کی تلاش کریں (مثلاً: پریشانی دور کرنے کی آیت، والدین کے حقوق، سورہ کہف، 2:255)…"
            className="flex-1 min-w-[240px] rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3.5 py-2 text-xs text-[var(--color-ink)] focus:border-[var(--color-emerald)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={searchingQuran || !quranSearchQuery.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-emerald-deep)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-emerald)] hover:text-slate-950 disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5" />
            {searchingQuran ? 'تلاش جاری ہے…' : 'قرآن میں تلاش'}
          </button>
        </form>

        {searchResult && (
          <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--color-emerald)]">
                قرآنی جواب اور آیات
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => playInlineUrduSpeech(searchResult.answer)}
                  className="inline-flex items-center gap-1 text-[var(--color-emerald)] hover:underline"
                >
                  <Volume2 className="h-3.5 w-3.5" /> سنیں (اردو)
                </button>
                <button
                  type="button"
                  onClick={() => setSearchResult(null)}
                  className="text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]"
                >
                  بند کریں
                </button>
              </div>
            </div>
            <p dir="rtl" lang="ur" className="whitespace-pre-wrap leading-loose text-[var(--color-ink)] text-right text-sm">
              {searchResult.answer}
            </p>
            {searchResult.matchedRefs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {searchResult.matchedRefs.map((ref) => (
                  <button
                    key={ref.verseKey}
                    type="button"
                    onClick={() => {
                      setBrowseMode('surah');
                      onChangeSurahAyah(ref.surahNumber, ref.ayahNumber);
                    }}
                    className="rounded border border-[var(--color-emerald)]/40 bg-[var(--color-emerald-deep)]/15 px-2.5 py-1 text-[11px] font-medium text-[var(--color-emerald)] hover:bg-[var(--color-emerald-deep)] hover:text-white"
                  >
                    آیت {ref.verseKey} کھولیں
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3-Pane Desktop Quran Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Para / Surah / Page Navigator */}
        <aside className="lg:col-span-3 modern-panel rounded-2xl p-4 space-y-3.5">
          <div className="grid grid-cols-3 gap-1 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-1 text-xs">
            {(
              [
                { id: 'surah', label: '۱۱۴ سورتیں' },
                { id: 'para', label: '۳۰ پارے' },
                { id: 'page', label: 'صفحات ۶۰۴' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setBrowseMode(m.id)}
                className={`rounded py-1.5 font-medium transition-colors ${
                  browseMode === m.id
                    ? 'bg-[var(--color-emerald-deep)] text-white'
                    : 'text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {browseMode === 'surah' && (
            <>
              <input
                type="text"
                aria-label="سورت تلاش کریں"
                value={surahFilter}
                onChange={(e) => setSurahFilter(e.target.value)}
                placeholder="سورت کا نام یا نمبر لکھیں (مثلاً Yasin, 36)…"
                className="w-full rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1.5 text-xs text-[var(--color-ink)]"
              />
              <div className="max-h-[250px] overflow-y-auto space-y-1 pr-1">
                {surahs
                  .filter((s) => {
                    if (!surahFilter.trim()) return true;
                    const q = surahFilter.toLowerCase();
                    return (
                      s.nameEnglish.toLowerCase().includes(q) ||
                      s.nameArabic.includes(surahFilter) ||
                      String(s.number) === q.trim()
                    );
                  })
                  .map((s) => (
                    <button
                      key={s.number}
                      type="button"
                      onClick={() => onChangeSurahAyah(s.number, 1)}
                      className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${
                        s.number === selectedSurah
                          ? 'bg-[var(--color-emerald-deep)]/20 border border-[var(--color-emerald)]/40 text-[var(--color-ink)]'
                          : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-navy-elevated)]'
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-mono tabular-nums text-[var(--color-ink-subtle)] mr-1.5">
                          {s.number}.
                        </span>
                        {s.nameEnglish}
                      </span>
                      <span className="font-arabic text-base text-[var(--color-gold-soft)] shrink-0 ml-2">
                        {s.nameArabic}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}

          {browseMode === 'para' && (
            <div className="max-h-[290px] overflow-y-auto space-y-1 pr-1">
              {juzs.map((j) => (
                <button
                  key={j.number}
                  type="button"
                  onClick={() => setSelectedJuz(j.number)}
                  className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${
                    j.number === selectedJuz
                      ? 'bg-[var(--color-emerald-deep)]/20 border border-[var(--color-emerald)]/40 text-[var(--color-ink)]'
                      : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-navy-elevated)]'
                  }`}
                >
                  <div>
                    <div className="font-medium text-[var(--color-ink)]">پارہ {j.number}</div>
                    <div className="text-[10px] text-[var(--color-ink-subtle)]">
                      {j.startVerseKey} – {j.endVerseKey} · صفحات {j.startPage}–{j.endPage}
                    </div>
                  </div>
                  <span className="font-arabic text-base text-[var(--color-gold-soft)] shrink-0 ml-2">
                    {j.nameArabic}
                  </span>
                </button>
              ))}
            </div>
          )}

          {browseMode === 'page' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={selectedPage <= 1}
                  onClick={() => {
                    const next = Math.max(1, selectedPage - 1);
                    setSelectedPage(next);
                    setPageJumpInput(String(next));
                  }}
                  className="inline-flex items-center gap-1 rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> پچھلا
                </button>
                <span className="font-mono tabular-nums font-semibold text-[var(--color-gold-soft)]">
                  صفحہ {selectedPage} / 604
                </span>
                <button
                  type="button"
                  disabled={selectedPage >= 604}
                  onClick={() => {
                    const next = Math.min(604, selectedPage + 1);
                    setSelectedPage(next);
                    setPageJumpInput(String(next));
                  }}
                  className="inline-flex items-center gap-1 rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1.5 disabled:opacity-40"
                >
                  اگلا <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const p = Math.max(1, Math.min(604, Number(pageJumpInput) || 1));
                  setSelectedPage(p);
                  setPageJumpInput(String(p));
                }}
                className="flex gap-1.5"
              >
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={pageJumpInput}
                  onChange={(e) => setPageJumpInput(e.target.value)}
                  className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1.5 font-mono text-[var(--color-ink)]"
                />
                <button
                  type="submit"
                  className="rounded bg-[var(--color-emerald-deep)] px-3 py-1.5 text-white font-medium"
                >
                  کھولیں
                </button>
              </form>
            </div>
          )}

          {ayahs.length > 0 && (
            <div className="border-t border-[var(--color-border-hairline)] pt-3">
              <div className="text-xs font-medium text-[var(--color-ink-subtle)] mb-2 text-right" dir="rtl">
                آیت منتخب کریں ({ayahs.length})
              </div>
              <div className="grid grid-cols-5 gap-1.5 max-h-[150px] overflow-y-auto">
                {ayahs.map((a) => (
                  <button
                    key={a.verseKey}
                    type="button"
                    onClick={() => onChangeSurahAyah(a.surahNumber, a.ayahNumber)}
                    className={`rounded py-1.5 text-[11px] font-mono tabular-nums ${
                      activeAyah?.verseKey === a.verseKey
                        ? 'bg-[var(--color-emerald-deep)] text-white'
                        : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    {browseMode === 'surah' ? a.ayahNumber : a.verseKey}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clean Urdu-First Display Options */}
          <div className="border-t border-[var(--color-border-hairline)] pt-3 space-y-1.5 text-xs text-[var(--color-ink-muted)]" dir="rtl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showUrdu} onChange={(e) => setShowUrdu(e.target.checked)} className="accent-[var(--color-emerald)]" />
              <span>اردو ترجمہ دکھائیں</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showWordGloss} onChange={(e) => setShowWordGloss(e.target.checked)} className="accent-[var(--color-emerald)]" />
              <span>لفظ بہ لفظ اردو معنی</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showEnglish} onChange={(e) => setShowEnglish(e.target.checked)} className="accent-[var(--color-emerald)]" />
              <span>انگریزی ترجمہ (اختیاری)</span>
            </label>
          </div>
        </aside>

        {/* CENTER: Mushaf Quran Reader */}
        <div className="lg:col-span-5 space-y-4">
          {loadingSurah || !activeAyah ? (
            <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-8 text-sm text-[var(--color-ink-muted)] text-right" dir="rtl">
              قرآن پاک کا متن اور اردو ترجمہ لوڈ ہو رہا ہے…
            </div>
          ) : (
            <div className={`rounded-xl border p-5 sm:p-6 transition-colors space-y-5 ${readerThemeClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 pb-3 text-xs">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[var(--color-gold-soft)]" />
                  <span className="font-semibold" dir="rtl">
                    {activePageHeading}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBookmarkAyah(activeAyah)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-current/10"
                  >
                    <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                    محفوظ کریں
                  </button>
                  <button
                    type="button"
                    onClick={() => onPracticeTilawat(activeAyah)}
                    className="inline-flex items-center gap-1 rounded bg-[var(--color-emerald-deep)] px-2.5 py-1 text-white font-medium hover:bg-[var(--color-emerald)] hover:text-slate-950"
                  >
                    <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                    تلاوت ٹیسٹ کریں
                  </button>
                </div>
              </div>

              {bookmarkMessage && (
                <div className="text-xs text-[var(--color-emerald)] font-medium text-right" dir="rtl">
                  {bookmarkMessage}
                </div>
              )}

              {/* VIEW 1: Full Mushaf Page */}
              {readerLayout === 'mushaf' && (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {activeAyah.surahNumber !== 1 && activeAyah.surahNumber !== 9 && ayahs[0]?.ayahNumber === 1 && (
                    <div
                      dir="rtl"
                      lang="ar"
                      className="rounded-lg border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 py-2.5 text-center font-arabic text-2xl"
                    >
                      بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </div>
                  )}

                  {ayahs.map((ayah) => {
                    const isActiveRow = activeAyah.verseKey === ayah.verseKey;
                    const sMeta = surahs.find((s) => s.number === ayah.surahNumber);
                    return (
                      <div
                        key={ayah.verseKey}
                        onClick={() => onChangeSurahAyah(ayah.surahNumber, ayah.ayahNumber)}
                        className={`rounded-lg border p-4 transition-colors cursor-pointer ${
                          isActiveRow
                            ? 'border-[var(--color-emerald)] bg-[var(--color-emerald)]/10'
                            : 'border-current/10 hover:border-current/25'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] opacity-75 mb-2">
                          <span className="font-mono tabular-nums">
                            {sMeta?.nameArabic || `سورہ ${ayah.surahNumber}`} ({ayah.verseKey})
                            {ayah.juzNumber ? ` · پارہ ${ayah.juzNumber}` : ''}
                            {ayah.mushafPage ? ` · صفحہ ${ayah.mushafPage}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePlayAyah(ayah);
                            }}
                            className="inline-flex items-center gap-1 text-[var(--color-emerald)] font-medium"
                          >
                            {isPlaying && isActiveRow ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            {isPlaying && isActiveRow ? 'روکیں' : 'سنیں'}
                          </button>
                        </div>

                        <div dir="rtl" lang="ar" className="flex flex-wrap justify-start gap-x-2 gap-y-3 leading-loose">
                          {ayah.words.map((w) => {
                            const isWordSel = isActiveRow && selectedWord?.position === w.position;
                            const isSpoken = isActiveRow && highlightedWordPos === w.position;
                            return (
                              <button
                                key={w.position}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  inspectWordDeeply(ayah, w);
                                }}
                                className={`inline-flex flex-col items-center rounded px-1.5 py-0.5 transition-colors ${
                                  isSpoken
                                    ? 'bg-[var(--color-gold)]/25 text-[var(--color-gold-soft)]'
                                    : isWordSel
                                      ? 'bg-[var(--color-emerald)]/20 ring-1 ring-[var(--color-emerald)]'
                                      : 'hover:bg-current/10'
                                }`}
                              >
                                <span className="font-arabic" style={{ fontSize: `${arabicFontPx}px` }}>
                                  {w.arabic}
                                </span>
                                {showWordGloss && (w.urduMeaning || w.englishMeaning) && (
                                  <span dir="rtl" className={`text-[11px] font-sans ${readerMutedText}`}>
                                    {w.urduMeaning || w.englishMeaning}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          <span className="font-arabic self-center text-2xl text-[var(--color-gold-soft)] px-1">
                            ﴿{toArabicIndicDigits(ayah.ayahNumber)}﴾
                          </span>
                        </div>

                        {showUrdu && ayah.urduTranslation && (
                          <p dir="rtl" lang="ur" className="mt-3 text-right text-base leading-loose border-t border-current/10 pt-2">
                            {ayah.urduTranslation}
                          </p>
                        )}
                        {showEnglish && ayah.englishTranslation && (
                          <p className={`mt-1.5 text-xs leading-relaxed ${readerMutedText}`}>
                            {ayah.englishTranslation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* VIEW 2: Focused Single Ayah */}
              {readerLayout === 'ayah' && (
                <>
                  <div
                    dir="rtl"
                    lang="ar"
                    className="mt-4 flex flex-wrap justify-start gap-x-3 gap-y-5 leading-loose"
                  >
                    {activeAyah.words.map((w) => {
                      const isSelected = selectedWord?.position === w.position;
                      const isSpoken = highlightedWordPos === w.position;
                      return (
                        <motion.button
                          key={w.position}
                          type="button"
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          animate={isSpoken ? { scale: 1.05 } : { scale: 1 }}
                          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                          onClick={() => inspectWordDeeply(activeAyah, w)}
                          className={`group flex flex-col items-center rounded-lg px-2.5 py-1.5 transition-colors border ${
                            isSpoken
                              ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/20'
                              : isSelected
                                ? 'border-[var(--color-emerald)] bg-[var(--color-emerald)]/15'
                                : 'border-transparent hover:border-current/20 hover:bg-current/5'
                          }`}
                        >
                          <span className="font-arabic" style={{ fontSize: `${arabicFontPx}px` }}>
                            {w.arabic}
                          </span>
                          {showWordGloss && (
                            <span dir="rtl" className={`mt-1 text-[11px] font-sans ${readerMutedText}`}>
                              {w.urduMeaning || w.englishMeaning}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="mt-5 space-y-3 border-t border-current/15 pt-4">
                    {showUrdu && activeAyah.urduTranslation && (
                      <div>
                        <div className={`text-[11px] font-medium text-right ${readerMutedText}`} dir="rtl">
                          اردو ترجمہ ({activeAyah.translationSources.urdu})
                        </div>
                        <p dir="rtl" lang="ur" className="mt-0.5 text-base leading-loose text-right">
                          {activeAyah.urduTranslation}
                        </p>
                      </div>
                    )}
                    {showEnglish && activeAyah.englishTranslation && (
                      <div>
                        <div className={`text-[11px] font-medium ${readerMutedText}`}>
                          English ({activeAyah.translationSources.english})
                        </div>
                        <p className="mt-0.5 text-sm leading-relaxed">{activeAyah.englishTranslation}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Audio Playback & Voice Command Tilawat Bar */}
              <div className="space-y-2.5 border-t border-current/15 pt-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => togglePlayAyah(activeAyah)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-emerald-deep)] px-3.5 py-2 font-medium text-white"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isPlaying ? 'تلاوت روکیں' : `آیت ${activeAyah.verseKey} سنیں`}
                    </button>

                    <button
                      type="button"
                      onClick={playNextAyah}
                      className="inline-flex items-center gap-1 rounded-lg border border-current/20 px-2.5 py-2 hover:bg-current/10"
                    >
                      <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                      اگلی آیت
                    </button>

                    <button
                      type="button"
                      onClick={() => setContinuousMode((v) => !v)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 ${
                        continuousMode
                          ? 'border-[var(--color-emerald)] text-[var(--color-emerald)]'
                          : 'border-current/20'
                      }`}
                    >
                      مسلسل تلاوت: {continuousMode ? 'آن' : 'آف'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setLoopAyah((v) => !v)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 ${
                        loopAyah ? 'border-[var(--color-emerald)] text-[var(--color-emerald)]' : 'border-current/20'
                      }`}
                    >
                      <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                      دہرائیں
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleVoiceCommandControl()}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-medium transition-colors ${
                        voiceCmdActive || voiceCmdRecording
                          ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                          : 'border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10 text-[var(--color-gold-soft)] hover:bg-[var(--color-gold)]/20'
                      }`}
                    >
                      {voiceCmdActive || voiceCmdRecording ? (
                        <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {voiceCmdRecording
                        ? 'حکم روکیں'
                        : voiceCmdActive
                          ? 'وائس کنٹرول آن (بند کریں)'
                          : 'آواز سے تلاوت کنٹرول'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span>رفتار:</span>
                    {[0.75, 0.85, 1.0].map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => setPlaybackSpeed(sp)}
                        className={`rounded px-2 py-1 font-mono tabular-nums ${
                          playbackSpeed === sp
                            ? 'bg-[var(--color-emerald-deep)] text-white'
                            : 'border border-current/20'
                        }`}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                </div>

                {voiceCmdStatus && (
                  <div
                    dir="rtl"
                    lang="ur"
                    className="rounded-md border border-[var(--color-gold)]/35 bg-[var(--color-gold)]/10 px-3 py-1.5 text-right text-xs text-[var(--color-gold-soft)]"
                  >
                    {voiceCmdStatus}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Simplified 3-Tab Urdu Ustaad Panel */}
        <div className="lg:col-span-4 modern-panel rounded-2xl p-4 space-y-4">
          <div className="grid grid-cols-3 gap-1 border-b border-[var(--color-border-hairline)] pb-3">
            {(
              [
                { id: 'word', label: 'لفظ اور گرامر' },
                { id: 'tafseer', label: 'تفسیر' },
                { id: 'chat', label: 'استاد سے پوچھیں' },
              ] as const
            ).map((t) => {
              const active = inspectorTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (t.id === 'tafseer' && activeAyah) {
                      if (tafseerVerseKey !== activeAyah.verseKey) {
                        void loadTafseer(activeAyah);
                      } else {
                        setInspectorTab('tafseer');
                      }
                    } else {
                      setInspectorTab(t.id);
                    }
                  }}
                  className={`relative rounded-md px-2 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-[var(--color-ink-subtle)] hover:bg-[var(--color-navy-elevated)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="quran-inspector-tab"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-md bg-[var(--color-emerald-deep)]"
                    />
                  )}
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={inspectorTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* TAB 1: Word & Grammar */}
              {inspectorTab === 'word' && (
                <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1">
                  {selectedWord ? (
                    <>
                      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3.5">
                        <div className="text-right" dir="rtl">
                          <div className="text-xs text-[var(--color-ink-subtle)]">
                            لفظ نمبر {selectedWord.position}
                          </div>
                          <div className="mt-1 text-base font-medium text-[var(--color-ink)]">
                            {selectedWord.urduMeaning || selectedWord.englishMeaning}
                          </div>
                          {selectedWord.tajweedTags && selectedWord.tajweedTags.length > 0 && (
                            <div className="mt-1 text-[11px] text-[var(--color-gold-soft)]">
                              تجوید: {selectedWord.tajweedTags.join(' · ')}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="font-arabic text-3xl text-[var(--color-ink)]">
                            {selectedWord.arabic}
                          </span>
                          <button
                            type="button"
                            onClick={() => playSingleWordAudio(selectedWord)}
                            className="inline-flex items-center gap-1 text-xs text-[var(--color-emerald)] hover:underline"
                          >
                            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                            لفظ سنیں
                          </button>
                        </div>
                      </div>

                      {!wordAnalysis && !loadingWord && activeAyah && (
                        <button
                          type="button"
                          onClick={() => inspectWordDeeply(activeAyah, selectedWord)}
                          className="w-full rounded-lg bg-[var(--color-emerald-deep)] px-4 py-2 text-xs font-medium text-white"
                        >
                          اس لفظ کا مادہ، صرف اور نحو اردو میں دیکھیں
                        </button>
                      )}

                      {loadingWord && (
                        <div className="text-xs text-[var(--color-ink-muted)] py-3 text-right" dir="rtl">
                          اس لفظ کا مادہ، صیغہ اور گرامر اردو میں تیار کیا جا رہا ہے…
                        </div>
                      )}

                      {wordAnalysis && (
                        <dl dir="rtl" lang="ur" className="space-y-2.5 text-xs text-right">
                          <div className="rounded-md bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)]">
                            <div className="flex items-center justify-between mb-1">
                              <dt className="font-semibold text-[var(--color-gold-soft)]">
                                گرامر اور اہمیت (اردو)
                              </dt>
                              <button
                                type="button"
                                onClick={() => playInlineUrduSpeech(wordAnalysis.grammarImportanceInRomanUrdu)}
                                className="inline-flex items-center gap-1 text-[11px] text-[var(--color-emerald)] hover:underline"
                              >
                                <Volume2 className="h-3 w-3" /> سنیں
                              </button>
                            </div>
                            <dd className="text-[var(--color-ink)] leading-loose">
                              {wordAnalysis.grammarImportanceInRomanUrdu}
                            </dd>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded bg-[var(--color-navy)] p-2.5 border border-[var(--color-border-hairline)]">
                              <dt className="text-[var(--color-ink-subtle)]">مادہ (جذر)</dt>
                              <dd className="mt-0.5 font-arabic text-base text-[var(--color-ink)]">
                                {wordAnalysis.rootLetters}
                              </dd>
                              <dd className="text-[11px] text-[var(--color-ink-muted)]">
                                {wordAnalysis.originalRootMeaning}
                              </dd>
                            </div>
                            <div className="rounded bg-[var(--color-navy)] p-2.5 border border-[var(--color-border-hairline)]">
                              <dt className="text-[var(--color-ink-subtle)]">قسم اور وزن</dt>
                              <dd className="mt-0.5 font-medium text-[var(--color-ink)]">
                                {wordAnalysis.grammaticalCategory}
                              </dd>
                              <dd className="text-[11px] text-[var(--color-ink-muted)]">
                                {wordAnalysis.sarfPattern}
                              </dd>
                            </div>
                          </div>

                          <div className="rounded bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)] space-y-2 leading-loose">
                            <div>
                              <span className="font-semibold text-[var(--color-ink-subtle)]">اردو معنی: </span>
                              <span className="text-[var(--color-ink)]">{wordAnalysis.urduMeaning}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-[var(--color-ink-subtle)]">صرفی تفصیل: </span>
                              <span className="text-[var(--color-ink)]">{wordAnalysis.morphologyDetails}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-[var(--color-ink-subtle)]">نحوی کردار: </span>
                              <span className="text-[var(--color-ink)]">{wordAnalysis.nahwIrabRole}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-[var(--color-ink-subtle)]">یہی لفظ کیوں آیا؟ </span>
                              <span className="text-[var(--color-ink)]">{wordAnalysis.whyThisFormUsed}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-[var(--color-ink-subtle)]">آگے پیچھے الفاظ سے ربط: </span>
                              <span className="text-[var(--color-ink)]">{wordAnalysis.connectionToAdjacentWords}</span>
                            </div>
                          </div>
                        </dl>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-[var(--color-ink-muted)] text-right" dir="rtl">
                      کسی بھی عربی لفظ پر کلک کریں تو اس کا اردو معنی اور گرامر سامنے آ جائے گا۔
                    </p>
                  )}

                  {/* Inline Full-Ayah Grammar Button */}
                  {activeAyah && (
                    <div className="border-t border-[var(--color-border-hairline)] pt-3 space-y-2.5 text-xs">
                      <button
                        type="button"
                        onClick={() => void loadGrammarTree(activeAyah)}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 font-medium text-[var(--color-emerald)] hover:border-[var(--color-emerald)]"
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        {loadingGrammar
                          ? 'پوری آیت کی گرامر تیار ہو رہی ہے…'
                          : `پوری آیت (${activeAyah.verseKey}) کی گرامر دیکھیں`}
                      </button>

                      {grammarTree && grammarVerseKey === activeAyah.verseKey && (
                        <div dir="rtl" lang="ur" className="space-y-2 text-right">
                          <div className="rounded bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)]">
                            <div className="text-[var(--color-gold-soft)] font-semibold">
                              جملے کی ساخت: {grammarTree.sentenceType}
                            </div>
                            <p className="mt-1 text-[var(--color-ink-muted)] leading-loose">
                              {grammarTree.ayahConnectionPrevNext}
                            </p>
                          </div>
                          {grammarTree.structureNodes.map((node, i) => (
                            <div
                              key={i}
                              className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-arabic text-xl text-[var(--color-ink)]">{node.word}</span>
                                <span className="text-[11px] text-[var(--color-emerald)]">
                                  {node.category} · {node.irabCase}
                                </span>
                              </div>
                              <div className="mt-1 font-medium text-[var(--color-gold-soft)]">{node.role}</div>
                              <p className="mt-0.5 text-[var(--color-ink-muted)] leading-loose">
                                {node.explanationRomanUrdu}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Urdu Tafseer */}
              {inspectorTab === 'tafseer' && (
                <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1 text-xs">
                  {activeAyah && (
                    <button
                      type="button"
                      onClick={() => void loadTafseer(activeAyah)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 font-medium text-[var(--color-emerald)]"
                    >
                      <BookOpenCheck className="h-3.5 w-3.5" />
                      {loadingTafseer
                        ? 'مستند تفاسیر سے تحقیق جاری ہے…'
                        : `تفسیر اور شانِ نزول (${activeAyah.verseKey})`}
                    </button>
                  )}

                  {tafseerReport && (
                    <div dir="rtl" lang="ur" className="space-y-3 text-right">
                      <div className="rounded bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[var(--color-gold-soft)]">تفصیلی تفسیر اور شانِ نزول</span>
                          <button
                            type="button"
                            onClick={() => playInlineUrduSpeech(tafseerReport.detailedExplanation)}
                            className="inline-flex items-center gap-1 text-[11px] text-[var(--color-emerald)] hover:underline"
                          >
                            <Volume2 className="h-3 w-3" /> سنیں (اردو)
                          </button>
                        </div>
                        <p className="mt-2 text-[var(--color-ink)] leading-loose">{tafseerReport.detailedExplanation}</p>
                        <p className="mt-2 text-[var(--color-ink-muted)] leading-loose">
                          <strong>شانِ نزول:</strong> {tafseerReport.asbabAlNuzul}
                        </p>
                      </div>

                      <div className="space-y-2">
                        {tafseerReport.classicalMufassireen.map((m, idx) => (
                          <div key={idx} className="rounded bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)]">
                            <div className="font-semibold text-[var(--color-emerald)]">
                              {m.scholar} — {m.book}
                            </div>
                            <div className="text-[11px] text-[var(--color-ink-subtle)]">
                              {m.tradition} · {m.edition} · {m.pageOrVolume}
                            </div>
                            <p className="mt-1 text-[var(--color-ink-muted)] leading-loose">{m.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Ask Urdu Ustaad Chat */}
              {inspectorTab === 'chat' && activeAyah && (
                <div className="flex flex-col h-[580px] text-xs">
                  <div className="mb-2 flex items-center justify-between text-[var(--color-ink-subtle)]">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-gold-soft)]">
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      تفسیر، واقعہ اور گرامر چیٹ ({activeAyah.verseKey})
                    </span>
                    {chatMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setChatMessages([])}
                        className="hover:text-[var(--color-ink)]"
                      >
                        صاف کریں
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {chatMessages.length === 0 ? (
                      <div dir="rtl" lang="ur" className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3.5 space-y-2.5 text-right">
                        <p className="text-[var(--color-ink-muted)] leading-loose">
                          اس آیت کی تفسیر، شانِ نزول، کسی لفظ کی گرامر یا کوئی بھی الجھن اردو میں پوچھیں:
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {[
                            'اس آیت کے پیچھے کیا واقعہ یا شانِ نزول ہے؟ تفصیل سے بتائیں۔',
                            selectedWord
                              ? `لفظ ${selectedWord.arabic} گرامر میں کیا ہے اور یہاں کس مقصد کے لیے آیا ہے؟`
                              : 'اس آیت کے ایک ایک لفظ کا گرامر میں کردار اور مقصد بتائیں۔',
                            'اس آیت سے روزمرہ زندگی کے لیے کیا رہنمائی ملتی ہے؟',
                          ].map((promptStr) => (
                            <button
                              key={promptStr}
                              type="button"
                              onClick={() => void handleAskUstaad(promptStr)}
                              className="rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-2.5 py-2 text-right text-[11px] text-[var(--color-ink-muted)] hover:border-[var(--color-emerald)]/50 hover:text-[var(--color-ink)]"
                            >
                              {promptStr}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      chatMessages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.16 }}
                          className={`rounded-lg p-3 border ${
                            msg.role === 'user'
                              ? 'ml-6 border-[var(--color-emerald)]/30 bg-[var(--color-emerald-deep)]/15 text-[var(--color-ink)]'
                              : 'mr-2 border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-ink)]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-[11px] text-[var(--color-emerald)]">
                              {msg.role === 'user' ? 'آپ' : 'قرآن استاد'}
                            </span>
                            {msg.role === 'assistant' && (
                              <button
                                type="button"
                                onClick={() => playInlineUrduSpeech(msg.content)}
                                className="inline-flex items-center gap-1 text-[11px] text-[var(--color-emerald)] hover:underline"
                              >
                                <Volume2 className="h-3 w-3" /> سنیں (اردو)
                              </button>
                            )}
                          </div>
                          <p dir="rtl" lang="ur" className="whitespace-pre-wrap leading-loose text-right">
                            {msg.content}
                          </p>
                          {msg.citationNote && (
                            <div className="mt-1.5 text-[10px] text-[var(--color-ink-subtle)]">
                              {msg.citationNote}
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}

                    {askingUstaad && (
                      <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3 text-[var(--color-ink-subtle)] text-right" dir="rtl">
                        تفاسیر اور مستند کتب سے جواب تیار ہو رہا ہے…
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleAskUstaad(ustaadQuestion);
                    }}
                    className="mt-3 flex items-center gap-1.5 border-t border-[var(--color-border-hairline)] pt-2.5"
                  >
                    <button
                      type="button"
                      onClick={toggleChatMic}
                      aria-label={micRecording ? 'ریکارڈنگ روکیں' : 'بول کر سوال پوچھیں'}
                      className={`rounded-md p-2 transition-colors ${
                        micRecording
                          ? 'bg-[#B91C1C] text-white'
                          : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-emerald)] hover:bg-[var(--color-navy-elevated)]'
                      }`}
                    >
                      {micRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    </button>
                    <input
                      type="text"
                      dir="auto"
                      value={ustaadQuestion}
                      onChange={(e) => setUstaadQuestion(e.target.value)}
                      placeholder={micTranscribing ? 'آواز تحریر ہو رہی ہے…' : 'واقعہ، تفسیر یا گرامر پوچھیں…'}
                      className="flex-1 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-2 text-xs text-[var(--color-ink)]"
                    />
                    <button
                      type="submit"
                      disabled={askingUstaad || !ustaadQuestion.trim()}
                      className="rounded-md bg-[var(--color-emerald-deep)] px-3 py-2 text-white disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenInLiveVoice(
                        `میں ابھی سورہ ${activeAyah.surahNumber} کی آیت ${activeAyah.verseKey} (${activeAyah.arabicUthmani}) پڑھ رہا ہوں۔ مجھے اس کا مطلب، گرامر اور تفسیر آسان پاکستانی اردو میں سمجھائیں۔`
                      )
                    }
                    className="mt-2 w-full rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-emerald)] hover:border-[var(--color-emerald)]"
                  >
                    لائیو وائس کال میں استاد سے بات کریں
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  );
};
