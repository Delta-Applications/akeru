define([ "browserbox", "logic", "./client", "../syncbase", "exports" ], function(e, t, n, r, i) {
    i.probeAccount = function(e, r) {
        var i = t.scope("ImapProber");
        t(i, "connecting", {
            connInfo: r
        });
        var o;
        return n.createImapConnection(e, r, function() {
            t(i, "credentials-updated");
        }).then(function(e) {
            return o = e, t(i, "success"), {
                conn: o
            };
        }).catch(function(e) {
            throw e = n.normalizeImapError(o, e), t(i, "error", {
                error: e
            }), o && o.close(), e;
        });
    };
});