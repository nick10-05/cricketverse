import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  runTransaction,
  onSnapshot,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AuctionSettings, AuctionState, AuctionPlayer, AuctionBid, TeamBudget } from '@/types/auction'

const AUCTION_DOC = 'auction'
const AUCTION_PLAYERS = 'auctionPlayers'
const AUCTION_BIDS = 'auctionBids'

/* ─── Settings ─────────────────────────────────────── */

export async function enableAuction(tournamentId: string, settings: AuctionSettings): Promise<void> {
  await setDoc(doc(db, 'tournaments', tournamentId, AUCTION_DOC, 'settings'), settings)
}

export async function getAuctionSettings(tournamentId: string): Promise<AuctionSettings | null> {
  const snap = await getDoc(doc(db, 'tournaments', tournamentId, AUCTION_DOC, 'settings'))
  return snap.exists() ? (snap.data() as AuctionSettings) : null
}

/* ─── State ─────────────────────────────────────────── */

export function listenAuctionState(
  tournamentId: string,
  cb: (state: AuctionState | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'tournaments', tournamentId, AUCTION_DOC, 'state'),
    (snap) => cb(snap.exists() ? (snap.data() as AuctionState) : null),
  )
}

export async function updateAuctionState(
  tournamentId: string,
  state: Partial<AuctionState>,
): Promise<void> {
  await setDoc(
    doc(db, 'tournaments', tournamentId, AUCTION_DOC, 'state'),
    { ...state, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/* ─── Auction Players ───────────────────────────────── */

export async function addPlayerToAuction(
  tournamentId: string,
  input: {
    playerId: string
    name: string
    role: string
    skills: Record<string, number>
    overall: number
    basePrice: number
    order: number
  },
): Promise<string> {
  const ref = await addDoc(
    collection(db, 'tournaments', tournamentId, AUCTION_DOC, AUCTION_PLAYERS),
    { ...input, status: 'pending', soldToTeamId: null, soldToTeamName: null, soldPrice: null, createdAt: serverTimestamp() },
  )
  return ref.id
}

export function listenAuctionPlayers(
  tournamentId: string,
  cb: (players: AuctionPlayer[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'tournaments', tournamentId, AUCTION_DOC, AUCTION_PLAYERS),
    orderBy('order', 'asc'),
  )
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuctionPlayer))))
}

export async function updateAuctionPlayer(
  tournamentId: string,
  playerDocId: string,
  data: Partial<AuctionPlayer>,
): Promise<void> {
  await updateDoc(
    doc(db, 'tournaments', tournamentId, AUCTION_DOC, AUCTION_PLAYERS, playerDocId),
    data,
  )
}

export async function removePlayerFromAuction(
  tournamentId: string,
  playerDocId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, 'tournaments', tournamentId, AUCTION_DOC, AUCTION_PLAYERS, playerDocId),
  )
}

/* ─── Bidding ───────────────────────────────────────── */

export async function placeBid(
  tournamentId: string,
  _playerDocId: string,
  teamId: string,
  teamName: string,
  amount: number,
  currentBid: number,
  currentBidderTeamId: string | null,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const settingsSnap = await tx.get(doc(db, 'tournaments', tournamentId, AUCTION_DOC, 'settings'))
    if (!settingsSnap.exists()) throw new Error('Auction settings not found')
    const settings = settingsSnap.data() as AuctionSettings

    const stateRef = doc(db, 'tournaments', tournamentId, AUCTION_DOC, 'state')
    const stateSnap = await tx.get(stateRef)
    if (!stateSnap.exists()) throw new Error('Auction not active')
    const state = stateSnap.data() as AuctionState
    if (state.status !== 'active') throw new Error('Auction is not active')

    if (amount < currentBid + settings.minIncrement) {
      throw new Error(`Bid must be at least ${currentBid + settings.minIncrement}`)
    }

    if (teamId === currentBidderTeamId) {
      throw new Error('You are already the highest bidder')
    }

    const teamRef = doc(db, 'tournaments', tournamentId, 'teams', teamId)
    const teamSnap = await tx.get(teamRef)
    if (!teamSnap.exists()) throw new Error('Team not found')
    const teamData = teamSnap.data()
    const spent = teamData.totalSpent ?? 0
    const remaining = settings.baseBudget - spent
    if (amount > remaining) {
      throw new Error(`Insufficient budget. You have ${remaining} remaining`)
    }

    const bidRef = doc(collection(db, 'tournaments', tournamentId, AUCTION_DOC, AUCTION_BIDS))
    tx.set(bidRef, {
      playerId: state.currentPlayerId,
      teamId,
      teamName,
      amount,
      createdAt: serverTimestamp(),
    })

    tx.update(stateRef, {
      currentBid: amount,
      currentBidderId: teamId,
      currentBidderTeamId: teamId,
      currentBidderTeamName: teamName,
      updatedAt: serverTimestamp(),
    })

    tx.update(teamRef, { totalSpent: spent + amount, updatedAt: serverTimestamp() })
  })
}

/* ─── Budgets ───────────────────────────────────────── */

export async function getTeamBudgets(tournamentId: string): Promise<TeamBudget[]> {
  const settings = await getAuctionSettings(tournamentId)
  const budget = settings?.baseBudget ?? 1000

  const snap = await getDocs(collection(db, 'tournaments', tournamentId, 'teams'))
  return snap.docs.map((d) => {
    const data = d.data()
    const spent = data.totalSpent ?? 0
    return {
      teamId: d.id,
      teamName: data.name,
      initialBudget: budget,
      spent,
      remaining: budget - spent,
      playersBought: data.playersBought ?? 0,
    }
  })
}

export function listenTeamBudgets(
  tournamentId: string,
  cb: (budgets: TeamBudget[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'tournaments', tournamentId, 'teams'),
    (snap) => {
      getAuctionSettings(tournamentId).then((settings) => {
        const budget = settings?.baseBudget ?? 1000
        const arr = snap.docs.map((d) => {
          const data = d.data()
          const spent = data.totalSpent ?? 0
          return {
            teamId: d.id,
            teamName: data.name,
            initialBudget: budget,
            spent,
            remaining: budget - spent,
            playersBought: data.playersBought ?? 0,
          }
        })
        cb(arr)
      })
    },
  )
}

/* ─── Bid History ──────────────────────────────────── */

export function listenBidHistory(
  tournamentId: string,
  playerDocId?: string,
  cb?: (bids: AuctionBid[]) => void,
): Unsubscribe {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
  if (playerDocId) constraints.unshift(where('playerId', '==', playerDocId))

  const q = query(
    collection(db, 'tournaments', tournamentId, AUCTION_DOC, AUCTION_BIDS),
    ...constraints,
  )
  return onSnapshot(q, (snap) => cb?.(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuctionBid))))
}
