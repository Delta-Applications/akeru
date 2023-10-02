/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* global SettingsListener, SettingsSoftkey, Toaster,
 SupportedNetworkTypeHelper, LazyLoader, DsdsSettings */


const SHOW = 0;
const HIDE = 1;
const GRAYOUT = 2;

// const CUSTOMIZATION_VALUES = [0, 1, 2];
// const DMD_VALUES = ['show', 'hide', 'gray'];

const KEY_HREF_MAP = {
  'wifi.settings.ui': '#wifi',
  'bluetooth.settings.ui': '#bluetooth',
  'geolocation.settings.ui': '#geolocation'
};

const KEY_LI_MAP = {
  'wifi.settings.ui': 'connectivity-wifi',
  'bluetooth.settings.ui': 'connectivity-bluetooth',
  'geolocation.settings.ui': 'geolocation-settings',
  'data.settings.ui': 'liItem-dataConnection',
  'dm.data.settings.ui': 'liItem-dataConnection',
  'data.roaming.settings.ui': 'liItem-dataRoaming',
  'screen.timeout.settings.ui': 'screen-timeout',
  'dm.screen.timeout.settings.ui': 'screen-timeout',
  'pocketmode.autolock.settings.ui': 'auto-lock',
  'dm.pocketmode.autolock.settings.ui': 'auto-lock',
  'debug.performance_data.settings.ui': 'liItem-dataShared',
  'callforward.settings.ui': 'menuItem-callForwarding'
};

const mozSettings = window.navigator.mozSettings;

function updateSettingsUI(key, value) {
  var element = document.getElementById(KEY_LI_MAP[key]);
  if (!element) {
    return;
  }

  if (value === HIDE /*hide*/) {
    element.hidden = true;
    element.classList.remove('focus');
  } else if (value === GRAYOUT /*'grayout'*/) {
    element.hidden = false;
    element.classList.add('none-select');
    element.setAttribute('aria-disabled', true);
    if (KEY_HREF_MAP[key]) {
      var hrefItem = element.querySelector('a');
      hrefItem.removeAttribute('href');
    }
    if (element.querySelector('input')) {
      element.querySelector('input').disabled = true;
    }
  } else if (value === SHOW /*show*/) {
    element.hidden = false;
    element.classList.remove('none-select');
    element.removeAttribute('aria-disabled');
    if (KEY_HREF_MAP[key]) {
      var hrefItem = element.querySelector('a');
      hrefItem.setAttribute('href', KEY_HREF_MAP[key]);
    } else if (key === 'callforward.settings.ui') {
      var hrefItem = element.querySelector('a');
      if (DeviceFeature.getValue('vilte') === 'true') {
        hrefItem.setAttribute('href', '#call-cfsettings-list');
      } else {
        hrefItem.setAttribute('href', '#call-cfSettings');
      }
    }
    if (element.querySelector('input')) {
      element.querySelector('input').disabled = false;
    }
  }
}

const ROOT_SETTINGS_UI_LIST = [
  'wifi.settings.ui',
  'dm.wifi.settings.ui',
  'bluetooth.settings.ui',
  'dm.bluetooth.settings.ui',
  'geolocation.settings.ui',
  'dm.geolocation.settings.ui',
  'wifi-hotspot.settings.ui',
  'dm.tethering.wifi.settings.ui',
  'tethering.usb.settings.ui',
  'dm.tethering.usb.settings.ui'
];

