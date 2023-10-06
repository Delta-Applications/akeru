define([ "./pop3", "../syncbase", "logic", "../errorutils", "exports" ], function(e, t, n, r, i) {
    function o(e) {
        return e && e.name ? "bad-user-or-pass" === e.name && e.message && a.test(e.message) ? "pop3-disabled" : "bad-user-or-pass" === e.name && e.message && u.test(e.message) ? "pop3-disabled" : "unresponsive-server" === e.name && e.exception && e.exception.name && /security/i.test(e.exception.name) ? "bad-security" : ("unresponsive-server" === e.name || "bad-user-or-pass" === e.name) && e.message && /\[(LOGIN-DELAY|SYS|IN-USE)/i.test(e.message) ? "server-maintenance" : e.name : null;
    }
    var s = n.scope("Pop3Prober");
    i.probeAccount = function(r, i) {
        var o = {
            host: i.hostname,
            port: i.port,
            crypto: i.crypto,
            username: r.username,
            password: r.password,
            connTimeout: t.CONNECT_TIMEOUT_MS
        };
        n(s, "connecting", {
            connInfo: i
        });
        var a, u, l = new Promise(function(e, t) {
            a = e, u = t;
        }), d = new e.Pop3Client(o, function(e) {
            return e ? (u(e), void 0) : (d.protocol.sendRequest("UIDL", [ "1" ], !1, function(e, t) {
                t ? d.protocol.sendRequest("TOP", [ "1", "0" ], !0, function(e, t) {
                    t ? a(d) : e.err ? (n(s, "server-not-great", {
                        why: "no TOP"
                    }), u("pop-server-not-great")) : u(t.err);
                }) : d.protocol.sendRequest("UIDL", [], !0, function(e, t) {
                    t ? a(d) : e.err ? (n(s, "server-not-great", {
                        why: "no UIDL"
                    }), u("pop-server-not-great")) : u(t.err);
                });
            }), void 0);
        });
        return l.then(function(e) {
            return n(s, "success"), {
                conn: e,
                timezoneOffset: null
            };
        }).catch(function(e) {
            return e = c(e), n(s, "error", {
                error: e
            }), d && d.close(), Promise.reject(e);
        });
    };
    var a = /\[SYS\/PERM\] Your account is not enabled for POP/, u = /\[SYS\/PERM\] POP access is disabled for your domain\./, c = i.normalizePop3Error = function(e) {
        var t = o(e) || r.analyzeException(e) || "unknown";
        return n(s, "normalized-error", {
            error: e,
            reportAs: t
        }), t;
    };
});