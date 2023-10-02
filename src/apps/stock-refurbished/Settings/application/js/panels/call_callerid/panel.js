
define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function ctor_call_cw_settings_panel() {
    let _settings = window.navigator.mozSettings;
    let _mobileConnections = window.navigator.mozMobileConnections;
    let _mobileConnection = null;
    let _taskScheduler = null;
    let _clirConstantsMapping = {
      'CLIR_DEFAULT': 0,
      'CLIR_INVOCATION': 1,
      'CLIR_SUPPRESSION': 2
    };

    function cs_initCallerId() {
      var element = document.getElementById('ril-callerId');

      var updateItem = function() {
        cs_updateCallerIdItemState(function() {
          cs_enableTapOnCallerIdItem(true);
        });
      };

      var updatePreferenceAndItem =
        cs_updateCallerIdPreference.bind(null, updateItem);

      // We listen for change events so that way we set the CLIR mode once the
      // user change the option value.
      element.addEventListener('change', (event) => {
        var clirMode = _clirConstantsMapping[element.value];
        var setReq = _mobileConnection.setCallingLineIdRestriction(clirMode);
        // If the setting success, system app will sync the value.
        // If the setting fails, we force sync the value here and update the UI.
        setReq.onerror = updatePreferenceAndItem;
        setReq.onsuccess = () => {
          cs_updateCallerIdPreference();
          cs_checkCallerId(clirMode);
        }
      });
    }

    function cs_enableTapOnCallerIdItem(enable) {
      var element = document.getElementById('menuItem-caller-id');
      var select = element.querySelector('select');

      select.disabled = !enable;
      if (enable) {
        element.removeAttribute('aria-disabled');
        element.classList.remove('none-select');
        _initSoftkey();
      } else {
        element.setAttribute('aria-disabled', 'true');
        element.classList.add('none-select');
        SettingsSoftkey.hide();
      }
    }

    function cs_updateCallerIdPreference(callback) {
      _taskScheduler.enqueue('CALLER_ID_PREF', function(done) {
        if (typeof callback !== 'function') {
          callback = function() {
            done();
          };
        } else {
          var originalCallback = callback;
          callback = function() {
            originalCallback();
            done();
          };
        }

        cs_enableTapOnCallerIdItem(false);

        var req = _mobileConnection.getCallingLineIdRestriction();
        req.onsuccess = function() {
          var value = 0; //CLIR_DEFAULT

          // In some legitimates error cases (FdnCheckFailure), the req.result
          // is undefined. This is fine, we want this, and in this case we will
          // just display an error message for all the matching requests.
          if (req.result) {
            switch (req.result['m']) {
              case 1: // Permanently provisioned
              case 3: // Temporary presentation disallowed
              case 4: // Temporary presentation allowed
                switch (req.result['n']) {
                  case 1: // CLIR invoked, CLIR_INVOCATION
                  case 2: // CLIR suppressed, CLIR_SUPPRESSION
                  case 0: // Network default, CLIR_DEFAULT
                    value = req.result['n']; //'CLIR_INVOCATION'
                    break;
                  default:
                    value = 0; //CLIR_DEFAULT
                    break;
                }
                cs_enableTapOnCallerIdItem(true);
                break;
              case 0: // Not Provisioned
              case 2: // Unknown (network error, etc)
              default:
                value = 0; //CLIR_DEFAULT
                cs_enableTapOnCallerIdItem(false);
                break;
            }

            // Set the Call ID status,
            //   first item value for SIM1 and second item value for SIM2
            SettingsDBCache.getSettings(function(results) {
              var preferences = results['ril.clirMode'] || [0, 0];
              var targetIndex = DsdsSettings.getIccCardIndexForCallSettings();
              preferences[targetIndex] = value;
              var setReq = _settings.createLock().set({
                'ril.clirMode': preferences
              });
              setReq.onsuccess = callback;
              setReq.onerror = callback;
            });
          } else {
            callback();
          }
        };
        req.onerror = callback;
      });
    }
    function cs_updateCallerIdItemState(callback) {
      var element = document.getElementById('menuItem-caller-id');
      if (!element || element.hidden) {
        if (typeof callback === 'function') {
          callback(null);
        }
        return;
      }

      _taskScheduler.enqueue('CALLER_ID', function(done) {
        SettingsDBCache.getSettings(function(results) {
          var targetIndex = DsdsSettings.getIccCardIndexForCallSettings();
          var preferences = results['ril.clirMode'];
          var preference = (preferences && preferences[targetIndex]) || 0;
          var input = document.getElementById('ril-callerId');

          var value;
          switch (preference) {
            case 1: // CLIR invoked
              value = 'CLIR_INVOCATION';
              break;
            case 2: // CLIR suppressed
              value = 'CLIR_SUPPRESSION';
              break;
            case 0: // Network default
            default:
              value = 'CLIR_DEFAULT';
              break;
          }

          input.value = value;

          if (typeof callback === 'function') {
            callback();
          }
          done();
        });
      });
    }

    function cs_checkCallerId(clirMode) {
      var targetIndex = DsdsSettings.getIccCardIndexForCallSettings();
      var getReq = _settings.createLock().get('ril.clirMode');
      getReq.onsuccess = function () {
        var preferences = getReq.result['ril.clirMode'];
        var preference = (preferences && preferences[targetIndex]) || 0;
        if (clirMode === preference) {
          showToast('changessaved');
        }
      };
    }

    function _initSoftkey() {
      var params = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        }]
      };
      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    }

    return SettingsPanel({
      onInit: function(panel) {
        _taskScheduler = TaskScheduler();
        cs_initCallerId();;
      },

      onBeforeShow: function(panel) {
        _mobileConnection = _mobileConnections[
          DsdsSettings.getIccCardIndexForCallSettings()
        ];
        if (!_mobileConnection) {
          return;
        }
        cs_updateCallerIdPreference();
        cs_updateCallerIdItemState();
      }
    });
  };
});

/**
 * TaskScheduler helps manage tasks and ensures they are executed in
 * sequential order. When a task of a certain type is enqueued, all pending
 * tasks of the same type in the queue are removed. This avoids redundant
 * queries and improves user perceived performance.
 */
var TaskScheduler = function() {
  return {
    _isLocked: false,
    _tasks: [],
    _lock: function() {
      this._isLocked = true;
    },
    _unlock: function() {
      this._isLocked = false;
      this._executeNextTask();
    },
    _removeRedundantTasks: function(type) {
      return this._tasks.filter(function(task) {
        return task.type !== type;
      });
    },
    _executeNextTask: function() {
      if (this._isLocked) {
        return;
      }
      var nextTask = this._tasks.shift();
      if (nextTask) {
        this._lock();
        nextTask.func(function() {
          this._unlock();
        }.bind(this));
      }
    },
    enqueue: function(type, func) {
      this._tasks = this._removeRedundantTasks(type);
      this._tasks.push({
        type: type,
        func: func
      });
      this._executeNextTask();
    }
  };
};
