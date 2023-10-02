
define('panels/wifi_manage_networks/panel',['require','shared/settings_listener','modules/settings_panel'],function(require) {
  
  var SettingsListener = require('shared/settings_listener');
  var SettingsPanel = require('modules/settings_panel');

  return function ctor_wifi_manage_networks_panel() {
    var _macAddress;
    var listElements = document.querySelectorAll('#wifi-manageNetworks li');

    function _initSoftkey() {
      var params = {
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

      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    return SettingsPanel({
      onInit: function(panel) {
        _macAddress = panel.querySelector('[data-name="deviceinfo.mac"]');
        // we would update this value all the time
        SettingsListener.observe('deviceinfo.mac', '', macAddress => {
          _macAddress.textContent = macAddress;
        });
      },

      onBeforeShow: function() {
        _initSoftkey();
        ListFocusHelper.addEventListener(listElements);
      },

      onBeforeHide: function() {
        ListFocusHelper.removeEventListener(listElements);
      }
    });
  };
});
