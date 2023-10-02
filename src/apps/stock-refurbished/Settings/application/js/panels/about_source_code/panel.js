/* global SettingsSoftkey */
define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function about_source_code_panel() {
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
      _iframe.contentDocument.dir = window.document.dir;
    }

    return SettingsPanel({
      onInit: function() {
        _iframe = document.getElementById('obtain-sc');
      },

      onBeforeShow: function() {
        SettingsSoftkey.hide();
        window.addEventListener('panelready', _initIframe);
      },

      onBeforeHide: function() {
        window.removeEventListener('panelready', _initIframe);
      }
    });
  };
});
