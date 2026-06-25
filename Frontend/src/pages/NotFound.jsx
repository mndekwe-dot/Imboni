import { Link, useNavigate } from 'react-router'
import '../styles/not-found.css'

export function NotFound() {
    const navigate = useNavigate()

    return (
        <div className="not-found-page">
            <div className="not-found-grid" />

            <div className="not-found-content">
                <div className="not-found-icon">
                    <span className="material-symbols-rounded">search</span>
                </div>

                <h1 className="not-found-title">Page not found</h1>

                <p className="not-found-subtitle">
                    The page you are looking for doesn&apos;t exist.<br />
                    Here are some helpful links:
                </p>

                <div className="not-found-actions">
                    <button className="not-found-btn not-found-btn-outline" onClick={() => navigate(-1)}>
                        <span className="material-symbols-rounded">arrow_back</span>
                        Go back
                    </button>
                    <Link to="/" className="not-found-btn not-found-btn-primary">
                        Take me home
                    </Link>
                </div>
            </div>
        </div>
    )
}
