/**
 * @description Handler Service worker msg
 *  1. activity
 *     - pick
 *       Open callog & Return a select calllog item
 *     - getCallLogList
 *       Return all calllog list
 *
 *  2. notification
 *    Open callog
 *
 *  3. telephony-call-ended
 *    Add new log infor to indexDB & send msg to sys
 *
 *  4. bluetooth-dialer-command
 *    Open callog & Create a new call
 */

'use strict';

/**
 * @param { class } DB - Operate indexedDB
 */
importScripts('./js/indexDB.js');

/**
 * @param { method } callEndHandler - Handler call end event
 */
importScripts('./js/callEndHandlerSw.js');

let handler = null;
const db = new DB();
let pickHandler = null;
let getListHandler = null;

const openWindow = ({ url, params, msgInfo }) => {
  clients.openWindow(url, params).then(clientWindow => {
    console.log('Open calllog success');
    if (msgInfo) {
      clientWindow.postMessage(msgInfo);
    }
  });
};

const clearNotifications = () => {
  registration.getNotifications().then(noticesList => {
    console.log(noticesList);
    if (noticesList && noticesList.length > 0) {
      noticesList.forEach(item => {
        item.close();
      });
    }
  });
};

self.addEventListener('install', (evt) => {
  console.log('communications sw install success!');
  evt.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (evt) => {
  console.log('communications sw activate success!');
  evt.waitUntil(self.clients.claim());
});

self.onsystemmessage = evt => {
  console.log('communications onsystemmessage: ' + evt.name);

  let data = null;
  let viewInfo = null;

  evt.waitUntil(
    (() => {
      switch (evt.name) {
        case 'telephony-call-ended':
          callEndHandler(evt);
          break;
        case 'activity':
          handler = evt.data.webActivityRequestHandler();

          if (handler.source.name === 'pick') {
            viewInfo = {
              url: '/index.html#pick',
              params: { disposition: 'inline' },
              msgInfo: {
                type: evt.name,
                date: 'pick'
              }
            };
            pickHandler = handler; // cache handler
            openWindow(viewInfo);
          }

          if (handler.source.name === 'getCallLogList') {
            getListHandler = handler;

            db.getAllData()
              .then(list => {
                getListHandler.postResult(list);
                getListHandler = null;
              })
              .catch(() => {
                getListHandler.postResult([]);
                getListHandler = null;
              });
          }

          break;
        case 'notification':
          viewInfo = {
            url: '/index.html'
          };

          openWindow(viewInfo);
          break;
        case 'bluetooth-dialer-command':
          data = evt.data.json();
          viewInfo = {
            url: '/index.html',
            msgInfo: {
              type: evt.name,
              data
            }
          };

          openWindow(viewInfo);
          break;
        default:
          console.log('Illegal message');
      }
    })()
  );
};

self.onnotificationclick = event => {
  event.waitUntil(
    (() => {
      const viewInfo = {
        url: '/index.html'
      };

      openWindow(viewInfo);
      clearNotifications();
    })()
  );
};

self.addEventListener('message', ev => {
  if (ev.data.name === 'addCall' && pickHandler) {
    if (ev.data) {
      // select a tel number
      pickHandler.postResult(ev.data.value);
    } else {
      // no select number, quit callog
      pickHandler.postError(null);
    }

    pickHandler = null;
  }

  // when open callog success clear all notifications
  if (ev.data.name === 'clearNotices') {
    clearNotifications();
  }
});
