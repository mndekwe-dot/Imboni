import client from './client'

/**
 * The staff register: departments and every worker the school employs, with
 * or without an Imboni login. Kept by the admin and the finance office; payroll
 * pays the people on it.
 */
export const getDepartments   = (params)   => client.get('/imboni/staff/departments/', { params })
export const createDepartment = (data)     => client.post('/imboni/staff/departments/', data)
export const updateDepartment = (id, data) => client.patch(`/imboni/staff/departments/${id}/`, data)
export const deleteDepartment = (id)       => client.delete(`/imboni/staff/departments/${id}/`)

export const getStaffMembers   = (params)   => client.get('/imboni/staff/members/', { params })
export const createStaffMember = (data)     => client.post('/imboni/staff/members/', data)
export const updateStaffMember = (id, data) => client.patch(`/imboni/staff/members/${id}/`, data)
export const deleteStaffMember = (id)       => client.delete(`/imboni/staff/members/${id}/`)
