/**
 * Used to show Calling/Answer-Options panel
 */
define(['require','modules/settings_panel','shared/settings_listener'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');

  return function createAnswerModePanel() {
    function _showToast() {
      showToast('changessaved');
    }

    return SettingsPanel({
      onInit: function(panel) {
        this.flipopenSelect = document.getElementById('answer-flipopen');
        SettingsListener.observe('phone.answer.flipopen.enabled', true,
          value => {
            this.flipopenSelect.value = value;
          }
        );
      },

      onBeforeShow: function() {
        this.flipopenSelect.addEventListener('change', _showToast);
      },

      onBeforeHide: function() {
        this.flipopenSelect.removeEventListener('change', _showToast);
      }
    });
  };
});
