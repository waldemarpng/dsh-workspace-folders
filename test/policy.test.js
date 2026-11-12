import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { CONFIG_VERSION, WorkspaceStore } from '../lib/config.js'
import { installPolicy } from '../lib/policy.js'
import { makeDir, removeDir, tempDir } from './helpers.js'

class PolicyService {
  resolve() {
    return { mode: 'workspace-write', workspaceRoot: '/workspace', deployment: true }
  }
}

class ReadOnlyService {
  resolve() {
    return { mode: 'read-only', workspaceRoot: '/workspace' }
  }
}

class DangerService {
  resolve() {
    return { mode: 'danger-full-access', workspaceRoot: '/workspace' }
  }
}

function proxyOf(raw) {
  return new Proxy(raw, {
    get(target, property) {
      if (property === Symbol.for('cordis.original')) return target
      return Reflect.get(target, property)
    },
  })
}

function setup(service) {
  const root = tempDir()
  const workspace = makeDir(root, 'workspace')
  const member = makeDir(root, 'member')
  const file = path.join(root, 'store.json')
  const store = new WorkspaceStore({ file, logger: { error() {} } })
  store.save({ version: CONFIG_VERSION, workspaces: {} })
  store.replaceGroup({ path: fs.realpathSync.native(workspace), title: 'workspace', members: [{ name: 'member', path: fs.realpathSync.native(member) }] })
  const raw = service === undefined ? undefined : new service()
  const ctx = { get: () => (raw === undefined ? undefined : proxyOf(raw)) }
  const errors = []
  const logger = { error: (message) => errors.push(String(message)) }
  return { root, workspace, member, store, raw, ctx, logger, errors }
}

test('policy adds a workspace extra folder to workspace-write', () => {
  const env = setup(PolicyService)
  try {
    const installation = installPolicy({ ctx: env.ctx, store: env.store, logger: env.logger, platform: 'darwin' })
    assert.equal(installation.installed, true)
    const policy = env.raw.resolve({ session: { header: { cwd: fs.realpathSync.native(env.workspace) } } })
    assert.equal(policy.mode, 'workspace-write')
    assert.equal(policy.workspaceRoot, '/workspace')
    assert.deepEqual(policy.additionalWritableRoots, [fs.realpathSync.native(env.member)])
  } finally {
    removeDir(env.root)
  }
})

test('policy makes an anchored root read-only and uses the first project as the root', () => {
  const root = tempDir()
  const workspace = makeDir(root, 'workspace')
  const first = makeDir(root, 'first')
  const second = makeDir(root, 'second')
  const file = path.join(root, 'store.json')
  const store = new WorkspaceStore({ file, logger: { error() {} } })
  store.save({ version: CONFIG_VERSION, workspaces: {} })
  store.replaceGroup({
    path: fs.realpathSync.native(workspace),
    title: 'workspace',
    anchored: true,
    members: [
      { name: 'first', path: fs.realpathSync.native(first) },
      { name: 'second', path: fs.realpathSync.native(second) },
    ],
  })
  const raw = new PolicyService()
  const ctx = { get: () => proxyOf(raw) }
  try {
    const installation = installPolicy({ ctx, store, logger: { error() {} }, platform: 'darwin' })
    assert.equal(installation.installed, true)
    const policy = raw.resolve({ session: { header: { cwd: fs.realpathSync.native(workspace) } } })
    assert.equal(policy.workspaceRoot, fs.realpathSync.native(first))
    assert.deepEqual(policy.additionalWritableRoots, [fs.realpathSync.native(second)])
  } finally {
    removeDir(root)
  }
})

test('policy canonicalizes a symlinked workspace spelling', () => {
  const env = setup(PolicyService)
  try {
    const alias = path.join(env.root, 'alias')
    fs.symlinkSync(env.workspace, alias, 'dir')
    const installation = installPolicy({ ctx: env.ctx, store: env.store, logger: env.logger, platform: 'darwin' })
    assert.equal(installation.installed, true)
    const policy = env.raw.resolve({ session: { header: { cwd: alias } } })
    assert.deepEqual(policy.additionalWritableRoots, [fs.realpathSync.native(env.member)])
  } finally {
    removeDir(env.root)
  }
})

