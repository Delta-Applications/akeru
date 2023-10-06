/**
 * Mixin for the setup_fix_* cases.
 */

define(['require','l10n!','cards','toaster','accounts_sync'],function(require) {

  let mozL10n = require('l10n!'),
      cards = require('cards'),
      toaster = require('toaster'),
      accountsSync = require('accounts_sync');

  return  {
    extraClasses: ['anim-fade', 'anim-overlay'],

    onArgs: function(args) {
      this.account = args.account;
      this.whichSide = args.whichSide; // incoming or outgoing
      this.restoreCard = args.restoreCard;

      let type = this.account.type;
      let l10nString = null;
      // In the case of IMAP/POP3, they might have two different passwords,
      // one for IMAP/POP3 and one for SMTP. We need to clarify which one
      // we're asking for. (It does not need l10n because it's a protocol.)
      if ((type === 'imap+smtp' || type === 'pop3+smtp') &&
          this.whichSide) {
        if (this.whichSide === 'incoming') {
          if (type === 'imap+smtp') {
            l10nString = 'settings-account-clarify-imap';
          } else {
            l10nString = 'settings-account-clarify-pop3';
          }
        } else {
          l10nString = 'settings-account-clarify-smtp';
        }
      } else {
        l10nString = 'settings-account-clarify';
      }
      mozL10n.setAttributes(this.accountNode, l10nString,
          { 'account-name': this.account.name });
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Backspace':
          e.preventDefault();
          this.proceed();
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          break;
      }
    },

    onCardVisible: function(navDirection) {
      const CARD_NAME = this.localName;
      const QUERY_CHILD = '.sup-fix-password-li';
      const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

      let menuOptions = [
        {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          method: () => {
            this.account.clearProblems();
            this.proceed();
          }
        },
        {
          name: 'Save',
          l10nId: 'opt-save',
          priority: 3,
          method: () => {
            this.onUsePassword();
          }
        }
      ];

      NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
      NavigationMap.setCurrentControl(CONTROL_ID);
      NavigationMap.setFocus('first');
      NavigationMap.setSoftKeyBar(menuOptions);

      document.querySelector('.sup-fix-password-input').focus();
      this.keydownHandler = this.handleKeyDown.bind(this);
      this.addEventListener('keydown', this.keydownHandler);
    },

    /**
     * Assume we will be successful; update the password, trigger a reauth
     * attempt, then close the card.
     */
    onUsePassword: function() {
      let password = this.fixPasswordNode.value;
      this.account.clearProblems(true, () => {
        if (password) {
          this.account.modifyAccount(this.whichSide === 'incoming' ?
              { incomingPassword: password } :
              { outgoingPassword: password }, () => {
            accountsSync.changePassword(this.account.username,
              this.account.authenticatorId, password);
            this.account.clearProblems();
          });
          toaster.toast({
            text: mozL10n.get('password-saved')
          });
        } else {
          this.account.clearProblems();
        }
      });
      this.proceed();
    },

    /**
     * After potentially modifying the account, continue onward.
     */
    proceed: function() {
      cards.removeCardAndSuccessors(this, 'animate', 1, this.restoreCard);
    },

    die: function() {
      // no special cleanup required
      this.removeEventListener('keydown', this.keydownHandler);
    }
  };
});
