
/**
 * WifiWps is a module that stores some functions that would be called
 * when doing wps related operations
 *
 * @module wifi_wps/wifi_wps
 */
define('panels/wifi_wps/wifi_wps',['require'],function(require) {
  

  var WifiWps = function() {
    return {
      /**
       * To make sure wps pin is valid or not
       * @param {String} pin - value of pin
       * @returns {Boolean}
       */
      _isValidWpsPin: function(pin) {
        if (pin.match(/[^0-9]+/)) {
          return false;
        }
        if (pin.length === 4) {
          return true;
        }
        if (pin.length !== 8) {
          return false;
        }
        var num = pin - 0;
        return this._pinChecksum(Math.floor(num / 10)) === (num % 10);
      },
      /**
       * This is an inner function that we can use it to get
       * pin's checksum
       *
       * @param {Number} pin - value of pin
       * @returns {Number}
       */
      _pinChecksum: function(pin) {
        var accum = 0;
        while (pin > 0) {
          accum += 3 * (pin % 10);
          pin = Math.floor(pin / 10);
          accum += pin % 10;
          pin = Math.floor(pin / 10);
        }
        return (10 - accum % 10) % 10;
      }
    };
  };

  return WifiWps;
});

define('panels/wifi_wps/panel',['require','modules/dialog_panel','panels/wifi_wps/wifi_wps'],function(require) {
  
  var DialogPanel = require('modules/dialog_panel');
  var WifiWps = require('panels/wifi_wps/wifi_wps');

  return function ctor_wpsWifi() {
    var wifiWps = WifiWps();
    var elements = {};

    var _initpanelready = function(e) {
      var detail = {
        current: '#' + elements.panel.id,
        previous: '#wifi'
      };
      if (e) {
        detail = {
          current: '#' + elements.panel.id,
          needFocused: e.target.parentNode.parentNode
        };
      }
      var evt = new CustomEvent('panelready', {
        detail: detail
      });
      window.dispatchEvent(evt);
    };

    function _initSoftKey() {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        }, {
          name: 'Connect',
          l10nId: 'device-option-connect',
          priority: 3,
          method: function() {
            elements.submitWpsButton.click();
          }
        }]
      };
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    return DialogPanel({
      onInit: function(panel) {
        elements = {
          panel: panel,
          submitWpsButton: panel.querySelector('button[type=submit]'),
          buttonConnection: panel.querySelector('.button-connect-item'),
          apSelectionArea: panel.querySelector('.wifi-wps-pin-aps'),
          apSelect: panel.querySelector('.wifi-wps-pin-aps select'),
          pinItem: panel.querySelector('.wifi-wps-pin-area'),
          pinDesc: panel.querySelector('.wifi-wps-pin-area p'),
          pinInput: panel.querySelector('.wifi-wps-pin-area input'),
          wpsMethodRadios: panel.querySelectorAll('input[type=radio]')
        };

        // Check validWpsPin each time when typing
        elements.pinInput.oninput = function() {
          elements.submitWpsButton.disabled = !wifiWps._isValidWpsPin(elements.pinInput.value);
        };

        for (var i = 0; i < elements.wpsMethodRadios.length; i++) {
          elements.wpsMethodRadios[i].onchange = this._onWpsMethodChange;
        }
        this.keydownHandler = this._keydownHandler.bind(this);
      },
      onBeforeShow: function(panel, options) {
        this._cleanupApList();
        options.wpsAvailableNetworks().then((networks) => {
          this._updateApList(networks);
        });
        this._onWpsMethodChange();
        document.addEventListener('visibilitychange', this._dispatchDialogShowEvent);
        this._dispatchDialogShowEvent();
        window.addEventListener('keydown', this.keydownHandler);
      },
      onShow: function() {
        elements.buttonConnection.focus();
      },
      onBeforeHide: function() {
        var evt = new CustomEvent('dialogpanelhide', {
          detail: {
            dialogpanel: '#' + elements.panel.id
          }
        });
        window.dispatchEvent(evt);
        window.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('visibilitychange', this._dispatchDialogShowEvent);
      },
      _keydownHandler: function(e) {
        switch (e.key) {
          case 'Backspace':
            elements.panel.querySelector('button[type="reset"]').click();
            break;
          case 'Enter':
            var el = elements.panel.querySelector('li.focus > label');
            el && el.click();
            break;
        }
      },
      onSubmit: function() {
        var selectedAp = elements.apSelect.options[
          elements.apSelect.selectedIndex].value;
        var selectedMethod = elements.panel.querySelector(
          'input[type=\'radio\']:checked').value;
        var pin = elements.pinInput.value;

        return Promise.resolve({
          selectedAp: selectedAp,
          selectedMethod: selectedMethod,
          pin: pin
        });
      },
      _cleanupApList: function() {
        var apSelect = elements.apSelect;
        while (apSelect.hasChildNodes()) {
          apSelect.removeChild(apSelect.firstChild);
        }
      },
      _updateApList: function(wpsAvailableNetworks) {
        // Add the first option
        var option = document.createElement('option');
        option.setAttribute('data-l10n-id', 'wpsAnyAp');
        option.value = 'any';
        elements.apSelect.appendChild(option);

        // Add the other networks
        for (var i = 0; i < wpsAvailableNetworks.length; i++) {
          option = document.createElement('option');
          option.textContent = wpsAvailableNetworks[i].ssid;
          option.value = wpsAvailableNetworks[i].bssid;
          elements.apSelect.appendChild(option);
        }
      },
      _onWpsMethodChange: function(e) {
        var method = elements.panel.querySelector(
          'input[type=\'radio\']:checked').value;

        if (method === 'apPin') {
          elements.submitWpsButton.disabled = !wifiWps._isValidWpsPin(elements.pinInput.value);
          elements.pinItem.hidden = false;
        } else {
          elements.submitWpsButton.disabled = false;
          elements.pinItem.hidden = true;
        }
        elements.apSelectionArea.hidden = method === 'pbc';
        _initpanelready(e);
      },

      _dispatchDialogShowEvent: function() {
        if (!document.hidden) {
          _initSoftKey();
          var evt = new CustomEvent('dialogpanelshow', {
            detail: {
              dialogpanel: '#' + elements.panel.id
            }
          });
          window.dispatchEvent(evt);
        }
      }
    });
  };
});
