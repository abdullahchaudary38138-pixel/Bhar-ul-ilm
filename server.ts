import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { speechRecognitionService } from './server/services/speechRecognition.ts';
import { textToSpeechService, type VoiceOption } from './server/services/textToSpeech.ts';
import { audioStorage } from './server/services/audioStorage.ts';
import { conversationManagerService } from './server/services/conversationManager.ts';
import { searchOrchestratorService, type SearchFilters } from './server/services/searchOrchestrator.ts';
import { citationVerifierService } from './server/services/citationVerifier.ts';
import { attachLiveVoiceWebSocket } from './server/services/liveVoiceTransport.ts';
import { quranService } from './server/services/quranService.ts';
import { quranUstaadService } from './server/services/quranUstaadService.ts';
import { tafseerService } from './server/services/tafseerService.ts';
import { tajweedEngineService } from './server/services/tajweedEngine.ts';
import { bookLibraryService } from './server/services/bookLibraryService.ts';
import { learningProgressService } from './server/services/learningProgressService.ts';
import { religionsService } from './server/services/religionsService.ts';
import { kidsAcademyService } from './server/services/kidsAcademyService.ts';
import type { QiraatEdition, ReligionTraditionId } from './src/types.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 45 * 1024 * 1024 },
});

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Attach real-time Gemini Live API WebSocket transport
  attachLiveVoiceWebSocket(server);
  kidsAcademyService.startAutoStoryScheduler();

  // ==========================================
  // 1. VOICE & AUDIO STORAGE ENDPOINTS
  // ==========================================
  app.post('/api/voice/transcribe', upload.single('audio'), async (req, res) => {
    try {
      let audioBase64 = '';
      let mimeType = 'audio/webm';
      const saveAudio = req.body?.saveAudio !== 'false';

      if (req.file) {
        audioBase64 = req.file.buffer.toString('base64');
        mimeType = req.file.mimetype || 'audio/webm';
      } else if (req.body?.audioBase64) {
        audioBase64 = String(req.body.audioBase64);
        mimeType = String(req.body.mimeType || 'audio/webm');
      } else {
        res.status(400).json({ error: 'No audio payload provided.' });
        return;
      }

      const result = await speechRecognitionService.transcribeAndAnalyze({
        audioBase64,
        mimeType,
        saveAudio,
      });

      conversationManagerService.recordRecognitionSample(result.confidence);
      conversationManagerService.recordLatency(result.latencyMs);

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Transcription failed.' });
    }
  });

  app.post('/api/voice/tts', async (req, res) => {
    try {
      const { text, voiceName, style, saveToDisk } = req.body as {
        text?: string;
        voiceName?: VoiceOption;
        style?: string;
        saveToDisk?: boolean;
      };
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Text is required for speech synthesis.' });
        return;
      }
      const result = await textToSpeechService.synthesize({
        text: text.trim(),
        voiceName,
        style:
          style ||
          'Speak like an expressive, warm, educated native Pakistani Urdu speaker having a real conversation—natural Pakistani Urdu intonation, gentle breath pauses, clear classical Arabic pronunciation for Quranic/Islamic words, never robotic or monotonous.',
        saveToDisk,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Speech synthesis failed.' });
    }
  });

  app.get('/api/audio/:filename', (req, res) => {
    const filePath = audioStorage.getAudioPath(req.params.filename);
    if (!filePath) {
      res.status(404).json({ error: 'Audio clip not found.' });
      return;
    }
    res.sendFile(filePath);
  });

  app.delete('/api/audio/:filename', (req, res) => {
    const deleted = audioStorage.deleteAudio(req.params.filename);
    res.json({ deleted });
  });

  // ==========================================
  // 2. QURAN STUDIO, USTAAD & TAFSEER ENDPOINTS
  // ==========================================
  app.get('/api/quran/surahs', (_req, res) => {
    res.json({
      surahs: quranService.getSurahList(),
      juzs: quranService.getJuzList(),
      reciters: quranService.getReciters(),
    });
  });

  app.get('/api/quran/juzs', (_req, res) => {
    res.json({ juzs: quranService.getJuzList() });
  });

  app.get('/api/quran/juz/:number', async (req, res) => {
    try {
      const juzNumber = Number(req.params.number) || 1;
      const reciterId = req.query.reciterId ? Number(req.query.reciterId) : undefined;
      const qiraat = req.query.qiraat ? (String(req.query.qiraat) as QiraatEdition) : undefined;
      const data = await quranService.getJuzAyahs({ juzNumber, reciterId, qiraat });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Para.' });
    }
  });

  app.get('/api/quran/page/:number', async (req, res) => {
    try {
      const pageNumber = Number(req.params.number) || 1;
      const reciterId = req.query.reciterId ? Number(req.query.reciterId) : undefined;
      const qiraat = req.query.qiraat ? (String(req.query.qiraat) as QiraatEdition) : undefined;
      const data = await quranService.getPageAyahs({ pageNumber, reciterId, qiraat });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Mushaf page.' });
    }
  });

  app.post('/api/quran/search', async (req, res) => {
    try {
      const { query } = req.body as { query?: string };
      if (!query || !query.trim()) {
        res.status(400).json({ error: 'Search query is required.' });
        return;
      }
      const result = await quranService.searchQuranSEO(query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Quran search failed.' });
    }
  });

  app.get('/api/quran/surah/:number', async (req, res) => {
    try {
      const surahNumber = Number(req.params.number) || 1;
      const reciterId = req.query.reciterId ? Number(req.query.reciterId) : undefined;
      const qiraat = req.query.qiraat ? (String(req.query.qiraat) as QiraatEdition) : undefined;
      const data = await quranService.getSurahAyahs({ surahNumber, reciterId, qiraat });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Surah.' });
    }
  });

  app.post('/api/quran/ustaad/word', async (req, res) => {
    try {
      const analysis = await quranUstaadService.explainWord(req.body);
      res.json({ analysis });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Word analysis failed.' });
    }
  });

  app.post('/api/quran/ustaad/grammar-tree', async (req, res) => {
    try {
      const tree = await quranUstaadService.buildAyahGrammarTree(req.body);
      learningProgressService.recordGrammarLesson(`Ayah ${req.body.verseKey} Nahw & Structure`);
      res.json({ tree });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Grammar tree failed.' });
    }
  });

  app.post('/api/quran/ustaad/ask', async (req, res) => {
    try {
      const answer = await quranUstaadService.askUstaadQuestion(req.body);
      res.json({ answer });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Ustaad Q&A failed.' });
    }
  });

  app.post('/api/quran/tafseer', async (req, res) => {
    try {
      const report = await tafseerService.generateTafseerResearch(req.body);
      res.json({ report });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Tafseer generation failed.' });
    }
  });

  // ==========================================
  // 3. MODULE A: SPECIALIZED TILAWAT & TAJWEED ENGINE
  // ==========================================
  app.post('/api/tilawat/assess', upload.single('audio'), async (req, res) => {
    try {
      let audioBase64 = '';
      let mimeType = 'audio/webm';
      if (req.file) {
        audioBase64 = req.file.buffer.toString('base64');
        mimeType = req.file.mimetype || 'audio/webm';
      } else if (req.body?.audioBase64) {
        audioBase64 = String(req.body.audioBase64);
        mimeType = String(req.body.mimeType || 'audio/webm');
      } else {
        res.status(400).json({ error: 'Recitation audio is required.' });
        return;
      }

      const result = await tajweedEngineService.assessRecitation({
        verseKey: String(req.body.verseKey || '1:1'),
        expectedArabic: String(req.body.expectedArabic || ''),
        qiraat: String(req.body.qiraat || "Hafs 'an Asim (Madinah Uthmani)"),
        audioBase64,
        mimeType,
        audioDurationSec: Number(req.body.audioDurationSec || 2.0),
        estimatedSnrDb: Number(req.body.estimatedSnrDb || 18),
        saveAudioPermission: req.body.saveAudioPermission === 'true' || req.body.saveAudioPermission === true,
        referenceAudioUrl: req.body.referenceAudioUrl ? String(req.body.referenceAudioUrl) : undefined,
      });

      const mistakesCount = result.findings.filter((f) => f.state !== 'Unable to assess').length;
      learningProgressService.recordTajweedPractice(
        mistakesCount,
        req.body.isRetry === 'true' && mistakesCount === 0
      );

      res.json({ assessment: result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Tilawat assessment failed.' });
    }
  });

  app.get('/api/tilawat/assessments', (_req, res) => {
    res.json({ assessments: tajweedEngineService.listAssessments() });
  });

  app.post('/api/tilawat/qari-review', (req, res) => {
    const updated = tajweedEngineService.submitQariReview(req.body);
    if (!updated) {
      res.status(404).json({ error: 'Assessment not found.' });
      return;
    }
    res.json({ assessment: updated });
  });

  app.get('/api/tilawat/benchmarks', (_req, res) => {
    res.json(tajweedEngineService.getValidationBenchmarks());
  });

  // ==========================================
  // 4. ISLAMIC BOOK LIBRARY, OCR & COMPARISON
  // ==========================================
  app.get('/api/library/books', (req, res) => {
    const category = req.query.category ? String(req.query.category) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    res.json({
      categories: bookLibraryService.getCategories(),
      books: bookLibraryService.listBooks(category, search),
    });
  });

  app.get('/api/library/books/:id', (req, res) => {
    const book = bookLibraryService.getBook(req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Book not found.' });
      return;
    }
    res.json({ book });
  });

  app.delete('/api/library/books/:id', (req, res) => {
    const deleted = bookLibraryService.deleteBook(req.params.id);
    res.json({ deleted });
  });

  app.post('/api/library/online-ask', async (req, res) => {
    try {
      const { question, history } = req.body as {
        question?: string;
        history?: { role: 'user' | 'assistant'; content: string }[];
      };
      if (!question || !question.trim()) {
        res.status(400).json({ error: 'براہِ کرم سوال یا کتاب کا نام درج کریں۔' });
        return;
      }
      const result = await bookLibraryService.askOnlineBooks({
        question: question.trim(),
        history,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'آن لائن کتب تلاش میں مسئلہ پیش آیا۔' });
    }
  });

  app.post('/api/library/upload', upload.single('file'), async (req, res) => {
    try {
      const book = await bookLibraryService.uploadAndProcessBook({
        title: String(req.body?.title || req.file?.originalname || 'Uploaded Book'),
        author: req.body?.author ? String(req.body.author) : undefined,
        edition: req.body?.edition ? String(req.body.edition) : undefined,
        language: req.body?.language || 'Mixed',
        fileBuffer: req.file?.buffer,
        mimeType: req.file?.mimetype,
        rawText: req.body?.rawText ? String(req.body.rawText) : undefined,
      });
      res.json({ book });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Book ingestion failed.' });
    }
  });

  app.post('/api/library/ask', async (req, res) => {
    try {
      const result = await bookLibraryService.askWhileReading(req.body);
      const book = bookLibraryService.getBook(req.body.bookId);
      if (book) {
        learningProgressService.recordBookPageRead(book.id, book.title, Number(req.body.digitalPage || 1));
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Book Q&A failed.' });
    }
  });

  app.post('/api/library/compare', async (req, res) => {
    try {
      const report = await bookLibraryService.compareBooks(req.body);
      res.json({ report });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Book comparison failed.' });
    }
  });

  app.post('/api/library/translate', async (req, res) => {
    try {
      const { bookId, scope, digitalPage } = req.body as {
        bookId?: string;
        scope?: 'page' | 'full';
        digitalPage?: number;
      };
      if (!bookId) {
        res.status(400).json({ error: 'bookId is required.' });
        return;
      }
      const result = await bookLibraryService.translateToUrdu({
        bookId,
        scope: scope === 'full' ? 'full' : 'page',
        digitalPage,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Book Urdu translation failed.' });
    }
  });

  // ==========================================
  // 5. CONVERSATION, SEARCH, VERIFICATION, NOTES & PROGRESS
  // ==========================================
  app.get('/api/conversation/topics', (_req, res) => {
    res.json({ topics: conversationManagerService.getTopics() });
  });

  app.post('/api/conversation/topics', (req, res) => {
    const { title } = req.body as { title?: string };
    const topic = conversationManagerService.createTopic(title);
    res.json({ topic });
  });

  app.post('/api/conversation/turn', async (req, res) => {
    try {
      const { topicId, message, skipConfirmation, voiceMode, fromVoice } = req.body as {
        topicId?: string;
        message?: string;
        skipConfirmation?: boolean;
        voiceMode?: boolean;
        fromVoice?: boolean;
      };
      if (!message || !message.trim()) {
        res.status(400).json({ error: 'Message text is required.' });
        return;
      }
      const result = await conversationManagerService.processTurn({
        topicId,
        message: message.trim(),
        skipConfirmation,
        voiceMode,
        fromVoice,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to process conversation turn.' });
    }
  });

  app.post('/api/conversation/metrics/event', (req, res) => {
    const { event } = req.body as { event?: 'interruption' | 'correction' };
    if (event === 'interruption') conversationManagerService.recordInterruption();
    else if (event === 'correction') conversationManagerService.recordCorrection();
    res.json({ metrics: conversationManagerService.getMetrics() });
  });

  app.get('/api/metrics', (_req, res) => {
    res.json({ metrics: conversationManagerService.getMetrics() });
  });

  app.post('/api/search', async (req, res) => {
    try {
      const { query, filters } = req.body as { query?: string; filters?: SearchFilters };
      const result = await searchOrchestratorService.search(query || '', filters || {});
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Search failed.' });
    }
  });

  app.post('/api/research/ask', async (req, res) => {
    try {
      const { question, includeDiagram, history } = req.body as {
        question?: string;
        includeDiagram?: boolean;
        history?: { role: 'user' | 'assistant'; content: string }[];
      };
      if (!question || !question.trim()) {
        res.status(400).json({ error: 'Research question is required.' });
        return;
      }
      const result = await searchOrchestratorService.unifiedSEOResearch({
        question: question.trim(),
        includeDiagram,
        history,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Research query failed.' });
    }
  });

  app.post('/api/search/upload', upload.single('document'), async (req, res) => {
    try {
      let content = String(req.body?.content || '');
      let title = String(req.body?.title || 'Uploaded Research Document');
      if (req.file) {
        title = req.body?.title || req.file.originalname;
        content = req.file.buffer.toString('utf-8');
      }
      if (!content.trim()) {
        res.status(400).json({ error: 'Document content is required.' });
        return;
      }
      const added = searchOrchestratorService.addUploadedDocument({
        title,
        author: req.body?.author,
        book: req.body?.book,
        edition: req.body?.edition,
        tradition: req.body?.tradition,
        content,
      });
      res.json({ addedCount: added.length, passages: added });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Document indexing failed.' });
    }
  });

  app.post('/api/verify', upload.single('file'), async (req, res) => {
    try {
      const sourceTypeLabel = (req.body?.sourceTypeLabel || 'text') as
        | 'text'
        | 'quotation'
        | 'pdf'
        | 'screenshot'
        | 'image'
        | 'video_link'
        | 'video_file'
        | 'voice_recording'
        | 'video_transcript';

      let fileBase64: string | undefined;
      let fileMimeType: string | undefined;

      if (req.file) {
        fileBase64 = req.file.buffer.toString('base64');
        fileMimeType = req.file.mimetype;
      } else if (req.body?.fileBase64) {
        fileBase64 = String(req.body.fileBase64);
        fileMimeType = String(req.body.fileMimeType || 'application/octet-stream');
      }

      const report = await citationVerifierService.verifySubmission({
        text: req.body?.text ? String(req.body.text) : undefined,
        sourceTypeLabel,
        fileBase64,
        fileMimeType,
        videoUrl: req.body?.videoUrl ? String(req.body.videoUrl) : undefined,
      });

      res.json({ report });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Verification failed.' });
    }
  });

  app.get('/api/notes', (_req, res) => {
    res.json({ notes: audioStorage.listNotes() });
  });

  app.post('/api/notes', (req, res) => {
    const { title, topicId, summary, arabicReferences, citations } = req.body;
    if (!title || !summary) {
      res.status(400).json({ error: 'Title and summary are required.' });
      return;
    }
    const note = audioStorage.saveNote({
      title,
      topicId,
      summary,
      arabicReferences: Array.isArray(arabicReferences) ? arabicReferences : [],
      citations: Array.isArray(citations) ? citations : [],
    });
    res.json({ note });
  });

  app.delete('/api/notes/:id', (req, res) => {
    const deleted = audioStorage.deleteNote(req.params.id);
    res.json({ deleted });
  });

  // Learning Progress & Revision Schedule
  app.get('/api/progress', (_req, res) => {
    res.json({ progress: learningProgressService.getProgress() });
  });

  app.post('/api/progress/ayah', (req, res) => {
    const { surahNumber, verseKey, vocabDelta } = req.body;
    const progress = learningProgressService.recordAyahStudied(
      Number(surahNumber),
      String(verseKey),
      Number(vocabDelta || 1)
    );
    res.json({ progress });
  });

  app.post('/api/progress/bookmark', (req, res) => {
    const { label, targetType, targetRef, note } = req.body;
    const progress = learningProgressService.addBookmark(label, targetType, targetRef, note);
    res.json({ progress });
  });

  app.delete('/api/progress/bookmark/:id', (req, res) => {
    const progress = learningProgressService.removeBookmark(req.params.id);
    res.json({ progress });
  });

  app.post('/api/progress/revision', (req, res) => {
    const { label, type, dueDate } = req.body;
    const progress = learningProgressService.addRevisionItem(label, type, dueDate);
    res.json({ progress });
  });

  app.post('/api/progress/revision/:id/toggle', (req, res) => {
    const progress = learningProgressService.toggleRevisionItem(req.params.id);
    res.json({ progress });
  });

  // ==========================================
  // 6. COMPARATIVE WORLD RELIGIONS & SCRIPTURES
  // ==========================================
  app.get('/api/religions/overview', (_req, res) => {
    res.json(religionsService.getOverview());
  });

  app.post('/api/religions/load', async (req, res) => {
    try {
      const { traditionId, topicOrReference } = req.body as {
        traditionId?: ReligionTraditionId;
        topicOrReference?: string;
      };
      if (!traditionId || !topicOrReference?.trim()) {
        res.status(400).json({ error: 'براہِ کرم مذہبی کتاب اور موضوع یا حوالہ درج کریں۔' });
        return;
      }
      const passage = await religionsService.loadPassageByTopic({
        traditionId,
        topicOrReference: topicOrReference.trim(),
      });
      res.json({ passage });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'مذہبی کتاب لوڈ کرنے میں مسئلہ آیا۔' });
    }
  });

  app.post('/api/religions/chapter', async (req, res) => {
    try {
      const { traditionId, chapterRef } = req.body as {
        traditionId?: ReligionTraditionId;
        chapterRef?: string;
      };
      if (!traditionId || !chapterRef?.trim()) {
        res.status(400).json({ error: 'براہِ کرم مذہبی کتاب اور باب کا حوالہ منتخب کریں۔' });
        return;
      }
      const passages = await religionsService.loadChapterPassages({
        traditionId,
        chapterRef: chapterRef.trim(),
      });
      res.json({ passages });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'کتاب کا باب لوڈ کرنے میں مسئلہ آیا۔' });
    }
  });

  app.post('/api/religions/word', async (req, res) => {
    try {
      const analysis = await religionsService.explainWord(req.body);
      res.json({ analysis });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'لفظ کی تشریح میں مسئلہ پیش آیا۔' });
    }
  });

  app.post('/api/religions/translate', async (req, res) => {
    try {
      const { traditionId, inputText } = req.body as {
        traditionId?: ReligionTraditionId;
        inputText?: string;
      };
      if (!traditionId || !inputText?.trim()) {
        res.status(400).json({ error: 'براہِ کرم کتاب منتخب کریں اور ترجمہ کے لیے عبارت درج کریں۔' });
        return;
      }
      const passage = await religionsService.translatePassageDeep({
        traditionId,
        inputText: inputText.trim(),
      });
      res.json({ passage });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'عبارت کا ترجمہ مکمل نہ ہو سکا۔' });
    }
  });

  app.post('/api/religions/ask', async (req, res) => {
    try {
      const answer = await religionsService.askQuestion(req.body);
      res.json({ answer });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'سوال کا جواب حاصل نہ ہو سکا۔' });
    }
  });

  // ==========================================
  // 7. KIDS QURAN, HIFZ, SUNNAH & 7-HOUR MOTION STORIES
  // ==========================================
  app.get('/api/kids/curriculum', (_req, res) => {
    res.json(kidsAcademyService.getCurriculum());
  });

  app.get('/api/kids/stories', (_req, res) => {
    res.json(kidsAcademyService.getStoryPlaylistState());
  });

  app.post('/api/kids/stories/generate', async (req, res) => {
    try {
      const { topic } = req.body as { topic?: string };
      const episode = await kidsAcademyService.generateStoryEpisode(topic, false);
      res.json({
        episode,
        ...kidsAcademyService.getStoryPlaylistState(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'کہانی بنانے میں مسئلہ پیش آیا۔' });
    }
  });

  app.post('/api/kids/ask', async (req, res) => {
    try {
      const answer = await kidsAcademyService.askKidsUstaad(req.body);
      res.json({ answer });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'استاد سے رابطہ نہ ہو سکا۔' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Bahr-ul-Ilm AI server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
