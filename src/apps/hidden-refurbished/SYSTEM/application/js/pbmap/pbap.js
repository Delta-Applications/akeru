'use strict';
/*
 * Phone Book Access Profile (PBAP) is a profile that enables devcices to
 * exchange phonebook objects via Bluetooth. After a Bluetooth connection is
 * established, Phone-book objects each represent information about a contact
 * stored on a mobile phone. This PBAP server module will handle all PBAP
 * request from the client to response the phonebook records or list, and all
 * three kinds of request from the client are:
 * - pullphonebook - pull all phonebook records based on the constraint of the
 *   filter object.
 * - pullvcardentry - pull a specific contacts.
 * - pullvcardlisting - pull a XML format list of all contacts which filtered by
 *   a filter argument.
 */

/* global PbmapIAC,ContactToVcardBlob, LazyLoader, PbapPhonebook */

(function(exports) {
  let bluetoothManager = navigator.mozBluetooth;
  let adapter = null;
  let pb;
  let pairedName;
  let _debug = true;

  function init() {
    watchMozBluetoothAttributechanged();
    initDefaultAdapter();
  }

  function bindPbapRq() {
    if (adapter) {
      adapter.onpbapconnectionreq = getConfirm.bind(this);
    }
  }


  function pbapInit() {
    pb = new PbapPhonebook();
    if (!adapter) {
      return;
    }

    adapter.onobexpasswordreq = obexPassword.bind(this);
    adapter.onpullphonebookreq = pullPhonebook.bind(this);
    adapter.onpullvcardentryreq = pullVcardEntry.bind(this);
    adapter.onpullvcardlistingreq = pullVcardListing.bind(this);

  }


  function obexPassword(evt) {
    function passwordDialog(text) {
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
      .formatValue('responseMsg', {deviceId: pairedName}).then(text => {
      passwordDialog(text);
    });
  }


  function getConfirm(evt) {
    debug('confirm pbap event');
    function callSystemConfirm(text) {
      navigator.mozL10n.formatValue('confirmTitle').then(title => {
        let option = {
          type: PbmapDialog.USER_CONFIRMATION,
          header: title,
          message: text,
          profile: 'PBAP'
        };

        PbmapDialog.show(option, (result) => {
          if (result) {
            debug('confirm');
            evt.handle.accept();
            pbapInit();
          } else {
            debug('cancel');
            evt.handle.reject();
          }
        });
      });
    }

    let getNamePromise = new Promise((resolve, reject) => {
      let req = adapter.getPairedDevices();
      debug('Paired device lenght: ' + req.length);

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
            // return address instead
            resolve(evt.address);
          }
        }
      });
      if(req.length === 0) {
        reject();
      }
    });

    getNamePromise.then(name => {
      pairedName = name;
      return pairedName;
    }).then(nameText => {
      callSystemConfirm(nameText);
    });
  }


  function pullPhonebook(evt) {
    debug('pull phonebook event');
    pb.pullPhoneBook(evt).then((contacts) => {
      if (evt.maxListCount === 0) {
        let vcardBlob = new Blob([], { type : 'text/x-vcard' });
        evt.handle.replyToPhonebookPulling(vcardBlob, contacts.length);
      } else {
        if (contacts.length === 0) {
          let vcardBlob = new Blob([], { type : 'text/x-vcard' });
          evt.handle.replyToPhonebookPulling(vcardBlob, contacts.length);
        } else {
          debug('reply phonebook to Gecko size: ' + contacts.length);
          ContactToVcardBlob(contacts, function blobReady(vcardBlob) {
              evt.handle.replyToPhonebookPulling(vcardBlob, contacts.length);
            },
            {
              // Some MMS gateways prefer this MIME type for vcards
              type: 'text/x-vcard'
            }
          );
        }
      }
    });
  }

  function pullVcardEntry(evt) {
    debug('pull Vcard entry event');
    pb.pullVcardEntry(evt).then((contacts) => {
      if (contacts.length === 0) {
        let vcardBlob = new Blob([], { type: 'text/x-vcard' });
        evt.handle.replyToPhonebookPulling(vcardBlob, contacts.length);
      } else {
        ContactToVcardBlob(contacts, function blobReady(vcardBlob) {
          evt.handle.replyTovCardPulling(vcardBlob, contacts.length);
        }, {
          // Some MMS gateways prefer this MIME type for vcards
          type: 'text/x-vcard'
        });
      }
    });
  }

  function pullVcardListing(evt) {
    debug('pull vcard listing event');
    pb.pullVcardListing(evt).then((content) => {
      let blob;
      if (evt.maxListCount === 0) {
        blob = new Blob([], { type: 'text/xml' });
      } else {
        blob = new Blob([content.xml], {
          type: 'text/xml'
        });
      }

      evt.handle.replyTovCardListing(blob, content.size);
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
    if (adapter) {
      adapter.onpbapconnectionreq = null;
      adapter.onobexpasswordreq = null;
      adapter.onpullphonebookreq = null;
      adapter.onpullvcardentryreq = null;
      adapter.onpullvcardlistingreq = null;
    }
    adapter = bluetoothManager.defaultAdapter;
    bindPbapRq();
  }

  function debug(msg) {
    if (_debug) {
      console.log('[Bluetooth PBAP] -- ' + msg);
    }
  }

  init();
})(window);
