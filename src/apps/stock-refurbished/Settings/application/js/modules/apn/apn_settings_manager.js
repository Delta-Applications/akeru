
/**
 * ApnItem is a wrapper of apn objects. 
 *
 * @module modules/apn/apn_item
 */
define('modules/apn/apn_item',['require'],function(require) {
  

  var APN_CATEGORY = {
    PRESET: 'preset',
    CUSTOM: 'custom',
    EU: 'eu'
  };

  /**
   * @class ApnItem
   * @params {String} id
   * @params {String} category
   * @params {Object} apn
   * @returns {ApnItem}
   */
  function ApnItem(id, category, apn) {
    this._id = id;
    this._category = category;
    this._apn = apn;
  }

  ApnItem.prototype = {
    get id() {
      return this._id;
    },
    get category() {
      return this._category;
    },
    get apn() {
      return this._apn;
    }
  };

  var constructor = function ctor_apn_item(id, category, apn) {
    return new ApnItem(id, category, apn);
  };
  constructor.APN_CATEGORY = APN_CATEGORY;

  return constructor;
});

/**
 * The apn utilities
 */
define('modules/apn/apn_utils',['require','shared/apn_helper','modules/apn/apn_const','modules/apn/apn_item'],function(require) {
  

  var ApnHelper = require('shared/apn_helper');
  var ApnConst = require('modules/apn/apn_const');
  var ApnItem = require('modules/apn/apn_item');

  var CP_APN_KEY = ApnConst.CP_APN_KEY;
  var DEFAULT_APN_KEY = ApnConst.DEFAULT_APN_KEY;
  var MCC_SETTINGS_KEY = ApnConst.MCC_SETTINGS_KEY;
  var MNC_SETTINGS_KEY = ApnConst.MNC_SETTINGS_KEY;
  var MVNO_SETTINGS_KEY = ApnConst.MVNO_SETTINGS_KEY;
  var APN_PROPS = ApnConst.APN_PROPS;
  var EU_ROAMING_FILE_PATH = ApnConst.EU_ROAMING_FILE_PATH;

  function _getOperatorCode(serviceId, type) {
    var value;
    var key;

    if (type === 'mcc') {
      value = '000';
      key = MCC_SETTINGS_KEY;
    } else if (type === 'mnc') {
      value = '00';
      key = MNC_SETTINGS_KEY;
    } else if (type === 'mvno') {
      value = [];
      key = MVNO_SETTINGS_KEY;
    } else {
      return Promise.reject('invalid type');
    }

    return new Promise(function(resolve, reject) {
      SettingsDBCache.getSettings(function(results) {
        var values = results[key];
        if (values && Array.isArray(values) && values[serviceId]) {
          value = values[serviceId];
        }
        resolve(value);
      });
    });
  }

  /**
   * Helper function. Filter APNs by apn type.
   *
   * @param {String} type
   *                 The apn type we would like to include.
   * @param {ApnItem} apnItem
   */
  function _apnTypeFilter(type, apnItem) {
    if (!type || !apnItem || !apnItem.apn.types) {
      return false;
    } else if (type === '*') {
      return true;
    }
    return apnItem.apn.types.indexOf(type) != -1;
  }

  /**
   * Query <apn> elements matching the mcc/mnc arguments in the apn.json
   * database
   *
   * @param {String} mcc
   * @param {String} mnc
   * @param {String} networkType
   *                 The network type which the APN must be compatible with.
   */
  function _getDefaultApns(mcc, mnc, networkType, serviceId) {
    // XXX: should fallback to the JSON file if we don't get the apns
    return new Promise(function(resolve, reject) {
      SettingsDBCache.getSettings(function(results) {
        var result = results[DEFAULT_APN_KEY][serviceId] || {};
        var apns = {};
        apns[mcc] = {};
        apns[mcc][mnc] = result || {};
        resolve(ApnHelper.getCompatible(apns, mcc, mnc, networkType));
      });
    });
  }

  /**
   * Query <apn> elements matching the mcc/mnc arguments in the database
   * received through client provisioning messages.
   *
   * @param {String} mcc
   * @param {String} mnc
   * @param {String} networkType
   *                 The network type which the APN must be compatible with.
   */
  function _getCpApns(mcc, mnc, networkType, serviceId) {
    return new Promise(function(resolve, reject) {
      SettingsDBCache.getSettings(function(results) {
        var apns = results[CP_APN_KEY] || {};
        resolve(ApnHelper.getCompatible(apns[serviceId], mcc, mnc, networkType));
      });
    });
  }

  var _euApnChecked = false;
  var _euApns = null;
  /**
   * Return the EU apns for roaming.
   */
  function _getEuApns() {
    if (_euApnChecked) {
      return Promise.resolve(_euApns);
    } else {
      return LazyLoader.getJSON(EU_ROAMING_FILE_PATH).then(function(result) {
        _euApnChecked = true;
        // Only return eu apns when both home and foreign operators are
        // specified.
        if (result.home && result.foreign &&
            Object.keys(result.home).length > 0 &&
            Object.keys(result.foreign).length > 0) {
          _euApns = result.defaultApns;
        }
        return _euApns;
      }).catch(function() {
        _euApnChecked = true;
        return null;
      });
    }
  }

  function _generateId() {
    // should refine this
    return Math.random().toString(36).substr(2, 9);
  }

  function _cloneApn(apn) {
    var newApn = {};
    for (var p in apn) {
      newApn[p] = apn[p];
    }
    return newApn;
  }

  function _separateApnsByType(apns) {
    if (!apns) {
      return [];
    }
    return apns.reduce(function(result, apn) {
      // separate the apn by type
      apn.types.forEach(function(type) {
        var cloneApn = _cloneApn(apn);
        cloneApn.types = [type];
        result.push(cloneApn);
      });
      return result;
    }, []);
  }

  function _isMatchedApn(apn1, apn2) {
    if (apn1 == null || apn2 == null) {
      return false;
    }

    // Check if the type of apn1 is the subset of apn2
    if (!apn1.types.every(function(type) {
      return (apn2.types.indexOf(type) !== -1);
    })) {
      return false;
    }

    return APN_PROPS.every(function(prop) {
      if (prop === 'types') {
        // we've already check this property
        return true;
      } else {
        return apn1[prop] === apn2[prop];
      }
    });
  }

  function _sortByCategory(apn1, apn2) {
    if (apn1.category === ApnItem.APN_CATEGORY.PRESET) {
      return true;
    } else if (apn2.category === ApnItem.APN_CATEGORY.PRESET) {
      return false;
    } else {
      return true;
    }
  }

  function _clone(apn) {
    return JSON.parse(JSON.stringify(apn));
  }

  return {
    getOperatorCode: _getOperatorCode,
    apnTypeFilter: _apnTypeFilter,
    getDefaultApns: _getDefaultApns,
    getCpApns: _getCpApns,
    getEuApns: _getEuApns,
    generateId: _generateId,
    separateApnsByType: _separateApnsByType,
    isMatchedApn: _isMatchedApn,
    sortByCategory: _sortByCategory,
    clone: _clone
  };
});

