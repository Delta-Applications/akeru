/* exported SettingsListener */
'use strict';

var SettingsListener = {
  /* Timer to remove the lock. */
  _timer: null,

  /* lock stores here */
  _lock: null,

  /* keep record of observers in order to remove them in the future */
  _observers: [],

  /**
   * getSettingsLock: create a lock or retrieve one that we saved.
   * mozSettings.createLock() is expensive and lock should be reused
   * whenever possible.
   */
  getSettingsLock: function sl_getSettingsLock() {
    // If there is a lock present we return that
    if (this._lock && !this._lock.closed) {
      return this._lock;
    }

    // If there isn't we return one.
    var settings = window.navigator.mozSettings;

    return (this._lock = settings.createLock());
  },

  // If options is an object with a truthful `forceClose` property,
  // this setting will use its own lock that we be close as soon
  // as possible.
  // This should only be used for settings that are on a critical
  // path (eg. during startup). 
  observe: function sl_observe(name, defaultValue, callback, options) {
    let forceClose = options && (options.forceClose === true);

    if (forceClose) {
      var localLock = window.navigator.mozSettings.createLock();
      var getLockReq = function() {
        return localLock.get(name);
      }
    } else {
      var self = this;
      var getLockReq = function() {
        return self.getSettingsLock().get(name);
      }
    }

    var settings = window.navigator.mozSettings;
    if (!settings) {
      window.setTimeout(function() { callback(defaultValue); });
      return;
    }

    var req;
    try {
      req = getLockReq();
    } catch (e) {
      // It is possible (but rare) for getSettingsLock() to return
      // a SettingsLock object that is no longer valid.
      // Until https://bugzilla.mozilla.org/show_bug.cgi?id=793239
      // is fixed, we just catch the resulting exception and try
      // again with a fresh lock
      console.warn('Stale lock in settings_listener.js.',
                   'See https://bugzilla.mozilla.org/show_bug.cgi?id=793239');
      this._lock = null;
      req = getLockReq();
    }

    req.then(() => {
      callback(typeof(req.result[name]) != 'undefined' ?
        req.result[name] : defaultValue);
    });

    if (forceClose) {
      localLock.forceClose();
    }

    var settingChanged = function settingChanged(evt) {
      callback(evt.settingValue);
    };
    settings.addObserver(name, settingChanged);
    this._observers.push({
      name: name,
      callback: callback,
      observer: settingChanged
    });
  },

  unobserve: function sl_unobserve(name, callback) {
    var settings = window.navigator.mozSettings;
    var that = this;
    this._observers.forEach(function(value, index) {
      if (value.name === name && value.callback === callback) {
        settings.removeObserver(name, value.observer);
        that._observers.splice(index, 1);
      }
    });
  }
};
