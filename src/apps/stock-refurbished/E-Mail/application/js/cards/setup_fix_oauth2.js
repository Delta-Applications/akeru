
define(['require','cards','accounts_sync','./base','template!./setup_fix_oauth2.html'],function(require) {

let cards = require('cards'),
    accountsSync = require('accounts_sync');

return [
  require('./base')(require('template!./setup_fix_oauth2.html')),
  {
    extraClasses: ['anim-fade', 'anim-overlay'],

    onArgs: function(args) {
      this.account = args.account;
      this.restoreCard = args.restoreCard;

      // The account name is not translatable; set it verbatim.
      this.oauth2Name.textContent = this.account.name;
    },

    onCardVisible: function() {
      let CARD_NAME = this.localName;
      let CONTROL_ID = '.set-focus-element';
      this.setSoftkey();
      NavigationMap.setCurrentControl(CARD_NAME + ' ' + CONTROL_ID);
      NavigationMap.navSetup(CARD_NAME, CONTROL_ID);
      NavigationMap.setFocus('first');
      window.addEventListener('keydown', this.handleKeyDown);
    },

    setSoftkey: function() {
      let params = [];
      params.push({
        name: '',
        l10nId: 'setup-fix-oauth2-reauthorize',
        priority: 2,
        method: () => {
          this.onReauth();
        }
      });
      NavigationMap.setSoftKeyBar(params);
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Backspace':
        case 'Enter':
          e.stopPropagation();
          e.preventDefault();
          break;
      }
    },

    die: function() {
      window.removeEventListener('keydown', this.handleKeyDown);
    },

    onReauth: function() {
      let accountId = this.account.username;
      accountsSync.getAllAccounts().then((accounts) => {
        for (let account of accounts) {
          if (accountId === account.accountId) {
            let config = { refreshCredential: true };
            accountsSync.getCredential(account, config).then(
                (credential) => {
                  let tokens = {
                    accessToken: credential.access_token,
                    expireTimeMS: credential.expire_timestamp
                  };
                  this.account.modifyAccount({ oauthTokens: tokens });
                  this.account.clearProblems();
                  this.delayedClose();
                }, () => {
                  this.delayedClose();
                }
            );
            break;
          }
        }
      });
    },

    delayedClose: function() {
      // The setTimeout is a hack. See the comment in setup_progress, in
      // onCardVisible, similar issue here, but for the close of the oauth
      // card.
      setTimeout(this.close.bind(this), 100);
    },

    close: function(event) {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }

      cards.removeCardAndSuccessors(this, 'animate', 1,
                                    this.restoreCard);
    }
  }
];
});
