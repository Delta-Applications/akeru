
/* global define */
define('audio_manager',['require'],function(require) {
  

  /**
   * The Settings App stores volumes in the range [0, 10] inclusive.
   * Whenever we need to play sounds, though, the Audio object
   * requires a float between [0.0, 1.0]. The conversion has to happen
   * somewhere. The AudioManager here draws the line right out of what
   * gets read from mozSettings.
   *
   * In other words, the conversion is not important to clients of
   * this class, who should treat the volume as a float with no
   * conversion. The only weirdness here is that unit tests must be
   * aware of the slight rounding differences when converting from a
   * float to the system level.
   */

  ////////////////////////////////////////////////////////////////
  // VolumeManager

  function isValidVolume(volume) {
    return (typeof volume === 'number' &&
            volume <= 1.0 &&
            volume >= 0.0);
  }

  var VOLUME_SETTING = 'audio.volume.alarm';
  var SYSTEM_VOLUME_MAX = 15;
  function systemVolumeToFloat(volume) {
    return (volume / SYSTEM_VOLUME_MAX);
  }

  function floatToSystemVolume(volume) {
    return Math.round(volume * SYSTEM_VOLUME_MAX);
  }

  function requestAlarmSystemVolume() {
    // Asynchronously load the alarm volume from mozSettings.
    return new Promise(function(resolve, reject) {
      var lock = navigator.mozSettings.createLock();
      var req = lock.get(VOLUME_SETTING);
      req.onsuccess = function() {
        var volume = systemVolumeToFloat(req.result[VOLUME_SETTING]);
        if (isValidVolume(volume)) {
          globalVolumeManager._volume = volume;
          resolve(volume);
        }
      };

      req.onerror = function() {
        var DEFAULT_VOLUME = 1.0;
        resolve(DEFAULT_VOLUME);
      };
    });
  }

  function VolumeManager() {
    this.VOLUME_KEY = 'defaultAlarmVolume';
    this.DEFAULT_VOLUME = 1.0;
    this._volume = this.DEFAULT_VOLUME;

    if (navigator.mozSettings) {
      navigator.mozSettings.addObserver(
        VOLUME_SETTING,
        this.onSystemAlarmVolumeChange.bind(this));
    }
  }

  VolumeManager.prototype = {
    onSystemAlarmVolumeChange: function(e) {
      // don't use the setter here
      this._volume = systemVolumeToFloat(e.settingValue);
      var event = new CustomEvent('volumemanager-alarm-volume-change');
      event.volume = this._volume;
      window.dispatchEvent(event);
    },

    get volume() {
      return this._volume;
    },

    set volume(volume) {
      this.setVolume(volume);
    },

    /** Set the volume with an optional completion callback. */
    setVolume: function(volume, cb) {
      if (isValidVolume(volume)) {
        if (navigator.mozSettings) {
          var lock = navigator.mozSettings.createLock();

          var opts = {};
          opts[VOLUME_SETTING] = floatToSystemVolume(volume);
          var req = lock.set(opts);

          var self = this;
          req.onsuccess = function() {
            self._volume = volume;
            if (cb) {
              cb();
            }
          };

        }
      }
    }

  };

  ////////////////////////////////////////////////////////////////
  // AudioPlayer

  var globalVolumeManager = new VolumeManager();

  /**
   * The AudioPlayer class manages the playback of alarm ringtones. It
   * is lazy-loading, so that you can instantiate it immediately;
   * Audio objects are not actually created or loaded until you need
   * to play a sound.
   *
   * @param {function} [opts.interruptHandler]
   *   Optional callback/EventTarget to handle the 'mozinterruptbegin' event.
   */
  function AudioPlayer(opts) {
    opts = opts || {};
    this._audio = null;
    this._interruptHandler = opts.interruptHandler || null;
  }

  AudioPlayer.prototype = {

    /**
     * Play a ringtone from the shared/resources/media/alarms
     * directory, using the current global volume settings by default.
     * You can override the volume through opts.volume.
     *
     * @param {string} ringtoneName
     * @param {number} opts.volume Value between 0 and 1
     */
    playRingtone: function(ringtoneName, loop) {
      this._prepare(loop); // Load up the audio element.
      this._audio.pause();
      this._audio.src = 'shared/resources/media/alarms/' + ringtoneName;
      this._audio.load(); // Required per MDN's HTMLMediaElement spec.

      // "Make sure the audio.volume is set to 1 before you create MediaElementSource."
      // (https://support.mozilla.org/nl/questions/984336)
      // Personal feeling is that here it's set the maximum volume level as a base for decrease
      // by setting of the 'audio.volume' setting corresponding to the given audio channel type.
      this._audio.volume = 1;

      this._audio.play();
    },

    /**
     * Pause the currently-playing audio, if possible.
     */
    pause: function() {
      if (this._audio) {
        this._audio.pause();
      }
    },

    // Private methods:

    /**
     * Instantiate the Audio element and prepare it for playback.
     * For internal use only.
     * @private
     */
    _prepare: function(loop) {
      if (!this._audio) {
        this._audio = new Audio();
        this._audio.mozAudioChannelType = 'alarm';
        this._audio.loop = loop;
        this._audio.addEventListener('mozinterruptbegin', this);
        this._audio.addEventListener('mozinterruptend', this);
      }
    },

    /**
     * @private
     */
    handleEvent: function(e) {
      if (e.type === 'mozinterruptbegin' && this._interruptHandler) {
        this._interruptHandler(e, 'stop');
      } else if (e.type === 'mozinterruptend' && this._interruptHandler) {
        this._interruptHandler(e, 'resume');
      }
    }
  };

  return {
    getAlarmVolume: function() {
      return globalVolumeManager.volume;
    },
    requestAlarmVolume: function() {
      return requestAlarmSystemVolume();
    },
    setAlarmVolume: function(volume, cb) {
      globalVolumeManager.setVolume(volume, cb);
    },
    createAudioPlayer: function(opts) {
      return new AudioPlayer(opts);
    },
    // Exposed for tests:
    systemVolumeToFloat: systemVolumeToFloat,
    floatToSystemVolume: floatToSystemVolume,
    SYSTEM_VOLUME_MAX: SYSTEM_VOLUME_MAX
  };
});

