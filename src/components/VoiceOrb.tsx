import React from 'react';
import { motion } from 'motion/react';

interface VoiceOrbProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted';
  audioLevel: number; // 0.0 to 1.0 real mic or output amplitude
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, audioLevel }) => {
  const clamped = Math.max(0.06, Math.min(1, audioLevel));
  const outerScale = 1 + clamped * 0.24;
  const innerScale = 1 + clamped * 0.12;

  const stateLabel =
    state === 'speaking'
      ? 'Pakistani Urdu Voice Active — Bol Kar Barge-in Kar Sakte Hain'
      : state === 'listening'
        ? 'Sun Raha Hoon — Urdu / Roman Urdu / Arabic / English'
        : state === 'thinking'
          ? 'Dalail aur Hawalay Check Ho Rahe Hain'
          : state === 'interrupted'
            ? 'Ruk Gaya — Aapki Baat Sun Raha Hoon'
            : 'WhatsApp-Style Pakistani Urdu Voice Call Ready';

  const strokeHex =
    state === 'speaking'
      ? '#D4AF37'
      : state === 'interrupted'
        ? '#F59E0B'
        : state === 'listening'
          ? '#10B981'
          : '#334155';

  const ringColor =
    state === 'speaking'
      ? 'border-[var(--color-gold)]'
      : state === 'interrupted'
        ? 'border-[var(--color-amber-warn)]'
        : state === 'listening'
          ? 'border-[var(--color-emerald)]'
          : 'border-[var(--color-border-hairline)]';

  const rotationDuration =
    state === 'speaking' ? 10 : state === 'listening' ? 14 : state === 'thinking' ? 6 : 36;

  return (
    <div className="flex flex-col items-center justify-center py-4 select-none">
      <div className="relative flex h-44 w-44 items-center justify-center">
        {/* Radial ambient glow */}
        <motion.div
          aria-hidden="true"
          animate={{
            scale: state === 'idle' ? 0.92 : outerScale,
            opacity: state === 'idle' ? 0.18 : 0.35 + clamped * 0.45,
          }}
          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-2 rounded-full blur-xl"
          style={{
            background:
              state === 'speaking'
                ? 'radial-gradient(circle, rgba(212,175,55,0.45) 0%, transparent 70%)'
                : state === 'listening'
                  ? 'radial-gradient(circle, rgba(16,185,129,0.45) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(148,163,184,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Rotating Islamic Geometric Octagram (Rub el Hizb) Ring */}
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 160 160"
          className="absolute inset-0 h-full w-full"
          animate={{
            rotate: 360,
            scale: state === 'idle' ? 0.96 : 0.96 + clamped * 0.16,
          }}
          transition={{
            rotate: { duration: rotationDuration, repeat: Infinity, ease: 'linear' },
            scale: { duration: 0.1, ease: 'easeOut' },
          }}
        >
          <rect
            x="32"
            y="32"
            width="96"
            height="96"
            rx="8"
            fill="none"
            stroke={strokeHex}
            strokeWidth="1.2"
            strokeOpacity={state === 'idle' ? 0.35 : 0.75}
          />
          <rect
            x="32"
            y="32"
            width="96"
            height="96"
            rx="8"
            transform="rotate(45 80 80)"
            fill="none"
            stroke={strokeHex}
            strokeWidth="1.2"
            strokeOpacity={state === 'idle' ? 0.35 : 0.75}
          />
          <circle
            cx="80"
            cy="80"
            r="68"
            fill="none"
            stroke={strokeHex}
            strokeWidth="0.9"
            strokeDasharray="4 6"
            strokeOpacity={state === 'idle' ? 0.3 : 0.65}
          />
        </motion.svg>

        {/* Inner acoustic core */}
        <motion.div
          aria-hidden="true"
          animate={{ scale: innerScale }}
          transition={{ duration: 0.09, ease: [0.16, 1, 0.3, 1] }}
          className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-2 ${ringColor} bg-[var(--color-navy)]`}
        >
          <span className="font-arabic text-3xl text-[var(--color-gold-soft)]">بحر</span>
        </motion.div>
      </div>

      {/* Real-time 24-bar symmetric voice equalizer */}
      <div className="mt-3 flex h-8 items-end gap-1" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => {
          const distFromCenter = Math.abs(i - 11.5) / 12;
          const envelope = Math.max(0.25, 1 - distFromCenter * 0.8);
          const wave = state === 'idle' ? 0.14 : Math.max(0.16, Math.min(1, clamped * (0.45 + envelope)));
          return (
            <motion.div
              key={i}
              animate={{ scaleY: wave }}
              transition={{ duration: 0.08, ease: 'easeOut' }}
              className={`w-1 rounded-full ${
                state === 'speaking'
                  ? 'bg-[var(--color-gold)]'
                  : state === 'interrupted'
                    ? 'bg-[var(--color-amber-warn)]'
                    : 'bg-[var(--color-emerald)]'
              }`}
              style={{
                height: '30px',
                transformOrigin: 'bottom',
              }}
            />
          );
        })}
      </div>

      <div className="mt-2.5 text-center text-xs font-medium text-[var(--color-ink-muted)]">
        {stateLabel}
      </div>
    </div>
  );
};
