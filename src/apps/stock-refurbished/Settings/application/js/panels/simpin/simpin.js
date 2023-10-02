/* global SettingsSoftkey */

define(['require','shared/airplane_mode_helper','shared/simslot_manager','simcard_dialog','shared/template','modules/settings_service'],function(require) {
  

  var _ = window.navigator.mozL10n.get;
  var AirplaneModeHelper = require('shared/airplane_mode_helper');
  var SIMSlotManager = require('shared/simslot_manager');
  var SimPinDialog = require('simcard_dialog');
  var Template = require('shared/template');
  var SettingsService = require('modules/settings_service');

  var SimPin = function(elements) {
    this._elements = elements;
  };

  SimPin.prototype = {
    init: function simpin_init(panel) {
      AirplaneModeHelper.ready(() => {
        this.panel = panel;
        this.conns = window.navigator.mozMobileConnections;
        this.iccManager = window.navigator.mozIccManager;
        this.simPinTemplate = new Template(this._elements.simPinTmpl);
        this.simPinDialog = new SimPinDialog(this._elements.dialog);

        this._elements.simPinContainer.addEventListener('click', this);
        this.addIccDetectedEvent();
        this.addIccUndetectedEvent();

        this.initSimPinBack();
        this.initSimPinsUI();
        this.updateSimPinsUI();
        this.addChangeEventOnIccs();
      });
    },
    initSimPinBack: function simpin_initSimPinBack() {
      // Because this panel is used in one-sim & two-sim structures,
      // the entry point of sim security is different.
      //
      // In this way, we have to make sure users can go back to the
      // right panel.
      this._elements.simPinHeader.dataset.href = SIMSlotManager.isMultiSIM() ?
        '#sim-manager': '#root';
    },
    initSimPinsUI: function simpin_initSimPinsUI() {
      var simPinHTMLs = [];

      [].forEach.call(this.conns, (conn, index) => {
        var simPinIndex = index + 1;

        if (!SIMSlotManager.isMultiSIM()) {
          simPinIndex = '';
        }

        simPinHTMLs.push(
          this.simPinTemplate.interpolate({
            'sim-index': index.toString(),
            'simPinIndex': simPinIndex.toString()
          })
        );
      });

      this._elements.simPinContainer.innerHTML = simPinHTMLs.join('');
    },

    updateSimPinUIforJio: function updateSimPinUIforJio(items, iccId) {
      if (!_isJioCard(iccId)) {
        for (let i in items) {
          items[i].setAttribute('aria-disabled', true);
          items[i].classList.add('none-select');
        }
      } else {
        for (let i in items) {
          if (!items[i].hidden) {
            items[i].removeAttribute('aria-disabled');
            items[i].classList.remove('none-select');
          }
        }
      }
    },

    updateSimPinUI: function simpin_updateSimPinUI(cardIndex) {
      var iccId = this.conns[cardIndex].iccId;
      var icc = this.iccManager.getIccById(iccId);
      var changeSimPinItem =
        this._elements.simPinContainer.querySelector(
          '.simpin-change-' + cardIndex);

      var simPinEnableSelect =
        this._elements.simPinContainer.querySelector(
          '.simpin-enabled-' + cardIndex + ' select');

      var simPinItem =
        this._elements.simPinContainer.querySelector(
          '.simpin-' + cardIndex);

      var validateSimPinItem =
        this._elements.simPinContainer.querySelector(
          '.simpin-validate-' + cardIndex);

      if (icc === null) {
        simPinItem.setAttribute('aria-disabled', true);
        simPinItem.classList.add('none-select');
        ListFocusHelper.updateSoftkey(this.panel);
        return;
      }

      simPinEnableSelect.onchange = () => {
        var cardIndex = simPinEnableSelect.dataset &&
          simPinEnableSelect.dataset.simIndex;
        cardIndex = parseInt(cardIndex, 10);
        this.checkSimPinSelect(simPinEnableSelect, cardIndex);
      };

      var isSimAvailable = icc && icc.cardState && icc.cardState !== 'unknown';
      if (!isSimAvailable) {
        changeSimPinItem.hidden = true;
        return;
      }

      simPinItem.setAttribute('aria-disabled', true);
      simPinItem.classList.add('none-select');
      ListFocusHelper.updateSoftkey(this.panel);
      simPinEnableSelect.classList.add('hidden');

      icc.getCardLockRetryCount('pin').then((values) => {
        SettingsDBCache.getSettings((results) => {
          let isJioCustomizedEnabled = results['jio.simPinSettings.enabled'];
          let retryCount = values.retryCount;
          if (retryCount > 0) {
            // with SIM card, query its status
            icc.getCardLock('pin').then((result) => {
              let enabled = result.enabled;
              if (icc.cardState === 'pinRequired' ||
                icc.cardState === 'pukRequired') {
                simPinItem.hidden = true;
                changeSimPinItem.hidden = true;
                validateSimPinItem.hidden = false;
                if (isJioCustomizedEnabled) {
                  this.updateSimPinUIforJio({
                    simPinItem, changeSimPinItem, validateSimPinItem}, iccId);
                } else {
                  validateSimPinItem.removeAttribute('aria-disabled');
                  validateSimPinItem.classList.remove('none-select');
                }
                NavigationMap.refresh();
              } else {
                simPinItem.hidden = false;
                validateSimPinItem.hidden = true;
                changeSimPinItem.hidden = !enabled;

                ListFocusHelper.updateSoftkey(this.panel);
                simPinEnableSelect.classList.remove('hidden');
                let status = simPinItem.querySelector('.simpin-status');
                if (status) {
                  simPinItem.removeChild(status);
                }
                this.updateSelectState(simPinEnableSelect, enabled);
                if (isJioCustomizedEnabled) {
                  this.updateSimPinUIforJio({
                    simPinItem, changeSimPinItem, validateSimPinItem}, iccId);
                } else {
                  simPinItem.removeAttribute('aria-disabled');
                  simPinItem.classList.remove('none-select');
                  if (enabled) {
                    changeSimPinItem.removeAttribute('aria-disabled');
                    changeSimPinItem.classList.remove('none-select');
                  }
                }
                NavigationMap.refresh();
              }
            }, () => {
              console.error('ERROR: SIM ' + (++cardIndex) +
                ' PIN status checked failed, reason: ' +
                req.error.name + '.');
              showToast('simpin-status-error');
              simPinItem.hidden = false;
              changeSimPinItem.hidden = true;
              validateSimPinItem.hidden = true;
              let status = simPinItem.querySelector('.simpin-status');
              if (!status) {
                status = document.createElement('span');
                status.classList.add('simpin-status');
                simPinItem.appendChild(status);
              }
              status.setAttribute('data-l10n-id', 'simpin-status-unknown');
              simPinEnableSelect.classList.add('hidden');
              if (isJioCustomizedEnabled) {
                this.updateSimPinUIforJio({
                  simPinItem, changeSimPinItem, validateSimPinItem}, iccId);
              } else {
                simPinItem.removeAttribute('aria-disabled');
                simPinItem.classList.remove('none-select');
              }
           });
          } else {
            simPinItem.hidden = false;
            changeSimPinItem.hidden = true;
            validateSimPinItem.hidden = true;
            let status = simPinItem.querySelector('.simpin-status');
            if (!status) {
              status = document.createElement('span');
              status.classList.add('simpin-status');
              simPinItem.appendChild(status);
            }
            status.setAttribute('data-l10n-id', 'simpin-status-unknown');
            simPinEnableSelect.classList.add('hidden');
            if (isJioCustomizedEnabled) {
              this.updateSimPinUIforJio({
                simPinItem, changeSimPinItem, validateSimPinItem}, iccId);
            } else {
              simPinItem.removeAttribute('aria-disabled');
              simPinItem.classList.remove('none-select');
            }
          }
        });
      });
    },
    updateSelectState: function simpin_updateSelectState(simPinEnableSelect, enabled) {
      simPinEnableSelect.options[0].selected = enabled;
      simPinEnableSelect.options[1].selected = !enabled;
    },
    updateSimPinsUI: function simpin_updateSimPinsUI() {
      [].forEach.call(this.conns, (simcard, cardIndex) => {
        this.updateSimPinUI(cardIndex);
      });
    },
    handleEvent: function simpin_handleEvent(evt) {
      var target = evt.target;
      var cardIndex = target.dataset && target.dataset.simIndex;
      var type = target.dataset && target.dataset.type;

      if (!cardIndex) {
        return;
      }
      if (target.parentNode.hasAttribute('aria-disabled')) {
        return;
      }

      // We need number type
      cardIndex = parseInt(cardIndex, 10);
      var iccId = this.conns[cardIndex].iccId;
      var icc = this.iccManager.getIccById(iccId);

      switch (type) {
        case 'validateSimPin':
          if (icc.cardState === 'pinRequired') {
            this.simPinDialog.show('unlock_pin', {
              cardIndex: cardIndex,
              onsuccess: () => {
                this.updateSimPinUI(cardIndex);
              },
              oncancel: () => {
                this.updateSimPinUI(cardIndex);
              }
            });
          }
          if (icc.cardState === 'pukRequired') {
            this.simPinDialog.show('unlock_puk', {
              cardIndex: cardIndex,
              onsuccess: () => {
                this.updateSimPinUI(cardIndex);
              },
              oncancel: () => {
                this.updateSimPinUI(cardIndex);
              }
            });
          }
          break;

        case 'changeSimPin':
          // TODO:
          // remember to update SimPinDialog for DSDS structure
          if (icc.cardState === 'pukRequired') {
            this.simPinDialog.show('unlock_puk', {
              cardIndex: cardIndex,
              onsuccess: () => {
                this.updateSimPinUI(cardIndex);
              },
              oncancel: () => {
                this.updateSimPinUI(cardIndex);
              }
            });
          } else {
            this.simPinDialog.show('change_pin', {
              cardIndex: cardIndex,
              // show toast after user successfully change pin
              onsuccess: () => {
                if (SIMSlotManager.isMultiSIM()) {
                  showToast('simpin-changed-with-index',
                    { 'index': cardIndex + 1 });
                } else {
                  showToast('simpin-changed');
                }
              }
            });
          }
          break;
      }
    },
    checkSimPinSelect: function simpin_checkSimPinSelect(simPinEnableSelect, cardIndex) {
      var enabled = (simPinEnableSelect.value === 'true');
      var iccId = this.conns[cardIndex].iccId;
      var icc = this.iccManager.getIccById(iccId);

      if (icc.cardState === 'pukRequired') {
        this.simPinDialog.show('unlock_puk', {
            cardIndex: cardIndex,
            onsuccess: () => {
              this.updateSimPinUI(cardIndex);
            },
            oncancel: () => {
              this.updateSimPinUI(cardIndex);
            }
        });
      } else {
        var action = enabled ? 'enable_lock' : 'disable_lock';
          this.simPinDialog.show(action, {
            cardIndex: cardIndex,
            onsuccess: () => {
              if (SIMSlotManager.isMultiSIM()) {
                if (enabled) {
                  showToast('simpin-on-with-index',
                    { 'index': cardIndex + 1 });
                } else {
                  showToast('simpin-off-with-index',
                    { 'index': cardIndex + 1 });
                }
              } else {
                if (enabled) {
                  showToast('simpin-on');
                } else {
                  showToast('simpin-off');
                }
              }
              this.updateSimPinUI(cardIndex);
            },
            oncancel: () => {
              this.updateSimPinUI(cardIndex);
            }
        });
      }
    },
    addIccDetectedEvent: function simpin_addIccDetectedEvent() {
      // if there is a change that icc instance is available
      // we can update its cardstatus to make it reflect the
      // real world.
      this.iccManager.addEventListener('iccdetected', (evt) => {
        var iccId = evt.iccId;
        var icc = this.iccManager.getIccById(iccId);

        if (icc) {
          var cardIndex = this.getCardIndexByIccId(iccId);

          // we have to update its status and add change event
          // for it to make it reflect status on to UI
          this.updateSimPinUI(cardIndex);
          this.addChangeEventOnIccByIccId(iccId);
        }
      });
    },
    addIccUndetectedEvent: function simpin_addIccDetectedEvent() {
      // if there is a change that icc instance is not available
      // we have to update all cards' status
      this.iccManager.addEventListener('iccundetected', (evt) => {
        this.updateSimPinsUI();
      });
    },
    addAirplaneModeChangeEvent: function simpin_addAirplaneModeChangeEvent() {
      AirplaneModeHelper.addEventListener('statechange', this.updateUI);
    },
    addChangeEventOnIccs: function simpin_addChangeEventOnIccs() {
      for (var i = 0; i < this.conns.length; i++) {
        var iccId = this.conns[i].iccId;
        var icc = this.iccManager.getIccById(iccId);
        if (icc) {
          this.addChangeEventOnIccByIccId(iccId);
        }
      }
    },
    addChangeEventOnIccByIccId:
      function simpin_addChangeEventOnIccByIccId(iccId) {
        var icc = this.iccManager.getIccById(iccId);
        if (icc) {
          icc.addEventListener('cardstatechange', () => {
            var cardIndex = this.getCardIndexByIccId(iccId);
            this.updateSimPinUI(cardIndex);
          });
        }
    },
    getCardIndexByIccId: function simpin_getCardIndexByIccId(iccId) {
      var cardIndex;
      for (var i = 0; i < this.conns.length; i++) {
        if (this.conns[i].iccId == iccId) {
          cardIndex = i;
        }
      }
      return cardIndex;
    },
    updateUI: function simpin_updateUI(status) {
      this.updateSimPinsUI();
    },
    removeAirplaneModeChangeEvent: function simpin_removeAirplaneModeChangeEvent() {
      AirplaneModeHelper.removeEventListener('statechange', this.updateUI);
    }
  };

  return function ctor_simpin(elements) {
    return new SimPin(elements);
  };
});
