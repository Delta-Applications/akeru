
define(['require','cards','evt','./base','template!./setup_account_settingsInfo.html'],function(require) {

let cards = require('cards'),
    evt = require('evt');

return [
  require('./base')(require('template!./setup_account_settingsInfo.html')),
  {
    onArgs: function(args) {
      this.account = args.account;
      this.activity = args.activity;
    },

    onNext: function() {
      if (this.activity) {
        this.activity.postResult('complete');
        this.activity = null;
        evt.emit('showLatestAccount');
      } else {
        cards.pushCard('setup_account_prefs', 'animate',
            { account: this.account });
      }
    },

    onCardVisible: function() {
      let menuOptions = [{
        name: 'Next',
        l10nId: 'setup-info-next',
        priority: 3,
        method: () => {
          this.onNext();
        }
      }];
      NavigationMap.setSoftKeyBar(menuOptions);
    }
  }
];
});
