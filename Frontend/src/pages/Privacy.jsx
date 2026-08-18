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
 * The Kinyarwanda text is a translation of the English, which is the version
 * that governs. Readers are told so at the foot of the page whenever they are
 * not reading the English.
 */
export function Privacy() {
    const { t, i18n } = useTranslation()

    return (
        <PublicLayout
            title={t('privacy.title')}
            subtitle={t('privacy.subtitle')}
        >
            <div className="pub-prose">
                <p className="pub-updated">{t('privacy.intro')}</p>

                <h2>{t('privacy.holdsTitle')}</h2>
                <p>{t('privacy.holdsBody')}</p>

                <h2>{t('privacy.isolationTitle')}</h2>
                <p>{t('privacy.isolationBody')}</p>

                <h2>{t('privacy.accessTitle')}</h2>
                <ul>
                    <li>{t('privacy.accessTeachers')}</li>
                    <li>{t('privacy.accessDos')}</li>
                    <li>{t('privacy.accessMatron')}</li>
                    <li>{t('privacy.accessDis')}</li>
                    <li>{t('privacy.accessParents')}</li>
                    <li>{t('privacy.accessPupils')}</li>
                </ul>
                <p>{t('privacy.accessNote')}</p>

                <h2>{t('privacy.notCollectTitle')}</h2>
                <p>{t('privacy.notCollectBody')}</p>
                <p>{t('privacy.notSell')}</p>

                <h2>{t('privacy.protectedTitle')}</h2>
                <ul>
                    <li>{t('privacy.protectTls')}</li>
                    <li>{t('privacy.protectHash')}</li>
                    <li>{t('privacy.protectTwoFactor')}</li>
                    <li>{t('privacy.protectThrottle')}</li>
                    <li>{t('privacy.protectBackup')}</li>
                </ul>

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

                <p className="pub-updated">{t('privacy.closing')}</p>

                {i18n.language !== 'en' && (
                    <p className="pub-updated">{t('privacy.translationNotice')}</p>
                )}
            </div>
        </PublicLayout>
    )
}
