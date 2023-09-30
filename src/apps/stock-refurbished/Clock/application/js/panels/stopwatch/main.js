
define('stopwatch',[],function() {

  

  var priv = new WeakMap();

  function Defaults() {
    this.startTime = 0;
    this.totalElapsed = 0;
    this.state = Stopwatch.RESET;
    this.laps = [];
  }

  /**
   * Stopwatch
   *
   * Create new or revive existing stopwatch objects.
   *
   * @param {Object} opts Optional stopwatch object to create or revive
   *                      a new or existing stopwatch object.
   *                 - startTime, number time in ms.
   *                 - totalElapsed, number time in ms.
   *                 - isStarted, started state boolean.
   *                 - laps, array of lap objects (lap = {time:, duration:}).
   */
  function Stopwatch(opts = {}) {
    var defaults = new Defaults();
    var obj = {};

    obj.startTime = opts.startTime || defaults.startTime;
    obj.totalElapsed = opts.totalElapsed || defaults.totalElapsed;
    obj.state = opts.state || defaults.state;
    obj.laps = opts.laps ? opts.laps.slice() : defaults.laps;

    priv.set(this, obj);
  }

  Stopwatch.RUNNING = 'RUNNING';
  Stopwatch.PAUSED = 'PAUSED';
  Stopwatch.RESET = 'RESET';

  Stopwatch.prototype = {

    constructor: Stopwatch,

    getState: function() {
      var sw = priv.get(this);
      return sw.state;
    },

    setState: function(state) {
      var sw = priv.get(this);
      sw.state = state;
      OptionHelper.show('stopwatch-' + state.toLowerCase());
    },

    /**
    * start Starts the stopwatch, either from a reset or paused state
    */
    start: function sw_start() {
      var sw = priv.get(this);
      if (sw.state === Stopwatch.RUNNING) {
        return;
      }
      var now = Date.now() - sw.totalElapsed;
      sw.startTime = now;
      this.setState(Stopwatch.RUNNING);
    },

    /**
    * getElapsedTime Calculates the total elapsed duration since the
    *                stopwatch was started
    * @return {Number} return total elapsed duration.
    */
    getElapsedTime: function sw_getElapsedTime() {
      var sw = priv.get(this);
      var elapsed = 0;
      if (sw.state === Stopwatch.RUNNING) {
        elapsed = Date.now() - sw.startTime;
      } else {
        elapsed = sw.totalElapsed;
      }
      return elapsed;
    },

    /**
    * pause Pauses the stopwatch
    */
    pause: function sw_pause() {
      var sw = priv.get(this);
      if (sw.state === Stopwatch.PAUSED) {
        return;
      }
      sw.totalElapsed = Date.now() - sw.startTime;
      this.setState(Stopwatch.PAUSED);
    },

    /**
    * nextLap Calculates the duration of the next lap.
    * @return {object} return an object containing:
    *         duration - the duration of this lap in ms.
    *         time - the start time of this lap in ms from epoch.
    */
    nextLap: function sw_nextLap() {
      var sw = priv.get(this);
      var now;
      if (sw.state === Stopwatch.RUNNING) {
        now = Date.now();
      } else {
        now = sw.startTime + sw.totalElapsed;
      }

      var lastLapTime;
      var newLap = {};

      if (sw.laps.length > 0) {
        lastLapTime = sw.laps[sw.laps.length - 1].time;
      } else {
        lastLapTime = 0;
      }

      newLap.duration = now - (sw.startTime + lastLapTime);
      newLap.time = now - sw.startTime;

      return newLap;
    },

    /**
    * lap Calculates a new lap duration since the last lap time,
    *     and mutates `priv[this].laps` to contain the new value.
    *     If the stopwatch isn't currently running, returns 0.
    * @return {number} return the lap duration in ms.
    */
    lap: function sw_lap() {
      var sw = priv.get(this);
      if (sw.state !== Stopwatch.RUNNING) {
        return 0;
      }
      var nl = this.nextLap();
      sw.laps.push(nl);
      return nl;
    },

    /**
    * getLaps Returns an array of laps, sorted by oldest first
    * @return {Array} return an array of laps.
    */
    getLaps: function sw_getLaps() {
      var sw = priv.get(this);
      return sw.laps.map(function(lap) {
        return lap;
      });
    },

    /**
    * reset Resets the stopwatch back to 0, clears laps
    */
    reset: function sw_reset() {
      OptionHelper.show('stopwatch-reset');
      priv.set(this, new Defaults());
    },

    /**
    * toSerializable Returns a serializable object for persisting Stopwatch data
    * @return {Object} A serializable object.
    */
    toSerializable: function sw_toSerializable() {
      var sw = priv.get(this);
      var obj = {};
      for (var i in sw) {
        if (sw.hasOwnProperty(i)) {
          obj[i] = Array.isArray(sw[i]) ? sw[i].slice() : sw[i];
        }
      }
      return obj;
    }

  };

  return Stopwatch;
});

