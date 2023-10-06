'use strict';
(function(exports) {

  function MapMessage() {
     this.msgManager = window.navigator.mozMobileMessage;
  }

  MapMessage.prototype = {
    messageEventInit: function (adapter) {
      let handler = this.handleEvent.bind(this, adapter);
      this.msgManager.addEventListener('received', handler);
      this.msgManager.addEventListener('deliverysuccess', handler);
      this.msgManager.addEventListener('deliveryerror', handler);
      this.msgManager.addEventListener('retrieving', handler);
      this.msgManager.addEventListener('sent', handler);
      this.msgManager.addEventListener('sending', handler);
      this.msgManager.addEventListener('failed', handler);
      this.msgManager.getMessage(1).then(item => {
        return;
      });
    },

    handleEvent: function (adapter, evt) {
      let evtDetail = {
        detail: {
          type: evt.type,
          message: evt.message
      }};
      let event = new CustomEvent('mapnotifyreq', evtDetail);
      adapter.dispatchEvent(event);
    },

    getAllMessages: function (filter) {
      let promise = [];
      let maxCount = filter.maxListCount;
      let startOffset = filter.listStartOffset;
      let count = 0;
      return new Promise((resolve, reject) => {
        let cursor = this.msgManager.getMessages();
        cursor.onsuccess = function() {
          let result = this.result;
          if (result && count < maxCount + startOffset) {
            if (result.type === filter.type ||
               filter.type === 'no-filtering') {
              if (result.delivery === filter.dir ||
                  filter.type === 'no-filtering') {
                if ((filter.readStatus === 'no-filtering') ||
                    (result.read === true && filter.readStatus === 'read') ||
                    (result.read === false && filter.readStatus === 'unread')) {
                  count++;

                  if(startOffset < count) {
                    let message = result;
                    let tel = message.sender;
                    let contactFilter = {
                      filterBy: ['tel'],
                      filterValue: tel,
                      filterOp: 'equals'
                    };
                    let p = new Promise(resolve => {
                      let req = window.navigator.mozContacts.find(contactFilter);
                      req.onsuccess = function () {
                        message.vCard = req.result;
                        resolve(message);
                      };
                      req.onerror = function () {
                        message.vCard = [];
                        resolve(message);
                      };
                    });
                    promise.push(p);
                  }
                }
              }
            }
          this.continue();
          } else {
            Promise.all(promise).then(messages => {
              resolve(messages);
            });
          }
        };
        cursor.onerror = function(error) {
          reject('Error when get messages');
        };
      });
    },

    getMessage: function (evt) {
      return new Promise((resolve, reject) => {
        let req = this.msgManager.getMessage(evt.name);
        req.onsuccess = function () {
          let message = this.result;
          let tel = message.sender;
          let filter = {
            filterBy: ['tel'],
            filterValue: tel,
            filterOp: 'equals'
          };
          let req = window.navigator.mozContacts.find(filter);
          req.onsuccess = function () {
            if (req.result.length === 0) {
              message.vCard = null;
            } else {
              message.vCard = req.result[0];
            }
            resolve(message);
          };
          req.onerror = function () {
            message.vCard = null;
            resolve(message);
          };
        };
        req.onerror = function () {
          reject();
        };
      });
    },

    setDeletedStatus: function (evt) {
      return new Promise(resolve => {
        let req = this.msgManager.delete(evt.handleId);
        req.onsuccess = function () {
          resolve(this.result);
        };
        req.onerror = function () {
          resolve(false);
        };
      });
    },

    setReadStatus: function (evt) {
      return new Promise((resolve) => {
        let req = this.msgManager.markMessageRead(evt.handleId, evt.statusValue);
        req.onsuccess = function () {
          resolve(this.result);
        };
        req.onerror = function () {
          resolve(false);
        };
      });
    },

    sendMessage: function (evt) {
      return new Promise((resolve, reject) => {
        this.msgManager.onsending = function (sendingEvent) {
          resolve(sendingEvent.message.id);
        };
        this.msgManager.onfailed = function (sendingEvent) {
          reject(sendingEvent.message.id);
        };
        this.msgManager.send(evt.recipient, evt.messageBody);
      });
    },

    getMessagesCount: function (filter) {
      let messagesCount = 0;
      let unreadFlag = false;
      return new Promise((resolve, reject) => {
        let cursor = this.msgManager.getMessages();
        cursor.onsuccess = function() {
          let result = this.result;
          if (result) {
            if (result.type === filter.type ||
              filter.type === 'no-filtering') {
              if (result.delivery === filter.dir ||
                filter.type === 'no-filtering') {
                if ((filter.readStatus === 'no-filtering') ||
                  (result.read === true && filter.readStatus === 'read') ||
                  (result.read === false && filter.readStatus === 'unread')) {
                  messagesCount++;

                  if(!result.read) {
                    unreadFlag = true;
                  }
                }
              }
            }
            this.continue();
          } else {
            resolve({
              size: messagesCount,
              unreadFlag: unreadFlag
            });
          }
        };
        cursor.onerror = function(error) {
          reject('Error when get messages');
        };
      });
    }

  };

  exports.MapMessage = MapMessage;
}(window));
