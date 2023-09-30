(function(exports) {
  
  var SettingsApp = function() {
    this.params = [{
        name: 'timer.sound',
        value: 'ac_woody.ogg'
    }, {
        name: 'timer.vibration',
        value: true
    }, {
        name: 'alarm.snooze',
        value: 10
    }, {
        name: 'alarm.sound',
        value: 'ac_woody.ogg'
    }];
  };

  SettingsApp.prototype.normalizeVibrateAndSoundSettings = function(buzzer, sounds) {
    // Pre-April-2014 code may have stored 'vibrate' and 'sound' as the string "0"
    buzzer.sound = sounds.normalizeSound(buzzer.sound !== '0' ? buzzer.sound : null);
    buzzer.vibrate = ((typeof buzzer.vibrate) === 'boolean' ? buzzer.vibrate :
                     ((typeof buzzer.vibrate) === 'string') && (buzzer.vibrate !== '0'));
  };

  SettingsApp.prototype.getValue = function(name) {
    try {
      return this.params.find(item => {
        return item.name == name
      }).value;
    } catch (e) {
      console.log(e);
    }
  };
  SettingsApp.prototype.setValue = function(name, value) {
    try {
      this.params.find(item => {
        return item.name == name
      }).value = value;
    } catch (e) {
      console.log(e);
    }
  };
  SettingsApp.prototype.save = function(name, value) {
    if (name !== undefined && value !== undefined) {
      var toSet = {};
      toSet[name] = value;
      this.setValue(name, value);
      window.navigator.mozSettings.createLock().set(toSet);
    } else {
      this.params.forEach(function(element, index) {
        var toSet = {};
        toSet[element.name] = element.value;
        window.navigator.mozSettings.createLock().set(toSet);
      });
    }
  };
  SettingsApp.prototype.init = function() {
    var self = this;
    var lock = navigator.mozSettings.createLock();
    this.params.forEach(function(element, index) {
      var req = lock.get(element.name);
      req.onsuccess = function() {
        if (req.result[element.name] === undefined) {
          var toSet = {};
          toSet[element.name] = element.value;
          window.navigator.mozSettings.createLock().set(toSet);
        } else if (req.result[element.name] !== element.value) {
          element.value = req.result[element.name];
        }
      }
      req.onerror = function() {}
    });
  };
  exports.SettingsApp = new SettingsApp();
  exports.SettingsApp.init();
})(window);
