/**
 * The Bluetooth panel
 *
 */
define(['require','modules/bluetooth/bluetooth_context','modules/bluetooth/bluetooth_connection_manager','panels/bluetooth/bt_template_factory','modules/mvvm/list_view','modules/settings_panel','modules/settings_service'],function(require) {
  

  var BtContext = require('modules/bluetooth/bluetooth_context');
  var BtConnectionManager =
    require('modules/bluetooth/bluetooth_connection_manager');
  var BtTemplateFactory = require('panels/bluetooth/bt_template_factory');
  var ListView = require('modules/mvvm/list_view');
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  var _debug = false;
  var debug = function() {};
  if (_debug) {
    debug = function btp_debug(msg) {
      console.log('--> [Bluetooth][Panel]: ' + msg);
    };
  }

  return function ctor_bluetooth() {
    var elements;
    var softkeyParams;
    var MAX_DEVICE_NAME_LENGTH = 20;

    return SettingsPanel({
      onInit: function(panel) {
        debug('onInit():');

        elements = {
          panel: panel,
          updateNameInput: panel.querySelector('#update-device-name-input')
        };
        softkeyParams = {
          items: [
            {
              name: 'Cancel',
              l10nId: 'cancel',
              priority: 1,
              method: function() {
                Settings.isBackHref = true;
                SettingsService.navigate('bluetooth');
              }
            },
            {
              name: 'Save',
              l10nId: 'save',
              priority: 3,
              method: this._saveAndBack
            }
          ]
        };

        elements.updateNameInput.oninput = function(e) {
          var inputString = e.target.value;
          var params;
          if (inputString.length > 0) {
            params = softkeyParams;
          } else {
            params = {
              items: [
                {
                  name: 'Cancel',
                  l10nId: 'cancel',
                  priority: 1,
                  method: function() {
                    Settings.isBackHref = true;
                    SettingsService.navigate('bluetooth');
                  }
                }
              ]
            };
          }
          SettingsSoftkey.init(params);
          SettingsSoftkey.show();
        };
      },

      onBeforeShow: function() {
        debug('onBeforeShow():');
        this._prepareInputField();
      },

      onShow: function() {
        debug('onShow():');
        SettingsSoftkey.init(softkeyParams);
        SettingsSoftkey.show();
        elements.updateNameInput.focus();
        window.addEventListener('keydown',this._handleCSK);

      },

      onBeforeHide: function() {
        debug('onBeforeHide():');
        window.removeEventListener('keydown',this._handleCSK);
      },

      onHide: function() {
        debug('onHide():');
      },

      _prepareInputField: function() {
        elements.updateNameInput.value = BtContext.name;
        // Focus the input field to trigger showing the keyboard
        var cursorPos = elements.updateNameInput.value.length;
        elements.updateNameInput.setSelectionRange(cursorPos, cursorPos);
      },

      _saveAndBack: function() {
        var nameEntered = elements.updateNameInput.value;
         nameEntered = nameEntered.replace(/^\s+|\s+$/g, '');

         if (nameEntered.length > MAX_DEVICE_NAME_LENGTH) {
          var dialogConfig = {
            title: {id: 'change-device-name', args: {}},
            body: {id: 'bluetooth-name-maxlength-alert', args: { length: MAX_DEVICE_NAME_LENGTH }},
            accept: {
              l10nId:'ok',
              priority:2,
              callback: function(){
                dialog.destroy();
              }
            }
          };
          var dialog = new ConfirmDialogHelper(dialogConfig);
          dialog.show(document.getElementById('app-confirmation-dialog'));
          return;
         }
        if (nameEntered !== '') {
          BtContext.setName(nameEntered).then(() => {
            showToast('changessaved');
            Settings.isBackHref = true;
            SettingsService.navigate('bluetooth');
            debug('_onRenameSubmit(): setName = ' +
                  nameEntered + ' successfully');
          }, (reason) => {
            Settings.isBackHref = true;
            SettingsService.navigate('bluetooth');
            debug('_onRenameSubmit(): setName = ' +
                  nameEntered + ' failed, reason = ' + reason);
          });
        } else {
          debug('_onRenameSubmit(): set name by product model');
          BtContext.setNameByProductModel();
        }
      },

      _handleCSK: function(e) {
        if(e.key==='Accept'||e.key==='Enter'){
         elements.panel.querySelector('.focus input').focus();
       }
      }

    });
  };

});
