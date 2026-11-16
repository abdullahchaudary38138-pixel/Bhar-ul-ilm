import React from 'react';
import { motion } from 'motion/react';

export type ActiveTab = 'quran' | 'tilawat' | 'kids' | 'videos' | 'religions' | 'library' | 'voice' | 'research';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onNewSession: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeTab, onSelectTab, onNewSession }) => {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'quran', label: 'Quran Studio' },
    { id: 'tilawat', label: 'Live Tilawat' },
    { id: 'kids', label: 'Kids & Hifz' },
    { id: 'videos', label: 'Videos' },
    { id: 'religions', label: 'Religions' },
    { id: 'library', label: 'Book Library' },
    { id: 'voice', label: 'Live Voice' },
    { id: 'research', label: 'Research' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050a18]/85 backdrop-blur-xl shadow-[0_10px_30px_rgba(2,6,23,0.45)]">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-6 py-3.5">
        {/* Zone 1: Animated Geometric Crest + Single-line Bold Wordmark */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => onSelectTab('quran')}
          className="flex items-center gap-3 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-emerald)]"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-gold)]/45 bg-gradient-to-br from-[#0F203D] to-[#081226] shadow-md">
            <motion.svg
              width="22"
              height="22"
              viewBox="0 0 32 32"
              className="text-[var(--color-gold-soft)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
              aria-hidden="true"
            >
              <polygon
                points="16,2 20,12 30,16 20,20 16,30 12,20 2,16 12,12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="16" cy="16" r="4" fill="none" stroke="var(--color-emerald)" strokeWidth="1.5" />
            </motion.svg>
          </span>
          <span className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            Bahr-ul-Ilm
          </span>
        </motion.button>

        {/* Zone 2: Single-line crisp animated navigation */}
        <nav aria-label="Primary sections" className="hidden md:flex items-center gap-3 lg:gap-5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative px-2 py-1.5 text-sm font-bold tracking-tight transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-emerald)] ${
                  isActive
                    ? 'text-[var(--color-emerald)]'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="topbar-active-indicator"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    aria-hidden="true"
                    className="absolute inset-x-1 -bottom-[14px] h-[2.5px] rounded-full bg-gradient-to-r from-[var(--color-emerald)] via-[var(--color-gold-soft)] to-[var(--color-emerald)] shadow-[0_0_12px_rgba(16,185,129,0.75)]"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Zone 3: Crisp Primary Action */}
        <div className="shrink-0">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={onNewSession}
            className="rounded-xl bg-gradient-to-r from-[var(--color-emerald-deep)] to-[#059669] px-4 py-2 text-sm font-bold text-white shadow-[0_6px_18px_rgba(4,120,87,0.35)] transition-all hover:brightness-110 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-emerald)]"
          >
            New Session
          </motion.button>
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav
        aria-label="Mobile sections"
        className="flex md:hidden items-center justify-between overflow-x-auto border-t border-white/10 px-4 py-2 gap-3"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`text-xs font-bold whitespace-nowrap shrink-0 px-2.5 py-1 rounded-md ${
                isActive
                  ? 'bg-[var(--color-emerald-deep)]/25 text-[var(--color-emerald)]'
                  : 'text-[var(--color-ink-muted)]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
