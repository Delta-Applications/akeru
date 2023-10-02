
/**
  * This SettingsList module copy from shared/js/action_list.
  * It mainly display the action menu in Settings app.
  * It will be customized and made it suitable for Settings.
  */
/* global SoftkeyPanel */

define('modules/settings_list',['require','shared/mobile_operator'],function(require) {
  
  var MobileOperator = require('shared/mobile_operator');
  var _config = null;
  var _container = null;
  var _visibility = false;
  var _wrapper = document.getElementById('settings-list');
  var listElements = null;
  let conns = window.navigator.mozMobileConnections;
  let iccManager = navigator.mozIccManager;

  var _getParameters = function() {
    return new Promise((resolve) => {
      if (conns) {
        [].forEach.call(conns, (simcard, index) => {
          let iccId = simcard.iccId;
          let icc = iccManager.getIccById(iccId);
          let cardState = icc && icc.cardState;

          let item = {
            id: 'sim-with-index-and-carrier',
              args: {
              index: index + 1
            },
            value: index
          };

          if (icc) {
            if (cardState === 'ready') {
              let operatorInfo = MobileOperator.userFacingInfo(conns[index]);
              if (operatorInfo.operator) {
                item.id = 'sim-with-index-and-carrier';
                item.args.carrier = operatorInfo.operator;
              } else {
                item.id = 'noOperator-with-index';
              }
            } else {
              item.id = 'sim-with-index-and-carrier';
              item.args.carrier =
              navigator.mozL10n.get(_getCardDesription(cardState));
              item.disabled = true;
            }
          } else {
            item.id = 'noSim-with-index';
            item.disabled = true;
          }
          _config.items.push(item);
        });
      }
      resolve();
    });
  };

  /**
    * Init the current action list container
    */
  var _init = function(config) {
    return new Promise((resolve) => {
      _config = config;
      if (_container !== null) {
        _clearItems();
      }
      _initSoftKey(config);
      _wrapper.innerHTML = '<div class="visible" tabindex="0">' +
        '<h1 class="header"></h1><div>'+
        '<ul class="container" role="menu"></ul>' +
        '</div></div>';
      _container = _wrapper.firstElementChild;
      _getParameters().then(() => {
        _createList(_config, _container);
        resolve();
       });
    });
  };

  /**
    * Init the settings list softkey
    */
  var _initSoftKey = function(config) {
    var softkeyParams = {
      menuClassName: 'menu-button',
      header: {},
      items: []
    };

    if (config.accept) {
      softkeyParams.items.push({
        name: '',
        priority: 2,
        l10nId: config.accept.l10nId,
        method: function() {}
      });
    }

    SettingsSoftkey.init(softkeyParams);
  };

  /**
    * Init the settings list focus and keydown event
    */
  var _initNavigation = function() {
    window.dispatchEvent(new CustomEvent('panelready', {
      detail: {
        previous : '#root',
        current: '#settings-list'
      }
    }));

    // Dispatch the settings list show event
    window.dispatchEvent(new CustomEvent('settings-list-event', {
      detail: {
        isVisible: _visibility
      }
    }));

    _wrapper.addEventListener('keydown', _handleEvent);
  };

  /**
    * Restore the focus to previous panel and remove the keydown event
    */
  var _restoreNavigation = function() {
    // After settings list hidden, we should focus previous panel item
    window.dispatchEvent(new CustomEvent('panelready', {
      detail: {
        previous : '#settings-list',
        current: '#root',
      }
    }));

    window.dispatchEvent(new CustomEvent('settings-list-event', {
      detail: {
        isVisible: _visibility
      }
    }));

    _wrapper.removeEventListener('keydown', _handleEvent);
  };

  // Get the current item value via focused element
  var _getCurrentValue = function(focusedElement) {
    var value = null;
    if (focusedElement) {
      var index = focusedElement.dataset.index;
      value = _config.items[index].value;
      if (value === undefined) {
        value = null;
      }
    }
    return value;
  };

  /**
    * Handle all keydown event and hide settings list event
    */
  var _handleEvent = function(evt) {
    let focused = document.querySelector('.focus');
    if (focused && evt.target !== focused) {
      focused.classList.remove('focus');
      evt.target.classList.add('focus');
      evt.target.focus();
    }

    // handle keydown event
    switch (evt.key) {
      case 'Backspace':
        _hideList();
        evt.preventDefault();
        break;
      case 'Enter':
        if (_config.accept && !evt.target.disabled) {
          _hideList();
          var value = _getCurrentValue(evt.target);
          var accept = _config.accept.callback;
          accept && accept(value);
        }
        evt.preventDefault();
        break;
    }
  };

  /**
    * Pop up the settings list
    */
  var _showList = function() {
    if (_wrapper.hidden) {
      _wrapper.hidden = false;
      _visibility = true;
      listElements = document.querySelectorAll('#settings-list li');
      ListFocusHelper.addEventListener(listElements);
      _initNavigation();
    }
  };

  /**
    * Hide the current settings list
    */
  var _hideList = function() {
    if (!_wrapper.hidden) {
      _wrapper.hidden = true;
      _visibility = false;
      ListFocusHelper.removeEventListener(listElements);
      _restoreNavigation();
    }
  };

  /**
    * Remove current items and panel
    */
  var _clearItems = function() {
    _container.parentNode.removeChild(_container);
    _container = null;
  };

  /**
    * Create the settings list header and content container
    */
  var _createList = function(context, container) {
    var header = container.querySelector('.header');
    if (context.title) {
      navigator.mozL10n.setAttributes(header,
        context.title.id,
        context.title.args);
    } else {
      header.setAttribute('data-l10n-id', 'select');
    }

    var contentList = container.querySelector('.container');
    context.items.forEach((item, index) => {
      _createItems(contentList, item, index);
    });
  };

  /**
    * Create the settings list item
    */
  var _createItems = function(container, item, index) {
    var li = document.createElement('li');
    li.setAttribute('role', 'menuitem');
    li.dataset.index = index;
    if (item.disabled !== undefined) {
      li.setAttribute('aria-disabled', item.disabled);
      if (item.disabled) {
        li.classList.add('none-select');
      } else {
        li.classList.remove('none-select');
      }
      li.disabled = item.disabled;
    }

    var span = document.createElement('span');
    navigator.mozL10n.setAttributes(span, item.id, item.args);
    li.appendChild(span);
    container.appendChild(li);
  };

  return {
    show: function _showSettingsList(config) {
      return new Promise((resolve) => {
        var promise = _init(config);
        promise && promise.then(() => {
          _showList();
          resolve();
        });
      });
    }
  };
});

