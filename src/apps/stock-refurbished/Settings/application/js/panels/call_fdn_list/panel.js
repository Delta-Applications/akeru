define(['require','dsds_settings','modules/settings_panel','modules/fdn_context','modules/settings_service','modules/fdn_dialog'],function(require) {
  

  var DsdsSettings = require('dsds_settings');
  var SettingsPanel = require('modules/settings_panel');
  var FdnContext = require('modules/fdn_context');
  var SettingsService = require('modules/settings_service');
  var FdnDialog = require('modules/fdn_dialog');

  return function ctor_settings_panel() {
    return SettingsPanel({
      _currentContact: null,
      contactArray: [],

      onInit: function(panel,options) {
        this._elements = {};
        this._elements.contactsContainer =
          panel.querySelector('#fdn-contactsContainer');
        this.gaiaHeader = document.querySelector('#simpin2-dialog gaia-header');
        this._removeEnable = false;
      },

      _initSoftkey: function() {
        var self = this;
        var params = {
          menuClassName: 'menu-button',
          header: { l10nId:'message' },
          items: [{
            name: 'Add',
            l10nId: 'add',
            priority: 1,
            method: function() {
              self.setCurrentContact();
              SettingsService.navigate('call-fdnList-add', {
                mode: 'add',
                contact: self._currentContact
              });
            }
          }]
        };
        if (this._removeEnable) {
          params.items.push({
            name: 'Remove',
            l10nId: 'fdnRemove',
            priority: 3,
            method: function() {
              self._updateContact('remove', {
                name: '',
                number: ''
              });
            }
          });
        }
        SettingsSoftkey.init(params);
        SettingsSoftkey.show();
      },

      onBeforeShow: function() {
        this.gaiaHeader.dataset.href = '#call-fdnList';
        this._renderAuthorizedNumbers();
      },

      setCurrentContact: function() {
        var li = document.querySelector('#call-fdnList li.focus');
        if (li) {
          var id = document.activeElement.id;
          this._currentContact = this.contactArray[id];
        }
      },

      /**
       * we will render all registered FDN numbers on screen.
       *
       * @type {Function}
       * @return {Promise}
      */
      _renderAuthorizedNumbers: function() {
        this._elements.contactsContainer.innerHTML = '';
        this.contactArray = [];
        var cardIndex = DsdsSettings.getIccCardIndexForCallSettings();
        return FdnContext.getContacts(cardIndex).then((contacts) => {
          for (var i = 0, l = contacts.length; i < l; i++) {
            var li = this._renderFdnContact(i,contacts[i]);
            this._elements.contactsContainer.appendChild(li);
            this.contactArray[i] = contacts[i];
          }
          if (contacts.length) {
            this._removeEnable = true;
          } else {
            this._removeEnable = false;
          }
          this._initSoftkey();
          window.dispatchEvent(new CustomEvent('refresh'));
        }, function() {
          var dialogConfig = {
            title: { id: 'fdn-authorizedNumbers-header', args: {} },
            body: { id: 'fdn-authorizedNumbers-open-error', args: {} },
            accept: {
              name: 'Ok',
              l10nId: 'ok',
              priority: 1,
              callback: function() {
                SettingsService.navigate('call-fdnSettings');
              }
            }
          };
          var dialog = new ConfirmDialogHelper(dialogConfig);
          dialog.show(document.getElementById('app-confirmation-dialog'));
        });
      },

      /**
       * render needed UI for each contact item.
       *
       * @type {Function}
       * @param {Object} contact
      */
      _renderFdnContact: function(id, contact) {
        var li = document.createElement('li');
        var nameContainer = document.createElement('span');
        var numberContainer = document.createElement('small');

        li.id = id;
        nameContainer.dir = 'auto';
        nameContainer.textContent = contact.name;
        numberContainer.dir = 'auto';
        numberContainer.textContent = contact.number;
        li.appendChild(numberContainer);
        li.appendChild(nameContainer);

        return li;
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
                cardIndex: cardIndex
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
      _updateContact: function(action, options) {
        // `action' is either `add', `edit' or `remove': these three actions all
        // rely on the same mozIccManager.updateContact() method.
        var self = this;
        options = options || {};
        var cardIndex = DsdsSettings.getIccCardIndexForCallSettings();
        var name = options.name;
        var number = options.number;

        this.setCurrentContact();
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

      onBeforeHide: function() {
      }
    });
  };
});
