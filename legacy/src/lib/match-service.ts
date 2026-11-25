import {
  doc, getDoc, updateDoc, serverTimestamp, collection, setDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { simulateMatch } from '@/lib/match-engine/engine'
import { PITCH_TYPES, type MatchResult, type PlayerSkills, type MatchPlayer, type TeamLineup } from '@/lib/match-engine/types'
import { getUserPlayers } from '@/lib/players'
import type { PlayerRole } from '@/types/player'
import type { Match } from '@/types/tournament'

function pickPitch(seed: number) {
  const keys = Object.keys(PITCH_TYPES)
  return PITCH_TYPES[keys[seed % keys.length]]
}

function playerToMatchPlayer(p: { id: string; name: string; role: PlayerRole; skills: PlayerSkills }): MatchPlayer {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    skills: p.skills,
  }
}

export async function playMatch(
  tournamentId: string,
  match: Match,
  seed: number,
): Promise<MatchResult> {
  console.log('playMatch:', { tournamentId, matchId: match.id, teamAId: match.teamAId, teamBId: match.teamBId })

  const teamARef = doc(db, 'tournaments', tournamentId, 'teams', match.teamAId)
  const teamBRef = doc(db, 'tournaments', tournamentId, 'teams', match.teamBId)
  const teamASnap = await getDoc(teamARef)
  const teamBSnap = await getDoc(teamBRef)

  if (!teamASnap.exists() || !teamBSnap.exists()) {
    throw new Error(`One or both teams not found (A:${teamASnap.exists()}, B:${teamBSnap.exists()})`)
  }

  const teamAData = teamASnap.data()
  const teamBData = teamBSnap.data()
  if (!teamAData || !teamBData) {
    throw new Error('Team data is empty')
  }

  const teamA = teamAData as { ownerId: string; name: string }
  const teamB = teamBData as { ownerId: string; name: string }
  console.log('Teams:', { teamA, teamB })

  const [playersA, playersB] = await Promise.all([
    getUserPlayers(teamA.ownerId),
    getUserPlayers(teamB.ownerId),
  ])
  console.log('Players:', { countA: playersA.length, countB: playersB.length })

  if (playersA.length < 2) throw new Error(`${teamA.name} needs at least 2 players (have ${playersA.length})`)
  if (playersB.length < 2) throw new Error(`${teamB.name} needs at least 2 players (have ${playersB.length})`)

  const hasBowlerA = playersA.some(p => p.role === 'bowler' || p.role === 'all_rounder')
  const hasBowlerB = playersB.some(p => p.role === 'bowler' || p.role === 'all_rounder')
  if (!hasBowlerA) throw new Error(`${teamA.name} needs at least one bowler or all-rounder`)
  if (!hasBowlerB) throw new Error(`${teamB.name} needs at least one bowler or all-rounder`)

  const lineupA: TeamLineup = {
    name: teamA.name,
    players: playersA.map(playerToMatchPlayer),
    battingOrder: playersA.map(p => p.id),
  }

  const lineupB: TeamLineup = {
    name: teamB.name,
    players: playersB.map(playerToMatchPlayer),
    battingOrder: playersB.map(p => p.id),
  }

  const overs = 5
  const pitch = pickPitch(seed)
  const result = simulateMatch(lineupA, lineupB, overs, pitch, seed)

  const matchRef = doc(db, 'tournaments', tournamentId, 'matches', match.id)

  const winnerId = result.winner === teamA.name ? match.teamAId
    : result.winner === teamB.name ? match.teamBId
    : null

  await updateDoc(matchRef, {
    teamAScore: { runs: result.innings1.total, wickets: result.innings1.wickets, overs: result.innings1.overs },
    teamBScore: { runs: result.innings2.total, wickets: result.innings2.wickets, overs: result.innings2.overs },
    winnerId,
    status: 'completed',
    updatedAt: serverTimestamp(),
  })

  const resultRef = doc(collection(db, 'tournaments', tournamentId, 'matches', match.id, 'result'))
  await setDoc(resultRef, {
    ...result,
    seed,
    pitch: pitch.label,
    simulatedAt: serverTimestamp(),
  })

  return result
}
