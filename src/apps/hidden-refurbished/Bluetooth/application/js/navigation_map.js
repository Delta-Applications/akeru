

const NAV_TYPE = Object.freeze({
  none: -1,
  menu: 0,
  dialog: 1,
  view: 2
});

var NavigationMap = {
  debug: debug.bind(window, 'NavigationMap'),
  currentActivatedLength: 0,
  dialogId: null,
  focusedElement: null,
  focusedMenuElement: null,
  focusedDialogElement: null,
  focusedControls: [],

  init: function() {
    this.debug('init');
    this.start();
    this.debug('init done');
  },

  start: function() {
    this.debug('start');
    var self = this;

    var observer = new MutationObserver(
      this.mutationsHandler.bind(this));

    observer.observe(document.body, {
      childList: true,
      attributes: true,
      subtree: true
    });

    window.addEventListener('keydown', this.keydownHandler);

    document.addEventListener('focusChanged', (event) => {
      self.focusChanged.call(self, event.detail.focusedElement);
    });
  },

  // -----------------------------------
  // Mutations Handler
  // -----------------------------------
  mutationsHandler: function(mutations) {
    if(undefined === ViewHelper) return;
    var self = this;
    mutations.forEach( (mutation) => {
      var navType = NAV_TYPE.none;
      var target = mutation.target;
      var classes = target.classList;
      if(mutation.type=='childList'){
          if(target.dataset && target.dataset.neednav
               && target.childElementCount > 0) {
            navType = NAV_TYPE.view;
         }
      }
      if(NAV_TYPE.none !== navType)
        NavigationMap.reset(navType);
    });
  },

  reset: function(navType) {
    if(this.currentActivatedLength) {
      this.debug('showing system dialog');
      return;
    }

    this.debug('## reset ##', ViewHelper.curViewId, navType);
    switch(navType) {
    case NAV_TYPE.menu:
      this.focusedMenuElement = NavigationHelper.resetMenu();
      break;
    case NAV_TYPE.dialog:
      this.focusedDialogElement = NavigationHelper.reset(
        VerticalNavigator,
        this.dialogControls,
        this.getDialogFocusIndex,
        'dialog'
        );
      SoftkeyHelper.setSkMenu4Dialog(this.dialogId);
      if(!this.focusedDialogElement) {
        window.focus();
      } else {
        NavigationHelper.setFocus(this.focusedDialogElement);
      }
      break;
    case NAV_TYPE.view:
      this.focusedElement = NavigationHelper.reset(
        ViewHelper.navigator,
        ViewHelper.controls,
        ViewHelper.focus,
        ViewHelper.curViewId,
        SoftkeyHelper.menuVisible()
      );
      if (this.focusedElement)
        this.focusChanged(this.focusedElement);
      SoftkeyHelper.setSkMenu();
      break;
    }
  },

  handleClick: function(event) {
     if(event.target.click) {
       event.target.click();
       var input = event.target.querySelector('input');
       input && input.focus();
     } else {
       var children = event.target.children;
       for (var i = 0; i < children.length; i++) {
         if(children[i].click)
           children[i].click();
       }
    }
  },

  scrollToElement: function(element, event) {
    NavigationHelper.scrollToElement(element, event, 50, 40);
  },

  focusChanged: function(element) {
    //this.debug('focusChange:', element);
    if('button' === element.type && element.classList.contains('menu-button'))
      return;
    this.focusedElement = element;
    var navId = element.getAttribute("data-nav-id");
    if (navId && ViewHelper.curViewId && navId.length > ViewHelper.curViewId.length) {
      var index = parseInt(navId.substr(ViewHelper.curViewId.length));
      this.focusedControls[ViewHelper.curViewId] = index;
      this.debug('focusedControls[', ViewHelper.curViewId, ']', index);
    }

    if(ViewHelper.focusChange)
      ViewHelper.focusChange(element);
    var input = element.querySelector('input');
    input &&  input.focus();
  },

  getDefaultFocusIndex: function() {
    var focusId = 0;
    if (ViewHelper.curViewId) {
      focusId = NavigationMap.focusedControls[ViewHelper.curViewId];
      if (isNaN(focusId)) focusId = ViewHelper.defaultFocusIndex;
      if(isNaN(focusId) || focusId < 0 ||
        focusId >= NavigationHelper.controls.length) {
        focusId = 0;
      }
    }
    NavigationMap.debug('getDefaultFocusIndex:', focusId);
    return focusId;
  },

  deleteFocus: function(viewId) {
    if(undefined === viewId) viewId = ViewHelper.curViewId;
    delete NavigationMap.focusedControls[viewId];
  },

  dialogControls: function() {
    var dialogForm = $(NavigationMap.dialogId);
    return dialogForm ? dialogForm.querySelectorAll('ul > li') : null;
  },

  popupMenu: function(target) {
    var classes = target.classList;
    return classes &&
      classes.contains('group-menu') &&
      classes.contains('visible');
  },

  // -----------------------------------
  // Keydown Handler
  // -----------------------------------
  keydownHandler: function(e) {
    if(NavigationMap.currentActivatedLength > 0) return;
    NavigationMap.debug('keydown:', e.key);
    var obj = SoftkeyHelper;
    switch (e.key) {
    case 'Accept':
    case 'Enter':
      obj.enterKeyHandler();
      break;
    case 'KanjiMode':
    case 'Backspace':
      obj.backKeyHandler();
      e.preventDefault();
      break;
    default:
      var dir = NavigationHelper.Key2Dir(e.key);
      if(dir !== undefined) obj.dirKeyHandler(dir);
      else obj.otherHandler(e.key);
    }
  },

};
