'use strict';
/* global ModalDialog */
/* global Service */

(function(exports) {

  // Local reference to mozSettings
  var settings;

  /**
   * Internet Sharing module responsible for checking the availability of
   * internet sharing based on the status of airplane mode.
   * @requires ModalDialog
   * @class InternetSharing
   */
  function InternetSharing() {}

  InternetSharing.prototype = {
    /**
     * Called whenever there is a setting change in wifi tethering.
     * Validates that we can turn internet sharing on, and saves state to
     * @memberof InternetSharing.prototype
     */
    internetSharingSettingsChangeHanlder: function(evt) {
      if (Service.query('AirplaneMode.isActive') && true === evt.settingValue) {
        var title = 'apmActivated';
        var buttonText = 'ok';
        var message ='noHotspotWhenAPMisOnWifiHotspot';

        Service.request('DialogService:show', {
          header: title,
          content: message,
          ok: buttonText,
          type: 'alert'
        });
        settings.createLock().set({
          'tethering.wifi.enabled': false
        });
      }
    },

    turnOffInternetSharing: function(value) {
      var settings = window.navigator.mozSettings;
      var setObj = {}
      if (!value || SIMSlotManager.noSIMCardOnDevice()) {
        setObj['tethering.wifi.enabled'] = false;
        setObj['tethering.usb.enabled'] = false;
        settings.createLock().set(setObj);
      }
    },

    /**
     * Starts the InternetSharing class.
     * @memberof InternetSharing.prototype
     */
    start: function() {
      settings = window.navigator.mozSettings;
      // listen changes after value is restored.
      settings.addObserver('tethering.wifi.enabled',
        this.internetSharingSettingsChangeHanlder.bind(this));
      SettingsListener.observe('ril.data.enabled', false,
        this.turnOffInternetSharing);
      navigator.usb.onusbstatuschange = (evt) => {
        if (!evt.deviceAttached) {
          var settings = window.navigator.mozSettings;
          var setObj = {}
          setObj['tethering.usb.enabled'] = false;
          settings.createLock().set(setObj);
        }
      };
      settings.createLock().set({
        'tethering.wifi.enabled': false
      });
    }
  };

  exports.InternetSharing = InternetSharing;

}(window));
