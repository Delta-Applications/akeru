define([ "./main-router", "./configparser-main", "./cronsync-main", "./devicestorage-main", "./maildb-main", "./net-main", "../mailapi", "exports" ], function($router, $configparser, $cronsync, $devicestorage, $maildb, $net, $mailapi, exports) {
    var realisticBridge = {
        name: "bridge",
        sendMessage: null,
        process: function(e, t, n) {
            bouncedBridge.sendMessage(e, t, n);
        }
    }, bouncedBridge = {
        name: "bounced-bridge",
        sendMessage: null,
        process: function(e, t, n) {
            realisticBridge.sendMessage(e, t, n);
        }
    };
    $router.register(realisticBridge), $router.register(bouncedBridge);
    var gMailAPI = null, testHelper = {
        name: "testhelper",
        sendMessage: null,
        process: function(uid, cmd, args) {
            if ("create-mailapi" === cmd) gMailAPI = new $mailapi.MailAPI(), gMailAPI.__bridgeSend = function(e) {
                mainBridge.sendMessage(null, null, e);
            }; else if ("runWithBody" === cmd) try {
                var func;
                eval("func = " + args.func + ";"), gMailAPI._getBodyForMessage({
                    id: args.headerId,
                    date: args.headerDate
                }, null, function(e) {
                    console.log("got body, invoking func!");
                    try {
                        func(args.arg, e, function(t) {
                            testHelper.sendMessage(uid, cmd, [ t ]), e.die();
                        });
                    } catch (t) {
                        console.error("problem in runWithBody func", t, "\n", t.stack);
                    }
                });
            } catch (ex) {
                console.error("problem with runWithBody", ex, "\n", ex.stack);
            } else if ("checkDatabaseDoesNotContain" === cmd) {
                var tablesAndKeyPrefixes = args, idb = $maildb._debugDB._db, desiredStores = [], i, checkArgs;
                for (i = 0; i < tablesAndKeyPrefixes.length; i++) checkArgs = tablesAndKeyPrefixes[i], 
                desiredStores.push(checkArgs.table);
                var trans = idb.transaction(desiredStores, "readonly"), results = [], sendResults = function() {
                    testHelper.sendMessage(uid, "checkDatabaseDoesNotContain", [ results ]);
                }, waitCount = tablesAndKeyPrefixes.length;
                tablesAndKeyPrefixes.forEach(function(e) {
                    var t = trans.objectStore(e.table), n = IDBKeyRange.bound(e.prefix, e.prefix + "￰", !1, !1), r = t.get(n);
                    r.onerror = function(e) {
                        results.push({
                            errCode: e.target.errorCode
                        }), 0 === --waitCount && sendResults();
                    }, r.onsuccess = function() {
                        results.push({
                            errCode: null,
                            table: e.table,
                            prefix: e.prefix,
                            hasResult: void 0 !== r.result
                        }), 0 === --waitCount && sendResults();
                    };
                });
            }
        }
    };
    $router.register(testHelper);
    var mainBridge = {
        name: "main-bridge",
        sendMessage: null,
        process: function(e, t, n) {
            gMailAPI && gMailAPI.__bridgeReceive(n);
        }
    };
    $router.register(mainBridge);
    var deviceStorageTestHelper = {
        name: "th_devicestorage",
        sendMessage: null,
        process: function(e, t, n) {
            function r(e, t) {
                e && console.log("devicestorage:", e, t), --i > 0 || (console.log("devicestorage: detach cleanup completed"), 
                o._storage.removeEventListener("change", o._bound_onChange), o._storage = null, 
                o.sendMessage(null, "detached", null));
            }
            if ("attach" === t) this._storage = navigator.getDeviceStorage(n), this._storage.addEventListener("change", this._bound_onChange), 
            this.sendMessage(null, "attached", null); else if ("detach" === t) {
                var i = 1, o = this;
                n.nuke.forEach(function(e) {
                    i++;
                    var t = o._storage.delete(e);
                    t.onsuccess = r.bind(null, e, "success"), t.onerror = r.bind(null, e, "error");
                }), r();
            } else if ("get" === t) {
                var s = this._storage.get(n.path);
                s.onsuccess = function() {
                    this.sendMessage(null, "got", {
                        id: n.id,
                        error: null,
                        blob: s.result
                    });
                }.bind(this), s.onerror = function() {
                    this.sendMessage(null, "got", {
                        id: n.id,
                        error: "" + s.error,
                        blob: null
                    });
                }.bind(this);
            }
        },
        _storage: null,
        _bound_onChange: null,
        _onChange: function(e) {
            this.sendMessage(null, "change", {
                reason: e.reason,
                path: e.path
            });
        }
    };
    deviceStorageTestHelper._bound_onChange = deviceStorageTestHelper._onChange.bind(deviceStorageTestHelper), 
    $router.register(deviceStorageTestHelper), $router.register($configparser), $router.register($cronsync), 
    $router.register($devicestorage), $router.register($maildb), $router.register($net);
});