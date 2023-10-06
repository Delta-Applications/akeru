/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModule, FxModuleServerRequest, FxaModuleOverlay,
          NavigationMap, ViewManager, $ */
/* exported FxaModuleSignOut */

'use strict';

/**
 * This module checks the validity of an email address, and if valid,
 * determines which screen to go next.
 */
var FxaModuleSignOut = (function () {
  function _showLoading() {
    FxaModuleOverlay.show('fxa-signing-out');
    $('fxa-sign-out').dataset.subid = 'loading';
    ViewManager.setSkMenu();
  }

  function _hideLoading() {
    $('fxa-sign-out').dataset.subid = '';
    ViewManager.setSkMenu();
    FxaModuleOverlay.hide();
  }

  function _SignOutWithAntitheft(model, email, password) {
    _showLoading();
    FxModuleServerRequest.signIn(
      email,
      password,
      function onServerResponse() {
        var logout = function () {
          NavigationMap.currentActivatedLength = 0;
          _hideLoading();
          window.parent.FxAccountsClient.logout(function () {
            window.parent.FxAccountsUI.done({ success: true });
          }, function onError(response) {
            if (response && (response.error === 'SERVER_ERROR')) {
              window.parent.FxAccountsUI.done({ success: false });
            } else {
              model.showErrorResponse(response);
            }
          });
        };
        //We just need to remove push subscription, no matter the result.
        window.parent.FMDManager.removeSubscription().then(() => {
          logout();
        },() => {
          logout();
        });
      }.bind(model),
      function onError(response) {
        NavigationMap.currentActivatedLength = 0;
        _hideLoading();
        model.showErrorResponse(response);
        _enableNext(model.fxaPwInput);
      }.bind(model)
    );
  }

  function _SignOutWithoutAntitheft(model) {
    _showLoading();
    window.parent.FxAccountsClient.logout(function () {
      _hideLoading();
      window.parent.FxAccountsUI.done({success: true});
    }, function onError(response) {
      _hideLoading();
      if (response && (response.error === 'SERVER_ERROR')) {
        window.parent.FxAccountsUI.done({ success: false });
      } else {
        model.showErrorResponse(response);
      }
    });
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    _showLoading();
    // Cache static HTML elements
    this.importElements(
      'fxa-email-input',
      'fxa-pw-input',
      'fxa-show-pw'
    );

    if (this.initialized) {
      _hideLoading();
      return;
    }
    //$('fxa-sign-out').hide();
    window.parent.SettingsListener.observe('antitheft.enabled', false,
      function observe(value) {
        window.parent.SettingsListener.unobserve('antitheft.enabled', function () { });
        if (!value) {
          _SignOutWithoutAntitheft(this);
          return;
        }
        //$('fxa-sign-out').show();
      }.bind(this));

    this.fxaEmailInput.innerHTML = options.email;
    this.fxaShowPw.addEventListener(
      'click',
      onShowPwClick.bind(this)
    );

    function onShowPwClick() {
      if (this.fxaShowPw.checked) {
        this.fxaPwInput.type = 'text';
      } else {
        this.fxaPwInput.type = 'password';
      }
    }

    // Avoid to add listener twice
    this.initialized = true;
    _hideLoading();
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
    var email = this.fxaEmailInput.innerHTML;
    _SignOutWithAntitheft(this, email, this.fxaPwInput.value);
  };

  Module.onBack = function onBack(gotoBackStepCallback) {
    FxaModuleManager.setParam('email', this.fxaEmailInput.innerHTML);
    gotoBackStepCallback(FxaModuleStates.FORGOT_PASSWORD);
  };
  Module.onDone = function onDone() {
    _hideLoading();
  };
  return Module;
} ());