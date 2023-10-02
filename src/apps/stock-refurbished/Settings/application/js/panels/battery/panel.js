/**
 * The battery panel displays battery information provided by Battery.
 */
define(['require', 'modules/settings_panel', 'modules/battery', 'shared/settings_listener'], function (require) {


  var SettingsPanel = require('modules/settings_panel');
  var Battery = require('modules/battery');
  var SettingsListener = require('shared/settings_listener');

  return function ctor_battery_panel() {
    var elements = {};
    var powersupply = window.navigator.powersupply;
    var _refreshText = function () {
      navigator.mozL10n.setAttributes(elements.batteryLevelText,
        'batteryLevel-percent-' + Battery.state, {
          level: Battery.level
        });
        
    };

    var listElements = document.querySelectorAll('#battery li');

    function _initSoftKey() {
      var params = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function () {}
        }]
      };

      SettingsSoftkey.init(params);
    }

    function _showToast() {
      showToast('changessaved');
    }

    function _initAllListener() {
      elements.autoSavingSelect.addEventListener('change', _showToast);
      elements.powerSaveSelect.addEventListener('change', _showToast);
      elements.powerSaveMode.addEventListener('keydown', _handleKeyDown);
      elements.autoSavingContainer.addEventListener('keydown', _handleKeyDown);
    }

    function _removeAllListener() {
      elements.autoSavingSelect.removeEventListener('change', _showToast);
      elements.powerSaveSelect.removeEventListener('change', _showToast);
      elements.powerSaveMode.removeEventListener('keydown', _handleKeyDown);
      elements.autoSavingContainer.removeEventListener('keydown', _handleKeyDown);
    }

    function _updateAutoSavingItem(enabled) {
      elements.autoSavingSelect.value = enabled;
    }

    function _updatePowerSavingItem(enabled) {
      elements.powerSaveSelect.value = enabled;
      if (powersupply.powerSupplyOnline) {
        elements.autoSavingContainer.setAttribute('aria-disabled', true);
        elements.autoSavingContainer.classList.add('none-select');
        elements.autoSavingContainer.removeEventListener('keydown', _handleKeyDown);
        return;
      } else {
        elements.autoSavingContainer.setAttribute('aria-disabled', enabled);
      }
      if (enabled) {
        elements.autoSavingContainer.classList.add('none-select');
        elements.autoSavingContainer.removeEventListener('keydown', _handleKeyDown);
      } else {
        elements.autoSavingContainer.classList.remove('none-select');
        elements.autoSavingContainer.addEventListener('keydown', _handleKeyDown);
      }
    }

    function _handleKeyDown(evt) {
      switch (evt.key) {
        case 'Accept':
        case 'Enter':
          if (elements.autoSavingContainer &&
            elements.autoSavingContainer.classList.contains('focus')) {
            elements.autoSavingSelect && elements.autoSavingSelect.focus();
          }
          if (elements.powerSaveMode &&
            elements.powerSaveMode.classList.contains('focus')) {
            elements.powerSaveSelect && elements.powerSaveSelect.focus();
          }
          break;
      }
    }

    function _updatePowerSavingMode() {
      var value = powersupply.powerSupplyOnline;
      elements.powerSaveMode.setAttribute('aria-disabled', value);
      elements.autoSavingContainer.setAttribute('aria-disabled', value);
      if (value) {
        elements.powerSaveMode.classList.add('none-select');
        elements.autoSavingContainer.classList.add('none-select');
        elements.powerSaveMode.removeEventListener('keydown', _handleKeyDown);
      } else {
        elements.powerSaveMode.classList.remove('none-select');
        elements.autoSavingContainer.classList.remove('none-select');
        elements.powerSaveMode.addEventListener('keydown', _handleKeyDown);
      }
      ListFocusHelper.updateSoftkey();
    }

    function updatePowerSaveInfo() {
      let isBtSupport = (DeviceFeature.getValue('bt') === 'true') &&
        !!navigator.mozBluetooth;
      let isGeoSupport = DeviceFeature.getValue('gps') === 'true';
      if (isBtSupport && isGeoSupport) {
        elements.powerSaveInfo.setAttribute('data-l10n-id',
          'powerSave-explanation');
      } else if (isBtSupport) {
        elements.powerSaveInfo.setAttribute('data-l10n-id',
          'powerSave-without-geo');
      } else if (isGeoSupport) {
        elements.powerSaveInfo.setAttribute('data-l10n-id',
          'powerSave-without-bt');
      } else {
        elements.powerSaveInfo.setAttribute('data-l10n-id',
          'powerSave-without-bt-geo');
      }
    }

    return SettingsPanel({
      onInit: function bp_onInit(panel) {
        elements = {
          batteryLevelText: document.getElementById('battery-level'),
          autoSavingContainer: document.getElementById('auto-saving-container'),
          powerSaveMode: document.getElementById('power-save-mode'),
          autoSavingSelect: panel.querySelector('select[name="powersave.threshold"]'),
          powerSaveSelect: panel.querySelector('select[name="powersave.enabled"]'),
          items: panel.querySelectorAll("li"),
          powerSaveInfo: panel.querySelector("#power-save-info")
        };
      },

      onBeforeShow: function bp_onBeforeShow(panel) {
        updatePowerSaveInfo();
        Battery.observe('level', _refreshText);
        Battery.observe('state', _refreshText);
        _refreshText();
        SettingsListener.observe('powersave.enabled', false,
          _updatePowerSavingItem);
        SettingsListener.observe('powersave.threshold', false,
          _updateAutoSavingItem);
        ListFocusHelper.addEventListener(listElements);
        powersupply.addEventListener('powersupplystatuschanged', _updatePowerSavingMode);
        _updatePowerSavingMode();
        _initSoftKey();
        ListFocusHelper.updateSoftkey(panel);
      },

      onBeforeHide: function bp_onBeforeHide() {
        Battery.unobserve(_refreshText);
        SettingsListener.unobserve('powersave.enabled',
          _updatePowerSavingItem);
        SettingsListener.unobserve('powersave.threshold',
          _updateAutoSavingItem);
        ListFocusHelper.removeEventListener(listElements);
        elements.powerSaveMode.removeEventListener('keydown', _handleKeyDown);
        powersupply.removeEventListener('powersupplystatuschanged', _updatePowerSavingMode);
      },

      onShow: function () {},
      onHide: function () {}
    });
  };
});