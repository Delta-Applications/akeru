var AlbumArt = function() {
    function e(e, t) {
        if (!e.metadata.picture) return Promise.resolve(t ? null : n(e));
        var r = i(e);
        return r && r in p ? Promise.resolve(p[r]) : o(r).then(function(t) {
            return t || s(r, e)
        }).then(function(e) {
            return a(r, e)
        })
    }

    function t(e, t) {
        if (!e.metadata.picture) return t ? Promise.resolve(null) : l(n(e));
        var r = i(e);
        return o(r).then(function(t) {
            return t || s(r, e)
        })
    }

    function n(e) {
        var t = e.metadata,
            n = t.album || t.artist ? t.album + t.artist : t.title,
            i = Math.abs(r(n)) % 11 + 1;
        return "/style/images/albumart_" + i + ".jpg" //transparent so we can show our beautiful visualizer
    }

    function r(e) {
        var t = 0;
        if (0 === e.length) return t;
        for (var n = 0; n < e.length; n++) {
            var r = e.charCodeAt(n);
            t = (t << 5) - t + r, t &= t
        }
        return t
    }

    function i(e) {
        var t = e.metadata;
        if (t.picture.filename) return "external." + t.picture.filename;
        if ("embedded" === t.picture.flavor) {
            var n = t.album,
                r = t.artist,
                i = t.picture.end - t.picture.start;
            return n || r ? "thumbnail." + n + "." + r + "." + i : "thumbnail." + (e.name || e.blob.name)
        }
        return null
    }

    function o(e) {
        return e ? new Promise(function(t) {
            asyncStorage.getItem(e, function(e) {
                t(e)
            })
        }) : Promise.resolve(null)
    }

    function a(e, t) {
        var n = URL.createObjectURL(t);
        return e && (p[e] = n), n
    }

    function s(e, t) {
        return u(t).then(function(e) {
            return ImageUtils.resizeAndCropToCover(e, f, d)
        }).then(function(t) {
            return e && asyncStorage.setItem(e, t), t
        })
    }

    function u(e) {
        var t = e.metadata.picture;
        return new Promise(function(n, r) {
            if (t.blob) n(t.blob);
            else if (t.filename) {
                var i = AudioMetadata.pictureStorage.get(t.filename);
                i.onsuccess = function() {
                    n(this.result)
                }, i.onerror = function() {
                    r(this.error)
                }
            } else if (t.start) c(e).then(function(e) {
                var r = e.slice(t.start, t.end, t.type);
                n(r)
            }).catch(r);
            else {
                var o = new Error("unknown picture flavor: " + t.flavor);
                console.error(o), r(o)
            }
        })
    }

    function c(e) {
        return new Promise(function(t, n) {
            e.blob ? t(e.blob) : musicdb.getFile(e.name, function(r) {
                r ? t(r) : n("unable to get file: " + e.name)
            })
        })
    }

    function l(e) {
        return new Promise(function(t, n) {
            var r = new XMLHttpRequest;
            r.open("GET", e, !0), r.responseType = "blob", r.onload = function() {
                t(r.response)
            }, r.onerror = function() {
                n(null)
            }, r.send()
        })
    }
    var f = 300,
        d = 300,
        p = {};
    return {
        getCoverURL: e,
        getCoverBlob: t
    }
}();