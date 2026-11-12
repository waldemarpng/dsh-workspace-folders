import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'

export function tempDir(prefix = 'dshwf-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

export function makeDir(base, name) {
  const dir = path.join(base, name)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
}

export function makeRequest(method, body, headers, url = '/') {
  const chunks = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]
  const req = Readable.from(chunks)
  req.method = method
  req.url = url
  req.headers = {
    host: '127.0.0.1:1234',
    origin: 'http://127.0.0.1:1234',
    'sec-fetch-site': 'same-origin',
    ...(headers || {}),
  }
  return req
}

export function makeResponse() {
  const res = {
    statusCode: 0,
    headers: null,
    body: '',
    writeHead(code, headers) {
      this.statusCode = code
      this.headers = headers
      return this
    },
    end(chunk) {
      if (chunk !== undefined) this.body += String(chunk)
      return this
    },
  }
  return res
}

export function bodyOf(res) {
  return JSON.parse(res.body)
}

export function tempStore(fileName = 'store.json') {
  const dir = tempDir()
  return { dir, file: path.join(dir, fileName) }
}
