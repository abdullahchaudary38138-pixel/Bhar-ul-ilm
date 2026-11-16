import React, { useRef, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Mic,
  Square,
  Upload,
  FileCheck2,
  Volume2,
  ExternalLink,
  Video,
} from 'lucide-react';
import { MicrophoneRecorder, convertBlobToWav } from '../utils/audioUtils.ts';
import { playInlineUrduSpeech } from '../utils/ttsPlayer.ts';
import { CitationCard } from './CitationCard.tsx';
import type { CorpusPassage, VerificationOutcome, VerificationReport } from '../types.ts';

export interface ClaimVerifierViewProps {
  onReadAloud: (text: string) => void;
  onAskInStudio: (passage: CorpusPassage) => void;
}

type SubmissionMode =
  | 'text'
  | 'quotation'
  | 'pdf'
  | 'screenshot'
  | 'voice_recording'
  | 'video_file'
  | 'video_link'
  | 'video_transcript';

function getOutcomeStyle(outcome: VerificationOutcome): {
  colorClass: string;
  label: string;
} {
  switch (outcome) {
    case 'Supported by the cited source':
      return { colorClass: 'text-[var(--color-emerald)]', label: 'مستند ماخذ سے ثابت ہے' };
    case 'Partially supported':
      return { colorClass: 'text-[var(--color-amber-warn)]', label: 'جزوی طور پر ثابت ہے' };
    case 'Context missing':
      return { colorClass: 'text-[var(--color-amber-warn)]', label: 'سیاق و سباق نامکمل ہے' };
    case 'Disputed':
      return { colorClass: 'text-[var(--color-amber-warn)]', label: 'علما کے درمیان مختلف فیہ ہے' };
    case 'Misattributed':
      return { colorClass: 'text-[var(--color-crimson)]', label: 'غلط نسبت دی گئی ہے' };
    default:
      return { colorClass: 'text-[var(--color-ink-muted)]', label: 'موجودہ ذرائع سے تصدیق نہ ہو سکی' };
  }
}

