
define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function ctor_call_cb_settings_list_panel() {
    function navigateToSubMenu(evt) {
      let options = {
        'li-voice-call': 'voice',
        'li-video-call': 'video'
      };

      let type = options[evt.target.id] || 'voice';
      SettingsService.navigate('call-cbSettings', {
        type: type
      });
    }

    function _initSoftkey() {
      let params = {
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
        this.voiceCallElement = panel.querySelector('#li-voice-call');
        this.videoCallElement = panel.querySelector('#li-video-call');
      },

      onBeforeShow: function(panel, options) {
        _initSoftkey();
        this.voiceCallElement.addEventListener('click', navigateToSubMenu);
        this.videoCallElement.addEventListener('click', navigateToSubMenu);
      },

      onBeforeHide: function() {
        this.voiceCallElement.removeEventListener('click', navigateToSubMenu);
        this.videoCallElement.removeEventListener('click', navigateToSubMenu);
      }
    });
  };
});
