/*
 * DevicePickerPanel is responsible for:
 *   - Render paired/found devices list in this panel.
 *   - Emit 'devicePicked' event with device address while a user click on a
 *     paired device.
 *   - Pair with the picked device while a user click on a found device.
 *     Emit 'devicePicked' event with device address until the picked device
 *     is pared.
 *   - Emit 'cancelSelection' event while a user click close button on the
 *     header for leaving.
 *
 * @module DevicePickerPanel
 */
define(['require','modules/bluetooth/bluetooth_context','views/bt_template_factory','modules/mvvm/list_view'],function(require) {
  

  var BtContext = require('modules/bluetooth/bluetooth_context');
  var BtTemplateFactory = require('views/bt_template_factory');
  var ListView = require('modules/mvvm/list_view');
  var pairedDeviceTimer = null;

  var _debug = false;
  var debug = function() {};
  if (_debug) {
    debug = (msg) => {
      console.log('--> [Bluetooth DevicePickerPanel]: ' + msg);
    };
  }

  var DevicePickerPanel = {
    /**
     * A instance to maintain paired devices list view.
     *
     * @access private
     * @memberOf DevicePickerPanel
     * @type {Object}
     */
    _pairedDevicesListView: null,

    /**
     * A instance to maintain found devices list view.
     *
     * @access private
     * @memberOf DevicePickerPanel
     * @type {Object}
     */
    _foundDevicesListView: null,

    /**
     * Construct elements.
     *
     * @access private
     * @memberOf DevicePickerPanel
     * @type {Object}
     */
    _elements: {
      deviceList: document.querySelector('#devices-list-view'),
      bluetoothSearch: document.querySelector('#bluetooth-search'),
      nearbyDevicesDesc: document.querySelector('#nodevices-nearby'),
      foundDevicesList: document.querySelector('#bluetooth-devices'),
      pairedDevicesList: document.querySelector('#bluetooth-paired-devices'),
      searchingItem: document.querySelector('#bluetooth-searching')
    },

    /**
     * The object maintains listeners' callback per property name.
     * Each listener would be called as following definition.
     * 'devicePicked' - be called when device is picked and paired successfully.
     * 'cancelSelection': - be called when user click on close button on header.
     *
     * @memberOf DevicePickerPanel
     * @type {Object}
     */
    _listeners: {
      'devicePicked': [],
      'cancelSelection': [],
      'devicePaired': []
    },

    /**
     * Default adapter of Bluetooth.
     *
     * @access private
     * @memberOf DevicePickerPanel
     * @type {Object} BluetoothAdapter
     */
    _defaultAdapter: null,

    status: 'idle',

    /**
     * The function init the paired/found devices list and search button.
     *
     * @access private
     * @memberOf DevicePickerPanel
     */
    _init: function btdpp__init() {
      // Bind click event for paired device item.
      var pairedDeviceTemplate =
        BtTemplateFactory('paired', this._onPairedDeviceItemClick.bind(this));
        debug('enter  btdpp__init');
      // Sometimes we can't get the paired device name and type at this time,
      // because the device name does not immediately get through the interface
      // 'getPairedDevices', so add a delay to ensure that can get device info.
      // If the device type is null, bt_template_factory will add the hidden
      // attribute. And navigator map will not set the navigate attribute.
      // Please refer the bug 72640.
      if (!pairedDeviceTimer) {
          pairedDeviceTimer = setTimeout(() => {
            debug('before getPairedDevices');
            var pairedDevices = BtContext.getPairedDevices();
            // Create paired devices list view.
            debug('after getPairedDevices');
            this._pairedDevicesListView =
              ListView(this._elements.pairedDevicesList,
                pairedDevices,
                pairedDeviceTemplate);
            clearTimeout(pairedDeviceTimer);
            pairedDeviceTimer = null;
          }, 500);
      }

      // Bind click event for found device item.
      var foundDeviceTemplate =
        BtTemplateFactory('remote', this._onFoundDeviceItemClick.bind(this));

      // Create found devices list view.
      this._foundDevicesListView =
        ListView(this._elements.foundDevicesList,
                 BtContext.getRemoteDevices(),
                 foundDeviceTemplate);

      // Init items state.
      BtContext.observe('discovering', this._updateSearchingItem.bind(this));
      this._updateSearchingItem(BtContext.discovering);
      debug('after _updateSearchingItem');
    },

    /**
     * While the paired device is clicked, emit event to outer modules with
     * the device item.
     *
     * @access private
     * @memberOf DevicePickerPanel
     */
    _onPairedDeviceItemClick:
    function btdpp__onPairedDeviceItemClick(deviceItem) {
      debug('_onPairedDeviceItemClick(): deviceItem.address = ' +
            deviceItem.address);
      debug('_onPairedDeviceItemClick(): deviceItem.paired = ' +
            deviceItem.paired);
      // Emit 'devicePicked' event to outer modules with the device item.
      var event = {
        type: 'devicePicked',
        detail: {
          address: deviceItem.address
        }
      };
      this._emitEvent(event);
    },

    /**
     * Pair with the clicked device. While the device is paired successfully,
     * emit event to outer modules with the device item.
     *
     * @access private
     * @memberOf DevicePickerPanel
     */
    _onFoundDeviceItemClick:
    function btdpp__onFoundDeviceItemClick(deviceItem) {
      debug('_onFoundDeviceItemClick(): deviceItem.address = ' +
            deviceItem.address);
      if (this.status === 'pairing') {
        return;
      }
      // Update device pairing status first.
      deviceItem.paired = 'pairing';
      this.status = 'pairing';
      // Pair with the remote device.
      BtContext.pair(deviceItem.address).then(() => {
        debug('_onFoundDeviceItemClick(): pair successfully');
        // Emit 'devicePicked' event to outer modules with the
        // paired device item.
        this.status = 'idle';
        this.refresh();
        var event = {
          type: 'devicePaired',
          detail: {
            view: 'search-devices-list-view'
          }
        };
        this._emitEvent(event);
      }, (reason) => {
        debug('_onFoundDeviceItemClick(): pair failed, ' +
              'reason = ' + reason);
        // Reset the paired status back to false,
        // since the 'pairing' status is given in Gaia side.
        deviceItem.paired = false;
        this.status = 'idle';
        this._showConfirmDialog(deviceItem);
      });
    },

    _showConfirmDialog: function(deviceItem) {
      debug('_showConfirmDialog');
      let self = this;
      let dialogConfig = {
        title: { id: 'error-pair-title', args: {} },
        body: { id: 'error-pair-fail', args: { 'devicename': deviceItem.name } },
        desc: { id: 'error-pair-checkpin', args: {} },
        cancel: {
          l10nId: 'cancel',
          priority: 1,
          callback: function() {}
        },
        confirm: {
          l10nId: 'pair',
          priority: 3,
          callback: function() {
            self._onFoundDeviceItemClick(deviceItem);
          }
        }
      };
      let dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    },

    /**
     * A function to emit event to each registered listener by the input type.
     *
     * @memberOf DevicePickerPanel
     * @param {Object} options
     * @param {String} options.type - type of event name
     * @param {Object} options.detail - the object pass to the listener
     */
    _emitEvent: function btdpp__emitEvent(options) {
      this._listeners[options.type].forEach(function(listener) {
        listener(options);
      });
    },

    /**
     * A function to show/hide searching description item.
     *
     * @access private
     * @memberOf DevicePickerPanel
     */
    _updateSearchingItem: function btdpp__updateSearchingItem(discovering) {
      debug('_updateSearchingItem(): ' +
            'callback from observe "discovering" = ' + discovering);
      this._elements.searchingItem.hidden = !discovering;
      if(ViewHelper.curViewId==='search-devices-list-view'){
        var menu = SoftkeyHelper.menuItems;
        var focused = ViewHelper.curView.querySelector('.focus');
        var softkeys = discovering ? menu.pair_ok : menu.pair_refresh;
        if (discovering === false && focused == null) {
          this._elements.nearbyDevicesDesc.classList.add('visible');
        }
        SoftkeyHelper.softkeyItems[ViewHelper.curViewId] = softkeys;
        SoftkeyHelper.setSkMenu();
      }
    },

    /**
     * The method will provide event listener for outer modules to regist.
     *
     * @access public
     * @memberOf DevicePickerPanel
     * @param {String} eventName
     * @param {Function} callback
     */
    addEventListener: function btdpp_addEventListener(eventName, callback) {
      if (callback && (this._listeners.hasOwnProperty(eventName))) {
        this._listeners[eventName].push(callback);
      }
    },

    /**
     * The method will provide event listener for outer modules to un-regist.
     *
     * @access public
     * @memberOf DevicePickerPanel
     * @param {String} eventName
     * @param {Function} callback
     */
    removeEventListener:
    function btdpp_removeEventListener(eventName, callback) {
      if (callback && (this._listeners.hasOwnProperty(eventName))) {
        var index = this._listeners[eventName].indexOf(callback);
        if (index >= 0) {
          this._listeners[eventName].splice(index, 1);
        }
      }
    },

    removeTimerId:
    function btdpp_removeTimerId() {
        if(pairedDeviceTimer) {
            debug('btdpp_removeTimerId');
            clearTimeout(pairedDeviceTimer);
        }
    },

    searchAgain: function btdpp_searchAgain() {
      if (this.status === 'pairing') {
        return;
      }
      this._elements.nearbyDevicesDesc.classList.remove('visible');
      BtContext.startDiscovery().then(() => {
        debug('_onSearchButtonClick(): startDiscovery successfully');
      }, (reason) => {
        debug('_onSearchButtonClick(): startDiscovery failed, ' +
              'reason = ' + reason);
      });
    },

    refresh: function () {
      BtContext.refreshPairedDevices();
    }
  };

  DevicePickerPanel._init();
  return DevicePickerPanel;
});
