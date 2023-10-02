/* global DsdsSettings, SettingsSoftkey */

define(['require','modules/settings_service','modules/settings_panel'],function(require) {
  
  var SettingsService = require('modules/settings_service');
  var SettingsPanel = require('modules/settings_panel');

  return function call_barring_passcode() {
    const PIN_SIZE = 4;
    var _options = {};
    var _mobileConnection;
    var container;
    var _passcodeDigits,
      _passcodeBuffer;

    var _cbAction = {
      CALL_BARRING_BAOC: 0, // BAOC: Barring All Outgoing Calls
      CALL_BARRING_BOIC: 1, // BOIC: Barring Outgoing International Calls
      CALL_BARRING_BOICexHC: 2, // BOICexHC: Barring Outgoing InternationalCalls Except  to Home Country
      CALL_BARRING_BAIC: 3, // BAIC: Barring All Incoming Calls
      CALL_BARRING_BAICr: 4 // BAICr: Barring All Incoming Calls in Roaming
    };

    var _cbServiceMapper = {
      'baoc': _cbAction.CALL_BARRING_BAOC,
      'boic': _cbAction.CALL_BARRING_BOIC,
      'boicExhc': _cbAction.CALL_BARRING_BOICexHC,
      'baic': _cbAction.CALL_BARRING_BAIC,
      'baicR': _cbAction.CALL_BARRING_BAICr
    };
    let type = 'voice';

    function _updateMobileConnection() {
      _mobileConnection = window.navigator.mozMobileConnections[
        DsdsSettings.getIccCardIndexForCallSettings()
      ];
    }

    function _getInputKey(evt) {
      var keyCode = _translateKey(evt.key);
      if (!(keyCode >= '0' && keyCode <= '9') && keyCode !== 'Backspace') {
        return;
      }

      if (evt.key == 'Backspace') {
        evt.preventDefault();
        if (_passcodeBuffer.length > 0) {
          _passcodeBuffer = _passcodeBuffer.substring(0,
            _passcodeBuffer.length - 1);
        } else {
          SettingsService.navigate('call-cbSettings', {
            type: type
          });
        }
      } else if (_passcodeBuffer.length < PIN_SIZE) {
        _passcodeBuffer += keyCode;
      }

      _updateUI();
    }

    // Make the digits page show correct dot status
    function _updateUI() {
      for (var i = 0; i < PIN_SIZE; i++) {
        if (i < _passcodeBuffer.length) {
          _passcodeDigits[i].dataset.dot = true;
        } else {
          delete _passcodeDigits[i].dataset.dot;
        }
      }

      if (_passcodeBuffer.length === PIN_SIZE) {
        _setCallBarring(_passcodeBuffer);
      }
    }

    function _initSoftkey() {
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
            SettingsService.navigate('call-cbSettings', {
              type: type
            });
          }
        }]
      };

      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    function _setCallBarring(passcode) {
      let options = {
        'program': _cbServiceMapper[_options.settingValue],
        'enabled': (_options.enabled === 'true' || _options.enabled === true),
        'password': passcode,
        'serviceClass': _mobileConnection.ICC_SERVICE_CLASS_VOICE
      };
      // Send the request
      let request = _mobileConnection.setCallBarringOption(options);
      request.onsuccess = function() {
        showToast('changessaved');
        SettingsService.navigate('call-cbSettings', {
          type: type
        });
      };

      request.onerror = function() {
        let reason = request.error.name;
        let enabled = options.enabled;
        if (reason === 'IncorrectPassword') {
          if (enabled) {
            showToast('callBarring-enable-options-incorrect-password');
          } else {
            showToast('callBarring-disable-options-incorrect-password');
          }
        } else {
          if (enabled) {
            showToast('callBarring-enable-item-error');
          } else {
            showToast('callBarring-disable-item-error');
          }
        }
        SettingsService.navigate('call-cbSettings', {
          type: type
        });
      };
    }

    function _resetPasscode() {
      _passcodeBuffer = '';
      _updateUI();
    }

    return SettingsPanel({
      onInit: function cb_onInit(panel, options) {
        container = panel.querySelector('.passcode-container');
        _passcodeDigits = panel.querySelectorAll('.passcode-digit');
        _passcodeBuffer = '';

        // Add support to RTL
        if(window.document.dir === 'rtl') {
          var temp_passcodeDigits = _passcodeDigits;
          _passcodeDigits = new Array();

          var backward = 4;
          for (var i = 0; i < PIN_SIZE; i++) {
            backward--;
            _passcodeDigits[i] = temp_passcodeDigits[backward];
          }
        }

        container.addEventListener('click', (evt) => {
          container.focus();
          evt.preventDefault();
        });
      },

      onShow: function() {
        _initSoftkey();
      },

      onHide: function() {
      },

      onBeforeShow: function(panel, options) {
        // Save the args form the previous page
        _resetPasscode();
        _options = options;
        type = options.type;
        _updateMobileConnection();
        window.addEventListener('keydown', _getInputKey);
        container.classList.add('focus');
      },

      onBeforeHide: function() {
        _resetPasscode();
        window.removeEventListener('keydown', _getInputKey);
      }
    });
  };
});
