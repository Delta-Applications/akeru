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
var FxaModuleCheckPassword = (function () {
  function _showLoading() {
    FxaModuleOverlay.show('fxa-check-password');
    $('fxa-check-password').dataset.subid = 'loading';
    ViewManager.setSkMenu();
  }

  function _hideLoading() {
    $('fxa-check-password').dataset.subid = '';
    ViewManager.setSkMenu();
    FxaModuleOverlay.hide();
  }

  function _CheckPassword(model, email, password, title) {
    _showLoading();
    FxModuleServerRequest.signIn(
      email,
      password,
      function onServerResponse(response) {
        NavigationMap.currentActivatedLength = 0;
        _hideLoading();
        window.parent.asyncStorage.setItem('checkpassword.retrycount', 0);
        window.parent.asyncStorage.setItem('checkpassword.enabletime', 0);
        FxaModuleManager.setParam('title', title);
        if (!response.authenticated) {
          FxaModuleManager.setParam('result', 'unauthenticated');
          window.parent.FxAccountsUI.done(FxaModuleManager.paramsRetrieved);
          return;
        }
        FxaModuleManager.setParam('success', true);
        FxaModuleManager.setParam('result', 'success');
        window.parent.FxAccountsUI.done(FxaModuleManager.paramsRetrieved);
      }.bind(model),
      function onError(response) {
        NavigationMap.currentActivatedLength = 0;
        _hideLoading();
        model.showErrorResponse(response);
        window.parent.asyncStorage.getItem('checkpassword.retrycount', function(value) {
          var count = value || 0;
          count += 1;
          window.parent.asyncStorage.setItem('checkpassword.retrycount', count);
          if (count >= 6) {
            if (count >= 10) {
              count = 10;
            }
            var inverval = _retryInterval[count];
            var enableTime = (new Date()).getTime() + inverval;
            window.parent.asyncStorage.setItem('checkpassword.enabletime', enableTime);
          }
        });
      }.bind(model)
    );
  };

  var _retryInterval = {
    6: 1 * 60 * 1000,
    7: 5 * 60 * 1000,
    8: 15 * 60 * 1000,
    9: 60 * 60 * 1000,
    10 : 4 * 60 * 60 * 1000
  };

  var _ResourceId = {
    'DisableAntitheft': 'fxa-disable-antitheft-checkpassword-message',
    'ResetFactory': 'fxa-reset-factory-checkpassword-message-1'
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    // Cache static HTML elements
    this.importElements(
      'fxa-email-input',
      'fxa-pw-input',
      'fxa-show-pw',
      'fxa-intro'
    );

    if (this.initialized) {
      return;
    }

    this.fxaEmailInput.innerHTML = options.email;
    this.title = options.title;
    var _sourceId = _ResourceId[this.title];
    if (_sourceId) {
      this.fxaIntro.setAttribute('data-l10n-id', _sourceId);
    }
    this.fxaShowPw.addEventListener(
      'click',
      onShowPwClick.bind(this)
    );

    var placeholder = navigator.mozL10n.get('fxa-password');
    this.fxaPwInput.setAttribute('placeholder', placeholder);

    function onShowPwClick() {
      if (this.fxaShowPw.checked) {
        this.fxaPwInput.type = 'text';
      } else {
        this.fxaPwInput.type = 'password';
      }
    }

    this.initialized = true;
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
    var self = this;
    window.parent.asyncStorage.getItem('checkpassword.enabletime', function(value) {
      if (value) {
        var currentTime = (new Date()).getTime();
        if (currentTime < value) {
          gotoNextStepCallback(FxaModuleStates.MULTIPLE_SIGN_IN_ATTEMPTS);
          return;
        }
      }
      var email = self.fxaEmailInput.innerHTML;
      var password = self.fxaPwInput.value;

      // Remove push subscription if this is factory reset with
      // Antitheft enabled
      if (self.title === 'ResetFactory' &&
        window.parent.FMDManager.antitheft_enabled) {
        // We just need to remove push subscription, no matter the result.
        window.parent.FMDManager.removeSubscription().then(() => {
          _CheckPassword(self, email, password, self.title);
        },() => {
          _CheckPassword(self, email, password, self.title);
        });
      } else {
        _CheckPassword(self, email, password, self.title);
      }
    });
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
