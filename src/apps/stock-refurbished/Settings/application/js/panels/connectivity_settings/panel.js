define(['require','modules/settings_panel','shared/settings_listener','shared/airplane_mode_helper'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');
  var AirplaneModeHelper = require('shared/airplane_mode_helper');
  var _currentSettingsValue = false;

  return function ctor_connectivity_settings() {
    var elements = {};
    var airplaneStatus, airplaneEnabled;
    let listElements = null;

    function _initSoftKey() {
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

    function _keyEventHandler(evt) {
      switch (evt.key) {
        case 'Enter':
          var select = document.querySelector('li.focus select');
          select && select.focus();
          break;
        default:
      }
    }

    function _updateItemState(airplaneEnabled) {
      let validCardCount = 0;
      let _iccManager = window.navigator.mozIccManager;
      let _mobileConnections = window.navigator.mozMobileConnections;
      let isReady = false;
      if (_mobileConnections) {
        [].forEach.call(_mobileConnections, (simcard, cardIndex) => {
          iccId = simcard.iccId;
          var icc = _iccManager.getIccById(iccId);
          let cardState = icc ? icc.cardState : null;
          isReady = (cardState === 'ready' || isReady);
          if (icc !== null) {
            validCardCount++;
          }
        });
      }

      if (_mobileConnections) {
        var disabled = (validCardCount === 0 || false);
        if (!disabled && isReady) {
          elements.networkContainer.setAttribute('aria-disabled',
            airplaneEnabled);
          if (airplaneEnabled) {
            elements.networkHrefItem.removeAttribute('href');
            elements.networkContainer.classList.add('none-select');
          } else {
            elements.networkHrefItem.setAttribute('href', '#carrier');
            elements.networkContainer.classList.remove('none-select');
          }
        } else {
          elements.networkContainer.setAttribute('aria-disabled', true);
          elements.networkHrefItem.removeAttribute('href');
          elements.networkContainer.classList.add('none-select');
        }
      }
    }

    function _onAPMStateChange(status) {
      if (status === 'enabled' || status === 'disabled') {
        elements.airplaneMenuItem.classList.remove('disabled');
      } else {
        elements.airplaneMenuItem.classList.add('disabled');
      }
    }

    function _onChangeAirplaneModeMenu(status) {
      var enabled =
        (status === 'enabled' || status === 'enabling') ? true : false;
      elements.airplaneMenuItem.setAttribute('aria-disabled', enabled);
      _updateItemState(enabled);

      if (status === 'enabled' || status === 'disabled') {
        elements.airplaneMenuItem.removeAttribute('aria-disabled');
      } else {
        elements.airplaneMenuItem.setAttribute('aria-disabled', true);
      }
    }

    function _setAPMStatus(evt) {
      var enabled = (evt.target.value === 'true') || false;
      if (_currentSettingsValue === enabled) {
        return;
      }
      showToast('changessaved');
      window.dispatchEvent(new CustomEvent('airplaneModeChange', {
        detail: {
          status: enabled ? 'enabling': 'disabling'
        }
      }));
    }

    function _updateWifiMenu(value) {
      var wifiSettings = document.getElementById('connectivity-wifi-menu');
      var hrefItem = wifiSettings.querySelector('a');
      var current = wifiSettings.hidden;
      switch (value) {
        case SHOW:
          wifiSettings.hidden = false;
          hrefItem.setAttribute('href', '#wifi');
          wifiSettings.removeAttribute('aria-disabled');
          break;
        case HIDE:
          wifiSettings.classList.remove('focus');
          wifiSettings.hidden = true;
          break;
        case GRAYOUT:
          wifiSettings.hidden = false;
          hrefItem.removeAttribute('href');
          wifiSettings.setAttribute('aria-disabled', true);
          wifiSettings.classList.add('none-select');
          break;
      }
      if (wifiSettings.hidden !== current) {
        NavigationMap.refresh();
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          WifiSmallItem: panel.querySelector('#wifi-desc'),
          airplaneMenuItem: panel.querySelector('.airplane_mode_switch'),
          airplaneItem: panel.querySelector('.airplaneMode-select'),
          networkContainer: panel.querySelector('#data-connectivity'),
          networkHrefItem: panel.querySelector('#menuItem-mobileNetworkAndData')
        };

        listElements = panel.querySelectorAll('li');
        elements.airplaneItem.hidden = true;
        AirplaneModeHelper.addEventListener('statechange', _onAPMStateChange);

        window.addEventListener('panelready', e => {
          switch (e.detail.current) {
            case '#wifi':
            case '#carrier':
              // If other APP enter "Settings configure activity" page,
              // we should back to "connectivity-settings" instead of "root" page.
              if (NavigationMap._optionsShow === false) {
                var header = document.querySelectorAll('.current [data-href]');
                header[0].setAttribute('data-href',
                  '#connectivity-settings');
              }
              break;
            default:
          }
        });

        DeviceFeature.ready(() => {
          if ((DeviceFeature.getValue('wifi') === 'true')) {
            SettingsListener.observe('wifi.settings.ui', SHOW,
              _updateWifiMenu, {forceClose: true});
          }
        });

        elements.airplaneMenuItem.hidden = false;
        elements.networkContainer.hidden =
          ActivityHandler._currentActivity.source.data.hideDataNetwork || false;

        SettingsListener.observe('wifi.enabled', true, enabled => {
          var value = enabled ? 'on' : 'off';
          elements.WifiSmallItem.setAttribute('data-l10n-id', value);
        }, {forceClose: true});

        SettingsListener.observe('airplaneMode.enabled', false, value => {
          elements.airplaneItem.hidden = false;
          _currentSettingsValue = value;
        }, {forceClose: true});

        SettingsListener.observe('airplaneMode.status', false,
          _onChangeAirplaneModeMenu.bind(this), {forceClose: true});

        window.addEventListener('airplaneModeChange', e => {
          _onChangeAirplaneModeMenu(e.detail.status);
        });

        elements.airplaneItem.addEventListener('blur', _setAPMStatus);
      },

      onBeforeShow: function(panel) {
        ListFocusHelper.addEventListener(listElements);
        _initSoftKey();
        ListFocusHelper.updateSoftkey(panel);
        window.addEventListener('keydown', _keyEventHandler);
      },

      onBeforeHide: function() {
        ListFocusHelper.removeEventListener(listElements);
        window.removeEventListener('keydown', _keyEventHandler);
      }
    });
  };
});
