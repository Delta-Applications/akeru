/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* global SettingsListener, SettingsSoftkey, Toaster,
   SupportedNetworkTypeHelper, LazyLoader, DsdsSettings */



var _debugInfo = true;
var debugInfo = function() {};
if (_debugInfo) {
  debugInfo = function _debugInfo(msg) {
    console.log('--> [accountManager]: ' + msg);
  };
}

/**
 * Move settings to foreground
 */

function reopenSettings() {
  navigator.mozApps.getSelf().onsuccess = function getSelfCB(evt) {
    var app = evt.target.result;
    app.launch('settings');
  };
}

/**
 * Open a link with a web activity
 */

function openLink(url) {
  if (url.startsWith('tel:')) { // dial a phone number
    new MozActivity({
      name: 'dial',
      data: { type: 'webtelephony/number', number: url.substr(4) }
    });
  } else if (!url.startsWith('#')) { // browse a URL
    new MozActivity({
      name: 'view',
      data: { type: 'url', url: url }
    });
  }
}

/**
 * These so-called "dialog boxes" are just standard Settings panels (<section
 * role="region" />) with reset/submit buttons: these buttons both return to the
 * previous panel when clicked, and each button has its own (optional) callback.
 */

function openDialog(dialogID, onSubmit, onReset) {
  if ('#' + dialogID == Settings.currentPanel)
    return;

  var origin = Settings.currentPanel;

  // Load dialog contents and show it.
  Settings.currentPanel = dialogID;

  var dialog = document.getElementById(dialogID);
  var submit = dialog.querySelector('[type=submit]');
  if (submit) {
    submit.onclick = function onsubmit() {
      if (typeof onSubmit === 'function')
        (onSubmit.bind(dialog))();
      Settings.currentPanel = origin; // hide dialog box
    };
  }

  var reset = dialog.querySelector('[type=reset]');
  if (reset) {
    reset.onclick = function onreset() {
      if (typeof onReset === 'function')
        (onReset.bind(dialog))();
      Settings.currentPanel = origin; // hide dialog box
    };
  }
}

function openIncompatibleSettingsDialog(dialogId, newSetting,
  oldSetting, callback) {
  var headerL10nMap = {
    'ums.enabled': 'is-warning-storage-header',
    'tethering.usb.enabled': 'is-warning-tethering-header',
    'tethering.wifi.enabled': 'is-warning-wifi-header'
  };
  var messageL10nMap = {
    'ums.enabled': {
      'tethering.usb.enabled': 'is-warning-storage-tethering-message'
    },
    'tethering.usb.enabled': {
      'ums.enabled': 'is-warning-tethering-storage-message',
      'tethering.wifi.enabled': 'is-warning-tethering-wifi-message'
    },
    'tethering.wifi.enabled': {
      'tethering.usb.enabled': 'is-warning-wifi-tethering-message'
    }
  };

  var headerL10n = headerL10nMap[newSetting];
  var messageL10n =
    messageL10nMap[newSetting] && messageL10nMap[newSetting][oldSetting];

  var dialogConfig = {
    title: {
      id: headerL10n,
      args: {}
    },
    body: {
      id: messageL10n,
      args: {}
    },
    cancel: {
      name: 'Cancel',
      l10nId: 'cancel',
      priority: 1,
      callback: function() {
        onCancel();
      }
    },
    confirm: {
      name: 'Turn On',
      l10nId: 'turnOn',
      priority: 3,
      callback: function() {
        onEnable();
      },
    },
    backcallback: function () {
      onCancel();
    }
  };

  // User has requested enable the feature so the old feature
  // must be disabled
  function onEnable() {
    var cset = {};
    cset[newSetting] = true;
    cset[oldSetting] = false;
    SettingsListener.getSettingsLock().set(cset);
    if (newSetting === 'tethering.usb.enabled' ||
        newSetting === 'tethering.wifi.enabled') {
      showToast('changessaved');
    }

    if (callback) {
      callback();
    }
  }

  function onCancel() {
    var cset = {};
    cset[newSetting] = false;
    cset[oldSetting] = true;
    SettingsListener.getSettingsLock().set(cset);

    if (newSetting === 'tethering.usb.enabled') {
      var el = document.getElementById('usb-tethering');
      el && el.focus();
    } else if (newSetting === 'tethering.wifi.enabled') {
      var el = document.getElementById('wifi-hotspot');
      el && el.focus();
    }
  }

  var dialog = new ConfirmDialogHelper(dialogConfig);
  dialog.show(document.getElementById('app-confirmation-dialog'));
}