function updateForSettings(evt) {
  var key = evt.settingName;
  var value = evt.settingValue;
  switch (key) {
    case 'wifi.settings.ui':
    case 'dm.wifi.settings.ui':
      updateUIForItem(['wifi']);
      break;
    case 'bluetooth.settings.ui':
    case 'dm.bluetooth.settings.ui':
      updateUIForItem(['bluetooth']);
      break;
    case 'geolocation.settings.ui':
    case 'dm.geolocation.settings.ui':
      updateUIForItem(['geolocation']);
      break;
    case 'wifi-hotspot.settings.ui':
    case 'dm.tethering.wifi.settings.ui':
    case 'tethering.usb.settings.ui':
    case 'dm.tethering.usb.settings.ui':
      updateUIForItem(['hotspot']);
      break;
    case 'airplaneMode.status':
    case 'data.settings.ui':
    case 'dm.data.settings.ui':
      updateUIForItem(['dataConnection']);
      break;
    case 'airplaneMode.status':
    case 'data.roaming.settings.ui':
      updateUIForItem(['dataRoaming']);
      break;
    case 'screen.timeout.settings.ui':
    case 'dm.screen.timeout.settings.ui':
      updateUIForItem(['screen-timeout']);
      break;
    case 'pocketmode.autolock.settings.ui':
    case 'dm.pocketmode.autolock.settings.ui':
      updateUIForItem(['auto-lock']);
      break;
    default:
      updateSettingsUI(key, value);
      break;
  }
}

function getSetting(settingKey) {
  return new Promise(function (resolve, reject) {
    var transaction = mozSettings.createLock();
    var req = transaction.get(settingKey);
    req.onsuccess = function () {
      resolve(req.result[settingKey]);
    };
    req.onerror = function () {
      resolve(false);
    };
  });
}

function updateTextContent(element, value) {
  let commonStrings = window.SettingsCacheRestore.getCommonStrings();
  if (commonStrings && commonStrings[value]) {
    element.textContent = commonStrings[value];
  }
}

function updateUIForItem(list) {
  let values = SettingsDBCache.cache;
  for (let i = 0; i < list.length; i++) {
    switch (list[i]) {
      case 'airplane':
        let airplaneStatus = values['airplaneMode.status'];
        let airplaneEnabled = values['airplaneMode.enabled'];
        let airplaneSelect = document.getElementById('airplane-mode-select');
        airplaneSelect.hidden = false;
        for (let j = 0; j < airplaneSelect.options.length; j++) {
          if (airplaneSelect.options[j].value === airplaneEnabled.toString()) {
            airplaneSelect.options[j].selected = true;
            let value = airplaneEnabled ? 'on' : 'off';
            airplaneSelect.options[j].setAttribute('data-l10n-id', value);
            if (!navigator.mozL10n) {
              updateTextContent(airplaneSelect.options[j], value);
            }
            break;
          }
        }
        break;
      case 'wifi':
        updateWifiDisplay(values);
        break;
      case 'bluetooth':
        updateBluetoothDisplay(values);
        break;
      case 'geolocation':
        updateGeolocationDisplay(values);
        break;
      case 'volte':
        updateVoLteVoWifiDisplay(values);
        break;
      case 'hotspot':
        updateHotspotDisplay(values);
        break;
      case 'cmas':
        let cmasItem = document.getElementById('wireless-emergency-alert');
        cmasItem.hidden = !!values['cmas.hidden'];
        break;
      case 'dataConnection':
        updateDataConnectionDisplay(values);
        break;
      case 'dataRoaming':
        updateDataRoamingDisplay(values);
        break;
      case 'screen-timeout':
        updateScreenTimeoutDisplay(values);
        break;
      case 'auto-lock':
        updateAutoLockDisplay(values);
        break;
      default:
        break;
    }
  }
}

function initUIForItem(list) {
  if (SettingsDBCache.cache) {
    updateUIForItem(list);
  } else {
    window.addEventListener('settings-db-ready', function onDBReady() {
      window.removeEventListener('settings-db-ready',
        onDBReady);
      updateUIForItem(list);
    });
  }
}


function initUIBySettings(list) {
  if (SettingsDBCache.cache) {
    for (var i = 0; i < list.length; i++) {
      updateSettingsUI(list[i], SettingsDBCache.cache[list[i]]);
    }
    window.dispatchEvent(new CustomEvent('refresh'));
  } else {
    window.addEventListener('settings-db-ready', function onDBReady() {
      window.removeEventListener('settings-db-ready',
        onDBReady);
      DeviceFeature.ready(() => {
        for (var i = 0; i < list.length; i++) {
          updateSettingsUI(list[i], SettingsDBCache.cache[list[i]]);
        }
        window.dispatchEvent(new CustomEvent('refresh'));
      });
    });
  }
}

