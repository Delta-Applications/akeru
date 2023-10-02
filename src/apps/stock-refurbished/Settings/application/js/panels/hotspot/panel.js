
/**
 * Hotspot is a singleton that you can easily use it to fetch
 * some shared data across different panels
 *
 * @module Hotspot
 */
define('panels/hotspot/hotspot',['require','shared/settings_listener'],function(require) {
  

  // modules / helpers
  var SettingsListener = require('shared/settings_listener');

  var Hotspot = function() {};

  /**
   * @alias module:hotspot/hotspot
   * @requires module:hotspot/hotspot_settings
   * @returns {Hotspot}
   */
  Hotspot.prototype = {
    /**
     * Wifi hotspot setting
     *
     * @memberOf Hotspot
     * @type {Boolean}
     */
    _hotspotSetting: null,
    /**
     * Usb hotspot setting
     *
     * @memberOf Hotspot
     * @type {Boolean}
     */
    _usbHotspotSetting: null,
    /**
     * Usb storage setting
     *
     * @memberOf Hotspot
     * @type {Boolean}
     */
    _usbStorageSetting: null,
    /**
     * These listeners would be called when hotspot setting is changed
     *
     * @memberOf Hotspot
     * @type {Array}
     */
    _hotspotChangeListeners: [],

    /**
     * These listeners would be called when usb hotspot setting is changed
     *
     * @memberOf Hotspot
     * @type {Array}
     */
    _usbHotspotChangeListeners: [],

    /**
     * These listeners would be called when usb storage setting is changed
     *
     * @memberOf Hotspot
     * @type {Array}
     */
    _usbStorageChangeListeners: [],

    /**
     * These listeners would be called when incompatibles settings are
     * enabled at the same time
     *
     * @memberOf Hotspot
     * @type {Array}
     */
    _incompatibleSettingsListeners: [],

    /**
     * Wifi tethering setting key
     *
     * @access public
     * @memberOf Hotspot
     * @type {String}
     */
    tetheringWifiKey: 'tethering.wifi.enabled',

    /**
     * Usb tethering setting key
     *
     * @access public
     * @memberOf Hotspot
     * @type {String}
     */
    tetheringUsbKey: 'tethering.usb.enabled',

    /**
     * Usb storage setting key
     *
     * @access public
     * @memberOf Hotspot
     * @type {String}
     */
    usbStorageKey: 'ums.enabled',

    /**
     * Init is used to initialize some basic stuffs
     *
     * @memberOf Hotspot
     */
    init: function h_init() {
      this._bindEvents();
    },

    /**
     * We will bind some default listeners here
     *
     * @memberOf Hotspot
     */
    _bindEvents: function() {
      // Wifi tethering enabled
      SettingsListener.observe(this.tetheringWifiKey, false,
        this._hotspotSettingChange.bind(this));

      // USB tethering enabled
      SettingsListener.observe(this.tetheringUsbKey, false,
        this._usbHotspotSettingChange.bind(this));

      // USB storage enabled
      SettingsListener.observe(this.usbStorageKey, false,
        this._usbStorageSettingChange.bind(this));
    },

    /**
     * When wifi hotspot is changed, we will call all registered listeners
     *
     * @memberOf Hotspot
     */
    _hotspotSettingChange: function(enabled) {
      this._hotspotSetting = enabled;
      this._hotspotChangeListeners.forEach(function(listener) {
        listener(enabled);
      });
    },

    /**
     * When usb hotspot is changed, we will call all registered listeners
     *
     * @memberOf Hotspot
     */
    _usbHotspotSettingChange: function(enabled) {
      this._usbHotspotSetting = enabled;
      this._usbHotspotChangeListeners.forEach(function(listener) {
        listener(enabled);
      });
    },

    /**
     * When usb storage is changed, we will call all registered listeners
     *
     * @memberOf Hotspot
     */
    _usbStorageSettingChange: function(enabled) {
      this._usbStorageSetting = enabled;
      this._usbStorageChangeListeners.forEach(function(listener) {
        listener(enabled);
      });
    },

    /**
     * When two incompatible settings are enabled we will call all
     * registered listeners.
     *
     * @param bothConflicts Indicates that usb hotspot has the two
     * possible conflicts (wifi hotspot and usb storage)
     *
     * @memberOf Hotspot
     */
    _incompatibleSettings: function(newSetting, oldSetting, bothConflicts) {
      this._incompatibleSettingsListeners.forEach(function(listener) {
        listener(newSetting, oldSetting, bothConflicts);
      });
    },

    /**
     * Check if two incompatible settings are enabled
     *
     * @memberOf Hotspot
     */
    checkIncompatibleSettings: function(newSetting, value) {
      switch(newSetting) {
        case this.tetheringWifiKey:
          // Early return if the user has disabled the setting
          if (!value) {
            this._setWifiTetheringSetting(value);
            return;
          }

          if (value && this._usbHotspotSetting) {
            this._incompatibleSettings(this.tetheringWifiKey,
              this.tetheringUsbKey, false);
          } else {
            this._setWifiTetheringSetting(value);
          }
          break;
        case this.tetheringUsbKey:
          // Early return if the user has disabled the setting or the
          // incompatible settings are disabled
          if (!value || (!this._hotspotSetting && !this._usbStorageSetting)) {
            this._setUsbTetheringSetting(value);
            return;
          }
          if (this._usbStorageSetting && this._hotspotSetting) {
            this._incompatibleSettings(this.tetheringUsbKey, null, true);
          } else {
            var oldSetting = this._usbStorageSetting ? this.usbStorageKey :
              this.tetheringWifiKey;
            this._incompatibleSettings(this.tetheringUsbKey, oldSetting, false);
          }
          break;
      }
    },

    /**
     * This is an internal function that can help us find out the matched
     * callback from catched listeners and remove it
     *
     * @memberOf Hotspot
     * @param {Array} listeners
     * @param {Function} callback
     */
    _removeEventListener: function(listeners, callback) {
      var index = listeners.indexOf(callback);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },

    /**
     * This is an internal function that set a value to the
     * Wifi tethering setting
     *
     * @memberOf Hotspot
     * @param {Boolean} Setting value
     */
    _setWifiTetheringSetting: function(value) {
      var cset = {};
      cset[this.tetheringWifiKey] = value;
      SettingsListener.getSettingsLock().set(cset);
      showToast('changessaved');
	  var telephony = navigator.mozTelephony;
	  if (telephony) {
	  	console.log('to call setMaxTransmitPower to' + value);
        telephony.setMaxTransmitPower(value);
  	  }
	 
    },

    /**
     * This is an internal function that set a value to the
     * Usb tethering setting
     *
     * @memberOf Hotspot
     * @param {Boolean} Setting value
     */
    _setUsbTetheringSetting: function(value) {
      var cset = {};
      cset[this.tetheringUsbKey] = value;
      SettingsListener.getSettingsLock().set(cset);
      showToast('changessaved');
    },

    addEventListener: function(eventName, callback) {
      if (eventName === 'incompatibleSettings') {
        this._incompatibleSettingsListeners.push(callback);
      } else if (eventName === 'wifiHotspotChange') {
        this._hotspotChangeListeners.push(callback);
      } else if (eventName === 'usbHotspotChange') {
        this._usbHotspotChangeListeners.push(callback);
      } else if (eventName === 'usbStorageChange') {
        this._usbStorageChangeListeners.push(callback);
      }
    },

    removeEventListener: function(eventName, callback) {
      if (eventName === 'incompatibleSettings') {
        this._removeEventListener(
          this._incompatibleSettingsListeners, callback);
      } else if (eventName === 'wifiHotspotChange') {
        this._removeEventListener(
          this._hotspotChangeListeners, callback);
      } else if (eventName === 'usbHotspotChange') {
        this._removeEventListener(
          this._usbHotspotChangeListeners, callback);
      } else if (eventName === 'usbStorageChange') {
        this._removeEventListener(
          this._usbStorageChangeListeners, callback);
      }
    },

    get wifiHotspotSetting() {
      return this._hotspotSetting;
    },

    get usbHotspotSetting() {
      return this._usbHotspotSetting;
    },

    get usbStorageSetting() {
      return this._usbStorageSetting;
    },

    set hotspotSetting(value) {
      this._setWifiTetheringSetting(value);
    },

    set usbHotspotSetting(value) {
      this._setUsbTetheringSetting(value);
    }
  };

  return function ctor_hotspot() {
    return new Hotspot();
  };
});

