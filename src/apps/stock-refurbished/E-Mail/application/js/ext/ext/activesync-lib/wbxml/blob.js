function Blob(e, t) {
    this._parts = e;
    var n = 0;
    e.forEach(function(e) {
        n += e instanceof Blob ? e.size : e instanceof ArrayBuffer ? e.byteLength : e.length;
    }), this.size = n, this.type = t ? t.type : null;
}

function FileReader() {
    this.error = null, this.readyState = this.EMPTY, this.result = null, this.onabort = null, 
    this.onerror = null, this.onload = null, this.onloadend = null, this.onloadstart = null, 
    this.onprogress = null;
}

exports.Blob = Blob, Blob.prototype = {
    _asArrayBuffer: function() {
        var e = new ArrayBuffer(this.size), t = new Uint8Array(e), n = 0;
        return this._parts.forEach(function(e) {
            var r;
            if (e instanceof Blob) {
                var i = e._asArrayBuffer();
                r = new Uint8Array(i), t.set(r, n), n += r.length;
            } else if ("string" == typeof e) {
                var o = new TextEncoder("utf-8");
                r = o.encode(e), t.set(r, n), n += r.length;
            } else e instanceof ArrayBuffer ? (r = new Uint8Array(e), t.set(r, n), n += r.length) : (t.set(e, n), 
            n += e.length);
        }), e;
    }
}, exports.FileReader = FileReader, FileReader.prototype = {
    EMPTY: 0,
    LOADING: 1,
    DONE: 2,
    readAsArrayBuffer: function(e) {
        process.nextTick(function() {
            var e = {
                target: this
            };
            this.onload && this.onload(e), this.onloadend && this.onloadend(e);
        }.bind(this)), this.result = e._asArrayBuffer();
    },
    readAsBinaryString: function() {
        throw new Error("not implemented");
    },
    readAsDataURL: function() {
        throw new Error("not implemented");
    },
    readAsText: function() {
        throw new Error("not implemented");
    }
};