import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquareText,
  Mic,
  Pause,
  Play,
  Square,
  ShieldCheck,
  Send,
  Volume2,
  VolumeX,
  BookmarkPlus,
  Check,
  BookOpen,
  ExternalLink,
  GitBranch,
  NotebookPen,
  BarChart3,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { ClaimVerifierView } from './ClaimVerifierView.tsx';
import { SavedNotesView } from './SavedNotesView.tsx';
import { LearningProgressView } from './LearningProgressView.tsx';
import { DiagramRenderer } from './DiagramRenderer.tsx';
import { CitationCard } from './CitationCard.tsx';
import { MicrophoneRecorder, convertBlobToWav } from '../utils/audioUtils.ts';
import { playInlineUrduSpeech, stopInlineUrduSpeech } from '../utils/ttsPlayer.ts';
import type {
  CorpusPassage,
  DiagramData,
  TranscriptResult,
  WebSourceCitation,
} from '../types.ts';

type ResearchMode = 'chat' | 'voice' | 'verify';
type SecondaryDrawer = 'none' | 'notes' | 'progress';

interface LibraryMatch {
  bookId: string;
  bookTitle: string;
  author: string;
  category: string;
  printedPage: string;
  chapter: string;
  snippet: string;
  isPersonalUpload: boolean;
}

interface ResearchThreadItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  spokenSummary?: string;
  citations?: CorpusPassage[];
  libraryMatches?: LibraryMatch[];
  webSources?: WebSourceCitation[];
  diagram?: DiagramData;
  viaVoice?: boolean;
  timestamp: string;
}

export interface ResearchHubViewProps {
  onReadAloud: (text: string) => void;
  onAskInStudio: (passage: CorpusPassage) => void;
  onJumpToAyah: (surah: number, ayah: number) => void;
}

const SEO_EXAMPLE_PROMPTS = [
  'پریشانی اور ذہنی دباؤ کا قرآن اور امام غزالی و ابو زید بلخی کی کتب میں کیا علاج ہے؟',
  'حضرت عمر رضی اللہ عنہ کے اہم تاریخی فیصلے مستند کتابوں کے حوالوں کے ساتھ بتائیں',
  'نماز اور کاروبار میں ایمانداری پر قرآن و حدیث کیا فرماتے ہیں؟',
  'تزکیۂ نفس اور دل کی بیماریوں کے علاج کا بصری چارٹ بنائیں',
];

