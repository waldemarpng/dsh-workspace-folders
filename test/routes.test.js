import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { CONFIG_VERSION, WorkspaceStore } from '../lib/config.js'
import { ENDPOINTS, createHandlers } from '../lib/routes.js'
import { bodyOf, makeDir, makeRequest, makeResponse, removeDir, tempDir, tempStore } from './helpers.js'

function setup() {
  const root = tempDir()
  const hiddenBase = path.join(root, 'hidden')
  const storeInfo = tempStore()
  const store = new WorkspaceStore({ file: storeInfo.file, logger: { error() {} } })
  store.save({ version: CONFIG_VERSION, workspaces: {} })
  const handlers = createHandlers({ store, logger: { error() {} }, policyStatus: { installed: true }, hiddenBaseDir: hiddenBase })
  return { root, hiddenBase, store, handlers }
}

async function call(handler, method, body, headers, url) {
  const res = makeResponse()
  await handler(makeRequest(method, body, headers, url), res)
  return res
}

test('state reports empty workspaces', async () => {
  const env = setup()
  try {
    const res = await call(env.handlers.state, 'GET')
    assert.equal(res.statusCode, 200)
    const payload = bodyOf(res)
    assert.equal(payload.ok, true)
    assert.equal(payload.sandboxIntegration, true)
    assert.deepEqual(payload.workspaces, [])
    assert.equal(res.headers['Cache-Control'], 'no-store')
  } finally {
    removeDir(env.root)
    removeDir(path.dirname(env.store.file))
  }
})

test('state reports why sandbox integration is off', async () => {
  const root = tempDir()
  const storeInfo = tempStore()
  const store = new WorkspaceStore({ file: storeInfo.file, logger: { error() {} } })
  store.save({ version: CONFIG_VERSION, workspaces: {} })
  const handlers = createHandlers({
    store,
    logger: { error() {} },
    policyStatus: { installed: false, reason: 'unsupported', detail: 'sandboxPolicy.resolve is unavailable' },
    hiddenBaseDir: path.join(root, 'hidden'),
  })
  try {
    const res = await call(handlers.state, 'GET')
    const payload = bodyOf(res)
    assert.equal(payload.sandboxIntegration, false)
    assert.equal(payload.sandboxReason, 'unsupported')
    assert.equal(payload.sandboxDetail, 'sandboxPolicy.resolve is unavailable')
  } finally {
    removeDir(root)
    removeDir(path.dirname(storeInfo.file))
  }
})

test('roots reports the effective writable roots of an anchored workspace', async () => {
  const env = setup()
  try {
    const one = makeDir(env.root, 'one')
    const two = makeDir(env.root, 'two')
    const created = await call(env.handlers.create, 'POST', { folders: [one, two] })
    const workspacePath = bodyOf(created).workspace.path
    const res = await call(env.handlers.roots, 'GET', undefined, undefined, '/dsh-workspace-folders/roots?cwd=' + encodeURIComponent(workspacePath))
    assert.equal(res.statusCode, 200)
    const payload = bodyOf(res)
    assert.equal(payload.tracked, true)
    assert.equal(payload.anchored, true)
    assert.equal(payload.workspaceRoot, fs.realpathSync.native(one))
    assert.deepEqual(payload.additionalWritableRoots, [fs.realpathSync.native(two)])
    assert.equal(payload.folders.every((folder) => folder.available), true)
  } finally {
    removeDir(env.root)
    removeDir(path.dirname(env.store.file))
  }
})

test('roots reports an untracked folder as itself', async () => {
  const env = setup()
  try {
    const plain = makeDir(env.root, 'plain')
    const res = await call(env.handlers.roots, 'GET', undefined, undefined, '/dsh-workspace-folders/roots?cwd=' + encodeURIComponent(plain))
    const payload = bodyOf(res)
    assert.equal(payload.tracked, false)
    assert.equal(payload.workspaceRoot, fs.realpathSync.native(plain))
    assert.deepEqual(payload.additionalWritableRoots, [])
  } finally {
    removeDir(env.root)
    removeDir(path.dirname(env.store.file))
  }
})

test('roots requires a cwd query parameter', async () => {
  const env = setup()
  try {
    const res = await call(env.handlers.roots, 'GET', undefined, undefined, '/dsh-workspace-folders/roots')
    assert.equal(res.statusCode, 400)
  } finally {
    removeDir(env.root)
    removeDir(path.dirname(env.store.file))
  }
})

test('create makes a new anchored workspace from the folders', async () => {
  const env = setup()
  try {
    const one = makeDir(env.root, 'one')
    const two = makeDir(env.root, 'two')
    const res = await call(env.handlers.create, 'POST', { title: 'My Workspace', folders: [one, two] })
    assert.equal(res.statusCode, 200)
    const payload = bodyOf(res)
    assert.equal(payload.title, 'My Workspace')
    assert.equal(payload.workspace.title, 'My Workspace')
    assert.equal(payload.workspace.anchored, true)
    assert.notEqual(payload.workspace.path, fs.realpathSync.native(one))
    assert.equal(payload.workspace.path.startsWith(fs.realpathSync.native(env.hiddenBase)), true)
    assert.equal(payload.workspace.members.length, 2)
    assert.equal(fs.existsSync(payload.workspace.path), true)
    assert.equal(fs.existsSync(path.join(payload.workspace.path, 'one')), true)
    assert.equal(fs.existsSync(one), true)
    assert.equal(fs.existsSync(two), true)
    assert.equal(env.store.list().length, 1)
  } finally {
    removeDir(env.root)
    removeDir(path.dirname(env.store.file))
  }
})

