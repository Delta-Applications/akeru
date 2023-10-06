/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function (root, factory) {
  if (typeof exports === 'object')
    module.exports = factory(require('wbxml'), require('activesync/codepages'));
  else if (typeof define === 'function' && define.amd)
    define(['wbxml', 'activesync/codepages'], factory);
  else
    root.ActiveSyncProtocol = factory(WBXML, ActiveSyncCodepages);
}(this, function(WBXML, ASCP) {
  

  var exports = {};
  var USER_AGENT = 'KaiOS ActiveSync Client';

  function nullCallback() {}

  /**
   * Create a constructor for a custom error type that works like a built-in
   * Error.
   *
   * @param name the string name of the error
   * @param parent (optional) a parent class for the error, defaults to Error
   * @param extraArgs an array of extra arguments that can be passed to the
   *        constructor of this error type
   * @return the constructor for this error
   */
  function makeError(name, parent, extraArgs) {
    function CustomError() {
      // Try to let users call this as CustomError(...) without the "new". This
      // is imperfect, and if you call this function directly and give it a
      // |this| that's a CustomError, things will break. Don't do it!
      var self = this instanceof CustomError ?
                 this : Object.create(CustomError.prototype);
      var tmp = Error();
      var offset = 1;

      self.stack = tmp.stack.substring(tmp.stack.indexOf('\n') + 1);
      self.message = arguments[0] || tmp.message;
      if (extraArgs) {
        offset += extraArgs.length;
        for (var i = 0; i < extraArgs.length; i++)
          self[extraArgs[i]] = arguments[i+1];
      }

      var m = /@(.+):(.+)/.exec(self.stack);
      self.fileName = arguments[offset] || (m && m[1]) || "";
      self.lineNumber = arguments[offset + 1] || (m && m[2]) || 0;

      return self;
    }
    CustomError.prototype = Object.create((parent || Error).prototype);
    CustomError.prototype.name = name;
    CustomError.prototype.constructor = CustomError;

    return CustomError;
  }

  var AutodiscoverError = makeError('ActiveSync.AutodiscoverError');
  exports.AutodiscoverError = AutodiscoverError;

  var AutodiscoverDomainError = makeError('ActiveSync.AutodiscoverDomainError',
                                          AutodiscoverError);
  exports.AutodiscoverDomainError = AutodiscoverDomainError;

  var HttpError = makeError('ActiveSync.HttpError', null, ['status']);
  exports.HttpError = HttpError;

  function nsResolver(prefix) {
    var baseUrl = 'http://schemas.microsoft.com/exchange/autodiscover/';
    var ns = {
      rq: baseUrl + 'mobilesync/requestschema/2006',
      ad: baseUrl + 'responseschema/2006',
      ms: baseUrl + 'mobilesync/responseschema/2006'
    };
    return ns[prefix] || null;
  }

  function Version(str) {
    var details = str.split('.').map(function(x) {
      return parseInt(x);
    });
    this.major = details[0], this.minor = details[1];
  }
  exports.Version = Version;
  Version.prototype = {
    eq: function(other) {
      if (!(other instanceof Version))
        other = new Version(other);
      return this.major === other.major && this.minor === other.minor;
    },
    ne: function(other) {
      return !this.eq(other);
    },
    gt: function(other) {
      if (!(other instanceof Version))
        other = new Version(other);
      return this.major > other.major ||
             (this.major === other.major && this.minor > other.minor);
    },
    gte: function(other) {
      if (!(other instanceof Version))
        other = new Version(other);
      return this.major >= other.major ||
             (this.major === other.major && this.minor >= other.minor);
    },
    lt: function(other) {
      return !this.gte(other);
    },
    lte: function(other) {
      return !this.gt(other);
    },
    toString: function() {
      return this.major + '.' + this.minor;
    },
  };

  /**
   * Set the Authorization header on an XMLHttpRequest.
   *
   * @param xhr the XMLHttpRequest
   * @param username the username
   * @param password the user's password
   */
  function setAuthHeader(xhr, username, password) {
    var authorization = 'Basic ' + btoa(username + ':' + password);
    xhr.setRequestHeader('Authorization', authorization);
  }

  /**
   * Perform autodiscovery for the server associated with this account.
   *
   * @param aEmailAddress the user's email address
   * @param aPassword the user's password
   * @param aTimeout a timeout (in milliseconds) for the request
   * @param aCallback a callback taking an error status (if any) and the
   *        server's configuration
   * @param aNoRedirect true if autodiscovery should *not* follow any
   *        specified redirects (typically used when autodiscover has already
   *        told us about a redirect)
   */
  function autodiscover(aEmailAddress, aPassword, aTimeout, aCallback,
                        aNoRedirect) {
    if (!aCallback) aCallback = nullCallback;
    var domain = aEmailAddress.substring(aEmailAddress.indexOf('@') + 1);

    // The first time we try autodiscovery, we should try to recover from
    // AutodiscoverDomainErrors and HttpErrors. The second time, *all* errors
    // should be reported to the callback.
    do_autodiscover('autodiscover.' + domain, aEmailAddress, aPassword,
        aTimeout, aNoRedirect, function(aError, aConfig) {
      if (aError instanceof AutodiscoverDomainError ||
          aError instanceof HttpError)
        do_autodiscover(domain, aEmailAddress, aPassword, aTimeout,
            aNoRedirect, aCallback);
      else
        aCallback(aError, aConfig);
    });
  }
  exports.autodiscover = autodiscover;

  /**
   * Perform the actual autodiscovery process for a given URL.
   *
   * @param aHost the host name to attempt autodiscovery for
   * @param aEmailAddress the user's email address
   * @param aPassword the user's password
   * @param aTimeout a timeout (in milliseconds) for the request
   * @param aNoRedirect true if autodiscovery should *not* follow any
   *        specified redirects (typically used when autodiscover has already
   *        told us about a redirect)
   * @param aCallback a callback taking an error status (if any) and the
   *        server's configuration
   */
  function do_autodiscover(aHost, aEmailAddress, aPassword, aTimeout,
                           aNoRedirect, aCallback) {
    var url = 'https://' + aHost + '/autodiscover/autodiscover.xml';
    return raw_autodiscover(url, aEmailAddress, aPassword, aTimeout,
                            aNoRedirect, aCallback);
  }

  function raw_autodiscover(aUrl, aEmailAddress, aPassword, aTimeout,
                            aNoRedirect, aCallback) {
    var xhr = new XMLHttpRequest({mozSystem: true, mozAnon: true});
    xhr.open('POST', aUrl, true);
    setAuthHeader(xhr, aEmailAddress, aPassword);
    xhr.setRequestHeader('Content-Type', 'text/xml');
    xhr.setRequestHeader('User-Agent', USER_AGENT);
    xhr.timeout = aTimeout;

    xhr.upload.onprogress = xhr.upload.onload = function() {
      xhr.timeout = 0;
    };

    xhr.onload = function() {
      if (xhr.status < 200 || xhr.status >= 300)
        return aCallback(new HttpError(xhr.statusText, xhr.status));

      var uid = Math.random();
      self.postMessage({
        uid: uid,
        type: 'configparser',
        cmd: 'accountactivesync',
        args: [xhr.responseText, aNoRedirect]
      });

      self.addEventListener('message', function onworkerresponse(evt) {
        var data = evt.data;
        if (data.type !== 'configparser' || data.cmd !== 'accountactivesync' ||
            data.uid !== uid) {
          return;
        }
        self.removeEventListener(evt.type, onworkerresponse);

        var args = data.args;
        var config = args[0], error = args[1], redirectedEmail = args[2];
        if (error) {
          aCallback(new AutodiscoverDomainError(error), config);
        } else if (redirectedEmail) {
          autodiscover(redirectedEmail, aPassword, aTimeout, aCallback, true);
        } else {
          aCallback(null, config);
        }
      });
    };

    xhr.ontimeout = xhr.onerror = function() {
      // Something bad happened in the network layer, so treat this like an HTTP
      // error.
      aCallback(new HttpError('Error getting Autodiscover URL', null));
    };

    // TODO: use something like
    // http://ejohn.org/blog/javascript-micro-templating/ here?
    var postdata =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<Autodiscover xmlns="' + nsResolver('rq') + '">\n' +
    '  <Request>\n' +
    '    <EMailAddress>' + aEmailAddress + '</EMailAddress>\n' +
    '    <AcceptableResponseSchema>' + nsResolver('ms') +
         '</AcceptableResponseSchema>\n' +
    '  </Request>\n' +
    '</Autodiscover>';

    xhr.send(postdata);
  }
  exports.raw_autodiscover = raw_autodiscover;

  /**
   * Create a new ActiveSync connection.
   *
   * ActiveSync connections use XMLHttpRequests to communicate with the
   * server. These XHRs are created with mozSystem: true and mozAnon: true to,
   * respectively, help with CORS, and to ignore the authentication cache. The
   * latter is important because 1) it prevents the HTTP auth dialog from
   * appearing if the user's credentials are wrong and 2) it allows us to
   * connect to the same server as multiple users.
   *
   * @param aDeviceId (optional) a string identifying this device
   * @param aPolicyKey(optional) a string with a maximum of 64 characters, it
   *        is used by the server to mark the state of policy settings on the
   *        client in the settings
   download phase of the Provision command.
   * @param aEmailAddress (optional) the user's email address
   * @param aDeviceType (optional) a string identifying the type of this device
   */
  function Connection(aDeviceId, aPolicyKey, aEmailAddress, aDeviceType) {
    this._deviceId = aDeviceId || 'v140Device';
    this._deviceType = aDeviceType || 'KaiOS';
    this.timeout = 0;

    this._connected = false;
    this._waitingForConnection = false;
    this._connectionError = null;
    this._connectionCallbacks = [];

    this.baseUrl = null;
    this._username = null;
    this._password = null;
    this._emailaddress = aEmailAddress || '';

    this.versions = [];
    this.supportedCommands = [];
    this.currentVersion = null;
    this.policyKey = aPolicyKey || 0;

    /**
     * Debug support function that is called every time an XHR call completes.
     * This is intended to be used for logging.
     *
     * The arguments to the function are:
     *
     * - type: 'options' if caused by a call to getOptions.  'post' if caused by
     *   a call to postCommand/postData.
     *
     * - special: 'timeout' if a timeout error occurred, 'redirect' if the
     *   status code was 451 and the call is being reissued, 'error' if some
     *   type of error occurred, or 'ok' on success.  Check xhr.status for the
     *   specific http status code.
     *
     * - xhr: The XMLHttpRequest used.  Use this to check the statusCode,
     *   statusText, or response headers.
     *
     * - params: The object dictionary of parameters encoded into the URL.
     *   Always present if type is 'post', not present for 'options'.
     *
     * - extraHeaders: Optional dictionary of extra request headers that were
     *   provided.  These will not include the always-present request headers of
     *   MS-ASProtocolVersion and Content-Type.
     *
     * - sent data: If type is 'post', the ArrayBuffer provided to xhr.send().
     *
     * - response: In the case of a successful 'post', the WBXML Reader instance
     *   that will be passed to the callback for the method.  If you use the
     *   reader, you are responsible for calling rewind() on it.
     */
    this.onmessage = null;
  }
  exports.Connection = Connection;
  Connection.prototype = {
    /**
     * Perform any callbacks added during the connection process.
     *
     * @param aError the error status (if any)
     */
    _notifyConnected: function(aError) {
      if (aError)
        this.disconnect();

      for (var iter in Iterator(this._connectionCallbacks)) {
        var callback = iter[1];
        callback.apply(callback, arguments);
      }
      this._connectionCallbacks = [];
    },

    /**
     * Get the connection status.
     *
     * @return true if we are fully connected to the server
     */
    get connected() {
      return this._connected;
    },

    /*
     * Initialize the connection with a server and account credentials.
     *
     * @param aURL the ActiveSync URL to connect to
     * @param aUsername the account's username
     * @param aPassword the account's password
     */
    open: function(aURL, aUsername, aPassword) {
      // XXX: We add the default service path to the URL if it's not already
      // there. This is a hack to work around the failings of Hotmail (and
      // possibly other servers), which doesn't provide the service path in its
      // URL. If it turns out this causes issues with other domains, remove it.
      var servicePath = '/Microsoft-Server-ActiveSync';
      this.baseUrl = aURL;
      if (!this.baseUrl.endsWith(servicePath))
        this.baseUrl += servicePath;

      this._username = aUsername;
      this._password = aPassword;
    },

    /**
     * Connect to the server with this account by getting the OPTIONS and
     * policy from the server (and verifying the account's credentials).
     *
     * @param aCallback a callback taking an error status (if any) and the
     *        server's options.
     */
    connect: function(aCallback) {
      // If we're already connected, just run the callback and return.
      if (this.connected) {
        if (aCallback)
          aCallback(null);
        return;
      }

      // Otherwise, queue this callback up to fire when we do connect.
      if (aCallback)
        this._connectionCallbacks.push(aCallback);

      // Don't do anything else if we're already trying to connect.
      if (this._waitingForConnection)
        return;

      this._waitingForConnection = true;
      this._connectionError = null;

      this.getOptions((aError, aOptions) => {
        this._waitingForConnection = false;
        this._connectionError = aError;

        if (aError) {
          console.error('Error connecting to ActiveSync:', aError);
          return this._notifyConnected(aError, aOptions);
        }

        this._connected = true;
        this.versions = aOptions.versions;
        this.supportedCommands = aOptions.commands;
        this.currentVersion = new Version(aOptions.versions.slice(-1)[0]);

        this.getUserInfo((address) => {
          // Return 401 error if user input mail address inconsistent with
          // the info get from the server.
          if (address && this._emailaddress.length &&
              address.toLowerCase() !== this._emailaddress.toLowerCase()) {
            return this._notifyConnected(
                new HttpError('Mail address inconsistent', 401), aOptions);
          }
          this.enforcement((aError, aResponse) => {
            let errorStr = 'Error get Security Policy for ActiveSync: ';
            let doGetPolicy = false;
            if (aError) {
              console.error(errorStr, aError);
              if (aError.status === 449) {
                doGetPolicy = true;
              } else {
                return this._notifyConnected(aError, aOptions);
              }
            }

            let e = new WBXML.EventParser();
            let fh = ASCP.FolderHierarchy.Tags;
            let ace = ASCP.Common.Enums;
            let afe = ASCP.FolderHierarchy.Enums;

            e.addEventListener([fh.FolderSync, fh.Status], (node) => {
              let status = node.children[0].textContent;

              // Common status 142 Supported by: 14.0, 14.1, 16.0, 16.1
              // When protocol version 2.5, 12.0, or 12.1 is used,
              // an HTTP 449 response is returned instead of this status value.
              if (status === afe.Status.Success) {
                return this._notifyConnected(null, aOptions);
              } else if (status === ace.Status.DeviceNotProvisioned ||
                         status === ace.Status.PolicyRefresh ||
                         status === ace.Status.InvalidPolicyKey ||
                         doGetPolicy) {
                this.getPolicyKey(false, (aError) => {
                  if (aError) {
                    console.error(errorStr, aError);
                    return this._notifyConnected(aError, aOptions);
                  }

                  this.getPolicyKey(true, (error) => {
                    if (error) {
                      console.error(errorStr, error);
                      return this._notifyConnected(error, aOptions);
                    }

                    return this._notifyConnected(null, aOptions);
                  });
                });
              } else if (status === ace.Status.RemoteWipeRequested) {
                this.deviceWipe((aError) => {
                  if (aError) {
                    console.error(errorStr, aError);
                    return this._notifyConnected(aError, aOptions);
                  } else {
                    return this._notifyConnected(null, aOptions);
                  }
                });
              } else {
                aError = 'enforcement error, status: ' + status;
                console.error(errorStr, aError);
                return this._notifyConnected(aError, aOptions);
              }
            });

            try {
              if (!aResponse) {
                console.log('response error');
                return this._notifyConnected('response error', aOptions);
              } else {
                e.run(aResponse);
              }
            }
            catch (ex) {
              console.error(errorStr, ex);
            }
          });
        });
      });
    },

    /**
     * Disconnect from the ActiveSync server, and reset the connection state.
     * The server and credentials remain set however, so you can safely call
     * connect() again immediately after.
     */
    disconnect: function() {
      if (this._waitingForConnection)
        throw new Error("Can't disconnect while waiting for server response");

      this._connected = false;
      this.versions = [];
      this.supportedCommands = [];
      this.currentVersion = null;
    },

    getUserInfo: function(callback) {
      if (!this._emailaddress.length) {
        return callback();
      }

      let st = ASCP.Settings.Tags;
      let w = new WBXML.Writer('1.3', 1, 'UTF-8');
      w.stag(st.Settings)
        .stag(st.UserInformation)
          .tag(st.Get)
        .etag()
      .etag();

      this.postCommand(w, (aError, aResponse) => {
        let e = new WBXML.EventParser();
        if (aError) {
          return callback();
        }

        e.addEventListener([st.Settings, st.Status], (node) => {
          let status = node.children[0].textContent;
          if (status !== '1') {
            const error = 'Get user info error, error status: ' + status;
            console.error(error);
            callback();
          }
        });

        e.addEventListener([st.Settings, st.UserInformation, st.Get],
          (node) => {
            let value = '';

            let aNode = node;
            while(aNode && aNode.children[0]) {
              let tagName = aNode .children[0].tagName;

              /**
               *  Protocol version 14.1, 16.0,  16.1 is supported
               *  [Settings, UserInformation, Get, Accounts, Account, EmailAddresses, PrimarySmtpAddress]
               *  Protocol version 12.0, 12.1,  14.0 is supported  [Settings,
               *  UserInformation, Get, EmailAddresses, SmtpAddress ].
               * 163 does not follow this standard.
                */
              switch(tagName) {
                case 'Settings:EmailAddresses':
                case 'Settings:Accounts':
                case 'Settings:Account':
                  aNode = aNode.children[0];
                  break;
                case 'Settings:SmtpAddress':
                case 'Settings:PrimarySmtpAddress':
                  value = aNode.children[0].children[0].textContent;
                  aNode = null;
                  break;
                default:
                  aNode = null;
              }
            }
            callback(value);
        });

        try {
          e.run(aResponse);
        }
        catch (ex) {
          callback();
        }
      });
    },

    /**
     * Get the device Info to download Policy from Server.
     * @param aCallback a callback an error status (if any) and
     *        the device info.
     */
    getDeviceInfo: function(aCallback) {
      var uid = Math.random();
      self.postMessage({
        uid: uid,
        type: 'deviceInfo',
        cmd: 'get'
      });

      self.addEventListener('message', function onworkerresponse(evt) {
        var data = evt.data;
        if (data.type != 'deviceInfo' || data.cmd != 'get' ||
            data.uid != uid) {
          return;
        }
        self.removeEventListener(evt.type, onworkerresponse);

        var args = data.args;
        var data = args[0], error = args[1];
        if (error) {
          aCallback(null, error);
        } else {
          aCallback(data);
        }
      });
    },

    /**
     * Attempt to provision this account, we use this to Downloads Policy
     * from Server.
     * @param doFinal determine whether to get "final" PolicyKey
     * @param aCallback a callback taking an error status (if any) and the
     *        WBXML response
     */
    provision: function(doFinal, aCallback) {
      var pv = ASCP.Provision.Tags;
      var st = ASCP.Settings.Tags;
      var w = new WBXML.Writer('1.3', 1, 'UTF-8');
      w.stag(pv.Provision);
      var bSetDeviceInfo = !doFinal && this.currentVersion.gte('12.0');
      if (bSetDeviceInfo) {
        this.getDeviceInfo((function(deviceInfo, error) {
          if (error) {
            aCallback(error);
          }
          w.stag(st.DeviceInformation)
            .stag(st.Set)
              .tag(st.FriendlyName, deviceInfo.deviceName)
              .tag(st.Model, deviceInfo.modelName)
              .tag(st.IMEI, deviceInfo.imei)
              .tag(st.OS, deviceInfo.OSName)
              .tag(st.OSLanguage, deviceInfo.OSLanguage);
          if (deviceInfo.phoneNumber.length > 0) {
             w.tag(st.PhoneNumber, deviceInfo.phoneNumber);
          }
          if (this.currentVersion.gte('14.0')) {
             w.tag(st.MobileOperator, deviceInfo.operatorName);
          }
            w.etag()
          .etag();

          w.stag(pv.Policies)
            .stag(pv.Policy)
              .tag(pv.PolicyType, 'MS-EAS-Provisioning-WBXML');

              w.etag()
            .etag()
          .etag();
          this.postCommand(w, aCallback);
        }).bind(this));
      } else {
        w.stag(pv.Policies)
          .stag(pv.Policy)
            .tag(pv.PolicyType, 'MS-EAS-Provisioning-WBXML');

        if (doFinal) {
           w.tag(pv.PolicyKey, this.policyKey)
            .tag(pv.Status, 1);
        }

            w.etag()
          .etag()
        .etag();
        this.postCommand(w, aCallback);
      }
    },

    /**
     * Downloading the Current Server Security Policy
     * Phase 1: Enforcement
     * the client tries the FolderSync command, which is denied by the server
     * because the server has determined that the client does not have the
     * current policy (as denoted by the X-MS-PolicyKey header). The server
     * returns HTTP 200 (ok) with a global status code in the body of the
     * response of 142.
     * @param aCallback a callback taking an error status (if any) and the
     *        WBXML response
     */
    enforcement: function(aCallback) {
      var fh = ASCP.FolderHierarchy.Tags;
      var w = new WBXML.Writer('1.3', 1, 'UTF-8');
      w.stag(fh.FolderSync)
          .tag(fh.SyncKey, '0')
        .etag();
      this.postCommand(w, aCallback);
    },

    /**
     * Downloading the Current Server Security Policy
     * Phase 2: Client Downloads Policy from Server
     * Phase 3: Client Acknowledges Receipt and Application of Policy Settings
     * @param bFinal determine whether to get "final" PolicyKey
     * @param aCallback a callback taking an error status (if any)， If get
     *        policyKey callback null.
     */
    getPolicyKey: function(bFinal, aCallback) {
      this.provision(bFinal, (function(aError, aResponse) {
        if (aError) {
          aCallback(aError);
        }

        var e = new WBXML.EventParser();
        var pv = ASCP.Provision.Tags;
        var base = [pv.Provision, pv.Policies, pv.Policy];

        e.addEventListener(base.concat(pv.PolicyKey), (function(node) {
          this.policyKey = node.children[0].textContent;
          aCallback(null);
        }).bind(this));

        if (!bFinal) {
          e.addEventListener(base.concat([pv.Data, pv.EASProvisionDoc]),
              (function(node) {
            this.securitySettings(pv, node);
          }).bind(this));
        }

        try {
          e.run(aResponse);
        }
        catch (ex) {
          aCallback(ex);
        }
      }).bind(this));
    },

    // Todo:
    /*
     * Parse security policy data and
     * @param pv exchange provision tags
     * @param node WEBXML node contains security policy data
     */
    securitySettings: function(pv, node) {
      for (var iter in Iterator(node.children)) {
        var child = iter[1];
        var childText =
            child.children.length ? child.children[0].textContent : null;
        switch (child.tag) {
          case pv.DevicePasswordEnabled:
            break;
          case pv.AlphanumericDevicePasswordRequired:
            break;
          case pv.PasswordRecoveryEnabled:
            break;
          case pv.RequireStorageCardEncryption:
            break;
          case pv.AttachmentsEnabled:
            break;
          case pv.MinDevicePasswordLength:
            break;
          case pv.MaxInactivityTimeDeviceLock:
            break;
          case pv.MaxAttachmentSize:
            break;
          case pv.MaxDevicePasswordFailedAttempts:
            break;
          case pv.AllowSimpleDevicePassword:
            break;
          case pv.DevicePasswordExpiration:
            break;
          case pv.DevicePasswordHistory:
            break;
        }
      }
    },

    wipeCommand: function(pv, bWipe, callback) {
      var w = new WBXML.Writer('1.3', 1, 'UTF-8');
      w.stag(pv.Provision);
      if (bWipe) {
        w.stag(pv.RemoteWipe)
            .tag(pv.Status, 1)
            .etag();
      }
      w.etag();

      this.postCommand(w, function(aError, aResponse) {
        var e = new WBXML.EventParser();
        if (aError) {
          callback(aError);
        }

        e.addEventListener([pv.Provision, pv.Status], function(node) {
          var status = node.children[0].textContent;
          // Success
          if (status === '1') {
            callback(null);
          } else {
            var error = 'Remote wipe error, error status: ' + status;
            console.error(error);
            callback(error);
          }
        });

        try {
          e.run(aResponse);
        }
        catch (ex) {
          callback(ex);
        }
      });
    },

    deviceWipe: function(callback) {
      var pv = ASCP.Provision.Tags;
      this.wipeCommand(pv, false, (function(aError) {
        if (aError) {
          callback(aError);
          return;
        }
        this.wipeCommand(pv, true, function(aError) {
          if (aError) {
            callback(aError);
            return;
          } else {
            callback(null);
            // do factory reset
            var uid = Math.random();
            self.postMessage({
              uid: uid,
              type: 'deviceInfo',
              cmd: 'reset'
            });
          }
        });
      }).bind(this));
    },

    /**
     * Get the options for the server associated with this account.
     *
     * @param aCallback a callback taking an error status (if any), and the
     *        resulting options.
     */
    getOptions: function(aCallback) {
      if (!aCallback) aCallback = nullCallback;

      var conn = this;
      var xhr = new XMLHttpRequest({mozSystem: true, mozAnon: true});
      xhr.open('OPTIONS', this.baseUrl, true);
      setAuthHeader(xhr, this._username, this._password);
      xhr.setRequestHeader('User-Agent', USER_AGENT);
      xhr.timeout = this.timeout;

      xhr.upload.onprogress = xhr.upload.onload = function() {
        xhr.timeout = 0;
      };

      xhr.onload = function() {
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error('ActiveSync options request failed with response ' +
                        xhr.status);
          if (conn.onmessage)
            conn.onmessage('options', 'error', xhr, null, null, null, null);
          aCallback(new HttpError(xhr.statusText, xhr.status));
          return;
        }

        // These headers are comma-separated lists. Sometimes, people like to
        // put spaces after the commas, so make sure we trim whitespace too.
        var result = {
          versions: xhr.getResponseHeader('MS-ASProtocolVersions')
                       .split(/\s*,\s*/),
          commands: xhr.getResponseHeader('MS-ASProtocolCommands')
                       .split(/\s*,\s*/)
        };

        if (conn.onmessage)
          conn.onmessage('options', 'ok', xhr, null, null, null, result);
        aCallback(null, result);
      };

      xhr.ontimeout = xhr.onerror = function() {
        var error = new Error('Error getting OPTIONS URL');
        console.error(error);
        if (conn.onmessage)
          conn.onmessage('options', 'timeout', xhr, null, null, null, null);
        aCallback(error);
      };

      // Set the response type to "text" so that we don't try to parse an empty
      // body as XML.
      xhr.responseType = 'text';
      xhr.send();
    },

    /**
     * Check if the server supports a particular command. Requires that we be
     * connected to the server already.
     *
     * @param aCommand a string/tag representing the command type
     * @return true iff the command is supported
     */
    supportsCommand: function(aCommand) {
      if (!this.connected)
        throw new Error('Connection required to get command');

      if (typeof aCommand === 'number')
        aCommand = ASCP.__tagnames__[aCommand];
      return this.supportedCommands.indexOf(aCommand) !== -1;
    },

    /**
     * DEPRECATED. See postCommand() below.
     */
    doCommand: function() {
      console.warn('doCommand is deprecated. Use postCommand instead.');
      this.postCommand.apply(this, arguments);
    },

    /**
     * Send a WBXML command to the ActiveSync server and listen for the
     * response.
     *
     * @param aCommand {WBXML.Writer|String|Number}
     *   The WBXML representing the command or a string/tag representing the
     *   command type for empty commands
     * @param aCallback a callback to call when the server has responded; takes
     *        two arguments: an error status (if any) and the response as a
     *        WBXML reader. If the server returned an empty response, the
     *        response argument is null.
     * @param aExtraParams (optional) an object containing any extra URL
     *        parameters that should be added to the end of the request URL
     * @param aExtraHeaders (optional) an object containing any extra HTTP
     *        headers to send in the request
     * @param aProgressCallback (optional) a callback to invoke with progress
     *        information, when available. Two arguments are provided: the
     *        number of bytes received so far, and the total number of bytes
     *        expected (when known, 0 if unknown).
     */
    postCommand: function(aCommand, aCallback, aExtraParams, aExtraHeaders,
                          aProgressCallback) {
      var contentType = 'application/vnd.ms-sync.wbxml';

      if (typeof aCommand === 'string' || typeof aCommand === 'number') {
        this.postData(aCommand, contentType, null, aCallback, aExtraParams,
                      aExtraHeaders);
      }
      // WBXML.Writer
      else {
        var commandName = ASCP.__tagnames__[aCommand.rootTag];
        this.postData(
          commandName, contentType,
          aCommand.dataType === 'blob' ? aCommand.blob : aCommand.buffer,
          aCallback, aExtraParams, aExtraHeaders, aProgressCallback);
      }
    },

    /**
     * Send arbitrary data to the ActiveSync server and listen for the response.
     *
     * @param aCommand a string (or WBXML tag) representing the command type
     * @param aContentType the content type of the post data
     * @param aData {ArrayBuffer|Blob} the data to be posted
     * @param aCallback a callback to call when the server has responded; takes
     *        two arguments: an error status (if any) and the response as a
     *        WBXML reader. If the server returned an empty response, the
     *        response argument is null.
     * @param aExtraParams (optional) an object containing any extra URL
     *        parameters that should be added to the end of the request URL
     * @param aExtraHeaders (optional) an object containing any extra HTTP
     *        headers to send in the request
     * @param aProgressCallback (optional) a callback to invoke with progress
     *        information, when available. Two arguments are provided: the
     *        number of bytes received so far, and the total number of bytes
     *        expected (when known, 0 if unknown).
     */
    postData: function(aCommand, aContentType, aData, aCallback, aExtraParams,
                       aExtraHeaders, aProgressCallback) {
      // Make sure our command name is a string.
      if (typeof aCommand === 'number')
        aCommand = ASCP.__tagnames__[aCommand];

      if (!this.supportsCommand(aCommand)) {
        var error = new Error("This server doesn't support the command " +
                              aCommand);
        console.error(error);
        aCallback(error);
        return;
      }

      // Build the URL parameters.
      var params = [
        ['Cmd', aCommand],
        ['User', this._username],
        ['DeviceId', this._deviceId],
        ['DeviceType', this._deviceType]
      ];
      if (aExtraParams) {
        for (var iter in Iterator(params)) {
          var param = iter[1];
          if (param[0] in aExtraParams)
            throw new TypeError('reserved URL parameter found');
        }
        for (var kv in Iterator(aExtraParams))
          params.push(kv);
      }
      var paramsStr = params.map(function(i) {
        return encodeURIComponent(i[0]) + '=' + encodeURIComponent(i[1]);
      }).join('&');

      // Now it's time to make our request!
      var xhr = new XMLHttpRequest({mozSystem: true, mozAnon: true});
      xhr.open('POST', this.baseUrl + '?' + paramsStr, true);
      setAuthHeader(xhr, this._username, this._password);
      xhr.setRequestHeader('MS-ASProtocolVersion', this.currentVersion);
      xhr.setRequestHeader('Content-Type', aContentType);
      xhr.setRequestHeader('User-Agent', USER_AGENT);
      xhr.setRequestHeader('X-MS-PolicyKey', this.policyKey);

      // Add extra headers if we have any.
      if (aExtraHeaders) {
        for (var iter in Iterator(aExtraHeaders)) {
          var key = iter[0], value = iter[1];
          xhr.setRequestHeader(key, value);
        }
      }

      xhr.timeout = this.timeout;

      xhr.upload.onprogress = xhr.upload.onload = function() {
        xhr.timeout = 0;
      };
      xhr.onprogress = function(event) {
        if (aProgressCallback)
          aProgressCallback(event.loaded, event.total);
      };

      var conn = this;
      var parentArgs = arguments;
      xhr.onload = function() {
        // This status code is a proprietary Microsoft extension used to
        // indicate a redirect, not to be confused with the draft-standard
        // "Unavailable For Legal Reasons" status. More info available here:
        // <http://msdn.microsoft.com/en-us/library/gg651019.aspx>
        if (xhr.status === 451) {
          conn.baseUrl = xhr.getResponseHeader('X-MS-Location');
          if (conn.onmessage)
            conn.onmessage(aCommand, 'redirect', xhr, params, aExtraHeaders,
                           aData, null);
          conn.postData.apply(conn, parentArgs);
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          console.error('ActiveSync command ' + aCommand + ' failed with ' +
                        'response ' + xhr.status);
          if (conn.onmessage)
            conn.onmessage(aCommand, 'error', xhr, params, aExtraHeaders,
                           aData, null);
          aCallback(new HttpError(xhr.statusText, xhr.status));
          return;
        }

        var response = null;
        if (xhr.response.byteLength > 0)
          response = new WBXML.Reader(new Uint8Array(xhr.response), ASCP);
        if (conn.onmessage)
          conn.onmessage(aCommand, 'ok', xhr, params, aExtraHeaders,
                         aData, response);
        aCallback(null, response);
      };

      xhr.ontimeout = xhr.onerror = function(evt) {
        var error = new Error('Command URL ' + evt.type + ' for command ' +
                              aCommand + ' at baseUrl ' + this.baseUrl);
        console.error(error);
        if (conn.onmessage)
          conn.onmessage(aCommand, evt.type, xhr, params, aExtraHeaders,
                         aData, null);
        aCallback(error);
      }.bind(this);

      xhr.responseType = 'arraybuffer';
      xhr.send(aData);
    }
  };

  return exports;
}));