test('policy leaves read-only and danger-full-access untouched', () => {
  for (const service of [ReadOnlyService, DangerService]) {
    const env = setup(service)
    try {
      installPolicy({ ctx: env.ctx, store: env.store, logger: env.logger, platform: 'darwin' })
      const policy = env.raw.resolve({ session: { header: { cwd: env.workspace } } })
      assert.equal(policy.additionalWritableRoots, undefined)
    } finally {
      removeDir(env.root)
    }
  }
})

test('policy ignores sessions outside tracked workspaces and without a cwd', () => {
  const env = setup(PolicyService)
  try {
    installPolicy({ ctx: env.ctx, store: env.store, logger: env.logger, platform: 'darwin' })
    const outside = env.raw.resolve({ session: { header: { cwd: env.root } } })
    assert.equal(outside.additionalWritableRoots, undefined)
    const none = env.raw.resolve({})
    assert.equal(none.additionalWritableRoots, undefined)
  } finally {
    removeDir(env.root)
  }
})

test('policy skips a missing or symlink-swapped member', () => {
  const env = setup(PolicyService)
  try {
    installPolicy({ ctx: env.ctx, store: env.store, logger: env.logger, platform: 'darwin' })
    const cwd = fs.realpathSync.native(env.workspace)
    const member = fs.realpathSync.native(env.member)
    const other = makeDir(env.root, 'other')
    removeDir(env.member)
    const missing = env.raw.resolve({ session: { header: { cwd } } })
    assert.equal(missing.additionalWritableRoots, undefined)
    assert.ok(env.errors.length > 0)
    fs.symlinkSync(other, member, 'dir')
    const swapped = env.raw.resolve({ session: { header: { cwd } } })
    assert.equal(swapped.additionalWritableRoots, undefined)
  } finally {
    removeDir(env.root)
  }
})

test('policy merges deployment roots without duplicates', () => {
  class ExtraService {
    resolve() {
      return { mode: 'workspace-write', workspaceRoot: '/workspace', additionalWritableRoots: ['/deployment'] }
    }
  }
  const env = setup(ExtraService)
  try {
    installPolicy({ ctx: env.ctx, store: env.store, logger: env.logger, platform: 'darwin' })
    const member = fs.realpathSync.native(env.member)
    const policy = env.raw.resolve({ session: { header: { cwd: env.workspace } } })
    assert.deepEqual(policy.additionalWritableRoots, ['/deployment', member])
  } finally {
    removeDir(env.root)
  }
})

test('policy restores the original method on dispose', () => {
  const env = setup(PolicyService)
  try {
    const original = env.raw.resolve
    const installation = installPolicy({ ctx: env.ctx, store: env.store, logger: env.logger, platform: 'darwin' })
    assert.notEqual(env.raw.resolve, original)
    installation.dispose()
    assert.equal(env.raw.resolve, PolicyService.prototype.resolve)
  } finally {
    removeDir(env.root)
  }
})

test('policy disables itself without a compatible service', () => {
  const env = setup(undefined)
  try {
    const missing = installPolicy({ ctx: env.ctx, store: env.store, logger: env.logger, platform: 'darwin' })
    assert.equal(missing.installed, false)
    assert.equal(missing.reason, 'missing')
    const broken = installPolicy({ ctx: { get: () => ({}) }, store: env.store, logger: env.logger, platform: 'darwin' })
    assert.equal(broken.installed, false)
    assert.equal(broken.reason, 'unsupported')
  } finally {
    removeDir(env.root)
  }
})

test('policy grants nothing on win32', () => {
  const env = setup(PolicyService)
  try {
    installPolicy({ ctx: env.ctx, store: env.store, logger: env.logger, platform: 'win32' })
    const policy = env.raw.resolve({ session: { header: { cwd: fs.realpathSync.native(env.workspace) } } })
    assert.equal(policy.additionalWritableRoots, undefined)
  } finally {
    removeDir(env.root)
  }
})
