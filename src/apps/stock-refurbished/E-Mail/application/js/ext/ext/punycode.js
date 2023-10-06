(function(e) {
    function o(e) {
        throw RangeError(T[e]);
    }
    function n(e, o) {
        for (var n = e.length; n--; ) e[n] = o(e[n]);
        return e;
    }
    function r(e, o) {
        return n(e.split(M), o).join(".");
    }
    function t(e) {
        for (var o, n, r = [], t = 0, u = e.length; u > t; ) o = e.charCodeAt(t++), o >= 55296 && 56319 >= o && u > t ? (n = e.charCodeAt(t++), 
        56320 == (64512 & n) ? r.push(((1023 & o) << 10) + (1023 & n) + 65536) : (r.push(o), 
        t--)) : r.push(o);
        return r;
    }
    function u(e) {
        return n(e, function(e) {
            var o = "";
            return e > 65535 && (e -= 65536, o += q(55296 | 1023 & e >>> 10), e = 56320 | 1023 & e), 
            o += q(e);
        }).join("");
    }
    function i(e) {
        return 10 > e - 48 ? e - 22 : 26 > e - 65 ? e - 65 : 26 > e - 97 ? e - 97 : j;
    }
    function f(e, o) {
        return e + 22 + 75 * (26 > e) - ((0 != o) << 5);
    }
    function c(e, o, n) {
        var r = 0;
        for (e = n ? O(e / y) : e >> 1, e += O(e / o); e > E * b >> 1; r += j) e = O(e / E);
        return O(r + (E + 1) * e / (e + C));
    }
    function d(e) {
        var n, r, t, f, d, l, s, a, p, h, v = [], m = e.length, g = 0, C = I, y = A;
        for (r = e.lastIndexOf(F), 0 > r && (r = 0), t = 0; r > t; ++t) e.charCodeAt(t) >= 128 && o("not-basic"), 
        v.push(e.charCodeAt(t));
        for (f = r > 0 ? r + 1 : 0; m > f; ) {
            for (d = g, l = 1, s = j; f >= m && o("invalid-input"), a = i(e.charCodeAt(f++)), 
            (a >= j || a > O((w - g) / l)) && o("overflow"), g += a * l, p = y >= s ? x : s >= y + b ? b : s - y, 
            !(p > a); s += j) h = j - p, l > O(w / h) && o("overflow"), l *= h;
            n = v.length + 1, y = c(g - d, n, 0 == d), O(g / n) > w - C && o("overflow"), C += O(g / n), 
            g %= n, v.splice(g++, 0, C);
        }
        return u(v);
    }
    function l(e) {
        var n, r, u, i, d, l, s, a, p, h, v, m, g, C, y, H = [];
        for (e = t(e), m = e.length, n = I, r = 0, d = A, l = 0; m > l; ++l) v = e[l], 128 > v && H.push(q(v));
        for (u = i = H.length, i && H.push(F); m > u; ) {
            for (s = w, l = 0; m > l; ++l) v = e[l], v >= n && s > v && (s = v);
            for (g = u + 1, s - n > O((w - r) / g) && o("overflow"), r += (s - n) * g, n = s, 
            l = 0; m > l; ++l) if (v = e[l], n > v && ++r > w && o("overflow"), v == n) {
                for (a = r, p = j; h = d >= p ? x : p >= d + b ? b : p - d, !(h > a); p += j) y = a - h, 
                C = j - h, H.push(q(f(h + y % C, 0))), a = O(y / C);
                H.push(q(f(a, 0))), d = c(r, g, u == i), r = 0, ++u;
            }
            ++r, ++n;
        }
        return H.join("");
    }
    function s(e) {
        return r(e, function(e) {
            return H.test(e) ? d(e.slice(4).toLowerCase()) : e;
        });
    }
    function a(e) {
        return r(e, function(e) {
            return L.test(e) ? "xn--" + l(e) : e;
        });
    }
    var p = "object" == typeof exports && exports, h = "object" == typeof module && module && module.exports == p && module, v = "object" == typeof global && global;
    (v.global === v || v.window === v) && (e = v);
    var m, g, w = 2147483647, j = 36, x = 1, b = 26, C = 38, y = 700, A = 72, I = 128, F = "-", H = /^xn--/, L = /[^ -~]/, M = /\x2E|\u3002|\uFF0E|\uFF61/g, T = {
        overflow: "Overflow: input needs wider integers to process",
        "not-basic": "Illegal input >= 0x80 (not a basic code point)",
        "invalid-input": "Invalid input"
    }, E = j - x, O = Math.floor, q = String.fromCharCode;
    if (m = {
        version: "1.2.4",
        ucs2: {
            decode: t,
            encode: u
        },
        decode: d,
        encode: l,
        toASCII: a,
        toUnicode: s
    }, "function" == typeof define && "object" == typeof define.amd && define.amd) define("punycode", [], function() {
        return m;
    }); else if (p && !p.nodeType) if (h) h.exports = m; else for (g in m) m.hasOwnProperty(g) && (p[g] = m[g]); else e.punycode = m;
})(this);