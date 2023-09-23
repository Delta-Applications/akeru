define('template',['require'],function(require) {
  function ClockTemplate(text) {
    var srcNode = document.createElement('div');
    var comment = document.createComment(text);
    srcNode.appendChild(comment);
    return new Template(srcNode);
  }
return ClockTemplate;
});


define('text!picker/spinner.html',[],function () { return '<div class="picker-unit">${unit}</div>\n';});

define('picker/spinner',['require','template','text!picker/spinner.html'],function(require) {
  'use strict';

  var Template = require('template');
  var spinnerHtml = require('text!picker/spinner.html');

  // units covered per millisecond threshold to kick off inertia
  var SPEED_THRESHOLD = 0.01;

  // max units covered by inertia
  var INERTIA_MAXIMUM = 15;

  // not the same as animation duration, this accounts for "slowing down",
  // measured in miliseconds
  var INERTIA_DURATION = 300;

  // number of milliseconds after last motion without leting go
  // we will select whatever is being "hovered" and cancel momentum
  var DRAGGING_TIMEOUT = 200;

  function calculateSpeed(previous, current) {
    /* jshint validthis:true */
    var motion = (previous.y - current.y) / this.unitHeight;
    var delta = current.time - previous.time;
    var speed = motion / delta;

    return parseFloat(speed.toFixed(4)) || 0;
  }

  function Touch(touch = {}) {
    this.x = touch.x || 0;
    this.y = touch.y || 0;
    this.time = touch.time || 0;
  }

  /**
   * Spinner
   *
   * Create a select list spinner.
   *
   * @param {Object} setup An object containing setup data.
   *                       - element, a DOM element to create
   *                         the spinner with.
   *                       - values, an array of values to
   *                         populate the spinner with.
   *
   *
   * new Spinner({
   *   element: this.selector[picker],
   *   values: values
   * });
   *
   *
   */
  function Spinner(setup = {}) {
    // define some non writable properties
    Object.defineProperties(this, {
      value: {
        get: function() {
          return this.values[this.index];
        },
        set: function(value) {
          this.select(this.values.indexOf(value));
        }
      },
      unitHeight: {
        get: function() {
          return this.element.children[0].clientHeight;
        }
      },
      space: {
        get: function() {
          return this.unitHeight * this.length;
        }
      },
      container: {
        value: setup.element.parentNode
      },
      element: {
        value: setup.element
      },
      values: {
        value: setup.values
      },
      length: {
        value: setup.values.length
      },
      textValues: {
        value: setup.textValues || setup.values
      }
    });

    this.template = new Template(spinnerHtml);

    this.top = 0;
    this.index = 0;

    this.previous = new Touch();
    this.current = new Touch();

    this.timeout = null;

    var html = '';

    for (var i = 0; i < this.length; i++) {
      html += this.template.interpolate({
        // Coerce the number value to a string
        unit: this.values[i] + ''
      });
    }

    this.element.innerHTML = html;

    this.container.addEventListener('touchstart', this, false);
    this.container.addEventListener('pan', this, false);
    this.container.addEventListener('swipe', this, false);
    this.container.addEventListener('keypress', this, false);
    this.container.setAttribute('aria-valuemax', this.upper);
    this.container.setAttribute('aria-valuemin', this.lower);
    this.container.setAttribute('aria-valuenow', this.index);
    this.container.setAttribute('aria-valuetext', this.textValues[this.index]);

    this.reset();
  }

  Spinner.prototype.reset = function() {
    this.index = 0;
    this.top = 0;
    this.update();
  };

  Spinner.prototype.update = function() {
    this.container.setAttribute('aria-valuenow', this.index);
    this.container.setAttribute('aria-valuetext', this.textValues[this.index]);
    this.element.style.transform = 'translateY(' + this.top + 'px)';
  };

  Spinner.prototype.select = function(index) {

    index = Math.round(index);

    if (index < 0) {
      index = 0;
    }

    if (index > this.length - 1) {
      index = this.length - 1;
    }

    if (index !== this.index) {
      this.index = index;
    }

    this.top = -this.index * this.unitHeight;
    this.update();

    return index;
  };

  Spinner.prototype.handleEvent = function(event) {
    this['on' + event.type](event);
  };

  Spinner.prototype.stopInteraction = function() {
    this.element.classList.add('animation-on');

    clearTimeout(this.timeout);

    this.select(this.index);
    this.speed = 0;
  };

  /**
   * ontouchstart - prevent default action (stops scrolling)
   */
  Spinner.prototype.ontouchstart = function(event) {
    event.preventDefault();
  };

  Spinner.prototype.onpan = function(event) {
    event.stopPropagation();
    var position = event.detail.position;
    var diff;

    // If this is the first pan event after a swipe...
    if (this.element.classList.contains('animation-on')) {
      this.element.classList.remove('animation-on');

      this.select(this.index);

      this.previous.y = position.clientY;
      this.previous.time = position.timeStamp;
      return;
    }

    this.current.y = position.clientY;
    this.current.time = position.timeStamp;
    this.speed = calculateSpeed.call(this, this.previous, this.current);

    diff = this.current.y - this.previous.y;

    this.top = this.top + diff;

    if (this.top > 0) {
      this.top = 0;
    }
    if (this.top < -this.space) {
      this.top = -this.space;
    }

    this.index = Math.round(Math.abs(this.top) / this.unitHeight);
    this.update();

    clearTimeout(this.timeout);

    var stopInteraction = this.stopInteraction.bind(this);
    this.timeout = setTimeout(stopInteraction, DRAGGING_TIMEOUT);

    this.previous.y = this.current.y;
    this.previous.time = this.current.time;
  };

  Spinner.prototype.onswipe = function(event) {

    event.stopPropagation();

    // Add momentum if speed is higher than a given threshold.
    var direction = this.speed > 0 ? 1 : -1;
    var speed = this.speed / direction;
    if (speed >= SPEED_THRESHOLD) {
      this.index += Math.round(
        Math.min(speed * INERTIA_DURATION, INERTIA_MAXIMUM) * direction
      );
    }

    this.stopInteraction();

  };

  Spinner.prototype.onkeypress = function(event) {
    this.element.classList.add('animation-on');
    if (event.keyCode == KeyEvent.DOM_VK_DOWN) {
      this.select(this.index - 1);
    } else {
      this.select(this.index + 1);
    }
  };

  return Spinner;
});