function addListenerForCustomization(list) {
  list.forEach(function (key) {
    mozSettings.addObserver(key, updateForSettings);
  });
}

function removeListenerForCustomization(list) {
  list.forEach(function (key) {
    mozSettings.removeObserver(key, updateForSettings);
  })
}

function updateWifiDisplay(values) {
  let element = document.querySelector('#connectivity-wifi');
  if (DeviceFeature.getValue('wifi') !== 'true') {
    element.hidden = true;
    window.dispatchEvent(new CustomEvent('refresh'));
    return;
  }

  let wifiDesc = document.getElementById('wifi-desc');
  let value = values['wifi.enabled'] ? 'on' : 'off';
  wifiDesc.setAttribute('data-l10n-id', value);
  if (!navigator.mozL10n) {
    updateTextContent(wifiDesc, value);
  }
  if (values['wifi.settings.ui'] === HIDE ||
    values['dm.wifi.settings.ui'] === 'hide') {
    element.hidden = true;
    element.classList.remove('focus');
  } else if (values['wifi.settings.ui'] === GRAYOUT ||
    values['dm.wifi.settings.ui'] === 'gray') {
    element.hidden = false;
    element.classList.add('none-select');
    element.setAttribute('aria-disabled', true);
    let hrefItem = element.querySelector('a');
    if (hrefItem) {
      hrefItem.removeAttribute('href');
    }
  } else {
    element.hidden = false;
    element.classList.remove('none-select');
    element.removeAttribute('aria-disabled');
    var hrefItem = element.querySelector('a');
    hrefItem.setAttribute('href', '#wifi');
  }
  window.dispatchEvent(new CustomEvent('refresh'));
}

function updateBluetoothDisplay(values) {
  let element = document.querySelector('#connectivity-bluetooth');
  if (DeviceFeature.getValue('bt') !== 'true' || !navigator.mozBluetooth) {
    element.hidden = true;
    window.dispatchEvent(new CustomEvent('refresh'));
    return;
  }

  let bluetoothDesc = document.getElementById('bluetooth-desc');
  let value = values['bluetooth.enabled'] ? 'on' : 'off';
  bluetoothDesc.setAttribute('data-l10n-id', value);
  if (!navigator.mozL10n) {
    updateTextContent(bluetoothDesc, value);
  }
  if (values['bluetooth.settings.ui'] === HIDE ||
    values['dm.bluetooth.settings.ui'] === 'hide') {
    element.hidden = true;
    element.classList.remove('focus');
  } else if (values['bluetooth.settings.ui'] === GRAYOUT ||
    values['dm.bluetooth.settings.ui'] === 'gray') {
    element.hidden = false;
    element.classList.add('none-select');
    element.setAttribute('aria-disabled', true);

    let hrefItem = element.querySelector('a');
    if (hrefItem) {
      hrefItem.removeAttribute('href');
    }
  } else {
    element.hidden = false;
    element.classList.remove('none-select');
    element.removeAttribute('aria-disabled');
    var hrefItem = element.querySelector('a');
    hrefItem.setAttribute('href', '#bluetooth');
  }
  window.dispatchEvent(new CustomEvent('refresh'));
}

function updateGeolocationDisplay(values) {
  let element = document.querySelector('#geolocation-settings');
  if (DeviceFeature.getValue('gps') !== 'true') {
    element.hidden = true;
    window.dispatchEvent(new CustomEvent('refresh'));
    return;
  }
  // initial Geolocation settings observer
  let geoDesc = document.getElementById('geolocation-desc');
  let value = values['geolocation.enabled'] ? 'on' : 'off';
  geoDesc.setAttribute('data-l10n-id',value);
  updateTextContent(geoDesc, value);
  if (values['geolocation.settings.ui'] === HIDE ||
    values['dm.geolocation.settings.ui'] === 'hide') {
    element.hidden = true;
    element.classList.remove('focus');
  } else if (values['geolocation.settings.ui'] === GRAYOUT ||
    values['dm.geolocation.settings.ui'] === 'gray') {
    element.hidden = false;
    element.classList.add('none-select');
    element.setAttribute('aria-disabled', true);

    let hrefItem = element.querySelector('a');
    if (hrefItem) {
      hrefItem.removeAttribute('href');
    }
  } else {
    element.hidden = false;
    element.classList.remove('none-select');
    element.removeAttribute('aria-disabled');
    var hrefItem = element.querySelector('a');
    hrefItem.setAttribute('href', '#geolocation');
  }
  window.dispatchEvent(new CustomEvent('refresh'));
}

