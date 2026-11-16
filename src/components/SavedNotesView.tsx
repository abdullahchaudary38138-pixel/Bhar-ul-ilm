import React, { useEffect, useState } from 'react';
import { Trash2, Copy, Check, BookMarked, Volume2 } from 'lucide-react';
import type { ResearchNote } from '../types.ts';

interface SavedNotesViewProps {
  onReadAloud: (text: string) => void;
}

export const SavedNotesView: React.FC<SavedNotesViewProps> = ({ onReadAloud }) => {
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notes');
      const data = (await res.json()) as { notes: ResearchNote[] };
      setNotes(data.notes || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleCopy = async (note: ResearchNote) => {
    const formatted = `${note.title}\n\n${note.summary}\n\nReferences:\n${note.citations
      .map((c) => `- ${c.title} (${c.book}, ${c.author}, ${c.page})`)
      .join('\n')}`;
    await navigator.clipboard.writeText(formatted);
    setCopiedId(note.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="border-b border-[var(--color-border-hairline)] pb-5">
        <h1 className="font-display text-3xl font-semibold text-[var(--color-ink)]">
          Saved Research Notes
        </h1>
        <p className="mt-1.5 text-sm text-[var(--color-ink-muted)] max-w-2xl">
          Structured notes compiled from your Voice Studio conversations with preserved Arabic citations and bibliographic provenance.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-sm text-[var(--color-ink-subtle)]">Loading saved notes…</div>
      ) : notes.length === 0 ? (
        <div className="mt-8 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] p-8 text-center">
          <BookMarked className="mx-auto h-7 w-7 text-[var(--color-ink-subtle)]" aria-hidden="true" />
          <h2 className="mt-3 font-display text-xl font-semibold text-[var(--color-ink)]">
            No saved research notes yet
          </h2>
          <p className="mt-1.5 text-sm text-[var(--color-ink-muted)] max-w-md mx-auto">
            In the Voice Studio, ask a question or click “Turn into notes” on any research thread to archive structured findings here.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5">
          {notes.map((note) => (
            <article
              key={note.id}
              className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper-card)] p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-[var(--color-ink-subtle)] font-mono tabular-nums">
                    Archived {new Date(note.createdAt).toLocaleString()}
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--color-ink)]">
                    {note.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onReadAloud(note.summary)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-warm)]"
                  >
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Read aloud
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(note)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-warm)]"
                  >
                    {copiedId === note.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[var(--color-forest)]" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(note.id)}
                    aria-label={`Delete note ${note.title}`}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-hairline)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-terracotta)] hover:bg-[var(--color-paper-warm)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--color-ink)] leading-relaxed">
                {note.summary}
              </p>

              {note.arabicReferences.length > 0 && (
                <div className="mt-4 space-y-2">
                  {note.arabicReferences.map((ar, idx) => (
                    <p
                      key={idx}
                      dir="rtl"
                      lang="ar"
                      className="rounded-md bg-[var(--color-paper-warm)] px-4 py-2.5 font-arabic text-lg text-right text-[var(--color-ink)]"
                    >
                      {ar}
                    </p>
                  ))}
                </div>
              )}

              {note.citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[var(--color-border-hairline)]">
                  <div className="text-xs font-medium text-[var(--color-ink-subtle)]">
                    Cited Primary Sources
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--color-ink-muted)]">
                    {note.citations.map((c) => (
                      <li key={c.id}>
                        <span className="font-medium text-[var(--color-ink)]">{c.title}</span> — {c.book} ({c.author}, {c.edition}, {c.page})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
