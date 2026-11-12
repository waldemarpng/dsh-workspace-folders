import fs from 'node:fs'

export function availableFolders(group, onSkip) {
  const available = []
  for (const member of group.members) {
    let ok = false
    try {
      const physical = fs.realpathSync.native(member.path)
      ok = physical === member.path && fs.statSync(physical).isDirectory()
    } catch (error) {
      ok = false
    }
    if (ok) {
      available.push(member.path)
    } else if (typeof onSkip === 'function') {
      onSkip(member.path)
    }
  }
  return available
}

export function writableRoots(group, available, sessionRoot) {
  if (group.anchored === true && available.length > 0) {
    return { workspaceRoot: available[0], additional: available.slice(1) }
  }
  return { workspaceRoot: sessionRoot, additional: available }
}
