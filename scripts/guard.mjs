import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIRS = ['lib', 'test', 'scripts', 'docs']
const SINGLE_FILES = ['package.json', 'cordis.patch.yml']
const SLASH = String.fromCharCode(47)
const BACKSLASH = String.fromCharCode(92)
const BACKTICK = String.fromCharCode(96)
const STAR = String.fromCharCode(42)
const STRING_RE = new RegExp("'[^']*'|\"[^\"]*\"|" + BACKTICK + '[^' + BACKTICK + ']*' + BACKTICK, 'g')
const ESCAPED_SLASH_RE = new RegExp(BACKSLASH + SLASH + '+', 'g')
const URL_RE = new RegExp('https?:' + SLASH + SLASH, 'g')
const COMMENT_RE = new RegExp(SLASH + SLASH + '|' + SLASH + BACKSLASH + STAR)
const NON_ASCII_RE = /[^\x00-\x7F]/

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile()) out.push(full)
  }
}

const files = []
for (const dir of DIRS) {
  const full = path.join(ROOT, dir)
  if (fs.existsSync(full)) walk(full, files)
}
for (const name of SINGLE_FILES) {
  const full = path.join(ROOT, name)
  if (fs.existsSync(full)) files.push(full)
}

const violations = []
for (const file of files) {
  const rel = path.relative(ROOT, file)
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    if (rel.endsWith('.svg')) return
    if (NON_ASCII_RE.test(line)) {
      violations.push(rel + ':' + (index + 1) + ' non-ascii characters in code')
      return
    }
    const stripped = line.replace(STRING_RE, '').replace(ESCAPED_SLASH_RE, '').replace(URL_RE, '')
    if (COMMENT_RE.test(stripped)) {
      violations.push(rel + ':' + (index + 1) + ' comment marker')
    }
  })
}

if (violations.length > 0) {
  for (const violation of violations) console.error('guard: ' + violation)
  process.exit(1)
}
console.log('guard ok: ' + files.length + ' files checked, no comments, ascii only')
