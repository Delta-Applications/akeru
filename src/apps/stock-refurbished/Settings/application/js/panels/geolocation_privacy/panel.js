define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function geolocation_privacy_panel() {
    var _iframe;

    function _initIframe() {
      _iframe.focus();
      _iframe.contentDocument.addEventListener('keydown', evt => {
        switch (evt.key) {
          case 'Enter':
          case 'Backspace':
            SettingsService.navigate('geolocation-more-about');
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
          name: 'Ok',
          l10nId: 'ok',
          priority: 2,
          method: function() {}
        }]
      };
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    return SettingsPanel({
      onInit: function(panel) {
        _iframe = document.getElementById('geo-privacy');
      },

      onBeforeShow: function() {
        _initSoftKey();
        window.addEventListener('panelready', _initIframe);

        if (document.body.classList.contains('large-text')) {
          _iframe.contentDocument.body.classList.add('large-text');
        } else {
          _iframe.contentDocument.body.classList.remove('large-text');
        }
      },

      onBeforeHide: function() {
        window.removeEventListener('panelready', _initIframe);
      }
    });
  };
});
