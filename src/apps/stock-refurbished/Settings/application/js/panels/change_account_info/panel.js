define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function ctor_support_panel() {
    var self = null;
    var account = null;
    var saved = false;

    function _updateSoftKey() {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          method: function() {
            _updateUI();
            SettingsService.navigate('add-account-settings', {
              account : account
            });
          }
        }, {
          name: 'Save',
          l10nId: 'save',
          priority: 3,
          method: function() {
            _changePassword(account, self.password.value);
          }
        }]
      };
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    function _changePassword(account, password) {
      if (!navigator.onLine) {
        showErrorDialog('no network');
      } else {
        if (saved) {
          return;
        }
        self.progressBar.hidden = false;
        self.changePwdPage.hidden = true;
        SettingsSoftkey.hide();
        saved = true;
        navigator.accountManager.reauthenticate(account, {
          password: password
        }).then(
          (result) => {
            debugInfo('reauthenticate resolved');
            showToast('password-saved');
            self.progressBar.hidden = true;
            self.changePwdPage.hidden = false;
            _updateUI();
            saved = false;
            SettingsService.navigate('add-account-settings', {
              account : account
            });
          }, (reason) => {
            debugInfo('reauthenticate rejected: ' + reason);
            showErrorDialog(reason);
            self.progressBar.hidden = true;
            self.changePwdPage.hidden = false;
            SettingsSoftkey.show();
            _updateChangeAccountInfoDisplay();
            saved = false;
          }
        )
      }
    }

    function _updateChangeAccountInfoDisplay() {
      self.header.setAttribute('data-l10n-id', 'incorrect-password');
      self.usernameItem.hidden = true;
      self.incorrectPwdDesc.hidden = false;
      _updateUI();
      NavigationMap.refresh();
    }

    function _updateShowPasswordDisplay() {
      self.showPasswordItem.hidden = false;
      NavigationMap.refresh();
    }

    function _clickHandler(evt) {
      if (self.showPassword.checked) {
        self.password.type = 'text';
      } else {
        self.password.type = 'password';
      }
    }

    function _updateUI() {
      self.password.value = '';
      self.password.type = 'password';
      self.showPassword.checked = false;
      self.showPasswordItem.hidden = true;
    }

    function _keydownHandler(evt) {
      if (evt.key === 'Backspace') {
        _updateUI();
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        this.header = panel.querySelector('#account-header');
        this.username = panel.querySelector('.account-username');
        this.password = panel.querySelector('input[name=password]');
        this.showPassword = panel.querySelector('input[name=show-pwd]');
        this.showPasswordItem = panel.querySelector('.show-password');
        this.usernameItem = panel.querySelector('.user-name');
        this.incorrectPwdDesc = panel.querySelector('.incorrect-name-desc');
        this.progressBar = panel.querySelector('#save-password-progress');
        this.changePwdPage = panel.querySelector('#change-password-page');
        self = this;
        this.password.parentNode.onfocus = function() {
          self.password.focus();
          self.password.selectionStart = self.password.value.length;
        };
      },

      onBeforeShow: function(panel, options) {
        this.header.textContent = options.account.accountId;
        this.username.textContent = options.account.accountId;
        this.progressBar.hidden = true;
        this.changePwdPage.hidden = false;
        this.usernameItem.hidden = false;
        this.incorrectPwdDesc.hidden = true;
        account = options.account;

        _updateSoftKey();
        this.password.addEventListener('input', _updateShowPasswordDisplay);
        this.showPassword.addEventListener('click', _clickHandler);
        window.addEventListener('keydown', _keydownHandler);
      },

      onBeforeHide: function() {
        this.password.removeEventListener('input', _updateShowPasswordDisplay);
        this.showPassword.removeEventListener('click', _clickHandler);
        window.removeEventListener('keydown', _keydownHandler);
      }
    });
  };
});
