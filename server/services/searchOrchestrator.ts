import crypto from 'crypto';
import { Type } from '@google/genai';
import { INITIAL_ISLAMIC_CORPUS } from '../corpus/islamicCorpus.ts';
import { defaultAIProvider } from '../providers/aiProvider.ts';
import { audioStorage } from './audioStorage.ts';
import { bookLibraryService } from './bookLibraryService.ts';
import type {
  CorpusPassage,
  DiagramData,
  MatchType,
  SourceType,
  WebSourceCitation,
} from '../../src/types.ts';

export interface LibraryBookMatch {
  bookId: string;
  bookTitle: string;
  author: string;
  category: string;
  printedPage: string;
  chapter: string;
  snippet: string;
  isPersonalUpload: boolean;
}

export interface SearchFilters {
  sourceType?: SourceType | 'All';
  author?: string;
  book?: string;
  edition?: string;
  collection?: string;
  date?: string;
  tradition?: string;
  method?: 'all' | 'exact' | 'keyword' | 'semantic' | 'root' | 'crossref';
}

const uploadedCorpus: CorpusPassage[] = [];
const embeddingCache = new Map<string, number[]>();

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Strip Arabic harakat for root/phrase matching
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const searchOrchestratorService = {
  getAllPassages(): CorpusPassage[] {
    return [...INITIAL_ISLAMIC_CORPUS, ...uploadedCorpus];
  },

  addUploadedDocument(params: {
    title: string;
    author?: string;
    book?: string;
    edition?: string;
    tradition?: string;
    content: string;
  }): CorpusPassage[] {
    audioStorage.saveUploadedDocument(params.title, params.content);
    // Split uploaded document into searchable passages
    const chunks = params.content
      .split(/\n{2,}/)
      .map((c) => c.trim())
      .filter((c) => c.length > 15);

    const effectiveChunks = chunks.length > 0 ? chunks : [params.content.trim()];
    const added: CorpusPassage[] = effectiveChunks.slice(0, 25).map((chunk, idx) => ({
      id: `upload-${crypto.randomUUID()}`,
      sourceType: 'Uploaded Document',
      title: effectiveChunks.length > 1 ? `${params.title} — Section ${idx + 1}` : params.title,
      book: params.book || params.title,
      author: params.author || 'User Uploaded Document',
      edition: params.edition || 'User Archive',
      page: `Section ${idx + 1}`,
      collection: 'User Research Library',
      date: new Date().toISOString().slice(0, 10),
      tradition: params.tradition || 'Uploaded Reference',
      englishTranslation: chunk,
      keywords: normalizeText(chunk).split(' ').slice(0, 15),
      verificationStatus: 'User Uploaded Source',
    }));

    uploadedCorpus.unshift(...added);
    return added;
  },

  findBookLibraryMatches(query: string): LibraryBookMatch[] {
    const tokens = normalizeText(query)
      .split(' ')
      .filter((t) => t.length > 2);
    const books = bookLibraryService.listBooks();
    const matches: {
      bookId: string;
      bookTitle: string;
      author: string;
      category: string;
      printedPage: string;
      chapter: string;
      snippet: string;
      isPersonalUpload: boolean;
      score: number;
    }[] = [];

    for (const book of books) {
      for (const page of book.pages) {
        const hay = normalizeText(
          `${book.title} ${book.author} ${book.category} ${book.personalityTag || ''} ${page.chapter} ${page.text}`
        );
        const hits = tokens.filter((t) => hay.includes(t)).length;
        if (hits > 0 || book.isPersonalUpload) {
          matches.push({
            bookId: book.id,
            bookTitle: book.title,
            author: book.author,
            category: book.category,
            printedPage: page.printedPage,
            chapter: page.chapter,
            snippet: page.text.slice(0, 260) + (page.text.length > 260 ? '…' : ''),
            isPersonalUpload: book.isPersonalUpload,
            score: hits + (book.isPersonalUpload ? 0.5 : 0),
          });
        }
      }
    }

    return matches
      .filter((m) => m.score > 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score: _s, ...rest }) => rest);
  },

  async search(query: string, filters: SearchFilters = {}): Promise<{
    results: CorpusPassage[];
    facets: {
      authors: string[];
      books: string[];
      collections: string[];
      traditions: string[];
    };
  }> {
    const all = this.getAllPassages();
    const facets = {
      authors: Array.from(new Set(all.map((p) => p.author))).sort(),
      books: Array.from(new Set(all.map((p) => p.book))).sort(),
      collections: Array.from(new Set(all.map((p) => p.collection))).sort(),
      traditions: Array.from(new Set(all.map((p) => p.tradition))).sort(),
    };

    const filtered = all.filter((p) => {
      if (filters.sourceType && filters.sourceType !== 'All' && p.sourceType !== filters.sourceType) return false;
      if (filters.author && filters.author !== 'All' && p.author !== filters.author) return false;
      if (filters.book && filters.book !== 'All' && p.book !== filters.book) return false;
      if (filters.edition && filters.edition !== 'All' && p.edition !== filters.edition) return false;
      if (filters.collection && filters.collection !== 'All' && p.collection !== filters.collection) return false;
      if (filters.tradition && filters.tradition !== 'All' && p.tradition !== filters.tradition) return false;
      if (filters.date && filters.date.trim() && !p.date.toLowerCase().includes(filters.date.toLowerCase())) return false;
      return true;
    });

    const trimmed = query.trim();
    if (!trimmed) {
      return {
        results: filtered.slice(0, 12).map((p) => ({ ...p, matchType: 'Cross-Reference', score: 1 })),
        facets,
      };
    }

    const normQuery = normalizeText(trimmed);
    const queryTokens = normQuery.split(' ').filter((t) => t.length > 1);
    const method = filters.method || 'all';

    let queryEmbedding: number[] = [];
    if (method === 'all' || method === 'semantic') {
      try {
        queryEmbedding = await defaultAIProvider.embedText(trimmed);
      } catch {
        queryEmbedding = [];
      }
    }

    const scored: CorpusPassage[] = [];

    for (const passage of filtered) {
      const searchableCorpus = normalizeText(
        [
          passage.title,
          passage.book,
          passage.author,
          passage.arabicText || '',
          passage.urduTranslation || '',
          passage.englishTranslation,
          passage.keywords.join(' '),
          (passage.arabicRoots || []).join(' '),
        ].join(' ')
      );

      let matchType: MatchType | undefined;
      let score = 0;

      if ((method === 'all' || method === 'exact') && searchableCorpus.includes(normQuery)) {
        matchType = 'Exact Quotation';
        score = 1.0;
      }

      if (!matchType && (method === 'all' || method === 'root') && passage.arabicRoots?.length) {
        const rootMatch = passage.arabicRoots.some(
          (root) => normQuery.includes(normalizeText(root)) || normalizeText(root).replace(/-/g, '') === normQuery.replace(/[-\s]/g, '')
        );
        if (rootMatch) {
          matchType = 'Arabic Root Match';
          score = 0.94;
        }
      }

      if (!matchType && (method === 'all' || method === 'keyword' || method === 'crossref')) {
        const matchedTokens = queryTokens.filter((tok) => searchableCorpus.includes(tok));
        if (matchedTokens.length > 0) {
          score = 0.45 + 0.45 * (matchedTokens.length / Math.max(1, queryTokens.length));
          matchType = method === 'crossref' ? 'Cross-Reference' : 'Keyword Match';
        }
      }

      if ((method === 'all' || method === 'semantic') && queryEmbedding.length > 0) {
        let passageEmbedding = embeddingCache.get(passage.id);
        if (!passageEmbedding) {
          try {
            passageEmbedding = await defaultAIProvider.embedText(
              `${passage.title}. ${passage.englishTranslation} ${passage.urduTranslation || ''}`
            );
            embeddingCache.set(passage.id, passageEmbedding);
          } catch {
            passageEmbedding = [];
          }
        }
        const sim = cosineSimilarity(queryEmbedding, passageEmbedding);
        if (sim > 0.52 && sim > score) {
          matchType = 'Approximate Semantic Match';
          score = Number(sim.toFixed(3));
        }
      }

      if (matchType && score > 0.35) {
        scored.push({
          ...passage,
          matchType,
          score: Number(score.toFixed(2)),
        });
      }
    }

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return {
      results: scored.slice(0, 12),
      facets,
    };
  },

  async unifiedSEOResearch(params: {
    question: string;
    includeDiagram?: boolean;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<{
    answer: string;
    spokenSummary: string;
    citations: CorpusPassage[];
    libraryMatches: LibraryBookMatch[];
    webSources: WebSourceCitation[];
    diagram?: DiagramData;
  }> {
    const cleanQ = params.question.trim();
    const [corpusRes, libraryMatches] = await Promise.all([
      this.search(cleanQ, { method: 'all' }),
      Promise.resolve(this.findBookLibraryMatches(cleanQ)),
    ]);

    const citations = corpusRes.results.slice(0, 5);
    const corpusContext = citations
      .map(
        (c) =>
          `[${c.sourceType}] ${c.title} — ${c.book} (${c.author}, ${c.edition}, ${c.page})\nArabic: ${c.arabicText || 'N/A'}\nUrdu: ${c.urduTranslation || 'N/A'}\nEnglish: ${c.englishTranslation}`
      )
      .join('\n---\n');

    const libraryContext = libraryMatches
      .map(
        (b) =>
          `[${b.isPersonalUpload ? 'Personal Uploaded Book' : 'Library Book'}] ${b.bookTitle} by ${b.author} (${b.category}, ${b.printedPage}, ${b.chapter})\nExcerpt: ${b.snippet}`
      )
      .join('\n---\n');

    const historyContext =
      params.history && params.history.length > 0
        ? params.history
            .slice(-6)
            .map((m) => `${m.role === 'user' ? 'User' : 'Bahr-ul-Ilm AI'}: ${m.content}`)
            .join('\n')
        : '';

    let answer = '';
    let webSources: WebSourceCitation[] = [];
    try {
      const grounded = await defaultAIProvider.generateGroundedAnswer({
        systemInstruction: `You are Bahr-ul-Ilm AI's Universal Islamic SEO Search & Research Scholar.
The user asks questions in ANY natural style (Roman Urdu, Urdu script, Arabic, or English — about Quran, Hadith, Islamic books, Psychology/Tazkiyah, Sahaba, daily life, Fiqh, or history).
CRITICAL RULES:
1. Search & combine evidence from: (a) Verified Quran & Hadith Corpus, (b) User's Personal Digital Library (provided below), AND (c) Live Online Islamic Scholarly Sources via Google Search.
2. Write the ENTIRE answer in **clear, natural Pakistani Urdu script (اردو)** so it is easy to read and speaks cleanly in Urdu audio (keep exact Arabic Quran/Hadith texts verbatim alongside Urdu translation). Never answer in Roman Urdu unless explicitly requested.
3. ALWAYS include a clear section **"حوالہ جات (کہاں سے جواب لیا گیا)"** citing the exact Quran Surah:Ayah, Hadith book/number, Library book + page, and any online books/articles used.
4. Never fabricate any Hadith, verse, book, or scholar quote. For Fiqh questions with scholarly differences, present the views fairly in Urdu and advise confirming with a qualified local scholar.`,
        prompt: `${historyContext ? `Recent Chat:\n${historyContext}\n\n` : ''}Indexed Quran/Hadith Corpus Matches:\n${
          corpusContext || 'No direct local corpus hit.'
        }\n\nPersonal Library Book Matches:\n${
          libraryContext || 'No direct local book hit.'
        }\n\nUser Question / Search:\n"${cleanQ}"`,
      });
      answer = grounded.text;
      webSources = grounded.webSources;
    } catch {
      const parts: string[] = [];
      if (libraryMatches.length > 0) {
        parts.push(
          'ذاتی لائبریری کی کتب سے متعلقہ حوالہ جات:\n' +
            libraryMatches
              .map((b) => `• **${b.bookTitle}** (${b.author}، ${b.printedPage}): ${b.snippet}`)
              .join('\n')
        );
      }
      if (citations.length > 0) {
        parts.push(
          'قرآن و حدیث کے مستند حوالہ جات:\n' +
            citations
              .map(
                (c) =>
                  `• **${c.title}** — ${c.book} (${c.page}): ${c.urduTranslation || c.englishTranslation}`
              )
              .join('\n')
        );
      }
      answer =
        parts.length > 0
          ? `${parts.join('\n\n')}\n\nحوالہ جات: اوپر درج ذاتی لائبریری اور قرآن و حدیث کے مستند مآخذ۔`
          : `اس وقت لائیو اے آئی سروس مصروف ہے اور "${cleanQ}" کے لیے مقامی انڈیکس میں براہِ راست حوالہ نہیں ملا۔ براہِ کرم کچھ دیر بعد دوبارہ کوشش کریں۔`;
    }

    const spokenSummary = answer.split('\n').slice(0, 4).join(' ').slice(0, 420);

    let diagram: DiagramData | undefined;
    const wantsDiagram =
      params.includeDiagram || /\b(chart|diagram|visual|flowchart|timeline|naqsha)\b|چارٹ|نقشہ/i.test(cleanQ);
    if (wantsDiagram && answer && (citations.length > 0 || libraryMatches.length > 0 || !answer.includes('سروس مصروف'))) {
      try {
        diagram = await defaultAIProvider.generateStructured<DiagramData>({
          systemInstruction:
            'Convert the Islamic research explanation into a concise visual concept chart/diagram with 4-7 nodes and labeled edges in clear Urdu script (اردو).',
          prompt: `Topic: "${cleanQ}"\n\nAnswer Summary:\n${answer.slice(0, 1800)}`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              nodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    detail: { type: Type.STRING },
                  },
                  required: ['id', 'label'],
                },
              },
              edges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    from: { type: Type.STRING },
                    to: { type: Type.STRING },
                    label: { type: Type.STRING },
                  },
                  required: ['from', 'to'],
                },
              },
            },
            required: ['title', 'nodes', 'edges'],
          },
        });
      } catch {
        diagram = undefined;
      }
    }

    return {
      answer,
      spokenSummary,
      citations,
      libraryMatches,
      webSources,
      diagram: diagram && diagram.nodes?.length ? diagram : undefined,
    };
  },
};

