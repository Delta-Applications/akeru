/**
 * Tells the user how to enable IMAP/POP3 for Gmail
 */

define(['require','cards','./base','template!./setup_fix_gmail.html'],function(require) {

let cards = require('cards');

return [
  require('./base')(require('template!./setup_fix_gmail.html')),
  {
    extraClasses: ['anim-fade', 'anim-overlay'],

    onArgs: function(args) {
      this.account = args.account;
      this.restoreCard = args.restoreCard;

      // The account name is not translatable; set it verbatim.
      this.accountNode.textContent = this.account.name;

      // Localize the common elements. Since the text of these may differ
      // depending on the account type, we must translate them here rather
      // than through data-l10n-id.
      let translations = {
        'sup-account-header-label': 'setup-gmail-{ACCOUNT_TYPE}-header',
        'sup-enable-label': 'setup-gmail-{ACCOUNT_TYPE}-message'
      };
      let accountType = (this.account.type === 'imap+smtp' ? 'imap' : 'pop3');
      for (let className in translations) {
        let l10nId = translations[className].replace('{ACCOUNT_TYPE}',
                                                     accountType);
        this.getElementsByClassName(className)[0].setAttribute('data-l10n-id',
                                                               l10nId);
      }
    },

    onCardVisible: function() {
      this.setSoftkey('setup-gmail-retry');
      window.addEventListener('keydown', this.handleKeyDown);
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Backspace':
          e.stopPropagation();
          e.preventDefault();
          break;
      }
    },

    setSoftkey: function(id) {
      let params = [];
      params.push({
        name: 'dismiss',
        l10nId: id,
        priority: 2,
        method: () => {
          this.dismiss();
        }
      });
      NavigationMap.setSoftKeyBar(params);
    },

    die: function() {
      window.removeEventListener('keydown', this.handleKeyDown);
    },

    dismiss: function() {
      this.account.clearProblems();
      cards.removeCardAndSuccessors(this, 'animate', 1,
                                    this.restoreCard);
    }
  }
];
});
