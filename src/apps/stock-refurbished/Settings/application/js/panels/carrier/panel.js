define(['require','modules/settings_panel','carrier'],function(require) {
  

  let SettingsPanel = require('modules/settings_panel');
  let CarrierSettings = require('carrier');

  return function ctor_carrier() {
    let listElements = document.querySelectorAll('#carrier li');
    let dataConnection = null;
    let dataRoaming = null;
    let dateRoamingPreference = null;
    let dataConnectionSelect = null;

    function handleDataConnection(enabled) {
      showToast('changessaved');
    }

    return SettingsPanel({
      onInit: function(panel) {
        this.params = {
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
        dataConnection = panel.querySelector('#liItem-dataConnection');
        dataRoaming = panel.querySelector('#liItem-dataRoaming');
        dateRoamingPreference =
          panel.querySelector('#operator-roaming-preference');
        dataConnectionSelect = document.querySelector(
          'select.dataConnection-select');

        let carrierSettings = CarrierSettings();
        carrierSettings.init();
      },

      onBeforeShow: function (panel) {
        SettingsSoftkey.init(this.params);
        ListFocusHelper.updateSoftkey(panel);
        ListFocusHelper.addEventListener(listElements);
        initUIForItem(['dataConnection', 'dataRoaming']);
        addListenerForCustomization(['data.settings.ui', 'dm.data.settings.ui',
          'data.roaming.settings.ui', 'airplaneMode.status']);
        dataConnectionSelect.addEventListener('change',
          handleDataConnection);
      },

      onBeforeHide: function(){
        removeListenerForCustomization(['data.settings.ui', 'dm.data.settings.ui',
          'data.roaming.settings.ui', 'airplaneMode.status']);
        ListFocusHelper.removeEventListener(listElements);
        dataConnectionSelect.removeEventListener('change',
          handleDataConnection);
      }
    });
  };
});
