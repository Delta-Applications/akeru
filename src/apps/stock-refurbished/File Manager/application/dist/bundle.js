! function(t) {
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
    window.webpackJsonp = function(e, i, o) {
        for (var a, s, c = 0, u = []; c < e.length; c++) s = e[c], r[s] && u.push(r[s][0]), r[s] = 0;
        for (a in i) Object.prototype.hasOwnProperty.call(i, a) && (t[a] = i[a]);
        for (n && n(e, i, o); u.length;) u.shift()()
    };
    var i = {},
        r = {
            1: 0
        };
    e.e = function(t) {
        function n() {
            s.onerror = s.onload = null, clearTimeout(c);
            var e = r[t];
            0 !== e && (e && e[1](new Error("Loading chunk " + t + " failed.")), r[t] = void 0)
        }
        var i = r[t];
        if (0 === i) return new Promise(function(t) {
            t()
        });
        if (i) return i[2];
        var o = new Promise(function(e, n) {
            i = r[t] = [e, n]
        });
        i[2] = o;
        var a = document.getElementsByTagName("head")[0],
            s = document.createElement("script");
        s.type = "text/javascript", s.charset = "utf-8", s.async = !0, s.timeout = 12e4, e.nc && s.setAttribute("nonce", e.nc), s.src = e.p + "" + t + ".bundle.js";
        var c = setTimeout(n, 12e4);
        return s.onerror = s.onload = n, a.appendChild(s), o
    }, e.m = t, e.c = i, e.i = function(t) {
        return t
    }, e.d = function(exports, t, n) {
        e.o(exports, t) || Object.defineProperty(exports, t, {
            configurable: !1,
            enumerable: !0,
            get: n
        })
    }, e.n = function(t) {
        var n = t && t.__esModule ? function() {
            return t.default
        } : function() {
            return t
        };
        return e.d(n, "a", n), n
    }, e.o = function(t, e) {
        return Object.prototype.hasOwnProperty.call(t, e)
    }, e.p = "dist/", e.oe = function(t) {
        throw t
    }, e(e.s = 2)
}([function(t, e, n) {
    "use strict";
    var i = {
        MAXLENGTH: 20,
        MAXEXTLENGTH: 5,
        PREPARE_COPY: 0,
        START_COPY: 1,
        END_COPY: 2,
        PREPARE_MOVE: 3,
        START_MOVE: 4,
        END_MOVE: 5,
        copyOrMoveStatus: -1,
        copyOrMoveFile: "",
        selectorItems: [],
        selectorFolderNumber: 0,
        tempSelectMode: !1,
        currentFolder: "",
        focusIndexs: [],
        unsupportCharacters: '\\/:*?"<>|',
        searchKeyword: "",
        transforming: !1,
        openActivityMode: !1,
        openPath: "",
        pickActivityMode: !1,
        activityObj: null,
        updateNameForVfat: function(t, e) {
            var n = this,
                i = "sdcard1" === this.getFirstLevel(this.fixPath(t)),
                r = e.match(/\.+$/);
            if (!i || !r) return Promise.resolve(e);
            0 !== t.indexOf("/") && (t = "/" + t);
            var o = t.replace(/\.+$/, ""),
                a = e.replace(/\.+$/, "");
            return new Promise(function(i, r) {
                n.checkSDIsVfat(t, o).then(function(t) {
                    i(t ? a : e)
                }, function(t) {
                    r()
                })
            })
        },
        checkSDIsVfat: function(t, e) {
            return new Promise(function(n, i) {
                var r = navigator.getDeviceStorages("sdcard")[1],
                    o = function(t) {
                        return new Promise(function(e, n) {
                            var i = r.get(t);
                            i.onsuccess = function(t) {
                                var n = t.target.result.lastModified;
                                e(n)
                            }, i.onerror = function() {
                                n()
                            }
                        })
                    };
                Promise.all([o(t), o(e)]).then(function(t) {
                    n(t[0] === t[1])
                }).catch(function(t) {
                    i()
                })
            })
        },
        checkFolderName: function(t) {
            for (var e = 0; e < this.unsupportCharacters.length; e++)
                if (t.indexOf(this.unsupportCharacters[e]) >= 0) return !1;
            return !0
        },
        getDisplayName: function(t) {
            var e = t.lastIndexOf("/");
            return e < 1 ? t : t.substring(e + 1, t.length)
        },
        parseFileName: function(t) {
            var e = {},
                n = t.lastIndexOf("."),
                i = t.substring(n, t.length);
            return e.extension = i, e.name = t.substring(0, n), e
        },
        fixPath: function(t) {
            return 0 === t.indexOf("/") ? t.substring(1, t.length) : t
        },
        getLevels: function(t) {
            for (var e = 1, n = t, i = n.indexOf("/"); i > 0;) e++, n = n.substring(i + 1, n.length), i = n.indexOf("/");
            return e
        },
        getLastLevel: function(t) {
            return t.substring(t.lastIndexOf("/") + 1, t.length)
        },
        getFirstLevel: function(t) {
            return t.indexOf("/") >= 0 ? t.substring(0, t.indexOf("/")) : t
        },
        getRootDisplay: function(t) {
            var e = "sdcard" === t ? "internal" : "sdcard";
            return navigator.mozL10n.get(e)
        },
        getDisplayHeader: function(t) {
            if (this.isInCopyOrMove()) return navigator.mozL10n.get("copy-move-header");
            var e = this.getLevels(t);
            if (e <= 1) return this.getRootDisplay(t);
            var n, i = this.getFirstLevel(t),
                r = this.getLastLevel(t);
            if (n = e <= 2 ? this.getRootDisplay(i).concat(" > ").concat(r) : this.getRootDisplay(i).concat(" > ... > ").concat(r), n.length > this.MAXLENGTH) {
                var o = "... > ".concat(r);
                return o.length > this.MAXLENGTH ? r : o
            }
            return n
        },
        isInCopyOrMove: function() {
            return this.copyOrMoveStatus === this.PREPARE_COPY || this.copyOrMoveStatus === this.PREPARE_MOVE || this.copyOrMoveStatus === this.START_COPY || this.copyOrMoveStatus === this.START_MOVE
        },
        pushSelectorItem: function(t) {
            this.selectorItems.findIndex(function(e) {
                return JSON.stringify(e) === JSON.stringify(t)
            }) < 0 && (this.selectorItems.push(t), t.isFolder && this.selectorFolderNumber++)
        },
        removeSelectorItem: function(t) {
            var e = this.selectorItems.findIndex(function(e) {
                return JSON.stringify(e) === JSON.stringify(t)
            });
            e >= 0 && (this.selectorItems.splice(e, 1), t.isFolder && this.selectorFolderNumber--)
        },
        sortItems: function(t) {
            function e(t, e) {
                var n = i.getLastLevel(t.name).toUpperCase();
                n.lastIndexOf(".") >= 0 && (n = n.substring(0, n.lastIndexOf(".")));
                var r = i.getLastLevel(e.name).toUpperCase();
                return r.lastIndexOf(".") >= 0 && (r = r.substring(0, r.lastIndexOf("."))), n > r ? 1 : n < r ? -1 : 0
            }
            for (var n = [], r = [], o = new RegExp("[a-zA-Z0-9]"), a = 0, s = t.length; a < s; a++) {
                var c = t[a];
                o.test(i.getLastLevel(c.name).charAt(0)) ? n.push(c) : r.push(c)
            }
            return n.sort(e), r.sort(e), n.concat(r), n.concat(r)
        }
    };
    e.a = i
}, function(t, e, n) {
    "use strict";
    var i = {
        storages: [],
        storagesName: [],
        storagesPath: [],
        specialPath: {
            sdcard: {
                readOnly: !0
            },
            "sdcard/audio": {
                init: !0
            },
            "sdcard/callrecording": {
                readOnly: !0
            },
            "sdcard/music": {
                init: !0
            },
            "sdcard/photos": {
                init: !0
            },
            "sdcard/videos": {
                init: !0
            },
            "sdcard/DCIM": {
                init: !0
            },
            "sdcard/downloads": {
                init: !0
            },
            "sdcard/others": {
                init: !0
            },
            "sdcard1/callrecording": {
                readOnly: !0
            },
            "sdcard1/fota": {
                hide: !0
            },
            "sdcard1/LOST.DIR": {
                hide: !0
            },
            "sdcard1/.android_secure": {
                hide: !0
            }
        },
        externalExist: !1,
        initStorages: function() {
            var t = this;
            this.storages = navigator.getDeviceStorages("sdcard"), this.storages.forEach(function(e) {
                t.storagesName.push(e.storageName);
                var n = e.storagePath;
                t.storagesPath.push(n.substring(n.lastIndexOf("/") + 1, n.length))
            })
        },
        initializeFolders: function() {
            for (var t in this.specialPath) this.specialPath[t].init && this.createFolder("/".concat(t))
        },
        isSpecialPath: function(t, e) {
            if (0 === t.indexOf("/")) {
                t = t.slice(1, t.length);
                var n = t.slice(0, t.lastIndexOf("/"));
                if (this.specialPath[n] && this.specialPath[n][e]) return !0
            }
            return !(!this.specialPath[t] || !this.specialPath[t][e])
        },
        sdcardExist: function(t) {
            var e = this;
            this.storages.length > 1 ? this.storages[1].available().then(function(n) {
                e.externalExist = "available" === n, t && t(e.externalExist)
            }) : (this.externalExist = !1, t && t(this.externalExist))
        },
        getStorage: function(t) {
            return 0 === t.indexOf("/") && (t = t.substring(1, t.length)), this.externalExist && 0 === t.indexOf(this.storagesName[1]) ? this.storages[1] : this.storages[0]
        },
        getDirectory: function(t, e, n, i) {
            var r = this,
                o = this.getStorage(t),
                a = t;
            if (0 === t.indexOf("/") && (a = t.substring(1, t.length)), n) {
                var s = a;
                s.lastIndexOf("/") > 0 && (s = s.substring(0, s.lastIndexOf("/"))), a = a.substring(a.indexOf(s) + s.length, a.length), n.get(s).then(function(t) {
                    0 === a.length ? e && e(t) : r.getDirectory(a, e, t)
                }).catch(function(t) {
                    i && i()
                })
            } else o.getRoot().then(function(t) {
                a.indexOf("/") < 0 ? e && e(t) : (a = a.substring(a.indexOf("/") + 1, a.length), r.getDirectory(a, e, t))
            }).catch(function(t) {
                i && i()
            })
        },
        enumeratePath: function(t, e) {
            var n = t;
            0 === t.indexOf("/") && (n = t.substring(1, t.length)), this.getDirectory(n, function(t) {
                t.getFilesAndDirectories().then(function(t) {
                    e && e(t)
                })
            })
        },
        createFolder: function(t, e, n) {
            var i = this.getStorage(t),
                r = t;
            0 === t.indexOf("/") && (r = t.substring(1, t.length)), r = r.substring(r.indexOf("/") + 1, r.length), i.getRoot().then(function(t) {
                t.createDirectory(r).then(function() {
                    e && e()
                }, function() {
                    n && n()
                })
            }).catch(function(t) {
                n && n()
            })
        },
        copyOrMoveFile: function(t, e, n, i, r) {
            var o = e;
            0 === e.indexOf("/") && (o = e.substring(1, e.length)), o = o.substring(o.indexOf("/") + 1, o.length);
            var a = n;
            0 === n.indexOf("/") && (a = n.substring(1, n.length)), a = a.substring(a.indexOf("/") + 1, a.length), a.lastIndexOf("/") === a.length - 1 && (a = a.substring(0, a.length - 1));
            var s = this.getStorage(e),
                c = this.getStorage(n),
                u = {
                    targetStorage: c,
                    keepBoth: !0
                };
            s.getRoot().then(function(e) {
                var n = function(n) {
                    var a;
                    a = t ? e.copyTo(o, n, u) : e.moveTo(o, n, u), a.then(function() {
                        i && i && i()
                    }, function(t) {
                        r && r && r()
                    })
                };
                a.length > 0 ? n(a) : c.getRoot().then(function(t) {
                    n(t)
                }).catch(function(t) {
                    r && r()
                })
            }).catch(function(t) {
                r && r()
            })
        },
        getFolderSize: function(t) {
            var e = this;
            return new Promise(function(n, i) {
                var r = 0,
                    o = [],
                    a = [];
                e.getDirectory(t, function(s) {
                    s.getFilesAndDirectories().then(function(s) {
                        for (var c = 0; c < s.length; c++) s[c] instanceof Directory ? (r += 2048, o.push(e.getFolderSize("".concat(t, "/").concat(s[c].name)))) : a.push(e.getFileInfo("".concat(t, "/").concat(s[c].name)));
                        o.length && Promise.all(o).then(function(t) {
                            var e = t.reduce(function(t, e) {
                                return t + e
                            });
                            n(Promise.all(a).then(function(t) {
                                return t.reduce(function(t, e) {
                                    return t + e.size
                                }, r + e)
                            }).catch(function() {
                                i()
                            }))
                        }).catch(function(t) {
                            i()
                        }), r || n(Promise.all(a).then(function(t) {
                            return t.reduce(function(t, e) {
                                return t + e.size
                            }, 0)
                        }).catch(function() {
                            i()
                        }))
                    }).catch(function(t) {
                        i()
                    })
                })
            })
        },
        getFileInfo: function(t, e) {
            var n = this;
            return new Promise(function(i, r) {
                var o = n.getStorage(t),
                    a = o.get(t);
                a.onsuccess = function() {
                    e && e(this.result), i(this.result)
                }, a.onerror = function() {
                    r(this.error)
                }
            })
        },
        checkAvailableSpace: function(t, e, n, i, r) {
            var o = this;
            if (!i) throw new Error("You must define a success callback");
            if (!n && t.split("/")[1] === e.split("/")[1]) return void i(!1);
            var a = this.getStorage(e),
                s = a.freeSpace();
            s.onsuccess = function(e) {
                var n = e.target.result;
                o.getFileInfo(t).then(function(t) {
                    if ("" === t.type && 0 === t.size) return void o.getFolderSize(t.name).then(function(t) {
                        i(t + 2048 > n)
                    }).catch(function(t) {
                        r && r(t)
                    });
                    i(t.size > n)
                }).catch(function(t) {
                    r && r(t)
                })
            }, s.onerror = function() {
                r && r(this.error)
            }
        },
        deleteFile: function(t, e) {
            var n = this.getStorage(t),
                i = n.delete(t);
            i.onsuccess = function() {
                e && e()
            }, i.onerror = function() {
                e && e()
            }
        },
        renameFile: function(t, e, n, i) {
            var r = this.getStorage(t),
                o = t;
            0 === t.indexOf("/") && (o = t.substring(1, t.length)), o = o.substring(o.indexOf("/") + 1, o.length), r.getRoot().then(function(t) {
                t.renameTo(o, e).then(function() {
                    n && n()
                }, function() {
                    i && i()
                })
            })
        },
        fixDirectoryPath: function(t) {
            var e = t.path;
            return 0 === e.indexOf("/") && (e = e.substring(1, e.length)), this.storagesPath[0] === e ? "/sdcard" : e.indexOf("/") < 0 ? "/sdcard1" : this.storagesPath[0] === e.substring(0, e.indexOf("/")) ? "/sdcard".concat(e.substring(e.indexOf("/"), e.length)) : "/sdcard1".concat(e.substring(e.indexOf("/"), e.length))
        },
        searchSubPath: function(t, e, n, i) {
            var r = this;
            if (e = e.toLowerCase(), t.length > 0) {
                var o = t.pop(),
                    a = this.fixDirectoryPath(o);
                o.getFilesAndDirectories().then(function(o) {
                    o.forEach(function(i) {
                        i.name.toLowerCase().indexOf(e) >= 0 && (i.fixPath = "".concat(a, "/").concat(i.name), n.push(i)), i instanceof Directory && t.push(i)
                    }), t.length > 0 ? r.searchSubPath(t, e, n, i) : i(n)
                })
            }
        },
        searchPath: function(t, e, n, i) {
            var r = this,
                o = t,
                a = [],
                s = [];
            e = e.toLowerCase(), 0 === t.indexOf("/") && (o = t.substring(1, t.length)), this.getDirectory(o, function(t) {
                var o = r.fixDirectoryPath(t);
                t.getFilesAndDirectories().then(function(t) {
                    t.forEach(function(t) {
                        t.name.toLowerCase().indexOf(e) >= 0 && (t.fixPath = "".concat(o, "/").concat(t.name), s.push(t)), t instanceof Directory && a.push(t)
                    }), a.length > 0 && n ? r.searchSubPath(a, e, s, i) : i(s)
                })
            })
        },
        checkAvailable: function(t, e) {
            var n = this.getStorage(t),
                i = n.get(t);
            i.onsuccess = function() {
                e && e(!0)
            }, i.onerror = function() {
                e && e(!1)
            }
        }
    };
    e.a = i
}, function(t, e, n) {
    "use strict";

    function i(t, e) {
        if (!(t instanceof e)) throw new TypeError("Cannot call a class as a function")
    }

    function r(t, e) {
        for (var n = 0; n < e.length; n++) {
            var i = e[n];
            i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(t, i.key, i)
        }
    }

    function o(t, e, n) {
        return e && r(t.prototype, e), n && r(t, n), t
    }
    Object.defineProperty(e, "__esModule", {
        value: !0
    });
    var a = n(1),
        s = n(0),
        c = function() {
            function t() {
                var e = this;
                i(this, t), this._handlers = {
                    open: function(t) {
                        s.a.openActivityMode = !0, s.a.openPath = t.data.path, s.a.openPath || (s.a.openPath = "sdcard")
                    },
                    pick: function() {
                        s.a.pickActivityMode = !0
                    },
                    view: function() {}
                }, this._handleActivity = function(t) {
                    var n = e._handlers[t.name];
                    n && n(t)
                }
            }
            return o(t, [{
                key: "start",
                value: function() {
                    var t = this;
                    this.content = document.querySelector("#main-list"), this.ssr = document.getElementById("ssr"), window.addEventListener("DOMContentLoaded", this), window.addEventListener("fullyloaded", this), this.ssr.addEventListener("keydown", this, !0), window.navigator.mozApps.mgmt.getAll().then(function(t) {
                        for (var e = 0; e < t.length; e++)
                            if ("app://callrecording.gaiamobile.org" === t[e].origin) {
                                a.a.specialPath["sdcard/callrecording"].init = !0;
                                break
                            }
                    }), navigator.mozSetMessageHandler("activity", function(e) {
                        s.a.activityObj = e, t._handleActivity(e.source)
                    })
                }
            }, {
                key: "handleEvent",
                value: function(t) {
                    switch (t.type) {
                        case "DOMContentLoaded":
                            window.removeEventListener("DOMContentLoaded", this), a.a.initStorages(), a.a.sdcardExist(this.loadItems.bind(this));
                            break;
                        case "fullyloaded":
                            this.ssr.classList.add("hidden")
                    }
                }
            }, {
                key: "loadItems",
                value: function(t) {
                    if (!s.a.openActivityMode && !s.a.pickActivityMode) {
                        var e = "<li class=".concat(t ? "" : "gray-out", '>\n            <div class="folder-icon" data-icon="sd-card"></div>\n            <p class="folder-name" data-l10n-id="sdcard" />\n            <div class="folder-forward" data-icon="forward"></div>\n          </li>'),
                            n = '<li class="fake-focus" data-icon=" ">\n            <div class="file-icon" data-icon="mobile-phone"></div>\n            <p class="folder-name" data-l10n-id="internal" />\n            <div class="folder-forward" data-icon="forward"></div>\n          </li>' + e;
                        this.content.innerHTML = n
                    }
                    window.performance.mark("visuallyLoaded"), window.isVisuallyLoaded = !0, this.load()
                }
            }, {
                key: "load",
                value: function() {
                    window.requestAnimationFrame(function() {
                        window.setTimeout(function() {
                            n.e(0).then(n.bind(null, 3))
                        })
                    })
                }
            }]), t
        }();
    window.addEventListener("largetextenabledchanged", function() {
        document.body.classList.toggle("large-text", navigator.largeTextEnabled)
    }), document.body.classList.toggle("large-text", navigator.largeTextEnabled);
    var u = new c;
    u.start(), window._app = u
}]);
//# sourceMappingURL=bundle.js.map