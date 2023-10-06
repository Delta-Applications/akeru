/* global BaseModule, SimSettingsHelper, SIMSlotManager */
'use strict';

(function() {
  // Responsible to load and init the sub system for mobile connections.
  var MobileConnectionCore = function(mobileConnections, core) {
    this.core = core;
    this.mobileConnections = mobileConnections;
  };
  //MobileConnectionCore.IMPORTS = [
  //  'shared/js/simslot.js',
  //  'shared/js/simslot_manager.js'
  //];
  MobileConnectionCore.SUB_MODULES = [
    'Radio',
    'CallForwarding',
    'EmergencyCallbackManager',
    'EuRoamingManager',
    'TelephonySettings',
    'OperatorVariantManager',
    'InternetSharing',
    'CellBroadcastSystem'
  ];

  MobileConnectionCore.SERVICES = [
    'showWifiCallNotification',
    'clearWifiCallNotification'
    //[BTS-126] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.begin
    ,'showWifiCallMissEccNotification',
    'clearWifiCallMissEccNotification'
    //[BTS-126] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.end
  ];

  BaseModule.create(MobileConnectionCore, {
    name: 'MobileConnectionCore',

    _start: function() {
      //[CNT-693] BDC yuxin delete for Single SIM device cannot restart after hot-plug in/plug out SIM card. begin
      // we have to make sure we are in DSDS
      //original
      //if (SIMSlotManager.isMultiSIM()) {
      //  BaseModule.lazyLoad(['SimSettingsHelper']).then(function() {
      //    this.debug('lazily load SimSettingsHelper');
      //    this.simSettingsHelper = SimSettingsHelper;
      //    this.simSettingsHelper.start();
      //  }.bind(this));
      //}
      BaseModule.lazyLoad(['SimSettingsHelper']).then(function() {
        this.debug('lazily load SimSettingsHelper');
        this.simSettingsHelper = SimSettingsHelper;
        this.simSettingsHelper.start();
      }.bind(this));
      //[CNT-693] BDC yuxin delete for Single SIM device cannot restart after hot-plug in/plug out SIM card. end

      this.clearWifiCallNotification();
      //[BTS-126] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.begin
      this.clearWifiCallMissEccNotification();
      //[BTS-126] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.end
    },

    // XXX: move to standalone module
    showWifiCallNotification: function(index) {
      var imsRegHandler = navigator.mozMobileConnections[index].imsHandler;
      var _ = navigator.mozL10n.get;
      var icon = window.location.protocol + '//' + window.location.hostname +
        '/style/icons/captivePortal.png';
      var notification = new Notification('', {
        body: _('wifiCallErrorMsg', {error: imsRegHandler.unregisteredReason}),
        icon: icon,
        tag: 'wificall',
        mozbehavior: {
          showOnlyOnce: true
        }
      });
      notification.onclick = function() {
        Service.request('updateWifiCallState', { state: '' });
        const settingsAppURL = 'app://settings.gaiamobile.org/manifest.webapp';
        let app = applications.getByManifestURL(settingsAppURL);
        app && app.launch();
        notification.close();
      }.bind(this);
    },

    clearWifiCallNotification: function() {
      Notification.get().then(function(notifications) {
        notifications.forEach(function(notification) {
          var tag = notification && notification.tag;
          if (!tag || tag !== 'wificall') {
            return;
          }
          notification.close();
        });
      });
    }
    //[BTS-126] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.begin
    ,
    showWifiCallMissEccNotification: function(opt) {
      var _ = navigator.mozL10n.get;
      var icon = window.location.protocol + '//' + window.location.hostname + '/style/icons/captivePortal.png';
	  var titleText = _('wifiCallMissEccTitle', {operator: opt});
      var contentText = _('wifiCallMissEccMsg');
      var notification = new Notification(titleText, {
        body: contentText,
        icon: icon,
        tag: 'wificall-miss-ecc',
        mozbehavior: {
          noclear: true
        }
      });
      notification.onclick = function() {
        Service.request('DialogService:show', {header: titleText, content: contentText, type: 'alert', translated: true});
      }.bind(this);
    },

    clearWifiCallMissEccNotification: function() {
      Notification.get().then(function(notifications) {
        notifications.forEach(function(notification) {
          var tag = notification && notification.tag;
          if (!tag || tag !== 'wificall-miss-ecc') {
            return;
          }
          notification.close();
        });
      });
    }
    //[BTS-126] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.end
  });
}());
