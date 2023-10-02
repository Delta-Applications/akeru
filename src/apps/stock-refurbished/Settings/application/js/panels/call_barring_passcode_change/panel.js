
/* export ChangePasscodeScreen */

define('panels/call_barring_passcode_change/call_barring_passcode_change',['require'],function(require) {
  

  var ChangePasscodeScreen = function() {

      /**
       * Makes a RIL request to change the passcode.
       * @param api Object mobileConnection to be used for the call.
       * @param data info related to the PIN code. In the form:
       * {
       *    'pin':    // current passcode
       *    'newPin': // new passcode
       * }
       */
      function _changeCallBarringPasscode(api, pinData) {
        return new Promise(function finished(resolve, reject) {
          var request = api.changeCallBarringPassword(pinData);
          request.onsuccess = function() {
            resolve();
          };
          request.onerror = function() {
            /* request.error = { name, message } */
            reject(request.error);
          };
        });
      }

    return {
      change: _changeCallBarringPasscode
    };
  };

  return ChangePasscodeScreen;
});

/* global DsdsSettings, SettingsSoftkey, ConfirmDialogHelper */

define('panels/call_barring_passcode_change/panel',['require','modules/settings_panel','modules/settings_service','panels/call_barring_passcode_change/call_barring_passcode_change'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var ChangePasscodeScreen =
    require('panels/call_barring_passcode_change/call_barring_passcode_change');

  return function ctor_call_barring_passcode_change() {
    var passcodeChange = ChangePasscodeScreen();
    var _settings = {
      pin: '',
      newPin: ''
    };
    var _passcodeBuffer = '';
    var elements = {};
    var _mobileConnection,
      _voiceServiceClassMask;
    var passCodeHeader = document.getElementById('change-passcode-header');
    var passCodeElement = document.getElementById('passcode-container');
    var progressElement = document.getElementById('updating-container');
    var changeFlag = true;
    let type = 'voice';

    function _getInputKey(evt) {
      var keyCode = _translateKey(evt.key);
      if (!(keyCode >= '0' && keyCode <= '9') && keyCode !== 'Backspace') {
        return;
      }

      if (evt.key == 'Backspace') {
        if (_passcodeBuffer.length > 0) {
          _passcodeBuffer = _passcodeBuffer.substring(0,
            _passcodeBuffer.length - 1);
          _initSoftkey();
          _updatePasscodeUI();
          evt.preventDefault();
          evt.stopPropagation();
        } else {
          SettingsService.navigate('call-cbSettings', {
            type: type,
            origin: '#call-barring-passcode-change'
          });
        }
      } else if (_passcodeBuffer.length <= 12) {
        _passcodeBuffer += keyCode;
        _updatePasscodeUI();
        if (_passcodeBuffer.length === 12) {
          _initSoftkey();
        }
        evt.preventDefault();
        evt.stopPropagation();
      }
    }

    function _enablePasscode() {
      var currentPasscode = _passcodeBuffer.substring(0,4);
      var passcode = _passcodeBuffer.substring(4, 8);
      var passcodeToConfirm = _passcodeBuffer.substring(8, 12);
      passCodeHeader.hidden = true;
      passCodeElement.hidden = true;
      progressElement.hidden = false;
      SettingsSoftkey.hide();

      if (passcode === passcodeToConfirm) {
        _settings.pin = currentPasscode;
        _settings.newPin = passcode;
        _changePassword();
      } else {
        _passcodeBuffer = currentPasscode;
        _updatePasscodeUI();
        progressElement.hidden = true;
        _showErrorDialog('callBarring-passcode-mismatch', '');
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
              type: type,
              origin: '#call-barring-passcode-change'
            });
          }
        }]
      };

      if (_passcodeBuffer.length === 12) {
        var item = {
          name: 'Change',
          l10nId: 'change',
          priority: 3,
          method: function() {
            if (changeFlag) {
              changeFlag = false;
              _enablePasscode();
            }
          }
        };
        params.items.push(item);
      };

      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    function _updatePasscodeUI() {
      for (var i = 0; i < 12; i++) {
        if (i < _passcodeBuffer.length) {
          elements.passcodeDigits[i].dataset.dot = true;
        } else {
          delete elements.passcodeDigits[i].dataset.dot;
        }
      }
      var len = _passcodeBuffer.length;
      if (len <= 4) {
        elements.currentPasscode.classList.add('focus');
        elements.createPasscode.classList.remove('focus');
        elements.confirmPasscode.classList.remove('focus');
      } else if (len > 4 && len <= 8) {
        elements.createPasscode.classList.add('focus');
        elements.currentPasscode.classList.remove('focus');
        elements.confirmPasscode.classList.remove('focus');
      } else if (len > 8 && len <= 12) {
        elements.confirmPasscode.classList.add('focus');
        elements.createPasscode.classList.remove('focus');
      }
    }

    function _resetScreen() {
      // Clear the stored passcode in the first
      _passcodeBuffer = '';
      _updatePasscodeUI();
    }

    /**
     * Triggers the passcode change screen
     */
    function _changePassword() {
      passcodeChange.change(_mobileConnection, _settings)
        .then(function success() {
          // exit
          changeFlag = true;
          passCodeHeader.hidden = false;
          passCodeElement.hidden = false;
          progressElement.hidden = true;
          SettingsService.navigate('call-cbSettings', {
            type: type,
            origin: '#call-barring-passcode-change'
          });
          showToast('callBarring-change-passcode-success');
        }, function(err) {
          // show error { name: "", message: "" }
          changeFlag = true;
          passCodeHeader.hidden = false;
          passCodeElement.hidden = false;
          progressElement.hidden = true;
          _showErrorDialog('callBarring-change-error', err.name);
        });
    }

    function _showErrorDialog(msgId, errorArgs) {
      var dialogConfig = {
        title: {
          id: 'callBarring-change-error-title',
          args: {}
        },
        body: {
          id: msgId,
          args: {
            error: errorArgs
          }
        },
        accept: {
          l10nId: 'ok',
          priority: 2,
          callback: function() {
            dialog.destroy();
            SettingsService.navigate('call-cbSettings', {
              type: type,
              origin: '#call-barring-passcode-change'
            });
          },
        }
      };

      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function _updateMobileConnectionStatus() {
      _mobileConnection = navigator.mozMobileConnections[
        DsdsSettings.getIccCardIndexForCallSettings()];
      _voiceServiceClassMask = _mobileConnection.ICC_SERVICE_CLASS_VOICE;
    }

    function _inputClick(evt) {
      elements.passcodeContainer.focus();
      evt.preventDefault();
    }

    return SettingsPanel({
      onInit: function cb_onInit(panel) {
        elements = {
          panel: panel,
          passcodeDigits: panel.querySelectorAll('.passcode-digit'),
          passcodeContainer:
            panel.querySelector('.call-barring-passcode-container'),
          currentPasscode:
            panel.querySelector('#call-barring-current-passcode'),
          createPasscode:
            panel.querySelector('#call-barring-create-passcode'),
          confirmPasscode:
            panel.querySelector('#call-barring-confirm-passcode')
        };

        // Add support to RTL
        if(window.document.dir === 'rtl') {
          var temp_passcodeDigits = elements.passcodeDigits;
          elements.passcodeDigits = new Array();

          var backward = 4;
          for (var i = 0; i < 12; i++) {
            backward--;
            elements.passcodeDigits[i] = temp_passcodeDigits[backward];

            if(backward === 0 || backward === 4){
              backward += 8;
            }
          }
        }
      },

      onShow: function() {
        _initSoftkey();
      },

      onHide: function() {
      },

      onBeforeShow: function cb_beforeShow(panel, options) {
        type = options.type;
        changeFlag = true;
        passCodeHeader.hidden = false;
        passCodeElement.hidden = false;
        progressElement.hidden = true;
        _updateMobileConnectionStatus();
        window.addEventListener('keydown', _getInputKey);
        // restore focus by touching the container around the pseudo-input.
        elements.passcodeContainer.addEventListener('click', _inputClick);
        elements.currentPasscode.classList.add('focus');
        NavigationMap.scrollToElement(elements.currentPasscode);
      },

      onBeforeHide: function cb_onHide() {
        _resetScreen();
        window.removeEventListener('keydown', _getInputKey);
        elements.passcodeContainer.removeEventListener('click', _inputClick);
      }
    });
  };
});
