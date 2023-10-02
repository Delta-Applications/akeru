/* global DsdsSettings */
/**
 * The apn settings panel
 */
define(['require','modules/settings_panel','modules/settings_service','modules/apn/apn_settings_manager'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var ApnSettingsManager = require('modules/apn/apn_settings_manager');

  return function ctor_apn_settings_panel() {
    var _serviceId = 0;
    var _apnSettingsList;

    function _initSoftKey() {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        }, {
          name: 'Reset to Default',
          l10nId: 'reset-apn',
          priority: 3,
          method: function() {
            _resetApn();
          }
        }]
      };

      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    function _resetApnWarningDialog() {
      return new Promise(resolve => {
        var dialogConfig = {
          title: {id: 'apnSettings-reset', args: {}},
          body: {id: 'reset-apn-warning-message', args: {}},
          cancel: {
            name: 'Cancel',
            l10nId: 'cancel',
            priority: 1,
            callback: function() {
              resolve(false);
              dialog.destroy();
            }
          },
          confirm: {
            name: 'Rest',
            l10nId: 'reset-apn',
            priority: 3,
            callback: function() {
              resolve(true);
              dialog.destroy();
            }
          }
        };

        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      });
    }

    function _resetApn() {
      _resetApnWarningDialog().then(result => {
        if (result) {
          ApnSettingsManager.restore(_serviceId).then(() => {
            showToast('apnSettings-reset-toast');
          });
        }
      });
    }

    function _browseApnItems(evt) {
      if (!evt.target.dataset.apnType) {
        return;
      }
      SettingsService.navigate(
        'apn-list', {
          type: evt.target.dataset.apnType,
          serviceId: _serviceId
        }
      );
    }

    function _addClickEventListener() {
      var i = _apnSettingsList.length - 1;
      for (i; i >= 0; i--) {
        _apnSettingsList[i].addEventListener('click', _browseApnItems);
      }
    }

    function _removeClickEventListener() {
      var i = _apnSettingsList.length - 1;
      for (i; i >= 0; i--) {
        _apnSettingsList[i].removeEventListener('click', _browseApnItems);
      }
    }

    /**
     * XXX: Hide the Message/A-GPS/Tethering APN settings item for India carrier
     */
    function _initUI(panel) {
      let conn = navigator.mozMobileConnections[_serviceId];
      let promises = [];
      promises.push(conn.getSupportedNetworkTypes());
      //BDC zhangwp 20190909 modify for IMS APN visable. begin
/*
      Promise.all(promises).then((values) => {
        let supportedNetworkTypes = values[0];
        let item = panel.querySelector('li#ims.apn-optional');
        if (item) {
          if (supportedNetworkTypes.indexOf('lte') < 0) {
            item.hidden = true;
          } else {
            item.hidden = false;
          }
        }
      });
*/

      let matchInfo = {
        "clientId": "0",
      };
      matchInfo.clientId = _serviceId;
      promises.push(navigator.customization.getValueForCarrier(matchInfo, 'hide.ims.apn.bool'));

      Promise.all(promises).then((values) => {
        let supportedNetworkTypes = values[0];
        let hideIMS = JSON.stringify(values[1]) === 'true' ? true : false;
        console.log('apn_settings initUI hideIMS: ' + hideIMS + ' _serviceId: ' + _serviceId);

        let item = panel.querySelector('li#ims.apn-optional');
        if (item) {
          if (supportedNetworkTypes.indexOf('lte') < 0) {
            item.hidden = true;
          } else {
            if(hideIMS) {
              item.hidden = true;
            } else {
              item.hidden = false;
            }
          }
        }
      });
      //BDC zhangwp 20190909 modify for IMS APN visable. end
    }

    return SettingsPanel({
      onInit: function asp_onInit(rootElement) {
        _apnSettingsList = rootElement.querySelectorAll('a[data-apn-type]');
      },

      onBeforeShow: function asp_onBeforeShow(panel) {
        _initSoftKey();
        _serviceId = DsdsSettings.getIccCardIndexForCellAndDataSettings();
        _initUI(panel);
      },

      onBeforeHide: function() {
        SettingsSoftkey.hide();
      },

      onShow: function() {
        _addClickEventListener();
      },

      onHide: function() {
        _removeClickEventListener();
      }
    });
  };
});