/**
 * Hotspot Settings:
 *   - Update Hotspot Settings
 * @module HotspotSettings
 */
define('panels/hotspot/hotspot_settings',['require','shared/settings_listener','modules/mvvm/observable'],function(require) {
  

  var SettingsListener = require('shared/settings_listener');
  var Observable = require('modules/mvvm/observable');

  /**
   * @alias module:hotspot/hotspot_settings
   * @requires module:modules/mvvm/observable
   * @returns {hotspotSettingsPrototype}
   */
  var hotspotSettingsPrototype = {
    /**
     * USB insert status
     */
    isUSBInserted: false,

    /**
     * Hotspot SSID.
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     * @type {String}
     */
    hotspotSSID: '',

    /**
     * Hotspot security type
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     * @type {String}
     */
    hotspotSecurity: '',

    /**
     * Hotspot Password
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     * @type {String}
     */
    hotspotPassword: '',

    /**
     * Hotspot SSID setting key
     *
     * @access public
     * @memberOf hotspotSettingsPrototype
     * @type {String}
     */
    tetheringSSIDKey: 'tethering.wifi.ssid',

    /**
     * Hotspot security type setting key
     *
     * @access public
     * @memberOf hotspotSettingsPrototype
     * @type {String}
     */
    tetheringSecurityKey: 'tethering.wifi.security.type',

    /**
     * Hotspot password setting key
     *
     * @access public
     * @memberOf hotspotSettingsPrototype
     * @type {String}
     */
    tetheringPasswordKey: 'tethering.wifi.security.password',

    /**
     * Init module.
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     */
    _init: function hs_init() {
      this._usbManager = navigator.usb;
      this._initUSBStatus();
      this._bindEvents();
      this._updatePasswordIfNeeded();
    },

    /**
     * Init USB connection status
     *
     */
    _initUSBStatus: function hs_init_USB_status() {
      this.isUSBInserted = this._usbManager.deviceAttached;
    },

    /**
     * We will generate a random password for the hotspot
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     */
    _generateHotspotPassword: function hs_generateHotspotPassword() {
      var words = ['amsterdam', 'ankara', 'auckland',
                 'belfast', 'berlin', 'boston',
                 'calgary', 'caracas', 'chicago',
                 'dakar', 'delhi', 'dubai',
                 'dublin', 'houston', 'jakarta',
                 'lagos', 'lima', 'madrid',
                 'newyork', 'osaka', 'oslo',
                 'porto', 'santiago', 'saopaulo',
                 'seattle', 'stockholm', 'sydney',
                 'taipei', 'tokyo', 'toronto'];
      var password = words[Math.floor(Math.random() * words.length)];
      for (var i = 0; i < 4; i++) {
        password += Math.floor(Math.random() * 10);
      }
      return password;
    },

    /**
     * We will update hotspot password if needed
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
    */
    _updatePasswordIfNeeded: function hs_updatePasswordIfNeeded() {
      var self = this;
      SettingsDBCache.getSettings(function(results) {
        if (!results[self.tetheringPasswordKey]) {
          var pwd = self._generateHotspotPassword();
          var cset = {};
          cset[self.tetheringPasswordKey] = pwd;
          SettingsListener.getSettingsLock().set(cset);
        }
      });
    },

    /**
     * Sets the value to the tethering password setting
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     * @param {String} value
     */
    saveHotspotConfig: function hs_saveHotspotConfig(config) {
      var result = SettingsListener.getSettingsLock().set(config);
      result.onsuccess = () => {
        showToast('changessaved');
      };
    },

    /**
     * Updates the current value of hotspot SSID
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     * @param {String} value
     */
    _onSSIDChange: function hs_onSSIDChange(value) {
      this.hotspotSSID = value;
    },

    /**
     * Updates the current value of hotspot security type
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     * @param {String} value
     */
    _onSecurityChange: function hs_onSecurityChange(value) {
      this.hotspotSecurity = value;
    },

    /**
     * Updates the current value of hotspot password
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     * @param {String} value
     */
    _onPasswordChange: function hs_onPasswordChange(value) {
      this.hotspotPassword = value;
    },

    /**
     * Updates the current status of USB
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     * @param {EventHandler} evt
     */
    _onUSBInsertChange: function hs__onUsbStatusChange(evt) {
      this.isUSBInserted = evt.deviceAttached;
    },

    /**
     * Listen to hotspot settings changes
     *
     * @access private
     * @memberOf hotspotSettingsPrototype
     */
    _bindEvents: function hs_bindEvents() {
      SettingsListener.observe(this.tetheringSSIDKey,
        '', this._onSSIDChange.bind(this));

      SettingsListener.observe(this.tetheringSecurityKey,
        'wpa-psk', this._onSecurityChange.bind(this));

      SettingsListener.observe(this.tetheringPasswordKey,
        '', this._onPasswordChange.bind(this));

      this._usbManager.onusbstatuschange =
        this._onUSBInsertChange.bind(this);
    }
  };

  return function ctor_hotspotSettings() {
    // Create the observable object using the prototype.
    var hotspotSettings = Observable(hotspotSettingsPrototype);
    hotspotSettings._init();
    return hotspotSettings;
  };
});

