/* global SettingsSoftkey */
define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function lyf_reliance_certificate_panel() {
    var _iframe;

    function _initIframe() {
      _iframe.focus();
      _iframe.contentDocument.addEventListener('keydown', evt => {
        switch (evt.key) {
          case 'Enter':
          case 'Backspace':
            SettingsService.navigate('about-legal');
            evt.preventDefault();
            break;
        }
      });
    }

    function _initSoftKey() {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Select',
          icon: 'ok',
          l10nId: '',
          priority: 2,
          method: function() {}
        }]
      };
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    return SettingsPanel({
      onInit: function(panel) {
        _iframe = document.getElementById('lyf-certificate');
      },

      onBeforeShow: function() {
        _initSoftKey();
        window.addEventListener('panelready', _initIframe);
      },

      onBeforeHide: function() {
        SettingsSoftkey.hide();
        window.removeEventListener('panelready', _initIframe);
      }
    });
  };
});
