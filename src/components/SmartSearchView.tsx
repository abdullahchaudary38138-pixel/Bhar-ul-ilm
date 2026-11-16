import React, { useEffect, useState } from 'react';
import { Search, Upload, FileText, X } from 'lucide-react';
import { CitationCard } from './CitationCard.tsx';
import type { CorpusPassage, SourceType } from '../types.ts';

interface SmartSearchViewProps {
  onReadAloud: (text: string) => void;
  onAskInStudio: (passage: CorpusPassage) => void;
}

const SOURCE_TYPES: (SourceType | 'All')[] = [
  'All',
  'Quran',
  'Hadith',
  'Tafsir',
  'Seerah',
  'Book',
  'Scholar',
  'Historical Event',
  'Arabic Root',
  'Uploaded Document',
];

export const SmartSearchView: React.FC<SmartSearchViewProps> = ({
  onReadAloud,
  onAskInStudio,
}) => {
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<'all' | 'exact' | 'keyword' | 'semantic' | 'root' | 'crossref'>('all');
  const [sourceType, setSourceType] = useState<SourceType | 'All'>('All');
  const [author, setAuthor] = useState('All');
  const [book, setBook] = useState('All');
  const [collection, setCollection] = useState('All');
  const [tradition, setTradition] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  const [results, setResults] = useState<CorpusPassage[]>([]);
  const [facets, setFacets] = useState({
    authors: [] as string[],
    books: [] as string[],
    collections: [] as string[],
    traditions: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document upload panel
  const [showUpload, setShowUpload] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docAuthor, setDocAuthor] = useState('');
  const [docContent, setDocContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const runSearch = async (overrideQuery?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: overrideQuery !== undefined ? overrideQuery : query,
          filters: {
            method,
            sourceType,
            author,
            book,
            collection,
            tradition,
            date: dateFilter,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.results || []);
      if (data.facets) setFacets(data.facets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, author, book, collection, tradition, method]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!docTitle) setDocTitle(file.name.replace(/\.[^.]+$/, ''));
    const text = await file.text();
    setDocContent(text);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docContent.trim()) return;
    setUploading(true);
    setUploadNotice(null);
    try {
      const res = await fetch('/api/search/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docTitle || 'User Research Document',
          author: docAuthor || 'User Uploaded Source',
          content: docContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadNotice(`Indexed ${data.addedCount} searchable passage(s) into your corpus.`);
      setDocTitle('');
      setDocAuthor('');
      setDocContent('');
      setShowUpload(false);
      await runSearch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border-hairline)] pb-5">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--color-ink)]">
            Universal Islamic Smart Search
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-muted)] max-w-2xl">
            Search Quran, Hadith, Tafsir, Seerah, classical books, scholars, Arabic triliteral roots, Urdu/English translations, and your uploaded documents. Exact quotations are strictly separated from approximate semantic matches.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowUpload((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-warm)] whitespace-nowrap shrink-0"
        >
          <Upload className="h-4 w-4 text-[var(--color-forest)]" aria-hidden="true" />
          Index User Document
        </button>
      </div>

      {uploadNotice && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper-warm)] px-4 py-2.5 text-sm text-[var(--color-forest)]">
          <span>{uploadNotice}</span>
          <button type="button" onClick={() => setUploadNotice(null)} aria-label="Dismiss notice">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showUpload && (
        <form
          onSubmit={handleUploadSubmit}
          className="mt-5 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
              Add Document to Searchable Index
            </h2>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="text-xs text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-muted)]">
                Document Title
              </label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. Fatawa Alamgiri Excerpt"
                className="mt-1 w-full rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-muted)]">
                Author / Source
              </label>
              <input
                type="text"
                value={docAuthor}
                onChange={(e) => setDocAuthor(e.target.value)}
                placeholder="e.g. Shaykh Nizam"
                className="mt-1 w-full rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-ink-muted)]">
                Upload Text / Markdown File
              </label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-paper-warm)]">
                <FileText className="h-4 w-4" aria-hidden="true" />
                <span>Choose .txt or .md file</span>
                <input type="file" accept=".txt,.md,.csv" onChange={handleFileChange} className="sr-only" />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink-muted)]">
              Document Text Content (Arabic, Urdu, Roman Urdu, or English)
            </label>
            <textarea
              rows={4}
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              placeholder="Paste scholarly passages or notes to index for exact & semantic retrieval…"
              className="mt-1 w-full rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="rounded-md border border-[var(--color-border-hairline)] px-4 py-2 text-sm font-medium text-[var(--color-ink)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !docContent.trim()}
              className="rounded-md bg-[var(--color-emerald-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[#065F46] disabled:opacity-50"
            >
              {uploading ? 'Indexing…' : 'Index Document'}
            </button>
          </div>
        </form>
      )}

      {/* Search Bar & Method Controls */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        className="mt-6 space-y-4"
      >
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-subtle)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search phrase, Arabic root (e.g. ر-ح-م or ع-ل-م), scholar, event, Roman Urdu or English…"
              className="w-full rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-ink)] focus:border-[var(--color-forest)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--color-emerald-deep)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#065F46] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {loading ? 'Searching…' : 'Search Corpus'}
          </button>
        </div>

        {/* Search Methods */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-ink-subtle)] mr-1">Method:</span>
          {(
            [
              { id: 'all', label: 'All Methods' },
              { id: 'exact', label: 'Exact Phrase' },
              { id: 'keyword', label: 'Keyword' },
              { id: 'semantic', label: 'Semantic Similarity' },
              { id: 'root', label: 'Arabic Root' },
              { id: 'crossref', label: 'Cross-Reference' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                method === m.id
                  ? 'bg-[var(--color-emerald-deep)] text-white'
                  : 'border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Facet Filters */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-1">
          <select
            aria-label="Filter by source type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType | 'All')}
            className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] px-3 py-2 text-xs text-[var(--color-ink)]"
          >
            {SOURCE_TYPES.map((st) => (
              <option key={st} value={st}>
                Source: {st}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] px-3 py-2 text-xs text-[var(--color-ink)]"
          >
            <option value="All">Author: All</option>
            {facets.authors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by book"
            value={book}
            onChange={(e) => setBook(e.target.value)}
            className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] px-3 py-2 text-xs text-[var(--color-ink)]"
          >
            <option value="All">Book: All</option>
            {facets.books.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by collection"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] px-3 py-2 text-xs text-[var(--color-ink)]"
          >
            <option value="All">Collection: All</option>
            {facets.collections.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by tradition"
            value={tradition}
            onChange={(e) => setTradition(e.target.value)}
            className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] px-3 py-2 text-xs text-[var(--color-ink)]"
          >
            <option value="All">Tradition: All</option>
            {facets.traditions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <input
            type="text"
            aria-label="Filter by date or century"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            placeholder="Date / Era (e.g. 6 AH)"
            className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] px-3 py-2 text-xs text-[var(--color-ink)]"
          />
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-[var(--color-terracotta)]/40 bg-[var(--color-paper-card)] px-4 py-3 text-sm text-[var(--color-terracotta)]">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between text-xs text-[var(--color-ink-subtle)]">
          <span className="font-mono tabular-nums">
            {results.length} matching passage(s)
          </span>
          <span>
            Quick roots: <button type="button" onClick={() => { setQuery('ر-ح-م'); setMethod('root'); runSearch('ر-ح-م'); }} className="underline hover:text-[var(--color-ink)]">ر-ح-م</button> · <button type="button" onClick={() => { setQuery('ع-ل-م'); setMethod('root'); runSearch('ع-ل-م'); }} className="underline hover:text-[var(--color-ink)]">ع-ل-م</button> · <button type="button" onClick={() => { setQuery('ش-و-ر'); setMethod('root'); runSearch('ش-و-ر'); }} className="underline hover:text-[var(--color-ink)]">ش-و-ر</button>
          </span>
        </div>

        {results.length === 0 && !loading ? (
          <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] p-8 text-center">
            <p className="text-sm text-[var(--color-ink-muted)]">
              No passages matched those exact filters. Try clearing filters or switching to Semantic Similarity.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {results.map((passage) => (
              <CitationCard
                key={passage.id}
                passage={passage}
                onReadAloud={onReadAloud}
                onAskInStudio={onAskInStudio}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
