/*
  Message app settings related value and utilities.
*/

/* global MobileOperator, Promise */

/* exported Settings */


'use strict';

let Settings = {
  SERVICE_ID_KEYS: {
    smsServiceId: 'ril.sms.defaultServiceId',
    telephonyServiceId: 'ril.telephony.defaultServiceId',
    dataServiceId: 'ril.data.defaultServiceId',
    dataIccId: 'ril.data.defaultServiceId.iccId',
    backUpServiceId: 'ril.backUp.data.defaultServiceId',
    backUpIccId: 'ril.backUp.data.defaultServiceId.iccId'
  },

  READ_AHEAD_THREADS_KEY: 'ril.sms.maxReadAheadEntries',

  // we evaluate to 5KB the size overhead of wrapping a payload in a MMS
  MMS_SIZE_OVERHEAD: 5 * 1024,

  _serviceIds: null,

  // we need to remove this when email functionality is ready.
  supportEmailRecipient: true,

  // We set the default maximum concatenated number of our SMS app to 10
  // based on:
  // https://bugzilla.mozilla.org/show_bug.cgi?id=813686#c0
  maxConcatenatedMessages: 10,
  mmsSizeLimitation: 295 * 1024, // Default mms message size limitation is 295K
  smsServiceId: null, // Default sms service SIM ID
  telephonyServiceId: null,
  dataServiceId: null, // Default data service SIM ID
  dataIccId: null, // Default data service ICC ID
  backUpServiceId: null, // DSDS mms switch data connection back up.
  backUpIccId: null,
  emailAppInstalled: false,
  dataEnable: true, // Default the data switch is on.
  mmsEnable: true,
  CMASEnable: true,
  RTTEnable: false,
  RTTPreferred: 'visible-during-calls',
  isGroup: false,
  groupSwitchEnabled: true,
  notShownGroup: false,
  fakeSIMNumberArray: [null, null],
  originalSIMNumberArray: [],
  originalSIMInfoArray: [],
  creationMode: 'free',
  /* << [BTS-415] BDC kanxj 201900408 add to support SMS centre editing */
  smscSim1: null,
  smscSim2: null,
  /* << BTS-2381: kanxj 20190731 add to support dualsim smsc config >> */
  smsc1EditEnable: 0,
  smsc2EditEnable: 0,
  /* >> [BTS-415] */
  /* BDC kanxj 20190627 add for DUT cannot send MMS over VoWiFi in flight mode */
  allowMmsWhenDataOff: true, // Default value allowMmsWhenDataOff is on.
  /* << BTS-2534: kanxj 20190812 WAP Push must be disabled for Vodafone AU (505-03) SIM cards */
  wappush1Enable: true,
  wappush2Enable: true,
  /* >> [BTS-2534] */

  init: function settings_init() {
    let keyHandlerSet = {
      'dom.mms.operatorSizeLimitation': this.initMmsSizeLimitation.bind(this),
      'operatorResource.sms.maxConcat': this.initSmsMaxConcatenatedMsg.bind(this),
      'ril.mms.groupSwitch.enabled': this.initGroupEnableValue.bind(this),
      'ril.mms.groupAlert.notshow': this.initNotShowGroupAlert.bind(this)
    };
    let conns = navigator.mozMobileConnections;

    // For 256mb device, default use the manual retrieve.
    navigator.getFeature('hardware.memory').then((value) => {
      // Only set the value when first launch message.
      Utils.getSettingsValue('message.not.first.launch').then((notFirst) => {
        if (!notFirst && value <= 256) {
          Utils.setSettingsValue({ 'ril.mms.retrieval_mode': 'manual' });
          Utils.setSettingsValue({ 'message.not.first.launch': true });
        }
      });
    });

    navigator.hasFeature('device.capability.group-message').then((hasGroup) => {
      Startup.hasGroup = hasGroup;

      if (Startup.hasGroup) {
        // Set the default value and judge the SIM switch situation.
        Utils.judgeSwitchSIMSituation();
      }
    });

    function setHandlerMap(key) {
      Utils.getSettingsValue(key).then((value) => {
        let handler = keyHandlerSet[key];
        handler(value);

        // Some value in these can be controlled by the operator.
        Utils.observerSettingsValue(key, (value) => {
          handler(value);
        });
      });
    }

    this._serviceIds = [];

    // Need record the settings value, we reject send/download MMS if data is OFF,
    // please check bug 56531 for detail.
    Utils.getSettingsValue('ril.data.enabled').then((value) => {
      if (value !== undefined) {
        Settings.dataEnable = value;
      }

      Utils.observerSettingsValue('ril.data.enabled', (value) => {
        Settings.dataEnable = value;
      });
    });

    /* BDC kanxj 20190627 add for DUT cannot send MMS over VoWiFi in flight mode start */
    Utils.getSettingsValue('ril.mms.service_mode').then((value) => {
      if (value == 1) {
        Settings.allowMmsWhenDataOff = true;
      } else {
        Settings.allowMmsWhenDataOff = false;
      }
    });
    /* BDC kanxj 20190627 add for DUT cannot send MMS over VoWiFi in flight mode end */
    Utils.getSettingsValue('mms.enable').then((value) => {
      if (value !== undefined) {
        Settings.mmsEnable = value;
      }

      if (!Settings.mmsEnable) {
        Settings.supportEmailRecipient = false;
      }
      SettingsUI.init();
    });

    // RTT settings, there are two value to decide the RTT feature.
    Utils.getSettingsValue('ril.rtt.enabled').then((value) => {
      if (value !== undefined) {
        Settings.RTTEnable = value;
      }

      Utils.observerSettingsValue('ril.rtt.enabled', (value) => {
        Settings.RTTEnable = value;
      });
    });

    Utils.getSettingsValue('ril.rtt.preferredSettings').then((value) => {
      if (value !== undefined) {
        Settings.RTTPreferred = value;
      }

      Utils.observerSettingsValue('ril.rtt.preferredSettings', (value) => {
        Settings.RTTPreferred = value;
      });
    });

    Utils.getSettingsValue('ril.mms.creation_mode').then((value) => {
      if (value !== undefined) {
        Settings.creationMode = value;
      }

      Utils.observerSettingsValue('ril.mms.creation_mode', (value) => {
        Settings.creationMode = value;
      });
    });

    let hasCMAS = document.getElementById('hasCMASId');
    this.CMASEnable = hasCMAS.textContent === 'true' ? true : false;

    // Only DSDS will need to handle mmsServiceId
    if (conns && conns.length > 1) {
      for (let prop in this.SERVICE_ID_KEYS) {
        let setting = this.SERVICE_ID_KEYS[prop];
        keyHandlerSet[setting] =
          this.initServiceId.bind(this, setting, prop);
      }

      // Cache all existing serviceIds
      for (let i = 0, l = conns.length; i < l; i++) {
        this._serviceIds.push(conns[i].iccId);
      }
    }

    for (let key in keyHandlerSet) {
      setHandlerMap(key);
    }

    this.checkEmailInstalled();

    /* << [BTS-415] BDC kanxj 201900408 add to support SMS centre editing >> */
    this.getSmscEditableSetting();
    /* >> [BTS-415] */
    /* << BTS-2534: kanxj 20190812 WAP Push must be disabled for Vodafone AU (505-03) SIM cards >> */
    this.getwappushDefaultSettings();
  },

  /* << BTS-2381: kanxj 20190731 add to support dualsim smsc config */
  getSmscEditableSetting: function getSmscEditableSetting() {
    var slots = SIMSlotManager.getSlots();
    let isDualSim = Settings.isDualSimDevice();
    let matchInfo = {
        "clientId": "0",
    };

    if (!slots[0].isAbsent()) {
       matchInfo.clientId = '0';
       navigator.customization.getValueForCarrier(matchInfo, 'ril.smsc.edit.enable').then((result) => {
          Settings.smsc1EditEnable = (result === undefined) ? 0 : result;
          dump("Settings.smsc1EditEnable :" + Settings.smsc1EditEnable);
      });
    }

    if (isDualSim && !slots[1].isAbsent()) {
      matchInfo.clientId = '1';
      navigator.customization.getValueForCarrier(matchInfo, 'ril.smsc.edit.enable').then((result) => {
          Settings.smsc2EditEnable = (result === undefined) ? 0 : result;
          dump("Settings.smsc2EditEnable :" + Settings.smsc2EditEnable);
      });
    }
  },
  /* >> BTS-2381 */

  /* << BTS-2534: kanxj 20190812 WAP Push must be disabled for Vodafone AU (505-03) SIM cards */
  getwappushDefaultSettings: function getSmscEditableSetting() {
    var slots = SIMSlotManager.getSlots();
    let isDualSim = Settings.isDualSimDevice();
    let matchInfo = {
        "clientId": "0",
    };

    if (!slots[0].isAbsent()) {
       matchInfo.clientId = '0';
       navigator.customization.getValueForCarrier(matchInfo, 'wap.push.enabled.sim1').then((result) => {
         if (result !== undefined) {
           Settings.wappush1Enable = result;
         }
         dump("Settings.wappush1Enable result = :" + result);
      });
    }

    if (isDualSim && !slots[1].isAbsent()) {
      matchInfo.clientId = '1';
      navigator.customization.getValueForCarrier(matchInfo, 'wap.push.enabled.sim2').then((result) => {
        if (result !== undefined) {
          Settings.wappush2Enable = result;
        }
        dump("Settings.wappush2Enable result = :" + result);
      });
    }
  },
  /* >> BTS-2534 */

  //Set Maximum concatenated number of our SMS
  initSmsMaxConcatenatedMsg: function initSmsMaxConcatenatedMsg(num) {
    if (num && !isNaN(num)) {
      this.maxConcatenatedMessages = num;
    }
  },

  // Set MMS size limitation:
  // If operator does not specify MMS message size, we leave the decision to
  // MessageManager and return nothing if we can't get size limitation from db
  initMmsSizeLimitation: function initMmsSizeLimitation(size) {
    /* BDC kanxj 20190318 porting to support mms size config begin */
    /* Mark original code */
    /*if (size && !isNaN(size)) {
      this.mmsSizeLimitation = size - this.MMS_SIZE_OVERHEAD;
    }*/
    Utils.getSettingsValue('messaging.mms.max.size').then((result) => {
        dump("messaging.mms.max.size:" + result+",size :"+size);
        if (result !== undefined) {
            // customized for Argon-begin
            var mmsCustomizeSize = 0;
            switch (result) {
                case 0:
                    mmsCustomizeSize = 100;
                    break;
                case 1:
                    mmsCustomizeSize = 300;
                    break;
                case 2:
                    mmsCustomizeSize = 600;
                    break;
                case 3:
                    mmsCustomizeSize = 1024;
                    break;
                default:
                    mmsCustomizeSize = 300;
                    break;
            }
            // customized for Argon-end

            if (result >= 0) {
                Settings.mmsSizeLimitation = mmsCustomizeSize * 1024- Settings.MMS_SIZE_OVERHEAD;
                console.log("Settings.mmsSizeLimitation:" + Settings.mmsSizeLimitation);
            } else {
                if (size && !isNaN(size)) {
                    this.mmsSizeLimitation = size - this.MMS_SIZE_OVERHEAD;
                }
            }           
            console.log("messaging.mms.max.size,get customization value:" + result + ",mmsSizeLimitation:" + Settings.mmsSizeLimitation);
        } else {
            console.log("messaging.mms.max.size is undefined,use default size:" + size);
            if (size && !isNaN(size)) {
                Settings.mmsSizeLimitation = size - Settings.MMS_SIZE_OVERHEAD;
            }
        }
        Settings.mmsLimitInited = true;
    });
    /* BDC kanxj 20190318 porting to support mms size config end */
  },

  initGroupEnableValue: function initGroupEnableValue(enabled) {
    this.groupSwitchEnabled = enabled;
  },

  initNotShowGroupAlert: function initNotShowGroupAlert(enabled) {
    this.notShownGroup = enabled;
  },

  // Set default mms service SIM ID and add observer:
  // In DSDS scenario, if we notify user to switch to subscription to retrieve
  // the MMS from non-active subscription, we'll need current mmsServiceId
  // information to tell user the active/non-active subscription
  initServiceId: function initMmsServiceId(settingName, propName, id) {
    if (id !== undefined) {
      Settings[propName] = id;
    }
  },

  setMmsSimServiceId: function setSimServiceId(id, iccId) {
    // DSDS: mms & data are both necessary for connection switch.
    // Need set IccID to confirm the data can not be reset to
    // default by ststem protection rule.
    Utils.setSettingsValue({
      'ril.data.defaultServiceId': id,
      'ril.data.defaultServiceId.iccId': iccId
    });
  },

  switchMmsSimHandler: function switchSimHandler(targetId, iccId) {
    let conn = window.navigator.mozMobileConnections[targetId];
    return new Promise((resolve, reject) => {
      if (conn) {
        if (conn.data.connected) {
          // Call resolve directly if data connected already
          resolve();
        } else {
          // Listen to MobileConnections datachange to make sure we can start
          // to retrieve mms only when data.connected is true. But we can't
          // guarantee datachange event will work in other device.
          conn.addEventListener('datachange', function onDataChange() {
            if (conn.data.state === 'registered') {
              conn.removeEventListener('datachange', onDataChange);
              resolve();
            }
          });

          this.setMmsSimServiceId(targetId, iccId);
        }
      } else {
        reject('Invalid connection');
      }
    });
  },

  /**
   * returns true if the device has more than 1 SIM port
   */
  isDualSimDevice: function isDualSimDevice() {
    return this._serviceIds && this._serviceIds.length > 1;
  },

  /**
   * Returns true if the device has more than 1 SIM port and at least 2 SIMs are
   * inserted.
   */
  hasSeveralSim: function hasSeveralSim() {
    if (!this.isDualSimDevice()) {
      return false;
    }

    let simCount = this._serviceIds.reduce(function(simCount, iccId) {
      return iccId === null ? simCount : simCount + 1;
    }, 0);

    return simCount > 1;
  },

  getServiceIdByIccId: function getServiceIdByIccId(iccId) {
    if (!this._serviceIds) {
      return null;
    }

    let index = this._serviceIds.indexOf(iccId);

    return index > -1 ? index : null;
  },

  /**
   * Will return SIM1 or SIM2 (locale dependent) depending on the iccId.
   * Will return the empty string in a single SIM scenario.
   */
  getSimNameByIccId: function getSimNameByIccId(iccId) {
    let index = this.getServiceIdByIccId(iccId);
    if (index === null) {
      return '';
    }

    return navigator.mozL10n.get('sim-id-label', { id: index + 1 });
  },

  /**
   * Will return operator name depending on the iccId.
   * Will return the empty string in a single SIM scenario.
   */
  getOperatorByIccId: function getOperatorByIccId(iccId) {
    let index = this.getServiceIdByIccId(iccId);
    if (index === null) {
      return '';
    }

    let conn = navigator.mozMobileConnections[index];
    return MobileOperator.userFacingInfo(conn).operator;
  },

  setReadAheadThreadRetrieval: function(value) {
    let setting = {};
    setting[this.READ_AHEAD_THREADS_KEY] = value;
    Utils.setSettingsValue(setting);
  },

  checkEmailInstalled: function() {
    let request = window.navigator.mozApps.mgmt.getAll();
    request.onerror = function() {
      console.log('get all installed apps error: ' + request.error.name);
    };
    request.onsuccess = function(evt) {
      let installedApps = evt.target.result;
      Settings.emailAppInstalled = installedApps.some(function(app) {
        return (app.manifestURL === 'app://email.gaiamobile.org/manifest.webapp');
      });
    };
  },

  getOperatorName: function(id) {
    let conns = window.navigator.mozMobileConnections;
    let carrier = '';
    let spnName = '';

    // get network operator name.
    if (conns[id] && conns[id].voice.network) {
      carrier = conns[id].voice.network.shortName ||
                conns[id].voice.network.longName;
    }

    // get sim operator name.
    let iccid = Settings._serviceIds[id];
    let iccObj = navigator.mozIccManager.getIccById(iccid);
    if (iccObj) {
      let iccInfo = iccObj.iccInfo;
      if (iccInfo) {
        spnName = iccInfo.spn;
      }
    }

    if (spnName) {
      return spnName;
    } else {
      return carrier;
    }
  }
};


