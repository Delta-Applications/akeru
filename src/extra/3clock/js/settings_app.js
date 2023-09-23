(function(exports) {
  'use strict';
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
      SettingsObserver.setValue([{name, value}]);
    } else {
      [].forEach.call(this.params, (element) => {
        var toSet = {};
        toSet[element.name] = element.value;
        SettingsObserver.setValue([
          {
            name: element.name,
            value: element.value
          }
        ]);
      });
    }
  };
  SettingsApp.prototype.init = function() {
    var self = this;
    [].forEach.call(this.params, (element) => {

      SettingsObserver.getValue(element.name).then(
        val => {
          if (val === undefined) {
            var toSet = {};
            toSet[element.name] = element.value;
            SettingsObserver.setValue([
              {
                name: element.name,
                value: element.value
              }
            ]);
          } else if (val !== element.value) {
            element.value = val;
          }
        },
        reject => {
          console.log(
            `settings_db_cache getSetting rejected:=${JSON.stringify(reject)}`
          );
          resolve(null);
        }
      );
    });
  };
  exports.SettingsApp = new SettingsApp();
  exports.SettingsApp.init();
})(window);
