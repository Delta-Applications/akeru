define(["require", "modules/mvvm/observable"], function (e) {
    var t = e("modules/mvvm/observable"),
        n = function () {
            this._enabled = !1, this._appStorage = navigator.getDeviceStorage("apps"), this.storage = t({
                usedPercentage: 0,
                totalSize: 0,
                usedSize: 0,
                freeSize: 0
            })
        };
    n.prototype = {
        get enabled() {
            return this._enabled
        },
        set enabled(e) {
            this._enabled !== e && (this._enabled = e, e ? (this._attachListeners(), this._getSpaceInfo()) : this._detachListeners())
        },
        _attachListeners: function () {
            this._appStorage.addEventListener("change", this)
        },
        _detachListeners: function () {
            this._appStorage.removeEventListener("change", this)
        },
        handleEvent: function (e) {
            switch (e.type) {
                case "change":
                    this._getSpaceInfo()
            }
        },
        _getSpaceInfo: function () {
            var e = this._appStorage;
            return e ? (e.freeSpace().onsuccess = function (t) {
                this.storage.freeSize = t.target.result, e.usedSpace().onsuccess = function (e) {
                    this.storage.usedSize = e.target.result, this.storage.totalSize = this.storage.usedSize + this.storage.freeSize;
                    var t = 0 === this.storage.totalSize ? 0 : 100 * this.storage.usedSize / this.storage.totalSize;
                    t > 100 && (t = 100), this.storage.usedPercentage = t
                }.bind(this)
            }.bind(this), void 0) : (console.error("Cannot get DeviceStorage for: app"), void 0)
        }
    };
    var i = new n;
    return i.enabled = !0, i
});