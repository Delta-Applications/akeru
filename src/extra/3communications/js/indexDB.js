/**
 * @file Operate indexDB
 * ------------------------------------
 *  @class DB
 *    @method openDB
 *    @method saveData
 *    @method getAllData
 *    @method deleteData
 *    @method searchData
 * ------------------------------------
 */

class DB {
  constructor() {
    this.DBName = 'calllog';
    this.sheetName = 'calllog_store';
    this.db = null;
    this.limitNum = 100;

    // build item
    this.getLogItemMainKey = item => {
      const id = `${item.groupKey}-${item.number}-${item.callType}-${item.serviceId}`;
      return id.replace(/\//g, '');
    };

    this.rebuildLogItem = item => {
      const newItem = { ...item };
      newItem.date = item.date || Date.now() - parseInt(item.duration, 10);

      /*
        get log type:
          - missed outgoing incoming
          - lte wifi
          - video rtt
      */
      newItem.callType = this.getCallType(item);

      newItem.groupKey = new Intl.DateTimeFormat('en-US').format(item.date);
      newItem.id = this.getLogItemMainKey(newItem);
      return newItem;
    };

    this.getCallType = item => {
      let directionStr = 'outgoing';
      let radioTechStr = '';
      if (item.radioTech === 'ps') {
        radioTechStr = '_lte';
      } else if (item.radioTech === 'wifi') {
        radioTechStr = '_wifi';
      }
      if (item.direction === 'incoming') {
        if (item.duration > 0) {
          directionStr = 'incoming';
        } else {
          directionStr = 'missed';
          if (item.isRtt) {
            return directionStr + radioTechStr;
          }
        }
      }
      const videoCallStr = item.isVt ? '_videoCall' : '';
      const rttCallStr = item.isRtt ? '_rttCall' : '';
      return directionStr + videoCallStr + rttCallStr + radioTechStr;
    };
  }

  openDB = () => {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve('DB open success!');
        return;
      }

      const req = indexedDB.open(this.DBName);

      req.onsuccess = ev => {
        console.log('DB open success!', ev.result);
        this.db = req.result;
        resolve('DB open success!');
      };

      req.onerror = error => {
        console.log('DB open failed!', error);
        reject('');
      };

      req.onblocked = () => {
        reject('');
        console.log(
          'DB is useing by other tab website, please close all and try again!'
        );
      };

      req.onupgradeneeded = event => {
        console.log('Start rebuild DB success!');
        const db = event.target.result;
        const dbStore = db.createObjectStore(this.sheetName, { keyPath: 'id' });
        dbStore.createIndex('date', 'date');

        dbStore.transaction.oncomplete = () => {
          console.log('Build DB success!');
        };
      };
    });
  };

  saveLog = item => {
    return new Promise((resolve, reject) => {
      const newItem = this.rebuildLogItem(item);
      let saveItem = null;

      /**
       * @param { object } newItem tel num infor:
       *  {
       *    @param { Array } calls, - calls time infor
       *    @param { Number } serviceId, - sim num
       *    @param { String } number，- tel number
       *    emergency，
       *    duration,
       *    @param { String } direction, - call in/out/miss
       *    hangUpLocal,
       *    isVt,
       *    radioTech,
       *    isRtt,
       *    @param { String } date, - call time
       *    @param { String } callType, - call in/out/miss
       *    @param { Number } simNum, - sim num
       *    @param { String } groupKey, - call day
       *    @param { String } id - timeDay + num + direction + sim num
       *  }
       */

      this.searchData(newItem.id).then(logItem => {
        if (logItem) {
          // existed log, update log info
          logItem.calls = logItem.calls || [
            {
              date: logItem.date,
              duration: logItem.duration
            }
          ];

          logItem.calls.unshift({
            date: newItem.date,
            duration: newItem.duration
          });

          logItem.date = newItem.date;
          if (item.direction === 'incoming') {
            logItem.verStatus = newItem.verStatus;
          }
          saveItem = logItem;
        } else {
          // no existed log, save new log info
          saveItem = newItem;
        }

        this.addData(saveItem)
          .then(() => {
            resolve(saveItem);
          })
          .catch(() => {
            reject();
          });
      });
    });
  };

  addData = item =>
    new Promise((resolve, reject) => {
      const dataStore = this.db
        .transaction(this.sheetName, 'readwrite')
        .objectStore(this.sheetName);
      const addReq = dataStore.put(item);

      addReq.onsuccess = () => {
        console.log('Update data success!');
        resolve();

        this.clearExceedLimitItem();
      };

      addReq.onerror = () => {
        console.log('Update data failed!');
        reject();
      };
    });

  clearExceedLimitItem = () => {
    this.limitNum = window.MAX_LIST_LENGTH;
    const dataStore = this.db
      .transaction(this.sheetName, 'readonly')
      .objectStore(this.sheetName);
    const getCountReq = dataStore.count();
    getCountReq.onsuccess = () => {
      const records = getCountReq.result;
      if (records > this.limitNum) {

        const needDeleteTimes = records - this.limitNum;

        for (let i = 0; i < needDeleteTimes; i++) {

          // Delete the oldest record
          const getCursorReq = dataStore.index('date').openCursor();
          getCursorReq.onsuccess = res => {
            const MainKey = res.target.result.value.id;
            this.deleteData([MainKey]);
          }
        }
      }
    }
  };

  getAllData = () =>
    new Promise((resolve, reject) => {
      this.openDB().then(() => {
        const dataStore = this.db
          .transaction(this.sheetName)
          .objectStore(this.sheetName);

        const operateReq = dataStore.getAll();

        operateReq.onsuccess = ev => {
          resolve(ev.target.result);

          this.clearExceedLimitItem();
        };

        operateReq.onerror = () => {
          reject(null);
        };
      });
    });

  deleteData = items =>
    new Promise((resolve, reject) => {
      this.openDB().then(() => {
        const dataStore = this.db
          .transaction(this.sheetName, 'readwrite')
          .objectStore(this.sheetName);

        if (items === 'all') {
          dataStore.clear();
          resolve();
        } else {
          items.forEach(item => {
            const deleteReq = dataStore.delete(item);

            deleteReq.onsuccess = () => {
              resolve();
            }
          });
        }
      });
    })

  searchData = mainKey =>
    new Promise((resolve, reject) => {
      this.openDB().then(() => {
        const dataStore = this.db
          .transaction(this.sheetName)
          .objectStore(this.sheetName);
        const searchReq = dataStore.get(mainKey);

        searchReq.onsuccess = () => {
          console.log('Search data success!', searchReq.result);
          resolve(searchReq.result);
        };

        searchReq.onerror = error => {
          console.log('Search data failed!', error);
          reject(null);
        };
      });
    });
}
