import { Link } from 'react-router'

export function NotFound() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '1rem',
            textAlign: 'center',
        }}>
            <span className="material-symbols-rounded" style={{ fontSize: '4rem', color: 'var(--muted)' }}>
                search_off
            </span>
            <h1 style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--foreground)' }}>404</h1>
            <p style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>
                The page you are looking for does not exist.
            </p>
            <Link to="/" className="btn btn-primary">
                Go to Home
            </Link>
        </div>
    )
}
