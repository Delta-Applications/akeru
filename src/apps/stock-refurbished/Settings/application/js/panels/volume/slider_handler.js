/**
 * Handle each slider's functionality.
 * Get correspondent tone, make sure the tone is playable,
 * set volume based on slider position.
 *
 * @module SliderHandler
 */
define(['require','shared/settings_listener'],function(require) {
  

  var SettingsListener = require('shared/settings_listener');

  var INTERVAL = 500;
  var DELAY = 800;
  var BASESHAREURL = '/shared/resources/media/';
  var TONEURLS = {
    'content': BASESHAREURL + 'notifications/notifier_shake.ogg',
    'notification': BASESHAREURL + 'ringtones/ringer_kai.ogg',
    'alarm': BASESHAREURL + 'alarms/ac_woody.ogg'
  };
  var TONEKEYS = {
    'content': 'media.ringtone',
    'notification': 'dialer.ringtone',
    'alarm': 'alarm.ringtone'
  };

  const VIBRATION_KEY = 'vibration.enabled';

  var SliderHandler = function() {
    this._container = null;
    this._element = null;
    this._label = null;
    this._channelType = '';
    this._channelKey = '';
    this._toneURL = '';
    this._toneKey = '';
    this._previous = null;
    this._preVibrate = false;
    this._isTouching = false;
    this._isFirstInput = false;
    this._intervalID = null;
    this._lock = false;
    this._player = new Audio();
  };

  SliderHandler.prototype = {
    /**
     * initialization
     *
     * The sliders listen to input, touchstart and touchend events to fit
     * the ux requirements, and when the user tap or drag the sliders, the
     * sequence of the events is:
     * touchstart -> input -> input(more if dragging) -> touchend -> input
     *
     * @access public
     * @memberOf SliderHandler.prototype
     * @param  {Object} container html elements
     * @param  {String} channelType type of sound channel
     */
    init: function sh_init(container, channelType) {
      this._container = container;
      this._element = container.querySelector('input');
      this._label = container.querySelector('span.level');
      this._channelType = channelType;
      this._channelKey = 'audio.volume.' + channelType;
      this._toneURL = TONEURLS[channelType];
      this._toneKey = TONEKEYS[channelType];

      this._boundSetSliderValue = function(value) {
        if (value === this._previous) {
          this._lock = false;
        }
        this._value = value;
        this._setSliderValue(value);
        this._updateLabel();
      }.bind(this);

      // Get the volume value for the slider, also observe the value change.
      SettingsListener.observe(this._channelKey, '', this._boundSetSliderValue);

      if (this._channelType === 'notification') {
        this._onVibrationSet = function(value) {
          this._isVibrate = value;
          this._preVibrate = value;
          this._updateLabel();
        }.bind(this);
        SettingsListener.observe(VIBRATION_KEY, '', this._onVibrationSet);
      }

      this._element.addEventListener('touchstart',
        this._touchStartHandler.bind(this));
      this._element.addEventListener('input',
        this._inputHandler.bind(this));
      this._element.addEventListener('touchend',
        this._touchEndHandler.bind(this));
      this._container.addEventListener('keydown',
        this._keydownHandler.bind(this));
    },

    isRtl :() => 'rtl' === document.dir,

    /**
     * Stop the tone
     *
     * @access private
     * @memberOf SliderHandler.prototype
     */
    _stopTone: function vm_stopTone() {
      this._player.pause();
      this._player.removeAttribute('src');
      this._player.load();
    },

    /**
     * Play the tone
     *
     * @access private
     * @memberOf SliderHandler.prototype
     * @param  {Blob} blob tone blob
     */
    _playTone: function vm_playTone(blob) {
      if (this._channelType !== 'content') {
        this._player.mozAudioChannelType = this._channelType;
      }
      this._player.src = URL.createObjectURL(blob);
      this._player.load();
      this._player.loop = false;
      this._player.play();
    },

    /**
     * Change slider's value
     *
     * @access private
     * @memberOf SliderHandler.prototype
     * @param {Number} value slider value
     */
    _setSliderValue: function vm_setSliderValue(value) {
      this._element.value = value;
      // The slider is transparent if the value is not set yet, display it
      // once the value is set.
      if (this._element.style.opacity !== 1) {
        this._element.style.opacity = 1;
      }

      // If it is the first time we set the slider value, we must update the
      // previous value of this channel type
      if (this._previous === null) {
        this._previous = value;
      }
    },

    _updateLabel: function vm_updateLabel() {
      if (this._channelType === 'notification' && this._value === 0) {
        this._label.textContent = navigator.mozL10n.get(this._isVibrate ? 'vibrate' : 'silent');
      } else {
        this._label.textContent = `${this._value}/${this._element.max}`;
      }
    },

    /**
     * get default tone
     *
     * @access private
     * @memberOf SliderHandler.prototype
     * @param  {Function} callback callback function
     */
    _getDefaultTone: function vm_getDefaultTone(callback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', this._toneURL);
      xhr.overrideMimeType('audio/ogg');
      xhr.responseType = 'blob';
      xhr.send();
      xhr.onload = function() {
        callback(xhr.response);
      };
    },

    /**
     * get tone's blob object
     *
     * @access private
     * @memberOf SliderHandler.prototype
     * @param  {Function} callback callback function
     */
    _getToneBlob: function vm_getToneBlob(callback) {
      SettingsDBCache.getSettings(function(results) {
        if (results[this._toneKey]) {
          callback(results[this._toneKey]);
        } else {
          // Fall back to the predefined tone if the value does not exist
          // in the mozSettings.
          this._getDefaultTone(function(blob) {
            // Save the default tone to mozSettings so that next time we
            // don't have to fall back to it from the system files.
            var settingObject = {};
            settingObject[this._toneKey] = blob;
            navigator.mozSettings.createLock().set(settingObject);

            callback(blob);
          });
        }
      }.bind(this));
    },

    /**
     * Handle touchstart event
     *
     * It stop the tone previewing from the last touchstart if the delayed
     * stopTone() is not called yet.
     *
     * It stop observing when the user is adjusting the slider, this is to
     * get better ux that the slider won't be updated by both the observer
     * and the ui.
     *
     * @access private
     * @memberOf SliderHandler.prototype
     */
    _touchStartHandler: function sh_touchStartHandler(event) {
      this._isTouching = true;
      this._isFirstInput = true;
      this._stopTone();
      SettingsListener.unobserve(this._channelKey, this._boundSetSliderValue);

      this._getToneBlob(function(blob) {
        this._playTone(blob);
      }.bind(this));
    },

    /**
     * Change volume
     *
     * @access private
     * @memberOf SliderHandler.prototype
     */
    _setVolume: function sh_setVolume(down) {
      var settings = {};
      var value = this._value;
      if (this._lock) {
        return;
      }
      if (down) {
        value = (this._value <= 0 ? 0 : this._value - 1);
      } else {
        if (this._channelType !== 'notification' ||
          this._value !== 0 || this._isVibrate) {
          value = (this._value >= this._element.max ?
            parseInt(this._element.max) : this._value + 1);
        }
      }
      settings[this._channelKey] = value;
      var retval = this._shouldUpdateVibration(down);
      if (retval.update) {
        if (retval.isVibrate && !value &&
          (this._preVibrate !== retval.isVibrate || value !== this._previous)) {
          window.navigator.vibrate(200);
        }
        settings[VIBRATION_KEY] = retval.isVibrate;
        this._preVibrate = retval.isVibrate;
      }
      // Only set the new value if it does not equal to the previous one.
      if (value !== this._previous || retval.update) {
        navigator.mozSettings.createLock().set(settings);
        this._lock = true;
        this._previous = value;
      }
    },

    _shouldUpdateVibration: function sh_setVibration(down) {
      var retval = {};
      retval.isVibrate = false;
      retval.update = false;
      if (this._channelType === 'notification') {
        if (down) {
          if (this._previous === 1 || this._previous === 0) {
            retval.isVibrate = (this._previous === 1);
            retval.update = true;
          }
        } else {
          if (this._previous === 0 && !this._preVibrate) {
            retval.isVibrate = true;
            retval.update =  true;
          }
        }
      }
      return retval;
    },

    /**
     * Handle input event
     *
     * The mozSettings api is not designed to call rapidly, but ux want the
     * new volume to be applied immediately while previewing the tone, so
     * here we use setInterval() as a timer to ease the number of calling,
     * or we will see the queued callbacks try to update the slider's value
     * which we are unable to avoid and make bad ux for the users.
     *
     * @access private
     * @memberOf SliderHandler.prototype
     */
    _inputHandler: function sh_inputHandler(event) {
      if (this._isFirstInput) {
        this._isFirstInput = false;
        this._setVolume();
        this._intervalID = setInterval(this._setVolume.bind(this), INTERVAL);
      }
    },

    /**
     * Handle touchend event
     *
     * It Clear the interval setVolume() and set it directly when the
     * user's finger leaves the panel.
     *
     * It Re-observe the value change after the user finished tapping/dragging
     * on the slider and the preview is ended.
     *
     * If the user tap the slider very quickly, like the click event, then
     * we try to stop the player after a constant duration so that the user
     * is able to hear the tone's preview with the adjusted volume.
     *
     * @access private
     * @memberOf SliderHandler.prototype
     */
    _touchEndHandler: function sh_touchEndHandler(event) {
      this._isTouching = false;
      clearInterval(this._intervalID);
      this._setVolume();
      SettingsListener.observe(this._channelKey, '', this._boundSetSliderValue);
      setTimeout(function() {
        if (!this._isTouching) {
          this._stopTone();
        }
      }.bind(this), DELAY);
    },

    /**
     * Handle keydown event
     *
     * Use Dpad left/right key to adjust volume here to betwen [0, 15]. Play tone when
     * press these two keys, stop in other cases.
     *
     * @access private
     * @memberOf SliderHandler.prototype
     */

    _keydownHandler: function sh_keydownHandler(event) {
      // Add support to RTL
      let directions = this.isRtl() ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
      switch (directions.indexOf(event.key)) {
        case 0:
          this._setVolume(true);
          this._getToneBlob(function(blob) {
            this._playTone(blob);
          }.bind(this));
          break;

        case 1:
          this._setVolume(false);
          this._getToneBlob(function(blob) {
            this._playTone(blob);
          }.bind(this));
          break;

        default:
          this._stopTone();
          break;
      }
    }
  };

  return function ctor_sliderHandler() {
    return new SliderHandler();
  };
});
