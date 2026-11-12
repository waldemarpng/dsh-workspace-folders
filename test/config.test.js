import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { CONFIG_VERSION, WorkspaceStore, validateConfig } from '../lib/config.js'
import { tempDir, tempStore, removeDir } from './helpers.js'

function group(base, title) {
  return { path: path.join(base, 'demo'), title, members: [{ name: 'one', path: path.join(base, 'one') }] }
}

test('validateConfig accepts a valid store', () => {
  const config = validateConfig({ workspaces: {} })
  assert.equal(config.version, CONFIG_VERSION)
  assert.deepEqual(config.workspaces, {})
})

test('validateConfig rejects malformed stores', () => {
  assert.throws(() => validateConfig(null), /object/)
  assert.throws(() => validateConfig({ version: 9 }), /version/)
  assert.throws(() => validateConfig({ workspaces: { '/x': { members: [{ name: 'a', path: '/a' }, { name: 'a', path: '/b' }] } } }), /duplicate/)
  assert.throws(() => validateConfig({ workspaces: { '/x': { members: [{ name: '../a', path: '/a' }] } } }), /single path segment/)
  assert.throws(() => validateConfig({ workspaces: { '/x': { members: 'nope' } } }), /members/)
})

test('store starts empty when the file is missing', () => {
  const { dir, file } = tempStore()
  try {
    const store = new WorkspaceStore({ file, logger: console })
    assert.equal(store.failed, false)
    assert.deepEqual(store.list(), [])
    assert.equal(store.groupForPath('/nope'), undefined)
  } finally {
    removeDir(dir)
  }
})

test('store round-trips groups through an atomic 0600 file', () => {
  const { dir, file } = tempStore()
  try {
    const base = path.join(dir, 'base')
    fs.mkdirSync(base)
    const store = new WorkspaceStore({ file, logger: console })
    store.save({ version: CONFIG_VERSION, workspaces: {} })
    store.replaceGroup(group(base, 'demo'))
    assert.equal(fs.statSync(file).mode & 0o777, 0o600)
    const reloaded = new WorkspaceStore({ file, logger: console })
    assert.equal(reloaded.failed, false)
    assert.equal(reloaded.list().length, 1)
    assert.equal(reloaded.groupForPath(path.join(base, 'demo')).title, 'demo')
    assert.equal(reloaded.removeGroup(path.join(base, 'demo')), true)
    assert.equal(reloaded.list().length, 0)
  } finally {
    removeDir(dir)
  }
})

test('store refuses to overwrite a corrupt file', () => {
  const { dir, file } = tempStore()
  try {
    fs.writeFileSync(file, '{nope', 'utf8')
    const store = new WorkspaceStore({ file, logger: console })
    assert.equal(store.failed, true)
    assert.ok(store.lastError.length > 0)
    assert.throws(() => store.save({ version: CONFIG_VERSION, workspaces: {} }), /unreadable/)
    assert.equal(fs.readFileSync(file, 'utf8'), '{nope')
  } finally {
    removeDir(dir)
  }
})

test('store can replace and remove groups', () => {
  const { dir, file } = tempStore()
  try {
    const base = path.join(dir, 'base')
    fs.mkdirSync(base)
    const store = new WorkspaceStore({ file, logger: console })
    store.save({ version: CONFIG_VERSION, workspaces: {} })
    store.replaceGroup(group(base, 'demo'))
    assert.equal(store.list().length, 1)
    store.replaceGroup({ ...group(base, 'demo'), members: [] })
    assert.equal(store.list()[0].members.length, 0)
    store.removeGroup(path.join(base, 'demo'))
    assert.equal(store.list().length, 0)
  } finally {
    removeDir(dir)
  }
})
