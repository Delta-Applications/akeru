define([], function() {
    return function(e, t, n) {
        return Object.keys(t).forEach(function(r) {
            (!e.hasOwnProperty(r) || n) && (e[r] = t[r]);
        }), e;
    };
});