/**
 * Per-account server settings, it can be activesync, imap+smtp, or
 * pop3+smtp
 */

define(['require','l10n!','cards','./base','template!./settings_account_servers.html'],function(require) {

let mozL10n = require('l10n!'),
    cards = require('cards');

return [
  require('./base')(require('template!./settings_account_servers.html')),
  {
    onArgs: function(args) {
      this.account = args.account;
      this.server = args.account.servers[args.index];

      this.headerLabel.textContent = this.account.name;

      mozL10n.setAttributes(this.serverLabel,
                            'settings-' + this.server.type + '-label');

      // activesync stores its data in 'server'
      this.hostnameNodeSpan.innerHTML = this.server.connInfo.hostname ||
                                        this.server.connInfo.server;
      // port is meaningless for activesync; display empty value
      this.portNodeSpan.innerHTML = this.server.connInfo.port || '';
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Backspace':
          e.preventDefault();
          this.onBack();
          break;
      }
    },

    onCardVisible: function() {
      let menuOptions = [
        {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          method: () => {
            this.onBack();
          }
        }
      ];
      NavigationMap.setSoftKeyBar(menuOptions);
      this.keydownHandler = this.handleKeyDown.bind(this);
      window.addEventListener('keydown', this.keydownHandler);

      let cardsNode =
          document.getElementsByTagName('cards-settings-account-servers')[0];
      cardsNode.setAttribute('role', 'heading');
      cardsNode.setAttribute('aria-labelledby',
                             'settings-account-servers-header');
      this.formNode.focus();
    },

    onBack: function() {
      cards.removeCardAndSuccessors(this, 'animate', 1);
    },

    die: function() {
      window.removeEventListener('keydown', this.keydownHandler);
    }
  }
];
});
