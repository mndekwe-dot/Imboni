import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SearchBar } from '../../components/ui/SearchBar'
import { FilterBar } from '../../components/ui/FilterBar'
import { ListSection } from '../../components/ui/ListSection'
import { ScanInput } from '../../components/ui/ScanInput'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { StatCard } from '../../components/layout/StatCard'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { downloadCsv } from '../../utils/exportTable'
import {
    addCopy, catalogueByScan, createBook, deleteBook, getBook, getBooks,
} from '../../api/library'
import { printPdf } from '../../api/documents'
import { LibraryShell } from './LibraryShell'

const CATEGORIES = ['all', 'textbook', 'fiction', 'nonfiction', 'reference', 'periodical', 'other']

const EMPTY_BOOK = {
    title: '', author: '', isbn: '', publisher: '', published_year: '',
    category: 'other', language: '', subject: '', shelf: '',
}

/** What the school owns: titles, and the copies of each. */
export function LibraryCatalogue() {
    const { t } = useTranslation()
    const toast = useToast()

    const [books, setBooks]     = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch]   = useState('')
    const [category, setCategory] = useState('all')
    const [showNew, setShowNew] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [openBook, setOpenBook] = useState(null)

    const load = useCallback(() => {
        setLoading(true)
        getBooks()
            .then(data => setBooks(Array.isArray(data) ? data : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    /* Filtered here rather than refetched per keystroke: the catalogue is a few
       hundred rows, and a request per character makes the list flicker while
       the shelf count it is showing is already correct. */
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        return books.filter(b =>
            (category === 'all' || b.category === category)
            && (!q
                || (b.title || '').toLowerCase().includes(q)
                || (b.author || '').toLowerCase().includes(q)
                || (b.isbn || '').toLowerCase().includes(q)
                || (b.subject || '').toLowerCase().includes(q)))
    }, [books, search, category])

    const totals = useMemo(() => ({
        titles: books.length,
        copies: books.reduce((n, b) => n + (b.total_copies || 0), 0),
        available: books.reduce((n, b) => n + (b.available_copies || 0), 0),
    }), [books])

    async function handleCreate(form) {
        try {
            const created = await createBook({
                ...form,
                published_year: form.published_year || null,
            })
            setBooks(prev => [created, ...prev])
            setShowNew(false)
            toast.success(t('library.catalogue.added', { title: created.title }))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    async function handleDelete(book) {
        try {
            await deleteBook(book.id)
            setBooks(prev => prev.filter(b => b.id !== book.id))
            setOpenBook(null)
            toast.success(t('common.deleted'))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    function handleExport() {
        downloadCsv('library-catalogue', {
            columns: [t('library.fields.title'), t('library.fields.author'), t('library.fields.isbn'),
                t('library.fields.category'), t('library.fields.shelf'),
                t('library.stats.copies'), t('library.fields.available')],
            rows: visible.map(b => [b.title, b.author, b.isbn,
                t(`library.categories.${b.category}`), b.shelf, b.total_copies, b.available_copies]),
        })
    }

    return (
        <LibraryShell title={t('library.catalogue.title')} subtitle={t('library.catalogue.subtitle')}>
            {showNew && (
                <BookForm onClose={() => setShowNew(false)} onSave={handleCreate} />
            )}
            {openBook && (
                <BookDetail
                    bookId={openBook}
                    onClose={() => setOpenBook(null)}
                    onDeleted={handleDelete}
                    onCopyAdded={load}
                />
            )}

            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="menu_book" value={loading ? '-' : totals.titles}
                    label={t('library.stats.titles')} colorClass="info" />
                <StatCard icon="inventory_2" value={loading ? '-' : totals.copies}
                    label={t('library.stats.copies')} />
                <StatCard icon="check_circle" value={loading ? '-' : totals.available}
                    label={t('library.stats.onShelf')} colorClass="success" />
            </div>

            {scanning && (
                <ScanToAddModal onClose={() => setScanning(false)} onAdded={load} />
            )}

            <div className="toolbar-card mb-1-5">
                <SearchBar value={search} onChange={setSearch}
                    placeholder={t('library.catalogue.searchPlaceholder')} />
                <div className="toolbar-spacer" />
                <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={!visible.length}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">download</span>
                    {t('common.export')}
                </button>
                {/* Ahead of "Add book", because for a school with three
                    thousand books this is the entry path and typing is the
                    exception. */}
                <button className="btn btn-outline btn-sm" onClick={() => setScanning(true)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">barcode_scanner</span>
                    {t('library.entry.scanToAdd')}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                    {t('library.catalogue.addBook')}
                </button>
            </div>

            <div className="toolbar-card mb-1-5">
                <FilterBar
                    options={CATEGORIES.map(key => ({ key, label: t(`library.categories.${key}`) }))}
                    active={category}
                    onChange={setCategory}
                />
            </div>

            <ListSection
                icon="menu_book"
                title={t(`library.categories.${category}`)}
                count={loading ? null : t('library.titleCount', { count: visible.length })}
            >
                {loading ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : visible.length === 0 ? (
                    <EmptyState
                        icon={search ? 'search_off' : 'menu_book'}
                        title={search ? t('common.noResults', { query: search }) : t('library.catalogue.empty')}
                        description={search ? t('common.trySearch') : t('library.catalogue.emptyDesc')}
                        action={search
                            ? { label: t('common.clear'), icon: 'close', onClick: () => setSearch('') }
                            : { label: t('library.catalogue.addBook'), icon: 'add', onClick: () => setShowNew(true) }}
                    />
                ) : (
                    <div className="lib-book-grid">
                        {visible.map(book => (
                            <BookCard key={book.id} book={book} onOpen={() => setOpenBook(book.id)} />
                        ))}
                    </div>
                )}
            </ListSection>
        </LibraryShell>
    )
}

function BookCard({ book, onOpen }) {
    const { t } = useTranslation()
    const out = (book.total_copies || 0) - (book.available_copies || 0)

    return (
        <article className="lib-book-card">
            <button className="lib-book-open" onClick={onOpen}>
                <span className="lib-book-spine" aria-hidden="true">
                    <span className="material-symbols-rounded">menu_book</span>
                </span>
                <span className="lib-book-body">
                    <span className="lib-book-title">{book.title}</span>
                    <span className="lib-book-author">{book.author || t('library.fields.unknownAuthor')}</span>
                    <span className="lib-book-meta">
                        <span className="badge">{t(`library.categories.${book.category}`)}</span>
                        {book.shelf && <span className="text-xs-muted">{book.shelf}</span>}
                    </span>
                </span>
            </button>
            <div className="lib-book-stock">
                {/* Available is the number a librarian is asked for at the desk,
                    so it leads; total is the context, not the answer. */}
                <span className={book.available_copies ? 'lib-stock-ok' : 'lib-stock-none'}>
                    {t('library.availableOf', {
                        available: book.available_copies, total: book.total_copies,
                    })}
                </span>
                {out > 0 && <span className="text-xs-muted">{t('library.outCount', { count: out })}</span>}
                {book.reservations_waiting > 0 && (
                    <span className="badge badge-high">
                        {t('library.waitingCount', { count: book.reservations_waiting })}
                    </span>
                )}
            </div>
        </article>
    )
}

function BookForm({ onClose, onSave }) {
    const { t } = useTranslation()
    const [form, setForm] = useState(EMPTY_BOOK)
    const [error, setError] = useState(null)
    const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

    function submit() {
        if (!form.title.trim()) {
            setError(t('library.catalogue.titleRequired'))
            return
        }
        onSave({ ...form, title: form.title.trim() })
    }

    return (
        <Modal
            title={t('library.catalogue.addBook')}
            icon="library_add"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={submit}>{t('common.save')}</button>
                </>
            }
        >
            <div className="lib-form-grid">
                <div className="lib-col-full">
                    <label className="form-label" htmlFor="bk-title">{t('library.fields.title')}</label>
                    <input id="bk-title" className="form-input" value={form.title}
                        onChange={e => set('title', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="bk-author">{t('library.fields.author')}</label>
                    <input id="bk-author" className="form-input" value={form.author}
                        onChange={e => set('author', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="bk-isbn">{t('library.fields.isbn')}</label>
                    <input id="bk-isbn" className="form-input" value={form.isbn}
                        onChange={e => set('isbn', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="bk-category">{t('library.fields.category')}</label>
                    <select id="bk-category" className="form-select" value={form.category}
                        onChange={e => set('category', e.target.value)}>
                        {CATEGORIES.filter(c => c !== 'all').map(c => (
                            <option key={c} value={c}>{t(`library.categories.${c}`)}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="form-label" htmlFor="bk-shelf">{t('library.fields.shelf')}</label>
                    <input id="bk-shelf" className="form-input" value={form.shelf}
                        onChange={e => set('shelf', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="bk-publisher">{t('library.fields.publisher')}</label>
                    <input id="bk-publisher" className="form-input" value={form.publisher}
                        onChange={e => set('publisher', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="bk-year">{t('library.fields.year')}</label>
                    <input id="bk-year" type="number" className="form-input" value={form.published_year}
                        onChange={e => set('published_year', e.target.value)} />
                </div>
            </div>
            {error && <p className="form-error">{error}</p>}
        </Modal>
    )
}

/** One title, its copies, and a way to add another copy. */
function BookDetail({ bookId, onClose, onDeleted, onCopyAdded }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [book, setBook] = useState(null)
    const [code, setCode] = useState('')
    const [confirming, setConfirming] = useState(false)

    const refresh = useCallback(() => {
        getBook(bookId).then(setBook).catch(() => setBook(null))
    }, [bookId])

    useEffect(() => { refresh() }, [refresh])

    async function submitCopy() {
        if (!code.trim()) return
        try {
            await addCopy(bookId, { copy_code: code.trim() })
            setCode('')
            refresh()
            onCopyAdded?.()
            toast.success(t('library.catalogue.copyAdded'))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    return (
        <Modal
            title={book?.title || t('common.loading')}
            icon="menu_book"
            size="wide"
            onClose={onClose}
            footer={
                confirming ? (
                    <>
                        <span className="remove-confirm-text">{t('library.catalogue.deleteConfirm')}</span>
                        <button className="btn btn-outline" onClick={() => setConfirming(false)}>
                            {t('common.no')}
                        </button>
                        <button className="btn btn-primary" onClick={() => onDeleted(book)}>
                            {t('common.yes')}
                        </button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-outline" onClick={() => setConfirming(true)}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">delete</span>
                            {t('common.delete')}
                        </button>
                        <button className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>
                    </>
                )
            }
        >
            {!book ? <p className="u-muted">{t('common.loading')}</p> : (
                <>
                    <dl className="lib-detail-grid">
                        <div><dt>{t('library.fields.author')}</dt><dd>{book.author || '-'}</dd></div>
                        <div><dt>{t('library.fields.isbn')}</dt><dd>{book.isbn || '-'}</dd></div>
                        <div><dt>{t('library.fields.publisher')}</dt><dd>{book.publisher || '-'}</dd></div>
                        <div><dt>{t('library.fields.year')}</dt><dd>{book.published_year || '-'}</dd></div>
                        <div><dt>{t('library.fields.shelf')}</dt><dd>{book.shelf || '-'}</dd></div>
                        <div>
                            <dt>{t('library.fields.category')}</dt>
                            <dd>{t(`library.categories.${book.category}`)}</dd>
                        </div>
                    </dl>

                    <h3 className="card-title mt-1-5">
                        <span className="material-symbols-rounded" aria-hidden="true">inventory_2</span>
                        {t('library.catalogue.copies')}
                    </h3>
                    {book.copies?.length === 0 ? (
                        <p className="u-muted">{t('library.catalogue.noCopies')}</p>
                    ) : (
                        <ul className="lib-copy-list">
                            {book.copies.map(copy => (
                                <li key={copy.id} className="lib-copy-row">
                                    <code className="lib-copy-code">{copy.copy_code}</code>
                                    <span className={`badge lib-status-${copy.status}`}>
                                        {t(`library.copyStatus.${copy.status}`)}
                                    </span>
                                    <span className="text-xs-muted">
                                        {t(`library.condition.${copy.condition}`)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="lib-add-copy">
                        <label className="form-label" htmlFor="copy-code">
                            {t('library.catalogue.copyCode')}
                        </label>
                        <div className="lib-add-copy-row">
                            <input id="copy-code" className="form-input" value={code}
                                placeholder={t('library.catalogue.copyCodePlaceholder')}
                                onChange={e => setCode(e.target.value)} />
                            <button className="btn btn-outline btn-sm" onClick={submitCopy} disabled={!code.trim()}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                                {t('library.catalogue.addCopy')}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </Modal>
    )
}

/**
 * Catalogue a book by scanning the barcode already on the back of it.
 *
 * This is the half of the problem a book's own barcode genuinely solves.
 * Cataloguing is where the typing is -- title, author, publisher, year, three
 * thousand times -- and the ISBN is the one thing on the cover a machine can
 * read without a person transcribing it.
 *
 * Scanning the same ISBN again adds COPIES to the title already held; it does
 * not create a second record. A school buys forty of one textbook over four
 * years, and a catalogue with four entries for "Biology for Rwanda S4" cannot
 * answer how many the school owns -- which is the only question it exists for.
 */
function ScanToAddModal({ onClose, onAdded }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [busy, setBusy] = useState(false)
    const [pending, setPending] = useState(null)   // an ISBN we do not hold yet
    const [form, setForm] = useState({ title: '', author: '', shelf: '', copies: '1' })
    const [added, setAdded] = useState([])

    async function send(payload) {
        setBusy(true)
        try {
            const outcome = await catalogueByScan(payload)
            setPending(null)
            setForm({ title: '', author: '', shelf: '', copies: '1' })
            setAdded(rows => [{
                isbn: payload.isbn,
                title: outcome.book.title,
                copies: outcome.copies.length,
                created: outcome.created,
                ids: outcome.copy_ids,
            }, ...rows])
            onAdded?.()
            toast.success(outcome.created
                ? t('library.entry.addedNew', { title: outcome.book.title })
                : t('library.entry.addedCopies', {
                    count: outcome.copies.length, title: outcome.book.title,
                }))
        } catch (error) {
            // 422 is not a failure: the book is real, we simply have never seen
            // it and nothing on a barcode carries a title.
            if (error?.status === 422) setPending(error.data?.isbn || payload.isbn)
            else toast.error(errorMessage(error, t('library.entry.failed')))
        } finally {
            setBusy(false)
        }
    }

    const handleScan = code => send({ isbn: code, copies: Number(form.copies) || 1 })

    // Every copy just added, so the labels printed are exactly the books on the
    // desk -- rather than "all copies of this title", which would reprint
    // labels for the thirty already on the shelf.
    const freshIds = added.flatMap(a => a.ids)

    return (
        <Modal onClose={onClose} title={t('library.entry.scanToAdd')} icon="barcode_scanner"
            size="wide"
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                    {freshIds.length > 0 && (
                        <button className="btn btn-primary"
                            onClick={() => printPdf('/imboni/library/labels/', { copies: freshIds.join(',') })}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">print</span>
                            {t('library.entry.printLabels', { count: freshIds.length })}
                        </button>
                    )}
                </>
            }
        >
            <p className="u-muted u-sm">{t('library.entry.help')}</p>

            <div className="form-grid mb-1-5">
                <div>
                    <label className="form-label" htmlFor="scan-copies">
                        {t('library.entry.howMany')}
                    </label>
                    <input id="scan-copies" type="number" min="1" max="200"
                        className="form-input" value={form.copies}
                        onChange={e => setForm(f => ({ ...f, copies: e.target.value }))} />
                    <p className="text-xs-muted">{t('library.entry.howManyHint')}</p>
                </div>
            </div>

            <ScanInput onScan={handleScan} busy={busy}
                placeholder={t('library.entry.scanPlaceholder')}
                label={t('library.fields.isbn')} />

            {pending && (
                <div className="scan-result scan-result-isbn">
                    <div className="row-main">
                        <div className="u-strong">{t('library.entry.newTitle')}</div>
                        <div className="text-xs-muted">
                            <code className="lib-copy-code">{pending}</code>
                        </div>
                        <div className="form-grid mt-1">
                            <input className="form-input" value={form.title} autoFocus
                                placeholder={t('library.fields.title')}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                            <input className="form-input" value={form.author}
                                placeholder={t('library.fields.author')}
                                onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
                            <input className="form-input" value={form.shelf}
                                placeholder={t('library.fields.shelf')}
                                onChange={e => setForm(f => ({ ...f, shelf: e.target.value }))} />
                        </div>
                    </div>
                    <button className="btn btn-primary btn-sm"
                        disabled={busy || !form.title.trim()}
                        onClick={() => send({
                            isbn: pending, title: form.title, author: form.author,
                            shelf: form.shelf, copies: Number(form.copies) || 1,
                        })}>
                        {t('common.save')}
                    </button>
                </div>
            )}

            {added.length > 0 && (
                <ul className="row-list mt-1-5">
                    {added.map((a, i) => (
                        <li key={`${a.isbn}-${i}`} className="row-item">
                            <span className="class-chip">{a.copies}</span>
                            <div className="row-main">
                                <div className="u-strong">{a.title}</div>
                                <div className="text-xs-muted">
                                    {a.created
                                        ? t('library.entry.wasNew')
                                        : t('library.entry.wasExisting')}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    )
}
