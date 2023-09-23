
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

  /**
   * Schedule an alarm to ring in the future.
   *
   * @return {Promise}
   * @param {'normal'|'snooze'} type
   */
  schedule: function(type, date) {
    var alarmDatabase = new AlarmDatabase('alarms', 'alarms', 7); // circular dependency
    if (this.isRepeating()) {
      this.iconFlash = false;
    }

    var firedate, promise;
    if (type === 'normal') {
      promise = this.cancel(null, 'update', true); // Cancel both snooze and regular mozAlarms.
      firedate = this.getNextAlarmFireTime(date);
    } else if (type === 'snooze') {
      promise = this.cancel('snooze', 'update', false); // Cancel any snooze mozAlarms.
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
    let alarmDatabase = new AlarmDatabase('alarms', 'alarms', 7); // circular dependency
    [].forEach.call(types, (type) => {
      let id = this.registeredAlarms[type];
      navigator.b2g.alarmManager.remove(id);
      delete this.registeredAlarms[type];
    });

    return alarmDatabase.put(this).then(() => {
      if (isNotify) {
        // this._notifyChanged(false, addOrUpdate);
      }
    }).catch((e) => {
      console.log('Alarm cancel error: ' + e.toString());
      throw e;
    });
  }
};


function AlarmDatabase(dbName, storeName, version) {
  this.dbName = dbName;
  this.storeName = storeName;
  this.version = version;
  this.count = 3;

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
              store.put(cursor.value);
              cursor.continue();
              throw new Error('get database fail : ' + e);
            }
          }
        };

        transaction.oncomplete = (() => resolve(db));
        transaction.onerror = ((evt) => reject(evt.target.errorCode));
      });
    }).catch(function(err) {
      // Explicit err.toString() coercion needed to see a message.
      console.error('AlarmDatabase Fatal Error:', err.toString());
    })
  };
  this.withDatabase = this._withDatabase();
}

AlarmDatabase.prototype = {

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
    return this.withStoreRequest('getAll').then((alarms) => {
      return alarms.map((data) => new Alarm(data));
    });
  },

  get: function(id) {
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
