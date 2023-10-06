/* global BaseModule, OperatorVariantHandler, SIMSlotManager */
'use strict';

/**
 * Singleton object that helps to set some carrier-specific settings on boot.
 * Detects the ICC cards on boot and creates objects in charge of setting
 * some operator-specific settings relying on the ICC card.
 */
(function() {
  var OperatorVariantManager = function(core) {
    /** Array of OperatorVariantHandler objects. */
    if (core) {
      this.mobileConnections = core.mobileConnections;
    }
    this.operatorVariantHandlers = [];
  };
  OperatorVariantManager.IMPORTS = [
    'js/operator_variant_handler.js'
  ];
  OperatorVariantManager.EVENTS = [
    'simslot-updated',
    'simslot-iccinfochange'
  ];
  BaseModule.create(OperatorVariantManager, {
    name: 'OperatorVariantManager',
    _start: function() {
      this.updateDeviceInfoOs = this.updateDeviceInfoOs.bind(this);
      // Add observer before readSetting('deviceinfo.os'),
      // because when first start-up, 'deviceinfo.os' value is '', gecko will
      // set 'deviceinfo.os' success before call OperatorVariantManager.init()
      // in some platform, e.x. 256M platform.
      navigator.mozSettings.addObserver('deviceinfo.os', this.updateDeviceInfoOs);
      Promise.all([
        this.ensureValueUnderKeyIsArray('ril.iccInfo.mbdn'),
        this.ensureValueUnderKeyIsArray('ril.cellbroadcast.disabled'),
        this.ensureValueUnderKeyIsArray('ril.cellbroadcast.searchlist'),
        this.readSetting('deviceinfo.os')
      ]).then(function(result) {
        this.deviceInfoOs = result[3];
        this.init();
      }.bind(this));
    },

    _stop: function() {
      this._operatorVariantHandlers = [];
    },

    '_handle_simslot-updated': function(evt) {
      var simslot = evt.detail;
      this._updateOperatorVariantHandler(simslot);
    },

    '_handle_simslot-iccinfochange': function(evt) {
      var simslot = evt.detail;
      this._updateOperatorVariantHandler(simslot);
    },

    _updateOperatorVariantHandler: function(simslot) {
      if (!this._isVariantReady(simslot)) {
         return;
      }
      if (!this.operatorVariantHandlers[simslot.index]) {
        this.operatorVariantHandlers[simslot.index] =
          new OperatorVariantHandler(simslot.simCard.iccInfo.iccid,
            simslot.index, this);
        this.operatorVariantHandlers[simslot.index].start();
      }
    },

    _isVariantReady: function(simslot) {
      if (!simslot.simCard ||
          !simslot.simCard.iccInfo ||
          !simslot.simCard.iccInfo.iccid) {
        this.operatorVariantHandlers[simslot.index] = null;
        return false;
      } else if (!this.deviceInfoOs) {
        return false;
      }
      return true;
    },

    init: function() {
      if (this.deviceInfoOs) {
        navigator.mozSettings.removeObserver('deviceinfo.os', this.updateDeviceInfoOs);
        SIMSlotManager.getSlots().forEach(function(slot) {
          this._updateOperatorVariantHandler(slot);
        }, this);
      }
    },

    updateDeviceInfoOs: function(){
      var lock = navigator.mozSettings.createLock();
      var req = lock.get('deviceinfo.os');
      req.onsuccess = () => {
        this.deviceInfoOs = req.result && req.result['deviceinfo.os'] || '';
        this.init();
      };
    },

    /**
     * Helper function. Ensure the value stored under the specified key is an
     * array.
     */
    ensureValueUnderKeyIsArray: function(key) {
      return new Promise(function(resolve, reject) {
        this.readSetting(key).then(function(value) {
          var originalSetting = value;
          var newSetting = null;
          if (!originalSetting) {
            newSetting = ['', ''];
          } else if (!Array.isArray(originalSetting)) {
            // Migrate settings field if needed
            newSetting = [originalSetting, ''];
          }

          if (newSetting) {
            var obj = {};
            obj[key] = newSetting;
            this.writeSetting(obj).then(function() {
              resolve();
            }, function() {
              resolve();
            });
          } else {
            resolve();
          }
        }.bind(this), function() {
          resolve();
        }.bind(this));
      }.bind(this));
    }
  });
})();
