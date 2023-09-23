requirejs.config({
  // waitSeconds is set to the default here; the build step rewrites
  // it to 0 in build/require_config.jslike so that we never timeout
  // waiting for modules in production. This is important when the
  // device is under super-low-memory stress, as it may take a while
  // for the device to get around to loading things like Clock's alarm
  // ringing screen, and we absolutely do not want that to time out.
  waitSeconds: 0,
  paths: {
    shared: 'http://shared.localhost'
  },
  shim: {
    'http://shared.localhost/js/utils/common/template': {
      exports: 'Template'
    },
    'http://shared.localhost/js/utils/storage/async_storage': {
      exports: 'asyncStorage'
    },
    'http://shared.localhost/js/helper/accessibility_helper': {
      exports: 'AccessibilityHelper'
    },
    'http://shared.localhost/js/utils/l10n/l10n_date':
      ['http://shared.localhost/js/utils/l10n/l10n']
  }
});

define("require_config", function(){});

define('tabs',['require'],function(require) {
'use strict';

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
  LazyLoader.load([
    'http://shared.localhost/js/helper/accessibility/accessibility_helper.js'
  ]).then(() => {
    AccessibilityHelper.setAriaSelected(event.target, this.links);
  });
};


return Tabs;

});

define('view',['require'],function(require) {
'use strict';
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


/* globals define*/
define('sounds',['require','exports','module'],(require, exports) => {

  /*
   * Sadly, this is needed because when sound l10n ids change, they no
   * longer match up with the sound filename.
   */
  const DEFAULT_SOUND = 'ac_woody_ogg';
  const SOUND_FILE_TO_L10N_ID = {
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

  exports.normalizeSound = (sound) => {

    /*
     * Since ringtones are stored on the system, they may be
     * version-dependent. Ensure the sound exists (based upon our
     * understanding of the available sounds); if not, default to
     * something else.
     */
    // eslint-disable-next-line
    if (sound && !SOUND_FILE_TO_L10N_ID.hasOwnProperty(sound)) {
      return DEFAULT_SOUND;
    }
    return sound;

  };

  /**
   * Given a sound ID, return the label to be displayed, for instance,
   * on a FormButton.
   */
  // eslint-disable-next-line
  exports.formatLabel = (sound) => (sound === null || sound === '0'
    ? window.api.l10n.get('noSound')
    : window.api.l10n.get(SOUND_FILE_TO_L10N_ID[sound]));
});

define('alarm',['require','exports','module','alarm_database','alarm_database','alarm_database','navObjects','alarm_database'],function(require, exports, module) {
  'use strict';
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
              !this.repeat[Constants.DAYS_STARTING_SUNDAY[nextFire.getDay()]])) {
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
        promise = this.cancel(null, 'update', true); // Cancel both snooze and regular mozAlarms.
        firedate = this.getNextAlarmFireTime(date);
      } else if (type === 'snooze') {
        promise = this.cancel('snooze', 'update', false); // Cancel any snooze mozAlarms.
        firedate = this.getNextSnoozeFireTime();
      } else {
        return Promise.reject('Invalid type for Alarm.schedule().');
      }

      // Save the alarm to the database first. This ensures we have a
      // valid ID, and that we've saved any modified properties before
      // attempting to schedule the alarm.
      return promise.then(() => alarmDatabase.put(this)).then(() => {

        // Then, schedule the alarm.
        const options = {
          "date": firedate,
          "data": {"id": this.id, type: type},
          "ignoreTimezone": true
        };

        return navigator.b2g.alarmManager.add(options).then((id) => {
          this.registeredAlarms[type] = id;
        });
        // After scheduling the alarm, this.registeredAlarms has
        // changed, so we must save that too.
      }).then(() => alarmDatabase.put(this))
        .then(() => {
          if (type !== 'snooze') {
            this._notifyChanged(false, 'update');
          }
        }).catch((e) => {
          console.log('Alarm scheduling error: ' + e.toString());
          throw e;
        });
    },

    /**
     * Cancel an alarm. If `type` is provided, cancel only that type
     * ('normal' or 'snooze'). Returns a Promise.
     */
    cancel: function(/* optional */ type, addOrUpdate, isNotify) {
      let types = (type ? [type] : Object.keys(this.registeredAlarms));
      let alarmDatabase = require('alarm_database'); // circular dependency
      [].forEach.call(types, (type) => {
        let id = this.registeredAlarms[type];
        navigator.b2g.alarmManager.remove(id);
        delete this.registeredAlarms[type];
      });

      return alarmDatabase.put(this).then(() => {
        if (isNotify) {
          this._notifyChanged(false, addOrUpdate);
        }
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
          [].forEach.call(types, (type) => {
            let id = alarms[i].registeredAlarms[type];
            navigator.b2g.alarmManager.remove(id);
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
          if (typeof appStarter !== 'undefined') {
            appStarter.setCache(document.getElementById('alarms'));
          }
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
          if (typeof appStarter !== 'undefined') {
            appStarter.setCache(document.getElementById('alarms'));
          }
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
      var args = [].slice.call(arguments, 1);
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
  'use strict';
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
            'http://shared.localhost/elements/gaia_confirm/gaia_confirm.js',
            'http://shared.localhost/js/helper/dialog/confirm_dialog_helper.js'],
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
'use strict';

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
    if (navigator.b2g.audioChannelManager) {
      navigator.b2g.audioChannelManager.volumeControlChannel = 'alarm';
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
      this.isExistTimer().then((value) => {
        navigator.b2g.alarmManager.remove(value.id)
        const now = new Date();
        const time = parseInt((value.data.date - now) / 1000);
        this.renderTimerPanel(time);
      })
    }.bind(this));
    return this;
  },

  isExistTimer() {
    return new Promise((resolve) => {
      navigator.b2g.alarmManager.getAll().then((timer)=>{
        for (let i in timer) {
          if (timer[i].data.type === 'timer') {
            resolve(timer[i]);
          };
        }
      })
    })
  },

  renderTimerPanel(time) {
    this.navigate({ hash: '#timer-panel' }, () => {
      NavigationManager.navObjects.lastTab = '#timer-panel';
      NavigationManager.navObjects.tabs.querySelector('a#timer-tab').click();
      setTimeout(() => {
        NavigationManager.navObjects.items.timer.onChanged(time);
        var clickButton = function(selector) {
          var actionButton = document.querySelector(selector);
          if (!actionButton.classList.contains('hidden')) {
            actionButton.click();
            return true;
          }
          return false;
        }
        clickButton('#timer-create');
        window.NavigationManager.navObjects.items.timer.initMenu('timer-started');
      }, 200)
    });
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
    if (typeof appStarter !== 'undefined') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          appStarter.hideRootPanel();
        });
      });
    }
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
    [].forEach.call(this.panels, (panel) => {
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
    asyncStorage.getItem('active_timer', function(timer) {
      if (timer && location.hash == '#timer-panel') {
        if (timer.state ===
            NavigationManager.navObjects.items.timer.timerObj.timerState.INITIAL) {
          NavigationManager.navObjects.items.timer.initMenu('timer-paused');
          NavigationManager.navObjects.items.timer.initMenu('timer-canceled');
        }
      }
    });
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


define('activity_view',['require','app','alarm_database','alarm','navObjects'],(require) => {
  let App = require('app');
  let alarmDatabase = require('alarm_database');
  let Alarm = require('alarm');
  let NavObjects = require('navObjects');
  let actionState = 'error';
  let alarmsArray = [];
  let errorMessage = null;
  let addedAlarmId = null;
  function activityView() {
    this.alerts = [];
  }

  activityView.prototype = {
  
    /**
     * Fired when the system triggers an alarm. We acquire a wake lock
     * here to ensure that the system doesn't fall asleep before we
     * have a chance to present the attention alert window.
     */
    load(activity) {
      console.log('clock load activity')
      this.data = activity.data.source.data;
      this.type = activity.data.source.data.type;
      if (this.type === 'alarm' || this.type === 'timer' ||
        this.type === 'stopwatch') {
        App.navigate({ hash: '#' + this.type + '-panel'});
        NavigationManager.navObjects.lastTab = '#' + this.type + '-panel';
        NavigationManager.navObjects.tabs.querySelector('a#' + this.type +'-tab').click();
        return;
      }

      function done() {
        navigator.serviceWorker.controller.postMessage({
          isError: false,
          activityResult: {
            actionState: actionState,
            alarmsArray: alarmsArray,
            errorMessage: errorMessage,
            addedAlarmId: addedAlarmId
          }
        });
        console.log('alarmsArray', alarmsArray)
        window.close();
      }

      Utils.isShowToast = false;
      if (this.type === 'getall') {
        alarmDatabase.getAll().then((alarms) => {
          alarmsArray = alarms;
          actionState = 'success';
          done();
        }, (e) => {
          errorMessage = e;
          done();
        });
        return;
      }

      if (this.type === 'deleteall') {
        alarmDatabase.getAll().then((alarms) => {
          if (alarms.length > 0) {
            NavObjects.items['alarm'].deleteAll = true;
            alarms[alarms.length - 1].deleteAll();
            actionState = 'success';
          } else {
            errorMessage = 'No Alarm';
          }
          done();
        }, (e) => {
          errorMessage = e;
          done();
        });
        return;
      }

      let alarmData = this.data.alarm;
      let alarmTime = new Date(alarmData.time);
      let alarmRepeat = alarmData.repeat;
      let alarm = new Alarm();
      alarm.hour = alarmTime.getHours();
      alarm.minute = alarmTime.getMinutes();
      alarm.second = alarmTime.getSeconds();
      alarm.repeat = alarmRepeat;
      alarm.label = alarmData.label || '';

      if (this.type === 'add') {
        alarmDatabase.getAll().then((alarms) => {
          if (alarms.length < 100) {
            alarm.schedule('normal').then(() => {
              actionState = 'success';
              addedAlarmId = alarm.id;
              done();
            }, (e) => {
              errorMessage = e;
              done();
            });
          } else {
            errorMessage = 'The alarm number reached maximum of 100';
            done();
          }
        }, (e) => {
          errorMessage = e;
          done();
        });
      } else if (this.type === 'delete') {
        alarmDatabase.getAll().then((alarms) => {
          let alarmId = alarmData.id;
          for (let i in alarms) {
            if (alarms[i].id.toString() === alarmId.toString()) {
              alarms[i].delete();
              actionState = 'success';
              done();
              return;
            }
          }
          errorMessage = 'Do not have this alarm';
          done();
        }, (e) => {
          errorMessage = e;
          done();
        });
      }
    }
  };
  return activityView;
})
;
/* global define */
define('audio_manager',['require'],function(require) {
  'use strict';

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
    return new Promise(resolve => {
      SettingsObserver.getValue(VOLUME_SETTING).then(
        val => {
          console.log(`getSetting success:=${JSON.stringify(val)}`)
          globalVolumeManager._volume = val;
          resolve(val);
        },
        reject => {
          console.log(`getSetting rejected:=${JSON.stringify(reject)}`)
          var DEFAULT_VOLUME = 1.0;
          resolve(DEFAULT_VOLUME);
        }
      );
    });
  }

  function VolumeManager() {
    this.VOLUME_KEY = 'defaultAlarmVolume';
    this.DEFAULT_VOLUME = 1.0;
    this._volume = this.DEFAULT_VOLUME;

    SettingsObserver.observe(
      VOLUME_SETTING, '',
      this.onSystemAlarmVolumeChange.bind(this));
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
      const saveObj = [];
      var opts = {};
      opts.name = VOLUME_SETTING;
      opts.value = volume;
      saveObj.push(opts);
      this._volume = volume;
      SettingsObserver.setValue(saveObj).then(
        val => {
          console.log(
            `saveSettings success:${JSON.stringify(val)}`
          );
        },
        reject => {
          console.log(
            `saveSettings reject:${JSON.stringify(reject)}`
          );
        }
      );
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
     * Play a ringtone from the http://shared.localhost/resources/media/alarms/
     * directory, using the current global volume settings by default.
     * You can override the volume through opts.volume.
     *
     * @param {string} ringtoneName
     * @param {number} opts.volume Value between 0 and 1
     */
    playRingtone: function(ringtoneName, loop) {
      this._prepare(loop); // Load up the audio element.
      this._audio.pause();
      this._audio.src = 'http://shared.localhost/resources/media/alarms/' + ringtoneName;
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

define('timer',['require','./sounds'],function(require) {
'use strict';


 
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
    type: 'timer',
    vibrate: this.vibrate,
    date: new Date(Date.now() + this.remaining),
    sound: this.sound
  };
  var request;

  // Remove previously-created mozAlarm for this alarm, if necessary.
  this.unregister();

  const options = {
    "date": new Date(Date.now() + this.remaining),
    "data": data,
    "ignoreTimezone": true
  };
  request = navigator.b2g.alarmManager.add(options);
  request.then((id) => {
    this.id = id;
    callback && callback(null, this);
  });
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
    this.unregister();
    saveSelf();
  }
};
Timer.prototype.unregister = function timerUnregister() {
  if (typeof this.id === 'number') {
    navigator.b2g.alarmManager.remove(this.id);
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
  },
  set: function(value) {
    var priv = timerPrivate.get(this);
    priv.state = value;
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

define('activeAlarm',['require','audio_manager','app','alarm_database','timer'],(require) => {
  let AudioManager = require('audio_manager');
  let App = require('app');
  let alarmDatabase = require('alarm_database');
  let Timer = require('timer');
  let activityAlarmArray = [];
  let snoozeButton = document.getElementById('ring-button-snooze');
  let closeButton = document.getElementById('ring-button-stop');
  let ringLabel = document.getElementById('ring-label');
  let time = document.getElementById('ring-clock-time');
  const WAKE_DURATION = 600000;
  window.HTML_CACHE_VERSION = '1.2';

  function ActiveAlarm() {
    let onInterrupt = this.onInterrupt.bind(this);
    this.alerts = [];
    this._flipManager = null;
    this.ringtonePlayer = AudioManager.createAudioPlayer({
      interruptHandler: onInterrupt
    });

    snoozeButton.addEventListener('click', this.onClickSnooze.bind(this));
    closeButton.addEventListener('click', this.onClickClose.bind(this));
    window.addEventListener('beforeunload', this.onBeforeUnload.bind(this));
    window.addEventListener('timeformatchange', this.refreshDisplay.bind(this));
    navigator.b2g.getFlipManager && navigator.b2g.getFlipManager().then((fm) => {
      this._flipManager = fm;
      this._flipManager.addEventListener('flipchange', this.onFlipEvent.bind(this));
    });
  }

  ActiveAlarm.prototype = {

    /**
     * Fired when the system triggers an alarm. We acquire a wake lock
     * here to ensure that the system doesn't fall asleep before we
     * have a chance to present the attention alert window.
     */
    onRecieveAlarm(path) {
      let htmlPath = path || location.hash;
      DebugHelper.debug(`clock Attention window: onRecieveAlarm --- ${htmlPath}`);
      let typeIndex = htmlPath.indexOf('&');
      let dateIndex = htmlPath.indexOf('@');
      this.id = Number(htmlPath.substring(1, typeIndex));
      this.type = htmlPath.substring(typeIndex + 1, dateIndex);
      this.date = Number(htmlPath.substr(dateIndex + 1));
      this.date = new Date(this.date);

      window.isOpenClockAttentionScreen = true;
      navigator.serviceWorker.controller.postMessage({
        clockAttentionWindowReady: true
      });

      this.remoteLock = (val) => {
        const isLocked = val[0] && val[1];
        if (isLocked) {
          this.onClickClose();
        }
      };
      SettingsObserver.observe('lockscreen.remote-lock','',
        this.remoteLock, true);
      this.alarmTrigger();
    },

    alarmTrigger() {
      /*
        * Message.detail in only for marionette test.
        * We pass it via AlarmActions.fire method.
        */
      Utils.safeWakeLock({ timeoutMs: 10000 }, () => {
        switch (this.type) {
          case 'normal':
          case 'snooze':
            this.onAlarmFired();
            break;
          case 'timer':
            this.onTimerFired();
            break;
          default: break;
        }
      })
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
    popAlert(alert) {
      window.running = true;
      this.addAlert(alert);
      this.autoCloseAlarmTimeout = setTimeout(() => {
        this.onClickClose();
      }, 900000);
    },

    /**
     * Handle an alarm firing. Immediately reschedule the alarm for
     * its next firing interval (if the alarm was a repeat alarm).
     *
     * @param {object} message The message as retrieved by mozAlarm
     * @param {function} done Callback to release the wake lock.
     */
    onAlarmFired() {
      let date = new Date(this.date);
      alarmDatabase.get(this.id).then((alarm) => {
        this.popAlert({
          type: 'alarm',
          label: alarm.label,
          sound: alarm.sound,
          vibrate: alarm.vibrate,
          id: this.id
        });
        if (this.type === 'normal') {
          if (alarm.isRepeating()) {
            alarm.schedule('normal', date);
          } else {
            alarm.cancel(null, 'update', false).then(() => {
              navigator.b2g.alarmManager.getAll().then((alarms) => {
                if (!alarms.length && !alarm.isRepeating()) {
                  SettingsObserver.setValue([
                    {
                    name: 'alarm.enabled',
                    value: false
                    }
                  ]);
                }
              })
            });
          }
        } else if (this.type === 'snooze') {
          // Inform the Alarm instance that a mozAlarm snooze has fired.
          alarm.cancel('snooze', 'update', false).then(() => {
            navigator.b2g.alarmManager.getAll().then((alarms) => {
              if (!alarms.length && !alarm.isRepeating()) {
                SettingsObserver.setValue([
                  {
                  name: 'alarm.enabled',
                  value: false
                  }
                ]);
              }
            })
          });
        }
      });

    },

    /**
     * Handle a timer firing.
     *
     * @param {object} message The message as retrieved by mozAlarm
     * @param {function} done Callback to release the wake lock.
     */
    onTimerFired() {
      Timer.getFromStorage((err, timer) => {
        DebugHelper.debug(`Attention window: Timer ${JSON.stringify(timer)}`);
        this.popAlert({
          type: 'timer',
          label: timer.label,
          sound: timer.sound,
          vibrate: timer.vibrate,
          time: new Date(timer.startTime + timer.duration)
        });

        if (this.type === 'timer') {
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
    snoozeAlarm(alarmId) {
      if (this.autoCloseAlarmTimeout) {
        clearTimeout(this.autoCloseAlarmTimeout);
      }
      alarmDatabase.get(alarmId).then((alarm) => {
        alarm.schedule('snooze').then(() => {
          SettingsObserver.setValue([
            {
            name: 'alarm.enabled',
            value: true
            }
          ]);
          window.close();
          this.postToService();
        });
      });
      activityAlarmArray = Utils.deleteItemFromArray(activityAlarmArray,
        alarmId);
    },

    postToService() {
      navigator.serviceWorker.controller.postMessage({
        clockAttentionWindowReady: false,
        openAttentionTag: false
      });
      window.isOpenClockAttentionScreen = false;
    },

    /**
     * Close the current alert window.
     *
     * @param {string} type 'alarm' or 'timer'
     * @param {string} alarmId The ID of the alarm, if type === 'alarm'
     */
    close(type, alarmId) {
      if (this.autoCloseAlarmTimeout) {
        clearTimeout(this.autoCloseAlarmTimeout);
      }
      activityAlarmArray = Utils.deleteItemFromArray(activityAlarmArray,
        alarmId);
      let actualHash = NavigationManager.navObjects.lastTab;
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
        NavigationManager.navObjects.items.timer.timerObj.timer = undefined;
      }
    },

    /**
     * Fire the notification for an alarm or timer.
     *
     * Presently, we only display one notification at a time, and the
     * _most recent_ one at that. Each notification gets its own wake
     * lock, ensuring that the screen will remain on for WAKE_DURATION.
     *
     * @param {string} alert.type 'alarm' or 'timer'
     * @param {string} alert.label Label to display (optional).
     * @param {string} alert.sound Filename of a sound to play (optional).
     * @param {boolean} alert.vibrate True if the alert should vibrate.
     */
    addAlert: function(alert) {
      // If we previously had an alert visible, this one is
      // going to override it, as though the previous alert was
      // dismissed.
      if (this.alerts.length) {
        var oldAlert = this.alerts.shift();
        oldAlert.releaseScreenWakeLock();
      }

      alert.releaseScreenWakeLock = function() { };

      // Insert this alert at the front of the stack, so that it
      // overrides any previous alert that was being displayed.
      this.alerts.unshift(alert);

      this.refreshDisplay();

      // Acquire a CPU wake lock so that we don't fall asleep waiting
      // for the document to become visible. We'll only try to hold a
      // lock for a few seconds as we wait for the document to become
      // visible, out of an abundance of caution.

      // Mark, need request safeWakeLock
      Utils.safeWakeLock({ type: 'cpu', timeoutMs: 5000 }, (releaseCpu) => {
        // When the document is visible, acquire a screen wake lock so
        // that we can safely display the alert.
        this.whenVisible(() => {
            Utils.safeWakeLock({ type: 'screen', timeoutMs: WAKE_DURATION },
                               (releaseScreenWakeLock) => {
              // Once we have acquired the screen wake lock, we can
              // release the CPU lock.
              releaseCpu();

              // Save off the screen wake lock for when we dismiss the
              // alert; all alarms each have their own screen wake lock.
              alert.releaseScreenWakeLock = releaseScreenWakeLock;
          });
        });
      });
    },

    updateMenu: function(clockType) {
      if( clockType === 'alarm') {
        OptionHelper.show('alarmMenu');
      } else if (clockType === 'timer') {
        OptionHelper.show('timerMenu');
      }
      window.clockType = clockType;
    },

    /**
     * Update the display to show the currently active alert. If there
     * are a stack of alerts pending, only the most recent alert is
     * shown, as added to this.alerts by this.addAlert().
     */
    refreshDisplay: function() {
      // First, silence any existing sound or vibration. If a previous
      // alarm was going off, this alarm may have different settings.
      // The new alarm will replace any prior settings.
      this.silence();

      var alert = this.alerts[0];

      if (!alert) {
        return;
      }
      // Set the label (blank or falsey becomes a default string).
      if (alert.label) {
        ringLabel.removeAttribute('data-l10n-id');
        ringLabel.textContent = alert.label;
      } else {
        ringLabel.setAttribute('data-l10n-id',
                                    alert.type === 'alarm' ? 'alarm' : 'timer');
      }
      this.updateMenu(alert.type);

      // Display the proper screen widgets.
      // this.ringDisplay.dataset.ringType = alert.type;

      alert.time = new Date();

      // Set the time to display.
      time.innerHTML = Utils.getLocalizedTimeHtml(alert.time);
      if (alert.sound) {
        this.ringtonePlayer.playRingtone(alert.sound, true);
      }

      // Vibrate if we want to shakey shakey.
      if (alert.vibrate && ('vibrate' in navigator)) {
        clearInterval(this.vibrateInterval);
        var vibrateOnce = function() {
          navigator.vibrate([1000]);
        };
        this.vibrateInterval = setInterval(vibrateOnce, 2000);
        vibrateOnce();
      }

      document.documentElement.classList.add('ready');
    },

    /**
     * Stop all sounds and vibration immediately.
     */
    silence: function() {
      // Stop the alert sound, if one was playin'.
      this.ringtonePlayer.pause();

      // Stop vibrating, if we were shakin'.
      clearInterval(this.vibrateInterval);
      this.vibrateInterval = null;
    },

    /**
     * Resume vibration immediately.
     */
    vibrateResume: function() {
      var alert = this.alerts[0];
      if (alert.vibrate && ('vibrate' in navigator)) {
        clearInterval(this.vibrateInterval);
        var vibrateOnce = function() {
          navigator.vibrate([1000]);
        };
        this.vibrateInterval = setInterval(vibrateOnce, 2000);
        vibrateOnce();
      }
    },

    /**
     * Stop vibration immediately.
     */
    vibrateStop: function() {
      clearInterval(this.vibrateInterval);
      this.vibrateInterval = null;
    },

    /**
     * Handle an interrupt as reported from the Audio player. This could
     * happen if an incoming call arrives while the alert is ringing. We
     * should silence our alarm to allow the phone call to take
     * precedence.
     */
    onInterrupt: function(evt, opt) {
      if (opt === 'stop') {
        this.vibrateStop();
      } else {
        this.vibrateResume();
      }
    },

    /**
     * Clean up any state when we close this alert window. This includes
     * silencing the alarm and releasing any locks we have acquired.
     */
    onBeforeUnload: function(evt) {
      // Clean up any wake locks we still have.
      while (this.alerts.length) {
        var alert = this.alerts.shift();
        alert.releaseScreenWakeLock();
      }
      this.silence();
    },

    /**
     * Snooze the current alarm. (The snooze button is only visible for
     * alarms, not timers. Alarms have an ID; timers do not.)
     */
    onClickSnooze: function(evt) {
      var alert = this.alerts[0];
      this.snoozeAlarm(alert.id);
    },

    /**
     * Close this window, notifying ActiveAlarm, which will pop the user
     * back to the appropriate location if they are still using the
     * Clock app.
     */
    onClickClose: function(evt, keepWindowOpen) {
      this.close(this.type, this.id);
      let cache = window.localStorage.getItem('cache_context') || '';
      if (this.id && cache && cache.indexOf(`cacheAlarm-${this.id}`)) {
        let cacheDom = document.createElement('div');
        let cacheList = cache.split('@');
        if (window.HTML_CACHE_VERSION !== cacheList[1]) {
          return;
        }
        cacheDom.innerHTML = cacheList[4];
        let currantAlarmLi = cacheDom.querySelector(`#cacheAlarm-${this.id}`);
        if (currantAlarmLi) {
          let inputDom = currantAlarmLi.querySelector('.input-enable');
          let ischecked = inputDom.getAttribute('checked');
          if (ischecked) {
            inputDom.removeAttribute('checked');
            currantAlarmLi.classList.remove('check');
            let firstLiId = cacheDom.querySelector('#over-alarms').children[0].id;
            if (firstLiId === `cacheAlarm-${this.id}`) {
              const softKeyObj = JSON.parse(cacheList[3]);
              softKeyObj.center = window.api.l10n.get('turnOn');
              cacheList[3] = JSON.stringify(softKeyObj);
            }
          };
          let cacheContext = cacheList[0] + '@' + cacheList[1] + '@' + cacheList[2] + '@'
            + cacheList[3] + '@' + cacheDom.innerHTML;
          window.localStorage.setItem('cache_context', cacheContext);
        }

        cacheDom.innerHTML = '';
        cacheDom = null;
      }
      if (!keepWindowOpen) {
        window.close();
        this.postToService();
      }
    },

    onFlipEvent: function(evt) {
      if (this._flipManager && !this._flipManager.flipOpened) {
        this.onClickClose(evt);
      }
    },

    /**
     * Call the callback when `document.hidden` is false. Due to a bug
     * in the B2G Browser API <https://bugzil.la/810431>, the window may
     * not be immediately visible, particularly if the screen is off.
     * The recommended workaround for that bug was to use setTimeout. If
     * the page is still hidden after that, we listen for
     * `visibilitychange`. When that bug has some action, we should
     * revisit how much of this method is needed.
     */
    whenVisible: function(cb) {
      if (!document.hidden) {
        cb();
      } else {
        setTimeout(() => {
          if (!document.hidden) {
            cb();
          } else {
            var listener = function(e) {
              if (!document.hidden) {
                document.removeEventListener('visibilitychange', listener);
                cb();
              }
            };
            document.addEventListener('visibilitychange', listener);
          }
        });
      }
    }
  };
  return ActiveAlarm;
})

;


define('startup_init', ['require','app','activity_view','activeAlarm'],function(require) {

  var App = require('app');
  var ActivityView = require('activity_view');
  var ActiveAlarm = require('activeAlarm');
  if (window.clockActivity) {
    let activityView = new ActivityView();
    activityView.load(window.activityMessage);
  }
  if (!window.receiveMsg) {
    window.api.l10n.once(App.init.bind(App));
  } else {
    DebugHelper.debug(`clock Attention window startup: new ActiveAlarm`);
    let activeAlarm = new ActiveAlarm();
    activeAlarm.onRecieveAlarm();
    window.addEventListener('clock-receive-message', () => {
      let secActiveAlarm = new ActiveAlarm();
      secActiveAlarm.onRecieveAlarm(window.message);
    });
  }

});

require(['require_config'], function() {
  requirejs(['startup_init']);
});

define("startup", function(){});

define('panel',['require','view'],function(require) {
'use strict';
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


/* globals define, SettingsObserver, Utils, OptionHelper*/

define('panels/alarm/alarm_list',['require','alarm_database','app','navObjects'],(require) => {
  const alarmDatabase = require('alarm_database');
  const App = require('app');
  const NavObjects = require('navObjects');

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
      // eslint-disable-next-line
      const length = alarms.length;
      if (length > 0) {
        for (let i = 0; i < length - 1; i++) {
          this.showAlarm(alarms[i], true);
        }
        this.showAlarm(alarms[length - 1]);
      }
      this.updateAlarmStatusBar();
      App.alarmListLoaded();
    });

    window.addEventListener('languagechange', () => {
      window.api.l10n.change(() => {
        // eslint-disable-next-line
        for (let key in this.alarmIdMap) {
          const alarm = this.alarmIdMap[key];
          this.renderAlarm(alarm);
        }
      });
    });

    window.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        asyncStorage.getItem('active_timer', function(timer) {
          if (timer && location.hash == '#timer-panel') {
            if (timer.state ===
                NavigationManager.navObjects.items.timer.timerObj.timerState.INITIAL) {
              NavigationManager.navObjects.items.timer.initMenu('timer-paused');
              NavigationManager.navObjects.items.timer.initMenu('timer-canceled');
            }
          }
        });

        alarmDatabase.getAll().then((alarms) => {
          const length = alarms.length;
          if (length > 0) {
            for (let i = 0; i < length - 1; i++) {
              this.showAlarm(alarms[i], true);
            }
            this.showAlarm(alarms[length - 1]);
          }
          this.updateAlarmStatusBar();
          this.refreshClockView();
        });
      }
    });

    window.addEventListener('alarm-checked', this.onAlarmChecked.bind(this));

    window.addEventListener('timeformatchange', this.refreshDisplay.bind(this));

    window.addEventListener('alarm-changed', (evt) => {
      const { alarm } = evt.detail;
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
    window.addEventListener('alarm-all-removed', () => {
      this.removeAllAlarm();
      this.updateAlarmStatusBar();
    });
  }

  AlarmListPanel.prototype = {
    alarmIdMap: {},
    alarmsMaximum: 100,

    refreshDisplay() {
      // eslint-disable-next-line
      for (let key in this.alarmIdMap) {
        const alarm = this.alarmIdMap[key];
        this.showAlarm(alarm);
      }
    },

    onClickAlarmSettings(evt) {
      evt.preventDefault();
      App.navigate({ hash: '#alarm-settings-panel' });
    },

    onAlarmChecked(evt) {
      const alarm = this.alarmIdMap[window.currentAlarmId];
      const { checked } = evt;
      evt.preventDefault();
      this.toggleAlarm(alarm, checked);
    },

    onClickAlarmEdit(evt) {
      const alarm = this.alarmIdMap[window.currentAlarmId];
      evt.preventDefault();
      App.navigate({ hash: '#alarm-edit-panel', data: alarm });
    },

    onClickNewAlarm(evt) {
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
            window.performance.measure('performance-display-clock',
              'clock-display-start', 'clock-display-end');
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
    renderAlarm(alarm) {
      const liDom = document.createElement('li');
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
      const li = this.alarms.querySelector(`#alarm-${alarm.id}`) ||
              liDom;
      const isActive = 'normal' in alarm.registeredAlarms ||
                    'snooze' in alarm.registeredAlarms;
      const d = new Date();
      d.setHours(alarm.hour);
      d.setMinutes(alarm.minute);
      d.setSeconds(alarm.second);

      li.id = `alarm-${alarm.id}`;
      li.dataset.id = alarm.id;
      li.dataset.time = d;

      const enableButton = li.querySelector('.input-enable');
      enableButton.dataset.id = alarm.id;
      enableButton.setAttribute('checked', isActive);
      enableButton.checked = isActive;
      li.classList.toggle('check', isActive);

      const link = li.querySelector('.alarm-item');
      link.classList.toggle('with-repeat', alarm.isRepeating());
      link.dataset.id = alarm.id;

      li.querySelector('.time').innerHTML = Utils.getLocalizedTimeHtml(d);
      li.querySelector('.label').textContent = alarm.label ||
        window.api.l10n.get('alarm');
      li.querySelector('.repeat').textContent = Utils
        .summarizeDaysOfWeek(alarm.repeat, 'kai-no-repeat');
      return li;
    },

    refreshClockView() {
      window.dispatchEvent(new CustomEvent('alarm-list-changed'));
    },

    showAlarm(alarm, notRefresh) {
      this.alarmIdMap[alarm.id] = alarm;
      const li = this.renderAlarm(alarm);
      const liTime = new Date(li.dataset.time);
      const liHour = liTime.getHours();
      const liMin = liTime.getMinutes();

      /*
       * Go through the list of existing alarms, inserting this alarm
       * Before the first alarm that has a lower ID than this one.
       */
      let node = this.alarms.firstChild;
      // eslint-disable-next-line
      while (true) {
        if (node) {
          const nodeTime = new Date(node.dataset.time);
          const nodeHour = nodeTime.getHours();
          const nodeMin = nodeTime.getMinutes();
          let result = false;

          if (nodeHour > liHour) {
            result = true;
          } else if (nodeHour === liHour) {
            if (nodeMin >= liMin) {
              result = true;
            }
          }

          if (result && node.dataset.id !== li.dataset.id) {
            this.alarms.insertBefore(li, node);
            break;
          }
          node = node.nextSibling;
        } else {
          this.alarms.appendChild(li);
          break;
        }
      }
      if (!notRefresh) {
        this.refreshClockView();
      }
    },

    removeAlarm(alarm) {
      delete this.alarmIdMap[alarm.id];
      const li = this.alarms.querySelector(`#alarm-${alarm.id}`);
      if (li) {
        li.parentNode.removeChild(li);
        Utils.showToast('kai-alarm-deleted');
      }
      this.refreshClockView();
    },

    removeAllAlarm() {
      // eslint-disable-next-line
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
    toggleAlarm(alarm, enabled) {
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
        alarm.cancel(null, 'update', true);
      }
    },

    showAlarmCountdownToast(alarm) {
      let countdownTime = null;
      let countdownType = null;
      let localTimes = null;
      let timeLeft = null;
      let tl = null;

      timeLeft = +alarm.getNextAlarmFireTime() - Date.now();
      // Generate human readable numbers to pass to localization function
      tl = Utils.dateMath.fromMS(timeLeft, {
        unitsPartial: ['days', 'hours', 'minutes']
      });

      /*
       * Match properties to localizations string types
       * E.g. minutes maps to nMinutes if there are no hours but
       * NRemainMinutes if hours > 0
       */
      if (tl.days) {
      // Countdown-moreThanADay localized only for en-US while 913466 is open
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
        localTimes = [['minutes', 'nMinutes', tl.minutes]];
      }

      /*
       * Create an object to pass to window.api.l10n.get
       * E.g. {minutes: window.api.l10n.get('nMinutes', {n: 3})}
       */
      countdownTime = localTimes.reduce((lcl, time) => {
        lcl[time[0]] = window.api.l10n.get(time[1], { n: time[2] });
        return lcl;
      }, {});

      Utils.showToast(countdownType, countdownTime);
    },

    refresRegistAlarms() {
      navigator.b2g.alarmManager.getAll().then((registalarms) => {
        const nowDate = new Date();
        // eslint-disable-next-line
        for (let i in registalarms) {
          const alarmDate = registalarms[i].date;
          const type = registalarms[i].data.type === 'normal';
          if (alarmDate > nowDate && type) {
            alarmDatabase.getAll().then((alarms) => {
              // eslint-disable-next-line
              for (let j in alarms) {
                if (registalarms[i].data.id === alarms[j].id) {
                  alarms[j].schedule('normal');
                }
              }
            });
          }
        }
      });
    },

    updateAlarmStatusBar() {
      if (SettingsObserver) {
        let anyAlarmEnabled = false;
        // eslint-disable-next-line
        for (let id in this.alarmIdMap) {
          if (this.alarmIdMap[id].isEnabled()) {
            anyAlarmEnabled = true;
            break;
          }
        }
        SettingsObserver.setValue([
          {
          name: 'alarm.enabled',
          value: anyAlarmEnabled
          }
        ]);
      }
    }

  };

  Utils.extendWithDomGetters(AlarmListPanel.prototype, {
    title: '#alarms-title',
    newAlarmButton: '#alarm-new',
    AlarmSettingsButton: '#alarm-settings',
    AlarmEditButton: '#alarm-edit'
  });


  return AlarmListPanel;

});

define('text',{
  pluginBuilder: './text_builder',
  load: function(name, req, onload, config) {
    'use strict';
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



define('text!panels/alarm/panel.html',[],function () { return '<div id="clock-view" role="heading" aria-labelledby="kai-clock-title">\n  <!--  create new alarm icon -->\n  <button id="alarm-new" data-l10n-id="newAlarmButton"></button>\n  <button id="alarm-settings"></button>\n  <button id="alarm-edit"></button>\n  <!-- list of exisiting alarms, to be populated -->\n\n  <div class="p-pri" id="no-alarms-message" role="menuitem">\n    <div id="no-alarms-body" data-l10n-id="no-alarms-body"></div>\n    <div id="press-new" data-l10n-id="press-new"></div>\n  </div>\n\n  <ul id="alarms" role="menu"></ul>\n</div>\n';});


/* globals define*/
define('panels/alarm/main',['require','panel','app','panels/alarm/alarm_list','text!panels/alarm/panel.html'],(require) => {

  const Panel = require('panel');
  const App = require('app');
  const AlarmListPanel = require('panels/alarm/alarm_list');
  const html = require('text!panels/alarm/panel.html');

  function AlarmPanel() {
    // eslint-disable-next-line
    Panel.apply(this, arguments);

    this.element.innerHTML = html;
    App.showalarmPanel();
    this.alarmListPanel = new AlarmListPanel(document.getElementById('alarms'));
  }

  AlarmPanel.prototype = Object.create(Panel.prototype);

  return AlarmPanel;
});

