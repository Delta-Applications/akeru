/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModule, FxaModuleStates */
/* exported FxaModuleSigninSuccess */

'use strict';

/**
 * Display the signup success message to the user.
 */
var FxaMultipleSignInAttempts = (function() {

  var Module = Object.create(FxaModule);

  Module.onNext = function onNext(done) {
    done(FxaModuleStates.DONE);
  };

  return Module;

}());

