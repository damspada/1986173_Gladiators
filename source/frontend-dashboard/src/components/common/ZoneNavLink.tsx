import clsx from 'clsx'
import { Link } from 'react-router-dom'

interface ZoneNavLinkProps {
  zone: string
  className?: string
}

const toZonePath = (zone: string) => `/zones/${encodeURIComponent(zone)}`

export const ZoneNavLink = ({ zone, className }: ZoneNavLinkProps) => {
  return (
    <Link
      to={toZonePath(zone)}
      className={clsx(
        'rounded-sm px-1 py-0.5 font-medium text-cyan-200 underline decoration-cyan-500/60 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
      }}
    >
      {zone}
    </Link>
  )
}