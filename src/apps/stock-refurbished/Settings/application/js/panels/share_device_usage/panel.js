define(['require','shared/toaster','modules/settings_panel','modules/settings_service','shared/settings_listener'],function(require) {
  
  var Toaster = require('shared/toaster');
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var SettingsListener = require('shared/settings_listener');

  return function share_device_usage_panel() {
    var LYF_PRIVACY_KEY = 'jio.phone.monitor.enabled';
    var _settings = window.navigator.mozSettings;
    var _currentSettingsValue = false;
    var _lyfPrivacySwitchOn;
    var _lyfPrivacySwitchOff;
    var lyfPrivacyDesc;

    function _initSoftKey() {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          method: function() {
            SettingsService.navigate('about-lyf-privacy');
          }
        }, {
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        }]
      };
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    function _updateLyfPrivacyInfo(enabled) {
      _currentSettingsValue = enabled;
      _lyfPrivacySwitchOn.checked = enabled;
      _lyfPrivacySwitchOff.checked = !enabled;
      lyfPrivacyDesc.setAttribute('data-l10n-id', enabled ? 'on' : 'off');
    }

    function _setLyfPrivacy(evt) {
      var enabled = (evt.target.value === 'true') || false;
      if (_currentSettingsValue === enabled) {
        NavigationMap.navigateBack();
        return;
      }

      var lock = _settings.createLock();
      var option = {};
      option[LYF_PRIVACY_KEY] = enabled;
      var req = lock.set(option);

      req.onsuccess = () => {
        var toast = {
          messageL10nId: 'changessaved',
          latency: 2000,
          useTransition: true
        };
        Toaster.showToast(toast);
        SettingsService.navigate('about-lyf-privacy');
      };

      _lyfPrivacySwitchOn.checked = enabled;
      _lyfPrivacySwitchOff.checked = !enabled;
      lyfPrivacyDesc.setAttribute('data-l10n-id', enabled ? 'on' : 'off');
    }

    return SettingsPanel({
      onInit: function(panel) {
        _lyfPrivacySwitchOn =
          document.getElementById('lyf-privacy-switch-on');
        _lyfPrivacySwitchOff =
          document.getElementById('lyf-privacy-switch-off');
        lyfPrivacyDesc = document.getElementById('lyf-privacy-desc');
      },

      onBeforeShow: function() {
        _initSoftKey();
        _lyfPrivacySwitchOn.addEventListener('click', _setLyfPrivacy);
        _lyfPrivacySwitchOff.addEventListener('click', _setLyfPrivacy);
        SettingsListener.observe(LYF_PRIVACY_KEY, true, _updateLyfPrivacyInfo);
      },

      onBeforeHide: function() {
        SettingsSoftkey.hide();
        _lyfPrivacySwitchOn.removeEventListener('click', _setLyfPrivacy);
        _lyfPrivacySwitchOff.removeEventListener('click', _setLyfPrivacy);
        SettingsListener.unobserve(LYF_PRIVACY_KEY, _updateLyfPrivacyInfo);
      }
    });
  };
});
