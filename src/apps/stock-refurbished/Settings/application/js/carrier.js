/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

//
define(['require','shared/settings_listener','shared/settings_helper','shared/template','shared/simslot_manager','modules/settings_service'],function(require) {
  

  var SettingsListener = require('shared/settings_listener');
  var SettingsHelper = require('shared/settings_helper');
  var Template = require('shared/template');
  var SIMSlotManager = require('shared/simslot_manager');
  var SettingsService = require('modules/settings_service');
  /**
   * Singleton object that handles some cell and data settings.
   */
  var CarrierSettings = function cs_carriersettings() {
    var DATA_ROAMING_KEY = 'ril.data.roaming_enabled';
    var networkTypeMapping = {};
    var dataRoamingOberverInit = false;
    let dataRoamingItem = document.querySelector('#liItem-dataRoaming');
    let dataRoamingDescription = document.getElementById('dataRoaming-description');
    var dataRoamingDescElement = document.querySelector('small#data-roaming-desc');
    var roamingPreferenceItem = document.getElementById('operator-roaming-preference');
    var operatorHeader = document.querySelector('#carrier-operatorSettings gaia-header h1');
    let previousConnected = null;

    // BDC wangzhigang modify for Domestic data roaming menu function. begin
    var dataRoamingcustomized = false;
    // BDC wangzhigang modify for Domestic data roaming menu function. end

    var _networkTypeCategory = {
      'gprs': 'gsm',
      'edge': 'gsm',
      'umts': 'gsm',
      'hsdpa': 'gsm',
      'hsupa': 'gsm',
      'hspa': 'gsm',
      'hspa+': 'gsm',
      'lte': 'gsm',
      'gsm': 'gsm',
      'is95a': 'cdma',
      'is95b': 'cdma',
      '1xrtt': 'cdma',
      'evdo0': 'cdma',
      'evdoa': 'cdma',
      'evdob': 'cdma',
      'ehrpd': 'cdma'
    };

    var _;
    var _settings;
    var _mobileConnections;
    var _iccManager;
    var _voiceTypes;

    /** mozMobileConnection instance the panel settings rely on */
    var _mobileConnection = null;
    /** Flag */
    var _restartingDataConnection = false;

    var gOperatorNetworkList = null;
    var l10n = window.navigator.mozL10n;
    var currentNetworkType = null;
    let ratMapping = {
      '14': '4G',
      '3': '3G',
      '1': '2G',
      '2': '2G',
      '16': '2G'
    };
    let scanFlag = false;

    /**
     * Init function.
     */
    function cs_init() {
      _settings = window.navigator.mozSettings;
      _mobileConnections = window.navigator.mozMobileConnections;
      _iccManager = window.navigator.mozIccManager;
      if (!_settings || !_mobileConnections || !_iccManager) {
        return;
      }

      console.log("cs_init Enter");

      window.navigator.mozSettings.addObserver('ril.data.defaultServiceId',
        function (value) {
          for (let i = 0; i < _mobileConnections.length; i++) {
            getSupportedNetworkInfo(_mobileConnections[i], (result) => {
              cs_updateNetworkTypeSelector(result);
              cs_updateAutomaticOperatorSelection();
            });
          };
          // BDC wangzhigang modify for Domestic data roaming menu function. begin
          //update data roaming element
          console.log('[carrier] ril.data.defaultServiceId updateDataRoaming, value = ' + value.settingValue);
          cs_updateDataRoaming(value.settingValue);
          // BDC wangzhigang modify for Domestic data roaming menu function. end
        }
      );

      // BDC wangzhigang porting arg data roaming menu to bts. begin
      /*
      // init observer for data roaming
      SettingsListener.observe(DATA_ROAMING_KEY, false, function (value) {
        cs_resetDataRoamingConfiguration(value);
        if (dataRoamingOberverInit) {
          showToast('changessaved');
        } else {
          dataRoamingOberverInit = true;
        }
      });
      */
      // BDC wangzhigang porting arg data roaming menu to bts. end

      _voiceTypes = Array.prototype.map.call(_mobileConnections,
        function () {
          return null;
        });

      // Get the mozMobileConnection instace for this ICC card.
      _mobileConnection = _mobileConnections[
        DsdsSettings.getIccCardIndexForCellAndDataSettings()];
      if (!_mobileConnection) {
        return;
      }

      cs_addVoiceTypeChangeListeners();
      cs_updateNetworkTypeLimitedItemsVisibility(_mobileConnection);

      // Show carrier name.
      cs_showCarrierName();
      cs_initIccsUI();

      // Init network type selector.
      cs_initNetworkTypeSelector();
      cs_initOperatorSelector();
      cs_initRoamingPreferenceSelector();

      window.addEventListener('panelready', function (e) {
        var selector = document.getElementById('preferredNetworkType');
        var opAutoSelectOptions = document.getElementById('auto-select-options');
        selector.value = '';
        opAutoSelectOptions.value = '';
        // Get the mozMobileConnection instace for this ICC card.
        _mobileConnection = _mobileConnections[
          DsdsSettings.getIccCardIndexForCellAndDataSettings()];
        if (!_mobileConnection) {
          return;
        }

        var currentHash = e.detail.current;
        if (currentHash === '#carrier') {
          cs_updateNetworkTypeLimitedItemsVisibility(_mobileConnection);
          // Show carrier name.
          cs_showCarrierName();
          cs_initIccsUI();
          cs_updateRoamingPreferenceSelector();
          return;
        }

        if (currentHash === '#apn-settings') {
          if (DsdsSettings.getNumberOfIccSlots() > 1) {
            var apnHeader = document.querySelector('#apn-settings gaia-header h1');
            l10n.setAttributes(
              apnHeader,
              'apnSettingsWithIndex',
              { index: DsdsSettings.getIccCardIndexForCellAndDataSettings() + 1 });
            return;
          } else {
            return;
          }
        }

        if (currentHash === '#carrier-operatorSettings') {
          if (DsdsSettings.getNumberOfIccSlots() > 1) {
            l10n.setAttributes(
              operatorHeader,
              'simSettingsWithIndex',
              { index: DsdsSettings.getIccCardIndexForCellAndDataSettings() + 1 });
          }

          cs_disableAutomaticSelectionState(false);
          cs_updateAutomaticOperatorSelection();
          getSupportedNetworkInfo(_mobileConnection, function (result) {
            cs_updateNetworkTypeSelector(result);
          });
          return;
        }
        return;
      });

      // BDC wangzhigang porting arg data roaming menu to bts. begin
      cs_getDefaultServiceIdForData(function(defaultServiceID) {
          cs_updateDataRoaming(defaultServiceID);
      });
      // BDC wangzhigang porting arg data roaming menu to bts. end
    }

    // BDC wangzhigang modify for Domestic data roaming menu function. begin
    function cs_updateDataRoaming(defaultServiceID) {
        let matchInfo = {
        "clientId": "0"
        };
        matchInfo.clientId = defaultServiceID;
        console.log('[carrier] updateDataRoaming defaultServiceID = ' + defaultServiceID);
        // Observe data roaming key according to current customization value
        window.navigator.customization.getValueForCarrier(matchInfo, 'stz.roaming.domestic.enable').then((result) => {
            dataRoamingcustomized = (result === 'undefined') ? false : result;
            console.log('[carrier] read data roaming customized = ' + dataRoamingcustomized + ' defaultServiceID = ' + defaultServiceID);
            window.navigator.mozSettings.createLock().set({'data.roaming.domestic.customized' : dataRoamingcustomized});

            document.getElementById('menuItem-dataRoaming').href = dataRoamingcustomized
                    ? '#data-roaming-customization' : '#data-roaming';
            DATA_ROAMING_KEY = dataRoamingcustomized
                    ? 'data.roaming.domestic_international.enabled'
                    : 'ril.data.roaming_enabled';
            //if the mozSettings not init, first to init mozSettings value
            var request = window.navigator.mozSettings.createLock().get(DATA_ROAMING_KEY);
            request.onsuccess = function() {
                var value = request.result[DATA_ROAMING_KEY];
                console.log('[carrier] read \'' + DATA_ROAMING_KEY + '\' value: ' + value);
                if (value === undefined) {
                    window.navigator.customization.getValueForCarrier(matchInfo, DATA_ROAMING_KEY).then((result) => {
                        value = (result === 'undefined') ? 0 : result;
                        console.log('[carrier] read customization \'' + DATA_ROAMING_KEY + '\' value: ' + value);
                        var set = {};
                        set[DATA_ROAMING_KEY] = value;
                        window.navigator.mozSettings.createLock().set(set);
                    });
                }
            };
            // init observer for data roaming
            SettingsListener.unobserve(DATA_ROAMING_KEY, dataRoamingConfigChange);
            SettingsListener.observe(DATA_ROAMING_KEY, 0, dataRoamingConfigChange);
        });
    }

    function dataRoamingConfigChange(changeValue) {
        console.log('[carrier] listen \'' + DATA_ROAMING_KEY + '\' value: ' + changeValue);
        cs_resetDataRoamingConfiguration(changeValue, dataRoamingcustomized);
        if (dataRoamingOberverInit) {
            var toast = {
                messageL10nId: 'changessaved',
                latency: 2000,
                useTransition: true
            };
            Toaster.showToast(toast);
        } else {
            dataRoamingOberverInit = true;
        }
    }
    // BDC wangzhigang modify for Domestic data roaming menu function. end

  //[BTS-15] BDC wangzhigang porting arg user RAT selection option. begin  
  function isNeedToUpdateOperator(mcc,mnc){
    if (!mcc || !mnc) {
      return false;
    }
    console.log("isNeedToUpdateOperator mcc = "+mcc+" ; mnc ="+mnc);
    if (mcc == '260' && mnc == '06') {
      return true;
    } else if(mcc == '260'){
        return true;
    } else{
      return false;
    }
  }

  function isNeedUse4G3G2GAutoDescription(mcc,mnc){
    if (!mcc || !mnc) {
      return false;
    }
    console.log("isNeedUse4G3G2GAutoDescription mcc = "+mcc+" ; mnc ="+mnc);
    if ((mcc == '222' && mnc == '10')
        || (mcc == '214' && mnc == '01')
        || (mcc == '234' && mnc == '15')
        || (mcc == '262' && mnc == '02')) {
      return true;
    } else{
      return false;
    }
  }

  function isNeedUse3G2GAutoDescription(mcc,mnc){
    if (!mcc || !mnc) {
      return false;
    }
    console.log("isNeedUse3G2GAutoDescription mcc = "+mcc+" ; mnc ="+mnc);
    if ((mcc == '222' && mnc == '10')
        || (mcc == '214' && mnc == '01')
        || (mcc == '234' && mnc == '15')
        || (mcc == '262' && mnc == '02')) {
      return true;
    } else{
      return false;
    }
  }

  function isNeedUse4G3G2GRecommendedDescription(mcc,mnc){
    if (!mcc || !mnc) {
      return false;
    }
    console.log("isNeedUse4G3G2GRecommendedDescription mcc = "+mcc+" ; mnc ="+mnc);
    if ((mcc == '204' && mnc == '04')
        || (mcc == '216' && mnc == '70')) {
      return true;
    } else{
      return false;
    }
  }

  function isNeedUse3G2GDescription(mcc,mnc){
    if (!mcc || !mnc) {
      return false;
    }
    console.log("isNeedUse3G2GDescription mcc = "+mcc+" ; mnc ="+mnc);
    if ((mcc == '204' && mnc == '04')
        || (mcc == '216' && mnc == '70')) {
      return true;
    } else{
      return false;
    }
  }
  //[BTS-15] BDC wangzhigang porting arg user RAT selection option. end

  // BDC wangzhigang porting arg data roaming menu to bts. begin
  // Display current roaming type according to current customization value
  // reset some params related to data roaming after we change its status
  function cs_resetDataRoamingConfiguration(value, customized) {
    var enabled = customized ? value : ((value === 0) ? false : true);

    var iccId = DsdsSettings.getIccCardIndexForCellAndDataSettings();
    _mobileConnection = _mobileConnections[iccId];
    var voiceType = _mobileConnection.voice && _mobileConnection.voice.type;
    if ((_networkTypeCategory[voiceType] === 'cdma') && enabled) {
      roamingPreferenceItem.hidden = false;
    } else {
      roamingPreferenceItem.hidden = true;
    }

    if (customized) {
      if (value === 2) {
        dataRoamingDescElement.setAttribute('data-l10n-id', 'dataRoamingInternational');
      } else if (value === 1) {
        dataRoamingDescElement.setAttribute('data-l10n-id', 'dataRoamingDomestic');
      } else if (value === 0) {
        dataRoamingDescElement.setAttribute('data-l10n-id', 'dataRoamingNotAllowed');
      }
      navigator.mozSettings.createLock().set({'ril.data.roaming.customized_value' : value});
    } else {
      if (value) {
        dataRoamingDescElement.setAttribute('data-l10n-id', 'on');
      } else {
        dataRoamingDescElement.setAttribute('data-l10n-id', 'off');
      }
    }
  }
  // Modified for task 5346471/5110457 by yingsen.zhang@t2mobile.com end

    // reset some params related to data roaming after we change its status
    /*
    function cs_resetDataRoamingConfiguration(enabled) {
      SettingsDBCache.getSettings((values) => {
        let iccId = DsdsSettings.getIccCardIndexForCellAndDataSettings();
        _mobileConnection = _mobileConnections[iccId];
        let voiceType =
          _mobileConnection.voice && _mobileConnection.voice.type;
        let dataRoamingHidden = values['data.roaming.hidden'];
        if (!dataRoamingHidden) {
          dataRoamingItem.hidden = false;
          dataRoamingDescription.hidden = false;
          if ((_networkTypeCategory[voiceType] === 'cdma') && enabled) {
            roamingPreferenceItem.hidden = false;
          } else {
            roamingPreferenceItem.hidden = true;
          }
        } else {
          dataRoamingItem.hidden = true;
          dataRoamingDescription.hidden = true;
          roamingPreferenceItem.hidden = true;
        }
        window.dispatchEvent(new CustomEvent('refresh'));

        if (enabled) {
          dataRoamingDescElement.setAttribute('data-l10n-id', 'on');
        } else {
          dataRoamingDescElement.setAttribute('data-l10n-id', 'off');
        }
      });
    }
    */
    // BDC wangzhigang porting arg data roaming menu to bts. end

    function cs_initIccsUI() {
      var isMultiSim = DsdsSettings.getNumberOfIccSlots() > 1;
      var carrierInfo = document.querySelector('#carrier .carrier-info');
      var advancedSettings =
        document.querySelector('#carrier .carrier-advancedSettings');
      var simSettings =
        document.querySelector('#carrier .carrier-settings');
      var apnSettings =
        document.querySelector('#carrier .apn-settings');
      var operatorSettingsHeader =
        document.querySelector('#carrier-operatorSettings gaia-header');

      if (isMultiSim) {
        LazyLoader.load([
          '/js/carrier_iccs.js'
        ], function () {
          IccHandlerForCarrierSettings.init();
        });
      }

      operatorSettingsHeader.dataset.href = '#carrier';
      carrierInfo.hidden = isMultiSim;
      advancedSettings.hidden = isMultiSim;
      simSettings.hidden = !isMultiSim;
      apnSettings.hidden = !isMultiSim;
    }

    /**
     * Add listeners on 'voicechange' for show/hide network type limited items.
     */
    function cs_addVoiceTypeChangeListeners() {
      Array.prototype.forEach.call(_mobileConnections, function (conn, index) {
        _voiceTypes[index] = conn.voice.type;
        conn.addEventListener('voicechange', function () {
          var voiceType = conn.voice && conn.voice.type;
          var voiceTypeChange = voiceType !== _voiceTypes[index];

          _voiceTypes[index] = voiceType;
          if (index === DsdsSettings.getIccCardIndexForCellAndDataSettings() &&
            voiceTypeChange) {
            cs_updateNetworkTypeLimitedItemsVisibility(conn);
          }
        });
      });
    }

    /**
     * Update the network type limited items' visibility based on the voice type.
     */
    function cs_updateNetworkTypeLimitedItemsVisibility(conn) {
      // The following features are limited to GSM types.
      var autoSelectOperatorItem = document.getElementById('operator-autoSelect');
      var availableOperatorsHeader =
        document.getElementById('availableOperatorsHeader');
      var availableOperators = document.getElementById('availableOperators');

      var voiceType = conn.voice && conn.voice.type;

      function doUpdate(mode) {
        autoSelectOperatorItem.hidden = availableOperatorsHeader.hidden =
          availableOperators.hidden = (mode !== 'gsm');
      }

      if (!voiceType) {
        getSupportedNetworkInfo(conn, function (result) {
          if (result.gsm || result.wcdma || result.lte) {
            doUpdate('gsm');
          } else {
            doUpdate('cdma');
          }
        });
      } else {
        doUpdate(_networkTypeCategory[voiceType]);
      }
    }

    /**
     * Show the carrier name in the ICC card.
     */
    function cs_showCarrierName() {
      if (DsdsSettings.getNumberOfIccSlots() > 1) {
        return;
      }
      let desc = document.getElementById('dataNetwork-desc');
      _getOperatorName(_mobileConnection, desc);
    }

    // BDC wangzhigang porting arg data roaming menu to bts. begin
    /**
     * Helper function. Get the value for the ril.data.defaultServiceId setting
     * from the setting database.
     *
     * @param {Function} callback Callback function to be called once the work is
     *                            done.
     */
    function cs_getDefaultServiceIdForData(callback) {
      var request = _settings.createLock().get('ril.data.defaultServiceId');
      request.onsuccess = function onSuccessHandler() {
        var defaultServiceId =
          parseInt(request.result['ril.data.defaultServiceId'], 10);
        if (callback) {
          callback(defaultServiceId);
        }
      };
    }
    // BDC wangzhigang porting arg data roaming menu to bts. end

    function cs_initNetworkTypeText(aNext) {
      var req;
      try {
        networkTypeMapping = {};
        req = _settings.createLock().get(NETWORK_TYPE_SETTING);
        req.onsuccess = function () {
          var networkTypeValues = req.result[NETWORK_TYPE_SETTING] || {};
          for (var key in networkTypeValues) {
            networkTypeMapping[key] = networkTypeValues[key];
          }
          aNext && aNext();
        };
        req.onerror = function () {
          console.error('Error loading ' + NETWORK_TYPE_SETTING + ' settings. ' +
          req.error && req.error.name);
          aNext && aNext();
        };
      } catch (e) {
        console.error('Error loading ' + NETWORK_TYPE_SETTING + ' settings. ' +
        e);
        aNext && aNext();
      }
    }

    /**
     * Init network type selector. Add the event listener that handles the changes
     * for the network type.
     */
    function cs_initNetworkTypeSelector() {
      if (!_mobileConnection.setPreferredNetworkType)
        return;

      var alertDialog = document.getElementById('preferredNetworkTypeAlert');
      var message = document.getElementById('preferredNetworkTypeAlertMessage');

      var preferredNetworkTypeHelper =
        SettingsHelper('ril.radio.preferredNetworkType');
      var selector = document.getElementById('preferredNetworkType');
      var opAutoSelectOptions = document.getElementById('auto-select-options');
      selector.addEventListener('blur', function evenHandler() {
        var targetIndex = DsdsSettings.getIccCardIndexForCellAndDataSettings();
        var type = selector.value;
        if (currentNetworkType !== type) {
          cs_disableAutomaticSelectionState(true);
          var request = _mobileConnection.setPreferredNetworkType(type);

          request.onsuccess = function onSuccessHandler() {
            preferredNetworkTypeHelper.get(function gotPNT(values) {
              values[targetIndex] = type;
              preferredNetworkTypeHelper.set(values);
              currentNetworkType = type;
              showToast('changessaved');
              if (opAutoSelectOptions.value === 'true') {
                gOperatorNetworkList.leave();
              } else {
                gOperatorNetworkList.scan();
              }
            });
            cs_disableAutomaticSelectionState(false);
          };
          request.onerror = function onErrorHandler() {
            console.log('setPreferredNetworkType ' + request.error.name);
            if (request.error.name === 'NotAllowedWhenNCK') {
              var checkKey = 'force.nckDialog.show';
              _settings.createLock().get(checkKey).then((result) => {
                var checkValue = result[checkKey];
                if (checkValue) {
                  SettingsService.navigate('simnck', {index: targetIndex});
                } else {
                  showToast('devicelocked');
                }
                selector.value = currentNetworkType;
              });
            }
            // XXX, we don't show error dialog now
            cs_disableAutomaticSelectionState(false);
          };
        }
      });

      window.addEventListener('keydown', evt => {
        if (!alertDialog.hidden && evt.key === 'Enter') {
          alertDialog.hidden = true;
          getSupportedNetworkInfo(_mobileConnection, result => {
            cs_updateNetworkTypeSelector(result);
            cs_updateAutomaticOperatorSelection();
          });
        }

        var opAutoSelect = document.getElementById('operator-autoSelect');
        let opAutoSelectOptions =
          document.getElementById('auto-select-options');
        if (evt.key === 'Backspace') {
          if (opAutoSelectOptions.value === 'false' && scanFlag) {
            let req = _mobileConnection.stopNetworkScan();
            req.onsuccess = function onsuccess() {
              scanFlag = false;
              window.DUMP('stopNetworkScan success');
            };
            req.onerror = function onerror() {
              scanFlag = false;
              window.DUMP('stopNetworkScan error');
            };
          }
          var mode = _mobileConnection.networkSelectionMode;
          if (mode === 'automatic') {
            gOperatorNetworkList.leave();
          }
        }

        if (opAutoSelect.classList.contains('focus')) {
          opAutoSelect.style.position = 'static';
        } else {
          opAutoSelect.style.position = 'relative';
        }
      });

      var opAutoSelect = document.getElementById('operator-autoSelect');
      opAutoSelect.addEventListener('focus', evt => {
        opAutoSelect.style.position = 'relative';
      });
    }

    /**
     * Update network type selector.
     */
    function cs_updateNetworkTypeSelector(supportedNetworkTypeResult) {
      if (!_mobileConnection.getPreferredNetworkType || !supportedNetworkTypeResult.networkTypes) {
        return;
      }

      var selector = document.getElementById('preferredNetworkType');
      // Clean up all option before updating again.
      while (selector.hasChildNodes()) {
        selector.removeChild(selector.lastChild);
      }

      var request = _mobileConnection.getPreferredNetworkType();
      request.onsuccess = function onSuccessHandler() {
        currentNetworkType = request.result;
        _addNetworkTypes(request.result);
      };
      request.onerror = function onErrorHandler() {
        console.warn('carrier: could not retrieve network type');
        // XXX, add 'lte' when we can't get preferred network types
        _addNetworkTypes('lte');
      };

      //[BTS-15] BDC wangzhigang porting arg user RAT selection option. begin
      function _addNetworkTypes(networkType) {
        var supportedNetworkTypes;
        //var request=navigator.mozSettings.createLock().get('preffered.network.type.list');
        try {
           let matchInfo = {
                  "clientId": "0"
           };
           var index = DsdsSettings.getIccCardIndexForCellAndDataSettings();
           matchInfo.clientId = index;
           // Observe data roaming key according to current customization value
           navigator.customization.getValueForCarrier(matchInfo, 'preffered.network.type.list').then((result) => {
           var prefferedNetworkTypeList = `${JSON.stringify(result)}`;

           if (prefferedNetworkTypeList === undefined
               || prefferedNetworkTypeList == 'undefined'
               || prefferedNetworkTypeList == 'null') {
             console.log("carrier.js prefferedNetworkTypeList is undefined, so set it to default 0");
             prefferedNetworkTypeList = '0';
           }

        //request.onsuccess=function onGetTypeSuccessHandler() {
        //  var prefferedNetworkTypeList = request.result['preffered.network.type.list'];
          console.log("carrier.js getPrefferedTypelist=" + prefferedNetworkTypeList
            + " networkType = " + networkType);

          switch (prefferedNetworkTypeList) {
            case '0':
               supportedNetworkTypes = supportedNetworkTypeResult.networkTypes_0;
               break;
            case '1':
              supportedNetworkTypes = supportedNetworkTypeResult.networkTypes_1;
              break;
            case '2':
              supportedNetworkTypes = supportedNetworkTypeResult.networkTypes_2;
              break;
            case '3':
              supportedNetworkTypes = supportedNetworkTypeResult.networkTypes_3;
              break;
              case '4':
                  supportedNetworkTypes = supportedNetworkTypeResult.networkTypes_4;
                  break;
            default:
              supportedNetworkTypes = supportedNetworkTypeResult.networkTypes_0;
              break;
          }
          console.log("carrier.js start _addNetworkTypes_me");
          //_addNetworkTypes_me(networkType,supportedNetworkTypes);
          //defect1455-bin-shen@t2mobile.com-begin
          require(['shared/simslot_manager'], function(simslotmanager) {
            SIMSlotManager = simslotmanager;
            _addNetworkTypes_me_ex(networkType, supportedNetworkTypes, prefferedNetworkTypeList);////Modified by lijuanli for task 5366486 end
           //}
          });
          //defect1455-bin-shen@t2mobile.com-end
           /*request.onerror = function onGetTypeErrorHandler() {
          supportedNetworkTypes = supportedNetworkTypeResult.networkTypes;
          _addNetworkTypes_me(networkType,supportedNetworkTypes);
           }*/
           });
        } catch (e) {
           console.log("carrier.js getValue('preffered.network.type.list') error");
        }
      }

      function _addNetworkTypes_me(networkType,supportedNetworkTypes) {
        console.log("carrier.js begin _addNetworkTypes_me networkType=" +networkType);
        if (networkType) {
          supportedNetworkTypes.forEach(function (type) {
            let option = document.createElement('option');
            option.value = type;
            option.selected = (networkType === type);
            console.log("carrier.js networktype=" + type);
            // show user friendly network mode names
            let l10nId = supportedNetworkTypeResult.l10nIdForType(type);
            option.setAttribute('data-l10n-id', l10nId);
            // fallback to the network type
            if (!l10nId) {
              option.textContent = type;
            }
            selector.appendChild(option);
          });
        } else {
          console.warn('carrier: could not retrieve network type');
        }
      }

      function _addNetworkTypes_me_ex(networkType,supportedNetworkTypes,prefferedNetworkTypeList) {
          console.log("carrier.js begin _addNetworkTypes_me networkType=" +networkType);
          if (networkType) {
              supportedNetworkTypes.forEach(function(type) {
                  var option = document.createElement('option');
                  option.value = type;
                  option.selected = (networkType === type);
                  console.log("carrier.js networktype=" + type);
                  // show user friendly network mode names
                  if (type in networkTypeMapping) {
                      option.text = networkTypeMapping[type];
                  } else {
                      var l10nId;
                      console.log("carrier.js prefferedNetworkTypeList=" +prefferedNetworkTypeList);
                      //get current sim mnn mnc
                      var simmcc, simmnc;
                      var current_card_index = DsdsSettings.getIccCardIndexForCellAndDataSettings();
                      console.log("_addNetworkTypes_me_ex current_card_index = " + current_card_index);
                      var primarySimSlot = SIMSlotManager.getSlots()[current_card_index];
                      if (primarySimSlot && primarySimSlot.simCard && primarySimSlot.simCard.iccInfo) {
                          simmcc = primarySimSlot.simCard.iccInfo.mcc;
                          simmnc = primarySimSlot.simCard.iccInfo.mnc;
                          console.log("_addNetworkTypes_me_ex mcc = " + simmcc + " ; mnc =" + simmnc);
                      }

                      switch (prefferedNetworkTypeList) {
                          case '0':
                              console.log("carrier.js  CASE 0");
                              //miaoyj modify for LIO-611 start
                              if (type === 'lte/wcdma/gsm') {
                                  // if(isNeedToUpdateOperator(simmcc,simmnc)){
                                  //     //l10nId = 'operator-networkType-auto-LTE-WCDMA-GSM-RECOMMENDED_EURO';
                                  //     l10nId = 'operator-networkType-auto-LTE-3G-2G';
                                  // }else if(isNeedUse4G3G2GRecommendedDescription(simmcc,simmnc)) {
                                  //     l10nId = 'operator-networkType-auto-LTE-WCDMA-GSM-RECOMMENDED';//task5574025 bin-shen@t2mobile.com
                                  // } else {
                                  //     l10nId = 'operator-networkType-auto-4G-3G-2G';//defect1201 bin-shen@t2mobile.com
                                  // }
                                  l10nId ='operator-networkType-auto-LTE-WCDMA-GSM-CUSTOM';
                              } else if (type === 'wcdma/gsm-auto' || type === 'wcdma/gsm') {
                                  // if(isNeedToUpdateOperator(simmcc,simmnc)){
                                  //     //l10nId = 'operator-networkType-auto-WCDMA-GSM-CUSTOM_EURO';
                                  //     l10nId = 'operator-networkType-auto-3G-2G';
                                  // }else if(isNeedUse3G2GDescription(simmcc,simmnc)) {
                                  //     l10nId = 'operator-networkType-auto-WCDMA-GSM-CUSTOM';//task5574025 bin-shen@t2mobile.com
                                  // } else {
                                  //     l10nId = 'operator-networkType-auto-3G-2G';//defect1201 bin-shen@t2mobile.com
                                  // }
                                   l10nId ='operator-networkType-auto-WCDMA-GSM-CUSTOM';
                              } else if (type === 'gsm') {
                                  l10nId = 'operator-networkType-GSM-CUSTOM';
                              } else {
                                  l10nId = supportedNetworkTypeResult.l10nIdForType(type);
                              }
                              break;
                          case '1':
                              console.log("carrier.js  CASE 1");
                              if (type === 'lte/wcdma/gsm') {
                                // if(isNeedToUpdateOperator(simmcc,simmnc)){
                                //     //l10nId = 'operator-networkType-auto-LTE-WCDMA-GSM-RECOMMENDED_EURO';
                                //     l10nId = 'operator-networkType-auto-LTE-3G-2G';
                                // }else {
                                //     l10nId = 'operator-networkType-auto-LTE-WCDMA-GSM-CUSTOM';
                                // }
                                l10nId = 'operator-networkType-auto-LTE-3G-2G';
                              } else if (type === 'wcdma/gsm-auto') {
                                  // if(isNeedToUpdateOperator(simmcc,simmnc)){
                                  //     //l10nId = 'operator-networkType-auto-WCDMA-GSM-CUSTOM_EURO';
                                  //     l10nId = 'operator-networkType-auto-3G-2G';
                                  // }else {
                                  //     l10nId = 'operator-networkType-auto-WCDMA-GSM-CUSTOM';
                                  // }
                                l10nId ='operator-networkType-auto-WCDMA-GSM-CUSTOM';
                              } else if (type === 'gsm') {
                                  l10nId = 'operator-networkType-GSM-CUSTOM';
                              } else {
                                  l10nId = supportedNetworkTypeResult.l10nIdForType(type);
                              }
                              break;
                              //miaoyj modify for LIO-611 end
                          case '2':
                              //task5574025 bin-shen@t2mobile.com begin
                              if(isNeedUse4G3G2GAutoDescription(simmcc,simmnc) && type === 'lte/wcdma/gsm') {
                                l10nId = 'operator-networkType-auto-4G-3G-2G';//defect1201 bin-shen@t2mobile.com
                                break;
                              } else if(isNeedUse3G2GAutoDescription(simmcc,simmnc) && type === 'wcdma/gsm-auto') {
                                l10nId = 'operator-networkType-auto-3G-2G';//defect1201 bin-shen@t2mobile.com
                                break;
                              }
                              //task5574025 bin-shen@t2mobile.com end
                          case '3':
                              if (type === 'lte/wcdma/gsm') {
                                  if(isNeedToUpdateOperator(simmcc,simmnc)){
                                      //l10nId = 'operator-networkType-auto-LTE-WCDMA-GSM-RECOMMENDED_EURO';
                                      l10nId = 'operator-networkType-auto-LTE-3G-2G';
                                  }else {
                                      l10nId = 'operator-networkType-auto-LTE-WCDMA-GSM-RECOMMENDED';
                                  }
                              } else if (type === 'wcdma/gsm-auto') {
                                  if(isNeedToUpdateOperator(simmcc,simmnc)){
                                      //l10nId = 'operator-networkType-auto-WCDMA-GSM-RECOMMENDED_EURO';
                                      l10nId = 'operator-networkType-auto-3G-2G';
                                  }else {
                                      l10nId = 'operator-networkType-auto-WCDMA-GSM-RECOMMENDED';
                                  }
                              } else if (type === 'wcdma') {
                                      l10nId = 'operator-networkType-3G';
                              } else if (type === 'gsm') {
                                  l10nId = 'operator-networkType-2G';
                              } else {
                                  l10nId = supportedNetworkTypeResult.l10nIdForType(type);
                              }
                              break;
                          case '4':
                              console.log("carrier.js  CASE 4");
                              if (type === 'lte/wcdma') { //4G
                                  if(isNeedToUpdateOperator(simmcc,simmnc)){
                                      l10nId = 'operator-networkType-auto-LTE-WCDMA-RECOMMENDED_EURO';
                                  }else {
                                      l10nId = 'operator-networkType-4G-3G';
                                  }
                              } else if (type === 'wcdma') { //3G
                                  l10nId = 'operator-networkType-3G';
                              } else{
                                  l10nId = '2G-only option hidden';
                              }
                              break;
                          default:
                              l10nId = supportedNetworkTypeResult.l10nIdForType(type);
                              break;
                      }
                      if(l10nId=="2G-only option hidden"){
                          return false;
                      }else{
                          option.setAttribute('data-l10n-id', l10nId);
                      }
                      // fallback to the network type
                      if (!l10nId) {
                          option.textContent = type;
                      }
                  }
                  selector.appendChild(option);
              });
          } else {
              console.warn('carrier: could not retrieve network type');
          }
      }
      //[BTS-15] BDC wangzhigang porting arg user RAT selection option. end
    }

    function cs_disableAutomaticSelectionState(disabled) {
      var networkType = document.getElementById('network-type');
      var opAutoSelectOptions = document.getElementById('auto-select-options');
      var opAutoSelect = document.getElementById('operator-autoSelect');
      var scanItem = document.getElementById('search-again');
      if (disabled) {
        networkType.setAttribute('aria-disabled', 'true');
        opAutoSelectOptions.disabled = true;
        opAutoSelect.setAttribute('aria-disabled', 'true');
        scanItem.disabled = true;
        scanItem.setAttribute('aria-disabled', 'true');
        networkType.classList.add('none-select');
        opAutoSelect.classList.add('none-select');
        scanItem.classList.add('none-select');
        SettingsSoftkey.hide();
      } else {
        networkType.removeAttribute('aria-disabled');
        opAutoSelectOptions.disabled = false;
        opAutoSelect.removeAttribute('aria-disabled');
        scanItem.disabled = false;
        scanItem.removeAttribute('aria-disabled');
        networkType.classList.remove('none-select');
        opAutoSelect.classList.remove('none-select');
        scanItem.classList.remove('none-select');
        SettingsSoftkey.show();
      }
      if (NavigationMap.currentSection === '#carrier-operatorSettings') {
        window.dispatchEvent(new CustomEvent('refresh'));
      }
    }

    function cs_getCarrierName(network) {
      let networkName =
        network.shortName || network.longName || network.mcc + network.mnc;
      let name = networkName;
      if (!networkName.includes('2G') &&
        !networkName.includes('2g') &&
        !networkName.includes('3G') &&
        !networkName.includes('3g') &&
        !networkName.includes('4G') &&
        !!networkName.includes('4g')) {
        let mnc = network.mnc;
        let index = mnc.indexOf('+');
        if (index > 0) {
          let rat = mnc.substr(index + 1, mnc.length - 1);
          if (ratMapping[rat]) {
            name = networkName + ' ' + ratMapping[rat];
          }
        }
      }
      return name;
    }

    /**
     * Network operator selection: auto/manual.
     */
    function cs_initOperatorSelector() {
      var opAutoSelectOptions = document.getElementById('auto-select-options');

      /**
       * Toggle autoselection.
       */
      opAutoSelectOptions.onchange = function () {
        var enabled = (opAutoSelectOptions.value === 'true');
        var targetIndex = DsdsSettings.getIccCardIndexForCellAndDataSettings();
        gOperatorNetworkList.setAutomaticSelection(targetIndex,
            enabled, false);
        cs_disableAutomaticSelectionState(!enabled);
      };

      /**
       * Create a network operator list item.
       */
      function newListItem(network, callback) {
        /**
         * A network list item has the following HTML structure:
         *   <li>
         *     <a>
         *       <span>Network Name</span>
         *     </a>
         *   </li>
         */

        if (network.state === 'connected') {
          previousConnected = network;
        }
        // name
        var name = document.createElement('span');
        /*FIH: BDC wangzhigang. modify for BTS-2926. Compatible with UTF-8 code string begin */
/*
        name.textContent = cs_getCarrierName(network);
*/
        var longName = decodeURIComponent(escape(network.longName));
        var shortName = decodeURIComponent(escape(network.shortName));
        console.log('manual scan network, display longname is: ' + longName + ' shortName is: ' + shortName);
        name.textContent =
          longName || shortName || network.mcc + network.mnc;
        /*FIH: BDC wangzhigang. modify for BTS-2926. Compatible with UTF-8 code string end */

        var a = document.createElement('a');
        a.appendChild(name);

        // create list item
        var li = document.createElement('li');
        li.appendChild(a);
        li.classList.add('operatorItem');

        // bind connection callback
        li.onclick = function () {
          callback(network, true);
        };
        return li;
      }

      // operator network list
      gOperatorNetworkList = (function operatorNetworkList(list) {
        var networkType = document.getElementById('network-type');
        // get the "Searching..." and "Search Again" items, respectively
        var infoItem = document.getElementById('operators-info');
        var scanItem = list.querySelector('li[data-state="ready"]');
        var connecting = false;
        let connectedItem = null;
        var operatorItemMap = {};
        var scanRequest = null;
        var opAutoSelectStates = Array.prototype.map.call(_mobileConnections,
          function () {
            return true;
          });

        scanItem.addEventListener('keydown', rescanEventHandler);

        /**
         * "Search Again" button click event handler
         */
        function rescanEventHandler(evt) {
          if (scanItem.disabled) {
            return;
          }
          if (evt.key === 'Enter') {
            scan();
          }
        }

        /**
         * Clear the list.
         */
        function clear() {
          operatorItemMap = {};
          var operatorItems = list.querySelectorAll('li:not([data-state])');
          var len = operatorItems.length;
          for (var i = len - 1; i >= 0; i--) {
            list.removeChild(operatorItems[i]);
          }

          scanItem.classList.remove('focus');
          scanItem.hidden = true;
          if (NavigationMap.currentSection === '#carrier-operatorSettings') {
            window.dispatchEvent(new CustomEvent('refresh'));
          }
        }

        function cs_disableListItems(disabled) {
          var operatorItems =
            Array.prototype.slice.call(list.querySelectorAll('.operatorItem'));
          operatorItems.forEach(function (operatorItem) {
            if (disabled) {
              operatorItem.disabled = true;
              operatorItem.setAttribute('aria-disabled', 'true');
              operatorItem.classList.add('none-select');
            } else {
              operatorItem.disabled = false;
              operatorItem.removeAttribute('aria-disabled');
              operatorItem.classList.remove('none-select');
            }
          });
        }

        /**
         * Select operator.
         */
        function selectOperator(network) {
          if (connecting || connectedItem === network) {
            return;
          }

          var listItem = operatorItemMap[network.mcc + '.' + network.mnc];
          if (!listItem) {
            return;
          }

          connecting = true;
          connectedItem = network;
          cs_disableAutomaticSelectionState(true);
          cs_disableListItems(true);

          var req = _mobileConnection.selectNetwork(network);
          showToast('operator-status-connecting');
          req.onsuccess = function onsuccess() {
            connecting = false;
            checkAutomaticSelection();
            cs_disableAutomaticSelectionState(false);
            cs_disableListItems(false);
            /* [LIO-1592] BDC wangzhigang add for Vodafone "Permanent Automatic Network Selection" begin */
            let matchInfo = {
                  "clientId": "0"
            };
            var index = DsdsSettings.getIccCardIndexForCellAndDataSettings();
            matchInfo.clientId = index;
            navigator.customization.getValueForCarrier(matchInfo, 'fih.restore.auto.mode').then((result) => {
                 var reautomode = (result === 'undefined') ? false : result;
                 console.log('[carrier] selectNetwork onsuccess,reautomode config: ' + reautomode);
                 if (reautomode) {
                     opAutoSelectOptions.value = 'true';
                     stop();
                     pendingAutomaticSelectionRequest = false;
                     doEnableAutomaticSelection();
                 } else {
                     showToast('operator-status-connected');
                     previousConnected = network;
                 }
             });
            /* [LIO-1592] BDC wangzhigang add for Vodafone "Permanent Automatic Network Selection" end */
          };
          req.onerror = function onerror() {
            connecting = false;
            /* [LIO-1592] BDC wangzhigang add for Vodafone "Permanent Automatic Network Selection" begin */
            let matchInfo = {
                  "clientId": "0"
            };
            var index = DsdsSettings.getIccCardIndexForCellAndDataSettings();
            matchInfo.clientId = index;
            navigator.customization.getValueForCarrier(matchInfo, 'fih.restore.auto.mode').then((result) => {
                var reautomode = (result === 'undefined') ? false : result;
                console.log('[carrier] selectNetwork onerror,reautomode config: ' + reautomode);
                if (reautomode) {
                    opAutoSelectOptions.value = 'true';
                    stop();
                    pendingAutomaticSelectionRequest = false;
                    doEnableAutomaticSelection();
                } else {
                    var dialogConfig = {
                      title: { id: 'switch-to-auto-header', args: {} },
                      body: { id: 'switch-to-auto', args: {} },
                      cancel: {
                        name: 'No',
                        l10nId: 'no',
                        priority: 1,
                        callback: function() {
                          if (previousConnected) {
                            var request =
                              _mobileConnection.selectNetwork(previousConnected);
                            request.onsuccess = request.onerror = function () {
                              cs_disableAutomaticSelectionState(false);
                              cs_disableListItems(false);
                            };
                          } else {
                            console.log('no connected network');
                            cs_disableAutomaticSelectionState(false);
                            cs_disableListItems(false);
                          }
                        }
                      },
                      confirm: {
                        name: 'Yes',
                        l10nId: 'yes',
                        priority: 3,
                        callback: function() {
                          opAutoSelectOptions.value = 'true';
                          stop();
                          pendingAutomaticSelectionRequest = false;
                          doEnableAutomaticSelection();
                        }
                      }
                    };
                    var dialog = new ConfirmDialogHelper(dialogConfig);
                    dialog.show(document.getElementById('app-confirmation-dialog'));
                }
            });
            /* [LIO-1592] BDC wangzhigang add for Vodafone "Permanent Automatic Network Selection" end */
          };
        }

        /**
         * Scan available operators.
         */
        function scan() {
          var opAutoSelectOptions =
            document.getElementById('auto-select-options');
          var opAutoSelect = document.getElementById('operator-autoSelect');

          clear();
          list.dataset.state = 'on'; // "Searching..."
          scanFlag = true;

          // If we want to show the infoItem content,
          // we should set 'data-state' same as list state.
          infoItem.setAttribute('data-state', 'on');
          infoItem.setAttribute('data-l10n-id', 'scanning');
          cs_disableAutomaticSelectionState(true);

          // invalidate the original request if it exists
          invalidateRequest(scanRequest);
          scanRequest = _mobileConnection.getNetworks();

          scanRequest.onsuccess = function onsuccess() {
            scanFlag = false;
            /*[LIO-1093] BDC wangzhigang.DUT shows duplicate operators name in manual PLMN search results. begin */
            //var networks = scanRequest.result;
            var tempnetworks = scanRequest.result;
            var networks = [], j = 0;
            var connectedNetwork = {};
            for (var i = 0; i < tempnetworks.length; i++) {
                if (tempnetworks[i].state == 'connected') {
                    connectedNetwork = tempnetworks[i];
                    console.log('manual scan network, connected  plmn is: '
				           + connectedNetwork.mcc+connectedNetwork.mnc);
                    break;
                }
            }
            for (var i = 0; i < tempnetworks.length; i++) {
                console.log('manual scan network, state is: ' + tempnetworks[i].state
					+ ' numeric is: ' + tempnetworks[i].mcc+tempnetworks[i].mnc);
                if ((connectedNetwork != 'undefined') &&
                    (tempnetworks[i].mcc == connectedNetwork.mcc) &&
                    (tempnetworks[i].mnc == connectedNetwork.mnc) &&
                    (tempnetworks[i].state != 'connected')) {
                    continue;
                } else {
                    networks.push(tempnetworks[i]);
                }
            }
            /*[LIO-1093] BDC wangzhigang.DUT shows duplicate operators name in manual PLMN search results. end */
            for (var i = 0; i < networks.length; i++) {
              var network = networks[i];
              var listItem = newListItem(network, selectOperator);
              list.insertBefore(listItem, scanItem);

              operatorItemMap[network.mcc + '.' + network.mnc] = listItem;
            }
            scanItem.hidden = false;
            list.dataset.state = 'ready'; // "Search Again" button

            scanRequest = null;
            cs_disableAutomaticSelectionState(false);
          };

          scanRequest.onerror = function onScanError(error) {
            scanFlag = false;
            if (error.currentTarget.error.name === 'RequestNotSupported') {
              showToast('request-not-supported');
            }
            console.warn('carrier: could not retrieve any network operator. ');
            scanItem.hidden = false;
            list.dataset.state = 'ready'; // "Search Again" button

            scanRequest = null;
            cs_disableAutomaticSelectionState(false);
          };
        }

        function invalidateRequest(request) {
          if (request) {
            request.onsuccess = request.onerror = function () {
            };
          }
        }

        function leave() {
          list.dataset.state = 'off';
          infoItem.setAttribute('data-state', 'off');
          infoItem.setAttribute('data-l10n-id', 'operator-turnAutoSelectOff');

          operatorItemMap = {};
          var operatorItems = list.querySelectorAll('li:not([data-state])');
          var len = operatorItems.length;
          for (var i = len - 1; i >= 0; i--) {
            list.removeChild(operatorItems[i]);
          }

          scanItem.classList.remove('focus');
          scanItem.hidden = true;
          invalidateRequest(scanRequest);
          scanRequest = null;
        }


        function stop() {
          list.dataset.state = 'off';
          infoItem.setAttribute('data-state', 'off');
          infoItem.setAttribute('data-l10n-id', 'operator-turnAutoSelectOff');
          clear();
          invalidateRequest(scanRequest);
          scanRequest = null;
        }

        var pendingAutomaticSelectionRequest = false;

        function checkAutomaticSelection() {
          if (pendingAutomaticSelectionRequest) {
            doEnableAutomaticSelection();
            pendingAutomaticSelectionRequest = false;
          }
        }

        function doEnableAutomaticSelection() {
          var req = _mobileConnection.selectNetworkAutomatically();
          req.onsuccess = req.onerror = function () {
            opAutoSelectOptions.value = 'true';
            cs_disableAutomaticSelectionState(false);
            cs_disableListItems(false);
          };
        }

        function setAutomaticSelection(index, enabled, skip) {
          opAutoSelectStates[index] = enabled;
          if (enabled) {
            stop();
            // When RIL is actively connecting to an operator, we are not able
            // to set automatic selection. Instead we set a flag indicating that
            // there is a pending automatic selection request.
            if (connecting) {
              pendingAutomaticSelectionRequest = true;
            } else if (!skip) {
              pendingAutomaticSelectionRequest = false;
              doEnableAutomaticSelection();
            }
          } else {
            pendingAutomaticSelectionRequest = false;
            scan();
          }
        }

        function getAutomaticSelection(index) {
          return opAutoSelectStates[index];
        }

        // API
        return {
          leave: leave,
          stop: stop,
          scan: scan,
          setAutomaticSelection: setAutomaticSelection,
          getAutomaticSelection: getAutomaticSelection
        };
      })(document.getElementById('availableOperators'));
    }

    /**
     * Update the automatic operator selection.
     */
    function cs_updateAutomaticOperatorSelection() {
      var opAutoSelectOptions = document.getElementById('auto-select-options');
      var mode = _mobileConnection.networkSelectionMode;
      var newValue = (mode === 'automatic') ? 'true' : 'false';

      opAutoSelectOptions.value = newValue;
      if (opAutoSelectOptions.value === 'true') {
        var targetIndex = DsdsSettings.getIccCardIndexForCellAndDataSettings();
        gOperatorNetworkList.setAutomaticSelection(targetIndex,
          newValue, true);
      } else {
        opAutoSelectOptions.dispatchEvent(new Event('change'));
      }
    }

    /**
     * Update the roaming preference selector.
     */
    function cs_updateRoamingPreferenceSelector() {
      var menuItem = document.getElementById('operator-roaming-preference');
      if (!menuItem || menuItem.hidden) {
        return;
      }

      var selector =
        document.getElementById('operator-roaming-preference-selector');
      var req = _mobileConnection.getRoamingPreference();

      req.onsuccess = function () {
        selector.value = req.result;
      };

      req.onerror = function () {
        console.warn('get roaming preference : ' + req.error.name);
      };
    }

    /**
     * Init roaming preference selector.
     */
    function cs_initRoamingPreferenceSelector() {
      if (!_mobileConnection.getRoamingPreference) {
        document.getElementById('operator-roaming-preference').hidden = true;
        return;
      }

      var defaultRoamingPreferences =
        Array.prototype.map.call(_mobileConnections,
          function () {
            return ['any', 'any'];
          });
      var roamingPreferenceHelper =
        SettingsHelper('ril.roaming.preference', defaultRoamingPreferences);

      var selector =
        document.getElementById('operator-roaming-preference-selector');
      selector.addEventListener('change', (evt) => {
        roamingPreferenceHelper.get(function gotRP(values) {
          var targetIndex =
            DsdsSettings.getIccCardIndexForCellAndDataSettings();
          var setReq = _mobileConnection.setRoamingPreference(selector.value);

          setReq.onsuccess = function set_rp_success() {
            values[targetIndex] = selector.value;
            roamingPreferenceHelper.set(values);
            showToast('changessaved');
          };

          setReq.onerror = function set_rp_error() {
            selector.value = values[targetIndex];
          };
        });
      });
    }

    return {
      init: function (panel) {
        cs_init();
      }
    };
  };
  return CarrierSettings;
});
