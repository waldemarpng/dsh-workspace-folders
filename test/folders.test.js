import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { attachMembers, detachMembers, missingMembers } from '../lib/folders.js'
import { makeDir, removeDir, tempDir } from './helpers.js'

function physical(value) {
  return fs.realpathSync.native(value)
}

test('attachMembers adds roots and skips duplicates and nested folders', () => {
  const root = tempDir()
  try {
    const workspace = makeDir(root, 'workspace')
    const one = makeDir(root, 'one')
    const two = makeDir(root, 'two')
    const nested = makeDir(one, 'nested')
    const group = { path: physical(workspace), members: [{ name: 'one', path: physical(one) }] }
    const result = attachMembers(group, [one, two, nested, workspace])
    assert.equal(result.added.length, 1)
    assert.deepEqual(result.added.map((member) => member.name), ['two'])
    assert.deepEqual(
      result.skipped.map((entry) => entry.reason).sort(),
      ['already-attached', 'inside-workspace', 'inside-workspace'],
    )
  } finally {
    removeDir(root)
  }
})

test('attachMembers gives distinct names for equal basenames', () => {
  const root = tempDir()
  try {
    const workspace = makeDir(root, 'workspace')
    const left = makeDir(root, 'left')
    const right = makeDir(root, 'right')
    const one = makeDir(left, 'repo')
    const two = makeDir(right, 'repo')
    const group = { path: physical(workspace), members: [] }
    const result = attachMembers(group, [one, two])
    assert.deepEqual(
      result.group.members.map((member) => member.name),
      ['repo', 'repo-2'],
    )
  } finally {
    removeDir(root)
  }
})

test('detachMembers removes only matching roots and keeps folders intact', () => {
  const root = tempDir()
  try {
    const workspace = makeDir(root, 'workspace')
    const one = makeDir(root, 'one')
    const two = makeDir(root, 'two')
    const group = { path: physical(workspace), members: [{ name: 'one', path: physical(one) }, { name: 'two', path: physical(two) }] }
    const result = detachMembers(group, [one])
    assert.equal(result.removed.length, 1)
    assert.deepEqual(result.group.members.map((member) => member.name), ['two'])
    assert.equal(fs.existsSync(one), true)
    assert.equal(fs.existsSync(two), true)
  } finally {
    removeDir(root)
  }
})

test('missingMembers flags missing and non-directory members', () => {
  const root = tempDir()
  try {
    const one = makeDir(root, 'one')
    const two = makeDir(root, 'two')
    const twoPhysical = physical(two)
    removeDir(two)
    const group = { path: physical(makeDir(root, 'workspace')), members: [{ name: 'one', path: physical(one) }, { name: 'two', path: twoPhysical }] }
    assert.deepEqual(missingMembers(group), [twoPhysical])
  } finally {
    removeDir(root)
  }
})
