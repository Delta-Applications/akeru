/*global define */

define(['require','tmpl!./fld/folder_item.html','tmpl!./fld/account_item.html','folder_depth_classes','cards','model','evt','l10n!','toaster','transition_end','css!style/folder_cards','./base','template!./folder_picker.html'],function(require) {

let fldFolderItemNode = require('tmpl!./fld/folder_item.html'),
    fldAccountItemNode = require('tmpl!./fld/account_item.html'),
    FOLDER_DEPTH_CLASSES = require('folder_depth_classes'),
    cards = require('cards'),
    model = require('model'),
    evt = require('evt'),
    mozL10n = require('l10n!'),
    toaster = require('toaster'),
    transitionEnd = require('transition_end');

require('css!style/folder_cards');

return [
  require('./base')(require('template!./folder_picker.html')),
  {
    createdCallback: function() {
      if (this.mode === 'folder') {
        this.pickerTitle.setAttribute('data-l10n-id', 'folders');
        this.bindContainerHandler(this.foldersContainer, 'click',
                                  this.onClickFolder.bind(this));

        this.updateAccount = this.updateAccount.bind(this);
        model.latest('account', this.updateAccount);
      } else if (this.mode === 'account') {
        this.pickerTitle.setAttribute('data-l10n-id', 'opt-account');
        model.latest('account', (account) => {
          this.curAccount = account;
        });
        this.bindContainerHandler(this.accountListContainer, 'click',
                                  this.onClickAccount.bind(this));

        let accountCount = model.getAccountCount();
        if (accountCount > 1) {
          this.classList.remove('one-account');
        }

        this.acctsSlice = model.api.viewAccounts(false);
        this.acctsSlice.onsplice = this.onAccountsSplice.bind(this);
        this.acctsSlice.onchange = this.onAccountsChange.bind(this);
      }

      transitionEnd(this, this.onTransitionEnd.bind(this));
    },

    onArgs: function(args) {
      this.folderPickCard = args.previousCard;
    },

    extraClasses: ['anim-vertical', 'anim-overlay', 'one-account'],

    onShowSettings: function(event) {
      cards.pushCard('settings_main', 'animate');
    },

    /**
     * Clicking a different account changes the list of folders displayed.  We
     * then trigger a select of the inbox for that account because otherwise
     * things get permutationally complex.
     */
    updateAccount: function(account) {
      let oldAccount = this.curAccount;

      this.mostRecentSyncTimestamp = 0;

      if (oldAccount !== account) {
        this.foldersContainer.innerHTML = '';

        model.latestOnce('folder', (folder) => {
          this.curAccount = account;

          // If no current folder, means this is the first startup, do some
          // work to populate the
          if (!this.curFolder) {
            this.curFolder = folder;
          }

          // Clean up any old bindings.
          if (this.foldersSlice) {
            this.foldersSlice.onsplice = null;
            this.foldersSlice.onchange = null;
          }

          this.foldersSlice = model.foldersSlice;
          if (account.enabled) {
            this.foldersSlice.syncList(account.id);
          }
          // since the slice is already populated, generate a fake notification
          this.onFoldersSplice(0, 0, this.foldersSlice.items, true, false);

          // Listen for changes in the foldersSlice.
          // TODO: perhaps slices should implement an event listener
          // interface vs. only allowing one handler. This is slightly
          // dangerous in that other cards may access model.foldersSlice
          // and could decide to set these handlers, wiping these ones
          // out. However, so far folder_picker is the only one that cares
          // about these dynamic updates.
          this.foldersSlice.onsplice = this.onFoldersSplice.bind(this);
        });
      }
    },

    /**
     * Tapping a different account will jump to the inbox for that
     * account, but only do the jump if a new account selection,
     * and only after hiding the folder_picker.
     */
    onClickAccount: function(accountNode, event) {
      this.curAccount = accountNode.account;

      // Store the ID and wait for the closing animation to finish
      // for the card before switching accounts, so that the
      // animations are smoother and have fewer jumps.
      this._waitingAccountId = this.curAccount.id;
      this._closeCard();
    },

    /**
     * Used to populate the account list.
     */
    onAccountsSplice: function(index, howMany, addedItems,
                               requested, moreExpected) {
      let accountListContainer = this.accountListContainer;

      // Note! We get called before the splice() is run on this.acctsSlice.items
      let postSliceCount = this.acctsSlice.items.length +
                           addedItems.length - howMany;

      this.classList.toggle('one-account', postSliceCount <= 1);

      // Clear out accounts that have been removed
      let account;
      if (howMany) {
        for (let i = index + howMany - 1; i >= index; i--) {
          account = this.acctsSlice.items[i];
          if (account.element) {
            accountListContainer.removeChild(account.element);
          }
        }
      }

      let insertBuddy = (index >= accountListContainer.childElementCount) ?
                          null : accountListContainer.children[index];

      // Add DOM for each account
      addedItems.forEach((account) => {
        if (account.syncEnable) {
          let accountNode = account.element =
              fldAccountItemNode.cloneNode(true);
          accountNode.account = account;
          this.updateAccountDom(account, true);
          accountListContainer.insertBefore(accountNode, insertBuddy);
        }
      });

      this.setNavigationMap();
    },

    onAccountsChange: function(account) {
      this.updateAccountDom(account, false);
    },

    updateAccountDom: function(account, firstTime) {
      let accountNode = account.element;

      if (firstTime) {
        accountNode.querySelector('.fld-account-name')
          .textContent = account.name;
        accountNode.querySelector('.fld-account-label')
          .innerHTML = account.label;

        // Highlight the account currently in use
        if (this.curAccount && this.curAccount.id === account.id) {
          accountNode.classList.add('fld-account-selected');
          accountNode.querySelector('input').setAttribute("checked", true);
        }
      }
    },

    onFoldersSplice: function(index, howMany, addedItems,
                               requested, moreExpected) {
      let foldersContainer = this.foldersContainer;

      let folder;
      if (howMany) {
        for (let i = index + howMany - 1; i >= index; i--) {
          folder = this.foldersSlice.items[i];
          foldersContainer.removeChild(folder.element);
        }
      }

      let insertBuddy = (index >= foldersContainer.childElementCount) ?
                          null : foldersContainer.children[index];
      addedItems.forEach((folder) => {
        let folderNode = folder.element = fldFolderItemNode.cloneNode(true);
        folderNode.folder = folder;
        if (folder.type === 'outbox') {
          if (folder.unread > 0) {
            folderNode.classList.remove('collapsed');
          } else {
            folderNode.classList.add('collapsed');
          }
        }
        this.updateFolderDom(folder, true);
        foldersContainer.insertBefore(folderNode, insertBuddy);
      });

      this.setNavigationMap();
    },

    updateFolderDom: function(folder, firstTime) {
      let folderNode = folder.element;

      if (firstTime) {
        if (!folder.selectable) {
          folderNode.classList.add('fld-folder-unselectable');
        }

        let depthIdx = Math.min(FOLDER_DEPTH_CLASSES.length - 1, folder.depth);
        folderNode.classList.add(FOLDER_DEPTH_CLASSES[depthIdx]);
        if (depthIdx > 0) {
          folderNode.classList.add('fld-folder-depthnonzero');
        }

        folderNode.querySelector('.fld-folder-name')
          .textContent = folder.name;

        if (folder.unread > 0) {
          folderNode.querySelector('.fld-folder-unread')
            .textContent = '(' + folder.unread + ')';
        }

        folderNode.dataset.type = folder.type;
      }

      if (folder === this.curFolder) {
        folderNode.classList.add('fld-folder-selected');
      } else {
        folderNode.classList.remove('fld-folder-selected');
      }
    },

    onClickFolder: function(folderNode, event) {
      let folder = folderNode.folder;
      if (!folder.selectable) {
        return;
      }

      let oldFolder = this.curFolder;
      this.curFolder = folder;
      this.updateFolderDom(oldFolder);
      this.updateFolderDom(folder);

      this._showFolder(folder);
      this._closeCard();
    },

    onTransitionEnd: function(event) {
      let switchDone = () => {
        let text = mozL10n.get('toaster-switch-account');
        if (this.curAccount.label) {
          text = text + this.curAccount.label;
        } else {
          text = text + this.curAccount.name;
        }

        toaster.toast({
          text: text
        });
      };

      // If this is an animation for the content closing, then
      // it means the card should be removed now.
      if (!this.classList.contains('opened') &&
          event.target.classList.contains('fld-content')) {
        cards.removeCardAndSuccessors(this, 'animate');
        if (this.folderPickCard && this.folderShown === true) {
          this.folderPickCard.goBack();
          this.folderPickCard = null;
        }
        this.folderShown = false;

        // After card is removed, then switch the account, to provide
        // smooth animation on closing of drawer.
        if (this._waitingAccountId) {
          model.changeAccountFromId(this._waitingAccountId, () => {
            model.selectInbox(switchDone);
          });
          this._waitingAccountId = null;
        }
      }
    },

    // Closes the card. Relies on onTransitionEnd to do the
    // final close, this just sets up the closing transition.
    _closeCard: function() {
      evt.emit('folderPickerClosing');
      this.classList.remove('opened');
    },

    /**
     * Tell the message-list to show this folder; exists for single code path.
     */
    _showFolder: function(folder) {
      this.folderShown = true;
      model.changeFolder(folder);
    },

    /**
     * When the card is visible, start the animations to show the content
     * and fade in the tap shield.
     */
    onCardVisible: function(navDirection) {
      this.classList.add('opened');
      this.setNavigationMap(navDirection);
      this.keydownHandler = this.handleKeydown.bind(this);
      this.addEventListener('keydown', this.keydownHandler);
    },

    setNavigationMap: function(navDirection) {
      if (this.className.indexOf('card center') < 0) {
        return;
      }
      const CARD_NAME = this.localName;
      const QUERY_CHILD = (this.mode === 'folder') ?
          '.fld-folder-item:not(.collapsed)' :
          '.fld-account-item:not(.collapsed)';
      const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

      let hasFocus = !!this.querySelector('.fld-content-container .focus');
      // forward: new card pushed
      if (navDirection === 'forward' || !navDirection) {
        this.initOption();
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        if (!hasFocus) {
          NavigationMap.setFocus('first');
        }
      }
      // back: hidden card is restored
      else if (navDirection === 'back') {
        this.initOption();
        NavigationMap.setCurrentControl(CONTROL_ID);
        if (!hasFocus) {
          NavigationMap.setFocus('restore');
        }
      }
    },

    /**
     * Our card is going away; perform all cleanup except destroying our DOM.
     * This will enable the UI to animate away from our card without weird
     * graphical glitches.
     */
    die: function() {
      if (this.acctsSlice) {
        this.acctsSlice.die();
      }
      model.removeListener('account', this.updateAccount);
      this.removeListener('keydown', this.keydownHandler);
    },

    mode: 'folder',

    optCancel: null,
    optSave: null,

    initOption: function() {
      this.optCancel = {
        name: 'Cancel',
        l10nId: 'cancel',
        priority: 1,
        method: this._closeCard.bind(this)
      };
      this.optSave = {
        name: 'Select',
        l10nId: 'select',
        priority: 2,
        method: null // method=null, as CSK map to item click
      };

      let options = [this.optCancel, this.optSave];
      NavigationMap.setSoftKeyBar(options);
    },

    onSelectFocused: function() {
      let node = NavigationMap.getCurrentItem();
      if (node) {
        node.click();
      }
    },

    onHidden: function() {
      this.removeListener('keydown', this.keydownHandler);
    },

    handleKeydown: function(evt) {
      switch (evt.key) {
        case 'Backspace':
          evt.preventDefault();
          if (window.backToShowFolder &&
              this.localName !== 'cards-account-picker') {
            this.foldersContainer.childNodes[0].click();
          } else {
            this._closeCard();
          }
        break;
      }
    }
  }
];
});