/**
 * ApnSettings provides functions for manipulating the apn settings in the
 * settings database.
 * Implementation details please refer to {@link ApnSettings}.
 *
 * @module modules/apn/apn_settings
 */
define('modules/apn/apn_settings',['require','modules/apn/apn_utils','modules/apn/apn_const'],function(require) {
  

  var ApnUtils = require('modules/apn/apn_utils');
  var ApnConst = require('modules/apn/apn_const');

  var APN_SETTINGS_KEY = ApnConst.APN_SETTINGS_KEY;
  var DEFAULT_APN_SETTINGS_KEY = ApnConst.DEFAULT_APN_SETTINGS_KEY;

  /**
   * @class ApnSettings
   * @returns {ApnSettings}
   */
  function ApnSettings() {
    this._isReady = false;
    this._readyPromise = null;
    this._isWritingDB = false;
    this._isDirty = false;
    this._apnSettings = null;
    this._promiseChain = Promise.resolve();
  }

  ApnSettings.prototype = {
    /**
     * As the operations should not be performed concurrently. We use this
     * function to enusre the operations are performed one by one.
     *
     * @access private
     * @memberOf ApnSettings.prototype
     * @param {Function} task
     * @returns {Promise}
     */
    _schedule: function al__schedule(task) {
      var that = this;
      this._promiseChain = this._promiseChain.then(function() {
        return task().then(function() {
          return that._commit();
        });
      });
      return this._promiseChain;
    },

    /**
     * Stores the current copy of apn settings to the settings database.
     *
     * @access private
     * @memberOf ApnSettings.prototype
     * @returns {Promise}
     */
    _commit: function al__commit() {
      if (!this._isDirty) {
        return Promise.resolve();
      }

      var that = this;
      return new Promise(function(resolve) {
        that._isWritingDB = true;
        var obj = {};
        obj[APN_SETTINGS_KEY] = that._apnSettings;
        var req = navigator.mozSettings.createLock().set(obj);
        req.onsuccess = req.onerror = function() {
          that._isDirty = false;
          that._isWritingDB = false;
          resolve();
        };
      });
    },

    /**
     * Registers an observer on setting changes because ril.data.apnSettings
     * could be changed by other apps (system and wap).
     *
     * @access private
     * @memberOf ApnSettings.prototype
     */
    _addObservers: function as__registerListeners() {
      var mozSettings = window.navigator.mozSettings;
      if (!mozSettings) {
        return;
      }
      mozSettings.addObserver(APN_SETTINGS_KEY, function(event) {
        if (!this._isWritingDB) {
          // Do not reflect the change during the committing.
          this._apnSettings = event.settingValue || [];
        }
      }.bind(this));
    },

    /**
     * Initializes the settings based on the values stored in the settings
     * database.
     *
     * @access private
     * @memberOf ApnSettings.prototype
     * @returns {Promise}
     */
    _ready: function as__ready() {
      if (this._isReady) {
        return Promise.resolve();
      } else {
        // This ensures that the ready process being executed only once.
        if (!this._readyPromise) {
          var that = this;
          this._readyPromise = new Promise(function(resolve) {
            SettingsDBCache.getSettings(function(results) {
              that._isReady = true;
              that._apnSettings = results[APN_SETTINGS_KEY] || [];
              that._addObservers();
              resolve();
            });
          });
        }
        return this._readyPromise;
      }
    },

    /**
     * The internal update function.
     *
     * @access private
     * @memberOf ApnSettings.prototype
     * @params {Number} serviceId
     * @params {String} apnType
     * @params {Object} newApn
     * @returns {Promise}
     */
    _update: function as__update(serviceId, apnType, newApn) {
      return this._ready().then(function() {
        var apns = this._apnSettings[serviceId];
        if (!apns) {
          apns = this._apnSettings[serviceId] = [];
        }

        var index = apns.findIndex(function(apn) {
          return apn.types.some((type) => apnType === type);
        });

        if (index === -1) {
          if (newApn) {
            this._isDirty = true;
            apns.push(newApn);
          }
        } else {
          if (newApn) {
            if (!ApnUtils.isMatchedApn(apns[index], newApn)) {
              this._isDirty = true;
              apns[index] = newApn;
            }
          } else {
            this._isDirty = true;
            apns.splice(index, 1);
          }
        }
      }.bind(this));
    },

    /**
     * Get all apns with of a sim card.
     *
     * @access public
     * @memberOf ApnSettings.prototype
     * @params {Number} serviceId
     * @returns {Promise Array}
     */
    getAll: function as_getAll(serviceId) {
      return this._ready().then(function() {
        return this._apnSettings[serviceId];
      }.bind(this));
    },

    /**
     * Get the apn of the specified apn type.
     *
     * @access public
     * @memberOf ApnSettings.prototype
     * @params {Number} serviceId
     * @params {String} apnType
     * @returns {Promise Object}
     */
    get: function as_get(serviceId, apnType) {
      return this._ready().then(function() {
        var apns = this._apnSettings[serviceId];
        if (apns) {
          return apns.find((apn) => apn.types.indexOf(apnType) >= 0);
        } else {
          return null;
        }
      }.bind(this));
    },

    /**
     * Update an apn and the change will be saved into the settings database.
     *
     * @access public
     * @memberOf ApnSettings.prototype
     * @params {Number} serviceId
     * @params {String} apnType
     * @params {Object} apn
     * @returns {Promise}
     */
    update: function as_update(serviceId, apnType, apn) {
      var apnClone = ApnUtils.clone(apn);
      return this._schedule(
        this._update.bind(this, serviceId, apnType, apnClone));
    },

    /**
     * Restore the apn settings to the default value determined in
     * system/js/operator_variants.js.
     *
     * @access public
     * @memberOf ApnSettings.prototype
     * @params {String} serviceId
     * @params {Object} presetApns
     * @returns {Promise}
     */
    restore: function as_restore(serviceId, presetApns) {
      var that = this;
      return that._ready().then(function() {
        navigator.hasFeature('device.capability.cdma_apn.feature')
        .then(function(enabled) {
          if (enabled) {
            // restore APN from apn.json
            return Promise.resolve(presetApns);
          } else {
            return new Promise (function(resolve) {
              SettingsDBCache.getSettings(function(results) {
                resolve(results[DEFAULT_APN_SETTINGS_KEY][serviceId] || []);
              });
            });
          }
        }).then(function(restoreApns) {
          return that._schedule(function() {
            that._isDirty = true;
            that._apnSettings[serviceId] = restoreApns;
            return Promise.resolve();
          });
        });
      });
    }
  };

  return function ctor_apn_settings() {
    return new ApnSettings();
  };
});

