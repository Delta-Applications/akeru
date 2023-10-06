(function(e, t) {
    if ("object" == typeof exports) {
        module.exports = t(), this.Blob = require("./blob").Blob;
        var n = require("stringencoding");
        this.TextEncoder = n.TextEncoder, this.TextDecoder = n.TextDecoder;
    } else "function" == typeof define && define.amd ? define(t) : e.WBXML = t();
})(this, function() {
    function e(e, t, n) {
        function r() {
            var e = this instanceof r ? this : Object.create(r.prototype), t = Error(), i = 1;
            if (e.stack = t.stack.substring(t.stack.indexOf("\n") + 1), e.message = arguments[0] || t.message, 
            n) {
                i += n.length;
                for (var o = 0; o < n.length; o++) e[n[o]] = arguments[o + 1];
            }
            var s = /@(.+):(.+)/.exec(e.stack);
            return e.fileName = arguments[i] || s && s[1] || "", e.lineNumber = arguments[i + 1] || s && s[2] || 0, 
            e;
        }
        return r.prototype = Object.create((t || Error).prototype), r.prototype.name = e, 
        r.prototype.constructor = r, r;
    }
    function t(e, t) {
        this.strings = [], this.offsets = {};
        for (var n = 0, r = 0; r < e.length; r++) 0 === e[r] && (this.offsets[n] = this.strings.length, 
        this.strings.push(t.decode(e.subarray(n, r))), n = r + 1);
    }
    function n(e) {
        e.__nsnames__ = {}, e.__tagnames__ = {}, e.__attrdata__ = {};
        for (var t in e) {
            var n = e[t];
            if (!t.match(/^__/)) {
                if (n.Tags) {
                    var r, i;
                    for (r in n.Tags) {
                        i = n.Tags[r], e.__nsnames__[i >> 8] = t;
                        break;
                    }
                    for (r in n.Tags) i = n.Tags[r], e.__tagnames__[i] = r;
                }
                if (n.Attrs) for (var o in n.Attrs) {
                    var s = n.Attrs[o];
                    "name" in s || (s.name = o), e.__attrdata__[s.value] = s, n.Attrs[o] = s.value;
                }
            }
        }
    }
    function r(e, t, n) {
        if (this.ownerDocument = e, this.type = t, this._attrs = {}, "string" == typeof n) {
            var r = n.split(":");
            1 === r.length ? this.localTagName = r[0] : (this.namespaceName = r[0], this.localTagName = r[1]);
        } else this.tag = n, Object.defineProperties(this, {
            namespace: {
                get: function() {
                    return this.tag >> 8;
                }
            },
            localTag: {
                get: function() {
                    return 255 & this.tag;
                }
            },
            namespaceName: {
                get: function() {
                    return this.ownerDocument._codepages.__nsnames__[this.namespace];
                }
            },
            localTagName: {
                get: function() {
                    return this.ownerDocument._codepages.__tagnames__[this.tag];
                }
            }
        });
    }
    function i(e) {
        this.ownerDocument = e;
    }
    function o(e, t) {
        this.ownerDocument = e, this.textContent = t;
    }
    function s(e, t, n, r) {
        this.ownerDocument = e, this.subtype = t, this.index = n, this.value = r;
    }
    function a(e) {
        this.ownerDocument = e;
    }
    function u(e, t) {
        this.ownerDocument = e, this.data = t;
    }
    function c(e, t) {
        this._data = e instanceof l ? e.bytes : e, this._codepages = t, this.rewind();
    }
    function l(e, t, n, r, i) {
        this._blobs = "blob" === i ? [] : null, this.dataType = i || "arraybuffer", this._rawbuf = new ArrayBuffer(1024), 
        this._buffer = new Uint8Array(this._rawbuf), this._pos = 0, this._codepage = 0, 
        this._tagStack = [], this._rootTagValue = null;
        var o = e.split(".").map(function(e) {
            return parseInt(e);
        }), s = o[0], a = o[1], u = (s - 1 << 4) + a, c = n;
        if ("string" == typeof n && (c = y[n], void 0 === c)) throw new Error("unknown charset " + n);
        var l = this._encoder = new TextEncoder(n);
        if (this._write(u), this._write(t), this._write(c), r) {
            var d = r.map(function(e) {
                return l.encode(e);
            }), f = d.reduce(function(e, t) {
                return e + t.length + 1;
            }, 0);
            this._write_mb_uint32(f);
            for (var h = 0; h < d.length; h++) {
                var p = d[h];
                this._write_bytes(p), this._write(0);
            }
        } else this._write(0);
    }
    function d() {
        this.listeners = [], this.onerror = function(e) {
            throw e;
        };
    }
    var f = {}, h = {
        SWITCH_PAGE: 0,
        END: 1,
        ENTITY: 2,
        STR_I: 3,
        LITERAL: 4,
        EXT_I_0: 64,
        EXT_I_1: 65,
        EXT_I_2: 66,
        PI: 67,
        LITERAL_C: 68,
        EXT_T_0: 128,
        EXT_T_1: 129,
        EXT_T_2: 130,
        STR_T: 131,
        LITERAL_A: 132,
        EXT_0: 192,
        EXT_1: 193,
        EXT_2: 194,
        OPAQUE: 195,
        LITERAL_AC: 196
    }, p = {
        message: "THIS IS AN INTERNAL CONTROL FLOW HACK THAT YOU SHOULD NOT SEE"
    }, m = e("WBXML.ParseError");
    f.ParseError = m, t.prototype = {
        get: function(e) {
            if (e in this.offsets) return this.strings[this.offsets[e]];
            if (0 > e) throw new m("offset must be >= 0");
            for (var t = 0, n = 0; n < this.strings.length; n++) {
                if (e < t + this.strings[n].length + 1) return this.strings[n].slice(e - t);
                t += this.strings[n].length + 1;
            }
            throw new m("invalid offset");
        }
    }, f.CompileCodepages = n;
    var g = {
        3: "US-ASCII",
        4: "ISO-8859-1",
        5: "ISO-8859-2",
        6: "ISO-8859-3",
        7: "ISO-8859-4",
        8: "ISO-8859-5",
        9: "ISO-8859-6",
        10: "ISO-8859-7",
        11: "ISO-8859-8",
        12: "ISO-8859-9",
        13: "ISO-8859-10",
        106: "UTF-8"
    }, y = {};
    for (var _ in g) {
        var v = g[_];
        y[v] = _;
    }
    return f.Element = r, r.prototype = {
        get tagName() {
            var e = this.namespaceName;
            return e = e ? e + ":" : "", e + this.localTagName;
        },
        getAttributes: function() {
            var e = [];
            for (var t in this._attrs) {
                var n = this._attrs[t], r = t.split(":");
                e.push({
                    name: t,
                    namespace: r[0],
                    localName: r[1],
                    value: this._getAttribute(n)
                });
            }
            return e;
        },
        getAttribute: function(e) {
            return "number" == typeof e ? e = this.ownerDocument._codepages.__attrdata__[e].name : e in this._attrs || null === this.namespace || -1 !== e.indexOf(":") || (e = this.namespaceName + ":" + e), 
            this._getAttribute(this._attrs[e]);
        },
        _getAttribute: function(e) {
            for (var t = "", n = [], r = 0; r < e.length; r++) {
                var i = e[r];
                i instanceof s ? (t && (n.push(t), t = ""), n.push(i)) : t += "number" == typeof i ? this.ownerDocument._codepages.__attrdata__[i].data || "" : i;
            }
            return t && n.push(t), 1 === n.length ? n[0] : n;
        },
        _addAttribute: function(e) {
            if ("string" == typeof e) {
                if (e in this._attrs) throw new m("attribute " + e + " is repeated");
                return this._attrs[e] = [];
            }
            var t = e >> 8, n = 255 & e, r = this.ownerDocument._codepages.__attrdata__[n].name, i = this.ownerDocument._codepages.__nsnames__[t], o = i + ":" + r;
            if (o in this._attrs) throw new m("attribute " + o + " is repeated");
            return this._attrs[o] = [ e ];
        }
    }, f.EndTag = i, i.prototype = {
        get type() {
            return "ETAG";
        }
    }, f.Text = o, o.prototype = {
        get type() {
            return "TEXT";
        }
    }, f.Extension = s, s.prototype = {
        get type() {
            return "EXT";
        }
    }, f.ProcessingInstruction = a, a.prototype = {
        get type() {
            return "PI";
        },
        get target() {
            return "string" == typeof this.targetID ? this.targetID : this.ownerDocument._codepages.__attrdata__[this.targetID].name;
        },
        _setTarget: function(e) {
            return this.targetID = e, this._data = "string" == typeof e ? [] : [ e ];
        },
        _getAttribute: r.prototype._getAttribute,
        get data() {
            return this._getAttribute(this._data);
        }
    }, f.Opaque = u, u.prototype = {
        get type() {
            return "OPAQUE";
        }
    }, f.Reader = c, c.prototype = {
        _get_uint8: function() {
            if (this._index === this._data.length) throw p;
            return this._data[this._index++];
        },
        _get_mb_uint32: function() {
            var e, t = 0;
            do e = this._get_uint8(), t = 128 * t + (127 & e); while (128 & e);
            return t;
        },
        _get_slice: function(e) {
            var t = this._index;
            return this._index += e, this._data.subarray(t, this._index);
        },
        _get_c_string: function() {
            for (var e = this._index; this._get_uint8(); ) ;
            return this._data.subarray(e, this._index - 1);
        },
        rewind: function() {
            this._index = 0;
            var e = this._get_uint8();
            this.version = ((240 & e) + 1).toString() + "." + (15 & e).toString(), this.pid = this._get_mb_uint32(), 
            this.charset = g[this._get_mb_uint32()] || "unknown", this._decoder = new TextDecoder(this.charset);
            var n = this._get_mb_uint32();
            this.strings = new t(this._get_slice(n), this._decoder), this.document = this._getDocument();
        },
        _getDocument: function() {
            var e, t, n = {
                BODY: 0,
                ATTRIBUTES: 1,
                ATTRIBUTE_PI: 2
            }, c = n.BODY, l = 0, d = 0, f = !1, g = [], y = function(r) {
                c === n.BODY ? e ? e.textContent += r : e = new o(this, r) : (t || (t = []), t.push(r));
            }.bind(this);
            try {
                for (;;) {
                    var _ = this._get_uint8();
                    if (_ === h.SWITCH_PAGE) {
                        if (l = this._get_uint8(), !(l in this._codepages.__nsnames__)) throw new m("unknown codepage " + l);
                    } else if (_ === h.END) if (c === n.BODY && d-- > 0) e && (g.push(e), e = null), 
                    g.push(new i(this)); else {
                        if (c !== n.ATTRIBUTES && c !== n.ATTRIBUTE_PI) throw new m("unexpected END token");
                        c = n.BODY, g.push(e), e = null, t = null;
                    } else if (_ === h.ENTITY) {
                        if (c === n.BODY && 0 === d) throw new m("unexpected ENTITY token");
                        var v = this._get_mb_uint32();
                        y("&#" + v + ";");
                    } else if (_ === h.STR_I) {
                        if (c === n.BODY && 0 === d) throw new m("unexpected STR_I token");
                        y(this._decoder.decode(this._get_c_string()));
                    } else if (_ === h.PI) {
                        if (c !== n.BODY) throw new m("unexpected PI token");
                        c = n.ATTRIBUTE_PI, e && g.push(e), e = new a(this);
                    } else if (_ === h.STR_T) {
                        if (c === n.BODY && 0 === d) throw new m("unexpected STR_T token");
                        var b = this._get_mb_uint32();
                        y(this.strings.get(b));
                    } else if (_ === h.OPAQUE) {
                        if (c !== n.BODY) throw new m("unexpected OPAQUE token");
                        var w = this._get_mb_uint32(), S = this._get_slice(w);
                        e && (g.push(e), e = null), g.push(new u(this, S));
                    } else if ((64 & _ || 128 & _) && 3 > (63 & _)) {
                        var A, T, I = 192 & _, E = 63 & _;
                        I === h.EXT_I_0 ? (A = "string", T = this._decoder.decode(this._get_c_string())) : I === h.EXT_T_0 ? (A = "integer", 
                        T = this._get_mb_uint32()) : (A = "byte", T = null);
                        var C = new s(this, A, E, T);
                        c === n.BODY ? (e && (g.push(e), e = null), g.push(C)) : t.push(C);
                    } else if (c === n.BODY) {
                        if (0 === d) {
                            if (f) throw new m("multiple root nodes found");
                            f = !0;
                        }
                        var x = (l << 8) + (63 & _);
                        if ((63 & _) === h.LITERAL) {
                            var b = this._get_mb_uint32();
                            x = this.strings.get(b);
                        }
                        e && g.push(e), e = new r(this, 64 & _ ? "STAG" : "TAG", x), 64 & _ && d++, 128 & _ ? c = n.ATTRIBUTES : (c = n.BODY, 
                        g.push(e), e = null);
                    } else {
                        var M = (l << 8) + _;
                        if (128 & _) t.push(M); else {
                            if (_ === h.LITERAL) {
                                var b = this._get_mb_uint32();
                                M = this.strings.get(b);
                            }
                            if (c === n.ATTRIBUTE_PI) {
                                if (t) throw new m("unexpected attribute in PI");
                                t = e._setTarget(M);
                            } else t = e._addAttribute(M);
                        }
                    }
                }
            } catch (v) {
                if (v !== p) throw v;
            }
            return g;
        },
        dump: function(e, t) {
            var n = "";
            void 0 === e && (e = 2);
            var r = function(t) {
                return new Array(t * e + 1).join(" ");
            }, i = [];
            t && (n += "Version: " + this.version + "\n", n += "Public ID: " + this.pid + "\n", 
            n += "Charset: " + this.charset + "\n", n += 'String table:\n  "' + this.strings.strings.join('"\n  "') + '"\n\n');
            for (var o = this.document, s = o.length, a = 0; s > a; a++) {
                var u = o[a];
                if ("TAG" === u.type || "STAG" === u.type) {
                    n += r(i.length) + "<" + u.tagName;
                    for (var c = u.getAttributes(), l = 0; l < c.length; l++) {
                        var d = c[l];
                        n += " " + d.name + '="' + d.value + '"';
                    }
                    "STAG" === u.type ? (i.push(u.tagName), n += ">\n") : n += "/>\n";
                } else if ("ETAG" === u.type) {
                    var f = i.pop();
                    n += r(i.length) + "</" + f + ">\n";
                } else if ("TEXT" === u.type) n += r(i.length) + u.textContent + "\n"; else if ("PI" === u.type) n += r(i.length) + "<?" + u.target, 
                u.data && (n += " " + u.data), n += "?>\n"; else {
                    if ("OPAQUE" !== u.type) throw new Error('Unknown node type "' + u.type + '"');
                    n += r(i.length) + "<![CDATA[" + u.data + "]]>\n";
                }
            }
            return n;
        }
    }, f.Writer = l, l.Attribute = function(e, t) {
        if (this.isValue = "number" == typeof e && 128 & e, this.isValue && void 0 !== t) throw new Error("Can't specify a value for attribute value constants");
        this.name = e, this.value = t;
    }, l.StringTableRef = function(e) {
        this.index = e;
    }, l.Entity = function(e) {
        this.code = e;
    }, l.Extension = function(e, t, n) {
        var r = {
            string: {
                value: h.EXT_I_0,
                validator: function(e) {
                    return "string" == typeof e;
                }
            },
            integer: {
                value: h.EXT_T_0,
                validator: function(e) {
                    return "number" == typeof e;
                }
            },
            "byte": {
                value: h.EXT_0,
                validator: function(e) {
                    return null === e || void 0 === e;
                }
            }
        }, i = r[e];
        if (!i) throw new Error("Invalid WBXML Extension type");
        if (!i.validator(n)) throw new Error("Data for WBXML Extension does not match type");
        if (0 !== t && 1 !== t && 2 !== t) throw new Error("Invalid WBXML Extension index");
        this.subtype = i.value, this.index = t, this.data = n;
    }, l.a = function(e, t) {
        return new l.Attribute(e, t);
    }, l.str_t = function(e) {
        return new l.StringTableRef(e);
    }, l.ent = function(e) {
        return new l.Entity(e);
    }, l.ext = function(e, t, n) {
        return new l.Extension(e, t, n);
    }, l.prototype = {
        _write: function(e) {
            if (this._pos === this._buffer.length - 1) {
                this._rawbuf = new ArrayBuffer(2 * this._rawbuf.byteLength);
                for (var t = new Uint8Array(this._rawbuf), n = 0; n < this._buffer.length; n++) t[n] = this._buffer[n];
                this._buffer = t;
            }
            this._buffer[this._pos++] = e;
        },
        _write_mb_uint32: function(e) {
            var t = [];
            for (t.push(e % 128); e >= 128; ) e >>= 7, t.push(128 + e % 128);
            for (var n = t.length - 1; n >= 0; n--) this._write(t[n]);
        },
        _write_bytes: function(e) {
            for (var t = 0; t < e.length; t++) this._write(e[t]);
        },
        _write_str: function(e) {
            this._write_bytes(this._encoder.encode(e));
        },
        _setCodepage: function(e) {
            this._codepage !== e && (this._write(h.SWITCH_PAGE), this._write(e), this._codepage = e);
        },
        _writeTag: function(e, t, n) {
            if (void 0 === e) throw new Error("unknown tag");
            var r = 0;
            if (t && (r += 64), n.length && (r += 128), e instanceof l.StringTableRef ? (this._write(h.LITERAL + r), 
            this._write_mb_uint32(e.index)) : (this._setCodepage(e >> 8), this._write((255 & e) + r), 
            this._rootTagValue || (this._rootTagValue = e)), n.length) {
                for (var i = 0; i < n.length; i++) {
                    var o = n[i];
                    this._writeAttr(o);
                }
                this._write(h.END);
            }
        },
        _writeAttr: function(e) {
            if (!(e instanceof l.Attribute)) throw new Error("Expected an Attribute object");
            if (e.isValue) throw new Error("Can't use attribute value constants here");
            e.name instanceof l.StringTableRef ? (this._write(h.LITERAL), this._write(e.name.index)) : (this._setCodepage(e.name >> 8), 
            this._write(255 & e.name)), this._writeText(e.value, !0);
        },
        _writeText: function(e, t) {
            if (Array.isArray(e)) for (var n = 0; n < e.length; n++) {
                var r = e[n];
                this._writeText(r, t);
            } else if (e instanceof l.StringTableRef) this._write(h.STR_T), this._write_mb_uint32(e.index); else if (e instanceof l.Entity) this._write(h.ENTITY), 
            this._write_mb_uint32(e.code); else if (e instanceof l.Extension) this._write(e.subtype + e.index), 
            e.subtype === h.EXT_I_0 ? (this._write_str(e.data), this._write(0)) : e.subtype === h.EXT_T_0 && this._write_mb_uint32(e.data); else if (e instanceof l.Attribute) {
                if (!e.isValue) throw new Error("Unexpected Attribute object");
                if (!t) throw new Error("Can't use attribute value constants outside of attributes");
                this._setCodepage(e.name >> 8), this._write(255 & e.name);
            } else null !== e && void 0 !== e && (this._write(h.STR_I), this._write_str(e.toString()), 
            this._write(0));
        },
        tag: function(e) {
            var t = arguments.length > 1 ? arguments[arguments.length - 1] : null;
            if (null === t || t instanceof l.Attribute) {
                var n = Array.prototype.slice.call(arguments, 1);
                return this._writeTag(e, !1, n), this;
            }
            var r = Array.prototype.slice.call(arguments, 0, -1);
            return this.stag.apply(this, r).text(t).etag();
        },
        stag: function(e) {
            var t = Array.prototype.slice.call(arguments, 1);
            return this._writeTag(e, !0, t), this._tagStack.push(e), this;
        },
        etag: function(e) {
            if (0 === this._tagStack.length) throw new Error("Spurious etag() call!");
            var t = this._tagStack.pop();
            if (void 0 !== e && e !== t) throw new Error("Closed the wrong tag");
            return this._write(h.END), this;
        },
        text: function(e) {
            return this._writeText(e), this;
        },
        pi: function(e, t) {
            return this._write(h.PI), this._writeAttr(l.a(e, t)), this._write(h.END), this;
        },
        ext: function(e, t, n) {
            return this.text(l.ext(e, t, n));
        },
        opaque: function(e) {
            if (this._write(h.OPAQUE), e instanceof Blob) {
                if (!this._blobs) throw new Error("Writer not opened in blob mode");
                this._write_mb_uint32(e.size), this._blobs.push(this.bytes), this._blobs.push(e), 
                this._rawbuf = new ArrayBuffer(1024), this._buffer = new Uint8Array(this._rawbuf), 
                this._pos = 0;
            } else if ("string" == typeof e) this._write_mb_uint32(e.length), this._write_str(e); else {
                this._write_mb_uint32(e.length);
                for (var t = 0; t < e.length; t++) this._write(e[t]);
            }
            return this;
        },
        get buffer() {
            return this._rawbuf.slice(0, this._pos);
        },
        get bytes() {
            return new Uint8Array(this._rawbuf, 0, this._pos);
        },
        get blob() {
            if (!this._blobs) throw new Error("No blobs!");
            var e = this._blobs;
            this._pos && (e = e.concat([ this.bytes ]));
            var t = new Blob(e);
            return t;
        },
        get rootTag() {
            return this._rootTagValue;
        }
    }, f.EventParser = d, d.prototype = {
        addEventListener: function(e, t) {
            this.listeners.push({
                path: e,
                callback: t
            });
        },
        _pathMatches: function(e, t) {
            return e.length === t.length && e.every(function(e, n) {
                return "*" === t[n] ? !0 : Array.isArray(t[n]) ? -1 !== t[n].indexOf(e) : e === t[n];
            });
        },
        run: function(e) {
            for (var t, n, r = [], i = [], o = 0, s = e.document, a = s.length, u = this.listeners, c = 0; a > c; c++) {
                var l = s[c];
                if ("TAG" === l.type) {
                    for (r.push(l.tag), t = 0; t < u.length; t++) if (n = u[t], this._pathMatches(r, n.path)) {
                        l.children = [];
                        try {
                            n.callback(l);
                        } catch (d) {
                            this.onerror && this.onerror(d);
                        }
                    }
                    r.pop();
                } else if ("STAG" === l.type) for (r.push(l.tag), t = 0; t < u.length; t++) n = u[t], 
                this._pathMatches(r, n.path) && o++; else if ("ETAG" === l.type) {
                    for (t = 0; t < u.length; t++) if (n = u[t], this._pathMatches(r, n.path)) {
                        o--;
                        try {
                            n.callback(i[i.length - 1]);
                        } catch (d) {
                            this.onerror && this.onerror(d);
                        }
                    }
                    r.pop();
                }
                o && ("STAG" === l.type ? (l.type = "TAG", l.children = [], i.length && i[i.length - 1].children.push(l), 
                i.push(l)) : "ETAG" === l.type ? i.pop() : (l.children = [], i[i.length - 1].children.push(l)));
            }
        }
    }, f;
});