/* globals define*/
define('picker/picker',['require','picker/spinner'],(require) => {
  const Spinner = require('picker/spinner');

  /**
   * Picker
   *
   * Create an inline "picker", comprised of n "spinners".
   *
   * @param {Object} setup An object containing setup data.
   *                       - element, The container element.
   *                       - pickers, an object whose properties
   *                         correspond to a Picker that will
   *                         be created.
   *
   *
   * new Picker({
   *   element: 'time-picker',
   *   pickers: {
   *     hours: {
   *       range: [0, 24],
   *       valueText: 'nSpinnerHours'
   *     },
   *     minutes: {
   *       range: [0, 60],
   *       isPadded: true,
   *       valueText: 'nSpinnerMinutes'
   *     },
   *     seconds: {
   *       range: [0, 60],
   *       isPadded: true,
   *       valueText: 'nSpinnerSeconds'
   *     }
   *   }
   * });
   *
   */
  function Picker(setup) {
    this.nodes = {};
    this.spinners = {};
    this.pickers = Object.keys(setup.pickers);

    [].forEach.call(this.pickers, (picker) => {
      const values = [];
      const { range } = setup.pickers[picker];
      const isPadded = setup.pickers[picker].isPadded || false;
      const { valueText } = setup.pickers[picker];
      const textValues = [];

      this.nodes[picker] = setup.element.querySelector(`.picker-${picker}`);
      // eslint-disable-next-line
      for (let i = range[0]; i <= range[1]; i++) {
        values.push(isPadded && i < 10 ? `0${i}` : `${i}`);
        if (valueText) {
          textValues.push(window.api.l10n.get(valueText, { n: i }));
        }
      }

      this.spinners[picker] = new Spinner({
        element: this.nodes[picker],
        values,
        textValues: textValues.length ? textValues : values
      });
    }, this);
  }

  Picker.prototype = {
    get value() {
      // Protect against uninitialized [[Get]] access
      if (typeof this.pickers === 'undefined') {
        return null;
      }
      // eslint-disable-next-line
      return this.pickers.map((picker) => this.spinners[picker].value, this).join(':');
    },

    set value(value) {
      // Protect against uninitialized [[Set]] access
      if (typeof this.pickers === 'undefined') {
        return null;
      }
      // eslint-disable-next-line
      let arr = value.split(':');
      [].forEach.call(arr, (value, i) => {
        this.spinners[this.pickers[i]].value = value;
      }, this);

      return this.value;
    },

    reset() {
      let arr = this.pickers;
      [].forEach.call(arr, (picker) => {
        this.spinners[picker].reset();
      }, this);
    }
  };

  return Picker;
});


