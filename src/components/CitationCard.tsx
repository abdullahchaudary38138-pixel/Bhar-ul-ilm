import React from 'react';
import { Volume2, ArrowUpRight, BookOpen } from 'lucide-react';
import type { CorpusPassage } from '../types.ts';

interface CitationCardProps {
  passage: CorpusPassage;
  onReadAloud?: (text: string) => void;
  onAskInStudio?: (passage: CorpusPassage) => void;
  compact?: boolean;
}

export const CitationCard: React.FC<CitationCardProps> = ({
  passage,
  onReadAloud,
  onAskInStudio,
  compact = false,
}) => {
  const isApproximate = passage.matchType === 'Approximate Semantic Match';

  return (
    <article className="border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] rounded-lg p-4 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-subtle)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-[var(--color-emerald)]">{passage.sourceType}</span>
          <span aria-hidden="true">·</span>
          <span>{passage.book}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{passage.page}</span>
        </div>
        {passage.matchType && (
          <span
            className={`font-medium ${
              isApproximate ? 'text-[var(--color-amber-warn)]' : 'text-[var(--color-emerald)]'
            }`}
          >
            {passage.matchType}
            {typeof passage.score === 'number' ? ` (${Math.round(passage.score * 100)}%)` : ''}
          </span>
        )}
      </div>

      <h4 className="mt-1.5 font-display text-lg font-semibold text-[var(--color-ink)] leading-snug">
        {passage.title}
      </h4>

      {passage.arabicText && (
        <p
          dir="rtl"
          lang="ar"
          className="mt-3 rounded-md bg-[var(--color-navy-elevated)] px-4 py-3 font-arabic text-xl text-[var(--color-ink)] text-right"
        >
          {passage.arabicText}
        </p>
      )}

      {!compact && passage.urduTranslation && (
        <p
          dir="rtl"
          lang="ur"
          className="mt-2.5 text-sm text-[var(--color-ink-muted)] text-right leading-relaxed"
        >
          {passage.urduTranslation}
        </p>
      )}

      <p className="mt-2.5 text-sm text-[var(--color-ink-muted)] leading-relaxed">
        {passage.englishTranslation}
      </p>

      <div className="mt-3 pt-3 border-t border-[var(--color-border-hairline)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-ink-subtle)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span>{passage.author}</span>
          <span aria-hidden="true">·</span>
          <span>{passage.edition}</span>
          <span aria-hidden="true">·</span>
          <span>{passage.tradition}</span>
          <span aria-hidden="true">·</span>
          <span className="font-medium text-[var(--color-gold-soft)]">{passage.verificationStatus}</span>
        </div>

        <div className="flex items-center gap-3">
          {onReadAloud && (
            <button
              type="button"
              onClick={() =>
                onReadAloud(
                  `${passage.arabicText ? passage.arabicText + '. ' : ''}${passage.englishTranslation}`
                )
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-emerald)] hover:underline whitespace-nowrap shrink-0"
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              Read source aloud
            </button>
          )}
          {onAskInStudio && (
            <button
              type="button"
              onClick={() => onAskInStudio(passage)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink)] hover:text-[var(--color-emerald)] hover:underline whitespace-nowrap shrink-0"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Ask in Live Voice
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
