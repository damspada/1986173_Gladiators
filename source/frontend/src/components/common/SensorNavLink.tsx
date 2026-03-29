import clsx from 'clsx'
import { Link } from 'react-router-dom'

interface SensorNavLinkProps {
  sensorId: string
  className?: string
}

const toSensorPath = (sensorId: string) => `/sensors/${encodeURIComponent(sensorId)}`

export const SensorNavLink = ({ sensorId, className }: SensorNavLinkProps) => {
  return (
    <Link
      to={toSensorPath(sensorId)}
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
      {sensorId}
    </Link>
  )
}