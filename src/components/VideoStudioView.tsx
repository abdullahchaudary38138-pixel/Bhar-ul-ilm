import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Film,
  Play,
  Pause,
  SkipForward,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Upload,
  Link as LinkIcon,
  Search,
  Video,
  CheckCircle2,
  ExternalLink,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { playInlineUrduSpeech, stopInlineUrduSpeech } from '../utils/ttsPlayer.ts';
import type { KidsStoryEpisode, VerificationReport, WebSourceCitation } from '../types.ts';

type VideoMode = 'cinema' | 'analyze_search';

const SPECIAL_DEEP_TOPICS = [
  'واقعہ معراجِ نبوی ﷺ اور آسمانوں کی سیر (مکمل روحانی و ایمانی گہرائی)',
  'حضرت یوسفؑ کا صبر، تقویٰ، قید اور مصر کی بادشاہت کا عظیم درس',
  'غارِ حرا میں پہلی وحی، نبی ﷺ کی عظمت اور دینِ حق کی دعوت',
  'والدین کی خدمت اور جنت کا دروازہ (قرآن و حدیث کی روشنی میں)',
  'نماز کا نور، اللہ سے براہِ راست ملاقات اور خشوع و خضوع',
  'آخرت کی تیاری، قبر کی روشنی اور اللہ کی بے انتہا رحمت',
];

function formatCountdown(isoTarget: string): string {
  const diff = Math.max(0, new Date(isoTarget).getTime() - Date.now());
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface CanvasParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
  hue: 'gold' | 'emerald' | 'star';
}

