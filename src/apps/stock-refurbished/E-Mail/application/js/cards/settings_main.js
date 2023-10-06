/*global define*/

define(['require','tmpl!./tng/account_item.html','api','cards','./base','template!./settings_main.html'],function(require) {

let tngAccountItemNode = require('tmpl!./tng/account_item.html'),
    MailAPI = require('api'),
    cards = require('cards');

return [
  require('./base')(require('template!./settings_main.html')),
  {
    createdCallback: function() {
      this.acctsSlice = MailAPI.viewAccounts(false);
      this.acctsSlice.onsplice = this.onAccountsSplice.bind(this);

      this._secretButtonClickCount = 0;
      this._secretButtonTimer = null;
    },

    onArgs: function(args) {
      this.args = args;
    },

    handleKeyDown: function(e) {
      switch (e.key) {
        case 'Backspace':
          e.preventDefault();
          this.onClose();
          break;
        case '*':
          this.onClickSecretButton();
          break;
      }
    },

    menuOptions: [
      {
        name: 'Add Account',
        l10nId: 'settings-account-add',
        priority: 1,
        method: () => {
          cards.pushCard(
            'setup_account_info',
            'animate',
            { allowBack: true },
            'right'
          );
        }
      },
      {
        name: 'Select',
        l10nId: 'select',
        priority: 2
      }
    ],

    onCardVisible: function(navDirection) {
      this.keydownHandler = this.handleKeyDown.bind(this);
      if (navDirection === 'forward') {
        this.addEventListener('keydown', this.keydownHandler);
      }
      this.acctsSlice.items.forEach((account) => {
        this.updateAccountLabel(account);
      });
      this.accountsContainer.setAttribute('role', 'heading');
      this.setNavigationMap(navDirection);
    },

    setNavigationMap: function(navDirection) {
      const CARD_NAME = this.localName;
      const QUERY_CHILD = '.tng-account-item:not(.collapsed)';
      const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

      // forward: new card pushed
      if (navDirection === 'forward' || !navDirection) {
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('first');
        NavigationMap.setSoftKeyBar(this.menuOptions);
      }
      // back: hidden card is restored
      else if (navDirection === 'back') {
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('restore');
        NavigationMap.setSoftKeyBar(this.menuOptions);
      }
    },

    onClose: function() {
      cards.removeCardAndSuccessors(this, 'delay-animate', 1);
    },

    onAccountsSplice: function(index, howMany, addedItems,
                               requested, moreExpected) {
      let accountsContainer = this.accountsContainer;

      let account;
      if (howMany) {
        for (let i = index + howMany - 1; i >= index; i--) {
          account = this.acctsSlice.items[i];
          accountsContainer.removeChild(account.element);
        }
      }

      let insertBuddy = (index >= accountsContainer.childElementCount) ?
                         null : accountsContainer.children[index];
      addedItems.forEach((account) => {
        let accountNode = account.element =
            tngAccountItemNode.cloneNode(true);
        accountNode.account = account;
        this.updateAccountDom(account, true);
        accountsContainer.insertBefore(accountNode, insertBuddy);
      });

      this.setNavigationMap();
    },

    updateAccountDom: function(account, firstTime) {
      let accountNode = account.element;

      if (firstTime) {
        let accountLabel =
            accountNode.querySelector('.tng-account-item-label');
        let accountLabelSpan =
            accountNode.querySelector('.tng-account-item-accountLabel');

        accountLabel.textContent = account.name;
        accountLabelSpan.innerHTML = account.label;
        // Attaching a listener to account node with the role="option" to
        // enable activation with the screen reader.
        accountNode.addEventListener('click',
            this.onClickEnterAccount.bind(this, account), false);
      }
    },

    updateAccountLabel: function(account) {
      let accountLabel =
          account.element.querySelector('.tng-account-item-label');
      let accountLabelSpan =
          account.element.querySelector('.tng-account-item-accountLabel');

      accountLabel.textContent = account.name;
      accountLabelSpan.innerHTML = account.label;
    },

    onClickAddAccount: function() {
      cards.pushCard(
        'setup_account_info', 'animate',
        {
          allowBack: true
        },
        'right');
    },

    onClickEnterAccount: function(account) {
      cards.pushCard(
        'settings_account', 'animate',
        {
          account: account
        },
        'right');
    },

    onClickSecretButton: function() {
      if (this._secretButtonTimer === null) {
        this._secretButtonTimer = setTimeout(() => {
          this._secretButtonTimer = null;
          this._secretButtonClickCount = 0;
        }, 2000);
      }

      if (++this._secretButtonClickCount >= 5) {
        window.clearTimeout(this._secretButtonTimer);
        this._secretButtonTimer = null;
        this._secretButtonClickCount = 0;
        cards.pushCard('settings_debug', 'animate', {}, 'right');
      }
    },

    die: function() {
      this.acctsSlice.die();
      this.removeEventListener('keydown', this.keydownHandler);
    }
  }
];
});
