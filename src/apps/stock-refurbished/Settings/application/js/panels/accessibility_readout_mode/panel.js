define(['require','modules/settings_panel','shared/settings_listener'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');

  return function () {
    var _panel = null;
    var _speechRateSelector;
    var elements = {};

    function initSoftKey() {
      var params = {
        menuClassName: 'menu-button',
        header: { l10nId:'message' },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2,
        }]
      };

      SettingsSoftkey.init(params);
    }

    function initScreenReaderUI(enabled){
      NavigationMap.refresh();
    }

    function saveSpeechRate(value) {
      var lock = navigator.mozSettings.createLock();
      var settings = {};
      settings['accessibility.screenreader-rate'] = parseFloat(value);
      var req = lock.set(settings);

      req.onsuccess = function() {
        showToast('changessaved');
      };

      req.onerror = function() {
        console.log("An error occure, the setting remain unchanged");
      };
    }

    return SettingsPanel({
      onInit: function accessibilityPanel_onInit(rootElement) {
        _speechRateSelector = document.getElementById('speech-rate-select');
        SettingsListener.observe('accessibility.screenreader-rate', '0',
          function(value) {
            _speechRateSelector.value = value;
        });
        _speechRateSelector.addEventListener('change', (event) => {
            saveSpeechRate(_speechRateSelector.value);
        });
        elements = {
          items: document.querySelectorAll('#accessibility-readout-mode li')
        };
      },

      onBeforeShow: function (panel) {
        if(null === _panel){
          _panel = panel;
          SettingsListener.observe("accessibility.screenreader", "", initScreenReaderUI);
        }

        initSoftKey();
        ListFocusHelper.updateSoftkey(panel);
        ListFocusHelper.addEventListener(elements.items);
      },

      onBeforeHide: function () {
        ListFocusHelper.removeEventListener(elements.items);
      }
    });
  };
});
