
define(['require','tmpl!./tng/account_settings_server.html','evt','l10n!','cards','toaster','accounts_sync','./base','template!./settings_account.html','./editor_mixins','./account_prefs_mixins'],function(require) {

let tngAccountSettingsServerNode =
                             require('tmpl!./tng/account_settings_server.html'),
    evt = require('evt'),
    mozL10n = require('l10n!'),
    cards = require('cards'),
    toaster = require('toaster'),
    accountsSync = require('accounts_sync'),
    trailingRegExp = /\s+$/;

return [
  require('./base')(require('template!./settings_account.html')),
  require('./editor_mixins'),
  require('./account_prefs_mixins'),
  {
    onArgs: function(args) {
      this.account = args.account;
      this.identity = this.account.identities[0];

      this.headerLabel.textContent = args.account.name;
      this.signatureNode.innerHTML = '<br>';

      this._bindPrefs('tng-account-check-interval',
                      'tng-notify-mail',
                      'tng-sound-onsend',
                      'tng-signature-enable',
                      'signature-box',
                      'account-label');

      this.accountNameNode.textContent =
          (this.identity && this.identity.name) || this.account.name;

      // ActiveSync, IMAP and SMTP are protocol names, no need to be localized
      this.accountTypeNode.textContent =
        (this.account.type === 'activesync') ? 'ActiveSync' :
        (this.account.type === 'imap+smtp') ? 'IMAP+SMTP' : 'POP3+SMTP';

      // Handle default account checkbox. If already a default, then the
      // checkbox cannot be unchecked. The default is changed by going to an
      // account that is not the default and checking that checkbox.
      if (this.account.isDefault) {
        this.defaultInputNode.disabled = true;
        this.defaultInputNode.checked = true;
      } else {
        this.defaultLabelNode.addEventListener('click',
                                      this.onChangeDefaultAccount.bind(this),
                                      false);
      }

      if (this.account.type === 'activesync') {
        this.synchronizeNode.value = this.account.syncRange;
      } else {
        // Remove it from the DOM so that css selectors for last-child can work
        // efficiently. Also, it just makes the overall DOM smaller.
        this.syncSettingNode.parentNode.removeChild(this.syncSettingNode);
      }

      this.account.servers.forEach((server, index) => {
        let serverNode = tngAccountSettingsServerNode.cloneNode(true);
        let serverLabel = serverNode.querySelector('.tng-account-server-label');

        mozL10n.setAttributes(serverLabel,
                              'settings-' + server.type + '-label');
        serverLabel.addEventListener('click',
          this.onClickServers.bind(this, index), false);

        this.serversContainer.appendChild(serverNode);
      });

      let credL10nId = 'settings-account-userpass';
      if (this.account.authMechanism === 'oauth2') {
        credL10nId = 'settings-account-useroauth2';
      }
      mozL10n.setAttributes(this.accountCredNode, credL10nId);

      this._bindEditor(this.signatureNode);
      this.dataChanged = false;

      let accountSyncSwitch = accountsSync.syncSwitch;
      if (args.account.name in accountSyncSwitch &&
        (args.account.type === 'activesync' || args.account.authMechanism === 'oauth2')) {
        if (accountSyncSwitch[args.account.name]) {
          this.defaultSyncNode.setAttribute('checked', true);
        } else {
          this.defaultSyncNode.removeAttribute('checked');
          this.defaultInputNode.disabled = true;
        }
      } else {
        this.syncAccountNode.parentNode.classList.add('collapsed');
      }
      this.defaultSyncNode.addEventListener('click', this.onChangeSyncAccount.bind(this), false);
    },

    onBack: function() {
      cards.removeCardAndSuccessors(this, 'animate', 1);
    },

    updateFocusList: function() {
      NavigationMap.navSetup('cards-settings-account',
          'cards-settings-account ul li:not(.collapsed):not(.hidden)');
    },

    handleKeyDown: function(evt) {
      switch (evt.key) {
        case 'Accept':
        case 'Enter':
          let selectEl =
              document.querySelector('.scrollregion-below-header .focus select');
          if (selectEl) {
            selectEl.focus();
          }
          break;
        case 'Backspace':
          evt.preventDefault();
          if (NavigationMap.configDialogShown()) {
            cards._endKeyClicked = false;
          } else {
            this.onBack();
          }
          break;
      }

      if (evt.key === 'ArrowUp' || evt.key === 'ArrowDown') {
        setTimeout(() => {
          this.updateCsk();
        }, 0);
      }
    },

    updateCsk: function() {
      if (document.activeElement.classList.contains('no-select')) {
        if (document.activeElement.classList.contains('signature-box')) {
          window.option.buttonCsk.textContent = mozL10n.get('enter');
        } else {
          window.option.buttonCsk.textContent = '';
        }
      } else {
        window.option.buttonCsk.textContent = mozL10n.get('select');
      }
    },

    handleEndkey: function(e) {
      let cb = e.detail.callback;
      if (this.dataChanged) {
        let dialogConfig = {
          title: {
            id: 'confirmation-title',
            args: {}
          },
          body: {
            id: 'leave-this-page-warning-message',
            args: {}
          },
          cancel: {
            l10nId: 'cancel',
            priority: 1,
            callback: () => {
              cards._endKeyClicked = false;
            }
          },
          confirm: {
            l10nId: 'discard',
            priority: 3,
            callback: () => {
              cb();
            }
          }
        };
        NavigationMap.showConfigDialog(dialogConfig);
      } else {
        cb();
      }
    },

    onBodyNodeKeydown: function(evt) {
      let range = window.getSelection().getRangeAt(0);
      let currentElement = range.startContainer;

      switch (evt.key) {
        case 'ArrowUp':
          if ((currentElement === document.activeElement ||
              currentElement === document.activeElement.firstChild) &&
              (range.startOffset === 0 ||
              currentElement.textContent.length === 0)) {
            break;
          }
          evt.stopPropagation();
          break;
        case 'ArrowDown':
          if ((currentElement === document.activeElement && isLastLine(range))
              || isLastNode(range)) {
            break;
          }
          evt.stopPropagation();
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          break;
      }

      function isLastLine(range) {
        if (document.activeElement.lastChild.tagName === 'BR' &&
            range.startOffset === (document.activeElement.childNodes.length - 1)
        ) {
          return true;
        } else if (range.startOffset ===
            document.activeElement.childNodes.length) {
          return true;
        }
        return false;
      }

      function isLastNode(range) {
        return range.startOffset === range.startContainer.length;
      }
    },

    getTextFromEditor: function() {
      return this.fromEditor().replace(trailingRegExp, '');
    },

    onInfoInput: function(event) {
      this.dataChanged = true;
      this.updateSK();
    },

    updateSK: function() {
      let str = '';
      let strId = '';

      if (document.activeElement.classList.contains('signature-box')) {
        str = 'Enter';
        strId = 'enter';
      } else if (!document.activeElement.classList.contains('no-select')) {
        str = 'Select';
        strId = 'select';
      }
      let optDelete = {
        name: 'Delete Account',
        l10nId: 'settings-account-delete',
        priority: 1,
        method: () => {
          this.onDelete();
        }
      };

      let optEnter = {
        name: str,
        l10nId: strId,
        priority: 2
      };

      let optNext = {
        name: 'Save',
        l10nId: 'opt-save',
        priority: 3,
        method: () => {
          this.saveFn();
        }
      };

      let params = [optDelete, optEnter];
      if (this.accountLabelNode.value.trim().length) {
        params.push(optNext);
      }
      NavigationMap.setSoftKeyBar(params);
    },

    saveFn: function() {
      let signature = this.getTextFromEditor();
      let accountLabel = this.accountLabelNode.value.trim();

      // Only push the signature if it was changed
      if (signature !== this.identity.signature) {
        this.identity.modifyIdentity({ signature: signature });
      }

      if (accountLabel !== this.account.label) {
        this.account.modifyAccount({ label: accountLabel });
      }

      cards.removeCardAndSuccessors(this, 'animate', 1);
    },

    onCardVisible: function(navDirection) {
      const CARD_NAME = this.localName;
      const QUERY_CHILD = CARD_NAME + ' ' + 'ul li:not(.collapsed):not(.hidden)';
      const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

      let menuOptions = [
      {
        name: 'Delete Account',
        l10nId: 'settings-account-delete',
        priority: 1,
        method: () => {
          this.onDelete();
        }
      },
      {
        name: 'Select',
        l10nId: 'select',
        priority: 2
      },
      {
        name: 'Save',
        l10nId: 'opt-save',
        priority: 3,
        method: () => {
          this.saveFn();
        }
      }];
      this.keydownHandler = this.handleKeyDown.bind(this);
      // forward: new card pushed
      if (navDirection === 'forward') {
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('first');
        NavigationMap.setSoftKeyBar(menuOptions);
        this.addEventListener('keydown', this.keydownHandler);
      }
      // back: hidden card is restored
      else if (navDirection === 'back') {
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('restore');
        NavigationMap.setSoftKeyBar(menuOptions);
      }
      NavigationMap.cardContentHeight =
        document.querySelector('.scrollregion-below-header').clientHeight;

      document.addEventListener('update-list', this.updateFocusList);
      this.endkeyHandler = this.handleEndkey.bind(this);
      window.addEventListener('email-endkey', this.endkeyHandler);

      let signatureNode = document.querySelector('.signature-box');
      let signatureNodeParentLi =
          document.querySelector('.settings-account-signature');
      signatureNodeParentLi.addEventListener('focus', (evt) => {
        signatureNode.focus();
        if (evt.relatedTarget &&
            !evt.relatedTarget.classList.contains('signature-box')) {
          let selection = window.getSelection();
          let range = document.createRange();
          let lastChild = signatureNode.lastElementChild;
          if (lastChild.nodeName === 'BR') {
            range.setStartBefore(lastChild);
          } else {
            range.setStartAfter(lastChild);
          }
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });

      this.accountLabelNode.parentNode.addEventListener('focus', () => {
        this.accountLabelNode.focus();
        this.accountLabelNode.setSelectionRange(9999, 9999);
      });

      Promise.resolve().then(function() {
        if (document.activeElement.classList.contains('no-select')) {
          window.option.buttonCsk.textContent = '';
        }
      });

      this.updateSK();
    },

    onClickCredentials: function() {
      cards.pushCard(
        'settings_account_credentials', 'animate',
        {
          account: this.account
        },
        'right');
    },

    onClickServers: function(index) {
      let focused = document.querySelector('.focus');
      if (focused) {
        focused.classList.remove('focus');
      }
      cards.pushCard(
        'settings_account_servers', 'animate',
        {
          account: this.account,
          index: index
        },
        'right');
    },

    onChangeDefaultAccount: function(event) {
      event.stopPropagation();
      if (event.preventBubble) {
        event.preventBubble();
      }

      if (!this.defaultInputNode.disabled) {
        this.defaultInputNode.disabled = true;
        this.defaultInputNode.checked = true;
        this.account.modifyAccount({ setAsDefault: true });
      }
    },

    onChangeSynchronize: function(event) {
      this.account.modifyAccount({ syncRange: event.target.value });
    },

    onChangeSyncAccount: function(event) {
      const emailSyncKey = 'emailSyncEnable';
      let settings = window.navigator.mozSettings;
      let checked = this.defaultSyncNode.checked;

      event.stopPropagation();
      if (event.preventBubble) {
        event.preventBubble();
      }
      if (checked) {
        this.defaultInputNode.disabled = false;
      } else {
        this.defaultInputNode.disabled = true;
        this.defaultInputNode.checked = false;
      }
      settings.createLock().get(emailSyncKey).then((result) => {
        if (result[emailSyncKey]) {
          let syncInfo = result;
          let value = result[emailSyncKey];
          value[this.account.name] = checked;
          syncInfo[emailSyncKey] = value;
          settings.createLock().set(syncInfo);
        }
      });
    },

    onDelete: function() {
      let account = this.account;

      let dialogConfig = {
        title: {
          id: 'confirm-dialog-title',
          args: {}
        },
        body: {
          id: 'settings-account-delete-prompt',
          args: {
            account: account.name
          }
        },
        desc: {
          id: 'settings-account-delete-desc',
          args: {}
        },
        cancel: {
          l10nId: 'settings-account-delete-cancel',
          priority: 1
        },
        confirm: {
          l10nId: 'settings-account-delete-confirm',
          priority: 3,
          callback: () => {
            account.deleteAccount();
            this.removeNotification(this.account.id);
            cards.removeCardAndSuccessors(this, 'none', 1);
            setTimeout(() => {
              evt.emit('accountDeleted', account);
              toaster.toast({
                text: mozL10n.get('account-deleted')
              });
            }, 100);
          }
        }
      };
      NavigationMap.showConfigDialog(dialogConfig);

      setTimeout(() => {
        document.querySelector('#confirm-dialog-container' +
                               ' .noborder').style.color = '#657073';
      }, 80);
    },

    removeNotification(accountId) {
      if (typeof Notification !== 'undefined' && Notification.get) {
        Notification.get().then((notifications) => {
          if (notifications) {
            notifications.some((notification) => {
              if (notification.tag === accountId && notification.close) {
                notification.close();
                return true;
              }
            });
          }
        });
      }
    },

    die: function() {
      this.removeEventListener('keydown', this.keydownHandler);
      document.removeEventListener('update-list', this.updateFocusList);
      window.removeEventListener('email-endkey', this.endkeyHandler);
    }
  }
];
});
