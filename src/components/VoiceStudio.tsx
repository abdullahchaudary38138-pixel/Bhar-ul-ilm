import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
  RotateCcw,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PhoneCall,
  PhoneOff,
  ChevronDown,
  ChevronUp,
  BookmarkPlus,
  Hand,
  Trash2,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MicrophoneRecorder, LiveVoiceSessionClient } from '../utils/audioUtils.ts';
import { CitationCard } from './CitationCard.tsx';
import { DiagramRenderer } from './DiagramRenderer.tsx';
import { VoiceOrb } from './VoiceOrb.tsx';
import type {
  ChatMessage,
  CorpusPassage,
  ResearchTopic,
  TranscriptResult,
  VoiceMetrics,
} from '../types.ts';

type InteractionMode = 'voice_text' | 'live_call' | 'text_only' | 'voice_only';
type VoiceName = 'Charon' | 'Kore' | 'Zephyr' | 'Puck' | 'Fenrir';
type FontScale = 'standard' | 'large' | 'xl';

interface VoiceStudioProps {
  activeTopic: ResearchTopic;
  topics: ResearchTopic[];
  onSelectTopic: (topicId: string) => void;
  onUpdateTopic: (topic: ResearchTopic) => void;
  onNewTopic: () => void;
  seededPrompt?: string | null;
  onClearSeededPrompt: () => void;
  externalSpeakRequest?: string | null;
  onClearExternalSpeak: () => void;
  onNoteSaved: () => void;
  activeContextSummary?: string;
}