/**
 * ApnList stores ApnItem objects representing apns come from the apn.json
 * database, client provisioning messages, and user's creation. Each ApnItem has
 * an id assigned upon the creation. The id is used to recored users' apn
 * selection.
 *
 * @module modules/apn/apn_list
 */
define('modules/apn/apn_list',['require','modules/async_storage','modules/apn/apn_utils','modules/apn/apn_item'],function(require) {
  

  var AsyncStorage = require('modules/async_storage');
  var ApnUtils = require('modules/apn/apn_utils');
  var ApnItem = require('modules/apn/apn_item');

  /**
   * @class ApnList
   * @requires module:modules/async_storage
   * @requires module:modules/apn/apn_utils
   * @requires module:modules/apn/apn_item
   * @returns {ApnList}
   */
  function ApnList(key) {
    this._key = key;
    this._apnItems = null;
    this._pendingTaskCount = 0;
    this._promiseChain = Promise.resolve();
  }

  ApnList.prototype = {
    /**
     * As the operations should not be performed concurrently. We use this
     * function to enusre the operations are performed one by one.
     *
     * @access private
     * @memberOf ApnList.prototype
     * @param {Function} task
     * @returns {Promise}
     */
    _schedule: function al__schedule(task) {
      var that = this;
      this._promiseChain = this._promiseChain.then(function() {
        that._pendingTaskCount++;
        return task().then(function(result) {
          that._pendingTaskCount--;
          if (that._pendingTaskCount === 0) {
            return that._commit().then(function() {
              return result;
            });
          } else {
            return result;
          }
        });
      });
      return this._promiseChain;
    },

    /**
     * _apnItems are wrapped apn items. The function unwraps the items so
     * that they can be stored to async storage.
     *
     * @access private
     * @memberOf ApnList.prototype
     * @returns {Array}
     */
    _export: function al__export() {
      return this._apnItems.map(function(apnItem) {
        // Convert the apn items to static objects for storing.
        var apnClone = ApnUtils.clone(apnItem.apn);
        apnClone.id = apnItem.id;
        apnClone.category = apnItem.category;
        return apnClone;
      });
    },

    /**
     * Stores the current copy of apn items to async storage.
     *
     * @access private
     * @memberOf ApnList.prototype
     * @returns {Promise}
     */
    _commit: function al__commit() {
      if (!this._apnItems) {
        return Promise.resolve();
      } else {
        var apns = this._export();
        return AsyncStorage.setItem(this._key, apns);
      }
    },

    /**
     * The internal add function.
     *
     * @access private
     * @memberOf ApnList.prototype
     * @params {Object} apn
     * @params {ApnItem.APN_CATEGORY} category
     * @returns {Promise String} The apn id
     */
    _add: function al__add(apn, category) {
      return this.items().then(function(apnItems) {
        if (!apnItems) {
          // set default apn items
          this._apnItems = apnItems = [];
        }

        let existApnItem = apnItems.find((apnItem) => {
          return apn._id && apnItem._apn._id === apn._id;
        });

        if (existApnItem) {
          return apn.id;
        };
        category = category || ApnItem.APN_CATEGORY.CUSTOM;
        var apnItem = ApnItem(ApnUtils.generateId(), category, apn);

        apnItems.unshift(apnItem);
        return apnItem.id;
      }.bind(this));
    },

    /**
     * The internal remove function.
     *
     * @access private
     * @memberOf ApnList.prototype
     * @params {String} id
     * @returns {Promise}
     */
    _remove: function al__remove(id) {
      return this.items().then(function(apnItems) {
        if (!apnItems) {
          return Promise.reject('no apn items');
        }

        var index = apnItems.findIndex((apnItem) => apnItem.id === id);
        if (index >= 0) {
          apnItems = apnItems.splice(index, 1);
        } else {
          return Promise.reject('apn not found');
        }
      }.bind(this));
    },

    /**
     * The internal update function.
     *
     * @access private
     * @memberOf ApnList.prototype
     * @params {String} id
     * @params {Object} apn
     * @returns {Promise}
     */
    _update: function al__update(id, apn) {
      return this.items().then(function(apnItems) {
        if (!apnItems) {
          return Promise.reject('no apn items');
        }

        var index = apnItems.findIndex((apnItem) => apnItem.id === id);
        if (index >= 0) {
          var currentApn = apnItems[index].apn;
          for (var p in apn) {
            // id and category are not allowed to be changed
            if (p === 'id' || p === 'category') {
              continue;
            }
            currentApn[p] = apn[p];
          }
        } else {
          return Promise.reject('apn not found');
        }
      }.bind(this));
    },

    _updateByWap: function al__updateByWap(id, apn) {
      return this.items().then(function(apnItems) {
        if (!apnItems) {
          return Promise.reject('no apn items');
        }

        let index = apnItems.findIndex((apnItem) => apnItem.apn._id === id);
        if (index >= 0) {
          let currentApn = apnItems[index].apn;
          for (let p in apn) {
            if (p === '_id') {
              continue;
            }
            currentApn[p] = apn[p];
          }
          return id;
        } else {
          return Promise.reject('apn not found');
        }
      }.bind(this));
    },

    /**
     * Get all apn items of the list.
     *
     * @access private
     * @memberOf ApnList.prototype
     * @returns {Promise Array<ApnItem>}
     */
    items: function al_items() {
      // Because add/remove/update depend on this function so we should not
      // schedule it or we will get a dead lock. We return the current copy of
      // apn items.
      if (this._apnItems) {
        return Promise.resolve(this._apnItems);
      } else {
        return AsyncStorage.getItem(this._key).then(function(apns) {
          if (apns) {
            this._apnItems = apns.map(function(apn) {
              return ApnItem(apn.id, apn.category, apn);
            });
            this._apnItems = this._apnItems.filter((apnItem) => {
              console.log('apnItems ' + JSON.stringify(apnItem));
              return (apnItem['_apn']['user_visible'] !== 'false');
            });
            var key0 = 'ril.data.default.apnSettings';
            var req0 = navigator.mozSettings.createLock().get(key0);
            req0.onsuccess = function() {
              console.log(key0 + ' sim1 apnItems ' + JSON.stringify(req0.result[key0][0]));
              console.log(key0 + ' sim2 apnItems ' + JSON.stringify(req0.result[key0][1]));
            }

            var key1 = 'ril.data.dm.apnSettings';
            var req1 = navigator.mozSettings.createLock().get(key1);
            req1.onsuccess = function() {
              console.log(key1 + ' sim1 apnItems ' + JSON.stringify(req1.result[key1][0]));
              console.log(key1 + ' sim2 apnItems ' + JSON.stringify(req1.result[key1][1]));
            }
            return this._apnItems;
          } else {
            return null;
          }
        }.bind(this));
      }
    },

    /**
     * Get the apn item with a specified id.
     *
     * @access public
     * @memberOf ApnList.prototype
     * @returns {Promise ApnItem}
     */
    item: function al_item(id) {
      // Return the apn item based on the current copy if apn items.
      return this.items().then(function(apnItems) {
        if (!apnItems || !id) {
          return null;
        } else {
          return apnItems.find((apnItem) => apnItem.id === id);
        }
      });
    },

    /**
     * Add an apn to the list with specified category. Returns the id of the
     * newly added apn.
     *
     * @access public
     * @memberOf ApnList.prototype
     * @params {Object} apn
     * @params {ApnItem.APN_CATEGORY} category
     * @returns {Promise String} The apn id
     */
    add: function al_apns(apn, category) {
      var apnClone = ApnUtils.clone(apn);
      return this._schedule(this._add.bind(this, apnClone, category));
    },

    /**
     * Remove an apn from the list.
     *
     * @access public
     * @memberOf ApnList.prototype
     * @params {String} id
     * @returns {Promise}
     */
    remove: function al_remove(id) {
      return this._schedule(this._remove.bind(this, id));
    },

    /**
     * Update an apn. All properties expect for "id" and "category" will be
     * overwritten based on the passed apn object.
     *
     * @access public
     * @memberOf ApnList.prototype
     * @params {String} id
     * @params {Object} apn
     * @returns {Promise}
     */
    update: function al_update(id, apn) {
      var apnClone = ApnUtils.clone(apn);
      return this._schedule(this._update.bind(this, id, apnClone));
    },

    updateByWap: function al_updateByWap(id, apn) {
      let apnClone = ApnUtils.clone(apn);
      return this._schedule(this._updateByWap.bind(this, id, apnClone));
    }
  };

  return function ctor_apn_list(key) {
    return new ApnList(key);
  };
});

