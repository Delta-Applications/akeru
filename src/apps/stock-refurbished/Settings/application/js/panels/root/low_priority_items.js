
/**
 * The moudle supports displaying bluetooth information on an element.
 *
 * @module panels/root/bluetooth_item
 */
define('panels/root/bluetooth_item',['require'],function(require) {
  

  /**
   * @alias module:panels/root/bluetooth_item
   * @class BluetoothItem
   * @requires module:modules/bluetooth
   * @param {HTMLElement} element
                          The element displaying the bluetooth information
   * @return {BluetoothItem}
   */
  function BluetoothItem(element) {
    this._enabled = false;
    this._element = element;
    this._boundRefreshMenuDescription =
      this._refreshMenuDescription.bind(this, element);
  }

  BluetoothItem.prototype = {

    /**
     * An instance to maintain that we have created a promise to get Bluetooth
     * module.
     *
     * @access private
     * @memberOf BluetoothItem.prototype
     * @type {Promise}
     */
    _getBluetoothPromise: null,

    /**
     * A promise function to get Bluetooth module.
     *
     * @access private
     * @memberOf BluetoothItem.prototype
     * @type {Promise}
     */
    _getBluetooth: function bt__getBluetooth() {
      if (!this._getBluetoothPromise) {
        this._getBluetoothPromise = new Promise(function(resolve) {
          var bluetoothModulePath = 'modules/bluetooth/bluetooth_context';
          require([bluetoothModulePath], resolve);
        }.bind(this));
      }
      return this._getBluetoothPromise;
    },

    /**
     * Refresh the text based on the Bluetooth module enabled/disabled,
     * paired devices information.
     *
     * @access private
     * @memberOf BluetoothItem.prototype
     * @param {HTMLElement} element
                            The element displaying the bluetooth information
     */
    _refreshMenuDescription: function bt__refreshMenuDescription(element) {
      if (!navigator.mozL10n) {
        return;
      }

      this._getBluetooth().then(function(bluetooth) {
        if (bluetooth.enabled) {
          element.setAttribute('data-l10n-id', 'on');
        } else {
          element.setAttribute('data-l10n-id', 'off');
        }
      });
    },

    /**
     * The value indicates whether the module is responding.
     *
     * @access public
     * @memberOf BluetoothItem.prototype
     * @type {Boolean}
     */
    get enabled() {
      return this._enabled;
    },

    set enabled(value) {
      if (this._enabled === value) {
        return;
      }

      this._enabled = value;
      this._getBluetooth().then(function(bluetooth) {
        if (this._enabled) {
          bluetooth.observe('enabled', this._boundRefreshMenuDescription);
          bluetooth.observe('numberOfPairedDevices',
            this._boundRefreshMenuDescription);
          this._boundRefreshMenuDescription();
        } else {
          bluetooth.unobserve('enabled', this._boundRefreshMenuDescription);
          bluetooth.unobserve('numberOfPairedDevices',
            this._boundRefreshMenuDescription);
        }
      }.bind(this));
    }
  };

  return function ctor_bluetoothItem(element) {
    return new BluetoothItem(element);
  };
});

/**
 * The moudle supports displaying battery information on an element.
 *
 * @module panels/root/battery_item
 */
define('panels/root/battery_item',['require','modules/battery'],function(require) {
  

  var Battery = require('modules/battery');

  /**
   * @alias module:panels/root/battery_item
   * @class BatteryItem
   * @requires module:modules/battery
   * @param {HTMLElement} element
                          The element displaying the battery information
   * @returns {BatteryItem}
   */
  function BatteryItem(element) {
    this._enabled = false;
    this._element = element;
    this._boundRefreshText = this._refreshText.bind(this, element);
  }

  BatteryItem.prototype = {
    /**
     * Refresh the text based on the Battery module.
     *
     * @access private
     * @memberOf BatteryItem.prototype
     * @param {HTMLElement} element
                            The element displaying the battery information
     */
    _refreshText: function b_refreshText(element) {
      if (!navigator.mozL10n) {
        return;
      }

      navigator.mozL10n.setAttributes(element,
        'batteryLevel-percent-' + Battery.state, { level: Battery.level });
      if (element.hidden) {
        element.hidden = false;
      }
    },

    /**
     * The value indicates whether the module is responding.
     *
     * @access public
     * @memberOf BatteryItem.prototype
     * @type {Boolean}
     */
    get enabled() {
      return this._enabled;
    },

    set enabled(value) {
      if (this._enabled === value) {
        return;
      }
      
      this._enabled = value;
      if (this._enabled) {
        Battery.observe('level', this._boundRefreshText);
        Battery.observe('state', this._boundRefreshText);
        this._boundRefreshText();
      } else {
        Battery.unobserve('level', this._boundRefreshText);
        Battery.unobserve('state', this._boundRefreshText);
      }
    }
  };

  return function ctor_batteryItem(element) {
    return new BatteryItem(element);
  };
});

