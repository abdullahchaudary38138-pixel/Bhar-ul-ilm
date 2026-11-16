import React from 'react';
import { ArrowDown } from 'lucide-react';
import type { DiagramData } from '../types.ts';

interface DiagramRendererProps {
  diagram: DiagramData;
}

export const DiagramRenderer: React.FC<DiagramRendererProps> = ({ diagram }) => {
  if (!diagram.nodes || diagram.nodes.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-navy)] p-4">
      <div className="text-xs font-medium text-[var(--color-gold-soft)]">
        Conceptual Diagram · {diagram.title}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {diagram.nodes.map((node, index) => {
          const outgoingEdge = diagram.edges?.find((e) => e.from === node.id);
          return (
            <React.Fragment key={node.id}>
              <div className="rounded-md border border-[var(--color-border-hairline)] bg-[var(--color-navy-surface)] px-3.5 py-2.5">
                <span className="text-sm font-semibold text-[var(--color-ink)]">
                  {index + 1}. {node.label}
                </span>
                {node.detail && (
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)] leading-relaxed">
                    {node.detail}
                  </p>
                )}
              </div>
              {index < diagram.nodes.length - 1 && (
                <div className="flex items-center justify-center gap-2 py-0.5 text-xs text-[var(--color-ink-subtle)]">
                  <ArrowDown className="h-3.5 w-3.5 text-[var(--color-emerald)]" aria-hidden="true" />
                  {outgoingEdge?.label && <span>{outgoingEdge.label}</span>}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
