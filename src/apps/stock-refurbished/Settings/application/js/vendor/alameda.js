var requirejs, require, define;
! function (global, undef) {
    function hasProp(e, t) {
        return hasOwn.call(e, t)
    }

    function getOwn(e, t) {
        return e && hasProp(e, t) && e[t]
    }

    function eachProp(e, t) {
        var n;
        for (n in e)
            if (hasProp(e, n) && t(e[n], n)) break
    }

    function mixin(e, t, n, i) {
        return t && eachProp(t, function (t, o) {
            (n || !hasProp(e, o)) && (!i || "object" != typeof t || !t || Array.isArray(t) || "function" == typeof t || t instanceof RegExp ? e[o] = t : (e[o] || (e[o] = {}), mixin(e[o], t, n, i)))
        }), e
    }

    function getGlobal(e) {
        if (!e) return e;
        var t = global;
        return e.split(".").forEach(function (e) {
            t = t[e]
        }), t
    }

    function newContext(e) {
        function t(e) {
            var t, n, i = e.length;
            for (t = 0; i > t; t++)
                if (n = e[t], "." === n) e.splice(t, 1), t -= 1;
                else if (".." === n) {
                if (1 === t && (".." === e[2] || ".." === e[0])) break;
                t > 0 && (e.splice(t - 1, 2), t -= 2)
            }
        }

        function n(e, n, i) {
            var o, r, a, s, c, u, l, d, f, p, h, g = n && n.split("/"),
                m = g,
                v = D.map,
                _ = v && v["*"];
            if (e && "." === e.charAt(0) && (n ? (m = g.slice(0, g.length - 1), e = e.split("/"), l = e.length - 1, D.nodeIdCompat && jsSuffixRegExp.test(e[l]) && (e[l] = e[l].replace(jsSuffixRegExp, "")), e = m.concat(e), t(e), e = e.join("/")) : 0 === e.indexOf("./") && (e = e.substring(2))), i && v && (g || _)) {
                a = e.split("/");
                e: for (s = a.length; s > 0; s -= 1) {
                    if (u = a.slice(0, s).join("/"), g)
                        for (c = g.length; c > 0; c -= 1)
                            if (r = getOwn(v, g.slice(0, c).join("/")), r && (r = getOwn(r, u))) {
                                d = r, f = s;
                                break e
                            }! p && _ && getOwn(_, u) && (p = getOwn(_, u), h = s)
                }!d && p && (d = p, f = h), d && (a.splice(0, f, d), e = a.join("/"))
            }
            return o = getOwn(D.pkgs, e), o ? o : e
        }

        function i(e) {
            function t() {
                var t;
                return e.init && (t = e.init.apply(global, arguments)), t || e.exports && getGlobal(e.exports)
            }
            return t
        }

        function o(e) {
            var t, n, i, o;
            for (t = 0; t < queue.length; t += 1) {
                if ("string" != typeof queue[t][0]) {
                    if (!e) break;
                    queue[t].unshift(e), e = undef
                }
                i = queue.shift(), n = i[0], t -= 1, hasProp(k, n) || hasProp(O, n) || (hasProp(P, n) ? S.apply(undef, i) : O[n] = i)
            }
            e && (o = getOwn(D.shim, e) || {}, S(e, o.deps || [], o.exportsFn))
        }

        function r(e, t) {
            var i = function (n, r, a, s) {
                var c, u;
                if (t && o(), "string" == typeof n) {
                    if (A[n]) return A[n](e);
                    if (c = E(n, e, !0).id, !hasProp(k, c)) throw new Error("Not loaded: " + c);
                    return k[c]
                }
                return n && !Array.isArray(n) && (u = n, n = undef, Array.isArray(r) && (n = r, r = a, a = s), t) ? i.config(u)(n, r, a) : (r = r || function () {}, prim.nextTick(function () {
                    o(), S(undef, n || [], r, a, e)
                }), i)
            };
            return i.isBrowser = "undefined" != typeof document && "undefined" != typeof navigator, i.nameToUrl = function (e, t, n) {
                var o, r, a, s, c, u, l, d = getOwn(D.pkgs, e);
                if (d && (e = d), l = getOwn(H, e)) return i.nameToUrl(l, t, n);
                if (urlRegExp.test(e)) c = e + (t || "");
                else {
                    for (o = D.paths, r = e.split("/"), a = r.length; a > 0; a -= 1)
                        if (s = r.slice(0, a).join("/"), u = getOwn(o, s)) {
                            Array.isArray(u) && (u = u[0]), r.splice(0, a, u);
                            break
                        } c = r.join("/"), c += t || (/^data\:|\?/.test(c) || n ? "" : ".js"), c = ("/" === c.charAt(0) || c.match(/^[\w\+\.\-]+:/) ? "" : D.baseUrl) + c
                }
                return D.urlArgs ? c + ((-1 === c.indexOf("?") ? "?" : "&") + D.urlArgs) : c
            }, i.toUrl = function (t) {
                var o, r = t.lastIndexOf("."),
                    a = t.split("/")[0],
                    s = "." === a || ".." === a;
                return -1 !== r && (!s || r > 1) && (o = t.substring(r, t.length), t = t.substring(0, r)), i.nameToUrl(n(t, e), o, !0)
            }, i.defined = function (t) {
                return hasProp(k, E(t, e, !0).id)
            }, i.specified = function (t) {
                return t = E(t, e, !0).id, hasProp(k, t) || hasProp(P, t)
            }, i
        }

        function a(e, t, n) {
            e && (k[e] = n, requirejs.onResourceLoad && requirejs.onResourceLoad(C, t.map, t.deps)), t.finished = !0, t.resolve(n)
        }

        function s(e, t) {
            e.finished = !0, e.rejected = !0, e.reject(t)
        }

        function c(e) {
            return function (t) {
                return n(t, e, !0)
            }
        }

        function u(e) {
            var t = e.map.id,
                n = e.factory.apply(k[t], e.values);
            t ? n === undef && (e.cjsModule ? n = e.cjsModule.exports : e.usingExports && (n = k[t])) : x.splice(x.indexOf(e), 1), a(t, e, n)
        }

        function l(e, t) {
            this.rejected || this.depDefined[t] || (this.depDefined[t] = !0, this.depCount += 1, this.values[t] = e, this.depending || this.depCount !== this.depMax || u(this))
        }

        function d(e) {
            var t = {};
            return t.promise = prim(function (e, n) {
                t.resolve = e, t.reject = n
            }), t.map = e ? E(e, null, !0) : {}, t.depCount = 0, t.depMax = 0, t.values = [], t.depDefined = [], t.depFinished = l, t.map.pr && (t.deps = [E(t.map.pr)]), t
        }

        function f(e) {
            var t;
            return e ? (t = hasProp(P, e) && P[e], t || (t = P[e] = d(e))) : (t = d(), x.push(t)), t
        }

        function p(e, t) {
            return function (n) {
                e.rejected || (n.dynaId || (n.dynaId = "id" + (j += 1), n.requireModules = [t]), s(e, n))
            }
        }

        function h(e, t, n, i) {
            n.depMax += 1, L(e, t).then(function (e) {
                n.depFinished(e, i)
            }, p(n, e.id)).catch(p(n, n.map.id))
        }

        function g(e) {
            function t(t) {
                n || a(e, f(e), t)
            }
            var n;
            return t.error = function (t) {
                f(e).reject(t)
            }, t.fromText = function (t, i) {
                var r = f(e),
                    a = E(E(e).n),
                    c = a.id;
                n = !0, r.factory = function (e, t) {
                    return t
                }, i && (t = i), hasProp(D.config, e) && (D.config[c] = D.config[e]);
                try {
                    w.exec(t)
                } catch (u) {
                    s(r, new Error("fromText eval for " + c + " failed: " + u))
                }
                o(c), r.deps = [a], h(a, null, r, r.deps.length)
            }, t
        }

        function m(e, t, n) {
            e.load(t.n, r(n), g(t.id), {})
        }

        function v(e) {
            var t, n = e ? e.indexOf("!") : -1;
            return n > -1 && (t = e.substring(0, n), e = e.substring(n + 1, e.length)), [t, e]
        }

        function _(e, t, n) {
            var i = e.map.id;
            t[i] = !0, !e.finished && e.deps && e.deps.forEach(function (i) {
                var o = i.id,
                    r = !hasProp(A, o) && f(o);
                !r || r.finished || n[o] || (hasProp(t, o) ? e.deps.forEach(function (t, n) {
                    t.id === o && e.depFinished(k[o], n)
                }) : _(r, t, n))
            }), n[i] = !0
        }

        function y(e) {
            var t, n = [],
                i = 1e3 * D.waitSeconds,
                o = i && U + i < (new Date).getTime();
            0 === R && (e ? e.finished || _(e, {}, {}) : x.length && x.forEach(function (e) {
                _(e, {}, {})
            })), o ? (eachProp(P, function (e) {
                e.finished || n.push(e.map.id)
            }), t = new Error("Timeout for modules: " + n), t.requireModules = n, w.onError(t)) : (R || x.length) && (T || (T = !0, prim.nextTick(function () {
                T = !1, y()
            })))
        }

        function b(e) {
            prim.nextTick(function () {
                e.dynaId && B[e.dynaId] || (B[e.dynaId] = !0, w.onError(e))
            })
        }
        var w, S, E, L, A, T, I, C, k = {},
            O = {},
            D = {
                waitSeconds: 7,
                baseUrl: "./",
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            N = {},
            x = [],
            P = {},
            M = {},
            z = {},
            R = 0,
            U = (new Date).getTime(),
            j = 0,
            B = {},
            F = {},
            H = {};
        return I = "function" == typeof importScripts ? function (e) {
            var t = e.url;
            F[t] || (F[t] = !0, f(e.id), importScripts(t), o(e.id))
        } : function (e) {
            var t, n = e.id,
                i = e.url;
            F[i] || (F[i] = !0, t = document.createElement("script"), t.setAttribute("data-requiremodule", n), t.type = D.scriptType || "text/javascript", t.charset = "utf-8", t.async = !0, R += 1, t.addEventListener("load", function () {
                R -= 1, o(n)
            }, !1), t.addEventListener("error", function () {
                R -= 1;
                var e, i = getOwn(D.paths, n),
                    o = getOwn(P, n);
                i && Array.isArray(i) && i.length > 1 ? (t.parentNode.removeChild(t), i.shift(), o.map = E(n), I(o.map)) : (e = new Error("Load failed: " + n + ": " + t.src), e.requireModules = [n], f(n).reject(e))
            }, !1), t.src = i, document.head.appendChild(t))
        }, L = function (e, t) {
            var n, i, o = e.id,
                r = D.shim[o];
            if (hasProp(O, o)) n = O[o], delete O[o], S.apply(undef, n);
            else if (!hasProp(P, o))
                if (e.pr) {
                    if (!(i = getOwn(H, o))) return L(E(e.pr)).then(function (e) {
                        var n = E(o, t, !0),
                            i = n.id,
                            r = getOwn(D.shim, i);
                        return hasProp(z, i) || (z[i] = !0, r && r.deps ? w(r.deps, function () {
                            m(e, n, t)
                        }) : m(e, n, t)), f(i).promise
                    });
                    e.url = w.nameToUrl(i), I(e)
                } else r && r.deps ? w(r.deps, function () {
                    I(e)
                }) : I(e);
            return f(o).promise
        }, E = function (e, t, i) {
            if ("string" != typeof e) return e;
            var o, r, a, s, u, l = e + " & " + (t || "") + " & " + !!i;
            return a = v(e), s = a[0], e = a[1], !s && hasProp(N, l) ? N[l] : (s && (s = n(s, t, i), o = hasProp(k, s) && k[s]), s ? e = o && o.normalize ? o.normalize(e, c(t)) : n(e, t, i) : (e = n(e, t, i), a = v(e), s = a[0], e = a[1], r = w.nameToUrl(e)), u = {
                id: s ? s + "!" + e : e,
                n: e,
                pr: s,
                url: r
            }, s || (N[l] = u), u)
        }, A = {
            require: function (e) {
                return r(e)
            },
            exports: function (e) {
                var t = k[e];
                return "undefined" != typeof t ? t : k[e] = {}
            },
            module: function (e) {
                return {
                    id: e,
                    uri: "",
                    exports: A.exports(e),
                    config: function () {
                        return getOwn(D.config, e) || {}
                    }
                }
            }
        }, S = function (e, t, n, i, o) {
            if (!e || !hasProp(M, e)) {
                M[e] = !0;
                var r = f(e);
                t && !Array.isArray(t) && (n = t, t = []), r.promise.catch(i || b), o = o || e, "function" == typeof n ? (!t.length && n.length && (n.toString().replace(commentRegExp, "").replace(cjsRequireRegExp, function (e, n) {
                    t.push(n)
                }), t = (1 === n.length ? ["require"] : ["require", "exports", "module"]).concat(t)), r.factory = n, r.deps = t, r.depending = !0, t.forEach(function (n, i) {
                    var a;
                    t[i] = a = E(n, o, !0), n = a.id, "require" === n ? r.values[i] = A.require(e) : "exports" === n ? (r.values[i] = A.exports(e), r.usingExports = !0) : "module" === n ? r.values[i] = r.cjsModule = A.module(e) : void 0 === n ? r.values[i] = void 0 : h(a, o, r, i)
                }), r.depending = !1, r.depCount === r.depMax && u(r)) : e && a(e, r, n), U = (new Date).getTime(), e || y(r)
            }
        }, w = r(null, !0), w.config = function (t) {
            if (t.context && t.context !== e) return newContext(t.context).config(t);
            N = {}, t.baseUrl && "/" !== t.baseUrl.charAt(t.baseUrl.length - 1) && (t.baseUrl += "/");
            var n, o = D.shim,
                r = {
                    paths: !0,
                    bundles: !0,
                    config: !0,
                    map: !0
                };
            return eachProp(t, function (e, t) {
                r[t] ? (D[t] || (D[t] = {}), mixin(D[t], e, !0, !0)) : D[t] = e
            }), t.bundles && eachProp(t.bundles, function (e, t) {
                e.forEach(function (e) {
                    e !== t && (H[e] = t)
                })
            }), t.shim && (eachProp(t.shim, function (e, t) {
                Array.isArray(e) && (e = {
                    deps: e
                }), !e.exports && !e.init || e.exportsFn || (e.exportsFn = i(e)), o[t] = e
            }), D.shim = o), t.packages && t.packages.forEach(function (e) {
                var t, n;
                e = "string" == typeof e ? {
                    name: e
                } : e, n = e.name, t = e.location, t && (D.paths[n] = e.location), D.pkgs[n] = e.name + "/" + (e.main || "main").replace(currDirRegExp, "").replace(jsSuffixRegExp, "")
            }), n = D.definePrim, n && (O[n] = [n, [], function () {
                return prim
            }]), (t.deps || t.callback) && w(t.deps, t.callback), w
        }, w.onError = function (e) {
            throw e
        }, C = {
            id: e,
            defined: k,
            waiting: O,
            config: D,
            deferreds: P
        }, contexts[e] = C, w
    }
    var prim, topReq, dataMain, src, subPath, bootstrapConfig = requirejs || require,
        hasOwn = Object.prototype.hasOwnProperty,
        contexts = {},
        queue = [],
        currDirRegExp = /^\.\//,
        urlRegExp = /^\/|\:|\?|\.js$/,
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/gm,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/;
    "function" != typeof requirejs && (function () {
        function e() {
            s = 0;
            var e = u;
            for (u = []; e.length;) e.shift()()
        }

        function t(t) {
            u.push(t), s || (s = setTimeout(e, 0))
        }

        function n(e) {
            e()
        }

        function i(e) {
            var t = typeof e;
            return "object" === t || "function" === t
        }

        function o(e, t) {
            prim.nextTick(function () {
                e.forEach(function (e) {
                    e(t)
                })
            })
        }

        function r(e, t, n) {
            e.hasOwnProperty("v") ? prim.nextTick(function () {
                n(e.v)
            }) : t.push(n)
        }

        function a(e, t, n) {
            e.hasOwnProperty("e") ? prim.nextTick(function () {
                n(e.e)
            }) : t.push(n)
        }
        var s, c, u = [];
        c = "function" == typeof setImmediate ? setImmediate.bind() : "undefined" != typeof process && process.nextTick ? process.nextTick : "undefined" != typeof setTimeout ? t : n, prim = function l(e) {
            function t() {
                function e(e, u, l) {
                    if (!s) {
                        if (s = !0, n === e) return s = !1, r.reject(new TypeError("value is same promise")), void 0;
                        try {
                            var d = e && e.then;
                            i(e) && "function" == typeof d ? (a = t(), d.call(e, a.resolve, a.reject)) : (c[u] = e, o(l, e))
                        } catch (f) {
                            s = !1, r.reject(f)
                        }
                    }
                }
                var r, a, s = !1;
                return r = {
                    resolve: function (t) {
                        e(t, "v", u)
                    },
                    reject: function (t) {
                        e(t, "e", d)
                    }
                }
            }
            var n, s, c = {},
                u = [],
                d = [];
            s = t(), n = {
                then: function (e, t) {
                    var n = l(function (n, i) {
                        function o(e, t, o) {
                            try {
                                e && "function" == typeof e ? (o = e(o), n(o)) : t(o)
                            } catch (r) {
                                i(r)
                            }
                        }
                        r(c, u, o.bind(void 0, e, n)), a(c, d, o.bind(void 0, t, i))
                    });
                    return n
                },
                "catch": function (e) {
                    return n.then(null, e)
                }
            };
            try {
                e(s.resolve, s.reject)
            } catch (f) {
                s.reject(f)
            }
            return n
        }, prim.resolve = function (e) {
            return prim(function (t) {
                t(e)
            })
        }, prim.reject = function (e) {
            return prim(function (t, n) {
                n(e)
            })
        }, prim.cast = function (e) {
            return i(e) && "then" in e ? e : prim(function (t, n) {
                e instanceof Error ? n(e) : t(e)
            })
        }, prim.all = function (e) {
            return prim(function (t, n) {
                function i(e, n) {
                    a[e] = n, o += 1, o === r && t(a)
                }
                var o = 0,
                    r = e.length,
                    a = [];
                e.forEach(function (e, t) {
                    prim.cast(e).then(function (e) {
                        i(t, e)
                    }, function (e) {
                        n(e)
                    })
                })
            })
        }, prim.nextTick = c
    }(), requirejs = topReq = newContext("_"), "function" != typeof require && (require = topReq), topReq.exec = function (text) {
        return eval(text)
    }, topReq.contexts = contexts, define = function () {
        queue.push([].slice.call(arguments, 0))
    }, define.amd = {
        jQuery: !0
    }, bootstrapConfig && topReq.config(bootstrapConfig), topReq.isBrowser && !contexts._.config.skipDataMain && (dataMain = document.querySelectorAll("script[data-main]")[0], dataMain = dataMain && dataMain.getAttribute("data-main"), dataMain && (dataMain = dataMain.replace(jsSuffixRegExp, ""), bootstrapConfig && bootstrapConfig.baseUrl || (src = dataMain.split("/"), dataMain = src.pop(), subPath = src.length ? src.join("/") + "/" : "./", topReq.config({
        baseUrl: subPath
    })), topReq([dataMain]))))
}(this);