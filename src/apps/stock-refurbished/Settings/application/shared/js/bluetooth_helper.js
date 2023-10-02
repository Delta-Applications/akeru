/* exported BluetoothHelper */



var BluetoothHelper = function() {
  var profiles = {
    'HFP': 0x111E,
    'A2DP': 0x110D
  };

  var _bluetooth = window.navigator.mozBluetooth;
  var _isReady = false;
  var _callbacks = [];

  var _adapter = null;
  var _oldAdapter = null; // The varaible is accessed for v1 only.
  var _v2 = true;

  var _ready = function(callback) {
    if (!callback || !_bluetooth) {
      return;
    }

    if (_isReady) {
      callback();
    } else {
      _callbacks.push(callback);
    }
  };

  var _handleRequest = function(request, callback, errorcb) {
    request.onsuccess = function() {
      if (callback) {
        callback(request.result);
      }
    };

    request.onerror = function() {
      console.log('Error handling bluetooth request');
      if (errorcb) {
        errorcb();
      }
    };
  };

  // run callbacks when adapter is ready
  var _processCallbacks = function() {
    if (_adapter) {
      _isReady = true;

      _callbacks.forEach(function(callback) {
        callback();
      });
      // clean up the _callback queue
      _callbacks = [];
    } else {
      // We can do nothing without default adapter.
      console.log('BluetoothHelper(): connot get default adapter yet');
    }
  };

  // API v2 get adapter via bluetooth
  var _fetchAdapterV2 = function() {
    // need time to get bluetooth adapter at first run
    _bluetooth.onattributechanged = function onManagerAttributeChanged(evt) {
      for (var i in evt.attrs) {
        switch (evt.attrs[i]) {
          case 'defaultAdapter':
            console.log('defaultAdapter changed. address:',
              _bluetooth.defaultAdapter.address);
            _adapter = _bluetooth.defaultAdapter;
            _processCallbacks();
            break;
          default:
            break;
        }
      }
    };

    _adapter = _bluetooth.defaultAdapter;
    if (_adapter) {
      _processCallbacks();
    }
  };

  // API v1 get adapter via bluetooth
  var _fetchAdapter = function() {
    var req = _bluetooth.getDefaultAdapter();
    if (req) {
      req.onsuccess = function() {
        if (_adapter) {
          _oldAdapter = _adapter;
        }

        _isReady = true;
        _adapter = req.result;

        // Put the callback function of onpairedstatuschanged to the new adapter
        // because the new adapter won't remember those callback function which
        // is registered before. In other word, we get a new adpater after
        // turned on/off Bluetooth. The new adapter have no registered callback.
        if (_oldAdapter && _oldAdapter.onpairedstatuschanged) {
          _adapter.onpairedstatuschanged = _oldAdapter.onpairedstatuschanged;
        }

        _callbacks.forEach(function(callback) {
          callback();
        });
        // clean up the _callback queue
        _callbacks = [];
      };

      req.onerror = function() {
        // We can do nothing without default adapter.
        console.log('BluetoothHelper(): connot get default adapter!!!');
      };
    }
  };

  var _getAdapter = function() {
    if (_v2) {
      _fetchAdapterV2();
    } else {
      _fetchAdapter();
    }
  };

  var _resetAdapter = function() {
    if (_adapter) {
      _oldAdapter = _adapter;
    }
    // clean up state and adapter
    _isReady = false;
    _adapter = null;
  };

  // Decode the URL scheme prefix of Eddystone-URL
  var _decodeUrlSchemePrefix = function(code) {
    switch (code) { // the encoded URL scheme prefix
      case 0: return 'http://www.';
      case 1: return 'https://www.';
      case 2: return 'http://';
      case 3: return 'https://';
    }
    return '';
  }

  // Decode the URL of Eddystone-URL
  var _decodeEddystoneUrl = function(code) {
    switch (code) { // encoded Eddystone-URL
      case 0:  return '.com/';
      case 1:  return '.org/';
      case 2:  return '.edu/';
      case 3:  return '.net/';
      case 4:  return '.info/';
      case 5:  return '.biz/';
      case 6:  return '.gov/';
      case 7:  return '.com';
      case 8:  return '.org';
      case 9:  return '.edu';
      case 10: return '.net';
      case 11: return '.info';
      case 12: return '.biz';
      case 13: return '.gov';
    }
    return String.fromCharCode(code);
  }

  // Calculate the estimated distance in meters to the BLE beacon based on RSSI
  // and TX Power
  var _calcDistance = function(rssi, txPower) {
    // 41dBm is the signal loss that occurs over 1 meter
    const signalLoss = 41;

    // the proper coefficients for distance estimatation may vary for different
    // hardwares.  We set fixed coefficients here only for generic estimatation.
    const coefficient1 = 0.42093;
    const coefficient2 = 6.9476;
    const coefficient3 = 0.54992;

    let ratio = rssi * 1.0 / (txPower - signalLoss);
    if (ratio < 1.0) {
        return Math.pow(ratio, 10);
    } else {
        return coefficient1 * Math.pow(ratio, coefficient2) + coefficient3;
    }
  }

  // Find the index of the AD structure of Eddystone
  var _findEddystoneUrl = function(adData) {
    const boundary = 31 - 3; // packageLen(31) - typeLen(1) - uuidLen(2)
    let offset = 0;
    while (offset < boundary) {
      let len = adData[offset];
      if (len === 0) {
        console.log('length of AD structure should not be 0.');
        return null;
      }
      let i = offset;
      let adType = adData[++i];
      if (adType === 22) { // Service Data: 0x16
        // the service data type should be Eddystone's UUID 0xFEAA
        if (adData[++i] !== 170 || adData[++i] !== 254) {
          return null;
        }

        // the frame type of Eddystone-URL should be 0x10
        if (adData[++i] !== 16) {
          return null;
        }
        return offset;
      }
      offset += len;
    }
    return null;
  }

  // Parse LE scan result and return a object {url: xxx, distance: xxx}
  var _parseEddystoneUrl = function(scanRecord, rssi) {
    if (!(scanRecord instanceof ArrayBuffer)) {
      return null;
    }
    var uint8Array = new Uint8Array(scanRecord);

    let pos = _findEddystoneUrl(uint8Array);
    if (pos === null) {
      return null;
    }

    let dataLen   = uint8Array[pos];
    let txPower   = uint8Array[pos + 5];
    let urlScheme = uint8Array[pos + 6];

    let signedTxPower = txPower << 24 >> 24;
    let dist = _calcDistance(rssi, signedTxPower);

    // |Length|,|Data Type|,|16bits-UUID|,|Frame Type|,|TX Power|,|URL Scheme|
    //  1 byte    1 byte       2 bytes      1 byte       1 byte      1 byte
    const metaLen = 7;
    uint8Array = uint8Array.slice(pos + metaLen, pos + dataLen + 1);

    let eddystoneUrl = _decodeUrlSchemePrefix(urlScheme);
    uint8Array.forEach(function(element) {
      eddystoneUrl += _decodeEddystoneUrl(element);
    });

    return {
      url:      eddystoneUrl,
      distance: dist
    };
  }

  // init
  if (_bluetooth) {
    // detect API version
    if (typeof(_bluetooth.onattributechanged) === 'undefined') {
      _v2 = false;
    }

    if (_v2) {
      _bluetooth.onadapteradded = function onAdapterAdded(evt) {
        _getAdapter();
      };
    } else {
      _bluetooth.addEventListener('enabled', _getAdapter);
      _bluetooth.addEventListener('adapteradded', _getAdapter);
      _bluetooth.addEventListener('disabled', _resetAdapter);
    }
    _getAdapter();
  }

  return {
    profiles: profiles,

    answerWaitingCall: function() {
      _ready(function() {
        _adapter.answerWaitingCall();
      });
    },

    ignoreWaitingCall: function() {
      _ready(function() {
        _adapter.ignoreWaitingCall();
      });
    },

    toggleCalls: function() {
      _ready(function() {
        _adapter.toggleCalls();
      });
    },

    getConnectedDevicesByProfile: function(profileID, cb, errorcb) {
      _ready(function() {
        _handleRequest(_adapter.getConnectedDevices(profileID), cb, errorcb);
      });
    },

    connectSco: function(cb) {
      _ready(function() {
        _handleRequest(_adapter.connectSco(), cb);
      });
    },

    disconnectSco: function(cb) {
      _ready(function() {
        _handleRequest(_adapter.disconnectSco(), cb);
      });
    },

    getPairedDevices: function(cb) {
      _ready(function() {
        _handleRequest(_adapter.getPairedDevices(), cb);
      });
    },

    getAddress: function(cb) {
      if (_v2) {
        console.log('getAddress function is deprecated');
        return;
      }

      _ready(function() {
        var address = _adapter.address;
        cb(address);
      });
    },

    setPairingConfirmation: function(address, confirmed) {
      if (_v2) {
        console.log('setPairingConfirmation API is deprecated');
        return;
      }

      _ready(function() {
        _adapter.setPairingConfirmation(address, confirmed);
      });
    },

    setPinCode: function(address, pincode) {
      if (_v2) {
        console.log('setPairingConfirmation API is deprecated');
        return;
      }

      _ready(function() {
        _adapter.setPinCode(address, pincode);
      });
    },

    setPasskey: function(address, key) {
      if (_v2) {
        console.log('setPairingConfirmation API is deprecated');
        return;
      }

      _ready(function() {
        _adapter.setPasskey(address, key);
      });
    },

    isScoConnected: function(cb, errorcb) {
      _ready(function() {
        _handleRequest(_adapter.isScoConnected(), cb, errorcb);
      });
    },

    sendMediaMetaData: function(metadata, cb, errorcb) {
      _ready(function() {
        _handleRequest(_adapter.sendMediaMetaData(metadata), cb, errorcb);
      });
    },

    sendMediaPlayStatus: function(metadata, cb, errorcb) {
      _ready(function() {
        _handleRequest(_adapter.sendMediaPlayStatus(metadata), cb, errorcb);
      });
    },

    set onhfpstatuschanged(callback) {
      _ready(function() {
        _adapter.onhfpstatuschanged = callback;
      });
    },

    set onscostatuschanged(callback) {
      _ready(function() {
        _adapter.onscostatuschanged = callback;
      });
    },

    set ona2dpstatuschanged(callback) {
      _ready(function() {
        _adapter.ona2dpstatuschanged = callback;
      });
    },

    set onrequestmediaplaystatus(callback) {
      _ready(function() {
        _adapter.onrequestmediaplaystatus = callback;
      });
    },

    set onpairedstatuschanged(callback) {
      if (_v2) {
        console.log('onpairedstatuschanged API is deprecated');
        return;
      }

      _ready(function() {
        _adapter.onpairedstatuschanged = callback;
      });
    },

    v2: _v2, // expose API version for app reference

    // bypass the enable/disable state if works in APIv1
    enable: function() {
      if (_v2) {
        _ready(function() {
          _adapter.enable();
        });
      } else {
        console.log('enable is not support in v1 API!');
      }
    },

    disable: function() {
      if (_v2) {
        _ready(function() {
          _adapter.disable();
        });
      } else {
        console.log('disable is not support in v1 API!');
      }
    },

    // Parse LE scan result and return a object {url: xxx, distance: xxx}
    parseEddystoneUrl: function(scanRecord, rssi) {
      if (_v2) {
        return _parseEddystoneUrl(scanRecord, rssi);
      } else {
        console.log('parseEddystoneUrl is not support in v1 API!');
      }
    }
  };
};
