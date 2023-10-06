/**
 * Setup is done; add another account?
 */

define(['require','cards','l10n!','evt','./base','template!./setup_account_prefs.html','./editor_mixins','./account_prefs_mixins'],function(require) {

let cards = require('cards'),
    mozL10n = require('l10n!'),
    evt = require('evt'),
    trailingRegExp = /\s+$/;

return [
  require('./base')(require('template!./setup_account_prefs.html')),
  require('./editor_mixins'),
  require('./account_prefs_mixins'),
  {
    onArgs: function(args) {
      this.account = args.account;
      this.autoSetup = args.autoSetup;
      this.identity = this.account.identities[0];

      this.signatureNodePref.innerHTML = '<br>';

      // Establish defaults specifically for our email app.
      this.identity.modifyIdentity({
        signatureEnabled: true,
        signature: mozL10n.get('settings-default-signature-2')
      });

      if (this.autoSetup) {
        this.lastAccount = args.lastAccount;
      }

      //[LIO-934]:[Email]Default signature is incorrect.
      var sig = mozL10n.get('settings-default-signature-2');
      dump("setup_account_prefs.js, default signature:"+sig+" from settings-default-signature-2");

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
        self._bindPrefs('tng-account-check-interval',
                  'tng-notify-mail',
                  'tng-sound-onsend',
                  'tng-signature-enable',
                  'signature-box',
                  'pref-account-label');
        self._bindEditor(self.signatureNodePref);
      };

      req.onerror = function(){
        dump("query Customization.email.Signature failed!");
        self._bindPrefs('tng-account-check-interval',
                        'tng-notify-mail',
                        'tng-sound-onsend',
                        'tng-signature-enable',
                        'signature-box',
                        'pref-account-label');
        self._bindEditor(self.signatureNodePref);
      };

      //this._bindPrefs('tng-account-check-interval',
      //                'tng-notify-mail',
      //                'tng-sound-onsend',
      //                'tng-signature-enable',
      //                'signature-box',
      //                'pref-account-label');
      //this._bindEditor(this.signatureNodePref);
      //[LIO-934]:modify end
    },

    getTextFromEditor: function() {
      return this.fromEditor().replace(trailingRegExp, '');
    },

    onNext: function() {
      let signature = this.getTextFromEditor();
      let accountLabel = this.prefAccountLabelNode.value.trim();

      if (signature !== this.identity.signature) {
        this.identity.modifyIdentity({ signature: signature });
      }
      if (accountLabel !== this.account.label) {
        this.account.modifyAccount({ label: accountLabel });
      }

      if (this.autoSetup) {
        evt.emit('autoAddDone');
        cards.removeCardAndSuccessors(this, 'immediate', 1);
      } else {
        cards.pushCard('setup_done', 'animate');
      }
    },

    updateFocusList: function() {
      NavigationMap.navSetup('cards-setup-account-prefs',
                             'cards-setup-account-prefs ul li:not(.hidden)');
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Accept':
        case 'Enter':
          let selectEl = document.querySelector('.scrollregion-below-header' +
                                                ' .focus select');
          if (selectEl) {
            selectEl.focus();
          }
          break;
      }
      setTimeout(() => {
        if (document.activeElement.classList.contains('no-select')) {
          if (document.activeElement.classList.contains('signature-box')) {
            window.option.buttonCsk.textContent = mozL10n.get('enter');
          } else {
            window.option.buttonCsk.textContent = '';
          }
        } else {
          window.option.buttonCsk.textContent = mozL10n.get('select');
        }
      });
    },

    onBodyNodeKeydown: function(evt) {
      let range = window.getSelection().getRangeAt(0);
      let currentElement = range.startContainer;

      switch (evt.key) {
        case 'ArrowUp':
          if ((currentElement === document.activeElement ||
              currentElement === document.activeElement.firstChild) &&
              (range.startOffset === 0 ||
              currentElement.textContent.length === 0)) {
            break;
          }
          evt.stopPropagation();
          break;
        case 'ArrowDown':
          if ((currentElement === document.activeElement && isLastLine(range))
              || isLastNode(range)) {
            break;
          }
          evt.stopPropagation();
          break;
      }

      function isLastLine(range) {
        if (document.activeElement.lastChild.tagName === 'BR' &&
            range.startOffset === (document.activeElement.childNodes.length - 1)
        ) {
          return true;
        } else if (range.startOffset ===
                   document.activeElement.childNodes.length) {
          return true;
        }
        return false;
      }

      function isLastNode(range) {
        return range.startOffset === range.startContainer.length;
      }
    },

    onInfoInput: function() {
      this.updateSK();
    },

    updateSK: function() {
      let OptSelect = {
        name: '',
        l10nId: '',
        priority: 2
      };

      let optNext ={
        name: 'Next',
        l10nId: 'setup-info-next',
        priority: 3,
        method: () => {
          this.onNext();
        }
      };

      let params = [OptSelect];
      if (this.prefAccountLabelNode.value.trim().length) {
        params.push(optNext);
      }
      NavigationMap.setSoftKeyBar(params);
    },

    onCardVisible: function(navDirection) {
      const CARD_NAME = this.localName;
      const QUERY_CHILD = CARD_NAME + ' ' + 'ul li:not(.hidden)';
      const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

      let menuOptions = [{
        name: 'Select',
        l10nId: 'select',
        priority: 2
      },
      {
        name: 'Next',
        l10nId: 'setup-info-next',
        priority: 3,
        method: () => {
          this.onNext();
        }
      }];

      this.prefAccountLabelNode.parentNode.addEventListener('focus',
        () => {
          setTimeout(() => {
            this.prefAccountLabelNode.focus();
            this.prefAccountLabelNode.setSelectionRange(9999, 9999);
            window.option.buttonCsk.textContent = '';
          });
        }
      );

      console.log(this.localName + '.onCardVisible, navDirection=' +
                  navDirection);
      // forward: new card pushed
      if (navDirection === 'forward') {
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('first');
        NavigationMap.setSoftKeyBar(menuOptions);
      }
      // back: hidden card is restored
      else if (navDirection === 'back') {
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('restore');
        NavigationMap.setSoftKeyBar(menuOptions);
      }

      this.keydownHandler = this.handleKeyDown.bind(this);
      this.addEventListener('keydown', this.keydownHandler);
      document.addEventListener('update-list', this.updateFocusList);
      this.updateSignatureBox();

      let signatureNode = document
          .querySelector('cards-setup-account-prefs .signature-box');
      let signatureNodeParentLi =
          document.querySelector('cards-setup-account-prefs ' +
                                 '.settings-account-signature');
      signatureNodeParentLi.addEventListener('focus', (evt) => {
        signatureNode.focus();
        if (!evt.relatedTarget.classList.contains('signature-box')) {
          let selection = window.getSelection();
          let range = document.createRange();
          let lastChild = signatureNode.lastElementChild;

          if (lastChild.nodeName === 'BR') {
            range.setStartBefore(lastChild);
          } else {
            range.setStartAfter(lastChild);
          }
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });
      if (document.activeElement.classList.contains('no-select')) {
        window.option.buttonCsk.textContent = '';
      }
    },

    die: function() {
      this.removeEventListener('keydown', this.keydownHandler);
      document.removeEventListener('update-list', this.updateFocusList);
    }
  }
];
});
