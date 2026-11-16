import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { LearningProgressState } from '../../src/types.ts';

const PROGRESS_FILE = path.resolve(process.cwd(), 'data', 'progress.json');

const DEFAULT_PROGRESS: LearningProgressState = {
  surahsStudied: [1],
  ayatStudied: ['1:1'],
  vocabularyCount: 4,
  grammarLessonsCompleted: ['Ism, Fi\'l, Harf Foundations'],
  tajweedPracticeCount: 0,
  mistakesLogged: 0,
  mistakesCorrected: 0,
  booksReadPages: [],
  revisionQueue: [
    {
      id: 'rev-fatiha-1',
      label: 'Surah Al-Fatihah (1:1–7) — Word-by-word roots & Madd Arid lis-Sukoon',
      type: 'Ayah',
      dueDate: new Date().toISOString().slice(0, 10),
      completed: false,
    },
  ],
  bookmarks: [],
};

function loadProgress(): LearningProgressState {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(PROGRESS_FILE)) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(DEFAULT_PROGRESS, null, 2), 'utf-8');
    return structuredClone(DEFAULT_PROGRESS);
  }
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')) as LearningProgressState;
  } catch {
    return structuredClone(DEFAULT_PROGRESS);
  }
}

function saveProgress(state: LearningProgressState) {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export const learningProgressService = {
  getProgress(): LearningProgressState {
    return loadProgress();
  },

  recordAyahStudied(surahNumber: number, verseKey: string, vocabDelta = 1): LearningProgressState {
    const state = loadProgress();
    if (!state.surahsStudied.includes(surahNumber)) {
      state.surahsStudied.push(surahNumber);
    }
    if (!state.ayatStudied.includes(verseKey)) {
      state.ayatStudied.push(verseKey);
      state.vocabularyCount += vocabDelta;
    }
    saveProgress(state);
    return state;
  },

  recordGrammarLesson(topic: string): LearningProgressState {
    const state = loadProgress();
    if (!state.grammarLessonsCompleted.includes(topic)) {
      state.grammarLessonsCompleted.push(topic);
    }
    saveProgress(state);
    return state;
  },

  recordTajweedPractice(mistakesDetected: number, isRetryImproved: boolean): LearningProgressState {
    const state = loadProgress();
    state.tajweedPracticeCount += 1;
    state.mistakesLogged += mistakesDetected;
    if (isRetryImproved) {
      state.mistakesCorrected += 1;
    }
    saveProgress(state);
    return state;
  },

  recordBookPageRead(bookId: string, title: string, page: number): LearningProgressState {
    const state = loadProgress();
    const existing = state.booksReadPages.find((b) => b.bookId === bookId);
    if (existing) {
      existing.lastPage = Math.max(existing.lastPage, page);
    } else {
      state.booksReadPages.push({ bookId, title, lastPage: page });
    }
    saveProgress(state);
    return state;
  },

  addRevisionItem(label: string, type: 'Ayah' | 'Tajweed' | 'Grammar' | 'Book', dueDate: string): LearningProgressState {
    const state = loadProgress();
    state.revisionQueue.unshift({
      id: crypto.randomUUID(),
      label,
      type,
      dueDate,
      completed: false,
    });
    saveProgress(state);
    return state;
  },

  toggleRevisionItem(id: string): LearningProgressState {
    const state = loadProgress();
    state.revisionQueue = state.revisionQueue.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    saveProgress(state);
    return state;
  },

  addBookmark(label: string, targetType: 'ayah' | 'book', targetRef: string, note?: string): LearningProgressState {
    const state = loadProgress();
    state.bookmarks.unshift({
      id: crypto.randomUUID(),
      label,
      targetType,
      targetRef,
      note,
    });
    saveProgress(state);
    return state;
  },

  removeBookmark(id: string): LearningProgressState {
    const state = loadProgress();
    state.bookmarks = state.bookmarks.filter((b) => b.id !== id);
    saveProgress(state);
    return state;
  },
};
