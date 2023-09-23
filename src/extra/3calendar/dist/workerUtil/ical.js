/* eslint no-unused-vars: "off" */
/* eslint no-undef: "off" */
let indexDbHandle;
let allCache = [];
let debugSwitch = false;
let msgList = null;

/** **********     process message           ******************************* */
function handleMsgArr(db) {
  if (db) {
    indexDbHandle = db;
  }

  if (msgList.length > 0) {
    processMessage(msgList[0]);
  }
}

function processMessage(msg) {
  switch (msg.action) {
    case 'new-event':
      addItemToAlarmDataBase(msg.item, indexDbHandle).then(() => {
        if (msg.item.repeat !== 'never') {
          addRepeatEvent(msg.item, indexDbHandle);
        } else {
          addNoRepeatEvent(msg.item, indexDbHandle);
        }
      });
      break;
    case 'debug-switch':
      {
        const { debugGaia } = msg;
        debugSwitch = debugGaia;
        msgList.shift();
        handleMsgArr();
      }
      break;
    case 'fetch-events':
      console.log('...............fetch-events');
      getBusytime(msg.selectedMonth, indexDbHandle, msg.timeChange);
      break;
    case 'fetch-search-events':
      console.log('...............fetch-search-events');
      getSearchBusytime(msg.selectedMonth, indexDbHandle);
      break;
    case 'delete-event':
      deleteEvent(msg.busytimeItem.eventId, indexDbHandle);
      break;
    case 'update-event':
      updateEvent(msg.item, indexDbHandle);
      break;
    case 'update-event-all':
      updateEventAll(msg.item, indexDbHandle);
      break;
    case 'update-event-all-future':
      updateEventAllFuture(msg.item, indexDbHandle);
      break;
    case 'get-alarm-item':
      getAlarmItem(indexDbHandle);
      break;
    case 'find-delete-alarm':
      findDeleteAlarm(msg.item, indexDbHandle);
      break;
    case 'delete-account-events':
      deleteAccountEvents(msg.eventIds, indexDbHandle);
      break;
    case 'get-all-activesync-event':
      getAllActivesyncEvent(indexDbHandle);
      break;
    case 'get-all-google-event':
      getAllGoogleEvent(indexDbHandle);
      break;
    case 'get-all-caldav-event':
      getAllCaldavEvent(indexDbHandle);
      break;
    case 'delete-all-event':
      deleteAllEvent(msg.list, indexDbHandle);
      break;
    case 'new-all-event':
      newAllEvent(msg.list, indexDbHandle);
      break;
    default:
      break;
  }
}

function sendMessage(msgInfo) {
  postMessage(msgInfo);

  msgList.shift();
  handleMsgArr();
}
/** **********     process message           ******************************* */

function uuid() {
  // eslint-disable-next-line
  let S4 = (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  // eslint-disable-next-line
  return (`${S4 + S4}-${S4}-4${S4.substr(0, 3)}-${S4}-${S4}${S4}${S4}`).toLowerCase();
}

function getMaxDateValue(date) {
  let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let lastDay = new Date(year, month, 0);

  return lastDay.valueOf() + 14 * 24 * 60 * 60 * 1000 - 1;
}

function getRepeatOffset(repeat) {
  let offsetMillseconds = 24 * 60 * 60 * 1000;

  switch (repeat) {
    case 'every day':
      break;
    case 'every week':
      offsetMillseconds *= 7;
      break;
    case 'every 2 weeks':
      offsetMillseconds *= 14;
      break;
    default:
      break;
  }

  return offsetMillseconds;
}

function getMonthRepeatOffset(item, num) {
  if ('every month' !== item.repeat) {
    return;
  }

  let month = item.repeatSDate.getMonth() + num;
  let year = item.repeatSDate.getUTCFullYear() + parseInt(month / 11, 10);
  let date = item.repeatSDate.getDate();
  /* eslint operator-assignment: "off" */
  month = month % 11;

  let lastDay = new Date(year, month, 1);

  if (date > lastDay) {
    return 0;
  }

  return (new Date(year, month, date)).valueOf() -
    (new Date(item.repeatSDate.valueOf())).setUTCHours(0, 0, 0, 0).valueOf();
}

function formatBusytimeDate(date) {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();

  month = month < 10 ? `${'0'}${month}` : month.toString();
  day = day < 10 ? `${'0'}${day}` : day.toString();

  return `${month}${'/'}${day}${'/'}${year}`;
}

function expandBusytime(item, repeatOffset, repeatDate) {
  /* eslint no-unneeded-ternary: "off" */
  let offset = repeatOffset ? repeatOffset : 0;
  let busytimeStartDate = new Date(item.eventSDate.valueOf() + offset);
  let busytimeEndDate = new Date(item.eventEDate.valueOf() + offset);

  return {
    busytimeId: `${item.uuid}-${formatBusytimeDate(busytimeStartDate)}`,
    eventId: item.uuid,
    title: item.title,
    location: item.location,
    description: item.description,
    allDayEvent: item.allDayEvent,
    startDate: formatBusytimeDate(busytimeStartDate),
    endDate: formatBusytimeDate(busytimeEndDate),
    startTime: item.startTime,
    endTime: item.endTime,
    repeat: item.repeat,
    reminder: item.reminder,
    busytimeSDate: busytimeStartDate,
    busytimeEDate: busytimeEndDate,
    repeatSDate: repeatDate ? repeatDate.repeatSDate : null,
    repeatEDate: repeatDate ? repeatDate.repeatEDate : null,
    account: item.account,
    serverId: item.serverId,
    authenticatorId: item.authenticatorId
  };
}

function persistBusytimeForPepeatEvent(item, date) {
  let minDate;
  let maxDate;
  let repeatOffset;
  let busytimeQueue = [];
  let num = 0;
  let repeatDate = {
    repeatSDate: new Date(item.eventSDate),
    repeatEDate: item.repeatEDate ? new Date(item.repeatEDate) : null
  };

  minDate = item.eventSDate.valueOf();
  maxDate = getMaxDateValue(date);
  repeatOffset = getRepeatOffset(item.repeat);

  if (item.repeatEDate && item.repeatEDate.valueOf() < maxDate) {
    maxDate = item.repeatEDate.valueOf();
  }

  busytimeQueue.push(expandBusytime(item, 0, repeatDate));
  num++;

  /* eslint no-constant-condition: ["error", { "checkLoops": false }] */
  while (1) {
    let busytimeItem = null;

    if ('every month' === item.repeat) {
      repeatOffset = getMonthRepeatOffset(item, num);
      if (0 !== repeatOffset) {
        busytimeItem = expandBusytime(item, repeatOffset, repeatDate);
      }
    } else {
      busytimeItem = expandBusytime(item, repeatOffset, repeatDate);

      item.eventSDate = new Date(item.eventSDate.valueOf() + repeatOffset);
      item.eventEDate = new Date(item.eventEDate.valueOf() + repeatOffset);
    }

    num++;

    if ((busytimeItem && busytimeItem.busytimeSDate.valueOf() > maxDate) ||
      num > 42) {
      break;
    } else {
      busytimeQueue.push(busytimeItem);
    }
  }

  let trans = indexDbHandle.transaction(DB.busytimeStore, 'readwrite');
  let busytimeStore = trans.objectStore(DB.busytimeStore);

  busytimeQueue.forEach((busytime) => {
    busytimeStore.put(busytime);
  });

  trans.oncomplete = () => {
    sendMessage({
      repeat: true,
      msgType: 'new-event-success'
    });
  };

  trans.onerror = () => {
    sendMessage({
      msgType: 'new-event-failed'
    });
  };
}

function createBusytime(event) {
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
    uuid: event.uuid,
    serverId: event.serverId,
    authenticatorId: event.authenticatorId
  };
}

