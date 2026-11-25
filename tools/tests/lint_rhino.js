// Checks the KubeJS scripts against the Rhino rules in CLAUDE.md ("KubeJS 6 / Rhino script style").
//   node lint_rhino.js            every script under tools/kubejs/{server,startup,client}_scripts
//   node lint_rhino.js <file>...  just those files
// Errors (exit 1):
//   - const inside a nested block (if, for, while, switch, try, a bare block): Rhino mis-scopes it
//   - a name declared twice in one function where either declaration is const
//   - template strings, spread syntax, Math.PI
//   - a server script that is not wrapped in an IIFE
// Warnings (shown, exit 0):
//   - a function made inside a for/while loop that reads a variable declared by that loop
//     (Rhino keeps one copy of it for every pass, so a scheduled callback sees the last value; use forEach)
const fs = require('fs'), path = require('path')
let acorn
try { acorn = require('acorn') } catch (e) {
  console.error('acorn is missing: run "npm install" in tools/tests first.')
  process.exit(2)
}
const paths = require('./lib/paths')

// Older live-server scripts written before the IIFE rule. They are reported as warnings, not errors.
// Wrap one in an IIFE and take it off this list; every other server script must already be wrapped.
const LEGACY_NO_IIFE = ['limit_balance.js', 'ministry_broadcasts.js', 'protected_areas.js']

function listScripts() {
  const out = []
  ;['server_scripts', 'startup_scripts', 'client_scripts'].forEach(dir => {
    const walk = d => {
      if (!fs.existsSync(d)) return
      fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.js$/.test(e.name)) out.push(p)
      })
    }
    walk(paths.kubejs(dir))
  })
  return out.sort()
}

