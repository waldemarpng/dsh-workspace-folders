import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { availableFolders, writableRoots } from '../lib/roots.js'
import { makeDir, removeDir, tempDir } from './helpers.js'

function physical(value) {
  return fs.realpathSync.native(value)
}

test('availableFolders skips missing and swapped members', () => {
  const root = tempDir()
  try {
    const one = makeDir(root, 'one')
    const two = makeDir(root, 'two')
    const other = makeDir(root, 'other')
    const twoPhysical = physical(two)
    removeDir(two)
    fs.symlinkSync(other, two, 'dir')
    const skipped = []
    const group = {
      path: physical(makeDir(root, 'workspace')),
      members: [
        { name: 'one', path: physical(one) },
        { name: 'two', path: twoPhysical },
        { name: 'missing', path: path.join(root, 'missing') },
      ],
    }
    assert.deepEqual(availableFolders(group, (memberPath) => skipped.push(memberPath)), [physical(one)])
    assert.deepEqual(skipped.sort(), [path.join(root, 'missing'), twoPhysical].sort())
  } finally {
    removeDir(root)
  }
})

test('writableRoots makes the first project the anchored root', () => {
  const group = { path: '/roots/demo', anchored: true, members: [] }
  assert.deepEqual(writableRoots(group, ['/a', '/b'], '/roots/demo'), { workspaceRoot: '/a', additional: ['/b'] })
})

test('writableRoots keeps the session root for a plain workspace', () => {
  const group = { path: '/project', members: [] }
  assert.deepEqual(writableRoots(group, ['/a', '/b'], '/project'), { workspaceRoot: '/project', additional: ['/a', '/b'] })
})

test('writableRoots falls back to the session root when nothing is available', () => {
  const group = { path: '/roots/demo', anchored: true, members: [] }
  assert.deepEqual(writableRoots(group, [], '/roots/demo'), { workspaceRoot: '/roots/demo', additional: [] })
})
