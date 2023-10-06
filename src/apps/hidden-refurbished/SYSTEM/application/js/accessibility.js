'use strict';
/* global SettingsListener */
/* global Service*/

(function(exports) {

  /**
   * Accessibility enables and disables the screenreader after the user
   * gestures using the hardware buttons of the phone. To toggle the setting.
   * the user must press volume up, then volume down three times in a row.
   * @class Accessibility
   * @requires SettingsListener
   */
  function Accessibility() {}

  Accessibility.prototype = {

    name: 'Accessibility',
    /**
     * How fast the autorepeat is.
     * @type {Number}
     * @memberof Accessibility.prototype
     */
    REPEAT_INTERVAL: 600000,

    /**
     * Maximum interval between initial and final TOGGLE_SCREEN_READER_COUNT
     * volume button presses.
     * @type {Number}
     * @memberof Accessibility.prototype
     */
    REPEAT_BUTTON_PRESS: 15000000,

    /**
     * Number of times the buttons need to be pressed before the screen reader
     * setting is toggled.
     * @type {Number}
     * @memberof Accessibility.prototype
     */
    TOGGLE_SCREEN_READER_COUNT: 6,

    /**
     * Cap the full range of contrast. Actual -1 is completely gray, and 1
     * makes things hard to see. This value is the max/min contrast.
     */
    CONTRAST_CAP: 0.6,

    /**
     * Timeout (in milliseconds) between when a vc-change event fires
     * and when interaction hints (if any) are spoken
     */
    HINTS_TIMEOUT: 2000,

    /**
     * Current counter for button presses in short succession.
     * @type {Number}
     * @memberof Accessibility.prototype
     */
    counter: 0,

    /**
     * Next expected event.
     * @type {Object}
     * @memberof Accessibility.prototype
     */
    expectedEvent: {
      type: 'volumeup',
      timeStamp: 0
    },

    softKeys: undefined,
    /**
     * Expected complete time stamp.
     * @type {Number}
     * @memberof Accessibility.prototype
     */
    expectedCompleteTimeStamp: 0,

    /**
     * Accessibility settings to be observed.
     * @type {Object} name: value pairs.
     * @memberof Accessibility.prototype
     */
    settings: {
      'accessibility.screenreader': false,
      'accessibility.screenreader-volume': 1,
      'accessibility.screenreader-rate': 0,
      'accessibility.colors.enable': false,
      'accessibility.colors.invert': false,
      'accessibility.colors.grayscale': false,
      'accessibility.colors.contrast': '0.0'
    },

    /**
     * Audio used by the screen reader.
     * Note: Lazy-loaded when first needed
     * @type {Object}
     * @memberof Accessibility.prototype
     */
    sounds: {
      clickedAudio: null,
      vcKeyAudio: null,
      vcMoveAudio: null,
      noMoveAudio: null
    },

    /**
     * URLs for screen reader audio files.
     * @type {Object}
     * @memberof Accessibility.prototype
     */
    soundURLs: {
      clickedAudio: './resources/sounds/screen_reader_clicked.ogg',
      vcKeyAudio: './resources/sounds/screen_reader_virtual_cursor_key.ogg',
      vcMoveAudio: './resources/sounds/screen_reader_virtual_cursor_move.ogg',
      noMoveAudio: './resources/sounds/screen_reader_no_move.ogg'
    },

    /**
     Copy from nsIAccessibleRole in gecko
     */
    AccessibleRole: {
      ROLE_PASSWORD_TEXT: 82
    },
    /**
     * Start listening for events.
     * @memberof Accessibility.prototype
     */
    start: function ar_init() {

      this.screen = document.getElementById('screen');

      this.speechSynthesizer = speechSynthesizer;

      window.addEventListener('mozChromeEvent', this);
      window.addEventListener('volumeup', this);
      window.addEventListener('volumedown', this);
      window.addEventListener('logohidden', this);
      window.addEventListener('screenchange', this);

      // XXX: This is a hack because navigation is done in navigation_xxxx.js now.
      // It shall be done in value selector itself.
      document.addEventListener('focusChanged', (evt) => {
        this.announceElement(evt.detail.focusedElement);
      });

      Service.register('speak', this);
      Service.register('cancelSpeech', this);
      Service.register('announceElement', this);
      Service.register('startCustomAccessOutput', this);
      Service.register('stopCustomAccessOutput', this);
      Service.registerState('screenReaderEnabled', this);
      Service.registerState('callerIdReadoutOption', this);

      // Attach all observers.
      Object.keys(this.settings).forEach(function attach(settingKey) {
        SettingsListener.observe(settingKey, this.settings[settingKey],
          function observe(aValue) {
            this.settings[settingKey] = aValue;
            switch (settingKey) {
              case 'accessibility.screenreader':
                // Show Accessibility panel if it is not already visible
                if (aValue) {
                  SettingsListener.getSettingsLock().set({
                    'accessibility.screenreader-show-settings': true
                  });
                } else {
                  this.cancelHints();
                }
                break;

              case 'accessibility.colors.enable':
                SettingsListener.getSettingsLock().set({
                  'layers.effect.invert': aValue ?
                    this.settings['accessibility.colors.invert'] : false,
                  'layers.effect.grayscale': aValue ?
                    this.settings['accessibility.colors.grayscale'] : false,
                  'layers.effect.contrast': aValue ?
                    this.settings['accessibility.colors.contrast'] *
                    this.CONTRAST_CAP : '0.0'
                });
                break;

              case 'accessibility.colors.invert':
              case 'accessibility.colors.grayscale':
              case 'accessibility.colors.contrast':
                if (this.settings['accessibility.colors.enable']) {
                  var effect = settingKey.split('.').pop();
                  var gfxSetting = {};
                  if (effect === 'contrast') {
                    gfxSetting['layers.effect.contrast'] =
                      aValue * this.CONTRAST_CAP;
                  } else {
                    gfxSetting['layers.effect.' + effect] = aValue;
                  }
                  SettingsListener.getSettingsLock().set(gfxSetting);
                }
                break;
            }
          }.bind(this));
      }, this);
    },

    /**
     * Reset the expected event to defaults.
     * @memberof Accessibility.prototype
     */
    reset: function ar_resetEvent() {
      this.expectedEvent = {
        type: 'volumeup',
        timeStamp: 0
      };
      this.counter = 0;
    },

    /**
     * Unset speaking flag and set the expected complete time stamp.
     * @param  {?Number} aExpectedCompleteTimeStamp Expected complete time
     * stamp.
     * @memberof Accessibility.prototype
     */
    resetSpeaking: function ar_resetSpeaking(aExpectedCompleteTimeStamp) {
      this.isSpeaking = false;
      this.expectedCompleteTimeStamp = aExpectedCompleteTimeStamp || 0;
    },

    /**
     * Handle volumeup and volumedown events generated from HardwareButtons.
     * @param  {Object} aEvent a high-level key event object generated from
     * HardwareButtons.
     * @memberof Accessibility.prototype
     */
    handleVolumeButtonPress: function ar_handleVolumeButtonPress(aEvent) {
      var type = aEvent.type;
      var timeStamp = aEvent.timeStamp;
      var expectedEvent = this.expectedEvent;
      if (type !== expectedEvent.type || timeStamp > expectedEvent.timeStamp) {
        this.reset();
        if (type !== 'volumeup') {
          return;
        }
      }

      this.expectedEvent = {
        type: type === 'volumeup' ? 'volumedown' :
          'volumeup',
        timeStamp: timeStamp + this.REPEAT_INTERVAL
      };

      if (++this.counter < this.TOGGLE_SCREEN_READER_COUNT) {
        return;
      }

      this.reset();

      if (!this.isSpeaking && timeStamp > this.expectedCompleteTimeStamp) {
        this.cancelSpeech();
        this.announceScreenReader(function onEnd() {
          this.resetSpeaking(timeStamp + this.REPEAT_BUTTON_PRESS);
        }.bind(this));
        return;
      }

      this.cancelSpeech();
      this.resetSpeaking();
      SettingsListener.getSettingsLock().set({
        'accessibility.screenreader':
          !this.settings['accessibility.screenreader']
      });
    },

    /**
     * Play audio for a screen reader notification.
     * @param  {String} aSoundKey a key for the screen reader audio.
     * XXX: When Bug 848954 lands we should be able to use Web Audio API.
     * @memberof Accessibility.prototype
     */
    _playSound: function ar__playSound(aSoundKey) {
      if (!this.sounds[aSoundKey]) {
        this.sounds[aSoundKey] = new Audio(this.soundURLs[aSoundKey]);
        this.sounds[aSoundKey].load();
      }
      var audio = this.sounds[aSoundKey].cloneNode(false);
      audio.volume = this.volume;
      audio.play();
    },

    /**
     * Get current screen reader volume defined by the setting.
     * @return {Number} Screen reader volume wihtin the [0, 1] interval.
     * @memberof Accessibility.prototype
     */
    get volume() {
      return this.settings['accessibility.screenreader-volume'];
    },

    /**
     * Get current screen reader speech rate defined by the setting.
     * @return {Number} Screen reader rate within the [0.2, 10] interval.
     * @memberof Accessibility.prototype
     */
    get rate() {
      var rate = this.settings['accessibility.screenreader-rate'];
      return rate >= 0 ? rate + 1 : 1 / (Math.abs(rate) + 1);
    },

    /**
     * Start a timeout that waits to display hints
     * @memberof Accessibility.prototype
     */
    setHintsTimeout: function ar_setHintsTimeout(aHints) {
      this.cancelHints();
      this.hintsTimer = setTimeout(function onHintsTimeout() {
        if (!this.settings['accessibility.screenreader']) {
          return;
        }
        this.isSpeakingHints = true;
        this.speak(aHints, function onSpeakHintsEnd() {
          this.isSpeakingHints = false;
        }.bind(this), {
          enqueue: true
        });
      }.bind(this), this.HINTS_TIMEOUT);
    },

    /**
     * Handle accessfu mozChromeEvent.
     * @param  {Object} accessfu details object.
     * @memberof Accessibility.prototype
     */
    handleAccessFuOutput: function ar_handleAccessFuOutput(aDetails) {
      this.cancelHints();
      var options = aDetails.options || {};
      window.dispatchEvent(new CustomEvent('accessibility-action'));
      switch (aDetails.eventType) {
        case 'vc-change':
          // Vibrate when the virtual cursor changes.
          navigator.vibrate(options.pattern);
          this._playSound(options.isKey ? 'vcKeyAudio' : 'vcMoveAudio');
          break;
        case 'action':
          if (aDetails.data[0].string === 'clickAction') {
            // If element is clicked, play 'click' sound instead of speech.
            this._playSound('clickedAudio');
            return;
          }
          break;
        case 'no-move':
          this._playSound('noMoveAudio');
          return;
        case 'text-change':
          if (options.role === this.AccessibleRole.ROLE_PASSWORD_TEXT) {
            if (options.isInserted === true) {
              navigator.vibrate(100);
            }
            return;
          }
          break;
      }
      this.speak(aDetails.data, function hintsCallback() {
        var softKeys = this.getCurrentSoftKeys();
        if (softKeys && aDetails.data.length !== 0) {
          this.setHintsTimeout(softKeys);
        }
      }.bind(this), {
        enqueue: options.enqueue
      });
    },

    /**
     * Listen for screen change events and stop speaking if the
     * screen is disabled (in 'off' state)
     * @memberof Accessibility.prototype
     */
    handleScreenChange: function ar_handleScreenChange(aDetail){
      if(!aDetail.screenEnabled){
        this.cancelHints();
      }
    },

    /**
     * Remove aria-hidden from the screen element to make content accessible to
     * the screen reader.
     * @memberof Accessibility.prototype
     */
    activateScreen: function ar_activateScreen() {
      // Screen reader will not say anything until the splash animation is
      // hidden and the aria-hidden attribute is removed from #screen.
      this.screen.removeAttribute('aria-hidden');
      window.removeEventListener('logohidden', this);
    },

    /**
     * Handle event.
     * @param  {Object} aEvent mozChromeEvent/logohidden/volumeup/volumedown.
     * @memberof Accessibility.prototype
     */
    handleEvent: function ar_handleEvent(aEvent) {
      switch (aEvent.type) {
        case 'screenchange':
          this.handleScreenChange(aEvent.detail);
          break;
        case 'logohidden':
          this.activateScreen();
          break;
        case 'mozChromeEvent':
          switch (aEvent.detail.type) {
            case 'accessibility-output':
              this.handleAccessFuOutput(JSON.parse(aEvent.detail.details));
              break;
          }
          break;
        case 'volumeup':
        case 'volumedown':
          this.handleVolumeButtonPress(aEvent);
          break;
      }
    },

    getCurrentSoftKeys: function ar_getCurrentSoftKeys() {
      // Get softkeys from top window.
      var keys;
      if (Service.query('SoftKeyManager.isActive')) {
        keys = Service.query('SoftKeyManager.getSoftkeys');
      } else {
        keys = Service.query('getTopMostWindow').getSoftkeys();
      }
      if (!keys || keys.length === 0) {
        return;
      }

      var softKeys = [];

      keys.forEach((key) => {
        if (key.options.name) {
          if (typeof key.options.name === 'object') {
            if (key.options.name.text) {
              softKeys.push(
                navigator.mozL10n.get(key.code) + ': ' + key.options.name.text);
            }
          } else {
            softKeys.push(
              navigator.mozL10n.get(key.code) + ': ' + key.options.name);
          }
        }
      });

      return softKeys.join(', ');
    },
    /**
     * Check for Hints speech/timer and clear.
     * @memberof Accessibility.prototype
     */
    cancelHints: function ar_cancelHints() {
      clearTimeout(this.hintsTimer);
      if(this.isSpeakingHints){
        this.cancelSpeech();
        this.isSpeakingHints = false;
      }
    },

    /**
     * Based on whether the screen reader is currently enabled, announce the
     * instructions of how to enable/disable it.
     * @param {Function} aCallback A callback after the speech synthesis is
     * completed.
     * @memberof Accessibility.prototype
     */
    announceScreenReader: function ar_announceScreenReader(aCallback) {
      var enabled = this.settings['accessibility.screenreader'];
      this.isSpeaking = true;
      this.speak({ string: enabled ? 'disableScreenReaderSteps' :
       'enableScreenReaderSteps'}, aCallback, {enqueue: false});
    },

    startCustomAccessOutput: function ar_announceElement(element) {
      var evt = new CustomEvent('mozContentEvent', {
        detail: {
          type: 'start-custom-access-output',
          node: element
        }
      });
      window.dispatchEvent(evt);
    },

    stopCustomAccessOutput: function ar_announceElement(element) {
      var evt = new CustomEvent('mozContentEvent', {
        detail: {
          type: 'stop-custom-access-output',
          node: element
        }
      });
      window.dispatchEvent(evt);
    },

    announceElement: function ar_announceElement(element) {
      if (!element) {
        return;
      }
      var evt = new CustomEvent('mozContentEvent', {
        detail: {
          type: 'custom-accessible',
          node: element
        }
      });
      window.dispatchEvent(evt);
    },

    screenReaderEnabled: function ar_screenReaderEnabled() {
      return this.settings['accessibility.screenreader'];
    },

    callerIdReadoutOption: function ar_calleridReadoutEnabled() {
      return this.settings['accessibility.callid_readout'];
    },
    /**
     * Use speechSynthesis to speak screen reader utterances.
     * @param  {?Array} aData Speech data before it is localized.
     * @param  {?Function} aCallback aCallback A callback after the speech
     * synthesis is completed.
     * @param  {?Object} aOptions = {} Speech options such as enqueue etc.
     * @memberof Accessibility.prototype
     */
    speak: function ar_speak(aData, aCallback, aOptions = {}) {
      if (aOptions.repeat) {
        this.isRepeating = true;
        this.repeatData = aData;
        this.repeatOptions = aOptions;
        this.repeatCallback = aCallback;
        this.speechSynthesizer.speak(aData, aOptions, this.rate, this.volume,
          this.repeating.bind(this));
      } else {
        this.speechSynthesizer.speak(aData, aOptions, this.rate, this.volume,
          aCallback);
      }
    },

    repeating: function ar_endSpeech() {
      if (this.isRepeating) {
        this.repeatingTimer = window.setTimeout(() => {
          this.speechSynthesizer.speak(this.repeatData, this.repeatOptions,
            this.rate, this.volume, this.repeating.bind(this));
        }, 500);
      } else {
        this.repeatCallback();
        this.repeatCallback = null;
      }
    },

    /**
     * Cancel any utterances currently being spoken by speechSynthesis.
     * @memberof Accessibility.prototype
     */
    cancelSpeech: function ar_cancelSpeech() {
      if (this.isRepeating) {
        window.clearTimeout(this.repeatingTimer);
        this.repeatingTimer = null;
        this.isRepeating = false;
        this.repeatData = null;
        this.repeatOptions = null;
      }
      this.speechSynthesizer.cancel();
    }
  };

  /**
   * A speech synthesizer component that handles speech localization and
   * pronunciation.
   * @type {Object}
   */
  var speechSynthesizer = {
    /**
     * Speech Synthesis
     * @type {Object}
     * @memberof speechSynthesizer
     */
    get speech() {
      delete this.speech;
      // If there are no voices bundled, consider speech synthesis unavailable.
      if (!window.speechSynthesis ||
        window.speechSynthesis.getVoices().length === 0) {
        this.speech = null;
      }
      this.speech = window.speechSynthesis;
      return this.speech;
    },

    /**
     * Speech utterance
     * @type {Object}
     * @memberof speechSynthesizer
     */
    get utterance() {
      delete this.utterance;
      this.utterance = window.SpeechSynthesisUtterance;
      return this.utterance;
    },

    /**
     * Cancle speech if the screen reader is speaking.
     * @memberof speechSynthesizer
     */
    cancel: function ss_cancel() {
      if (this.speech) {
        this.speech.cancel();
      }
    },

    /**
     * Localize speech data.
     * @param  {Object} aDetails Speech data object.
     * @return {String} Localized speech data.
     * @memberof speechSynthesizer
     */
    localize: function ss_localize(aDetails) {
      if (!aDetails || typeof aDetails === 'string') {
        return aDetails;
      }
      var string = aDetails.string;
      var data = {
        count: aDetails.count
      };
      if (!string) {
        return '';
      } else {
        string = 'accessibility-' + string;
      }

      if (aDetails.args) {
        data = aDetails.args.reduce(function(aData, val, index) {
          aData[index] = val;
          return aData;
        }, data);
      }
      return navigator.mozL10n.get(string, data);
    },

    /**
     * Build a complete utterance string by localizing an array of speech data.
     * @param  {?Array} aData Speech data.
     * @return {String} A complete localized string from speech array data.
     * @memberof speechSynthesizer
     */
    buildUtterance: function ss_buildUtterance(aData) {
      if (!Array.isArray(aData)) {
        aData = [aData];
      }
      var words = [], localize = this.localize;
      aData.reduce(function(words, details) {
        var localized = localize(details);
        if (localized) {
          var word = localized.trim();
          if (word) {
            words.push(word);
          }
        }
        return words;
      }, words);

      return words.join(' ');
    },

    /**
     * Utter a message with a speechSynthesizer.
     * @param {?Array} aData A messages array to be localized.
     * @param {JSON} aOptions Options to be used when speaking. For example: {
     *   enqueue: false
     * }
     * @param {Number} aRate Speech rate.
     * @param {Number} aVolume Speech volume.
     * @param {Function} aCallback A callback after the speech synthesis is
     * completed.
     * @memberof speechSynthesizer
     */
    speak: function ss_speak(aData, aOptions, aRate, aVolume, aCallback) {
      if (!this.speech || !this.utterance) {
        if (aCallback) {
          aCallback();
        }
        return;
      }

      if (!aOptions.enqueue) {
        this.cancel();
      }

      var sentence = this.buildUtterance(aData);
      if (!sentence) {
        if (aCallback) {
          aCallback();
        }
        return;
      }

      var utterance = new this.utterance(sentence);
      utterance.volume = aVolume;
      utterance.rate = aRate;
      utterance.addEventListener('end', function() {
        if (aCallback) {
          aCallback();
        }
      }.bind(this));

      this.speech.speak(utterance);
    }
  };

  exports.Accessibility = Accessibility;

}(window));
