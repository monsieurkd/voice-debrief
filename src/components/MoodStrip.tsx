const MOOD_COLOR: Record<string, string> = {
  low: 'text-amber-600 dark:text-amber-400',
  neutral: 'text-zinc-500 dark:text-zinc-400',
  high: 'text-emerald-600 dark:text-emerald-400',
}

export function MoodStrip({ mood, energy }: { mood: string | null; energy: number | null }) {
  if (energy == null && !mood) return null
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      {energy != null && (
        <span className="flex gap-0.5" aria-label={`energy ${energy} of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={n <= energy ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-300 dark:text-zinc-700'}
            >
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
