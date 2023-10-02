/**
 * Handle the brightness.
 *
 * @module SliderHandler
 */
define(['require'],function(require) {
  
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
      this._label = container.querySelector('div.score .before');
      this._value = this._element.value = this._label.textContent;
      this._container.addEventListener('keydown', this._keydownHandler.bind(this));
      this._setSliderValue(this._value);
    },

    _keydownHandler: function sh_keydownHandler(evt) {
      switch (evt.key) {
        case 'ArrowLeft':
          this._setSliderValue(this._value <= 0 ? 0 : Number(this._value) - 1);
          evt.preventDefault();
          break;
        case 'ArrowRight':
          this._setSliderValue(this._value >= 10 ? 10 : Number(this._value) + 1);
          evt.preventDefault();
          break;
        default:
          break;
      }
    },

    _setSliderValue: function sh_setSliderValue(value) {
      this._element.value = this._value = value;
      this._label.textContent = this._value;
      this._label.style.width = `${value/10*100}%`;
    }
  };

  return function ctor_sliderHandler() {
    return new SliderHandler();
  };
});
