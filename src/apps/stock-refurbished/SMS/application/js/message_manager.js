/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */


/* global EventDispatcher,
    Promise,
    Settings,
    SMIL,
    Threads,
    Utils
*/

/*exported MessageManager */

(function(exports) {
  'use strict';

  let MessageManager = {
    init: function mm_init() {
      this._mozMobileMessage = navigator.mozMobileMessage;

      this._mozMobileMessage.addEventListener(
        'received', this.onMessageReceived.bind(this)
      );
      this._mozMobileMessage.addEventListener(
        'sending', this.onMessageSending.bind(this)
      );
      this._mozMobileMessage.addEventListener(
        'sent', this.onMessageSent.bind(this)
      );
      this._mozMobileMessage.addEventListener(
        'failed', this.onMessageFailed.bind(this)
      );
      this._mozMobileMessage.addEventListener(
        'readsuccess', this.onReadSuccess.bind(this)
      );
      this._mozMobileMessage.addEventListener(
        'deliverysuccess', this.onDeliverySuccess.bind(this)
      );
      this._mozMobileMessage.addEventListener(
        'deleted', this.onDeleted.bind(this)
      );
    },

    onMessageSending: function mm_onMessageSending(e) {
      Threads.registerMessage(e.message);
      this.emit('message-sending', { message: e.message });
    },

    onMessageFailed: function mm_onMessageFailed(e) {
      this.emit('message-failed-to-send', { message: e.message });
    },

    onDeliverySuccess: function mm_onDeliverySuccess(e) {
      this.emit('message-delivered', { message: e.message });
    },

    onReadSuccess: function mm_onReadSuccess(e) {
      this.emit('message-read', { message: e.message });
    },

    onMessageSent: function mm_onMessageSent(e) {
      console.log('message log :: message has been sent successfully');
      if (Navigation.isCurrentPanel('thread-list')) {
        if (ThreadListUI.messagesSent) {
          this.emit('message-list-sent');
        } else if (ActivityHandler.isCustomMessage) {
          this.emit('custom-message', { message: e.message });
        }
      } else {
        if (ActivityHandler.isCustomMessage) {
          this.emit('custom-message', { message: e.message });
        } else {
          this.emit('message-sent', { message: e.message });
        }
      }
    },

    onMessageReceived: function mm_onMessageReceived(e) {
      let message = e.message;

      if (message.messageClass && message.messageClass === 'class-0') {
        return;
      }

      Threads.registerMessage(message);

      this.emit('message-received', { message: message });
    },

    onDeleted: function(e) {
      if (e.deletedThreadIds && e.deletedThreadIds.length) {
        if (e.deletedMessageIds && e.deletedMessageIds.length) {
          this.emit('threads-download', {
            ids: e.deletedThreadIds
          });
        } else {
          this.emit('threads-deleted', {
            ids: e.deletedThreadIds
          });
        }
      }
    },

    getThreads: function mm_getThreads(options) {
      /*
      options {
        each: callback function invoked for each message
        end: callback function invoked when cursor is "done"
        done: callback function invoked when we stopped iterating, either because
              it's the end or because it was stopped. It's invoked after the "end"
              callback.
      }
      */

      let each = options.each;
      let end = options.end;
      let done = options.done;
      let cursor = null;

      // WORKAROUND for bug 958738. We can remove 'try\catch' block once this bug
      // is resolved
      try {
        cursor = this._mozMobileMessage.getThreads();
      } catch(e) {
        console.error('Error occurred while retrieving threads: ' + e.name);
        end && end();
        done && done();

        return;
      }

      cursor.onsuccess = function onsuccess() {
        if (this.result) {
          each && each(this.result);

          this.continue();
          return;
        }

        end && end();
        done && done();
      };

      cursor.onerror = function onerror() {
        console.error('Reading the database. Error: ' + this.error.name);
        done && done();
      };
    },

    getMessage: function mm_getMsg(id) {
      return this._mozMobileMessage.getMessage(id);
    },

    retrieveMMS: function mm_retrieveMMS(id) {
      return this._mozMobileMessage.retrieveMMS(id);
    },

    getLastMessage: function mm_getLastMessage(threadId, callback) {
      let cursor = this._mozMobileMessage.getMessages({ threadId: +threadId }, true);
      cursor.onsuccess = function onsuccess() {
        callback(this.result);
      };
      cursor.onerror = function onerror() {
        callback(null);
      };
    },

    getMessages: function mm_getMgs(options) {
      /*
      options {
        each: callback function invoked for each message
        end: callback function invoked when cursor is "done"
        endArgs: specify arguments for the "end" callback
        done: callback function invoked when we stopped iterating, either because
              it's the end or because it was stopped. It's invoked after the "end"
              callback.
        filter: a MobileMessageFilter or similar object
        invert: option to invert the selection
      }
      */
      let each = options.each;
      let invert = options.invert;
      let end = options.end;
      let endArgs = options.endArgs;
      let done = options.done;
      let filter = options.filter;
      let chunkSize = options.chunkSize;
      let index = 0;
      let isContinue = true;
      let cursor = this._mozMobileMessage.getMessages(filter, !invert);
      const removeTextContent = () => {
        document.removeEventListener('stop-getMessages', removeTextContent);
        isContinue = false;
      }

      cursor.onsuccess = function onsuccess() {
        document.addEventListener('stop-getMessages', removeTextContent);
        index++;
        if (!this.done && isContinue) {
          let shouldContinue = true;
          if (each) {
            shouldContinue = each(this.result);
          }
          // if each returns false the iteration stops
          if (shouldContinue !== false) { // if this is undefined this is fine
            if (index <= chunkSize) {
              this.continue();
            } else {
              // set delay for performance
              setTimeout(() => {
                this.continue();
              }, 300);
            }
          } else {
            done && done();
          }
        } else {
          end && end(endArgs);
          done && done();
        }
      };
      cursor.onerror = function onerror() {
        let msg = 'Reading the database. Error: ' + this.error.name;
        console.log(msg);
        done && done();
      };
    },

    // 0 is a valid value so we need to take care to not consider it as a falsy
    // value. We want to return null for anything that's not a number or a string
    // containing a number.
    _sanitizeServiceId: function mm_sanitizeServiceId(serviceId) {
      if (serviceId === null || // null or undefined
          isNaN(+serviceId)) {
        serviceId = null;
      } else {
        serviceId = +serviceId;
      }

      return serviceId;
    },

    _getSendOptionsFromServiceId: function mm_gSOFSI(serviceId) {
      let sendOpts;

      // for DSDS, we need set the serviceId,
      // for single card device, the serviceId is set to 0 at gecko.
      if (serviceId !== null && // not null, not undefined
          Settings.isDualSimDevice()) {
        sendOpts = { serviceId: serviceId };
      }

      return sendOpts;
    },

  /* << [BTS-410]: BDC kanxj 20190318 porting to support Full/reduce character in SMS */
  shift2Normal: function mm_shift2Normal(content) {
    /* << [BTS-1676]: BDC kanxj 20190525 modfy for Reduced SMS encoding does not work */
    var shiftTable = new Map([
      [ 0x60, 0x27], // "`" => "'"
      [ 0xc0, 0x41], // "ид" => "A"
      [ 0xc1, 0x41], // "ив" => "A"
      [ 0xc2, 0x41], // "?" => "A"
      [ 0xc3, 0x41], // "?" => "A"
      [ 0xc8, 0x45], // "ии" => "E"
      [ 0xca, 0x45], // "и║" => "E"
      [ 0xcb, 0x45], // "?" => "E"
      [ 0xcc, 0x49], // "им" => "I"
      [ 0xcd, 0x49], // "ик" => "I"
      [ 0xce, 0x49], // "?" => "I"
      [ 0xcf, 0x49], // "?" => "I"
      [ 0xd1, 0x4e], // "?" => "N"
      [ 0xd2, 0x4f], // "и░" => "O"
      [ 0xd3, 0x4f], // "ио" => "O"
      [ 0xd4, 0x4f], // "?" => "O"
      [ 0xd5, 0x4f], // "?" => "O"
      [ 0xd9, 0x55], // "и┤" => "U"
      [ 0xda, 0x55], // "и▓" => "U"
      [ 0xdb, 0x55], // "?" => "U"
      [ 0xe1, 0x61], // "ив" => "a"
      [ 0xe2, 0x61], // "a" => "a"
      [ 0xe3, 0x61], // "?" => "a"
      [ 0xe7, 0x63], // "?" => "c"
      [ 0xea, 0x65], // "и║" => "e"
      [ 0xeb, 0x65], // "?" => "e"
      [ 0xed, 0x69], // "ик" => "i"
      [ 0xee, 0x69], // "?" => "i"
      [ 0xef, 0x69], // "?" => "i"
      [ 0xf3, 0x6f], // "ио" => "o"
      [ 0xf4, 0x6f], // "?" => "o"
      [ 0xf5, 0x6f], // "?" => "o"
      [ 0xfa, 0x75], // "и▓" => "u"
      [ 0xfb, 0x75], // "?" => "u"
      [ 0xfe, 0x74], // "t" => "t"
      [ 0x100, 0x41], // "0x100" => "A"
      [ 0x101, 0x61], // "0x101" => "a"
      [ 0x102, 0x41], // "0x102" => "A"
      [ 0x103, 0x61], // "0x103" => "a"
      [ 0x104, 0x41], // "0x104" => "A"
      [ 0x105, 0x61], // "0x105" => "a"
      [ 0x106, 0x43], // "0x106" => "C"
      [ 0x107, 0x63], // "0x107" => "c"
      [ 0x108, 0x43], // "0x108" => "C"
      [ 0x109, 0x63], // "0x109" => "c"
      [ 0x10a, 0x43], // "0x10a" => "C"
      [ 0x10b, 0x63], // "0x10b" => "c"
      [ 0x10c, 0x43], // "0x10c" => "C"
      [ 0x10d, 0x63], // "0x10d" => "c"
      [ 0x10f, 0x64], // "0x10f" => "d"
      [ 0x110, 0x44], // "0x110" => "D"
      [ 0x111, 0x64], // "0x111" => "d"
      [ 0x112, 0x45], // "0x112" => "E"
      [ 0x113, 0x65], // "0x113" => "e"
      [ 0x116, 0x45], // "0x116" => "E"
      [ 0x117, 0x65], // "0x117" => "e"
      [ 0x118, 0x45], // "0x118" => "E"
      [ 0x119, 0x65], // "0x119" => "e"
      [ 0x11a, 0x45], // "0x11a" => "E"
      [ 0x11b, 0x65], // "0x11b" => "e"
      [ 0x11c, 0x47], // "0x11c" => "G"
      [ 0x11d, 0x67], // "0x11d" => "g"
      [ 0x11e, 0x47], // "0x11e" => "G"
      [ 0x11f, 0x67], // "0x11f" => "g"
      [ 0x120, 0x47], // "0x120" => "G"
      [ 0x121, 0x67], // "0x121" => "g"
      [ 0x122, 0x47], // "0x122" => "G"
      [ 0x123, 0x67], // "0x123" => "g"
      [ 0x124, 0x48], // "0x124" => "H"
      [ 0x125, 0x68], // "0x125" => "h"
      [ 0x126, 0x48], // "0x126" => "H"
      [ 0x127, 0x68], // "0x127" => "h"
      [ 0x128, 0x49], // "0x128" => "I"
      [ 0x129, 0x69], // "0x129" => "i"
      [ 0x12a, 0x49], // "0x12a" => "I"
      [ 0x12b, 0x69], // "0x12b" => "i"
      [ 0x12c, 0x49], // "0x12a" => "I"
      [ 0x12d, 0x69], // "0x12b" => "i"
      [ 0x12e, 0x49], // "0x12e" => "I"
      [ 0x12f, 0x69], // "0x12f" => "i"
      [ 0x130, 0x49], // "0x130" => "I"
      [ 0x131, 0x69], // "0x131" => "i"
      [ 0x134, 0x4a], // "0x134" => "J"
      [ 0x135, 0x6a], // "0x135" => "j"
      [ 0x136, 0x4b], // "0x136" => "K"
      [ 0x137, 0x6b], // "0x137" => "k"
      [ 0x138, 0x6b], // "0x138" => "k"
      [ 0x139, 0x4c], // "0x139" => "k"
      [ 0x13a, 0x49], // "0x13a" => "I"
      [ 0x13b, 0x4c], // "0x13b" => "L"
      [ 0x13c, 0x6c], // "0x13c" => "l"
      [ 0x13d, 0x4c], // "0x13d" => "L"
      [ 0x13e, 0x49], // "0x13e" => "I"
      [ 0x13f, 0x4c], // "0x13f" => "L"
      [ 0x140, 0x49], // "0x140" => "I"
      [ 0x141, 0x4c], // "0x141" => "L"
      [ 0x142, 0x6c], // "0x142" => "l"
      [ 0x143, 0x4e], // "0x143" => "N"
      [ 0x144, 0x6e], // "0x144" => "n"
      [ 0x145, 0x4e], // "0x145" => "N"
      [ 0x146, 0x6e], // "0x146" => "n"
      [ 0x147, 0x4e], // "0x147" => "N"
      [ 0x148, 0x6e], // "0x148" => "n"
      [ 0x14c, 0x4f], // "0x14c" => "O"
      [ 0x14d, 0x6f], // "0x14d" => "o"
      [ 0x14e, 0x4f], // "0x14e" => "O"
      [ 0x14f, 0x6f], // "0x14f" => "o"
      [ 0x150, 0x4f], // "0x150" => "O"
      [ 0x151, 0x6f], // "0x151" => "o"
      [ 0x152, 0x4f], // "0x152" => "O"
      [ 0x153, 0x6f], // "0x153" => "o"
      [ 0x156, 0x52], // "0x156" => "R"
      [ 0x157, 0x72], // "0x157" => "r"
      [ 0x158, 0x52], // "0x158" => "R"
      [ 0x159, 0x72], // "0x159" => "r"
      [ 0x15a, 0x53], // "0x15a" => "S"
      [ 0x15b, 0x73], // "0x15b" => "s"
      [ 0x15c, 0x53], // "0x15c" => "S"
      [ 0x15d, 0x73], // "0x15d" => "s"
      [ 0x15e, 0x53], // "0x15e" => "S"
      [ 0x15f, 0x73], // "0x15f" => "s"
      [ 0x160, 0x53], // "0x160" => "S"
      [ 0x161, 0x73], // "0x161" => "s"
      [ 0x162, 0x54], // "0x162" => "T"
      [ 0x163, 0x74], // "0x163" => "t"
      [ 0x164, 0x54], // "0x164" => "T"
      [ 0x165, 0x74], // "0x165" => "t"
      [ 0x166, 0x54], // "0x166" => "T"
      [ 0x167, 0x74], // "0x167" => "t"
      [ 0x168, 0x55], // "0x168" => "U"
      [ 0x169, 0x75], // "0x169" => "u"
      [ 0x16a, 0x55], // "0x16a" => "U"
      [ 0x16b, 0x75], // "0x16b" => "u"
      [ 0x16c, 0x55], // "0x16c" => "U"
      [ 0x16d, 0x75], // "0x16d" => "u"
      [ 0x16e, 0x55], // "0x16e" => "U"
      [ 0x16f, 0x75], // "0x16f" => "u"
      [ 0x170, 0x55], // "0x170" => "U"
      [ 0x171, 0x75], // "0x171" => "u"
      [ 0x172, 0x55], // "0x172" => "U"
      [ 0x173, 0x75], // "0x173" => "u"
      [ 0x174, 0x57], // "0x174" => "W"
      [ 0x175, 0x77], // "0x175" => "w"
      [ 0x176, 0x59], // "0x176" => "Y"
      [ 0x177, 0x79], // "0x177" => "y"
      [ 0x178, 0x59], // "0x178" => "Y"
      [ 0x179, 0x5a], // "0x179" => "Z"
      [ 0x17a, 0x7a], // "0x17a" => "z"
      [ 0x17b, 0x5a], // "0x17b" => "Z"
      [ 0x17c, 0x7a], // "0x17c" => "z"
      [ 0x17d, 0x5a], // "0x17d" => "Z"
      [ 0x17e, 0x7a], // "0x17e" => "z"
      [ 0x218, 0x53], // "0x218" => "S"
      [ 0x219, 0x73], // "0x219" => "s"
      [ 0x21a, 0x54], // "0x21a" => "T"
      [ 0x21b, 0x74], // "0x21b" => "t"
      [ 0x25b, 0x45], // "0x25b" => "E"
      [ 0x1e7c, 0x56], // "0x1e7c" => "V"
      [ 0x1e7d, 0x76], // "0x1e7d" => "v"
      [ 0x1ebc, 0x45], // "0x1ebc" => "E"
      [ 0x1ebd, 0x65], // "0x1ebd" => "e"
      [ 0x1ef8, 0x59], // "0x1ebd" => "Y"
      [ 0x1ef9, 0x79], // "0x1ef9" => "y"
      [ 0x20a4, 0xa3], // "0x20a4" => "бъ"
    ]);
    /* >> [BTS-1676] */

    var content2 = "";
    var normalChar = "";
    for(var i = 0; i < content.length; i++  ){
      var letter = content.charAt(i);
      /* << [BTS-1676]: BDC kanxj 20190525 modfy for Reduced SMS encoding does not work */
      let letterCode = letter.charCodeAt();
      letterCode = shiftTable.get(letterCode);
      normalChar = String.fromCharCode(letterCode);

      if (typeof(normalChar) == "undefined" || typeof(letterCode) == "undefined"){
      /* >> [BTS-1676]*/
        normalChar = letter;
      }
      content2  += normalChar;
    }
    return content2;
  },
  /* >> [BTS-410] */
    // consider splitting this method for the different use cases
    /*
     * `opts` can have the following properties:
     * - recipients (string or array of string): contains the list of
     *   recipients for this message
     * - content (string): the message's body
     * - serviceId (optional long or string): the SIM serviceId we use to send the
     *   message
     * - onsuccess (optional function): will be called when one SMS has been
     *   sent successfully, with the request's result as argument. Can be called
     *   several times.
     * - onerror (optional function): will be called when one SMS transmission
     *   failed, with the error object as argument. Can be called several times.
     * - oncomplete (optional function): will be called when all messages have
     *   been sent. It's argument will have the following properties:
     *   + hasError (boolean): whether we had at least one error
     *   + return (array): each item is an object with the following properties:
     *     . success (boolean): whether this is a success or an error
     *     . result (request's result): the request's result object
     *     . recipient (string): the recipient used for this transmission.
     */
    sendSMS: function mm_send(opts) {
      let recipients = opts.recipients || [],
          content = opts.content,
          serviceId = this._sanitizeServiceId(opts.serviceId),
          onsuccess = opts.onsuccess,
          onerror = opts.onerror,
          oncomplete = opts.oncomplete;

      if (!Array.isArray(recipients)) {
        recipients = [recipients];
      }

      // The returned value is not a DOM request!
      // Instead, It's an array of DOM requests.
      let i = 0;
      let requestResult = { hasError: false, return: [] };
      let sendOpts = this._getSendOptionsFromServiceId(serviceId);

      /* << [BTS-410]: BDC kanxj 20190318 porting to support Full/reduce character in SMS */
      let settings = window.navigator.mozSettings;
      let req = settings.createLock().get('ril.sms.encoding_mode');

      req.onsuccess = ()=> {
        //dump("JWJ: Enter callback ");
        let encodeMode = req.result['ril.sms.encoding_mode'];
        dump("JWJ: result is " + encodeMode);
        if(encodeMode == "0") {
          dump("JWJ: is in Reduced model");
          content = this.shift2Normal(content);
        }
      let requests = this._mozMobileMessage.send(recipients, content, sendOpts);
      let numberOfRequests = requests.length;

      const amlNumber = '112';
      if (recipients.indexOf(amlNumber) !== -1) {
        AML.triggerBySMS(serviceId);
      }

      requests.forEach(function(request, idx) {
        request.onsuccess = function onSuccess(event) {
          onsuccess && onsuccess(event.target.result);

          requestResult.return.push({
            success: true,
            result: event.target.result,
            recipient: recipients[idx]
          });

          if (i === numberOfRequests - 1) {
            oncomplete && oncomplete(requestResult);
          }
          i++;
        };

        request.onerror = function onError(event) {
          console.error('Error Sending: ' + JSON.stringify(event.target.error));
          onerror && onerror(event.target.error);

          requestResult.hasError = true;
          requestResult.return.push({
            success: false,
            code: event.target.error,
            recipient: recipients[idx]
          });

          if (i === numberOfRequests - 1) {
            oncomplete && oncomplete(requestResult);
          }
          i++;
        };
      });
      };
      /* >> [BTS-410] */

      // Need provide the send event data to event_log_data module.
      Utils.sendEventLogs(recipients, 'sms_send');
    },

    /*
     * opts is an object with the following properties:
     * - recipients (string or array of string): recipients for this message
     * - subject (optional string): subject for this message
     * - content (array of SMIL slides): this is the content for the message (see
     *   ThreadUI for more information)
     * - serviceId (optional long or string): the SIM that should be used for
     *   sending this message. If this is not the current default configuration
     *   for sending MMS, then we'll first switch the configuration to this
     *   serviceId, and only then send the message. That means that the "sending"
     *   event will come quite late in this case.
     * - onsuccess (optional func): called only once, even for several recipients,
     *   when the message is successfully sent.
     * - onerror (optional func): called only once if there is an error.
     *
     */

    sendMMS: function mm_sendMMS(opts) {
      let request;
      let recipients = opts.recipients,
          subject = opts.subject,
          content = opts.content,
          serviceId = opts.serviceId = this._sanitizeServiceId(opts.serviceId),
          onsuccess = opts.onsuccess,
          onerror = opts.onerror;

      if (!Array.isArray(recipients)) {
        recipients = [recipients];
      }

      let message = SMIL.generate(content);

      let sendOpts = this._getSendOptionsFromServiceId(serviceId);

      // TODO we should add the parameters Settings.isGroup when gecko code is merged.
      request = this._mozMobileMessage.sendMMS({
        receivers: recipients,
        subject: subject,
        smil: message.smil,
        attachments: message.attachments,
        isGroup: Settings.isGroup
      }, sendOpts);

      request.onsuccess = function onSuccess(event) {
        onsuccess && onsuccess(event.target.result);
      };

      request.onerror = function onError(event) {
        onerror && onerror(event.target.error);
      };

      // Set isGroup flag after send MMS action.
      Settings.isGroup = false;
    },

    // takes a formatted message in case you happen to have one
    resendMessage: function mm_resendMessage(opts) {
      let message = opts.message;

      if (!message) {
        throw new Error('Message to resend is not defined.');
      }

      let serviceId = Settings.getServiceIdByIccId(message.iccId);
      let sendOpts = this._getSendOptionsFromServiceId(serviceId);
      let onsuccess = opts.onsuccess;
      let onerror = opts.onerror;
      let request;

      if (message.type === 'sms') {
        request = this._mozMobileMessage.send(
          message.receiver, message.body, sendOpts);

        // Need provide the send event data to event_log_data module.
        Utils.sendEventLogs(message.receiver, 'sms_send');
      }
      if (message.type === 'mms') {
        request = this._mozMobileMessage.sendMMS({
          receivers: message.receivers,
          subject: message.subject,
          smil: message.smil,
          attachments: message.attachments,
          isGroup: message.isGroup
        }, sendOpts);
      }

      request.onsuccess = function onSuccess(evt) {
        MessageManager.deleteMessages(message.id);
        onsuccess && onsuccess(evt.target.result);
      };

      request.onerror = function onError(evt) {
        MessageManager.deleteMessages(message.id);
        onerror && onerror(evt.target.error);
      };
    },

    deleteMessages: function mm_deleteMessages(id, callback) {
      let req = this._mozMobileMessage.delete(id);
      req.onsuccess = function onsuccess() {
        callback && callback(this.result);
      };

      // TODO: If the messages could not be deleted completely, conversation list
      // page will also update without notification currently. May need more
      // information for user that the messages were not removed completely.
      // See bug #1045666 for details.
      req.onerror = function onerror() {
        let msg = 'Deleting in the database. Error: ' + req.error.name;
        console.log(msg);
        callback && callback(null);
      };
    },

    markThreadRead: function mm_markThreadRead(threadId) {
      let filter = {
        threadId: threadId,
        read: false
      };

      let messagesUnreadIDs = [];
      let changeStatusOptions = {
        each: function addUnreadMessage(message) {
          messagesUnreadIDs.push(message.id);
          return true;
        },
        filter: filter,
        invert: true,
        end: function handleUnread() {
          MessageManager.markMessagesRead(messagesUnreadIDs);
        },
        done: function() {
          MessageManager.updateSystemInfo();
        }
      };
      MessageManager.getMessages(changeStatusOptions);
    },

    updateSystemInfo: function() {
      navigator.mozApps.getSelf().onsuccess = function() {
        let app = this.result;
        if (!app.connect) {
          // in such case we can't use IAC
          console.warn('Can not initialise IAC');
          return;
        }
        app.connect('messageRead').then(function onConnAccepted(ports) {
          ports.forEach(function(port) {
            port.postMessage('messageRead');
          });
        }, function onConnRejected(reason) {
          console.log('messageRead is reject: ' + reason);
        });
      };
    },

    markMessagesRead: function mm_markMessagesRead(list) {
      if (!this._mozMobileMessage || !list.length) {
        return;
      }

      // We chain the calls to the API in a way that we make no call to
      // 'markMessageRead' until a previous call is completed. This way any
      // other potential call to the API, like the one for getting a message
      // list, could be done within the calls to mark the messages as read.

      let id = list.pop();
      // TODO: Third parameter of markMessageRead is return read request.
      //       Here we always return read request for now, but we can let user
      //       decide to return request or not in Bug 971658.
      let req = this._mozMobileMessage.markMessageRead(id, true, true);

      req.onsuccess = () => {
        if (!list.length) {
          return;
        }

        this.markMessagesRead(list);
      };

      req.onerror = () => {
        console.error(
          'Error while marking message %d as read: %s', id, this.error.name
        );
      };
    },

    getSegmentInfo: function mm_getSegmentInfo(text) {
      if (!(this._mozMobileMessage &&
            this._mozMobileMessage.getSegmentInfoForText)) {
        return Promise.reject(new Error('mozMobileMessage is unavailable.'));
      }

      let defer = Utils.Promise.defer();
      let request = this._mozMobileMessage.getSegmentInfoForText(text);
      request.onsuccess = function onsuccess(e) {
        defer.resolve(e.target.result);
      };

      request.onerror = function onerror(e) {
        defer.reject(e.target.error);
      };

      return defer.promise;
    },

    _isMessageBelongTo1to1Conversation:
     function isMessageBelongTo1to1Conversation(number, message) {
      let isIncoming = message.delivery === 'received' ||
                       message.delivery === 'not-downloaded';
      // if it is a received message, it is a candidate
      // we still need to test the sender in case the user filters with his own
      // number, because we would get all the received messages in this case.
      if (isIncoming) {
        return Utils.probablyMatches(message.sender, number);
      } else {
        switch (message.type) {
          case 'sms':
            // in case of sent messages and sms, we test if the receiver match the
            // filter, to filter out other sent messages in the case user is
            // sending message to himself
            return Utils.probablyMatches(message.receiver, number);
          case 'mms':
            return message.receivers.length === 1 &&
                   Utils.probablyMatches(message.receivers[0], number);
          default:
            console.error('Got an unknown message type: ' + message.type);
            return false;
        }
      }
    },

    /**
     * findThreadFromNumber
     *
     * Find a SMS/MMS thread from a number.
     * @return Promise that resolve to a threadId or rejected if not found
     */
    findThreadFromNumber: function mm_findThread(number) {
      if (!Array.isArray(number)) {
        number = [number];
      }

      function checkCandidate(message) {
        let isMessageInThread = true;
        if (number.length > 1) {
          if (message.type === 'mms') {
            if (number.length === message.receivers.length) {
              isMessageInThread = !number.some(key => {
                return message.receivers.indexOf(key) === -1;
              });
            } else {
              isMessageInThread = false;
            }
          } else {
            isMessageInThread = false;
          }
        } else {
          isMessageInThread = MessageManager.
            _isMessageBelongTo1to1Conversation(number[0], message);
        }
        if (isMessageInThread) {
          threadId = message.threadId;
          // we need to set the current threadId,
          // because we start sms app in a new window
          Threads.registerMessage(message);
          return false; // found the message, stop iterating
        }
      }

      let threadId = null;
      let deferred = Utils.Promise.defer();

      // If there is no number, the thread must not exist.
      // It is not necessary to waste too mush time on the situation.
      if (number.length === 0) {
        deferred.reject(new Error('The number is null'));
        return deferred.promise;
      }

      MessageManager.getMessages({
        filter: { numbers: number },
        each: checkCandidate,
        done: function() {
          if (threadId === null) {
            deferred.reject(new Error('No thread found for number: ' + number));
          } else {
            deferred.resolve(threadId);
          }
        }
      });

      return deferred.promise;
    }
  };

  Object.defineProperty(exports, 'MessageManager', {
    get: function () {
      delete exports.MessageManager;

      exports.MessageManager = EventDispatcher.mixin(MessageManager, [
        'message-sending', 'message-failed-to-send', 'message-delivered',
        'message-read', 'message-sent', 'message-received', 'threads-deleted',
        'threads-download', 'message-retrieving', 'message-list-sent',
        'custom-message'
      ]);

      return exports.MessageManager;
    },
    configurable: true,
    enumerable: true
  });
})(window);
