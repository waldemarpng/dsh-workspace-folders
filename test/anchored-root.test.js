import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { createAnchoredRoot, removeAnchoredRoot } from '../lib/anchored-root.js'
import { makeDir, removeDir, tempDir } from './helpers.js'

function physical(value) {
  return fs.realpathSync.native(value)
}

test('createAnchoredRoot links every folder under a fresh root', () => {
  const root = tempDir()
  try {
    const base = makeDir(root, 'roots')
    const one = makeDir(root, 'one')
    const two = makeDir(root, 'two')
    const group = createAnchoredRoot({ baseDir: base, title: 'demo', folders: [one, two] })
    assert.equal(group.anchored, true)
    assert.equal(path.dirname(group.path), physical(base))
    assert.equal(path.basename(group.path).startsWith('demo-'), true)
    assert.deepEqual(group.members.map((member) => member.name), ['one', 'two'])
    assert.equal(physical(path.join(group.path, 'one')), physical(one))
    assert.equal(physical(path.join(group.path, 'two')), physical(two))
  } finally {
    removeDir(root)
  }
})

test('createAnchoredRoot gives distinct link names for equal basenames', () => {
  const root = tempDir()
  try {
    const base = makeDir(root, 'roots')
    const left = makeDir(root, 'left')
    const right = makeDir(root, 'right')
    const group = createAnchoredRoot({ baseDir: base, title: 'demo', folders: [makeDir(left, 'repo'), makeDir(right, 'repo')] })
    assert.deepEqual(group.members.map((member) => member.name), ['repo', 'repo-2'])
  } finally {
    removeDir(root)
  }
})

test('createAnchoredRoot rejects a missing folder and leaves no root behind', () => {
  const root = tempDir()
  try {
    const base = makeDir(root, 'roots')
    assert.throws(() => createAnchoredRoot({ baseDir: base, title: 'demo', folders: [path.join(root, 'missing')] }), /does not exist/)
    assert.deepEqual(fs.readdirSync(physical(base)), [])
  } finally {
    removeDir(root)
  }
})

test('removeAnchoredRoot removes the root and keeps the projects', () => {
  const root = tempDir()
  try {
    const base = makeDir(root, 'roots')
    const one = makeDir(root, 'one')
    const group = createAnchoredRoot({ baseDir: base, title: 'demo', folders: [one] })
    assert.equal(removeAnchoredRoot(group.path, base), true)
    assert.equal(fs.existsSync(group.path), false)
    assert.equal(fs.existsSync(one), true)
  } finally {
    removeDir(root)
  }
})

test('removeAnchoredRoot refuses a path outside the base', () => {
  const root = tempDir()
  try {
    const base = makeDir(root, 'roots')
    const outside = makeDir(root, 'outside')
    assert.equal(removeAnchoredRoot(outside, base), false)
    assert.equal(fs.existsSync(outside), true)
  } finally {
    removeDir(root)
  }
})
