(window.webpackJsonp = window.webpackJsonp || []).push([
    [0], {
        160: function (t, e, n) {
            t.exports = n(325)
        },
        161: function (t, e, n) {},
        168: function (t, e, n) {},
        170: function (t, e, n) {},
        172: function (t, e, n) {},
        175: function (t, e, n) {
            "use strict";
            n.r(e);
            var r = n(2),
                a = n(3),
                o = n(5),
                c = n(7),
                i = n(1),
                s = n(157),
                u = n.n(s),
                l = n(158),
                f = n.n(l),
                p = n(24),
                d = n(42);

            function h(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(i.a)(t);
                    if (e) {
                        var a = Object(i.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(c.a)(this, n)
                }
            }
            var v = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_.",
                b = "debug-forwarder",
                g = "/data/local/service/debug-forwarder",
                y = ".forwarder_token",
                m = "(mkdir -p ".concat(g, " && ") + "(cp ".concat("/data/media", "/tmp.").concat(b, ".bin ").concat(g, "/").concat(b, " || ") + "cp ".concat("/sdcard", "/tmp.").concat(b, ".bin ").concat(g, "/").concat(b, ") && ") + "echo 'Copied daemon to ".concat(g, "/' && ") + "chmod 700 ".concat(g, "/").concat(b, ") > ").concat("/sdcard/store-self-debug.log", " 2>&1; ") + "(md5sum ".concat(g, "/").concat(b, " | grep '^").concat("1d6a901d3237bfa56fdb8b85d593ed28", "' || ") + "(echo 'Failed to verify daemon hash' > ".concat("/sdcard/store-self-debug.log", " && false)) &&") + "".concat(g, "/").concat(b, " 6000 /data/local/debugger-socket 127.0.0.1") + ">/dev/null </dev/null 2>/dev/null & echo 'Started daemon'; ";
            var k = new(function (t) {
                Object(o.a)(n, t);
                var e = h(n);

                function n() {
                    var t;
                    return Object(r.a)(this, n), (t = e.call(this)).loading = null, t
                }
                return Object(a.a)(n, [{
                    key: "load",
                    value: function () {
                        this.loading = new Promise(function (t, e) {
                            function n(t) {
                                alert("Something went wrong with the daemon initialization.\nPlease manually follow the instructions at https://gitlab.com/affenull2345/kaios-self-debug and run the following command in 'adb shell'; then dismiss this dialog:\n\nprintf '".concat(t, "' > '").concat(g, "/").concat(y, "'\n\nIf the problem persists, please contact affenull2345@gmail.com and mention your phone model, firmware version and KaiOS version."))
                            }
                            for (var r = "", a = 0; a < 32; a++) r += v[Math.floor(Math.random() * v.length)];

                            function o() {
                                try {
                                    var e = navigator.engmodeExtension.startUniversalCommand(m + "printf '".concat(r, "' > '").concat(g, "/").concat(y, "'"), !0);
                                    e.onsuccess = function () {
                                        setTimeout(function () {
                                            return t(r)
                                        }, 500)
                                    }, e.onerror = function () {
                                        n(r), t(r)
                                    }
                                } catch (a) {
                                    n(r), t(r)
                                }
                            }
                            var c = new XMLHttpRequest;
                            c.open("GET", "/".concat(b, ".bin"), !0), c.responseType = "blob", c.onload = function () {
                                function t(t) {
                                    var e = t.addNamed(c.response, "tmp.".concat(b, ".bin"));
                                    e.onsuccess = function () {
                                        console.log("[self-debug] Daemon saved to sdcard0"), o()
                                    }, e.onerror = function () {
                                        console.error("[self-debug] Failed to save daemon", e.error), o()
                                    }
                                }
                                if (200 === c.status && c.response) {
                                    console.log("[self-debug] Loaded daemon", c.response);
                                    var e = navigator.getDeviceStorages("sdcard"),
                                        n = e[0].delete("tmp.".concat(b, ".bin"));
                                    n.onsuccess = function () {
                                        console.log("[self-debug] Deleted old daemon file on sdcard0"), t(e[0])
                                    }, n.onerror = function () {
                                        console.log("[self-debug] Did not delete old daemon file"), t(e[0])
                                    }
                                } else console.log("[self-debug] Could not load daemon, unexpected result"), o()
                            }, c.onerror = function () {
                                console.error("[self-debug] Could not load daemon, XHR failed"), o()
                            };
                            try {
                                c.send()
                            } catch (i) {
                                console.error("[self-debug] Could not load daemon", i), o()
                            }
                        }).then(function (t) {
                            return new Promise(function (e, n) {
                                var r = new u.a;
                                r.connect("127.0.0.1", 6e3, t, function () {
                                    e(r)
                                }), r.on("error", function (t) {
                                    n(new Error(t.name + " (" + t.message + ")"))
                                }), r.on("end", function (t) {
                                    n()
                                })
                            })
                        }).then(function (t) {
                            return new Promise(function (e, n) {
                                t.getWebapps(function (r, a) {
                                    r ? n(r) : e({
                                        client: t,
                                        webapps: a
                                    })
                                })
                            })
                        })
                    }
                }, {
                    key: "installPackage",
                    value: function (t, e, n) {
                        var r = this;
                        return this.loading || this.load(), this.loading.then(function (t) {
                            var r = "{" + n + "}";
                            return Object(p.a)(e).then(function (n) {
                                if (n.origin) {
                                    var a = new URL(n.origin);
                                    r = a.host
                                }
                                return new Promise(function (n, a) {
                                    console.log("[self-debug] appId=".concat(r, ", installing"), e), f()(e, function (e, o) {
                                        e && a(e), t.webapps.installPackaged(o, r, function (e) {
                                            t.webapps.close("app://".concat(r, "/manifest.webapp"), function (t) {
                                                t && console.info("Could not close app", t)
                                            }), e ? a(e) : n()
                                        })
                                    })
                                })
                            })
                        }).catch(function (t) {
                            return r.loading = null, Promise.reject(t)
                        })
                    }
                }, {
                    key: "name",
                    get: function () {
                        return "self-debug"
                    }
                }]), n
            }(d.b));
            e.default = k
        },
        194: function (t, e, n) {
            "use strict";
            n.r(e);
            var r = n(2),
                a = n(3),
                o = n(5),
                c = n(7),
                i = n(1),
                s = n(35),
                u = n(42);

            function l(t, e) {
                var n = "undefined" !== typeof Symbol && t[Symbol.iterator] || t["@@iterator"];
                if (!n) {
                    if (Array.isArray(t) || (n = function (t, e) {
                            if (!t) return;
                            if ("string" === typeof t) return f(t, e);
                            var n = Object.prototype.toString.call(t).slice(8, -1);
                            "Object" === n && t.constructor && (n = t.constructor.name);
                            if ("Map" === n || "Set" === n) return Array.from(t);
                            if ("Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return f(t, e)
                        }(t)) || e && t && "number" === typeof t.length) {
                        n && (t = n);
                        var r = 0,
                            a = function () {};
                        return {
                            s: a,
                            n: function () {
                                return r >= t.length ? {
                                    done: !0
                                } : {
                                    done: !1,
                                    value: t[r++]
                                }
                            },
                            e: function (t) {
                                throw t
                            },
                            f: a
                        }
                    }
                    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                }
                var o, c = !0,
                    i = !1;
                return {
                    s: function () {
                        n = n.call(t)
                    },
                    n: function () {
                        var t = n.next();
                        return c = t.done, t
                    },
                    e: function (t) {
                        i = !0, o = t
                    },
                    f: function () {
                        try {
                            c || null == n.return || n.return()
                        } finally {
                            if (i) throw o
                        }
                    }
                }
            }

            function f(t, e) {
                (null == e || e > t.length) && (e = t.length);
                for (var n = 0, r = new Array(e); n < e; n++) r[n] = t[n];
                return r
            }

            function p(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(i.a)(t);
                    if (e) {
                        var a = Object(i.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(c.a)(this, n)
                }
            }
            var d = null;

            function h() {
                return d || (d = new Promise(function (t, e) {
                    var n = navigator.mozApps.mgmt.getAll();
                    n.onsuccess = function () {
                        t(n.result)
                    }, n.onerror = function () {
                        e(new Error(n.error.name + " " + n.error.message))
                    }
                })), d
            }
            navigator.mozApps && navigator.mozApps.mgmt && (navigator.mozApps.mgmt.onuninstall = navigator.mozApps.mgmt.oninstall = function () {
                d = null, s.b.emit()
            });
            var v = function (t) {
                    Object(o.a)(n, t);
                    var e = p(n);

                    function n(t) {
                        var a;
                        return Object(r.a)(this, n), (a = e.call(this))._mozApp = t, a
                    }
                    return Object(a.a)(n, [{
                        key: "open",
                        value: function () {
                            this._mozApp.launch()
                        }
                    }, {
                        key: "uninstall",
                        value: function () {
                            var t = this;
                            return new Promise(function (e, n) {
                                var r = navigator.mozApps.mgmt.uninstall(t._mozApp);
                                r.onsuccess = function () {
                                    e()
                                }, r.onerror = function () {
                                    n(new Error(r.error.name + " " + r.error.message))
                                }
                            })
                        }
                    }, {
                        key: "version",
                        get: function () {
                            return this._mozApp.manifest.version
                        }
                    }]), n
                }(u.a),
                b = new(function (t) {
                    Object(o.a)(n, t);
                    var e = p(n);

                    function n() {
                        return Object(r.a)(this, n), e.apply(this, arguments)
                    }
                    return Object(a.a)(n, [{
                        key: "importPackage",
                        value: function (t, e) {
                            return navigator.mozApps.mgmt.import(t).then(function (t) {
                                return Promise.resolve()
                            }).catch(function (t) {
                                if (t instanceof DOMError) return Promise.reject(new Error(t.name + " " + t.message))
                            })
                        }
                    }, {
                        key: "checkInstalledByOrigin",
                        value: function (t) {
                            var e = new URL(t);
                            return h().then(function (t) {
                                var n, r = l(t);
                                try {
                                    for (r.s(); !(n = r.n()).done;) {
                                        var a = n.value;
                                        if (a.origin === e.origin || a.manifestURL === "app://".concat(e.origin, "/manifest.webapp")) return Promise.resolve(new v(a))
                                    }
                                } catch (o) {
                                    r.e(o)
                                } finally {
                                    r.f()
                                }
                            })
                        }
                    }, {
                        key: "checkInstalled",
                        value: function (t, e) {
                            return h().then(function (n) {
                                var r, a = l(n);
                                try {
                                    for (a.s(); !(r = a.n()).done;) {
                                        var o = r.value;
                                        if (o.manifestURL === t || o.manifestURL === "app://{".concat(e, "}/manifest.webapp") || o.origin === "app://{".concat(e, "}") || o.origin === e) return Promise.resolve(new v(o))
                                    }
                                } catch (c) {
                                    a.e(c)
                                } finally {
                                    a.f()
                                }
                            })
                        }
                    }, {
                        key: "name",
                        get: function () {
                            return "mozApps-import"
                        }
                    }]), n
                }(u.b));
            e.default = b
        },
        195: function (t, e, n) {},
        196: function (t, e, n) {},
        197: function (t, e, n) {},
        198: function (t, e, n) {},
        199: function (t, e, n) {},
        225: function (t, e) {},
        227: function (t, e) {},
        235: function (t, e) {},
        237: function (t, e) {},
        24: function (t, e, n) {
            "use strict";
            n.d(e, "b", function () {
                return s
            }), n.d(e, "c", function () {
                return u
            }), n.d(e, "a", function () {
                return f
            });
            var r = n(8),
                a = n.n(r),
                o = n(11),
                c = n(59),
                i = n.n(c);

            function s(t) {
                var e = new i.a;
                return e.file("metadata.json", JSON.stringify({
                    manifestURL: t.manifestURL
                })), e.file("application.zip", t.pkg), e.generateAsync({
                    type: "blob"
                })
            }

            function u(t) {
                return l.apply(this, arguments)
            }

            function l() {
                return (l = Object(o.a)(a.a.mark(function t(e) {
                    var n, r, o, c;
                    return a.a.wrap(function (t) {
                        for (;;) switch (t.prev = t.next) {
                            case 0:
                                return t.next = 2, i.a.loadAsync(e);
                            case 2:
                                if (n = t.sent, r = n.file("metadata.json")) {
                                    t.next = 6;
                                    break
                                }
                                throw new Error("Package is missing metadata file");
                            case 6:
                                return t.t0 = JSON, t.next = 9, r.async("string");
                            case 9:
                                if (t.t1 = t.sent, (o = t.t0.parse.call(t.t0, t.t1)).manifestURL) {
                                    t.next = 13;
                                    break
                                }
                                throw new Error("Metadata is missing manifestURL");
                            case 13:
                                if (c = n.file("application.zip")) {
                                    t.next = 16;
                                    break
                                }
                                throw new Error("Package is missing application.zip");
                            case 16:
                                return t.t2 = o.manifestURL, t.next = 19, c.async("blob");
                            case 19:
                                return t.t3 = t.sent, t.abrupt("return", {
                                    manifestURL: t.t2,
                                    pkg: t.t3
                                });
                            case 21:
                            case "end":
                                return t.stop()
                        }
                    }, t)
                }))).apply(this, arguments)
            }

            function f(t) {
                return p.apply(this, arguments)
            }

            function p() {
                return (p = Object(o.a)(a.a.mark(function t(e) {
                    var n, r;
                    return a.a.wrap(function (t) {
                        for (;;) switch (t.prev = t.next) {
                            case 0:
                                return t.next = 2, i.a.loadAsync(e);
                            case 2:
                                if (n = t.sent, r = n.file("manifest.webapp")) {
                                    t.next = 6;
                                    break
                                }
                                throw new Error("Package is missing manifest");
                            case 6:
                                return t.t0 = JSON, t.next = 9, r.async("string");
                            case 9:
                                return t.t1 = t.sent, t.abrupt("return", t.t0.parse.call(t.t0, t.t1));
                            case 11:
                            case "end":
                                return t.stop()
                        }
                    }, t)
                }))).apply(this, arguments)
            }
        },
        265: function (t, e) {},
        266: function (t, e) {},
        271: function (t, e) {},
        273: function (t, e) {},
        280: function (t, e) {},
        299: function (t, e) {},
        322: function (t, e, n) {},
        323: function (t, e, n) {},
        324: function (t, e, n) {},
        325: function (t, e, n) {
            "use strict";
            n.r(e);
            var r = n(0),
                a = (n(161), n(2)),
                o = n(3),
                c = n(5),
                i = n(7),
                s = n(1),
                u = (n(162), n(55)),
                l = n(20),
                f = n(58);
            n(163);

            function p(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var d = function (t) {
                Object(c.a)(n, t);
                var e = p(n);

                function n(t) {
                    var r;
                    return Object(a.a)(this, n), (r = e.call(this, t)).state = {
                        index: 0
                    }, r.childRefs = [], r
                }
                return Object(o.a)(n, [{
                    key: "componentDidMount",
                    value: function () {
                        this.handleKeyDown_bound = this.handleKeyDown.bind(this), document.addEventListener("keydown", this.handleKeyDown_bound)
                    }
                }, {
                    key: "componentWillUnmount",
                    value: function () {
                        document.removeEventListener("keydown", this.handleKeyDown_bound)
                    }
                }, {
                    key: "renderChildren",
                    value: function () {
                        var t = this;
                        return this.props.children.map(function (e, n) {
                            return Object(u.a)(e, {
                                isActive: t.state.index === n,
                                ref: function (e) {
                                    return t.childRefs[n] = e
                                }
                            })
                        })
                    }
                }, {
                    key: "render",
                    value: function () {
                        return Object(r.g)(1, "div", "kai-tabs", this.renderChildren(), 0)
                    }
                }, {
                    key: "handleKeyDown",
                    value: function (t) {
                        var e = this.state.index;
                        "ArrowLeft" === t.key ? (this.setTabActive(e, !1), --e < 0 && (e = this.props.children.length - 1), this.setTabActive(e, !0), this.setState({
                            index: e
                        }), this.props.onChangeIndex && this.props.onChangeIndex(e)) : "ArrowRight" === t.key && (this.setTabActive(e, !1), ++e >= this.props.children.length && (e = 0), this.setTabActive(e, !0), this.setState({
                            index: e
                        }), this.props.onChangeIndex && this.props.onChangeIndex(e))
                    }
                }, {
                    key: "setTabActive",
                    value: function (t, e) {
                        this.props.children.length > t && (this.props.children[t].props.isActive = e, e && this.childRefs[t] && Object(f.a)(Object(l.a)(this.childRefs[t]), {
                            behavior: "smooth",
                            block: "start",
                            inline: "center"
                        }))
                    }
                }]), n
            }(r.a);
            n(164);

            function h(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var v = function (t) {
                Object(c.a)(n, t);
                var e = h(n);

                function n() {
                    return Object(a.a)(this, n), e.apply(this, arguments)
                }
                return Object(o.a)(n, [{
                    key: "render",
                    value: function () {
                        var t = this.props.isActive ? "kai-tab-active" : "kai-tab-inactive";
                        return Object(r.g)(1, "div", t, Object(r.g)(1, "div", t + "-label", this.props.label, 0), 2)
                    }
                }]), n
            }(r.a);

            function b(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var g = function (t) {
                Object(c.a)(n, t);
                var e = b(n);

                function n(t) {
                    var r;
                    return Object(a.a)(this, n), (r = e.call(this, t)).state = {
                        active: 0
                    }, r
                }
                return Object(o.a)(n, [{
                    key: "handleChangeIndex",
                    value: function (t) {
                        this.setState({
                            active: t
                        })
                    }
                }, {
                    key: "renderTabs",
                    value: function () {
                        return this.props.tabLabels.map(function (t, e) {
                            return Object(r.c)(2, v, {
                                label: t
                            })
                        })
                    }
                }, {
                    key: "renderContent",
                    value: function () {
                        var t = this;
                        return this.props.children.map(function (e, n) {
                            return n === t.state.active ? e : null
                        })
                    }
                }, {
                    key: "render",
                    value: function () {
                        return Object(r.g)(1, "div", "kai-tab-view", [Object(r.g)(1, "div", "kai-tab-view-tabs", Object(r.c)(2, d, {
                            onChangeIndex: this.handleChangeIndex.bind(this),
                            children: this.renderTabs()
                        }), 2), Object(r.g)(1, "div", "kai-tab-view-content", this.renderContent(), 0)], 4)
                    }
                }]), n
            }(r.a);
            n(165), n(166);

            function y(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var m = function (t) {
                    Object(c.a)(n, t);
                    var e = y(n);

                    function n() {
                        return Object(a.a)(this, n), e.apply(this, arguments)
                    }
                    return Object(o.a)(n, [{
                        key: "handleClick",
                        value: function (t) {
                            t.preventDefault(), this.props.handleClick && this.props.handleClick()
                        }
                    }, {
                        key: "handleFocus",
                        value: function (t) {
                            t.preventDefault(), t.relatedTarget ? t.relatedTarget.focus() : t.currentTarget.blur()
                        }
                    }, {
                        key: "render",
                        value: function () {
                            var t = null;
                            return this.props.icon && (t = -1 === this.props.icon.toString().indexOf("kai-") ? Object(r.g)(1, "img", null, null, 1, {
                                src: this.props.icon,
                                width: 20,
                                height: 20,
                                alt: ""
                            }) : Object(r.g)(1, "span", this.props.icon)), Object(r.g)(1, "button", "kai-softkey-btn", [t, this.props.text], 0, {
                                id: this.props.id,
                                onClick: this.handleClick.bind(this),
                                onFocus: this.handleFocus.bind(this),
                                "data-icon": t ? "true" : null
                            })
                        }
                    }]), n
                }(r.a),
                k = function (t) {
                    Object(c.a)(n, t);
                    var e = y(n);

                    function n() {
                        var t;
                        Object(a.a)(this, n);
                        for (var r = arguments.length, o = new Array(r), c = 0; c < r; c++) o[c] = arguments[c];
                        return (t = e.call.apply(e, [this].concat(o))).handleKeyDown = function (e) {
                            switch (e.key) {
                                case "<":
                                case "SoftLeft":
                                    t.props.leftCallback && t.props.leftCallback();
                                    break;
                                case ">":
                                case "SoftRight":
                                    t.props.rightCallback && t.props.rightCallback();
                                    break;
                                case "Enter":
                                    t.props.centerCallback && t.props.centerCallback();
                                    break;
                                default:
                                    return
                            }
                            e.stopPropagation()
                        }, t
                    }
                    return Object(o.a)(n, [{
                        key: "componentDidMount",
                        value: function () {
                            this.keyboardReceiver = this.props.keyboardReceiver || document, this.keyboardReceiver.addEventListener("keydown", this.handleKeyDown)
                        }
                    }, {
                        key: "componentWillUnmount",
                        value: function () {
                            this.keyboardReceiver.removeEventListener("keydown", this.handleKeyDown)
                        }
                    }, {
                        key: "render",
                        value: function () {
                            return Object(r.g)(1, "div", "kai-softkey visible", [Object(r.c)(2, m, {
                                id: "sk-left",
                                pos: "left",
                                text: this.props.leftText,
                                icon: this.props.leftIcon,
                                handleClick: this.props.leftCallback
                            }), Object(r.c)(2, m, {
                                id: "sk-center",
                                pos: "center",
                                text: this.props.centerText,
                                icon: this.props.centerIcon,
                                handleClick: this.props.centerCallback
                            }), Object(r.c)(2, m, {
                                id: "sk-right",
                                pos: "right",
                                text: this.props.rightText,
                                icon: this.props.rightIcon,
                                handleClick: this.props.rightCallback
                            })], 4)
                        }
                    }]), n
                }(r.a);

            function O(t) {
                var e = t.children,
                    n = t.settings,
                    r = t.isActive,
                    a = Array.isArray(e) ? e[0] : e;
                return Object(u.a)(a, {
                    ref: r ? function (t) {
                        ! function (t, e) {
                            var n = Object(l.a)(t);
                            n && (setTimeout(function () {
                                n.focus()
                            }, 10), Object(f.a)(n, e))
                        }(t, n || {
                            behavior: "auto",
                            block: "nearest",
                            inline: "start"
                        })
                    } : null
                })
            }
            n(167), n(168);

            function j(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var w = document.getElementById("modal-root"),
                x = function (t) {
                    Object(c.a)(n, t);
                    var e = j(n);

                    function n(t) {
                        var r;
                        return Object(a.a)(this, n), (r = e.call(this, t)).handleKeydown = function (t) {
                            switch (t.stopPropagation(), "Enter" !== t.key && t.preventDefault(), t.key) {
                                case "Backspace":
                                    r.props.onClose && r.props.onClose();
                                    break;
                                case "ArrowDown":
                                    r.setState({
                                        selected: (r.state.selected + 1) % r.props.children.length || 0
                                    });
                                    break;
                                case "ArrowUp":
                                    r.setState({
                                        selected: (r.state.selected + r.props.children.length - 1) % r.props.children.length || 0
                                    })
                            }
                        }, r.el = document.createElement("div"), r.el.className = "kai-dialog", r.el.tabIndex = 0, r.state = {
                            selected: 0
                        }, r
                    }
                    return Object(o.a)(n, [{
                        key: "componentDidMount",
                        value: function () {
                            w.appendChild(this.el), this.el.addEventListener("keydown", this.handleKeydown)
                        }
                    }, {
                        key: "componentWillUnmount",
                        value: function () {
                            this.el.removeEventListener("keydown", this.handleKeydown), w.removeChild(this.el)
                        }
                    }, {
                        key: "render",
                        value: function () {
                            var t = this,
                                e = this.props,
                                n = e.header,
                                a = e.children,
                                o = e.onClose;
                            return Object(r.e)(Object(r.d)([Object(r.g)(1, "div", "kai-dialog-wrapper", [n && Object(r.g)(1, "div", "kai-dialog-header h1", n, 0), Object(r.g)(1, "div", "select-popup-container", a.map(function (e, n) {
                                return Object(r.c)(2, O, {
                                    isActive: t.state.selected === n,
                                    children: e
                                })
                            }), 0)], 0), Object(r.c)(2, k, {
                                leftText: "Cancel",
                                leftCallback: function () {
                                    o && o()
                                },
                                centerText: "Select",
                                centerCallback: function () {
                                    document.activeElement.dispatchEvent(new MouseEvent("click"))
                                },
                                keyboardReceiver: this.el
                            })], 4), this.el)
                        }
                    }]), n
                }(r.a);
            n(169), n(170);

            function R(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var S = function (t) {
                    Object(c.a)(n, t);
                    var e = R(n);

                    function n(t) {
                        var r;
                        return Object(a.a)(this, n), (r = e.call(this, t)).state = {
                            isFocused: !1
                        }, r
                    }
                    return Object(o.a)(n, [{
                        key: "handleFocus",
                        value: function () {
                            this.buttonRef && this.buttonRef.focus()
                        }
                    }, {
                        key: "handleButtonFocus",
                        value: function (t) {
                            this.setState({
                                isFocused: t
                            })
                        }
                    }, {
                        key: "render",
                        value: function () {
                            var t = this,
                                e = "kai-rbl-button-input-".concat(this.state.isFocused ? "focused" : "unfocused"),
                                n = "kai-rbl".concat(this.state.isFocused ? " kai-rbl-focused" : "");
                            return Object(r.g)(1, "div", n, [Object(r.g)(1, "div", "kai-rbl-line left", Object(r.g)(1, "div", "kai-rbl-primary", this.props.children, 0), 2), Object(r.g)(1, "div", "kai-rbl-button", Object(r.g)(64, "input", e, null, 1, {
                                tabIndex: -1,
                                type: "radio",
                                checked: this.props.isChecked,
                                onFocus: function () {
                                    return t.handleButtonFocus(!0)
                                },
                                onBlur: function () {
                                    return t.handleButtonFocus(!1)
                                },
                                onClick: function () {
                                    return t.props.onSelect && t.props.onSelect()
                                }
                            }, null, function (e) {
                                return t.buttonRef = e
                            }), 2)], 4, {
                                tabIndex: -1,
                                onFocus: function () {
                                    return t.handleFocus()
                                }
                            })
                        }
                    }]), n
                }(r.a),
                P = null;

            function C(t) {
                (P || (P = new Promise(function (t, e) {
                    navigator.mozApps && navigator.mozApps.getSelf || (console.log("No mozApps interface, will disable toaster"), e(new Error("No toaster")));
                    var n = navigator.mozApps.getSelf();
                    n.onsuccess = function () {
                        n.result.connect("systoaster").then(function (e) {
                            t(e)
                        }).catch(function (t) {
                            console.log("Disabling toaster due to connection error", t), e()
                        })
                    }, n.onerror = function () {
                        console.log("Disabling toaster, failed to getSelf()"), e()
                    }
                }))).then(function (e) {
                    e.forEach(function (e) {
                        e.postMessage({
                            message: t
                        })
                    })
                }).catch(function (e) {
                    console.warn(e), alert(t)
                })
            }
            n(171), n(172);

            function _(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var A = function (t) {
                    Object(c.a)(n, t);
                    var e = _(n);

                    function n(t) {
                        var r;
                        return Object(a.a)(this, n), (r = e.call(this, t)).state = {
                            focused: !1
                        }, r
                    }
                    return Object(o.a)(n, [{
                        key: "render",
                        value: function () {
                            var t = this,
                                e = this.state.focused ? "kai-text-input kai-text-input--focused item-selected" : "kai-text-input";
                            return Object(r.g)(1, "div", e, [Object(r.g)(1, "label", "kai-text-input-label p-thi", this.props.label, 0), Object(r.g)(64, "input", "kai-text-input-input p-pri", null, 1, {
                                type: this.props.type,
                                onBlur: this.handleBlur.bind(this),
                                onChange: this.handleChange.bind(this),
                                value: this.props.value,
                                placeholder: this.props.placeholder
                            }, null, function (e) {
                                return t.inp = e
                            })], 4, {
                                id: this.props.id,
                                tabIndex: 0,
                                onFocus: this.handleFocus.bind(this)
                            })
                        }
                    }, {
                        key: "handleChange",
                        value: function () {
                            this.props.value = this.inp.value, this.props.onChange && this.props.onChange()
                        }
                    }, {
                        key: "handleFocus",
                        value: function () {
                            this.props.onFocus && this.props.onFocus(), this.setState({
                                focused: !0
                            }), this.inp.focus()
                        }
                    }, {
                        key: "handleBlur",
                        value: function () {
                            this.props.onBlur && this.props.onBlur(), this.setState({
                                focused: !1
                            })
                        }
                    }]), n
                }(r.a),
                E = n(34),
                I = n(35);
            n(195);

            function T(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var B = function (t) {
                Object(c.a)(n, t);
                var e = T(n);

                function n(t) {
                    var r;
                    return Object(a.a)(this, n), (r = e.call(this, t)).state = {
                        extendedMetadata: null
                    }, r
                }
                return Object(o.a)(n, [{
                    key: "renderExtendedMetadata",
                    value: function () {
                        var t = this;
                        if (!this.state.extendedMetadata) return this.props.app.getExtendedMetadata().then(function (e) {
                            t.setState({
                                extendedMetadata: e
                            })
                        }).catch(function (e) {
                            t.setState({
                                extendedMetadata: {
                                    error: e
                                }
                            })
                        }), null;
                        var e = this.state.extendedMetadata;
                        return Object.keys(e).map(function (t) {
                            switch (t) {
                                case "developer":
                                    return Object(r.g)(1, "div", null, [Object(r.g)(1, "b", null, "Developers", 16), e[t].name], 0);
                                case "license":
                                    return Object(r.g)(1, "div", null, [Object(r.g)(1, "b", null, "License", 16), e[t]], 0);
                                case "download_count":
                                    return Object(r.g)(1, "div", null, [Object(r.g)(1, "b", null, "Downloads", 16), e[t]], 0);
                                case "error":
                                    return Object(r.g)(1, "div", null, [Object(r.g)(1, "b", null, "Failed to get metadata:", 16), "".concat(e[t])], 0);
                                default:
                                    return null
                            }
                        })
                    }
                }, {
                    key: "render",
                    value: function () {
                        return Object(r.g)(1, "div", "AppDetail", [Object(r.g)(1, "div", "p-sec", this.props.app.description, 0), Object(r.g)(1, "div", "AppDetailMetadata", this.renderExtendedMetadata(), 0)], 4)
                    }
                }]), n
            }(r.a);
            n(196);

            function L(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var M = document.getElementById("modal-root"),
                D = function (t) {
                    Object(c.a)(n, t);
                    var e = L(n);

                    function n(t) {
                        var r;
                        return Object(a.a)(this, n), (r = e.call(this, t)).el = document.createElement("div"), r.el.className = "AppViewContainer", r.el.tabIndex = 0, r.state = {
                            status: "",
                            installState: "unknown",
                            locked: !1
                        }, r
                    }
                    return Object(o.a)(n, [{
                        key: "open",
                        value: function () {
                            this.installedApp.open()
                        }
                    }, {
                        key: "uninstall",
                        value: function () {
                            var t = this;
                            console.log(this.installedApp), "not-installed" !== this.state.installState && this.installedApp && window.confirm("Uninstall " + this.props.app.name + "?") && this.installedApp.uninstall().then(function () {
                                t.setState({
                                    status: "Uninstalled",
                                    installState: "not-installed"
                                })
                            })
                        }
                    }, {
                        key: "install",
                        value: function () {
                            var t = this;
                            this.setState({
                                status: "Installing",
                                locked: !0
                            }), Object(E.a)(this.props.app, function (e, n) {
                                t.setState({
                                    status: "number" === typeof n ? "".concat(e, " (").concat(n, "%)") : e
                                })
                            }).then(function () {
                                t.setState({
                                    status: "Installed!",
                                    locked: !1
                                })
                            }).catch(function (e) {
                                alert("While installing app: " + e), t.setState({
                                    status: "Failed",
                                    locked: !1
                                })
                            })
                        }
                    }, {
                        key: "handleKeyDown",
                        value: function (t) {
                            t.stopPropagation(), t.preventDefault();
                            var e = null;
                            switch (t.key) {
                                case "Backspace":
                                    !this.state.locked && this.props.onClose && this.props.onClose();
                                    break;
                                case "ArrowDown":
                                    this.boxRef && (e = Object(l.a)(this.boxRef)), e && e.scrollBy({
                                        top: 10,
                                        left: 0
                                    });
                                    break;
                                case "ArrowUp":
                                    this.boxRef && (e = Object(l.a)(this.boxRef)), e && e.scrollBy({
                                        top: -10,
                                        left: 0
                                    })
                            }
                        }
                    }, {
                        key: "componentDidMount",
                        value: function () {
                            M.appendChild(this.el), this.handleKeyDown_bound = this.handleKeyDown.bind(this), this.el.addEventListener("keydown", this.handleKeyDown_bound), this.el.focus(), I.b.subscribe(this.updateInstallState.bind(this))
                        }
                    }, {
                        key: "componentWillUnmount",
                        value: function () {
                            M.removeChild(this.el), this.el.removeEventListener("keydown", this.handleKeyDown_bound), I.b.unsubscribe(this.updateInstallState.bind(this))
                        }
                    }, {
                        key: "updateInstallState",
                        value: function () {
                            var t = this;
                            Object(I.a)(this.props.app).then(function (e) {
                                if (e) return t.installedApp = e, t.props.app.checkUpdatable(e.version).then(function (e) {
                                    t.setState({
                                        installState: e ? "updatable" : "installed"
                                    })
                                });
                                t.setState({
                                    installState: "not-installed"
                                })
                            }).catch(function (e) {
                                console.error("Install check failed", e), t.setState({
                                    status: "Install check failed",
                                    installState: "check-failed"
                                })
                            }), this.setState({
                                installState: "checking"
                            })
                        }
                    }, {
                        key: "render",
                        value: function () {
                            var t = this;
                            return "unknown" === this.state.installState && this.updateInstallState(), Object(r.e)(Object(r.d)([Object(r.g)(1, "div", "AppView", [Object(r.g)(1, "div", "AppViewHeader", [Object(r.g)(1, "h3", null, this.props.app.name, 0), Object(r.g)(1, "div", "AppViewStatus", this.state.status, 0)], 4, {
                                style: "background-image: url(".concat(this.props.app.findIcon(60), ")")
                            }), Object(r.c)(2, B, {
                                app: this.props.app
                            })], 4, null, null, function (e) {
                                return t.boxRef = e
                            }), Object(r.c)(2, k, {
                                leftText: "",
                                centerText: this.state.locked ? "" : "installed" === this.state.installState ? "Open" : "updatable" === this.state.installState ? "Update" : "Install",
                                rightText: this.state.locked ? "" : "not-installed" === this.state.installState ? "" : "checking" === this.state.installState ? "Checking..." : "Uninstall",
                                centerCallback: this.state.locked ? null : "installed" === this.state.installState ? this.open.bind(this) : this.install.bind(this),
                                rightCallback: this.state.locked ? null : this.uninstall.bind(this),
                                keyboardReceiver: this.el
                            })], 4), this.el)
                        }
                    }]), n
                }(r.a);
            n(197);

            function U(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var F = function (t) {
                Object(c.a)(n, t);
                var e = U(n);

                function n(t) {
                    var r;
                    return Object(a.a)(this, n), (r = e.call(this, t)).state = {
                        focused: !1,
                        open: !1
                    }, r
                }
                return Object(o.a)(n, [{
                    key: "render",
                    value: function () {
                        var t = this;
                        return Object(r.g)(1, "div", "app-button", [Object(r.g)(1, "button", "app-button-button", this.props.app.name, 0, {
                            style: "background-image: url(".concat(this.props.app.findIcon(56), ")"),
                            onBlur: function () {
                                return t.handleBlur()
                            },
                            onClick: function () {
                                return t.handleClick()
                            }
                        }, null, function (e) {
                            return t.btn = e
                        }), this.state.open ? Object(r.c)(2, D, {
                            app: this.props.app,
                            onClose: function () {
                                return t.handleFocus()
                            }
                        }) : null], 0, {
                            tabIndex: 0,
                            onFocus: function () {
                                return t.handleFocus()
                            }
                        })
                    }
                }, {
                    key: "handleClick",
                    value: function () {
                        this.setState({
                            focused: !0,
                            open: !0
                        })
                    }
                }, {
                    key: "handleFocus",
                    value: function () {
                        this.setState({
                            focused: !0,
                            open: !1
                        }), this.btn.focus()
                    }
                }, {
                    key: "handleBlur",
                    value: function () {
                        this.setState({
                            focused: !1
                        })
                    }
                }]), n
            }(r.a);
            n(198);

            function K(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var z = function (t) {
                Object(c.a)(n, t);
                var e = K(n);

                function n(t) {
                    var r;
                    return Object(a.a)(this, n), (r = e.call(this, t)).handleKeydown = function (t) {
                        var e = r.state.selected;
                        "ArrowUp" === t.key ? (t.preventDefault(), --e >= 0 ? r.setState({
                            selected: e
                        }) : -1 === e && r.props.canNavigateUp && (r.setState({
                            selected: e
                        }), r.props.onNavigateUp())) : "ArrowDown" === t.key && (t.preventDefault(), e++, r.state.loading || (e < r.apps.length && r.setState({
                            selected: e
                        }), e >= r.apps.length - 2 && !r.state.isLastPage && (r.setState({
                            loading: !0,
                            selected: e,
                            isLastPage: !1
                        }), r.loadNextPage())))
                    }, r.apps = [], r.state = {
                        loading: !1,
                        loadedPages: 0,
                        isLastPage: !1,
                        selected: 0
                    }, r.savedFilters = t.filters, r
                }
                return Object(o.a)(n, [{
                    key: "componentDidMount",
                    value: function () {
                        document.addEventListener("keydown", this.handleKeydown)
                    }
                }, {
                    key: "componentWillUnmount",
                    value: function () {
                        document.removeEventListener("keydown", this.handleKeydown)
                    }
                }, {
                    key: "loadNextPage",
                    value: function (t) {
                        var e = this,
                            n = this.state.loadedPages + 1;
                        return this.props.store.getApps(this.props.filters, 10 * (n - 1), 10).then(function (t) {
                            var r = t.apps,
                                a = t.isLastPage;
                            console.log("[AppList] Is last page:", a), e.apps = e.apps.concat(r), e.setState({
                                loading: !1,
                                loadedPages: n,
                                isLastPage: a
                            })
                        }).catch(function (t) {
                            console.error("Failed to load next page", t), setTimeout(function () {
                                e.loadNextPage()
                            }, 3e3)
                        })
                    }
                }, {
                    key: "renderApps",
                    value: function () {
                        var t = this;
                        return this.props.filters !== this.savedFilters ? (this.savedFilters = this.props.filters, this.apps = [], this.loading = !1, void this.setState({
                            loading: !1,
                            loadedPages: 0,
                            isLastPage: !1,
                            selected: 0
                        })) : 0 === this.state.loadedPages ? (this.loading || (this.loading = !0, this.loadNextPage()), "Loading...") : 0 === this.apps.length ? Object(r.g)(1, "div", "AppListEmpty p-pri", "No results.", 16) : this.apps.map(function (e, n) {
                            return Object(r.c)(2, O, {
                                isActive: t.props.useFocus && t.state.selected === n,
                                settings: {
                                    behavior: "smooth",
                                    block: "center",
                                    inline: "start",
                                    duration: 600
                                },
                                children: Object(r.c)(2, F, {
                                    app: e
                                })
                            })
                        })
                    }
                }, {
                    key: "render",
                    value: function () {
                        return Object(r.g)(1, "div", "AppList", this.renderApps(), 0)
                    }
                }]), n
            }(r.a);
            n(199);

            function q(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var N = function (t) {
                    Object(c.a)(n, t);
                    var e = q(n);

                    function n(t) {
                        var r;
                        return Object(a.a)(this, n), (r = e.call(this, t)).handleKeydown = function (t) {
                            "Backspace" === t.key && r.props.onClose && (t.preventDefault(), r.props.onClose())
                        }, r.handleKeyup = function (t) {
                            "Enter" === t.key && r.state.searchActive && r.updateKeywords()
                        }, r.state = {
                            keywords: [],
                            searchActive: !0
                        }, r.appList = null, r.search = "", r
                    }
                    return Object(o.a)(n, [{
                        key: "activateSearch",
                        value: function () {
                            var t = Object(l.a)(this.inp);
                            t && (t.focus(), this.setState({
                                searchActive: !0
                            }))
                        }
                    }, {
                        key: "componentDidMount",
                        value: function () {
                            this.activateSearch(), document.addEventListener("keydown", this.handleKeydown), document.addEventListener("keyup", this.handleKeyup)
                        }
                    }, {
                        key: "componentWillUnmount",
                        value: function () {
                            document.removeEventListener("keydown", this.handleKeydown), document.removeEventListener("keyup", this.handleKeyup)
                        }
                    }, {
                        key: "render",
                        value: function () {
                            var t = this;
                            return this.appList || (this.appList = this.state.keywords.length > 0 ? Object(r.c)(2, z, {
                                store: this.props.store,
                                filters: {
                                    keywords: this.state.keywords
                                },
                                useFocus: !0,
                                canNavigateUp: !0,
                                onNavigateUp: function () {
                                    return t.activateSearch()
                                }
                            }) : Object(r.g)(1, "div", "SearchPlaceholder p-pri", "Please enter a search term", 16)), Object(r.g)(1, "div", "Search", [Object(r.c)(2, A, {
                                onChange: function () {
                                    return t.search = t.inp.props.value
                                },
                                onFocus: function () {
                                    return t.setState({
                                        searchActive: !0
                                    })
                                },
                                onBlur: function () {
                                    return t.setState({
                                        searchActive: !1
                                    })
                                }
                            }, null, function (e) {
                                return t.inp = e
                            }), this.appList, Object(r.c)(2, k, {
                                leftText: "",
                                centerText: this.state.searchActive ? "Search" : "Select",
                                rightText: ""
                            })], 0)
                        }
                    }, {
                        key: "updateKeywords",
                        value: function () {
                            this.appList = null, this.setState({
                                keywords: this.search.replace(/[.,; ]+/gi, " ").split(" ").filter(function (t) {
                                    return t
                                })
                            })
                        }
                    }]), n
                }(r.a),
                G = n(8),
                H = n.n(G),
                J = n(11),
                W = Object(o.a)(function t() {
                    Object(a.a)(this, t)
                }),
                V = Object(o.a)(function t() {
                    Object(a.a)(this, t)
                }),
                $ = n(56),
                X = n.n($);

            function Q(t, e) {
                var n = "undefined" !== typeof Symbol && t[Symbol.iterator] || t["@@iterator"];
                if (!n) {
                    if (Array.isArray(t) || (n = function (t, e) {
                            if (!t) return;
                            if ("string" === typeof t) return Y(t, e);
                            var n = Object.prototype.toString.call(t).slice(8, -1);
                            "Object" === n && t.constructor && (n = t.constructor.name);
                            if ("Map" === n || "Set" === n) return Array.from(t);
                            if ("Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Y(t, e)
                        }(t)) || e && t && "number" === typeof t.length) {
                        n && (t = n);
                        var r = 0,
                            a = function () {};
                        return {
                            s: a,
                            n: function () {
                                return r >= t.length ? {
                                    done: !0
                                } : {
                                    done: !1,
                                    value: t[r++]
                                }
                            },
                            e: function (t) {
                                throw t
                            },
                            f: a
                        }
                    }
                    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
                }
                var o, c = !0,
                    i = !1;
                return {
                    s: function () {
                        n = n.call(t)
                    },
                    n: function () {
                        var t = n.next();
                        return c = t.done, t
                    },
                    e: function (t) {
                        i = !0, o = t
                    },
                    f: function () {
                        try {
                            c || null == n.return || n.return()
                        } finally {
                            if (i) throw o
                        }
                    }
                }
            }

            function Y(t, e) {
                (null == e || e > t.length) && (e = t.length);
                for (var n = 0, r = new Array(e); n < e; n++) r[n] = t[n];
                return r
            }

            function Z(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var tt = ["https://banana-hackers.gitlab.io/store-db", "https://bananahackers.github.io/store-db"],
                et = ["https://bhackers.uber.space/srs/v1"];

            function nt(t, e, n, r, a) {
                return new Promise(function (o, c) {
                    var i = new XMLHttpRequest({
                        mozSystem: !0
                    });
                    i.open(t, e, !0), i.responseType = n, i.ontimeout = function () {
                        c(new Error("Request Timeout"))
                    }, i.onload = function () {
                        200 === i.status ? o(i.response) : i.status > 200 && i.status < 300 ? o(null) : c(new Error("Got HTTP ".concat(i.status, " status")))
                    }, i.onprogress = function (t) {
                        a && a(t.loaded, t.total)
                    }, i.onerror = function (t) {
                        c(new Error("Request Failure"))
                    }, i.send(r)
                })
            }

            function rt(t, e) {
                return at.apply(this, arguments)
            }

            function at() {
                return (at = Object(J.a)(H.a.mark(function t(e, n) {
                    var r, a, o, c;
                    return H.a.wrap(function (t) {
                        for (;;) switch (t.prev = t.next) {
                            case 0:
                                r = Q(e), t.prev = 1, r.s();
                            case 3:
                                if ((a = r.n()).done) {
                                    t.next = 18;
                                    break
                                }
                                return o = a.value, t.prev = 5, t.next = 8, nt("GET", o + "/download_counter/count/" + n);
                            case 8:
                                if ("OK" === (c = t.sent)) {
                                    t.next = 11;
                                    break
                                }
                                throw new Error(c);
                            case 11:
                                t.next = 16;
                                break;
                            case 13:
                                t.prev = 13, t.t0 = t.catch(5), console.error("Server ".concat(o, " failed with"), t.t0);
                            case 16:
                                t.next = 3;
                                break;
                            case 18:
                                t.next = 23;
                                break;
                            case 20:
                                t.prev = 20, t.t1 = t.catch(1), r.e(t.t1);
                            case 23:
                                return t.prev = 23, r.f(), t.finish(23);
                            case 26:
                            case "end":
                                return t.stop()
                        }
                    }, t, null, [
                        [1, 20, 23, 26],
                        [5, 13]
                    ])
                }))).apply(this, arguments)
            }

            function ot(t, e) {
                return ct.apply(this, arguments)
            }

            function ct() {
                return (ct = Object(J.a)(H.a.mark(function t(e, n) {
                    var r, a, o, c, i, s, u, l;
                    return H.a.wrap(function (t) {
                        for (;;) switch (t.prev = t.next) {
                            case 0:
                                r = /[^a-z]/g, a = "bhv2srs-" + e[0].replace(r, "$"), o = Q(e), t.prev = 3, o.s();
                            case 5:
                                if ((c = o.n()).done) {
                                    t.next = 22;
                                    break
                                }
                                return i = c.value, t.prev = 7, t.next = 10, nt("GET", i + "/download_counter");
                            case 10:
                                return s = t.sent, u = JSON.parse(s), localStorage.setItem(a, s), n.downloadCount = u, t.abrupt("return", n);
                            case 17:
                                t.prev = 17, t.t0 = t.catch(7), console.error("Server ".concat(i, " failed with"), t.t0);
                            case 20:
                                t.next = 5;
                                break;
                            case 22:
                                t.next = 27;
                                break;
                            case 24:
                                t.prev = 24, t.t1 = t.catch(3), o.e(t.t1);
                            case 27:
                                return t.prev = 27, o.f(), t.finish(27);
                            case 30:
                                if (!(l = localStorage.getItem(a))) {
                                    t.next = 34;
                                    break
                                }
                                return n.downloadCount = JSON.parse(l), t.abrupt("return", n);
                            case 34:
                                throw new Error("Could not load SRS data");
                            case 35:
                            case "end":
                                return t.stop()
                        }
                    }, t, null, [
                        [3, 24, 27, 30],
                        [7, 17]
                    ])
                }))).apply(this, arguments)
            }

            function it() {
                return (it = Object(J.a)(H.a.mark(function t(e, n) {
                    var r, a, o, c, i;
                    return H.a.wrap(function (t) {
                        for (;;) switch (t.prev = t.next) {
                            case 0:
                                r = Q(e), t.prev = 1, r.s();
                            case 3:
                                if ((a = r.n()).done) {
                                    t.next = 21;
                                    break
                                }
                                return o = a.value, t.prev = 5, t.next = 8, nt("GET", o + "/data.json", "string", null);
                            case 8:
                                return c = t.sent, i = JSON.parse(c), localStorage.setItem("bhv2-save", c), t.next = 13, ot(n, i);
                            case 13:
                                return t.abrupt("return", t.sent);
                            case 16:
                                t.prev = 16, t.t0 = t.catch(5), console.error("Server ".concat(o, " failed with"), t.t0);
                            case 19:
                                t.next = 3;
                                break;
                            case 21:
                                t.next = 26;
                                break;
                            case 23:
                                t.prev = 23, t.t1 = t.catch(1), r.e(t.t1);
                            case 26:
                                return t.prev = 26, r.f(), t.finish(26);
                            case 29:
                                if (!localStorage.getItem("bhv2-save")) {
                                    t.next = 31;
                                    break
                                }
                                return t.abrupt("return", JSON.parse(localStorage.getItem("bhv2-save")));
                            case 31:
                                throw new Error("Could not load data");
                            case 32:
                            case "end":
                                return t.stop()
                        }
                    }, t, null, [
                        [1, 23, 26, 29],
                        [5, 16]
                    ])
                }))).apply(this, arguments)
            }
            var st = function (t) {
                    Object(c.a)(n, t);
                    var e = Z(n);

                    function n(t, r, o, c) {
                        var i;
                        return Object(a.a)(this, n), (i = e.call(this))._data = r, i._dataVersion = c, i._downloadCount = o || 0, i.ratings = t, i.blobPromise = i.manifestPromise = null, i
                    }
                    return Object(o.a)(n, [{
                        key: "name",
                        get: function () {
                            return this._data.name
                        }
                    }, {
                        key: "description",
                        get: function () {
                            return this._data.description
                        }
                    }, {
                        key: "loadManifest",
                        value: function () {
                            return this._dataVersion < 3 ? Promise.resolve({
                                version: this._data.download.version
                            }) : (this.manifestPromise || (this.manifestPromise = nt("GET", this._data.download.manifest, "string", null).then(function (t) {
                                return Promise.resolve(JSON.parse(t))
                            })), this.manifestPromise)
                        }
                    }, {
                        key: "getExtendedMetadata",
                        value: function () {
                            var t = this;
                            return this.loadManifest().then(function (e) {
                                return Promise.resolve({
                                    developer: {
                                        name: t._data.author.map(function (t) {
                                            return t.replace(/\s*<[^>]*>$/, "")
                                        }).join(", ")
                                    },
                                    source: t._data.git_repo,
                                    has_ads: t._data.has_ads,
                                    has_tracking: t._data.has_tracking,
                                    license: t._data.license,
                                    type: t._data.type,
                                    version: e.version,
                                    download_count: t._downloadCount
                                })
                            })
                        }
                    }, {
                        key: "findIcon",
                        value: function (t) {
                            return this._data.icon
                        }
                    }, {
                        key: "getInstallationMethod",
                        value: function () {
                            var t = this;
                            return ["importPackage", function () {
                                var e = Object(J.a)(H.a.mark(function e(n) {
                                    return H.a.wrap(function (e) {
                                        for (;;) switch (e.prev = e.next) {
                                            case 0:
                                                return t.blobPromise || (t.blobPromise = nt("GET", t._data.download.url, "blob", null, function (t, e) {
                                                    n("Downloading", Math.floor(t / e * 100))
                                                })), rt(t.ratings, t._data.slug), t._downloadCount++, e.next = 5, t.blobPromise;
                                            case 5:
                                                return e.t0 = e.sent, e.t1 = t._data.slug, e.t2 = [e.t0, e.t1], e.abrupt("return", {
                                                    args: e.t2
                                                });
                                            case 9:
                                            case "end":
                                                return e.stop()
                                        }
                                    }, e)
                                }));
                                return function (t) {
                                    return e.apply(this, arguments)
                                }
                            }()]
                        }
                    }, {
                        key: "getIdentificationMethod",
                        value: function () {
                            var t = this;
                            return this._dataVersion < 3 ? ["checkImported", Object(J.a)(H.a.mark(function e() {
                                return H.a.wrap(function (e) {
                                    for (;;) switch (e.prev = e.next) {
                                        case 0:
                                            return t.blobPromise || (t.blobPromise = nt("GET", t._data.download.url, "blob", null)), e.next = 3, t.blobPromise;
                                        case 3:
                                            return e.t0 = e.sent, e.t1 = t._data.slug, e.t2 = [e.t0, e.t1], e.abrupt("return", {
                                                args: e.t2
                                            });
                                        case 7:
                                        case "end":
                                            return e.stop()
                                    }
                                }, e)
                            }))] : ["checkInstalled", Object(J.a)(H.a.mark(function e() {
                                return H.a.wrap(function (e) {
                                    for (;;) switch (e.prev = e.next) {
                                        case 0:
                                            return e.t0 = t._data.download.manifest, e.next = 3, t.loadManifest();
                                        case 3:
                                            if (e.t1 = e.sent.origin, e.t1) {
                                                e.next = 6;
                                                break
                                            }
                                            e.t1 = t._data.slug;
                                        case 6:
                                            return e.t2 = e.t1, e.t3 = [e.t0, e.t2], e.abrupt("return", {
                                                args: e.t3
                                            });
                                        case 9:
                                        case "end":
                                            return e.stop()
                                    }
                                }, e)
                            }))]
                        }
                    }, {
                        key: "checkUpdatable",
                        value: function (t) {
                            return this.loadManifest().then(function (e) {
                                return Promise.resolve(!(!t || !e.version) && X()(e.version, t) > 0)
                            })
                        }
                    }]), n
                }(V),
                ut = function (t) {
                    Object(c.a)(n, t);
                    var e = Z(n);

                    function n() {
                        var t, r = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : tt,
                            o = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : et,
                            c = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "B-Hackers Store";
                        return Object(a.a)(this, n), (t = e.call(this)).servers = r, t.ratings = o, t.name = c, t
                    }
                    return Object(o.a)(n, [{
                        key: "load",
                        value: function () {
                            var t = this;
                            return function (t, e) {
                                return it.apply(this, arguments)
                            }(this.servers, this.ratings).then(function (e) {
                                t._data = e, console.log("[bhackers-v2] Got data", e), e.version < 3 ? console.log("[bhackers-v2] Old database version detected") : e.version > 3 && console.warn("[bhackers-v2] Database version too new!"), t.categories = [{
                                    name: "Most downloaded",
                                    id: "$popular",
                                    special: !0
                                }].concat(Object.keys(e.categories).map(function (t) {
                                    return {
                                        name: e.categories[t].name,
                                        id: t
                                    }
                                }))
                            })
                        }
                    }, {
                        key: "getApps",
                        value: function (t, e, n) {
                            var r = this,
                                a = this._data.apps;
                            t.keywords && (console.log("[bhackers-v2] Keywords:", t.keywords), a = a.map(function (e) {
                                var n = 0;
                                t.keywords.forEach(function (t) {
                                    t = t.toLowerCase(), e.name.toLowerCase() === t ? n += 5 : e.name.toLowerCase().includes(t) && (n += 2), e.meta.tags.replace(/; */i, ";").split(";").forEach(function (e) {
                                        e.toLowerCase() === t ? n += 3 : e.toLowerCase().includes(t) && (n += 1)
                                    }), e.description.toLowerCase().includes(t) && (n += 2)
                                });
                                var r = Object.create(e);
                                return r.searchScore = n, r
                            }));
                            var o = a.filter(function (e) {
                                var n = !0;
                                return t.categories && "$popular" !== t.categories[0].id && (n &= t.categories.some(function (t) {
                                    return e.meta.categories.includes(t.id)
                                })), t.keywords && (n &= e.searchScore > 0), n
                            });
                            return t.categories && "$popular" === t.categories[0].id && o.sort(function (t, e) {
                                return (r._data.downloadCount[e.slug] || 0) - (r._data.downloadCount[t.slug] || 0)
                            }), t.keywords && o.sort(function (t, e) {
                                return e.searchScore - t.searchScore
                            }), Promise.resolve({
                                apps: o.slice(e, e + n).map(function (t) {
                                    return new st(r.ratings, t, r._data.downloadCount[t.slug], r._data.version)
                                }),
                                isLastPage: e + n >= o.length
                            })
                        }
                    }]), n
                }(W),
                lt = n(9),
                ft = n(159),
                pt = function () {
                    function t(e, n, r) {
                        var o = this;
                        switch (Object(a.a)(this, t), this.auth = e, this.api = n, this.dev = r, e.method) {
                            case "api-key":
                                this.send({
                                    method: "POST",
                                    data: {
                                        brand: r.brand,
                                        device_id: r.imei,
                                        device_type: r.type,
                                        model: r.model,
                                        os: r.os,
                                        os_version: r.version,
                                        reference: r.cu
                                    },
                                    path: "/v3.0/applications/" + n.app.id + "/tokens",
                                    headers: {
                                        Authorization: "Key " + e.key
                                    },
                                    type: "json"
                                }).then(function (t) {
                                    o.token = t, o.onload()
                                }).catch(function (t) {
                                    o.onerror(t)
                                });
                                break;
                            default:
                                this.onerror(new Error("Unknown authentication method: " + e.method))
                        }
                    }
                    return Object(o.a)(t, [{
                        key: "send",
                        value: function (t) {
                            var e = this;
                            return new Promise(function (n, r) {
                                if (t.path)
                                    if (t.method) {
                                        var a, o = new XMLHttpRequest({
                                                mozSystem: !0
                                            }),
                                            c = t.path,
                                            i = ["POST", "PUT"].includes(t.method) ? t.contentType && "application/json" !== t.contentType ? t.data : JSON.stringify(t.data) : null;
                                        "/" === c[0] && (c = e.api.server.url + c), "blob" !== t.type && "arraybuffer" !== t.type || (o.responseType = t.type), o.open(t.method, c, !0), "object" === typeof t.headers && Object.keys(t.headers).forEach(function (e) {
                                            o.setRequestHeader(e, t.headers[e])
                                        }), o.setRequestHeader("Kai-API-Version", e.api.ver), o.setRequestHeader("Kai-Request-Info", 'ct="wifi", rt="auto", utc="' + Date.now() + '", utc_off="1", mcc="' + e.dev.mcc + '", mnc="' + e.dev.mnc + '", net_mcc="null", net_mnc="null"'), o.setRequestHeader("Kai-Device-Info", 'imei="' + e.dev.imei + '", curef="' + e.dev.cu + '"'), o.setRequestHeader("User-agent", e.dev.ua), o.setRequestHeader("Content-type", t.contentType || "application/json"), e.token && (a = {
                                            credentials: {
                                                id: e.token.kid,
                                                algorithm: "sha256",
                                                key: new lt.Buffer(e.token.mac_key, "base64")
                                            }
                                        }, i && (a.payload = i, a.contentType = t.contentType || "application/json"), o.setRequestHeader("Authorization", ft.client.header(c, t.method, a).header)), o.onerror = function () {
                                            r(new Error("request error"))
                                        }, o.onprogress = function (e) {
                                            t.reportProgress && t.reportProgress("Downloading", Math.floor(e.loaded / e.total * 100))
                                        }, o.onload = function () {
                                            var e = "";
                                            if (200 !== o.status && 201 !== o.status && 204 !== o.status) {
                                                if (o.responseText) try {
                                                    var a = JSON.parse(o.responseText);
                                                    e = " " + a.desc + ": " + a.cause
                                                } catch (c) {
                                                    e = " " + o.responseText
                                                }
                                                r("request error " + o.status + ": " + o.statusText + e)
                                            }
                                            if ("json" === t.type) try {
                                                n(JSON.parse(o.responseText))
                                            } catch (c) {
                                                r(c)
                                            } else n(o.response)
                                        }, o.send(i)
                                    } else r(new TypeError("request missing method"));
                                else r(new TypeError("request missing path"))
                            })
                        }
                    }]), t
                }();

            function dt(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }

            function ht() {
                var t = /(KAIOS|B2GOS)\/([^ ]*)/.exec(navigator.userAgent);
                return t ? t[2] : "2.5.4"
            }
            var vt = {
                    dev: {
                        model: "GoFlip2",
                        imei: "123456789012345",
                        type: 999999,
                        brand: "AlcatelOneTouch",
                        os: "KaiOS",
                        version: ht(),
                        ua: "Mozilla/5.0 (Mobile; GoFlip2; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/" + ht(),
                        cu: "4044O-2BAQUS1-R",
                        mcc: "0",
                        mnc: "0"
                    },
                    api: {
                        app: {
                            id: "CAlTn_6yQsgyJKrr-nCh",
                            name: "KaiOS Plus",
                            ver: "2.5.4"
                        },
                        server: {
                            url: "https://api.kaiostech.com"
                        },
                        ver: "3.0"
                    },
                    auth: {
                        method: "api-key",
                        key: "baJ_nea27HqSskijhZlT"
                    }
                },
                bt = function (t) {
                    Object(c.a)(n, t);
                    var e = dt(n);

                    function n(t, r) {
                        var o;
                        return Object(a.a)(this, n), (o = e.call(this)).requester = r, o._data = t, o
                    }
                    return Object(o.a)(n, [{
                        key: "name",
                        get: function () {
                            return this._data.display || this._data.name
                        }
                    }, {
                        key: "description",
                        get: function () {
                            return this._data.description
                        }
                    }, {
                        key: "findIcon",
                        value: function (t) {
                            if (this._data.thumbnail_url) return this._data.thumbnail_url;
                            var e = Object.keys(this._data.icons),
                                n = null,
                                r = null;
                            return e.forEach(function (e) {
                                var a = t - e;
                                a < 0 && (a = -a), (null === r || a < r) && (n = e, r = a)
                            }), n ? this._data.icons[n] : null
                        }
                    }, {
                        key: "loadManifest",
                        value: function () {
                            return this.manifestPromise || (this.manifestPromise = this.requester.send({
                                method: "GET",
                                path: this._data.manifest_url,
                                type: "json"
                            })), this.manifestPromise
                        }
                    }, {
                        key: "getExtendedMetadata",
                        value: function () {
                            var t = this;
                            return ("string" === typeof this._data.developer && "string" === typeof this._data.developer_url ? Promise.resolve({
                                name: this._data.developer,
                                url: this._data.developer_url
                            }) : this.loadManifest().then(function (t) {
                                return Promise.resolve(t.developer)
                            })).then(function (e) {
                                return Promise.resolve({
                                    developer: e,
                                    version: t._data.version,
                                    type: t._data.type
                                })
                            })
                        }
                    }, {
                        key: "getInstallationMethod",
                        value: function () {
                            var t = this;
                            return ["installPackage", function () {
                                var e = Object(J.a)(H.a.mark(function e(n) {
                                    return H.a.wrap(function (e) {
                                        for (;;) switch (e.prev = e.next) {
                                            case 0:
                                                if (t.blobPromise) {
                                                    e.next = 11;
                                                    break
                                                }
                                                if (e.t0 = t.requester, e.t1 = t._data.package_path, e.t1) {
                                                    e.next = 7;
                                                    break
                                                }
                                                return e.next = 6, t.loadManifest();
                                            case 6:
                                                e.t1 = e.sent.package_path;
                                            case 7:
                                                e.t2 = e.t1, e.t3 = n, e.t4 = {
                                                    method: "GET",
                                                    path: e.t2,
                                                    type: "blob",
                                                    reportProgress: e.t3
                                                }, t.blobPromise = e.t0.send.call(e.t0, e.t4);
                                            case 11:
                                                return e.t5 = t._data.manifest_url, e.next = 14, t.blobPromise;
                                            case 14:
                                                return e.t6 = e.sent, e.t7 = t._data.id, e.t8 = [e.t5, e.t6, e.t7], e.abrupt("return", {
                                                    args: e.t8
                                                });
                                            case 18:
                                            case "end":
                                                return e.stop()
                                        }
                                    }, e)
                                }));
                                return function (t) {
                                    return e.apply(this, arguments)
                                }
                            }()]
                        }
                    }, {
                        key: "getIdentificationMethod",
                        value: function () {
                            var t = this;
                            return ["checkInstalled", Object(J.a)(H.a.mark(function e() {
                                return H.a.wrap(function (e) {
                                    for (;;) switch (e.prev = e.next) {
                                        case 0:
                                            return e.t0 = t._data.manifest_url, e.next = 3, t.loadManifest();
                                        case 3:
                                            if (e.t1 = e.sent.origin, e.t1) {
                                                e.next = 6;
                                                break
                                            }
                                            e.t1 = t._data.id;
                                        case 6:
                                            return e.t2 = e.t1, e.t3 = [e.t0, e.t2], e.abrupt("return", {
                                                args: e.t3
                                            });
                                        case 9:
                                        case "end":
                                            return e.stop()
                                    }
                                }, e)
                            }))]
                        }
                    }, {
                        key: "checkUpdatable",
                        value: function (t) {
                            return Promise.resolve(!!t && X()(this._data.version, t) > 0)
                        }
                    }]), n
                }(V),
                gt = function (t) {
                    Object(c.a)(n, t);
                    var e = dt(n);

                    function n() {
                        return Object(a.a)(this, n), e.apply(this, arguments)
                    }
                    return Object(o.a)(n, [{
                        key: "load",
                        value: function () {
                            var t = this;
                            return this.loadPromise || (this.loadPromise = new Promise(function (e, n) {
                                t.requester = new pt(vt.auth, vt.api, vt.dev), t.requester.onload = function () {
                                    t.requester.send({
                                        method: "GET",
                                        path: "/v3.0/categories",
                                        type: "json"
                                    }).then(function (n) {
                                        console.log("[kaistone] Categories", n), t.categories = n, e()
                                    }).catch(n)
                                }, t.requester.onerror = function (t) {
                                    n(t)
                                }
                            }))
                        }
                    }, {
                        key: "getApps",
                        value: function (t, e, n) {
                            var r = this,
                                a = !1,
                                o = !1,
                                c = "/kc_ksfe/v1.0/apps";
                            return Array.isArray(t.keywords) && (a = !0, c = "https://search.kaiostech.com/v3/_search"), c += "?bookmark=false", c += "&imei=" + vt.dev.imei, a ? (c += "&platform=" + vt.dev.version, c += "&page=" + Math.floor(e / n), c += "&size=" + n) : (c += "&os=" + vt.dev.version, c += "&page_size=" + n, c += "&page_num=" + (1 + Math.floor(e / n))), c += "&mnc=" + vt.dev.mnc + "&mcc=" + vt.dev.mcc, t.categories && t.categories.length > 0 && (1 === t.categories.length ? c += "&category=" + encodeURIComponent(t.categories[0].code) : o = !0), a && (c += "&query=" + t.keywords.join(" "), c += "&locale=" + encodeURIComponent(navigator.language)), this.requester.send({
                                method: "GET",
                                type: "json",
                                path: c
                            }).then(function (e) {
                                var n = (a ? e.organic : e.apps).filter(function (e) {
                                    var n = !0;
                                    return o && (n &= t.categories.some(function (t) {
                                        return e.category_list.includes(t.code)
                                    })), n
                                });
                                return Promise.resolve({
                                    apps: n.map(function (t) {
                                        return new bt(t, r.requester)
                                    }),
                                    isLastPage: a ? e.page === e.total_pages - 1 : e.last_page
                                })
                            })
                        }
                    }, {
                        key: "name",
                        get: function () {
                            return "KaiStore (KaiStone backend)"
                        }
                    }]), n
                }(W);
            n(322);

            function yt(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var mt = function (t) {
                Object(c.a)(n, t);
                var e = yt(n);

                function n(t) {
                    var r;
                    return Object(a.a)(this, n), (r = e.call(this, t)).stores = [new ut, new ut(["https://storedb.opengiraffes.top"], ["https://opengiraffes-rating.herokuapp.com"], "OpenGiraffes (China)"), new gt], r.state = {
                        store: 0,
                        loaded: !1,
                        loading: !1,
                        searchOpen: !1,
                        error: null
                    }, r
                }
                return Object(o.a)(n, [{
                    key: "storeLoadComplete",
                    value: function (t) {
                        C(this.stores[t].name), this.state.store === t && this.setState({
                            loaded: !0,
                            loading: !1
                        })
                    }
                }, {
                    key: "render",
                    value: function () {
                        var t = this,
                            e = this.state.selecting && Object(r.c)(2, x, {
                                header: "Select source",
                                onClose: function () {
                                    return t.setState({
                                        selecting: !1
                                    })
                                },
                                children: this.stores.map(function (e, n) {
                                    return Object(r.c)(2, S, {
                                        isChecked: n === t.state.store,
                                        onSelect: function () {
                                            return t.setState({
                                                store: n,
                                                loaded: !1,
                                                loading: !1,
                                                selecting: !1,
                                                error: null
                                            })
                                        },
                                        children: e.name
                                    })
                                })
                            });
                        if (!this.state.loaded) return this.state.error ? Object(r.g)(1, "div", "Store", [Object(r.g)(1, "div", "StoreLoadFailed", [Object(r.g)(1, "h3", null, "Loading failed", 16), this.state.error], 0), Object(r.c)(2, k, {
                            leftText: "Quit",
                            centerText: "Retry",
                            rightText: "Switch",
                            leftCallback: function () {
                                return window.close()
                            },
                            centerCallback: function () {
                                return t.setState({
                                    loaded: !1,
                                    loading: !1,
                                    error: null
                                })
                            },
                            rightCallback: function () {
                                return t.setState({
                                    selecting: !0
                                })
                            }
                        }), e], 0) : (this.state.loading || (this.setState({
                            loading: !0,
                            loaded: !1,
                            error: null
                        }), this.stores[this.state.store].load().then(function () {
                            return t.storeLoadComplete(t.state.store)
                        }).catch(function (e) {
                            C("Failed"), t.setState({
                                loading: !1,
                                loaded: !1,
                                error: e.toString()
                            })
                        })), Object(r.g)(1, "div", "Store", "Loading...", 16));
                        if (this.state.searchOpen) return Object(r.c)(2, N, {
                            onClose: function () {
                                return t.setState({
                                    searchOpen: !1
                                })
                            },
                            store: this.stores[this.state.store]
                        });
                        var n = this.stores[this.state.store].categories.map(function (e) {
                                return Object(r.c)(2, z, {
                                    store: t.stores[t.state.store],
                                    filters: {
                                        categories: [e]
                                    },
                                    useFocus: !t.state.selecting
                                })
                            }),
                            a = this.stores[this.state.store].categories.map(function (t) {
                                return t.name
                            });
                        return Object(r.g)(1, "div", "Store", [Object(r.c)(2, g, {
                            tabLabels: a,
                            children: n
                        }), Object(r.c)(2, k, {
                            leftIcon: "kai-icon-search",
                            centerText: "Select",
                            rightText: "Switch",
                            leftCallback: function () {
                                return t.setState({
                                    searchOpen: !0
                                })
                            },
                            rightCallback: function () {
                                return t.setState({
                                    selecting: !0
                                })
                            }
                        }), e], 0)
                    }
                }]), n
            }(r.a);
            n(323);

            function kt(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var Ot = function (t) {
                Object(c.a)(n, t);
                var e = kt(n);

                function n(t) {
                    var r;
                    return Object(a.a)(this, n), (r = e.call(this, t)).cb = t.onSetup, r
                }
                return Object(o.a)(n, [{
                    key: "render",
                    value: function () {
                        return Object(r.g)(1, "div", "Setup", Object(r.c)(2, A, {
                            label: "Login"
                        }), 2)
                    }
                }, {
                    key: "handleSetupComplete",
                    value: function () {
                        this.cb()
                    }
                }]), n
            }(r.a);
            n(324);

            function jt(t) {
                var e = function () {
                    if ("undefined" === typeof Reflect || !Reflect.construct) return !1;
                    if (Reflect.construct.sham) return !1;
                    if ("function" === typeof Proxy) return !0;
                    try {
                        return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})), !0
                    } catch (t) {
                        return !1
                    }
                }();
                return function () {
                    var n, r = Object(s.a)(t);
                    if (e) {
                        var a = Object(s.a)(this).constructor;
                        n = Reflect.construct(r, arguments, a)
                    } else n = r.apply(this, arguments);
                    return Object(i.a)(this, n)
                }
            }
            var wt = function (t) {
                Object(c.a)(n, t);
                var e = jt(n);

                function n(t) {
                    var r;
                    return Object(a.a)(this, n), (r = e.call(this, t)).state = {
                        setupDone: !0
                    }, r
                }
                return Object(o.a)(n, [{
                    key: "render",
                    value: function () {
                        var t = this;
                        return this.state.setupDone ? Object(r.g)(1, "div", "App", Object(r.c)(2, mt), 2) : Object(r.g)(1, "div", "App", Object(r.c)(2, Ot, {
                            onSetup: function () {
                                return t.setState({
                                    setupDone: !0
                                })
                            }
                        }), 2)
                    }
                }]), n
            }(r.a);
            Boolean("localhost" === window.location.hostname || "[::1]" === window.location.hostname || window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/));
            navigator.mozSettings && navigator.mozSettings.createLock().set({
                "debugger.remote-mode": "adb-devtools"
            }), Object(r.j)(Object(r.c)(2, wt), document.getElementById("root")), "serviceWorker" in navigator && navigator.serviceWorker.ready.then(function (t) {
                t.unregister()
            })
        },
        34: function (t, e, n) {
            "use strict";
            n.d(e, "b", function () {
                return i
            }), n.d(e, "a", function () {
                return s
            });
            var r = n(8),
                a = n.n(r),
                o = n(57),
                c = n(11),
                i = [n(175).default, n(194).default];

            function s(t, e) {
                return u.apply(this, arguments)
            }

            function u() {
                return (u = Object(c.a)(a.a.mark(function t(e, n) {
                    var r, c, s, u, l, f, p, d;
                    return a.a.wrap(function (t) {
                        for (;;) switch (t.prev = t.next) {
                            case 0:
                                r = new Error("No installers found"), c = e.getInstallationMethod(), s = Object(o.a)(c, 2), u = s[0], l = s[1], f = a.a.mark(function t(e) {
                                    var o, c;
                                    return a.a.wrap(function (t) {
                                        for (;;) switch (t.prev = t.next) {
                                            case 0:
                                                return o = !1, t.next = 3, l(function (t, e) {
                                                    o || n(t, e)
                                                });
                                            case 3:
                                                return c = t.sent, o = !0, t.prev = 5, console.log("Trying with ".concat(i[e].name, ".").concat(u)), n("Installing [".concat(i[e].name, "]") + ("self-debug" === i[e].name ? " - be patient!" : "")), t.next = 10, i[e][u].apply(i[e], c.args);
                                            case 10:
                                                return t.t0 = t.sent, t.abrupt("return", {
                                                    v: t.t0
                                                });
                                            case 14:
                                                t.prev = 14, t.t1 = t.catch(5), console.error("Install error", t.t1), r = t.t1;
                                            case 18:
                                            case "end":
                                                return t.stop()
                                        }
                                    }, t, null, [
                                        [5, 14]
                                    ])
                                }), p = 0;
                            case 4:
                                if (!(p < i.length)) {
                                    t.next = 12;
                                    break
                                }
                                return t.delegateYield(f(p), "t0", 6);
                            case 6:
                                if ("object" !== typeof (d = t.t0)) {
                                    t.next = 9;
                                    break
                                }
                                return t.abrupt("return", d.v);
                            case 9:
                                p++, t.next = 4;
                                break;
                            case 12:
                                throw r;
                            case 13:
                            case "end":
                                return t.stop()
                        }
                    }, t)
                }))).apply(this, arguments)
            }
        },
        35: function (t, e, n) {
            "use strict";
            n.d(e, "a", function () {
                return u
            }), n.d(e, "b", function () {
                return s
            });
            var r = n(8),
                a = n.n(r),
                o = n(57),
                c = n(11),
                i = n(34),
                s = {
                    callbacks: [],
                    subscribe: function (t) {
                        this.callbacks.push(t)
                    },
                    unsubscribe: function (t) {
                        this.callbacks = this.callbacks.filter(function (e) {
                            return e !== t
                        })
                    },
                    emit: function () {
                        this.callbacks.forEach(function (t) {
                            return t()
                        })
                    }
                };

            function u(t) {
                return l.apply(this, arguments)
            }

            function l() {
                return (l = Object(c.a)(a.a.mark(function t(e) {
                    var n, r, c, s, u, l, f;
                    return a.a.wrap(function (t) {
                        for (;;) switch (t.prev = t.next) {
                            case 0:
                                n = new Error("No installers found"), r = e.getIdentificationMethod(), c = Object(o.a)(r, 2), s = c[0], u = c[1], l = 0;
                            case 3:
                                if (!(l < i.b.length)) {
                                    t.next = 20;
                                    break
                                }
                                return f = void 0, t.next = 7, u();
                            case 7:
                                return f = t.sent, t.prev = 8, t.next = 11, i.b[l][s].apply(i.b[l], f.args);
                            case 11:
                                return t.abrupt("return", t.sent);
                            case 14:
                                t.prev = 14, t.t0 = t.catch(8), n = t.t0;
                            case 17:
                                l++, t.next = 3;
                                break;
                            case 20:
                                throw n;
                            case 21:
                            case "end":
                                return t.stop()
                        }
                    }, t, null, [
                        [8, 14]
                    ])
                }))).apply(this, arguments)
            }
        },
        42: function (t, e, n) {
            "use strict";
            n.d(e, "b", function () {
                return u
            }), n.d(e, "a", function () {
                return l
            });
            var r = n(8),
                a = n.n(r),
                o = n(11),
                c = n(2),
                i = n(3),
                s = n(24),
                u = function () {
                    function t() {
                        Object(c.a)(this, t)
                    }
                    return Object(i.a)(t, [{
                        key: "importPackage",
                        value: function (t, e, n) {
                            var r = this;
                            return n ? Promise.reject(new Error("This installer cannot import apps")) : Object(s.c)(t).then(function (t) {
                                return r.installPackage(t.manifestURL, t.pkg, e, !0)
                            })
                        }
                    }, {
                        key: "checkImported",
                        value: function () {
                            var t = Object(o.a)(a.a.mark(function t(e, n, r) {
                                var o;
                                return a.a.wrap(function (t) {
                                    for (;;) switch (t.prev = t.next) {
                                        case 0:
                                            if (!r) {
                                                t.next = 2;
                                                break
                                            }
                                            throw new Error("This installer cannot checkImported");
                                        case 2:
                                            return t.next = 4, Object(s.c)(e);
                                        case 4:
                                            if (o = t.sent, t.t0 = this.checkInstalled(o.manifestURL, n, !0), t.t0) {
                                                t.next = 12;
                                                break
                                            }
                                            return t.t1 = this, t.next = 10, Object(s.a)(o.pkg);
                                        case 10:
                                            t.t2 = t.sent.origin, t.t0 = t.t1.checkInstalledByOrigin.call(t.t1, t.t2);
                                        case 12:
                                            return t.abrupt("return", t.t0);
                                        case 13:
                                        case "end":
                                            return t.stop()
                                    }
                                }, t, this)
                            }));
                            return function (e, n, r) {
                                return t.apply(this, arguments)
                            }
                        }()
                    }, {
                        key: "installPackage",
                        value: function (t, e, n, r) {
                            var a = this;
                            return r ? Promise.reject(new Error("This installer cannot install packages")) : Object(s.b)({
                                manifestURL: t,
                                pkg: e
                            }).then(function (t) {
                                return a.importPackage(t.pkg, n, !0)
                            })
                        }
                    }, {
                        key: "installHosted",
                        value: function (t) {
                            return Promise.reject(new Error("This installer does not support hosted apps"))
                        }
                    }, {
                        key: "checkInstalled",
                        value: function (t, e, n) {
                            return Promise.reject(new Error("This installer cannot checkInstalled"))
                        }
                    }, {
                        key: "checkInstalledByOrigin",
                        value: function (t) {
                            return !1
                        }
                    }]), t
                }(),
                l = Object(i.a)(function t() {
                    Object(c.a)(this, t)
                })
        }
    },
    [
        [160, 1, 2]
    ]
]);
//# sourceMappingURL=main.54fb1195.chunk.js.map