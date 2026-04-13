// Business email validation for provider registration

export const BLOCKED_PERSONAL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'outlook.co.uk',
  'live.com',
  'live.co.uk',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'zoho.com',
  'ymail.com',
  'rocketmail.com',
  'gmx.com',
  'gmx.co.uk',
]

export function isBusinessEmail(email) {
  if (!email || typeof email !== 'string') return false
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return !BLOCKED_PERSONAL_DOMAINS.includes(domain)
}
