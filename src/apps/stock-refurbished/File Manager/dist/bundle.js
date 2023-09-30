! function (t) {
    function e(n) {
        if (i[n]) return i[n].exports;
        var r = i[n] = {
            i: n,
            l: !1,
            exports: {}
        };
        return t[n].call(r.exports, r, r.exports, e), r.l = !0, r.exports
    }
    var n = window.webpackJsonp;
    window.webpackJsonp = function (e, i, o) {
        for (var s, a, c = 0, u = []; c < e.length; c++) a = e[c], r[a] && u.push(r[a][0]), r[a] = 0;
        for (s in i) Object.prototype.hasOwnProperty.call(i, s) && (t[s] = i[s]);
        for (n && n(e, i, o); u.length;) u.shift()()
    };
    var i = {},
        r = {
            1: 0
        };
    e.e = function (t) {
        function n() {
            a.onerror = a.onload = null, clearTimeout(c);
            var e = r[t];
            0 !== e && (e && e[1](new Error("Loading chunk " + t + " failed.")), r[t] = void 0)
        }
        var i = r[t];
        if (0 === i) return new Promise(function (t) {
            t()
        });
        if (i) return i[2];
        var o = new Promise(function (e, n) {
            i = r[t] = [e, n]
        });
        i[2] = o;
        var s = document.getElementsByTagName("head")[0],
            a = document.createElement("script");
        a.type = "text/javascript", a.charset = "utf-8", a.async = !0, a.timeout = 12e4, e.nc && a.setAttribute("nonce", e.nc), a.src = e.p + "" + t + ".bundle.js";
        var c = setTimeout(n, 12e4);
        return a.onerror = a.onload = n, s.appendChild(a), o
    }, e.m = t, e.c = i, e.i = function (t) {
        return t
    }, e.d = function (exports, t, n) {
        e.o(exports, t) || Object.defineProperty(exports, t, {
            configurable: !1,
            enumerable: !0,
            get: n
        })
    }, e.n = function (t) {
        var n = t && t.__esModule ? function () {
            return t.default
        } : function () {
            return t
        };
        return e.d(n, "a", n), n
    }, e.o = function (t, e) {
        return Object.prototype.hasOwnProperty.call(t, e)
    }, e.p = "dist/", e.oe = function (t) {
        throw t
    }, e(e.s = 1)
}([function (t, exports, e) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
        value: !0
    });
    var n = {
        storages: [],
        storagesName: [],
        storagesPath: [],
        initFolders: ["music", "photos", "videos", "DCIM", "downloads","apps","others"],
        externalExist: !1,
        initStorages: function () {
            var t = this;
            this.storages = navigator.getDeviceStorages("sdcard"), this.storages.forEach(function (e) {
                t.storagesName.push(e.storageName);
                var n = e.storagePath;
                t.storagesPath.push(n.substring(n.lastIndexOf("/") + 1, n.length))
            })
        },
        initializeFolders: function () {
            var t = this;
            this.initFolders.forEach(function (e) {
                t.createFolder("/sdcard/" + e)
            })
        },
        sdcardExist: function (t) {
            var e = this;
            this.storages.length > 1 ? this.storages[1].available().then(function (n) {
                e.externalExist = "available" === n, t && t(e.externalExist)
            }) : (this.externalExist = !1, t && t(this.externalExist))
        },
        getStorage: function (t) {
            return 0 === t.indexOf("/") && (t = t.substring(1, t.length)), this.externalExist && 0 === t.indexOf(this.storagesName[1]) ? this.storages[1] : this.storages[0]
        },
        getDirectory: function (t, e, n) {
            var i = this,
                r = this.getStorage(t),
                o = t;
            if (0 === t.indexOf("/") && (o = t.substring(1, t.length)), n) {
                var s = o;
                s.indexOf("/") > 0 && (s = s.substring(0, s.indexOf("/"))), o = o.substring(o.indexOf(s) + s.length, o.length), n.get(s).then(function (t) {
                    0 === o.length ? e && e(t) : i.getDirectory(o, e, t)
                })
            } else r.getRoot().then(function (t) {
                o.indexOf("/") < 0 ? e && e(t) : (o = o.substring(o.indexOf("/") + 1, o.length), i.getDirectory(o, e, t))
            })
        },
        enumeratePath: function (t, e) {
            var n = t;
            0 === t.indexOf("/") && (n = t.substring(1, t.length)), this.getDirectory(n, function (t) {
                t.getFilesAndDirectories().then(function (t) {
                    e && e(t)
                })
            })
        },
        createFolder: function (t, e, n) {
            var i = this.getStorage(t),
                r = t;
            0 === t.indexOf("/") && (r = t.substring(1, t.length)), r = r.substring(r.indexOf("/") + 1, r.length), i.getRoot().then(function (t) {
                t.createDirectory(r).then(function () {
                    e && e()
                }, function () {
                    n && n()
                })
            })
        },
        copyOrMoveFile: function (t, e, n, i, r) {
            var o = e;
            0 === e.indexOf("/") && (o = e.substring(1, e.length)), o = o.substring(o.indexOf("/") + 1, o.length);
            var s = n;
            0 === n.indexOf("/") && (s = n.substring(1, n.length)), s = s.substring(s.indexOf("/") + 1, s.length), s.lastIndexOf("/") === s.length - 1 && (s = s.substring(0, s.length - 1));
            var a = this.getStorage(e),
                c = this.getStorage(n),
                u = {
                    targetStorage: c,
                    keepBoth: !0
                };
            a.getRoot().then(function (e) {
                var n = function (n) {
                    var s = void 0;
                    s = t ? e.copyTo(o, n, u) : e.moveTo(o, n, u), s.then(function () {
                        i && i()
                    }, function (t) {
                        r && r()
                    })
                };
                s.length > 0 ? n(s) : c.getRoot().then(function (t) {
                    n(t)
                })
            })
        },
        getFileInfo: function (t, e) {
            var n = this.getStorage(t),
                i = n.get(t);
            i.onsuccess = function () {
                e && e(this.result)
            }, i.onerror = function () {}
        },
        deleteFile: function (t, e) {
            var n = this.getStorage(t),
                i = n.delete(t);
            i.onsuccess = function () {
                e && e()
            }, i.onerror = function () {}
        },
        renameFile: function (t, e, n) {
            var i = this.getStorage(t),
                r = t;
            0 === t.indexOf("/") && (r = t.substring(1, t.length)), r = r.substring(r.indexOf("/") + 1, r.length), i.getRoot().then(function (t) {
                t.renameTo(r, e).then(function () {
                    n && n()
                })
            })
        },
        fixDirectoryPath: function (t) {
            var e = t.path;
            return 0 === e.indexOf("/") && (e = e.substring(1, e.length)), this.storagesPath[0] === e ? "/sdcard" : e.indexOf("/") < 0 ? "/sdcard1" : this.storagesPath[0] === e.substring(0, e.indexOf("/")) ? "/sdcard".concat(e.substring(e.indexOf("/"), e.length)) : "/sdcard1".concat(e.substring(e.indexOf("/"), e.length))
        },
        searchSubPath: function (t, e, n, i) {
            var r = this;
            if (e = e.toLowerCase(), t.length > 0) {
                var o = t.pop(),
                    s = this.fixDirectoryPath(o);
                o.getFilesAndDirectories().then(function (o) {
                    o.forEach(function (i) {
                        i.name.toLowerCase().indexOf(e) >= 0 && (i.fixPath = s + "/" + i.name, n.push(i)), i instanceof Directory && t.push(i)
                    }), t.length > 0 ? r.searchSubPath(t, e, n, i) : i(n)
                })
            }
        },
        searchPath: function (t, e, n, i) {
            var r = this,
                o = t,
                s = [],
                a = [];
            e = e.toLowerCase(), 0 === t.indexOf("/") && (o = t.substring(1, t.length)), this.getDirectory(o, function (t) {
                var o = r.fixDirectoryPath(t);
                t.getFilesAndDirectories().then(function (t) {
                    t.forEach(function (t) {
                        t.name.toLowerCase().indexOf(e) >= 0 && (t.fixPath = o + "/" + t.name, a.push(t)), t instanceof Directory && s.push(t)
                    }), s.length > 0 && n ? r.searchSubPath(s, e, a, i) : i(a)
                })
            })
        },
        checkAvailable: function (t, e) {
            var n = this.getStorage(t),
                i = n.get(t);
            i.onsuccess = function () {
                e && e(!0)
            }, i.onerror = function () {
                e && e(!1)
            }
        }
    };
    exports.default = n
}, function (t, exports, e) {
    "use strict";

    function n(t, e) {
        if (!(t instanceof e)) throw new TypeError("Cannot call a class as a function")
    }
    var i = function () {
            function t(t, e) {
                for (var n = 0; n < e.length; n++) {
                    var i = e[n];
                    i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(t, i.key, i)
                }
            }
            return function (e, n, i) {
                return n && t(e.prototype, n), i && t(e, i), e
            }
        }(),
        r = e(0),
        o = function (t) {
            return t && t.__esModule ? t : {
                default: t
            }
        }(r),
        s = function () {
            function t() {
                n(this, t)
            }
            return i(t, [{
                key: "start",
                value: function () {
                    this.content = document.querySelector("#main-list"), this.ssr = document.getElementById("ssr"), window.addEventListener("DOMContentLoaded", this), window.addEventListener("fullyloaded", this), this.ssr.addEventListener("keydown", this, !0)
                }
            }, {
                key: "handleEvent",
                value: function (t) {
                    switch (t.type) {
                        case "DOMContentLoaded":
                            window.removeEventListener("DOMContentLoaded", this), o.default.initStorages(), o.default.sdcardExist(this.loadItems.bind(this));
                            break;
                        case "fullyloaded":
                            this.ssr.classList.add("hidden")
                    }
                }
            }, {
                key: "loadItems",
                value: function (t) {
                    var e = "<li class=" + (t ? "" : "gray-out") + '>\n          <div>\n            <div class="folder-item" data-icon="sd-card">\n              <p class="folder-name" data-l10n-id="sdcard" />\n            </div>\n          </div>\n        </li>',
                        n = '<li class="fake-focus">\n          <div>\n            <div class="folder-item" data-icon="pda-phone">\n              <p class="folder-name" data-l10n-id="internal" />\n            </div>\n          </div>\n        </li>' + e;
                    this.content.innerHTML = n, window.performance.mark("visuallyLoaded"), window.isVisuallyLoaded = !0, this.load()
                }
            }, {
                key: "load",
                value: function () {
                    window.requestAnimationFrame(function () {
                        window.setTimeout(function () {
                            e.e(0).then(e.bind(null, 2))
                        })
                    })
                }
            }]), t
        }();
    window.addEventListener("largetextenabledchanged", function () {
        document.body.classList.toggle("large-text", navigator.largeTextEnabled)
    }), document.body.classList.toggle("large-text", navigator.largeTextEnabled);
    var a = new s;
    a.start(), window._app = a
}]);
//# sourceMappingURL=bundle.js.map