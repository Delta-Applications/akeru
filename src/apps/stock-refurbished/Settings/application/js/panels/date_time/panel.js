
/**
 * Used to show Personalization/Date & Time panel
 */
define('panels/date_time/panel',['require','modules/settings_panel','modules/date_time','modules/settings_service','shared/settings_listener','shared/icc_helper'],function (require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var DateTime = require('modules/date_time');
  var SettingsService = require('modules/settings_service');
  var SettingsListener = require('shared/settings_listener');
  var IccHelper = require('shared/icc_helper');

  return function ctor_date_time_panel() {
    var HOUR_12 = 'ampm';
    var HOUR_24 = '24';

    var _enabledInput = false;
    var currentTimeZoneCity = null;
    var currentTimeZoneDst = null;
    var currentCountryCode = null;
    var tzList = null;
    var timezoneCity = null;
    var timezoneOffset = null;
    var settings = window.navigator.mozSettings;

    const DEFAULT_COUNTRY = 'US';
    const TZ_DEFAULT = 'Europe/London';
    const TIMEZONE_FILE = '/resources/tz.json';
    const APN_TZ_FILE = '/shared/resources/apn_tz.json';
    const MCC_FILE = '/shared/resources/mcc.json';
    const TIMEZONE_USER_SELECTED = 'time.timezone.user-selected';
    const TIMEZONE_KEY = 'time.timezone';
    const TIMEZONE_DST_KEY = 'time.timezone.dst';
    var listElements = document.querySelectorAll('#dateTime li');
    let currentPanel = null;

    function tz_loadJSON(href, callback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', href, true);
      xhr.responseType = 'json';
      xhr.onerror = callback;
      xhr.onload = function () {
        callback(xhr.response);
      };
      xhr.onerror = function () {
        console.error('Error getting file');
        callback(xhr.response);
      };
      xhr.send();
    }

    function tz_updateTimeZoneInfo(defaultTimezone) {
      currentTimeZoneCity = defaultTimezone;
      tz_loadJSON(TIMEZONE_FILE, function loadTZ(response) {
        tzList = response;
        if (!tz_checkCityInList(tzList, currentTimeZoneCity)) {
          currentTimeZoneCity = TZ_DEFAULT;
        }
        tz_updateTimezoneCity(currentTimeZoneCity);
        tz_updateTimezoneOffset(tzList, currentTimeZoneCity);
        setTimezone(currentTimeZoneCity);
      });
    }

    function tz_updateTimeZoneInfoAuto(defaultTimezone) {
      // Simply guess timeZoneCity by using MCC code. And this is a very rough
      // result.
      currentTimeZoneCity = defaultTimezone;
      tz_loadJSON(TIMEZONE_FILE, function loadTZ(response) {
        tzList = response;
        var timeZoneCity, dst = 0;
        SettingsDBCache.getSettings((result) => {
          timeZoneCity = result[TIMEZONE_KEY];
          dst = result[TIMEZONE_DST_KEY] || 0;
          // If setting do not set any TimeZone before, the timeZoneCity will
          // be in UTC(+/-)hh:mm format, otherwise, Country/City will be
          // expected result from settingDB.
          if (!tz_checkCityInList(tzList, timeZoneCity)) {
            var defaultOffset = timeZoneCity.substring(3, timeZoneCity.length);
            for (var i = 0; i < tzList.length; i++) {
              var offsets = tzList[i].offset.split(',');
              if (currentCountryCode == tzList[i].cc &&
                offsets[dst == 0 ? 0 : 1] == defaultOffset) {
                console.log('found city : ' + tzList[i].city + ' with dst : ' + dst);
                currentTimeZoneCity = tzList[i].city;
                currentTimeZoneDst = dst;
                tz_updateTimezoneCity(currentTimeZoneCity);
                tz_updateTimezoneOffset(tzList, currentTimeZoneCity);
                setTimezone(currentTimeZoneCity);
                break;
              }
            }
          } else {
            currentTimeZoneCity = timeZoneCity;
            tz_updateTimezoneCity(currentTimeZoneCity);
            tz_updateTimezoneOffset(tzList, currentTimeZoneCity);
            setTimezone(currentTimeZoneCity);
          }
        });
      });
    }

    function setTimezone(city) {
      // modified by hekongxia for fix LIO-1978
//      var req = settings.createLock().set({'time.timezone.user-selected': city});
      var req = settings.createLock().set({
        'time.timezone.user-selected': city,
        'time.timezone': city
      });
      req.onsuccess = function tz_set() {
        console.log('set time zone to ' + city);
      }
    }

    function tz_checkCityInList(list, city) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].city === city) {
          return true;
        }
      }
      return false;
    }

    function tz_updateTimezoneCity(city) {
      var key = city.replace(/.*?\//, '');
      timezoneCity.setAttribute('data-l10n-id', key);
    }

    function tz_updateTimezoneOffset(list, city) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].city === city) {
          var offset = list[i].offset
          // We don't use UTC DST offset to display, but only UTC offset is
          // correct enough.
          timezoneOffset.textContent = 'UTC' + offset.substring(0, offset.indexOf(','));
          var timeZoneHeader =
            document.querySelector('#dateTime .timezone-header');
          var timeZone = document.querySelector('#dateTime .timezone');
          if (timeZoneHeader.hidden) {
            timeZoneHeader.hidden = false;
            timeZone.hidden = false;
            NavigationMap.refresh();
          }
          return;
        }
      }
    }

    function tz_getCountryCode(mcc) {
      return new Promise(function (resolve, reject) {
        tz_loadJSON(MCC_FILE, function (response) {
          var cc = DEFAULT_COUNTRY;
          if (response && response[mcc]) {
            cc = response[mcc].code.toUpperCase();
          }
          resolve(cc);
        });
      });
    }

    function tz_getTimezoneCity(mcc, mnc) {
      return new Promise(function (resolve, reject) {
        tz_loadJSON(APN_TZ_FILE, function (response) {
          if (response) {
            var tz = response[mcc];
            if (typeof(tz) === 'string') {
              resolve(tz);
              return;
            } else if (tz && (mnc in tz)) {
              resolve(tz[mnc]);
              return;
            }
          }
          resolve(TZ_DEFAULT);
        });
      });
    }

    /**
     * Guess the current timezone from the MCC/MNC tuple
     */
    function tz_getDefaultTimezoneID(callback) {
      if (!callback) {
        return;
      }

      // retrieve MCC/MNC: use the current network codes when available,
      // default to the SIM codes if necessary.
      var mcc, mnc;

      var connections = window.navigator.mozMobileConnections ||
        [navigator.mozMobileConnection];

      for (var i = 0; i < connections.length; ++i) {
        var conn = connections[i];
        if (conn && conn.voice && conn.voice.network && conn.voice.connected) {
          // we have connection available, so we use it
          mcc = conn.voice.network.mcc;
          mnc = conn.voice.network.mnc;
          break;
        }
      }

      if (!mcc && IccHelper && IccHelper.iccInfo) {
        // we don't have connection available, we rely on the SIM
        mcc = IccHelper.iccInfo.mcc;
        mnc = IccHelper.iccInfo.mnc;
        // if SIM is not available, mcc and mnc are null,
        // so we wait for a future event where we have access to the SIM.
        if (IccHelper.cardState !== 'ready') {
          IccHelper.addEventListener('iccinfochange', function simReady() {
            if (IccHelper.iccInfo.mcc) {
              IccHelper.removeEventListener('iccinfochange', simReady);
            }
            tz_getDefaultTimezoneID(callback);
          });
        }
        callback(TZ_DEFAULT);
        return;
      }

      if (!mcc) {
        callback(TZ_DEFAULT);
        return;
      }

      tz_getCountryCode(mcc)
        .then((cc) => currentCountryCode = cc)
        // get setting dst here to make sure we don't have surprise
        // during on DST transition day.
        .then(() => tz_getTimezoneCity(mcc, mnc))
        .then((tzCity) => callback(tzCity));
    }

    function updateTimeZone() {
      if (DateTime.clockAutoEnabled && DateTime.clockAutoAvailable &&
        DateTime.timezoneAutoAvailable) {
        tz_getDefaultTimezoneID(tz_updateTimeZoneInfoAuto);
      } else {
        SettingsDBCache.getSettings((result) => {
          let userSelTimezone = result[TIMEZONE_USER_SELECTED];
          if (userSelTimezone) {
            currentTimeZoneCity = userSelTimezone;
            tz_updateTimezoneCity(currentTimeZoneCity);
            if (tzList) {
              tz_updateTimezoneOffset(tzList, currentTimeZoneCity);
            } else {
              tz_loadJSON(TIMEZONE_FILE, function loadTZ(response) {
                tzList = response;
                tz_updateTimezoneOffset(tzList, currentTimeZoneCity);
              });
            }
          } else {
            tz_getDefaultTimezoneID(tz_updateTimeZoneInfo);
          }
        });
      }
    }

    function _initSoftKey(panel) {
      var softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function () {
          }
        }]
      };

      if (panel.dataset.ftu) {
        softkeyParams.items.push({
          name: 'Next',
          l10nId: 'next',
          priority: 3,
          method: function () {
            ActivityHandler.postResult();
          }
        });
      }

      SettingsSoftkey.init(softkeyParams);
    }

    function updateSoftKey() {
      let item = currentPanel.querySelector('.focus');
      if (!item) {
        return;
      }
      if (currentPanel.dataset.ftu) {
        let params = {
          menuClassName: 'menu-button',
          header: {
            l10nId: 'message'
          },
          items: []
        };
        if (!item.classList.contains('none-select')) {
          params.items.push({
            name: 'Select',
            l10nId: 'select',
            priority: 2,
            method: function () {
            }
          });
        }
        params.items.push({
          name: 'Next',
          l10nId: 'next',
          priority: 3,
          method: function () {
            ActivityHandler.postResult();
          }
        });
        SettingsSoftkey.init(params);
        SettingsSoftkey.show();
      } else {
        if (item && item.classList.contains('none-select')) {
          SettingsSoftkey.hide();
        } else {
          SettingsSoftkey.show();
        }
      }
    }

    return SettingsPanel({
      onInit: function (panel) {
        this._elements = {
          timeAutoSwitch: panel.querySelector('.time-auto'),
          timeZoneInfo: panel.querySelector('.timezone-info'),
          timeZoneHeader: panel.querySelector('.timezone-header'),
          timeZone: panel.querySelector('.timezone'),
          datePicker: panel.querySelector('.date-picker'),
          timePicker: panel.querySelector('.time-picker'),
          clockDate: panel.querySelector('.clock-date'),
          clockTime: panel.querySelector('.clock-time'),
          timeManual: panel.querySelector('.time-manual'),
          timeFormat: panel.querySelector('.time-format-time'),
          homeScreenClock: panel.querySelector('.homescreenclock-available'),
          dateTimeHeader: panel.querySelector('.time-header')
        };

        // update date/clock periodically
        this._boundSetDate = () => {
          this._elements.clockDate.textContent = DateTime.date;
        };

        this._boundSetTime = () => {
          this._elements.clockTime.textContent = DateTime.time;
        };

        // Reset the timezone to the previous user selected value
        this._boundSetSelectedTimeZone = (selected) => {
          DateTime.setUserSelectedTimezone(selected);
        };

        this._boundUpdateUI = this._updateUI.bind(this);
        this._boundDatePickerChange = this._datePickerChange.bind(this);
        this._boundTimePickerChange = this._timePickerChange.bind(this);
        this._boundHomeScreenLockChange = this._homeScreenLockChange.bind(this);

        this._boundTimeFormatChange = () => {
          var value = (this._elements.timeFormat.value === HOUR_12);
          DateTime.setCurrentHour12(value);
        };

        this._handleKeyDown = (evt) => {
          if (evt.key === 'BrowserBack' || evt.key === 'Backspace') {
            if (!window.ActivityHandler) {
              if (NavigationMap._optionsShow === false) {
                NavigationMap.navigateBack();
                evt.stopPropagation();
              }
            }
          } else if (!_enabledInput && evt.key === 'Enter') {
            var el = panel.querySelector('li.focus input');
            el && el.focus();
          }
        };

        this._elements.timeZoneInfo.addEventListener('click', (evt) => {
          var autoTimeMode = DateTime.clockAutoEnabled && DateTime.clockAutoAvailable;
          if (!autoTimeMode || !DateTime.timezoneAutoAvailable) {
            SettingsService.navigate('timezone-picker', {
              'defaultCity': currentTimeZoneCity,
              'list': tzList
            });
          }
        });

        timezoneCity = panel.querySelector('.timezone-info span');
        timezoneOffset = panel.querySelector('.timezone-info small');

        this._elements.timeZoneHeader.hidden = true;
        this._elements.timeZone.hidden = true;
        DeviceFeature.ready(() => {
          if (DeviceFeature.getValue('deviceFinancing') === 'true') {
            this._elements.dateTimeHeader.hidden = true;
            this._elements.timeManual.hidden = true;
          } else {
            this._elements.dateTimeHeader.hidden = false;
            this._elements.timeManual.hidden = false;
          }
        });
        updateTimeZone();
      },

      onBeforeShow: function (panel) {
        currentPanel = panel;
        DateTime.observe('date', this._boundSetDate);
        DateTime.observe('time', this._boundSetTime);
        DateTime.observe('clockAutoEnabled', this._boundUpdateUI);
        DateTime.observe('clockAutoAvailable', this._boundUpdateUI);
        DateTime.observe('timezoneAutoAvailable', this._boundUpdateUI);
        DateTime.observe('userSelectedTimezone',
          this._boundSetSelectedTimeZone);

        this._elements.datePicker.addEventListener('input',
          this._boundDatePickerChange);
        this._elements.timePicker.addEventListener('input',
          this._boundTimePickerChange);
        this._elements.timeFormat.addEventListener('change',
          this._boundTimeFormatChange);
        this._elements.homeScreenClock.addEventListener('change',
          this._boundHomeScreenLockChange);

        this._changeSystemTime();
        this._boundSetDate();
        this._boundSetTime();

        if (DateTime.userSelectedTimezone && !DateTime.clockAutoEnabled) {
          this._boundSetSelectedTimeZone(DateTime.userSelectedTimezone);
        }
        this._renderTimeFormat();
        this._boundUpdateUI();

        window.addEventListener('keydown', this._handleKeyDown);
        ListFocusHelper.addEventListener(listElements, updateSoftKey);
        settings.addObserver(TIMEZONE_KEY, updateTimeZone);
        _initSoftKey(panel);
        updateSoftKey(panel);
      },

      onHide: function () {
        DateTime.unobserve('date', this._boundSetDate);
        DateTime.unobserve('time', this._boundSetTime);
        DateTime.unobserve('clockAutoEnabled', this._boundUpdateUI);
        DateTime.unobserve('clockAutoAvailable', this._boundUpdateUI);
        DateTime.unobserve('timezoneAutoAvailable', this._boundUpdateUI);
        DateTime.unobserve('userSelectedTimezone',
          this._boundSetSelectedTimeZone);

        this._elements.datePicker.removeEventListener('input',
          this._boundDatePickerChange);
        this._elements.timePicker.removeEventListener('input',
          this._boundTimePickerChange);
        this._elements.timeFormat.removeEventListener('change',
          this._boundTimeFormatChange);
        this._elements.homeScreenClock.removeEventListener('change',
          this._boundHomeScreenLockChange);

        window.removeEventListener('keydown', this._handleKeyDown);
      },

      onBeforeHide: function () {
        ListFocusHelper.removeEventListener(listElements, updateSoftKey);
        settings.removeObserver(TIMEZONE_KEY, updateTimeZone);
      },

      /**
       * Set system time to const strSystemDate when auto time is not available.
       * Scenario like dateTime panel is started by FTU when first boot without SIM.
       */
      _changeSystemTime: function dt_changeSystemTime() {
        if (!DateTime.clockAutoAvailable && currentPanel.dataset.ftu) {
          const strSystemDate = "2020-01-01";
          this._elements.clockDate.textContent = strSystemDate;
          this._elements.datePicker.value = strSystemDate;
          this._datePickerChange();
        }
      },

      /**
       * Update DatePicker value
       */
      _datePickerChange: function dt_datePickerChange() {
        DateTime.setTime('date', this._elements.datePicker.value);
        // Clean up the value of picker once we get date set by the user.
        // It will get new date according system time when pop out again.
        this._elements.datePicker.value = '';
      },

      /**
       * Update TimePicker value
       */
      _timePickerChange: function dt_timePickerChange() {
        DateTime.setTime('time', this._elements.timePicker.value);
        // Clean up the value of picker once we get time set by the user.
        // It will get new time according system time when pop out again.
        this._elements.timePicker.value = '';
      },

      /**
       * Update HomeScreenLock value
       */
      _homeScreenLockChange: function dt_homeScreenLockChange() {
        DateTime.setHomeScreenLockAvailable(this._elements.homeScreenClock.value === 'true');
      },

      /**
       * Update Panel UI elements
       */
      _updateUI: function dt_updateUI() {
        this._elements.timeAutoSwitch.dataset.state =
          DateTime.clockAutoEnabled ? 'auto' : 'manual';
        // There are three possible combinations:
        // - clockAutoAvailable is true, timezoneAutoAvailable is true
        // - clockAutoAvailable is false, timezoneAutoAvailable is false
        // - clockAutoAvailable is true, timezoneAutoAvailable is false
        // We show the auto time switch only when clockAutoAvailable is true.
        this._elements.timeAutoSwitch.hidden = !DateTime.clockAutoAvailable;
        this._elements.homeScreenClock.value = DateTime.HomeScreenLockAvailable;
        window.dispatchEvent(new CustomEvent('refresh'));

        // DataTime.clockAutoEnabled is a user preference and in some cases it
        // can be true while DateTime.clockAutoAvailable is false. The reason is
        // the device may not connect to the network to retrieve the correct
        // time automatically after startup. That being said, we should always
        // check both `DateTime.clockAutoEnabled` and
        // `DateTime.clockAutoAvailable` to determine whether the device is in
        // the auto time mode.
        var autoTimeMode =
          DateTime.clockAutoEnabled && DateTime.clockAutoAvailable;

        _enabledInput = autoTimeMode;
        this._elements.datePicker.parentNode.setAttribute('aria-disabled',
          autoTimeMode);
        this._elements.timePicker.parentNode.setAttribute('aria-disabled',
          autoTimeMode);
        if (autoTimeMode) {
          this._elements.datePicker.parentNode.classList.add('none-select');
          this._elements.timePicker.parentNode.classList.add('none-select');
        } else {
          this._elements.datePicker.parentNode.classList.remove('none-select');
          this._elements.timePicker.parentNode.classList.remove('none-select');
        }

        if (autoTimeMode && DateTime.timezoneAutoAvailable) {
          this._elements.timeZone.classList.add('disabled');
          this._elements.timeZoneInfo.setAttribute('aria-disabled', 'true');
          this._elements.timeZoneInfo.classList.add('none-select');
          this._elements.timeManual.classList.add('disabled');
        } else {
          this._elements.timeZone.classList.remove('disabled');
          this._elements.timeZoneInfo.removeAttribute('aria-disabled');
          this._elements.timeZoneInfo.classList.remove('none-select');
          this._elements.timeManual.classList.remove('disabled');
        }
      },

      /**
       * Update TimeFormat selector
       */
      _renderTimeFormat: function dt_renderTimeFormat() {
        // restore default selection
        var selectedItem = 0;
        if (!DateTime.currentHour12) {
          selectedItem = 1;
        }

        var options = [{
          attr: 'hour-12', // 2:00PM
          value: HOUR_12,
        }, {
          attr: 'hour-24', // 14:00
          value: HOUR_24
        }];

        var obj = this._elements.timeFormat;
        while (obj.options.length) { // clean options
          obj.remove(0);
        }
        for (var i = 0; i < options.length; i++) {
          var option = document.createElement('option');
          option.setAttribute('data-l10n-id', options[i].attr);
          option.selected = (selectedItem === i);
          option.value = options[i].value;
          obj.appendChild(option);
        }
      }
    });
  };
});
