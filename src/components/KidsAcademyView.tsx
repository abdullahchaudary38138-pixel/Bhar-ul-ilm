import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Eye,
  EyeOff,
  Film,
  Heart,
  Mic,
  Pause,
  Repeat,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Volume2,
} from 'lucide-react';
import { MicrophoneRecorder, convertBlobToWav } from '../utils/audioUtils.ts';
import { playInlineUrduSpeech, stopInlineUrduSpeech } from '../utils/ttsPlayer.ts';
import type {
  KalimaItem,
  NamazRakatRow,
  NamazStep,
  QuranAyah,
  TilawatAssessmentResult,
  WuduStep,
} from '../types.ts';

interface QaidaLesson {
  id: string;
  stepNumber: number;
  levelUrdu: string;
  titleUrdu: string;
  descriptionUrdu: string;
  items: { arabic: string; titleUrdu: string; howToReadUrdu: string }[];
}

interface HifzSurahPreset {
  surahNumber: number;
  nameArabic: string;
  nameUrdu: string;
  levelUrdu: string;
  virtueUrdu: string;
}

interface IslamCourseModule {
  id: string;
  level: 'ابتدائی' | 'درمیانی' | 'اعلیٰ';
  titleUrdu: string;
  subtitleUrdu: string;
  heartLoveNoteUrdu: string;
  steps: {
    stepTitleUrdu: string;
    arabicText?: string;
    urduTranslation?: string;
    howToPracticeUrdu: string;
    whyAllahLovesThisUrdu: string;
  }[];
}

interface PropheticSunnahItem {
  id: string;
  timeOfDayUrdu: string;
  titleUrdu: string;
  whenProphetDidUrdu: string;
  arabicDua: string;
  urduTranslation: string;
  practicalStepUrdu: string;
  heartLessonUrdu: string;
}

type StepTab = 'qaida' | 'kalimas' | 'wudu' | 'namaz' | 'hifz' | 'sunnah';

export interface KidsAcademyViewProps {
  onOpenVideosTab?: () => void;
}

