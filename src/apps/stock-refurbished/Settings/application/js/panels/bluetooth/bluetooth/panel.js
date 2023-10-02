/**
 * The Bluetooth panel
 *
 */
define(['require','modules/bluetooth/bluetooth_context','modules/settings_panel','modules/settings_service'],function(require) {
  

  var BtContext = require('modules/bluetooth/bluetooth_context');
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  const VISIBLE_TIMEOUT_TIME = 120000;  // Visibility will timeout after 2 mins.

  var _debug = false;
  var debug = function() {};
  if (_debug) {
    debug = function btp_debug(msg) {
      console.log('--> [Bluetooth][Panel]: ' + msg);
    };
  }

  return function ctor_bluetooth() {
    var elements;
    var listElements = document.querySelectorAll('#bluetooth li');

    return SettingsPanel({
      onInit: function(panel) {
        debug('onInit():');

        // Init bounding instances for observe/un-observe property.
        this._boundUpdateEnableCheckbox = this._updateEnableCheckbox.bind(this);
        this._boundUpdateBluetoothList = this._updateBluetoothList.bind(this);
        this._boundUpdatePhoneName = this._updatePhoneName.bind(this);
        this._boundUpdateVisibleCheckbox = this._updateVisibleCheckbox.bind(this);

        elements = {
          panel: panel,
          enableMsg: panel.querySelector('#bluetooth-enable-msg'),
          enableCheckbox: panel.querySelector('.bluetooth-status input'),
          bluetoothSelect: panel.querySelectorAll('input[name="bluetooth-enabled"]'),

          visibleItem: panel.querySelector('#device-visible'),
          visibleCheckBox: panel.querySelector('.device-visible input'),
          visibleSelect: panel.querySelector('#device-visible select'),

          myPhoneNameItem: panel.querySelector('#myPhone-name'),
          phoneName: panel.querySelector('#bluetooth-device-name'),

          pairedDevicesItem: panel.querySelector('#bluetooth-paired-device'),

          nearbyDeviceItem: panel.querySelector('#bluetooth-devices-nearby'),

          items: panel.querySelectorAll('li')
        };

        for (var i = 0; i < elements.bluetoothSelect.length; i++) {
          elements.bluetoothSelect[i].addEventListener('change',
          this._onEnableCheckboxClick.bind(this, i));
        }

        elements.visibleSelect.addEventListener('change',
          this._onVisibleCheckBoxClick.bind(this));
      },

      onBeforeShow: function() {
        debug('onBeforeShow():');

        this._initSoftkey();

        // enable/disable
        BtContext.observe('state', this._boundUpdateEnableCheckbox);
        this._updateEnableCheckbox(BtContext.state);

        BtContext.observe('discoverable', this._boundUpdateVisibleCheckbox);
        this._updateVisibleCheckbox(BtContext.discoverable);

        BtContext.observe('state', this._boundUpdateBluetoothList);
        this._updateBluetoothList(BtContext.state);

        BtContext.observe('name', this._boundUpdatePhoneName);
        this._updatePhoneName(BtContext.name);

        window.addEventListener('keydown', this._keyDownHandler);
        ListFocusHelper.addEventListener(listElements);
      },

      onShow: function(panel, options) {
        debug('onShow():');
        if (!options.isVisibilityChange) {
          this._updateEnableHigtlight(BtContext.state);
        }
      },

      onBeforeHide: function() {
        debug('onBeforeHide():');
        BtContext.unobserve('state', this._boundUpdateEnableCheckbox);
        BtContext.unobserve('discoverable', this._boundUpdateVisibleCheckbox);
        BtContext.unobserve('name', this._boundUpdatePhoneName);
        BtContext.unobserve('state', this._boundUpdateBluetoothList);
        window.removeEventListener('keydown', this._keyDownHandler);
        ListFocusHelper.removeEventListener(listElements);
      },

      onHide: function() {
        debug('onHide():');
      },

      _onEnableCheckboxClick: function(i) {
        var checkboxEnabled = (elements.bluetoothSelect[i].value === 'true');
        debug('_onEnableCheckboxClick(): checkbox = ' + checkboxEnabled);
        var status = checkboxEnabled ? 'on' : 'off';
        BtContext.setEnabled(checkboxEnabled).then(() => {
          showToast('bluetooth-current-status-' + status);
          debug('_onEnableCheckboxClick(): setEnabled ' +
                checkboxEnabled + ' successfully');
//FIHBDC@chun.ling.zou add for LEO-555
          return navigator.mozSettings.createLock().get('bluetooth.visible');
//FIHBDC@chun.ling.zou add for LEO-555 end
        }, (reason) => {
          debug('_onEnableCheckboxClick(): setEnabled ' +
                checkboxEnabled + ' failed, reason = ' + reason);
//FIHBDC@chun.ling.zou add for LEO-555
        }).then((visibleSetting) => {
          console.log('set bluetooth visible :' + visibleSetting['bluetooth.visible']);
          return BtContext.setDiscoverable(!!visibleSetting['bluetooth.visible']);
        }).then(() => {
          debug('setDiscoverable successfully');
        }, (reason) => {
          debug('setDiscoverable failed, reason = ' + reason);
//FIHBDC@chun.ling.zou add for LEO-555 end
        });
      },

      _onVisibleCheckBoxClick: function() {
        var checkbox = (elements.visibleSelect.value === 'true');
        debug('_onVisibleCheckBoxClick(): checked = ' + checkbox);
        var status = checkbox ? 'on' : 'off';
        BtContext.setDiscoverable(checkbox).then(() => {
          showToast('bluetooth-visible-status-' + status);
          debug('_onVisibleCheckBoxClick(): setDiscoverable ' +
                checkbox + ' successfully');
        }, (reason) => {
          debug('_onVisibleCheckBoxClick(): setDiscoverable ' +
                checkbox + ' failed, reason = ' + reason);
        });
      },

      _updateBluetoothList: function(state) {
        var booleanFlag = state === 'enabled' ? false : true;

        elements.visibleItem.hidden = booleanFlag;
        elements.myPhoneNameItem.hidden = booleanFlag;
        elements.nearbyDeviceItem.hidden = booleanFlag;
        elements.pairedDevicesItem.hidden = booleanFlag;
        elements.enableMsg.hidden = !booleanFlag;

        if (state === 'enabled' || state === 'disabled') {
          if (Settings.currentPanel === '#bluetooth') {
            NavigationMap.refresh();
          }
        }
      },

      _updateEnableCheckbox: function(state) {
        state === 'enabled' ? elements.bluetoothSelect[0].checked = true :
                              elements.bluetoothSelect[1].checked = true;
      },

      _updateVisibleCheckbox: function(discoverable) {
        elements.visibleSelect.options[0].selected = discoverable;
        elements.visibleSelect.options[1].selected = !discoverable;
      },

      _updatePhoneName: function(name) {
        debug('_updatePhoneName(): ' +
              'callback from observe "name" = ' + name);
        elements.phoneName.textContent = name;
      },

      _updateEnableHigtlight: function (state) {
        let liItem = null;
        if (state === 'enabled') {
          liItem = elements.items[0];
        } else {
          liItem = elements.items[1];
        }
        requestFocus(elements.panel, liItem);
      },

      _initSoftkey: function() {
      var params = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function() {}
        }]
      };
      SettingsSoftkey.init(params);
      SettingsSoftkey.show();
    },

    _keyDownHandler: function(e) {
      switch (e.key) {
        case 'Accept':
        case 'Enter':
          var checkboxValue = document.querySelector('.focus input');
            if (checkboxValue && checkboxValue.value === 'false' && checkboxValue.checked) {
              SettingsService.navigate('root');
            }
          break;
      }
    }

    });
  };
});
