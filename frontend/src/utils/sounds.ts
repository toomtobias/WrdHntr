/**
 * Sound utilities using Web Audio API
 */

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

/**
 * Play a beep sound
 */
export function playBeep(frequency = 800, duration = 0.15) {
  try {
    const ctx = getAudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  } catch (e) {
    // Audio not supported or blocked
  }
}

/**
 * Play countdown beep (higher pitch as time runs out)
 */
export function playCountdownBeep(secondsRemaining: number) {
  // Higher pitch as time runs out
  const frequency = 600 + (10 - secondsRemaining) * 40
  playBeep(frequency, 0.1)
}

/**
 * Play game over sound (descending tones)
 */
export function playGameOver() {
  try {
    const ctx = getAudioContext()
    const frequencies = [600, 500, 400]

    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = freq
      oscillator.type = 'sine'

      const startTime = ctx.currentTime + i * 0.15
      gainNode.gain.setValueAtTime(0.3, startTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2)

      oscillator.start(startTime)
      oscillator.stop(startTime + 0.2)
    })
  } catch (e) {
    // Audio not supported or blocked
  }
}
