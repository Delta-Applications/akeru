
requirejs.config({
  // waitSeconds is set to the default here; the build step rewrites
  // it to 0 in build/require_config.jslike so that we never timeout
  // waiting for modules in production. This is important when the
  // device is under super-low-memory stress, as it may take a while
  // for the device to get around to loading things like Clock's alarm
  // ringing screen, and we absolutely do not want that to time out.
  waitSeconds: 0,
  paths: {
    shared: '../shared'
  },
  shim: {
    'shared/js/template': {
      exports: 'Template'
    },
    'shared/js/gesture_detector': {
      exports: 'GestureDetector'
    },
    'shared/js/async_storage': {
      exports: 'asyncStorage'
    },
    'shared/js/accessibility_helper': {
      exports: 'AccessibilityHelper'
    },
    'shared/js/l10n_date': ['shared/js/l10n']
  }
});

define("require_config", function(){});



(function(exports) {

  var AccessibilityHelper = {
    /**
     * For a set of tab elements, set aria-selected attribute in accordance with
     * the current selection.
     * @param {Object} selectedTab a tab to select object.
     * @param {Array} tabs an array of tabs.
     */
    setAriaSelected: function ah_setAriaSelected(selectedTab, tabs) {
      // In case tabs is a NodeList, that does not have forEach.
      Array.prototype.forEach.call(tabs, function setAriaSelectedAttr(tab) {
        tab.setAttribute('aria-selected',
          tab === selectedTab ? 'true' : 'false');
      });
    }
  };

  exports.AccessibilityHelper = AccessibilityHelper;

})(window);

define("shared/js/accessibility_helper", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.AccessibilityHelper;
    };
}(this)));

define('tabs',['require','shared/js/accessibility_helper'],function(require) {


var AccessibilityHelper = require('shared/js/accessibility_helper');

/**
 * Abstraction for handling the Tabs links at the bottom of the UI.
 * @param {HTMLElement} element The containing element for the Tabs UI.
 */
function Tabs(element) {
  this.element = element;
  this.links = element.querySelectorAll('a');
  this.element.addEventListener('click', this);
}

/**
 * Update selected attributes for the selected tab.
 * Also emit a 'selected' event with the relevant data.
 */
Tabs.prototype.handleEvent = function tabsHandleEvent(event) {

  if (event.target.id === 'stopwatch-tab') {
    this.element.classList.remove('tab-left');
    this.element.classList.add('tab-right');
  } else if (event.target.id === 'alarm-tab') {
    this.element.classList.remove('tab-right');
    this.element.classList.add('tab-left');
  }
  AccessibilityHelper.setAriaSelected(event.target, this.links);
};


return Tabs;

});

define('view',['require'],function(require) {

var priv = new WeakMap();
var elementMap = new WeakMap();

/**
 * A View is simply a wrapper around an element.
 *
 * @constructor
 * @param {HTMLElement} element The element that will be wrapped by this view.
 */
function View(element) {
  if (!(this instanceof View)) {
    throw new Error('View must be called as a constructor');
  }
  elementMap.set(element, this);

  Object.defineProperties(this, {
    id: { value: element.id },
    element: { value: element }
  });

  priv.set(this, {
    visible: !element.classList.contains('hidden'),
    pendingVisible: false
  });
}

/**
 * Find or create a view instance for an element.
 *
 * @param {HTMLElement} element The element that will be wrapped by the view.
 * @param {Function} ctor The constructor method for the view, defaults to View.
 */
View.instance = function(element, ctor = View) {
  if (elementMap.has(element)) {
    return elementMap.get(element);
  }
  return new ctor(element);
};

Object.defineProperties(View.prototype, {
  /**
   * View.prototype.visible - set to true or false to toggle the "hidden" class
   * on the element.
   *
   * Also emits a 'visibilitychange' event passing either true or false to show
   * the new visible state.  The event happens before the class is changed to
   * allow time to modify the DOM before something becomes visible.
   */
  visible: {
    get: function() {
      return priv.get(this).visible;
    },
    set: function(value) {
      var state = priv.get(this);
      value = !!value;
      if (state.visible !== value || state.pendingVisible) {
        state.pendingVisible = false;
        state.visible = value;

        var event = new CustomEvent('panel-visibilitychange', {
          detail: {
            isVisible: value
          }
        });
        this.element.dispatchEvent(event);

        if (!value) {
          this.element.classList.add('hidden');
        } else {
          this.element.classList.remove('hidden');
        }
      }
      return value;
    }
  },

  pendingVisible: {
    get: function() {
      return priv.get(this).pendingVisible;
    },
    set: function(value) {
      return (priv.get(this).pendingVisible = !!value);
    }
  }
});

return View;

});

