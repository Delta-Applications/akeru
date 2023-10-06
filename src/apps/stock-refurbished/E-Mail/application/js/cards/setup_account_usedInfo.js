
define(['require','cards','l10n!','evt','./base','template!./setup_account_usedInfo.html'],function(require) {

let cards = require('cards'),
    mozL10n = require('l10n!'),
    evt = require('evt');

return [
  require('./base')(require('template!./setup_account_usedInfo.html')),
  {
    onArgs: function(args) {
      this.account = args.account;
      this.activity = args.activity;
      this.identity = this.account.identities[0];
      this.identity.modifyIdentity({
        signatureEnabled: true,
        signature: mozL10n.get('settings-default-signature-2')
      });

      //[LIO-934]:[Email]Default signature is incorrect. overwrite the value above.
      var sig = mozL10n.get('settings-default-signature-2');
      dump("setup_account_usedInfo.js, default signature:"+sig+" from settings-default-signature-2");

      const key = "Customization.email.Signature";
      var req = navigator.mozSettings.createLock().get(key);
      self = this;
      req.onsuccess = function () {
        var customizationSignature = req.result[key];
        dump("query Customization.email.Signature success  customizationSignature = " + customizationSignature);
        if(customizationSignature && customizationSignature !== ""){
            defaultSignature = customizationSignature;
            self.identity.modifyIdentity({
                signature: defaultSignature
            });
        }
      };
      req.onerror = function(){
        dump("query Customization.email.Signature failed!");
      };
      //[LIO-934]:modify end
    },

    onNext: function() {
      cards.pushCard('setup_account_settingsInfo', 'animate', {
        account: this.account,
        activity: this.activity
      });
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

      evt.emit('userAddDone', {
        account: this.account,
        activity: !!this.activity
      });

      this.accountUsedInfoNode.focus();
    }
  }
];
});
