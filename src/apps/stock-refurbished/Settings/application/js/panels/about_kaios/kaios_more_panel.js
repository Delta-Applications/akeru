define(["require", "modules/settings_panel", "modules/settings_service"], function (e) {
    var t = e("modules/settings_panel"),
        n = e("modules/settings_service");
    return function () {
        function e() {
            var e = {
                menuClassName: "menu-button",
                header: {
                    l10nId: "message"
                },
                items: [{
                    name: "Done",
                    l10nId: "done",
                    priority: 3,
                    method: function () {
                        n.navigate("aboutKaios")
                    }
                }]
            };
            SettingsSoftkey.init(e), SettingsSoftkey.show()
        }
        return t({
            onInit: function () {},
            onBeforeShow: function () {
                e()
            },
            onBeforeHide: function () {}
        })
    }
});