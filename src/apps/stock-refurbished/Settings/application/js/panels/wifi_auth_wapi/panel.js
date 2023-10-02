define(['require','modules/settings_panel','modules/settings_service','modules/dialog_service','shared/device_storage/enumerate_all','shared/wifi_helper','modules/wifi_utils','modules/wifi_context'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var DialogService = require('modules/dialog_service');
  var EnumerateAll = require('shared/device_storage/enumerate_all');
  var WifiHelper = require('shared/wifi_helper');
  var wifiManager = WifiHelper.getWifiManager();
  var WifiUtils = require('modules/wifi_utils');
  var WifiContext = require('modules/wifi_context');

  return function ctor_authWapi() {
    var elements = {};
    var certificateFile = {};
    var listElements = document.querySelectorAll('#wifi-auth-wapi li');
    var list = document.querySelector('.wifi-availableNetworks');

    function _wifiAuthPanelAriaDisable(enabled) {
      let list = listElements;
      if (!list) {
        return;
      }

      for(let i = 0; i < list.length; i++) {
        if (list[i].hidden === false && enabled) {
          list[i].setAttribute('aria-disabled', true);
        } else if (list[i].hidden === false && !enabled) {
          list[i].removeAttribute('aria-disabled');
        }
      }

      let searchStr = '#wifi-auth-wapi li input';
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
            _updateSoftKey(false, false, true);
          },
        },
        confirm: {
          l10nId: 'forget',
          priority: 3,
          callback: function() {
            dialog.destroy();

            var network = {};
            var security = [elements.panel.dataset.security];

            network.ssid = elements.ssid.textContent;
            network.security = security;
            network.keyManagement = elements.panel.dataset.security;

            WifiContext.forgetNetwork(new window.MozWifiNetwork(network),
              function() {
                showToast('networkforget');
              });
            WifiUtils.toggleLogin = false;
            SettingsService.navigate('wifi-available-networks');
          },
        },
        backcallback: function() {
          dialog.destroy();
          _updateSoftKey(false, false, true);
        }
      };
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }



    function _enableSoftKey(evt) {
      _updateSoftKey(evt.detail.enabled);
    }

    function _updateSoftKey(enabled, csk, connecting) {
      var connect = {
        name: 'Connect',
        l10nId: 'device-option-connect',
        priority: 3,
        method: function() {
          elements.connectFlag = true;
          _wifiAuthPanelAriaDisable(true);
          _updateSoftKey(false, false, true);
          _connectNetwork();
        }
      };

      var select = {
        name: 'Select',
        l10nId: 'select',
        priority: 2,
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

      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: []
      };

      if (csk) {
        softkeyParams.items.push(select);
      }
      if (enabled && elements.ssid.textContent.length) {
        softkeyParams.items.push(connect);
      }

      if (connecting) {
        softkeyParams.items.push(forget);
      }

      if ((enabled || csk || connecting) && softkeyParams.items.length) {
        SettingsSoftkey.init(softkeyParams);
        SettingsSoftkey.show();
      } else {
        SettingsSoftkey.hide();
      }
    }

    function _initCertificateData() {
      navigator.mozSettings.createLock().set({
        'settings.wifi.certificatefile': null
      });

      certificateFile.fileASU = null;
      certificateFile.fileUser = null;

      var itemASU = elements.certificateASU.querySelector('small');
      var itemUser = elements.certificateUser.querySelector('small');
      var noneString = navigator.mozL10n.get('none');
      if (itemASU) {
        itemASU.textContent = noneString;
      }
      if (itemUser) {
        itemUser.textContent = noneString;
      }
    }

    function _connectNetwork() {
      var network = {};
      var security = [elements.panel.dataset.security];

      network.ssid = elements.ssid.textContent;
      network.security = security;
      network.keyManagement = elements.panel.dataset.security;

      if (elements.panel.dataset.security === 'WAPI-PSK') {
        network.wapi_psk = elements.password.value;
        network.pskType = elements.hexmode.checked ? 'HEX' : null;
      }
      if (elements.panel.dataset.security === 'WAPI-CERT') {
        network.wapiAsCertificate = certificateFile.fileASU;
        network.wapiUserCertificate = certificateFile.fileUser;
      }

      WifiContext.associateNetwork(new window.MozWifiNetwork(network));
      _initCertificateData();
    }

    function _keydownHandler(evt) {
      switch (evt.key) {
        case 'Backspace':
          if (!elements.connectFlag) {
            _initCertificateData();
            WifiUtils.toggleLogin = false;
            SettingsService.navigate('wifi-available-networks');
          }
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          if (elements.connectFlag) {
            _updateSoftKey(false, false, true);
          }
          break;
        default:
          break;
      }
    }

    function _handleFocus() {
      var input = elements.panel.querySelector('li.focus input');
      var select = elements.panel.querySelector('li.focus.csk-select');
      var enabled = _checkConnectSoftkeyState();
      if (input) {
        input.focus();
      }
      _updateSoftKey(enabled, select ? true : false);
    }

    function _parseFilename(path) {
      return path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
    }

    function _handleCertificateFile(fileName) {
      var _ = navigator.mozL10n.get;

      if (!fileName) {
        return;
      }

      var item = elements.panel.querySelector('li.focus span');
      if (item) {
        if (item.textContent === _('ASU-Certificate')) {
          certificateFile.fileASU = fileName;
          elements.certificateASU.querySelector('small').textContent =
            _parseFilename(fileName);
        } else if (item.textContent === _('User-Certificate')) {
          certificateFile.fileUser = fileName;
          elements.certificateUser.querySelector('small').textContent =
            _parseFilename(fileName);
        }
      }

      navigator.mozSettings.createLock().set({
        'settings.wifi.certificatefile': null
      });

      var enabled = _checkConnectSoftkeyState();
      var select = elements.panel.querySelector('li.focus.csk-select');
      if (enabled) {
        _updateSoftKey(enabled, select ? true : false);
      }
    }

    function _checkConnectSoftkeyState() {
      var noneString = navigator.mozL10n.get('none');
      var key = elements.securityType;
      var password = elements.password.value;

      if (key === 'WAPI-PSK' && password && password.length >= 8) {
        return true;
      }

      var itemASU = elements.certificateASU.querySelector('small');
      if (key === 'WAPI-CERT'
          && itemASU && itemASU.textContent !== noneString) {
        return true;
      }

      return false;
    }

    function _handleWifiNetwork(network) {
      var network = JSON.parse(network);
      WifiUtils.initializeAuthFields(elements.panel, network);
      WifiUtils.changeDisplay(elements.panel, network.security[0]);

      elements.panel.dataset.security = network.security[0];
      elements.ssid.textContent = network.ssid;
      elements.signal.setAttribute('data-l10n-id',
        'signalLevel' +
        Math.min(Math.floor(network.relSignalStrength / 20), 4));

      if (network.security[0]) {
        elements.security.removeAttribute('data-l10n-id');
        elements.security.textContent = network.security[0];
        elements.securityType = network.security[0];
      } else {
        elements.security.setAttribute('data-l10n-id', 'securityNone');
      }

      var enabled = _checkConnectSoftkeyState();
      if (enabled) {
        _updateSoftKey(enabled);
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          panel: panel,
          connectFlag:false,
          securityType: '',
          ssid: panel.querySelector('[data-ssid-auth-wapi]'),
          signal: panel.querySelector('[data-signal]'),
          security: panel.querySelector('[data-security]'),
          identity: panel.querySelector('input[name=identity]'),
          password: panel.querySelector('input[name=password]'),
          showPassword: panel.querySelector('input[name=show-pwd]'),
          eap: panel.querySelector('li.eap select'),
          authPhase2: panel.querySelector('li.auth-phase2 select'),
          keyIndex: panel.querySelector('li.key-index select'),
          certificate: panel.querySelector('li.server-certificate select'),
          hexmode: panel.querySelector('input[name=hexmode]'),
          certificateASU: panel.querySelector('li.ASU-Certificate'),
          certificateUser: panel.querySelector('li.User-Certificate')
        };

        this.onWifiStatusChange = this._onWifiStatusChange.bind(this);
        this.openWrongPasswordDialog = this._openWrongPasswordDialog.bind(this);
        this.openConnetingFailedDialog =
          this._openConnetingFailedDialog.bind(this);
        this.openObtainingIPFailedDialog =
          this._openObtainingIPFailedDialog.bind(this);
      },
      onBeforeShow: function(panel) {
        _updateSoftKey(_checkConnectSoftkeyState());
        _wifiAuthPanelAriaDisable(false);
        elements.connectFlag = false;

        if (NavigationMap.currentSection
          !== '#wifi-select-wlan-certificate-file') {
          SettingsListener.observe('settings.wifi.network', '',
            _handleWifiNetwork);
        }

        window.addEventListener('enable-connect-softkey', _enableSoftKey);
        window.addEventListener('keydown', _keydownHandler);
        WifiContext.addEventListener('wifiStatusChange',
          this.onWifiStatusChange);
        WifiContext.addEventListener('wifiWrongPassword',
          this.openWrongPasswordDialog);
        WifiContext.addEventListener('wifiConnectingFailed',
          this.openConnetingFailedDialog);
        WifiContext.addEventListener('wifiObtainingIPFailed',
          this.openObtainingIPFailedDialog);
        ListFocusHelper.addEventListener(listElements, _handleFocus);
        elements.password.value = '';
      },
      onShow: function() {
        SettingsListener.observe('settings.wifi.certificatefile', '',
          _handleCertificateFile);
      },
      onHide: function() {
        elements.identity.value = '';
        elements.password.value = '';
        elements.showPassword.checked = false;
      },
      onBeforeHide: function() {
        SettingsListener.unobserve('settings.wifi.network',
          _handleWifiNetwork);
        SettingsListener.unobserve('settings.wifi.certificatefile',
          _handleCertificateFile);

        window.removeEventListener('enable-connect-softkey', _enableSoftKey);
        window.removeEventListener('keydown', _keydownHandler);
        ListFocusHelper.removeEventListener(listElements, _handleFocus);
        WifiContext.removeEventListener('wifiStatusChange',
          this.onWifiStatusChange);
        WifiContext.removeEventListener('wifiWrongPassword',
          this.openWrongPasswordDialog);
        WifiContext.removeEventListener('wifiConnectingFailed',
          this.openConnetingFailedDialog);
        WifiContext.removeEventListener('wifiObtainingIPFailed',
          this.openObtainingIPFailedDialog);
      },

      _onWifiStatusChange: function(event) {
        let status = event.status;
        if (event.network.ssid !== elements.ssid.textContent) {
          return;
        }

        if (status === 'connecting' || status === 'associated') {
          elements.panel.querySelector('.wifi-security small').
            setAttribute('data-l10n-id', 'shortStatus-' + status);
        } else if (status === 'connected') {
          _wifiAuthPanelAriaDisable(false);
          elements.connectFlag = false;
          WifiUtils.toggleLogin = false;
          SettingsService.navigate('wifi-available-networks');
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
        var dialogConfig = {
          title: {
            id: 'wifi-bad-credentials-title',
            args: {}
          },
          body: {
            id: bodyId,
            args: {
              ssid: elements.ssid.textContent
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
      }
    });
  };
});