(function(window, undefined) {

  

  /* jshint validthis:true */
  function L10nError(message, id, loc) {
    this.name = 'L10nError';
    this.message = message;
    this.id = id;
    this.loc = loc;
  }
  L10nError.prototype = Object.create(Error.prototype);
  L10nError.prototype.constructor = L10nError;


  /* jshint browser:true */

  var io = {

    _load: function(type, url, callback, sync) {
      var xhr = new XMLHttpRequest();
      var needParse;

      if (xhr.overrideMimeType) {
        xhr.overrideMimeType(type);
      }

      xhr.open('GET', url, !sync);

      if (type === 'application/json') {
        //  Gecko 11.0+ forbids the use of the responseType attribute when
        //  performing sync requests (NS_ERROR_DOM_INVALID_ACCESS_ERR).
        //  We'll need to JSON.parse manually.
        if (sync) {
          needParse = true;
        } else {
          xhr.responseType = 'json';
        }
      }

      xhr.addEventListener('load', function io_onload(e) {
        if (e.target.status === 200 || e.target.status === 0) {
          // Sinon.JS's FakeXHR doesn't have the response property
          var res = e.target.response || e.target.responseText;
          callback(null, needParse ? JSON.parse(res) : res);
        } else {
          callback(new L10nError('Not found: ' + url));
        }
      });
      xhr.addEventListener('error', callback);
      xhr.addEventListener('timeout', callback);

      // the app: protocol throws on 404, see https://bugzil.la/827243
      try {
        xhr.send(null);
      } catch (e) {
        callback(new L10nError('Not found: ' + url));
      }
    },

    load: function(url, callback, sync) {
      return io._load('text/plain', url, callback, sync);
    },

    loadJSON: function(url, callback, sync) {
      return io._load('application/json', url, callback, sync);
    }

  };

  function EventEmitter() {}

  EventEmitter.prototype.emit = function ee_emit() {
    if (!this._listeners) {
      return;
    }

    var args = Array.prototype.slice.call(arguments);
    var type = args.shift();
    if (!this._listeners[type]) {
      return;
    }

    var typeListeners = this._listeners[type].slice();
    for (var i = 0; i < typeListeners.length; i++) {
      typeListeners[i].apply(this, args);
    }
  };

  EventEmitter.prototype.addEventListener = function ee_add(type, listener) {
    if (!this._listeners) {
      this._listeners = {};
    }
    if (!(type in this._listeners)) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(listener);
  };

  EventEmitter.prototype.removeEventListener = function ee_rm(type, listener) {
    if (!this._listeners) {
      return;
    }

    var typeListeners = this._listeners[type];
    var pos = typeListeners.indexOf(listener);
    if (pos === -1) {
      return;
    }

    typeListeners.splice(pos, 1);
  };


  function getPluralRule(lang) {
    var locales2rules = {
      'af': 3,
      'ak': 4,
      'am': 4,
      'ar': 1,
      'asa': 3,
      'az': 0,
      'be': 11,
      'bem': 3,
      'bez': 3,
      'bg': 3,
      'bh': 4,
      'bm': 0,
      'bn': 3,
      'bo': 0,
      'br': 20,
      'brx': 3,
      'bs': 11,
      'ca': 3,
      'cgg': 3,
      'chr': 3,
      'cs': 12,
      'cy': 17,
      'da': 3,
      'de': 3,
      'dv': 3,
      'dz': 0,
      'ee': 3,
      'el': 3,
      'en': 3,
      'eo': 3,
      'es': 3,
      'et': 3,
      'eu': 3,
      'fa': 0,
      'ff': 5,
      'fi': 3,
      'fil': 4,
      'fo': 3,
      'fr': 5,
      'fur': 3,
      'fy': 3,
      'ga': 8,
      'gd': 24,
      'gl': 3,
      'gsw': 3,
      'gu': 3,
      'guw': 4,
      'gv': 23,
      'ha': 3,
      'haw': 3,
      'he': 2,
      'hi': 4,
      'hr': 11,
      'hu': 0,
      'id': 0,
      'ig': 0,
      'ii': 0,
      'is': 3,
      'it': 3,
      'iu': 7,
      'ja': 0,
      'jmc': 3,
      'jv': 0,
      'ka': 0,
      'kab': 5,
      'kaj': 3,
      'kcg': 3,
      'kde': 0,
      'kea': 0,
      'kk': 3,
      'kl': 3,
      'km': 0,
      'kn': 0,
      'ko': 0,
      'ksb': 3,
      'ksh': 21,
      'ku': 3,
      'kw': 7,
      'lag': 18,
      'lb': 3,
      'lg': 3,
      'ln': 4,
      'lo': 0,
      'lt': 10,
      'lv': 6,
      'mas': 3,
      'mg': 4,
      'mk': 16,
      'ml': 3,
      'mn': 3,
      'mo': 9,
      'mr': 3,
      'ms': 0,
      'mt': 15,
      'my': 0,
      'nah': 3,
      'naq': 7,
      'nb': 3,
      'nd': 3,
      'ne': 3,
      'nl': 3,
      'nn': 3,
      'no': 3,
      'nr': 3,
      'nso': 4,
      'ny': 3,
      'nyn': 3,
      'om': 3,
      'or': 3,
      'pa': 3,
      'pap': 3,
      'pl': 13,
      'ps': 3,
      'pt': 3,
      'rm': 3,
      'ro': 9,
      'rof': 3,
      'ru': 11,
      'rwk': 3,
      'sah': 0,
      'saq': 3,
      'se': 7,
      'seh': 3,
      'ses': 0,
      'sg': 0,
      'sh': 11,
      'shi': 19,
      'sk': 12,
      'sl': 14,
      'sma': 7,
      'smi': 7,
      'smj': 7,
      'smn': 7,
      'sms': 7,
      'sn': 3,
      'so': 3,
      'sq': 3,
      'sr': 11,
      'ss': 3,
      'ssy': 3,
      'st': 3,
      'sv': 3,
      'sw': 3,
      'syr': 3,
      'ta': 3,
      'te': 3,
      'teo': 3,
      'th': 0,
      'ti': 4,
      'tig': 3,
      'tk': 3,
      'tl': 4,
      'tn': 3,
      'to': 0,
      'tr': 0,
      'ts': 3,
      'tzm': 22,
      'uk': 11,
      'ur': 3,
      've': 3,
      'vi': 0,
      'vun': 3,
      'wa': 4,
      'wae': 3,
      'wo': 0,
      'xh': 3,
      'xog': 3,
      'yo': 0,
      'zh': 0,
      'zu': 3
    };

    // utility functions for plural rules methods
    function isIn(n, list) {
      return list.indexOf(n) !== -1;
    }
    function isBetween(n, start, end) {
      return typeof n === typeof start && start <= n && n <= end;
    }

    // list of all plural rules methods:
    // map an integer to the plural form name to use
    var pluralRules = {
      '0': function() {
        return 'other';
      },
      '1': function(n) {
        if ((isBetween((n % 100), 3, 10))) {
          return 'few';
        }
        if (n === 0) {
          return 'zero';
        }
        if ((isBetween((n % 100), 11, 99))) {
          return 'many';
        }
        if (n === 2) {
          return 'two';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '2': function(n) {
        if (n !== 0 && (n % 10) === 0) {
          return 'many';
        }
        if (n === 2) {
          return 'two';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '3': function(n) {
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '4': function(n) {
        if ((isBetween(n, 0, 1))) {
          return 'one';
        }
        return 'other';
      },
      '5': function(n) {
        if ((isBetween(n, 0, 2)) && n !== 2) {
          return 'one';
        }
        return 'other';
      },
      '6': function(n) {
        if (n === 0) {
          return 'zero';
        }
        if ((n % 10) === 1 && (n % 100) !== 11) {
          return 'one';
        }
        return 'other';
      },
      '7': function(n) {
        if (n === 2) {
          return 'two';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '8': function(n) {
        if ((isBetween(n, 3, 6))) {
          return 'few';
        }
        if ((isBetween(n, 7, 10))) {
          return 'many';
        }
        if (n === 2) {
          return 'two';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '9': function(n) {
        if (n === 0 || n !== 1 && (isBetween((n % 100), 1, 19))) {
          return 'few';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '10': function(n) {
        if ((isBetween((n % 10), 2, 9)) && !(isBetween((n % 100), 11, 19))) {
          return 'few';
        }
        if ((n % 10) === 1 && !(isBetween((n % 100), 11, 19))) {
          return 'one';
        }
        return 'other';
      },
      '11': function(n) {
        if ((isBetween((n % 10), 2, 4)) && !(isBetween((n % 100), 12, 14))) {
          return 'few';
        }
        if ((n % 10) === 0 ||
            (isBetween((n % 10), 5, 9)) ||
            (isBetween((n % 100), 11, 14))) {
          return 'many';
        }
        if ((n % 10) === 1 && (n % 100) !== 11) {
          return 'one';
        }
        return 'other';
      },
      '12': function(n) {
        if ((isBetween(n, 2, 4))) {
          return 'few';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '13': function(n) {
        if ((isBetween((n % 10), 2, 4)) && !(isBetween((n % 100), 12, 14))) {
          return 'few';
        }
        if (n !== 1 && (isBetween((n % 10), 0, 1)) ||
            (isBetween((n % 10), 5, 9)) ||
            (isBetween((n % 100), 12, 14))) {
          return 'many';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '14': function(n) {
        if ((isBetween((n % 100), 3, 4))) {
          return 'few';
        }
        if ((n % 100) === 2) {
          return 'two';
        }
        if ((n % 100) === 1) {
          return 'one';
        }
        return 'other';
      },
      '15': function(n) {
        if (n === 0 || (isBetween((n % 100), 2, 10))) {
          return 'few';
        }
        if ((isBetween((n % 100), 11, 19))) {
          return 'many';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '16': function(n) {
        if ((n % 10) === 1 && n !== 11) {
          return 'one';
        }
        return 'other';
      },
      '17': function(n) {
        if (n === 3) {
          return 'few';
        }
        if (n === 0) {
          return 'zero';
        }
        if (n === 6) {
          return 'many';
        }
        if (n === 2) {
          return 'two';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '18': function(n) {
        if (n === 0) {
          return 'zero';
        }
        if ((isBetween(n, 0, 2)) && n !== 0 && n !== 2) {
          return 'one';
        }
        return 'other';
      },
      '19': function(n) {
        if ((isBetween(n, 2, 10))) {
          return 'few';
        }
        if ((isBetween(n, 0, 1))) {
          return 'one';
        }
        return 'other';
      },
      '20': function(n) {
        if ((isBetween((n % 10), 3, 4) || ((n % 10) === 9)) && !(
            isBetween((n % 100), 10, 19) ||
            isBetween((n % 100), 70, 79) ||
            isBetween((n % 100), 90, 99)
            )) {
          return 'few';
        }
        if ((n % 1000000) === 0 && n !== 0) {
          return 'many';
        }
        if ((n % 10) === 2 && !isIn((n % 100), [12, 72, 92])) {
          return 'two';
        }
        if ((n % 10) === 1 && !isIn((n % 100), [11, 71, 91])) {
          return 'one';
        }
        return 'other';
      },
      '21': function(n) {
        if (n === 0) {
          return 'zero';
        }
        if (n === 1) {
          return 'one';
        }
        return 'other';
      },
      '22': function(n) {
        if ((isBetween(n, 0, 1)) || (isBetween(n, 11, 99))) {
          return 'one';
        }
        return 'other';
      },
      '23': function(n) {
        if ((isBetween((n % 10), 1, 2)) || (n % 20) === 0) {
          return 'one';
        }
        return 'other';
      },
      '24': function(n) {
        if ((isBetween(n, 3, 10) || isBetween(n, 13, 19))) {
          return 'few';
        }
        if (isIn(n, [2, 12])) {
          return 'two';
        }
        if (isIn(n, [1, 11])) {
          return 'one';
        }
        return 'other';
      }
    };

    // return a function that gives the plural form name for a given integer
    var index = locales2rules[lang.replace(/-.*$/, '')];
    if (!(index in pluralRules)) {
      return function() { return 'other'; };
    }
    return pluralRules[index];
  }




  var MAX_PLACEABLES = 100;


  var PropertiesParser = {
    patterns: null,
    entryIds: null,

    init: function() {
      this.patterns = {
        comment: /^\s*#|^\s*$/,
        entity: /^([^=\s]+)\s*=\s*(.*)$/,
        multiline: /[^\\]\\$/,
        index: /\{\[\s*(\w+)(?:\(([^\)]*)\))?\s*\]\}/i,
        unicode: /\\u([0-9a-fA-F]{1,4})/g,
        entries: /[^\r\n]+/g,
        controlChars: /\\([\\\n\r\t\b\f\{\}\"\'])/g,
        placeables: /\{\{\s*([^\s]*?)\s*\}\}/,
      };
    },

    parse: function(ctx, source) {
      if (!this.patterns) {
        this.init();
      }

      var ast = [];
      this.entryIds = Object.create(null);

      var entries = source.match(this.patterns.entries);
      if (!entries) {
        return ast;
      }
      for (var i = 0; i < entries.length; i++) {
        var line = entries[i];

        if (this.patterns.comment.test(line)) {
          continue;
        }

        while (this.patterns.multiline.test(line) && i < entries.length) {
          line = line.slice(0, -1) + entries[++i].trim();
        }

        var entityMatch = line.match(this.patterns.entity);
        if (entityMatch) {
          try {
            this.parseEntity(entityMatch[1], entityMatch[2], ast);
          } catch (e) {
            if (ctx) {
              ctx._emitter.emit('parseerror', e);
            } else {
              throw e;
            }
          }
        }
      }
      return ast;
    },

    parseEntity: function(id, value, ast) {
      var name, key;

      var pos = id.indexOf('[');
      if (pos !== -1) {
        name = id.substr(0, pos);
        key = id.substring(pos + 1, id.length - 1);
      } else {
        name = id;
        key = null;
      }

      var nameElements = name.split('.');

      if (nameElements.length > 2) {
        throw new L10nError('Error in ID: "' + name + '".' +
            ' Nested attributes are not supported.');
      }

      var attr;
      if (nameElements.length > 1) {
        name = nameElements[0];
        attr = nameElements[1];

        if (attr[0] === '$') {
          throw new L10nError('Attribute can\'t start with "$"', id);
        }
      } else {
        attr = null;
      }

      this.setEntityValue(name, attr, key, this.unescapeString(value), ast);
    },

    setEntityValue: function(id, attr, key, rawValue, ast) {
      var pos, v;

      var value = rawValue.indexOf('{{') > -1 ?
        this.parseString(rawValue) : rawValue;

      if (rawValue.indexOf('<') > -1 || rawValue.indexOf('&') > -1) {
        value = { $o: value };
      }

      if (attr) {
        pos = this.entryIds[id];
        if (pos === undefined) {
          v = {$i: id};
          if (key) {
            v[attr] = {};
            v[attr][key] = value;
          } else {
            v[attr] = value;
          }
          ast.push(v);
          this.entryIds[id] = ast.length - 1;
          return;
        }
        if (key) {
          if (typeof(ast[pos][attr]) === 'string') {
            ast[pos][attr] = {
              $x: this.parseIndex(ast[pos][attr]),
              $v: {}
            };
          }
          ast[pos][attr].$v[key] = value;
          return;
        }
        ast[pos][attr] = value;
        return;
      }

      // Hash value
      if (key) {
        pos = this.entryIds[id];
        if (pos === undefined) {
          v = {};
          v[key] = value;
          ast.push({$i: id, $v: v});
          this.entryIds[id] = ast.length - 1;
          return;
        }
        if (typeof(ast[pos].$v) === 'string') {
          ast[pos].$x = this.parseIndex(ast[pos].$v);
          ast[pos].$v = {};
        }
        ast[pos].$v[key] = value;
        return;
      }

      // simple value
      ast.push({$i: id, $v: value});
      this.entryIds[id] = ast.length - 1;
    },

    parseString: function(str) {
      var chunks = str.split(this.patterns.placeables);
      var complexStr = [];

      var len = chunks.length;
      var placeablesCount = (len - 1) / 2;

      if (placeablesCount >= MAX_PLACEABLES) {
        throw new L10nError('Too many placeables (' + placeablesCount +
                            ', max allowed is ' + MAX_PLACEABLES + ')');
      }

      for (var i = 0; i < chunks.length; i++) {
        if (chunks[i].length === 0) {
          continue;
        }
        if (i % 2 === 1) {
          complexStr.push({t: 'idOrVar', v: chunks[i]});
        } else {
          complexStr.push(chunks[i]);
        }
      }
      return complexStr;
    },

    unescapeString: function(str) {
      if (str.lastIndexOf('\\') !== -1) {
        str = str.replace(this.patterns.controlChars, '$1');
      }
      return str.replace(this.patterns.unicode, function(match, token) {
        return unescape('%u' + '0000'.slice(token.length) + token);
      });
    },

    parseIndex: function(str) {
      var match = str.match(this.patterns.index);
      if (!match) {
        throw new L10nError('Malformed index');
      }
      if (match[2]) {
        return [{t: 'idOrVar', v: match[1]}, match[2]];
      } else {
        return [{t: 'idOrVar', v: match[1]}];
      }
    }
  };



  var KNOWN_MACROS = ['plural'];

  var MAX_PLACEABLE_LENGTH = 2500;
  var rePlaceables = /\{\{\s*(.+?)\s*\}\}/g;

  // Matches characters outside of the Latin-1 character set
  var nonLatin1 = /[^\x01-\xFF]/;

  // Unicode bidi isolation characters
  var FSI = '\u2068';
  var PDI = '\u2069';

  function createEntry(node, env) {
    var keys = Object.keys(node);

    // the most common scenario: a simple string with no arguments
    if (typeof node.$v === 'string' && keys.length === 2) {
      return node.$v;
    }

    var attrs;

    /* jshint -W084 */
    for (var i = 0, key; key = keys[i]; i++) {
      if (key[0] === '$') {
        continue;
      }

      if (!attrs) {
        attrs = Object.create(null);
      }
      attrs[key] = createAttribute(node[key], env, node.$i + '.' + key);
    }

    return {
      id: node.$i,
      value: node.$v !== undefined ? node.$v : null,
      index: node.$x || null,
      attrs: attrs || null,
      env: env,
      // the dirty guard prevents cyclic or recursive references
      dirty: false
    };
  }

  function createAttribute(node, env, id) {
    if (typeof node === 'string') {
      return node;
    }

    return {
      id: id,
      value: node.$v || (node !== undefined ? node : null),
      index: node.$x || null,
      env: env,
      dirty: false
    };
  }


  function format(args, entity) {
    var locals = {
      overlay: false
    };

    if (typeof entity === 'string') {
      return [locals, entity];
    }

    if (entity.dirty) {
      throw new L10nError('Cyclic reference detected: ' + entity.id);
    }

    entity.dirty = true;

    var rv;

    // if format fails, we want the exception to bubble up and stop the whole
    // resolving process;  however, we still need to clean up the dirty flag
    try {
      rv = resolveValue(locals, args, entity.env, entity.value, entity.index);
    } finally {
      entity.dirty = false;
    }
    return rv;
  }

  function resolveIdentifier(args, env, id) {
    if (KNOWN_MACROS.indexOf(id) > -1) {
      return [{}, env['__' + id]];
    }

    if (args && args.hasOwnProperty(id)) {
      if (typeof args[id] === 'string' || (typeof args[id] === 'number' &&
          !isNaN(args[id]))) {
        return [{}, args[id]];
      } else {
        throw new L10nError('Arg must be a string or a number: ' + id);
      }
    }

    // XXX: special case for Node.js where still:
    // '__proto__' in Object.create(null) => true
    if (id in env && id !== '__proto__') {
      return format(args, env[id]);
    }

    throw new L10nError('Unknown reference: ' + id);
  }

  function subPlaceable(locals, args, env, id) {
    var res;

    try {
      res = resolveIdentifier(args, env, id);
    } catch (err) {
      return [{ error: err }, '{{ ' + id + ' }}'];
    }

    var value = res[1];

    if (typeof value === 'number') {
      return res;
    }

    if (typeof value === 'string') {
      // prevent Billion Laughs attacks
      if (value.length >= MAX_PLACEABLE_LENGTH) {
        throw new L10nError('Too many characters in placeable (' +
                            value.length + ', max allowed is ' +
                            MAX_PLACEABLE_LENGTH + ')');
      }

      if (locals.contextIsNonLatin1 || value.match(nonLatin1)) {
        // When dealing with non-Latin-1 text
        // we wrap substitutions in bidi isolate characters
        // to avoid bidi issues.
        res[1] = FSI + value + PDI;
      }

      return res;
    }

    return [{}, '{{ ' + id + ' }}'];
  }

  function interpolate(locals, args, env, arr) {
    return arr.reduce(function(prev, cur) {
      if (typeof cur === 'string') {
        return [prev[0], prev[1] + cur];
      } else if (cur.t === 'idOrVar'){
        var placeable = subPlaceable(locals, args, env, cur.v);
        if (placeable[0].overlay) {
          prev[0].overlay = true;
        }
        return [prev[0], prev[1] + placeable[1]];
      }
    }, [locals, '']);
  }

  function resolveSelector(args, env, expr, index) {
      var selectorName = index[0].v;
      var selector = resolveIdentifier(args, env, selectorName)[1];

      if (typeof selector !== 'function') {
        // selector is a simple reference to an entity or args
        return selector;
      }

      var argValue = index[1] ?
        resolveIdentifier(args, env, index[1])[1] : undefined;

      if (selector === env.__plural) {
        // special cases for zero, one, two if they are defined on the hash
        if (argValue === 0 && 'zero' in expr) {
          return 'zero';
        }
        if (argValue === 1 && 'one' in expr) {
          return 'one';
        }
        if (argValue === 2 && 'two' in expr) {
          return 'two';
        }
      }

      return selector(argValue);
  }

  function resolveValue(locals, args, env, expr, index) {
    if (!expr) {
      return [locals, expr];
    }

    if (expr.$o) {
      expr = expr.$o;
      locals.overlay = true;
    }

    if (typeof expr === 'string' ||
        typeof expr === 'boolean' ||
        typeof expr === 'number') {
      return [locals, expr];
    }

    if (Array.isArray(expr)) {
      locals.contextIsNonLatin1 = expr.some(function($_) {
        return typeof($_) === 'string' && $_.match(nonLatin1);
      });
      return interpolate(locals, args, env, expr);
    }

    // otherwise, it's a dict
    if (index) {
      // try to use the index in order to select the right dict member
      var selector = resolveSelector(args, env, expr, index);
      if (expr.hasOwnProperty(selector)) {
        return resolveValue(locals, args, env, expr[selector]);
      }
    }

    // if there was no index or no selector was found, try 'other'
    if ('other' in expr) {
      return resolveValue(locals, args, env, expr.other);
    }

    // XXX Specify entity id
    throw new L10nError('Unresolvable value');
  }

  var Resolver = {
    createEntry: createEntry,
    format: format,
    rePlaceables: rePlaceables
  };



  /* Utility functions */

  // Recursively walk an AST node searching for content leaves
  function walkContent(node, fn) {
    if (typeof node === 'string') {
      return fn(node);
    }

    if (node.t === 'idOrVar') {
      return node;
    }

    var rv = Array.isArray(node) ? [] : {};
    var keys = Object.keys(node);

    /* jshint boss:true */
    for (var i = 0, key; key = keys[i]; i++) {
      // don't change identifier ($i) nor indices ($x)
      if (key === '$i' || key === '$x') {
        rv[key] = node[key];
      } else {
        rv[key] = walkContent(node[key], fn);
      }
    }
    return rv;
  }


  /* Pseudolocalizations
   *
   * PSEUDO_STRATEGIES is a dict of strategies to be used to modify the English
   * context in order to create pseudolocalizations.  These can be used by
   * developers to test the localizability of their code without having to
   * actually speak a foreign language.
   *
   * Currently, the following pseudolocales are supported:
   *
   *   qps-ploc - Ȧȧƈƈḗḗƞŧḗḗḓ Ḗḗƞɠŀīīşħ
   *
   *     In Accented English all English letters are replaced by accented
   *     Unicode counterparts which don't impair the readability of the content.
   *     This allows developers to quickly test if any given string is being
   *     correctly displayed in its 'translated' form.  Additionally, simple
   *     heuristics are used to make certain words longer to better simulate the
   *     experience of international users.
   *
   *   qps-plocm - ɥsıʅƃuƎ pǝɹoɹɹıW
   *
   *     Mirrored English is a fake RTL locale.  All words are surrounded by
   *     Unicode formatting marks forcing the RTL directionality of characters.
   *     In addition, to make the reversed text easier to read, individual
   *     letters are flipped.
   *
   *     Note: The name above is hardcoded to be RTL in case code editors have
   *     trouble with the RLO and PDF Unicode marks.  In reality, it should be
   *     surrounded by those marks as well.
   *
   * See https://bugzil.la/900182 for more information.
   *
   */

  var reAlphas = /[a-zA-Z]/g;
  var reVowels = /[aeiouAEIOU]/g;

  // ȦƁƇḒḖƑƓĦĪĴĶĿḾȠǾƤɊŘŞŦŬṼẆẊẎẐ + [\\]^_` + ȧƀƈḓḗƒɠħīĵķŀḿƞǿƥɋřşŧŭṽẇẋẏẑ
  var ACCENTED_MAP = '\u0226\u0181\u0187\u1E12\u1E16\u0191\u0193\u0126\u012A' +
                     '\u0134\u0136\u013F\u1E3E\u0220\u01FE\u01A4\u024A\u0158' +
                     '\u015E\u0166\u016C\u1E7C\u1E86\u1E8A\u1E8E\u1E90' +
                     '[\\]^_`' +
                     '\u0227\u0180\u0188\u1E13\u1E17\u0192\u0260\u0127\u012B' +
                     '\u0135\u0137\u0140\u1E3F\u019E\u01FF\u01A5\u024B\u0159' +
                     '\u015F\u0167\u016D\u1E7D\u1E87\u1E8B\u1E8F\u1E91';

  // XXX Until https://bugzil.la/1007340 is fixed, ᗡℲ⅁⅂⅄ don't render correctly
  // on the devices.  For now, use the following replacements: pɟפ˥ʎ
  // ∀ԐↃpƎɟפHIſӼ˥WNOԀÒᴚS⊥∩ɅＭXʎZ + [\\]ᵥ_, + ɐqɔpǝɟƃɥıɾʞʅɯuodbɹsʇnʌʍxʎz
  var FLIPPED_MAP = '\u2200\u0510\u2183p\u018E\u025F\u05E4HI\u017F' +
                    '\u04FC\u02E5WNO\u0500\xD2\u1D1AS\u22A5\u2229\u0245' +
                    '\uFF2DX\u028EZ' +
                    '[\\]\u1D65_,' +
                    '\u0250q\u0254p\u01DD\u025F\u0183\u0265\u0131\u027E' +
                    '\u029E\u0285\u026Fuodb\u0279s\u0287n\u028C\u028Dx\u028Ez';

  function makeLonger(val) {
    return val.replace(reVowels, function(match) {
      return match + match.toLowerCase();
    });
  }

  function makeAccented(map, val) {
    // Replace each Latin letter with a Unicode character from map
    return val.replace(reAlphas, function(match) {
      return map.charAt(match.charCodeAt(0) - 65);
    });
  }

  var reWords = /[^\W0-9_]+/g;

  function makeRTL(val) {
    // Surround each word with Unicode formatting codes, RLO and PDF:
    //   U+202E:   RIGHT-TO-LEFT OVERRIDE (RLO)
    //   U+202C:   POP DIRECTIONAL FORMATTING (PDF)
    // See http://www.w3.org/International/questions/qa-bidi-controls
    return val.replace(reWords, function(match) {
      return '\u202e' + match + '\u202c';
    });
  }

  // strftime tokens (%a, %Eb) and template {vars}
  var reExcluded = /(%[EO]?\w|\{\s*.+?\s*\})/;

  function mapContent(fn, val) {
    if (!val) {
      return val;
    }
    var parts = val.split(reExcluded);
    var modified = parts.map(function(part) {
      if (reExcluded.test(part)) {
        return part;
      }
      return fn(part);
    });
    return modified.join('');
  }

  function Pseudo(id, name, charMap, modFn) {
    this.id = id;
    this.translate = mapContent.bind(null, function(val) {
      return makeAccented(charMap, modFn(val));
    });
    this.name = this.translate(name);
  }

  var PSEUDO_STRATEGIES = {
    'qps-ploc': new Pseudo('qps-ploc', 'Accented English',
                           ACCENTED_MAP, makeLonger),
    'qps-plocm': new Pseudo('qps-plocm', 'Mirrored English',
                            FLIPPED_MAP, makeRTL)
  };



  function Locale(id, ctx) {
    this.id = id;
    this.ctx = ctx;
    this.isReady = false;
    this.isPseudo = PSEUDO_STRATEGIES.hasOwnProperty(id);
    this.entries = Object.create(null);
    this.entries.__plural = getPluralRule(this.isPseudo ?
                                          this.ctx.defaultLocale : id);
  }

  var bindingsIO = {
    extra: function(id, ver, path, type, callback, errback, sync) {
      if (type === 'properties') {
        type = 'text';
      }
      navigator.mozApps.getLocalizationResource(id, ver, path, type).
        then(callback.bind(null, null), errback);
    },
    app: function(id, ver, path, type, callback, errback, sync) {
      switch (type) {
        case 'properties':
          io.load(path, callback, sync);
          break;
        case 'json':
          io.loadJSON(path, callback, sync);
          break;
      }
    },
  };

  Locale.prototype.build = function L_build(callback) {
    var sync = !callback;
    var ctx = this.ctx;
    var self = this;

    var l10nLoads = ctx.resLinks.length;

    function onL10nLoaded(err) {
      if (err) {
        ctx._emitter.emit('fetcherror', err);
      }
      if (--l10nLoads <= 0) {
        self.isReady = true;
        if (callback) {
          callback();
        }
      }
    }

    if (l10nLoads === 0) {
      onL10nLoaded();
      return;
    }

    function onJSONLoaded(err, json) {
      if (!err && json) {
        self.addAST(json);
      }
      onL10nLoaded(err);
    }

    function onPropLoaded(err, source) {
      if (!err && source) {
        var ast = PropertiesParser.parse(ctx, source);
        self.addAST(ast);
      }
      onL10nLoaded(err);
    }

    var idToFetch = this.isPseudo ? ctx.defaultLocale : this.id;
    var source = navigator.mozL10n._config.localeSources[this.id] || 'app';
    var appVersion = navigator.mozL10n._config.appVersion;

    for (var i = 0; i < ctx.resLinks.length; i++) {
      var resLink = decodeURI(ctx.resLinks[i]);
      var path = resLink.replace('{locale}', idToFetch);
      var type = path.substr(path.lastIndexOf('.') + 1);

      var cb;
      switch (type) {
        case 'json':
          cb = onJSONLoaded;
          break;
        case 'properties':
          cb = onPropLoaded;
          break;
      }
      bindingsIO[source](this.id,
        appVersion, path, type, cb, onL10nLoaded, sync);
    }
  };

  function createPseudoEntry(node, entries) {
    return Resolver.createEntry(
      walkContent(node, PSEUDO_STRATEGIES[this.id].translate),
      entries);
  }

  Locale.prototype.addAST = function(ast) {
    /* jshint -W084 */

    var createEntry = this.isPseudo ?
      createPseudoEntry.bind(this) : Resolver.createEntry;

    for (var i = 0; i < ast.length; i++) {
      this.entries[ast[i].$i] = createEntry(ast[i], this.entries);
    }
  };




  function Context(id) {
    this.id = id;
    this.isReady = false;
    this.isLoading = false;

    this.defaultLocale = 'en-US';
    this.availableLocales = [];
    this.supportedLocales = [];

    this.resLinks = [];
    this.locales = {};

    this._emitter = new EventEmitter();
    this._ready = new Promise(this.once.bind(this));
  }


  // Getting translations

  function reportMissing(id, err) {
    this._emitter.emit('notfounderror', err);
    return id;
  }

  function getWithFallback(id) {
    /* jshint -W084 */
    var cur = 0;
    var loc;
    var locale;
    while (loc = this.supportedLocales[cur]) {
      locale = this.getLocale(loc);
      if (!locale.isReady) {
        // build without callback, synchronously
        locale.build(null);
      }
      var entry = locale.entries[id];
      if (entry === undefined) {
        cur++;
        reportMissing.call(this, id, new L10nError(
          '"' + id + '"' + ' not found in ' + loc + ' in ' + this.id,
          id, loc));
        continue;
      }
      return entry;
    }

    throw new L10nError(
      '"' + id + '"' + ' missing from all supported locales in ' + this.id, id);
  }

  function formatTuple(args, entity) {
    try {
      return Resolver.format(args, entity);
    } catch (err) {
      this._emitter.emit('resolveerror', err);
      var locals = {
        error: err
      };
      return [locals, entity.id];
    }
  }

  function formatValue(args, entity) {
    if (typeof entity === 'string') {
      return entity;
    }

    // take the string value only
    return formatTuple.call(this, args, entity)[1];
  }

  function formatEntity(args, entity) {
    var rv = formatTuple.call(this, args, entity);
    var locals = rv[0];
    var value = rv[1];

    var formatted = {
      value: value,
      attrs: null,
      overlay: locals.overlay
    };

    if (entity.attrs) {
      formatted.attrs = Object.create(null);
    }

    for (var key in entity.attrs) {
      /* jshint -W089 */
      formatted.attrs[key] = formatValue.call(this, args, entity.attrs[key]);
    }

    return formatted;
  }

  function formatAsync(fn, id, args) {
    return this._ready.then(
      getWithFallback.bind(this, id)).then(
        fn.bind(this, args),
        reportMissing.bind(this, id));
  }

  Context.prototype.formatValue = function(id, args) {
    return formatAsync.call(this, formatValue, id, args);
  };

  Context.prototype.formatEntity = function(id, args) {
    return formatAsync.call(this, formatEntity, id, args);
  };

  function legacyGet(fn, id, args) {
    if (!this.isReady) {
      throw new L10nError('Context not ready');
    }

    var entry;
    try {
      entry = getWithFallback.call(this, id);
    } catch (err) {
      // Don't handle notfounderrors in individual locales in any special way
      if (err.loc) {
        throw err;
      }
      // For general notfounderrors, report them and return legacy fallback
      reportMissing.call(this, id, err);
      // XXX legacy compat;  some Gaia code checks if returned value is falsy or
      // an empty string to know if a translation is available;  this is bad and
      // will be fixed eventually in https://bugzil.la/1020138
      return '';
    }

    // If translation is broken use regular fallback-on-id approach
    return fn.call(this, args, entry);
  }

  Context.prototype.get = function(id, args) {
    return legacyGet.call(this, formatValue, id, args);
  };

  Context.prototype.getEntity = function(id, args) {
    return legacyGet.call(this, formatEntity, id, args);
  };

  Context.prototype.getLocale = function getLocale(code) {
    /* jshint -W093 */

    var locales = this.locales;
    if (locales[code]) {
      return locales[code];
    }

    return locales[code] = new Locale(code, this);
  };


  // Getting ready

  function negotiate(available, requested, defaultLocale) {
    if (available.indexOf(requested[0]) === -1 ||
        requested[0] === defaultLocale) {
      return [defaultLocale];
    } else {
      return [requested[0], defaultLocale];
    }
  }

  function freeze(supported) {
    var locale = this.getLocale(supported[0]);
    if (locale.isReady) {
      setReady.call(this, supported);
    } else {
      locale.build(setReady.bind(this, supported));
    }
  }

  function setReady(supported) {
    this.supportedLocales = supported;
    this.isReady = true;
    this._emitter.emit('ready');
  }

  Context.prototype.registerLocales = function(defLocale, available) {

    if (defLocale) {
      this.defaultLocale = defLocale;
    }
    /* jshint boss:true */
    this.availableLocales = [this.defaultLocale];

    if (available) {
      for (var i = 0, loc; loc = available[i]; i++) {
        if (this.availableLocales.indexOf(loc) === -1) {
          this.availableLocales.push(loc);
        }
      }
    }
  };

  Context.prototype.requestLocales = function requestLocales() {
    if (this.isLoading && !this.isReady) {
      throw new L10nError('Context not ready');
    }

    this.isLoading = true;
    var requested = Array.prototype.slice.call(arguments);
    if (requested.length === 0) {
      throw new L10nError('No locales requested');
    }

    var reqPseudo = requested.filter(function(loc) {
      return loc in PSEUDO_STRATEGIES;
    });

    var supported = negotiate(this.availableLocales.concat(reqPseudo),
                              requested,
                              this.defaultLocale);
    freeze.call(this, supported);
  };


  // Events

  Context.prototype.addEventListener = function(type, listener) {
    this._emitter.addEventListener(type, listener);
  };

  Context.prototype.removeEventListener = function(type, listener) {
    this._emitter.removeEventListener(type, listener);
  };

  Context.prototype.ready = function(callback) {
    if (this.isReady) {
      setTimeout(callback);
      return;
    }
    this.addEventListener('ready', callback);
  };

  Context.prototype.once = function(callback) {
    /* jshint -W068 */
    if (this.isReady) {
      setTimeout(callback);
      return;
    }

    var callAndRemove = (function() {
      this.removeEventListener('ready', callAndRemove);
      callback();
    }).bind(this);
    this.addEventListener('ready', callAndRemove);
  };



  var allowed = {
    elements: [
      'a', 'em', 'strong', 'small', 's', 'cite', 'q', 'dfn', 'abbr', 'data',
      'time', 'code', 'var', 'samp', 'kbd', 'sub', 'sup', 'i', 'b', 'u',
      'mark', 'ruby', 'rt', 'rp', 'bdi', 'bdo', 'span', 'br', 'wbr'
    ],
    attributes: {
      global: [ 'title', 'aria-label', 'aria-valuetext', 'aria-moz-hint' ],
      a: [ 'download' ],
      area: [ 'download', 'alt' ],
      // value is special-cased in isAttrAllowed
      input: [ 'alt', 'placeholder' ],
      menuitem: [ 'label' ],
      menu: [ 'label' ],
      optgroup: [ 'label' ],
      option: [ 'label' ],
      track: [ 'label' ],
      img: [ 'alt' ],
      textarea: [ 'placeholder' ],
      th: [ 'abbr']
    }
  };



  var DEBUG = false;
  var isPretranslated = false;
  var rtlList = [
    'ar-SA', 'he-IL', 'fa-IR', 'ps-AF', 'qps-plocm', 'ur-PK', 'ks-IN', 'ur-IN'
  ];
  var nodeObserver = null;
  var pendingElements = null;

  var moConfig = {
    attributes: true,
    characterData: false,
    childList: true,
    subtree: true,
    attributeFilter: ['data-l10n-id', 'data-l10n-args']
  };

  // Public API

  navigator.mozL10n = {
    ctx: new Context(window.document ? document.URL : null),
    get: function get(id, ctxdata) {
      return navigator.mozL10n.ctx.get(id, ctxdata);
    },
    formatValue: function(id, ctxdata) {
      return navigator.mozL10n.ctx.formatValue(id, ctxdata);
    },
    formatEntity: function(id, ctxdata) {
      return navigator.mozL10n.ctx.formatEntity(id, ctxdata);
    },
    translateFragment: function (fragment) {
      return translateFragment.call(navigator.mozL10n, fragment);
    },
    setAttributes: setL10nAttributes,
    getAttributes: getL10nAttributes,
    ready: function ready(callback) {
      return navigator.mozL10n.ctx.ready(callback);
    },
    once: function once(callback) {
      return navigator.mozL10n.ctx.once(callback);
    },
    get readyState() {
      return navigator.mozL10n.ctx.isReady ? 'complete' : 'loading';
    },
    language: {
      set code(lang) {
        navigator.mozL10n.ctx.requestLocales(lang);
      },
      get code() {
        return navigator.mozL10n.ctx.supportedLocales[0];
      },
      get direction() {
        return getDirection(navigator.mozL10n.ctx.supportedLocales[0]);
      }
    },
    qps: PSEUDO_STRATEGIES,
    _config: {
      appVersion: null,
      localeSources: Object.create(null),
    },
    _getInternalAPI: function() {
      return {
        Error: L10nError,
        Context: Context,
        Locale: Locale,
        Resolver: Resolver,
        getPluralRule: getPluralRule,
        rePlaceables: rePlaceables,
        translateDocument: translateDocument,
        onMetaInjected: onMetaInjected,
        PropertiesParser: PropertiesParser,
        walkContent: walkContent,
        buildLocaleList: buildLocaleList
      };
    }
  };

  navigator.mozL10n.ctx.ready(onReady.bind(navigator.mozL10n));

  navigator.mozL10n.ctx.addEventListener('notfounderror',
    function reportMissingEntity(e) {
      if (DEBUG || e.loc === 'en-US') {
        console.warn(e.toString());
      }
  });

  if (DEBUG) {
    navigator.mozL10n.ctx.addEventListener('fetcherror',
      console.error.bind(console));
    navigator.mozL10n.ctx.addEventListener('parseerror',
      console.error.bind(console));
    navigator.mozL10n.ctx.addEventListener('resolveerror',
      console.error.bind(console));
  }

  function getDirection(lang) {
    return (rtlList.indexOf(lang) >= 0) ? 'rtl' : 'ltr';
  }

  var readyStates = {
    'loading': 0,
    'interactive': 1,
    'complete': 2
  };

  function waitFor(state, callback) {
    state = readyStates[state];
    if (readyStates[document.readyState] >= state) {
      callback();
      return;
    }

    document.addEventListener('readystatechange', function l10n_onrsc() {
      if (readyStates[document.readyState] >= state) {
        document.removeEventListener('readystatechange', l10n_onrsc);
        callback();
      }
    });
  }

  if (window.document) {
    isPretranslated = !PSEUDO_STRATEGIES.hasOwnProperty(navigator.language) &&
                      (document.documentElement.lang === navigator.language);

    // XXX always pretranslate if data-no-complete-bug is set;  this is
    // a workaround for a netError page not firing some onreadystatechange
    // events;  see https://bugzil.la/444165
    var pretranslate = document.documentElement.dataset.noCompleteBug ?
      true : !isPretranslated;
    waitFor('interactive', init.bind(navigator.mozL10n, pretranslate));
  }

  function initObserver() {
    nodeObserver = new MutationObserver(onMutations.bind(navigator.mozL10n));
    nodeObserver.observe(document, moConfig);
  }

  function init(pretranslate) {
    if (pretranslate) {
      initResources.call(navigator.mozL10n);
    } else {
      // if pretranslate is false, we want to initialize MO
      // early, to collect nodes injected between now and when resources
      // are loaded because we're not going to translate the whole
      // document once l10n resources are ready.
      initObserver();
      window.setTimeout(initResources.bind(navigator.mozL10n));
    }
  }

  function initResources() {
    /* jshint boss:true */

    var meta = {};
    var nodes = document.head
                        .querySelectorAll('link[rel="localization"],' +
                                          'meta[name="availableLanguages"],' +
                                          'meta[name="defaultLanguage"],' +
                                          'meta[name="appVersion"],' +
                                          'script[type="application/l10n"]');
    for (var i = 0, node; node = nodes[i]; i++) {
      var type = node.getAttribute('rel') || node.nodeName.toLowerCase();
      switch (type) {
        case 'localization':
          this.ctx.resLinks.push(node.getAttribute('href'));
          break;
        case 'meta':
          onMetaInjected.call(this, node, meta);
          break;
        case 'script':
          onScriptInjected.call(this, node);
          break;
      }
    }

    var additionalLanguagesPromise;

    if (navigator.mozApps && navigator.mozApps.getAdditionalLanguages) {
      // if the environment supports langpacks, register extra languages…
      additionalLanguagesPromise =
        navigator.mozApps.getAdditionalLanguages().catch(function(e) {
          console.error('Error while loading getAdditionalLanguages', e);
        });

      // …and listen to langpacks being added and removed
      document.addEventListener('additionallanguageschange', function(evt) {
        registerLocales.call(this, meta, evt.detail);
      }.bind(this));
    } else {
      additionalLanguagesPromise = Promise.resolve();
    }

    additionalLanguagesPromise.then(function(extraLangs) {
      registerLocales.call(this, meta, extraLangs);
      initLocale.call(this);
    }.bind(this));
  }

  function registerLocales(meta, extraLangs) {
    var locales = buildLocaleList.call(this, meta, extraLangs);
    navigator.mozL10n._config.localeSources = locales[1];
    this.ctx.registerLocales(locales[0], Object.keys(locales[1]));
  }

  function getMatchingLangpack(appVersion, langpacks) {
    for (var i = 0, langpack; (langpack = langpacks[i]); i++) {
      if (langpack.target === appVersion) {
        return langpack;
      }
    }
    return null;
  }

  function buildLocaleList(meta, extraLangs) {
    var loc, lp;
    var localeSources = Object.create(null);
    var defaultLocale = meta.defaultLocale || this.ctx.defaultLocale;

    if (meta.availableLanguages) {
      for (loc in meta.availableLanguages) {
        localeSources[loc] = 'app';
      }
    }

    if (extraLangs) {
      for (loc in extraLangs) {
        lp = getMatchingLangpack(this._config.appVersion, extraLangs[loc]);

        if (!lp) {
          continue;
        }
        if (!(loc in localeSources) ||
            !meta.availableLanguages[loc] ||
            parseInt(lp.revision) > meta.availableLanguages[loc]) {
          localeSources[loc] = 'extra';
        }
      }
    }

    if (!(defaultLocale in localeSources)) {
      localeSources[defaultLocale] = 'app';
    }
    return [defaultLocale, localeSources];
  }

  function splitAvailableLanguagesString(str) {
    var langs = {};

    str.split(',').forEach(function(lang) {
      // code:revision
      lang = lang.trim().split(':');
      // if revision is missing, use NaN
      langs[lang[0]] = parseInt(lang[1]);
    });
    return langs;
  }

  function onMetaInjected(node, meta) {
    switch (node.getAttribute('name')) {
      case 'availableLanguages':
        meta.availableLanguages =
          splitAvailableLanguagesString(node.getAttribute('content'));
        break;
      case 'defaultLanguage':
        meta.defaultLanguage = node.getAttribute('content');
        break;
      case 'appVersion':
        navigator.mozL10n._config.appVersion = node.getAttribute('content');
        break;
    }
  }

  function onScriptInjected(node) {
    var lang = node.getAttribute('lang');
    var locale = this.ctx.getLocale(lang);
    locale.addAST(JSON.parse(node.textContent));
  }

  function initLocale() {
    this.ctx.requestLocales.apply(
      this.ctx, navigator.languages || [navigator.language]);
    window.addEventListener('languagechange', function l10n_langchange() {
      this.ctx.requestLocales.apply(
        this.ctx, navigator.languages || [navigator.language]);
    }.bind(this));
  }

  function localizeMutations(mutations) {
    var mutation;
    var targets = new Set();

    for (var i = 0; i < mutations.length; i++) {
      mutation = mutations[i];
      if (mutation.type === 'childList') {
        var addedNode;

        for (var j = 0; j < mutation.addedNodes.length; j++) {
          addedNode = mutation.addedNodes[j];
          if (addedNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }
          targets.add(addedNode);
        }
      }

      if (mutation.type === 'attributes') {
        targets.add(mutation.target);
      }
    }

    targets.forEach(function(target) {
      if (target.childElementCount) {
        translateFragment.call(this, target);
      } else if (target.hasAttribute('data-l10n-id')) {
        translateElement.call(this, target);
      }
    }, this);
  }

  function onMutations(mutations, self) {
    self.disconnect();
    localizeMutations.call(this, mutations);
    self.observe(document, moConfig);
  }

  function onReady() {
    if (!isPretranslated) {
      translateDocument.call(this);
    }
    isPretranslated = false;

    if (pendingElements) {
      /* jshint boss:true */
      for (var i = 0, element; element = pendingElements[i]; i++) {
        translateElement.call(this, element);
      }
      pendingElements = null;
    }

    if (!nodeObserver) {
      initObserver();
    }
    fireLocalizedEvent.call(this);
  }

  function fireLocalizedEvent() {
    var event = new CustomEvent('localized', {
      'bubbles': false,
      'cancelable': false,
      'detail': {
        'language': this.ctx.supportedLocales[0]
      }
    });
    window.dispatchEvent(event);
  }


  function translateDocument() {
    document.documentElement.lang = this.language.code;
    document.documentElement.dir = this.language.direction;
    translateFragment.call(this, document.documentElement);
  }

  function translateFragment(element) {
    if (element.hasAttribute('data-l10n-id')) {
      translateElement.call(this, element);
    }

    var nodes = getTranslatableChildren(element);
    for (var i = 0; i < nodes.length; i++ ) {
      translateElement.call(this, nodes[i]);
    }
  }

  function setL10nAttributes(element, id, args) {
    element.setAttribute('data-l10n-id', id);
    if (args) {
      element.setAttribute('data-l10n-args', JSON.stringify(args));
    }
  }

  function getL10nAttributes(element) {
    return {
      id: element.getAttribute('data-l10n-id'),
      args: JSON.parse(element.getAttribute('data-l10n-args'))
    };
  }

  function getTranslatableChildren(element) {
    return element ? element.querySelectorAll('*[data-l10n-id]') : [];
  }

  function camelCaseToDashed(string) {
    // XXX workaround for https://bugzil.la/1141934
    if (string === 'ariaValueText') {
      return 'aria-valuetext';
    }

    return string
      .replace(/[A-Z]/g, function (match) {
        return '-' + match.toLowerCase();
      })
      .replace(/^-/, '');
  }

  function translateElement(element) {
    if (!this.ctx.isReady) {
      if (!pendingElements) {
        pendingElements = [];
      }
      pendingElements.push(element);
      return;
    }

    var l10n = getL10nAttributes(element);

    if (!l10n.id) {
      return false;
    }

    var entity = this.ctx.getEntity(l10n.id, l10n.args);

    if (typeof entity.value === 'string') {
      if (!entity.overlay) {
        element.textContent = entity.value;
      } else {
        // start with an inert template element and move its children into
        // `element` but such that `element`'s own children are not replaced
        var translation = element.ownerDocument.createElement('template');
        translation.innerHTML = entity.value;
        // overlay the node with the DocumentFragment
        overlayElement(element, translation.content);
      }
    }

    for (var key in entity.attrs) {
      // XXX A temporary special-case for translations using the old method
      // of declaring innerHTML.  To be removed in https://bugzil.la/1027117
      if (key === 'innerHTML') {
        element.innerHTML = entity.attrs[key];
        continue;
      }
      var attrName = camelCaseToDashed(key);
      if (isAttrAllowed({ name: attrName }, element)) {
        element.setAttribute(attrName, entity.attrs[key]);
      }
    }
  }

  // The goal of overlayElement is to move the children of `translationElement`
  // into `sourceElement` such that `sourceElement`'s own children are not
  // replaced, but onle have their text nodes and their attributes modified.
  //
  // We want to make it possible for localizers to apply text-level semantics to
  // the translations and make use of HTML entities. At the same time, we
  // don't trust translations so we need to filter unsafe elements and
  // attribtues out and we don't want to break the Web by replacing elements to
  // which third-party code might have created references (e.g. two-way
  // bindings in MVC frameworks).
  function overlayElement(sourceElement, translationElement) {
    var result = translationElement.ownerDocument.createDocumentFragment();
    var k, attr;

    // take one node from translationElement at a time and check it against
    // the allowed list or try to match it with a corresponding element
    // in the source
    var childElement;
    while ((childElement = translationElement.childNodes[0])) {
      translationElement.removeChild(childElement);

      if (childElement.nodeType === Node.TEXT_NODE) {
        result.appendChild(childElement);
        continue;
      }

      var index = getIndexOfType(childElement);
      var sourceChild = getNthElementOfType(sourceElement, childElement, index);
      if (sourceChild) {
        // there is a corresponding element in the source, let's use it
        overlayElement(sourceChild, childElement);
        result.appendChild(sourceChild);
        continue;
      }

      if (isElementAllowed(childElement)) {
        const sanitizedChild = childElement.ownerDocument.createElement(
          childElement.nodeName);
        overlayElement(sanitizedChild, childElement);
        result.appendChild(sanitizedChild);
        continue;
      }

      // otherwise just take this child's textContent
      result.appendChild(
        document.createTextNode(childElement.textContent));
    }

    // clear `sourceElement` and append `result` which by this time contains
    // `sourceElement`'s original children, overlayed with translation
    sourceElement.textContent = '';
    sourceElement.appendChild(result);

    // if we're overlaying a nested element, translate the allowed
    // attributes; top-level attributes are handled in `translateElement`
    // XXX attributes previously set here for another language should be
    // cleared if a new language doesn't use them; https://bugzil.la/922577
    if (translationElement.attributes) {
      for (k = 0, attr; (attr = translationElement.attributes[k]); k++) {
        if (isAttrAllowed(attr, sourceElement)) {
          sourceElement.setAttribute(attr.name, attr.value);
        }
      }
    }
  }

  // XXX the allowed list should be amendable; https://bugzil.la/922573
  function isElementAllowed(element) {
    return allowed.elements.indexOf(element.tagName.toLowerCase()) !== -1;
  }

  function isAttrAllowed(attr, element) {
    var attrName = attr.name.toLowerCase();
    var tagName = element.tagName.toLowerCase();
    // is it a globally safe attribute?
    if (allowed.attributes.global.indexOf(attrName) !== -1) {
      return true;
    }
    // are there no allowed attributes for this element?
    if (!allowed.attributes[tagName]) {
      return false;
    }
    // is it allowed on this element?
    // XXX the allowed list should be amendable; https://bugzil.la/922573
    if (allowed.attributes[tagName].indexOf(attrName) !== -1) {
      return true;
    }
    // special case for value on inputs with type button, reset, submit
    if (tagName === 'input' && attrName === 'value') {
      var type = element.type.toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'reset') {
        return true;
      }
    }
    return false;
  }

  // Get n-th immediate child of context that is of the same type as element.
  // XXX Use querySelector(':scope > ELEMENT:nth-of-type(index)'), when:
  // 1) :scope is widely supported in more browsers and 2) it works with
  // DocumentFragments.
  function getNthElementOfType(context, element, index) {
    /* jshint boss:true */
    var nthOfType = 0;
    for (var i = 0, child; child = context.children[i]; i++) {
      if (child.nodeType === Node.ELEMENT_NODE &&
          child.tagName === element.tagName) {
        if (nthOfType === index) {
          return child;
        }
        nthOfType++;
      }
    }
    return null;
  }

  // Get the index of the element among siblings of the same type.
  function getIndexOfType(element) {
    var index = 0;
    var child;
    while ((child = element.previousElementSibling)) {
      if (child.tagName === element.tagName) {
        index++;
      }
    }
    return index;
  }

})(this);

define("shared/js/l10n", function(){});

/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */



/**
 * This lib relies on `l10n.js' to implement localizable date/time strings.
 *
 * The proposed `DateTimeFormat' object should provide all the features that are
 * planned for the `Intl.DateTimeFormat' constructor, but the API does not match
 * exactly the ES-i18n draft.
 *   - https://bugzilla.mozilla.org/show_bug.cgi?id=769872
 *   - http://wiki.ecmascript.org/doku.php?id=globalization:specification_drafts
 *
 * Besides, this `DateTimeFormat' object provides two features that aren't
 * planned in the ES-i18n spec:
 *   - a `toLocaleFormat()' that really works (i.e. fully translated);
 *   - a `fromNow()' method to handle relative dates ("pretty dates").
 *
 * WARNING: this library relies on the non-standard `toLocaleFormat()' method,
 * which is specific to Firefox -- no other browser is supported.
 */

navigator.mozL10n.DateTimeFormat = function(locales, options) {
  var _ = navigator.mozL10n.get;

  // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toLocaleFormat
  function localeFormat(d, format) {
    var tokens = format.match(/(%[E|O|-]?.)/g);

    for (var i = 0; tokens && i < tokens.length; i++) {
      var value = '';

      // http://pubs.opengroup.org/onlinepubs/007908799/xsh/strftime.html
      switch (tokens[i]) {
        // localized day/month names
        case '%a':
          value = _('weekday-' + d.getDay() + '-short');
          break;
        case '%A':
          value = _('weekday-' + d.getDay() + '-long');
          break;
        case '%b':
        case '%h':
          value = _('month-' + d.getMonth() + '-short');
          break;
        case '%B':
          value = _('month-' + d.getMonth() + '-long');
          break;
        case '%Eb':
          value = _('month-' + d.getMonth() + '-genitive');
          break;

        // month without leading zero
        case '%-m':
          value = d.getMonth() + 1;
          break;

        // like %H, but in 12-hour format and without any leading zero
        case '%I':
          value = d.getHours() % 12 || 12;
          break;

        // like %d, without any leading zero
        case '%e':
          value = d.getDate();
          break;

        // %p: 12 hours format (AM/PM)
        case '%p':
          value = d.getHours() < 12 ? _('time_am') : _('time_pm');
          break;

        // localized date/time strings
        case '%c':
        case '%x':
        case '%X':
          // ensure the localized format string doesn't contain any %c|%x|%X
          var tmp = _('dateTimeFormat_' + tokens[i]);
          if (tmp && !(/(%c|%x|%X)/).test(tmp)) {
            value = localeFormat(d, tmp);
          }
          break;

        // other tokens don't require any localization
      }

      format = format.replace(tokens[i], value || d.toLocaleFormat(tokens[i]));
    }

    return format;
  }

  /**
   * Returns the parts of a number of seconds
   */
  function relativeParts(seconds) {
    seconds = Math.abs(seconds);
    var descriptors = {};
    var units = [
      'years', 86400 * 365,
      'months', 86400 * 30,
      'weeks', 86400 * 7,
      'days', 86400,
      'hours', 3600,
      'minutes', 60
    ];

    if (seconds < 60) {
      return {
        minutes: Math.round(seconds / 60)
      };
    }

    for (var i = 0, uLen = units.length; i < uLen; i += 2) {
      var value = units[i + 1];
      if (seconds >= value) {
        descriptors[units[i]] = Math.floor(seconds / value);
        seconds -= descriptors[units[i]] * value;
      }
    }
    return descriptors;
  }

  /**
   * Returns a translated string which respresents the
   * relative time before or after a date.
   * @param {String|Date} time before/after the currentDate.
   * @param {String} useCompactFormat whether to use a compact display format.
   * @param {Number} maxDiff returns a formatted date if the diff is greater.
   */
  function prettyDate(time, useCompactFormat, maxDiff) {
    maxDiff = maxDiff || 86400 * 2; // default = 2 days

    switch (time.constructor) {
      case String: // timestamp
        time = parseInt(time);
        break;
      case Date:
        time = time.getTime();
        break;
    }

    var now = Date.now();
    var secDiff = (now - time) / 1000;
    if (isNaN(secDiff)) {
      return _('incorrectDate');
    }

    if (Math.abs(secDiff) > 60) {
      // round milliseconds up if difference is over 1 minute so the result is
      // closer to what the user would expect (1h59m59s300ms diff should return
      // "in 2 hours" instead of "in an hour")
      secDiff = secDiff > 0 ? Math.ceil(secDiff) : Math.floor(secDiff);
    }

    var today = new Date();
    today.setHours(0,0,0,0);
    var todayMidnight = today.getTime();
    var yesterdayMidnight = todayMidnight - 86400 * 1000;

    const thisyearTimestamp = (new Date(today.getFullYear().toString())).getTime();
    // ex. 11:59 PM or 23:59
    const timeFormat = navigator.mozHour12 ? '%I:%M %p' : '%H:%M';

    if (time < thisyearTimestamp) {
      // before this year, ex. December 31, 2015 11:59 PM
      return localeFormat(new Date(time), '%B %e, %Y ' + timeFormat);
    } else if (time < yesterdayMidnight) {
      // before yesterday and in this year, ex. August 31, 11:59 PM
      return localeFormat(new Date(time), '%B %e, ' + timeFormat);
    } else if (time < todayMidnight) {
      // yesterday
      return _('days-ago-long', {value: 1}) + ', ' + localeFormat(new Date(time), timeFormat);
    } else if (secDiff > 3600 * 4) {
      // today and before 4 hours
      return _('days-ago-long', {value: 0}) + ', ' + localeFormat(new Date(time), timeFormat);
    } else {
      // in 4 hours
      var f = useCompactFormat ? '-short' : '-long';
      var parts = relativeParts(secDiff);

      var affix = secDiff >= 0 ? '-ago' : '-until';
      for (var i in parts) {
        return _(i + affix + f, { value: parts[i]});
      }
    }
  }

  // API
  return {
    localeDateString: function localeDateString(d) {
      return localeFormat(d, '%x');
    },
    localeTimeString: function localeTimeString(d) {
      return localeFormat(d, '%X');
    },
    localeString: function localeString(d) {
      return localeFormat(d, '%c');
    },
    localeFormat: localeFormat,
    fromNow: prettyDate,
    relativeParts: relativeParts
  };
};

define("shared/js/l10n_date", function(){});

// This module declares a dependency on the shared "l10n_date" module which
// itself depends on the shared "l10n" module (see the application's "shim"
// configuration for Alameda). Declaring the dependencies in this way ensures
// that this module exports the "l10n" module's global variable only after both
// shared libraries have been loaded in the correct order.
define('l10n',['shared/js/l10n_date'], function() {
  
  return navigator.mozL10n;
});

define('sounds',['require','exports','module','l10n'],function(require, exports) {
  
  
  var _ = require('l10n').get;

  // Sadly, this is needed because when sound l10n ids change, they no
  // longer match up with the sound filename.
  var DEFAULT_SOUND = 'ac_woody_ogg';
  var SOUND_FILE_TO_L10N_ID = {
    '0': 'noSound',
    'ac_africa.ogg': 'ac_africa_ogg',
    'ac_amazon.ogg': 'ac_amazon_ogg',
    'ac_disco.ogg': 'ac_disco_ogg',
    'ac_fairy_tales.ogg': 'ac_fairy_tales_ogg',
    'ac_fresh.ogg': 'ac_fresh_ogg',
    'ac_galaxy.ogg': 'ac_galaxy_ogg',
    'ac_kai.ogg': 'ac_kai_ogg',
    'ac_techno.ogg': 'ac_techno_ogg',
    'ac_woody.ogg': 'ac_woody_ogg'
  };

  exports.normalizeSound = function(sound) {
    // Since ringtones are stored on the system, they may be
    // version-dependent. Ensure the sound exists (based upon our
    // understanding of the available sounds); if not, default to
    // something else.
    if (sound && !SOUND_FILE_TO_L10N_ID.hasOwnProperty(sound)) {
      return DEFAULT_SOUND;
    } else {
      return sound;
    }
  };

  /**
   * Given a sound ID, return the label to be displayed, for instance,
   * on a FormButton.
   */
  exports.formatLabel = function(sound) {
    return (sound === null || sound === '0') ?
      _('noSound') : _(SOUND_FILE_TO_L10N_ID[sound]);
  };
});

define('constants',['require','exports','module'],function(require, exports) {
  

  // ---------------------------------------------------------
  // Constants

  exports.DAYS_STARTING_MONDAY = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
    'saturday', 'sunday'];

  exports.DAYS_STARTING_SUNDAY = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
    'saturday'];

  exports.DAY_STRING_TO_L10N_ID = {
    'sunday': 'weekday-0-short',
    'monday': 'weekday-1-short',
    'tuesday': 'weekday-2-short',
    'wednesday': 'weekday-3-short',
    'thursday': 'weekday-4-short',
    'friday': 'weekday-5-short',
    'saturday': 'weekday-6-short'
  };

});

define('alarm',['require','exports','module','constants','alarm_database','alarm_database','alarm_database','navObjects','alarm_database'],function(require, exports, module) {
  

  var DAYS_STARTING_SUNDAY = require('constants').DAYS_STARTING_SUNDAY;
  var setCacheTimeout = null;

  /**
   * Alarm represents one alarm instance. It tracks any mozAlarms it
   * has registered, its IndexedDB ID, and any other properties
   * relating to the alarm's schedule and firing options.
   */
  function Alarm(opts) {
    opts = opts || {};
    var now = new Date();
    var defaults = {
      id: null,
      registeredAlarms: {}, // keys: ('normal' or 'snooze') => mozAlarmID
      repeat: {}, // Map like { "monday": true, "tuesday": false, ... }
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
      label: '',
      sound: 'ac_woody.ogg',
      vibrate: true,
      iconFlash: true,
      snooze: 10 // Number of minutes to snooze
    };

    for (var key in defaults) {
      this[key] = (key in opts ? opts[key] : defaults[key]);
    }
  }

  Alarm.prototype = {
    toJSON: function() {
      return {
        id: this.id,
        registeredAlarms: this.registeredAlarms,
        repeat: this.repeat,
        hour: this.hour,
        minute: this.minute,
        second: this.second,
        label: this.label,
        sound: this.sound,
        vibrate: this.vibrate,
        snooze: this.snooze
      };
    },

    /**
     * An alarm is enabled if and only if it has a registeredAlarm set
     * with a type of 'normal'. To disable an alarm, any
     * registeredAlarms are unregistered with mozAlarms and removed
     * from this.registeredAlarms.
     */
    isEnabled: function() {
      for (var i in this.registeredAlarms) {
        // Both 'normal' and 'snooze' registered alarms should be
        // treated as enabled, because the alarm will imminently fire.
        if (i === 'normal' || i === 'snooze') {
          return true;
        }
      }
      return false;
    },

    isRepeating: function() {
      for (var key in this.repeat) {
        if (this.repeat[key]) {
          return true;
        }
      }
      return false;
    },

    getNextAlarmFireTime: function(relativeTo) {
      var now = relativeTo || new Date();
      var nextFire = new Date(now.getTime());
      let nowDate = now.getDate();
      nextFire.setDate(nowDate);
      nextFire.setHours(this.hour, this.minute, this.second, 0);

      while (nextFire <= now ||
             (this.isRepeating() &&
              !this.repeat[DAYS_STARTING_SUNDAY[nextFire.getDay()]])) {
        nextFire.setDate(nextFire.getDate() + 1);
      }
      return nextFire;
    },

    getNextSnoozeFireTime: function(relativeTo) {
      var now = relativeTo || new Date();
      this.snooze = SettingsApp.getValue('alarm.snooze');
      return new Date(now.getTime() + this.snooze * 60 * 1000);
    },

    /**
     * Schedule an alarm to ring in the future.
     *
     * @return {Promise}
     * @param {'normal'|'snooze'} type
     */
    schedule: function(type, date) {
      var alarmDatabase = require('alarm_database'); // circular dependency
      if (this.isRepeating()) {
        this.iconFlash = false;
      }

      var firedate, promise;
      if (type === 'normal') {
        promise = this.cancel(null, 'update'); // Cancel both snooze and regular mozAlarms.
        firedate = this.getNextAlarmFireTime(date);
      } else if (type === 'snooze') {
        promise = this.cancel('snooze', 'update'); // Cancel any snooze mozAlarms.
        firedate = this.getNextSnoozeFireTime();
      } else {
        return Promise.reject('Invalid type for Alarm.schedule().');
      }

      // Save the alarm to the database first. This ensures we have a
      // valid ID, and that we've saved any modified properties before
      // attempting to schedule the alarm.
      return promise.then(() => alarmDatabase.put(this)).then(() => {
        return new Promise((resolve, reject) => {
          // Then, schedule the alarm.
          var req = navigator.mozAlarms.add(firedate, 'ignoreTimezone',
                                            { id: this.id, type: type });
          req.onerror = reject;
          req.onsuccess = (evt) => {
            this.registeredAlarms[type] = evt.target.result;
            resolve();
          };
        });
        // After scheduling the alarm, this.registeredAlarms has
        // changed, so we must save that too.
      }).then(() => alarmDatabase.put(this))
        .then(() => {
          this._notifyChanged(false, 'update');
        }).catch((e) => {
          console.log('Alarm scheduling error: ' + e.toString());
          throw e;
        });
    },

    /**
     * Cancel an alarm. If `type` is provided, cancel only that type
     * ('normal' or 'snooze'). Returns a Promise.
     */
    cancel: function(/* optional */ type, addOrUpdate) {
      var types = (type ? [type] : Object.keys(this.registeredAlarms));
      var alarmDatabase = require('alarm_database'); // circular dependency
      types.forEach((type) => {
        var id = this.registeredAlarms[type];
        navigator.mozAlarms.remove(id);
        delete this.registeredAlarms[type];
      });
      return alarmDatabase.put(this).then(() => {
        this._notifyChanged(false, addOrUpdate);
      }).catch((e) => {
        console.log('Alarm cancel error: ' + e.toString());
        throw e;
      });
    },

    deleteAll: function(type) {
      let alarmDatabase = require('alarm_database'); // circular dependency
      alarmDatabase.getAll().then((alarms) => {
        let deleteArray = new Array();
        for (let i in alarms) {
          let types = Object.keys(alarms[i].registeredAlarms);
          types.forEach((type) => {
            let id = alarms[i].registeredAlarms[type];
            navigator.mozAlarms.remove(id);
            delete alarms[i].registeredAlarms[type];
          });
          let items = alarmDatabase.put(alarms[i], i).then((i) => {
            deleteArray.push(alarmDatabase.delete(alarms[i].id));
          });
          deleteArray.push(items);
        }
        Promise.all(deleteArray).then(() => {
          this.deleteAllNotifyChanged();
        });
      });
    },

    _notifyChanged: function(removed, addOrUpdate) {
      // Only update the application if this alarm was actually saved
      // (i.e. it has an ID).
      if (this.id && this.iconFlash) {
        window.dispatchEvent(
          new CustomEvent(removed ? 'alarm-removed' : 'alarm-changed', {
            detail: { alarm: this, addUpdate: addOrUpdate }
          })
        );

        // Prevent multiple trigger
        clearTimeout(setCacheTimeout);
        setCacheTimeout = setTimeout(() => {
          appStarter.setCache(document.getElementById('alarms'));
        }, 300);
      }
    },

    deleteAllNotifyChanged: function() {
      let NavObjects = require('navObjects');
      if (NavObjects.items['alarm'].deleteAll) {
        window.dispatchEvent(new CustomEvent('alarm-all-removed', {
          detail:{ alarm: this }
        }));
         // Prevent multiple trigger
        clearTimeout(setCacheTimeout);
        setCacheTimeout = setTimeout(() => {
          appStarter.setCache(document.getElementById('alarms'));
        }, 300);
      }
    },

    /**
     * Delete an alarm completely from the database, canceling any
     * pending scheduled mozAlarms.
     */
    delete: function() {
      var alarmDatabase = require('alarm_database'); // circular dependency
      return this.cancel().then(() => {
        return alarmDatabase.delete(this.id).then(() => {
          this._notifyChanged(/* removed = */ true);
        });
      });
    }

  };


  module.exports = Alarm;

});


define('alarm_database',['require','./sounds','alarm','alarm'],function(require) {

  var sounds = require('./sounds');
  /**
   * The AlarmDatabase stores a list of alarms in IndexedDB. All
   * mutation operations return Promises, for easy chaining and state
   * management. This module returns the one-and-only instance of
   * AlarmDatabase.
   */
  function AlarmDatabase(dbName, storeName, version) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = localStorage.indexedDB_version || version;
    this.count = 3;
    window.running = false;

    this._withDatabase = () => {
      return new Promise((resolve, reject) => {
        var request = indexedDB.open(this.dbName, this.version);

        request.onupgradeneeded = (event) => {
          var db = event.target.result;
          // Ensure the object store exists.
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, {
              keyPath: 'id',
              autoIncrement: true
            });
          }
        };

        request.onerror = (() => reject(request.errorCode));
        request.onsuccess = (event) => {
          let db = event.target.result;
          if (db.objectStoreNames.contains(this.storeName)) {
            localStorage.indexedDB_version = this.version;
            resolve(event.target.result)
          } else {
            if(this.count--) {
              db.close();
              db = null;
              this.version++;
              this._withDatabase();
            };
          }
        };
      }).then((db) => {
        // Only return when all of the alarms have been upgraded.
        return new Promise((resolve, reject) => {
          // Go through existing alarms here, and make sure they conform
          // to the latest spec (upgrade old versions, etc.).
          var transaction = db.transaction(this.storeName, 'readwrite');
          var store = transaction.objectStore(this.storeName);
          var cursor = store.openCursor();
          cursor.onsuccess = (event) => {
            var cursor = event.target.result;
            if (cursor) {
              try {
                cursor.continue();
              } catch (e) {
                store.put(this.normalizeAlarmRecord(cursor.value));
                cursor.continue();
                throw new Error('get database fail : ' + e);
              }
            }
          };

          transaction.oncomplete = (() => resolve(db));
          transaction.onerror = ((evt) => reject(evt.target.errorCode));
        });
      }).catch(function(err) {
        window.close();
        // Explicit err.toString() coercion needed to see a message.
        console.error('AlarmDatabase Fatal Error:', err.toString());
      })
    };
    this.withDatabase = this._withDatabase();
  }

  AlarmDatabase.prototype = {

    /**
     * Given an Alarm's JSON data (as returned by IndexedDB),
     * normalize any properties to ensure it conforms to the most
     * current Alarm specification.
     */
    normalizeAlarmRecord: function(alarm) {
      if (!alarm.registeredAlarms) {
        alarm.registeredAlarms = {};
      }

      if (typeof alarm.enabled !== 'undefined') {
        delete alarm.enabled;
      }

      if (typeof alarm.normalAlarmId !== 'undefined') {
        alarm.registeredAlarms.normal = alarm.normalAlarmId;
        delete alarm.normalAlarmId;
      }

      if (typeof alarm.snoozeAlarmId !== 'undefined') {
        alarm.registeredAlarms.snooze = alarm.snoozeAlarmId;
        delete alarm.snoozeAlarmId;
      }

      // Map '1111100' string bitmap to a repeat object with day properties.
      if (typeof alarm.repeat === 'string') {
        var days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday',
                    'saturday', 'sunday'];
        var newRepeat = {};
        for (var i = 0; i < alarm.repeat.length && i < days.length; i++) {
          if (alarm.repeat[i] === '1') {
            newRepeat[days[i]] = true;
          }
        }
        alarm.repeat = newRepeat;
      } else {
        alarm.repeat = alarm.repeat || {};
      }

      // Pre-April-2014 code may have stored 'vibrate' and 'sound' as
      // the string "0", and hour/minute as strings.
      if (typeof SettingsApp === 'undefined') {
        LazyLoader.load('js/settings_app.js', () => {
          SettingsApp.normalizeVibrateAndSoundSettings(alarm, sounds);
        });
      } else {
        SettingsApp.normalizeVibrateAndSoundSettings(alarm, sounds);
      }
      alarm.hour = parseInt(alarm.hour, 10);
      alarm.minute = parseInt(alarm.minute, 10);

      return alarm;
    },

    /**
     * Execute a database store request with the given method and
     * arguments, returning a Promise that will be fulfilled with the
     * Store's result.
     */
    withStoreRequest: function(method /*, args... */) {
      var args = Array.slice(arguments, 1);
      var readmode = (/get/.test(method) ? 'readonly' : 'readwrite');
      return this.withDatabase.then((database) => {
        var store = database
              .transaction(this.storeName, readmode)
              .objectStore(this.storeName);
        if (method === 'getAll') {
          return objectStoreGetAll(store);
        } else {
          return new Promise((resolve, reject) => {
            var request = store[method].apply(store, args);
            request.onsuccess = (() => resolve(request.result));
            request.onerror = () => {
              window.close();
              return reject(request.errorCode);
            }
          });
        }
      });
    },

    put: function(alarm, i) {
      var data = alarm.toJSON();
      if (!data.id) {
        delete data.id; // IndexedDB requires _no_ ID key, not null/undefined.
      }
      return this.withStoreRequest('put', data).then((id) => {
        alarm.id = id;
        return i;
      });
    },

    getAll: function() {
      var Alarm = require('alarm'); // Circular dependency.
      return this.withStoreRequest('getAll').then((alarms) => {
        return alarms.map((data) => new Alarm(data));
      });
    },

    get: function(id) {
      var Alarm = require('alarm'); // Circular dependency.
      return this.withStoreRequest('get', id).then((data) => {
        return new Alarm(data);
      });
    },

    delete: function(id) {
      return this.withStoreRequest('delete', id);
    }
  };


  /**
   * Return all records from an ObjectStore. This function is
   * non-standard, but is such a common pattern that it has actually
   * been included in certain implementations of IndexedDB. It is
   * extracted here for clarity.
   */
  function objectStoreGetAll(objectStore) {
    return new Promise((resolve, reject) => {
      var items = [];
      var cursor = objectStore.openCursor();
      cursor.onerror = reject;
      cursor.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        }
        else {
          resolve(items);
        }
      };
    });
  }

  // For Clock, we only use one database and store, both named 'alarms'.
  // Right now, we're on version 7.
  return new AlarmDatabase('alarms', 'alarms', 7);
});

define('navObjects',['require','alarm_database'],function(require) {
  
  /* global ConfirmDialogHelper */

  var alarmDatabase = require('alarm_database');

  var tabNavigation = {
    isRtl: () => document.documentElement.dir === 'rtl' || document.dir === 'rtl',
    _isLoaded: false,
    init: function(tabs) {
      this.tabs = tabs;
      window.addEventListener('keydown', this.handleEvent.bind(this));
      document.body.addEventListener('keydown', (e) => {
        if (document.querySelector('gaia-confirm')) {
          switch (e.key) {
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'Enter':
            case 'Accept':
              e.preventDefault();
              e.stopPropagation();
              break;
            default:
              break;
          }
        }
      });
    },

    getNextTab: function(evt) {
      var tabIndex = -1;
      var len = this.tabs.links.length;
      for (var i = 0; i < len; i++) {
        if (this.tabs.links[i].getAttribute('aria-selected') === 'true') {
          tabIndex = i;
          break;
        }
      }
      let directions = this.isRtl() ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];

      switch (directions.indexOf(evt.key)) {
        case 0:
          return (tabIndex > 0) ? this.tabs.links[tabIndex - 1] : this.tabs.links[len - 1];
        case 1:
          return (tabIndex > -1 && tabIndex < (len - 1)) ? this.tabs.links[tabIndex + 1] : this.tabs.links[0];
      }
    },

    showReturnConfirm: function() {
      var dialog = new ConfirmDialogHelper({
        type: 'end-key-alarm',
        title: { id: 'kai-confirm-title' },
        body: 'kai-confirm-end-key-body',
        cancel: {
          title: 'Exit',
          l10nId: 'kai-confirm-exit-button',
          callback: () => {
            window.close();
          }
        },
        confirm: {
          title: 'Return',
          l10nId: 'kai-confirm-return-button',
          callback: () => {
          }
        }
      });
      dialog.show(document.body);
    },

    handleEvent: function(event) {
      switch (event.type) {
        case 'keydown':

          var obj = navObjects.getBySelector(NavigationManager.currentSelector);
          switch (event.key) {
            case 'Backspace':
              if (window.running) {
                event.preventDefault();
              }
              var soundSettings = document.getElementById('timersound-settings');
              var soundNewAlarm = document.getElementById('new-alarm-sound');
              if (soundSettings && soundSettings.style.visibility === 'visible') {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent('sound-select-cancel'));
              } else if (soundNewAlarm && soundNewAlarm.style.visibility === 'visible') {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent('new-alarm-sound-cancel'));
              } else if (obj && obj.backAction && !document.getElementsByTagName('gaia-confirm').length) {
                NavigationManager.navObjects.showTabs();
                if (obj.backAction(event)) {
                  event.preventDefault();
                }
              }
              break;
            case 'EndCall':
              var confirmDialog = document.getElementsByTagName('gaia-confirm');
              if (confirmDialog.length &&
                  confirmDialog[0].classList.contains('hide') &&
                  NavigationManager.navObjects.lastNavObject.name === 'alarm_edit' ||
                  !confirmDialog.length &&
                  NavigationManager.navObjects.lastNavObject.name === 'alarm_edit'
              ) {
                event.preventDefault();
                if (typeof ConfirmDialogHelper === 'undefined') {
                  LazyLoader.load([
                    '/shared/elements/gaia_confirm/script.js',
                    '/shared/js/homescreens/confirm_dialog_helper.js'],
                    () => { this.showReturnConfirm(); }
                  );
                } else {
                  this.showReturnConfirm();
                }
              }
              break;
            case 'ArrowLeft':
            case 'ArrowRight':
              if (obj.tabEnable) {
                var tab = this.getNextTab(event);
                if (tab) {
                  NavigationManager.unfocus();
                  NavigationManager.navObjects.lastTab = tab.getAttribute('href');
                  tab.click();
                }
              }
              break;
            case 'ArrowUp':
            case 'ArrowDown':
              var selectedElem = document.querySelector('.focus');
              if (!selectedElem) {
                return;
              }
              var val = event.key === 'ArrowUp' ? 1 : -1;
              switch (selectedElem.id) {
                case 'kai-hours':
                  obj.onChanged(val * 60 * 60);
                  break;
                case 'kai-minutes':
                  obj.onChanged(val * 60);
                  break;
                case 'kai-seconds':
                  obj.onChanged(val);
                  break;
              }
              if (document.activeElement.nodeName === 'INPUT' &&
                  selectedElem.querySelector('input') !== document.activeElement) {
                document.activeElement.blur();
              }
              break;
            default:
              break;
          }
          break;
        default:
          break;
      }
    }
  };

  var alarm = {
    name: 'alarm',
    selector: '.alarm-cell',
    tabEnable: true,
    noAlarms: null,
    backAction: function() {
      return false;
    },
    deleteAll : false,

    showDeleteConfirm: function() {
      navObjects.showConfirmMessageToDelete(function() {
        alarmDatabase.getAll().then((alarms) => {
          try {
            if (alarm.deleteAll) {
              alarms[alarms.length - 1].deleteAll();
              return;
            }
            var alarmId = document.querySelector('.focus').getAttribute('data-id');
            if (alarmId) {
              alarms.find(a => {
                return (a.id == alarmId);
              }).delete();
            }
          } catch (e) {
            console.log(e);
          }
        });
      });
    },

    deleteAction: function(deleteAllFlag) {
      this.deleteAll = false;
      if (deleteAllFlag) {
        this.deleteAll = true;
      }
      if (document.querySelector(this.selector)) {
        if (typeof ConfirmDialogHelper === 'undefined') {
          LazyLoader.load([
            '/shared/elements/gaia_confirm/script.js',
            '/shared/js/homescreens/confirm_dialog_helper.js'],
            () => { this.showDeleteConfirm(); }
          );
        } else {
          this.showDeleteConfirm();
        }
      }
    },

    init: function(reset) {
      NavigationManager.navObjects.lastNavObject = this;
      if (!this.noAlarms) {
        this.noAlarms = document.getElementById('no-alarms-message');
        this.noAlarms.classList.add('hide');
        this.noAlarms.setAttribute('tabindex', 0);
      }
      try {
        if (reset) {
          NavigationManager.reset(this.selector);
        } else {
          NavigationManager.switchContext(this.selector);
        }
      } catch (e) {
        console.log(e);
      }
      this.initMenu();
    },

    initMenu: function() {
      NavigationManager.navObjects.lastNavObject = this;
      if (NavigationManager.currentSelector != this.selector) {
        return;
      }
      alarmDatabase.getAll().then((alarms) => {
        if (alarms.length > 0) {
          var el = Array.prototype.slice.call(document.querySelectorAll(this.selector));
          this.noAlarms.classList.add('hide');
          el = el.find(item => {
            return item.classList.contains('focus')
          });
          if (!el || el == null) {
            return;
          }
          if (window.currentAlarmId === undefined) {
            window.currentAlarmId = el.getAttribute('data-id');
          }
          var action = el.querySelector('[type="checkbox"]').checked ? 'off' : 'on';
          OptionHelper.show('selected-alarm-' + action);
        } else {
          this.noAlarms && this.noAlarms.classList.remove('hide');
          this.noAlarms.focus();
          OptionHelper.show('empty-alarm');
        }
      });
      if (OptionHelper.softkeyPanel && OptionHelper.softkeyPanel.menuVisible) {
        OptionHelper.softkeyPanel.hideMenu();
      }
      NavigationManager.navObjects.showTabs();
    },
  };

  var timer = {
    name: 'timer',
    selector: '#kai-timer-time-display .navigation',
    displayTime:    null,
    displayHours:   null,
    displayMinutes: null,
    displaySeconds: null,
    tabEnable: true,
    currentOptionMenu: null,
    isShowPlus: true,
    timerObj: {
      timer: undefined,
      timerState: {
        INITIAL: 0,
        STARTED: 1,
        PAUSED: 2
      }
    },
    backAction: function() {
      switch (this.currentOptionMenu) {
        case 'timer-start':
        case 'timer-not-init':
          this.initMenu('timer-canceled');
          return true;
        default:
          return false;
      }
    },
    deleteAction: function() {
      if (this.timerObj.timer && this.timerObj.timer.state == this.timerObj.timerState.PAUSED) {
        this.initMenu('timer-canceled');
      }
    },
    setAndShowCurrentOptionMenu: function(menu) {
      this.currentOptionMenu = menu;
      OptionHelper.show(menu);
    },
    initMenu: function(action, time) {
      NavigationManager.navObjects.lastNavObject = this;
      switch (action) {
        case 'timer-canceled':
          OptionHelper.clickButton('#timer-cancel');
          this.tabEnable = true;
          this.setAndShowCurrentOptionMenu('timer-init');
          this.onChanged(0);
          NavigationManager.unfocus();
          break;
        case 'update':
          this.setAndShowCurrentOptionMenu(time > 0 ? 'timer-start' : 'timer-not-init');
          break;
        case 'set':
          this.setAndShowCurrentOptionMenu('timer-not-init');
          break;
        case 'timer-paused':
          OptionHelper.clickButton('#timer-pause');
          this.tabEnable = true;
          this.setAndShowCurrentOptionMenu(
            this.isShowPlus ? 'timer-paused' : 'timer-paused-no-plus'
          );
          break;
        case 'timer-started':
          OptionHelper.clickButton('#timer-start');
          this.tabEnable = true;
          this.setAndShowCurrentOptionMenu(
            this.isShowPlus ? 'timer-started' : 'timer-started-no-plus'
          );
          NavigationManager.unfocus();
          this.onChanged(0);
          break;
        default:
          if (this.timerObj.timer) {
            switch (this.timerObj.timer.state) {
              case this.timerObj.timerState.INITIAL:
                this.setAndShowCurrentOptionMenu('timer-init');
                this.tabEnable = true;
                this.onChanged(0);
                NavigationManager.unfocus();
                break;
              case this.timerObj.timerState.PAUSED:
                this.setAndShowCurrentOptionMenu(
                  this.isShowPlus ? 'timer-paused' : 'timer-paused-no-plus'
                );
                this.tabEnable = true;
                NavigationManager.unfocus();
                break;
              case this.timerObj.timerState.STARTED:
                this.setAndShowCurrentOptionMenu(
                  this.isShowPlus ? 'timer-started' : 'timer-started-no-plus'
                );
                this.onChanged(0);
                this.tabEnable = true;
                NavigationManager.unfocus();
                break;
              default:
                break;
            }
          } else if (this.tabEnable) {
            NavigationManager.reset(this.selector, undefined, 'horizontal');
            NavigationManager.unfocus();
            this.setAndShowCurrentOptionMenu('timer-init');
            this.tabEnable = true;
          }
          break;
      }

      if (this.displayTime && this.displayTime.dataset.time) {
        var timeToDisplay = this.displayTime.dataset.time.split(':');
        this.displayHours.textContent   = (timeToDisplay[0] ? timeToDisplay[0] : 0);
        this.displayMinutes.textContent = (timeToDisplay[1] ? timeToDisplay[1] : 0);
        this.displaySeconds.textContent = (timeToDisplay[2] ? timeToDisplay[2] : 0);
      }

      NavigationManager.navObjects.showTabs();
    },
    init: function(action) {
      NavigationManager.navObjects.lastNavObject = this;
      try {
        switch (action) {
          case 'set':
            var minutesElem = document.getElementById('kai-minutes');
            NavigationManager.reset(this.selector, minutesElem.dataset.navId, 'horizontal');
            this.tabEnable = false;
            this.displayTime.classList.add('focused');
            break;
          case 'unset':
            this.tabEnable = true;
            NavigationManager.unfocus();
            break;
          default:
            NavigationManager.switchContext(this.selector, null, 'horizontal');
            break;
        }
      } catch (e) {
        console.log(e);
      }

      if (!this.displayTime || !this.displayHours || !this.displayMinutes || !this.displaySeconds) {
        this.displayTime    = document.getElementById('kai-timer-time');
        this.displayHours   = document.getElementById('kai-hours');
        this.displayMinutes = document.getElementById('kai-minutes');
        this.displaySeconds = document.getElementById('kai-seconds');
      }
      this.initMenu(action);
    },
  };

  var stopwatch = {
    name: 'stopwatch',
    selector: '.lap-cell',
    tabEnable: true,
    backAction: function() {
      return false;
    },
    deleteAction: function() {
      OptionHelper.clickButton('.stopwatch-reset');
    },
    initMenu: function() {
      NavigationManager.navObjects.lastNavObject = this;
      NavigationManager.navObjects.showTabs();
    },
    init: function() {
      NavigationManager.navObjects.lastNavObject = this;
      try {
        NavigationManager.switchContext(this.selector);
      } catch (e) {
        console.log(e);
      }
      this.initMenu();
    }
  };

  var alarm_edit = {
    name: 'alarm_edit',
    selector: '#edit-alarm li.navigation',
    tabEnable: false,
    backAction: function() {
      navObjects.backToLastTab();
      return true;
    },
    initMenu: function() {
      NavigationManager.navObjects.lastNavObject = this;
      OptionHelper.show('new-alarm');
    },
    init: function() {
      NavigationManager.navObjects.hideTabs();
      NavigationManager.navObjects.lastNavObject = this;
      try {
        NavigationManager.reset(this.selector);
      } catch (e) {
        console.log(e);
      }
      this.initMenu();
    },
  };

  var alarm_settings = {
    name: 'alarm_settings',
    selector: '#settings-alarm li.navigation',
    tabEnable: false,
    backAction: function() {
      navObjects.backToLastTab();
      return true;
    },
    initMenu: function() {
      NavigationManager.navObjects.lastNavObject = this;
      OptionHelper.show('settings-alarm');
    },
    init: function() {
      NavigationManager.navObjects.hideTabs();
      NavigationManager.navObjects.lastNavObject = this;
      try {
        NavigationManager.reset(this.selector);
      } catch (e) {
        console.log(e);
      }
      this.initMenu();
    },
  };

  var navObjects = {
    getBySelector: function(selector) {
      var navObj;
      for (var item in this.items) {
        if (this.items[item].selector === selector) {
          navObj = this.items[item];
          break;
        }
      }
      return navObj;
    },

    getByName: function(name) {
      return this.items[name];
    },

    initTabs: function(tabs) {
      tabNavigation.init(tabs);
    },

    loadPanel: function(panel, callback) {
      var callbackOld = callback;
      var navObj = navObjects.getByName(panel.el.dataset.panelId);
      return function() {
        callbackOld(panel);
        if (navObj) {
          navObj.init();
        }
      };
    },

    setNextAlarmFocus: function() {
      var index;
      var nextEl;
      var el = document.querySelectorAll('.alarm-cell');
      if (el.length === 1) {
        return;
      }
      for (index = 0; index < el.length; index++) {
        if (el[index].classList.contains('focus')) {
          nextEl = index + 1 > el.length - 1 ? el[index - 1] : el[index + 1];
          break;
        }
      }
      NavigationManager.unfocus();
      NavigationManager.setFocus(nextEl);
    },

    onAlarmChanged: function(event) {
      if (NavigationManager.navObjects.lastTab && NavigationManager.navObjects.lastTab.indexOf('alarm') === -1) {
        return;
      }
      var navObj = navObjects.getByName('alarm');
      switch (event.type) {
        case 'alarm-list-changed':
          if (navObj) {
            var lastAlarmId = window.currentAlarmId;
            if (location.hash === '#alarm-panel') {
              navObj.init('reset');
              var item = document.getElementById('alarm-'+lastAlarmId);
              if (item) {
                item.scrollIntoView(false);
                NavigationManager.unfocus();
                NavigationManager.setFocus(item);
              }
            }
          }
          break;
        case 'alarm-removed':
          navObjects.setNextAlarmFocus();
          window.currentAlarmId = document.querySelector('.focus').getAttribute('data-id');
          navObj.initMenu();
          break;
        case 'alarm-all-removed':
          window.currentAlarmId = document.querySelector('.focus').getAttribute('data-id');
          navObj.initMenu();
          break;
        case 'alarm-changed':
        case 'alarm-checked':
          if (event.detail) {
            var alarm = event.detail.alarm;
            window.currentAlarmId = alarm.id;
          }
          navObj.initMenu();
          break;
      }
    },

    onFocusChanged: function(event) {
      var navObj = navObjects.getByName('alarm');
      if (navObj.selector == NavigationManager.currentSelector) {
        if (window.currentAlarmId && document.querySelector('.alarm-cell')) {
          window.currentAlarmId = document.querySelector('.focus').getAttribute('data-id');
        }
        navObj.initMenu();
      }
    },

    clickHandler: function(el) {
      var link;
      if (el.tagName === 'BODY') {
        return;
      } else if (el.tagName.toLowerCase() == 'button') {
        link = el;
      }
      link = link || el.querySelector('a');
      link = link || el.querySelector('button');
      link = link || el.querySelector('input');
      link = link || el.querySelector('select');
      if (link == null) {
        return;
      }
      link.click();
    },

    onanimationEnd: function(event) {
      var navObj = navObjects.getByName('timer');
      if (navObj.selector == NavigationManager.currentSelector) {
        var el = document.getElementById('kai-timer-time-display');
        el.focus();
      }
    },

    backToLastTab: function() {
      NavigationManager.unfocus();
      if (NavigationManager.navObjects.lastTab === '#timer-panel') {
        //switch to timer tab
        location.hash = '#timer-panel';
        NavigationManager.navObjects.lastTab = '#timer-panel';
        NavigationManager.navObjects.tabs.querySelector('a#timer-tab').click();
      } else {
        //switch to alarm tab
        location.hash = '#alarm-panel';
        NavigationManager.navObjects.lastTab = "#alarm-panel";
        NavigationManager.navObjects.tabs.querySelector('a#alarm-tab').click();
      }
    },

    hideTabs: function() {
      if (this.tabs && !this.tabs.classList.contains('hide')) {
        this.tabs.classList.add('hide');
      }
    },

    showTabs: function() {
      if (this.tabs && this.tabs.classList.contains('hide')) {
        this.tabs.classList.remove('hide');
      }
    },

    showConfirmMessageToDelete: function (callback) {
      try {
        var dialog = new ConfirmDialogHelper({
          type: 'delete-alarm',
          title: { id: 'kai-confirm-title' },
          body: alarm.deleteAll ? 'confirm-delete-all-body' : 'kai-confirm-delete-body',
          cancel: {
            title: 'Cancel',
            l10nId: 'kai-cancel',
            callback:() => {}
          },
          confirm: {
            title: 'Delete',
            l10nId: 'kai-delete',
            callback: (callback && typeof callback == 'function') ? callback : () => {}
          }
        });
        dialog.show(document.body);
      } catch(e) {
        console.log(e);
      }
    },

    items: Object.create(null),
    tabs: document.getElementById('clock-tabs')
  };

  navObjects.items['alarm'] = alarm;
  navObjects.items['timer'] = timer;
  navObjects.items['stopwatch'] = stopwatch;
  navObjects.items['alarm_edit'] = alarm_edit;
  navObjects.items['alarm_settings'] = alarm_settings;

  navObjects.init = function() {
    document.addEventListener('focusChanged', this.onFocusChanged.bind(this));
    window.addEventListener('alarm-changed', this.onAlarmChanged.bind(this));
    window.addEventListener('alarm-removed', this.onAlarmChanged.bind(this));
    window.addEventListener('alarm-all-removed', this.onAlarmChanged.bind(this));
    window.addEventListener('alarm-list-changed', this.onAlarmChanged.bind(this));
    window.addEventListener('alarm-checked', this.onAlarmChanged.bind(this));
    window.addEventListener('animationend', this.onanimationEnd.bind(this));

    var lastNavObject = undefined;
  };

  var config = {
    scrollOptions: false,
    clickHandler: navObjects.clickHandler,
  };

  window.NavigationManager.init(config);
  window.NavigationManager.navObjects = navObjects;
  window.NavigationManager.timer = timer;
  return navObjects;
});

define('app',['require','tabs','view','navObjects'],function(require) {


var Tabs = require('tabs');
var View = require('view');
var rAF = window.mozRequestAnimationFrame || window.requestAnimationFrame;
var navObjects = require('navObjects');

/**
 * Global Application event handling and paging
 */
var App = {
  /**
   * Load the Tabs and Panels, attach events and navigate to the default view.
   */
  init: function() {
    this.tabs = new Tabs(document.getElementById('clock-tabs'));

    window.addEventListener('hashchange', this);
    window.addEventListener('visibilitychange', this);
    navObjects.init();
    navObjects.initTabs(this.tabs);

    // Tell audio channel manager that we want to adjust the alarm channel
    // if the user press the volumeup/volumedown buttons in Clock.
    if (navigator.mozAudioChannelManager) {
      navigator.mozAudioChannelManager.volumeControlChannel = 'alarm';
    }

    this.visible = !document.hidden;
    this.panels = Array.prototype.map.call(
      document.querySelectorAll('[data-panel-id]'),
      function(element) {
        var panel = {
          el: element,
          fragment: element.dataset.panelId.replace('_', '-') + '-panel',
          instance: null
        };

        return panel;
      }.bind(this)
    );

    window.performance.mark('navigationLoaded');

    this.navigate({ hash: '#alarm-panel' }, function() {
      // Dispatch an event to mark when we've finished loading.
      // At this point, the navigation is usable, and the primary
      // alarm list tab has begun loading.
      window.performance.mark('navigationInteractive');
    }.bind(this));
    return this;
  },

  /**
   * Load and instantiate the specified panel (when necessary).
   *
   * @param {Object} panel - An object describing the panel. It must contain
   *                         either an `el` attribute (defining the panel's
   *                         containing element) or an `instance` attribute
   *                         (defining the instantiated Panel itself).
   * @param {Function} [callback] - A function that will be invoked with the
   *                                instantiated panel once it is loaded.
   */
  loadPanel: function(panel, callback) {
    callback = navObjects.loadPanel(panel, callback);
    if (panel.instance) {
      callback && setTimeout(callback, 0, panel);
      return;
    }

    var moduleId = 'panels/' + panel.el.dataset.panelId + '/main';

    require([moduleId], function(PanelModule) {
      panel.instance = View.instance(panel.el, PanelModule);
      callback && callback(panel);
    });
  },

  alarmListLoaded: function() {
    // At this point, the alarm list has been loaded, and all facets
    // of Clock are now interactive. The other panels are lazily
    // loaded when the user switches tabs.
    window.performance.mark('contentInteractive');
    window.performance.mark('fullyLoaded');
    navObjects.items['alarm'].init();
    appStarter.hideRootPanel();
    LazyLoader.load(['js/activity.js']);
  },

  /**
   * split each event handler into it's own method
   */
  handleEvent: function(event) {
    var handler = this['on' + event.type];
    if (handler) {
      return handler.apply(this, arguments);
    }
  },

  /**
   * navigate between pages.
   *
   * @param {object} data Options for navigation.
   * @param {string} data.hash The hash of the panel id.  I.E. '#alarm-panel'.
   * @param {function} callback Callback to invoke when done.
   */
  navigate: function(data, callback) {
    let currentHash = this.currentHash;
    let locationHash = data.hash;
    var currentIndex = this.panels.indexOf(this.currentPanel);
    this.panels.forEach(function(panel, panelIndex) {
      if ('#' + panel.fragment === data.hash) {
        this.loadPanel(panel, function() {
          var instance = panel.instance;
          instance.navData = data.data || null;
          instance.active = true;
          instance.visible = true;
          if (this.currentPanel) {
            this.currentPanel.el.classList.add('hidden');
          }

          if (currentHash === '#alarm-settings-panel'
            && (locationHash === '#alarm-panel'
            || locationHash === '#timer-panel')) {
              this.panels[4].instance.stopPreviewSound();
          }
          panel.el.classList.remove('hidden');
          this.currentPanel = panel;
          callback && callback();
        }.bind(this));
      } else {
        if (panel.instance) {
          panel.instance.active = false;
        }
      }

    }, this);
    this.currentHash = data.hash;
  },

  /**
   * Navigate to the new hash.
   */
  onhashchange: function(event) {
    if (this.currentHash === location.hash) {
      return;
    }
    this.navigate({ hash: location.hash });
  },

  showalarmPanel: function() {
    if (location.hash !== '#alarm-panel') {
      location.hash = ( NavigationManager.navObjects.lastTab ?
                          NavigationManager.navObjects.lastTab : '#alarm-panel' );
    }
  },
  /**
   * Whenever the application gains/loses focus, inform the current panel of
   * its visibility loss.
   */
  onvisibilitychange: function(event) {
    this.visible = !document.hidden;
    if (this.currentPanel) {
      this.currentPanel.visible = this.visible;
    }
  }
};

return App;

});



define('startup_init', ['require','app','l10n'],function(require) {

var App = require('app');
var mozL10n = require('l10n');
mozL10n.once(App.init.bind(App));
});

require(['require_config'], function() {
  requirejs(['startup_init']);
});

define("startup", function(){});

define('panel',['require','view'],function(require) {

var View = require('view');
var priv = new WeakMap();

/**
 * A Panel is a "full screen" style tab/dialog.  Panels have an active state
 * which can be true or false, and can transition in and out using CSS3
 * classes and animation events.
 *
 * @constructor
 * @param {HTMLElement} element The element to wrap.
 */
function Panel(element) {
  View.apply(this, arguments);
  priv.set(this, {
    active: element.classList.contains('active'),
    transition: false
  });
  element.addEventListener('animationend', this);
}

Panel.prototype = Object.create(View.prototype);

/**
 * Handles the "animationend" event.  Sets the transition state to false
 * and hides the element if the Panel is not active.
 */
Panel.prototype.handleEvent = function(event) {
  if (event.target !== this.element) {
    return;
  }
  // remove visibility if transition finishes on non-active view
  if (!this.active) {
    this.visible = false;
  }
  this.transition = false;
};

Object.defineProperties(Panel.prototype, {
  /**
   * Panel.prototype.active - Boolean
   *
   * Sets the internal active state, and adds or removes the "active"
   * class on the element.
   */
  active: {
    get: function() {
      return priv.get(this).active;
    },
    set: function(value) {
      var state = priv.get(this);
      value = !!value;
      if (state.active !== value) {
        state.active = value;
        if (value) {
          this.element.classList.add('active');
        } else {
          this.pendingVisible = true;
          this.element.classList.remove('active');
        }
      }
      return value;
    }
  },
  /**
   * Panel.prototype.transition - String or false
   *
   * Sets the internal transition state.  When set, adds the class specified
   * to the element, removing the old transition class if it exists.
   *
   * When set to false, it removes the current transition class.
   */
  transition: {
    get: function() {
      return priv.get(this).transition;
    },
    set: function(value) {
      var state = priv.get(this);
      if (value) {
        if (state.transition) {
          this.element.classList.remove(state.transition);
        }
        this.element.classList.add(value);
      } else if (state.transition) {
        this.element.classList.remove(state.transition);
      }
      state.transition = value;
      return value;
    }
  }
});

return Panel;

});

define('utils',['require','l10n','constants'],function(require) {


var mozL10n = require('l10n');
var constants = require('constants');

var Utils = {
  isShowToast: true
};
// Maintain references to millisecond multipliers
var dateMultipliers = {
  days: 1000 * 60 * 60 * 24,
  hours: 1000 * 60 * 60,
  minutes: 1000 * 60,
  seconds: 1000,
  milliseconds: 1
};
var units = Object.keys(dateMultipliers);

/**
 * Define a singleton method that returns a unified instance
 * based on arguments.
 *
 * @param {function} constructor - A constructor function used
 *        to create a new instance.
 * @param {function} [getKey] - A function called with (arguments),
 *        and returns a lookup key for this singleton.
 * @return {object} - returns the instance either created or retrieved
 *        from the singleton-map by the key.
 */
Utils.singleton = function(constructor, getKey) {
  var singletonMap = new Map();
  return function() {
    var arglist = Array.prototype.slice.call(arguments);
    var key = (typeof getKey === 'function') ? getKey(arglist) : constructor;
    var instance = singletonMap.get(key);
    if (!instance) {
      instance = Object.create(constructor.prototype);
      constructor.apply(instance, arglist);
      singletonMap.set(key, instance);
    }
    return instance;
  };
};

Utils.memoizedDomPropertyDescriptor = function(selector) {
  var memoizedValue = null;
  return {
    get: function() {
      if (memoizedValue === null) {
        memoizedValue = document.querySelector(selector);
      }
      return memoizedValue;
    },
    set: function(value) {
      memoizedValue = value;
    }
  };
};

/**
 * Extend the given prototype object with lazy getters.
 * selectorMap is a mapping of { propertyName: selector }.
 */
Utils.extendWithDomGetters = function(proto, selectorMap) {
  for (var property in selectorMap) {
    Object.defineProperty(proto, property,
      Utils.memoizedDomPropertyDescriptor(selectorMap[property]));
  }
  return proto;
};

Utils.dateMath = {
  /**
   * Convert object literals containing interval length to milliseconds
   *
   * @param {Object|Date|Number} interval An object literal containing days,
   *                                      hours, minutes etc.
   *                                      Optionally a number or date object.
   * @param {Object} opts Options object with a unitsPartial property containing
   *                      (if desired) a restriction on which properties will be
   *                      searched on the interval.
   * @return {Number} Millisecond value for interval length.
   */
  toMS: function(interval, opts) {
    var converted, sign, unitsPartial;

    // if a millisecond interval or a Date is passed in, return that
    if (interval instanceof Date || typeof interval === 'number') {
      return +interval;
    }

    opts = opts || {};
    unitsPartial = opts.unitsPartial || units;
    // Allow for 'hours' or 'hour'
    unitsPartial = unitsPartial.map(function(unit) {
      // String.prototype.endsWith is available in FF17+
      return unit.endsWith('s') ? unit : unit.concat('s');
    });

    // some will exit early when it returns a truthy value
    sign = unitsPartial.some(function(unit) {
      return interval[unit] < 0;
    });
    // Using as a multiplier later
    sign = sign ? -1 : 1;
    // collect passed in units and multiply by their millisecond/unit count
    converted = unitsPartial.map(function(unit) {
      var partial;
      // we're storing the sign out of the iterator
      partial = Math.abs(interval[unit]);
      // A missing property and 0 should be treated the same
      return partial ? partial * dateMultipliers[unit] : 0;
    });

    // add up each millisecond-converted term and multiply total by sign
    return sign * converted.reduce(function(a, b) { return a + b; });
  },
  /**
   * Convert millisecond values to object literals conformable to toMS()
   *
   * @param {Number} interval A millisecond value.
   * @param {Object} [opts] Options object with a unitsPartial property
   *                        containing (if desired) a restriction on which
   *                        properties will be reated for the return value.
   * @return {Object} Object literal with properties as deliniated by opts.
   */
  fromMS: function(interval, opts) {
    var times, sign, unitsPartial;

    opts = opts || {};
    unitsPartial = opts.unitsPartial || units;
    // Allow for 'hours' or 'hour'
    unitsPartial = unitsPartial.map(function(unit) {
      // String.prototype.endsWith is available in FF17+
      return unit.endsWith('s') ? unit : unit.concat('s');
    });
    // For negative intervals (time previous to now)
    // update interval to absolute value and store the sign
    // to apply to all units
    if (interval < 0) {
      sign = -1;
      interval = Math.abs(interval);
    } else {
      sign = 1;
    }

    // divide the time interval by the highest millisecond multiplier
    // store the truncated result and subtract that from the interval
    // update the interval to be the remainder
    times = unitsPartial.map(function(unit, index) {
      var truncated, mult;
      mult = dateMultipliers[unit];
      truncated = Math.floor(interval / mult);
      interval = interval - (truncated * mult);
      // units are either all positive or negative
      // only iterate to needed specificity
      return sign * truncated;
    });

    // Populate the returned object using units as property names
    // and times for values
    return times.reduce(function(out, unitTime, index) {
      out[unitsPartial[index]] = unitTime;
      return out;
    }, {});
  }
};

Utils.extend = function(initialObject, extensions) {
  // extend({}, a, b, c ... d) -> {...}
  // rightmost properties (on 'd') take precedence
  extensions = Array.prototype.slice.call(arguments, 1);
  for (var i = 0; i < extensions.length; i++) {
    var extender = extensions[i];
    for (var prop in extender) {
      var descriptor = Object.getOwnPropertyDescriptor(extender, prop);
      if (descriptor && descriptor.value !== undefined) {
        initialObject[prop] = extender[prop];
      }
    }
  }
  return initialObject;
};

Utils.getLocalizedTimeHtml = function(date) {
  var f = new mozL10n.DateTimeFormat();
  var shortFormat = window.navigator.mozHour12 ?
        mozL10n.get('shortTimeFormat12') :
        mozL10n.get('shortTimeFormat24');
  return f.localeFormat(date, shortFormat);
};

Utils.getLocalizedTimeText = function(date) {
  var f = new mozL10n.DateTimeFormat();
  var shortFormat = window.navigator.mozHour12 ?
        mozL10n.get('shortTimeFormat12') :
        mozL10n.get('shortTimeFormat24');
  return f.localeFormat(date, shortFormat);
};

Utils.changeSelectByValue = function(selectElement, value) {
  var options = selectElement.options;
  for (var i = 0; i < options.length; i++) {
    if (options[i].value == value) {
      if (selectElement.selectedIndex != i) {
        selectElement.selectedIndex = i;
      }
      break;
    }
  }
};

Utils.getSelectedValueByIndex = function(selectElement) {
  return selectElement.options[selectElement.selectedIndex].value;
};

var wakeTarget = {
  requests: {
    cpu: new Map(), screen: new Map(), wifi: new Map()
  },
  locks: {
    cpu: null, screen: null, wifi: null
  },
  timeouts: {
    cpu: null, screen: null, wifi: null
  }
};
function getLongestLock(type) {
  var max = 0;
  for (var i of wakeTarget.requests[type]) {
    var request = i[1];
    if (request.time > max) {
      max = request.time;
    }
  }
  return {
    time: max,
    lock: wakeTarget.locks[type],
    timeout: wakeTarget.timeouts[type]
  };
}
Utils.safeWakeLock = function(opts, fn) {
    /*
     * safeWakeLock
     *
     * Create a Wake lock that is automatically released after
     * timeoutMs. Locks are reentrant, and have no meaningful mutual
     * exclusion behavior.
     *
     * @param {Object} options - an object containing
     *                 [type] {string} a string passed to requestWakeLock
     *                                 default = 'cpu'. This string can be any
     *                                 resource exposed by the environment that
     *                                 this application was designed to run in.
     *                                 Gaia exposes three of them: 'cpu',
     *                                 'screen', and 'wifi'. Certified apps may
     *                                 expose more.
     *                 timeoutMs {number} number of milliseconds to hold
     *                                    the lock.
     * @param {Function} callback - a function to be called after all other
     *                              generated callbacks have been called.
     *                              function ([err]) -> undefined.
     */
  opts = opts || {};
  var type = opts.type || 'cpu';
  var timeoutMs = opts.timeoutMs | 0;
  var now = Date.now();
  var myKey = {};
  wakeTarget.requests[type].set(myKey, {
    time: now + timeoutMs
  });
  var max = getLongestLock(type);
  var unlockFn = function() {
    if (!myKey) {
      return;
    }
    wakeTarget.requests[type]. delete(myKey);
    var now = Date.now();
    var max = getLongestLock(type);
    if (max.time > now) {
      clearTimeout(wakeTarget.timeouts[type]);
      wakeTarget.timeouts[type] = setTimeout(unlockFn, max.time - now);
    } else {
      if (wakeTarget.locks[type]) {
        wakeTarget.locks[type].unlock();
      }
      wakeTarget.locks[type] = null;
      clearTimeout(wakeTarget.timeouts[type]);
      wakeTarget.timeouts[type] = null;
    }
    myKey = null;
  };
  clearTimeout(wakeTarget.timeouts[type]);
  wakeTarget.timeouts[type] = setTimeout(unlockFn, max.time - now);
  try {
    if (!wakeTarget.locks[type] && max.time > now) {
      wakeTarget.locks[type] = navigator.requestWakeLock(type);
    }
    fn(unlockFn);
  } catch (err) {
    unlockFn();
    throw err;
  }
};

Utils.repeatString = function rep(str, times) {
  var built = [], cur = str;
  for (var i = 0, j = 1; j <= times; i++) {
    if ((times & j) > 0) {
      built.push(cur);
    }
    cur = cur + cur;
    j = j << 1;
  }
  return built.join('');
};

Utils.format = {
  hms: function(sec, format) {
    var hour = 0;
    var min = 0;

    if (sec >= 3600) {
      hour = Math.floor(sec / 3600);
      sec -= hour * 3600;
    }

    if (sec >= 60) {
      min = Math.floor(sec / 60);
      sec -= min * 60;
    }

    hour = (hour < 10) ? '0' + hour : hour;
    min = (min < 10) ? '0' + min : min;
    sec = (sec < 10) ? '0' + sec : sec;

    if (typeof format !== 'undefined') {
      format = format.replace('hh', hour);
      format = format.replace('mm', min);
      format = format.replace('ss', sec);

      return format;
    }
    return hour + ':' + min + ':' + sec;
  },
  durationMs: function(ms) {
    var dm = Utils.dateMath.fromMS(ms, {
      unitsPartial: ['minutes', 'seconds', 'milliseconds']
    });
    var puts = function(x, n) {
      x = String(x);
      return Utils.repeatString('0', Math.max(0, n - x.length)) + x;
    };
    return [
      puts(dm.minutes, 2), ':',
      puts(dm.seconds, 2), '.',
      puts((dm.milliseconds / 10) | 0, 2)
    ].join('');
  }
};

Utils.getOnOffValueText = function(value) {
  var _ = mozL10n.get;
  return _(value == 'true' ? 'kai-on' :
           value == 'false' ? 'kai-off' : null);
};

Utils.summarizeDaysOfWeek = function(repeat, noDaysL10n) {
  var days = [];
  if (repeat) {
    for (var day in repeat) {
      if (repeat[day]) {
        days.push(day);
      }
    }
  }

  var _ = mozL10n.get;
  if (days.length === 7) {
    return _('everyday');
  } else if (days.length === 5 &&
             days.indexOf('saturday') === -1 &&
             days.indexOf('sunday') === -1) {
    return _('weekdays');
  } else if (days.length === 2 &&
             days.indexOf('saturday') !== -1 &&
             days.indexOf('sunday') !== -1) {
    return _('weekends');
  } else if (days.length === 0) {
    return _(noDaysL10n);
  } else {
    var weekStartsOnMonday = parseInt(_('weekStartsOnMonday'), 10);
    var allDays = (weekStartsOnMonday ?
                   constants.DAYS_STARTING_MONDAY :
                   constants.DAYS_STARTING_SUNDAY);

    var repeatStrings = [];
    allDays.forEach(function(day, idx) {
      if (days.indexOf(day) !== -1) {
        repeatStrings.push(_(constants.DAY_STRING_TO_L10N_ID[day]));
      }
    });

    // TODO: Use a localized separator.
    return repeatStrings.join(' ');
  }
};

Utils.showToast = function(msgl10nId, msgl10nArgs) {
  if (!Utils.isShowToast) {
    return;
  }
  var options = {
    messageL10nId: msgl10nId,
    messageL10nArgs: (msgl10nArgs === undefined ? null : msgl10nArgs),
    latency: 2000,
    useTransition: true
  };
  if (typeof Toaster === 'undefined') {
    LazyLoader.load(['shared/js/toaster.js', 'shared/style/toaster.css'],
      () => { Toaster.showToast(options); }
    );
  } else {
    Toaster.showToast(options);
  }
};

Utils.deleteItemFromArray = function(arr, item) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].id === item) {
      arr.splice(i, 1);
    }
  }
  return arr;
}

Utils.soundRadioChecked = function(soundSelect, selectClass) {
  var soundLastSelect = document.querySelector(selectClass);
  var soundSelectRadio = soundSelect.querySelector('.clsSoundBackIcon');
  soundLastSelect.classList.toggle('soundChecked', false);
  soundLastSelect.setAttribute('data-icon', 'radio-off');
  soundSelectRadio.classList.toggle('soundChecked', true);
  soundSelectRadio.setAttribute('data-icon', 'radio-on');
};

Utils.soundLabelSet = function(soundLabelData, id) {
  var soundLabel = document.getElementById(id);
  soundLabel.setAttribute('data-l10n-id', soundLabelData);
}

return Utils;

});
define('panels/alarm/alarm_list',['require','alarm_database','utils','l10n','app','navObjects'],function(require) {


var alarmDatabase = require('alarm_database');
var Utils = require('utils');
var _ = require('l10n').get;
var App = require('app');
let NavObjects = require('navObjects');

/**
 * AlarmListPanel displays the list of alarms on the Clock tab.
 */
function AlarmListPanel(element) {
  this.alarms = element;

  this.newAlarmButton.addEventListener(
    'click', this.onClickNewAlarm.bind(this));
  this.AlarmSettingsButton.addEventListener(
    'click', this.onClickAlarmSettings.bind(this));
  this.AlarmEditButton.addEventListener(
    'click', this.onClickAlarmEdit.bind(this));

  alarmDatabase.getAll().then((alarms) => {
    for (var i = 0; alarms && i < alarms.length; i++) {
      this.showAlarm(alarms[i]);
    }
    this.updateAlarmStatusBar();
    App.alarmListLoaded();
  });

  window.addEventListener('moztimechange', this.refresRegistAlarms.bind(this));
  window.addEventListener('languagechange', () => {
    navigator.mozL10n.ready(() => {
      for (let key in this.alarmIdMap) {
        let alarm = this.alarmIdMap[key];
        this.renderAlarm(alarm);
      }
    });
  });

  window.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      let lisDom = this.alarms.querySelectorAll('li');
      let lisArry = [];
      let alarmsArry = [];
      for (let i = 0; i < lisDom.length; i++) {
        lisArry.push(Number(lisDom[i].dataset.id));
      }

      alarmDatabase.getAll().then((alarms) => {
        for (let i in alarms) {
          alarmsArry.push(alarms[i].id);
        }

        if (lisArry.length !== alarmsArry.length ||
          lisArry.sort().toString() !== alarmsArry.sort().toString()) {
          this.alarms.innerHTML = '';
          NavObjects.items['alarm'].initMenu();
          for (let i = 0; alarms && i < alarms.length; i++) {
            this.showAlarm(alarms[i]);
          }
          this.updateAlarmStatusBar();
        }
      })
    }
  });

  window.addEventListener('alarm-checked', this.onAlarmChecked.bind(this));

  window.addEventListener('timeformatchange', this.refreshDisplay.bind(this));

  window.addEventListener('alarm-changed', (evt) => {
    var alarm = evt.detail.alarm;
    this.showAlarm(alarm);
    if (evt.detail.showToast) {
      this.showAlarmCountdownToast(alarm);
    }
    this.updateAlarmStatusBar();
  });
  window.addEventListener('alarm-removed', (evt) => {
    this.removeAlarm(evt.detail.alarm);
    this.updateAlarmStatusBar();
  });
  window.addEventListener('alarm-all-removed', (evt) => {
    this.removeAllAlarm();
    this.updateAlarmStatusBar();
  });
}

AlarmListPanel.prototype = {
  alarmIdMap: {},
  alarmsMaximum: 100,

  refreshDisplay: function(evt) {
    for (var key in this.alarmIdMap) {
      var alarm = this.alarmIdMap[key];
      this.showAlarm(alarm);
    }
  },

  onClickAlarmSettings: function(evt) {
    evt.preventDefault();
    App.navigate({ hash: '#alarm-settings-panel'});
  },

  onAlarmChecked: function(evt) {
    var alarm = this.alarmIdMap[window.currentAlarmId];
    var checked = evt.checked;
    evt.preventDefault();
    this.toggleAlarm(alarm, checked);
  },

  onClickAlarmEdit: function(evt) {
    var alarm = this.alarmIdMap[window.currentAlarmId];
    evt.preventDefault();
    App.navigate({ hash: '#alarm-edit-panel', data: alarm });
  },

  onClickNewAlarm: function(evt) {
    window.performance.mark('clock-display-start');
    evt.preventDefault();
    OptionHelper.softkeyPanel.stopListener();
    alarmDatabase.getAll().then((alarms) => {
      if (alarms.length >= this.alarmsMaximum) {
        Utils.showToast('alarms-maximum');
        OptionHelper.softkeyPanel.startListener();
      } else {
        App.navigate({ hash: '#alarm-edit-panel', data: null });
        if (window.performance.getEntriesByName(
          'clock-display-start', 'mark').length > 0) {
          window.performance.mark('clock-display-end');
          window.performance.measure('performance-display-clock', 'clock-display-start', 'clock-display-end');
          window.performance.clearMarks('clock-display-start');
          window.performance.clearMarks('clock-display-end');
          window.performance.clearMeasures('performance-display-clock');
        }
      }
    });
  },

  /**
   * Render an alarm into a DOM node.
   *
   * @param alarm The alarm to render.
   * @param {Element} [li] Existing element to re-use, if any.
   */
  renderAlarm: function(alarm) {
    var liDom = document.createElement('li');
    liDom.classList.add('alarm-cell');
    liDom.setAttribute('role', 'menuitem');
    liDom.setAttribute('tabindex', 0);
    liDom.innerHTML = ` <label class="alarmList pack-checkbox-large">
                        <input class="input-enable" data-id="" type="checkbox">
                        <span></span>
                        </label>
                        <a class="alarm-item" data-id="">
                          <div class="time p-pri"></div>
                          <div class="label h5"></div>
                          <div class="repeat p-sec"></div>
                        </a>`;
    var li = (this.alarms.querySelector('#alarm-' + alarm.id) ||
              liDom);
    var isActive = ('normal' in alarm.registeredAlarms ||
                    'snooze' in alarm.registeredAlarms);

    var d = new Date();
    d.setHours(alarm.hour);
    d.setMinutes(alarm.minute);
    d.setSeconds(alarm.second);

    li.id = 'alarm-' + alarm.id;
    li.dataset.id = alarm.id;
    li.dataset.time = d;

    var enableButton = li.querySelector('.input-enable');
    enableButton.dataset.id = alarm.id;
    enableButton.checked = isActive;
    li.classList.toggle('check', isActive);

    var link = li.querySelector('.alarm-item');
    link.classList.toggle('with-repeat', alarm.isRepeating());
    link.dataset.id = alarm.id;

    li.querySelector('.time').innerHTML = Utils.getLocalizedTimeHtml(d);
    li.querySelector('.label').textContent = alarm.label || _('alarm');
    li.querySelector('.repeat').textContent = Utils.summarizeDaysOfWeek(alarm.repeat, 'kai-no-repeat');
    return li;
  },

  refreshClockView: function() {
    window.dispatchEvent(new CustomEvent('alarm-list-changed'));
  },

  showAlarm: function(alarm) {
    this.alarmIdMap[alarm.id] = alarm;
    var li = this.renderAlarm(alarm);
    let liTime = new Date(li.dataset.time);
    let liHour = liTime.getHours();
    let liMin = liTime.getMinutes();
    // Go through the list of existing alarms, inserting this alarm
    // before the first alarm that has a lower ID than this one.
    var node = this.alarms.firstChild;

    while (true) {
      if (node) {
        let nodeTime = new Date(node.dataset.time);
        let nodeHour = nodeTime.getHours();
        let nodeMin = nodeTime.getMinutes();
        let result = false;

        if (nodeHour > liHour) {
          result = true;
        } else if (nodeHour === liHour) {
          if (nodeMin >= liMin) {
            result = true;
          }
        }

        if (result && (node.dataset.id !== li.dataset.id)) {
          this.alarms.insertBefore(li, node);
          break;
        }
        node = node.nextSibling;
      } else {
        this.alarms.appendChild(li);
        break;
      }
    }
    this.refreshClockView();
  },

  removeAlarm:  function(alarm) {
    delete this.alarmIdMap[alarm.id];
    var li = this.alarms.querySelector('#alarm-' + alarm.id);
    if (li) {
      li.parentNode.removeChild(li);
      Utils.showToast('kai-alarm-deleted');
    }
    this.refreshClockView();
  },

  removeAllAlarm: function() {
    for (let i in this.alarmIdMap) {
      delete this.alarmIdMap[i];
    }
    this.alarms.innerHTML = '';
    Utils.showToast('alarm-delete-all');
    this.refreshClockView();
  },

  /**
   * Toggle an alarm's enabled state. To ensure that the database
   * state remains consistent with the DOM, perform operations
   * serially in a queue.
   *
   * @param {Alarm} alarm
   * @param {boolean} enabled
   * @param {function} callback Optional callback.
   */
  toggleAlarm: function(alarm, enabled) {
    if (enabled) {
      alarm.schedule('normal').then(() => {
        this.showAlarm(alarm);
        this.updateAlarmStatusBar();

        if (alarm.isEnabled()) {
          this.showAlarmCountdownToast(alarm);
        }
      });
    } else {
      Utils.showToast('kai-alarm-off');
      alarm.iconFlash = true;
      alarm.cancel(null, 'update');
    }
  },

  showAlarmCountdownToast: function(alarm) {
    var timeLeft, tl, localTimes, countdownType, countdownTime;

    timeLeft = +alarm.getNextAlarmFireTime() - Date.now();
    // generate human readable numbers to pass to localization function
    tl = Utils.dateMath.fromMS(timeLeft, {
      unitsPartial: ['days', 'hours', 'minutes']
    });

    // Match properties to localizations string types
    // e.g. minutes maps to nMinutes if there are no hours but
    // nRemainMinutes if hours > 0
    if (tl.days) {
      //countdown-moreThanADay localized only for en-US while 913466 is open
      countdownType = 'countdown-moreThanADay';
      localTimes = [
        ['days', 'nRemainDays', tl.days],
        ['hours', 'nAndRemainHours', tl.hours]
      ];
    } else if (tl.hours > 0) {
      countdownType = 'countdown-moreThanAnHour';
      localTimes = [
        ['hours', 'nHours', tl.hours],
        ['minutes', 'nRemainMinutes', tl.minutes]
      ];
    } else {
      countdownType = 'countdown-lessThanAnHour';
      localTimes = [
        ['minutes', 'nMinutes', tl.minutes]
      ];
    }

    // Create an object to pass to mozL10n.get
    // e.g. {minutes: mozL10n.get('nMinutes', {n: 3})}
    countdownTime = localTimes.reduce(function(lcl, time) {
      lcl[time[0]] = _(time[1], {n: time[2]});
      return lcl;
    }, {});

    Utils.showToast(countdownType, countdownTime);
  },

  refresRegistAlarms: function() {
    navigator.mozAlarms.getAll().then((registalarms)=>{
      let nowDate = new Date();
      for (let i in registalarms) {
        let alarmDate = registalarms[i].date;
        let type = registalarms[i].data.type === 'normal';
        if (alarmDate > nowDate && type) {
          alarmDatabase.getAll().then((alarms) => {
            for (let j in alarms) {
              if (registalarms[i].data.id === alarms[j].id) {
                alarms[j].schedule('normal');
              }
            }
          })
        }
      }
    })
  },

  updateAlarmStatusBar: function() {
    if (navigator.mozSettings) {
      var anyAlarmEnabled = false;
      for (var id in this.alarmIdMap) {
        if (this.alarmIdMap[id].isEnabled()) {
          anyAlarmEnabled = true;
          break;
        }
      }
      navigator.mozSettings.createLock().set({
        'alarm.enabled': anyAlarmEnabled
      });
    }
  }

};

Utils.extendWithDomGetters(AlarmListPanel.prototype, {
  title: '#alarms-title',
  newAlarmButton: '#alarm-new',
  AlarmSettingsButton : '#alarm-settings',
  AlarmEditButton: '#alarm-edit'
});


return AlarmListPanel;

});

/* globals indexedDB */
/**
 * This file defines an asynchronous version of the localStorage API, backed by
 * an IndexedDB database.  It creates a global asyncStorage object that has
 * methods like the localStorage object.
 *
 * To store a value use setItem:
 *
 *   asyncStorage.setItem('key', 'value');
 *
 * If you want confirmation that the value has been stored, pass a callback
 * function as the third argument:
 *
 *  asyncStorage.setItem('key', 'newvalue', function() {
 *    console.log('new value stored');
 *  });
 *
 * To read a value, call getItem(), but note that you must supply a callback
 * function that the value will be passed to asynchronously:
 *
 *  asyncStorage.getItem('key', function(value) {
 *    console.log('The value of key is:', value);
 *  });
 *
 * Note that unlike localStorage, asyncStorage does not allow you to store and
 * retrieve values by setting and querying properties directly. You cannot just
 * write asyncStorage.key; you have to explicitly call setItem() or getItem().
 *
 * removeItem(), clear(), length(), and key() are like the same-named methods of
 * localStorage, but, like getItem() and setItem() they take a callback
 * argument.
 *
 * The asynchronous nature of getItem() makes it tricky to retrieve multiple
 * values. But unlike localStorage, asyncStorage does not require the values you
 * store to be strings.  So if you need to save multiple values and want to
 * retrieve them together, in a single asynchronous operation, just group the
 * values into a single object. The properties of this object may not include
 * DOM elements, but they may include things like Blobs and typed arrays.
 *
 * Unit tests are in apps/gallery/test/unit/asyncStorage_test.js
 */

this.asyncStorage = (function() {
  

  var DBNAME = 'asyncStorage';
  var DBVERSION = localStorage.async_storage_db_ver || 1;
  var STORENAME = 'keyvaluepairs';
  var db = null;
  var count = 3;

  function withDatabase(f) {
    if (db) {
      f();
    } else {
      var openreq = indexedDB.open(DBNAME, DBVERSION);
      openreq.onerror = function withStoreOnError() {
        console.error('asyncStorage: can\'t open database:',
            openreq.error.name);
        window.close();
      };
      openreq.onupgradeneeded = function withStoreOnUpgradeNeeded() {
        // First time setup: create an empty object store
        openreq.result.createObjectStore(STORENAME);
      };
      openreq.onsuccess = function withStoreOnSuccess() {
        db = openreq.result;
        // XXX, for bug 16915. There's case that when first enter
        // some app, but quit (app killed) right between db file created
        // and the asynchronous step to create related object store. Next time
        // enter the app, we have a database with no object store which may
        // lead to malfunctions. Here the workaround is to increase DB version
        // to recreate object store again if not found.

        // Not only asyncStorage, we may have same issue everywhere
        // a new indexDB is created, but chances are rare.
        if (db.objectStoreNames.contains(STORENAME)) {
          localStorage.async_storage_db_ver = DBVERSION;
          f();
        } else {
          if (count--) {
            db.close();
            db = null;
            DBVERSION++;
            withDatabase(f);
          }
        }
      };
    }
  }

  function withStore(type, callback, oncomplete) {
    withDatabase(function() {
      var transaction = db.transaction(STORENAME, type);
      if (oncomplete) {
        transaction.oncomplete = oncomplete;
      }
      callback(transaction.objectStore(STORENAME));
    });
  }

  function getItem(key, callback) {
    var req;
    withStore('readonly', function getItemBody(store) {
      req = store.get(key);
      req.onerror = function getItemOnError() {
        console.error('Error in asyncStorage.getItem(): ', req.error.name);
      };
    }, function onComplete() {
      var value = req.result;
      if (value === undefined) {
        value = null;
      }
      callback(value);
    });
  }

  function setItem(key, value, callback) {
    withStore('readwrite', function setItemBody(store) {
      var req = store.put(value, key);
      req.onerror = function setItemOnError() {
        console.error('Error in asyncStorage.setItem(): ', req.error.name);
      };
    }, callback);
  }

  function removeItem(key, callback) {
    withStore('readwrite', function removeItemBody(store) {
      var req = store.delete(key);
      req.onerror = function removeItemOnError() {
        console.error('Error in asyncStorage.removeItem(): ', req.error.name);
      };
    }, callback);
  }

  function clear(callback) {
    withStore('readwrite', function clearBody(store) {
      var req = store.clear();
      req.onerror = function clearOnError() {
        console.error('Error in asyncStorage.clear(): ', req.error.name);
      };
    }, callback);
  }

  function length(callback) {
    var req;
    withStore('readonly', function lengthBody(store) {
      req = store.count();
      req.onerror = function lengthOnError() {
        console.error('Error in asyncStorage.length(): ', req.error.name);
      };
    }, function onComplete() {
      callback(req.result);
    });
  }

  function key(n, callback) {
    if (n < 0) {
      callback(null);
      return;
    }

    var req;
    withStore('readonly', function keyBody(store) {
      var advanced = false;
      req = store.openCursor();
      req.onsuccess = function keyOnSuccess() {
        var cursor = req.result;
        if (!cursor) {
          // this means there weren't enough keys
          return;
        }
        if (n === 0 || advanced) {
          // Either 1) we have the first key, return it if that's what they
          // wanted, or 2) we've got the nth key.
          return;
        }

        // Otherwise, ask the cursor to skip ahead n records
        advanced = true;
        cursor.advance(n);
      };
      req.onerror = function keyOnError() {
        console.error('Error in asyncStorage.key(): ', req.error.name);
      };
    }, function onComplete() {
      var cursor = req.result;
      callback(cursor ? cursor.key : null);
    });
  }

  return {
    getItem: getItem,
    setItem: setItem,
    removeItem: removeItem,
    clear: clear,
    length: length,
    key: key
  };
}());


define("shared/js/async_storage", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.asyncStorage;
    };
}(this)));

