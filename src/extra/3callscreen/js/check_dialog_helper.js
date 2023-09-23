/* global LazyLoader, Utils, NavigationMap, SoftkeyManager */

(function(window) {
  'use strict';

  const WAITTIMEOUT = 600;
  const resources = [
    'http://shared.localhost/js/utils/components/component_utils.js',
    'http://shared.localhost/elements/gaia_confirm/gaia_confirm.js'
  ];

  function CheckDialogHelper(config) {
    this.config = config;
    this.dialogShown = false;
  }

  CheckDialogHelper.prototype = {
    activeElement: null,
    deltaTop: 100,
    Softkey: window.option,
    isShown: false,
    isGroup: false,
    show: function(parent) {
      LazyLoader.load(resources, this._show.bind(this, parent));
    },

    // Show dialog.
    _show: function(parent) {
      const config = this.config;
      this.parent = parent;
      this.activeElement = document.activeElement;
      const wrapper = document.createElement('div');
      const confirmClass = config.system ? 'insystem' : '';
      wrapper.innerHTML =
        '<gaia-confirm id="gaia-confirm" role="menuitem" tabindex="1" class=' +
        confirmClass + '>' +
        '<h1 slot="title" style="text-align:center; height:3rem; padding-top:0.5rem;"></h1>' +
        '<div slot="content" class="content height-adjust"><div>' +
        '<p style="font-weight: normal;word-wrap: break-word;margin: 0;padding: 1rem;padding-bottom: 0.5rem;line-height: 2.4rem;color: var(--color-gs90);background: var(--color-gs10);"></p>' +
        '<p style="font-weight: normal;font-size:1.4rem;word-wrap: break-word;margin: 0;padding: 1rem;padding-top: 0;line-height: 2.4rem;color: var(--color-gs90);background: var(--color-gs10);"></p>' +
        '<p class="noborder" hidden></p>' +
        '<div class="group-check-div">' +
        '<p class="group-check-p">Do not show again</p>' +
        '<div data-icon="check-off" id="group-check-enable" class="group-check-input"></div>' +
        '</div>' +
        '</gaia-confirm>';

      const element = wrapper.firstElementChild;
      this.element = element;
      element.dataset.type = config.type;
      // Event listener.
      element.addEventListener('confirm', this);
      element.addEventListener('cancel', this);
      element.addEventListener('accept', this);
      window.addEventListener('hashchange', this);
      
      const plist=element.querySelectorAll('p');
      const title = element.querySelector('h1');
      title.style.textAlign = 'center';
      const body = plist[0];
      const subBody = plist[1];
      const desc = plist[2];

      const setL10nAttributes = function(element, options) {
        const l10nInterface = window.api.l10n;
        if ('string' === typeof options) {
          l10nInterface.setAttributes(element, options);
        }

        if (options.id) {
          l10nInterface.setAttributes(element, options.id, options.args);
        } else if (options.text) {
          element.textContent = options.text;
        }
      };

      if (config.isGroupMessage) {
        this.isGroup = true;
      }
      setL10nAttributes(title, config.title);
      setL10nAttributes(body, config.body);
      //setL10nAttributes(subBody, config.subBody);

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
          }, WAITTIMEOUT);
          return;
        }
      }

      element.setAttribute('hidden', '');
      parent.appendChild(element);
      window.addEventListener('keydown', this, true);
      this.dialogShown = true;
      this.activeElement.blur();

      element.removeAttribute('hidden');
      this.isShown = true;
      window.dispatchEvent(new CustomEvent('gaia-confirm-open'));

      // Init softkey.
      this.initSoftkey();
      /* fih e */
      element.focus();
    },

    initSoftkey: function() {
      const config = this.config;
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
      /* fih b */
      if (window.option) {
        window.option.initSoftKeyPanel(softkeyParams);
      } else {
        window.option = new SoftkeyPanel(softkeyParams);
      }
      window.option.show();
      /* fih e */
    },

    close: function() {
      window.option.hide();
      this.destroy();
    },

    // Hide dialog.
    destroy: function() {
      if (!this.element) {
        return;
      }

      if (NavigationMap && NavigationMap.currentActivatedLength > -1) {
        NavigationMap.currentActivatedLength = 0;
      }

      window.removeEventListener('hashchange', this);
      window.removeEventListener('keydown', this);
      this.dialogShown = false;

      this.element.setAttribute('hidden', '');
      this.element.parentNode.removeChild(this.element);
      this.element = null;
      this.isShown = false;
      window.dispatchEvent(new CustomEvent('gaia-confirm-close'));
      // TODO Set time out to prevent extra keydown event received.
    },

    // Scroll to up/down.
    scrollContext: function(key) {
      const dialogContainer = this.parent.querySelector('div.content');
      const headerHeight = this.parent.querySelector('h1').clientHeight;
      //const listHeaderHeight = document.getElementById('messages-header').clientHeight;
      const containerHeight = document.body.clientHeight -
                              this.getSoftkeyHeight() - headerHeight;
      // If dialog shows all texts , no need to scroll it.
      if (dialogContainer.clientHeight < containerHeight) {
        this.scroll = false;
        return;
      }
      dialogContainer.style.setProperty('height', containerHeight.toString() + 'px');
      dialogContainer.scrollTop = 
        key === 'ArrowUp' ? (dialogContainer.scrollTop - this.deltaTop) : 
                            (dialogContainer.scrollTop + this.deltaTop);
    },

    getSoftkeyHeight: function() {
      let height = 0;
      // eslint-disable-next-line no-undef
      const softkeyPanel = document.querySelector('#' + FORM_ID);
      if (softkeyPanel && softkeyPanel.classList.contains('visible')) {
        height = softkeyPanel.clientHeight;
      }
      return height;
    },

    // Handle event.
    handleEvent: function(event) {
      // Ensure we hide the dialog in the face of other errors.
      if (!this.isShown) {
        return;
      }

      const checkbox = this.element.querySelector('.group-check-input');
      switch (event.type) {
        case 'hashchange': {
          // Hashchange is only here to trigger this to call destroy.
          break;
        }
        case 'confirm': {
          if (this.config.isMergeRtt) {
            let checkbox = this.element.querySelector('.group-check-input');
            dump("merge RTT call confirm, checked: " + checkbox.checked);
            if (checkbox.checked) {
              localStorage.setItem('showmergedialog', 'false');
            }
          }
          this.close();
          const confirm = this.config.confirm.callback;
          confirm && confirm();
          break;
        }
        case 'cancel': {
          this.close();
          const cancel = this.config.cancel.callback;
          cancel && cancel();
          break;
        }
        case 'accept': {
          checkbox.checked = !checkbox.checked;
          checkbox.checked ? checkbox.setAttribute('data-icon', 'check-on') : 
                             checkbox.setAttribute('data-icon', 'check-off');
          const checkChange = checkbox.checked ? 'deselect' : 'select';
          dump("merge RTT call accept, checkChange is: " + checkChange);
          let softKeyParam = {
            "menuClassName":"menu-button",
            "header":{},
            "items":[{
              "name":"",
              "priority":1,
              "l10nId":"cancel"
            },{
              "name":"",
              "priority":2,
              "l10nId":checkChange
            }, {
              "name":"",
              "priority":3,
              "l10nId":"oem_rtt_call_merge"
            }]
          };
		  /* fih b */
          if (window.option) {
            window.option.initSoftKeyPanel(softKeyParam);
          } else {
            window.option = new SoftkeyPanel(softKeyParam);
          }
          window.option.show();
          /* fih e */
          const accept = this.config.accept.callback;
          accept && accept();
          break;
        }
        default:
          break;
      }

      let keyHandled = true;
      switch (event.key) {
        case 'Backspace': {
          this.close();
          const back = this.config.backcallback;
          back && back();
          break;
        }
        case 'Enter':
        case 'Accept': {
          if (this.config.accept && this.dialogShown) {
            this.element.dispatchEvent(new CustomEvent('accept'));
          }
          break;
        }
        case 'ArrowUp':
        case 'ArrowDown': {
          this.scrollContext(event.key);
          break;
        }
        case 'SoftLeft': {
          if (this.config.cancel && this.isShown) {
            this.element.dispatchEvent(new CustomEvent('cancel'));
          }
          break;
        }
        case 'SoftRight': {
          if (this.config.confirm && this.isShown) {
            this.element.dispatchEvent(new CustomEvent('confirm'));
          }
        }
          break;
        default: {
          if (!this.isGroup) {
            keyHandled = false;
          }
          break;
        }
      }

      if (keyHandled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  };

  // This name is intentionally verbose.
  window.CheckDialogHelper = CheckDialogHelper;
}(window));
