import fs from 'node:fs'
import { messageOf } from './errors.js'
import { availableFolders, writableRoots } from './roots.js'

const ORIGINAL = Symbol.for('cordis.original')
const CACHE_LIMIT = 256

function canonicalKey(value, cache) {
  if (typeof value !== 'string' || value.length === 0) return ''
  const cached = cache.get(value)
  if (cached !== undefined) return cached
  let physical
  try {
    physical = fs.realpathSync.native(value)
  } catch (error) {
    return value
  }
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(value, physical)
  return physical
}

export function installPolicy({ ctx, store, logger = console, platform = process.platform }) {
  let proxy
  try {
    proxy = ctx.get('sandboxPolicy')
  } catch (error) {
    return { installed: false, reason: 'missing', detail: messageOf(error), dispose() {} }
  }
  if (proxy === undefined || proxy === null) {
    return { installed: false, reason: 'missing', detail: 'sandboxPolicy is not mounted', dispose() {} }
  }
  const raw = proxy[ORIGINAL] === undefined ? proxy : proxy[ORIGINAL]
  if (typeof raw.resolve !== 'function') {
    return { installed: false, reason: 'unsupported', detail: 'sandboxPolicy.resolve is unavailable', dispose() {} }
  }
  const original = raw.resolve
  const cwdCache = new Map()
  const warned = new Set()
  const warnOnce = (memberPath) => {
    if (warned.has(memberPath)) return
    warned.add(memberPath)
    logger.error('[dsh-workspace-folders] folder is unavailable, skipping it: ' + memberPath)
  }

  function stateFor(session) {
    if (platform === 'win32') return null
    const cwd = session && session.header ? session.header.cwd : undefined
    if (typeof cwd !== 'string' || cwd.length === 0) return null
    const group = store.groupForPath(canonicalKey(cwd, cwdCache))
    if (group === undefined) return null
    const available = availableFolders(group, warnOnce)
    if (available.length === 0) return null
    return { group, available }
  }

  function resolve(request = {}) {
    const policy = original.call(this, request)
    if (policy === null || policy === undefined || policy.mode !== 'workspace-write') return policy
    const state = stateFor(request.session)
    if (state === null) return policy
    const plan = writableRoots(state.group, state.available, policy.workspaceRoot)
    const merged = []
    const seen = new Set()
    for (const root of [...(policy.additionalWritableRoots || []), ...plan.additional]) {
      if (seen.has(root)) continue
      seen.add(root)
      merged.push(root)
    }
    const next = { ...policy, workspaceRoot: plan.workspaceRoot }
    if (merged.length > 0) next.additionalWritableRoots = merged
    return next
  }

  try {
    raw.resolve = resolve
  } catch (error) {
    return { installed: false, reason: 'unsupported', detail: 'sandboxPolicy.resolve is not writable', dispose() {} }
  }
  return {
    installed: true,
    dispose() {
      if (raw.resolve === resolve) delete raw.resolve
    },
  }
}
