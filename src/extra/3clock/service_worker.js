/* global clients, importScripts, AlarmDatabase, Utils */

importScripts('http://shared.localhost/js/session/lib_session.js');
importScripts('http://shared.localhost/js/session/task_scheduler.js');
importScripts('http://shared.localhost/js/session/settings/settings_observer.js');
importScripts('./js/sw_utils.js');
importScripts('./js/constants.js');
importScripts('./js/sw_database.js');

Utils.initSession();
const SYSTEM_MESSAGE_TYPES = [
  'system-time-change',
  'activity',
  'alarm'
];
self.addEventListener('install', (evt) => {
  evt.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(self.clients.claim());
});

let openAttentionTag = false;
let clockAttentionWindowReady = false;
let clockClient = null;
let handler = null;
let dataPath = null;
self.onsystemmessage = (evt) => {
  if (SYSTEM_MESSAGE_TYPES.includes(evt.name)) {
    let htmlPath = null;
    const obj = {};
    if (evt.name === 'activity') {
      handler = evt.data.webActivityRequestHandler();
      const activityName = handler.source.name;
      if ('setalarm' === activityName || 'view' === activityName) {
        htmlPath = '/view.html';
        obj.disposition = 'inline';
        evt.waitUntil(
          clients.openWindow(htmlPath, obj).then(
            // eslint-disable-next-line
            openWindow => {
              openWindow.postMessage({
                source: handler.source
              });
            },
            (err) => {
              console.error(`service_worker: openWindow fail with error: ${err}`);
            }
          )
        );
      }
    }
    if (evt.name === 'alarm') {
      const { type } = evt.data.json().data;
      const { id } = evt.data.json().data;
      const date = evt.data.json().date.getTime();
      htmlPath = `/onring.html#${id}&${type}@${date}`;
      if (openAttentionTag) {
        const index = htmlPath.indexOf('#');
        dataPath = htmlPath.substr(index);
        if (clockAttentionWindowReady) {
          evt.waitUntil(
            clockClient.postMessage({
              path: dataPath,
              type: 'alarm'
            })
          );
        }
      } else if (isOpenWindow(date, id)) {
        openAttentionTag = true;
        evt.waitUntil(
          clients.openWindow(htmlPath, { disposition: 'attention' }).then(
            (client) => {
              clockClient = client;
              console.log(`service_worker: openWindow success!--- ${client}`);
            },
            (err) => {
              console.error(`service_worker: openWindow fail with error: ${err}`);
            }
          )
        );
      }
    }
    if (evt.name === 'system-time-change') {
      const alarmDatabase = new AlarmDatabase('alarms', 'alarms', 7);
      navigator.b2g.alarmManager.getAll().then((registalarms) => {
        const nowDate = new Date();
        // eslint-disable-next-line
        for (let i in registalarms) {
          const alarmDate = registalarms[i].date;
          const type = registalarms[i].data.type === 'normal';
          if (alarmDate > nowDate && type) {
            alarmDatabase.getAll().then((alarms) => {
              // eslint-disable-next-line
              for (let j in alarms) {
                if (registalarms[i].data.id === alarms[j].id) {
                  alarms[j].schedule('normal');
                }
              }
            });
          }
        }
      });
    }
  }
};

self.addEventListener('message', (event) => {
  /* eslint-disable */
  const { data } = event;
  if (handler) {
    if (data.isError) {
      handler.postError(data.activityResult);
    } else {
      handler.postResult(data.activityResult);
    }
    handler = null;
  }
  openAttentionTag = event.data.openAttentionTag;
  clockAttentionWindowReady = event.data.clockAttentionWindowReady;
  /* eslint-enable */
  if (clockAttentionWindowReady && dataPath) {
    clockClient.postMessage({
      path: dataPath,
      type: 'alarm'
    });
    dataPath = null;
  }
});

function isOpenWindow(d, id) {
  let date = new Date(d);
  const dateNow = new Date();
  const getTimeNow = `${dateNow.getFullYear()}${dateNow.getMonth()
  }${dateNow.getDate()}`;
  const getTimeAlarm = `${date.getFullYear()}${date.getMonth()
  }${date.getDate()}`;
  let judgement = false;
  if (getTimeNow === getTimeAlarm) {
    judgement = true;
  }

  const timeDiff = dateNow.getTime() - date.getTime();
  const days = parseInt(timeDiff / (1000 * 60 * 60 * 24), 10);
  const RoundingNum = parseInt(days / 7, 10);
  const remainder = days % 7;
  let latestDate = null;
  if (RoundingNum > 0) {
    latestDate = dateNow.getTime() - remainder * 1000 * 60 * 60 * 24;
  } else {
    latestDate = date.getTime();
  }

  if (judgement && dateNow > date) {
    return true;
  }
  date = new Date(latestDate);
  const alarmDatabase = new AlarmDatabase('alarms', 'alarms', 7);
  alarmDatabase.get(id).then((alarm) => {
    if (alarm.isRepeating()) {
      alarm.schedule('normal', date);
    } else {
      alarm.cancel(null, 'update', false).then(() => {
        navigator.b2g.alarmManager.getAll().then((alarms) => {
          if (!alarms.length && !alarm.isRepeating()) {
            Utils.setSettingsValue([
              {
                name: 'alarm.enabled',
                value: false
              }
            ]);
          }
        });
      });
    }
  });
  return false;
}
