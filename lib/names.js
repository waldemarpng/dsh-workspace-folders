import fs from 'node:fs'
import path from 'node:path'
import { WorkspaceFoldersError } from './errors.js'

const INVALID_TITLE = /[/\\:\u0000-\u001f\u007f]/
const INVALID_NAME = /[/\\:\u0000-\u001f\u007f]/g

export function normalizeTitle(value) {
  if (typeof value !== 'string') {
    throw new WorkspaceFoldersError('invalid-title', 'workspace name must be a string')
  }
  const title = value.trim()
  if (title.length === 0) {
    throw new WorkspaceFoldersError('invalid-title', 'workspace name is required')
  }
  if (title.length > 80) {
    throw new WorkspaceFoldersError('invalid-title', 'workspace name is longer than 80 characters')
  }
  if (title === '.' || title === '..') {
    throw new WorkspaceFoldersError('invalid-title', 'workspace name is reserved')
  }
  if (INVALID_TITLE.test(title)) {
    throw new WorkspaceFoldersError('invalid-title', 'workspace name cannot contain slashes, colons, or control characters')
  }
  return title
}

export function assertAbsolute(value, code, subject) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WorkspaceFoldersError(code, subject + ' must be a non-blank path')
  }
  if (value.includes('\u0000')) {
    throw new WorkspaceFoldersError(code, subject + ' contains a NUL byte')
  }
  if (!path.isAbsolute(value)) {
    throw new WorkspaceFoldersError(code, subject + ' must be an absolute path')
  }
  return value
}

export function canonicalDirectory(value, code = 'invalid-folder') {
  assertAbsolute(value, code, 'folder')
  let physical
  try {
    physical = fs.realpathSync.native(value)
  } catch (error) {
    throw new WorkspaceFoldersError(code, 'folder does not exist: ' + value, { path: value })
  }
  let info
  try {
    info = fs.statSync(physical)
  } catch (error) {
    throw new WorkspaceFoldersError(code, 'folder is not readable: ' + value, { path: value })
  }
  if (!info.isDirectory()) {
    throw new WorkspaceFoldersError(code, 'not a directory: ' + value, { path: value })
  }
  return physical
}

export function canonicalExisting(value) {
  assertAbsolute(value, 'bad-request', 'path')
  try {
    return fs.realpathSync.native(value)
  } catch (error) {
    throw new WorkspaceFoldersError('not-found', 'path does not exist: ' + value, { path: value })
  }
}

export function folderBaseName(folder) {
  const base = path.basename(folder)
  const cleaned = base.replace(INVALID_NAME, '-')
  if (cleaned.length === 0 || cleaned === '.' || cleaned === '..') return 'folder'
  return cleaned
}

export function allocateLinkName(base, used) {
  const taken = used instanceof Set ? used : new Set(used)
  if (!taken.has(base)) return base
  let index = 2
  for (;;) {
    const candidate = base + '-' + index
    if (!taken.has(candidate)) return candidate
    index += 1
  }
}
