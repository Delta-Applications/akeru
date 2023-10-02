
define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function ctor_call_cw_settings_panel() {
    let _mobileConnections = window.navigator.mozMobileConnections;
    let _callWaitingQueryStatus = false;
    let _mobileConnection = null;
    let menuItem = null;

    function cs_updateCallWaitingItemState(callback) {
      //var menuItem = document.getElementById('menuItem-call-waiting');
      if (!menuItem || menuItem.hidden) {
        if (typeof callback === 'function') {
          callback(null);
        }
        return;
      }

      cs_enableTapOnCallWaitingItem(false);

      //_taskScheduler.enqueue('CALL_WAITING', function(done) {
        var select = menuItem.querySelector('select');

        var getCWEnabled = _mobileConnection.getCallWaitingOption();
        getCWEnabled.onsuccess = function cs_getCWEnabledSuccess() {
          var enabled = getCWEnabled.result;
          select.value = enabled;
          menuItem.dataset.state = enabled ? 'on' : 'off';
          cs_enableTapOnCallWaitingItem(true);

          if (callback) {
            callback(null);
          }
          //done();
        };
        getCWEnabled.onerror = function cs_getCWEnabledError() {
          menuItem.dataset.state = 'unknown';
          if (callback) {
            callback(null);
          }
         // done();
        };
      //});
    }

    /**
     * @HACK To Enable the "Call Waiting" select option
     */
    function _enableCallWaitingSelect(evt) {
      if (evt.key === 'Enter') {
        var select = document.querySelector('li.focus select');
        if (select && _callWaitingQueryStatus) {
          select.hidden = false;
          select.focus();
        }
        select.hidden = true;
      }
    }

    function cs_initCallWaiting() {
      var menuItem = document.getElementById('menuItem-call-waiting');
      menuItem.addEventListener('keydown', _enableCallWaitingSelect);

      // Bind call waiting setting to the input
      var select =
        document.querySelector('#menuItem-call-waiting select');
      select.addEventListener('change', function cs_cwInputChanged(event) {
        var handleSetCallWaiting = function cs_handleSetCallWaiting() {
          cs_updateCallWaitingItemState(function() {
            cs_enableTapOnCallWaitingItem(true);
          });
        };
        cs_enableTapOnCallWaitingItem(false);
        var enabled = (select.value === 'true') || false;
        var req = _mobileConnection.setCallWaitingOption(enabled);
        req.onerror = handleSetCallWaiting;
        req.onsuccess = () => {
          cs_updateCallWaitingItemState(function() {
            cs_enableTapOnCallWaitingItem(true);
            showToast('changessaved');
          });
        };
      });
    }

    /**
     * Enable/Disable call waiting settings page
     */
    function cs_enableTapOnCallWaitingItem(enable) {
      //var menuItem = document.getElementById('menuItem-call-waiting');
      var select = menuItem.querySelector('select');
      var descText = menuItem.querySelector('small');
      // update call waiting query status
      _callWaitingQueryStatus = enable;

      // update the description
      function getSelectValue() {
        var enabled = select.value === 'true';
        var status = '';
        if (select) {
          status = enabled ? 'enabled' : 'disabled';
        }
        return status;
      }

      if (descText && !enable) {
        descText.setAttribute('data-l10n-id', 'callSettingsQuery');
      } else {
        // Clear the data-l10n-id information
        descText.innerHTML = '';
        descText.setAttribute('data-l10n-id', getSelectValue());
      }

      if (enable) {
        menuItem.removeAttribute('aria-disabled');
        menuItem.classList.remove('none-select');
        _initSoftkey();
      } else {
        menuItem.setAttribute('aria-disabled', 'true');
        menuItem.classList.add('none-select');
        SettingsSoftkey.hide();
      }
    }

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

    return SettingsPanel({
      onInit: function(panel) {
        menuItem = document.getElementById('menuItem-call-waiting');
        cs_initCallWaiting();
      },

      onBeforeShow: function(panel) {
        _mobileConnection = _mobileConnections[
          DsdsSettings.getIccCardIndexForCallSettings()
        ];
        if (!_mobileConnection) {
          return;
        }
        cs_updateCallWaitingItemState();
      }
    });
  };
});
