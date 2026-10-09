import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { PublicLayout } from '../components/PublicLayout'

const VALUES = [
    { key: 'children', icon: 'shield_person' },
    { key: 'offline', icon: 'signal_disconnected' },
    { key: 'time', icon: 'schedule' },
    { key: 'separate', icon: 'lock' },
]

export function About() {
    const { t } = useTranslation()
    return (
        <PublicLayout title={t('publicPages.about.title')} subtitle={t('publicPages.about.subtitle')}>
            <div className="pub-prose">
                <h2>{t('publicPages.about.whyTitle')}</h2>
                <p>{t('publicPages.about.why1')}</p>
                <p>{t('publicPages.about.why2')}</p>

                <h2>{t('publicPages.about.differentTitle')}</h2>
                <p>{t('publicPages.about.different')}</p>
            </div>

            <div className="pub-values">
                {VALUES.map(value => (
                    <div className="pub-value" key={value.key}>
                        <span className="material-symbols-rounded" aria-hidden="true">
                            {value.icon}
                        </span>
                        <h3>{t(`publicPages.about.values.${value.key}.title`)}</h3>
                        <p>{t(`publicPages.about.values.${value.key}.body`)}</p>
                    </div>
                ))}
            </div>

            <div className="pub-prose">
                <h2>{t('publicPages.about.whereTitle')}</h2>
                <p>{t('publicPages.about.where')}</p>

                <h2>{t('publicPages.about.talkTitle')}</h2>
                <p>
                    <Trans i18nKey="publicPages.about.talk"
                        components={{ contact: <Link to="/contact" />, pricing: <Link to="/pricing" /> }} />
                </p>
            </div>
        </PublicLayout>
    )
}
