import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Upload,
  Maximize2,
  Minimize2,
  GitCompare,
  Send,
  Volume2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Mic,
  Square,
  MessageSquare,
  Languages,
  Trash2,
  Globe,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { MicrophoneRecorder } from '../utils/audioUtils.ts';
import { playInlineUrduSpeech } from '../utils/ttsPlayer.ts';
import type {
  BookComparisonReport,
  CompanionChatMessage,
  IslamicBook,
  WebSourceCitation,
} from '../types.ts';

interface BookLibraryViewProps {
  onSpeakText: (text: string) => void;
  onAskInLiveVoice: (contextPrompt: string) => void;
}

interface OnlineBookChatItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  webSources?: WebSourceCitation[];
  timestamp: string;
}

export const BookLibraryView: React.FC<BookLibraryViewProps> = ({
  onAskInLiveVoice,
}) => {
  const [libraryMode, setLibraryMode] = useState<'my_books' | 'online'>('my_books');

  const [books, setBooks] = useState<IslamicBook[]>([]);
  const [activeBook, setActiveBook] = useState<IslamicBook | null>(null);
  const [pageIdx, setPageIdx] = useState<number>(0);
  const [fullScreenReader, setFullScreenReader] = useState<boolean>(false);
  const [readingTheme, setReadingTheme] = useState<'navy' | 'light' | 'parchment'>('navy');

  // Upload Personal Book
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadRawText, setUploadRawText] = useState('');
  const [uploading, setUploading] = useState(false);

  // Multi-Turn Personal Book Chat + Voice Mic
  const [highlightedPassage, setHighlightedPassage] = useState('');
  const [question, setQuestion] = useState('');
  const [bookChatMessages, setBookChatMessages] = useState<CompanionChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [micRecording, setMicRecording] = useState(false);
  const [micTranscribing, setMicTranscribing] = useState(false);
  const bookRecorderRef = useRef<MicrophoneRecorder | null>(null);

  // Urdu Page / Full Book Translation
  const [translatingScope, setTranslatingScope] = useState<'page' | 'full' | null>(null);
  const [showBookUrdu, setShowBookUrdu] = useState<boolean>(true);

  // Book-to-Book Comparison (when user adds 2+ books)
  const [compareMode, setCompareMode] = useState(false);
  const [compareBookIds, setCompareBookIds] = useState<string[]>([]);
  const [compareSubject, setCompareSubject] = useState('');
  const [comparisonReport, setComparisonReport] = useState<BookComparisonReport | null>(null);
  const [comparing, setComparing] = useState(false);

  // Online Books Search & Q&A Mode
  const [onlineQuestion, setOnlineQuestion] = useState('');
  const [onlineMessages, setOnlineMessages] = useState<OnlineBookChatItem[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineMicRecording, setOnlineMicRecording] = useState(false);
  const onlineRecorderRef = useRef<MicrophoneRecorder | null>(null);

  const loadBooks = async () => {
    const res = await fetch('/api/library/books');
    const data = await res.json();
    const list: IslamicBook[] = data.books || [];
    setBooks(list);
    if (activeBook && !list.some((b) => b.id === activeBook.id)) {
      setActiveBook(list[0] || null);
      setPageIdx(0);
    } else if (!activeBook && list.length > 0) {
      setActiveBook(list[0]);
      setPageIdx(0);
    }
  };

  useEffect(() => {
    loadBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPage = activeBook?.pages[pageIdx] || activeBook?.pages[0] || null;

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile && !uploadRawText.trim()) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', uploadTitle || uploadFile?.name || 'میری شامل کردہ کتاب');
      formData.append('author', uploadAuthor || 'مصنف نامعلوم');
      if (uploadFile) formData.append('file', uploadFile);
      if (uploadRawText.trim()) formData.append('rawText', uploadRawText.trim());

      const res = await fetch('/api/library/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.book) {
        setShowUpload(false);
        setUploadTitle('');
        setUploadAuthor('');
        setUploadFile(null);
        setUploadRawText('');
        await loadBooks();
        setActiveBook(data.book);
        setPageIdx(0);
        setBookChatMessages([]);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    await fetch(`/api/library/books/${encodeURIComponent(bookId)}`, { method: 'DELETE' });
    setCompareBookIds((prev) => prev.filter((id) => id !== bookId));
    if (activeBook?.id === bookId) {
      setActiveBook(null);
      setBookChatMessages([]);
    }
    await loadBooks();
  };

  const handleAskWhileReading = async (qText: string) => {
    if (!activeBook || !currentPage || !qText.trim()) return;
    const cleanQ = qText.trim();
    const userMsg: CompanionChatMessage = {
      id: `bk-u-${Date.now()}`,
      role: 'user',
      content: cleanQ,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...bookChatMessages, userMsg];
    setBookChatMessages(nextHistory);
    setQuestion('');
    setAsking(true);

    try {
      const res = await fetch('/api/library/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: activeBook.id,
          digitalPage: currentPage.digitalPage,
          selectedPassage: highlightedPassage || undefined,
          question: cleanQ,
          history: nextHistory.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.answer) {
        const cit = data.citation;
        setBookChatMessages((prev) => [
          ...prev,
          {
            id: `bk-a-${Date.now()}`,
            role: 'assistant',
            content: data.answer,
            citationNote: cit
              ? `${cit.bookTitle} (${cit.author}) · ${cit.printedPage} · ${cit.chapter}`
              : undefined,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setAsking(false);
    }
  };

  const toggleBookChatMic = async () => {
    if (micRecording && bookRecorderRef.current) {
      setMicRecording(false);
      setMicTranscribing(true);
      try {
        const { blob, mimeType } = await bookRecorderRef.current.stop();
        bookRecorderRef.current = null;
        const fd = new FormData();
        fd.append('audio', blob, 'book-question.webm');
        fd.append('mimeType', mimeType);
        fd.append('saveAudio', 'false');
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.transcript) {
          setQuestion(data.transcript);
        }
      } finally {
        setMicTranscribing(false);
      }
      return;
    }

    try {
      const rec = new MicrophoneRecorder();
      bookRecorderRef.current = rec;
      setMicRecording(true);
      await rec.start({ autoStopOnSilence: false });
    } catch {
      setMicRecording(false);
    }
  };

  const handleTranslateBook = async (scope: 'page' | 'full') => {
    if (!activeBook || !currentPage) return;
    setTranslatingScope(scope);
    try {
      const res = await fetch('/api/library/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: activeBook.id,
          scope,
          digitalPage: currentPage.digitalPage,
        }),
      });
      const data = await res.json();
      if (res.ok && data.book) {
        setActiveBook(data.book);
        setBooks((prev) => prev.map((b) => (b.id === data.book.id ? data.book : b)));
        setShowBookUrdu(true);
      }
    } finally {
      setTranslatingScope(null);
    }
  };

  const handleCompareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (compareBookIds.length < 2 || !compareSubject.trim()) return;
    setComparing(true);
    try {
      const res = await fetch('/api/library/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookIds: compareBookIds, subject: compareSubject }),
      });
      const data = await res.json();
      if (data.report) setComparisonReport(data.report);
    } finally {
      setComparing(false);
    }
  };

  const handleOnlineBookAsk = async (qOverride?: string) => {
    const cleanQ = (qOverride ?? onlineQuestion).trim();
    if (!cleanQ || onlineLoading) return;
    const userItem: OnlineBookChatItem = {
      id: `on-u-${Date.now()}`,
      role: 'user',
      content: cleanQ,
      timestamp: new Date().toLocaleTimeString(),
    };
    const nextHist = [...onlineMessages, userItem];
    setOnlineMessages(nextHist);
    setOnlineQuestion('');
    setOnlineLoading(true);
    try {
      const res = await fetch('/api/library/online-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: cleanQ,
          history: nextHist.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.answer) {
        setOnlineMessages((prev) => [
          ...prev,
          {
            id: `on-a-${Date.now()}`,
            role: 'assistant',
            content: data.answer,
            webSources: data.webSources || [],
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    } finally {
      setOnlineLoading(false);
    }
  };

  const toggleOnlineMic = async () => {
    if (onlineMicRecording && onlineRecorderRef.current) {
      setOnlineMicRecording(false);
      try {
        const { blob, mimeType } = await onlineRecorderRef.current.stop();
        onlineRecorderRef.current = null;
        const fd = new FormData();
        fd.append('audio', blob, 'online-book-q.webm');
        fd.append('mimeType', mimeType);
        fd.append('saveAudio', 'false');
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.transcript) {
          setOnlineQuestion(data.transcript);
        }
      } catch {
        // ignore
      }
      return;
    }

    try {
      const rec = new MicrophoneRecorder();
      onlineRecorderRef.current = rec;
      setOnlineMicRecording(true);
      await rec.start({ autoStopOnSilence: false });
    } catch {
      setOnlineMicRecording(false);
    }
  };

  const readerThemeClass =
    readingTheme === 'light'
      ? 'reading-light'
      : readingTheme === 'parchment'
        ? 'reading-parchment'
        : 'reading-navy';

  const quickReaderQuestions = [
    'اس صفحے کا آسان اردو میں خلاصہ اور اہم نکات بتائیں۔',
    'اس واقعے یا فیصلے کا پسِ منظر اور حکمت تفصیل سے سمجھائیں۔',
    'اس عبارت میں موجود عربی/مذہبی اصطلاحات کا مطلب اردو میں بتائیں۔',
  ];

  const quickOnlinePrompts = [
    'صحیح بخاری میں نیت اور اخلاص کے بارے میں کون سی احادیث ہیں؟ اردو ترجمے اور نمبر کے ساتھ بتائیں۔',
    'الرحیق المختوم کے مطابق صلح حدیبیہ کی اہم شرائط اور حکمت اردو میں بتائیں۔',
    'امام غزالی کی کتاب احیاء العلوم میں غصے اور حسد کا کیا علاج بتایا گیا ہے؟',
    'تفسیر ابن کثیر میں سورۃ العصر کی تفسیر اردو میں بیان کریں۔',
  ];

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-6 space-y-5">
      {/* Header + 2 Clear Modes */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border-hairline)] pb-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--color-ink)]">
            ذاتی کتب خانہ اور آن لائن کتب تلاش
          </h1>
          <p dir="rtl" lang="ur" className="mt-1 text-sm text-[var(--color-ink-muted)] text-right">
            اپنی کتابیں خود شامل کریں، اردو ترجمہ پڑھیں و سنیں، یا براہِ راست آن لائن مستند کتابیں تلاش کر کے سوال و جواب کریں۔
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setLibraryMode('my_books')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-medium transition-colors whitespace-nowrap shrink-0 ${
                libraryMode === 'my_books'
                  ? 'bg-[var(--color-emerald-deep)] text-white'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              میری کتابیں ({books.length})
            </button>
            <button
              type="button"
              onClick={() => setLibraryMode('online')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-medium transition-colors whitespace-nowrap shrink-0 ${
                libraryMode === 'online'
                  ? 'bg-[var(--color-emerald-deep)] text-white'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              آن لائن کتب تلاش و سوال جواب
            </button>
          </div>

          {libraryMode === 'my_books' && (
            <>
              {books.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setCompareMode((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
                    compareMode
                      ? 'bg-[var(--color-gold)] text-slate-950'
                      : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] text-[var(--color-ink)]'
                  }`}
                >
                  <GitCompare className="h-4 w-4" aria-hidden="true" />
                  کتابوں کا موازنہ
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowUpload((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-emerald-deep)] px-3.5 py-2 text-xs font-medium text-white hover:bg-[var(--color-emerald)] hover:text-slate-950 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                نئی کتاب شامل کریں
              </button>
            </>
          )}
        </div>
      </div>

      {/* MODE 1: ONLINE BOOKS SEARCH & Q&A */}
      {libraryMode === 'online' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-4">
            <div dir="rtl" lang="ur" className="text-right space-y-1">
              <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                آن لائن اسلامی کتابوں میں تلاش اور سوال جواب (مکمل اردو میں)
              </h2>
              <p className="text-xs text-[var(--color-ink-muted)]">
                کسی بھی کتاب، حدیث، سیرت، فقہ، تاریخ یا مصنف کے بارے میں سوال لکھیں یا مائیک سے بولیں — جواب مستند آن لائن مآخذ کے ساتھ اردو میں ملے گا اور آپ سن بھی سکتے ہیں۔
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleOnlineBookAsk();
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleOnlineMic}
                aria-label={onlineMicRecording ? 'مائیک روکیں' : 'بول کر سوال پوچھیں'}
                className={`rounded-lg p-3 transition-colors ${
                  onlineMicRecording
                    ? 'bg-[#B91C1C] text-white'
                    : 'border border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-emerald)]'
                }`}
              >
                {onlineMicRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <input
                type="text"
                dir="rtl"
                lang="ur"
                value={onlineQuestion}
                onChange={(e) => setOnlineQuestion(e.target.value)}
                placeholder="کتاب کا نام یا سوال لکھیں (مثلاً: صحیح بخاری، الرحیق المختوم، احیاء العلوم، تفسیر ابن کثیر)…"
                className="flex-1 min-w-[240px] rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-4 py-3 text-sm text-[var(--color-ink)] text-right focus:border-[var(--color-emerald)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={onlineLoading || !onlineQuestion.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-5 py-3 text-xs font-medium text-white hover:bg-[var(--color-emerald)] hover:text-slate-950 disabled:opacity-50 whitespace-nowrap"
              >
                <Send className="h-4 w-4" />
                {onlineLoading ? 'تلاش جاری ہے…' : 'آن لائن کتابیں تلاش کریں'}
              </button>
            </form>

            {onlineMessages.length === 0 && (
              <div dir="rtl" lang="ur" className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-right">
                {quickOnlinePrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleOnlineBookAsk(p)}
                    className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3.5 py-2.5 text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-emerald)] hover:text-[var(--color-ink)] text-right"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {onlineMessages.length > 0 && (
            <div className="space-y-3">
              {onlineMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl border p-5 ${
                    msg.role === 'user'
                      ? 'border-[var(--color-emerald)]/40 bg-[var(--color-emerald-deep)]/15'
                      : 'border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                    <span className="font-semibold text-[var(--color-emerald)]">
                      {msg.role === 'user' ? 'آپ کا سوال' : 'آن لائن کتب تحقیق (اردو)'}
                    </span>
                    <div className="flex items-center gap-3">
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => playInlineUrduSpeech(msg.content)}
                          className="inline-flex items-center gap-1 text-[var(--color-emerald)] hover:underline"
                        >
                          <Volume2 className="h-3.5 w-3.5" /> سنیں (اردو)
                        </button>
                      )}
                      <span className="font-mono text-[var(--color-ink-subtle)]">{msg.timestamp}</span>
                    </div>
                  </div>
                  <p dir="rtl" lang="ur" className="text-base text-right leading-loose whitespace-pre-wrap text-[var(--color-ink)]">
                    {msg.content}
                  </p>
                  {msg.webSources && msg.webSources.length > 0 && (
                    <div className="mt-4 border-t border-[var(--color-border-hairline)] pt-3 space-y-2">
                      <div dir="rtl" lang="ur" className="text-xs font-semibold text-[var(--color-gold-soft)] text-right">
                        آن لائن مآخذ و روابط:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.webSources.map((ws) => (
                          <a
                            key={ws.url}
                            href={ws.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-1.5 text-xs text-[var(--color-emerald)] hover:border-[var(--color-emerald)]"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="max-w-[280px] truncate">{ws.title || ws.url}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {onlineLoading && (
                <div dir="rtl" lang="ur" className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4 text-sm text-[var(--color-emerald)] text-right">
                  آن لائن مستند کتب سے حوالہ جات تلاش کیے جا رہے ہیں…
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: PERSONAL BOOKS (EMPTY UNTIL USER ADDS) */}
      {libraryMode === 'my_books' && (
        <>
          {/* Upload Book Panel */}
          {showUpload && (
            <form
              onSubmit={handleUploadSubmit}
              className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                  اپنی کتاب شامل کریں (PDF / تصویر / ٹیکسٹ)
                </h2>
                <button type="button" onClick={() => setShowUpload(false)} className="text-[var(--color-ink-subtle)]">
                  بند کریں
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  dir="rtl"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="کتاب کا نام"
                  className="rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 text-[var(--color-ink)] text-right"
                />
                <input
                  type="text"
                  dir="rtl"
                  value={uploadAuthor}
                  onChange={(e) => setUploadAuthor(e.target.value)}
                  placeholder="مصنف کا نام (اختیاری)"
                  className="rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 text-[var(--color-ink)] text-right"
                />
                <input
                  type="file"
                  accept=".pdf,.txt,.md,image/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-1.5 text-[var(--color-ink-muted)]"
                />
              </div>
              <textarea
                rows={4}
                dir="rtl"
                value={uploadRawText}
                onChange={(e) => setUploadRawText(e.target.value)}
                placeholder="یا کتاب کا متن (عربی، اردو یا انگریزی) یہاں پیسٹ کریں…"
                className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 text-[var(--color-ink)] text-right"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading || (!uploadFile && !uploadRawText.trim())}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-emerald-deep)] px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? 'کتاب شامل کی جا رہی ہے…' : 'کتب خانے میں محفوظ کریں'}
                </button>
              </div>
            </form>
          )}

          {/* Book-to-Book Comparison Mode */}
          {compareMode && books.length >= 2 && (
            <div className="rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-4">
              <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                شامل کردہ کتابوں کا تقابلی جائزہ
              </h2>
              <form onSubmit={handleCompareSubmit} className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-2">
                  {books.map((b) => {
                    const checked = compareBookIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          setCompareBookIds((prev) =>
                            checked ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                          )
                        }
                        className={`rounded-md px-3 py-1.5 font-medium border ${
                          checked
                            ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)]/20 text-[var(--color-ink)]'
                            : 'border-[var(--color-border-hairline)] bg-[var(--color-navy)] text-[var(--color-ink-muted)]'
                        }`}
                      >
                        {b.title}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    dir="rtl"
                    value={compareSubject}
                    onChange={(e) => setCompareSubject(e.target.value)}
                    placeholder="جس موضوع یا واقعے کا موازنہ کرنا ہے وہ لکھیں…"
                    className="flex-1 rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 text-sm text-[var(--color-ink)] text-right"
                  />
                  <button
                    type="submit"
                    disabled={comparing || compareBookIds.length < 2 || !compareSubject.trim()}
                    className="rounded-lg bg-[var(--color-emerald-deep)] px-5 py-2 text-xs font-medium text-white disabled:opacity-50 whitespace-nowrap"
                  >
                    {comparing ? 'موازنہ جاری ہے…' : `موازنہ کریں (${compareBookIds.length})`}
                  </button>
                </div>
              </form>

              {comparisonReport && (
                <div dir="rtl" lang="ur" className="space-y-4 border-t border-[var(--color-border-hairline)] pt-4 text-xs text-right">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded bg-[var(--color-navy)] p-3.5 border border-[var(--color-border-hairline)]">
                      <div className="font-semibold text-[var(--color-emerald)]">متفقہ نکات</div>
                      <ul className="mt-1.5 list-disc pr-4 space-y-1 text-[var(--color-ink-muted)]">
                        {comparisonReport.agreements.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded bg-[var(--color-navy)] p-3.5 border border-[var(--color-border-hairline)]">
                      <div className="font-semibold text-[var(--color-amber-warn)]">اختلافی یا غیر مصدقہ نکات</div>
                      <ul className="mt-1.5 list-disc pr-4 space-y-1 text-[var(--color-ink-muted)]">
                        {comparisonReport.missingOrDisputedEvidence.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty State if User Has Not Added Any Book Yet */}
          {books.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-10 text-center space-y-4">
              <BookOpen className="mx-auto h-9 w-9 text-[var(--color-gold-soft)]" aria-hidden="true" />
              <div dir="rtl" lang="ur" className="space-y-2 max-w-xl mx-auto">
                <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                  آپ کا ذاتی کتب خانہ ابھی خالی ہے
                </h2>
                <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">
                  پرانی تمام کتابیں ہٹا دی گئی ہیں۔ اب آپ اپنی مرضی کی کوئی بھی PDF، تصویر یا متن خود شامل کر کے اس کا اردو ترجمہ پڑھ سکتے ہیں اور سوال پوچھ سکتے ہیں — یا اوپر &quot;آن لائن کتب تلاش و سوال جواب&quot; استعمال کریں۔
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-emerald-deep)] px-5 py-2.5 text-xs font-medium text-white hover:bg-[var(--color-emerald)] hover:text-slate-950"
                >
                  <Plus className="h-4 w-4" /> پہلی کتاب خود شامل کریں
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryMode('online')}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-5 py-2.5 text-xs font-medium text-[var(--color-emerald)] hover:border-[var(--color-emerald)]"
                >
                  <Globe className="h-4 w-4" /> آن لائن کتابیں تلاش کریں
                </button>
              </div>
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${fullScreenReader ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-5 items-start`}>
              {/* LEFT: User's Added Books List with Delete */}
              {!fullScreenReader && (
                <aside className="lg:col-span-3 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--color-gold-soft)]">آپ کی شامل کردہ کتابیں</span>
                    <button
                      type="button"
                      onClick={() => setShowUpload(true)}
                      className="text-[var(--color-emerald)] hover:underline"
                    >
                      + شامل کریں
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                    {books.map((b) => (
                      <div
                        key={b.id}
                        className={`flex items-start justify-between gap-2 rounded-md p-2.5 border transition-colors ${
                          activeBook?.id === b.id
                            ? 'border-[var(--color-emerald)] bg-[var(--color-emerald-deep)]/15 text-[var(--color-ink)]'
                            : 'border-transparent hover:bg-[var(--color-navy-elevated)] text-[var(--color-ink-muted)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBook(b);
                            setPageIdx(0);
                            setBookChatMessages([]);
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="font-semibold text-[var(--color-ink)] leading-snug">{b.title}</div>
                          <div className="mt-0.5 text-[11px] text-[var(--color-ink-subtle)]">
                            {b.author} · {b.pages.length} صفحات
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBook(b.id)}
                          aria-label={`Delete ${b.title}`}
                          className="rounded p-1 text-[var(--color-crimson)] hover:bg-[var(--color-navy)] shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </aside>
              )}

              {/* CENTER: Book Page Reader + Pure Urdu Translation */}
              <div className={fullScreenReader ? 'lg:col-span-1' : 'lg:col-span-5'}>
                {activeBook && currentPage && (
                  <div className={`rounded-xl border p-6 space-y-4 ${readerThemeClass}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 pb-3 text-xs">
                      <div>
                        <div className="font-display text-xl font-semibold">{activeBook.title}</div>
                        <div className="opacity-75">
                          {activeBook.author} · {currentPage.printedPage}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setReadingTheme((t) =>
                              t === 'navy' ? 'light' : t === 'light' ? 'parchment' : 'navy'
                            )
                          }
                          className="rounded border border-current/20 px-2.5 py-1"
                        >
                          تھیم: {readingTheme === 'navy' ? 'ڈارک' : readingTheme === 'light' ? 'لائٹ' : 'کاغذ'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFullScreenReader((v) => !v)}
                          aria-label="Toggle full screen reading"
                          className="rounded border border-current/20 p-1.5"
                        >
                          {fullScreenReader ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {currentPage.ocrUncertain && (
                      <div dir="rtl" lang="ur" className="flex items-center gap-2 rounded border border-[var(--color-amber-warn)]/40 bg-[var(--color-amber-warn)]/10 px-3 py-2 text-xs text-[var(--color-amber-warn)] text-right">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>اسکین غیر واضح ہونے کا امکان ہے — اصل صفحے سے تحریر کی تصدیق کر لیں۔</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-b border-current/15 pb-3 text-xs">
                      <button
                        type="button"
                        disabled={translatingScope !== null}
                        onClick={() => handleTranslateBook('page')}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-emerald-deep)] px-3 py-1.5 font-medium text-white hover:bg-[var(--color-emerald)] hover:text-slate-950 disabled:opacity-50"
                      >
                        <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                        {translatingScope === 'page' ? 'اردو ترجمہ ہو رہا ہے…' : 'اس صفحے کا اردو ترجمہ'}
                      </button>
                      <button
                        type="button"
                        disabled={translatingScope !== null}
                        onClick={() => handleTranslateBook('full')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-emerald)]/40 px-3 py-1.5 font-medium text-[var(--color-emerald)] hover:bg-[var(--color-emerald-deep)]/15 disabled:opacity-50"
                      >
                        <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                        {translatingScope === 'full' ? 'پوری کتاب کا ترجمہ ہو رہا ہے…' : 'پوری کتاب کا اردو ترجمہ'}
                      </button>
                      {currentPage.urduTranslation && (
                        <button
                          type="button"
                          onClick={() => setShowBookUrdu((v) => !v)}
                          className="rounded border border-current/20 px-2.5 py-1.5"
                        >
                          {showBookUrdu ? 'ترجمہ چھپائیں' : 'ترجمہ دکھائیں'}
                        </button>
                      )}
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${activeBook.id}-${currentPage.digitalPage}`}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-4"
                      >
                        <div className="text-xs font-semibold opacity-70">{currentPage.chapter}</div>

                        {currentPage.arabicText && (
                          <p dir="rtl" lang="ar" className="font-arabic text-2xl text-right leading-loose">
                            {currentPage.arabicText}
                          </p>
                        )}

                        {showBookUrdu && currentPage.urduTranslation && (
                          <div className="rounded-lg border border-[var(--color-emerald)]/35 bg-[var(--color-emerald-deep)]/10 p-4 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-[var(--color-emerald)]">اردو ترجمہ</span>
                              <button
                                type="button"
                                onClick={() => playInlineUrduSpeech(currentPage.urduTranslation || '')}
                                className="inline-flex items-center gap-1 text-[var(--color-emerald)] hover:underline"
                              >
                                <Volume2 className="h-3.5 w-3.5" /> سنیں (اردو)
                              </button>
                            </div>
                            <p dir="rtl" lang="ur" className="text-base text-right leading-loose whitespace-pre-wrap">
                              {currentPage.urduTranslation}
                            </p>
                          </div>
                        )}

                        <div
                          onMouseUp={() => {
                            const sel = window.getSelection()?.toString().trim();
                            if (sel) setHighlightedPassage(sel);
                          }}
                          className="text-sm leading-relaxed whitespace-pre-wrap select-text"
                        >
                          {currentPage.text}
                        </div>
                      </motion.div>
                    </AnimatePresence>

                    {/* Page Navigation */}
                    <div className="flex items-center justify-between border-t border-current/15 pt-3 text-xs">
                      <button
                        type="button"
                        disabled={pageIdx <= 0}
                        onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
                        className="inline-flex items-center gap-1 rounded border border-current/20 px-3 py-1.5 disabled:opacity-40"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> پچھلا صفحہ
                      </button>
                      <span className="font-mono tabular-nums">
                        صفحہ {currentPage.digitalPage} / {activeBook.pages.length}
                      </span>
                      <button
                        type="button"
                        disabled={pageIdx >= activeBook.pages.length - 1}
                        onClick={() => setPageIdx((p) => Math.min(activeBook.pages.length - 1, p + 1))}
                        className="inline-flex items-center gap-1 rounded border border-current/20 px-3 py-1.5 disabled:opacity-40"
                      >
                        اگلا صفحہ <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Book Companion Urdu Chat */}
              {!fullScreenReader && (
                <aside className="lg:col-span-4 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4 flex flex-col h-[640px] text-xs">
                  <div className="flex items-center justify-between border-b border-[var(--color-border-hairline)] pb-2.5">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-[var(--color-ink)] inline-flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-[var(--color-emerald)]" aria-hidden="true" />
                        کتاب کے بارے میں سوال (اردو)
                      </h2>
                      <p dir="rtl" lang="ur" className="mt-0.5 text-[11px] text-[var(--color-ink-subtle)] text-right">
                        کھلے ہوئے صفحے سے متعلق کوئی بھی سوال پوچھیں۔
                      </p>
                    </div>
                    {bookChatMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setBookChatMessages([])}
                        className="text-[11px] text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]"
                      >
                        صاف کریں
                      </button>
                    )}
                  </div>

                  {highlightedPassage && (
                    <div className="mt-2.5 rounded bg-[var(--color-navy)] p-2.5 border border-[var(--color-emerald)]/40">
                      <div className="flex items-center justify-between text-[11px] text-[var(--color-emerald)]">
                        <span>منتخب عبارت</span>
                        <button type="button" onClick={() => setHighlightedPassage('')} className="underline">
                          ہٹائیں
                        </button>
                      </div>
                      <p className="mt-1 italic text-[var(--color-ink-muted)] line-clamp-2">
                        “{highlightedPassage}”
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {bookChatMessages.length === 0 ? (
                      <div dir="rtl" lang="ur" className="space-y-2 text-right">
                        <div className="text-[11px] font-medium text-[var(--color-gold-soft)]">
                          فوری سوالات:
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {quickReaderQuestions.map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => handleAskWhileReading(q)}
                              className="rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-2 text-right text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-emerald)]/50 hover:text-[var(--color-ink)]"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      bookChatMessages.map((msg) => (
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
                              {msg.role === 'user' ? 'آپ' : 'معاون عالم'}
                            </span>
                            {msg.role === 'assistant' && (
                              <button
                                type="button"
                                onClick={() => playInlineUrduSpeech(msg.content)}
                                className="inline-flex items-center gap-1 text-[11px] text-[var(--color-emerald)] hover:underline"
                              >
                                <Volume2 className="h-3 w-3" /> سنیں
                              </button>
                            )}
                          </div>
                          <p dir="rtl" lang="ur" className="whitespace-pre-wrap text-right leading-loose text-sm text-[var(--color-ink)]">
                            {msg.content}
                          </p>
                          {msg.citationNote && (
                            <div className="mt-2 border-t border-[var(--color-border-hairline)] pt-1.5 text-[10px] text-[var(--color-ink-subtle)]">
                              حوالہ: {msg.citationNote}
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}

                    {asking && (
                      <div dir="rtl" lang="ur" className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-3 text-right text-[var(--color-ink-subtle)]">
                        صفحے اور مستند حوالہ جات کی روشنی میں جواب تیار ہو رہا ہے…
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAskWhileReading(question);
                    }}
                    className="mt-3 flex items-center gap-1.5 border-t border-[var(--color-border-hairline)] pt-2.5"
                  >
                    <button
                      type="button"
                      onClick={toggleBookChatMic}
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
                      dir="rtl"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder={micTranscribing ? 'آواز لکھی جا رہی ہے…' : 'صفحے کے بارے میں سوال لکھیں…'}
                      className="flex-1 rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-2 text-right text-[var(--color-ink)]"
                    />
                    <button
                      type="submit"
                      disabled={asking || !question.trim()}
                      className="rounded bg-[var(--color-emerald-deep)] px-3 py-2 text-white disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </form>

                  {activeBook && currentPage && (
                    <button
                      type="button"
                      onClick={() =>
                        onAskInLiveVoice(
                          `میں ابھی کتاب "${activeBook.title}" کا صفحہ ${currentPage.printedPage} پڑھ رہا ہوں۔ اس کے بارے میں اردو میں بات کرنا چاہتا ہوں۔`
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 font-medium text-[var(--color-emerald)] hover:bg-[var(--color-navy-elevated)]"
                    >
                      لائیو کال پر اس صفحے پر بات کریں
                    </button>
                  )}
                </aside>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};