export const VoiceStudio: React.FC<VoiceStudioProps> = ({
  activeTopic,
  topics,
  onSelectTopic,
  onUpdateTopic,
  onNewTopic,
  seededPrompt,
  onClearSeededPrompt,
  externalSpeakRequest,
  onClearExternalSpeak,
  onNoteSaved,
  activeContextSummary,
}) => {
  const [mode, setMode] = useState<InteractionMode>('voice_text');
  const [voiceName, setVoiceName] = useState<VoiceName>('Charon');
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  const [fontScale, setFontScale] = useState<FontScale>('standard');
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  const [autoSendOnSilence, setAutoSendOnSilence] = useState<boolean>(false);
  const [saveAudioOptIn, setSaveAudioOptIn] = useState<boolean>(false);

  const [recState, setRecState] = useState<'idle' | 'recording' | 'paused' | 'transcribing'>('idle');
  const [micLevel, setMicLevel] = useState<number>(0);
  const [vadActive, setVadActive] = useState<boolean>(false);
  const [pendingTranscript, setPendingTranscript] = useState<TranscriptResult | null>(null);
  const [draftText, setDraftText] = useState<string>('');

  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [expandedUnderstanding, setExpandedUnderstanding] = useState<Record<string, boolean>>({});
  const [savingNoteMsgId, setSavingNoteMsgId] = useState<string | null>(null);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState<string | null>(null);

  const [liveStatus, setLiveStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [liveMuted, setLiveMuted] = useState<boolean>(false);
  const [liveAiSpeaking, setLiveAiSpeaking] = useState<boolean>(false);
  const [liveUserCaption, setLiveUserCaption] = useState<string>('');
  const [liveAiCaption, setLiveAiCaption] = useState<string>('');
  const [liveInterruptNotice, setLiveInterruptNotice] = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState<number>(0);

  const [metrics, setMetrics] = useState<VoiceMetrics>({
    totalVoiceQueries: 0,
    avgLatencyMs: 0,
    avgRecognitionConfidence: 0.94,
    arabicTermAccuracyEstimate: 0.96,
    interruptionsHandled: 0,
    userCorrections: 0,
    clarificationsTriggered: 0,
  });

  const recorderRef = useRef<MicrophoneRecorder | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const liveClientRef = useRef<LiveVoiceSessionClient | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/metrics');
      const data = await res.json();
      if (data.metrics) setMetrics(data.metrics);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [activeTopic.messages.length]);

  useEffect(() => {
    if (seededPrompt) {
      setDraftText(seededPrompt);
      onClearSeededPrompt();
      inputRef.current?.focus();
    }
  }, [seededPrompt, onClearSeededPrompt]);

  useEffect(() => {
    if (externalSpeakRequest) {
      speakText(externalSpeakRequest, 'external');
      onClearExternalSpeak();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSpeakRequest]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTopic.messages.length]);

  useEffect(() => {
    if (liveStatus !== 'connected') {
      setCallSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [liveStatus]);

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      liveClientRef.current?.disconnect();
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (recState === 'idle') startRecording();
        else if (recState === 'recording' || recState === 'paused') stopAndTranscribe();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recState]);

  const stopAudioPlayback = (recordAsInterruption = false) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    if (speakingMsgId && recordAsInterruption) {
      fetch('/api/conversation/metrics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'interruption' }),
      })
        .then(() => fetchMetrics())
        .catch(() => {});
    }
    setSpeakingMsgId(null);
  };

  const speakText = async (text: string, msgId: string) => {
    stopAudioPlayback(false);
    setSpeakingMsgId(msgId);
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceName,
          saveToDisk: saveAudioOptIn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'TTS failed');
      const src = data.audioBase64
        ? `data:audio/wav;base64,${data.audioBase64}`
        : data.audioUrl;
      if (!src) throw new Error('No audio generated');

      const audio = new Audio(src);
      audio.playbackRate = speechSpeed;
      audioPlayerRef.current = audio;
      audio.onended = () => {
        setSpeakingMsgId(null);
        audioPlayerRef.current = null;
      };
      audio.onerror = () => {
        setSpeakingMsgId(null);
        audioPlayerRef.current = null;
      };
      await audio.play();
    } catch (err) {
      setSpeakingMsgId(null);
      setError(err instanceof Error ? err.message : 'Unable to play spoken audio.');
    }
  };

  useEffect(() => {
    if (audioPlayerRef.current) audioPlayerRef.current.playbackRate = speechSpeed;
    liveClientRef.current?.setPlaybackRate(speechSpeed);
  }, [speechSpeed]);

  const startRecording = async () => {
    setError(null);
    if (speakingMsgId) stopAudioPlayback(true);
    try {
      const rec = new MicrophoneRecorder();
      recorderRef.current = rec;
      setRecState('recording');
      await rec.start({
        autoStopOnSilence: autoSendOnSilence,
        silenceTimeoutMs: 1800,
        onLevel: (level, active) => {
          setMicLevel(level);
          setVadActive(active);
        },
        onAutoSilenceStop: () => stopAndTranscribe(true),
      });
    } catch (err) {
      setRecState('idle');
      setError(
        err instanceof Error
          ? err.message
          : 'Microphone access was denied. Background recording is never used.'
      );
    }
  };

  const pauseRecording = () => {
    recorderRef.current?.pause();
    setRecState('paused');
    setVadActive(false);
    setMicLevel(0);
  };

  const resumeRecording = () => {
    recorderRef.current?.resume();
    setRecState('recording');
  };

  const cancelRecording = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecState('idle');
    setMicLevel(0);
    setVadActive(false);
  };

  const stopAndTranscribe = async (autoSubmitIfConfident = false) => {
    if (!recorderRef.current) return;
    setRecState('transcribing');
    setMicLevel(0);
    setVadActive(false);
    try {
      const { blob, mimeType } = await recorderRef.current.stop();
      recorderRef.current = null;

      const formData = new FormData();
      formData.append('audio', blob, 'voice-query.webm');
      formData.append('mimeType', mimeType);
      formData.append('saveAudio', String(saveAudioOptIn));

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json()) as TranscriptResult & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Transcription failed');

      setRecState('idle');
      setPendingTranscript(data);
      setDraftText(data.transcript);
      fetchMetrics();

      if (autoSubmitIfConfident && !data.lowConfidenceWarning && data.transcript.trim().length > 0) {
        await submitMessage(data.transcript, false, true);
        setPendingTranscript(null);
      } else {
        inputRef.current?.focus();
      }
    } catch (err) {
      setRecState('idle');
      setError(err instanceof Error ? err.message : 'Speech transcription failed.');
    }
  };

  const deleteStoredPendingAudio = async () => {
    if (!pendingTranscript?.audioId) return;
    const filename = pendingTranscript.audioId.split('/').pop();
    if (!filename) return;
    await fetch(`/api/audio/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    setPendingTranscript({ ...pendingTranscript, audioId: undefined });
  };

  const submitMessage = async (text: string, skipConfirmation = false, fromVoice = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSending(true);
    setError(null);
    setPendingTranscript(null);
    setDraftText('');

    try {
      const res = await fetch('/api/conversation/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: activeTopic.id,
          message: activeContextSummary
            ? `[Active Study Context: ${activeContextSummary}]\n${trimmed}`
            : trimmed,
          skipConfirmation,
          voiceMode: mode === 'voice_only' || mode === 'voice_text',
          fromVoice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversation request failed');

      onUpdateTopic(data.topic);
      fetchMetrics();

      const assistantMsg = data.assistantMessage as ChatMessage;
      if ((mode === 'voice_only' || mode === 'voice_text') && (assistantMsg.spokenSummary || assistantMsg.content)) {
        speakText(assistantMsg.spokenSummary || assistantMsg.content, assistantMsg.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process question.');
      setDraftText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmationChoice = async (msg: ChatMessage, accepted: boolean) => {
    const updatedMessages = activeTopic.messages.map((m) =>
      m.id === msg.id
        ? { ...m, confirmationResolved: accepted ? ('accepted' as const) : ('rejected' as const) }
        : m
    );
    onUpdateTopic({ ...activeTopic, messages: updatedMessages });

    if (accepted && msg.originalQueryForConfirmation) {
      await submitMessage(msg.originalQueryForConfirmation, true, false);
    } else {
      await fetch('/api/conversation/metrics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'correction' }),
      });
      fetchMetrics();
      setDraftText(msg.originalQueryForConfirmation || '');
      inputRef.current?.focus();
    }
  };

  const handleSaveResearchAsNotes = async (msg: ChatMessage) => {
    setSavingNoteMsgId(msg.id);
    try {
      const arabicRefs = activeTopic.messages.map((m) => m.arabicQuote).filter((q): q is string => Boolean(q));
      const allCitations = activeTopic.messages.flatMap((m) => m.citations || []);
      const uniqueCitations = Array.from(new Map(allCitations.map((c) => [c.id, c])).values());

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeTopic.title,
          topicId: activeTopic.id,
          summary: msg.content,
          arabicReferences: arabicRefs,
          citations: uniqueCitations,
        }),
      });
      if (res.ok) {
        setNoteSavedFeedback('Saved to Personal Research Notebook');
        onNoteSaved();
        window.setTimeout(() => setNoteSavedFeedback(null), 2600);
      }
    } finally {
      setSavingNoteMsgId(null);
    }
  };

  const startLiveCall = async () => {
    setError(null);
    setLiveStatus('connecting');
    setLiveUserCaption('');
    setLiveAiCaption('');

    const client = new LiveVoiceSessionClient();
    liveClientRef.current = client;

    try {
      await client.connect({
        voiceName,
        playbackRate: speechSpeed,
        onReady: () => {
          setLiveStatus('connected');
          if (activeContextSummary) {
            client.sendTextTurn(
              `[Active Study Context — keep in memory for follow-ups]: ${activeContextSummary}`
            );
          }
        },
        onInputTranscript: (t) => setLiveUserCaption((prev) => `${prev} ${t}`.trim()),
        onOutputTranscript: (t) => setLiveAiCaption((prev) => `${prev} ${t}`.trim()),
        onSpeakingChange: (speaking) => setLiveAiSpeaking(speaking),
        onInterrupted: () => {
          setLiveAiSpeaking(false);
          setLiveInterruptNotice('Interrupted — listening to you immediately');
          window.setTimeout(() => setLiveInterruptNotice(null), 2200);
          fetchMetrics();
        },
        onError: (err) => {
          setError(err);
          setLiveStatus('disconnected');
        },
        onClose: () => {
          setLiveStatus('disconnected');
          setLiveAiSpeaking(false);
        },
      });
    } catch (err) {
      setLiveStatus('disconnected');
      setError(err instanceof Error ? err.message : 'Unable to start live voice call.');
    }
  };

  const endLiveCall = () => {
    liveClientRef.current?.disconnect();
    liveClientRef.current = null;
    setLiveStatus('disconnected');
    setLiveAiSpeaking(false);
  };

  const handleLiveBargeIn = () => {
    liveClientRef.current?.stopPlaybackQueue();
    setLiveAiSpeaking(false);
    setLiveInterruptNotice('Barge-in triggered — listening now');
    window.setTimeout(() => setLiveInterruptNotice(null), 2000);
    fetch('/api/conversation/metrics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'interruption' }),
    })
      .then(() => fetchMetrics())
      .catch(() => {});
  };

  const activeTopicCitations: CorpusPassage[] = Array.from(
    new Map(activeTopic.messages.flatMap((m) => m.citations || []).map((c) => [c.id, c])).values()
  );

  const activeTopicWebSources = Array.from(
    new Map(activeTopic.messages.flatMap((m) => m.webSources || []).map((w) => [w.url, w])).values()
  );

  const fontSizeClass =
    fontScale === 'xl' ? 'text-lg leading-relaxed' : fontScale === 'large' ? 'text-base leading-relaxed' : 'text-sm leading-relaxed';

  const orbState: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' =
    liveInterruptNotice
      ? 'interrupted'
      : liveAiSpeaking || Boolean(speakingMsgId)
        ? 'speaking'
        : sending || recState === 'transcribing'
          ? 'thinking'
          : liveStatus === 'connected' || recState === 'recording'
            ? 'listening'
            : 'idle';

  const orbLevel = liveAiSpeaking || Boolean(speakingMsgId) ? 0.55 : micLevel;

  const followUpPrompts = [
    'Aur detail mein samjhao',
    'Asan alfaaz mein batao',
    'Arabic grammar bhi batao',
    'Original reference dikhao',
    'Doosray scholar ka view batao',
    'Isko chart mein samjhao',
    'Aagay chalo',
    'Summarize everything',
  ];

  const formatCallDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const sampleStarters = [
    {
      label: 'Rozmarra Zindagi aur Islamic Guidance',
      text: 'Zindagi mein mushkil faisla ya ghar walon ke sath ikhtilaf ho to Quran aur Sunnah ki roshni mein sabr, mashwara aur sahi rawaiya kya hona chahiye?',
    },
    {
      label: 'Islamic Personalities & Book Decisions',
      text: 'Hazrat Abu Bakr Siddiq (RA) ne Quran jama karne aur Hazrat Umar (RA) ne Bait-ul-Mal aur Fatah-e-Sham mein aham faisle kaise aur kyun kiye? Book hawale ke sath batayein.',
    },
    {
      label: 'Pakistani Roman Urdu Quran Teaching',
      text: 'Mujhe Surah Al-Fatiha samjhao — pehli Ayah ke lafz, root aur grammar se shuru karein.',
    },
    {
      label: 'Ambiguous Query (Triggers Clarification)',
      text: 'Umar ke daur mein yeh kaise hua?',
    },
    {
      label: 'Comparative Research (Triggers Confirmation)',
      text: 'Quran, Hadith aur classical scholars ki roshni mein Shura aur state justice par comparative research karein.',
    },
  ];

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-6 space-y-4">
      {/* Workspace Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-hairline)] pb-4">
        <div
          className="relative flex flex-wrap items-center gap-1 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-1"
          role="group"
          aria-label="Interaction mode"
        >
          {(
            [
              { id: 'voice_text', label: 'Voice & Text' },
              { id: 'live_call', label: 'Live Call (WhatsApp Style)' },
              { id: 'text_only', label: 'Text Only' },
              { id: 'voice_only', label: 'Voice Only' },
            ] as const
          ).map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (m.id !== 'live_call' && liveStatus !== 'disconnected') endLiveCall();
                  setMode(m.id);
                }}
                className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-white'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="voice-mode-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-md bg-[var(--color-emerald-deep)]"
                  />
                )}
                <span className="relative z-10">{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-[var(--color-ink-muted)]">
            <span>Voice</span>
            <select
              aria-label="Select synthetic voice"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value as VoiceName)}
              className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-2.5 py-1 text-xs text-[var(--color-ink)]"
            >
              <option value="Charon">Charon (Deep Scholarly)</option>
              <option value="Kore">Kore (Clear & Calm)</option>
              <option value="Zephyr">Zephyr (Warm Conversational)</option>
              <option value="Puck">Puck (Crisp)</option>
              <option value="Fenrir">Fenrir (Measured)</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-[var(--color-ink-muted)]">
            <span>Speed</span>
            <select
              aria-label="Speech playback speed"
              value={speechSpeed}
              onChange={(e) => setSpeechSpeed(Number(e.target.value))}
              className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-2 py-1 text-xs font-mono tabular-nums text-[var(--color-ink)]"
            >
              <option value={0.85}>0.85x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.15}>1.15x</option>
              <option value={1.3}>1.3x</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-[var(--color-ink-muted)]">
            <span>Text</span>
            <select
              aria-label="Adjustable font size"
              value={fontScale}
              onChange={(e) => setFontScale(e.target.value as FontScale)}
              className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-2 py-1 text-xs text-[var(--color-ink)]"
            >
              <option value="standard">Standard</option>
              <option value="large">Large</option>
              <option value="xl">Extra Large</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setShowCaptions((c) => !c)}
            className={`rounded-md border border-[var(--color-border-hairline)] px-2.5 py-1 text-xs font-medium ${
              showCaptions ? 'bg-[var(--color-navy-elevated)] text-[var(--color-ink)]' : 'text-[var(--color-ink-subtle)]'
            }`}
          >
            Captions: {showCaptions ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Topic & Active Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="font-medium text-[var(--color-ink-subtle)] whitespace-nowrap">Topics:</span>
          {topics.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTopic(t.id)}
              className={`max-w-[210px] truncate rounded-md px-2.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                t.id === activeTopic.id
                  ? 'bg-[var(--color-navy-elevated)] font-semibold text-[var(--color-emerald)] border border-[var(--color-emerald)]/40'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {activeContextSummary && (
            <span className="text-[var(--color-gold-soft)] truncate max-w-[260px]">
              Context: {activeContextSummary}
            </span>
          )}
          <button type="button" onClick={onNewTopic} className="font-medium text-[var(--color-emerald)] hover:underline whitespace-nowrap">
            + Separate Topic
          </button>
        </div>
      </div>

      {/* 70/30 Asymmetric Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Live Call Audio-Reactive Voice Orb Panel */}
          <AnimatePresence>
            {mode === 'live_call' && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl border border-[var(--color-emerald)]/30 bg-[var(--color-navy-surface)] p-6 shadow-lg"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-hairline)] pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                        Pakistani Urdu Live Voice Call
                      </h2>
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-0.5 text-xs font-mono tabular-nums text-[var(--color-emerald)]">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {liveStatus === 'connected'
                          ? formatCallDuration(callSeconds)
                          : liveStatus === 'connecting'
                            ? 'Connecting…'
                            : 'Ready'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                      WhatsApp-style two-way real-time voice across daily life, Islamic books, and Quran with instant interruption. AI-generated voice; never claims to be human.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {liveStatus === 'disconnected' ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={startLiveCall}
                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-emerald)] hover:text-slate-950 transition-colors"
                      >
                        <PhoneCall className="h-4 w-4" aria-hidden="true" />
                        Start Live Call
                      </motion.button>
                    ) : (
                      <>
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={() => {
                            const next = !liveMuted;
                            setLiveMuted(next);
                            liveClientRef.current?.setMuted(next);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                            liveMuted
                              ? 'border-[var(--color-amber-warn)]/60 bg-[var(--color-navy)] text-[var(--color-amber-warn)]'
                              : 'border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-ink)]'
                          }`}
                        >
                          {liveMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                          {liveMuted ? 'Unmute Mic' : 'Mute Mic'}
                        </motion.button>

                        {liveAiSpeaking && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileTap={{ scale: 0.96 }}
                            type="button"
                            onClick={handleLiveBargeIn}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-gold)] px-3.5 py-2 text-xs font-medium text-slate-950"
                          >
                            <Hand className="h-4 w-4" aria-hidden="true" />
                            Interrupt & Speak
                          </motion.button>
                        )}

                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={endLiveCall}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#B91C1C] px-4 py-2 text-xs font-medium text-white hover:bg-[#991B1B] transition-colors"
                        >
                          <PhoneOff className="h-4 w-4" aria-hidden="true" />
                          End Call
                        </motion.button>
                      </>
                    )}
                  </div>
                </div>

                <VoiceOrb state={orbState} audioLevel={orbLevel} />

                <AnimatePresence>
                  {liveInterruptNotice && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-2 rounded-md border border-[var(--color-amber-warn)]/40 bg-[var(--color-navy)] px-3 py-1.5 text-center text-xs font-medium text-[var(--color-amber-warn)]"
                    >
                      {liveInterruptNotice}
                    </motion.div>
                  )}
                </AnimatePresence>

                {liveStatus === 'connected' && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[var(--color-ink-subtle)] mr-1">Quick live prompt:</span>
                    {[
                      'Zindagi mein mushkil faisle par Islamic rehnumai dein',
                      'Hazrat Umar (RA) ke kisi aham faisle ki hikmat batayein',
                      'Surah Al-Fatiha ki pehli Ayah ki Tajweed aur matlab samjhayein',
                    ].map((quickLive) => (
                      <button
                        key={quickLive}
                        type="button"
                        onClick={() => liveClientRef.current?.sendTextTurn(quickLive)}
                        className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1 text-[11px] text-[var(--color-ink-muted)] hover:border-[var(--color-emerald)] hover:text-[var(--color-ink)] transition-colors"
                      >
                        {quickLive}
                      </button>
                    ))}
                  </div>
                )}

                {showCaptions && liveStatus !== 'disconnected' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm"
                  >
                    <div className="rounded-md bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)]">
                      <div className="text-xs font-medium text-[var(--color-ink-subtle)]">Aap Ki Awaz (Live Caption)</div>
                      <p className="mt-1 text-[var(--color-ink)] min-h-[2.5rem]">{liveUserCaption || 'Sun rahe hain…'}</p>
                    </div>
                    <div className="rounded-md bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)]">
                      <div className="text-xs font-medium text-[var(--color-ink-subtle)]">Ustad AI Jawab (Live Caption)</div>
                      <p className="mt-1 text-[var(--color-ink)] min-h-[2.5rem]">{liveAiCaption || 'Jawab tayyar ho raha hai…'}</p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Conversation Thread */}
          {mode !== 'voice_only' && (
            <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 min-h-[360px] space-y-6">
              {activeTopic.messages.length === 0 ? (
                <div className="py-4 space-y-5">
                  <div>
                    <h1 className="font-display text-3xl font-semibold text-[var(--color-ink)]">
                      Live Islamic Voice & Research Assistant
                    </h1>
                    <p className="mt-1.5 text-sm text-[var(--color-ink-muted)] max-w-2xl">
                      Ask naturally in Pakistani Roman Urdu, Urdu, Arabic, or English across Quran, Hadith, Fiqh, Islamic books & personalities, and everyday life. Ambiguous queries trigger clarification; complex research confirms understanding first.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sampleStarters.map((s) => (
                      <motion.button
                        key={s.label}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => submitMessage(s.text)}
                        className="text-left rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-4 py-3.5 hover:border-[var(--color-emerald)]/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-emerald)]">
                          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{s.label}</span>
                        </div>
                        <div className="mt-1.5 text-sm text-[var(--color-ink)] leading-snug">{s.text}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                activeTopic.messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isSpeakingThis = speakingMsgId === msg.id;
                  const showDetails = Boolean(expandedUnderstanding[msg.id]);

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="pb-5 border-b border-[var(--color-border-hairline)] last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-subtle)]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-[var(--color-ink)]">
                            {isUser ? 'You' : 'Bahr-ul-Ilm AI'}
                          </span>
                          {msg.detectedLanguages && msg.detectedLanguages.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{msg.detectedLanguages.join(' / ')}</span>
                            </>
                          )}
                          {msg.latencyMs && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{msg.latencyMs}ms</span>
                            </>
                          )}
                        </div>

                        {!isUser && (
                          <div className="flex items-center gap-3">
                            {isSpeakingThis ? (
                              <button
                                type="button"
                                onClick={() => stopAudioPlayback(true)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-crimson)] hover:underline"
                              >
                                <VolumeX className="h-3.5 w-3.5" /> Stop / Interrupt
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => speakText(msg.spokenSummary || msg.content, msg.id)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-emerald)] hover:underline"
                              >
                                <Volume2 className="h-3.5 w-3.5" /> Listen / Replay
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={savingNoteMsgId === msg.id}
                              onClick={() => handleSaveResearchAsNotes(msg)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                            >
                              <BookmarkPlus className="h-3.5 w-3.5" />
                              {savingNoteMsgId === msg.id ? 'Saving…' : 'Turn into notes'}
                            </button>
                          </div>
                        )}
                      </div>

                      {msg.arabicQuote && (
                        <p
                          dir="rtl"
                          lang="ar"
                          className="mt-3 rounded-md bg-[var(--color-navy)] px-4 py-3 font-arabic text-2xl text-right text-[var(--color-gold-soft)] border border-[var(--color-border-hairline)]"
                        >
                          {msg.arabicQuote}
                        </p>
                      )}

                      <div className={`mt-2 whitespace-pre-wrap text-[var(--color-ink)] ${fontSizeClass}`}>
                        {msg.content}
                      </div>

                      {msg.requiresConfirmation && !msg.confirmationResolved && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleConfirmationChoice(msg, true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-emerald-deep)] px-4 py-2 text-xs font-medium text-white"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Yes, proceed
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmationChoice(msg, false)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-4 py-2 text-xs font-medium text-[var(--color-ink)]"
                          >
                            <XCircle className="h-4 w-4 text-[var(--color-crimson)]" /> No, let me explain again
                          </button>
                        </div>
                      )}

                      {msg.diagram && <DiagramRenderer diagram={msg.diagram} />}

                      {!isUser && msg.webSources && msg.webSources.length > 0 && (
                        <div className="mt-3 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3 text-xs">
                          <div className="font-semibold text-[var(--color-gold-soft)] mb-1.5">
                            Online Books & Web Sources (Kahan Se Jawab Aaya):
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {msg.webSources.map((ws) => (
                              <a
                                key={ws.url}
                                href={ws.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-2.5 py-1 text-[11px] text-[var(--color-emerald)] hover:border-[var(--color-emerald)]"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="max-w-[240px] truncate">{ws.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {!isUser && msg.understanding && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedUnderstanding((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                            }
                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]"
                          >
                            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            Understanding Analysis ({msg.understanding.subject})
                          </button>

                          {showDetails && (
                            <div className="mt-2 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3 text-xs space-y-1 text-[var(--color-ink-muted)]">
                              <div>
                                <strong className="text-[var(--color-ink)]">Intent:</strong> {msg.understanding.intentType} · Status: {msg.understanding.status}
                              </div>
                              {msg.understanding.confirmedInfo.length > 0 && (
                                <div>
                                  <strong className="text-[var(--color-ink)]">Confirmed:</strong> {msg.understanding.confirmedInfo.join('; ')}
                                </div>
                              )}
                              {msg.understanding.assumptions.length > 0 && (
                                <div>
                                  <strong className="text-[var(--color-ink)]">Assumptions separated:</strong> {msg.understanding.assumptions.join('; ')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}

              {sending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-xs font-medium text-[var(--color-emerald)]"
                >
                  Analyzing intent, verifying primary sources, and preparing Pakistani Urdu/English response…
                </motion.div>
              )}

              <div ref={threadEndRef} />
            </div>
          )}

          {mode === 'voice_only' && (
            <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-6 text-center space-y-3">
              <VoiceOrb state={orbState} audioLevel={orbLevel} />
              {showCaptions && activeTopic.messages.length > 0 && (
                <div className="mx-auto max-w-xl rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4 text-left">
                  <div className="text-xs font-medium text-[var(--color-ink-subtle)]">Latest Spoken Caption</div>
                  <p className={`mt-1 text-[var(--color-ink)] ${fontSizeClass}`}>
                    {activeTopic.messages[activeTopic.messages.length - 1]?.spokenSummary ||
                      activeTopic.messages[activeTopic.messages.length - 1]?.content}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Natural Follow-Up Bar */}
          {activeTopic.messages.length > 0 && !sending && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-[var(--color-ink-subtle)] mr-1">Follow up:</span>
              {followUpPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submitMessage(p)}
                  className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-2.5 py-1 text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-emerald)] hover:text-[var(--color-ink)] whitespace-nowrap shrink-0"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {noteSavedFeedback && (
            <div className="rounded-md border border-[var(--color-emerald)]/40 bg-[var(--color-navy-surface)] px-4 py-2 text-xs font-medium text-[var(--color-emerald)]">
              {noteSavedFeedback}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-[var(--color-crimson)]/40 bg-[var(--color-navy-surface)] px-4 py-2.5 text-xs text-[var(--color-crimson)]">
              {error}
            </div>
          )}

          {/* Microphone & Editable Transcript Dock */}
          {mode !== 'live_call' && (
            <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4 space-y-3">
              {pendingTranscript && (
                <div className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--color-ink)]">Transcript Ready for Review</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[var(--color-ink-muted)]">
                        Detected: {pendingTranscript.detectedLanguages.join(' / ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-[var(--color-ink-muted)]">
                        Confidence {Math.round(pendingTranscript.confidence * 100)}%
                      </span>
                    </div>
                    {pendingTranscript.audioId && (
                      <div className="flex items-center gap-2">
                        <audio controls src={pendingTranscript.audioId} className="h-7" />
                        <button
                          type="button"
                          onClick={deleteStoredPendingAudio}
                          className="inline-flex items-center gap-1 text-xs text-[var(--color-crimson)] hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete Audio
                        </button>
                      </div>
                    )}
                  </div>

                  {pendingTranscript.lowConfidenceWarning && (
                    <div className="flex items-start gap-2 text-xs text-[var(--color-amber-warn)]">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Low-confidence or ambiguous terminology:</strong>{' '}
                        {pendingTranscript.warningMessage ||
                          'Review uncertain names, Quranic references, or Arabic terms below before sending.'}
                      </div>
                    </div>
                  )}

                  {pendingTranscript.uncertainSpans.length > 0 && (
                    <div className="space-y-1 text-xs text-[var(--color-ink-muted)]">
                      {pendingTranscript.uncertainSpans.map((span, idx) => (
                        <div key={idx}>
                          Uncertain phrase <strong className="text-[var(--color-ink)]">“{span.phrase}”</strong> ({span.reason})
                          {span.alternatives.length > 0 && (
                            <span>
                              {' '}— Alternatives:{' '}
                              {span.alternatives.map((alt, aIdx) => (
                                <button
                                  key={aIdx}
                                  type="button"
                                  onClick={() => {
                                    setDraftText((prev) => prev.replace(span.phrase, alt));
                                    fetch('/api/conversation/metrics/event', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ event: 'correction' }),
                                    }).then(() => fetchMetrics());
                                  }}
                                  className="mr-2 underline text-[var(--color-emerald)]"
                                >
                                  {alt}
                                </button>
                              ))}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {mode !== 'text_only' && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {recState === 'idle' ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        aria-label="Start voice recording (Alt+M)"
                        className="inline-flex h-12 min-w-[160px] items-center justify-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-5 text-sm font-medium text-white hover:bg-[var(--color-emerald)] hover:text-slate-950"
                      >
                        <Mic className="h-5 w-5" /> Speak Question
                      </button>
                    ) : recState === 'transcribing' ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex h-12 min-w-[160px] items-center justify-center gap-2 rounded-lg bg-[var(--color-navy-elevated)] px-5 text-sm text-[var(--color-ink-muted)]"
                      >
                        Transcribing speech…
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {recState === 'recording' ? (
                          <button
                            type="button"
                            onClick={pauseRecording}
                            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-4 text-xs font-medium text-[var(--color-ink)]"
                          >
                            <Pause className="h-4 w-4" /> Pause
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={resumeRecording}
                            className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-[var(--color-emerald-deep)] px-4 text-xs font-medium text-white"
                          >
                            <Play className="h-4 w-4" /> Resume
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => stopAndTranscribe(false)}
                          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-[var(--color-gold)] px-4 text-xs font-medium text-slate-950"
                        >
                          <Square className="h-4 w-4" /> Stop & Transcribe
                        </button>
                        <button
                          type="button"
                          onClick={cancelRecording}
                          className="inline-flex h-11 items-center gap-1 rounded-lg border border-[var(--color-border-hairline)] px-3 text-xs text-[var(--color-ink-muted)]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </div>
                    )}

                    {recState !== 'idle' && (
                      <div className="flex items-center gap-2.5 text-xs">
                        <div className="h-2.5 w-24 overflow-hidden rounded-full bg-[var(--color-navy)]">
                          <div
                            className="h-full bg-[var(--color-emerald)] transition-transform duration-75"
                            style={{ transform: `scaleX(${Math.max(0.05, micLevel)})`, transformOrigin: 'left' }}
                          />
                        </div>
                        <span className="text-[var(--color-ink-muted)]">
                          {recState === 'paused' ? 'Paused' : vadActive ? 'Voice detected' : 'Listening…'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-muted)]">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSendOnSilence}
                        onChange={(e) => setAutoSendOnSilence(e.target.checked)}
                        className="accent-[var(--color-emerald)]"
                      />
                      <span>Auto-send on silence</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAudioOptIn}
                        onChange={(e) => setSaveAudioOptIn(e.target.checked)}
                        className="accent-[var(--color-emerald)]"
                      />
                      <span>Save audio (opt-in)</span>
                    </label>
                  </div>
                </div>
              )}

              {mode !== 'voice_only' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitMessage(draftText, false, Boolean(pendingTranscript));
                  }}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <textarea
                    ref={inputRef}
                    rows={2}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitMessage(draftText, false, Boolean(pendingTranscript));
                      }
                    }}
                    placeholder="Ask or edit transcript in Roman Urdu, Urdu, Arabic, or English…"
                    className="flex-1 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-emerald)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draftText.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-emerald)] hover:text-slate-950 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Send className="h-4 w-4" /> Send
                  </button>
                </form>
              )}

              <div className="text-[11px] text-[var(--color-ink-subtle)]">
                Privacy & Provider Disclosure: Voice streams are processed only when you press Speak/Start Call via Google Gemini Speech & Live APIs. No background recording ever occurs.
              </div>
            </div>
          )}
        </div>

        {/* Right Margin Inspector */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-hairline)] pb-2.5">
              <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                Visible Source Citations
              </h2>
              <span className="font-mono text-xs tabular-nums text-[var(--color-gold-soft)]">
                {activeTopicCitations.length} source(s)
              </span>
            </div>

            {activeTopicCitations.length === 0 && activeTopicWebSources.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--color-ink-muted)] leading-relaxed">
                Verified Quranic Ayat, Hadith narrations, Tafsir passages, Library books, and online references cited during your conversation stay pinned here.
              </p>
            ) : (
              <div className="mt-3 space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {activeTopicCitations.map((c) => (
                  <CitationCard
                    key={c.id}
                    passage={c}
                    compact
                    onReadAloud={(text) => speakText(text, `cite-${c.id}`)}
                  />
                ))}
                {activeTopicWebSources.length > 0 && (
                  <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3 space-y-1.5 text-xs">
                    <div className="font-semibold text-[var(--color-gold-soft)]">
                      Grounded Online Sources ({activeTopicWebSources.length})
                    </div>
                    {activeTopicWebSources.map((ws) => (
                      <a
                        key={ws.url}
                        href={ws.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-[var(--color-emerald)] hover:underline truncate"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{ws.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4">
            <h2 className="font-display text-xl font-semibold text-[var(--color-ink)] border-b border-[var(--color-border-hairline)] pb-2.5">
              Voice & Citation Telemetry
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[var(--color-ink-subtle)]">Recognition Confidence</dt>
                <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-[var(--color-ink)]">
                  {Math.round(metrics.avgRecognitionConfidence * 100)}%
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-subtle)]">Arabic Term Accuracy</dt>
                <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-[var(--color-ink)]">
                  {Math.round(metrics.arabicTermAccuracyEstimate * 100)}%
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-subtle)]">Avg Response Latency</dt>
                <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-[var(--color-ink)]">
                  {metrics.avgLatencyMs} ms
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-subtle)]">Interruptions Handled</dt>
                <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-[var(--color-ink)]">
                  {metrics.interruptionsHandled}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-subtle)]">Clarifications Triggered</dt>
                <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-[var(--color-ink)]">
                  {metrics.clarificationsTriggered}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-subtle)]">User Corrections</dt>
                <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-[var(--color-ink)]">
                  {metrics.userCorrections}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
};
