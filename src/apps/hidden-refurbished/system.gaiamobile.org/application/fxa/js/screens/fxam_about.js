/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModuleStates, FxaModuleUI, FxaModule, FxaModuleNavigation,
   FxModuleServerRequest, FxaModuleOverlay, FxaModuleManager, BrowserFrame */
/* exported FxaModuleSigning */

'use strict';

/**
 * This module checks the validity of an email address, and if valid,
 * determines which screen to go next.
 */

var FxaModuleAbout = (function() {
  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    window.focus();
    ViewManager.setSkMenu();
    if (this.initialized) return;
    this.initialized = true;
  };
  Module.onNext = function onNext(gotoNextStepCallback) {
    NavigationMap.currentActivatedLength = 0;
    var self = this;
    gotoNextStepCallback(FxaModuleStates.ENTER_EMAIL);
  };
  Module.onBack = function onBack() {
    NavigationMap.currentActivatedLength = 0;
    FxaModuleUI.enableNextButton();
  };
  return Module;
}());
