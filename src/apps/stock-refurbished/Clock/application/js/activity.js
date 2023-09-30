navigator.mozSetMessageHandler('activity', function viewAlarm(activity) {
  let App = require('app');
  let alarmDatabase = require('alarm_database');
  let Alarm = require('alarm');
  let NavObjects = require('navObjects');
  let data = activity.source.data;
  let type = data.type;
  let Utils = require('utils');

  let actionState = 'error';
  let alarmsArray = [];
  let errorMessage = null;
  let addedAlarmId = null;

  if (type === 'alarm' || type === 'timer' ||
    type === 'stopwatch') {
    App.navigate({ hash: '#' + type + '-panel'});
    NavigationManager.navObjects.lastTab = '#' + type + '-panel';
    NavigationManager.navObjects.tabs.querySelector('a#' + type +'-tab').click();
    return;
  }

  function done() {
    activity.postResult({
      actionState: actionState,
      alarmsArray: alarmsArray,
      errorMessage: errorMessage,
      addedAlarmId: addedAlarmId
    });
  }

  Utils.isShowToast = false;
  if (type === 'getall') {
    alarmDatabase.getAll().then((alarms) => {
      alarmsArray = alarms;
      actionState = 'success';
      done();
    }, (e) => {
      errorMessage = e;
      done();
    });
    return;
  }

  if (type === 'deleteall') {
    alarmDatabase.getAll().then((alarms) => {
      if (alarms.length > 0) {
        NavObjects.items['alarm'].deleteAll = true;
        alarms[alarms.length - 1].deleteAll();
        actionState = 'success';
      } else {
        errorMessage = 'No Alarm';
      }
      done();
    }, (e) => {
      errorMessage = e;
      done();
    });
    return;
  }

  let alarmData = data.alarm;
  let alarmTime = new Date(alarmData.time);
  let alarmRepeat = alarmData.repeat;
  let alarm = new Alarm();
  alarm.hour = alarmTime.getHours();
  alarm.minute = alarmTime.getMinutes();
  alarm.second = alarmTime.getSeconds();
  alarm.repeat = alarmRepeat;
  alarm.label = alarmData.label || '';

  if (type === 'add') {
    alarmDatabase.getAll().then((alarms) => {
      if (alarms.length < 100) {
        alarm.schedule('normal').then(() => {
          actionState = 'success';
          addedAlarmId = alarm.id;
          done();
        }, (e) => {
          errorMessage = e;
          done();
        });
      } else {
        errorMessage = 'The alarm number reached maximum of 100';
        done();
      }
    }, (e) => {
      errorMessage = e;
      done();
    });
  } else if (type === 'delete') {
    alarmDatabase.getAll().then((alarms) => {
      let alarmId = alarmData.id;
      for (let i in alarms) {
        if (alarms[i].id.toString() === alarmId.toString()) {
          alarms[i].delete();
          actionState = 'success';
          done();
          return;
        }
      }
      errorMessage = 'Do not have this alarm';
      done();
    }, (e) => {
      errorMessage = e;
      done();
    });
  }
});
