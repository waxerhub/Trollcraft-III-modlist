// Loads part2/blood_pool.js and part2/potato_tree.js outside the game, with do-nothing stand-ins for KubeJS, and
// returns their APIs ({ BP: global.BloodPool, PT: global.PotatoTree }). Used by generate_quests.js and by
// tools/progression_audit.py (through dump_progression.js). Nothing here touches a server.
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const SCRIPTS = path.join(ROOT, 'tools', 'kubejs', 'server_scripts', 'part2')

function stub() {
  const f = function () { return stubObj }
  return new Proxy(f, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : stubObj), apply: () => stubObj })
}
const stubObj = stub()

module.exports = function loadScripts() {
  const globalObj = {}
  const names = ['ServerEvents', 'PlayerEvents', 'BlockEvents', 'ItemEvents', 'EntityEvents', 'Utils', 'Text', 'Item', 'JsonIO', 'Java', 'console', 'global']
  const quietConsole = { info() {}, warn() {}, error() {}, log() {} }
  ;['blood_pool.js', 'potato_tree.js'].forEach(file => {
    const src = fs.readFileSync(path.join(SCRIPTS, file), 'utf8')
    const args = [stubObj, stubObj, stubObj, stubObj, stubObj, { server: null }, stubObj, stubObj, stubObj,
      { loadClass: () => { throw new Error('no classes here') } }, quietConsole, globalObj]
    new Function(...names, src)(...args)
  })
  if (!globalObj.BloodPool || !globalObj.PotatoTree) throw new Error('could not load the scripts')
  return { BP: globalObj.BloodPool, PT: globalObj.PotatoTree }
}