const CanvasMotionOverlay: React.FC<{ playing: boolean; sceneKey: string }> = ({ playing, sceneKey }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: CanvasParticle[] = Array.from({ length: 44 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0005,
      vy: -(0.0004 + Math.random() * 0.0012),
      radius: i % 5 === 0 ? 3.2 : 1.2 + Math.random() * 2.0,
      alpha: 0.25 + Math.random() * 0.65,
      phase: Math.random() * Math.PI * 2,
      hue: i % 3 === 0 ? 'gold' : i % 3 === 1 ? 'emerald' : 'star',
    }));

    let rafId = 0;
    let tick = 0;

    const render = () => {
      const w = canvas.clientWidth || 960;
      const h = canvas.clientHeight || 540;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);
      tick += playing ? 0.032 : 0.008;

      // Ambient celestial golden-emerald atmospheric glow at top
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.18, 10, w * 0.5, h * 0.35, w * 0.65);
      grad.addColorStop(0, playing ? 'rgba(245, 200, 107, 0.14)' : 'rgba(245, 200, 107, 0.05)');
      grad.addColorStop(0.55, playing ? 'rgba(16, 185, 129, 0.09)' : 'rgba(16, 185, 129, 0.03)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Animated subtle Islamic 8-point celestial shimmer ring when playing
      if (playing) {
        ctx.save();
        ctx.translate(w * 0.5, h * 0.34);
        ctx.rotate(tick * 0.12);
        ctx.strokeStyle = 'rgba(245, 200, 107, 0.14)';
        ctx.lineWidth = 1.2;
        const size = Math.min(w, h) * 0.22;
        ctx.strokeRect(-size, -size, size * 2, size * 2);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.16)';
        ctx.strokeRect(-size, -size, size * 2, size * 2);
        ctx.restore();
      }

      // Drifting lanterns, golden light motes & twinkling stars
      for (const p of particles) {
        if (playing) {
          p.x += p.vx;
          p.y += p.vy;
        } else {
          p.x += p.vx * 0.2;
          p.y += p.vy * 0.15;
        }
        if (p.y < -0.05) p.y = 1.05;
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;

        const twinkle = 0.5 + 0.5 * Math.sin(tick * 1.4 + p.phase);
        const px = p.x * w;
        const py = p.y * h;
        const a = p.alpha * twinkle * (playing ? 1 : 0.45);

        ctx.beginPath();
        ctx.arc(px, py, p.radius * (playing ? 1 + twinkle * 0.35 : 0.85), 0, Math.PI * 2);
        if (p.hue === 'gold') {
          ctx.fillStyle = `rgba(245, 200, 107, ${a})`;
        } else if (p.hue === 'emerald') {
          ctx.fillStyle = `rgba(52, 211, 153, ${a})`;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.85})`;
        }
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, [playing, sceneKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
};

export const VideoStudioView: React.FC = () => {
  const [mode, setMode] = useState<VideoMode>('cinema');

  // Mode 1: Animated Special-Topic Cinema + 7h Auto Playlist
  const [episodes, setEpisodes] = useState<KidsStoryEpisode[]>([]);
  const [nextAutoAt, setNextAutoAt] = useState<string>(new Date(Date.now() + 7 * 3600000).toISOString());
  const [countdownText, setCountdownText] = useState<string>('07:00:00');
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState<number>(0);
  const [activeSceneIdx, setActiveSceneIdx] = useState<number>(0);
  const [cinemaPlaying, setCinemaPlaying] = useState<boolean>(false);
  const [isTheaterExpanded, setIsTheaterExpanded] = useState<boolean>(false);
  const [customTopic, setCustomTopic] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const cinemaPlayingRef = useRef<boolean>(false);

  // Mode 2: Video Upload / Link Analyzer + Islamic Video Search
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoLink, setVideoLink] = useState<string>('');
  const [videoQuestion, setVideoQuestion] = useState<string>('');
  const [analyzingVideo, setAnalyzingVideo] = useState<boolean>(false);
  const [videoReport, setVideoReport] = useState<VerificationReport | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchingOnline, setSearchingOnline] = useState<boolean>(false);
  const [onlineAnswer, setOnlineAnswer] = useState<string>('');
  const [onlineSources, setOnlineSources] = useState<WebSourceCitation[]>([]);

  useEffect(() => {
    cinemaPlayingRef.current = cinemaPlaying;
  }, [cinemaPlaying]);

  useEffect(() => {
    fetch('/api/kids/stories')
      .then((r) => r.json())
      .then((data) => {
        setEpisodes(data.episodes || []);
        if (data.nextAutoGenerateAt) setNextAutoAt(data.nextAutoGenerateAt);
      })
      .catch(() => {});

    const poll = window.setInterval(() => {
      fetch('/api/kids/stories')
        .then((r) => r.json())
        .then((data) => {
          if (data.episodes) setEpisodes(data.episodes);
          if (data.nextAutoGenerateAt) setNextAutoAt(data.nextAutoGenerateAt);
        })
        .catch(() => {});
    }, 60 * 1000);

    return () => {
      window.clearInterval(poll);
      stopInlineUrduSpeech();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCountdownText(formatCountdown(nextAutoAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [nextAutoAt]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  const activeEpisode = episodes[activeEpisodeIdx] || null;
  const activeScene = activeEpisode?.scenes[activeSceneIdx] || null;

  const playStoryScene = (ep: KidsStoryEpisode, sceneIndex: number) => {
    const sc = ep.scenes[sceneIndex];
    if (!sc) {
      setCinemaPlaying(false);
      return;
    }
    setActiveSceneIdx(sceneIndex);
    const fullNarration = `${sc.titleUrdu}۔ ${sc.narrationUrdu} ${sc.characterDialogueUrdu}`;
    void playInlineUrduSpeech(fullNarration, {
      onEnd: () => {
        if (!cinemaPlayingRef.current) return;
        if (sceneIndex + 1 < ep.scenes.length) {
          playStoryScene(ep, sceneIndex + 1);
        } else {
          setCinemaPlaying(false);
        }
      },
      onError: () => setCinemaPlaying(false),
    });
  };

  const toggleCinemaPlay = () => {
    if (!activeEpisode) return;
    if (cinemaPlaying) {
      setCinemaPlaying(false);
      cinemaPlayingRef.current = false;
      stopInlineUrduSpeech();
    } else {
      setCinemaPlaying(true);
      cinemaPlayingRef.current = true;
      playStoryScene(activeEpisode, activeSceneIdx);
    }
  };

  const handleGenerateEpisode = async (topicOverride?: string) => {
    if (generating) return;
    const topicToUse = (topicOverride ?? customTopic).trim() || undefined;
    setGenerating(true);
    setGenerateError(null);
    stopInlineUrduSpeech();
    setCinemaPlaying(false);

    try {
      const res = await fetch('/api/kids/stories/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicToUse }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'اینیمیٹڈ ویڈیو تیار کرنے میں مسئلہ پیش آیا۔');
      if (data.episodes) {
        setEpisodes(data.episodes);
        setActiveEpisodeIdx(0);
        setActiveSceneIdx(0);
        if (!topicOverride) setCustomTopic('');
      }
      if (data.nextAutoGenerateAt) setNextAutoAt(data.nextAutoGenerateAt);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'ویڈیو بناتے وقت خرابی آئی۔');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectVideoFile = (file: File | null) => {
    setVideoFile(file);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    if (file) {
      setVideoPreviewUrl(URL.createObjectURL(file));
    } else {
      setVideoPreviewUrl(null);
    }
  };

  const handleAnalyzeVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile && !videoLink.trim() && !videoQuestion.trim()) return;
    setAnalyzingVideo(true);
    setVideoError(null);
    setVideoReport(null);

    try {
      const fd = new FormData();
      fd.append('sourceTypeLabel', videoFile ? 'video_file' : 'video_link');
      if (videoFile) fd.append('file', videoFile);
      if (videoLink.trim()) fd.append('videoUrl', videoLink.trim());
      if (videoQuestion.trim()) fd.append('text', videoQuestion.trim());

      const res = await fetch('/api/verify', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ویڈیو کا تجزیہ مکمل نہ ہو سکا۔');
      setVideoReport(data.report);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'ویڈیو تجزیہ ناکام ہوا۔');
    } finally {
      setAnalyzingVideo(false);
    }
  };

  const handleSearchOnlineVideos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchingOnline) return;
    setSearchingOnline(true);
    try {
      const res = await fetch('/api/library/online-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `اسلامی ویڈیو، بیان یا سیرت لیکچر کے موضوع پر مستند اردو رہنمائی اور حوالہ جات: ${searchQuery.trim()}`,
        }),
      });
      const data = await res.json();
      if (data.answer) setOnlineAnswer(data.answer);
      if (data.webSources) setOnlineSources(data.webSources);
    } finally {
      setSearchingOnline(false);
    }
  };

  const sceneProgressPct =
    activeEpisode && activeEpisode.scenes.length > 0
      ? ((activeSceneIdx + 1) / activeEpisode.scenes.length) * 100
      : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-[1440px] px-5 py-6 space-y-6"
    >
      {/* Modern Glass Studio Header */}
      <div className="modern-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ scale: cinemaPlaying ? [1, 1.07, 1] : 1, rotate: cinemaPlaying ? [0, 3, -3, 0] : 0 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-gold)]/45 bg-[var(--color-navy)] text-[var(--color-gold-soft)] shadow-lg"
            >
              <Film className="h-7 w-7" aria-hidden="true" />
            </motion.div>
            <div dir="rtl" className="text-right">
              <h1 lang="ur" className="font-urdu-heavy text-2xl sm:text-3xl text-[var(--color-ink)]">
                مخصوص موضوعات و اسلامی اینیمیٹڈ ویڈیو اسٹوڈیو
              </h1>
              <p lang="ur" className="mt-1 text-sm text-[var(--color-ink-muted)]">
                گہرے دینی و تاریخی موضوعات پر ۴ مناظر والی اینیمیٹڈ ویڈیو، اردو آواز و سب ٹائٹلز، ۷ گھنٹے خودکار پلے لسٹ اور ویڈیو تجزیہ۔
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-1 text-xs">
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setMode('cinema')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-urdu font-bold whitespace-nowrap transition-colors ${
                mode === 'cinema'
                  ? 'bg-[var(--color-emerald-deep)] text-white shadow-sm'
                  : 'text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Film className="h-3.5 w-3.5" aria-hidden="true" />
              اینیمیٹڈ ویڈیو سنیما (7h خودکار)
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => {
                stopInlineUrduSpeech();
                setCinemaPlaying(false);
                setMode('analyze_search');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-urdu font-bold whitespace-nowrap transition-colors ${
                mode === 'analyze_search'
                  ? 'bg-[var(--color-emerald-deep)] text-white shadow-sm'
                  : 'text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Video className="h-3.5 w-3.5" aria-hidden="true" />
              ویڈیو اپلوڈ / لنک تجزیہ و سرچ
            </motion.button>
          </div>
        </div>
      </div>

      {/* MODE 1: ANIMATED SPECIAL-TOPIC CINEMA */}
      {mode === 'cinema' && (
        <div className="space-y-5">
          {/* Special Deep Topics Selector + 7h Auto-Scheduler Strip */}
          <div className="modern-panel rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div dir="rtl" lang="ur" className="flex items-center gap-2.5 text-sm text-right">
                <Clock className="h-4 w-4 text-[var(--color-gold-soft)] shrink-0" aria-hidden="true" />
                <span>
                  خودکار ویڈیو پلے لسٹ: ہر <strong>۷ گھنٹے</strong> بعد نئی قرآنی و اسلامی ویڈیو شامل ہوتی ہے · اگلی قسط:{' '}
                  <strong className="font-mono tabular-nums text-[var(--color-emerald)]">{countdownText}</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl justify-end">
                <input
                  type="text"
                  dir="auto"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="اپنا خاص موضوع لکھیں (مثلاً: واقعہ معراج، صبر، غارِ حرا)…"
                  className="flex-1 min-w-[220px] rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-4 py-2 text-xs font-urdu text-[var(--color-ink)] focus:border-[var(--color-emerald)] focus:outline-none"
                />
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => void handleGenerateEpisode()}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-emerald-deep)] to-[#059669] px-4 py-2 text-xs font-urdu font-bold text-white shadow-md disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {generating ? '۴ مناظر کی ویڈیو بن رہی ہے…' : 'نئی اینیمیٹڈ ویڈیو بنائیں'}
                </motion.button>
              </div>
            </div>

            {/* Curated Special Deep Topics */}
            <div dir="rtl" lang="ur" className="border-t border-[var(--color-border-hairline)] pt-3 space-y-2 text-right">
              <div className="text-xs font-urdu-heavy text-[var(--color-gold-soft)]">
                مخصوص گہرے موضوعات پر فوری ۴ مناظر والی اینیمیٹڈ ویڈیو بنائیں:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {SPECIAL_DEEP_TOPICS.map((topic) => (
                  <motion.button
                    key={topic}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    disabled={generating}
                    onClick={() => void handleGenerateEpisode(topic)}
                    className="modern-card rounded-xl px-3.5 py-2.5 text-right text-xs font-urdu font-bold text-[var(--color-ink)] disabled:opacity-50"
                  >
                    <span className="text-[var(--color-emerald)] ml-1.5">✦</span>
                    {topic}
                  </motion.button>
                ))}
              </div>
            </div>

            {generateError && (
              <div dir="rtl" lang="ur" className="rounded-xl border border-[#B91C1C]/40 bg-[#B91C1C]/15 p-3 text-xs font-urdu text-[var(--color-ink)] text-right">
                {generateError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT / FULL: 16:9 Multi-Layer Animated Motion Stage */}
            <div className={`${isTheaterExpanded ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-4`}>
              {activeEpisode && activeScene && (
                <>
                  <div className="relative aspect-video overflow-hidden rounded-2xl border border-[var(--color-gold)]/30 bg-slate-950 shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
                    {/* Parallax Ken Burns Layer */}
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={`${activeEpisode.id}-${activeScene.sceneNumber}`}
                        src={activeScene.imageUrl}
                        alt={activeScene.titleUrdu}
                        referrerPolicy="no-referrer"
                        initial={{ opacity: 0, scale: 1.04 }}
                        animate={{
                          opacity: 1,
                          scale: cinemaPlaying ? [1.02, 1.11, 1.04] : 1.02,
                          x: cinemaPlaying ? [0, -16, 12, 0] : 0,
                          y: cinemaPlaying ? [0, -8, 6, 0] : 0,
                        }}
                        exit={{ opacity: 0, scale: 1.06 }}
                        transition={{
                          opacity: { duration: 0.55 },
                          scale: { duration: 13, repeat: Infinity, ease: 'easeInOut' },
                          x: { duration: 14, repeat: Infinity, ease: 'easeInOut' },
                          y: { duration: 11, repeat: Infinity, ease: 'easeInOut' },
                        }}
                        className="h-full w-full object-cover"
                      />
                    </AnimatePresence>

                    {/* Live HTML5 Canvas Celestial Lights, Lanterns & Islamic Geometry Overlay */}
                    <CanvasMotionOverlay
                      playing={cinemaPlaying}
                      sceneKey={`${activeEpisode.id}-${activeScene.sceneNumber}`}
                    />

                    {/* Top Theater HUD Bar */}
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/75 via-black/30 to-transparent p-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => setIsTheaterExpanded((v) => !v)}
                        aria-label={isTheaterExpanded ? 'تھیٹر چھوٹا کریں' : 'پورا سنیما اسکرین کھولیں'}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/50 backdrop-blur-md px-3 py-1.5 text-xs font-urdu font-bold text-white hover:bg-black/75"
                      >
                        {isTheaterExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                        {isTheaterExpanded ? 'نارمل سائز' : 'بڑا اسکرین'}
                      </motion.button>

                      <div dir="rtl" lang="ur" className="rounded-lg border border-[var(--color-gold)]/40 bg-black/55 backdrop-blur-md px-3 py-1.5 text-xs font-urdu font-bold text-[var(--color-gold-soft)]">
                        {activeEpisode.titleUrdu}
                      </div>
                    </div>

                    {/* Bottom Scrim + Kinetic Urdu Narration & Dialogue */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-5 sm:p-6 space-y-3">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${activeEpisode.id}-${activeScene.sceneNumber}-sub`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.35 }}
                          dir="rtl"
                          lang="ur"
                          className="text-right space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs font-urdu font-bold text-[var(--color-gold-soft)]">
                            <span>
                              منظر {activeScene.sceneNumber} / {activeEpisode.scenes.length} · {activeScene.titleUrdu}
                            </span>
                          </div>
                          <p className="text-base sm:text-lg font-urdu font-bold text-white leading-loose drop-shadow">
                            {activeScene.narrationUrdu}
                          </p>
                          <p className="text-sm sm:text-base font-urdu text-[var(--color-emerald)] leading-loose">
                            {activeScene.characterDialogueUrdu}
                          </p>
                        </motion.div>
                      </AnimatePresence>

                      {/* Animated Golden Progress Timeline */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                        <motion.div
                          animate={{ width: `${sceneProgressPct}%` }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                          className="h-full rounded-full bg-gradient-to-r from-[var(--color-emerald)] to-[var(--color-gold-soft)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Scene Selector + Playback Bar */}
                  <div className="modern-panel rounded-2xl p-4 space-y-3">
                    <div
                      className={`grid gap-2 ${
                        activeEpisode.scenes.length >= 4
                          ? 'grid-cols-2 sm:grid-cols-4'
                          : 'grid-cols-3'
                      }`}
                    >
                      {activeEpisode.scenes.map((sc, idx) => (
                        <motion.button
                          key={sc.sceneNumber}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={() => {
                            stopInlineUrduSpeech();
                            setActiveSceneIdx(idx);
                            if (cinemaPlaying) playStoryScene(activeEpisode, idx);
                          }}
                          className={`rounded-xl border px-3 py-2.5 text-right text-xs transition-colors ${
                            idx === activeSceneIdx
                              ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)] text-white shadow-md'
                              : idx < activeSceneIdx
                                ? 'border-[var(--color-emerald)]/45 bg-[var(--color-navy)] text-[var(--color-emerald)]'
                                : 'modern-card text-[var(--color-ink-muted)]'
                          }`}
                          dir="rtl"
                          lang="ur"
                        >
                          <div className="font-mono text-[10px] opacity-80">منظر {sc.sceneNumber}</div>
                          <div className="truncate font-urdu font-bold mt-0.5">{sc.titleUrdu}</div>
                        </motion.button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={toggleCinemaPlay}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-emerald-deep)] to-[#059669] px-5 py-2.5 text-xs font-urdu font-bold text-white shadow-md"
                        >
                          {cinemaPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          {cinemaPlaying ? 'اینیمیٹڈ ویڈیو روکیں' : 'مکمل اینیمیٹڈ ویڈیو چلائیں (اردو آواز کے ساتھ)'}
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => {
                            stopInlineUrduSpeech();
                            const next = (activeSceneIdx + 1) % activeEpisode.scenes.length;
                            if (cinemaPlaying) playStoryScene(activeEpisode, next);
                            else setActiveSceneIdx(next);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3.5 py-2.5 text-xs font-urdu font-bold text-[var(--color-ink)]"
                        >
                          <SkipForward className="h-3.5 w-3.5" /> اگلا منظر
                        </motion.button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          stopInlineUrduSpeech();
                          setCinemaPlaying(false);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-urdu text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]"
                      >
                        <VolumeX className="h-3.5 w-3.5" /> آواز بند کریں
                      </button>
                    </div>
                  </div>

                  {/* Deep Quranic & Spiritual Lesson Card */}
                  <div dir="rtl" lang="ur" className="modern-panel rounded-2xl p-5 sm:p-6 space-y-4 text-right">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-urdu-heavy text-2xl text-[var(--color-gold-soft)]">
                        {activeEpisode.titleUrdu}
                      </h2>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() =>
                          void playInlineUrduSpeech(
                            `${activeEpisode.moralUrdu}۔ قرآنی آیت: ${activeEpisode.quranVerseUrdu}۔ آج کا سنت عمل: ${activeEpisode.sunnahActionUrdu}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-emerald)]/40 bg-[var(--color-navy)] px-3 py-1.5 text-xs font-urdu font-bold text-[var(--color-emerald)]"
                      >
                        <Volume2 className="h-3.5 w-3.5" /> مکمل سبق سنیں
                      </motion.button>
                    </div>
                    <p className="text-base font-urdu text-[var(--color-ink)] leading-loose">{activeEpisode.moralUrdu}</p>
                    <div className="modern-card rounded-xl p-4 space-y-2">
                      <div className="text-xs font-urdu font-bold text-[var(--color-emerald)]">
                        قرآنی آیت ({activeEpisode.verseRef})
                      </div>
                      <p dir="rtl" lang="ar" className="font-arabic text-2xl sm:text-3xl text-[var(--color-ink)] leading-loose">
                        {activeEpisode.quranVerseArabic}
                      </p>
                      <p className="text-sm font-urdu text-[var(--color-ink-muted)] leading-loose">
                        {activeEpisode.quranVerseUrdu}
                      </p>
                    </div>
                    <p className="text-sm font-urdu text-[var(--color-gold-soft)]">
                      <strong>آج کا عملی سنت سبق:</strong> {activeEpisode.sunnahActionUrdu}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* RIGHT: Video Playlist */}
            <aside className={`${isTheaterExpanded ? 'lg:col-span-12' : 'lg:col-span-4'} modern-panel rounded-2xl p-4 space-y-3`}>
              <div dir="rtl" lang="ur" className="text-sm font-urdu-heavy text-[var(--color-gold-soft)] text-right">
                ویڈیو پلے لسٹ ({episodes.length} اقساط)
              </div>
              <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
                {episodes.map((ep, idx) => (
                  <motion.button
                    key={ep.id}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      stopInlineUrduSpeech();
                      setCinemaPlaying(false);
                      setActiveEpisodeIdx(idx);
                      setActiveSceneIdx(0);
                    }}
                    dir="rtl"
                    lang="ur"
                    className={`w-full rounded-xl border p-3 text-right transition-colors space-y-2 ${
                      idx === activeEpisodeIdx
                        ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)]/25'
                        : 'modern-card'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {ep.scenes[0]?.imageUrl && (
                        <img
                          src={ep.scenes[0].imageUrl}
                          alt={ep.titleUrdu}
                          className="h-16 w-24 rounded-lg object-cover shrink-0 border border-[var(--color-border-hairline)]"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-urdu font-bold text-[var(--color-ink)] line-clamp-2">
                          {ep.titleUrdu}
                        </div>
                        <div className="mt-1 text-xs font-mono text-[var(--color-gold-soft)]">
                          {ep.verseRef} · {ep.scenes.length} مناظر
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* MODE 2: VIDEO UPLOAD / LINK ANALYZER & ONLINE ISLAMIC VIDEO SEARCH */}
      {mode === 'analyze_search' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Video File Upload + Link Analyzer */}
          <form
            onSubmit={handleAnalyzeVideo}
            className="lg:col-span-6 modern-panel rounded-2xl p-5 space-y-4 text-right"
            dir="rtl"
            lang="ur"
          >
            <h2 className="font-urdu-heavy text-xl text-[var(--color-gold-soft)]">
              ۱۔ اپنی ویڈیو اپلوڈ کریں یا ویڈیو لنک چیک کریں
            </h2>
            <p className="text-sm font-urdu text-[var(--color-ink-muted)] leading-relaxed">
              کوئی بھی اسلامی بیان، کلپ یا ویڈیو اپلوڈ کریں (MP4 / WebM / MOV) یا لنک دیں — نظام اس کا اصل متن، اردو ترجمہ اور قرآن و حدیث سے مستند تحقیق پیش کرے گا۔
            </p>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-5 text-xs font-urdu font-bold text-[var(--color-ink-muted)] hover:border-[var(--color-emerald)]">
              <Upload className="h-4 w-4 text-[var(--color-emerald)]" aria-hidden="true" />
              <span>{videoFile ? videoFile.name : 'ویڈیو فائل منتخب کریں (MP4 / WebM / MOV)'}</span>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleSelectVideoFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
            </label>

            {videoPreviewUrl && (
              <video
                src={videoPreviewUrl}
                controls
                className="w-full rounded-xl border border-[var(--color-border-hairline)] max-h-[260px] bg-black"
              />
            )}

            <div>
              <label className="block text-xs font-urdu text-[var(--color-ink-muted)] mb-1">
                یا ویڈیو / بیان کا لنک پیسٹ کریں (URL)
              </label>
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-[var(--color-gold-soft)] shrink-0" aria-hidden="true" />
                <input
                  type="url"
                  dir="ltr"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  placeholder="https://youtube.com/... or video URL"
                  className="w-full rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3.5 py-2.5 text-xs text-[var(--color-ink)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-urdu text-[var(--color-ink-muted)] mb-1">
                ویڈیو کے بارے میں خاص سوال یا خلاصہ کی درخواست
              </label>
              <textarea
                rows={3}
                dir="auto"
                value={videoQuestion}
                onChange={(e) => setVideoQuestion(e.target.value)}
                placeholder="مثلاً: اس ویڈیو میں بیان کی گئی حدیث مستند ہے یا نہیں؟ اور اردو ترجمہ بتائیں…"
                className="w-full rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3.5 py-2.5 text-xs font-urdu text-[var(--color-ink)]"
              />
            </div>

            {videoError && (
              <div className="rounded-xl border border-[#B91C1C]/40 bg-[#B91C1C]/15 p-3 text-xs font-urdu text-[var(--color-ink)]">
                {videoError}
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={analyzingVideo || (!videoFile && !videoLink.trim() && !videoQuestion.trim())}
              className="w-full rounded-xl bg-[var(--color-emerald-deep)] px-4 py-3 text-sm font-urdu font-bold text-white disabled:opacity-50"
            >
              {analyzingVideo ? 'ویڈیو کا تجزیہ اور اردو ترجمہ تیار ہو رہا ہے…' : 'ویڈیو کا اردو تجزیہ و تصدیق کریں'}
            </motion.button>

            {videoReport && (
              <div className="modern-card rounded-xl p-4 space-y-3 text-sm font-urdu">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-urdu-heavy text-[var(--color-emerald)]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    نتیجہ: {videoReport.outcome}
                  </span>
                  <button
                    type="button"
                    onClick={() => void playInlineUrduSpeech(videoReport.explanation)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-emerald)] hover:underline"
                  >
                    <Volume2 className="h-3.5 w-3.5" /> سنیں (اردو)
                  </button>
                </div>
                <p className="text-[var(--color-ink)] leading-loose whitespace-pre-wrap">{videoReport.explanation}</p>
                {videoReport.mediaBreakdown && (
                  <div className="space-y-2 border-t border-[var(--color-border-hairline)] pt-3 text-xs">
                    <div>
                      <strong className="text-[var(--color-gold-soft)]">اصل تحریر:</strong>{' '}
                      <span className="text-[var(--color-ink-muted)]">{videoReport.mediaBreakdown.exactTranscript}</span>
                    </div>
                    <div>
                      <strong className="text-[var(--color-gold-soft)]">اردو ترجمہ:</strong>{' '}
                      <span className="text-[var(--color-ink)]">{videoReport.mediaBreakdown.translation}</span>
                    </div>
                    <div>
                      <strong className="text-[var(--color-gold-soft)]">خلاصہ:</strong>{' '}
                      <span className="text-[var(--color-ink)]">{videoReport.mediaBreakdown.aiSummary}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* RIGHT: Online Islamic Lecture & Video Topic Discovery */}
          <div
            className="lg:col-span-6 modern-panel rounded-2xl p-5 space-y-4 text-right"
            dir="rtl"
            lang="ur"
          >
            <h2 className="font-urdu-heavy text-xl text-[var(--color-gold-soft)]">
              ۲۔ آن لائن اسلامی ویڈیوز، واقعات اور بیانات کی تلاش
            </h2>
            <p className="text-sm font-urdu text-[var(--color-ink-muted)] leading-relaxed">
              سیرتِ نبوی ﷺ، صحابہؓ، بچوں کی کہانیاں یا کسی بھی اسلامی بیان کے موضوع پر آن لائن مستند ذرائع سے اردو خلاصہ اور لنکس حاصل کریں۔
            </p>

            <form onSubmit={handleSearchOnlineVideos} className="flex flex-wrap gap-2">
              <input
                type="text"
                dir="auto"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="مثلاً: واقعہ معراج، حضرت یوسفؑ کا قصہ، بچوں کے لیے نماز کی ویڈیو…"
                className="flex-1 min-w-[200px] rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-4 py-2.5 text-xs font-urdu text-[var(--color-ink)]"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={searchingOnline || !searchQuery.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-emerald-deep)] px-4 py-2.5 text-xs font-urdu font-bold text-white disabled:opacity-50"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                {searchingOnline ? 'تلاش جاری ہے…' : 'آن لائن تلاش کریں'}
              </motion.button>
            </form>

            {onlineAnswer && (
              <div className="modern-card rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-urdu-heavy text-[var(--color-emerald)]">اردو تحقیقی خلاصہ</span>
                  <button
                    type="button"
                    onClick={() => void playInlineUrduSpeech(onlineAnswer)}
                    className="inline-flex items-center gap-1 font-urdu font-bold text-[var(--color-emerald)] hover:underline"
                  >
                    <Volume2 className="h-3.5 w-3.5" /> سنیں (اردو)
                  </button>
                </div>
                <p className="text-sm font-urdu text-[var(--color-ink)] leading-loose whitespace-pre-wrap">{onlineAnswer}</p>
                {onlineSources.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border-hairline)]">
                    {onlineSources.map((src) => (
                      <a
                        key={src.url}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1 text-xs font-urdu text-[var(--color-emerald)]"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="max-w-[240px] truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.section>
  );
};