define('text!panels/timer/panel.html',[],function () { return '<div id="timer-dialog" class="panel skin-dark">\n\n  <div id="value-selector">\n    <!-- Time Picker -->\n\n    <div id="time-picker" data-type="picker" class="hide">\n      <div class="picker-container timer-item">\n        <div class="picker-labels">\n          <div class="picker-label" id="hours" data-l10n-id="hours">\n            Hours\n          </div>\n          <div class="picker-label" id="minutes" data-l10n-id="minutes">\n            Minutes\n          </div>\n        </div>\n        <div class="picker-bar-background">\n        </div>\n        <div class="picker-hours-wrapper" role="spinbutton" aria-labelledby="hours">\n          <div class="picker-hours">\n          </div>\n        </div>\n        <div class="picker-minutes-wrapper" role="spinbutton" aria-labelledby="minutes">\n          <div class="picker-minutes">\n          </div>\n        </div>\n        <div class="value-indicator">\n          <div class="value-indicator-colon" aria-hidden="true">:</div>\n        </div>\n      </div>\n    </div>\n    <div id="kai-timer-time-display">\n\n      <div id="kai-timer-time">\n        <div id=\'kai-hours\' class="navigation inline nav-time" tabindex="0">00</div>\n        :\n        <div id=\'kai-minutes\' class="navigation inline nav-time" tabindex="0">00</div>\n        :\n        <div id=\'kai-seconds\' class="navigation inline nav-time" tabindex="0">00</div>\n      </div>\n      <div id="timer-time-label">\n        <div class="timer-label p-sec" data-l10n-id="hour"></div>\n        <div class="timer-label p-sec" data-l10n-id="minute"></div>\n        <div class="timer-label p-sec" data-l10n-id="second"></div>\n      </div>\n    </div>\n\n    <ul id="timer-edit" class="compact">\n      <li class="timer-item" style="display: none;">\n        <button id="timer-create" class="recommend" data-l10n-id="start">\n          Start\n        </button>\n      </li>\n    </ul>\n  </div>\n</div>\n<div id="timer-active">\n  <div id="timer-time-display">\n    <!-- <div id=\'kai-hours\' class="kai-timer-title">Hours</div>\n    <div id=\'kai-minutes\' class="kai-timer-title">Minutes</div>\n    <div id=\'kai-seconds\' class="kai-timer-title">Seconds</div> -->\n    <div id="timer-time">00:00:00</div>\n    <div id="timer-time-label">\n      <div class="timer-label p-sec" data-l10n-id="hour"></div>\n      <div class="timer-label p-sec" data-l10n-id="minute"></div>\n      <div class="timer-label p-sec" data-l10n-id="second"></div>\n    </div>\n    <menu id="timer-controls" style="display: none;">\n      <button id="timer-start" class="edit-button" data-l10n-id="resume">\n        Resume\n      </button>\n      <button id="timer-pause" class="edit-button" data-l10n-id="pause">\n        Pause\n      </button>\n      <button id="timer-cancel" class="danger" data-l10n-id="cancel">\n        Cancel\n      </button>\n    </menu>\n  </div>\n  <div id="timer-plus-time" style="display: none;">\n    <button id="timer-plus" data-value="60" data-l10n-id="plusMinute">\n      +1 Min\n    </button>\n  </div>\n</div>\n';});

