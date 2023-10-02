
define('panels/input_languages_selection/panel',['require','modules/settings_panel'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');

  return function ctor_selectInputLanguagePanel() {
    var _panel;
    var _keypadHelper;
    let listElements = [];
    let keypadContainer = null;

    function _initUI(layouts) {
      var container = keypadContainer;
      var li, label, input, span, bdiName;
      for (let key in layouts) {
        li = document.createElement('li');
        li.setAttribute('role', 'menuitem');
        label = document.createElement('label');
        label.className = 'pack-checkbox';
        input = document.createElement('input');
        input.name = key;
        input.type = 'checkbox';
        input.checked = layouts[key];
        input.key = 'keypad.layouts';
        span = document.createElement('span');
        bdiName = document.createElement('bdi');
        bdiName.textContent = _keypadHelper.getDisplayLanguageName(key);

        span.appendChild(bdiName);
        label.appendChild(input);
        label.appendChild(span);
        li.appendChild(label);
        listElements.push(li);
        container.appendChild(li);
      }
    }

    function _updateUI(layouts) {
      let container = keypadContainer;
      for (let key in layouts) {
        let rule = 'input[name="' + key + '"]:not([data-ignore])';
        container.querySelector(rule).checked = layouts[key];
      }
    }

    function updateSoftkey() {
      let focusLi = keypadContainer.querySelector('li.focus');
      let input = null;
      let softKey = null;
      if (focusLi) {
        input = focusLi.querySelector('input');
      } else {
        input = keypadContainer.querySelector('li input');
      }
      if (input.checked) {
        softKey = {
          name: 'Deselect',
          l10nId: 'deselect',
          priority: 2,
          method: function() {}
        }
      } else {
        softKey = {
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        }
      }
      let params = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [softKey]
      };
      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    function _checkInputLanguage() {
      var allCheckboxs =
        _panel.querySelectorAll('input[type=checkbox]');
      var i = allCheckboxs.length - 1,
        count = 0,
        enabled;

      // To count user selected checkbox
      for (i; i >= 0; i--) {
        enabled = allCheckboxs[i].checked;
        if (!enabled) {
          count++;
        }
      }

      // If user uncheck all of these languages,
      // Default config language will still be checked automatically.
      if (count === allCheckboxs.length) {
        _keypadHelper.setDefaultLayout();
      }
    }

    return SettingsPanel({
      onInit: function kalp_onInit(panel, options) {
        _panel = panel;
        _keypadHelper = options.KeypadHelper;
        keypadContainer = document.getElementById('keypad-container');
        _initUI(options.Layouts);
      },

      onBeforeShow: function kalp_onBeforeShow(panel, options) {
        _updateUI(options.Layouts);
        updateSoftkey()
        ListFocusHelper.addEventListener(listElements, updateSoftkey);
        _panel.addEventListener('change', updateSoftkey);
      },

      onBeforeHide: function kalp_onBeforeHide() {
        _checkInputLanguage();
        ListFocusHelper.removeEventListener(listElements, updateSoftkey);
        _panel.removeEventListener('change', updateSoftkey);
      }
    });
  };
});