function persistBusytimeByEvent(event) {
  let busytimeItem = createBusytime(event);
  let trans = indexDbHandle.transaction('Busytimes', 'readwrite');
  let busytimeStore = trans.objectStore('Busytimes');
  busytimeStore.add(busytimeItem);
  trans.oncomplete = () => {
    sendMessage({
      busytimeItem: busytimeItem,
      msgType: 'new-event-success'
    });
  };
  trans.onerror = () => {
    sendMessage({
      msgType: 'new-event-failed'
    });
  };
}

function addRepeatEvent(item, db) {
  indexDbHandle = db;

  const trans = indexDbHandle.transaction(DB.eventStore, 'readwrite');
  const eventStore = trans.objectStore(DB.eventStore);

  eventStore.put(item);

  trans.oncomplete = () => {
    persistBusytimeForPepeatEvent(item, new Date(item.eventSDate));
  };

  trans.onerror = () => {
    sendMessage({
      msgType: 'new-event-failed'
    });
  };
}

function addNoRepeatEvent(item, db) {
  indexDbHandle = db;

  getEventItemById(item.uuid).then((eventItem) => {
    if (eventItem) {
      updateEvent(item, db);
    } else {
      const trans = indexDbHandle.transaction(DB.eventStore, 'readwrite');
      const store = trans.objectStore(DB.eventStore);
      store.add(item);

      trans.oncomplete = () => {
        persistBusytimeByEvent(item);
      };

      trans.onerror = () => {
        sendMessage({
          msgType: 'new-event-failed'
        });
      };
    }
  }, () => {
    sendMessage({
      msgType: 'new-event-failed'
    });
  });
}

/** ************************************************************************* */
function all(DbName, callback) {
  allCache = [];
  dumpLog(`enter all function DbName: ${DbName}`);

  let trans = indexDbHandle.transaction(DbName, 'readwrite');
  let store = trans.objectStore(DbName);

  // Todo: used for compatibility with desktop-browers like chrome will use cursor instead
  if (store.mozGetAll) {
    store.mozGetAll().onsuccess = (event) => {
      event.target.result.forEach((data) => {
        allCache.push(data);
      });
    };
  }

  trans.onerror = (event) => {
    dumpLog(`all function err.name: ${event.target.err.name}`);
    callback(event.target.err.name);
  };

  trans.oncomplete = () => {
    callback(null, allCache);
  };
}

function getMinDateValue(date) {
  let year = date.getFullYear().toString();
  let month = date.getMonth().toString();
  let lastDay = new Date(year, month, 1);

  return lastDay.valueOf() - 14 * 24 * 60 * 60 * 1000;
}

function getFirstRepeatDate(item, selectedMonth) {
  let date = 0;
  let firstDay = new Date(selectedMonth.valueOf());

  firstDay = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);
  firstDay = new Date(firstDay.valueOf() -
    firstDay.getTimezoneOffset() * 60 * 1000 -
    15 * 24 * 60 * 60 * 1000);
  let itemRepeatSDate = new Date(item.repeatSDate.valueOf());
  itemRepeatSDate = new Date(itemRepeatSDate.valueOf()
    - firstDay.getTimezoneOffset() * 60 * 1000);
  let dayMillseconds = 24 * 60 * 60 * 1000;
  itemRepeatSDate = itemRepeatSDate.setUTCHours(0, 0, 0, 0);
  let offset = firstDay.valueOf() - itemRepeatSDate.valueOf();
  let lastDay = new Date(selectedMonth.valueOf());
  lastDay = new Date(lastDay.getUTCFullYear(), lastDay.getMonth() + 1, 0);

  switch (item.repeat) {
    case 'every day':
      date = firstDay.getDate();
      break;
    case 'every week':
      date = new Date(itemRepeatSDate.valueOf() +
        Math.round(offset / dayMillseconds / 7) * 7 * dayMillseconds);
      date = date.getDate();
      break;
    case 'every 2 weeks':
      date = new Date(itemRepeatSDate.valueOf() +
        Math.round(offset / dayMillseconds / 14) * 14 * dayMillseconds);
      date = date.getDate();
      break;
    case 'every month':
      date = item.repeatSDate.getDate();

      if (date > lastDay.getDate()) {
        date = 0;
      }
      break;
    default:
      break;
  }

  return date;
}

function getMonthRepeatEventOffset(item, num) {
  if ('every month' !== item.repeat) {
    return;
  }

  let month = item.eventSDate.getMonth() + num;
  let year = item.eventSDate.getUTCFullYear();
  let date = item.eventSDate.getDate();
  let lastDay = (new Date(year, month + 1, 0).getDate());

  if (date > lastDay) {
    return 0;
  }

  return (new Date(year, month, date)).valueOf() -
    (new Date(item.eventSDate.valueOf())).setHours(0, 0, 0, 0).valueOf();
}

function persistRepeatBusytime(item, busytimes, selectedMonth) {
  return new Promise((resolve, reject) => {
    let minDate;
    let maxDate;
    let repeatOffset;
    let busytimeQueue = [];
    let num = 0;
    let repeatDate = {
      repeatSDate: new Date(item.eventSDate),
      repeatEDate: item.repeatEDate ? new Date(item.repeatEDate) : null
    };

    minDate = getMinDateValue(selectedMonth);
    maxDate = getMaxDateValue(selectedMonth);
    repeatOffset = getRepeatOffset(item.repeat);

    if (maxDate < item.eventSDate.valueOf()) {
      resolve(null);
      return;
    }

    if (minDate > item.eventSDate.valueOf()) {
      let offset = item.eventEDate.valueOf() - item.eventSDate.valueOf();
      let firstDate = getFirstRepeatDate(item, selectedMonth);

      if (0 === firstDate) {
        resolve(null);
        return;
      }

      item.eventSDate.setDate(firstDate);
      item.eventSDate.setFullYear(selectedMonth.getFullYear());
      item.eventSDate.setMonth(selectedMonth.getMonth() - 1);
      item.eventEDate = new Date(item.eventSDate.valueOf() + offset);
    }

    if (item.repeatEDate && item.repeatEDate.valueOf() < maxDate) {
      maxDate = item.repeatEDate.valueOf();
    }

    busytimeItem = expandBusytime(item, 0, repeatDate);
    if (busytimeItem.busytimeSDate.valueOf() > maxDate) {
      resolve(null);
      return;
    }

    busytimeQueue.push(busytimeItem);
    num++;

    let btIndex = busytimes.findIndex((node) => {
      return node.busytimeId === busytimeQueue[0].busytimeId;
    });

    let trans = indexDbHandle.transaction(DB.busytimeStore, 'readwrite');
    let busytimeStore = trans.objectStore(DB.busytimeStore);

    /* eslint no-constant-condition: ["error", { "checkLoops": false }] */
    while (1) {
      let busytimeItem = null;

      if ('every month' === item.repeat) {
        repeatOffset = getMonthRepeatEventOffset(item, num);
        if (0 !== repeatOffset) {
          busytimeItem = expandBusytime(item, repeatOffset, repeatDate);
        } else {
          break;
        }
      } else {
        busytimeItem = expandBusytime(item, repeatOffset, repeatDate);
        item.eventSDate = new Date(item.eventSDate.valueOf() + repeatOffset);
        item.eventEDate = new Date(item.eventEDate.valueOf() + repeatOffset);
      }

      num++;

      if ((busytimeItem && busytimeItem.busytimeSDate.valueOf() > maxDate) ||
        num > 56) {
        break;
      } else {
        busytimeQueue.push(busytimeItem);
      }
    }

    busytimeQueue.forEach((busytime) => {
      busytimeStore.put(busytime);
    });

    trans.oncomplete = () => {
      resolve('success');
    };

    trans.onerror = (event) => {
      reject(event.target.error.name);
    };
  });
}