function updateVoLteVoWifiDisplay(values) {
  let element = document.querySelector('#volte-settings');
  let isSupportWifi = DeviceFeature.getValue('wifi');
  let isSupportVowifi = DeviceFeature.getValue('voWifi');
  let isSupportVolte = DeviceFeature.getValue('voLte');
  let isSupportDualLte = DeviceFeature.getValue('dual-Lte');
  if ((isSupportWifi !== 'true' || isSupportVowifi !== 'true') &&
    isSupportVolte !== 'true' && !values['volte_vowifi_settings.show']) {
    element.hidden = true;
    window.dispatchEvent(new CustomEvent('refresh'));
    return;
  }
  let volteDisplay = document.getElementById('volte-settings');
  let volteHeader = document.getElementById('volte-vowifi-header');

  let serviceId = values['ril.data.defaultServiceId'];
  //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. begin
/*
  if ((isSupportDualLte !== 'true') &&
    serviceId !== 0 && DeviceFeature.getValue('primarySim') !== 'true') {
    volteDisplay.hidden = true;
    window.dispatchEvent(new CustomEvent('refresh'));
    return;
  }
*/
  //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. end

  let mobileConnection = navigator.mozMobileConnections[serviceId];
  let supportedBearers = mobileConnection.imsHandler &&
    mobileConnection.imsHandler.deviceConfig.supportedBearers;
  if (!supportedBearers) {
    volteDisplay.hidden = true;
    window.dispatchEvent(new CustomEvent('refresh'));
    return;
  }

  //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. begin
/*
  let supportWifi = (isSupportWifi === 'true') &&
    (isSupportVowifi === 'true') &&
    (supportedBearers.indexOf('wifi') >= 0);
  let supportLte = (isSupportVolte === 'true') &&
    (supportedBearers.indexOf('cellular') >= 0);
*/
    let matchInfo = {
      "clientId": "0",
    };
    matchInfo.clientId = serviceId;

    let p3 = navigator.customization.getValueForCarrier(matchInfo, 'fih.volte.default.enable.bool');
    let p4 = navigator.customization.getValueForCarrier(matchInfo, 'fih.volte.editable.bool');
    let p5 = navigator.customization.getValueForCarrier(matchInfo, 'fih.vowifi.default.enable.bool');
    let p6 = navigator.customization.getValueForCarrier(matchInfo, 'fih.vowifi.editable.bool');
    Promise.all([p3, p4, p5, p6]).then(function(values) {
      let volteEditable = JSON.stringify(values[1]) === 'true' ? true : false;
      let vowifiEditable = JSON.stringify(values[3]) === 'true' ? true : false;
      let carrierVolteSupport = (JSON.stringify(values[0]) === 'true') ||  volteEditable;
      let carrierVowifiSupport = (JSON.stringify(values[2]) === 'true') || vowifiEditable;

      console.log('root_panel updateVolteItem : carrierVolteSupport: ' + carrierVolteSupport + " carrierVowifiSupport: " + carrierVowifiSupport);

      let supportWifi = (isSupportWifi === 'true') &&
        (isSupportVowifi === 'true') &&
        carrierVowifiSupport &&
        (supportedBearers.indexOf('wifi') >= 0);
      let supportLte = (isSupportVolte === 'true') &&
        carrierVolteSupport &&
        (supportedBearers.indexOf('cellular') >= 0);

      if(!volteEditable && !vowifiEditable) {
        volteDisplay.hidden = true;
        window.dispatchEvent(new CustomEvent('refresh'));
        return;
      }
  //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. end

  if (!supportWifi && !supportLte) {
    volteDisplay.hidden = true;
    window.dispatchEvent(new CustomEvent('refresh'));
    return;
  }
  volteDisplay.hidden = false;
  if (supportWifi && supportLte) {
    //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. begin
/*
    volteHeader && volteHeader.setAttribute('data-l10n-id', 'volte-header');
*/
    if(volteEditable && !vowifiEditable) {
      volteHeader && volteHeader.setAttribute('data-l10n-id', 'fih-volte-header');
    } else if(!volteEditable && vowifiEditable) {
      volteHeader && volteHeader.setAttribute('data-l10n-id', 'fih-vowifi-header');
    } else {
      volteHeader && volteHeader.setAttribute('data-l10n-id', 'volte-header');
    }
    //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. end
  } else if (supportLte) {
    volteHeader && volteHeader.setAttribute('data-l10n-id', 'volte');
  } else if (supportWifi) {
    volteHeader && volteHeader.setAttribute('data-l10n-id', 'vowifi');
  }
  window.dispatchEvent(new CustomEvent('refresh'));

  //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. begin
  });
  //[BTS-1983] BDC zhangwp 20190618 modify for update IMS menu. end

}