/* global TelephonySettingHelper */
/**
 * The module loads scripts used by the root panel. In the future these scripts
 * must be converted to AMD modules. Implementation details please refer to
 * {@link Root}.
 *
 * @module root/root
 */
define('panels/root/root',['require'],function(require) {
  

  /**
   * @alias module:root/root
   * @class Root
   * @requires module:shared/lazy_loader
   * @returns {Root}
   */
  function Root() {}

  Root.prototype = {
    _loadScripts: function root_loadScripts() {
      /**
       * Enable or disable the menu items related to the ICC card
       * relying on the card and radio state.
       */
      LazyLoader.load([
        'js/firefox_accounts/menu_loader.js',
        'js/telephony_settings.js',
        'js/telephony_items_handler.js'
      ], function() {
        TelephonySettingHelper
          .init()
          .then(function telephonySettingInitDone() {
            window.dispatchEvent(new CustomEvent('telephony-settings-loaded'));
          });
      });
    },

    init: function root_init() {
      // Load the necessary scripts after the UI update.
      setTimeout(this._loadScripts);
      RootManager.init();
    }
  };

  return function ctor_root() {
    return new Root();
  };
});

/**
 * This module is used to control the background stuff when users
 * toggle on/off airplane mode checkbox.
 *
 * @module panels/root/airplane_mode_item
 */
