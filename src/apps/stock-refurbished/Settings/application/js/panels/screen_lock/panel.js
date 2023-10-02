
/* global SettingsListener */
define('panels/screen_lock/screen_lock',['require','modules/settings_service'],function(require) {
  

  var SettingsService = require('modules/settings_service');

  var ScreenLock = function ctor_screenlock() {
    var _passcodeEditButton,
      _screenlockSelect,
      introContanier;
    var _screenlockPanel = null;
    var _settings = {
        passcodeEnabled: false
      };
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

    function _showDialog(mode) {
      SettingsService.navigate('screenLock-passcode', {
        mode: mode,
        origin: '#screenLock'
      });
      window.dispatchEvent(new CustomEvent('lazyload', {
        detail: document.getElementById('screenLock-passcode')
      }));
    }

    function _changeSelect() {
      if (_screenlockSelect.value === 'true') {
        _showDialog('create');
      } else {
        _showDialog('confirm');
      }
      window.dispatchEvent(new CustomEvent('refresh'));
    }

    function _updateUI(enabled) {
      _updatePasscode(enabled);
      _screenlockSelect.value = enabled;
      introContanier.hidden = enabled;
      window.dispatchEvent(new CustomEvent('refresh'));
    }

    function _updatePasscode(enabled) {
      _settings.passcodeEnabled = enabled;
      _screenlockPanel.dataset.passcodeEnabled = enabled;
    }

    return {
      init: function sl_init(panel) {
        _screenlockPanel = panel;
        _passcodeEditButton = panel.querySelector('.passcode-edit');
        _screenlockSelect = panel.querySelector('#screen-lock select');
        introContanier =
          panel.querySelector('.more-description-container');
        _passcodeEditButton.onclick = () => {
          _showDialog('edit');
        };
      },

      onBeforeShow: function() {
        _screenlockSelect.addEventListener('change', _changeSelect);
        SettingsListener.observe('lockscreen.passcode-lock.enabled', false,
          _updateUI);

        _initSoftkey();
      },

      onBeforeHide: function() {
        _screenlockSelect.removeEventListener('change', _changeSelect);
        SettingsListener.unobserve('lockscreen.passcode-lock.enabled',
          _updateUI);

      }
    };
  };
  return ScreenLock;
});

define('panels/screen_lock/panel',['require','modules/settings_panel','panels/screen_lock/screen_lock'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var ScreenLock = require('panels/screen_lock/screen_lock');

  return function ctor_screenlock() {
    var screenLock = ScreenLock();

    return SettingsPanel({
      onInit: function(panel) {
        screenLock.init(panel);
      },

      onBeforeShow: function() {
        screenLock.onBeforeShow();
      },

      onBeforeHide: function () {
        screenLock.onBeforeHide();
      }
    });
  };
});
