/* exported FxAccountsIACHelper */

// Firefox Accounts IAC client

var FxAccountsIACHelper = function FxAccountsIACHelper() {

  var DEFAULT_CONNECTION_STRING = 'fxa-mgmt';
  var default_rules = {
    'manifestURLs': ['app://system.gaiamobile.org/manifest.webapp']
  };

  var CONNECTION_STRING = DEFAULT_CONNECTION_STRING;
  var rules = default_rules;
  var port;
  var forgetPasswordUrl;

  // callbacks is a set of arrays containing {successCb, errorCb} pairs,
  // keyed on the method name, for example, callbacks.getAccounts.
  var callbacks = {};
  var eventListeners = {};

  navigator.mozSettings.createLock().get('identity.fxaccounts.reset-password.url').then((data) => {
    forgetPasswordUrl = data['identity.fxaccounts.reset-password.url'];
  });

  // Overrides the default configuration, if needed
  var init = function init(options) {
    if (!options) {
      return;
    }

    if (options.keyword &&
      typeof(options.keyword) == 'string' &&
      options.keyword.length > 0) {
      CONNECTION_STRING = options.keyword;
    }

    if (options.rules && typeof(options.rules) == 'object') {
      rules = options.rules;
    }
  };

  var addEventListener = function addEventListener(eventName, listener) {
    if (!eventListeners[eventName]) {
      eventListeners[eventName] = [];
    }
    eventListeners[eventName].push(listener);
  };

  var createAccount = function createAccount(successCb, errorCb) {
    sendMessage({
      'name': 'createAccount'
    }, successCb, errorCb);
  };

  var removeEventListener = function removeEventListener(eventName, listener) {
    var listeners = eventListeners[eventName];
    if (!listeners) {
      return;
    }

    var index = listeners.indexOf(listener);
    if (index === -1) {
      return;
    }
    listeners.splice(index, 1);
  };

  // Reset to default values, could clean any future option
  var reset = function reset() {
    CONNECTION_STRING = DEFAULT_CONNECTION_STRING;
    rules = default_rules;
    eventListeners = {};
    callbacks = {};
    port = null;
  };

  var onMessage = function onMessage(evt) {
    if (evt && evt.data) {
      var message = evt.data;

      if (message.eventName) {
        var listeners = eventListeners[message.eventName];
        if (!listeners) {
          return;
        }
        for (var listener in listeners) {
          if (listeners[listener] &&
            typeof listeners[listener] === 'function') {
            listeners[listener]();
          }
        }
        return;
      }

      var cbs, cb;
      if (message.methodName) {
        cbs = callbacks[message.methodName];
        if (!cbs || !cbs.length) {
          console.warn('No callbacks for method ' + message.methodName);
          return;
        }

        while (cbs.length) {
          cb = cbs.shift();
          if (!message.error) {
            cb.successCb(message.data);
          } else {
            cb.errorCb(message.error);
          }
        }
      }
    } else {
      console.error('Unknown');
    }
  };

  // Get a reference to the application object to be able to invoke IAC.
  var getSelf = function getSelf(cb, error) {
    var request = navigator.mozApps.getSelf();
    request.onsuccess = function onSuccess(evt) {
      cb(evt.target.result);
    };

    request.onerror = function onError() {
      if (error && typeof(error) === 'function') {
        error();
      }
    };
  };

  var requestQueue = [];
  var isConnecting = false;
  var connect = function connect(cb) {
    if (isConnecting) {
      return requestQueue.push(cb);
    }
    isConnecting = true;
    _connect(function onConnect(err) {
      var next;
      isConnecting = false;
      if (typeof cb === 'function') {
        cb(err);
      }
      while (next = requestQueue.shift()) {
        next && next(err);
      }
    });
  };

  var _connect = function _connect(callback) {
    getSelf(function onApp(app) {
      if (!app) {
        return;
      }
      app.connect(CONNECTION_STRING, rules).then(function(ports) {
        if (!ports || ports.length !== 1) {
          return;
        }

        port = ports[0];
        callback && callback();
      });
    });
  };

  var sendMessage = function sendMessage(message, successCb, errorCb) {
    if (port) {
      // bug1890 removed these codes to avoid port overrided by other app
    }

    connect(function() {
      _sendMessage(message, successCb, errorCb);
    });
  };

  // Sends the specific message via IAC to the system app.
  // Will be always using the default keyword and forcing it
  // to a single manifest.
  var _sendMessage = function _sendMessage(message, successCb, errorCb) {
    var name = message.name;
    if (!name) {
      return;
    }

    if (!callbacks[name]) {
      callbacks[name] = [];
    }
    callbacks[name].push({
      successCb: successCb,
      errorCb: errorCb
    });
    // We set onmessage here again cause it is the only way that we have to
    // trigger it during the tests. It sucks but it is harmless.
    port.onmessage = onMessage;
    port.postMessage(message);
  };

  var getAccounts = function getAccounts(successCb, errorCb, forceFetch) {
    sendMessage({
      'name': 'getAccounts',
      refresh: forceFetch,
    }, successCb, errorCb);
  };

  var verifyPassword = function verifyPassword(password, successCb, errorCb) {
    sendMessage({
      'name': 'verifyPassword',
      'password': password,
    }, successCb, errorCb);
  };

  var openFlow = function openFlow(successCb, errorCb) {
    sendMessage({
      'name': 'openFlow'
    }, function(result) {
      if (result && result.forgetPassword) {
        window.open(forgetPasswordUrl, '', 'dialog');
      }
      if (result && result.success) {
        navigator.mozSettings.createLock().set({
          'antitheft.enabled': true
        });
      }
      successCb(result);
    }, errorCb);
  };

  var logout = function logout(successCb, errorCb) {
    sendMessage({
      'name': 'logout'
    }, successCb, errorCb);
  };

  var refreshAuthentication = function refreshAuthentication(email,
    successCb,
    errorCb) {
    sendMessage({
      'name': 'refreshAuthentication',
      'email': email
    }, successCb, errorCb);
  };

  var requestEmailVerification = function requestEmailVerification(email,
    uid,
    successCb,
    errorCb) {
    sendMessage({
      'name': 'requestEmailVerification',
      'email': email,
      'uid': uid
    }, successCb, errorCb);
  };

  var signIn = function signIn(email, password, successCb, errorCb) {
    sendMessage({
      'name': 'signIn',
      'email': email,
      'password': password,
    }, function(result) {
      if (result && result.forgetPassword) {
        window.open(forgetPasswordUrl, '', 'dialog');
      }
      successCb(result);
    }, errorCb);
  };

  var signOut = function signOut(accountInfo, successCb, errorCb) {
    sendMessage({
      'name': 'signOut',
      'accountInfo': accountInfo
    }, function(result) {
      if (result && result.forgetPassword) {
        window.open(forgetPasswordUrl, '', 'dialog');
      }
      successCb(result);
    }, errorCb);
  };

  var checkPassword = function checkPassword(accountInfo, type, successCb, errorCb) {
    sendMessage({
      'name': 'checkPassword',
      'accountInfo': accountInfo,
      'type': type,
    }, function(result) {
      if (result && result.forgetPassword) {
        window.open(forgetPasswordUrl, '', 'dialog');
      }
      successCb(result);
    }, errorCb);
  };

  var changePassword = function changePassword(successCb, errorCb) {
    sendMessage({
      'name': 'changePassword'
    }, function(result) {
      if (result && result.forgetPassword) {
        window.open(forgetPasswordUrl, '', 'dialog');
      }
      successCb(result);
    }, errorCb);
  };

  var phoneNumberLogin = function phoneNumberLogin(successCb, errorCb) {
    sendMessage({
      'name': 'phoneNumberLogin'
    }, successCb, errorCb);
  };

  var verifyAltPhone = function verifyAltPhone(altPhone,
    uid,
    verificationId, successCb, errorCb) {
    sendMessage({
      'name': 'verifyAltPhone',
      'altPhone': altPhone,
      'uid': uid,
      'verificationId': verificationId,
    }, function(result) {
      successCb(result);
    }, errorCb);
  };

  var requestPhoneVerification = function requestPhoneVerification(phone,
    uid,
    successCb, errorCb) {
    sendMessage({
      'name': 'requestPhoneVerification',
      'phone': phone,
      'uid': uid,
    }, function(result) {
      successCb(result);
    }, errorCb);
  };

  var editPersonalInfo = function editPersonalInfo(accountInfo, successCb, errorCb) {
    sendMessage({
      'name': 'editPersonalInfo',
      'accountInfo': accountInfo,
    }, successCb, errorCb);
  };

  // We do an early connection to be able to get the unsolicited events coming
  // from the platform (onlogin, onverifiedlogin, onlogout).
  connect();

  return {
    'addEventListener': addEventListener,
    'createAccount': createAccount,
    'getAccounts': getAccounts,
    'verifyPassword': verifyPassword,
    'init': init,
    'logout': logout,
    'openFlow': openFlow,
    'refreshAuthentication': refreshAuthentication,
    'removeEventListener': removeEventListener,
    'requestEmailVerification': requestEmailVerification,
    'reset': reset,
    'signIn': signIn,
    'signOut': signOut,
    'checkPassword': checkPassword,
    'changePassword': changePassword,
    'phoneNumberLogin': phoneNumberLogin,
    'verifyAltPhone': verifyAltPhone,
    'requestPhoneVerification': requestPhoneVerification,
    'editPersonalInfo': editPersonalInfo
  };

}();
