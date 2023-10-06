define([ "mailbuild", "../mailchew", "../util" ], function(e, t, n) {
    function r(e) {
        return e.replace(/\r?\n|\r/g, "\r\n");
    }
    function i(n, i, s) {
        var a = this.header = n.header, u = this.body = n.body;
        this.account = i, this.identity = s, this.sentDate = new Date(this.header.date), 
        this._smartWakeLock = null, this.messageId = "<" + Date.now() + Math.random().toString(16).substr(1) + "@mozgaia>";
        var c, l = u.bodyReps[0].content[1];
        if (2 === u.bodyReps.length) {
            var d = u.bodyReps[1].content;
            d = d.replace(/cid-src|ext-src/g, "src"), c = new e("text/html"), c.setContent(r(t.mergeUserTextWithHTML(l, d)));
        } else c = new e("text/plain"), c.setContent(r(l));
        var f;
        u.attachments.length ? (f = this._rootNode = new e("multipart/mixed"), f.appendChild(c)) : f = this._rootNode = c, 
        f.setHeader("From", o([ this.identity ])), f.setHeader("Subject", a.subject), this.identity.replyTo && f.setHeader("Reply-To", this.identity.replyTo), 
        a.to && a.to.length && f.setHeader("To", o(a.to)), a.cc && a.cc.length && f.setHeader("Cc", o(a.cc)), 
        a.bcc && a.bcc.length && f.setHeader("Bcc", o(a.bcc)), f.setHeader("User-Agent", "GaiaMail/0.2"), 
        f.setHeader("Date", this.sentDate.toUTCString()), f.setHeader("Message-Id", this.messageId), 
        u.references && f.setHeader("References", u.references), f.setHeader("Content-Transfer-Encoding", "quoted-printable"), 
        this._blobReplacements = [], this._uniqueBlobBoundary = "{{blob!" + Math.random() + Date.now() + "}}", 
        u.attachments.forEach(function(t) {
            try {
                var n = new e(t.type, {
                    filename: t.name
                });
                n.setHeader("Content-Transfer-Encoding", "base64"), n.setContent(this._uniqueBlobBoundary), 
                f.appendChild(n), this._blobReplacements.push(new Blob(t.file));
            } catch (r) {
                console.error("Problem attaching attachment:", r, "\n", r.stack);
            }
        }.bind(this));
    }
    var o = n.formatAddresses;
    return e.prototype.removeHeader = function(e) {
        for (var t = 0, n = this._headers.length; n > t; t++) if (this._headers[t].key === e) {
            this._headers.splice(t, 1);
            break;
        }
    }, i.prototype = {
        getEnvelope: function() {
            return this._rootNode.getEnvelope();
        },
        withMessageBlob: function(e, t) {
            var n = "Bcc-Temp", r = /^Bcc-Temp: /m, i = e.includeBcc && this.header.bcc && this.header.bcc.length;
            i ? this._rootNode.setHeader(n, o(this.header.bcc)) : this._rootNode.removeHeader(n);
            var s = this._rootNode.build();
            e.smtp && (s = s.replace(/\n\./g, "\n..")), i && (s = s.replace(r, "Bcc: ")), "\r\n" !== s.slice(-2) && (s += "\r\n");
            var a = s.split(btoa(this._uniqueBlobBoundary) + "\r\n");
            this._blobReplacements.forEach(function(e, t) {
                a.splice(2 * t + 1, 0, e);
            }), t(new Blob(a, {
                type: this._rootNode.getHeader("content-type")
            }));
        },
        setSmartWakeLock: function(e) {
            this._smartWakeLock = e;
        },
        renewSmartWakeLock: function(e) {
            this._smartWakeLock && this._smartWakeLock.renew(e);
        }
    }, {
        Composer: i
    };
});