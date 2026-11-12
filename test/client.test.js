import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_FILE = path.join(HERE, '..', 'lib', 'client.js')

function loadClientModule(fetchImpl) {
  const registered = []
  const fakeWindow = {
    __ModuleLoader__: {
      load: (registration) => registered.push(registration),
    },
    addEventListener() {},
    removeEventListener() {},
  }
  const source = fs.readFileSync(CLIENT_FILE, 'utf8')
  const factory = new Function('window', 'document', 'fetch', 'console', source + '\nreturn window.__ModuleLoader__')
  const fetcher = fetchImpl || (async () => ({ ok: true, text: async () => '{"ok":true}' }))
  factory(fakeWindow, undefined, fetcher, console)
  assert.equal(registered.length, 1)
  const registration = registered[0]
  assert.equal(registration.id, 'dsh-workspace-folders')
  assert.equal(typeof registration.factory, 'function')
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => [initial, () => {}],
    useEffect: () => {},
    useRef: (initial) => ({ current: initial }),
    memo: (component) => component,
  }
  const primitives = {
    Modal: (props) => ({ type: 'Modal', props }),
    Button: (props) => ({ type: 'Button', props }),
    Input: (props) => ({ type: 'Input', props }),
    IconPlusOutlineRegular: (props) => ({ type: 'IconPlus', props }),
    IconFolderOpenRegular: (props) => ({ type: 'IconFolder', props }),
    IconCloseOutlineRegular: (props) => ({ type: 'IconClose', props }),
    IconArchiveOutlineRegular: (props) => ({ type: 'IconArchive', props }),
  }
  const exports = registration.factory((id) => {
    if (id === 'react') return React
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error('unexpected require: ' + id)
  })
  return { exports, React }
}

function fakeContext(options = {}) {
  const slots = []
  const menus = []
  const cleanups = []
  const calls = { archived: [], deleted: [], fetched: [] }
  const rows = options.rows || []
  const sessions = options.sessions || { phase: 'ready', ids: [], byId: {} }
  const raw = {
    list: { getSnapshot: () => ({ phase: 'ready', items: rows, archivedSessionIds: [] }) },
    delete: async (workspaceId) => {
      calls.deleted.push(workspaceId)
    },
    archiveSession: async (sessionId) => {
      calls.archived.push(sessionId)
    },
  }
  const proxy = new Proxy(raw, {
    get(target, property) {
      if (property === Symbol.for('cordis.original')) return target
      return Reflect.get(target, property)
    },
  })
  const ctx = {
    slots: {
      inject(parent, factory) {
        slots.push(parent)
        return factory()
      },
      register(options, component) {
        slots.push({ options, component })
        return () => {}
      },
    },
    contextMenus: {
      register(contribution) {
        menus.push(contribution)
        return () => {}
      },
    },
    effect(fn) {
      const cleanup = fn()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
      return typeof cleanup === 'function' ? cleanup : () => {}
    },
    uiWorkspace: {},
    workspaces: proxy,
    sessions: { list: { getSnapshot: () => sessions } },
    get(name) {
      if (name === 'workspaces') return proxy
      return undefined
    },
  }
  return { ctx, slots, menus, raw, calls, cleanups }
}

test('client module registers with the loader and exports the plugin face', () => {
  const { exports } = loadClientModule()
  assert.equal(typeof exports.apply, 'function')
  assert.deepEqual(exports.inject, ['slots', 'contextMenus', 'uiWorkspace', 'workspaces', 'sessions'])
})

test('apply registers the footer button, overlay, icon, and workspace menu', () => {
  const { exports } = loadClientModule()
  const env = fakeContext()
  exports.apply(env.ctx)
  const names = env.slots.filter((entry) => entry && entry.options).map((entry) => entry.options.name)
  assert.ok(names.includes('sidebar.footer.action'))
  assert.ok(names.includes('shell.overlay'))
  assert.ok(names.includes('contextMenu.icon'))
  const icon = env.slots.find((entry) => entry.options && entry.options.name === 'contextMenu.icon')
  assert.equal(icon.options.key, 'dsh-workspace-folders.folders')
  assert.equal(env.menus.length, 1)
  assert.equal(env.menus[0].target, 'workspace')
  assert.equal(env.menus[0].order, 250)
})

