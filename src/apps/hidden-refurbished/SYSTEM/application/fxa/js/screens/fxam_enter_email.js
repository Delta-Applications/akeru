/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModuleStates, FxaModuleUI, FxaModule, FxaModuleNavigation,
   FxModuleServerRequest, FxaModuleOverlay, FxaModuleManager, BrowserFrame */
/* exported FxaModuleEnterEmail */

'use strict';

/**
 * This module checks the validity of an email address, and if valid,
 * determines which screen to go next.
 */

var FxaModuleEnterEmail = (function () {
  var loading;
  function _isEmailValid(emailEl) {
    return emailEl && emailEl.value && emailEl.validity.valid && _checkEmail(emailEl.value);
  }

  function _checkEmail(email) {
    var reg = /^\w+((-\w+)|(\.\w+))*\@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/;
    return reg.test(email);
  }

  function _enableNext(emailEl) {
    if (_isEmailValid(emailEl)) {
      $('fxa-email').dataset.subid = 'next';
    } else {
      $('fxa-email').dataset.subid = '';
    }
    ViewManager.setSkMenu();
  }

  function _showLoading() {
    loading = true;
    //FxaModuleOverlay.show('fxa-connecting');
    //$('fxa-email').dataset.subid = 'loading';
    //ViewManager.setSkMenu();
  }

  function _hideLoading() {
    loading = false;
    //FxaModuleOverlay.hide();
    //$('fxa-email').dataset.subid = 'next';
    //ViewManager.setSkMenu();
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    // Cache static HTML elements
    this.importElements(
      'fxa-email-input',
      'fxa-show-age'
    );

    // Blocks the navigation until check the condition
    _enableNext(this.fxaEmailInput);

    if (this.initialized) {
      return;
    }

    // dynamically construct and localize ToS/PN notice
    // XXX This relies on the current l10n fallback mechanism which will change
    // in the future;  a real solution involves DOM overlays:
    // https://bugzil.la/994357


    // manually import a few elements after innerHTMLing


    this.isFTU = !!(options && options.isftu);

    // Add listeners
    this.fxaEmailInput.addEventListener(
      'input',
      function onInput(event) {
        _enableNext(event.target);
      }
    );

    var placeholder = navigator.mozL10n.get('fxa-placeholder');
    this.fxaEmailInput.setAttribute('placeholder', placeholder);

    // Avoid to add listener twice
    this.initialized = true;
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
    var self = this;
    if (loading) return;
    if (!_checkEmail(this.fxaEmailInput.value)) {
      self.showErrorResponse({ error: "INVALID_EMAIL" });
      return;
    }
    if (!this.fxaShowAge.checked) {
      self.showErrorResponse({ error: "CONFIRM_AGE" });
      return;
    }
    var email = this.fxaEmailInput.value;
    _showLoading();
    FxModuleServerRequest.checkEmail(
      email,
    function onSuccess(response) {
      _hideLoading();
      NavigationMap.currentActivatedLength = 0;
      FxaModuleManager.setParam('email', email);
      if (response && response.registered) {
        self.showErrorResponse({ error: 'EMAIL_IS_TAKEN' });
      } else {
        gotoNextStepCallback(FxaModuleStates.ENTER_PASSWORD);
      }
    }.bind(this),
    function (response) {
      _hideLoading();
      NavigationMap.currentActivatedLength = 0;
      self.showErrorResponse(response);
    });
  };

  Module.onBack = function onBack() {
    FxaModuleUI.enableNextButton();
  };

  Module.onDone = function onDone() {
    _hideLoading();
  };
  return Module;
}());
