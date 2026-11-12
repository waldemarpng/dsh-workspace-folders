window.__ModuleLoader__.load({
  id: 'dsh-workspace-folders',
  factory: (require) => {
    const React = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement
    const NAME = 'dsh-workspace-folders'
    const ROUTE = '/dsh-workspace-folders'
    const runtime = { ctx: null }
    let stylesReady = false

    const Modal = primitives.Modal
    const Button = primitives.Button
    const Input = primitives.Input
    const IconPlus = primitives.IconPlusOutlineRegular
    const IconFolder = primitives.IconFolderOpenRegular
    const IconClose = primitives.IconCloseOutlineRegular

    const CSS =
      '.dshwf-footer{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--dsw-radius-sm,6px);border:none;background:transparent;color:var(--dsw-alias-label-secondary,#666);cursor:pointer;padding:0}' +
      '.dshwf-footer:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}' +
      '.dshwf-footer:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,#4d6bfe)}' +
      '.dshwf-modal.dshwf-modal{width:min(520px,100%);max-height:calc(100dvh - 48px)}' +
      '.dshwf-body{display:flex;flex-direction:column;gap:14px}' +
      '.dshwf-field{display:flex;flex-direction:column;gap:6px}' +
      '.dshwf-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#777)}' +
      '.dshwf-input{display:flex;width:100%;box-sizing:border-box}' +
      '.dshwf-row{display:flex;align-items:center;gap:8px}' +
      '.dshwf-row .dshwf-input{flex:1;width:auto;min-width:0}' +
      '.dshwf-list{max-height:260px;overflow:auto;border:.5px solid var(--dsw-alias-border-l3,rgba(0,0,0,.12));border-radius:var(--dsw-radius-md,8px)}' +
      '.dshwf-empty{padding:16px;color:var(--dsw-alias-label-tertiary,#777);font-size:13px;text-align:center;border:.5px dashed var(--dsw-alias-border-l3,rgba(0,0,0,.12));border-radius:var(--dsw-radius-md,8px)}' +
      '.dshwf-folder{display:flex;align-items:center;gap:10px;min-height:44px;box-sizing:border-box;padding:4px 6px 4px 12px;border-top:.5px solid var(--dsw-alias-border-l3,rgba(0,0,0,.08))}' +
      '.dshwf-icon-btn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-tertiary,#777);cursor:pointer}' +
      '.dshwf-icon-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,#111)}' +
      '.dshwf-icon-btn:disabled{opacity:.4;cursor:default}' +
      '.dshwf-folder:first-child{border-top:none}' +
      '.dshwf-folder-icon{flex:none;display:inline-flex;color:var(--dsw-alias-label-tertiary,#777)}' +
      '.dshwf-folder-main{flex:1;min-width:0}' +
      '.dshwf-folder-name{font-size:13px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dshwf-folder-path{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#777);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dshwf-badge{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:8px;background:rgba(196,56,59,.12);color:var(--dsw-alias-state-error-primary,#c4383b)}' +
      '.dshwf-hint{margin:0;color:var(--dsw-alias-label-tertiary,#777);font-size:12px;line-height:18px}' +
      '.dshwf-warning{margin:0;padding:8px 10px;border-radius:var(--dsw-radius-sm,6px);background:rgba(180,120,0,.1);color:var(--dsw-alias-label-secondary,#666);font-size:12px;line-height:18px}' +
      '.dshwf-danger{color:var(--dsw-alias-state-error-primary,#c4383b)}' +
      '.dshwf-error{margin:0;padding:8px 10px;border-radius:var(--dsw-radius-sm,6px);background:rgba(196,56,59,.1);color:var(--dsw-alias-state-error-primary,#c4383b);font-size:12px;line-height:18px;white-space:pre-wrap}' +
      '.dshwf-modal-footer{display:flex;align-items:center;gap:8px;width:100%}' +
      '.dshwf-spacer{flex:1}' +
      '.dshwf-crumbs{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:12px;color:var(--dsw-alias-label-tertiary,#777)}' +
      '.dshwf-crumb{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#666);cursor:pointer;padding:2px 4px;border-radius:4px;font:inherit;font-size:12px}' +
      '.dshwf-crumb:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}' +
      '.dshwf-crumb-sep{opacity:.5}' +
      '.dshwf-browse-list{min-height:180px;max-height:280px;overflow:auto;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.12));border-radius:var(--dsw-radius-sm,8px)}' +
      '.dshwf-entry{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;padding:7px 10px;border:none;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));background:transparent;color:inherit;font:inherit;font-size:13px;text-align:left;cursor:pointer}' +
      '.dshwf-entry:first-child{border-top:none}' +
      '.dshwf-entry:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}' +
      '.dshwf-entry-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dshwf-browse-actions{display:flex;align-items:center;gap:8px}' +
      '.dshwf-browse-actions .dshwf-input{flex:1;width:auto;min-width:0}' +
      '.dshwf-check{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-tertiary,#777);cursor:pointer}'

    function ensureStyles() {
      if (stylesReady || typeof document === 'undefined' || !document.head) return
      if (document.querySelector('style[data-plugin-css="' + NAME + '"]')) {
        stylesReady = true
        return
      }
      const tag = document.createElement('style')
      tag.setAttribute('data-plugin-css', NAME)
      tag.textContent = CSS
      document.head.appendChild(tag)
      stylesReady = true
    }

    async function request(path, body) {
      const init = {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      }
      if (body !== undefined) {
        init.method = 'POST'
        init.headers['content-type'] = 'application/json'
        init.body = JSON.stringify(body)
      }
      const response = await fetch(ROUTE + path, init)
      const text = await response.text()
      let payload = null
      try {
        payload = JSON.parse(text)
      } catch (error) {
        payload = null
      }
      if (!response.ok || payload === null || payload.ok !== true) {
        const message = payload && payload.error && payload.error.message ? payload.error.message : 'request failed with HTTP ' + response.status
        throw new Error(message)
      }
      return payload
    }

    function trimTrailingSlash(value) {
      if (typeof value !== 'string' || value.length === 0) return ''
      let end = value.length
      while (end > 1 && value.charAt(end - 1) === '/') end -= 1
      return value.slice(0, end)
    }

    function folderName(value) {
      if (typeof value !== 'string') return 'folder'
      const clean = trimTrailingSlash(value)
      const index = clean.lastIndexOf('/')
      const name = index >= 0 ? clean.slice(index + 1) : clean
      return name.length > 0 ? name : 'folder'
    }

    function findGroup(state, workspacePath) {
      if (state === null || state === undefined || !Array.isArray(state.workspaces)) return null
      const target = trimTrailingSlash(workspacePath)
      for (const workspace of state.workspaces) {
        if (trimTrailingSlash(workspace.path) === target) return workspace
      }
      return null
    }

    function stateNotice(data) {
      if (data === null || data === undefined) return ''
      if (data.sandboxIntegration === false) return 'Extra folder writes are unavailable: the DSH sandbox hook is not active.'
      if (data.platformSupported === false) return 'Extra folder writes are not supported on this platform.'
      return ''
    }

    const dialog = { value: null, listeners: new Set() }

    function setDialog(value) {
      dialog.value = value
      for (const listener of Array.from(dialog.listeners)) listener()
    }

    function openCreate(options) {
      const initialFolders = options && Array.isArray(options.folders) ? options.folders.slice() : []
      setDialog({ kind: 'create', initialFolders })
    }

    function openEdit(target) {
      setDialog({ kind: 'edit', workspacePath: target.path, displayTitle: target.displayTitle, workspaceId: target.workspaceId })
    }

    function closeDialog() {
      setDialog(null)
    }

    function useDialog() {
      const [value, setValue] = React.useState(dialog.value)
      React.useEffect(() => {
        const listener = () => setValue(dialog.value)
        dialog.listeners.add(listener)
        return () => dialog.listeners.delete(listener)
      }, [])
      return value
    }

    function FooterIcon() {
      return h(IconFolder, { size: 16 })
    }

    function MenuIcon() {
      return h(IconFolder, { size: 16 })
    }

    function FooterButton() {
      return h(
        'button',
        {
          type: 'button',
          className: 'dshwf-footer',
          title: 'New workspace',
          'aria-label': 'New workspace',
          onClick: () => openCreate(),
        },
        h(FooterIcon),
      )
    }

    function OutlineButton(props) {
      return h(
        Button,
        {
          variant: 'outline',
          size: props.size === 'sm' ? 'sm' : 'md',
          disabled: props.disabled === true,
          onClick: props.onClick,
          icon: props.icon,
          title: props.title,
          'aria-label': props['aria-label'],
          className: props.className,
        },
        props.children,
      )
    }

    function PrimaryButton(props) {
      return h(
        Button,
        {
          variant: 'primary',
          disabled: props.disabled === true,
          onClick: props.onClick,
          icon: props.icon,
          title: props.title,
          'aria-label': props['aria-label'],
          className: props.className,
        },
        props.children,
      )
    }

    function Field(props) {
      return h(
        'div',
        { className: 'dshwf-field' },
        h('span', { className: 'dshwf-label' }, props.label),
        props.children,
        props.hint ? h('p', { className: 'dshwf-hint' }, props.hint) : null,
      )
    }

    function FolderRows(props) {
      const members = props.members
      if (members.length === 0) {
        return h('div', { className: 'dshwf-empty' }, props.emptyText)
      }
      return h(
        'div',
        { className: 'dshwf-list' },
        members.map((member) =>
          h(
            'div',
            { className: 'dshwf-folder', key: member.path },
            h('span', { className: 'dshwf-folder-icon' }, h(IconFolder, { size: 16 })),
            h(
              'div',
              { className: 'dshwf-folder-main' },
              h('div', { className: 'dshwf-folder-name' }, member.name),
              h('div', { className: 'dshwf-folder-path', title: member.path }, member.path),
            ),
            member.missing ? h('span', { className: 'dshwf-badge' }, 'missing') : null,
            h(
              'button',
              {
                type: 'button',
                className: 'dshwf-icon-btn',
                title: 'Remove',
                'aria-label': 'Remove ' + member.name,
                disabled: props.busy === true,
                onClick: () => props.onRemove(member),
              },
              h(IconClose, { size: 14 }),
            ),
          ),
        ),
      )
    }

    function FolderBrowser(props) {
      const [path, setPath] = React.useState(undefined)
      const [listing, setListing] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState('')
      const [showHidden, setShowHidden] = React.useState(false)
      const [newName, setNewName] = React.useState('')
      const [busy, setBusy] = React.useState(false)

      React.useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setError('')
        runtime.ctx.uiWorkspace
          .listDirectory(path, controller.signal)
          .then((result) => {
            if (controller.signal.aborted) return
            setListing(result)
            setLoading(false)
          })
          .catch((reason) => {
            if (controller.signal.aborted) return
            setError(reason && reason.message ? reason.message : String(reason))
            setLoading(false)
          })
        return () => controller.abort()
      }, [path])

      async function createChild() {
        const name = newName.trim()
        if (name.length === 0 || listing === null) return
        setBusy(true)
        setError('')
        try {
          const created = await runtime.ctx.uiWorkspace.createDirectory(listing.path, name)
          setNewName('')
          setPath(created)
        } catch (reason) {
          setError(reason && reason.message ? reason.message : String(reason))
        } finally {
          setBusy(false)
        }
      }

      const entries = listing === null ? [] : listing.entries.filter((entry) => showHidden || entry.hidden !== true)
      const crumbs = listing === null ? [] : listing.crumbs

      return h(
        'div',
        { className: 'dshwf-body' },
        h(
          'div',
          { className: 'dshwf-crumbs' },
          crumbs.map((crumb, index) =>
            h(
              'span',
              { key: crumb.path },
              index > 0 ? h('span', { className: 'dshwf-crumb-sep' }, '/') : null,
              h('button', { type: 'button', className: 'dshwf-crumb', onClick: () => setPath(crumb.path), title: crumb.path }, crumb.name),
            ),
          ),
        ),
        loading ? h('div', { className: 'dshwf-hint' }, 'Loading...') : null,
        error.length > 0 ? h('div', { className: 'dshwf-error' }, error) : null,
        h(
          'div',
          { className: 'dshwf-browse-list' },
          entries.length === 0 && loading === false
            ? h('div', { className: 'dshwf-empty' }, 'No subfolders')
            : entries.map((entry) =>
                h(
                  'button',
                  { key: entry.path, type: 'button', className: 'dshwf-entry', onClick: () => setPath(entry.path) },
                  h('span', { className: 'dshwf-folder-icon' }, h(IconFolder, { size: 16 })),
                  h('span', { className: 'dshwf-entry-name' }, entry.name),
                ),
              ),
        ),
        h(
          'div',
          { className: 'dshwf-browse-actions' },
          h('label', { className: 'dshwf-check' }, h('input', { type: 'checkbox', checked: showHidden, onChange: (event) => setShowHidden(event.target.checked) }), 'Show hidden'),
          h(Input, {
            className: 'dshwf-input',
            placeholder: 'New folder name',
            value: newName,
            onChange: (event) => setNewName(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') createChild()
            },
          }),
          h(OutlineButton, { size: 'sm', disabled: busy || newName.trim().length === 0, onClick: createChild }, 'New folder'),
        ),
        h(
          'div',
          { className: 'dshwf-modal-footer' },
          h(OutlineButton, { onClick: props.onClose }, 'Back'),
          h('div', { className: 'dshwf-spacer' }),
          h(PrimaryButton, { disabled: listing === null, onClick: () => props.onPick(listing.path) }, 'Select'),
        ),
      )
    }

    function workspaceRows() {
      const list = runtime.ctx.workspaces.list.getSnapshot()
      if (!list || list.phase !== 'ready' || !Array.isArray(list.items)) return null
      return list.items
    }

    function knownWorkspacePaths() {
      const rows = workspaceRows()
      if (rows === null) return null
      return new Set(rows.map((row) => trimTrailingSlash(row.path)))
    }

    function orphanGroups(data) {
      const known = knownWorkspacePaths()
      if (known === null || !data || !Array.isArray(data.workspaces)) return []
      return data.workspaces.filter((group) => !known.has(trimTrailingSlash(group.path)))
    }

    async function archiveSessionsForPath(ctx, target, memberIds) {
      const sessions = ctx.sessions.list.getSnapshot()
      if (!sessions || sessions.phase !== 'ready' || !Array.isArray(sessions.ids)) {
        throw new Error('Sessions are still loading; try again')
      }
      const archived = new Set(ctx.workspaces.list.getSnapshot().archivedSessionIds || [])
      const targets = new Set(Array.isArray(memberIds) ? memberIds : [])
      for (const sessionId of sessions.ids) {
        const summary = sessions.byId[sessionId]
        if (summary && typeof summary.cwd === 'string' && trimTrailingSlash(summary.cwd) === trimTrailingSlash(target)) targets.add(sessionId)
      }
      for (const sessionId of targets) {
        if (archived.has(sessionId)) continue
        try {
          await ctx.workspaces.archiveSession(sessionId, { stopActivity: true })
        } catch (error) {
          console.error('[' + NAME + '] cannot archive session ' + sessionId + ': ' + (error && error.message ? error.message : String(error)))
        }
      }
    }

    function installWorkspaceDeleteHook(ctx) {
      let proxy
      try {
        proxy = ctx.get('workspaces')
      } catch (error) {
        return null
      }
      if (proxy === undefined || proxy === null) return null
      const raw = proxy[Symbol.for('cordis.original')] === undefined ? proxy : proxy[Symbol.for('cordis.original')]
      if (typeof raw.delete !== 'function') return null
      const originalDelete = raw.delete
      const wrapped = async function (workspaceId) {
        const list = raw.list.getSnapshot()
        const row = list && list.phase === 'ready' && Array.isArray(list.items) ? list.items.find((item) => item.workspaceId === workspaceId) : undefined
        if (row === undefined) return originalDelete.call(this, workspaceId)
        let state
        try {
          state = await request('/state')
        } catch (error) {
          state = null
        }
        const group = state === null ? null : findGroup(state, row.path)
        await archiveSessionsForPath(ctx, row.path, row.sessionIds)
        const result = await originalDelete.call(this, workspaceId)
        if (group === null) return result
        try {
          await request('/destroy', { workspacePath: group.path })
        } catch (error) {
          console.error('[' + NAME + '] workspace deleted but its attachments were not removed: ' + (error && error.message ? error.message : String(error)))
        }
        return result
      }
      raw.delete = wrapped
      return () => {
        if (raw.delete === wrapped) delete raw.delete
      }
    }

    function DialogHost(props) {
      const entry = props.entry
      const [load, setLoad] = React.useState({ phase: 'loading', data: null })
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [group, setGroup] = React.useState(null)
      const [folders, setFolders] = React.useState(entry.initialFolders || [])
      const [title, setTitle] = React.useState(
        entry.kind === 'create' && Array.isArray(entry.initialFolders) && entry.initialFolders.length > 0 ? folderName(entry.initialFolders[0]) : '',
      )
      const titleEdited = React.useRef(false)
      const [browsing, setBrowsing] = React.useState(false)
      const [confirmDelete, setConfirmDelete] = React.useState(false)
      const [orphans, setOrphans] = React.useState([])

      React.useEffect(() => {
        let alive = true
        request('/state').then(
          (data) => {
            if (!alive) return
            setLoad({ phase: 'ready', data })
            if (typeof data.storeError === 'string' && data.storeError.length > 0) setError('Workspace store: ' + data.storeError)
          },
          (reason) => {
            if (!alive) return
            setLoad({ phase: 'error', data: null })
            setError(reason && reason.message ? reason.message : String(reason))
          },
        )
        return () => {
          alive = false
        }
      }, [])

      React.useEffect(() => {
        if (entry.kind !== 'edit' || load.phase !== 'ready') return
        const found = findGroup(load.data, entry.workspacePath)
        if (found === null) setGroup({ path: entry.workspacePath, members: [], known: false })
        else setGroup({ ...found, known: true })
      }, [entry.kind, entry.workspacePath, load.phase])

      React.useEffect(() => {
        if (load.phase !== 'ready') return
        const apply = () => setOrphans(orphanGroups(load.data))
        apply()
        const list = runtime.ctx.workspaces.list
        if (list && typeof list.subscribe === 'function') return list.subscribe(apply)
        return undefined
      }, [load])

      function addPickedFolder(picked) {
        if (typeof picked !== 'string' || picked.length === 0) return
        if (entry.kind === 'create') {
          if (folders.includes(picked)) return
          const next = folders.concat([picked])
          setFolders(next)
          if (titleEdited.current === false) setTitle(folderName(next[0]))
          return
        }
        if (group !== null && group.members.some((member) => member.path === picked)) {
          setError('Folder is already attached')
          return
        }
        attachFolders([picked])
      }

      async function pickFolder() {
        try {
          const picked = await runtime.ctx.uiWorkspace.pickDirectory()
          if (typeof picked === 'string' && picked.length > 0) addPickedFolder(picked)
        } catch (reason) {
          setBrowsing(true)
        }
      }

      function browsePicked(picked) {
        setBrowsing(false)
        addPickedFolder(picked)
      }

      async function attachFolders(paths) {
        if (group === null) return
        setBusy(true)
        setError('')
        try {
          const data = await request('/attach', { workspacePath: group.path, folders: paths })
          setGroup({ ...data.workspace, known: true })
        } catch (reason) {
          setError(reason && reason.message ? reason.message : String(reason))
        } finally {
          setBusy(false)
        }
      }

      async function detachFolder(member) {
        if (group === null) return
        setBusy(true)
        setError('')
        try {
          const data = await request('/detach', { workspacePath: group.path, folders: [member.path] })
          setGroup({ ...data.workspace, known: true })
        } catch (reason) {
          setError(reason && reason.message ? reason.message : String(reason))
        } finally {
          setBusy(false)
        }
      }

      async function removeMember(member) {
        if (entry.kind === 'create') {
          const next = folders.filter((folder) => folder !== member.path)
          setFolders(next)
          if (titleEdited.current === false) setTitle(next.length > 0 ? folderName(next[0]) : '')
          return
        }
        await detachFolder(member)
      }

      async function createWorkspace() {
        setBusy(true)
        setError('')
        try {
          if (folders.length === 0) throw new Error('Add at least one folder')
          const effectiveTitle = title.trim().length > 0 ? title.trim() : folderName(folders[0])
          const data = await request('/create', { folders, title: effectiveTitle })
          const workspace = await runtime.ctx.workspaces.create({ path: data.workspace.path })
          try {
            await runtime.ctx.workspaces.rename(workspace.workspaceId, effectiveTitle.length > 80 ? effectiveTitle.slice(0, 80) : effectiveTitle)
          } catch (renameError) {
            console.error('[' + NAME + '] cannot rename the workspace: ' + (renameError && renameError.message ? renameError.message : String(renameError)))
          }
          runtime.ctx.uiWorkspace.startSession(workspace.workspaceId)
          closeDialog()
        } catch (reason) {
          setError(reason && reason.message ? reason.message : String(reason))
        } finally {
          setBusy(false)
        }
      }

      async function deleteWorkspace() {
        if (group === null || group.known !== true) return
        setBusy(true)
        setError('')
        try {
          if (typeof entry.workspaceId !== 'string') throw new Error('Workspace identity is unavailable; reload the page')
          await runtime.ctx.workspaces.delete(entry.workspaceId)
          closeDialog()
        } catch (reason) {
          setError(reason && reason.message ? reason.message : String(reason))
        } finally {
          setBusy(false)
        }
      }

      async function cleanOrphan(orphan) {
        setBusy(true)
        setError('')
        try {
          await archiveSessionsForPath(runtime.ctx, orphan.path)
          await request('/destroy', { workspacePath: orphan.path })
          const data = await request('/state')
          setLoad({ phase: 'ready', data })
          setOrphans((previous) => previous.filter((group) => group.path !== orphan.path))
        } catch (reason) {
          setError(reason && reason.message ? reason.message : String(reason))
        } finally {
          setBusy(false)
        }
      }

      const isCreate = entry.kind === 'create'
      const notice = load.phase === 'ready' ? stateNotice(load.data) : ''
      const members = isCreate
        ? folders.map((folder) => ({ name: folderName(folder), path: folder, missing: false }))
        : group === null
          ? []
          : group.members
      let body
      if (browsing) {
        body = h(FolderBrowser, { onPick: browsePicked, onClose: () => setBrowsing(false) })
      } else if (isCreate) {
        body = h(
          'div',
          { className: 'dshwf-body' },
          notice.length > 0 ? h('div', { className: 'dshwf-warning' }, notice) : null,
          h(
            Field,
            { label: 'Name' },
            h(Input, {
              className: 'dshwf-input',
              placeholder: folders.length > 0 ? folderName(folders[0]) : 'Workspace',
              value: title,
              autoFocus: true,
              maxLength: 80,
              onChange: (event) => {
                titleEdited.current = true
                setTitle(event.target.value)
              },
            }),
          ),
          h(
            Field,
            { label: 'Folders' },
            h(FolderRows, {
              members,
              busy,
              emptyText: 'No folders yet',
              onRemove: removeMember,
            }),
          ),
          h(
            'div',
            { className: 'dshwf-row' },
            h(OutlineButton, { size: 'sm', icon: h(IconPlus, { size: 14 }), onClick: pickFolder, disabled: busy }, 'Add folder'),
          ),
          orphans.length > 0
            ? h(
                Field,
                { label: 'Unused workspaces' },
                h(
                  'div',
                  { className: 'dshwf-list' },
                  orphans.map((orphan) =>
                    h(
                      'div',
                      { className: 'dshwf-folder', key: orphan.path },
                      h('span', { className: 'dshwf-folder-icon' }, h(IconFolder, { size: 16 })),
                      h(
                        'div',
                        { className: 'dshwf-folder-main' },
                        h('div', { className: 'dshwf-folder-name' }, orphan.title || folderName(orphan.path)),
                        h('div', { className: 'dshwf-folder-path', title: orphan.path }, orphan.path),
                      ),
                      h(OutlineButton, { size: 'sm', disabled: busy, onClick: () => cleanOrphan(orphan) }, 'Clean up'),
                    ),
                  ),
                ),
              )
            : null,
          error.length > 0 ? h('div', { className: 'dshwf-error' }, error) : null,
        )
      } else {
        body = h(
          'div',
          { className: 'dshwf-body' },
          notice.length > 0 ? h('div', { className: 'dshwf-warning' }, notice) : null,
          confirmDelete && group !== null && group.known === true
            ? h('div', { className: 'dshwf-warning' }, 'Sessions will be archived. Folders on disk are not touched.')
            : null,
          h(FolderRows, {
            members,
            busy,
            emptyText: group === null ? 'Loading...' : 'No folders',
            onRemove: removeMember,
          }),
          h(
            'div',
            { className: 'dshwf-row' },
            h(OutlineButton, { size: 'sm', icon: h(IconPlus, { size: 14 }), onClick: pickFolder, disabled: busy || group === null }, 'Add folder'),
          ),
          error.length > 0 ? h('div', { className: 'dshwf-error' }, error) : null,
        )
      }

      let footer
      if (browsing === false) {
        const buttons = []
        if (confirmDelete && !isCreate) {
          buttons.push(h(OutlineButton, { key: 'cancel-delete', onClick: () => setConfirmDelete(false), disabled: busy }, 'Cancel'))
          buttons.push(h('div', { className: 'dshwf-spacer', key: 'spacer' }))
          buttons.push(h(OutlineButton, { key: 'delete', className: 'dshwf-danger', onClick: deleteWorkspace, disabled: busy }, 'Delete workspace'))
        } else {
          if (!isCreate && group !== null && group.known === true) {
            buttons.push(h(OutlineButton, { key: 'request-delete', className: 'dshwf-danger', onClick: () => setConfirmDelete(true), disabled: busy }, 'Delete workspace'))
          }
          buttons.push(h('div', { className: 'dshwf-spacer', key: 'spacer' }))
          buttons.push(
            isCreate
              ? h(OutlineButton, { key: 'cancel', onClick: closeDialog, disabled: busy }, 'Cancel')
              : h(OutlineButton, { key: 'close', onClick: closeDialog, disabled: busy }, 'Close'),
          )
          if (isCreate) {
            buttons.push(h(PrimaryButton, { key: 'create', onClick: createWorkspace, disabled: busy || load.phase !== 'ready' || folders.length === 0 }, busy ? 'Creating...' : 'Create workspace'))
          }
        }
        footer = h('div', { className: 'dshwf-modal-footer' }, buttons)
      }

      return h(
        Modal,
        {
          open: true,
          onClose: () => {
            if (busy) return
            if (browsing) {
              setBrowsing(false)
              return
            }
            if (confirmDelete) {
              setConfirmDelete(false)
              return
            }
            closeDialog()
          },
          title: isCreate ? 'New workspace' : entry.displayTitle || 'Workspace folders',
          className: 'dshwf-modal',
          footer,
        },
        body,
      )
    }

    function DialogOverlay() {
      const entry = useDialog()
      if (entry === null) return null
      return h(DialogHost, { entry, key: entry.kind + ':' + (entry.workspacePath || '') })
    }

    function apply(ctx) {
      runtime.ctx = ctx
      ensureStyles()
      try {
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register({ name: 'sidebar.footer.action', id: NAME + '.new', order: 100 }, FooterButton),
        )
      } catch (error) {
        console.error('[' + NAME + '] footer action: ' + (error && error.message ? error.message : String(error)))
      }
      try {
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: NAME + '.dialog' }, DialogOverlay),
        )
      } catch (error) {
        console.error('[' + NAME + '] dialog overlay: ' + (error && error.message ? error.message : String(error)))
      }
      try {
        ctx.slots.inject('contextMenu.icon', () =>
          ctx.slots.register({ name: 'contextMenu.icon', key: NAME + '.folders' }, MenuIcon),
        )
      } catch (error) {
        console.error('[' + NAME + '] menu icon: ' + (error && error.message ? error.message : String(error)))
      }
      try {
        ctx.effect(
          () =>
            ctx.contextMenus.register({
              id: NAME + '.manage',
              target: 'workspace',
              order: 250,
              resolve: (target) => [
                {
                  id: 'folders',
                  label: 'Workspace folders...',
                  icon: { key: NAME + '.folders' },
                  run: () => openEdit(target),
                },
              ],
            }),
          NAME + ': workspace menu',
        )
      } catch (error) {
        console.error('[' + NAME + '] context menu: ' + (error && error.message ? error.message : String(error)))
      }
      try {
        const dispose = installWorkspaceDeleteHook(ctx)
        if (typeof dispose === 'function') ctx.effect(() => dispose, NAME + ': workspace delete hook')
      } catch (error) {
        console.error('[' + NAME + '] delete hook: ' + (error && error.message ? error.message : String(error)))
      }
    }

    const inject = ['slots', 'contextMenus', 'uiWorkspace', 'workspaces', 'sessions']

    const __test = {
      trimTrailingSlash,
      folderName,
      findGroup,
      stateNotice,
      openCreate,
      openEdit,
      closeDialog,
      dialog,
    }

    return { apply, inject, __test }
  },
})
