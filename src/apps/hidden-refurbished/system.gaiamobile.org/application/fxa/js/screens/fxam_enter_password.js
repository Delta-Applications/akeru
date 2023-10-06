/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModuleStates, FxaModule, FxaModuleManager, $, ViewManager */
/* exported FxaModuleEnterPassword */

'use strict';

/**
 * This module checks the validity of password given email address, and if
 * valid, determine which screen to go next.
 */

var FxaModuleEnterPassword = (function () {
  function _isPasswordValid(passwordEl, passwordCheck) {
    var passwordValue = passwordEl.value;
    return passwordValue;
  }
  
  function _checkPassword(passwordEl, passwordCheck) {
    var passwordValue = passwordEl.value;
    if (!passwordValue || passwordValue.length < 8) {
      return 'PASSWORD_LESS';
    }

    if (passwordValue.length > 20) {
      return 'PASSWORD_MORE';
    }

    if (passwordValue !== passwordCheck.value) {
      return 'PASSWORD_DONT_MATCH';
    }

    if (!(/^(?![^a-zA-Z]+$)(?!\D+$).{8,20}$/.test(passwordValue))) {
      return 'PASSWORD_ERROR';
    }
    
    return '';
  }

  function _enableNext(passwordEl, passwordCheck) {
    if (_isPasswordValid(passwordEl, passwordCheck)) {
      $('fxa-enter-password').dataset.subid = 'next';
    } else {
      $('fxa-enter-password').dataset.subid = '';
    }
    ViewManager.setSkMenu();
  }

  function _cleanForm(passwordEl, passwordCheck) {
    passwordEl.value = '';
    passwordCheck.value = '';
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    var self = this;
    this.email = options.email;
    if (!this.initialized) {
      // Cache DOM elements
      this.importElements(
        'fxa-pw-input',
        'fxa-forgot-password',
        'fxa-confirm-pw-input'
      );
      // Add listeners
      this.fxaPwInput.addEventListener(
        'input',
        function onInput(event) {
          _enableNext(event.target, self.fxaConfirmPwInput);
        }
      );
      this.fxaConfirmPwInput.addEventListener(
        'input',
        function onInput(event) {
          _enableNext(self.fxaPwInput, event.target);
        }
      );      

      // Avoid repeated initialization
      this.initialized = true;
    }
    _cleanForm(self.fxaPwInput, self.fxaConfirmPwInput);
    _enableNext(self.fxaPwInput, self.fxaConfirmPwInput);
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
    var error = _checkPassword(this.fxaPwInput, this.fxaConfirmPwInput);
    if (error) {
      this.showErrorResponse({ error: error });
      return;
    }

    gotoNextStepCallback(FxaModuleStates.ENTER_ACCOUNT_INFO);
    FxaModuleManager.setParam('password', this.fxaPwInput.value);
  };

  Module.onBack = function onBack() {
    this.fxaPwInput.disabled = false;
    this.fxaPwInput.focus();
  };

  Module.onDone = function onDone() {
  };
  return Module;
} ());
