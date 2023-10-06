'use strict';

var FotaStub = {
  //fota stub member variables
  _fota: null,
  _lastAlarmDate: new Date(0),
  _nextAutoUpdateAlarmDate: null,
  _nextAutoUpdateInfo: { isAlarmAutoTriggered: false, retryTimes: 0 },
  _isAutoDownload: false,
  _isAutoDownloadNeedRetry: false,
  _isAutoInstall: false,
  _isScreenOff: false,
  _isCpuReleased: false,
  _retryCount: 0,

  //constants defined by fota dom element (only needed parts)
  EVENT_TYPE_START_COMPLETE: 'start_complete',
  EVENT_TYPE_STOP_COMPLETE: 'stop_complete',
  EVENT_TYPE_CHECK_COMPLETE: 'check_complete',
  EVENT_TYPE_DOWNLOAD_PROGRESS: 'download_progress',
  EVENT_TYPE_DOWNLOAD_COMPLETE: 'download_complete',
  EVENT_TYPE_PAUSE_COMPLETE: 'pause_complete',
  EVENT_TYPE_RESUME_COMPLETE: 'resume_complete',
  EVENT_TYPE_INSTALL_COMPLETE: 'install_complete',
  EVENT_TYPE_CONFIG_COMPLETE: 'config_complete',
  ENGINE_ERROR_OK: 1,
  ENGINE_ERROR_ABORT: -2,
  ENGINE_ERROR_NO_RESULT: -9,
  BIZLOGIC_ERROR_FREE_SPACE: -4,
  BIZLOGIC_ERROR_BATTERY: -5,
  BIZLOGIC_ERROR_SYSTEM_BUSY: -6,
  BIZLOGIC_ERROR_PACKAGE_EXISTED: -7,
  CONFIG_ID_AUTO_UPDATE_INTERVAL: 1001,
  CONFIG_ID_DOWNLOADVIA: 1002,
  CONFIG_VALUE_AUI_NONE: 0,
  CONFIG_VALUE_AUI_DAILY: 1,
  CONFIG_VALUE_AUI_WEEKLY: 2,
  CONFIG_VALUE_AUI_MONTHLY: 3,

  //constants
  INSTALL_RESULT_SUCCEEDED: 999,
  DELAYED_INIT_TIMEOUT: 5000,         //5 seconds
  AUTOINSTALL_CHECK_TIMEOUT: 120000,  //2 minutes
  BATTERY_LIMIT: 0.3,
  MILLISECONDS_DAY: 24*60*60*1000,    //24 hours
  MILLISECONDS_WEEK: 7*24*60*60*1000, //7 days
  MILLISECONDS_MONTH: 30*24*60*60*1000, //30 days

  debug: function fota_debug(info) {
    console.log('fota:sys: '+info);
  },

  init: function fota_stub_init() {
    if (!navigator.fota) {
      return;
    }

    this._fota = navigator.fota;
    var fota = this._fota;
    fota.addEventListener(this.EVENT_TYPE_INSTALL_COMPLETE, this); //first
    fota.addEventListener(this.EVENT_TYPE_START_COMPLETE, this);
    fota.addEventListener(this.EVENT_TYPE_STOP_COMPLETE, this);
    fota.addEventListener(this.EVENT_TYPE_CHECK_COMPLETE, this);
    fota.addEventListener(this.EVENT_TYPE_DOWNLOAD_PROGRESS, this);
    fota.addEventListener(this.EVENT_TYPE_DOWNLOAD_COMPLETE, this);
    fota.addEventListener(this.EVENT_TYPE_PAUSE_COMPLETE, this);
    fota.addEventListener(this.EVENT_TYPE_RESUME_COMPLETE, this);
    fota.addEventListener(this.EVENT_TYPE_CONFIG_COMPLETE, this);

    window.addEventListener('moztimechange', this);

    AlarmMessageHandler.addCallback(alarm => {
      if (!alarm.data.isFota2AutoUpdateAlarm) { //not autoupdate alarm
        return;
      }
      if (this._lastAlarmDate.getTime() === alarm.date.getTime()) { //avoid duplicate alarm
        this.debug('duplicate alarm, rejected');
        return;
      }
      this._lastAlarmDate = alarm.date;
      this._nextAutoUpdateInfo.isAlarmAutoTriggered = true;
      this._fota.scheduleCheck();
    });

    setTimeout(() => {
      //delay to make sure alarm exec after mozAlarms is inited
      this.updateAutoUpdateAlarm(false, this.getAutoUpdateInterval());
    }, this.DELAYED_INIT_TIMEOUT);
  },

  updateAutoUpdateAlarm: function fota_update_autoupdate_alarm(forceUpdate, interval) {
    //update next autoupdate alarm from now with interval
    //if old alarm is found, and forceUpdate is true or old alarm has passed, update it
    //else leave old alarm as it be
    this.debug('updateAutoUpdateAlarm, forceUpdate='+forceUpdate + '; interval='+interval);
    var self = this;
    var alarmRequest = navigator.mozAlarms.getAll();
    alarmRequest.onsuccess = function() {
      self.debug('alarms[]='+JSON.stringify(this.result));
      var alarmFound = false;
      this.result.forEach(function (alarm) {
        if (alarm.data.isFota2AutoUpdateAlarm) {
          alarmFound = true;
          var now = new Date();
          self._nextAutoUpdateAlarmDate = alarm.date;
          if ((forceUpdate) || (alarm.date.getTime() < now.getTime())) {
            navigator.mozAlarms.remove(alarm.id);
            self._nextAutoUpdateAlarmDate = null;
            self.addAutoUpdateAlarm(interval);
          }
        }
      });
      if (!alarmFound) {
        self.addAutoUpdateAlarm(interval);
      }
    }
    alarmRequest.onerror = function () {
      self.debug('operation failed: ' + this.error);
    };
  },

  getAutoUpdateInterval: function fota_get_autoupdate_interval() {
    try {
      var value = this._fota.getNumberConfig(this.CONFIG_ID_AUTO_UPDATE_INTERVAL);
      switch(value) {
        case this.CONFIG_VALUE_AUI_DAILY:
          return this.MILLISECONDS_DAY;
        case this.CONFIG_VALUE_AUI_WEEKLY:
          return this.MILLISECONDS_WEEK;
        case this.CONFIG_VALUE_AUI_MONTHLY:
          return this.MILLISECONDS_MONTH;
        case this.CONFIG_VALUE_AUI_NONE:
          return 0;
        default:
          return -1;
      }
    } catch(error) {
      this.debug('error='+error);
      return -1;
    }
  },

  addAutoUpdateAlarm: function fota_add_autoupdate_alarm(interval) {
    if (interval <= 0) {
      this.debug('addAutoUpdateAlarm, interval='+interval+'; no need to add alarm');
      return;
    }

    var alarmDate = new Date(Date.now() + interval);
    var self = this;

    var request = navigator.mozAlarms.add(alarmDate, 'ignoreTimezone', {isFota2AutoUpdateAlarm : true});
    request.onsuccess = function () {
      self.debug('_nextAutoUpdateAlarmDate='+alarmDate);
      self._nextAutoUpdateAlarmDate = alarmDate;
    }
    request.onerror = function () {
      self.debug('add alarm failed: ' + this.error);
    }
  },

  resetAlarm: function fota_reset_alarm() {
    this._nextAutoUpdateInfo.retryTimes = 0;
    this.updateAutoUpdateAlarm(true, this.getAutoUpdateInterval());
  },

  onTimeChange: function fota_on_time_change(event) {
    //when time changed by user or sync, it may cause autoupdate alarm incorrectness
    // e.g: alarm is triggered right now or should wait too long to be triggered
    //so, if the alarm is triggered or in 'autoupdate_interval' to be triggered, we do nothing
    //else we sets the next autoupdate alarm as the user config(daily/weekly/monthly) from now
    if (!this._nextAutoUpdateAlarmDate) {
      this.debug('moztimechange, no next auto update alarm');
      //no next autoupdate alarm, nothing to do
      return;
    }
    var autoUpdateInterval = this.getAutoUpdateInterval();
    if (autoUpdateInterval <= 0) { //read error?
      autoUpdateInterval = this.MILLISECONDS_DAY;
    }
    var now = new Date();
    var timeDiffInMs = this._nextAutoUpdateAlarmDate.getTime() - now.getTime();
    if (timeDiffInMs < autoUpdateInterval) {
      //next alarm is in 'autoupdate_interval' or passed, nothing to do
      return;
    }
    //force reset autoupdate alarm from now, and retry info will be cleared too
    this.resetAlarm();
  },

  tryScheduleInstall: function fota_try_schedule_install(addWakeLockListener) {
    var level = navigator.battery.level;

    if (addWakeLockListener) {
      this._isScreenOff = !navigator.mozPower.screenEnabled;
      this._isCpuReleased = navigator.mozPower.cpuSleepAllowed;
      navigator.mozPower.addWakeLockListener(this);
    }
    if (this._isScreenOff && this._isCpuReleased && level >= this.BATTERY_LIMIT) {
      this._fota.scheduleInstall();
      return;
    }
    this.debug('tryScheduleInstall, _isScreenOff=' + this._isScreenOff
      + '; _isCpuReleased=' + this._isCpuReleased + '; battery level=' + level);

    if (level < this.BATTERY_LIMIT) {
      navigator.battery.addEventListener('levelchange', this);
    }
  },

  onBatteryLevelChange: function fota_on_battery_level_change() {
    if (navigator.battery.level < this.BATTERY_LIMIT) {
      return;
    }
    navigator.battery.removeEventListener('levelchange', this);
    if (this._isAutoInstall) {
      this.tryScheduleInstall(false);
    } else {
      this.debug('Battery enough, maybe I should prompt user to install here');
    }
  },

  onCheckComplete: function fota_on_check_complete_event(result, detail) {
    //check may be triggered by user or autoupdate in fota_stub
    //if by autoupdate, and failed, we need to retry in 1/2/4 hours as bugzilla:22165
    //and when check succeeded, whether by user or autoupdate
    //we need to clear the retry information
    if ((this.ENGINE_ERROR_OK === result) || (this.ENGINE_ERROR_NO_RESULT === result)) {
      //check executed without error, should reset alarm
      this._nextAutoUpdateInfo.isAlarmAutoTriggered = false; //clear the autoupdate trigger signal
      this.resetAlarm();
      if (this.ENGINE_ERROR_OK === result) {
        this.onUpdateFound();
      }
      return;
    }
    if (!this._nextAutoUpdateInfo.isAlarmAutoTriggered) { // user triggered check
      return;
    }
    this._nextAutoUpdateInfo.isAlarmAutoTriggered = false; //clear the autoupdate trigger signal

    // retry rule is according to https://bugzilla.kaiostech.com/show_bug.cgi?id=22165
    var retryInterval = 0;
    switch(this._nextAutoUpdateInfo.retryTimes) {
      case 0: //first failure
        retryInterval = (60*60*1000); // 1 hour later
        break;
      case 1: //second failure
        retryInterval = (2*60*60*1000); // 2 hour later
        break;
      case 2: //third failure
        retryInterval = (4*60*60*1000); // 4 hour later
        break;
      case 3: //fourth failure
      default:
        this.resetAlarm();
        return;
    }
    this._nextAutoUpdateInfo.retryTimes += 1;
    this.updateAutoUpdateAlarm(true, retryInterval);
  },

  isPackageOutdated: function fota_is_package_outdated(checkResult, packageInfo) {
    if (!packageInfo.downloadTime) {
      return true;
    }
    if ((checkResult.updateVersion === packageInfo.updateVersion)
      && (checkResult.releaseDate === packageInfo.releaseDate)
      && (checkResult.size === packageInfo.size)) {
      return false;
    }
    return true;
  },

  onUpdateFound: function fota_on_update_found() {
    var checkResultStr = this._fota.getCheckResult();
    var checkResult = JSON.parse(checkResultStr);
    this.debug('onUpdateFound, checkResult='+checkResultStr+'; autoDownload='+checkResult.autoDownload);
    var packageInfoStr = this._fota.getPackageInfo();
    var packageInfo = JSON.parse(packageInfoStr);
    this.debug('onUpdateFound, packageInfo='+packageInfoStr);
    var title = navigator.mozL10n.get('fota-title-software-update');
    var message = navigator.mozL10n.get('fota-message-software-update-available');
    if (!this.isPackageOutdated(checkResult, packageInfo)) {
      // we have a downloaded package and it's same with this check result
      return;
    }
    if (!checkResult.autoDownload) {
      this.showNotice(title, message, 'onUpdateFound');
      return;
    }
    this._isAutoDownload = true;
    this._fota.scheduleDownload();
  },

  onDownloadComplete: function fota_on_download_complete_event(result, detail) {
    if (this.ENGINE_ERROR_OK === result) {
      var packageInfoStr = this._fota.getPackageInfo();
      var packageInfo = JSON.parse(packageInfoStr);
      this.debug('onDownloadComplete, packageInfoStr=' + packageInfoStr);

      this._isAutoDownloadNeedRetry = false;
      if (!packageInfo.autoInstall) {
        var title = navigator.mozL10n.get('fota-title-software-update');
        var message = navigator.mozL10n.get('fota-message-software-download-complete');
        this.showNotice(title, message, 'onDownloadComplete');
        return;
      }
      this._isAutoInstall = true; // auto install forced by server
      this.tryScheduleInstall(true);
    } else {
      if (this.BIZLOGIC_ERROR_PACKAGE_EXISTED !== detail) {
        // Download failed
        var title = navigator.mozL10n.get('fota-title-software-update');
        var message = navigator.mozL10n.get('fota-message-software-download-failed');
        this.showNotice(title, message, 'onDownloadFailed');
        this._isAutoDownloadNeedRetry = this._isAutoDownload;
      }// else Package exist, ignore
    }
  },

  onConfigComplete: function fota_on_config_complete_event(result, detail) {
    //user may change autoupdate interval, and next alarm should be changed too
    if (this.ENGINE_ERROR_OK === result) {
      if (this.CONFIG_ID_AUTO_UPDATE_INTERVAL === detail) {
        this.updateAutoUpdateAlarm(true, this.getAutoUpdateInterval());
        return;
      }
      if (this.CONFIG_ID_DOWNLOADVIA === detail) {
        if (this._isAutoDownloadNeedRetry) {
          this.debug('CONFIG_ID_DOWNLOADVIA is changed');
          this._isAutoDownloadNeedRetry = false;
          this._fota.scheduleDownload();
        }
      }
    }
  },

  onInstallComplete: function fota_on_install_complete_event(result, detail) {
    if (this.ENGINE_ERROR_OK === result) {
      // after reboot, we got that installation is finished
      navigator.mozL10n.once(() => {
        this.showInstallResultAtBoot(detail);
      });
    } else {
      //installation is not start due to different errors
      if (this.ENGINE_ERROR_ABORT === result) {
        //aborted by bizlogic
        switch (detail) {
          case this.BIZLOGIC_ERROR_BATTERY:
            navigator.battery.addEventListener('levelchange', this);
            break;
          case this.BIZLOGIC_ERROR_SYSTEM_BUSY:
            if (this._isAutoInstall) {
              navigator.mozPower.removeWakeLockListener(this);
              this.debug('onInstallComplete, BIZLOGIC_ERROR_SYSTEM_BUSY, addWakeLockListener(this)');
              navigator.mozPower.addWakeLockListener(this);
            }
            break;
          case this.BIZLOGIC_ERROR_FREE_SPACE:
            this.debug('onInstallComplete(), install(auto) suspended for BIZLOGIC_ERROR_FREE_SPACE');
            break;
          default:
            this.debug('onInstallComplete(), SHOULD NOT be here, detail=' + detail);
            break;
        }
      }
    }
  },

  showInstallResultAtBoot: function fota_show_install_result_at_boot(result) {
    var header = navigator.mozL10n.get('fota-title-attention');
    var content;
    if (this.INSTALL_RESULT_SUCCEEDED === result) {
      content = navigator.mozL10n.get('fota-upgrade-success',
        { target: this._fota.getCurrentVersion() });
    } else {
      content = navigator.mozL10n.get('fota-upgrade-failed')
    }
    Service.request('DialogService:show', {
      header: header,
      content: content,
      ok: 'back',
      type: 'alert',
      translated: true
    });
  },

  showNotice: function fota_show_notice(title, message, param) {
    this.debug('showNotice, title='+title+'; message='+message+'; param='+param);
    var self = this;
    let app = Service.currentApp;
    let manifestURL = document.activeElement.getAttribute('mozapp');
    if ((app.name === 'fota')
      || (manifestURL === 'app://fota.gaiamobile.org/manifest.webapp')) {
      //do not display notice while fota app is running
      return;
    }
    var clickCB = function(evt) {
      evt.target.close();
      var activity = new MozActivity({
        name: "launch-fota",
        data: { param: param }
      });
      activity.onsuccess = function() {};
      activity.onerror = function() { self.debug(this.error.name); };
    };
    var notification = new Notification(title, {
      body: message,
      icon: 'file-download-01',
      tag: 'fota-notice',
      mozbehavior: {
        showOnlyOnce: true
      }
    });
    notification.addEventListener('click', clickCB);
  },

  handleEvent: function fota_handle_event(event) {
    this.debug('handleEvent(), received event type='+event.type
      +'; result='+event.result
      +'; detail='+event.detail);
    switch (event.type) {
      case 'moztimechange':
        this.onTimeChange(event);
        break;
      case 'levelchange':
        this.onBatteryLevelChange();
        break;
      case this.EVENT_TYPE_CHECK_COMPLETE:
        this.onCheckComplete(event.result, event.detail);
        break;
      case this.EVENT_TYPE_DOWNLOAD_COMPLETE:
        this.onDownloadComplete(event.result, event.detail);
        break;
      case this.EVENT_TYPE_CONFIG_COMPLETE:
        this.onConfigComplete(event.result, event.detail);
        break;
      case this.EVENT_TYPE_INSTALL_COMPLETE:
        this.onInstallComplete(event.result, event.detail);
        break;
      default:
        break;
    }
  },

  callback: function fota_handle_mozpower_event(name, state) {
    this.debug('fota_handle_mozpower_event(), received name=' + name
      + '; state=' + state);
    if ((name === 'screen') || (name === 'DOM_Fullscreen')) {
      this._isScreenOff = (state !== 'locked-foreground');
    } else if (name === 'cpu') {
      this._isCpuReleased = (state === 'unlocked');
    }
    this.tryScheduleInstall(false);
  },

  // hengchangzhao@t2mbile.com - begin
  t2m_init: function fota_t2m_init() {
    this.debug(`t2m_init enter`);
    navigator.engmodeExtension.setPropertyValue("ctl.start", "fih_fota");
    this.update_cu();
  },

  update_cu: function() {
    let nv_code = navigator.engmodeExtension.getPropertyValue("ro.fih.fota_code");
    this._retryCount += 1;
    if (this._retryCount <3 && 
      (nv_code == null || nv_code.length < 1)){
      // try to get nv_code 3 times if failed
      setTimeout(()=>{
        this.update_cu();
      }, 3000);
    }
    else {
      // nv_code is correct or have tried 3 times
      let curef = navigator.engmodeExtension.getPrefValue("fota.commercial.ref", "na");
      this.debug(`t2m_init nv_code:${nv_code}, curef: ${curef}, retryCount: ${this._retryCount}`);
      //if (nv_code.length > 5 && curef.length != 15) {
        curef = curef.substr(0,4) + nv_code;
        navigator.engmodeExtension.setPrefValue("fota.commercial.ref", curef);
        // 4781 - [ARGON]Change CU storage position
        navigator.engmodeExtension.setPrefValue("device.commercial.ref", curef);
        let newcode =  navigator.engmodeExtension.getPrefValue("fota.commercial.ref", "na");
        this.debug(`t2m_init newcode: ` + newcode);
      //} else {
      //  this.debug(`t2m_init leave`);
      //}

      this.init();
    }
  }
  // hengchangzhao@t2mbile.com - end
};

//init while system start and ready
window.addEventListener('ftudone', function initFota2Stub(evt) {
  window.removeEventListener('ftudone', initFota2Stub);
  FotaStub.debug('init triggered by ftudone');
  // hengchangzhao@t2mbile.com //FotaStub.init();
  FotaStub.t2m_init();
});

window.addEventListener('ftuskip', function initFota2Stub(evt) {
  window.removeEventListener('ftuskip', initFota2Stub);
  FotaStub.debug('init triggered by ftuskip');
  // hengchangzhao@t2mbile.com //FotaStub.init();
  FotaStub.t2m_init();
});
