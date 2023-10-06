
/* global LazyLoader */

(function(window) {
  'use strict';

  /**
  Generic dialog helper this _depends_ on <gaia-confirm> but is not required
  to be loaded as part of the main gaia-confirm script.
  */
  function ConfirmDialogHelper(config) {
    this.config = config;
    this.dialogShown = false;
  }

  ConfirmDialogHelper.prototype = {
    activeElement: null,
    deltaTop: 100,
    Softkey: window.option,
    isShown: false,
    isGroup: false,
    show: function(parent) {
      LazyLoader.load(['/shared/js/component_utils.js',
                       '/shared/elements/gaia_confirm/script.js'],
                      this._show.bind(this, parent));
    },

    _show: function(parent) {
      let config = this.config;
      this.parent = parent;
      this.activeElement = document.activeElement;
      let wrapper = document.createElement('div');

      let confirmClass = config.system ? 'insystem' : '';
      wrapper.innerHTML =
          '<gaia-confirm id="gaia-confirm" role="menuitem" tabindex="1" class=' +
          confirmClass + '>' +
          '<h1></h1>' +
          '<div class="content height-adjust"><div>' +
          '<p class="line-wrap"></p>' +
          '<p class="noborder" hidden></p>' +
          '</div></div>' +
          '</gaia-confirm>';

      let element = wrapper.firstElementChild;

      this.element = element;

      element.dataset.type = config.type;
      element.addEventListener('confirm', this);
      element.addEventListener('cancel', this);
      element.addEventListener('accept', this);
      // XXX: Primarily here for pressing the home screen button.
      // The home button triggers a hashchange of the homescreen.
      window.addEventListener('hashchange', this);
      // TODO: Add visibility change handling...

      let plist=element.querySelectorAll('p');
      let title = element.querySelector('h1');
      title.style.textAlign = "center";
      let body = plist[0];
      let desc = plist[1];

      let setL10nAttributes = function(element, options) {
        if ('string' === typeof options) {
          navigator.mozL10n.setAttributes(element, options);
        }

        if (options.id) {
          navigator.mozL10n.setAttributes(element, options.id, options.args);
        } else if (options.text) {
          element.textContent = options.text;
        }
      };

      if (config.isGroupMessage) {
        this.isGroup = true;
      }
      setL10nAttributes(title, config.title);
      setL10nAttributes(body, config.body);

      if (config.desc && (config.desc.id || config.desc.text)) {
        desc.hidden = false;
        setL10nAttributes(desc, config.desc);
      } else {
        desc.hidden = true;
      }

      if (NavigationMap && NavigationMap.currentActivatedLength > -1) {
        if (NavigationMap.currentActivatedLength === 0) {
          NavigationMap.currentActivatedLength = 1;
        } else {
          setTimeout(() => {
            this.show(parent);
          }, 600);
          return;
        }
      }
      element.setAttribute('hidden', '');
      parent.appendChild(element);
      window.addEventListener('keydown', this, true);
      this.dialogShown = true;
      this.activeElement.blur();

      // This nested requestAnimationFrame is to work around the coalescing
      // of the style changes associated with removing of the 'hidden'
      // attribute with the creation of the element.
      // For whatever reason, flushing the style with the usual trick of
      // accessing clientTop doesn't work, and a setTimeout requires an
      // unreasonably lengthy timeout (>50ms) to work, and that may not be
      // a reliable solution.
      // This work-around, though gross, appears to work consistently without
      // introducing too much lag or extra work.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          element.removeAttribute('hidden');
          this.isShown = true;
          window.dispatchEvent(new CustomEvent('gaia-confirm-open'));
        });
      });

      element.addEventListener('transitionend', function _showend(e) {
        e.target.removeEventListener('transitionend', _showend);
        // Init softkey panel after Waiting the dialog animation transition,
        // the softkey panel will not be confused again.
        if (window.option) {
          window.option.initSoftKeyPanel(softkeyParams);
        } else {
          window.option = new SoftkeyPanel(softkeyParams);
        }
        window.option.show();
        e.target.focus();
      });

      //init softkey
      let softkeyParams = {
        menuClassName: 'menu-button',
        header: {},
        items: []
      };
      if (config.cancel) {
        softkeyParams.items.push({
          name: '',
          priority: 1,
          l10nId: config.cancel.l10nId,
          method: function() {
          }
        });
      }
      if (config.accept) {
        softkeyParams.items.push({
          name: '',
          priority: 2,
          l10nId: config.accept.l10nId,
          method: function() {
          }
        });
      }
      if (config.confirm) {
        softkeyParams.items.push({
          name: '',
          priority: 3,
          l10nId: config.confirm.l10nId,
          method: function() {
          }
        });
      }
    },

    destroy: function() {
      if (!this.element) {
        return;
      }
      setTimeout(function() {
        if (NavigationMap && NavigationMap.currentActivatedLength > -1) {
          NavigationMap.currentActivatedLength = 0;
        }
      }, 500);
      // Ensure cleanup of our hacks!
      window.removeEventListener('hashchange', this);
      window.removeEventListener('keydown', this);
      this.dialogShown = false;

      window.dispatchEvent(new CustomEvent('gaia-confirm-start-close'));
      this.element.addEventListener('transitionend', (e) => {
        if (e.target !== this.element) {
          return;
        }

        this.element.parentNode.removeChild(this.element);
        this.element = null;
        this.isShown = false;
        window.dispatchEvent(new CustomEvent('gaia-confirm-close'));
      });

      this.element.setAttribute('hidden', '');
    },

    // scroll to up/down
    scrollContext: function(key) {
      let dialogContainer = this.parent.querySelector('div.content');
      let headerHeight = this.parent.querySelector('h1').clientHeight;
      let listHeaderHeight = document.getElementById('messages-header').clientHeight;
      let containerHeight = document.body.clientHeight -
                            this.getSoftkeyHeight() - headerHeight - listHeaderHeight;
      // if dialog shows all texts , no need to scroll it
      if (dialogContainer.clientHeight < containerHeight) {
        this.scroll = false;
        return;
      }
      dialogContainer.style.setProperty('height', containerHeight.toString() + 'px');
      dialogContainer.scrollTop = key === 'ArrowUp'
          ? (dialogContainer.scrollTop - this.deltaTop)
          : (dialogContainer.scrollTop + this.deltaTop);
    },

    getSoftkeyHeight: function() {
      let height = 0;
      let softKeyPanel = document.querySelector('#' + FORM_ID);
      if (softkeyPanel && softkeyPanel.classList.contains('visible')) {
        height = softkeyPanel.clientHeight;
      }
      return height;
    },

    handleEvent: function(e) {
      // Ensure we hide the dialog in the face of other errors.
      if (!this.isShown) {
        return;
      }

      switch (e.type) {
        case 'hashchange':
          // Hashchange is only here to trigger this to call destroy.
          break;
        case 'confirm':
          this.destroy();
          let confirm = this.config.confirm.callback;
          confirm && confirm();
          break;
        case 'cancel':
          this.destroy();
          let cancel = this.config.cancel.callback;
          cancel && cancel();
          break;
        case 'accept':
          this.destroy();
          let accept = this.config.accept.callback;
          accept && accept();
          break;
      }

      let keyHandled = true;
      switch (e.key) {
        case 'Backspace':
          this.destroy();
          let back = this.config.backcallback;
          back && back();
          break;
        case 'Enter':
        case 'Accept':
          if (this.config.accept && this.config.accept.l10nId && this.dialogShown) {
            this.element.dispatchEvent(new CustomEvent('accept'));
          }
          break;
        case 'SoftLeft':
          if (this.config.cancel && this.config.cancel.l10nId && this.isShown) {
            this.element.dispatchEvent(new CustomEvent('cancel'));
          }
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          this.scrollContext(e.key);
          break;
        case 'SoftRight':
          if (this.config.confirm && this.config.confirm.l10nId && this.isShown) {
            this.element.dispatchEvent(new CustomEvent('confirm'));
          }
          break;
        default:
          if (!this.isGroup) {
            keyHandled = false;
          }
          break;
      }

      if (keyHandled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  // This name is intentionally verbose.
  window.ConfirmDialogHelper = ConfirmDialogHelper;
}(window));