// outer IIFE
define('form_button',['require','utils'],function(require) {


var Utils = require('utils');

function createButton(formButton) {
  var button = document.createElement(formButton.tagName);
  button.className = formButton.className;
  if (formButton.id) {
    button.id = formButton.id;
  }
  var input = formButton.input;
  input.parentNode.insertBefore(button, input.nextSibling);
  formButton.button = button;
}

/**
 * A FormButton is a button that triggers an input. The text
 * of the currently selected value will display on the buttons's face.
 *
 * The `config` parameter supports the following optional properties.
 * `formatLabel` - A function that is given the current value of the input
 * and should return a string which will be used as the textContent of
 * the button.
 *
 * `tagName` - The name of the tag to create and insert into the
 * document as the main button used to trigger the input. The default
 * value is 'button'
 *
 * `className` The value of the className property that will be assigned to
 *  the button element the default value is 'icon icon-dialog'.
 *
 * `id` - A string that is used as the id of the button element.
 *
 * @constructor
 * @param {HTMLElement} input The input element to trigger.
 * @param {Object} config An optional config object.
 *
 */
function FormButton(input, config) {
  config = config || {};
  Utils.extend(this, config);

  this.input = input;
  createButton(this);

  this.input.classList.add('form-button-input');
  // hide input
  this.input.classList.add('form-button-hide');

  // set isSelect
  Object.defineProperty(this, 'isSelect', {
    value: this.input.nodeName === 'SELECT'
  });

  // set isInput
  Object.defineProperty(this, 'isInput', {
    value: this.input.nodeName === 'INPUT'
  });

  // Bind this.refresh so that the listener can be easily removed.
  this.refresh = this.refresh.bind(this);
  this.handleLocalized = this.handleLocalized.bind(this);
  this.onInputBlur = this.onInputBlur.bind(this);
  this.onInputFocus = this.onInputFocus.bind(this);
  this.click = this.click.bind(this);
  this.focusingInput = false;
  input.parentNode.addEventListener('click', this.click, false);
  input.addEventListener('blur', this.onInputBlur, false);
  input.addEventListener('focus', this.onInputFocus, false);
  // Update the dropdown when the language changes.
  window.addEventListener('localized', this.handleLocalized);
  window.addEventListener('timeformatchange', this.refresh);
}

FormButton.prototype = {

  inputValue: null,

  /** Remove all event handlers. */
  destroy: function() {
    window.removeEventListener('localized', this.refresh);
  },

  click: function(event) {
    this.focus(event);
  },

  /**
   * focus Triggers a focus event on the input associated with this
   * FormButton.
   *
   * @param {Object} event an event object.
   */
  focus: function(event) {
    if (!this.focusingInput) {
     this.updateLocalized();
      event.preventDefault();
      this.focusingInput = true;
      if (this.isInput) {
        this.input.value = this.inputValue;
      }

      setTimeout(this.input.focus.bind(this.input), 10);
    }
  },

  get isFocusingInput() {
    return this.focusingInput;
  },

  onInputBlur: function(event) {
    this.refresh();
    this.focusingInput = false;
  },

  onInputFocus: function(event) {
    this.focusingInput = true;
  },

  handleLocalized: function() {
    this.updateLocalized();
    this.refresh();
  },

  updateLocalized: function() {
  },

  /**
   * refresh Updates the label text on the button to reflect
   * the current value of the input.
   *
   */
  refresh: function() {
    var value = this.value;
    this.button.textContent = this.formatLabel(value);
  },

  /**
   * value Returns the current value of the input.
   *
   * @return {String|Object} The value of the input.
   *
   */
  get value() {
    if (this.isSelect) {
      if (this.input.multiple) {
        var selectedOptions = {};
        var options = this.input.options;
        for (var i = 0; i < options.length; i++) {
          if (options[i].selected) {
            selectedOptions[options[i].value] = true;
          }
        }
        return selectedOptions;
      }
      if (this.input.selectedIndex !== -1) {
        return Utils.getSelectedValueByIndex(this.input);
      }
      return null;
    } else if (this.isInput) {
      // input node
      if ((this.input.value && (this.input.value !== '')) || (this.input.type !== 'time')) {
        this.inputValue = this.input.value;
      }
      return this.inputValue;
    } else {
      return this.input.value;
    }
  },

  /**
   * value sets the current value of the input and update's the
   * button text.
   *
   * @param {String|Object} value A string of the current values or an
   * object with properties that map to input options if the input is
   * a multi select.
   *
   */
  set value(value) {
    if (this.isSelect) {
      if (this.input.multiple) {
        // multi select
        var options = this.input.options;
        for (var i = 0; i < options.length; i++) {
          options[i].selected = value[options[i].value] === true;
        }
      } else {
        // normal select element
        Utils.changeSelectByValue(this.input, value);
      }
    } else if (this.isInput) {
      // input element
      this.inputValue = this.input.value = value;
    } else {
      this.input.value = value;
    }
    // Update the text on the button to reflect the new input value
    this.refresh();
  },

  /**
   * An overrideable method that is called when updating the textContent
   * of the button.
   *
   * @return {String} The formatted text to display in the label.
   *
   */
  formatLabel: function(value) {
    return value;
  },

  /**
   * tagName The the name of the tag to insert into the document to use
   * as the button element.
   */
  tagName: 'label',

  /**
   * class The value to assign to the className property on the
   * generated button element.
   */
  className: 'value'
};

  return FormButton;

// end outer IIFE
});