define('timer',['require','shared/js/async_storage','utils','./sounds'],function(require) {


var asyncStorage = require('shared/js/async_storage');
var Utils = require('utils');
var sounds = require('./sounds');

var timerPrivate = new WeakMap();

/**
 * Timer
 *
 * Create new or revive existing timer objects.
 *
 * @param {Object} opts Optional timer object to create or revive
 *                      a new or existing timer object.
 *                 - startTime, number time in ms.
 *                 - duration, time to count from `start`.
 *                 - configuredDuration, time requested by user.
 *                 - sound, string sound name.
 *                 - vibrate, boolean, vibrate or not.
 *                 - id, integer, mozAlarm API id number.
 */
function Timer(opts) {
  opts = opts || {};

  var now = Date.now();
  if (opts.id !== undefined) {
    delete opts.id;
  }
  // private properties
  timerPrivate.set(this, Utils.extend({
    state: Timer.INITIAL
  }, extractProtected(opts)));
  // public properties
  Utils.extend(this, {
    onend: null, // callback when the timer ends
    startTime: now,
    duration: null,
    configuredDuration: null,
    sound: 'ac_woody.ogg',
    vibrate: true
  }, opts);
}

Timer.prototype.constructor = Timer;

/**
 * request - get the persisted Timer object.
 *
 * @param {function} [callback] - called with (err, timer_raw).
 */
Timer.getFromStorage = function(callback) {
  asyncStorage.getItem('active_timer', function(timer) {
    if (timer) {
      // Normalize the timer data. Pre-April-2014 code may have stored
      // 'vibrate' and 'sound' as the string "0".
      SettingsApp.normalizeVibrateAndSoundSettings(timer, sounds);
    }
    callback && callback(null, timer || null);
  });
};

/**
 * singleton - get the unique persisted Timer object.
 *
 * @param {function} [callback] - called with (err, timer).
 */
var timerSingleton = Utils.singleton(Timer);
Timer.singleton = function tm_singleton(callback) {
  Timer.getFromStorage(function(err, obj) {
    var ts = timerSingleton(obj);
    callback && callback(null, ts);
  });
};

function extractProtected(config) {
  var ret = {};
  var protectedProperties = new Set(['state']);
  for (var i in config) {
    if (protectedProperties.has(i)) {
      ret[i] = config[i];
      delete config[i];
    }
  }
  return ret;
}

/**
 * toSerializable - convert `this` to a serialized format.
 *
 * @return {object} - object representation of this Timer.
 */
Timer.prototype.toSerializable = function timerToSerializable() {
  var timer = Utils.extend({}, this, timerPrivate.get(this));

  // Normalize the data. TODO: Perform this normalization immediately
  // at the getter/setter level when this class is refactored.
  SettingsApp.normalizeVibrateAndSoundSettings(timer, sounds);
  return {
    startTime: timer.startTime,
    duration: timer.duration,
    configuredDuration: timer.configuredDuration,
    sound: timer.sound,
    vibrate: timer.vibrate,
    state: timer.state
  };
};

/**
 * save - Save the timer to the database.
 *
 * @param {function} [callback] - callback to call after the timer
 *                                has been saved.
 */
Timer.prototype.save = function timerSave(callback) {
  asyncStorage.setItem('active_timer', this.toSerializable(), function() {
    callback && callback(null, this);
  }.bind(this));
};

/**
 * register - Register the timer with mozAlarm API.
 *
 * @param {function} [callback] - callback to call after the timer
 *                                has been registered.
 */
Timer.prototype.register = function timerRegister(callback) {
  var data = {
    type: 'timer'
  };
  var request;

  // Remove previously-created mozAlarm for this alarm, if necessary.
  this.unregister();

  request = navigator.mozAlarms.add(
    new Date(Date.now() + this.remaining), 'ignoreTimezone', data
  );

  request.onsuccess = (function(ev) {
    this.id = ev.target.result;
    callback && callback(null, this);
  }.bind(this));
  request.onerror = function(ev) {
    callback && callback(ev.target.error);
  };
};

/**
 * commit - save and register the timer as necessary.
 *
 * @param {function} [callback] - callback to call after the timer
 *                                has been registered.
 */
Timer.prototype.commit = function timerCommit(callback) {
  var saveSelf = this.save.bind(this, callback);
  if (this.state === Timer.STARTED) {
    this.register(saveSelf);
  } else {
    if (!this.id) {
      navigator.mozAlarms.getAll().onsuccess = (val) => {
        let findItem = val.target.result.find((item) => {
          return item.data.type === 'timer';
        });
        this.id = findItem.id;
        this.unregister();
        saveSelf();
      }
    } else {
      this.unregister();
      saveSelf();
    }
  }
};

Timer.prototype.unregister = function timerUnregister() {
  if (typeof this.id === 'number') {
    navigator.mozAlarms.remove(this.id);
  }
};

Object.defineProperty(Timer.prototype, 'remaining', {
  get: function() {
    if (this.state === Timer.INITIAL) {
      return this.configuredDuration;
    } else if (this.state === Timer.PAUSED) {
      return this.duration;
    } else if (this.state === Timer.STARTED) {
      if (typeof this.startTime === 'undefined' ||
          typeof this.duration === 'undefined') {
        return 0;
      }
      var r = (this.startTime + this.duration) - Date.now();
      return r >= 0 ? r : 0;
    }
  }
});

Object.defineProperty(Timer.prototype, 'state', {
  get: function() {
    var priv = timerPrivate.get(this);
    return priv.state;
  }
});

Timer.prototype.start = function timerStart() {
  if (this.state !== Timer.STARTED) {
    var priv = timerPrivate.get(this);
    priv.state = Timer.STARTED;
    this.startTime = Date.now();
    this.duration = (typeof this.duration === 'number') ? this.duration :
      this.configuredDuration;
  }
};

Timer.prototype.pause = function timerPause() {
  if (this.state === Timer.STARTED) {
    this.duration = this.remaining; // remaining getter observes private state
    var priv = timerPrivate.get(this);
    priv.state = Timer.PAUSED;
    this.startTime = null;
  }
};

Timer.prototype.cancel = function timerReset() {
  if (this.state !== Timer.INITIAL) {
    var priv = timerPrivate.get(this);
    priv.state = Timer.INITIAL;
    this.startTime = null;
    this.duration = this.configuredDuration;
    this.onend && this.onend();
  }
};

/**
 * plus Increase the duration and extend the endAt time
 *
 * @param {Number} seconds The time in seconds to add.
 *
 * @return {Timer} Timer instance.
 */
Timer.prototype.plus = function timerPlus(seconds) {
  // Convert to ms
  var ms = seconds * 1000;

  this.duration += ms;

  return this;
};

/**
 * Static "const" Timer states.
 */
Object.defineProperties(Timer, {
  INITIAL: { value: 0 },
  STARTED: { value: 1 },
  PAUSED: { value: 2 }
});

return Timer;
});

