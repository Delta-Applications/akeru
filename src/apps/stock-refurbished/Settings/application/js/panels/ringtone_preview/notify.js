/* global
  AudioContext
 */


define((require, exports, module) => {
  const SETTINGS = {
    notificationVolume: 'audio.volume.notification',
    vibration: 'vibration.enabled'
  };

  const ATTENTION_PATTERN = [4, 1, 2, 1, 2, 1, 4, 1, 2, 1, 2];

  const ATTENTION_SOUND_VOLUME = 0.3;
  let audioChannel = 'notification';
  let audioCtx = new AudioContext(audioChannel);
  let gainNode = null;

  function getSetting(key) {
    return new Promise((resolve) => {
      navigator.mozSettings.createLock().get(key).then((result) => {
      resolve(result[key]);
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

  // Converts from the ATTENTION_PATTERN (suitable for the Vibration API) to a
  // Float32Array suitable for the Audio API.
  //
  // The Float32Array will be interpolated so we just need to have the changes.
  // Each value will last a "unit" of time.
  function getAttentionCurveWave() {
    let result = [];
    let currentValue = ATTENTION_SOUND_VOLUME;

    ATTENTION_PATTERN.forEach(duration => {
      for (let i = 0; i < duration; i++) {
        result.push(currentValue);
      }

      currentValue = ATTENTION_SOUND_VOLUME - currentValue;
    });

    return new Float32Array(result);
  }

  function ringtone() {
    let o1 = audioCtx.createOscillator();
    let o2 = audioCtx.createOscillator();
    let gain = audioCtx.createGain();

    let time = audioCtx.currentTime;

    o1.type = o2.type = 'sine';
    o1.frequency.value = 853;
    o2.frequency.value = 960;

    o1.start();
    o2.start();
    // Eventually stop the oscillator to allow garbage collecting.
    o1.stop(time + 11);
    o2.stop(time + 11);

    let wave = getAttentionCurveWave();
    gain.gain.setValueCurveAtTime(wave, time, 11);

    o1.connect(gain);
    o2.connect(gain);
    gain.connect(audioCtx.destination);
    gainNode = gain;
  }

  function vibrate() {
    let pattern = ATTENTION_PATTERN.map((value) => value * 500);
    // vibration only works when App is in the foreground
    if (document.hidden) {
      window.addEventListener('visibilitychange', function waitOn() {
        window.removeEventListener('visibilitychange', waitOn);
        navigator.vibrate(pattern);
      });
    } else {
      navigator.vibrate(pattern);
    }
  }

  const Notify = {
    play: function play_ringtone() {
      getSettings(
        [SETTINGS.notificationVolume, SETTINGS.vibration]
      ).then((settings) => {
        if (settings[SETTINGS.notificationVolume] &&
          !navigator.mozAudioChannelManager.headphones) {
          ringtone();
        }

        if (settings[SETTINGS.vibration]) {
          vibrate();
        }
      });
    },
    stop: function stop_ringtone() {
      getSettings(
        [SETTINGS.notificationVolume, SETTINGS.vibration]
      ).then((settings) => {
        if (gainNode && settings[SETTINGS.notificationVolume] &&
          !navigator.mozAudioChannelManager.headphones) {
          gainNode.disconnect(audioCtx.destination);
        }

        if (settings[SETTINGS.vibration]) {
          navigator.vibrate(0);
        }
      });
    }
  };

  module.exports = Notify;
});
