'use strict';
/**
 * Bluetooth2 is compatible with Bluetooth APIv2 and used to enable/
 * disable bluetooth hardware, get bluetooth adapter, and check target
 * bluetooth profile is connected.
 *
 * Bluetooth api v2 is the two level structure.
 * We use _btManagerHandler to handle BluetoothManager defaultAdapter
 * change event and _btAdapterHandler to handle status change event.
 *
 * Current supported Bluetooth profiles are:
 * - hfp: Hands-Free Profile
 * - opp: Object Push Profile
 * - a2dp: Advenced Audio Distribution Profile
 * - sco: Synchronous Connection-Oriented Profile
 */
/* global Service, LazyLoader, BluetoothIcon, BluetoothTransferIcon,
   BluetoothHeadphoneIcon, BluetoothTransfer */
/* exported Bluetooth2 */
(function(exports) {
var Bluetooth = function() {};

Bluetooth.prototype = {
  name: 'Bluetooth',

  /**
   * Debug message.
   *
   * @public
   * @type {Boolean} turn on/off the console log
   */
  onDebug: false,

  /**
   * Store a reference of the default adapter.
   * If the adapter is not availble, no bluetooth operation could be
   * executed.
   *
   * @private
   */
  _adapter: null,

  /**
   * Hold instance of bluetooth adapter state change handler.
   *
   * @private
   */
  _bindBtAdapterHandler: null,

  /**
   * Hold instance of HFP status changed handler.
   *
   * @private
   */
  _bindHfpStatusChangedHandler: null,

  /**
   * Hold instance of A2DP status changed handler.
   *
   * @private
   */
  _bindA2dpStatusChangedHandler: null,

  /**
   * Hold instance of SCO status changed handler.
   *
   * @private
   */
  _bindScoStatusChangedHandler: null,

  /**
   * Store a reference for mozBluetooth.
   *
   * @private
   */
  _bluetooth: null,

  /**
   * State of Bluetooth default adapter.
   *
   * @private
   */
  _isEnabled: false,

  /**
   * Setting value to store connected device.
   *
   * @private
   */
  _deviceConnectedKey: 'bluetooth.device.connected',

  get Profiles() {
    return {
      HFP: 'hfp',   // Hands-Free Profile
      OPP: 'opp',   // Object Push Profile
      A2DP: 'a2dp', // A2DP status
      SCO: 'sco'    // Synchronous Connection-Oriented
    };
  },

  /**
   * Set profile connect state.
   *
   * @private
   * @param {String} profile profile id
   * @param {Boolean} connected connect status
   */
  _setProfileConnected: function bt_setProfileConnected(profile, connected) {
    var value = this['_' + profile + 'Connected'];
    if (value !== connected) {
      this['_' + profile + 'Connected'] = connected;

      // Raise an event for the profile connection changes.
      window.dispatchEvent(new CustomEvent('bluetoothprofileconnectionchange',
        {
          detail: {
            name: profile,
            connected: connected
          }
        }
      ));
    }
  },

  /**
   * Check if bluetooth profile is connected.
   *
   * @private
   * @param {String} profile profile name
   * @return {Boolean} connected state
   */
  isProfileConnected: function bt_isProfileConnected(profile) {
    var isConnected = this['_' + profile + 'Connected'];
    if (isConnected === undefined) {
      return false;
    } else {
      return isConnected;
    }
  },

  /**
   * Initialize bluetooth module.
   *
   * @public
   */
  init: function bt_start() {
    if (!window.navigator.mozSettings || !window.navigator.mozBluetooth) {
      return;
    }

    this._bluetooth = window.navigator.mozBluetooth;

    // hold the instances so we can remove it when needed
    this._bindBtAdapterHandler =
      this._btAdapterHandler.bind(this);

    this._bindHfpStatusChangedHandler = function(evt) {
      this._setProfileConnected('hfp', evt.status);
    }.bind(this);
    this._bindA2dpStatusChangedHandler = function(evt) {
      this._setProfileConnected('a2dp', evt.status);
    }.bind(this);
    this._bindScoStatusChangedHandler = function(evt) {
      this._setProfileConnected('sco', evt.status);
    }.bind(this);

    this._initDefaultAdapter();

    navigator.mozSetMessageHandler('bluetooth-pairing-request',
      () => {
        this.debug('send pairing event -> external screen');
        window.ExternalScreenManager.send(new CustomEvent('notification', {
          detail: {
            type: 'bluetooth'
          }
        }));
      }
    );

    this._bluetooth.addEventListener('attributechanged',
      this._btManagerHandler.bind(this));

    // decouple enable/disable bluetooth function from other system part
    window.addEventListener('request-enable-bluetooth',
      this._requestEnableHandler.bind(this));
    window.addEventListener('request-disable-bluetooth',
      this._requestDisableHandler.bind(this));

    // relay bluetooth transfer system messages
    navigator.mozSetMessageHandler('bluetooth-opp-transfer-start',
      this._oppTransferStartHandler.bind(this));
    navigator.mozSetMessageHandler('bluetooth-opp-transfer-complete',
      this._oppTransferCompleteHandler.bind(this));

    // expose functions to Service.request
    Service.register('adapter', this);
    Service.register('pair', this);
    Service.register('getPairedDevices', this);
    // expose functions to Service.query
    Service.registerState('isEnabled', this);
    Service.registerState('getAdapter', this);
    Service.registerState('isOPPProfileConnected', this);
    Service.registerState('isA2DPProfileConnected', this);
    Service.registerState('isSCOProfileConnected', this);

    LazyLoader.load(['js/bluetooth_transfer.js']).then(() => {
      BluetoothTransfer.init();
    }).catch(function(err) {
      console.error(err);
    });

    LazyLoader.load([
      'js/pbmap/pbap.js',
      'js/pbmap/pbmap_dialog.js',
      'js/pbmap/map_manager.js',
      'js/pbmap/contact2vcard.js',
      'js/pbmap/message.js',
      'js/pbmap/message_utils.js',
      'js/pbmap/phonebook.js',
      'js/pbmap/setImmediate.js',
      'js/pbmap/vcard_utils.js'
    ]).then(() => {
      console.log('bluetooth init pbap/map');
    }).catch(function (err) {
      console.error(err);
    });

  },

  stop: function() {
    Service.unregister('adapter', this);
    Service.unregister('pair', this);
    Service.unregister('getPairedDevices', this);
    Service.unregisterState('isEnabled', this);
    Service.unregisterState('getAdapter', this);
    Service.unregisterState('isOPPProfileConnected', this);
    Service.unregisterState('isA2DPProfileConnected', this);
    Service.unregisterState('isSCOProfileConnected', this);
  },

  /**
   * Generally bluetooth adapter is already available when start
   * this module and no related event will be received.
   * so we try to get the adapter then listen to mozBluetooth change
   * to prevent race condition
   *
   * @private
   */
  _initDefaultAdapter: function() {
    this.debug('init bluetooth adapter');
    this._adapter = this._bluetooth.defaultAdapter;
    if (this._adapter) {
      this.debug('adapter is available');
      // listen states when the adapter is available
      this._adapterAvailableHandler();

      // dispatch default bluetooth enable state
      this._isEnabled = (this._adapter.state === 'enabled');
      this._dispatchEnableState();
    }
  },

  /**
   * Once adapter is available, listen to bluetooth state and
   * the connect stat of supported profiles.
   *
   * we only support two use cases for bluetooth connection:
   *   1. connecting with a headset
   *   2. transfering a file to/from another device
   * So we need to listen to corresponding events to know we are (aren't)
   * connected, then summarize to an event and dispatch to Statusbar
   *
   * @private
   */
  _adapterAvailableHandler: function bt__adapterAvailableHandler() {
    // initialize Bluetooth connection status
    this._updateConnectionStatus();

    // listen to adapter state
    this._adapter.addEventListener('attributechanged',
      this._bindBtAdapterHandler);

    // headset connected cases
    this._adapter.addEventListener('hfpstatuschanged',
      this._bindHfpStatusChangedHandler);
    this._adapter.addEventListener('a2dpstatuschanged',
      this._bindA2dpStatusChangedHandler);
    this._adapter.addEventListener('scostatuschanged',
      this._bindScoStatusChangedHandler);
  },

  /**
   * Remove all EventListeners when default adapter is changed.
   */
  _adapterUnavailableHandler: function bt__adapterUnavailableHandler() {
    this.debug('default adapter is removed');
    // unbind headset connected cases
    this._adapter.removeEventListener('hfpstatuschanged',
      this._bindHfpStatusChangedHandler);
    this._adapter.removeEventListener('a2dpstatuschanged',
      this._bindA2dpStatusChangedHandler);
    this._adapter.removeEventListener('scostatuschanged',
      this._bindScoStatusChangedHandler);

    // unbind adapter
    this._adapter.removeEventListener('attributechanged',
      this._bindBtAdapterHandler);
  },

  /**
   * Update settings value and enable bluetooth hardware.
   *
   * @private
   */
  _requestEnableHandler: function bt__requestEnableHandler() {
    this.debug('enabling bluetooth');
    if (this._adapter) {
      // the state will be dispatched in _btAdapterHandler
      this._adapter.enable().then(() => { //resolve
        this.debug('bluetooth enabled');
      }, () => { //reject
        this.debug('can not get bluetooth adapter');
      });
    } else { // return current state since we can't process the request
      this.debug('adapter is not available');
      this._dispatchEnableState();
    }
  },

  /**
   * Update settings value and disable bluetooth hardware.
   *
   * @private
   */
  _requestDisableHandler: function bt__requestDisableHandler() {
    this.debug('disabling bluetooth');
    if (this._adapter) {
      if (this._adapter.state === 'disabled' ||
          this._adapter.state === 'disabling') {
        this.debug('bluetooth state is originally disabled');
        return;
      }
      // the state will be dispatched in _btAdapterHandler
      this._adapter.disable().then(() => { //resolve
        this.debug('bluetooth disabled');
      }, () => { //reject
        this.debug('can not get bluetooth adapter');
      });
    } else { // return current state since we can't process the request
      this.debug('adapter is not available');
      this._dispatchEnableState();
    }
  },

  /*
   * In file transfering case:
   * since System Message can't be listened in two js files within a app,
   * so we listen here but dispatch events to bluetooth_transfer.js
   * while getting bluetooth file transfer start system messages
   *
   * @private
   */
  _oppTransferStartHandler: function(transferInfo) {
    this._setProfileConnected('opp', true);
    window.dispatchEvent(new CustomEvent('bluetooth-opp-transfer-start',
      {
        detail: { transferInfo: transferInfo }
      }
    ));
  },

  /*
   * In file transfering case:
   * since System Message can't be listened in two js files within a app,
   * so we listen here but dispatch events to bluetooth_transfer.js
   * while getting bluetooth file transfer complete system messages
   *
   * @private
   */
  _oppTransferCompleteHandler: function(transferInfo) {
    this._setProfileConnected('opp', false);
    window.dispatchEvent(new CustomEvent('bluetooth-opp-transfer-complete',
      {
        detail: { transferInfo: transferInfo }
      }
    ));
  },

  /**
   * BT APIv2: Watch 'onattributechanged' event from
   * mozBluetooth.defaultAdapter for updating state information.
   *
   * @private
   * @param  {Object} evt event object
   */
  _btAdapterHandler:
    function bt__btAdapterHandler(evt) {
      for (var i in evt.attrs) {
        switch (evt.attrs[i]) {
          case 'state':
            if (this._adapter.state === 'enabled') {
              this.debug('state true');
              this._isEnabled = true;
              navigator.mozSettings.createLock()
                .set({'bluetooth.enabled': true}).then(() => {
                this._connectPairedDecive();
              });
              window.dispatchEvent(new CustomEvent('bluetooth-adapter-added'));
            } else if (this._adapter.state === 'disabled') {
              this.debug('state false');
              this._isEnabled = false;
              navigator.mozSettings.createLock()
                  .set({'bluetooth.enabled': false});
              window.dispatchEvent(new CustomEvent('bluetooth-disabled'));
            }
            break;
          default:
            break;
        }
      }
  },

  /**
   * Watch 'onattributechanged' event from mozBluetooth for updating default
   * adapter information.
   *
   * 'onattributechanged' event description:
   * A handler to trigger when bluetooth manager's only property
   * defaultAdapter has changed.
   *
   * Here are three adapter change cases:
   *
   * null -> adapter: set new adapter and dispatch adapter state.
   * adapter -> null: clear defaultAdapter and listener.
   * adapterA -> adapterB: clean defaultAdapter and listener,
   *   then set new adapter and dispatch adapter state.
   *
   * @private
   * @param  {Object} evt event object
   */
  _btManagerHandler:
    function bt__btManagerHandler(evt) {
      for (var i in evt.attrs) {
        switch (evt.attrs[i]) {
          // Default adapter attribute change.
          // Usually, it means that we reach new default adapter.
          case 'defaultAdapter':
            this.debug('defaultAdapter changed.');
            if (this._bluetooth.defaultAdapter) {
              if (this._adapter !== this._bluetooth.defaultAdapter) {
                if (this._adapter !== null) { // adapter A -> adapter B
                  this.debug('origin adapter is removed');
                  this._adapterUnavailableHandler();
                  this._adapter = null;
                }
                // set new adapter and dispatch adapter state
                this.debug('new adapter is added');
                this._adapter = this._bluetooth.defaultAdapter;
                this._isEnabled = (this._adapter.state === 'enabled');
                // listen states when the adapter is available
                this._adapterAvailableHandler();
              }
            } else { // adapter -> null
              this.debug('default adapter is removed');
              this._adapterUnavailableHandler();
              this._adapter = null;
            }
            break;
          default:
            break;
        }
      }
  },

  /**
   * Dispatch bluetooth enable/disable state to system.
   *
   * @private
   */
  _dispatchEnableState: function bt__dispatchEnableState() {
    if (this._isEnabled) {
      window.dispatchEvent(new CustomEvent('bluetooth-adapter-added'));
    } else {
      window.dispatchEvent(new CustomEvent('bluetooth-disabled'));
    }
  },

  /**
   * Update cached connection statuses via Bluetooth web APIs
   *
   * @private
   */
  _updateConnectionStatus: function bt__updateConnectionStatus() {
    if (this._adapter) {
      // HFP (Hands-Free Profile), UUID: 0x111E
      var reqHFP = this._adapter.getConnectedDevices('0x111E');
      reqHFP.onsuccess = function() {
        // the result will be only array or null/undefined.
        // if there is no HFP connection, it will be an empty array.
        if (reqHFP.result) {
          this.debug('init HFP connection status');
          this._setProfileConnected('hfp', reqHFP.result.length > 0);
        }
      }.bind(this);
      // A2DP (Advanced Audio Distribution Profile), UUID: 0x110D
      var reqA2DP = this._adapter.getConnectedDevices('0x110D');
      reqA2DP.onsuccess = function() {
        // the result will be only array or null/undefined.
        // if there is no A2DP connection, it will be an empty array.
        if (reqA2DP.result) {
          this.debug('init A2DP connection status');
          this._setProfileConnected('a2dp', reqA2DP.result.length > 0);
        }
      }.bind(this);
      // SCO (Synchronous Connection-Oriented link)
      var reqSco =  this._adapter.isScoConnected();
      reqSco.onsuccess = function() {
        this.debug('init SCO status');
        this._setProfileConnected('sco', reqSco.result);
      }.bind(this);
    }
  },

  /**
   * Connect to the already paired device.
   */
  _connectPairedDecive: function bt__connectPairedDecive() {
    var settings = window.navigator.mozSettings;
    settings.createLock().get(this._deviceConnectedKey).then((result) => {
      var address = result[this._deviceConnectedKey];
      if (address) {
        var pairedDevices = this.getPairedDevices();
        for (var i in pairedDevices) {
          if (pairedDevices[i].address === address) {
            var device = pairedDevices[i];
            this._adapter.connect(device).then(() => {
              this.debug('Connect succeeded');
            }, () => {
              this.debug('Connect failed');
            });
          }
        }
      }
    });
  },

  /**
   * Get adapter from bluetooth through promise interface.
   * XXX: the function abstract the Bluetooth API difference.
   * We can remove it and use service query once BTv1 is deprecated.
   *
   * @public
   * @return {Promise} A promise that resolve the Bluetooth Adapter
   */
  adapter: function bt__adapter() {
    return new Promise((resolve, reject) => {
      if (this._adapter !== null) {
        resolve(this._adapter);
      } else {
        this.debug('No BT adapter retrieved');
        reject();
      }
    });
  },

  /**
   * Return device pairing result.
   * XXX: the function abstract the Bluetooth API difference.
   *
   * @public
   * @param {string} mac target device address
   * @return {Promise} A promise that resolve when pair successfully,
   *                   reject when pair failed
   */
  pair: function bt__pair(mac) {
    return this._adapter.pair(mac);
  },

  /**
   * Return paired devices list.
   * XXX: the function abstract the Bluetooth API difference.
   * We can use service query to return list once BTv1 is deprecated.
   *
   * @public
   * @returns {Object[]} sequence of BluetoothDevice
   */
  getPairedDevices: function bt__getPairedDevices() {
    return this._adapter.getPairedDevices();
  },

  /**
   * Return bluetooth adapter.
   *
   * @public
   */
  get getAdapter() {
    return this._adapter;
  },

  /**
   * Maintain bluetooth enable/disable state.
   *
   * @public
   */
  get isEnabled() {
    return this._isEnabled;
  },

  /**
   * Check if bluetooth OPP profile is connected.
   *
   * @public
   * @return {Boolean} connected state
   */
  get isOPPProfileConnected() {
    return this.isProfileConnected('opp');
  },

  /**
   * Check if bluetooth A2DP profile is connected.
   *
   * @public
   * @return {Boolean} connected state
   */
  get isA2DPProfileConnected() {
    return this.isProfileConnected('a2dp');
  },

  /**
   * Check if bluetooth SCO profile is connected.
   *
   * @public
   * @return {Boolean} connected state
   */
  get isSCOProfileConnected() {
    return this.isProfileConnected('sco');
  },

  /**
   * Check if any of bluetooth profiles is connected.
   * Referenced by Bluetooth icon update
   *
   * @public
   * @return {Boolean} connected state
   */
  get connected() {
    return this.isProfileConnected('hfp') ||
      this.isProfileConnected('a2dp') ||
      this.isProfileConnected('opp');
  },

  /**
   * Console log.
   *
   * @private
   * @param  {Object} msg debug message
   */
  debug: function bt_debug(msg) {
    if (!this.onDebug) {
      return;
    }

    console.log('[System Bluetooth]: ' + msg);
  }
};

exports.Bluetooth2 = Bluetooth;
})(window);