/* global DeviceStorageHelper, openIncompatibleSettingsDialog */
/**
 * Links the root panel list item with USB Storage.
 *
 * XXX bug 973451 will remove media storage part
 */
define('panels/root/storage_usb_item',['require','shared/settings_listener','shared/async_storage','modules/settings_service','modules/app_storage'],function(require) {
  

  var SettingsListener = require('shared/settings_listener');
  var AsyncStorage = require('shared/async_storage');
  var SettingsService = require('modules/settings_service');
  var AppStorage = require('modules/app_storage');

  const MIN_MEDIA_FREE_SPACE_SIZE = 10 * 1024 * 1024;
  const TOTAL_SIZE = 4 * 1024 * 1024 * 1024;

  /**
   * @alias module:panels/root/storage_usb_item
   * @class USBStorageItem
   * @param {Object} elements
                     elements displaying the usb and media storage information
   * @returns {USBStorageItem}
   */
  function USBStorageItem(elements) {
    this._enabled = false;
    this._elements = elements;
    this._umsSettingKey = 'ums.enabled';
    // XXX media related attributes
    this._defaultMediaVolume = null;
    this._anotherMediaVolume = null;
    this._volumes = null;
    this._defaultVolumeState = 'available';
    this._boundUmsSettingHandler = this._umsSettingHandler.bind(this);
    this._updateSystemSpace = this._updateSystemSpace.bind(this);
    this.umsEnabled = false;
    this.storage = {
      mediaSize: 0,
      totalSize: TOTAL_SIZE
    };
  }

  USBStorageItem.prototype = {
    /**
     * The value indicates whether the module is responding. If it is false,
     * the UI stops reflecting the updates from the root panel context.
     *
     * @access public
     * @memberOf USBStorageItem.prototype
     * @type {Boolean}
     */
    get enabled() {
      return this._enabled;
    },

    set enabled(value) {
      if (this._enabled === value) {
        return;
      } else {
        this._enabled = value;
      }
      if (value) { //observe
        SettingsDBCache.getSettings((result) => {
          this.umsEnabled = result[this._umsSettingKey];
          this._updateUmsDesc();
        });

        SettingsListener.observe(this._umsSettingKey, false,
          this._boundUmsSettingHandler);
        window.addEventListener('localized', this);

        DeviceFeature.ready(() => {
          this._mediaVolumeChangeHandler();

          var size = DeviceFeature.getValue('totalSize');
          this.storage.totalSize = parseInt(size);
          var el = document.getElementById('header-internal-size');
          DeviceStorageHelper.showFormatedSize(el,
            'storage-name-internal-size', this.storage.totalSize);
          this._updateSystemSpace();

          AppStorage.storage.observe('totalSize', this._updateSystemSpace);
        });
        // register USB storage split click handler
      } else { //unobserve
        AppStorage.storage.unobserve('totalSize', this._updateSystemSpace);

        SettingsListener.unobserve(this._umsSettingKey,
          this._boundUmsSettingHandler);
        window.removeEventListener('localized', this);
      }
    },

    _umsSettingHandler: function storage_umsSettingHandler(enabled) {
      this.umsEnabled = enabled;
      this._updateUmsDesc();
    },
    handleEvent: function storage_handleEvent(evt) {
      switch (evt.type) {
        case 'localized':
          this._updateMediaStorageInfo();
          this._updateAnotherMediaStorageInfo();
          break;
        case 'change':
            // we are handling storage state changes
            // possible state: available, unavailable, shared
          if ('sdcard' === evt.target.storageName) {
            this._updateMediaStorageInfo();
          } else {
            this._updateAnotherMediaStorageInfo();
          }

          break;
      }
    },

    // ums description
    _updateUmsDesc: function storage_updateUmsDesc() {
      var key;
      if (this.umsEnabled) {
        //TODO list all enabled volume name
        key = 'enabled';
      } else if (this._defaultVolumeState === 'shared') {
        key = 'umsUnplugToDisable';
      } else {
        key = 'disabled';
      }
      this._elements.usbEnabledInfoBlock.setAttribute('data-l10n-id', key);
    },

    _umsMasterSettingChanged: function storage_umsMasterSettingChanged(evt) {
      var checkbox = evt.target;
      var cset = {};
      var warningKey = 'ums-turn-on-warning';

      if (checkbox.checked) {
        AsyncStorage.getItem(warningKey, function(showed) {
          if (!showed) {
            this._elements.umsWarningDialog.hidden = false;

            this._elements.umsConfirmButton.onclick = function() {
              AsyncStorage.setItem(warningKey, true);
              this._elements.umsWarningDialog.hidden = true;

              SettingsDBCache.getSettings(
                this._openIncompatibleSettingsDialogIfNeeded.bind(this));
            }.bind(this);

            this._elements.umsCancelButton.onclick = function() {
              cset[this._umsSettingKey] = false;
              Settings.mozSettings.createLock().set(cset);

              checkbox.checked = false;
              this._elements.umsWarningDialog.hidden = true;
            }.bind(this);
          } else {
            SettingsDBCache.getSettings(
              this._openIncompatibleSettingsDialogIfNeeded.bind(this));
          }
        }.bind(this));
      } else {
        cset[this._umsSettingKey] = false;
        Settings.mozSettings.createLock().set(cset);
      }
    },

    _openIncompatibleSettingsDialogIfNeeded:
      function storage_openIncompatibleSettingsDialogIfNeeded(settings) {
        var cset = {};
        var umsSettingKey = this._umsSettingKey;
        var usbTetheringSetting = settings['tethering.usb.enabled'];

        if (!usbTetheringSetting) {
          cset[umsSettingKey] = true;
          Settings.mozSettings.createLock().set(cset);
        } else {
          var oldSetting = 'tethering.usb.enabled';
          openIncompatibleSettingsDialog('incompatible-settings-warning',
            umsSettingKey, oldSetting, null);
        }
    },

    // XXX media related functions
    _mediaVolumeChangeHandler:
      function storage_mediaVolumeChangeHandler(defaultName) {
      this._defaultMediaVolume = this._getDefaultVolume(defaultName);
      this._defaultMediaVolume.addEventListener('change', this);
      this._updateMediaStorageInfo();
      if (this._volumes.length > 1 &&
        (DeviceFeature.getValue('sdCardStatus') === 'available')) {
        this._elements.mediaStorageSDHeader.classList.remove('hidden');
        this._elements.mediaStorageSDUl.classList.remove('hidden');
        this._anotherMediaVolume = this._getAnotherVolume();
        this._anotherMediaVolume.addEventListener('change', this);
        this._updateAnotherMediaStorageInfo();
      }
    },

    // Media Storage
    _updateMediaStorageInfo: function storage_updateMediaStorageInfo() {
      if (!this._defaultMediaVolume) {
        return;
      }

      var self = this;
      this._defaultMediaVolume.available().onsuccess = function(evt) {
        var state = evt.target.result;
        var firstVolume = navigator.getDeviceStorages('sdcard')[0];
        // if the default storage is unavailable, and it's not the
        // internal storage, we show the internal storage status instead.
        if (state === 'unavailable' &&
          self._defaultMediaVolume.storageName !== firstVolume.storageName) {
          firstVolume.available().onsuccess = function(e) {
            self._updateVolumeState(firstVolume, e.target.result);
          };
        } else {
          self._updateVolumeState(self._defaultMediaVolume, state);
        }
      };
    },

    // Media Storage
    _updateAnotherMediaStorageInfo:
      function storage_updateAnotherMediaStorageInfo() {
      if (!this._anotherMediaVolume) {
        return;
      }
      var self = this;
      this._anotherMediaVolume.available().onsuccess = function(evt) {
        var state = evt.target.result;
          self._updateAnotherVolumeState(self._anotherMediaVolume, state);
      };
    },

    _updateAnotherVolumeState:
      function storage_updateAnotherVolumeState(volume, state) {
      var el = this._elements.mediaStorageDesc;
      if (volume.storageName !== 'sdcard') {
        el = this._elements.mediaStorageSDDesc;
      }
      switch (state) {
        case 'available':
          this._updateMediaFreeSpace(volume);
          this._lockMediaStorageMenu(volume, false);
          break;

        case 'shared':
          el.removeAttribute('data-l10n-id');
          el.textContent = '';
          this._lockMediaStorageMenu(volume, false);
          break;

        case 'unavailable':
          el.setAttribute('data-l10n-id',
            'no-storage');
          this._lockMediaStorageMenu(volume, true);
          break;
      }
    },

    _updateVolumeState: function storage_updateVolumeState(volume, state) {
      this._defaultVolumeState = state;
      this._updateUmsDesc();
      var el = this._elements.mediaStorageDesc;
      if (volume.storageName !== 'sdcard') {
        el = this._elements.mediaStorageSDDesc;
      }
      switch (state) {
        case 'available':
          this._updateMediaFreeSpace(volume);
          this._lockMediaStorageMenu(volume, false);
          break;

        case 'shared':
          el.removeAttribute('data-l10n-id');
          el.textContent = '';
          this._lockMediaStorageMenu(volume, false);
          break;

        case 'unavailable':
          el.setAttribute('data-l10n-id', 'no-storage');
          this._lockMediaStorageMenu(volume, true);
          break;
      }
    },

    _updateMediaFreeSpace: function storage_updateMediaFreeSpace(volume) {
      var self = this;
      var results = {};
      volume.usedSpace().onsuccess = function(e) {
        results['used'] = e.target.result;
        volume.totalSpace().onsuccess = function(e) {
          var element = self._elements.mediaStorageDesc;
          if (volume.storageName !== 'sdcard') {
            element = self._elements.mediaStorageSDDesc;
          }
          results['total'] = e.target.result;
          self.storage.mediaSize = e.target.result;
          if (volume.storageName === 'sdcard') {
            self._updateSystemSpace();
          }

          if (volume.storageName !== 'sdcard') {
            var el = document.getElementById('header-external-size');
            DeviceStorageHelper.showFormatedSize(el,
              'storage-name-external-0-size',
              results['total']);
          }
          DeviceStorageHelper.showFormatedSizeOfUsedAndTotal(element,
            'usedOfTotal', results);
          if (e.target.result < MIN_MEDIA_FREE_SPACE_SIZE) {
            element.parentNode.setAttribute('data-state', 'no-space');
          } else {
            element.parentNode.setAttribute('data-state', '');
          }
        };
      };
    },

    _updateSystemSpace: function storage_updateSystemSpace() {
      if (!AppStorage.storage.totalSize) {
        return;
      }

      var element = this._elements.systemStorageDesc;
      var systemSize = this.storage.totalSize - this.storage.mediaSize -
        AppStorage.storage.totalSize;
      //JWJ if follow the algorithm, we will get a negative value that will make
      //DeviceStorageHelper.showFormatedSize not show the value
      systemSize = 1829682647;
      DeviceStorageHelper.showFormatedSize(element,
        'storageSize', parseInt(systemSize));
    },

    _lockMediaStorageMenu: function storage_setMediaMenuState(volume, lock) {
      var el = this._elements.mediaStorageSection;
      if (volume.storageName !== 'sdcard') {
        el = this._elements.mediaStorageSDSection;
      }

      if (lock) {
        el.setAttribute('aria-disabled', true);
        el.classList.add('none-select');
        el.querySelector("a").removeAttribute("href");
      } else {
        el.removeAttribute('aria-disabled');
        el.classList.remove('none-select');
        el.querySelector('a').setAttribute('href',"#mediaStorageDesc");
      }
    },

    // util function
    _getAnotherVolume: function storage_getAnotherVolume() {
      for (var i = 0; i < this._volumes.length; ++i) {
        if (this._volumes[i].storageName !==
          this._defaultMediaVolume.storageName) {
          return this._volumes[i];
        }
      }
      return this._volumes[1];
    },

    // util function
    _getDefaultVolume: function storage_getDefaultVolume(name) {
      // Per API design, all media type return the same volumes.
      // So we use 'sdcard' here for no reason.
      // https://bugzilla.mozilla.org/show_bug.cgi?id=856782#c10
      var volumes = navigator.getDeviceStorages('sdcard');
      this._volumes = volumes;
      if (!name || name === '') {
        return volumes[0];
      }
      for (var i = 0; i < volumes.length; ++i) {
        if (volumes[i].storageName === name) {
          return volumes[i];
        }
      }
      return volumes[0];
    }
  };

  return function ctor_usb_storage_item(elements) {
    return new USBStorageItem(elements);
  };
});

