
/**
 *  Call Barring Settings
 *  Manage the state of the different services of call barring
 */
define('panels/call_barring/call_barring',['require','modules/mvvm/observable'],function(require) {
  

  var Observable = require('modules/mvvm/observable');
  const SERVICE_CLASS_VOICE = 1; //(1 << 0);
  const SERVICE_CLASS_NONE = 0;

  var _cbAction = {
    CALL_BARRING_BAOC: 0,     // BAOC: Barring All Outgoing Calls
    CALL_BARRING_BOIC: 1,     // BOIC: Barring Outgoing International Calls
    CALL_BARRING_BOICexHC: 2, // BOICexHC: Barring Outgoing International
                              //           Calls Except to Home Country
    CALL_BARRING_BAIC: 3,     // BAIC: Barring All Incoming Calls
    CALL_BARRING_BAICr: 4     // BAICr: Barring All Incoming Calls in Roaming
  };

  var _cbServiceMapper = {
    'baoc': _cbAction.CALL_BARRING_BAOC,
    'boic': _cbAction.CALL_BARRING_BOIC,
    'boicExhc': _cbAction.CALL_BARRING_BOICexHC,
    'baic': _cbAction.CALL_BARRING_BAIC,
    'baicR': _cbAction.CALL_BARRING_BAICr
  };

  var call_barring_prototype = {
    // settings
    baoc: '',
    boic: '',
    boicExhc: '',
    baic: '',
    baicR: '',
    // enabled state for the settings
    baoc_enabled: '',
    boic_enabled: '',
    boicExhc_enabled: '',
    baic_enabled: '',
    baicR_enabled: '',

    // updatingState
    updating: false,

    _enable: function(elementArray) {
      elementArray.forEach(function disable(element) {
        this[element + '_enabled'] = true;
      }.bind(this));

      // If barring All Outgoing is set, disable the rest of outgoing calls
      if (!!this.baoc) {
        this.boic_enabled = false;
        this.boicExhc_enabled = false;
      }
      // If barring All Incoming is active, disable the rest of incoming calls
      if (!!this.baic) {
        this.baicR_enabled = false;
      }
    },

    _disable: function(elementArray) {
      elementArray.forEach(function disable(element) {
        this[element + '_enabled'] = false;
      }.bind(this));
    },

    /**
     * Makes a request to the RIL for the current state of a specific
     * call barring option.
     * @param id Code of the service we want to request the state of
     * @returns Promise with result/error of the request
     */
    _getRequest: function(api, id) {
      var callOptions = {
        'program': id,
        // changed serviceClass to ICC_SERVICE_CLASS_NONE for request
        // all cases
        'serviceClass': SERVICE_CLASS_NONE
      };
      return new Promise(function(resolve, reject) {
        // Send the request
        var request = api.getCallBarringOption(callOptions);
        request.onsuccess = function() {
          var value = request.result.serviceClass & SERVICE_CLASS_VOICE;
          var status = (value === 1) ? true : false;
          console.log('getCallBarringOption() value=' +
            value + ', status=' + status);
          resolve(status);
        };
        request.onerror = function() {
          /* request.error = { name, message } */
          resolve(request.error);
        };
      });
    },

    /**
     * Makes a request to the RIL to change the current state of a specific
     * call barring option.
     * @param options Object with the details of the new state
     * {
     *   'program':      // id of the service to update
     *   'enabled':      // new state for the service
     *   'password':     // password introduced by the user
     *   'serviceClass': // type of RIL service (voice in this case)
     * }
     */
    _setRequest: function(api, options) {
      return new Promise(function(resolve, reject) {
        // Send the request
        var request = api.setCallBarringOption(options);
        request.onsuccess = function() {
          resolve();
        };
        request.onerror = function() {
          /* request.error = { name, message } */
          reject(request.error);
        };
      });
    },

    set: function(api, setting, password) {
      // Check for updating in progress
      if (!!this.updating) {
        return;
      }
      // Check for API to be called
      if (!api) {
        return;
      }

      var self = this;
      return new Promise(function(resolve, reject) {
        self.updating = true;
        var allElements = [
          'baoc',
          'boic',
          'boicExhc',
          'baic',
          'baicR'
        ];
        self._disable(allElements);
        // get options
        var options = {
          'program': _cbServiceMapper[setting],
          'enabled': !self[setting],
          'password': password,
          'serviceClass': api.ICC_SERVICE_CLASS_VOICE
        };

        var error = null;
        self._setRequest(api, options).then(function success() {
          self[setting] = !self[setting];
        }).catch(function errored(err) {
          error = err;
        }).then(function doAnyways() {
          self.updating = false;
          self._enable(allElements);
          if (!error) {
            resolve();
          } else {
            reject(error);
          }
        });
      });
    },

    getAll: function(api) {
      // Check for updating in progress
      if (!!this.updating) {
        return;
      }
      // Check for API to be called
      if (!api) {
        return;
      }

      // Check for all elements' status
      var allElements = [
        'baoc',
        'boic',
        'boicExhc',
        'baic',
        'baicR'
      ];

      var self = this;
      self.updating = true;
      var elementList = [];

      return new Promise(function(resolve, reject) {
        self._disable(allElements);

        var setting = 'baoc';
        self._getRequest(api, _cbServiceMapper[setting]).then(
          function received(value) {
          if (typeof value === 'boolean') {
            self[setting] = value;
            elementList.push('baoc');
          }
          setting = 'boic';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          if (typeof value === 'boolean') {
            self[setting] = value;
            elementList.push('boic');
          }
          setting = 'boicExhc';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          if (typeof value === 'boolean') {
            self[setting] = value;
            elementList.push('boicExhc');
          }
          setting = 'baic';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          if (typeof value === 'boolean') {
            self[setting] = value;
            elementList.push('baic');
          }
          setting = 'baicR';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          if (typeof value === 'boolean') {
            self[setting] = value;
            elementList.push('baicR');
          }
        }).then(function afterEverythingDone() {
          self.updating = false;
          self._enable(elementList);
          resolve();
        });
      });
    }
  };

  var callBarring = Observable(call_barring_prototype);
  return callBarring;
});

