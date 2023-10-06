/*global ActivityHandler, MozActivity, TelephonyHelper */

(function(exports) {
  'use strict';

  function handleActivity(activity, onsuccess, onerror) {
    // Note: the MozActivity is intentionally constructed in the caller and
    // passed down to this function in order to make it possible to pass an
    // inline option to its constructor in the caller for the sake of static
    // analysis tools.  Please do not change that!

    if (typeof onsuccess === 'function') {
      activity.onsuccess = onsuccess;
    }

    activity.onerror = typeof onerror === 'function' ? onerror : function(error) {
      console.warn('Unhandled error spawning activity; ' + error.message);
    };
  }

  exports.ActivityPicker = {
    dial: function ap_call(number, isDirect, isRTT) {
      function callAndback() {
        if (isDirect) {
          ThreadUI.updateCallKey();
        }
      }

      let telServiceId;

      function callDisconnectOrError() {
        ThreadUI.isCall = false;
        if (isDirect) {
          ThreadUI.updateCallKey();
        }
      }

      function startSIMCall(VTEnable) {
        ThreadUI.simSelectOptions((serviceID) => {
          telephonyCall(serviceID, VTEnable);
        });
      }

      function telephonyCall(serviceID, VTEnable) {
        ThreadUI.isCall = true;
        TelephonyHelper.call(number, serviceID, VTEnable, isRTT,
            callAndback, callAndback, callDisconnectOrError, callDisconnectOrError);
      }

      function simSelect(VTEnable) {
        if (Settings.telephonyServiceId === -1) {
          if (Settings.hasSeveralSim()) {
            if (isDirect) {
              // If there is option menu, not create it again.
              if (!document.getElementById('option-menu')) {
                ThreadUI.simSelectOptions((serviceID) => {
                  telephonyCall(serviceID, VTEnable);
                });
              } else {
                document.addEventListener('transitionend', function optionMenu() {
                  document.removeEventListener('transitionend', optionMenu);
                  ThreadUI.simSelectOptions((serviceID) => {
                    telephonyCall(serviceID, VTEnable);
                  });
                });
              }
            } else {
              if (!document.getElementById('option-menu')) {
                startSIMCall(VTEnable);
              } else {
                document.addEventListener('transitionend', function optionMenu() {
                  document.removeEventListener('transitionend', optionMenu);
                  startSIMCall(VTEnable);
                });
              }
            }
          } else {
            telServiceId = ThreadUI.selectSIMCard();
            telephonyCall(telServiceId, VTEnable);
          }
        } else {
          // If there is only one sim card slot, we use sim1 to call number.
          telServiceId = Settings.telephonyServiceId;
          if (telServiceId === null) {
            telServiceId = 0;
          }
          telephonyCall(telServiceId, VTEnable);
        }
      }

      navigator.hasFeature &&
      navigator.hasFeature('device.capability.vilte').then((hasVT) => {
        // If RTT is enabled, not call video call.
        if (isRTT) {
          hasVT = false;
        }

        if (hasVT) {
          if (isDirect) {
            ThreadUI.switchCallOption('normal-call', 'video-call', (VTEnable) => {
              simSelect(VTEnable);
            });
          } else {
            document.addEventListener('transitionend', function optionMenu() {
              document.removeEventListener('transitionend', optionMenu);
              ThreadUI.switchCallOption('normal-call', 'video-call', (VTEnable) => {
                simSelect(VTEnable);
              });
            });
          }
        } else {
          if (isDirect) {
            simSelect(false);
          } else {
            document.addEventListener('transitionend', function optionMenu() {
              document.removeEventListener('transitionend', optionMenu);
              simSelect(false);
            });
          }
        }
      });
    },
    email: function ap_email(email, onsuccess, onerror) {
      handleActivity(new MozActivity({
        name: 'new',
        data: {
          type: 'mail',
          URI: 'mailto:' + email
        }
      }), onsuccess, onerror);
    },
    url: function ap_browse(url) {
      window.open(url);
    },
    createNewContact:
     function ap_createNewContact(contactProps, onsuccess, onerror) {
      handleActivity(new MozActivity({
        name: 'new',
        data: {
          type: 'webcontacts/contact',
          caller: 'SMS',
          params: contactProps
        }
      }), onsuccess, onerror);
    },
    addToExistingContact:
     function ap_addToExistingContact(contactProps, onsuccess, onerror) {
      handleActivity(new MozActivity({
        name: 'update',
        data: {
          type: 'webcontacts/contact',
          params: contactProps
        }
      }), onsuccess, onerror);
    },
    viewContact:
     function ap_viewContact(contactProps, onsuccess, onerror) {
      handleActivity(new MozActivity({
        name: 'open',
        data: {
          type: 'webcontacts/contact',
          params: contactProps
        }
      }), onsuccess, onerror);
    },
    sendMessage: function ap_sendMessage(number, contact) {
      // Using ActivityHandler here to navigate to Composer view in the same way
      // as it's done for real activity.
      ActivityHandler.toView({
        number: number,
        contact: contact
      });
    }
  };
}(this));
