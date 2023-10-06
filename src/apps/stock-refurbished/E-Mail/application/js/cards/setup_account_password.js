
define(['require','mix','cards','./base','template!./setup_account_password.html','./setup_account_error_mixin'],function(require) {

let mix = require('mix'),
    cards = require('cards');

return [
  require('./base')(require('template!./setup_account_password.html')),
  require('./setup_account_error_mixin'),
  {
    onArgs: function(args) {
      this.args = args;
      this.emailAddress = args.emailAddress;
      this.emailNode.textContent = this.emailAddress;
    },

    onCardVisible: function(navDirection) {
      const CARD_NAME = this.localName;
      const QUERY_CHILD = CARD_NAME + ' ' + 'li';
      const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

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

      this.showpasswordInputNode.addEventListener('change', () => {
        this.passwordNode.type =
            this.showpasswordInputNode.checked ? 'text' : 'password';
        this.updateSK();
      });
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (!this.showPasswordNode.classList.contains('focus')) {
            e.stopPropagation();
          }
          break;
        case 'Backspace':
          e.preventDefault();
          if (NavigationMap.configDialogShown()) {
            cards._endKeyClicked = false;
          } else {
            this.onBack();
          }
          break;
        }
    },

    handleEndkey: function(e) {
      let dialogConfig = {
        title: {
          id: 'confirmation-title',
          args: {}
        },
        body: {
          id: 'data-loss-warning-message',
          args: {}
        },
        desc: {
          id: 'back-to-edit-message',
          args: {}
        },
        cancel: {
          l10nId: 'exit',
          priority: 1,
          callback: () => {
            window.close();
          }
        },
        confirm: {
          l10nId: 'return',
          priority: 3,
          callback: () => {
            cards._endKeyClicked = false;
          }
        }
      };

      NavigationMap.showConfigDialog(dialogConfig);
      e.preventDefault();
    },

    onBack: function(event) {
      cards.removeCardAndSuccessors(this, 'animate', 1);
    },

    onNext: function() {
      this.args.password = this.passwordNode.value;

      // The progress card is the dude that actually tries to create the
      // account.
      cards.pushCard(
        'setup_progress', 'animate',
        // Send a new object for sanitation, avoid state modifications
        // downstream.
        mix({
          callingCard: this
        }, this.args),
        'right');
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
      params.push(optCancel);
      if (focusedItem &&
          focusedItem.classList.contains('sup-account-show-password')) {
        if (this.showpasswordInputNode.checked) {
          params.push(optDeSelect);
        } else {
          params.push(optSelect);
        }
      }
      if (this.formNode.checkValidity()) {
        params.push(optNext);
      }
      NavigationMap.setSoftKeyBar(params);
    },

    onFocusChanged: function(queryChild, index) {
      if (index === 0) {
        this.passwordNode.focus();
        let len = this.passwordNode.value.length;
        this.passwordNode.setSelectionRange(len, len);
      }
      this.updateSK();
    },

    onInfoInput: function(event) {
      this.updateSK();
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
