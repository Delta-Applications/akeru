(function() {
    function e(e) {
        setTimeout(e);
    }
    window.setZeroTimeout = e, window.process = {
        immediate: !1,
        nextTick: function(e) {
            this.immediate ? e() : window.setZeroTimeout(e);
        }
    };
})();