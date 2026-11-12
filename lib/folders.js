import fs from 'node:fs'
import path from 'node:path'
import { WorkspaceFoldersError } from './errors.js'
import { allocateLinkName, canonicalDirectory, folderBaseName } from './names.js'

export function canonicalFolders(folders) {
  if (!Array.isArray(folders)) {
    throw new WorkspaceFoldersError('bad-request', 'folders must be an array of absolute paths')
  }
  const seen = new Set()
  const result = []
  for (const folder of folders) {
    if (typeof folder !== 'string') {
      throw new WorkspaceFoldersError('bad-request', 'folders must contain absolute paths')
    }
    const physical = canonicalDirectory(folder)
    if (seen.has(physical)) continue
    seen.add(physical)
    result.push(physical)
  }
  if (result.length === 0) {
    throw new WorkspaceFoldersError('invalid-folder', 'at least one folder is required')
  }
  return result
}

function isInside(parent, child) {
  const relative = path.relative(parent, child)
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export function createFolderLink(linkPath, target) {
  fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
}

function unlinkOwnedLink(group, member) {
  const link = path.join(group.path, member.name)
  let info
  try {
    info = fs.lstatSync(link)
  } catch (error) {
    if (error && error.code === 'ENOENT') return
    throw new WorkspaceFoldersError('io-failed', 'cannot inspect workspace link: ' + error.message, { path: link })
  }
  if (!info.isSymbolicLink()) return
  let target
  try {
    target = fs.readlinkSync(link)
  } catch (error) {
    return
  }
  if (path.resolve(group.path, target) !== member.path) return
  try {
    fs.unlinkSync(link)
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw new WorkspaceFoldersError('io-failed', 'cannot remove workspace link: ' + error.message, { path: link })
    }
  }
}

export function attachMembers(group, folders) {
  const requested = canonicalFolders(folders)
  const existingPaths = new Set(group.members.map((member) => member.path))
  const used = new Set(group.members.map((member) => member.name))
  const added = []
  const skipped = []
  const covered = group.members.slice()
  for (const folder of requested) {
    if (existingPaths.has(folder)) {
      skipped.push({ path: folder, reason: 'already-attached' })
      continue
    }
    if (folder === group.path || covered.some((member) => isInside(member.path, folder)) || isInside(folder, group.path)) {
      skipped.push({ path: folder, reason: 'inside-workspace' })
      continue
    }
    const name = allocateLinkName(folderBaseName(folder), used)
    used.add(name)
    added.push({ name, path: folder })
    covered.push({ path: folder })
  }
  if (added.length === 0) return { group, added, skipped }
  if (group.anchored === true) {
    const created = []
    try {
      for (const member of added) {
        createFolderLink(path.join(group.path, member.name), member.path)
        created.push(member)
      }
    } catch (error) {
      for (const member of created.reverse()) {
        try {
          unlinkOwnedLink(group, member)
        } catch (cleanupError) {}
      }
      throw new WorkspaceFoldersError('io-failed', 'cannot create workspace links: ' + error.message, { path: group.path })
    }
  }
  return { group: { ...group, members: [...group.members, ...added] }, added, skipped }
}

export function detachMembers(group, folders) {
  if (!Array.isArray(folders)) {
    throw new WorkspaceFoldersError('bad-request', 'folders must be an array of absolute paths')
  }
  const requested = new Set()
  for (const folder of folders) {
    if (typeof folder !== 'string') {
      throw new WorkspaceFoldersError('bad-request', 'folders must contain absolute paths')
    }
    try {
      requested.add(canonicalDirectory(folder))
    } catch (error) {
      requested.add(path.resolve(folder))
    }
  }
  const removed = []
  const kept = []
  for (const member of group.members) {
    if (requested.has(member.path)) {
      if (group.anchored === true) unlinkOwnedLink(group, member)
      removed.push(member)
    } else {
      kept.push(member)
    }
  }
  if (removed.length === 0) return { group, removed }
  return { group: { ...group, members: kept }, removed }
}

export function missingMembers(group) {
  const missing = []
  for (const member of group.members) {
    try {
      if (!fs.statSync(member.path).isDirectory()) missing.push(member.path)
    } catch (error) {
      missing.push(member.path)
    }
  }
  return missing
}
