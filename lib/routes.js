import path from 'node:path'
import { hiddenWorkspacesDir } from './config.js'
import { WorkspaceFoldersError, messageOf } from './errors.js'
import { createAnchoredRoot, removeAnchoredRoot } from './anchored-root.js'
import { attachMembers, canonicalFolders, detachMembers, missingMembers } from './folders.js'
import { canonicalDirectory, canonicalExisting, folderBaseName, normalizeTitle } from './names.js'
import { availableFolders, writableRoots } from './roots.js'

export const ROUTE_PREFIX = '/dsh-workspace-folders'
export const BODY_LIMIT = 256 * 1024
export const ENDPOINTS = {
  state: ROUTE_PREFIX + '/state',
  roots: ROUTE_PREFIX + '/roots',
  create: ROUTE_PREFIX + '/create',
  attach: ROUTE_PREFIX + '/attach',
  detach: ROUTE_PREFIX + '/detach',
  destroy: ROUTE_PREFIX + '/destroy',
}

const STATUS = {
  'bad-request': 400,
  'invalid-title': 400,
  'invalid-folder': 400,
  'invalid-config': 400,
  'not-found': 404,
  'io-failed': 500,
  'payload-too-large': 413,
}

function isLoopbackHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (host.length === 0) return false
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1') return true
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!match || Number(match[1]) !== 127) return false
  return [match[2], match[3], match[4]].every((part) => Number(part) <= 255)
}