/**
 * ApnSelections stores the id of the apn being used on each apn type. The
 * selections are provided in terms of Observable. Changes to the selection
 * can be observed and then be saved to the settings database.
 * Implementation details please refer to {@link ApnSelections}.
 *
 * @module modules/apn/apn_selections
 */
define('modules/apn/apn_selections',['require','modules/mvvm/observable','modules/apn/apn_const'],function(require) {
  

  var Observable = require('modules/mvvm/observable');
  var ApnConst = require('modules/apn/apn_const');

  var ICC_COUNT = navigator.mozMobileConnections.length;
  var APN_TYPES = ApnConst.APN_TYPES;
  var APN_SELECTIONS_KEY = ApnConst.APN_SELECTIONS_KEY;

  /**
   * @class ApnSelections
   * @requires module:modules/mvvm/observable
   * @requires module:modules/apn/apn_const
   * @returns {ApnSelections}
   */
  function ApnSelections() {
    this._readyPromise = null;
    this._apnSelections = [];
  }

  ApnSelections.prototype = {
    /**
     * Converts the apn selections to static objects for storing.
     *
     * @access private
     * @memberOf ApnSelections.prototype
     * @returns {Promise Array}
     */
    _export: function as__export() {
      return this._apnSelections.map(function(apnSelection) {
        var obj = {};
        APN_TYPES.forEach(function(apnType) {
          obj[apnType] = apnSelection[apnType];
        });
        return obj;
      });
    },

    /**
     * Stores the current selection to the settings database.
     *
     * @access private
     * @memberOf ApnSelections.prototype
     * @returns {Promise}
     */
    _commit: function as__commit() {
      return new Promise(function(resolve) {
        var obj = {};
        obj[APN_SELECTIONS_KEY] = this._export();
        var req = navigator.mozSettings.createLock().set(obj);
        req.onsuccess = function() { resolve(); };
        req.onerror = function() {
          console.error('write apn selections failed');
          resolve();
        };
      }.bind(this));
    },

    /**
     * Registers observers so that we can save the selection when it changes.
     *
     * @access private
     * @memberOf ApnSelections.prototype
     */
    _observeApnSelections: function as__observeApnSelections(apnSelection) {
      APN_TYPES.forEach(function(apnType) {
        apnSelection.observe(apnType, this._commit.bind(this));
      }, this);
    },

    /**
     * Creates empty selections.
     *
     * @access private
     * @memberOf ApnSelections.prototype
     * @returns {Promise}
     */
    _createEmptySelections: function as__createEmptySelections() {
      var emptySelections = [];
      var emptySelection = {};
      APN_TYPES.forEach((apnType) => emptySelection[apnType] = null);

      for (var i = 0; i < ICC_COUNT; i++) {
        emptySelections.push(emptySelection);
      }

      return new Promise(function(resolve, reject) {
        var obj = {};
        obj[APN_SELECTIONS_KEY] = emptySelections;
        var req = navigator.mozSettings.createLock().set(obj);
        req.onsuccess = req.onerror =
          function() { resolve(emptySelections); };
      }.bind(this));
    },

    /**
     * Initializes the selections based on the values stored in the settings
     * database.
     *
     * @access private
     * @memberOf ApnSelections.prototype
     * @returns {Promise}
     */
    _ready: function as__ready() {
        // This ensures that the ready process being executed only once.
      if (!this._readyPromise) {
        var that = this;
        this._readyPromise = new Promise(function(resolve) {
          SettingsDBCache.getSettings(function(results) {
            resolve(results[APN_SELECTIONS_KEY]);
          });
        }).then(function(apnSelections) {
          if (apnSelections) {
            return apnSelections;
          } else {
            return that._createEmptySelections();
          }
        }).then(function(apnSelections) {
          // Turn the selections to observables
          apnSelections.forEach(function(selection, index) {
            var observableApnSelection = Observable(selection);
            that._observeApnSelections(observableApnSelection);
            that._apnSelections[index] = observableApnSelection;
          });

          // Clear the entire apn selection states when the selections are
          // cleared by other apps (usually the wap push app).
          navigator.mozSettings.addObserver(APN_SELECTIONS_KEY,
            function(event) {
              if (event.settingValue === null) {
                that._readyPromise = null;
              }
          });
        });
      }

      return this._readyPromise;
    },

    /**
     * Returns the apn selection of a sim slot. The selection object is an
     * Observable in which the apn types and apn ids are stored as key-value
     * pairs.
     *
     * @access public
     * @memberOf ApnSelections.prototype
     * @params {Number} serviceId
     * @returns {Promise Observable}
     */
    get: function as_get(serviceId) {
      return this._ready().then(function() {
        return this._apnSelections[serviceId];
      }.bind(this));
    },

    /**
     * Reset the apn selection to null.
     *
     * @access public
     * @memberOf ApnSelections.prototype
     * @params {Number} serviceId
     * @returns {Promise}
     */
    clear: function as_clear(serviceId) {
      return this._ready().then(() => {
        var apnSelection = this._apnSelections[serviceId];
        if (!apnSelection) {
          return Promise.resolve();
        }
        APN_TYPES.forEach(function(apnType) {
          apnSelection[apnType] = null;
        });
      });
    }
  };

  return function() {
    return new ApnSelections();
  };
});

