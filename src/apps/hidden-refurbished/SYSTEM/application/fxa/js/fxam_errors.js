/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';
/* global BrowserFrame */

(function (exports) {
  var Errors = {
    CONNECTION_ERROR: {
      title: 'fxa-connection-error-title',
      message: 'fxa-connection-error-message'
    },
    RESET_PASSWORD_ERROR: {
      title: 'fxa-reset-password-error-title',
      message: 'fxa-reset-password-error-message'
    },
    INVALID_EMAIL: {
      title: 'fxa-invalid-email-title',
      message: 'fxa-invalid-email-message'
    },
    INVALID_PASSWORD: {
      title: 'fxa-invalid-password-title',
      message: 'fxa-invalid-password-message-1'
    },
    PASSWORD_DONT_MATCH: {
      title: 'fxa-password-dont-match',
      message: 'fxa-password-dont-match-message'
    },
    ACCOUNT_DOES_NOT_EXIST: {
      title: 'fxa-account-does-not-exist',
      message: 'fxa-account-does-not-exist-message-1'
    },
    ACCOUNT_NOT_FOUND: {
      title: 'fxa-account-does-not-exist',
      message: 'fxa-account-not-found'
    },
    OFFLINE: {
      title: 'fxa-offline-error-title',
      message: 'fxa-offline-error-message-1'
    },
    UNKNOWN: {
      title: 'fxa-unknown-error-title',
      message: 'fxa-unknown-error-message'
    },
    EMAIL_IS_TAKEN: {
      title: 'fxa-email-is-taken-title',
      message: 'fxa-email-is-taken-message'
    },
    CONFIRM_AGE: {
      title: 'fxa-confirm-age-title',
      message: 'fxa-confirm-age-message'
    },
    SIGNOUT_EORROR : {
      title: 'fxa-sign-out-error-title',
      message: 'fxa-sign-out-error-message-1'
    },
    CONNECTION_IS_REQUIRED : {
      title: 'fxa-connection-is-required-title',
      message: 'fxa-offline-error-message-1'
    },
    PASSWORD_LESS : {
      title: 'fxa-password-less',
      message: 'fxa-password-less-message-1'
    },
    PASSWORD_MORE : {
      title: 'fxa-password-more',
      message: 'fxa-password-more-message-1'
    },
    PASSWORD_ERROR : {
      title: 'fxa-password-error',
      message: 'fxa-password-error-message'
    },
    SERVER_ERROR : {
      title: 'fxa-server-error-2',
      message: 'fxa-server-error-message-2'
    }
  };

  function _getError(error) {
    var l10nKeys = Errors[error] || Errors.UNKNOWN;
    return {
      title: l10nKeys.title,
      message: l10nKeys.message
    };
  }

  var FxaModuleErrors = {
    responseToParams: function fxame_responseToParams(response) {
      return response && response.error ?
        _getError(response.error) : _getError('GENERIC_ERROR');
    }
  };
  exports.FxaModuleErrors = FxaModuleErrors;
}(window));
