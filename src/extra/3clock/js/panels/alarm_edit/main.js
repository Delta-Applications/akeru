// outer IIFE
define('form_button',['require'],function(require) {
'use strict';

 

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


define('text!panels/alarm_edit/panel.html',[],function () { return '<header id="alarm-header">\n  <h1 class="new-alarm-title" id="new-alarm-header" data-l10n-id="newAlarm"></h1>\n  <button id="alarm-done" data-l10n-id=""></button>\n</header>\n<section role="heading" aria-labelledby="new-alarm-header">\n  <ul id="edit-alarm" class="compact" role="menu">\n    <li id="new-time-select" class="navigation" role="menuitem" tabindex="0">\n      <label data-l10n-id="time" class="p-pri">Time</label>\n      <input id="time-select" aria-hidden="true" type="time" data-track-class="datatrack-time-selector-title"/>\n    </li>\n    <li id="new-repeat-select" class="navigation" role="menuitem" tabindex="0">\n      <label data-l10n-id="repeat" class="p-pri">Repeat</label>\n      <select id="repeat-select" multiple="true" data-track-class="datatrack-repeat-selector-title">\n        <!-- NOTE: These are reordered based upon the value for\n                   the l10n variable \'weekStartsOnMonday\'. -->\n        <option aria-hidden="true" value="monday" data-l10n-id="weekday-1-long">Monday</option>\n        <option aria-hidden="true" value="tuesday" data-l10n-id="weekday-2-long">Tuesday</option>\n        <option aria-hidden="true" value="wednesday" data-l10n-id="weekday-3-long">Wednesday</option>\n        <option aria-hidden="true" value="thursday" data-l10n-id="weekday-4-long">Thursday</option>\n        <option aria-hidden="true" value="friday" data-l10n-id="weekday-5-long">Friday</option>\n        <option aria-hidden="true" value="saturday" data-l10n-id="weekday-6-long">Saturday</option>\n        <option aria-hidden="true" value="sunday" id="repeat-select-sunday"\n                data-l10n-id="weekday-0-long">Sunday</option>\n      </select>\n    </li>\n    <li id="new-sound-select" class="navigation" role="menuitem" tabindex="0">\n      <label data-l10n-id="sound" class="p-pri">Sound</label>\n      <div id="new-timersound">\n        <label id="new-alarm-sound-label" data-l10n-id="ac_woody_ogg" class="p-sec">Woody</label>\n      </div>\n    </li>\n    <li id="new-vibrate-select" class="navigation" role="menuitem" tabindex="0">\n      <label data-l10n-id="vibrate" class="p-pri">Vibrate</label>\n      <select id="vibrate-select" data-track-class="datatrack-vibrate-selector-title">\n        <option aria-hidden="true" value="true" data-l10n-id="vibrateOn">On</option>\n        <option aria-hidden="true" value="false" data-l10n-id="vibrateOff">Off</option>\n      </select>\n    </li>\n    <li class="navigation alarm-name" role="menuitem" tabindex="0">\n      <label data-l10n-id="alarmName" class="p-sec">Alarm name</label>\n      <input type="text" name="alarm.label" id="alarm-name" data-l10n-id="alarm-name" placeholder="Alarm" maxLength="40" dir="auto"  class="p-pri"/>\n    </li>\n    <!-- <li id="delete-menu">\n      <button id="alarm-delete" class="danger full" data-l10n-id="delete">Delete</button>\n    </li> -->\n  </ul>\n</section>\n<section id="new-alarm-sound" role="heading" aria-labelledby="new-alarm-header">\n  <ul id="alarmnew-sound-ul" class="alarmNewSound" role="menu">\n    <li id="ac_africa" class="navigation" value="ac_africa.ogg" role="menuitem" tabindex="1">\n      <div class="clsNewSoundLabel" data-l10n-id="ac_africa_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li id="ac_amazon" class="navigation" value="ac_amazon.ogg" role="menuitem" tabindex="1">\n      <div class="clsNewSoundLabel" data-l10n-id="ac_amazon_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li id="ac_disco" class="navigation" value="ac_disco.ogg" role="menuitem" tabindex="1">\n      <div class="clsNewSoundLabel" data-l10n-id="ac_disco_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li id="ac_fairy_tales" class="navigation" value="ac_fairy_tales.ogg" role="menuitem" tabindex="1">\n      <div class="clsNewSoundLabel" data-l10n-id="ac_fairy_tales_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li id="ac_fresh" class="navigation" value="ac_fresh.ogg" role="menuitem" tabindex="1">\n      <div class="clsNewSoundLabel" data-l10n-id="ac_fresh_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li id="ac_galaxy" class="navigation" value="ac_galaxy.ogg" role="menuitem" tabindex="1">\n      <div class="clsNewSoundLabel" data-l10n-id="ac_galaxy_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li id="ac_kai" class="navigation" value="ac_kai.ogg" role="menuitem" tabindex="1">\n      <div class="clsNewSoundLabel" data-l10n-id="ac_kai_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li id="ac_techno" class="navigation" value="ac_techno.ogg" role="menuitem" tabindex="1">\n      <div class="clsNewSoundLabel" data-l10n-id="ac_techno_ogg"></div>\n      <div class="clsSoundBackIcon" data-icon="radio-off"></div>\n    </li>\n    <li id="ac_woody" class="navigation" value="ac_woody.ogg" role="menuitem" tabindex="1">\n      <div class="clsNewSoundLabel" data-l10n-id="ac_woody_ogg"></div>\n      <div class="clsSoundBackIcon soundChecked" data-icon="radio-on"></div>\n    </li>\n  </ul>\n</section>\n';});


/* global SettingsApp, define, Utils, Constants, NavigationManager, appStarter,
OptionHelper*/
define('panels/alarm_edit/main',['require','alarm','app','audio_manager','form_button','panel','text!panels/alarm_edit/panel.html'],(require) => {
  const Alarm = require('alarm');
  const App = require('app');
  const AudioManager = require('audio_manager');
  const FormButton = require('form_button');

  const Panel = require('panel');
  const _ = window.api.l10n.get;
  const html = require('text!panels/alarm_edit/panel.html');

  const AlarmEdit = function AlarmEdit() {
    // eslint-disable-next-line
    Panel.apply(this, arguments);
    this.element.innerHTML = html;

    const handleDomEvent = this.handleDomEvent.bind(this);

    this.element.addEventListener('panel-visibilitychange',
      this.handleVisibilityChange.bind(this));
    this.selects = {};
    let editArr1 = ['time', 'repeat', 'vibrate'];
    [].forEach.call(editArr1, (id) => {
      this.selects[id] = this.element.querySelector(`#${id}-select`);
    }, this);

    this.li = {};
    let editArr2 = ['time', 'repeat', 'sound', 'vibrate'];
    [].forEach.call(editArr2, (id) => {
      this.li[id] = this.element.querySelector(`#new-${id}-select`);
    }, this);

    this.inputs = {
      name: this.element.querySelector('#alarm-name')
    };

    this.headers = {
      header: this.element.querySelector('#alarm-header')
    };

    this.buttons = {};

    this.buttons.time = new FormButton(this.selects.time, {
      className: 'p-sec value',
      formatLabel(value) {
        const date = new Date();
        // This split(':') is locale-independent per HTML5 <input type=time>
        const splitValue = value.split(':');
        date.setHours(splitValue[0]);
        date.setMinutes(splitValue[1]);
        return Utils.getLocalizedTimeText(date);
      }
    });
    this.buttons.repeat = new FormButton(this.selects.repeat, {
      selectOptions: Constants.DAYS_STARTING_MONDAY,
      id: 'repeat-menu',
      className: 'p-sec value',
      formatLabel(daysOfWeek) {
        return Utils.summarizeDaysOfWeek(daysOfWeek, 'never');
      }
    });

    this.buttons.vibrate = new FormButton(this.selects.vibrate, {
      id: 'vibrate-menu',
      className: 'p-sec value',
      formatLabel(value) {
        return Utils.getOnOffValueText(value);
      }
    });

    this.scrollList = this.element.querySelector('#edit-alarm');
    this.sundayListItem = this.element.querySelector('#repeat-select-sunday');

    /*
     * When the system pops up the ValueSelector, it inadvertently
     * Messes with the scrollTop of the current panel. This is a
     * Workaround for bug 981255 until the Edit panel becomes a new
     * Window per bug 922651.
     */
    this.element.addEventListener('scroll', () => {
      this.element.scrollTop = 0;
    });

    /*
     * When the language changes, the value of 'weekStartsOnMonday'
     * Might change.
     */
    window.api.l10n.change(this.updateL10n.bind(this));

    this.headers.header.addEventListener('action', handleDomEvent);
    this.selects.time.addEventListener('blur', handleDomEvent);
    this.selects.vibrate.addEventListener('blur', handleDomEvent);
    this.selects.repeat.addEventListener('blur', handleDomEvent);
    this.selects.repeat.addEventListener('change', handleDomEvent);
    document.addEventListener('focusChanged', this.onFocusChanged.bind(this));
    window.addEventListener('new-sound-clicked',
      this.newsoundSelectClick.bind(this));
    window.addEventListener('new-alarm-sound-cancel',
      this.newAlarmsoundCancel.bind(this));
    window.addEventListener('new-alarm-sound-save',
      this.newAlarmsoundSave.bind(this));
    window.addEventListener('new-alarm-save', this.newAlarmSave.bind(this));
    // eslint-disable-next-line
    navigator.b2g.getFlipManager && navigator.b2g.getFlipManager().then((fm) => {
      fm.addEventListener('flipchange', this.onFlipChange.bind(this));
    });

    this.isSaving = false;
    this.selectVibrate = '';

    /*
     * If the phone locks during preview, or an alarm fires, pause the sound.
     * TODO: When this is no longer a singleton, unbind the listener.
     */
    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopPreviewSound();
        // Ensure the keyboard goes away.
        const element = document.activeElement;
        const { tagName } = element;
        if (tagName !== 'LI' && tagName !== 'INPUT') {
          element.blur();
        }
      }
    });
  };

  AlarmEdit.prototype = Object.create(Panel.prototype);

  Utils.extend(AlarmEdit.prototype, {

    alarm: null,
    ringtonePlayer: AudioManager.createAudioPlayer(),

    updateL10n() {

      /*
       * Move the weekdays around to properly account for whether the
       * week starts on Sunday or Monday.
       */
      const weekStartsOnMonday = parseInt(_('weekStartsOnMonday'), 10);
      const parent = this.sundayListItem.parentElement;
      if (weekStartsOnMonday) {
      // Sunday gets moved to the end.
        parent.appendChild(this.sundayListItem);
      } else {
      // Sunday goes first.
        parent.insertBefore(this.sundayListItem, parent.firstChild);
      }
    },

    /*
     * The name `handleEvent` is already defined by the Panel class, so this
     * Method must be named uniquely to avoid overriding that functionality.
     */
    handleDomEvent(evt) {
      evt.preventDefault();
      const input = evt.target;
      if (!input) {
        return;
      }

      switch (input) {
        case this.headers.header:
          App.showalarmPanel();
          break;
        case this.selects.time:
          this.focusLi();
          break;
        case this.selects.vibrate:
          switch (evt.type) {
            case 'blur':
              if (this.selectVibrate !== this.buttons.vibrate.value) {
                this.selectVibrate = this.buttons.vibrate.value;
                if (this.buttons.vibrate.value === 'true') {
                  navigator.vibrate([1000]);
                }
                Utils.showToast('changes-saved');
              }
              break;
            default: break;
          }
          setTimeout(() => {
            this.focusLi();
          }, 0);
          break;
        case this.selects.repeat:
          this.alarm.repeat = this.buttons.repeat.value;
          setTimeout(() => {
            this.focusLi();
          }, 0);
          break;
        default: break;
      }
    },

    focusLi() {
      this.element.querySelector('.focus').focus();
    },

    onFlipChange(event) {
      if (event.currentTarget.flipOpened) {
        this.scrollList.querySelector('.focus').focus();
      }
    },

    focusMenu(menu) {
      setTimeout(() => {
        menu.focus();
      }, 10);
    },

    onFocusChanged() {
      const navObj = window.NavigationManager
        .navObjects.getByName('alarm_edit');
      const elNewAlarmSound = document.getElementById('new-alarm-sound');
      const isVisibility = elNewAlarmSound.style.visibility === 'visible';
      if (navObj.selector === NavigationManager.currentSelector) {
        const el = document.querySelector('.focus input[type=text]');
        if (el) {
          OptionHelper.show('new-alarm-name');
        } else {
          OptionHelper.show('new-alarm');
        }
      } else if (isVisibility) {
        const el = document.querySelector('.focus');
        const value = el.getAttribute('value');
        this.stopPreviewSound();
        this.previewSound(value);
      }
    },

    handleVisibilityChange(evt) {
      const { isVisible } = evt.detail;
      let alarm = null;
      if (!isVisible) {
        return;
      }
      // `navData` is set by the App module in `navigate`.
      alarm = this.navData;
      // Scroll to top of form list
      this.scrollList.scrollTop = 0;

      this.element.classList.toggle('new', !alarm);
      const elHeader = document.querySelector('.new-alarm-title');
      if (this.element.classList.contains('new')) {
        elHeader.setAttribute('data-l10n-id', 'newAlarm');
      } else {
        elHeader.setAttribute('data-l10n-id', 'editAlarm');
      }
      this.alarm = new Alarm(alarm); // Alarm may be null
      this.alarm.sound = SettingsApp.getValue('alarm.sound');

      /*
       * Set to empty string if the Alarm doesn't have an ID,
       * Otherwise dataset will automatically stringify it
       * To be "undefined" rather than "".
       */
      this.element.dataset.id = this.alarm.id || '';
      this.inputs.name.value = this.alarm.label;

      // Init time, repeat, sound, vibrate selection menu.
      this.initTimeSelect();
      this.initRepeatSelect();
      this.initSoundSelect();
      this.initVibrateSelect();

      /*
       * Update the labels for any FormButton dropdowns that have
       * Changed, because setting <select>.value does not fire a change
       * Event.
       */
      // eslint-disable-next-line
      for (let key in this.buttons) {
        const button = this.buttons[key];
        if (button instanceof FormButton) {
          button.refresh();
        }
      }

      location.hash = '#alarm-edit-panel';
    },

    newAlarmSave() {
      App.showalarmPanel();
      this.save();
      if (typeof appStarter !== 'undefined') {
        appStarter.setCache(document.getElementById('alarms'));
      }
    },

    backEditAlarm() {
      const el = document.querySelector('#new-alarm-sound');
      const elHeader = document.querySelector('.new-alarm-title');
      el.style.visibility = 'hidden';
      if (this.element.classList.contains('new')) {
        elHeader.setAttribute('data-l10n-id', 'newAlarm');
      } else {
        elHeader.setAttribute('data-l10n-id', 'editAlarm');
      }
      NavigationManager.reset('#edit-alarm li.navigation');
      NavigationManager.unfocus();
      NavigationManager.setFocus(this.li.sound);
      OptionHelper.show('new-alarm');
    },

    newAlarmsoundSave(evt) {
      const soundValue = evt.value;
      const soundSelect = evt.elSelect;
      const soundLabelData = soundValue.replace(/\./u, '_');
      const lastTimerSound = this.alarm.sound;
      switch (evt.type) {
        case 'new-alarm-sound-save':
          this.stopPreviewSound();
          if (lastTimerSound !== soundValue) {
            Utils.showToast('changes-saved');
            this.alarm.sound = soundValue;
            Utils.soundLabelSet(soundLabelData, 'new-alarm-sound-label');
            Utils.soundRadioChecked(soundSelect, '.soundChecked');
          }
          this.backEditAlarm();
          break;
        default: break;
      }
    },

    soundRadioInit(el) {
      const newsound = this.alarm.sound;
      if (newsound) {
        const soundSelect = el.querySelector(`li[value="${newsound}"]`);
        Utils.soundRadioChecked(soundSelect, '.soundChecked');
      }
    },

    newAlarmsoundCancel(evt) {
      switch (evt.type) {
        case 'new-alarm-sound-cancel':
          this.stopPreviewSound();
          this.backEditAlarm();
          break;
        default: break;
      }
    },

    newsoundSelectClick(evt) {
      const el = document.querySelector('#new-alarm-sound');
      const elHeader = document.querySelector('.new-alarm-title');
      const curLabel = document.querySelector('#new-alarm-sound-label').
        getAttribute('data-l10n-id');
      const soundLabels = document.querySelectorAll('#alarmnew-sound-ul ' +
        '.clsNewSoundLabel');
      let navId = null;
      switch (evt.type) {
        case 'new-sound-clicked':
          elHeader.setAttribute('data-l10n-id', 'sound');
          el.style.visibility = 'visible';

          NavigationManager.prepareElements('#alarmnew-sound-ul li.navigation');

          for (let i = 0; i < soundLabels.length; i++) {
            if (curLabel === soundLabels[i].getAttribute('data-l10n-id')) {
              navId = soundLabels[i].parentNode.getAttribute('data-nav-id');
              break;
            }
          }

          NavigationManager.reset('#alarmnew-sound-ul li.navigation', navId);
          this.soundRadioInit(el);
          this.playFocusElSound();
          OptionHelper.show('new-alarm-sound');
          break;
        default: break;
      }
    },

    playFocusElSound() {
      const elFocus = document.querySelector('.focus');
      const value = elFocus.getAttribute('value');
      this.previewSound(value);
    },

    initTimeSelect() {
    // HTML5 <input type=time> expects 24-hour HH:MM format.
      const hour = parseInt(this.alarm.hour, 10);
      const minute = parseInt(this.alarm.minute, 10);
      this.buttons.time.value = `${(hour < 10 ? '0' : '') + hour
      }:${minute < 10 ? '0' : ''}${minute}`;
    },

    getTimeSelect() {
    // HTML5 <input type=time> returns data in 24-hour HH:MM format.
      const splitTime = this.buttons.time.value.split(':');
      return { hour: splitTime[0], minute: splitTime[1] };
    },

    initRepeatSelect() {
      this.buttons.repeat.value = this.alarm.repeat;
    },

    initSoundSelect() {
      const newsound = this.alarm.sound;
      const soundLabelData = newsound.replace(/\./u, '_');
      Utils.soundLabelSet(soundLabelData, 'new-alarm-sound-label');
    },

    initVibrateSelect() {
      this.buttons.vibrate.value = this.alarm.vibrate.toString();
      this.selectVibrate = this.buttons.vibrate.value;
    },

    getSoundSelect() {
      return this.alarm.sound;
    },

    previewSound(ringtoneName) {
      this.ringtonePlayer.playRingtone(ringtoneName, false);
    },

    stopPreviewSound() {
      this.ringtonePlayer.pause();
    },

    getRepeatSelect() {
      return this.buttons.repeat.value;
    },

    save(callback) {
      if (this.isSaving) {

        /*
         * Ignore double-taps on the "Save" button. When this view gets
         * refactored, we should opt for a more coherent way of managing
         * UI state to avoid glitches like this.
         */
        return;
      }
      this.isSaving = true;

      const { alarm } = this;

      if (this.element.dataset.id && this.element.dataset.id !== '') {
        alarm.id = parseInt(this.element.dataset.id, 10);
      } else {
        delete alarm.id;
      }

      alarm.label = this.inputs.name.value;

      const time = this.getTimeSelect();
      alarm.hour = time.hour;
      alarm.minute = time.minute;
      alarm.second = 0;
      alarm.repeat = this.buttons.repeat.value;
      alarm.sound = this.getSoundSelect();
      alarm.vibrate = this.buttons.vibrate.value === 'true';
      alarm.snooze = SettingsApp.getValue('alarm.snooze');

      // Save last selected real sound for using as a demo in volume control
      if (alarm.sound !== '0') {
        SettingsApp.save('alarm.sound', alarm.sound);
      }
      this.isSaving = false;
      alarm.schedule('normal').then(() => {
        window.dispatchEvent(new CustomEvent('alarm-changed', {
          detail: { alarm, showToast: true }
        }));
        // eslint-disable-next-line
        callback && callback(null, alarm);
      });
    }

  });

  return AlarmEdit;
});

