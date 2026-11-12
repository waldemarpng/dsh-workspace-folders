export class WorkspaceFoldersError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = 'WorkspaceFoldersError'
    this.code = code
    this.details = details
  }
}

export function messageOf(error) {
  return error && error.message ? error.message : String(error)
}
