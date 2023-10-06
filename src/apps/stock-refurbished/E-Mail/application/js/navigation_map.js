

(function(exports) {
  const CHANGE_MODE = {
    none: 'none',
    added: 'added',
    removed: 'removed'
  };

  let controls = {};
  let curConctrolId = null;

  let nav_id = 0;

  /*store the focused element when option menu is opened,
    and restore it after option menu is closed,
    it should be set null if a new navigable list is created
    in one item of option menu to prevent restore*/
  let _storeFocused = null;
  const LOWSTORAGE = 10 * 1024 * 1024;

  function navUpdate(elements, containerName) {
    let id = nav_id;  /*to avoid 'data-nav-id' reproduced with grid*/

    for (let i = 0; i < elements.length; i++) {
      elements[i].setAttribute('data-nav-id', id);
      elements[i].style.setProperty('--nav-left', -1); //-1: invalid ID
      elements[i].style.setProperty('--nav-right', -1);
      elements[i].style.setProperty('--nav-down', id + 1);
      elements[i].style.setProperty('--nav-up', id - 1);
      elements[i].setAttribute('tabindex', 0);
      id++;
    }

    if (containerName === 'cards-message-list'
        && !elements[0].classList.contains('menu-button') &&
        NavigationMap.messageListMailCount > elements.length) {
      if (elements[0].dataset.index === '0') {
        elements[0].style.setProperty('--nav-up', 'jumpToTail');
      }

      let len = elements.length - 1;
      let listIndex = (NavigationMap.messageListMailCount - 1).toString();
      if (elements[len].dataset.index === listIndex ||
          elements[len].classList.contains('msg-messages-sync-more')) {
        elements[len].style.setProperty('--nav-down', 'jumpToHead');
      }
    } else {
      let topToBottom;
      let bottomToTop;
      if (containerName === 'cards-message-reader' ||
          containerName === 'cards-compose') {
        topToBottom = -1;
        bottomToTop = -1;
      } else {
        topToBottom = id - 1;
        bottomToTop = nav_id;
      }
      //top element
      elements[0].style.setProperty('--nav-up', topToBottom);
      //bottom element
      elements[elements.length - 1].style.setProperty('--nav-down',
                                                      bottomToTop);
    }
    nav_id = id;
  }

  function navUpdateHorizontal(elements, parentElements, callBack) {
    let id = nav_id;
    let element = null;
    let len = elements.length;
    let seriesElement = null;

    for (let i = 0; i < len; i++) {
      element = elements[i];
      for (let j = 0; j < parentElements.length; j++) {
        let childrenElements = parentElements[j].children;
        if (childrenElements.length > 0) {
          for (let k = 0; k < childrenElements.length; k++) {
            if (childrenElements[k] === element.parentNode.parentNode) {
              seriesElement = parentElements[j];
              break;
            }
          }
        }
        if (seriesElement) {
          break;
        }
      }
      if (seriesElement) {
        break;
      }
    }

    if (!seriesElement) {
      return;
    }

    let series = seriesElement.getAttribute('data-nav-id');
    let up = seriesElement.style.getPropertyValue('--nav-up');
    let down = seriesElement.style.getPropertyValue('--nav-down');

    for (let i = 0; i < len; i++) {
      element = elements[i];
      element.setAttribute('data-nav-id', id);
      if (i === 0) {
        element.style.setProperty('--nav-left', series);
      } else {
        element.style.setProperty('--nav-left', id - 1);
      }
      if (i === len - 1) {
        element.style.setProperty('--nav-right', series);
      } else {
        element.style.setProperty('--nav-right', id + 1);
      }
      element.style.setProperty('--nav-down', down);
      element.style.setProperty('--nav-up', up);
      element.setAttribute('tabindex', 0);
      id++;
    }

    let first = elements[0].getAttribute('data-nav-id');
    let last = elements[len - 1].getAttribute('data-nav-id');

    seriesElement.style.setProperty('--nav-left', last);
    seriesElement.style.setProperty('--nav-right', first);
    if (callBack) {
      callBack(seriesElement);
    }
    nav_id = id;
  }

  function getCurControl() {
    return controls[curConctrolId];
  }

  function getCurItem() {
    let item = null;
    let curControl = getCurControl();

    if (curControl) {
      if (curControl.index >= 0 &&
          curControl.index < curControl.elements.length) {
        item = curControl.elements[curControl.index];
      }
    }
    return item;
  }

  function sendIndexEvent(id, index, item) {
    let evt = new CustomEvent('index-changed', {
      detail: {
        id: id,
        index: index,
        focusedItem: item
      },
      bubbles: true,
      cancelable: false
    });

    window.dispatchEvent(evt);
  }

  function setCurIndex(index) {
    let curControl = getCurControl();

    if (curControl) {
      if (index >= -1 && index < curControl.elements.length) {
        curControl.index = index;

        let container = curControl.container;
        if (container && container.onFocusChanged) {
          container.onFocusChanged(curControl.queryChild, index,
            (index === -1) ? null : curControl.elements[index]);
        }

        /*broadcoast change event*/
        sendIndexEvent(curConctrolId, index,
          (index === -1) ? null : curControl.elements[index]);
      }
    }
  }

  function observeChange(queryContainer, queryItem, cb) {
    let container = (queryContainer === undefined) ?
        document.body : document.querySelector(queryContainer);

    let config = {
      childList: true,
      subtree: true
    };

    let observer = new MutationObserver(function (mutations) {
      let changed = CHANGE_MODE.none;
      let nodes = [];

      mutations.forEach(function (mutation) {
        if (changed === true) {
          return;
        }

        if (mutation.type === 'childList') {
          if (mutation.addedNodes.length > 0) {
            nodes = Array.prototype.slice.call(mutation.addedNodes);
            nodes.forEach(function (node) {
              if (node.matches && node.matches(queryItem)) {
                changed = CHANGE_MODE.added;
              }
            });
          }
          if (mutation.removedNodes.length > 0) {
            nodes = Array.prototype.slice.call(mutation.removedNodes);
            nodes.forEach(function (node) {
              if (node.matches && node.matches(queryItem)) {
                changed = CHANGE_MODE.removed;
              }
            });
          }
        }
      });

      if (changed !== CHANGE_MODE.none) {
        let id = queryContainer + ' ' + queryItem;
        if (queryContainer === 'cards-message-list-search') {
          id = queryContainer + ' .focusable, ' + id;
        }
        if (controls[id]) {
          // re-setup navigation
          NavigationMap.navSetup(queryContainer, queryItem, cb);

          if (changed === CHANGE_MODE.added) {
            onNodesAdded(id);
          } else if (changed === CHANGE_MODE.removed) {
            onNodesRemoved(id);
          }
        }

        // indicate container that child list changed
        if (container.onChildChanged) {
          container.onChildChanged(queryItem, changed);
        }
      }
    });

    observer.observe(container, config);
    return observer;
  }

  function onNodesAdded(id) {
    if (curConctrolId !== id) {
      return;
    }
    let control = controls[id];

    if (control && control.elements.length > 0) {
      if (window.option.menuVisible === false) {
        let localName = control.container.localName;
        if (localName === 'cards-message-list' ||
            localName === 'cards-message-list-search') {
          let listId;
          let focused = document.querySelector('.focus');
          if (focused && !focused.classList.contains('vscroll-node')) {
            return;
          }

          if (NavigationMap.searchMode) {
            listId = NavigationMap.currentSearchId;
          } else {
            listId = NavigationMap.currentMessageId;
          }
          if (listId !== 'INVALID') {
            NavigationMap.setMessageListFocus(listId);
          } else if (focused && focused.message) {
            let id = focused.message.id;
            if (id && id !== 'INVALID') {
              NavigationMap.setMessageListFocus(id);
            }
          }
        } else {
          NavigationMap.setFocus((control.index === -1) ? 0 : control.index);
        }
      } else {
        //option menu is shown, just update index, not change focus
        if (_storeFocused) {
          _storeFocused.classList.remove('hasfocused');
          _storeFocused = control.elements[control.index];
          _storeFocused.classList.add('hasfocused');
        }
        setCurIndex(control.index);
      }
    }
  }

  function onNodesRemoved(id) {
    let control = controls[id];
    console.log('onNodesRemoved, id: ' + id);

    if (!control) {
      return;
    }

    let container = control.container;
    let focused = container ? container.querySelector('.focus') : null;
    let index = 0;

    // the focused item was not removed, just update index
    if (focused) {
      let elements = Array.prototype.slice.call(control.elements);
      index = elements.indexOf(focused);
      if (control.index === -1) {
        console.log('onNodesRemoved error: focused item was not removed,' +
                    'but can not be found');
      } else {
        // focus was not changed,
        // but still call setCurIndex to generate 'index-changed' event
        setCurIndex(index);
      }
    }
    // focused item was removed,
    // or the background list(not current control) was changed
    else {
      if (control.index >= 0 && control.index < control.elements.length) {
        // reset the focus at the item with same index
        index = control.index;
      } else if (control.index >= control.elements.length) {
        // the removed item was last none, keep focus on last one
        index = control.elements.length - 1;
      }

      if (curConctrolId === id && window.option.menuVisible === false) {
        // update focus for current control
        NavigationMap.setFocus(index);
      } else {
        // for the background changed list, only update index
        control.index = index;
      }
    }
  }

  let NavigationMap = {
    // a variable for confirmDialog to prevent the conflict in SoftKeyBar
    currentActivatedLength: 0,
    searchMode: false,
    messageListMailCount: 0,
    cardContentHeight: 0,
    currentMessageId: null,
    currentSearchId: null,
    scrollUp: 0,
    horizontal: null,
    needDelayToFocus: false,

    updateListId: function(toFocused) {
      if (toFocused && toFocused.message) {
        let curControl = getCurControl();
        let localName = curControl.container.localName;
        if (localName === 'cards-message-list') {
          this.currentMessageId = toFocused.message.id;
        } else if (localName === 'cards-message-list-search') {
          this.currentSearchId = toFocused.message.id;
        }
      } else if (toFocused.classList.contains('msg-messages-sync-more')) {
        this.currentMessageId = 'load-more';
      }
    },

    init: function _init() {
      console.log('NavigationMap init');
      document.addEventListener('focusChanged', (e) => {
        let focusedItem = e.detail.focusedElement;
        let curControl = getCurControl();
        this.updateListId(focusedItem);

        if (curControl && curControl.elements) {
          // convert to an array
          let elements = Array.prototype.slice.call(curControl.elements);
          // find the index of focused item in current control
          let index = elements.indexOf(focusedItem);
          if (index >= 0) {
            // update index
            setCurIndex(index);
            console.log('current index updated: ' + index);
          } else if (focusedItem.dataset.navId === 'jumpToHead' ||
              focusedItem.dataset.navId === 'jumpToTail') {
            let container = curControl.container;
            if (container && container.onFocusChanged) {
              container.onFocusChanged(curControl.queryChild,
                  focusedItem.dataset.navId, focusedItem);
            }
          }
        }
      });

      window.addEventListener('menuEvent', (e) => {
        if (e.detail.menuVisible) {
          let focused = document.querySelector('.focus');
          if (focused && !focused.account) {
            focused.classList.add('hasfocused');
            _storeFocused = focused;
          }
          this.optionReset();
        } else {
          if (curConctrolId !== 'cards-compose .focusable' ||
              !this.configDialogShown()) {
            let delayTime = 0;
            if (this.needDelayToFocus) {
              this.needDelayToFocus = false;
              delayTime = 300;
            }
            setTimeout(() => {
              this.restoreFocus();
            }, delayTime);
          }
        }
      });
    },

    checkStorage: function() {
      let dialogConfig = {
        title: {
          id: 'storage-full-title',
          args: {}
        },
        body: {
          id: 'storage-full-warning',
          args: {}
        },
        cancel: {
          l10nId: 'opt-cancel',
          priority: 1
        },
        confirm: {
          l10nId: 'opt-settings',
          priority: 3,
          callback: () => {
            let activity = new MozActivity({
              name: 'configure',
              data: {
                target: 'device',
                section: 'mediaStorage'
              }
            });
            activity.onerror = () => {
              console.warn('Configure activity error:', activity.error.name);
            };
          }
        }
      };

      let storage = navigator.getDeviceStorage('sdcard');
      storage.available().onsuccess = (e) => {
        if (e.target.result === 'available') {
          storage.freeSpace().onsuccess = (e) => {
            if (e.target.result < LOWSTORAGE) {
              this.showConfigDialog(dialogConfig);
            }
          }
        }
      };
    },

    restoreFocus: function() {
      if (_storeFocused) {
        _storeFocused.classList.remove('hasfocused');
        _storeFocused.classList.add('focus');
        _storeFocused.focus();
        let curCon = getCurControl();
        let container = curCon.container;
        if (container &&
            container.localName === 'cards-message-list') {
          if (container.onFocusChanged) {
            container.onFocusChanged(curCon.queryChild, null, _storeFocused);
          }
        } else {
          setCurIndex(curCon.index);
        }
        _storeFocused = null;
      }
    },

    isVisible: function(bestElementToFocus) {
      if (bestElementToFocus.offsetWidth === 0 ||
          bestElementToFocus.offsetHeight === 0) {
        return false;
      }

      let clientHeight = document.documentElement.clientHeight;
      let skHeight = document.getElementById('softkeyPanel').clientHeight;
      let height = clientHeight - skHeight;
      let contentHeight = NavigationMap.cardContentHeight;
      let rects = bestElementToFocus.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        let r = rects[i];
        let inView = false;
        let topTarget = height - contentHeight;
        if ((r.bottom > 0 && r.bottom <= height) && (r.top >= topTarget)) {
          inView = true;
        }
        if (inView) {
          return true;
        }
      }
      return false;
    },

    setMessageListFocus: function(messageId, bDelete) {
      let curCon = getCurControl();
      if (!curCon || curCon.container.className !== 'card center') {
        return;
      }

      let toFocused;
      let bJumpUp = false;

      if (messageId && curCon.elements) {
        for (let i = 0; i < curCon.elements.length; i++) {
          if (curCon.elements[i]) {
            if (curCon.elements[i].message) {
              let id = curCon.elements[i].message.id;
              if (id === messageId) {
                if (bDelete && i < curCon.elements.length - 1) {
                  toFocused = curCon.elements[i + 1];
                } else {
                  toFocused = curCon.elements[i];
                }
                break;
              }
            } else {
              if (messageId === 'load-more' &&
                  curCon.elements[i].classList.contains(
                      'msg-messages-sync-more')) {
                toFocused = curCon.elements[i];
                break;
              }
            }
          }
        }
      }

      if (!toFocused) {
        for (let i = 0; i < curCon.elements.length; i++) {
          if (curCon.elements[i] && curCon.elements[i].message) {
            toFocused = curCon.elements[i];
            bJumpUp = true;
            break;
          }
        }
      }

      if (toFocused) {
        if (window.option.menuVisible) {
          _storeFocused = toFocused;
          _storeFocused.classList.add('hasfocused');
          return;
        }
        let focused = document.querySelectorAll('.focus');
        for (let i = 0; i < focused.length; i++) {
          focused[i].classList.remove('focus');
        }
        if (toFocused.message) {
          console.log('set message list focus to : ' +
              toFocused.message.id);
        }
        // we only need update message id when bDelete is true,
        // after node changed, will really set focus.
        if (!bDelete) {
          toFocused.setAttribute('tabindex', 1);
          toFocused.classList.add('focus');

          if (!this.isVisible(toFocused)) {
            if (this.scrollUp > 0 || bJumpUp) {
              toFocused.scrollIntoView(true);
            } else if (this.scrollUp < 0) {
              toFocused.scrollIntoView(false);
            }
            this.scrollUp = 0;
          }

          toFocused.focus();
        }
        this.updateListId(toFocused);
      } else {
        this.setFocus('first');
      }

      let container = curCon.container;
      if (container && container.onFocusChanged) {
        container.onFocusChanged(curCon.queryChild, null, toFocused);
      }
    },

    /*set focus for current panel*/
    setFocus: function _setFocus(id) {
      console.log('set focus to the id: ' + id);
      let curControl = getCurControl();
      let toFocused;
      if (!curControl) {
        console.log('setFocus failed!');
        return;
      }

      id = id || 0;
      if (id === 'restore') {
        id = curControl.index;
        if (id >= curControl.elements.length) {
          id = curControl.elements.length - 1;
        } else if (id < 0 && curControl.elements.length > 0) {
          id = 0;
        }
      }
      id = (id === 'first') ? (curControl.elements.length > 0 ? 0 : -1) :
           ((id === 'last') ? curControl.elements.length - 1 : id);

      if (id >= 0 && id < curControl.elements.length) {
        // remove current focus, only one element has focus
        let focused = document.querySelectorAll('.focus');
        for (let i = 0; i < focused.length; i++) {
          focused[i].classList.remove('focus');
        }

        toFocused = curControl.elements[id];
        toFocused.setAttribute('tabindex', 1);
        toFocused.classList.add('focus');

        if (id === 0 &&
            curControl.container.localName.indexOf('cards-settings') < 0) {
          toFocused.scrollIntoView(true);
        } else if (id === curControl.elements.length - 1 &&
            curControl.container.localName !== 'cards-message-reader') {
          toFocused.scrollIntoView(false);
        }

        toFocused.focus();
      } else if (id > curControl.elements.length) {
        toFocused = curControl.elements[curControl.elements.length - 1];
        toFocused.setAttribute('tabindex', 1);
        toFocused.classList.add('focus');
        toFocused.focus();

        let evt = { key: 'ArrowDown' };
        this.scrollToElement(toFocused, evt);
      }

      if (toFocused) {
        this.updateListId(toFocused);
      }
      // id may be -1
      setCurIndex(id);
    },

    /*setup navigation for the items that queried from a container.
    @paramters:
        queryContainer: card type(custom element),
        undefined: coantainer = body, navigable but no control
        queryChild: to search the children under contaier
    */
    navSetup: function _setup(queryContainer, queryChild, cb, series) {
      let elements = [];
      let container;
      let id = queryContainer + ' ' + queryChild;

      if (queryContainer === 'cards-message-list-search') {
        id = queryContainer + ' .focusable, ' + id;
        queryChild = '.focusable, ' + queryChild;
      }

      container = (queryContainer === undefined) ?
          document.body : document.querySelector(queryContainer);

      if (container) {
        let tElements = container.querySelectorAll(queryChild);
        for (let i = 0; i < tElements.length; i++) {
          if (tElements[i].classList.contains('peep-bubble')) {
            continue;
          }
          elements.push(tElements[i]);
        }

        if (elements.length > 0) {
          if (cb) {
            elements = cb(elements);
          }
          navUpdate(elements, container.localName);
          //
          if (this.horizontal) {
            let hContainer = container.querySelector(this.horizontal);
            let hElements = hContainer.querySelectorAll('.peep-bubble');
            if (hElements.length > 0) {
              navUpdateHorizontal(hElements, elements, series);
            } else if (series) {
              series(hContainer.parentNode);
            }
            this.horizontal = null;
          }
        }
      }

      if (id && elements.length > 0) {
        if (!controls[id]) {
          controls[id] = {};
          controls[id].index = (elements.length > 0) ? 0 : -1;
        }
        controls[id].container = container;
        controls[id].elements = elements;
        // maybe more one list under a container store queryChild to
        // indicate the list
        controls[id].queryChild = queryChild;
      }
    },

    /*observe child changing(added or removed) of a parent node
       @queryParent: to find the parent node,
       @queryChild: to find the children under the parent node
    */
    observeChild: function _observe(queryParent, queryChild, cb) {
      return observeChange(queryParent, queryChild, cb);
    },

    /*option menu*/
    optionReset: function _reset() {
      const MAIN_MENU = 'menu#mainmenu';
      const SUB_MENU = 'menu[data-subtype="submenu"]';
      const MENU_BUTTON = '.menu-button';
      const id = MAIN_MENU + ' ' + MENU_BUTTON;

      this.navSetup(MAIN_MENU, MENU_BUTTON);

      // set navigation for sub menu
      let subMenu = document.querySelectorAll(SUB_MENU);
      for (let i = 0; i < subMenu.length; i++) {
        NavigationMap.navSetup('#' + subMenu[i].id, MENU_BUTTON);
      }

      // remove current focus, only one element has focus
      let focused = document.querySelectorAll('.focus');
      for (let i = 0; i < focused.length; i++) {
        focused[i].classList.remove('focus');
      }

      let toFocused = controls[id].elements[0];
      if (toFocused) {
        toFocused.setAttribute('tabindex', 1);
        toFocused.classList.add('focus');

        toFocused.focus();
        this.updateListId(toFocused);
      }
    },

    /*get the focused item (element)*/
    getCurrentItem: function _currentItem() {
      return getCurItem();
    },

    /*return current control(the focusable elements of current shown panel)*/
    getCurrentControl: function _currentControl() {
      return getCurControl();
    },

    setSoftKeyBar: function _setSoftKeyBar(actions, header) {
      let emptyMenu = [{
        name: '',
        priority: 3,
        method: () => {}
      }];

      if (actions.length === 0) {
        actions = emptyMenu;
      }

      if (!header) {
        header = { l10nId: 'softkey-options' };
      }

      let skbParams = {
        header: header,
        items: actions
      };

      if (exports.option) {
        exports.option.initSoftKeyPanel(skbParams);
      } else {
        exports.option = new SoftkeyPanel(skbParams);
      }
      exports.option.show();
    },

    setCurrentControl: function _setCurControl(id) {
      console.log('setCurrentControl, id=' + id);

      if (id !== curConctrolId && _storeFocused) {
        _storeFocused.classList.remove('hasfocused');
        // control changed, prevent focus restoring
        _storeFocused = null;
      }

      let oldID = curConctrolId;
      curConctrolId = id;
      return oldID;
    },

    scrollToElement: function _scroll(bestElementToFocus, evt) {
      console.log('NavigationMap scrollToElement');

      if (bestElementToFocus.classList.contains('msg-body-container') ||
          bestElementToFocus.classList.contains('cmp-body-html')) {
        return;
      }

      if (!this.isVisible(bestElementToFocus)) {
        switch (evt.key) {
          case 'ArrowDown':
            bestElementToFocus.scrollIntoView(false);
            break;
          case 'ArrowUp':
            bestElementToFocus.scrollIntoView(true);
            break;
          }
        }
      },

      showConfigDialog: function(dialogConfig) {
        let dialog = new ConfirmDialogHelper(dialogConfig);
        let content = document.getElementById('confirm-dialog-container');
        dialog.show(content);
      },

      configDialogShown: function() {
        let confirm = document.getElementById('confirm-dialog-container');
        return confirm.innerHTML.length > 0;
      },

      handleClick: function(evt) {
        if (evt.target.classList.contains('msg-header-item') ||
            evt.target.classList.contains('list-item')) {
          evt.target.click();
        } else {
          evt.target.click();
          for (let i = 0; i < evt.target.children.length; i++) {
            evt.target.children[i].click();
          }
        }
      },

      isPortrait: function() {
        return screen.orientation.type.startsWith('portrait');
      },

      removeDiedControls: function(id) {
        delete controls[id];
      }
  };

  exports.NavigationMap = NavigationMap;

})(window);
