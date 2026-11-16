import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { ResearchNote } from '../../src/types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

function ensureDirs() {
  for (const dir of [DATA_DIR, AUDIO_DIR, UPLOADS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  if (!fs.existsSync(NOTES_FILE)) {
    fs.writeFileSync(NOTES_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

ensureDirs();

export const audioStorage = {
  saveAudio(base64Data: string, extension = 'wav'): { id: string; filename: string; url: string } {
    ensureDirs();
    const id = crypto.randomUUID();
    const cleanExt = extension.replace(/[^a-z0-9]/gi, '') || 'wav';
    const filename = `${id}.${cleanExt}`;
    const filePath = path.join(AUDIO_DIR, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { id, filename, url: `/api/audio/${filename}` };
  },

  getAudioPath(filename: string): string | null {
    ensureDirs();
    const safeName = path.basename(filename);
    const fullPath = path.join(AUDIO_DIR, safeName);
    if (!fs.existsSync(fullPath)) return null;
    return fullPath;
  },

  deleteAudio(filename: string): boolean {
    ensureDirs();
    const safeName = path.basename(filename);
    const fullPath = path.join(AUDIO_DIR, safeName);
    if (!fs.existsSync(fullPath)) return false;
    fs.unlinkSync(fullPath);
    return true;
  },

  saveUploadedDocument(name: string, content: string): { id: string; path: string } {
    ensureDirs();
    const id = crypto.randomUUID();
    const safeName = `${id}_${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const fullPath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(fullPath, content, 'utf-8');
    return { id, path: fullPath };
  },

  listNotes(): ResearchNote[] {
    ensureDirs();
    try {
      const raw = fs.readFileSync(NOTES_FILE, 'utf-8');
      return JSON.parse(raw) as ResearchNote[];
    } catch {
      return [];
    }
  },

  saveNote(note: Omit<ResearchNote, 'id' | 'createdAt'>): ResearchNote {
    ensureDirs();
    const notes = this.listNotes();
    const created: ResearchNote = {
      ...note,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    notes.unshift(created);
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf-8');
    return created;
  },

  deleteNote(id: string): boolean {
    ensureDirs();
    const notes = this.listNotes();
    const filtered = notes.filter((n) => n.id !== id);
    if (filtered.length === notes.length) return false;
    fs.writeFileSync(NOTES_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  },
};
