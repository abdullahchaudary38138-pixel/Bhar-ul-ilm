import crypto from 'crypto';
import { Type } from '@google/genai';
import { getGeminiClient, defaultAIProvider } from '../providers/aiProvider.ts';
import type {
  BookComparisonReport,
  IslamicBook,
  LibraryCategory,
  WebSourceCitation,
} from '../../src/types.ts';

// User-managed library: starts empty so users add/delete their own books directly
const INITIAL_LIBRARY_BOOKS: IslamicBook[] = [];

const personalLibraryBooks: IslamicBook[] = [];

export const bookLibraryService = {
  getCategories(): LibraryCategory[] {
    return [
      'Personal Uploads',
      'Quran and Tafseer',
      'Hadith',
      'Seerah',
      'Sahaba',
      'Ahl-e-Bayt',
      'Khulafa-e-Rashideen',
      'Imams',
      'Islamic Scholars',
      'Islamic Psychology & Tazkiyah',
      'Fiqh',
      'Aqeedah',
      'Islamic History',
      'Arabic Grammar',
      'Islamic Civilization',
      'Spiritual & Ethical',
    ];
  },

  listBooks(category?: string, search?: string): IslamicBook[] {
    const all = [...personalLibraryBooks, ...INITIAL_LIBRARY_BOOKS];
    return all.filter((b) => {
      if (category && category !== 'All' && b.category !== category) return false;
      if (search && search.trim()) {
        const q = search.toLowerCase();
        const hay = `${b.title} ${b.author} ${b.personalityTag || ''} ${b.tradition} ${b.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  },

  getBook(id: string): IslamicBook | undefined {
    return [...personalLibraryBooks, ...INITIAL_LIBRARY_BOOKS].find((b) => b.id === id);
  },

  deleteBook(id: string): boolean {
    const idx = personalLibraryBooks.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    personalLibraryBooks.splice(idx, 1);
    return true;
  },

  async uploadAndProcessBook(params: {
    title: string;
    author?: string;
    edition?: string;
    language?: IslamicBook['language'];
    fileBuffer?: Buffer;
    mimeType?: string;
    rawText?: string;
  }): Promise<IslamicBook> {
    let extractedPages: IslamicBook['pages'] = [];

    if (
      params.fileBuffer &&
      params.mimeType &&
      (params.mimeType === 'application/pdf' || params.mimeType.startsWith('image/'))
    ) {
      const ai = getGeminiClient();
      let ocrJsonText = '[]';
      for (const model of ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']) {
        try {
          const ocrResp = await ai.models.generateContent({
            model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: params.mimeType,
                    data: params.fileBuffer.toString('base64'),
                  },
                },
                {
                  text: `Perform careful OCR on this uploaded Islamic book/document (which may contain Arabic, Urdu, or English).
Split the content by visible page boundaries.
CRITICAL INTEGRITY RULES:
1. If a printed page number is clearly visible on the page, record it in "printedPage" (e.g. "p. 42"). If NO printed page number is visible, set printedPage to "Unverified (Digital Page N)"—NEVER invent a printed page number.
2. If any text is blurry, degraded, or hard to read, set "ocrUncertain": true.`,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    digitalPage: { type: Type.INTEGER },
                    printedPage: { type: Type.STRING },
                    chapter: { type: Type.STRING },
                    text: { type: Type.STRING },
                    arabicText: { type: Type.STRING },
                    ocrUncertain: { type: Type.BOOLEAN },
                  },
                  required: ['digitalPage', 'printedPage', 'chapter', 'text', 'ocrUncertain'],
                },
              },
            },
          });
          ocrJsonText = (ocrResp.text ?? '[]').trim();
          break;
        } catch {
          // Try fallback model
        }
      }
      try {
        extractedPages = JSON.parse(ocrJsonText);
      } catch {
        extractedPages = [];
      }
    } else {
      const content = params.rawText || (params.fileBuffer ? params.fileBuffer.toString('utf-8') : '');
      const chunks = content
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean);
      extractedPages = (chunks.length > 0 ? chunks : [content]).slice(0, 40).map((text, idx) => ({
        digitalPage: idx + 1,
        printedPage: `صفحہ ${idx + 1}`,
        chapter: `حصہ ${idx + 1}`,
        text,
        ocrUncertain: false,
      }));
    }

    const book: IslamicBook = {
      id: `personal-${crypto.randomUUID()}`,
      title: params.title || 'میری شامل کردہ کتاب',
      author: params.author || 'مصنف نامعلوم',
      category: 'Personal Uploads',
      tradition: 'ذاتی لائبریری',
      edition: params.edition || 'صارف کا شامل کردہ نسخہ',
      publisher: 'Personal Archive',
      volume: 'Uploaded Book',
      language: params.language || 'Mixed',
      isPersonalUpload: true,
      pages:
        extractedPages.length > 0
          ? extractedPages
          : [
              {
                digitalPage: 1,
                printedPage: 'Unverified (Digital Page 1)',
                chapter: 'آغازِ کتاب',
                text: 'اس فائل سے تحریر واضح طور پر نہیں پڑھی جا سکی، براہِ کرم صاف اسکین یا ٹیکسٹ شامل کریں۔',
                ocrUncertain: true,
              },
            ],
    };

    personalLibraryBooks.unshift(book);
    return book;
  },

  async askWhileReading(params: {
    bookId: string;
    digitalPage: number;
    selectedPassage?: string;
    question: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<{
    answer: string;
    citation: {
      bookTitle: string;
      author: string;
      edition: string;
      volume: string;
      printedPage: string;
      digitalPage: number;
      chapter: string;
      ocrUncertain: boolean;
    };
  }> {
    const book = this.getBook(params.bookId);
    if (!book) {
      throw new Error('منتخب کردہ کتاب لائبریری میں موجود نہیں ہے۔');
    }
    const page = book.pages.find((p) => p.digitalPage === params.digitalPage) || book.pages[0];

    const systemInstruction = `You are a deeply knowledgeable Islamic Book Research Companion sitting beside the user while they read.
Answer the user's question grounded strictly in the opened book page and verified Islamic scholarship.
CRITICAL RULES:
1. Write the ENTIRE answer in **clear, respectful Pakistani Urdu script (اردو)** so anyone can read it and listen to it in Urdu audio. (Never answer in Roman Urdu unless explicitly requested).
2. Break down historical decisions, events, or passages clearly point-by-point in Urdu:
   • پس منظر اور حالات
   • مشورہ یا شرعی دلیل
   • اصل فیصلہ اور حکمت
   • نتیجہ اور آج کے لیے سبق
   • کتاب اور صفحہ حوالہ (${book.title}، ${page.printedPage})
3. NEVER invent a printed page number. Use "${page.printedPage}" (Digital Page ${page.digitalPage}).
4. If ocrUncertain is ${Boolean(page.ocrUncertain)}, warn the reader in Urdu to double-check the scanned page text.`;

    const historyText =
      params.history && params.history.length > 0
        ? `\nRecent Book Chat History:\n${params.history
            .slice(-6)
            .map((m) => `${m.role === 'user' ? 'Reader' : 'Scholar Companion'}: ${m.content}`)
            .join('\n')}\n`
        : '';

    const answer = await defaultAIProvider.generateText({
      systemInstruction,
      prompt: `Book: ${book.title} by ${book.author} (${book.edition}, ${book.volume})
Opened Chapter: ${page.chapter} | Printed Page: ${page.printedPage} | Digital Page: ${page.digitalPage}
OCR Uncertain Flag: ${Boolean(page.ocrUncertain)}

Page Text:
${page.arabicText ? `Arabic: ${page.arabicText}\n` : ''}${page.text}
${historyText}
${params.selectedPassage ? `User Highlighted Passage:\n"${params.selectedPassage}"\n` : ''}
Reader Question: "${params.question}"`,
    });

    return {
      answer,
      citation: {
        bookTitle: book.title,
        author: book.author,
        edition: book.edition,
        volume: book.volume,
        printedPage: page.printedPage,
        digitalPage: page.digitalPage,
        chapter: page.chapter,
        ocrUncertain: Boolean(page.ocrUncertain),
      },
    };
  },

  async translateToUrdu(params: {
    bookId: string;
    scope: 'page' | 'full';
    digitalPage?: number;
  }): Promise<{
    book: IslamicBook;
    translatedPages: {
      digitalPage: number;
      printedPage: string;
      chapter: string;
      urduTranslation: string;
      romanUrduTranslation: string;
    }[];
  }> {
    const book = this.getBook(params.bookId);
    if (!book) {
      throw new Error('کتاب لائبریری میں موجود نہیں ہے۔');
    }

    const targetPages =
      params.scope === 'full'
        ? book.pages.slice(0, 15)
        : [book.pages.find((p) => p.digitalPage === params.digitalPage) || book.pages[0]];

    const pagesToTranslate = targetPages.filter((p) => !p.urduTranslation);

    if (pagesToTranslate.length > 0) {
      interface TranslatedPagePayload {
        pages: {
          digitalPage: number;
          urduTranslation: string;
        }[];
      }

      const payload = await defaultAIProvider.generateStructured<TranslatedPagePayload>({
        systemInstruction: `You are an expert Islamic & Literary Translator fluent in Classical Arabic, English, and formal Urdu script (اردو).
Translate each provided book page faithfully into clear, natural, complete **Urdu script (اردو)** ("urduTranslation").
Preserve Quranic Arabic verses if quoted and provide the complete Urdu meaning without omitting any point. Never return Roman Urdu in urduTranslation.`,
        prompt: `Book Title: ${book.title} by ${book.author}\n\nPages to Translate into Urdu (اردو):\n${pagesToTranslate
          .map(
            (p) =>
              `--- Digital Page ${p.digitalPage} (${p.printedPage}, ${p.chapter}) ---\n${
                p.arabicText ? `Arabic Excerpt: ${p.arabicText}\n` : ''
              }${p.text}`
          )
          .join('\n\n')}`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  digitalPage: { type: Type.INTEGER },
                  urduTranslation: { type: Type.STRING },
                },
                required: ['digitalPage', 'urduTranslation'],
              },
            },
          },
          required: ['pages'],
        },
      });

      for (const item of payload.pages || []) {
        const target = book.pages.find((p) => p.digitalPage === item.digitalPage);
        if (target) {
          target.urduTranslation = item.urduTranslation;
          target.romanUrduTranslation = '';
        }
      }
    }

    return {
      book,
      translatedPages: targetPages.map((p) => ({
        digitalPage: p.digitalPage,
        printedPage: p.printedPage,
        chapter: p.chapter,
        urduTranslation: p.urduTranslation || '',
        romanUrduTranslation: '',
      })),
    };
  },

  async askOnlineBooks(params: {
    question: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<{
    answer: string;
    webSources: WebSourceCitation[];
  }> {
    const cleanQ = params.question.trim();
    const historyText =
      params.history && params.history.length > 0
        ? params.history
            .slice(-6)
            .map((m) => `${m.role === 'user' ? 'سائل' : 'عالم معاون'}: ${m.content}`)
            .join('\n')
        : '';

    try {
      const grounded = await defaultAIProvider.generateGroundedAnswer({
        systemInstruction: `You are Bahr-ul-Ilm AI's Online Islamic Books Search & Research Scholar.
The user wants to search online Islamic books (Sahih Bukhari, Sahih Muslim, Tafsir Ibn Kathir, Al-Rahiqum Makhtum, Ihya Ulum al-Din, Seerah, Fiqh, History, Islamic Psychology, or ANY named Islamic book/author) and get answers.
CRITICAL RULES:
1. Write the ENTIRE response in **clear, natural, authentic Urdu script (اردو)** so it reads cleanly and can be listened to via Urdu voice.
2. Preserve quoted Arabic verses or Hadith texts verbatim alongside their accurate Urdu translation.
3. Explicitly include a clear heading **"مستند کتابیں اور آن لائن مآخذ (Sources)"** listing the exact book name, author, chapter/hadith/page if found, and online references.
4. Never fabricate a book title, Hadith number, or page number. If something cannot be verified, state so honestly in Urdu.`,
        prompt: `${historyText ? `پچھلی گفتگو:\n${historyText}\n\n` : ''}آن لائن کتب سے سوال / تلاش:\n"${cleanQ}"`,
      });
      return {
        answer: grounded.text,
        webSources: grounded.webSources.slice(0, 6),
      };
    } catch {
      return {
        answer:
          'اس وقت آن لائن سرچ سروس عارضی طور پر مصروف ہے یا کوٹہ مکمل ہو چکا ہے۔ براہِ کرم تھوڑی دیر بعد دوبارہ کوشش کریں یا اپنی کتاب "میری کتابیں" سیکشن میں اپلوڈ کر کے سوال پوچھیں۔',
        webSources: [],
      };
    }
  },

  async compareBooks(params: {
    bookIds: string[];
    subject: string;
  }): Promise<BookComparisonReport> {
    const selectedBooks = params.bookIds
      .map((id) => this.getBook(id))
      .filter((b): b is IslamicBook => Boolean(b));

    const booksContext = selectedBooks
      .map(
        (b) =>
          `BOOK: ${b.title} | Author: ${b.author} | Tradition: ${b.tradition} | Edition: ${b.edition}\nPages:\n${b.pages
            .map((p) => `[${p.printedPage}, ${p.chapter}] ${p.text}`)
            .join('\n')}`
      )
      .join('\n\n===\n\n');

    return defaultAIProvider.generateStructured<BookComparisonReport>({
      systemInstruction: `You are a Comparative Islamic Historiography & Literature Analyst.
Compare how the selected books report on the requested subject or personality.
CRITICAL RULES:
1. Write ALL text values (agreements, differences, timeline events, missingOrDisputedEvidence) in **clear Urdu script (اردو)**.
2. Show agreements clearly and differences explicitly with author & book attribution.
3. Classify every difference as "Factual", "Interpretive", or "Transmission / Isnad".
4. Never present a disputed historical account as established fact.`,
      prompt: `Subject / Event to Compare: "${params.subject}"\n\nSelected Library Books:\n${booksContext}`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          agreements: { type: Type.ARRAY, items: { type: Type.STRING } },
          differences: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                aspect: { type: Type.STRING },
                accounts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      bookTitle: { type: Type.STRING },
                      author: { type: Type.STRING },
                      reference: { type: Type.STRING },
                      account: { type: Type.STRING },
                    },
                    required: ['bookTitle', 'author', 'reference', 'account'],
                  },
                },
                differenceType: {
                  type: Type.STRING,
                  enum: ['Factual', 'Interpretive', 'Transmission / Isnad'],
                },
              },
              required: ['aspect', 'accounts', 'differenceType'],
            },
          },
          timeline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                dateOrEra: { type: Type.STRING },
                event: { type: Type.STRING },
                source: { type: Type.STRING },
              },
              required: ['dateOrEra', 'event', 'source'],
            },
          },
          missingOrDisputedEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['subject', 'agreements', 'differences', 'timeline', 'missingOrDisputedEvidence'],
      },
    });
  },
};
