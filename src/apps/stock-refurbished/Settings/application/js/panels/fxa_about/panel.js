/* global SettingsSoftkey */
/**
 * Used to show about fxa
 */

define(['require','modules/settings_panel','modules/settings_service'],function(require) {
  
  var SettingsPanel = require('modules/settings_panel');
  var SettingsService = require('modules/settings_service');

  return function fxa_about_panel() {
    let fxaAbout = document.querySelector('.fxa-about');
    let terms;
    let privacy;
    let URL_TERMS = 'https://www.kaiostech.com/terms-of-service/';
    let URL_PRIVACY = 'https://www.kaiostech.com/privacy-policy/';
    let url = 'https://www.kaiostech.com/terms-of-service/';

    function _initSoftKey() {
      let softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'decline',
          l10nId: 'decline',
          priority: 1,
          method: () => {
            showToast('agree-account-terms');
            NavigationMap.navigateBack();
          }
        }, {
          name: 'accept',
          l10nId: 'fxa-accept',
          priority: 3,
          method: () => {
            if (typeof FxAccountsIACHelper === 'undefined') {
              LazyLoader.load(['/shared/js/fxa_iac_client.js'], () => {
                FxAccountsIACHelper.createAccount((result) => {
                  // Success
                  SettingsService.navigate('fxa');
                  if (result && result.success) {
                    showToast('fxa-account-created');
                  }
                }, () => {});
              });
            } else {
              FxAccountsIACHelper.createAccount((result) => {
                // Success
                SettingsService.navigate('fxa');
                if (result && result.success) {
                  showToast('fxa-account-created');
                }
              }, () => {});
            }
          }
        }]
      };

      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    function showSelect() {
      let softkeyParams = {
        menuClassName: 'menu-button',
        header: {
          l10nId: 'message'
        },
        items: [{
          name: 'decline',
          l10nId: 'decline',
          priority: 1,
          method: () => {
            showToast('agree-account-terms');
            NavigationMap.navigateBack();
          }
        }, {
          name: 'select',
          l10nId: 'select',
          priority: 2,
          method: () => {
            window.open(url, 'popup');
          }
        }, {
          name: 'accept',
          l10nId: 'fxa-accept',
          priority: 3,
          method: () => {
            FxAccountsIACHelper.createAccount((result) => {
              // Success
              SettingsService.navigate('fxa');
              if (result && result.success) {
                showToast('fxa-account-created');
              }
            }, () => {});
          }
        }]
      };

      SettingsSoftkey.init(softkeyParams);
      SettingsSoftkey.show();
    }

    function replaceText(str, newValueObject) {
      let regexp = new RegExp('{{([A-Za-z0-9 ]*)}}', 'g');
      return str.replace(regexp, function getNewValue(matched, key) {
        let trimedKey = key.trim();
        if (!newValueObject[trimedKey]) {
          return matched;
        }
        return newValueObject[trimedKey];
      });
    };

    function init() {
      _initSoftKey();
      fxaAbout.scrollTo(0, 0);
      fxaAbout.addEventListener('keydown', keyDownHandler);
      terms = fxaAbout.querySelector('.focus-terms');
      privacy = fxaAbout.querySelector('.focus-privacy');
    }

    function setFocus(element) {
      let focused = fxaAbout.querySelectorAll('.focus');
      if (focused.length > 0) {
        focused[0].classList.remove('focus');
      } else {
        // first show
        showSelect();
      }
      if (element === terms) {
        url = URL_TERMS;
      }
      if (element === privacy) {
        url = URL_PRIVACY;
      }

      element.classList.add('focus');
    }

    function removeFocus() {
      let focused = fxaAbout.querySelectorAll('.focus');
      if (focused.length > 0) {
        focused[0].classList.remove('focus');
      }

      _initSoftKey();
    }

    function move(direction) {
      if (direction === 'ArrowDown') {
        fxaAbout.scrollBy(0, 50);
        if (isInView() && !privacy.classList.contains('focus') &&
          !terms.classList.contains('focus')) {
          setFocus(terms);
        } else if (isInView() && terms.classList.contains('focus')) {
          setFocus(privacy);
        }
      }

      if (direction === 'ArrowUp') {
        if (isInView() && terms.classList.contains('focus')) {
          removeFocus();
          fxaAbout.scrollBy(0, -50);
        } else if (isInView() && !terms.classList.contains('focus')) {
          setFocus(terms);
        } else {
          fxaAbout.scrollBy(0, -50);
        }
      }
    }

    function isInView() {
      return fxaAbout.scrollTop === fxaAbout.scrollTopMax;
    }

    function keyDownHandler(e) {
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
          e.stopPropagation();
          e.preventDefault();
          move(e.key);
          break;
      }
    }

    return SettingsPanel({
      onBeforeShow: function() {
        let accountAboutKaiosText3 = document.querySelector(
          '#about-kaios-account-text3');
        accountAboutKaiosText3.innerHTML = replaceText(
          navigator.mozL10n.get('about-kaios-account-text3-1'), {
            terms: '<span data-l10n-id="account-about-text-terms" ' +
              'class="account-about-text-link focus-terms"></span>',
            privacy: '<span data-l10n-id="account-about-text-privacy" ' +
              'class="account-about-text-link focus-privacy"></span>',
          }
        );
      },

      onBeforeHide: function() {
        fxaAbout.removeEventListener('keydown', keyDownHandler);
      },

      onShow: function() {
        init();
      },
    });
  };
});
