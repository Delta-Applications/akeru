/* global NavigationMap, SettingsHelper, SettingsSoftkey, Toaster,
          Normalizer */
/* exported FxaPanel */



var FxaPanel = (function fxa_panel() {
  var _ = navigator.mozL10n.get;
  var fxaContainer,
    phoneUnverifiedPanel,
    loggedOutPanel,
    loggedInPanel,
    unverifiedPanel,
    cancelBtn,
    loginEmailBtn,
    loginNumberBtn,
    logoutBtn,
    loggedInEmail,
    loggedInEmailLabel,
    loggedInPhone,
    loggedInAltPhone,
    loggedInAltPhoneLabel,
    unverifiedEmail,
    resendEmail,
    fxaHelper,
    resetPasswordBtn,
    resendMailBtn,
    personalInfoContent,
    headTitle,
    birthday,
    yob,
    gender,
    email,
    pemail,
    phoneNumber,
    pphoneNumber,
    altPhoneNumber,
    paltPhoneNumber,
    uid,
    fxaHeader;
  var setPasswordUrl;
  var SignIned = false;
  var firstSignIn = true;
  var altPhoneProcessingTimer = null;
  const ALTPHONE_VERIFICATION_EXPIRES_MIN = 2;
  const ALTPHONE_VERIFICATION_EXPIRES =
    1000 * 60 * ALTPHONE_VERIFICATION_EXPIRES_MIN;

  function init(fxAccountsIACHelper) {
    // allow mock to be passed in for unit testing
    fxaHelper = fxAccountsIACHelper;
    fxaContainer = document.getElementById('fxa');
    phoneUnverifiedPanel = document.getElementById('phone-unverified');
    loggedOutPanel = document.getElementById('fxa-logged-out');
    loggedInPanel = document.getElementById('fxa-logged-in');
    //unverifiedPanel = document.getElementById('fxa-unverified');
    resendEmail = document.getElementById('fxa-resend-email');
    cancelBtn = document.getElementById('fxa-cancel-confirmation');
    loginNumberBtn = document.getElementById('fxa-login-number');
    loginEmailBtn = document.getElementById('fxa-login-email');
    logoutBtn = document.getElementById('fxa-logout');
    loggedInEmail = document.getElementById('fxa-email');
    loggedInEmailLabel = document.getElementById('fxa-email-label');
    loggedInPhone = document.getElementById('fxa-phone-number');
    loggedInAltPhone = document.getElementById('fxa-alt-phone');
    loggedInAltPhoneLabel = document.getElementById('fxa-alt-phone-label');
    //unverifiedEmail = document.getElementById('fxa-unverified-text');

    resetPasswordBtn = document.getElementById('fxa-reset-password');
    resendMailBlk = document.getElementById('fxa-resend-mail');
    resendMailBtn = document.getElementById('fxa-resend-mail-btn');
    resendMailButton = document.getElementById('email-button');

    headTitle = document.getElementById('fxa-accounts-header');

    personalInfoContent = document.getElementById('fxa-personal-info-birthday');
    resendAltPhoneOtpBlk = document.getElementById('fxa-send-altphone-otp');
    resendAltPhoneOtpBtn = document.getElementById('fxa-send-altphone-otp-btn');
    resendAltPhoneOtpButton = document.getElementById('alt-phone-button');
    fxaHeader = document.getElementById('fxa-header');

    var fxaSettingsHelper =
      SettingsHelper('identity.fxaccounts.reset-password.url');

    fxaSettingsHelper.get(function on_fxa_get_settings(url) {
      setPasswordUrl = url;
    });

    if (window.ActivityHandler) {
      fxaHeader.setAttribute('data-href', '#accounts');
    }

    // listen for changes
    onVisibilityChange();
    // start by checking current status
    refreshStatus();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('panelready', function (e) {
      if (e.detail.current === '#fxa') {
        if (SignIned) {
          var id = '';
          if (e.detail && e.detail.needFocused && e.detail.needFocused.id) {
            id = e.detail.needFocused.id;
          }
          initSignInSoftKey(id);
        } else {
          initSoftKey();
        }
      }
      if (e.detail.previous === '#fxa' &&
        e.detail.current !== '#account-more-about') {
        SettingsSoftkey.hide();
      }
    });

    document.addEventListener('focusChanged', onFocusChanged);

    // Get connected experience
    let entry = document.getElementById('menuItem-fxa');
    entry.addEventListener('click', onShow);
    onShow();
  }

  function onShow(evt) {
    if (_isOffline()) {
      new MozActivity({name: 'offline-dialog'});
    }
  }

  function onFocusChanged(e) {
    var id = e.detail.focusedElement.id;
    console.log(id);

    if (needFocus(id)) {
      updateSoftKey(id);
    }
  }

  function onSignOut() {
    SignIned = false;
    firstSignIn = true;
    hideLoggedInPanel();
    showLoggedOutPanel();
    headTitle.setAttribute('data-l10n-id', 'fxa-accounts-header');
  }

  function needFocus(id) {
    let ids = ['email-info','phone-info','alt-phone-info',
                'personal-info', 'email-button', 'alt-phone-button'];
    return ids.indexOf(id) > -1;
  }

  function updateSoftKey(aType) {
    // Update key in signed in state, but not in option menu
    if (!SignIned ||
      (SignIned && Settings._currentPanel !== '#fxa') ||
      (SignIned && Settings._currentPanel === '#fxa' &&
        SettingsSoftkey.menuVisible())) {
      return;
    }

    var SignInsoftkeyParams = {
      menuClassName: 'menu-button',
      header: { l10nId: 'fxa-options' },
      items: [
        {
          name: 'Change password',
          l10nId: 'change-password',
          priority: 5,
          method: function () {
            fxaHelper.changePassword(function(result) {
              if (result && result.success) {
                refreshStatus();
                showToast('fxa-password-changed-successfully');
              }
            }, onFxAccountError);
          }
        },
        {
          name: 'Sign out',
          l10nId: 'sign-out',
          priority: 5,
          method: function () {
            var accts = getAccount();
            fxaHelper.signOut(accts, function(result) {
              if (result && result.success) {
                SettingsHelper('antitheft.enabled').set(false);
                onSignOut();
              } else if (result && result.error &&
                result.error === "ACCOUNT_DELETED") {
                // Do not show toast when account is deleted
                // Toast shows in system
                return;
              }
              showToast(result && result.success ?
                'fxa-sign-out-success' : 'fxa-sign-out-unsuccess');
            }, onFxAccountError);
          }
        }
      ]
    };
    if (window.accTestMode) {
      var delMenu = {
          name: 'Delete Account',
          l10nId: 'fxa-delete-account',
          priority: 5,
          method: function () {
            var accts = getAccount();  
            fxaHelper.checkPassword(accts, 'deleteAccount', function(result) {
              if (result && result.success) {
                showToast('fxa-account-deleted');
                NavigationMap.navigateBack();
              }
              refreshStatus();
            }, onFxAccountError);
          }
        };
      SignInsoftkeyParams.items.unshift(delMenu);
    }

    if(aType === 'personal-info') {
      var skObj = {
        name: 'select',
        l10nId: 'select',
        priority: 2,
        method: function () {
          var accts = getAccount();
          fxaHelper.editPersonalInfo(accts, function(result) {
            if (result && result.success) {
              showToast('fxa-accountInfo-changed-successfully');
            }
            refreshStatus(true);
          }, onFxAccountError);
        }
      }
      SignInsoftkeyParams.items.unshift(skObj);
    } else if(aType === 'email-info') {
      var skObj = {
        name: 'select',
        l10nId: 'select',
        priority: 2,
        method: function () {
          var accts = getAccount();
          fxaHelper.checkPassword(accts, 'email', function(result) {
            if (result && result.success) {
              showHint('fxa-email-verification-sent');
            }
            refreshStatus(true);
          }, onFxAccountError);
        }
      }
      SignInsoftkeyParams.items.unshift(skObj);
    } else if(aType === 'phone-info') {
      var skObj = {
        name: 'select',
        l10nId: 'select',
        priority: 2,
        method: function () {
          var accts = getAccount();
          fxaHelper.checkPassword(accts, 'phone', function(result) {
            if (result && result.success) {
              showHint('fxa-phone-number-updated');
            }
            refreshStatus(true);
          }, onFxAccountError);
        }
      }
      SignInsoftkeyParams.items.unshift(skObj);
    } else if(aType === 'alt-phone-info') {
      var skObj = {
        name: 'select',
        l10nId: 'select',
        priority: 2,
        method: function () {
          var accts = getAccount();
          fxaHelper.checkPassword(accts, 'altPhone', function(result) {
            if (result && result.success) {
              _onAltPhoneUpdated();
            }
            refreshStatus(true);
          }, onFxAccountError);
        }
      }
      SignInsoftkeyParams.items.unshift(skObj);
    } else {
      var skObj = {
        name: 'select',
        l10nId: 'select',
        priority: 2,
        method: function () {
        }
      }
      SignInsoftkeyParams.items.unshift(skObj);
    }

    SettingsSoftkey.init(SignInsoftkeyParams);
    SettingsSoftkey.show();
  }

  function onVisibilityChange(hide) {
    var panel = Settings._currentPanel;
    // mozId can be logged in fxa findmydevice developer > first time launch
    if (['#fxa', '#findmydevice', '#developer'].indexOf(panel) > -1) {
      if (document.hidden || hide === true) {
        fxaHelper.removeEventListener('onlogin', refreshStatus);
        fxaHelper.removeEventListener('onverified', refreshStatus);
        fxaHelper.removeEventListener('onlogout', refreshStatus);
      } else if (!document.hidden || hide === false) {
        fxaHelper.addEventListener('onlogin', refreshStatus);
        fxaHelper.addEventListener('onverified', refreshStatus);
        fxaHelper.addEventListener('onlogout', refreshStatus);
        refreshStatus();
      } else if (document.hidden && hide === false) {
        refreshStatus();
      }
    }

    // Force refresh.
    if (!SignIned && loggedInPanel.hidden && !loggedOutPanel.hidden) {
      refreshStatus();
    }
  }

  function refreshStatus(forceFetch) {
    fxaHelper.getAccounts(onFxAccountStateChange, onFxAccountError, forceFetch);
  }

  // if e == null, user is logged out.
  // Account format change.
  // The account info are verified. Pending account are not verified.
  // "{\"email\":\"abc@xyz.com\",
  // \"phone\":12345,\"altPhone\":654321,
  // \"pending\":{\"email\":\"abc1@xyz.com\",\"phone\":\"234567\",\"altPhone\":\"765432\"}}"
  function onFxAccountStateChange(e) {
    NavigationMap.delayFocusSet = false;
    if (e) {
      email = Normalizer.escapeHTML(e.email) || '';
      birthday = e.birthday || '';
      yob = e.yob || '';
      gender = e.gender || '';
      phoneNumber = e.phone || '';
      altPhoneNumber = e.altPhone || '';
      pemail = Normalizer.escapeHTML(e.pending && e.pending.email) || '';
      pphoneNumber = e.pending && e.pending.phone || '';
      paltPhoneNumber = e.pending && e.pending.altPhone || '';
      uid = e.uid;
    }

    if (!e || !uid) {
      onSignOut();
    } else {
      SignIned = true;
      hideLoggedOutPanel();
      showLoggedInPanel();
      headTitle.setAttribute('data-l10n-id', 'fxa-accounts-header-signed');
    }
    hideShowVerificationBtn();

    var event = {
      detail: {
        current: '#fxa'
      }
    };
    if (!firstSignIn) {
      var ele = document.querySelectorAll('.focus')[0];
      var id = ele && !ele.hidden && ele.id;
      if (needFocus(id)) {
        event.detail.needFocused = ele;
      }
    }
    var evt = new CustomEvent('panelready', event);
    if (Settings._currentPanel === '#fxa') {
      window.dispatchEvent(evt);
    }

    if(SignIned) {
      firstSignIn = false;

      // Update account only at Sign in state
      var accts = getAccount();
      accts && FxaMenu && FxaMenu.updateAccount(accts);
    }
  }

  function onFxAccountError(err) {
    NavigationMap.delayFocusSet = false;
    console.log('FxaPanel: Error getting Firefox Account: ' + err);
  }

  function getAccount() {
    if (!uid) {
      return null;
    }

    var acctObj = {};
    acctObj.email = email;
    acctObj.pemail = pemail;
    acctObj.phone = phoneNumber;
    acctObj.altPhone = altPhoneNumber;
    acctObj.paltPhone = paltPhoneNumber;
    acctObj.yob = yob;
    acctObj.gender = gender;
    acctObj.birthday = birthday;
    acctObj.uid = uid;

    return acctObj;
  }

  function hidePhoneVerificationPanel() {
    phoneUnverifiedPanel.hidden = true;
  }

  function showPhoneVerificationPanel() {
    phoneUnverifiedPanel.hidden = false;
  }

  function hideShowVerificationBtn() {
    // The buttons are hidden on default.
    // Refresh when they show.
    if (pemail) {
      showResendMailBtn();
    } else {
      hideResendMailBtn();
    }

    hideShowAltPhoneVericationButton();
  }

  function getAltPhoneVerificationStorage() {
    let ret = null;
    try {
      ret = JSON.parse(localStorage.getItem('altPhoneVerification'));
    } catch (e) {
      console.log('Error getting altPhoneVerification storage');
      return ret;
    }

    return ret;
  }

  function setAltPhoneVerificationStorage(id, expire, altPhone) {
    if (!id || !expire) {
      window.localStorage.setItem('altPhoneVerification', '');
      return;
    }

    let obj = {};
    obj.verificationId = id;
    obj.expireAt = expire;
    obj.altPhone = altPhone;
    window.localStorage.setItem('altPhoneVerification', JSON.stringify(obj));
  }

  function hideShowAltPhoneVericationButton() {
    let processing = function() {
      let data = getAltPhoneVerificationStorage();
      if (data && data.expireAt && data.expireAt > Date.now() &&
        data.altPhone == paltPhoneNumber) {
        return true;
      }

      return false;
    }

    if (paltPhoneNumber) {
      if (processing()) {
        showVerifyAltPhoneOtpBtn();
      } else {
        showResendAltPhoneOtpBtn();
      }
    } else {
      hideResendAltPhoneOtpBtn();
    }
  }

  function onAltphoneOTPRequested(id, expire, altPhone) {
    setAltPhoneVerificationStorage(id, expire, altPhone);
    let span = expire - Date.now();
    if (span > 10 * 1000) {
      hideShowAltPhoneVericationButton();
      clearTimeout(altPhoneProcessingTimer);
      altPhoneProcessingTimer = setTimeout(function () {
        hideShowAltPhoneVericationButton();
      }, span + 1000);
    }
  }

  function hideLoggedOutPanel() {
    loginEmailBtn.onclick = null;
    loginNumberBtn.onclick = null;
    loggedOutPanel.hidden = true;
    fxaHeader.hidden = false;
    fxaHeader.style.display = '';
  }

  function showLoggedOutPanel() {
    loginEmailBtn.onclick = onLoginEmailClick;
    loginNumberBtn.onclick = onLoginNumberClick;
    loggedOutPanel.hidden = false;
    fxaHeader.hidden = true;
    fxaHeader.style.display = 'none';
  }

  function hideLoggedInPanel() {
    loggedInPanel.hidden = true;
    loggedInEmail.textContent = '';
    loggedInEmailLabel.textContent = '';
    loggedInAltPhone.textContent = '';
    loggedInAltPhoneLabel.textContent = '';
    loggedInPhone.textContent = '';
    window.removeEventListener('localized', localizInfo);
  }

  function localizInfo () {
    loggedInEmail.textContent = pemail || email || _('fxa-no-email');

    // Show unverified higher prority.
    var lEmailStr = '';
    if (pemail) {
      lEmailStr = ' (' + _('unverified') + ')';
    } else if (email){
      lEmailStr = ' (' + _('verified') + ')';
    }

    loggedInEmailLabel.textContent = _('fxa-email-label') + lEmailStr;

    loggedInPhone.textContent =  phoneNumber || _('fxa-no-phone-number');
    loggedInAltPhone.textContent = paltPhoneNumber || altPhoneNumber || _('fxa-no-phone-number');

    var lPhoneStr = '';
    if (paltPhoneNumber) {
      lPhoneStr = ' (' + _('unverified') + ')';
    } else if (altPhoneNumber){
      lPhoneStr = ' (' + _('verified') + ')';
    }
    loggedInAltPhoneLabel.textContent = _('fxa-alt-phone-label') + lPhoneStr;

    var year, formatedDate;
    if (yob !== '') {
      year = yob;
    } else {
      formatedDate = new Date(birthday);
      if (!isNaN(formatedDate.getTime())) {
        year = formatedDate.getFullYear();
      }
    }
    var lgender = _('fxa-gender-' + gender.toLowerCase());
    personalInfoContent.textContent = year + ' / ' + lgender;
  }

  function showLoggedInPanel() {
    localizInfo();
    window.addEventListener('localized', localizInfo);

    loggedInPanel.hidden = false;
  }

  function showResendMailBtn() {
    resendMailBlk.hidden = false;
    resendMailButton.hidden = false;
    resendMailBtn.onclick = _onResendMailClick;
  }

  function hideResendMailBtn() {
    resendMailBlk.hidden = true;
    resendMailButton.hidden = true;
    resendMailBtn.onclick = null;
  }

  function showResendAltPhoneOtpBtn() {
    resendAltPhoneOtpBlk.hidden = false;
    resendAltPhoneOtpButton.hidden = false;
    resendAltPhoneOtpBtn.onclick = _onResendAltPhoneClick;
    resendAltPhoneOtpBtn.textContent = _('fxa-send-altphone-otp');
  }

  function showVerifyAltPhoneOtpBtn() {
    _enableSendAltphone();
    resendAltPhoneOtpBlk.hidden = false;
    resendAltPhoneOtpButton.hidden = false;
    resendAltPhoneOtpBtn.onclick = _onVerifyAltPhoneClick;
    resendAltPhoneOtpBtn.textContent = _('verify-altphone-otp');
  }

  function hideResendAltPhoneOtpBtn() {
    resendAltPhoneOtpBlk.hidden = true;
    resendAltPhoneOtpButton.hidden = true;
    resendAltPhoneOtpBtn.onclick = null;
  }

  function onLogoutClick(e) {
    e.stopPropagation();
    e.preventDefault();

    var accountId = email || phone;
    if (!accountId) {
      return refreshStatus();
    }
    fxaHelper.signOut(accountId, refreshStatus, onFxAccountError);

  }

  function _onResendMailClick(e) {
    e.stopPropagation();
    e.preventDefault();
    if (resendMailBtn.classList.contains('disabled')) {
      return;
    }
    if (!navigator.onLine) {
      showToast('fxa-no-internet-connection');
      return;
    }

    // disable link for 60 seconds, then re-enable
    resendMailBtn.classList.add('disabled');
    resendMailBtn.parentNode.parentNode.classList.add('disabled');
    setTimeout(function enableResendMailBtn() {
      resendMailBtn.classList.remove('disabled');
      resendMailBtn.parentNode.parentNode.classList.remove('disabled');
    }, 60000);

    if (!pemail || !uid) {
      return refreshStatus();
    }
    fxaHelper.requestEmailVerification(pemail, uid, function () {
      _onResend();
    }, function (e) {
      var msg = 'fxa-email-verification-sent-fail';
      if (e.error === 'ALREADY_VERIFIED') {
        msg = 'fxa-already-verified';
      }
      refreshStatus();
      showHint(msg);
      onFxAccountError(e);
    });
  }

  function _onResend() {
    refreshStatus(true);
    showHint('fxa-email-verification-sent');
  }

  function _onResendAltPhoneClick(e) {
    e.stopPropagation();
    e.preventDefault();

    if (resendAltPhoneOtpBlk.classList.contains('disabled')) {
      return;
    }
    if (!navigator.onLine) {
      showToast('fxa-no-internet-connection');
      return;
    }
    _disableSendAltphone();
    let timer = setTimeout(function () {
      _enableSendAltphone();
    }, 60000);

    if (!paltPhoneNumber || !uid) {
      return refreshStatus();
    }

    fxaHelper.requestPhoneVerification(paltPhoneNumber, uid, function (result) {
      if (result && result.verificationId) {
        clearTimeout(timer);
        let args = {time: ALTPHONE_VERIFICATION_EXPIRES_MIN, phone: paltPhoneNumber};
        showHint('sms-sent-note', args);
        let expire = Date.now() + ALTPHONE_VERIFICATION_EXPIRES;
        onAltphoneOTPRequested(result.verificationId, expire, paltPhoneNumber);
      }
    }, function (e) {
      if (e.error === 'ALREADY_VERIFIED') {
        showHint('fxa-already-verified');
      }
      refreshStatus();
      onFxAccountError(e)
    });
  }

  function _onVerifyAltPhoneClick(e) {
    e.stopPropagation();
    e.preventDefault();
    if (resendAltPhoneOtpBlk.classList.contains('disabled')) {
      return;
    }
    if (!navigator.onLine) {
      showToast('fxa-no-internet-connection');
      return;
    }

    var data = getAltPhoneVerificationStorage();
    var verificationId = data ? data.verificationId : null;

    if (!paltPhoneNumber || !uid || !verificationId) {
      return refreshStatus();
    }

    fxaHelper.verifyAltPhone(paltPhoneNumber, uid, verificationId, function (result) {
      if (result && result.success) {
        setAltPhoneVerificationStorage();
        clearTimeout(altPhoneProcessingTimer);
      } else if (result && !result.success) {
        if (result.verificationId && result.expireAt) {
          onAltphoneOTPRequested(result.verificationId, result.expireAt, paltPhoneNumber);
        }
      }
      refreshStatus(true);
    }, function (e) {
      if (e.error === 'ALREADY_VERIFIED') {
        showHint('fxa-already-verified');
        setAltPhoneVerificationStorage();
        clearTimeout(altPhoneProcessingTimer);
      }
      refreshStatus();
      onFxAccountError(e);
    });
  }

  function _disableSendAltphone() {
    resendAltPhoneOtpBtn.classList.add('disabled');
    resendAltPhoneOtpBtn.parentNode.parentNode.classList.add('disabled');
  }

  function _enableSendAltphone() {
    resendAltPhoneOtpBtn.classList.remove('disabled');
    resendAltPhoneOtpBtn.parentNode.parentNode.classList.remove('disabled');
  }

  function _onAltPhoneUpdated() {
    showHint('alt-phone-updated');
  }

  function showConfirmation() {
    if (resendAltPhoneOtpBtn.classList.contains('disabled')) {
      return;
    }

    var dialogConfig = {
      title: {
        id: 'confirmation',
        args: {}
      },
      body: {
        id: 'fxa-alt-phone-resend-alert',
        args: {}
      },
      cancel: {
        name: 'cancel',
        l10nId: 'cancel',
        priority: 1,
        callback: function() {
        }
      },
      confirm: {
        name: 'send-sms',
        l10nId: 'fxa-send-sms',
        priority: 3,
        callback: function() {
          _confirmResndAltOTP();
        }
      }
    };

    var dialog = new ConfirmDialogHelper(dialogConfig);
    dialog.show(document.getElementById('app-confirmation-dialog'));
  }

  function showHint(message, bodyOptions = {}) {
    var dialogConfig = {
      title: { id: 'confirmation', args: {} },
      body: { id: message, args: bodyOptions },
      accept: {
        l10nId: 'ok',
        priority: 2,
        callback: function() {
          dialog.destroy();
        },
      }
    };

    var dialog = new ConfirmDialogHelper(dialogConfig);
    dialog.show(document.getElementById('app-confirmation-dialog'));
  }

  function setOrRefresh(success) {
    if (success === true) {
      SettingsHelper('antitheft.enabled').set(true);
      refreshStatus();
    }
  }

  function onLoginEmailClick(e) {
    e.stopPropagation();
    e.preventDefault();
    NavigationMap.delayFocusSet = true;
    fxaHelper.openFlow(function (accts) {
      setOrRefresh(accts && accts.success);
    }, function () { });
  }

  function onLoginNumberClick(e) {
    e.stopPropagation();
    e.preventDefault();
    NavigationMap.delayFocusSet = true;
    fxaHelper.phoneNumberLogin(function (accts) {
      setOrRefresh(accts && accts.success);
    }, function () { });
  }

  function initSoftKey() {
    var softkeyParams = {
      menuClassName: 'menu-button',
      header: { l10nId: 'fxa-options' },
      items: [
        {
          name: 'notNow',
          l10nId: 'notNow',
          priority: 1,
          method: function () {
            NavigationMap.delayFocusSet = false;
            NavigationMap.navigateBack();
          }
        },
        {
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: function () {
          }
        },
        {
          name: 'About',
          l10nId: 'fxa-about',
          priority: 3,
          method: function () {
            document.getElementById('account-about').click();
          }
        }
      ]
    };
    SettingsSoftkey.init(softkeyParams);
    SettingsSoftkey.show();
  }

  function initSignInSoftKey(id) {
    if(!id) {
      id = 'phone-info';
    }
    updateSoftKey(id);
  }
  return {
    init: init,
    onVisibilityChange: onVisibilityChange,
    getAccount: getAccount,
    // exposed for testing
    _onResendClick: _onResendMailClick,
    _onResend: _onResend
  };

})();
