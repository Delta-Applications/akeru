
/* global SettingsListener */
define('panels/screen_lock_passcode/screen_lock_passcode',['require','modules/settings_service','modules/settings_utils'],function (require) {
  

  var SettingsService = require('modules/settings_service');
  var SettingsUtils = require('modules/settings_utils');
  var _self = null;

  var ScreenLockPasscode = function ctor_screenlock_passcode() {
    const PASSCODE_SIZE = 4;
    const VALIDING_TIMEOUT = 1000;
    const ERROR_STATE_TIMEOUT = 1500;
    const COLD_DOWN_INTERVAL = 1000;
    const coldDownMapping = [
      0, 0, 0, 0, 0, 0, 60, 180, 300, 600, 900
    ];

    return {
      _panel: null,

      /**
       * create  : when the user turns on passcode settings
       * edit    : when the user presses edit passcode button
       * confirm : when the user turns off passcode settings
       * new     : when the user is editing passcode
       *                and has entered old passcode successfully
       */
      _MODE: 'create',

      _settings: {
        passcode: '0000'
      },

      _checkingLength: {
        'create': 8,
        'new': 8,
        'edit': 4,
        'confirm': 4,
        'confirmLock': 4
      },

      _leftApp: false,

      _passcodeBuffer: '',

      _errorMsgTimeoutId: null,

      _origin: null,
      inputMode: '',
      error: '',
      errorTimes: 0,
      retryTimestamp: 0,
      coldDown: false,
      validing: false,
      coldDownHandle: null,

      _getAllElements: function sld_getAllElements() {
        this.passcodePanel = this._panel;
        this.passcodeDigits = this._panel.querySelectorAll('.passcode-digit');
        this.passcodeContainer =
          this._panel.querySelector('.passcode-container');
        this.passcodeError =
          this._panel.querySelector('.passcode-error');
        this.posscodeInput = document.getElementById('passcode-pseudo-input');
        this.posscodeConfirmInput =
          document.getElementById('passcode-pseudo-confirm-input');

        // Add support to RTL
        if(window.document.dir === 'rtl') {
          var temp_passcodeDigits = this.passcodeDigits;
          this.passcodeDigits = new Array();

          var backward = 4;
          for (var i = 0; i < 8; i++) {
            backward--;
            this.passcodeDigits[i] = temp_passcodeDigits[backward];

            if(backward === 0) {
              backward += 8;
            }
          }
        }
      },

      init: function sld_onInit() {
        this._getAllElements();
        // If the pseudo-input loses focus, then allow the user to restore focus
        // by touching the container around the pseudo-input.
        this.passcodeContainer.addEventListener('click', function(evt) {
          this.passcodeContainer.focus();
          evt.preventDefault();
        }.bind(this));

        this._fetchSettings();
        this.updateState = this.checkState.bind(this);
      },

      onInit: function sld_onInit(panel) {
        this._panel = panel;
        this.init();
      },

      onBeforeShow: function sld_onBeforeShow(panel, options) {
        let mode = options.mode;
        this._origin = options.origin;
        if (!this._leftApp) {
          this._showDialogInMode(mode);
        }
        this._leftApp = false;
        this._setupSKs();
        if (this._origin === '#about') {
          SettingsListener.observe('lockscreen.wrong.code.info', '',
            this.updateState);
        }
      },

      onBeforeHide: function sld_onBeforeHide() {
        if (this._origin === '#about') {
          SettingsListener.unobserve('lockscreen.wrong.code.info',
            this.updateState);
        }
      },

      onShow: function sld_onShow() {
        _self = this;
        document.addEventListener('keydown', this.handleEvent);
        this.passcodeContainer.focus();
        this._updatePassCodeUI();
      },

      onHide: function sld_onBeforeHide() {
        this._leftApp = document.hidden;

        if (!this._leftApp) {
          this._updatePassCodeUI();
        }
        document.removeEventListener('keydown', this.handleEvent);
        if (this._errorMsgTimeoutId !== null)
          window.clearTimeout(this._errorMsgTimeoutId);
      },

      _showDialogInMode: function sld_showDialogInMode(mode) {
        this._hideErrorMessage();
        this._MODE = mode;
        this.passcodePanel.dataset.mode = mode;
        this._updatePassCodeUI();
      },

      handleEvent: function sld_handleEvent(evt) {
        // key code for key strokes from the keypad are 0 (numbers) and 8
        // (backspace). Filter out the events that are not from the keypad.
        var keyCode = _translateKey(evt.key);
        if (!(keyCode >= '0' && keyCode <= '9') && keyCode != 'Backspace') {
          return;
        }

        if (_self.passcodePanel.dataset.passcodeStatus === 'success' &&
          keyCode >= '0' && keyCode <= '9') {
          return;
        }

        if (_self.coldDown) {
          return;
        }

        evt.preventDefault();
        if (_self._passcodeBuffer === '' ||
          _self._passcodeBuffer.length === 8) {
          _self._hideErrorMessage();
        }

        if (evt.key === 'BrowserBack' || evt.key == 'Backspace') {
          if (_self._passcodeBuffer.length > 0) {
            _self.inputMode = 'delete';
            _self._passcodeBuffer = _self._passcodeBuffer.substring(0,
              _self._passcodeBuffer.length - 1);
            if (_self.passcodePanel.dataset.passcodeStatus === 'success') {
              _self._resetPasscodeStatus();
            }
            _self._setupSKs();
            _self._updatePassCodeUI();
            evt.stopPropagation();
          } else if (_self._origin === '#about') {
            _self._backToAbout();
          } else {
            SettingsService.navigate('screenLock');
          }
        } else if (_self._passcodeBuffer.length < 8) {
          _self.inputMode = 'input';
          _self._passcodeBuffer += keyCode;
          _self._updatePassCodeUI();
          _self._enablePasscode();
        } else if (_self._passcodeBuffer.length === 8) {
          _self._passcodeBuffer = keyCode;
          _self._updatePassCodeUI();
          _self._setupSKs();
        }
      },

      _enablePasscode: function sld_enablePasscode() {
        var settings;
        var passcode;
        var lock;

        if (this._passcodeBuffer.length === this._checkingLength[this._MODE]) {
          switch (this._MODE) {
            case 'create':
            case 'new':
              passcode = this._passcodeBuffer.substring(0, 4);
              var passcodeToConfirm = this._passcodeBuffer.substring(4, 8);
              if (passcode != passcodeToConfirm) {
                this._showErrorMessage();
              } else {
                this._setupSKs();
                this._enableButton();
              }
              break;
            case 'confirm':
              if (this._origin === '#screenLock') {
                if (this._checkPasscode()) {
                  settings = navigator.mozSettings;
                  lock = settings.createLock();
                  lock.set({
                    'lockscreen.enabled': false,
                    'lockscreen.passcode-lock.enabled': false
                  });

                  this._backToScreenLock();
                  showToast('screen-lock-off');
                } else {
                  this._passcodeBuffer = '';
                }
              } else if (this._origin === '#about') {
                this.validatePasscode();
              }
              break;
            case 'confirmLock':
              if (this._checkPasscode()) {
                settings = navigator.mozSettings;
                lock = settings.createLock();
                lock.set({
                  'lockscreen.enabled': false,
                  'lockscreen.passcode-lock.enabled': false
                });
                this._backToScreenLock();
              } else {
                this._passcodeBuffer = '';
              }
              break;
            case 'edit':
              if (this._checkPasscode()) {
                this._passcodeBuffer = '';
                this._updatePassCodeUI();
                this._showDialogInMode('new');
              } else {
                this._passcodeBuffer = '';
              }
              break;
          }
        }
      },

      _fetchSettings: function sld_fetchSettings() {
        SettingsListener.observe('lockscreen.passcode-lock.code', '0000',
          function(passcode) {
            this._settings.passcode = passcode;
          }.bind(this));
        this.loadSettingsValue();
      },

      _showErrorMessage: function sld_showErrorMessage(autoClear) {
        this.passcodePanel.dataset.passcodeStatus = 'error';
        this.passcodeError.setAttribute('aria-live', 'assertive');
        this.passcodeError.setAttribute('data-l10n-id',
          'passcode-doesnt-match');
        let len = this.passcodeDigits.length;
        if (this._passcodeBuffer.length > 4) {
          for (let i = 4; i < len; i++) {
            this.passcodeDigits[i].classList.add('error');
          }
          this.passcodeDigits[len-1].classList.add('highlight');
        } else {
          for (let i = 0; i < 4; i++) {
            this.passcodeDigits[i].classList.add('error');
          }
        }

        if (this._errorMsgTimeoutId !== null)
          window.clearTimeout(this._errorMsgTimeoutId);
        if (autoClear) {
          this._errorMsgTimeoutId = window.setTimeout(function() {
            this._hideErrorMessage();
            this._updatePassCodeUI();
            this.posscodeConfirmInput.classList.remove('highlight');
          }.bind(this), 2000);
        }
      },

      _hideErrorMessage: function sld_hideErrorMessage() {
        this.passcodePanel.dataset.passcodeStatus = '';
        this.hideErrorHint();
        this.hideCorrectHint();
      },

      _resetPasscodeStatus: function sld_resetPasscodeStatus() {
        this.passcodePanel.dataset.passcodeStatus = '';
        this.hideCorrectHint();
      },

      _enableButton: function sld_enableButton() {
        this.passcodePanel.dataset.passcodeStatus = 'success';
        this.showCorrectHint();
      },

      _updatePassCodeUI: function sld_updatePassCodeUI() {
        let overlay = this.passcodePanel.querySelector('.passcode-container');
        overlay.classList.add('input-passcode-field');

        if (this._origin === '#about') {
          this.posscodeInput.classList.remove('highlight');
        } else {
          this.posscodeInput.classList.add('highlight');
        }

        this.posscodeConfirmInput.classList.remove('highlight');

        for (var i = 0; i < 8; i++) {
          this.passcodeDigits[i].classList.remove('highlight');
          if (i < this._passcodeBuffer.length) {

            if (i < 3) {
              if (this._origin === '#about') {
                this.posscodeInput.classList.remove('highlight');
              } else {
                this.posscodeInput.classList.add('highlight');
              }
              this.posscodeConfirmInput.classList.remove('highlight');
            } else {
              this.posscodeConfirmInput.classList.add('highlight');
              this.posscodeInput.classList.remove('highlight');
            }
            this.passcodeDigits[i].dataset.dot = true;
          } else {
            delete this.passcodeDigits[i].dataset.dot;
          }
        }

        let len = this._passcodeBuffer.length;
        if (!this.coldDown) {
          if (this.inputMode === 'input') {
            for (let i = 0; i < len; i++) {
              this.passcodeDigits[i].classList.remove('highlight');
            }
            if (len < 8) {
              this.passcodeDigits[len].classList.add('highlight');
            }
          } else {
            for (let i = len; i < 8; i++) {
              this.passcodeDigits[i].classList.remove('highlight');
            }
            if (len < 8) {
              this.passcodeDigits[len].classList.add('highlight');
            }
          }
        }

        let selectorRules = null;
        selectorRules = 'div [data-mode*=' + this._MODE + ']';
        let titleElement =
          this.passcodePanel.querySelector(selectorRules);
        titleElement.setAttribute('aria-live', 'assertive');
        if (this._origin === '#about') {
          titleElement.setAttribute('data-l10n-id',
            'enter-screen-lock-passcode');
        } else if (this._MODE === 'new' || this._MODE === 'create') {
          titleElement.setAttribute('data-l10n-id',
            'create-lock-code');
        } else {
          titleElement.setAttribute('data-l10n-id',
            'enter-lock-code');
        }

        if (!this.coldDown) {
          for (let i = 0; i < this.passcodeDigits.length; i++) {
            this.passcodeDigits[i].classList.remove('error');
          }
        }

        let confirmInput =
          this.posscodeConfirmInput.querySelector('div');
        if (confirmInput) {
          if (this.posscodeConfirmInput.classList.contains('highlight')) {
            confirmInput.setAttribute('aria-live', 'assertive');
          } else {
            confirmInput.removeAttribute('aria-live');
          }
        }
      },

      _checkPasscode: function sld_checkPasscode() {
        if (this._settings.passcode != this._passcodeBuffer) {
          this._showErrorMessage(true);
          return false;
        } else {
          this._hideErrorMessage();
          return true;
        }
      },

      _backToScreenLock: function sld_backToScreenLock() {
        this._passcodeBuffer = '';
        this.passcodeContainer.blur();
        SettingsService.navigate('screenLock');
      },

      _backToAbout: function sld_backToAbout() {
        this._passcodeBuffer = '';
        this.passcodeContainer.blur();
        SettingsService.navigate('about', {
          origin: '#screenLock-passcode'
        });
      },

      _setupSKs: function sld_setupSKs() {
        var params = {
          menuClassName: 'menu-button',
          header: {
            l10nId: 'message'
          },
          items: [{
            name: 'Cancel',
            l10nId: 'cancel',
            priority: 1,
            method: function() {
              if (_self._origin === '#screenLock') {
                _self._backToScreenLock();
              } else {
                _self._backToAbout();
              }
            }
          }]
        };
        if (this._checkingLength[this._MODE] === this._passcodeBuffer.length) {
          switch (this._MODE) {
            case 'create': {
              var item = {
                name: 'Create',
                l10nId: 'create',
                priority: 3,
                method: function () {
                  _self.setPasscode();
                  showToast('passcode-created');
                }
              };
              params.items.push(item);
            }
              break;
            case 'new': {
              var item = {
                name: 'Change',
                l10nId: 'change',
                priority: 3,
                method: function() {
                  _self.setPasscode();
                  showToast('passcode-changed');
                }
              };
              params.items.push(item);
            }
              break;
          }
        }
        SettingsSoftkey.init(params);
        SettingsSoftkey.show();
      },

      setPasscode: function sld_setPasscode() {
        if (this.passcodePanel.dataset.passcodeStatus !== 'success') {
          this._showErrorMessage();
          this.passcodeInput.focus();
          return;
        }
        var passcode = this._passcodeBuffer.substring(0, 4);
        var lock = navigator.mozSettings.createLock();
        lock.set({
          'lockscreen.passcode-lock.code': passcode
        });
        lock.set({
          'lockscreen.passcode-lock.enabled': true
        });
        lock.set({
          'lockscreen.enabled': true
        });
        this._backToScreenLock();
      },

      showRetryMsg() {
        let coldDown = this.getInvalidCodeString();
        if (this._passcodeBuffer.length) {
          this.passcodeError.classList.add('error');
        }
        this.showErrorHint();

        this.updateColdDownInfo();
        if (this.coldDown && !coldDown) {
          setTimeout(() => {
            this.coldDown = coldDown;
            this.validing = false;
            this._passcodeBuffer = '';
            this.error = '';
            this.hideRetryMsg();
          }, ERROR_STATE_TIMEOUT);
        }
      },

      hideRetryMsg() {
        this._hideErrorMessage();
        this._updatePassCodeUI();
        this.posscodeConfirmInput.classList.remove('highlight');
        this.passcodeError.classList.remove('error');
      },

      showCorrectHint() {
        for (let i = 0; i < this.passcodeDigits.length; i++) {
          this.passcodeDigits[i].classList.add('correct');
        }
      },

      showErrorHint() {
        for (let i = 0; i < this.passcodeDigits.length; i++) {
          this.passcodeDigits[i].classList.add('error');
          this.passcodeDigits[i].classList.remove('highlight');
        }
      },

      hideCorrectHint() {
        for (let i = 0; i < this.passcodeDigits.length; i++) {
          this.passcodeDigits[i].classList.remove('correct');
        }
      },

      hideErrorHint() {
        for (let i = 0; i < this.passcodeDigits.length; i++) {
          this.passcodeDigits[i].classList.remove('error');
        }
      },

      updateColdDownInfo() {
        if (!this.coldDown && this.coldDownHandle) {
          window.clearInterval(this.coldDownHandle);
          this.coldDownHandle = null;
        }
        if (this.coldDown && !this.coldDownHandle) {
          this.coldDownHandle = setInterval(() => {
            this.coldDown = this.getInvalidCodeString();
            if (!this.coldDown && this.coldDownHandle) {
              window.clearInterval(this.coldDownHandle);
              this.coldDownHandle = null;
              this._passcodeBuffer = '';
              this.validing = false;
              this.hideRetryMsg();
            } else {
              for (let i = 0; i < this.passcodeDigits.length; i++) {
                this.passcodeDigits[i].classList.add('error');
                this.passcodeDigits[i].dataset.dot = true;
              }
            }
          }, COLD_DOWN_INTERVAL);
        }
      },

      validatePasscode() {
        if (this.validing) {
          return;
        }
        if (this._passcodeBuffer === this._settings.passcode) {
          this.errorTimes = 0;
          this.retryTimestamp = 0;
          this.validing = true;
          this.showCorrectHint();

          navigator.mozSettings.createLock().set({
            'lockscreen.wrong.code.info' : {
              errorTimes: 0
            }
          });

          settings = navigator.mozSettings;
          lock = settings.createLock();
          lock.set({
            'lockscreen.enabled': false,
            'lockscreen.passcode-lock.enabled': false
          });

          setTimeout(() => {
            SettingsService.navigate('reset-phone-progress');
          }, VALIDING_TIMEOUT);
        } else if (this._passcodeBuffer.length >=
          this._settings.passcode.length
          && !this.validing) {
          let errorTimes = this.errorTimes;
          let retryTimestamp = Date.now();
          errorTimes++;
          navigator.mozSettings.createLock().set({
            'lockscreen.wrong.code.info' : {
              errorTimes,
              retryTimestamp
            }
          });
          this.errorTimes = errorTimes;
          this.retryTimestamp = retryTimestamp;
          this.validing = true;
          this.error = 'incorrect';
          this.coldDown = !!this.getColdDownTime(errorTimes);

          if (!this.getColdDownTime(errorTimes)) {
            setTimeout(() => {
              this.validing = false;
              this._passcodeBuffer = '';
              this.error = '';
              this.hideRetryMsg();
            }, ERROR_STATE_TIMEOUT);
          }
          this.showRetryMsg();
        }
      },

      resetRetryTimestamp(errorTimes) {
        const retryTimestamp = Date.now();
        const lock = navigator.mozSettings.createLock();
        lock.set({
          'lockscreen.wrong.code.info': {
            errorTimes,
            retryTimestamp
          }
        });
        if (lock.forceClose) {
          lock.forceClose();
        }

        this.checkState({
          errorTimes,
          retryTimestamp
        });
      },

      loadSettingsValue() {
        let infoLock = navigator.mozSettings.createLock();
        infoLock.get('lockscreen.wrong.code.info').then((value) => {
          const wrongInfo = value['lockscreen.wrong.code.info'];
          if (wrongInfo && wrongInfo.errorTimes) {
            this.resetRetryTimestamp(wrongInfo.errorTimes);
          }
        });
        if (infoLock.forceClose) {
          infoLock.forceClose();
        }
      },

      getColdDownTime(times) {
        let defaultErrorTimes = times ? times : this.errorTimes;
        let errorTimes =
          Math.min(coldDownMapping.length - 1, defaultErrorTimes);
        return coldDownMapping[errorTimes];
      },

      getInvalidCodeString() {
        let errorTimes = this.errorTimes;
        let error = this.error;
        let coldDown = this.coldDown;
        let retryTimestamp = this.retryTimestamp;
        let leftColdDownTime = 0;

        if (error) {
          if (coldDown) {
            const curTime = Date.now();
            if (curTime >= retryTimestamp) {
              leftColdDownTime = Math.max(0, this.getColdDownTime() -
                Math.floor((curTime - retryTimestamp) / 1000));
            }
            const timeString = new Date(2019, 9, 9, 9,
              Math.floor(leftColdDownTime / 60),
              leftColdDownTime % 60)
              .toLocaleString(navigator.language, {
                second: 'numeric',
                minute: 'numeric'
              });

            navigator.mozL10n.setAttributes(this.passcodeError,
             'lockscreenColdDown', {
                n: timeString
              });
          } else {
            switch (errorTimes) {
              case 3:
              case 4:
              case 5:
                navigator.mozL10n.setAttributes(this.passcodeError,
                 'lockscreenCheckLockCode', {
                    n: 6 - errorTimes
                  });
                break;
            default:
              navigator.mozL10n.setAttributes(this.passcodeError,
               'lockscreenInvalidCode');
                break;
            }
          }
        }
        return !!leftColdDownTime;
      },

      checkState(value) {
        let errorTimes = this.errorTimes;
        let retryTimestamp = this.retryTimestamp;
        if (value && value.errorTimes) {
          if (value.errorTimes !== errorTimes ||
            value.retryTimestamp !== retryTimestamp) {
            let coldDown = !!this.getColdDownTime(value.errorTimes);
            this.coldDown = coldDown;
            this.errorTimes = value.errorTimes;
            this.retryTimestamp = value.retryTimestamp;
            this.validing = !!coldDown;
            this.error = coldDown ? 'incorrect' : '';
            this._passcodeBuffer = coldDown ? 'lockInput' : '';
            this.showRetryMsg();
          }
        } else if (errorTimes) {
          this.errorTimes = 0;
          this.retryTimestamp = 0;
          this._passcodeBuffer = '';
          this.validing = false;
          this.error = '';
          this.coldDown = false;
          this.hideRetryMsg();
        }
      },
    };
  };

  return ScreenLockPasscode;
});

define('panels/screen_lock_passcode/panel',['require','modules/settings_panel','panels/screen_lock_passcode/screen_lock_passcode'],function(require) {
  

  var SettingsPanel = require('modules/settings_panel');
  var ScreenLockPasscode =
    require('panels/screen_lock_passcode/screen_lock_passcode');

  return function ctor_screenlockPasscode() {
    var screenLockPasscode = ScreenLockPasscode();

    return SettingsPanel({
      onInit: function(panel) {
        screenLockPasscode.onInit(panel);
      },
      onBeforeShow: function(panel, options) {
        screenLockPasscode.onBeforeShow(panel, options);
      },
      onBeforeHide: function() {
        screenLockPasscode.onBeforeHide();
      },
      onShow: function() {
        screenLockPasscode.onShow();
      },
      onHide: function() {
        screenLockPasscode.onHide();
      }
    });
  };
});
