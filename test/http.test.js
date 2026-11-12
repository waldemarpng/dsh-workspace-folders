import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { test } from 'node:test'
import { CONFIG_VERSION, WorkspaceStore } from '../lib/config.js'
import { ENDPOINTS, createHandlers } from '../lib/routes.js'
import { makeDir, removeDir, tempDir, tempStore } from './helpers.js'

function mount(handlers) {
  const byPath = new Map()
  for (const [name, routePath] of Object.entries(ENDPOINTS)) byPath.set(routePath, handlers[name])
  const server = http.createServer((req, res) => {
    const handler = byPath.get(new URL(req.url || '/', 'http://localhost').pathname)
    if (handler === undefined) {
      res.writeHead(404)
      res.end()
      return
    }
    handler(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

test('the routes serve a full cycle over real HTTP', async () => {
  const root = tempDir()
  const storeInfo = tempStore()
  const store = new WorkspaceStore({ file: storeInfo.file, logger: { error() {} } })
  store.save({ version: CONFIG_VERSION, workspaces: {} })
  const handlers = createHandlers({
    store,
    logger: { error() {} },
    policyStatus: { installed: true },
    hiddenBaseDir: path.join(root, 'roots'),
  })
  const { server, port } = await mount(handlers)
  const base = 'http://127.0.0.1:' + port
  let workspacePath = ''
  try {
    const one = makeDir(root, 'one')
    const two = makeDir(root, 'two')

    const created = await fetch(base + ENDPOINTS.create, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'http', folders: [one, two] }),
    })
    assert.equal(created.status, 200)
    const body = await created.json()
    workspacePath = body.workspace.path
    assert.equal(body.workspace.anchored, true)
    assert.equal(body.workspace.members.length, 2)

    const roots = await fetch(base + ENDPOINTS.roots + '?cwd=' + encodeURIComponent(workspacePath))
    assert.equal(roots.status, 200)
    const plan = await roots.json()
    assert.equal(plan.tracked, true)
    assert.equal(plan.workspaceRoot, fs.realpathSync.native(one))
    assert.deepEqual(plan.additionalWritableRoots, [fs.realpathSync.native(two)])

    const missing = await fetch(base + ENDPOINTS.roots)
    assert.equal(missing.status, 400)

    const destroyed = await fetch(base + ENDPOINTS.destroy, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspacePath }),
    })
    assert.equal(destroyed.status, 200)
    assert.equal(fs.existsSync(workspacePath), false)
    workspacePath = ''
  } finally {
    if (workspacePath.length > 0) {
      try {
        await fetch(base + ENDPOINTS.destroy, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ workspacePath }),
        })
      } catch (error) {}
    }
    await new Promise((resolve) => server.close(resolve))
    removeDir(root)
    removeDir(path.dirname(storeInfo.file))
  }
})
