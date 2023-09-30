
/* global LazyLoader */

(function(exports) {
  'use strict';

  var resources = ['/shared/js/component_utils.js',
                   '/shared/elements/gaia_confirm/script.js'];
  var dialogHelperElement = null;
  var confirmSoftkey = new SoftkeyPanel({
    menuClassName: 'menu-button',
    items:[
      {
        name: '',
        priority: 1,
        method: function() {
          console.log("confirmSoftkey created");
        }
      }]
    });
  confirmSoftkey.hide();
  /**
  Generic dialog helper this _depends_ on <gaia-confirm> but is not required
  to be loaded as part of the main gaia-confirm script.
  */
  function ConfirmDialogHelper(config) {
    this.config = config;
  }

  ConfirmDialogHelper.prototype = {
    activeElement: null,
    deltaTop: 100,
    Softkey: confirmSoftkey,
    isShown: false,
    show: function(parent) {
      LazyLoader.load(resources, this._show.bind(this, parent));
    },

    _show: function(parent) {
      var config = this.config;
      var self = this;
      self.parent = parent;
      self.activeElement = document.activeElement;
      var wrapper = document.createElement('div');

      // only include a cancel button if the config was given...
      var cancelButton = config.cancel ?
        '<button class="cancel" type="button"></button>' :
        '';
      var confirmClass = config.system?"insystem":"";
      // This is a hack set role="menuitem" in order to readout all components content.
      wrapper.innerHTML =
        '<gaia-confirm role="menuitem" tabindex="-1" class='+confirmClass+'>' +
          '<h1 style="text-align:center;"></h1>' +
          '<div class="content"><div>' +
          '<p></p>' +
          '<p class="noborder" hidden></p>' +
          '</div></div>' +
        '</gaia-confirm>';

      var element = wrapper.firstElementChild;

      this.element = element;
      dialogHelperElement = element;

      element.dataset.type = config.type;
      element.addEventListener('confirm', this);
      element.addEventListener('cancel', this);
      element.addEventListener('accept', this);
      // set a timeout for gaia-confirm transition finish(0.3s)
      setTimeout(() => {
        window.addEventListener('keydown', this);
      }, 300);
      // XXX: Primarily here for pressing the home screen button.
      // The home button triggers a hashchange of the homescreen.
      window.addEventListener('hashchange', this);
      // TODO: Add visibility change handling...

      var plist = element.querySelectorAll('p');
      var title = element.querySelector('h1');
      var body = plist[0];
      var desc = plist[1];
      //var cancel = element.querySelector('.cancel');
      //var confirm = element.querySelector('.confirm');

      var setL10nAttributes = function (element, options){
        if ('string' === typeof options) {
          navigator.mozL10n.setAttributes(element, options);
        }

        if(options.id) {
          navigator.mozL10n.setAttributes(element, options.id, options.args);
        } else if (options.text) {
          element.textContent = options.text;
        }
      };

      setL10nAttributes(title, config.title);
      setL10nAttributes(body, config.body);

      if (config.desc ||
         (config.desc &&
          config.desc !== '')) {
        desc.hidden = false;
        setL10nAttributes(desc, config.desc);
      } else {
        desc.hidden = true;
      }

      if(NavigationMap && NavigationMap.currentActivatedLength>-1) {
        if(NavigationMap.currentActivatedLength == 0) {
          NavigationMap.currentActivatedLength = 1;
        }else{
          setTimeout(function() {
            self.show(parent);
          },600);
          return ;
        }
      }
      element.setAttribute('hidden', '');
      parent.appendChild(element);

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
          self.isShown = true;
          window.dispatchEvent(new CustomEvent('gaia-confirm-open'));
        });
      });

      //init softkey
      var softkeyParams = {
        menuClassName: 'menu-button',
        header:{},
        items:[]
      };
      if(config.cancel) {
        softkeyParams.items.push({
          name: '',
          priority: 1,
          l10nId: config.cancel.l10nId,
          method: function(){}
        });
      }
      if(config.accept) {
        softkeyParams.items.push({
          name: '',
          priority: 2,
          l10nId: config.accept.l10nId,
          method: function(){}
        });
      }
      if(config.confirm) {
        softkeyParams.items.push({
          name: '',
          priority: 3,
          l10nId: config.confirm.l10nId,
          method: function(){}
        });
      }
      confirmSoftkey.initSoftKeyPanel(softkeyParams);
      confirmSoftkey.show();
    },

    close: function() {
      this.destroy();
      confirmSoftkey.hide();
    },

    destroy: function() {
      if (!this.element) {
        return;
      }
      setTimeout(function(){
        if(NavigationMap && NavigationMap.currentActivatedLength>-1) {
          NavigationMap.currentActivatedLength = 0;
        }
      },500);
      this.activeElement.focus();
      // Ensure cleanup of our hacks!
      window.removeEventListener('hashchange', this);
      window.removeEventListener('keydown', this);
      this.element.addEventListener('transitionend',
        function removeAfterHide(e) {
          if (e.target !== this.element) {
            return;
          }

          this.element.parentNode.removeChild(this.element);
          this.element = null;
          this.isShown = false;
          window.dispatchEvent(new CustomEvent('gaia-confirm-close'));
        }.bind(this));

      this.element.setAttribute('hidden', '');
    },

    // scroll to up/down
    scrollContext: function(key) {
      var dialogContainer = this.parent.querySelector('div.content');
      var headerHeight = this.parent.querySelector('h1').clientHeight;
      var containerHeight = document.body.clientHeight - this.getSoftkeyHeight() - headerHeight;
      // if dialog shows all texts , no need to scroll it
      if(dialogContainer.clientHeight < containerHeight) {
        this.scroll = false;
        return;
      }
      dialogContainer.style.setProperty('height', containerHeight.toString()+'px');
      dialogContainer.scrollTop = key === 'ArrowUp'
      ? (dialogContainer.scrollTop - this.deltaTop)
      : (dialogContainer.scrollTop + this.deltaTop);
    },

    getSoftkeyHeight: function() {
      var height = 0;
      var softKeyPanel = document.querySelector('#'+FORM_ID);
      if(softkeyPanel && softkeyPanel.classList.contains('visible'))
        height = softkeyPanel.clientHeight;
      return height;
    },

    handleEvent: function(e) {
      // Ensure we hide the dialog in the face of other errors.

      switch (e.type) {
        case 'hashchange':
          // Hashchange is only here to trigger this to call destroy.
          break;
        case 'confirm':
          this.destroy();
          var confirm = this.config.confirm.callback;
          confirm && confirm();
          break;
        case 'cancel':
          this.destroy();
          var cancel = this.config.cancel.callback;
          cancel && cancel();
          break;
        case 'accept':
          this.destroy();
          var accept = this.config.accept.callback;
          accept && accept();
          break;
      }
      // handle back key
      switch (e.key) {
        case "BrowserBack":
        case 'Backspace':
        case "KanjiMode":
        case "Backspace":
          confirmSoftkey.hide();
          this.destroy();
          var back = this.config.backcallback;
          back && back();
          e.preventDefault();
          e.stopPropagation();
          break;
        case "Enter":
        case "Accept":
          if(this.config.accept) {
            confirmSoftkey.hide();
            this.element.dispatchEvent(new CustomEvent('accept'));
          }
          break;
        case "ContextMenu":
        case "SoftLeft":
        case "F1":
          if(this.config.cancel && this.isShown) {
            confirmSoftkey.hide();
            this.element.dispatchEvent(new CustomEvent('cancel'));
          }
          break;
        case "ArrowUp":
        case "ArrowDown":
          this.scrollContext(e.key);
          e.preventDefault();
          e.stopPropagation();
          break;
        case "BrowserSearch":
        case "SoftRight":
        case "F2":
          if(this.config.confirm && this.isShown) {
            confirmSoftkey.hide();
            this.element.dispatchEvent(new CustomEvent('confirm'));
          }
          break;
      }
    }
  };

  // This name is intentionally verbose.
  window.ConfirmDialogHelper = ConfirmDialogHelper;
}(window));
