export function MoodStrip({ mood, energy }: { mood: string | null; energy: number | null }) {
  if (energy == null && !mood) return null
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      {energy != null && (
        <span className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= energy ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-300 dark:text-zinc-700'}>
              ●
            </span>
          ))}
        </span>
      )}
      {/* label only what was actually captured — "high energy" with energy=null claimed data we never had */}
      <span>
        {mood ? `${mood} mood` : ''}
        {mood && energy != null ? ' · ' : ''}
        {energy != null ? 'energy' : ''}
      </span>
    </div>
  )
}