/**
 *  Call Barring Settings
 *  Manage the state of the different services of call barring
 */
define('panels/call_barring/call_barring_vt',['require','modules/mvvm/observable'],function(require) {
  

  var Observable = require('modules/mvvm/observable');
  const SERVICE_CLASS_VIDEO = 80;
  const SERVICE_CLASS_NONE = 0;

  var _cbAction = {
    CALL_BARRING_BAOC: 0,     // BAOC: Barring All Outgoing Calls
    CALL_BARRING_BOIC: 1,     // BOIC: Barring Outgoing International Calls
    CALL_BARRING_BOICexHC: 2, // BOICexHC: Barring Outgoing International
                              //           Calls Except to Home Country
    CALL_BARRING_BAIC: 3,     // BAIC: Barring All Incoming Calls
    CALL_BARRING_BAICr: 4     // BAICr: Barring All Incoming Calls in Roaming
  };

  var _cbServiceMapper = {
    'baocVt': _cbAction.CALL_BARRING_BAOC,
    'boicVt': _cbAction.CALL_BARRING_BOIC,
    'boicExhcVt': _cbAction.CALL_BARRING_BOICexHC,
    'baicVt': _cbAction.CALL_BARRING_BAIC,
    'baicRVt': _cbAction.CALL_BARRING_BAICr
  };

  var call_barring_vt_prototype = {
    // settings
    baocVt: '',
    boicVt: '',
    boicExhcVt: '',
    baicVt: '',
    baicRVt: '',
    // enabled state for the settings
    baocVt_enabled: '',
    boicVt_enabled: '',
    boicExhcVt_enabled: '',
    baicVt_enabled: '',
    baicRVt_enabled: '',

    // updatingState
    updating: false,

    _enable: function(elementArray) {
      elementArray.forEach(function disable(element) {
        this[element + '_enabled'] = true;
      }.bind(this));

      // If barring All Outgoing is set, disable the rest of outgoing calls
      if (!!this.baocVt) {
        this.boicVt_enabled = false;
        this.boicExhcVt_enabled = false;
      }
      // If barring All Incoming is active, disable the rest of incoming calls
      if (!!this.baicVt) {
        this.baicRVt_enabled = false;
      }
    },

    _disable: function(elementArray) {
      elementArray.forEach(function disable(element) {
        this[element + '_enabled'] = false;
      }.bind(this));
    },

    /**
     * Makes a request to the RIL for the current state of a specific
     * call barring option.
     * @param id Code of the service we want to request the state of
     * @returns Promise with result/error of the request
     */
    _getRequest: function(api, id) {
      var callOptions = {
        'program': id,
        // changed serviceClass to ICC_SERVICE_CLASS_NONE for request
        // all cases
        'serviceClass': SERVICE_CLASS_NONE
      };
      return new Promise(function(resolve, reject) {
        // Send the request
        var request = api.getCallBarringOption(callOptions);
        request.onsuccess = function() {
          var value = request.result.serviceClass & SERVICE_CLASS_VIDEO;
          var status = (value === 80) ? true : false;
          console.log('getCallBarringOption() value=' +
            value + ', status=' + status);
          resolve(status);
        };
        request.onerror = function() {
          /* request.error = { name, message } */
          resolve(request.error);
        };
      });
    },

    /**
     * Makes a request to the RIL to change the current state of a specific
     * call barring option.
     * @param options Object with the details of the new state
     * {
     *   'program':      // id of the service to update
     *   'enabled':      // new state for the service
     *   'password':     // password introduced by the user
     *   'serviceClass': // type of RIL service (video in this case)
     * }
     */
    _setRequest: function(api, options) {
      return new Promise(function(resolve, reject) {
        // Send the request
        var request = api.setCallBarringOption(options);
        request.onsuccess = function() {
          resolve();
        };
        request.onerror = function() {
          /* request.error = { name, message } */
          reject(request.error);
        };
      });
    },

    set: function(api, setting, password) {
      // Check for updating in progress
      if (!!this.updating) {
        return;
      }
      // Check for API to be called
      if (!api) {
        return;
      }

      var self = this;
      return new Promise(function(resolve, reject) {
        self.updating = true;
        var allElements = [
          'baocVt',
          'boicVt',
          'boicExhcVt',
          'baicVt',
          'baicRVt'
        ];
        self._disable(allElements);
        // get options
        var options = {
          'program': _cbServiceMapper[setting],
          'enabled': !self[setting],
          'password': password,
          'serviceClass':  api.ICC_SERVICE_CLASS_PACKET ||
            api.ICC_SERVICE_CLASS_DATA_SYNC
        };

        var error = null;
        self._setRequest(api, options).then(function success() {
          self[setting] = !self[setting];
        }).catch(function errored(err) {
          error = err;
        }).then(function doAnyways() {
          self.updating = false;
          self._enable(allElements);
          if (!error) {
            resolve();
          } else {
            reject(error);
          }
        });
      });
    },

    getAll: function(api) {
      // Check for updating in progress
      if (!!this.updating) {
        return;
      }
      // Check for API to be called
      if (!api) {
        return;
      }

      // Check for all elements' status
      var allElements = [
        'baocVt',
        'boicVt',
        'boicExhcVt',
        'baicVt',
        'baicRVt'
      ];

      var self = this;
      self.updating = true;
      var elementList = [];

      return new Promise(function(resolve, reject) {
        self._disable(allElements);

        var setting = 'baocVt';
        self._getRequest(api, _cbServiceMapper[setting]).then(
          function received(value) {
          if (typeof value === 'boolean') {
            self[setting] = value;
            elementList.push('baocVt');
          }
          setting = 'boicVt';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          if (typeof value === 'boolean') {
            self[setting] = value;
            elementList.push('boicVt');
          }
          setting = 'boicExhcVt';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          if (typeof value === 'boolean') {
            self[setting] = value;
            elementList.push('boicExhcVt');
          }
          setting = 'baicVt';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          if (typeof value === 'boolean') {
            self[setting] = value;
            elementList.push('baicVt');
          }
          setting = 'baicRVt';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          if (typeof value === 'boolean') {
            self[setting] = value;
            elementList.push('baicRVt');
          }
        }).then(function afterEverythingDone() {
          self.updating = false;
          self._enable(elementList);
          resolve();
        });
      });
    }
  };

  var callBarringVt = Observable(call_barring_vt_prototype);
  return callBarringVt;
});

