function snbt(src) {
  let i = 0
  const ws = () => { while (/\s/.test(src[i])) i++ }
  const val = () => {
    ws()
    if (src[i] == '{') { i++; const o = {}; ws(); if (src[i] == '}') { i++; return o }
      for (;;) { ws(); let k = src[i] == '"' || src[i] == "'" ? str() : src.slice(i).match(/^[A-Za-z0-9_.+-]+/)[0]; if (typeof k != 'string') throw 0; if (k == src.slice(i, i + k.length)) i += k.length
        ws(); if (src[i++] != ':') throw new Error('expected : at ' + i); o[k] = val(); ws(); if (src[i] == ',') { i++; continue } if (src[i++] != '}') throw new Error('expected } at ' + i); return o } }
    if (src[i] == '[') { i++; if (/^[BIL];/.test(src.slice(i, i + 2))) i += 2   // typed arrays: [I;1,2,3]
      const a = []; ws(); if (src[i] == ']') { i++; return a }
      for (;;) { a.push(val()); ws(); if (src[i] == ',') { i++; continue } if (src[i++] != ']') throw new Error('expected ] at ' + i); return a } }
    if (src[i] == '"' || src[i] == "'") return str()
    const m = src.slice(i).match(/^-?[0-9.]+[bsfdL]?|^[A-Za-z_][A-Za-z0-9_.:+-]*/)
    if (!m) throw new Error('bad value at ' + i + ': ' + src.slice(i, i + 20))
    i += m[0].length; return m[0]
  }
  const str = () => { const q = src[i++]; let out = ''; while (src[i] != q) { if (src[i] == '\\') i++; out += src[i++]; if (i > src.length) throw new Error('unterminated') } i++; return out }
  const v = val(); ws(); if (i != src.length) throw new Error('trailing at ' + i); return v
}
module.exports = snbt
