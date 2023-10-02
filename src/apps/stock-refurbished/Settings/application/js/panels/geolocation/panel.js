define(['require','modules/settings_panel','modules/settings_service','shared/settings_listener'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var SettingsListener = require('shared/settings_listener');

  return function geolocation_settings_panel() {
    var GEOLOCATION_KEY = 'geolocation.enabled';
    var _settings = window.navigator.mozSettings;
    var _currentSettingsValue = false;
    var _geoSwitchOn,
      _geoSwitchOff;

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
            SettingsService.navigate('root');
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

    function _updateGeoInfo(enabled) {
      _currentSettingsValue = enabled;
      _geoSwitchOn.checked = enabled;
      _geoSwitchOff.checked = !enabled;
    }

    function _setGeo(evt) {
      var enabled = (evt.target.value === 'true') || false;
      if (_currentSettingsValue === enabled) {
        NavigationMap.navigateBack();
        return;
      }

      var lock = _settings.createLock();
      var option = {};
      option[GEOLOCATION_KEY] = enabled;
      var req = lock.set(option);

      req.onsuccess = () => {
        showToast('changessaved');
        SettingsService.navigate('root');
      };

      _geoSwitchOn.checked = enabled;
      _geoSwitchOff.checked = !enabled;
    }

    return SettingsPanel({
      onInit: function(panel) {
        _geoSwitchOn =
          document.getElementById('geolocation_switch_on');
        _geoSwitchOff =
          document.getElementById('geolocation_switch_off');

        var geoDsc = document.getElementById('geolcation_description');
        DeviceFeature.ready(() => {
          if (DeviceFeature.getValue('lowMemory') !== 'true') {
            geoDsc.setAttribute('data-l10n-id',
              'geolocation-privacy-description-withoutwifi-1');
          } else {
            geoDsc.setAttribute('data-l10n-id',
              'geolocation-privacy-description-1');
          }
        });
      },

      onBeforeShow: function() {
        _initSoftKey();

        _geoSwitchOn.addEventListener('click', _setGeo);

        _geoSwitchOff.addEventListener('click', _setGeo);

        SettingsListener.observe(GEOLOCATION_KEY, false, _updateGeoInfo);
      },

      onShow: function (panel, options) {
        if (!options.isVisibilityChange) {
          SettingsDBCache.getSettings((result) => {
            let geoEnabled = result[GEOLOCATION_KEY];
            let liItem = panel.querySelectorAll('li');
            if (geoEnabled) {
              requestFocus(panel, liItem[0]);
            } else {
              requestFocus(panel, liItem[1]);
            }
          });
        }
      },

      onBeforeHide: function() {
        _geoSwitchOn.removeEventListener('click', _setGeo);

        _geoSwitchOff.removeEventListener('click', _setGeo);

        SettingsListener.unobserve(GEOLOCATION_KEY, _updateGeoInfo);
      }
    });
  };
});
