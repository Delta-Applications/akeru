define(['require','modules/settings_panel','shared/simslot_manager','modules/fdn_dialog','modules/settings_service'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SIMSlotManager = require('shared/simslot_manager');
  var FdnDialog = require('modules/fdn_dialog');
  var SettingsService = require('modules/settings_service');

  return function ctor_call_fdn_settings_panel() {
    var _settings = navigator.mozSettings;
    let listElements = null;

    return SettingsPanel({
      onInit: function(panel, options) {
        listElements = panel.querySelectorAll('li');
        this._cardIndex = options.cardIndex || 0;
        this._conns = window.navigator.mozMobileConnections;
        this._conn = this._conns[this._cardIndex];

        this._elements = {
          panel: panel,
          resetPin2Item: panel.querySelector('#fdn-resetPIN2'),
          simFdnSelect: document.getElementById('fdn-enabled'),
          resetPin2Button: panel.querySelector('#fdn-resetPIN2 button'),
          callFdnListItem: panel.querySelector('.call-fdn-list'),
          puk2LockedInfo: panel.querySelector('.puk2-locked-info')
        };

        this._elements.simFdnSelect.addEventListener('change',
          this._showToggleFdnDialog.bind(this));
        this._elements.resetPin2Button.onclick =
          this._showChangePin2Dialog.bind(this);

        this.gaiaHeader = document.querySelector('#simpin2-dialog gaia-header');

        this.params = {
          menuClassName: 'menu-button',
          header: { l10nId:'message' },
          items: [{
            name: 'Select',
            l10nId: 'select',
            priority: 2,
            method: function() {}
          }]
        };
        this.updateFdnState = this._updateFdnState.bind(this);
      },

      onBeforeShow: function(panel, options) {
        this.gaiaHeader.dataset.href = '#call-fdnSettings';
        SettingsSoftkey.init(this.params);
        SettingsListener.observe('ril.fdn.enabled', false,
          this.updateFdnState);

        options.cardIndex = DsdsSettings.getIccCardIndexForCallSettings();
        if (typeof options.cardIndex !== 'undefined') {
          this._cardIndex = options.cardIndex;
          this._conn = this._conns[this._cardIndex];
        }

        var iccObj = _getCurrentIccObj(this._cardIndex);
        if (iccObj) {
          iccObj.oncardstatechange = this._updateFdnStatus.bind(this);
        }
        this._updateUI();
        ListFocusHelper.addEventListener(listElements);
        ListFocusHelper.updateSoftkey(panel);
      },

      _updateFdnState: function(value) {
        this._elements.simFdnSelect.value = value;
      },

      _showPuk2Dialog: function(action, iccObj) {
        this.gaiaHeader.dataset.href = '#call-fdnSettings';
        FdnDialog.show(action, {
          cardIndex: this._cardIndex,
          onsuccess: () => {
            this._getFdnStatus(action, iccObj).then((enabled) => {
              this._showPin2Toast(this._cardIndex, action, enabled);
            });
          },
          oncancel: () => {
            this._getFdnStatus(action, iccObj);
          }
        });
      },

      _showToggleFdnDialog: function() {
        var action = this._elements.simFdnSelect.value === 'true' ?
          'enable_fdn' : 'disable_fdn';
        this._updateFdnStatus(action);
      },

      _showChangePin2Dialog: function() {
        this._updateFdnStatus('change_pin2');
      },

      _getFdnStatus: function(action, iccObj) {
        return new Promise((resolve) => {
          iccObj.getCardLock('fdn').then((result) => {
            let enabled = result.enabled;
            _settings.createLock().set({'ril.fdn.enabled' : enabled});
            this._elements.simFdnSelect.value = enabled;
            this._disabledUI(false);
            if (action === 'enable_fdn' || action === 'disable_fdn') {
              resolve(enabled);
            } else {
              resolve();
            }
          });
        });
      },

      _disabledUI: function(disabled) {
        let hrefItem = this._elements.callFdnListItem.querySelector('a');
        let simFdnItem = this._elements.simFdnSelect.parentNode.parentNode;
        if (disabled) {
          simFdnItem.setAttribute('aria-disabled','true');
          this._elements.callFdnListItem.setAttribute('aria-disabled','true');
          this._elements.resetPin2Item.setAttribute('aria-disabled','true');
          this._elements.puk2LockedInfo.hidden = false;
          simFdnItem.classList.add('none-select');
          this._elements.callFdnListItem.classList.add('none-select');
          this._elements.resetPin2Item.classList.add('none-select');
          this._elements.callFdnListItem.disabled = true;
          this._elements.resetPin2Button.disabled = true;
          hrefItem.removeAttribute('href');
        } else {
          simFdnItem.removeAttribute('aria-disabled');
          this._elements.callFdnListItem.removeAttribute('aria-disabled');
          this._elements.resetPin2Item.removeAttribute('aria-disabled');
          this._elements.puk2LockedInfo.hidden = true;
          simFdnItem.classList.remove('none-select');
          this._elements.callFdnListItem.classList.remove('none-select');
          this._elements.resetPin2Item.classList.remove('none-select');
          this._elements.callFdnListItem.disabled = false;
          this._elements.resetPin2Button.disabled = false;
          hrefItem.setAttribute('href', '#call-fdnList');
        }
      },

      _updateUI: function() {
        let iccObj = _getCurrentIccObj(this._cardIndex);
        if (iccObj) {
          let self = this;
          let req = iccObj.getCardLockRetryCount('pin2');
          req.onsuccess = function() {
            let pin2RetryCount = req.result.retryCount;
            if (!pin2RetryCount) {
              let request = iccObj.getCardLockRetryCount('puk2');
              request.onsuccess = function() {
                let puk2RetryCount = request.result.retryCount;
                if (!puk2RetryCount) {
                  console.log('puk2 locked');
                  self._disabledUI(true);
                } else {
                  self._disabledUI(false);
                }
              };
            } else {
              self._disabledUI(false);
            }
          };
          req.onerror = function() {
            let simFdnItem =
              self._elements.simFdnSelect.parentNode.parentNode;
            simFdnItem.classList.add('none-select');
            self._elements.callFdnListItem.classList.add('none-select');
            self._elements.resetPin2Item.classList.add('none-select');
          };
        }
      },

      _showPin2Toast: function(index, action, enabled) {
        if (action === 'enable_fdn' || action === 'disable_fdn') {
          if (SIMSlotManager.isMultiSIM()) {
            if (enabled) {
              showToast('simpin2-on-with-index',
                { 'index': index + 1 });
            } else {
              showToast('simpin2-off-with-index',
                { 'index': index + 1 });
            }
          } else {
            if (enabled) {
              showToast('simpin2-on');
            } else {
              showToast('simpin2-off');
            }
          }
        } else if (action === 'change_pin2') {
          if (SIMSlotManager.isMultiSIM()) {
            showToast('simpin2-changed-with-index',
              { 'index': index + 1 });
          } else {
            showToast('simpin2-changed');
          }
        }
      },

      _updateFdnStatus: function(action) {
        var iccObj = _getCurrentIccObj(this._cardIndex);
        if (iccObj) {
          var self = this;
          var req = iccObj.getCardLockRetryCount('pin2');
          req.onsuccess = function() {
            var pin2RetryCount = req.result.retryCount;
            if (!pin2RetryCount) {
              var request = iccObj.getCardLockRetryCount('puk2');
              request.onsuccess = function() {
                var puk2RetryCount = request.result.retryCount;
                if (!puk2RetryCount) {
                  console.log('puk2 locked');
                  self._disabledUI(true);
                } else {
                  action = 'unlock_puk2';
                  self._showPuk2Dialog(action, iccObj);
                }
              };
            } else {
              FdnDialog.show(action, {
                cardIndex: self._cardIndex,
                onsuccess: () => {
                  self._getFdnStatus(action, iccObj).then((enabled) => {
                    self._showPin2Toast(self._cardIndex, action, enabled);
                  });
                },
                oncancel: () => {
                  self._getFdnStatus(action, iccObj);
                }
              });
            }
          };
          req.onerror = function() {
            let simFdnItem =
              self._elements.simFdnSelect.parentNode.parentNode;
            simFdnItem.classList.add('none-select');
            self._elements.callFdnListItem.classList.add('none-select');
            self._elements.resetPin2Item.classList.add('none-select');
          };
        }
      },

      onBeforeHide: function() {
        SettingsListener.unobserve('ril.fdn.enabled', this.updateFdnState);
        ListFocusHelper.removeEventListener(listElements);
      }
    });
  };
});
