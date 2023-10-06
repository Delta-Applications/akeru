/**
 * Asks the user to manually configure their account.
 */
/*jshint nonew: false */
/*global MozActivity */

define(['require','cards','evt','./base','template!./setup_manual_config.html','./setup_account_error_mixin'],function(require) {

let cards = require('cards'),
    evt = require('evt');

return [
  require('./base')(require('template!./setup_manual_config.html')),
  require('./setup_account_error_mixin'),
  {
    onArgs: function(args) {
      this.formItems = {
        common: {
          displayName: this._fromClass('sup-info-name'),
          emailAddress: this._fromClass('sup-info-email'),
          password: this._fromClass('sup-info-password'),
          passwordWrapper: this._fromClass('sup-manual-password-wrapper'),
          activeSyncShowpassword:
              this._fromClass('sup-manual-activesync-showpassword')
        },
        composite: {
          hostname: this._fromClass('sup-manual-composite-hostname'),
          port: this._fromClass('sup-manual-composite-port'),
          socket: this._fromClass('sup-manual-composite-socket'),
          username: this._fromClass('sup-manual-composite-username'),
          password: this._fromClass('sup-manual-composite-password')
        },
        smtp: {
          hostname: this._fromClass('sup-manual-smtp-hostname'),
          port: this._fromClass('sup-manual-smtp-port'),
          socket: this._fromClass('sup-manual-smtp-socket'),
          username: this._fromClass('sup-manual-smtp-username'),
          password: this._fromClass('sup-manual-smtp-password')
        },
        activeSync: {
          hostname: this._fromClass('sup-manual-activesync-hostname'),
          username: this._fromClass('sup-manual-activesync-username')
        }
      };

      this.compositeLiElements = Array.prototype.slice.call(
          this.compositeSection.querySelectorAll('li'));
      this.activeSyncLiElements = Array.prototype.slice.call(
          this.activeSyncSection.querySelectorAll('li'));

      let password = args.password || '';

      let common = this.formItems.common;
      common.displayName.value = args.displayName;
      common.emailAddress.value = args.emailAddress;
      common.password.value = password;

      let composite = this.formItems.composite;
      composite.username.value = args.emailAddress;
      composite.password.value = password;


      let smtp = this.formItems.smtp;
      smtp.username.value = args.emailAddress;
      smtp.password.value = password;

      this.changeIfSame(common.emailAddress,
                        [composite.username, smtp.username]);
      this.changeIfSame(composite.username, [smtp.username]);
      this.changeIfSame(composite.password, [smtp.password, common.password]);

      for (let type in this.formItems) {
        for (let field in this.formItems[type]) {
          if (this.formItems[type][field].tagName === 'INPUT') {
            this.formItems[type][field].addEventListener(
              'input', this.onInfoInput.bind(this));
          }
        }
      }

      this.requireFields('composite', true);
      this.requireFields('smtp', true);
      this.requireFields('activeSync', false);

      this.compositeSocketValue = composite.socket.value;
      this.smtpSocketValue = smtp.socket.value;
      this.socketChooseType = null;

      composite.socket.addEventListener('change',
                                       this.onChangeCompositeSocket.bind(this));
      smtp.socket.addEventListener('change',
                                   this.onChangeSmtpSocket.bind(this));

      this.activity = args.activity;
      if (this.activity) {
        this.accountTypeNode.value = 'activesync';
        this.formItems.common.displayName.value = ' ';
        this.accountName.classList.add('collapsed');
        this.accountTypeHeader.classList.add('collapsed');
        this.accountType.classList.add('collapsed');
      }
      this.onChangeAccountType({ target: this.accountTypeNode });
      this.dataChanged = false;
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Accept':
        case 'Enter':
          e.preventDefault();
          if (!NavigationMap.configDialogShown()) {
            let selectEl =
                document.querySelector('.sup-manual-form .focus select');
            if (selectEl) {
              selectEl.focus();
            }
          }
          break;
        case 'Backspace':
          e.preventDefault();
          if (NavigationMap.configDialogShown()) {
            cards._endKeyClicked = false;
            this.resetSocketValue(this.socketChooseType);
          } else {
            this.onBack();
          }
          break;
      }
    },

    handleEndkey: function(e) {
      let cb = e.detail.callback;
      if (this.dataChanged) {
        let dialogConfig = {
          title: {
            id: 'confirm-dialog-title',
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

    onCardVisible: function(navDirection) {
      const CARD_NAME = this.localName;
      const QUERY_CHILD = CARD_NAME + ' ' + 'li:not(.collapsed)';
      const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

      let form = this.formNode;
      let formLi = document.querySelectorAll('.sup-manual-form li');
      for (let i = 0; i < formLi.length; i++) {
        formLi[i].addEventListener('focus', (e) => {
          let inputEl = form.querySelector('.focus input');
          if (inputEl) {
            setTimeout(() => {
              inputEl.focus();
              inputEl.setSelectionRange(inputEl.value.length,
                                        inputEl.value.length);
            }, 100);
          }
        });
      }

      // forward: new card pushed
      if (navDirection === 'forward') {
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('first');
        this.updateSK(this.formNode.checkValidity());
      }
      // back: hidden card is restored
      else if (navDirection === 'back') {
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('restore');
        this.updateSK(this.formNode.checkValidity());
      }

      this.keydownHandler = this.handleKeyDown.bind(this);
      window.addEventListener('keydown', this.keydownHandler);
      this.endkeyHandler = this.handleEndkey.bind(this);
      window.addEventListener('email-endkey', this.endkeyHandler);

      this.showpasswordImapInputNode.addEventListener('change', () => {
        let checked = this.showpasswordImapInputNode.checked;
        document.querySelector('.sup-manual-composite-password').type =
            checked ? 'text' : 'password';
        this.updateSK(this.formNode.checkValidity());
      });
      this.showpasswordSmtpInputNode.addEventListener('change', () => {
        let checked = this.showpasswordSmtpInputNode.checked;
        document.querySelector('.sup-manual-smtp-password').type =
            checked ? 'text' : 'password';
        this.updateSK(this.formNode.checkValidity());
      });
      this.showpasswordActiveSyncInputNode.addEventListener('change', () => {
        let checked = this.showpasswordActiveSyncInputNode.checked;
        document.querySelector('.sup-manual-activesync-password').type =
            checked ? 'text' : 'password';
        this.updateSK(this.formNode.checkValidity());
      });
    },

    _fromClass: function(className) {
      return this.getElementsByClassName(className)[0];
    },

    onBack: function(event) {
      if (this.activity) {
        this.activity.postError('cancelled');
        this.activity = null;
        setTimeout(() => {
          evt.emit('resetApp', this);
        }, 200);
      } else if (this.dataChanged) {
        let dialogConfig = {
          title: {
            id: 'confirm-dialog-title',
            args: {}
          },
          body: {
            id: 'leave-this-page-warning-message',
            args: {}
          },
          cancel: {
            l10nId: 'cancel',
            priority: 1
          },
          confirm: {
            l10nId: 'discard',
            priority: 3,
            callback: () => {
              cards.removeCardAndSuccessors(this, 'animate', 1);
            }
          }
        };
        if (!NavigationMap.configDialogShown()) {
          NavigationMap.showConfigDialog(dialogConfig);
        }
      } else {
        cards.removeCardAndSuccessors(this, 'animate', 1);
      }
    },

    onNext: function() {
      let config = { type: this.accountTypeNode.value };

      if (config.type === 'imap+smtp' || config.type === 'pop3+smtp') {
        config.incoming = {
          hostname: this.formItems.composite.hostname.value,
          port: this.formItems.composite.port.value,
          socketType: this.formItems.composite.socket.value,
          username: this.formItems.composite.username.value,
          password: this.formItems.composite.password.value,
          authentication: 'password-cleartext'
        };
        config.outgoing = {
          hostname: this.formItems.smtp.hostname.value,
          port: this.formItems.smtp.port.value,
          socketType: this.formItems.smtp.socket.value,
          username: this.formItems.smtp.username.value,
          password: this.formItems.smtp.password.value,
          authentication: 'password-cleartext'
        };
      }
      else { // config.type === 'activesync'
        config.incoming = {
          server: 'https://' + this.formItems.activeSync.hostname.value,
          username: this.formItems.activeSync.username.value
        };
      }

      this.pushSetupCard(config);
    },

    pushSetupCard: function(config) {
      // remove all focus
      let focused = document.querySelectorAll('.focus');
      for (let i = 0; i < focused.length; i++) {
        focused[i].classList.remove('focus');
      }
      // For composite accounts where they've elected to have separate
      // passwords, use the composite password field. For everything
      // else, there's MasterCard. Uh, I mean, the common password.
      let password;
      if (this.accountTypeNode.value === 'activesync') {
        password = this.formItems.common.password.value;
      } else {
        password = this.formItems.composite.password.value;
      }
      // The progress card is the dude that actually tries to create the
      // account.
      cards.pushCard(
        'setup_progress', 'animate',
        {
          displayName: this.formItems.common.displayName.value.trim(),
          emailAddress: this.formItems.common.emailAddress.value,
          password: password,
          outgoingPassword: config.outgoing && config.outgoing.password,
          configInfo: config,
          activity: this.activity,
          callingCard: this
        },
        'right');
    },

    updateSK: function(validity) {
      console.log('Update softkey with validity: ' + validity);
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
      let optNext = {
        name: 'Next',
        l10nId: 'setup-manual-next',
        priority: 3,
        method: () => {
          this.onNext();
        }
      };

      let optCsk = optSelect;
      let focusedItem = this.formNode.querySelector('.focus');
      if (focusedItem && focusedItem.childElementCount > 0) {
        if (focusedItem.children[0].classList
                .contains('setup-account-checkbox')) {
          let checked = focusedItem.children[0].children[0].checked;
          if (checked) {
            optCsk = optDeSelect;
          }
        }
      }
      let menuOptions = [optCancel, optCsk];
      let menuOptionsWithNext = [optCancel, optCsk, optNext];
      let inputText;
      if (focusedItem) {
        inputText = focusedItem.querySelector(
            '[type="text"], [type="email"], [type="password"]');
      }

      if (validity) {
        if (inputText) {
          menuOptionsWithNext.splice(1, 1);
        }
        NavigationMap.setSoftKeyBar(menuOptionsWithNext);
      } else {
        if (inputText) {
          menuOptions.splice(1, 1);
        }
        NavigationMap.setSoftKeyBar(menuOptions);
      }
    },

    onFocusChanged: function() {
      this.updateSK(this.formNode.checkValidity());
    },

    onInfoInput: function(ignoredEvent) {
      this.updateSK(this.formNode.checkValidity());
      this.dataChanged = true;
    },

    /**
     * When sourceField changes, change every field in destFields to
     * match, if and only if destField previously matched sourceField.
     */
    changeIfSame: function(sourceField, destFields) {
      sourceField._previousValue = sourceField.value;
      sourceField.addEventListener('input', (e) => {
        for (let i = 0; i < destFields.length; i++) {
          let destField = destFields[i];
          if (destField.value === e.target._previousValue) {
            destField.value = destField._previousValue = e.target.value;
          }
        }
        sourceField._previousValue = e.target.value;
        this.onInfoInput(); // run validation
      });
    },

    updateLiCollapsed: function (isComposite) {
      if (isComposite) {
        this.compositeLiElements.forEach((item) => {
          item.classList.remove('collapsed');
        });
        this.activeSyncLiElements.forEach((item) => {
          item.classList.add('collapsed');
        });
      } else {
        this.compositeLiElements.forEach((item) => {
          item.classList.add('collapsed');
        });
        this.activeSyncLiElements.forEach((item) => {
          item.classList.remove('collapsed');
        });
      }
    },

    moveAccountTypeNodeIntoView: function(isComposite) {
      let evt = isComposite ? { key: 'ArrowUp' } : { key: 'ArrowDown' };
      let accountTypeNode =
          document.querySelector('.sup-manual-account-type-container.focus');
      if (accountTypeNode) {
        NavigationMap.scrollToElement(accountTypeNode, evt);
      }
    },

    onChangeAccountType: function(event) {
      let isComposite = (event.target.value === 'imap+smtp' ||
                         event.target.value === 'pop3+smtp');
      let isImap = event.target.value === 'imap+smtp';

      if (isComposite) {
        this.compositeSection.classList.remove('collapsed');
        this.activeSyncSection.classList.add('collapsed');
        this.manualImapTitle.classList.toggle('collapsed', !isImap);
        this.manualPop3Title.classList.toggle('collapsed', isImap);
        this.updateLiCollapsed(true);
      } else {
        this.compositeSection.classList.add('collapsed');
        this.activeSyncSection.classList.remove('collapsed');
        this.updateLiCollapsed(false);
      }

      this.formItems.common.passwordWrapper.classList.toggle(
        'collapsed', isComposite);
      this.formItems.common.activeSyncShowpassword.classList.toggle(
        'collapsed', isComposite);
      this.requireFields('composite', isComposite);
      this.requireFields('smtp', isComposite);
      this.requireFields('activeSync', !isComposite);
      this.onChangeCompositeSocket({ target: this.formItems.composite.socket });
      NavigationMap.navSetup('cards-setup-manual-config',
          'cards-setup-manual-config li:not(.collapsed)');
      this.moveAccountTypeNodeIntoView(isComposite);
    },

    // If the user selects a different socket type, autofill the most likely
    // port.
    onChangeCompositeSocket: function(event) {
      let isImap = this.accountTypeNode.value === 'imap+smtp';
      let SSL_VALUE = (isImap ? '993' : '995');
      let STARTTLS_VALUE = (isImap ? '143' : '110');

      let socketType = event.target.value;
      if (socketType === 'PLAIN' && !this.userConfim) {
        this.showPlainSocketWarning('composite');
      } else {
        this.compositeSocketValue = socketType;
        this.userConfim = false;
      }

      let portField = this.formItems.composite.port;
      if (socketType === 'SSL') {
        portField.value = SSL_VALUE;
      } else if (socketType === 'STARTTLS') {
        portField.value = STARTTLS_VALUE;
      }
    },

    onChangeSmtpSocket: function(event) {
      const SSL_VALUE = '465';
      const STARTTLS_VALUE = '587';
      const PLAIN_VALUE = '25';
      let socketType = event.target.value;
      let portField = this.formItems.smtp.port;

      if (socketType === 'PLAIN' && !this.userConfim) {
        this.showPlainSocketWarning('smtp');
      } else {
        this.smtpSocketValue = socketType;
        this.userConfim = false;
      }

      // Switch portField values to match defaults for the socketType, but only
      // if the existing value for portField is one of the other defaults, and
      // not a user-supplied value.
      if (socketType === 'SSL' &&
          (portField.value === STARTTLS_VALUE ||
           portField.value === PLAIN_VALUE)) {
        portField.value = SSL_VALUE;
      } else if (socketType === 'STARTTLS' &&
          (portField.value === SSL_VALUE ||
           portField.value === PLAIN_VALUE)) {
        portField.value = STARTTLS_VALUE;
      } else if (socketType === 'PLAIN' &&
          (portField.value === SSL_VALUE ||
           portField.value === STARTTLS_VALUE)) {
        portField.value = PLAIN_VALUE;
      }
    },

    requireFields: function(type, required) {
      for (let field in this.formItems[type]) {
        let item = this.formItems[type][field];
        if (!item.hasAttribute('data-maybe-required')) {
          continue;
        }

        if (required) {
          item.setAttribute('required', '');
        } else {
          item.removeAttribute('required');
        }
      }
    },

    resetSocketValue: function(type) {
      const SSL_VALUE = '465';
      const STARTTLS_VALUE = '587';
      const PLAIN_VALUE = '25';
      switch (type) {
        case 'composite':
          this.formItems.composite.socket.value = this.compositeSocketValue;
          break;
        case 'smtp':
          this.formItems.smtp.socket.value = this.smtpSocketValue;
          switch (this.smtpSocketValue) {
            case 'SSL':
              this.formItems.smtp.port.value = SSL_VALUE;
              break;
            case 'STARTTLS':
              this.formItems.smtp.port.value = STARTTLS_VALUE;
              break;
            case 'PLAIN':
              this.formItems.smtp.port.value = PLAIN_VALUE;
              break;
          }
          break;
      }
    },

    showPlainSocketWarning: function(type) {
      this.socketChooseType = type;
      let dialogConfig = {
        title: {
          id: 'tng-plain-socket-warning-title',
          args: {}
        },
        body: {
          id: 'tng-plain-socket-warning-message',
          args: {}
        },
        desc: {
          id: 'tng-plain-socket-warning-message-options',
          args: {}
        },
        cancel: {
          l10nId: 'settings-account-delete-cancel',
          priority: 1,
          callback: () => {
            this.resetSocketValue(type);
            let selectEl =
                document.querySelector('.sup-manual-form .focus select');
            if (selectEl) {
              selectEl.blur();
            }
          }
        },
        confirm: {
          l10nId: 'tng-plain-socket-warning-ok',
          priority: 3,
          callback: () => {
            this.userConfim = true;
            this.resetSocketValue(type);
            let selectEl =
                document.querySelector('.sup-manual-form .focus select');
            if (selectEl) {
              selectEl.focus();
            }
          }
        }
      };

      NavigationMap.showConfigDialog(dialogConfig);
    },

    onHidden: function() {
      window.removeEventListener('keydown', this.keydownHandler);
      window.removeEventListener('email-endkey', this.endkeyHandler);
    },

    die: function() {
      window.removeEventListener('keydown', this.keydownHandler);
      window.removeEventListener('email-endkey', this.endkeyHandler);
    }
  }
];
});
