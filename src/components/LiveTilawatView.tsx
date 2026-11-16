import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  Square,
  Volume2,
  VolumeX,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { MicrophoneRecorder, convertBlobToWav } from '../utils/audioUtils.ts';
import { playInlineUrduSpeech, stopInlineUrduSpeech } from '../utils/ttsPlayer.ts';
import type {
  QiraatEdition,
  QuranAyah,
  QuranSurahMeta,
  TilawatAssessmentResult,
} from '../types.ts';

interface LiveTilawatViewProps {
  activeAyah: QuranAyah | null;
  qiraat: QiraatEdition;
  onSpeakPakistaniUrdu?: (text: string) => void;
}

interface BenchmarksInfo {
  supportedQiraat: string[];
  unsupportedDisclosed: string[];
  pipelineStages: string[];
  sessionStats: {
    totalAttemptsEvaluated: number;
    confirmedIssuesDetected: number;
    humanQariReviewedFindings: number;
  };
  knownLimitations: string[];
  externalProvidersNotice: string;
}

const DEFAULT_FATIHA_1: QuranAyah = {
  surahNumber: 1,
  ayahNumber: 1,
  verseKey: '1:1',
  juzNumber: 1,
  mushafPage: 1,
  qiraat: "Hafs 'an Asim (Madinah Uthmani)",
  arabicUthmani: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  romanUrduTranslation: '',
  urduTranslation: 'شروع اللہ کے نام سے جو بڑا مہربان نہایت رحم والا ہے۔',
  englishTranslation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
  translationSources: { urdu: 'مولانا فتح محمد جالندھری', english: 'Sahih International' },
  audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/001001.mp3',
  words: [
    { position: 1, arabic: 'بِسْمِ', transliteration: 'Bismi', urduMeaning: 'نام سے', englishMeaning: 'In the name' },
    { position: 2, arabic: 'اللَّهِ', transliteration: 'Allahi', urduMeaning: 'اللہ کے', englishMeaning: 'of Allah' },
    { position: 3, arabic: 'الرَّحْمَٰنِ', transliteration: 'Ar-Rahmani', urduMeaning: 'بڑا مہربان', englishMeaning: 'Entirely Merciful' },
    { position: 4, arabic: 'الرَّحِيمِ', transliteration: 'Ar-Rahimi', urduMeaning: 'نہایت رحم والا', englishMeaning: 'Especially Merciful' },
  ],
};

