define("modules/navigator/mozApps", [], function () {
    return window.navigator.mozApps
}), define("modules/navigator/mozPermissionSettings", [], function () {
    return window.navigator.mozPermissionSettings
}), define("panels/app_notices_detail/app_notices_detail", ["require", "shared/manifest_helper", "modules/settings_service", "modules/navigator/mozApps", "modules/navigator/mozPermissionSettings"], function (e) {
    var t = e("shared/manifest_helper"),
        n = e("modules/settings_service");
    e("modules/navigator/mozApps");
    var i = e("modules/navigator/mozPermissionSettings"),
        o = function () {
            this._elements = null, this._app = null
        };
    return o.prototype = {
            init: function (e) {
                this._elements = e, this.handleKeydown = this._handleKeydown.bind(this), window.addEventListener("applicationuninstall", this.back)
            },
            back: function () {
                n.navigate("app-notices")
            },
            showAppDetails: function (e) {
                this.addKeyListener(), this._isValidPerm = this._isExplicitPerm, this._app = e;
                var n = this._elements,
                    o = new t(e.manifest ? e.manifest : e.updateManifest);
                if (n.detailTitle.textContent = o.short_name || o.name, !i) return n.list.hidden = !0, void 0;
                n.list.hidden = !1, n.list.innerHTML = "";
                var r = i.get("desktop-notification", e.manifestURL, e.origin, !1);
                this._isValidPerm(e, "desktop-notification", r) && this._insertNoticeSelect("desktop-notification", r), n.header.hidden = !n.list.children.length
            },
            _isExplicitPerm: function (e, t, n) {
                var o = i.isExplicit(t, e.manifestURL, e.origin, !1);
                return o && "unknown" !== n
            },
            selectValueChanged: function (e) {
                var t = e.target;
                t.setAttribute("value", t.value), this._changeNotice(t.dataset.perm, t.value), showToast("notice-changed")
            },
            _changeNotice: function (e, t) {
                if (i) try {
                    i.set(e, t, this._app.manifestURL, this._app.origin, !1)
                } catch (n) {
                    console.warn("Failed to set the " + e + "notice.")
                }
            },
            _insertNoticeSelect: function (e, t) {
                var n = document.createElement("li"),
                    i = document.createElement("span"),
                    o = "allow-notices";
                i.setAttribute("data-l10n-id", o), i.classList.add(o);
                var r = document.createElement("span");
                r.classList.add("button", "icon", "icon-dialog");
                var a = document.createElement("select");
                a.dataset.perm = e, a.setAttribute("data-track-class", o);
                var s = document.createElement("option");
                s.value = "allow", s.setAttribute("data-l10n-id", "on"), a.add(s);
                var c = document.createElement("option");
                c.value = "deny", c.setAttribute("data-l10n-id", "off"), a.add(c);
                var u = "ask" === t ? "deny" : t,
                    d = a.querySelector('[value="' + u + '"]');
                d.setAttribute("selected", !0), a.onchange = this.selectValueChanged.bind(this), n.setAttribute("role", "menuitem"), n.onclick = function () {
                    a.focus()
                }, r.appendChild(a), n.appendChild(i), n.appendChild(r), this._elements.list.appendChild(n)
            },
            _handleKeydown: function (e) {
                if ("Enter" === e.key || "Accept" === e.key) {
                    var t = document.querySelector(".current li.focus select");
                    null !== t && t.focus()
                } else("BrowserBack" === e.key || "Backspace" === e.key) && n.navigate("app-notices")
            },
            removeKeyListener: function () {
                window.removeEventListener("keydown", this.handleKeydown)
            },
            addKeyListener: function () {
                window.addEventListener("keydown", this.handleKeydown)
            }
        },
        function () {
            return new o
        }
}), define("panels/app_notices_detail/panel", ["require", "modules/settings_panel", "panels/app_notices_detail/app_notices_detail"], function (e) {
    var t = e("modules/settings_panel"),
        n = e("panels/app_notices_detail/app_notices_detail");
    return function () {
        function e() {
            var e = {
                menuClassName: "menu-button",
                header: {
                    l10nId: "message"
                },
                items: [{
                    name: "Select",
                    l10nId: "select",
                    priority: 2
                }]
            };
            SettingsSoftkey.init(e), SettingsSoftkey.show()
        }
        var i = {},
            o = new n;
        return t({
            onInit: function (e) {
                this._verbose = null, this._panel = e, i = {
                    list: e.querySelector(".notices-list-header + ul"),
                    header: e.querySelector(".notices-list-header"),
                    detailTitle: e.querySelector(".detail-title")
                }, o.init(i)
            },
            onBeforeShow: function (t, n) {
                o.showAppDetails(n.app), e();
                var i = this._panel.classList.contains("current");
                i && this._panel.querySelector("li").classList.add("focus")
            },
            onBeforeHide: function () {
                o.removeKeyListener()
            }
        })
    }
});