function getBusytimeForMonthNew(date, timeChange) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const lastDay = new Date(y, m + 1, 14, 23, 59, 59);
  let firstDay = new Date(y, m, 0, 23, 59, 59);
  firstDay = firstDay.setDate(firstDay.getDate() - 15);
  let busytimes = [];

  all(DB.busytimeStore, (err, allBusytimes) => {
    if (err) {
      sendMessage({
        msgType: 'fetch-events-failed'
      });
      return;
    }

    for (let i = 0; i < allBusytimes.length; i++) {
      let sDate = allBusytimes[i].busytimeSDate;
      let eDate = allBusytimes[i].busytimeEDate;
      if ((sDate >= firstDay && sDate <= lastDay) ||
        (eDate >= firstDay && eDate <= lastDay) ||
        (sDate <= firstDay && eDate >= lastDay)) {
        busytimes.push(allBusytimes[i]);
      }
    }

    if (timeChange) {
      addBusytimesToAlarm(busytimes, date);
    } else {
      sendMessage({
        busytimes,
        msgType: 'fetch-events-success'
      });
    }
  });
}

function addBusytimesToAlarm(busytimes, date) {
  let allItem = [];
  let alarms = [];
  let exceedTwoDays = false;
  let exceedTwoDaysAlarm = [];
  let now = new Date(date.valueOf());
  let twoDay = 2 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < busytimes.length; i++) {
    allItem.push(createAlarmItemByBusytime(busytimes[i]));
  }

  allItem.sort((a, b) => {
    return a.triggle - b.triggle;
  });

  for (let i = 0; i < allItem.length; i++) {
    if (allItem[i].triggle > now.valueOf() &&
      (allItem[i].triggle < now.valueOf() + twoDay)) {
      alarms.push(allItem[i]);
    } else if (!exceedTwoDays
      && allItem[i].triggle >= now.valueOf() + twoDay) {
      exceedTwoDaysAlarm = allItem[i];
      exceedTwoDays = true;
    }
  }

  if (0 === alarms.length && exceedTwoDays) {
    alarms.push(exceedTwoDaysAlarm);
  }

  if (0 === alarms.length) {
    sendMessage({
      busytimes,
      msgType: 'fetch-events-success'
    });

    return;
  }

  let trans = indexDbHandle.transaction(DB.alarmStore, 'readwrite');
  let alarmStore = trans.objectStore(DB.alarmStore);

  alarms.forEach((alarmItem) => {
    alarmStore.put(alarmItem);
  });

  trans.oncomplete = () => {
    sendMessage({
      busytimes,
      msgType: 'fetch-events-success'
    });
  };

  trans.onerror = (err) => {
    sendMessage({
      busytimes,
      msgType: 'fetch-events-success'
    });
  };
}

function getBusytimeForMonth(date) {
  return new Promise((res) => {
    const y = date.getFullYear();
    const m = date.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 1);
    const range = IDBKeyRange.bound(firstDay, lastDay);
    const trans = indexDbHandle.transaction(DB.busytimeStore, 'readonly');
    const store = trans.objectStore(DB.busytimeStore);
    const curReq = store.index('busytimeSDate').openCursor(range);
    let busytimes = [];

    trans.oncomplete = () => {
      res(busytimes);
    };

    curReq.onsuccess = (evt) => {
      let cursor = evt.target.result;
      if (cursor) {
        busytimes.push(cursor.value);
        cursor.continue();
      }
    };
  });
}

function getBusytime(selectedMonth, db, timeChange) {
  indexDbHandle = db;
  let promiseList = [];

  all(DB.eventStore, (err, allEvent) => {
    getBusytimeForMonth(selectedMonth).then((busytimes) => {
      for (let i = 0; i < allEvent.length; i++) {
        if (allEvent[i].repeat !== 'never') {
          promiseList.push(
            persistRepeatBusytime(allEvent[i], busytimes, selectedMonth)
          );
        }
      }
      Promise.all(promiseList).then((results) => {
        getBusytimeForMonthNew(selectedMonth, timeChange);
      });
    });
  });
}

/** ************************************************************************* */
function getSearchBusytime(selectedMonth, db) {
  indexDbHandle = db;
  let promiseList = [];

  all(DB.eventStore, (err, allEvent) => {
    setBusytimeForSearch(selectedMonth).then((busytimes) => {
      for (let i = 0; i < allEvent.length; i++) {
        if (allEvent[i].repeat !== 'never') {
          promiseList.push(
            persistRepeatBusytime(allEvent[i], busytimes, selectedMonth)
          );
        }
      }
      Promise.all(promiseList).then((results) => {
        getBusytimeForSearch(selectedMonth);
      });
    });
  });
}

function setBusytimeForSearch(date) {
  return new Promise((res) => {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDay = new Date(date.valueOf() - oneDay);
    const lastDay = new Date(date.valueOf() + oneDay * 8);
    const range = IDBKeyRange.bound(firstDay, lastDay);
    const trans = indexDbHandle.transaction(DB.busytimeStore, 'readonly');
    const store = trans.objectStore(DB.busytimeStore);
    const curReq = store.index('busytimeSDate').openCursor(range);
    let busytimes = [];

    trans.oncomplete = () => {
      res(busytimes);
    };

    curReq.onsuccess = (evt) => {
      let cursor = evt.target.result;
      if (cursor) {
        busytimes.push(cursor.value);
        cursor.continue();
      }
    };
  });
}

function getBusytimeForSearch(date) {
  const oneDay = 24 * 60 * 60 * 1000;
  const firstDay = new Date(date.valueOf() - oneDay);
  const lastDay = new Date(date.valueOf() + oneDay * 8);
  let busytimes = [];

  all(DB.busytimeStore, (err, allBusytimes) => {
    if (err) {
      sendMessage({
        msgType: 'fetch-search-events-failed'
      });
      return;
    }

    for (let i = 0; i < allBusytimes.length; i++) {
      let sDate = allBusytimes[i].busytimeSDate;
      let eDate = allBusytimes[i].busytimeEDate;
      if ((sDate >= firstDay && sDate <= lastDay) ||
        (eDate >= firstDay && eDate <= lastDay) ||
        (sDate <= firstDay && eDate >= lastDay)) {
        busytimes.push(allBusytimes[i]);
      }
    }

    sendMessage({
      busytimes,
      msgType: 'fetch-search-events-success'
    });
  });
}

