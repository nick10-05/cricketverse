import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  listenFriends,
  listenFriendRequests,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  goOnline,
  goOffline,
} from '@/lib/friends'
import type { FriendWithPresence, FriendRequest, UserSearchResult } from '@/types/friends'
import { FriendCard, RequestCard } from '@/components/friends/FriendCard'

type Tab = 'friends' | 'requests' | 'search'

export function Friends() {
  const { user } = useAuth()
  if (!user) return null
  const [tab, setTab] = useState<Tab>('friends')
  const [friends, setFriends] = useState<FriendWithPresence[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    goOnline(user.uid)
    return () => { goOffline(user.uid) }
  }, [user.uid])

  useEffect(() => {
    const unsub1 = listenFriends(user.uid, setFriends)
    const unsub2 = listenFriendRequests(user.uid, setRequests)
    return () => { unsub1(); unsub2() }
  }, [user.uid])

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q)
    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await searchUsers(q.trim(), user.uid)
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }, [user.uid])

  const handleSendRequest = async (toUid: string) => {
    await sendFriendRequest(user.uid, toUid)
    setSearchResults((prev) =>
      prev.map((r) => r.uid === toUid ? { ...r, friendStatus: 'pending_sent' } : r),
    )
  }

  const handleAccept = async (reqId: string, from: string, to: string) => {
    await acceptFriendRequest(reqId, from, to)
  }

  const handleReject = async (reqId: string) => {
    await rejectFriendRequest(reqId)
  }

  const handleRemove = async (friendUid: string) => {
    await removeFriend(user.uid, friendUid)
  }

  const incomingRequests = requests.filter((r) => r.to === user.uid)
  const outgoingRequests = requests.filter((r) => r.from === user.uid)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">Friends</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-800">
        {(['friends', 'requests', 'search'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`cursor-pointer border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
            {t === 'requests' && incomingRequests.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                {incomingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Friends List */}
      {tab === 'friends' && (
        <div className="space-y-3">
          {friends.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
              <p className="text-gray-400">No friends yet</p>
              <p className="mt-1 text-sm text-gray-600">
                Search for users to add friends
              </p>
            </div>
          ) : (
            friends.map((f) => (
              <FriendCard key={f.uid} friend={f} onRemove={handleRemove} />
            ))
          )}
        </div>
      )}

      {/* Requests */}
      {tab === 'requests' && (
        <div className="space-y-4">
          {incomingRequests.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-gray-400">
                Incoming Requests ({incomingRequests.length})
              </h3>
              <div className="space-y-3">
                {incomingRequests.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    isIncoming
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </div>
          )}
          {outgoingRequests.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-gray-400">
                Sent Requests ({outgoingRequests.length})
              </h3>
              <div className="space-y-3">
                {outgoingRequests.map((r) => (
                  <RequestCard key={r.id} request={r} isIncoming={false} />
                ))}
              </div>
            </div>
          )}
          {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
              <p className="text-gray-400">No pending requests</p>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      {tab === 'search' && (
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search users by name..."
            className="mb-4 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-green-500"
          />
          {searching && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
            </div>
          )}
          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">No users found</p>
          )}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((u) => (
                <div
                  key={u.uid}
                  className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4"
                >
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.displayName} className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-700" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-gray-300">
                      {u.displayName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-white">{u.displayName}</span>
                    <span className={`ml-2 text-xs ${
                      u.friendStatus === 'friends' ? 'text-green-500'
                        : u.friendStatus === 'pending_sent' ? 'text-yellow-500'
                        : u.friendStatus === 'pending_received' ? 'text-blue-500'
                        : 'text-gray-600'
                    }`}>
                      {u.friendStatus === 'friends' ? 'Friends'
                        : u.friendStatus === 'pending_sent' ? 'Request Sent'
                        : u.friendStatus === 'pending_received' ? 'Request Received'
                        : ''}
                    </span>
                  </div>
                  {u.friendStatus === 'none' && (
                    <button
                      onClick={() => handleSendRequest(u.uid)}
                      className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-green-500"
                    >
                      Add Friend
                    </button>
                  )}
                  {u.friendStatus === 'pending_received' && (
                    <button
                      onClick={() => {
                        const req = requests.find((r) => r.from === u.uid)
                        if (req) handleAccept(req.id, req.from, req.to)
                      }}
                      className="cursor-pointer rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-500"
                    >
                      Accept
                    </button>
                  )}
                  <Link
                    to={`/profile`}
                    className="cursor-pointer rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-800"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
