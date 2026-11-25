import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const navLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/players', label: 'Players' },
  { to: '/friends', label: 'Friends' },
  { to: '/messages', label: 'Messages' },
  { to: '/profile', label: 'Profile' },
]

export function Layout() {
  const { user, signOut } = useAuth()
  if (!user) return null
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <header className="border-b border-gray-800">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-green-400">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20 text-sm font-bold text-green-400">
              CV
            </span>
            CricketVerse
          </Link>

          <nav className="hidden items-center gap-6 sm:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-medium transition-colors ${
                  location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to))
                    ? 'text-green-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <NotificationBell />
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? ''}
                className="h-8 w-8 rounded-full ring-2 ring-gray-700"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-medium text-gray-300">
                {user.displayName?.charAt(0) ?? '?'}
              </div>
            )}
            <button
              onClick={signOut}
              className="cursor-pointer rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex border-t border-gray-800 px-4 py-2 sm:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
                className={`flex-1 text-center text-sm font-medium transition-colors ${
                  location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to))
                    ? 'text-green-400'
                    : 'text-gray-400 hover:text-white'
                }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
