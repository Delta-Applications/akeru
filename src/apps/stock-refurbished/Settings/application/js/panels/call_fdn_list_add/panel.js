define(['require','modules/dialog_panel','modules/settings_service','modules/fdn_context','modules/fdn_dialog'],function(require) {
  

  var DialogPanel = require('modules/dialog_panel');
  var SettingsService = require('modules/settings_service');
  var FdnContext = require('modules/fdn_context');
  var FdnDialog = require('modules/fdn_dialog');

  return function ctor_call_fdn_list_add() {
    let _skipUpdate = false;

    return DialogPanel({
      onInit: function(panel) {
        this._submitable = false;
        this._mode = 'add';
        this._panel = panel;

        this._elements = {};
        this._elements.fdnNameInput = panel.querySelector('.fdnContact-name');
        this._elements.fdnNumberInput =
          panel.querySelector('.fdnContact-number');
        this._elements.fdnContactTitle =
          panel.querySelector('.fdnContact-title');
        this.gaiaHeader = document.querySelector('#simpin2-dialog gaia-header');
        this._boundInputsChange = this._checkContactInputs.bind(this);
      },

      _initSoftkey: function(saveSoftkeyEnable) {
        var self = this;
        if (saveSoftkeyEnable) {
          var params = {
            menuClassName: 'menu-button',
            header: {
              l10nId: 'message'
            },
            items: [{
              name: 'Cancel',
              l10nId: 'cancel',
              priority: 1,
              method: function() {
                SettingsService.navigate('call-fdnList');
              }
            }, {
              name: 'Save',
              l10nId: 'save',
              priority: 2,
              method: function() {
                self.gaiaHeader.dataset.href = '#call-fdnList';
                self._updateContact('add', self._elements.fdnNameInput.value,
                  self._elements.fdnNumberInput.value);
              }
            }, {
              name: 'Contact',
              l10nId: 'fdnContact',
              priority: 3,
              method: function() {
                var activity = new MozActivity({
                  name: 'pick',
                  data: {
                    type: 'webcontacts/tel'
                  }
                });
                activity.onsuccess = function() {
                  var result = activity.result;
                  var name = activity.result.name　+ '';
                  var number = activity.result.tel[0].value　+ '';
                  self._elements.fdnNameInput.value = name.substr(0, 14);
                  self._elements.fdnNumberInput.value = number.substr(0, 20);
                  self._checkContactInputs();
                };
              }
            }]
          };
        } else {
          var params = {
            menuClassName: 'menu-button',
            header: {
              l10nId: 'message'
            },
            items: [{
              name: 'Cancel',
              l10nId: 'cancel',
              priority: 1,
              method: function() {
                SettingsService.navigate('call-fdnList');
              }
            }, {
              name: 'Contact',
              l10nId: 'fdnContact',
              priority: 3,
              method: function() {
                var activity = new MozActivity({
                  name: 'pick',
                  data: {
                    type: 'webcontacts/tel'
                  }
                });
                activity.onsuccess = function() {
                  var result = activity.result;
                  var name = activity.result.name　+ '';
                  var number = activity.result.tel[0].value　+ '';
                  self._elements.fdnNameInput.value = name.substr(0, 14);
                  self._elements.fdnNumberInput.value = number.substr(0, 20);
                  self._checkContactInputs();
                };
              }
            }]
          };
        }
        SettingsSoftkey.init(params);
        SettingsSoftkey.show();
      },

      onBeforeShow: function(panel, options) {
        if (!_skipUpdate) {
          this.gaiaHeader.dataset.href = '#call-fdnList';
          this._currentContact = options.contact;
          this._mode = options.mode || 'add';
          this._elements.fdnNameInput.value = options.name || '';
          this._elements.fdnNumberInput.value = options.number || '';
          if (this._mode === 'add') {
            this._elements.fdnContactTitle.setAttribute('data-l10n-id',
              'fdnAction-add');
          } else {
            this._elements.fdnContactTitle.setAttribute('data-l10n-id',
              'fdnAction-edit-header');
          }
        } else {
          _skipUpdate = false;
        }

        this._elements.fdnNameInput.addEventListener('input', this._boundInputsChange);
        this._elements.fdnNumberInput.addEventListener('input', this._boundInputsChange);
        this._elements.fdnNameInput.parentNode.addEventListener('focus',
          this._focusOnIputItem);
        this._elements.fdnNumberInput.parentNode.addEventListener('focus',
          this._focusOnIputItem);
        document.addEventListener('visibilitychange', this._visibilityChange);
        this._checkContactInputs();
      },

      onShow: function(panel) {
        var input = panel.querySelector('li.focus input');
        input && input.focus();
      },

      onBeforeHide: function() {
        this._elements.fdnNameInput.removeEventListener('input', this._boundInputsChange);
        this._elements.fdnNumberInput.removeEventListener('input', this._boundInputsChange);
        this._elements.fdnNameInput.parentNode.removeEventListener('focus',
          this._focusOnIputItem);
        this._elements.fdnNumberInput.parentNode.removeEventListener('focus',
          this._focusOnIputItem);
        document.removeEventListener('visibilitychange', this._visibilityChange);
      },

      _focusOnIputItem: function(item) {
        var input = item.target.querySelector('input');
        input && input.focus();
      },

      _visibilityChange: function() {
        if (document.hidden) {
          _skipUpdate = true;
        }
      },

      onSubmit: function() {
        if (this._submitable) {
          return Promise.resolve({
            name: this._elements.fdnNameInput.value,
            number: this._elements.fdnNumberInput.value
          });
        } else {
          return Promise.reject();
        }
      },

      _showPuk2Dialog: function(action, cardIndex) {
        this.gaiaHeader.dataset.href = '#call-fdnList';
        FdnDialog.show(action, {
          cardIndex: cardIndex
        });
      },

      _updateFdnStatus: function(cardIndex, contact) {
        var iccObj = _getCurrentIccObj(cardIndex);
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
                } else {
                  self._showPuk2Dialog('unlock_puk2', cardIndex);
                }
              };
            } else {
	      FdnDialog.show('get_pin2', {
	        fdnContact: contact,
	        cardIndex: cardIndex,
	        onsuccess: () => {
	          SettingsService.navigate('call-fdnList', {
	            name: self._elements.fdnNameInput.value,
	            number: self._elements.fdnNumberInput.value
	          });
	        },
	        oncancel: () => {
	          SettingsService.navigate('call-fdnList', {
	            name: self._elements.fdnNameInput.value,
	            number: self._elements.fdnNumberInput.value
	          });
	        }
	      });
            }
          };
        }
      },
      /**
       * update information on each contact item based on passed in parameters.
       *
       * @type {Function}
       * @param {String} action
       * @param {Object} options
       * @return {Promise}
       */
      _updateContact: function(action, name, number) {
        var self = this;
        var cardIndex = DsdsSettings.getIccCardIndexForCallSettings();

        var contact = FdnContext.createAction(action, {
          cardIndex: cardIndex,
          contact: {
            id: this._currentContact && this._currentContact.id,
            name: name,
            number: number
          }
        });

        this._updateFdnStatus(cardIndex, contact);
      },

      _isPhoneNumberValid: function(number) {
        if (number) {
          let reg = /\#+|\*+/g;
          let tempNumber = number;
          tempNumber = tempNumber.replace(reg, '');
          let re = /^([\+]*[0-9])+$/;
          if (re.test(tempNumber)) {
            return true;
          }
        }
        return false;
      },

      _checkContactInputs: function() {
        if (this._elements.fdnNameInput.value === '' ||
          this._elements.fdnNumberInput.value === '' ||
          !this._isPhoneNumberValid(this._elements.fdnNumberInput.value)) {
          this._submitable = false;
        } else {
          this._submitable = true;
        }
        this._initSoftkey(this._submitable);
      }
    });
  };
});
