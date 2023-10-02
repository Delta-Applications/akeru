/**
 * Show misc informations
 *
 * @module abou_more_info/DeviceInfo
 */
define('panels/about_more_info/device_info', ['require'], function (require) {


  /**
   * @alias module:abou_more_info/DeviceInfo
   * @class DeviceInfo
   * @returns {DeviceInfo}
   */
  var DeviceInfo = function () {
    this._elements = {};
  };

  DeviceInfo.prototype = {
    /**
     * initialization.
     *
     * @access public
     * @memberOf DeviceInfo.prototype
     * @param {HTMLElement} elements
     */
    init: function mi_init(elements) {
      this._elements = elements;

      this._loadImei();
      navigator.hasFeature('device.capability.cdma_apn.feature').then((enabled) => {
        if (enabled) {
          this._loadMeid();
          this._elements.listMeids.hidden = false;
        }
      });
      this._loadIccId();
    },

    /**
     * Retrieves the IMEI code corresponding with the specified SIM card slot.
     *
     * @access private
     * @memberOf DeviceInfo.prototype
     * @param {Integer} simSlotIndex The slot whose IMEI code
     *   we want to retrieve.
     * @return {Promise} A promise that resolves to the IMEI code or rejects
     *          if an error occurred.
     */
    _getImeiCode: function mi__getImeiCode(simSlotIndex) {
      var dialPromise = navigator.mozMobileConnections[simSlotIndex].getDeviceIdentities();

      return dialPromise.then(function (deviceInfo) {
        if (deviceInfo.imei) {
          return deviceInfo.imei;
        } else {
          var errorMsg = 'Could not retrieve the IMEI code for SIM ' +
            simSlotIndex;
          console.log(errorMsg);
          return Promise.reject(
            new Error(errorMsg)
          );
        }
      });
    },

    /**
     * Populate the IMEI information entry with the provided list of IMEI codes.
     * If the code is not given or if it's empty then the entry will be marked
     * as unavailable.
     *
     * @access private
     * @memberOf DeviceInfo.prototype
     * @param {Array} imeis An array of IMEI codes.
     */
    _createImeiField: function mi__createImeiField(imeis) {
      while (this._elements.deviceInfoImeis.hasChildNodes()) {
        this._elements.deviceInfoImeis.removeChild(
          this._elements.deviceInfoImeis.lastChild);
      }

      if (!imeis || imeis.length === 0) {
        var span = document.createElement('span');

        span.setAttribute('data-l10n-id', 'unavailable');
        this._elements.deviceInfoImeis.appendChild(span);
      } else {
        imeis.forEach(function (imei, index) {
          var span = document.createElement('span');

          if (imeis.length > 1) {
            navigator.mozL10n.setAttributes(span,
              'deviceInfo-IMEI-with-index', {
                index: index + 1,
                imei: imei
              });
          } else {
            span.textContent = imei;
          }

          span.dataset.slot = index;
          this._elements.deviceInfoImeis.appendChild(span);
        }.bind(this));
      }
    },

    /**
     * Loads all the device's IMEI code in the corresponding entry.
     *
     * @access private
     * @memberOf DeviceInfo.prototype
     * @return {Promise} A promise that is resolved when the container has been
     *          fully populated.
     */
    _loadImei: function mi__loadImei() {
      var conns = navigator.mozMobileConnections;

      if (!navigator.mozTelephony || !conns) {
        this._elements.listImeis.hidden = true;
        return Promise.resolve();
      }

      // Retrieve all IMEI codes.
      var promises = [];
      for (var i = 0; i < conns.length; i++) {
        promises.push(this._getImeiCode(i));
      }

      var self = this;
      return Promise.all(promises).then(function (imeis) {
        self._createImeiField(imeis);
      }, function () {
        self._createImeiField(null);
      });
    },

    _getMeidCode: function mi__getMeidCode(simSlotIndex) {
      var dialPromise = navigator.mozMobileConnections[simSlotIndex].getDeviceIdentities();

      return dialPromise.then(function (deviceInfo) {
        if (deviceInfo.meid) {
          return deviceInfo.meid;
        } else {
          var errorMsg = 'Could not retrieve the IMEI code for SIM ' +
            simSlotIndex;
          console.log(errorMsg);
          return Promise.reject(
            new Error(errorMsg)
          );
        }
      });
    },

    _createMeidField: function mi__createMeidField(meids) {
      while (this._elements.deviceInfoMeids.hasChildNodes()) {
        this._elements.deviceInfoMeids.removeChild(
          this._elements.deviceInfoMeids.lastChild);
      }

      var count = 0;
      meids.forEach(function (meid, index) {
        // XXX, meid may be returned a string 'undefined' here which is
        // not correcet, until there's any fix in gecko, use this judge
        // as a workaround.
        if (meid && meid !== 'undefined') {
          count++;
          var span = document.createElement('span');
          if (meids.length > 1) {
            navigator.mozL10n.setAttributes(span,
              'deviceInfo-MEID-with-index', {
                index: index + 1,
                meid: meid
              }
            );
          } else {
            span.textContent = meid;
          }

          span.dataset.slot = index;
          this._elements.deviceInfoMeids.appendChild(span);
        }
      }.bind(this));

      if (count === 0) {
        this._elements.listMeids.hidden = true;
      }
    },

    _loadMeid: function mi__loadMeid() {
      var conns = navigator.mozMobileConnections;

      if (!navigator.mozTelephony || !conns) {
        this._elements.listMeids.hidden = true;
        return Promise.resolve();
      }

      // Retrieve all MEID codes.
      var promises = [];
      for (var i = 0; i < conns.length; i++) {
        promises.push(this._getMeidCode(i));
      }

      var self = this;
      return Promise.all(promises).then(function (meids) {
        self._createMeidField(meids);
      }, function () {
        self._createMeidField(null);
      });
    },

    /**
     * show icc id.
     *
     * @access private
     * @memberOf DeviceInfo.prototype
     */
    _loadIccId: function mi__loadIccId() {
      var conns = navigator.mozMobileConnections;

      if (!navigator.mozTelephony || !conns) {
        this._elements.listIccIds.hidden = true;
        return;
      }

      var multiSim = conns.length > 1;

      // update iccids
      while (this._elements.deviceInfoIccIds.hasChildNodes()) {
        this._elements.deviceInfoIccIds.removeChild(
          this._elements.deviceInfoIccIds.lastChild);
      }
      Array.prototype.forEach.call(conns, function (conn, index) {
        var span = document.createElement('span');
        if (conn.iccId) {
          if (multiSim) {
            navigator.mozL10n.setAttributes(span,
              'deviceInfo-ICCID-with-index', {
                index: index + 1,
                iccid: conn.iccId
              });
          } else {
            span.textContent = conn.iccId;
          }
        } else {
          if (multiSim) {
            navigator.mozL10n.setAttributes(span,
              'noSim-with-index-and-colon', {
                index: index + 1
              });
          } else {
            span.setAttribute('data-l10n-id', 'noSimCard');
          }
        }
        this._elements.deviceInfoIccIds.appendChild(span);
      }.bind(this));
    }
  };

  return function ctor_deviceInfo() {
    return new DeviceInfo();
  };
});

