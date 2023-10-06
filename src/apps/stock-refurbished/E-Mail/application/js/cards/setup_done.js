/**
 * Setup is done; add another account?
 */

define(['require','evt','./base','template!./setup_done.html'],function(require) {

let evt = require('evt');

return [
  require('./base')(require('template!./setup_done.html')),
  {
    onCardVisible: function() {
      let menuOptions = [{
        name: 'Add Account',
        l10nId: 'setup-done-add',
        priority: 1,
        method: () => {
          this.onAddAnother();
        }
      },
      {
        name: 'Finish',
        l10nId: 'finish',
        priority: 3,
        method: () => {
          this.onShowMail();
        }
      }];

      NavigationMap.setSoftKeyBar(menuOptions);

      let cardsNode = document.getElementsByTagName('cards-setup-done')[0];
      cardsNode.setAttribute('role', 'heading');
      cardsNode.setAttribute('aria-labelledby', 'setup-done-header');
      this.msgNode.focus();
    },

    onAddAnother: function() {
      evt.emit('addAccount');
    },

    onShowMail: function() {
      // Nuke this card
      evt.emit('showLatestAccount');
    },

    die: function() {
    }
  }
];

});
