
define(['require','modules/settings_panel'],function(require) {
  
  let SettingsPanel = require('modules/settings_panel');

  return function ctor_cell_broadcast_message_panel() {
    const rilCbDisabled = 'ril.cellbroadcast.disabled';
    let elements = {};
    let serviceId = 0;
    let listElements = null;

    function initSoftKey() {
      let softkeyParams = {
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
    }

    function updateChannelsPanel(disable) {
      let hrefItem = elements.cellBroadcastConfig.querySelector('a');
      if (disable) {
        hrefItem.removeAttribute('href');
        elements.cellBroadcastConfig.setAttribute('aria-disabled', true);
        elements.cellBroadcastConfig.classList.add('none-select');
      } else {
        hrefItem.setAttribute('href', hrefItem.dataset.hash);
        elements.cellBroadcastConfig.removeAttribute('aria-disabled');
        elements.cellBroadcastConfig.classList.remove('none-select');
      }

      SettingsDBCache.getSettings((result) => {
        let cbResult = result[rilCbDisabled];
        cbResult[serviceId] = disable;
        navigator.mozSettings.createLock().set({
          'ril.cellbroadcast.disabled': cbResult
        });
      });
    }

    function updateCbSwitch() {
      SettingsDBCache.getSettings((result) => {
        let cbResult = result[rilCbDisabled];
        let value = cbResult[serviceId] ? 'false' : 'true';
        updateChannelsPanel(cbResult[serviceId]);
        elements.cellBroadcastSwitch.value = value;
        elements.cellBroadcastSwitch.hidden = false;
      });
    }

    return SettingsPanel({
      onInit: function(panel) {
        listElements = document.querySelectorAll('li');
        elements = {
          cellBroadcastSwitch:
            panel.querySelector('#cellBroadcast-mode-select'),
          cellBroadcastConfig:
            panel.querySelector('#cell-broadcast-config')    
        };
        elements.cellBroadcastSwitch.addEventListener('change', (evt) => {
          let disable = evt.target.value === 'true' ? false : true;
          updateChannelsPanel(disable);
          showToast('changessaved');
        });
      },

      onBeforeShow: function(panel, options) {
        initSoftKey();
        ListFocusHelper.addEventListener(listElements);
        serviceId = DsdsSettings.getIccCardIndexForCallSettings();
        updateCbSwitch();
      },

      onBeforeHide: function() {
        ListFocusHelper.removeEventListener(listElements);
      }
    });
  };
});
