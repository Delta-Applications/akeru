define([ "./textparser" ], function(e) {
    function t(e, t) {
        var n = new Uint8Array(e.byteLength + t.byteLength);
        return n.set(new Uint8Array(e), 0), n.set(new Uint8Array(t), e.byteLength), n.buffer;
    }
    function n() {
        r.apply(this, arguments);
    }
    var r = e.TextParser;
    return n.prototype = {
        parse: function(e) {
            this._buffer = this._buffer ? t(this._buffer, e) : e, r.prototype.parse.apply(this, arguments);
        },
        complete: function() {
            var e = r.prototype.complete.apply(this, arguments);
            return e.buffer = this._buffer, e;
        }
    }, {
        SnippetParser: n
    };
});