define('panels/alarm/child_window_manager',['require','utils'],function(require) {
  

  var Utils = require('utils');

  const READY_EVENT_TYPE = 'childWindowReady';

  /**
   * ChildWindowManager maintains the lifecycle of a child attention
   * window. When you instantiate a ChildWindowManager, no window
   * exists yet; use .whenReady() or postMessage() to call up the
   * child window and perform actions on it. Provided the child window
   * calls ChildWindowManager.fireReady(), this class takes care of
   * the bookkeeping to make sure that the child window is ready to
   * receive events before sending over any messages. Similarly, this
   * class acquires a CPU wake lock when opening the window to ensure
   * that your messages are delivered reliably without the phone going
   * to sleep while waiting for the child window to receive a message.
   */
  function ChildWindowManager(url) {
    this.url = url;
    this.childWindow = null;
    this.childWindowReady = false;
    this.childOnReadyCallbacks = [];
    this.releaseCpuLock = null;
    window.addEventListener('message', this);
  }

  ChildWindowManager.prototype = {
    /**
     * Post a message to the child window. If the window is not yet
     * open, acquire a CPU wake lock and open the window, then deliver
     * the message. Subsequent calls to postMessage will similarly
     * wait until the window is ready before delivery.
     */
    postMessage: function(message) {
      this.whenReady(() => {
        this.childWindow.postMessage(message, window.location.origin);
      });
    },

    /**
     * Closes the window. You may reinstantiate a window again by
     * sending another postMessage.
     */
    close: function() {
      window.running = false;
      if (this.childWindow && !this.childWindow.closed) {
        this.childWindow.close();
      }
      this.childWindow = null;
    },

    /**
     * Call a function when the window is ready and opened. This is
     * used internally by postMessage.
     */
    whenReady: function(callback) {
      if (!this.childWindow || this.childWindow.closed) {
        this.childWindow = window.open(this.url, '_blank', 'attention');
        this.childWindowReady = false;
      }
      if (this.childWindowReady) {
        callback();
      } else {
        this.childOnReadyCallbacks.push(callback);
      }
    },

    /** Private. Handle DOM events. */
    handleEvent: function(evt) {
      if (evt.data.type === READY_EVENT_TYPE) {
        this.childWindowReady = true;
        while (this.childOnReadyCallbacks.length) {
          var callback = this.childOnReadyCallbacks.shift();
          callback();
        }
      }
    }
  };

  /**
   * Call this method from a child window when the child has loaded.
   * This fires a message to the parent window, instructing it to pass
   * along any queued events.
   */
  ChildWindowManager.fireReady = function() {
    if (!window.opener) {
      throw new Error('fireReady must be called from the child window.');
    }
    window.opener.postMessage({
      type: READY_EVENT_TYPE
    }, window.location.origin);
  };

  return ChildWindowManager;

});