export const ResearchHubView: React.FC<ResearchHubViewProps> = ({
  onReadAloud,
  onAskInStudio,
  onJumpToAyah,
}) => {
  const [mode, setMode] = useState<ResearchMode>('chat');
  const [secondaryDrawer, setSecondaryDrawer] = useState<SecondaryDrawer>('none');

  const [thread, setThread] = useState<ResearchThreadItem[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [includeDiagram, setIncludeDiagram] = useState(false);
  const [asking, setAsking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [savedNoteIds, setSavedNoteIds] = useState<Record<string, boolean>>({});

  // Voice Search Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceActive, setVoiceActive] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptData, setTranscriptData] = useState<TranscriptResult | null>(null);
  const [editableTranscript, setEditableTranscript] = useState('');
  const recorderRef = useRef<MicrophoneRecorder | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      stopInlineUrduSpeech();
      recorderRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.length, asking]);

  const submitResearchQuestion = async (
    rawQuestion: string,
    options?: { viaVoice?: boolean; autoSpeak?: boolean; forceDiagram?: boolean }
  ) => {
    const cleanQ = rawQuestion.trim();
    if (!cleanQ || asking) return;

    setErrorMsg(null);
    setAsking(true);

    const userItem: ResearchThreadItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanQ,
      viaVoice: options?.viaVoice,
      timestamp: new Date().toLocaleTimeString(),
    };
    const nextHistory = thread.slice(-8).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    setThread((prev) => [...prev, userItem]);
    if (!options?.viaVoice) {
      setQuestionInput('');
    }

    try {
      const res = await fetch('/api/research/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: cleanQ,
          includeDiagram: options?.forceDiagram ?? includeDiagram,
          history: nextHistory,
        }),
      });
      const data = (await res.json()) as {
        answer?: string;
        spokenSummary?: string;
        citations?: CorpusPassage[];
        libraryMatches?: LibraryMatch[];
        webSources?: WebSourceCitation[];
        diagram?: DiagramData;
        error?: string;
      };

      if (!res.ok || !data.answer) {
        throw new Error(data.error || 'تحقیقی جواب حاصل کرنے میں مسئلہ پیش آیا۔');
      }

      const assistantItem: ResearchThreadItem = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        spokenSummary: data.spokenSummary,
        citations: data.citations || [],
        libraryMatches: data.libraryMatches || [],
        webSources: data.webSources || [],
        diagram: data.diagram,
        timestamp: new Date().toLocaleTimeString(),
      };

      setThread((prev) => [...prev, assistantItem]);

      if (options?.autoSpeak) {
        const speechText = data.spokenSummary || data.answer.slice(0, 420);
        setSpeakingId(assistantItem.id);
        void playInlineUrduSpeech(speechText, {
          onEnd: () => setSpeakingId((curr) => (curr === assistantItem.id ? null : curr)),
          onError: () => setSpeakingId((curr) => (curr === assistantItem.id ? null : curr)),
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تحقیق مکمل نہ ہو سکی۔');
    } finally {
      setAsking(false);
    }
  };

  const handleSaveToNotebook = async (item: ResearchThreadItem, idx: number) => {
    const prevUser = [...thread]
      .slice(0, idx)
      .reverse()
      .find((m) => m.role === 'user');
    const title = prevUser
      ? prevUser.content.slice(0, 72) + (prevUser.content.length > 72 ? '…' : '')
      : 'تحقیقی خلاصہ';
    const arabicRefs = (item.citations || [])
      .map((c) => c.arabicText)
      .filter((t): t is string => Boolean(t));

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary: item.content,
          arabicReferences: arabicRefs,
          citations: item.citations || [],
        }),
      });
      if (res.ok) {
        setSavedNoteIds((prev) => ({ ...prev, [item.id]: true }));
      }
    } catch {
      setErrorMsg('نوٹ محفوظ نہیں ہو سکا۔');
    }
  };

  const handleSpeakItem = (item: ResearchThreadItem) => {
    if (speakingId === item.id) {
      stopInlineUrduSpeech();
      setSpeakingId(null);
      return;
    }
    const textToSpeak = item.spokenSummary || item.content.slice(0, 460);
    setSpeakingId(item.id);
    void playInlineUrduSpeech(textToSpeak, {
      onEnd: () => setSpeakingId((curr) => (curr === item.id ? null : curr)),
      onError: (msg) => {
        setSpeakingId((curr) => (curr === item.id ? null : curr));
        setErrorMsg(msg);
      },
    });
  };

  const startVoiceCapture = async () => {
    setErrorMsg(null);
    setTranscriptData(null);
    try {
      const rec = new MicrophoneRecorder();
      recorderRef.current = rec;
      await rec.start({
        autoStopOnSilence: false,
        onLevel: (level, active) => {
          setAudioLevel(level);
          setVoiceActive(active);
        },
      });
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'مائیکروفون کی اجازت نہیں ملی۔');
    }
  };

  const togglePauseVoice = () => {
    if (!recorderRef.current) return;
    if (isPaused) {
      recorderRef.current.resume();
      setIsPaused(false);
    } else {
      recorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const stopAndTranscribeVoice = async () => {
    if (!recorderRef.current) return;
    setIsRecording(false);
    setIsPaused(false);
    setAudioLevel(0);
    setVoiceActive(false);
    setTranscribing(true);

    try {
      const { blob } = await recorderRef.current.stop();
      const wav = await convertBlobToWav(blob);
      const formData = new FormData();
      formData.append('audio', wav.wavBlob, 'research-voice-query.wav');
      formData.append('mimeType', wav.mimeType);
      formData.append('saveAudio', 'false');

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json()) as TranscriptResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'آواز کو تحریر میں تبدیل نہ کیا جا سکا۔');
      }
      setTranscriptData(data);
      setEditableTranscript(data.transcript || '');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'آواز کی شناخت میں مسئلہ پیش آیا۔');
    } finally {
      setTranscribing(false);
    }
  };

  const submitVoiceTranscript = async () => {
    if (!editableTranscript.trim()) return;
    const text = editableTranscript.trim();
    setTranscriptData(null);
    setEditableTranscript('');
    await submitResearchQuestion(text, { viaVoice: true, autoSpeak: true });
  };

  return (
    <div className="mx-auto max-w-[1440px] px-6 pt-5 pb-10 space-y-5">
      {/* Compact Header + Secondary Notebook & Progress Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-hairline)] pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
            تحقیق و تصدیق مرکز (Research & Verification)
          </h1>
          <p dir="rtl" lang="ur" className="mt-1 text-xs text-[var(--color-ink-muted)] max-w-2xl text-right">
            قرآن، ذاتی و آن لائن کتب اور مستند علمی ذرائع سے اردو میں تحقیق — چیٹ، بول کر تلاش یا میڈیا تصدیق منتخب کریں۔
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {secondaryDrawer !== 'none' ? (
            <button
              type="button"
              onClick={() => setSecondaryDrawer('none')}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-emerald-deep)] px-3.5 py-2 text-xs font-medium text-white whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              تحقیق پر واپس جائیں
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSecondaryDrawer('notes')}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-3 py-2 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] whitespace-nowrap shrink-0"
              >
                <NotebookPen className="h-3.5 w-3.5 text-[var(--color-gold-soft)]" aria-hidden="true" />
                محفوظ نوٹس
              </button>
              <button
                type="button"
                onClick={() => setSecondaryDrawer('progress')}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-3 py-2 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] whitespace-nowrap shrink-0"
              >
                <BarChart3 className="h-3.5 w-3.5 text-[var(--color-emerald)]" aria-hidden="true" />
                تعلیمی پیش رفت
              </button>
            </>
          )}
        </div>
      </div>

      {secondaryDrawer === 'notes' && <SavedNotesView onReadAloud={onReadAloud} />}
      {secondaryDrawer === 'progress' && <LearningProgressView onJumpToAyah={onJumpToAyah} />}

      {secondaryDrawer === 'none' && (
        <>
          {/* 3 Main Mode Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(
              [
                {
                  id: 'chat',
                  title: '1. تحریری چیٹ اور تلاش',
                  subtitle: 'کسی بھی اسلامی، قرآنی، نفسیاتی یا کتابی موضوع پر اردو میں مکمل تحقیق اور چارٹ',
                  icon: MessageSquareText,
                },
                {
                  id: 'voice',
                  title: '2. بول کر تلاش (مائیک)',
                  subtitle: 'قدرتی انداز میں سوال بولیں، تحریر چیک کریں اور اردو آواز میں جواب سنیں',
                  icon: Mic,
                },
                {
                  id: 'verify',
                  title: '3. ویڈیو، تصویر، PDF یا حوالہ تصدیق',
                  subtitle: 'ویڈیو اپلوڈ، ویڈیو/آرٹیکل لنک، PDF، تصویر، آڈیو یا کسی قول کی تحقیق کریں',
                  icon: ShieldCheck,
                },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setMode(opt.id);
                    setErrorMsg(null);
                  }}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)] text-white'
                      : 'border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] text-[var(--color-ink)] hover:border-[var(--color-emerald)]/50'
                  }`}
                >
                  <div
                    className={`mt-0.5 rounded-lg p-2 shrink-0 ${
                      active ? 'bg-white/15 text-white' : 'bg-[var(--color-navy)] text-[var(--color-emerald)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 text-right" dir="rtl">
                    <div className="text-sm font-semibold">{opt.title}</div>
                    <div
                      className={`mt-0.5 text-xs leading-relaxed ${
                        active ? 'text-white/85' : 'text-[var(--color-ink-muted)]'
                      }`}
                    >
                      {opt.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {errorMsg && (
            <div dir="rtl" className="flex items-center gap-2 rounded-lg border border-[#B91C1C]/40 bg-[#B91C1C]/15 px-4 py-3 text-xs text-[var(--color-ink)]">
              <AlertTriangle className="h-4 w-4 text-[var(--color-crimson)] shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'verify' && (
            <ClaimVerifierView onReadAloud={onReadAloud} onAskInStudio={onAskInStudio} />
          )}

          {(mode === 'chat' || mode === 'voice') && (
            <div className="space-y-5">
              {mode === 'voice' && (
                <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-right" dir="rtl">
                      <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">
                        بول کر سوال پوچھیں (اردو / عربی / انگریزی)
                      </h2>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                        سوال بول کر ریکارڈنگ روکیں، تحریر دیکھیں اور جواب اردو آواز کے ساتھ حاصل کریں۔
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!isRecording ? (
                        <button
                          type="button"
                          onClick={startVoiceCapture}
                          disabled={transcribing || asking}
                          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-emerald-deep)] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                        >
                          <Mic className="h-4 w-4" aria-hidden="true" />
                          مائیک آن کریں
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={togglePauseVoice}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 text-xs font-medium text-[var(--color-ink)]"
                          >
                            {isPaused ? (
                              <>
                                <Play className="h-3.5 w-3.5 text-[var(--color-emerald)]" aria-hidden="true" />
                                دوبارہ شروع
                              </>
                            ) : (
                              <>
                                <Pause className="h-3.5 w-3.5 text-[var(--color-amber-warn)]" aria-hidden="true" />
                                وقفہ
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={stopAndTranscribeVoice}
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#B91C1C] px-4 py-2 text-xs font-medium text-white"
                          >
                            <Square className="h-3.5 w-3.5" aria-hidden="true" />
                            بند کریں اور تحریر بنائیں
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isRecording && (
                    <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-ink-muted)]" dir="rtl">
                          {isPaused
                            ? 'ریکارڈنگ رکی ہوئی ہے'
                            : voiceActive
                              ? 'آواز سنی جا رہی ہے…'
                              : 'مائیک آن ہے — اپنا سوال بولیں'}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--color-emerald)]">
                          {Math.round(audioLevel * 100)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-navy-elevated)]">
                        <div
                          className="h-full bg-[var(--color-emerald)] transition-all duration-75"
                          style={{ width: `${Math.min(100, Math.round(audioLevel * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {transcribing && (
                    <div className="text-xs text-[var(--color-emerald)] text-right" dir="rtl">
                      آپ کی آواز کو تحریر میں تبدیل کیا جا رہا ہے…
                    </div>
                  )}

                  {transcriptData && (
                    <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[var(--color-ink)]">تحریری مسودہ</span>
                          <span className="text-[var(--color-emerald)]">
                            زبان: {transcriptData.primaryLanguage}
                          </span>
                          <span className="font-mono text-[var(--color-ink-subtle)]">
                            {Math.round(transcriptData.confidence * 100)}%
                          </span>
                        </div>
                        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeDiagram}
                            onChange={(e) => setIncludeDiagram(e.target.checked)}
                            className="accent-[var(--color-emerald)]"
                          />
                          <span>بصری چارٹ بھی بنائیں</span>
                        </label>
                      </div>

                      {transcriptData.lowConfidenceWarning && (
                        <div dir="rtl" className="flex items-start gap-2 rounded border border-[var(--color-amber-warn)]/40 bg-[var(--color-amber-warn)]/10 p-2.5 text-xs text-[var(--color-amber-warn)]">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>
                            {transcriptData.warningMessage ||
                              'کچھ الفاظ یا نام واضح نہیں تھے — ارسال کرنے سے پہلے نیچے درست کر لیں۔'}
                          </span>
                        </div>
                      )}

                      <textarea
                        rows={3}
                        dir="auto"
                        value={editableTranscript}
                        onChange={(e) => setEditableTranscript(e.target.value)}
                        className="w-full rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-3 text-sm text-[var(--color-ink)]"
                      />

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTranscriptData(null);
                            setEditableTranscript('');
                          }}
                          className="rounded-md border border-[var(--color-border-hairline)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)]"
                        >
                          منسوخ کریں
                        </button>
                        <button
                          type="button"
                          onClick={submitVoiceTranscript}
                          disabled={!editableTranscript.trim() || asking}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-emerald-deep)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                          تلاش کریں اور اردو میں سنیں
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat / SEO Prompt Input Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitResearchQuestion(questionInput);
                }}
                className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="research-seo-input"
                    dir="rtl"
                    className="text-xs font-semibold text-[var(--color-gold-soft)] flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    کسی بھی اسلامی، قرآنی، کتابی یا نفسیاتی موضوع پر سوال لکھیں
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--color-ink-muted)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeDiagram}
                      onChange={(e) => setIncludeDiagram(e.target.checked)}
                      className="accent-[var(--color-emerald)]"
                    />
                    <GitBranch className="h-3.5 w-3.5 text-[var(--color-emerald)]" aria-hidden="true" />
                    <span>بصری چارٹ بنائیں</span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="research-seo-input"
                    type="text"
                    dir="auto"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="مثلاً: دل کے اطمینان اور پریشانی کے علاج کے بارے میں قرآن و احادیث اور مستند کتب سے رہنمائی دیں…"
                    className="flex-1 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)]"
                  />
                  <button
                    type="submit"
                    disabled={asking || !questionInput.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-5 py-3 text-sm font-medium text-white disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {asking ? 'تحقیق جاری ہے…' : 'تلاش اور جواب'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1" dir="rtl">
                  {SEO_EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        const wantsChart = ex.includes('چارٹ');
                        if (wantsChart) setIncludeDiagram(true);
                        void submitResearchQuestion(ex, { forceDiagram: wantsChart });
                      }}
                      className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1.5 text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-emerald)] hover:text-[var(--color-ink)] text-right"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </form>

              {/* Conversation & Sources Feed */}
              <div className="space-y-4">
                {thread.length === 0 && !asking && (
                  <div className="rounded-xl border border-dashed border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-10 text-center space-y-2">
                    <BookOpen className="mx-auto h-7 w-7 text-[var(--color-gold-soft)]" aria-hidden="true" />
                    <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                      آپ کا اسلامی تحقیق و مطالعہ چیٹ باکس تیار ہے
                    </h3>
                    <p dir="rtl" lang="ur" className="text-xs text-[var(--color-ink-muted)] max-w-xl mx-auto leading-loose">
                      اوپر کوئی بھی سوال لکھیں، نمونہ سوال منتخب کریں یا مائیک سے بول کر پوچھیں۔ ہر جواب قرآن، حدیث، آپ کی شامل کردہ کتب اور آن لائن مستند کتابوں کے واضح حوالوں کے ساتھ خالص اردو میں ملے گا۔
                    </p>
                  </div>
                )}

                {thread.map((item, idx) =>
                  item.role === 'user' ? (
                    <div key={item.id} className="flex justify-end">
                      <div className="max-w-2xl rounded-xl border border-[var(--color-emerald)]/40 bg-[var(--color-emerald-deep)] px-4 py-3 text-sm text-white">
                        <div className="flex items-center gap-2 text-[11px] text-white/75 mb-1">
                          <span>{item.viaVoice ? 'بول کر سوال' : 'آپ کا سوال'}</span>
                          <span>·</span>
                          <span className="font-mono">{item.timestamp}</span>
                        </div>
                        <p dir="auto" className="leading-relaxed">{item.content}</p>
                      </div>
                    </div>
                  ) : (
                    <article
                      key={item.id}
                      className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-6 space-y-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-hairline)] pb-3">
                        <div className="flex items-center gap-2 text-xs text-[var(--color-gold-soft)] font-semibold">
                          <span>بحرالعلم AI · مستند تحقیقی جواب</span>
                          <span className="font-mono font-normal text-[var(--color-ink-subtle)]">
                            {item.timestamp}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSpeakItem(item)}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                              speakingId === item.id
                                ? 'bg-[#B91C1C] text-white'
                                : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-emerald)] hover:border-[var(--color-emerald)]'
                            }`}
                          >
                            {speakingId === item.id ? (
                              <>
                                <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                                آواز بند کریں
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                                سنیں (اردو)
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveToNotebook(item, idx)}
                            disabled={savedNoteIds[item.id]}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-gold-soft)] disabled:opacity-75"
                          >
                            {savedNoteIds[item.id] ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-[var(--color-emerald)]" aria-hidden="true" />
                                محفوظ ہو گیا
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="h-3.5 w-3.5 text-[var(--color-gold-soft)]" aria-hidden="true" />
                                نوٹس میں محفوظ کریں
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div dir="rtl" lang="ur" className="whitespace-pre-wrap text-sm text-[var(--color-ink)] leading-loose text-right">
                        {item.content}
                      </div>

                      {item.diagram && <DiagramRenderer diagram={item.diagram} />}

                      {(Boolean(item.libraryMatches?.length) ||
                        Boolean(item.webSources?.length) ||
                        Boolean(item.citations?.length)) && (
                        <div className="space-y-4 border-t border-[var(--color-border-hairline)] pt-4">
                          <div className="text-xs font-semibold text-[var(--color-gold-soft)] text-right" dir="rtl">
                            حوالہ جات — جواب کن ذرائع سے لیا گیا
                          </div>

                          {item.libraryMatches && item.libraryMatches.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-[var(--color-ink-muted)] text-right" dir="rtl">
                                آپ کی شامل کردہ کتب ({item.libraryMatches.length})
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {item.libraryMatches.map((lib, lIdx) => (
                                  <div
                                    key={`${lib.bookId}-${lIdx}`}
                                    className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3.5 text-xs space-y-1"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-[var(--color-ink)]">
                                        {lib.bookTitle}
                                      </span>
                                      <span className="text-[11px] font-mono text-[var(--color-emerald)]">
                                        {lib.printedPage}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-[var(--color-ink-subtle)]">
                                      {lib.author} · {lib.category} · {lib.chapter}
                                    </div>
                                    <p dir="auto" className="text-[var(--color-ink-muted)] leading-relaxed pt-1">
                                      {lib.snippet}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.webSources && item.webSources.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-[var(--color-ink-muted)] text-right" dir="rtl">
                                آن لائن مستند کتب و علمی ذرائع ({item.webSources.length})
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {item.webSources.map((ws, wIdx) => (
                                  <a
                                    key={`${ws.url}-${wIdx}`}
                                    href={ws.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-1.5 text-xs text-[var(--color-emerald)] hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                    <span className="truncate max-w-[280px]">{ws.title || ws.url}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.citations && item.citations.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-[var(--color-ink-muted)] text-right" dir="rtl">
                                مستند قرآنی و حدیثی حوالہ جات ({item.citations.length})
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                {item.citations.map((c) => (
                                  <CitationCard
                                    key={c.id}
                                    passage={c}
                                    compact
                                    onReadAloud={onReadAloud}
                                    onAskInStudio={onAskInStudio}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  )
                )}

                {asking && (
                  <div dir="rtl" className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 text-xs text-[var(--color-emerald)] text-right">
                    قرآن، حدیث، آپ کی کتب اور آن لائن مستند کتابوں میں تحقیق جاری ہے…
                  </div>
                )}

                <div ref={threadEndRef} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
