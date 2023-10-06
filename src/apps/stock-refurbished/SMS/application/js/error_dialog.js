/*global Dialog, Settings*/

/* exported ErrorDialog */

(function(exports) {
  'use strict';
  /*
   Error confirm screen. Handling all the message error code and corresponding
   description/behavior.

   Options object can contain the following properties:
     * recipients: ['foo', 'bar'] - to show the recipient information, used only
       if errorDescription.showRecipient is equal to "true";
     * confirmHandler: function() - to be executed if user selects confirm
       action in the error dialog, used only if errorDescription.executeHandler
       is equal to "true".
   }
  */
  function ErrorDialog(errorDescription, options) {
    let prefix = errorDescription.prefix;
    let isSwitchSimData = false;

    if (!prefix) {
      throw new Error('Prefix is required!');
    }

    let dialogOptions = {
      cancel: {
        text: prefix + 'BtnOk'
      }
    };

    if (options && options.confirmHandler && errorDescription.executeHandler) {
      dialogOptions.confirm = {
        text: prefix + 'Confirm',
        method: options.confirmHandler
      };
    }

    let bodyL10nId = prefix + 'Body';
    let body = null;
    let messageBodyParams = null;

    if (errorDescription.showRecipient) {
      messageBodyParams = {
        n: options.recipients.length
      };

      body = {
        id: bodyL10nId,
        args: messageBodyParams
      };
    } else if (errorDescription.showDsdsStatus) {
      // Use the data serviceId to define which data MMS will use.
      let mmsServiceId = Settings.dataServiceId;
      if (mmsServiceId !== null) {
        // mmsServiceId = 0 => default Service is SIM 1
        // mmsServiceId = 1 => default Service is SIM 2
        switch (mmsServiceId) {
          case 0:
            messageBodyParams = {
              activeSimId: '1',
              nonActiveSimId: '2'
            };
            break;
          case 1:
            messageBodyParams = {
              activeSimId: '2',
              nonActiveSimId: '1'
            };
            break;
          default:
            console.error(
              'MMS ServiceId(' + mmsServiceId + ') is not matched!'
            );
        }
      } else {
        console.error('Settings unavailable');
      }

      body = {
        id: bodyL10nId,
        args: messageBodyParams
      };
    }

    let desc = {
      id: prefix + 'Desc'
    };

    if (!navigator.mozL10n.get(desc.id)) {
      desc = null;
    }
    if (prefix === 'switchSIMDataReceiveAlert' || prefix === 'switchSIMDataSendAlert') {
      isSwitchSimData = true;
    }

    Dialog.call(this, {
      title: prefix + 'Title',
      body: body || bodyL10nId,
      desc: desc,
      options: dialogOptions,
      switchSimData: isSwitchSimData,
      classes: ['error-dialog-' + prefix, 'error-dialog']
    });
  }

  ErrorDialog.prototype = Object.create(Dialog.prototype);

  exports.ErrorDialog = ErrorDialog;
}(this));
