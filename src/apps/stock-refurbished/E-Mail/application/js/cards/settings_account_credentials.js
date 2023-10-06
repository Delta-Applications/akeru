
define(['require','cards','l10n!','toaster','accounts_sync','./base','template!./settings_account_credentials.html'],function(require) {

let cards = require('cards'),
    mozL10n = require('l10n!'),
    toaster = require('toaster'),
    accountsSync = require('accounts_sync');

return [
  require('./base')(require('template!./settings_account_credentials.html')),
  {
    onArgs: function(args) {
      this.account = args.account;
      this.headerLabel.textContent = this.account.name;

      // If we're not using password auth, then hide the password box.
      if (this.account.authMechanism !== 'password') {
        this.passwordForm.classList.add('collapsed');
      }

      this.usernameNodeSpan.innerHTML = this.account.username;
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Backspace':
          e.preventDefault();
          if (!NavigationMap.configDialogShown()) {
            this.onBack();
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (!this.showPasswordNode.classList.contains('focus')) {
            e.stopPropagation();
          }
          break;
      }
    },

    updateSK: function() {
      let optCancel = {
        name: 'Cancel',
        l10nId: 'cancel',
        priority: 1,
        method: () => {
          this.onBack();
        }
      };
      let optSelect = {
        name: 'Select',
        l10nId: 'select',
        priority: 2
      };
      let optDeSelect = {
        name: 'Deselect',
        l10nId: 'deselect',
        priority: 2
      };
      let optSave = {
        name: 'Save',
        l10nId: 'opt-save',
        priority: 3,
        method: () => {
          this.onClickSave();
        }
      };
      let optReauth = {
        name: 'reauth',
        l10nId: 'settings-reauth',
        priority: 2,
        method: () => {
          this.onClickReauth();
        }
      };

      let params = [];
      params.push(optCancel);

      if (this.showPasswordNode.classList.contains('focus')) {
        if (this.showpasswordInputNode.checked) {
          params.push(optDeSelect);
        } else {
          params.push(optSelect);
        }
      }

      if (this.account.authMechanism === 'oauth2') {
        params.push(optReauth);
      } else if (this.passwordNode.value.length) {
        params.push(optSave);
      }
      NavigationMap.setSoftKeyBar(params);
    },

    onCardVisible: function(navDirection) {
      if (this.account.authMechanism === 'password') {
        const CARD_NAME = this.localName;
        const QUERY_CHILD = CARD_NAME + ' ' +
                            'li:not(.tng-account-server-username)';
        const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

        console.log(this.localName + '.onCardVisible, navDirection=' +
                    navDirection);
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('first');

        this.showpasswordInputNode.addEventListener('change', () => {
          this.passwordNode.type =
            this.showpasswordInputNode.checked ? 'text' : 'password';
          this.updateSK();
        });
      }

      this.updateSK();
      this.keydownHandler = this.handleKeyDown.bind(this);
      this.addEventListener('keydown', this.keydownHandler);
    },

    onFocusChanged: function(queryChild, index) {
      if (index === 0) {
        let pwdNode = this.passwordNode;
        let selEnd = pwdNode.value.length;
        pwdNode.focus();
        pwdNode.setSelectionRange(selEnd, selEnd);
      }
      this.updateSK();
    },

    onInfoInput: function(event) {
      this.updateSK();
    },

    onBack: function() {
      cards.removeCardAndSuccessors(this, 'animate', 1);
    },

    onClickSave: function() {
      let password = this.passwordNode.value;

      if (password) {
        if (navigator.connection.type === 'none') {
          toaster.toast({
            text: mozL10n.get('no-internet-connection')
          });
        } else {
          this.account.clearProblems(true, () => {
            this.account.modifyAccount({ password: password }, () => {
              accountsSync.changePassword(this.account.username,
                this.account.authenticatorId, password);
              this.account.clearProblems();
            });
            toaster.toast({
              text: mozL10n.get('password-saved')
            });
          });
          this.onBack();
        }
      }
    },

    onClickReauth: function() {
      let accountId = this.account.username;
      accountsSync.getAllAccounts().then((accounts) => {
        for (let account of accounts) {
          if (accountId === account.accountId) {
            let config = { refreshCredentials: true };
            accountsSync.getCredential(account, config).then(
              (credential) => {
                let tokens = {
                  accessToken: credential.access_token,
                  expireTimeMS: credential.expire_timestamp
                };
                this.account.clearProblems(true, () => {
                  this.account.modifyAccount({ oauthTokens: tokens }, () => {
                    // The user may have reauthed because they canceled an
                    // onbadlogin card but came here to try to fix the problem,
                    // so ask to clear problems if possible.
                    this.account.clearProblems();
                  });
                });
              }, (reason) => {
                console.error('Refresh oauth failed: ' + reason);
              });
            break;
          }
        }
      });

      this.onBack();
    },

    die: function() {
      this.removeEventListener('keydown', this.keydownHandler);
    }
  }
];
});
