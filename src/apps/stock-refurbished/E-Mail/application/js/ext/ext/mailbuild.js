(function(e, t) {
    "function" == typeof define && define.amd ? define([ "mimefuncs", "mimetypes", "punycode", "addressparser" ], t) : "object" == typeof exports ? module.exports = t(require("mimefuncs"), require("mimetypes"), require("punycode"), require("wo-addressparser")) : e.mailbuild = t(mimefuncs, mimetypes, punycode, addressparser);
})(this, function(e, t, r, n) {
    function o(e, r) {
        this.nodeCounter = 0, r = r || {}, this.baseBoundary = r.baseBoundary || Date.now().toString() + Math.random(), 
        this.date = new Date(), this.rootNode = r.rootNode || this, r.filename && (this.filename = r.filename, 
        e || (e = t.detectMimeType(this.filename.split(".").pop()))), this.parentNode = r.parentNode, 
        this._nodeId = ++this.rootNode.nodeCounter, this._childNodes = [], this._headers = [], 
        e && this.setHeader("content-type", e);
    }
    return o.prototype.createChild = function(e, t) {
        t || "object" != typeof e || (t = e, e = void 0);
        var r = new o(e, t);
        return this.appendChild(r), r;
    }, o.prototype.appendChild = function(e) {
        return e.rootNode !== this.rootNode && (e.rootNode = this.rootNode, e._nodeId = ++this.rootNode.nodeCounter), 
        e.parentNode = this, this._childNodes.push(e), e;
    }, o.prototype.replace = function(e) {
        return e === this ? this : (this.parentNode._childNodes.forEach(function(t, r) {
            t === this && (e.rootNode = this.rootNode, e.parentNode = this.parentNode, e._nodeId = this._nodeId, 
            this.rootNode = this, this.parentNode = void 0, e.parentNode._childNodes[r] = e);
        }.bind(this)), e);
    }, o.prototype.remove = function() {
        if (!this.parentNode) return this;
        for (var e = this.parentNode._childNodes.length - 1; e >= 0; e--) if (this.parentNode._childNodes[e] === this) return this.parentNode._childNodes.splice(e, 1), 
        this.parentNode = void 0, this.rootNode = this, this;
    }, o.prototype.setHeader = function(e, t) {
        var r, n = !1;
        if (!t && e && "object" == typeof e) return e.key && e.value ? this.setHeader(e.key, e.value) : Array.isArray(e) ? e.forEach(function(e) {
            this.setHeader(e.key, e.value);
        }.bind(this)) : Object.keys(e).forEach(function(t) {
            this.setHeader(t, e[t]);
        }.bind(this)), this;
        e = this._normalizeHeaderKey(e), r = {
            key: e,
            value: t
        };
        for (var o = 0, i = this._headers.length; i > o; o++) this._headers[o].key === e && (n ? (this._headers.splice(o, 1), 
        o--, i--) : (this._headers[o] = r, n = !0));
        return n || this._headers.push(r), this;
    }, o.prototype.addHeader = function(e, t) {
        return !t && e && "object" == typeof e ? (e.key && e.value ? this.addHeader(e.key, e.value) : Array.isArray(e) ? e.forEach(function(e) {
            this.addHeader(e.key, e.value);
        }.bind(this)) : Object.keys(e).forEach(function(t) {
            this.addHeader(t, e[t]);
        }.bind(this)), this) : (this._headers.push({
            key: this._normalizeHeaderKey(e),
            value: t
        }), this);
    }, o.prototype.getHeader = function(e) {
        e = this._normalizeHeaderKey(e);
        for (var t = 0, r = this._headers.length; r > t; t++) if (this._headers[t].key === e) return this._headers[t].value;
    }, o.prototype.setContent = function(e) {
        return this.content = e, this;
    }, o.prototype.build = function() {
        var t, r, n = [], o = (this.getHeader("Content-Type") || "").toString().toLowerCase().trim();
        if (this.content && (t = (this.getHeader("Content-Transfer-Encoding") || "").toString().toLowerCase().trim(), 
        (!t || [ "base64", "quoted-printable" ].indexOf(t) < 0) && (/^text\//i.test(o) ? this._isPlainText(this.content) ? (/^.{77,}/m.test(this.content) && (r = !0), 
        t = "7bit") : t = "quoted-printable" : /^multipart\//i.test(o) || (t = t || "base64")), 
        t && this.setHeader("Content-Transfer-Encoding", t)), this.filename && !this.getHeader("Content-Disposition") && this.setHeader("Content-Disposition", "attachment"), 
        this._headers.forEach(function(t) {
            var o, i = t.key, s = t.value;
            switch (t.key) {
              case "Content-Disposition":
                o = e.parseHeaderValue(s), this.filename && (o.params.filename = this.filename), 
                s = this._buildHeaderValue(o);
                break;

              case "Content-Type":
                o = e.parseHeaderValue(s), this._handleContentType(o), r && (o.params.format = "flowed"), 
                "flowed" === String(o.params.format).toLowerCase().trim() && (r = !0), o.value.match(/^text\//) && "string" == typeof this.content && /[\u0080-\uFFFF]/.test(this.content) && (o.params.charset = "utf-8"), 
                s = this._buildHeaderValue(o);
                break;

              case "Bcc":
                return;
            }
            s = this._encodeHeaderValue(i, s), (s || "").toString().trim() && n.push(e.foldLines(i + ": " + s, 76));
        }.bind(this)), this.rootNode === this && (this.getHeader("Date") || n.push("Date: " + this.date.toUTCString().replace(/GMT/, "+0000")), 
        this.getHeader("Message-Id") || n.push("Message-Id: <" + [ 0, 0, 0 ].reduce(function(e) {
            return e + "-" + Math.floor(4294967296 * (1 + Math.random())).toString(16).substring(1);
        }, Date.now()) + "@" + (this.getEnvelope().from || "localhost").split("@").pop() + ">"), 
        this.getHeader("MIME-Version") || n.push("MIME-Version: 1.0")), n.push(""), this.content) {
            switch (t) {
              case "quoted-printable":
                n.push(e.quotedPrintableEncode(this.content));
                break;

              case "base64":
                n.push(e.base64Encode(this.content, "object" == typeof this.content && "binary" || !1));
                break;

              default:
                r ? n.push(e.foldLines(this.content.replace(/\r?\n/g, "\r\n").replace(/^( |From|>)/gim, " $1"), 76, !0)) : n.push(this.content.replace(/\r?\n/g, "\r\n"));
            }
            this.multipart && n.push("");
        }
        return this.multipart && (this._childNodes.forEach(function(e) {
            n.push("--" + this.boundary), n.push(e.build());
        }.bind(this)), n.push("--" + this.boundary + "--"), n.push("")), n.join("\r\n");
    }, o.prototype.getEnvelope = function() {
        var e = {
            from: !1,
            to: []
        };
        return this._headers.forEach(function(t) {
            var r = [];
            "From" === t.key || !e.from && [ "Reply-To", "Sender" ].indexOf(t.key) >= 0 ? (this._convertAddresses(this._parseAddresses(t.value), r), 
            r.length && r[0] && (e.from = r[0])) : [ "To", "Cc", "Bcc" ].indexOf(t.key) >= 0 && this._convertAddresses(this._parseAddresses(t.value), e.to);
        }.bind(this)), e;
    }, o.prototype._parseAddresses = function(e) {
        return [].concat.apply([], [].concat(e).map(function(e) {
            return e && e.address && (e = this._convertAddresses(e)), n.parse(e);
        }.bind(this)));
    }, o.prototype._normalizeHeaderKey = function(e) {
        return (e || "").toString().replace(/\r?\n|\r/g, " ").trim().toLowerCase().replace(/^MIME\b|^[a-z]|\-[a-z]/gi, function(e) {
            return e.toUpperCase();
        });
    }, o.prototype._buildHeaderValue = function(t) {
        var r = [];
        return Object.keys(t.params || {}).forEach(function(n) {
            "filename" === n ? e.continuationEncode(n, t.params[n], 50).forEach(function(e) {
                r.push(e.key + "=" + e.value);
            }) : r.push(n + "=" + this._escapeHeaderArgument(t.params[n]));
        }.bind(this)), t.value + (r.length ? "; " + r.join("; ") : "");
    }, o.prototype._escapeHeaderArgument = function(e) {
        return e.match(/[\s'"\\;\/=]|^\-/g) ? '"' + e.replace(/(["\\])/g, "\\$1") + '"' : e;
    }, o.prototype._handleContentType = function(e) {
        this.contentType = e.value.trim().toLowerCase(), this.multipart = this.contentType.split("/").reduce(function(e, t) {
            return "multipart" === e ? t : !1;
        }), this.boundary = this.multipart ? e.params.boundary = e.params.boundary || this.boundary || this._generateBoundary() : !1;
    }, o.prototype._generateBoundary = function() {
        return "----sinikael-?=_" + this._nodeId + "-" + this.rootNode.baseBoundary;
    }, o.prototype._encodeHeaderValue = function(t, r) {
        switch (t = this._normalizeHeaderKey(t)) {
          case "From":
          case "Sender":
          case "To":
          case "Cc":
          case "Bcc":
          case "Reply-To":
            return this._convertAddresses(this._parseAddresses(r));

          case "Message-Id":
          case "In-Reply-To":
          case "Content-Id":
            return r = (r || "").toString().replace(/\r?\n|\r/g, " "), "<" !== r.charAt(0) && (r = "<" + r), 
            ">" !== r.charAt(r.length - 1) && (r += ">"), r;

          case "References":
            return r = [].concat.apply([], [].concat(r || "").map(function(e) {
                return e = (e || "").toString().replace(/\r?\n|\r/g, " ").trim(), e.replace(/<[^>]*>/g, function(e) {
                    return e.replace(/\s/g, "");
                }).split(/\s+/);
            })).map(function(e) {
                return "<" !== e.charAt(0) && (e = "<" + e), ">" !== e.charAt(e.length - 1) && (e += ">"), 
                e;
            }), r.join(" ").trim();

          default:
            return r = (r || "").toString().replace(/\r?\n|\r/g, " "), e.mimeWordsEncode(r, "Q", 52);
        }
    }, o.prototype._convertAddresses = function(t, n) {
        var o = [];
        return n = n || [], [].concat(t || []).forEach(function(t) {
            t.address ? (t.address = t.address.replace(/^.*?(?=\@)/, function(t) {
                return e.mimeWordsEncode(t, "Q", 52);
            }).replace(/@.+$/, function(e) {
                return "@" + r.toASCII(e.substr(1));
            }), t.name ? t.name && o.push(this._encodeAddressName(t.name) + " <" + t.address + ">") : o.push(t.address), 
            n.indexOf(t.address) < 0 && n.push(t.address)) : t.group && o.push(this._encodeAddressName(t.name) + ":" + (t.group.length ? this._convertAddresses(t.group, n) : "").trim() + ";");
        }.bind(this)), o.join(", ");
    }, o.prototype._encodeAddressName = function(t) {
        return /^[\w ']*$/.test(t) ? t : /^[\x20-\x7e]*$/.test(t) ? '"' + t.replace(/([\\"])/g, "\\$1") + '"' : e.mimeWordEncode(t, "Q", 52);
    }, o.prototype._isPlainText = function(e) {
        return "string" != typeof e || /[\x00-\x08\x0b\x0c\x0e-\x1f\u0080-\uFFFF]/.test(e) ? !1 : !0;
    }, o;
});