export function requestRejection(req, strict) {
  const headers = (req && req.headers) || {}
  if (String(headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return 403
  let hostUrl
  try {
    hostUrl = new URL('http://' + String(headers.host || ''))
  } catch (error) {
    return 403
  }
  const authority = hostUrl.host.toLowerCase()
  const origin = headers.origin
  if (typeof origin === 'string' && origin.length > 0 && origin !== 'null') {
    let originUrl
    try {
      originUrl = new URL(origin)
    } catch (error) {
      return 403
    }
    if (originUrl.host.toLowerCase() !== authority) return 403
  } else if (origin === 'null' || origin === '') {
    return 403
  }
  if (strict && !headers['sec-fetch-site'] && !isLoopbackHostname(hostUrl.hostname)) return 403
  return 0
}

export function sendJson(res, code, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new WorkspaceFoldersError('payload-too-large', 'request body is too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function readJson(req) {
  const text = await readBody(req, BODY_LIMIT)
  let payload
  try {
    payload = JSON.parse(text)
  } catch (error) {
    throw new WorkspaceFoldersError('bad-request', 'request body is not valid JSON')
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new WorkspaceFoldersError('bad-request', 'request body must be a JSON object')
  }
  return payload
}

function requestedTitle(payload, fallback) {
  if (typeof payload.title === 'string' && payload.title.trim().length > 0) {
    return normalizeTitle(payload.title)
  }
  return fallback
}

function workspacePayload(group) {
  const missing = new Set(missingMembers(group))
  const payload = {
    path: group.path,
    title: group.title,
    members: group.members.map((member) => ({ name: member.name, path: member.path, missing: missing.has(member.path) })),
  }
  if (group.anchored === true) payload.anchored = true
  return payload
}

function statePayload(store, policyStatus) {
  const payload = {
    ok: true,
    version: 1,
    sandboxIntegration: policyStatus.installed === true,
    platformSupported: process.platform !== 'win32',
    workspaces: store.list().map(workspacePayload),
  }
  if (policyStatus.installed !== true) {
    if (typeof policyStatus.reason === 'string') payload.sandboxReason = policyStatus.reason
    if (typeof policyStatus.detail === 'string' && policyStatus.detail.length > 0) payload.sandboxDetail = policyStatus.detail
  }
  if (store.failed) payload.storeError = store.lastError
  return payload
}

function groupForAttach(store, workspacePath) {
  const canonical = canonicalDirectory(workspacePath, 'not-found')
  return store.groupForPath(canonical) ?? { path: canonical, members: [] }
}

function queryCwd(req) {
  let parsed
  try {
    parsed = new URL(String(req.url || '/'), 'http://localhost')
  } catch (error) {
    throw new WorkspaceFoldersError('bad-request', 'request URL is malformed')
  }
  const cwd = parsed.searchParams.get('cwd')
  if (typeof cwd !== 'string' || cwd.length === 0) {
    throw new WorkspaceFoldersError('bad-request', 'cwd query parameter is required')
  }
  return cwd
}

export function createHandlers({ store, logger = console, policyStatus = { installed: false }, hiddenBaseDir = hiddenWorkspacesDir() }) {
  async function guard(req, res, method) {
    const code = requestRejection(req, true)
    if (code !== 0) {
      sendJson(res, code, { ok: false, error: { code: 'forbidden', message: 'request is not same-origin' } })
      return false
    }
    const actual = String(req.method || 'GET').toUpperCase()
    if (actual !== method) {
      sendJson(res, 405, { ok: false, error: { code: 'method-not-allowed', message: method + ' only' } })
      return false
    }
    return true
  }

  function fail(res, error) {
    if (error instanceof WorkspaceFoldersError) {
      sendJson(res, STATUS[error.code] || 500, { ok: false, error: { code: error.code, message: error.message } })
      return
    }
    logger.error('[dsh-workspace-folders] ' + messageOf(error))
    sendJson(res, 500, { ok: false, error: { code: 'io-failed', message: 'internal failure' } })
  }

  return {
    async state(req, res) {
      if (!(await guard(req, res, 'GET'))) return
      try {
        sendJson(res, 200, statePayload(store, policyStatus))
      } catch (error) {
        fail(res, error)
      }
    },

    async roots(req, res) {
      if (!(await guard(req, res, 'GET'))) return
      try {
        const requested = queryCwd(req)
        let canonical
        try {
          canonical = canonicalExisting(requested)
        } catch (error) {
          canonical = path.resolve(requested)
        }
        const group = store.groupForPath(canonical)
        if (group === undefined) {
          sendJson(res, 200, {
            ok: true,
            tracked: false,
            workspacePath: canonical,
            workspaceRoot: canonical,
            additionalWritableRoots: [],
            folders: [],
          })
          return
        }
        const available = availableFolders(group)
        const plan = writableRoots(group, available, canonical)
        sendJson(res, 200, {
          ok: true,
          tracked: true,
          anchored: group.anchored === true,
          workspacePath: canonical,
          workspaceRoot: plan.workspaceRoot,
          additionalWritableRoots: plan.additional,
          folders: group.members.map((member) => ({ name: member.name, path: member.path, available: available.includes(member.path) })),
        })
      } catch (error) {
        fail(res, error)
      }
    },

    async create(req, res) {
      if (!(await guard(req, res, 'POST'))) return
      try {
        const payload = await readJson(req)
        const folders = canonicalFolders(payload.folders)
        const title = requestedTitle(payload, folderBaseName(folders[0]))
        const group = createAnchoredRoot({ baseDir: hiddenBaseDir, title, folders })
        const anchored = { ...group, title }
        store.replaceGroup(anchored)
        sendJson(res, 200, { ok: true, title, workspace: workspacePayload(anchored) })
      } catch (error) {
        fail(res, error)
      }
    },

    async attach(req, res) {
      if (!(await guard(req, res, 'POST'))) return
      try {
        const payload = await readJson(req)
        if (typeof payload.workspacePath !== 'string') {
          throw new WorkspaceFoldersError('bad-request', 'workspacePath must be a string')
        }
        const group = groupForAttach(store, payload.workspacePath)
        const result = attachMembers(group, payload.folders)
        if (result.added.length > 0) store.replaceGroup(result.group)
        sendJson(res, 200, { ok: true, workspace: workspacePayload(result.group), added: result.added, skipped: result.skipped })
      } catch (error) {
        fail(res, error)
      }
    },

    async detach(req, res) {
      if (!(await guard(req, res, 'POST'))) return
      try {
        const payload = await readJson(req)
        if (typeof payload.workspacePath !== 'string') {
          throw new WorkspaceFoldersError('bad-request', 'workspacePath must be a string')
        }
        const canonical = canonicalDirectory(payload.workspacePath, 'not-found')
        const group = store.groupForPath(canonical)
        if (group === undefined) {
          throw new WorkspaceFoldersError('not-found', 'workspace has no attached folders: ' + canonical, { path: canonical })
        }
        const result = detachMembers(group, payload.folders)
        if (result.removed.length > 0) {
          if (result.group.members.length === 0) store.removeGroup(result.group.path)
          else store.replaceGroup(result.group)
        }
        sendJson(res, 200, { ok: true, workspace: workspacePayload(result.group), removed: result.removed })
      } catch (error) {
        fail(res, error)
      }
    },

    async destroy(req, res) {
      if (!(await guard(req, res, 'POST'))) return
      try {
        const payload = await readJson(req)
        if (typeof payload.workspacePath !== 'string') {
          throw new WorkspaceFoldersError('bad-request', 'workspacePath must be a string')
        }
        let canonical
        try {
          canonical = canonicalExisting(payload.workspacePath)
        } catch (error) {
          canonical = path.resolve(payload.workspacePath)
        }
        const group = store.groupForPath(canonical)
        if (group === undefined) {
          throw new WorkspaceFoldersError('not-found', 'workspace has no attached folders: ' + canonical, { path: canonical })
        }
        if (group.anchored === true) removeAnchoredRoot(group.path, hiddenBaseDir)
        const removed = store.removeGroup(canonical)
        sendJson(res, 200, { ok: true, removed })
      } catch (error) {
        fail(res, error)
      }
    },
  }
}

export function registerRoutes(ctx, handlers) {
  const disposers = []
  const dispatch = (name, req, res) => {
    return Promise.resolve()
      .then(() => handlers[name](req, res))
      .catch((error) => {
        try {
          sendJson(res, 500, { ok: false, error: { code: 'io-failed', message: 'internal failure' } })
        } catch (writeError) {}
      })
  }
  for (const [name, routePath] of Object.entries(ENDPOINTS)) {
    const dispose = ctx.webServer.register({
      kind: 'exact',
      path: routePath,
      handler: (req, res) => dispatch(name, req, res),
    })
    if (typeof dispose === 'function') disposers.push(dispose)
  }
  return () => {
    for (const dispose of disposers.reverse()) {
      try {
        dispose()
      } catch (error) {}
    }
  }
}
