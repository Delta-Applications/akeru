(function(e) {
    function t(e, t, n) {
        return e >= t && n >= e;
    }
    function n(e, t) {
        return Math.floor(e / t);
    }
    function r(e) {
        var t = 0;
        this.get = function() {
            return t >= e.length ? B : Number(e[t]);
        }, this.offset = function(n) {
            if (t += n, 0 > t) throw new Error("Seeking past start of the buffer");
            if (t > e.length) throw new Error("Seeking past EOF");
        }, this.match = function(n) {
            if (n.length > t + e.length) return !1;
            var r;
            for (r = 0; r < n.length; r += 1) if (Number(e[t + r]) !== n[r]) return !1;
            return !0;
        };
    }
    function i(e) {
        var t = 0;
        this.emit = function() {
            var n, r = B;
            for (n = 0; n < arguments.length; ++n) r = Number(arguments[n]), e[t++] = r;
            return r;
        };
    }
    function o(e) {
        var n = 0, r = function() {
            for (var n = [], r = 0, i = e.length; r < e.length; ) {
                var o = e.charCodeAt(r);
                if (t(o, 55296, 57343)) if (t(o, 56320, 57343)) n.push(65533); else if (r === i - 1) n.push(65533); else {
                    var a = e.charCodeAt(r + 1);
                    if (t(a, 56320, 57343)) {
                        var s = 1023 & o, u = 1023 & a;
                        r += 1, n.push(65536 + (s << 10) + u);
                    } else n.push(65533);
                } else n.push(o);
                r += 1;
            }
            return n;
        }();
        this.offset = function(e) {
            if (n += e, 0 > n) throw new Error("Seeking past start of the buffer");
            if (n > r.length) throw new Error("Seeking past EOF");
        }, this.get = function() {
            return n >= r.length ? H : r[n];
        };
    }
    function a() {
        var e = "";
        this.string = function() {
            return e;
        }, this.emit = function(t) {
            65535 >= t ? e += String.fromCharCode(t) : (t -= 65536, e += String.fromCharCode(55296 + (1023 & t >> 10)), 
            e += String.fromCharCode(56320 + (1023 & t)));
        };
    }
    function s(e, t) {
        if (e) throw new Error("EncodingError");
        return t || 65533;
    }
    function u() {
        throw new Error("EncodingError");
    }
    function c(e) {
        if (e = String(e).trim().toLowerCase(), Object.prototype.hasOwnProperty.call(K, e)) return K[e];
        throw new Error("EncodingError: Unknown encoding: " + e);
    }
    function l(e, t) {
        return (t || [])[e] || null;
    }
    function d(e, t) {
        var n = t.indexOf(e);
        return -1 === n ? null : n;
    }
    function f(e) {
        if (e > 39419 && 189e3 > e || e > 1237575) return null;
        var t, n = 0, r = 0, i = z.gb18030;
        for (t = 0; t < i.length; ++t) {
            var o = i[t];
            if (!(o[0] <= e)) break;
            n = o[0], r = o[1];
        }
        return r + e - n;
    }
    function p(e) {
        var t, n = 0, r = 0, i = z.gb18030;
        for (t = 0; t < i.length; ++t) {
            var o = i[t];
            if (!(o[1] <= e)) break;
            n = o[1], r = o[0];
        }
        return r + e - n;
    }
    function m(e) {
        var n = e.fatal, r = 0, i = 0, o = 0, a = 0;
        this.decode = function(e) {
            var u = e.get();
            if (u === B) return 0 !== i ? (i = 0, s(n)) : H;
            if (e.offset(1), 0 === i) {
                if (t(u, 0, 127)) return u;
                if (t(u, 194, 223)) i = 1, a = 128, r = u - 192; else if (t(u, 224, 239)) i = 2, 
                a = 2048, r = u - 224; else {
                    if (!t(u, 240, 244)) return s(n);
                    i = 3, a = 65536, r = u - 240;
                }
                return r *= Math.pow(64, i), null;
            }
            if (!t(u, 128, 191)) return r = 0, i = 0, o = 0, a = 0, e.offset(-1), s(n);
            if (o += 1, r += (u - 128) * Math.pow(64, i - o), o !== i) return null;
            var c = r, l = a;
            return r = 0, i = 0, o = 0, a = 0, t(c, l, 1114111) && !t(c, 55296, 57343) ? c : s(n);
        };
    }
    function h(e) {
        e.fatal, this.encode = function(e, r) {
            var i = r.get();
            if (i === H) return B;
            if (r.offset(1), t(i, 55296, 57343)) return u(i);
            if (t(i, 0, 127)) return e.emit(i);
            var o, a;
            t(i, 128, 2047) ? (o = 1, a = 192) : t(i, 2048, 65535) ? (o = 2, a = 224) : t(i, 65536, 1114111) && (o = 3, 
            a = 240);
            for (var s = e.emit(n(i, Math.pow(64, o)) + a); o > 0; ) {
                var c = n(i, Math.pow(64, o - 1));
                s = e.emit(128 + c % 64), o -= 1;
            }
            return s;
        };
    }
    function g(e, n) {
        var r = n.fatal;
        this.decode = function(n) {
            var i = n.get();
            if (i === B) return H;
            if (n.offset(1), t(i, 0, 127)) return i;
            var o = e[i - 128];
            return null === o ? s(r) : o;
        };
    }
    function y(e, n) {
        n.fatal, this.encode = function(n, r) {
            var i = r.get();
            if (i === H) return B;
            if (r.offset(1), t(i, 0, 127)) return n.emit(i);
            var o = d(i, e);
            return null === o && u(i), n.emit(o + 128);
        };
    }
    function v(e, n) {
        var r = n.fatal, i = 0, o = 0, a = 0;
        this.decode = function(n) {
            var u = n.get();
            if (u === B && 0 === i && 0 === o && 0 === a) return H;
            u !== B || 0 === i && 0 === o && 0 === a || (i = 0, o = 0, a = 0, s(r)), n.offset(1);
            var c;
            if (0 !== a) return c = null, t(u, 48, 57) && (c = f(10 * (126 * (10 * (i - 129) + (o - 48)) + (a - 129)) + u - 48)), 
            i = 0, o = 0, a = 0, null === c ? (n.offset(-3), s(r)) : c;
            if (0 !== o) return t(u, 129, 254) ? (a = u, null) : (n.offset(-2), i = 0, o = 0, 
            s(r));
            if (0 !== i) {
                if (t(u, 48, 57) && e) return o = u, null;
                var d = i, p = null;
                i = 0;
                var m = 127 > u ? 64 : 65;
                return (t(u, 64, 126) || t(u, 128, 254)) && (p = 190 * (d - 129) + (u - m)), c = null === p ? null : l(p, z.gbk), 
                null === p && n.offset(-1), null === c ? s(r) : c;
            }
            return t(u, 0, 127) ? u : 128 === u ? 8364 : t(u, 129, 254) ? (i = u, null) : s(r);
        };
    }
    function S(e, r) {
        r.fatal, this.encode = function(r, i) {
            var o = i.get();
            if (o === H) return B;
            if (i.offset(1), t(o, 0, 127)) return r.emit(o);
            var a = d(o, z.gbk);
            if (null !== a) {
                var s = n(a, 190) + 129, c = a % 190, l = 63 > c ? 64 : 65;
                return r.emit(s, c + l);
            }
            if (null === a && !e) return u(o);
            a = p(o);
            var f = n(n(n(a, 10), 126), 10);
            a -= 10 * 126 * 10 * f;
            var m = n(n(a, 10), 126);
            a -= 126 * 10 * m;
            var h = n(a, 10), g = a - 10 * h;
            return r.emit(f + 129, m + 48, h + 129, g + 48);
        };
    }
    function b(e) {
        var n = e.fatal, r = !1, i = 0;
        this.decode = function(e) {
            var o = e.get();
            if (o === B && 0 === i) return H;
            if (o === B && 0 !== i) return i = 0, s(n);
            if (e.offset(1), 126 === i) return i = 0, 123 === o ? (r = !0, null) : 125 === o ? (r = !1, 
            null) : 126 === o ? 126 : 10 === o ? null : (e.offset(-1), s(n));
            if (0 !== i) {
                var a = i;
                i = 0;
                var u = null;
                return t(o, 33, 126) && (u = l(190 * (a - 1) + (o + 63), z.gbk)), 10 === o && (r = !1), 
                null === u ? s(n) : u;
            }
            return 126 === o ? (i = 126, null) : r ? t(o, 32, 127) ? (i = o, null) : (10 === o && (r = !1), 
            s(n)) : t(o, 0, 127) ? o : s(n);
        };
    }
    function A(e) {
        e.fatal;
        var r = !1;
        this.encode = function(e, i) {
            var o = i.get();
            if (o === H) return B;
            if (i.offset(1), t(o, 0, 127) && r) return i.offset(-1), r = !1, e.emit(126, 125);
            if (126 === o) return e.emit(126, 126);
            if (t(o, 0, 127)) return e.emit(o);
            if (!r) return i.offset(-1), r = !0, e.emit(126, 123);
            var a = d(o, z.gbk);
            if (null === a) return u(o);
            var s = n(a, 190) + 1, c = a % 190 - 63;
            return t(s, 33, 126) && t(c, 33, 126) ? e.emit(s, c) : u(o);
        };
    }
    function C(e) {
        var n = e.fatal, r = 0, i = null;
        this.decode = function(e) {
            if (null !== i) {
                var o = i;
                return i = null, o;
            }
            var a = e.get();
            if (a === B && 0 === r) return H;
            if (a === B && 0 !== r) return r = 0, s(n);
            if (e.offset(1), 0 !== r) {
                var u = r, c = null;
                r = 0;
                var d = 127 > a ? 64 : 98;
                if ((t(a, 64, 126) || t(a, 161, 254)) && (c = 157 * (u - 129) + (a - d)), 1133 === c) return i = 772, 
                202;
                if (1135 === c) return i = 780, 202;
                if (1164 === c) return i = 772, 234;
                if (1166 === c) return i = 780, 234;
                var f = null === c ? null : l(c, z.big5);
                return null === c && e.offset(-1), null === f ? s(n) : f;
            }
            return t(a, 0, 127) ? a : t(a, 129, 254) ? (r = a, null) : s(n);
        };
    }
    function I(e) {
        e.fatal, this.encode = function(e, r) {
            var i = r.get();
            if (i === H) return B;
            if (r.offset(1), t(i, 0, 127)) return e.emit(i);
            var o = d(i, z.big5);
            if (null === o) return u(i);
            var a = n(o, 157) + 129, s = o % 157, c = 63 > s ? 64 : 98;
            return e.emit(a, s + c);
        };
    }
    function w(e) {
        var n = e.fatal, r = 0, i = 0;
        this.decode = function(e) {
            var o = e.get();
            if (o === B) return 0 === r && 0 === i ? H : (r = 0, i = 0, s(n));
            e.offset(1);
            var a, u;
            return 0 !== i ? (a = i, i = 0, u = null, t(a, 161, 254) && t(o, 161, 254) && (u = l(94 * (a - 161) + o - 161, z.jis0212)), 
            t(o, 161, 254) || e.offset(-1), null === u ? s(n) : u) : 142 === r && t(o, 161, 223) ? (r = 0, 
            65377 + o - 161) : 143 === r && t(o, 161, 254) ? (r = 0, i = o, null) : 0 !== r ? (a = r, 
            r = 0, u = null, t(a, 161, 254) && t(o, 161, 254) && (u = l(94 * (a - 161) + o - 161, z.jis0208)), 
            t(o, 161, 254) || e.offset(-1), null === u ? s(n) : u) : t(o, 0, 127) ? o : 142 === o || 143 === o || t(o, 161, 254) ? (r = o, 
            null) : s(n);
        };
    }
    function M(e) {
        e.fatal, this.encode = function(e, r) {
            var i = r.get();
            if (i === H) return B;
            if (r.offset(1), t(i, 0, 127)) return e.emit(i);
            if (165 === i) return e.emit(92);
            if (8254 === i) return e.emit(126);
            if (t(i, 65377, 65439)) return e.emit(142, i - 65377 + 161);
            var o = d(i, z.jis0208);
            if (null === o) return u(i);
            var a = n(o, 94) + 161, s = o % 94 + 161;
            return e.emit(a, s);
        };
    }
    function T(e) {
        var n = e.fatal, r = {
            ASCII: 0,
            escape_start: 1,
            escape_middle: 2,
            escape_final: 3,
            lead: 4,
            trail: 5,
            Katakana: 6
        }, i = r.ASCII, o = !1, a = 0;
        this.decode = function(e) {
            var u = e.get();
            switch (u !== B && e.offset(1), i) {
              default:
              case r.ASCII:
                return 27 === u ? (i = r.escape_start, null) : t(u, 0, 127) ? u : u === B ? H : s(n);

              case r.escape_start:
                return 36 === u || 40 === u ? (a = u, i = r.escape_middle, null) : (u !== B && e.offset(-1), 
                i = r.ASCII, s(n));

              case r.escape_middle:
                var c = a;
                return a = 0, 36 !== c || 64 !== u && 66 !== u ? 36 === c && 40 === u ? (i = r.escape_final, 
                null) : 40 !== c || 66 !== u && 74 !== u ? 40 === c && 73 === u ? (i = r.Katakana, 
                null) : (u === B ? e.offset(-1) : e.offset(-2), i = r.ASCII, s(n)) : (i = r.ASCII, 
                null) : (o = !1, i = r.lead, null);

              case r.escape_final:
                return 68 === u ? (o = !0, i = r.lead, null) : (u === B ? e.offset(-2) : e.offset(-3), 
                i = r.ASCII, s(n));

              case r.lead:
                return 10 === u ? (i = r.ASCII, s(n, 10)) : 27 === u ? (i = r.escape_start, null) : u === B ? H : (a = u, 
                i = r.trail, null);

              case r.trail:
                if (i = r.lead, u === B) return s(n);
                var d = null, f = 94 * (a - 33) + u - 33;
                return t(a, 33, 126) && t(u, 33, 126) && (d = o === !1 ? l(f, z.jis0208) : l(f, z.jis0212)), 
                null === d ? s(n) : d;

              case r.Katakana:
                return 27 === u ? (i = r.escape_start, null) : t(u, 33, 95) ? 65377 + u - 33 : u === B ? H : s(n);
            }
        };
    }
    function E(e) {
        e.fatal;
        var r = {
            ASCII: 0,
            lead: 1,
            Katakana: 2
        }, i = r.ASCII;
        this.encode = function(e, o) {
            var a = o.get();
            if (a === H) return B;
            if (o.offset(1), (t(a, 0, 127) || 165 === a || 8254 === a) && i !== r.ASCII) return o.offset(-1), 
            i = r.ASCII, e.emit(27, 40, 66);
            if (t(a, 0, 127)) return e.emit(a);
            if (165 === a) return e.emit(92);
            if (8254 === a) return e.emit(126);
            if (t(a, 65377, 65439) && i !== r.Katakana) return o.offset(-1), i = r.Katakana, 
            e.emit(27, 40, 73);
            if (t(a, 65377, 65439)) return e.emit(a - 65377 - 33);
            if (i !== r.lead) return o.offset(-1), i = r.lead, e.emit(27, 36, 66);
            var s = d(a, z.jis0208);
            if (null === s) return u(a);
            var c = n(s, 94) + 33, l = s % 94 + 33;
            return e.emit(c, l);
        };
    }
    function D(e) {
        var n = e.fatal, r = 0;
        this.decode = function(e) {
            var i = e.get();
            if (i === B && 0 === r) return H;
            if (i === B && 0 !== r) return r = 0, s(n);
            if (e.offset(1), 0 !== r) {
                var o = r;
                if (r = 0, t(i, 64, 126) || t(i, 128, 252)) {
                    var a = 127 > i ? 64 : 65, u = 160 > o ? 129 : 193, c = l(188 * (o - u) + i - a, z.jis0208);
                    return null === c ? s(n) : c;
                }
                return e.offset(-1), s(n);
            }
            return t(i, 0, 128) ? i : t(i, 161, 223) ? 65377 + i - 161 : t(i, 129, 159) || t(i, 224, 252) ? (r = i, 
            null) : s(n);
        };
    }
    function _(e) {
        e.fatal, this.encode = function(e, r) {
            var i = r.get();
            if (i === H) return B;
            if (r.offset(1), t(i, 0, 128)) return e.emit(i);
            if (165 === i) return e.emit(92);
            if (8254 === i) return e.emit(126);
            if (t(i, 65377, 65439)) return e.emit(i - 65377 + 161);
            var o = d(i, z.jis0208);
            if (null === o) return u(i);
            var a = n(o, 188), s = 31 > a ? 129 : 193, c = o % 188, l = 63 > c ? 64 : 65;
            return e.emit(a + s, c + l);
        };
    }
    function R(e) {
        var n = e.fatal, r = 0;
        this.decode = function(e) {
            var i = e.get();
            if (i === B && 0 === r) return H;
            if (i === B && 0 !== r) return r = 0, s(n);
            if (e.offset(1), 0 !== r) {
                var o = r, a = null;
                if (r = 0, t(o, 129, 198)) {
                    var u = 178 * (o - 129);
                    t(i, 65, 90) ? a = u + i - 65 : t(i, 97, 122) ? a = u + 26 + i - 97 : t(i, 129, 254) && (a = u + 26 + 26 + i - 129);
                }
                t(o, 199, 253) && t(i, 161, 254) && (a = 12460 + 94 * (o - 199) + (i - 161));
                var c = null === a ? null : l(a, z["euc-kr"]);
                return null === a && e.offset(-1), null === c ? s(n) : c;
            }
            return t(i, 0, 127) ? i : t(i, 129, 253) ? (r = i, null) : s(n);
        };
    }
    function x(e) {
        e.fatal, this.encode = function(e, r) {
            var i = r.get();
            if (i === H) return B;
            if (r.offset(1), t(i, 0, 127)) return e.emit(i);
            var o = d(i, z["euc-kr"]);
            if (null === o) return u(i);
            var a, s;
            if (12460 > o) {
                a = n(o, 178) + 129, s = o % 178;
                var c = 26 > s ? 65 : 52 > s ? 71 : 77;
                return e.emit(a, s + c);
            }
            return o -= 12460, a = n(o, 94) + 199, s = o % 94 + 161, e.emit(a, s);
        };
    }
    function N(e) {
        var n = e.fatal, r = {
            ASCII: 0,
            escape_start: 1,
            escape_middle: 2,
            escape_end: 3,
            lead: 4,
            trail: 5
        }, i = r.ASCII, o = 0;
        this.decode = function(e) {
            var a = e.get();
            switch (a !== B && e.offset(1), i) {
              default:
              case r.ASCII:
                return 14 === a ? (i = r.lead, null) : 15 === a ? null : 27 === a ? (i = r.escape_start, 
                null) : t(a, 0, 127) ? a : a === B ? H : s(n);

              case r.escape_start:
                return 36 === a ? (i = r.escape_middle, null) : (a !== B && e.offset(-1), i = r.ASCII, 
                s(n));

              case r.escape_middle:
                return 41 === a ? (i = r.escape_end, null) : (a === B ? e.offset(-1) : e.offset(-2), 
                i = r.ASCII, s(n));

              case r.escape_end:
                return 67 === a ? (i = r.ASCII, null) : (a === B ? e.offset(-2) : e.offset(-3), 
                i = r.ASCII, s(n));

              case r.lead:
                return 10 === a ? (i = r.ASCII, s(n, 10)) : 14 === a ? null : 15 === a ? (i = r.ASCII, 
                null) : a === B ? H : (o = a, i = r.trail, null);

              case r.trail:
                if (i = r.lead, a === B) return s(n);
                var u = null;
                return t(o, 33, 70) && t(a, 33, 126) ? u = l(178 * (o - 1) + 26 + 26 + a - 1, z["euc-kr"]) : t(o, 71, 126) && t(a, 33, 126) && (u = l(12460 + 94 * (o - 71) + (a - 33), z["euc-kr"])), 
                null !== u ? u : s(n);
            }
        };
    }
    function P(e) {
        e.fatal;
        var r = {
            ASCII: 0,
            lead: 1
        }, i = !1, o = r.ASCII;
        this.encode = function(e, a) {
            var s = a.get();
            if (s === H) return B;
            if (i || (i = !0, e.emit(27, 36, 41, 67)), a.offset(1), t(s, 0, 127) && o !== r.ASCII) return a.offset(-1), 
            o = r.ASCII, e.emit(15);
            if (t(s, 0, 127)) return e.emit(s);
            if (o !== r.lead) return a.offset(-1), o = r.lead, e.emit(14);
            var c = d(s, z["euc-kr"]);
            if (null === c) return u(s);
            var l, f;
            return 12460 > c ? (l = n(c, 178) + 1, f = c % 178 - 26 - 26 + 1, t(l, 33, 70) && t(f, 33, 126) ? e.emit(l, f) : u(s)) : (c -= 12460, 
            l = n(c, 94) + 71, f = c % 94 + 33, t(l, 71, 126) && t(f, 33, 126) ? e.emit(l, f) : u(s));
        };
    }
    function k(e, n) {
        var r = n.fatal, i = null, o = null;
        this.decode = function(n) {
            var a = n.get();
            if (a === B && null === i && null === o) return H;
            if (a === B && (null !== i || null !== o)) return s(r);
            if (n.offset(1), null === i) return i = a, null;
            var u;
            if (u = e ? (i << 8) + a : (a << 8) + i, i = null, null !== o) {
                var c = o;
                return o = null, t(u, 56320, 57343) ? 65536 + 1024 * (c - 55296) + (u - 56320) : (n.offset(-2), 
                s(r));
            }
            return t(u, 55296, 56319) ? (o = u, null) : t(u, 56320, 57343) ? s(r) : u;
        };
    }
    function F(e, r) {
        r.fatal, this.encode = function(r, i) {
            function o(t) {
                var n = t >> 8, i = 255 & t;
                return e ? r.emit(n, i) : r.emit(i, n);
            }
            var a = i.get();
            if (a === H) return B;
            if (i.offset(1), t(a, 55296, 57343) && u(a), 65535 >= a) return o(a);
            var s = n(a - 65536, 1024) + 55296, c = (a - 65536) % 1024 + 56320;
            return o(s), o(c);
        };
    }
    function O(e, t) {
        return t.match([ 255, 254 ]) ? (t.offset(2), "utf-16") : t.match([ 254, 255 ]) ? (t.offset(2), 
        "utf-16be") : t.match([ 239, 187, 191 ]) ? (t.offset(3), "utf-8") : e;
    }
    function j(t, n) {
        return this && this !== e ? (t = t ? String(t) : W, n = Object(n), this._encoding = c(t), 
        this._streaming = !1, this._encoder = null, this._options = {
            fatal: Boolean(n.fatal)
        }, Object.defineProperty ? Object.defineProperty(this, "encoding", {
            get: function() {
                return this._encoding.name;
            }
        }) : this.encoding = this._encoding.name, this) : new j(t, n);
    }
    function L(t, n) {
        return this && this !== e ? (t = t ? String(t) : W, n = Object(n), this._encoding = c(t), 
        this._streaming = !1, this._decoder = null, this._options = {
            fatal: Boolean(n.fatal)
        }, Object.defineProperty ? Object.defineProperty(this, "encoding", {
            get: function() {
                return this._encoding.name;
            }
        }) : this.encoding = this._encoding.name, this) : new L(t, n);
    }
    var B = -1, H = -1, U = [ {
        encodings: [ {
            labels: [ "unicode-1-1-utf-8", "utf-8", "utf8" ],
            name: "utf-8"
        } ],
        heading: "The Encoding"
    }, {
        encodings: [ {
            labels: [ "cp864", "ibm864" ],
            name: "ibm864"
        }, {
            labels: [ "cp866", "ibm866" ],
            name: "ibm866"
        }, {
            labels: [ "csisolatin2", "iso-8859-2", "iso-ir-101", "iso8859-2", "iso_8859-2", "l2", "latin2" ],
            name: "iso-8859-2"
        }, {
            labels: [ "csisolatin3", "iso-8859-3", "iso_8859-3", "iso-ir-109", "l3", "latin3" ],
            name: "iso-8859-3"
        }, {
            labels: [ "csisolatin4", "iso-8859-4", "iso_8859-4", "iso-ir-110", "l4", "latin4" ],
            name: "iso-8859-4"
        }, {
            labels: [ "csisolatincyrillic", "cyrillic", "iso-8859-5", "iso_8859-5", "iso-ir-144" ],
            name: "iso-8859-5"
        }, {
            labels: [ "arabic", "csisolatinarabic", "ecma-114", "iso-8859-6", "iso_8859-6", "iso-ir-127" ],
            name: "iso-8859-6"
        }, {
            labels: [ "csisolatingreek", "ecma-118", "elot_928", "greek", "greek8", "iso-8859-7", "iso_8859-7", "iso-ir-126" ],
            name: "iso-8859-7"
        }, {
            labels: [ "csisolatinhebrew", "hebrew", "iso-8859-8", "iso-8859-8-i", "iso-ir-138", "iso_8859-8", "visual" ],
            name: "iso-8859-8"
        }, {
            labels: [ "csisolatin6", "iso-8859-10", "iso-ir-157", "iso8859-10", "l6", "latin6" ],
            name: "iso-8859-10"
        }, {
            labels: [ "iso-8859-13" ],
            name: "iso-8859-13"
        }, {
            labels: [ "iso-8859-14", "iso8859-14" ],
            name: "iso-8859-14"
        }, {
            labels: [ "iso-8859-15", "iso_8859-15" ],
            name: "iso-8859-15"
        }, {
            labels: [ "iso-8859-16" ],
            name: "iso-8859-16"
        }, {
            labels: [ "koi8-r", "koi8_r" ],
            name: "koi8-r"
        }, {
            labels: [ "koi8-u" ],
            name: "koi8-u"
        }, {
            labels: [ "csmacintosh", "mac", "macintosh", "x-mac-roman" ],
            name: "macintosh"
        }, {
            labels: [ "iso-8859-11", "tis-620", "windows-874" ],
            name: "windows-874"
        }, {
            labels: [ "windows-1250", "x-cp1250" ],
            name: "windows-1250"
        }, {
            labels: [ "windows-1251", "x-cp1251" ],
            name: "windows-1251"
        }, {
            labels: [ "ascii", "ansi_x3.4-1968", "csisolatin1", "iso-8859-1", "iso8859-1", "iso_8859-1", "l1", "latin1", "us-ascii", "windows-1252" ],
            name: "windows-1252"
        }, {
            labels: [ "cp1253", "windows-1253" ],
            name: "windows-1253"
        }, {
            labels: [ "csisolatin5", "iso-8859-9", "iso-ir-148", "l5", "latin5", "windows-1254" ],
            name: "windows-1254"
        }, {
            labels: [ "cp1255", "windows-1255" ],
            name: "windows-1255"
        }, {
            labels: [ "cp1256", "windows-1256" ],
            name: "windows-1256"
        }, {
            labels: [ "windows-1257" ],
            name: "windows-1257"
        }, {
            labels: [ "cp1258", "windows-1258" ],
            name: "windows-1258"
        }, {
            labels: [ "x-mac-cyrillic", "x-mac-ukrainian" ],
            name: "x-mac-cyrillic"
        } ],
        heading: "Legacy single-byte encodings"
    }, {
        encodings: [ {
            labels: [ "chinese", "csgb2312", "csiso58gb231280", "gb2312", "gbk", "gb_2312", "gb_2312-80", "iso-ir-58", "x-gbk" ],
            name: "gbk"
        }, {
            labels: [ "gb18030" ],
            name: "gb18030"
        }, {
            labels: [ "hz-gb-2312" ],
            name: "hz-gb-2312"
        } ],
        heading: "Legacy multi-byte Chinese (simplified) encodings"
    }, {
        encodings: [ {
            labels: [ "big5", "big5-hkscs", "cn-big5", "csbig5", "x-x-big5" ],
            name: "big5"
        } ],
        heading: "Legacy multi-byte Chinese (traditional) encodings"
    }, {
        encodings: [ {
            labels: [ "cseucpkdfmtjapanese", "euc-jp", "x-euc-jp" ],
            name: "euc-jp"
        }, {
            labels: [ "csiso2022jp", "iso-2022-jp" ],
            name: "iso-2022-jp"
        }, {
            labels: [ "csshiftjis", "ms_kanji", "shift-jis", "shift_jis", "sjis", "windows-31j", "x-sjis" ],
            name: "shift_jis"
        } ],
        heading: "Legacy multi-byte Japanese encodings"
    }, {
        encodings: [ {
            labels: [ "cseuckr", "csksc56011987", "euc-kr", "iso-ir-149", "korean", "ks_c_5601-1987", "ks_c_5601-1989", "ksc5601", "ksc_5601", "windows-949" ],
            name: "euc-kr"
        }, {
            labels: [ "csiso2022kr", "iso-2022-kr" ],
            name: "iso-2022-kr"
        } ],
        heading: "Legacy multi-byte Korean encodings"
    }, {
        encodings: [ {
            labels: [ "utf-16", "utf-16le" ],
            name: "utf-16"
        }, {
            labels: [ "utf-16be" ],
            name: "utf-16be"
        } ],
        heading: "Legacy utf-16 encodings"
    } ], q = {}, K = {};
    U.forEach(function(e) {
        e.encodings.forEach(function(e) {
            q[e.name] = e, e.labels.forEach(function(t) {
                K[t] = e;
            });
        });
    });
    var z = e["encoding-indexes"] || {};
    q["utf-8"].getEncoder = function(e) {
        return new h(e);
    }, q["utf-8"].getDecoder = function(e) {
        return new m(e);
    }, function() {
        [ "ibm864", "ibm866", "iso-8859-2", "iso-8859-3", "iso-8859-4", "iso-8859-5", "iso-8859-6", "iso-8859-7", "iso-8859-8", "iso-8859-10", "iso-8859-13", "iso-8859-14", "iso-8859-15", "iso-8859-16", "koi8-r", "koi8-u", "macintosh", "windows-874", "windows-1250", "windows-1251", "windows-1252", "windows-1253", "windows-1254", "windows-1255", "windows-1256", "windows-1257", "windows-1258", "x-mac-cyrillic" ].forEach(function(e) {
            var t = q[e], n = z[e];
            t.getDecoder = function(e) {
                return new g(n, e);
            }, t.getEncoder = function(e) {
                return new y(n, e);
            };
        });
    }(), q.gbk.getEncoder = function(e) {
        return new S(!1, e);
    }, q.gbk.getDecoder = function(e) {
        return new v(!1, e);
    }, q.gb18030.getEncoder = function(e) {
        return new S(!0, e);
    }, q.gb18030.getDecoder = function(e) {
        return new v(!0, e);
    }, q["hz-gb-2312"].getEncoder = function(e) {
        return new A(e);
    }, q["hz-gb-2312"].getDecoder = function(e) {
        return new b(e);
    }, q.big5.getEncoder = function(e) {
        return new I(e);
    }, q.big5.getDecoder = function(e) {
        return new C(e);
    }, q["euc-jp"].getEncoder = function(e) {
        return new M(e);
    }, q["euc-jp"].getDecoder = function(e) {
        return new w(e);
    }, q["iso-2022-jp"].getEncoder = function(e) {
        return new E(e);
    }, q["iso-2022-jp"].getDecoder = function(e) {
        return new T(e);
    }, q.shift_jis.getEncoder = function(e) {
        return new _(e);
    }, q.shift_jis.getDecoder = function(e) {
        return new D(e);
    }, q["euc-kr"].getEncoder = function(e) {
        return new x(e);
    }, q["euc-kr"].getDecoder = function(e) {
        return new R(e);
    }, q["iso-2022-kr"].getEncoder = function(e) {
        return new P(e);
    }, q["iso-2022-kr"].getDecoder = function(e) {
        return new N(e);
    }, q["utf-16"].getEncoder = function(e) {
        return new F(!1, e);
    }, q["utf-16"].getDecoder = function(e) {
        return new k(!1, e);
    }, q["utf-16be"].getEncoder = function(e) {
        return new F(!0, e);
    }, q["utf-16be"].getDecoder = function(e) {
        return new k(!0, e);
    };
    var W = "utf-8";
    j.prototype = {
        encode: function(e, t) {
            e = e ? String(e) : "", t = Object(t), this._streaming || (this._encoder = this._encoding.getEncoder(this._options)), 
            this._streaming = Boolean(t.stream);
            for (var n = [], r = new i(n), a = new o(e); a.get() !== H; ) this._encoder.encode(r, a);
            if (!this._streaming) {
                var s;
                do s = this._encoder.encode(r, a); while (s !== B);
                this._encoder = null;
            }
            return new Uint8Array(n);
        }
    }, L.prototype = {
        decode: function(e, t) {
            if (e && !("buffer" in e && "byteOffset" in e && "byteLength" in e)) throw new TypeError("Expected ArrayBufferView");
            e || (e = new Uint8Array(0)), t = Object(t), this._streaming || (this._decoder = this._encoding.getDecoder(this._options)), 
            this._streaming = Boolean(t.stream);
            var n = new Uint8Array(e.buffer, e.byteOffset, e.byteLength), i = new r(n), o = O(this._encoding.name, i);
            if (c(o) !== this._encoding) throw new Error("BOM mismatch");
            for (var s, u = new a(); i.get() !== B; ) s = this._decoder.decode(i), null !== s && s !== H && u.emit(s);
            if (!this._streaming) {
                do s = this._decoder.decode(i), null !== s && s !== H && u.emit(s); while (s !== H);
                this._decoder = null;
            }
            return u.string();
        }
    }, e.TextEncoder = e.TextEncoder || j, e.TextDecoder = e.TextDecoder || L;
})(this);