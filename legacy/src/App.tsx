import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { AchievementProvider } from '@/context/AchievementContext'
import { AchievementToast } from '@/components/achievements/AchievementToast'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import { NotificationProvider } from '@/context/NotificationContext'
import { AdminProtectedRoute } from '@/components/admin/AdminProtectedRoute'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Profile = lazy(() => import('@/pages/Profile').then(m => ({ default: m.Profile })))
const CreateTournament = lazy(() => import('@/pages/tournaments/CreateTournament').then(m => ({ default: m.CreateTournament })))
const JoinTournament = lazy(() => import('@/pages/tournaments/JoinTournament').then(m => ({ default: m.JoinTournament })))
const TournamentList = lazy(() => import('@/pages/tournaments/TournamentList').then(m => ({ default: m.TournamentList })))
const TournamentDetail = lazy(() => import('@/pages/tournaments/TournamentDetail').then(m => ({ default: m.TournamentDetail })))
const EditTeam = lazy(() => import('@/pages/teams/EditTeam').then(m => ({ default: m.EditTeam })))
const AuctionSetup = lazy(() => import('@/pages/tournaments/AuctionSetup').then(m => ({ default: m.AuctionSetup })))
const AuctionRoom = lazy(() => import('@/pages/tournaments/AuctionRoom').then(m => ({ default: m.AuctionRoom })))
const PlayerList = lazy(() => import('@/pages/players/PlayerList').then(m => ({ default: m.PlayerList })))
const CreatePlayer = lazy(() => import('@/pages/players/CreatePlayer').then(m => ({ default: m.CreatePlayer })))
const EditPlayer = lazy(() => import('@/pages/players/EditPlayer').then(m => ({ default: m.EditPlayer })))
const PlayerProgressionPage = lazy(() => import('@/pages/players/PlayerProgressionPage').then(m => ({ default: m.PlayerProgressionPage })))
const AchievementsPage = lazy(() => import('@/pages/players/AchievementsPage').then(m => ({ default: m.AchievementsPage })))
const Friends = lazy(() => import('@/pages/Friends').then(m => ({ default: m.Friends })))
const TournamentChat = lazy(() => import('@/pages/chat/TournamentChat').then(m => ({ default: m.TournamentChat })))
const TeamChat = lazy(() => import('@/pages/chat/TeamChat').then(m => ({ default: m.TeamChat })))
const Messages = lazy(() => import('@/pages/chat/Messages').then(m => ({ default: m.Messages })))
const PrivateChat = lazy(() => import('@/pages/chat/PrivateChat').then(m => ({ default: m.PrivateChat })))
const MatchSetupPage = lazy(() => import('@/pages/match/MatchSetupPage').then(m => ({ default: m.MatchSetupPage })))
const MatchDetailPage = lazy(() => import('@/pages/matches/MatchDetailPage').then(m => ({ default: m.MatchDetailPage })))
const RankingsPage = lazy(() => import('@/pages/rankings/RankingsPage').then(m => ({ default: m.RankingsPage })))
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))
const GameLobby = lazy(() => import('@/pages/game/GameLobby').then(m => ({ default: m.GameLobby })))
const GameLobby2v2 = lazy(() => import('@/pages/game/GameLobby2v2').then(m => ({ default: m.GameLobby2v2 })))
const GamePage = lazy(() => import('@/pages/game/GamePage').then(m => ({ default: m.GamePage })))
const GamePage2v2 = lazy(() => import('@/pages/game/GamePage2v2').then(m => ({ default: m.GamePage2v2 })))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
        <AchievementProvider>
          <AchievementToast />
          <Suspense fallback={<LoadingSpinner />}>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="friends" element={<Friends />} />
              <Route path="messages" element={<Messages />} />
              <Route path="messages/:userId" element={<PrivateChat />} />
              <Route path="tournaments" element={<TournamentList />} />
              <Route path="tournaments/new" element={<CreateTournament />} />
              <Route path="tournaments/join" element={<JoinTournament />} />
              <Route path="tournaments/:id" element={<TournamentDetail />} />
              <Route path="tournaments/:id/chat" element={<TournamentChat />} />
              <Route path="tournaments/:id/team/edit" element={<EditTeam />} />
              <Route path="tournaments/:id/auction/setup" element={<AuctionSetup />} />
              <Route path="tournaments/:id/auction/room" element={<AuctionRoom />} />
              <Route path="tournaments/:tournamentId/matches/:matchId" element={<MatchDetailPage />} />
              <Route path="players" element={<PlayerList />} />
              <Route path="players/new" element={<CreatePlayer />} />
              <Route path="players/:id/progression" element={<PlayerProgressionPage />} />
              <Route path="players/:id/achievements" element={<AchievementsPage />} />
              <Route path="players/:id/edit" element={<EditPlayer />} />
              <Route path="tournaments/:tournamentId/team/:teamId/chat" element={<TeamChat />} />
              <Route path="match/setup" element={<MatchSetupPage />} />
              <Route path="game/lobby" element={<GameLobby />} />
              <Route path="game/lobby/2v2" element={<GameLobby2v2 />} />
              <Route path="game/:sessionId" element={<GamePage />} />
              <Route path="game/2v2/:sessionId" element={<GamePage2v2 />} />
              <Route path="rankings" element={<RankingsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
            </Route>
            <Route element={<AdminProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="admin" element={<AdminDashboard />} />
              </Route>
            </Route>
          </Route>
        </Routes>
        </Suspense>
        </AchievementProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
