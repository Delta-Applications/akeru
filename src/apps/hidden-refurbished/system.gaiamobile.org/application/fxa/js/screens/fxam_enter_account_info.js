/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global FxaModuleStates, FxaModule, FxModuleServerRequest,
          FxaModuleManager, ViewManager, $, FxaModuleOverlay, NavigationMap */
/* exported FxaModuleEnterAccountInfo */

'use strict';

/**
 * This module provides birthday and gender field, and if filled,
 * determines which screen to go next.
 */

var FxaModuleEnterAccountInfo = (function () {
  var loading;
  var DEBUG = false;

  function _debug(msg) {
    if (DEBUG) {
      console.log(msg);
    }
  }

  function formatDate(d, iso) {
    var _ = navigator.mozL10n.get;
    if (d instanceof Date) {
      if (iso) {
        return d.toLocaleFormat('%Y-%m-%d');
      } else {
        var f = new navigator.mozL10n.DateTimeFormat();
        return f.localeFormat(d, _('shortDateFormat'));
      }
    } else {
      return d;
    }
  }

  function showDate () {
    var birthdayElement = $('fxa-birthday-input');
    var birthdayDateElement = $('fxa-birthday-date');
    var value = birthdayElement.value || birthdayElement.defaultValue;
    var date = new Date(value);
    var formatd = formatDate(date);
    birthdayDateElement.textContent = formatd;
  }

  function showGender() {
    var _ = navigator.mozL10n.get;
    var genderElement = $('fxa-gender-select');
    var genderTextElement = $('fxa-gender-text');
    genderTextElement.textContent = _('fxa-gender-' + genderElement.value.toLowerCase());
  }

  function initMaxDate() {
    // 3 leap days should be counted.
    var thirteenYearsInMiliSeconds = 13*365*24*60*60*1000 - 3*24*60*60*1000;
    // We honor COPPA to set max to 2005-01-01 as 13 years earlier than 2018-01-01
    var startingDate = new Date('2005-01-01');
    var now = new Date();
    var dateInMiliSec = now.getTime() - thirteenYearsInMiliSeconds;
    var maxDate = dateInMiliSec > startingDate.getTime() ? new Date(dateInMiliSec) : startingDate;

    $('fxa-birthday-input').max = formatDate(maxDate, true);
  }

  function _hasBirthday(value) {
    return value === '' ? false : true;
  }

  function _hasGender(value) {
    return value === 'Select' ? false : true;
  }

  function _enableNext() {
    var enabled = false;
    var birthdayElement = $('fxa-birthday-input');
    var genderElement = $('fxa-gender-select');
    if (_hasBirthday(birthdayElement.value) &&
        _hasGender(genderElement.value)) {
      $('fxa-enter-account-info').dataset.subid = 'next';
      enabled = true;
    } else {
      $('fxa-enter-account-info').dataset.subid = '';
    }
    showDate();
    showGender();
    // update soft key
    ViewManager.setSkMenu();
    return enabled;
  }

  function _showLoading() {
    FxaModuleOverlay.show('fxa-connecting');
    $('fxa-enter-account-info').dataset.subid = 'loading';
    ViewManager.setSkMenu();
  }

  function _hideLoading() {
    FxaModuleOverlay.hide();
    NavigationMap.currentActivatedLength = 0;
    $('fxa-enter-account-info').dataset.subid = 'next';
    ViewManager.setSkMenu();
  }

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    _debug('--> FxaModuleEnterAccountInfo(): init(): options = ' + options);
    // Cache static HTML elements
    this.importElements(
      'fxa-birthday-input',
      'fxa-gender-select'
    );

    // Update date of birth for COPPA
    initMaxDate();

    if (this.initialized) {
      // Blocks the navigation until check the condition
      _enableNext();
      return;
    }

    // Blocks the navigation until check the condition
    _enableNext();
    // Add listeners
    this.fxaBirthdayInput.addEventListener('input', _enableNext);
    this.fxaGenderSelect.addEventListener('change',_enableNext);
    // Avoid to add listener twice
    this.initialized = true;
    // Check message sent or not
    this.email = options.email;
    this.password = options.password;
  };

  Module.onNext = function onNext(gotoNextStepCallback) {
    if (loading) {
      return;
    }

    if (!_enableNext()) {
      return;
    }

    var birthday = this.fxaBirthdayInput.value;
    var gender = this.fxaGenderSelect.value;
    var info = {
      birthday: birthday,
      gender: gender
    };

    _debug('--> onNext(): info = ' + JSON.stringify(info));

    _showLoading();

    FxModuleServerRequest.signUp(
      this.email, this.password, info,
      function onServerResponse(response) {
        _debug('--> after signUp(): onServerResponse(): response = ');
        FxaModuleManager.setParam('birthday', birthday);
        FxaModuleManager.setParam('gender', gender);
        _hideLoading();
        var evt = document.createEvent('Event');
        evt.initEvent('onlogin', false, false);
        window.parent.dispatchEvent(evt);
        gotoNextStepCallback(FxaModuleStates.SIGNUP_SUCCESS);
      }.bind(this),
      function onError(response) {
        _debug('--> after signUp(): onError(): response = ');
        _hideLoading();
        FxaModuleManager.setParam('birthday', birthday);
        FxaModuleManager.setParam('gender', gender);
        this.showErrorResponse(response);
      }.bind(this)
    );
  };

  Module.onBack = function onBack() {
    _debug('--> FxaModuleEnterAccountInfo(): onBack():');
  };

  Module.onDone = function onDone() {
    _debug('--> FxaModuleEnterAccountInfo(): onDone():');
    _hideLoading();
  };

  return Module;
}());
