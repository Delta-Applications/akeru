 /* global DsdsSettings */
 /* global SettingsSoftkey */
define(['require','modules/settings_panel','modules/settings_service','modules/dialog_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');
  //[LIO-311] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.begin
  var DialogService = require('modules/dialog_service');
  //[LIO-311] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.end

  //BDC zhangwp 20190416 add for IMS default configurations. begin
  const KEY_FIH_VOLTE_DEFAULT_ENABLE_BOOL = 'fih.volte.default.enable.bool';
  const KEY_FIH_VOLTE_EDITABLE_BOOL = 'fih.volte.editable.bool';
  const KEY_FIH_VOWIFI_DEFAULT_ENABLE_BOOL = 'fih.vowifi.default.enable.bool';
  const KEY_FIH_VOWIFI_EDITABLE_BOOL = 'fih.vowifi.editable.bool';
  //BDC zhangwp 20190416 add for IMS default configurations. end

  return function volte_settings_panel() {
    var elements = {};
    var _settings = navigator.mozSettings;
    var telephony = navigator.mozTelephony;
    var vowifiStatusItem = document.querySelector('#vowifi-status-desc');
    let listElements = null;

    function _initSoftKey() {
      var softkeyParams = {
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
      SettingsSoftkey.init(softkeyParams);
    }

    function _switchChange() {
      let isSupportDualLte = DeviceFeature.getValue('dual-Lte');
      let p1 = null;
      let p2 = null;
      if (isSupportDualLte === 'true') {
        p1 = getSetting('ril.dsds.ims.enabled');
        p2 = getSetting('ril.dsds.ims.preferredProfile');
      } else {
        p1 = getSetting('ril.ims.enabled');
        p2 = getSetting('ril.ims.preferredProfile');
      }
      Promise.all([p1, p2]).then(function(values) {
        let obj = {};
        if (isSupportDualLte === 'true') {
          let serviceId = DsdsSettings.getIccCardIndexForVolteSettings();
          let imsEnabledArray = values[0];
          let imsProfileArray = values[1];
          if (elements.volteSwitch.value === 'true' &&
            elements.vowifiSwitch.value === 'true') {
            imsEnabledArray[serviceId] = true;
            imsProfileArray[serviceId] = 'wifi-preferred';
            obj['ril.dsds.ims.enabled'] = imsEnabledArray;
            obj['ril.dsds.ims.preferredProfile'] = imsProfileArray;
          } else if (elements.volteSwitch.value === 'true' &&
            elements.vowifiSwitch.value === 'false') {
            imsEnabledArray[serviceId] = true;
            imsProfileArray[serviceId] = 'cellular-only';
            obj['ril.dsds.ims.enabled'] = imsEnabledArray;
            obj['ril.dsds.ims.preferredProfile'] = imsProfileArray;
          } else if (elements.volteSwitch.value === 'false' &&
            elements.vowifiSwitch.value === 'true') {
            imsEnabledArray[serviceId] = true;
            imsProfileArray[serviceId] = 'wifi-only';
            obj['ril.dsds.ims.enabled'] = imsEnabledArray;
            obj['ril.dsds.ims.preferredProfile'] = imsProfileArray;
          } else if (elements.volteSwitch.value === 'false' &&
            elements.volteSwitch.value === 'false') {
            imsEnabledArray[serviceId] = false;
            obj['ril.dsds.ims.enabled'] = imsEnabledArray;
          }
        } else {
          if (elements.volteSwitch.value === 'true' &&
            elements.vowifiSwitch.value === 'true') {
            obj['ril.ims.enabled'] = true;
            //[BTS-2396] BDC zhangwp 20190930 add for VF AU default call mode. begin
/*
            obj['ril.ims.preferredProfile'] = 'wifi-preferred';
*/
            if(_isCellularPreferred()) {
              obj['ril.ims.preferredProfile'] = 'cellular-preferred';
            } else {
              obj['ril.ims.preferredProfile'] = 'wifi-preferred';
            }
            //[BTS-2396] BDC zhangwp 20190930 add for VF AU default call mode. end
          } else if (elements.volteSwitch.value === 'true' &&
            elements.vowifiSwitch.value === 'false') {
            obj['ril.ims.enabled'] = true;
            obj['ril.ims.preferredProfile'] = 'cellular-only';
          } else if (elements.volteSwitch.value === 'false' &&
            elements.vowifiSwitch.value === 'true') {
            obj['ril.ims.enabled'] = true;
            obj['ril.ims.preferredProfile'] = 'wifi-only';
          } else if (elements.volteSwitch.value === 'false' &&
            elements.volteSwitch.value === 'false') {
            obj['ril.ims.enabled'] = false;
          }
        }

        //[BTS-2985][BTS-2987] BDC yuxin modify.begin
        //original code
        //var result = _settings.createLock().set(obj);
        //result.onsuccess = function () {
        //  showToast('changessaved');
        //  _updateDesc();
        //};
        //result.onerror = function () {
        //  console.error("Error: An error occure, can't set ims switch");
        //  _updateDesc();
        //  _updateUI();
        //};
        AirplaneModeHelper.ready(function() {
          var status = AirplaneModeHelper.getStatus();
          console.log("_switchChange, AirplaneModeHelper status="+status);
          if ((status === 'enabled')) {
            var p1 = getSetting('ril.ims.enabled.temp');
            var p2 = getSetting('ril.ims.preferredProfile.temp');
            Promise.all([p1, p2]).then(function(values) {
              var imsEnabledTemp = values[0];
              var imsProfileTemp = values[1];
              obj['ril.ims.enabled.temp'] = imsEnabledTemp;
              obj['ril.ims.preferredProfile.temp'] = imsProfileTemp;
              console.log("_switchChange 1 step, imsEnabledTemp="+imsEnabledTemp + " imsProfileTemp=" + imsProfileTemp);
              if (imsEnabledTemp){
				if (imsProfileTemp === 'cellular-preferred' || imsProfileTemp === 'wifi-preferred') {
				  if (obj['ril.ims.preferredProfile'] === undefined) {
				    obj['ril.ims.preferredProfile.temp'] = 'cellular-only';
				  }
				} else if (imsProfileTemp === 'cellular-only') {
				  if (obj['ril.ims.preferredProfile'] === 'wifi-only') {
				    if(_isCellularPreferred()) {
				      obj['ril.ims.preferredProfile.temp'] = 'cellular-preferred';
				    } else {
				      obj['ril.ims.preferredProfile.temp'] = 'wifi-preferred';
				    }
				  }
				} else if (imsProfileTemp === 'wifi-only') {
				  if (obj['ril.ims.preferredProfile'] === undefined) {
				    obj['ril.ims.enabled.temp'] = false;
				    obj['ril.ims.preferredProfile.temp'] = undefined;
				  }
				}
              } else {
                if (obj['ril.ims.preferredProfile'] === 'wifi-only'){
                  obj['ril.ims.enabled.temp'] = true;
                  obj['ril.ims.preferredProfile.temp'] = 'wifi-only';
                }
              }
              console.log("_switchChange 2 step, imsEnabledTemp="+obj['ril.ims.enabled.temp'] + " imsProfileTemp=" + obj['ril.ims.preferredProfile.temp']
                + " imsEnabled=" + obj['ril.ims.enabled'] + " imsProfile=" + obj['ril.ims.preferredProfile']);

              var result = _settings.createLock().set(obj);
              result.onsuccess = function () {
                showToast('changessaved');
                _updateDesc();
              };
              result.onerror = function () {
                console.error("Error: An error occure, can't set ims switch");
                _updateDesc();
                _updateUI();
              };
            });
          } else {
            var result = _settings.createLock().set(obj);
            result.onsuccess = function () {
              showToast('changessaved');
              _updateDesc();
            };
            result.onerror = function () {
              console.error("Error: An error occure, can't set ims switch");
              _updateDesc();
              _updateUI();
            };
          }
        });
	  });
      //[BTS-2985][BTS-2987] BDC yuxin modify.end
    }

    //[BTS-2396] BDC zhangwp 20190930 add for VF AU default call mode. begin
    //[BTS-2987] BDC zhangwp 20200306 add for DTAG
    var defaultDataServiceId = '';
    function _isCellularPreferred() {
      console.log('volte_vowifi isCellularPreferred : defaultDataServiceId: ' + defaultDataServiceId);

      var defaultDataMccMnc = '';
      var conn = navigator.mozMobileConnections[defaultDataServiceId];
      if (conn.iccId){
        var icc = navigator.mozIccManager.getIccById(conn.iccId);
        defaultDataMccMnc = icc && icc.iccInfo ? icc.iccInfo.mcc + icc.iccInfo.mnc : null;
        console.log('volte_vowifi isCellularPreferred defaultDataMccMnc: ' + defaultDataMccMnc);
      }

      if(defaultDataMccMnc === '50503' ||
        defaultDataMccMnc === '26201' ||
        defaultDataMccMnc === '20201' ||
        //[LIO-1549] BDC zhangwp 20200915 add for Claro Colombia preferred mode. begin
        defaultDataMccMnc === '732101' ||
        //[LIO-1549] BDC zhangwp 20200915 add for Claro Colombia preferred mode. end
        //[LIO-1739] BDC zhangwp 20201007 add for T-Mobile Hungary Cellular preferred. begin
        defaultDataMccMnc === '21630' ||
        //[LIO-1739] BDC zhangwp 20201007 add for T-Mobile Hungary Cellular preferred. end
        //[LIO-1821] BDC zhangwp 20201022 add for Claro Guatemala Default IMS (VoWifi) mode. begin
        defaultDataMccMnc === '70401' ||
        //[LIO-1821] BDC zhangwp 20201022 add for Claro Guatemala Default IMS (VoWifi) mode. end
        //[LIO-384] BDC yuxin add for [MR][EURO][17_0276] VoWiFi Call Preferences dynamically set for Home and Roaming scenarios for DT affiliates. begin
        defaultDataMccMnc === '23203' ||
        defaultDataMccMnc === '20416' ||
        defaultDataMccMnc === '20420' ||
        //[LIO-384] BDC yuxin add for [MR][EURO][17_0276] VoWiFi Call Preferences dynamically set for Home and Roaming scenarios for DT affiliates. end
        //[LIO-395] BDC yuxin add for [MR][GAMEA][17_0158]Wifi preferred should not be selectable to end user. begin
        defaultDataMccMnc === '28602'
        //[LIO-395] BDC yuxin add for [MR][GAMEA][17_0158]Wifi preferred should not be selectable to end user. end
      ) {
        return true;
      }

      return false;
    }
    //[BTS-2396] BDC zhangwp 20190930 add for VF AU default call mode. end

    //[LIO-311] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.begin
    function _vowifiSwitchChange() {
      if (elements.vowifiSwitch.value === 'true') {
        getSetting('ril.data.defaultServiceId').then(function(result) {
          var serviceId = result;
          var missEccOpt = isWifiCallMissEcc(serviceId);
          var webLink = isClaroArgentian(serviceId);
          if (missEccOpt) {
            var dialogConfig = {
              title: {id: 'wifiCallMissEccTitle', args: {operator: missEccOpt}},
              body: {id: 'wifiCallMissEccMsg', args: {}},
              cancel: {
                name: 'notNow',
                l10nId: 'notNow',
                priority: 1,
                callback: function() {
                  dialog.destroy();
                  elements.vowifiSwitch.value = 'false';
                }
              },
              confirm: {
                name: 'turnOn',
                l10nId: 'turnOn',
                priority: 3,
                callback: function() {
                  dialog.destroy();
                  _switchChange();
                }
              }
            };
            var dialog = new ConfirmDialogHelper(dialogConfig);
            dialog.show(document.getElementById('app-confirmation-dialog'));
          //[LIO-472] BDC yuxin add for [MR][AMERICAS][17_0123]A Pop Up message while activating VoWifi feature in settings. begin
          } else if (webLink) {
            let pPgnorePrompt = getSetting('ril.claro.vowif.prompt.ignore');
            Promise.all([pPgnorePrompt]).then(function(values) {
              var ignorePrompt = values[0];
              console.log('_vowifiSwitchChange ignorePrompt='+ignorePrompt);
              if (true === ignorePrompt) {
                _switchChange();
              } else {
                var dialogConfig = {
                  title: {id: 'wifiCallMissEccTitle', args: {operator: ''}},
                  body: {id: 'wifiCallFeatureMsg', args: {}},
                  cancel: {
                    name: 'Ignore',
                    l10nId: 'ignore',
                    priority: 1,
                    callback: function() {
                      dialog.destroy();
                      _settings.createLock().set({'ril.claro.vowif.prompt.ignore' : true});
                      _switchChange();
                    }
                  },
                  accept: {
                    name: 'Here',
                    l10nId: 'here',
                    priority: 1,
                    callback: function() {
                      dialog.destroy();;
                      window.open(webLink, 'popup');
                      _switchChange();
                    }
                  },
                  confirm: {
                    name: 'Ok',
                    l10nId: 'ok',
                    priority: 3,
                    callback: function() {
                      dialog.destroy();
                      _switchChange();
                    }
                  }
                };
                var dialog = new ConfirmDialogHelper(dialogConfig);
                dialog.show(document.getElementById('app-confirmation-dialog'));
              }
            });
          //[LIO-472] BDC yuxin add for [MR][AMERICAS][17_0123]A Pop Up message while activating VoWifi feature in settings. end
          } else {
	          _switchChange();
          }
        });
      } else {
        _switchChange();
      }
    }

    function isWifiCallMissEcc(defaultDataId) {
      var missEccOpt = null;
      var mccmnc = null;
      if (defaultDataId !== false && defaultDataId >= 0) {
        var conn = navigator.mozMobileConnections[defaultDataId];
        if (conn && conn.voice && conn.voice.network && conn.voice.network.mcc) {
          mccmnc = conn.voice.network.mcc + conn.voice.network.mnc;
        }
        if (!mccmnc && conn.iccId){
          var icc = navigator.mozIccManager.getIccById(conn.iccId);
          mccmnc = icc && icc.iccInfo ? icc.iccInfo.mcc + icc.iccInfo.mnc : null;
        }
      }

      if (mccmnc) {
        if (mccmnc === '20205' || mccmnc === '20404' || mccmnc === '21401' || mccmnc === '21670'
            || mccmnc === '22210' || mccmnc === '23003' || mccmnc === '26202'
            || mccmnc === '26209' || mccmnc === '26801' || mccmnc === '22601'
            || mccmnc === '27602') { //for [LIO-810] remove 23415 and 27201
              missEccOpt = 'Vodafone';
        } else if (mccmnc === '20601') { //for [LIO-371]
              missEccOpt = '';
        }
      }

      return missEccOpt;
    }
    //[LIO-311] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.end

    //[LIO-472] BDC yuxin add for [MR][AMERICAS][17_0123]A Pop Up message while activating VoWifi feature in settings. begin
    function isClaroArgentian(defaultDataId) {
      var linkClaro = null;
      var mccmnc = null;
      if (defaultDataId !== false && defaultDataId >= 0) {
        var conn = navigator.mozMobileConnections[defaultDataId];
        if (conn.iccId){
          var icc = navigator.mozIccManager.getIccById(conn.iccId);
          mccmnc = icc && icc.iccInfo ? icc.iccInfo.mcc + icc.iccInfo.mnc : null;
        }
      }

      if (mccmnc) {
        if (mccmnc === '722310') {
              linkClaro = "https://landing.claro.com.ar/clarovowifi/";
        }
      }
      return linkClaro;
    }
    //[LIO-472] BDC yuxin add for [MR][AMERICAS][17_0123]A Pop Up message while activating VoWifi feature in settings. end

    //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.begin
    function isDisabledVowifi(dataId) {
      var bDisabledVowifi = false;
      if (dataId !== false && dataId >= 0) {
        var conn = navigator.mozMobileConnections[dataId];
        if (conn.iccId){
          var icc = navigator.mozIccManager.getIccById(conn.iccId);
          if (icc && icc.iccInfo && icc.iccInfo.mcc) {
            var mccmnc = icc.iccInfo.mcc + icc.iccInfo.mnc;
            if (icc.iccInfo.mcc === '420') {
              bDisabledVowifi = true;
            } else if (mccmnc === '42402') {
              bDisabledVowifi = true;
            }
          }
        }
      }
      return bDisabledVowifi;
    }
    //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.end

    function getSetting(settingKey) {
      return new Promise(function (resolve, reject) {
        var transaction = _settings.createLock();
        var req = transaction.get(settingKey);
        req.onsuccess = function () {
          resolve(req.result[settingKey]);
        };
        req.onerror = function () {
          resolve(false);
        };
      });
    }

    function _updateDesc() {
      vowifiStatusItem.textContent = '';
      let isSupportDualLte = DeviceFeature.getValue('dual-Lte');
      let imsEnabled = null;
      let imsProfile = null;
      let status = null;
      let p1 = getSetting('ril.data.defaultServiceId');
      let p2 = getSetting('airplaneMode.status');
      let p3 = null;
      let p4 = null;
      if (isSupportDualLte === 'true') {
        p3 = getSetting('ril.dsds.ims.enabled');
        p4 = getSetting('ril.dsds.ims.preferredProfile');
      } else {
        p3 = getSetting('ril.ims.enabled');
        p4 = getSetting('ril.ims.preferredProfile');
      }
      Promise.all([p1, p2, p3, p4]).then(function(values) {
        let serviceId = values[0];
        status = values[1];
        if (isSupportDualLte === 'true') {
          let imsEnabledArray = values[2];
          let imsProfileArray = values[3];
          serviceId = DsdsSettings.getIccCardIndexForVolteSettings();
          imsEnabled = imsEnabledArray[serviceId];
          imsProfile = imsProfileArray[serviceId];
        } else {
          imsEnabled = values[2];
          imsProfile = values[3];
        }
        let imsHandler = navigator.mozMobileConnections[serviceId].imsHandler;
        if (imsHandler) {
          if ((status === 'enabled')) {
            elements.volte.setAttribute('aria-disabled', true);
            elements.volte.classList.add('none-select');
            if (imsEnabled &&
              (imsProfile === 'wifi-preferred' ||
              imsProfile === 'wifi-only')) {
              if (imsHandler.unregisteredReason) {
                  //[BTS-2526] DBC yuxin modify for VHA/OA Issue VF034 - Itermittently device fails to register to VoWIFI in Airplane mode ON and give the error message as " Registration error".begin
                  //original code
                  //_updateVowifiDesc('errorMessage');
                  //vowifiStatusItem.hidden = false;
                  vowifiStatusItem.hidden = true;
                  //[BTS-2526] DBC yuxin modify for VHA/OA Issue VF034 - Itermittently device fails to register to VoWIFI in Airplane mode ON and give the error message as " Registration error".end
              } else {
                _updateVowifiDesc('airplaneMode');
                vowifiStatusItem.hidden = false;
              }
            } else {
              vowifiStatusItem.hidden = true;
            }
          } else {
            elements.volte.removeAttribute('aria-disabled');
            elements.volte.classList.remove('none-select');
            vowifiStatusItem.hidden = true;
            if (imsEnabled &&
              (imsProfile === 'wifi-preferred' ||
              imsProfile === 'wifi-only')) {
              if (imsHandler.unregisteredReason) {
                  //[BTS-2526] DBC yuxin modify for VHA/OA Issue VF034 - Itermittently device fails to register to VoWIFI in Airplane mode ON and give the error message as " Registration error".begin
                  //original code
                  //_updateVowifiDesc('errorMessage');
                  //vowifiStatusItem.hidden = false;
                  vowifiStatusItem.hidden = true;
                  //[BTS-2526] DBC yuxin modify for VHA/OA Issue VF034 - Itermittently device fails to register to VoWIFI in Airplane mode ON and give the error message as " Registration error".end
              }
            }
          }
          if (telephony) {
            telephony.ontelephonycoveragelosing = (evt) => {
              _updateVowifiDesc('poorSignal');
            };
          }
        }
      });
    }

    function _updateVowifiDesc(status) {
      var l10n = 'volte-status-' + status;
      vowifiStatusItem.textContent = ' - ' + navigator.mozL10n.get(l10n);
    }

    function _updateUI() {
      let isSupportDualLte = DeviceFeature.getValue('dual-Lte');
      let imsEnabled = null
      let imsProfile = null;
      let p1 = getSetting('ril.data.defaultServiceId');
      let p2 = null;
      let p3 = null;
      if (isSupportDualLte === 'true') {
        p2 = getSetting('ril.dsds.ims.enabled');
        p3 = getSetting('ril.dsds.ims.preferredProfile');
      } else {
        p2 = getSetting('ril.ims.enabled');
        p3 = getSetting('ril.ims.preferredProfile');
      }
      Promise.all([p1, p2, p3]).then(function(values) {
        let serviceId = values[0];
        DeviceFeature.ready(() => {
          if (isSupportDualLte === 'true') {
            let imsEnabledArray = values[1];
            let imsProfileArray = values[2];
            serviceId = DsdsSettings.getIccCardIndexForVolteSettings();
            imsEnabled = imsEnabledArray[serviceId];
            imsProfile = imsProfileArray[serviceId];
          } else {
            imsEnabled = values[1];
            imsProfile = values[2];
          }

        //BDC zhangwp 20190416 add for IMS default configurations. begin
        let matchInfo = {
          "clientId": "0",
        };
        matchInfo.clientId = serviceId;
        defaultDataServiceId = serviceId;

        console.log('volte_vowifi updateUI');

        let p4 = navigator.customization.getValueForCarrier(matchInfo, KEY_FIH_VOLTE_EDITABLE_BOOL);
        let p5 = navigator.customization.getValueForCarrier(matchInfo, KEY_FIH_VOWIFI_EDITABLE_BOOL);
        let p6 = navigator.customization.getValueForCarrier(matchInfo, KEY_FIH_VOLTE_DEFAULT_ENABLE_BOOL);
        let p7 = navigator.customization.getValueForCarrier(matchInfo, KEY_FIH_VOWIFI_DEFAULT_ENABLE_BOOL);

        Promise.all([p4, p5, p6, p7]).then(function(values) {
          let volteEditable = JSON.stringify(values[0]) === 'true' ? true : false;
          let vowifiEditable = JSON.stringify(values[1]) === 'true' ? true : false;
          let volteDefaultOn = JSON.stringify(values[2]) === 'true' ? true : false;
          let vowifiDefaultOn = JSON.stringify(values[3]) === 'true' ? true : false;
          let carrierVolteSupport = volteEditable || volteDefaultOn;
          let carrierVowifiSupport = vowifiEditable || vowifiDefaultOn;

          console.log('volte_vowifi updateUI : volteEditable: ' + volteEditable + " vowifiEditable: " + vowifiEditable);
          console.log('volte_vowifi updateUI : serviceId: ' + serviceId + ' imsEnabled: ' + imsEnabled + ' imsProfile: ' + imsProfile);
        //BDC zhangwp 20190416 add for IMS default configurations. end

          let isSupportWifi = DeviceFeature.getValue('wifi');
          let isSupportVowifi = DeviceFeature.getValue('voWifi');
          let isSupportVolte = DeviceFeature.getValue('voLte');
          let vowifiElement = elements.vowifiSwitch.parentNode.parentNode;
          let volteElement = elements.volteSwitch.parentNode.parentNode;
          let volteWifiH1 = document.getElementById('volte-vowifi-h1');
          let mobileConnection = navigator.mozMobileConnections[serviceId];
          let supportedBearers = mobileConnection.imsHandler &&
            mobileConnection.imsHandler.deviceConfig.supportedBearers;

          //[BTS-1960] BDC zhangwp 20190617 add for remove VoWiFi settings for SIM2. begin
          if(serviceId === 1) {
            console.log('volte_vowifi updateUI : remove VoWiFi settings for SIM2');
            vowifiEditable = false;
            vowifiElement.classList.add('hidden');
          }
          //[BTS-1960] BDC zhangwp 20190617 add for remove VoWiFi settings for SIM2. end

          if (supportedBearers) {
            //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. begin
/*
            let supportWifi = (isSupportWifi === 'true') &&
              (isSupportVowifi === 'true') &&
              (supportedBearers.indexOf('wifi') >= 0);
            let supportLte = (isSupportVolte === 'true') &&
              supportedBearers.indexOf('cellular') >= 0;
*/
            let supportWifi = (isSupportWifi === 'true') &&
              (isSupportVowifi === 'true') &&
              carrierVowifiSupport &&
              (supportedBearers.indexOf('wifi') >= 0);
            let supportLte = (isSupportVolte === 'true') &&
              carrierVolteSupport &&
              supportedBearers.indexOf('cellular') >= 0;
            //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. end

            if (supportWifi && supportLte) {
              //BDC zhangwp 20190416 add for IMS default configurations. begin
/*
              volteElement.classList.remove('hidden');
              vowifiElement.classList.remove('hidden');
              volteWifiH1.setAttribute('data-l10n-id', 'volte-header');
*/
              if(volteEditable) {
                volteElement.classList.remove('hidden');
              }
              if(vowifiEditable) {
                vowifiElement.classList.remove('hidden');
              }

              if(volteEditable && !vowifiEditable) {
                volteWifiH1.setAttribute('data-l10n-id', 'fih-volte-header');
              } else if(!volteEditable && vowifiEditable) {
                volteWifiH1.setAttribute('data-l10n-id', 'fih-vowifi-header');
              } else {
                volteWifiH1.setAttribute('data-l10n-id', 'volte-header');
              }
              //BDC zhangwp 20190416 add for IMS default configurations. end
              volteWifiH1.hidden = false;
            } else {
              if (supportWifi) {
                //BDC zhangwp 20190416 add for IMS default configurations. begin
/*
                vowifiElement.classList.remove('hidden');
*/
                if(vowifiEditable) {
                  vowifiElement.classList.remove('hidden');
                }
                //BDC zhangwp 20190416 add for IMS default configurations. end
              } else {
                vowifiElement.classList.add('hidden');
                //[BTS-2365] BDC zhangwp 20190723 modify for Dutch translation. begin
/*
                volteWifiH1.setAttribute('data-l10n-id', 'volte');
*/
                volteWifiH1.setAttribute('data-l10n-id', 'fih-volte-header');
                //[BTS-2365] BDC zhangwp 20190723 modify for Dutch translation. end

                volteWifiH1.hidden = false;
              };
              if (supportLte) {
                //BDC zhangwp 20190416 add for IMS default configurations. begin
/*
                volteElement.classList.remove('hidden');
*/
                if(volteEditable) {
                  volteElement.classList.remove('hidden');
                }
                //BDC zhangwp 20190416 add for IMS default configurations. end
              } else {
                volteElement.classList.add('hidden');
                //[BTS-2365] BDC zhangwp 20190723 modify for Dutch translation. begin
/*
                volteWifiH1.setAttribute('data-l10n-id', 'vowifi');
*/
                volteWifiH1.setAttribute('data-l10n-id', 'fih-vowifi-header');
                //[BTS-2365] BDC zhangwp 20190723 modify for Dutch translation. end

                volteWifiH1.hidden = false;
              };
            }
          }

          if (imsEnabled && (imsProfile === 'cellular-preferred' ||
            imsProfile === 'wifi-preferred')) {
            elements.volteSwitch.value = 'true';
            elements.vowifiSwitch.value = 'true';
          } else if (imsEnabled && imsProfile === 'cellular-only') {
            elements.volteSwitch.value = 'true';
            elements.vowifiSwitch.value = 'false';
          } else if (imsEnabled && imsProfile === 'wifi-only') {
            elements.volteSwitch.value = 'false';
            elements.vowifiSwitch.value = 'true';
          } else if (!imsEnabled) {
            //BDC zhangwp 20190416 add for IMS default configurations. begin
/*
            elements.volteSwitch.value = 'false';
            elements.vowifiSwitch.value = 'false';
*/
            if(!volteEditable && volteDefaultOn) {
              elements.volteSwitch.value = 'true';
            } else {
              elements.volteSwitch.value = 'false';
            }

            if(!vowifiEditable && vowifiDefaultOn) {
              elements.vowifiSwitch.value = 'true';
            } else {
              elements.vowifiSwitch.value = 'false';
            }
            //BDC zhangwp 20190416 add for IMS default configurations. end
          }

          //[BTS-2985][BTS-2987] BDC yuxin modify.begin
          //original code
          //window.dispatchEvent(new CustomEvent('refresh'));
          AirplaneModeHelper.ready(function() {
            var status = AirplaneModeHelper.getStatus();
            if ((status === 'enabled')) {
              elements.volteSwitch.value = 'false';
              elements.volte.setAttribute('aria-disabled', true);
              //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.begin
              if (true === isDisabledVowifi(serviceId)) {
                elements.vowifiSwitch.value = 'false';
                elements.vowifi.setAttribute('aria-disabled', true);
              }
              //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.end
            } else {
              elements.volte.setAttribute('aria-disabled', false);
              //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.begin
              if (true === isDisabledVowifi(serviceId)) {
                elements.vowifi.setAttribute('aria-disabled', false);
              }
              //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.end
            }
            window.dispatchEvent(new CustomEvent('refresh'));
          });
          //[BTS-2985][BTS-2987] BDC yuxin modify.end
        });

        //BDC zhangwp 20190416 add for IMS default configurations. begin
        });
        //BDC zhangwp 20190416 add for IMS default configurations. end
      });
    }

    function handleAirplaneMode(status) {
      let enabled =
        (status === 'enabled' || status === 'enabling') ? true : false;
      elements.volte.setAttribute('aria-disabled', enabled);
      elements.volte.classList.add('none-select');
      SettingsSoftkey.hide();

      if (status === 'disabled') {
        elements.volte.removeAttribute('aria-disabled');
        elements.volte.classList.remove('none-select');
        //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.begin
        if (true === isDisabledVowifi(DsdsSettings.getIccCardIndexForVolteSettings())) {
          elements.vowifi.setAttribute('aria-disabled', false);
        }
        //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.end
        SettingsSoftkey.show();
      } else {
        elements.volte.setAttribute('aria-disabled', true);
        elements.volte.classList.add('none-select');
        //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.begin
        if (true === isDisabledVowifi(DsdsSettings.getIccCardIndexForVolteSettings())) {
          elements.vowifiSwitch.value = 'false';
          elements.vowifi.setAttribute('aria-disabled', true);
        }
        //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.end
        SettingsSoftkey.hide();
      }
      if (Settings.currentPanel) {
        let panel =
          document.getElementById(Settings.currentPanel.substring(1));
        ListFocusHelper.updateSoftkey(panel);
      }
    }

    function keyDwnHdr(evt) {
      if (evt.key === 'Enter' &&
        (evt.target.id === 'volte' || evt.target.id === 'vowifi')) {
        let req = _settings.createLock().get('airplaneMode.status');
        req.onsuccess = (result) => {
          let status = req.result['airplaneMode.status'];
          handleAirplaneMode(status);
          var selectorRule = 'li:not([aria-disabled="true"]):' +
            'not(.hidden):not([hidden]).focus select';
          var select = document.querySelector(selectorRule);
          if (select && select.hasChildNodes()) {
            select.focus();
            NavigationMap.selectOptionShow = true;
          }
        };
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          volteSwitch: document.getElementById('volte-switch'),
          vowifiSwitch: document.getElementById('vowifi-switch'),
          volte: document.getElementById('volte'),
          //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.begin
          vowifi: document.getElementById('vowifi')
          //[LIO-406] BDC yuxin add for [MR][GAMEA][17_0244] Vowifi must be disabled in Airplane mode.end
        };
        listElements = panel.querySelectorAll('li');
      },

      onBeforeShow: function(panel) {
        _updateDesc();
        _updateUI();
        elements.volteSwitch.addEventListener('change', _switchChange);
        //[LIO-311] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.begin
        //original code
        //elements.vowifiSwitch.addEventListener('change', _switchChange);
        elements.vowifiSwitch.addEventListener('change', _vowifiSwitchChange);
        //[LIO-311] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.end
        ListFocusHelper.addEventListener(listElements);
        _initSoftKey();
        ListFocusHelper.updateSoftkey(panel);
        SettingsListener.observe('airplaneMode.status', false,
          handleAirplaneMode);
        window.addEventListener('keydown', keyDwnHdr);
      },

      onBeforeHide: function() {
        elements.volteSwitch.removeEventListener('change', _switchChange);
        //[LIO-311] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.begin
        //original code
        //elements.vowifiSwitch.removeEventListener('change', _switchChange);
        elements.vowifiSwitch.removeEventListener('change', _vowifiSwitchChange);
        //[LIO-311] BDC yuxin add for VoWiFi: Emergency Call Notifications should show to end useer when device is registered for WiFi Calling.end
        ListFocusHelper.removeEventListener(listElements);
        SettingsListener.unobserve('airplaneMode.status',
          handleAirplaneMode);
        window.removeEventListener('keydown', keyDwnHdr);
      },

      onShow: function() {
      },

      onHide: function() {
      }
    });
  };
});
