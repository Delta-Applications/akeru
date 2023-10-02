/* global SettingsSoftkey */
define(['require','modules/settings_service','modules/settings_panel','shared/settings_listener'],function(require) {
  
  var SettingsService = require('modules/settings_service');
  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');

  return function ctor_call_cf_details_panel() {
    var header = null;
    var _callForwardingKey,
      _callForwardingNumber;
    var _selectEnable = false;
    var _saveEnable = false;
    var _callForwardingEnabled = false;
    var _skipUpdate = false;

    var _inputItem,
      _selectItem;

    var _savedValue = false;
    var type = 'voice';
    var settingsKey = {
      'call-cf-unconditionalSettings' : 'ril.cf.unconditional.enabled',
      'call-cf-mobileBusySettings' : 'ril.cf.mobilebusy.enabled',
      'call-cf-noReplySettings' : 'ril.cf.noreply.enabled',
      'call-cf-notReachableSettings' : 'ril.cf.notreachable.enabled'
    };

    var numbersKey = {
      'call-cf-unconditionalSettings' : 'ril.cf.unconditional.number',
      'call-cf-mobileBusySettings' : 'ril.cf.mobilebusy.number',
      'call-cf-noReplySettings' : 'ril.cf.noreply.number',
      'call-cf-notReachableSettings' : 'ril.cf.notreachable.number'
    };
    var settingsVtKey = {
      'call-cf-vt-unconditional-settings' : 'ril.cf.vt.unconditional.enabled',
      'call-cf-vt-mobile-busy-settings' : 'ril.cf.vt.mobilebusy.enabled',
      'call-cf-vt-no-reply-settings' : 'ril.cf.vt.noreply.enabled',
      'call-cf-vt-not-reachable-settings' : 'ril.cf.vt.notreachable.enabled'
    };

    var numbersVtKey = {
      'call-cf-vt-unconditional-settings' : 'ril.cf.vt.unconditional.number',
      'call-cf-vt-mobile-busy-settings' : 'ril.cf.vt.mobilebusy.number',
      'call-cf-vt-no-reply-settings' : 'ril.cf.vt.noreply.number',
      'call-cf-vt-not-reachable-settings' : 'ril.cf.vt.notreachable.number'
    };

    function _initSoftkey() {
      var params = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: []
      };

      if (_selectEnable) {
        params.items.push({
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        });
      } else {
        params.items.push({
          name: '',
          l10nId: '',
          priority: 2,
          method: function() {}
        });
      }

      if (_saveEnable) {
        params.items.push({
          name: 'Save',
          l10nId: 'save',
          priority: 3,
          method: function() {
            _setCallForwardingOption();
            switch (type) {
              case 'voice':
                SettingsService.navigate('call-cfSettings');
                break;
              case 'video':
                SettingsService.navigate('call-cfsettings-vt');
                break;
            }
          }
        });
      }
      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    function _updateUI() {
      var request = SettingsListener.getSettingsLock().get(_callForwardingKey);

      request.onsuccess = function() {
        _savedValue = request.result[_callForwardingKey];
        _callForwardingEnabled = request.result[_callForwardingKey];
        _selectItem.value = _callForwardingEnabled ? 'true' : 'false';
        _updateInputStatus();
      };

      request.onerror = function() {
        showToast('callForwardingSetError');
        switch (type) {
          case 'voice':
            SettingsService.navigate('call-cfSettings');
            break;
          case 'video':
            SettingsService.navigate('call-cfsettings-vt');
            break;
        }
      };
    }

    function _updateInputStatus() {
      let index = DsdsSettings.getIccCardIndexForCallSettings();
      let enabled = (_selectItem.value === 'true' || false);
      //[LIO-548] BDC zhangwp modify for Preconfig CF numbers. begin
/*
      SettingsListener.getSettingsLock().get(_callForwardingNumber)
        .then((result) => {
        let number = result[_callForwardingNumber];
        _inputItem.value = number || '';
*/
      let matchInfo = {
        "clientId": "0",
      };
      matchInfo.clientId = index;
      console.log('call_cf_details updateInputStatus: card: ' + index);

      let promises = [];
      promises.push(SettingsListener.getSettingsLock().get(_callForwardingNumber));
      promises.push(navigator.customization.getValueForCarrier(matchInfo, _callForwardingNumber));

      Promise.all(promises).then((result) => {
        let settingNumber = result[0][_callForwardingNumber];
        let customNumber = result[1];
        _inputItem.value = settingNumber || customNumber || '';
        let number = settingNumber || customNumber || '';
        console.log('call_cf_details updateInputStatus: settingNumber: ' + settingNumber + ' customNumber: ' + customNumber);
      //[LIO-548] BDC zhangwp modify for Preconfig CF numbers. end

        if (enabled) {
          _saveEnable = number ? true : false;
          _inputItem.parentNode.removeAttribute('aria-disabled');
          _inputItem.parentNode.classList.remove('non-focus');
        } else {
          _saveEnable = (_savedValue === enabled) ? false : true;
          _inputItem.parentNode.setAttribute('aria-disabled', 'true');
          _inputItem.parentNode.classList.add('non-focus');
        }
        _selectEnable = true;
        _initSoftkey();
        NavigationMap.refresh();
      })
      .catch((error) => console.log('Promise rejects due to ' + error));
    }

    function _setCallForwardingOption() {
      var enabled = (_selectItem.value === 'true' || false);
      var option = {};
      option[_callForwardingKey] = enabled;
      SettingsListener.getSettingsLock().set(option);
    }

    function _addFocus() {
      _inputItem.focus();
      _updateSaveSoftkey();
    }

    function _updateSelectSoftkey() {
      _selectEnable = true;
      if (_selectItem.value === 'true') {
        _saveEnable = _inputItem.value.length ? true : false;
      } else {
        _saveEnable = _savedValue;
      }
      _initSoftkey();
    }

    function _updateSaveSoftkey() {
      _selectEnable = false;
      if (_selectItem.value === 'true' && _inputItem.value.length) {
        _saveEnable = true;
      } else {
        _saveEnable = false;
      }
      _initSoftkey();
    }

    function _visibilityChange() {
      if (document.hidden) {
        _skipUpdate = true;
      }
    }

    function _updateCursorPos() {
      var cursorPosForInput = _inputItem.value.length;
      _inputItem.setSelectionRange(cursorPosForInput, cursorPosForInput);
    }

    return SettingsPanel({
      onInit: function(panel, options) {
        _selectItem = panel.querySelector('div select');
        _inputItem = panel.querySelector('li input');
      },

      onBeforeShow: function(panel, options) {
        header = panel.querySelector('.call-cf-subSettings-header');
        DeviceFeature.ready(() => {
          if (DeviceFeature.getValue('vilte') === 'true') {
            if (options && options.type) {
              type = options.type;
              switch (type) {
                case 'voice':
                  header.setAttribute('data-l10n-id', 'voice-call-header');
                  _callForwardingKey = settingsKey[panel.id];
                  _callForwardingNumber = numbersKey[panel.id];
                  break;
                case 'video':
                  header.setAttribute('data-l10n-id', 'video-call-header');
                  _callForwardingKey = settingsVtKey[panel.id];
                  _callForwardingNumber = numbersVtKey[panel.id];
                  break;
                default:
                  header.setAttribute('data-l10n-id', 'voice-call-header');
                  _callForwardingKey = settingsKey[panel.id];
                  _callForwardingNumber = numbersKey[panel.id];
                  break;
              }
            } else {
              header.setAttribute('data-l10n-id', 'voice-call-header');
              _callForwardingKey = settingsKey[panel.id];
              _callForwardingNumber = numbersKey[panel.id];
            }
          } else {
            header.setAttribute('data-l10n-id', 'callForwarding');
            _callForwardingKey = settingsKey[panel.id];
            _callForwardingNumber = numbersKey[panel.id];
          }
        });
        if (!_callForwardingKey) {
          return;
        }

        if (!_skipUpdate) {
          _initSoftkey();
          _updateUI();
        } else {
          _skipUpdate = false;
        }
        _selectItem.parentNode.parentNode.addEventListener('focus', _updateSelectSoftkey);
        _selectItem.addEventListener('change', _updateInputStatus);
        _inputItem.parentNode.addEventListener('focus', _addFocus);
        _inputItem.addEventListener('input', _updateSaveSoftkey);
        _inputItem.addEventListener('focus', _updateCursorPos);
        document.addEventListener('visibilitychange', _visibilityChange);
      },

      onBeforeHide: function() {
        _selectItem.parentNode.parentNode.removeEventListener('focus', _updateSelectSoftkey);
        _selectItem.removeEventListener('change', _updateInputStatus);
        _inputItem.parentNode.removeEventListener('focus', _addFocus);
        _inputItem.removeEventListener('input', _updateSaveSoftkey);
        _inputItem.removeEventListener('focus', _updateCursorPos);
        document.removeEventListener('visibilitychange', _visibilityChange);
      }
    });
  };
});
