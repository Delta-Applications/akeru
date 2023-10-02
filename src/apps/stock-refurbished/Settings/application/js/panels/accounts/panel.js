/* global SettingsSoftkey */
/**
 * Used to show about legal panel
 */
define(['require','modules/settings_panel','modules/settings_service','shared/settings_listener'],function (require) {
  
  let SettingsPanel = require('modules/settings_panel');
  let SettingsService = require('modules/settings_service');
  let SettingsListener = require('shared/settings_listener');

  return function ctor_accounts_panel() {
    let elements = null;
    let data = null;
    let mAccounts = null;
    let listElements = null;
    let _settings = window.navigator.mozSettings;
    let antitheft_KEY = 'antitheft.enabled';

    function _initSoftKey() {
      let softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function () {
          }
        }]
      };

      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    function onGetAccountsSuccess(e) {
      let accountId = "";
      let verified = false;

      if (e && e.phone) {
        accountId = e.phone;
        verified = true;
      } else if (e && Normalizer.escapeHTML(e.email)) {
        accountId = Normalizer.escapeHTML(e.email);
        verified = true;
      }

      if (!e) {
        elements.fxaDesc.setAttribute('data-l10n-id',
          'kaios-account-not-sign-in');
        elements.fxaDesc.removeAttribute('data-l10n-args');
        elements.antitheftMenuItem.setAttribute('aria-disabled', true);
        elements.antitheftMenuItem.classList.add('none-select');
        elements.antitheftNote1Item.classList.add('hidden');
        elements.antitheftNote2Item.classList.add('hidden');
        window.dispatchEvent(new CustomEvent('refresh'));
      } else if (verified) {
        navigator.mozL10n.setAttributes(elements.fxaDesc,
          'fxa-logged-in-text', {email: accountId});
        elements.antitheftMenuItem.removeAttribute('aria-disabled');
        elements.antitheftMenuItem.classList.remove('none-select');
        elements.antitheftNote1Item.classList.remove('hidden');
        elements.antitheftNote2Item.classList.remove('hidden');
        window.dispatchEvent(new CustomEvent('refresh'));
      } else { // unverified
        navigator.mozL10n.setAttributes(elements.fxaDesc,
          'fxa-confirm-email', {email: accountId});
      }

    }

    function onGetAccountsFailed(e) {
      elements.antitheftMenuItem.removeAttribute('aria-disabled');
      elements.antitheftMenuItem.classList.remove('none-select');
      elements.antitheftNote1Item.classList.remove('hidden');
      elements.antitheftNote2Item.classList.remove('hidden');
      window.dispatchEvent(new CustomEvent('refresh'));
    }

    function _setSettingValue(enabled) {
      let lock = _settings.createLock();
      let _option = {};
      _option[antitheft_KEY] = enabled;
      lock.set(_option);
    }

    function _setAntitheftStatus(evt) {
      let enabled = (evt.target.value === 'true') || false;
      if (!navigator.onLine) {
        showToast('fxa-no-internet-connection');
        elements.antitheftSelect.value = !enabled;

        return;
      }
      if (!enabled) {
        _setSettingValue(true);
        FxAccountsIACHelper.getAccounts(function onGetAccounts(accts) {
          if (!accts) {
            elements.antitheftSelect.value = true;
            return;
          }
          var account = _getValidAccount(accts);
          FxAccountsIACHelper.checkPassword(account, 'DisableAntitheft',
            function (data) {
              if (data && data.result === 'success') {
                _setSettingValue(enabled);
                showToast('changessaved');
              } else {
                elements.antitheftSelect.value = true;
              }
            }, function () {
            });
        }, function () {
        });
      } else {
        showToast('changessaved');
        _setSettingValue(true);
      }
    }

    function clear() {
      let rule = 'li:not(.add-account-button)';
      let operatorItems = elements.otherAccounts.querySelectorAll(rule);
      let len = operatorItems.length;

      for (let i = len - 1; i >= 0; i--) {
        elements.otherAccounts.removeChild(operatorItems[i]);
      }
      window.dispatchEvent(new CustomEvent('refresh'));
    }

    function newListItem(account, callback) {
      let name = document.createElement('span');
      name.textContent = account.accountId;
      name.classList.add('full-string');

      let a = document.createElement('a');
      a.appendChild(name);
      a.classList.add('menu-item');

      // create list item
      let li = document.createElement('li');
      li.appendChild(a);

      // bind connection callback
      li.onclick = function () {
        SettingsService.navigate('add-account-settings', {
          account: account
        });
      };
      return li;
    }

    function _showAddAccountList(evt) {
      if (evt.key === 'Enter') {
        SettingsService.navigate('add-account-list');
      }
    }

    function _updateAccountsDisplay() {
      if (data && data.action === 'onlogin') {
        if (!mAccounts.length) {
          debugInfo('login - ' + JSON.stringify(data));
          let listItem = newListItem(data);
          elements.otherAccounts.insertBefore(listItem, elements.addButton);
          let newAccount = {
            accountId: data.accountId,
            authenticatorId: data.authenticatorId
          };
          mAccounts.push(newAccount);
        } else {
          for (let account of mAccounts) {
            if (account.accountId !== data.accountId) {
              debugInfo('login - ' + JSON.stringify(data));
              let listItem = newListItem(data);
              elements.otherAccounts.insertBefore(listItem,
                elements.addButton);
              let newAccount = {
                accountId: data.accountId,
                authenticatorId: data.authenticatorId
              };
              mAccounts.push(newAccount);
              break;
            }
          }
        }
      } else if (data && data.action === 'onlogout') {
        let rule = 'li:not(.add-account-button)';
        let operatorItems =
          elements.otherAccounts.querySelectorAll(rule);
        let len = operatorItems.length;
        let i = 0;
        for (let account of mAccounts) {
          debugInfo('get - ' + JSON.stringify(account));
          if (account.accountId === data.accountId) {
            debugInfo('logout - ' + JSON.stringify(account));
            elements.otherAccounts.removeChild(operatorItems[i]);
            mAccounts.splice(i, 1);
            break;
          }
          i++;
        }
      }
      debugInfo('_updateAccountsDisplay(): ' + JSON.stringify(mAccounts));
      NavigationMap.refresh();
      ListFocusHelper.removeEventListener(listElements);
      listElements = elements.accountPanel.querySelectorAll('li');
      ListFocusHelper.addEventListener(listElements);
    }

    return SettingsPanel({
      onInit: function (panel) {
        elements = {
          fxaDesc: panel.querySelector('#fxa-desc'),
          addButton: panel.querySelector('.add-account-button'),
          otherAccounts: panel.querySelector('.other-accounts'),
          antitheftMenuItem: panel.querySelector('#antitheft_mode_switch'),
          antitheftNote1Item: panel.querySelector('#menuItem-antitheft-note1'),
          antitheftNote2Item: panel.querySelector('#menuItem-antitheft-note2'),
          antitheftSelect: panel.querySelector('#antitheft-mode-select'),
          accountPanel: panel
        };

        listElements = panel.querySelectorAll('li');
        LazyLoader.load([
          '/shared/js/fxa_iac_client.js',
          '/shared/js/text_normalizer.js'
        ], function fxa_iac_client_loaded() {
          FxAccountsIACHelper.getAccounts(onGetAccountsSuccess,
            onGetAccountsFailed);
          NavigationMap.refresh();
        });

        SettingsListener.observe('antitheft.enabled', false, (enabled) => {
          elements.antitheftSelect.value = enabled;
        });
      },
      onBeforeShow: function () {
        _initSoftKey();
        ListFocusHelper.addEventListener(listElements);

        navigator.accountManager.getAccounts().then((accounts) => {
          clear();
          for (let account of accounts) {
            debugInfo('getAccounts: ' + JSON.stringify(account));
            let listItem = newListItem(account);
            elements.otherAccounts.insertBefore(listItem, elements.addButton);
          }
          debugInfo('getAccounts resolved: length = ' + accounts.length);
          // Assign HERE
          mAccounts = accounts;
          window.dispatchEvent(new CustomEvent('refresh'));
          ListFocusHelper.removeEventListener(listElements);
          listElements = elements.accountPanel.querySelectorAll('li');
          ListFocusHelper.addEventListener(listElements);
        });

        elements.addButton.addEventListener('keydown', _showAddAccountList);
        navigator.accountManager.onchanged = function (event) {
          data = event.detail;
          debugInfo('RECEIVED onchanged event data = ' + JSON.stringify(data));
          if (data.action === 'onlogin' || data.action === 'onlogout') {
            _updateAccountsDisplay();
          }
        };

        elements.antitheftSelect.addEventListener('change',
          _setAntitheftStatus);
      },


      onBeforeHide: function () {
        elements.addButton.removeEventListener('keydown', _showAddAccountList);
        ListFocusHelper.removeEventListener(listElements);
        elements.antitheftSelect.removeEventListener('change',
          _setAntitheftStatus);

      }
    });
  };
});
