'use strict';
(function(exports) {

  var NavigationMap = {
    _controls: null,
    _hasCustomId: false,
    _customId: null,
    _storeFocused: null,
    _storeFocusId: 0,
    _restoreFocus: false,
    _addNewTone: false,
    _newToneName: null,
    _ringtoneVisibilityChange: false,
    currentActivatedLength: 0,

    init: function _init() {

      window.addEventListener('listReady', evt => {
        if (evt.detail) {
          if ('restoreFocus' in evt.detail) {
            NavigationMap._restoreFocus = evt.detail.restoreFocus;
          } else {
            NavigationMap._restoreFocus = false;
          }
          if ('ringtoneVisibilityChange' in evt.detail) {
            NavigationMap._ringtoneVisibilityChange =
              evt.detail.ringtoneVisibilityChange;
          } else {
            NavigationMap._ringtoneVisibilityChange = false;
          }
          if ('addNewTone' in evt.detail &&
              'newToneName' in evt.detail) {
            NavigationMap._addNewTone = evt.detail.addNewTone;
            NavigationMap._newToneName = evt.detail.newToneName;
          } else {
            NavigationMap._addNewTone = false;
            NavigationMap._newToneName = null;
          }
        }
        NavigationMap.reset('ringtone');
      });

      window.addEventListener('createRingtoneReady', () => {
        NavigationMap.reset('createRingtone');
      });

      document.addEventListener('focusChanged', evt => {
        if (!evt.detail.focusedElement.classList.contains('menu-button')) {
          NavigationMap._storeFocused = evt.detail.focusedElement;
          NavigationMap._storeFocusId =
            Number(NavigationMap._storeFocused.getAttribute('data-nav-id'));
        }
      });

      document.addEventListener('transitionend', event => {
        var classes = event.target.classList;
        if (classes &&
            classes.contains('group-menu') &&
            classes.contains('visible')) {
          NavigationMap._restoreFocus = false;
          NavigationMap._hasCustomId = false;
          NavigationMap.reset('groupMenu');
        }
      });

      var observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type == 'attributes') {
            if (mutation.attributeName == 'class' &&
                mutation.target.classList.contains('group-menu')) {
              if (mutation.target.classList.contains('visible')) {
                NavigationMap._storeFocused = document.querySelectorAll('.focus');
                NavigationMap._storeFocused[0].classList.remove('focus');
                NavigationMap._storeFocused[0].classList.add('focus1');
              } else {
                if (NavigationMap._storeFocused) {
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

    reset: function _reset(panel) {
      this._hasCustomId = false;
      switch (panel) {
        case 'groupMenu':
          this._controls = document.querySelectorAll('menu button');
          this.initNavigation('groupMenu');
          break;
        case 'ringtone':
          this._controls = document.querySelectorAll('#list-parent li');

          if (!NavigationMap._ringtoneVisibilityChange) {
            for (var i = 0; i < this._controls.length; i++) {
              if (this._controls[i].querySelector('input')) {
                var input = this._controls[i].querySelector('input');

                if (true === input.checked) {
                  this._hasCustomId = true;
                  this._customId = i;
                  this._storeFocusId = i;
                  break;
                }
              }

              if (NavigationMap._addNewTone) {
                var toneName = this._controls[i].querySelector('.name').firstChild.innerHTML;
                if (NavigationMap._newToneName === toneName) {
                  this._hasCustomId = true;
                  this._customId = i;
                  this._storeFocusId = i;
                  break;
                }
              }
            }
          }

          this.initNavigation('ringtone');
          break;
        case 'createRingtone':
          this._controls = document.querySelectorAll('#set-default');
          this.initNavigation('createRingtone');
          break;
      }
      this.initFocus();
    },

    initNavigation: function _initNavigation(panel) {
      var i = 0,
        id = 1000;
      switch (panel) {
        case 'groupMenu':
          if (this._controls.length === 0) {
            return;
          }

          for (i = 0; i < this._controls.length; i++) {
            this._controls[i].setAttribute('data-nav-id', id);
            this._controls[i].style.setProperty('--nav-left', -1);
            this._controls[i].style.setProperty('--nav-right', -1);
            this._controls[i].style.setProperty('--nav-down', id + 1);
            this._controls[i].style.setProperty('--nav-up', id - 1);
            this._controls[i].setAttribute('tabindex', 0);
            id++;
          }
          //top element
          this._controls[0].style.setProperty('--nav-up', id - 1);
          //bottom element
          this._controls[this._controls.length - 1].style.setProperty('--nav-down', 1000);
          break;
        default:
          if (this._controls.length === 0) {
            return;
          }

          id = 0;
          for (i = 0; i < this._controls.length; i++) {
            this._controls[i].setAttribute('data-nav-id', id);
            this._controls[i].style.setProperty('--nav-left', -1);
            this._controls[i].style.setProperty('--nav-right', -1);
            this._controls[i].style.setProperty('--nav-down', id + 1);
            this._controls[i].style.setProperty('--nav-up', id - 1);
            this._controls[i].setAttribute('tabindex', 0);
            id++;
          }
          //top element
          this._controls[0].style.setProperty('--nav-up', id - 1);
          //bottom element
          this._controls[this._controls.length - 1].style.setProperty('--nav-down', 0);
          break;
      }
    },

    initFocus: function _initFocus() {
      var focused = document.querySelectorAll('.focus');
      var index = 0;
      if (this._restoreFocus) {
        index = this._storeFocusId;
      }
      if (this._hasCustomId) {
        index = this._customId;
      }
      if (focused.length > 0) {
        focused[0].classList.remove('focus');
      }

      if (this._controls.length === 0) {
        return;
      }
      if (index >= this._controls.length) {
        index = this._controls.length - 1;
      }
      var initial = this._controls[index];
      initial.setAttribute('tabindex', 1);
      initial.classList.add('focus');

      NavigationMap.scrollToElement(initial);
      initial.focus();
    },

    getParents: function(node, tagName) {
      var parent = node.parentNode;
      var tag = tagName.toUpperCase();
      if (parent.tagName == tag) {
        return parent;
      } else {
        return this.getParents(parent, tag);
      }
    },

    scrollToElement: function(el, evt) {
      function isVisible(el) {
        if (el.offsetWidth === 0 || el.offsetHeight === 0) {
          return false;
        }
        var height = document.documentElement.clientHeight - 30,
          rects = el.getClientRects();
        for (var i = 0, l = rects.length; i < l; i++) {
          var r = rects[i];
          var inView = false;

          if ((r.bottom > 0 && r.bottom <= height) &&
              (r.top > 0 && r.top >= 50)) {
            inView = true;
          }
          if (inView) {
            return true;
          }
        }
        return false;
      }

      if (!isVisible(el)) {
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
    }
  };

  exports.NavigationMap = NavigationMap;

})(window);