define('panels/alarm/post_message_proxy',['require'],function(require) {
  var objectMap = {}; // Map of object handlers.
  var responseMap = {}; // Map of callbacks awaiting function results.
  var sequenceNumber = 0; // ID for matching requests to responses.

  var PostMessageProxy = {

    /**
     * Create a PostMessageProxy. This returns an object that you can
     * call like any other JavaScript object, by proxying methods
     * through to another window.
     *
     * When you call a method, rather than returning its return value,
     * it reutrns a Promise that you can resolve to get the return
     * value from the remote function.
     *
     * @param whichWindow The window (usually window.parent or a child)
     * @param objectId A string to identify the object you're proxying
     */
    create: function(whichWindow, objectId) {
      return new Proxy({ window: whichWindow }, {
        get: function(target, name) {
          if (name in target) {
            return target[name];
          }
          return function() {
            var args = Array.slice(arguments);
            return new Promise((resolve, reject) => {
              var responseId = ++sequenceNumber;
              responseMap[responseId] = {
                resolve: resolve,
                reject: reject
              };
              target.window.postMessage({
                postMessageProxy: objectId,
                responseId: responseId,
                fn: name,
                args: args
              }, '*');
            });
          };
        }
      });
    },

    /**
     * On the other window, call PostMessateProxy.receive() to hook up
     * an object that processes messages from a proxy in another window.
     */
    receive: function(objectId, obj) {
      objectMap[objectId] = obj;
    },

    /**
     * Handle 'message' events from postMessage, both when receiving a
     * message to invoke a function call, and receiving a message with
     * the return value of that function call. Both callbacks are
     * handled here so that we only bind one listener for each
     * relevant window.
     */
    _messageHandler: function(evt) {
      var data = evt.data;
      if (data.postMessageProxy) {
        // Remote side (calling a function):
        var obj = objectMap[data.postMessageProxy];
        var { fn, args, responseId } = data;
        try {
          evt.source.postMessage({
            postMessageProxyResult: responseId,
            result: obj[fn].apply(obj, args)
          }, window.location.origin);
        } catch(e) {
          evt.source.postMessage({
            postMessageProxyResult: responseId,
            exception: e.toString(),
            stack: e.stack
          }, evt.origin);
        }
      } else if (data.postMessageProxyResult) {
        // Local side (return value):
        if (responseMap[data.postMessageProxyResult]) {
          var { resolve, reject } = responseMap[data.postMessageProxyResult];
          delete responseMap[data.postMessageProxyResult];
          if (data.exception) {
            var e = new Error();
            e.name = data.exception;
            e.stack = data.stack;
            reject(e);
          } else {
            resolve(data.result);
          }
        }
      }
    }
  };

  window.addEventListener('message', PostMessageProxy._messageHandler);

  return PostMessageProxy;

});

