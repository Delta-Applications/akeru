
/* global SettingsSoftkey */
define('panels/wifi_join_hidden/panel',['require','modules/wifi_utils','shared/wifi_helper','modules/wifi_context','modules/settings_panel','modules/settings_service'],function(require) {
  
  var WifiUtils = require('modules/wifi_utils');
  var WifiHelper = require('shared/wifi_helper');
  var WifiContext = require('modules/wifi_context');
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var wifiManager = WifiHelper.getWifiManager();

  return function ctor_joinHiddenWifi() {
    var elements = {};
    var _network = {};
    var certificateFile = {};
    var connectFlag = false;

    function _keydownHandler(evt) {
      switch (evt.key) {
        case 'Enter':
          let input = document.querySelector('li.focus input');
          let enabled = _checkConnectSoftkeyState();
          if (input) {
            let cskFlag = input.name === 'show-pwd' ? true : false;

            input.focus();
            _updateSoftKey(enabled, cskFlag);
          }
          break;
        default:
          break;
      }
    }

    function _enableConnectSoftKey(evt) {
      _updateSoftKey(evt.detail.enabled);
    }

    function _updateSoftKey(enabled, csk) {
      var connect = {
        name: 'Connect',
        l10nId: 'device-option-connect',
        priority: 3,
        method: function() {
          _connectNetwork();
        }
      };

      var select = {
        name: 'Select',
        l10nId: 'select',
        priority: 2,
        method: function() {}
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
      if (enabled && elements.ssid.value.length) {
        softkeyParams.items.push(connect);
      }

      if ((enabled || csk) && softkeyParams.items.length) {
        SettingsSoftkey.init(softkeyParams);
        SettingsSoftkey.show();
      } else {
        SettingsSoftkey.hide();
      }
    }

    function _isNetworkMatch(network) {
      var currentNetworkSSID = elements.ssid.value;
      return currentNetworkSSID === network.ssid;
    }

    function _connectNetwork() {
      if (connectFlag) {
        return;
      }

      connectFlag = true;
      setTimeout(() => {
        connectFlag = false;
      }, 1000);

      // We have to keep these information in network object
      _network.ssid = elements.ssid.value;
      _network.hidden = true;

      var network;
      if (window.MozWifiNetwork !== undefined) {
        network = new window.MozWifiNetwork(_network);
      }

      if (elements.security.value === 'WAPI-CERT') {
        network.keyManagement = 'WAPI-CERT';
        network.wapiAsCertificate = certificateFile.fileASU;
        network.wapiUserCertificate = certificateFile.fileUser;
      } else{
        WifiHelper.setPassword(
          network,
          elements.password.value,
          elements.identity.value,
          elements.eap.value,
          elements.authPhase2.value,
          elements.certificate.value,
          elements.keyIndex.value - 1
        );

        if (elements.security.value === 'WAPI-PSK') {
          network.pskType = elements.hexmode.checked ? 'HEX' : null;
        }

        network.sim_num  =  WifiUtils.getSimNum(elements);
      }

      var callback = (result) => {
        if (result !== null && result.name === 'network not found') {
          _openBadCredentialsDialog('hidden-wifi-not-found');
        }
      };

      WifiContext.associateNetwork(network,callback);
    }

    function _wifiStatusChangeHandler(evt) {
      if (evt.status === 'connected' &&
        _isNetworkMatch(evt.network)) {
        showToast('hidden-wifi-connected');
        SettingsService.navigate('wifi-manageNetworks');
      }
    }

    function _openWrongPasswordDialog() {
      _openBadCredentialsDialog('wifi-incorrect-password');
    }

    function _openConnetingFailedDialog() {
      _openBadCredentialsDialog('wifi-association-reject');
    }

    function _openObtainingIPFailedDialog() {
      _openBadCredentialsDialog('wifi-DHCP-failed');
    }

    function _openBadCredentialsDialog(msgId) {
      var network = WifiContext.currentNetwork;
      var dialogConfig = {
        title: {
          id: 'wifi-bad-credentials-title',
          args: {}
        },
        body: {
          id: msgId,
          args: {
            ssid: (!network) ? {} : network.ssid
          }
        },
        accept: {
          name: 'OK',
          l10nId: 'ok',
          priority: 2,
          callback: function() {
            dialog.destroy();
          }
        }
      };

      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function _checkConnectSoftkeyState() {
      var noneString = navigator.mozL10n.get('none');
      var key = elements.security.value;
      var password = elements.password.value;
      var identity = elements.identity.value;
      var eap = elements.eap.value;

      var itemASU = elements.certificateASU.querySelector('small');
      var itemUser = elements.certificateUser.querySelector('small');
      if (elements.security.value === 'WAPI-CERT') {
        if (itemASU && itemASU.textContent !== noneString
            && itemUser && itemUser.textContent !== noneString) {
          return true;
        } else {
          return false;
        }
      }

      return WifiHelper.isValidInput(key, password, identity, eap);
    }

    function _onSecurityChange(evt) {
      let _ = navigator.mozL10n.get;
      let key =
        elements.security.value ? elements.security.value : _('security-none');
      if (key === _('security-none')) {
        elements.security.querySelectorAll('option')[0].selected = true;
      }

      elements.panel.dataset.security = key;
      WifiHelper.setSecurity(_network, [key]);
      WifiUtils.changeDisplay(elements.panel, key);
      WifiUtils.initializeAuthFields(elements.panel, _network);
      _updateSoftKey(_checkConnectSoftkeyState(), true);
      window.dispatchEvent(new CustomEvent('refresh'));
    }

    function _onSSIDchange(event) {
      // Bug 1082394, during composition, we should not change the input
      // value. Otherwise, the input value will be cleared unexpectedly.
      // Besides, it seems unnecessary to change input value before
      // composition is committed.
      if (event.isComposing) {
        return;
      }
      // Make sure ssid length is no more than 32 bytes.
      var str = elements.ssid.value;
      // Non-ASCII chars in SSID will be encoded by UTF-8, and length of
      // each char might be longer than 1 byte.
      // Use encodeURIComponent() to encode ssid, then calculate correct
      // length.
      var encoder = new TextEncoder('utf-8');
      while (encoder.encode(str).length > 32) {
        str = str.substring(0, str.length - 1);
      }
      if (str !== elements.ssid.value) {
        elements.ssid.value = str;
      }
      _updateSoftKey(_checkConnectSoftkeyState());
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
      if (enabled) {
        _updateSoftKey(enabled);
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          panel: panel,
          ssid: panel.querySelector('input[name="ssid"]'),
          security: panel.querySelector('select[name="security"]'),
          identity: panel.querySelector('input[name="identity"]'),
          password: panel.querySelector('input[name="password"]'),
          showPassword: panel.querySelector('input[name=show-pwd]'),
          eap: panel.querySelector('select[name="eap"]'),
          keyIndex: panel.querySelector('li.key-index select'),
          authPhase2: panel.querySelector('li.auth-phase2 select'),
          certificate: panel.querySelector('li.server-certificate select'),
          hexmode: panel.querySelector('input[name=hexmode]'),
          certificateASU: panel.querySelector('li.ASU-Certificate'),
          certificateUser: panel.querySelector('li.User-Certificate')
        };
        this.certificateFlag = false;
        this.panelreadyHandler = this._panelreadyHandler.bind(this);
        this.handleFocusChanged = this.proFocusChanged.bind(this);

        elements.password.parentNode.onfocus = () => {
          let cursorPosForInput = elements.password.value.length;

          elements.password.setSelectionRange(cursorPosForInput,
            cursorPosForInput);
        };
      },

      onBeforeShow: function(panel) {
        let _ = navigator.mozL10n.get;
        window.addEventListener('keydown', _keydownHandler);

        elements.ssid.addEventListener('input', _onSSIDchange);

        elements.security.addEventListener('change', _onSecurityChange);

        window.addEventListener('panelready', this.panelreadyHandler);

        window.addEventListener('enable-connect-softkey',
          _enableConnectSoftKey);

        WifiContext.addEventListener('wifiStatusChange',
          _wifiStatusChangeHandler);
        WifiContext.addEventListener('wifiWrongPassword',
          _openWrongPasswordDialog);
        WifiContext.addEventListener('wifiConnectingFailed',
          _openConnetingFailedDialog);
        WifiContext.addEventListener('wifiObtainingIPFailed',
          _openObtainingIPFailedDialog);
        document.addEventListener('focusChanged', this.handleFocusChanged);

        var input = document.querySelector('li.focus input');
        if (input !== null) {
          input && input.focus();
        }

        WifiUtils.getCarrierName(elements);

        if (NavigationMap.currentSection
          !== '#wifi-select-wlan-certificate-file') {
          elements.ssid.value = null;
          elements.security.value = _('security-none');
          _onSecurityChange.call(elements.security);
          _updateSoftKey(_checkConnectSoftkeyState());
        } else {
          _updateSoftKey(false, true);
          this.certificateFlag = true;
        }

        if (WifiUtils.wlanEnabled) {
          this.addWAPIOptions();
        } else {
          this.delWAPIOptions();
        }
      },

      onShow: function() {
        SettingsListener.observe('settings.wifi.certificatefile', '',
          _handleCertificateFile);
      },

      onBeforeHide: function() {
        elements.password.value = '';
        elements.identity.value = '';
        elements.showPassword.checked = false;


        window.removeEventListener('keydown', _keydownHandler);

        elements.ssid.removeEventListener('input', _onSSIDchange);

        elements.security.removeEventListener('change', _onSecurityChange);

        window.removeEventListener('panelready', this.panelreadyHandler);

        window.removeEventListener('enable-connect-softkey',
          _enableConnectSoftKey);

        WifiContext.removeEventListener('wifiStatusChange',
          _wifiStatusChangeHandler);
        WifiContext.removeEventListener('wifiWrongPassword',
          _openWrongPasswordDialog);
        WifiContext.removeEventListener('wifiConnectingFailed',
          _openConnetingFailedDialog);
        WifiContext.removeEventListener('wifiObtainingIPFailed',
          _openObtainingIPFailedDialog);
        SettingsListener.unobserve('settings.wifi.certificatefile',
          _handleCertificateFile);
        document.removeEventListener('focusChanged', this.handleFocusChanged);
      },

      proFocusChanged: function(event) {
        let input = event.detail.focusedElement.querySelector('input')

        let enabled = _checkConnectSoftkeyState();
        if (input) {
          let cskFlag = input.name === 'show-pwd' ? true : false;

          input.focus();
          _updateSoftKey(enabled, cskFlag);
        } else {
          _updateSoftKey(enabled, true);
        }
      },

      addWAPIOptions: function() {
        let selectStr = '#wifi-joinHidden .security-type select';
        let selectItem = elements.panel.querySelector(selectStr);

        if (!selectItem) {
          return;
        }

        let wapiPsk = document.createElement('option');
        wapiPsk.value = 'WAPI-PSK';
        wapiPsk.setAttribute('data-l10n-id', 'security-wapi-psk');
        selectItem.add(wapiPsk);

        let wapiCert = document.createElement('option');
        wapiCert.value = 'WAPI-CERT';
        wapiCert.setAttribute('data-l10n-id', 'security-wapi-cert');
        selectItem.add(wapiCert);
      },

      delWAPIOptions: function() {
        let selectStr = '#wifi-joinHidden .security-type select';
        let selectItem = elements.panel.querySelector(selectStr);

        if (!selectItem) {
          return;
        }

        let optionItem = selectItem.querySelectorAll('option');
        for (let i = 0; i < optionItem.length; i++) {
          if (optionItem[i].value === 'WAPI-PSK' ||
            optionItem[i].value === 'WAPI-CERT') {
            selectItem.removeChild(optionItem[i]);
          }
        }
      },

      _panelreadyHandler: function() {
        if (this.certificateFlag) {
          this.certificateFlag = false;
        } else {
          _updateSoftKey(_checkConnectSoftkeyState());
          elements.ssid.focus();
        }
      }
    });
  };
});