test('the workspace menu opens the editor for the captured target', () => {
  const { exports } = loadClientModule()
  const env = fakeContext()
  exports.apply(env.ctx)
  const actions = env.menus[0].resolve({ path: '/tmp/demo', displayTitle: 'demo' })
  assert.equal(actions.length, 1)
  assert.equal(actions[0].label, 'Workspace folders...')
  actions[0].run()
  assert.equal(exports.__test.dialog.value.kind, 'edit')
  assert.equal(exports.__test.dialog.value.workspacePath, '/tmp/demo')
  exports.__test.closeDialog()
  assert.equal(exports.__test.dialog.value, null)
})

test('apply survives a broken slot registry', () => {
  const { exports } = loadClientModule()
  const ctx = {
    slots: {
      inject() {
        throw new Error('boom')
      },
    },
    contextMenus: {
      register() {
        return () => {}
      },
    },
    effect(fn) {
      fn()
    },
  }
  assert.doesNotThrow(() => exports.apply(ctx))
})

test('the sidebar delete hook archives sessions and removes an anchored workspace', async () => {
  const fetches = []
  const fetchImpl = async (url) => {
    fetches.push(String(url))
    if (String(url).endsWith('/state')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ ok: true, workspaces: [{ path: '/ws', members: [] }] }),
      }
    }
    return { ok: true, text: async () => JSON.stringify({ ok: true }) }
  }
  const { exports } = loadClientModule(fetchImpl)
  const env = fakeContext({
    rows: [{ workspaceId: 'w1', path: '/ws' }],
    sessions: { phase: 'ready', ids: ['s1'], byId: { s1: { cwd: '/ws' } } },
  })
  exports.apply(env.ctx)
  await env.raw.delete('w1')
  assert.deepEqual(env.calls.archived, ['s1'])
  assert.deepEqual(env.calls.deleted, ['w1'])
  assert.ok(fetches.some((url) => url.endsWith('/destroy')))
  for (const cleanup of env.cleanups.reverse()) cleanup()
})

test('the sidebar delete hook deletes a workspace without sessions', async () => {
  const { exports } = loadClientModule(async () => ({
    ok: true,
    text: async () => JSON.stringify({ ok: true, workspaces: [] }),
  }))
  const env = fakeContext({ rows: [{ workspaceId: 'w1', path: '/plain' }] })
  exports.apply(env.ctx)
  await env.raw.delete('w1')
  assert.deepEqual(env.calls.archived, [])
  assert.deepEqual(env.calls.deleted, ['w1'])
})

test('the sidebar delete hook archives sessions of any workspace so nothing lands in Ungrouped', async () => {
  const { exports } = loadClientModule(async () => ({
    ok: true,
    text: async () => JSON.stringify({ ok: true, workspaces: [] }),
  }))
  const env = fakeContext({
    rows: [{ workspaceId: 'w1', path: '/plain', sessionIds: ['s1', 's2'] }],
    sessions: { phase: 'ready', ids: ['s1', 's3'], byId: { s1: { cwd: '/plain' }, s3: { cwd: '/plain/' } } },
  })
  exports.apply(env.ctx)
  await env.raw.delete('w1')
  assert.deepEqual(env.calls.archived.sort(), ['s1', 's2', 's3'])
  assert.deepEqual(env.calls.deleted, ['w1'])
})

test('stateNotice explains why extra folders are not writable', () => {
  const { exports } = loadClientModule()
  const notice = exports.__test.stateNotice
  assert.equal(notice({ sandboxIntegration: true, platformSupported: true }), '')
  assert.match(notice({ sandboxIntegration: false }), /sandbox hook/)
  assert.match(notice({ sandboxIntegration: true, platformSupported: false }), /not supported on this platform/)
  assert.equal(notice(null), '')
})

test('pure helpers normalize paths and find groups', () => {
  const { exports } = loadClientModule()
  const helpers = exports.__test
  assert.equal(helpers.trimTrailingSlash('/a/b///'), '/a/b')
  assert.equal(helpers.trimTrailingSlash('/'), '/')
  assert.equal(helpers.folderName('/a/b/'), 'b')
  assert.equal(helpers.folderName(''), 'folder')
  const state = { workspaces: [{ path: '/a/b', members: [] }] }
  assert.equal(helpers.findGroup(state, '/a/b/').path, '/a/b')
  assert.equal(helpers.findGroup(state, '/nope'), null)
  assert.equal(helpers.findGroup(null, '/a'), null)
})
