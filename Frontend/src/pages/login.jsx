import '../styles/login.css'
import logo from '../assets/images/imboni-logo.png'

const roles = [
    'Student', 'Teacher', 'Parent', 'Director of Studies', 'Discipline', 'Matron',
]

const stats = [
    { value: '980+',  label: 'Boarders'  },
    { value: '48+',   label: 'Teachers'  },
    { value: '6',     label: 'Portals'   },
    { value: '4',     label: 'Houses'    },
]

export function LogIn() {
    return (
        <div className="login-page">

            {/* ── Left panel — branding ── */}
            <div className="login-left">
                <div className="orb-accent"></div>
                <div className="login-left-grid"></div>

                <div className="login-left-content">
                    <div className="login-logo-wrap">
                        <img src={logo} alt="Imboni Logo" />
                    </div>

                    <h2>
                        Imboni<br />
                        <span>Education Connects</span>
                    </h2>

                    <p>
                        One unified platform for students, teachers, parents,
                        and boarding staff — keeping every part of school life
                        connected and running smoothly.
                    </p>

                    <div className="left-divider"></div>

                    <div className="login-left-roles">
                        {roles.map(role => (
                            <span key={role} className="role-pill">{role}</span>
                        ))}
                    </div>

                    <div className="left-stats">
                        {stats.map(s => (
                            <div key={s.label} className="left-stat-item">
                                <div className="left-stat-value">{s.value}</div>
                                <div className="left-stat-label">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Right panel — form ── */}
            <div className="login-right">

                {/* Mobile logo — hidden on desktop */}
                <div className="login-right-logo">
                    <img src={logo} alt="Imboni Logo" />
                </div>

                <div className="login-welcome">
                    <div className="login-welcome-icon">
                        <span className="material-symbols-rounded">school</span>
                    </div>
                    <div>
                        <h1 className="login-heading">Welcome back</h1>
                    </div>
                </div>

                <p className="login-subheading">
                    Sign in with your school-issued credentials to access your portal.
                </p>

                {/* Error banner — hidden by default */}
                <div className="login-error" id="login-error">
                    Invalid email or password. Please try again.
                </div>

                <form className="login-form" onSubmit={e => e.preventDefault()}>

                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email address</label>
                        <div className="input-wrap">
                            <span className="input-icon material-symbols-rounded">mail</span>
                            <input
                                className="form-input"
                                type="email"
                                id="email"
                                name="email"
                                placeholder="you@imboni.edu"
                                autoComplete="email"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Password</label>
                        <div className="input-wrap">
                            <span className="input-icon material-symbols-rounded">lock</span>
                            <input
                                className="form-input"
                                type="password"
                                id="password"
                                name="password"
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                required
                            />
                            <button type="button" className="pw-toggle" aria-label="Toggle password visibility">
                                <span className="material-symbols-rounded">visibility</span>
                            </button>
                        </div>
                    </div>

                    <div className="form-options">
                        <label className="remember-label">
                            <input type="checkbox" name="remember" />
                            Remember me
                        </label>
                        <a href="#" className="forgot-link">Forgot password?</a>
                    </div>

                    <button type="submit" className="login-btn">
                        <span className="btn-spinner" id="btn-spinner"></span>
                        Sign in
                    </button>

                </form>

                <div className="form-divider">or</div>

                <div className="login-help">
                    <div className="login-help-icon">
                        <span className="material-symbols-rounded">support_agent</span>
                    </div>
                    <div>
                        <strong>Need help?</strong> Contact the school office at{' '}
                        <strong>admin@imboni.edu</strong> or extension <strong>100</strong>.
                    </div>
                </div>

                <div className="login-footer">
                    Imboni Education Connects &copy; {new Date().getFullYear()} &mdash;{' '}
                    <a href="#">Privacy Policy</a>
                </div>

            </div>
        </div>
    )
}
