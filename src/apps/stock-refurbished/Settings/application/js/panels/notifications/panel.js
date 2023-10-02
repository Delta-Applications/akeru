define(['require','modules/settings_panel'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  const LOCK_SCREEN_NOTIFICATION = 'lockscreen.notifications-preview.enabled';

  return function() {
    let _showOnLockScreenSelect = null;
    let _showOnLockScreenContent = null;

    function _showChangeDialog(evt) {
      var value = _showOnLockScreenSelect.value;
      var l10nId = (value === 'true') ? 'on' : 'off';
      var bodyId = 'lockscreen-notifications-' + l10nId + '-msg';
      _showDialog(bodyId);
    }

    function _showDialog(bodyId) {
      var dialogConfig = {
        title: {id: 'confirmation', args: {}},
        body: {id: bodyId, args: {}},
        accept: {
          name: 'Ok',
          l10nId: 'ok',
          priority: 2,
          callback: function() {
            dialog.destroy();
          }
        }
      };
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

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
        }]
      };
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    return SettingsPanel({
      onInit: function(panel) {
        _showOnLockScreenSelect =
          panel.querySelector('#backscreen-notifications select');
        _showOnLockScreenContent =
          panel.querySelector('#backscreen-content-notifications-item');
        window.navigator.mozSettings.addObserver(LOCK_SCREEN_NOTIFICATION, () => {
          _showChangeDialog();
        });
      },

      onBeforeShow: function() {
        _initSoftKey();
        SettingsListener.observe('lockscreen.notifications-preview.enabled',
          true, (value) => {
          _showOnLockScreenContent.hidden = !value;
          NavigationMap.refresh();
        });
      },

      onBeforeHide: function() {
      }
    });
  };
});
