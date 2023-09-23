/* global clients */
'use strict';

importScripts('http://shared.localhost/js/utils/l10n/l10n_sw.js');
importScripts('http://shared.localhost/js/session/lib_session.js');
importScripts('http://shared.localhost/js/session/task_scheduler.js');
importScripts('http://shared.localhost/js/session/settings/settings_observer.js');

const servicesArray = [
  'settingsService'
];
window.libSession.initService(servicesArray).then(() => {
  SettingsObserver.init();
});

const SYSTEM_MESSAGE_TYPES = [
  'alarm'
];
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
let handler = null;

self.onsystemmessage = evt => {
  console.log('onsystemmessage calendar: ', evt.name);
  if (SYSTEM_MESSAGE_TYPES.includes(evt.name)) {
    sendNotification(evt.data.json());
  }
};

self.onnotificationclick = function(evt) {
  console.log('onnotificationclick tag: ', evt.notification.tag);
  evt.notification.close();

  evt.waitUntil(
    clients.matchAll({ type: 'window' }).then((values) => {
      const clientItem = values[0];
      if (clientItem && clientItem.visibilityState === 'hidden') {
        clients.openWindow('/index.html')
        clientItem.postMessage({
          type: 'notificationclick',
          data: evt.notification.data
        });
      } else {
        clients.openWindow('/index.html').then(
          client => {
            console.log('openWindow success!', client);
            client.postMessage({
              type: 'notificationclick',
              data: evt.notification.data
            });
          },
          err => {
            console.log(`openWindow fail with error: ${err}`);
          }
        )
      }
    })
  );
};

self.addEventListener('message', evt => {
  // Message received from clients
  console.log('service worker receive message calendar: ', evt.data);
  switch (evt.data.type) {
    case 'notification':
      showNoticeItem(evt.data.data);
      break;
    default:
      break;
  }
});

function showNoticeItem(item) {
  SettingsObserver.getValue('locale.hour12').then(value => {
    l10n.once(() => {
      const _ = l10n.get;
      let title = item.title ? item.title : _('event-no-title');
      let url = `/alarm-display/${item.busytimeId}`;
      let now = new Date();
      let begins = new Date(item.busytimeSDate);
      let ends = new Date(item.busytimeEDate);
      let body = '';

      if (now > ends) {
        return;
      }

      if (item.allDayEvent) {
        body = prettyDateForAlldayEvent({
          begins, ends, now, event: item
        });
      } else {
        body = prettyDateForNotAlldayEvent({
          begins, ends, now, event: item, hour12: !!value
        });
      }

      showNotification({
        title,
        noticeData: {
          body,
          tag: url,
          data: item
        }
      });
    });
  });
}

function showNotification(data) {
  const { title, noticeData } = data;
  self.registration.showNotification(title, noticeData);
}

function sendNotification(data) {
  if ('calendarNotice' !== data.data.type) {
    return;
  }

  showNoticeItem(data.data.item)
}

function prettyDateForAlldayEvent(options) {
  const {
    begins, ends, now, event
  } = options;
  if (!event.reminder) {
    return null;
  }

  const _ = l10n.get;
  let tomorrow = new Date(now.valueOf() + 24 * 60 * 60 *1000);
  let beginsDate = new Date(begins.valueOf());
  let endsDate = new Date(ends.valueOf() - 1);
  let nowDate = now.valueOf();
  let dateString = '';
  let offset = ends.valueOf() - begins.valueOf();
  let oneDay =  24 * 60 * 60 * 1000 - 60 * 1000;

  const dateOptions = {
    month: 'short',
    day: 'numeric'
  };
  const yearOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  };

  // today Today
  if (offset === oneDay &&
    nowDate <= ends.valueOf() &&
    nowDate >= begins.valueOf()) {
    dateString = _('today-all-day-event');
  // tomorrow Tomorrow
  } else if (offset === oneDay &&
    tomorrow <= ends.valueOf() &&
    tomorrow >= begins.valueOf()) {
    dateString = _('tomorrow-all-day-event');
  // May 10, 2021 - May 10, 2021
  } else if (begins.getFullYear() !== ends.getFullYear()) {
    dateString = _('event-notice-timeformat', {
      start:
        new Date(beginsDate).toLocaleString(navigator.language, yearOptions),
      end: new Date(endsDate).toLocaleString(navigator.language, yearOptions)
    });
  // Apr.10 - Apr.12
  } else {
    dateString = _('event-notice-timeformat', {
      start:
        new Date(beginsDate).toLocaleString(navigator.language, dateOptions),
      end: new Date(endsDate).toLocaleString(navigator.language, dateOptions)
    });
  }

  return dateString;
}

function prettyDateForNotAlldayEvent(options) {
  const {
    begins, ends, now, event, hour12
  } = options;

  if (!event.reminder) {
    return null;
  }

  const _ = l10n.get;
  let tomorrow = new Date(now.valueOf() + 24 * 60 * 60 *1000);
  let beginsDate = begins.valueOf();
  let endsDate = ends.valueOf();
  let nowDate = now.valueOf();
  let dateString = '';
  const timeOptions ={
    hour: 'numeric',
    minute: 'numeric',
    hour12
  };
  const dateOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12
  };
  const yearOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12
  };


  // May 10, 2021 5:30 PM - May 10, 2021 5:30 PM
  if (begins.getFullYear() !== ends.getFullYear()) {
    dateString = _('event-notice-timeformat', {
      start:
        new Date(beginsDate).toLocaleString(navigator.language, yearOptions),
      end: new Date(endsDate).toLocaleString(navigator.language, yearOptions)
    });
  // today 3:30 PM - 4:30 PM
  } else if (begins.getDate() === now.getDate() &&
    ends.getDate() === now.getDate() &&
    begins.getMonth() === now.getMonth() &&
    ends.getMonth() === now.getMonth()) {
    dateString = _('event-notice-timeformat', {
      start:
        new Date(beginsDate).toLocaleString(navigator.language, timeOptions),
      end: new Date(endsDate).toLocaleString(navigator.language, timeOptions)
    });
  // tomorrow Tomorrow, 3:00PM - 4:30 PM
  } else if (begins.getDate() === tomorrow.getDate() &&
    ends.getDate() === tomorrow.getDate() &&
    begins.getMonth() === tomorrow.getMonth() &&
    ends.getMonth() === tomorrow.getMonth() && nowDate < beginsDate) {
    dateString = _('tomorrow-event-notice-timeformat', {
      start:
        new Date(beginsDate).toLocaleString(navigator.language, timeOptions),
      end: new Date(endsDate).toLocaleString(navigator.language, timeOptions)
    });
  // Apr.10, 3:30 PM - Apr.12, 4:30 PM
  } else {
    dateString = _('event-notice-timeformat', {
      start:
        (new Date(beginsDate)).toLocaleString(navigator.language, dateOptions),
      end: (new Date(endsDate)).toLocaleString(navigator.language, dateOptions)
    });
  }

  return dateString;
}