/**
 * Show hardware informations
 *
 * @module about_more_info/hardwareInfo
 */
define('panels/about_more_info/hardware_info', ['require', 'shared/settings_listener'], function (require) {


  var SettingsListener = require('shared/settings_listener');

  /**
   * @alias module:about_more_info/HardwareInfo
   * @class HardwareInfo
   * @returns {HardwareInfo}
   */
  var HardwareInfo = function () {
    this._elements = {};
  };

  HardwareInfo.prototype = {
    /**
     * initialization.
     *
     * @access public
     * @memberOf HardwareInfo.prototype
     * @param {HTMLElement} elements
     */
    init: function mi_init(elements) {
      this._elements = elements;

      this._loadMacAddress();
      DeviceFeature.ready(() => {
        this._checkWifiAvaliable();
        this._loadBluetoothAddress();
      });
    },

    /**
     * observe and show MacAddress.
     *
     * @access private
     * @memberOf HardwareInfo.prototype
     */
    _loadMacAddress: function mi__loadMacAddress() {
      SettingsListener.observe('deviceinfo.mac', '', (macAddress) =>
        this._elements.deviceInfoMac.textContent = macAddress);
    },

    /**
     * refreshing the address field only.
     *
     * @access private
     * @memberOf HardwareInfo.prototype
     * @param  {String} address Bluetooth address
     */
    _refreshBluetoothAddress: function mi__refreshBluetoothAddress(address) {
      // update UI fields
      for (var i = 0, len = this._elements.fields.length; i < len; i++) {
        this._elements.fields[i].textContent = address;
      }
    },

    /**
     * load Bluetooth address.
     *
     * @access private
     * @memberOf HardwareInfo.prototype
     */
    _loadBluetoothAddress: function about_loadBluetoothAddress() {
      getSetting('bluetooth.settings.ui').then((value) => {
        if (DeviceFeature.getValue('bt') !== 'true' || !navigator.mozBluetooth ||
          value === HIDE) {
          document.querySelector('.list-bluetooth').hidden = true;
          window.dispatchEvent(new CustomEvent('refresh'));
          return;
        }
        document.querySelector('.list-bluetooth').hidden = false;

        return new Promise(function (resolve, reject) {
          var bluetoothModulePath = 'modules/bluetooth/bluetooth_context';
          if (bluetoothModulePath) {
            require([bluetoothModulePath], resolve);
          } else {
            reject();
          }
        }).then(function (Bluetooth) {
          if (Bluetooth) {
            Bluetooth.observe('address',
              this._refreshBluetoothAddress.bind(this));
            this._refreshBluetoothAddress(Bluetooth.address);
          }
        }.bind(this));
      });
    },

    _checkWifiAvaliable: function about_checkWifiAvaliable() {
      getSetting('wifi.settings.ui').then((value) => {
        if (DeviceFeature.getValue('wifi') !== 'true') {
          document.querySelector('.list-mac').hidden = true;
          window.dispatchEvent(new CustomEvent('refresh'));
          return;
        }
        if (value === HIDE /*'hide'*/ ) {
          document.querySelector('.list-mac').hidden = true;
        } else if (value === SHOW /*'show'*/ ) {
          document.querySelector('.list-mac').hidden = false;
        } else if (value === GRAYOUT /*'grayout'*/ ) {
          document.querySelector('.list-mac').hidden = false;
        }
        window.dispatchEvent(new CustomEvent('refresh'));
      });
    }
  };

  return function ctor_hardwareInfo() {
    return new HardwareInfo();
  };
});

