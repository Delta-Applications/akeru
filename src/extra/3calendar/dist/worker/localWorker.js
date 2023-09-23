/* eslint no-console: "off" */
/* eslint no-undef: "off" */
(() => {
  console.log('open-db............................');
  const reqDb = indexedDB.open('b2g-calendar', 20);
  let msgArr = [];
  reqDb.onupgradeneeded = () => {
    const db = reqDb.result;
    if (!db.objectStoreNames.contains('Events')) {
      const eventStore = db.createObjectStore('Events', {
        keyPath: 'uuid'
      });
      eventStore.createIndex('eventSDate', 'eventSDate');
      eventStore.createIndex('eventEDate', 'eventEDate');
    }

    if (!db.objectStoreNames.contains('Busytimes')) {
      const busytimeStore = db.createObjectStore('Busytimes', {
        keyPath: 'busytimeId'
      });
      busytimeStore.createIndex('eventId', 'eventId');
      busytimeStore.createIndex('busytimeSDate', 'busytimeSDate');
      busytimeStore.createIndex('busytimeEDate', 'busytimeEDate');
    }

    if (!db.objectStoreNames.contains('Alarms')) {
      const alarmStore = db.createObjectStore('Alarms', {
        keyPath: 'busytimeId'
      });
      alarmStore.createIndex('eventId', 'eventId');
      alarmStore.createIndex('busytimeSDate', 'busytimeSDate');
      alarmStore.createIndex('busytimeEDate', 'busytimeEDate');
    }

    if (!db.objectStoreNames.contains('Wirteinfo')) {
      db.createObjectStore('Wirteinfo', {
        keyPath: 'uuid'
      });
    }
  };
  reqDb.onsuccess = () => {
    self.db = reqDb.result;
    self.dbName = 'b2g-calendar';
    self.dbVersion = 2;
    self.storeName = 'Events';
    self.alarmStoreName = 'Alarms';
    self.busytimeStore = 'Busytimes';
    console.log('open db success................');

    const trans = self.db.transaction('Wirteinfo', 'readwrite');
    const store = trans.objectStore('Wirteinfo');
    store.put({ uuid: 'writeinfotodb' });
    trans.oncomplete = () => {
      postMessage({
        msgType: 'open-db-success'
      });
    };
    trans.onerror = () => {
      console.log('open db write error ................: ');
      postMessage({
        msgType: 'open-db-failed'
      });
    };
  };

  reqDb.onerror = () => {
    console.log('open db error................: ');
    postMessage({
      msgType: 'open-db-failed'
    });
  };

  self.addEventListener('message', (e) => {
    if (!e) return;

    // eslint-disable-next-line
    let createBusytime = (event) => {
      return {
        busytimeId: `${event.uuid}-${event.startDate}`,
        eventId: event.uuid,
        title: event.title,
        location: event.location,
        description: event.description,
        allDayEvent: event.allDayEvent,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime,
        endTime: event.endTime,
        repeat: event.repeat,
        reminder: event.reminder,
        busytimeSDate: event.eventSDate,
        busytimeEDate: event.eventEDate,
        account: event.account,
        uuid: event.uuid
      };
    };

    const msg = e.data;
    if ('delete-db' === msg.action) {
      // delete db
      const req = indexedDB.deleteDatabase(msg.dbName);
      req.onsuccess = () => {
        console.log('Deleted database successfully');
      };
      req.onerror = () => {
        console.log("Couldn't delete database");
      };
      req.onblocked = () => {
        console.log("Couldn't delete database the operation being blocked");
      };
    } else if ('import-file' === msg.action) {
      self.importScripts(`${msg.url}/workerUtil/SettingsConfig.js`);
      self.importScripts(`${msg.url}/workerUtil/ical.js`);
      msgList = msgArr;
    } else {
      msgArr.push(msg);
      if (msgArr.length <= 1) {
        handleMsgArr(self.db);
      }
    }
  });
})();
