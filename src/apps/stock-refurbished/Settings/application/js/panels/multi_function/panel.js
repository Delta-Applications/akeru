define(["require", "modules/settings_panel", "shared/settings_listener", "modules/settings_service", "modules/apps_cache", "shared/manifest_helper"], function (e) {
    var t = e("modules/settings_panel");
    e("shared/settings_listener");
    var n = e("modules/settings_service"),
        i = e("modules/apps_cache"),
        o = e("shared/manifest_helper");
    return function () {
        function e(e) {
            if (dump("_savemultifunction value=" + e), u != e) {
                u = e, l = e;
                var t = {};
                t["multifunction.value"] = u, navigator.mozSettings.createLock().set(t), showToast("changessaved")
            }
        }

        function r() {
            var e = document.querySelector("li.focus");
            if (null != e && e.classList.remove("focus"), void 0 == l) return dump("multifunction : updatePanel undefined "), void 0;
            var t = 'li[class="' + l + '-enabled"]';
            dump("multifunction : updatePanel >>> querystr is: " + t);
            var n = document.querySelector(t);
            n.focus(), n.classList.add("focus")
        }

        function a() {
            var e = navigator.mozSettings.createLock().get("multifunction.value");
            e.onsuccess = function () {
                var t = e.result["multifunction.value"];
                if (dump("multifunction onBeforeShow currentvalue >>> " + t), void 0 == t) l = "camera", r();
                else
                    for (var n, i = d.length, n = 0; i > n; n++)
                        if (d[n] == t) {
                            l = t, r(), c.multifunctionBtn[n].checked = !0;
                            break
                        }
            }, e.onerror = function () {
                dump("multifunction onBeforeShow request current value error")
            }
        }

        

        function s() {
            i.apps().then(function (e) {
                for (var t = 0; t < e.length; t++) {
                    var n = e[t];
                    n.manifest ? n.manifest : n.updateManifest;
                    for (var i, i = 0; i < d.length; i++)
                       // if (n.origin == "app://" + d[i] + ".gaiamobile.org") {
                            var r = new o(n.manifest).name,
                                a = 'span[value="' + d[i] + '"]',
                                s = c.panel.querySelector(a);
                            s.innerText = r;
                            break
                       // }
                }
            })
        }
        var c, u, l = void 0,
            d = ["camera", "sms", "email", "internetSharing", "search", "fm", "music", "calculator", "calendar", "clock", "soundrecorder", "settings", "notes"];
        return t({
            onInit: function (e) {
                c = {
                    panel: e,
                    multifunctionBtn: [].slice.apply(e.querySelectorAll('input[name="multifunction-enabled"]'))
                }, s(), a()
            },
            onBeforeShow: function () {
                s(), this._initSoftKey(), window.addEventListener("panelready", r)
            },
            onShow: function () {
                dump("multifunction onShow")
            },
            onBeforeHide: function () {
                dump("multifunction onBeforeHide"), SettingsSoftkey.hide(), window.removeEventListener("panelready", r)
            },
            _initSoftKey: function () {
                dump("multifunction _initSoftKey");
                var t = {
                        name: "Cancel",
                        l10nId: "cancel",
                        priority: 1,
                        method: function () {
                            n.navigate("root")
                        }
                    },
                    i = {
                        name: "Select",
                        l10nId: "select",
                        priority: 2,
                        method: function () {
                            if ("#multifunction" === Settings.currentPanel && c.panel.querySelector("li.focus input")) {
                                var t = document.querySelector("li.focus"),
                                    i = t.querySelector("label"),
                                    o = i.querySelector("input");
                                dump("multifunction _initSoftKey current select >>> " + o.value), e(o.value), n.navigate("root")
                            }
                        }
                    },
                    o = {
                        menuClassName: "menu-button",
                        header: {
                            l10nId: "message"
                        },
                        items: []
                    };
                o.items.push(t), o.items.push(i), SettingsSoftkey.init(o), SettingsSoftkey.show()
            }
        })
    }
});