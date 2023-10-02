/**
 * Handle the brightness.
 *
 * @module SliderHandler
 */
define(['require','shared/settings_listener'],function(require) {
  
  var SettingsListener = require('shared/settings_listener');
  const SETTING_NAME = 'accessibility.volume_balance';
  const volumeBalanceStr =
    ['L5', 'L4', 'L3', 'L2', 'L1', '0', 'R1', 'R2', 'R3', 'R4', 'R5'];
  const SETTING_VALUE_DEFAULT = 50;

  var SliderHandler = function() {
    this._container = null;
    this._element = null;
    this._label = null;
    this._value = null;
  };

  SliderHandler.prototype = {
    init: function sh_init(container) {
      this._container = container;
      this._element = container.querySelector('input');
      this._label = container.querySelector('span.level');

      SettingsListener.observe(SETTING_NAME,
        SETTING_VALUE_DEFAULT, this._setSliderValue.bind(this));
      this._container.addEventListener('keydown',
          this._keydownHandler.bind(this));
    },

    _keydownHandler: function sh_keydownHandler(evt) {
      // Add support to RTL
      let isRtl = window.document.dir === 'rtl';
      let arrowLR = isRtl ? ['ArrowRight', 'ArrowLeft'] :
                            ['ArrowLeft', 'ArrowRight'];
      switch (evt.key) {
        case arrowLR[0]:
          this._saveVolumeBalance(this._value <= 0 ? 0 : this._value - 10);
          evt.preventDefault();
          break;

        case arrowLR[1]:
          this._saveVolumeBalance(this._value >= 100 ? 100 : this._value + 10);
          evt.preventDefault();
          break;

        default:
          break;
      }
    },

    _setSliderValue: function sh_setSliderValue(value) {
      this._element.value = this._value = value;
      // The slider is transparent if the value is not set yet, display it
      // once the value is set.
      if (this._element.style.opacity !== 1) {
        this._element.style.opacity = 1;
      }
      this._label.textContent = volumeBalanceStr[value/10];
    },

    _saveVolumeBalance: function sh_saveVolumeBalance(value) {
      var settingObject = {};
      settingObject[SETTING_NAME] = parseInt(value, 10);
      navigator.mozSettings.createLock().set(settingObject);
    },

  };

  return function ctor_sliderHandler() {
    return new SliderHandler();
  };
});
