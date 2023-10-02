define(['require','modules/settings_panel'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  return function ctor_manage_tones_panel() {
    function handleKeyDown(e) {
      switch (e.key) {
        case 'Enter':
          var focusedElement = document.querySelector('#manageTones .focus');
          if (focusedElement.id === 'system-ringtones' ||
            focusedElement.id === 'system-alerts' ||
            focusedElement.id === 'my-ringtones') {
            var toneType = focusedElement.children[0].getAttribute('data-type');
            var activity = new MozActivity({
              name: 'configure',
              data: {
                target: 'ringtone',
                toneType: toneType
              }
            });
          }
          break;
      }
    }

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

    return SettingsPanel({
      onInit: function(panel) {
        DeviceFeature.ready(() => {
          if (DeviceFeature.getValue('lowMemory') === 'true') {
            let el = document.getElementById('my-ringtones');
            el && el.classList.add('hidden');
            // el && el.parentNode.removeChild(el);
          }
        });
      },
      onBeforeShow: function mt_onBeforeShow() {
        _initSoftkey();
        window.addEventListener('keydown', handleKeyDown);
      },
      onBeforeHide: function mt_onBeforeHide() {
        window.removeEventListener('keydown', handleKeyDown);
      }
    });
  };
});
