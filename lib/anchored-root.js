import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { WorkspaceFoldersError } from './errors.js'
import { canonicalFolders, createFolderLink } from './folders.js'
import { allocateLinkName, folderBaseName } from './names.js'

function ensureBase(baseDir) {
  try {
    fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 })
    return fs.realpathSync.native(baseDir)
  } catch (error) {
    throw new WorkspaceFoldersError('io-failed', 'cannot prepare the workspace root directory: ' + error.message, { path: baseDir })
  }
}

export function createAnchoredRoot({ baseDir, title, folders }) {
  const folderList = canonicalFolders(folders)
  const base = ensureBase(baseDir)
  const slug = (folderBaseName(title) || 'workspace').slice(0, 60)
  let root = null
  for (let attempt = 0; attempt < 5 && root === null; attempt += 1) {
    const candidate = path.join(base, slug + '-' + crypto.randomBytes(3).toString('hex'))
    try {
      fs.mkdirSync(candidate, { mode: 0o755 })
      root = candidate
    } catch (error) {
      if (error && error.code !== 'EEXIST') {
        throw new WorkspaceFoldersError('io-failed', 'cannot create the workspace root: ' + error.message, { path: candidate })
      }
    }
  }
  if (root === null) {
    throw new WorkspaceFoldersError('io-failed', 'cannot allocate a workspace root', { path: base })
  }
  const used = new Set()
  const members = folderList.map((folder) => {
    const name = allocateLinkName(folderBaseName(folder), used)
    used.add(name)
    return { name, path: folder }
  })
  const created = []
  try {
    for (const member of members) {
      createFolderLink(path.join(root, member.name), member.path)
      created.push(member)
    }
  } catch (error) {
    for (const member of created.reverse()) {
      try {
        fs.unlinkSync(path.join(root, member.name))
      } catch (cleanupError) {}
    }
    try {
      fs.rmdirSync(root)
    } catch (cleanupError) {}
    throw new WorkspaceFoldersError('io-failed', 'cannot create the workspace links: ' + error.message, { path: root })
  }
  let physical = root
  try {
    physical = fs.realpathSync.native(root)
  } catch (error) {}
  return { path: physical, anchored: true, members }
}

export function removeAnchoredRoot(rootPath, baseDir) {
  let base
  try {
    base = fs.realpathSync.native(baseDir)
  } catch (error) {
    return false
  }
  const physical = path.resolve(rootPath)
  if (path.dirname(physical) !== base) return false
  try {
    fs.rmSync(physical, { recursive: true, force: true })
    return true
  } catch (error) {
    throw new WorkspaceFoldersError('io-failed', 'cannot remove the workspace root: ' + error.message, { path: physical })
  }
}
