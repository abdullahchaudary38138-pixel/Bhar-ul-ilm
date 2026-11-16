import React, { useEffect, useState } from 'react';
import { CheckSquare, Square, Plus, Trash2, BookOpen, Calendar } from 'lucide-react';
import type { LearningProgressState } from '../types.ts';

interface LearningProgressViewProps {
  onJumpToAyah: (surah: number, ayah: number) => void;
}

export const LearningProgressView: React.FC<LearningProgressViewProps> = ({
  onJumpToAyah,
}) => {
  const [progress, setProgress] = useState<LearningProgressState | null>(null);
  const [revLabel, setRevLabel] = useState('');
  const [revType, setRevType] = useState<'Ayah' | 'Tajweed' | 'Grammar' | 'Book'>('Ayah');
  const [revDate, setRevDate] = useState(new Date().toISOString().slice(0, 10));

  const loadProgress = async () => {
    const res = await fetch('/api/progress');
    const data = await res.json();
    if (data.progress) setProgress(data.progress);
  };

  useEffect(() => {
    loadProgress();
  }, []);

  const handleAddRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revLabel.trim()) return;
    const res = await fetch('/api/progress/revision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: revLabel.trim(), type: revType, dueDate: revDate }),
    });
    const data = await res.json();
    if (data.progress) {
      setProgress(data.progress);
      setRevLabel('');
    }
  };

  const handleToggleRevision = async (id: string) => {
    const res = await fetch(`/api/progress/revision/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
    });
    const data = await res.json();
    if (data.progress) setProgress(data.progress);
  };

  const handleDeleteBookmark = async (id: string) => {
    const res = await fetch(`/api/progress/bookmark/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.progress) setProgress(data.progress);
  };

  if (!progress) {
    return <div className="py-8 text-sm text-[var(--color-ink-subtle)]">Loading learning history…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--color-border-hairline)] pb-4">
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          Personal Learning Progress & Revision Planner
        </h2>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
          Tracks your actual study history, Tajweed practice, and user-controlled revision schedule—without turning sacred learning into a competitive score.
        </p>
      </div>

      {/* Measured Study Counters (Tabular Numerals) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Surahs Studied', value: progress.surahsStudied.length },
          { label: 'Ayat Studied', value: progress.ayatStudied.length },
          { label: 'Vocabulary / Words', value: progress.vocabularyCount },
          { label: 'Grammar Lessons', value: progress.grammarLessonsCompleted.length },
          { label: 'Tilawat Attempts', value: progress.tajweedPracticeCount },
          { label: 'Corrections Improved', value: progress.mistakesCorrected },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-4"
          >
            <div className="text-xs text-[var(--color-ink-subtle)]">{stat.label}</div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--color-ink)]">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* User-Controlled Revision Schedule */}
        <div className="lg:col-span-7 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--color-emerald)]" />
            <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">
              Revision Schedule
            </h3>
          </div>

          <form onSubmit={handleAddRevision} className="flex flex-wrap gap-2 text-xs">
            <input
              type="text"
              value={revLabel}
              onChange={(e) => setRevLabel(e.target.value)}
              placeholder="Add revision goal (e.g., Practice Madd Lazim in 1:7)"
              className="flex-1 min-w-[200px] rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2 text-[var(--color-ink)]"
            />
            <select
              value={revType}
              onChange={(e) => setRevType(e.target.value as typeof revType)}
              className="rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-2 text-[var(--color-ink)]"
            >
              <option value="Ayah">Ayah</option>
              <option value="Tajweed">Tajweed</option>
              <option value="Grammar">Grammar</option>
              <option value="Book">Book</option>
            </select>
            <input
              type="date"
              value={revDate}
              onChange={(e) => setRevDate(e.target.value)}
              className="rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-2.5 py-2 font-mono text-[var(--color-ink)]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded bg-[var(--color-emerald-deep)] px-3.5 py-2 font-medium text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </form>

          <div className="space-y-2">
            {progress.revisionQueue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3.5 py-2.5 text-xs"
              >
                <button
                  type="button"
                  onClick={() => handleToggleRevision(item.id)}
                  className="flex items-center gap-2.5 text-left flex-1"
                >
                  {item.completed ? (
                    <CheckSquare className="h-4 w-4 text-[var(--color-emerald)] shrink-0" />
                  ) : (
                    <Square className="h-4 w-4 text-[var(--color-ink-subtle)] shrink-0" />
                  )}
                  <span className={item.completed ? 'line-through text-[var(--color-ink-subtle)]' : 'text-[var(--color-ink)]'}>
                    {item.label}
                  </span>
                </button>
                <span className="font-mono tabular-nums text-[var(--color-ink-subtle)] shrink-0">
                  {item.type} · {item.dueDate}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bookmarks & Books Read */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-3">
            <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">
              Saved Bookmarks
            </h3>
            {progress.bookmarks.length === 0 ? (
              <p className="text-xs text-[var(--color-ink-muted)]">
                Bookmark any Ayah in the Quran Studio or any Book Page in the Library to revisit it here.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {progress.bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="flex items-center justify-between gap-2 rounded border border-[var(--color-border-hairline)] bg-[var(--color-navy)] px-3 py-2"
                  >
                    <div>
                      <div className="font-medium text-[var(--color-ink)]">{bm.label}</div>
                      {bm.note && <div className="text-[11px] text-[var(--color-ink-subtle)] truncate max-w-[260px]">{bm.note}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {bm.targetType === 'ayah' && (
                        <button
                          type="button"
                          onClick={() => {
                            const [s, a] = bm.targetRef.split(':').map(Number);
                            if (s && a) onJumpToAyah(s, a);
                          }}
                          className="text-[var(--color-emerald)] hover:underline"
                        >
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteBookmark(bm.id)}
                        aria-label={`Remove bookmark ${bm.label}`}
                        className="text-[var(--color-crimson)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] p-5 space-y-2.5 text-xs">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[var(--color-gold-soft)]" />
              <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">
                Books & Grammar History
              </h3>
            </div>
            <div className="text-[var(--color-ink-muted)]">
              <strong>Grammar Lessons:</strong> {progress.grammarLessonsCompleted.join(' · ')}
            </div>
            {progress.booksReadPages.length > 0 && (
              <ul className="space-y-1 text-[var(--color-ink-muted)] pt-1">
                {progress.booksReadPages.map((b) => (
                  <li key={b.bookId}>
                    {b.title} — reached Digital Page <span className="font-mono tabular-nums">{b.lastPage}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
