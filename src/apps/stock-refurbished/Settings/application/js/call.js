define(['require','modules/dialog_service','dsds_settings','shared/settings_helper','shared/simslot_manager'],function(require) {
  

  /**
   * Singleton object that handles some call settings.
   */
  var DialogService = require('modules/dialog_service');
  var DsdsSettings = require('dsds_settings');
  var SettingsHelper = require('shared/settings_helper');

  //[CNT-660] BDC zhangwp add for hide DTMF menu. begin
  var SIMSlotManager = require('shared/simslot_manager');
  //[CNT-660] BDC zhangwp add for hide DTMF menu. end

  var CallSettings = function cs_callsettings() {
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

    var _settings = window.navigator.mozSettings;
    var _mobileConnections = window.navigator.mozMobileConnections;
    var _voiceTypes = Array.prototype.map.call(_mobileConnections,
      function() { return null; });

    /** mozMobileConnection instance the panel settings rely on */
    var _mobileConnection = null;
    var _imsHandler = null;
    /**
      * To prevent current panle frequently refresh
      *   while the voice type is changing.
      *
      * @param {String} 'cdma' or 'gsm'
      */
    var _currentType = null;

    /**
     * Init function.
     */
    function cs_init() {
      // Get the mozMobileConnection instace for this ICC card.
      _mobileConnection = _mobileConnections[
        DsdsSettings.getIccCardIndexForCallSettings()
      ];
      if (!_mobileConnection) {
        return;
      }

      // Init call setting stuff.
      cs_initVoicePrivacyMode();

      // Update items in the call settings panel.
      window.addEventListener('panelready', function(e) {
        // Get the mozMobileConnection instace for this ICC card.
        _mobileConnection = _mobileConnections[
          DsdsSettings.getIccCardIndexForCallSettings()
        ];
        if (!_mobileConnection) {
          return;
        }

        switch (e.detail.current) {
          case '#call':
            // No need to refresh the call settings items if navigated from
            // panels not manipulating call settings.
            if (e.detail.previous === '#call-waiting' ||
              e.detail.previous === '#call-caller-id' ||
              e.detail.previous === '#call-cfSettings' ||
              e.detail.previous === '#call-cbSettings') {
              return;
            }

            cs_checkNetworkType();
            break;
        }
      });

      // We need to refresh call setting items as they can be changed in dialer.
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
          return;
        }

        switch (Settings.currentPanel) {
          case '#call':
            cs_checkNetworkType();
            break;
        }
      });
    }

    function cs_checkNetworkType() {
      var voice = _mobileConnection.voice;
      var data = _mobileConnection.data;
      _imsHandler = _mobileConnection.imsHandler;
      if (_imsHandler &&
        (_imsHandler.capability === 'voice-over-wifi' ||
        _imsHandler.capability === 'video-over-wifi')) {
        _currentType = _imsHandler.capability;
        cs_updateNetworkTypeLimitedItemsVisibility(_currentType);
      } else if (voice && voice.state === 'registered' &&
        voice.connected === true) {
        _currentType = _networkTypeCategory[voice.type];
        cs_updateNetworkTypeLimitedItemsVisibility(_currentType);
      } else if (data && data.state === 'registered' &&
        data.connected === true) {
        _currentType = _networkTypeCategory[data.type];
        cs_updateNetworkTypeLimitedItemsVisibility(_currentType);
      } else {
        console.log('can not registered');
        cs_updateNetworkTypeLimitedItemsVisibility(null);
      }
    }

    function cs_addNetworkTypeCheckListener() {
      if (_mobileConnection.voice) {
        _mobileConnection.addEventListener('voicechange', cs_onTypeChange);
      }
      if (_mobileConnection.data) {
        _mobileConnection.addEventListener('datachange', cs_onTypeChange);
      }
      if (_imsHandler) {
        _imsHandler.addEventListener('capabilitychange',
          cs_onCapabilityChange);
      }
    }

    function cs_onTypeChange(evt) {
      var voiceType = _mobileConnection.voice && _mobileConnection.voice.type;
      var dataType = _mobileConnection.data && _mobileConnection.data.type;
      if (!voiceType && !dataType) {
        return;
      }
      var newType = _networkTypeCategory[voiceType || dataType];
      if (newType === _currentType) {
        return;
      } else {
        _currentType = newType;
      }
      cs_updateNetworkTypeLimitedItemsVisibility(newType);
    }

    function cs_onCapabilityChange() {
      if (_imsHandler.capability === 'voice-over-wifi' ||
        _imsHandler.capability === 'video-over-wifi') {
        if (_imsHandler.capability === _currentType) {
          return;
        } else {
          _currentType = newType;
        }
        cs_updateNetworkTypeLimitedItemsVisibility(_imsHandler.capability);
      }
    }

    //[LIO-241][BTS-2491] BDC matf remove call barring item for 50503 and 20810/11. begin
    function cs_updateCallBarringItemsVisibility(mcc,mnc) {
      if (!mcc || !mnc) {
        return false;
      }
      console.log("cs_updateCallBarringItemsVisibility mcc = "+mcc+" ; mnc ="+mnc);
      if (mcc == '505' && mnc == '03') {
        return true;
      }else if (mcc == '208' && (mnc == '10'|| mnc == '11')) {
        return true;
      }else {
        return false;
      }
    }
    //[LIO-241][BTS-2491] BDC matf remove call barring item for 50503 and 20810/11. end

    function removeHiddenFocus() {
      let focused = document.querySelectorAll('.focus');
      if (focused.length > 0) {
        for (var i = 0; i < focused.length; i++) {
          if (focused[i].hidden) {
            focused[i].classList.remove('focus');
          }
        }
      }
    }

    /**
     * Update the network type limited items' visibility based on the
     * voice type or data type.
     */
    function cs_updateNetworkTypeLimitedItemsVisibility(newType) {
      // The following features are limited to GSM types.
      let callForwardingItem =
        document.getElementById('menuItem-callForwarding');
      let callBarringItem =
        document.getElementById('menuItem-callBarring');

      let callWaitingItem = document.getElementById('menuItem-callWaiting');
      let callerIdItem = document.getElementById('menuItem-callerId');
      let dtmfItem = document.getElementById('menuItem-dtmf');
      // The following feature is limited to CDMA types.
      let voicePrivacyItem =
        document.getElementById('menuItem-voicePrivacyMode');
      let fdnMenuItem = document.getElementById('menuItem-callFdn');
      let hrefItem = callForwardingItem.querySelector('a');
      let callBarringHrefItem = callBarringItem.querySelector('a');/*[LIO-1670]Modify callBarring visible*/
      if (!newType) {
        voicePrivacyItem.hidden =
        callWaitingItem.hidden =
        callerIdItem.hidden =
        callForwardingItem.hidden =
        callBarringItem.hidden =
        dtmfItem.hidden = true;
        fdnMenuItem.hidden = false;
        removeHiddenFocus();
        window.dispatchEvent(new CustomEvent('refresh'));
        return;
      } else {
        voicePrivacyItem.hidden =
        callWaitingItem.hidden =
        callerIdItem.hidden =
        callForwardingItem.hidden =
        callBarringItem.hidden =
        fdnMenuItem.hidden =
        dtmfItem.hidden = true;
      }

      let enabled = (newType !== 'gsm' &&
        newType !== 'voice-over-wifi' && newType !== 'video-over-wifi');

      voicePrivacyItem.hidden =
        (newType !== 'cdma');

      let iccObj = getIccByIndex();
      let p1 = getSetting('callforward.settings.ui');
      let p2 = iccObj.getServiceState('fdn');
      Promise.all([p1, p2]).then((values) => {
        let isCFShow = values[0];
        let hasFdn = values[1];
        let cfHidden = enabled;
        if (hasFdn) {
          cs_updateFdnStatus(isCFShow).then(() => {
            if (isCFShow === HIDE) {
              cfHidden = true;
            }
            cs_updateMenuItems(enabled, cfHidden, hasFdn, newType);
          });
        } else {
        /*<<[LIO-1670]Modify callBarring visible*/
          if (DeviceFeature.getValue('vilte') === 'true') {
            callBarringHrefItem.setAttribute('href', '#call-cbsettings-list');
          } else {
            callBarringHrefItem.setAttribute('href', '#call-cbSettings');
          }
        /*>>[LIO-1670]Modify callBarring visible*/  
          if (isCFShow === HIDE) {
            cfHidden = true;
            cs_updateMenuItems(enabled, cfHidden, hasFdn, newType);
          } else if (isCFShow === GRAYOUT) {
            callForwardingItem.classList.add('none-select');
            callForwardingItem.setAttribute('aria-disabled', 'true');
            hrefItem.removeAttribute('href');
            cs_updateMenuItems(enabled, cfHidden, hasFdn, newType);
          } else {
            callForwardingItem.classList.remove('none-select');
            callForwardingItem.removeAttribute('aria-disabled');
            if (DeviceFeature.getValue('vilte') === 'true') {
              hrefItem.setAttribute('href', '#call-cfsettings-list');
            } else {
              hrefItem.setAttribute('href', '#call-cfSettings');
            }
            cs_updateMenuItems(enabled, cfHidden, hasFdn, newType);
          }
        }
      });
    }

    function cs_updateMenuItems(enabled, cfHidden, hasFdn, newType) {
      let callWaitingItem = document.getElementById('menuItem-callWaiting');
      let callerIdItem = document.getElementById('menuItem-callerId');
      let callForwardingItem =
        document.getElementById('menuItem-callForwarding');
      let callBarringItem =
        document.getElementById('menuItem-callBarring');
      let fdnMenuItem = document.getElementById('menuItem-callFdn');
      let dtmfItem = document.getElementById('menuItem-dtmf');

      callWaitingItem.hidden = enabled;
      callerIdItem.hidden = enabled;
      callForwardingItem.hidden = cfHidden;

      //[LIO-241][BTS-2491] BDC matf remove call barring item for 50503 and 20810/11. begin
      let currentSimIndex = DsdsSettings.getIccCardIndexForCallSettings();
      let sim = SIMSlotManager.getSlots()[currentSimIndex];
      if(sim && sim.simCard != undefined && sim.simCard.iccInfo != undefined) {
       var simmcc = sim.simCard.iccInfo.mcc;
       var simmnc = sim.simCard.iccInfo.mnc;
        console.log(" cs_updateMenuItems simmcc = "+simmcc+" ; simmnc ="+simmnc);
       var hideCallBarring = cs_updateCallBarringItemsVisibility(simmcc,simmnc);
           console.log(" cs_updateMenuItems hideCallBarring = "+hideCallBarring);
        if (hideCallBarring){
          callBarringItem.hidden = true;
        }else{
          callBarringItem.hidden = enabled;
        }
      }
        console.log("cs_updateMenuItems callBarringItem.hidden = "+callBarringItem.hidden + " hasFdn: " + hasFdn);
      //[LIO-241][BTS-2491] BDC matf remove call barring item for 50503 and 20810/11 . end
      fdnMenuItem.hidden = !hasFdn;
      /*[BTS-206] change the FDN display start*/
      navigator.customization.getValue('fih.key.hide.fdn').then((result) => {
          if (result) {
              fdnMenuItem.hidden = true;
          }
      });
      /*[BTS-206] change the FDN display end*/
      dtmfItem.hidden = enabled;
      cs_updateDTMFStatus(newType);
      cs_updateVoicePrivacyItemState();
      removeHiddenFocus();
      window.dispatchEvent(new CustomEvent('refresh'));
    }


    function cs_updateDTMFStatus(networkType) {
      let dtmfItem = document.getElementById('menuItem-dtmf');
      //[CNT-660] BDC zhangwp modify for hide DTMF menu. begin
/*
      if (networkType === 'gsm') {
        dtmfItem.classList.add('none-select');
        dtmfItem.setAttribute('aria-disabled', 'true');
        _settings.createLock().set({'phone.dtmf.type' : 'long'});
      } else {
        dtmfItem.classList.remove('none-select');
        dtmfItem.removeAttribute('aria-disabled');
        _settings.removeObserver('phone.dtmf.type', cs_showToast);
        _settings.addObserver('phone.dtmf.type', cs_showToast);
      }
*/
      let currentSimIndex = DsdsSettings.getIccCardIndexForCallSettings();
      let sim = SIMSlotManager.getSlots()[currentSimIndex];
      if(sim && sim.simCard != undefined && sim.simCard.iccInfo != undefined) {
        if(sim.simCard.iccInfo.iccType === 'ruim' || sim.simCard.iccInfo.iccType === 'csim') {
          dtmfItem.classList.remove('none-select');
          dtmfItem.removeAttribute('aria-disabled');
          window.navigator.mozSettings.removeObserver('phone.dtmf.type', cs_showToast);
          window.navigator.mozSettings.addObserver('phone.dtmf.type', cs_showToast);
        } else {
          dtmfItem.hidden = true;
          dtmfItem.classList.add('none-select');
          dtmfItem.setAttribute('aria-disabled', true);
          _settings.createLock().set({'phone.dtmf.type' : 'long'});
        }
      } else {
        dtmfItem.hidden = true;
      }
      //[CNT-660] BDC zhangwp modify for hide DTMF menu. end
    }

    function cs_showToast() {
      showToast('changessaved');
    }

    function cs_removeNetworkTypeCheckListener() {
      if (_mobileConnection.voice) {
        _mobileConnection.removeEventListener('voicechange', cs_onTypeChange);
      }
      if (_mobileConnection.data) {
        _mobileConnection.removeEventListener('datachange', cs_onTypeChange);
      }
      if (_imsHandler) {
        _imsHandler.removeEventListener('capabilitychange', cs_onCapabilityChange);
      }
    }

    function cs_updateVoicePrivacyItemState() {
      var menuItem = document.getElementById('menuItem-voicePrivacyMode');
      if (!menuItem || menuItem.hidden) {
        return;
      }

      var privacyModeSelect = menuItem.querySelector('select');
      var getReq = _mobileConnection.getVoicePrivacyMode();
      getReq.onsuccess = function get_vpm_success() {
        privacyModeSelect.value = getReq.result;
      };
      getReq.onerror = function get_vpm_error() {
        console.warn('get voice privacy mode: ' + getReq.error.name);
      };
    }

    /**
     * Init voice privacy mode.
     */
    function cs_initVoicePrivacyMode() {
      var defaultVoicePrivacySettings =
      Array.prototype.map.call(_mobileConnections,
        function() { return [true, true]; });
      var voicePrivacyHelper =
        SettingsHelper('ril.voicePrivacy.enabled', defaultVoicePrivacySettings);
      var privacyModeItem =
        document.getElementById('menuItem-voicePrivacyMode');
      var privacyModeSelect =
        privacyModeItem.querySelector('select');

      privacyModeSelect.addEventListener('change',
        function vpm_inputChanged() {
          var checked = (privacyModeSelect.value === 'true' || false);
          voicePrivacyHelper.get(function gotVP(values) {
            var originalValue = !checked;
            var setReq = _mobileConnection.setVoicePrivacyMode(checked);
            setReq.onsuccess = function set_vpm_success() {
              var targetIndex = DsdsSettings.getIccCardIndexForCallSettings();
              values[targetIndex] = !originalValue;
              voicePrivacyHelper.set(values);
            };
            setReq.onerror = function get_vpm_error() {
              // restore the value if failed.
              privacyModeSelect.value = originalValue;
            };
          });
      });
    }

    /**
     *
     */
    function cs_updateFdnStatus(isCFShow) {
      return new Promise((resolve) => {
        let iccObj = getIccByIndex();
        if (!iccObj) {
          return;
        }

        let req = iccObj.getCardLock('fdn');
        req.onsuccess = function spl_checkSuccess() {
          let enabled = req.result.enabled;
          _settings.createLock().set({'ril.fdn.enabled' : enabled});

          let fdnSettingsBlocked =
            document.querySelector('#fdnSettingsBlocked');
          if (fdnSettingsBlocked) {
            fdnSettingsBlocked.hidden = !enabled;
          }

          let callWaitingItem =
            document.getElementById('menuItem-callWaiting');
          let callWaitingHrefItem = callWaitingItem.querySelector('a');
          let callerIdItem =
           document.getElementById('menuItem-callerId');
          let callerIdHrefItem = callerIdItem.querySelector('a');
          let callForwardingItem =
            document.getElementById('menuItem-callForwarding');
          let hrefItem = callForwardingItem.querySelector('a');
          let callBarringItem =
            document.getElementById('menuItem-callBarring');
          let callBarringHrefItem = callBarringItem.querySelector('a');

          if (enabled) {
            callWaitingItem.classList.add('none-select');
            callWaitingItem.setAttribute('aria-disabled', 'true');
            callWaitingHrefItem.removeAttribute('href');

            callerIdItem.classList.add('none-select');
            callerIdItem.setAttribute('aria-disabled', 'true');
            callerIdHrefItem.removeAttribute('href');

            if (isCFShow === HIDE) {
              callForwardingItem.hidden = true;
            } else {
              callForwardingItem.classList.add('none-select');
              callForwardingItem.setAttribute('aria-disabled', 'true');
              hrefItem.removeAttribute('href');
            }

            callBarringItem.classList.add('none-select');
            callBarringItem.setAttribute('aria-disabled', 'true');
            callBarringHrefItem.removeAttribute('href');
          } else {
            callWaitingItem.classList.remove('none-select');
            callWaitingItem.removeAttribute('aria-disabled');
            callWaitingHrefItem.setAttribute('href', '#call-waiting');

            callerIdItem.classList.remove('none-select');
            callerIdItem.removeAttribute('aria-disabled');
            callerIdHrefItem.setAttribute('href', '#call-caller-id');

            if (isCFShow === HIDE) {
              callForwardingItem.hidden = true;
            } else if (isCFShow === GRAYOUT) {
              callForwardingItem.classList.add('none-select');
              callForwardingItem.setAttribute('aria-disabled', 'true');
              hrefItem.removeAttribute('href');
            } else {
              callForwardingItem.classList.remove('none-select');
              callForwardingItem.removeAttribute('aria-disabled');
              if (DeviceFeature.getValue('vilte') === 'true') {
                hrefItem.setAttribute('href', '#call-cfsettings-list');
              } else {
                hrefItem.setAttribute('href', '#call-cfSettings');
              }
            }

            callBarringItem.classList.remove('none-select');
            callBarringItem.removeAttribute('aria-disabled');
            if (DeviceFeature.getValue('vilte') === 'true') {
              callBarringHrefItem.setAttribute('href', '#call-cbsettings-list');
            } else {
              callBarringHrefItem.setAttribute('href', '#call-cbSettings');
            }
          }
          resolve();
        };
      });
    }

    return {
      init:  function(panel) {
        cs_init();
      },
      onBeforeShow: function() {
        cs_addNetworkTypeCheckListener();
      },
      onBeforeHide: function() {
        cs_removeNetworkTypeCheckListener();
      }
    };
  };
  return CallSettings;
});
