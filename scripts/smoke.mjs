import { resolveBaseUrl } from './discover.mjs'

const DSH_URL = await resolveBaseUrl()
const STATE_PATH = '/dsh-workspace-folders/state'
const TIMEOUT_MS = 5000

const results = []

async function request(headers) {
  const response = await fetch(DSH_URL + STATE_PATH, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json', ...(headers || {}) },
  })
  const text = await response.text()
  let data = null
  try {
    data = JSON.parse(text)
  } catch (error) {
    data = null
  }
  return { status: response.status, data }
}

async function run(name, fn) {
  try {
    await fn()
    results.push({ ok: true, name })
  } catch (error) {
    results.push({ ok: false, message: name + ': ' + ((error && error.message) || String(error)) })
  }
}

await run('GET state returns ok', async () => {
  const result = await request()
  if (result.status !== 200 || !result.data || result.data.ok !== true) throw new Error('status ' + result.status)
  if (result.data.version !== 1) throw new Error('unexpected state version: ' + String(result.data.version))
  if (typeof result.data.sandboxIntegration !== 'boolean') throw new Error('sandboxIntegration is missing')
  if (!Array.isArray(result.data.workspaces)) throw new Error('workspaces is missing')
})

await run('cross-site GET is rejected', async () => {
  const result = await request({ 'sec-fetch-site': 'cross-site' })
  if (result.status !== 403) throw new Error('expected 403, got ' + result.status)
})

let failed = 0
for (const result of results) {
  if (result.ok) console.log('PASS ' + result.name)
  else {
    failed += 1
    console.log('FAIL ' + result.message)
  }
}
console.log('smoke done: ' + (results.length - failed) + '/' + results.length + ' passed against ' + DSH_URL)
if (failed > 0) process.exit(1)
