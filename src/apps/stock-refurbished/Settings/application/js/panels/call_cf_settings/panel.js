
define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function ctor_call_cf_settings_panel() {
    let _settings = window.navigator.mozSettings;
    let _mobileConnections = window.navigator.mozMobileConnections;
    let _mobileConnection = null;
    let _voiceServiceClassMask = null;
    let _videoServiceClassMask = null;
    let _cfReason = {
      CALL_FORWARD_REASON_UNCONDITIONAL: 0,
      CALL_FORWARD_REASON_MOBILE_BUSY: 1,
      CALL_FORWARD_REASON_NO_REPLY: 2,
      CALL_FORWARD_REASON_NOT_REACHABLE: 3
    };
    let _cfReasonMapping = {
      'unconditional': _cfReason.CALL_FORWARD_REASON_UNCONDITIONAL,
      'mobilebusy': _cfReason.CALL_FORWARD_REASON_MOBILE_BUSY,
      'noreply': _cfReason.CALL_FORWARD_REASON_NO_REPLY,
      'notreachable': _cfReason.CALL_FORWARD_REASON_NOT_REACHABLE
    };
    let _cfAction = {
      CALL_FORWARD_ACTION_DISABLE: 0,
      CALL_FORWARD_ACTION_ENABLE: 1,
      CALL_FORWARD_ACTION_QUERY_STATUS: 2,
      CALL_FORWARD_ACTION_REGISTRATION: 3,
      CALL_FORWARD_ACTION_ERASURE: 4
    };
    let _cfReasonStates = [0, 0, 0, 0];
    let _ignoreSettingChanges = false;
    let elements = {};
    let checkDone = false;
    let _cfDescMapping = {
      'unconditional': 'cfu-desc',
      'mobilebusy': 'cfmb-desc',
      'noreply': 'cfnrep-desc',
      'notreachable': 'cfnrea-desc'
    };

    let _cfDescIdMapping = {
      'unconditional': 'li-cfu-desc',
      'mobilebusy': 'li-cfmb-desc',
      'noreply': 'li-cfnrep-desc',
      'notreachable': 'li-cfnrea-desc'
    };
    let _skipFlag = false;

    function cs_init() {
      _mobileConnection = _mobileConnections[
        DsdsSettings.getIccCardIndexForCallSettings()];
      if (!_mobileConnection) {
        return;
      }
      _voiceServiceClassMask = _mobileConnection.ICC_SERVICE_CLASS_VOICE;
      _videoServiceClassMask = _mobileConnection.ICC_SERVICE_CLASS_PACKET |
        _mobileConnection.ICC_SERVICE_CLASS_DATA_SYNC;

      window.addEventListener('panelready', function(e) {
        // Get the mozMobileConnection instace for this ICC card.
        _mobileConnection = _mobileConnections[
          DsdsSettings.getIccCardIndexForCallSettings()
        ];
        if (!_mobileConnection) {
          return;
        }

        switch (e.detail.current) {
          case '#call-cfSettings':
            // No need to refresh the call forwarding general settings
            // if navigated from panels not manipulating them.
            if (e.detail.previous.startsWith('#call-cf-')) {
              return;
            }
            SettingsSoftkey.hide();
            cs_updateCallForwardingSubpanels();
            break;
        }
      });

      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
          return;
        }

        switch (Settings.currentPanel) {
          case '#call-cfSettings':
            SettingsSoftkey.hide();
            cs_updateCallForwardingSubpanels();
            break;
        }
      });
      cs_initCallForwardingObservers();
    }

    /**
     * Helper function. Check whether the phone number is valid or not.
     *
     * @param {String} number The phone number to check.
     *
     * @return {Boolean} Result.
     */
    function cs_isPhoneNumberValid(number) {
      if (number) {
        var re = /^([\+]*[0-9])+$/;
        if (re.test(number)) {
          return true;
        }
      }
      return false;
    }

    /**
     * Helper function. Stores settings into the database.
     */
    function cs_setToSettingsDB(settingKey, value, callback) {
      var done = function done() {
        if (callback) {
          callback();
        }
      };

      var getLock = _settings.createLock();
      var request = getLock.get(settingKey);
      request.onsuccess = function getFromDBSuccess() {
        var currentValue = request.result[settingKey];
        if (currentValue !== value) {
          var setLock = _settings.createLock();
          var cset = {};
          cset[settingKey] = value;
          var setRequest = setLock.set(cset);
          setRequest.onsuccess = done;
          setRequest.onerror = done;
        } else {
          done();
        }
      };
      request.onerror = done;
    }

    /**
     * Helper function. Displays rule info.
     */
    function cs_displayRule(rules, elementId) {
      var element = document.getElementById(elementId);

      element.innerHTML = '';
      for (var i = 0; i < rules.length; i++) {
        if (rules[i].active &&
          ((_voiceServiceClassMask & rules[i].serviceClass) != 0)) {
          element.setAttribute('data-l10n-id', 'enabled');
          return;
        }
      }

      element.setAttribute('data-l10n-id', 'callForwardingNotForwarding');
    }

    function cs_navigateToCallForwadingSubPanel(evt) {
      var hrefList = {
        'li-cfu-desc': 'call-cf-unconditionalSettings',
        'li-cfmb-desc': 'call-cf-mobileBusySettings',
        'li-cfnrep-desc': 'call-cf-noReplySettings',
        'li-cfnrea-desc': 'call-cf-notReachableSettings'
      };
      SettingsService.navigate(hrefList[this.id], {
        type: 'voice'
      });
    }

    function cs_enableTapOnCallForwardingItem(id, enable) {
      let isUnconditionalCFOn = (_cfReasonStates[0] === 1);
      let element = document.getElementById(id);
      if (!element) {
        return;
      }

      if (enable) {
        // @HACK To make user can't enter any page
        // when the devices get the SIM card state.
        element.addEventListener('click',
          cs_navigateToCallForwadingSubPanel);
        element.removeAttribute('aria-disabled');
        element.classList.remove('none-select');
        // If unconditional call forwarding is on we keep disabled the other
        // panels.
        if (isUnconditionalCFOn && id !== 'li-cfu-desc') {
          element.removeEventListener('click',
            cs_navigateToCallForwadingSubPanel);
          element.setAttribute('aria-disabled', true);
          element.classList.add('none-select');
        }
      } else {
        element.removeEventListener('click',
          cs_navigateToCallForwadingSubPanel);
        element.setAttribute('aria-disabled', true);
        element.classList.add('none-select');
      }
    }

    /**
     * Helper function. Enables/disables tapping on call forwarding entry.
     */
    function cs_enableTapOnCallForwardingItems(enable) {
      // Update 'Call Forwarding' submenu items
      var elementIds = ['li-cfu-desc',
                        'li-cfmb-desc',
                        'li-cfnrep-desc',
                        'li-cfnrea-desc'];
      var isUnconditionalCFOn = (_cfReasonStates[0] === 1);

      elementIds.forEach(function(id, index) {
        var element = document.getElementById(id);
        if (!element) {
          return;
        }

        if (enable) {
          // @HACK To make user can't enter any page
          // when the devices get the SIM card state.
          element.addEventListener('click',
            cs_navigateToCallForwadingSubPanel);
          element.removeAttribute('aria-disabled');
          element.classList.remove('none-select');
          // If unconditional call forwarding is on we keep disabled the other
          // panels.
          if (isUnconditionalCFOn && id !== 'li-cfu-desc') {
            element.removeEventListener('click',
              cs_navigateToCallForwadingSubPanel);
            element.setAttribute('aria-disabled', true);
            element.classList.add('none-select');
          }
        } else {
          element.removeEventListener('click',
            cs_navigateToCallForwadingSubPanel);
          element.setAttribute('aria-disabled', true);
          element.classList.add('none-select');
        }
      })
    }

    function cs_displayInfo(id, l10nId) {
      let element = document.getElementById(id);
      element.innerHTML = '';
      element.setAttribute('data-l10n-id', l10nId);
    }

    /**
     * Display information relevant to the SIM card state.
     */
    function cs_displayInfoForAll(l10nId) {
      var elementIds = ['cfu-desc', 'cfmb-desc', 'cfnrep-desc', 'cfnrea-desc'];
      elementIds.forEach(function(id) {
        var element = document.getElementById(id);

        // Clear all child elements before setting the l10n id
        element.innerHTML = '';
        element.setAttribute('data-l10n-id', l10nId);
      });
    }

    function cs_getRequest(option, serviceClassMask) {
      return new Promise(function(resolve, reject) {
        // Send the request
        var request = _mobileConnection.getCallForwardingOption(option,
          serviceClassMask);
        request.onsuccess = function() {
          var value = request.result;
          resolve(value);
        };
        request.onerror = function() {
          console.error('can not get call forwarding status' + request.error.name);
          resolve(null);
        };
      });
    }

    function cs_getCallForwardingStatus(settingKey, callback) {
      let onerror = function call_getCWOptionError() {
        if (callback) {
          _ignoreSettingChanges = false;
          callback(null);
        }
      };

      let rules = null;
      cs_getRequest(_cfReasonMapping[settingKey],
        _voiceServiceClassMask).then(
        function received(value) {
        if (typeof value === 'object' && value) {
          rules = value;
        }
      }).then(function done() {
        if (!rules) {
          callback(null);
          return;
        }

        for (let i = 0; i < rules.length; i++) {
          if (_voiceServiceClassMask & rules[i].serviceClass) {
            let enabled = rules[i].active;
            cs_setToSettingsDB(
              'ril.cf.' + settingKey + '.enabled',
              enabled
            );
            cs_setToSettingsDB(
              'ril.cf.' + settingKey + '.number',
              rules[i].number
            );
            if (enabled) {
              _cfReasonStates[_cfReasonMapping[settingKey]] = 1;
              break;
            }
          }
        }
        callback(rules);
      });
    }


    /**
     * Gets current call forwarding rules.
     */
    function cs_getCallForwardingOption(callback) {
      var onerror = function call_getCWOptionError() {
        if (callback) {
          _ignoreSettingChanges = false;
          callback(null);
        }
      };

      var unconditionalRules = null;
      var unconditionalRulesVideo = null;
      var mobileBusyRules = null;
      var noReplyRules = null;
      var notReachableRules = null;
      cs_getRequest(_cfReason.CALL_FORWARD_REASON_UNCONDITIONAL,
        _voiceServiceClassMask).then(
        function received(value) {
        if (typeof value === 'object' && value) {
          unconditionalRules = value;
        }
        return cs_getRequest(_cfReason.CALL_FORWARD_REASON_UNCONDITIONAL,
          _videoServiceClassMask);
      }).then(function received(value) {
        if (typeof value === 'object' && value) {
          unconditionalRulesVideo = value;
        }
        return cs_getRequest(_cfReason.CALL_FORWARD_REASON_MOBILE_BUSY,
          _voiceServiceClassMask);
      }).then(function received(value) {
        if (typeof value === 'object' && value) {
          mobileBusyRules = value;
        }
        return cs_getRequest(_cfReason.CALL_FORWARD_REASON_NO_REPLY,
          _voiceServiceClassMask);
      }).then(function received(value) {
        if (typeof value === 'object' && value) {
          noReplyRules = value;
        }
        return cs_getRequest(_cfReason.CALL_FORWARD_REASON_NOT_REACHABLE,
          _voiceServiceClassMask);
      }).then(function received(value) {
        if (typeof value === 'object' && value) {
          notReachableRules = value;
        }
      }).then(function afterEverythingDone() {
        if (!unconditionalRules) {
          callback(null);
          return;
        }
        var cfOptions = {
          'unconditional': unconditionalRules,
          'mobilebusy': mobileBusyRules,
          'noreply': noReplyRules,
          'notreachable': notReachableRules
        };
        var vtUnconditionalFlag = false;
        var unconditionalFlag = false;

        // Waits for all DB settings completed.
        var asyncOpChecker = {
          taskCount: 0,
          runTask: function(func) {
            this.taskCount++;
            var newArgs = [];
            for (var i = 1; i < arguments.length; i++) {
              newArgs.push(arguments[i]);
            }
            newArgs.push(this.complete.bind(this));
            func.apply(window, newArgs);
          },
          complete: function() {
            this.taskCount--;
            if (this.taskCount === 0) {
              this.finish();
            }
          },
          finish: function() {
            setTimeout(function() {
              _ignoreSettingChanges = false;
              callback(cfOptions);
            }, 500);
          }
        };

        // While storing the settings into the database we avoid observing
        // changes on those ones and enabling/disabling call forwarding.
        _ignoreSettingChanges = true;
        // Ensures the settings being set to the setting DB.
        Object.keys(cfOptions).forEach(function(settingKey) {
          var rules = cfOptions[settingKey];
          if (!rules) {
            return;
          }

          var hasValidRule = false;
          for (var i = 0; i < rules.length; i++) {
            if (_voiceServiceClassMask & rules[i].serviceClass) {
              let enabled = rules[i].active;
              asyncOpChecker.runTask(
                cs_setToSettingsDB,
                'ril.cf.' + settingKey + '.number',
                rules[i].number
              );
              asyncOpChecker.runTask(
                cs_setToSettingsDB,
                'ril.cf.' + settingKey + '.enabled',
                enabled
              );

              if (enabled) {
                _cfReasonStates[_cfReasonMapping[settingKey]] = 1;
                if (settingKey === 'unconditional') {
                  unconditionalFlag = true;
                }
                hasValidRule = true;
                break;
              }
            }
          }

          if (!hasValidRule) {
            _cfReasonStates[_cfReasonMapping[settingKey]] = 0;
            if (settingKey === 'unconditional') {
              unconditionalFlag = false;
            }
          }
        });

        if (unconditionalRulesVideo[0] && unconditionalRulesVideo[0].active &&
          ((_videoServiceClassMask & unconditionalRulesVideo[0].serviceClass) === _videoServiceClassMask)) {
          vtUnconditionalFlag = true;
        } else {
          vtUnconditionalFlag = false;
        }
        if (!vtUnconditionalFlag && !unconditionalFlag) {
          asyncOpChecker.runTask(
            cs_setToSettingsDB,
            'ril.cf.carrier.enabled',
            {
              enabled: false,
              index: DsdsSettings.getIccCardIndexForCallSettings()
            }
          );
        } else {
          // Send the latest query result from carrier to system app
          asyncOpChecker.runTask(
            cs_setToSettingsDB,
            'ril.cf.carrier.enabled',
            {
              enabled: true,
              index: DsdsSettings.getIccCardIndexForCallSettings()
            }
          );
        }
      });
    }

    /**
     * Add observer.
     */
    function cs_initCallForwardingObservers() {
      var settingKeys = ['unconditional',
                         'mobilebusy',
                         'noreply',
                         'notreachable'];
      settingKeys.forEach(function(key) {
        _settings.addObserver('ril.cf.' + key + '.enabled', function(event) {
          // While storing the settings into the database we avoid observing
          // changes on those ones and enabling/disabling call forwarding.
          if (_skipFlag) {
            _skipFlag = false;
            return;
          }
          if (_ignoreSettingChanges) {
            return;
          }
          // Bails out in case the reason is already enabled/disabled.
          if (_cfReasonStates[_cfReasonMapping[key]] === event.settingValue) {
            return;
          }
          var selector = 'input[data-setting="ril.cf.' + key + '.number"]';
          var textInput = document.querySelector(selector);
          var mozMobileCFInfo = {};

          mozMobileCFInfo['action'] = event.settingValue ?
            _cfAction.CALL_FORWARD_ACTION_REGISTRATION :
            _cfAction.CALL_FORWARD_ACTION_DISABLE;
          mozMobileCFInfo['reason'] = _cfReasonMapping[key];
          mozMobileCFInfo['serviceClass'] = _voiceServiceClassMask;

          // Skip the phone number checking when disabling call forwarding.
          if (event.settingValue && !cs_isPhoneNumberValid(textInput.value)) {
            showToast('callForwardingInvalidNumberError');

            cs_updateCallForwardingSubpanels();
            return;
          }
          mozMobileCFInfo['number'] = textInput.value;
          mozMobileCFInfo['timeSeconds'] =
            mozMobileCFInfo['reason'] !=
              _cfReason.CALL_FORWARD_REASON_NO_REPLY ? 0 : 20;

          var req = _mobileConnection.setCallForwardingOption(mozMobileCFInfo);

          if (key === 'unconditional') {
            cs_enableTapOnCallForwardingItems(false);
            cs_displayInfoForAll('callSettingsQuery');
          } else {
            cs_enableTapOnCallForwardingItem(_cfDescIdMapping[key], false);
            cs_displayInfo(_cfDescMapping[key], 'callSettingsQuery');
          }

          req.onsuccess = function() {
            cs_updateCallForwardingSubpanels(null,
                                             true,
                                             key,
                                             mozMobileCFInfo['action']);
          };
          req.onerror = function() {
            showToast('callForwardingSetError');
            cs_updateCallForwardingSubpanels();

          };
        });
      });
    }

    /**
     * Get the l10nId to show after setting up call forwarding.
     */
    function cs_getSetCallForwardingOptionResult(rules, action) {
      var l10nId;
      for (var i = 0; i < rules.length; i++) {
        if (rules[i].active &&
            ((_voiceServiceClassMask & rules[i].serviceClass) != 0)) {
          var disableAction = action === _cfAction.CALL_FORWARD_ACTION_DISABLE;
          if (disableAction) {
            _skipFlag = true;
            l10nId = 'callForwardingSetForbidden';
          } else {
            _skipFlag = false;
            l10nId = 'callForwardingSetSuccess';
          }
          return l10nId;
        }
      }
      var registrationAction =
        action === _cfAction.CALL_FORWARD_ACTION_REGISTRATION;
      if (registrationAction) {
        _skipFlag = true;
        l10nId = 'callForwardingSetError';
      } else {
        _skipFlag = false;
        l10nId = 'callForwardingSetSuccess';
      }
      return l10nId;
    }

    /**
     * Update call forwarding related subpanels.
     */
    function cs_updateCallForwardingSubpanels(callback,
                                              checkSetCallForwardingOptionResult,
                                              reason,
                                              action) {
      checkDone = false;
      let element = document.getElementById('list-callForwarding');
      if (!element || element.hidden) {
        if (typeof callback === 'function') {
          callback(null);
        }
        return;
      }

      if (!reason || reason === 'unconditional') {
        cs_displayInfoForAll('callSettingsQuery');
        cs_enableTapOnCallForwardingItems(false);

        cs_getCallForwardingOption(function got_cfOption(cfOptions) {
          if (cfOptions) {
            // Need to check wether we enabled/disabled forwarding calls
            // properly e.g. the carrier might not support disabling call
            // forwarding for some reasons such as phone is busy, unreachable,
            // etc.
            if (checkSetCallForwardingOptionResult) {
              let rules = cfOptions[reason];
              let messageL10nId =
                cs_getSetCallForwardingOptionResult(rules, action);
              showToast(messageL10nId);
            }
            cs_displayRule(cfOptions['unconditional'], 'cfu-desc');
            cs_displayRule(cfOptions['mobilebusy'], 'cfmb-desc');
            cs_displayRule(cfOptions['noreply'], 'cfnrep-desc');
            cs_displayRule(cfOptions['notreachable'], 'cfnrea-desc');
            //  If the query is a success enable call forwarding items.
            cs_enableTapOnCallForwardingItems(true);
          } else {
            cs_displayInfoForAll('callSettingsQueryError');
            //  If the query is an error disable call forwarding items.
            cs_enableTapOnCallForwardingItems(false);
          }

          checkDone = true;
          let focusElement = document.querySelector('#call-cfSettings .focus');
          if (focusElement) {
            let disabled = focusElement.hasAttribute('aria-disabled');
            if (!disabled) {
              _initSoftkey();
            } else {
              SettingsSoftkey.hide();
            }
          }
          if (callback) {
            callback(null);
          }
        });
      } else {
        cs_displayInfo(_cfDescMapping[reason], 'callSettingsQuery');
        cs_enableTapOnCallForwardingItem(_cfDescIdMapping[reason], false);

        cs_getCallForwardingStatus(reason, function got_cfOption(cfOptions) {
          let rules = cfOptions;
          if (rules) {
            if (checkSetCallForwardingOptionResult) {
              let messageL10nId =
                cs_getSetCallForwardingOptionResult(rules, action);
              showToast(messageL10nId);
            }

            cs_displayRule(rules, _cfDescMapping[reason]);
            //  If the query is a success enable call forwarding items.
            cs_enableTapOnCallForwardingItem(_cfDescIdMapping[reason], true);
          } else {
            cs_displayInfo(_cfDescMapping[reason], 'callSettingsQueryError');
            //  If the query is an error disable call forwarding items.
            cs_enableTapOnCallForwardingItem(_cfDescIdMapping[reason], false);
          }

          checkDone = true;
          let focusElement = document.querySelector('#call-cfSettings .focus');
          if (focusElement) {
            let disabled = focusElement.hasAttribute('aria-disabled');
            if (!disabled) {
              _initSoftkey();
            } else {
              SettingsSoftkey.hide();
            }
          }
          if (callback) {
            callback(null);
          }
        });
      }
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

    function _updateSoftKey(evt) {
      var disabled = evt.target.hasAttribute('aria-disabled');
      if (!disabled && checkDone) {
        _initSoftkey();
      } else {
        SettingsSoftkey.hide();
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          items: panel.querySelectorAll('li')
        };
        this.header = panel.querySelector('#call-cf-header');
        this.l10n = panel.querySelector('#call-cf-header h1');
        cs_init();
      },

      onBeforeShow: function(panel, options) {
        ListFocusHelper.addEventListener(elements.items, _updateSoftKey);
        DeviceFeature.ready(() => {
          if (DeviceFeature.getValue('vilte') === 'true') {
            this.header.setAttribute('data-href', '#call-cfsettings-list');
            this.l10n.setAttribute('data-l10n-id', 'voice-call-header');
          } else {
            this.header.setAttribute('data-href', '#call');
            this.l10n.setAttribute('data-l10n-id', 'callForwarding-header');
          }
        });
      },

      onBeforeHide: function() {
        ListFocusHelper.removeEventListener(elements.items, _updateSoftKey);
      }
    });
  };
});