define('panels/timer/main',['require','panel','picker/picker','view','timer','text!panels/timer/panel.html'],function(require) {
'use strict';

var Panel = require('panel');
var Picker = require('picker/picker');
var View = require('view');
NavigationManager.Utils = Utils;
var Timer = require('timer');
var html = require('text!panels/timer/panel.html');

var priv = new WeakMap();
const TIMER_REMAINING_MAX = 86340000;

function timeFromPicker(value) {
  var hm, ms;
  hm = value.split(':');
  ms = Utils.dateMath.toMS({
        hours: hm[0],
        minutes: hm[1],
        seconds: hm[2]
       });
  return ms;
}

/**
 * Timer.Panel
 *
 * Construct a UI panel for the Timer panel.
 *
 * @return {Timer.Panel} Timer.Panel object.
 *
 */
Timer.Panel = function(element) {
  Panel.apply(this, arguments);

  element.innerHTML = html;
  this.timer = null;
  this.isShowPlus = null;
  this.nodes = {};
  this.kaiPicker = this.element.querySelector('#kai-timer-time');
  this.picker = new Picker({
    element: this.element.querySelector('#time-picker'),
    pickers: {
      hours: {
        range: [0, 23],
        valueText: 'nSpinnerHours'
      },
      minutes: {
        range: [0, 59],
        isPadded: true,
        valueText: 'nSpinnerMinutes'
      }
    }
  });

  // Gather elements
  let timerArr1 = [
    'create', 'cancel', 'dialog', 'pause', 'start', 'time',
    'plus'
  ];
  [].forEach.call(timerArr1, (id) => {
    this.nodes[id] = this.element.querySelector('#timer-' + id);
  }, this);

  // Bind click events
  let timerArr2 = [
    'create', 'cancel', 'pause', 'start', 'plus'
  ];
  [].forEach.call(timerArr2, (action) => {
    var element = this.nodes[action];

    if (priv.has(element)) {
      priv.delete(element);
    }

    priv.set(element, {
      action: action,
      panel: this
    });

    element.addEventListener('click', this.onclick.bind(this), false);
  }, this);

  this.element.addEventListener('panel-visibilitychange',
                           this.onvisibilitychange.bind(this));

  // The start button is disable by default (picker at 00:00 by default)
  this.nodes.create.setAttribute('disabled', 'true');

  var create = this.nodes.create;
  var picker = this.picker;

  var enableButton = function() {
    if (timeFromPicker(picker.value) === 0) {
      create.setAttribute('disabled', 'true');
    } else {
      create.removeAttribute('disabled');
    }
  };

  // The start button is enable if the value of the timer is not 00:00
  picker.nodes.minutes.addEventListener('transitionend', enableButton);
  picker.nodes.hours.addEventListener('transitionend', enableButton);


  Timer.singleton(function(err, timer) {
    this.timer = timer;
    timer.onend = this.dialog.bind(this);
    timer.state = timer.duration ? (timer.startTime ? Timer.STARTED : Timer.PAUSED) : Timer.INITIAL;
    NavigationManager.navObjects.items.timer.timerObj.timer = timer;
    if (timer.duration) {
      NavigationManager.navObjects.items.timer.init();
    }
    if (this.visible) {
      // If the timer panel already became visible before we fetched
      // the timer, we must update the display to show the proper
      // timer status.
      this.onvisibilitychange({ detail: { isVisible: true } });
    }
  }.bind(this));

  var self = this;

  NavigationManager.navObjects.items.timer.onChanged = function (argument) {
    var t1 = timeFromPicker(self.kaiPicker.textContent);
    var t2 = 1000 * argument;
    var res = (t1 + t2) / 1000;
    if (res < 0 || res >= 24*60*60) { //range 0-23 Hours
      res = t1 / 1000;
    } else if (t2 == 0){
      self.kaiPicker.dataset.time = NavigationManager.Utils.format.hms(0);
      self.kaiPicker.classList.remove('focused');
      return;
    }

    self.kaiPicker.dataset.time = NavigationManager.Utils.format.hms(res);
    NavigationManager.navObjects.items.timer.initMenu('update', res);
    create.removeAttribute('disabled');
  }
};

Timer.Panel.prototype = Object.create(Panel.prototype);

Timer.Panel.prototype.onvisibilitychange = function(evt) {
  var isVisible = evt.detail.isVisible;
  var nodes = this.nodes;
  var timer = this.timer;

  if (isVisible) {
    // No active timer, or timer has expired...
    //  - Show the new timer dialog
    if (timer === null || timer.state === Timer.INITIAL) {
      this.dialog();
    } else {

      if (timer.state !== Timer.INITIAL) {
        // Active timer exists...

        if (timer.state === Timer.STARTED) {
          // Reviving to started state,
          // show the pause button, hide the start button
          this.toggle(nodes.pause, nodes.start);
        } else if (timer.state === Timer.PAUSED) {
          // Reviving to paused state,
          // show the start button, hide the pause button
          this.toggle(nodes.start, nodes.pause);
        }

        this.dialog({ isVisible: false });
        this.tick();
      }
    }
  }
};

/**
 * dialog Show or hide the Timer creation dialog.
 *
 * @param {Object} opts Optional parameters to show/hide dialog.
 *                      - isVisible, true|false (show|hide).
 *                        Defaults to true.
 *
 * @return {Object} Timer.Panel.
 */
Timer.Panel.prototype.dialog = function(opts = { isVisible: true }) {
  if (opts.isVisible) {
    window.cancelAnimationFrame(this.tickTimeout);
  }
  View.instance(this.nodes.dialog).visible = opts.isVisible;
  return this;
};

Timer.Panel.prototype.tick = function() {
  if (!this.timer || this.timer.remaining <= 0) {
    return;
  }
  this.update(this.timer.remaining);
  this.tickTimeout = window.requestAnimationFrame(this.tick.bind(this));
};

/**
 * Given milliseconds, render the time as a rounded-to-seconds
 * countdown.
 */
Timer.Panel.prototype.update = function(remaining = 0) {
  var newText = Utils.format.hms(Math.round(remaining / 1000), 'hh:mm:ss');
  // Use localized caching here to prevent unnecessary DOM repaints.
  if (this._cachedTimerText !== newText) {
    this.nodes.time.textContent = this._cachedTimerText = newText;

    this.isShowPlus = this.timer.remaining < TIMER_REMAINING_MAX;
    if (this.isShowPlus !== NavigationManager.timer.isShowPlus) {
      NavigationManager.timer.isShowPlus = this.isShowPlus;
      if (location.hash === '#timer-panel') {
        if(this.timer.state === Timer.STARTED) {
           NavigationManager.timer.setAndShowCurrentOptionMenu(
            this.isShowPlus ? 'timer-started' : 'timer-started-no-plus'
          );
        }
        if(this.timer.state === Timer.PAUSED) {
           NavigationManager.timer.setAndShowCurrentOptionMenu(
            this.isShowPlus ? 'timer-started' : 'timer-paused-no-plus'
          );
        }
      }
    }
  }
  return this;
};

/**
 * toggle Toggle any two UI elements with each other.
 *
 * @param  {Node} show The node to show.
 * @param  {Node} hide The node to hide.
 *
 * @return {Object} Timer.Panel.
 */
Timer.Panel.prototype.toggle = function(show, hide) {
  show.classList.remove('hidden');
  hide.classList.add('hidden');
  return this;
};

/**
 * Handler for panel bound UI 'click' events.
 *             (`this` context object is not Timer.Panel)
 *
 * @param  {Event} event The Event object.
 */
Timer.Panel.prototype.onclick = function(event) {
  var meta = priv.get(event.target);
  var value = event.target.dataset.value;
  var panel = meta.panel;
  var nodes = panel.nodes;
  var time;
  if (panel.timer && panel.timer[meta.action]) {
    if (typeof value !== 'undefined') {
      // meta.action === 'plus' => panel.timer.plus(+value);
      if (panel.timer.remaining > 100) {
        panel.timer[meta.action](+value);
        panel.update(panel.timer.remaining);
      }
    } else {
      // meta.action => panel.timer[meta.action]()
      //
      // ie.
      //
      // if start => panel.timer.start()
      // if pause => panel.timer.pause()
      // if cancel => panel.timer.cancel()
      //
      panel.timer[meta.action]();
    }

    if (meta.action === 'cancel' || meta.action === 'new') {
      // Restore the panel to configured duration
      panel.update(panel.timer.configuredDuration);

      // Show new timer dialog
      panel.dialog();
      window.cancelAnimationFrame(this.tickTimeout);
    }

    if (meta.action === 'start') {
      panel.toggle(nodes.pause, nodes.start);
      panel.tick();
    }

    if (meta.action === 'pause') {
      panel.toggle(nodes.start, nodes.pause);
      window.cancelAnimationFrame(this.tickTimeout);
    }
  } else {

    if (meta.action === 'create') {
      time = timeFromPicker(panel.kaiPicker.textContent);

      if (!time) {
        return;
      } else {
        panel.timer.duration = time;
      }

      panel.timer.sound = SettingsApp.getValue('timer.sound');
      panel.timer.vibrate = SettingsApp.getValue('timer.vibration');
      panel.timer.start();
      NavigationManager.navObjects.items.timer.timerObj.timer = panel.timer;
      panel.tick();

      // Update the UI
      panel.toggle(nodes.pause, nodes.start);

      // Hide the new timer dialog
      panel.dialog({ isVisible: false });

    }
  }
  panel.timer.commit(function(err, timer) {
    // NOOP: run after register/save
  });
};

return Timer.Panel;
});