/* global DsdsSettings */
define('panels/root/airplane_mode_item',['require','shared/airplane_mode_helper','shared/settings_listener'],function(require) {
  
  var AirplaneModeHelper = require('shared/airplane_mode_helper');
  var SettingsListener = require('shared/settings_listener');
  var _currentSettingsValue = false;

  /**
   * @alias module:panels/root/airplane_mode_item
   * @class AirplaneModeItem
   * @param {HTMLElement} element the checkbox for airplane mode
   * @returns {AirplaneModeItem}
   */
  function AirplaneModeItem(elements) {
    this._itemEnabled = false;
    this._menuItem = elements.airplaneModeMenuItem;
    this._select = elements.airplaneModeSelect;
    this.init();
    this._boundAPMStateChange = this._onAPMStateChange.bind(this);
  }

  AirplaneModeItem.prototype = {
    /**
     * The value indicates whether the module is responding.
     *
     * @access public
     * @memberOf AirplaneModeItem.prototype
     * @type {Boolean}
     */
    set enabled(value) {
      if (this._itemEnabled === value) {
        return;
      } else {
        this._itemEnabled = value;
        if (this._itemEnabled) {
          AirplaneModeHelper.addEventListener('statechange',
            this._boundAPMStateChange);
        } else {
          AirplaneModeHelper.removeEventListener('statechange',
            this._boundAPMStateChange);
        }
      }
    },

    /**
     * The value indicates whether the module is responding.
     *
     * @access public
     * @memberOf AirplaneModeItem.prototype
     * @type {Boolean}
     */
    get enabled() {
      return this._itemEnabled;
    },

    /**
     * This function is used to reflect current status of APM to checkbox
     *
     * @access private
     * @memberOf AirplaneModeItem.prototype
     * @param {String} status current status of APM
     * @type {Function}
     */
    _onAPMStateChange: function ami_onAPMStateChange(status) {
      if (status === 'enabled' || status === 'disabled') {
        this._menuItem.classList.remove('disabled');
      } else {
        this._menuItem.classList.add('disabled');
      }
    },

    _onChangeAirplaneModeMenu: function ami_onChangeAirplaneModeMenu(status) {
      var enabled =
        (status === 'enabled' || status === 'enabling') ? true : false;
      this._menuItem.setAttribute('aria-disabled', enabled);

      if (status === 'enabled' || status === 'disabled') {
        this._menuItem.removeAttribute('aria-disabled');
        this._menuItem.classList.remove('none-select');
      } else {
        this._menuItem.setAttribute('aria-disabled', true);
        this._menuItem.classList.add('none-select');
      }
      TelephonyItemsHandler.handleItems(status);
      if (Settings.currentPanel) {
        let panel = document.getElementById(Settings.currentPanel.substring(1));
        ListFocusHelper.updateSoftkey(panel);
      }
    },

    _setAPMStatus: function ami_setAPMStatus(evt) {
      var enabled = (evt.target.value === 'true') || false;
      if (_currentSettingsValue === enabled) {
        return;
      }
      showToast('changessaved');
      window.dispatchEvent(new CustomEvent('airplaneModeChange', {
        detail: {
          status: enabled ? 'enabling': 'disabling'
        }
      }));
    },

    /**
     * Initialize function
     *
     * @access public
     * @memberOf AirplaneModeItem.prototype
     * @type {Function}
     */
    init: function ami_init() {
      var self = this;

      AirplaneModeHelper.ready(function() {
        // initial status
        var status = AirplaneModeHelper.getStatus();
        var enabled = (status === 'enabled') ? true : false;
        this._menuItem.classList.remove('disabled');
      }.bind(this));

      // initial Geolocation settings observer
      SettingsListener.observe('geolocation.enabled', false, value => {
        var geoDesc = document.getElementById('geolocation-desc');
        geoDesc.setAttribute('data-l10n-id', value ? 'on' : 'off');
      });

      SettingsListener.observe('airplaneMode.enabled', false, value => {
        this._select.hidden = false;
        _currentSettingsValue = value;
      });

      SettingsListener.observe('airplaneMode.status', false,
        this._onChangeAirplaneModeMenu.bind(this));

      window.addEventListener('airplaneModeChange', e => {
        this._onChangeAirplaneModeMenu(e.detail.status);
      });

      this._select.addEventListener('blur', this._setAPMStatus);
    }
  };

  return function ctor_airplane_mode_item(elements) {
    return new AirplaneModeItem(elements);
  };
});

/* global DeviceStorageHelper, openIncompatibleSettingsDialog */
define('panels/root/antitheft_item',['require','shared/settings_listener'],function(require) {
  

  var SettingsListener = require('shared/settings_listener');

  var _settings = window.navigator.mozSettings;
  var _option = {};
  var antitheft_KEY = 'antitheft.enabled';
  var _select = document.getElementById('antitheft-mode-select');
  var _switch = document.getElementById('antitheft_mode_switch');

  function AntitheftItem(elements) {
    this._enabled = false;
    this._menuItem = elements.antitheftMenuItem;
    this._select = elements.antitheftSelect;
    this.init();

    LazyLoader.load(['/shared/js/fxa_iac_client.js'],
      function fxa_panel_loaded() {
        FxAccountsIACHelper.getAccounts(onGetAccountsSuccess,
          onGetAccountsFailed);
        NavigationMap.refresh();
      }
    );
  }

  function onGetAccountsSuccess(e) {
    var menuItem = document.getElementById('antitheft_mode_switch');
    var note1 = document.getElementById('menuItem-antitheft-note1');
    var note2 = document.getElementById('menuItem-antitheft-note2');

    if (!e) {
      menuItem.setAttribute('aria-disabled', true);
      menuItem.classList.add('none-select');
      note1.classList.add('hidden');
      note2.classList.add('hidden');
    } else {
      menuItem.removeAttribute('aria-disabled');
      menuItem.classList.remove('none-select');
      note1.classList.remove('hidden');
      note2.classList.remove('hidden');
    }
  }

  function onGetAccountsFailed(e) {
    var menuItem = document.getElementById('antitheft_mode_switch');
    var note1 = document.getElementById('menuItem-antitheft-note1');
    var note2 = document.getElementById('menuItem-antitheft-note2');
    menuItem.removeAttribute('aria-disabled');
    menuItem.classList.remove('none-select');
    note1.classList.remove('hidden');
    note2.classList.remove('hidden');
  }

  function _setSettingValue(enabled) {
    var lock = _settings.createLock();
    _option[antitheft_KEY] = enabled;
    lock.set(_option);
  }

  AntitheftItem.prototype = {
    _setAntitheftStatus: function antitheft_setAntitheftStatus(evt) {
      var enabled = (evt.target.value === 'true') || false;
      if (!navigator.onLine) {
        showToast('fxa-no-internet-connection');
        _select.value = !enabled;

        return;
      }
      if (!enabled) {
        _setSettingValue(true);
        FxAccountsIACHelper.getAccounts(function onGetAccounts(accts) {
          if (!accts) {
            _select.value = true;
            return;
          }
          var account = _getValidAccount(accts);
          FxAccountsIACHelper.checkPassword(account, 'DisableAntitheft',
            function (data) {
            if (data && data.result === 'success') {
              _setSettingValue(enabled);
              showToast('changessaved');
            } else {
              _select.value = true;
            }
          }, function () { });
        }, function () { });
      } else {
        showToast('changessaved');
        _setSettingValue(true);
      }
    },

    _onSwitchClick: function(e) {
      if (_isOffline()) {
        new MozActivity({name: 'offline-dialog'});
      }
    },

    init: function antitheft_init() {
      this._select.addEventListener('change', this._setAntitheftStatus);
      SettingsListener.observe('antitheft.enabled', false, (enabled) => {
        _select.value = enabled;
      });
      _switch.addEventListener('click', this._onSwitchClick);
    }
  };

  return function ctor_antitheft_item(elements) {
    return new AntitheftItem(elements);
  };

});

