define([ "require" ], function() {
    function n(n) {
        var e = this;
        return "function" == typeof n && (n = n.call(this)), new Promise(function(r, o) {
            function i(t) {
                var e;
                try {
                    e = n.next(t);
                } catch (r) {
                    return o(r);
                }
                f(e);
            }
            function c(t) {
                var e;
                try {
                    e = n.throw(t);
                } catch (r) {
                    return o(r);
                }
                f(e);
            }
            function f(n) {
                if (n.done) return r(n.value);
                var o = t.call(e, n.value);
                return o && u(o) ? o.then(i, c) : c(new TypeError('You may only yield a function, promise, generator, array, or object, but the following object was passed: "' + String(n.value) + '"'));
            }
            i();
        });
    }
    function t(t) {
        return t ? u(t) ? t : c(t) || i(t) ? n.call(this, t) : "function" == typeof t ? e.call(this, t) : Array.isArray(t) ? r.call(this, t) : f(t) ? o.call(this, t) : t : t;
    }
    function e(n) {
        var t = this;
        return new Promise(function(e, r) {
            n.call(t, function(n, t) {
                return n ? r(n) : (arguments.length > 2 && (t = a.call(arguments, 1)), e(t), void 0);
            });
        });
    }
    function r(n) {
        return Promise.all(n.map(t, this));
    }
    function o(n) {
        function e(n, t) {
            r[t] = void 0, i.push(n.then(function(n) {
                r[t] = n;
            }));
        }
        for (var r = new n.constructor(), o = Object.keys(n), i = [], c = 0; c < o.length; c++) {
            var f = o[c], a = t.call(this, n[f]);
            a && u(a) ? e(a, f) : r[f] = n[f];
        }
        return Promise.all(i).then(function() {
            return r;
        });
    }
    function u(n) {
        return "function" == typeof n.then;
    }
    function i(n) {
        return "function" == typeof n.next && "function" == typeof n.throw;
    }
    function c(n) {
        var t = n.constructor;
        return t ? "GeneratorFunction" === t.name || "GeneratorFunction" === t.displayName ? !0 : i(t.prototype) : !1;
    }
    function f(n) {
        return Object == n.constructor;
    }
    var a = Array.prototype.slice;
    return n["default"] = n.co = n, n.wrap = function(t) {
        function e() {
            return n.call(this, t.apply(this, arguments));
        }
        return e.__generatorFunction__ = t, e;
    }, n;
});