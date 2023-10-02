/* global SettingsSoftkey */
define(['require','modules/settings_panel','media_storage'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var MediaStorage = require('media_storage');

  return function ctor_storage_panel() {

    return SettingsPanel({
      onInit: function(panel, option) {
        this.once = false;
        MediaStorage.storageType = option.type;
        this.boundFocusHandle = function() {
          panel.querySelector('#volume-list').scrollTop = 0;
        }.bind(this);

        var that = this;
        this.panelReady = () => {
          var el = panel.querySelector('#stacked-bar');
          el.onfocus = this.boundFocusHandle;
        };
      },

      onBeforeShow: function(panel, option) {
        this.storageType = option.type;
        if (!this.once) {
          navigator.mozL10n.once(MediaStorage.init.bind(MediaStorage));
          window.addEventListener('panelready', this.panelReady);
          this.once = true;
        } else {
          if (navigator.getDeviceStorages('sdcard').length > 1) {
            if (option.type === 'sdcard') {
              document.getElementById('sdcard').hidden = false;
              document.getElementById('sdcard1').hidden = true;
            } else {
              document.getElementById('sdcard').hidden = true;
              document.getElementById('sdcard1').hidden = false;
            }
            window.dispatchEvent(new CustomEvent('refresh'));
          }
        }
      }
    });
  };
});
