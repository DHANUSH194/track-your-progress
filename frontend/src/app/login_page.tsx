import { useState, type FormEvent } from 'react'

type LoginResponse = {
  email?: string
  detail?: string
}

type LoginPageProps = {
  onLogin: (email: string) => void
  onSignUp: () => void
}

function LoginPage({ onLogin, onSignUp }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    setIsSubmitting(true)

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      const loginUrl = apiBaseUrl
        ? `${apiBaseUrl.replace(/\/$/, '')}/login`
        : '/api/login'
      const response = await fetch(loginUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const result = (await response.json()) as LoginResponse

      if (!response.ok || !result.email) {
        throw new Error(result.detail || 'We could not sign you in. Check your username and password.')
      }

      onLogin(result.email)
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="signup-shell">
      <section className="signup-panel" aria-labelledby="login-title">
        <a className="brand" href="/" aria-label="Repwise home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M5 11h4v10H5zM23 11h4v10h-4zM10 14h12v4H10z" fill="currentColor" />
              <path d="M3 13v6M29 13v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>repwise</span>
        </a>

        <div className="form-content">
          <div className="mobile-eyebrow">
            <span className="eyebrow-dot" />
            YOUR STRONGER ROUTINE STARTS HERE
          </div>
          <h1 id="login-title">Welcome<br />back.</h1>
          <p className="form-intro">
            Sign in to pick up where you left off and keep your progress moving.
          </p>

          <form className="signup-form" onSubmit={handleSubmit}>
            <label htmlFor="login-username">User name</label>
            <input
              autoComplete="username"
              id="login-username"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="The name you used when signing up"
              required
              type="text"
              value={username}
            />

            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input
                autoComplete="current-password"
                id="login-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <button className="submit-button login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Signing in…' : 'Sign in'}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>

            {feedback && (
              <p className="form-feedback error" role="alert">
                {feedback}
              </p>
            )}
          </form>

          <p className="signin-note">
            New to Repwise?{' '}
            <a
              href="#signup"
              onClick={(event) => {
                event.preventDefault()
                onSignUp()
              }}
            >
              Create an account
            </a>
          </p>
        </div>

        <p className="copyright">© 2026 Repwise. Progress, one rep at a time.</p>
      </section>

      <aside className="visual-panel" aria-label="Track your training progress">
        <div className="visual-grain" />
        <div className="visual-topline">
          <span className="eyebrow-dot" />
          BUILT FOR YOUR NEXT PERSONAL BEST
        </div>

        <div className="visual-copy">
          <p className="visual-kicker">SHOW UP. GET STRONGER.</p>
          <h2>Your progress<br />has a rhythm.</h2>
          <p className="visual-description">
            Log your lifts, celebrate the little wins, and see just how far you’ve come.
          </p>
        </div>

        <div className="progress-card">
          <div className="card-header">
            <div>
              <p className="card-label">THIS WEEK</p>
              <p className="card-title">You’re on a roll</p>
            </div>
            <span className="streak-badge">
              <span aria-hidden="true">↗</span> 12%
            </span>
          </div>
          <div className="chart" aria-label="Workout progress has increased throughout the week">
            <div className="chart-grid" />
            <svg className="chart-line" viewBox="0 0 440 120" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#b6f26e" stopOpacity=".24" />
                  <stop offset="100%" stopColor="#b6f26e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 94 C25 88 34 71 64 77 S102 90 132 64 S171 78 198 55 S239 65 264 40 S304 57 330 34 S367 46 391 19 S422 24 440 10 V120 H0 Z" fill="url(#chartFill)" />
              <path d="M0 94 C25 88 34 71 64 77 S102 90 132 64 S171 78 198 55 S239 65 264 40 S304 57 330 34 S367 46 391 19 S422 24 440 10" fill="none" stroke="#b6f26e" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              <circle cx="440" cy="10" r="5" fill="#b6f26e" />
            </svg>
          </div>
          <div className="chart-days" aria-hidden="true">
            <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
          </div>
          <div className="workout-stats">
            <div className="stat">
              <span className="stat-icon dumbbell-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M3 9v6M6 6v12M9 10v4M15 10v4M18 6v12M21 9v6M6 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span><strong>4 workouts</strong><small>this week</small></span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-icon flame-icon" aria-hidden="true">↗</span>
              <span><strong>3 week streak</strong><small>keep it going</small></span>
            </div>
          </div>
        </div>

        <div className="visual-footer">
          <div className="avatar-stack" aria-hidden="true">
            <span>J</span><span>M</span><span>A</span><span>+</span>
          </div>
          <p>Small wins add up. <strong>Keep showing up.</strong></p>
        </div>
      </aside>
    </main>
  )
}

export default LoginPage