/**
 * ApnSettingsManager provides functions for managing apn items. When an item
 * is selected to be used, ApnSettingsManager also helps convert the selection
 * to the real settings expected by the platform.
 * ApnSettingsManager does its task by coordinating the following objects:
 * - ApnList
 *     There is an ApnList object for each sim. ApnList stores ApnItem objects
 *     representing apns come from the apn.json database, client provisioning
 *     messages, and user's creation. Each ApnItem has an id assigned upon
 *     the creation. The id is used to recored users' apn selection.
 * - ApnSelections
 *     ApnSelections stores the id of the apn being used on each apn
 *     type.
 * - ApnSettings
 *     ApnSettings wraps the apn settings stored in the moz settings database
 *     and provides simple interface for manipulation.
 * Implementation details please refer to {@link ApnSettingsManager}.
 *
 * @module modules/apn/apn_settings_manager
 */
define('modules/apn/apn_settings_manager',['require','modules/async_storage','modules/apn/apn_const','modules/apn/apn_utils','modules/apn/apn_item','modules/apn/apn_settings','modules/apn/apn_list','modules/apn/apn_selections'],function(require) {
  
  var AsyncStorage = require('modules/async_storage');
  var ApnConst = require('modules/apn/apn_const');
  var ApnUtils = require('modules/apn/apn_utils');
  var ApnItem = require('modules/apn/apn_item');
  var ApnSettings = require('modules/apn/apn_settings');
  var ApnList = require('modules/apn/apn_list');
  var ApnSelections = require('modules/apn/apn_selections');

  var APN_TYPES = ApnConst.APN_TYPES;
  var APN_LIST_KEY = ApnConst.APN_LIST_KEY;
  var CACHED_PLMN_MVNO_KEY = ApnConst.CACHED_PLMN_MVNO_KEY;
  var DEFAULT_APN_SETTINGS_KEY = ApnConst.DEFAULT_APN_SETTINGS_KEY;
  var CP_APN_KEY = ApnConst.CP_APN_KEY;
  var MVNO_SETTINGS_KEY = ApnConst.MVNO_SETTINGS_KEY;

  var RESTORE_MODE = {
    ALL: 0,
    ONLY_APN_ITEMS: 1,
  };

  /**
   * @class ApnSettingsManager
   * @requires module:modules/async_storage
   * @requires module:modules/apn/apn_const
   * @requires module:modules/apn/apn_utils
   * @requires module:modules/apn/apn_item
   * @requires module:modules/apn/apn_settings
   * @requires module:modules/apn/apn_list
   * @requires module:modules/apn/apn_selections
   * @returns {ApnSettingsManager}
   */
  function ApnSettingsManager() {
    this._apnLists = {};
    this._apnSelections = ApnSelections();
    this._apnSettings = ApnSettings();

    this._readyPromises = {};
    this._defaultApnSettingChanged = {};
    this._cpApnSettings = {};

    Object.defineProperty(this, 'RESTORE_MODE', {
      configurable: false,
      get: function() {
        return RESTORE_MODE;
      }
    });
  }

  ApnSettingsManager.prototype = {

    /**
     * Ensures the current apn items are up-to-date. When the current plmn
     * does not equal to the cached plmn, we should restore the apn items.
     *
     * @access private
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @returns {Promise}
     */
    _ready: function asc_fromItems(serviceId) {
      if (!this._readyPromises[serviceId]) {
        var that = this;
        var plmn = {};
        // Register default apn changed observer
        that._addObservers(serviceId);
        // Get current plmn information
        return that._getPlmnAndMvnoInfo(serviceId)
        .then(function(values) {
          plmn = values;
          that._readyPromises[serviceId] = AsyncStorage.getItem(CACHED_PLMN_MVNO_KEY)
          .then((cacheValues) => {
            var cachePlmn = cacheValues && cacheValues[serviceId];
            if (plmn.length === 0 ||
              (cachePlmn &&
              plmn[0] === cachePlmn[0] &&
              plmn[1] === cachePlmn[1] &&
              JSON.stringify(plmn[2]) === JSON.stringify(cachePlmn[2]))) {
              console.log('simcard ' + serviceId + 'not change');
              return;
            }

            cacheValues = cacheValues || {};
            cacheValues[serviceId] = plmn;
            // Get the default preset apns by restoring.
            return Promise.all([
              // In this case we only restore apn items but not apn settings.
              that.restore(serviceId, RESTORE_MODE.ONLY_APN_ITEMS),
              AsyncStorage.setItem(CACHED_PLMN_MVNO_KEY, cacheValues)
            ]);
          });
        });
      }
      return this._readyPromises[serviceId];
    },

    /**
     * Register default APN changed observer
     *
     * @access private
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     */
    _addObservers: function as_registerDefaultApnChanged(serviceId) {
      var mozSettings = window.navigator.mozSettings;
      if (!mozSettings) {
        return;
      }
      this._defaultApnSettingChanged[serviceId] = function(event) {
        this._readyPromises[serviceId] = null;
      }.bind(this);

      mozSettings.addObserver(DEFAULT_APN_SETTINGS_KEY,
                  this._defaultApnSettingChanged[serviceId]);
      SettingsListener.observe(CP_APN_KEY, {}, (cpApnJson) => {
        if (cpApnJson && cpApnJson[serviceId]) {
          this._getPlmnAndMvnoInfo(serviceId).then((values) => {
            let networkType =
              navigator.mozMobileConnections[serviceId].data.type;
            let mcc = values[0];
            let mnc = values[1];
            let apnList = this._apnList(serviceId);
            this._cpApnSettings =
              ApnHelper.getCompatible(cpApnJson[serviceId],
              mcc, mnc, networkType);
            let cpApns = ApnUtils.separateApnsByType(this._cpApnSettings);
            if (cpApns.length) {
              this._ready(serviceId).then(() => {
                return this._apnList(serviceId).items();
              }).then((apnItems) => {
                cpApns.forEach((apn) => {
                  let matchedApnItem = apnItems.find((apnItem) => {
                    return apnItem.apn._id === apn._id;
                  });
                  if (!matchedApnItem) {
                    apn.deletedCpApn = false;
                    apnList.add(apn, ApnItem.APN_CATEGORY.PRESET);
                  } else {
                    // update exist apn by cp apn
                    apnList.updateByWap(apn._id, apn);
                  }
                });
              });
            }
          });
        }
      });
    },

    /**
     * Get current mcc/mnc information
     *
     * @access private
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @returns {Promise Array}
     */
    _getPlmnAndMvnoInfo: function asc_getPlmnAndMvnoInfo(serviceId) {
      return Promise.all([
        ApnUtils.getOperatorCode(serviceId, 'mcc'),
        ApnUtils.getOperatorCode(serviceId, 'mnc'),
        ApnUtils.getOperatorCode(serviceId, 'mvno')
      ]).then(function(values) {
        return values || {};
      });
    },

    /**
     * Returns the id of the first preset apn item.
     *
     * @param {Number} serviceId
     * @param {String} apnType
     * @returns {Promise String}
     */
    _deriveActiveApnIdFromItems: function asc_fromItems(serviceId, apnType) {
      return this._apnItems(serviceId, apnType).then(function(apnItems) {
        let filterapnItems = apnItems.filter((apnItem) => {
          return apnItem.apn.deletedCpApn !== true;
        });
        if (filterapnItems.length) {
          return filterapnItems.sort(ApnUtils.sortByCategory)[0].id;
        } else {
          return null;
        }
      });
    },

    /**
     * Returns the id of the apn item that matches the current apn setting of
     * the specified apn type.
     *
     * @param {Number} serviceId
     * @param {String} apnType
     * @returns {Promise String}
     */
    _deriveActiveApnIdFromSettings:
      function asc_deriveFromSettings(serviceId, apnType) {
        return Promise.all([
          this._apnItems(serviceId, apnType),
          this._apnSettings.get(serviceId, apnType)
        ]).then(function(results) {
          let apnItems = results[0];
          let apnInUse = results[1];
          let cpApns = ApnUtils.separateApnsByType(this._cpApnSettings);
          let apnList = this._apnList(serviceId);
          let updateApnItem = null;

          // apnInUse is the apn that RIL is currently using.
          if (apnInUse) {
            let existApnItem = apnItems.find((apnItem) => {
              return apnItem.apn._id === apnInUse._id;
            });

            let matchedApnItem = apnItems.find(function(apnItem) {
              return ApnUtils.isMatchedApn(apnItem.apn, apnInUse);
            });

            if (cpApns.length) {
              updateApnItem = cpApns.find((apnItem) => {
                return apnItem._id === apnInUse._id;
              });
            }

            if (updateApnItem) {
              // check if current using apn is in cp apn list and current apn
              // list:
              // 1. in both lists, and no need to update
              // 2. in both lists, but need to update by cp apn
              // 3. in cp apn list but not in current apn list, need to add
              if (matchedApnItem) {
                return matchedApnItem.id;
              } else if (existApnItem) {
                return apnList.updateByWap(apnInUse._id, apnInUse);
              } else {
                apnInUse.deletedCpApn = false;
                return apnList.add(apnInUse, ApnItem.APN_CATEGORY.PRESET);
              }
            } else if (matchedApnItem) {
              return matchedApnItem.id;
            } else if (apnItems.length > 0) {
              // current using apn is not in current apn list,
              // Suppose it is CUSTOM apn and obsere whether cause issue.
              let category = ApnItem.APN_CATEGORY.CUSTOM;
              return this.addApn(serviceId, apnInUse, category);
            } else {
              return null;
            }
          } else {
            return null;
          }
        }.bind(this));
    },

    /**
     * Return the apn type an apn that is actively being used for.
     *
     * @access private
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @param {String} apnId
     *                 id of the apn being checked.
     * @returns {Promise String}
     */
    _getApnAppliedType: function asc_getApnAppliedType(serviceId, apnId) {
      return this._apnSelections.get(serviceId).then(function(apnSelection) {
        return APN_TYPES.find((apnType) => apnSelection[apnType] === apnId);
      }.bind(this));
    },

    /**
     * Store the current apn selection to apn settings to the settings database.
     *
     * @access private
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @param {String} apnType
     */
    _storeApnSettingByType: function asc_storeApnByType(serviceId, apnType) {
      return this._apnSelections.get(serviceId).then(function(apnSelection) {
        var apnList = this._apnList(serviceId);
        var apnId = apnSelection[apnType];
        if (apnId) {
          // Get the apn item of apnType.
          return apnList.item(apnId);
        }
      }.bind(this)).then(function(apnItem) {
        if (apnItem) {
          return this._apnSettings.update(serviceId, apnType, apnItem.apn);
        } else {
          return this._apnSettings.update(serviceId, apnType, null);
        }
      }.bind(this));
    },

    /**
     * Get the apn item list of a sim slot.
     *
     * @access private
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @returns {ApnList} The apn item list.
     */
    _apnList: function asc_apnList(serviceId) {
      var apnList = this._apnLists[serviceId];
      if (!apnList) {
        this._apnLists[serviceId] = apnList = ApnList(APN_LIST_KEY + serviceId);
      }
      return apnList;
    },

    /**
     * Get the apn items of an apn type for a sim slot.
     *
     * @access private
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @param {String} apnType
     * @returns {Promise Array<ApnItem>} The apn items.
     */
    _apnItems: function asc_apnItems(serviceId, apnType) {
      return this._ready(serviceId).then(() => {
        return this._apnList(serviceId).items();
      }).then((apnItems) => {
        return apnItems &&
          apnItems.filter(ApnUtils.apnTypeFilter.bind(null, apnType)) || [];
      });
    },

    /**
     * Restore the apn items of a category.
     *
     * @access private
     * @memberOf ApnSettingsManager.prototype
     * @param {ApnList} apnList
     * @param {Array<Object>} apnsForRestoring
     *                        The function use this to restore the apn items.
     * @param {ApnItem.APN_CATEGORY} category
     *                               The category of the items to be resotred.
     * @returns {Promise Array<String>} The id of the restored apn items.
     */
    _restoreApnItemsOfCategory:
      function asc_restoreApnItems(apnList, apnsForRestoring, category) {
        return apnList.items().then(function(apnItems) {
          // Remove all existing preset apns.
          apnItems = apnItems || [];
          var promises = [];
          apnItems.filter(function(apnItem) {
            if (apnItem.category === category) {
              return true;
            }
          }).forEach(function(apnItem) {
            promises.push(apnList.remove(apnItem.id));
          });

          return Promise.all(promises);
        }).then(function() {
          // Add default preset apns.
          var promises = [];
          if (apnsForRestoring) {
            apnsForRestoring = apnsForRestoring.filter((apnItem) => {
              return (apnItem['user_visible'] !== 'false');
            });
            apnsForRestoring.forEach(function(apns) {
              promises.push(apnList.add(apns, category));
            });
          }
          return Promise.all(promises);
        });
    },

    /**
     * Get current carrier mcc code by service Id
     */
    getServiceIdMcc: function asc_getActiveApnId(serviceId) {
      return ApnUtils.getOperatorCode(serviceId, 'mcc');
    },

    /**
     * Restore the apn items and apn settings to the default. Apn items of
     * the category ApnItem.APN_CATEGORY.PRESET and ApnItem.APN_CATEGORY.EU are
     * restored. User created apn items (custom apns) will be delete. The
     * preset apn items are from the apn.json database and client provisioning
     * messages.
     *
     * @access public
     * @memberOf ApnSettingsManager.prototype
     * @param {String} serviceId
     * @param {Number} mode
     *                 The possible values are defined in RESTORE_MODE. We
     *                 restore both apn items and apn settings by default. Only
     *                 apn items are restored when mode is
     *                 RESTORE_MODE.ONLY_APN_ITEMS.
     * @returns {Promise}
     */
    restore: function asc_restore(serviceId, mode) {
      var mobileConnection = navigator.mozMobileConnections[serviceId];
      var networkType = mobileConnection.data.type;
      var apnList = this._apnList(serviceId);
      var that = this;
      var presetApns = null;

      return that._getPlmnAndMvnoInfo(serviceId)
      .then(function(values) {
        // Get default apns and client provisioning apns matching the mcc/mnc
        // codes.
        var mcc = values[0];
        var mnc = values[1];

        return Promise.all([
          ApnUtils.getEuApns(),
          ApnUtils.getDefaultApns(mcc, mnc, networkType, serviceId),
          ApnUtils.getCpApns(mcc, mnc, networkType, serviceId)
        ]);
      }).then(function(results) {
        // Restore preset and eu apns.
        var euApns = ApnUtils.separateApnsByType(results[0]);
        var defaultApns = results[1] || [];
        var cpApns = results[2];
        if (cpApns && cpApns.length) {
          cpApns.forEach((cpApn) => {
            cpApn.deletedCpApn = false;
          });
        }
        presetApns = ApnUtils.separateApnsByType(
          Array.prototype.concat.apply([], defaultApns.concat(cpApns)));

        return that._restoreApnItemsOfCategory(
          apnList, euApns, ApnItem.APN_CATEGORY.EU)
        .then(function() {
          return that._restoreApnItemsOfCategory(
            apnList, null, ApnItem.APN_CATEGORY.CUSTOM);
        })
        .then(function() {
          return that._restoreApnItemsOfCategory(
            apnList, presetApns, ApnItem.APN_CATEGORY.PRESET);
        });
      }).then(function() {
        // We simply clear the apn selections. The selections will be restored
        // based on the current apn settings when it is being queried.
        return that._apnSelections.clear(serviceId);
      }).then(function() {
        if (mode !== RESTORE_MODE.ONLY_APN_ITEMS) {
          return that._apnSettings.restore(serviceId, presetApns);
        }
      });
    },

    /**
     * Query apn items matching the mcc/mnc codes in the apn.json
     * database and the one received through client provisioning messages.
     *
     * @access public
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @param {String} apnType
     * @returns {Promise Array<ApnItem>} The apn items
     */
    queryApns: function asc_queryApns(serviceId, apnType) {
      return this.getActiveApnId(serviceId, apnType)
      .then(function(activeApnId) {
        return this._apnItems(serviceId, apnType).then(function(items) {
          items.forEach(function(apnItem) {
            apnItem.active = (apnItem.id === activeApnId);
            if (apnItem.active && apnItem.apn.deletedCpApn) {
              apnItem.apn.deletedCpApn = false;
              this._apnSettings.update(serviceId, apnType, apnItem.apn);
            }
          }.bind(this));
          return items;
        }.bind(this));
      }.bind(this));
    },

    /**
     * Add an apn to a sim slot.
     *
     * @access public
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @param {Object} apn
     * @param {ApnItem.APN_CATEGORY} category
     * @returns {Promise}
     */
    addApn: function asc_addApn(serviceId, apn, category) {
      return this._ready(serviceId).then(() => {
        return this._apnList(serviceId).add(apn,
          category || ApnItem.APN_CATEGORY.CUSTOM);
      });
    },

    /**
     * Remove an apn from a sim slot.
     *
     * @access public
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @param {String} id
     *                 id of the apn item to be added.
     * @returns {Promise}
     */
    removeApn: function asc_removeApn(serviceId, id) {
      return this._ready(serviceId).then(() => {
        return this._apnList(serviceId).remove(id);
      }).then(() => {
        // check if the removed apn is actively being used.
        return this._getApnAppliedType(serviceId, id);
      }).then((matchedApnType) => {
        if (matchedApnType) {
          return this._deriveActiveApnIdFromItems(serviceId, matchedApnType)
          .then((activeApnId) => {
            return this.setActiveApnId(serviceId, matchedApnType, activeApnId);
          });
        }
      });
    },

    /**
     * Update an apn item.
     *
     * @access public
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @param {String} id
     *                 id of the apn item to be updated.
     * @param {Object} apn
     * @returns {Promise}
     */
    updateApn: function asc_updateApn(serviceId, id, apn) {
      return this._ready(serviceId).then(() => {
        return this._apnList(serviceId).update(id, apn);
      }).then(() => {
        // check if the updated apn is actively being used.
        return this._getApnAppliedType(serviceId, id);
      }).then((matchedApnType) => {
        if (matchedApnType) {
          if (apn.deletedCpApn) {
            return this._deriveActiveApnIdFromItems(serviceId, matchedApnType)
              .then((activeApnId) => {
                return this.setActiveApnId(serviceId, matchedApnType, activeApnId);
              });
          } else {
            return this._storeApnSettingByType(serviceId, matchedApnType);
          }
        }
      });
    },

    /**
     * Get the id of the apn that is actively being used for an apn type.
     *
     * @access public
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @param {String} apnType
     * @returns {Promise String}
     */
    getActiveApnId: function asc_getActiveApnId(serviceId, apnType) {
      var that = this;
      return this._ready(serviceId).then(function() {
        return that._apnSelections.get(serviceId);
      }).then(function(apnSelection) {
        return apnSelection && apnSelection[apnType];
      }).then(function(activeApnId) {
        if (activeApnId) {
          return activeApnId;
        } else {
          // If there is no existing active apn id, try to derive the id from
          // the current apn settings.
          return that._deriveActiveApnIdFromSettings(serviceId, apnType)
          .then(function(apnId) {
            // Set the id as the active apn id.
            that.setActiveApnId(serviceId, apnType, apnId);
            return apnId;
          });
        }
      }).then(function(activeApnId) {
        // If there is still no active apn id, means that the apn settings have
        // not been set and we need to derive a default id from the current apn
        // items (stored in the apn list).
        if (activeApnId) {
          return activeApnId;
        } else {
          return that._deriveActiveApnIdFromItems(serviceId, apnType)
          .then(function(apnId) {
            // Set the id as the active apn id.
            that.setActiveApnId(serviceId, apnType, apnId);
            return apnId;
          });
        }
      });
    },

    /**
     * Set the id of an apn that is to be used for an apn type.
     *
     * @access public
     * @memberOf ApnSettingsManager.prototype
     * @param {Number} serviceId
     * @param {String} apnType
     * @param {String} id
     * @returns {Promise}
     */
    setActiveApnId: function asc_setActiveApnId(serviceId, apnType, id) {
      return this._ready(serviceId).then(() => {
        return this._apnSelections.get(serviceId);
      }).then((apnSelection) => {
        if (apnSelection[apnType] !== id) {
          apnSelection[apnType] = id;
          return this._storeApnSettingByType(serviceId, apnType);
        }
      });
    }
  };

  return new ApnSettingsManager();
});