/**
 * Used to show Device/Information/More Information panel
 */
define('panels/about_more_info/panel', ['require', 'modules/settings_panel', 'panels/about_more_info/device_info', 'panels/about_more_info/hardware_info', 'shared/settings_listener'], function (require) {

  var SettingsPanel = require('modules/settings_panel');
  var DeviceInfo = require('panels/about_more_info/device_info');
  var HardwareInfo = require('panels/about_more_info/hardware_info');
  var SettingsListener = require('shared/settings_listener');
  let keyArray = [];
  let elements = null;
  let waitForMore = false;

  function keyDwnHandler(evt) {
    switch (evt.key) {
      case 'SoftLeft':
      case 'Enter':
      case 'SoftRight':
        keyArray.push(evt.key);
        checkDeveloperMode(keyArray);
        break;
      default:
        cleanKeyArray();
        break;
    }
  }

  function checkDeveloperMode(keyArray) {
    console.log("check dev menu")
    let len = keyArray.length;
    if (len == 6) {
      console.log("triggered")
      let item = document.querySelector(
        '[data-show-name="developer.menu.enabled"]');
      let settings = navigator.mozSettings;
      if (item && settings) {
        settings.createLock().get('developer.menu.enabled')
          .then((result) => {
            let val = result['developer.menu.enabled'];

            if (!val) {
              settings.createLock().set({
                'developer.menu.enabled': true
              });
              item.hidden = false;

              settings.createLock().set({
                'debugger.remote-mode': 'adb-devtools'
              });
              showToast('developer-mode-on');

            }
            waitForMore = true;


          });
      }
    } else if (len >= 12) {
      let settings = navigator.mozSettings;
      let item = document.querySelector(
        '[data-show-name="developer.menu.enabled"]');
      if (item && settings) {
        settings.createLock().get('developer.menu.enabled')
          .then((result) => {
            let val = result['developer.menu.enabled'];
            if (val) {
              settings.createLock().get('developer.menu.more')
                .then((result) => {
                  let val = result['developer.menu.more'];
                  if (val) {
                    item.hidden = true;

                    settings.createLock().set({
                      'developer.menu.enabled': false
                    });
                    settings.createLock().set({
                      'debugger.remote-mode': 'disabled'
                    });
                    settings.createLock().set({
                      'developer.menu.more': false
                    })
                    showToast('developer-mode-off');
                    cleanKeyArray();

                  } else {
                    item.hidden = false;
                    settings.createLock().set({
                      'developer.menu.more': true
                    })
                    showToast("👀")
                  }

                });
            }
          });

      }
    }
  }

  function cleanKeyArray() {
    keyArray = [];
  }

  function updateDeveloperMode(enabled) {
    if (!enabled) {
      DeviceFeature.ready(() => {
        if (DeviceFeature.getValue('buildType') === 'user') {
          elements.osVersion.addEventListener('keydown', keyDwnHandler);
          elements.osVersion.addEventListener('blur', cleanKeyArray);
        }
      });
    }
  }

  return function ctor_support_panel() {
    var hardwareInfo = HardwareInfo();
    var deviceInfo = DeviceInfo();

    return SettingsPanel({
      onInit: function (panel) {
        deviceInfo.init({
          listImeis: panel.querySelector('.list-imeis'),
          listMeids: panel.querySelector('.list-meids'),
          listIccIds: panel.querySelector('.list-iccids'),
          deviceInfoImeis: panel.querySelector('.deviceInfo-imeis'),
          deviceInfoMeids: panel.querySelector('.deviceInfo-meids'),
          deviceInfoIccIds: panel.querySelector('.deviceInfo-iccids')
        });
        hardwareInfo.init({
          deviceInfoMac: panel.querySelector('[data-name="deviceinfo.mac"]'),
          fields: panel.querySelectorAll('[data-name="deviceinfo.bt_address"]')
        });
        elements = {
          osVersion: panel.querySelector('#os-version-li')
        }
      },

      onBeforeShow: function () {
        SettingsSoftkey.hide();
        SettingsListener.observe('developer.ciphertext.disabled', false,
          updateDeveloperMode);
      },

      onBeforeHide: function () {
        SettingsListener.unobserve('developer.ciphertext.disabled',
          updateDeveloperMode);
      }
    });
  };
});