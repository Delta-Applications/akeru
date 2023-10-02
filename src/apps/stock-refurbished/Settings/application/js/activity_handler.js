! function (t) {
    var e = {
        _readyPromise: null,
        _targetPanelId: null,
        _currentActivity: null,
        _handlers: {
            moz_configure_window: function (t) {
                var e = t.data.section || "root",
                    n = document.getElementById(e);
                if (!n || "SECTION" !== n.tagName) {
                    var i = "Trying to open an non-existent section: " + e;
                    console.warn(i), e = "root", n = document.getElementById(e)
                }
                return "root" === e ? document.body.dataset.filterBy = t.data.filterBy || "all" : n.dataset.dialog = !0, e
            },
            configure: function (t) {
                var e = t.data.section || "root",
                    n = document.getElementById(e);
                if (!n || "SECTION" !== n.tagName) {
                    var i = "Trying to open an non-existent section: " + e;
                    console.warn(i), e = "root", n = document.getElementById(e)
                }
                if ("root" === e) document.body.dataset.filterBy = t.data.filterBy || "all";
                else if ("call" === e) {
                    var r = navigator.mozMobileConnections;
                    r && r.length > 1 && (e = "call-iccs")
                } else "display" === e ? n.dataset.brightness = !0 : "dateTime" === e && "ftu" === t.data.caller ? n.dataset.ftu = !0 : "appPermissions-details" === e ? n.dataset.caller = t.data.caller : n.dataset.dialog = !0;
                return "downloads" === e && t.data.downloadFileName && (n.dataset.downloadFileName = t.data.downloadFileName), "connectivity-settings" === e && LazyLoader.load(["shared/js/mobile_operator.js"]), e
            }
        },
        _handleActivity: function (t) {
            var e = this._handlers[t.name];
            e && (this._targetPanelId = e(t))
        },
        get targetPanelId() {
            return this._targetPanelId
        },
        ready: function () {
            if (!this._readyPromise) {
                var t = this;
                this._readyPromise = new Promise(function (e) {
                    navigator.mozSetMessageHandler("activity", function (n) {
                        t._currentActivity = n, t._handleActivity(t._currentActivity.source), e()
                    })
                })
            }
            return this._readyPromise
        },
        postResult: function (t) {
            return this.ready().then(function () {
                this._currentActivity && this._currentActivity.postResult(t)
            }.bind(this))
        }
    };
    t.ActivityHandler = e
}(this);