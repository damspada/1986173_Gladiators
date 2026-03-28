export const formatUtcTimestamp = (iso: string): string => {
  const date = new Date(iso)
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC')
}

export const formatFrequency = (value: number): string => `${value.toFixed(2)} Hz`