/** ************************************************************************* */
function removeByIndex(indexName, indexValue, callback) {
  let trans = indexDbHandle.transaction(DB.busytimeStore, 'readwrite');
  let store = trans.objectStore(DB.busytimeStore);

  if (callback) {
    trans.addEventListener('complete', () => {
      callback(null);
    });

    trans.addEventListener('error', (event) => {
      callback(event);
    });
  }

  let index = trans.objectStore(DB.busytimeStore).index(indexName);
  let req = index.openCursor(
    IDBKeyRange.only(indexValue)
  );

  req.onsuccess = (event) => {
    let cursor = event.target.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
}

function deleteEvent(eventId, db) {
  indexDbHandle = db;
  let trans = indexDbHandle.transaction(DB.eventStore, 'readwrite');
  let eventStore = trans.objectStore(DB.eventStore);
  eventStore.delete(eventId);
  trans.oncomplete = () => {
    removeByIndex('eventId', eventId, (err) => {
      if (err) {
        sendMessage({
          msgType: 'delete-event-failed'
        });

        return;
      }

      /* eslint no-use-before-define: "off" */
      removeAlarmByIndex('eventId', eventId).then(() => {
        sendMessage({
          msgType: 'delete-event-success'
        });
      }, (evt) => {
        sendMessage({
          msgType: 'delete-event-failed'
        });
      });
    });
    // removeBusytime(msg.busytimeItem.eventId);
  };
  trans.onerror = () => {
    sendMessage({
      msgType: 'delete-event-failed'
    });
  };
}

/** **********    update event all        *********************************** */

function getEventItemById(id) {
  return new Promise((res, rej) => {
    let trans = indexDbHandle.transaction(DB.eventStore, 'readwrite');
    let eventStore = trans.objectStore(DB.eventStore);
    let req = eventStore.get(id);

    req.onsuccess = () => {
      res(req.result);
    };

    req.onerror = (event) => {
      rej(event);
    };
  });
}

function updateEventItemToStore(item) {
  return new Promise((res, rej) => {
    let trans = indexDbHandle.transaction(DB.eventStore, 'readwrite');
    let eventStore = trans.objectStore(DB.eventStore);

    eventStore.put(item);

    trans.oncomplete = () => {
      res();
    };

    trans.onerror = () => {
      rej('update-failed');
    };
  });
}

function deleteBusytimeByEvent(item) {
  return new Promise((res, rej) => {
    removeByIndex('eventId', item.uuid, (err) => {
      if (err) {
        rej('update-failed');
        return;
      }

      res();
    });
  });
}

function deleteAlarmByEvent(item) {
  return new Promise((res, rej) => {
    /* eslint no-use-before-define: "off" */
    removeAlarmByIndex('eventId', item.uuid).then(() => {
      res();
    }, (evt) => {
      rej('update-failed');
    });
  });
}

function addBusytimeByEvent(item, date) {
  return new Promise((res, rej) => {
    let minDate;
    let maxDate;
    let repeatOffset;
    let busytimeQueue = [];
    let num = 0;
    let repeatDate = {
      repeatSDate: new Date(item.eventSDate),
      repeatEDate: item.repeatEDate
    };

    minDate = item.eventSDate.valueOf();
    maxDate = getMaxDateValue(date);
    repeatOffset = getRepeatOffset(item.repeat);

    if (item.repeatEDate && item.repeatEDate.valueOf() < maxDate) {
      maxDate = item.repeatEDate.valueOf();
    }

    busytimeQueue.push(expandBusytime(item, 0, repeatDate));
    num++;

    /* eslint no-constant-condition: ["error", { "checkLoops": false }] */
    while (1) {
      let busytimeItem = null;

      if ('every month' === item.repeat) {
        repeatOffset = getMonthRepeatOffset(item, num);
        if (0 !== repeatOffset) {
          busytimeItem = expandBusytime(item, repeatOffset, repeatDate);
        }
      } else {
        busytimeItem = expandBusytime(item, repeatOffset, repeatDate);

        item.eventSDate = new Date(item.eventSDate.valueOf() + repeatOffset);
        item.eventEDate = new Date(item.eventEDate.valueOf() + repeatOffset);
      }

      num++;

      if ((busytimeItem && busytimeItem.busytimeSDate.valueOf() > maxDate) ||
        num > 42) {
        break;
      } else {
        busytimeQueue.push(busytimeItem);
      }
    }

    let trans = indexDbHandle.transaction(DB.busytimeStore, 'readwrite');
    let busytimeStore = trans.objectStore(DB.busytimeStore);

    busytimeQueue.forEach((busytime) => {
      busytimeStore.put(busytime);
    });

    trans.oncomplete = () => {
      res();
    };

    trans.onerror = () => {
      rej('update-failed');
    };
  });
}

function getUpdateEventItem(itemNew, itemOld) {
  let newEventSDate = new Date(itemNew.eventSDate.valueOf());
  let selectedDate = new Date(itemNew.selectedDate.valueOf());

  if (itemOld.allDayEvent && !itemNew.allDayEvent) {
    selectedDate = new Date(itemNew.selectedDate.valueOf() + 1000);
  }

  /* eslint operator-linebreak: "off" */
  let startOffset = 0;
  if (!itemOld.allDayEvent && itemNew.allDayEvent) {
    selectedDate = new Date(selectedDate.setUTCHours(0, 0, 0, 0));
    startOffset = newEventSDate.setHours(0, 0, 0, 0) -
      selectedDate.setHours(0, 0, 0, 0);
  } else {
    startOffset = newEventSDate.setUTCHours(0, 0, 0, 0) -
      selectedDate.setUTCHours(0, 0, 0, 0);
  }
  let startDatetime = new Date(itemOld.eventSDate.valueOf() + startOffset);
  startDate = formatBusytimeDate(startDatetime);

  let newEventEDate = new Date(itemNew.eventEDate.valueOf());
  let endOffset = newEventEDate.setUTCHours(0, 0, 0, 0) - newEventSDate;
  let endDate = new Date(startDatetime.valueOf() + endOffset);

  if (!itemOld.allDayEvent && itemNew.allDayEvent) {
    startDatetime = startDatetime.setHours(0, 0, 0, 0);
  }
  if (itemNew.allDayEvent) {
    endOffset = itemNew.eventEDate.valueOf() - itemNew.eventSDate.valueOf();
    endDate = new Date(startDatetime.valueOf() + endOffset - 1000);
  }
  endDate = formatBusytimeDate(endDate);

  let item = {
    uuid: itemNew.uuid,
    title: itemNew.title,
    location: itemNew.location,
    description: itemNew.description,
    allDayEvent: itemNew.allDayEvent,
    startDate: startDate,
    endDate: endDate,
    startTime: itemNew.startTime,
    endTime: itemNew.endTime,
    repeat: itemNew.repeat,
    reminder: itemNew.reminder,
    eventSDate: new Date(`${startDate} ${itemNew.startTime}`),
    eventEDate: new Date(`${endDate} ${itemNew.endTime}`),
    repeatSDate: new Date(`${startDate} ${itemNew.startTime}`),
    repeatEDate: itemOld.repeatEDate,
    account: itemOld.account,
    serverId: itemOld.serverId,
    authenticatorId: itemOld.authenticatorId
  };

  return item;
}

/* eslint prefer-promise-reject-errors: "off" */
/* eslint consistent-return: "off" */
function updateEventAll(item, db) {
  indexDbHandle = db;

  let updateEventItem = null;
  let oldEvent = null;

  getEventItemById(item.uuid).then((eventItem) => {
    updateEventItem = getUpdateEventItem(item, eventItem);
    oldEvent = eventItem;

    if (('never' !== updateEventItem.repeat && 'never' === oldEvent.repeat) ||
      ('never' === updateEventItem.repeat && 'never' !== oldEvent.repeat)) {
      updateEventItemToStore(item);
    } else {
      updateEventItemToStore(updateEventItem);
    }
  }, (err) => {
    return 'update-failed';
  }).then((value) => {
    if ('update-failed' === value) {
      return value;
    }

    deleteBusytimeByEvent(item);
  }).then((value) => {
    if ('update-failed' === value) {
      return value;
    }

    updateAlarmItem(item, oldEvent);
  }).then((value) => {
    if ('update-failed' === value) {
      return value;
    }

    if ('never' !== oldEvent.repeat && 'never' === updateEventItem.repeat) {
      addBusytimeByEventNoRepeat(getUpdateEventItemNoRepeat(item));
    } else if ('never' === updateEventItem.repeat) {
      addBusytimeByEventNoRepeat(getUpdateEventItemNoRepeat(updateEventItem));
    } else if ('never' !== updateEventItem.repeat
      && 'never' === oldEvent.repeat) {
      addBusytimeByEvent(updateEventItem, updateEventItem.eventSDate);
    } else {
      addBusytimeByEvent(updateEventItem, updateEventItem.eventSDate);
    }

    addUpdateAlarmItem(updateEventItem, indexDbHandle);
  }, (err) => {
    return err;
  /* eslint newline-per-chained-call: "off" */
  }).then((value) => {
    if ('update-failed' === value) {
      sendMessage({
        msgType: 'update-event-all-failed'
      });
    } else {
      sendMessage({
        msgType: 'update-event-all-success'
      });
    }
  }, (err) => {
    sendMessage({
      msgType: 'update-event-all-failed'
    });
  });
}

function getFirstRepeatItem(item) {
  let newEventSDate = new Date(item.eventSDate.valueOf());
  let newEventEDate = new Date(item.eventEDate.valueOf());
  let endOffset = newEventEDate.setUTCHours(0, 0, 0, 0) - newEventSDate;
  let endDate = new Date(item.repeatSDate.valueOf() + endOffset);
  endDate = formatBusytimeDate(endDate);
  const startDate = formatBusytimeDate(item.repeatSDate);

  let firstItem = {
    uuid: item.uuid,
    title: item.title,
    location: item.location,
    description: item.description,
    allDayEvent: item.allDayEvent,
    startDate,
    endDate,
    startTime: item.startTime,
    endTime: item.endTime,
    repeat: item.repeat,
    reminder: item.reminder,
    eventSDate: new Date(`${startDate} ${item.startTime}`),
    eventEDate: new Date(`${endDate} ${item.endTime}`),
    repeatSDate: item.repeatSDate,
    repeatEDate: item.repeatEDate,
    account: item.account,
    serverId: item.serverId,
    authenticatorId: item.authenticatorId
  };

  return firstItem;
}

function addUpdateAlarmItem(item, db) {
  let firstItem = getFirstRepeatItem(item);
  const now = new Date();

  if (firstItem.repeatEDate && firstItem.repeatEDate < now) {
    return;
  }

  addItemToAlarmDataBase(firstItem, db);
}
/** **********    update event all future   ********************************* */

function getFrontEventItem(itemNew, itemOld) {
  let repeatEndDate = new Date(itemNew.selectedDate);
  repeatEndDate = repeatEndDate.setDate(repeatEndDate.getDate() - 1);

  let item = {
    uuid: itemOld.uuid,
    title: itemOld.title,
    location: itemOld.location,
    description: itemOld.description,
    allDayEvent: itemOld.allDayEvent,
    startDate: itemOld.startDate,
    endDate: itemOld.endDate,
    startTime: itemOld.startTime,
    endTime: itemOld.endTime,
    repeat: itemOld.repeat,
    reminder: itemOld.reminder,
    eventSDate: itemOld.eventSDate,
    eventEDate: itemOld.eventEDate,
    repeatSDate: itemOld.repeatSDate,
    repeatEDate: new Date(repeatEndDate),
    account: itemOld.account,
    serverId: itemOld.serverId,
    authenticatorId: itemOld.authenticatorId
  };

  return item;
}

function getLastEventItem(itemNew, itemOld) {
  let item = {
    uuid: itemNew.uuidNew,
    title: itemNew.title,
    location: itemNew.location,
    description: itemNew.description,
    allDayEvent: itemNew.allDayEvent,
    startDate: itemNew.startDate,
    endDate: itemNew.endDate,
    startTime: itemNew.startTime,
    endTime: itemNew.endTime,
    repeat: itemNew.repeat,
    reminder: itemNew.reminder,
    eventSDate: itemNew.eventSDate,
    eventEDate: itemNew.eventEDate,
    repeatSDate: itemNew.eventSDate,
    repeatEDate: itemNew.repeatEDate,
    account: itemNew.account,
    serverId: itemNew.serverId,
    authenticatorId: itemNew.authenticatorId
  };

  return item;
}

function addEventItemToStore(item) {
  return new Promise((res, rej) => {
    let trans = indexDbHandle.transaction(DB.eventStore, 'readwrite');
    let eventStore = trans.objectStore(DB.eventStore);

    eventStore.add(item);

    trans.oncomplete = () => {
      res();
    };

    trans.onerror = () => {
      rej('update-failed');
    };
  });
}

/* eslint prefer-promise-reject-errors: "off" */
/* eslint consistent-return: "off" */
function updateEventAllFuture(item, db) {
  indexDbHandle = db;
  let frontEventItem = null;
  let lastEventItem = null;

  getEventItemById(item.uuid).then((eventItem) => {
    frontEventItem = getFrontEventItem(item, eventItem);
    lastEventItem = getLastEventItem(item, eventItem);

    updateEventItemToStore(frontEventItem);
  }, (err) => {
    return 'update-failed';
  }).then((value) => {
    if ('update-failed' === value) {
      return value;
    }

    addEventItemToStore(lastEventItem);
  }).then((value) => {
    if ('update-failed' === value) {
      return value;
    }

    deleteBusytimeByEvent(frontEventItem);
  }).then((value) => {
    if ('update-failed' === value) {
      return value;
    }
    addBusytimeByEvent(frontEventItem, lastEventItem.eventSDate);
  }, (err) => {
    return err;
  }).then((value) => {
    if ('update-failed' === value) {
      return value;
    }
    addBusytimeByEvent(lastEventItem, lastEventItem.eventSDate);
  }, (err) => {
    return err;
  }).then((value) => {
    if ('update-failed' === value) {
      sendMessage({
        msgType: 'update-event-all-future-failed'
      });
    } else {
      sendMessage({
        msgType: 'update-event-all-future-success'
      });
    }
  }, (err) => {
    sendMessage({
      msgType: 'update-event-all-future-failed'
    });
  });
}

/** **********    update event            *********************************** */

function getUpdateEventItemNoRepeat(item) {
  let eventItem = {
    uuid: item.uuid,
    title: item.title,
    location: item.location,
    description: item.description,
    allDayEvent: item.allDayEvent,
    startDate: item.startDate,
    endDate: item.endDate,
    startTime: item.startTime,
    endTime: item.endTime,
    repeat: item.repeat,
    reminder: item.reminder,
    eventSDate: item.eventSDate,
    eventEDate: item.eventEDate,
    repeatSDate: item.repeatSDate,
    repeatEDate: item.repeatEDate,
    account: item.account,
    serverId: item.serverId,
    authenticatorId: item.authenticatorId
  };

  return eventItem;
}

function addBusytimeByEventNoRepeat(item) {
  return new Promise((res, rej) => {
    let busytimeItem = expandBusytime(item);

    let trans = indexDbHandle.transaction(DB.busytimeStore, 'readwrite');
    let busytimeStore = trans.objectStore(DB.busytimeStore);

    busytimeStore.add(busytimeItem);

    trans.oncomplete = () => {
      res();
    };

    trans.onerror = () => {
      rej('update-failed');
    };
  });
}

function getAlarmItemById(busytimeId) {
  return new Promise((res, rej) => {
    let trans = indexDbHandle.transaction(DB.alarmStore, 'readwrite');
    let alarmStore = trans.objectStore(DB.alarmStore);
    let req = alarmStore.get(busytimeId);

    req.onsuccess = () => {
      res(req.result);
    };
  });
}

function deleteAlarmItemData(item) {
  return new Promise((res, rej) => {
    let trans = indexDbHandle.transaction(DB.alarmStore, 'readwrite');
    let alarmStore = trans.objectStore(DB.alarmStore);

    alarmStore.delete(`${item.uuid}-${item.startDate}`);

    trans.oncomplete = () => {
      res();
    };
  });
}

function updateAlarmItem(item, oldEvent) {
  return new Promise((res, rej) => {
    deleteAlarmItemData(oldEvent).then(() => {
      addItemToAlarmDataBase(item);
    }).then(() => {
      res();
    });
  });
}

/* eslint prefer-promise-reject-errors: "off" */
/* eslint consistent-return: "off" */
function updateEvent(item, db) {
  indexDbHandle = db;

  let updateEventItem = null;
  let oldEvent = null;

  getEventItemById(item.uuid).then((eventItem) => {
    oldEvent = eventItem;
    updateEventItem = getUpdateEventItemNoRepeat(item);
    updateEventItemToStore(updateEventItem);
  }, (err) => {
    return 'update-failed';
  }).then((value) => {
    if ('update-failed' === value) {
      return value;
    }

    deleteBusytimeByEvent(item);
  }).then((value) => {
    if ('update-failed' === value) {
      return value;
    }
    addBusytimeByEventNoRepeat(updateEventItem);
  }, (err) => {
    return 'update-failed';
  /* eslint newline-per-chained-call: "off" */
  }).then((value) => {
    if ('update-failed' === value) {
      return value;
    }
    updateAlarmItem(item, oldEvent);
  }, (err) => {
    return 'update-failed';
  }).then((value) => {
    if ('update-failed' === value) {
      sendMessage({
        msgType: 'update-event-failed'
      });
    } else {
      sendMessage({
        msgType: 'update-event-success'
      });
    }
  }, (err) => {
    sendMessage({
      msgType: 'update-event-failed'
    });
  });
}

/** **********    add alarm item          *********************************** */
function getNextAlarmItem(item, now) {
  let nowDate = new Date(now.valueOf());
  let itemRepeatSDate = new Date(item.repeatSDate.valueOf());

  if (!item.allDayEvent) {
    nowDate = new Date(nowDate.setUTCHours(0, 0, 0, 0));
  }
  itemRepeatSDate = new Date(itemRepeatSDate.setUTCHours(0, 0, 0, 0));
  let offset = nowDate.valueOf() - itemRepeatSDate.valueOf();
  let date = 0;
  let dayMillseconds = 24 * 60 * 60 * 1000;
  let lastDay = new Date(nowDate.getUTCFullYear(), nowDate.getMonth() + 1, 0);

  switch (item.repeat) {
    case 'every day':
      break;
    case 'every week':
      /* eslint no-mixed-operators: "off" */
      date = 7 - (offset / dayMillseconds) % 7;
      nowDate.setDate(nowDate.getDate() + date);
      break;
    case 'every 2 weeks':
      /* eslint no-mixed-operators: "off" */
      date = 14 - (offset / dayMillseconds) % 14;
      nowDate.setDate(nowDate.getDate() + date);
      break;
    case 'every month':
      date = item.repeatSDate.getDate();
      if (date > lastDay.getDate()) {
        nowDate.setMonth(nowDate.getMonth() + 2);
      } else {
        nowDate.setMonth(nowDate.getMonth() + 1);
      }

      nowDate.setDate(date);
      break;
    default:
      break;
  }

  let startDate = new Date(`${formatBusytimeDate(nowDate)} ${item.startTime}`);

  offset = item.busytimeEDate.valueOf() - item.busytimeSDate.valueOf();
  let endDate = new Date(startDate.valueOf() + offset);
  let triggleDate = new Date(startDate.valueOf() +
    parseInt(item.reminder, 10) * 1000);

  if (item.allDayEvent) {
    let allDayEventStartDate = new Date(startDate.valueOf());
    allDayEventStartDate = allDayEventStartDate.setHours(0, 0, 0, 0);
    triggleDate = new Date(allDayEventStartDate.valueOf() +
      parseInt(item.reminder, 10) * 1000);
  }

  let alarmItem = {
    busytimeId: `${item.uuid}-${formatBusytimeDate(startDate)}`,
    eventId: item.uuid,
    title: item.title,
    location: item.location,
    description: item.description,
    allDayEvent: item.allDayEvent,
    startDate: formatBusytimeDate(startDate),
    endDate: formatBusytimeDate(endDate),
    startTime: item.startTime,
    endTime: item.endTime,
    repeat: item.repeat,
    reminder: item.reminder,
    busytimeSDate: startDate,
    busytimeEDate: endDate,
    account: item.account,
    uuid: item.uuid,
    repeatSDate: item.repeatSDate,
    repeatEDate: item.repeatEDate,
    alarm: false,
    triggleDate: triggleDate,
    triggle: triggleDate.valueOf(),
    serverId: item.serverId,
    authenticatorId: item.authenticatorId
  };

  return alarmItem;
}

function createAlarmItem(event) {
  let triggleDate = new Date(event.eventSDate.valueOf() +
    parseInt(event.reminder, 10) * 1000);

  if (event.allDayEvent) {
    let startDate = new Date(event.eventSDate.valueOf());
    startDate = startDate.setHours(0, 0, 0, 0);
    triggleDate = new Date(startDate.valueOf() +
      parseInt(event.reminder, 10) * 1000);
  }

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
    uuid: event.uuid,
    repeatSDate: event.repeatSDate,
    repeatEDate: event.repeatEDate,
    alarm: false,
    triggleDate: triggleDate,
    triggle: triggleDate.valueOf(),
    serverId: event.serverId,
    authenticatorId: event.authenticatorId
  };
}

