import { useState, useEffect, useCallback } from 'react'
import type { GameSession, DeliveryTurn } from '../../game-core/networking'
import { SyncEngine } from '../../game-core/networking/sync-engine'
import { BattingCanvas } from '../../components/game/BattingCanvas'
import { BowlingControls } from '../../components/game/BowlingControls'
import type { BowlingInput } from '../../game-core/bowling/types'
import { resolveDelivery } from '../../game-core/bowling/engine'
import { SHOT_MAP } from '../../game-core/batting/types'
import { getGesturePower } from '../../game-core/batting/input-system'
import type { GamePlayer, PitchCondition } from '../../game-core/types'

interface GamePageProps {
  session: GameSession
  currentPlayer: { id: string; name: string }
  onLeave: () => void
}

export function GamePage({ session, currentPlayer, onLeave }: GamePageProps) {
  const [syncEngine] = useState(() => new SyncEngine(currentPlayer.id, currentPlayer.id === session.hostId))
  const [currentTurn, setCurrentTurn] = useState<DeliveryTurn | null>(null)
  const [, setStatus] = useState(session.status)
  const [score] = useState('0/0')
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [isBowler, setIsBowler] = useState(false)
  const [message, setMessage] = useState('Waiting...')
  const [connected, setConnected] = useState(true)

  const isHost = currentPlayer.id === session.hostId

  useEffect(() => {
    syncEngine.setCallbacks({
      onTurnReady: (turn) => {
        setCurrentTurn(turn)
        const isBatsman = turn.batterId === currentPlayer.id
        setIsMyTurn(
          (turn.phase === 'bowling' && turn.bowlerId === currentPlayer.id) ||
          (turn.phase === 'batting' && isBatsman),
        )
        setIsBowler(turn.bowlerId === currentPlayer.id)
        setMessage(isBatsman ? 'Your turn to bat!' : 'Opponent is batting...')
      },
      onStateChange: (state) => {
        setStatus(state.session?.status ?? 'idle')
        setConnected(state.phase === 'synced')
      },
    })

    syncEngine.connect(session.id)

    return () => {
      syncEngine.disconnect()
    }
  }, [session.id, currentPlayer.id, syncEngine])

  const handleBowled = useCallback(async (input: BowlingInput) => {
    if (!currentTurn || !isMyTurn || !isBowler) return

    const dummyBowler: GamePlayer = {
      id: currentPlayer.id,
      name: currentPlayer.name,
      role: 'all_rounder',
      skills: { power: 50, timing: 50, technique: 50, pace: 70, swing: 60, spin: 50, accuracy: 65, catching: 50, stamina: 70 },
    }

    const pitch: PitchCondition = { batting: 0.5, bowling: 0.5, paceSupport: 0.5, spinSupport: 0.5, label: 'Normal' }

    const dummyInningsState = {
      battingTeamId: '',
      battingTeamName: '',
      bowlingTeamId: '',
      bowlingTeamName: '',
      total: 0, wickets: 0, legalBalls: 0, totalDeliveries: 0,
      battingStats: {}, bowlingStats: {},
      strikerId: '', nonStrikerId: '', nextBatterIndex: 0, battingOrder: [],
      currentOver: null, completedOvers: [],
      fallOfWickets: [], partnerships: [],
      currentPartnershipRuns: 0, currentPartnershipBalls: 0,
      bowlerOversCount: {}, target: null, completed: false, maxOvers: 5,
    }

    const delivery = resolveDelivery(input, dummyBowler, pitch, null, dummyInningsState)
    await syncEngine.createTurn({
      deliveryNumber: (currentTurn?.deliveryNumber ?? 0) + 1,
      over: 1,
      ballInOver: 1,
      bowlerId: currentPlayer.id,
      batterId: currentTurn.batterId,
      bowlingInput: input,
      ballApproach: delivery.approach,
      shotInput: null,
      gesture: null,
      timing: null,
      outcome: null,
      fieldingState: null,
      stateSnapshot: null,
      phase: 'batting',
      timestamp: Date.now(),
      hostTiming: 0,
      clientTiming: 0,
    })
  }, [currentTurn, isMyTurn, isBowler, syncEngine, currentPlayer])

  const handleShot = useCallback(async (
    outcome: import('../../game-core/types').BallOutcome,
    gesture: import('../../game-core/batting/types').BattingGesture,
    timing: import('../../game-core/batting/types').TimingResult,
  ) => {
    if (!currentTurn || !isMyTurn || isBowler) return

    const power = getGesturePower(gesture)
    const shotMapping = SHOT_MAP[gesture.direction]
    const shotInput: import('../../game-core/batting/types').ShotInput = {
      shotType: shotMapping.shot,
      direction: shotMapping.direction,
      power,
      timing: timing.score,
      angle: 0,
    }

    await syncEngine.bat(currentTurn.id, shotInput, gesture, timing)
    setMessage(`Shot played: ${outcome.isWicket ? 'WICKET!' : outcome.runs > 0 ? `${outcome.runs} runs` : 'Dot ball'}`)
  }, [currentTurn, isMyTurn, isBowler, syncEngine])

  const handleLeave = useCallback(async () => {
    await syncEngine.leave()
    onLeave()
  }, [syncEngine, onLeave])

  const dummyBatter: GamePlayer = {
    id: 'batter',
    name: 'Batter',
    role: 'batsman',
    skills: { power: 60, timing: 65, technique: 60, pace: 30, swing: 20, spin: 20, accuracy: 20, catching: 40, stamina: 70 },
  }

  const dummyBowler: GamePlayer = {
    id: 'bowler',
    name: 'Bowler',
    role: 'bowler',
    skills: { power: 20, timing: 20, technique: 30, pace: 70, swing: 60, spin: 55, accuracy: 65, catching: 50, stamina: 75 },
  }

  const defaultPitch: PitchCondition = { batting: 0.5, bowling: 0.5, paceSupport: 0.5, spinSupport: 0.5, label: 'Normal' }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Room: {session.roomCode}</div>
            <div className="text-xs text-gray-500">
              {session.players.map((p) => p.name).join(' vs ')}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <button onClick={handleLeave} className="text-sm text-gray-500 hover:text-red-400">
              Leave
            </button>
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-emerald-400">{score}</div>
          <div className="text-sm text-gray-500 mt-1">{message}</div>
        </div>

        <div className="bg-gray-900 rounded-xl p-2 text-xs text-gray-500 text-center">
          {session.players.map((p, i) => (
            <span key={p.id}>
              {i > 0 && <span className="mx-2">vs</span>}
              <span className={p.id === currentPlayer.id ? 'text-emerald-400 font-bold' : 'text-gray-300'}>
                {p.name}
              </span>
            </span>
          ))}
        </div>

        {isMyTurn && isBowler && (
          <BowlingControls
            onBowled={handleBowled}
            disabled={!isMyTurn}
          />
        )}

        {isMyTurn && !isBowler && currentTurn?.ballApproach && (
          <BattingCanvas
            batter={dummyBatter}
            bowler={dummyBowler}
            ball={currentTurn.ballApproach}
            pitch={defaultPitch}
            ballReleaseTime={currentTurn.timestamp}
            onShot={handleShot}
            disabled={!isMyTurn}
          />
        )}

        {!isMyTurn && (
          <div className="flex items-center justify-center min-h-[300px] bg-gray-900 rounded-xl">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-4">⏳</div>
              <p>Waiting for opponent...</p>
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="text-xs text-gray-600">
            {isHost ? 'You are the host' : 'You are connected'}
            {' · '}
            {session.format}
          </p>
        </div>
      </div>
    </div>
  )
}
