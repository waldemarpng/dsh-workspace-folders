import fs from 'node:fs'
import { WorkspaceStore } from './config.js'
import { installPolicy } from './policy.js'
import { createHandlers, registerRoutes } from './routes.js'
import { messageOf } from './errors.js'

const NAME = 'dsh-workspace-folders'
const LOG = '[' + NAME + '] '

export function promptText(store, context) {
  const session = context && context.agent ? context.agent.session : undefined
  const cwd = session && session.header ? session.header.cwd : undefined
  if (typeof cwd !== 'string' || cwd.length === 0) return ''
  let key = cwd
  try {
    key = fs.realpathSync.native(cwd)
  } catch (error) {}
  const group = store.groupForPath(key)
  if (group === undefined || group.members.length === 0) return ''
  const folders = group.members.map((member) => JSON.stringify(member.name) + ' -> ' + JSON.stringify(member.path)).join(', ')
  if (group.anchored === true) {
    return 'This workspace is an internal read-only root. The writable project folders are ' + folders + '. Use absolute paths for all file work.'
  }
  return 'This workspace has additional writable folders: ' + folders + '. Use absolute paths to reach them.'
}

function installPrompt(ctx, store) {
  ctx.inject(['systemPrompt'], (scope) => {
    try {
      const baseOrder = scope.systemPrompt.getContextOrder('SANDBOX_POLICY')
      const order = (typeof baseOrder === 'number' ? baseOrder : 110) + 1
      const disposer = scope.systemPrompt.context({
        name: 'workspace:folders',
        order,
        text: (context) => promptText(store, context),
      })
      if (typeof disposer === 'function') scope.effect(() => disposer, NAME + ': prompt context')
    } catch (error) {
      console.error(LOG + 'cannot register prompt context: ' + messageOf(error))
    }
  })
}

export default {
  name: NAME,
  apply(root) {
    let store
    try {
      store = new WorkspaceStore({})
    } catch (error) {
      console.error(LOG + 'cannot open workspace store: ' + messageOf(error))
      return
    }
    if (store.failed) {
      console.error(LOG + 'workspace store is unreadable: ' + store.lastError)
    }
    root.inject(['webServer'], (ctx) => {
      try {
        const policy = installPolicy({ ctx, store })
        if (!policy.installed) {
          console.error(LOG + 'sandbox integration is off: ' + policy.reason + ' (' + policy.detail + ')')
        }
        const handlers = createHandlers({ store, policyStatus: policy })
        const disposeRoutes = registerRoutes(ctx, handlers)
        ctx.effect(() => () => {
          try {
            disposeRoutes()
          } catch (error) {}
          policy.dispose()
        }, NAME + ': routes')
        installPrompt(ctx, store)
        console.log(LOG + 'loaded ' + store.list().length + ' workspace(s)')
      } catch (error) {
        console.error(LOG + 'setup failed: ' + messageOf(error))
      }
    })
  },
}
