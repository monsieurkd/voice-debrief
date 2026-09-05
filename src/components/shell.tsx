/**
 * App-wide Digital Sanctuary frame. Pages own their identity and controls;
 * the shared shell deliberately adds no navigation chrome.
 */
export function SanctuaryShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {children}
    </div>
  )
}
