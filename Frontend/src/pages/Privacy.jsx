import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '../components/PublicLayout'

/**
 * Imboni's own data-handling statement.
 *
 * NOT the same document as PRIVACY_POLICY.md in the repository root. That one
 * is a template each SCHOOL adopts and publishes to its own parents, because
 * the school is the data controller. This page describes what Imboni, as the
 * processor running the software, does with the data on the school's behalf.
 *
 * Every claim here maps to something implemented:
 *   schema isolation      django-tenants, one Postgres schema per school
 *   no PII in monitoring  settings.py -> sentry_sdk.init(send_default_pii=False)
 *   password hashing      Django's default hasher
 *   throttling            REST_FRAMEWORK DEFAULT_THROTTLE_RATES
 *   audit log             apps/audit
 *   backups               apps/audit/tasks.backup_database_task (nightly)
 *   erasure               manage.py erase_user_data
 * Do not add a claim here that is not true of the running system.
 *
 * Laid out like the other public pages: a short summary of the four things a
 * parent most wants to know, as cards, then the detail underneath.
 *
 * The Kinyarwanda text is a translation of the English, which is the version
 * that governs. Readers are told so at the foot of the page whenever they are
 * not reading the English.
 */
const GLANCE = [
    { key: 'separate', icon: 'lock' },
    { key: 'roles', icon: 'admin_panel_settings' },
    { key: 'nothing', icon: 'visibility_off' },
    { key: 'protected', icon: 'backup' },
]

const ACCESS = ['accessTeachers', 'accessDos', 'accessMatron', 'accessDis', 'accessParents', 'accessPupils']
const PROTECTED = ['protectTls', 'protectHash', 'protectTwoFactor', 'protectThrottle', 'protectBackup']

function Checks({ keys }) {
    const { t } = useTranslation()
    return (
        <ul className="pub-checks">
            {keys.map(key => (
                <li key={key}>
                    <span className="material-symbols-rounded" aria-hidden="true">task_alt</span>
                    <span>{t(`privacy.${key}`)}</span>
                </li>
            ))}
        </ul>
    )
}

export function Privacy() {
    const { t, i18n } = useTranslation()

    return (
        <PublicLayout
            title={t('privacy.title')}
            subtitle={t('privacy.subtitle')}
        >
            <div className="pub-prose">
                <p className="pub-lead">{t('privacy.intro')}</p>
            </div>

            <div className="pub-prose">
                <h2>{t('privacy.glanceTitle')}</h2>
            </div>
            <div className="pub-values pub-values-2">
                {GLANCE.map(item => (
                    <div className="pub-value" key={item.key}>
                        <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
                        <h3>{t(`privacy.glance.${item.key}.title`)}</h3>
                        <p>{t(`privacy.glance.${item.key}.body`)}</p>
                    </div>
                ))}
            </div>

            <div className="pub-prose">
                <h2>{t('privacy.holdsTitle')}</h2>
                <p>{t('privacy.holdsBody')}</p>

                <h2>{t('privacy.isolationTitle')}</h2>
                <p>{t('privacy.isolationBody')}</p>

                <h2>{t('privacy.accessTitle')}</h2>
                <Checks keys={ACCESS} />
                <p>{t('privacy.accessNote')}</p>

                <h2>{t('privacy.notCollectTitle')}</h2>
                <p>{t('privacy.notCollectBody')}</p>
                <p>{t('privacy.notSell')}</p>

                <h2>{t('privacy.protectedTitle')}</h2>
                <Checks keys={PROTECTED} />

                <h2>{t('privacy.childrenTitle')}</h2>
                <p>{t('privacy.childrenBody')}</p>

                <h2>{t('privacy.retentionTitle')}</h2>
                <p>{t('privacy.retentionBody')}</p>

                <h2>{t('privacy.rightsTitle')}</h2>
                <p>
                    {t('privacy.rightsBody')}{' '}
                    <Link to="/contact">{t('privacy.rightsContactLink')}</Link>{' '}
                    {t('privacy.rightsBodyEnd')}
                </p>

                <h2>{t('privacy.changesTitle')}</h2>
                <p>{t('privacy.changesBody')}</p>

                <p className="pub-note">{t('privacy.closing')}</p>

                {i18n.language !== 'en' && (
                    <p className="pub-note">{t('privacy.translationNotice')}</p>
                )}
            </div>
        </PublicLayout>
    )
}
