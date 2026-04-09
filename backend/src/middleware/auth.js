import basicAuth from 'express-basic-auth'

export const adminAuth = basicAuth({
  users: {
    [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASS || 'changeme',
  },
  challenge: true,
  realm: 'CompareTheNursery Admin',
})