function createAlarmItemByBusytime(item) {
  let triggleDate = new Date(item.busytimeSDate.valueOf() +
    parseInt(item.reminder, 10) * 1000);

  if (item.allDayEvent) {
    let startDate = new Date(item.busytimeSDate.valueOf());
    startDate = startDate.setHours(0, 0, 0, 0);
    triggleDate = new Date(startDate.valueOf() +
      parseInt(item.reminder, 10) * 1000);
  }

  return {
    busytimeId: item.busytimeId,
    eventId: item.eventId,
    title: item.title,
    location: item.location,
    description: item.description,
    allDayEvent: item.allDayEvent,
    startDate: item.startDate,
    endDate: item.endDate,
    startTime: item.startTime,
    endTime: item.endTime,
    repeat: item.repeat,
    reminder: item.reminder,
    busytimeSDate: item.busytimeSDate,
    busytimeEDate: item.busytimeEDate,
    account: item.account,
    uuid: item.eventId,
    repeatSDate: item.repeatSDate,
    repeatEDate: item.repeatEDate,
    alarm: false,
    triggleDate: triggleDate,
    triggle: triggleDate.valueOf(),
    serverId: item.serverId,
    authenticatorId: item.authenticatorId
  };
}

function addItemToAlarmDataBase(item, db) {
  if (db) {
    indexDbHandle = db;
  }

  return new Promise((res) => {
    if (!item || ('none' === item.reminder)) {
      res();
      return;
    }

    let now = new Date();
    let alarmItem = createAlarmItem(item);
    if (('never' === alarmItem.repeat && now > alarmItem.endDate) ||
      ('never' !== alarmItem.repeat && alarmItem.repeatEDate &&
      now > alarmItem.repeatEDate)) {
      res();
      return;
    /* eslint no-else-return: "off" */
    } else if ('never' !== alarmItem.repeat && now > alarmItem.busytimeEDate) {
      alarmItem = getNextAlarmItem(alarmItem, now);
      if (alarmItem.repeatEDate &&
        alarmItem.busytimeSDate > alarmItem.repeatEDate) {
        res();
        return;
      }
    }

    let trans = indexDbHandle.transaction(DB.alarmStore, 'readwrite');
    let alarmStore = trans.objectStore(DB.alarmStore);

    alarmStore.put(alarmItem);

    trans.oncomplete = () => {
      res();
    };

    trans.onerror = () => {
      res();
    };
  });
}

