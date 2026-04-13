// Shared validation utilities for auth flows

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

export function isBusinessEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return !BLOCKED_PERSONAL_DOMAINS.includes(domain)
}

export function isPasswordValid(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' }
  if (password.length > 72) return { valid: false, error: 'Password is too long' }
  return { valid: true }
}
