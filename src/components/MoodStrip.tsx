const MOOD_COLOR: Record<string, string> = {
  low: 'text-error',
  neutral: 'text-on-surface-muted',
  high: 'text-on-secondary-container',
}

export function MoodStrip({ mood, energy }: { mood: string | null; energy: number | null }) {
  if (energy == null && !mood) return null
  return (
    <div className="flex items-center gap-2 text-xs text-on-surface-muted">
      {energy != null && (
        <span className="flex gap-0.5" aria-label={`energy ${energy} of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= energy ? 'text-on-surface' : 'text-outline-variant'}>
              ●
            </span>
          ))}
        </span>
      )}
      {/* label only what was actually captured — and let the mood carry its color */}
      <span className={mood ? MOOD_COLOR[mood] ?? '' : ''}>
        {mood ? `${mood} mood` : ''}
        {mood && energy != null ? ' · ' : ''}
        {energy != null ? 'energy' : ''}
      </span>
    </div>
  )
}
