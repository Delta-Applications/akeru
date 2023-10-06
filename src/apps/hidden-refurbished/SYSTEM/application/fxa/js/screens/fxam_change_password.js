/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModule, FxaModuleManager, $, ViewManager, NavigationMap,
          FxModuleServerRequest, FxaModuleOverlay */
/* exported FxaModuleChangePassword */

'use strict';

/**
 * This module checks the validity of password given email address, and if
 * valid, determine which screen to change password.
 */

var FxaModuleChangePassword = (function () {
  var DEBUG = false;

  function _debug(msg) {
    if (DEBUG) {
      console.log(msg);
    }
  }

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
      $('fxa-change-password').dataset.subid = 'next';
    } else {
      $('fxa-change-password').dataset.subid = '';
    }
    ViewManager.setSkMenu();
  }

  function _cleanForm(passwordEl, passwordCheck) {
    passwordEl.value = '';
    passwordCheck.value = '';
  }

  function _onShowPwClick(checkEl, newPasswordEl, confirmPasswordEl, orgPasswordEl) {
    if (checkEl.checked) {
      orgPasswordEl.type = 'text';
      newPasswordEl.type = 'text';
      confirmPasswordEl.type = 'text';
    } else {
      orgPasswordEl.type = 'password';
      newPasswordEl.type = 'password';
      confirmPasswordEl.type = 'password';
    }
  }

  function _showLoading() {
    FxaModuleOverlay.show('fxa-changing-password');
    $('fxa-change-password').dataset.subid = 'loading';
    ViewManager.setSkMenu();
  }

  function _hideLoading() {
    $('fxa-change-password').dataset.subid = '';
    ViewManager.setSkMenu();
    FxaModuleOverlay.hide();
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    this.email = options.email;
    if (!this.initialized) {
      // Cache DOM elements
      this.importElements(
        'fxa-pw-input',
        'fxa-new-pw-input',
        'fxa-confirm-pw-input',
        'fxa-show-pw'
      );
      // Add listeners
      this.fxaNewPwInput.addEventListener('input', (event) => {
        _enableNext(event.target, this.fxaConfirmPwInput);
      });

      this.fxaConfirmPwInput.addEventListener('input', (event) => {
        _enableNext(this.fxaNewPwInput, event.target);
      });

      this.fxaShowPw.addEventListener('click', (event) => {
        _onShowPwClick(event.target, this.fxaNewPwInput,
                       this.fxaConfirmPwInput, this.fxaPwInput);
      });

      // Avoid repeated initialization
      this.initialized = true;
    }
    _cleanForm(this.fxaNewPwInput, this.fxaConfirmPwInput);
    _enableNext(this.fxaNewPwInput, this.fxaConfirmPwInput);
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
    var error = _checkPassword(this.fxaNewPwInput, this.fxaConfirmPwInput);
    if (error) {
      this.showErrorResponse({ error: error });
      return;
    }

    _showLoading();
    FxModuleServerRequest.changePassword(
      this.fxaPwInput.value, this.fxaNewPwInput.value,
      function onServerResponse(response) {
        _debug('--> after changePassword(): onServerResponse(): response = ');
        NavigationMap.currentActivatedLength = 0;
        FxaModuleManager.setParam('password', this.fxaNewPwInput.value);
        _hideLoading();
        window.parent.FxAccountsUI.done({ success: true });
      }.bind(this),
      function onError(response) {
        _debug('--> after changePassword(): onError(): response = ');
        NavigationMap.currentActivatedLength = 0;
        _hideLoading();
        this.showErrorResponse(response);
      }.bind(this)
    );

    // gotoNextStepCallback(FxaModuleStates.ENTER_ACCOUNT_INFO);
    FxaModuleManager.setParam('password', this.fxaConfirmPwInput.value);
  };

  Module.onBack = function onBack() {
  };

  Module.onDone = function onDone() {
  };
  return Module;
} ());
