import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import '../styles/not-found.css'

export function NotFound() {
    const { t } = useTranslation()
    const navigate = useNavigate()

    return (
        <div className="not-found-page">
            <div className="not-found-content">
                <div className="not-found-icon">
                    <span className="material-symbols-rounded" aria-hidden="true">search</span>
                </div>

                <h1 className="not-found-title">{t('publicPages.notFound.title')}</h1>

                <p className="not-found-subtitle">{t('publicPages.notFound.subtitle')}</p>

                <div className="not-found-actions">
                    <button className="not-found-btn not-found-btn-outline" onClick={() => navigate(-1)}>
                        <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
                        {t('publicPages.notFound.back')}
                    </button>
                    <Link to="/" className="not-found-btn not-found-btn-primary">
                        {t('publicPages.notFound.home')}
                    </Link>
                </div>
            </div>
        </div>
    )
}
