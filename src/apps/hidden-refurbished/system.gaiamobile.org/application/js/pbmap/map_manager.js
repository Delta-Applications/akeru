'use strict';
/* global PbmapIAC, MapMessage */
(function(exports) {

  let bluetoothManager = navigator.mozBluetooth;
  let adapter = null;
  let deviceName;

  let message;
  let _debug = true;
  let isEventAdded = false;
  const masId = 0;
  const SMS = 'msg';
  const MMS = null;
  const INBOX = 'inbox';
  const OUTBOX = 'outbox';
  const SENT = 'sent';
  const MAXLISTCOUNT = 65535;

  function debug(msg) {
    if (_debug) {
      console.log('[Bluetooth MAP] -- ' + msg);
    }
  }

  function mapInit() {
    debug('mapInit');
    message = new MapMessage();
    if (!adapter) {
      return;
    }
    adapter.addEventListener('mapmessageslistingreq',
      mapMessagesListing.bind(this));
    adapter.addEventListener('mapgetmessagereq',
      mapGetMessage.bind(this));
    adapter.addEventListener('mapsetmessagestatusreq',
      mapSetMessageStatus.bind(this));
    adapter.addEventListener('mapsendmessagereq',
      mapSendMessage.bind(this));
    adapter.addEventListener('mapnotifyreq', mapNotify.bind(null, adapter));
    mapNotifyInit(adapter);
  }

  function init() {
    watchMozBluetoothAttributechanged();
    initDefaultAdapter();

  }

  function mapNotify(adapter, evt) {
    debug('mapNotify');
    let notifyObj = {
      handle: evt.detail.message.id
    };
    switch (evt.detail.type) {
      case 'received':
        notifyObj.type = 'newMessage';
        notifyObj.folder = 'inbox';
        break;
      case 'deliverysuccess':
        notifyObj.type = 'deliverySuccess';
        notifyObj.folder = 'outbox';
        break;
      case 'deliveryerror':
        notifyObj.type = 'deliveryFailure';
        notifyObj.folder = 'outbox';
        break;
      case 'sent':
        notifyObj.type = 'sendingSuccess';
        notifyObj.folder = 'outbox';
        break;
      case 'failed':
        notifyObj.type = 'sendingFailure';
        notifyObj.folder = 'outbox';
        break;
    }
    let eventObj = window.reformatEventObj(notifyObj);
    let blob = new Blob([eventObj], {type: 'text/xml'});
    adapter.sendMessageEvent(masId, blob);
  }

  function mapNotifyInit(adapter) {
    debug('mapNotifyInit');
    message.messageEventInit(adapter);
  }

  function bindMapRq() {
    debug('bindMapRq');
    if (adapter) {
      adapter.addEventListener('mapconnectionreq', getConfirm.bind(this));
    }
  }

  function getConfirm(evt) {
    function callSystemConfirm(text) {
      navigator.mozL10n.formatValue('confirmTitle').then(title => {
        let option = {
          type: PbmapDialog.USER_CONFIRMATION,
          header: title,
          message: text,
          profile: 'MAP'
        };
        PbmapDialog.show(option, (result) => {
          if (result) {
            debug('confirm and event Add is: ' + isEventAdded);
            evt.handle.accept();
            if (!isEventAdded) {
              obexInit();
              mapInit();
              isEventAdded = true;
            }
          } else {
            debug('cancel');
            evt.handle.reject();
          }
        });
      });
    }

    let getNamePromise = new Promise((resolve, reject) => {
      let req = adapter.getPairedDevices();

      req.forEach((item, index, array) => {
        if (item.address === evt.address) {
          if (item.name) {
            resolve(item.name);
          } else {
            // listen for name update.
            item.onattributechanged = function (evt) {
              for (let i in evt.attrs) {
                if (evt.attrs[i] === 'name') {
                  resolve(item.name);
                  // clean event handler
                  item.onattributechanged = null;
                }
              }
            };
            //set a timeout in case the device has no name
            setTimeout(()=> {
              // clean event handler
              item.onattributechanged = null;

              // return address instead
              resolve(evt.address);
            }, 2000);
          }
        } else {
          if (index === (array.length - 1)) {
            resolve(evt.address);
          }
        }
      });
    });

    getNamePromise.then(name => {
      deviceName = name;
      return deviceName;
    }).then(nameText => {
      callSystemConfirm(nameText);
    });
  }

  function enterObexPinCode(evt) {
    debug('enterObexPinCode');
    function callPasswordDialog(text) {
      let responseValues = ['responseTitle', 'initialValue'];
      Promise.all(responseValues.map(key => navigator.mozL10n.formatValue(key)))
      .then(values => {

        let option = {
          type: PbmapDialog.OBEX_PASSWORD,
          header: values[0],
          message: text,
          initialValue: values[1]
        };

        PbmapDialog.show(option, (result) => {
          if (result.value) {
            evt.handle.setPassword(result.password);
          } else {
            evt.handle.reject();
          }
        });
      });
    }

    navigator.mozL10n
      .formatValue('responseMsg', {deviceId: deviceName}).then(responseText => {
      callPasswordDialog(responseText);
    });
  }

  function obexInit () {
    debug('obexInit');
    adapter.addEventListener('obexpasswordreq', enterObexPinCode);
  }

  function mapMessagesListing(evt) {
    let filter = getMsgType(evt.name);
    filter.readStatus = evt.filterReadStatus + '';
    filter.type = evt.filterMessageType + '';
    filter.maxListCount = Number.parseInt(evt.maxListCount);
    filter.listStartOffset = Number.parseInt(evt.listStartOffset);

    debug('mapMessagesListing readStatus -- ' + filter.readStatus);
    debug('mapMessagesListing type -- ' + filter.type);
    debug('mapMessagesListing maxListCount -- ' + filter.maxListCount);
    debug('mapMessagesListing listStartOffset -- ' + filter.listStartOffset);

    if (filter.maxListCount + filter.listStartOffset > MAXLISTCOUNT) {
      console.error('wrong maxListCount and listStartOffset');
    } else {
      if (filter.maxListCount === 0) {
        debug('mapMessagesListing Go maxCount == 0');
        message.getMessagesCount(filter).then((data) => {
          debug('mapMessagesListing message size = ' + data.size);
          let blob = new Blob([], { type: 'text/xml' });
          evt.handle.replyToMessagesListing(masId, blob, data.unreadFlag, getMSTime(), data.size);
          debug('mapMessagesListing reply to Gecko maxCount is 0');
        });
      } else {
        debug('mapMessagesListing Go maxCount != 0');
        message.getAllMessages(filter).then((messages) => {
          debug('mapMessagesListing message length: ' + messages.length);
          return window.reformatXMLMsg(messages);
        }).then((data) => {
          debug('mapMessagesListing data length: ' + data.xml.length);
          debug('mapMessagesListing data size: ' + data.size);
          let blob = new Blob([data.xml], { type: 'text/xml' });
          evt.handle.replyToMessagesListing(masId, blob, data.unreadFlag, getMSTime(), data.size);
          debug('mapMessagesListing reply to Gecko');
        });
      }
    }
  }

  function getMsgType(name) {
    let filter = {};
    if (name.indexOf(SMS) !== -1) {
      filter.type = 'sms';
    } else if (name.indexOf(MMS) !== -1) {
      filter.type = 'mms';
    } else {
      filter.type = 'email';
    }

    if (name.indexOf(INBOX) !== -1) {
      filter.dir = 'received';
    } else if (name.indexOf(OUTBOX) !== -1) {
      filter.dir = 'sending';
    } else if (name.indexOf(SENT) !== -1) {
      filter.dir = 'sent';
    }

    return filter;
  }

  function getMSTime() {
    Date.prototype.hhmmss = function() {
      let hh = this.getHours().toString();
      let mm = this.getMinutes().toString();
      let ss = this.getSeconds().toString();
      return (hh[1]? hh : '0' + hh[0]) + (mm[1]? mm : '0' + mm[0]) + (ss[1]? ss : '0' + ss[0]);
    };
    Date.prototype.YYYYMMDD = function() {
      let YYYY = this.getFullYear().toString();
      let MM = (this.getMonth() + 1).toString();
      let DD  = this.getDate().toString();
      return YYYY + (MM[1]? MM : '0' + MM[0]) + (DD[1]? DD : '0' + DD[0]);
    };
    let date = new Date();
    return date.YYYYMMDD() + 'T' + date.hhmmss();
  }


  function mapGetMessage(evt) {
    debug('event -> mapGetMessage');
    message.getMessage(evt).then(message => {
      return window.reformatBMessage(message);
    }).then(data => {
      let blob = new Blob([data], {type: 'text/xml'});
      evt.handle.replyToGetMessage(masId, blob);
    });
  }

  function mapSetMessageStatus(evt) {
    debug('event -> mapSetMessageStatus');
    if (evt.statusIndicator === 'readstatus') {
      message.setReadStatus(evt).then(result => {
        evt.handle.replyToSetMessageStatus(masId, result);
      });
    } else if (evt.statusIndicator === 'deletedstatus') {
      message.setDeletedStatus(evt).then(result => {
        evt.handle.replyToSetMessageStatus(masId, result);
      });
    }
  }

  function mapSendMessage(evt) {
    debug('event -> mapSendMessage');
    message.sendMessage(evt).then(id => {
      evt.handle.replyToSendMessage(masId, id, true);
    }).catch(id => {
      evt.handle.replyToSendMessage(masId, id, false);
    });
  }

  function watchMozBluetoothAttributechanged() {
    bluetoothManager.addEventListener('attributechanged', (evt) => {
      for (let i in evt.attrs) {
        switch (evt.attrs[i]) {
          case 'defaultAdapter':
            initDefaultAdapter();
            break;
          default:
            break;
        }
      }
    });
  }

  function initDefaultAdapter() {
    debug('initDefaultAdapter');

    adapter = bluetoothManager.defaultAdapter;
    bindMapRq();
    isEventAdded = false;
  }

  init();

})(window);