function updateHotspotDisplay(values) {
  if (!values['tethering.support']) {
    return;
  }
  let wifiUi = values['wifi-hotspot.settings.ui'];
  let dmWifiUi = values['dm.tethering.wifi.settings.ui'];
  let usbUi = values['tethering.usb.settings.ui'];
  let dmUsbUi = values['dm.tethering.usb.settings.ui'];

  let isSupportWifi = (DeviceFeature.getValue('wifi') === 'true') &&
    (wifiUi !== HIDE) && (dmWifiUi !== 'hide');
  let isSupportUsb = (usbUi !== HIDE) && (dmUsbUi !== 'hide');

  let hotspotItem = document.getElementById('internet-sharing');
  if (isSupportWifi && isSupportUsb) {
    hotspotItem.classList.remove('none-select');
    hotspotItem.removeAttribute('aria-disabled');
    hotspotItem.hidden = false;

    let hrefItem = hotspotItem.querySelector('a');
    hrefItem.setAttribute('href', '#hotspot');
  } else if (isSupportWifi) {
    hotspotItem.hidden = false;
    if (wifiUi === GRAYOUT || dmWifiUi === 'gray') {
      hotspotItem.setAttribute('aria-disabled', true);
      hotspotItem.classList.add('none-select');
      hotspotItem.hidden = false;

      let hrefItem = hotspotItem.querySelector('a');
      hrefItem.removeAttribute('href');
    } else {
      hotspotItem.classList.remove('none-select');
      hotspotItem.removeAttribute('aria-disabled');

      let hrefItem = hotspotItem.querySelector('a');
      hrefItem.setAttribute('href', '#hotspot');
    }
  } else if (isSupportUsb) {
    hotspotItem.hidden = false;
    if (usbUi === GRAYOUT || dmUsbUi === 'gray') {
      hotspotItem.setAttribute('aria-disabled', true);
      hotspotItem.classList.add('none-select');

      let hrefItem = hotspotItem.querySelector('a');
      hrefItem.removeAttribute('href');
    } else {
      hotspotItem.classList.remove('none-select');
      hotspotItem.removeAttribute('aria-disabled');

      let hrefItem = hotspotItem.querySelector('a');
      hrefItem.setAttribute('href', '#hotspot');
    }
  } else {
    hotspotItem.hidden = true;
  }
  window.dispatchEvent(new CustomEvent('refresh'));
}

function updateDataConnectionDisplay(values) {
  let element = document.getElementById('liItem-dataConnection');
  let status = values['airplaneMode.status'];

  if (values['data.settings.ui'] === HIDE ||
    values['dm.data.settings.ui'] === 'hide') {
    element.hidden = true;
    element.classList.remove('focus');
  } else if (values['data.settings.ui'] === GRAYOUT ||
    values['dm.data.settings.ui'] === 'gray' || status !== 'disabled') {
    element.hidden = false;
    element.classList.add('none-select');
    element.setAttribute('aria-disabled', true);
  } else {
    element.hidden = false;
    element.classList.remove('none-select');
    element.removeAttribute('aria-disabled');
  }
  window.dispatchEvent(new CustomEvent('refresh'));
}

