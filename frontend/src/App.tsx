import { useEffect, useState } from 'react'
import './App.css'
import LoginPage from './app/login_page'
import SignupPage from './app/signup_page'
import TrackingDashboard from './app/tracking_dashboard'

function App() {
  const [page, setPage] = useState<'login' | 'signup' | 'dashboard'>('login')
  const [email, setEmail] = useState('')
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    let active = true
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
    const sessionUrl = apiBaseUrl
      ? `${apiBaseUrl.replace(/\/$/, '')}/session`
      : '/api/session'

    void fetch(sessionUrl, { credentials: 'include' })
      .then(async (response) => {
        const result = (await response.json()) as { email?: string; detail?: string }
        if (!response.ok) {
          if (response.status !== 401) {
            throw new Error(result.detail || 'Could not restore your session.')
          }
          return
        }
        if (!result.email) throw new Error('The session response did not include an email.')
        if (active) {
          setEmail(result.email)
          setPage('dashboard')
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSessionError(
            error instanceof Error ? error.message : 'Could not restore your session.',
          )
        }
      })
      .finally(() => {
        if (active) setIsCheckingSession(false)
      })

    return () => {
      active = false
    }
  }, [])

  function handleLogin(userEmail: string) {
    setEmail(userEmail)
    setSessionError('')
    setPage('dashboard')
  }

  async function handleLogout() {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
    const logoutUrl = apiBaseUrl
      ? `${apiBaseUrl.replace(/\/$/, '')}/logout`
      : '/api/logout'
    try {
      const response = await fetch(logoutUrl, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Could not sign out. Please try again.')
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : 'Could not sign out. Please try again.',
      )
      return
    }
    setPage('login')
  }

  if (isCheckingSession) {
    return <main className="session-loading" aria-label="Restoring your session"><span /></main>
  }

  if (page === 'dashboard') {
    return <TrackingDashboard email={email} onLogout={handleLogout} />
  }

  if (page === 'signup') {
    return <SignupPage onSignIn={() => setPage('login')} />
  }

  return (
    <>
      {sessionError && <p className="session-error" role="alert">{sessionError}</p>}
      <LoginPage onLogin={handleLogin} onSignUp={() => setPage('signup')} />
    </>
  )
}

export default App
