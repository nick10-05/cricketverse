import { useEffect, useRef, useCallback, useState } from 'react'
import { recognizeGesture, getGesturePower } from '../../game-core/batting/input-system'
import { evaluateTiming } from '../../game-core/batting/timing-engine'
import { resolveShot } from '../../game-core/batting/shot-engine'
import { SHOT_MAP } from '../../game-core/batting/types'
import type { BattingGesture, BallApproach, ShotInput, TimingResult } from '../../game-core/batting/types'
import type { BallOutcome, GamePlayer, PitchCondition } from '../../game-core/types'

interface BattingCanvasProps {
  batter: GamePlayer
  bowler: GamePlayer
  ball: BallApproach
  pitch: PitchCondition
  ballReleaseTime: number
  onShot: (outcome: BallOutcome, gesture: BattingGesture, timing: TimingResult) => void
  disabled?: boolean
}

export function BattingCanvas({ batter, bowler, ball, pitch, ballReleaseTime, onShot, disabled }: BattingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const [gesturePreview, setGesturePreview] = useState<string | null>(null)
  const [lastOutcome, setLastOutcome] = useState<BallOutcome | null>(null)

  const drawPitch = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, '#15803d')
    gradient.addColorStop(0.5, '#166534')
    gradient.addColorStop(1, '#15803d')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = '#fef3c7'
    ctx.lineWidth = 3
    ctx.setLineDash([8, 8])
    ctx.beginPath()
    ctx.moveTo(w * 0.35, 0)
    ctx.lineTo(w * 0.35, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(w * 0.65, 0)
    ctx.lineTo(w * 0.65, h)
    ctx.stroke()
    ctx.setLineDash([])

    const pitchCenterX = w * 0.5
    const pitchTop = h * 0.1
    const pitchBottom = h * 0.8
    const pitchWidth = w * 0.18

    ctx.fillStyle = '#d4a574'
    ctx.fillRect(pitchCenterX - pitchWidth / 2, pitchTop, pitchWidth, pitchBottom - pitchTop)

    ctx.strokeStyle = '#fef3c7'
    ctx.lineWidth = 2
    for (let i = 0; i < 5; i++) {
      const y = pitchTop + (pitchBottom - pitchTop) * (0.2 + i * 0.15)
      ctx.beginPath()
      ctx.moveTo(pitchCenterX - pitchWidth / 2 + 5, y)
      ctx.lineTo(pitchCenterX + pitchWidth / 2 - 5, y)
      ctx.stroke()
    }

    ctx.fillStyle = '#f8fafc'
    const batX = w * 0.5
    const batY = h * 0.82
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(batX, batY - 50)
    ctx.lineTo(batX - 5, batY)
    ctx.lineTo(batX + 5, batY)
    ctx.closePath()
    ctx.fillStyle = '#d97706'
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#f8fafc'
    ctx.font = '14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('⬆ DRIVE', w * 0.15, h * 0.2)
    ctx.fillText('⬆➡ CUT', w * 0.85, h * 0.2)
    ctx.fillText('⬇➡ PULL', w * 0.85, h * 0.7)
    ctx.fillText('⬇ SWEEP', w * 0.15, h * 0.7)
    ctx.fillText('⬅ LOFTED', w * 0.08, h * 0.45)
    ctx.fillText('➅ SIX', w * 0.92, h * 0.45)

    if (lastOutcome) {
      const label = lastOutcome.isWicket ? 'WICKET!' : lastOutcome.runs === 0 ? 'DOT' : `${lastOutcome.runs} RUNS`
      ctx.fillStyle = lastOutcome.isWicket ? '#ef4444' : lastOutcome.runs >= 4 ? '#22c55e' : '#f8fafc'
      ctx.font = 'bold 24px monospace'
      ctx.fillText(label, w * 0.5, h * 0.95)
    }

    if (gesturePreview) {
      ctx.fillStyle = '#fbbf24'
      ctx.font = '16px monospace'
      ctx.fillText(gesturePreview, w * 0.5, h * 0.06)
    }
  }, [gesturePreview, lastOutcome])

  useEffect(() => {
    drawPitch()
    const handleResize = () => drawPitch()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawPitch])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }, [disabled])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !touchStart.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStart.current.x
    const dy = touch.clientY - touchStart.current.y

    if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      let dir = ''
      if (angle >= -22.5 && angle < 22.5) dir = 'CUT ➡'
      else if (angle >= 22.5 && angle < 67.5) dir = 'PULL ⬇➡'
      else if (angle >= 67.5 && angle < 112.5) dir = 'SWEEP ⬇'
      else if (angle >= 112.5 && angle < 157.5) dir = 'PADDLE ⬇⬅'
      else if (angle >= 157.5 || angle < -157.5) dir = 'LOFT ⬅'
      else if (angle >= -157.5 && angle < -112.5) dir = 'LOFTED ⬆⬅'
      else if (angle >= -112.5 && angle < -67.5) dir = 'DRIVE ⬆'
      else dir = 'COVER ⬆➡'
      setGesturePreview(dir)
    }
  }, [disabled])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (disabled || !touchStart.current) return
    const touch = e.changedTouches[0]
    const gesture = recognizeGesture(
      touchStart.current.x,
      touchStart.current.y,
      touch.clientX,
      touch.clientY,
      touchStart.current.time,
      Date.now(),
    )
    touchStart.current = null
    setGesturePreview(null)

    const timing = evaluateTiming(gesture, ballReleaseTime, ball)
    const shotMapping = SHOT_MAP[gesture.direction]
    const power = getGesturePower(gesture)
    const shotInput: ShotInput = {
      shotType: shotMapping.shot,
      direction: shotMapping.direction,
      power,
      timing: timing.score,
      angle: 0,
    }

    const outcome = resolveShot(shotInput, ball, batter, bowler, pitch)
    setLastOutcome(outcome)
    onShot(outcome, gesture, timing)
  }, [disabled, ballReleaseTime, ball, batter, bowler, pitch, onShot])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    touchStart.current = { x: e.clientX, y: e.clientY, time: Date.now() }
  }, [disabled])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (disabled || !touchStart.current) return
    const dx = e.clientX - touchStart.current.x
    const dy = e.clientY - touchStart.current.y

    if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      let dir = ''
      if (angle >= -22.5 && angle < 22.5) dir = 'CUT ➡'
      else if (angle >= 22.5 && angle < 67.5) dir = 'PULL ⬇➡'
      else if (angle >= 67.5 && angle < 112.5) dir = 'SWEEP ⬇'
      else if (angle >= 112.5 && angle < 157.5) dir = 'PADDLE ⬇⬅'
      else if (angle >= 157.5 || angle < -157.5) dir = 'LOFT ⬅'
      else if (angle >= -157.5 && angle < -112.5) dir = 'LOFTED ⬆⬅'
      else if (angle >= -112.5 && angle < -67.5) dir = 'DRIVE ⬆'
      else dir = 'COVER ⬆➡'
      setGesturePreview(dir)
    }
  }, [disabled])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (disabled || !touchStart.current) return
    const gesture = recognizeGesture(
      touchStart.current.x,
      touchStart.current.y,
      e.clientX,
      e.clientY,
      touchStart.current.time,
      Date.now(),
    )
    touchStart.current = null
    setGesturePreview(null)

    const timing = evaluateTiming(gesture, ballReleaseTime, ball)
    const shotMapping = SHOT_MAP[gesture.direction]
    const power = getGesturePower(gesture)
    const shotInput: ShotInput = {
      shotType: shotMapping.shot,
      direction: shotMapping.direction,
      power,
      timing: timing.score,
      angle: 0,
    }

    const outcome = resolveShot(shotInput, ball, batter, bowler, pitch)
    setLastOutcome(outcome)
    onShot(outcome, gesture, timing)
  }, [disabled, ballReleaseTime, ball, batter, bowler, pitch, onShot])

  return (
    <div className="relative w-full max-w-md mx-auto">
      <canvas
        ref={canvasRef}
        width={360}
        height={520}
        className="w-full touch-none rounded-xl cursor-pointer select-none"
        style={{ background: '#14532d' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      {disabled && (
        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
          <span className="text-white text-lg font-bold">Waiting...</span>
        </div>
      )}
    </div>
  )
}
