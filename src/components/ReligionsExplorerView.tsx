import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Languages,
  MessageSquare,
  Mic,
  Pause,
  Play,
  Search,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MicrophoneRecorder, convertBlobToWav } from '../utils/audioUtils.ts';
import { playInlineUrduSpeech, stopInlineUrduSpeech } from '../utils/ttsPlayer.ts';
import type {
  CompanionChatMessage,
  ReligionChapterRef,
  ReligionTraditionId,
  ScripturePassage,
  ScriptureWordAnalysis,
  ScriptureWordToken,
} from '../types.ts';

interface ReligionTraditionMeta {
  id: ReligionTraditionId;
  nameUrdu: string;
  bookTitleUrdu: string;
  originalLanguage: string;
  overviewUrdu: string;
  sampleTopicsUrdu: string[];
  chapters: ReligionChapterRef[];
}

type InspectorTab = 'word' | 'comparison' | 'chat';
type NavMode = 'books' | 'chapters';
type ReaderLayout = 'chapter' | 'single';
type ReadingTheme = 'navy' | 'light' | 'parchment';

/** Ensures EVERY single word in originalText is clickable, merging pre-loaded glosses with full tokenization. */
function buildCompleteWordTokens(passage: ScripturePassage): ScriptureWordToken[] {
  const rawTokens = passage.originalText
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^[«»"'(]+|[.,;:!?׃।॥)"'»«]+$/g, '').trim())
    .filter(Boolean);

  if (rawTokens.length === 0) return passage.words || [];

  return rawTokens.map((tok, idx) => {
    const existing = (passage.words || []).find(
      (w) =>
        w.original === tok ||
        w.original.includes(tok) ||
        tok.includes(w.original.replace(/[.,;:!?׃।॥]+$/g, ''))
    );
    if (existing) {
      return {
        ...existing,
        position: idx + 1,
        original: tok,
      };
    }
    return {
      position: idx + 1,
      original: tok,
      transliteration: 'لفظ پر کلک کریں',
      urduMeaning: 'تفصیلی معنی دیکھیں',
      grammarRole: 'کلک کریں',
    };
  });
}

export const ReligionsExplorerView: React.FC = () => {
  const [traditions, setTraditions] = useState<ReligionTraditionMeta[]>([]);
  const [starterPassages, setStarterPassages] = useState<ScripturePassage[]>([]);
  const [selectedTradition, setSelectedTradition] = useState<ReligionTraditionId>('torah');
  const [activeChapterId, setActiveChapterId] = useState<string>('torah-ch-1');
  const [chapterPassages, setChapterPassages] = useState<ScripturePassage[]>([]);
  const [activePassageIdx, setActivePassageIdx] = useState<number>(0);

  // Quran-Studio parity display & navigation state
  const [navMode, setNavMode] = useState<NavMode>('chapters');
  const [readerLayout, setReaderLayout] = useState<ReaderLayout>('chapter');
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('navy');
  const [scriptFontPx, setScriptFontPx] = useState<number>(28);
  const [showUrdu, setShowUrdu] = useState<boolean>(true);
  const [showWordGloss, setShowWordGloss] = useState<boolean>(true);
  const [showQuranPovInline, setShowQuranPovInline] = useState<boolean>(true);

  const [selectedWord, setSelectedWord] = useState<ScriptureWordToken | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('word');
  const [wordAnalysis, setWordAnalysis] = useState<ScriptureWordAnalysis | null>(null);
  const [loadingWord, setLoadingWord] = useState(false);

  // Chapter Search + Direct Deep Translator
  const [topicQuery, setTopicQuery] = useState('');
  const [showTranslator, setShowTranslator] = useState(false);
  const [translateInput, setTranslateInput] = useState('');
  const [translating, setTranslating] = useState(false);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<CompanionChatMessage[]>([]);
  const [chatQuestion, setChatQuestion] = useState('');
  const [askingChat, setAskingChat] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const isContinuousSpeakingRef = useRef<boolean>(false);
  const [micRecording, setMicRecording] = useState(false);
  const recorderRef = useRef<MicrophoneRecorder | null>(null);

  useEffect(() => {
    fetch('/api/religions/overview')
      .then((r) => r.json())
      .then((data) => {
        const tradList: ReligionTraditionMeta[] = data.traditions || [];
        const passList: ScripturePassage[] = data.passages || [];
        setTraditions(tradList);
        setStarterPassages(passList);
        const firstTrad = tradList[0]?.id || 'torah';
        setSelectedTradition(firstTrad);
        if (tradList[0]?.chapters?.[0]) setActiveChapterId(tradList[0].chapters[0].id);
        const firstPass = passList.find((p) => p.traditionId === firstTrad) || passList[0];
        if (firstPass) {
          setChapterPassages([firstPass]);
          setActivePassageIdx(0);
          setSelectedWord(firstPass.words?.[0] || null);
        }
      })
      .catch(() => setErrorMsg('مذاہب و کتب کا ڈیٹا لوڈ نہ ہو سکا۔'));

    return () => {
      isContinuousSpeakingRef.current = false;
      stopInlineUrduSpeech();
    };
  }, []);

  const activeMeta = traditions.find((t) => t.id === selectedTradition);
  const chapters = activeMeta?.chapters || [];
  const activeChapter = chapters.find((c) => c.id === activeChapterId) || chapters[0] || null;
  const activePassage = chapterPassages[activePassageIdx] || chapterPassages[0] || null;

  const loadChapter = async (traditionId: ReligionTraditionId, chapter: ReligionChapterRef) => {
    setActiveChapterId(chapter.id);
    setLoadingChapter(true);
    setErrorMsg(null);
    setWordAnalysis(null);
    isContinuousSpeakingRef.current = false;
    stopInlineUrduSpeech();
    setIsSpeaking(false);

    try {
      const res = await fetch('/api/religions/chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traditionId, chapterRef: `${chapter.titleUrdu} (${chapter.reference})` }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.passages) || data.passages.length === 0) {
        throw new Error(data.error || 'باب لوڈ کرنے میں مسئلہ پیش آیا۔');
      }
      setChapterPassages(data.passages);
      setActivePassageIdx(0);
      setSelectedWord(data.passages[0]?.words?.[0] || null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'مذہبی کتاب کا باب لوڈ نہ ہو سکا۔');
    } finally {
      setLoadingChapter(false);
    }
  };

  const handleSelectTradition = (id: ReligionTraditionId) => {
    setSelectedTradition(id);
    setErrorMsg(null);
    setWordAnalysis(null);
    isContinuousSpeakingRef.current = false;
    stopInlineUrduSpeech();
    setIsSpeaking(false);

    const meta = traditions.find((t) => t.id === id);
    if (meta?.chapters?.[0]) setActiveChapterId(meta.chapters[0].id);
    const starter = starterPassages.find((p) => p.traditionId === id);
    if (starter) {
      setChapterPassages([starter]);
      setActivePassageIdx(0);
      setSelectedWord(starter.words?.[0] || null);
    }
  };

  const handleLoadTopic = async (topicOverride?: string) => {
    const q = (topicOverride ?? topicQuery).trim();
    if (!q || loadingChapter) return;
    setLoadingChapter(true);
    setErrorMsg(null);
    setWordAnalysis(null);
    try {
      const res = await fetch('/api/religions/chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traditionId: selectedTradition, chapterRef: q }),
      });
      const data = await res.json();
      if (!res.ok || !data.passages?.length) throw new Error(data.error || 'اقتباس لوڈ نہ ہو سکا۔');
      setChapterPassages(data.passages);
      setActivePassageIdx(0);
      setSelectedWord(data.passages[0]?.words?.[0] || null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'مذہبی کتاب لوڈ کرنے میں مسئلہ پیش آیا۔');
    } finally {
      setLoadingChapter(false);
    }
  };

  const handleTranslateDeep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!translateInput.trim() || translating) return;
    setTranslating(true);
    setErrorMsg(null);
    setWordAnalysis(null);
    try {
      const res = await fetch('/api/religions/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traditionId: selectedTradition,
          inputText: translateInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.passage) throw new Error(data.error || 'ترجمہ مکمل نہ ہو سکا۔');
      setChapterPassages([data.passage]);
      setActivePassageIdx(0);
      if (data.passage.words?.[0]) setSelectedWord(data.passage.words[0]);
      setShowTranslator(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'عبارت کا ترجمہ ناکام ہوا۔');
    } finally {
      setTranslating(false);
    }
  };

  const inspectWord = async (passage: ScripturePassage, word: ScriptureWordToken) => {
    const pIdx = chapterPassages.findIndex((p) => p.id === passage.id);
    if (pIdx >= 0) setActivePassageIdx(pIdx);
    setSelectedWord(word);
    setInspectorTab('word');
    setLoadingWord(true);
    setWordAnalysis(null);
    try {
      const res = await fetch('/api/religions/word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traditionNameUrdu: passage.traditionNameUrdu,
          originalLanguage: passage.originalLanguage,
          passageText: passage.originalText,
          word: word.original,
        }),
      });
      const data = await res.json();
      if (data.analysis) setWordAnalysis(data.analysis);
    } finally {
      setLoadingWord(false);
    }
  };

  const speakPassageSequence = (startIdx: number) => {
    const item = chapterPassages[startIdx];
    if (!item) {
      isContinuousSpeakingRef.current = false;
      setIsSpeaking(false);
      return;
    }
    setActivePassageIdx(startIdx);
    setIsSpeaking(true);
    const spoken = `${item.reference}۔ ${item.urduTranslation}۔ قرآنی نقطہ نظر: ${item.islamicQuranicPovUrdu}`;
    playInlineUrduSpeech(spoken, {
      onEnd: () => {
        if (!isContinuousSpeakingRef.current) {
          setIsSpeaking(false);
          return;
        }
        if (startIdx + 1 < chapterPassages.length) {
          speakPassageSequence(startIdx + 1);
        } else {
          isContinuousSpeakingRef.current = false;
          setIsSpeaking(false);
        }
      },
      onError: () => {
        isContinuousSpeakingRef.current = false;
        setIsSpeaking(false);
      },
    });
  };

  const togglePlayChapter = () => {
    if (isSpeaking) {
      isContinuousSpeakingRef.current = false;
      stopInlineUrduSpeech();
      setIsSpeaking(false);
      return;
    }
    isContinuousSpeakingRef.current = true;
    speakPassageSequence(activePassageIdx);
  };

  const speakSingleUrdu = (text: string) => {
    if (isSpeaking) {
      isContinuousSpeakingRef.current = false;
      stopInlineUrduSpeech();
      setIsSpeaking(false);
      return;
    }
    isContinuousSpeakingRef.current = false;
    playInlineUrduSpeech(text, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handleAskQuestion = async (qOverride?: string) => {
    if (!activePassage) return;
    const cleanQ = (qOverride ?? chatQuestion).trim();
    if (!cleanQ || askingChat) return;

    setInspectorTab('chat');
    setAskingChat(true);
    const userMsg: CompanionChatMessage = {
      id: `rel-u-${Date.now()}`,
      role: 'user',
      content: cleanQ,
      timestamp: new Date().toISOString(),
    };
    const nextHist = [...chatMessages, userMsg];
    setChatMessages(nextHist);
    setChatQuestion('');

    try {
      const res = await fetch('/api/religions/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traditionNameUrdu: activePassage.traditionNameUrdu,
          reference: activePassage.reference,
          passageText: `${activePassage.originalText}\n${activePassage.urduTranslation}`,
          question: cleanQ,
          history: nextHist.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.answer) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `rel-a-${Date.now()}`,
            role: 'assistant',
            content: data.answer,
            citationNote: `${activePassage.bookNameUrdu} · ${activePassage.reference}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setAskingChat(false);
    }
  };

  const toggleChatMic = async () => {
    if (micRecording && recorderRef.current) {
      setMicRecording(false);
      try {
        const { blob } = await recorderRef.current.stop();
        recorderRef.current = null;
        const wav = await convertBlobToWav(blob);
        const fd = new FormData();
        fd.append('audio', wav.wavBlob, 'religion-q.wav');
        fd.append('mimeType', wav.mimeType);
        fd.append('saveAudio', 'false');
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.transcript) {
          setChatQuestion(data.transcript);
          setInspectorTab('chat');
        }
      } catch {
        // ignore
      }
      return;
    }

    try {
      const rec = new MicrophoneRecorder();
      recorderRef.current = rec;
      setMicRecording(true);
      await rec.start({ autoStopOnSilence: false });
    } catch {
      setMicRecording(false);
    }
  };

  const readerThemeClass =
    readingTheme === 'light'
      ? 'reading-light'
      : readingTheme === 'parchment'
        ? 'reading-parchment'
        : 'reading-navy';

  const readerMutedText = readingTheme === 'navy' ? 'text-slate-200' : 'text-stone-700';
  const activeChapterIdx = chapters.findIndex((c) => c.id === activeChapterId);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-[1440px] px-5 py-6 space-y-5"
    >
      {/* Top Studio Header */}
      <div className="modern-panel rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-gold)]/40 bg-[var(--color-navy)] shadow-lg">
            <motion.svg
              width="38"
              height="38"
              viewBox="0 0 40 40"
              className="text-[var(--color-gold-soft)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
              aria-hidden="true"
            >
              <polygon
                points="20,2 25,15 38,20 25,25 20,38 15,25 2,20 15,15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <rect
                x="9"
                y="9"
                width="22"
                height="22"
                transform="rotate(45 20 20)"
                fill="none"
                stroke="var(--color-emerald)"
                strokeWidth="1.2"
              />
            </motion.svg>
          </div>
          <div dir="rtl" className="text-right">
            <h1 lang="ur" className="font-urdu-heavy text-2xl sm:text-3xl text-[var(--color-ink)]">
              مذاہبِ عالم اور کتب اسٹوڈیو (ایک ایک لفظ کی گہرائی اور اردو ترجمہ)
            </h1>
            <p lang="ur" className="mt-1 text-sm text-[var(--color-ink-muted)]">
              توریت، زبور، انجیل، بھگود گیتا، دھم پد اور گرو گرنتھ صاحب کا ہر لفظ اپنی اصل زبان اور گہری اردو میں پڑھیں، ترجمہ کریں اور قرآن سے موازنہ دیکھیں۔
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <div className="flex items-center rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-1">
            {(
              [
                { id: 'chapter', label: 'مکمل باب' },
                { id: 'single', label: 'ایک اقتباس' },
              ] as const
            ).map((l) => (
              <motion.button
                key={l.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => setReaderLayout(l.id)}
                className={`rounded-md px-3 py-1.5 font-urdu text-xs ${
                  readerLayout === l.id
                    ? 'bg-[var(--color-emerald-deep)] text-white shadow-sm'
                    : 'text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]'
                }`}
              >
                {l.label}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-1">
            {(
              [
                { id: 'navy', label: 'ڈارک' },
                { id: 'light', label: 'لائٹ' },
                { id: 'parchment', label: 'کاغذ' },
              ] as const
            ).map((t) => (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => setReadingTheme(t.id)}
                className={`rounded-md px-2.5 py-1.5 font-urdu text-xs ${
                  readingTheme === t.id
                    ? 'bg-[var(--color-emerald-deep)] text-white'
                    : 'text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]'
                }`}
              >
                {t.label}
              </motion.button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-[var(--color-ink-muted)] font-urdu text-xs">
            <span>خط</span>
            <input
              type="range"
              min={22}
              max={42}
              value={scriptFontPx}
              onChange={(e) => setScriptFontPx(Number(e.target.value))}
              className="w-16 accent-[var(--color-emerald)]"
            />
          </label>
        </div>
      </div>

      {/* Book Search + Bilingual Passage Translator Bar */}
      <div className="modern-panel rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleLoadTopic();
            }}
            className="flex flex-1 min-w-[260px] flex-wrap items-center gap-2"
          >
            <input
              type="text"
              dir="auto"
              value={topicQuery}
              onChange={(e) => setTopicQuery(e.target.value)}
              placeholder="منتخب کتاب میں باب یا حوالہ کھولیں (مثلاً: Exodus 20, Psalm 51, Matthew 5, Gita 12)…"
              className="flex-1 min-w-[220px] rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-4 py-2.5 text-sm font-urdu text-[var(--color-ink)] focus:border-[var(--color-emerald)] focus:outline-none"
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loadingChapter || !topicQuery.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-emerald-deep)] px-4 py-2.5 text-xs font-urdu font-bold text-white hover:bg-[var(--color-emerald)] hover:text-slate-950 disabled:opacity-50"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {loadingChapter ? 'باب کھل رہا ہے…' : 'باب کھولیں'}
            </motion.button>
          </form>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setShowTranslator((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-urdu font-bold transition-colors ${
              showTranslator
                ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/20 text-[var(--color-gold-soft)]'
                : 'border-[var(--color-gold)]/45 bg-[var(--color-navy)] text-[var(--color-gold-soft)] hover:border-[var(--color-gold)]'
            }`}
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            کسی بھی عبارت کا اصل زبان و اردو ترجمہ کریں
          </motion.button>
        </div>

        <AnimatePresence>
          {showTranslator && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleTranslateDeep}
              dir="rtl"
              lang="ur"
              className="overflow-hidden rounded-xl border border-[var(--color-gold)]/35 bg-[var(--color-navy)] p-4 space-y-3 text-right"
            >
              <div className="text-sm font-urdu-heavy text-[var(--color-gold-soft)]">
                عبارت یا آیت پیسٹ کریں — اصل زبان + ایک ایک لفظ کا معنی + پورا اردو ترجمہ اور قرآنی موازنہ فوراً تیار ہو گا:
              </div>
              <textarea
                rows={3}
                dir="auto"
                value={translateInput}
                onChange={(e) => setTranslateInput(e.target.value)}
                placeholder="یہاں عبرانی، یونانی، سنسکرت، پالی، انگریزی یا اردو میں کوئی بھی اقتباس یا آیت لکھیں…"
                className="w-full rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-4 py-3 text-sm font-urdu text-[var(--color-ink)] focus:border-[var(--color-emerald)] focus:outline-none"
              />
              <div className="flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={translating || !translateInput.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-emerald-deep)] px-5 py-2.5 text-xs font-urdu font-bold text-white disabled:opacity-50"
                >
                  <Languages className="h-4 w-4" />
                  {translating ? 'گہرا ترجمہ اور لفظی تجزیہ جاری ہے…' : 'مکمل ترجمہ و لفظی تشریح کریں'}
                </motion.button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {errorMsg && (
        <div dir="rtl" lang="ur" className="rounded-xl border border-[#B91C1C]/50 bg-[#B91C1C]/15 px-4 py-3 text-sm font-urdu text-[var(--color-ink)] text-right">
          {errorMsg}
        </div>
      )}

      {/* 3-Pane Reader Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Books & Chapters Navigator */}
        <aside className="lg:col-span-3 modern-panel rounded-2xl p-4 space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setNavMode('books')}
              className={`rounded-lg py-2 font-urdu font-bold transition-colors ${
                navMode === 'books'
                  ? 'bg-[var(--color-emerald-deep)] text-white'
                  : 'text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]'
              }`}
            >
              ۶ کتب
            </button>
            <button
              type="button"
              onClick={() => setNavMode('chapters')}
              className={`rounded-lg py-2 font-urdu font-bold transition-colors ${
                navMode === 'chapters'
                  ? 'bg-[var(--color-emerald-deep)] text-white'
                  : 'text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]'
              }`}
            >
              ابواب ({chapters.length})
            </button>
          </div>

          {navMode === 'books' ? (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {traditions.map((tr) => {
                const active = tr.id === selectedTradition;
                return (
                  <motion.button
                    key={tr.id}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      handleSelectTradition(tr.id);
                      setNavMode('chapters');
                    }}
                    dir="rtl"
                    lang="ur"
                    className={`w-full rounded-xl border p-3.5 text-right transition-colors ${
                      active
                        ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)]/25 text-[var(--color-ink)]'
                        : 'modern-card text-[var(--color-ink-muted)]'
                    }`}
                  >
                    <div className="text-sm font-urdu-heavy text-[var(--color-ink)]">{tr.nameUrdu}</div>
                    <div className="mt-0.5 text-xs font-urdu text-[var(--color-ink-subtle)]">
                      {tr.bookTitleUrdu} · {tr.chapters.length} ابواب
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5" dir="rtl">
                {traditions.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => handleSelectTradition(tr.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-urdu font-bold transition-colors ${
                      tr.id === selectedTradition
                        ? 'bg-[var(--color-emerald-deep)] text-white'
                        : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-ink-muted)]'
                    }`}
                  >
                    {tr.nameUrdu.split(' ')[0]}
                  </button>
                ))}
              </div>

              {chapters.length > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    disabled={activeChapterIdx <= 0 || loadingChapter}
                    onClick={() => {
                      const prev = chapters[activeChapterIdx - 1];
                      if (prev) void loadChapter(selectedTradition, prev);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1.5 font-urdu font-bold disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> پچھلا
                  </button>
                  <span className="font-mono text-xs text-[var(--color-gold-soft)]">
                    باب {activeChapterIdx + 1} / {chapters.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeChapterIdx < 0 || activeChapterIdx >= chapters.length - 1 || loadingChapter}
                    onClick={() => {
                      const next = chapters[activeChapterIdx + 1];
                      if (next) void loadChapter(selectedTradition, next);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1.5 font-urdu font-bold disabled:opacity-40"
                  >
                    اگلا <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                {chapters.map((ch) => {
                  const isActiveCh = ch.id === activeChapterId;
                  return (
                    <motion.button
                      key={ch.id}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      type="button"
                      disabled={loadingChapter}
                      onClick={() => void loadChapter(selectedTradition, ch)}
                      dir="rtl"
                      lang="ur"
                      className={`w-full rounded-xl border p-3 text-right transition-colors ${
                        isActiveCh
                          ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)]/25'
                          : 'modern-card'
                      }`}
                    >
                      <div className="text-xs font-urdu-heavy text-[var(--color-ink)]">{ch.titleUrdu}</div>
                      <div className="text-[11px] font-mono text-[var(--color-gold-soft)] mt-0.5">{ch.reference}</div>
                      <div className="text-xs font-urdu text-[var(--color-ink-muted)] mt-1 line-clamp-2">{ch.summaryUrdu}</div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {chapterPassages.length > 0 && (
            <div className="border-t border-[var(--color-border-hairline)] pt-3">
              <div className="text-xs font-urdu font-bold text-[var(--color-ink-subtle)] mb-2 text-right" dir="rtl">
                آیات / اقتباسات ({chapterPassages.length})
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {chapterPassages.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePassageIdx(idx);
                      const tokens = buildCompleteWordTokens(p);
                      if (tokens[0]) setSelectedWord(tokens[0]);
                    }}
                    className={`rounded-lg py-1.5 text-xs font-urdu font-bold ${
                      idx === activePassageIdx
                        ? 'bg-[var(--color-emerald-deep)] text-white'
                        : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-ink-muted)]'
                    }`}
                  >
                    حوالہ {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--color-border-hairline)] pt-3 space-y-2 text-xs font-urdu text-[var(--color-ink-muted)]" dir="rtl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showUrdu} onChange={(e) => setShowUrdu(e.target.checked)} className="accent-[var(--color-emerald)]" />
              <span>مکمل اردو ترجمہ دکھائیں</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showWordGloss} onChange={(e) => setShowWordGloss(e.target.checked)} className="accent-[var(--color-emerald)]" />
              <span>ہر لفظ کا معنی نیچے دکھائیں</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showQuranPovInline} onChange={(e) => setShowQuranPovInline(e.target.checked)} className="accent-[var(--color-emerald)]" />
              <span>قرآنی موازنہ ساتھ دکھائیں</span>
            </label>
          </div>
        </aside>

        {/* CENTER: Word-by-Word Interactive Scripture Reader */}
        <div className="lg:col-span-5">
          {loadingChapter || !activePassage ? (
            <div dir="rtl" lang="ur" className="modern-panel rounded-2xl p-8 text-base font-urdu text-[var(--color-emerald)] text-right">
              {loadingChapter ? 'مذہبی کتاب کا باب، ایک ایک لفظ کا معنی، اردو ترجمہ اور قرآنی تقابل تیار ہو رہا ہے…' : 'منتخب کتاب لوڈ ہو رہی ہے…'}
            </div>
          ) : (
            <div className={`rounded-2xl border p-5 sm:p-6 transition-colors space-y-5 ${readerThemeClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 pb-3 text-xs">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[var(--color-gold-soft)]" aria-hidden="true" />
                  <span className="font-urdu-heavy text-sm" dir="rtl">
                    {activeChapter ? activeChapter.titleUrdu : activePassage.bookNameUrdu}
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={togglePlayChapter}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-emerald-deep)] px-3.5 py-2 text-xs font-urdu font-bold text-white whitespace-nowrap shrink-0"
                >
                  {isSpeaking ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {isSpeaking ? 'آواز روکیں' : 'مسلسل اردو سنیں'}
                </motion.button>
              </div>

              {(readerLayout === 'chapter' ? chapterPassages : [activePassage]).map((passage) => {
                const isActiveRow = activePassage.id === passage.id;
                const tokens = buildCompleteWordTokens(passage);
                return (
                  <motion.div
                    key={passage.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      const idx = chapterPassages.findIndex((p) => p.id === passage.id);
                      if (idx >= 0) setActivePassageIdx(idx);
                    }}
                    className={`rounded-xl border p-4 transition-colors cursor-pointer space-y-4 ${
                      isActiveRow
                        ? 'border-[var(--color-emerald)] bg-[var(--color-emerald)]/10'
                        : 'border-current/15 hover:border-current/35'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs opacity-85">
                      <span className="font-mono font-semibold">
                        {passage.bookNameUrdu} ({passage.reference})
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = chapterPassages.findIndex((p) => p.id === passage.id);
                          if (idx >= 0) setActivePassageIdx(idx);
                          setInspectorTab('comparison');
                        }}
                        className="font-urdu font-bold text-[var(--color-emerald)] hover:underline"
                      >
                        تفسیر و قرآنی نظر
                      </button>
                    </div>

                    <div dir="rtl" className="text-[11px] font-urdu opacity-80 text-right">
                      کسی بھی ایک لفظ پر کلک کریں تو اس کی اصل زبان ({passage.originalLanguage}) اور گہرا اردو مطلب سامنے آ جائے گا:
                    </div>

                    {/* Every Single Word in the Passage as Interactive Clickable Tiles */}
                    <div className="flex flex-wrap justify-center gap-2 py-1">
                      {tokens.map((w) => {
                        const isWordSel = isActiveRow && selectedWord?.original === w.original && selectedWord?.position === w.position;
                        return (
                          <motion.button
                            key={`${passage.id}-${w.position}-${w.original}`}
                            whileHover={{ y: -2, scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void inspectWord(passage, w);
                            }}
                            className={`flex flex-col items-center rounded-xl border px-3 py-2 text-center transition-colors ${
                              isWordSel
                                ? 'border-[var(--color-emerald)] bg-[var(--color-emerald)]/25 ring-2 ring-[var(--color-emerald)]/40'
                                : 'border-current/15 hover:border-[var(--color-emerald)]/60 hover:bg-current/5'
                            }`}
                          >
                            <span style={{ fontSize: `${scriptFontPx}px` }} className="font-arabic leading-snug">
                              {w.original}
                            </span>
                            <span className="text-[11px] font-mono font-semibold text-[var(--color-emerald)]">
                              {w.transliteration}
                            </span>
                            {showWordGloss && (
                              <span dir="rtl" lang="ur" className={`mt-0.5 text-xs font-urdu ${readerMutedText}`}>
                                {w.urduMeaning}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>

                    {showUrdu && (
                      <p dir="rtl" lang="ur" className="text-right text-lg font-urdu leading-loose border-t border-current/10 pt-3">
                        {passage.urduTranslation}
                      </p>
                    )}

                    {showQuranPovInline && (
                      <div dir="rtl" lang="ur" className="rounded-xl bg-current/5 p-3.5 text-sm font-urdu text-right leading-loose">
                        <strong className="text-[var(--color-emerald)]">قرآنی نقطۂ نظر: </strong>
                        <span>{passage.islamicQuranicPovUrdu}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: 3-Tab Scholar Inspector (Original Language + Full-Depth Urdu Word Inspector) */}
        <div className="lg:col-span-4 modern-panel rounded-2xl p-4 space-y-4">
          <div className="grid grid-cols-3 gap-1 border-b border-[var(--color-border-hairline)] pb-3">
            {(
              [
                { id: 'word', label: 'لفظ کی گہرائی' },
                { id: 'comparison', label: 'تفسیر و قرآنی نظر' },
                { id: 'chat', label: 'استاد سے پوچھیں' },
              ] as const
            ).map((t) => {
              const active = inspectorTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInspectorTab(t.id)}
                  className={`relative rounded-lg px-2 py-2.5 text-xs font-urdu font-bold whitespace-nowrap transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-[var(--color-ink-subtle)] hover:bg-[var(--color-navy-elevated)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="religion-inspector-tab"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-[var(--color-emerald-deep)]"
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {/* TAB 1: Deep Word Analysis in Both Original Language & Urdu */}
              {inspectorTab === 'word' && (
                <div dir="rtl" lang="ur" className="space-y-3.5 max-h-[650px] overflow-y-auto pr-1 text-right">
                  {selectedWord && activePassage ? (
                    <>
                      <div className="modern-card rounded-xl p-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-mono text-[var(--color-ink-subtle)]">
                            {selectedWord.transliteration}
                            {wordAnalysis?.pronunciationUrdu ? ` · تلفظ: ${wordAnalysis.pronunciationUrdu}` : ''}
                          </div>
                          <div className="mt-1 text-lg font-urdu-heavy text-[var(--color-ink)]">
                            {wordAnalysis?.urduMeaning || selectedWord.urduMeaning}
                          </div>
                          {selectedWord.grammarRole && (
                            <div className="mt-0.5 text-xs font-urdu text-[var(--color-gold-soft)]">
                              صرف و نحو: {selectedWord.grammarRole}
                            </div>
                          )}
                        </div>
                        <span className="font-arabic text-3xl text-[var(--color-emerald)] shrink-0">
                          {selectedWord.original}
                        </span>
                      </div>

                      {!wordAnalysis && !loadingWord && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={() => void inspectWord(activePassage, selectedWord)}
                          className="w-full rounded-xl bg-[var(--color-emerald-deep)] px-4 py-3 text-xs font-urdu font-bold text-white"
                        >
                          اس لفظ کی اپنی زبان اور اردو میں مکمل گہری تشریح دیکھیں
                        </motion.button>
                      )}

                      {loadingWord && (
                        <div className="text-sm font-urdu text-[var(--color-emerald)] py-3">
                          اس لفظ کا اپنی اصل زبان ({activePassage.originalLanguage}) اور اردو میں گہرا تجزیہ تیار ہو رہا ہے…
                        </div>
                      )}

                      {wordAnalysis && (
                        <div className="space-y-3">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                speakSingleUrdu(
                                  `${wordAnalysis.pronunciationUrdu || wordAnalysis.transliteration}۔ اردو معنی: ${wordAnalysis.urduMeaning}۔ اصل زبان میں مفہوم: ${wordAnalysis.meaningInOriginalLanguageUrdu || wordAnalysis.rootAndHistoryUrdu}۔ قرآنی تقابل: ${wordAnalysis.quranicComparisonUrdu}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-emerald)]/40 bg-[var(--color-navy)] px-3 py-1.5 text-xs font-urdu font-bold text-[var(--color-emerald)]"
                            >
                              {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                              پوری تشریح اردو آواز میں سنیں
                            </button>
                          </div>

                          {wordAnalysis.meaningInOriginalLanguageUrdu && (
                            <div className="modern-card rounded-xl p-3.5 space-y-1.5">
                              <div className="text-xs font-urdu-heavy text-[var(--color-gold-soft)]">
                                ۱۔ اپنی اصل زبان ({activePassage.originalLanguage}) میں معنی اور گہرائی
                              </div>
                              <p className="text-sm font-urdu leading-loose text-[var(--color-ink)]">
                                {wordAnalysis.meaningInOriginalLanguageUrdu}
                              </p>
                              {wordAnalysis.originalLanguageNote && (
                                <p dir="ltr" className="text-xs font-sans text-[var(--color-ink-muted)] border-t border-[var(--color-border-hairline)] pt-2 text-left">
                                  {wordAnalysis.originalLanguageNote}
                                </p>
                              )}
                            </div>
                          )}

                          {wordAnalysis.whyThisWordUsedUrdu && (
                            <div className="modern-card rounded-xl p-3.5 space-y-1.5">
                              <div className="text-xs font-urdu-heavy text-[var(--color-gold-soft)]">
                                ۲۔ اس آیت میں یہی خاص لفظ کیوں استعمال ہوا؟
                              </div>
                              <p className="text-sm font-urdu leading-loose text-[var(--color-ink)]">
                                {wordAnalysis.whyThisWordUsedUrdu}
                              </p>
                            </div>
                          )}

                          <div className="modern-card rounded-xl p-3.5 space-y-1.5">
                            <div className="text-xs font-urdu-heavy text-[var(--color-gold-soft)]">
                              ۳۔ لغوی مادہ، تاریخ اور کتاب میں استعمال
                            </div>
                            <p className="text-sm font-urdu leading-loose text-[var(--color-ink)]">
                              {wordAnalysis.rootAndHistoryUrdu}
                            </p>
                            <p className="text-sm font-urdu leading-loose text-[var(--color-ink-muted)]">
                              {wordAnalysis.usageInBookUrdu}
                            </p>
                          </div>

                          <div className="rounded-xl border border-[var(--color-emerald)]/35 bg-[var(--color-emerald-deep)]/15 p-3.5 space-y-1.5">
                            <div className="text-xs font-urdu-heavy text-[var(--color-emerald)]">
                              ۴۔ عربی، قرآن اور اسلام سے تقابل
                            </div>
                            <p className="text-sm font-urdu leading-loose text-[var(--color-ink)]">
                              {wordAnalysis.quranicComparisonUrdu}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm font-urdu text-[var(--color-ink-muted)]">
                      اوپر دیے گئے کسی بھی ایک لفظ پر کلک کریں۔
                    </p>
                  )}
                </div>
              )}

              {/* TAB 2: Tradition Tafseer & Quranic POV */}
              {inspectorTab === 'comparison' && activePassage && (
                <div dir="rtl" lang="ur" className="space-y-3.5 max-h-[650px] overflow-y-auto pr-1 text-right">
                  <div className="modern-card rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-urdu-heavy text-[var(--color-gold-soft)]">
                        <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                        اس مذہبی روایت کے مطابق گہری تشریح
                      </span>
                      <button
                        type="button"
                        onClick={() => speakSingleUrdu(activePassage.traditionTafseerUrdu)}
                        className="inline-flex items-center gap-1 text-xs font-urdu font-bold text-[var(--color-emerald)] hover:underline"
                      >
                        <Volume2 className="h-3.5 w-3.5" /> سنیں
                      </button>
                    </div>
                    <p className="text-sm font-urdu leading-loose text-[var(--color-ink)]">
                      {activePassage.traditionTafseerUrdu}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[var(--color-emerald)]/35 bg-[var(--color-emerald-deep)]/15 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-urdu-heavy text-[var(--color-emerald)]">
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        قرآنی و اسلامی نقطۂ نظر (POV)
                      </span>
                      <button
                        type="button"
                        onClick={() => speakSingleUrdu(activePassage.islamicQuranicPovUrdu)}
                        className="inline-flex items-center gap-1 text-xs font-urdu font-bold text-[var(--color-emerald)] hover:underline"
                      >
                        <Volume2 className="h-3.5 w-3.5" /> سنیں
                      </button>
                    </div>
                    <p className="text-sm font-urdu leading-loose text-[var(--color-ink)]">
                      {activePassage.islamicQuranicPovUrdu}
                    </p>
                    {activePassage.quranicReferences.length > 0 && (
                      <div className="pt-2 border-t border-[var(--color-border-hairline)] text-xs font-urdu text-[var(--color-gold-soft)]">
                        قرآنی حوالہ جات: {activePassage.quranicReferences.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Comparative Scholar Chat */}
              {inspectorTab === 'chat' && activePassage && (
                <div className="flex flex-col h-[560px] text-xs">
                  <div className="mb-2 flex items-center justify-between text-[var(--color-ink-subtle)]">
                    <span className="inline-flex items-center gap-1.5 font-urdu font-bold text-[var(--color-gold-soft)]">
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      تقابلی مطالعہ چیٹ ({activePassage.reference})
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {chatMessages.length === 0 ? (
                      <div dir="rtl" lang="ur" className="modern-card rounded-xl p-4 space-y-2.5 text-right">
                        <p className="text-sm font-urdu text-[var(--color-ink-muted)] leading-loose">
                          اس کتاب، کسی لفظ کی اصل زبان یا اسلام کے نقطۂ نظر کے بارے میں سوال پوچھیں:
                        </p>
                        {[
                          'اس باب اور قرآن مجید کے پیغام میں کیا قدرِ مشترک اور کیا بنیادی فرق ہے؟',
                          'اس عبارت کے مشکل الفاظ کی اصل زبان اور اردو میں گہری تشریح بتائیں۔',
                        ].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => void handleAskQuestion(q)}
                            className="w-full rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2.5 text-right text-xs font-urdu text-[var(--color-ink-muted)] hover:border-[var(--color-emerald)]/50 hover:text-[var(--color-ink)]"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`rounded-xl p-3.5 border ${
                            msg.role === 'user'
                              ? 'ml-6 border-[var(--color-emerald)]/30 bg-[var(--color-emerald-deep)]/15'
                              : 'mr-2 modern-card'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-urdu font-bold text-xs text-[var(--color-emerald)]">
                              {msg.role === 'user' ? 'آپ' : 'تقابلی عالمِ دین'}
                            </span>
                            {msg.role === 'assistant' && (
                              <button
                                type="button"
                                onClick={() => speakSingleUrdu(msg.content)}
                                className="inline-flex items-center gap-1 text-xs font-urdu font-bold text-[var(--color-emerald)] hover:underline"
                              >
                                {isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />} سنیں
                              </button>
                            )}
                          </div>
                          <p dir="rtl" lang="ur" className="whitespace-pre-wrap text-sm font-urdu leading-loose text-right text-[var(--color-ink)]">
                            {msg.content}
                          </p>
                        </div>
                      ))
                    )}

                    {askingChat && (
                      <div dir="rtl" lang="ur" className="modern-card rounded-xl p-3.5 text-sm font-urdu text-[var(--color-emerald)] text-right">
                        قرآن اور متعلقہ کتاب کی روشنی میں تفصیلی جواب تیار ہو رہا ہے…
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleAskQuestion();
                    }}
                    className="mt-3 flex items-center gap-1.5 border-t border-[var(--color-border-hairline)] pt-2.5"
                  >
                    <button
                      type="button"
                      onClick={toggleChatMic}
                      aria-label={micRecording ? 'ریکارڈنگ بند کریں' : 'بول کر سوال پوچھیں'}
                      className={`rounded-lg p-2.5 ${
                        micRecording
                          ? 'bg-[#B91C1C] text-white'
                          : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-emerald)]'
                      }`}
                    >
                      {micRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                    <input
                      type="text"
                      dir="auto"
                      value={chatQuestion}
                      onChange={(e) => setChatQuestion(e.target.value)}
                      placeholder="اردو میں تقابلی سوال لکھیں…"
                      className="flex-1 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 text-sm font-urdu text-[var(--color-ink)]"
                    />
                    <button
                      type="submit"
                      disabled={askingChat || !chatQuestion.trim()}
                      className="rounded-lg bg-[var(--color-emerald-deep)] px-3.5 py-2.5 text-white disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  );
};
