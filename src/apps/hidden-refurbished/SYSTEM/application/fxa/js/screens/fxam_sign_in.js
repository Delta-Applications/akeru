/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModuleStates, FxaModuleUI, FxaModule, FxaModuleNavigation,
   FxModuleServerRequest, FxaModuleOverlay, FxaModuleManager, BrowserFrame */
/* exported FxaModuleLogin */

'use strict';

/**
 * This module checks the validity of an email address, and if valid,
 * determines which screen to go next.
 */
var FxaModuleSignIn = (function () {
  function _isEmailValid(emailEl) {
    return emailEl && emailEl.value && emailEl.validity.valid && _checkEmail(emailEl.value);
  }

  function _checkEmail(email) {
    var reg = /^\w+((-\w+)|(\.\w+))*\@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/;
    return reg.test(email);
  }

  function _showLoading() {
    FxaModuleOverlay.show('fxa-sining-in');
    $('fxa-sign-in').dataset.subid = 'loading';
    ViewManager.setSkMenu();
  }

  function _hideLoading() {
    FxaModuleOverlay.hide();
    $('fxa-sign-in').dataset.subid = '';
    ViewManager.setSkMenu();
  }
  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    // Cache static HTML elements
    this.importElements(
      'fxa-email-input',
      'fxa-pw-input',
      'fxa-show-pw'
    );

    if (this.initialized) {
      return;
    }

    // dynamically construct and localize ToS/PN notice
    // XXX This relies on the current l10n fallback mechanism which will change
    // in the future;  a real solution involves DOM overlays:
    // https://bugzil.la/994357


    this.isFTU = !!(options && options.isftu);


    this.fxaShowPw.addEventListener(
      'click',
       onShowPwClick.bind(this)
    );

    var placeholder = navigator.mozL10n.get('fxa-placeholder');
    this.fxaEmailInput.setAttribute('placeholder', placeholder);

    var placeholderPassword = navigator.mozL10n.get('fxa-password');
    this.fxaPwInput.setAttribute('placeholder', placeholderPassword);

    function onShowPwClick() {
      if (this.fxaShowPw.checked) {
        this.fxaPwInput.type = 'text';
      } else {
        this.fxaPwInput.type = 'password';
      }
    }

    // Avoid to add listener twice
    this.initialized = true;
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
    var self = this;
    if (!_checkEmail(this.fxaEmailInput.value)) {
      self.showErrorResponse({ error: "INVALID_EMAIL" });
      return;
    }
    var email = this.fxaEmailInput.value;
    _showLoading();
    FxModuleServerRequest.signIn(
    email,
    this.fxaPwInput.value,
    function onServerResponse(response) {
      NavigationMap.currentActivatedLength = 0;
      _hideLoading();
      FxaModuleManager.setParam('email', email);
      if (!response.authenticated) {
        window.parent.FxAccountsUI.done({ success: false });
        return;
      }
      FxaModuleManager.setParam('success', true);
      window.parent.FxAccountsUI.done(FxaModuleManager.paramsRetrieved);
    }.bind(this),
    function onError(response) {
      NavigationMap.currentActivatedLength = 0;
      _hideLoading();
      self.showErrorResponse(response);
    }.bind(this)
   );
  };
  Module.onBack = function onBack(gotoBackStepCallback) {
    FxaModuleManager.setParam('email', this.fxaEmailInput.value);
    gotoBackStepCallback(FxaModuleStates.FORGOT_PASSWORD);
  };
  Module.onDone = function onDone() {
    _hideLoading();
  };
  return Module;
}());
