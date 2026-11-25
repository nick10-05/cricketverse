import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TournamentFormat, Team } from '@/types/tournament'

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function generateLeagueRounds(teams: Team[]): { teamAId: string; teamBId: string }[][] {
  const n = teams.length
  const ids = teams.map((t) => t.id)
  const rounds: { teamAId: string; teamBId: string }[][] = []

  if (n % 2 !== 0) ids.push('BYE')

  const totalRounds = ids.length - 1
  const matchesPerRound = ids.length / 2

  for (let round = 0; round < totalRounds; round++) {
    const roundMatches: { teamAId: string; teamBId: string }[] = []
    for (let match = 0; match < matchesPerRound; match++) {
      const home = ids[match]
      const away = ids[ids.length - 1 - match]
      if (home !== 'BYE' && away !== 'BYE') {
        roundMatches.push({ teamAId: home, teamBId: away })
      }
    }
    rounds.push(roundMatches)
    ids.splice(1, 0, ids.pop()!)
  }

  return rounds
}

function generateKnockoutBracket(teams: Team[]): { teamAId: string; teamBId: string }[][] {
  const shuffled = shuffleArray(teams)
  const n = shuffled.length
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)))
  const rounds: { teamAId: string; teamBId: string }[][] = []

  const firstRound: { teamAId: string; teamBId: string }[] = []
  const sorted = shuffleArray(teams.map((t) => t.id))

  let idx = 0
  for (let i = 0; i < bracketSize / 2; i++) {
    const a = sorted[idx++]
    const b = idx < sorted.length ? sorted[idx++] : ''
    if (a && b) {
      firstRound.push({ teamAId: a, teamBId: b })
    } else {
      firstRound.push({ teamAId: a, teamBId: a })
    }
  }

  rounds.push(firstRound)

  let roundCount = Math.log2(bracketSize)
  if (n === bracketSize) {
    roundCount -= 1
    const secondRound: { teamAId: string; teamBId: string }[] = []
    for (let i = 0; i < firstRound.length; i += 2) {
      secondRound.push({ teamAId: '', teamBId: '' })
    }
    rounds.push(secondRound)
  }

  for (let r = rounds.length; r < Math.ceil(Math.log2(bracketSize)); r++) {
    const matchesInRound = bracketSize / Math.pow(2, r + 1)
    const round: { teamAId: string; teamBId: string }[] = []
    for (let i = 0; i < matchesInRound; i++) {
      round.push({ teamAId: '', teamBId: '' })
    }
    rounds.push(round)
  }

  return rounds
}

export async function generateFixtures(
  tournamentId: string,
  format: TournamentFormat,
  teams: Team[],
  qualifiers: number | null,
): Promise<void> {
  const batch = writeBatch(db)
  const shuffledTeams = shuffleArray(teams)
  let rounds: { teamAId: string; teamBId: string }[][] = []

  if (format === 'league') {
    rounds = generateLeagueRounds(shuffledTeams)
  } else if (format === 'knockout') {
    rounds = generateKnockoutBracket(shuffledTeams)
  } else if (format === 'league_knockout') {
    const leagueRounds = generateLeagueRounds(shuffledTeams)
    rounds = leagueRounds
  }

  for (let r = 0; r < rounds.length; r++) {
    const roundMatches = rounds[r]

    if (format === 'knockout' && r > 0) {
      const prevRoundEmpty = rounds[r - 1].every((m) => !m.teamAId || !m.teamBId)
      if (prevRoundEmpty && roundMatches.every((m) => !m.teamAId && !m.teamBId)) {
        break
      }
    }

    if (format === 'league_knockout' && r >= rounds.length - 1) {
      break
    }

    for (const match of roundMatches) {
      if (!match.teamAId && !match.teamBId) continue
      if (format !== 'knockout' && (!match.teamAId || !match.teamBId)) continue

      const teamA = teams.find((t) => t.id === match.teamAId)
      const teamB = teams.find((t) => t.id === match.teamBId)
      const isKnockoutPhase = format === 'league_knockout' && r >= (rounds.length - Math.ceil(Math.log2(qualifiers ?? 4)))

      const matchRef = doc(collection(db, 'tournaments', tournamentId, 'matches'))
      batch.set(matchRef, {
        round: r + 1,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        teamAName: teamA?.name ?? 'TBD',
        teamBName: teamB?.name ?? 'TBD',
        teamAScore: null,
        teamBScore: null,
        winnerId: null,
        status: 'scheduled',
        isBracketMatch: format === 'knockout' || isKnockoutPhase,
        createdAt: serverTimestamp(),
      })
    }
  }

  await batch.commit()
}
