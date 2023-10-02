/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */


/**
 * Singleton object that helps to enable/disable and to show card state
 * information for telephony-related items from the root in the setting app.
 */
var TelephonyItemsHandler = (function(window, document, undefined) {
  var DATA_TYPE_SETTING = 'operatorResources.data.icon';

  var dataTypeMapping = {
    'lte' : '4G LTE',
    'ehrpd': '4G CDMA',
    'hspa+': '3.5G HSPA+',
    'hsdpa': '3.5G HSDPA',
    'hsupa': '3.5G HSDPA',
    'hspa' : '3.5G HSDPA',
    'evdo0': '3G CDMA',
    'evdoa': '3G CDMA',
    'evdob': '3G CDMA',
    '1xrtt': '2G CDMA',
    'umts' : '3G UMTS',
    'edge' : '2G EDGE',
    'is95a': '2G CDMA',
    'is95b': '2G CDMA',
    'gprs' : '2G GPRS'
  };

  var HREF_MAPPING = {
    'call-settings': '#call',
    'simCardManager-settings': '#sim-manager',
    'data-connectivity': '#carrier',
    'volte-settings': '#volte-vowifi',
    'internet-sharing': '#hotspot',
    'wireless-emergency-alert': '#emergency-alert',
    'cell-broadcast-entry': '#cell-broadcast-message'
  };

  function tih_updateDataTypeMapping() {
    var req;
    try {
      req = navigator.mozSettings.createLock().get(DATA_TYPE_SETTING) || {};
      req.onsuccess = function() {
        var dataTypeValues = req.result[DATA_TYPE_SETTING] || {};
        for (var key in dataTypeValues) {
          if (dataTypeMapping[key]) {
            dataTypeMapping[key] = dataTypeValues[key];
          }
        }
      };
      req.onerror = function() {
        console.error('Error loading ' + DATA_TYPE_SETTING + ' settings. ' +
                      req.error && req.error.name);
      };
    } catch (e) {
      console.error('Error loading ' + DATA_TYPE_SETTING + ' settings. ' + e);
    }
  };

  let  _iccManager = window.navigator.mozIccManager;
  let  _mobileConnections = window.navigator.mozMobileConnections;
  var _;
  var dataEnabled;

  /**
   * Init function.
   */
  function tih_init() {
    if (!_mobileConnections) {
      // hide telephony panels
      let elements = [
        'call-settings',
        'data-connectivity',
        'simSecurity-settings',
        'simCardManager-settings',
        'volte-settings',
        'cell-broadcast-entry'
      ];
      elements.forEach((id) => {
        document.getElementById(id).hidden = true;
      });
      return;
    }
    if (!_iccManager) {
      return;
    }
    SettingsListener.observe('ril.data.enabled', false, function (enabled) {
      dataEnabled = enabled;
      tih_checkDataState();
    });
  }

  function tih_handleAirplaneMode(status, currentCapability, validCardCount) {
    let itemIds = [];
    let airplaneEnabled = status !== 'disabled' || false;
    let capabilityEnabled =
      currentCapability === 'voice-over-wifi' ||
      currentCapability === 'video-over-wifi';
    let simDisabled = (validCardCount === 0 || false);
    let isSupportDualLte =
      DeviceFeature.getValue('dual-Lte') === 'true';

    if (airplaneEnabled) {
      itemIds = [
        'data-connectivity',
        'simCardManager-settings'
      ];
      tih_disableItems(true, itemIds);

      itemIds = [
        'call-settings',
        'wireless-emergency-alert',
        'cell-broadcast-entry'
      ];
      tih_disableItems(!capabilityEnabled, itemIds);

      itemIds = [
        'volte-settings'
      ];
      if (validCardCount && isSupportDualLte) {
        tih_removeItemHref(itemIds);
      } else {
        tih_disableItems(simDisabled, itemIds);
      }
    } else {
      itemIds = [
        'wireless-emergency-alert'
      ];
      tih_disableItems(false, itemIds);

      if (_mobileConnections.length === 1) {
        // Single ICC card device.
        itemIds = [
          'call-settings',
          'data-connectivity',
          'volte-settings',
          'cell-broadcast-entry'
        ];

        if (simDisabled) {
          // There is no ICC card.
          tih_disableItems(true, itemIds);
          tih_showICCCardDetails(_getCardDesription('absent'));
        } else {
          let iccCard =
            _iccManager.getIccById(_mobileConnections[0].iccId);
          let cardState = iccCard.cardState;
          let isReady = (cardState === 'ready' || false);
          tih_disableItems(!isReady, itemIds);
          if (isReady) {
            tih_showICCCardDetails('');
          } else {
            tih_showICCCardDetails(_getCardDesription(cardState));
          }
        }
      } else {
        // Multi ICC card device.
        if (simDisabled) {
          itemIds = [
            'simCardManager-settings',
            'data-connectivity',
            'call-settings',
            'cell-broadcast-entry',
            'volte-settings'
          ];
          // There is no ICC cards.
          tih_disableItems(true, itemIds);
          tih_showICCCardDetails(_getCardDesription('absent'));
        } else {
          let isReady = false;
          for (let i = 0; i < _mobileConnections.length; i++) {
            let iccCard =
              _iccManager.getIccById(_mobileConnections[i].iccId);
            let cardState = iccCard ? iccCard.cardState : null;
            isReady = (cardState === 'ready' || isReady);
          }
          if (isReady) {
            // If support Dual LTE,remove Href for 'volte-settings' menu
            if (isSupportDualLte) {
              itemIds = [
                'call-settings',
                'cell-broadcast-entry',
                'volte-settings'
              ];
            } else {
              itemIds = [
                'call-settings',
                'cell-broadcast-entry'
              ];
            }

            // There is ICC card.
            tih_showICCCardDetails('');
            tih_removeItemHref(itemIds);

            if (isSupportDualLte) {
              itemIds = [
                'simCardManager-settings',
                'data-connectivity'
              ];
            } else {
              itemIds = [
                'simCardManager-settings',
                'data-connectivity',
                'volte-settings'
              ];
            }
            tih_disableItems(false, itemIds);
          } else {
            itemIds = [
              'simCardManager-settings',
              'data-connectivity',
              'call-settings',
              'cell-broadcast-entry',
              'volte-settings'
            ];
            tih_disableItems(true, itemIds);
          }
        }
      }
    }
  }

  /**
   * Enable or disable the items according the state of the ICC card and the
   * airplane mode status. It also show a short description about the ICC card
   * status and the carrier name and the data connection type.
   */
  function tih_handleItems(status) {
    let validCardCount = 0;
    let _currentCapability = null;
    let _imsHandler;
    let iccId = null;
    //let itemIds = [];
    for (var i = 0; i < _mobileConnections.length; i++) {
      _imsHandler = _mobileConnections[i].imsHandler;
      if (_imsHandler) {
        _currentCapability = _imsHandler.capability || _currentCapability;
      }
    }

    if (_mobileConnections) {
      [].forEach.call(_mobileConnections, (simcard, cardIndex) => {
        iccId = simcard.iccId;
        var icc = _iccManager.getIccById(iccId);
        if (icc !== null) {
          validCardCount++;
        }
      });
    }

    if (typeof status === 'string') {
      tih_handleAirplaneMode(status, _currentCapability, validCardCount);
    } else {
      let req = navigator.mozSettings.createLock().get('airplaneMode.status');
      req.onsuccess = (result) => {
        let status = req.result['airplaneMode.status'];
        tih_handleAirplaneMode(status, _currentCapability, validCardCount);
      };
    }
  }


  function tih_checkDataState() {
    var validCard = 0;
    if (_mobileConnections) {
      [].forEach.call(_mobileConnections, (simcard, cardIndex) => {
        var iccId = simcard.iccId;
        var icc = _iccManager.getIccById(iccId);
        if (icc !== null) {
          validCard++;
        }
      });
      var disabled = (validCard === 0 || false);
      var itemIds = [
        'internet-sharing'
      ];
      tih_disableItems(!dataEnabled || disabled , itemIds);
    }

  }

  /**
   * Show some details (card state) of the ICC card.
   *
   * @param {String} details What to show as ICC card details.
   */
  function tih_showICCCardDetails(details) {
    var itemIds = [
      'call-desc',
      'internetSharing-desc',
      'cell-broadcast-desc'
    ];

    for (var id = 0; id < itemIds.length; id++) {
      var desc = document.getElementById(itemIds[id]);
      if (!desc) {
        continue;
      }
      desc.style.fontStyle = 'italic';

      if (details !== '') {
        desc.setAttribute('data-l10n-id', details);
      } else {
        desc.removeAttribute('data-l10n-id');
        desc.textContent = '';
      }
    }
  }

  /**
   * Disable or enable a set of menu items.
   *
   * @param {Boolean} disable Flag about what to do.
   * @param {Array} itemIds Menu items id to enable/disable.
   */
  function tih_disableItems(disabled, itemIds) {
    for (var id = 0; id < itemIds.length; id++) {
      var item = document.getElementById(itemIds[id]);
      var hrefItem = item.querySelector('a');
      if (!item) {
        continue;
      }
      if (disabled) {
        hrefItem.removeAttribute('href');
        item.setAttribute('aria-disabled', true);
        item.classList.add('none-select');
      } else {
        item.removeAttribute('aria-disabled');
        item.classList.remove('none-select');
        hrefItem.setAttribute('href', HREF_MAPPING[itemIds[id]]);
      }
    }
  }

  /**
    * Remove the href link to show dual card action menu
    */
  function tih_removeItemHref(itemIds) {
    itemIds.forEach((id) => {
      var item = document.getElementById(id);
      item.removeAttribute('aria-disabled');
      item.classList.remove('none-select');
      var hrefItem = item.querySelector('a');
      hrefItem.removeAttribute('href');
    });
  }

  // Public API.
  return {
    init: tih_init,
    handleItems: function(status) {
      tih_handleItems(status);
    }
  };
})(this, document);