export const KidsAcademyView: React.FC<KidsAcademyViewProps> = ({ onOpenVideosTab }) => {
  const [activeStep, setActiveStep] = useState<StepTab>('qaida');

  // Curriculum Data
  const [qaidaLessons, setQaidaLessons] = useState<QaidaLesson[]>([]);
  const [activeQaidaIdx, setActiveQaidaIdx] = useState<number>(0);
  const [selectedQaidaLetter, setSelectedQaidaLetter] = useState<{
    arabic: string;
    titleUrdu: string;
    howToReadUrdu: string;
  } | null>(null);

  const [sixKalimas, setSixKalimas] = useState<KalimaItem[]>([]);
  const [activeKalimaIdx, setActiveKalimaIdx] = useState<number>(0);

  const [wuduSteps, setWuduSteps] = useState<WuduStep[]>([]);
  const [activeWuduIdx, setActiveWuduIdx] = useState<number>(0);

  const [namazSteps, setNamazSteps] = useState<NamazStep[]>([]);
  const [namazRakats, setNamazRakats] = useState<NamazRakatRow[]>([]);
  const [activeNamazIdx, setActiveNamazIdx] = useState<number>(0);

  const [hifzPresets, setHifzPresets] = useState<HifzSurahPreset[]>([]);
  const [islamCourses, setIslamCourses] = useState<IslamCourseModule[]>([]);
  const [sunnahList, setSunnahList] = useState<PropheticSunnahItem[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<'ابتدائی' | 'درمیانی' | 'اعلیٰ'>('ابتدائی');

  // Hifz Studio State
  const [selectedHifzSurah, setSelectedHifzSurah] = useState<number>(1);
  const [hifzAyahs, setHifzAyahs] = useState<QuranAyah[]>([]);
  const [activeAyahIdx, setActiveAyahIdx] = useState<number>(0);
  const [repeatTarget, setRepeatTarget] = useState<number>(3);
  const [repeatCountLeft, setRepeatCountLeft] = useState<number>(0);
  const [hideWordsForMemory, setHideWordsForMemory] = useState<boolean>(false);
  const [playingHifzAudio, setPlayingHifzAudio] = useState<boolean>(false);
  const [hifzRecState, setHifzRecState] = useState<'idle' | 'recording' | 'checking'>('idle');
  const [hifzAssessment, setHifzAssessment] = useState<TilawatAssessmentResult | null>(null);
  const [memorizedKeys, setMemorizedKeys] = useState<Record<string, boolean>>({});
  const hifzAudioRef = useRef<HTMLAudioElement | null>(null);
  const hifzRecorderRef = useRef<MicrophoneRecorder | null>(null);

  // Kids Ustaad Q&A
  const [kidsQuestion, setKidsQuestion] = useState('');
  const [kidsAnswer, setKidsAnswer] = useState('');
  const [askingKids, setAskingKids] = useState(false);

  useEffect(() => {
    fetch('/api/kids/curriculum')
      .then((r) => r.json())
      .then((data) => {
        const qaida: QaidaLesson[] = data.qaidaLessons || [];
        setQaidaLessons(qaida);
        if (qaida[0]?.items?.[0]) setSelectedQaidaLetter(qaida[0].items[0]);
        setSixKalimas(data.sixKalimas || []);
        setWuduSteps(data.wuduSteps || []);
        setNamazSteps(data.namazSteps || []);
        setNamazRakats(data.namazRakats || []);
        setHifzPresets(data.hifzPresets || []);
        setIslamCourses(data.islamCourses || []);
        setSunnahList(data.propheticSunnah || []);
      })
      .catch(() => {});

    return () => {
      stopInlineUrduSpeech();
      if (hifzAudioRef.current) hifzAudioRef.current.pause();
    };
  }, []);

  useEffect(() => {
    fetch(`/api/quran/surah/${selectedHifzSurah}`)
      .then((r) => r.json())
      .then((data) => {
        setHifzAyahs(data.ayahs || []);
        setActiveAyahIdx(0);
        setHifzAssessment(null);
      })
      .catch(() => {});
  }, [selectedHifzSurah]);

  const activeQaida = qaidaLessons[activeQaidaIdx] || null;
  const activeKalima = sixKalimas[activeKalimaIdx] || null;
  const activeWudu = wuduSteps[activeWuduIdx] || null;
  const activeNamaz = namazSteps[activeNamazIdx] || null;
  const currentHifzAyah = hifzAyahs[activeAyahIdx] || null;
  const activeCourse = islamCourses.find((c) => c.level === selectedLevel) || islamCourses[0];

  const playHifzRepeatLoop = (ayah: QuranAyah, loopsLeft: number) => {
    if (hifzAudioRef.current) hifzAudioRef.current.pause();
    const audio = new Audio(ayah.audioUrl);
    audio.playbackRate = 0.85;
    hifzAudioRef.current = audio;
    setPlayingHifzAudio(true);
    setRepeatCountLeft(loopsLeft);

    audio.onended = () => {
      if (loopsLeft > 1) {
        playHifzRepeatLoop(ayah, loopsLeft - 1);
      } else {
        setPlayingHifzAudio(false);
        setRepeatCountLeft(0);
      }
    };
    audio.onerror = () => {
      setPlayingHifzAudio(false);
      setRepeatCountLeft(0);
    };
    audio.play().catch(() => {
      setPlayingHifzAudio(false);
    });
  };

  const toggleHifzAudio = () => {
    if (!currentHifzAyah) return;
    if (playingHifzAudio && hifzAudioRef.current) {
      hifzAudioRef.current.pause();
      setPlayingHifzAudio(false);
      setRepeatCountLeft(0);
      return;
    }
    playHifzRepeatLoop(currentHifzAyah, repeatTarget);
  };

  const toggleHifzMicTest = async () => {
    if (!currentHifzAyah) return;
    if (hifzRecState === 'recording' && hifzRecorderRef.current) {
      setHifzRecState('checking');
      try {
        const { blob } = await hifzRecorderRef.current.stop();
        hifzRecorderRef.current = null;
        const wav = await convertBlobToWav(blob);
        const fd = new FormData();
        fd.append('audio', wav.wavBlob, 'hifz-test.wav');
        fd.append('mimeType', wav.mimeType);
        fd.append('verseKey', currentHifzAyah.verseKey);
        fd.append('expectedArabic', currentHifzAyah.arabicUthmani);
        fd.append('audioDurationSec', String(wav.durationSec || 2));
        fd.append('estimatedSnrDb', String(wav.estimatedSnrDb));
        const res = await fetch('/api/tilawat/assess', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.assessment) {
          setHifzAssessment(data.assessment);
          if (data.assessment.overallState === 'Ready to advance') {
            setMemorizedKeys((prev) => ({ ...prev, [currentHifzAyah.verseKey]: true }));
          }
          if (data.assessment.pakistaniUrduCoachSummary) {
            void playInlineUrduSpeech(data.assessment.pakistaniUrduCoachSummary);
          }
        }
      } finally {
        setHifzRecState('idle');
      }
      return;
    }

    try {
      const rec = new MicrophoneRecorder();
      hifzRecorderRef.current = rec;
      setHifzRecState('recording');
      await rec.start({ autoStopOnSilence: false });
    } catch {
      setHifzRecState('idle');
    }
  };

  const handleAskKidsUstaad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kidsQuestion.trim() || askingKids) return;
    setAskingKids(true);
    try {
      const res = await fetch('/api/kids/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: kidsQuestion.trim() }),
      });
      const data = await res.json();
      if (data.answer) {
        setKidsAnswer(data.answer);
        void playInlineUrduSpeech(data.answer);
      }
    } finally {
      setAskingKids(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-[1440px] px-5 py-6 space-y-6"
    >
      {/* Header Banner with Clear 6-Step Journey */}
      <div className="modern-panel rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <motion.svg
              width="44"
              height="44"
              viewBox="0 0 48 48"
              className="shrink-0 text-[var(--color-gold-soft)]"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            >
              <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
              <polygon
                points="24,5 29,19 43,24 29,29 24,43 19,29 5,24 19,19"
                fill="none"
                stroke="var(--color-emerald)"
                strokeWidth="1.4"
              />
            </motion.svg>
            <div dir="rtl" lang="ur" className="text-right">
              <h1 className="font-urdu-heavy text-2xl sm:text-3xl text-[var(--color-ink)]">
                بچوں کا مکمل اسلامی نصاب (قدم بہ قدم)
              </h1>
              <p className="mt-1 text-sm font-urdu text-[var(--color-ink-muted)]">
                ۱۔ نورانی قاعدہ ← ۲۔ ۶ کلمے ← ۳۔ وضو ← ۴۔ مکمل نماز ← ۵۔ حفظِ قرآن ← ۶۔ سنتِ نبوی ﷺ و اخلاق (ہر قدم اردو آواز کے ساتھ)۔
              </p>
            </div>
          </div>

          {onOpenVideosTab && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onOpenVideosTab}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-gold)]/50 bg-[var(--color-gold)]/15 px-4 py-2 text-xs font-urdu font-bold text-[var(--color-gold-soft)] hover:bg-[var(--color-gold)]/25 whitespace-nowrap shrink-0"
            >
              <Film className="h-4 w-4" aria-hidden="true" />
              بچوں کی اسلامی کارٹون ویڈیوز دیکھیں ←
            </motion.button>
          )}
        </div>

        {/* 6 Clear Stepper Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" dir="rtl" lang="ur">
          {(
            [
              { id: 'qaida', step: 'قدم ۱', label: 'نورانی قاعدہ (۲۹ حروف)', icon: BookOpen },
              { id: 'kalimas', step: 'قدم ۲', label: '۶ کلمے (عربی و اردو)', icon: ShieldCheck },
              { id: 'wudu', step: 'قدم ۳', label: 'وضو کا طریقہ (۹ قدم)', icon: Droplets },
              { id: 'namaz', step: 'قدم ۴', label: 'مکمل نماز (۱۴ قدم)', icon: Sparkles },
              { id: 'hifz', step: 'قدم ۵', label: 'حفظِ قرآن ٹرینر', icon: Repeat },
              { id: 'sunnah', step: 'قدم ۶', label: 'سنتِ نبوی ﷺ و اخلاق', icon: Sun },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeStep === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => {
                  stopInlineUrduSpeech();
                  setActiveStep(tab.id);
                }}
                className={`flex flex-col items-start rounded-xl border p-3.5 text-right transition-colors ${
                  active
                    ? 'border-[var(--color-emerald)] bg-gradient-to-br from-[var(--color-emerald-deep)] to-[#059669] text-white shadow-md'
                    : 'modern-card text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                <div className="flex w-full items-center justify-between text-[11px] font-urdu opacity-90">
                  <span>{tab.step}</span>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div className="mt-1 text-xs font-urdu font-bold">{tab.label}</div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* STEP 1: NOORANI QAIDA (ALL 29 LETTERS + HARAKAT + TAJWEED) */}
      {activeStep === 'qaida' && (
        <div className="space-y-5" dir="rtl" lang="ur">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {qaidaLessons.map((lesson, idx) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => {
                  setActiveQaidaIdx(idx);
                  if (lesson.items[0]) setSelectedQaidaLetter(lesson.items[0]);
                }}
                className={`rounded-xl border p-3.5 text-right transition-colors ${
                  idx === activeQaidaIdx
                    ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)] text-white'
                    : 'border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] text-[var(--color-ink)] hover:border-[var(--color-emerald)]/40'
                }`}
              >
                <div className="text-[11px] opacity-85">{lesson.levelUrdu}</div>
                <div className="mt-1 text-xs font-semibold">{lesson.titleUrdu}</div>
              </button>
            ))}
          </div>

          {activeQaida && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Clickable Arabic Alphabet / Qaida Tiles */}
              <div className="lg:col-span-8 modern-panel rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-hairline)] pb-3">
                  <div className="text-right">
                    <h2 className="font-urdu-heavy text-xl text-[var(--color-ink)]">
                      {activeQaida.titleUrdu}
                    </h2>
                    <p className="text-sm font-urdu text-[var(--color-ink-muted)] mt-0.5">{activeQaida.descriptionUrdu}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
                  {activeQaida.items.map((item) => {
                    const isSel = selectedQaidaLetter?.arabic === item.arabic;
                    return (
                      <motion.button
                        key={item.arabic}
                        whileHover={{ y: -2, scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => {
                          setSelectedQaidaLetter(item);
                          void playInlineUrduSpeech(`${item.titleUrdu}۔ ${item.howToReadUrdu}`);
                        }}
                        className={`flex flex-col items-center justify-center rounded-xl border p-3.5 transition-colors ${
                          isSel
                            ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)]/25 ring-1 ring-[var(--color-emerald)]'
                            : 'modern-card'
                        }`}
                      >
                        <span className="font-arabic text-3xl text-[var(--color-ink)] leading-tight">
                          {item.arabic}
                        </span>
                        <span className="mt-1.5 text-xs font-urdu font-bold text-[var(--color-gold-soft)]">
                          {item.titleUrdu}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Active Letter Makhraj Coach Card */}
              <aside className="lg:col-span-4 modern-panel rounded-2xl p-5 space-y-4 text-right">
                {selectedQaidaLetter ? (
                  <>
                    <div className="flex items-center justify-between border-b border-[var(--color-border-hairline)] pb-3">
                      <div>
                        <div className="text-xs text-[var(--color-gold-soft)]">منتخب حرف / سبق</div>
                        <h3 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                          {selectedQaidaLetter.titleUrdu}
                        </h3>
                      </div>
                      <span className="font-arabic text-5xl text-[var(--color-emerald)]">
                        {selectedQaidaLetter.arabic}
                      </span>
                    </div>

                    <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4 space-y-2">
                      <div className="text-xs font-semibold text-[var(--color-gold-soft)]">پڑھنے کا صحیح طریقہ (مخرج)</div>
                      <p className="text-sm text-[var(--color-ink)] leading-loose">
                        {selectedQaidaLetter.howToReadUrdu}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void playInlineUrduSpeech(`${selectedQaidaLetter.titleUrdu}۔ ${selectedQaidaLetter.howToReadUrdu}`)
                      }
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-4 py-2.5 text-xs font-medium text-white"
                    >
                      <Volume2 className="h-4 w-4" aria-hidden="true" />
                      حرف اور مخرج دوبارہ سنیں (اردو آواز)
                    </button>
                  </>
                ) : null}
              </aside>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: ALL 6 KALIMAS (STEP 1 TO 6) */}
      {activeStep === 'kalimas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start" dir="rtl" lang="ur">
          <aside className="lg:col-span-4 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4 space-y-2">
            <div className="text-sm font-semibold text-[var(--color-gold-soft)] mb-2">
              ۶ کلمے — ترتیب وار یاد کریں
            </div>
            {sixKalimas.map((k, idx) => (
              <button
                key={k.number}
                type="button"
                onClick={() => setActiveKalimaIdx(idx)}
                className={`w-full rounded-lg border p-3 text-right transition-colors ${
                  idx === activeKalimaIdx
                    ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)]/20'
                    : 'border-[var(--color-border-hairline)] bg-[var(--color-navy)] hover:border-[var(--color-emerald)]/40'
                }`}
              >
                <div className="text-xs font-semibold text-[var(--color-ink)]">{k.titleUrdu}</div>
                <div className="text-[11px] text-[var(--color-ink-muted)] mt-0.5">{k.subtitleUrdu}</div>
              </button>
            ))}
          </aside>

          <div className="lg:col-span-8 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-6 space-y-5 text-right">
            {activeKalima && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-hairline)] pb-4">
                  <div>
                    <span className="text-xs font-mono text-[var(--color-gold-soft)]">
                      کلمہ نمبر {activeKalima.number} / 6
                    </span>
                    <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                      {activeKalima.titleUrdu}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void playInlineUrduSpeech(
                        `${activeKalima.titleUrdu}۔ عربی: ${activeKalima.arabicText}۔ اردو ترجمہ: ${activeKalima.urduTranslation}۔ ${activeKalima.childExplanationUrdu}`
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-4 py-2 text-xs font-medium text-white"
                  >
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                    عربی اور اردو سنیں
                  </button>
                </div>

                <div className="rounded-xl border border-[var(--color-gold)]/30 bg-[var(--color-navy)] p-6 text-center space-y-4">
                  <p dir="rtl" lang="ar" className="font-arabic text-3xl sm:text-4xl leading-loose text-[var(--color-ink)]">
                    {activeKalima.arabicText}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4">
                    <div className="text-xs font-semibold text-[var(--color-emerald)]">اردو ترجمہ</div>
                    <p className="mt-1 text-base text-[var(--color-ink)] leading-loose">
                      {activeKalima.urduTranslation}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-emerald)]/30 bg-[var(--color-emerald-deep)]/10 p-4">
                    <div className="text-xs font-semibold text-[var(--color-gold-soft)]">بچوں کے لیے آسان مطلب</div>
                    <p className="mt-1 text-sm text-[var(--color-ink)] leading-loose">
                      {activeKalima.childExplanationUrdu}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-hairline)] text-xs">
                  <button
                    type="button"
                    disabled={activeKalimaIdx <= 0}
                    onClick={() => setActiveKalimaIdx((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 disabled:opacity-40"
                  >
                    <ChevronRight className="h-3.5 w-3.5" /> پچھلا کلمہ
                  </button>
                  <button
                    type="button"
                    disabled={activeKalimaIdx >= sixKalimas.length - 1}
                    onClick={() => setActiveKalimaIdx((i) => Math.min(sixKalimas.length - 1, i + 1))}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--color-emerald-deep)] px-3 py-2 text-white disabled:opacity-40"
                  >
                    اگلا کلمہ <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: WUDU STEP-BY-STEP (STEPS 1-9) */}
      {activeStep === 'wudu' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start" dir="rtl" lang="ur">
          <aside className="lg:col-span-4 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4 space-y-2">
            <div className="text-sm font-semibold text-[var(--color-gold-soft)] mb-2">
              وضو کے ۹ آسان مراحل (ترتیب وار)
            </div>
            {wuduSteps.map((st, idx) => (
              <button
                key={st.stepNumber}
                type="button"
                onClick={() => setActiveWuduIdx(idx)}
                className={`w-full flex items-center justify-between rounded-lg border p-3 text-right transition-colors ${
                  idx === activeWuduIdx
                    ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)]/20'
                    : 'border-[var(--color-border-hairline)] bg-[var(--color-navy)] hover:border-[var(--color-emerald)]/40'
                }`}
              >
                <span className="text-xs font-medium text-[var(--color-ink)]">
                  {st.stepNumber}. {st.titleUrdu}
                </span>
                {st.isFarz && (
                  <span className="text-[10px] font-semibold text-[var(--color-gold-soft)] shrink-0 mr-2">
                    فرض
                  </span>
                )}
              </button>
            ))}
          </aside>

          <div className="lg:col-span-8 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-6 space-y-5 text-right">
            {activeWudu && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-hairline)] pb-4">
                  <div>
                    <div className="text-xs text-[var(--color-gold-soft)]">
                      مرحلہ {activeWudu.stepNumber} / {wuduSteps.length} {activeWudu.isFarz ? '· وضو کا فرض رکن' : '· سنتِ نبوی ﷺ'}
                    </div>
                    <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                      {activeWudu.titleUrdu}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void playInlineUrduSpeech(
                        `مرحلہ ${activeWudu.stepNumber}: ${activeWudu.titleUrdu}۔ ${activeWudu.instructionUrdu}۔ ${activeWudu.tipUrdu}`
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-4 py-2 text-xs font-medium text-white"
                  >
                    <Volume2 className="h-4 w-4" /> آواز میں سنیں
                  </button>
                </div>

                {activeWudu.arabicDua && (
                  <div className="rounded-xl border border-[var(--color-gold)]/30 bg-[var(--color-navy)] p-5 text-center">
                    <p dir="rtl" lang="ar" className="font-arabic text-3xl leading-loose text-[var(--color-emerald)]">
                      {activeWudu.arabicDua}
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4 space-y-2">
                  <div className="text-xs font-semibold text-[var(--color-emerald)]">عمل کرنے کا طریقہ</div>
                  <p className="text-base text-[var(--color-ink)] leading-loose">{activeWudu.instructionUrdu}</p>
                </div>

                <div className="rounded-lg border border-[var(--color-emerald)]/30 bg-[var(--color-emerald-deep)]/10 p-4">
                  <div className="text-xs font-semibold text-[var(--color-gold-soft)]">پیاری نصیحت</div>
                  <p className="mt-1 text-sm text-[var(--color-ink)] leading-loose">{activeWudu.tipUrdu}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-hairline)] text-xs">
                  <button
                    type="button"
                    disabled={activeWuduIdx <= 0}
                    onClick={() => setActiveWuduIdx((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 disabled:opacity-40"
                  >
                    <ChevronRight className="h-3.5 w-3.5" /> پچھلا مرحلہ
                  </button>
                  <button
                    type="button"
                    disabled={activeWuduIdx >= wuduSteps.length - 1}
                    onClick={() => setActiveWuduIdx((i) => Math.min(wuduSteps.length - 1, i + 1))}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--color-emerald-deep)] px-3 py-2 text-white disabled:opacity-40"
                  >
                    اگلا مرحلہ <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: COMPLETE NAMAZ STEP-BY-STEP (14 STEPS + 5 PRAYERS RAKAT TABLE) */}
      {activeStep === 'namaz' && (
        <div className="space-y-6" dir="rtl" lang="ur">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <aside className="lg:col-span-4 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4 space-y-1.5 max-h-[560px] overflow-y-auto">
              <div className="text-sm font-semibold text-[var(--color-gold-soft)] mb-2">
                مکمل نماز نیت سے سلام تک (۱۴ قدم)
              </div>
              {namazSteps.map((st, idx) => (
                <button
                  key={st.stepNumber}
                  type="button"
                  onClick={() => setActiveNamazIdx(idx)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-right text-xs transition-colors ${
                    idx === activeNamazIdx
                      ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)]/20 text-[var(--color-ink)] font-semibold'
                      : 'border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-ink-muted)] hover:border-[var(--color-emerald)]/40'
                  }`}
                >
                  {st.stepNumber}. {st.titleUrdu}
                </button>
              ))}
            </aside>

            <div className="lg:col-span-8 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-6 space-y-5 text-right">
              {activeNamaz && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-hairline)] pb-4">
                    <div>
                      <div className="text-xs text-[var(--color-gold-soft)]">
                        نماز کا مرحلہ {activeNamaz.stepNumber} / {namazSteps.length}
                      </div>
                      <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                        {activeNamaz.titleUrdu}
                      </h2>
                      <p className="text-xs text-[var(--color-emerald)] mt-1">
                        کھڑے / بیٹھنے کا انداز: {activeNamaz.postureUrdu}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void playInlineUrduSpeech(
                          `مرحلہ ${activeNamaz.stepNumber}: ${activeNamaz.titleUrdu}۔ ${activeNamaz.postureUrdu}۔ عربی: ${activeNamaz.arabicText}۔ ترجمہ: ${activeNamaz.urduTranslation}۔ ${activeNamaz.howToDoUrdu}`
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-4 py-2 text-xs font-medium text-white"
                    >
                      <Volume2 className="h-4 w-4" /> آواز میں سیکھیں
                    </button>
                  </div>

                  <div className="rounded-xl border border-[var(--color-gold)]/30 bg-[var(--color-navy)] p-5 text-center">
                    <p dir="rtl" lang="ar" className="font-arabic text-2xl sm:text-3xl leading-loose text-[var(--color-ink)]">
                      {activeNamaz.arabicText}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4">
                      <div className="text-xs font-semibold text-[var(--color-emerald)]">اردو ترجمہ</div>
                      <p className="mt-1 text-sm text-[var(--color-ink)] leading-loose">
                        {activeNamaz.urduTranslation}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4">
                      <div className="text-xs font-semibold text-[var(--color-gold-soft)]">کیسے ادا کریں</div>
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)] leading-loose">
                        {activeNamaz.howToDoUrdu}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-hairline)] text-xs">
                    <button
                      type="button"
                      disabled={activeNamazIdx <= 0}
                      onClick={() => setActiveNamazIdx((i) => Math.max(0, i - 1))}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 disabled:opacity-40"
                    >
                      <ChevronRight className="h-3.5 w-3.5" /> پچھلا قدم
                    </button>
                    <button
                      type="button"
                      disabled={activeNamazIdx >= namazSteps.length - 1}
                      onClick={() => setActiveNamazIdx((i) => Math.min(namazSteps.length - 1, i + 1))}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--color-emerald-deep)] px-3 py-2 text-white disabled:opacity-40"
                    >
                      اگلا قدم <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 5 Daily Prayers Rak'at Breakdown */}
          {namazRakats.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-3">
              <h3 className="font-display text-xl font-semibold text-[var(--color-gold-soft)]">
                پانچ وقت کی نمازوں کی رکعتوں کا مکمل چارٹ
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {namazRakats.map((row) => (
                  <div
                    key={row.prayerNameUrdu}
                    className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3.5 space-y-1.5"
                  >
                    <div className="text-xs font-semibold text-[var(--color-emerald)]">{row.prayerNameUrdu}</div>
                    <div className="text-[11px] text-[var(--color-ink-subtle)]">{row.timeUrdu}</div>
                    <div className="text-xs text-[var(--color-ink)] font-medium pt-1">{row.rakatBreakdownUrdu}</div>
                    <div className="text-[11px] text-[var(--color-gold-soft)]">کل رکعات: {row.totalRakats}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 5: INTERACTIVE HIFZ TRAINER */}
      {activeStep === 'hifz' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <aside className="lg:col-span-4 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4 space-y-3">
            <div dir="rtl" className="text-sm font-semibold text-[var(--color-gold-soft)] text-right">
              حفظِ قرآن کی سورت منتخب کریں
            </div>
            <div className="space-y-2">
              {hifzPresets.map((sp) => (
                <button
                  key={sp.surahNumber}
                  type="button"
                  onClick={() => setSelectedHifzSurah(sp.surahNumber)}
                  dir="rtl"
                  className={`w-full rounded-lg border p-3 text-right transition-colors ${
                    selectedHifzSurah === sp.surahNumber
                      ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)]/20'
                      : 'border-[var(--color-border-hairline)] bg-[var(--color-navy)] hover:border-[var(--color-emerald)]/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-ink)]">{sp.nameUrdu}</span>
                    <span className="font-arabic text-lg text-[var(--color-gold-soft)]">{sp.nameArabic}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">{sp.virtueUrdu}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="lg:col-span-8 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-6 space-y-5">
            {currentHifzAyah && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-hairline)] pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums text-[var(--color-gold-soft)]">
                      آیت {currentHifzAyah.verseKey} ({activeAyahIdx + 1}/{hifzAyahs.length})
                    </span>
                    {memorizedKeys[currentHifzAyah.verseKey] && (
                      <span className="inline-flex items-center gap-1 text-[var(--color-emerald)] font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> یاد ہو گئی!
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setHideWordsForMemory((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-1.5 text-[var(--color-ink)]"
                  >
                    {hideWordsForMemory ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {hideWordsForMemory ? 'آیت دکھائیں' : 'یادداشت ٹیسٹ (الفاظ چھپائیں)'}
                  </button>
                </div>

                <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-6 text-center space-y-4">
                  <p
                    dir="rtl"
                    lang="ar"
                    className={`font-arabic text-3xl sm:text-4xl leading-loose transition-all ${
                      hideWordsForMemory ? 'blur-md select-none opacity-30' : 'text-[var(--color-ink)]'
                    }`}
                  >
                    {currentHifzAyah.arabicUthmani}
                  </p>
                  <p dir="rtl" lang="ur" className="text-base text-[var(--color-ink-muted)] leading-loose">
                    {currentHifzAyah.urduTranslation}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={toggleHifzAudio}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-4 py-2.5 font-medium text-white"
                    >
                      {playingHifzAudio ? <Pause className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                      {playingHifzAudio
                        ? `دہرایا جا رہا ہے (${repeatCountLeft} باقی)`
                        : `${repeatTarget} بار سنیں اور ساتھ پڑھیں`}
                    </button>

                    {[1, 3, 5, 7].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setRepeatTarget(cnt)}
                        className={`rounded-md px-2.5 py-2 font-mono tabular-nums ${
                          repeatTarget === cnt
                            ? 'bg-[var(--color-emerald)] text-slate-950 font-semibold'
                            : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-ink-muted)]'
                        }`}
                      >
                        {cnt}x
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void toggleHifzMicTest()}
                    disabled={hifzRecState === 'checking'}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium text-white ${
                      hifzRecState === 'recording' ? 'bg-[#B91C1C]' : 'bg-[var(--color-navy-elevated)] border border-[var(--color-emerald)]/40'
                    }`}
                  >
                    {hifzRecState === 'recording' ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4 text-[var(--color-emerald)]" />}
                    {hifzRecState === 'recording'
                      ? 'سنا کر بٹن دبائیں'
                      : hifzRecState === 'checking'
                        ? 'استاد حفظ چیک کر رہے ہیں…'
                        : 'زبانی سنائیں (مائیک ٹیسٹ)'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-hairline)] pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {hifzAyahs.map((a, idx) => (
                      <button
                        key={a.verseKey}
                        type="button"
                        onClick={() => {
                          setActiveAyahIdx(idx);
                          setHifzAssessment(null);
                        }}
                        className={`rounded px-2.5 py-1 text-xs font-mono tabular-nums ${
                          idx === activeAyahIdx
                            ? 'bg-[var(--color-emerald-deep)] text-white'
                            : memorizedKeys[a.verseKey]
                              ? 'border border-[var(--color-emerald)] text-[var(--color-emerald)]'
                              : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-ink-muted)]'
                        }`}
                      >
                        {a.ayahNumber}
                      </button>
                    ))}
                  </div>
                </div>

                {hifzAssessment && (
                  <div dir="rtl" lang="ur" className="rounded-lg border border-[var(--color-emerald)]/40 bg-[var(--color-navy)] p-4 text-right space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--color-emerald)]">حفظ و تجوید استاد کی رپورٹ</span>
                      <button
                        type="button"
                        onClick={() => void playInlineUrduSpeech(hifzAssessment.pakistaniUrduCoachSummary)}
                        className="inline-flex items-center gap-1 text-[var(--color-emerald)] hover:underline"
                      >
                        <Volume2 className="h-3.5 w-3.5" /> دوبارہ سنیں
                      </button>
                    </div>
                    <p className="text-sm text-[var(--color-ink)] leading-loose">
                      {hifzAssessment.pakistaniUrduCoachSummary}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP 6: SUNNAH, MORAL CHARACTER & LOVING KIDS USTAAD */}
      {activeStep === 'sunnah' && (
        <div className="space-y-6" dir="rtl" lang="ur">
          {/* Beginner to Advance Heart Curriculum */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold text-[var(--color-gold-soft)]">
                حصہ اول: اللہ اور اسلام سے سچی محبت (ابتدائی تا اعلیٰ)
              </h2>
              <div className="flex flex-wrap gap-2">
                {(['ابتدائی', 'درمیانی', 'اعلیٰ'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevel(lvl)}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${
                      selectedLevel === lvl
                        ? 'bg-[var(--color-emerald-deep)] text-white'
                        : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] text-[var(--color-ink-muted)]'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {activeCourse && (
              <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-4 text-right">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                      {activeCourse.titleUrdu}
                    </h3>
                    <p className="text-xs text-[var(--color-gold-soft)]">{activeCourse.subtitleUrdu}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void playInlineUrduSpeech(`${activeCourse.titleUrdu}۔ ${activeCourse.heartLoveNoteUrdu}`)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-emerald-deep)] px-3.5 py-2 text-xs font-medium text-white"
                  >
                    <Heart className="h-3.5 w-3.5" /> آواز میں سنیں
                  </button>
                </div>
                <p className="rounded-lg border border-[var(--color-emerald)]/30 bg-[var(--color-emerald-deep)]/10 p-3.5 text-sm leading-loose text-[var(--color-ink)]">
                  {activeCourse.heartLoveNoteUrdu}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeCourse.steps.map((st, idx) => (
                    <div key={idx} className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4 space-y-2">
                      <div className="font-semibold text-sm text-[var(--color-emerald)]">{st.stepTitleUrdu}</div>
                      {st.arabicText && (
                        <p dir="rtl" lang="ar" className="font-arabic text-xl text-[var(--color-ink)]">
                          {st.arabicText}
                        </p>
                      )}
                      {st.urduTranslation && <p className="text-xs text-[var(--color-ink)]">{st.urduTranslation}</p>}
                      <p className="text-xs text-[var(--color-ink-muted)] leading-loose">{st.howToPracticeUrdu}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Prophetic Daily Sunnahs */}
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-[var(--color-gold-soft)]">
              حصہ دوم: صبح سے رات تک پیارے نبی ﷺ کی سنتیں اور مسنون دعائیں
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
              {sunnahList.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-gold-soft)]">{item.timeOfDayUrdu}</span>
                    <button
                      type="button"
                      onClick={() =>
                        void playInlineUrduSpeech(
                          `${item.titleUrdu}۔ ${item.whenProphetDidUrdu}۔ دعا کا ترجمہ: ${item.urduTranslation}۔ ${item.practicalStepUrdu}`
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1 text-xs text-[var(--color-emerald)]"
                    >
                      <Volume2 className="h-3.5 w-3.5" /> سنیں (اردو)
                    </button>
                  </div>
                  <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">{item.titleUrdu}</h3>
                  <p className="text-xs text-[var(--color-ink-muted)] leading-loose">{item.whenProphetDidUrdu}</p>
                  <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3 space-y-1.5">
                    <p dir="rtl" lang="ar" className="font-arabic text-2xl text-[var(--color-emerald)] leading-loose">
                      {item.arabicDua}
                    </p>
                    <p className="text-xs text-[var(--color-ink)] leading-loose">{item.urduTranslation}</p>
                  </div>
                  <p className="text-xs text-[var(--color-ink-muted)] leading-loose">
                    <strong>آج کا عمل:</strong> {item.practicalStepUrdu}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Kids Loving Ustaad Q&A */}
          <div className="modern-panel rounded-2xl p-5 space-y-3 text-right">
            <div className="text-sm font-urdu-heavy text-[var(--color-emerald)]">
              بچوں کا پیارا استاد — کوئی بھی سوال پوچھیں (جواب اردو تحریر اور آواز میں)
            </div>
            <form onSubmit={handleAskKidsUstaad} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={kidsQuestion}
                onChange={(e) => setKidsQuestion(e.target.value)}
                placeholder="مثلاً: ہم پانچ وقت نماز کیوں پڑھتے ہیں؟ وضو ٹوٹنے کی کیا وجوہات ہیں؟"
                className="flex-1 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-4 py-2.5 text-xs font-urdu text-[var(--color-ink)]"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={askingKids || !kidsQuestion.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-emerald-deep)] px-5 py-2.5 text-xs font-urdu font-bold text-white disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {askingKids ? 'جواب آ رہا ہے…' : 'استاد سے پوچھیں'}
              </motion.button>
            </form>
            {kidsAnswer && (
              <div className="modern-card rounded-xl p-4 text-sm font-urdu leading-loose text-[var(--color-ink)]">
                {kidsAnswer}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.section>
  );
};
