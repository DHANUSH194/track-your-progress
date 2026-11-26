import { useState, type FormEvent } from 'react'

type SignupResponse = {
  detail?: string
}

type SignupPageProps = {
  onSignIn: () => void
}

function SignupPage({ onSignIn }: SignupPageProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')

    if (password.length < 8) {
      setFeedback('Your password must be at least 8 characters long.')
      return
    }

    setIsSubmitting(true)

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      const signupUrl = apiBaseUrl
        ? `${apiBaseUrl.replace(/\/$/, '')}/signup`
        : '/api/signup'
      const response = await fetch(signupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      })
      const result = (await response.json()) as SignupResponse

      if (!response.ok) {
        throw new Error(result.detail || 'We could not create your account. Please try again.')
      }

      setIsSuccess(true)
      setFeedback('Your account is ready. Let’s get moving!')
    } catch (error) {
      setIsSuccess(false)
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
      <section className="signup-panel" aria-labelledby="signup-title">
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
          <h1 id="signup-title">Make every rep<br />count.</h1>
          <p className="form-intro">
            Create your free account and start building a fitness routine that sticks.
          </p>

          <form className="signup-form" onSubmit={handleSubmit}>
            <label htmlFor="full-name">Full name</label>
            <input
              autoComplete="name"
              id="full-name"
              name="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              required
              type="text"
              value={name}
            />

            <label htmlFor="email">Email address</label>
            <input
              autoComplete="email"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />

            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                autoComplete="new-password"
                id="password"
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
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

            <p className="password-hint">Use at least 8 characters.</p>
            <button className="submit-button" disabled={isSubmitting || isSuccess} type="submit">
              {isSubmitting ? 'Creating your account…' : isSuccess ? 'Account created' : 'Create account'}
              {!isSubmitting && !isSuccess && <span aria-hidden="true">→</span>}
            </button>

            {feedback && (
              <p className={`form-feedback ${isSuccess ? 'success' : 'error'}`} role="status">
                {feedback}
              </p>
            )}
          </form>

          <p className="signin-note">
            Already tracking your progress?{' '}
            <a
              href="#signin"
              onClick={(event) => {
                event.preventDefault()
                onSignIn()
              }}
            >
              Sign in
            </a>
          </p>
          <p className="terms-note">
            By creating an account, you agree to our <a href="#terms">Terms</a> and{' '}
            <a href="#privacy">Privacy Policy</a>.
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

export default SignupPage