function lintFile(file) {
  const errors = [], warnings = []
  const src = fs.readFileSync(file, 'utf8')
  let ast
  try {
    ast = acorn.parse(src, { ecmaVersion: 2020, locations: true, allowReturnOutsideFunction: true })
  } catch (e) {
    errors.push('line ' + (e.loc ? e.loc.line : '?') + ': does not parse: ' + e.message)
    return { errors, warnings }
  }
  const isLoop = t => /^(For|ForIn|ForOf|While|DoWhile)Statement$/.test(t)
  const children = node => {
    const out = []
    Object.keys(node).forEach(k => {
      if (k == 'loc') return
      const v = node[k]
      if (Array.isArray(v)) v.forEach(c => { if (c && typeof c.type == 'string') out.push(c) })
      else if (v && typeof v.type == 'string') out.push(v)
    })
    return out
  }
  // Names declared by a node and its children, without going into nested functions.
  const declaredIn = (node, into) => {
    if (!node || typeof node.type != 'string') return into
    if (/Function/.test(node.type)) return into
    if (node.type == 'VariableDeclaration') node.declarations.forEach(d => { if (d.id.type == 'Identifier') into.add(d.id.name) })
    children(node).forEach(c => declaredIn(c, into))
    return into
  }
  // Names a function reads that it does not declare itself.
  const freeNames = fn => {
    const own = new Set()
    ;(fn.params || []).forEach(p => { if (p.type == 'Identifier') own.add(p.name) })
    const used = new Set()
    const walk = (node, parent, key) => {
      if (!node || typeof node.type != 'string') return
      if (node.type == 'VariableDeclarator' && node.id.type == 'Identifier') own.add(node.id.name)
      if (node !== fn && /Function/.test(node.type)) (node.params || []).forEach(p => { if (p.type == 'Identifier') own.add(p.name) })
      if (node.type == 'Identifier') {
        const isProp = parent && ((parent.type == 'MemberExpression' && key == 'property' && !parent.computed) ||
          (parent.type == 'Property' && key == 'key' && !parent.computed))
        if (!isProp) used.add(node.name)
      }
      Object.keys(node).forEach(k => {
        if (k == 'loc') return
        const v = node[k]
        if (Array.isArray(v)) v.forEach(c => walk(c, node, k))
        else if (v && typeof v.type == 'string') walk(v, node, k)
      })
    }
    walk(fn.body, fn, 'body')
    return Array.from(used).filter(n => !own.has(n))
  }

  // Callbacks that array methods run on the spot: they can't see a later pass of the loop.
  const SYNC_METHODS = ['some', 'every', 'filter', 'map', 'find', 'findIndex', 'forEach', 'reduce', 'sort']
  const syncCallbacks = new Set()

  // const scoping and redeclaration, one function at a time (the whole file counts as one function)
  function scanFunction(fnNode, outerLoopNames) {
    const body = fnNode.body && fnNode.body.type == 'BlockStatement' ? fnNode.body : null
    const seen = {}
    ;(fnNode.params || []).forEach(p => { if (p.type == 'Identifier') seen[p.name] = 'param' })
    function visit(node, nested, loopNames) {
      if (!node || typeof node.type != 'string') return
      if (node !== fnNode && /Function/.test(node.type)) {
        if (loopNames.size && !syncCallbacks.has(node)) {
          const caught = freeNames(node).filter(n => loopNames.has(n))
          if (caught.length) warnings.push('line ' + node.loc.start.line + ': a function made in a loop reads ' + caught.join(', ') +
            ' from the loop (Rhino keeps one copy for every pass; if it runs later, e.g. scheduled, use forEach)')
        }
        scanFunction(node, loopNames)
        return
      }
      if (node.type == 'VariableDeclaration') {
        node.declarations.forEach(d => {
          if (d.id.type != 'Identifier') return
          const n = d.id.name
          if (node.kind == 'const' && nested > 0) errors.push('line ' + node.loc.start.line + ': const ' + n + ' inside a nested block (use let)')
          if (seen[n] && (node.kind == 'const' || seen[n] == 'const')) errors.push('line ' + node.loc.start.line + ': ' + n + ' declared again (' + node.kind + ' after ' + seen[n] + ')')
          seen[n] = node.kind
        })
      }
      if (node.type == 'TemplateLiteral') errors.push('line ' + node.loc.start.line + ': template string (join with +)')
      if (node.type == 'SpreadElement' || node.type == 'RestElement') errors.push('line ' + node.loc.start.line + ': spread/rest syntax')
      if (node.type == 'MemberExpression' && !node.computed && node.object.type == 'Identifier' && node.object.name == 'Math' && node.property.name == 'PI')
        errors.push('line ' + node.loc.start.line + ': Math.PI (write the number out)')
      if (node.type == 'CallExpression' && node.callee.type == 'MemberExpression' && !node.callee.computed &&
        SYNC_METHODS.indexOf(node.callee.property.name) >= 0) node.arguments.forEach(a => { if (/Function/.test(a.type)) syncCallbacks.add(a) })
      const nest = (node.type == 'BlockStatement' && node !== body) || /^(For|ForIn|ForOf|While|DoWhile|If|Switch|Try)Statement$/.test(node.type) ? 1 : 0
      let inner = loopNames
      if (isLoop(node.type)) {
        inner = new Set(loopNames)
        declaredIn(node, inner)                       // the loop variable and everything declared in the body
      }
      children(node).forEach(c => visit(c, nested + nest, inner))
    }
    visit(body || fnNode.body, 0, new Set())
  }
  scanFunction({ type: 'Program', params: [], body: { type: 'BlockStatement', body: ast.body } })

  // server scripts: the code sits in an IIFE (comments and 'priority' lines may come first)
  if (/[\\/]server_scripts[\\/]/.test(file)) {
    const stmts = ast.body.filter(s => s.type != 'EmptyStatement' && !(s.type == 'ExpressionStatement' && s.expression.type == 'Literal'))
    const legacy = LEGACY_NO_IIFE.indexOf(path.basename(file)) >= 0 ? warnings : errors
    const isIife = s => {
      if (s.type != 'ExpressionStatement') return false
      let e = s.expression
      if (e.type == 'UnaryExpression') e = e.argument
      return e.type == 'CallExpression' && /Function/.test(e.callee.type)
    }
    const outside = stmts.filter(s => !isIife(s))
    if (!stmts.some(isIife)) legacy.push('not wrapped in an IIFE: (function () { ... })()' + (legacy === warnings ? ' (legacy script)' : ''))
    else if (outside.length) legacy.push('line ' + outside[0].loc.start.line + ': code outside the IIFE')
  }
  return { errors, warnings }
}

const files = process.argv.slice(2).length ? process.argv.slice(2).map(f => path.resolve(f)) : listScripts()
let nErr = 0, nWarn = 0
files.forEach(f => {
  const r = lintFile(f)
  const rel = path.relative(paths.ROOT, f).split(path.sep).join('/')
  r.errors.forEach(m => { console.log('ERROR ' + rel + ' ' + m); nErr++ })
  r.warnings.forEach(m => { console.log('warn  ' + rel + ' ' + m); nWarn++ })
})
console.log('lint: ' + files.length + ' scripts, ' + nErr + ' errors, ' + nWarn + ' warnings')
process.exit(nErr ? 1 : 0)
