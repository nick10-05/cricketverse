import { useState, useEffect, useCallback } from 'react'
import type { GameSession, DeliveryTurn } from '../../game-core/networking'
import { SyncEngine } from '../../game-core/networking/sync-engine'
import { TeamCoordinator } from '../../game-core/networking/team-coordinator'
import {
  subscribeChat, sendChat, sendQuickChat,
  QUICK_CHAT_OPTIONS, FIELD_AGGRESSION_OPTIONS,
  AGGRESSION_FIELD_MAP,
} from '../../game-core/networking'
import type {
  TeamRole, TeamChatMessage, FieldAggression,
  QuickChatMessage,
} from '../../game-core/networking/team-types'
import { BattingCanvas } from '../../components/game/BattingCanvas'
import { BowlingControls } from '../../components/game/BowlingControls'
import type { BowlingInput } from '../../game-core/bowling/types'
import { resolveDelivery } from '../../game-core/bowling/engine'
import { SHOT_MAP } from '../../game-core/batting/types'
import type { GamePlayer, PitchCondition } from '../../game-core/types'

interface GamePage2v2Props {
  session: GameSession
  currentPlayer: { id: string; name: string }
  onLeave: () => void
}

type View = 'main' | 'chat' | 'field'

export function GamePage2v2({ session, currentPlayer, onLeave }: GamePage2v2Props) {
  const [syncEngine] = useState(() => new SyncEngine(currentPlayer.id, currentPlayer.id === session.hostId))
  const [coordinator, setCoordinator] = useState<TeamCoordinator | null>(null)
  const [currentTurn, setCurrentTurn] = useState<DeliveryTurn | null>(null)
  const [role, setRole] = useState<TeamRole | null>(null)
  const [myTeamId, setMyTeamId] = useState<'teamA' | 'teamB' | null>(null)
  const [teammate, setTeammate] = useState<{ id: string; name: string } | null>(null)
  const [, setStatus] = useState(session.status)
  const [score] = useState('0/0')
  const [isMyAction, setIsMyAction] = useState(false)
  const [message, setMessage] = useState('Waiting for match to start...')
  const [connected, setConnected] = useState(true)
  const [view, setView] = useState<View>('main')
  const [chatMessages, setChatMessages] = useState<TeamChatMessage[]>([])
  const [aggression, setAggression] = useState<FieldAggression>('neutral')
  const [customChat, setCustomChat] = useState('')

  const dummyBatter: GamePlayer = {
    id: 'batter', name: 'Batter', role: 'batsman',
    skills: { power: 60, timing: 65, technique: 60, pace: 30, swing: 20, spin: 20, accuracy: 20, catching: 40, stamina: 70 },
  }
  const dummyBowler: GamePlayer = {
    id: 'bowler', name: 'Bowler', role: 'bowler',
    skills: { power: 20, timing: 20, technique: 30, pace: 70, swing: 60, spin: 55, accuracy: 65, catching: 50, stamina: 75 },
  }
  const defaultPitch: PitchCondition = { batting: 0.5, bowling: 0.5, paceSupport: 0.5, spinSupport: 0.5, label: 'Normal' }

  useEffect(() => {
    if (!session.teamRoles) return

    const c = new TeamCoordinator('2v2', session.teamRoles)
    setCoordinator(c)

    const playerTeamId = c.getPlayerTeamId(
      currentPlayer.id,
      session.teams.teamA.playerIds,
      session.teams.teamB.playerIds,
    )
    setMyTeamId(playerTeamId)

    if (playerTeamId) {
      const r = c.getTeamRole(currentPlayer.id, playerTeamId)
      setRole(r)

      const tid = c.getTeammateId(currentPlayer.id, playerTeamId)
      if (tid) {
        const teammatePlayer = session.players.find((p) => p.id === tid)
        setTeammate(teammatePlayer ? { id: teammatePlayer.id, name: teammatePlayer.name } : { id: tid, name: tid })
      }
    }
  }, [session.id, session.teamRoles, session.teams, session.players, currentPlayer.id])

  useEffect(() => {
    const unsub = subscribeChat(session.id, (msg) => {
      if (msg.targetTeamId === myTeamId || !msg.targetTeamId) {
        setChatMessages((prev) => [...prev, msg])
      }
    })
    return () => unsub()
  }, [session.id, myTeamId])

  useEffect(() => {
    syncEngine.setCallbacks({
      onTurnReady: (turn) => {
        setCurrentTurn(turn)
        const pid = currentPlayer.id
        const isBowler = turn.bowlerId === pid
        const isStriker = turn.batterId === pid
        const isNonStriker = turn.nonStrikerId === pid
        const isCaptain = turn.captainId === pid

        const shouldAct = isBowler || isStriker
        setIsMyAction(shouldAct)

        if (isBowler) { setRole('bowler'); setMessage('Your turn to bowl!') }
        else if (isStriker) { setRole('striker'); setMessage('Your turn to bat!') }
        else if (isNonStriker) { setRole('non_striker'); setMessage('Partner is batting') }
        else if (isCaptain) { setRole('captain'); setMessage('Set the field') }
        else { setMessage('Opponent is playing...') }
      },
      onStateChange: (state) => {
        setStatus(state.session?.status ?? 'idle')
        setConnected(state.phase === 'synced')
        if (state.session?.teamRoles && coordinator) {
          coordinator.setState(state.session.teamRoles)
        }
      },
      onRoleChange: (newRole) => {
        if (newRole) setRole(newRole)
      },
    })

    syncEngine.connect(session.id)
    return () => { syncEngine.disconnect() }
  }, [session.id, currentPlayer.id, syncEngine, coordinator])

  const handleBowled = useCallback(async (input: BowlingInput) => {
    if (!currentTurn || !isMyAction || role !== 'bowler') return

    const bowlerPlayer: GamePlayer = {
      id: currentPlayer.id, name: currentPlayer.name, role: 'all_rounder',
      skills: { power: 50, timing: 50, technique: 50, pace: 70, swing: 60, spin: 50, accuracy: 65, catching: 50, stamina: 70 },
    }

    const dummyInningsState = {
      battingTeamId: '', battingTeamName: '', bowlingTeamId: '', bowlingTeamName: '',
      total: 0, wickets: 0, legalBalls: 0, totalDeliveries: 0,
      battingStats: {}, bowlingStats: {},
      strikerId: '', nonStrikerId: '', nextBatterIndex: 0, battingOrder: [],
      currentOver: null, completedOvers: [],
      fallOfWickets: [], partnerships: [],
      currentPartnershipRuns: 0, currentPartnershipBalls: 0,
      bowlerOversCount: {}, target: null, completed: false, maxOvers: 5,
    }

    const delivery = resolveDelivery(input, bowlerPlayer, defaultPitch, null, dummyInningsState)

    await syncEngine.createTurn({
      deliveryNumber: (currentTurn?.deliveryNumber ?? 0) + 1,
      over: 1,
      ballInOver: 1,
      bowlerId: currentPlayer.id,
      batterId: currentTurn.batterId,
      nonStrikerId: coordinator?.getRolesForTeam(myTeamId === 'teamA' ? 'teamB' : 'teamA').nonStrikerId,
      captainId: coordinator?.getRolesForTeam(myTeamId === 'teamA' ? 'teamA' : 'teamB').captainId,
      bowlingInput: input,
      ballApproach: delivery.approach,
      shotInput: null, gesture: null, timing: null,
      outcome: null, fieldingState: null, stateSnapshot: null,
      phase: 'batting',
      timestamp: Date.now(),
      hostTiming: 0, clientTiming: 0,
    })
  }, [currentTurn, isMyAction, role, coordinator, myTeamId, syncEngine, currentPlayer, defaultPitch])

  const handleShot = useCallback(async (
    outcome: import('../../game-core/types').BallOutcome,
    gesture: import('../../game-core/batting/types').BattingGesture,
    timing: import('../../game-core/batting/types').TimingResult,
  ) => {
    if (!currentTurn || !isMyAction || role === 'bowler') return

    const power = (() => {
      const d = gesture.direction
      const s = SHOT_MAP[d]
      if (!s) return 0.5
      const powerMap: Record<string, number> = { drive: 0.6, cut: 0.5, pull: 0.7, sweep: 0.5, lofted: 0.9, defensive: 0.3 }
      return powerMap[s.shot] ?? 0.5
    })()

    const shotMapping = SHOT_MAP[gesture.direction]
    const shotInput: import('../../game-core/batting/types').ShotInput = {
      shotType: shotMapping?.shot ?? 'defensive',
      direction: shotMapping?.direction ?? 'straight',
      power,
      timing: timing.score,
      angle: 0,
    }

    await syncEngine.bat(currentTurn.id, shotInput, gesture, timing)
    setMessage(`Shot: ${outcome.isWicket ? 'WICKET!' : outcome.runs > 0 ? `${outcome.runs} runs` : 'Dot ball'}`)
  }, [currentTurn, isMyAction, role, syncEngine])

  const handleChat = useCallback(async () => {
    if (!customChat.trim()) return
    await sendChat(session.id, currentPlayer.id, currentPlayer.name, 'custom', customChat.trim(), myTeamId ?? '')
    setCustomChat('')
  }, [session.id, currentPlayer, myTeamId, customChat])

  const handleQuickChat = useCallback(async (msg: QuickChatMessage) => {
    await sendQuickChat(session.id, currentPlayer.id, currentPlayer.name, msg, myTeamId ?? '')
  }, [session.id, currentPlayer, myTeamId])

  const handleAggressionChange = useCallback(async (a: FieldAggression) => {
    setAggression(a)
    await sendChat(session.id, currentPlayer.id, currentPlayer.name, 'tactical', `Field set to ${a}`, myTeamId ?? '')
  }, [session.id, currentPlayer.id, currentPlayer.name, myTeamId])

  const handleLeave = useCallback(async () => {
    await syncEngine.leave()
    onLeave()
  }, [syncEngine, onLeave])

  const roleLabel = role ?? 'waiting'
  const isBatsmanView = role === 'striker' && isMyAction && currentTurn?.ballApproach
  const isBowlerView = role === 'bowler' && isMyAction
  const isCaptainView = role === 'captain'
  const isNonStrikerView = role === 'non_striker'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto p-4 space-y-3">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Room: {session.roomCode}</div>
            <div className="text-xs text-gray-500">{session.format}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500">{roleLabel}</span>
            <button onClick={handleLeave} className="text-sm text-gray-500 hover:text-red-400 ml-2">
              Leave
            </button>
          </div>
        </header>

        <div className="bg-gray-900 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <div className="text-lg font-bold text-emerald-400">{session.teams.teamA.name}</div>
              <div className="text-xs text-gray-500">
                {session.players.filter((p) => p.teamId === 'teamA').map((p) => (
                  <span key={p.id} className={p.id === currentPlayer.id ? 'text-emerald-300 font-bold' : ''}>
                    {p.name}
                  </span>
                )).reduce((acc, el) => acc.length ? [...acc, <span key="vs" className="mx-1 text-gray-600">/</span>, el] : [el], [] as React.ReactNode[])}
              </div>
            </div>
            <div className="text-2xl font-bold text-white">vs</div>
            <div className="text-center flex-1">
              <div className="text-lg font-bold text-emerald-400">{session.teams.teamB.name}</div>
              <div className="text-xs text-gray-500">
                {session.players.filter((p) => p.teamId === 'teamB').map((p) => (
                  <span key={p.id} className={p.id === currentPlayer.id ? 'text-emerald-300 font-bold' : ''}>
                    {p.name}
                  </span>
                )).reduce((acc, el) => acc.length ? [...acc, <span key="vs" className="mx-1 text-gray-600">/</span>, el] : [el], [] as React.ReactNode[])}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-emerald-400">{score}</div>
          <div className="text-sm text-gray-500 mt-1">{message}</div>
        </div>

        {teammate && (
          <div className="bg-gray-900 rounded-xl px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-300">{teammate.name}</span>
            </div>
            <div className="text-xs text-gray-500">
              {(() => {
                if (!coordinator || !myTeamId) return ''
                const tr = coordinator.getTeamRole(teammate.id, myTeamId)
                const labels: Record<string, string> = {
                  striker: 'Batting', non_striker: 'Non-striker',
                  bowler: 'Bowling', captain: 'Captain',
                }
                return labels[tr ?? ''] ?? 'Idle'
              })()}
            </div>
          </div>
        )}

        {isBatsmanView && (
          <BattingCanvas
            batter={dummyBatter}
            bowler={dummyBowler}
            ball={currentTurn!.ballApproach!}
            pitch={defaultPitch}
            ballReleaseTime={currentTurn!.timestamp}
            onShot={handleShot}
            disabled={!isMyAction}
          />
        )}

        {isBowlerView && (
          <BowlingControls
            onBowled={handleBowled}
            disabled={!isMyAction}
          />
        )}

        {isCaptainView && (
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-lg font-bold">Field Settings</div>
              <p className="text-xs text-gray-500">Set field aggression while your partner bowls</p>
            </div>
            <div className="flex justify-center gap-2">
              {FIELD_AGGRESSION_OPTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => handleAggressionChange(a)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm capitalize transition-colors ${
                    aggression === a
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs text-gray-500">
              {AGGRESSION_FIELD_MAP[aggression]?.map((zone) => (
                <div key={zone} className="bg-gray-800 rounded p-1 text-center capitalize">
                  {zone.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
          </div>
        )}

        {isNonStrikerView && (
          <div className="flex items-center justify-center min-h-[200px] bg-gray-900 rounded-xl">
            <div className="text-center text-gray-500">
              <p className="text-lg">At the non-striker's end</p>
              <p className="text-sm">Support your partner at the crease</p>
            </div>
          </div>
        )}

        {!isMyAction && !isNonStrikerView && !isCaptainView && role !== 'striker' && role !== 'bowler' && (
          <div className="flex items-center justify-center min-h-[300px] bg-gray-900 rounded-xl">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-4">⏳</div>
              <p>Waiting for action...</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setView(view === 'chat' ? 'main' : 'chat')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              view === 'chat' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            {view === 'chat' ? 'Game' : 'Chat'}
          </button>
          <button
            onClick={() => setView(view === 'field' ? 'main' : 'field')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              view === 'field' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            {view === 'field' ? 'Game' : 'Field'}
          </button>
        </div>

        {view === 'chat' && (
          <div className="bg-gray-900 rounded-xl p-3 space-y-2">
            <div className="h-40 overflow-y-auto space-y-1 mb-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`text-sm ${msg.senderId === currentPlayer.id ? 'text-emerald-400 text-right' : 'text-gray-300'}`}>
                  <span className="text-xs text-gray-500">{msg.senderName}: </span>
                  {msg.message}
                </div>
              ))}
              {chatMessages.length === 0 && (
                <p className="text-xs text-gray-600 text-center">No messages yet</p>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_CHAT_OPTIONS.slice(0, 6).map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickChat(q)}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customChat}
                onChange={(e) => setCustomChat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                placeholder="Team chat..."
                maxLength={100}
                className="flex-1 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg border border-gray-700 focus:border-emerald-500 outline-none"
              />
              <button
                onClick={handleChat}
                disabled={!customChat.trim()}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white text-sm rounded-lg font-bold"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {view === 'field' && myTeamId && (
          <div className="bg-gray-900 rounded-xl p-3 space-y-2">
            <div className="text-sm font-bold text-gray-300">Team Field Positions</div>
            <div className="grid grid-cols-4 gap-1 text-xs">
              {(() => {
                const tRole = coordinator?.getRolesForTeam(myTeamId === 'teamA' ? 'teamB' : 'teamA')
                if (!tRole) return null
                return AGGRESSION_FIELD_MAP[aggression].map((zone) => (
                  <div key={zone} className="bg-gray-800 rounded p-1 text-center capitalize text-gray-400">
                    {zone.replace(/_/g, ' ')}
                  </div>
                ))
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
