

(function(exports) {
  const MENU_ID_BASE = 1000;
  var NavigationMap = {
    _controls: null,
    _storeFocused: null,
    itemsBaseId: 0,
    currentSection: null,
    previousSection: null,
    _pageFocusIdMap: [],
    _rootPageIdMap: [],
    currentActivated: true,
    currentActivatedLength: 0,
    _optionsShow: false,
    settingsListShow: false,
    selectOptionShow: false,
    _noLi: false,
    statusbarHeight: 26,
    softkeybarHeight: 30,
    ignore_elements: ['select-one'],
    ignore_types: ['tel', 'text', 'password'],
    delayFocusSet: false,
    settings: window.navigator.mozSettings,
    init: function _init() {
      console.log('NavigationMap init');

      let style = window.getComputedStyle(document.body);
      let fontSize = style.getPropertyValue('font-size');
      let statusHeight = style.getPropertyValue('--statusbar-height');
      let softkeyHeight = style.getPropertyValue('--softkeybar-height');
      this.statusbarHeight = parseFloat(statusHeight) * parseFloat(fontSize);
      this.softkeybarHeight = parseFloat(softkeyHeight) * parseFloat(fontSize);

      window.addEventListener('menuEvent', (e) => {
        if (e.detail.menuVisible == true) {
          this._optionsShow = true;
        } else {
          this._optionsShow = false;
        }
      });
      var _self = this;
      NavigationMap.observerInit();
      window.addEventListener('visibilitychange', _self.visibilitychange);
      _self.settings.addObserver('selectOptionPopup.state', _self.selectOptionChange);
      window.addEventListener('panelready', function(e) {
        NavigationMap.currentSection = e.detail.current;
        NavigationMap.previousSection = e.detail.previous;
        if (e.detail.restore) {
          NavigationMap._controls = document.querySelector(NavigationMap.currentSection).querySelectorAll('div:not(.hidden):not([hidden]) > ul:not(.hidden):not([hidden]) >li:not(.hidden):not([hidden]):not(.non-focus)');
          NavigationMap.update();
          return;
        }
        if (e.detail.currentpage === '#root') {
          NavigationMap.rootReset(e);
        } else {
          NavigationMap.reset(e.detail.needFocused);
        }
      });

      window.addEventListener('settings-list-event', (evt) => {
        NavigationMap.settingsListShow = (evt.detail.isVisible === true);
      });

      window.addEventListener('refresh',_self.refresh);

      window.addEventListener('keydown', function(evt) {
        for (var i = 0; i < _self.ignore_elements.length; i++) {
          if (document.activeElement.type == _self.ignore_elements[i]) return;
        }
        if (NavigationMap.currentActivatedLength > 0) {
          return;
        }
        if (evt.key == 'Backspace') {
          var handled = true;
          switch (Settings.currentPanel) {
            case '#icc':
            case '#apn-editor':
            case '#browsingPrivacy':
            case '#appDetails':
            case '#wifi-available-networks':
            case '#wifi-selectCertificateFile':
            case '#call-barring-passcode-change':
            case '#wifi-enterCertificateNickname':
            case '#wifi':
            case '#wifi-auth-wapi':
            case '#dateTime':
              break;
            case '#root':
              // Do nothing
              handled = false;
              break;
            case '#downloads':
              var downloadsPanel = document.getElementById('downloads');
              var focus1 = document.querySelectorAll('.focus1');
              var confirmDialog = document.getElementById('download-confirm-dialog');
              if (downloadsPanel.classList[1] == 'edit' ||
                focus1[0] != null ||
                confirmDialog.hidden === false) {
                break;
              } else {
                if (NavigationMap._optionsShow === false) {
                  _self.navigateBack();
                  break;
                }
              }
            case '#fxa':
              NavigationMap.delayFocusSet = false;
            default:
              if (SettingsSoftkey.menuVisible())
                return;
              if (NavigationMap._optionsShow === false) {
               _self.navigateBack();
              }
          }
          if (handled) {
            evt.preventDefault();
          }
        }

        // If the options menu is shown,
        //   we should add click event to make options item work normal.
        if (evt.key === 'Enter' &&
          Settings.currentPanel !== '#volte-vowifi') {
          var selectorRule = 'li:not([aria-disabled="true"]):' +
            'not(.hidden):not([hidden]).focus select';
          var select = document.querySelector(selectorRule);
          if (select && select.hasChildNodes()) {
            select.focus();
            NavigationMap.selectOptionShow = true;
          }
        }
      });
      window.dispatchEvent(new CustomEvent('navigation-map-init'));
    },

    navigateBack: function _backToPreviousPage() {
      var preSection = null;
      var header = document.querySelectorAll('.current [data-href]');
      console.log(header)
      if (header !== null && header !== undefined) {
        preSection = header[0].getAttribute('data-href');
      }
      if (preSection !== null && preSection !== undefined) {
        Settings.isBackHref = true;
        Settings.currentPanel = preSection;
      }
    },

    /*observer*/
    observerInit: function _init() {
      console.log('--------observerInit------');
      var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          // add data-nav-reset-type attribute to avoid navigation reset automatically because in some causes
          // we'd like to do it manually
          if (mutation.target.hasAttribute('data-nav-reset-type'))
            return;
          if (mutation.type == 'attributes') {
            if (mutation.attributeName == 'class' && mutation.target.classList.contains('group-menu')) {
              if (mutation.target.classList.contains('visible')) {
                NavigationMap._storeFocused = document.querySelectorAll('.focus');
                if (NavigationMap._storeFocused.length) {
                  NavigationMap._storeFocused[0].classList.remove('focus');
                  NavigationMap._storeFocused[0].classList.add('focus1');
                }

                let timeout = NavigationMap.currentSection === '#downloads' ?
                  0 : 500;

                setTimeout(() => {
                  NavigationMap.menuNavReset();
                }, timeout);
              } else { //menu is closed
                if (NavigationMap._storeFocused.length) {
                  var temp = NavigationMap.getParents(NavigationMap._storeFocused[0], 'section');
                  if (!('hidden' in temp.attributes)) {
                    NavigationMap._storeFocused[0].classList.remove('focus1');
                    NavigationMap._storeFocused[0].classList.add('focus');
                    NavigationMap._storeFocused[0].focus();
                  }
                }
              }
            }
          }
        });
      });
      var config = {
        attributes: true,
        chatacterData: true,
        subtree: true
      };
      observer.observe(document.body, config);
    },
    /*group menu*/
    menuNavReset: function _reset() {
      console.log('-------menuNavReset--------');
      this._controls = document.querySelectorAll('.menu-button');
      console.log('-------menuNavReset--------this._controls = ', this._controls);
      if (this._controls.length == 0) {
        return;
      }
      var initial = this._controls[0];
      console.log('-------menuNavReset--------this.initial = ', initial);
      initial.setAttribute('tabindex', 1);
      initial.classList.add('focus');

      initial.focus();

      this.menuNavUpdate();
    },

    menuNavUpdate: function _update() {
      console.log('----------menuNavUpdate-------');

      var i = 0;
      var id = MENU_ID_BASE; /*to avoid 'data-nav-id' reproduced with grid*/
      for (i = 0; i < this._controls.length; i++) {
        this._controls[i].setAttribute('data-nav-id', id);
        this._controls[i].style.setProperty('--nav-left', -1); //-1: invalid ID
        this._controls[i].style.setProperty('--nav-right', -1);
        this._controls[i].style.setProperty('--nav-down', id + 1);
        this._controls[i].style.setProperty('--nav-up', id - 1);
        this._controls[i].setAttribute('tabindex', 0);
        id++;
      }
      //top element
      this._controls[0].style.setProperty('--nav-up', id - 1);
      //bottom element
      this._controls[this._controls.length - 1].style.setProperty('--nav-down', MENU_ID_BASE);
    },
    getParents: function(node, tagName) {
      console.log('find parent');
      var parent = node.parentNode;
      var tag = tagName.toUpperCase();
      if (parent.tagName == tag) {
        return parent;
      } else {
        return this.getParents(parent, tag);
      }
    },
    rootReset: function _rootReset(e) {
      var newActiveTab = e.detail.newActiveTab;
      var oldActiveTab = e.detail.oldActiveTab;
      var panel = document.querySelector('#root');
      var focusElement = panel.querySelector('.focus');
      var navId = null;
      if (focusElement) {
        navId = focusElement.getAttribute('data-nav-id');
      }
      var id = this.findFocusedId(navId);
      var length = this._rootPageIdMap.length;
      var haveId = 0;
      var info = this._rootPageIdMap[0];
      if (info == null) {
        this._rootPageIdMap.push({
          newActiveTab: newActiveTab,
          oldActiveTab: oldActiveTab,
          navId: id
        });
        haveId++;
      }
      for (var i = 0; i < length; i++) {
        info = this._rootPageIdMap[i];
        console.log('before-------info', info);
        if (info.newActiveTab == newActiveTab && info.oldActiveTab == oldActiveTab) {
          haveId++;
          if (info.navId != id) {
            info.navId = id;
          }
        }
      }
      if (haveId == 0) {
        this._rootPageIdMap.push({
          newActiveTab: newActiveTab,
          oldActiveTab: oldActiveTab,
          navId: id
        });
      } else {
        haveId = 0;
      }
      this._controls = document.querySelectorAll('.current div:not(.hidden) > ul:not(.hidden):not([hidden]) >li:not(.hidden):not([hidden])');

      var focused = document.querySelectorAll('.focus');
      if (focused.length > 0) {
        focused[0].classList.remove('focus');
      }
      if (this._controls.length === 0)
        return;

      var initial = this._controls[0];

      initial.setAttribute('tabindex', 1);
      initial.classList.add('focus');
      if (!NavigationMap.selectOptionShow) {
        initial.focus();
      }
      this.scrollToElement(initial);
      this.update();
    },
    moreInfoReset: function _moreInfoReset() {
      var navId = this.findNaviId(NavigationMap.previousSection,
        NavigationMap.currentSection, true);
      this._controls = document.querySelectorAll('.current div:not(.hidden) > ul:not(.hidden):not([hidden]) >li:not(.hidden):not([hidden])');
      var focused = document.querySelectorAll('.focus');
      if (focused.length > 0) {
        focused[0].classList.remove('focus');
      }
      if (this._controls.length === 0)
        return;
      var id = this.findFocusedId(navId);
      var initial = this._controls[id];
      initial.setAttribute('tabindex', 1);
      initial.classList.add('focus');
      initial.focus();
      if (NavigationMap.currentSection === '#downloads') {
        var event = new CustomEvent('show-download-list', {
          detail: {
            current: NavigationMap.currentSection
          }
        });
        window.dispatchEvent(event);
      }
      this.moreInfoUpdate();
    },
    moreInfoUpdate: function _moreInfoUpdate() {
      console.log('NavigationMap update');
      var i = 0;
      for (i = 0; i < this._controls.length; i++) {
        if (i === 0 || i === this._controls.length - 1) {
          this._controls[i].setAttribute('data-nav-id', this.itemsBaseId);
          this._controls[i].style.setProperty('--nav-left', this.itemsBaseId);
          this._controls[i].style.setProperty('--nav-right', this.itemsBaseId);
          this._controls[i].style.setProperty('--nav-down', this.itemsBaseId + 1);
          this._controls[i].style.setProperty('--nav-up', this.itemsBaseId - 1);
          this._controls[i].setAttribute('tabindex', 0);
          this.itemsBaseId++;
        }
      }
      this._controls[this._controls.length - 1].style.setProperty('--nav-down', this.itemsBaseId - 1);
      this._controls[0].style.setProperty('--nav-up', this.itemsBaseId - 2);
    },

    // Refresh current page and make the new element can be focused.
    refresh: function _refreshCurrentPage() {
      if (!NavigationMap.currentSection) {
        return;
      }
      NavigationMap._controls = document.querySelector(NavigationMap.currentSection).querySelectorAll('div:not(.hidden):not([hidden]) > ul:not(.hidden):not([hidden]) >li:not(.hidden):not([hidden]):not(.non-focus)');

      if (NavigationMap._controls.length === 0) {
        return;
      }

      var initial = NavigationMap._controls[0];
      initial.setAttribute('tabindex', 1);

      var focused = document.querySelector(NavigationMap.currentSection).querySelectorAll('div:not(.hidden):not([hidden]) > ul:not(.hidden):not([hidden]) >li:not(.hidden):not([hidden]):not(.non-focus).focus');
      if (focused.length > 0) {
        NavigationMap.scrollToElement(focused[0], false);
        for (var i = 1; focused.length > i; i++) {
          focused[i].classList.remove('focus');
        }
      } else {
        initial.classList.add('focus');
        initial.focus();
        NavigationMap.scrollToElement(initial);
      }

      NavigationMap.update();
    },

    reset: function _reset(needFocused) {
      NavigationMap.menuReset(needFocused, true);
    },

    menuReset: function _menuReset(needFocused, flag) {
      var initial;
      if (!NavigationMap.currentSection) {
        return;
      }
      var currentSection = document.querySelector(NavigationMap.currentSection);
      this._controls = currentSection.querySelectorAll(
        'div:not(.hidden):not([hidden]) > ul:not(.hidden):not([hidden]) >li:not(.hidden):not([hidden]):not(.non-focus)');
      if (NavigationMap.previousSection ||
        NavigationMap.currentSection !== '#root') {
        var navId = this.findNaviId(NavigationMap.previousSection,
                                    NavigationMap.currentSection,
                                    flag);

        var focused = document.querySelectorAll('.focus');
        if (focused.length > 0) {
          focused[0].classList.remove('focus');
        }
        this._noLi = false;
        if (this._controls.length === 0) {
          this._noLi = true;
          this._controls = document.querySelectorAll(
            NavigationMap.currentSection + '>div');
        }

        var id = this.findFocusedId(navId);

        initial = this._controls[id];
        if (needFocused) {
          initial = needFocused;
        }
        initial.setAttribute('tabindex', 1);
        if (!this._noLi &&
          (NavigationMap.previousSection !== '#root' ||
            (NavigationMap.currentSection !== '#cell-channels-config'))) {
          initial.classList.add('focus');
        }
        if (!this.delayFocusSet) {
          initial.focus();
        }
      } else {
        initial = document.querySelectorAll('.focus')[0];
      }

      this.scrollToElement(initial, false);
      if (NavigationMap.currentSection === '#downloads') {
        var event = new CustomEvent('show-download-list', {
          detail: {
            current: NavigationMap.currentSection
          }
        });
        window.dispatchEvent(event);
      }
      //dispatchEvent(new CustomEvent('show-download-list'));
      this.update();
    },

    update: function _update() {
      console.log('NavigationMap update');

      var i = 0;
      for (i = 0; i < this._controls.length; i++) {
        this._controls[i].setAttribute('data-nav-id', this.itemsBaseId);
        this._controls[i].style.setProperty('--nav-left', this.itemsBaseId);
        this._controls[i].style.setProperty('--nav-right', this.itemsBaseId);
        this._controls[i].style.setProperty('--nav-down', this.itemsBaseId + 1);
        this._controls[i].style.setProperty('--nav-up', this.itemsBaseId - 1);
        this._controls[i].setAttribute('tabindex', 0);
        this.itemsBaseId++;
      }

      this._controls[this._controls.length - 1].style.setProperty('--nav-down', this.itemsBaseId - this._controls.length);
      this._controls[0].style.setProperty('--nav-up', this.itemsBaseId - 1);
    },

    // get focused id of target panel
    findNaviId: function _findNaviId(currentPanel, targetPanel, flag) {
      if (currentPanel === undefined || currentPanel === null)
        return 0;
      else {
        var focusId = 0;
        var length = this._pageFocusIdMap.length;

        // check current operation is openning new panel or backing  previous panel according to key
        for (var i = 0; i < length; i++) {
          var info = this._pageFocusIdMap[i];
          if ((currentPanel + targetPanel) === info.key || (targetPanel + currentPanel) === info.key) {
            // a key exist, it's backing operation
            console.log('***back to previous page***');
            dispatchEvent(new CustomEvent('hide-download-list'));
            focusId = info.focusId;
            if (flag) {
              this._pageFocusIdMap.splice(i, 1);
            }
            return focusId;
          }
        }

        // key not exist, open a new panel
        console.log('***open new page operation, previous panel --> ' + currentPanel);
        var pagesIdString = currentPanel + targetPanel;
        var panel = document.querySelector(currentPanel);
        if (panel.querySelector('.focus') == undefined) {
          if (targetPanel === '#apn-editor')
            this._pageFocusIdMap.push({
              key: pagesIdString,
              focusId: -1
            });
          return -1;
        }
        var navId = panel.querySelector('.focus').getAttribute('data-nav-id');
        console.log('***previous panel focus navi id --> ' + navId);
        this._pageFocusIdMap.push({
          key: pagesIdString,
          focusId: navId
        });
        return focusId;
      }
    },

    // get focused element id
    findFocusedId: function _findFocusedId(navId) {
      var id = 0;
      if (this._controls) {
        for (var i = 0, len = this._controls.length; i < len; i++) {
          if (this._controls[i].getAttribute('data-nav-id') === navId) {
            id = i;
            break;
          }
        }
      }
      return id;
    },
    // calculate the height of gaia-header/softkey/rootTab
    getHeaderPanelHeight: function() {
      var headerHeight = 0;
      var softPanelHeight = 0;
      var rootTabHeight = 0;
      var curPanel = null;
      if (typeof Settings !== 'undefined') {
        curPanel = document.querySelector(Settings.currentPanel);
      } else {
        curPanel = document.querySelector('#root');
      }
      if (curPanel) {
        var header = curPanel.querySelector('gaia-header');
        header && (headerHeight = header.clientHeight);
        softPanelHeight = this.softkeybarHeight;
        if (curPanel.id === 'root') {
          var rootContent = curPanel.querySelector('div.root');
          rootContent && (rootTabHeight = document.documentElement.clientHeight - rootContent.clientHeight - headerHeight);
        } else {
          rootTabHeight = this.statusbarHeight;
        }
      }
      return {
        header: headerHeight,
        softkey: softPanelHeight,
        rootTab: rootTabHeight
      };
    },
    scrollToElement: function(el, evt) {
      var self = this;

      function isVisible(el) {
        if (el.offsetWidth === 0 || el.offsetHeight === 0) {
          return false;
        }
        var deltaHeight = self.getHeaderPanelHeight();
        var height = document.documentElement.clientHeight - deltaHeight.softkey,
          rects = el.getClientRects();
        for (var i = 0, l = rects.length; i < l; i++) {
          var r = rects[i];
          var inView = false;
          if ((r.bottom >= deltaHeight.header && r.bottom <= height) && (r.top >= (deltaHeight.header + deltaHeight.rootTab))) {
            inView = true;
          }
          if (inView) {
            return true;
          }
        }
        return false;
      }
      // no matter is element visible or not , we should force scroll it in case its the first/last one
      var checkEdge = self.checkElement(el);
      if (checkEdge.match) {
        if (checkEdge.top)
          el.scrollIntoView(false);
        else
          el.scrollIntoView(true);
      } else if (!isVisible(el)) {
        if (evt) {
          if (evt.key === 'ArrowDown' || el.getAttribute('data-nav-id') === '0') {
            el.scrollIntoView(false);
          } else if (evt.key === 'ArrowUp') {
            el.scrollIntoView(true);
          }
        } else {
          el.scrollIntoView(false);
        }
      }
    },
    // check is the element on the first/last position
    checkElement: function(element) {
      var match = false;
      var top = false;
      var elmStyle = element.style;
      var navId = parseInt(element.dataset.navId);
      var navUpId = parseInt(elmStyle.getPropertyValue('--nav-up'));
      var navDownId = parseInt(elmStyle.getPropertyValue('--nav-down'));
      if (navId <= navUpId) {
        match = true;
        top = true;
      } else if (navId >= navDownId) {
        match = true;
        top = false;
      }
      return {
        match: match,
        top: top
      }
    },
    onPanelFocusChange: function(softkeyPanel) {
      var curPanel = document.querySelector(Settings.currentPanel);
      var listContainer = curPanel.querySelector('.listContainer');
      if (softkeyPanel) {
        listContainer.classList.remove('none');
        listContainer.classList.add('panel');
      } else {
        listContainer.classList.remove('panel');
        listContainer.classList.add('none');
      }
    },
    visibilitychange: function() {
      var lastFocused = document.querySelector('.current div:not(.hidden) > ul:not(.hidden):not([hidden]) >li.focus:not(.hidden):not([hidden])');
      if (!document.hidden) {
        if (lastFocused) {
          let input = lastFocused.querySelector('input');
          if (input && (NavigationMap.ignore_types.indexOf(input.type) > -1)) {
            input.focus();
          } else {
            lastFocused.focus();
          }
        }
      } else
        window.dispatchEvent(new CustomEvent('menuChangeEvent', {
          detail: {
            action: 'closeMenu'
          }
        }));
    },
    selectOptionChange: function(event) {
      if (event.settingValue === 0) {
        NavigationMap.selectOptionShow = false;
      } else {
        NavigationMap.selectOptionShow = true;
      }
    }
  };

  exports.NavigationMap = NavigationMap;

})(window);
