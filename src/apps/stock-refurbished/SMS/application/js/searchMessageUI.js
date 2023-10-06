(function(exports) {
  'use strict';

  exports.SearchMessageUI = {
    init: function () {
      let searchMessage = document.getElementById('searchMessage');
      if (searchMessage.innerHTML.length === 0) {
        let template = Template('searchMessageViewTmpl');
        searchMessage.innerHTML = template.toString();
      }

      this.searchInput = document.getElementById('search-input');
      this.searchBox = document.getElementById('messages-search-form');
      this.searchList = document.getElementById('search-thread-list');
      this.searchInput.addEventListener('focus',
        this.onSearchInputChange.bind(this));
      this.searchInput.addEventListener('blur',
        this.onSearchInputChange.bind(this));

      this.searchInput.addEventListener('input',
        this.onSearchInputContentChange.bind(this));
    },

    searchItem: function(searchInput) {
      if (searchInput.length === 0) {
        return;
      }

      function updateContacts(threadNumber, threadNode) {
        Contacts.findByAddress(threadNumber, (contacts) => {
          if (contacts.length !== 0 && contacts[0].name) {
            threadNode.querySelector('.threadlist-item-title').
              querySelector('bdi').textContent = contacts[0].name;
          }
          SearchMessageUI.searchList.appendChild(threadNode);
        });
      }

      function createNodes(thread) {
        let node = ThreadListUI.createThread(thread);
        ThreadListUI.setContact(node);
        let checkBox = node.querySelector('.pack-checkbox-large');
        checkBox.classList.add('hide');
        return node;
      }

      function searchContacts(threadNumber, thread) {
        Contacts.findByAddress(threadNumber, (contacts) => {
          if (contacts.length !== 0) {
           if (contacts[0].name[0].toLowerCase().indexOf(
             searchInput.toLowerCase()) >= 0) {
              let node = createNodes(thread);
              node.querySelector('.threadlist-item-title').
                querySelector('bdi').textContent = contacts[0].name;
              SearchMessageUI.searchList.appendChild(node);
            }
          }
        });
      }

      function onRenderThread(thread) {
        for (let i = 0; i < thread.participants.length; i++) {
          if (thread.participants[i].indexOf(searchInput) >= 0) {
            let node = createNodes(thread);
            updateContacts(thread.participants[i], node);
          } else {
            searchContacts(thread.participants[i], thread);
          }
        }
      }

      function realSearchAction(draft, count, isContactSearched) {
        if (draft.recipients[count].indexOf(searchInput) >= 0 || isContactSearched) {
          let body = draft.content && draft.content.length ?
            draft.content.find(function(content) {
              if (typeof content === 'string') {
                return true;
              }
            }) : '';
          let newDraft = {
            id: draft.id,
            participants: draft.recipients && draft.recipients.length ?
                          draft.recipients : [''],
            body: body,
            timestamp: new Date(draft.timestamp),
            unreadCount: 0,
            lastMessageType: draft.type || 'sms',
            isGroup: draft.isGroup || false
          };
          let node = createNodes(newDraft);
          SearchMessageUI.searchList.appendChild(node);
        }
      }

      MessageManager.getThreads({
        each: onRenderThread.bind(this)
      });

      Drafts.request(true).then(() => {
        Drafts.forEach((draft, threadId) => {
          if (!threadId) {
            for (let i = 0; i < draft.recipients.length; i++) {
              Contacts.findByAddress(draft.recipients[i], (contacts) => {
                if (contacts.length !== 0) {
                  if (contacts[0].name[0].toLowerCase().indexOf(
                      searchInput.toLowerCase()) >= 0) {
                    realSearchAction(draft, i, true);
                  } else {
                    realSearchAction(draft, i, false);
                  }
                } else {
                  realSearchAction(draft, i, false);
                }
              });
            }
          }
        });
      });
    },

    onSearchInputChange: function(e) {
      this.searchBox.classList.toggle('search-focus', e.type === 'focus');
      if (e.type === 'blur') {
        if (this.searchList.children) {
          let isSearchBox = Array.from(this.searchList.children).some(item =>
            item.classList.contains('focus')
          );
          this.updateSKs(isSearchBox);
        } else {
          // No thread list but the event is a blur event.
          this.updateSKs(false);
        }
      } else {
        this.updateSKs(false);
      }
    },

    onSearchInputContentChange: function(event) {
      if (!event.isComposing) {
        this.searchList.innerHTML = '';
        this.searchItem(this.searchInput.value);
      }
    },

    beforeLeave: function() {
      window.removeEventListener('keydown', this);
    },

    afterEnter: function() {
      this.updateSKs(false);
      window.addEventListener('keydown', this);
    },

    handleEvent: function(e) {
      switch(e.key) {
        case 'Backspace':
          e.preventDefault();
          this.searchList.innerHTML = '';
          this.searchInput.value = '';
          Navigation.toPanel('thread-list');
          break;
        case 'Accept':
        case 'Enter':
          e.preventDefault();
          if (document.activeElement.classList.contains('threadlist-item')) {
            let threadId = document.activeElement.id;
            // Change id type from string to number.
            let id = +threadId.replace('thread-', '');
            ThreadUI.draft = Drafts.get(id) || null;
            ThreadUI.addAllEventListener();
            if (document.activeElement.classList.contains('is-draft')) {
              Navigation.toPanel('composer', { draftId: id });
            } else {
              Navigation.toPanel('thread', { id: id });
            }
            this.searchList.innerHTML = '';
            this.searchInput.value = '';
          }
          break;
        case 'ArrowUp':
          document.activeElement.scrollIntoView(false);
          break;
      }
    },

    updateSKs: function(isFocus) {
      let skCancel = {
        l10nId: 'cancel',
        priority: 1,
        method: function() {
          SearchMessageUI.searchList.innerHTML = '';
          SearchMessageUI.searchInput.value = '';
          Navigation.toPanel('thread-list');
        }
      };

      let skSelect = {
        l10nId: 'select',
        priority: 2
      };

      let params = {
        header: {l10nId: 'options'},
        items: [skCancel]
      };

      if (isFocus) {
        params.items.push(skSelect);
      }

      if (exports.option) {
        exports.option.initSoftKeyPanel(params);
      } else {
        exports.option = new SoftkeyPanel(params);
      }
      exports.option.show();
    }
  };
}(this));
