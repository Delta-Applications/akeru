/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModule, FxaModuleNavigation, FxModuleServerRequest,
          FxaModuleManager, ViewManager, NavigationMap, $ */
/* exported FxaModuleEnterOTP */

'use strict';

/**
 * This module wait the OTP of a phone number. Once it get the OTP,
 * sign in the account with the phone number, OTP.
 * Then, determines which screen to go next according to receive OTP
 * or not, server response.
 */

var FxaModuleEnterOTP = (function () {
  var endTime;
  var countdownTimer = null;
  var COUNTDOWN_TIME = 2 * 60 * 1000;
  var COUNTDOWN_INTERVAL_TIME = 1000;
  var DEBUG = false;

  function _debug(msg) {
    if (DEBUG) {
      console.log(msg);
    }
  }

  function _fillInCode(otp, containerEl) {
    containerEl.textContent = otp;
  }
  
  function _updateSkipButton(enable) {
    if (enable) {
      $('fxa-enter-otp').dataset.subid = '';
    } else {
      ViewManager.hide();
    }
  }

  function _getTimeRemaining(endTime) {
    var t = Date.parse(endTime) - Date.parse(new Date());
    var seconds = Math.floor( (t/1000) % 60 );
    var minutes = Math.floor( (t/1000/60) % 60 );
    return {
      'total': t,
      'minutes': minutes,
      'seconds': seconds
    };
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    // Cache static HTML elements
    this.importElements(
      'fxa-time-remaining',
      'fxa-otp-container'
    );

    this.options = options || {};

    _fillInCode('', this.fxaOtpContainer);

    _updateSkipButton(true);

    this.startCountdownRemaningTime();
  };

  Module.startCountdownRemaningTime = function() {
    this.stopCountdownRemaningTime();
    // Create deadline 2 minutes from now.
    var currentTime = Date.parse(new Date());
    endTime = new Date(currentTime + COUNTDOWN_TIME);
    // Set interval timer to refresh remaining time.
    countdownTimer = setInterval(() => {
      this.updateRemainingTime();
    }, COUNTDOWN_INTERVAL_TIME);
  };

  Module.stopCountdownRemaningTime = function() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      endTime = null;
    }
  };

  Module.updateRemainingTime = function() {
    var currentTimeRemaining = _getTimeRemaining(endTime);
    this.fxaTimeRemaining.textContent =
      currentTimeRemaining.minutes +
      ':' +
      ('0' + currentTimeRemaining.seconds).slice(-2);

    if ((currentTimeRemaining.total <= 0) && countdownTimer) {
      this.stopCountdownRemaningTime();
      // User might have to resend message.
      // Back to enter phone number automatically.
      FxaModuleNavigation.back();
    }
  };

  Module.onOTPReceived = function(otp) {
    _debug('--> onOTPReceived(): otp = ' + otp +
           ', phone number = ' + this.options.phoneNumber);
    _fillInCode(otp, this.fxaOtpContainer);
    // update soft key and blocks the navigation until server response
    _updateSkipButton(false);
    // request log in with phone number, OTP
    FxModuleServerRequest.signInWithOTP(this.options.phoneNumber, otp,
    (response) => { // onServerResponse
      _debug('--> signInWithOTP onServerResponse response = ' + response);
      NavigationMap.currentActivatedLength = 0;
      if (!response.authenticated) {
        _debug('--> signInWithOTP early return since !response.authenticated');
        window.parent.FxAccountsUI.done({ success: false });
        return;
      }
      _debug('--> signInWithOTP setParam success since response.authenticated');
      FxaModuleManager.setParam('success', true);
      window.parent.FxAccountsUI.done(FxaModuleManager.paramsRetrieved);
    }, (response) => { // onError
      _debug('--> signInWithOTP onError response = ' + response);
      NavigationMap.currentActivatedLength = 0;
      // Verify failed, user might have to resend message.
      // Back to enter phone number.
      FxaModuleNavigation.back();
    });
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
  };

  Module.onBack = function onBack() {
  };

  Module.onDone = function onDone() {
  };
  return Module;
}());
