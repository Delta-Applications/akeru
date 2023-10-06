'use strict';

var FxaModuleAboutKaiOSAccount = (function () {
  var _ = null;

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    _ = navigator.mozL10n.get;
  
    if (this.initialized) {
      return;
    }

    // Avoid to add listener twice
    this.initialized = true;
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
  };

  Module.onBack = function onBack() {
    FxaModuleUI.enableNextButton();
  };

  return Module;
}());