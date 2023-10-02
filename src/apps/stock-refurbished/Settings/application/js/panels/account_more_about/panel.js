define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  let SettingsPanel = require('modules/settings_panel');
  let SettingsService = require('modules/settings_service');

  return function account_more_about_panel() {
    function _initSoftKey() {
      let softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'OK',
          l10nId: 'ok',
          priority: 2,
          method: function() {
            SettingsService.navigate('fxa');
          }
        }]
      };
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    return SettingsPanel({
      onInit: function(panel) {
      },

      onBeforeShow: function() {
        _initSoftKey();
      },

      onBeforeHide: function() {
      }
    });
  };
});
