'use strict';

/* global LazyLoader, IccHelper, ConfirmDialog, MmiManager, TelephonyCall,
          TelephonyMessages */
/* exported TelephonyHelper */

var TelephonyHelper = (function() {
  // DTMF control digit separator length (ms) as defined in GSM ETSI GSM 02.07
  const DTMF_SEPARATOR_PAUSE_DURATION = 3000;

  const CALL_TYPE_VOICE_N_VIDEO = 1;
  const CALL_TYPE_VT = 4;

  var confirmLoaded = false;

  var loadTelephonyMessages = function(callback) {
    LazyLoader.load(['/shared/js/dialer/telephony_messages.js'], callback);
  };

  var call = function t_call(number, cardIndex, isVideo, isRTT, oncall, onconnected,
                             ondisconnected, onerror) {
    var sanitizedNumber = number.replace(/(\s|-|\.|\(|\))/g, '');
    if (!isValid(sanitizedNumber)) {
      loadTelephonyMessages(function() {
        TelephonyMessages.displayMessage('BadNumber');
      });

      return;
    }

    var conn = navigator.mozMobileConnections &&
      navigator.mozMobileConnections[cardIndex];

    if (!conn || !conn.voice) {
      // No voice connection, the call won't make it
      loadTelephonyMessages(function() {
        TelephonyMessages.displayMessage('NoNetwork');
      });
      return;
    }

    startDial(cardIndex, conn, sanitizedNumber, !!isVideo, !!isRTT,
              oncall, onconnected, ondisconnected, onerror);
  };


  function getNumberAsDtmfToneGroups(number) {
    return number.split(',');
  }

  function playDtmfToneGroups(dtmfToneGroups, cardIndex) {
    var length;

    // Remove the dialed number from the beginning of the array.
    dtmfToneGroups = dtmfToneGroups.slice(1);
    length = dtmfToneGroups.length;

    // Remove the latest entries from dtmfToneGroups corresponding to ','
    //  characters not to play those pauses.
    var lastCommaIndex = length - 1;
    while (dtmfToneGroups[lastCommaIndex] === '') {
      lastCommaIndex--;
    }
    dtmfToneGroups = dtmfToneGroups.slice(0, ++lastCommaIndex);
    length = dtmfToneGroups.length;

    var promise = Promise.resolve(),
        counter = 0,
        pauses;
    // Traverse the dtmfToneGroups array.
    while (counter < length) {
      // Reset the number of pauses before each group of tones.
      pauses = 1;
      while (dtmfToneGroups[counter] === '') {
        // Add a new pause for each '' in the dtmfToneGroups array.
        pauses++;
        counter++;
      }
      // Send a new group of tones as well as the pauses to play before it.
      promise = promise.then(playDtmfToneGroup.bind(null,
        dtmfToneGroups[counter++], pauses, cardIndex));
    }
    return promise;
  }

  function playDtmfToneGroup(toneGroup, pauses, cardIndex) {
    return navigator.mozTelephony.sendTones(
      toneGroup,
      DTMF_SEPARATOR_PAUSE_DURATION * pauses,
      null /* tone duration */,
      cardIndex
    );
  }

  function startDial(cardIndex, conn, sanitizedNumber, isVideo, isRTT, oncall,
                     onconnected, ondisconnected, onerror) {
    var telephony = navigator.mozTelephony;
    if (!telephony) {
      return;
    }

    LazyLoader.load('/shared/js/icc_helper.js', function() {
      var cardState = IccHelper.cardState;
      var imsCapability = conn.imsHandler && conn.imsHandler.capability;
      var emergencyOnly = !imsCapability && conn.voice.emergencyCallsOnly;
      var hasCard = (conn.iccId !== null);
      var callPromise;
      var baseNumber = getNumberAsDtmfToneGroups(sanitizedNumber)[0];

      // Note: no need to check for cardState null. While airplane mode is on
      // cardState is null and we handle that situation in call() above.
      if (((cardState === 'unknown') || (cardState === 'illegal')) &&
           (emergencyOnly === false)) {
        if (onerror) {
          console.log('Tried to make a call with a card state of: ', cardState);
          onerror();
        }

        return;
      } else if (emergencyOnly) {
        // If the mobileConnection has a sim card we let gecko take the
        // default service, otherwise we force the first slot.
        cardIndex = hasCard ? undefined : 0;
        callPromise = telephony.dialEmergency(baseNumber, isRTT);
      } else if (isVideo) {
        callPromise = telephony.dial(baseNumber, CALL_TYPE_VT, isRTT, cardIndex);
      } else {
        callPromise = telephony.dial(baseNumber, CALL_TYPE_VOICE_N_VIDEO,
                                     isRTT, cardIndex);
      }

      callPromise.then(function(obj) {
        if (obj instanceof TelephonyCall) {
          installHandlers(obj, sanitizedNumber, emergencyOnly, cardIndex,
                          oncall, onconnected, ondisconnected, onerror);
        } else {
          /* This is an MMICall object, manually invoke the handlers to provide
           * feedback to the user, the rest of the UX will be dealt with by the
           * MMI manager. */
          oncall();
          onconnected();
          MmiManager.handleDialing(conn, sanitizedNumber, obj.result);
        }
      }).catch(function(errorName) {
        try {
          if (onerror) {
            onerror();
          }
        } catch (err) {
            console.log(err);
        }

        loadTelephonyMessages(function() {
          var messageType = emergencyOnly ? TelephonyMessages.NO_NETWORK :
                                            TelephonyMessages.REGULAR_CALL;
          TelephonyMessages.handleError(
            errorName, sanitizedNumber, messageType);
        });
      });
    });
  }

  function installHandlers(call, number, emergencyOnly, cardIndex,
                           oncall, onconnected, ondisconnected, onerror) {
    if (oncall) {
      oncall();
    }
    var dtmfToneGroups = getNumberAsDtmfToneGroups(number);
    if (dtmfToneGroups.length > 1) {
      call.addEventListener('connected', function dtmfToneGroupPlayer() {
        call.removeEventListener('connected', dtmfToneGroupPlayer);
        playDtmfToneGroups(dtmfToneGroups, cardIndex);
      });
    }
    call.addEventListener('connected', onconnected);
    call.ondisconnected = ondisconnected;
  }

  var isValid = function t_isValid(sanitizedNumber) {
    var validExp = /^(?!,)([0-9#+*,]){1,50}$/;
    return validExp.test(sanitizedNumber);
  };

  var loadConfirm = function t_loadConfirm(cb) {
    if (confirmLoaded) {
      cb();
      return;
    }

    var confMsg = document.getElementById('confirmation-message');

    LazyLoader.load(['/shared/js/confirm.js', confMsg], function() {
      confirmLoaded = true;
      cb();
    });
  };

  var getInUseSim = function t_getInUseSim() {
    var telephony = navigator.mozTelephony;
    if (telephony) {
      var isInCall = !!telephony.calls.length;
      var isInConference = !!telephony.conferenceGroup &&
                          !!telephony.conferenceGroup.calls.length;

      if (isInCall || isInConference) {
        return isInCall ?
          navigator.mozTelephony.calls[0].serviceId :
          navigator.mozTelephony.conferenceGroup.calls[0].serviceId;
      }
    }

    return null;
  };

  window.TelephonyHelper = TelephonyHelper;

  return {
    call: call,
    getInUseSim: getInUseSim
  };

})();
