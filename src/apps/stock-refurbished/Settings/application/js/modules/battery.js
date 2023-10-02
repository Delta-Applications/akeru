define(["require", "modules/navigator/battery", "modules/mvvm/observable"], function (t) {
    var e = t("modules/navigator/battery"),
        n = t("modules/mvvm/observable"),
        i = function () {
            return Math.min(100, Math.round(100 * e.level))
        },
        o = function () {
            return e.charging ? 100 == i() ? "charged" : "charging" : "unplugged"
        },
        r = n({
            level: i(),
            state: o()
        });
    return e.addEventListener("levelchange", function () {
        r.level = i(), 100 === r.level && (r.state = o())
    }), e.addEventListener("chargingchange", function () {
        r.state = o()
    }), r
});