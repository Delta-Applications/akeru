define([], function() {
    function e(e, t, n) {
        this.connection = e, this.parserClass = t, this.list = n, this.pending = n.length, 
        this.onparsed = null, this.onend = null, n.forEach(this._fetch, this);
    }
    return e.prototype = {
        _fetch: function(e) {
            this.connection.listMessages(e.uid, [ "BODY.PEEK[" + (e.partInfo.partID || "1") + "]" + (e.bytes ? "<" + e.bytes[0] + "." + e.bytes[1] + ">" : "") ], {
                byUid: !0
            }, function(t, n) {
                if (t) this._resolve(t, e, null); else {
                    var r = new this.parserClass(e.partInfo), i = n[0], o = null;
                    for (var s in i) if (/^body/.test(s)) {
                        o = i[s];
                        break;
                    }
                    o ? (r.parse(o), this._resolve(null, e, r.complete())) : this.resolve("no body", e);
                }
            }.bind(this));
        },
        _resolve: function(e, t, n) {
            this.onparsed && this.onparsed(e, t, n), !--this.pending && this.onend && this.onend();
        }
    }, {
        BodyFetcher: e
    };
});