define('panels/alarm/active_alarm',['require','app','alarm_database','timer','utils','./child_window_manager','./post_message_proxy'],function(require) {
  
  var App = require('app');
  var alarmDatabase = require('alarm_database');
  var Timer = require('timer');
  var Utils = require('utils');
  var ChildWindowManager = require('./child_window_manager');
  var PostMessageProxy = require('./post_message_proxy');
  let activityAlarmArray = [];

  /**
   * ActiveAlarm handles the system event that fires when an alarm
   * goes off. This includes opening an attention window and updating
   * an alarm's schedule when the user taps 'snooze'. The interaction
   * is mediated through a PostMessageProxy (as `this.ringView`),
   * which makes it trivial to interact with a JavaScript object
   * hosted in another window.
   */
  function ActiveAlarm() {
    this.alertWindow = new ChildWindowManager(
      window.location.origin + '/onring.html');

    // Handle the system's alarm event.
    navigator.mozSetMessageHandler('alarm', this.onMozAlarm.bind(this));
    window.addEventListener('test-alarm', this.onMozAlarm.bind(this));

    // Handle events transparently from the child window.
    PostMessageProxy.receive('activeAlarm', this);
    this.ringView = PostMessageProxy.create(null, 'ringView');
  }

  ActiveAlarm.prototype = {

    /**
     * Fired when the system triggers an alarm. We acquire a wake lock
     * here to ensure that the system doesn't fall asleep before we
     * have a chance to present the attention alert window.
     */
    onMozAlarm: function(message) {
      this.remoteLock = function (val) {
        let isLocked = val.settingValue && val.settingValue[1];
        if (isLocked) {
          this.ringView.onClickClose();
        }
      }.bind(this);

      let lock = navigator.mozSettings.createLock();
      lock.get('lockscreen.remote-lock').then((value) => {
        let isLocked = value['lockscreen.remote-lock'] &&
          !!value['lockscreen.remote-lock'][1];
        if (!isLocked) {
          navigator.mozSettings.addObserver('lockscreen.remote-lock', this.remoteLock);
          this.alarmTrigger(message);
        }
      });
      if (lock.forceClose) {
        lock.forceClose();
      }
    },

    alarmTrigger: function(message) {

      // message.detail in only for marionette test.
      // We pass it via AlarmActions.fire method.
      var data = message.data || message.detail;
      data.date = message.date || message.detail.date;
      activityAlarmArray.push(data);
      if (data.type === 'timer') {
        NavigationManager.navObjects.items.timer.timerObj.timer = undefined;
      }

      Utils.safeWakeLock({ timeoutMs: 10000 }, () => {
        switch (data.type) {
        case 'normal':
        case 'snooze':
          if (this.alertWindow.childWindow) {
            this.ringView.onClickClose(null, true).then(() => {
              this.onAlarmFired(data);
            });
          }
          if (activityAlarmArray.length > 1) {
            const previousId = activityAlarmArray[0].id;
            this.close(previousId);
            this.onAlarmFired(data);
          } else {
            this.onAlarmFired(data);
          }
          break;
        case 'timer':
          this.onTimerFired(data);
          break;
        }
      });
    },

    /**
     * Add `alert` to the attention screen. The child alert window
     * expects to receive any number of alert messages; if the child
     * window has not been presented yet, this function opens the
     * window before passing along the alert.
     *
     * An Alert object (which can represent a timer or an alarm)
     * adheres to the following structure:
     *
     * @param {Alert} alert An alert to pass to the child window.
     * @param {string} alert.type 'alarm' or 'timer'
     * @param {string} [alert.label] Optional label
     * @param {string} [alert.sound] Optional filename of a sound to play
     * @param {boolean} alert.vibrate True if the alarm should vibrate
     * @param {Date} alert.time The time the alert was supposed to fire
     * @param {string} [alert.id] The ID of the alert, if type === 'alarm'
     */
    popAlert: function(alert) {
      window.running = true;
      this.alertWindow.whenReady(() => {
        this.ringView.window = this.alertWindow.childWindow;
        this.ringView.addAlert(alert);
      });
      this.autoCloseAlarmTimeout = setTimeout(function() {
        this.ringView.onClickClose();
      }.bind(this), 900000);
    },

    /**
     * Handle an alarm firing. Immediately reschedule the alarm for
     * its next firing interval (if the alarm was a repeat alarm).
     *
     * @param {object} message The message as retrieved by mozAlarm
     * @param {function} done Callback to release the wake lock.
     */
    onAlarmFired: function(data) {
      var id = data.id;
      var date = data.date;
      var type = data.type;
      let dateNow = new Date();

      let getTimeNow = '' + dateNow.getFullYear() + dateNow.getMonth()
        + dateNow.getDate();
      let getTimeAlarm = '' + date.getFullYear() + date.getMonth()
        + date.getDate();
      let judgement = false;
      if (getTimeNow === getTimeAlarm) {
        judgement = true;
      }

      let timeDiff = dateNow.getTime() - date.getTime();
      let days = parseInt(timeDiff / (1000 * 60 * 60 * 24));
      let RoundingNum = parseInt(days / 7);
      let remainder = days % 7;
      let latestDate;
      if (RoundingNum > 0) {
        latestDate = dateNow.getTime() - (remainder * 1000 * 60 * 60 * 24);
      } else {
        latestDate = date.getTime();
      }

      alarmDatabase.get(id).then((alarm) => {
        if (judgement && dateNow > date) {
          this.popAlert({
            type: 'alarm',
            label: alarm.label,
            sound: alarm.sound,
            vibrate: alarm.vibrate,
            time: date,
            id: alarm.id
          });
          if (type === 'normal') {
            alarm.cancel(null, 'update');
            if (alarm.isRepeating()) {
              alarm.schedule('normal', date);
            }
          } else if (type === 'snooze') {
            // Inform the Alarm instance that a mozAlarm snooze has fired.
            alarm.cancel('snooze', 'uptate');
          }
        } else {
          if (type === 'normal') {
            date = new Date(latestDate);
            alarm.cancel(null, 'update');
            if (alarm.isRepeating()) {
              alarm.schedule('normal', date);
            }
            activityAlarmArray = Utils.deleteItemFromArray(activityAlarmArray, alarm.id);
          }
        }

      });

    },

    /**
     * Handle a timer firing.
     *
     * @param {object} message The message as retrieved by mozAlarm
     * @param {function} done Callback to release the wake lock.
     */
    onTimerFired: function(data) {
      var type = data.type;
      Timer.getFromStorage((err, timer) => {
        this.popAlert({
          type: 'timer',
          label: timer.label,
          sound: timer.sound,
          vibrate: timer.vibrate,
          time: new Date(timer.startTime + timer.duration)
        });

        if (type === 'timer') {
          Timer.singleton(function(err, timer) {
            if (!err) {
              timer.cancel();
              timer.save();
            }
          });
        }
      });
    },

    /**
     * Snooze the given alarm.
     *
     * @param {string} alarmId The ID of the alarm.
     */
    snoozeAlarm: function(alarmId) {
      if (this.autoCloseAlarmTimeout) {
        clearTimeout(this.autoCloseAlarmTimeout);
      }
      alarmDatabase.get(alarmId).then((alarm) => {
        alarm.schedule('snooze');
      });
      this.ringView.window = null;
      this.alertWindow.close();
      activityAlarmArray = Utils.deleteItemFromArray(activityAlarmArray, alarmId);
    },

    /**
     * Close the current alert window.
     *
     * @param {string} type 'alarm' or 'timer'
     * @param {string} alarmId The ID of the alarm, if type === 'alarm'
     */
    close: function(type, alarmId) {
      navigator.mozSettings.removeObserver('lockscreen.remote-lock', this.remoteLock);
      if (this.autoCloseAlarmTimeout) {
        clearTimeout(this.autoCloseAlarmTimeout);
      }
      this.ringView.window = null;
      this.alertWindow.close();
      activityAlarmArray = Utils.deleteItemFromArray(activityAlarmArray, alarmId);
      var actualHash = NavigationManager.navObjects.lastTab;
      if (actualHash === '#timer-panel' && (type === 'timer' || !type)) {
        App.navigate({ hash: actualHash });
      }
      if (type === 'timer') {
        Timer.singleton(function(err, timer) {
          if (!err) {
            timer.cancel();
            timer.save();
          }
        });
      }
    }
  };

  return ActiveAlarm;
});