/* global DsdsSettings, SettingsSoftkey */

define('panels/call_barring/panel',['require','modules/settings_panel','modules/settings_service','panels/call_barring/call_barring','panels/call_barring/call_barring_vt'],function(require) {
  
  let SettingsPanel = require('modules/settings_panel');
  let SettingsService = require('modules/settings_service');
  let CallBarring = require('panels/call_barring/call_barring');
  let CallBarringVt = require('panels/call_barring/call_barring_vt');

  return function ctor_call_barring() {
    let _callBarring = CallBarring;
    let _callBarringVt = CallBarringVt;
    let _mobileConnection = null;
    let _cbSettings = {};
    let _refresh = null;
    let _updating = null;
    let _changePasscodeButton = null;
    let listElements = {};
    let currentPanel = null;
    let header = null;
    let title = null;
    let type = 'voice';

    /**
     * @HACK To Enable the select option
     */
    function _enableSelect(evt) {
      if (evt.key === 'Enter') {
        var select = document.querySelector('li.focus select');
        if (!select) {
          return;
        }
        if (!_updating) {
          select.hidden = false;
          select.focus();
        }
        select.hidden = true;
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
    }

    /**
     * To avoid modifying the setting for the wrong SIM card, it's better to
     * update the current mobile connection before using it.
     * see: https://bugzilla.mozilla.org/show_bug.cgi?id=910552#c81
     */
    function _updateMobileConnection() {
      _mobileConnection = window.navigator.mozMobileConnections[
        DsdsSettings.getIccCardIndexForCallSettings()
      ];
    }

    /**
     * Updates a Call Barring item with a new status.
     * @parameter item DOM 'li' element to update
     * @parameter newStatus Object with data for the update. Of the form:
     * {
     *   disabled:[true|false], // optional, new disabled state
     *   checked: [true|false], // optional, new checked state for the input
     *   message: [string]      // optional, new message for the description
     * }
     */
    function _updateCallBarringItem(item, newStatus) {
      var descText = item.querySelector('small');
      var select = item.querySelector('select');

      // disable the item
      if (typeof newStatus.disabled === 'boolean') {
        if (newStatus.disabled) {
          item.setAttribute('aria-disabled', true);
          item.classList.add('none-select');
        } else {
          item.removeAttribute('aria-disabled');
          item.classList.remove('none-select');
        }
        ListFocusHelper.updateSoftkey(currentPanel);

        if (select) {
          select.disabled = newStatus.disabled;
        }
      }

      // update the select value
      if (select && typeof newStatus.checked === 'boolean') {
        select.value = newStatus.checked ? 'true' : 'false';
      }

      // update the description
      function getSelectValue() {
        var enabled = select.value === 'true';
        var status = '';
        if (select) {
          status = enabled ? 'enabled' : 'disabled';
        }
        return status;
      }

      if (descText && _updating) {
        descText.setAttribute('data-l10n-id', 'callSettingsQuery');
      } else {
        // Clear the data-l10n-id information
        descText.innerHTML = '';
        descText.setAttribute('data-l10n-id', getSelectValue());
      }
    }

    /**
     * Shows the passcode input screen for the user to introduce the PIN
     * needed to activate/deactivate a service
     */
    function _callBarringChange(evt) {
      var settingValue = evt.target.name;
      var enabled = evt.target.value;
      SettingsService.navigate('call-barring-passcode', {
        type: type,
        settingValue: settingValue,
        enabled: enabled
      });
    }

    function _onClickEventHandler(evt) {
      SettingsService.navigate('call-barring-passcode-change', {
        type: type
      });
    }

    return SettingsPanel({
      onInit: function cb_onInit(panel) {
        currentPanel = panel;
        listElements = panel.querySelectorAll('li');
        _changePasscodeButton =
          document.querySelector('#li-cb-pswd button');
        _cbSettings = {
          baoc: document.getElementById('li-cb-baoc'),
          boic: document.getElementById('li-cb-boic'),
          boicExhc: document.getElementById('li-cb-boicExhc'),
          baic: document.getElementById('li-cb-baic'),
          baicR: document.getElementById('li-cb-baicR')
        };
        header = panel.querySelector('#call-cb-header');
        title = panel.querySelector('#call-cb-header h1');

        for (var i in _cbSettings) {
          _cbSettings[i].querySelector('select').
          addEventListener('change', _callBarringChange);
        }
      },

      onBeforeShow: function cb_onBeforeShow(panel, options) {
        type = options.type || 'voice';
        DeviceFeature.ready(() => {
          if (DeviceFeature.getValue('vilte') === 'true') {
            header.setAttribute('data-href', '#call-cbsettings-list');
            if (type === 'video') {
              title.setAttribute('data-l10n-id', 'video-call-header');
            } else {
              title.setAttribute('data-l10n-id', 'voice-call-header');
            }
          } else {
            header.setAttribute('data-href', '#call');
            title.setAttribute('data-l10n-id', 'callBarring-header');
          }
        });

        SettingsSoftkey.hide();
        _updateMobileConnection();

        if (options && options.origin &&
          options.origin === '#call-barring-passcode-change') {
          _refresh = false;
          _updating = false;
        } else {
          _refresh = true;
          _updating = true;
          // Update the call barring item value status
          for (var element in _cbSettings) {
            _callBarring[element] = false;
            _updateCallBarringItem(_cbSettings[element], {'checked': false});
          }
        }

        if (type === 'voice') {
          // Changes on settings value
          _callBarring.observe('baoc', function(newValue) {
            _updateCallBarringItem(_cbSettings.baoc, {'checked': newValue});
          });
          _callBarring.observe('boic', function(newValue) {
            _updateCallBarringItem(_cbSettings.boic, {'checked': newValue});
          });
          _callBarring.observe('boicExhc', function(newValue) {
            _updateCallBarringItem(_cbSettings.boicExhc, {'checked': newValue});
          });
          _callBarring.observe('baic', function(newValue) {
            _updateCallBarringItem(_cbSettings.baic, {'checked': newValue});
          });
          _callBarring.observe('baicR', function(newValue) {
            _updateCallBarringItem(_cbSettings.baicR, {'checked': newValue});
          });

          // Changes on settings availability
          _callBarring.observe('baoc_enabled', function changed(newValue) {
            _updateCallBarringItem(_cbSettings.baoc, {'disabled': !newValue});
          });
          _callBarring.observe('boic_enabled', function changed(newValue) {
            _updateCallBarringItem(_cbSettings.boic, {'disabled': !newValue});
          });
          _callBarring.observe('boicExhc_enabled', function changed(newValue) {
            _updateCallBarringItem(_cbSettings.boicExhc, {'disabled': !newValue});
          });
          _callBarring.observe('baic_enabled', function changed(newValue) {
            _updateCallBarringItem(_cbSettings.baic, {'disabled': !newValue});
          });
          _callBarring.observe('baicR_enabled', function changed(newValue) {
            _updateCallBarringItem(_cbSettings.baicR, {'disabled': !newValue});
          });

          _callBarring.observe('updating', function changed(newValue) {
            _updating = newValue;
          });
        } else {
          // Changes on settings value
          _callBarringVt.observe('baocVt', function(newValue) {
            _updateCallBarringItem(_cbSettings.baoc, {'checked': newValue});
          });
          _callBarringVt.observe('boicVt', function(newValue) {
            _updateCallBarringItem(_cbSettings.boic, {'checked': newValue});
          });
          _callBarringVt.observe('boicExhcVt', function(newValue) {
            _updateCallBarringItem(_cbSettings.boicExhc, {'checked': newValue});
          });
          _callBarringVt.observe('baicVt', function(newValue) {
            _updateCallBarringItem(_cbSettings.baic, {'checked': newValue});
          });
          _callBarringVt.observe('baicRVt', function(newValue) {
            _updateCallBarringItem(_cbSettings.baicR, {'checked': newValue});
          });

          // Changes on settings availability
          _callBarringVt.observe('baocVt_enabled', function changed(newValue) {
            _updateCallBarringItem(_cbSettings.baoc, {'disabled': !newValue});
          });
          _callBarringVt.observe('boicVt_enabled', function changed(newValue) {
            _updateCallBarringItem(_cbSettings.boic, {'disabled': !newValue});
          });
          _callBarringVt.observe('boicExhcVt_enabled', function changed(newValue) {
            _updateCallBarringItem(_cbSettings.boicExhc, {'disabled': !newValue});
          });
          _callBarringVt.observe('baicVt_enabled', function changed(newValue) {
            _updateCallBarringItem(_cbSettings.baic, {'disabled': !newValue});
          });
          _callBarringVt.observe('baicRVt_enabled', function changed(newValue) {
            _updateCallBarringItem(_cbSettings.baicR, {'disabled': !newValue});
          });

          _callBarringVt.observe('updating', function changed(newValue) {
            _updating = newValue;
          });
        }

        ListFocusHelper.addEventListener(listElements);
        _initSoftkey();
        ListFocusHelper.updateSoftkey(panel);
      },

      onShow: function cb_onShow() {
        if (_refresh) {
          _updateMobileConnection();
          if (type === 'voice') {
            _callBarring.getAll(_mobileConnection);
          } else {
            _callBarringVt.getAll(_mobileConnection);
          }
        }

        window.addEventListener('keydown', _enableSelect);
        _changePasscodeButton.addEventListener('click', _onClickEventHandler);
      },

      onHide: function cb_onHide() {
        window.removeEventListener('keydown', _enableSelect);
        _changePasscodeButton.removeEventListener('click',
          _onClickEventHandler);
      },

      onBeforeHide: function cb_onHide() {
        if (type === 'voice') {
          _callBarring.unobserve('baoc');
          _callBarring.unobserve('boic');
          _callBarring.unobserve('boicExhc');
          _callBarring.unobserve('baic');
          _callBarring.unobserve('baicR');

          _callBarring.unobserve('baoc_enabled');
          _callBarring.unobserve('boic_enabled');
          _callBarring.unobserve('boicExhc_enabled');
          _callBarring.unobserve('baic_enabled');
          _callBarring.unobserve('baicR_enabled');

          _callBarring.unobserve('updating');
        } else {
          _callBarringVt.unobserve('baocVt');
          _callBarringVt.unobserve('boicVt');
          _callBarringVt.unobserve('boicExhcVt');
          _callBarringVt.unobserve('baicVt');
          _callBarringVt.unobserve('baicRVt');

          _callBarringVt.unobserve('baocVt_enabled');
          _callBarringVt.unobserve('boicVt_enabled');
          _callBarringVt.unobserve('boicExhcVt_enabled');
          _callBarringVt.unobserve('baicVt_enabled');
          _callBarringVt.unobserve('baicRVt_enabled');

          _callBarringVt.unobserve('updating');
        }
        ListFocusHelper.removeEventListener(listElements);
      }
    });
  };
});
