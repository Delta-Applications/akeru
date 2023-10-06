var GestureDetector = function() {
    function e(t, n) {
        this.element = t, this.options = n || {}, this.options.panThreshold = this.options.panThreshold || e.PAN_THRESHOLD, 
        this.state = m, this.timers = {};
    }
    function t(e) {
        var t = e.timeStamp;
        return t > 2 * Date.now() ? Math.floor(t / 1e3) : t;
    }
    function n(e, n) {
        return Object.freeze({
            screenX: n.screenX,
            screenY: n.screenY,
            clientX: n.clientX,
            clientY: n.clientY,
            timeStamp: t(e)
        });
    }
    function r(e, n, r) {
        return Object.freeze({
            screenX: l((n.screenX + r.screenX) / 2),
            screenY: l((n.screenY + r.screenY) / 2),
            clientX: l((n.clientX + r.clientX) / 2),
            clientY: l((n.clientY + r.clientY) / 2),
            timeStamp: t(e)
        });
    }
    function i(t, n) {
        var r = e.THRESHOLD_SMOOTHING;
        return Object.freeze({
            screenX: l(t.screenX + r * (n.screenX - t.screenX)),
            screenY: l(t.screenY + r * (n.screenY - t.screenY)),
            clientX: l(t.clientX + r * (n.clientX - t.clientX)),
            clientY: l(t.clientY + r * (n.clientY - t.clientY)),
            timeStamp: l(t.timeStamp + r * (n.timeStamp - t.timeStamp))
        });
    }
    function o(e, t) {
        var n = t.screenX - e.screenX, r = t.screenY - e.screenY;
        return d(n * n + r * r);
    }
    function s(e, t) {
        return 180 * f(t.screenY - e.screenY, t.screenX - e.screenX) / h;
    }
    function a(e, t) {
        var n = t - e;
        return n > 180 ? n -= 360 : -180 >= n && (n += 360), n;
    }
    function c(t, n) {
        var r = u(n.screenX - t.screenX), i = u(n.screenY - t.screenY), o = n.timeStamp - t.timeStamp;
        return r < e.DOUBLE_TAP_DISTANCE && i < e.DOUBLE_TAP_DISTANCE && o < e.DOUBLE_TAP_TIME;
    }
    e.prototype.startDetecting = function() {
        var e = this;
        p.forEach(function(t) {
            e.element.addEventListener(t, e);
        });
    }, e.prototype.stopDetecting = function() {
        var e = this;
        p.forEach(function(t) {
            e.element.removeEventListener(t, e);
        });
    }, e.prototype.handleEvent = function(e) {
        var t = this.state[e.type];
        if (t) if (e.changedTouches) {
            "touchend" === e.type && e.changedTouches.length > 1 && console.warn("gesture_detector.js: spurious extra changed touch on touchend. See https://bugzilla.mozilla.org/show_bug.cgi?id=785554");
            for (var n = 0; n < e.changedTouches.length; n++) t(this, e, e.changedTouches[n]), 
            t = this.state[e.type];
        } else t(this, e);
    }, e.prototype.startTimer = function(e, t) {
        this.clearTimer(e);
        var n = this;
        this.timers[e] = setTimeout(function() {
            n.timers[e] = null;
            var t = n.state[e];
            t && t(n, e);
        }, t);
    }, e.prototype.clearTimer = function(e) {
        this.timers[e] && (clearTimeout(this.timers[e]), this.timers[e] = null);
    }, e.prototype.switchTo = function(e, t, n) {
        this.state = e, e.init && e.init(this, t, n);
    }, e.prototype.emitEvent = function(e, t) {
        if (!this.target) return console.error("Attempt to emit event with no target"), 
        void 0;
        var n = this.element.ownerDocument.createEvent("CustomEvent");
        n.initCustomEvent(e, !0, !0, t), this.target.dispatchEvent(n);
    }, e.HOLD_INTERVAL = 1e3, e.PAN_THRESHOLD = 20, e.DOUBLE_TAP_DISTANCE = 50, e.DOUBLE_TAP_TIME = 500, 
    e.VELOCITY_SMOOTHING = .5, e.SCALE_THRESHOLD = 20, e.ROTATE_THRESHOLD = 22.5, e.THRESHOLD_SMOOTHING = .9;
    var u = Math.abs, l = Math.floor, d = Math.sqrt, f = Math.atan2, h = Math.PI, p = [ "touchstart", "touchmove", "touchend" ], m = {
        name: "initialState",
        init: function(e) {
            e.target = null, e.start = e.last = null, e.touch1 = e.touch2 = null, e.vx = e.vy = null, 
            e.startDistance = e.lastDistance = null, e.startDirection = e.lastDirection = null, 
            e.lastMidpoint = null, e.scaled = e.rotated = null;
        },
        touchstart: function(e, t, n) {
            e.switchTo(g, t, n);
        }
    }, g = {
        name: "touchStartedState",
        init: function(t, r, i) {
            t.target = r.target, t.touch1 = i.identifier, t.start = t.last = n(r, i), t.options.holdEvents && t.startTimer("holdtimeout", e.HOLD_INTERVAL);
        },
        touchstart: function(e, t, n) {
            e.clearTimer("holdtimeout"), e.switchTo(b, t, n);
        },
        touchmove: function(e, t, n) {
            n.identifier === e.touch1 && (u(n.screenX - e.start.screenX) > e.options.panThreshold || u(n.screenY - e.start.screenY) > e.options.panThreshold) && (e.clearTimer("holdtimeout"), 
            e.switchTo(v, t, n));
        },
        touchend: function(e, t, r) {
            r.identifier === e.touch1 && (e.lastTap && c(e.lastTap, e.start) ? (e.emitEvent("tap", e.start), 
            e.emitEvent("dbltap", e.start), e.lastTap = null) : (e.emitEvent("tap", e.start), 
            e.lastTap = n(t, r)), e.clearTimer("holdtimeout"), e.switchTo(m));
        },
        holdtimeout: function(e) {
            e.switchTo(y);
        }
    }, v = {
        name: "panStartedState",
        init: function(e, t, r) {
            e.start = e.last = i(e.start, n(t, r)), "touchmove" === t.type && v.touchmove(e, t, r);
        },
        touchmove: function(t, r, i) {
            if (i.identifier === t.touch1) {
                var o = n(r, i);
                t.emitEvent("pan", {
                    absolute: {
                        dx: o.screenX - t.start.screenX,
                        dy: o.screenY - t.start.screenY
                    },
                    relative: {
                        dx: o.screenX - t.last.screenX,
                        dy: o.screenY - t.last.screenY
                    },
                    position: o
                });
                var s = o.timeStamp - t.last.timeStamp, a = (o.screenX - t.last.screenX) / s, c = (o.screenY - t.last.screenY) / s;
                null == t.vx ? (t.vx = a, t.vy = c) : (t.vx = t.vx * e.VELOCITY_SMOOTHING + a * (1 - e.VELOCITY_SMOOTHING), 
                t.vy = t.vy * e.VELOCITY_SMOOTHING + c * (1 - e.VELOCITY_SMOOTHING)), t.last = o;
            }
        },
        touchend: function(e, t, r) {
            if (r.identifier === e.touch1) {
                var i = n(t, r), o = i.screenX - e.start.screenX, s = i.screenY - e.start.screenY, a = 180 * f(s, o) / h;
                0 > a && (a += 360);
                var c;
                a >= 315 || 45 > a ? c = "right" : a >= 45 && 135 > a ? c = "down" : a >= 135 && 225 > a ? c = "left" : a >= 225 && 315 > a && (c = "up"), 
                e.emitEvent("swipe", {
                    start: e.start,
                    end: i,
                    dx: o,
                    dy: s,
                    dt: t.timeStamp - e.start.timeStamp,
                    vx: e.vx,
                    vy: e.vy,
                    direction: c,
                    angle: a
                }), e.switchTo(m);
            }
        }
    }, y = {
        name: "holdState",
        init: function(e) {
            e.emitEvent("holdstart", e.start);
        },
        touchmove: function(e, t, r) {
            var i = n(t, r);
            e.emitEvent("holdmove", {
                absolute: {
                    dx: i.screenX - e.start.screenX,
                    dy: i.screenY - e.start.screenY
                },
                relative: {
                    dx: i.screenX - e.last.screenX,
                    dy: i.screenY - e.last.screenY
                },
                position: i
            }), e.last = i;
        },
        touchend: function(e, t, r) {
            var i = n(t, r);
            e.emitEvent("holdend", {
                start: e.start,
                end: i,
                dx: i.screenX - e.start.screenX,
                dy: i.screenY - e.start.screenY
            }), e.switchTo(m);
        }
    }, b = {
        name: "transformState",
        init: function(e, t, n) {
            e.touch2 = n.identifier;
            var r = t.touches.identifiedTouch(e.touch1), i = t.touches.identifiedTouch(e.touch2);
            e.startDistance = e.lastDistance = o(r, i), e.startDirection = e.lastDirection = s(r, i), 
            e.scaled = e.rotated = !1;
        },
        touchmove: function(t, n, i) {
            if (i.identifier === t.touch1 || i.identifier === t.touch2) {
                var c = n.touches.identifiedTouch(t.touch1), d = n.touches.identifiedTouch(t.touch2), f = r(n, c, d), h = o(c, d), p = s(c, d), m = a(t.startDirection, p);
                t.scaled || (u(h - t.startDistance) > e.SCALE_THRESHOLD ? (t.scaled = !0, t.startDistance = t.lastDistance = l(t.startDistance + e.THRESHOLD_SMOOTHING * (h - t.startDistance))) : h = t.startDistance), 
                t.rotated || (u(m) > e.ROTATE_THRESHOLD ? t.rotated = !0 : p = t.startDirection), 
                (t.scaled || t.rotated) && (t.emitEvent("transform", {
                    absolute: {
                        scale: h / t.startDistance,
                        rotate: a(t.startDirection, p)
                    },
                    relative: {
                        scale: h / t.lastDistance,
                        rotate: a(t.lastDirection, p)
                    },
                    midpoint: f
                }), t.lastDistance = h, t.lastDirection = p, t.lastMidpoint = f);
            }
        },
        touchend: function(e, t, n) {
            if (n.identifier === e.touch2) e.touch2 = null; else {
                if (n.identifier !== e.touch1) return;
                e.touch1 = e.touch2, e.touch2 = null;
            }
            (e.scaled || e.rotated) && e.emitEvent("transformend", {
                absolute: {
                    scale: e.lastDistance / e.startDistance,
                    rotate: a(e.startDirection, e.lastDirection)
                },
                relative: {
                    scale: 1,
                    rotate: 0
                },
                midpoint: e.lastMidpoint
            }), e.switchTo(_);
        }
    }, _ = {
        name: "afterTransformState",
        touchstart: function(e, t, n) {
            e.switchTo(b, t, n);
        },
        touchend: function(e, t, n) {
            n.identifier === e.touch1 && e.switchTo(m);
        }
    };
    return e;
}();