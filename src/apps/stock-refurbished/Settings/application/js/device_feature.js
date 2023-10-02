/* (c) 2017 KAI OS TECHNOLOGIES (HONG KONG) LIMITED All rights reserved. This
 * file or any portion thereof may not be reproduced or used in any manner
 * whatsoever without the express written permission of KAI OS TECHNOLOGIES
 * (HONG KONG) LIMITED. KaiOS is the trademark of KAI OS TECHNOLOGIES (HONG KONG)
 * LIMITED or its affiliate company and may be registered in some jurisdictions.
 * All other trademarks are the property of their respective owners.
 */
(function(exports) {
  

  const STORAGE_MAP = {
    'version': 'featureVersion',
    'wifi': 'isSupportWifiDevice',
    'bt' : 'isSupportBtDevice',
    'gps':'isSupportGpsDevice',
    'voWifi': 'isSupportVowifiDevice',
    'voLte': 'isSupportVolteDevice',
    'primarySim': 'isSupportPrimarysimSwitch',
    'rtt': 'isSupportRtt',
    'lowMemory': 'isLowMemoryDevice',
    'totalSize': 'deviceStorageSize',
    'sdCardStatus': 'sdcardStatus',
    'firstHotspot': 'isFirstTimeUseHotspot',
    'firstTethering': 'isFirstTimeUseTethering',
    'vilte': 'isSupportVilte',
    'readout': 'isSupportReadout',
    'deviceFinancing': 'isSupportdeviceFinancing',
    'buildType': 'buildType',
    'dual-Lte': 'isSupportDualLte'
  };
  const DEVICE_FEATURE_VERSION = '1.0.4';
  const FEATURE_EVENT_NAME = 'featureInited';
  const TOTAL_SIZE = 4 * 1024 * 1024 * 1024;
  const DELAY_TIME = 10000;

  let KEY_MAP = {
    'version': null,
    'wifi': null,
    'bt' : null,
    'gps': null,
    'voWifi': null,
    'voLte': null,
    'primarySim': null,
    'rtt': null,
    'lowMemory': null,
    'totalSize': null,
    'sdCardStatus': null,
    'firstHotspot': null,
    'firstTethering': null,
    'vilte': null,
    'readout': null,
    'deviceFinancing': null,
    'buildType': null,
    'dual-Lte': null
  };

  let deviceFeature = {
    ready: function(cb) {
      if (this.getValue('version') === null) {
        window.addEventListener(FEATURE_EVENT_NAME, function onChangeEvent() {
          window.removeEventListener(FEATURE_EVENT_NAME, onChangeEvent);
          cb();
        });
      } else {
        cb();
      }
    },

    init: function () {
      if (this.getValue('version') !== DEVICE_FEATURE_VERSION) {
        this.initFeature();
      } else {
        setTimeout(() => {
          this.initFeature();
      }, DELAY_TIME);
      }
    },

    getValue : function getValue(key) {
      return KEY_MAP[key] || localStorage.getItem(STORAGE_MAP[key]);
    },

    initFeature: function df_initFeature() {
      let promiseList = this.createFeaturePromise();
      Promise.all(promiseList).then((values) => {
        this.setLocalStorageItem('wifi', values[0]);
        this.setLocalStorageItem('bt', values[1]);
        this.setLocalStorageItem('gps', values[2]);
        this.setLocalStorageItem('voWifi', values[3]);
        this.setLocalStorageItem('voLte', values[4]);
        this.setLocalStorageItem('primarySim', values[5]);
        this.setLocalStorageItem('rtt', values[6]);
        this.setLocalStorageItem('vilte', values[7]);
        this.setLocalStorageItem('readout', values[8]);
        this.setLocalStorageItem('deviceFinancing', values[9]);
        this.setLocalStorageItem('dual-Lte', values[10]);
        if (values[11] <= 256) {
          this.setLocalStorageItem('lowMemory', true);
        } else {
          this.setLocalStorageItem('lowMemory', false);
        }
        if (values[12]) {
          let deviceTotalSize = values[12] * 1024 * 1024;
          this.setLocalStorageItem('totalSize', deviceTotalSize);
        } else {
          let deviceTotalSize = TOTAL_SIZE;
          this.setLocalStorageItem('totalSize', deviceTotalSize);
        }
        this.setLocalStorageItem('buildType', values[13]);

        this.setLocalStorageItem('version', DEVICE_FEATURE_VERSION);
        window.dispatchEvent(new CustomEvent(FEATURE_EVENT_NAME));
      });
    },

    setLocalStorageItem: function df_setLocalStorageItem (key, value) {
      try {
        localStorage.setItem(STORAGE_MAP[key], value);
      } catch (e) {
        console.error('Failed to save localStorage: ' + e);
      }
      KEY_MAP[key] = value + '';
    },

    createFeaturePromise: function df_createFeaturePromise() {
      let getFeatureList = [
        'device.capability.wifi',
        'device.capability.bt',
        'device.capability.gps',
        'device.capability.vowifi',
        'device.capability.volte',
        'ril.support.primarysim.switch',
        'device.capability.rtt',
        'device.capability.vilte',
        'device.capability.readout',
        'device.capability.device-financing',
        'device.capability.dual-lte'
      ];
      let hasFeatureList = [
        'hardware.memory',
        'device.storage.size',
        'build.type'
      ];
      let promiseList = [];
      getFeatureList.forEach(function (key) {
        promiseList.push(DeviceFeature._getDeviceCapability(key));
      });
      hasFeatureList.forEach(function (key) {
        promiseList.push(DeviceFeature._getDeviceInfo(key));
      });
      return promiseList;
    },

    _getDeviceCapability : function df_getDeviceCapability(key) {
      return new Promise((resolve, reject) => {
        navigator.hasFeature(key).then(resolve);
      });
    },

    _getDeviceInfo : function df_getDeviceInfo(key) {
      return new Promise((resolve, reject) => {
        navigator.getFeature(key).then(resolve);
      });
    }
  };
  exports.DeviceFeature = deviceFeature;
  deviceFeature.init();
})(this);
