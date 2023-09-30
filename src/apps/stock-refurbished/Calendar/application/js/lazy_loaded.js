
define('views/current_time',['require','exports','module','view','calc','date_format','calc'],function(require, exports, module) {


var View = require('view');
var createDay = require('calc').createDay;
var dateFormat = require('date_format');
var getTimeL10nLabel = require('calc').getTimeL10nLabel;

var activeClass = View.ACTIVE;

function CurrentTime(options) {
  this._container = options.container;
  // timespan can be injected later! this is just a convenience
  this.timespan = options.timespan;
  this._sticky = options.sticky;
}
module.exports = CurrentTime;

CurrentTime.prototype = {
  _create: function() {
    if (this.element) {
      return;
    }

    this.element = document.createElement('div');
    this.element.setAttribute('aria-hidden', true);
    this.element.classList.add('md__current-time');
    this._container.appendChild(this.element);
  },

  refresh: function() {
    this._clearInterval();

    if (this._previousOverlap) {
      this._previousOverlap.classList.remove('is-hidden');
    }

    this._unmarkCurrentDay();
    this._hide();
    this.activate();
  },

  activate: function() {
    if (!this.timespan.containsNumeric(Date.now())) {
      this._maybeActivateInTheFuture();
      return;
    }

    this._create();
    this.element.classList.add(activeClass);
    this._tick();
  },

  _maybeActivateInTheFuture: function() {
    var now = Date.now();
    var diff = this.timespan.start - now;
    if (diff >= 0) {
      // if timespan is in the "future" we make sure it will start rendering
      // the current time as soon as it reaches 00:00:00 of the first day
      // inside timespan (eg. current time is 2014-05-22T23:59:50 and user is
      // viewing 2014-05-23 until past midnight)
      this._clearInterval();
      this._interval = setTimeout(this.activate.bind(this), diff);
    }
  },

  deactivate: function() {
    this._clearInterval();
    this._hide();
  },

  _hide: function() {
    if (this.element) {
      this.element.classList.remove(activeClass);
    }
  },

  destroy: function() {
    this.deactivate();
    if (this.element) {
      this._container.removeChild(this.element);
    }
  },

  _clearInterval: function() {
    if (this._interval) {
      clearTimeout(this._interval);
      this._interval = null;
    }
  },

  _tick: function() {
    this._clearInterval();
    var now = new Date();

    if (!this.timespan.contains(now)) {
      this.deactivate();
      this._unmarkCurrentDay();
      return;
    }
    this._render();

    // will call tick once per minute
    var nextTick = (60 - now.getSeconds()) * 1000;
    this._interval = setTimeout(this._tick.bind(this), nextTick);
  },

  _render: function() {
    var now = new Date();
    var format = getTimeL10nLabel('current-time');

    this.element.textContent = dateFormat.localeFormat(
      now,
      navigator.mozL10n.get('current-time')
    );

    this.element.dataset.date = now;
    this.element.dataset.l10nDateFormat = format;
    this.element.id = 'current-time-indicator';

    var hour = now.getHours();
    var elapsedMinutes = (hour * 60) + now.getMinutes();
    var totalMinutes = 24 * 60;
    var percentage = ((elapsedMinutes / totalMinutes) * 100);
    // we limit the position between 0.5-99.5% to avoid cropping the text
    this.element.style.top = Math.max(Math.min(percentage, 99.5), 0.5) + '%';

    this._markCurrentDay(now);
  },

  _intersect: function(displayHour) {
    var b1 = this.element.getBoundingClientRect();
    var b2 = displayHour.getBoundingClientRect();

    return (
      b1.left <= b2.right &&
      b2.left <= b1.right &&
      b1.top <= b2.bottom &&
      b2.top <= b1.bottom
    );
  },

  _markCurrentDay: function(date) {
    if (!this._sticky) {
      return;
    }

    var day = createDay(date);
    var selector = `.md__allday[data-date="${day}"] .md__day-name`;
    var header = this._sticky.querySelector(selector);

    if (header) {
      header.classList.add('is-today');
    }

    if (this._previousHeader !== header) {
      this._unmarkCurrentDay();
    }

    this._previousHeader = header;
  },

  _unmarkCurrentDay: function() {
    if (this._previousHeader) {
      this._previousHeader.classList.remove('is-today');
    }
  }
};

});

