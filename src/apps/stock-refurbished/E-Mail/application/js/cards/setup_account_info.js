/**
 * Enter basic account info card (name, e-mail address) to try and
 * autoconfigure an account.
 */

define(['require','exports','module','evt','l10n!','toaster','cards','./base','template!./setup_account_info.html','./setup_account_error_mixin'],function(require, exports, module) {

let evt = require('evt'),
    mozL10n = require('l10n!'),
    toaster = require('toaster'),
    cards = require('cards');

return [
  require('./base')(require('template!./setup_account_info.html')),
  require('./setup_account_error_mixin'),
  {
    onArgs: function(args) {
      this.args = args;
      this.dataChanged = false;

      if (args.launchedFromActivity) {
        this.errorRegionNode.classList.remove('collapsed');
        mozL10n.setAttributes(this.errorMessageNode,
            'setup-empty-account-message');
      }
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Accept':
        case 'Enter':
          e.preventDefault();
          break;
        case 'Backspace':
          if (NavigationMap.configDialogShown()) {
            e.preventDefault();
            cards._endKeyClicked = false;
          } else {
            if (this.nameNode.value.trim() ||
              this.emailNode.value.trim()) {
              this.handleEndkey(e);
            } else {
              e.preventDefault();
              this.onBack();
            }
          }
          break;
      }
    },

    handleEndkey: function(e) {
      let callback = e.detail.callback;
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
              this.onBack();
            }
          }
        };
        NavigationMap.showConfigDialog(dialogConfig);
        e.preventDefault();
      } else {
        if (callback) {
          callback();
        }
      }
    },

    onCardVisible: function(navDirection) {
      const CARD_NAME = this.localName;
      const QUERY_CHILD = CARD_NAME + ' ' + 'li';
      const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

      let form = this.formNode;
      let formLi = document.querySelectorAll('.sup-account-form li');
      let i;
      for (i = 0; i < formLi.length; i++) {
        formLi[i].addEventListener('focus', () => {
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

      // Remove cached softkey panel if it has been restored,
      // so that the card's own softkey panel can be the only
      // one softeky panel instance.
      let cacheSoftkeyNode = document.getElementById('cachedSoftkeyPanel');
      if (cacheSoftkeyNode) {
        document.body.removeChild(cacheSoftkeyNode);
      }

      console.log(this.localName + '.onCardVisible, navDirection=' +
                  navDirection);
      NavigationMap.cardContentHeight = this.scrollBelowNode.clientHeight;
      // forward: new card pushed
      if (navDirection === 'forward') {
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('first');
      }
      // back: hidden card is restored
      else if (navDirection === 'back') {
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('restore');
      }

      this.updateSK();
      this.keydownHandler = this.handleKeyDown.bind(this);
      window.addEventListener('keydown', this.keydownHandler);
      this.endkeyHandler = this.handleEndkey.bind(this);
      window.addEventListener('email-endkey', this.endkeyHandler);
    },

    onBack: function(event) {
      evt.emit('setupAccountCanceled', this);
    },

    onNext: function() {
      if (navigator.connection.type === 'none') {
        toaster.toast({
          text: mozL10n.get('no-internet-connection')
        });
        return;
      }
      
      // remove all focus
      let focused = document.querySelectorAll('.focus');
      for (let i = 0; i < focused.length; i++) {
        focused[i].classList.remove('focus');
      }
      // The progress card is the dude that actually tries to create the
      // account.
      cards.pushCard(
        'setup_progress', 'animate',
        {
          displayName: this.nameNode.value,
          emailAddress: this.emailNode.value,
          callingCard: this
        },
        'right');
    },

    updateSK: function() {
      let optManualSetup = {
        name: 'Manual Setup',
        l10nId: 'setup-manual-config2',
        priority: 1,
        method: () => {
          this.onClickManualConfig();
        }
      };
      let optNext = {
        name: 'Next',
        l10nId: 'setup-info-next',
        priority: 3,
        method: () => {
          this.onNext();
        }
      };

      let params = [];
      let focusedItem = this.formNode.querySelector('.focus');
      params.push(optManualSetup);
      if (this.formNode.checkValidity()) {
        params.push(optNext);
      }
      NavigationMap.setSoftKeyBar(params);
    },

    onFocusChanged: function(queryChild, index) {
      console.log(this.localName + '.onFocusChanged, queryChild=' +
                  queryChild + ", index=" + index);
      this.updateSK();
    },

    onInfoInput: function(event) {
      this.updateSK();
      this.dataChanged = true;
    },

    onClickManualConfig: function(event) {
      cards.pushCard(
        'setup_manual_config', 'animate',
        {
          displayName: this.nameNode.value,
          emailAddress: this.emailNode.value
        },
        'right');
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
