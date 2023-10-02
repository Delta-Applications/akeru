
define('panels/wifi_status/panel',['require','modules/dialog_panel','shared/wifi_helper','modules/wifi_context'],function(require) {
  

  var DialogPanel = require('modules/dialog_panel');
  var WifiHelper = require('shared/wifi_helper');
  var WifiContext = require('modules/wifi_context');
  var wifiManager = WifiHelper.getWifiManager();

  return function ctor_statusWifi() {
    var elements = {};

    return DialogPanel({
      onInit: function(panel) {
        elements = {};
        elements.panel = panel;
        elements.ip = panel.querySelector('[data-ip]');
        elements.speed = panel.querySelector('[data-speed]');
        elements.ssid = panel.querySelector('[data-ssid]');
        elements.signal = panel.querySelector('[data-signal]');
        elements.security = panel.querySelector('[data-security]');
        elements.forgetNetworkDialog = panel.querySelector('form');
        elements.softkeyFlag = false;
        this.keydownHandler = this._keydownHandler.bind(this);
        this.handleVisibiltychange = this._handleVisibiltychange.bind(this);
        this.onWifiStatusChange = this._onWifiStatusChange.bind(this);
        this.openWrongPasswordDialog = this._openWrongPasswordDialog.bind(this);
        this.openConnetingFailedDialog =
          this._openConnetingFailedDialog.bind(this);
        this.openObtainingIPFailedDialog =
          this._openObtainingIPFailedDialog.bind(this);
      },
      onBeforeShow: function(panel, options) {
        var _ = navigator.mozL10n.get;

        this._updateNetworkInfo();
        elements.ssid.textContent = options.network.ssid;
        elements.signal.setAttribute('data-l10n-id',
          'signalLevel' + options.sl);

        var wifiSecurity = elements.panel.querySelector('.wifi-security');
        wifiSecurity.hidden = true;

        var wifiIpAddress = elements.panel.querySelector('.wifi-ip-address');
        var wifiLinkSpeed = elements.panel.querySelector('.wifi-link-speed');
        elements.network = options.network;
        elements.knownNetwork = options.knownNetwork;
        if (options.isConnected) {
          elements.softkeyFlag = false;
          wifiIpAddress.hidden = false;
          wifiLinkSpeed.hidden = false;
          this._initSoftKey();
        } else if (options.knownNetwork) {
          elements.softkeyFlag = true;
          wifiIpAddress.hidden = true;
          wifiLinkSpeed.hidden = true;
          wifiSecurity.hidden = false;
          elements.security.textContent = _('shortStatus-disconnected');
          this._initSoftKey(true);
        }

        this._wifiStatusPanelAriaDisable(false);
        elements.connectFlag = false;

        wifiManager.onconnectioninfoupdate = this._updateNetworkInfo;
        this._initpanelready();
        this._dispatchDialogShowEvent();
        document.addEventListener('visibilitychange', this.handleVisibiltychange);
        window.addEventListener('keydown', this.keydownHandler);
        WifiContext.addEventListener('wifiStatusChange',
          this.onWifiStatusChange);
        WifiContext.addEventListener('wifiWrongPassword',
          this.openWrongPasswordDialog);
        WifiContext.addEventListener('wifiConnectingFailed',
          this.openConnetingFailedDialog);
        WifiContext.addEventListener('wifiObtainingIPFailed',
          this.openObtainingIPFailedDialog);
      },
      onBeforeHide: function() {
        elements.softkeyFlag = false;
        wifiManager.onconnectioninfoupdate = null;
        var evt = new CustomEvent("dialogpanelhide", {
          detail: {
            dialogpanel: "#" + elements.panel.id
          }
        });
        window.dispatchEvent(evt);
        window.removeEventListener('keydown', this.keydownHandler);
        WifiContext.removeEventListener('wifiStatusChange',
          this.onWifiStatusChange);
        WifiContext.removeEventListener('wifiWrongPassword',
          this.openWrongPasswordDialog);
        WifiContext.removeEventListener('wifiConnectingFailed',
          this.openConnetingFailedDialog);
        WifiContext.removeEventListener('wifiObtainingIPFailed',
          this.openObtainingIPFailedDialog);
        document.removeEventListener('visibilitychange', this.handleVisibiltychange);
      },

      onSubmit: function() {
        return Promise.resolve({
          connectFlag: elements.connectFlag
        });
      },

      _keydownHandler: function(e) {
        switch (e.key) {
          case 'BrowserBack':
          case 'Backspace':
          case 'KanjiMode':
            if (!elements.connectFlag) {
              elements.panel.querySelector('button[type="submit"]').click();
            }
            break;
          case 'ArrowUp':
          case 'ArrowDown':
            if (elements.connectFlag) {
              this._initSoftKey(false);
            }
            break;
          default:
            break;
        }
      },
      _initpanelready: function() {
        var evt = new CustomEvent("panelready", {
          detail: {
            current: "#" + elements.panel.id,
            previous: "#wifi-available-networks"
          }
        });
        window.dispatchEvent(evt);
      },
      _initSoftKey: function(knownNetwork) {
        var self = this;
        var connect = {
          name: 'Connect',
          l10nId: 'device-option-connect',
          priority: 3,
          method: function() {
            elements.connectFlag = true;
            self._initSoftKey(false);
            self._wifiStatusPanelAriaDisable(true);
            self._connectNetwork();
          }
        };

        var forget = {
          name: 'Forget',
          l10nId: 'forget',
          priority: 1,
          method: function() {
            self._showConfirmDialog();
          }
        };

        var softkeyParams = {
          menuClassName: 'menu-button',
          header: {
            l10nId: 'message'
          },
          items: []
        };

        softkeyParams.items.push(forget);
        if (knownNetwork) {
          softkeyParams.items.push(connect);
        }

        SettingsSoftkey.init(softkeyParams);
        SettingsSoftkey.show();
      },

      _showNoNetworkDialog() {
        var self = this;

        function clearData() {
          var _ = navigator.mozL10n.get;
          elements.security.textContent = _('shortStatus-disconnected');
          elements.connectFlag = false;
          self._initSoftKey(elements.knownNetwork);
          self._wifiStatusPanelAriaDisable(false);
        }

        dialogConfig = {
          title: {
            id: 'failed-to-connect',
            args: {}
          },
          body: {
            id: 'network-not-found',
            args: {}
          },
          accept: {
            l10nId: 'ok',
            priority: 2,
            callback: function() {
              dialog.destroy();
              clearData();
            },
          },
          backcallback: function() {
            dialog.destroy();
            clearData();
          }
        };

        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      },

      _connectCallback(error) {
        if (error && error.name === 'network not found') {
          WifiContext.forgetNetwork(elements.network);
          this._showNoNetworkDialog().bind(this);
        }
      },

      _connectNetwork: function() {
        WifiHelper.setPassword(elements.network);
        WifiContext.associateNetwork(elements.network, this._connectCallback.bind(this));
      },

      _showConfirmDialog: function() {
        var self = this;
        var dialogConfig = {
          title: {
            id: 'forgetNetwork-confirmation',
            args: {}
          },
          body: {
            id: 'forgetNetwork-dialog',
            args: {}
          },
          cancel: {
            l10nId: 'cancel',
            priority: 1,
            callback: function() {
              dialog.destroy();
              window.addEventListener('keydown', self.keydownHandler);
            },
          },
          confirm: {
            l10nId: 'forget',
            priority: 3,
            callback: function() {
              dialog.destroy();
              elements.panel.querySelector('button[type="reset"]').click();
            },
          },
          backcallback: function() {
            window.addEventListener('keydown', self.keydownHandler);
          }
        };
        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
        window.removeEventListener('keydown', self.keydownHandler);
      },
      _updateNetworkInfo: function() {
        var info = wifiManager.connectionInformation || {};
        elements.ip.textContent = info.ipAddress || '';
        navigator.mozL10n.setAttributes(elements.speed,
          'linkSpeedMbs', {
            linkSpeed: info.linkSpeed
          });
      },
      _handleVisibiltychange: function() {
        if (!document.hidden) {
          this._initSoftKey(elements.softkeyFlag);
          this._dispatchDialogShowEvent();
        }
      },

      _wifiStatusPanelAriaDisable: function(enabled) {
        let list = elements.panel.querySelectorAll('#wifi-status li');

        for(let i = 0; i < list.length; i++) {
          if (list[i].hidden === false && enabled) {
            list[i].setAttribute('aria-disabled', true);
          } else if (list[i].hidden === false && !enabled) {
            list[i].removeAttribute('aria-disabled');
          }
        }

        let searchStr = '#wifi-status li input';
        let listInput = elements.panel.querySelectorAll(searchStr);

        for(let i = 0; i < listInput.length; i++) {
          if (listInput[i].hidden === false && enabled) {
            listInput[i].setAttribute('disabled', 'disabled');
          } else if (listInput[i].hidden === false && !enabled) {
            listInput[i].removeAttribute('disabled', 'disabled');
          }
        }

        if (enabled) {
          NavigationMap.menuReset(elements.panel.querySelector('.focus'), false);
        }
      },

      _onWifiStatusChange: function(event) {
        let status = event.status;
        if (event.network.ssid !== elements.network.ssid) {
          return;
        }

        if (status === 'connecting' || status === 'associated') {
          elements.panel.querySelector('.wifi-security small').
            setAttribute('data-l10n-id', 'shortStatus-' + status);
        } else if (status === 'connected') {
          this._wifiStatusPanelAriaDisable(false);
          elements.panel.querySelector('button[type="submit"]').click();
        }
      },

      _openWrongPasswordDialog: function() {
        this._openBadCredentialsDialog('wifi-authentication-failed');
      },

      _openConnetingFailedDialog: function() {
        this._openBadCredentialsDialog('wifi-association-reject');
      },

      _openObtainingIPFailedDialog: function() {
        this._openBadCredentialsDialog('wifi-DHCP-failed');
      },

      _openBadCredentialsDialog: function(bodyId) {
        var network = elements.network;

        var dialogConfig = {
          title: {
            id: 'wifi-bad-credentials-title',
            args: {}
          },
          body: {
            id: bodyId,
            args: {
              ssid: network.ssid
            }
          },
          accept: {
            l10nId: 'ok',
            priority: 2,
            callback: function() {
              dialog.destroy();
            },
          }
        };

        var _ = navigator.mozL10n.get;
        elements.security.textContent = _('shortStatus-disconnected');
        elements.connectFlag = false;
        this._initSoftKey(elements.knownNetwork);
        this._wifiStatusPanelAriaDisable(false);
        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      },

      _dispatchDialogShowEvent: function() {
        var evt = new CustomEvent("dialogpanelshow", {
          detail: {
            dialogpanel: "#" + elements.panel.id
          }
        });
        window.dispatchEvent(evt);
      }
    });
  };
});
