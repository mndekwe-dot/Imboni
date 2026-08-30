import client from './client'

/**
 * The library API.
 *
 * Every endpoint below is Pro-only on the server: a school whose plan does not
 * include the library gets 402 rather than 403, because the request is not
 * forbidden, it is unpaid for. `getLibraryAvailability` is the exception and is
 * deliberately ungated -- it is what the app asks before deciding whether to
 * show the portal at all, so it must be able to answer "no" without failing.
 */
export const getLibraryAvailability = () => client.get('/imboni/library/availability/')

// ── Desk ──────────────────────────────────────────────────────────────────────
export const getLibraryDashboard = () => client.get('/imboni/library/dashboard/')
export const getLibrarySettings  = () => client.get('/imboni/library/settings/')
export const saveLibrarySettings = (data) => client.put('/imboni/library/settings/', data)

// ── Catalogue ─────────────────────────────────────────────────────────────────
export const getBooks    = (params) => client.get('/imboni/library/books/', { params })
export const getBook     = (id)     => client.get(`/imboni/library/books/${id}/`)
export const createBook  = (data)   => client.post('/imboni/library/books/', data)
export const updateBook  = (id, d)  => client.patch(`/imboni/library/books/${id}/`, d)
export const deleteBook  = (id)     => client.delete(`/imboni/library/books/${id}/`)
export const addCopy     = (bookId, d) => client.post(`/imboni/library/books/${bookId}/copies/`, d)
export const updateCopy  = (id, d)  => client.patch(`/imboni/library/copies/${id}/`, d)
export const removeCopy  = (id)     => client.delete(`/imboni/library/copies/${id}/`)

// ── Circulation ───────────────────────────────────────────────────────────────
export const getLoans   = (params) => client.get('/imboni/library/loans/', { params })
export const issueLoan  = (data)   => client.post('/imboni/library/loans/issue/', data)
export const returnLoan = (id)     => client.post(`/imboni/library/loans/${id}/return/`, {})
export const renewLoan  = (id)     => client.post(`/imboni/library/loans/${id}/renew/`, {})

// ── Borrowers ─────────────────────────────────────────────────────────────────
export const getMembers = (params) => client.get('/imboni/library/members/', { params })
export const getMember  = (id)     => client.get(`/imboni/library/members/${id}/`)

// ── Fines ─────────────────────────────────────────────────────────────────────
export const getFines  = (params)     => client.get('/imboni/library/fines/', { params })
export const payFine   = (id)         => client.post(`/imboni/library/fines/${id}/`, { action: 'pay' })
export const waiveFine = (id, reason) => client.post(`/imboni/library/fines/${id}/`,
    { action: 'waive', reason })

// ── Reservations ──────────────────────────────────────────────────────────────
export const getReservations   = (params) => client.get('/imboni/library/reservations/', { params })
export const createReservation = (data)   => client.post('/imboni/library/reservations/', data)
export const cancelReservation = (id)     =>
    client.post(`/imboni/library/reservations/${id}/cancel/`, {})

// ── Acquisitions ──────────────────────────────────────────────────────────────
export const getAcquisitions   = (params) => client.get('/imboni/library/acquisitions/', { params })
export const createAcquisition = (data)   => client.post('/imboni/library/acquisitions/', data)
export const decideAcquisition = (id, decision, note) =>
    client.post(`/imboni/library/acquisitions/${id}/decision/`, { decision, note })
export const receiveAcquisition = (id, data) =>
    client.post(`/imboni/library/acquisitions/${id}/receive/`, data || {})
export const getSuppliers   = ()   => client.get('/imboni/library/suppliers/')
export const createSupplier = (d)  => client.post('/imboni/library/suppliers/', d)

// ── The student's side ────────────────────────────────────────────────────────
export const getCatalogue = (params) => client.get('/imboni/library/catalogue/', { params })
export const getMyLibrary = ()       => client.get('/imboni/library/me/')
export const reserveBook  = (bookId) => client.post('/imboni/library/me/reserve/', { book: bookId })
