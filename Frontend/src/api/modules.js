import client from './client'

/** {library, matron, boarding}: false where the operator has switched that part off for this school. */
export const getSchoolModules = () => client.get('/imboni/school/modules/')
