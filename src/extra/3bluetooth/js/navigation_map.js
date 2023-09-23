/* global SoftkeyHelper, ViewHelper, VerticalNavigator, NavigationHelper*/


const NAV_TYPE = Object.freeze({
  none: -1,
  menu: 0,
  dialog: 1,
  view: 2
});

const NavigationMap = {
  currentActivatedLength: 0,
  dialogId: null,
  focusedElement: null,
  focusedMenuElement: null,
  focusedDialogElement: null,
  focusedControls: [],

  init() {
    this.start();
  },

  start() {

    const observer = new MutationObserver(
      this.mutationsHandler.bind(this));

    observer.observe(document.body, {
      childList: true,
      attributes: true,
      subtree: true
    });

    window.addEventListener('keydown', this.keydownHandler);

    document.addEventListener('focusChanged', (event) => {
      this.focusChanged(event.detail.focusedElement);
    });
  },

  mutationsHandler(mutations) {
    if (null === ViewHelper) {
      return;
    }

    mutations.forEach((mutation) => {
      let navType = NAV_TYPE.none;
      const { target } = mutation;
      if (mutation.type === 'childList') {
        if (target.dataset && target.dataset.neednav &&
               target.childElementCount > 0) {
          navType = NAV_TYPE.view;
        }
      }
      if (NAV_TYPE.none !== navType) {
        NavigationMap.reset(navType);
      }
    });
  },

  reset(navType) {
    if (this.currentActivatedLength) {
      return;
    }

    switch (navType) {
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
        if (this.focusedDialogElement) {
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
        if (this.focusedElement) {
          this.focusChanged(this.focusedElement);
        }
        break;
      default:
        break;
    }
  },

  handleClick(event) {
    if (event.target.click) {
      event.target.click();
      const input = event.target.querySelector('input');
      // eslint-disable-next-line no-unused-expressions
      input && input.focus();
    } else {
      const { children } = event.target;
      for (let i = 0; i < children.length; i++) {
        if (children[i].click) {
          children[i].click();
        }
      }
    }
  },

  scrollToElement(element, event) {
    NavigationHelper.scrollToElement(element, event, 50, 40);
  },

  focusChanged(element) {
    if ('button' === element.type && element.classList.contains('menu-button')) {
      return;
    }

    this.focusedElement = element;
    const navId = element.getAttribute("data-nav-id");
    if (navId && ViewHelper.curViewId && navId.length > ViewHelper.curViewId.length) {
      const index = parseInt(navId.substr(ViewHelper.curViewId.length), 10);
      this.focusedControls[ViewHelper.curViewId] = index;
    }

    if (ViewHelper.focusChange) {
      ViewHelper.focusChange(element);
    }
    const input = element.querySelector('input');
    // eslint-disable-next-line no-unused-expressions
    input && input.focus();
  },

  getDefaultFocusIndex() {
    let focusId = 0;
    if (ViewHelper.curViewId) {
      focusId = NavigationMap.focusedControls[ViewHelper.curViewId];
      if (isNaN(focusId)) {
        focusId = ViewHelper.defaultFocusIndex;
      }
      if (isNaN(focusId) || focusId < 0 ||
        focusId >= NavigationHelper.controls.length) {
        focusId = 0;
      }
    }
    return focusId;
  },

  deleteFocus(viewId) {
    if (null === viewId) {
      viewId = ViewHelper.curViewId;
    }
    delete NavigationMap.focusedControls[viewId];
  },

  dialogControls() {
    // eslint-disable-next-line no-undef
    const dialogForm = $(NavigationMap.dialogId);
    return dialogForm ? dialogForm.querySelectorAll('ul > li') : null;
  },

  popupMenu(target) {
    const classes = target.classList;
    return classes &&
      classes.contains('group-menu') &&
      classes.contains('visible');
  },

  /*
   * -----------------------------------
   * Keydown Handler
   * -----------------------------------
   */
  keydownHandler(e) {
    if (NavigationMap.currentActivatedLength > 0) {
      return;
    }
    const dir = NavigationHelper.Key2Dir(e.key);
    const obj = SoftkeyHelper;
    switch (e.key) {
      case 'KanjiMode':
      case 'Backspace':
        obj.backKeyHandler();
        e.preventDefault();
        break;
      default:
        if (dir === null) {
          obj.otherHandler(e.key);
        } else {
          obj.dirKeyHandler(dir);
        }
    }
  }

};
