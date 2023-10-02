
/**
 * WifiWps is a module that can help you manipulate wps related stuffs easily.
 *
 * @module WifiWps
 */
define('panels/wifi/wifi_wps',['require','shared/wifi_helper'],function(require) {
  

  var WifiHelper = require('shared/wifi_helper');
  var wifiManager = WifiHelper.getWifiManager();
  var _ = navigator.mozL10n.get;

  var WifiWps = function() {
    var wifiWps = {
      dialog: null,
      /**
       * A flag to make sure whether we are manipulating wps.
       *
       * @type {Boolean}
       * @default false
       */
      inProgress: false,
      /**
       * An array used to keep registered listeners for statusReset event.
       *
       * @type {Array}
       * @default []
       */
      _statusResetEventListeners: [],
      /**
       * A method to trigger all registered handlers
       *
       * @type {Function}
       */
      statusReset: function() {
        this._statusResetEventListeners.forEach(function(handler) {
          handler();
        });
      },
      /**
       * Put necessary information about wps (ssid, method, pin) to connect
       * to specific wps.
       *
       * @param {Object} options
       */
      connect: function(options) {
        var self = this;
        var req;

        var onSuccess = options.onSuccess || function() {};
        var onError = options.onError || function() {};

        var bssid = options.selectedAp;
        var method = options.selectedMethod;
        var pin = options.pin;

        if (method === 'pbc') {
          req = wifiManager.wps({
            method: 'pbc'
          });
        } else if (method === 'myPin') {
          req = wifiManager.wps({
            method: 'pin',
            bssid: bssid
          });
        } else {
          req = wifiManager.wps({
            method: 'pin',
            bssid: bssid,
            pin: pin
          });
        }

        req.onsuccess = function() {
          if (method === 'myPin') {
            self.showAlertDialog('wpsPinInput', { pin: req.result });
          }
          self.inProgress = true;
          onSuccess();
        };

        req.onerror = function() {
          onError(req.error);
        };
      },
      showAlertDialog: function(l10n, args) {
        var self = this;
        var dialogConfig = {
          title: {id: 'settings', args: {}},
          body: {id: l10n, args: args},
          accept: {
            l10nId: 'ok',
            priority: 2,
            callback: function() {
              self.dialog.destroy();
            },
          }
        };
        self.dialog = new ConfirmDialogHelper(dialogConfig);
        self.dialog.show(document.getElementById('app-confirmation-dialog'));
      },
      /**
       * Cancel current wps operation and will call your onSuccess / onError
       * callback when operation is done.
       *
       * @memberOf WifiWps
       * @param {Object} options
       */
      cancel: function(options) {
        var self = this;
        var onError = options.onError || function() {};
        var onSuccess = options.onSuccess || function() {};

        var req = wifiManager.wps({
          method: 'cancel'
        });

        req.onsuccess = function() {
          self.inProgress = false;
          self.statusReset();
          onSuccess();
        };

        req.onerror = function() {
          onError(req.error);
        };
      },
      /**
       * You can add your listeners when `statusreset` event is triggered.
       *
       * @memberOf WifiWps
       * @param {String} eventName
       * @param {Function} callback
       */
      addEventListener: function(eventName, callback) {
        if (eventName === 'statusreset') {
          this._statusResetEventListeners.push(callback);
        }
      },
      /**
       * Remove catched listener about `statusreset` event.
       *
       * @memberOf WifiWps
       * @param {String} eventName
       * @param {Function} callback
       */
      removeEventListener: function(eventName, callback) {
        if (eventName === 'statusreset') {
          var index = this._statusResetEventListeners.indexOf(callback);
          if (index >= 0) {
            this._statusResetEventListeners.splice(index, 1);
          }
        }
      }
    };
    return wifiWps;
  };

  return WifiWps;
});

