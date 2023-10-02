
define('panels/wifi_auth/panel',['require','modules/wifi_utils','shared/wifi_helper','modules/dialog_panel','modules/wifi_context'],function(require) {
  
  var WifiUtils = require('modules/wifi_utils');
  var WifiHelper = require('shared/wifi_helper');
  var DialogPanel = require('modules/dialog_panel');
  var WifiContext = require('modules/wifi_context');

  return function ctor_wifiAuth() {
    var elements = {};
    var forgetFlag = false;
    var self;
    var backPrevious = false;

    function _wifiAuthPanelAriaDisable(enabled) {
      let list = elements.panel.querySelectorAll('#wifi-auth li');

      for(let i = 0; i < list.length; i++) {
        if (list[i].hidden === false && enabled) {
          list[i].setAttribute('aria-disabled', true);
        } else if (list[i].hidden === false && !enabled) {
          list[i].removeAttribute('aria-disabled');
        }
      }

      let searchStr = '#wifi-auth li input';
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
    }

    function _submitProcess() {
      if (!document.querySelector('#app-confirmation-dialog h1')) {
        elements.submitButton.click();
      }
    }

    function _connectNetwork() {
      let network = elements.network;
      let key = WifiHelper.getKeyManagement(network);
      let callback = (result) => {
        if (result && result.name === 'network not found') {
          backPrevious = true;
          _submitProcess();
          self._openBadCredentialsDialog('wifi-association-reject');
        }
      };

      switch (key) {
        case 'WEP':
        case 'WPA-PSK':
        case 'WPA-EAP':
        case 'WPA2-PSK':
        case 'WPA/WPA2-PSK':
          let simCardNum;
          if (elements.securityType === 'WPA-EAP') {
            simCardNum = WifiUtils.getSimNum(elements);
          }

          WifiHelper.setPassword(
            network,
            elements.password.value,
            elements.identity.value,
            elements.eap.value,
            elements.authPhase2.value,
            elements.certificate.value,
            elements.keyIndex.value - 1
          );

          network.sim_num = simCardNum;
          WifiContext.associateNetwork(network, callback);
          break;
        default:
          WifiContext.associateNetwork(network, callback);
          break;
      }
    }

    function _showConfirmDialog() {
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
            if (backPrevious) {
              elements.resetButton.click();
            }
          },
        },
        confirm: {
          l10nId: 'forget',
          priority: 3,
          callback: function() {
            dialog.destroy();
            forgetFlag = true;
            elements.submitButton.click();
          },
        }
      };

      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function _enableSoftKey(evt) {
      _updateSoftKey(evt.detail.enabled);
    }

    function _updateSoftKey(doneSoftkeyEnable, showPassword, forgetEnable) {
      var none = {
        name: '',
        l10nId: '',
        priority: 1,
        method: function() {}
      };

      var forget = {
        name: 'Forget',
        l10nId: 'forget',
        priority: 1,
        method: function() {
          _showConfirmDialog();
        }
      };

      var select = {
        name: 'Select',
        l10nId: 'select',
        priority: 2,
        method: function() {}
      };

      var connect = {
        name: 'Connect',
        l10nId: 'device-option-connect',
        priority: 3,
        method: function() {
          var itemWifiList =
            document.querySelector('ul.wifi-availableNetworks');
          if (itemWifiList) {
            itemWifiList.dataset.ssid = elements.ssid.textContent;
          }

          elements.connectFlag = true;
          _connectNetwork();
          _wifiAuthPanelAriaDisable(true);
          _updateSoftKey(false, false, true);
        }
      }

      var params = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: []
      };

      if (forgetEnable) {
        params.items.push(forget);
      } else if (!doneSoftkeyEnable && !showPassword) {
        params.items.push(none);
      }

      if (showPassword) {
        params.items.push(select);
      }

      if (doneSoftkeyEnable) {
        params.items.push(connect);
      }

      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    function _checkConnectSoftkeyState(key) {
      var password = elements.password.value;
      var identity = elements.identity.value;
      var eap = elements.eap.value;

      return WifiHelper.isValidInput(key, password, identity, eap);
    }

    function _sendCustomEvent(name, detail) {
      var evt = new CustomEvent(name, detail);
      window.dispatchEvent(evt);
    }

    return DialogPanel({
      onInit: function(panel, options) {
        elements = {
          network: null,
          connectFlag: false,
          securityType: '',
          panel: panel,
          ssid: panel.querySelector('[data-ssid]'),
          signal: panel.querySelector('[data-signal]'),
          security: panel.querySelector('[data-security]'),
          identity: panel.querySelector('input[name=identity]'),
          password: panel.querySelector('input[name=password]'),
          showPassword: panel.querySelector('input[name=show-pwd]'),
          eap: panel.querySelector('li.eap select'),
          authPhase2: panel.querySelector('li.auth-phase2 select'),
          keyIndex: panel.querySelector('li.key-index select'),
          certificate: panel.querySelector('li.server-certificate select'),
          resetButton: panel.querySelector('button[type="reset"]'),
          submitButton: panel.querySelector('button[type="submit"]')
        };
        elements.password.parentNode.onfocus = function() {
          elements.password.focus();
          elements.password.selectionStart = elements.password.value.length;
        };
        elements.identity.parentNode.onfocus = function() {
          elements.identity.focus();
        };
        self = this;
        this.keydownHandler = this._keydownHandler.bind(this);
        this.handleVisibiltychange = this._handleVisibiltychange.bind(this);
        this.onWifiStatusChange = this._onWifiStatusChange.bind(this);
        this.openWrongPasswordDialog = this._openWrongPasswordDialog.bind(this);
        this.openConnetingFailedDialog =
          this._openConnetingFailedDialog.bind(this);
        this.openObtainingIPFailedDialog =
          this._openObtainingIPFailedDialog.bind(this);
        this.handleTransit = this.handleTransit.bind(this);
      },
      onBeforeShow: function(panel, options) {
        var network = options.network;
        elements.network = options.network;
        elements.connectFlag = false;
        forgetFlag = false;
        backPrevious = false;
        elements.authPhase2.querySelectorAll('option')[0].selected = true;
        WifiUtils.initializeAuthFields(panel, network);
        WifiUtils.changeDisplay(panel, options.security);
        _wifiAuthPanelAriaDisable(false);

        panel.dataset.security = options.security;
        elements.ssid.textContent = network.ssid;
        elements.signal.setAttribute('data-l10n-id',
          'signalLevel' + options.sl);

        if (options.security) {
          elements.security.removeAttribute('data-l10n-id');
          elements.security.textContent = options.security;
          elements.securityType = options.security;
        } else {
          elements.security.setAttribute('data-l10n-id', 'securityNone');
        }

        this._dispatchDialogShowEvent();
        // panelready event should send after before show process.
        // to scorllintoview for first item.
        setTimeout(() => {
          this._initpanelready(this.getFocusItem());
        }, 0);

        WifiUtils.getCarrierName(elements);

        _updateSoftKey(_checkConnectSoftkeyState(options.security));

        window.addEventListener('enable-connect-softkey', _enableSoftKey);

        window.addEventListener('keydown', this.keydownHandler);

        document.addEventListener('visibilitychange', this.handleVisibiltychange);

        WifiContext.addEventListener('wifiStatusChange',
          this.onWifiStatusChange);
        WifiContext.addEventListener('wifiWrongPassword',
          this.openWrongPasswordDialog);
        WifiContext.addEventListener('wifiConnectingFailed',
          this.openConnetingFailedDialog);
        WifiContext.addEventListener('wifiObtainingIPFailed',
          this.openObtainingIPFailedDialog);
        window.addEventListener('dialog-panel-transit', this.handleTransit);
      },

      onHide: function() {
        elements.identity.value = '';
        elements.password.value = '';
        elements.showPassword.checked = false;
        backPrevious = false;
      },
      onBeforeHide: function() {
        _sendCustomEvent('dialogpanelhide', {
          detail: {
            dialogpanel: '#wifi-auth'
          }
        });

        window.removeEventListener('enable-connect-softkey', _enableSoftKey);

        window.removeEventListener('keydown', this.keydownHandler);

        document.removeEventListener('visibilitychange', this.handleVisibiltychange);
        WifiContext.removeEventListener('wifiStatusChange',
          this.onWifiStatusChange);
        WifiContext.removeEventListener('wifiWrongPassword',
          this.openWrongPasswordDialog);
        WifiContext.removeEventListener('wifiConnectingFailed',
          this.openConnetingFailedDialog);
        WifiContext.removeEventListener('wifiObtainingIPFailed',
          this.openObtainingIPFailedDialog);
        window.removeEventListener('dialog-panel-transit', this.handleTransit);
      },
      onSubmit: function() {
        return Promise.resolve({
          forget: forgetFlag
        });
      },
      _initpanelready: function(item) {
        _sendCustomEvent('panelready', {
          detail: {
            current: '#wifi-auth',
            previous: '#wifi-available-networks',
            needFocused: item
          }
        });
      },

      handleTransit() {
        this.getFocusItem().focus();
      },

      getFocusItem() {
        let item = null;
        if (elements.identity.parentNode.hidden !== true) {
          item = elements.identity.parentNode;
        } else if (elements.password.parentNode.hidden !== true) {
          item = elements.password.parentNode;
        } else {
          item = elements.security.parentNode;
        }

        return item;
      },

      _keydownHandler: function(e) {
        switch (e.key) {
          case 'Backspace':
            if (!elements.connectFlag){
              elements.resetButton.click();
            }
            break;
          case 'ArrowUp':
          case 'ArrowDown':
            if (elements.connectFlag) {
              _updateSoftKey(false, false, true);
            } else {
              var security = elements.panel.dataset.security;
              var item =
                elements.panel.querySelector('li.show-password.focus') ||
                elements.panel.querySelector('li.server-certificate.focus') ||
                elements.panel.querySelector('li.auth-phase2.focus') ||
                elements.panel.querySelector('li.eap.focus');
              if (item) {
                _updateSoftKey(_checkConnectSoftkeyState(security), true);
              } else {
                _updateSoftKey(_checkConnectSoftkeyState(security), false);
              }
            }
            break;
          default:
            break;
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
          backPrevious = true;
          elements.connectFlag = false;
          _wifiAuthPanelAriaDisable(false);
          _submitProcess();
        }
      },

      _openWrongPasswordDialog: function() {
        let bodyId = 'wifi-authentication-failed';
        if (elements.securityType === 'WPA-EAP') {
          bodyId = 'wifi-eap-authentication-failed';
        }
        this._openBadCredentialsDialog(bodyId);
      },

      _openConnetingFailedDialog: function() {
        this._openBadCredentialsDialog('wifi-association-reject');
      },

      _openObtainingIPFailedDialog: function() {
        this._openBadCredentialsDialog('wifi-DHCP-failed');
        backPrevious = true;
        _submitProcess();
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

        var security = elements.panel.dataset.security;
        var item = elements.panel.querySelector('li.show-password.focus');
        if (item) {
          _updateSoftKey(_checkConnectSoftkeyState(security), true);
        } else {
          _updateSoftKey(_checkConnectSoftkeyState(security), false);
        }

        elements.security.textContent = elements.securityType;
        elements.connectFlag = false;
        _wifiAuthPanelAriaDisable(false);
        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      },

      _handleVisibiltychange: function() {
        if (!document.hidden) {
          this._dispatchDialogShowEvent();
        }
      },

      _dispatchDialogShowEvent: function() {
        _sendCustomEvent('dialogpanelshow', {
          detail: {
            dialogpanel: '#' + elements.panel.id
          }
        });
      }
    });
  };
});
