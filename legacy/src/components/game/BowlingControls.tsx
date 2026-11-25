import { useState, useRef, useCallback, useEffect } from 'react'
import { LINE_LABELS, LENGTH_LABELS, LINE_ORDER, LENGTH_ORDER, DELIVERY_LABELS, DELIVERY_GROUPS } from '../../game-core/bowling/types'
import { createBowlingMeter, startCharge, updateCharge, releaseCharge, resetMeter } from '../../game-core/bowling/controls'
import type { DeliveryType, BowlingInput, BowlingMeter } from '../../game-core/bowling/types'
import type { BallLine, BallLength } from '../../game-core/batting/types'

interface BowlingControlsProps {
  onBowled: (input: BowlingInput) => void
  disabled?: boolean
}

export function BowlingControls({ onBowled, disabled }: BowlingControlsProps) {
  const [delivery, setDelivery] = useState<DeliveryType>('fast')
  const [targetLine, setTargetLine] = useState<BallLine>('middle_stump')
  const [targetLength, setTargetLength] = useState<BallLength>('good')
  const [meter, setMeter] = useState<BowlingMeter>(createBowlingMeter())
  const [swingAmount, setSwingAmount] = useState(0.5)
  const meterRef = useRef<number>(0)
  const chargeRef = useRef<number>(0)
  const frameRef = useRef<number>(0)

  const handleMeterStart = useCallback(() => {
    if (disabled || meter.phase !== 'idle') return
    setMeter(startCharge())
    const startTime = performance.now()
    chargeRef.current = startTime

    const animate = () => {
      const elapsed = performance.now() - chargeRef.current
      const newMeter = updateCharge({ power: meterRef.current, phase: 'charging' }, elapsed)
      meterRef.current = newMeter.power
      setMeter(newMeter)
      if (newMeter.phase === 'charging' && newMeter.power < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }
    frameRef.current = requestAnimationFrame(animate)
  }, [disabled, meter.phase])

  const handleMeterRelease = useCallback(() => {
    if (disabled || meter.phase !== 'charging') return
    cancelAnimationFrame(frameRef.current)
    const locked = releaseCharge(meterRef.current as unknown as BowlingMeter)
    setMeter(locked)
    setMeter(locked)

    const input: BowlingInput = {
      delivery,
      targetLine,
      targetLength,
      power: meterRef.current,
      swingAmount,
      releaseTime: Date.now(),
    }

    onBowled(input)

    setTimeout(() => {
      meterRef.current = 0
      setMeter(resetMeter())
    }, 500)
  }, [disabled, meter.phase, delivery, targetLine, targetLength, swingAmount, onBowled])

  useEffect(() => {
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  const powerPercent = Math.round(meter.power * 100)
  const meterColor = powerPercent < 30 ? '#22c55e' : powerPercent < 70 ? '#eab308' : powerPercent < 90 ? '#f97316' : '#ef4444'

  return (
    <div className="w-full max-w-md mx-auto bg-gray-900 rounded-xl p-4 space-y-4 text-white select-none">
      <div className="text-center">
        <div className="grid grid-cols-2 gap-1 text-xs">
          {DELIVERY_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="text-gray-500 font-semibold text-center col-span-2">{group.label}</div>
              <div className="flex flex-wrap gap-1 justify-center">
                {group.types.map((t) => (
                  <button
                    key={t}
                    onClick={() => setDelivery(t)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      delivery === t
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {DELIVERY_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-400 mb-1 text-center">Line</div>
        <div className="flex gap-1 justify-center">
          {LINE_ORDER.map((line) => (
            <button
              key={line}
              onClick={() => setTargetLine(line)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                targetLine === line
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {LINE_LABELS[line]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-400 mb-1 text-center">Length</div>
        <div className="flex gap-1 justify-center">
          {LENGTH_ORDER.map((len) => (
            <button
              key={len}
              onClick={() => setTargetLength(len)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                targetLength === len
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {LENGTH_LABELS[len]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-400 mb-1 text-center">
          Swing/Spin: {Math.round(swingAmount * 100)}%
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={swingAmount}
          onChange={(e) => setSwingAmount(parseFloat(e.target.value))}
          className="w-full accent-emerald-500"
          disabled={disabled}
        />
      </div>

      <div>
        <div className="text-xs text-gray-400 mb-1 text-center">Power: {powerPercent}%</div>
        <div
          className="h-16 bg-gray-800 rounded-lg relative overflow-hidden cursor-pointer"
          onMouseDown={handleMeterStart}
          onMouseUp={handleMeterRelease}
          onTouchStart={handleMeterStart}
          onTouchEnd={handleMeterRelease}
        >
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-75"
            style={{
              height: `${powerPercent}%`,
              backgroundColor: meterColor,
              opacity: meter.phase === 'idle' ? 0.3 : 0.9,
            }}
          />
          {meter.phase === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Tap & hold to charge, release to bowl
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
