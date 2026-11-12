# Changelog

## 0.1.0

- Initial release: always-new multi-folder workspaces with an optional name, per-session writable roots through a guarded `sandboxPolicy.resolve` wrapper, a sidebar footer button and a **Workspace folders...** menu item, workspace deletion that archives sessions instead of leaving them in Ungrouped, and fenced local routes.
- `GET /dsh-workspace-folders/roots?cwd=...` reports the effective writable roots so the sandbox plan can be inspected and tested live.
- The dialog warns when the DSH sandbox hook is unavailable or the platform cannot grant extra roots.
- `npm run e2e` runs a live cycle against a running host: create, root resolution, attach, detach, destroy.
- `npm run test` includes a real-HTTP cycle over the same handlers the host mounts.