define('text',{
  pluginBuilder: './text_builder',
  load: function(name, req, onload, config) {
    
    var url = req.toUrl(name),
        xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.onreadystatechange = function(evt) {
      var status, err;
      if (xhr.readyState === 4) {
        status = xhr.status;
        if (status > 399 && status < 600) {
          //An http 4xx or 5xx error. Signal an error.
          err = new Error(url + ' HTTP status: ' + status);
          err.xhr = xhr;
          onload.error(err);
        } else {
          onload(xhr.responseText);
        }
      }
    };
    xhr.responseType = 'text';
    xhr.send(null);
  }
});


define('text!panels/alarm/panel.html',[],function () { return '<div id="clock-view" role="heading" aria-labelledby="kai-clock-title">\n  <!--  create new alarm icon -->\n  <button id="alarm-new" data-l10n-id="newAlarmButton"></button>\n  <button id="alarm-settings"></button>\n  <button id="alarm-edit"></button>\n  <!-- list of exisiting alarms, to be populated -->\n\n  <div class="p-pri" id="no-alarms-message">\n    <div id="no-alarms-body" data-l10n-id="no-alarms-body"></div>\n    <div id="press-new" data-l10n-id="press-new"></div>\n  </div>\n\n  <ul id="alarms" role="menu"></ul>\n</div>\n';});

define('panels/alarm/main',['require','panel','app','panels/alarm/alarm_list','panels/alarm/active_alarm','text!panels/alarm/panel.html'],function(require) {


var Panel = require('panel');
var App = require('app');
var AlarmListPanel = require('panels/alarm/alarm_list');
var ActiveAlarm = require('panels/alarm/active_alarm');
var html = require('text!panels/alarm/panel.html');

function AlarmPanel() {
  Panel.apply(this, arguments);

  this.element.innerHTML = html;
  App.showalarmPanel();
  this.alarmListPanel = new AlarmListPanel(document.getElementById('alarms'));
  this.activeAlarm = new ActiveAlarm();
}

AlarmPanel.prototype = Object.create(Panel.prototype);

return AlarmPanel;
});
