define([ "logic", "./client", "exports" ], function(e, t, n) {
    function r(t, n) {
        return e(i, "checking-address-validity", {
            ns: "SmtpProber",
            _address: n
        }), new Promise(function(e, r) {
            t.useEnvelope({
                from: n,
                to: [ n ]
            }), t.onready = function() {
                e();
            }, t.onerror = function(e) {
                r(e);
            };
        });
    }
    var i = e.scope("SmtpProber");
    n.probeAccount = function(n, o) {
        e(i, "connecting", {
            _credentials: n,
            connInfo: o
        });
        var s;
        return t.createSmtpConnection(n, o, function() {
            e(i, "credentials-updated");
        }).then(function(e) {
            return s = e, r(s, o.emailAddress);
        }).then(function() {
            return e(i, "success"), s.close(), s;
        }).catch(function(n) {
            var r = t.analyzeSmtpError(s, n, !1);
            throw s && s.close(), e(i, "error", {
                error: r,
                connInfo: o
            }), r;
        });
    };
});