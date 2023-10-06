/**
 * welcome page
 */

define(['require','exports','module','cards','html_cache','./base','template!./welcome_page.html'],function(require, exports, module) {

let cards = require('cards'),
    htmlCache = require('html_cache');

return [
  require('./base')(require('template!./welcome_page.html')),
  {
    createdCallback: function() {
      window.softkeyHTML = null;
      this.setMsg();
      htmlCache.cloneAndSave(module.id, this);
    },

    setMsg: function() {
      this.hasAccount = localStorage.getItem('data_has_account') === 'yes';
      
      if (this.hasAccount) {
        this.msgSetup.setAttribute('data-l10n-id', 'sync-account-guide');
        this.msgWelcome.classList.add('collapsed');
        this.brNode.classList.add('collapsed');
      } else {
        this.msgSetup.setAttribute('data-l10n-id', 'welcome-msg-setup');
        this.msgWelcome.classList.remove('collapsed');
        this.brNode.classList.remove('collapsed');
      }
    },

    onCardVisible: function() {
      let menuOptions = [{
        name: 'Next',
        l10nId: 'next',
        priority: 3,
        method: () => {
          this.onNext();
        }
      }];

      if (this.hasAccount) {
        menuOptions = [{
          name: 'Settings',
          l10nId: 'opt-settings',
          priority:3,
          method: () => {
            this.onShowSettings();
          }
        }];
      }

      NavigationMap.setSoftKeyBar(menuOptions);

      let cardsNode = document.getElementsByTagName('cards-welcome-page')[0];
      cardsNode.setAttribute('role', 'heading');
      cardsNode.setAttribute('aria-labelledby', 'welcome-header');
      this.msgNode.focus();
    },

    onNext: function() {
      cards.pushCard('setup_account_info', 'animate');
    },

    onShowSettings: function() {
      cards.pushCard('settings_main', 'animate');
    },

    die: function() {
    }
  }
];
});