/**
 * The moudle supports displaying nfc toggle on an element.
 *
 * @module panels/root/nfc_item
 */
define('panels/root/nfc_item',['require','shared/settings_listener'],function(require) {
  

  let SettingsListener = require('shared/settings_listener');
  let _currentSettingsValue = false;

  /**
   * @alias module:panels/root/nfc_item
   * @class NFCItem
   * @param {Object} elements
   * @param {HTMLElement} elements.nfcMenuItem
   * @param {HTMLElement} elements.nfcSelect
   * @returns {NFCItem}
   */
  function NFCItem(elements) {
    if (!navigator.mozNfc) {
      return;
    }

    // FIH: hide NFC
    elements.nfcMenuItem.hidden = true;
    this._menuItem = elements.nfcMenuItem;
    this._select = elements.nfcSelect;
    this._select.hidden = true;
    SettingsListener.observe('nfc.enabled', false, value => {
      this._select.hidden = false;
      _currentSettingsValue = value;
    });

    SettingsListener.observe('nfc.status', undefined,
                             (status) => this._onNfcStatusChanged(status));

    this._select.addEventListener('blur', this._setNFCStatus);
  }

  NFCItem.prototype = {
    // When the NFC is changing, we should disable the item.
    _onNfcStatusChanged: function ni_onNfcStatusChanged(status) {
      if (status === 'enabling' || status === 'disabling') {
        this._menuItem.setAttribute('aria-disabled', true);
      } else if (status === 'enabled' || status === 'disabled') {
        this._menuItem.setAttribute('aria-disabled', false);
      }
    },

    _setNFCStatus: function ami_setNFCStatus(evt) {
      let enabled = (evt.target.value === 'true') || false;
      if (_currentSettingsValue === enabled) {
        return;
      }
      showToast('changessaved');
    },
  };

  return function ctor_nfcItem(elements) {
    return new NFCItem(elements);
  };
});

/* global SettingsSoftkey */