/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
(function(exports) {
  

  var priv = new WeakMap();
  var rmatcher = /\$\{([^}]+)\}/g;
  var rentity = /[&<>"']/g;
  var rentities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&apos;'
  };

  function extract(node) {
    var nodeId;
    // Received an ID string? Find the appropriate node to continue
    if (typeof node === 'string') {
      nodeId = node;
      node = document.getElementById(node);
    } else if (node) {
      nodeId = node.id;
    }

    if (!node) {
      console.error(
        'Can not find the node passed to Template', nodeId
      );
      return '';
    }

    // No firstChild means no comment node.
    if (!node.firstChild) {
      console.error(
        'Node passed to Template should have a comment node', nodeId
      );
      return '';
    }

    // Starting with the container node's firstChild...
    node = node.firstChild;

    do {
      // Check if it's the comment node that we're looking for...
      if (node.nodeType === Node.COMMENT_NODE) {
        return (node.nodeValue || '').trim();
      }
      // If the current child of the container node isn't
      // a comment node, it's likely a text node, so hop to
      // the nextSibling and repeat the operation.
    } while ((node = node.nextSibling));

    console.error(
      'Nodes passed to Template should have a comment node', nodeId
    );
    return '';
  }


  /**
   * Template
   *
   * Initialize a template instance from a string or node
   *
   * @param {String} idOrNode id string of existing node.
   *        {Object} idOrNode existing node.
   *
   */
  function Template(idOrNode) {
    if (!(this instanceof Template)) {
      return new Template(idOrNode);
    }
    // Storing the extracted template string as a private
    // instance property prevents direct access to the
    // template once it's been initialized.
    priv.set(this, {
      idOrNode: idOrNode
    });
  }

  Template.prototype.extract = function() {
    var members = priv.get(this);
    if (!members.tmpl) {
      members.tmpl = extract(members.idOrNode);
      delete members.idOrNode;
    }
    return members.tmpl;
  };

  /**
   * template.toString()
   *
   * Safe, read-only access to the template string
   *
   */
  Template.prototype.toString = function() {
    // Return a copy of the stored template string.
    return this.extract().slice();
  };

  /**
   * template.interpolate
   *
   * Interpolate template string with values provided by
   * data object. Optionally allow properties to retain
   * HTML that is known to be safe.
   *
   * @param {Object} data     properties correspond to substitution.
   *                          - identifiers in template string.
   * @param {Object} options  optional.
   *                          - safe, a list of properties that contain
   *                          HTML that is known and are
   *                          "known" to ignore.
   */
  Template.prototype.interpolate = function(data, options) {
    // This _should_ be rewritten to use Firefox's support for ES6
    // default parameters:
    // ... = function(data, options = { safe: [] }) {
    //
    options = options || {};
    options.safe = options.safe || [];

    return this.extract().replace(rmatcher, function(match, property) {
      property = property.trim();
      // options.safe is an array of properties that can be ignored
      // by the "suspicious" html strategy.
      return options.safe.indexOf(property) === -1 ?
        // Any field that is not explicitly listed as "safe" is
        // to be treated as suspicious
        Template.escape(data[property]) :
        // Otherwise, return the string of rendered markup
        data[property];
    });
  };

  /**
   * Prepares object that can provide either interpolated template string with
   * values provided by data object or ready DocumentFragment. Optionally allows
   * properties to retain HTML that is known to be safe.
   *
   * @param {Object} data Properties correspond to substitution i.e. identifiers
   * in the template string.
   * @param {Object} options Optional options object. Currently supported only
   * "safe" option - a list of properties that contain HTML that is known to be
   * safe and don't need to be additionally escaped.
   * @return {{ toString: function, toDocumentFragment: function }}
   */
  Template.prototype.prepare = function(data, options) {
    var self = this;

    return {
      toString: function t_toString() {
        return self.interpolate(data, options);
      },

      toDocumentFragment: function t_toDocumentFragment() {
        var template = document.createElement('template');
        template.innerHTML = this.toString();
        return template.content.cloneNode(true);
      }
    };
  };

  Template.escape = function escape(str) {
    if (typeof str !== 'string') {
      return '';
    }
    return str.replace(rentity, function(s) {
      return rentities[s];
    });
  };

  exports.Template = Template;

}(this));

