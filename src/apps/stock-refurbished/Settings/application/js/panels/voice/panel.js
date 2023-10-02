/**
 * Show Personalization/Voice panel
 */
define(['require','modules/settings_panel'],function(require) {
  

  var settingsPanel = require('modules/settings_panel');

  return function createVoicePanel() {
    let elements = null;
    let listElements = null;

    function _initSoftkey() {
      var params = {
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

      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    return settingsPanel({
      onInit: function (panel) {
        elements = {
          manageProfiles : panel.querySelector('#manage-profiles')
        };

        listElements = panel.querySelectorAll('li');
        elements.manageProfiles.onclick = (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          let target = evt.target;
          if (target.id !== 'manage-profiles' ||
            target.hasAttribute('aria-disabled')) {
            return;
          }
          window.DUMP('call Manage Profile');
          new MozActivity({name: 'aov_manage_profile'});
        };
        navigator.mozSettings.addObserver('settings.aov.enabled', (event) => {
          let aovEnabled = event.settingValue;
          if (aovEnabled) {
            elements.manageProfiles.classList.remove('none-select');
            elements.manageProfiles.removeAttribute('aria-disabled');
          } else {
            elements.manageProfiles.classList.add('none-select');
            elements.manageProfiles.setAttribute('aria-disabled', true);
          }
        });
      },
      onBeforeShow: function() {
        _initSoftkey();
        SettingsDBCache.getSettings((results) => {
          let aovEnabled = results['settings.aov.enabled'];
          if (aovEnabled) {
            elements.manageProfiles.classList.remove('none-select');
            elements.manageProfiles.removeAttribute('aria-disabled');
          } else {
            elements.manageProfiles.classList.add('none-select');
            elements.manageProfiles.setAttribute('aria-disabled', true);
          }
        });
        ListFocusHelper.addEventListener(listElements);
      },
      onBeforeHide: function() {
        ListFocusHelper.removeEventListener(listElements);
      }
    });
  };
});