/* global Buffer */
define('querystring',['require','exports','module'],function(require, exports) {


// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}


function charCode(c) {
  return c.charCodeAt(0);
}


// a safe fast alternative to decodeURIComponent
exports.unescapeBuffer = function(s, decodeSpaces) {
  var out = new Buffer(s.length);
  var state = 'CHAR'; // states: CHAR, HEX0, HEX1
  var n, m, hexchar;

  for (var inIndex = 0, outIndex = 0; inIndex <= s.length; inIndex++) {
    var c = s.charCodeAt(inIndex);
    switch (state) {
      case 'CHAR':
        switch (c) {
          case charCode('%'):
            n = 0;
            m = 0;
            state = 'HEX0';
            break;
          case charCode('+'):
            if (decodeSpaces) {
              c = charCode(' ');
            }
            out[outIndex++] = c;
            break;
          default:
            out[outIndex++] = c;
        }
        break;

      case 'HEX0':
        state = 'HEX1';
        hexchar = c;
        if (charCode('0') <= c && c <= charCode('9')) {
          n = c - charCode('0');
        } else if (charCode('a') <= c && c <= charCode('f')) {
          n = c - charCode('a') + 10;
        } else if (charCode('A') <= c && c <= charCode('F')) {
          n = c - charCode('A') + 10;
        } else {
          out[outIndex++] = charCode('%');
          out[outIndex++] = c;
          state = 'CHAR';
          break;
        }
        break;

      case 'HEX1':
        state = 'CHAR';
        if (charCode('0') <= c && c <= charCode('9')) {
          m = c - charCode('0');
        } else if (charCode('a') <= c && c <= charCode('f')) {
          m = c - charCode('a') + 10;
        } else if (charCode('A') <= c && c <= charCode('F')) {
          m = c - charCode('A') + 10;
        } else {
          out[outIndex++] = charCode('%');
          out[outIndex++] = hexchar;
          out[outIndex++] = c;
          break;
        }
        out[outIndex++] = 16 * n + m;
        break;
    }
  }

  // TODO support returning arbitrary buffers.

  return out.slice(0, outIndex - 1);
};


exports.unescape = function(s, decodeSpaces) {
  return exports.unescapeBuffer(s, decodeSpaces).toString();
};


exports.escape = function(str) {
  return encodeURIComponent(str);
};

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};


exports.stringify = exports.encode = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return Object.keys(obj).map(function(k) {
      var ks = exports.escape(stringifyPrimitive(k)) + eq;
      if (Array.isArray(obj[k])) {
        return obj[k].map(function(v) {
          return ks + exports.escape(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + exports.escape(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) {
    return '';
  }
  return exports.escape(stringifyPrimitive(name)) + eq +
         exports.escape(stringifyPrimitive(obj));
};

// Parse a key=val string.
exports.parse = exports.decode = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    try {
      k = decodeURIComponent(kstr);
      v = decodeURIComponent(vstr);
    } catch (e) {
      k = exports.unescape(kstr, true);
      v = exports.unescape(vstr, true);
    }

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (Array.isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

});

define('utils/dom',['require','exports','module'],function(require, exports) {


/**
 * Gets the element absolute offset top relative to the window top.
 */
exports.absoluteOffsetTop = function(el) {
  var top = 0;
  while (el) {
    var pos = window.getComputedStyle(el).position;
    if (pos === 'absolute' || pos === 'relative') {
      top += el.offsetTop;
    }
    el = el.parentElement;
  }
  return top;
};

/**
 * Gets the closest (parent) element that matches the given selector.
 */
exports.closest = function(el, selector) {
  while (el) {
    if (matches(el, selector)) {
      return el;
    }
    el = el.parentElement;
  }
};

function matches(el, selector) {
  // "matches" is only unprefixed on Fx 34
  return 'matches' in el ?
    el.matches(selector) :
    el.mozMatchesSelector(selector);
}

});

define('views/hour_double_tap',['require','exports','module','querystring','utils/dom','utils/dom','calc'],function(require, exports, module) {


// this will be replaced later for a better logic (see Bug 992728) but it was
// too much to do in a single patch, so for now we do a simple double tap
// without any visual feedback (similar to the old day view behavior)

var QueryString = require('querystring');
var absoluteOffsetTop = require('utils/dom').absoluteOffsetTop;
var closest = require('utils/dom').closest;
var createDay = require('calc').createDay;

function HourDoubleTap(options) {
  this.app = options.app;
  this.main = options.main;
  this.daysHolder = options.daysHolder;
  this.alldaysHolder = options.alldaysHolder;
  this.hourHeight = options.hourHeight;

  this._onDayTap = this._onDayTap.bind(this);
  this._onAllDayTap = this._onAllDayTap.bind(this);
  this.removeAddEventLink = this.removeAddEventLink.bind(this);
}
module.exports = HourDoubleTap;

HourDoubleTap.prototype = {

  _isActive: false,

  _addEventLink: null,

  setup: function() {
    this._mainOffset = absoluteOffsetTop(this.main);
    this.daysHolder.addEventListener('click', this._onDayTap);
    this.alldaysHolder.addEventListener('click', this._onAllDayTap);
  },

  destroy: function() {
    this.removeAddEventLink();
    this.daysHolder.removeEventListener('click', this._onDayTap);
    this.alldaysHolder.removeEventListener('click', this._onAllDayTap);
  },

  _onDayTap: function(evt) {
    var target = evt.target;
    if (!target.classList.contains('md__day')) {
      return;
    }

    var y = evt.clientY + this.main.scrollTop - this._mainOffset;
    var hour = Math.floor(y / this.hourHeight);
    var baseDate = new Date(target.dataset.date);

    this._onTap(target, {
      startDate: addHours(baseDate, hour).toString(),
      endDate: addHours(baseDate, hour + 1).toString()
    }, hour);
  },

  _onAllDayTap: function(evt) {
    var target = evt.target;
    if (!target.classList.contains('md__allday-events')) {
      return;
    }

    var startDate = new Date(closest(target, '.md__allday').dataset.date);

    this._onTap(target, {
      isAllDay: true,
      startDate: startDate.toString(),
      endDate: createDay(startDate, startDate.getDate() + 1).toString()
    }, null, evt.mozInputSource);
  },

  _onTap: function(container, data, hour, source) {
    hour = hour || 0;

    if (this._addEventLink) {
      this.removeAddEventLink();
      return;
    }

    var link = document.createElement('a');
    link.href = '/event/add/?' + QueryString.stringify(data);
    link.className = 'md__add-event gaia-icon icon-newadd';
    link.dataset.l10nId = 'multi-day-new-event-link';
    link.style.top = (hour * this.hourHeight) + 'px';
    link.style.opacity = 0;

    link.addEventListener('click', this.removeAddEventLink);

    container.appendChild(link);
    this._addEventLink = link;

    // Initiated by a screen reader on double tap.
    if (source === 0) {
      link.click();
      return;
    }

    // opacity will trigger transition, needs to happen after nextTick
    setTimeout(() => {
      this._addEventLink && (this._addEventLink.style.opacity = 1);
    });
  },

  removeAddEventLink: function() {
    var link = this._addEventLink;
    if (!link) {
      return;
    }

    link.removeEventListener('click', this.removeAddEventLink);

    link.addEventListener('transitionend', function onTransitionEnd() {
      link.removeEventListener('transitionend', onTransitionEnd);
      link.parentNode && link.parentNode.removeChild(link);
    });
    link.style.opacity = 0;

    this._addEventLink = null;
  }

};

function addHours(date, hourDiff) {
  var result = new Date(date);
  result.setHours(result.getHours() + hourDiff);
  return result;
}

});

// this module is responsible for the touch/panning of MultiDay views
define('views/pan',['require','exports','module','ext/eventemitter2','utils/mout','utils/mout','utils/mout'],function(require, exports, module) {


var EventEmitter2 = require('ext/eventemitter2');
var clamp = require('utils/mout').clamp;
var lerp = require('utils/mout').lerp;
var norm = require('utils/mout').norm;

function Pan(options) {
  EventEmitter2.call(this);

  this.eventTarget = options.eventTarget;
  this.targets = options.targets;
  this.overflows = options.overflows || [];

  this._gridSize = Math.max(options.gridSize || 0, 1);
  this._visibleCells = Math.max(options.visibleCells || 0, 1);
  this._startMouseX = this._startMouseY = 0;
  this._isVertical = false;
  this._startTime = 0;
  this._touchStart = 0;
  this._dx = 0;

  // _lockedAxis is used to control if we detected if the movement is
  // vertical/horizontal, very important for ignoring clicks and also to be
  // able to set a threshold for the axis detection
  this._lockedAxis = false;

  this._onTouchStart = this._onTouchStart.bind(this);
  this._onTouchMove = this._onTouchMove.bind(this);
  this._onTouchEnd = this._onTouchEnd.bind(this);
  this._tick = this._tick.bind(this);
  this._setBaseValues = this._setBaseValues.bind(this);
  this._onTweenEnd = null;
}
module.exports = Pan;

Pan.prototype = {
  __proto__: EventEmitter2.prototype,

  TRANSITION_DURATION: 800,

  setup: function() {
    var element = this.eventTarget;
    element.addEventListener('touchstart', this._onTouchStart);
    element.addEventListener('touchmove', this._onTouchMove);
    element.addEventListener('touchend', this._onTouchEnd);
    element.addEventListener('touchcancel', this._onTouchEnd);
    window.addEventListener('localized', this._setBaseValues);
    this._setBaseValues();
  },

  _setBaseValues: function() {
    var delta = this._gridSize * this._visibleCells;

    if (document.documentElement.dir === 'rtl') {
      this._dir = -1;
      this._minX = 0;
      this._maxX = delta * 2;
    } else {
      this._dir = 1;
      this._minX = delta * -2;
      this._maxX = 0;
    }

    this._origX = this._startX = this._curX = this._destX = delta * -this._dir;
    this._set(this._origX);
  },

  _onTouchStart: function(evt) {
    this._startMouseX = evt.touches[0].clientX;
    this._startMouseY = evt.touches[0].clientY;
    this._isVertical = false;
    this._lockedAxis = false;
    this._touchStart = Date.now();
    // we need to reset the tween callback because we should only call it
    // once and only if user did not trigger a new touch
    this._onTweenEnd = null;
  },

  _onTouchMove: function(evt) {
    if (this._isVertical) {
      return;
    }

    var dx = this._startMouseX - evt.touches[0].clientX;
    var dy = this._startMouseY - evt.touches[0].clientY;
    this._dx = dx;

    if (!this._lockedAxis) {
      var adx = Math.abs(dx);
      var ady = Math.abs(dy);

      // we wait until we are sure movement is horizontal before we do anything.
      // if absolute difference between x/y movement is over a threshold (10px)
      // we assume drag follows a single axis.
      if (Math.abs(adx - ady) < 10) {
        return;
      }

      this._isVertical = adx < ady;
      this._lockedAxis = true;

      this.emit('start');

      if (this._isVertical) {
        return;
      }

      // we should only lock scroll once and only if dragging horizontally
      this._lockScroll();
    }

    this._updateDestination(this._origX - dx, 0);
  },

  _lockScroll: function() {
    this.overflows.forEach(el => el.style.overflowY = 'hidden');
  },

  _unlockScroll: function() {
    this.overflows.forEach(el => el.style.overflowY = 'scroll');
  },

  _updateDestination: function(x, duration) {
    duration = duration != null ? duration : this.TRANSITION_DURATION;

    this._startX = this._curX;
    this._destX = clamp(x, this._minX, this._maxX);

    var now = Date.now();
    this._endTime = now + duration;

    if (!this._requestId) {
      this._startTime = now;
      this._tween();
    }
  },

  _tween: function() {
    this._requestId = window.requestAnimationFrame(this._tick);
  },

  _tick: function() {
    var t = norm(Date.now(), this._startTime, this._endTime);

    if (t >= 1 || this._curX === this._destX) {
      this._killTween();
      this._set(this._destX);
      return;
    }

    var x = lerp(ease(t), this._startX, this._destX);
    this._set(x);
    this._tween();
  },

  _killTween: function() {
    if (this._requestId) {
      window.cancelAnimationFrame(this._requestId);
      this._requestId = null;
    }
    this._onTweenEnd && this._onTweenEnd.call(this);
  },

  _onTouchEnd: function() {
    // if touch is very fast momentum would be bigger than our threshold,
    // this is very important for click events otherwise they wouldn't open
    // the event details
    if (this._isVertical || !this._lockedAxis) {
      this._unlockScroll();
      return;
    }

    var duration = Date.now() - this._touchStart;
    var momentum = Math.abs(this._dx) / duration;
    var snap;

    if (momentum > 0.5) {
      // if the drag was fast we consider it as a swipe (move multiple cells
      // at once)
      var direction = this._dx > 0 ? -1 : 1;
      snap = this._origX + (direction * this._gridSize * this._visibleCells);
    } else {
      // we only round up if very close to the next column, this behavior is
      // better for the user than a regular round/ceil/floor
      snap = Math.round((this._destX / this._gridSize) + 0.2) *
        this._gridSize;
    }

    // we only unlock the scroll after the tween is complete to make multiple
    // consecutive swipes faster (also avoids flickering y-axis position)
    this._onTweenEnd = this._unlockScroll;
    this._updateDestination(snap);

    this.emit('release', {
      diff: Math.round((this._origX - this._destX) / this._gridSize) * this._dir
    });
  },

  _set: function(x) {
    x = clamp(x, this._minX, this._maxX);
    this.targets.forEach(el => {
      el.style.transform = 'translateX(' + x +'px)';
    });
    this._curX = x;
  },

  refresh: function() {
    var diff = Math.abs(this._curX - this._destX);
    diff *= this._curX < this._destX ? -1 : 1;

    // we update the position based on the relative distance to keep a smooth
    // transition
    if (diff) {
      this._set(this._origX + diff);
      this._updateDestination(this._origX);
    } else {
      this._set(this._origX);
    }
  }

};

// borrowed from zeh/ztween (expoOut)
function ease(t) {
  return (t >= 0.999) ? 1 : 1.001 * (-Math.pow(2, -10 * t) + 1);
}

});

/**
 * The interval tree is a structure
 * designed and optimized for storing
 * (possibly) overlapping intervals in
 * such a way that we can optimally query them.
 *
 * To store an item in the tree the item
 * must have `START`, `END` and `_id` properties
 * both properties must be numeric and start
 * must always be < then end. ID should be unique
 * to each interval though it should be possible
 * to store multiple intervals with the same
 * start/end times.
 *
 * Trees should be created by providing an
 * array of items sorted by their start
 * times.
 *
 *
 *    // _start is a constant see below
 *    var list = [
 *      { start: 100, end: 200 },
 *      { start: 120, end: 150 },
 *      ...
 *    ];
 *
 *    var tree = new Calendar.Node(list);
 *
 *
 * The tree _should-be_ dynamic and you can add and
 * remove items from the tree.
 *
 * For the present the tree will rebuild itself
 * after add/removal before the next query operation.
 *
 *
 *    tree.add({ start: 0, end: 50 });
 *
 *    // record should be === to record
 *    // stored in the tree.
 *    tree.remove(savedRecord);
 *
 *
 * TODO: Implement self-balancing and real tree mutations.
 */
define('interval_tree',['require','exports','module','binsearch','compare','debug'],function(require, exports, module) {


var binsearch = require('binsearch');
var compare = require('compare');
var debug = require('debug')('interval_tree');

const START = '_startDateMS';
const END = '_endDateMS';

function compareObjectStart(a, b) {
  return compare(a[START], b[START]);
}

function compareObjectEnd(a, b) {
  return compare(a[END], b[END]);
}

IntervalTree.compareObjectStart = compareObjectStart;
IntervalTree.compareObjectEnd = compareObjectEnd;

/**
 * Internal function to create an endpoint
 * list. Assumed this is the array to insert
 * endpoint values into.
 *
 * @param {Object} item object with [START] & [END] properties.
 */
function buildEndpoints(item) {
  /*jshint validthis:true */
  addOrdered(item[START], this);
  addOrdered(item[END], this);
}

function Node() {
  this.list = [];
}

Node.prototype = {

  /**
   * Node to the left null or a node.
   */
  left: null,

  /**
   * Node to the right null or a node.
   */
  right: null,

  /**
   * List of objects that overlap current node.
   *
   * @type Array
   */
  list: null,

  /**
   * Center point of this node.
   */
  median: null,

  /**
   * Highest value of this node & subnodes.
   */
  max: null,

  /**
   * Iterates through matching items.
   * Will be roughly ordered by start
   * time but exact sort order is not
   * guaranteed.
   *
   * @param {Calendar.Timespan} span timespan.
   * @param {Function} callback first argument is matching
   *                            record second is the node in the
   *                            tree where record was found.
   */
  traverse: function(span, fn) {
    if (this.left && (span.start < this.median)) {
      this.left.traverse(span, fn);
    }

    var i = 0;
    var len = this.list.length;
    var item;

    for (; i < len; i++) {
      item = this.list[i];

      if (item[START] > span.end) {
        break;
      }

      if (span.overlaps(item[START], item[END])) {
        fn(item, this);
      }
    }

    if (this.right && span.end > this.median) {
      this.right.traverse(span, fn);
    }
  },

  /**
   * Find all overlapping records via a Calendar.Timespan.
   *
   * @param {Calendar.Timespan} span timespan.
   * @return {Array} results sorted by start time.
   */
  query: function(span) {
    var results = [];
    var seen = Object.create(null);

    this.traverse(span, function(item) {
      ///XXX: we probably want to order
      // these by start time via bin search
      // order by sort at the end.
      if (!seen[item._id]) {
        results.push(item);
      }
    });

    return results;
  }

};

IntervalTree.Node = Node;

/**
 * Start point for creation of the tree
 * this is optimized for the most balanced tree
 * when possible. The idea is the majority of
 * operations will be read and traversal.
 *
 * NOTE: Currently we discard the tree and
 * mark the object as synced=false after mutations
 * The next time the object is queried the tree is rebuilt.
 */
function IntervalTree(list) {
  if (typeof(list) === 'undefined') {
    this.items = [];
  } else {
    this.items = list.concat([]);
  }

  /**
   * Properties to index by when fields are added.
   */
  this._indexes = Object.create(null);

  // method aggregates
  this._indexOnAdd = [];
  this._indexOnRemove = [];

  this.byId = Object.create(null);
  this.synced = false;
}
module.exports = IntervalTree;

IntervalTree.prototype = {

  START: START,
  END: END,

  build: function() {
    if (!this.synced) {
      this.rootNode = this._nodeFromList(this.items);
      this.synced = true;
    }
  },

  toArray: function() {
    // create a copy of the items array
    return this.items.concat();
  },

  _getId: function(item) {
    return item._id;
  },

  /**
   * Returns all values in the given index.
   *
   * @param {String} property name of index.
   * @param {String} [value] to filter index on (optional).
   * @return {Null|Array}
   */
  index: function(property, value) {
    var items = this._indexes[property];

    if (items && value) {
      return items[value];
    }

    return items;
  },

  /**
   * Create index on property.
   *
   * @param {String} property to index on.
   */
  createIndex: function(property) {
    var index = this._indexes[property] = {};

    // remember this will be invoked later with the context
    // of |this| always...
    function addToIndex(object) {
      var value = object[property];

      // create array for index possibilities
      if (!index[value]) {
        index[value] = [];
      }

      // and push single object to index
      index[value].push(object);
    }

    function removeFromIndex(object) {
      // object given should always be same instance stored.
      var value = object[property];
      var valueGroup = index[value];

      if (valueGroup) {
        var idx = valueGroup.indexOf(object);
        valueGroup.splice(idx, 1);
        if (valueGroup.length === 0) {
          delete index[value];
        }
      }
    }

    this._indexOnAdd.push(addToIndex);
    this._indexOnRemove.push(removeFromIndex);
  },

  /**
   * Adds an item to the tree
   */
  add: function(item) {
    var id = this._getId(item);

    if (id in this.byId) {
      return;
    }


    if (!item[START] && item.startDate) {
      item[START] = item.startDate.valueOf();
    }

    if (!item[END] && item.endDate) {
      item[END] = item.endDate.valueOf();
    }

    if (!item[START] || !item[END]) {
      return debug('Invalid input skipping record: ', item);
    }

    var idx = binsearch.insert(
      this.items,
      item,
      compareObjectStart
    );

    this.items.splice(idx, 0, item);
    this.byId[id] = item;
    this.synced = false;

    var len = this._indexOnAdd.length;
    for (var i = 0; i < len; i++) {
      this._indexOnAdd[i].call(this, item);
    }

    return item;
  },

  indexOf: function(item) {
    var query = {};
    query[START] = item[START];
    var idx = binsearch.find(
      this.items,
      query,
      compareObjectStart
    );

    var prevIdx;
    var current;

    if (idx !== null) {
      // we want to start idx at earliest
      // point in list that matches start time.
      // When there are multiple start times
      // the binsearch may start us at any point
      // in the range of matching items.


      // Iterate backwards.
      if (idx > 0) {
        prevIdx = idx;
        while (prevIdx > -1) {
          prevIdx--;
          current = this.items[prevIdx];
          if (current && current[START] === item[START]) {
            if (current === item) {
              return prevIdx;
            }
          } else {
            break;
          }
        }
      }

      //Iterate forwards.
      current = this.items[idx];
      while (current) {
        if (current === item) {
          return idx;
        }

        current = this.items[++idx];

        if (!current || current[START] !== item[START]) {
          return null;
        }
      }
    }

    return null;
  },

  /**
   * Removes an item to the list.
   * Must be same === item as as the
   * one you are trying to remove.
   */
  remove: function(item) {

    var idx = this.indexOf(item);

    if (idx !== null) {
      this._removeIds(this.items[idx]);

      this.items.splice(idx, 1);
      this.synced = false;
      return true;
    }

    return false;
  },

  _removeIds: function(item) {
    if (Array.isArray(item)) {
      item.forEach(this._removeIds, this);
    } else {
      var len = this._indexOnRemove.length;
      for (var i = 0; i < len; i++) {
        this._indexOnRemove[i].call(this, item);
      }

      var id = this._getId(item);
      delete this.byId[id];
    }
  },

  /**
   * Remove all intervals that start
   * after a particular time.
   *
   *    // assume we have a list of the
   *    // following intervals
   *    1-2 4-10 5-10 6-8 8-9
   *
   *    tree.removeFutureIntervals(5);
   *
   *    // now we have: 1-2, 4-10 5-10
   *
   * @param {Numeric} start last start point.
   */
  removeFutureIntervals: function(start) {
    var query = {};
    query[START] = start;

    var idx = binsearch.insert(
      this.items,
      query,
      compareObjectStart
    );

    var max = this.items.length - 1;

    if (!this.items[idx]) {
      return;
    }


    // for duplicate values we need
    // to find the very last one
    // before the split point.
    while (this.items[idx] && this.items[idx][START] <= start) {
      idx++;
      if (idx === max) {
        break;
      }
    }

    this.synced = false;
    var remove = this.items.splice(
      idx, this.items.length - idx
    );

    this._removeIds(remove);
    return remove;
  },

  /**
   * Remove all intervals that end
   * before a particular time.
   *
   * For example is you have:
   *
   *    // assume we have a list of the
   *    // following intervals
   *    1-10, 2-3, 3-4, 4-5
   *
   *    tree.removePastIntervals(4);
   *
   *    // now we have: 1-10, 4-5
   *
   * @param {Numeric} end last end point.
   */
  removePastIntervals: function(end) {
    // 1. first re-sort to end dates.
    var items = this.items.sort(compareObjectEnd);

    // 2. find index of the last date ending
    // on or before end.
    var endQuery = {};
    endQuery[END] = end;
    var idx = binsearch.insert(
      items,
      endQuery,
      compareObjectEnd
    );

    var max = items.length - 1;

    if (!items[idx]) {
      return;
    }

    // for duplicate values we need
    // to find the very last one
    // before the split point.
    while (items[idx][END] <= end) {
      idx++;
      if (idx === max) {
        break;
      }
    }

    this.synced = false;
    var remove = items.slice(0, idx);
    this.items = items.slice(idx).sort(
      compareObjectStart
    );

    this._removeIds(remove);

    return remove;
  },

  /**
   * Executes a query on all nodes.
   * Rebuilds tree if in unclean state first.
   *
   * @param {Calendar.Timespan} span timespan.
   */
  query: function(span) {
    this.build();
    return this.rootNode.query(span);
  },

  _nodeFromList: function(list) {
    var rootNode = new Node();

    var left = [];
    var right = [];

    var median;
    var endpoints = [];

    //1. build endpoints to calculate median
    //   endpoints are the middle value of
    //   all start/end points in the current list.
    list.forEach(buildEndpoints, endpoints);
    median = rootNode.median = endpoints[Math.floor(endpoints.length / 2)];

    list.forEach(function(item) {

      if (item[END] < median) {
        left.push(item);
      } else if (item[START] > median) {
        right.push(item);
      } else {
        rootNode.list.push(item);
      }
    }, this);

    // recurse - create left/right nodes.
    if (left.length) {
      rootNode.left = this._nodeFromList(left);
    }

    if (right.length) {
      rootNode.right = this._nodeFromList(right);
    }

    return rootNode;
  }
};

/**
 * Internal function to add an item
 * to an array via binary search insert.
 * Keeps items in order as they are inserted.
 *
 * @private
 */
function addOrdered(item, array) {
  var idx = binsearch.insert(
    array,
    item,
    compare
  );

  array.splice(idx, 0, item);
}

});

/**
 * Representation of conflicts over a span of time, organized into
 * non-overlapping columns tracked by IntervalTree instances.
 */
define('conflict_span',['require','exports','module','interval_tree','timespan'],function(require, exports, module) {


var IntervalTree = require('interval_tree');
var Timespan = require('timespan');

// Smallest gap interval to use in splitting conflict spans
var MIN_SPLIT_INTERVAL = 5 * 60 * 1000;  // 5 minutes

// Auto-increment ID for instances
var _id = 0;

const DAY_VIEW_DISPLAY_LIMIT = 35;

function ConflictSpan(parent) {
  this.id = (_id++);
  this.parent = parent;
  this.startTime = null;
  this.endTime = null;
  this.all = new IntervalTree();
  this.columnsByID = {};
  this.columns = [];
  this.addColumn();
}
module.exports = ConflictSpan;

ConflictSpan.prototype = {
  /**
   * Get a list of all the busytime IDs in this span.
   *
   * @return {Array} List of all the busytime IDs.
   */
  getIDs: function() {
    return Object.keys(this.all.byId);
  },

  /**
   * Add a new column tracked by an IntervalTree
   *
   * @return {Object} IntervalTree tracking the column.
   */
  addColumn: function() {
    var tree = new IntervalTree();
    this.columns.push(tree);
    return tree;
  },

  /**
   * Find a column where the given busytime fits without conflict, adding a
   * new column if necessary.
   *
   * @param {Object} busytime full busytime object.
   * @return {Object} IntervalTree column that can accept the busytime.
   */
  findColumn: function(busytime, skipAdd) {
    var column = null;
    var span = new Timespan(busytime._startDateMS, busytime._endDateMS);
    for (var i = 0; i < this.columns.length; i++) {
      var curr = this.columns[i];
      if (!curr.query(span).length) {
        column = curr;
        break;
      }
    }
    if (!column && !skipAdd) {
      column = this.addColumn();
    }
    return column;
  },

  /**
   * Add a busytime to the conflict span
   *
   * @param {Object} busytime full busytime object.
   */
  add: function(busytime) {
    var id = busytime._id;

    this.parent.conflicts[id] = this;
    this.all.add(busytime);

    var column = this.findColumn(busytime);
    column.add(busytime);
    this.columnsByID[id] = column;

    this._updateTimes(busytime);
    this._updateLayout();
    return this;
  },

  /**
   * Remove a busytime from the conflict span
   *
   * @param {Object} busytime full busytime object.
   * @param {Boolean} skipMaintenance skip post-removal maintenance.
   */
  remove: function(busytime, skipMaintenance) {
    var id = busytime._id;

    this.all.remove(busytime);
    var column = this.columnsByID[id];
    if (!column) { return; }

    column.remove(busytime);
    delete this.columnsByID[id];
    delete this.parent.conflicts[id];

    // Removing a single item requires maintenance after. But, this can be
    // skipped during a split, which does its own cleanup after multiple
    // removes & adds between spans.
    if (skipMaintenance) { return this; }

    this._splitIfNecessary();
    var boom = this._selfDestructIfNecessary();
    if (!boom) {
      this._resetTimes();
      this._purgeEmptyColumns();
      this._updateLayout();
    }

    return this;
  },

  /**
   * Absorb the given conflict span into this one
   *
   * @param {Object} ConflictSpan to be absorbed.
   */
  absorb: function(otherCS) {
    var self = this;
    var otherIDs = otherCS.getIDs();
    otherIDs.forEach(function(otherID) {
      var otherBusytime = self.parent.tree.byId[otherID];
      self.add(otherBusytime);
      // Cheat: skip removing from the other span, since references go away.
    });
  },

  /**
   * Update the start/end times for this span from a new busytime.
   *
   * @param {Object} busytime full busytime object.
   */
  _updateTimes: function(busytime) {
    var start = busytime._startDateMS;
    if (null === this.startTime || start < this.startTime) {
      this.startTime = start;
    }
    var end = busytime._endDateMS;
    if (null === this.endTime || end > this.endTime) {
      this.endTime = end;
    }
  },

  /**
   * Reset times with a complete re-scan of all events in the span.
   */
  _resetTimes: function() {
    this.startTime = this.endTime = null;
    var byId = this.all.byId;
    for (var k in byId) {
      this._updateTimes(byId[k]);
    }
  },

  /**
   * Scan through the events in this span. If a significant gap is found,
   * presumably after a removal, split this span in two.
   *
   * @param {Object} busytime full busytime object.
   */
  _splitIfNecessary: function() {
    var start = this.startTime;
    var end = this.endTime;

    // Scan for the end of the first gap, if any.
    var splitAt = false;
    var prevHits = null;
    for (var top = start; top < end; top += MIN_SPLIT_INTERVAL) {
      var span = new Timespan(top, top + MIN_SPLIT_INTERVAL);
      var hits = this.all.query(span).length;
      if (0 === prevHits && hits > 0) {
        // Transition from empty to non-empty is where we split.
        splitAt = top; break;
      }
      prevHits = hits;
    }

    // Bail if we never found a gap.
    if (splitAt === false) { return; }

    // Remove & collect the post-gap items for new split.
    var newItems = [];
    var splitSpan = new Timespan(splitAt, Infinity);
    var splitItems = this.all.query(splitSpan);
    var self = this;
    splitItems.forEach(function(item) {
      self.remove(item, true);
      newItems.push(item);
    });

    // Perform partial post-removal maintenance
    var boom = this._selfDestructIfNecessary();
    if (!boom) {
      this._resetTimes();
      this._purgeEmptyColumns();
      this._updateLayout();
    }

    // Bail if there's just one item for new split - no conflict.
    if (newItems.length == 1) {
      this.parent._clearLayout(newItems[0]);
      return;
    }

    // Otherwise, populate a new span with the conflicting items.
    var newCS = new ConflictSpan(this.parent);
    newItems.forEach(function(item) {
      newCS.add(item);
    });

    // Finally, recurse into the new span and split further, if necessary.
    newCS._splitIfNecessary();
  },

  /**
   * If this span has only one event left, then self-destruct because there's
   * no longer a conflict.
   */
  _selfDestructIfNecessary: function() {
    var keys = this.getIDs();
    if (keys.length > 1) {
      // There's still a conflict, so bail.
      return false;
    }
    if (keys.length == 1) {
      // Exactly one left, so clean up.
      var busytime = this.all.byId[keys[0]];
      this.remove(busytime, true);
      this.parent._clearLayout(busytime);
    }
    return true;
  },

  /**
   * Purge empty columns from the conflict span.
   */
  _purgeEmptyColumns: function() {
    var newColumns = [];
    for (var i = 0; i < this.columns.length; i++) {
      var column = this.columns[i];
      if (Object.keys(column.byId).length > 0) {
        newColumns.push(column);
      }
    }
    this.columns = newColumns;
  },

  /**
   * Update layout for all events participating in this conflict span.
   */
  _updateLayout: function() {
    var numCols = this.columns.length;
    var numbers = 0;
    var columnNum =
      numCols > DAY_VIEW_DISPLAY_LIMIT ? DAY_VIEW_DISPLAY_LIMIT : numCols;
    var width = (100 / columnNum);
    for (var cIdx = 0; cIdx < numCols; cIdx++) {
      var column = this.columns[cIdx];
      for (var k in column.byId) {
        var busytime = column.byId[k];
        var el = this.parent.getElement(busytime);
        el.style.width = width + '%';
        el.style.left = (width * cIdx) + '%';
        // we toggle the style based on amount of overlaps
        el.classList.toggle('many-overlaps', numCols > 1);
        el.classList.toggle('has-overlaps', numCols > 1);
        numbers++;
        if (numbers > DAY_VIEW_DISPLAY_LIMIT) {
          el.classList.add('hidden');
        }
      }
    }
  }
};

});

/**
 * Conflict manager
 */
define('utils/overlap',['require','exports','module','conflict_span','interval_tree','timespan'],function(require, exports, module) {


/**
 * Module dependencies
 */
var ConflictSpan = require('conflict_span');
var IntervalTree = require('interval_tree');
var Timespan = require('timespan');

function Overlap() {
  this.reset();
}
module.exports = Overlap;

Overlap.prototype = {
  reset: function() {
    this.tree = new IntervalTree();
    this.conflicts = {};
    this.elements = {};
  },

  add: function(myBusytime, element) {
    this.tree.add(myBusytime);
    this.elements[myBusytime._id] = element;

    // Check for conflicts, bail if none
    var related = this._findRelated(myBusytime);
    if (0 === related.length) {
      return;
    }

    var myID = myBusytime._id;
    var myCS = this.conflicts[myID];

    var self = this;
    related.forEach(function(otherBusytime) {
      // Get the other's ID, skip the current
      var otherID = otherBusytime._id;
      if (otherID === myID) {
        return;
      }

      var otherCS = self.conflicts[otherID];
      if (!myCS && !otherCS) {
        // This is a brand new conflict.
        myCS = new ConflictSpan(self);
        myCS.add(myBusytime).add(otherBusytime);
      } else if (myCS && !otherCS) {
        // Other time can join this one's existing span
        myCS.add(otherBusytime);
      } else if (!myCS && otherCS) {
        // This time can join the other's existing span
        myCS = otherCS.add(myBusytime);
      } else if (myCS && otherCS && myCS != otherCS) {
        // Both already in different spans, so absorb other into this
        myCS.absorb(otherCS);
      }
    });

  },

  /**
   * Remove a busytime from the collection.
   * Unlike other methods you must pass a real
   * busytime object.
   *
   * @param {Object} busytime full busytime object.
   */
  remove: function(busytime) {
    this._clearLayout(busytime);
    this.tree.remove(busytime);
    delete this.elements[busytime._id];
    var myID = busytime._id;
    var myCS = this.conflicts[myID];
    if (myCS) {
      myCS.remove(busytime);
    }
  },

  /**
   * Get the ConflictSpan associated with this busytime, if any.
   *
   * @param {Object|String} busytime id or busytime object.
   * @return {Object} associated ConflictSpan, if any.
   */
  getConflictSpan: function(busytime) {
    var id = this._busytimeId(busytime);
    return this.conflicts[id];
  },

  /**
   * @param {Object|String} busytime id or busytime object.
   * @return {HTMLElement} associated dom element.
   */
  getElement: function(busytime) {
    var id = this._busytimeId(busytime);
    return this.elements[id];
  },

  /** private */

  _busytimeId: function(busytime) {
    return (typeof(busytime) === 'string') ? busytime : busytime._id;
  },

  /**
   * Search tree for busytimes that overlap with the given.
   */
  _findRelated: function(busytime) {
    //XXX: this is bad encapsulation but
    //     we generate these when we insert
    //     the points in the tree.
    var span = new Timespan(busytime._startDateMS, busytime._endDateMS);
    return this.tree.query(span);
  },

  /**
   * Clear the layout from a busytime element, presumably because it has just
   * been removed from conflict.
   *
   * @param {Object} busytime full busytime object.
   */
  _clearLayout: function(busytime) {
    var el = this.elements[busytime._id];
    el.style.width = '';
    el.style.left = '';
    el.classList.remove('has-overlaps', 'many-overlaps');
  }
};

});

define('utils/color',['require','exports','module'],function(require, exports) {


// right now the calendar app only displays 8 different colors so it's a good
// idea to memoize the results of hexToBackground to avoid calculating it for
// each busytime
var memoized = {};

exports.hexToBackground = function(hex) {
  if (!(hex in memoized)) {
    // we need 20% opacity for background; it's simpler to use rgba than to
    // create a new layer and set opacity:20%
    var {r, g, b} = hexToChannels(hex);
    memoized[hex] = `rgba(${r}, ${g}, ${b}, 0.2)`;
  }

  return memoized[hex];
};

function hexToChannels(hex) {
  var val = parseInt(hex.replace(/#/, ''), 16);
  return {
    r: val >> 16,
    g: val >> 8 & 0xFF,
    b: val & 0xFF
  };
}

});

define('views/single_day',['require','exports','module','utils/overlap','date_format','utils/color','day_observer','calc','calc','calc','calc','calc'],function(require, exports, module) {


var Overlap = require('utils/overlap');
var localeFormat = require('date_format').localeFormat;
var colorUtils = require('utils/color');
var dayObserver = require('day_observer');
var relativeDuration = require('calc').relativeDuration;
var relativeOffset = require('calc').relativeOffset;
var getTimeL10nLabel = require('calc').getTimeL10nLabel;
var isSameDate = require('calc').isSameDate;
var spanOfDay = require('calc').spanOfDay;

var _id = 0;

function SingleDay(config) {
  this.date = config.date;
  this._hourHeight = config.hourHeight;
  this._daysHolder = config.daysHolder;
  this._allDayIcon = config.allDayIcon;
  this._alldaysHolder = config.alldaysHolder;
  this._oneDayLabelFormat = config.oneDayLabelFormat;
  this._render = this._render.bind(this);
  this._instanceID = _id++;
  this.overlaps = new Overlap();
}
module.exports = SingleDay;

SingleDay.prototype = {
  _isActive: false,
  _borderWidth: 0.1,
  _attached: false,

  visible: false,

  setup: function() {
    this.day = document.createElement('div');
    this.day.className = 'md__day';
    this.day.dataset.date = this.date;

    this.allday = document.createElement('div');
    this.allday.className = 'md__allday';
    this.allday.dataset.date = this.date;

    this._dayName = document.createElement('h1');
    this._dayName.className = 'md__day-name';
    this._dayName.setAttribute('aria-level', '2');
    this._dayName.id = 'md__day-name-' + this._instanceID;
    this.allday.appendChild(this._dayName);

    this._alldayEvents = document.createElement('div');
    this._alldayEvents.className = 'md__allday-events focusable';
    this._alldayEvents.setAttribute('role', 'spinbutton');
    this.allday.appendChild(this._alldayEvents);

    this._updateDayName();

    this.onactive();
  },

  _updateDayName: function() {
    var dayInWeek = this.date.getDay();
    var dayInMonth = this.date.getDate();
    this._dayName.innerHTML = `<span class="weekheader">
        <span class="p-thi" data-l10n-id="weekday-${dayInWeek}-single-char">
        </span>
        <span class="month-date">${dayInMonth}</span>
      </span>`;
  },

  handleEvent: function(evt) {
    switch(evt.type) {
      case 'localized':
        this._updateDayName();
        NavigationMap.reset('day-view');
        break;
    }
  },

  append: function() {
    this._daysHolder.appendChild(this.day);
    this._alldaysHolder.appendChild(this.allday);
    this._attached = true;
  },

  onactive: function() {
    if (this._isActive) {
      return;
    }
    dayObserver.on(this.date, this._render);
    window.addEventListener('localized', this);
    this._isActive = true;
  },

  _render: function(records) {
    this._alldayEvents.innerHTML = '';
    records.allday.forEach(this._renderAlldayEvent, this);
    this.overlaps.reset();
    this.day.innerHTML = '';
    records.basic.forEach(this._renderEvent, this);
    if (this._alldayEvents.children.length > 0) {
      this.resetAlldayEvent(this._alldayEvents.children);
    }

    let focusItem = document.querySelector('#day-view .focusable.focus');
    if (focusItem) {
      window.dispatchEvent(new CustomEvent('day-view-event-add', {
        detail: {
          focusedItem: focusItem
        }
      }));
    }
  },

  _renderEvent: function(record) {
    var fontClass = window.location.pathname === '/day/' ? 'p-pri' : 'p-thi';
    var el = this._buildEventElement(record, fontClass);

    var busytime = record.busytime;
    var {startDate, endDate, _id} = busytime;
    // Screen reader should be aware if the event spans multiple dates.
    var format = isSameDate(startDate, endDate) ? this._oneDayLabelFormat :
      'event-multiple-day-duration';

    var description = document.createElement('span');
    description.id = 'md__event-' + _id + '-description-' + this._instanceID;
    description.setAttribute('aria-hidden', true);
    description.setAttribute('data-l10n-id', format);
    description.setAttribute('data-l10n-args', JSON.stringify({
      startDate: localeFormat(startDate,
        navigator.mozL10n.get('longDateFormat')),
      startTime: localeFormat(startDate, navigator.mozL10n.get(
        getTimeL10nLabel('shortTimeFormat'))),
      endDate: localeFormat(endDate, navigator.mozL10n.get('longDateFormat')),
      endTime: localeFormat(endDate, navigator.mozL10n.get(
        getTimeL10nLabel('shortTimeFormat')))
    }));
    el.appendChild(description);
    el.dataset.startDate = startDate;
    el.dataset.endDate = endDate;

    var duration = relativeDuration(this.date, startDate, endDate);
    // we subtract border to keep a margin between consecutive events
    var hei = duration * this._hourHeight - this._borderWidth;
    el.style.height = hei + 'px';

    if (duration < 1) {
      el.classList.add('is-partial');
      var size = '';
      // we need to toggle layout if event lasts less than 20, 30 and 45min
      if (duration < 0.3) {
        size = 'micro';
      } else if (duration < 0.5) {
        size = 'tiny';
      } else if (duration < 0.75) {
        size = 'small';
      }
      if (size) {
        el.classList.add('is-partial-' + size);
      }
    }

    var offset = relativeOffset(this.date, startDate);
    el.style.top = (offset * this._hourHeight) + 'px';
    el.setAttribute("data-hour",offset);
    this.overlaps.add(busytime, el);
    this.day.appendChild(el);

    if (!document.querySelector('#week-view .md__event_focus')) {
      window.dispatchEvent(new CustomEvent('week-view-event-add'));
    }
  },

  _buildEventElement: function(record, fontClass) {
    var {event, busytime, color} = record;
    var {remote} = event;

    var el = document.createElement('a');
    el.href = '/event/show/' + busytime._id;
    el.style.borderColor = color;
    fontClass = !!fontClass ? fontClass : 'p-sec';
    el.className = 'md__event ' + fontClass;

    el.dataset.eventId = record.event._id;
    el.dataset.busytimeId = record.busytime._id;
    el.dataset.date = this.date;

    // we use a <bdi> element because content might be bidirectional
    var title = document.createElement('bdi');
    title.className = 'md__event-title';
    title.id = 'md__event-' + busytime._id + '-title-' + this._instanceID;

    // since we use "textContent" there is no risk of XSS
    title.textContent = remote.title;
    el.appendChild(title);

    if (remote.location) {
      // we use a <bdi> element because content might be bidirectional
      var location = document.createElement('bdi');
      location.className = 'md__event-location p-sec';
      location.id = 'md__event-' + busytime._id + '-location-' +
        this._instanceID;

      // since we use "textContent" there is no risk of XSS
      location.textContent = remote.location;
      el.appendChild(location);
    }

    return el;
  },

  _renderAlldayEvent: function(record) {
    var el = this._buildEventElement(record, 'p-thi');
    el.classList.add('is-allday');
    el.setAttribute('aria-hidden', 'true');
    this._alldayEvents.appendChild(el);

    if (!document.querySelector('#week-view .md__event_focus')) {
      window.dispatchEvent(new CustomEvent('week-view-event-add'));
    }
  },

  resetAlldayEvent: function(elements){
    for(var i = 0, len = elements.length; i < len; i++) {
      var w = (100 / len).toFixed(2) + '%';
      elements[i].classList.toggle('many-overlaps', len > 1);
      elements[i].classList.toggle('has-overlaps', len > 1);
      elements[i].classList.toggle('hidden', i > 0);
    }
  },

  destroy: function() {
    this.oninactive();
    this._detach();
  },

  _detach: function() {
    if (this._attached) {
      this._daysHolder.removeChild(this.day);
      this._alldaysHolder.removeChild(this.allday);
      this._attached = false;
    }
  },

  oninactive: function() {
    if (!this._isActive) {
      return;
    }
    dayObserver.off(this.date, this._render);
    window.removeEventListener('localized', this);
    this._isActive = false;
  },

  setVisibleForScreenReader: function(visibleRange) {
    var visible = visibleRange.contains(spanOfDay(this.date));
    this.day.setAttribute('aria-hidden', !visible);
    this.allday.setAttribute('aria-hidden', !visible);
    this.visible = visible;
  }
};

});

define('views/multi_day',['require','exports','module','calc','./current_time','templates/date_span','./hour_double_tap','./pan','./single_day','timespan','view','calc','utils/mout','router','date_format'],function(require, exports, module) {


var Calc = require('calc');
var CurrentTime = require('./current_time');
var DateSpan = require('templates/date_span');
var HourDoubleTap = require('./hour_double_tap');
var Pan = require('./pan');
var SingleDay = require('./single_day');
var Timespan = require('timespan');
var View = require('view');
var createDay = require('calc').createDay;
var throttle = require('utils/mout').throttle;
var router = require('router');
var localeFormat = require('date_format').localeFormat;

function MultiDay(opts) {
  this.app = opts.app;
  this.timeController = opts.app.timeController;
  this.children = [];
}
module.exports = MultiDay;

MultiDay.prototype = {
  __proto__: View.prototype,

  // override these properties on child classes to change the behavior!
  scale: '',
  visibleCells: 7,
  element: null,
  _hourFormat: 'hour-format',
  _oneDayLabelFormat: 'event-one-day-duration',

  childClass: SingleDay,
  children: null,
  seen: false,
  _baseDate: null,
  _hourHeight: 0,
  _prevRange: null,
  _visibleRange: null,
  _index: 7,
  isRtl: null,
  set baseDate(date) {
    // it's very important that base date doesn't hold hour info otherwise we
    // could create duplicate days (because range wouldn't contain datetime)
    this._baseDate = createDay(date);
  },

  get baseDate() {
    return this._baseDate;
  },

  get daysHolder() {
    return this.element.querySelector('.md__days');
  },

  get alldaysHolder() {
    return this.element.querySelector('.md__alldays');
  },

  get main() {
    return this.element.querySelector('.md__main');
  },

  get mainContent() {
    return this.element.querySelector('.md__main-content');
  },

  get sidebar() {
    return this.element.querySelector('.md__sidebar');
  },

  get allDayIcon() {
    return this.element.querySelector('.md__all-day');
  },

  get separator() {
    return this.element.querySelector('.md__separator #zero-clock');
  },

  onactive: function() {
    this.isRtl = 'rtl' === document.dir;
    this.element.classList.add(View.ACTIVE);

    if (!this.seen) {
      this.onfirstseen();
      this.seen = true;
    }

    var controller = this.timeController;
    controller.scale = this.scale;
    controller.moveToMostRecentDay();

    if (router.last.path === '/month/' ||
        router.last.path === '/day/' ||
        router.last.path === '/switchto-date/' ||
        router.last.path === '/show-multi-events/') {
      this.baseDate = this._calcBaseDate(controller.position);
      this.timeController.move(this.baseDate );
    } else if (window.location.pathname === '/day/') {
      this.baseDate = controller.selectedDay;
      this.timeController.move(controller.selectedDay);
    }
    // add listeners afterwards to avoid calling render twice
    controller.on('dayChange', this);
    this._render();
  },

  _calcBaseDate: function(date) {
    // this is overwritten by week view, and only called during onactivate
    return date;
  },

  onfirstseen: function() {
    this._setupPan();
    this._setupHours();
    this._setupCurrentTime();
    // we keep the localized listener even when view is inactive to avoid
    // rebuilding the hours/dates every time we switch between views
    // When screen reader is used, scrolling is done using wheel events.
    this.element.addEventListener('wheel', this);
  },

  _setupPan: function() {
    var containerWidth = this.daysHolder.parentNode.offsetWidth;
    this._pan = new Pan({
      gridSize: Math.round(containerWidth / this.visibleCells),
      visibleCells: this.visibleCells,
      eventTarget: this.element,
      overflows: [
        this.main
      ],
      targets: [
        this.alldaysHolder,
        this.daysHolder
      ]
    });
    this._pan.setup();
    this._pan.on('start', () => this._hourDoubleTap.removeAddEventLink());
    this._pan.on('release', obj => this._updateBaseDateAfterScroll(obj.diff));
  },

  _addWeekAllDayFocusBox: function() {
    var weekAllDay_focusBox = document.querySelector('#week-view .focusBox__weekAllDay');

    if(!weekAllDay_focusBox.hasChildNodes()){
      for(var i = 0; i < 7 ; i++){
        var weekAllDayChild_focusBox = document.createElement('div');
        weekAllDayChild_focusBox.className = 'focusBox__weekAllDayChild focusable focusable_week';
        weekAllDayChild_focusBox.setAttribute('role', 'spinbutton');
        weekAllDayChild_focusBox.setAttribute('data-index', i);
        weekAllDay_focusBox.appendChild(weekAllDayChild_focusBox);
      }
    }
  },

  _setupHours: function() {
    var sidebar = this.sidebar;
    // we need to remove all children because when locale change we rebuild
    // the hours (we can't use data-l10n-id because of special format)
    sidebar.innerHTML = '';
    var hour, i = -1;
    while (++i < 24) {
      hour = this._createHour(i);
      sidebar.appendChild(hour);
    }
    this._hourHeight = hour.offsetHeight;

    if(window.location.pathname === '/week/') {
      this._addWeekAllDayFocusBox();
    }
  },

  _addDayHourFocusBox: function(el, hour) {
    var dayHour_focusBox = document.createElement('div');

    dayHour_focusBox.className = 'focusBox_dayHour focusable';
    dayHour_focusBox.setAttribute('data-hour', hour);
    dayHour_focusBox.setAttribute('role', 'spinbutton');
    el.appendChild(dayHour_focusBox);
  },

  _addWeekHourFocusBox: function(el, hour) {
    var weekDay_focusBox = document.createElement('div');
    weekDay_focusBox.className = 'focusBox__weekDay';
    weekDay_focusBox.setAttribute('data-hour', hour);
    el.appendChild(weekDay_focusBox);

    for(var i = 0; i < 7 ; i++){
       var weekDayChild_focusBox = document.createElement('div');
       weekDayChild_focusBox.className = 'focusBox__weekDayChild focusable_week';
       weekDayChild_focusBox.setAttribute('data-hour', hour);
       weekDayChild_focusBox.setAttribute('role', 'spinbutton');
       weekDay_focusBox.appendChild(weekDayChild_focusBox);
       weekDayChild_focusBox.setAttribute('data-index', this._index);
       this._index++;
       weekDay_focusBox.appendChild(weekDayChild_focusBox);
    }
  },

  _createHour: function(hour) {
    var el = document.createElement('li');
    el.className = 'md__hour md__hour-' + hour +
      (hour % 2 === 0 ? ' md__hour-even' : ' md__hour-odd');
    el.innerHTML = DateSpan.hour.render({
      hour: hour,
      format: this._hourFormat,
      className: 'md__display-hour'
    });
    this._addDayHourFocusBox(el, hour);

    if(window.location.pathname === '/week/') {
      this._addWeekHourFocusBox(el, hour);
    }

    return el;
  },

  _setupCurrentTime: function() {
    this._currentTime = new CurrentTime({
      container: this.element.querySelector('.md__main-content'),
      sticky: this.alldaysHolder
    });
  },

  _setupDoubleTap: function() {
    this._hourDoubleTap = new HourDoubleTap({
      app: this.app,
      main: this.main,
      daysHolder: this.daysHolder,
      alldaysHolder: this.alldaysHolder,
      hourHeight: this._hourHeight
    });
    this._hourDoubleTap.setup();
  },

  handleEvent: function(e) {
    switch (e.type) {
      case 'dayChange':
        this._onDayChange(e.data[0]);
        break;
    }
  },

  _onDayChange: function(date) {
    this.baseDate = date;
    this._render();
  },

  _updateBaseDateAfterScroll: function(diff) {
    this._updateBaseDate(diff);

    var evt = new CustomEvent("page-changed", {
      detail: {
        page: window.location.pathname
      },
      bubbles: true,
      cancelable: false
    });
    window.dispatchEvent(evt);
  },

  _updateBaseDateAfterScrollNew: function(diff) {
    let evt = new CustomEvent('page-changed', {
      detail: {
        page: window.location.pathname
      },
      bubbles: true,
      cancelable: false
    });
    window.dispatchEvent(evt);
  },

  _updateBaseDate: function(diff) {
    var day = createDayDiff(this.baseDate, diff);
    this.timeController.move(day);
    this.timeController.selectedDay = day;
    if (/^\/(month|week|switchto-date)/.test(router.last.path)) {
        window.history.state.selectedDay = this.timeController.selectedDay;
    } else {
      delete window.history.state.selectedDay;
    }
    if (window.location.pathname === '/day/') {
      document.getElementById('current-month-year').focus();
    }
  },

  _render: function() {
    var currentRange = this._getRange();
    this._removeDatesOutsideRange(currentRange);

    // very important to re-activate child views in case we change views
    // without moving to a different date
    this.children.forEach(child => child.onactive());

    this._addDatesInsideRange(currentRange);

    this._prevRange = currentRange;
    this._visibleRange = this._getVisibleRange();
    this._sortDays();
    this._setVisibleForScreenReader();
    this._pan.refresh();
    this._refreshCurrentTime();

    this.allDayIcon.id = 'md__all-day-icon-' + this.scale;
    this.separator.textContent = navigator.mozHour12 ? '12' : '00';
  },

  _refreshCurrentTime: function() {
    this._currentTime.timespan = this._visibleRange;
    this._currentTime.refresh();
  },

  _updateFocusableItem: function(item) {
    var isWeekView = window.location.pathname === '/week/';
    var focusBoxes = isWeekView ?
        document.querySelectorAll('.focusBox__weekAllDayChild.focusable_week, .focusBox__weekDayChild.focusable_week') :
        document.querySelectorAll('.md__allday[aria-hidden="false"] .md__allday-events, .focusBox_dayHour.focusable');

    var itemRects = item.day.getClientRects();
    if (itemRects.length < 1) {
      return;
    }

    var itemX = itemRects[0].x;
    var normalEvents = item.day.querySelectorAll('a bdi');
    var allDayEvents = item.allday.querySelectorAll('a bdi');
    var xDelta = isWeekView ? 5 : 10;
    var yDelta = isWeekView ? 5 : 10;

    for (var i = 0, len = focusBoxes.length; i < len; i++) {
      var focusBox = focusBoxes[i];
      var focusBoxRects = focusBox.getClientRects();
      if (focusBoxRects.length < 1) {
        continue;
      }

      var focusBoxX = focusBoxRects[0].x;
      var focusBoxY = focusBoxRects[0].y;
      var focusBoxRight = focusBoxRects[0].right;
      var focusBoxBottom = focusBoxRects[0].bottom;

      if (Math.abs(itemX - focusBoxX) < xDelta) {
        var events = null;
        var date = new Date(item.date);
        var l10n = navigator.mozL10n;
        var format = '';
        var isDay = !!focusBox.dataset.hour;

        if (isDay) {
          format = navigator.mozHour12 ?
              (isWeekView ? l10n.get('weekTimeFormat12') : l10n.get('dayHour12')) :
              (isWeekView ? l10n.get('weekTimeFormat24') : l10n.get('dayHour24'));
          date.setHours(focusBox.dataset.hour);
          events = normalEvents;
        } else {
          format = l10n.get('alldayLongTimeFormat');
          events = allDayEvents;
        }

        var labels = [];
        labels.push(localeFormat(date, format));

        for(var j = 0, eLen = events.length; j < eLen; j++) {
          var eventRects = events[j].getClientRects();
          if (eventRects.length < 1) {
            continue;
          }

          var eventX = eventRects[0].x;
          var eventY = eventRects[0].y;
          if (!isDay) {
            if (Math.abs(focusBoxX - eventX) < xDelta && eventY > focusBoxY - yDelta) {
              labels.push(events[j].textContent);
            }
          } else {
            if (eventX > focusBoxX - xDelta && eventX < focusBoxRight &&
               eventY > focusBoxY - yDelta && eventY < focusBoxBottom + yDelta) {
              labels.push(events[j].textContent);
            }
          }
        }
        focusBox.dataset.date = date;
        focusBox.setAttribute('aria-label', labels.join(', '));
      }
    }
  },

  _setVisibleForScreenReader: function() {
    var self = this;
    self.children.forEach(child => {
      child.setVisibleForScreenReader(self._visibleRange);
      if (child.visible) {
        self._updateFocusableItem(child);
      }
    });
  },

  _removeDatesOutsideRange: function(range) {
    if (this.children.length) {
      this.children = this.children.filter(child => {
        if (range.contains(child.date)) {
          return true;
        }
        child.destroy();
        return false;
      });
    }
  },

  _addDatesInsideRange: function(range) {
    this._getPendingDates(range)
      .forEach(date => {
        var day = new this.childClass({
          date: date,
          daysHolder: this.daysHolder,
          alldaysHolder: this.alldaysHolder,
          allDayIcon: this.allDayIcon,
          hourHeight: this._hourHeight,
          oneDayLabelFormat: this._oneDayLabelFormat
        });
        day.setup();
        if (this.isRtl) {
          navigator.mozL10n.translateFragment(day._dayName);
        }
        this.children.push(day);
      });
  },

  _getPendingDates: function(range) {
    var dates = Calc.daysBetween(range);
    if (this._prevRange) {
      dates = dates.filter(date => {
        return !this._prevRange.contains(date);
      });
    }
    return dates;
  },

  _sortDays: function() {
    // decided to use float and reappend the elements in the right order
    // since using position:absolute or css transforms felt "slower"
    // (we have a reflow anyway since we might add new elements to the DOM)
    this.children
      .sort((a, b) => a.date - b.date)
      .forEach(day => day.append());
  },

  _getRange: function() {
    return new Timespan(
      createDayDiff(this.baseDate, -this.visibleCells),
      createDayDiff(this.baseDate, (this.visibleCells * 2) - 1)
    );
  },

  _getVisibleRange: function() {
    return new Timespan(
      this.baseDate,
      createDayDiff(this.baseDate, this.visibleCells)
    );
  },

  _resetScroll: function() {
    this.main.scrollTop = 0;
  },

  _scrollToHour: function(options) {
    var hour = this._getScrollDestinationHour(options);
    if (hour != null) {
      this._animatedScroll(hour * this._hourHeight);
    }
  },

  _getScrollDestinationHour: function(options) {
    var hour = options && options.hour;
    if (hour != null) {
      return hour;
    }

    var now = new Date();
    if (this._visibleRange.contains(now)) {
      return Math.max(now.getHours() - 1, 0);
    }

    return (options && options.onlyToday) ? null : 8;
  },

  _animatedScroll: function(scrollTop) {
    scrollTop = Math.max(scrollTop, 0);

    var container = this.main;
    var maxScroll = container.scrollHeight - container.clientHeight;

    scrollTop = Math.min(scrollTop, maxScroll);

    var content = this.mainContent;
    var destination = container.scrollTop - scrollTop;
    var seconds = Math.abs(destination) / 500;

    container.style.overflowY = 'hidden';

    window.requestAnimationFrame(() => {
      container.scrollTop = 0;
      content.style.transform = 'translateY(' + destination + 'px)';
      // easeOutQuart borrowed from http://matthewlein.com/ceaser/
      content.style.transition = 'transform ' + seconds + 's ' +
        'cubic-bezier(0.165, 0.840, 0.440, 1.000)';
    });

    content.addEventListener('transitionend', function setScrollTop() {
      content.removeEventListener('transitionend', setScrollTop);
      content.style.transform = '';
      content.style.transition = '';
      container.scrollTop = scrollTop;
      container.style.overflowY = 'scroll';
    });
  },

  oninactive: function() {
    this.element.classList.remove(View.ACTIVE);
    this.element.setAttribute('focus-index',  0);
    this.timeController.removeEventListener('dayChange', this);
    this.children.forEach(child => child.oninactive());
  }
};

function createDayDiff(date, diff) {
  return createDay(date, date.getDate() + diff);
}

});

define('rectangle',['require','exports','module'],function(require, exports, module) {


exports.modifyRect = function(rect, len) {
  var delta = len ? len : 0;
  return {
    x: rect.x + delta,
    y: rect.y + delta,
    width: rect.width - 2 * delta,
    height: rect.height - 2 * delta,
    top: rect.top + delta,
    right: rect.right - delta,
    bottom: rect.bottom - delta,
    left: rect.left + delta
  };
};

exports.isIntersect = function(r1, r2) {
  var xInScope = Math.abs((r1.x + r1.width / 2) - (r2.x + r2.width / 2)) <= (r1.width / 2 + r2.width / 2);
  var yInScope = Math.abs((r1.y + r1.height / 2) - (r2.y + r2.height / 2)) <= (r1.height / 2 + r2.height / 2);
  return xInScope && yInScope;
};

});

define('views/week',['require','exports','module','calc','querystring','router','./multi_day','provider/caldav','date_format','rectangle','next_tick','notification','provider/local','shared/input_parser','dom!week-view'],function(require, exports, module) {


var Calc = require('calc');
var QueryString = require('querystring');
var router = require('router');
var MultiDay = require('./multi_day');
var CaldavProvider = require('provider/caldav');
var localeFormat = require('date_format').localeFormat;
var l10n = navigator.mozL10n;
var rectangle = require('rectangle');
var nextTick = require('next_tick');
var notification = require('notification');
var Local = require('provider/local');
var InputParser = require('shared/input_parser');

require('dom!week-view');

var dateItemWeek = document.querySelector('.select-value .date-hidden-input');
var valueItemWeek = document.querySelector('.select-value .calendarId-select');
var keydownEvent = null;

var skAddEvent = {
  name: 'Add Event',
  l10nId: 'add-event',
  priority: 1,
  method: function() {
    var focusItemInfo = _weekCurrent._getFocusItemInfo();
    var focusType = _weekCurrent._getFocusType(focusItemInfo.indexNumber);
    var resultValue = _weekCurrent._getEventsCount(focusType, focusItemInfo.indexNumber);
    if (focusType === 'allDay') {
      _weekCurrent._addEvent(resultValue.focusdate, 0, true);
    } else if (focusType === 'dayHour') {
      _weekCurrent._addEvent(resultValue.focusdate, focusItemInfo.hourNumber, false);
    }
  }
};

var skDefaultCSK = {
  name: 'select',
  l10nId: 'select',
  priority: 2,
  method: function() {}
};

var skMonthView = {
  name: 'Month View',
  l10nId: 'month-view',
  priority: 5,
  method: function() {
    router.go('/month/');
  }
};

var skDayView = {
  name: 'Day View',
  l10nId: 'day-view',
  priority: 6,
  method: function() {
    router.go('/day/');
  }
};

var skCurrentDate = {
  name: 'Today',
  l10nId: 'today',
  priority: 7,
  method: function() {
    var today = new Date();
    dateItemWeek.value = InputParser.exportDate(today);
    _weekCurrent.timeController.move(today);
    _weekCurrent.timeController.selectedDay = today;
    var selectedHour = today.getHours();
    var state = {
      eventStartHour: selectedHour
    }
    router.go('/week/', state);
    var evt = new CustomEvent('kai-week-custom-focus', {
      detail: {
        type: 'current-date'
      }
    });
    document.dispatchEvent(evt);
  }
};

var skGoToDate = {
  name: 'Go to Date',
  l10nId: 'go',
  priority: 8,
  method: function() {
    valueItemWeek.dataset.valueFlag = 1;
    dateItemWeek.focus();
  }
};

var skSearch = {
  name: 'Search',
  l10nId: 'search',
  priority: 9,
  method: function() {
    router.go('/search/');
  }
};

var skCalendarsToDisplay = {
  name: 'Calendars to display',
  l10nId: 'calendar-to-display',
  priority: 10,
  method: function() {
    valueItemWeek.dataset.valueFlag = 2;
    valueItemWeek.focus();
  }
};

var skSync = {
  name: 'Sync calendar',
  l10nId: 'sync-calendar',
  priority: 11,
  method: function () {
    self.app.syncController.all();
  }
};

var skSettings = {
  name: 'Settings',
  l10nId: 'settings',
  priority: 12,
  method: function() {
    router.go('/advanced-settings/');
  }
};

var currentMenuOptionActions = [
    skAddEvent, skDefaultCSK, skMonthView, skDayView,
    skGoToDate, skSearch,
    skCalendarsToDisplay, skSync, skSettings];

var menuOptionActions = [
    skAddEvent, skDefaultCSK, skMonthView, skDayView,
    skCurrentDate, skGoToDate, skSearch,
    skCalendarsToDisplay, skSync, skSettings];

var currentMenuOptionActionsNoSync = [
    skAddEvent, skDefaultCSK, skMonthView, skDayView,
    skGoToDate, skSearch,
    skCalendarsToDisplay, skSettings];

var menuOptionActionsNoSync = [
    skAddEvent, skDefaultCSK, skMonthView, skDayView,
    skCurrentDate, skGoToDate, skSearch,
    skCalendarsToDisplay, skSettings];

var currentMenuOptionActionsLowMem = [
    skAddEvent, skDefaultCSK, skMonthView, skDayView,
    skGoToDate, skSearch, skSettings];

var menuOptionActionsLowMem = [
    skAddEvent, skDefaultCSK, skMonthView, skDayView,
    skCurrentDate, skGoToDate, skSearch, skSettings];

function WeekView(opts) {
  MultiDay.apply(this, arguments);
  this.onFocusChanged = this.onFocusChanged.bind(this);
}
module.exports = WeekView;

WeekView.prototype = {
  __proto__: MultiDay.prototype,
  preSelectDate: null,
  scale: 'week',
  visibleCells: 7,
  _hourFormat: 'week-hour-format',
  _oneDayLabelFormat: 'week-event-one-day-duration',
  _addAmPmClass: true,
  _menuParams: [],
  _weekCurrent:null,
  _weekCurPage:"",
  optionJstr:"",
  focusItemBusytimeId:"",
  focusItemEventId:"",
  get element() {
    return document.getElementById('week-view');
  },

  selectors: {
    accountList: '#advanced-settings-view .account-list'
  },

  _calcBaseDate: function(date) {
    // Don't reset the first day when come back from other screens.
    if (this.baseDate && Calc.isSameDate(date, this.baseDate)) {
      return this.baseDate;
    }

    // Show monday as the first day of the grid if date is between Mon-Fri.
    var index = Calc.dayOfWeekFromStartDay(date.getDay());
    if (index < 7) {
      date = Calc.createDay(date, date.getDate() - index);
    }
    return date;
  },

  _addEvent: function(addDate , hour, isAllDay) {
    var queryString = {};
    var start = new Date(addDate);
    var end = new Date(addDate);

    start.setHours(parseInt(hour));
    end.setHours(parseInt(hour) + 1);

    if(isAllDay) {
      queryString.isAllDay = true;
      end.setDate(start.getDate() + 1);
    }

    queryString.startDate = start.toString();
    queryString.endDate = end.toString();
    router.go('/event/add/?' + QueryString.stringify(queryString));
  },

  _handleBackEvent: function(e) {
    if(router.app.getSkPanel().menuVisible) {
        return;
    }
    if (window.location.pathname === '/week/') {
      if (e.key == 'BrowserBack'  || e.key === 'Backspace') {
        if(router.app.deleteDialogShown) {
          e.preventDefault();
        }
      }
    }
  },

  _getWeek: function(date){
    var year = date.getFullYear();
    var month = date.getMonth();
    var day = date.getDate();
    var firstDay = new Date(year, 0, 1);
    var firstWeekDays = 7 - firstDay.getDay();
    var dayOfYear = (((new Date(year, month, day)) - firstDay) / (24 * 3600 * 1000)) + 1;
    return Math.ceil((dayOfYear - firstWeekDays) / 7) + 1;
  },

  _updateSelectedDay: function() {
    if(window.location.pathname!='/week/') {
        return;
    }
    _weekCurrent.focusItemBusytimeId='';
    var focusItemInfo = _weekCurrent._getFocusItemInfo();
    var focusType = _weekCurrent._getFocusType(focusItemInfo.indexNumber);
    var eventsInfo = null;
    var focusDate = null;

    eventsInfo = _weekCurrent._getEventsCount(focusType, focusItemInfo.indexNumber);
    focusDate = new Date(eventsInfo.focusdate);
    _weekCurrent.timeController.selectedDay = focusDate;
    if(eventsInfo.count!=1) {
      _weekCurrent.focusItemBusytimeId="";
    }

    _weekCurrent._createSK();
  },

  _getFocusType:function(index) {
    if(index <= 6) {
      return "allDay";
    } else {
      return "dayHour";
    }
  },

  _getFocusItemInfo:function() {
    var hourNumber = 0;
    var focusedItem = document.querySelector('.focusable_week.focus');

    var indexNumber = parseInt(focusedItem.getAttribute('data-index'));
    if(indexNumber > 6){
      hourNumber = focusedItem.parentNode.attributes["data-hour"].value;
    }
    return {indexNumber, hourNumber};
  },

  _getEventsCount:function(focusType, focusIndex) {
    var count=0;
    var href;
    var focusdate;

    if (focusType === "allDay") {
      var activeDay = _weekCurrent.alldaysHolder.childNodes[focusIndex + 7].querySelector(".md__allday-events");
      var allDayEvents = Array.prototype.slice.call(activeDay.childNodes);
      focusdate = activeDay.parentNode.dataset.date;
      count = allDayEvents.length;
      if(count == 1) {
        href = allDayEvents[0].attributes["href"].value;
        _weekCurrent.focusItemBusytimeId=href.replace("/event/show/","");
        _weekCurrent.focusItemEventId = allDayEvents[0].dataset.eventId;
      }
    } else if (focusType === "dayHour") {
      var md_days = document.querySelector('.week-view .md__days').childNodes;
      var currentIndex = this.isRtl ? (13 - focusIndex % 7) : focusIndex % 7 + 7;

      var current_day = md_days[currentIndex];
      var day_events = current_day.childNodes;
      focusdate = current_day.dataset.date;

      for(var i = 0; i < day_events.length; i++) {
        var top = parseInt(day_events[i].style.top);
        var height = parseInt(day_events[i].style.height);
        var bottom = top + height;
        var topSize = Math.floor(focusIndex / 7);

        if((top >= (topSize -1) * 30 && top < topSize * 30)
          || (bottom <= 30 * topSize && bottom > 30 * (topSize -1))
          || (top < 30 * (topSize - 1) && bottom > 30 * topSize)){
          href = day_events[i].attributes["href"].value;
          _weekCurrent.focusItemBusytimeId=href.replace("/event/show/","");
          _weekCurrent.focusItemEventId = day_events[i].dataset.eventId;
          count++;
        }
      }
    }

    return {count, href, focusdate};
  },

  _getFocusDayEventsInfo: function() {
    var focusItemInfo = _weekCurrent._getFocusItemInfo();
    var focusType = _weekCurrent._getFocusType(focusItemInfo.indexNumber);
    var eventsInfo = _weekCurrent._getEventsCount(focusType,focusItemInfo.indexNumber);

    return {eventsInfo, focusType, focusItemInfo};
  },

  _createSK: function() {
    var self = _weekCurrent;
    var params;
    var dateString = _weekCurrent.timeController.selectedDay.toDateString();
    var isSameDate = (dateString === new Date().toDateString());

    if (this.app.lowMemory) {
      params = isSameDate ? currentMenuOptionActionsLowMem.slice() :
      menuOptionActionsLowMem.slice();
    } else {
      if (this.app.calendarIdNum > 1) {
        params = isSameDate ? currentMenuOptionActions.slice() :
          menuOptionActions.slice();
      } else {
        params = isSameDate ? currentMenuOptionActionsNoSync.slice() :
          menuOptionActionsNoSync.slice();
      }
    }


    if(isSameDate) {
      params = self.stripItem(params, 'Today');
    }
    if (JSON.stringify(params) !== _weekCurrent.optionJstr) {
      self.app.createSks(params);
      self._menuParams = params;
      _weekCurrent.optionJstr = JSON.stringify(params);
    }
  },

  _HWkeyHandler:function(e) {
    var dialog = document.querySelector('gaia-confirm');
    if (dialog) {
      e.preventDefault();
      return;
    }
    if (router.app.getSkPanel().menuVisible) {
      var item = document.querySelector('.menu-button.focus');
      if (item) {
        item.scrollIntoView(false);
      }
      return;
    }
    this.isRtl = 'rtl' === document.dir;
    let comparador;
    switch(e.key) {
      case 'Accept':
      case 'Enter':
        var resultValue = _weekCurrent._getFocusDayEventsInfo(e);
        if(resultValue.eventsInfo.count === 0) {
          if(resultValue.focusType === 'allDay') {
            _weekCurrent._addEvent(resultValue.eventsInfo.focusdate, 0, true);
          } else if(resultValue.focusType === 'dayHour') {
            _weekCurrent._addEvent(resultValue.eventsInfo.focusdate, resultValue.focusItemInfo.hourNumber, false);
          }
        } else if(resultValue.eventsInfo.count === 1) {
          router.go(resultValue.eventsInfo.href);
        } else if(resultValue.eventsInfo.count > 1) {
          if(resultValue.focusType === 'allDay') {
            var state = {
              date: new Date(resultValue.eventsInfo.focusdate),
              hour: 'allday',
              isAllDay: true
            };
            router.go('/show-multi-events/', state);
          }else if(resultValue.focusType === 'dayHour') {
            var state = {
              date: new Date(resultValue.eventsInfo.focusdate),
              hour: resultValue.focusItemInfo.hourNumber,
              isAllDay: false
            };
            router.go('/show-multi-events/', state);
          }
        }
        break;
      case 'BrowserBack':
      case 'KanjiMode':
      case 'Backspace':
        if (!(window.location.pathname === '/day/' ||
        window.location.pathname === '/week/')) {
          // do nothing
        }
        break;
      case 'ArrowLeft':
        comparador = this.isRtl ? '--next' : '--prev';
        if (e.target.style.getPropertyValue(comparador)) {
          keydownEvent = 'ArrowLeft';
          _weekCurrent._updateBaseDateAfterScrollNew(this.isRtl ? 1 : -1);
        }
        _weekCurrent._updateSelectedDay();
        break;
      case 'ArrowRight':
        comparador = this.isRtl ? '--prev' : '--next';
        if (e.target.style.getPropertyValue(comparador)) {
          keydownEvent = 'ArrowRight';
          _weekCurrent._updateBaseDateAfterScrollNew(this.isRtl ? -1 : 1);
        }
        _weekCurrent._updateSelectedDay();
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        _weekCurrent._updateSelectedDay();
        break;
    }
  },

  _updateWeekDate: function(value) {
    if (window.location.pathname === '/week/' &&
      valueItemWeek.dataset.valueFlag === '1' && value === 0) {
      NavigationMap.menuUpdate();

      if (dateItemWeek.value) {
        valueItemWeek.dataset.valueFlag = null;
        var selected = InputParser.importDate(dateItemWeek.value);
        var date = new Date(selected.year, selected.month, selected.date);

        _weekCurrent.timeController.move(date);
        _weekCurrent.timeController.selectedDay = date;
        var selectedHour = date.getHours();
        var state = {
          eventStartHour: selectedHour
        }

        var evt = new CustomEvent('kai-week-custom-focus', {
          detail: {
            type: "go-to-date"
          }
        });
        document.dispatchEvent(evt);
        _weekCurrent._createSK();
      }
    }
  },

  _changeWeekDate: function() {
    var today = new Date();
    dateItemWeek.value = InputParser.exportDate(today);
    _weekCurrent.timeController.move(today);
    _weekCurrent.timeController.selectedDay = today;
    var selectedHour = today.getHours();
    var state = {
      eventStartHour: selectedHour
    }
    _weekCurrent.app._setPresentDate();
    router.go('/week/', state);
    var evt = new CustomEvent('kai-week-custom-focus', {
      detail: {
        type: 'current-date'
      }
    });
    document.dispatchEvent(evt);
  },

  _changeView: function() {
    NavigationMap.reset('week-view');
  },

  handAddAlldayEvent: function() {
    if (window.location.pathname === '/week/') {
      let focusedItem = document.querySelector('#week-view .focus');
      let elementOfEvents = document.querySelectorAll('#week-view a.md__event');
      let focusRects = focusedItem.getClientRects()[0];

      if (!focusRects) {
        return;
      }
      this.handleEventFocus(focusRects, elementOfEvents);
    }
  },

  onactive: function() {
    MultiDay.prototype.onactive.apply(this, arguments);
    _weekCurrent = this;
    _weekCurrent.optionJstr="";
    keydownEvent = null;

    this.handAddAlldayEvent = this.handAddAlldayEvent.bind(this);
    window.addEventListener('keydown', this._HWkeyHandler, false);
    window.addEventListener('keydown', this._handleBackEvent, false);
    window.addEventListener('index-changed', this.onFocusChanged);
    window.addEventListener('moztimechange', this._changeWeekDate);
    window.addEventListener('localized', this._changeView);
    window.addEventListener('week-view-event-add', this.handAddAlldayEvent);
    if (!dateItemWeek.dataset.inputEventWeek){
      SettingsListener.observe('selectOptionPopup.state', 0,
        this._updateWeekDate.bind(this));
      dateItemWeek.dataset.inputEventWeek = true;
    }

    this._weekCurPage=window.location.pathname;

    var backfrom = null;
    if('backfrom' in window.history) {
      backfrom = window.history.backfrom;
    }
    if (router.last.path === '/month/' ||
        router.last.path === '/day/' ||
        router.last.path === '/switchto-date/' ||
       (router.last.path === '/show-multi-events/' && backfrom != null)) {
      var evt = new CustomEvent('kai-week-custom-focus', {
        detail: {
          type: "onactive",
          targetDate: this.timeController.selectedDay
        }
      });
      document.dispatchEvent(evt);
    }

    delete window.history.backfrom
    setTimeout(function() {
      _weekCurrent._createSK();
    }, 300);
  },

  oninactive: function() {
    MultiDay.prototype.oninactive.apply(this, arguments);
    window.removeEventListener('keydown', this._HWkeyHandler, false);
    window.removeEventListener('keydown', this._handleBackEvent, false);
    window.removeEventListener('index-changed', this.onFocusChanged);
    window.removeEventListener('moztimechange', this._changeWeekDate);
    window.removeEventListener('localized', this._changeView);
    window.removeEventListener('week-view-event-add', this.handAddAlldayEvent);

    if(window.location.pathname!='/week/'&&this._weekCurPage==='/week/') {
      _weekCurrent.optionJstr='';
    }
  },

  handleEventFocus: function(focusRects, elementOfEvents) {
    for(let i = 0, len = elementOfEvents.length; i < len; i++) {
      let elementRects = elementOfEvents[i].getClientRects()[0];
      if (!elementRects) {
        continue;
      }

      let isFocused =
        rectangle.isIntersect(rectangle.modifyRect(focusRects, 5),
          elementRects);
      elementOfEvents[i].classList.toggle('md__event_focus', isFocused);
    }
  },

  onFocusChanged: function(e) {
    if (window.location.pathname === '/week/') {
      var focusedItem = e.detail.focusedItem;
      var elementOfEvents = document.querySelectorAll('#week-view a.md__event');
      var focusRects = focusedItem.getClientRects()[0];

      if (!focusRects) {
        return;
      }

      if ('ArrowLeft' === keydownEvent) {
        keydownEvent = null;
        _weekCurrent._updateBaseDate(this.isRtl ? 1 : -1);
      } else if ('ArrowRight' === keydownEvent) {
        keydownEvent = null;
        _weekCurrent._updateBaseDate(this.isRtl ? -1 : 1);
      }

      var weekTitles = document.querySelectorAll('#week-view .md__allday .md__day-name');
      for(var i = 0, len = weekTitles.length; i < len; i++) {
        var weekTitleChilds = weekTitles[i].querySelectorAll('span > span');
        var elementRects = weekTitles[i].getClientRects()[0];
        var isTogether = Math.abs(elementRects.x - focusRects.x) < 10;
        weekTitles[i].classList.toggle('is-curentday', isTogether);
        weekTitleChilds[0].classList.toggle('is-focused', isTogether);
        weekTitleChilds[1].classList.toggle('is-focused', isTogether);
      }

      this.handleEventFocus(focusRects, elementOfEvents, focusDate);
      var header = document.getElementById('current-month-year');
      var oldHeaderText = header.textContent;
      var focusDate;

      if (!focusedItem.dataset.date) {
        var nodeDaySelected = document.querySelectorAll('.md__alldays .md__allday h1.is-curentday');
        focusDate = new Date(nodeDaySelected[0].parentNode.dataset.date);
      } else {
        focusDate = new Date(focusedItem.dataset.date);
      }      

      var preSelectDate = _weekCurrent.preSelectDate === null ? focusDate : _weekCurrent.preSelectDate;
      var weekDay = localeFormat(focusDate, l10n.get('weekDayFormat'));
      var preWeekDay = localeFormat(preSelectDate, l10n.get('weekDayFormat'));
      _weekCurrent.preSelectDate = focusDate;
      var headerL10Lable = l10n.get('week-view-header-format', {
        value: Calc.getWeeksOfYear(focusDate)
      });
      var newHeaderText = localeFormat(focusDate, headerL10Lable);
      header.textContent = newHeaderText;
      var label = focusedItem.getAttribute('aria-label').replace(preWeekDay + ', ', '');
      label = label.replace(weekDay + ', ', '');
      label = label.replace(oldHeaderText + ', ', '');
      if (!Calc.isSameDate(preSelectDate, focusDate)) {
        label = weekDay + ', ' + label;
      }
      if (newHeaderText !== oldHeaderText) {
        label = newHeaderText + ', ' + label;
      }

      focusedItem.setAttribute('aria-label', label);
      nextTick(() => {
        focusedItem.focus();
      });

      if (document.querySelector('.focusBox__weekAllDayChild.focus')) {
        var el = document.querySelector('#week-view .md__separator');
        if (el) {
          el.scrollIntoView(true);
        }
      }

    }
  }
};

});

define('templates/alarm',['require','exports','module','template','date_format'],function(require, exports, module) {


var create = require('template').create;
var dateFormat = require('date_format');

var MINUTE = 60;
var HOUR = 3600;
var DAY = 86400;
var WEEK = 604800;
var MORNING = HOUR * 9;
var layouts = {
  standard: [
    'none',
    0,
    0 - MINUTE * 5,
    0 - MINUTE * 15,
    0 - MINUTE * 30,
    0 - HOUR,
    0 - HOUR * 2,
    0 - DAY
  ],
  allday: [
    'none',
    0 + MORNING,
    0 - DAY + MORNING,
    0 - DAY * 2 + MORNING,
    0 - WEEK + MORNING,
    0 - WEEK * 2 + MORNING
  ]
};

var Alarm = create({
  reminder: function() {
    var alarmContent = '';
    var alarms = this.arg('alarms');
    var isAllDay = this.arg('isAllDay');

    var i = 0;
    var alarm;
    while ((alarm = alarms[i])) {
      i++;
      alarmContent += Alarm.description.render({
        trigger: alarm.trigger,
        layout: isAllDay ? 'allday' : 'standard'
      });
    }

    if (!alarms.length) {
      alarmContent += Alarm.description.render({
        trigger: 'none',
        layout: isAllDay ? 'allday' : 'standard'
      });
    }

    return alarmContent;
  },

  description: function() {
    var {id, data} = getL10n(this.arg('trigger'), this.arg('layout'));
    var args = JSON.stringify(data);
    var description = navigator.mozL10n.get(id, data);

    return `<div role="listitem" data-l10n-id="${id}"
      data-l10n-args=\'${args}\'>
        ${description}
      </div>`;
  },

  // builds a list of <option>
  options: function() {
    var content = '';
    var selected;
    var foundSelected = false;

    var trigger = this.arg('trigger');
    var layout = this.arg('layout') || 'standard';
    var options = layouts[layout];

    var i = 0;
    var iLen = options.length;

    for (; i < iLen; i++) {
      selected = false;

      // trigger option 'selected' by normalizing imported dates
      if (layout === 'allday') {
        if (options[i] === (trigger + MORNING)) {
          trigger += MORNING;
        }
      }

      if (!selected && (trigger || trigger === 0) && options[i] === trigger) {
        selected = true;
        foundSelected = true;
      }

      content += Alarm.option.render({
        selected: selected,
        layout: layout,
        value: options[i]
      });
    }

    return content;
  },

  option: function() {
    var _ = navigator.mozL10n.get;

    var layout = this.arg('layout');
    var value = this.arg('value');
    var selected = this.arg('selected');

    var l10n = getL10n(value, layout);

    var content = [
      '<option',
      'value="' + value + '"',
      (selected ? 'selected' : ''),
      'data-l10n-id="' + l10n.id + '"',
      'data-l10n-args=\'' + JSON.stringify(l10n.data) + '\'>',
      _(l10n.id, l10n.data) + '</option>'
    ].join(' ');

    return content;
  },

  picker: function() {
    return '<span class="button">' +
      '<select class="p-sec" name="alarm[]" data-track-class="modify-event-reminder">' +
        Alarm.options.render(this.data) +
      '</select>' +
    '</span>';
  }
});

function getL10n(trigger, layout) {
  if (trigger === 'none') {
    return {
      id: trigger,
      data: {}
    };
  }

  let timeFormat = '';
  // Format the display text based on a zero-offset trigger
  if (layout === 'allday') {
    var options = layouts.allday;
    if (options.indexOf(trigger) !== -1) {
      trigger -= MORNING;
    }
    timeFormat = navigator.mozHour12 ? '-hour12' : '-hour24';
  }

  if (trigger === 0) {
    return {
      id: 'alarm-at-event-' + layout + timeFormat,
      data: {}
    };
  }

  var affix = trigger > 0 ? 'after' : 'before';
  var parts = dateFormat.relativeParts(trigger);

  for (var i in parts) {
    // we only use the first part (biggest value)
    return {
      id: i + '-' + affix + timeFormat,
      data: {
        value: parts[i]
      }
    };
  }
}
module.exports = Alarm;

});

define('templates/account',['require','exports','module','template'],function(require, exports, module) {


var create = require('template').create;

module.exports = create({
  provider: function() {
    var name = this.h('name');
    return `<li class="${name}" role="presentation">
        <a class="p-pri" data-l10n-id="preset-${name}" role="option" dir="auto"
           data-provider="${name}" href="/create-account/${name}">
        </a>
      </li>`;
  },

  account: function() {
    var id = this.h('id');
    var preset = this.h('preset');
    var user = this.h('user');

    return `<li id="account-${id}" role="listitem" class="focusable">
        <a href="/update-account/${id}" role="option" dir="auto">
          <span class="p-pri user">${user}</span>
          <span class="icon" data-icon="forward"></span>
        </a>
      </li>`;
  }
});

});

define('views/advanced_settings',['require','exports','module','templates/alarm','view','provider/provider_factory','router','templates/account','dom!advanced-settings-view'],function(require, exports, module) {


var AlarmTemplate = require('templates/alarm');
var View = require('view');
var providerFactory = require('provider/provider_factory');
var router = require('router');
var template = require('templates/account');

require('dom!advanced-settings-view');

var ACCOUNT_PREFIX = 'account-';
var lowMemory = false;
var eventHtml = `
  <header id="account-list-header" class="account-list-header" skin="organic" role="heading" aria-level="2">
    <span class="p-sec" data-l10n-id="account-list-header">Accounts</span>
  </header>

  <ol class="account-list link-list" aria-labelledby="account-list-header" role="listbox">
  </ol>

  <ol role="presentation">
    <li class="create-account-item" role="presentation">
      <button class="p-pri focusable create-account" href="/select-preset/" data-l10n-id="advanced-settings-add-account">
        Add Account
      </button>
    </li>
  </ol>

  <header skin="organic">
    <span class="p-sec" data-l10n-id="advanced-settings-personalization">Update Frequency</span>
  </header>

  <ol class="settings-list link-list">
  <li class="focusable">
    <label>
      <span class="p-pri sync" data-l10n-id="sync-frequency">Sync Calendar</span>
      <span class="button">
        <select id="setting-sync-frequency" class="p-sec" name="syncFrequency" data-track-class="sync">
          <option data-l10n-id="sync-frequency-15min" value="15">Every 15 minutes</option>
          <option data-l10n-id="sync-frequency-30min" value="30">Every 30 minutes</option>
          <option data-l10n-id="sync-frequency-manual" value="null">Manually</option>
        </select>
      </span>
    </label>
  </li>
  </ol>`;

function AdvancedSettings(options) {
  View.apply(this, arguments);
  lowMemory = localStorage.getItem('isLowMemoryDevice') === 'true' ?
    true : false;
  if (!lowMemory) {
    var item = document.querySelector('#advanced-settings-view .reminders');
    item.insertAdjacentHTML('beforeBegin', eventHtml);
  }
  this._initEvents();
}
module.exports = AdvancedSettings;

AdvancedSettings.prototype = {
  __proto__: View.prototype,

  selectors: {
    element: '#advanced-settings-view',
    accountList: '#advanced-settings-view .account-list',
    createAccountButton: '#advanced-settings-view .create-account',
    accountListHeader: '#advanced-settings-view .account-list-header',
    syncFrequency: '#setting-sync-frequency',
    standardAlarmLabel: '#default-event-alarm',
    alldayAlarmLabel: '#default-allday-alarm'
  },

  app:{},

  backPath: '/month/',

  self: null,

  get accountList() {
    return this._findElement('accountList');
  },

  get createAccountButton() {
    return this._findElement('createAccountButton');
  },

  get accountListHeader() {
    return this._findElement('accountListHeader');
  },

  get syncFrequency() {
    return this._findElement('syncFrequency');
  },

  get standardAlarmLabel() {
    return this._findElement('standardAlarmLabel');
  },

  get alldayAlarmLabel() {
    return this._findElement('alldayAlarmLabel');
  },

  get standardAlarm() {
    return this.standardAlarmLabel.querySelector('select');
  },

  get alldayAlarm() {
    return this.alldayAlarmLabel.querySelector('select');
  },

  _formatModel: function(model) {
    // XXX: Here for l10n
    return {
      id: model._id,
      preset: model.preset,
      user: model.user,
      hasError: !!model.error
    };
  },

  _displayAccount: function(account) {
    var provider = providerFactory.get(account.providerType);
    return provider.hasAccountSettings;
  },

  _setBackPath: function() {
    if (/^\/(show-multi-events|day|week|month)/.test(router.last.path)) {
      this.backPath = router.last.path;
    }
  },

  _initEvents: function() {
    if (!lowMemory) {
      var account = this.app.store('Account');
      var setting = this.app.store('Setting');

      account.on('add', this._addAccount.bind(this));
      account.on('update', this._updateAccount.bind(this));
      account.on('preRemove', this._removeAccount.bind(this));

      this.createAccountButton.addEventListener('click',this.onCreateAccount.bind(this));
      setting.on('syncFrequencyChange', this);
      this.syncFrequency.addEventListener('change', this);
    }

    this.standardAlarmLabel.addEventListener('change', this);
    this.alldayAlarmLabel.addEventListener('change', this);
  },

  handleBackKey: function(e) {
    if(window.location.pathname === '/advanced-settings/') {
      switch (e.key) {
        case 'Backspace':
        case 'BrowserBack':
            e.preventDefault();
            self.cancel();
            break;
      }
    }
  },

  handleSettingDbChange: function(type, value) {
    switch (type) {
      case 'syncFrequencyChange':
        this.syncFrequency.value = String(value);
        break;
    }
  },

  cancel: function() {
    router.go(this.backPath);
  },

  handleSettingUiChange: function(type, value) {
    var store = this.app.store('Setting');
    // basic conversions
    if (value === 'null') {
      value = null;
    }

    switch (type) {
      case 'alldayAlarmDefault':
      case 'standardAlarmDefault':
      case 'syncFrequency':
        if (value !== null && value !== 'none') {
          value = parseInt(value);
        }
        if (type === 'standardAlarmDefault') {
          this.app.standarReminder = value;
        } else if (type === 'alldayAlarmDefault') {
          this.app.alldayReminder = value;
        }

        store.set(type, value);
        Toaster.showToast({
          messageL10nId: 'kai-change-save',
          latency: 2000,
        });
        break;
    }
  },

  handleEvent: function(event) {
    switch (event.type) {
      case 'change':
        var target = event.target;
        this.handleSettingUiChange(target.name, target.value);
        break;
      case 'syncFrequencyChange':
        this.handleSettingDbChange(event.type, event.data[0]);
        break;
    }
  },

  onCreateAccount: function(event) {
    event.stopPropagation();
    event.preventDefault();
    router.show(event.target.getAttribute('href'));
  },

  _addAccount: function(id, model) {
    if (!this._displayAccount(model)) {
      return;
    }

    var idx = this.accountList.children.length;
    var item = template.account.render(this._formatModel(model));
    this.accountList.insertAdjacentHTML('beforeend', item);

    if (model.error) {
      this.accountList.children[idx].classList.add('error');
    }
  },

  _updateAccount: function(id, model) {
    var elementId = this.idForModel(ACCOUNT_PREFIX, id);
    var el = document.querySelector("#" + elementId);
    if (!el) {
      return console.error(
        'trying to update account that was not rendered',
        id,
        elementId
      );
    }

    if (el.classList.contains('error') && !model.error) {
      el.classList.remove('error');
    }

    if (model.error) {
      el.classList.add('error');
    }
  },

  _removeAccount: function(id) {
    var el = document.querySelector("#" + this.idForModel(ACCOUNT_PREFIX, id));

    if (el) {
      /** @type {Node} */
      var parentNode = el.parentNode;
      parentNode.removeChild(el);
    }
  },

  render: function() {
    var self = this;
    var pending = 4;

    function next() {
      if (!--pending && self.onrender) {
        self.onrender();
      }
    }

    function renderSyncFrequency(err, value) {
      self.syncFrequency.value = String(value);
      next();
    }

    function renderAccounts(err, accounts) {
      var elements = Array.prototype.slice.call(self.accountList
                                          .querySelectorAll('.user'));
      elements.forEach(function(element) {
        element.parentChild.removeChild(element);
      });

      for (var id in accounts) {
        self._addAccount(id, accounts[id]);
      }

      next();
    }

    function renderAlarmDefault(type) {
      return function(err, value) {

        var element = type + 'AlarmLabel';
        var existing = self[element].querySelector('select');

        if (existing) {
          existing.parentNode.removeChild(existing);
        }

        // Render the select box
        var template = AlarmTemplate;
        var select = document.createElement('select');
        select.classList.add('p-sec');
        select.name = type + 'AlarmDefault';
        select.innerHTML = template.options.render({
          layout: type,
          trigger: value
        });
        self[element].querySelector('.button').appendChild(select);

        var parentLi = self.getParents(select,"LI");
        var titleClass = parentLi.querySelector(".option-title").getAttribute("data-title-class");
        select.setAttribute("data-track-class",titleClass);

        next();
      };
    }

    var settings = this.app.store('Setting');
    var accounts = this.app.store('Account');

    settings.getValue('syncFrequency', renderSyncFrequency);
    settings.getValue('standardAlarmDefault', renderAlarmDefault('standard'));
    settings.getValue('alldayAlarmDefault', renderAlarmDefault('allday'));
    accounts.all(renderAccounts);
  },

  oninactive: function() {
    View.prototype.oninactive.apply(this, arguments);
    window.removeEventListener('keydown', this.handleBackKey, false);
  },

  onactive: function() {
    this.seen = false;
    View.prototype.onactive.apply(this, arguments);
    self = this;
    this._setBackPath();
    window.addEventListener('keydown', this.handleBackKey, false);
    this.createSks();
  },

  createSks: function() {
    var skDefaultCSK = {
      name: 'select',
      l10nId: 'select',
      priority: 2,
      method: function() {}
    };
    var params = [skDefaultCSK];
    this.app.createSks(params);
  },

  getParents: function(node,tagName){
    var parent = node.parentNode;
    var tag = tagName.toUpperCase();
    if(parent.tagName == tag){
      return parent;
    }else {
      return this.getParents(parent,tag);
    }
  }
};

AdvancedSettings.prototype.onfirstseen = AdvancedSettings.prototype.render;

});

define('views/create_account',['require','exports','module','presets','view','templates/account','router','models/account','dom!create-account-view'],function(require, exports, module) {


var Presets = require('presets');
var View = require('view');
var template = require('templates/account');
var router = require('router');
var Account = require('models/account');

require('dom!create-account-view');

function CreateAccount(options) {
  View.apply(this, arguments);
  this.cancel = this.cancel.bind(this);
}
module.exports = CreateAccount;

CreateAccount.prototype = {
  __proto__: View.prototype,

  _changeToken: 0,

  presets: Presets,

  self: null,

  selectors: {
    element: '#create-account-view',
    accounts: '#account-list',
  },

  get accounts() {
    return this._findElement('accounts');
  },

  cancel: function() {
    router.show('/advanced-settings/');
  },


  _createModel: function(preset, callback) {
    var settings = Presets[preset];
    var model = new Account(settings.options);
    model.preset = preset;
    return model;
  },

  managerGetExchangeCredentials: function(aAccount, model, refreshCredential,
    result) {
    navigator.accountManager.getCredential(aAccount,
      {refreshCredential: refreshCredential}).then((credentials) => {
      model.exchange = {
        server: credentials.configInfo.server,
        deviceId: credentials.configInfo.deviceId,
        policyKey: credentials.configInfo.policyKey
      }
      model.accountId = result.accountId;
      model.user = credentials.username;
      model.password = credentials.password;
      model.syncFlag = true;

      let self = this;
      let accountStore = this.app.store('Account');
      let calendarStore = this.app.store('Calendar');
      accountStore.verifyAndPersistNew(model, (accErr, id, result) => {
        if (accErr) {
          return;
        }

        // finally sync the account so when
        // we exit the request the user actually
        // has some calendars. This should not take
        // too long (compared to event sync).
        accountStore.syncCalendars(result, (syncErr) => {
          if (syncErr) {
            return;
          }

          self.app.syncController.all();
          router.show('/advanced-settings/');
        });
      });
    }, (reason) => {
      console.log("getCredentials rejected: " + reason);
    });
  },

  managerGetGoogleCredentials: function(aAccount, model, refreshCredential) {
    navigator.accountManager.getCredential(aAccount,
      {refreshCredential: refreshCredential}).then((credentials) => {
      model.oauth = {
        access_token: credentials.access_token,
        issued_at: Date.now(),
        expires_in: 0,
        token_type: credentials.token_type,
        id_token: null,
        refresh_token: null,
        scope: null
      }
      model.oauth.expires_in =
        credentials.expire_timestamp - model.oauth.issued_at;
      model.user = aAccount.accountId;
      model.calendarHome = '/caldav/v2/' +
        aAccount.accountId.replace(/@/g, '%40');
      model.syncFlag = true;

      let accountStore = this.app.store('Account');
      let calendarStore = this.app.store('Calendar');
      accountStore.verifyAndPersistNew(model, (accErr, id, result) => {

        if (accErr) {
          return;
        }

        accountStore.sync(result, function(syncErr) {
          if (syncErr) {
            return;
          }

          function syncCalendars(err, calendars) {
            if (err) {
              console.error('Error fetch calendar list in account creation');
              return;
            }

            // note we don't wait for any of this to complete
            // we just begin the sync and let the event handlers
            // on the sync controller do the work.
            for (var key in calendars) {
              if (model.preset !== 'google' ||
                result.user === calendars[key].remote.name) {
                self.app.syncController.calendar(
                  result,
                  calendars[key]
                );
              }
            }

            router.show('/advanced-settings/');
          }

          // begin sync of calendars
          calendarStore.remotesByAccount(
            result._id,
            syncCalendars
          );
        });
      });
    }, (reason) => {
      console.log("getCredentials rejected: " + reason);
    });
  },

  managerGetAccounts: function(accountType, result) {
    navigator.accountManager.getAccounts().then((accounts) => {
      for (let i = 0; i < accounts.length; i++) {
        let model = {};
        if (accounts[i].authenticatorId === accountType &&
          accounts[i].accountId === result.accountId) {
          model = self._createModel(accounts[i].authenticatorId);
          if (accountType === 'google') {
            self.managerGetGoogleCredentials(accounts[i], model, false);
          } else if (accountType === 'activesync') {
            self.managerGetExchangeCredentials(accounts[i],
              model, false, result);
          }
        }
      }
    });
  },

  handleLoginError: function(reason) {
    let toastId = null;

    switch(reason) {
      case 'no network':
        toastId = 'error-offline';
        break;
      case 'error':
        toastId = 'error-account';
        break;
      case 'access denied':
        toastId = 'error-access-denied';
        break;
      case 'duplicate_account':
        self.app.duplicateAccount = true;
        toastId = 'account-duplicate';
        break;
    }

    if (toastId) {
      Toaster.showToast({
        messageL10nId: toastId
      });
    }
  },

  updateDisplayUI: function(isSyncing) {
    let accountHeadeItem =
      document.querySelector("#create-account-view #create-account-header");
    let accountListItem =
      document.querySelector("#create-account-view #account-list");
    let syncAccountHeaderItem =
      document.querySelector("#create-account-view .sync-account-header");
    let syncAccountBodyItem =
      document.querySelector("#create-account-view .sync-account-body");

    accountHeadeItem.classList.toggle('hidden', isSyncing);
    accountListItem.classList.toggle('hidden', isSyncing);
    syncAccountHeaderItem.classList.toggle('hidden', !isSyncing);
    syncAccountBodyItem.classList.toggle('hidden', !isSyncing);
  },

  showLoginPage: function(accountType) {
    let authenticator =  { authenticatorId: accountType };

    let params = [];
    self.app.createSks(params);
    self.updateDisplayUI(true);
    navigator.accountManager.showLoginPage(authenticator).then((result) => {
      self.app.loginAccount = false;
      self.managerGetAccounts(accountType, result);
    }, (reason) => {
      self.app.loginAccount = false;
      self._createSKbar();
      self.updateDisplayUI(false);
      self.handleLoginError(reason);
    });
  },

  handleBackKey: function(e) {
    switch(e.key){
      case 'Enter':
        if(!self.app.loginAccount) {
          let googleItem = document.querySelector('li.google.focus');
          let activesyncItem = document.querySelector('li.exchange.focus');
          if (googleItem) {
            self.app.loginAccount = true;
            self.showLoginPage('google');
          } else if (activesyncItem) {
            self.app.loginAccount = true;
            self.showLoginPage('activesync');
          } else {
            if (navigator.mozWifiManager &&
              navigator.mozWifiManager.connection &&
              navigator.mozWifiManager.connection.status === 'connected') {
              router.go('/create-account/caldav');
            } else {
              self.app.getAllDataState().then((results) => {
                let connectFlag = false;
                for (let i = 0; i < results.length; i++) {
                  if (results[i] === 'connected') {
                    connectFlag = true;
                    break;
                  }
                }
                if (connectFlag) {
                  router.go('/create-account/caldav');
                } else {
                  Toaster.showToast({
                    messageL10nId: 'error-offline'
                  });
                }
              })
            }
          }
          setTimeout(()=>{
            self.app.loginAccount = false;
          },1000)
        }
        break;
      case 'Backspace':
        //When logging in the account,pressing the return key continuously will result in
        // the inability to enter the login interface again.
        // This is due to the fact that pressing the return key too soon and entering the error handling,
        // which makes the `loginAccount` value always true. When pressing the return key here,
        // set it to false to solve this problem
        self.app.loginAccount = false;
        e.preventDefault();
        self.cancel();
        break;
      case 'BrowserBack':
        e.preventDefault();
        self.cancel();
        break;
    }
  },

  _initbackFocus: function() {
      if(/^\/create-account\//.test(router.last.path)){
          NavigationMap.setMultiResetValue(true);
      }
  },

  _init: function() {
    self = this;
    this._createSKbar();
    this._initbackFocus();
    this._createAccount();
    window.addEventListener('keydown', this.handleBackKey, true);
  },

  _createSKbar: function() {
    var params = [
      {
        name: 'Cancel',
        l10nId: 'cancel',
        priority: 1,
        method: function() {
          self.cancel();
        }
      },
      {
        name: 'select',
        l10nId: 'select',
        priority: 2,
        method: function() {}
      }
    ];
    self.app.createSks(params);
  },

  oninactive: function() {
    this.updateDisplayUI(false);
    View.prototype.oninactive.apply(this, arguments);
    window.removeEventListener('keydown', this.handleBackKey, true);
    NavigationMap.setMultiResetValue(false);
  },

  onactive: function() {
    this.updateDisplayUI(false);
    View.prototype.onactive.apply(this, arguments);
    this._init();
  },

  _createAccount: function() {
     var model = document.querySelector("#model-createAccount");
     var list = document.querySelector("#account-list");
     var activesyncItem = model.querySelector('.exchange');
     var emailPreload = false;
     window.navigator.mozApps.mgmt.getAll().then((apps) => {
      for (let i = 0; i < apps.length; i++) {
        if (apps[i].manifestURL
          === 'app://email.gaiamobile.org/manifest.webapp') {
          emailPreload = true;
          break;
        }
      }

      if (emailPreload) {
        activesyncItem.classList.remove('hidden');
        activesyncItem.classList.add('focusable');
      } else {
        activesyncItem.classList.add('hidden');
        activesyncItem.classList.remove('focusable');
      }
      list.innerHTML = model.innerHTML;
    });
  }
};

});

define('views/day',['require','exports','module','./multi_day','querystring','router','app','provider/caldav','calc','rectangle','notification','provider/local','shared/input_parser','dom!day-view'],function(require, exports, module) {


var MultiDay = require('./multi_day');
var QueryString = require('querystring');
var router = require('router');
var app = require('app');
var CaldavProvider = require('provider/caldav');
var calc = require('calc');
var rectangle = require('rectangle');
var notification = require('notification');
var Local = require('provider/local');
var InputParser = require('shared/input_parser');
require('dom!day-view');

var dateItemDay = document.querySelector('.select-value .date-hidden-input');
var valueItemDay = document.querySelector('.select-value .calendarId-select');

var skAddEvent = {
  name: 'Add Event',
  l10nId: 'add-event',
  priority: 1,
  method: function() {
    console.log('Add Event');
    self._addEvent();
  }
};

var skMonthView = {
  name: 'Month View',
  l10nId: 'month-view',
  priority: 5,
  method: function () {
    console.log('Month View');
    window.history.backfrom = 'day-view';
    router.go('/month/');
  }
};

var skWeeklyView = {
  name: 'Week View',
  l10nId: 'week-view',
  priority: 5,
  method: function () {
    console.log('Weekly View');
    router.go('/week/');
  }
};

var skCurrentDate = {
  name: 'Today',
  l10nId: 'today',
  priority: 5,
  method: function () {
    var today = new Date();
    dateItemDay.value = InputParser.exportDate(today);
    self.timeController.selectedDay = today;
    var selectedHour = today.getHours();
    var state = {
      eventStartHour: selectedHour
    }
    router.go('/day/',state);
  }
};

var skGoToDate = {
  name: 'Go to Date',
  l10nId: 'go',
  priority: 5,
  method: function () {
    valueItemDay.dataset.valueFlag = 1;
    dateItemDay.focus();
  }.bind(this)
};

var skSearch = {
  name: 'Search',
  l10nId: 'search',
  priority: 5,
  method: function () {
    console.log('Search');
    router.go('/search/');
  }
};

var skCalendarsToDisplay = {
  name: 'Calendars to Display',
  l10nId: 'calendar-to-display',
  priority: 5,
  method: function () {
    console.log('Calendars to Display');
    valueItemDay.dataset.valueFlag = 2;
    valueItemDay.focus();
  }
};

var skSync = {
  name: 'Sync calendar',
  l10nId: 'sync-calendar',
  priority: 5,
  method: function () {
    self.app.syncController.all();
  }
};

var skSettings = {
  name: 'Settings',
  l10nId: 'settings',
  priority: 5,
  method: function () {
    console.log('Settings');
    router.go('/advanced-settings/');
  }
};

var skDefaultCSK = {
  name: 'select',
  l10nId: 'select',
  priority: 2,
  method: function() {}
};

var currentMenuOptionActions = [
    skAddEvent, skDefaultCSK, skMonthView, skWeeklyView,
    skGoToDate, skSearch,
    skCalendarsToDisplay, skSync, skSettings];

var menuOptionActions = [
    skAddEvent, skDefaultCSK, skMonthView, skWeeklyView,
    skCurrentDate, skGoToDate, skSearch,
    skCalendarsToDisplay, skSync, skSettings];

var currentMenuOptionActionsNoSync = [
    skAddEvent, skDefaultCSK, skMonthView, skWeeklyView,
    skGoToDate, skSearch,
    skCalendarsToDisplay, skSettings];

var menuOptionActionsNoSync = [
    skAddEvent, skDefaultCSK, skMonthView, skWeeklyView,
    skCurrentDate, skGoToDate, skSearch,
    skCalendarsToDisplay, skSettings];

var currentMenuOptionActionsLowMem = [
    skAddEvent, skDefaultCSK, skMonthView, skWeeklyView,
    skGoToDate, skSearch, skSettings];

var menuOptionActionsLowMem = [
    skAddEvent, skDefaultCSK, skMonthView, skWeeklyView,
    skCurrentDate, skGoToDate, skSearch, skSettings];

function DayView(opts) {
  MultiDay.apply(this, arguments);
  this._setDefaultEvents();
}
module.exports = DayView;

DayView.prototype = {
  __proto__: MultiDay.prototype,

  self: null,
  scale: 'day',
  visibleCells: 1,
  deleteDialogShown: false,
  focusedEvents: {
    events: [],
    type: ''
  },

  get element() {
    return document.getElementById('day-view');
  },

  _setDefaultEvents: function() {
    this.delegate(this.element, 'click', '.md__allday-events,li.md__hour', this._clickHourHandler.bind(this));
  },

  updateFocusedItemMenu: function() {
    new Promise(function checkevent(resolve) {
      var events = self.focusedEvents.events;
      var isToday = calc.isToday(self.timeController.selectedDay);
      var actions = null;

      if (self.app.lowMemory) {
        actions = isToday ? currentMenuOptionActionsLowMem.slice() :
          menuOptionActionsLowMem.slice();
      } else {
        if (self.app.calendarIdNum > 1) {
          actions = isToday ? currentMenuOptionActions.slice() :
            menuOptionActions.slice();
        } else {
          actions = isToday ? currentMenuOptionActionsNoSync.slice() :
            menuOptionActionsNoSync.slice();
        }
      }

      resolve(actions);
    }).then(function(results) {
      self.updateSKs(results);
    });
  },

  _clickHourHandler: function(e, target) {
    if (e.target.tagName === 'A') {
      var siblingEvents = e.target.parentNode.querySelectorAll('.md__event.is-allday');
      if (siblingEvents.length > 1 ||
          (siblingEvents.length === 1 && e.target.classList.contains('md__add-event'))) {
        e.preventDefault();
        return;
      }
    }

    var events = this.focusedEvents.events;
    if (events.length > 0 && events[0].classList.contains('is-allday')) {
      var query = '#day-view .md__allday[aria-hidden="false"] a.md__event';
      events = document.querySelectorAll(query);
    }

    if (events.length === 0) {
      this._addEvent();
    } else if (events.length === 1) {
      events[0].click();
    } else if (events.length > 1) {
      var param = this.focusedEvents.type === 'hour' ?
          {date: this.baseDate, hour: this._getHourBaseOnClick(), isAllDay: false} :
          {date: this.baseDate, hour: this._getHourBaseOnClick(), isAllDay: true}

      router.go('/show-multi-events/', param);
    }
  },

  updateSKs:function(actions){
    this.app.createSks(actions);
  },

  _getHourBaseOnClick: function() {
    var current_focus_element = this.element.querySelector(".focus");
    if (current_focus_element.classList.contains('md__allday-events')) {
      return "allday";
    }else if (current_focus_element.classList.contains('focusBox_dayHour')) {
      return current_focus_element.getAttribute('data-hour');
    }
  },

  _addEvent: function() {
    var hour = this._getHourBaseOnClick();
    var queryString = {};
    var _get_start_date = new Date(this.baseDate.getTime());
    var _get_end_date = new Date(this.baseDate.getTime());
    if (hour === "allday") {
      queryString.isAllDay = true;
      _get_end_date.setDate(_get_start_date.getDate() + 1);
    } else {
      // If it's not all day the hour must be a number.
      hour = parseInt(hour);
      _get_start_date.setHours(hour);
      _get_end_date.setHours(hour + 1);
    }

    queryString.startDate = _get_start_date.toString();
    queryString.endDate = _get_end_date.toString();
    router.go('/event/add/?' + QueryString.stringify(queryString));
  },

  handleKeyEvent: function(e) {
    var warningDialog = document.querySelector('gaia-confirm');
    if (warningDialog && e.key !== 'MicrophoneToggle') {
      e.preventDefault();
      return;
    }

    if (!app.skPanel.menuVisible) {
      if (window.location.pathname === '/day/') {
        if (e.key === 'ArrowLeft') {
          self._updateBaseDate(-1);
          self.removeHideElementFocus();
          NavigationMap.reset('day-view');
        } else if (e.key === 'ArrowRight') {
          self._updateBaseDate(1);
          self.removeHideElementFocus();
          NavigationMap.reset('day-view');
        }
      }
    } else {
      var item = document.querySelector('.menu-button.focus');
      if (item) {
        item.scrollIntoView(false);
      }
    }
  },

  _updateDayDate: function(value) {
    if (window.location.pathname === '/day/' &&
      valueItemDay.dataset.valueFlag === '1' && value === 0) {
      NavigationMap.menuUpdate();

      if (dateItemDay.value) {
        valueItemDay.dataset.valueFlag = null;

        var selected = InputParser.importDate(dateItemDay.value);
        var date = new Date(selected.year, selected.month, selected.date);
        this.timeController.selectedDay = date;

        var selectedHour = date.getHours();
        var state = {
          eventStartHour: selectedHour
        }
        router.go('/day/',state);
      }
    }
  },

  onactive: function() {
    MultiDay.prototype.onactive.apply(this, arguments);
    window.addEventListener('keydown', this.handleKeyEvent, false);
    window.addEventListener('index-changed', this.onFocusChanged);
    window.addEventListener('moztimechange', this._changeDayDate);
    window.addEventListener('day-view-event-add', this.onFocusChanged);

    if (!dateItemDay.dataset.inputEventDay){
      SettingsListener.observe('selectOptionPopup.state', 0,
        this._updateDayDate.bind(this));
      dateItemDay.dataset.inputEventDay = true;
    }

    self = this;
    if (/^\/(month|week|switchto-date)/.test(router.last.path)) {
        window.history.state.selectedDay = self.timeController.selectedDay;
    } else {
      delete window.history.state.selectedDay;
    }

    if (this.app.lowMemory) {
      this.updateSKs(currentMenuOptionActionsLowMem);
    } else {
      if (this.app.calendarIdNum > 1) {
        this.updateSKs(currentMenuOptionActions);
      } else {
        this.updateSKs(currentMenuOptionActionsNoSync);
      }
    }

    this.removeHideElementFocus();
    var el = document.getElementById('time-views');
    if (el) {
      el.removeAttribute('role');
    }
  },

  removeHideElementFocus:function(){
    var allDayEventItems  = document.querySelectorAll("#day-view .md__allday-events");
    for(var i =0;i<allDayEventItems.length;i++){
       var item = allDayEventItems[i];
      if(item.parentNode.attributes["aria-hidden"].value=="true"){
        item.classList.remove("focusable");
      }else{
        item.classList.add("focusable");
      }
    }
  },

  onFocusChanged: function _dayViewOnFocusChanged(e) {
    if (window.location.pathname === '/day/') {
      var focusedItem = e.detail.focusedItem;
      var query = '#day-view .md__allday[aria-hidden="false"] a.md__event, ' +
          '#day-view .md__day[aria-hidden="false"] a.md__event';
      var elementOfEvents = document.querySelectorAll(query);
      var focusRects = focusedItem.getClientRects()[0];

      self.focusedEvents.events = [];
      self.focusedEvents.type = focusedItem.classList.contains('md__allday-events') ?
          'alldays' : 'hour';

      if (self.focusedEvents.type === 'alldays') {
        var el = document.querySelector('#day-view .md__separator');
        if (el) {
          el.scrollIntoView(true);
        }
      }

      for(var i = 0, len = elementOfEvents.length; i < len; i++) {
        var elementRects = elementOfEvents[i].getClientRects()[0];
        if (!elementRects) {
          continue;
        }
        var isFocused = rectangle.isIntersect(rectangle.modifyRect(focusRects, 5), elementRects);
        elementOfEvents[i].classList.toggle('md__event_focus', isFocused);
        if (isFocused) {
          self.focusedEvents.events.push(elementOfEvents[i]);
        }
      }

      self.updateFocusedItemMenu();
    }
  },

  _changeDayDate: function() {
    var today = new Date();
    dateItemDay.value = InputParser.exportDate(today);
    self.timeController.selectedDay = today;
    self.app._setPresentDate();
    var selectedHour = today.getHours();
    var state = {
      eventStartHour: selectedHour
    }
    router.go('/day/',state);
  },

  oninactive: function() {
    MultiDay.prototype.oninactive.apply(this, arguments);
    window.removeEventListener('keydown', this.handleKeyEvent, false);
    window.removeEventListener('index-changed', this.onFocusChanged);
    window.removeEventListener('moztimechange', this._changeDayDate);
    window.removeEventListener('day-view-event-add', this.onFocusChanged);

    var el = document.getElementById('time-views');
    if (el) {
      el.setAttribute('role', 'heading');
    }
  }
};

});

define('utils/account_creation',['require','exports','module','responder','app','promise'],function(require, exports, module) {


var Responder = require('responder');
var app = require('app');
var denodeifyAll = require('promise').denodeifyAll;

/**
 * Helper class to create accounts.
 * Emits events during the process of
 * creation to allow views to hook into
 * the full cycle while further separating
 * this logic from their own.
 *
 *
 * Events:
 *
 *    - authorize
 *    - calendar sync
 *
 *
 * @param {Calendar.App} app instance of app.
 */
function AccountCreation() {
  this.app = app;
  Responder.call(this);

  denodeifyAll(this, [ 'send' ]);
}
module.exports = AccountCreation;

AccountCreation.prototype = {
  __proto__: Responder.prototype,

  /**
   * Sends a request to create an account.
   *
   * @param {Calendar.Models.Account} model account details.
   * @param {Function} callback fired when entire transaction is complete.
   */
  send: function(model, callback) {
    var self = this;
    var accountStore = this.app.store('Account');
    var calendarStore = this.app.store('Calendar');

    // begin by persisting the account
    accountStore.verifyAndPersist(model, function(accErr, id, result) {

      if (accErr) {
        // we bail when we cannot create the account
        // but also give custom error events.
        self.emit('authorizeError', accErr);
        callback(accErr);
        return;
      }


      self.emit('authorize', result);

      // finally sync the account so when
      // we exit the request the user actually
      // has some calendars. This should not take
      // too long (compared to event sync).
      accountStore.sync(result, function(syncErr) {
        if (syncErr) {
          self.emit('calendarSyncError', syncErr);
          callback(syncErr);
          return;
        }

        function syncCalendars(err, calendars) {
          if (err) {
            console.error('Error fetch calendar list in account creation');
            return callback(err);
          }

          self.emit('calendarSync');

          // note we don't wait for any of this to complete
          // we just begin the sync and let the event handlers
          // on the sync controller do the work.
          for (var key in calendars) {
            self.app.syncController.calendar(
              result,
              calendars[key]
            );
          }

          callback(null, result);
        }

        // begin sync of calendars
        calendarStore.remotesByAccount(
          result._id,
          syncCalendars
        );
      });
    });
  }
};

});

define('oauth_window',['require','exports','module','querystring','view','dom!oauth2'],function(require, exports, module) {


var QueryString = require('querystring');
var View = require('view');

require('dom!oauth2');

/**
 * Creates a oAuth dialog given a set of parameters.
 *
 *    var oauth = new OAuthWindow(
 *      elementContainer,
 *      'https://accounts.google.com/o/oauth2/auth',
 *      {
 *        response_type: 'code',
 *        client_id: 'xxx',
 *        scope: 'https://www.googleapis.com/auth/calendar',
 *        redirect_uri: 'xxx',
 *        state: 'foobar',
 *        access_type: 'offline',
 *        approval_prompt: 'force'
 *      }
 *    );
 *
 *    oauth.oncomplete = function(evt) {
 *      if (evt.detail.code) {
 *        // success
 *      }
 *    };
 *
 *    oauth.onabort = function() {
 *      // oauth was aborted
 *    };
 *
 *
 */
function OAuthWindow(container, server, params) {
  if (!params.redirect_uri) {
    throw new Error(
      'must provide params.redirect_uri so oauth flow can complete'
    );
  }

  this.params = {};
  for (var key in params) {
    this.params[key] = params[key];
  }

  this._element = container;

  View.call(this);
  this.target = server + '?' + QueryString.stringify(params);

  this._handleUserTriggeredClose =
    this._handleUserTriggeredClose.bind(this);
}
module.exports = OAuthWindow;

OAuthWindow.prototype = {
  __proto__: View.prototype,

  get element() {
    return this._element;
  },

  get isOpen() {
    return !!this.browserFrame;
  },

  selectors: {
    browserHeader: 'header',
    browserTitle: 'header > h1',
    browserContainer: '.browser-container'
  },

  get browserContainer() {
    return this._findElement('browserContainer', this.element);
  },

  get browserTitle() {
    return this._findElement('browserTitle', this.element);
  },

  get browserHeader() {
    return this._findElement('browserHeader', this.element);
  },

  _handleFinalRedirect: function(url) {
    this.close();

    if (this.oncomplete) {
      var params;

      // find query string
      var queryStringIdx = url.indexOf('?');
      if (queryStringIdx !== -1) {
        params = QueryString.parse(url.slice(queryStringIdx + 1));
      }

      this.oncomplete(params || {});
    }
  },

  _handleLocationChange: function(url) {
    this.browserTitle.textContent = url;
  },

  _handleUserTriggeredClose: function() {
    // close the oauth flow
    this.close();

    // trigger an event so others can cleanup
    if (this.onabort) {
      this.onabort();
    }
  },

  handleEvent: function(event) {
    switch (event.type) {
      case 'mozbrowserlocationchange':
        var url = event.detail;
        if (url.indexOf(this.params.redirect_uri) === 0) {
          return this._handleFinalRedirect(url);
        }
        this._handleLocationChange(url);
        break;
    }
  },

  open: function() {
    if (this.browserFrame) {
      throw new Error('attempting to open frame while another is open');
    }

    // add the active class
    this.element.classList.add(View.ACTIVE);

    // handle cancel events
    this.browserHeader.addEventListener(
      'action', this._handleUserTriggeredClose
    );

    // setup browser iframe
    var iframe = this.browserFrame =
      document.createElement('iframe');

    iframe.setAttribute('mozbrowser', true);
    iframe.setAttribute('src', this.target);

    this.browserContainer.appendChild(iframe);

    iframe.addEventListener('mozbrowserlocationchange', this);
  },

  close: function() {
    if (!this.isOpen) {
      return;
    }

    this.browserFrame.removeEventListener(
      'mozbrowserlocationchange', this
    );

    this.browserHeader.removeEventListener(
      'action', this._handleUserTriggeredClose
    );

    this.element.classList.remove(View.ACTIVE);

    this.browserFrame.parentNode.removeChild(
      this.browserFrame
    );

    this.browserFrame = undefined;
  }
};

});

define('utils/uri',['require','exports','module'],function(require, exports) {


/**
 * Get the port of the url.
 * @param {string} url full url.
 * @return {?number} port number, null if none found.
 */
exports.getPort = function(url) {
  var parts = url.split(':');
  if (parts.length < 2) {
    return null;
  }

  // If we found a port and path, it's the last part
  var candidate = parts[parts.length - 1];
  parts = candidate.split('/');

  // If we found a port, it's the first part
  candidate = parts[0];
  if (!isInteger(candidate)) {
    return null;
  }

  return parseInt(candidate, 10);
};

/**
 * Get the scheme of the url. Note that this only detects http and https.
 * @param {string} url full url.
 * @return {?string} uri scheme (ie http), null if none found.
 */
exports.getScheme = function(url) {
  var parts = url.split(':');
  if (parts.length < 2) {
    return null;
  }


  // If we found a scheme, it's the first part
  var candidate = parts[0];
  if (candidate !== 'http' && candidate !== 'https') {
    return null;
  }

  return candidate;
};

/**
 * Decide whether or not this string represents an integer.
 * @param {string} str some string.
 * @param {boolean} whether or not str represents an integer.
 */
function isInteger(str) {
  return (/^\d+$/).test(str);
}

});

define('views/modify_account',['require','exports','module','models/account','utils/account_creation','oauth_window','presets','utils/uri','view','router','dom!modify-account-view'],function(require, exports, module) {


var Account = require('models/account');
var AccountCreation = require('utils/account_creation');
var OAuthWindow = require('oauth_window');
var Presets = require('presets');
var URI = require('utils/uri');
var View = require('view');
var router = require('router');

require('dom!modify-account-view');

var DEFAULT_AUTH_TYPE = 'basic';
var OAUTH_AUTH_CREDENTIALS = [
  'client_id',
  'scope',
  'redirect_uri',
  'state'
];

function ModifyAccount(options) {
  View.apply(this, arguments);

  this.deleteRecord = this.deleteRecord.bind(this);
  this.cancel = this.cancel.bind(this);
  this.displayOAuth2 = this.displayOAuth2.bind(this);
  this.hideHeaderAndForm = this.hideHeaderAndForm.bind(this);
  this.cancelDelete = this.cancelDelete.bind(this);

  this.accountHandler = new AccountCreation(this.app);
  this.accountHandler.on('authorizeError', this);

  // bound so we can add remove listeners
  this._boundSaveUpdateModel = this.save.bind(this, { updateModel: true });
}
module.exports = ModifyAccount;

ModifyAccount.prototype = {
  __proto__: View.prototype,

  _changeToken: 0,

  syncStatus: false,
  isUpdate: false,

  selectors: {
    element: '#modify-account-view',
    form: '.modify-account-form',
    fields: '*[name]',
    deleteButton: '#modify-account-view .delete-confirm',
    cancelDeleteButton: '#modify-account-view .delete-cancel',
    header: '#modify-account-header',
    status: '#modify-account-view section[role="status"]',
    errors: '#modify-account-view .errors',
    oauth2Window: '#oauth2',
    oauth2SignIn: '#modify-account-view .force-oauth2',
    accountUser: '#modify-account-view #acc-user',
    accountPassword: '#modify-account-view #acc-password',
    showPassword: '#modify-account-view #showPwd-li',
    accountUrl: '#modify-account-view #acc-url',
    accUserName: '#modify-account-view #acc-user-name',
    accSyncAccount: '#modify-account-view #acc-sync-account',
  },

  progressClass: 'in-progress',
  removeDialogClass: 'remove-dialog',

  get accUserName() {
    return this._findElement('accUserName');
  },

  get accSyncAccount() {
    return this._findElement('accSyncAccount');
  },

  get accountUser() {
    return this._findElement('accountUser');
  },

  get accountPassword() {
    return this._findElement('accountPassword');
  },

  get showPassword() {
    return this._findElement('showPassword');
  },

  get accountUrl() {
    return this._findElement('accountUrl');
  },

  get authenticationType() {
    if (this.preset && this.preset.authenticationType) {
      return this.preset.authenticationType;
    }

    return DEFAULT_AUTH_TYPE;
  },

  get oauth2Window() {
    return this._findElement('oauth2Window');
  },

  get oauth2SignIn() {
    return this._findElement('oauth2SignIn');
  },

  get deleteButton() {
    return this._findElement('deleteButton');
  },

  get cancelDeleteButton() {
    return this._findElement('cancelDeleteButton');
  },

  get header() {
    return this._findElement('header');
  },

   get form() {
    return this._findElement('form');
  },

  get fields() {
    if (!this._fields) {
      var result = this._fields = {};
      var elements = this.element.querySelectorAll(
        this.selectors.fields
      );

      var i = 0;
      var len = elements.length;

      for (i; i < len; i++) {
        var el = elements[i];
        result[el.getAttribute('name')] = el;
      }
    }

    return this._fields;
  },

  _init: function() {
    self = this;
    window.addEventListener('keydown', this.handleSKEvent);
    self.fields['user'].addEventListener('input', self._skbarListener);
    self.fields['password'].addEventListener('input', self._skbarListener);
    self.fields['password'].type = 'password';
    self.fields['fullUrl'].addEventListener('input', self._skbarListener);
    self.fields['showPwd'].addEventListener('change', function(e) {
      self.fields['password'].type = this.checked ? 'text' : 'password';
    });
    self.form.addEventListener('click', this.focusHandler);
    document.querySelector('.modify-account-form ol li').scrollIntoView();

    self._createMenu(false);
  },

  focusHandler: function(e) {
    if (e && e.target) {
      e.target.focus();
      var el = e.target.querySelector('input[type="email"], input[type="password"], input[type="url"]');
      if (el) {
        el.focus();
        e.preventDefault();
      }
    }
  },

  handleEvent: function(event, err) {
    var type = event.type;
    var data = event.data;
    switch (type) {
      case 'authorizeError':
        // we only expect one argument an error object.
        Toaster.showToast({
          messageL10nId: data[0].l10nID
        });
        break;
    }
  },

  updateForm: function() {
    var update = ['user', 'fullUrl'];

    update.forEach(function(name) {
      var field = this.fields[name];
      field.value = this.model[name];
    }, this);
  },

  updateModel: function() {
    var update = ['user', 'password', 'fullUrl'];

    update.forEach(function(name) {
      var field = this.fields[name];
      var value = field.value;
      if (name === 'fullUrl') {
        // Prepend a scheme if url has neither port nor scheme
        var port = URI.getPort(value);
        var scheme = URI.getScheme(value);
        if (!port && !scheme) {
          value = 'https://' + value;
        }
      }

      this.model[name] = value;
    }, this);
  },

  deleteRecord: function() {
    var app = this.app;
    var id = this.model._id;
    var store = app.store('Account');

    // begin the removal (which will emit the preRemove event) but don't wait
    // for it to complete...
    store.remove(id);

    // semi-hack clear the :target - harmless in tests
    // but important in the current UI because css :target
    // does not get cleared (for some reason)
    window.location.replace('#');

    // TODO: in the future we may want to store the entry
    // url of this view and use that instead of this
    // hard coded value...
    store.on('remove', function onAccountsRemove() {
      router.show('/advanced-settings/');
      store.off('remove', onAccountsRemove);
    });
  },

  cancel: function(event) {
    if (event) {
      event.preventDefault();
    }

    if (self.app.deleteDialogShown) {
      CustomDialog.hide();
      self.app.deleteDialogShown = false;
      self.app.showSkPanel();
      self.cancelDelete();
      return;
    }

    self.element.classList.remove(self.progressClass);
    if (self.syncStatus) {
      self.syncStatus = false;
      self._createMenu(true);
      self.updateLoginProgress(false);
      self.updateSupAccount(false);
      if (this.authenticationType === 'oauth2') {
        router.show('/select-preset/');
      }
      return;
    }

    var backUrl = self.isUpdate ? '/advanced-settings/' : '/select-preset/';
    router.show(backUrl);
  },

  cancelDelete: function(event) {
    this.element.classList.remove(this.removeDialogClass);
  },

  updateLoginProgress: function(isSyncing) {
    let syncAccountBodyItem =
      document.querySelector("#modify-account-view .sync-account-body");

    syncAccountBodyItem.classList.toggle('hidden', !isSyncing);
  },

  updateSupAccount: function(isSupAccount) {
    let syncAccountBodyItem =
      document.querySelector("#modify-account-view .sup-account");

    syncAccountBodyItem.classList.toggle('hidden', !isSupAccount);
  },


  save: function(options, e) {
    if (e) {
      e.preventDefault();
    }

    var list = this.element.classList;
    var self = this;

    self.updateLoginProgress(true);
    self.updateSupAccount(false);
    list.add(this.progressClass);
    self.syncStatus = true;
    self._createMenu(false);

    this.errors.textContent = '';

    let syncAccountBodyItem =
      document.querySelector("#modify-account-view .sync-account-body");
    if (syncAccountBodyItem) {
      syncAccountBodyItem.focus();
    }

    if (options && options.updateModel) {
      this.updateModel();
    }

    this.accountHandler.send(this.model, function(err) {
      if (err) {
        self.syncStatus = false;
        self.element.classList.remove(self.progressClass);
        self._createMenu(false);
        self.fields['password'].value = '';
        if (err.name === 'account-exist' &&
            self.authenticationType === 'oauth2') {
          router.show('/advanced-settings/');
        }
      } else {
        self.onCompleteSync();
      }
    });
  },

  hideHeaderAndForm: function() {
    this.element.classList.add(this.removeDialogClass);
  },

  displayOAuth2: function(event) {
    if (event) {
      event.preventDefault();
    }

    var self = this;
    this.oauth2Window.classList.add(View.ACTIVE);

    navigator.mozApps.getSelf().onsuccess = function(e) {
      var app = e.target.result;
      app.clearBrowserData().onsuccess = function() {
        self._redirectToOAuthFlow();
      };
    };
  },

  /**
   * @param {String} preset name of value in Calendar.Presets.
   */
  _createModel: function(preset, callback) {
    var settings = Presets[preset];
    var model = new Account(settings.options);
    model.preset = preset;
    return model;
  },

  _redirectToOAuthFlow: function() {
    var apiCredentials = this.preset.apiCredentials;
    var params = {
      /*
       * code response type for now might change when we can use window.open
       */
      response_type: 'code',
      /* offline so we get refresh_token[s] */
      access_type: 'offline',
      /* we us force so we always get a refresh_token */
      approval_prompt: 'force'
    };

    OAUTH_AUTH_CREDENTIALS.forEach(function(key) {
      if (key in apiCredentials) {
        params[key] = apiCredentials[key];
      }
    });

    var oauth = this._oauthDialog = new OAuthWindow(
      this.oauth2Window,
      apiCredentials.authorizationUrl,
      params
    );

    var self = this;

    oauth.open();
    oauth.onabort = function() {
      self.cancel();
    };

    oauth.oncomplete = function(params) {
      if ('error' in params) {
        // Ruh roh
        return self.cancel();
      }

      if (!params.code) {
        return console.error('authentication error');
      }

      // Fistpump!
      self.model.oauth = { code: params.code };
      self.save();
    };
  },

  render: function() {
    if (!this.model) {
      throw new Error('must provider model to ModifyAccount');
    }

    this.header.addEventListener('action', this.cancel);

    var isUpdate = this.isUpdate = !!this.model._id;
    var showURL = (this.model.preset === 'caldav') && !isUpdate;

    this.type = isUpdate ? 'update' : 'create';

    this.accUserName.classList.toggle('accFocusable', isUpdate);
    this.accUserName.classList.toggle('hide-field', !isUpdate);

    let accSyncUpdate = this.model.preset === 'caldav' ? false : isUpdate
    this.accSyncAccount.classList.toggle('accFocusable', accSyncUpdate);
    this.accSyncAccount.classList.toggle('hide-field', !accSyncUpdate);

    this.accountUser.classList.toggle('accFocusable', !isUpdate);
    this.accountUser.classList.toggle('hide-field', isUpdate);

    this.accountPassword.classList.toggle('accFocusable', !isUpdate);
    this.accountPassword.classList.toggle('hide-field', isUpdate);

    this.showPassword.classList.toggle('accFocusable', !isUpdate);
    this.showPassword.classList.toggle('hide-field', isUpdate);

    this.accountUrl.classList.toggle('accFocusable', showURL);
    this.accountUrl.classList.toggle('hide-field', !showURL);

    if (isUpdate) {
      this.fields['user'].setAttribute('disabled', 'disabled');
    } else {
      this.fields['user'].removeAttribute('disabled');
    }

    var accountUserName =
      document.querySelector('#modify-account-view .account-user-name');
    if (accountUserName) {
      accountUserName.textContent = this.model.user;
    }

    var list = this.element.classList;
    list.add(this.type);
    list.add('preset-' + this.model.preset);
    list.add('provider-' + this.model.providerType);
    list.add('auth-' + this.authenticationType);

    if (this.model.error) {
      list.add('error');
    }

    this.form.reset();
    this.updateForm();

    var usernameType = (window.location.pathname === '/create-account/caldav') ?
        this.model.usernameType : 'email';
    this.fields.user.type = (usernameType === undefined) ?
        'text' : usernameType;

    if (isUpdate) {
      this.accSyncAccount.querySelector('#syncAccount').checked =
        this.model.syncFlag;
      this._createMenu(false);
      this.accUserName.classList.add('focus');
    }
 },

  destroy: function() {
    var list = this.element.classList;

    list.remove(this.type);

    list.remove('preset-' + this.model.preset);
    list.remove('provider-' + this.model.providerType);
    list.remove('auth-' + this.authenticationType);
    list.remove('error');
    list.remove(this.removeDialogClass);

    this.fields.user.disabled = false;

    this._fields = null;
    this.form.reset();

    this.oauth2SignIn.removeEventListener('click', this.displayOAuth2);
    this.header.removeEventListener('action',
                                    this.cancel);
  },

  dispatch: function(data) {
    if (this.model) {
      this.destroy();
    }

    var params = data.params;
    var changeToken = ++this._changeToken;

    this.completeUrl = '/advanced-settings/';

    var self = this;
    function displayModel(err, model) {
      self.preset = Presets[model.preset];

      // race condition another dispatch has queued
      // while we where waiting for an async event.
      if (self._changeToken !== changeToken) {
        return;
      }

      if (err) {
        return console.error('Error displaying model in ModifyAccount', data);
      }

      self.model = model;
      self.render();

      if (self.ondispatch) {
        self.ondispatch();
      }
    }

    if (params.id) {
      this.app.store('Account').get(params.id, displayModel);
    } else if (params.preset) {
      displayModel(null, this._createModel(params.preset));
    }
  },

  accountLoginOut: function(accountName) {
    navigator.accountManager.getAccounts().then((accounts) => {
      for (let i = 0; i < accounts.length; i++) {
        if (accounts[i].accountId.toLowerCase() === accountName.toLowerCase()) {
          navigator.accountManager.logout(accounts[i]).then((result) => {
            console.log("logout resolved: " + JSON.stringify(result));
          }, (reason) => {
            console.log("logout rejected: " + reason);
          });
        }
      }
    });
  },

  deleteAccout: function() {
    if(!self.app.deleteDialogShown){
      self.app.deleteDialogShown = true;

      var dialogConfig = {
        title: {id: 'confirmation', args: {}},
        body: {id: 'remove-account-dialog-details', args: {email: self.model['user']}},
        cancel: {
          l10nId: 'kai-cancel',
          name: 'cancel',
          priority: 1,
          callback: function() {
            self.cancelDelete();
            CustomDialog.hide();
            self.app.deleteDialogShown = false;
          }
        },
        confirm: {
          l10nId: 'kai-delete',
          name: 'Delete',
          priority: 3,
          callback: function() {
            self.deleteRecord();
            self.accountLoginOut(self.model.user);
            CustomDialog.hide();
            self.app.deleteDialogShown = false;
          }
        }
      }
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('confirm-dialog-container'));
    }
  },

  _createMenu: function(withSaveButton) {
    let supAccount =
      document.querySelector('#modify-account-view .sup-account.hidden');
    if (!supAccount) {
      return;
    }

    if (self.model && self.model._id) {
      var params = [{
        name: 'Delete account',
        l10nId: 'delete-account',
        priority: 1,
        method: function() {
          self.deleteAccout();
          document.getElementById("progress-indicator").style.display = 'none';          
        }
      }];

      if (self.model.preset === 'activesync') {
        params.push({
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {
            if (document.querySelector('.user-name.focus')) {
              router.go('/password/' + self.model._id + '/');
            }
          }
        });
      }

      self.app.createSks(params);
      return;
    }

    var params = [{
      name: 'Cancel',
      l10nId: 'cancel',
      priority: 1,
      method: function() {
        self.cancel();
      }
    }];
    if (document.querySelector('#showPwd-li.focus') && !self.syncStatus) {
      params.push({
        name: 'select',
        l10nId: 'select',
        priority: 2,
        method: function() {}
      });
    }

    if (withSaveButton) {
      params.push({
        name: 'Next',
        l10nId: 'next',
        priority: 3,
        method: function() {
          self.accountIsExist();
        }
      });
    }
    self.app.createSks(params);
  },

  accountIsExist: function() {
    let account = self.app.store('Account');

    account.all((err, list) => {
      for (let key in list) {
        if (list[key].user === self.fields['user'].value) {
          Toaster.showToast({
            messageL10nId: 'caldav-account-exist'
          });
          router.show('/advanced-settings/');
          return;
        }
      }

      self.app.getDataConnState().then((res) => {
        if (res) {
          self._boundSaveUpdateModel();
        } else {
          Toaster.showToast({
            messageL10nId: 'error-offline'
          });
          self.element.classList.remove(self.progressClass);
          return;
        }
      });
    });
  },

  createSkForSupAccount: function() {
    var params = [{
      name: 'Next',
      l10nId: 'next',
      priority: 3,
      method: function() {
        self.element.classList.remove(self.progressClass);
        router.go(self.completeUrl);
      }
    }];

    self.app.createSks(params);
  },

  updateSoftkey: function(checked) {
    let selectKey = {
      name: 'select',
      l10nId: 'select',
      priority: 2,
      method: function () {
        self.app.accountSyncChange(self.model._id, true, true);
      }
    };

    let deselectKey = {
      name: 'deselect',
      l10nId: 'deselect',
      priority: 2,
      method: function () {
        self.app.accountSyncChange(self.model._id, false, true);
      }
    };

    let params = [];

    if (checked) {
      params.push(deselectKey);
    } else {
      params.push(selectKey);
    }

    self.app.createSks(params);
  },

  processSyncAccount: function() {
    let item = document.querySelector('.focus.sync-account');
    if (item) {
      let checked = item.querySelector('#syncAccount').checked;
      self.updateSoftkey(checked);
    }
  },

  handleSKEvent: function(e) {
    switch(e.key) {
      case 'Enter':
        e.preventDefault();
        self.processSyncAccount();
        break;
      case 'Backspace':
      case 'BrowserBack':
        if(!self.syncStatus) {
          e.preventDefault();
          self.cancel();
          return;
        }
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        let item =
          document.querySelector('#modify-account-view .user-name.focus');
        if (item) {
          self._createMenu();
        }
        self.processSyncAccount();
        break;
    }
  },

  oninactive: function() {
    View.prototype.oninactive.apply(this, arguments);
    window.removeEventListener('keydown', this.handleSKEvent);
    window.removeEventListener('index-changed', this.onFocusChanged);
    self.fields['user'].removeEventListener('input', self._skbarListener);
    self.fields['password'].removeEventListener('input', self._skbarListener);
    self.fields['fullUrl'].removeEventListener('input', self._skbarListener);
    self.element.classList.remove(self.progressClass);
    self.syncStatus = false;
    self.updateLoginProgress(false);
    self.updateSupAccount(false);
    if (this._oauthDialog) {
      this._oauthDialog.close();
      this._oauthDialog = null;
    }
  },

  onFocusChanged: function(e) {
    if (e.detail.panel !== 'modify-account-view') {
      return;
    }
    var input = e.detail.focusedItem.querySelector('input');
    if (input) {
      input.focus();
    }
    self._skbarListener();
  },

  onCompleteSync: function() {
    if(self.syncStatus) {
      self.updateLoginProgress(false);
      self.updateSupAccount(true);
      self.createSkForSupAccount();
      self.syncStatus = false;
    }
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    this._init();
    window.addEventListener('index-changed', this.onFocusChanged);
    self.element.classList.remove(self.progressClass);
    self.syncStatus = false;
    self.updateLoginProgress(false);
    self.updateSupAccount(false);
  },

  _skbarListener: function(e) {
    var withSaveButton = false;
    var name = self.fields['user'];
    var password = self.fields['password'];
    var url = self.fields['fullUrl'];
    var accSuffix = /(.+)@gmail.com$/;
    var nameValid = (name.type === 'email') ?
        name.checkValidity() && name.value.length > 0 : name.value.length > 0;
    var passwordValid = password.value && password.value.length > 0;

    switch(window.location.pathname) {
      case '/create-account/caldav':
        var urlValid = url.checkValidity() && url.value.length > 0;
        withSaveButton = nameValid && passwordValid && urlValid;
        break;
      case '/create-account/yahoo':
        accSuffix = /(.+)@yahoo.com$/;
      case '/create-account/google':
        withSaveButton = nameValid && accSuffix.test(name.value) && passwordValid;
        break;
    }
    if (!self.syncStatus && this.authenticationType !== 'oauth2') {
      self._createMenu(withSaveButton);
    }
  }
};

});

define('views/modify_password',['require','exports','module','models/account','utils/account_creation','oauth_window','presets','utils/uri','view','router','dom!modify-password-view'],function(require, exports, module) {


var Account = require('models/account');
var AccountCreation = require('utils/account_creation');
var OAuthWindow = require('oauth_window');
var Presets = require('presets');
var URI = require('utils/uri');
var View = require('view');
var router = require('router');

require('dom!modify-password-view');

var DEFAULT_AUTH_TYPE = 'basic';
var OAUTH_AUTH_CREDENTIALS = [
  'client_id',
  'scope',
  'redirect_uri',
  'state'
];

function ModifyPassword(options) {
  View.apply(this, arguments);

  this.deleteRecord = this.deleteRecord.bind(this);
  this.cancel = this.cancel.bind(this);
  this.hideHeaderAndForm = this.hideHeaderAndForm.bind(this);
  this.cancelDelete = this.cancelDelete.bind(this);

  this.accountHandler = new AccountCreation(this.app);
  this.accountHandler.on('authorizeError', this);
}
module.exports = ModifyPassword;

ModifyPassword.prototype = {
  __proto__: View.prototype,

  _changeToken: 0,

  syncStatus: false,
  isUpdate: false,

  selectors: {
    element: '#modify-password-view',
    form: '.modify-password-form',
    fields: '*[name]',
    deleteButton: '#modify-account-view .delete-confirm',
    cancelDeleteButton: '#modify-account-view .delete-cancel',
    header: '#modify-account-header',
    status: '#modify-account-view section[role="status"]',
    errors: '#modify-account-view .errors',
    oauth2Window: '#oauth2',
    oauth2SignIn: '#modify-account-view .force-oauth2',
    accountUser: '#modify-password-view #acc-user',
    accountPassword: '#modify-password-view #acc-password',
    showPassword: '#modify-password-view #showPwd-li',
    accountUrl: '#modify-account-view #acc-url',
    accUserName: '#modify-password-view #acc-user-name',
    incorrectPassword: '#modify-password-view .incorrect-name-desc',
  },

  progressClass: 'in-progress',
  removeDialogClass: 'remove-dialog',

  get incorrectPassword() {
    return this._findElement('incorrectPassword');
  },

  get accUserName() {
    return this._findElement('accUserName');
  },

  get accountUser() {
    return this._findElement('accountUser');
  },

  get accountPassword() {
    return this._findElement('accountPassword');
  },

  get showPassword() {
    return this._findElement('showPassword');
  },

  get accountUrl() {
    return this._findElement('accountUrl');
  },

  get authenticationType() {
    if (this.preset && this.preset.authenticationType) {
      return this.preset.authenticationType;
    }

    return DEFAULT_AUTH_TYPE;
  },

  get oauth2Window() {
    return this._findElement('oauth2Window');
  },

  get oauth2SignIn() {
    return this._findElement('oauth2SignIn');
  },

  get deleteButton() {
    return this._findElement('deleteButton');
  },

  get cancelDeleteButton() {
    return this._findElement('cancelDeleteButton');
  },

  get header() {
    return this._findElement('header');
  },

   get form() {
    return this._findElement('form');
  },

  get fields() {
    if (!this._fields) {
      var result = this._fields = {};
      var elements = this.element.querySelectorAll(
        this.selectors.fields
      );

      var i = 0;
      var len = elements.length;

      for (i; i < len; i++) {
        var el = elements[i];
        result[el.getAttribute('name')] = el;
      }
    }

    return this._fields;
  },

  _init: function() {
    self = this;
    window.addEventListener('keydown', this.handleSKEvent);
    self.fields['password'].addEventListener('input', self._skbarListener);
    self.fields['password'].type = 'password';
    self.fields['showPwd'].addEventListener('change', function(e) {
      self.fields['password'].type = this.checked ? 'text' : 'password';
    });
    self.form.addEventListener('click', this.focusHandler);
  },

  focusHandler: function(e) {
    if (e && e.target) {
      e.target.focus();
      var el = e.target.querySelector('input[type="email"], input[type="password"], input[type="url"]');
      if (el) {
        el.focus();
        e.preventDefault();
      }
    }
  },

  handleEvent: function(event, err) {
    var type = event.type;
    var data = event.data;
    switch (type) {
      case 'authorizeError':
        // we only expect one argument an error object.
        Toaster.showToast({
          messageL10nId: data[0].l10nID
        });
        break;
    }
  },

  updateForm: function() {
    var update = ['user', 'fullUrl'];

    update.forEach(function(name) {
      var field = this.fields[name];
      field.value = this.model[name];
    }, this);
  },

  updateModel: function() {
    var update = ['user', 'password', 'fullUrl'];

    update.forEach(function(name) {
      var field = this.fields[name];
      var value = field.value;
      if (name === 'fullUrl') {
        // Prepend a scheme if url has neither port nor scheme
        var port = URI.getPort(value);
        var scheme = URI.getScheme(value);
        if (!port && !scheme) {
          value = 'https://' + value;
        }
      }

      this.model[name] = value;
    }, this);
  },

  deleteRecord: function() {
    var app = this.app;
    var id = this.model._id;
    var store = app.store('Account');

    // begin the removal (which will emit the preRemove event) but don't wait
    // for it to complete...
    store.remove(id);

    // semi-hack clear the :target - harmless in tests
    // but important in the current UI because css :target
    // does not get cleared (for some reason)
    window.location.replace('#');

    // TODO: in the future we may want to store the entry
    // url of this view and use that instead of this
    // hard coded value...
    router.show('/advanced-settings/');
  },

  cancel: function(event) {
    if (event) {
      event.preventDefault();
    }

    if (self.app.deleteDialogShown) {
      CustomDialog.hide();
      self.app.deleteDialogShown = false;
      self.app.showSkPanel();
      self.cancelDelete();
      return;
    }

    window.history.go(-1);
  },

  cancelDelete: function(event) {
    this.element.classList.remove(this.removeDialogClass);
  },

  hideHeaderAndForm: function() {
    this.element.classList.add(this.removeDialogClass);
  },

  /**
   * @param {String} preset name of value in Calendar.Presets.
   */
  _createModel: function(preset, callback) {
    var settings = Presets[preset];
    var model = new Account(settings.options);
    model.preset = preset;
    return model;
  },

  render: function(incorrectPassword) {
    var isUpdate = !!this.model._id;
    isUpdate = !!incorrectPassword ? false : isUpdate;

    this.accUserName.classList.toggle('accFocusable', isUpdate);
    this.accUserName.classList.toggle('hide-field', !isUpdate);

    this.incorrectPassword.classList.toggle('hide-field', isUpdate);

    this.accountPassword.classList.add('accFocusable');

    this.showPassword.classList.toggle('accFocusable', isUpdate);
    this.showPassword.classList.toggle('hide-field', !isUpdate);

    this.form.reset();
    this._createMenu();
 },

  destroy: function() {
    var list = this.element.classList;

    list.remove(this.type);

    list.remove('preset-' + this.model.preset);
    list.remove('provider-' + this.model.providerType);
    list.remove('auth-' + this.authenticationType);
    list.remove('error');
    list.remove(this.removeDialogClass);

    // this.fields.user.disabled = false;

    this._fields = null;
    this.form.reset();
  },

  dispatch: function(data) {
    if (this.model) {
      this.destroy();
    }

    var params = data.params;
    var changeToken = ++this._changeToken;

    this.completeUrl = '/advanced-settings/';
 
    var self = this;
    
    let displayModel = (err, model) => {
      self.model = model;
      if (model.preset === 'caldav') {
        document.querySelector('#modify-password-view header h1').textContent =
        navigator.mozL10n.get('incorrect-password');
        self.render(true);
        return;
      }

      self.preset = Presets[model.preset];

      // race condition another dispatch has queued
      // while we where waiting for an async event.
      if (self._changeToken !== changeToken) {
        return;
      }

      if (err) {
        return console.error('Error displaying model in ModifyAccount', data);
      }

      self.render();

      let headerStr;
      if (data.state && data.state.errMessage &&
        data.state.errMessage === 'incorrect password') {
        headerStr = navigator.mozL10n.get('incorrect-password');
      } else {
        headerStr = self.model.user;
      }

      document.querySelector('#modify-password-view header h1').textContent =
        headerStr;
      document.querySelector('#modify-password-view .account-username').textContent =
        self.model.user;
    }

    if (params.id !== 'null') {
      this.app.store('Account').get(params.id, displayModel);
    } else {
      document.querySelector('#modify-password-view header h1').textContent =
        navigator.mozL10n.get('incorrect-password');
      self.render(true);
    }
  },

  accountLoginOut: function(accountName) {
    navigator.accountManager.getAccounts().then(
      accounts => {
        for (let i = 0; i < accounts.length; i++) {
          if (accounts[i].accountId.toLowerCase() ===
            accountName.toLowerCase()) {
            navigator.accountManager.logout(accounts[i]).then(
              result => {
                console.log("logout resolved: " + JSON.stringify(result));
              },
              reason => {
                console.log("logout rejected: " + reason);
              }
            );
          }
        }
      }
    );
  },

  deleteAccout: function() {
    if(!self.app.deleteDialogShown){
      self.app.deleteDialogShown = true;

      var dialogConfig = {
        title: {id: 'confirmation', args: {}},
        body: {id: 'remove-account-dialog-details', args: {email: self.model['user']}},
        cancel: {
          l10nId: 'kai-cancel',
          name: 'cancel',
          priority: 1,
          callback: function() {
            self.cancelDelete();
            CustomDialog.hide();
            self.app.deleteDialogShown = false;
          }
        },
        confirm: {
          l10nId: 'kai-delete',
          name: 'Delete',
          priority: 3,
          callback: function() {
            self.deleteRecord();
            self.accountLoginOut(self.model.user);
            CustomDialog.hide();
            self.app.deleteDialogShown = false;
          }
        }
      }
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('confirm-dialog-container'));
    }
  },

  changePasswordPre: function() {
    if (navigator.mozWifiManager && navigator.mozWifiManager.connection &&
      navigator.mozWifiManager.connection.status === 'connected') {
      this.changePassword();
    } else {
      this.app.getAllDataState().then((results) => {
        let connectFlag = false;
        for (let i = 0; i < results.length; i++) {
          if (results[i] === 'connected') {
            connectFlag = true;
            break;
          }
        }

        if (connectFlag) {
          this.changePassword();
        } else {
          Toaster.showToast({
            messageL10nId: 'error-offline'
          });
        }
      })
    }
  },

  changePassword: function() {
    if (self.model.preset === 'caldav') {
      let passwordString = '#modify-password-view input[name=password]';
      self.model.password = document.querySelector(passwordString).value;

      self.accountHandler.send(self.model, (err) => {
        if (err) {
          router.go('/password/' + self.model._id + '/');
        } else {
          router.show('/advanced-settings/');
        }
      });
    } else {
      let account = {
        accountId: self.model.user,
        authenticatorId: self.model.preset
      };
      let password =
        document.querySelector('#modify-password-view input[name=password]').value;

      navigator.accountManager.reauthenticate(account,
        { password: password }).then(() => {
        Toaster.showToast({
          messageL10nId: 'save-password'
        });

        let accountStore = self.app.store('Account');
        self.model.password = password;
        accountStore.updateAccountData(self.model);

        router.show('/advanced-settings/');
        console.log('Account:' + account.accountId + '\'s password changed');
      }, () => {
        console.log('Account:' + account.accountId + ' change password failed');
        router.go('/password/' + null + '/');
      });
    }
  },

  _createMenu: function(withSaveButton) {
    var params = [{
      name: 'Cancel',
      l10nId: 'cancel',
      priority: 1,
      method: function() {
        window.history.go(-1);
      }
    },
    {
      name: 'Save',
      l10nId: 'save',
      priority: 3,
      method: function() {
        self.changePasswordPre();
      }
    }];

    self.app.createSks(params);
  },

  handleSKEvent: function(e) {
    if(e.key === 'BrowserBack' || e.key === 'Backspace') {
      if(!self.syncStatus) {
        e.preventDefault();
        self.cancel();
        return;
      }
    } if (e.key === 'Enter') {
      e.preventDefault();
    }
  },

  oninactive: function() {
    View.prototype.oninactive.apply(this, arguments);
    window.removeEventListener('keydown', this.handleSKEvent);
    window.removeEventListener('index-changed', this.onFocusChanged);
    self.fields['password'].removeEventListener('input', self._skbarListener);
  },

  onFocusChanged: function(e) {
    if (e.detail.panel !== 'modify-password-view') {
      return;
    }
    var input = e.detail.focusedItem.querySelector('input');
    if (input) {
      input.focus();
    }
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    this._init();
    window.addEventListener('index-changed', this.onFocusChanged);
  },

  _skbarListener: function(e) {
    var withSaveButton = false;
    var name = self.fields['user'];
    var password = self.fields['password'];
    var url = self.fields['fullUrl'];
    var accSuffix = /(.+)@gmail.com$/;
    var nameValid = (name.type === 'email') ?
        name.checkValidity() && name.value.length > 0 : name.value.length > 0;
    var passwordValid = password.value && password.value.length > 0;

    switch(window.location.pathname) {
      case '/create-account/caldav':
        var urlValid = url.checkValidity() && url.value.length > 0;
        withSaveButton = nameValid && passwordValid && urlValid;
        break;
      case '/create-account/yahoo':
        accSuffix = /(.+)@yahoo.com$/;
      case '/create-account/google':
        withSaveButton = nameValid && accSuffix.test(name.value) && passwordValid;
        break;
    }
    if (!self.syncStatus && this.authenticationType !== 'oauth2') {
      self._createMenu(withSaveButton);
    }
  }
};

});

define('views/event_base',['require','exports','module','models/event','view','day_observer','calc','next_tick','provider/provider_factory','router'],function(require, exports, module) {


var Event = require('models/event');
var View = require('view');
var dayObserver = require('day_observer');
var isToday = require('calc').isToday;
var nextTick = require('next_tick');
var providerFactory = require('provider/provider_factory');
var router = require('router');

function EventBase(options) {
  View.apply(this, arguments);

  this.store = this.app.store('Event');

  this._els = Object.create(null);
  this._changeToken = 0;

  this.cancel = this.cancel.bind(this);
  this.primary = this.primary.bind(this);
  this._initEvents();
}
module.exports = EventBase;

EventBase.prototype = {
  __proto__: View.prototype,

  READONLY: 'readonly',
  CREATE: 'create',
  UPDATE: 'update',
  PROGRESS: 'in-progress',
  ALLDAY: 'allday',
  LOADING: 'loading',

  DEFAULT_VIEW: '/month/',

  state: null,

  _initEvents: function() {
    this.header.addEventListener('action', this.cancel);
  },

  uiSelector: '.%',

  get header() {
    return this._findElement('header');
  },

  get fieldRoot() {
    return this.element;
  },

  /**
   * Returns the url the view will "redirect" to
   * after completing the current add/edit/delete operation.
   *
   * @return {String} redirect url.
   */
  returnTo: function() {
    var path = this._returnTo || this.DEFAULT_VIEW;
    return path;
  },

  /**
   * Returns the top level URL, or returnTo()
   * Resets the returnTop variable so we can override on next visit
   */
  returnTop: function() {
    var path = this._returnTop || this.returnTo();
    delete this._returnTop;
    return path;
  },

  /**
   * Dismiss modification and go back to previous screen.
   */
  cancel: function() {
    window.history.back();
  },

  /**
   * This method is overridden
   */
  primary: function() {},

  /**
   * This method is overridden
   */
  _markReadonly: function() {},

  /**
   * When the event is something like this:
   * 2012-01-02 and we detect this is an all day event
   * we want to display the end date like this 2012-01-02.
   */
  formatEndDate: function(endDate) {
    if (
      endDate.getHours() === 0 &&
      endDate.getSeconds() === 0 &&
      endDate.getMinutes() === 0
    ) {
      // subtract the date to give the user a better
      // idea of which dates the event spans...
      endDate = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate() - 1
      );
    }

    return endDate;
  },

  /**
   * Assigns and displays event & busytime information.
   * Marks view as "loading"
   *
   * @param {Object} busytime for view.
   * @param {Object} event for view.
   * @param {Function} [callback] optional callback.
   */
  useModel: function(busytime, event, dayBusytime, callback) {
    // mark view with loading class
    var classList = this.element.classList;
    classList.add(this.LOADING);

    this.event = new Event(event);
    this.busytime = busytime;
    this.dayBusytime = dayBusytime;

    var changeToken = ++this._changeToken;

    var self = this;

    this.store.ownersOf(event, fetchOwners);

    function fetchOwners(err, owners) {
      self.originalCalendar = owners.calendar;
      self.originalAccount = owners.account;
      self.provider = providerFactory.get(owners.account.providerType);
      self.provider.eventCapabilities(
        self.event,
        fetchEventCaps
      );
    }

    function fetchEventCaps(err, caps) {
      if (self._changeToken !== changeToken) {
        return;
      }

      if (err) {
        console.error('Failed to fetch events capabilities', err);

        if (callback) {
          classList.remove(self.LOADING);
          callback(err);
        }

        return;
      }

      if (!caps.canUpdate) {
        self._markReadonly(true);
        self.element.classList.add(self.READONLY);
      }

      // inheritance hook...
      self._updateUI();

      // we only remove the loading class after the UI is rendered just to
      // avoid potential race conditions during marionette tests (trying to
      // read the data before it's on the DOM)
      classList.remove(self.LOADING);

      if (callback) {
        callback();
      }
    }
  },

  /** override me! **/
  _updateUI: function() {},

  _loadModelPre: function(id, callback) {
    var event = dayObserver.getEventsToBusytimes().get(id.slice(0,-37));

    if (!event) {
      var trans = this.app.db.transaction('busytimes');
      var store = trans.objectStore('busytimes');
      store.mozGetAll().onsuccess = (event) => {
        var item = event.target.result.find(function(x) {return x._id = id;});
        var monthDate = new Date(item.start.utc + item.start.offset);
        dayObserver.loadMonthForNofication(monthDate).then(() => {
          this._loadModel(id, callback);
        });
      };
    } else {
      this._loadModel(id, callback);
    }
  },

  /**
   * Loads event and triggers form update.
   * Gracefully will handle race conditions
   * if rapidly switching between events.
   * TODO: This token may no longer be needed
   *   as we have an aria-disabled guard now.
   *
   * @param {String} id busytime id.
   */
  _loadModel: function(id, callback) {
    var self = this;
    var token = ++this._changeToken;
    var classList = this.element.classList;

    classList.add(this.LOADING);
    var verifyId = dayObserver.getEventsToBusytimes().get(id.slice(0,-37))[0];

    dayObserver.findAssociated(verifyId).then(record => {
      dayObserver.findAssociated(id).then(rec => {
        if (token === self._changeToken) {
          self.useModel(
            record.busytime,
            record.event,
            rec.busytime,
            callback
          );
        } else {
          // ensure loading is removed
          classList.remove(this.LOADING);
        }
      });
    })
    .catch(() => {
      classList.remove(this.LOADING);
      console.error('Error looking up records for id: ', id);
    });
  },

  /**
   * Builds and sets defaults for a new model.
   *
   * @return {Calendar.Models.Model} new model.
   */
  _createModel: function(time) {
    // time can be null in some cases, default to today (eg. unit tests)
    time = time || new Date();

    this._setDefaultHour(time);

    var model = new Event();
    model.startDate = time;

    var end = new Date(time.valueOf());
    end.setHours(end.getHours() + 1);

    model.endDate = end;

    return model;
  },

  _setDefaultHour: function(date) {
    if (isToday(date)) {
      var now = new Date();
      // events created today default to begining of the next hour
      date.setHours(now.getHours(), 0, 0, 0);
    } else {
      // events created on other days default to 8AM
      date.setHours(8, 0, 0, 0);
    }
  },

  /**
   * Gets and caches an element by selector
   */
  getEl: function(name) {
    if (!(name in this._els)) {
      var el = this.fieldRoot.querySelector(
        this.uiSelector.replace('%', name)
      );
      if (el) {
        this._els[name] = el;
      }
    }
    return this._els[name];
  },

  oninactive: function() {
    View.prototype.oninactive.apply(this, arguments);
  },

  /**
   * Handles the url parameters for when this view
   * comes into focus.
   *
   * When the (busytime) id parameter is given the event will
   * be found via the time controller.
   */
  dispatch: function(data) {
    // always remove loading initially (to prevent worst case)
    this.element.classList.remove(this.LOADING);

    var id = data.params.id;
    var classList = this.element.classList;
    var last = router.last;

    if (last && last.path) {
      if (!(/^\/(day|event|month|week|search|show-multi-events)/.test(last.path))) {
        // We came from some place suspicious so fall back to default.
        this._returnTo = this.DEFAULT_VIEW;
      } else {
        // Return to the default view if we just added an event.
        // Else go back to where we came from.
        if (!(/^\/event\/edit\//.test(last.path))) {
          this._returnTo = /^\/event\/add\//.test(last.path) ?
            this.DEFAULT_VIEW : last.path;
        }
      }
    }

    if (!this._returnTop && this._returnTo) {
      this._returnTop = this._returnTo;
    }

    var self = this;
    function completeDispatch() {
      if (self.ondispatch) {
        self.ondispatch();
      }
    }

    if (id) {
      classList.add(this.UPDATE);
      this.state = this.UPDATE;
      this._loadModelPre(id, completeDispatch);
    } else {
      classList.add(this.CREATE);
      this.state = this.CREATE;
      var controller = this.app.timeController;
      this.event = this._createModel(controller.mostRecentDay);
      this._updateUI();

      nextTick(completeDispatch);
    }
  },

  onfirstseen: function() {}

};

});

define('views/modify_event',['require','exports','module','templates/alarm','./event_base','shared/input_parser','provider/local','querystring','date_format','calc','next_tick','router','calc','notification','dom!modify-event-view'],function(require, exports, module) {


var AlarmTemplate = require('templates/alarm');
var EventBase = require('./event_base');
var InputParser = require('shared/input_parser');
var Local = require('provider/local');
var QueryString = require('querystring');
var dateFormat = require('date_format');
var getTimeL10nLabel = require('calc').getTimeL10nLabel;
var nextTick = require('next_tick');
var router = require('router');
var FLOATING = require('calc').FLOATING;
var notification = require('notification');

require('dom!modify-event-view');

var eventCalendarHtml = `
  <li role="menuitem" class="current-calendar hidden" id="current-calendar">
    <span id="currentCalendar-title" class="p-pri" data-l10n-id="kai-event-calendar">Calendar</span>
    <span aria-disabled="true">
      <input class="p-sec none-select" name="currentCalendar" disabled="disabled">
    </span>
  </li>

  <li role="menuitem" class="event-calendar focusable" id="event-calendar">
    <span id="eventCalendar-title" data-l10n-id="kai-event-calendar" class="p-pri title-calendar">Calendar</span>
    <span class="button">
      <select name="calendarId" class="p-sec loading" data-track-class="title-calendar">
      </select>
    </span>
   </li>`;
var lowMemory = false;
var repeatvalueItem =
  document.querySelector('.select-value .event-edit-select');
var optionMenu = false;

function ModifyEvent(options) {
  lowMemory = localStorage.getItem('isLowMemoryDevice') === 'true' ?
    true : false;
  if (!lowMemory) {
    var item = document.querySelector('#modify-event-view .event-reminder');
    item.insertAdjacentHTML('beforeBegin', eventCalendarHtml);
  }

  let repeatItem = document.querySelector('#modify-event-view .repeat-event');
  repeatItem.classList.toggle('focusable', !lowMemory);
  repeatItem.classList.toggle('hide-field', lowMemory);

  this._toggleAllDay = this._toggleAllDay.bind(this);
  this._observeDataChange = this._observeDataChange.bind(this);
  this.onFocusChanged = this.onFocusChanged.bind(this);
  this._createMenu = this._createMenu.bind(this);
  this._repeatChange = this._repeatChange.bind(this);
  EventBase.apply(this, arguments);
}
module.exports = ModifyEvent;

ModifyEvent.prototype = {
  __proto__: EventBase.prototype,

  MAX_ALARMS: 1,

  formats: {
    date: 'dateTimeFormat_%x',
    time: 'shortTimeFormat'
  },

  observe: null,
  updatedHandler: false,
  endKeyClicked: false,

  observeConfig: {
    attributes: true,
    subtree: true
  },

  FOCUS_ABLE: "focusable",

  self: null,

  dataChanged: false,
  backPath: '/month/',

  selectors: {
    element: '#modify-event-view',
    alarmList: '#modify-event-view .alarms',
    form: '#modify-event-view form',
    startDateLocale: '#start-date-locale',
    startTimeLocale: '#start-time-locale',
    endDateLocale: '#end-date-locale',
    endTimeLocale: '#end-time-locale',
    header: '#modify-event-header'
  },

  uiSelector: '[name="%"]',

  _duration: 0, // The duration between start and end dates.

  ignoreNumkey: false,

  tone:null,
  isSaveingFlag: false,

  _initEvents: function() {
    EventBase.prototype._initEvents.apply(this, arguments);

    var calendars = this.app.store('Calendar');
    var self = this;
    if (!lowMemory) {
      calendars.on('add', this._addCalendarId.bind(this));
      calendars.on('preRemove', this._removeCalendarId.bind(this));
      calendars.on('remove', this._removeCalendarId.bind(this));
      calendars.on('update', this._updateCalendarId.bind(this));
    }

    this.form.addEventListener('click', this.focusHandler);
    this.form.addEventListener('submit', this.primary);
    window.addEventListener('keydown', this.handleHWKeyEvent);

    this.initInputListner();
  },

  cancel: function() {
    window.history.back();
    delete window.history.state.eventStartHour;
    delete window.history.state.eventId;
  },

  handleHWKeyEvent: function(e) {
    if(window.location.pathname === '/event/add/' || window.location.pathname.match('/event/edit/')) {
      switch (e.key) {
        case 'Backspace':
        case 'BrowserBack':
          e.preventDefault();
          let optionMenuItem = document.getElementById('option-menu');
          if (optionMenu && optionMenuItem &&
            optionMenuItem.classList.contains('visible')) {
            optionMenu.hide();
            self._createMenu();
            NavigationMap.reset('modify-event-view');
          } else if(router.app.deleteDialogShown) {
            if(self.endKeyClicked) {
              self.endKeyClicked = false;
              self.app.deleteDialogShown = false;
              self.cancel();
              self.app.showSkPanel();
            }
          } else {
            if(self.dataChanged === true) {
              self.saveEvent('Backspace');
            } else {
              self.app.deleteDialogShown = false;
              self.endKeyClicked = false;
              self.cancel();
              self.app.showSkPanel();
            }
          }
          break;
        default:
          if (self.ignoreNumkey) {
            e.stopPropagation();
            e.preventDefault();
          }
          break;
      }
    }
  },

  /**
   * Fired when the allday checkbox changes.
   */
  _toggleAllDay: function(e) {
    var allday = this.getEl('allday').checked;
    this.dataChanged = true;

    if (allday) {
      // enable case
      this.element.classList.add(this.ALLDAY);
      document.querySelector("#startTime-Li").classList.remove(this.FOCUS_ABLE);
      document.querySelector("#endTime-Li").classList.remove(this.FOCUS_ABLE);
    } else {
      // disable case
      this.element.classList.remove(this.ALLDAY);
      document.querySelector("#startTime-Li").classList.add(this.FOCUS_ABLE);
      document.querySelector("#endTime-Li").classList.add(this.FOCUS_ABLE);
      if (e) {
        // only reset the start/end time if coming from an user interaction
        this._resetDateTime();
      }
    }

    // Reset alarms if we come from a user event
    if (e) {
      this.updateAlarms(allday);
    }

    NavigationMap.navSetup("modify-event-view",".focusable");

  },

  _resetDateTime: function() {
    // if start event was "all day" and switch to regular event start/end time
    // will be the same, so we reset to default start time, otherwise we keep
    // the previously selected value
    var startDateTime = this._getStartDateTime();
    if (startDateTime === this._getEndDateTime()) {
      var startDate = new Date(startDateTime);
      this._setDefaultHour(startDate);
      this.element.querySelector('.start-time-picker').value =
        InputParser.exportTime(startDate);
      this._renderDateTimeLocale(
        this._findElement('startTimeLocale'), startDate);
      // default event duration is 1 hour
      this._duration = 60 * 60 * 1000;
      this._setEndDateTimeWithCurrentDuration();
    }
  },

  /**
   * Called when any alarm is changed
   */
  _changeAlarm: function(e) {
    this.dataChanged = true;

    var template = AlarmTemplate;
    if (e.target.value == 'none') {
      var parent = e.target.parentNode;
      if(this.alarmList.children.length > 1){
          parent.parentNode.removeChild(parent);
          NavigationMap.navSetup("modify-event-view",".focusable");
          NavigationMap.getCurItem().classList.add("focus");
      }
      return;
    }

    // Append a new alarm select only if we don't have an empty one or if we
    // didn't reach the maximum number of alarms
    var alarms = this.queryAlarms();
    if (alarms.length >= this.MAX_ALARMS ||
        alarms.some(el => el.value === 'none')) {
      return;
    }

    var newAlarm = document.createElement('div');
    newAlarm.innerHTML = template.picker.render({
      layout: this.event.isAllDay ? 'allday' : 'standard'
    });
    this.alarmList.appendChild(newAlarm);
    NavigationMap.navSetup("modify-event-view",".focusable");
  },

  /**
   * Check if current event has been stored in the database
   */
  isSaved: function() {
      return !!this.provider;
  },

  _observeDataChange: function(e) {
    if(!(e.detail && e.detail == 'back-key')) {
      this.dataChanged = true;
    }

    var el = document.querySelector('.notes.focus');
    if (el) {
      el.scrollIntoView(false);
    }
  },

  _repeatChange: function(e) {
    this.dataChanged = true;
    this._createMenu();
  },

  /**
   * Build the initial list of calendar ids.
   */
  onfirstseen: function() {
    // we need to notify users (specially automation tests) somehow that the
    // options are still being loaded from DB, this is very important to
    // avoid race conditions (eg.  trying to set calendar before list is
    // built) notice that we also add the class to the markup because on some
    // really rare occasions "onfirstseen" is called after the EventBase
    // removed the "loading" class from the root element (seen it happen less
    // than 1% of the time)
    if (!lowMemory) {
      this.getEl('calendarId').classList.add(self.LOADING);

      var accountStore = this.app.store('Account');
      var calendarStore = this.app.store('Calendar');
      accountStore.all((err, accountList) => {
        calendarStore.all((err, calendars) => {
          if (err) {
            return console.error('Could not build list of calendars');
          }
          var list = accountList;
          var pending = 0;
          var self = this;

          function next() {
            if (!--pending) {
              self.getEl('calendarId').classList.remove(self.LOADING);

              if (self.onafteronfirstseen) {
                self.onafteronfirstseen();
              }
            }
          }

          for (var id in calendars) {
            let accSyncFlag = accountList[calendars[id].accountId].syncFlag;
            let accPreset = accountList[calendars[id].accountId].preset
            if (accSyncFlag || id === 'local-first' || accPreset === 'caldav') {
              pending++;
              this._addCalendarId(id, calendars[id], next);
            } else {
              this._removeCalendarId(id);
            }
          }
        });
      });
    }
  },

  /**
   * Updates a calendar id option.
   *
   * @param {String} id calendar id.
   * @param {Calendar.Model.Calendar} calendar model.
   */
  _updateCalendarId: function(id, calendar) {
    var element = this.getEl('calendarId');
    var option = element.querySelector('[value="' + id + '"]');
    var store = this.app.store('Calendar');

    store.providerFor(calendar, function(err, provider) {
      var caps = provider.calendarCapabilities(
        calendar
      );

      if (!caps.canCreateEvent) {
        this._removeCalendarId(id);
        return;
      }

      if (option && id !== Local.calendarId) {
        option.text = calendar.remote.name;
      }


      if (this.oncalendarupdate) {
        this.oncalendarupdate(calendar);
      }
    }.bind(this));
  },

  /**
   * Add a single calendar id.
   *
   * @param {String} id calendar id.
   * @param {Calendar.Model.Calendar} calendar calendar to add.
   */
  _addCalendarId: function(id, calendar, callback) {
    var store = this.app.store('Calendar');
    store.providerFor(calendar, function(err, provider) {
      var caps = provider.calendarCapabilities(
        calendar
      );

      if (!caps.canCreateEvent) {
        if (callback) {
          nextTick(callback);
        }
        return;
      }

      var items =
        document.querySelectorAll('.event-calendar option');
      for(var i = 0; i < items.length; i++) {
        if (items[i].value == calendar._id) {
          return;
        }
      }

      var option;
      var element = this.getEl('calendarId');

      option = document.createElement('option');

      if (id === Local.calendarId) {
        option.text = navigator.mozL10n.get('calendar-local');
        option.setAttribute('data-l10n-id', 'calendar-local');
      } else {
        option.text = calendar.remote.name;
      }

      option.value = id;

      if (id !== Local.calendarId) {
        element.insertBefore(option, element.children[0]);
        element.value = element.children[0].value;
      } else {
        element.add(option);
      }

      if (callback) {
        nextTick(callback);
      }

      if (this.onaddcalendar) {
        this.onaddcalendar(calendar);
      }
    }.bind(this));
  },

  /**
   * Remove a single calendar id.
   *
   * @param {String} id to remove.
   */
  _removeCalendarId: function(id) {
    var element = this.getEl('calendarId');

    var option = element.querySelector('[value="' + id + '"]');
    if (option) {
      element.removeChild(option);
    }

    if (this.onremovecalendar) {
      this.onremovecalendar(id);
    }
  },

  /**
   * Mark all field's readOnly flag.
   *
   * @param {Boolean} boolean true/false.
   */
  _markReadonly: function(boolean) {
    var i = 0;
    var fields = this.form.querySelectorAll('[name]');
    var len = fields.length;

    for (; i < len; i++) {
      fields[i].readOnly = boolean;
    }
  },

  queryAlarms: function() {
    return Array.from(document.querySelectorAll('[name="alarm[]"]'));
  },

  get alarmList() {
    return this._findElement('alarmList');
  },

  get form() {
    return this._findElement('form');
  },

  get fieldRoot() {
    return this.form;
  },

  _onEventEditChange: function() {
    this._saveData();
  },

  oninactive: function() {
    EventBase.prototype.oninactive.apply(this, arguments);
    window.removeEventListener('index-changed', this.onFocusChanged);
    this.clear();
    this.dataChanged = false;
    this.isSaveingFlag = false;
  },

  onactive: function() {
    this.seen = false;
    EventBase.prototype.onactive.apply(this, arguments);
    window.addEventListener('index-changed', this.onFocusChanged);
    self = this;
    this.updateDOM();
    this.updateEndKeyHandler();
    this.dataChanged = false;
    this.isSaveingFlag = false;
    this._setBackPath();
    window.navigator.mozSettings.addObserver('selectOptionPopup.state', function (event) {
      if (event.settingValue === 1) {
        self.ignoreNumkey = true;
      } else {
        self.ignoreNumkey = false;
      }
    });
  },

  dispatch: function(data) {
    EventBase.prototype.dispatch.apply(this, arguments);
    var el = document.getElementById('modify-event-view');
    if (this.state === this.CREATE) {
      el.setAttribute('aria-labelledby', 'new-event-header');
    } else {
      el.setAttribute('aria-labelledby', 'edit-event-header');
    }
  },

  compareSelectedDate(data, item) {
    let retFlag = false;
    let selectedDate = new Date(this.app.timeController.selectedDay.valueOf() -
      (new Date()).getTimezoneOffset() * 60 * 1000);
    let eventSDate = new Date(data.startDate.valueOf());
    let eventEDate = new Date(data.endDate.valueOf());
    selectedDate = selectedDate.setUTCHours(eventSDate.getUTCHours(),
      eventSDate.getUTCMinutes(), 0, 0);

    if (data.repeat !== item.repeat) {
      retFlag = false;
    } else if ('never' === data.repeat &&
      data.startDate.valueOf() === item.startDate.valueOf() &&
      data.endDate.valueOf() === item.endDate.valueOf()) {
      retFlag = true;
    } else if ('never' !== data.repeat &&
      selectedDate.valueOf() === eventSDate.valueOf() &&
      data.endDate.valueOf() === data.startDate.valueOf() &&
      item.endDate.valueOf() === item.startDate.valueOf()) {
      retFlag = true;
    }

    return retFlag;
  },

  compareDataEvent: function(data) {
    const item = self.event.remote;
    let isSame = false;

    if (data.title === item.title &&
      data.location === item.location &&
      self.getEl('allday').checked === item.isAllDay &&
      self.compareSelectedDate(data, item) &&
      ((0 === data.alarms.length && 0 === item.alarms.length) ||
      (1 === data.alarms.length && 1 === item.alarms.length &&
      data.alarms[0].trigger === item.alarms[0].trigger)) &&
      data.description === item.description
    ) {
      isSame = true;
    }

    return isSame;
  },

  /**
   * Ask the provider to persist an event:
   *
   *  1. update the model with form data
   *
   *  2. send it to the provider if it has the capability
   *
   *  3. set the position of the calendar to startDate of new/edited event.
   *
   *  4. redirect to last view.
   *
   * For now both update & create share the same
   * behaviour (redirect) in the future we may change this.
   */
  _persistEvent: function(method, capability) {
    // create model data
    var data = this.formData();
    var errors;
    var self = this;
    var state = null;
    var repeatToNever = false;

    if ((method === 'updateEvent' ||
      method === 'updateEventAll' ||
      method === 'updateEventFuture') &&
      self.compareDataEvent(data)) {
      if ((/^\/event\/show\//.test(self._returnTo))) {
        window.history.go(-2);
      } else {
        router.go(self.returnTo(), state);
      }
    }

    if ((self.event.repeat !== 'never' && data.repeat === 'never') ||
      (self.event.repeat === 'never' && data.repeat !== 'never')) {
      repeatToNever = true;
    }

    // we check explicitly for true, because the alternative
    // is an error object.
    if ((errors = self.event.updateAttributes(data)) !== true) {
      self.showErrors(errors);
      return;
    }

    // can't create without a calendar id
    // because of defaults this should be impossible.
    if (!lowMemory && !data.calendarId) {
      return;
    }

    var provider;

    self.store.providerFor(self.event, fetchProvider);

    function fetchProvider(err, result) {
      provider = result;
      provider.eventCapabilities(
        self.event.data,
        verifyCaps
      );
    }

    function verifyCaps(err, caps) {
      if (err) {
        return console.error('Error fetching capabilities for', self.event);
      }

      // safe-guard but should not ever happen.
      if (caps[capability]) {
        persistEvent();
      }
    }

    function persistEvent() {
      var list = self.element.classList;

      // mark view as 'in progress' so we can style
      // it via css during that time period
      list.add(self.PROGRESS);
      var nowDateUtc = method === 'updateEventFuture' ?
        self.app.timeController.selectedDay.valueOf() : 0;
      var moveDate = self.event.startDate;

      // we pass the date so we are able to scroll to the event on the
      // day/week views
      state = {
        eventStartHour: self.event.isAllDay? 'allday': moveDate.getHours(),
        eventId: self.event._id
      };

      if (method === 'updateEvent' &&
        self.event.data.calendarId !== Local.calendarId) {
        var url = '/alarm-display/' + self.busytime._id;
        notification.closeNotifications(url);
      }

      self._createMenu();
      self.isSaveingFlag = false;
      self.event.data.remote.preset = method === 'updateEventFuture' ?
        self.originalAccount.preset : null;
      self.event.data.remote.isAllDay = self.event.isAllDay;

      if ((method === 'updateEvent' || method === 'updateEventFuture') &&
        repeatToNever) {
        method = 'updateEventAll';
        repeatToNever = false;
      }

      if (method === 'updateEvent' ||
          method === 'updateEventAll' ||
          method === 'updateEventFuture') {
        provider[method](self.event.data, self.dayBusytime, function(err) {
          list.remove(self.PROGRESS);

          if ((/^\/event\/show\//.test(self._returnTo))) {
            window.history.go(-2);
          } else {
            router.go(self.returnTo(), state);
          }

          if (err) {
            if (err.name === 'offline') {
              var dialogConfig = {
                title: {id: 'error-confirmation-title', args: {}},
                body: {id: 'edit-event-no-net', args: {}},
                accept: {
                  name: 'Ok',
                  l10nId: 'ok',
                  priority: 2,
                  callback: function() {}
                }
              };
              var dialog = new ConfirmDialogHelper(dialogConfig);
              dialog.show(
                document.getElementById('confirm-dialog-container'));
            } else {
              Toaster.showToast({
                messageL10nId: 'event-sync-failure'
              });
            }
            return;
          }

          Toaster.showToast({
            messageL10nId: 'kai-event-updated'
          });
        }, nowDateUtc);
      } else if (method === 'createEvent') {
        router.go(self.backPath, state);
        provider[method](self.event.data, self.dayBusytime, function(err) {
          list.remove(self.PROGRESS);

          if (err) {
            Toaster.showToast({
              messageL10nId: 'event-sync-failure'
            });
            return;
          }

          if (window.performance.getEntriesByName(
            'calendar-save-new-event-start', 'mark').length > 0) {
            window.performance.mark('calendar-save-new-event-end');
            window.performance.measure('performance-calendar-save-new-event',
              'calendar-save-new-event-start', 'calendar-save-new-event-end');
            window.performance.clearMeasures(
              'performance-calendar-save-new-event');
            window.performance.clearMarks('calendar-save-new-event-start');
            window.performance.clearMarks('calendar-save-new-event-end');
          }

          Toaster.showToast({
            messageL10nId: 'kai-event-added'
          });
        });
      }
    }
  },

  /**
   * Persist curren t model.
   */
  primary: function(event) {
    if (event) {
      event.preventDefault();
    }

    if (this.isSaved()) {
      this._persistEvent('updateEvent', 'canUpdate');
    } else {
      this._persistEvent('createEvent', 'canCreate');
    }
  },

  /**
   * Enlarges focus areas for .button controls
   */
  focusHandler: function(e) {
    if (e && e.target) {
      e.target.focus();
      var el = e.target.querySelector('input, select');
      if (el) {
        el.focus();
      }
    }
  },

  /**
   * Export form information into a format
   * the model can understand.
   *
   * @return {Object} formatted data suitable
   *                  for use with Calendar.Model.Event.
   */
  formData: function() {
    var fields = {
      title: this.getEl('title').value,
      location: this.getEl('location').value,
      repeat: this.getEl('repeat').value,
      description: this.getEl('description').value,
      calendarId: 'local-first',
      recurrenceId: '',
      endUtc: null,
      tone: self.tone
    };

    if (!lowMemory) {
      fields.calendarId = this.getEl('calendarId').value;
    }

    self.tone = null;

    if (fields.repeat !== 'never') {
      fields.isRecurring = true;
    } else {
      fields.isRecurring = false;
    }

    var startTime;
    var endTime;
    var allday = this.getEl('allday').checked;
    this.event.isAllDay = allday;
    var tzid = null;
    if (allday) {
      startTime = null;
      endTime = null;
      tzid = FLOATING;
    } else {
      startTime = this.element.querySelector('.start-time-picker').value;
      endTime = this.element.querySelector('.end-time-picker').value;
    }

    fields.startDate = InputParser.formatInputDate(
      this.element.querySelector('.start-date-picker').value,
      startTime
    );

    fields.endDate = InputParser.formatInputDate(
      this.element.querySelector('.end-date-picker').value,
      endTime
    );

    if (allday) {
      // when the event is all day we display the same
      // day that the entire event spans but we must actually
      // end the event at the first second, minute hour of the next
      // day. This will ensure the server handles it as an all day event.
      fields.endDate.setDate(
        fields.endDate.getDate() + 1
      );
    }

    fields.alarms = [];
    var triggers = ['none'];
    this.queryAlarms().forEach(alarm => {
      if (triggers.indexOf(alarm.value) !== -1) {
        return;
      }

      triggers.push(alarm.value);

      fields.alarms.push({
        action: 'DISPLAY',
        trigger: parseInt(alarm.value, 10),
        tzid: tzid
      });
    });

    fields.title = this.updateTitle(fields);
    return fields;
  },

  /**
   * Re-enable the primary button when we show errors
   */
  showErrors: function() {
    EventBase.prototype.showErrors.apply(this, arguments);
  },

  /**
   * Read the urlparams and override stuff on our event model.
   * @param {string} search Optional string of the form ?foo=bar&cat=dog.
   * @private
   */
  _overrideEvent: function(search) {
    search = search || window.location.search;
    if (!search || search.length === 0) {
      return;
    }

    // Remove the question mark that begins the search.
    if (search.substr(0, 1) === '?') {
      search = search.substr(1, search.length - 1);
    }

    var field, value;
    // Parse the urlparams.
    var params = QueryString.parse(search);
    for (field in params) {
      value = params[field];
      switch (field) {
        case ModifyEvent.OverrideableField.START_DATE:
        case ModifyEvent.OverrideableField.END_DATE:
          params[field] = new Date(value);
          break;
        default:
          params[field] = value;
          break;
      }
    }

    // Override fields on our event.
    var model = this.event;
    for (field in ModifyEvent.OverrideableField) {
      value = ModifyEvent.OverrideableField[field];
      model[value] = params[value] || model[value];
    }
  },

  _calcDate: function(isAllDay, data, endDate) {
    let currentDate = this.app.timeController.selectedDay;
    let nowDate = new Date(currentDate.valueOf() -
      (!isAllDay ? currentDate.getTimezoneOffset() * 60 * 1000 : 0));
    let date = new Date(data.valueOf());
    let offset = nowDate.setUTCHours(0, 0, 0, 0).valueOf() -
      date.setUTCHours(0, 0, 0, 0).valueOf();

    let retDate;
    if (isAllDay && endDate) {
      retDate = new Date(endDate.valueOf() + offset);
    } else {
      retDate = new Date(data.valueOf() + offset)
    }

    return retDate;
  },

  /**
   * Updates form to use values from the current model.
   *
   * Does not handle readonly flags or calenarId associations.
   * Suitable for use in pre-populating values for both new and
   * existing events.
   *
   * Resets any value on the current form.
   */
  _updateUI: function() {
    this._overrideEvent();
    this.form.reset();

    var model = this.event;
    this.getEl('title').value = model.title === window.navigator.mozL10n.get('no-title') ?
        '' : model.title;
    this.getEl('location').value = model.location;
    var dateSrc = model;
    if (model.remote.isRecurring && this.busytime) {
      dateSrc = this.busytime;
    }
    model.isAllDay = model.remote.isAllDay || model._isAllDay;

    var isAllDay = model.remote.isAllDay || model._isAllDay;
    var startDate = model.remote.isRecurring ?
      this._calcDate(isAllDay, dateSrc.startDate) : dateSrc.startDate;

    if (isAllDay) {
      var endDate = model.remote.isRecurring ?
        this._calcDate(isAllDay, dateSrc.startDate, dateSrc.endDate) :
        dateSrc.endDate;
    } else {
      var endDate = model.remote.isRecurring ?
        this._calcDate(isAllDay, dateSrc.endDate) : dateSrc.endDate;
    }

    this._duration = endDate.getTime() - startDate.getTime();

    // update the allday status of the view
    var allday = this.getEl('allday');
    if (allday && (allday.checked = model.isAllDay)) {
      this._toggleAllDay();
      endDate = this.formatEndDate(endDate);
      this._duration = endDate.getTime() - startDate.getTime();
      this.dataChanged = false;
    }

    this.element.querySelector('.start-date-picker').value =
      InputParser.exportDate(startDate);
    this._setupDateTimeSync('.start-date-picker',
      'start-date-locale', startDate);

    this.element.querySelector('.end-date-picker').value =
      InputParser.exportDate(endDate);
    this._setupDateTimeSync('.end-date-picker', 'end-date-locale', endDate);

    this.element.querySelector('.start-time-picker').value =
      InputParser.exportTime(startDate);
    this._setupDateTimeSync('.start-time-picker',
      'start-time-locale', startDate);

    this.element.querySelector('.end-time-picker').value =
      InputParser.exportTime(endDate);
    this._setupDateTimeSync('.end-time-picker',
      'end-time-locale', endDate);
    this.getEl('description').value = model.description ? model.description : '\n';
    this.getEl('repeat').value = !model.repeat ? 'never' : model.repeat;

    // update calendar id
    if (!lowMemory && model.calendarId) {
      this.getEl('calendarId').value = model.calendarId;

      // calendar display
      var currentCalendar = this.getEl('currentCalendar');

      if (this.originalCalendar) {
        currentCalendar.value =
          this.originalCalendar.remote.name;

        currentCalendar.readOnly = true;
      }
    }
    this.updateAlarms(model.isAllDay);
  },

  /**
   * Handling a layer over <input> to have localized
   * date/time
   */
  _setupDateTimeSync: function(src, target, value) {
    var targetElement = document.querySelector("#" + target);
    if (!targetElement) {
      return;
    }
    this._renderDateTimeLocale(targetElement, value);

    var type = targetElement.dataset.type;
    var callback = type === 'date' ?
      this._updateDateLocaleOnInput : this._updateTimeLocaleOnInput;

    this.element.querySelector(src).addEventListener('input', function(e) {
        callback.call(this, targetElement, e);

        // We only auto change the end date and end time
        // when user changes start date or start time,
        // or end datetime is NOT after start datetime
        // after changing end date or end time.
        // Otherwise, we don't auto change end date and end time.
        if (targetElement.id === 'start-date-locale' &&
          this.getStartTimeDate() < this.getSelectTimeDate()) {
          let selectedDate = this.app.timeController.selectedDay;
          let startDateLocale = this._findElement('startDateLocale');
          this.element.querySelector('.start-date-picker').value =
            InputParser.exportDate(selectedDate);
          this._renderDateTimeLocale(startDateLocale, selectedDate);
          this.showErrors({name: 'start-date-before-seleced-day'});
        } else if (targetElement.id === 'start-date-locale' ||
            targetElement.id === 'start-time-locale') {
          this._setEndDateTimeWithCurrentDuration();
        } else if (this.getEl('allday').checked && this._getEndDateTime() === this._getStartDateTime()) {
          this._duration = 0;
          this._setEndDateTimeWithCurrentDuration();
        } else if (this._getEndDateTime() <= this._getStartDateTime()) {
          this._setEndDateTimeWithCurrentDuration();
          this.showErrors({
            name: type === 'date' ?
              'start-date-after-end-date' :
              'start-time-after-end-time'
          });
        }
        this._duration = this._getEndDateTime() - this._getStartDateTime();
      }.bind(this));
  },

  _setEndDateTimeWithCurrentDuration: function() {
    var date = new Date(this._getStartDateTime() + this._duration);
    var endDateLocale = this._findElement('endDateLocale');
    var endTimeLocale = this._findElement('endTimeLocale');
    this.element.querySelector('.end-date-picker').value =
      InputParser.exportDate(date);
    this.element.querySelector('.end-time-picker').value =
      InputParser.exportTime(date);
    this._renderDateTimeLocale(endDateLocale, date);
    this._renderDateTimeLocale(endTimeLocale, date);
  },

  _getStartDateTime: function() {
    return new Date(this.element.querySelector('.start-date-picker').value +
      'T' + this.element.querySelector('.start-time-picker').value).getTime();
  },

  _getEndDateTime: function() {
    return new Date(this.element.querySelector('.end-date-picker').value + 'T' +
    this.element.querySelector('.end-time-picker').value).getTime();
  },

  getStartTimeDate: function() {
    return new Date(this.element.querySelector('.start-date-picker').value);
  },

  getSelectTimeDate: function() {
    let selectDate = new Date(this.app.timeController.selectedDay.valueOf());
    selectDate = selectDate.setHours(0, 0, 0, 0);
    return new Date(selectDate.valueOf());
  },

  _renderDateTimeLocale: function(targetElement, value) {
    // we inject the targetElement to make it easier to test
    var type = targetElement.dataset.type;
    var localeFormat = dateFormat.localeFormat;
    var formatKey = this.formats[type];
    if (type === 'time') {
      formatKey = getTimeL10nLabel(formatKey);
    }
    var format = navigator.mozL10n.get(formatKey);
    targetElement.textContent = localeFormat(value, format);
    // we need to store the format and date for l10n
    targetElement.setAttribute('data-l10n-date-format', formatKey);
    targetElement.dataset.date = value;
  },

  _updateDateLocaleOnInput: function(targetElement, e) {
    var selected = InputParser.importDate(e.target.value);
    // use date constructor to avoid issues, see Bug 966516
    var date = new Date(selected.year, selected.month, selected.date);
    this._renderDateTimeLocale(targetElement, date);
  },

  _updateTimeLocaleOnInput: function(targetElement, e) {
    var selected = InputParser.importTime(e.target.value);
    var date = new Date();
    date.setHours(selected.hours);
    date.setMinutes(selected.minutes);
    date.setSeconds(0);
    this._renderDateTimeLocale(targetElement, date);
  },

  /**
   * Called on render or when toggling an all-day event
   */
  updateAlarms: function(isAllDay, callback) {
    var template = AlarmTemplate;
    var alarms = [];

    // Used to make sure we don't duplicate alarms
    var alarmMap = {};

    if (this.event.alarms && !this.dataChanged) {
      //jshint boss:true
      for (var i = 0, alarm; alarm = this.event.alarms[i]; i++) {
        alarmMap[alarm.trigger] = true;
        alarm.layout = isAllDay ? 'allday' : 'standard';
        alarms.push(alarm);
      }
    }

    var settings = this.app.store('Setting');
    var layout = isAllDay ? 'allday' : 'standard';
    settings.getValue(layout + 'AlarmDefault', next.bind(this));

    function next(err, value) {
      //jshint -W040
      if ((!this.isSaved() && !alarmMap[value] && !this.event.alarms.length)
        || (this.isSaved() && this.dataChanged)) {
        alarms.push({
          layout: layout,
          trigger: value
        });
      }

      if (alarms.length == 0 && ((value === 'none' && this.isSaved()) || value !== 'none')) {
        alarms.push({
          layout: layout
        });
      }

      this.alarmList.innerHTML = template.picker.renderEach(alarms).join('');

      if (callback) {
        callback();
      }
    }
  },

  onFocusChanged: function(e) {
    if (e.detail.panel === 'modify-event-view') {
      var filter = ['title', 'location', 'notes', 'ringtones'];
      var focusedItem = e.detail.focusedItem;
      var classList = focusedItem.classList;
      var isShowCSK = true;
      for (var i = 0, len = filter.length; i < len; i++) {
        if (classList.contains(filter[i])) {
          var el = focusedItem.querySelector('.tcl-input-focusable');
          if (el) {
            el.focus();
            //LIO-1145 remove KaiOs new desgin
	    //el.selectionStart = el.value.length;
          }
          break;
        }
      }
      this._createMenu();
    }
  },

  editOptionMenu: function(allFlag) {
    var _ = navigator.mozL10n.get;

    var chooserItem = {
      name: 'Select',
      l10nId: 'select',
      priority: 2
    };

    let params = {
      classes: ['group-menu', 'softkey'],
      header: _('options') || '',
      items: [],
      menuClassName: 'menu-button'
    };

    if (allFlag) {
      params.items.push({
        name: _('event-edit-all'),
        method: () => {
          self._persistEvent('updateEventAll', 'canUpdate');
        }
      });
    }

    params.items.push({
      name: _('event-edit-all-future'),
      method: () => {
        self._persistEvent('updateEventFuture', 'canUpdate');
      }
    });

    optionMenu = new OptionMenu(params);
    optionMenu.show().then(() => {
      let menu = document.getElementById('mainmenu');
      let header = optionMenu.form.querySelector('h1');
      header.setAttribute('style', 'bottom:' + menu.offsetHeight + 'px');
    });

    secondCall = false;
    NavigationMap.reset_options();
    self.app.createSks([chooserItem]);
  },

  _createMenu: function() {
    self = this;

    var skCancel = {
      name: 'Cancel',
      l10nId: 'cancel',
      priority: 1,
      method: function() {
        self.cancel();
      }
    };
    var skSave = {
      name: 'Save',
      l10nId: 'save',
      priority: 3,
      method: function() {
        if (self.getEl('repeat').value === 'never' ||
          self.state === self.CREATE) {
          self.isSaveingFlag = true;
          self._createMenu();
          self._saveData();
        } else {
          self.editOptionMenu(self.getEl('repeat').value === self.event.repeat);
        }
      }
    };
    var skDefaultCSK = {
      name: 'select',
      l10nId: 'select',
      priority: 2,
      method: function(){}
    };
    var skEnterCSK = {
      name: 'Enter',
      l10nId: 'enter',
      priority: 2,
      method: function(){}
    };
    var skEmpty = {
      name: '',
      l10nId: '',
      priority: 1,
      method: function() {}
    };

    var params = [];

    var focusedItem = document.querySelector('#modify-event-view .focus');
    if (focusedItem) {
      if (focusedItem.querySelector('#note-pad')) {
        params.push(skEnterCSK);
      } else if (focusedItem.querySelector('input:not([type="text"]):not(.none-select), button, select')) {
        params.push(skDefaultCSK);
      }
    }
    params.push(skCancel, skSave);

    this.app.createSks(params);
  },

  _saveData: function() {
    console.log("[EditView]_saveData");

    if ('local-first' === this.getEl('calendarId').value) {
      this.saveEventData();
    } else {
      this.app.getDataConnState().then((res) => {
        if (res) {
          this.saveEventData();
        } else {
          this.showNoInternetSaveDialog(!this.isSaved());
        }
      });
    }
  },

  saveEventData: function() {
    if (this.isSaved()) {
      this._persistEvent('updateEvent', 'canUpdate');
    } else {
      window.performance.mark('calendar-save-new-event-start');
      this._persistEvent('createEvent', 'canCreate');
    }
  },

  showNoInternetSaveDialog(createEvent) {
    if (!createEvent) {
      return;
    }

    var dialogConfig = {
      title: {id: 'error-confirmation-title', args: {}},
      body: {id: 'error-add-online-event', args: {}},
      accept: {
        name: 'Ok',
        l10nId: 'ok',
        priority: 2,
        callback: function() {}
      }
    }
    var dialog = new ConfirmDialogHelper(dialogConfig);
    dialog.show(document.getElementById('confirm-dialog-container'));
  },

  clear: function() {
    var list = this.element.classList;

    list.remove(this.READONLY);
    list.remove(this.UPDATE);
    list.remove(this.ALLDAY);
    list.remove(this.CREATE);

    var allday = this.getEl('allday');

    if (allday) {
      allday.checked = false;
    }

    this.event = null;
    this.busytime = null;
    this._returnTo = null;
    this._markReadonly(false);
    this.provider = null;

    this.alarmList.innerHTML = '';

    this.form.reset();
  },

  updateEndKeyHandler: function() {
    if (!this.updatedHandler) {
       this.updatedHandler = true;
       window.addEventListener('keydown', (e) => {
        if (e.key !== 'EndCall') {
          return;
        }
        if ((window.location.pathname === "/event/add/" ||
             window.location.pathname.match('/event/edit/')) &&
             self.dataChanged) {
          if (!self.endKeyClicked) {
            self.endKeyClicked = true;
            e.preventDefault();
            self.saveEvent('EndKey', function() {
              self.app.closeApp();
            });
          } else {
            self.app.closeApp();
          }
        } else {
          self.app.closeApp();
        }
      });
    }
  },

  initInputListner: function() {
    var allday = this.getEl('allday');
    var title = this.getEl('title');
    var location = this.getEl('location');
    var startDate = this.element.querySelector('.start-date-picker');
    var endDate = this.element.querySelector('.end-date-picker');
    var startTime = this.element.querySelector('.start-time-picker');
    var endTime = this.element.querySelector('.end-time-picker');
    var description = this.getEl('description');
    var repeat = this.getEl('repeat');

    if (!lowMemory) {
      var currentCalendar = this.getEl('currentCalendar');
      currentCalendar.addEventListener('input', this._observeDataChange);
    }

    repeat.addEventListener('change', this._repeatChange);
    allday.addEventListener('change', this._toggleAllDay);
    title.addEventListener('input', this._observeDataChange);
    location.addEventListener('input', this._observeDataChange);
    startDate.addEventListener('input', this._observeDataChange);
    endDate.addEventListener('input', this._observeDataChange);
    startTime.addEventListener('input', this._observeDataChange);
    endTime.addEventListener('input', this._observeDataChange);
    description.addEventListener('input', this._observeDataChange);
    description.addEventListener('focus', this.setFocusAtEnd.bind(this));
    description.addEventListener('keydown', this.divHandler.bind(this));

    this.alarmList.addEventListener("click",this.handleClick);
    this.alarmList.addEventListener('change', this._changeAlarm.bind(this));
  },

  saveEvent: function(keyPressed, callbackmethod) {
    if (!self.app.deleteDialogShown) {
      self.app.deleteDialogShown = true;
      self.endKeyClicked = true;
      self.app.hideSkPanel();
      var content = (keyPressed === 'Backspace') ?
          'kai-save-message-back' : 'kai-save-message-close';
      var dialogConfig = {
        title: {id: 'kai-confirmation-title', args: {}},
        body: {id: content, args: {}},
        cancel: {
          l10nId: 'no',
          name: 'No',
          priority: 1,
          callback: function() {
            self.endKeyClicked = false;
            if (callbackmethod) {
              document.body.setAttribute('hidden', '');
              callbackmethod && callbackmethod();
            } else {
              self.app.deleteDialogShown = false;
              self.app.showSkPanel();
              self.cancel();
            }
          }
        },
        confirm: {
          l10nId: 'yes',
          name: 'Yes',
          priority: 3,
          callback: function() {
            self.endKeyClicked = false;
            self.app.deleteDialogShown = false;
            self.app.showSkPanel();
            if (self.getEl('repeat').value === 'never' ||
              self.state === self.CREATE) {
              self.isSaveingFlag = true;
              self._createMenu();
              self._saveData();
            } else {
              self.editOptionMenu(self.getEl('repeat').value ===
                self.event.repeat);
            }
            if (callbackmethod) {
              callbackmethod && callbackmethod();
            }
          }
        }
      }
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('confirm-dialog-container'));
    }
  },

  updateDOM: function() {
    if (!lowMemory) {
      if (this.state === this.CREATE) {
        document.querySelector('#event-calendar').classList.add(this.FOCUS_ABLE);
      } else {
        document.querySelector('#event-calendar').classList.remove(this.FOCUS_ABLE);
      }
    }

    if(!this.getEl('allday').checked){
        document.querySelector("#startTime-Li").classList.add(this.FOCUS_ABLE);
        document.querySelector("#endTime-Li").classList.add(this.FOCUS_ABLE);
    }
    document.querySelector("#modify-event-view #event-info-form").scrollTo(0,0);
  },

  updateTitle: function(fields){
     if (fields.title.replace(/\s+/g, '') === '') {
         return window.navigator.mozL10n.get('no-title');
     }
     return fields.title;
  },

  handleClick: function(evt) {
      //for special opreation of Event Remind option
      evt.target.querySelector("select").focus();
  },

  setFocusAtEnd: function(){
    var selection = window.getSelection();
    var range = document.createRange();
    var lastChild = this.getEl('description').lastChild;

    if (lastChild) {
      if (lastChild.tagName === 'BR') {
        range.setStartBefore(lastChild);
      } else {
        range.setStartAfter(lastChild);
      }
    }

    selection.removeAllRanges();
    selection.addRange(range);
  },

  divHandler: function(evt){
    var description = this.getEl('description');
    var length = description.value.length;

    switch(evt.key){
      case "ArrowUp":
        if (0 === description.selectionStart) {
          break;
        }
        evt.stopPropagation();
        break;
      case "ArrowDown":
        if (description.selectionStart === length) {
          break;
        }
        evt.stopPropagation();
        break;
    }
  },

  _setBackPath: function() {
    if (/^\/(day|month|week)/.test(router.last.path)) {
      this.backPath = router.last.path;
    }
  }
};

/**
 * The fields on our event model which urlparams may override.
 * @enum {string}
 */
ModifyEvent.OverrideableField = {
  CALENDAR_ID: 'calendarId',
  DESCRIPTION: 'description',
  END_DATE: 'endDate',
  IS_ALL_DAY: 'isAllDay',
  LOCATION: 'location',
  START_DATE: 'startDate',
  TITLE: 'title'
};

});

define('templates/calendar',['require','exports','module','provider/local','template'],function(require, exports, module) {


var Local = require('provider/local');
var create = require('template').create;

module.exports = create({
  item: function() {
    var id = this.h('_id');
    var color = this.h('color');
    var l10n = '';
    var name = '';

    // localize only the default calendar; there is no need to set the name
    // the [data-l10n-id] will take care of setting the proper value
    if (id && Local.calendarId === id) {
      // localize the default calendar name
      l10n = 'data-l10n-id="calendar-local"';
    } else {
      name = this.h('name');
    }

    var checked = this.bool('localDisplayed', 'checked');
    var ariaSelected = this.bool('localDisplayed', 'aria-selected="true"');

    return `<li id="calendar-${id}" role="presentation" class="focusable">
        <label class="pack-checkbox-large">
          <input value="${id}" type="checkbox" ${checked}/>
          <span ${l10n} class="p-pri">${name}</span>
        </label>
      </li>`;
  }
});

});

define('views/settings',['require','exports','module','templates/calendar','view','debug','object','router','dom!settings'],function(require, exports, module) {


var CalendarTemplate = require('templates/calendar');
var View = require('view');
var debug = require('debug')('views/settings');
var forEach = require('object').forEach;
var router = require('router');

require('dom!settings');

var skSave = {
  name: 'Save',
  l10nId: 'save',
  priority: 3,
  method: function() {
    console.log('Save');
    self.save();
    setTimeout(function() {
      window.history.back();
    }, 600);
  }
};

var skDefaultCSK = {
  name: 'select',
  l10nId: 'select',
  priority: 2,
  method: function() {}
};

var settingsOptionActions = [skDefaultCSK, skSave];

function Settings(options) {
  View.apply(this, arguments);

  this.calendarList = {};
  this._onDrawerTransitionEnd = this._onDrawerTransitionEnd.bind(this);
  this._updateTimeouts = Object.create(null);

  this._observeUI();
}
module.exports = Settings;

Settings.prototype = {
  __proto__: View.prototype,

  calendarList: null,

  waitBeforePersist: 600,

  checkboxChanged: false,

  self: null,

  /**
   * Local update is a flag
   * used to indicate that the incoming
   * update was made by this view and
   * should not fire the _update method.
   */
  _localUpdate: false,
  backPath: '/month/',

  /**
   * Name of the class that will be applied to the
   * body element when sync is in progress.
   */
  selectors: {
    element: '#settings',
    calendars: '#settings .calendars',
    calendarName: '.name',
    header: '#settings-header',
    headerTitle: '#settings-header h1',

    // This outer div is used to hide .settings-drawer via an
    // overflow: hidden, so that the .settings-drawer can translateY
    // animate downward and appear to come out from under the view
    // header that is visible "behind" the element used for settings.
    drawerContainer: '#settings .settings-drawer-container',

    // Holds the actual visible drawer contents: list of calendars
    drawer: '#settings .settings-drawer',
  },

  get calendars() {
    return this._findElement('calendars');
  },

  get header() {
    return this._findElement('header');
  },

  get headerTitle() {
    return this._findElement('headerTitle');
  },

  get drawerContainer() {
    return this._findElement('drawerContainer');
  },

  get drawer() {
    return this._findElement('drawer');
  },

  _setDefaultBackPath: function() {
    if (/^\/(day|month|week|show-multi-events)/.test(router.last.path)) {
      this.backPath = router.last.path;
    }
  },

  back: function() {
    router.go(this.backPath);
  },

  handleKeyEvent: function(e) {
    if(window.location.pathname === '/settings/') {
      switch(e.key) {
        case 'Backspace':
        case 'BrowserBack':
          e.preventDefault();
          self.back();
          break;
      }
    }
  },

  updateSKs:function(actions){
    this.app.createSks(actions);
  },

  // add observe
  _observeUI: function() {
    this.calendars.addEventListener(
      'change', this._onChangeDisplay.bind(this)
    );
  },

  _observeCalendarStore: function() {
    var store = this.app.store('Calendar');
    var self = this;

    function handleEvent(method) {
      return function() {
        self[method].apply(self, arguments);
      };
    }

    // calendar store events
    store.on('update', handleEvent('_update'));
    store.on('add', handleEvent('_add'));
    store.on('remove', handleEvent('_remove'));
  },

  _observeAccountStore: function() {
    var store = this.app.store('Account');
    var handler = this._updateSyncButton.bind(this);
    store.on('add', handler);
    store.on('remove', handler);
  },

  _saveCalendarDisplay: function(id, displayed) {
    var store = self.app.store('Calendar');

    // clear timeout id
    delete this._updateTimeouts[id];

    function persist(err, id, model) {
      if (err) {
        return console.error('Cannot save calendar', err);
      }

      if (self.ondisplaypersist) {
        self.ondisplaypersist(model);
      }
    }

    function fetch(err, calendar) {
      if (err) {
        return console.error('Cannot fetch calendar', id);
      }

      calendar.localDisplayed = displayed;
      store.persist(calendar, persist);
    }

    store.get(id, fetch);
  },

  _add: function(id, model) {
    this.calendarList[id] = model;
    this.render();
  },

  _update: function(id, model) {
    this.calendarList[id] = model;
    this.render();
  },

  _remove: function(id) {
    delete this.calendarList[id];
    this.render();
  },

  _onChangeDisplay: function(e) {
    this.checkboxChanged = true;
  },

  save: function() {
    if(self.checkboxChanged) {
      var items = document.querySelectorAll(".settings-drawer-container .settings-drawer ol li label input");
      for(var i = 0; i < items.length; i++) {
        self._saveCalendarDisplay(items[i].value, !!items[i].checked);
      }
    }
  },

  onrender: function() {
    this._rendered = true;
    this._animateDrawer();
  },

  render: function() {
    if(window.location.pathname != "/settings/") {
      return;
    }
    console.log('render settings view.');
    this.calendars.innerHTML = '';
    forEach(this.calendarList, function(id, object) {
      console.log('Will add object to settings view');
      var html = CalendarTemplate.item.render(object);
      this.calendars.insertAdjacentHTML('beforeend', html);

      if (object.error) {
        console.error('Views.Settings error:', object.error);
        var idx = this.calendars.children.length - 1;
        var el = this.calendars.children[idx];
        el.classList.add('error');
      }

    }, this);

    this.onrender && this.onrender();

    console.log('Will update (show/hide) sync button.');
    this._updateSyncButton();
    NavigationMap.reset("settings");
  },

  _updateSyncButton: function(callback) {
    var store = this.app.store('Account');
    store.syncableAccounts((err, list) => {
      if (err) {
        console.error('Error fetching syncable accounts:', err);
        return callback(err);
      }

      // test only event
      self.onupdatesyncbutton && self.onupdatesyncbutton();
      return callback && callback();
    });
  },

  _onDrawerTransitionEnd: function(e) {
    this._updateDrawerAnimState('done');
    if (!document.body.classList.contains('settings-drawer-visible')) {
      router.resetState();
    }
  },

  // Update a state visible in the DOM for when animation is taking place.
  // This is mostly useful for a test hook to know when the animation is
  // done.
  _updateDrawerAnimState: function(state) {
    this.drawer.dataset.animstate = state;
  },

  _animateDrawer: function() {
    // Wait for both _rendered and _activated before triggering
    // the animation, so that it is smooth, without jank due to
    // changes in style/layout from activating or rendering.
    // Also, set the style on the body, since other views will also
    // have items animate based on the class. For instance, the +
    // to add an event in the view-selector views fades out.
    if (!this._rendered) {
      return debug('Skip animation since not yet rendered.');
    }

    if (!this._activated) {
      return debug('Skip animation since not yet activated.');
    }

    var classList = document.body.classList;
    if (classList.contains('settings-drawer-visible')) {
      return debug('Skip animation since drawer already visible?');
    }

    this._updateDrawerAnimState('animating');
    classList.add('settings-drawer-visible');
  },

  onactive: function() {
    debug('Will do settings animation.');
    self = this;
    self.checkboxChanged = false;
    // If we haven't yet cached idb calendars, do that now.
    var fetch;
    var store = this.app.store('Calendar');
    fetch = store.all().then((calendars) => {
      debug('Settings view found calendars:', calendars);
      this.calendarList = calendars;

      // observe new calendar events
      this._observeCalendarStore();

      // observe accounts to hide sync button
      this._observeAccountStore();
    });

    this.updateSKs(settingsOptionActions);
    this._setDefaultBackPath();
    window.addEventListener('keydown', this.handleKeyEvent);

    return fetch.then(() => {
      // View#onactive will call Views.Settings#render the first time.
      View.prototype.onactive.apply(this, arguments);
      this.render();

      // onactive can be called more times than oninactive, since
      // settings can overlay over and not trigger an inactive state,
      // so only bind these listeners and do the drawer animation once.
      var body = document.body;
      if (body.classList.contains('settings-drawer-visible')) {
        return;
      }

      debug('Settings drawer is not visible... will activate.');
      this._activated = true;
      this._animateDrawer();

      // Set header title to same as time view header
      // this.headerTitle.textContent =
      // document.getElementById('current-month-year').textContent;

      // Both the transparent back and clicking on the semi-opaque
      // shield should close the settings since visually those sections
      // do not look like part of the drawer UI, and UX wants to give
      // the user a few options to close the drawer since there is no
      // explicit close button.
      this.header.addEventListener('action', this._hideSettings);
      this.drawer.addEventListener('transitionend',
                                   this._onDrawerTransitionEnd);
    })
    .catch((err) => {
      return console.error('Error fetching calendars in View.Settings', err);
    });
  },

  oninactive: function() {
    debug('Will deactivate settings.');
    View.prototype.oninactive.apply(this, arguments);
    this._activated = false;
    this.drawer.removeEventListener('transitionend',this._onDrawerTransitionEnd);
    window.removeEventListener('keydown', this.handleKeyEvent);
    this.calendarList = {};
  }

};

Settings.prototype.onfirstseen = Settings.prototype.render;

});

define('templates/duration_time',['require','exports','module','calc','templates/date_span','template','date_format'],function(require, exports, module) {


var Calc = require('calc');
var DateSpan = require('templates/date_span');
var create = require('template').create;
var dateFormat = require('date_format');

var l10n = navigator.mozL10n;

module.exports = create({
  durationTime: function() {
    var formatTitle = '';
    var formatContent = '';
    var startDate = this.arg('startDate');
    var endDate = this.arg('endDate');
    var isAllDay = this.arg('isAllDay');

    if (isAllDay) {
      // Use the last second of previous day as the base for endDate
      // (e.g., 1991-09-14T23:59:59 insteads of 1991-09-15T00:00:00).
      endDate = new Date(endDate - 1000);
      if (Calc.isSameDate(startDate, endDate)) {
        formatTitle = 'one-all-day-duration-title';
        formatContent = 'all-day-duration-content';
      } else {
        formatTitle = 'multiple-all-day-duration-title';
        formatContent = 'multiple-all-day-duration-content';
      }
    } else {
      if (Calc.isSameDate(startDate, endDate)) {
        formatTitle = 'one-day-duration-title';
        formatContent = 'one-day-duration-content';
      } else {
        formatTitle = 'multiple-day-duration-title';
        formatContent = 'multiple-day-duration-content';
      }
    }

    var formatTitleString = l10n.get(formatTitle, {
      startTime: formatTime(startDate),
      startDate: formatDate(startDate),
      endTime: formatTime(endDate),
      endDate: formatDate(endDate)
    });

    var formatContentString = l10n.get(formatContent, {
      startTime: formatTime(startDate),
      startDate: formatDate(startDate),
      endTime: formatTime(endDate),
      endDate: formatDate(endDate)
    });

    if (Calc.isSameDate(startDate, endDate)) {
      return `<span class="p-sec">${formatTitleString}</span>
            <span class="p-pri">${formatContentString}</span>`;
    } else {
      return isAllDay ?
            `<span class="p-sec">${formatTitleString}</span>
              <span class="p-sec alldayContent">${formatContentString}</span>
              <span class="p-pri" data-l10n-id = "all-day-duration-content"></span>`
              :
              `<span data-l10n-id = "from"></span>
              <span class="p-pri">${formatTitleString}</span>
              <span data-l10n-id = "to"></span>
              <span class="p-pri">${formatContentString}</span>`;
    }
  }
});

function formatDate(date) {
  return dateFormat.localeFormat(
    date,
    l10n.get('longDateFormat')
  );
}

function formatTime(time) {
  return DateSpan.time.render({
    time: time,
    format: 'shortTimeFormat'
  });
}

});

define('views/view_event',['require','exports','module','templates/duration_time','./event_base','provider/local','templates/alarm','router','provider/caldav','calc','dom!event-view'],function(require, exports, module) {


var DurationTime = require('templates/duration_time');
var EventBase = require('./event_base');
var Local = require('provider/local');
var alarmTemplate = require('templates/alarm');
var router = require('router');
var CaldavProvider = require('provider/caldav');
var Calc = require('calc');
var dateFromId = Calc.dateFromId;

require('dom!event-view');

var eventCalendarHtml = `
  <li class="current-calendar indicator">
    <span aria-hidden="true" class="p-sec" data-l10n-id="kai-event-calendar"></span>
    <span aria-hidden="true" class="p-pri content lines" data-l10n-id="calendar"></span>
  </li>`;
var lowMemory = false;
var viewEventOptionActions = [];
var editFlag = false;
var optionMenu = null;

var skEdit = {
  name: 'Edit',
  priority: 3,
  l10nId: 'edit',
  method: function () {
    if (editFlag) {
      return;
    }
    editFlag = true;

    var calendarId = that.event.data.calendarId;
    var isLocalCalendar = calendarId === Local.calendarId;

    that.showWarningDialog(isLocalCalendar, 'edit').then((value) => {
      if (!value) {
        router.go('/event/edit/' + that.busytime._id + '/');
      }
      editFlag = false;
    });
  }
};

var skDelete = {
  name: 'Delete',
  priority: 1,
  l10nId: 'delete',
  method: function () {
    let calendarId = self.event.data.calendarId;
    let isLocalCalendar = calendarId === Local.calendarId;

    self.showWarningDialog(isLocalCalendar, 'delete').then((value) => {
      if (!value) {
        if (that.event.remote.isRecurring) {
          deleteOptionMenu();
        } else {
          self.deleteEvent();
        }
      }
    });
  }
};

var chooserItem = {
  name: 'Select',
  l10nId: 'select',
  priority: 2
};

function deleteOptionMenu() {
  var _ = navigator.mozL10n.get;

  let params = {
    classes: ['group-menu', 'softkey'],
    header: _('options') || '',
    items: [],
    menuClassName: 'menu-button'
  };

  params.items.push({
    name: _('event-delete-all'),
    method: () => {
      var calendarId = self.event.data.calendarId;
      var isLocalCalendar = calendarId === Local.calendarId;

      self.showWarningDialog(isLocalCalendar, 'delete').then((value) => {
        if (!value) {
          self.deleteRepeatEvent('deleteEvent');
        }
      });
    }
  });
  params.items.push({
    name: _('event-delete-all-future'),
    method: () => {
      var calendarId = self.event.data.calendarId;
      var isLocalCalendar = calendarId === Local.calendarId;

      self.showWarningDialog(isLocalCalendar, 'delete').then((value) => {
        if (!value) {
          if (self.event.remote.startDate.valueOf() ===
            self.dayBusytime.startDate.valueOf()){
            self.deleteRepeatEvent('deleteEvent');
          } else {
            self.deleteRepeatEvent('deleteEventFuture');
          }
        }
      });
    }
  });

  optionMenu = new OptionMenu(params);
  optionMenu.show().then(() => {
    let menu = document.getElementById('mainmenu');
    let header = optionMenu.form.querySelector('h1');
    header.setAttribute('style', 'bottom:' + menu.offsetHeight + 'px');
  });

  secondCall = false;
  NavigationMap.reset_options();
  self.updateSKs([chooserItem]);
}

function ViewEvent(options) {
  lowMemory = localStorage.getItem('isLowMemoryDevice') === 'true' ?
    true : false;
  if (!lowMemory) {
    var item = document.querySelector('#event-view .description');
    item.insertAdjacentHTML('beforeBegin', eventCalendarHtml);
  }
  EventBase.apply(this, arguments);
}
module.exports = ViewEvent;

ViewEvent.prototype = {
  __proto__: EventBase.prototype,

  self: null,
  that: null,
  viewEventObj: null,

  DEFAULT_VIEW: '/month/',

  selectors: {
    element: '#event-view',
    header: '#show-event-header',
  },

  _initEvents: function() {
    EventBase.prototype._initEvents.apply(this, arguments);
  },

  /**
   * Dismiss modification and go back to previous screen.
   */
  cancel: function() {
    router.go(this.returnTop());
  },

  primary: function(event) {
    if (event) {
      event.preventDefault();
    }

    router.go('/event/edit/' + this.busytime._id + '/');
  },

  /**
   * Sets content for an element
   * Hides the element if there's no content to set
   */
  setContent: function(element, content, method) {
    method = method || 'textContent';
    element = this.getEl(element);

    if (element.classList.contains('content')) {
      element[method] = content;
    } else {
      element.querySelector('.content')[method] = content;
    }

    if (!content) {
      element.style.display = 'none';
    } else {
      element.style.display = '';
    }
  },

  _caleRecuDate: function(data, originalAccount) {
    let item = document.querySelector('#time-views .selected');
    let currentDate = self.app.timeController.selectedDay;
    let nowDate = new Date(currentDate.valueOf() -
      (!data.isAllDay ? currentDate.getTimezoneOffset() * 60 * 1000 : 0));
    let date =
      new Date(data.start.utc - (data.isAllDay ? data.start.offset : 0));
    let offset = nowDate.setUTCHours(0, 0, 0, 0).valueOf() -
      date.setUTCHours(0, 0, 0, 0).valueOf();

    let newDate = {
      startDate: new Date(data.startDate.valueOf() + offset),
      endDate: new Date(data.endDate.valueOf() + offset),
      isAllDay: data.isAllDay
    }

    return newDate;
  },

  handleSoftkeyForSyncSwitch(model, viewEventOptionActions) {
    let account = this.app.store('Account');

    account.all((err, list) => {
      for (let key in list) {
        if (self.originalCalendar.remote.name === list[key].user ||
          self.originalAccount.user === list[key].user) {
          if (!list[key].syncFlag && list[key].preset !== 'caldav') {
            Toaster.showToast({
              messageL10nId: 'account-sync-off-tip',
            });
            self.updateSKs([]);
          } else {
            self.updateSKs(viewEventOptionActions);
          }
        }

      }
    });
  },

  /**
   * Updates the UI to use values from the current model.
   */
  _updateUI: function() {
    var model = this.event;
    viewEventOptionActions = [skDelete, skEdit];
    var provider = new CaldavProvider({ app: self.app });
    provider.eventCapabilities(model, (err, data) => {
      if (!data.canUpdate) {
        viewEventOptionActions = self.stripItem(viewEventOptionActions, 'Edit');
      }
      if (!data.canDelete) {
        viewEventOptionActions = self.stripItem(viewEventOptionActions, 'Delete');
      }
      OptionHelper.optionParams["enter-item"] = viewEventOptionActions;

      if (model.data.calendarId === 'local-first') {
        that.updateSKs(viewEventOptionActions);
      } else {
        this.handleSoftkeyForSyncSwitch(model, viewEventOptionActions);
      }
    });

    this.setContent('title', model.title);
    this.setContent('location', model.location);

    if (this.originalCalendar && !lowMemory) {
      this.element.querySelector('.indicator').style['border-left-color'] =
          this.originalCalendar.color;
      var calendarId = this.originalCalendar.remote.id;
      var isLocalCalendar = calendarId === Local.calendarId;
      var calendarName = isLocalCalendar ?
        navigator.mozL10n.get('calendar-local') :
        this.originalCalendar.remote.name;

      this.setContent(
        'current-calendar',
        calendarName
      );

      if (isLocalCalendar) {
        this.getEl('current-calendar')
          .querySelector('.content')
          .setAttribute('data-l10n-id', 'calendar-local');
      }
    }

    var dateSrc = model;
    if (model.remote.isRecurring && this.dayBusytime) {
      dateSrc = this.dayBusytime;
      dateSrc.isAllDay = this.event.remote.isAllDay || this.event._isAllDay;
    }

    var duationTimeContent = DurationTime.durationTime.render(dateSrc);
    let _ = navigator.mozL10n.get;

    if (!lowMemory) {
      let repeatItem = _('view-' + model.remote.repeat);
      duationTimeContent += `<span class="p-sec">${repeatItem}</span>`;
    }

    this.setContent('duration-time', duationTimeContent, 'innerHTML');

    var alarmContent = '';
    var alarms = this.event.alarms;
    if (alarms) {
      this.getEl('alarms')
        .classList
        .toggle('multiple', alarms.length > 1);

      alarmContent = alarmTemplate.reminder.render({
        alarms: alarms,
        isAllDay: this.event.remote.isAllDay || this.event._isAllDay,
      });
    }

    this.setContent('alarms', alarmContent, 'innerHTML');
    this.setContent('description', model.description, 'innerText');

    this.element.classList.remove('loading');

    var item = this.element.querySelector('.event-view-scrollable .content');
    if (item) {
      item.scrollIntoView(true);
    }
  },

  onactive: function() {
    editFlag = false;
    if(!window.location.pathname.match('/alarm-display/') && 
    this._returnTo != "/month/"){
      setTimeout(()=>{this.updateSKs([])})
    }
    EventBase.prototype.onactive.apply(this, arguments);
    window.addEventListener('keydown', this.handleKeyEvent, false);
    self = this;
    that = this;
    viewEventObj = this;
  },

  oninactive: function() {
    EventBase.prototype.oninactive.apply(this, arguments);
    window.removeEventListener('keydown', this.handleKeyEvent, false);
  },

  updateSKs:function(actions){
    this.app.createSks(actions);
  },

  handleKeyEvent: function(e) {
    var scrollContainer = self.element.querySelector('.event-view-scrollable');
    var warningDialog = document.querySelector('gaia-confirm');
    if (warningDialog && e.key !== 'MicrophoneToggle') {
      e.preventDefault();
      return;
    }
    if (e.key === 'BrowserBack' || e.key === 'Backspace') {
      e.preventDefault();
      let optionMenuItem = document.getElementById('option-menu');
      if (optionMenu && optionMenuItem &&
        optionMenuItem.classList.contains('visible')) {
        optionMenu.hide();
        self.updateSKs(viewEventOptionActions);
        NavigationMap.reset('event-view');
      } else if (window.location.pathname.match('/alarm-display/')) {
        window.close();
      } else if (window.location.pathname.match('/event/show/')) {
        that.cancel();
      }
    } else if (e.key === 'ArrowDown') {
      self.scrollByStep(scrollContainer,'down');
    } else if (e.key === 'ArrowUp') {
      self.scrollByStep(scrollContainer,'up');
    }
  },

  deleteEvent: function(e) {
    if (e) {
      e.preventDefault();
    }
    var self = this;
    var dialogConfig = {
      title: {id: 'confirmation', args: {}},
      body: {id: 'delete-event', args: {}},
      cancel: {
        name: 'Cancel',
        l10nId: 'cancel',
        priority: 1,
        callback: function() {
        }
      },
      confirm: {
        name: 'Delete',
        l10nId: 'delete',
        priority: 3,
        callback: function() {
          var fun_delete = function () {
            self.provider.deleteEvent(self.event.data, self.busytime, function(error) {
              Toaster.showToast({
                messageL10nId:
                  error ? 'event-sync-failure' : 'kai-event-deleted'
              });
              self.cancel();
            });
          };

          self.provider.eventCapabilities(self.event.data, function(error, capabilities) {
            if (error) {
              return console.log('delete fail,Error fetching event capabilities', self.event);
            }

            if (capabilities.canDelete) {
              fun_delete();
            }
          });
        }
      }
    };
    var dialog = new ConfirmDialogHelper(dialogConfig);
    dialog.show(document.getElementById('confirm-dialog-container'));
  },

  deleteRepeatEvent: function(method) {
    var selectedDay = self.app.timeController.selectedDay;
    var nowDateUtc = method === 'deleteEventFuture' ?
      selectedDay.valueOf() - selectedDay.getTimezoneOffset() * 60 * 1000 : 0;

    var fun_delete = () => {
      viewEventObj.provider[method](viewEventObj.event.data,
        viewEventObj.busytime, function(error) {
        Toaster.showToast({
          messageL10nId:
            error ? 'event-sync-failure' : 'kai-event-deleted'
        });
        that.cancel();
      }, nowDateUtc);
    };

    self.provider.eventCapabilities(self.event.data, (error, capabilities) => {
      if (error) {
        return console.log('delete fail,Error fetching event capabilities', self.event);
      }

      if (capabilities.canDelete) {
        fun_delete();
      }
    });
  },

  scrollByStep:function(el,dir){
    var s_height = el.scrollHeight;
    var c_height = el.clientHeight;
    var move_height = s_height-c_height;
    var s_top = el.scrollTop;
    var step_length =50;
    if(dir === "down"){
      if(s_top<move_height){
        if(s_top + step_length>=move_height){
           el.scrollTop =move_height;
        }else{
           el.scrollTop = s_top + step_length;
        }
      }
    }else if(dir === "up"){
      if(s_top - step_length>=0){
        el.scrollTop = s_top - step_length;
      }else{
        el.scrollTop = 0;
      }
    }
  }
};

});

define('templates/event_search',['require','exports','module','date_format','template'],function (require, exports, module) {
  var dateFormat = require('date_format');
  var create = require('template').create;

  module.exports = create({
    createEvent: function () {
      var l10n = navigator.mozL10n;
      var calendarId = this.arg('calendarId');
      var busytimeId = this.arg('busytimeId');
      var title = this.arg('title');
      var color = this.arg('color');
      var isShow = isAlarmEvent(this.arg('alarm'), color);
      var startTime = formatTime(this.arg('startTime'), this.arg('isAllDay'));
      var showtoast = this.arg('showtoast');

      return `<section class="focusable event calendar-id-${calendarId}"
             role="option" data-id="${busytimeId}" data-showtoast="${showtoast}"
             aria-describedby="${busytimeId}-icon-calendar-alarm" style="border-left-color: ${color}">
             <div class="container calendar-id-${calendarId}">
               <span class="event-title p-pri">${title}</span>
               ${isShow}
               ${startTime}
             </div>
           </section>`;
    }
  });

  function isAlarmEvent(alarm, color) {
    if(alarm && alarm.length) {
      return `<span class="icon-reminder" data-icon="reminder" style="color: ${color}"></span>`;
    } else {
      return '';
    }
  }

  function formatTime(time, isAllDay) {
    var l10n = navigator.mozL10n;
    var format = !isAllDay ?
      'longDateTimeNew' + (navigator.mozHour12 ? '12' : '24') :
      'longDateTimeNewNoHour' + (navigator.mozHour12 ? '12' : '24');
    var displayTime = dateFormat.localeFormat(time, l10n.get(format));
    return `<span class="event-start-datetime p-sec" data-l10n-date-format="${format}" data-date="${time}">${displayTime}</span>`;
  }
});

define('views/event_search',['require', 'exports', 'module', 'app', 'view', 'router', 'calc', 'templates/event_search', 'dom!event-search-view'], function (require, exports, module) {

  var template = require('templates/event_search');
  var app = require('app');
  var View = require('view');
  var router = require('router');
  var Calc = require('calc');
  require('dom!event-search-view');

  function EventSearch(options) {
    View.apply(this, arguments);
    this.delegate(this.resultListFiled, 'click', '.container', function (e, target) {
      router.go('/event/show/' + target.parentNode.dataset.id + '/');
    });
    this.goBack = this.goBack.bind(this);
    this.goSearch = this.goSearch.bind(this);
    this.createSKs = this.createSKs.bind(this);
  }

  EventSearch.prototype = {
    __proto__: View.prototype,
    self: null,
    eventListElements: null,
    goBackPath: '/month/',
    observe: null,
    selectors: {
      element: '#event-search-view',
      resultListFiled: '#event-search-result-list',
      inputField: '#event-search-input',
      resultCaptionField: '#event-search-result-header',
      noMessageFiled: '#event-search-no-message',
      inputContainer: '#search-input-container'
    },

    get inputContainer() {
      return this._findElement('inputContainer');
    },

    get inputField() {
      return this._findElement('inputField');
    },

    get resultCaptionField() {
      return this._findElement('resultCaptionField');
    },

    get resultListFiled() {
      return this._findElement('resultListFiled');
    },

    get noMessageFiled() {
      return this._findElement('noMessageFiled');
    },

    onactive: function () {
      View.prototype.onactive.apply(this, arguments);
      window.addEventListener('input', this);
      window.addEventListener('keydown', this, false);
      window.addEventListener('index-changed', this);
      this.inputContainer.addEventListener('focus', this);
      self = this;
      this.createSKs();
      this._loadDB();
    },

    oninactive: function () {
      View.prototype.oninactive.apply(this, arguments);
      window.removeEventListener('input', this);
      window.removeEventListener('keydown', this, false);
      window.removeEventListener('index-changed', this);
      this.inputContainer.removeEventListener('focus', this);
      this.stopObserve();
      this.clearState();
    },

    goSearch: function () {
      if (this.eventListElements.childNodes.length === 0) {
        return;
      }

      this.resultListFiled.innerHTML = '';
      var fragment = document.createDocumentFragment();
      for (var i = 0, len = this.eventListElements.childNodes.length; i < len; i++) {
        var clon = this.eventListElements.childNodes[i].cloneNode(true);
        fragment.appendChild(clon);
      }
      this.resultListFiled.appendChild(fragment);

      var inputText = this.inputField.value.trim();
      var l10n = navigator.mozL10n;
      if (inputText.length === 0) {
        this.resultCaptionField.textContent = l10n.get('upcoming-events');
        this._toggleNoMessage('init');
      } else {
        this.resultCaptionField.textContent = l10n.get('search-results');
        var inputItems = inputText.split(/\s+/);
        for (var i = 0, len = this.resultListFiled.childNodes.length; i < len; i++) {
          var eventItem = this.resultListFiled.childNodes[i];
          if (!eventItem) {
            continue;
          }
          var matchFlag = '';
          if (!(matchFlag = this.getMatchFlag(inputItems, this.findTextFromNode(eventItem)))) {
            this.resultListFiled.removeChild(eventItem);
            i -= 1;
          } else {
            this.clearHighlights(eventItem);
            this.setHighlightNode(eventItem, inputItems);
          }
        }
        this._toggleNoMessage('search');
      }
    },

    handleEvent: function (e) {
      switch (e.type) {
        case 'keydown':
          switch (e.key) {
            case 'Backspace':
            case 'BrowserBack':
              if (window.location.pathname === '/search/') {
                e.preventDefault();
                self.goBack();
              }
              break;
          }
          break;
        case 'input':
          self.goSearch();
          break;
        case 'index-changed':
          if (e.detail.panel === 'event-search-view') {
            var isShowCSK = true;
            if (e.detail.focusedItem.id === 'search-input-container') {
              document.getElementById('event-search-input').focus();
              isShowCSK = false;
            }
            self.createSKs(isShowCSK);
          }
          break;
        case 'focus':
          if (e.target && e.target.id === 'search-input-container') {
            self.inputField.focus();
          }
          break;
      }
    },

    getBackPath: function () {
      if (/^\/(day|month|week|show-multi-events)/.test(router.last.path)) {
        this.goBackPath = router.last.path;
      }
    },

    goBack: function () {
      router.go(this.goBackPath);
    },

    initObserve: function () {
      var eventPage = document.querySelector("#event-search-result-list");
      if (!this.observe) {
        this.observe = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            if (mutation.type == "childList" && mutation.addedNodes.length > 0) {
              NavigationMap.navSetup("event-search-view", ".focusable");
            }
          });
        });
      }
      this.observe.observe(eventPage, { subtree: true, childList: true });
    },

    stopObserve: function () {
      this.observe.disconnect();
    },

    clearState: function () {
      this.inputField.value = '';
      this.eventListElements = null;
      this.resultListFiled.innerHTML = '';
      this.resultCaptionField.textContent = navigator.mozL10n.get('upcoming-events');
    },

    findTextFromNode: function (node) {
      let title = node.querySelector('.event-title') ?
        node.querySelector('.event-title').textContent : '';
      return [title];
    },

    getMatchFlag: function (inputItems, text) {
      for (var j = 0; j < text.length; j++) {
        for (var i = 0, m = inputItems.length; i < m; i++) {
          var newItem = inputItems[i].replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
          if (RegExp(newItem, 'ig').test(text[j])) {
            return String(j);
          }
        }
      }
      return false;
    },

    fillEventList: function () {
      this.eventListElements = document.createElement('div');
      for (var i = 0; i < this.resultListFiled.childNodes.length; i++) {
        var clon = this.resultListFiled.childNodes[i].cloneNode(true);
        this.eventListElements.appendChild(clon);
      }
    },

    _toggleNoMessage: function (s) {
      var children = this.resultListFiled.children;
      var l10n =  navigator.mozL10n;
      switch (s) {
        case 'init':
          this.noMessageFiled.innerHTML = l10n.get('no-events');
          break;
        case 'search':
          this.noMessageFiled.innerHTML = l10n.get('no-event-found');
          break;
        default:
          break;
      }
      this.noMessageFiled.classList.toggle(
        'active', !children || children.length === 0
        );
    },

    clearHighlights: function (node) {
      var els = node.querySelectorAll(".highlight");
      while (els.length) {
        var parent = els[0].parentNode;
        while (els[0].firstChild) {
          parent.insertBefore(els[0].firstChild, els[0]);
        }
        parent.removeChild(els[0]);
      }
    },

    getEventItem: function (event, busytime) {
      let remote = {
        alarms: [event.remote.alarms[0]],
        description: event.remote.description,
        end: busytime.end,
        endDate: busytime.endDate,
        id: event.remote.id,
        isAllDay: event.remote.isAllDay,
        isRecurring: event.remote.isRecurring,
        location: event.remote.location,
        preset: event.remote.preset,
        recurrenceId: event.remote.recurrenceId,
        repeat: event.remote.repeat,
        start: busytime.start,
        startDate: busytime.startDate,
        title: event.remote.title,
      };

      let eventItem = {
        _id: event._id,
        calendarId: event.calendarId,
        id: busytime._id,
        endUtc: event.endUtc,
        remote: remote
      };

      return eventItem;
    },

    _loadDB: function () {
      this.getBackPath();
      this.initObserve();

      if (!self) {
        self = this;
      }

      var eventList = [];
      var dbTrans = app.store('Event').db.transaction(['events', 'busytimes', 'alarms']);
      var dbEventStore = dbTrans.objectStore('events');
      var dbEventIndex = dbEventStore.index('calendarId');
      var reqAllEvents = dbEventIndex.mozGetAll();
      reqAllEvents.onsuccess = function (e) {
        var now = Date.now();
        eventList = e.target.result;
        eventList = eventList.filter(function (elem) {
          return (((elem.remote.start.utc - elem.remote.start.offset) > now) &&
            ((elem.remote.start.utc - elem.remote.start.offset) <=
            now + 7 * 24 * Calc.HOUR)) || (elem.remote.repeat !== 'never');
        });

        var busytimeList = [];
        var dbBusytimesStore = dbTrans.objectStore('busytimes');
        var busytimeIndex = dbBusytimesStore.index('eventId');
        var reqAllBusytime = busytimeIndex.mozGetAll();
        reqAllBusytime.onsuccess = function (e) {
          var now = Date.now();
          var eventItems = [];
          busytimeList = e.target.result;
          busytimeList = busytimeList.filter(function (elem) {
            return ((elem.start.utc - elem.start.offset) > now) &&
                ((elem.start.utc - elem.start.offset) <= now + 7 * 24 * Calc.HOUR);
          });
          for (var i = 0; i < eventList.length; i++) {
            for (var j = 0; j < busytimeList.length; j++) {
              if (eventList[i]._id == busytimeList[j].eventId) {
                eventList[i].id = busytimeList[j]._id;
                if (!eventList[i].remote.startDate) {
                  eventList[i].remote.startDate = busytimeList[j].startDate;
                }
                if (eventList[i].remote.repeat !== 'never') {
                  eventItems.push(
                    self.getEventItem(eventList[i], busytimeList[j]));
                } else {
                  eventItems.push(eventList[i]);
                }
              }
            }
          }

          eventItems.sort(function (o1, o2) {
            return o1.remote.title.toUpperCase().localeCompare(o2.remote.title.toUpperCase());           
          });
          eventItems.sort(function (o1, o2) {
            return o1.remote.start.utc - o2.remote.start.utc;
          });

          if (!self.resultListFiled.hasChildNodes()) {
            self.renderEventList(eventItems);
            self._toggleNoMessage('init');
            self.fillEventList();
          }
        };
      };
    },

    setHighlightNode: function (node, items) {
      var titleField = node.querySelector('.event-title');

      var regSource = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g;
      var regTarget = '\\$&';

      var displayedText = titleField.textContent;
      items.forEach(function (item) {
        var hRegEx = new RegExp(item.replace(regSource, regTarget), 'gi');
        var newItems = [],
          newItem;

        var result = hRegEx.exec(displayedText);
        while (result) {
          newItem = displayedText.substr(result.index, item.length);
          newItem = newItem.replace(regSource, regTarget).toLowerCase();
          newItems.push(newItem);
          result = hRegEx.exec(displayedText);
        }

        newItems = newItems.filter(function (elem, pos) {
          return newItems.indexOf(elem) === pos;
        });

        newItems.forEach(function (item) {
          titleField.innerHTML = titleField.textContent.replace(
            new RegExp('(' + item + ')', 'i'),
            '<span class="highlight">$1</span>');
        });
      });
    },

    renderEventList: function (eventList) {
      var eventListContainer = document.createElement('div');
      for (var i = 0; i < eventList.length; i++) {
        var eventHtml = template.createEvent.render({
          busytimeId: eventList[i].id,
          calendarId: eventList[i].calendarId,
          title: eventList[i].remote.title,
          startTime: eventList[i].remote.startDate,
          alarm: eventList[i].remote.alarms,
          color: this.app.store('Calendar').getColorByCalendarId(eventList[i].calendarId)
        });
        eventListContainer.insertAdjacentHTML('beforeend', eventHtml);
      }
      var d = document.createDocumentFragment();
      for (var i = 0; i < eventListContainer.childNodes.length; i++) {
        var clon = eventListContainer.childNodes[i].cloneNode(true);
        d.appendChild(clon);
      }
      this.resultListFiled.appendChild(d);
    },

    createSKs: function(isShowCSK) {
      var skBack = {
        name: 'Back',
        l10nId: 'back',
        priority: 1,
        method: function() {
          if (window.location.pathname === '/search/') {
            self.goBack();
          }
        }
      };
      var skDefaultCSK = {
        name: 'select',
        l10nId: 'select',
        priority: 2,
        method: function() {}
      };
      var params = [skBack];
      if(isShowCSK) {
        params.push(skDefaultCSK);
      }
      this.app.createSks(params);
    }
  };

  module.exports = EventSearch;
});

define('views/multi_events',['require','exports','module','calc','view','app','router','day_observer','timespan','date_format','provider/caldav','provider/local','templates/event_search','provider/provider_factory','querystring','dom!multi-events-view'],function(require, exports, module) {


var Calc = require('calc');
var View = require('view');
var app = require('app');
var router = require('router');
var dayObserver = require('day_observer');
var Timespan = require('timespan');
var dateFormat = require('date_format');
var CaldavProvider = require('provider/caldav');
var Local = require('provider/local');
var isAllDayCalc = Calc.isAllDay;
var template = require('templates/event_search');
var providerFactory = require('provider/provider_factory');
var dateFromId = Calc.dateFromId;

var QueryString = require('querystring');

require('dom!multi-events-view');

var optionMenu = null;

function MultiEvents(options) {
  View.apply(this, arguments);
  this._initEvents();
}
module.exports = MultiEvents;

MultiEvents.prototype = {
  __proto__: View.prototype,

  eventsArray: [],

  backPath: '/day/',

  inCurrentPage: false,

  selectors: {
    element: '#multi-events-view',
    eventlist: '#multi-event-list'
  },

  get eventlist() {
    return this._findElement('eventlist');
  },

  //some attribute may need to save for using
  self: null,
  that: null,
  baseDate: null,
  hour: null,
  isAllDay: null,

  _initEvents: function() {
    this.showWarningDialog = this.showWarningDialog.bind(this);
    this._findAssociatedEvents = this._findAssociatedEvents.bind(this);
    this.delegate(this.eventlist, 'click', '.container', function(e, target) {
      var _ = navigator.mozL10n.get;
      var textContent =
        target.querySelector('.event-start-datetime').textContent;
      if (textContent === _('event-is-deleting')) {
        return;
      }
      router.show('/event/show/' + target.parentNode.dataset.id + '/');
    });
  },

  _init: function() {
    this._setBackPath();
    this._createMenu();
    this.initShownEvents();
  },

  _updateDeletingEvent: function(details) {
    if (!details.delete) {
      return;
    }

    var exist = false;
    var _ = navigator.mozL10n.get;
    var id = details._id;
    var eventList = document.querySelectorAll('#multi-event-list section');

    for (var i = 0; i < eventList.length; i++) {
      if (eventList[i].dataset.id === id) {
        eventList[i].querySelector('.event-start-datetime').textContent =
        _('event-is-deleting');
        break;
      }
    }
  },

  _findAssociatedEvents: function(records) {
    if(window.location.pathname != "/show-multi-events/") {
      return;
    }
    this.eventsArray = [];

    records.allday.sort(sortbyTitle);
    records.basic.sort(sortbyTitle);
    records.basic.sort(sortbyTime);

    if (self.backPath === '/day/' || self.backPath === '/week/') {
      if (this.isAllDay) {
        this.eventsArray = records.allday;
      } else {
        records.basic.forEach(this.queryEvents,this);
      }
    } else {
      records.basic.forEach(this.queryEvents,this);
      records.allday.forEach(this.queryEvents,this);
    }
    this.updateUI();

    function sortbyTitle(o1, o2) {
      return o1.event.remote.title.toUpperCase().localeCompare(o2.event.remote.title.toUpperCase());
    }
    function sortbyTime(o1, o2) {
      return o1.busytime.startDate.getTime() - o2.busytime.startDate.getTime();
    }
  },

  updateUI: function() {
    this.eventlist.innerHTML='';
    this._initMultiEvents(this.eventsArray, this.isAllDay);
    if(this.eventsArray.length != 0) {
      if(this.inCurrentPage) {
        setTimeout(() => {
          NavigationMap.reset('multi-events-view');
        }, 0);
      }
    }else {
      this.cancel();
    }
  },

  queryEvents: function(record) {
    var hour = Number(this.hour);
    var startHour = record.busytime.startDate.getHours();
    var endHour = record.busytime.endDate.getHours();
    var minute = record.busytime.endDate.getMinutes();

    if (self.backPath === '/day/' || self.backPath === '/week/') {
      if( (startHour >= hour && endHour <= (hour+1))
        || (startHour <= hour && endHour >= hour && endHour < (hour+1) && minute != 0)
        || (startHour >= hour && startHour < (hour+1) && endHour >= (hour+1) )
        || (startHour < hour && endHour > (hour+1))){
        this.eventsArray.push(record);
      }
    } else if (self.backPath === '/month/') {
      this.eventsArray.push(record);
    }

  },

  _calcRecurrentDate: function(data) {
    let item = document.querySelector('#time-views .selected');
    let currentDate = dateFromId(item.dataset.date);
    let nowDate = new Date(currentDate.valueOf() + 86400000);
    let date = new Date(data.start.utc);
    let offset = nowDate.setUTCHours(0, 0, 0, 0).valueOf() -
      date.setUTCHours(0, 0, 0, 0).valueOf();

    return new Date(data.startDate.valueOf() + offset);
  },

  _initMultiEvents: function(eventList, isAllDay) {
    let account = this.app.store('Account');

    account.all((err, list) => {
      var eventListContainer = document.createElement('div');
      for (var i = 0; i < eventList.length; i++) {
        let eventRemote = eventList[i].event.remote;
        let showtoast = false;
        for (let key in list) {
          if (key === eventList[i].event.calendarId.toString() &&
            list[key].preset !== 'caldav' && list[key].preset !== 'local' &&
            !list[key].syncFlag) {
            showtoast = true;
            break;
          }
        }
        var eventHtml = template.createEvent.render({
          busytimeId: eventList[i].busytime._id,
          calendarId: eventList[i].event.calendarId,
          title: eventList[i].event.remote.title,
          startTime: eventRemote.isRecurring ?
            eventList[i].busytime.startDate : eventRemote.startDate,
          alarm: eventList[i].event.remote.alarms,
          color: eventList[i].color,
          isAllDay: eventList[i].event.remote.isAllDay,
          showtoast: showtoast
        });

        eventListContainer.insertAdjacentHTML('beforeend', eventHtml);
      }
      var d = document.createDocumentFragment();
      for (var i = 0; i < eventListContainer.childNodes.length; i++) {
        var clon = eventListContainer.childNodes[i].cloneNode(true);
        d.appendChild(clon);
      }
      this.eventlist.appendChild(d);
    });
  },

  initShownEvents: function() {
    if ('date' in window.history.state) {
      this.baseDate = window.history.state.date;
    }
    if ('hour' in window.history.state) {
      this.hour = window.history.state.hour;
    }
    if ('isAllDay' in window.history.state) {
      this.isAllDay = window.history.state.isAllDay;
    }
    dayObserver.on(this.baseDate, this._findAssociatedEvents);
  },

  handleBackKey: function(e) {
    var warningDialog = document.querySelector('gaia-confirm');
    if (warningDialog && e.key !== 'MicrophoneToggle') {
      e.preventDefault();
      return;
    }
    if (router.app.getSkPanel().menuVisible) {
      return;
    }

    var _ = navigator.mozL10n.get;

    if (window.location.pathname === '/show-multi-events/') {
      switch(e.key) {
        case 'Backspace':
        case 'BrowserBack':
          e.preventDefault();
          let optionMenuItem = document.getElementById('option-menu');
          if (optionMenu && optionMenuItem &&
            optionMenuItem.classList.contains('visible')) {
            optionMenu.hide();
            self._createMenu();
            NavigationMap.reset('multi-events-view');
          } else if (router.app.deleteDialogShown) {
            self.app.deleteDialogShown = false;
          } else {
            self.cancel();
          }
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          var selectedId = NavigationMap.getCurItem();
          var textContent =
            selectedId.querySelector('.event-start-datetime').textContent;
          if (textContent === _('event-is-deleting')) {
            self.app.hideSkPanel();
          } else {
            self.app.createSks();
          }
          break;
      }
    }
  },

  _setBackPath: function() {
    if (/^\/(day|month|week)/.test(router.last.path)) {
      this.backPath = router.last.path;
    }else if(/^\/(advanced-settings|search|settings|event\/edit|event\/show)/.test(router.last.path)){
        NavigationMap.setMultiResetValue(true);
    }
  },

  deleteOptionMenu: function() {
    var _ = navigator.mozL10n.get;
    var chooserItem = {
      name: 'Select',
      l10nId: 'select',
      priority: 2
    };

    let params = {
      classes: ['group-menu', 'softkey'],
      header: _('options') || '',
      items: [],
      menuClassName: 'menu-button'
    };

    params.items.push({
      name: _('event-delete-all'),
      method: () => {
        self.deleteRepeatEvent('deleteEvent');
      }
    });

    params.items.push({
      name: _('event-delete-all-future'),
      method: () => {
        self.deleteRepeatEvent('deleteEventFuture');
      }
    });

    optionMenu = new OptionMenu(params);
    optionMenu.show().then(() => {
      let menu = document.getElementById('mainmenu');
      let header = optionMenu.form.querySelector('h1');
      header.setAttribute('style', 'bottom:' + menu.offsetHeight + 'px');
    });

    secondCall = false;
    NavigationMap.reset_options();
    self.app.createSks([chooserItem]);
  },

  showAccoutSwitchToast: function() {
    let focusItem = document.querySelector('#multi-event-list .focus');
    let ret = false;

    if ('true' === focusItem.dataset.showtoast) {
      Toaster.showToast({
        messageL10nId: 'account-sync-off-tip',
      });
      ret = true;
    }

    return ret;
  },

  _createMenu: function() {
    var params = [{
        name: "Delete",
        l10nId: 'delete',
        priority: 1,
        method: function() {
          if (self.showAccoutSwitchToast()) {
            return;
          }
          var selectedId = NavigationMap.getCurItem().getAttribute('data-id');
          dayObserver.findAssociated(selectedId).then(value => {
            if (value.event.remote.isRecurring) {
              self.deleteOptionMenu();
            } else {
              var selectedId =  NavigationMap.getCurItem().getAttribute('data-id');
              var isLocalCalendar = selectedId.indexOf(Local.calendarId) !== -1;

              self.showWarningDialog(isLocalCalendar, 'delete').then((value) => {
                if (!value) {
                  self.deleteEvent();
                }
              });
            }
          })
        }
      }, {
        name: 'select',
        l10nId: 'select',
        priority: 2,
        method: function() {}
      }, {
        name: "Edit",
        l10nId: 'edit',
        priority: 3,
        method: function() {
          if (self.showAccoutSwitchToast()) {
            return;
          }

          var selectedId =  NavigationMap.getCurItem().getAttribute('data-id');
          var isLocalCalendar = selectedId.indexOf(Local.calendarId) !== -1;

          self.showWarningDialog(isLocalCalendar, 'edit').then((value) => {
            if (!value) {
              router.go('/event/edit/' + selectedId + '/');
            }
          });
        }
      }
    ];
    new Promise(function(resolve){
      var id = NavigationMap.getCurItem().getAttribute('data-id');
      if(id) {
        self.app.store('Event').get(id.slice(0,-37), function(err, event) {
          if(!err) {
            var provider = new CaldavProvider({ app: self.app });
            provider.eventCapabilities(event, function(err, data) {
              if (!data.canUpdate) {
                params = self.stripItem(params, 'Edit');
              }
              if (!data.canDelete) {
                params = self.stripItem(params, 'Delete');
              }
              resolve(params);
            });
          } else {
            resolve(params);
          }
        });
      } else {
        resolve(params);
      }
    }).then(function(results){
      var _ = navigator.mozL10n.get;
      var selectedId = NavigationMap.getCurItem();
      var textContent =
        selectedId.querySelector('.event-start-datetime').textContent;
      if (textContent === _('event-is-deleting')) {
        self.app.hideSkPanel();
      } else {
        self.app.createSks(results);
      }
    });
  },

  _reset: function() {
    this.eventlist.innerHTML='';
  },

  handleEvent: function(e) {
    switch(e.type) {
      case 'index-changed':
        var containerid = e.detail.panel;
        if(containerid == 'multi-events-view') {
          that._createMenu();
        }
        break;
    }
  },

  onactive: function() {
    View.prototype.onactive.apply(this, arguments);
    self = this;
    that = this;
    window.addEventListener('keydown', this.handleBackKey,false);
    window.addEventListener('index-changed', this);
    this._init();
    this.inCurrentPage = true;
  },

  oninactive: function() {
    View.prototype.oninactive.apply(this, arguments);
    this._reset();
    window.removeEventListener('keydown', this.handleBackKey,false);
    window.removeEventListener('index-changed', this);
    dayObserver.off(this.baseDate, this._findAssociatedEvents);
    this.inCurrentPage = false;
    NavigationMap.setMultiResetValue(false);
  },

  cancel: function() {
    if(this.backPath === '/day/') {
        var state = {
            eventStartHour: window.history.state.hour
        };
        router.go(this.backPath,state);
    }else{
        router.go(this.backPath);
    }
  },

  deleteRepeatEvent: function(method) {
    var selectedId = NavigationMap.getCurItem().getAttribute('data-id');
    var nowDateUtc = method === 'deleteEventFuture' ?
      self.app.timeController.selectedDay.valueOf() : 0;

    dayObserver.findAssociated(selectedId).then(value => {
      self.app.store('Event').ownersOf(value.event, function(err, owners) {
        let isLocalCalendar = value.event.calendarId === Local.calendarId;
        self.showWarningDialog(isLocalCalendar, 'delete', () => {
          self._createMenu();
        }).then((ret) => {
          if (!ret) {
            let provider = providerFactory.get(owners.account.providerType);
            provider.eventCapabilities(value.event, function(err, data) {
              if (err) {
                console.log('delete fail,Error fetching event capabilities');
                return;
              }
              if (data.canDelete) {
                provider[method](value.event, value.busytime, function(error) {
                  Toaster.showToast({
                    messageL10nId:
                      error ? 'event-sync-failure' : 'kai-event-deleted'
                  });
                }, nowDateUtc);
              }
            });
          } else {
            NavigationMap.getCurItem().classList.add('focus');
          }
        });
      });
    });
  },

  deleteEvent: function() {
    var self = this;
    var _ = navigator.mozL10n.get;
    var currentId = NavigationMap.getCurItem();
    var selectedId = NavigationMap.getCurItem().getAttribute('data-id');

    var dialogConfig = {
      title: {id: 'confirmation', args: {}},
      body: {id: 'delete-event', args: {}},
      cancel: {
        name: 'Cancel',
        l10nId: 'cancel',
        priority: 1,
        callback: function() {
        }
      },
      confirm: {
        name: 'Delete',
        l10nId: 'delete',
        priority: 3,
        callback: function() {
          dayObserver.findAssociated(selectedId).then(value => {
            self.app.store('Event').ownersOf(value.event, function(err, owners) {
              var provider = providerFactory.get(owners.account.providerType);
              provider.eventCapabilities(value.event, function(err, data) {
                if (err) {
                  return console.log('delete fail,Error fetching event capabilities');
                }
                if (data.canDelete) {
                  provider.deleteEvent(value.event, value.busytime, function(error) {
                    Toaster.showToast({
                      messageL10nId:
                        error ? 'event-sync-failure' : 'kai-event-deleted'
                    });
                  });
                }
              });
            });
          });

          self.app.deleteDialogShown = false;
        }
      }
    };
    var dialog = new ConfirmDialogHelper(dialogConfig);
    dialog.show(document.getElementById('confirm-dialog-container'));
  }
};

});

define('views/switchto_date',['require','exports','module','view','dom!switchto-date-view'],function(require, exports, module) {
  var router = require('router');
  var App = require('app');
  var Math_Calc = require('calc');
  var View = require('view');
  var singleMonthView = require('./single_month');
  require('dom!switchto-date-view');

  var skGo = {
    name: 'select',
    l10nId: 'select',
    priority: 2,
    method: function() {
      console.log('Go click');
      SwitchtoDate.prototype._switchtoDate();
    }
  };
  var goActions = [skGo];
  const INPUT_TIMEOUT = 1000;

  function SwitchtoDate(options) {
    View.apply(this, arguments);
  }

  SwitchtoDate.prototype = {
    __proto__: View.prototype,
    self:null,
    SELECTEDCLASS: 'focus',
    single_view: null,
    _selectedDay: null,
    hasActived: false,
    preDay: -1,
    preMonth: -1,
    preYear: -1,
    preFocusElementId: null,
    inputTimer: null,
    nextInput: false,
    _currentItem: null,
    selectors: {
      element:'#switchto-date-view',
      selectedDay:'li.selected',
      switchtoYearUp:'#switchto-year-up',
      switchtoYearDown:'#switchto-year-down',
      switchtoMonthUp:'#switchto-month-up',
      switchtoMonthDown:'#switchto-month-down',
      switchtoDayUp:'#switchto-day-up',
      switchtoDayDown:'#switchto-day-down',
      switchto_inuptYear:'#input-switchto-year',
      switchto_inputMonth:'#input-switchto-month',
      switchto_inputDay:'#input-switchto-day',
      switchtoMonthView:'#view-switchto-month'
    },

    _getMonthNumber: function(str) {
      var months = [];
      for (var i = 0; i < 12; i++) {
        var monthStr = navigator.mozL10n.get('month-' + i + '-short');
        if (str === monthStr) {
          return i;
        }
      }
      return -1;
    },

    _updateElement: function() {
      // update input value
      var year = self._selectedDay.getFullYear();
      self.switchto_inuptYear.textContent = year;
      self.switchto_inuptYear.setAttribute('aria-valuenow', year);
      var month = self._toFormatStr(self._selectedDay);
      self.switchto_inputMonth.textContent = month;
      self.switchto_inputMonth.setAttribute('aria-valuenow', month);
      var day = self._selectedDay.getDate();
      self.switchto_inputDay.textContent = day;
      self.switchto_inputDay.setAttribute('aria-valuenow', day);

      if(self.single_view != null) {
        self.single_view.destroy();
        self.single_view = null;
      }
      self.single_view = new singleMonthView({ app: App, date: self._selectedDay, container: this.switchtoMonthView });
      self.single_view.create();
      self.single_view.append();
      self.single_view.activate();
      self.single_view._onSelectedDayChange(self._selectedDay);
    },

    cancel: function() {
      router.go(this.backPath);
    },

    _toFormatStr: function(date) {
      return navigator.mozL10n.get('month-' + date.getMonth() + '-short');
    },

    _getCurrentMonthTotalDay: function(year, month) {
      var dateTime = new Date(year, month + 1, 0);
      return dateTime.getDate();
    },

    onactive: function() {
      View.prototype.onactive.apply(this, arguments);
      console.log("[switchto-date]onactive ");
      self = this;
      self.hasActived = true;
      self._getBackPath();
      window.addEventListener('keydown', self.handleKeyEvent, false);
      self._selectedDay = self.app.timeController._selectedDay;
      self._updateElement();
      self.updateSKs(goActions);
    },

    _clearSelectedDay: function() {
      var day = this.switchtoMonthView.querySelector(this.selectors.selectedDay);

      if (day) {
        day.classList.remove(this.SELECTEDCLASS);
      }
    },

    _clearPreDate: function() {
      self.preDay = -1;
      self.preMonth = -1;
      self.preYear = -1;
      self.nextInput = false;
      clearTimeout(self.inputTimer);
      self.inputTimer = null;
      self._updateElement();
    },

    _setInputTimer: function() {
      clearTimeout(self.inputTimer);
      self.inputTimer = null;
      self.nextInput = true;
      self.inputTimer = setTimeout(function(){
        self._clearPreDate();
      }, INPUT_TIMEOUT);
    },

    handleKeyEvent: function(e) {
      if (window.location.pathname !== '/switchto-date/') {
        return;
      }
      console.log(e.key);
      switch(e.key) {
        case 'Backspace':
        case 'BrowserBack':
          e.preventDefault();
          router.go(self.backPath);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          self._updateDate(e.key);
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          self._clearPreDate();
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          var input = parseInt(e.key);
          var el = document.querySelector('.switchto-input-container .focus .switchto-input-datetime');
          var this_year = self._selectedDay.getFullYear();
          var this_month = self._selectedDay.getMonth();
          var this_day = self._selectedDay.getDate();
          var curValue = -1;

          if(!self.inputTimer) {
            self._setInputTimer();
          }

          switch(el.id) {
            case 'input-switchto-day':
              if(self.nextInput && self.preDay > 0) {
                curValue = self.preDay * 10 + input;
                var totalDays = self._getCurrentMonthTotalDay(this_year, this_month, 0);
                if(curValue > totalDays) {
                  curValue = totalDays;
                }
              } else {
                curValue = input;
                if(curValue == 0) {
                  curValue = 1;
                  self._clearPreDate();
                } else {
                  self.preDay = curValue;
                }
              }
              this_day = curValue;
              self._selectedDay = new Date(this_year, this_month, this_day);
              self._updateElement();
              break;
            case 'input-switchto-month':
              if(self.nextInput && self.preMonth > 0) {
                curValue = self.preMonth * 10 + input;
                if(curValue > 12) {
                  curValue = 12;
                }
              } else {
                curValue = input;
                if(curValue == 0) {
                  curValue = 1;
                  self._clearPreDate();
                } else {
                  self.preMonth = curValue;
                }
              }
              this_month = curValue - 1;
              var totalDays = self._getCurrentMonthTotalDay(this_year, this_month, 0);
              if(this_day > totalDays) {
                this_day = totalDays;
              }
              self._selectedDay = new Date(this_year, this_month, this_day);
              self._updateElement();
              break;
            case 'input-switchto-year':
              if(self.nextInput && self.preYear > 0) {
                curValue = self.preYear * 10 + input;
                if(curValue > 9999) {
                  curValue = 9999;
                } else {
                  self._setInputTimer();
                }
              } else {
                curValue = input;
              }
              self.preYear = curValue;
              if(curValue > 99) {
                this_year = curValue;
                self._selectedDay = new Date(this_year, this_month, this_day);
                self._updateElement();
              }
              self.switchto_inuptYear.textContent = curValue;
              break;
          }
          break;
      }
    },

    _switchtoDate: function() {
      console.log("[switchto date]");
      if(self.hasActived) {
        var input_day = this.switchto_inputDay.textContent;
        var input_year = this.switchto_inuptYear.textContent;
        var input_month = this._getMonthNumber(this.switchto_inputMonth.textContent);
        var newDate = new Date(input_year, input_month, input_day);
        App.timeController.selectedDay = newDate;
        router.go(self.backPath);
      }
    },

    _getBackPath: function() {
      var regex = /^\/(day|month|week|show-multi-events)/;
      if (regex.test(router.last.path)) {
        this.backPath = router.last.path;
      }
    },

    _updateDate: function(key) {
      var dirStr = key === 'ArrowUp' ? 'up' : 'down';
      var focusItemId = document.querySelector('.switchto-input-container .focus .switchto-input-datetime').id;
      var f_Id = focusItemId+"-"+dirStr;
      var this_year = self._selectedDay.getFullYear();
      var this_month = self._selectedDay.getMonth();
      var this_day = self._selectedDay.getDate();

      switch(f_Id) {
        case "input-switchto-year-up":
          this_year -= 1;
          break;
        case "input-switchto-month-up":
          //judge the month if it small 0
          this_month -= 1;
          if(this_month < 0) {
            this_month = 0;
          }
          break;
        case "input-switchto-day-up":
          this_day -= 1;
          //judge the day if it small 1
          if(this_day < 1) {
            this_day = 1;
          }
          break;
        case "input-switchto-year-down":
          this_year += 1;
          break;
        case "input-switchto-month-down":
          this_month += 1;
          //judge the month if it large 11
          if(this_month > 11) {
            this_month = 11;
          }
          break;
        case "input-switchto-day-down":
          this_day += 1;
          break;
      }

      var totalDays = self._getCurrentMonthTotalDay(this_year, this_month, 0);
      if(this_day > totalDays) {
        this_day = totalDays;
      }

      self._selectedDay = new Date(this_year, this_month, this_day);
      self._updateElement();
    },

    oninactive: function() {
      console.log("[switchto-date]oninactive");
      View.prototype.oninactive.apply(this, arguments);
      window.removeEventListener('keydown', this.handleKeyEvent, false);
      this.hasActived = false;
      if(this.single_view != null) {
        this.single_view.destroy();
        this.single_view = null;
      }
    },

    updateSKs:function(actions){
      App.createSks(actions);
    },

    get switchtoYearUp() {
      return this._findElement('switchtoYearUp');
    },

    get switchtoYearDown() {
      return this._findElement('switchtoYearDown');
    },

    get switchtoMonthUp() {
      return this._findElement('switchtoMonthUp');
    },

    get switchtoMonthDown() {
      return this._findElement('switchtoMonthDown');
    },

    get switchtoDayUp() {
      return this._findElement('switchtoDayUp');
    },

    get switchtoDayDown() {
      return this._findElement('switchtoDayDown');
    },

    get switchto_inputMonth() {
      return this._findElement('switchto_inputMonth');
    },

    get switchto_inputDay() {
      return this._findElement('switchto_inputDay');
    },

    get switchtoMonthView() {
      return this._findElement('switchtoMonthView');
    },

    get switchto_inuptYear() {
      return this._findElement('switchto_inuptYear');
    },
  };
  module.exports = SwitchtoDate;
});

define('views/lunar_day',['require','exports','module','view','app','performance','router','dom!lunar-day-view'],function (require, exports, module) {
    
var View = require('view');
var App = require('app');
var performance = require('performance');
var router = require('router');
require('dom!lunar-day-view');
function LunarDay() {
  View.apply(this, arguments);
 }

var lunarInfo = new Array(
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260,
    0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255,
    0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40,
    0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0,
    0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4,
    0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0,
    0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570,
    0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4,
    0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a,
    0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50,
    0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552,
    0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9,
    0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60,
    0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0,
    0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577,
    0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0);
var Gan = new Array("甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸");
var Zhi = new Array("子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥");
var Animals = new Array("鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪");
// TODO is it need to do
var sTermInfo = new Array(0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693, 263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758);
var nStr1 = new Array('日', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十');
var nStr2 = new Array('初', '十', '廿', '卅', '□');
    // var monthName = new Array("JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC");
var cmonthName = new Array('正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '腊');

//公历节日 *表示放假日
var sFtv = new Array(
    "0101*元旦",
    "0214 情人节",
    "0308 妇女节",
    "0312 植树节",
    "0401 愚人节",
    "0422 地球日",
    "0501 劳动节",
    "0504 青年节",
    "0531 无烟日",
    "0601 儿童节",
    "0606 爱眼日",
    "0701 建党日",
    "0707 抗战纪念日",
    "0801 建军节",
    "0910 教师节",
    "0918 九·一八事变纪念日",
    "1001*国庆节",
    "1031 万圣节",
    "1111 光棍节",
    "1201 艾滋病日",
    "1213 南京大屠杀纪念日",
    "1224 平安夜",
    "1225 圣诞节");

    //某月的第几个星期几。 5,6,7,8 表示到数第 1,2,3,4 个星期几
var wFtv = new Array(
     //一月的最后一个星期日（月倒数第一个星期日）
    "0520 母亲节",
    "0630 父亲节",
    "1144 感恩节");

    //农历节日
var lFtv = new Array(
    "0101*春节",
    "0115 元宵节",
    "0202 龙抬头",
    "0505 端午节",
    "0707 七夕",
    "0715 中元节",
    "0815 中秋节",
    "0909 重阳节",
    "1208 腊八节",
    "1223 小年",
    "0100*除夕");
var solarTerm = new Array("小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明",
     "谷雨", "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑", "白露", "秋分",
     "寒露", "霜降", "立冬", "小雪", "大雪", "冬至");
var solarTermBase = new Array(4, 19, 3, 18, 4, 19, 4, 19, 4, 20, 4, 20, 6, 22, 6, 22, 6, 22, 7, 22, 6, 21, 6, 21);
var solarTermIdx = '0123415341536789:;<9:=<>:=1>?012@015@015@015AB78CDE8CD=1FD01GH01GH01IH01IJ0KLMN;LMBEOPDQRST0RUH0RVH0RWH0RWM0XYMNZ[MB\\]PT^_ST`_WH`_WH`_WM`_WM`aYMbc[Mde]Sfe]gfh_gih_Wih_WjhaWjka[jkl[jmn]ope]qph_qrh_sth_W';
var solarTermOS = '211122112122112121222211221122122222212222222221222122222232222222222222222233223232223232222222322222112122112121222211222122222222222222222222322222112122112121222111211122122222212221222221221122122222222222222222222223222232222232222222222222112122112121122111211122122122212221222221221122122222222222222221211122112122212221222211222122222232222232222222222222112122112121111111222222112121112121111111222222111121112121111111211122112122112121122111222212111121111121111111111122112122112121122111211122112122212221222221222211111121111121111111222111111121111111111111111122112121112121111111222111111111111111111111111122111121112121111111221122122222212221222221222111011111111111111111111122111121111121111111211122112122112121122211221111011111101111111111111112111121111121111111211122112122112221222211221111011111101111111110111111111121111111111111111122112121112121122111111011111121111111111111111011111111112111111111111011111111111111111111221111011111101110111110111011011111111111111111221111011011101110111110111011011111101111111111211111001011101110111110110011011111101111111111211111001011001010111110110011011111101111111110211111001011001010111100110011011011101110111110211111001011001010011100110011001011101110111110211111001010001010011000100011001011001010111110111111001010001010011000111111111111111111111111100011001011001010111100111111001010001010000000111111000010000010000000100011001011001010011100110011001011001110111110100011001010001010011000110011001011001010111110111100000010000000000000000011001010001010011000111100000000000000000000000011001010001010000000111000000000000000000000000011001010000010000000';
var cYear, cLunarYear, cLunarMonth, cLunarDay, cIsLeap;
var lunar_year, lunar_mouth, lunar_day = {};

LunarDay.prototype = {
    __proto__: View.prototype,
    self: null,
    selectors: {
        element: '#lunar-day-view',
        selectedDay: 'li.selected',
        lunarText: '#lunar_id',
        },
onactive: function () {
    View.prototype.onactive.apply(this, arguments);
    self = this;
    self.hasActived = true;
    self._selectedDay = self.app.timeController._selectedDay;
    self._createSks();
    var dayDate = self._selectedDay;
    var day = dayDate.getFullYear() + "年" + (dayDate.getMonth() + 1) + "月" + dayDate.getDate() + "日";
    self.solar2lunar(self._selectedDay);
    document.getElementById('day-date').textContent = day;
    document.getElementById('day-week').textContent = "星期" + nStr1[dayDate.getDay()];
    document.getElementById('lunar-year').textContent = cYear + " " + self.getAnimalYear(lunar_year) + "年";
    document.getElementById('lunar-date').textContent = (cIsLeap ? "闰 " : "" ) + cmonthName[lunar_mouth - 1] + "月 " + self.getCDay(lunar_day);
},
_createSks: function () {
     var skBack = {
         name: 'Back',
         l10nId: 'back',
         priority: 3,
         method: function () {
             if (window.location.pathname === '/lunar-day/') {
                 router.go('/month/');
             }
         }
     };
    var params = [skBack];
    this.app.createSks(params);
},
lYearDays: function (y) {
    var i, sum = 348
    for (i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0
    return (sum + self.leapDays(y));
},
//====================================== 返回农历 y年的闰月的天数
leapDays: function (y) {
    if (self.leapMonth(y)) {
        return ((lunarInfo[y - 1900] & 0x10000) ? 30 : 29);
    }
    else {
        return (0);
    }
},
//====================================== 返回农历 y年闰哪个月 1-12，没闰返回 0
leapMonth: function (y) {
    return (lunarInfo[y - 1900] & 0xf);
},
//====================================== 返回农历 y年m月的总天数
monthDays: function (y, m) {
    return ( (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29 );
},
//====================================== 算出农历，传入日期对象，返回农历日期日期对象
// 该对象属性有 .year .month .day .isLeap .yearCyl .dayCyl .monCyl
Lunar: function (date) {
    var objDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var i, leap = 0, temp = 0;
    var baseDate = new Date(1900, 0, 31);
    // Mac和linux平台的firefox在此处会产生浮点数错误
    var offset = Math.round((objDate - baseDate) / 86400000);

    this.dayCyl = offset + 40;
    this.monCyl = 14;

    for (i = 1900; i < 2050 && offset > 0; i++) {
        temp = self.lYearDays(i)
        offset -= temp;
        this.monCyl += 12;
    }

    if (offset < 0) {
        offset += temp;
        i--;
        this.monCyl -= 12;
    }

    lunar_year = i;
    this.yearCyl = i - 1864;

    leap = self.leapMonth(i); //闰哪个月
    this.isLeap = false;

    for (i = 1; i < 13 && offset > 0; i++) {
        //闰月
        if (leap > 0 && i == (leap + 1) && self.isLeap == false) {
            --i;
            self.isLeap = true;
            temp = self.leapDays(lunar_year);
        }
        else {
            temp = self.monthDays(lunar_year, i);
        }

        //解除闰月
        if (self.isLeap == true && i == (leap + 1)) self.isLeap = false
                offset -= temp
                if (self.isLeap == false) this.monCyl++
            }

        if (offset == 0 && leap > 0 && i == leap + 1)
            if (self.isLeap) {
                self.isLeap = false;
            }
            else {
                self.isLeap = true;
                --i;
                --this.monCyl;
            }

            if (offset < 0) {
                offset += temp;
                --i;
                --this.monCyl;
            }

            lunar_mouth = i;
            lunar_day = offset + 1;
            cIsLeap = self.isLeap;

},

isLeap: function (year) {
    return year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
},
//============================== 传入 offset 返回干支, 0=甲子
cyclical: function (num) {
    return (Gan[num % 10] + Zhi[num % 12]);
},
getAnimalYear: function (year) {
    return Animals[((year - 1900) % 12)];
},
//====================== 中文日期
getCDay: function (d) {
    var s;

    switch (d) {
        case 10:
            s = '初十';
            break;
        case 20:
            s = '二十';
            break;
            break;
        case 30:
            s = '三十';
            break;
            break;
        default :
            s = nStr2[Math.floor(d / 10)];
            s += nStr1[d % 10];
    }
    return (s);
},
// 形式如function sTerm(year, n)，用来计算某年的第n个节气（从0小寒算起）为几号，这也基本被认可为节气计算的基本形式。由于没个月份有两个节气，计算时需要调用两次（n和n+1）
//===== 某年的第n个节气为几日（从0小寒起算）
sTerm: function (y, n) {
    return (solarTermBase[n] + Math.floor(solarTermOS.charAt(( Math.floor(solarTermIdx.charCodeAt(y - 1900)) - 48) * 24 + n)) );
},
addFstv: function (sYear, sMonth, sDay, weekDay, lunarYear, lunarMonth, lunarDay, isLeap) {
    var cMonth, cDay = {};
    ////////年柱 1900年立春后为庚子年(60进制36)
    if (sMonth < 2) {
        cYear = self.cyclical(sYear - 1900 + 36 - 1);
    } else {
        cYear = self.cyclical(sYear - 1900 + 36);
    }
    var term2 = self.sTerm(sYear, 2); //立春日期

    ////////月柱 1900年1月小寒以前为 丙子月(60进制12)
    var firstNode = self.sTerm(sYear, sMonth * 2);//返回当月「节」为几日开始
    cMonth = self.cyclical((sYear - 1900) * 12 + sMonth + 12);

    //依节气调整二月分的年柱, 以立春为界
    if (sMonth == 1 && sDay >= term2) {
        cYear = self.cyclical(sYear - 1900 + 36);
    }
    //依节气月柱, 以「节」为界
    if (sDay >= firstNode) {
        cMonth = self.cyclical((sYear - 1900) * 12 + sMonth + 13);
    }
    //当月一日与 1900/1/1 相差天数
    //1900/1/1与 1970/1/1 相差25567日, 1900/1/1 日柱为甲戌日(60进制10)
    var dayCyclical = Date.UTC(sYear, sMonth, 1, 0, 0, 0, 0) / 86400000 + 25567 + 10;
    //日柱
    cDay = self.cyclical(dayCyclical + sDay - 1);

    // 节气
    tmp1 = self.sTerm(sYear, sMonth * 2) - 1;
    tmp2 = self.sTerm(sYear, sMonth * 2 + 1) - 1;
    var solarTerms;
    if (tmp1 == (sDay - 1)) {
        solarTerms = solarTerm[sMonth * 2];
    }
    if (tmp2 == (sDay - 1)) {
        solarTerms = solarTerm[sMonth * 2 + 1];
    }
    var solarFestival;

            //公历节日
    for (var i = 0, item; item = sFtv[i]; i++) {
        if (item.match(/^(\d{2})(\d{2})([\s\*])(.+)$/)) {
            if (Number(RegExp.$1) == (sMonth + 1)) {
                if (Number(RegExp.$2) == sDay) {
                    solarFestival += RegExp.$4 + ' ';
                }
            }
        }
    }

    //月周节日
    for (i = 0, item; item = wFtv[i]; i++) {
        if (item.match(/^(\d{2})(\d)(\d)([\s\*])(.+)$/)) {
            if (Number(RegExp.$1) == (sMonth + 1)) {
                tmp1 = Number(RegExp.$2);
                tmp2 = Number(RegExp.$3);
                if (tmp1 < 5) {
                    var wFtvDate = (tmp2 == 0 ? 7 : 0) + (tmp1 - 1) * 7 + tmp2;
                    if (wFtvDate == sDay) {
                        solarFestival += RegExp.$5 + ' ';
                        break;
                    }
                }
            }
        }
    }
    var lunarFestival;
    // 农历节日
    for (i = 0, item; item = lFtv[i]; i++) {
        if (item.match(/^(\d{2})(.{2})([\s\*])(.+)$/)) {
            tmp1 = Number(RegExp.$1);
            tmp2 = Number(RegExp.$2);
            lMonLen = self.monthDays(lunarYear, lunarMonth);
            // 月份是12月，且为最后一天，则设置为春节
            if ((tmp1 == lunarMonth && tmp2 == lunarDay) || (tmp2 == '00' && lunarMonth == 12 && lMonLen == lunarDay)) {
                lunarFestival += RegExp.$4 + ' ';
                break;
            }
        }
    }
},
solar2lunar: function (date) {
    var sYear = date.getFullYear(),
        sMonth = date.getMonth(),
        sDay = date.getDate(),
        weekDay = nStr1[date.getDay()],
        lunar = self.Lunar(date),
        lunarYear = lunar_year,
        lunarMonth = lunar_mouth,
        lunarDay = lunar_day,
        isLeap = self.isLeap;
    self.addFstv(sYear, sMonth, sDay, weekDay, lunarYear, lunarMonth, lunarDay, isLeap);
},

oninactive: function () {
    View.prototype.oninactive.apply(this, arguments);
    window.removeEventListener('keydown', this.handleBackKey, false);
}
};
module.exports = LunarDay;
});

define("lazy_loaded", function(){});