/** **********    get alarm item          *********************************** */
function updateAlarmFlag(item) {
  return new Promise((res, rej) => {
    let trans = indexDbHandle.transaction(DB.alarmStore, 'readwrite');
    let alarmStore = trans.objectStore(DB.alarmStore);

    item.alarm = true;
    alarmStore.put(item);

    trans.oncomplete = () => {
      res();
    };

    trans.onerror = (err) => {
      rej(err);
    };
  });
}

function getAlarmItem() {
  indexDbHandle = db;
  let alarms = [];
  let promiseList = [];
  let now = new Date();
  let twoDay = 2 * 24 * 60 * 60 * 1000;

  all(DB.alarmStore, (err, allItem) => {
    allItem.sort((a, b) => {
      return a.triggle - b.triggle;
    });

    for (let i = 0; i < allItem.length; i++) {
      if (!allItem[i].alarm &&
        (allItem[i].triggle < now.valueOf() + twoDay)) {
        allItem[i].alarm = true;
        alarms.push(allItem[i]);
        promiseList.push(updateAlarmFlag(allItem[i]));
      }
    }

    if (0 === alarms.length) {
      for (let i = 0; i < allItem.length; i++) {
        if (!allItem[i].alarm) {
          allItem[i].alarm = true;
          alarms.push(allItem[i]);
          promiseList.push(updateAlarmFlag(allItem[i]));
          break;
        }
      }
    }

    if (0 === alarms.length) {
      sendMessage({
        msgType: 'get-alarm-item-success',
        data: null
      });

      return;
    }

    Promise.all(promiseList).then((results) => {
      sendMessage({
        msgType: 'get-alarm-item-success',
        data: alarms
      });
    });
  });
}

