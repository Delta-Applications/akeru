define(['require','shared/toaster','modules/settings_panel','panels/about_feedback/slider_handler','modules/settings_service','check-crypto-sha1'],function(require) {
  
  var Toaster = require('shared/toaster');
  var SettingsPanel = require('modules/settings_panel');
  var SliderHandler = require('panels/about_feedback/slider_handler');
  var SettingsService = require('modules/settings_service');
  var checkCrypto = require('check-crypto-sha1');
  var brightness = new SliderHandler();
  let states = {
    completemsg: 'feedback-complete-msg',
    timeout: 'feedback-errormessage-timeout',
    wrongemail: 'feedback-errormessage-wrong-email',
    serveroff: 'feedback-errormessage-server-off',
    emptycomment: 'feedback-errormessage-empty-comment',
    connecterror: 'feedback-errormessage-connect-error',
    datawifioff: 'feedback-errormessage-data-wifi-off',
    noscore: 'feedback-noscore'
  };
  var param = {};
  var version = '1.1';
  var isScoreChanged = false;
  return function ctor_fadeback() {
    var elements = {};
    function _initSoftKey() {
      var softkeyParams = {
          menuClassName: 'menu-button',
          header: {
            l10nId: 'message'
          },
          items: [{
            name: 'Send',
            l10nId: 'send',
            priority: 1,
            method: function() {
              _send();
            }
          }]
      };
      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }
    function _initOptionalParam(){
      let imeis;
      let promises = [...navigator.mozMobileConnections].map((conn, simSlotIndex) => {
        return conn.getDeviceIdentities().then((deviceInfo) => {
          if (deviceInfo.imei) {
            return deviceInfo.imei;
          } else {
            let errorMsg = `Could not retrieve the ${type.toUpperCase()} code for SIM ${simSlotIndex}`;
            console.error(errorMsg);
            return Promise.reject(new Error(errorMsg));
          }
        }).catch(function(reason) {});
      });
      Promise.all(promises).then((items) => {
        imeis = items;
      });

      let request = navigator.mozSettings.createLock().get('*');
      request.onsuccess = function(e) {
        let result = request.result;
        let mcc = result['operatorvariant.mcc'][0];
        if (mcc === '000') {
          mcc = result['operatorvariant.mcc'][1];
        }
        let mnc = result['operatorvariant.mnc'][0];
        if (mnc === '00') {
          mnc = result['operatorvariant.mnc'][1];
        }
        let fih_ver = navigator.engmodeExtension.getPropertyValue('ro.build.version.fih');
        param = {
          device: result['deviceinfo.product_device'],
          releaseVersion: fih_ver,
          surveyLanguage: result['language.current'],
          sw: result['deviceinfo.software'],
          country: mcc, 
          operator: mnc,
          imei: imeis[0]
        }
      };
    }
    function _send() {
      if (!elements.email.checkValidity()) {
        _toaster('wrongemail');
        return;
      }
      if (!isScoreChanged) {
        _toaster('noscore');
        return;
      }

      elements.feedback.hidden = true;
      elements.sending.hidden = false;
      var softkey = {
        items: [{
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          method: function() {
            SettingsService.navigate('about');
          }
        }]
      };
      SettingsSoftkey.init(softkey);
      SettingsSoftkey.show();
      let error = setTimeout(function() {
        _sendHint('timeout');
      }, 60000);
      var date = new Date();
      var now = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
      let href = `https://nps.hmdglobal.com?projectId=100000012&sourceId=2afb76a9ece1a035ec1b699c5a40797d&score=${elements.score.value}&source=Settings&feedback=${encodeURIComponent(elements.description.value)}&email=${elements.email.value}&dateEntered=${now}&device=${param.device}&releaseVersion=${param.releaseVersion}&surveyLanguage=${param.surveyLanguage}&sw=${param.sw}&country=${param.country}&operator=${param.operator}&imei=${hex_sha1(param.imei)}&version=${version}`;
      console.log(`FeedBack:URL: ${href}`);
      get(href, function(value) {
        clearTimeout(error);
        console.log('FeedBack:callBack:success');
        console.log(new XMLSerializer().serializeToString(value));
        var code = value.querySelector('code').textContent;
        if (code == '101' || code == '103') {
            _toaster('completemsg');
            SettingsService.navigate('about');
        } else {
          _sendHint('serveroff');
        }
      }, function(value) {
        clearTimeout(error);
        _sendHint('connecterror');
        console.log('FeedBack:callBack:error');
        console.log(new XMLSerializer().serializeToString(value));
      });
    }
    
    function _toaster(state){
      Toaster.showToast({
        messageL10nId: states[state],
        latency: 3000,
        useTransition: true
      });
    }

    function _sendHint(state){
      elements.gaiaProgress.classList.add('hidden');
      elements.feedbackHint.setAttribute('data-l10n-id', states[state]);
    }

    function _initPlaceholder(){
      elements.description.setAttribute('placeholder', navigator.mozL10n.get('feedback-description-placeholder'));
      elements.email.setAttribute('placeholder', navigator.mozL10n.get('feedback-email-placeholder'));
    }

    function _onchange() {
      if (elements.emailEnable.checked) {
        elements.emailbar.removeAttribute('hidden');
      } else {
        elements.emailbar.setAttribute("hidden","true");
      }
      
      NavigationMap.reset(document.querySelector('.focus'));
    }
    function _dataInit() {
      elements.sending.hidden = true;
      elements.feedback.hidden = false;
      elements.score.value = 8;
      elements.scoreNum.textContent = 8;
      elements.description.value = null;
      elements.email.value = null;
      elements.gaiaProgress.classList.remove('hidden');
      elements.feedbackHint.setAttribute('data-l10n-id', 'feedback-sending');
      elements.scoreHint.classList.add('non-focus');
      elements.feedback.classList.add('noScore');
      isScoreChanged = false;
    }
    function get(url, onsuccess, onerror) {
      var self = this;
      var xhr = new XMLHttpRequest({
        mozSystem: true
      });
      xhr.open('GET', url, true);
      xhr.timeout = this.XHR_TIMEOUT_MS;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.withCredentials = true;
      xhr.responseType = '';
      xhr.onload = function fmdr_xhr_onload() {
        if (xhr.status < 300) {
          if (xhr.responseText === '{No Message}') {
            return;
          }
          onsuccess && onsuccess(xhr.responseXML);
        } else if (xhr.status !== 200) {
          onerror && onerror(xhr);
        }
      };
      xhr.onerror = function fmd_xhr_onerror() {
        onerror && onerror(xhr);
      };
      xhr.send(null);

      // Modified for NPS by yingsen.zhang@t2mobile.com 20180615 begin
      console.log('NPS Settings send nps, update nps alarm timer invalid');
      navigator.mozSettings.createLock().set({'nps.settings.invalid': true});
      console.log('NPS Settings send nps, update nps feedback in progress false');
      navigator.mozSettings.createLock().set({'nps.feedback.in_progress': false});
      // Modified for NPS by yingsen.zhang@t2mobile.com 20180615 end
    }

    function _handleKeyDown(e){
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
          if(document.querySelector('.focus').classList.contains('slider-score')){
            isScoreChanged = true;
            elements.feedback.classList.remove('noScore');
            elements.scoreHint.classList.remove('non-focus');
            NavigationMap.reset(document.querySelector('.focus'));
          }
          break;
        case 'ArrowDown':
        case 'ArrowUp':
          if (!isScoreChanged && document.querySelector('.focus').classList.contains('slider-score')) {
            e.stopPropagation();
            e.preventDefault();
          }
          break;
      }
    }

    // Modified for NPS by yingsen.zhang@t2mobile.com 20180615 begin

    return SettingsPanel({
      onInit: function(panel) {
        let request = navigator.mozSettings.createLock().get('nps.settings.invalid');
        request.onsuccess = function() {
            let isInValid = request.result['nps.settings.invalid'];
            if(!isInValid){
                navigator.mozSettings.createLock().set({'nps.settings.invalid': true});
                navigator.mozSettings.createLock().set({'nps.alarm.wait_for_trigger': false});
            }
            console.log('checkAndTriggerIfNeed,isInValid=======================' + isInValid);
        };

        brightnessContainer = panel.querySelector('.slider-container');
        brightness.init(brightnessContainer);
        panel.addEventListener('keydown', _handleKeyDown);
        elements = {
          scoreHint: panel.querySelector('.score-hint'),
          score: panel.querySelector('input[name=score]'),
          scoreNum: panel.querySelector('.score .before'),
          description: panel.querySelector('textarea[name=description]'),
          email: panel.querySelector('input[name=email]'),
          emailEnable: panel.querySelector('input[name=email-enable]'),
          emailbar: panel.querySelector('#feedback-emailbar'),
          sending: panel.querySelector('.feedback-sending'),
          feedback: panel.querySelector('.feedback'),
          gaiaProgress: panel.querySelector('gaia-progress'),
          feedbackHint: panel.querySelector('.feedback-hint')
        };
        elements.description.parentNode.onfocus = function() {
          elements.description.focus();
        };
        elements.email.parentNode.onfocus = function() {
          elements.email.focus();
        };
        elements.emailEnable.onchange = function(){
          _onchange();
        };
      },
      onBeforeShow: function() {
        brightness._setSliderValue(elements.scoreNum.textContent);
        _initSoftKey();
        _initPlaceholder();
      },
      onShow: function() {
        _onchange();
        _initOptionalParam();
      },
      onBeforeHide: function() {
        SettingsSoftkey.hide();
        _dataInit();
        NavigationMap.reset();
      }
    });
  };
});
