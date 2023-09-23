/**
 * @file - Handler system msg call end
 * - Save logs
 * - Send notices
 * - Send call end msg to web page from sw
 */

/** @param { method } l10n */
importScripts('http://shared.localhost/js/utils/l10n/l10n_sw.js');

/** @param { method } LibSession */
importScripts('http://shared.localhost/js/session/lib_session.js');

/** @param { method } TaskScheduler */
importScripts('http://shared.localhost/js/session/task_scheduler.js');

/** @param { method } DeviceCapabilityManager */
importScripts('http://shared.localhost/js/session/device_capability/device_capability.js');

/** @param { method } findContact - Search contact info by number */
importScripts('./js/matchContact.js');

window.MAX_LIST_LENGTH = 100;

// init service
window.libSession.initService(['contactsService', 'devicecapabilityService']).then(() => {
  DeviceCapabilityManager.get('hardware.memory').then(res => {

    // Set global variable
    if (res === 256) {
      window.MAX_LIST_LENGTH = 50;
    }
  })
});

const saveLog = data => {
  if (!db) {
    console.log('db does not exist');
    return;
  }

  db.saveLog(data).then((logInfo) => {
    console.log('save log success!');

    clients.matchAll().then(views => {
      views.forEach(view => {
        view.postMessage({
          type: 'telephony-call-ended',
          data: logInfo
        });
      })
    })
  });
};

const sendNotice = ({ title, body, icon }) => {
  registration.showNotification(title, {
    body,
    icon
  }).then(() => {
    // When callLog app is open auto clean notice
    clearNotice();
  });
};

const clearNotice = () => {
  clients.matchAll().then(views => {
    const hasOpenView = views.find(info => {
      return info.url.includes('.html') && info.visibilityState === 'visible'
    });

    if (hasOpenView) {
      clearNotifications();
    }
  })
}

const callEndHandler = evt => {
  // save tel log & send msg to webpage & send notification to system
  data = evt.data.json();
  saveLog(data);

  // send missed notification to sys
  if (data.direction == 'incoming' && data.duration <= 0 && !data.hangUpLocal) {
    l10n.once(() => {
      findContact(data.number)
        .then(result => {
          sendNotice({
            title: result ? result.name : data.number,
            body: l10n.get('missedCall'),
            icon: '/resources/call_log_56.png'
          });
        })
        .catch(() => {
          sendNotice({
            title: data.number || l10n.get('withheld-number'),
            body: l10n.get('missedCall'),
            icon: '/resources/call_log_56.png'
          });
        });
    });
  }
};