define("shared/js/template", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.Template;
    };
}(this)));

define('template',['require','shared/js/template'],function(require) {

var Template = require('shared/js/template');

function ClockTemplate(text) {
  var srcNode = document.createElement('div');
  var comment = document.createComment(text);
  srcNode.appendChild(comment);
  return new Template(srcNode);
}

return ClockTemplate;
});

define('text!panels/stopwatch/panel.html',[],function () { return '<div class="stopwatch-time-wrapper">\n  <div class="stopwatch-time" tabindex="0"></div>\n  <div id="stopwatch-time-label">\n    <label class="stopwatch-min p-sec" data-l10n-id="minute"></label>\n    <label class="stopwatch-sec p-sec" data-l10n-id="second"></label>\n  </div>\n</div>\n<menu id="stopwatch-controls">\n  <button class="p-btn stopwatch-start edit-button" data-l10n-id="start">Start</button>\n  <button class="p-btn stopwatch-pause edit-button recommend" data-l10n-id="pause">Pause</button>\n  <button class="p-btn stopwatch-resume edit-button" data-l10n-id="resume">Resume</button>\n  <button class="p-btn stopwatch-reset edit-button danger" data-l10n-id="reset">Reset</button>\n  <button class="p-btn stopwatch-lap edit-button" data-l10n-id="lap">Lap</button>\n</menu>\n<div class="stopwatch-lap-list">\n  <!-- list of exisiting alarms, to be populated -->\n  <ul class="stopwatch-laps" role="menu" tabindex="1"></ul>\n</div>\n';});

define('text!panels/stopwatch/list_item.html',[],function () { return '<div class="lap-name p-pri">\n</div>\n<div class="lap-duration">\n  ${time}\n</div>\n';});

