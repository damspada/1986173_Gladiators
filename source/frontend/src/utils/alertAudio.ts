import type { AlertSeverity } from './alerting'

interface ToneStep {
  frequency: number
  durationMs: number
  gain: number
}

const TONE_PATTERNS: Record<AlertSeverity, ToneStep[]> = {
  low: [{ frequency: 440, durationMs: 180, gain: 0.03 }],
  medium: [
    { frequency: 523, durationMs: 170, gain: 0.04 },
    { frequency: 659, durationMs: 170, gain: 0.04 },
  ],
  high: [
    { frequency: 659, durationMs: 160, gain: 0.05 },
    { frequency: 784, durationMs: 160, gain: 0.05 },
    { frequency: 659, durationMs: 160, gain: 0.05 },
  ],
  critical: [
    { frequency: 880, durationMs: 140, gain: 0.06 },
    { frequency: 740, durationMs: 140, gain: 0.06 },
    { frequency: 988, durationMs: 180, gain: 0.07 },
    { frequency: 740, durationMs: 180, gain: 0.07 },
  ],
}

export const playAlertTone = (severity: AlertSeverity, volumePercent = 65): void => {
  if (typeof window === 'undefined') {
    return
  }

  const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) {
    return
  }

  const context = new AudioContextCtor()
  const now = context.currentTime
  const pattern = TONE_PATTERNS[severity]
  const volumeScale = Math.min(1, Math.max(0, volumePercent / 100))

  let cursor = now
  for (const step of pattern) {
    const durationSeconds = step.durationMs / 1000
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()

    oscillator.type = severity === 'critical' ? 'sawtooth' : 'sine'
    oscillator.frequency.setValueAtTime(step.frequency, cursor)

    gainNode.gain.setValueAtTime(0.0001, cursor)
    gainNode.gain.exponentialRampToValueAtTime(step.gain * volumeScale, cursor + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, cursor + durationSeconds)

    oscillator.connect(gainNode)
    gainNode.connect(context.destination)

    oscillator.start(cursor)
    oscillator.stop(cursor + durationSeconds)

    cursor += durationSeconds + 0.05
  }

  window.setTimeout(() => {
    void context.close()
  }, Math.ceil((cursor - now) * 1000) + 80)
}
