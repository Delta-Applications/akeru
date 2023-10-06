/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModuleStates, FxaModuleUI, FxaModule, FxaModuleNavigation,
   FxModuleServerRequest, FxaModuleOverlay, $, FxaModuleManager, BrowserFrame */
/* exported FxaModuleSigning */

'use strict';

/**
 * This module checks the validity of an email address, and if valid,
 * determines which screen to go next.
 */

var FxaModuleForgotPassword = (function () {
  var self = this;
  function _checkEmail(email) {
    var reg = /^\w+((-\w+)|(\.\w+))*\@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/;
    return reg.test(email);
  }

  function _showLoading() {
    FxaModuleOverlay.show('fxa-connecting');
    $('fxa-forgot-password').dataset.subid = 'loading';
    ViewManager.setSkMenu();
  }

  function _hideLoading() {
    FxaModuleOverlay.hide();
    $('fxa-forgot-password').dataset.subid = '';
    ViewManager.setSkMenu();
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {

    this.importElements(
      'fxa-reset-email-input'
    );

    this.fxaResetEmailInput.value = options.email;

    ViewManager.setSkMenu();
  };
  Module.onNext = function onNext(gotoNextStepCallback) {
    var self = this;
    var email = this.fxaResetEmailInput.value;
    if (!_checkEmail(email)) {
      self.showErrorResponse({ error: 'INVALID_EMAIL' });
      return;
    }
    _showLoading();
    FxModuleServerRequest.resetPassword(
      email,
      function onServerResponse(response) {
        _hideLoading();
        gotoNextStepCallback(FxaModuleStates.FORGOT_PASSWORD_SUCCESS);
      },
      function onError(response) {
        _hideLoading();
        self.showErrorResponse(response);
      }
    );
  };
  Module.onBack = function onBack() {
    _hideLoading();
  };
  return Module;
}());
