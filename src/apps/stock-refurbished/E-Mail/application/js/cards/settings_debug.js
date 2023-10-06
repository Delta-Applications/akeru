
let _secretDebug;

/**
 * Quasi-secret card for troubleshooting/debugging support.  Not part of the
 * standard UX flow, potentially not to be localized, and potentially not to
 * be shipped after initial dogfooding.
 */
define(['require','api','cards','html_cache','./base','template!./settings_debug.html'],function(require) {

let MailAPI = require('api'),
    cards = require('cards'),
    htmlCache = require('html_cache');

if (!_secretDebug) {
  _secretDebug = {};
}

return [
  require('./base')(require('template!./settings_debug.html')),
  {
    createdCallback: function() {
      this.loggingSelect.value = MailAPI.config.debugLogging || '';
    },

    onClose: function() {
      cards.removeCardAndSuccessors(this, 'animate', 1);
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Enter':
          let selectEl = document.querySelector('.scrollregion-below-header' +
                                                ' .focus select');
          if (selectEl) {
            selectEl.focus();
          }
          break;
        case 'Backspace':
          e.preventDefault();
          this.onClose();
          break;
      }
    },

    menuOptions: [
      {
        name: 'Select',
        l10nId: 'select',
        priority: 2
      }
    ],

    onCardVisible: function(navDirection) {
      const CARD_NAME = this.localName;
      const QUERY_CHILD = CARD_NAME + ' ' + '.debug';
      const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

      if (navDirection === 'forward') {
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('first');
        NavigationMap.setSoftKeyBar(this.menuOptions);
      } else if (navDirection === 'back') {
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('restore');
        NavigationMap.setSoftKeyBar(this.menuOptions);
      }

      this.keydownHandler = this.handleKeyDown.bind(this);
      this.addEventListener('keydown', this.keydownHandler);
    },

    resetApp: function() {
      window.location.reload();
    },

    dumpLog: function() {
      MailAPI.debugSupport('dumpLog', 'storage');
    },

    onChangeLogging: function() {
      // coerce the falsey empty string to false.
      let value = this.loggingSelect.value || false;
      MailAPI.debugSupport('setLogging', value);
    },

    fastSync: function() {
      _secretDebug.fastSync = [20000, 60000];
    },

    resetStartupCache: function() {
      htmlCache.reset();
      console.log('htmlCache.reset done');
    },

    die: function() {
      this.removeEventListener('keydown', this.keydownHandler);
    }
  }
];
});
