define(['require','modules/settings_panel','shared/settings_listener','modules/wifi_context','shared/wifi_helper','modules/wifi_utils'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');
  var WifiContext = require('modules/wifi_context');
  var WifiHelper = require('shared/wifi_helper');
  var wifiManager = WifiHelper.getWifiManager();
  var WifiUtils = require('modules/wifi_utils');

  return function ctor_wifi_available_networks() {
    var elements;

    function _refreshPanel() {
      var evt = new CustomEvent('refresh');
      window.dispatchEvent(evt);
    }

    return SettingsPanel({
      onInit: function(panel) {
        this._settings = navigator.mozSettings;
        this._wifiSectionVisible = false;
        this._scanPending = false;
        this._networkListPromise = null;
        this._initialized = false;
        this._wifiConnecting = false;
        this._dialogPanelShow = false;
        elements = {
          panel: panel,
          wifiAvailableNetworks: panel.querySelector('.wifi-availableNetworks')
        };
        elements.infoItem = panel.querySelector('.searching_icon');
        elements.networklist = {
          infoItem: elements.infoItem,
          wifiAvailableNetworks: elements.wifiAvailableNetworks
        };

        SettingsListener.observe('wifi.enabled', true, (enabled) => {
          if (!enabled) {
            // Re-enable UI toggle
            this._networkList().then((networkList) => {
              networkList._scanning = false;
              networkList.autoscan = false;
              networkList.clear();
            });
          }
        });

        this.initAll = this._initAll.bind(this);
        this.handleDialogShow = this._handleDialogShow.bind(this);
        this.onWifiStatusChange = this._onWifiStatusChange.bind(this);
        this.openWrongPasswordDialog = this._openWrongPasswordDialog.bind(this);
        this.openConnetingFailedDialog =
          this._openConnetingFailedDialog.bind(this);
        this.openObtainingIPFailedDialog =
          this._openObtainingIPFailedDialog.bind(this);
        this.handleFocusChanged = this._handleFocusChanged.bind(this);
        this.updateSoftkeySubmit = this._updateSoftkeySubmit.bind(this);
        this.wifiAuthPanel = document.getElementById("wifi-auth");
        this.wifiStatusPanel = document.getElementById("wifi-status");
      },
      onBeforeShow: function() {
        if (!this._dialogPanelShow) {
          this._wifiSectionVisible = true;
          this._updateVisibilityStatus();
          WifiContext.addEventListener('wifiStatusChange',
            this.onWifiStatusChange);
          window.addEventListener('wifi-auth-submit', this.updateSoftkeySubmit);
        }

        this._networkList().then((networkList) => {
          networkList.startAutoscanTimer();
        });
      },
      onShow: function() {
        if (!this._dialogPanelShow) {
          if (!this.wifiAuthPanel.classList.contains('current') &&
              !this.wifiStatusPanel.classList.contains('current')) {
            this._updateSoftkey('rescan');
            window.addEventListener('keydown', this._handleKeydown);
          }
          window.addEventListener('dialogpanelshow', this.handleDialogShow);
          window.addEventListener("dialogpanelhide", this.initAll);
          document.addEventListener('focusChanged', this.handleFocusChanged);

          if (NavigationMap.previousSection !== '#wifi-auth-wapi') {
            this._networkList().then((networkList) => {
              networkList._panel = elements.panel;
              networkList.scan(true);
            });
          }
        }
      },
      onBeforeHide: function() {
        if (!this._dialogPanelShow) {
          this._wifiSectionVisible = false;

          window.removeEventListener('keydown', this._handleKeydown);
          window.removeEventListener('dialogpanelshow', this.handleDialogShow);
          window.removeEventListener('dialogpanelhide', this.initAll);
          window.removeEventListener('wifi-auth-submit',
            this.updateSoftkeySubmit);
          document.removeEventListener('focusChanged', this.handleFocusChanged);
          WifiContext.removeEventListener('wifiStatusChange',
            this.onWifiStatusChange);
        }
        this._networkList().then((networkList) => {
          if (networkList._timerID) {
            window.clearInterval(networkList._timerID);
          }
        });
      },
      _initAll: function(e) {
        this._dialogPanelShow = false;
        var dialogpanel = e.detail.dialogpanel;
        this._updateSoftkey('rescan');
        this._initpanelready(dialogpanel);
        window.addEventListener("keydown", this._handleKeydown);

        this._networkList().then((networkList) => {
          networkList.startAutoscanTimer();
        });
      },

      _updateSoftkeySubmit: function(event) {
        this._updateSoftkey('rescan');
      },

      _updateSoftkey: function(rskType) {
        if (WifiUtils.toggleLogin) {
          return;
        }

        var self = this;
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
              var li = elements.panel.querySelector('li.focus');
              if (li) {
                var networkPara = JSON.parse(li.dataset.network);
                if (networkPara.security[0] === 'WAPI-PSK'
                    || networkPara.security[0] === 'WAPI-CERT')
                  navigator.mozSettings.createLock().set({
                    'settings.wifi.network': li.dataset.network
                });
              }
            }
          }]
        };
        if (rskType === 'rescan') {
          softkeyParams.items.push({
            name: 'Rescan',
            l10nId: 'rescan',
            priority: 3,
            method: function() {
              self._networkList().then((networkList) => {
                networkList._rescanFlag = true;
                networkList.scan();
              });
            }
          });
        } else if (rskType === 'forget') {
          softkeyParams.items.push({
            name: 'Forget',
            l10nId: 'forget',
            priority: 3,
            method: function() {
              self._dialogPanelShow = true;
              self._forgetNetwork(WifiContext.currentNetwork);
            }
          });
        }
        SettingsSoftkey.init(softkeyParams);
        SettingsSoftkey.show();
      },
      _onWifiStatusChange: function(event) {
        if (event.status === 'connected') {
          if (this._wifiSectionVisible) {
            _refreshPanel();
          } else {
            this._scanPending = true;
          }
          this._wifiConnecting = false;
          this._updateSoftkey('rescan');
          showToast('wifi-connected');
        }
      },
      _handleKeydown: function(e) {
        switch (e.key) {
          case 'BrowserBack':
          case 'Backspace':
          case 'KanjiMode':
            Settings.isBackHref = true;
            Settings.currentPanel = "#wifi";
            break;
        }
      },
      _handleDialogShow: function() {
        this._dialogPanelShow = true;
        window.removeEventListener('keydown', this._handleKeydown);

        this._networkList().then((networkList) => {
          if (networkList._timerID) {
            window.clearInterval(networkList._timerID);
          }
        });
      },
      _handleFocusChanged: function(event) {
        this._doUpdateSoftkey(event.detail.focusedElement);
      },
      _doUpdateSoftkey: function (focusedElement) {
        if (this._wifiConnecting) {
          var ssid = null;
          if (wifiManager && wifiManager.connection &&
              wifiManager.connection.network) {
            ssid = wifiManager.connection.network.ssid;
          } else {
            return;
          }
          if (focusedElement.dataset.ssid === ssid) {
            this._updateSoftkey('forget');
          } else {
            this._updateSoftkey('none');
          }
        } else if (!this.wifiAuthPanel.classList.contains('current') &&
            !this.wifiStatusPanel.classList.contains('current')) {
          this._updateSoftkey('rescan');
        }
      },
      _initpanelready: function(dialogpanel) {
        if (Settings.currentPanel == "#wifi-available-networks" && !this._dialogPanelShow) {
          var evt = new CustomEvent("panelready", {
            detail: {
              current: Settings.currentPanel,
              previous: dialogpanel
            }
          });
          window.dispatchEvent(evt);
        }
      },
      _updateVisibilityStatus: function() {
        this._networkList().then(function(networkList) {
          if (this._scanPending) {
            networkList.scan();
            this._scanPending = false;
          }
        }.bind(this));
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
        var self = this;
        var network = WifiContext.currentNetwork;

        var onConfirm = function onConfirm() {
          if (bodyId === 'wifi-authentication-failed') {
            self._networkList().then(function(networkList) {
              networkList._toggleNetwork(network, bodyId);
            });
          }
        };

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
              onConfirm();
            },
          }
        };

        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      },
      _networkList: function() {
        if (!this._networkListPromise) {
          this._networkListPromise = new Promise((resolve) => {
            require(['panels/wifi_available_networks/wifi_network_list'], (WifiNetworkList) => {
              resolve(WifiNetworkList(elements.networklist, this._initpanelready.bind(this)));
            });
          });
        }
        return this._networkListPromise;
      },
      _forgetNetwork: function(network) {
        var self = this;
        var dialogConfig = {
          title: { id: 'forgetNetwork-confirmation', args: {} },
          body: { id: 'forgetNetwork-dialog', args: {} },
          cancel: {
            l10nId:'cancel',
            priority:1,
            callback: function() {
              dialog.destroy();
              self._dialogPanelShow = false;
            },
          },
          confirm: {
            l10nId: 'forget',
            priority: 3,
            callback: function() {
              WifiContext.forgetNetwork(network, function() {
                self._networkList().then((networkList) => {
                  showToast('networkforget');
                  networkList.scan();
                });
              });
              dialog.destroy();
              self._dialogPanelShow = false;
            },
          },
        };

        if (self._dialogPanelShow) {
          var dialog = new ConfirmDialogHelper(dialogConfig);
          dialog.show(document.getElementById('app-confirmation-dialog'));
        }
      }
    });
  };
});
