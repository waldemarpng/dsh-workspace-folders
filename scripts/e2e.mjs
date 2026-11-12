import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveBaseUrl } from './discover.mjs'

const PREFIX = '/dsh-workspace-folders'
const TIMEOUT_MS = 8000
const DSH_URL = await resolveBaseUrl()
const WORK_DIR = path.join(os.tmpdir(), 'dsh', 'workspace-folders-e2e', 'run-' + process.pid + '-' + Date.now())
const results = []
let workspacePath = ''

function physical(value) {
  return fs.realpathSync.native(value)
}


async function api(routePath, options = {}) {
  const init = {
    method: options.method || 'GET',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  }
  if (options.body !== undefined) {
    init.headers['content-type'] = 'application/json'
    init.body = JSON.stringify(options.body)
  }
  const response = await fetch(DSH_URL + routePath, init)
  const text = await response.text()
  let payload = null
  try {
    payload = JSON.parse(text)
  } catch (error) {
    payload = null
  }
  return { status: response.status, payload }
}

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

function describe(result) {
  return 'HTTP ' + result.status + ' ' + (result.payload === null ? 'no JSON body' : JSON.stringify(result.payload))
}

function hint(result) {
  return result.status === 404 ? ' (the running host predates this route; restart DeepSeek Harness)' : ''
}

async function run(name, fn) {
  try {
    await fn()
    results.push({ ok: true, name })
  } catch (error) {
    results.push({ ok: false, message: name + ': ' + (error && error.message ? error.message : String(error)) })
  }
}

async function cleanup() {
  if (workspacePath.length > 0) {
    try {
      await api(PREFIX + '/destroy', { method: 'POST', body: { workspacePath } })
    } catch (error) {}
  }
  try {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
  } catch (error) {}
}

const projects = { a: path.join(WORK_DIR, 'project-a'), b: path.join(WORK_DIR, 'project-b'), c: path.join(WORK_DIR, 'project-c') }

await run('state reports a supported sandbox', async () => {
  const result = await api(PREFIX + '/state')
  expect(result.status === 200 && result.payload && result.payload.ok === true, 'state is not ok: ' + describe(result))
  expect(result.payload.sandboxIntegration === true, 'sandbox integration is off: ' + String(result.payload.sandboxReason))
  expect(result.payload.platformSupported === true, 'platform does not support extra roots')
})

await run('create makes a new anchored workspace', async () => {
  for (const dir of Object.values(projects)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(projects.a, 'marker.txt'), 'e2e\n')
  const result = await api(PREFIX + '/create', { method: 'POST', body: { title: 'e2e', folders: [projects.a, projects.b] } })
  expect(result.status === 200 && result.payload && result.payload.ok === true, 'create failed: ' + describe(result))
  const workspace = result.payload.workspace
  workspacePath = workspace.path
  expect(workspace.anchored === true, 'workspace is not anchored')
  expect(workspace.members.length === 2, 'expected two members, got ' + String(workspace.members.length))
  expect(fs.existsSync(workspace.path), 'workspace root does not exist: ' + workspace.path)
  expect(physical(path.join(workspace.path, workspace.members[0].name)) === physical(projects.a), 'first link does not point at project-a')
  expect(physical(path.join(workspace.path, workspace.members[1].name)) === physical(projects.b), 'second link does not point at project-b')
})

await run('roots resolves the writable set', async () => {
  const result = await api(PREFIX + '/roots?cwd=' + encodeURIComponent(workspacePath))
  expect(result.status === 200 && result.payload && result.payload.ok === true, 'roots failed: ' + describe(result) + hint(result))
  const payload = result.payload
  expect(payload.tracked === true && payload.anchored === true, 'workspace is not tracked as anchored')
  expect(payload.workspaceRoot === physical(projects.a), 'workspaceRoot is not project-a: ' + String(payload.workspaceRoot))
  expect(payload.additionalWritableRoots.length === 1, 'expected one additional root, got ' + String(payload.additionalWritableRoots.length))
  expect(payload.additionalWritableRoots[0] === physical(projects.b), 'additional root is not project-b')
  expect(payload.folders.every((folder) => folder.available === true), 'a member is unavailable')
})

await run('attach and detach move one folder in and out', async () => {
  const attached = await api(PREFIX + '/attach', { method: 'POST', body: { workspacePath, folders: [projects.c] } })
  expect(attached.status === 200 && attached.payload.ok === true, 'attach failed: ' + describe(attached))
  expect(attached.payload.workspace.members.length === 3, 'attach did not add a member')
  const linked = attached.payload.workspace.members.find((member) => member.path === physical(projects.c))
  expect(linked !== undefined, 'attached member is missing from the payload')
  expect(fs.existsSync(path.join(workspacePath, linked.name)), 'attached link does not exist')

  const detached = await api(PREFIX + '/detach', { method: 'POST', body: { workspacePath, folders: [projects.c] } })
  expect(detached.status === 200 && detached.payload.ok === true, 'detach failed: ' + describe(detached))
  expect(detached.payload.workspace.members.length === 2, 'detach did not remove a member')
  expect(fs.existsSync(path.join(workspacePath, linked.name)) === false, 'link was not removed')
  expect(fs.existsSync(projects.c), 'project-c was deleted')
})

await run('destroy removes the root and keeps the projects', async () => {
  const state = await api(PREFIX + '/state')
  expect(state.payload.workspaces.some((workspace) => workspace.path === workspacePath), 'state does not list the workspace')
  const result = await api(PREFIX + '/destroy', { method: 'POST', body: { workspacePath } })
  expect(result.status === 200 && result.payload.ok === true, 'destroy failed: ' + describe(result))
  expect(fs.existsSync(workspacePath) === false, 'workspace root still exists')
  expect(fs.existsSync(path.join(projects.a, 'marker.txt')), 'project-a file is gone')
  expect(fs.existsSync(projects.b) && fs.existsSync(projects.c), 'a project folder is gone')
  const after = await api(PREFIX + '/state')
  expect(after.payload.workspaces.every((workspace) => workspace.path !== workspacePath), 'state still lists the destroyed workspace')
  const roots = await api(PREFIX + '/roots?cwd=' + encodeURIComponent(workspacePath))
  expect(roots.payload !== null, 'roots is unavailable after destroy: ' + describe(roots) + hint(roots))
  expect(roots.payload.tracked === false, 'destroyed workspace is still tracked')
})

await cleanup()

let failed = 0
for (const result of results) {
  if (result.ok) console.log('PASS ' + result.name)
  else {
    failed += 1
    console.log('FAIL ' + result.message)
  }
}
console.log('e2e done: ' + (results.length - failed) + '/' + results.length + ' passed against ' + DSH_URL)
if (failed > 0) process.exit(1)
