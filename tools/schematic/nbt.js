// Minimal NBT reader and writer for Node (no dependencies). Big-endian, gzip or raw.
//   read(buffer) -> { name, value }: compounds as objects, lists as arrays, numbers as numbers (longs as BigInt),
//     byte/int/long arrays as typed arrays.
//   readTyped(buffer) -> { name, value } with every value tagged as write takes it (an exact copy).
//   write(name, tagged) -> gzipped Buffer, where tagged values say their type: T.int(5), T.string('x'),
//     T.list('int', [T.int(1), ...]), T.compound({ k: tagged, ... }), and so on.
const zlib = require('zlib')

const ID = { end: 0, byte: 1, short: 2, int: 3, long: 4, float: 5, double: 6, byteArray: 7, string: 8, list: 9, compound: 10, intArray: 11, longArray: 12 }

function read(buf) {
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf)
  let p = 0
  const u8 = () => buf.readUInt8(p++)
  const i8 = () => buf.readInt8(p++)
  const i16 = () => { const v = buf.readInt16BE(p); p += 2; return v }
  const u16 = () => { const v = buf.readUInt16BE(p); p += 2; return v }
  const i32 = () => { const v = buf.readInt32BE(p); p += 4; return v }
  const i64 = () => { const v = buf.readBigInt64BE(p); p += 8; return v }
  const str = () => { const n = u16(); const s = buf.toString('utf8', p, p + n); p += n; return s }
  function payload(t) {
    switch (t) {
      case 1: return i8()
      case 2: return i16()
      case 3: return i32()
      case 4: return i64()
      case 5: { const v = buf.readFloatBE(p); p += 4; return v }
      case 6: { const v = buf.readDoubleBE(p); p += 8; return v }
      case 7: { const n = i32(); const a = new Int8Array(n); for (let i = 0; i < n; i++) a[i] = i8(); return a }
      case 8: return str()
      case 9: { const et = u8(), n = i32(), a = []; for (let i = 0; i < n; i++) a.push(payload(et)); return a }
      case 10: { const o = {}; for (;;) { const tt = u8(); if (tt === 0) return o; const k = str(); o[k] = payload(tt) } }
      case 11: { const n = i32(), a = new Int32Array(n); for (let i = 0; i < n; i++) a[i] = i32(); return a }
      case 12: { const n = i32(), a = new BigInt64Array(n); for (let i = 0; i < n; i++) a[i] = i64(); return a }
      default: throw new Error('bad NBT tag type ' + t + ' at byte ' + p)
    }
  }
  const t = u8()
  return { name: str(), value: payload(t) }
}

// Like read, but every value keeps its tag type, in the form write takes (T.int(5), T.list('string', [...]) ...), so
// NBT can be copied from one file to another exactly (a player head's skin, a lectern's book).
function readTyped(buf) {
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf)
  let p = 0
  const NAMES = ['end', 'byte', 'short', 'int', 'long', 'float', 'double', 'byteArray', 'string', 'list', 'compound', 'intArray', 'longArray']
  const u8 = () => buf.readUInt8(p++)
  const i32 = () => { const v = buf.readInt32BE(p); p += 4; return v }
  const str = () => { const n = buf.readUInt16BE(p); p += 2; const s = buf.toString('utf8', p, p + n); p += n; return s }
  function payload(t) {
    switch (t) {
      case 1: return T.byte(buf.readInt8(p++))
      case 2: { const v = buf.readInt16BE(p); p += 2; return T.short(v) }
      case 3: return T.int(i32())
      case 4: { const v = buf.readBigInt64BE(p); p += 8; return T.long(v) }
      case 5: { const v = buf.readFloatBE(p); p += 4; return T.float(v) }
      case 6: { const v = buf.readDoubleBE(p); p += 8; return T.double(v) }
      case 7: { const n = i32(), a = []; for (let i = 0; i < n; i++) a.push(buf.readInt8(p++)); return T.byteArray(a) }
      case 8: return T.string(str())
      case 9: { const et = u8(), n = i32(), a = []; for (let i = 0; i < n; i++) a.push(payload(et)); return T.list(NAMES[et] === 'end' ? 'compound' : NAMES[et], a) }
      case 10: { const o = {}; for (;;) { const tt = u8(); if (tt === 0) return T.compound(o); const k = str(); o[k] = payload(tt) } }
      case 11: { const n = i32(), a = []; for (let i = 0; i < n; i++) a.push(i32()); return T.intArray(a) }
      case 12: { const n = i32(), a = []; for (let i = 0; i < n; i++) { a.push(buf.readBigInt64BE(p)); p += 8 } return T.longArray(a) }
      default: throw new Error('bad NBT tag type ' + t + ' at byte ' + p)
    }
  }
  const t = u8()
  return { name: str(), value: payload(t) }
}

// Sponge schematics keep block indexes as varints.
function varints(bytes) {
  const out = []
  let val = 0, shift = 0
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] & 0xff
    val |= (b & 0x7f) << shift
    if (b & 0x80) shift += 7
    else { out.push(val); val = 0; shift = 0 }
  }
  return out
}

const T = {
  byte: v => ({ t: 'byte', v }), short: v => ({ t: 'short', v }), int: v => ({ t: 'int', v }), long: v => ({ t: 'long', v }),
  float: v => ({ t: 'float', v }), double: v => ({ t: 'double', v }), string: v => ({ t: 'string', v }),
  list: (et, v) => ({ t: 'list', et, v }), compound: v => ({ t: 'compound', v }), intArray: v => ({ t: 'intArray', v }),
  byteArray: v => ({ t: 'byteArray', v }), longArray: v => ({ t: 'longArray', v }),
}

function write(name, root) {
  const parts = []
  const u8 = n => { const b = Buffer.alloc(1); b.writeUInt8(n); parts.push(b) }
  const num = (n, size, fn) => { const b = Buffer.alloc(size); b[fn](n); parts.push(b) }
  const str = s => { const b = Buffer.from(s, 'utf8'); num(b.length, 2, 'writeUInt16BE'); parts.push(b) }
  function payload(x) {
    switch (x.t) {
      case 'byte': return num(x.v, 1, 'writeInt8')
      case 'short': return num(x.v, 2, 'writeInt16BE')
      case 'int': return num(x.v, 4, 'writeInt32BE')
      case 'long': return num(BigInt(x.v), 8, 'writeBigInt64BE')
      case 'float': return num(x.v, 4, 'writeFloatBE')
      case 'double': return num(x.v, 8, 'writeDoubleBE')
      case 'string': return str(x.v)
      case 'list':
        u8(x.v.length ? ID[x.et] : 0)
        num(x.v.length, 4, 'writeInt32BE')
        return x.v.forEach(payload)
      case 'compound':
        Object.keys(x.v).forEach(k => { u8(ID[x.v[k].t]); str(k); payload(x.v[k]) })
        return u8(0)
      case 'intArray':
        num(x.v.length, 4, 'writeInt32BE')
        return x.v.forEach(n => num(n, 4, 'writeInt32BE'))
      case 'byteArray':
        num(x.v.length, 4, 'writeInt32BE')
        return x.v.forEach(n => num(n, 1, 'writeInt8'))
      case 'longArray':
        num(x.v.length, 4, 'writeInt32BE')
        return x.v.forEach(n => num(BigInt(n), 8, 'writeBigInt64BE'))
      default: throw new Error('unknown tag type ' + x.t)
    }
  }
  u8(ID[root.t]); str(name); payload(root)
  return zlib.gzipSync(Buffer.concat(parts))
}

module.exports = { read, readTyped, write, varints, T }
