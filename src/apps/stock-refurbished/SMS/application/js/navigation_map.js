/* global Navigation */

(function(exports) {
  'use strict';

  //container id
  const THREAD_CONTAINER = 'thread-list';
  const MESSAGE_CONTAINER = 'thread-messages';
  const SETTINGS_CONTAINER = 'messaging-settings';
  const MESSAGES_INPUT = 'messages-input';
  const SEARCH_CONTAINER = 'searchMessage';
  //panel id
  const PANEL_THREAD_LIST = 'thread-list';
  const PANEL_SETTINGS = 'settings-view';
  const PANEL_COMPOSER = 'composer';
  const PANEL_THREAD = 'thread';
  //option menu is not a panel, but still keep it's elements
  const OPTION_MENU = 'option-menu';
  const PANEL_SEARCH_MESSAGE = 'search-message-view';
  const CHANGE_MODE = {
    none: 'none',
    added: 'added',
    removed: 'removed',
  };

  const TimeOut = 500;

  const DEBUG = true;

  function debug(message) {
    if (DEBUG) {
      console.log(message);
    }
  }

  /*the classes of option menu for navigation:
   'group-menu': softkey_panel.js, softkeybar's options
   'contact-prompt': thread_ui.js,the prompt options of phone number or email
   */
  const OPTION_MENU_CLASSES = ['group-menu', 'contact-prompt'];

  let controls = {};
  let curPanel = null;

  let nav_id = 0;
  let _storeFocused = null;
  let _savedId = null;

  function navUpdate(elements) {
    let id = nav_id;
    let element = null;
    let len = elements.length;

    for (let i = 0; i < len; i++) {
      element = elements[i];
      element.setAttribute('data-nav-id', id);

      element.style.setProperty('--nav-left', -1); // -1: invalid ID
      element.style.setProperty('--nav-right', -1);
      element.style.setProperty('--nav-down', id + 1);
      element.style.setProperty('--nav-up', id - 1);
      element.setAttribute('tabindex', 0);
      id++;
    }

    elements[0].style.setProperty('--nav-up', id - 1);
    elements[len - 1].style.setProperty('--nav-down', nav_id);
    nav_id = id;
  }

  function navUpdateHorizontal(elements) {
    let id = 0;
    let element = null;
    let len = elements.length;

    let first = elements[0].getAttribute('data-nav-id');
    let last = elements[len - 1].getAttribute('data-nav-id');

    let up = elements[0].style.getPropertyValue('--nav-up');
    let down = elements[len - 1].style.getPropertyValue('--nav-down');

    for (let i = 0; i < len; i++) {
      element = elements[i];
      id = parseInt(element.getAttribute('data-nav-id'));
      if (down === first && up === last) {
        element.style.setProperty('--nav-left', id);
        element.style.setProperty('--nav-right', id);
        element.style.setProperty('--nav-down', id);
        element.style.setProperty('--nav-up', id);
      } else {
        element.style.setProperty('--nav-left', id - 1);
        element.style.setProperty('--nav-right', id + 1);
        element.style.setProperty('--nav-down', down);
        element.style.setProperty('--nav-up', up);
      }
    }

    elements[0].style.setProperty('--nav-left', last);
    elements[len - 1].style.setProperty('--nav-right', first);
  }

  function getCurContainerId() {
    // XXX, use default container, unless it's messages container.
    // _savedId will be set when navSetup.
    let id = Navigation.panels[curPanel].container;
    if (_savedId === 'messages-container') {
      id = _savedId;
    }
    return id;
  }

  function getCurControl() {
    let control = null;
    let id = getCurContainerId();

    if (id) {
      control = controls[id];
    }
    return control;
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

  function sendIndexEvent(panel, index, item) {
    let evt = new CustomEvent('index-changed', {
      detail: {
        panel: panel,
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

        /*broadcoast change event*/
        sendIndexEvent(curPanel, index, (index === -1) ?
            null : curControl.elements[index]);
      }
    }
  }

  function observeChange(id) {
    let config = {
      childList: true,
      subtree: true,
      attributes: true,
    };

    let observer = new MutationObserver(function(mutations) {
      let changed = CHANGE_MODE.none;
      let nodes = [];

      mutations.forEach(function(mutation) {
        if (changed === true) {
          return;
        }

        if (mutation.type === 'childList') {
          if (mutation.addedNodes.length > 0) {
            nodes = Array.prototype.slice.call(mutation.addedNodes);
            nodes.forEach(function(node) {
              if (node.classList && node.classList.length > 0 && node.nodeName === 'LI') {
                debug('mutation: threadlist-item is added, id=' + node.id);
                changed = CHANGE_MODE.added;
              }
            });
          }
          else if (mutation.removedNodes.length > 0) {
            nodes = Array.prototype.slice.call(mutation.removedNodes);
            nodes.forEach(function(node) {
              if (node.classList && node.classList.length > 0 && node.nodeName === 'LI') {
                debug('mutation: threadlist-item is removed, id=' + node.id);
                changed = CHANGE_MODE.removed;
              }
            });
          }
        }
      });

      if (changed !== CHANGE_MODE.none) {
        NavigationMap.reset(id);

        if (changed === CHANGE_MODE.added) {
          onNodesAdded(id);
        }
        else if (changed === CHANGE_MODE.removed) {
          onNodesRemoved(id);
        }
      }
    });

    observer.observe(document.getElementById(id), config);
  }

  function onNodesAdded(containerId) {
    /*thread list is showing, and list is added*/
    if (curPanel === PANEL_THREAD_LIST && containerId === THREAD_CONTAINER) {
      //always focus on the new one
      if (window.option.menuVisible === false) {
        NavigationMap.setFocus('first');
      }
      else {
        //option menu is shown, just update index, not change focus
        let control = controls[containerId];
        if (control && control.elements.length > 0) {
          if (_storeFocused) {
            _storeFocused.classList.remove('hasfocused');
          }
          _storeFocused = control.elements[0];
          _storeFocused.classList.add('hasfocused');
        }
        setCurIndex(0);
      }
    }
  }

  function onNodesRemoved(containerId) {
    let control = controls[containerId];
    debug('onNodesRemoved, containerId:' + containerId);

    if (!control) {
      return;
    }

    let container = document.getElementById(containerId);
    let focused = container ? container.querySelector('.focus') : null;
    let index = 0;

    /*the focused item was not removed, just update index*/
    if (focused) {
      let elements = Array.prototype.slice.call(control.elements);
      index = elements.indexOf(focused);
      if (control.index === -1) {
        debug('onNodesRemoved error: focused item was not removed, but can\'t be found');
      }
      else {
        /*focus was not changed,
         but still call setCurIndex to generate 'index-changed' event */
        setCurIndex(index);
      }
    }
    /*focused item was removed,
     or the background list(not current panel) was changed*/
    else {
      if (control.index >= 0 &&
          control.index < control.elements.length) {
        /*reset the focus at the item with same index*/
        index = control.index;
      }
      else if (control.index >= control.elements.length) {
        /*the removed item was last none, keep focus on last one*/
        index = control.elements.length - 1;
      }

      if (getCurContainerId() === containerId) {
        /*update focus for current panel*/
        NavigationMap.setFocus(index);
      }
      else {
        /*for the background changed list, only update index*/
        control.index = index;
      }
    }
  }

  function optionMenu() {
    _storeFocused = document.querySelector('.focus');
    if (_storeFocused && _storeFocused.tagName !== 'INPUT') {
      _storeFocused.classList.add('hasfocused');
    }
    NavigationMap.optionReset();
    document.removeEventListener('transitionend', optionMenu);
  }

  function recoverFocus() {
    if (_storeFocused) {
      _storeFocused.classList.remove('hasfocused');
      if (!ThreadUI.cancelRecoverFocus) {
        _storeFocused.classList.add('focus');
        _storeFocused.focus();
      }
    }

    ThreadUI.cancelRecoverFocus = false;
    document.removeEventListener('transitionend', recoverFocus);
  }

  function observeOption() {
    let config = {
      attributes: true,
      chatacterData: true,
      subtree: true,
    };

    let observer = new MutationObserver(function(mutations) {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          let contained = false;
          /*check if the classes of option menu is contained*/
          OPTION_MENU_CLASSES.forEach((optClass) => {
            if (mutation.target.classList.contains(optClass)) {
              contained = true;
            }
          });

          if (!contained) {
            return;
          }

          if (mutation.target.classList.contains('visible')) {
            mutation.target.id = OPTION_MENU;  //assign id to option menu for navSetup
            document.addEventListener('transitionend', optionMenu);
          }
          else { //menu is closed
            document.addEventListener('transitionend', recoverFocus);
          }
        }
      });
    });

    observer.observe(document.body, config);
  }

  let NavigationMap = {
    toDraft: false,

    init: function _init() {
      window.addEventListener('moz-app-loaded', () => {
        NavigationMap.reset(THREAD_CONTAINER);

        observeChange(THREAD_CONTAINER);
        observeChange(MESSAGE_CONTAINER);
        observeChange(SEARCH_CONTAINER);
      });

      window.addEventListener('moz-app-cache-complete', () => {
        NavigationMap.reset(THREAD_CONTAINER);

        if (curPanel === PANEL_THREAD_LIST) {
          NavigationMap.setFocus('first');
        }
      });

      document.addEventListener('focusChanged', (e) => {
        let focusedItem = e.detail.focusedElement;
        debug('Received event focusChanged: id=' + (focusedItem ? focusedItem.id : null));

        let curControl = getCurControl();
        if (curControl && curControl.elements) {
          /*convert to an array*/
          let elements = Array.prototype.slice.call(curControl.elements);
          /*find the index of focused item in current control*/
          let index = elements.indexOf(focusedItem);
          if (index >= 0) {
            /*update index*/
            setCurIndex(index);
            debug('current index updated: ' + index);
          }
        }

        window.dispatchEvent(new CustomEvent('message-focusChanged', {
          bubbles: true,
          cancelable: false
        }));
      });

      observeOption();
    },

    /*set focus for current panel*/
    setFocus: function _setFocus(id) {
      debug('setFocus: curPanel=' + curPanel + ', id=' + id);

      // If there is option menu exist, we should not reset the focus.
      if (window.option && window.option.menuVisible) {
        document.addEventListener('transitionend', function optionMenu() {
          document.removeEventListener('transitionend', optionMenu);
          NavigationMap.setFocus(id);
        });
        return;
      }

      let curControl = getCurControl();
      if (!curControl || curControl.elements.length === 0) {
        debug('setFocus failed!');
        return;
      }

      debug('curIndex=' + curControl.index + ', length="' + curControl.elements.length);

      id = id || 0;
      id = (id === 'first') ? 0 : ((id === 'last') ?
          curControl.elements.length - 1 : id);

      if (id >= 0 && id < curControl.elements.length) {
        /*remove current focus, only one element has focus */
        let focused = document.querySelectorAll('.focus');
        for (let i = 0; i < focused.length; i++) {
          focused[i].classList.remove('focus');
        }
        // If the app is background, not focus immediately.
        if (!Startup.messageReceive || !document.hidden ||
            !Navigation.isCurrentPanel('thread-list')) {
          let toFocused = curControl.elements[id];
          toFocused.setAttribute('tabindex', 1);
          toFocused.classList.add('focus');

          toFocused.focus();
          toFocused.scrollIntoView(false);
        }
      } else if (id >= curControl.elements.length) {
        this.setFocus('first');
        return;
      }

      //id may be -1
      setCurIndex(id);
      window.dispatchEvent(new CustomEvent('message-focusChanged', {
        bubbles: true,
        cancelable: false
      }));
    },

    updateFocus: function() {
      // Do not should add focus class to body element.
      if (document.activeElement.tagName !== 'BODY') {
        document.activeElement.classList.add('focus');
      }
    },

    // A interface that make the will focus index update.
    updateCurIndex: function(id, containerId) {
      let control = controls[id];
      let node = document.getElementById(containerId);
      let nodeArray = Array.prototype.slice.call(control.elements);
      control.index = nodeArray.indexOf(node);
    },

    /**
     * setup navigation for the items that query from a container.
     *
     * @param: containerId: the id of the container element, undefined: coantainer = body
     *
     * @param: query: the condition to query the items
     */
    navSetup: function _setup(containerId, query) {
      _savedId = containerId;
      let elements = [];

      let container = (containerId === undefined) ?
          document.body : (document.getElementById(containerId) ||
                           document.querySelector(containerId));

      if (containerId === OPTION_MENU) {
        const MAIN_MENU = 'menu#mainmenu';
        container = document.querySelector(MAIN_MENU);
      }

      if (container && query) {
        elements = container.querySelectorAll(query);
        if (elements.length > 0) {
          navUpdate(elements);
        }

        let recipients = container.querySelectorAll(query + '.recipient');
        if (recipients.length > 0) {
          navUpdateHorizontal(recipients, true);
        }
      }

      if (containerId && elements) {
        if (!controls[containerId]) {
          controls[containerId] = {};
          controls[containerId].index = (elements.length > 0) ? 0 : -1;
        }
        controls[containerId].elements = elements;
      }
    },

    reset: function _reset(id) {
      debug('NavigationMap reset: id=' + id);

      let query = '.navigable:not([hidden])';
      if (id === 'messages-container') {
        query = 'li' + query;
      }
      this.navSetup(id, query);
    },

    /*option menu*/
    optionReset: function _reset() {
      debug('optionReset');
      const SUB_MENU = 'menu[data-subtype="submenu"]';
      const MENU_BUTTON = '.menu-button';
      let i;

      this.navSetup(OPTION_MENU, MENU_BUTTON);

      //set navigation for submenu
      let submenu = document.querySelectorAll(SUB_MENU);
      for (i = 0; i < submenu.length; i++) {
        NavigationMap.navSetup('#' + submenu[i].id, MENU_BUTTON);
      }

      /*remove current focus, only one element has focus */
      let focused = document.querySelectorAll('.focus');
      for (i = 0; i < focused.length; i++) {
        focused[i].classList.remove('focus');
      }

      let toFocused = controls[OPTION_MENU].elements[0];
      if (toFocused) {
        toFocused.setAttribute('tabindex', 1);
        toFocused.classList.add('focus');

        toFocused.focus();
      }
    },

    /*get the focused item (element)*/
    getCurrentItem: function _currentItem() {
      return getCurItem();
    },

    /*return current control(the navigable elements of current shown panel)*/
    getCurrentControl: function _currentControl() {
      return getCurControl();
    },

    onPanelChanged: function _panelChanged(from, to, args) {
      debug('onPanelChanged: ' + from + ' --> ' + to + ', args:' + args);

      curPanel = to;

      switch (to) {
        case PANEL_SETTINGS:
          this.reset(SETTINGS_CONTAINER);
          if (from === PANEL_THREAD_LIST) {
            setTimeout(() => {
              this.setFocus(0);
            }, TimeOut);
          } else {
            setTimeout(() => {
              let control = getCurControl();
              this.setFocus(control ? control.index : 0);
            }, TimeOut);
          }
          break;
        case PANEL_SEARCH_MESSAGE:
          this.reset(SEARCH_CONTAINER);
          if (from === PANEL_THREAD_LIST) {
            setTimeout(() => {
              this.setFocus(0);
            }, TimeOut);
          } else {
            setTimeout(() => {
              let control = getCurControl();
              this.setFocus(control ? control.index : 0);
            }, TimeOut);
          }
          break;
        case PANEL_COMPOSER:
          setTimeout(() => {
            let control = getCurControl();
            if (control && ThreadUI.draft) {
              NavigationMap.setFocusToFixedElement('messages-input');
            }
          });
          break;
        case PANEL_THREAD:
          if (ThreadUI.isBackToThreadUI) {
            ThreadUI.isBackToThreadUI = false;
            break;
          }
          setTimeout(() => {
            let control = getCurControl();
            if (control && !ThreadListUI.isSwitchCase) {
              NavigationMap.setFocusToFixedElement('messages-input');
            }
          });
          break;
        default:
          setTimeout(() => {
            let control = getCurControl();
            if (!this.toDraft) {
              if (control && control.elements.length > 0) {
                this.setFocus((control.index === -1) ? 0 : control.index);
              }
            } else {
              this.toDraft = false;
            }
          });
          break;
      }
    },

    scrollToElement: function _scroll(element, evt) {
      const SUB_HEADER_HEIGHT = 24;
      let alignToTop = false;
      let _threadsContainer = document.getElementById('threads-container');

      if (evt.key === 'ArrowUp' || element.classList.contains('message') ||
          element.parentElement.classList.contains('message-content-body')) {
        if (screen.orientation.type.startsWith('portrait')) {
          alignToTop = true;
        }
      }
      if (evt.key === 'ArrowDown' && element.classList.contains('hidden') &&
          element.parentElement.classList.contains('message-list')) {
        ThreadUI.showChunkOfMessages(ThreadUI.CHUNK_SIZE, evt.key);
      }
      element.scrollIntoView(alignToTop);

      if (element.id && element.id === MESSAGES_INPUT) {
        ThreadUI.adjustScrollElement();
      }

      // adjust scroll top for sticky header, when press 'ArrowUp' in list view
      // we think there's overlap if offset top of element is less than container's
      // scroll top plus 1/2 of element's height.
      if (evt.key === 'ArrowUp' &&
          element.classList.contains('threadlist-item')) {
        if (element.offsetTop <=
            (_threadsContainer.scrollTop + element.offsetHeight / 2)) {
          _threadsContainer.scrollTop -= SUB_HEADER_HEIGHT;
        }
      }
    },

    handleClick: function(evt) {
      if (evt.target.id === 'messages-input') {
        let currentFocus = document.querySelector('.focus');
        if (currentFocus.nodeName === 'IFRAME') {
          currentFocus.click();
        }
        return;
      }
      evt.target.click();
      for (let i = 0; i < evt.target.children.length; i++) {
        evt.target.children[i].click();
      }
    },

    lockNav: function(e) {
      // When message list height is 200px or above, we should lock navigation to
      // the list item to show message content completely. And later if we nav
      // to less than 100px left, it's fine to jump to another message.
      function inMessageElement(key) {
        const MIN_HEIGHT_PORTRAIT = 200;
        const MIN_HEIGHT_LANDSCAPE = 102;
        const MIN_IN_ELEMNT_HEIGHT = screen.orientation.type.startsWith('portrait') ?
              MIN_HEIGHT_PORTRAIT : MIN_HEIGHT_LANDSCAPE;
        const MAX_BOTTOM_HEIGHT = 100;
        let current = document.activeElement;

        // Not a message li.
        if (current.tagName !== 'LI' || !current.classList.contains('message')) {
          return false;
        }

        let currentOffsetHeight = current.offsetHeight;
        let currentOffsetTop = current.offsetTop;

        let container = document.getElementById('messages-container');
        let containerTop = container.scrollTop;
        let containerClientHeight = container.clientHeight;
        let containerScrollHeight = container.scrollHeight;

        if (currentOffsetHeight > MIN_IN_ELEMNT_HEIGHT) {
          if (key === 'ArrowDown') {
            if ((containerTop < (currentOffsetHeight +
                 currentOffsetTop - MAX_BOTTOM_HEIGHT)) &&
                (containerTop + containerClientHeight < containerScrollHeight)) {
              return true;
            }
          } else if (key === 'ArrowUp') {
            if (containerTop > currentOffsetTop) {
              return true;
            }
          }
        }
        return false;
      }

      if (this.currentActivatedLength > 0 || this.lockNavigation) {
        return true;
      }

      if (document.activeElement.type === 'select-one') {
        return true;
      }

      return (inMessageElement(e.key));
    },

    // Need clear subject store focus when the subject field is hidden.
    clearSubjectStoreFocus: function() {
      if (_storeFocused && _storeFocused.id === 'subject-composer-input') {
        _storeFocused = null;
      }
    },

    clearAttachmentStoreFocus: function() {
      if (_storeFocused && _storeFocused.classList.contains('attachment-composer')) {
        _storeFocused = null;
      }
    },

    setFocusToFixedElement: function(tag) {
      const index = ThreadUI.getItemIndex(
        NavigationMap.getCurrentControl().elements, tag);
      NavigationMap.setFocus(index);
    }
  };

  exports.NavigationMap = NavigationMap;
})(window);
