define(['require','modules/settings_panel'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  return function reset_phone_progress_settings_panel() {

    function _doFactoryReset() {
      var power = navigator.mozPower;
      if (!power) {
        console.error('Cannot get mozPower');
        return;
      }

      if (!power.factoryReset) {
        console.error('Cannot invoke mozPower.factoryReset()');
        return;
      }
      power.factoryReset();

      IsFactoryReset = false;
    }

    function _hexString2byte(str) {
      var a = [];
      for(var i = 0, len = str.length; i < len; i+=2) {
        a.push(parseInt(str.substr(i, 2), 16));
      }
      return new Uint8Array(a);
    }

    function _resetSecureElement() {
      var AID = {
        CRS: "A00000015143525300",
      };

      var APDU = {
        nxp: {
          reset: { cla: 0x80, ins: 0xC3, p1: 0x04, p2: 0x00, le: 0x00}
        }
      };
      if (!window.navigator.seManager) {
        _doFactoryReset();
        return;
      }

      window.navigator.seManager.getSEReaders()
      .then((readers) => {
        window.reader = readers[0];
        return readers[0].openSession();
      })
      .then((session) => {
        window.testSession = session;
        return session.getAtr();
      })
      .then((result) => {
        return window.testSession.openBasicChannel(_hexString2byte(AID.CRS));
      })
      .then((channel) => {
        window.testChannel = channel;
        return channel.transmit(APDU.nxp.reset);
      })
      .then((response) => {
        window.reader.closeAll()
        .then(()=>{
          _doFactoryReset();
        })
        .catch(()=>{
          _doFactoryReset();
        })
      })
      .catch((err) => {
        window.reader.closeAll()
        .then(()=>{
          _doFactoryReset();
        })
        .catch(()=>{
          _doFactoryReset();
        })
      });
    }

    function _factoryReset() {
      IsFactoryReset = true;

      let nfc_enabled = navigator.engmodeExtension.getPropertyValue("ro.moz.nfc.enabled");
      if (nfc_enabled != 'true') {
        _doFactoryReset();
        return;
      }

      let nfc = window.navigator.mozNfc;
      if (!nfc) {
        _doFactoryReset();
        return;
      }

      let lock = navigator.mozSettings.createLock();
      let setting = lock.get('nfc.enabled');
      setting.onsuccess = function () {
        let enabled = this.result['nfc.enabled'];
        if (enabled) {
          _resetSecureElement();
          return;
        }
        let lock = navigator.mozSettings.createLock();
        let writeSetting = lock.set({'nfc.enabled': true});
        writeSetting.onsuccess = function () {
          let count = 0;
          let check = function () {
            if (!nfc.enabled) {
              if (count++ < 15) {
                window.setTimeout(check, 1000);
                return;
              }
              _doFactoryReset();
              return;
            }
            _resetSecureElement();
          };

          window.setTimeout(check, 1000);
        };

        writeSetting.onerror = function () {
          _doFactoryReset();
        };
      };

      setting.onerror = function () {
        _doFactoryReset();
      };
    }

    function HWKhandler(e) {
      if (e.key === 'Backspace') {
        // Prevent Settings app from being killed by system app.
        if (IsFactoryReset) {
          e.preventDefault();
        }
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
      },

      onBeforeShow: function() {
        window.addEventListener('keydown', HWKhandler);
        SettingsSoftkey.hide();
        _factoryReset();
      },

      onBeforeHide: function() {
        window.removeEventListener('keydown', HWKhandler);
      }
    });
  };
});
