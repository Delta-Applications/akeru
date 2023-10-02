/**
 * The Bluetooth panel
 *
 */
define(['require','modules/bluetooth/bluetooth_context','modules/bluetooth/bluetooth_connection_manager','panels/bluetooth/bt_template_factory','modules/mvvm/list_view','modules/settings_panel'],function(require) {
  

  var BtContext = require('modules/bluetooth/bluetooth_context');
  var BtConnectionManager =
    require('modules/bluetooth/bluetooth_connection_manager');
  var BtTemplateFactory = require('panels/bluetooth/bt_template_factory');
  var ListView = require('modules/mvvm/list_view');
  var SettingsPanel = require('modules/settings_panel');

  var _debug = false;
  var debug = function() {};
  if (_debug) {
    debug = function btp_debug(msg) {
      console.log('--> [Bluetooth][Panel]: ' + msg);
    };
  }

  return function ctor_bluetooth() {
    var elements;
    var pairedDeviceTemplate;
    var _pairedDevicesListView;

    let phoneDeviceBar;
    let connectableDeviceBar;



    return SettingsPanel({
      onInit: function(panel) {
        debug('onInit():');

        this._boundUpdatePairedDesc = this._updatePairedDesc.bind(this);
        this._boundUpdateSoftkeyByType = this._updateSoftkeyByDeviceType.bind(this);

        elements = {
          panel: panel,
          pairedDevicesList: panel.querySelector('#bluetooth-paired-devices'),
          nopairedDesc: panel.querySelector('#nopaired-devices')
        };

        pairedDeviceTemplate =
          BtTemplateFactory('paired', this._onPairedDeviceItemClick.bind(this));

        _pairedDevicesListView = ListView(elements.pairedDevicesList,
                                          BtContext.getPairedDevices(),
                                          pairedDeviceTemplate);

        let cskSelect = {
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        };

        let rskForget = {
          l10nId: 'device-option-unpair',
          priority: 3,
          method: this._showUnpairDialog.bind(this)
        };

        phoneDeviceBar = { items: [ rskForget ] };
        connectableDeviceBar = { items: [ cskSelect, rskForget ] };

      },

      onBeforeShow: function() {
        debug('onBeforeShow():');
        BtContext.observe('numberOfPairedDevices', this._boundUpdatePairedDesc);
        this._updatePairedDesc(BtContext.numberOfPairedDevices);
        document.addEventListener('focusChanged', this._boundUpdateSoftkeyByType);
      },

      onBeforeHide: function() {
        debug('onBeforeHide():');
        BtContext.unobserve('numberOfPairedDevices', this._boundUpdatePairedDesc);
        document.removeEventListener('focusChanged', this._boundUpdateSoftkeyByType);
      },

      onShow: function () {
        this._refreshSoftkey();
      },

      _refreshSoftkey: function() {
        if (BtContext.numberOfPairedDevices > 0) {
          let deviceItem = elements.panel.querySelector('li.focus').attribute;
          if (deviceItem) {
            if (deviceItem.type === 'audio-card' ||
              deviceItem.type === 'input-keyboard' ||
              deviceItem.type === 'audio-input-microphone') {
              this._updateSoftkey(connectableDeviceBar);
            } else {
              this._updateSoftkey(phoneDeviceBar);
            }
          }
        }
      },

      _onPairedDeviceItemClick: function(deviceItem) {
        //connect audio-card, audio-input-microphone and keyboard devices
        if (deviceItem.type === 'audio-card' ||
            deviceItem.type === 'input-keyboard' ||
            deviceItem.type === 'audio-input-microphone') {

          if (deviceItem.connectionStatus === 'connected') {
            BtConnectionManager.disconnect(deviceItem.data).then(() => {
              debug('paired_device: disconnect device successfully');
              showToast('success-disconnected-toast');
            }, (reason) => {
              debug('paired_device: disconnect device failed, ' +
                    'reason = ' + reason);
              showToast('error-disconnect-toast');
            });
          } else if (deviceItem.connectionStatus === 'disconnected') {
            BtConnectionManager.connect(deviceItem.data).then(() => {
              debug('paired_device: connect device successfully');
              showToast('success-connect-toast',
                { deviceName: deviceItem.name });
            }, (reason) => {
              debug('paired_device: connect device failed, ' +
                    'reason = ' + reason);
              showToast('error-connect-toast');
            });
          }
        }
      },

      _showUnpairDialog: function() {
        const self = this;
        const deviceItem = elements.panel.querySelector('li.focus').attribute;
        const title = 'device-option-unpair-confirmation';
        const msg = 'device-option-unpair-device';
        const dialogConfig = {
          title: {id: title, args: {}},
          body: {id: msg, args: {deviceName: deviceItem.name}},
          cancel: {
            l10nId:'cancel',
            priority:1,
            callback: function() {
            }
          },
          confirm: {
            l10nId:'device-option-unpair',
            priority:3,
            callback: () => {
              self._comfirmToUnpair(deviceItem);
            }
          }
        };
        const dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
      },

      _comfirmToUnpair(deviceItem) {
        debug('_confirmToUnpair(): deviceItem.address = ' +
              deviceItem.address);
        BtContext.unpair(deviceItem.address).then(() => {
          showToast('paried-device-forgotten');
          this._refreshSoftkey();
          debug('_comfirmToUnpair(): unpair successfully');
        }, (reason) => {
          debug('_comfirmToUnpair(): unpair failed, ' +
                'reason = ' + reason);
        });
      },

      _updatePairedDesc: function(numberOfPairedDevices) {
        if (numberOfPairedDevices === 0) {
          SettingsSoftkey.hide();
          elements.nopairedDesc.classList.add('visible');
        } else {
          elements.nopairedDesc.classList.remove('visible');
        }
      },

      _updateSoftkey: function(params) {

       SettingsSoftkey.init(params);
       SettingsSoftkey.show();
      },

      _updateSoftkeyByDeviceType: function(evt) {
        let focusedItem = evt.detail.focusedElement;
        debug(focusedItem.attribute.type);

        if ((focusedItem.attribute.type === 'audio-card') ||
          (focusedItem.attribute.type === 'audio-input-microphone') ||
          (focusedItem.attribute.type === 'input-keyboard')) {
          SettingsSoftkey.init(connectableDeviceBar);
          SettingsSoftkey.show();
        } else {
          SettingsSoftkey.init(phoneDeviceBar);
          SettingsSoftkey.show();
        }
      }
    });
  };

});
