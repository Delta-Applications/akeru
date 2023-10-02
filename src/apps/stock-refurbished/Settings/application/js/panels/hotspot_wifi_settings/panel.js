
define('panels/hotspot_wifi_settings/panel',['require','modules/settings_panel','modules/settings_service'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function ctor_hotspot_wifi_settings() {
    var elements;
    var hotspotSettings;

    // validate all settings in the dialog box
    function _submit() {
      let fields = elements.allFields;

      // ensure SSID is set
      if (/^\s*$/.test(elements.tethering_ssid.value)) {
        _reset(); // Reset to original values if ssid is null.
      } else {
        let cset = {};
        let ignorePassword = (elements.securityTypeSelector.value === 'open');
        for (let i = 0; i < fields.length; i++) {
          let input = fields[i];
          let key = input.dataset.setting;

          switch (key) {
            case hotspotSettings.tetheringSSIDKey:
              cset[hotspotSettings.tetheringSSIDKey] = input.value;
              break;
            case hotspotSettings.tetheringPasswordKey:
              if (!ignorePassword) {
                cset[hotspotSettings.tetheringPasswordKey] = input.value;
              }
              break;
            case hotspotSettings.tetheringSecurityKey:
              cset[hotspotSettings.tetheringSecurityKey] = input.value;
              break;
          }
        }
        hotspotSettings.saveHotspotConfig(cset);
        SettingsService.navigate('hotspot');
      }
    }

    function _onKeydownHandler(evt) {
      switch (evt.key) {
        case 'ArrowUp':
        case 'ArrowDown':
          var input = document.querySelector('li.focus input');
          input && input.focus();
          if (input && (input.type !== 'checkbox')) {
            _updateSoftkey(true);
          } else {
            _updateSoftkey(false);
          }
          break;
        default:
      }
    }

    function _updateSoftkey(noSelect) {
      var isSaveEnabled = _isNotSubmitable();
      var params = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          method: function() {
            SettingsService.back();
          }
        }]
      };

      if (!noSelect) {
        params.items.push({
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        });
      }

      if (!isSaveEnabled) {
        params.items.push({
          name: 'Save',
          l10nId: 'save',
          priority: 3,
          method: function() {
            elements.submitBtn.click();
          }
        });
      } else {
        params.items.slice(2, 1);
      }

      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }


    function _initSecurityOptions() {
      var types = ['open', 'wpa-psk', 'wpa2-psk'];
      types.forEach((type) => {
        var option = document.createElement('option');
        option.value = type;
        option.setAttribute('data-l10n-id', 'hotspot-' + type);
        elements.securityTypeSelector.appendChild(option);
      });
    }

    function _initWifiSettingsDialog() {
      _reset();
    }

    function _updatePasswordItemVisibility(securityType) {
      elements.passwordItem.hidden = (securityType === 'open');

      var evt = new CustomEvent('refresh');
      window.dispatchEvent(evt);
    }

    function _reset() {
      var fields = elements.allFields;
      _updatePasswordItemVisibility(hotspotSettings.hotspotSecurity);
      for (var i = 0, len = fields.length; i < len; i++) {
        _configInput(fields[i]);
      }
    }

    function _isNotSubmitable() {
      var securityType = elements.securityTypeSelector.value;
      var ssidNameLength = elements.tethering_ssid.value.length;
      var pwdLength = elements.passwordInput.value.length;
      return (pwdLength < 8 ||
        pwdLength > 63 ||
        ssidNameLength === 0 ||
        ssidNameLength > 32) &&
        (securityType !== 'open');
    }

    function _configInput(input) {
      var key = input.dataset.setting;
      var setting;

      switch (key) {
        case hotspotSettings.tetheringSSIDKey:
          setting = hotspotSettings.hotspotSSID;
          break;
        case hotspotSettings.tetheringPasswordKey:
          setting = hotspotSettings.hotspotPassword;
          break;
        case hotspotSettings.tetheringSecurityKey:
          setting = hotspotSettings.hotspotSecurity;
          break;
      }

      input.value = setting || '';

      // dispatch the event manually for select element
      if (input.nodeName === 'SELECT') {
        var evt = document.createEvent('Event');
        evt.initEvent('change', true, true);
        input.dispatchEvent(evt);
      }
    }

    function _updateCursorPos() {
      var cursorPosForPassword = elements.passwordInput.value.length;
      var cursorPosForSsid = elements.tethering_ssid.value.length;
      elements.passwordInput.setSelectionRange(
        cursorPosForPassword, cursorPosForPassword);
      elements.tethering_ssid.setSelectionRange(
        cursorPosForSsid, cursorPosForSsid);
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          panel: panel,
          securityTypeSelector: panel.querySelector('.security-selector'),
          passwordItem: panel.querySelector('.password'),
          passwordInput: panel.querySelector('input[name="password"]'),
          submitBtn: panel.querySelector('button.save-hotspotSettings'),
          tethering_ssid: panel.querySelector(
            '[data-setting="tethering.wifi.ssid"]'),
          allFields: panel.querySelectorAll(
            '[data-setting]:not([data-ignore])')
        };

        _initSecurityOptions();

        elements.securityTypeSelector.addEventListener('change', (evt) => {
          _updatePasswordItemVisibility(evt.target.value);
        });

        elements.submitBtn.addEventListener('click', evt => {
          this.onSubmit();
        });
      },

      onBeforeShow: function(panel, options) {
        hotspotSettings = options.settings;
        _initWifiSettingsDialog();

        elements.passwordInput.oninput = _updateSoftkey;
        elements.tethering_ssid.oninput = _updateSoftkey;
        window.addEventListener('keydown', _onKeydownHandler);

        var inputLi = panel.querySelectorAll('li input');
        for (var i = inputLi.length - 1; i >= 0; i--) {
          inputLi[i].addEventListener('focus', _updateCursorPos);
        }
      },

      onBeforeHide: function() {
        window.removeEventListener('keydown', _onKeydownHandler);

        var inputLi =
          document.querySelectorAll('#hotspot-wifiSettings li input');
        for (var i = inputLi.length - 1; i >= 0; i--) {
          inputLi[i].removeEventListener('focus', _updateCursorPos);
        }
      },

      onSubmit: function() {
        if (_isNotSubmitable()) {
          return Promise.reject();
        } else {
          _submit();
          return Promise.resolve();
        }
      },

      onShow: function() {
        _updateSoftkey(true);
        elements.tethering_ssid.focus();
      }
    });
  };
});