/**
 * Helper class for formatting file size strings
 * required by *_storage.js
 */

var FileSizeFormatter = (function FileSizeFormatter(fixed) {
  function getReadableFileSize(bytes, digits) { // in: size in Bytes
    if (bytes === undefined)
      return {};

    var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var size, e;
    if (bytes) {
      e = Math.floor(Math.log(bytes) / Math.log(1024));
      size = (bytes / Math.pow(1024, e)).toFixed(digits || 0);
    } else {
      e = 0;
      size = '0';
    }

    return {
      size: size,
      unit: units[e]
    };
  }

  return { getReadableFileSize: getReadableFileSize };
})();

/**
 * Helper class for getting available/used storage
 * required by *_storage.js
 */

var DeviceStorageHelper = (function DeviceStorageHelper() {
  function showFormatedSize(element, l10nId, size) {
    if (size === undefined || isNaN(size) || size < 0) {
      element.textContent = '';
      return;
    }

    // KB - 3 KB (nearest ones), MB, GB - 1.29 MB (nearest hundredth)
    var fixedDigits = (size < 1024 * 1024) ? 0 : 2;
    var sizeInfo = FileSizeFormatter.getReadableFileSize(size, fixedDigits);
    var _ = navigator.mozL10n.get;
    navigator.mozL10n.setAttributes(element, l10nId, {
      size: sizeInfo.size.toLocaleString(navigator.language),
      unit: _('byteUnit-' + sizeInfo.unit)
    });
  };

  function showFormatedSizeOfReleased(size) {
    if (size === undefined || isNaN(size) || size < 0) {
      return;
    }

    // KB - 3 KB (nearest ones), MB, GB - 1.29 MB (nearest hundredth)
    var fixedDigits = (size < 1024 * 1024) ? 0 : 2;
    var sizeInfo = FileSizeFormatter.getReadableFileSize(size, fixedDigits);

    var _ = navigator.mozL10n.get;
    var toast = {
      messageL10nId: 'releasedSize',
      messageL10nArgs: {
        size: sizeInfo.size.toLocaleString(navigator.language),
        unit: _('byteUnit-' + sizeInfo.unit)
      },
      useTransition: true
    };
    showToast(toast.messageL10nId, toast.messageL10nArgs);
  };

  function showFormatedSizeOfUsedAndTotal(element, l10nId, sizes) {
    if (sizes === undefined) {
      element.textContent = '';
      return;
    }

    // KB - 3 KB (nearest ones), MB, GB - 1.29 MB (nearest hundredth)
    var fixedDigits = (sizes['used'] < 1024 * 1024) ? 0 : 2;
    var sizeInfo =
      FileSizeFormatter.getReadableFileSize(sizes['used'], fixedDigits);
    var fixedTotalDigits =
      (sizes['total'] < 1024 * 1024) ? 0 : 2;
    var sizeTotalInfo = FileSizeFormatter.getReadableFileSize(sizes['total'], fixedTotalDigits);
    var _ = navigator.mozL10n.get;
    navigator.mozL10n.setAttributes(element, l10nId, {
      usedSize: sizeInfo.size.toLocaleString(navigator.language),
      usedUnit: _('byteUnit-' + sizeInfo.unit),
      totalSize: sizeTotalInfo.size.toLocaleString(navigator.language),
      totalUnit: _('byteUnit-' + sizeTotalInfo.unit)
    });
  }

  return {
    showFormatedSize: showFormatedSize,
    showFormatedSizeOfReleased: showFormatedSizeOfReleased,
    showFormatedSizeOfUsedAndTotal : showFormatedSizeOfUsedAndTotal
  };
})();

/**
 * Helper class to update SELECT softbar for all panels

 */

var ListFocusHelper = (function ListFocusHelper() {
  function updateSoftkeyByFocus(evt) {
    var classList = evt.currentTarget.classList;
    if (classList && classList.contains('none-select')) {
      SettingsSoftkey.hide();
    } else {
      SettingsSoftkey.show();
    }
  }

  function addFocusEventListener(elements, callback) {
    var i = elements.length - 1;
    if (callback) {
      for (i; i >= 0; i--) {
        elements[i].addEventListener('focus', callback);
      }
    } else {
      for (i; i >= 0; i--) {
        elements[i].addEventListener('focus', updateSoftkeyByFocus);
      }
    }
  }

  function removeFocusEventListener(elements, callback) {
    var i = elements.length - 1;
    if (callback) {
      for (i; i >= 0; i--) {
        elements[i].removeEventListener('focus', callback);
      }
    } else {
      for (i; i >= 0; i--) {
        elements[i].removeEventListener('focus', updateSoftkeyByFocus);
      }
    }
  }

  function updateSoftkey(panel) {
    let item = null;
    if (panel) {
      item = panel.querySelector('.focus');
    } else {
      item = document.querySelector('.focus');
    }
    if (!item) {
      return;
    }
    if (item.classList.contains('none-select')) {
      SettingsSoftkey.hide();
    } else {
      SettingsSoftkey.show();
    }
  }

  return {
    addEventListener: addFocusEventListener,
    removeEventListener: removeFocusEventListener,
    updateSoftkey: updateSoftkey
  };
})();


