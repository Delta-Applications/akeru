/**
 * The Bluetooth panel
 */
define(['require','modules/bluetooth/bluetooth_context','modules/bluetooth/bluetooth_connection_manager','panels/bluetooth/bt_template_factory','modules/mvvm/list_view','modules/settings_panel'],function(require) {
  

  let BtContext = require('modules/bluetooth/bluetooth_context');
  let BtConnectionManager =
    require('modules/bluetooth/bluetooth_connection_manager');
  let BtTemplateFactory = require('panels/bluetooth/bt_template_factory');
  let ListView = require('modules/mvvm/list_view');
  let SettingsPanel = require('modules/settings_panel');

  let _debug = false;
  let debug = function() {};
  if (_debug) {
    debug = function btp_debug(msg) {
      console.log('--> [Bluetooth][Panel]: ' + msg);
    };
  }

  return function ctor_bluetooth() {
    let elements;
    let searchingBar;
    let searchCompleteBar;
    let noDevicesBar;
    let pairedBar;
    let currentFocusItem;
    let currentPairingDevice;

    return SettingsPanel({
      onInit: function(panel) {
        // To record current bluetooth status
        this.status = 'init';
        debug('Init bluetooth nearby devices.');
        this._boundUpdateSearchingStatus = this._updateSearchingStatus.bind(this);
        this._boundUpdateSearchingSoftkey = this._updateSearchingSoftkey.bind(this);
        this._refreshSoftkey = this._focusChanged.bind(this);
        this._boundUpdatePairedSoftkey = this._updatePairedSoftkey.bind(this);
        this._boundBluetoothState = this._updateBluetoothState.bind(this);

        elements = {
          panel: panel,
          foundDevicesList: panel.querySelector('#bluetooth-devices'),
          searchingItem: panel.querySelector('#bluetooth-searching'),
          nearbyDevicesDesc: panel.querySelector('#nodevices-nearby'),
        };
        let cskSelect = {
          name: 'select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        };
        let rskRescan = {
          name: 'Rescan',
          l10nId: 'rescan',
          priority: 3,
          method: this._searchAgain.bind(this)
        };
        searchingBar = {items: [cskSelect]};
        searchCompleteBar = {items: [cskSelect, rskRescan]};
        noDevicesBar = {items: [rskRescan]};
        pairedBar = { items: [rskRescan] };

        // found devices list item click events
        let foundDeviceTemplate =
          BtTemplateFactory('remote', this._onFoundDeviceItemClick.bind(this));

        // create found devices list view
        ListView(elements.foundDevicesList,
                 BtContext.getRemoteDevices(),
                 foundDeviceTemplate);

        BtContext.observe('state', this._boundBluetoothState);
        navigator.mozSetMessageHandler('bluetooth-pairing-request',
          this._onRequestPairingFromSystemMessage.bind(this));
      },

      onBeforeShow: function() {
        debug('onBeforeShow():');

        document.addEventListener('focusChanged', this._refreshSoftkey);
        BtContext.observe('discovering', this._boundUpdateSearchingStatus);
        BtContext.observe('hasFoundDevice', this._boundUpdateSearchingSoftkey);
        BtContext.observe('paired', this._boundUpdatePairedSoftkey);
      },

      onShow: function() {
        debug('onShow');
        if ('pairing' === this.status || 'pairFailed' === this.status) {
          return;
        }

        if ('remotePairing' === this.status) {
          this.status = 'idle';
          this._updateSoftkey(searchCompleteBar);
          return;
        }

        this._searchAgain();
      },

      onBeforeHide: function() {
        debug('onBeforeHide():');
        BtContext.unobserve('discovering', this._boundUpdateSearchingStatus);
        BtContext.unobserve('hasFoundDevice', this._boundUpdateSearchingSoftkey);
        BtContext.unobserve('paired', this._boundUpdatePairedSoftkey);
        document.removeEventListener('focusChanged', this._refreshSoftkey);
      },

      onHide: function() {
        debug('onHide():');
        BtContext.stopDiscovery();
        if (this.status === 'discovering') {
          this.status = 'idle';
        }
      },

      _onRequestPairingFromSystemMessage: function() {
        if ('devicesInthearea' === document.querySelector('.current').id) {
          if ('pairing' !== this.status) {
            this.status = 'remotePairing';
          }
        }
        debug('onRequestPairingFromSystemMessage():');
      },

      _onFoundDeviceItemClick: function(deviceItem) {
        let softkey = SettingsSoftkey.getSoftkey();
        if (softkey.buttonCsk.innerHTML !== '') {
          this._toPairDevice(deviceItem);
        }
      },

      _toPairDevice: function(deviceItem) {
        debug('_onFoundDeviceItemClick(): deviceItem.address = ' +
              deviceItem.address);
        currentPairingDevice = deviceItem;

        // Update device pairing status first.
        deviceItem.paired = 'pairing';
        this.status = 'pairing';
        SettingsSoftkey.hide();
        // Pair with the remote device.
        BtContext.pair(deviceItem.address).then(() => {
          debug('paired with ' + deviceItem.name + ' success.');

          // Connect the device which is just paired.
          this._connectHeadsetDevice(deviceItem);

          // Reload current nearby devices page
          this.status = 'idle';
          deviceItem.paired = true;
          this._updatePairedSoftkey(true);
        }, (reason) => {
          debug('_onFoundDeviceItemClick(): pair failed, ' +
                'reason = ' + reason);
          // Reset the paired status back to false,
          // since the 'pairing' status is given in Gaia side.
          deviceItem.paired = false;
          this.status = 'pairFailed';
          this._showConfirmDialog(deviceItem);
          this._updateSoftkey(searchCompleteBar);
        });
      },

      _connectHeadsetDevice: function(deviceItem) {
        if (deviceItem.type === 'audio-card' ||
          deviceItem.type === 'input-keyboard' ||
          deviceItem.type === 'audio-input-microphone') {
          BtConnectionManager.connect(deviceItem.data).then(() => {
            debug('_connectHeadsetDevice(): connect device successfully');
          }, (reason) => {
            debug('_connectHeadsetDevice(): connect device failed, ' +
                  'reason = ' + reason);
          });
        }
      },

      _updateSearchingStatus: function(discovering) {
        debug('_updateSearchingItem(): ' +
              'callback from observe "discovering" = ' + discovering);
        elements.searchingItem.hidden = !discovering;
        let devicesNearby = BtContext.getRemoteDevices();
        if (discovering === false) {
          if (devicesNearby.length !== 0) {
            if (this.status === 'pairing') {
              SettingsSoftkey.hide();
            } else {
              this._updateSoftkey(searchCompleteBar);
            }
          } else {
            elements.nearbyDevicesDesc.classList.add('visible');
            this._updateSoftkey(noDevicesBar);
          }
          if (this.status !== 'pairing') {
            this.status = 'idle';
          }
        }
      },

      _updateSearchingSoftkey: function(hasFoundDevice) {
        if (hasFoundDevice === true) {
          this._updateSoftkey(searchingBar);
        } else{
          SettingsSoftkey.hide();
        }
      },

      _updatePairedSoftkey: function(paired) {
        debug('_updatePairedSoftkey: ' + paired);
        if (paired) {
          if (currentFocusItem) {
            let p = currentFocusItem.attribute.paired;
            this._updateSoftkeyByPaired(p);
          } else {
            let focusItem = elements.panel.querySelector('li.focus').attribute;
            this._updateSoftkeyByPaired(focusItem.paired);
          }
        }
      },

      _searchAgain: function() {
        SettingsSoftkey.hide();
        elements.nearbyDevicesDesc.classList.remove('visible');
        BtContext.startDiscovery().then(() => {
          this.status = 'discovering';
          debug('_searchAgain(): startDiscovery successfully');
        }, (reason) => {
          debug('_searchAgain(): startDiscovery failed, ' +
                'reason = ' + reason);
        });
      },

      _showConfirmDialog: function(deviceItem) {
        let self = this;
        let dialogConfig = {
          title: {id: 'error-pair-title', args: {}},
          body: {id: 'error-pair-fail', args: {'devicename':deviceItem.name}},
          desc:{id: 'error-pair-checkpin',args:{}},
          cancel: {
            l10nId:'cancel',
            priority:1,
            callback: function() {
              self.status = 'idle';
            }
          },
          confirm: {
            l10nId:'pair',
            priority:3,
            callback: function() {
              self._toPairDevice(deviceItem);
            }
          },
          backcallback: function() {
            self.status = 'idle';
          }
        };
        let dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      },

      _focusChanged: function(evt) {
        currentFocusItem = evt.detail.focusedElement;
        let paired = currentFocusItem.attribute.paired;
        debug('status: ' + this.status);

        if (this.status === 'pairing') {
          SettingsSoftkey.hide();
        } else if (this.status === 'discovering') {
          this._updateSoftkey(searchingBar);
        } else {
          this._updateSoftkeyByPaired(paired);
        }
      },

      _updateSoftkeyByPaired: function (paired) {
        if (paired) {
          this._updateSoftkey(pairedBar);
        } else {
          this._updateSoftkey(searchCompleteBar);
        }
      },

      _updateSoftkey: function(params) {
        if (NavigationMap.currentSection === '#devicesInthearea') {
          SettingsSoftkey.init(params);
          SettingsSoftkey.show();
        }
      },

      _updateBluetoothState: function(state) {
        //bug 52993: when device is pairing, the bluetoothd is killed,
        //The pairing can not be finished, it need clean status.
        if (state === 'disabled' && this.status === 'pairing') {
          this.status = 'idle';
          currentPairingDevice.paired = false;
          this._updateSoftkeyByPaired(false);
        }
      }
    });
  };
});
