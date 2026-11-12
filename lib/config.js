import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { WorkspaceFoldersError, messageOf } from './errors.js'
import { assertAbsolute } from './names.js'

export const CONFIG_VERSION = 1

export function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

export function hiddenWorkspacesDir() {
  return process.env.DSH_WORKSPACE_FOLDERS_ROOT || path.join(dshHome(), 'workspaces')
}

export function defaultConfigPath() {
  return process.env.DSH_WORKSPACE_FOLDERS_CONFIG || path.join(dshHome(), '.dsh-workspace-folders.json')
}

export function emptyConfig() {
  return { version: CONFIG_VERSION, workspaces: {} }
}

function validateMember(member, names, paths) {
  if (member === null || typeof member !== 'object' || Array.isArray(member)) {
    throw new WorkspaceFoldersError('invalid-config', 'workspace member must be an object')
  }
  if (typeof member.name !== 'string' || member.name.length === 0) {
    throw new WorkspaceFoldersError('invalid-config', 'workspace member name must be a non-blank string')
  }
  if (member.name === '.' || member.name === '..' || /[/\\\u0000]/.test(member.name)) {
    throw new WorkspaceFoldersError('invalid-config', 'workspace member name is not a single path segment')
  }
  assertAbsolute(member.path, 'invalid-config', 'workspace member path')
  if (names.has(member.name)) {
    throw new WorkspaceFoldersError('invalid-config', 'duplicate workspace member name: ' + member.name)
  }
  if (paths.has(member.path)) {
    throw new WorkspaceFoldersError('invalid-config', 'duplicate workspace member path: ' + member.path)
  }
  names.add(member.name)
  paths.add(member.path)
  return { name: member.name, path: member.path }
}

function validateEntry(workspacePath, entry) {
  assertAbsolute(workspacePath, 'invalid-config', 'workspace path')
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new WorkspaceFoldersError('invalid-config', 'workspace entry must be an object')
  }
  let title
  if (typeof entry.title === 'string' && entry.title.trim().length > 0) {
    title = entry.title.trim()
  }
  if (!Array.isArray(entry.members)) {
    throw new WorkspaceFoldersError('invalid-config', 'workspace members must be an array')
  }
  const names = new Set()
  const paths = new Set()
  const members = entry.members.map((member) => validateMember(member, names, paths))
  const result = { members }
  if (title !== undefined) result.title = title
  if (entry.anchored === true) result.anchored = true
  return result
}

export function validateConfig(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new WorkspaceFoldersError('invalid-config', 'workspace store must be a JSON object')
  }
  if (raw.version !== undefined && raw.version !== CONFIG_VERSION) {
    throw new WorkspaceFoldersError('invalid-config', 'unsupported workspace store version: ' + String(raw.version))
  }
  if (raw.workspaces === null || typeof raw.workspaces !== 'object' || Array.isArray(raw.workspaces)) {
    throw new WorkspaceFoldersError('invalid-config', 'workspace store must contain a workspaces object')
  }
  const workspaces = {}
  for (const [workspacePath, entry] of Object.entries(raw.workspaces)) {
    workspaces[workspacePath] = validateEntry(workspacePath, entry)
  }
  return { version: CONFIG_VERSION, workspaces }
}

export function serializeGroup(group) {
  const entry = { members: group.members.map((member) => ({ name: member.name, path: member.path })) }
  if (group.title !== undefined) entry.title = group.title
  if (group.anchored === true) entry.anchored = true
  return entry
}

function readRaw(file) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw new WorkspaceFoldersError('invalid-config', 'workspace store is not readable: ' + messageOf(error))
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new WorkspaceFoldersError('invalid-config', 'workspace store is not valid JSON: ' + messageOf(error))
  }
}

function writeRaw(file, config) {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const tmp = file + '.' + process.pid + '.' + Date.now() + '.tmp'
  try {
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 })
    fs.renameSync(tmp, file)
  } catch (error) {
    try {
      fs.unlinkSync(tmp)
    } catch (cleanupError) {}
    throw new WorkspaceFoldersError('io-failed', 'cannot write workspace store: ' + messageOf(error), { path: file })
  }
}

export class WorkspaceStore {
  constructor(options = {}) {
    this.file = options.file || defaultConfigPath()
    this.logger = options.logger || console
    this.config = emptyConfig()
    this.groups = []
    this.byPath = new Map()
    this.lastError = ''
    this.reload()
  }

  reload() {
    try {
      const raw = readRaw(this.file)
      this.config = raw === null ? emptyConfig() : validateConfig(raw)
      this.lastError = ''
    } catch (error) {
      this.lastError = messageOf(error)
      this.config = emptyConfig()
    }
    this.rebuild()
  }

  rebuild() {
    this.groups = Object.entries(this.config.workspaces).map(([workspacePath, entry]) => {
      const group = { path: workspacePath, members: entry.members.map((member) => ({ name: member.name, path: member.path })) }
      if (entry.title !== undefined) group.title = entry.title
      if (entry.anchored === true) group.anchored = true
      return group
    })
    this.byPath = new Map(this.groups.map((group) => [group.path, group]))
  }

  get failed() {
    return this.lastError.length > 0
  }

  list() {
    return this.groups
  }

  groupForPath(workspacePath) {
    return this.byPath.get(workspacePath)
  }

  save(nextConfig) {
    if (this.failed) {
      throw new WorkspaceFoldersError('invalid-config', 'workspace store is unreadable; fix or remove ' + this.file)
    }
    const validated = validateConfig(nextConfig)
    writeRaw(this.file, validated)
    this.config = validated
    this.rebuild()
  }

  replaceGroup(group) {
    const workspaces = { ...this.config.workspaces, [group.path]: serializeGroup(group) }
    this.save({ version: CONFIG_VERSION, workspaces })
  }

  removeGroup(workspacePath) {
    if (!this.byPath.has(workspacePath)) return false
    const workspaces = { ...this.config.workspaces }
    delete workspaces[workspacePath]
    this.save({ version: CONFIG_VERSION, workspaces })
    return true
  }
}
