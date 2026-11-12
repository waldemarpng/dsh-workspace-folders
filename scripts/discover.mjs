import { execFileSync } from 'node:child_process'

const PREFIX = '/dsh-workspace-folders'
const FALLBACK_URL = 'http://127.0.0.1:62498'

function listeningUrls() {
  const urls = []
  let listing = ''
  try {
    listing = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8', timeout: 4000 })
  } catch (error) {
    return urls
  }
  for (const line of listing.split('\n')) {
    if (!/DeepSeek/i.test(line)) continue
    const match = /127\.0\.0\.1:(\d+)\s+\(LISTEN\)/.exec(line)
    if (match) urls.push('http://127.0.0.1:' + match[1])
  }
  return urls
}

export async function resolveBaseUrl() {
  if (typeof process.env.DSH_URL === 'string' && process.env.DSH_URL.length > 0) {
    return process.env.DSH_URL.replace(/\/+$/, '')
  }
  for (const candidate of listeningUrls()) {
    try {
      const response = await fetch(candidate + PREFIX + '/state', { signal: AbortSignal.timeout(2000) })
      const payload = await response.json()
      if (response.ok && payload && payload.version === 1) return candidate
    } catch (error) {}
  }
  return FALLBACK_URL
}