define('panels/stopwatch/main',['require','panel','stopwatch','utils','template','l10n','text!panels/stopwatch/panel.html','text!panels/stopwatch/list_item.html'],function(require) {
  

  var Panel = require('panel');
  var Stopwatch = require('stopwatch');
  var Utils = require('utils');
  var Template = require('template');
  var mozL10n = require('l10n');
  var html = require('text!panels/stopwatch/panel.html');
  var lapHtml = require('text!panels/stopwatch/list_item.html');
  var priv = new WeakMap();

  // This value is chosen such that the only reason you'll hit it is
  // because you're super bored, and small enough that phones won't
  // puke when displaying this many rows in the lap list.
  var MAX_STOPWATCH_LAPS = 99;

  /**
   * Stopwatch.Panel
   *
   * Construct a UI panel for the Stopwatch panel.
   *
   * @return {Stopwatch.Panel} Stopwatch.Panel object.
   *
   */
  Stopwatch.Panel = function(element) {
    Panel.apply(this, arguments);

    this.nodes = {};
    this.panel = {};
    this.lapTemplate = Template(lapHtml);
    this.interval = null;
    this.screenWakeLock = null;

    // Store maxLaps as a dataset attribute for easy access in tests.
    this.element.dataset.maxLaps = MAX_STOPWATCH_LAPS;
    this.element.innerHTML = html;
    // Gather elements
    [
      'start', 'pause', 'resume',
      'lap', 'reset', 'time',
      'lap-list', 'laps'
    ].forEach(function(sel) {
      this.nodes[sel] = this.element.querySelector('.stopwatch-' + sel);
    }, this);

    [
      'time-label'
    ].forEach(function(id) {
      this.panel[id] = document.getElementById('stopwatch-' + id);
    }, this);

    // Bind click events
    [
      'start', 'pause', 'resume', 'lap', 'reset'
    ].forEach(function(action) {
      var e = this.nodes[action];

      if (priv.has(e)) {
        priv.delete(e);
      }

      priv.set(e, {
        action: action == 'resume' ? 'start' : action
      });

      e.addEventListener('click', this);
    }, this);

    element.addEventListener(
      'panel-visibilitychange', this.onvisibilitychange.bind(this));

    this.setStopwatch(new Stopwatch());

  };

  Stopwatch.Panel.prototype = Object.create(Panel.prototype);


  Stopwatch.Panel.prototype.update = function() {
    var swp = priv.get(this);
    var e = swp.stopwatch.getElapsedTime();
    var time = Utils.format.durationMs(e);
    this.nodes.time.textContent = time;
    this.nodes.time.classList.toggle('over-100-minutes', e >= 1000 * 60 * 100);
    this.activeLap(false);
  };

  Stopwatch.Panel.prototype.showButtons = function() {
    Array.prototype.forEach.call(arguments, function(a) {
      this.nodes[a].classList.remove('hidden');
    }, this);
  };

  Stopwatch.Panel.prototype.hideButtons = function() {
    Array.prototype.forEach.call(arguments, function(a) {
      this.nodes[a].classList.add('hidden');
    }, this);
  };

  Stopwatch.Panel.prototype.setState = function(state) {
    switch (state) {
      case Stopwatch.RUNNING:
        this.onstart();
        break;

      case Stopwatch.PAUSED:
        this.onpause();
        break;

      case Stopwatch.RESET:
        this.onreset();
        break;
    }
    OptionHelper.show('stopwatch-' + state.toLowerCase());
    this.update();
  };

  Stopwatch.Panel.prototype.setStopwatch = function(stopwatch) {
    priv.set(this, {
      stopwatch: stopwatch
    });

    this.setState(stopwatch.getState());

    //Clear any existing lap indicators and make new ones
    var lapsUl = this.nodes.laps;
    lapsUl.textContent = '';
    var laps = stopwatch.getLaps();
    for (var i = 0; i < laps.length; i++) {
      this.onlap(laps[i]);
    }
    this.checkLapButton();
  };

  Stopwatch.Panel.prototype.onvisibilitychange = function(evt) {
    var stopwatch = priv.get(this).stopwatch;
    if (evt.detail.isVisible) {
      this.setState(stopwatch.getState());
    }
    if (this.screenWakeLock) {
      this.screenWakeLock.unlock();
      this.screenWakeLock = null;
    }
  };

  Stopwatch.Panel.prototype.checkLapButton = function() {
    var swp = priv.get(this);
    var maxLaps = parseInt(this.element.dataset.maxLaps, 10);
    // As the Stopwatch doesn't include the current "lap", we must
    // subtract one from maxLaps when deciding whether or not we can
    // add a lap. Using these calculations, if maxLaps is 10, the last
    // lap visible in the UI will be "Lap 10". Additionally, this
    // button can only be shown if the "pause" button is also visible,
    // as it must respect the state of the other buttons.
    var canAddLaps = (swp.stopwatch.getLaps().length < maxLaps - 1) &&
          !this.nodes.pause.classList.contains('hidden');
    this.nodes.lap.classList.toggle('hidden', !canAddLaps);
  };

  Stopwatch.Panel.prototype.handleEvent = function(event) {
    if (event.type == 'animationend') {
      Panel.prototype.handleEvent.apply(this, arguments);
      return;
    }

    var swp = priv.get(this);
    var button = priv.get(event.target);
    var nodeLaps = this.nodes.laps;

    if (button.action === 'lap' && nodeLaps.childElementCount > MAX_STOPWATCH_LAPS) {
      Utils.showToast('laps-maximum');
      return;
    }

    if (swp.stopwatch && swp.stopwatch[button.action]) {
      var elActiveLap = null;
      try {
        // call action on stopwatch
        var action = button.action;
        var val = swp.stopwatch[action]();

        // call panel handler
        switch (action) {
          case 'lap':
          case 'start': //replaces 'resume' for 'Resume' button
            var nodeLapFocused = nodeLaps.querySelector('li.lap-cell.focus');

            this['on' + action](val);

            if (nodeLapFocused !== null) {
              elActiveLap = nodeLaps.querySelectorAll('li.lap-cell')[0];
              nodeLaps.scrollTop = 0;
            }
            break;

          default:
            this['on' + action](val);
            break;
        }
      } catch (err) {
        throw err;
      }
      NavigationManager.switchContext('.lap-cell', elActiveLap);
    }
  };

  Stopwatch.Panel.prototype.onstart = function() {
    var tickfn = (function() {
      this.update();
      this.tick = requestAnimationFrame(tickfn);
    }).bind(this);
    tickfn();
    this.showButtons('pause', 'lap');
    this.hideButtons('start', 'resume', 'reset');
    this.screenWakeLock = navigator.requestWakeLock('screen');
  };

  Stopwatch.Panel.prototype.onpause = function() {
    cancelAnimationFrame(this.tick);
    this.update();
    this.nodes.reset.removeAttribute('disabled');
    this.showButtons('resume', 'reset');
    this.hideButtons('pause', 'start', 'lap');
    if (this.screenWakeLock) {
      this.screenWakeLock.unlock();
      this.screenWakeLock = null;
    }
  };

  Stopwatch.Panel.prototype.onresume = function() {
    this.onstart();
  };

  function createLapDom(num, time) {
    /* jshint validthis:true */
    var li = document.createElement('li');
    li.setAttribute('class', 'lap-cell');
    li.setAttribute('role', 'menuitem');
    li.setAttribute('tabindex', 1);
    var html = this.lapTemplate.interpolate({
      time: Utils.format.durationMs(time)
    });
    li.innerHTML = html;
    mozL10n.setAttributes(
      li.querySelector('.lap-name'),
      'lap-number',
      { n: num }
    );
    return li;
  }

  function updateLapDom(num, time, li) {
    li.querySelector('.lap-duration').textContent =
      Utils.format.durationMs(time);
    mozL10n.setAttributes(
      li.querySelector('.lap-name'),
      'lap-number',
      { n: num }
    );
    return li;
  }

  Stopwatch.Panel.prototype.activeLap = function(force) {
    var stopwatch = priv.get(this).stopwatch;
    var num = stopwatch.getLaps().length + 1;
    if (num === 1 && !force) {
      return;
    }
    var node = this.nodes.laps;
    var lapnodes = node.querySelectorAll('li.lap-cell');
    var time = stopwatch.nextLap().duration;
    if (lapnodes.length === 0) {
      node.appendChild(createLapDom.call(this, num, time));
    } else {
      updateLapDom.call(this, num, time, lapnodes[0]);
    }
  };

  Stopwatch.Panel.prototype.onlap = function(val) {
    var stopwatch = priv.get(this).stopwatch;
    var node = this.nodes.laps;
    var laps = stopwatch.getLaps();
    var num = laps.length;
    this.activeLap(true);
    var li = createLapDom.call(this, num, val ? val.duration : 0);
    if (laps.length > 1) {
      var lapnodes = node.querySelectorAll('li.lap-cell');
      node.insertBefore(li, lapnodes[1]);
    } else {
      node.appendChild(li);
      this.nodes.time.classList.add('lap');
      this.nodes['lap-list'].classList.add('lap');
      this.panel['time-label'].classList.add('lap');
    }
  };

  Stopwatch.Panel.prototype.onreset = function() {
    cancelAnimationFrame(this.tick);
    this.showButtons('start', 'reset');
    this.hideButtons('pause', 'resume', 'lap');
    this.nodes.reset.setAttribute('disabled', 'true');
    // clear lap list
    this.nodes.laps.textContent = '';
    this.update();
    this.nodes.time.classList.remove('lap');
    this.nodes['lap-list'].classList.remove('lap');
    this.panel['time-label'].classList.remove('lap');
  };

  return Stopwatch.Panel;
});