/* global DeviceStorageHelper */
/**
 * Links the root panel list item with AppStorage.
 */
define('panels/root/storage_app_item',['require','modules/app_storage'],function(require) {
  

  var AppStorage = require('modules/app_storage');
  const MIN_APP_FREE_SPACE_SIZE = 50 * 1024 * 1024;

  /**
   * @alias module:panels/root/storage_app_item
   * @class AppStorageItem
   * @requires module:modules/app_storage
   * @param {HTMLElement} element
                          The element displaying the app storage information
   * @returns {AppStorageItem}
   */
  function AppStorageItem(element) {
    this._enabled = false;
    this._element = element;
    this._boundUpdateAppFreeSpace = this._updateAppFreeSpace.bind(this);
    this._boundUpdateLowSpaceDisplay = this._updateLowSpaceDisplay.bind(this);
  }

  AppStorageItem.prototype = {
    /**
     * The value indicates whether the module is responding. If it is false,
     * the UI stops reflecting the updates from the root panel context.
     *
     * @access public
     * @memberOf AppStorageItem.prototype
     * @type {Boolean}
     */
    get enabled() {
      return this._enabled;
    },

    set enabled(value) {
      if (this._enabled === value) {
        return;
      } else {
        this._enabled = value;
      }
      if (value) { //observe
        AppStorage.storage.observe('usedSize', this._boundUpdateAppFreeSpace);
        AppStorage.storage.observe('usedPercentage',
          this._boundUpdateLowSpaceDisplay);
        this._updateAppFreeSpace();
        window.addEventListener('localized', this);
      } else { //unobserve
        AppStorage.storage.unobserve('usedSize',
          this._boundUpdateAppFreeSpace);
        AppStorage.storage.unobserve('usedPercentage',
          this._boundUpdateLowSpaceDisplay);
        window.removeEventListener('localized', this);
      }
    },

    _updateLowSpaceDisplay: function storage__updateUsePercentage() {
      if (AppStorage.storage.freeSize < MIN_APP_FREE_SPACE_SIZE) {
        this._element.parentNode.setAttribute('data-state', 'no-space');
      } else {
        this._element.parentNode.setAttribute('data-state', '');
      }
    },

    // Application Storage
    _updateAppFreeSpace: function storage_updateAppFreeSpace() {
      var results = {};
      results['used'] = AppStorage.storage.usedSize;
      results['total'] = AppStorage.storage.totalSize;
      DeviceStorageHelper.showFormatedSizeOfUsedAndTotal(this._element,
        'usedOfTotal', results);
      this._updateLowSpaceDisplay();
    },

    handleEvent: function storage_handleEvent(evt) {
      switch (evt.type) {
        case 'localized':
          this._updateAppFreeSpace();
          break;
      }
    }
  };

  return function ctor_app_storage_item(element) {
    return new AppStorageItem(element);
  };
});