test('attach and detach a plain workspace', async () => {
  const env = setup()
  try {
    const workspace = makeDir(env.root, 'plain')
    const one = makeDir(env.root, 'one')
    const attached = await call(env.handlers.attach, 'POST', { workspacePath: workspace, folders: [one] })
    assert.equal(attached.statusCode, 200)
    let payload = bodyOf(attached)
    assert.equal(payload.workspace.members.length, 1)
    assert.equal(env.store.list().length, 1)

    const detached = await call(env.handlers.detach, 'POST', { workspacePath: workspace, folders: [one] })
    assert.equal(detached.statusCode, 200)
    payload = bodyOf(detached)
    assert.equal(payload.workspace.members.length, 0)
    assert.equal(env.store.list().length, 0)
  } finally {
    removeDir(env.root)
    removeDir(path.dirname(env.store.file))
  }
})

test('destroy removes an anchored root and keeps the project folders', async () => {
  const env = setup()
  try {
    const one = makeDir(env.root, 'one')
    const two = makeDir(env.root, 'two')
    const created = await call(env.handlers.create, 'POST', { folders: [one, two] })
    const workspacePath = bodyOf(created).workspace.path
    const res = await call(env.handlers.destroy, 'POST', { workspacePath })
    assert.equal(res.statusCode, 200)
    assert.equal(bodyOf(res).removed, true)
    assert.equal(fs.existsSync(workspacePath), false)
    assert.equal(fs.existsSync(one), true)
    assert.equal(fs.existsSync(two), true)
    assert.equal(env.store.list().length, 0)
    const missing = await call(env.handlers.destroy, 'POST', { workspacePath })
    assert.equal(missing.statusCode, 404)
  } finally {
    removeDir(env.root)
    removeDir(path.dirname(env.store.file))
  }
})

test('destroy removes tracking of a plain workspace and keeps the folder', async () => {
  const env = setup()
  try {
    const workspace = makeDir(env.root, 'plain')
    const one = makeDir(env.root, 'one')
    await call(env.handlers.attach, 'POST', { workspacePath: workspace, folders: [one] })
    const res = await call(env.handlers.destroy, 'POST', { workspacePath: workspace })
    assert.equal(res.statusCode, 200)
    assert.equal(bodyOf(res).removed, true)
    assert.equal(fs.existsSync(workspace), true)
    assert.equal(fs.existsSync(one), true)
    assert.equal(env.store.list().length, 0)
  } finally {
    removeDir(env.root)
    removeDir(path.dirname(env.store.file))
  }
})

test('handlers reject cross-origin, malformed, oversized, and wrong-method requests', async () => {
  const env = setup()
  try {
    const cross = await call(env.handlers.state, 'GET', undefined, { 'sec-fetch-site': 'cross-site' })
    assert.equal(cross.statusCode, 403)

    const foreign = await call(env.handlers.create, 'POST', { title: 'x', folders: [] }, { origin: 'http://evil.test' })
    assert.equal(foreign.statusCode, 403)

    const malformed = await call(env.handlers.create, 'POST', '{nope')
    assert.equal(malformed.statusCode, 400)

    const noFolders = await call(env.handlers.create, 'POST', { title: 'x', folders: [] })
    assert.equal(noFolders.statusCode, 400)

    const oversized = await call(env.handlers.create, 'POST', { title: 'x', folders: [], filler: 'a'.repeat(300 * 1024) })
    assert.equal(oversized.statusCode, 413)

    const wrong = await call(env.handlers.create, 'GET')
    assert.equal(wrong.statusCode, 405)
  } finally {
    removeDir(env.root)
    removeDir(path.dirname(env.store.file))
  }
})

test('state flags missing attached folders', async () => {
  const env = setup()
  try {
    const one = makeDir(env.root, 'one')
    const two = makeDir(env.root, 'two')
    const created = await call(env.handlers.create, 'POST', { folders: [one, two] })
    removeDir(two)
    const workspacePath = bodyOf(created).workspace.path
    const res = await call(env.handlers.state, 'GET')
    const payload = bodyOf(res)
    const entry = payload.workspaces.find((group) => group.path === workspacePath)
    assert.ok(entry)
    assert.equal(entry.members.find((member) => member.name === 'two').missing, true)
    assert.equal(fs.existsSync(one), true)
  } finally {
    removeDir(env.root)
    removeDir(path.dirname(env.store.file))
  }
})

test('endpoint paths share one prefix', () => {
  for (const routePath of Object.values(ENDPOINTS)) {
    assert.ok(routePath.startsWith('/dsh-workspace-folders/'))
  }
})
