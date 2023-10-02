define(['require','modules/settings_panel','shared/settings_listener'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');

  return function ctor_wifi_advanced_settings() {
    return SettingsPanel({
      onInit: function(panel) {
        var publicNetworksNotices;
        var _settings = navigator.mozSettings;
        var key = 'wifi.notification';
        var lock;

        publicNetworksNotices = panel.querySelector('#pnn-select');
        publicNetworksNotices.onchange = function() {
          var obj = {};
          lock = _settings.createLock();
          obj[key] = (publicNetworksNotices.value === 'true') ? true : false;
          lock.set(obj);
        };

        SettingsListener.observe(key, true, (enabled) => {
          publicNetworksNotices.value = enabled ? 'true' : 'false';
        });

        this.params = {
          menuClassName: 'menu-button',
          header: {
            l10nId: 'message'
          },
          items: [{
            name: 'Select',
            l10nId: 'select',
            priority: 2,
            method: function() {}
          }]
        };
      },

      onBeforeShow: function() {
        SettingsSoftkey.init(this.params);
        SettingsSoftkey.show();
      }
    });
  };
});
