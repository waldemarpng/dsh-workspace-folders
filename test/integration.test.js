import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import plugin from '../lib/index.js'
import { bodyOf, makeDir, makeRequest, makeResponse, removeDir, tempDir } from './helpers.js'

class PolicyService {
  resolve() {
    return { mode: 'workspace-write', workspaceRoot: '/workspace' }
  }
}

function fakeRoot(rawPolicy, routes, promptHolder, cleanups) {
  const proxy = new Proxy(rawPolicy, {
    get(target, property) {
      if (property === Symbol.for('cordis.original')) return target
      return Reflect.get(target, property)
    },
  })
  const systemPrompt = {
    getContextOrder: () => 110,
    context: (descriptor) => {
      promptHolder.current = descriptor
      return () => {}
    },
  }
  const ctx = {
    get(name) {
      return name === 'sandboxPolicy' ? proxy : undefined
    },
    inject(names, callback) {
      if (names.includes('systemPrompt')) callback({ systemPrompt, effect: (fn) => fn() })
    },
    effect(fn) {
      const cleanup = fn()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
    webServer: {
      register(entry) {
        routes.set(entry.path, entry.handler)
        return () => {}
      },
    },
  }
  return {
    inject(names, callback) {
      callback(ctx)
    },
  }
}

async function call(handler, method, body) {
  const res = makeResponse()
  await handler(makeRequest(method, body), res)
  return res
}

test('plugin wires create, state, policy, and prompt end to end', async () => {
  const root = tempDir()
  const configFile = path.join(root, 'store.json')
  const previousConfig = process.env.DSH_WORKSPACE_FOLDERS_CONFIG
  const previousRoot = process.env.DSH_WORKSPACE_FOLDERS_ROOT
  process.env.DSH_WORKSPACE_FOLDERS_CONFIG = configFile
  process.env.DSH_WORKSPACE_FOLDERS_ROOT = path.join(root, 'roots')
  const routes = new Map()
  const cleanups = []
  const promptHolder = { current: null }
  const rawPolicy = new PolicyService()
  try {
    plugin.apply(fakeRoot(rawPolicy, routes, promptHolder, cleanups))
    assert.ok(routes.has('/dsh-workspace-folders/state'))
    assert.ok(routes.has('/dsh-workspace-folders/create'))

    const one = makeDir(root, 'one')
    const two = makeDir(root, 'two')
    const created = await call(routes.get('/dsh-workspace-folders/create'), 'POST', { title: 'demo', folders: [one, two] })
    assert.equal(created.statusCode, 200)
    const workspace = bodyOf(created).workspace
    assert.equal(workspace.title, 'demo')
    assert.equal(workspace.anchored, true)
    assert.notEqual(workspace.path, fs.realpathSync.native(one))
    assert.equal(workspace.members.length, 2)

    const state = await call(routes.get('/dsh-workspace-folders/state'), 'GET')
    assert.equal(bodyOf(state).workspaces.length, 1)

    const policy = rawPolicy.resolve({ session: { header: { cwd: workspace.path } } })
    assert.equal(policy.workspaceRoot, fs.realpathSync.native(one))
    assert.deepEqual(policy.additionalWritableRoots, [fs.realpathSync.native(two)])

    assert.ok(promptHolder.current !== null)
    const text = promptHolder.current.text({ agent: { session: { header: { cwd: workspace.path } } } })
    assert.match(text, /writable project folders/)
    assert.match(text, /two/)

    for (const cleanup of cleanups.reverse()) cleanup()
    assert.equal(rawPolicy.resolve, PolicyService.prototype.resolve)
    assert.equal(fs.existsSync(workspace.path), true)
    assert.equal(fs.existsSync(path.join(workspace.path, 'one')), true)
  } finally {
    if (previousConfig === undefined) delete process.env.DSH_WORKSPACE_FOLDERS_CONFIG
    else process.env.DSH_WORKSPACE_FOLDERS_CONFIG = previousConfig
    if (previousRoot === undefined) delete process.env.DSH_WORKSPACE_FOLDERS_ROOT
    else process.env.DSH_WORKSPACE_FOLDERS_ROOT = previousRoot
    removeDir(root)
  }
})

test('plugin stays inert without the sandbox service', () => {
  const workspaceRoot = tempDir()
  const previousConfig = process.env.DSH_WORKSPACE_FOLDERS_CONFIG
  const previousRoot = process.env.DSH_WORKSPACE_FOLDERS_ROOT
  process.env.DSH_WORKSPACE_FOLDERS_CONFIG = path.join(workspaceRoot, 'store.json')
  process.env.DSH_WORKSPACE_FOLDERS_ROOT = path.join(workspaceRoot, 'roots')
  const routes = new Map()
  const fake = {
    inject(names, callback) {
      callback({
        webServer: {
          register(entry) {
            routes.set(entry.path, entry.handler)
            return () => {}
          },
        },
        get: () => undefined,
        inject() {},
        effect() {},
      })
    },
  }
  try {
    assert.doesNotThrow(() => plugin.apply(fake))
  } finally {
    if (previousConfig === undefined) delete process.env.DSH_WORKSPACE_FOLDERS_CONFIG
    else process.env.DSH_WORKSPACE_FOLDERS_CONFIG = previousConfig
    if (previousRoot === undefined) delete process.env.DSH_WORKSPACE_FOLDERS_ROOT
    else process.env.DSH_WORKSPACE_FOLDERS_ROOT = previousRoot
    removeDir(workspaceRoot)
  }
})
