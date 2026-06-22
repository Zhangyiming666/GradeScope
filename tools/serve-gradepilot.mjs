/* global console, process, URL */

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? 'dist')
const host = process.argv[3] ?? '127.0.0.1'
const port = Number(process.argv[4] ?? '5173')

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon']
])

function filePathForUrl(url = '/') {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname)
  const normalized = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '')
  const candidate = resolve(join(root, normalized))
  if (!candidate.startsWith(root)) {
    return resolve(root, 'index.html')
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate
  }

  return resolve(root, 'index.html')
}

createServer((request, response) => {
  const filePath = filePathForUrl(request.url)
  if (!existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('GradeScope build not found')
    return
  }

  response.writeHead(200, {
    'Content-Type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream',
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable'
  })
  createReadStream(filePath).pipe(response)
}).listen(port, host, () => {
  console.log(`GradeScope static server listening at http://${host}:${port}/`)
})
