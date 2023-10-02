/**
 * Used to show Personalization/Sound/other-sounds panel
 */
define(['require','modules/settings_panel','shared/settings_listener'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');

  return function createOtherSoundsPanel () {
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
        this.otherSoundsElements = {
          dialpad: document.getElementById('dial-pad'),
          camera: document.getElementById('camera'),
          /* Task 5106798/5106207 20170915 lina.zhang@t2mobile.com -begin */
          cameraSound: document.getElementById('camera-li'),
          /* Task 5106798/5106207 20170915 lina.zhang@t2mobile.com -end */
          sentMessage: document.getElementById('sent-message')
        };

        SettingsListener.observe('phone.ring.keypad', true, value => {
          this.otherSoundsElements.dialpad.value = value;
        });

        SettingsListener.observe('camera.sound.enabled', true, value => {
          this.otherSoundsElements.camera.value = value;
        });

        SettingsListener.observe('message.sent-sound.enabled', true, value => {
          this.otherSoundsElements.sentMessage.value = value;
        });
      },

      onBeforeShow: function() {
        _initSoftkey();
        /* Task 5106798/5106207 20170918 lina.zhang@t2mobile.com -begin */
        var _this = this;
        navigator.customization.getValue(
          'stz.camera.sound.alwayson').then((result) => {
        if (result) { // false: disable,default; true: enable,alwayson
            _this.otherSoundsElements.cameraSound.classList.add('hidden');
            navigator.mozSettings.createLock().set({
              'camera.sound.enabled': true
            });
          }
        });
        /* Task 5106798/5106207 20170918 lina.zhang@t2mobile.com -end */
      },

      onBeforeHide: function () {
      }
    });
  };
});