/*
  define export SettingsUI
 */

(function(exports) {

  'use strict';

  let SettingsUI = {
    initialized: false,

    init: function sui_init() {
      let settings = document.getElementById('messaging-settings');
      if (settings.innerHTML.length === 0) {
        let template;
        if (Settings.mmsEnable) {
          template = Template('messaging-settings-view-tmpl');
        } else {
          template = Template('messaging-settings-view-tmpl-noMMS');
        }
        settings.innerHTML = template.toString();
      }

      // bug1825-chengyanzhang@t2moblie.com-for disable emergency alert-begin
      Utils.getSettingsValue('def.enable.cellbroadcast').then((isEnableCellBroadcast) => {
        console.log('isEnableCellBroadcast===>' +isEnableCellBroadcast);
        if (isEnableCellBroadcast!== undefined && !isEnableCellBroadcast) {
          var emergencyAlert = document.getElementById('emergency-alert-item');
          var emergencyAlertHeader = document.getElementById('emergency-alert-header');
          if (emergencyAlert != undefined && emergencyAlert != null &&
            emergencyAlertHeader != undefined && emergencyAlertHeader !=null) {
            emergencyAlert.classList.add('hidden');
            emergencyAlert.classList.remove('navigable');
            emergencyAlertHeader.classList.add('hidden');
            emergencyAlertHeader.classList.remove('navigable');
          }
        }
      });
      // bug1825-chengyanzhang@t2moblie.com-for disable emergency alert-end

      // Some production does not need group feature.
      if (!Startup.hasGroup && Settings.mmsEnable) {
        let groupSettings =
            document.getElementById('group-message-number-set-sim1').parentNode;
        let groupHeader = document.getElementById('group-message-header');
        groupSettings.classList.add('hide');
        let groupNodes = groupSettings.querySelectorAll('.navigable');
        for (let i = 0; i < groupNodes.length; i++) {
          groupNodes[i].classList.remove('navigable');
        }
        groupHeader.classList.add('hide');
      }

      // Some production does not need CMAS.
      if (!Settings.CMASEnable) {
        let CMASHeader = document.getElementById('emergency-alert-header');
        CMASHeader.classList.add('hide');
        let CMASItem = document.getElementById('emergency-alert-item');
        CMASItem.classList.remove('navigable');
        CMASItem.parentNode.classList.add('hide');
      }

      this.selectDualorSingleDisplay();
      /* << [BTS-415] BDC kanxj 201900408 add to support SMS centre editing >> */
      this.selectSmscDisplay();
      /* >> [BTS-415] */
    },

    _updateSKs: function() {
      let skSettingsOK = {
        l10nId: 'select',
        priority: 2
      };

      if (document.activeElement.classList.contains('disable-item') || 
          document.activeElement.classList.contains('disable-click-item') || 
          document.activeElement.id === 'group-message-number-description') {
        skSettingsOK = {
          name: '',
          priority: 2
        }
      }

      let params = {
        header: { l10nId: 'options' },
        items: [skSettingsOK]
      };
      if (exports.option) {
        exports.option.initSoftKeyPanel(params);
      } else {
        exports.option = new SoftkeyPanel(params);
      }
      exports.option.show();
    },

    beforeLeave: function() {
      window.removeEventListener('keydown', SettingsUI._handleKeyEvent);
      window.removeEventListener('change', SettingsUI._selectChange);
    },

    afterEnter: function() {
      this._updateSKs();
      SettingsUI.render();
      /* << [BTS-415] BDC kanxj 201900408 add to support SMS centre editing >> */
      this.getSmscAddress();
      this.updateSmscMenu();
      window.addEventListener('keydown', SettingsUI._handleKeyEvent);
      window.addEventListener('change', SettingsUI._selectChange);
    },

    afterLeave: function() {
      if (exports.option) {
        exports.option.show();
      }
    },

    _selectChange: function(event) {
      let selectValue = event.target.value;
      let flag;
      switch (selectValue) {
        case 'deliverySMSOn':
        case 'deliverySMSOff':
          flag = selectValue === 'deliverySMSOn' ? true : false;
          Utils.setSettingsValue(
              { 'ril.sms.requestStatusReport.enabled': flag });
          break;
        case 'deliveryMMSOn':
        case 'deliveryMMSOff':
          flag = selectValue === 'deliveryMMSOn' ? true : false;
          Utils.setSettingsValue(
              { 'ril.mms.requestStatusReport.enabled': flag });
          break;
        case 'manual':
        case 'automatic':
        case 'automatic-home':
          flag = selectValue;
          Utils.setSettingsValue({ 'ril.mms.retrieval_mode': flag });
          break;
        case 'restricted':
        case 'warning':
        case 'free':
          flag = selectValue;
          Utils.setSettingsValue({ 'ril.mms.creation_mode': flag });
          break;
        case 'sim1On':
        case 'sim1Off':
          flag = selectValue === 'sim1On' ? true : false;
          Utils.setSettingsValue({ 'wap.push.enabled.sim1': flag });
          break;
        case 'sim2On':
        case 'sim2Off':
          flag = selectValue === 'sim2On' ? true : false;
          Utils.setSettingsValue({ 'wap.push.enabled.sim2': flag });
          break;
        case 'groupSwitchOn':
        case 'groupSwitchOff':
          flag = selectValue === 'groupSwitchOn' ? true : false;
          Startup.groupSwitchEnabled = flag;
          Utils.setSettingsValue({ 'ril.mms.groupSwitch.enabled': flag });
          break;
        /* << [BTS-410]: BDC kanxj 20190318 porting to support Full/reduce character in SMS */
        case 'reduceMode':
        case 'fullMode':
          flag = selectValue === 'reduceMode' ? 0 : 1;
          Utils.setSettingsValue({ 'ril.sms.encoding_mode': flag });
          break;
        /* >> [BTS-410] */
        default:
          break;
      }
    },

    _handleKeyEvent: function(event) {
      switch (event.key) {
        case 'BrowserBack':
        case 'Backspace':
          event.preventDefault();
          SettingsUI._back();
          break;
        case 'Accept':
        case 'Enter':
          SettingsUI._openSelectItem();
          break;
        case 'ArrowUp':
          let firstLiElement = document.querySelector('#deliveryReport-SMS-item'),
              firstLiElementHeader = firstLiElement.parentElement.previousElementSibling;
          if (firstLiElement.classList.contains('focus')) {
            firstLiElementHeader.scrollIntoView();
          }
          SettingsUI._updateSKs();
          break;
        case 'ArrowDown':
          SettingsUI._updateSKs();
          break;
      }
    },

    _back: function() {
      Navigation.toPanel('thread-list');
    },

    _openSelectItem: function() {
      let focusedItems = document.querySelectorAll('.focus');
      if (focusedItems.length > 0) {
        let focusItem = focusedItems[0];
        let viewPanel = SettingsUI._getViewPanel(focusItem);

        if (focusItem.classList.contains('disable-item') || 
            focusItem.classList.contains('disable-click-item')) {
          return;
        }

        if (focusItem.id === 'emergency-alert-item') {
          return new MozActivity({
            name: 'configure',
            data: { section: 'emergency-alert' }
          });
        }

        // Allow the user inputs themselves phone number.
        if (viewPanel === 'group-number-set-sim1' ||
            viewPanel === 'group-number-set-sim2') {
          // Pick sim card information to make the operator easy.
          let simFlag = viewPanel.substr(-4);
          let defaultNumber;
          let defaultSettings;
          if (simFlag === 'sim1') {
            defaultNumber = Settings.fakeSIMNumberArray[0];
            defaultSettings = 'ril.mms.phoneNumber.sim1'
          } else {
            defaultNumber = Settings.fakeSIMNumberArray[1];
            defaultSettings = 'ril.mms.phoneNumber.sim2'
          }

          // Confirm the body is not null/undefined.
          if (!defaultNumber) {
            defaultNumber = '';
          }

          Utils.inputDialogShow('device-phone-number', defaultNumber,
                                '', simFlag, (number) => {
            let elem = document.getElementsByName(defaultSettings)[0];
            if (simFlag === 'sim1') {
              Utils.setSettingsValue({ 'ril.mms.phoneNumber.sim1': number });
              Settings.fakeSIMNumberArray[0] = number;
            } else {
              Utils.setSettingsValue({ 'ril.mms.phoneNumber.sim2': number });
              Settings.fakeSIMNumberArray[1] = number;
            }
            defaultNumber = number;
            if (number) {
              elem.textContent = number;
            } else {
              navigator.mozL10n.setAttributes(elem, 'not-assigned');
            }
          });
        /* << [BTS-415] BDC kanxj 201900408 add to support SMS centre editing */
        /* << BTS-2381: kanxj 20190731 add to support dualsim smsc config >>*/
        } else if (viewPanel === 'smsc-number-set-sim1' || viewPanel === 'smsc-number-set-sim2') {
          /* << LIO-809: kanxj 20200720 DUT can't edit message center */
          let simId = viewPanel.substr(-4);
          let defaultNum;
          if (simId === 'sim1') {
            defaultNum = Settings.smscSim1;
          } else {
            defaultNum = Settings.smscSim2;
          }
          Utils.inputDialogShow('smscNormal', defaultNum,
                                '', simId, (number) => {
            if (simId === 'sim1') {
              let smscSimView = document.getElementById('smsc-number-sim1');
              let holderNode = smscSimView.querySelector('small');
              holderNode.textContent = number;
              Settings.smscSim1 = number;
              SettingsUI.setSmscAddress(number, 0);
            } else {
              let smscSimView = document.getElementById('smsc-number-sim2');
              let holderNode = smscSimView.querySelector('small');
              holderNode.textContent = number;
              Settings.smscSim2 = number;
              SettingsUI.setSmscAddress(number, 1);
            }
          });
          /* >> LIO-809 */
        /* >> [BTS-415] */
        } else {
          let selectItems = focusedItems[0].querySelector('select');
          selectItems && selectItems.focus();
        }
      }
    },

    _getViewPanel: function(target) {
      return target.getAttribute('name');
    },

    selectDualorSingleDisplay: function () {
      let isDualSim = Settings.isDualSimDevice();
      let viewSim1 = document.getElementsByName('wap-push-view-sim1')[0];
      let viewSim2 = document.getElementsByName('wap-push-view-sim2')[0];
      let viewSim1Span = viewSim1.getElementsByTagName('span')[0];
      let viewSim2Span = viewSim2.getElementsByTagName('span')[0];
      let inputSim2 = document.getElementById('group-message-number-set-sim2');
      if (isDualSim) {
        /* << BTS-2534: kanxj 20190812 WAP Push must be disabled for Vodafone AU (505-03) SIM cards */
        if (!Settings.wappush1Enable) {
          viewSim1.classList.add('disable-item');
          viewSim1Span.setAttribute('data-l10n-id', 'wappushSIM1');
        } else {
          viewSim1Span.setAttribute('data-l10n-id', 'wappushSIM1');
        }

        if (!Settings.wappush2Enable) {
          viewSim2Span.setAttribute('data-l10n-id', 'wappushSIM2');
          viewSim2.classList.add('disable-item');
        } else {
          viewSim2Span.setAttribute('data-l10n-id', 'wappushSIM2');
        }
        /* >> BTS-2534 */
      } else {
        /* << BTS-2534: kanxj 20190812 WAP Push must be disabled for Vodafone AU (505-03) SIM cards */
        if (!Settings.wappush1Enable) {
          viewSim1Span.setAttribute('data-l10n-id', 'wappushNormal');
          viewSim1.classList.add('disable-item');
          viewSim2.classList.add('hide');
          viewSim2.classList.remove('navigable');
        } else {
          viewSim1Span.setAttribute('data-l10n-id', 'wappushNormal');
          viewSim2.classList.add('hide');
          viewSim2.classList.remove('navigable');
        }
        /* >> BTS-2534 */
        inputSim2 && inputSim2.classList.add('hide');
        inputSim2 && inputSim2.classList.remove('navigable');
      }
    },

    countNotAssignedSIM: function() {
      let count = 0;
      for (let i = 0; i < Settings._serviceIds.length; i++) {
        if (Settings._serviceIds[i] === null) {
          count++;
        }
      }
      return count;
    },

    /* << [BTS-415] BDC kanxj 201900408 add to support SMS centre editing */
    getSmscAddress: function() {
      var slots = SIMSlotManager.getSlots();
      let isDualSim = Settings.isDualSimDevice();

      if (!slots[0].isAbsent()) {
        window.navigator.mozMobileMessage.getSmscAddress(0).then((result) => {
        //console.log("mozMobileMessage: getSmscAddress: result =  " , JSON.stringify(result));
          let smsc1 = result.address.split(',')[0].replace(/"/g, '');
          //console.log("mozMobileMessage: getSmscAddress: smsc1 = " + smsc1);
          if (smsc1) {
            Settings.smscSim1 = smsc1;
          } else {
            Settings.smscSim1 = 'unknown-SMSC';
          }
          SettingsUI.updateSmsc(0,smsc1);
        });
      }

      if (isDualSim && !slots[1].isAbsent()) {
        window.navigator.mozMobileMessage.getSmscAddress(1).then((result) => {
          let smsc2 = result.address.split(',')[0].replace(/"/g, '');
          //console.log("mozMobileMessage: getSmscAddress: smsc2 = " + smsc2);
          if (smsc2){
            Settings.smscSim2 = smsc2;
          } else {
            Settings.smscSim2 = 'unknown-SMSC';
          }
          SettingsUI.updateSmsc(1,smsc2);
        });
      }
    },

    setSmscAddress: function(number, index) {
      let options = {
        address: number
      };
      //console.log("setSmscAddress: ");
      window.navigator.mozMobileMessage.setSmscAddress(options, index)
      .catch( error => {
        console.error( 'onRejected function called: ' + error.message );
        window.navigator.mozMobileMessage.getSmscAddress(index).then((result) => {
          let address = result.address.split(',')[0].replace(/"/g, '');
          if (index == 0) {
            Settings.smscSim1 = address;
            SettingsUI.updateSmsc(0, address);
          } else if (index == 1) {
            Settings.smscSim2 = address;
            SettingsUI.updateSmsc(1, address);
          }
        });
      });
    },

    updateSmsc: function(index, address) {
      let smscView;
      if (index == 1) {
        smscView = document.getElementById('smsc-number-sim2');
      } else {
        smscView = document.getElementById('smsc-number-sim1');
      }

      if (smscView != null) {
        let holderNode = smscView.querySelector('small');
        holderNode.textContent = address;
        /* << BTS-2381: kanxj 20190731 add to support dualsim smsc config */
        if ((index == 0) && (Settings.smsc1EditEnable == 0)) {
          smscView.classList.add('disable-item');
        }
        if ((index == 1) && (Settings.smsc2EditEnable == 0)) {
          smscView.classList.add('disable-item');
        }
        /* >> BTS-2381 */
       }
     },

    updateSmscMenu: function() {
      if (Settings.isDualSimDevice() && !Settings.hasSeveralSim()) {
        let notAssignedSIMId = Settings._serviceIds.indexOf(null);
        let notAssignedSIMCount = SettingsUI.countNotAssignedSIM();
        let rootNode;
        if (notAssignedSIMCount === 2 || notAssignedSIMId === 0) {
          rootNode = document.getElementById('smsc-number-sim1');
          if (rootNode != null) {
            rootNode.querySelector('small').classList.remove('hide');
            rootNode.classList.add('disable-item');
            let small = rootNode.querySelector('small');
            small.textContent = navigator.mozL10n.get('not-assigned');
          }
        }
        if (notAssignedSIMCount === 2 || notAssignedSIMId === 1) {
          rootNode = document.getElementById('smsc-number-sim2');
          if (rootNode != null) {
            rootNode.classList.add('disable-item');
            let small = rootNode.querySelector('small');
            small.textContent = navigator.mozL10n.get('not-assigned');
          }
        }
      }
    },

    selectSmscDisplay: function () {
      let isDualSim = Settings.isDualSimDevice();
      let smscSim1View = document.getElementsByName('smsc-number-set-sim1')[0];
      let smscSim2View = document.getElementsByName('smsc-number-set-sim2')[0];
      let viewSim1Span = smscSim1View.getElementsByTagName('span')[0];
      let viewSim2Span = smscSim2View.getElementsByTagName('span')[0];

      if (isDualSim) {
        viewSim1Span.setAttribute('data-l10n-id', 'smscSIM1');
        viewSim2Span.setAttribute('data-l10n-id', 'smscSIM2');
         console.log("selectSmscDisplay: " );
      } else {
        viewSim1Span.setAttribute('data-l10n-id', 'smscNormal');
        smscSim2View.classList.add('hide');
        smscSim2View.classList.remove('navigable');
      }
    },
    /* >> [BTS-415] */

    render: function() {
      ['ril.sms.requestStatusReport.enabled', 'ril.mms.requestStatusReport.enabled',
       'ril.mms.retrieval_mode', 'ril.mms.creation_mode', 'wap.push.enabled.sim1',
       'wap.push.enabled.sim2', 'ril.mms.phoneNumber.sim1', 'ril.mms.phoneNumber.sim2',
       'airplaneMode.status', 'ril.mms.groupSwitch.enabled', 'ril.sms.encoding_mode'].forEach((item) => {
        Utils.getSettingsValue(item).then((value) => {
          let elem = document.getElementsByName(item)[0];
          let DualSIMSum = 2;
          switch (item) {
            case 'ril.mms.retrieval_mode':
              /* << BDC kanxj 20190318 porting to support mms default retrival mode start */
              if (Settings.mmsEnable) {
                if (value == '1') {
                  elem.value = "manual";
                } else if (value == '0') {
                  elem.value = "automatic-home";
                } else {
                  elem.value = value;
                }
                /* << BDC kanxj 20190318 porting to support mms default retrival mode end */
              }
              break;
            case 'ril.mms.creation_mode':
              if (Settings.mmsEnable) {
                elem.value = value ? value : 'free';
              }
              break;
            case 'ril.sms.requestStatusReport.enabled':
            case 'ril.mms.requestStatusReport.enabled':
              if (!Settings.mmsEnable && item === 'ril.mms.requestStatusReport.enabled') {
                break;
              }
              // Get the keyword SMS or MMS to build the delivery enable value.
              let typeFlag = item.substr(4, 3).toUpperCase();
              let deliveryEnable = value === true ? 'delivery' + typeFlag + 'On' :
                                                    'delivery' + typeFlag + 'Off';
              elem.value = deliveryEnable;
              break;
            case 'wap.push.enabled.sim1':
            case 'wap.push.enabled.sim2':
              // Pick sim card information to make the operator easy.
              let simFlag = item.substr(-4);
              let wappushEnable = value === true ? simFlag + 'On' : simFlag + 'Off';

              /* << BTS-2534: kanxj 20190812 WAP Push must be disabled for Vodafone AU (505-03) SIM cards */
              if (!Settings.wappush1Enable && (item === 'wap.push.enabled.sim1')) {
                elem.value = 'sim1Off';
              } else if (!Settings.wappush2Enable && (item === 'wap.push.enabled.sim2')) {
                elem.value = 'sim2Off'
              } else {
                elem.value = wappushEnable;
              }
              /* >> BTS-2534 */

              if (Settings.isDualSimDevice() && !Settings.hasSeveralSim()) {
                let notAssignedSIMId = Settings._serviceIds.indexOf(null);
                let notAssignedSIMCount = SettingsUI.countNotAssignedSIM();
                let rootNode;
                if ((notAssignedSIMCount === DualSIMSum ||
                     notAssignedSIMId === 0) &&
                    (item === 'wap.push.enabled.sim1')) {
                  rootNode = document.getElementById('wapPush-message-item-sim1');
                  rootNode.querySelector('small').classList.remove('hide');
                  rootNode.querySelector('select').classList.add('hide');
                  rootNode.classList.add('disable-item');
                } else if ((notAssignedSIMCount === DualSIMSum ||
                            notAssignedSIMId === 1) &&
                           (item === 'wap.push.enabled.sim2')) {
                  rootNode = document.getElementById('wapPush-message-item-sim2');
                  rootNode.querySelector('small').classList.remove('hide');
                  rootNode.querySelector('select').classList.add('hide');
                  rootNode.classList.add('disable-item');
                }
              } else {
                if (Utils.isNoSIMStatus()) {
                  let rootNode = document.getElementById('wapPush-message-item-sim1');
                  rootNode.querySelector('small').classList.remove('hide');
                  rootNode.querySelector('select').classList.add('hide');
                  rootNode.classList.add('disable-item');
                }
              }
              break;
            case 'ril.mms.phoneNumber.sim1':
            case 'ril.mms.phoneNumber.sim2':
              // No group supported device not handle it.
              if (!Startup.hasGroup) {
                break;
              }

              // Pick sim card information to make the operator easy.
              let simSelect = item.substr(-4);
              let inputLiSim1 = document.getElementById('group-message-number-set-sim1');
              let inputLiSim2 = document.getElementById('group-message-number-set-sim2');
              let originalSIMInfo = Settings.originalSIMInfoArray;
              let originalNumberInfo = Settings.originalSIMNumberArray;
              if (simSelect === 'sim1') {
                // No SIM status.
                if (!originalSIMInfo[0]) {
                  inputLiSim1.classList.add('disable-item');
                  navigator.mozL10n.setAttributes(elem, 'not-assigned');
                }
                // Have original number status.
                else if (originalSIMInfo[0] && originalNumberInfo[0]) {
                  inputLiSim1.classList.add('disable-click-item');
                  elem.textContent = originalNumberInfo[0];
                }
                // Not have original number status.
                else {
                  Settings.fakeSIMNumberArray[0] = value;
                  if (value) {
                    elem.textContent = value;
                  } else {
                    navigator.mozL10n.setAttributes(elem, 'not-assigned');
                  }
                }
              } else {
                // No SIM status.
                if (!originalSIMInfo[1]) {
                  inputLiSim2.classList.add('disable-item');
                  navigator.mozL10n.setAttributes(elem, 'not-assigned');
                }
                // Have original number status.
                else if (originalSIMInfo[1] && originalNumberInfo[1]) {
                  inputLiSim2.classList.add('disable-click-item');
                  elem.textContent = originalNumberInfo[1];
                }
                // Not have original number status.
                else {
                  Settings.fakeSIMNumberArray[1] = value;
                  if (value) {
                    elem.textContent = value;
                  } else {
                    navigator.mozL10n.setAttributes(elem, 'not-assigned');
                  }
                }
              }
              break;
            case 'airplaneMode.status':
              let CMASEmergencyItem = document.getElementById('emergency-alert-item');
              CMASEmergencyItem.classList.toggle('disable-item', (value === 'enabled'));
              break;
            case 'ril.mms.groupSwitch.enabled':
              // No group supported device not handle it.
              if (!Startup.hasGroup) {
                break;
              }

              let groupEnable =  value === true ? 'groupSwitchOn' : 'groupSwitchOff';
              elem.value = groupEnable;
              Startup.groupSwitchEnabled = value;
              break;
            /* << [BTS-410]: BDC kanxj 20190318 porting to support Full/reduce character in SMS */
            case 'ril.sms.encoding_mode':
              if(value == '0'){
                  elem.value =  'reduceMode';
              } else {
                  elem.value = 'fullMode';
              }
              break;
            /* >> [BTS-410] */
          }
        });
      });
    }
  };

  exports.SettingsUI = SettingsUI;
}(this));
