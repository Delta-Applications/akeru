/* global SettingsSoftkey */
/**
 * Used to show Emergency alert panel
 */
define(['require','modules/settings_panel','shared/settings_listener','shared/simslot_manager'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var SettingsListener = require('shared/settings_listener');

  return function ctor_emergency_alert_panel() {
    var settingElements = ['cmas.extreme.enabled', 'cmas.severe.enabled',
      'cmas.amber.enabled', 'cmas.safety.enabled',
      'cmas.weatest.enabled', 'cmas.monthlytest.enabled'];
    var listElements = document.querySelectorAll('#emergency-alert li');
    var alertinbox = document.getElementById('alert-inbox');
    let ringtonePreview = document.getElementById('wea-ringtone-preview');
    var softkeyParams = {
      menuClassName: 'menu-button',
      header: {
        l10nId: 'message'
      },
      items: [{
        name: 'Deselect',
        l10nId: 'deselect',
        priority: 2,
        method: function() {}
      }]
    };
    var params = {
      menuClassName: 'menu-button',
      header: {
        l10nId: 'message'
      },
      items: [{
        name: 'Select',
        l10nId: 'select',
        priority: 2
      }]
    };
    let elements = {};

    function _updateSoftkey() {
      var focusedElement = document.querySelector('#emergency-alert .focus');
      if (focusedElement && focusedElement.classList &&
          focusedElement.classList.contains('none-select')) {
        SettingsSoftkey.hide();
        return;
      }
      if (focusedElement && focusedElement.querySelector('input') &&
          focusedElement.querySelector('input').checked) {
        SettingsSoftkey.init(softkeyParams);
      } else {
        SettingsSoftkey.init(params);
      }
      SettingsSoftkey.show();
    }

    function _initAlertSettingListener() {
      var i = settingElements.length - 1;
      for (i; i >= 0; i--) {
        SettingsListener.observe(settingElements[i], true, _updateSoftkey);
      }
      /* << [BTS-3012]: BDC kanxj 20200306 add for IT alert */
      let alertItMenu = document.getElementById('emergency-alert-it-menu');
      alertItMenu.addEventListener('change', _showToast);
      /* >> [BTS-3012] */
    }

    function _removeAlertSettingListener() {
      var i = settingElements.length - 1;
      for (i; i >= 0; i--) {
        SettingsListener.unobserve(settingElements[i] , _updateSoftkey());
      }
      /* << [BTS-3012]: BDC kanxj 20200306 add for IT alert */
      let alertItMenu = document.getElementById('emergency-alert-it-menu');
      alertItMenu.removeEventListener('change', _showToast);
      /* >> [BTS-3012] */
    }

    /* << [BTS-3012]: BDC kanxj 20200306 add for IT alert */
    function _showToast() {
      showToast('cb-ita-IT-Alert-pop-toast');
    }
    /* >> [BTS-3012] */

    function _keyDownHandler(evt) {
      switch (evt.key) {
        case 'Enter':
          if ('alert-inbox' === evt.target.id) {
            try {
              new MozActivity({
                name: 'alert_inbox'
              });
            } catch (e) {
              console.error('Failed to create an alert_inbox activity: ' + e);
            }
          }
          break;
        default:
          break;
      }
    }

    /* << [LIO-1690]: BDC kanxj 20201109 add for The mandatory CMAS channels are not defaultly enabled */
    function initUAEMenu() {
      console.log('Emergency-alert customization operator is UAE');
      var warningAlertUaeMenu = document.getElementById('warning-alert-uae-menu');
      var pubsafeAlertUaeMenu = document.getElementById('cmas-safety-uae-menu');
      warningAlertUaeMenu.removeAttribute('hidden');
      pubsafeAlertUaeMenu.removeAttribute('hidden');

      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');
      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
    }

    function initILMenu() {
      console.log('Emergency-alert customization operator is IL');
      var extremeAlertIlMenu = document.getElementById('extreme-alert-il-menu');
      var warningNotificationIlMenu = document.getElementById('warning-notification-il-menu');
      var informationalIlMenu = document.getElementById('informational-il-menu');
      var testAlertIlMenu = document.getElementById('test-alert-il-menu');
      var exerciseIlMenu = document.getElementById('exercise-il-menu');
      var assistanceIlMenu = document.getElementById('assistance-il-menu');
      extremeAlertIlMenu.removeAttribute('hidden');
      warningNotificationIlMenu.removeAttribute('hidden');
      informationalIlMenu.removeAttribute('hidden');
      testAlertIlMenu.removeAttribute('hidden');
      exerciseIlMenu.removeAttribute('hidden');
      assistanceIlMenu.removeAttribute('hidden');

      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');
      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
    }

    function initLTMenu() {
      console.log('Emergency-alert customization operator is LT');
      var nationalEmergencyAlertLtMenu = document.getElementById('national-emergency-alert-lt-menu');
      var emergencyAlertLtMenu = document.getElementById('emergency-alert-lt-menu');
      var warningAlertLtMenu = document.getElementById('warning-alert-lt-menu');
      var testAlertLtMenu = document.getElementById('test-alert-lt-menu');
      nationalEmergencyAlertLtMenu.removeAttribute('hidden');
      emergencyAlertLtMenu.removeAttribute('hidden');
      warningAlertLtMenu.removeAttribute('hidden');
      testAlertLtMenu.removeAttribute('hidden');

      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');
      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
    }

    function initNLMenu() {
      console.log('Emergency-alert customization operator is NL');
      var alertNlMenu = document.getElementById('alert-nl-menu');
      alertNlMenu.removeAttribute('hidden');
      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');
      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
    }

    function initTWMenu() {
      console.log('Emergency-alert customization operator is TW');
      var emergencyAlertTWMenu = document.getElementById('emergency-alert-tw-menu');
      var emergencyMessageTWMenu = document.getElementById('emergency-message-tw-menu');
      emergencyAlertTWMenu.removeAttribute('hidden');
      emergencyMessageTWMenu.removeAttribute('hidden');

      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var ringtonePreviewMenu = document.getElementById('wea-ringtone-preview');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      ringtonePreviewMenu.classList.add('hidden');
    }

    function initROMenu() {
      console.log('Emergency-alert customization operator is RO');
      var presidentialAlertRoMenu = document.getElementById('presidential-alert-ro-menu');
      var extremeRoMenu = document.getElementById('extreme-alert-ro-menu');
      var severeRoMenu = document.getElementById('severe-alert-ro-menu');
      var amberRoMenu = document.getElementById('amber-alert-ro-menu');
      var exerciseRoMenu = document.getElementById('exercise-alert-ro-menu');
      presidentialAlertRoMenu.removeAttribute('hidden');
      extremeRoMenu.removeAttribute('hidden');
      severeRoMenu.removeAttribute('hidden');
      amberRoMenu.removeAttribute('hidden');
      exerciseRoMenu.removeAttribute('hidden');

      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');
      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
    }

    function initKRMenu() {
      console.log('Emergency-alert customization operator is KR');
      var emergencyAlertTWMenu = document.getElementById('emergency-alert-tw-menu');
      var emergencyMessageTWMenu = document.getElementById('emergency-message-tw-menu');
      emergencyAlertTWMenu.classList.add('hidden');
      emergencyMessageTWMenu.classList.add('hidden');

      var exerciseAlertMenu = document.getElementById('exercise-alert-menu');
      var requiredMonthlyTestMenu = document.getElementById('required-monthly-test-menu');
      exerciseAlertMenu.classList.add('hidden');
      requiredMonthlyTestMenu.classList.add('hidden');
    }

    function initITMenu() {
      console.log('Emergency-alert customization operator is IT');
      var alertItMenu = document.getElementById('emergency-alert-it-menu');
      var testItMenu = document.getElementById('test-alert-it-menu');
      alertItMenu.removeAttribute('hidden');
      testItMenu.removeAttribute('hidden');

      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');

      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
    }

    function initCLMenu() {
      console.log('Emergency-alert customization operator is Cl');
      var ringtonePreviewMenu = document.getElementById('wea-ringtone-preview');
      var testClMenu = document.getElementById('test-alert-cl-menu');

      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');

      testClMenu.removeAttribute('hidden');
      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');

      ringtonePreviewMenu.classList.add('hidden');
    }

    function initMXMenu() {
      console.log('Emergency-alert customization operator is MX');
      var alertBody = document.getElementById('receive-alert-body');
      alertBody.classList.add('hidden');
    }

    function initHKMenu() {
      /* << [LIO-2006]: BDC kanxj 20201201 Wrong UI - Hongkong Emergency Alert System */
      console.log('Emergency-alert customization operator is HK');
      var nationalHKMenu = document.getElementById('national-emergency-alert-HK-menu');
      var alertHKMenu = document.getElementById('emergency-alert-HK-menu');
      var testHKMenu = document.getElementById('test-alert-HK-menu');
      nationalHKMenu.removeAttribute('hidden');
      alertHKMenu.removeAttribute('hidden');
      testHKMenu.removeAttribute('hidden');

      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');

      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
      /* >> [LIO-2006] */
    }

    function initPeMenu() {
      console.log('Emergency-alert customization operator is Pe');
      var alertBody = document.getElementById('receive-alert-body');
      alertBody.classList.add('hidden');
    }

    function initOMMenu() {
      console.log('Emergency-alert customization operator is OM');
      var alertOmnMenu = document.getElementById('emergency-alert-omn-menu');
      var warningOmnMenu = document.getElementById('warning-alert-omn-menu');
      var testOmnMenu = document.getElementById('exercise-alert-omn-menu');
      alertOmnMenu.removeAttribute('hidden');
      warningOmnMenu.removeAttribute('hidden');
      testOmnMenu.removeAttribute('hidden');

      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');

      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
    }

    function initKSAMenu() {
      console.log('Emergency-alert customization operator KSA ');
      var alertKsaMenu = document.getElementById('emergency-alert-ksa-menu');
      var extremeKsaMenu = document.getElementById('extreme-alert-ksa-menu');
      var warningKsaMenu = document.getElementById('warning-alert-ksa-menu');
      var amberKsaMenu = document.getElementById('amber-alert-ksa-menu');
      var testKsaMenu = document.getElementById('test-alert-ksa-menu');
      var exerciseKsaMenu = document.getElementById('exercise-alert-ksa-menu');
      alertKsaMenu.removeAttribute('hidden');
      extremeKsaMenu.removeAttribute('hidden');
      warningKsaMenu.removeAttribute('hidden');
      amberKsaMenu.removeAttribute('hidden');
      testKsaMenu.removeAttribute('hidden');
      exerciseKsaMenu.removeAttribute('hidden');

      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');

      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
    }

    function initVZWMenu() {
      console.log('Emergency-alert customization operator VZW ');
      var spanishAlertMenu = document.getElementById('vzw-spanish-alert-menu');
      spanishAlertMenu.removeAttribute('hidden');
    }

    function initGRMenu() {
      console.log('Emergency-alert customization operator is GR');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');

      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
    }

    /* << [LIO-1817]: BDC kanxj 20210219 UK Cell Broadcast requirement */
    function initUKMenu() {
      console.log('Emergency-alert customization operator UK ');
      var nationalAlertMenu = document.getElementById('national-emergency-alert-UK-menu');
      var testAlertMenu = document.getElementById('test-alert-UK-menu');
      var operatorAlertMenu = document.getElementById('opertor-alert-UK-menu');

      nationalAlertMenu.removeAttribute('hidden');
      testAlertMenu.removeAttribute('hidden');
      operatorAlertMenu.removeAttribute('hidden');


      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');

      cmasPresidentialMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
    }
    /* >> [LIO-1817] */

    /* << [LIO-2317]: BDC kanxj 20210716 Cell Broadcast for Ecuador */
    function initEcuadorMenu() {
      console.log('Emergency-alert customization operator is EU');
      var emergencyAlertMenu = document.getElementById('local-emergency-alert-EU-menu');
      var informationAlertMenu = document.getElementById('information-alert-EU-menu');
      var testAlertMenu = document.getElementById('test-alert-EU-menu');
      var exerciseAlertMenu = document.getElementById('exercise-alert-EU-menu');

      emergencyAlertMenu.removeAttribute('hidden');
      informationAlertMenu.removeAttribute('hidden');
      testAlertMenu.removeAttribute('hidden');
      exerciseAlertMenu.removeAttribute('hidden');

      var cmasPresidentialMenu = document.getElementById('cmas-presidential-menu');
      var cmasExtremeMenu = document.getElementById('cmas-extreme-menu');
      var cmasSevereMenu = document.getElementById('cmas-severe-menu');
      var cmasAmberMenu = document.getElementById('cmas-amber-menu');
      var monthlytestMenu = document.getElementById('required-monthly-test-menu');
      var exerciseMenu = document.getElementById('exercise-alert-menu');
      var safetyMenu = document.getElementById('cmas-safety-menu');
      var weatestMenu = document.getElementById('cmas-weatest-menu');

      cmasPresidentialMenu.classList.add('hidden');
      cmasExtremeMenu.classList.add('hidden');
      cmasSevereMenu.classList.add('hidden');
      cmasAmberMenu.classList.add('hidden');
      monthlytestMenu.classList.add('hidden');
      exerciseMenu.classList.add('hidden');
      safetyMenu.classList.add('hidden');
      weatestMenu.classList.add('hidden');
    }
    /* >> [LIO-2317] */

    function initCustomizationMenu(operator) {
      //For test
      //operator='GR';
      if (operator !== 'IL' && operator !== 'UAE') {
        var exerciseAlertMenu = document.getElementById('exercise-alert-menu');
        exerciseAlertMenu.classList.add('hidden');
        exerciseAlertMenu.classList.remove('navigable');
      }

      if (operator == 'UAE') {
        initUAEMenu();
      } else if (operator == 'IL') {
        initILMenu();
      } else if (operator == 'LT') {
        initLTMenu();
      } else if (operator == 'NL') {
        initNLMenu();
      } else if (operator === 'TW') {
        initTWMenu();
      } else if (operator === 'RO') {
        initROMenu();
      } else if (operator === 'KR') {
        initKRMenu();
      } else if (operator === 'IT') {
        initITMenu();
      } else if (operator === 'cl') {
        initCLMenu();
      } else if (operator === 'MX') {
        initMXMenu();
      } else if (operator === 'HK') {
        initHKMenu();
      } else if (operator === 'Pe') {
        initPeMenu();
      } else if (operator === 'OM') {
        initOMMenu();
      } else if (operator === 'KSA') {
        initKSAMenu();
      } else if (operator === 'VZW') {
        initVZWMenu();
      } else if (operator === 'GR') {
        initGRMenu();
      /* << [LIO-1817]: BDC kanxj 20210219 UK Cell Broadcast requirement */
      } else if (operator === 'UK') {
        initUKMenu();
      /* << [LIO-2317]: BDC kanxj 20210716 Cell Broadcast for Ecuador >> */
      } else if (operator === 'EU') {
        initEcuadorMenu();
      }
    }
    /* >> [LIO-1690] */

     // Task5758730-chengyanzhang@t2mobile.com-for add exercise alert message-begin
    function _disableSomeMenu() {// bug4000-chengyanzhang@t2mobile.com-modify
      /* << [LIO-1690]: BDC kanxj 20201109 add for The mandatory CMAS channels are not defaultly enabled */
      var SIMSlotManager = require('shared/simslot_manager');
      let isNoSim = SIMSlotManager.noSIMCardOnDevice();
      if (!isNoSim) {
        var slots = SIMSlotManager.getSlots();
        let matchInfo = {
          "clientId": "0"
        };
        if (!slots[0].isAbsent()) {
          matchInfo.clientId = '0';
        } else if (!slots[1].isAbsent()) {
          matchInfo.clientId = '1';
        }
        navigator.customization.getValueForCarrier(matchInfo, 'def.operator.name').then((operator) => {
          console.log('Emergency-alert getValueForCarrier operator: ' + operator);
          if (operator === undefined) {
            return;
          }
          initCustomizationMenu(operator);
        });
      } else {
        navigator.customization.getValue("def.operator.name").then((operator) => {
          console.log('Emergency-alert customization operator: ' + operator);
          if (operator === undefined) {
            return;
          }
          initCustomizationMenu(operator);
        });
      }
      /* >> [LIO-1690] */
    }
    // Task5758730-chengyanzhang@t2mobile.com-for add exercise alert message-end

    function _updateAlertBodyDisplay(panel) {
      var alertBody = panel.querySelector('#receive-alert-body');
      var request = navigator.mozSettings.createLock().get('cmas.settings.show');
      request.onsuccess = () => {
        var val = request.result['cmas.settings.show'];
        if (val === 'undefined') {
          val = true;
        }
        if (alertBody.hidden === val) {
          alertBody.hidden = !val;
        }
        alertinbox.hidden = false;
        ringtonePreview.hidden = false;
        NavigationMap.refresh();
      };
      request.onerror = () => {
        console.error('ERROR: Can not get the receive alert setting.');
        alertinbox.hidden = false;
        ringtonePreview.hidden = false;
        NavigationMap.refresh();
      };
    }

    function _updateServereDisplay(enabled) {
      elements.extremeInput.checked = enabled;
      elements.severeInput.disabled = !enabled;
      if (enabled) {
        elements.severeItem.classList.remove('none-select');
        elements.severeItem.removeAttribute('aria-disabled');
      } else {
        elements.severeItem.setAttribute('aria-disabled', true);
        elements.severeItem.classList.add('none-select');
      }
    }

    return SettingsPanel({
      onInit: function(panel) {
        elements = {
          loadingProgress:
            panel.querySelector('#loading-progress'),
          severeItem:
            panel.querySelector('#cmas-severe-menu'),
          presidentialInput:
            panel.querySelector('input[name="cmas.presidential.enabled"]'),
          extremeInput:
            panel.querySelector('input[name="cmas.extreme.enabled"]'),
          severeInput:
            panel.querySelector('input[name="cmas.severe.enabled"]'),
          amberInput:
            panel.querySelector('input[name="cmas.amber.enabled"]'),
          safetyInput:
            panel.querySelector('input[name="cmas.safety.enabled"]'),
          weatestInput:
            panel.querySelector('input[name="cmas.weatest.enabled"]'),
          monthlyTestInput:
            panel.querySelector('input[name="cmas.monthlytest.enabled"]')
        };

        SettingsDBCache.getSettings((result) => {
          let alertBodyShow = result['cmas.settings.show'];
          let presidentialEnabled = result['cmas.presidential.enabled'];
          let extremeEnabled = result['cmas.extreme.enabled'];
          let servereEnabled = result['cmas.severe.enabled'];
          let amberEnabled = result['cmas.amber.enabled'];
          let saftyEnabled = result['cmas.safety.enabled'];
          let weatestEnabled = result['cmas.weatest.enabled'];
          let monthlyTestEnabled = result['cmas.monthlytest.enabled'];
          elements.loadingProgress.hidden = true;
          _updateAlertBodyDisplay(panel);
          /* << [BTV-207]: BDC kanxj 20200918 OPT-OUT MENU */
          //_updateServereDisplay(extremeEnabled);
          elements.presidentialInput.checked = presidentialEnabled;
          elements.severeInput.checked = servereEnabled;
          elements.amberInput.checked = amberEnabled;
          if (elements.safetyInput) {
            elements.safetyInput.checked = saftyEnabled || true;
          }
          if (elements.weatestInput) {
            elements.weatestInput.checked = weatestEnabled || false;
          }
          elements.monthlyTestInput.checked = monthlyTestEnabled;
        });
      },

      onBeforeShow: function() {
        _updateSoftkey();
        _disableSomeMenu();// Task5758730-chengyanzhang@t2mobile.com-for add exercise alert message-add
        alertinbox.addEventListener('keydown', _keyDownHandler);
        ListFocusHelper.addEventListener(listElements, _updateSoftkey);
        _initAlertSettingListener();
      },

      onBeforeHide: function() {
        ListFocusHelper.removeEventListener(listElements, _updateSoftkey);
        _removeAlertSettingListener();
        alertinbox.removeEventListener('keydown', _keyDownHandler);
      }
    });
  };
});
