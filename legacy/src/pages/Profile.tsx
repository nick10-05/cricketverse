import { useAuth } from '@/context/AuthContext'

export function Profile() {
  const { user, signOut } = useAuth()
  if (!user) return null

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-white">Profile</h1>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="mb-6 flex flex-col items-center">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName ?? ''}
              className="mb-3 h-20 w-20 rounded-full ring-2 ring-gray-700"
            />
          ) : (
            <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gray-700 text-2xl font-medium text-gray-300">
              {user.displayName?.charAt(0) ?? '?'}
            </div>
          )}
          <h2 className="text-lg font-semibold text-white">{user.displayName}</h2>
          <p className="text-sm text-gray-400">{user.email}</p>
        </div>

        <dl className="space-y-4">
          <div className="flex justify-between border-b border-gray-800 pb-2">
            <dt className="text-sm text-gray-400">User ID</dt>
            <dd className="text-sm font-mono text-gray-300">{user.uid.slice(0, 12)}...</dd>
          </div>
          <div className="flex justify-between border-b border-gray-800 pb-2">
            <dt className="text-sm text-gray-400">Email verified</dt>
            <dd className="text-sm text-gray-300">Yes (Google)</dd>
          </div>
        </dl>

        <button
          onClick={signOut}
          className="mt-6 w-full cursor-pointer rounded-lg bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
