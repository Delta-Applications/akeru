define([ "mimeparser", "mimefuncs", "exports" ], function(e, t, n) {
    function r(t) {
        this._partDef = t;
        var n = this._parser = new e();
        this._totalBytes = 0;
        var r = "", i = "";
        t.params && t.params.charset && (r = '; charset="' + t.params.charset.toLowerCase() + '"'), 
        t.params && t.params.format && (i = '; format="' + t.params.format.toLowerCase() + '"'), 
        n.write("Content-Type: " + t.type.toLowerCase() + "/" + t.subtype.toLowerCase() + r + i + "\r\n"), 
        t.encoding && n.write("Content-Transfer-Encoding: " + t.encoding + "\r\n"), n.write("\r\n"), 
        t.pendingBuffer && this.parse(t.pendingBuffer);
    }
    r.prototype = {
        parse: function(e) {
            this._totalBytes += e.length, this._parser.write(e);
        },
        complete: function() {
            this._parser.end();
            var e = "";
            return this._parser.node.content && (e = t.charset.decode(this._parser.node.content, "utf-8")), 
            {
                bytesFetched: this._totalBytes,
                text: e
            };
        }
    }, n.TextParser = r;
});