

/*
 Generic action menu. Options should have the following structure:
//The priority is the show how to order menu items.
//Priority "1" is the left button, "2" is the second button, rest of all items are groupped and ordered by priority in the right "Options" menu.

  new OptionMenu(options);

  options {

    items: An array of menu options to render
    eg.
    [
      {
        name: 'Lorem ipsum',
        l10nId: 'lorem',
        l10nArgs: 'ipsum',
        method: function optionMethod(param1, param2) {
          // Method and params if needed
        },
        params: ['param1', '123123123'],
        priority: 1 //
      },
      ....
      ,


      Last option has a different UI compared with the previous one.
      This is because it's recommended to use as a 'Cancel' option
      {
        name: 'Cancel',
        l10nId: 'Cancel'
        method: function optionMethod(param) {
          // Method and param if needed
        },
        params: ['Optional params'],

        // Optional boolean flag to tell the
        // menu button handlers that this option
        // will not execute the "complete" callback.
        // Defaults to "false"

        incomplete: false [true]
      }
    ],

    // Optional header text or node
    header: ...,

    // additional classes on the dialog, as an array of strings
    classes: ...

    // Optional section text or node
    section: ...

    // Optional data-type: confirm or action
    type: 'confirm'

    // Optional callback to be invoked when a
    // button in the menu is pressed. Can be
    // overridden by an "incomplete: true" set
    // on the menu item in the items array.
    complete: function() {...}
  }
*/

