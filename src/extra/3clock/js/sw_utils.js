const Utils = {
  servicesArray: [
    'settingsService'
  ],

  initSession: function() {
    return new Promise((resolver) => {
      window.libSession.initService(this.servicesArray).then(() => {
        SettingsObserver.init();
        resolver();
      });
    });
  },

  getSettingsValue: function(settingName) {
    return SettingsObserver.getValue(settingName);
  },

  setSettingsValue: function(settings) {
    return SettingsObserver.setValue(settings);
  }
};