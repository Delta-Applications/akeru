/**
 * The panel.js file is used to implement WEA RingTone page.
 */
define(['require','modules/settings_panel','panels/ringtone_preview/notify'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var Notify = require('panels/ringtone_preview/notify');

  return function createWeaRingPanel () {
    const ringTimer = 10500;
    let timer = null;
    let weaPlayIcon = document.getElementById('play-icon');
    let softkeyParams = {
      menuClassName: 'menu-button',
      header: {
        l10nId: 'message'
      },
      items: [{
        name: 'Play',
        l10nId: 'ring-play',
        priority: 2,
        method: function() {
          _setRing()
        }
      }]
    };
    let params = {
      menuClassName: 'menu-button',
      header: {
        l10nId: 'message'
      },
      items: [{
        name: 'stop',
        l10nId: 'ring-stop',
        priority: 2,
        method: function() {
          _setRing()
        }
      }]
    };

    function _updateSoftkey(param) {
      SettingsSoftkey.init(param);
      SettingsSoftkey.show();
    }

    function _setRing() {
      const status = weaPlayIcon.getAttribute('data-icon');
      if (status !== 'sound-max') {
        weaPlayIcon.setAttribute('data-icon', 'sound-max');
        Notify.play();
        _updateSoftkey(params);
        timer = setTimeout(() => {
          weaPlayIcon.setAttribute('data-icon', '');
          _updateSoftkey(softkeyParams);
        }, ringTimer);
      } else {
        weaPlayIcon.setAttribute('data-icon', '');
        Notify.stop();
        _updateSoftkey(softkeyParams);
        clearTimeout(timer);
      }
    }

    return SettingsPanel({
      onBeforeShow: function() {
        _updateSoftkey(softkeyParams);
      },

      onBeforeHide: function() {
        if (weaPlayIcon.getAttribute('data-icon') === 'sound-max') {
          weaPlayIcon.setAttribute('data-icon', '');
          Notify.stop();
          clearTimeout(timer);
        }
      }
    });
  };
});
