
define('panels/input_methods/panel',['require','shared/keypad_helper','modules/settings_panel','modules/settings_service'],function(require) {
  
  var KeypadHelper = require('shared/keypad_helper');
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function ctor_keypadPanel() {
    var keypadHelper = new KeypadHelper();
    var _inputLanguagesButton;
    var _currentLayouts;

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

    // To show current enabled input language's name.
    function _updateLanguageState(layouts) {
      var selectedLanguages = [];
      var number = 0;

      for (let key in layouts) {
        if (layouts[key]) {
          selectedLanguages.push(keypadHelper.getDisplayLanguageName(key));
          number++;
        }
      }
      _currentLayouts = layouts;

      var selectedLanguagesSmall =
        document.getElementById('input-languages-desc');
      selectedLanguagesSmall.textContent = '';
      if (number <= 3) {
        selectedLanguagesSmall.textContent = selectedLanguages.join(', ');
      } else {
        navigator.mozL10n.setAttributes(selectedLanguagesSmall,
          'lanauages-selected', {
          n: number
        });
      }
    }

    return SettingsPanel({
      onInit: function kp_onInit(panel) {
        _inputLanguagesButton = panel.querySelector('li a');
        keypadHelper.start();
        keypadHelper.getLayouts().then(layouts => {
          _updateLanguageState(layouts);
          _currentLayouts = layouts;

          _inputLanguagesButton.onclick = evt => {
            SettingsService.navigate('input-languages-selection', {
              KeypadHelper: keypadHelper,
              Layouts: _currentLayouts
            });
          };
        });
      },

      onBeforeShow: function kp_onBeforeShow() {
        keypadHelper.setLayoutsChangedCallback(_updateLanguageState);
        _initSoftkey();
      }
    });
  };
});
