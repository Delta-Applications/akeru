
/* global openIncompatibleSettingsDialog */
/**
 * Used to show Storage/App Storage panel
 */
define(['require','modules/settings_panel','shared/settings_listener','modules/settings_service'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');
  var SettingsService = require('modules/settings_service');
  return function ctor_app_storage_panel() {
    var _panel = null;
    var _umsSettingKey = 'ums.enabled';
    var oldValue = null ;

    var _umsSettingHandler = function(enabled){
      _panel.querySelector("input[name='ums.enabled'][value='"+enabled+"']").checked = true;
      if(oldValue == null){
        oldValue = enabled ;
      }else if(oldValue != enabled){
        var cset = {};
        if (enabled) {
         SettingsDBCache.getSettings(
                   _openIncompatibleSettingsDialogIfNeeded);
        }else{
          Settings.currentPanel = "#root";
        }
      }
    }
    var _openIncompatibleSettingsDialogIfNeeded =
      function storage_openIncompatibleSettingsDialogIfNeeded(settings) {
        var cset = {};
        var usbTetheringSetting = settings['tethering.usb.enabled'];

        if (usbTetheringSetting){
          var oldSetting = 'tethering.usb.enabled';
          showIncompatibleSettingsDialog(_umsSettingKey, oldSetting, null);
        }else{
          Settings.currentPanel = "#root";
        }
    }
    function showIncompatibleSettingsDialog(newSetting,
      oldSetting, callback) {
      var headerL10n = 'is-warning-storage-header';
      var messageL10n ='is-warning-storage-tethering-message'

      // User has requested enable the feature so the old feature
      // must be disabled
      function onEnable() {
        var lock = Settings.mozSettings.createLock();
        var cset = {};

        cset[newSetting] = true;
        cset[oldSetting] = false;
        lock.set(cset);
        Settings.currentPanel = "#root";
        dialog.destroy();

        if (callback) {
         callback();
        }
      }

      function onCancel() {
        var lock = Settings.mozSettings.createLock();
        var cset = {};

        cset[newSetting] = false;
        cset[oldSetting] = true;
        lock.set(cset);
        dialog.destroy();
      }
      var dialogConfig = {
        title: {id: headerL10n, args: {}},
        body: {id: messageL10n, args: {}},
        cancel: {
          l10nId:'cancel',
          priority:1,
          callback: function(){onCancel();}
        },
        confirm: {
         l10nId:'enable',
          priority:3,
          callback: function(){onEnable();}
        },
      };
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    return SettingsPanel({
      onInit: function (panel) {
        _panel = panel;
        this.softKeyParams = {
          menuClassName: 'menu-button',
          header: {l10nId: 'message'},
          items: [
            {
              name: 'Cancel',
              l10nId: 'cancel',
              priority: 1,
              method: function () {
                SettingsService.back();
              }
            },
            {
              name: 'Select',
              l10nId: 'select',
              priority: 2,
              method: function () {
                var enabled =
                  panel.querySelector('.focus input').value == "true";
                if (oldValue == enabled) {
                  SettingsService.navigate('root');
                } else {
                  panel.querySelector('.focus input').click();
                }
              }
            }]
        };
      },
      onShow: function (panel, options) {
        SettingsSoftkey.show();
        if (!options.isVisibilityChange) {
          SettingsDBCache.getSettings((result) => {
            let umsEnabled = result[_umsSettingKey];
            let liItem = _panel.querySelectorAll('li');
            if (umsEnabled) {
              requestFocus(_panel, liItem[0]);
            } else {
              requestFocus(_panel, liItem[1]);
            }
          });
        }
      },
      onBeforeShow: function () {
        oldValue = null;
        SettingsSoftkey.init(this.softKeyParams);
        SettingsListener.observe(_umsSettingKey, false, _umsSettingHandler);
      },
      onBeforeHide: function () {
        SettingsListener.unobserve(_umsSettingKey, _umsSettingHandler);
      }
    });
  };
});
