/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

define(['require','modules/bluetooth/bluetooth_adapter_manager','modules/bluetooth/bluetooth_context'],function(require) {
  

  let AdapterManager = require('modules/bluetooth/bluetooth_adapter_manager');
  let BtContext = require('modules/bluetooth/bluetooth_context');

  let _debug = false;
  let debug = function() {};
  if (_debug) {
    debug = function pm_debug(msg) {
      console.log('--> [Bluetooth PairManager]: ' + msg);
    };
  }

  /*
   * PairManager is responsible for:
   *   1. Handling system message 'bluetooth-pairing-request' while there is an
   *      incoming/outgoing pairing request.
   *   2. Handling dom event from BluetoothPairingListener while there is an
   *      incoming/outgoing pairing request.
   *   3. Handling dom event 'ondeviceunpaired' while some remote devices
   *      request for canceling an overdue pairing request. The reason could be
   *      authentication fails, remote device down, and internal error happens.
   */
  let PairManager = {
    /**
     * Default adapter of Bluetooth.
     *
     * @access private
     * @memberOf PairManger
     * @type {Object} BluetoothAdapter
     */
    _defaultAdapter: null,

    /**
     * Device name for the pairing toast
     * @type {String}
     */
    _deviceName: null,

    init() {
      this._defaultAdapter = AdapterManager.defaultAdapter;

      // Watch pairing events.
      this._watchOndisplaypasskeyreq();
      this._watchOnenterpincodereq();
      this._watchOnpairingconfirmationreq();
      this._watchOnpairingconsentreq();
      this._watchOnpairingaborted();
      this._watchDefaultAdapterOndevicepaired();

      navigator.mozSetMessageHandler('bluetooth-pairing-request',
        this._onRequestPairingFromSystemMessage.bind(this));

      // Observe Bluetooth 'enabled' property from hardware side.
      // Then, close pairing dialog immediately.
      BtContext.observe('enabled', (enabled) => {
        if (!enabled) {
          this.onBluetoothDisabled();
        }
      });

      // Observe 'defaultAdapter' property for reaching default adapter.
      AdapterManager.observe('defaultAdapter',
        this._onDefaultAdapterChanged.bind(this));

    },


    /**
     * 'defaultAdapter' change event handler from adapter manager for
     * updating it immediately.
     *
     * @access private
     * @memberOf PairManager
     * @param {Object} BluetoothAdapter newAdapter
     */
    _onDefaultAdapterChanged(newAdapter) {
      // Save default adapter
      this._defaultAdapter = newAdapter;

      if (newAdapter) {
        this._watchOndisplaypasskeyreq();
        this._watchOnenterpincodereq();
        this._watchOnpairingconfirmationreq();
        this._watchOnpairingconsentreq();
        this._watchOnpairingaborted();
        this._watchDefaultAdapterOndevicepaired();
      }
    },

    /**
     * Watch 'ondisplaypasskeyreq' dom event for pairing.
     * A handler to trigger when a remote bluetooth device requests to display
     * passkey on the screen during pairing process.
     *
     * @access private
     * @memberOf PairManager
     */
    _watchOndisplaypasskeyreq() {
      if (!this._defaultAdapter || !this._defaultAdapter.pairingReqs) {
        debug('_watchOndisplaypasskeyreq() no adapter or pairingReqs');
        return;
      }

      this._defaultAdapter.pairingReqs.ondisplaypasskeyreq =
        this._onDisplayPasskey.bind(this);
    },

    _onDisplayPasskey(evt) {
      debug('_onDisplayPasskey()');
      this._handlePairingRequest({
        method: 'displaypasskey',
        evt: evt
      });
    },

    /**
     * Watch 'onenterpincodereq' dom event for pairing.
     * A handler to trigger when a remote bluetooth device requests user enter
     * PIN code during pairing process.
     *
     * @access private
     * @memberOf PairManager
     */
    _watchOnenterpincodereq() {
      if (!this._defaultAdapter || !this._defaultAdapter.pairingReqs) {
        debug('_watchOnenterpincodereq() no adapter or pairingReqs');
        return;
      }

      this._defaultAdapter.pairingReqs.onenterpincodereq =
        this._onEnterPincode.bind(this);
    },

    _onEnterPincode(evt) {
      debug('_onEnterPincode()');
      this._handlePairingRequest({
        method: 'enterpincode',
        evt: evt
      });
    },

    /**
     * Watch 'onpairingconfirmationreq' dom event for pairing.
     * A handler to trigger when a remote bluetooth device requests user
     * confirm passkey during pairing process. Applications may prompt passkey
     * to user for confirmation, or confirm the passkey for user proactively.
     *
     * @access private
     * @memberOf PairManager
     */
    _watchOnpairingconfirmationreq() {
      if (!this._defaultAdapter || !this._defaultAdapter.pairingReqs) {
        debug('_watchOnpairingconfirmationreq() no adapter or pairingReqs');
        return;
      }

      this._defaultAdapter.pairingReqs.onpairingconfirmationreq =
        this._onPairingConfirmation.bind(this);
    },

    _onPairingConfirmation(evt) {
      debug('_onPairingConfirmation: evt = ' + JSON.stringify(evt));
      this._handlePairingRequest({
        method: 'confirmation',
        evt: evt
      });
    },

    /**
     * Watch 'onpairingconsentreq' dom event for pairing.
     * A handler to trigger when a remote bluetooth device requests user
     * confirm pairing during pairing process. Applications may prompt user
     * for confirmation or confirm for user proactively.
     *
     * @access private
     * @memberOf PairManager
     */
    _watchOnpairingconsentreq() {
      if (!this._defaultAdapter || !this._defaultAdapter.pairingReqs) {
        debug('_watchOnpairingconsentreq() no adapter or pairingReqs');
        return;
      }

      this._defaultAdapter.pairingReqs.onpairingconsentreq =
        this._onPairingConsent.bind(this);
    },

    _onPairingConsent(evt) {
      debug('_onPairingConsent: evt = ' + JSON.stringify(evt));
      this._handlePairingRequest({
        method: 'consent',
        evt: evt
      });
    },

    /**
     * Watch 'onpairingaborted' dom event for pairing aborted.
     * A handler to trigger when pairing fails due to one of
     * following conditions:
     * - authentication fails
     * - remote device down (bluetooth ACL becomes disconnected)
     * - internal error happens
     *
     * @access private
     * @memberOf PairManager
     */
    _watchOnpairingaborted() {
      if (!this._defaultAdapter) {
        return;
      }

      this._defaultAdapter.onpairingaborted = this._onPairingAborted.bind(this);
    },

    /**
     * A handler to handle 'onpairingaborted' event while it's coming.
     *
     * @access private
     * @memberOf PairManager
     */
    _onPairingAborted(evt) {
      debug('_onPairingAborted(): evt = ' + JSON.stringify(evt));
      // if the attention screen still open, close it
      if (this.childWindow) {
        this.childWindow.Pairview.closeInput();
        this.childWindow.close();
      }

      this.showToast('paired-failed',
        { 'deviceName': this._deviceName });

      // Need waiting the for Toast show before close window
      setTimeout(() => {
        this._unregisterAllEvent();
        window.close();
      }, 100);
    },

    /**
     * Watch 'ondevicepaired' event from default adapter for updating paired
     * device immediately.
     *
     * Description of 'ondevicepaired' event:
     * A handler to trigger when a remote device gets paired with local
     * bluetooth adapter.
     *
     * @access private
     * @memberOf pairManager
     * @param {BluetoothAdapter} adapter
     */
    _watchDefaultAdapterOndevicepaired() {
      if (!this._defaultAdapter) {
        return;
      }

      this._defaultAdapter.ondevicepaired =
          this._onAdapterDevicepaired.bind(this);
    },

    /**
     * Unwatch 'ondevicepaired' event from default adapter since adapter is
     * removed.
     *
     * @access private
     * @memberOf pairManager
     * @param {BluetoothAdapter} adapter
     */
    _unwatchDefaultAdapterOndevicepaired() {
      if (!this._defaultAdapter) {
        return;
      }

      this._defaultAdapter.ondevicepaired = null;
    },


    /**
     * 'ondevicepaired' event handler from default adapter for updating paired
     * device in remote/paired devices list.
     *
     * @access private
     * @memberOf pairManager
     * @param {BluetoothAdapter} adapter
     * @param {event} evt
     */
    _onAdapterDevicepaired(evt) {
      debug(`_onAdapterDevicepaired evt = ${evt.device.name}`);

      this._unregisterAllEvent();
      window.close();

      /*
       * Have to get device object in this event handler
       * Ex. evt.device --> device
       */
    },

    /**
     * Receive the system message event for launch Bluetooth app here.
     *
     * @access private
     * @memberOf PairManager
     */
    _onRequestPairingFromSystemMessage() {
      debug('onRequestPairingFromSystemMessage():');
    },

      /**
     * It is used to handle each pairing request from different pairing methods.
     *
     * @memberOf PairManager
     * @access private
     * @param {Object} pairingInfo
     * @param {Object} pairingInfo.method - method of this pairing request
     * @param {Object} pairingInfo.evt - DOM evt of this pairing request
     */
    _handlePairingRequest(pairingInfo) {
      debug('_onRequestPairing():' +
            ' pairingInfo.method = ' + pairingInfo.method +
            ' pairingInfo.evt = ' + pairingInfo.evt);

      this.showPairview(pairingInfo);
    },

    _unregisterAllEvent() {
      this._defaultAdapter.ondevicepaired = null;
      this._defaultAdapter.onpairingaborted = null;
      this._defaultAdapter.pairingReqs.onpairingconsentreq = null;
      this._defaultAdapter.pairingReqs.ondisplaypasskeyreq = null;
      this._defaultAdapter.pairingReqs.onpairingconfirmationreq = null;
      this._defaultAdapter.pairingReqs.onenterpincodereq = null;
    },
    showPairview(pairingInfo) {
      debug('showPairview()');
      let _ = navigator.mozL10n.get;
      let name = 'pair_screen' + Math.random().toString().substring(2);

      this._deviceName = pairingInfo.evt.deviceName ?
        pairingInfo.evt.deviceName : _('unnamed-device');

      let url = window.location.origin + '/onpair.html';

      this.childWindow = window.open(url,
                  name, 'attention');
      this.childWindow.onload = () => {
        this.childWindow.Pairview.init(pairingInfo.method, pairingInfo.evt);
      };
    },

    showToast(id, args) {
      let toast = {
        messageL10nId: id,
        messageL10nArgs: args,
        latency: 2000,
        useTransition: true
      };

      debug('show Toast ');
      Toaster.showToast(toast);
    },

    onBluetoothDisabled() {
      debug('onBluetoothDisabled():');

      // if the attention screen still open, close it
      if (this.childWindow) {
        this.childWindow.Pairview.closeInput();
        this.childWindow.close();
      }
    }
  };

  return PairManager;
});