define('panels/root/wifi_item',['require','modules/wifi_context'],function(require) {
  

  var WifiContext = require('modules/wifi_context');
  var wifiManager = navigator.mozWifiManager;

  function WifiItem(element) {
    this._enabled = false;
    this._boundUpdateWifiDesc = this._updateWifiDesc.bind(this, element);
  }

  WifiItem.prototype = {
    set enabled(value) {
      if (value === this._enabled || !wifiManager) {
        return;
      }

      this._enabled = value;
      if (this._enabled) {
        this._boundUpdateWifiDesc();
        WifiContext.addEventListener('wifiStatusTextChange',
          this._boundUpdateWifiDesc);
      } else {
        WifiContext.removeEventListener('wifiStatusTextChange',
          this._boundUpdateWifiDesc);
      }
    },

    get enabled() {
      return this._enabled;
    },

    _updateWifiDesc: function root_updateWifiDesc(element) {
      if (WifiContext.wifiStatusText.id === 'disabled') {
        element.setAttribute('data-l10n-id', 'off');
      } else {
        element.setAttribute('data-l10n-id', 'on');
      }
    }
  };

  return function ctor_wifiItem(element) {
    return new WifiItem(element);
  };
});

/**
 * This module contains modules for the low priority items in the root panel.
 * The module should only be loaded after the menu items are ready for user
 * interaction.
 *
 * @module panels/root/low_priority_items
 */
define('panels/root/low_priority_items',['require','panels/root/bluetooth_item','panels/root/battery_item','panels/root/storage_usb_item','panels/root/storage_app_item','panels/root/wifi_item'],function(require) {
  

  var items = {
    BluetoothItem: require('panels/root/bluetooth_item'),
    BatteryItem: require('panels/root/battery_item'),
    StorageUSBItem: require('panels/root/storage_usb_item'),
    StorageAppItem: require('panels/root/storage_app_item'),
    WifiItem: require('panels/root/wifi_item')
  };

  return {
    get BluetoothItem()    { return items.BluetoothItem; },
    get BatteryItem()      { return items.BatteryItem; },
    get StorageUSBItem()   { return items.StorageUSBItem; },
    get StorageAppItem()   { return items.StorageAppItem; },
    get WifiItem()         { return items.WifiItem; }
  };
});
