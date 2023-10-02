define(['require','modules/settings_panel','modules/settings_service','modules/apps_cache'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var AppsCache = require('modules/apps_cache');

  return function ctor_support_panel() {
    const calendarSyncKey = 'calendarSyncEnable';
    const contactsSyncKey = 'contactsSyncEnable';
    const emailSyncKey = 'emailSyncEnable';
    var settings = window.navigator.mozSettings;
    var self = null;
    var account = null;

    var skSelect = {
      name: 'Select',
      l10nId: 'select',
      priority: 2,
      method: function() {
        var focusItem = document.querySelector('#add-account-settings .focus');
        if (focusItem.id !== 'account-info') {
          updateSyncInfo(account);
        }
      }
    };

    var skDeSelect = {
      name: 'Deselect',
      l10nId: 'deselect',
      priority: 2,
      method: function() {
        showDeselectDialog(account);
      }
    };

    var skDeleteAccount = {
      name: 'DeleteAccount',
      l10nId: 'deleteaccount',
      priority: 1,
      method: function() {
        showDeleteDialog(account);
      }
    };

    var softkeyDeselParams = {
      menuClassName: 'menu-button',
      header: { l10nId:'message' },
      items: [skDeleteAccount, skDeSelect]
    };

    var softkeySelParams = {
      menuClassName: 'menu-button',
      header: { l10nId:'message' },
      items: [skDeleteAccount, skSelect]
    };

    function updateSyncInfo(account) {
      var focusItem =
        document.querySelector('#add-account-settings .focus input');
      debugInfo('updateSyncInfo() - focusItem checked='+focusItem.checked);
      var checked = !focusItem.checked;
      debugInfo('updateSyncInfo() - checked='+checked);
      switch (focusItem.name) {
        case 'sync-canlendar':
          updateCalendarSyncInfo(account, checked);
          break;
        case 'sync-contacts':
          updateContactsSyncInfo(account, checked);
          break;
        case 'sync-email':
          updateEmailSyncInfo(account, checked);
          break;
        default:
          break;
      }
    }

    function updateCalendarSyncInfo(account, checked) {
      var accountId = account.accountId;
      settings.createLock().get(calendarSyncKey).then((result) => {
        if (result[calendarSyncKey]) {
          self.calendarSync = result[calendarSyncKey];
          self.calendarSync[accountId] = checked;
          let syncInfo = {};
          syncInfo[calendarSyncKey] = self.calendarSync;
          settings.createLock().set(syncInfo);
        }
        self.calendarSyncSwitch.checked = checked;
        updateSoftKey();
      });
    }

    function updateContactsSyncInfo(account, checked) {
      var accountId = account.accountId;
      settings.createLock().get(contactsSyncKey).then((result) => {
        if (result[contactsSyncKey]) {
          self.contactsSync = result[contactsSyncKey];
          self.contactsSync[accountId] = checked;
          let syncInfo = {};
          syncInfo[contactsSyncKey] = self.contactsSync;
          settings.createLock().set(syncInfo);
        }
        self.contactsSyncSwitch.checked = checked;
        updateSoftKey();
      });
    }

    function updateEmailSyncInfo(account, checked) {
      var accountId = account.accountId;
      settings.createLock().get(emailSyncKey).then((result) => {
        if (result[emailSyncKey]) {
          self.emailSync = result[emailSyncKey];
          self.emailSync[accountId] = checked;
          let syncInfo = {};
          syncInfo[emailSyncKey] = self.emailSync;
          settings.createLock().set(syncInfo);
        }
        self.emailSyncSwitch.checked = checked;
        updateSoftKey();
      });
    }

    function updateSoftKey() {
      var focusItem =
        document.querySelector('#add-account-settings .focus input');
      var focusChecked = focusItem ? focusItem.checked : false;
      SettingsSoftkey.init(focusChecked ?
        softkeyDeselParams : softkeySelParams);
      SettingsSoftkey.show();
    }

    function showDeselectDialog(account) {
      var dialogConfig = {
        title: {
          id: 'turn-off-sync',
          args: {}
        },
        body: {
          id: 'turn-off-sync-description',
          args: {}
        },
        cancel: {
          name: 'No',
          l10nId: 'no',
          priority: 1,
          callback: function() {}
        },
        confirm: {
          name: 'Yes',
          l10nId: 'yes',
          priority: 3,
          callback: function() {
            updateSyncInfo(account);
          }
        },
      };
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function showDeleteDialog(account) {
      var dialogConfig = {
        title: {
          id: 'delete-account',
          args: {}
        },
        body: {
          id: 'delete-account-description',
          args: {}
        },
        cancel: {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          callback: function() {}
        },
        confirm: {
          name: 'Delete',
          l10nId: 'delete',
          priority: 3,
          callback: function() {
            navigator.accountManager.logout(account).then((result) => {
              debugInfo('logout resolved: ' + JSON.stringify(result));
              SettingsService.navigate('root');
            }, (reason) => {
              debugInfo('logout rejected: ' + reason);
              showErrorDialog(reason);
            });
          }
        },
      };
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function _getSetting(settingKey) {
      return new Promise(function (resolve, reject) {
        navigator.mozSettings.createLock().get(settingKey).then(
          (result) => {
            resolve(result[settingKey]);
          });
      });
    }

    function getSyncInfo(account) {
      let p1 = _getSetting(calendarSyncKey);
      let p2 = _getSetting(contactsSyncKey);
      let p3 = _getSetting(emailSyncKey);
      Promise.all([p1, p2, p3]).then((values) => {
        let calendarValues = values[0];
        let contactsValues = values[1];
        let emailValues = values[2];
        for (var key in calendarValues) {
          debugInfo('result['+key+']='+calendarValues[key]);
          if (key === account.accountId) {
            self.calendarSyncSwitch.checked = calendarValues[key];
          }
        }

        for (var key in contactsValues) {
          debugInfo('result['+key+']='+contactsValues[key]);
          if (key === account.accountId) {
            self.contactsSyncSwitch.checked = contactsValues[key];
          }
        }

        for (var key in emailValues) {
          debugInfo('result['+key+']='+emailValues[key]);
          if (key === account.accountId) {
            self.emailSyncSwitch.checked = emailValues[key];
          }
        }
        updateSoftKey();
      });
    }

    function _changeAccountInfo(evt) {
      if (evt.key === 'Enter') {
       SettingsService.navigate('change-account-info', {
         account : account
       });
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        this.header = panel.querySelector('#account-header');
        this.elements = panel.querySelectorAll('li');
        this.calendarSyncSwitch =
          panel.querySelector('input[name="sync-canlendar"]');
        this.contactsSyncSwitch =
          panel.querySelector('input[name="sync-contacts"]');
        this.emailSyncSwitch =
          panel.querySelector('input[name="sync-email"]');
        this.accountInfo = panel.querySelector('#account-info');
        this.accountInfoHeader = panel.querySelector('#account-info-header');
        this.calendarSync = {};
        this.contactsSync = {};
        this.emailSync = {};
        self = this;
        AppsCache.apps().then(function (apps) {
          let emailExit = false;
          let calendarExit = false;
          for (let i = 0; i < apps.length; i++) {
            if (apps[i].origin === 'app://email.gaiamobile.org') {
              emailExit = true
            } else if (apps[i].origin === 'app://calendar.gaiamobile.org') {
              calendarExit = true;
            }
            if (emailExit && calendarExit) {
              break;
            }
          }
          if (!emailExit) {
            let emailLi = this.emailSyncSwitch.parentNode.parentNode;
            emailLi.hidden = true;
          }
          if (!calendarExit) {
            let calendarLi = this.calendarSyncSwitch.parentNode.parentNode;
            calendarLi.hidden = true;
          }
        }.bind(this));

        if (window.ActivityHandler) {
          this.header.parentNode.setAttribute('data-href', '#accounts');
        }

      },
      onBeforeShow: function(panel, options) {
        this.header.textContent = options.account.accountId;
        if (options.account.authenticatorId === 'activesync') {
          this.accountInfoHeader.hidden = false;
          this.accountInfo.hidden = false;
        } else {
          this.accountInfoHeader.hidden = true;
          this.accountInfo.hidden = true;
        }
        this.calendarSyncSwitch.checked = false;
        this.contactsSyncSwitch.checked = false;
        this.emailSyncSwitch.checked = false;
        account = options.account;
        getSyncInfo(options.account);
        this.accountInfo.addEventListener('keydown', _changeAccountInfo);
      },

      onShow: function() {
        var i = this.elements.length - 1;
        for (i; i >= 0; i--) {
          this.elements[i].addEventListener('focus', updateSoftKey);
        }
      },

      onBeforeHide: function() {
        var i = this.elements.length - 1;
        for (i; i >= 0; i--) {
          this.elements[i].removeEventListener('focus', updateSoftKey);
        }
        this.accountInfo.removeEventListener('keydown', _changeAccountInfo);
      }
    });
  };
});
