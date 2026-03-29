interface AboutModalProps {
  open: boolean
  onClose: () => void
  frontendVersion: string
  commitHash: string
  backendImageTag: string
  buildTimestamp: string
}

export const AboutModal = ({
  open,
  onClose,
  frontendVersion,
  commitHash,
  backendImageTag,
  buildTimestamp,
}: AboutModalProps) => {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3" role="dialog" aria-modal="true">
      <div className="tactical-panel w-[min(92vw,34rem)] border-zinc-700/90 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Build Traceability</p>
            <h2 className="mt-1 text-lg uppercase tracking-[0.16em] text-zinc-100">About This Dashboard</h2>
          </div>
          <button
            type="button"
            className="rounded-sm border border-zinc-600 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300 hover:border-cyan-400/70 hover:text-cyan-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-2 text-[11px] uppercase tracking-[0.1em] text-zinc-300">
          <p className="rounded-sm border border-zinc-700/80 bg-zinc-900/70 px-2 py-2">Frontend version: {frontendVersion}</p>
          <p className="rounded-sm border border-zinc-700/80 bg-zinc-900/70 px-2 py-2">Commit hash: {commitHash}</p>
          <p className="rounded-sm border border-zinc-700/80 bg-zinc-900/70 px-2 py-2">Backend image: {backendImageTag}</p>
          <p className="rounded-sm border border-zinc-700/80 bg-zinc-900/70 px-2 py-2">Build timestamp: {buildTimestamp}</p>
        </div>
      </div>
    </div>
  )
}
