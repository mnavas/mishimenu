#!/usr/bin/env node
/**
 * Generates Supabase-compatible anon and service_role JWT keys
 * from the JWT_SECRET in .env, then writes them back to .env.
 *
 * Usage: node scripts/generate-keys.js
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ENV_FILE = path.join(__dirname, '..', '.env')

function base64url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function makeJwt(payload, secret) {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64url(Buffer.from(JSON.stringify(payload)))
  const data = `${header}.${body}`
  const sig = base64url(crypto.createHmac('sha256', secret).update(data).digest())
  return `${data}.${sig}`
}

if (!fs.existsSync(ENV_FILE)) {
  console.error('Error: .env not found. Copy .env.example to .env first.')
  process.exit(1)
}

const env = fs.readFileSync(ENV_FILE, 'utf8')
const match = env.match(/JWT_SECRET=(.+)/)
if (!match) {
  console.error('Error: JWT_SECRET not found in .env')
  process.exit(1)
}

const jwtSecret = match[1].trim()
if (jwtSecret.length < 32) {
  console.error('Error: JWT_SECRET must be at least 32 characters')
  process.exit(1)
}

const iat = Math.floor(Date.now() / 1000)
const exp = iat + 5 * 365 * 24 * 60 * 60 // 5 years

const anonKey = makeJwt({ role: 'anon', iss: 'supabase-demo', iat, exp }, jwtSecret)
const serviceKey = makeJwt({ role: 'service_role', iss: 'supabase-demo', iat, exp }, jwtSecret)

let updated = env
  .replace(/^ANON_KEY=.*$/m, `ANON_KEY=${anonKey}`)
  .replace(/^SERVICE_ROLE_KEY=.*$/m, `SERVICE_ROLE_KEY=${serviceKey}`)
  // Also update NEXT_PUBLIC_SUPABASE_ANON_KEY if it's still the placeholder
  .replace(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=\$\{ANON_KEY\}$/m, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`)
  .replace(/^SUPABASE_SERVICE_ROLE_KEY=\$\{SERVICE_ROLE_KEY\}$/m, `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`)

fs.writeFileSync(ENV_FILE, updated)
console.log('✓ ANON_KEY and SERVICE_ROLE_KEY written to .env')
console.log('')
console.log('Next steps:')
console.log('  docker compose up -d')
console.log('  Visit http://localhost:3000')
