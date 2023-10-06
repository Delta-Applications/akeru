'use strict';

(function(exports) {

  var NavigationMap = {
    _controls: null,
    _oldFocusNode: null,
    _oldCtrlCnt:0,
    _id:0, // used to generate nav-data-id
    _focus_index: 0,
    _bNumberChanged:false,


    init: function _init() {

      this.observeActionMenuState();

      window.addEventListener("nt_notification_panel_update", function (event) {
        var details = event.detail;
        if (details)
        {
          if(details.type === 'added')
          {
            NavigationMap.added(details.node);
          }
          else if(details.type === 'deleted')
          {
            NavigationMap.deleted(details.node);
          }
        }
      });

      window.addEventListener("nt_notification_panel_unfocused", function () {
        NavigationMap.removeFocus();
        NavigationMap.restoreOldFocuse();
        document.removeEventListener("focusChanged", NavigationMap.focusChangedEvent);
      });

      window.addEventListener("nt_notification_panel_focused", function () {
        NavigationMap.storeOldFocuse();
        NavigationMap.setFocus();
        NavigationMap.reset_nt();
        document.addEventListener("focusChanged", NavigationMap.focusChangedEvent);
      });

      windows.addEventListener("navigation_map_scroll_2_focus", function () {
        NavigationMap.scrollToNode(NamedNodeMap.getFocus());
      });
      this._oldCtrlCnt = NT_DOM_HELPER.getNotificationCount();
    },

    focusChangedEvent: function (event) {
      NavigationMap.focusedItemChanged(event.detail.focusedElement);
    },

    generateId: function(){
      return 'notification-' + this._id++;
    },

    storeOldFocuse : function(){
      var focused = document.querySelectorAll(".focus");
      if (focused.length > 0) {
        this._oldFocusNode = focused[0];
      }
    },

    restoreOldFocuse : function(){
      if (this._oldFocusNode) {
        this._oldFocusNode.classList.add('focus');
        this._oldFocusNode.focus();
        window.focus();
        this._oldFocusNode = null;
      }
    },

    fixFocusedIndex: function () {
      var node = this.getFocus();
      if (node) {
        var _controls = NT_DOM_HELPER.getNotifications();
        for (var i = 0; i < _controls.length; ++i) {
          if (_controls[i] === node) {
            NavigationMap.setFocusedIndex(i);
            break;
          }
        }
      }
      else {
        NavigationMap.setFocusedIndex(0);
      }
    },

    setFocusedIndex: function(index){
      this._focus_index = index;
    },

    removeFocus: function (){
      var focused = document.querySelectorAll(".focus");
      if (focused.length > 0) {
        focused[0].classList.remove('focus');
      }
    },

    focusedItemChanged: function (node) {
      if (node) {
        var _controls = NT_DOM_HELPER.getNotifications();
        for (var i = 0; i < _controls.length; ++i) {
          if (_controls[i] === node) {
            NavigationMap.setFocusedIndex(i);
            break;
          }
        }
      }
      else
      {
        NavigationMap.setFocusedIndex(0);
      }
    },

    scrollToNode: function (node) {
      window.setTimeout(function () {
        node.scrollIntoView({ block: "start", behavior: "smooth" });
        },
      100);
    },

    setFocus: function(node){
      if (!node)
      {
        node = NT_DOM_HELPER.getNotifications();
        if(node.length)
        {
          node = node[0];
        }
        else
        {
          node = null;
        }
      }

      if (node)
      {
        var oldFocusedNode = this.getFocus();

        if (oldFocusedNode && oldFocusedNode !== node) {
          oldFocusedNode.classList.remove('focus');
        }

        node.classList.add('focus');
        node.focus();
        window.focus();
        this.focusedItemChanged(node);
        this.scrollToNode(node);
      }
    },

    getFocus : function() {
      var focusedNodes = document.querySelectorAll(".focus");
      return focusedNodes.length > 0 ? focusedNodes[0] : null;
    },

    reset_nt: function _reset() {
      var _controls = NT_DOM_HELPER.getNotifications();
      if (_controls.length)
      {
        var i = 0;
        var id = this.generateId();
        var prevId = id;
        var nextId = this.generateId();

        for (i = 0; i < _controls.length; i++) {

          _controls[i].style.setProperty('--nav-left',  -1);
          _controls[i].style.setProperty('--nav-right', -1);
          _controls[i].setAttribute('data-nav-id', id);

          _controls[i].style.setProperty('--nav-down', nextId);
          _controls[i].style.setProperty('--nav-up',   prevId);

          prevId = id;
          id = nextId;
          nextId = this.generateId();
        }

        var lastCtrl  = _controls[_controls.length - 1];
        var firstCtrl = _controls[0];

        lastCtrl.style.setProperty('--nav-down', firstCtrl.getAttribute('data-nav-id'));
        firstCtrl.style.setProperty('--nav-up',  lastCtrl.getAttribute('data-nav-id'));
      }
    },

    deleted: function(deletedNode){
      if (deletedNode) {
        var _controls = NT_DOM_HELPER.getNotifications();
        var i;
        var length = _controls.length;

        var deletedId = deletedNode.getAttribute('data-nav-id');
        var prevId = deletedNode.style.getPropertyValue('--nav-down');
        var nextId = deletedNode.style.getPropertyValue('--nav-up');

        var fixNavId = 2;
        var prevNode, nextNode;

        this._oldCtrlCnt = NT_DOM_HELPER.getNotificationCount();

        var focusedNode = this.getFocus();

        if (length) {
          if (this._focus_index >= length) {
            this._focus_index -= 1;
          }
          this.setFocus(_controls[this._focus_index]);
        }

        // find sibling and fix their relevant id ('--nav-up' or '--nav-down')
        for (i = 0; i < length; i++) {
          if (_controls[i].style.getPropertyValue('--nav-down') == deletedId) {
            fixNavId--;
            _controls[i].style.setProperty('--nav-down', prevId);
            if (fixNavId <= 0) {
              break;
            }
          }
          else if (_controls[i].style.getPropertyValue('--nav-up') == deletedId) {
            fixNavId--;
            _controls[i].style.setProperty('--nav-up', nextId);
            if (fixNavId <= 0) {
              break;
            }
          }
        }
      }
    },

    added : function(addedNode) {
      if(addedNode)
      {
        var _controls = NT_DOM_HELPER.getNotifications();
        var i;
        var length = _controls.length;

        // find addedNode place
        for (i = 0; i < length; ++i)
        {
          if(_controls[i] === addedNode)
          {
            break;
          }
        }

        // check addedNode prev & next sibling
        var prevSibling = null;
        var nextSibling = null;

        if( i > 0)
        {
          prevSibling = _controls[i - 1];
        }
        else
        {
          prevSibling = _controls[length - 1];
        }

        if(i === (length - 1))
        {
          nextSibling = _controls[0];
        }
        else
        {
          nextSibling = _controls[i + 1];
        }

        var id = addedNode.getAttribute('data-nav-id');

        if(!id)
        {
          id = this.generateId();
        }

        // set addedNode attribute
        addedNode.setAttribute('data-nav-id', id);
        addedNode.style.setProperty('--nav-left', -1);
        addedNode.style.setProperty('--nav-right', -1);

        if (prevSibling !== addedNode && !prevSibling.getAttribute('data-nav-id'))
        {
          // prevSibling doesn't has data-nav-id
          prevSibling.setAttribute('data-nav-id', this.generateId());
        }

        if (nextSibling !== addedNode && !nextSibling.getAttribute('data-nav-id'))
        {
          // nextSibling doesn't has data-nav-id
          nextSibling.setAttribute('data-nav-id', this.generateId());
        }

        addedNode.style.setProperty('--nav-up',   prevSibling.getAttribute('data-nav-id'));
        addedNode.style.setProperty('--nav-down', nextSibling.getAttribute('data-nav-id'));

        prevSibling.style.setProperty('--nav-down', id);
        nextSibling.style.setProperty('--nav-up', id);

        var focusedNode = this.getFocus();
        if (focusedNode)
        {
          this.fixFocusedIndex();
          var newCnt = NT_DOM_HELPER.getNotificationCount();
          if (this._oldCtrlCnt != newCnt)
          {
            this._oldCtrlCnt = newCnt;
            this.setFocus(focusedNode);
          }
        }
        else
        {
          this.setFocus(addedNode);
        }
      }
    },

    observeActionMenuState : function() {
      var screen = document.getElementById('screen');

      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if(mutation.type == "attributes") {
            if(mutation.attributeName == "class") {
              if(mutation.target.classList.contains("action-menu")) {
                 window.setTimeout( function() {
                    NavigationMap.reset();
                      },400);
              }else if(mutation.target.classList.contains("crash-dialog")){
                 window.setTimeout( function() {
                    NavigationMap.crashset();
                      },800);
              }else if(mutation.target.classList.contains("icc")){
                 NavigationMap.inputset();
              }
            }
          }
        });
      });
      var config = {
        attributes: true
      };

      observer.observe(screen, config);
     },

    reset: function _reset() {
      this._controls = document.querySelectorAll(".menu-item");
      if (this._controls.length == 0){
        return;
      }
      var focused = document.querySelectorAll(".focus");
      if(focused.length > 0) {
        focused[0].classList.remove('focus');
      }

      var initial = this._controls[0];
      initial.classList.add('focus');

      initial.focus();
      window.focus();

      this.update();
    },

    crashset: function _reset() {
      this._controls = document.querySelectorAll("#always-report ,#crash-info-link");
      if (this._controls.length == 0){
        return;
      }
      var focused = document.querySelectorAll(".focus");
      if(focused.length > 0) {
        focused[0].classList.remove('focus');
      }

      var initial = this._controls[0];
      initial.classList.add('focus');

      initial.focus();
      window.focus();
      this.update();
    },
      inputset: function _reset() {
      this._controls = document.querySelectorAll("#icc-input-box");
      if (this._controls.length == 0){
        return;
      }
      var focused = document.querySelectorAll(".focus");
      if(focused.length > 0) {
        focused[0].classList.remove('focus');
      }
      var initial = this._controls[0];
      initial.classList.add('focus');

      initial.focus();
      window.focus();
    },
    update: function _update() {

      var i=0, id = 0;
      for(i=0; i<this._controls.length; i++) {
          this._controls[i].setAttribute('data-nav-id', id);
          this._controls[i].style.setProperty('--nav-left', id);
          this._controls[i].style.setProperty('--nav-right', id);
          this._controls[i].style.setProperty('--nav-down', id+1);
          this._controls[i].style.setProperty('--nav-up', id-1);
          id++;
      }
      //top element
      this._controls[0].style.setProperty('--nav-up', id-1);
      //bottom element
      this._controls[this._controls.length-1].style.setProperty('--nav-down', 0);
    },

    handleClick: function _handleClick(evt) {
      var cmasAlert = document.getElementById('notifications-lockscreen-cmas');
      if (!cmasAlert) {
        return;
      }
      if (!cmasAlert.hasAttribute('hidden')) {
        cmasAlert.click();
      } else {
        evt.target.click();
        for (var i = 0; i < evt.target.children.length; i++) {
          evt.target.children[i].click();
        }
      }
    }

  };
  exports.NavigationMap = NavigationMap;

})(window);