function _isSubSidyLock(index) {
  const SUBSIDY_LOCK_SIM_NETWORK = 1;
  if (navigator.subsidyLockManager) {
    return new Promise((resolve) => {
      navigator.subsidyLockManager[index].getSubsidyLockStatus()
        .then((value) => {
        if (value && value.includes(SUBSIDY_LOCK_SIM_NETWORK)) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  } else {
    return Promise.resolve(false);
  }
}

function _getDefaultPreferredNetworkType(index) {
  return new Promise((resolve) => {
    Promise.all([
      navigator.mozMobileConnections[index].getSupportedNetworkTypes(),
      _isSubSidyLock(index)
    ]).then((values) => {
      let allTypes = ['lte', 'wcdma', 'tdscdma', 'gsm', 'cdma', 'evdo'];
      if (values[1]) {
        if (values[0].indexOf('lte') > -1) {
          allTypes = ['wcdma', 'tdscdma', 'gsm', 'cdma', 'evdo'];
        } else {
          allTypes = ['gsm', 'cdma', 'evdo'];
        }
      }
      let types = allTypes.filter((type) => {
        return (values[0] && values[0].indexOf(type) !== -1);
      });
      resolve(types);
    });
  });
}

/**
 * The function returns an object of the supporting state of category of
 * network types. The categories are 'gsm', 'cdma', and 'lte'.
 */
(function(exports) {
  var supportedNetworkTypeHelpers = [];

  var helperFuncReady = function(callback) {
    if (exports.SupportedNetworkTypeHelper) {
      if (typeof callback === 'function') {
        callback();
      }
    } else {
      LazyLoader.load(['js/supported_network_type_helper.js'], function() {
        if (typeof callback === 'function') {
          callback();
        }
      });
    }
  };

  var getMobileConnectionIndex = function(mobileConnection) {
    return Array.prototype.indexOf.call(navigator.mozMobileConnections,
      mobileConnection);
  };

  var getSupportedNetworkInfo = function(mobileConnection, callback) {
    if (!navigator.mozMobileConnections) {
      if (typeof callback === 'function') {
        callback();
      }
    }

    helperFuncReady(function ready() {
      var index = getMobileConnectionIndex(mobileConnection);
      _getDefaultPreferredNetworkType(index).then(supportedNetworkTypes => {
        var supportedNetworkTypeHelper;
        supportedNetworkTypeHelpers[index] = supportedNetworkTypeHelper =
          SupportedNetworkTypeHelper(supportedNetworkTypes);
        if (typeof callback === 'function') {
          callback(supportedNetworkTypeHelper);
        }
      });
    });
  };

  exports.getSupportedNetworkInfo = getSupportedNetworkInfo;
})(this);

function isIP(address) {
  return /^\d+\.\d+\.\d+\.\d+$/.test(address);
}

// Remove additional 0 in front of IP digits.
// Notice that this is not following standard dot-decimal notation, just for
// possible error tolarance.
// (Values starting with 0 stand for octal representation by standard)
function sanitizeAddress(input) {
  if (isIP(input)) {
    return input.replace(/0*(\d+)/g, '$1');
  } else {
    return input;
  }
}

/**
 * Retrieve current ICC by a given index. If no index is provided, it will
 * use the index provided by `DsdsSettings.getIccCardIndexForCallSettings`,
 * which is the default. Unless there are very specific reasons to provide an
 * index, this function should always be invoked with no parameters in order
 * to use the currently selected ICC index.
 *
 * @param {Number} index index of the mobile connection to get the ICC from
 * @return {object}
 */
function getIccByIndex(index) {
  if (index === undefined) {
    index = DsdsSettings.getIccCardIndexForCallSettings();
  }
  var iccObj;

  if (navigator.mozMobileConnections[index]) {
    var iccId = navigator.mozMobileConnections[index].iccId;
    if (iccId) {
      iccObj = navigator.mozIccManager.getIccById(iccId);
    }
  }

  return iccObj;
}

/**
* get the focused li element's index
**/
function _getFocusPos(Element) {
  if(!Element)
    return -1;
  var liList = Element.querySelectorAll('li');
  for(var i =0;i<liList.length;i++) {
    if(liList[i].classList.contains('focus') ||
      liList[i].classList.contains('focus1')) {
      focusId = i;
      return focusId;
    }
  }
};

const qwertyKeyMapping = {
  'w': '1', 'e': '2', 'r': '3', 's': '4', 'd': '5',
  'f': '6', 'z': '7', 'x': '8', 'c': '9', ',': '0'
};

function _translateKey(key) {
  return qwertyKeyMapping[key] || key;
}

/** Card state mapping const. */
const CARDSTATE_MAPPING = {
  'pinRequired' : 'simCardLockedMsg',
  'pukRequired' : 'simCardLockedMsg',
  'permanentBlocked': 'simCardBlockedMsg',
  'networkLocked' : 'simLockedPhone',
  'serviceProviderLocked' : 'simLockedPhone',
  'corporateLocked' : 'simLockedPhone',
  'network1Locked' : 'simLockedPhone',
  'network2Locked' : 'simLockedPhone',
  'hrpdNetworkLocked' : 'simLockedPhone',
  'ruimCorporateLocked' : 'simLockedPhone',
  'ruimServiceProviderLocked' : 'simLockedPhone',
  'unknown' : 'unknownSimCardState',
  'illegal' : 'simCardIllegal',
  'absent' : 'noSimCard',
  'null' : 'simCardNotReady',
  'ready': ''
};

function _getCardDesription(key) {
  return CARDSTATE_MAPPING[key] || key;
}

function _getCurrentIccObj(cardIndex) {
  var iccId;
  var iccObj;
  var conn = window.navigator.mozMobileConnections[cardIndex];
  if (conn) {
    iccId = conn.iccId;
    if (iccId) {
      iccObj = window.navigator.mozIccManager.getIccById(iccId);
    }
  }

  if (!iccObj) {
    console.log('We can\'t find related iccObj in card - ',
      cardIndex);
  }

  return iccObj;
}

function showToast(msgId, msgArg) {
  if (!document.hidden) {
    var toast = {
      messageL10nId: msgId,
      messageL10nArgs: msgArg,
      useTransition: true
    };
    Toaster.showToast(toast);
  }
}

function requestFocus(panel, element) {
  if (Settings.isBackHref) {
    return;
  }
  var evt = new CustomEvent('panelready', {
    detail: {
      current: '#' + panel.id,
      needFocused: element
    }
  });
  window.dispatchEvent(evt);
}

function showErrorDialog(err) {
  let msgId = null;
  switch (err) {
    case 'no network':
      msgId = 'no-internet-connection';
      break;
    case 'timeout':
      break;
    case 'user cancel':
      break;
    case 'access denied':
      msgId = 'access-denied';
      break;
    case 'incorrect password':
      msgId = 'wrong-password';
      break;
    case 'error':
      msgId = 'server-error';
      break;
    case 'duplicate_account':
      msgId = 'duplicate-account';
      break;
    default:
      break;
  }
  if (msgId) {
    showToast(msgId);
  }
}

function _getValidAccount(accts) {
  var account = {};
  account.email = Normalizer.escapeHTML(accts.email) || '';
  var pemail = accts.pending && accts.pending.email;
  account.pemail = Normalizer.escapeHTML(pemail) || '';
  account.phone = accts.phone || '';
  account.altPhone = accts.pending && accts.pending.phone || '';
  account.paltPhone = accts.pending && accts.pending.altPhone || '';
  account.uid = accts.uid;

  return account;
}

function _isOffline() {
  return navigator.connection &&
    navigator.connection.type !== 'cellular' &&
    navigator.connection.type !== 'wifi';
}

function _getOperatorName(mobileConnection, desc) {
  SettingsDBCache.getSettings(function(result) {
    let iccId = mobileConnection.iccId;
    let customedSimName = result['custom.simcards.name'];
    if (customedSimName && customedSimName[iccId]) {
      desc.textContent = customedSimName[iccId];
    } else {
      let operatorInfo = MobileOperator.userFacingInfo(mobileConnection);
      if (operatorInfo.operator) {
        desc.textContent = operatorInfo.operator;
      } else {
        desc.setAttribute('data-l10n-id', 'no-operator');
      }
    }
  });
}