define('panels/root/panel',['require','modules/settings_list','shared/mobile_operator','modules/settings_service','modules/settings_panel','panels/root/root','panels/root/airplane_mode_item','panels/root/antitheft_item','panels/root/nfc_item','dsds_settings'],function(require) {
  

  var SettingsList = require('modules/settings_list');
  var MobileOperator = require('shared/mobile_operator');
  var SettingsService = require('modules/settings_service');
  var SettingsPanel = require('modules/settings_panel');
  var Root = require('panels/root/root');
  var AirplaneModeItem = require('panels/root/airplane_mode_item');
  var AntitheftItem = require('panels/root/antitheft_item');
  var NFCItem = require('panels/root/nfc_item');
  var DsdsSettings = require('dsds_settings');

  const TELEPHONY_ITEMS = [
    'call-settings',
    'cell-broadcast-entry',
    'volte-settings'
  ];

  let DS_TELEPHONY_ITEMS = TELEPHONY_ITEMS;

  const PANEL_MAPPING = {
    'call-settings': 'call',
    'cell-broadcast-entry': 'cell-broadcast-message',
    'volte-settings' : 'volte-vowifi'
  };

  const DEFAULT_MEDIA_KEY = 'device.storage.writable.name';
  const SERVICE_ID_KEY = 'ril.data.defaultServiceId';

  var queryRootForLowPriorityItems = function(panel) {
    // This is a map from the module name to the object taken
    // by the constructor of the module.
    var storageDialog = document.querySelector('.turn-on-ums-dialog');
    return {
      'BluetoothItem': panel.querySelector('.bluetooth-desc'),
      'BatteryItem': panel.querySelector('.battery-desc'),
      'StorageUSBItem': {
        mediaStorageDesc: panel.querySelector('.media-storage-desc'),
        mediaStorageSDDesc: panel.querySelector('.media-storageSD-desc'),
        systemStorageDesc: panel.querySelector('.system-storage-desc'),
        usbEnabledCheckBox: panel.querySelector('.usb-switch'),
        usbStorage: panel.querySelector('#menuItem-enableStorage'),
        usbEnabledInfoBlock: panel.querySelector('.usb-desc'),
        umsWarningDialog: storageDialog,
        umsConfirmButton: storageDialog.querySelector('.ums-confirm-option'),
        umsCancelButton: storageDialog.querySelector('.ums-cancel-option'),
        mediaStorageSection: panel.querySelector('.media-storage-section'),
        mediaStorageSDHeader: panel.querySelector('#media-storageSD-header'),
        mediaStorageSDUl: panel.querySelector('#media-storageSD-ul'),
        mediaStorageSDSection: panel.querySelector('.media-storageSD-section')
      },
      'StorageAppItem': panel.querySelector('.application-storage-desc'),
      'WifiItem': panel.querySelector('#wifi-desc')
    };
  };

  return function ctor_root_panel() {
    var root;
    var airplaneModeItem;
    var nfcItem;
    var antitheftItem;

    var lowPriorityRoots = null;
    var initLowPriorityItemsPromise = null;
    var simPickerConfig = {};
    var _mobileConnections = window.navigator.mozMobileConnections;
    var _currentCapability = null;
    let data = null;
    let mAccounts = null;
    let otherAccountListElements;

    var initLowPriorityItems = function(rootElements) {
      if (!initLowPriorityItemsPromise) {
        initLowPriorityItemsPromise = new Promise(function(resolve) {
          require(['panels/root/low_priority_items'], resolve);
        }).then(function(itemCtors) {
          var result = {};
          Object.keys(rootElements).forEach(function(name) {
            var itemCtor = itemCtors[name];
            if (itemCtor) {
              result[name] = itemCtor(rootElements[name]);
            }
          });
          return result;
        });
      }
      return initLowPriorityItemsPromise;
    };

    function _handleClickEvent(evt) {
      if (evt.key === 'Enter') {
        var disabled = evt.target.getAttribute('aria-disabled');
        var id = evt.target.id;
        if (!disabled) {
          AirplaneModeHelper.ready(function() {
            var imsCapability = _getImsHandlerCapability();
            var status = AirplaneModeHelper.getStatus();
            if ((imsCapability === 'voice-over-wifi' ||
              imsCapability === 'video-over-wifi') &&
              status === 'enabled') {
              var request =
                navigator.mozSettings.createLock().get(SERVICE_ID_KEY);
              request.onsuccess = function onSuccessHandler() {
                var serviceId = request.result[SERVICE_ID_KEY];
                DsdsSettings.setIccCardIndexForCallSettings(serviceId);
                DsdsSettings.setIccCardIndexForCellAndDataSettings(serviceId);
                DsdsSettings.setIccCardIndexForVolteSettings(serviceId);
                SettingsService.navigate(PANEL_MAPPING[id]);
              };
            } else {
              _showDualCardsMenu(PANEL_MAPPING[id]);
            }
          });
        }
      }
    }

    function _keyDownHandle(evt) {
      if (evt.key === 'Enter' &&
        !document.getElementById('media-location-select').disabled) {
        _showDialog();
      }
    }

    function _showDialog() {
      var dialogConfig = {
        title: {
          id: 'confirmation',
          args: {}
        },
        body: {
          id: 'change-default-media-location-confirmation',
          args: {}
        },
        cancel: {
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          callback: function() {}
        },
        confirm: {
          name: 'Change',
          l10nId: 'change',
          priority: 3,
          callback: function() {
            var select = document.getElementById('media-location-select');
            select.hidden = false;
            select.focus();
            select.hidden = true;
          }
        },
      };
      var dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('app-confirmation-dialog'));
    }

    function _addShowMenuEvent() {
      if (DsdsSettings.getNumberOfIccSlots() > 1) {
        DS_TELEPHONY_ITEMS.forEach((id) => {
          var item = document.getElementById(id);
          item.addEventListener('keydown', _handleClickEvent);
        });
      }
    }

    function _removeShowMenuEvent() {
      if (DsdsSettings.getNumberOfIccSlots() > 1) {
        DS_TELEPHONY_ITEMS.forEach((id) => {
          var item = document.getElementById(id);
          item.removeEventListener('keydown', _handleClickEvent);
        });
      }
    }

    function _showDualCardsMenu(panel) {
      simPickerConfig = {
        title: {id: 'select', args: {}},
        items: []
      };

      simPickerConfig.accept = {
        l10nId: 'select',
        callback: function(index) {
          // To prevent the dual cards menu displaying twice
          _removeShowMenuEvent();
          DsdsSettings.setIccCardIndexForCallSettings(index);
          if (panel === 'volte-vowifi') {
            DsdsSettings.setIccCardIndexForVolteSettings(index);
          }
          SettingsService.navigate(panel);
        }
      };
      SettingsList.show(simPickerConfig);
    }

    function _updateStorageItem(panel) {
      var defaultMeadiaLocation =
        panel.querySelector('.default-media-location');
      var meadiaStorageItem = panel.querySelector('.media-storage-section');

      if (navigator.getDeviceStorages('sdcard').length > 1) {
        navigator.getDeviceStorages('sdcard')[1].available().then((value) => {
          DeviceFeature.setLocalStorageItem('sdCardStatus', value);
          if (value === 'available') {
            var mediaHeader = document.getElementById('media-storageSD-header');
            var mediaUl = document.getElementById('media-storageSD-ul');
            mediaHeader.classList.remove('hidden');
            mediaUl.classList.remove('hidden');
            NavigationMap.refresh();

            defaultMeadiaLocation.addEventListener('keydown', _keyDownHandle);
            meadiaStorageItem.addEventListener('keydown', function(evt) {
              if (evt.key === 'Enter') {
                SettingsService.navigate('mediaStorageDesc', {type: 'sdcard'} );
              }
            });
            var meadiaStorageSDItem =
              panel.querySelector('.media-storageSD-section');
            meadiaStorageSDItem.addEventListener('keydown', function(evt) {
              if (evt.key === 'Enter') {
                SettingsService.navigate('mediaStorageDesc', {type: 'sdcard1'} );
              }
            });
          } else {
            defaultMeadiaLocation.classList.add('none-select');
            defaultMeadiaLocation.setAttribute('aria-disabled', true);
            meadiaStorageItem.addEventListener('keydown', function(evt) {
              if (evt.key === 'Enter') {
                SettingsService.navigate('mediaStorageDesc', {type: 'sdcard'} );
              }
            });
          }
        });
      } else {
        defaultMeadiaLocation.classList.add('none-select');
        defaultMeadiaLocation.setAttribute('aria-disabled', true);
        meadiaStorageItem.addEventListener('keydown', function(evt) {
          if (evt.key === 'Enter') {
            SettingsService.navigate('mediaStorageDesc', {type: 'sdcard'} );
          }
        });
      }

      navigator.mozSettings.createLock().get(DEFAULT_MEDIA_KEY).then(
        (result) => {
        _updateMediaLocationDesc(result[DEFAULT_MEDIA_KEY]);
        }
      );

      navigator.mozSettings.addObserver(DEFAULT_MEDIA_KEY, (event) => {
        _updateMediaLocationDesc(event.settingValue);
        showToast('media-storage-changed');
      });
    }

    function _updateMediaLocationDesc(value) {
      if (value === 'sdcard') {
        document.getElementById('default-media-location-desc').
        setAttribute('data-l10n-id', 'short-storage-name-internal');
      } else {
        document.getElementById('default-media-location-desc').
        setAttribute('data-l10n-id', 'short-storage-name-external-0');
      }
    }

    function _getSetting(settingKey) {
      return new Promise(function (resolve, reject) {
        navigator.mozSettings.createLock().get(settingKey).then(
          (result) => {
            resolve(result[settingKey]);
          });
      });
    }

    function _getImsHandlerCapability() {
      var imsCapability = null;
      var _imsHandler = null;
      if (!_mobileConnections) {
        return null;
      }
      for (var i = 0; i < _mobileConnections.length; i++) {
        _imsHandler = _mobileConnections[i].imsHandler;
        if (_imsHandler) {
          imsCapability = _imsHandler.capability || imsCapability;
        }
      }
      return imsCapability;
    }

    function _updateCallSettings(imsCapability) {
      if (imsCapability === 'voice-over-wifi' ||
        imsCapability === 'video-over-wifi') {
        var item = document.getElementById('call-settings');
        var desc = document.getElementById('call-desc');
        var hrefItem = item.querySelector('a');

        item.removeAttribute('aria-disabled');
        item.classList.remove('none-select');
        desc.removeAttribute('data-l10n-id');
        desc.textContent = '';
      } else {
        AirplaneModeHelper.ready(function() {
          var status = AirplaneModeHelper.getStatus();
          if (status === 'enabled') {
            var item = document.getElementById('call-settings');
            var hrefItem = item.querySelector('a');
            hrefItem.removeAttribute('href');
            item.setAttribute('aria-disabled', true);
            item.classList.add('none-select');
          }
        });
      }
    }

    function _showAddAccountList(evt) {
      if (evt.key === 'Enter') {
       SettingsService.navigate('add-account-list');
      }
    }

    function newListItem(account, callback) {
      let name = document.createElement('span');
      name.textContent = account.accountId;
      name.classList.add('full-string');

      let a = document.createElement('a');
      a.appendChild(name);
      a.classList.add('menu-item');

      // create list item
      let li = document.createElement('li');
      li.appendChild(a);

      // bind connection callback
      li.onclick = function () {
        SettingsService.navigate('add-account-settings', {
          account : account
        });
      };
      return li;
    }

    function clear() {
      let list = document.querySelector('#root .other-accounts');
      let operatorItems = list.querySelectorAll('li:not(.add-account-button)');
      let len = operatorItems.length;

      for (let i = len - 1; i >= 0; i--) {
        list.removeChild(operatorItems[i]);
      }
      window.dispatchEvent(new CustomEvent('refresh'));
    }

    function _initAccountsDisplay() {
      let addButtonItem = document.querySelector('#root .add-account-button');
      let list = document.querySelector('#root .other-accounts');
      navigator.accountManager.getAccounts().then((accounts) => {
        clear();
        for (let account of accounts) {
          debugInfo('getAccounts: ' + JSON.stringify(account));
          let listItem = newListItem(account);
          list.insertBefore(listItem, addButtonItem);
        }
        debugInfo('getAccounts resolved: length = ' + accounts.length);
        // Assign HERE
        mAccounts = accounts;
        NavigationMap.refresh();
        otherAccountListElements = list.querySelectorAll('li');
        ListFocusHelper.addEventListener(otherAccountListElements);
      });
    }

    function _updateAccountsDisplay() {
      let addButtonItem = document.querySelector('#root .add-account-button');
      let list = document.querySelector('#root .other-accounts');
      if (data && data.action === 'onlogin') {
        if (!mAccounts.length) {
          debugInfo('login - ' + JSON.stringify(data));
          let listItem = newListItem(data);
          list.insertBefore(listItem, addButtonItem);
          let newAccount = {
            accountId : data.accountId,
            authenticatorId: data.authenticatorId
          };
          mAccounts.push(newAccount);
        } else {
          for (let account of mAccounts) {
            if (account.accountId !== data.accountId) {
              debugInfo('login - ' + JSON.stringify(data));
              let listItem = newListItem(data);
              list.insertBefore(listItem, addButtonItem);
              let newAccount = {
                accountId : data.accountId,
                authenticatorId: data.authenticatorId
              };
              mAccounts.push(newAccount);
              break;
            }
          }
        }
      } else if (data && data.action === 'onlogout') {
        let operatorItems = list.querySelectorAll('li:not(.add-account-button)');
        let len = operatorItems.length;
        let i = 0;
        for (let account of mAccounts) {
          debugInfo('get - ' + JSON.stringify(account));
          if (account.accountId === data.accountId) {
            debugInfo('logout - ' + JSON.stringify(account));
            list.removeChild(operatorItems[i]);
            mAccounts.splice(i, 1);
            break;
          }
          i++;
        }
      }
      debugInfo('_updateAccountsDisplay(): ' + JSON.stringify(mAccounts));
      NavigationMap.refresh();
      ListFocusHelper.removeEventListener(otherAccountListElements);
      otherAccountListElements = list.querySelectorAll('li');
      ListFocusHelper.addEventListener(otherAccountListElements);
    }

    return SettingsPanel({
      onInit: function rp_onInit(panel) {
        root = Root();
        root.init();

        nfcItem = NFCItem({
          nfcMenuItem: panel.querySelector('#nfc-settings'),
          nfcSelect: panel.querySelector('#nfc-select')
        });

        airplaneModeItem = AirplaneModeItem({
          airplaneModeMenuItem: panel.querySelector('#airplane_mode_switch'),
          airplaneModeSelect: panel.querySelector('#airplane-mode-select')
        });

        if (navigator.mozId) {
          antitheftItem = AntitheftItem({
            antitheftMenuItem: panel.querySelector('#antitheft_mode_switch'),
            antitheftSelect: panel.querySelector('#antitheft-mode-select')
          });
        }

        var cleanUpButton = panel.querySelector('.clean-up');
        cleanUpButton.addEventListener('click', function() {
          SettingsService.navigate('applicationStorage');
        });

        // Task5108059-chengyanzhang@t2mobile.com-for disable cb in settings-begin
        var simmcc;
        var connections = window.navigator.mozMobileConnections || [navigator.mozMobileConnection];
        navigator.mozSettings.createLock().get('def.enable.cellbroadcast').then((result) => {
          let isEnableCellBroadcast = result['def.enable.cellbroadcast'];
          console.log('isEnableCellBroadcast===>' + isEnableCellBroadcast);
          //add mcc judge for show 4G Calling in UK
          for (var i = 0; i < connections.length; ++i) {
            var conn = connections[i];
            if (conn && conn.voice && conn.voice.network && conn.voice.connected) {
              // we have connection available, so we use it
              simmcc = conn.voice.network.mcc;
              if(simmcc=="234"||simmcc=="235"){
                document.getElementById('4gcalling').innerHTML="4G Calling";
                document.getElementById('next_4gcalling').innerHTML="4G Calling";
              }
            }
          }
          if (isEnableCellBroadcast!== undefined && !isEnableCellBroadcast) {
            var emergencyAlert = panel.querySelector('#emergency-alert-menu');
            if (emergencyAlert != undefined && emergencyAlert != null) {
              // bug1825-chengyan.zhang@tcl.com-begin
              // emergencyAlert.setAttribute('hidden', true);
              emergencyAlert.classList.add('hidden');
              emergencyAlert.classList.remove('navigable');
              // bug1825-chengyan.zhang@tcl.com-end
            }
            /* << [BTS-2530]: BDC kanxj add to hide cell broadcast menu when cb diabled */
            var cellBroadcast = panel.querySelector('#cell-broadcast-entry');
            if (cellBroadcast != undefined && cellBroadcast != null) {
              cellBroadcast.classList.add('hidden');
              cellBroadcast.classList.remove('navigable');
            }
            /* >> [BTS-2530] */
          }
       });
       // Task5108059-chengyanzhang@t2mobile.com-for disable cb in settings-end

        var idleObserver = {
          time: 3,
          onidle: function() {
            navigator.removeIdleObserver(idleObserver);
            lowPriorityRoots = queryRootForLowPriorityItems(panel);
            initLowPriorityItems(lowPriorityRoots).then(function(items) {
              Object.keys(items).forEach((key) => items[key].enabled = true);
            });
            addListenerForCustomization(ROOT_SETTINGS_UI_LIST);
            _initAccountsDisplay();
            let addAccountButton = document.querySelector('.add-account-button');
            addAccountButton.addEventListener('keydown', _showAddAccountList);
            navigator.accountManager.onchanged = function (event) {
              data = event.detail;
              debugInfo('RECEIVED onchanged event data = ' + JSON.stringify(data));
              if (data.action === 'onlogin' || data.action === 'onlogout') {
                _updateAccountsDisplay();
              }
            };
          }
        };
        navigator.addIdleObserver(idleObserver);
        this.softkeyParams = {
          menuClassName: 'menu-button',
          header: { l10nId:'message' },
          items: [{
            name: 'Select',
            l10nId: 'select',
            priority: 2,
            method: function() {}
          }]
        };

        _updateStorageItem(panel);

        // If not support Dual LTE,remove 'volte-settings' menu from DS_TELEPHONY_ITEMS
        DeviceFeature.ready(() => {
          DS_TELEPHONY_ITEMS = TELEPHONY_ITEMS;
          let isSupportDualLte = DeviceFeature.getValue('dual-Lte');
          if (isSupportDualLte !== 'true') {
            let index = DS_TELEPHONY_ITEMS.indexOf('volte-settings');
            if (index > -1) {
              DS_TELEPHONY_ITEMS.splice(index, 1);
            }
          }
        });

        DeviceFeature.ready(() => {
          initUIForItem([
            'wifi',
            'bluetooth',
            'geolocation',
            'volte',
            'hotspot'
          ]);
          navigator.mozSettings.addObserver(SERVICE_ID_KEY, () => {
            //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. begin
            updateVoLteVoWifiDisplay(SettingsDBCache.cache);
            //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. end
            updateHotspotDisplay(SettingsDBCache.cache);
          });
        });

        var listElements = document.querySelectorAll('.root li');
        ListFocusHelper.addEventListener(listElements);
      },
      onShow: function rp_onShow(panel) {
        LazyLoader.load(['shared/js/airplane_mode_helper.js'], () => {
          // This event listener will be removed
          //   after the click event callback is processing on.
          _addShowMenuEvent();
        });

        if (initLowPriorityItemsPromise) {
          initLowPriorityItemsPromise.then(function(items) {
            Object.keys(items).forEach((key) => {
              items[key].enabled = true;
            });
          });
        }

        var focusedLi =
          document.querySelector('#root div.content:not(.hidden) li.focus');
        if ((focusedLi !== null) && !NavigationMap.selectOptionShow) {
          focusedLi.focus();
        }
        SettingsSoftkey.init(this.softkeyParams);
        if (focusedLi && focusedLi.classList.contains('none-select')) {
          SettingsSoftkey.hide();
        } else {
          SettingsSoftkey.show();
        }
      },
      onHide: function rp_onHide() {
        if (initLowPriorityItemsPromise) {
          initLowPriorityItemsPromise.then(function(items) {
            Object.keys(items).forEach((key) => items[key].enabled = false);
          });
        }
      },
      onBeforeShow: function rp_onBeforeShow() {
        _currentCapability = _getImsHandlerCapability();
        _updateCallSettings(_currentCapability);
      }
    });
  };
});