define('text!panels/alarm_settings/panel.html',[],function () { return '<header id="settings-alarm-header">\n  <h1 class="settings-title" id="clock-settings" data-l10n-id="clock-settings"></h1>\n</header>\n<section role="heading" aria-labelledby="clock-settings">\n<ul id="settings-alarm" class="compact" role="menu">\n  <label class="settings-chapter-lbl p-sec" data-l10n-id="alarm">Alarm</label>\n  <li id="settings-alarm-snooze-control" class="navigation" tabindex="1" role="menuitem">\n    <label class="view-alarm-lbl snooze-lbl p-pri" data-l10n-id="snooze-label">Snooze</label>\n    <select id="settings-snooze-select" data-track-class="datatrack-settings-snooze-selector-title">\n      <option data-l10n-id="nMinutes" data-l10n-args=\'{"n": "5"}\' value="5"> 5 minutes</option>\n      <option data-l10n-id="nMinutes" data-l10n-args=\'{"n": "10"}\' value="10">10 minutes</option>\n      <option data-l10n-id="nMinutes" data-l10n-args=\'{"n": "15"}\' value="15">15 minutes</option>\n      <option data-l10n-id="nMinutes" data-l10n-args=\'{"n": "20"}\' value="20">20 minutes</option>\n    </select>\n  </li>\n  <li id="settings-alarm-volume-control" class="navigation" tabindex="1" role="menuitem">\n    <label class="alarm-volume-lbl p-pri" id="settings-alarm-volume-lbl" data-l10n-id="alarm-volume-label">System Alarm Volume</label>\n    <label class="alarm-volume-lbl" id="settings-alarm-volume"></label>\n    <input id="settings-alarmvolume-input" step="1" min="0" value="1" max="15" type="range">\n    <input id="settings-alarmvolume-select" step="1" min="0" max="15" type="range" data-track-class="datatrack-alarmvolume-selector-title-s">\n  </li>\n  <label class="settings-chapter-lbl p-sec" data-l10n-id="timer">Timer</label>\n  <li id="settings-alarm-vibrate-control" class="navigation settings-timer-item" tabindex="1" role="menuitem">\n    <label data-l10n-id="vibrate" class="p-pri">Vibrate</label>\n    <select id="settings-timervibrate-select" data-track-class="datatrack-settings-vibrate-selector-title">\n      <option value="true" data-l10n-id="vibrateOn">On</option>\n      <option value="false" data-l10n-id="vibrateOff">Off</option>\n    </select>\n  </li>\n  <li class="navigation settings-timer-item" id="sound-select" tabindex="1" role="menuitem">\n    <label data-l10n-id="sound" class="p-pri">Sound</label>\n    <div id="settings-timersound">\n      <label id="sound-label" class="value" data-l10n-id="ac_woody_ogg">Woody</label>\n    </div>\n  </li>\n</ul>\n</section>\n<section id="timersound-settings" role="heading" aria-labelledby="clock-settings">\n  <ul id="timersound-select" class="sound-select" role="menu">\n    <li class="navigation" value="ac_africa.ogg" tabindex="1" role="menuitem">\n      <div class="clsSoundLabel" data-l10n-id="ac_africa_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li class="navigation" value="ac_amazon.ogg" tabindex="1" role="menuitem">\n      <div class="clsSoundLabel" data-l10n-id="ac_amazon_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li class="navigation" value="ac_disco.ogg" tabindex="1" role="menuitem">\n      <div class="clsSoundLabel" data-l10n-id="ac_disco_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li class="navigation" value="ac_fairy_tales.ogg" tabindex="1" role="menuitem">\n      <div class="clsSoundLabel" data-l10n-id="ac_fairy_tales_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li class="navigation" value="ac_fresh.ogg" tabindex="1" role="menuitem">\n      <div class="clsSoundLabel" data-l10n-id="ac_fresh_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li class="navigation" value="ac_galaxy.ogg" tabindex="1" role="menuitem">\n      <div class="clsSoundLabel" data-l10n-id="ac_galaxy_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li class="navigation" value="ac_kai.ogg" tabindex="1" role="menuitem">\n      <div class="clsSoundLabel" data-l10n-id="ac_kai_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li class="navigation" value="ac_techno.ogg" tabindex="1" role="menuitem">\n      <div class="clsSoundLabel" data-l10n-id="ac_techno_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li class="navigation" value="ac_woody.ogg" tabindex="1" role="menuitem">\n      <div class="clsSoundLabel" data-l10n-id="ac_woody_ogg"></div>\n      <div class="clsSoundBackIcon soundChecked" data-icon="radio-on"></div>\n    </li>\n  </ul>\n</section>\n';});


