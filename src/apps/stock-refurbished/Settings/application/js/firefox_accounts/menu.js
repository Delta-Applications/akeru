/* global FxAccountsIACHelper */
/* exported FxaMenu */



var FxaMenu = (function fxa_menu() {
  var fxaHelper,
    menuItem,
    menuStatus,
    hintShown;

  function init(helper) {
    // allow mock to be passed in for unit testing
    fxaHelper = helper || FxAccountsIACHelper;
    menuItem = document.getElementById('menuItem-fxa');
    menuStatus = document.getElementById('fxa-desc');

    // listen for status updates
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function refreshStatus() {
    fxaHelper.getAccounts(onStatusChange, onStatusError);
  }

  function onStatusChange(e) {
    var accountId = e ?
      Normalizer.escapeHTML(e.phone || e.email || e.accountId) :
      '';
    var selectItem = document.getElementById('antitheft_mode_switch');
    var note1 = document.getElementById('menuItem-antitheft-note1');
    var note2 = document.getElementById('menuItem-antitheft-note2');

    if (!accountId) {
      menuStatus.setAttribute('data-l10n-id', 'kaios-account-not-sign-in');
      menuStatus.removeAttribute('data-l10n-args');
      selectItem.setAttribute('aria-disabled', true);
      selectItem.classList.add('none-select');
      note1.classList.add('hidden');
      note2.classList.add('hidden');
    } else {
      navigator.mozL10n.setAttributes(menuStatus, 'fxa-logged-in-text', {
        email: accountId
      });
      selectItem.removeAttribute('aria-disabled')
      selectItem.classList.remove('none-select');
      note1.classList.remove('hidden');
      note2.classList.remove('hidden');
      if(!hintShown && e.phone && checkUpdatePhone(e.phone)) {
        showUpdateHint(e);
        hintShown = true;
      }
    }
  }

  function onStatusError(err) {
    console.error('FxaMenu: Error getting Firefox Account: ' + err.error);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      fxaHelper.removeEventListener('onlogin', refreshStatus);
      fxaHelper.removeEventListener('onverified', refreshStatus);
      fxaHelper.removeEventListener('onlogout', refreshStatus);
    } else {
      fxaHelper.addEventListener('onlogin', refreshStatus);
      fxaHelper.addEventListener('onverified', refreshStatus);
      fxaHelper.addEventListener('onlogout', refreshStatus);
      refreshStatus();
    }
  }

  function checkUpdatePhone(phone) {
    let changed = false;
    if (!phone) {
      return changed;
    }

    let _loadPhoneNumber = function() {
      let phoneNumbers = [];
      let _conns = navigator.mozMobileConnections;
      if (!_conns) {
        return phoneNumbers;
      }

      let phoneNumber = null;

      Array.prototype.forEach.call(_conns, conn => {
        let iccId = conn.iccId;
        if (!iccId) {
          return;
        }

        let iccObj = navigator.mozIccManager.getIccById(iccId);
        if (!iccObj) {
          return;
        }

        let iccInfo = iccObj.iccInfo;
        if (!iccInfo) {
          return;
        }

        phoneNumber = iccInfo.msisdn || iccInfo.mdn;
        if (phoneNumber) {
          if (phoneNumber.indexOf('+') !== 0) {
            phoneNumber = '+' + phoneNumber;
          }
          phoneNumbers.push(phoneNumber);
        }
      });

      return phoneNumbers;
    }
    let phoneNumbers = _loadPhoneNumber();
    if (phoneNumbers.length > 0 && phoneNumbers.indexOf(phone) === -1) {
      changed = true;
    }

    return changed;
  }

  function showUpdateHint(accts) {
    var dialogConfig = {
      title: {
        id: 'phone-update',
        args: {}
      },
      body: {
        id: 'phone-number-changed',
        args: {}
      },
      backcallback: function() {
      },
      cancel: {
        name: 'cancel',
        l10nId: 'cancel',
        priority: 1,
        callback: function() {
        }
      },
      confirm: {
        name: 'update',
        l10nId: 'update',
        priority: 3,
        callback: function() {
          var account = _getValidAccount(accts);
          fxaHelper.checkPassword(account, 'phone', function(result) {
            if (result && result.success) {
              showHint('fxa-phone-number-updated');
            }
          }, onStatusError);
        }
      }
    };

    var dialog = new ConfirmDialogHelper(dialogConfig);
    dialog.show(document.getElementById('app-confirmation-dialog'));
  }

  function showHint(message) {
    var dialogConfig = {
      title: { id: 'confirmation', args: {} },
      body: { id: message, args: {} },
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
  }

  function updateAccount (accts) {
    var contact = accts.phone || accts.email || accts.accountId;
    if (!contact) {
      return;
    }
    navigator.mozL10n.setAttributes(menuStatus, 'fxa-logged-in-text', {
      email: contact
    });
  }

  return {
    init: init,
    updateAccount: updateAccount,
  };
})();