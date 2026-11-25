import type { FriendWithPresence, FriendRequest } from '@/types/friends'

type FriendCardProps = {
  friend: FriendWithPresence
  onRemove: (uid: string) => void
}

export function FriendCard({ friend, onRemove }: FriendCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="relative shrink-0">
        {friend.photoURL ? (
          <img src={friend.photoURL} alt={friend.displayName} className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-700" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-gray-300">
            {friend.displayName.charAt(0)}
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-gray-900 ${
            friend.online ? 'bg-green-500' : 'bg-gray-600'
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-white">{friend.displayName}</span>
          <span className={`text-xs ${friend.online ? 'text-green-400' : 'text-gray-600'}`}>
            {friend.online ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Friends since {friend.friendSince?.toDate?.().toLocaleDateString() ?? 'recently'}
        </p>
      </div>
      <button
        onClick={() => onRemove(friend.uid)}
        className="cursor-pointer rounded-lg border border-red-500/30 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
      >
        Remove
      </button>
    </div>
  )
}

type RequestCardProps = {
  request: FriendRequest
  isIncoming: boolean
  onAccept?: (id: string, from: string, to: string) => void
  onReject?: (id: string) => void
  onCancel?: (id: string) => void
}

export function RequestCard({ request, isIncoming, onAccept, onReject, onCancel }: RequestCardProps) {
  const name = isIncoming ? request.fromName : request.toName
  const photo = isIncoming ? request.fromPhotoURL : request.toPhotoURL

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="relative shrink-0">
        {photo ? (
          <img src={photo} alt={name} className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-700" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 text-sm font-medium text-gray-300">
            {name.charAt(0)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="font-medium text-white">{name}</span>
        <p className="text-xs text-gray-500">
          {isIncoming ? 'Wants to be friends' : 'Request sent'}
        </p>
      </div>
      {isIncoming && onAccept && onReject ? (
        <div className="flex gap-2">
          <button
            onClick={() => onAccept(request.id, request.from, request.to)}
            className="cursor-pointer rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-500"
          >
            Accept
          </button>
          <button
            onClick={() => onReject(request.id)}
            className="cursor-pointer rounded-lg border border-gray-700 px-3 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-800"
          >
            Reject
          </button>
        </div>
      ) : onCancel ? (
        <button
          onClick={() => onCancel(request.id)}
          className="cursor-pointer rounded-lg border border-gray-700 px-3 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-800"
        >
          Cancel
        </button>
      ) : null}
    </div>
  )
}
