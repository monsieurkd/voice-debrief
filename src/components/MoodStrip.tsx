import { IconEnergyDot } from '@/components/ui'

const MOOD_COLOR: Record<string, string> = {
  low: 'text-error',
  neutral: 'text-on-surface-variant',
  high: 'text-on-secondary-container',
}

export function MoodStrip({ mood, energy }: { mood: string | null; energy: number | null }) {
  if (energy == null && !mood) return null
  return (
    <div className="flex items-center gap-2 text-xs text-on-surface-muted">
      {energy != null && (
        <span
          className="flex gap-0.5"
          role="img"
          aria-label={`energy ${energy} of 5`}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <IconEnergyDot
              key={n}
              className={
                n <= energy
                  ? 'h-3 w-3 text-on-surface opacity-100'
                  : 'h-3 w-3 text-on-surface-variant opacity-70'
              }
            />
          ))}
        </span>
      )}
      {/* label only what was actually captured — and the mood always carries a
          color-independent text token (and aria) so it isn't color-only */}
      <span
        className={mood ? MOOD_COLOR[mood] ?? '' : ''}
        role={mood ? 'img' : undefined}
        aria-label={mood ? `${mood} mood` : undefined}
      >
        {mood ? `${mood} mood` : ''}
        {mood && energy != null ? ' · ' : ''}
        {energy != null ? 'energy' : ''}
      </span>
    </div>
  )
}
