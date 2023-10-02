/**
 * The moudle supports displaying cell broadcast enabled toggle on an element.
 *
 * @module panels/cell_broadcast_message/cell_broadcast_switch
 */
define(['require','shared/settings_listener'],function(require) {
  

  let DEBUG = true;
  let FileName = '<!-- CBTAG:: cell_broadcast_utils.js -->';
  let SettingsListener = require('shared/settings_listener');
  let currentSettingsValue = false;
  let rilCbDisabled = 'ril.cellbroadcast.disabled';

  function debug() {
    if (DEBUG) {
      console.log('[' + FileName + '] ' + Array.slice(arguments).concat());
    } else if (window.DUMP) {
      DUMP('[' + FileName + '] ' + Array.slice(arguments).concat());
    }
  }

  /**
   * @alias module:panels/cell_broadcast_message/cell_broadcast_switch
   * @class cellBroadcastSwitchModeItem
   * @param {Object} elements
   * @param {HTMLElement} elements.cellBroadcastSwitchModeItem
   * @param {HTMLElement} elements.cellBroadcastSwitchModeSelect
   * @returns {cellBroadcastSwitchModeItem}
   */
  function CellBroadcastSwitchModeItem(elements) {
    /* << [LIO-29]: BDC kanxj 20200612 Remove CB on/off switch menu for all CB requirements >> */
    elements.cellBroadcastSwitchModeItem.hidden = true;
    this._menuItem = elements.cellBroadcastSwitchModeItem;
    this._select = elements.cellBroadcastSwitchModeSelect;
    this._select.hidden = true;
    SettingsListener.observe(rilCbDisabled, [], value => {
      let serviceId = window.DsdsSettings.getIccCardIndexForCallSettings();
      currentSettingsValue = !value[serviceId];
      let cbEnabled = currentSettingsValue ? 'true' : 'false';
      if (this._select.value !== cbEnabled) {
        this._select.value = cbEnabled;
      }
      this._select.hidden = false;
    });
    this._select.addEventListener('blur', this.setCbStatus);
  }

  CellBroadcastSwitchModeItem.prototype = {
    setCbStatus: function ni_setStatus(evt) {
      let enabled = (evt.target.value === 'true') || false;
      if (currentSettingsValue === enabled) {
        return;
      }
      showToast('changessaved');
    }
  };

  return function ctor_cellBroadcastSwitchModeItem(elements) {
    return new CellBroadcastSwitchModeItem(elements);
  };
});
