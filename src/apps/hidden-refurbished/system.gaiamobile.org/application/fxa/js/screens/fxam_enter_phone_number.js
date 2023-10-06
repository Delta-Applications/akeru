/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModuleStates, FxaModule, FxModuleServerRequest,
          FxaModuleManager, NavigationMap, ViewManager, $ */
/* exported FxaModuleEnterPhoneNumber */

'use strict';

/**
 * This module checks the validity of a phone number, and if valid,
 * determines which screen to go next.
 */

var FxaModuleEnterPhoneNumber = (function () {
  var loading, hasSentSMS;
  var DEBUG = false;

  function _debug(msg) {
    if (DEBUG) {
      console.log(msg);
    }
  }

  function _checkPhoneNumber(phoneNumber) {
    var reg = /^(\+){0,1}\d{6,}$/;
    return reg.test(phoneNumber);
  }

  function _enableNext(phoneNumberElement) {
    if (_checkPhoneNumber(phoneNumberElement.value)) {
      $('fxa-enter-phone-number').dataset.subid =
        hasSentSMS ? 'resend-sms' : 'send-sms';
    } else {
      $('fxa-enter-phone-number').dataset.subid = '';
    }
    ViewManager.setSkMenu();
  }

  function _showLoading() {
    loading = true;
  }

  function _hideLoading() {
    loading = false;
  }

  function _loadPhoneNumber(phoneNumberElement) {
    var _conns = navigator.mozMobileConnections;
    if (!_conns) {
      return;
    }

    var phoneNumber = null;

    Array.prototype.some.call(_conns, function(conn, index) {
      var iccId = conn.iccId;
      if (!iccId) {
        return;
      }

      var iccObj = navigator.mozIccManager.getIccById(iccId);
      if (!iccObj) {
        return;
      }

      var iccInfo = iccObj.iccInfo;
      if (!iccInfo) {
        return;
      }

      phoneNumber = iccInfo.msisdn || iccInfo.mdn;
      if (phoneNumber) {
        _debug('--> _loadPhoneNumber(): phoneNumber = ' + phoneNumber);
        phoneNumberElement.value = phoneNumber;
        return true;
      }
    });
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    // Cache static HTML elements
    this.importElements('fxa-phone-number-input');
    // Fetch phone number and fill into input field automatically.
    _loadPhoneNumber(this.fxaPhoneNumberInput);

    if (this.initialized) {
      // The second time to navigate the page.
      hasSentSMS = true;
      // Blocks the navigation until check the condition
      _enableNext(this.fxaPhoneNumberInput);
      return;
    }

    // Blocks the navigation until check the condition
    _enableNext(this.fxaPhoneNumberInput);
    // Add listeners
    this.fxaPhoneNumberInput.addEventListener(
      'input',
      function onInput(event) {
        _enableNext(event.target);
      }
    );
    // Avoid to add listener twice
    this.initialized = true;
    // Check message sent or not
    hasSentSMS = false;
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
    if (loading) {
      return;
    }

    if (!_checkPhoneNumber(this.fxaPhoneNumberInput.value)) {
      return;
    }

    var phoneNumber = this.fxaPhoneNumberInput.value;

    _debug('--> onNext(): phoneNumber = ' + phoneNumber);

    _showLoading();

    FxModuleServerRequest.requestVerificationOtp(phoneNumber,
    (response) => {
      _hideLoading();
      NavigationMap.currentActivatedLength = 0;
      FxaModuleManager.setParam('phoneNumber', phoneNumber);
      if (response && response.registered) {
        // has registered
        // We don't go into the case because settings menu blocks
        // a verified account to request phone verification again.
        _debug('--> onNext(): onsuccess(): response.registered = true');
        window.parent.FxAccountsUI.done({ verifiedResult: true });
      } else {
        // has not registered
        _debug('--> onNext(): onsuccess(): response.registered = false');
        gotoNextStepCallback(FxaModuleStates.ENTER_PHONE_OTP);
      }
    }, (response) => {
      _hideLoading();
      NavigationMap.currentActivatedLength = 0;
      _debug('--> onNext(): onerror() to show error with toast');
      this.showErrorResponse(response);
    });
  };

  Module.onBack = function onBack() {
    // The second time to navigate the page.
    hasSentSMS = true;
  };

  Module.onDone = function onDone() {
    _hideLoading();
  };
  return Module;
}());