define('panels/wifi/panel',['require','modules/dialog_service','modules/settings_panel','shared/settings_listener','modules/settings_service','panels/wifi/wifi_wps','modules/wifi_context','shared/wifi_helper','modules/wifi_utils'],function(require) {
  

  var DialogService = require('modules/dialog_service');
  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');
  var SettingsService = require('modules/settings_service');
  var WifiWps = require('panels/wifi/wifi_wps');
  var WifiContext = require('modules/wifi_context');
  var WifiHelper = require('shared/wifi_helper');
  var wifiManager = WifiHelper.getWifiManager();
  var WifiUtils = require('modules/wifi_utils');
  return function ctor_wifi() {
    var elements, isFirst = true,
      wifiEnabled, beforeshow = true,
      needFocused = null;
    var wpsDialogShow = false;
    var wpsBackKey = false;
    var changeWifi = false;

    function _onWpsStatusReset() {
      elements.wps.wpsPbcLabelBlock.setAttribute('data-l10n-id', 'wpsMessage');
    }

    return SettingsPanel({
      onInit: function(panel) {
        this._settings = navigator.mozSettings;
        this._networkListPromise = null;
        this._networks = {};
        this._dialogPanelShow = false;
        elements = {
          panel: panel,
          wifi: panel,
          wifiOn: panel.querySelector('.wifi-on'),
          wifiOff: panel.querySelector('.wifi-off'),
          wpsColumn: panel.querySelector('.wps-column'),
          wpsInfoBlock: panel.querySelector('.wps-column small'),
          wpsPbcLabelBlock: panel.querySelector('.wps-column span'),
          wifiBtn: [].slice.apply(panel.querySelectorAll('input[name="wifi-enabled"]')),
          wifiAvailableNetworks: panel.querySelector('.availableNetworks'),
          advancedSettings: panel.querySelector('.advancedSettings'),
          items: panel.querySelectorAll('li')
        };
        elements.wps = {
          wpsColumn: elements.wpsColumn,
          wpsInfoBlock: elements.wpsInfoBlock,
          wpsPbcLabelBlock: elements.wpsPbcLabelBlock
        };
        elements.wifiOn.hidden = false;
        elements.wifiOff.hidden = false;
        elements.wifiBtn[0].checked = false;
        elements.wifiBtn[1].checked = false;
        SettingsDBCache.getSettings((results) => {
          let enabled = results['wifi.enabled'];
          wifiEnabled = enabled;
          if (enabled) {
            elements.wifiBtn[0].checked = true;
            this._setMozSettingsEnabled(enabled);
          } else {
            elements.wifiBtn[1].checked = true;
            elements.wpsColumn.hidden = true;
            elements.wifiAvailableNetworks.hidden = true;
            elements.advancedSettings.hidden = true;
          }
        });

        SettingsListener.observe('settings.wlan.enabled', false, (enabled) => {
          WifiUtils.wlanEnabled = enabled;
        });

        this._wps = WifiWps();
        // element related events
        elements.wifiBtn.forEach((checkbox) => {
          checkbox.parentNode.parentNode.onfocus = (e) => {
            needFocused = e.target;
          };

          checkbox.onclick = this._saveWifi.bind(this);
        });
        // wifiContext related events
        WifiContext.addEventListener('wifiEnabled', function() {
          elements.wifiBtn.forEach((btn) => {
            btn.disabled = false;
          });
          this._setMozSettingsEnabled(true);
          this._updateNetworkState();
        }.bind(this));

        WifiContext.addEventListener('wifiDisabled', function() {
          elements.wifiBtn.forEach((btn) => {
            btn.disabled = false;
          });
        }.bind(this));

        this._boundWifiEnabled = function(enabled) {
          wifiEnabled = enabled;
          enabled ?
            elements.wifiBtn[0].checked = true :
            elements.wifiBtn[1].checked = true;
          if (enabled) {
            this._updateNetworkState();
          } else {
            this._setMozSettingsEnabled(enabled);
          }
        }.bind(this);
        this.initAll = this._initAll.bind(this);
        this.handleDialogShow = this._handleDialogShow.bind(this);
        this.handleKeydown = this._handleKeydown.bind(this);
        this.updateNetworkState = this._updateNetworkState.bind(this);
        this.handleConfirmDlgEvents = this._handleConfirmDlgEvents.bind(this);
      },
      onBeforeShow: function() {
        if (!this._dialogPanelShow) {
          if (elements.panel.querySelector('.wps-column.focus') &&
            this._wps.inProgress) {
            this._updateSoftKeyStop.bind(this)();
          } else {
            this._initSoftKey();
            elements.wifiBtn[0].checked = false;
            elements.wifiBtn[1].checked = false;
          }
          beforeshow = true;
          SettingsListener.observe('wifi.enabled', true, this._boundWifiEnabled);
          window.addEventListener('gaia-confirm-open', this.handleConfirmDlgEvents);
          window.addEventListener('gaia-confirm-close', this.handleConfirmDlgEvents);
        }
      },
      onShow: function(panel, options) {
        if (!options.isVisibilityChange) {
          this._updateEnableHigtlight();
        }
        WifiContext.addEventListener('wifiStatusChange',
          this.updateNetworkState);
        this._wps.addEventListener('statusreset', _onWpsStatusReset);
        if (!this._dialogPanelShow) {
          beforeshow = false;
          window.addEventListener('keydown', this.handleKeydown);
          window.addEventListener('dialogpanelshow', this.handleDialogShow);
          window.addEventListener('dialogpanelhide', this.initAll);
        }
      },
      onBeforeHide: function() {
        if (!this._dialogPanelShow) {
          SettingsListener.unobserve('wifi.enabled', this._boundWifiEnabled);
          window.removeEventListener('keydown', this.handleKeydown);
          window.removeEventListener('dialogpanelshow', this.handleDialogShow);
          window.removeEventListener('dialogpanelhide', this.initAll);
          window.removeEventListener('gaia-confirm-open', this.handleConfirmDlgEvents);
          window.removeEventListener('gaia-confirm-close', this.handleConfirmDlgEvents);
        }
      },

      onHide: function() {
        WifiContext.removeEventListener('wifiStatusChange',
          this.updateNetworkState);
        this._wps.removeEventListener('statusreset', _onWpsStatusReset);
      },

      _handleKeydown: function(e) {
        if (wpsDialogShow) {
          evt.preventDefault();
          evt.stopPropagation();
          return;
        }

        switch (e.key) {
          case 'Enter':
            if (this._wps.inProgress &&
              (elements.panel.querySelector('.focus.availableNetworks') ||
              elements.panel.querySelector('.focus.advancedSettings'))) {
              this._wpsConnectingDialog.bind(this)();
              break;
            }

            var btn = elements.panel.querySelector('.focus input');
            if (btn) {
              elements.panel.querySelector('.focus').focus();
              var header = document.querySelectorAll('.current [data-href]');
              var currenId = header[0].getAttribute('data-href');
              setTimeout(function() {
                if (btn.classList.contains('wifi-input-off') && btn.checked) {
                  // When other app enter "Settings Configure Activity",
                  // this page can back normal.
                  if (currenId === '#connectivity-settings') {
                    SettingsService.navigate('connectivity-settings');
                  }
                }
              }, 500);
            } else if (elements.panel.querySelector('.focus').classList.contains('wps-column')) {
              this._onWpsColumnClick.bind(this)();
            }
            break;
          case 'ArrowUp':
          case 'ArrowDown':
            if (elements.panel.querySelector('.wps-column.focus') &&
              this._wps.inProgress) {
              this._updateSoftKeyStop.bind(this)();
            } else {
              this._initSoftKey();
            }
            break;
          case 'BrowserBack':
          case 'Backspace':
            if (this._wps.inProgress) {
              wpsBackKey = true;
              this._wpsConnectingDialog.bind(this)();
            } else {
              NavigationMap.navigateBack();
            }
            break;
          default:
            break;
        }
      },

      _updateEnableHigtlight: function () {
        SettingsDBCache.getSettings((results) => {
          let state = results['wifi.enabled'];
          let liItem = state ? elements.items[0] : elements.items[1];
          requestFocus(elements.panel, liItem);
        });
      },

      _handleConfirmDlgEvents: function(evt) {
        switch (evt.type) {
          case 'gaia-confirm-open':
            wpsDialogShow = true;
            break;
          case 'gaia-confirm-close':
            wpsDialogShow = false;
            break;
        }
      },

      _initSoftKey: function() {
        var softkeyParams = {
          menuClassName: 'menu-button',
          header: {
            l10nId: 'message'
          },
          items: [{
            name: 'Select',
            l10nId: 'select',
            priority: 2,
            method: function() {
              if (Settings.currentPanel === '#wifi') {
                var checkbox = elements.panel.querySelector('li.focus input');
                if (checkbox) {
                  checkbox.click();
                }
              }
            }
          }]
        };
        SettingsSoftkey.init(softkeyParams);
        SettingsSoftkey.show();
      },
      _updateSoftKeyStop: function() {
        var softkeyParams = {
          menuClassName: 'menu-button',
          header: {
            l10nId: 'message'
          },
          items: [{
            name: 'Stop',
            l10nId: 'stop',
            priority: 3,
            method: () => {
              this._stopWpsConnect.bind(this)();
            }
          }]
        };
        SettingsSoftkey.init(softkeyParams);
        SettingsSoftkey.show();
      },

      _handleDialogShow: function(e) {
        this._dialogPanelShow = true;
        window.removeEventListener('keydown', this.handleKeydown);
      },
      _initpanelready: function(dialogpanel) {
        var evt = new CustomEvent('panelready', {
          detail: {
            current: Settings.currentPanel,
            previous: dialogpanel
          }
        });
        window.dispatchEvent(evt);
      },
      _initAll: function(e) {
        if (this._wps.inProgress) {
          this._updateSoftKeyStop.bind(this)();
        } else {
          this._initSoftKey();
        }

        this._dialogPanelShow = false;
        var dialogpanel = e.detail.dialogpanel;
        wifiEnabled ? elements.wifiBtn[0].checked = true : elements.wifiBtn[1].checked;
        this._initpanelready(dialogpanel);
        window.addEventListener('keydown', this.handleKeydown);
      },
      _wpsFailedDialog: function() {
        var dialogConfig = {
          title: {
            id: 'wpsFailedDialogTitle',
            args: {}
          },
          body: {
            id: 'wpsFailedDialogBody',
            args: {}
          },
          accept: {
            l10nId: 'ok',
            priority: 2,
            callback: function() {
              dialog.destroy();
            },
          }
        };

        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      },

      _wpsConnectingDialog: function() {
        var self = this;
        var dialogConfig = {
          title: {
            id: 'wpsConnectingDialogTitle',
            args: {}
          },
          body: {
            id: 'wpsConnectingDialogBody',
            args: {}
          },
          backcallback: function() {
            wpsBackKey = false;
          },
          cancel: {
            name: 'Yes',
            l10nId: 'yes',
            priority: 1,
            callback: function() {
              wpsDialogShow = false;
              self._stopWpsConnect.bind(self)();
            }
          },
          confirm: {
            name: 'No',
            l10nId: 'no',
            priority: 3,
            callback: function() {
              wpsBackKey = false;
              dialog.destroy();
            }
          },
        };

        this._wps.dialog = new ConfirmDialogHelper(dialogConfig);
        this._wps.dialog.show(
          document.getElementById('app-confirmation-dialog'));
      },

      _updateNetworkState: function() {
        // update network state, called only when wifi enabled.
        var networkStatus = wifiManager.connection.status;
        var network = wifiManager.connection.network;
        var ssid = elements.wpsInfoBlock.dataset.ssid;
        if (this._wps.inProgress) {
          if (networkStatus !== 'disconnected') {
            elements.wpsInfoBlock.
            setAttribute('data-l10n-id', WifiContext.wifiStatusText.id);
            if (WifiContext.wifiStatusText.args) {
              elements.wpsInfoBlock.
              setAttribute('data-l10n-args',
                JSON.stringify(WifiContext.wifiStatusText.args));
            } else {
              elements.wpsInfoBlock.removeAttribute('data-l10n-args');
            }
          }
          if (networkStatus === 'connected') {
            elements.wpsInfoBlock.dataset.ssid = network.ssid;
          }
          if (networkStatus === 'connected' ||
            networkStatus === 'wps-timedout' ||
            networkStatus === 'wps-failed' ||
            networkStatus === 'wps-overlapped') {
            this._wps.inProgress = false;
            elements.wifiAvailableNetworks.children[0].setAttribute('href',
              '#wifi-available-networks');
            elements.advancedSettings.children[0].setAttribute('href',
              '#wifi-advanced-settings');
            if (this._wps.dialog) {
              this._wps.dialog.close();
            }
            this._wps.statusReset();
            this._initSoftKey();
            if (networkStatus === 'wps-failed') {
              this._wpsFailedDialog();
            }
          }
        } else {
          if (networkStatus === 'disconnected' ||
              (networkStatus === 'connected' && ssid !== network.ssid )) {
            elements.wpsInfoBlock.dataset.ssid = null;
            elements.wpsInfoBlock.removeAttribute('data-l10n-args');
            elements.wpsPbcLabelBlock.setAttribute('data-l10n-id', 'wpsMessage');
            elements.wpsInfoBlock.setAttribute('data-l10n-id', 'wpsDescription2');
          }
        }
      },
      _setMozSettingsEnabled: function(enabled) {
        if (enabled) {
          /**
           * wifiManager may not be ready (enabled) at this moment.
           * To be responsive, show 'initializing' status and 'search...'
           * first. A 'scan' would be called when wifiManager is enabled.
           */
          elements.wpsColumn.hidden = false;
          elements.wifiAvailableNetworks.hidden = false;
          elements.advancedSettings.hidden = false;
        } else {
          if (this._wps.inProgress) {
            elements.wpsInfoBlock.
            setAttribute('data-l10n-id', WifiContext.wifiStatusText.id);
            if (WifiContext.wifiStatusText.args) {
              elements.wpsInfoBlock.
              setAttribute('data-l10n-args',
                JSON.stringify(WifiContext.wifiStatusText.args));
            } else {
              elements.wpsInfoBlock.removeAttribute('data-l10n-args');
            }
          }
          elements.wpsColumn.hidden = true;
          elements.wifiAvailableNetworks.hidden = true;
          elements.advancedSettings.hidden = true;
        }
        if (!beforeshow && Settings.currentPanel == '#' + elements.panel.id) {
          var evt = new CustomEvent('panelready', {
            detail: {
              current: Settings.currentPanel,
              needFocused: needFocused
            }
          });
          window.dispatchEvent(evt);
        }
      },

      _getSetting: function(settingKey) {
        return new Promise(function (resolve, reject) {
          navigator.mozSettings.createLock().get(settingKey).then(
            (result) => {
              resolve(result[settingKey]);
            });
        });
      },

      _processHotspotAndUsbTethering: function(ipt, checked) {
        let p1 = this._getSetting('tethering.wifi.enabled');
        let p2 = this._getSetting('tethering.usb.enabled');
        let self = this;
        Promise.all([p1, p2]).then((ret) => {
          let wifiHotspot = ret[0];
          let usbTether = ret[1];
          let cancelPro = () => {
            elements.wifiBtn[0].checked = false;
            elements.items[0].classList.remove('focus');
            elements.wifiBtn[1].checked = true;
            elements.items[1].classList.add('focus');
            elements.items[1].focus();
          }

          if (wifiHotspot || usbTether) {
            let bodyL10n;
            if (wifiHotspot) {
              bodyL10n = 'wifi-hotspot-dialog';
            } else if (usbTether) {
              bodyL10n = 'wifi-usb-dialog';
            }

            var dialogConfig = {
              title: {
                id: 'wifi',
                args: {}
              },
              body: {
                id: bodyL10n,
                args: {}
              },
              cancel: {
                name: 'Cancel',
                l10nId: 'cancel',
                priority: 1,
                callback: function() {
                  cancelPro();
                }
              },
              confirm: {
                name: 'Turn On',
                l10nId: 'turnOn',
                priority: 3,
                callback: function() {
                  let lock = navigator.mozSettings.createLock();
                  if (wifiHotspot) {
                    lock.set({'tethering.wifi.enabled': false});
                  } else if (usbTether) {
                    lock.set({'tethering.usb.enabled': false});
                  }
                  self._saveWifiProcess(ipt, checked);
                }
              },
              backcallback: function() {
                cancelPro();
              }
            };

            let dialog = new ConfirmDialogHelper(dialogConfig);
            dialog.show(document.getElementById('app-confirmation-dialog'));
          } else {
            self._saveWifiProcess(ipt, checked);
          }
        });
      },

      _saveWifiProcess: function(ipt, checked) {
        ipt.checked = true;
        this._settings.createLock().set({
          'wifi.enabled': checked
        }).onerror = function() {
          // Fail to write mozSettings, return toggle control to the user.
          elements.wifiBtn.forEach((btn) => {
            btn.disabled = false;
          });
        };
        showToast('changessaved');
        elements.wifiBtn.forEach((btn) => {
          btn.disabled = true;
        });
      },

      _saveWifi: function(e) {
        // `this` is Wifi Object
        if (changeWifi) {
          return;
        }
        changeWifi = true;

        setTimeout(() => {
          changeWifi = false;
        }, 500);

        var ipt = e.target;
        var checked = ipt.classList.contains('wifi-input-on');
        if (wifiEnabled === checked) {
          return;
        }

        if (checked) {
          this._processHotspotAndUsbTethering(ipt, checked);
        } else {
          this._saveWifiProcess(ipt, checked);
        }
      },

      _wpsPanelNavigate() {
        if (wpsBackKey) {
          wpsBackKey = false;
          if (window.ActivityHandler) {
            ActivityHandler.postResult();
          } else {
            SettingsService.navigate('root');
          }
        } else if (elements.panel.querySelector('.focus.availableNetworks')) {
          SettingsService.navigate('wifi-available-networks');
        } else if (elements.panel.querySelector('.focus.advancedSettings')) {
          SettingsService.navigate('wifi-advanced-settings');
        }
      },

      _stopWpsConnect: function() {
        var self = this;
        if (this._wps.inProgress) {
          this._wps.cancel({
            onSuccess: function() {
              elements.wifiAvailableNetworks.children[0].setAttribute('href',
                '#wifi-available-networks');
              elements.advancedSettings.children[0].setAttribute('href',
                '#wifi-advanced-settings');
              self._initSoftKey();
              elements.wpsInfoBlock.setAttribute('data-l10n-id',
                'fullStatus-wps-canceled');
              self._wpsPanelNavigate();
            },
            onError: function(error) {
              self._initSoftKey();
              navigator.mozL10n.setAttributes(elements.wpsInfoBlock,
                'wpsCancelFailedMessageError', {
                  error: error.name
                });
            }
          });
        }
      },

      _onWpsColumnClick: function() {
        var self = this;
        var _ = navigator.mozL10n.get;
        var small = elements.panel.querySelector('.focus small');

        if (small && small.textContent === _('fullStatus-wps-canceled')) {
          elements.wpsInfoBlock.removeAttribute('data-l10n-args');
          elements.wpsPbcLabelBlock.setAttribute('data-l10n-id', 'wpsMessage');
          elements.wpsInfoBlock.setAttribute('data-l10n-id', 'wpsDescription2');
        } else if (!this._wps.inProgress) {
          DialogService.show('wifi-wps', {
            // wifi-wps needs these wps related networks
            wpsAvailableNetworks: function() {
              return self._netWorksList().then(() => {
                return self._getWpsAvailableNetworks();
              });
            }
          }).then((result) => {
            var type = result.type;
            var value = result.value;

            if (type === 'submit') {
              self._wps.connect({
                pin: value.pin,
                selectedAp: value.selectedAp,
                selectedMethod: value.selectedMethod,
                onSuccess: function() {
                  let availableItem = elements.wifiAvailableNetworks;
                  availableItem.children[0].removeAttribute('href');
                  elements.advancedSettings.children[0].removeAttribute('href');
                  self._updateSoftKeyStop.bind(self)();
                  elements.wps.wpsPbcLabelBlock.setAttribute('data-l10n-id',
                    'wpsMessage');
                  elements.wps.wpsInfoBlock.setAttribute('data-l10n-id',
                    'fullStatus-wps-inprogress');
                },
                onError: function(error) {
                  self._initSoftKey();
                  navigator.mozL10n.setAttributes(elements.wpsInfoBlock,
                    'fullStatus-wps-failed-error', {
                      error: error.name
                    });
                }
              });
            }
          });
        }
      },
      _netWorksList: function() {
        var self = this;
        // stop auto-scanning if wifi disabled or the app is hidden
        if (!wifiManager.enabled || document.hidden) {
          return;
        }
        if (!this._networkListPromise) {
          this._networkListPromise = new Promise((resolve) => {
            var req = WifiHelper.getAvailableAndKnownNetworks();

            req.onsuccess = function onScanSuccess() {
              var allNetworks = req.result;
              var network;

              for (var i = 0; i < allNetworks.length; ++i) {
                network = allNetworks[i];
                var key = WifiUtils.getNetworkKey(network);
                // keep connected network first, or select the highest strength
                if (!self._networks[key] || network.connected) {
                  self._networks[key] = network;
                } else {
                  if (!self._networks[key].connected &&
                    network.relSignalStrength >
                    self._networks[key].relSignalStrength) {
                    self._networks[key] = network;
                  }
                }
              }
              resolve();
            };
          });
        }
        return this._networkListPromise;
      },
      _getWpsAvailableNetworks: function() {
        // get WPS available networks
        var ssids = Object.getOwnPropertyNames(this._networks);
        var wpsAvailableNetworks = [];
        for (var i = 0; i < ssids.length; i++) {
          var network = this._networks[ssids[i]];
          if (WifiHelper.isWpsAvailable(network)) {
            wpsAvailableNetworks.push(network);
          }
        }
        return wpsAvailableNetworks;
      }
    });
  };
});
