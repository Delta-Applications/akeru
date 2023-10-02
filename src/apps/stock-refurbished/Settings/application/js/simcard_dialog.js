/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* global Settings, getIccByIndex, SettingsSoftkey */


function SimPinDialog(dialog) {
  var icc;
  var _localize = navigator.mozL10n.setAttributes;
  var translate = navigator.mozL10n.get;
  var gPinCodevalue = 0;
  var peventIccCallFlag = false;

  if (!window.navigator.mozMobileConnections) {
    return;
  }

  /**
   * Global variables and callbacks -- set by the main `show()' method
   */

  var _origin = ''; // id of the dialog caller (specific to the Settings app)
  var _action = ''; // requested action: unlock*, enable*, disable*, change*
  var _onsuccess = function() {};
  var _oncancel = function() {};
  var cardIndex = 0;

  var _allowedRetryCounts = {
    'pin': 3,
    'pin2': 3,
    'puk': 10,
    'puk2': 10
  };

  /**
   * User Interface constants
   */

  var dialogHeader = dialog.querySelector('gaia-header');
  var dialogTitle = dialog.querySelector('gaia-header h1');

  dialogHeader.addEventListener('action', skip);

  // numeric inputs -- 3 possible input modes:
  //   `pin': show pin input
  //   `puk': show puk and newPin+confirmPin inputs
  //   `new': show pin and newPin+confirmPin inputs
  var pinArea = dialog.querySelector('.sim-pinArea');
  var pukArea = dialog.querySelector('.sim-pukArea');
  var newPinArea = dialog.querySelector('.sim-newPinArea');
  var confirmPinArea = dialog.querySelector('.sim-confirmPinArea');
  var pinInput = numberPasswordInput(pinArea);
  var pukInput = numberPasswordInput(pukArea);
  var newPinInput = numberPasswordInput(newPinArea);
  var confirmPinInput = numberPasswordInput(confirmPinArea);
  // show error messages
  var errorMsg = dialog.querySelector('.pin.sim-code-error');
  // '[n] tries left' error messages
  var triesLeftMsg = dialog.querySelector('.pin.sim-tries-left');
  // show code mismatch error messages
  var codeMismatchMsg = dialog.querySelector('.code-mismatch-error');
  // show PUK warning messages
  var pukErrorMsg = dialog.querySelector('.sim-errorMsg');
  var pukErrorMsgBody = dialog.querySelector('.sim-messageBody');
  if (dialog.id === 'simpin2-dialog') {
    pinArea.querySelector('span').setAttribute('data-l10n-id', 'simPin2');
    pukArea.querySelector('span').setAttribute('data-l10n-id', 'puk2Code');
    newPinArea.querySelector('span').setAttribute('data-l10n-id',
      'newSimPin2Msg');
    confirmPinArea.querySelector('span').setAttribute('data-l10n-id',
      'confirmNewSimPin2Msg');
  }
  var leftBracket = dialog.querySelector('.puk.sim-code-error');
  var rightBracket = dialog.querySelector('.puk.sim-tries-left');
  let pinTitle = dialog.querySelector('.sim-pinArea span');
  let pukTitle = dialog.querySelector('.sim-pukArea span');
  let newPinTitle = dialog.querySelector('.sim-newPinArea span');
  let confirmPinTitle = dialog.querySelector('.sim-confirmPinArea span');

  function setInputMode(mode) {
    switch (mode) {
      case 'pin':
        pinArea.parentNode.hidden = false;
        pukArea.parentNode.hidden = true;
        newPinArea.parentNode.hidden = true;
        confirmPinArea.parentNode.hidden = true;
        break;
      case 'puk':
        pinArea.parentNode.hidden = true;
        pukArea.parentNode.hidden = false;
        newPinArea.parentNode.hidden = false;
        confirmPinArea.parentNode.hidden = false;
        newPinInput.value = '';
        break;
      default:
        mode = 'pin';
        pinArea.parentNode.hidden = false;
        pukArea.parentNode.hidden = true;
        newPinArea.parentNode.hidden = false;
        confirmPinArea.parentNode.hidden = false;
        break;
    }
    var errorMsgId = '.' + mode + '.sim-code-error';
    var triesLeftMsgId = '.' + mode + '.sim-tries-left';
    var leftBracketId = '.' + mode + '.left-bracket';
    var rightBracketId = '.' + mode + '.right-bracket';
    errorMsg = dialog.querySelector(errorMsgId);
    triesLeftMsg = dialog.querySelector(triesLeftMsgId);
    leftBracket = dialog.querySelector(leftBracketId);
    rightBracket = dialog.querySelector(rightBracketId);
  }

  function numberPasswordInput(area) {
    var input = area.querySelector('input');
    input.addEventListener('input', function(evt) {
      var pin = pinInput.value;
      var puk = pukInput.value;
      var newPin = newPinInput.value;
      var confirmPin = confirmPinInput.value;
      if ((pinArea.parentNode.hidden || pin.length >= 4 && pin.length <= 8) &&
        (pukArea.parentNode.hidden || puk.length >= 4 && puk.length <= 8) &&
        (newPinArea.parentNode.hidden ||
        newPin.length >= 4 && newPin.length <= 8) &&
        (confirmPinArea.parentNode.hidden ||
        confirmPin.length >= 4 && confirmPin.length <= 8)) {
        if (newPin !== confirmPin) {
          showCodeMismatchMsg('newPinErrorMsg');
          updateSKs(false);
        } else {
          codeMismatchMsg.hidden = true;
          updateSKs(true);
        }
      } else if ((newPin.length >= 4 && newPin.length <= 8) &&
        (confirmPin.length >= 4 && confirmPin.length <= 8)) {
        if (newPin !== confirmPin) {
          showCodeMismatchMsg('newPinErrorMsg');
          updateSKs(false);
        } else {
          codeMismatchMsg.hidden = true;
          updateSKs(false);
        }
      } else {
        updateSKs(false);
      }
    });
    return input;
  }

  function showPukMessage(bodyL10nId, args) {
    if (!bodyL10nId) {
      pukErrorMsg.hidden = true;
      return;
    }
    _localize(pukErrorMsgBody, bodyL10nId, args);
    pukErrorMsg.hidden = false;
  }

  function showErrorMsg(errorMsgId) {
    if (!errorMsgId) {
      errorMsg.hidden = true;
      leftBracket.hidden = true;
      rightBracket.hidden = true;
      return;
    }
    errorMsg.setAttribute('data-l10n-id', errorMsgId);
    errorMsg.hidden = false;
    leftBracket.hidden = false;
    rightBracket.hidden = false;
  }

  function showRetryCount(retryCount) {
    if (!retryCount) {
      triesLeftMsg.hidden = true;
      leftBracket.hidden = true;
      rightBracket.hidden = true;
      return;
    }
    _localize(triesLeftMsg, 'inputCodeRetriesLeft', {
      n: retryCount
    });
    triesLeftMsg.hidden = false;
    leftBracket.hidden = false;
    rightBracket.hidden = false;
  }

  function showCodeMismatchMsg(mismatchMsgId) {
    if (!mismatchMsgId) {
      codeMismatchMsg.hidden = true;
      return;
    }
    codeMismatchMsg.setAttribute('data-l10n-id', mismatchMsgId);
    codeMismatchMsg.hidden = false;
  }

  /**
   * Tells users how many remaining attempts for submitting their password are
   * left, and focuses on the right input element depending on the lockType.
   *
   * @param {string} lockType e.g. 'pin', 'puk', 'fdn' etc.
   * @param {number} retryCount Amount of retries left.
   */
  function _handleRetryPassword(lockType, retryCount) {
    if (retryCount <= 0 || typeof retryCount !== 'number') {
      console.warning('Called _handleRetryPassword with incorrect retryCount ' +
        'argument');
      return;
    }

    var msgId = '';
    if (lockType === 'puk') {
      showPukMessage('puk-description', {
        n: retryCount
      });
    }
    msgId = 'AttemptMsg';
    showErrorMsg(lockType + msgId);
    showRetryCount(retryCount);
    restoreFocus(lockType);
    updateSKs(false);
  }

  /**
   * Handles errors that happened when trying to lock or unlock the SIM
   * Card. The potential errors are defined in `ril_consts.js`.
   *
   * @param {object} error - IccCardLockError error object
   */
  function handleCardLockError(error) {
    var name = error.name;
    var retryCount = error.retryCount;
    var lockType = error.lockType;

    if (!lockType) {
      console.error('`handleCardLockError` called without a lockType. ' +
        'This should never even happen.', error);
      skip();
      return;
    }

    switch (name) {
      case 'SimPuk2':
        _action = initUI('unlock_puk2');
        restoreFocus('puk2');
        break;
      case 'IncorrectPassword':
        if (retryCount > 0) {
          _handleRetryPassword(lockType, retryCount);
        } else {
          // Skipping instead of opening puk UI because the system app will
          // take care of it (otherwise we would end up with 2 consecutive puk
          // dialogs).
          skip();
        }
        break;
      default:
        var dialogConfig = {
          title: {
            id: 'confirmation',
            args: {}
          },
          body: {
            id: 'genericLockError',
            args: {}
          },
          accept: {
            l10nId: 'ok',
            priority: 2,
            callback: function() {
              dialog.destroy();
              skip();
            },
          },
        };
        var dialog = new ConfirmDialogHelper(dialogConfig);
        dialog.show(document.getElementById('app-confirmation-dialog'));
        console.error('Error of type ' + name + ' happened coming from an ' +
          'IccCardLockError event', error);
    }
  }

  /**
   * SIM card helpers -- unlockCardLock
   */

  function unlockPin() {
    var pin = pinInput.value;
    unlockCardLock({
      lockType: 'pin',
      pin: pin
    });
    clear();
  }

  function unlockPuk(lockType) { // lockType = `puk' or `puk2'
    lockType = lockType || 'puk';
    var puk = pukInput.value;
    var newPin = newPinInput.value;
    unlockCardLock({
      lockType: lockType,
      puk: puk,
      newPin: newPin
    });
    clear();
  }

  function unlockCardLock(options) {
    if (peventIccCallFlag) {
      return;
    } else {
      peventIccCallFlag = true;
    }
    var req = icc.unlockCardLock(options);
    req.onsuccess = function sp_unlockSuccess() {
      close();
      _onsuccess();
      peventIccCallFlag = false;
    };
    req.onerror = function sp_unlockError() {
      var error = req.error;
      error.lockType = options.lockType;
      handleCardLockError(error);
      peventIccCallFlag = false;
    };
  }


  /**
   * SIM card helpers -- setCardLock
   */

  function enableLock(enabled) {
    var pin = pinInput.value;
    gPinCodevalue = pinInput.value;
    setCardLock({
      lockType: 'pin',
      pin: pin,
      enabled: enabled
    });
    clear();
  }

  function enableFdn(enabled) {
    var pin = pinInput.value;
    setCardLock({
      lockType: 'fdn',
      pin2: pin,
      enabled: enabled
    });
    clear();
  }

  function changePin(lockType) { // lockType = `pin' or `pin2'
    lockType = lockType || 'pin';
    var pin = pinInput.value;
    var newPin = newPinInput.value;
    setCardLock({
      lockType: lockType,
      pin: pin,
      newPin: newPin
    });
    clear();
  }

  function setCardLock(options) {
    if (peventIccCallFlag) {
      return;
    } else {
      peventIccCallFlag = true;
    }
    var req = icc.setCardLock(options);
    req.onsuccess = function spl_enableSuccess() {
      close();
      _onsuccess();
      peventIccCallFlag = false;
    };
    req.onerror = function sp_enableError() {
      var error = req.error;
      error.lockType = options.lockType;
      handleCardLockError(error);
      peventIccCallFlag = false;
    };
  }


  /**
   * Add|Edit|Remove FDN contact
   */

  var _fdnContactInfo = {};

  /**
   * Updates a FDN contact. For some reason, `icc.updateContact` requires the
   * pin input value instead of delegating to `icc.setCardLock`. That means
   * that, in case of failure, the error is different that the one that
   * `icc.setCardLock` gives. This means that we have to handle it separatedly
   * instead of being able to use the existing `handleCardLockError` above.
   * Among other things, it doesn't include the retryCount, so we can't tell
   * the user how many remaining tries she has. What a mess.
   *
   * This should be solved when bug 1070941 is fixed.
   */
  function updateFdnContact() {
    if (peventIccCallFlag) {
      return;
    } else {
      peventIccCallFlag = true;
    }
    var req = icc.updateContact('fdn', _fdnContactInfo, pinInput.value);

    req.onsuccess = function onsuccess() {
      _onsuccess(_fdnContactInfo);
      close();
      peventIccCallFlag = false;
    };

    req.onerror = function onerror(e) {
      switch (req.error.name) {
        case 'IncorrectPassword':
        case 'SimPin2':
          // TODO: count retries (not supported by the platform) -> Bug 1070941
          _action = initUI('get_pin2');
          showErrorMsg('fdnErrorMsg');
          pinInput.value = '';
          updateSKs(false);
          break;
        case 'SimPuk2':
          _action = initUI('unlock_puk2');
          restoreFocus('puk2');
          break;
        case 'NoFreeRecordFound':
          var dialogConfig = {
            title: {
              id: 'confirmation',
              args: {}
            },
            body: {
              id: 'fdnNoFDNFreeRecord',
              args: {}
            },
            accept: {
              l10nId: 'ok',
              priority: 2,
              callback: function() {}
            },
          };
          var dialog = new ConfirmDialogHelper(dialogConfig);
          dialog.show(document.getElementById('app-confirmation-dialog'));
          _oncancel(_fdnContactInfo);
          close();
          break;
        default:
          _oncancel(_fdnContactInfo);
          close();
          console.error('Could not edit FDN contact on SIM card', e);
      }
      peventIccCallFlag = false;
    };
  }


  /**
   * Dialog box handling
   */

  function verify() { // apply PIN|PUK
    switch (_action) {
      // get PIN code
      case 'get_pin':
        _onsuccess(pinInput.value);
        close();
        break;

        // unlock SIM
      case 'unlock_pin':
        unlockPin();
        break;
      case 'unlock_puk':
        unlockPuk('puk');
        break;
      case 'unlock_puk2':
        unlockPuk('puk2');
        break;

        // PIN lock
      case 'enable_lock':
        enableLock(true);
        break;
      case 'disable_lock':
        enableLock(false);
        break;
      case 'change_pin':
        changePin('pin');
        break;

        // get PIN2 code (FDN contact list)
      case 'get_pin2':
        updateFdnContact();
        break;

        // PIN2 lock (FDN)
      case 'enable_fdn':
        enableFdn(true);
        break;
      case 'disable_fdn':
        enableFdn(false);
        break;
      case 'change_pin2':
        changePin('pin2');
        break;
    }

    return false;
  }

  function clear() {
    errorMsg.hidden = true;
    pukErrorMsg.hidden = true;
    triesLeftMsg.hidden = true;
    leftBracket.hidden = true;
    rightBracket.hidden = true;
    errorMsg.textContent = '';
    triesLeftMsg.textContent = '';
    pukErrorMsgBody.textContent = '';
    codeMismatchMsg.textContent = '';
    pinInput.value = '';
    pukInput.value = '';
    newPinInput.value = '';
    confirmPinInput.value = '';
  }

  function close() {
    clear();
    if (_origin) {
      window.removeEventListener('keydown', handleKeydown);
      Settings.currentPanel =  (_origin === '#call-fdnList-add') ? '#call-fdnList' : _origin;
    }
  }

  function skip() {
    close();
    _oncancel();
    return false;
  }

  /**
   * Expose a main `show()` method
   */
  function initUI(action) {
    showErrorMsg();
    showRetryCount(); // Clear the retry count at first
    showCodeMismatchMsg(); // Clear the code mismatch error messages

    var lockType = 'pin'; // used to query the number of retries left
    if (DsdsSettings.getNumberOfIccSlots() > 1) {
      switch (action) {
        // get PIN code
        case 'get_pin2':
          lockType = 'pin2';
          setInputMode('pin');
          _localize(dialogTitle,
            'pin2TitleWithIndex',
            {index: cardIndex + 1});
          _localize(pinTitle,
            'simPin2WithIndex',
            {index: cardIndex + 1});
          break;
        case 'get_pin':
          setInputMode('pin');
          _localize(dialogTitle,
            'pinTitleWithIndex',
            {index: cardIndex + 1});
          _localize(pinTitle,
            'simPinWithIndex',
            {index: cardIndex + 1});
          break;

        // unlock SIM
        case 'unlock_pin':
          setInputMode('pin');
          _localize(dialogTitle,
            'pinTitleWithIndex',
            {index: cardIndex + 1});
          _localize(pinTitle,
            'simPinWithIndex',
            {index: cardIndex + 1});
          break;
        case 'unlock_puk':
          lockType = 'puk';
          setInputMode('puk');
          showErrorMsg('simCardLockedMsg');
          showPukMessage('enterPukMsg');
          _localize(dialogTitle,
            'pukTitleWithIndex',
            {index: cardIndex + 1});
          break;
        case 'unlock_puk2':
          lockType = 'puk2';
          setInputMode('puk');
          showErrorMsg('simCardLockedMsg');
          showPukMessage('enterPuk2Msg');
          _localize(dialogTitle,
            'puk2TitleWithIndex',
            {index: cardIndex + 1});
          _localize(pukTitle,
            'puk2CodeWithIndex',
            {index: cardIndex + 1});
          _localize(newPinTitle,
            'newSimPin2Msg',
            {index: cardIndex + 1});
          _localize(confirmPinTitle,
            'confirmNewSimPin2Msg',
            {index: cardIndex + 1});
          break;

        // PIN lock
        case 'enable_lock':
        case 'disable_lock':
          setInputMode('pin');
          _localize(dialogTitle,
            'pinTitleWithIndex',
            {index: cardIndex + 1});
          _localize(pinTitle,
            'simPinWithIndex',
            {index: cardIndex + 1});
          break;
        case 'change_pin':
          setInputMode('new');
          _localize(dialogTitle,
            'newpinTitleWithIndex',
            {index: cardIndex + 1});
          _localize(pinTitle,
            'simPinWithIndex',
            {index: cardIndex + 1});
          _localize(newPinTitle,
            'newSimPinMsg',
            {index: cardIndex + 1});
          _localize(confirmPinTitle,
            'confirmNewSimPinMsg',
            {index: cardIndex + 1});
          break;

        // FDN lock (PIN2)
        case 'enable_fdn':
          lockType = 'pin2';
          setInputMode('pin');
          _localize(dialogTitle,
            'pin2TitleWithIndex',
            {index: cardIndex + 1});
          _localize(pinTitle,
            'simPin2WithIndex',
            {index: cardIndex + 1});
          break;
        case 'disable_fdn':
          lockType = 'pin2';
          setInputMode('pin');
          _localize(dialogTitle,
            'pin2TitleWithIndex',
            {index: cardIndex + 1});
          _localize(pinTitle,
            'simPin2WithIndex',
            {index: cardIndex + 1});
          break;
        case 'change_pin2':
          lockType = 'pin2';
          setInputMode('new');
          _localize(dialogTitle,
            'fdnResetWithIndex',
            {index: cardIndex + 1});
          _localize(pinTitle,
            'simPin2WithIndex',
            {index: cardIndex + 1});
          _localize(newPinTitle,
            'newSimPin2Msg',
            {index: cardIndex + 1});
          _localize(confirmPinTitle,
            'confirmNewSimPin2Msg',
            {index: cardIndex + 1});
          break;

        // unsupported
        default:
          console.error('unsupported "' + action + '" action');
          return '';
      }
    } else {
      switch (action) {
        // get PIN code
        case 'get_pin2':
          lockType = 'pin2';
          setInputMode('pin');
          _localize(dialogTitle, 'pin2Title');
          _localize(pinTitle, 'simPin2');
          break;
        case 'get_pin':
          setInputMode('pin');
          _localize(dialogTitle, 'pinTitle');
          _localize(pinTitle, 'simPin');
          break;

        // unlock SIM
        case 'unlock_pin':
          setInputMode('pin');
          _localize(dialogTitle, 'pinTitle');
          _localize(pinTitle, 'simPin');
          break;
        case 'unlock_puk':
          lockType = 'puk';
          setInputMode('puk');
          showErrorMsg('simCardLockedMsg');
          showPukMessage('enterPukMsg');
          _localize(dialogTitle, 'pukTitle');
          break;
        case 'unlock_puk2':
          lockType = 'puk2';
          setInputMode('puk');
          showErrorMsg('simCardLockedMsg');
          showPukMessage('enterPuk2Msg');
          _localize(dialogTitle, 'puk2Title');
          _localize(pukTitle, 'puk2Code');
          _localize(newPinTitle, 'newSimPin2Msg');
          _localize(confirmPinTitle, 'confirmNewSimPin2Msg');
          break;

        // PIN lock
        case 'enable_lock':
        case 'disable_lock':
          setInputMode('pin');
          _localize(dialogTitle, 'pinTitle');
          _localize(pinTitle, 'simPin');
          break;
        case 'change_pin':
          setInputMode('new');
          _localize(dialogTitle, 'newpinTitle');
          _localize(pinTitle, 'simPin');
          _localize(newPinTitle, 'newSimPinMsg');
          _localize(confirmPinTitle, 'confirmNewSimPinMsg');
          break;

        // FDN lock (PIN2)
        case 'enable_fdn':
          lockType = 'pin2';
          setInputMode('pin');
          _localize(dialogTitle, 'pin2Title');
          _localize(pinTitle, 'simPin2');
          break;
        case 'disable_fdn':
          lockType = 'pin2';
          setInputMode('pin');
          _localize(dialogTitle, 'pin2Title');
          _localize(pinTitle, 'simPin2');
          break;
        case 'change_pin2':
          lockType = 'pin2';
          setInputMode('new');
          _localize(dialogTitle, 'fdnReset');
          _localize(pinTitle, 'simPin2');
          _localize(newPinTitle, 'newSimPin2Msg');
          _localize(confirmPinTitle, 'confirmNewSimPin2Msg');
          break;

        // unsupported
        default:
          console.error('unsupported "' + action + '" action');
          return '';
      }
    }

    // display the number of remaining retries if necessary
    // XXX this only works with emulator (and some commercial RIL stacks...)
    // https://bugzilla.mozilla.org/show_bug.cgi?id=905173
    var req = icc.getCardLockRetryCount(lockType);
    req.onsuccess = function() {
      var retryCount = req.result.retryCount;
      showRetryCount(retryCount);
    };
    if (lockType === 'puk2') {
      NavigationMap.refresh();
    }
    return action;
  }

  function show(action, options) {
    options = options || {};

    var dialogPanel = '#' + dialog.id;
    icc = getIccByIndex(options.cardIndex);
    cardIndex = options.cardIndex;

    if (!icc || dialogPanel === Settings.currentPanel ||
      (dialogPanel === '#simpin2-dialog' &&
      Settings.currentPanel === '#simpin')) {
      return;
    }

    _action = initUI(action);

    if (!_action) {
      skip();
      return;
    }

    _origin = Settings.currentPanel;
    Settings.currentPanel = dialogPanel;

    _onsuccess = typeof options.onsuccess === 'function' ?
      options.onsuccess : function() {};
    _oncancel = typeof options.oncancel === 'function' ?
      options.oncancel : function() {};

    _fdnContactInfo = options.fdnContact;
    window.addEventListener('panelready', function inputFocus() {
      window.removeEventListener('panelready', inputFocus);
      var focusedElement = document.querySelector('.focus');
      if (focusedElement !== null) {
        var input = focusedElement.querySelector('input');
        if (input !== null) {
          input.focus();
        }
      }
      // add left softkey
      updateSKs(false);
    });

    window.addEventListener('keydown', handleKeydown);
  }

  function handleKeydown(evt) {
    switch (evt.key) {
      case 'Backspace':
        _oncancel(cardIndex);
        close();
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Enter':
        var focusedElement = document.querySelector('.focus');
        if (focusedElement !== null) {
          var input = focusedElement.querySelector('input');
          if (input !== null) {
            input.focus();
          }
        }
        break;
      default:
        break;
    }
  }

  function updateSKs(doneSoftkeyEnable) {
    var params = {
      menuClassName: 'menu-button',
      header: {
        l10nId: 'message'
      },
      items: [{
        name: 'Cancel',
        l10nId:'cancel',
        priority: 1,
        method: function() {
          skip();
        }
      }]
    };

    if (doneSoftkeyEnable) {
      params.items.push({
        name: 'Done',
        l10nId:'done',
        priority: 3,
        method: function() {
          verify();
        }
      });
    }
    SettingsSoftkey.init(params);
    SettingsSoftkey.show();
  }

  function restoreFocus(lockType) {
    var focused = document.querySelector('.focus');
    if (focused !== null) {
      focused.classList.remove('focus');
    }

    var parentNode = null;
    var input = null;

    if (_action === 'change_pin' || _action === 'change_pin2') {
      parentNode = newPinArea.parentNode;
      input = newPinInput;
    }

    if (lockType === 'pin' || lockType === 'fdn' || lockType === 'pin2') {
      parentNode = pinArea.parentNode;
      input = pinInput;
    } else if (lockType === 'puk' || lockType === 'puk2') {
      parentNode = pukArea.parentNode;
      input = pukInput;
    }

    if (parentNode !== null) {
      parentNode.classList.add('focus');
      NavigationMap.scrollToElement(parentNode);
    }

    if (input !== null) {
      input.focus();
    }
  }

  return {
    show: show
  };
}
