interface ReconnectingOverlayProps {
  attempts: number
  active: boolean
  onRetry: () => void
}

export const ReconnectingOverlay = ({ attempts, active, onRetry }: ReconnectingOverlayProps) => {
  if (!active) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
      <div className="cyber-modal pointer-events-auto tactical-panel w-[min(92vw,32rem)] border-rose-500/40 p-4 text-center">
        <p className="section-greeble text-xs uppercase tracking-[0.36em] text-rose-300">Signal Link Interrupted</p>
        <h2 className="u-neon-flicker mt-3 text-2xl font-semibold text-zinc-100">Reconnecting...</h2>
        <p className="mt-2 text-sm text-zinc-400">Attempt #{attempts}</p>
        <button
          type="button"
          className="cyber-button mt-6 border border-rose-400/70 bg-rose-600/15 px-4 py-2 text-xs uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-600/25"
          onClick={onRetry}
        >
          Retry Now
        </button>
      </div>
    </div>
  )
}
