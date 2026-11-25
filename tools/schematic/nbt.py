# Minimal NBT reader/writer that keeps tag types, so a file can be read and written back exactly.
import struct
END, BYTE, SHORT, INT, LONG, FLOAT, DOUBLE, BYTE_ARRAY, STRING, LIST, COMPOUND, INT_ARRAY, LONG_ARRAY = range(13)

class Tag:
    __slots__ = ('type', 'value', 'elem')   # elem: element type for lists
    def __init__(self, t, v, elem=None):
        self.type, self.value, self.elem = t, v, elem
    def __repr__(self): return 'Tag(%d,%r)' % (self.type, self.value if self.type not in (BYTE_ARRAY, INT_ARRAY, LONG_ARRAY) else '<%d>' % len(self.value))

def read(buf):
    pos = 0
    def take(n):
        nonlocal pos
        b = buf[pos:pos + n]; pos += n
        if len(b) < n: raise ValueError('truncated')
        return b
    def rstr():
        (n,) = struct.unpack('>H', take(2)); return take(n).decode('utf-8', 'surrogatepass')
    def payload(t):
        if t == BYTE: return Tag(t, struct.unpack('>b', take(1))[0])
        if t == SHORT: return Tag(t, struct.unpack('>h', take(2))[0])
        if t == INT: return Tag(t, struct.unpack('>i', take(4))[0])
        if t == LONG: return Tag(t, struct.unpack('>q', take(8))[0])
        if t == FLOAT: return Tag(t, struct.unpack('>f', take(4))[0])
        if t == DOUBLE: return Tag(t, struct.unpack('>d', take(8))[0])
        if t == BYTE_ARRAY:
            (n,) = struct.unpack('>i', take(4)); return Tag(t, bytearray(take(n)))
        if t == STRING: return Tag(t, rstr())
        if t == LIST:
            sub, n = struct.unpack('>bi', take(5)); return Tag(t, [payload(sub) for _ in range(max(n, 0))], sub)
        if t == COMPOUND:
            d = {}
            while True:
                (ct,) = struct.unpack('>b', take(1))
                if ct == END: return Tag(t, d)
                k = rstr(); d[k] = payload(ct)
        if t == INT_ARRAY:
            (n,) = struct.unpack('>i', take(4)); return Tag(t, list(struct.unpack('>%di' % n, take(4 * n))))
        if t == LONG_ARRAY:
            (n,) = struct.unpack('>i', take(4)); return Tag(t, list(struct.unpack('>%dq' % n, take(8 * n))))
        raise ValueError('bad tag type %d' % t)
    (rt,) = struct.unpack('>b', take(1))
    name = rstr()
    return name, payload(rt)

def write(name, tag):
    out = bytearray()
    def wstr(s):
        b = s.encode('utf-8', 'surrogatepass'); out.extend(struct.pack('>H', len(b))); out.extend(b)
    def payload(t):
        ty, v = t.type, t.value
        if ty == BYTE: out.extend(struct.pack('>b', v))
        elif ty == SHORT: out.extend(struct.pack('>h', v))
        elif ty == INT: out.extend(struct.pack('>i', v))
        elif ty == LONG: out.extend(struct.pack('>q', v))
        elif ty == FLOAT: out.extend(struct.pack('>f', v))
        elif ty == DOUBLE: out.extend(struct.pack('>d', v))
        elif ty == BYTE_ARRAY: out.extend(struct.pack('>i', len(v))); out.extend(v)
        elif ty == STRING: wstr(v)
        elif ty == LIST:
            elem = t.elem if v == [] or t.elem is not None else v[0].type
            if v: elem = v[0].type
            out.extend(struct.pack('>bi', elem if elem is not None else END, len(v)))
            for x in v: payload(x)
        elif ty == COMPOUND:
            for k, x in v.items():
                out.extend(struct.pack('>b', x.type)); wstr(k); payload(x)
            out.extend(b'\x00')
        elif ty == INT_ARRAY: out.extend(struct.pack('>i', len(v))); out.extend(struct.pack('>%di' % len(v), *v))
        elif ty == LONG_ARRAY: out.extend(struct.pack('>i', len(v))); out.extend(struct.pack('>%dq' % len(v), *v))
    out.extend(struct.pack('>b', tag.type)); wstr(name); payload(tag)
    return bytes(out)

def show(tag, indent=0, maxlist=3, depth=3):
    pad = '  ' * indent
    if tag.type == COMPOUND:
        for k, v in tag.value.items():
            if v.type in (COMPOUND, LIST) and depth > 0:
                print(pad + k + (' {' if v.type == COMPOUND else ' [list of %d]' % len(v.value)))
                if v.type == COMPOUND: show(v, indent + 1, maxlist, depth - 1)
                else:
                    for x in v.value[:maxlist]:
                        if x.type == COMPOUND: print(pad + '  -'); show(x, indent + 2, maxlist, depth - 2)
                        else: print(pad + '  - ' + repr(x))
            else:
                print(pad + k + ' = ' + repr(v)[:120])
