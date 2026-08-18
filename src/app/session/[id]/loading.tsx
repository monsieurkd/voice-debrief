export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-12">
      <div className="mb-8 h-6 w-44 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mb-8 h-5 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex flex-col gap-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="mb-3 h-3 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ))}
      </div>
    </main>
  )
}
