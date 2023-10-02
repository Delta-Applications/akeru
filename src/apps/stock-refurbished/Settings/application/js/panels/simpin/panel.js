/* global SettingsSoftkey */

define(['require','modules/settings_panel','panels/simpin/simpin'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SimPin = require('panels/simpin/simpin');

  return function ctor_simpin_panel() {
    var simpin = null;
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
    }

    return SettingsPanel({
      onInit: function(panel) {
        var elements = {};
        // We will fix this when SettingsDialog is ready
        elements.dialog = document.getElementById('simpin-dialog');
        elements.simPinTmpl = panel.querySelector('.simpin-tmpl');
        elements.simPinContainer = panel.querySelector('.simpin-container');
        elements.simPinHeader = panel.querySelector('.simpin-header');

        simpin = SimPin(elements);
        simpin.init(panel);
      },

      onBeforeShow: function(panel) {
        listElements = panel.querySelectorAll('li');
        simpin.addAirplaneModeChangeEvent();
        ListFocusHelper.addEventListener(listElements);
        _initSoftkey();
        ListFocusHelper.updateSoftkey(panel);
      },

      onBeforeHide: function () {
        simpin.removeAirplaneModeChangeEvent();
        ListFocusHelper.removeEventListener(listElements);
      }
     });
  };
});