/** **********    find and delete alarm  *********************************** */
function addAlarmItem(item) {
  return new Promise((res) => {
    let trans = indexDbHandle.transaction(DB.alarmStore, 'readwrite');
    let alarmStore = trans.objectStore(DB.alarmStore);

    alarmStore.put(item);

    trans.oncomplete = () => {
      res();
    };

    trans.onerror = () => {
      res();
    };
  });
}

function deleteAlarmItem(item) {
  let trans = indexDbHandle.transaction(DB.alarmStore, 'readwrite');
  let alarmStore = trans.objectStore(DB.alarmStore);

  alarmStore.delete(item.busytimeId);

  trans.oncomplete = () => {
    if ('never' !== item.repeat) {
      let nextDay = new Date(item.busytimeSDate.valueOf());
      nextDay = nextDay.setDate(nextDay.getDate() + 1);
      let nextAlarm = this.getNextAlarmItem(item, nextDay);

      if (nextAlarm.repeatEDate &&
        nextAlarm.busytimeSDate > nextAlarm.repeatEDate) {
        sendMessage({
          msgType: 'find-delete-alarm-success'
        });
      } else {
        addAlarmItem(nextAlarm).then(() => {
          sendMessage({
            msgType: 'find-delete-alarm-success'
          });
        });
      }
    } else {
      sendMessage({
        msgType: 'find-delete-alarm-success'
      });
    }
  };
  trans.onerror = () => {
    sendMessage({
      msgType: 'find-delete-alarm-failed'
    });
  };
}

function findDeleteAlarm(item, db) {
  indexDbHandle = db;

  dumpLog(`findDeleteAlarm enter item: ${JSON.stringify(item)}`);
  all(DB.alarmStore, (err, allItem) => {
    let alarmItem = allItem.find((element) => {
      return element.busytimeId === item.busytimeId;
    });

    dumpLog(`findDeleteAlarm  alarmItem: ${JSON.stringify(alarmItem)}`);
    if (alarmItem && JSON.stringify(alarmItem) === JSON.stringify(item)) {
      deleteAlarmItem(alarmItem);
    } else {
      dumpLog('findDeleteAlarm  find-delete-alarm-failed');
      sendMessage({
        msgType: 'find-delete-alarm-failed',
        data: item
      });
    }
  });
}

function deleteAccountEvents(eventIds, db) {
  for (let i = 0; i < eventIds.length; i++) {
    deleteEvent(eventIds[i], db);
  }
}