/* global openIncompatibleSettingsDialog, DsdsSettings, SettingsSoftkey */

define('panels/hotspot/panel',['require','modules/settings_panel','modules/settings_service','shared/settings_listener','panels/hotspot/hotspot','shared/simslot_manager','panels/hotspot/hotspot_settings'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  var SettingsListener = require('shared/settings_listener');
  var Hotspot = require('panels/hotspot/hotspot');
  var SIMSlotManager = require('shared/simslot_manager');
  var HotspotSettings = require('panels/hotspot/hotspot_settings');

  return function ctor_hotspot() {
    var elements = {};
    // SIM Card available flag
    var hasSIMCard = false;
    // Current active SIM Card Object
    var activeSIMCard = null;
    // Data Connection status flag
    var isDataEnabled = false;
    var isWifiEnabled = false;
    var isWifiSettingsUI = SHOW;
    var isFTUHotspot = false;
    var isFTUTethering = false;
    var hotspot = Hotspot();
    var hotspotSettings = HotspotSettings();

    function _initSoftKey() {
      var softkeyParams = {
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
      SettingsSoftkey.init(softkeyParams);
      _updateSoftkey();
    }

    function _updateSoftkey() {
      var classList = document.activeElement.classList;
      if (classList && classList.contains('none-select')) {
        SettingsSoftkey.hide();
      } else {
        SettingsSoftkey.show();
      }
    }

    function _handleDialogEvent(menuId, isFTU, isConflict) {
      if (isWifiEnabled) {
        if (isFTU) {
          _openWaringDialog(menuId).then(() => {
            _openFirstTimeUseDialog(menuId, false);
          });
        } else {
          _openWaringDialog(menuId);
        }
      } else {
        if (isConflict) {
          if (isFTU) {
            _setHotspotStatus(menuId);
            _openFirstTimeUseDialog(menuId, false);
          } else {
            _setHotspotStatus(menuId);
          }
        } else {
          if (isFTU) {
            _openFirstTimeUseDialog(menuId, true);
          } else {
            _setHotspotStatus(menuId);
          }
        }
      }
    }

    function _handleHotspotEvent(evt) {
      if (!hasSIMCard) {
        _showSIMCardDialog();
        return;
      }
      if (!isDataEnabled) {
        _showNetworkDialog();
        evt.preventDefault();
        evt.stopPropagation();
        return;
      }

      var isConflict = hotspot.wifiHotspotSetting ||
        hotspot.usbHotspotSetting;
      var menuId = 'wifi-hotspot';
      _handleDialogEvent(menuId, isFTUHotspot, isConflict);
    }

    function _handleTetheringEvent(evt) {
      if (!hotspotSettings.isUSBInserted) {
        return;
      }
      if (!hasSIMCard) {
        _showSIMCardDialog();
        return;
      }
      if (!isDataEnabled) {
        _showNetworkDialog();
        evt.preventDefault();
        evt.stopPropagation();
        return;
      }

      var isConflict = hotspot.wifiHotspotSetting ||
        hotspot.usbHotspotSetting;
      var menuId = 'usb-tethering';
      _handleDialogEvent(menuId, isFTUTethering, isConflict);
    }

    function _openWaringDialog(menuId) {
      var selectElement = null;
      var header = '',
        message = '';
      if (menuId === 'wifi-hotspot') {
        header = 'is-warning-wifi-header';
        message = 'is-warning-hotspot-wifi-message';
        selectElement = elements.hotspotSelectElement;
      } else {
        header = 'is-warning-tethering-header';
        message = 'is-warning-hotspot-tethering-message';
        selectElement = elements.usbTetheringSelectElement;
      }

      return new Promise((resolve, reject) => {
        var dialogConfig = {
          title: {id: header, args: {}},
          body: {id: message, args: {}},
          cancel: {
            name: 'Cancel',
            l10nId: 'cancel',
            priority: 1,
            callback: function() {
              selectElement.value = 'false';
              var el = document.getElementById(menuId);
              el && el.focus();
              reject();
            }
          },
          confirm: {
            name: 'Turn On',
            l10nId: 'turnOn',
            priority: 3,
            callback: function() {
              _setHotspotStatus(menuId);
              var el = document.getElementById(menuId);
              el && el.focus();
              resolve();
            }
          },
          backcallback: function() {
            selectElement.value = 'false';
            var el = document.getElementById(menuId);
            el && el.focus();
            reject();
          }
        };

        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      });
    }

    function _openFirstTimeUseDialog(menuId, enableDoneKey) {
      // If the Hotspot has switched on, we should show the "OK" soft-key.
      // Otherwise, we need to show the "Turn On" and "Cancel" soft-key.
      var selectElement = null;
      var key = '',
        header = '',
        message = '';
      if (menuId === 'wifi-hotspot') {
        key = 'firstHotspot';
        header = 'is-warning-wifi-header';
        message = 'is-ftu-hotspot-wifi';
        selectElement = elements.hotspotSelectElement;
      } else {
        key = 'firstTethering';
        header = 'is-warning-tethering-header';
        message = 'is-ftu-hotspot-tethering';
        selectElement = elements.usbTetheringSelectElement;
      }

      var dialogConfig = {
        title: {id: header, args: {}},
        body: {id: message, args: {}},
      };

      if (enableDoneKey) {
        dialogConfig.cancel = {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          callback: function() {
            selectElement.value = 'false';
            var el = document.getElementById(menuId);
            el && el.focus();
          }
        };
        dialogConfig.confirm = {
          name: 'Turn On',
          l10nId: 'turnOn',
          priority: 3,
          callback: function() {
            _setHotspotStatus(menuId);
            DeviceFeature.setLocalStorageItem(key, 'false');
            _updateFirstTimeUseConfig();
            var el = document.getElementById(menuId);
            el && el.focus();
          }
        };
      } else {
        dialogConfig.accept = {
          name: 'OK',
          l10nId: 'ok',
          priority: 2,
          callback: function() {
            DeviceFeature.setLocalStorageItem(key, 'false');
            _updateFirstTimeUseConfig();
            var el = document.getElementById(menuId);
            el && el.focus();
          }
        };
      }
      dialogConfig.backcallback = function() {
        selectElement.value = 'false';
        var el = document.getElementById(menuId);
        el && el.focus();
      };

      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function _showSIMCardDialog() {
      _showConfrimDialog('no-sim-card-message-1', 'no-sim-card-message-2');
    }

    function _showNetworkDialog() {
      _showConfrimDialog('trun-on-network-message', '');
    }

    function _showNoNetworkDialog() {
      _showConfrimDialog('no-network-message', '');
    }

    function _showConfrimDialog(message, desc) {
      var dialogConfig = {
        title: {id: 'internetSharing', args: {}},
        body: {id: message, args: {}},
        desc: {id: desc, args: {}},
        accept: {
          name: 'OK',
          l10nId: 'ok',
          priority: 2,
          callback: function() {}
        }
      };

      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    /**
     * At Gecko side, when you want to switch on Hotspot,
     *   it would disable the Wi-Fi first and enable Hotspot then.
     * Turning off Hotspot, Gecko would delay 10s to recover the Wi-Fi status.
     * So, we don't need to handle it at Gaia side except USB Tethering.
     */
    function _setHotspotStatus(menuId) {
      if (menuId === 'wifi-hotspot') {
        hotspot.checkIncompatibleSettings(
          hotspot.tetheringWifiKey, true);
      } else {
        // If we want to switch on USB Tethering,
        //   we should turn off Wi-Fi first.
        if (isWifiEnabled) {
          var request = SettingsListener.getSettingsLock().set({
            'wifi.enabled': false
          });

          request.onsuccess = () => {
            hotspot.checkIncompatibleSettings(
              hotspot.tetheringUsbKey, true);
          };
        } else {
          hotspot.checkIncompatibleSettings(
            hotspot.tetheringUsbKey, true);
        }
      }
    }

    function _updateWifiStatus(enabled) {
      isWifiEnabled = enabled;
    }

    function _updateHotspotSecurity(newValue) {
      elements.hotspotSecurityType.setAttribute('data-l10n-id',
        'hotspot-' + newValue);

      var password = elements.panel.querySelector('.wifi-password');
      password.hidden = (newValue === 'open') ? true : false;
      NavigationMap.refresh();
    }

    function _updateHotspotSSID(newValue) {
      elements.hotspotSSID.textContent = newValue;
    }

    function _updateHotspotPassword(newValue) {
      elements.hotspotPassword.textContent = newValue;
    }

    function _setHotspotSettingsEnabled(enabled) {
      // To disable the "Hotspot Settings" button when internet sharing is ON
      elements.hotspotSettingBtn.setAttribute('aria-disabled', enabled);
      elements.hotspotSelectElement.value = enabled;

      if (isWifiSettingsUI === SHOW) {
        // @HACK To remove the SettingBtn envent listener
        if (enabled) {
          elements.hotspotSettingBtn.removeEventListener('click',
            _onHotspotSettingsClick);
          elements.hotspotSettingBtn.classList.add('none-select');
        } else {
          elements.hotspotSettingBtn.addEventListener('click',
            _onHotspotSettingsClick);
          elements.hotspotSettingBtn.classList.remove('none-select');
        }
      } else {
        elements.hotspotSettingBtn.removeEventListener('click',
          _onHotspotSettingsClick);
        elements.hotspotSettingBtn.classList.add('none-select');
      }

    }

    function _updateUSBTetheringUI(enabled) {
      _updateUSBTetheringMenu(enabled);
      _updateSoftkey();
    }

    /**
     * There is no USB connected, we should disable the USB Tethering menu item.
     */
    function _updateUSBTetheringMenu(enabled) {
      elements.usbTethering.setAttribute('aria-disabled', !enabled);
      if (!enabled) {
        elements.usbTethering.classList.add('none-select');
      } else {
        elements.usbTethering.classList.remove('none-select');
      }
      // When USB connection is lost, we need to turn off the USB Tethering
      if (hotspot.usbHotspotSetting && !enabled) {
        hotspot.checkIncompatibleSettings(
          hotspot.tetheringUsbKey, false);
      }
    }

    function _updateUSBTetheringSelect(enabled) {
      elements.usbTetheringSelectElement.value = enabled;
    }

    function _onWifiHotspotChange(evt) {
      var enabled = (evt.target.value === 'true' || false);
      if (enabled) {
        _handleHotspotEvent(evt);
      } else {
        hotspot.checkIncompatibleSettings(
          hotspot.tetheringWifiKey, false);
      }
    }

    function _onUSBTetheringChange(evt) {
      var enabled = (evt.target.value === 'true' || false);
      if (enabled) {
        _handleTetheringEvent(evt);
      } else {
        hotspot.checkIncompatibleSettings(
          hotspot.tetheringUsbKey, false);
      }
    }

    function _onHotspotSettingsClick() {
      SettingsService.navigate('hotspot-wifiSettings', {
        settings: hotspotSettings
      });
    }

    function _updateUI() {
      _updateHotspotSSID(hotspotSettings.hotspotSSID);
      _updateHotspotSecurity(hotspotSettings.hotspotSecurity);
      _updateHotspotPassword(hotspotSettings.hotspotPassword);
      _updateUSBTetheringMenu(hotspotSettings.isUSBInserted);
    }

    function _initActiveSIMSlot() {
      SIMSlotManager.getSlots().forEach((SIMSlot) => {
        if (!SIMSlot.isAbsent()) {
          activeSIMCard = SIMSlot;
        }
      });

      if (activeSIMCard !== null) {
        activeSIMCard.conn.addEventListener('cardstatechange',
          _updateActiveSIMSlot);
        _updateActiveSIMSlot();
      } else {
        hasSIMCard = false;
      }
    }

    function _updateActiveSIMSlot(evt) {
      var cardState = activeSIMCard.simCard.cardState;
      switch (cardState) {
        case null:
        case 'unknown':
          hasSIMCard = false;
          break;
        default:
          hasSIMCard = true;
          break;
      }
    }

    function _updateDataConnectionStatus(enabled) {
      isDataEnabled = enabled;
    }

    function _getStorageBoolean(key) {
      let boolValue = DeviceFeature.getValue(key) || 'true';
      let enabled = (boolValue === 'true' || false);
      return enabled;
    }

    function _updateFirstTimeUseConfig() {
      isFTUHotspot = _getStorageBoolean('firstHotspot');
      isFTUTethering = _getStorageBoolean('firstTethering');
    }

    function _hideHotspotMenuitemById(id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.add('hidden');
        var focusedLi = el.querySelectorAll('.focus');
        for (var i = 0; focusedLi.length > i; i++) {
          focusedLi[i].classList.remove('focus');
        }
      }
    }

    function _showHotspotMenuitemById(id) {
      var el = document.getElementById(id);
      el && el.classList.remove('hidden');
    }

    function updateWifiHotSpotState(values) {
      if (DeviceFeature.getValue('wifi') !== 'true') {
        _hideHotspotMenuitemById('hotspot-wifi-header');
        _hideHotspotMenuitemById('hotspot-wifi-switch');
        _hideHotspotMenuitemById('hotspot-wifi-info');
        return;
      }
      let wifiHotspot = document.getElementById('wifi-hotspot');
      let hotspotSettings = document.getElementById('hotspot-settings-section');
      let wifiUi = values['wifi-hotspot.settings.ui'];
      let dmWifiUi = values['dm.tethering.wifi.settings.ui'];
      if ((wifiUi === HIDE) || (dmWifiUi === 'hide')) {
        _hideHotspotMenuitemById('hotspot-wifi-header');
        _hideHotspotMenuitemById('hotspot-wifi-switch');
        _hideHotspotMenuitemById('hotspot-wifi-info');
      } else if (wifiUi === GRAYOUT || dmWifiUi === 'gray') {
        _showHotspotMenuitemById('hotspot-wifi-header');
        _showHotspotMenuitemById('hotspot-wifi-switch');
        _showHotspotMenuitemById('hotspot-wifi-info');
        wifiHotspot.setAttribute('aria-disabled', true);
        hotspotSettings.setAttribute('aria-disabled', true);
      } else {
        _showHotspotMenuitemById('hotspot-wifi-header');
        _showHotspotMenuitemById('hotspot-wifi-switch');
        _showHotspotMenuitemById('hotspot-wifi-info');
        wifiHotspot.removeAttribute('aria-disabled');
        hotspotSettings.removeAttribute('aria-disabled');
      }
      window.dispatchEvent(new CustomEvent('refresh'));
    }

    function updateUsbHotSpotState(values) {
      let usbUi = values['tethering.usb.settings.ui'];
      let dmUsbUi = values['dm.tethering.usb.settings.ui'];

      if (usbUi === HIDE /*'hide'*/ || dmUsbUi === 'hide') {
        _hideHotspotMenuitemById('usb-tethering-header');
        _hideHotspotMenuitemById('usb-tethering-area');
      } else if (usbUi === GRAYOUT || dmUsbUi === 'gray' ||
        !hotspotSettings.isUSBInserted) {
        _showHotspotMenuitemById('usb-tethering-header');
        _showHotspotMenuitemById('usb-tethering-area');
        document.getElementById('usb-tethering').setAttribute('aria-disabled', true);
        document.getElementById('usb-tethering').classList.add('none-select');
      } else {
        _showHotspotMenuitemById('usb-tethering-header');
        _showHotspotMenuitemById('usb-tethering-area');
        document.getElementById('usb-tethering').removeAttribute('aria-disabled');
        document.getElementById('usb-tethering').classList.remove('none-select');
      }
      window.dispatchEvent(new CustomEvent('refresh'));
    }

    return SettingsPanel({
      onInit: function(panel) {
        this._incompatibleSettingsDialog = 'incompatible-settings-dialog';
        elements = {
          panel: panel,
          panelLiItems: panel.querySelectorAll('li'),
          wifiHotspot: document.getElementById('wifi-hotspot'),
          hotspotSSID: document.getElementById('network-name-desc'),
          hotspotPassword: document.getElementById('wifi-password-desc'),
          hotspotSecurityType: document.getElementById('wifi-security-desc'),
          hotspotSettingBtn: document.getElementById('hotspot-settings-section'),
          hotspotSelectElement: panel.querySelector('#wifi-hotspot select'),
          usbTethering: document.getElementById('usb-tethering'),
          usbTetheringSelectElement: panel.querySelector('#usb-tethering select')
        };

        this.incompatibleSettingsHandler =
          this._openIncompatibleSettingsDialog.bind(this);

        hotspot.init();
      },

      onBeforeShow: function(panel, options) {
        _initActiveSIMSlot();
        isWifiSettingsUI = SHOW;
        // Incompatible settings
        hotspot.addEventListener('incompatibleSettings',
          this.incompatibleSettingsHandler);

        // Wi-fi hotspot event listener
        elements.hotspotSelectElement.addEventListener('change',
          _onWifiHotspotChange);

        // USB tethering event listener
        elements.usbTetheringSelectElement.addEventListener('change',
          _onUSBTetheringChange);

        hotspotSettings.observe('hotspotSSID', _updateHotspotSSID);

        hotspotSettings.observe('hotspotPassword', _updateHotspotPassword);

        // Localize WiFi security type string when setting changes
        hotspotSettings.observe('hotspotSecurity', _updateHotspotSecurity);

        // Update the USB Tethering status
        hotspotSettings.observe('isUSBInserted', _updateUSBTetheringUI);

        // Update current wifi status
        SettingsListener.observe('wifi.enabled', false,
          _updateWifiStatus);

        // Update current USB rethering status and "Select" item value
        SettingsListener.observe('tethering.usb.enabled', false,
          _updateUSBTetheringSelect);

        // Update current Hotspot status and
        //   enable/disable "Hotspot Settings" option menu
        SettingsListener.observe('tethering.wifi.enabled', true,
          _setHotspotSettingsEnabled);

        SettingsListener.observe('ril.data.enabled', false,
          _updateDataConnectionStatus);

        _updateUI();

        ListFocusHelper.addEventListener(elements.panelLiItems);

        _updateFirstTimeUseConfig();
        _initSoftKey();

        updateWifiHotSpotState(SettingsDBCache.cache);
        updateUsbHotSpotState(SettingsDBCache.cache);
      },

      onBeforeHide: function(panel, options) {
        // Incompatible settings
        hotspot.removeEventListener('incompatibleSettings',
          this.incompatibleSettingsHandler);

        // Wi-fi hotspot event listener
        elements.hotspotSelectElement.removeEventListener('change',
          _onWifiHotspotChange);

        // USB tethering event listener
        elements.usbTetheringSelectElement.removeEventListener('change',
          _onUSBTetheringChange);

        elements.hotspotSettingBtn.removeEventListener('click',
          _onHotspotSettingsClick);

        hotspotSettings.unobserve('hotspotSSID');

        hotspotSettings.unobserve('hotspotPassword');

        hotspotSettings.unobserve('hotspotSecurity');

        hotspotSettings.unobserve('isUSBInserted');

        SettingsListener.unobserve('wifi.enabled',
          _updateWifiStatus);

        SettingsListener.unobserve('tethering.usb.enabled',
          _updateUSBTetheringSelect);

        SettingsListener.unobserve('tethering.wifi.enabled',
          _setHotspotSettingsEnabled);

        SettingsListener.unobserve('ril.data.enabled',
          _updateDataConnectionStatus);

        if (activeSIMCard !== null) {
          activeSIMCard.conn.removeEventListener('cardstatechange',
            _updateActiveSIMSlot);
        }

        ListFocusHelper.removeEventListener(elements.panelLiItems);
      },

      _updateFocus: function (newSetting) {
        if (newSetting === 'tethering.usb.enabled') {
          var el = document.getElementById('usb-tethering');
          el && el.focus();
        } else if (newSetting === 'tethering.wifi.enabled') {
          var el = document.getElementById('wifi-hotspot');
          el && el.focus();
        }
      },

      _openIncompatibleSettingsDialog: function(newSetting, oldSetting, bothConflicts) {
        // We must check if there is two incompatibilities
        // (usb hotspot case) or just one
        if (bothConflicts) {
          openIncompatibleSettingsDialog(this._incompatibleSettingsDialog,
            hotspot.tetheringUsbKey, hotspot.tetheringWifiKey,
            this._openSecondWarning.bind(this));
        } else {
          openIncompatibleSettingsDialog(this._incompatibleSettingsDialog,
            newSetting, oldSetting, this._updateFocus(newSetting));
        }
      },

      _openSecondWarning: function() {
        openIncompatibleSettingsDialog(this._incompatibleSettingsDialog,
          hotspot.tetheringUsbKey, hotspot.usbStorageKey,
          this._updateFocus('tethering.usb.enabled'));
      }
    });
  };
});
