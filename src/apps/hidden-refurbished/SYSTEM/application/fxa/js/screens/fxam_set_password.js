/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModuleUI, FxaModuleOverlay, FxaModule, FxModuleServerRequest,
   FxaModuleManager, FxaModuleStates */
/* exported FxaModuleSetPassword */

'use strict';

/**
 * Takes care of a new user's set password screen. If password is valid,
 * attempt to stage the user.
 */
var FxaModuleSetPassword = (function() {

  var _ = null;

  function _isPasswordValid(passwordEl) {
    var passwordValue = passwordEl.value;
    return passwordValue && passwordEl.validity.valid;
  }

  function _enableNext(passwordEl) {
    if (_isPasswordValid(passwordEl))
      $('fxa-set-password').dataset.subid = 'next';
    else
      $('fxa-set-password').dataset.subid = '';
    ViewManager.setSkMenu();
  }

  function _cleanForm(passwordEl, passwordCheck) {
    passwordEl.value = '';
    passwordCheck.checked = false;
    passwordEl.setAttribute('type', 'password');
  }

  function _showRegistering() {
    FxaModuleOverlay.show('fxa-connecting');
  }

  function _hideRegistering() {
    FxaModuleOverlay.hide();
  }

  function _showUserNotCreated() {
    /*jshint validthis:true */
    this.showErrorResponse({
      error: 'CANNOT_CREATE_ACCOUNT'
    });
  }

  function _togglePasswordVisibility() {
    /*jshint validthis:true */
    var passwordFieldType = !!this.fxaShowPwSet.checked ? 'text' : 'password';
    this.fxaPwSetInput.setAttribute('type', passwordFieldType);
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {

    if (!this.initialized) {
      // l10n manager
      _ = navigator.mozL10n.get;
      // Cache DOM elements
      this.importElements(
        'fxa-pw-set-input',
        'fxa-show-pw-set',
        'fxa-hello-user'
      );
      // Add Listeners
      this.fxaPwSetInput.addEventListener(
        'input',
        function onInput(event) {
          _enableNext(event.target);
        }
      );

      this.fxaShowPwSet.addEventListener(
        'change',
        _togglePasswordVisibility.bind(this),
        false
      );
    }

    options = options || {};

    this.email = options.email;

    var helloUserText = _('fxa-hello-user');
    helloUserText = helloUserText.replace(
      /{{\s*email\s*}}/,
      '<a id="fxa-user-set-email">' + this.email + '</a>'
    );
    this.fxaHelloUser.innerHTML = helloUserText;

    _cleanForm(
      this.fxaPwSetInput,
      this.fxaShowPwSet
    );

    _enableNext(this.fxaPwSetInput);
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
    var self = this;
    self.fxaPwSetInput.disabled = true;
    _showRegistering();
    FxModuleServerRequest.signUp(
      this.email,
      this.fxaPwSetInput.value,
      function(response) {
        NavigationMap.currentActivatedLength = 0;
        self.fxaPwSetInput.disabled = false;
        self.fxaPwSetInput.focus();
        _hideRegistering();

        FxaModuleManager.setParam('success', true);

        var isAccountCreated = response.accountCreated;

        if (!isAccountCreated) {
          _showUserNotCreated.call(this);
          return;
        }

        gotoNextStepCallback(FxaModuleStates.SIGNUP_SUCCESS);
      }.bind(this),
      function(response){
        NavigationMap.currentActivatedLength = 0;
        self.showErrorResponse(response);
        self.fxaPwSetInput.disabled = false;
        self.fxaPwSetInput.focus();
      }
    );
  };

  return Module;

}());