/** **********     delete alarm           *********************************** */
function removeAlarmByIndex(indexName, indexValue) {
  return new Promise((res, rej) => {
    let trans = indexDbHandle.transaction(DB.alarmStore, 'readwrite');
    let alarmStore = trans.objectStore(DB.alarmStore);

    trans.addEventListener('complete', () => {
      res();
    });

    trans.addEventListener('error', (event) => {
      rej(event);
    });

    let index = trans.objectStore(DB.alarmStore).index(indexName);
    let req = index.openCursor(
      IDBKeyRange.only(indexValue)
    );

    req.onsuccess = (event) => {
      let cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  });
}

/** **********     dumpLog           *********************************** */
function dumpLog(msg, optionalObject) {
  if (debugSwitch) {
    let output = msg;
    if (optionalObject) {
      output += JSON.stringify(optionalObject);
    }
    if (dump) {
      dump(`[calendar]: ${output}\n`);
    } else {
      /* eslint no-console: "off" */
      console.log(`[calendar]: ${output}`);
    }
  }
}

/** **********     get all activesync event           *********************** */
function getAllActivesyncEvent(db) {
  indexDbHandle = db;

  all(DB.eventStore, (err, allItem) => {
    if (err) {
      sendMessage({
        msgType: 'get-all-activesync-event-failed',
        err: err
      });

      return;
    }

    let eventList = [];
    allItem.forEach((item) => {
      if ('activesync' === item.authenticatorId) {
        eventList.push(item);
      }
    });

    sendMessage({
      msgType: 'get-all-activesync-event-success',
      list: eventList
    });
  });
}

/** **********     get all google event           *********************** */
function getAllGoogleEvent(db) {
  indexDbHandle = db;

  all(DB.eventStore, (err, allItem) => {
    if (err) {
      sendMessage({
        msgType: 'get-all-google-event-failed',
        err: err
      });

      return;
    }

    let eventList = [];
    allItem.forEach((item) => {
      if ('google' === item.authenticatorId) {
        eventList.push(item);
      }
    });

    sendMessage({
      msgType: 'get-all-google-event-success',
      list: eventList
    });
  });
}

/** **********     get all caldav event           *********************** */
function getAllCaldavEvent(db) {
  indexDbHandle = db;

  all(DB.eventStore, (err, allItem) => {
    if (err) {
      sendMessage({
        msgType: 'get-all-caldav-event-failed',
        err: err
      });

      return;
    }

    let eventList = [];
    allItem.forEach((item) => {
      if ('caldav' === item.authenticatorId) {
        eventList.push(item);
      }
    });

    sendMessage({
      msgType: 'get-all-caldav-event-success',
      list: eventList
    });
  });
}

/** **********     delete all event           ******************************* */

function deleteAllEvent(eventList, db) {
  indexDbHandle = db;
  let promiseList = [];

  eventList.forEach((item) => {
    promiseList.push(deleteOneEvent(item.uuid));
  });

  Promise.all(promiseList).then((results) => {
    sendMessage({
      msgType: 'delete-all-event-success'
    });
  });
}

function deleteOneEvent(eventId) {
  return new Promise((resolve, reject) => {
    let trans = indexDbHandle.transaction(DB.eventStore, 'readwrite');
    let eventStore = trans.objectStore(DB.eventStore);
    eventStore.delete(eventId);
    trans.oncomplete = () => {
      removeByIndex('eventId', eventId, (err) => {
        if (err) {
          reject('delete-event-failed');
          return;
        }

        /* eslint no-use-before-define: "off" */
        removeAlarmByIndex('eventId', eventId).then(() => {
          resolve('delete-event-success');
        }, (evt) => {
          reject('delete-event-failed');
        });
      });
      // removeBusytime(msg.busytimeItem.eventId);
    };
    trans.onerror = () => {
      reject('delete-event-failed');
    };
  });
}

/** **********     new all event           ******************************* */

function newAllEvent(eventList, db) {
  indexDbHandle = db;
  let promiseList = [];

  eventList.forEach((item) => {
    promiseList.push(newOneEvent(item));
  });

  Promise.all(promiseList).then(() => {
    setTimeout(() => {
      sendMessage({
        msgType: 'new-all-event-success'
      });
    }, 1000);
  });
}

function newOneEvent(item) {
  return new Promise((resolve, reject) => {
    addItemToAlarmDataBase(item, indexDbHandle).then(() => {
      if (item.repeat !== 'never') {
        addOneRepeatEvent(item);
      } else {
        addOneNoRepeatEvent(item);
      }
    }).then(() => {
      resolve();
    });
  });
}

function persistBusytimeByOneEvent(event) {
  return new Promise((resolve) => {
    let busytimeItem = createBusytime(event);
    let trans = indexDbHandle.transaction('Busytimes', 'readwrite');
    let busytimeStore = trans.objectStore('Busytimes');
    busytimeStore.add(busytimeItem);
    trans.oncomplete = () => {
      resolve();
    };
    trans.onerror = () => {
      resolve();
    };
  });
}

function addOneNoRepeatEvent(item) {
  return new Promise((resolve, reject) => {
    getEventItemById(item.uuid).then((eventItem) => {
      if (eventItem) {
        updateOneEvent(item, indexDbHandle);
      } else {
        const trans = indexDbHandle.transaction(DB.eventStore, 'readwrite');
        const store = trans.objectStore(DB.eventStore);
        store.add(item);

        trans.oncomplete = () => {
          persistBusytimeByOneEvent(item);
        };

        trans.onerror = () => {
          resolve();
        };
      }
    }, () => {
      resolve();
    }).then(() => {
      resolve();
    });
  });
}

function addOneRepeatEvent(item) {
  return new Promise((resolve) => {
    const trans = indexDbHandle.transaction(DB.eventStore, 'readwrite');
    const eventStore = trans.objectStore(DB.eventStore);

    eventStore.put(item);

    trans.oncomplete = () => {
      persistBusytimeForOnePepeatEvent(item, item.eventSDate);
    };

    trans.onerror = () => {
      resolve();
    };
  }).then(() => {
    resolve();
  });
}

function persistBusytimeForOnePepeatEvent(item, date) {
  return new Promise((resolve) => {
    let minDate;
    let maxDate;
    let repeatOffset;
    let busytimeQueue = [];
    let num = 0;
    let repeatDate = {
      repeatSDate: new Date(item.eventSDate),
      repeatEDate: item.repeatEDate ? new Date(item.repeatEDate) : null
    };

    minDate = item.eventSDate.valueOf();
    maxDate = getMaxDateValue(date);
    repeatOffset = getRepeatOffset(item.repeat);

    if (item.repeatEDate && item.repeatEDate.valueOf() < maxDate) {
      maxDate = item.repeatEDate.valueOf();
    }

    busytimeQueue.push(expandBusytime(item, 0, repeatDate));
    num++;

    /* eslint no-constant-condition: ["error", { "checkLoops": false }] */
    while (1) {
      let busytimeItem = null;

      if ('every month' === item.repeat) {
        repeatOffset = getMonthRepeatOffset(item, num);
        if (0 !== repeatOffset) {
          busytimeItem = expandBusytime(item, repeatOffset, repeatDate);
        }
      } else {
        busytimeItem = expandBusytime(item, repeatOffset, repeatDate);

        item.eventSDate = new Date(item.eventSDate.valueOf() + repeatOffset);
        item.eventEDate = new Date(item.eventEDate.valueOf() + repeatOffset);
      }

      num++;

      if ((busytimeItem && busytimeItem.busytimeSDate.valueOf() > maxDate) ||
        num > 42) {
        break;
      } else {
        busytimeQueue.push(busytimeItem);
      }
    }

    let trans = indexDbHandle.transaction(DB.busytimeStore, 'readwrite');
    let busytimeStore = trans.objectStore(DB.busytimeStore);

    busytimeQueue.forEach((busytime) => {
      busytimeStore.put(busytime);
    });

    trans.oncomplete = () => {
      resolve();
    };

    trans.onerror = () => {
      resolve();
    };
  });
}

function updateOneEvent(item, db) {
  return new Promise((resolve) => {
    indexDbHandle = db;

    let updateEventItem = null;
    let oldEvent = null;
    getEventItemById(item.uuid).then((eventItem) => {
      oldEvent = eventItem;
      updateEventItem = getUpdateEventItemNoRepeat(item);
      updateEventItemToStore(updateEventItem);
    }, (err) => {
      return 'update-failed';
    }).then((value) => {
      if ('update-failed' === value) {
        return value;
      }

      deleteBusytimeByEvent(item);
    }).then((value) => {
      if ('update-failed' === value) {
        return value;
      }
      addBusytimeByEventNoRepeat(updateEventItem);
    }, (err) => {
      return 'update-failed';
    /* eslint newline-per-chained-call: "off" */
    }).then((value) => {
      if ('update-failed' === value) {
        return value;
      }
      updateAlarmItem(item, oldEvent);
    }, (err) => {
      return 'update-failed';
    }).then((value) => {
      resolve();
    }, (err) => {
      resolve();
    });
  });
}