define('panels/alarm_settings/main',['require','alarm','app','audio_manager','form_button','sounds','utils','l10n','panel','text!panels/alarm_settings/panel.html','constants'],function(require) {
  var Alarm = require('alarm');
  var App = require('app');
  var AudioManager = require('audio_manager');
  var FormButton = require('form_button');
  var Sounds = require('sounds');
  var Utils = require('utils');
  var mozL10n = require('l10n');
  var Panel = require('panel');
  var _ = mozL10n.get;
  var html = require('text!panels/alarm_settings/panel.html');
  var constants = require('constants');

  var AlarmSettings = function() {
    Panel.apply(this, arguments);
    this.element.innerHTML = html;

    var handleDomEvent = this.handleDomEvent.bind(this);
    var onKeydown = this.onKeydown.bind(this);

    this.element.addEventListener('panel-visibilitychange',
      this.handleVisibilityChange.bind(this));

    window.addEventListener('volumemanager-alarm-volume-change', this.handleAlarmVolumeChange.bind(this));
    window.addEventListener('sound-clicked', this.soundSelectClick.bind(this));
    window.addEventListener('sound-select-cancel', this.soundSelectCancel.bind(this));
    window.addEventListener('sound-save', this.soundSelectSave.bind(this));
    document.addEventListener('focusChanged', this.onFocusChanged.bind(this));

    this.headers = {
      header: this.element.querySelector('#settings-alarm-header')
    };

    this.inputs = {};
    [
      'alarmvolume'
    ].forEach(function(id) {
      this.inputs[id] = this.element.querySelector('#settings-' + id + '-input');
    }, this);

    this.buttons = {};
    this.selects = {};
    [
      'snooze', 'alarmvolume', 'timervibrate'
    ].forEach(function(id) {
      this.selects[id] = this.element.querySelector('#settings-' + id + '-select');
    }, this);

    this.li = {};
    [
      'snooze', 'vibrate', 'volume'
    ].forEach(function (id) {
      this.li[id] = this.element.querySelector('#settings-alarm-' + id + '-control');
    }, this);

    this.buttons.volume = new FormButton(this.selects.alarmvolume, {
      id: 'alarmvolume-level',
      refresh: function() {},
      updateLocalized: function() {
        var alarmvolumeParamsEl = this.element.querySelector('.' + this.selects.alarmvolume.dataset.trackClass);
        alarmvolumeParamsEl.dataset.customValueName = _(alarmvolumeParamsEl.dataset.customValueNameL10nId);
      }.bind(this)
    });
    this.buttons.volume.max = AudioManager.SYSTEM_VOLUME_MAX;

    this.buttons.snooze = new FormButton(this.selects.snooze, {
      id: 'snooze-menu',
      formatLabel: function(snooze) {
        var lastTimerSnooze = SettingsApp.getValue('alarm.snooze');
        if (parseInt(lastTimerSnooze) !== parseInt(snooze)) {
          SettingsApp.save('alarm.snooze', snooze);
          Utils.showToast('changes-saved');
        }
        return _('nMinutes', {
          n: snooze
        });
      }
    });
   this.buttons.timervibrate = new FormButton(this.selects.timervibrate, {
      id: 'settings-timervibrate-menu',
      formatLabel: function(value) {
        return Utils.getOnOffValueText(value);
      }.bind(this)
   });

    this.setAlarmVolumeControls = this.setAlarmVolumeControls.bind(this);
    this.selects.snooze.addEventListener('blur', handleDomEvent);
    this.selects.alarmvolume.addEventListener('input', handleDomEvent);
    this.selects.alarmvolume.addEventListener('blur', handleDomEvent);
    this.selects.timervibrate.addEventListener('blur', handleDomEvent);
    this.li.volume.addEventListener('keydown', onKeydown);

    this.headers.header.addEventListener('action', handleDomEvent);
    location.hash = '#alarm-settings-panel';
  };

  AlarmSettings.prototype = Object.create(Panel.prototype);
  Utils.extend(AlarmSettings.prototype, {
    alarm: null,
    ringtonePlayer: AudioManager.createAudioPlayer(),

    // The name `handleEvent` is already defined by the Panel class, so this
    // method must be named uniquely to avoid overriding that functionality.
    handleDomEvent: function aev_handleDomEvent(evt) {
      evt.preventDefault();
      var input = evt.target;
      if (!input) {
        return;
      }
      switch (input) {
        case this.headers.header:
          App.showalarmPanel();
          break;
        case this.selects.snooze:
          this.li.snooze.focus();
          break;
        case this.selects.alarmvolume:
          switch (evt.type) {
            case 'blur':
              this.stopPreviewSound();
              //fall through
            case 'input':
              AudioManager.setAlarmVolume(
                AudioManager.systemVolumeToFloat(parseFloat(this.buttons.volume.value))
              );
              break;
          }
          break;
        case this.selects.timervibrate:
          switch (evt.type) {
            case 'blur':
              var timerVibrate = this.buttons.timervibrate.value === 'true';
              var lastTimerVibration = SettingsApp.getValue('timer.vibration');
              if (lastTimerVibration !== timerVibrate) {
                if (timerVibrate) {
                  navigator.vibrate([1000]);
                }
                SettingsApp.save('timer.vibration', timerVibrate);
                Utils.showToast('changes-saved');
              }
              break;
          }
          this.li.vibrate.focus();
          break;
      }
    },

    onFocusChanged: function(evt) {
      var elSoundSettings = document.getElementById('timersound-settings');
      if (elSoundSettings.style.visibility === 'visible') {
        var el = document.querySelector('.focus');
        var value = el.getAttribute('value');
        this.stopPreviewSound();
        this.previewSound(value);
      }

      this.setSoftkeyPanelVisible(this.li.volume.classList.contains('focus'));
    },

    setSoftkeyPanelVisible: function(add) {
      if (add) {
        OptionHelper.softkeyPanel.hide();
      } else {
        OptionHelper.softkeyPanel.show();
      }
    },

    onKeydown: function(evt) {
      switch (evt.key) {
        case 'ArrowLeft':
          this.adjustVolume(true);
          break;
        case 'ArrowRight':
          this.adjustVolume(false);
          break;
        default:
          break;
      }
    },

    isRtl: () => {
      return document.documentElement.dir === 'rtl' || document.dir === 'rtl';
    },

    adjustVolume: function(left) {
      var _value = parseInt(this.selects.alarmvolume.value);
      var max = parseInt(this.selects.alarmvolume.max);
      if (this.isRtl()) {
        left = !left;
      }
      if (left) {
        _value = (_value - 1) <= 0 ? 0 : _value - 1;
      } else {
        _value = _value >= max ? max : _value + 1;
      }

      AudioManager.setAlarmVolume(
        AudioManager.systemVolumeToFloat(parseFloat(_value))
      );
      this.previewSound(SettingsApp.getValue('alarm.sound'));
    },

    soundSelectSave: function(evt) {
      switch (evt.type) {
        case 'sound-save':
          var soundValue = evt.value;
          var soundSelect = evt.elSelect;
          var soundLabelData = soundValue.replace(/\./, '_' );
          var lastTimerSound = SettingsApp.getValue('timer.sound');
          this.stopPreviewSound();
          if (lastTimerSound !== soundValue) {
            Utils.showToast('changes-saved');
            SettingsApp.save('timer.sound', soundValue);
            Utils.soundLabelSet(soundLabelData, 'sound-label');
            Utils.soundRadioChecked(soundSelect, '.soundChecked');
          }
          this.backSettings();
          break;
      }
    },

    backSettings: function() {
      var elTimeSound = document.querySelector('#timersound-settings');
      var elSoundSelect = document.querySelector('#sound-select');
      var elSettingsTitle = document.querySelector('.settings-title');
      elSettingsTitle.setAttribute('data-l10n-id','clock-settings');
      elTimeSound.style.visibility = 'hidden';
      NavigationManager.reset('#settings-alarm li.navigation');
      NavigationManager.unfocus();
      NavigationManager.setFocus(elSoundSelect);
      OptionHelper.show('settings-alarm');
    },

    soundRadioInit: function(el) {
      var timersound = SettingsApp.getValue('timer.sound');
      if (timersound) {
        var soundSelect = el.querySelector('li[value="' + timersound + '"]');
        Utils.soundRadioChecked(soundSelect, '.soundChecked');
      }
    },

    soundSelectCancel: function(evt) {
      switch (evt.type) {
        case 'sound-select-cancel':
          this.stopPreviewSound();
          this.backSettings();
          break;
      }
    },

    soundSelectClick: function(evt) {
      switch (evt.type) {
        case 'sound-clicked':
          var el = document.querySelector('#timersound-settings');
          var elSettingsTitle = document.querySelector('.settings-title');
          var curLabel = document.querySelector('#sound-label').
            getAttribute('data-l10n-id');
          var soundLabels = document.querySelectorAll('#timersound-select ' +
            '.clsSoundLabel');
          var navId;

          el.style.visibility = 'visible';

          NavigationManager.prepareElements('#timersound-select li.navigation');

          for (let i = 0; i < soundLabels.length; i++) {
            if (curLabel === soundLabels[i].getAttribute('data-l10n-id')) {
              navId = soundLabels[i].parentNode.getAttribute('data-nav-id');
              break;
            }
          }

          NavigationManager.reset('#timersound-select li.navigation', navId);

          elSettingsTitle.setAttribute('data-l10n-id','sound');
          this.soundRadioInit(el);
          var elFocus = document.querySelector('.focus');
          var value = elFocus.getAttribute('value');
          this.previewSound(value);
          OptionHelper.show('sound-select');
          break;
      }
    },

    handleVisibilityChange: function aev_show(evt) {
      var isVisible = evt.detail.isVisible;
      if (!isVisible) {
        return;
      }

      AudioManager.requestAlarmVolume().then(function(volume) {
        this.setAlarmVolumeControls();
      }.bind(this));
      this.element.classList.toggle('settings');
      this.initTimerSoundSelect();
      this.initSnoozeSelect();
      this.initTimerVibrateSelect();
      location.hash = '#alarm-settings-panel';
    },

    handleAlarmVolumeChange: function() {
      this.setAlarmVolumeControls();
    },

    setAlarmVolume: function(systemVolume) {
      // Vertical meter popup dialog
      this.buttons.volume.value = systemVolume;
      this.inputs.alarmvolume.value = systemVolume;
      document.getElementById('settings-alarm-volume').textContent = systemVolume + '/' + this.buttons.volume.max;
    },

    setAlarmVolumeControls: function() {
      var floatSystemVolume = AudioManager.getAlarmVolume();
      var systemVolume = AudioManager.floatToSystemVolume(floatSystemVolume);
      this.setAlarmVolume(systemVolume);
    },

    initSnoozeSelect: function aev_initSnoozeSelect() {
      this.buttons.snooze.value = SettingsApp.getValue('alarm.snooze');
    },

    initTimerSoundSelect: function aev_initSoundSelect() {
      var timersound = SettingsApp.getValue('timer.sound');
      var soundLabel = document.getElementById('sound-label');
      if (timersound) {
      	timersound = timersound.replace(/\./, '_' );
        soundLabel.setAttribute('data-l10n-id', timersound);
      } else {
      	soundLabel.setAttribute('data-l10n-id', 'ac_woody_ogg');
      }
    },

    initTimerVibrateSelect: function aev_initTimerVibrateSelect() {
      this.buttons.timervibrate.value = SettingsApp.getValue('timer.vibration').toString();
    },

    getSnoozeSelect: function aev_getSnoozeSelect() {
      SettingsApp.save('alarm.snooze', this.buttons.snooze.value);
      return this.buttons.snooze.value;
    },

    previewSound: function aev_previewSound(ringtoneName) {
      this.ringtonePlayer.playRingtone(ringtoneName, false);
    },

    stopPreviewSound: function aev_stopPreviewSound() {
      this.ringtonePlayer.pause();
    },

  });
  return AlarmSettings;

});