export const LiveTilawatView: React.FC<LiveTilawatViewProps> = ({
  activeAyah,
  qiraat,
}) => {
  const [surahs, setSurahs] = useState<QuranSurahMeta[]>([]);
  const [selectedSurahNum, setSelectedSurahNum] = useState<number>(activeAyah?.surahNumber || 1);
  const [surahAyahs, setSurahAyahs] = useState<QuranAyah[]>(activeAyah ? [activeAyah] : [DEFAULT_FATIHA_1]);
  const [selectedAyahNum, setSelectedAyahNum] = useState<number>(activeAyah?.ayahNumber || 1);
  const [loadingAyahs, setLoadingAyahs] = useState(false);

  const [recState, setRecState] = useState<'idle' | 'recording' | 'assessing'>('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [recSeconds, setRecSeconds] = useState(0);
  const [saveAudioPermission, setSaveAudioPermission] = useState(false);
  const [isRetryAttempt, setIsRetryAttempt] = useState(false);
  const [localRecordingUrl, setLocalRecordingUrl] = useState<string | null>(null);
  const [isSpeakingFeedback, setIsSpeakingFeedback] = useState(false);

  const [assessment, setAssessment] = useState<TilawatAssessmentResult | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarksInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reviewingFindingId, setReviewingFindingId] = useState<string | null>(null);
  const [qariVerdict, setQariVerdict] = useState<'Confirmed issue' | 'Possible issue' | 'Unable to assess'>('Confirmed issue');
  const [qariNote, setQariNote] = useState('');

  const recorderRef = useRef<MicrophoneRecorder | null>(null);
  const startTimeRef = useRef<number>(0);
  const refAudioRef = useRef<HTMLAudioElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const loadBenchmarks = () => {
    fetch('/api/tilawat/benchmarks')
      .then((r) => r.json())
      .then((data) => setBenchmarks(data))
      .catch(() => {});
  };

  useEffect(() => {
    loadBenchmarks();
    fetch('/api/quran/surahs')
      .then((r) => r.json())
      .then((data) => {
        if (data.surahs) setSurahs(data.surahs);
      })
      .catch(() => {});
    return () => {
      stopInlineUrduSpeech();
      if (refAudioRef.current) refAudioRef.current.pause();
    };
  }, []);

  useEffect(() => {
    if (activeAyah) {
      setSelectedSurahNum(activeAyah.surahNumber);
      setSelectedAyahNum(activeAyah.ayahNumber);
    }
  }, [activeAyah]);

  useEffect(() => {
    setLoadingAyahs(true);
    fetch(`/api/quran/surah/${selectedSurahNum}?qiraat=${encodeURIComponent(qiraat)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ayahs?.length > 0) {
          setSurahAyahs(data.ayahs);
          if (!data.ayahs.some((a: QuranAyah) => a.ayahNumber === selectedAyahNum)) {
            setSelectedAyahNum(data.ayahs[0].ayahNumber);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAyahs(false));
  }, [selectedSurahNum, qiraat]);

  useEffect(() => {
    if (recState !== 'recording') {
      setRecSeconds(0);
      return;
    }
    const id = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recState]);

  const targetAyah: QuranAyah =
    surahAyahs.find((a) => a.ayahNumber === selectedAyahNum) ||
    (activeAyah && activeAyah.surahNumber === selectedSurahNum ? activeAyah : surahAyahs[0]) ||
    DEFAULT_FATIHA_1;

  const speakFeedbackInline = (text: string) => {
    playInlineUrduSpeech(text, {
      voiceName: 'Charon',
      onStart: () => setIsSpeakingFeedback(true),
      onEnd: () => setIsSpeakingFeedback(false),
      onError: (msg) => {
        setIsSpeakingFeedback(false);
        setError(msg);
      },
    });
  };

  const submitAudioForAssessment = async (rawBlob: Blob, fallbackDurationSec = 2.0) => {
    setRecState('assessing');
    setError(null);

    try {
      const converted = await convertBlobToWav(rawBlob);
      const effectiveBlob = converted.wavBlob;
      const effectiveMime = converted.mimeType;
      const effectiveDuration = converted.durationSec > 0 ? converted.durationSec : fallbackDurationSec;
      const effectiveSnr = converted.estimatedSnrDb;

      if (localRecordingUrl) {
        URL.revokeObjectURL(localRecordingUrl);
      }
      const objectUrl = URL.createObjectURL(effectiveBlob);
      setLocalRecordingUrl(objectUrl);

      const formData = new FormData();
      formData.append('audio', effectiveBlob, effectiveMime.includes('wav') ? 'tilawat.wav' : 'tilawat.webm');
      formData.append('mimeType', effectiveMime);
      formData.append('verseKey', targetAyah.verseKey);
      formData.append('expectedArabic', targetAyah.arabicUthmani);
      formData.append('qiraat', qiraat);
      formData.append('audioDurationSec', String(effectiveDuration));
      formData.append('estimatedSnrDb', String(effectiveSnr));
      formData.append('saveAudioPermission', String(saveAudioPermission));
      formData.append('referenceAudioUrl', targetAyah.audioUrl);
      formData.append('isRetry', String(isRetryAttempt));

      const res = await fetch('/api/tilawat/assess', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تلاوت کی جانچ میں مسئلہ پیش آیا۔');
      setAssessment(data.assessment);
      loadBenchmarks();

      if (data.assessment?.pakistaniUrduCoachSummary) {
        speakFeedbackInline(data.assessment.pakistaniUrduCoachSummary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تلاوت کی جانچ نہیں ہو سکی۔');
    } finally {
      setRecState('idle');
    }
  };

  const startRecitation = async () => {
    setError(null);
    stopInlineUrduSpeech();
    setIsSpeakingFeedback(false);
    if (localRecordingUrl) {
      URL.revokeObjectURL(localRecordingUrl);
      setLocalRecordingUrl(null);
    }
    try {
      const rec = new MicrophoneRecorder();
      recorderRef.current = rec;
      startTimeRef.current = performance.now();
      setRecState('recording');
      await rec.start({
        autoStopOnSilence: false,
        onLevel: (lvl) => setMicLevel(lvl),
      });
    } catch (err) {
      setRecState('idle');
      setError(
        err instanceof Error
          ? err.message
          : 'مائیکروفون کی اجازت نہیں ملی۔ براہِ کرم براؤزر میں مائیک آن کریں یا نیچے سے آڈیو فائل اپلوڈ کریں۔'
      );
    }
  };

  const stopAndAssess = async () => {
    if (!recorderRef.current) return;
    const durationSec = Math.max(0.5, (performance.now() - startTimeRef.current) / 1000);
    setRecState('assessing');
    try {
      const { blob } = await recorderRef.current.stop();
      recorderRef.current = null;
      setMicLevel(0);
      await submitAudioForAssessment(blob, durationSec);
    } catch (err) {
      setRecState('idle');
      setError(err instanceof Error ? err.message : 'ریکارڈنگ روکنے میں مسئلہ آیا۔');
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsRetryAttempt(Boolean(assessment));
    await submitAudioForAssessment(file, 3.0);
  };

  const playReferenceAudio = () => {
    if (refAudioRef.current) {
      refAudioRef.current.pause();
    }
    const audio = new Audio(targetAyah.audioUrl);
    audio.playbackRate = 0.85;
    refAudioRef.current = audio;
    audio.play().catch(() => {
      setError('قاری صاحب کی آڈیو لوڈ نہیں ہو سکی — انٹرنیٹ چیک کریں۔');
    });
  };

  const handleDeleteStoredAudio = async (url: string) => {
    const filename = url.split('/').pop();
    if (!filename || !assessment) return;
    await fetch(`/api/audio/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    setAssessment({
      ...assessment,
      storedAudioUrl: undefined,
      privacyNotice: 'محفوظ شدہ ریکارڈنگ مستقل طور پر حذف کر دی گئی ہے۔',
    });
  };

  const handleSubmitQariReview = async (findingId: string) => {
    if (!assessment) return;
    const res = await fetch('/api/tilawat/qari-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentId: assessment.id,
        findingId,
        verdict: qariVerdict,
        qariNote,
      }),
    });
    const data = await res.json();
    if (data.assessment) {
      setAssessment(data.assessment);
      setReviewingFindingId(null);
      setQariNote('');
      loadBenchmarks();
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-7 space-y-6">
      {/* Header & Direct Surah/Ayah Picker */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border-hairline)] pb-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--color-ink)]">
            لائیو تلاوت اور تجوید اصلاح سٹوڈیو
          </h1>
          <p dir="rtl" lang="ur" className="mt-1 text-sm text-[var(--color-ink-muted)] max-w-3xl text-right">
            کسی بھی سورت اور آیت کو منتخب کر کے مائیک پر تلاوت کریں (یا آڈیو فائل اپلوڈ کریں) — استاد آپ کی آواز سن کر حروف، مخارج اور تجوید کی غلطیوں کی آسان اردو میں نشاندہی کرے گا۔
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="Select Surah for Tilawat"
            value={selectedSurahNum}
            onChange={(e) => {
              setSelectedSurahNum(Number(e.target.value));
              setAssessment(null);
            }}
            className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-2.5 py-2 text-[var(--color-ink)]"
          >
            {surahs.length > 0 ? (
              surahs.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.number}. {s.nameArabic} ({s.nameEnglish})
                </option>
              ))
            ) : (
              <option value={1}>1. الفاتحة</option>
            )}
          </select>

          <select
            aria-label="Select Ayah for Tilawat"
            value={selectedAyahNum}
            onChange={(e) => {
              setSelectedAyahNum(Number(e.target.value));
              setAssessment(null);
            }}
            className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-2.5 py-2 text-[var(--color-ink)] font-mono tabular-nums"
          >
            {surahAyahs.map((a) => (
              <option key={a.verseKey} value={a.ayahNumber}>
                آیت {a.ayahNumber}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={playReferenceAudio}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-4 py-2 text-xs font-medium text-[var(--color-emerald)] hover:bg-[var(--color-navy-elevated)] whitespace-nowrap shrink-0"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            صحیح تلاوت سنیں (0.85x)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Active Ayah Stage & Microphone Control */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-subtle)]">
              <span className="font-mono tabular-nums text-[var(--color-gold-soft)]">
                آیت {targetAyah.verseKey} {targetAyah.juzNumber ? `· پارہ ${targetAyah.juzNumber}` : ''}
              </span>
              {loadingAyahs && <span className="text-[var(--color-emerald)]">آیت لوڈ ہو رہی ہے…</span>}
            </div>

            <p dir="rtl" lang="ar" className="font-arabic text-3xl md:text-4xl text-right text-[var(--color-ink)] leading-loose">
              {targetAyah.arabicUthmani}
            </p>

            {targetAyah.urduTranslation && (
              <p dir="rtl" lang="ur" className="text-base text-right text-[var(--color-ink)] leading-relaxed">
                {targetAyah.urduTranslation}
              </p>
            )}

            {/* Recording & Upload Controls */}
            <div className="border-t border-[var(--color-border-hairline)] pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  {recState === 'idle' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRetryAttempt(Boolean(assessment));
                          startRecitation();
                        }}
                        className="inline-flex h-12 items-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-5 text-sm font-medium text-white hover:bg-[var(--color-emerald)] hover:text-slate-950"
                      >
                        <Mic className="h-5 w-5" aria-hidden="true" />
                        {assessment ? 'دوبارہ تلاوت کریں' : 'تلاوت شروع کریں (مائیک)'}
                      </button>

                      <button
                        type="button"
                        onClick={() => uploadInputRef.current?.click()}
                        className="inline-flex h-12 items-center gap-2 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-4 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-emerald)]"
                      >
                        <Upload className="h-4 w-4 text-[var(--color-emerald)]" aria-hidden="true" />
                        آڈیو فائل اپلوڈ کریں
                      </button>
                      <input
                        ref={uploadInputRef}
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioFileUpload}
                        className="sr-only"
                      />
                    </>
                  ) : recState === 'recording' ? (
                    <button
                      type="button"
                      onClick={stopAndAssess}
                      className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#B91C1C] px-6 text-sm font-medium text-white hover:bg-[#991B1B]"
                    >
                      <Square className="h-4 w-4" aria-hidden="true" />
                      روکیں اور تجوید چیک کریں ({recSeconds}s)
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex h-12 items-center gap-2 rounded-lg bg-[var(--color-navy-elevated)] px-6 text-sm text-[var(--color-emerald)]"
                    >
                      آواز چیک ہو رہی ہے — مخارج اور تجوید کی جانچ جاری ہے…
                    </button>
                  )}

                  {recState === 'recording' && (
                    <div className="flex items-center gap-3 text-xs text-[var(--color-emerald)]">
                      <div className="flex h-7 items-end gap-0.5" aria-hidden="true">
                        {Array.from({ length: 14 }).map((_, i) => {
                          const wave = Math.max(0.18, Math.min(1, micLevel * (0.6 + ((i % 4) * 0.25))));
                          return (
                            <motion.span
                              key={i}
                              animate={{ scaleY: wave }}
                              transition={{ duration: 0.08 }}
                              className="w-1 rounded-full bg-[var(--color-emerald)]"
                              style={{ height: '24px', transformOrigin: 'bottom' }}
                            />
                          );
                        })}
                      </div>
                      <span>آپ کی آواز سنی جا رہی ہے — آیت پڑھ کر بٹن دبائیں</span>
                    </div>
                  )}
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-[var(--color-ink-muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAudioPermission}
                    onChange={(e) => setSaveAudioPermission(e.target.checked)}
                    className="accent-[var(--color-emerald)]"
                  />
                  <span>قاری کے جائزے کے لیے محفوظ کریں</span>
                </label>
              </div>

              {localRecordingUrl && recState === 'idle' && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 text-xs">
                  <span className="text-[var(--color-ink-muted)]">آپ کی ریکارڈنگ:</span>
                  <audio controls src={localRecordingUrl} className="h-8" />
                </div>
              )}

              {error && (
                <div className="rounded-md border border-[var(--color-crimson)]/40 bg-[var(--color-navy)] px-3.5 py-2 text-xs text-[var(--color-crimson)]">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Assessment Report */}
          <AnimatePresence>
            {assessment && (
              <motion.div
                key={assessment.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-6 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-hairline)] pb-3">
                  <div>
                    <div className="text-xs text-[var(--color-ink-subtle)]">
                      اعتماد (Confidence){' '}
                      <span className="font-mono tabular-nums text-[var(--color-ink)]">
                        {Math.round(assessment.overallConfidence * 100)}%
                      </span>
                      {' · '}
                      <span className="font-mono tabular-nums">
                        SNR {assessment.estimatedSnrDb} dB · {assessment.audioDurationSec}s
                      </span>
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--color-ink)]">
                      {assessment.overallState === 'Ready to advance'
                        ? 'ماشاءاللہ — اگلی آیت کے لیے تیار'
                        : assessment.overallState === 'Practice recommended'
                          ? 'مزید مشق تجویز کی جاتی ہے'
                          : 'آواز واضح نہ ہونے کی وجہ سے جانچ مکمل نہ ہو سکی'}
                    </h2>
                  </div>

                  {assessment.storedAudioUrl && (
                    <div className="flex items-center gap-2">
                      <audio controls src={assessment.storedAudioUrl} className="h-8" />
                      <button
                        type="button"
                        onClick={() => handleDeleteStoredAudio(assessment.storedAudioUrl!)}
                        className="inline-flex items-center gap-1 rounded border border-[var(--color-border-hairline)] px-2.5 py-1.5 text-xs text-[var(--color-crimson)] hover:bg-[var(--color-navy-elevated)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        حذف کریں
                      </button>
                    </div>
                  )}
                </div>

                {/* Recognized Transcript Banner */}
                {assessment.recognizedArabicText && (
                  <div className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3 text-xs">
                    <div dir="rtl" lang="ur" className="text-right text-[var(--color-ink-subtle)]">
                      جو آپ نے پڑھا (شناخت شدہ عربی تلاوت):
                    </div>
                    <div dir="rtl" lang="ar" className="mt-1 font-arabic text-2xl text-right text-[var(--color-gold-soft)]">
                      {assessment.recognizedArabicText}
                    </div>
                  </div>
                )}

                {/* Pakistani Urdu Coach Summary */}
                <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-emerald)]">
                      اردو تجوید کوچ کی رہنمائی
                    </span>
                    {isSpeakingFeedback ? (
                      <button
                        type="button"
                        onClick={() => {
                          stopInlineUrduSpeech();
                          setIsSpeakingFeedback(false);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-crimson)] hover:underline"
                      >
                        <VolumeX className="h-3.5 w-3.5" /> آواز روکیں
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => speakFeedbackInline(assessment.pakistaniUrduCoachSummary)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-emerald)] hover:underline"
                      >
                        <Volume2 className="h-3.5 w-3.5" /> سنیں (اردو آواز)
                      </button>
                    )}
                  </div>
                  <p dir="rtl" lang="ur" className="mt-2 text-base text-right text-[var(--color-ink)] leading-loose">
                    {assessment.pakistaniUrduCoachSummary}
                  </p>
                  {assessment.nextFocusChecklist && assessment.nextFocusChecklist.length > 0 && (
                    <div dir="rtl" lang="ur" className="mt-3 border-t border-[var(--color-border-hairline)] pt-2.5 text-right">
                      <div className="text-xs font-semibold text-[var(--color-gold-soft)]">
                        اگلی بار کن چیزوں کا دھیان رکھنا ہے:
                      </div>
                      <ul className="mt-1 list-disc pr-5 space-y-1 text-xs text-[var(--color-ink-muted)]">
                        {assessment.nextFocusChecklist.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div dir="rtl" lang="ur" className="mt-2 text-right text-[11px] text-[var(--color-ink-subtle)]">
                    {assessment.privacyNotice}
                  </div>
                </div>

                {/* Word-by-Word Alignment Strip */}
                <div>
                  <h3 dir="rtl" lang="ur" className="text-xs font-semibold text-[var(--color-ink-subtle)] mb-2 text-right">
                    لفظ بہ لفظ جانچ اور لاگو تجوید کے قواعد
                  </h3>
                  <div dir="rtl" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {assessment.wordAlignments.map((w) => (
                      <div
                        key={w.position}
                        className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-2.5 text-right"
                      >
                        <div className="font-arabic text-xl text-[var(--color-ink)]">{w.expectedWord}</div>
                        <div className="mt-1 text-[11px]">
                          <span
                            className={`font-semibold ${
                              w.status === 'matched'
                                ? 'text-[var(--color-emerald)]'
                                : w.status === 'omitted'
                                  ? 'text-[var(--color-crimson)]'
                                  : 'text-[var(--color-amber-warn)]'
                            }`}
                          >
                            {w.status === 'matched'
                              ? 'درست'
                              : w.status === 'omitted'
                                ? 'چھوٹ گیا'
                                : w.status === 'substituted'
                                  ? 'تبدیل ہوا'
                                  : 'غور طلب'}
                          </span>
                          {w.recognizedWord && w.status !== 'matched' && (
                            <div className="text-[var(--color-ink-muted)] font-arabic text-sm">
                              سنا گیا: {w.recognizedWord}
                            </div>
                          )}
                          <div dir="ltr" className="mt-0.5 text-[var(--color-ink-subtle)] text-left">
                            {w.applicableRules[0]}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detailed Findings */}
                <div className="space-y-3">
                  <h3 dir="rtl" lang="ur" className="text-xs font-semibold text-[var(--color-ink-subtle)] text-right">
                    تفصیلی تجوید و مخارج کی اصلاح ({assessment.findings.length})
                  </h3>
                  {assessment.findings.length === 0 ? (
                    <div dir="rtl" lang="ur" className="flex items-center gap-2 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4 text-sm text-[var(--color-emerald)]">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      اس تلاوت میں کوئی بڑی غلطی نہیں ملی — ماشاءاللہ! قاری صاحب کی آواز کے ساتھ مزید پختگی کریں۔
                    </div>
                  ) : (
                    assessment.findings.map((f) => (
                      <article
                        key={f.id}
                        className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4 space-y-2.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {f.state === 'Confirmed issue' ? (
                              <ShieldAlert className="h-4 w-4 text-[var(--color-crimson)]" />
                            ) : f.state === 'Possible issue' ? (
                              <AlertTriangle className="h-4 w-4 text-[var(--color-amber-warn)]" />
                            ) : (
                              <HelpCircle className="h-4 w-4 text-[var(--color-ink-subtle)]" />
                            )}
                            <span className="font-semibold text-[var(--color-ink)]">
                              {f.state === 'Confirmed issue'
                                ? 'یقینی غلطی'
                                : f.state === 'Possible issue'
                                  ? 'ممکنہ توجہ طلب'
                                  : 'قابلِ تصدیق نہیں'}{' '}
                              · {f.category}
                            </span>
                          </div>
                          <span className="font-mono tabular-nums text-[var(--color-ink-subtle)]">
                            {f.timestampRangeSec} · {Math.round(f.confidence * 100)}%
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <span className="text-[var(--color-ink-subtle)]">اصل قرآنی لفظ: </span>
                            <span className="font-arabic text-xl text-[var(--color-ink)] ml-1">{f.originalArabicWord}</span>
                          </div>
                          <div>
                            <span className="text-[var(--color-ink-subtle)]">سنا گیا تلفظ: </span>
                            <span className="font-arabic text-lg text-[var(--color-amber-warn)] ml-1">{f.detectedPronunciation}</span>
                          </div>
                        </div>

                        <div dir="rtl" lang="ur" className="text-right">
                          <span className="font-semibold text-[var(--color-gold-soft)]">قاعدہ / مخرج: </span>
                          <span className="text-[var(--color-ink)]">{f.expectedRuleOrMakhraj}</span>
                        </div>

                        <p dir="rtl" lang="ur" className="text-sm text-right text-[var(--color-ink)] leading-loose">
                          {f.explanationPakistaniUrdu}
                        </p>

                        {f.ruleCitationOrBookReason && (
                          <div dir="rtl" lang="ur" className="rounded bg-[var(--color-navy-surface)] p-2.5 border border-[var(--color-border-hairline)] text-right">
                            <span className="font-semibold text-[var(--color-emerald)]">
                              کس قاعدے یا کتاب کی وجہ سے:{' '}
                            </span>
                            <span className="text-[var(--color-ink-muted)]">{f.ruleCitationOrBookReason}</span>
                          </div>
                        )}

                        <div dir="rtl" lang="ur" className="rounded bg-[var(--color-navy-surface)] p-2.5 border border-[var(--color-border-hairline)] text-right">
                          <span className="font-semibold text-[var(--color-amber-warn)]">
                            غلط پڑھنے سے کیا ہوتا ہے:{' '}
                          </span>
                          <span className="text-[var(--color-ink-muted)]">
                            {f.impactIfMisread || f.whyItMatters}
                          </span>
                        </div>

                        {f.nextFocusChecklist && f.nextFocusChecklist.length > 0 && (
                          <div dir="rtl" lang="ur" className="rounded bg-[var(--color-navy-surface)] p-2.5 border border-[var(--color-border-hairline)] text-right">
                            <span className="font-semibold text-[var(--color-gold-soft)]">
                              آئندہ کن چیزوں کا دھیان رکھنا ہے:
                            </span>
                            <ul className="mt-1 list-disc pr-5 space-y-0.5 text-[var(--color-ink-muted)]">
                              {f.nextFocusChecklist.map((tip, idx) => (
                                <li key={idx}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-hairline)] pt-2.5">
                          <span className="text-[11px] text-[var(--color-ink-subtle)]">
                            {f.assessmentSource}
                            {f.qariNote ? ` — قاری نوٹ: "${f.qariNote}"` : ''}
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => speakFeedbackInline(f.explanationPakistaniUrdu)}
                              className="inline-flex items-center gap-1 text-[var(--color-emerald)] hover:underline"
                            >
                              <Volume2 className="h-3.5 w-3.5" /> سنیں (اردو)
                            </button>
                            <button
                              type="button"
                              onClick={playReferenceAudio}
                              className="inline-flex items-center gap-1 text-[var(--color-emerald)] hover:underline"
                            >
                              <Volume2 className="h-3.5 w-3.5" /> صحیح تلاوت
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsRetryAttempt(true);
                                startRecitation();
                              }}
                              className="inline-flex items-center gap-1 text-[var(--color-ink)] hover:underline"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> دوبارہ پڑھیں
                            </button>
                            <button
                              type="button"
                              onClick={() => setReviewingFindingId(f.id)}
                              className="text-[var(--color-gold-soft)] hover:underline"
                            >
                              قاری تصدیق
                            </button>
                          </div>
                        </div>

                        {reviewingFindingId === f.id && (
                          <div className="mt-2 rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-3 space-y-2">
                            <div className="font-semibold text-[var(--color-gold-soft)]">
                              قاری صاحب کا حتمی نوٹ
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <select
                                value={qariVerdict}
                                onChange={(e) => setQariVerdict(e.target.value as typeof qariVerdict)}
                                className="rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2 py-1 text-xs"
                              >
                                <option value="Confirmed issue">Confirmed issue</option>
                                <option value="Possible issue">Possible issue</option>
                                <option value="Unable to assess">Unable to assess</option>
                              </select>
                              <input
                                type="text"
                                value={qariNote}
                                onChange={(e) => setQariNote(e.target.value)}
                                placeholder="قاری صاحب کا مشاہدہ…"
                                className="flex-1 rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleSubmitQariReview(f.id)}
                                className="rounded bg-[var(--color-emerald-deep)] px-3 py-1 text-xs font-medium text-white"
                              >
                                محفوظ کریں
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Simple Guide & Stats */}
        <aside className="lg:col-span-5 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-4 text-xs">
          <div className="border-b border-[var(--color-border-hairline)] pb-3 text-right" dir="rtl" lang="ur">
            <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
              تلاوت جانچنے کا طریقہ اور اصول
            </h2>
            <p className="mt-1 text-[var(--color-ink-muted)] leading-relaxed">
              ہر تلاوت کو عربی آواز، الفاظ کی ترتیب، تجوید کے قواعد اور اردو رہنمائی کے ساتھ جانچا جاتا ہے۔
            </p>
          </div>

          {benchmarks && (
            <>
              <div className="grid grid-cols-3 gap-2 border-b border-[var(--color-border-hairline)] pb-3 text-center">
                <div>
                  <div className="text-[var(--color-ink-subtle)]">کل جانچ</div>
                  <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-[var(--color-ink)]">
                    {benchmarks.sessionStats.totalAttemptsEvaluated}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--color-ink-subtle)]">نشاندہی شدہ</div>
                  <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-[var(--color-ink)]">
                    {benchmarks.sessionStats.confirmedIssuesDetected}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--color-ink-subtle)]">قاری تصدیق شدہ</div>
                  <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-[var(--color-emerald)]">
                    {benchmarks.sessionStats.humanQariReviewedFindings}
                  </div>
                </div>
              </div>

              <div dir="rtl" lang="ur" className="space-y-1.5 text-right text-[var(--color-ink-muted)] leading-relaxed">
                <div className="font-semibold text-[var(--color-gold-soft)]">بہترین نتیجے کے لیے ہدایات:</div>
                <p>۱۔ پرسکون کمرے میں مائیک کے قریب واضح آواز سے پڑھیں۔</p>
                <p>۲۔ پہلے "صحیح تلاوت سنیں (0.85x)" دبا کر قاری صاحب کا انداز سن لیں۔</p>
                <p>۳۔ اگر براؤزر مائیک میں مسئلہ ہو تو "آڈیو فائل اپلوڈ کریں" سے ریکارڈنگ بھیج کر چیک کر سکتے ہیں۔</p>
                <p>۴۔ حتمی اجازہ اور سند کے لیے مستند قاری صاحب سے براہِ راست سنانا ضروری ہے۔</p>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
};
