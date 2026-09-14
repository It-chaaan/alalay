import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// EAS injects environment variables directly. Loading .env here only makes
// the same guard usable before local Expo/Gradle builds; it never prints it.
const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
  }
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function validUrl(value) {
  try { const parsed = new URL(value); return parsed.protocol === 'https:' && Boolean(parsed.hostname); } catch { return false; }
}
function validKey(value) {
  if (!value || value.length < 20) return false;
  if (value.startsWith('sb_publishable_')) return true;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role !== 'service_role'; } catch { return false; }
}

if (!validUrl(url) || !validKey(key)) {
  console.error('Mobile public Supabase configuration is unavailable or invalid for this build.');
  process.exit(1);
}
console.log('Mobile public Supabase configuration validated.');