const SUB_MENU_PREFIX = 'submenu_';
var secondCall = false;
var OptionMenu = function(options, optionMenuCallback) {
  if (!options || !options.items || options.items.length === 0) {
    return;
  }
  this.optionMenuCallback = optionMenuCallback;
  // Create a private, weakly held entry for
  // this instances DOM object references
  // More info:
  // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/WeakMap
  var handlers = new WeakMap();
  // Retrieve items to be rendered
  var mainItems = [];
  var subItemsMap = {};
  var menuClassName = options.menuClassName;
  if (!menuClassName) {
    menuClassName = 'menu-button';
  }
  var self = this;
  var menuPre = document.getElementById('option-menu');
  if (menuPre && menuPre.parentNode) {
    menuPre.remove();
  }

  // Create the structure
  this.form = document.createElement('form');
  this.form.id = 'option-menu';
  this.form.dataset.type = options.type || 'action';
  this.form.dataset.subtype = 'menu';
  this.form.setAttribute('role', 'dialog');
  this.form.tabIndex = -1;
  this.subMenuDisplayed = false;

  var classList = this.form.classList;

  if (options.classes) {
    classList.add.apply(classList, options.classes);
  }


  if (options.section) {
    var section = document.createElement('section');

    if (typeof options.section === 'string') {
      section.textContent = options.section || '';
    } else {
      section.appendChild(options.section);
    }

    this.form.appendChild(section);
  }

  getMenuItems(options.items);

  // We append a menu with the list of options
  var menu = document.createElement('menu');
  menu.id = 'mainmenu';
  menu.dataset.items = mainItems.length;

  // We append title if needed
  if (options.header) {
    var header = document.createElement('h1');

    if (typeof options.header === 'string') {
      header.textContent = options.header || '';
    } else if (options.header.l10nId) {
      header.setAttribute('data-l10n-id', options.header.l10nId);
    } else {
      header.appendChild(options.header);
    }

    this.form.appendChild(header);
  }

  let firstItemId;
  // For each option, we append the item and listener
  mainItems.forEach(function renderOption(item) {
    var button = document.createElement('button');
    button.type = 'button';
    button.classList.add(menuClassName);
    button.classList.add('p-pri');
    if(item.id) button.id = item.id;
    if (item.l10nId) {
      navigator.mozL10n.setAttributes(button, item.l10nId, item.l10nArgs);
      if (button.textContent === "") {
        button.textContent = item.name || "";
      }
    } else if (item.name && item.name.length) {
      button.textContent = item.name || '';
    } else {
      // no l10n or name, just empty item, don't add to the menu
      return;
    }
    if (item.disable) {
      button.classList.add('disabled');
    }
    menu.appendChild(button);
    if (!firstItemId) {
      if (!button.id) {
        button.id = 'option-menu-first-item';
      }
      firstItemId = button.id
    }
    // Add a mapping from the button object
    // directly to its options item.
    item.incomplete = item.incomplete || false;

    handlers.set(button, item);
  });

  this.form.addEventListener('submit', function(event) {
    event.preventDefault();
  });

  this.form.addEventListener('transitionend', function(event) {
    if (event.target !== this.form) {
      return;
    }

    if (!this.form.classList.contains('visible')) {
      if (this.form.parentNode) {
        this.form.remove();
      }
    } else {
      this.form.focus();
    }

    document.body.classList.remove('dialog-animating');
    if(window.NavigationMap){
      NavigationMap.lockNavigation = false;
    }
  }.bind(this));

  menu.addEventListener('click', menuHandler);

  // Appending the action menu to the form
  this.form.appendChild(menu);
  if (header) {
    header.setAttribute('role', 'heading');
    header.setAttribute('aria-labelledby', firstItemId);
  }
  genSubMenus.call(this);


  function menuHandler(event) {
    if (secondCall) return;
    secondCall = true;

    var target = event.target;
    if('true' === target.dataset.hasmenu) {
      self.subMenuDisplayed = true;
      menuOwnerHandler(target);
      secondCall = false;
      return;
    }

    var action = handlers.get(target);
    var method;
    if (!action && target.tagName.toLowerCase() === 'menu') {
      var focusItem = target.querySelector('.focus');
      if (focusItem) {
        focusItem.focus();
        action = handlers.get(focusItem);
      }
    }
    // Delegate operation to target method. This allows
    // for a custom "Cancel" to be provided by calling program.
    //
    // Further operations should only be processed if
    // an actual button was pressed.
    if (typeof action !== 'undefined') {
      method = action.method || function() {};

      method.apply(null, action.params || []);

      // Hide action menu when click is received
      self.hide();

      if (typeof options.complete === 'function' && !action.incomplete) {
        options.complete();
      }
    }
  }

  function menuOwnerHandler(owner) {
    var subid = SUB_MENU_PREFIX + owner.id;
    var submenu = getSubMenu(subid);
    if(submenu) {
      //submenu.style.bottom = Math.max(window.innerHeight - target.offsetTop - target.offsetHeight - submenu.offsetHeight, 0) + 'px';
      setTimeout(() => {
        self.toggleMainMenu(false);
        menu.classList.add('submenu-displayed');
        owner.classList.add('submenu-owner');
        submenu.classList.remove('hidden');
        self._setFocus(submenu.children[1]);
      }, 400);
    }

    function getSubMenu(id) {
      for (var i=1; i<self.form.children.length; i++) {
        var submenu = self.form.children[i];
        if(submenu.id === id) return submenu;
      }
      return null;
    }

  }

  // Used for getting the items of both mainmenu and submenu
  function getMenuItems(items) {
    for (var item of items) {
      var fid = item.fid;
      if (fid) {
        if(subItemsMap[fid]) subItemsMap[fid].push(item);
        else subItemsMap[fid] = [item];
      } else {
        mainItems.push(item);
      }
    }
  }

  // Used for generating submenu
  function genSubMenus() {
    for(var fid in subItemsMap) {
      var subItems = subItemsMap[fid];
      if(!Array.isArray(subItems) || subItems.length === 0) continue;
      console.log('genSubMenus', fid, subItems);
      var submenu = document.createElement('menu');
      submenu.id = SUB_MENU_PREFIX + fid;
      submenu.setAttribute('fid', fid);
      submenu.dataset.subtype = 'submenu';
      submenu.dataset.items = subItems.length;
      submenu.classList.add('hidden');
      genSubHeader(submenu, fid);
      for (var item of subItems) {
        var button = document.createElement('button');
        button.type = 'button';
        button.classList.add(menuClassName);
        button.classList.add('p-pri');
        if(item.id) button.id = item.id;
        if(item.l10nId) navigator.mozL10n.setAttributes(
          button, item.l10nId, item.l10nArgs);
        else button.textContent = item.name;
        item.incomplete = item.incomplete || false;
        handlers.set(button, item);
        submenu.appendChild(button);
      } // for
      submenu.addEventListener('click', function (event){
        this.subMenuDisplayed = false;
        menuHandler(event);
      }.bind(this));
      this.form[fid].dataset.hasmenu = 'true';
      this.form.appendChild(submenu);
      submenu.setAttribute('role', 'heading');
      submenu.setAttribute('aria-labelledby', 'sub-menu-header');
    } // for

    function genSubHeader(submenu, fid) {
      var item = mainItems.find(i=>i.id===fid);
      if (item) {
        var header = document.createElement('header');
        header.id = 'sub-menu-header';
        header.setAttribute('role', 'heading');
        if(item.l10nId) navigator.mozL10n.setAttributes(
          header, item.l10nId, item.l10nArgs);
        else header.textContent = item.name;
        submenu.appendChild(header);
      }
    }
  } // genSubMenus
};

