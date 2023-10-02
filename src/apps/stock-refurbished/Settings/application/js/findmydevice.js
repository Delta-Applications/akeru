define("findmydevice", ["modules/settings_utils", "shared/settings_listener"], function (e, t) {
    var n = {
        _interactiveLogin: !1,
        _loginButton: null,
        fxaHelper: null,
        init: function (n) {
            function i() {
                var e = document.getElementById("findmydevice-signin");
                if (e.hidden) var t = {
                    name: "Save",
                    l10nId: "save",
                    priority: 2,
                    method: function () {}
                };
                else var t = {
                    name: "OK",
                    l10nId: "ok",
                    priority: 2,
                    method: function () {}
                };
                SettingsSoftkey.init({
                    menuClassName: "menu-button",
                    header: {
                        l10nId: "message"
                    },
                    items: [t]
                }), SettingsSoftkey.show()
            }

            function o() {
                SettingsSoftkey.hide()
            }
            var r = this;
            r.fxaHelper = n, r._loginButton = document.querySelector("#findmydevice-login > button");
            var a = document.querySelector("#findmydevice gaia-header");
            e.runHeaderFontFit(a), LazyLoader.getJSON("/resources/findmydevice.json").then(function (e) {
                t.observe("findmydevice.logged-in", !1, r.checkState.bind(r)), navigator.mozId && navigator.mozId.watch({
                    wantIssuer: "firefox-accounts",
                    audience: e.api_url,
                    onlogin: r._onChangeLoginState.bind(r, !0),
                    onlogout: r._onChangeLoginState.bind(r, !1),
                    onready: function () {
                        r._loginButton.removeAttribute("disabled"), console.log("Find My Device: onready fired")
                    },
                    onerror: function (e) {
                        console.error("Find My Device: onerror fired: " + e), r._interactiveLogin = !1, r._loginButton.removeAttribute("disabled");
                        var t = JSON.parse(e).name;
                        "OFFLINE" !== t && "UNVERIFIED_ACCOUNT" === t && (r.checkState(), SettingsHelper("findmydevice.logged-in").set(!1))
                    }
                })
            }), t.observe("findmydevice.tracking", !1, this._setTracked.bind(this)), r._loginButton.addEventListener("click", r._onLoginClick.bind(r)), t.observe("findmydevice.enabled", !1, this._setEnabled.bind(this)), t.observe("findmydevice.can-disable", !0, this._setCanDisable.bind(this));
            var s = document.querySelectorAll('input[name="findmydevice-enabled"]');
            s[0].addEventListener("click", this._onCheckboxChanged.bind(this)), s[1].addEventListener("click", this._onCheckboxChanged.bind(this)), window.addEventListener("fxa-dialog-done", this.checkState.bind(this)), window.addEventListener("panelready", function (e) {
                "#findmydevice" == e.detail.current && (SettingsHelper("findmydevice.enabled").get(function (e) {
                    e ? r._setEnabled(!0) : r._setEnabled(!1)
                }), i()), "#findmydevice" == e.detail.previous && o()
            }), window.addEventListener("keydown", function (e) {
                switch (e.key) {
                    case "Accept":
                    case "Enter":
                        var t = document.querySelector("#findmydevice .focus");
                        t && "findmydevice-login" == t.id && (t.focus(), t.click())
                }
            })
        },
        _onLoginClick: function (e) {
            if (e.stopPropagation(), e.preventDefault(), !this._loginButton.disabled) {
                if (navigator.mozL10n.get, !window.navigator.onLine) {
                    var t = {
                            title: {
                                id: "settings",
                                args: {}
                            },
                            body: {
                                id: "findmydevice-enable-network",
                                args: {}
                            },
                            accept: {
                                l10nId: "ok",
                                callback: function () {}
                            }
                        },
                        n = new ConfirmDialogHelper(t);
                    return n.show(document.getElementById("app-confirmation-dialog")), void 0
                }
                this._interactiveLogin = !0;
                var i = this;
                NavigationMap.delayFocusSet = !0, navigator.mozId && navigator.mozId.request({
                    oncancel: function () {
                        i._interactiveLogin = !1, console.log("Find My Device: oncancel fired")
                    }
                })
            }
        },
        _setEnabled: function (e) {
            var t = document.querySelectorAll('input[name="findmydevice-enabled"]');
            0 == e ? (t[0].checked = !1, t[1].checked = !0) : (t[0].checked = !0, t[1].checked = !1);
            var n = document.getElementById("findmydevice-tracking");
            n.hidden = !e
        },
        _setTracked: function (e) {
            var t = document.getElementById("findmydevice-tracking");
            t.setAttribute("data-l10n-id", e ? "findmydevice-active-tracking" : "findmydevice-not-tracking")
        },
        _setCanDisable: function (e) {
            var t = document.querySelectorAll('input[name="findmydevice-enabled"]');
            1 == e ? (t[0].checked = !1, t[1].checked = !0) : (t[0].checked = !0, t[1].checked = !1)
        },
        checkState: function () {
            var e = this;
            e.fxaHelper.getAccounts(function (t) {
                if (t)
                    if (t && !t.verified) {
                        var n = document.getElementById("findmydevice-fxa-unverified-error");
                        n.hidden = !1;
                        var i = document.getElementById("findmydevice-login");
                        i.hidden = !0, e._togglePanel(!1)
                    } else t && t.verified && e._togglePanel(!0);
                else e._togglePanel(!1)
            }, function () {})
        },
        _togglePanel: function (e) {
            var t = document.getElementById("findmydevice-signin");
            t.hidden = e;
            var n = document.getElementById("findmydevice-settings");
            n.hidden = !e;
            var i = new CustomEvent("panelready", {
                detail: {
                    current: "#findmydevice"
                }
            });
            "#findmydevice" === Settings._currentPanel && window.dispatchEvent(i)
        },
        _onChangeLoginState: function (e) {
            console.log("settings, logged in: " + e), this._interactiveLogin && SettingsHelper("findmydevice.registered").get(function (e) {
                e || SettingsHelper("findmydevice.enabled").set(!0)
            }), this._interactiveLogin = !1;
            var t = document.getElementById("findmydevice-fxa-unverified-error");
            t.hidden = !0;
            var n = document.getElementById("findmydevice-login");
            n.hidden = !1
        },
        _onCheckboxChanged: function (e) {
            if (navigator.mozL10n.get, !window.navigator.onLine) return setTimeout(function () {
                var t = {
                        title: {
                            id: "settings",
                            args: {}
                        },
                        body: {
                            id: "findmydevice-enable-network",
                            args: {}
                        },
                        accept: {
                            l10nId: "ok",
                            callback: function () {}
                        }
                    },
                    n = new ConfirmDialogHelper(t);
                n.show(document.getElementById("app-confirmation-dialog"));
                var i = document.querySelectorAll('input[name="findmydevice-enabled"]'),
                    o = e.target.value;
                SettingsHelper("findmydevice.enabled").get(function (e) {
                    "0" === o && e ? (i[0].checked = !0, i[1].checked = !1) : "1" !== o || e || (i[0].checked = !1, i[1].checked = !0)
                })
            }), void 0;
            var t = e.target.value,
                n = "1" == t;
            document.querySelectorAll('input[name="findmydevice-enabled"]'), 0 == n ? SettingsHelper("findmydevice.enabled").set(!1, function () {}) : SettingsHelper("findmydevice.enabled").set(!0, function () {}), this._gotoPreviewScreen()
        },
        _gotoPreviewScreen: function () {
            var e = null,
                t = document.querySelectorAll(".current [data-href]");
            null != t && void 0 != t && (e = t[0].getAttribute("data-href")), null != e && void 0 != e && (Settings.currentPanel = e)
        }
    };
    return n
}), navigator.mozL10n.once(function () {
    require(["findmydevice", "/shared/js/fxa_iac_client.js"], function (e) {
        e.init(FxAccountsIACHelper)
    })
});