function updateDataRoamingDisplay(values) {
  // BDC wangzhigang modify for Domestic data roaming menu function. begin
  let serviceId = SettingsDBCache.cache['ril.data.defaultServiceId'];
  let matchInfo = {
    "clientId": "0"
  };
  matchInfo.clientId = serviceId;
  // Observe data roaming key according to current customization value
  window.navigator.customization.getValueForCarrier(matchInfo, 'stz.roaming.domestic.enable').then((result) => {
      dataRoamingcustomized = (result === 'undefined') ? false : result;
      console.log('[updateDataRoamingDisplay] read data roaming customized = ' + dataRoamingcustomized + ' serviceId = ' + serviceId);
  // BDC wangzhigang modify for Domestic data roaming menu function. end

  let element = document.getElementById('liItem-dataRoaming');
  let description = document.getElementById('dataRoaming-description');
  let status = values['airplaneMode.status'];
  let hrefItem = element.querySelector('a');

  if (values['data.roaming.hidden']) {
    element.hidden = true;
    description.hidden = true;
    element.classList.remove('focus');
    hrefItem.removeAttribute('href');
  } else if (values['data.roaming.settings.ui'] === HIDE) {
    element.hidden = true;
    description.hidden = true;
    element.classList.remove('focus');
    hrefItem.removeAttribute('href');
  } else if (values['data.roaming.settings.ui'] === GRAYOUT ||
    status !== 'disabled') {
    element.hidden = false;
    description.hidden = false;
    element.classList.add('none-select');
    element.setAttribute('aria-disabled', true);
    hrefItem.removeAttribute('href');
  } else {
    element.hidden = false;
    description.hidden = false;
    element.classList.remove('none-select');
    element.removeAttribute('aria-disabled');
  // BDC wangzhigang modify for Domestic data roaming menu function. begin
/*
    hrefItem.setAttribute('href', '#data-roaming');
*/
    if(dataRoamingcustomized) {
      hrefItem.setAttribute('href', '#data-roaming-customization');
    } else {
      hrefItem.setAttribute('href', '#data-roaming');
    }
  // BDC wangzhigang modify for Domestic data roaming menu function. end
  }
  window.dispatchEvent(new CustomEvent('refresh'));

  // BDC wangzhigang modify for Domestic data roaming menu function. begin
  });
  // BDC wangzhigang modify for Domestic data roaming menu function. end

}

function updateScreenTimeoutDisplay(values) {
  let element = document.getElementById('screen-timeout');
  let timeoutUi = values['screen.timeout.settings.ui'];
  let dmTimeoutUi = values['dm.screen.timeout.settings.ui'];
  if (timeoutUi === HIDE || dmTimeoutUi === 'hide') {
    element.hidden = true;
    element.classList.remove('focus');
  } else if (timeoutUi === GRAYOUT || dmTimeoutUi === 'gray') {
    element.hidden = false;
    element.classList.add('none-select');
    element.setAttribute('aria-disabled', true);
  } else {
    element.hidden = false;
    element.classList.remove('none-select');
    element.removeAttribute('aria-disabled');
  }
  window.dispatchEvent(new CustomEvent('refresh'));
}

function updateAutoLockDisplay(values) {
  let element = document.getElementById('auto-lock');
  let autoLockUi = values['pocketmode.autolock.settings.ui'];
  let dmAutoLockUi = values['dm.pocketmode.autolock.settings.ui'];
  if (autoLockUi === HIDE || dmAutoLockUi === 'hide') {
    element.hidden = true;
    element.classList.remove('focus');
  } else if (autoLockUi === GRAYOUT || dmAutoLockUi === 'gray') {
    element.hidden = false;
    element.classList.add('none-select');
    element.setAttribute('aria-disabled', true);
  } else {
    element.hidden = false;
    element.classList.remove('none-select');
    element.removeAttribute('aria-disabled');
  }
  window.dispatchEvent(new CustomEvent('refresh'));
}