OptionMenu.prototype._setFocus = function(element) {
  var focused = document.querySelector('.focus');
  if(focused) focused.classList.remove('focus');
  element.setAttribute('tabindex', 1);
  element.classList.add('focus');
  element.focus();
};

// We prototype functions to show/hide the UI of action-menu
OptionMenu.prototype.show = function() {
  if(window.NavigationMap){
    NavigationMap.lockNavigation = true;
  }
  // Remove the focus to hide the keyboard asap
  document.activeElement && document.activeElement.blur();

  if (!this.form.parentNode) {
    document.body.appendChild(this.form);

    // Flush style on form so that the show transition plays once we add
    // the visible class.
    this.form.clientTop;
  }
  this.form.classList.add('visible');
  document.body.classList.add('dialog-animating', 'show-option');
  if (this.optionMenuCallback) {
    this.optionMenuCallback(true);
  }

  var menu = document.getElementById('mainmenu');
  var header = this.form.querySelector('h1');
  if (menu && header) {
    //the setTimeout can to avoid getting menu.offsetHeight when pop animation is showing 
    setTimeout(() => {
      header.setAttribute('style', 'bottom:' + menu.offsetHeight + 'px');
    });
  }

  return Promise.resolve();
};

OptionMenu.prototype.toggleMainMenu = function(display) {
  var header = this.form.querySelector('h1');
  var mainmenu = this.form.querySelector('#mainmenu');
    if (display) {
      mainmenu.classList.remove('hidden');
      header.classList.remove('hidden');
    } else {
      mainmenu.classList.add('hidden');
      header.classList.add('hidden');
    }
};

OptionMenu.prototype.hide = function() {
  if (!this.form.classList.contains('visible')) {
    return;
  }

  if (this.subMenuDisplayed) {
    var selector = 'form[data-subtype=menu] > menu > button.submenu-owner';
    var owner = document.querySelector(selector);
    if (owner) {
      var submenu = document.getElementById(SUB_MENU_PREFIX + owner.id);
      if (submenu) {
        submenu.classList.add('hidden');
        owner.classList.remove('submenu-owner');
        owner.parentElement.classList.remove('submenu-displayed');
        this.subMenuDisplayed = false;
        this.toggleMainMenu(true);
        this._setFocus(owner);
        secondCall = false;
        return new Promise((resolve) => {
          resolve();
        });
      }
    }
  }
  this.form.setAttribute('aria-hidden', 'true');
  this.form.classList.remove('visible');
  if (this.optionMenuCallback) {
    this.optionMenuCallback(false);
  }

  setTimeout(() => {
    document.body.classList.remove('show-option');
  }, 100);

  return new Promise((resolve) => {
    var timer = setTimeout(() => {
      resolve();
    }, 300);

    this.form.addEventListener('transitionend', () => {
      if (timer) {
        clearTimeout(timer);
      }
      resolve();
    });
  });
};
