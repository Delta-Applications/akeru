/*global SettingsURL */

(function(exports) {
  'use strict';

  let SETTINGS = {
    notificationVolume: 'audio.volume.notification',
    vibration: 'vibration.enabled',
    ringtone: 'notification.ringtone'
  };

  function entry(key, value) {
    if (urls[key]) {
      return new SettingsURL().set(value);
    }
    return value;
  }

  // one day we'll be able to use ES6 initializers instead
  let urls = {};
  urls[SETTINGS.ringtone] = 1;

  function getSetting(key) {
    return new Promise(function(resolve) {
      Utils.getSettingsValue(key).then((value) => {
        resolve(entry(key, value));
      });
    });
  }

  function getSettings(settings) {
    return Promise.all(
      settings.map(getSetting)
    ).catch((e) => {
      // catch and log errors
      console.error('Error while retrieving settings', e.message, e);
      return settings.map(() => null);
    }).then((results) => {
      return settings.reduce((result, setting, i) => {
        result[setting] = results[i];
        return result;
      }, {});
    });
  }

  function ringtone(ringtoneFile) {
    let ringtonePlayer = new Audio();
    ringtonePlayer.src = ringtoneFile;
    ringtonePlayer.mozAudioChannelType = 'notification';
    ringtonePlayer.play();
    window.setTimeout(function smsRingtoneEnder() {
      ringtonePlayer.pause();
      ringtonePlayer.removeAttribute('src');
      ringtonePlayer.load();
    }, 2000);
  }

  function vibrate() {
    // vibration only works when App is in the foreground
    if (document.hidden) {
      window.addEventListener('visibilitychange', function waitOn() {
        window.removeEventListener('visibilitychange', waitOn);
        navigator.vibrate([200, 200, 200, 200]);
      });
    } else {
      navigator.vibrate([200, 200, 200, 200]);
    }
  }

  exports.Notify = {
    ringtone: function notification_ringtone() {
      let ringtoneFile = 'app://sms.gaiamobile.org' + ActivityHandler.notifyAudio;
      /* << [LIO-707]: BDC kanxj 20200731 add for AMX sms alert tone */
      var skuID = navigator.engmodeExtension.getPropertyValue('ro.boot.skuid');
      console.log('sms Notify ringtones>>> ro.boot.skuid >>>'+ skuID);
      if(skuID == "62GMX") {
        //claro ringtone
        ringtoneFile = 'app://sms.gaiamobile.org' + ActivityHandler.amxNotifyAudio;
      }
      /* >> [LIO-707] */
      ringtone(ringtoneFile);
    },

    vibrate: function notification_vibrate() {
      return getSettings([SETTINGS.vibration]).then((settings) => {
        if (settings[SETTINGS.vibration]) {
          vibrate();
        }
      });
    }
  };
}(this));