export const ClaimVerifierView: React.FC<ClaimVerifierViewProps> = ({
  onAskInStudio,
}) => {
  const [mode, setMode] = useState<SubmissionMode>('text');
  const [textInput, setTextInput] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<{ blob: Blob; mimeType: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<VerificationReport | null>(null);

  const recorderRef = useRef<MicrophoneRecorder | null>(null);

  const startVoiceRecording = async () => {
    setError(null);
    try {
      const rec = new MicrophoneRecorder();
      recorderRef.current = rec;
      await rec.start({ autoStopOnSilence: false });
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'مائیکروفون کی اجازت نہیں ملی۔');
    }
  };

  const stopVoiceRecording = async () => {
    if (!recorderRef.current) return;
    try {
      const res = await recorderRef.current.stop();
      const wav = await convertBlobToWav(res.blob);
      setRecordedBlob({ blob: wav.wavBlob, mimeType: wav.mimeType });
    } catch {
      // ignore
    } finally {
      setIsRecording(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const formData = new FormData();
      formData.append('sourceTypeLabel', mode);
      if (textInput.trim()) formData.append('text', textInput.trim());
      if (videoUrl.trim()) formData.append('videoUrl', videoUrl.trim());

      if (mode === 'voice_recording' && recordedBlob) {
        formData.append('file', recordedBlob.blob, 'claim-recording.wav');
      } else if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تصدیق مکمل نہ ہو سکی۔');
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تصدیق مکمل نہ ہو سکی۔');
    } finally {
      setLoading(false);
    }
  };

  const examples = [
    {
      label: 'حدیث کی نسبت کی جانچ',
      mode: 'quotation' as SubmissionMode,
      text: 'کیا "علم حاصل کرو خواہ چین جانا پڑے" صحیح بخاری کی حدیث ہے؟',
    },
    {
      label: 'تاریخی واقعے کی تصدیق',
      mode: 'text' as SubmissionMode,
      text: 'حضرت عمر رضی اللہ عنہ نے عام الرمادہ (18 ہجری) کے قحط میں چوری کی حد معطل کی تھی۔',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--color-border-hairline)] pb-4 text-right" dir="rtl">
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          دعویٰ، ویڈیو، تصویر، آڈیو اور PDF کی مستند تصدیق
        </h2>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)] max-w-3xl">
          PDF کتاب، تصویر/اسکرین شاٹ، آڈیو ریکارڈنگ، ویڈیو کلپ، ویڈیو لنک یا کوئی بھی تحریر دیں — قرآن، حدیث، لائبریری اور آن لائن مستند ذرائع سے تحقیق کر کے اردو میں مکمل رپورٹ اور آواز ملے گی۔
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Submission Form */}
        <form
          onSubmit={handleVerify}
          className="lg:col-span-5 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-4"
        >
          <div>
            <span className="block text-xs font-medium text-[var(--color-ink-subtle)] mb-2 text-right" dir="rtl">
              تصدیق کی قسم منتخب کریں
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'text', label: 'تحریری دعویٰ' },
                  { id: 'quotation', label: 'قول / حدیث' },
                  { id: 'pdf', label: 'PDF دستاویز' },
                  { id: 'screenshot', label: 'تصویر / اسکرین شاٹ' },
                  { id: 'voice_recording', label: 'آڈیو / ریکارڈنگ' },
                  { id: 'video_file', label: 'ویڈیو اپلوڈ' },
                  { id: 'video_link', label: 'ویڈیو / ویب لنک' },
                  { id: 'video_transcript', label: 'ویڈیو تحریر' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setMode(t.id);
                    setSelectedFile(null);
                    setError(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    mode === t.id
                      ? 'bg-[var(--color-emerald-deep)] text-white'
                      : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {(mode === 'pdf' || mode === 'screenshot' || mode === 'video_file') && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-muted)] text-right" dir="rtl">
                {mode === 'pdf'
                  ? 'PDF کتاب یا صفحہ اپلوڈ کریں'
                  : mode === 'video_file'
                    ? 'ویڈیو کلپ اپلوڈ کریں (MP4, WebM, MOV — زیادہ سے زیادہ 45MB)'
                    : 'تصویر یا اسکرین شاٹ اپلوڈ کریں (PNG, JPG, WebP)'}
              </label>
              <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-5 text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-emerald)]">
                {mode === 'video_file' ? (
                  <Video className="h-4 w-4 text-[var(--color-emerald)]" aria-hidden="true" />
                ) : (
                  <Upload className="h-4 w-4 text-[var(--color-emerald)]" aria-hidden="true" />
                )}
                <span>{selectedFile ? selectedFile.name : 'فائل منتخب کرنے کے لیے کلک کریں'}</span>
                <input
                  type="file"
                  accept={
                    mode === 'pdf'
                      ? '.pdf'
                      : mode === 'video_file'
                        ? 'video/*'
                        : 'image/*'
                  }
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
            </div>
          )}

          {mode === 'voice_recording' && (
            <div className="space-y-3 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--color-ink)]">
                  آواز ریکارڈ کریں یا آڈیو فائل منتخب کریں
                </span>
                <div className="flex items-center gap-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-emerald-deep)] px-3 py-1.5 text-xs font-medium text-white"
                    >
                      <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                      مائیک آن کریں
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopVoiceRecording}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#B91C1C] px-3 py-1.5 text-xs font-medium text-white"
                    >
                      <Square className="h-3.5 w-3.5" aria-hidden="true" />
                      ریکارڈنگ بند کریں
                    </button>
                  )}
                </div>
              </div>
              {recordedBlob && (
                <div className="text-xs text-[var(--color-emerald)] flex items-center gap-1.5">
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  آواز تیار ہے ({Math.round(recordedBlob.blob.size / 1024)} KB)
                </div>
              )}
              <label className="block text-xs text-[var(--color-ink-muted)] text-right" dir="rtl">
                یا آڈیو فائل اپلوڈ کریں (MP3, WAV, M4A):
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-xs"
                />
              </label>
            </div>
          )}

          {mode === 'video_link' && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-muted)] text-right" dir="rtl">
                ویڈیو یا مضمون کا لنک (URL)
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 text-sm text-[var(--color-ink)]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-muted)] text-right" dir="rtl">
              {mode === 'video_transcript'
                ? 'ویڈیو کی تحریر (Transcript)'
                : 'دعویٰ، حدیث کا حوالہ یا سوال لکھیں'}
            </label>
            <textarea
              rows={4}
              dir="auto"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="یہاں دعویٰ، قول یا ویڈیو کے متعلق سوال لکھیں…"
              className="mt-1 w-full rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-emerald)] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {examples.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => {
                  setMode(ex.mode);
                  setTextInput(ex.text);
                }}
                className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              >
                مثال: {ex.label}
              </button>
            ))}
          </div>

          {error && (
            <div dir="rtl" className="rounded-md border border-[var(--color-crimson)]/40 bg-[var(--color-navy)] px-3 py-2 text-xs text-[var(--color-crimson)] text-right">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              (!textInput.trim() && !selectedFile && !recordedBlob && !videoUrl.trim())
            }
            className="w-full rounded-lg bg-[var(--color-emerald-deep)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-emerald)] hover:text-slate-950 disabled:opacity-50"
          >
            {loading ? 'تحقیق اور مستند حوالوں کی جانچ جاری ہے…' : 'تصدیق کریں اور حوالے دکھائیں'}
          </button>
        </form>

        {/* Right: Transparent Verification Report */}
        <div className="lg:col-span-7">
          {!report && !loading ? (
            <div dir="rtl" lang="ur" className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-6 space-y-4 text-right">
              <h3 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                تصدیق کا مستند طریقہ کار
              </h3>
              <p className="text-xs text-[var(--color-ink-muted)] leading-loose">
                کوئی بھی PDF، تصویر، آڈیو، ویڈیو کلپ، ویڈیو لنک یا دعویٰ جمع کریں۔ نظام پہلے متن یا آواز نکالتا ہے اور پھر قرآن، صحیح احادیث، آپ کی کتب اور آن لائن مستند ذرائع سے جانچ کر کے اردو میں فیصلہ دیتا ہے۔
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[var(--color-border-hairline)] pt-4 text-xs">
                <div>
                  <dt className="font-semibold text-[var(--color-emerald)]">مستند ماخذ سے ثابت</dt>
                  <dd className="text-[var(--color-ink-muted)] mt-0.5">الفاظ اور حوالہ بنیادی مستند کتابوں سے مطابق ہے۔</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--color-amber-warn)]">جزوی / سیاق و سباق نامکمل</dt>
                  <dd className="text-[var(--color-ink-muted)] mt-0.5">اصل بات موجود ہے مگر شرط یا پس منظر ادھورا ہے۔</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--color-crimson)]">غلط نسبت / مختلف فیہ</dt>
                  <dd className="text-[var(--color-ink-muted)] mt-0.5">غلط کتاب سے منسوب یا سند میں اختلاف ہے۔</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[var(--color-ink)]">تصدیق ممکن نہیں</dt>
                  <dd className="text-[var(--color-ink-muted)] mt-0.5">بغیر ثبوت کسی بات کو حتمی طور پر غلط یا صحیح نہیں کہا جاتا۔</dd>
                </div>
              </dl>
            </div>
          ) : loading ? (
            <div dir="rtl" className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-8 text-sm text-[var(--color-emerald)] text-right">
              مواد کا جائزہ لیا جا رہا ہے — قرآن، حدیث، کتب اور آن لائن ذرائع چیک ہو رہے ہیں…
            </div>
          ) : report ? (
            <div className="space-y-5">
              <article className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-hairline)] pb-4">
                  <div className="flex items-center gap-2">
                    {report.outcome === 'Supported by the cited source' ? (
                      <ShieldCheck className="h-5 w-5 text-[var(--color-emerald)]" aria-hidden="true" />
                    ) : report.outcome === 'Not found in available sources' ||
                      report.outcome === 'Unable to verify' ? (
                      <HelpCircle className="h-5 w-5 text-[var(--color-ink-muted)]" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-[var(--color-amber-warn)]" aria-hidden="true" />
                    )}
                    <span className={`text-sm font-semibold ${getOutcomeStyle(report.outcome).colorClass}`}>
                      نتیجہ: {getOutcomeStyle(report.outcome).label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      playInlineUrduSpeech(
                        `${getOutcomeStyle(report.outcome).label}۔ ${report.explanation}`
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-emerald)] hover:underline"
                  >
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                    سنیں (اردو)
                  </button>
                </div>

                <div dir="rtl" lang="ur" className="mt-4 space-y-4 text-sm text-right">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--color-ink-subtle)]">
                      نکالا گیا دعویٰ
                    </h3>
                    <p className="mt-1 font-medium text-[var(--color-ink)] leading-loose">{report.claim}</p>
                  </div>

                  {report.whatNeedsVerification.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--color-ink-subtle)]">
                        کن نکات کی تصدیق ضروری تھی
                      </h3>
                      <ul className="mt-1 list-disc pr-5 text-[var(--color-ink-muted)] space-y-1 text-xs leading-relaxed">
                        {report.whatNeedsVerification.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--color-border-hairline)]">
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--color-ink-subtle)]">
                        قدیم ترین مستند ماخذ
                      </h3>
                      <p className="mt-1 text-xs text-[var(--color-gold-soft)] leading-relaxed">{report.earliestTraceableSource}</p>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--color-ink-subtle)]">
                        اعتبار اور دائرہ کار
                      </h3>
                      <p className="mt-1 text-xs text-[var(--color-ink-muted)] leading-relaxed">{report.confidenceNote}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-border-hairline)]">
                    <h3 className="text-xs font-semibold text-[var(--color-ink-subtle)]">
                      شواہد کا تقابل اور تفصیلی وضاحت (اردو)
                    </h3>
                    <p className="mt-1 text-[var(--color-ink)] leading-loose whitespace-pre-wrap">
                      {report.evidenceComparison}
                    </p>
                    <p className="mt-2 text-[var(--color-ink-muted)] leading-loose whitespace-pre-wrap">
                      {report.explanation}
                    </p>
                  </div>
                </div>
              </article>

              {report.mediaBreakdown && (
                <article dir="rtl" lang="ur" className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-3 text-right">
                  <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                    آڈیو / ویڈیو تجزیہ
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-md bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)]">
                      <div className="font-semibold text-[var(--color-gold-soft)]">۱۔ اصل تحریر (Transcript)</div>
                      <p className="mt-1 text-[var(--color-ink)] whitespace-pre-wrap leading-relaxed">
                        {report.mediaBreakdown.exactTranscript || '—'}
                      </p>
                    </div>
                    <div className="rounded-md bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)]">
                      <div className="font-semibold text-[var(--color-gold-soft)]">۲۔ اردو ترجمہ</div>
                      <p className="mt-1 text-[var(--color-ink)] whitespace-pre-wrap leading-loose">
                        {report.mediaBreakdown.translation || '—'}
                      </p>
                    </div>
                    <div className="rounded-md bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)]">
                      <div className="font-semibold text-[var(--color-gold-soft)]">۳۔ علمی تشریح</div>
                      <p className="mt-1 text-[var(--color-ink)] whitespace-pre-wrap leading-loose">
                        {report.mediaBreakdown.interpretation || '—'}
                      </p>
                    </div>
                    <div className="rounded-md bg-[var(--color-navy)] p-3 border border-[var(--color-border-hairline)]">
                      <div className="font-semibold text-[var(--color-gold-soft)]">۴۔ خلاصہ</div>
                      <p className="mt-1 text-[var(--color-ink)] whitespace-pre-wrap leading-loose">
                        {report.mediaBreakdown.aiSummary || '—'}
                      </p>
                    </div>
                  </div>
                </article>
              )}

              {report.webSources && report.webSources.length > 0 && (
                <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4 space-y-2 text-xs">
                  <h3 className="font-semibold text-[var(--color-gold-soft)] text-right" dir="rtl">
                    آن لائن مستند ذرائع (کہاں سے تصدیق کی گئی)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {report.webSources.map((ws) => (
                      <a
                        key={ws.url}
                        href={ws.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-1.5 text-[var(--color-emerald)] hover:border-[var(--color-emerald)]"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="max-w-[260px] truncate">{ws.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {report.citations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-[var(--color-ink-subtle)] text-right" dir="rtl">
                    مستند کتابی حوالہ جات
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {report.citations.map((c) => (
                      <CitationCard
                        key={c.id}
                        passage={c}
                        compact
                        onReadAloud={(txt) => playInlineUrduSpeech(txt)}
                        onAskInStudio={onAskInStudio}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
