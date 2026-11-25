// Repo paths, worked out from this file's location so the harness runs from any directory (and on Windows).
const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..', '..')
module.exports = {
  ROOT,
  repo: p => path.join(ROOT, p),
  kubejs: p => path.join(ROOT, 'tools', 'kubejs', p || ''),
  server: p => path.join(ROOT, 'tools', 'kubejs', 'server_scripts', p || ''),
}
