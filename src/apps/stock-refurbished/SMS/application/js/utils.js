/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* globals ContactPhotoHelper, Notification, Promise, Threads, Settings,
           Dialog,
           Promise
*/

(function(exports) {
  'use strict';
  const rdashes = /-(.)/g;
  const rescape = /[.?*+^$[\]\\(){}|-]/g;
  const rparams = /([^?=&]+)(?:=([^&]*))?/g;
  const rnondialablechars = /[^,#+\*\d]/g;
  const rmail = /[\w-]+@[\w\-]/;

  let settingsInterface = navigator.mozSettings;
  let contactsInterface = navigator.mozContacts;
  let appStorage = navigator.getDeviceStorage('apps');

  let dataStoreBackUp = null;

  let Utils = {
    menuOptionVisible: false,

    date: {
      shared: new Date(),
      get format() {
        // Remove the accessor
        delete Utils.date.format;
        // Late initialization allows us to safely mock the mozL10n object
        // without creating race conditions or hard script dependencies
        return (Utils.date.format = new navigator.mozL10n.DateTimeFormat());
      }
    },

    threadRecipientsMap: [],

    escapeRegex: function ut_escapeRegex(str) {
      if (typeof str !== 'string') {
        return '';
      }
      return str.replace(rescape, '\\$&');
    },

    getFormattedHour: function ut_getFormattedHour() {
      return this.date.format.localeFormat(
        this.date.shared,
        this._(
          navigator.mozHour12 ? 'shortTimeFormat12' : 'shortTimeFormat24'
        )
      );
    },

    getDayDate: function re_getDayDate(time) {
      this.date.shared.setTime(+time);
      this.date.shared.setHours(0, 0, 0, 0);
      return this.date.shared.getTime();
    },

    getDayYearDiff: function re_getDayYear(messageTime, currentTime) {
      let date = new Date();
      let yearDiff = 0;
      date.setTime(+messageTime);
      yearDiff = date.getFullYear() - yearDiff;
      date.setTime(+currentTime);
      yearDiff = date.getFullYear() - yearDiff;
      return yearDiff;
    },

    initDateTime: function ut_initDateTime(time) {
      this._ = navigator.mozL10n.get;
      const unitConvert = 86400000;
      let today = Utils.getDayDate(Date.now());
      let otherDay = Utils.getDayDate(time);
      this.dayDiff = (today - otherDay) / unitConvert;
      this.yearDiff = this.getDayYearDiff(time, Date.now());
      this.date.shared.setTime(+time);
      this.dateLanguage = navigator.language;
    },

    getHeaderDate: function ut_giveHeaderDate() {
      const weekLength = 7;

      let timeHeaderOption = {
        'thisWeek': { weekday: 'long' },
        'lastWeek': { weekday: 'short', month: 'long', day: 'numeric' },
        'lastYear': { weekday: 'short', year: 'numeric', month: 'short',
                      day: 'numeric' },
        'beforeYear': { weekday: 'short', year: 'numeric', month: 'short',
                        day: 'numeric' }
      };

      let date = this.date.shared;

      if (isNaN(this.dayDiff)) {
        return this._('incorrectDate');
      }

      if (this.dayDiff < 0) {
        // future time
        return date.toLocaleString(this.dateLanguage, timeHeaderOption.lastYear);
      }

      return this.dayDiff === 0 && this._('today') ||
             this.dayDiff === 1 && this._('yesterday') ||
             this.dayDiff < weekLength &&
               date.toLocaleString(this.dateLanguage, timeHeaderOption.thisWeek) ||
             this.yearDiff < 1 &&
               date.toLocaleString(this.dateLanguage, timeHeaderOption.lastWeek) ||
             this.yearDiff === 1 &&
               date.toLocaleString(this.dateLanguage, timeHeaderOption.lastYear) ||
             date.toLocaleString(this.dateLanguage, timeHeaderOption.beforeYear);
    },

    getAllHeaderDate: function ut_getAllHeaderDate() {
      const weekLength = 7;

      let timeStampOption = {
        'thisWeek': { weekday: 'long', hour: 'numeric', minute: 'numeric' },
        'lastWeek': { weekday: 'short', month: 'long', day: 'numeric',
                      hour: 'numeric', minute: 'numeric' },
        'lastYear': { year: 'numeric', month: 'short', day: 'numeric',
                      weekday: 'short', hour: 'numeric', minute: 'numeric' },
        'beforeYear': { weekday: 'short', year: 'numeric', month: 'short',
                        day: 'numeric', hour: 'numeric', minute: 'numeric' }
      };

      let specialTimeOption = { hour: 'numeric', minute: 'numeric' };

      if (window.navigator.mozHour12) {
        [timeStampOption.thisWeek.hour12,
         timeStampOption.lastWeek.hour12,
         timeStampOption.lastYear.hour12,
         timeStampOption.beforeYear.hour12,
         specialTimeOption.hour12] = [true, true, true, true, true];
      } else {
        [timeStampOption.thisWeek.hour12,
         timeStampOption.lastWeek.hour12,
         timeStampOption.lastYear.hour12,
         timeStampOption.beforeYear.hour12,
         specialTimeOption.hour12] = [false, false, false, false, false];
      }

      let date = this.date.shared;

      if (isNaN(this.dayDiff)) {
        return this._('incorrectDate');
      }

      if (this.dayDiff < 0) {
        // future time
        return date.toLocaleString(this.dateLanguage, timeStampOption.lastYear);
      }

      return this.dayDiff === 0 &&
               (this._('today') + ' ' + date.toLocaleString(
                 this.dateLanguage, specialTimeOption)) ||
             this.dayDiff === 1 &&
               (this._('yesterday') + ' ' + date.toLocaleString(
                 this.dateLanguage, specialTimeOption)) ||
             this.dayDiff < weekLength &&
               date.toLocaleString(this.dateLanguage, timeStampOption.thisWeek) ||
             this.yearDiff < 1 &&
               date.toLocaleString(this.dateLanguage, timeStampOption.lastWeek) ||
             this.yearDiff === 1 &&
               date.toLocaleString(this.dateLanguage, timeStampOption.lastYear) ||
             date.toLocaleString(this.dateLanguage, timeStampOption.beforeYear);
    },

    getInformationDate: function ut_getInformationDate() {
      let informationOption = {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: 'numeric'
      };

      if (window.navigator.mozHour12) {
        informationOption.hour12 = true;
      } else {
        informationOption.hour12 = false;
      }

      let date = this.date.shared;

      if (isNaN(this.dayDiff)) {
        return this._('incorrectDate');
      }

      return date.toLocaleString(this.dateLanguage, informationOption);
    },

    // We will apply createObjectURL for details.photoURL if contact image exist
    // Please remember to revoke the photoURL after utilizing it.
    getContactDetails:
     function ut_getContactDetails(number, contacts, include) {
      let details = {};

      include = include || {};
      details.isContact = false;

      function updateDetails(contact) {
        let name, phone, i, length, subscriber, org;
        if (contact.name === null) {
          contact.name = [];
        }
        name = contact.name[0];
        org = contact.org && contact.org[0];
        length = contact.tel ? contact.tel.length : 0;
        subscriber = number.length > 7 ? number.substr(-8) : number;

        // Check which of the contacts phone number are we using
        for (i = 0; i < length; i++) {
          // Based on E.164 (http://en.wikipedia.org/wiki/E.164)
          if (contact.tel[i].value.indexOf(subscriber) !== -1) {
            phone = contact.tel[i];
            break;
          }
        }

        // Add data values for contact activity interaction
        details.isContact = true;

        // Add photo
        if (include.photoURL) {
          let photo = ContactPhotoHelper.getThumbnail(contact);
          if (photo) {
            details.photoURL = window.URL.createObjectURL(photo);
          }
        }

        details.name = name;
        // We pick the first discovered org name as the phone number's detail
        // org information.
        details.org = details.org || org;
      }

      // In no contact or contact with empty information cases, we will leave
      // the title as the empty string and let caller to decide the title.
      if (!contacts || (Array.isArray(contacts) && contacts.length === 0)) {
        details.title = '';
      } else if (!Array.isArray(contacts)) {
        updateDetails(contacts);
        details.title = details.name || details.org;
      } else {
        // Rule for fetching details with multiple contact entries:
        // 1) If we got more than 1 contact entry, find another entry if
        //    current entry got no name/company.
        // 2) If we could not get any information from all the entries,
        //    just display phone number.
        for (let i = 0, l = contacts.length; i < l; i++) {
          updateDetails(contacts[i]);
          if (details.name) {
            break;
          }
        }
        details.title = details.name || details.org;
      }

      return details;
    },

    /**
     * Based on input number tries to extract more phone details like phone
     * type, full phone number and phone carrier.
     * 1. If a phone number has carrier associated with it then both "type" and
     * "carrier" will be returned;
     *
     * 2. If there is no carrier associated with the phone number then "type"
     *  and "phone number" will be returned;
     *
     * 3. If for some reason a single contact has two phone numbers with the
     * same type and the same carrier then "type" and "phone number" will be
     * returned;
     *
     * note: The argument "tels" can actually contain "emails" too.
     *
     */
    getPhoneDetails: function ut_getPhoneDetails(input, tels) {
      let length = tels.length;
      let hasUniqueCarriers = true;
      let hasUniqueTypes = true;
      let found, tel, type, carrier;

      for (let i = 0; i < length; i++) {
        tel = tels[i];

        if (tel.value && this.probablyMatches(tel.value, input)) {
          found = tel;
        }

        if (carrier && carrier === tel.carrier) {
          hasUniqueCarriers = false;
        }

        if (type && type === tel.type[0]) {
          hasUniqueTypes = false;
        }

        carrier = tel.carrier;
        type = (tel.type && tel.type[0]) || '';
      }

      if (!found) {
        return null;
      }

      return {
        type: (found.type && found.type[0]) || null,
        carrier: hasUniqueCarriers || hasUniqueTypes ? found.carrier : null,
        number: found.value
      };
    },

    // Based on "non-dialables" in https://github.com/andreasgal/PhoneNumber.js
    //
    // @param {String} input Value to remove nondialiable chars from.
    //
    removeNonDialables: function ut_removeNonDialables(input) {
      return input.replace(rnondialablechars, '');
    },

    // @param {String} a First recipient field.
    // @param {String} b Second recipient field
    //
    // Based on...
    //  - ITU-T E.123 (http://www.itu.int/rec/T-REC-E.123-200102-I/)
    //  - ITU-T E.164 (http://www.itu.int/rec/T-REC-E.164-201011-I/)
    //
    // ...It would appear that a maximally-minimal
    // 7 digit comparison is safe.
    probablyMatches: function ut_probablyMatches(a, b) {
      let service = navigator.mozPhoneNumberService;

      // String comparison starts here
      if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
      }

      if (Settings.supportEmailRecipient &&
          this.isEmailAddress(a) &&
          this.isEmailAddress(b)) {
        return a === b;
      }

      if (service && service.normalize) {
        a = service.normalize(a);
        b = service.normalize(b);
      } else {
        a = this.removeNonDialables(a);
        b = this.removeNonDialables(b);
      }

      return a === b || a.slice(-7) === b.slice(-7);
    },

    /**
     * multiRecipientMatch
     *
     * Check multi-repients without regard to order
     *
     * @param {(String|string[])} a First recipient field.
     * @param {(String|string[])} b Second recipient field.
     *
     * @return {Boolean} Return true if all recipients match.
     */
    multiRecipientMatch: function ut_multiRecipientMatch(a, b) {
      // When ES6 syntax is allowed, replace with
      // multiRecipientMatch([...a], [...b])
      a = [].concat(a);
      b = [].concat(b);
      let blen = b.length;
      if (a.length !== blen) {
        return false;
      }
      // Check each recipient in a against each in b
      // Allows for any order (and fails early)
      return a.every((number) => {
        for (let i = 0; i < blen; i++) {
          if (this.probablyMatches(number, b[i])) {
            return true;
          }
        }
      });
    },

    // Default image size limitation is set to 295KB for MMS user story.
    // If limit is not given or bigger than default 295KB, default value need
    // to be applied here for size checking. Parameters could be:
    // (blob, callback) : Resizing image to default limit 295k.
    // (blob, limit, callback) : Resizing image to given limitation.
    getResizedImgBlob: function ut_getResizedImgBlob(blob, limit, callback) {
      let defaultLimit = 295 * 1024;
      if (typeof limit === 'function') {
        callback = limit;
        limit = defaultLimit;
      }
      limit = limit === 0 ? defaultLimit : Math.min(limit, defaultLimit);

      if (blob.size < limit) {
        setTimeout(function blobCb() {
          callback(blob);
        });
        return;
      }

      let ratio = Math.sqrt(blob.size / limit);
      this._resizeImageBlobWithRatio({
        blob: blob,
        limit: limit,
        ratio: ratio,
        callback: callback
      });
    },

    /**
    * Gets localization details for attachment size label.
    * @param size Attachment blob size in bytes.
    * @returns {{l10nId: string, l10nArgs: {n: string}}}
    */
    getSizeForL10n: function ut_getSizeForL10n(size) {
      // blob size with unit (B or KB or MB)
      let sizeKB = size / 1024;
      let sizeMB = sizeKB / 1024;
      if (size < 1000) {
        return {
          l10nId: 'attachmentSizeB',
          l10nArgs: { n: size }
        };
      } else if (sizeKB < 1000) {
        return {
          l10nId: 'attachmentSizeKB',
          l10nArgs: { n: sizeKB.toFixed(1) }
        };
      }
      return {
        l10nId: 'attachmentSizeMB',
        l10nArgs: { n: sizeMB.toFixed(1) }
      };
    },

    //  resizeImageBlobWithRatio have additional ratio to force image
    //  resize to smaller size to avoid edge case about quality adjustment
    //  not working.
    //  For JPG images, a ratio between 2 and 8 will be set to a close
    //  power of 2. A ratio between 1 and 2 will be set to 2. A ratio bigger
    //  than 8 will be rounded to the closest bigger integer.
    //
    _resizeImageBlobWithRatio: function ut_resizeImageBlobWithRatio(obj) {
      let [blob, callback, limit, ratio] = [
        obj.blob,  obj.callback, obj.limit, Math.ceil(obj.ratio)
      ];
      let qualities = [0.65, 0.5, 0.25];

      let sampleSize = 1;
      let sampleSizeHash = '';

      if (blob.size < limit || ratio <= 1) {
        setTimeout(function blobCb() {
          callback(blob);
        });
        return;
      }

      if (blob.type === 'image/jpeg') {
        if (ratio >= 8) {
          sampleSize = 8;
        } else {
          sampleSize = ratio = this.getClosestSampleSize(ratio);
        }

        sampleSizeHash = '#-moz-samplesize=' + sampleSize;
      }

      let img = document.createElement('img');
      let url = window.URL.createObjectURL(blob);
      img.src = url + sampleSizeHash;

      img.onload = function onBlobLoaded() {
        window.URL.revokeObjectURL(url);
        let targetWidth = img.width * sampleSize / ratio;
        let targetHeight = img.height * sampleSize / ratio;

        let canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        let context = canvas.getContext('2d', { willReadFrequently: true });

        context.drawImage(img, 0, 0, targetWidth, targetHeight);
        img.src = '';
        // Bug 889765: Since we couldn't know the quality of the original jpg
        // The 'resized' image might have a bigger size because it was saved
        // with quality or dpi. Here we will adjust the jpg quality(or resize
        // blob again if low quality blob size still exceed limit) to make
        // sure the size won't exceed the limitation.
        let level = 0;

        function cleanup() {
          canvas.width = canvas.height = 0;
          canvas = null;
        }

        function ensureSizeLimit(resizedBlob) {
          if (resizedBlob.size < limit) {
            cleanup();

            // using a setTimeout so that used objects can be garbage collected
            // right now
            setTimeout(callback.bind(null, resizedBlob));
          } else {
            resizedBlob = null; // we don't need it anymore
            // Reduce image quality for match limitation. Here we set quality
            // to 0.65, 0.5 and 0.25 for image blob resizing.
            // (Default image quality is 0.92 for jpeg)
            if (level < qualities.length) {
              canvas.toBlob(ensureSizeLimit, 'image/jpeg',
                qualities[level++]);
            } else {
              // We will resize the blob if image quality = 0.25 still exceed
              // size limitation.
              cleanup();

              // using a setTimeout so that used objects can be garbage
              // collected right now
              setTimeout(
                Utils._resizeImageBlobWithRatio.bind(Utils, {
                  blob: blob,
                  limit: limit,
                  ratio: ratio * 2,
                  callback: callback
                })
              );
            }
          }
        }

        canvas.toBlob(ensureSizeLimit, blob.type);
      };
    },

    getClosestSampleSize: function ut_getClosestSampleSize(ratio) {
      if (ratio >= 8) {
        return 8;
      }

      if (ratio >= 4) {
        return 4;
      }

      if (ratio >= 2) {
        return 2;
      }

      return 1;
    },

    camelCase: function ut_camelCase(str) {
      return str.replace(rdashes, function replacer(str, p1) {
        return p1.toUpperCase();
      });
    },

    typeFromMimeType: function ut_typeFromMimeType(mime) {
      let MAX_MIME_TYPE_LENGTH = 256; // ought to be enough for anybody
      if (typeof mime !== 'string' || mime.length > MAX_MIME_TYPE_LENGTH) {
        return null;
      }

      let index = mime.indexOf('/');
      if (index === -1) {
        return null;
      }
      let mainPart = mime.slice(0, index);
      let secondPart = mime.substr(index + 1).toLowerCase();

      switch (mainPart) {
        case 'image':
          return 'img';
        case 'text':
          if(secondPart.indexOf('vcard') !== -1) {
            return 'vcard';
          }
          if (secondPart !== 'plain') {
            return 'ref';
          }
          return mainPart;
        case 'video':
        case 'audio':
        case 'application':
          return mainPart;
        default:
          return null;
      }
    },

    params: function(input) {
      let parsed = {};
      input.replace(rparams, function($0, $1, $2) {
        parsed[$1] = $2;
      });
      return parsed;
    },

    /*
      Using a contact resolver, a function that can looks for contacts,
      get the format for the dissambiguation.

      Used mainly in activities since they need to pick a contact from just
      the number.

      In order to workaround facebook contact issue(bug 895817), it should be
      able to handle the case about phone number without matched contact.

      Phone number comes directly from the activity in the case we call 'pick'
      from SMS App.
    */
    getContactDisplayInfo: function(resolver, phoneNumber, callback) {
      resolver(phoneNumber, function onContacts(contacts) {
        callback(Utils.basicContact(phoneNumber, contacts));
      });
    },

    basicContact: function(number, records, callback) {
      let record;
      if (Array.isArray(records)) {
        if (records.length > 0) {
          record = records[0];
        }
      } else if (records !== null) {
        record = records;
      }

      // Only exit when no record and no phone number case.
      if (!record && !number) {
        if (typeof callback === 'function') {
          callback(null);
        }
        return;
      }

      let telLength = (record && record.tel) ? record.tel.length : 0;
      let tel;
      // Look for the right tel. A record can contains more than
      // one record, so we need to identify which one is the right one.
      for (let i = 0; i < telLength; i++) {
        if (record.tel[i].value === number) {
          tel = record.tel[i];
          break;
        }
      }
      // If after looking there is no tel. matching, we apply
      // directly the number
      if (!tel) {
        tel = { type: [''], value: number, carrier: '' };
      }
      // Get the title in the standard way
      let details = this.getContactDetails(tel, record);

      return this.getDisplayObject(details.title || null, tel);
    },

    /*
      Given a title for a contact, a the current information for
      an specific phone, of that contact, creates an object with
      all the information needed to display data.
    */
    getDisplayObject: function(theTitle, tel) {
      let number = tel.value;
      let type = tel.type && tel.type.length ? tel.type[0] : '';
      let data = {
        name: theTitle || number,
        number: number,
        type: type,
        carrier: tel.carrier || ''
      };

      if (Settings.supportEmailRecipient) {
        data.email = number;
        data.emailHTML = '';
      }
      return data;
    },

    /*
      TODO: It's workaround to avoid url revoke bug. Need platform fixing
            to remove the async load/remove.(Please ref bug 972245)
    */
    asyncLoadRevokeURL: function(url) {
      setTimeout(() => {
        let image = new Image();
        image.src = url;
        image.onload = image.onerror = () => {
          window.URL.revokeObjectURL(this.src);
        };
      });
    },

    /*
       TODO: Email Address check.
     */
    isEmailAddress: function(email) {
      let extraEmail = email.indexOf(' ') === -1;
      return rmail.test(email) && extraEmail;
    },

    /*
      Helper function for removing notifications. It will fetch the notification
      using the current threadId or the parameter if provided, and close them
       from the returned list.
    */
    closeNotificationsForThread: function ut_closeNotificationsForThread(tid) {
      let threadId = tid ? tid : Threads.currentId;
      if (!threadId) {
        return;
      }

      let targetData= 'threadId:' + threadId;

      return Notification.get().then(function onSuccess(notifications) {
        for (let i = 0; i < notifications.length; i++) {
          if (notifications[i].data === targetData) {
            notifications[i].close();
          }
        }
      }).catch(function onError(reason) {
        console.error('Notification.get(data: ' + targetData + '): ', reason);
      });
    },

    /**
     * Returns a function that will call specified "func" function only after it
     * stops being called for a specified wait time.
     * @param {function} func Function to call.
     * @param {number} waitTime Number of milliseconds to wait before calling
     * actual "func" function once debounced function stops being called.
     * @returns {function}
     */
    debounce: function(func, waitTime) {
      let timeout, args, context;

      let executeLater = function() {
        func.apply(context, args);
        timeout = context = args = null;
      };

      return function() {
        context = this;
        args = arguments;

        if (timeout) {
          clearTimeout(timeout);
        }

        timeout = setTimeout(executeLater, waitTime);
      };
    },

    /**
     * Shows modal alert dialog with single OK button to dismiss it.
     * @param {string|{ raw: string|Node }|{id: string, args: Object }} message
     * Message displayed in the alert. 1. If "message" is string then it's
     * considered as l10n identifier; 2. if "message" is object with "raw"
     * property then "raw" property is used as non-localizable string or as a
     * complete Node; 3. If "message" is object with "id" and/or "args"
     * properties then "id" is considered as l10n identifier and "args" as l10n
     * string arguments.
     * @param {string|{ raw: string|Node }|{id: string, args: Object }} title
     * Optional dialog title, if not passed - default title is used. For
     * possible parameter value see "message" parameter description above.
     * @returns {Promise} Return promise is always successfully resolved.
     */
    alert: function (message, title) {
      let deferred = this.Promise.defer();

      let dialog = new Dialog({
        title: title || 'modal-dialog-default-title',
        body: message,
        options: {
          cancel: {
            text: 'modal-dialog-ok-button',
            method: deferred.resolve
          }
        }
      });
      dialog.show();

      return deferred.promise;
    },

    /**
     * Shows modal confirm dialog with two buttons, first acts as cancel action,
     * second one - as confirm action.
     * @param {string|{ raw: string|Node }|{id: string, args: Object }} message
     * Message displayed in the confirm. 1. If "message" is string then it's
     * considered as l10n identifier; 2. if "message" is object with "raw"
     * property then "raw" property is used as non-localizable string or as a
     * complete Node; 3. If "message" is object with "id" and/or "args"
     * properties then "id" is considered as l10n identifier and "args" as l10n
     * string arguments.
     * @param {string|{ raw: string|Node }|{id: string, args: Object }} title
     * Optional dialog title, if not passed - default title is used. For
     * possible parameter value see "message" parameter description above.
     * @param {{ text: string|{ raw: string|Node }|{id: string, args: Object },
     * className: string}} confirmOptions Optional customizations for confirm
     * button, custom text(for possible parameter values see "message"
     * parameter description above) and custom class name.
     * @returns {Promise} Returned promise is resolved when user tap on confirm
     * button and rejected when user taps on cancel button.
     */
    confirm: function (message, title, confirmOptions) {
      let confirmButtonText = confirmOptions && confirmOptions.text ||
                              'modal-dialog-ok-button';
      let confirmButtonClassName = confirmOptions && confirmOptions.className ||
                                   'recommend';

      let deferred = this.Promise.defer();
      let dialog = new Dialog({
        title: title || 'modal-dialog-default-title',
        body: message,
        options: {
          cancel: {
            text: 'modal-dialog-cancel-button',
            method: deferred.reject
          },
          confirm: {
            text: confirmButtonText,
            className: confirmButtonClassName,
            method: deferred.resolve
          }
        }
      });
      dialog.show();

      return deferred.promise;
    },

    // This is a common dialog for message application.
    confirmAlert: function (titleId, bodyId, cancelId, cancelCallback,
                            acceptId, acceptCallback, confirmId,
                            confirmCallback, backspaceCallback) {
      if (Utils.isDialogShown()) {
        return;
      }
      let dialogConfig = {
        title: titleId,
        body: bodyId,
        desc: { id: '', args: {} },
        cancel: {
          l10nId: cancelId,
          priority: 1,
          callback: function() {
            if (cancelCallback) {
              cancelCallback();
            }
          }
        },
        accept: {
          l10nId: acceptId,
          priority: 2,
          callback: function() {
            if (acceptCallback) {
              acceptCallback();
            }
          }
        },
        confirm: {
          l10nId: confirmId,
          priority: 3,
          callback: function() {
            if (confirmCallback) {
              confirmCallback();
            }
          }
        },
        backcallback: function() {
          if (backspaceCallback) {
            backspaceCallback();
          }
        }
      };

      let dialog = new ConfirmDialogHelper(dialogConfig);
      dialog.show(document.getElementById('file-large-confirmation-dialog'));
    },

    groupMessageAlert: function() {
      // Recovery focus to default position.
      function recoveryFocus() {
        if (focusBackUp.id === 'lastRecipient') {
          Recipients.View.isFocusable = true;
          ThreadUI.recipients.focus();
        } else {
          focusBackUp.focus();
          focusBackUp.classList.add('focus');
        }
      }

      let focusBackUp = document.activeElement;
      let dialogConfig = {
        title: 'group-message-alert-title',
        body: 'group-message-alert-body',
        desc: { id: '', args: {} },
        isGroupMessage: true,
        accept: {
          l10nId: 'select',
          priority: 2
        },
        confirm: {
          l10nId: 'ok',
          priority: 3,
          callback: function() {
            recoveryFocus();
          }
        },
        backcallback: function() {
          recoveryFocus();
        }
      };

      let dialog = new CheckDialogHelper(dialogConfig);
      dialog.show(document.getElementById('file-large-confirmation-dialog'));
    },

    isDialogShown: function() {
      return document.getElementById('gaia-confirm');
    },

    judgeNumberSituation: function(serviceId, callback, cancelCallBack) {
      // Protection code to prevent error.
      if (!serviceId) {
        serviceId = 0;
      }

      let needShow = this.needShowInputNumber(serviceId);
      let simFlag;

      if (needShow) {
        simFlag = serviceId === 0 ? 'sim1' : 'sim2';

        this.inputDialogShow('group-message', '', 'input-alert-reInput', simFlag,
          (number) => {
            // Only consider two SIM at base now.
            if (serviceId === 0) {
              this.setSettingsValue({ 'ril.mms.phoneNumber.sim1': number });
              Settings.fakeSIMNumberArray[0] = number;
            } else {
              this.setSettingsValue({ 'ril.mms.phoneNumber.sim2': number });
              Settings.fakeSIMNumberArray[1] = number;
            }

            // After number inputted, send message immediately.
            callback();
          }, () => {
            cancelCallBack && cancelCallBack();
          }, () => {
            cancelCallBack && cancelCallBack();
          }
        );
      } else {
        callback();
      }
    },

    needShowInputNumber: function(serviceId) {
      // Only when have SIM && SIM number not read && fake number is null,
      // show input box.
      return (Settings.originalSIMInfoArray[serviceId] &&
              !Settings.originalSIMNumberArray[serviceId] &&
              !Settings.fakeSIMNumberArray[serviceId])
    },

    inputDialogShow: function(title, body, alertText, simInfo,
                              confirmCallback, cancelCallback,
                              backCallback) {
      let dialogConfig = {
        title: title,
        body: { 'text': body },
        alertText: alertText,
        simFlag: simInfo,
        cancel: {
          l10nId: 'cancel',
          priority: 1,
          callback: function () {
            cancelCallback && cancelCallback();
          }
        },
        confirm: {
          l10nId: 'save-number',
          priority: 3,
          callback: function (number) {
            confirmCallback && confirmCallback(number);
          }
        },
        backcallback: function() {
          backCallback && backCallback();
        }
      };

      let dialog = new InputDialogHelper(dialogConfig);
      dialog.show(document.getElementById('file-large-confirmation-dialog'));
    },

    onDialogBeginClose: function() {
      if (exports.option) {
        exports.option.hide();
      }
      Utils.menuOptionVisible = true;
    },

    // speed press can cause the operator confused,
    // so create the function to prevent most parts of these situations.
    speedPressPrevent: function thui_speedPressPrevent(callback) {
      if (exports.option) {
        exports.option.hide();
      }
      window.addEventListener('transitionend', function optionDelete() {
        window.removeEventListener('transitionend', optionDelete);
        Utils.menuOptionVisible = true;
        callback();
      });
    },

    // settings value common module.
    setSettingsValue: function thui_setSettingsValue(settingsGroup) {
      if (!settingsInterface) {
        return;
      }
      settingsInterface.createLock().set(settingsGroup);
    },

    getSettingsValue: function thui_getSettingsValue(settingsValue) {
      return new Promise(function(resolve) {
        if (!settingsInterface) {
          resolve(null);
        }
        settingsInterface.createLock().get(settingsValue).then((result) => {
          resolve(result[settingsValue]);
        }, (error) => {
          console.error('Error while settings value get', error);
        });
      })
    },

    observerSettingsValue: function thui_observerSettingsValue(settingsValue, callback) {
      if (!settingsInterface) {
        return;
      }
      settingsInterface.addObserver(settingsValue, function(e) {
        callback(e.settingValue);
      });
    },

    findBlockNumbers: function(type, number) {
      let filterType = 'fuzzyMatch';
      if (Utils.isEmailAddress(number)) {
        filterType = 'equals';
      }

      let req = contactsInterface.findBlockedNumbers({
        filterBy: [type],
        filterValue: number,
        filterOp: filterType
      });
      return new Promise((resolve) => {
        req.onsuccess = () => {
          resolve(req.result);
        };
        req.onerror = () => {
          resolve([]);
        };
      });
    },

    blockNumbers: function(number, callback) {
      let req = contactsInterface.saveBlockedNumber(number);
      req.onsuccess = () => {
        callback(true);
      };
      req.onerror = () => {
        callback(false);
      }
    },

    unblockNumbers: function(number, callback) {
      let req = contactsInterface.removeBlockedNumber(number);
      req.onsuccess = () => {
        callback(true);
      };
      req.onerror = () => {
        callback(false);
      };
    },

    /* Send the event to the event_logger_module, the caught events are:
     * 1. When send a SMS, need save log.
     * 2. When receive a SMS, need save log.
     * 3. When open a SMS, need save log.
     */
    sendEventLogs: function(numbers, type) {
      const DATASTORE_NAME = 'eventlogger_event';
      let is_psms = 0;

      this.findContactInArray(numbers).then((param) => {
        if (!navigator.getDataStores) {
          console.warn('EventLogger: DataStore API is not available.');
          return;
        }

        let options = {};

        if (type === 'sms_send') {
          options = {
            event_type: type,
            data: {
              is_contact: param[0],
              is_dial: param[1],
              is_psms: is_psms
            }
          };
        }

        if (type === 'sms_receive' || type === 'sms_open') {
          options = {
            event_type: type,
            data: {
              is_contact: param[0]
            }
          }
        }

        if (!dataStoreBackUp) {
          navigator.getDataStores(DATASTORE_NAME).then((stores) => {
            if (stores.length < 1) {
              console.warn('EventLogger: Cannot get access to the DataStore:' + DATASTORE_NAME);
              return;
            }

            dataStoreBackUp = stores[0];
            dataStoreBackUp.add(options);
          });
        } else {
          dataStoreBackUp.add(options);
        }
      });
    },

    findContactInArray: function(numbers) {
      let is_contact = 0;
      let is_dial = 0;
      let count = 0;

      if (!Array.isArray(numbers)) {
        numbers = [numbers];
      }

      return new Promise((resolve) => {
        numbers.forEach((number) => {
          Contacts.findByAddress(number, (result) => {
            count++;
            // There is one situation we can not get,
            // if the user input a contact number, it is difficult to confirm
            // the number is manually input or not, so we only use a sample
            // logic here.
            // The contact number or email is not input manually.
            if (result && result.length > 0) {
              is_contact = 1;
            } else {
              if (ThreadUI.isManualInput) {
                is_dial = 1;
              }
            }

            if (count === numbers.length) {
              resolve([is_contact, is_dial])
            }
          });
        });
      })
    },

    alertDataOffStatus: function() {
      function settingsCallback() {
        new window.MozActivity({
          name: 'configure',
          data: {
            target: 'device',
            section: 'connectivity-settings'
          }
        });
      }

      Utils.confirmAlert('withoutDataTitle', 'withoutDataBody', null, null,
                         'withoutDataBtnOk', null,
                         'withoutDataBtnSettings', settingsCallback, null);
    },

    exceedLimitSpace: function() {
      return new Promise((resolve) => {
        appStorage.isDiskFull().then((result) => {
          resolve(result);
        });
      });
    },

    alertFreeSpace: function(tag) {
      function confirmCallback() {
        new window.MozActivity({
          name: 'moz_configure_window',
          data: {
            target: 'device',
            section: 'mediaStorage'
          }
        });
      }

      let limitBody;
      if (tag === 'send') {
        limitBody = 'data-storage-limit-send-body';
      } else if (tag === 'download') {
        limitBody = 'data-storage-limit-download-body';
      } else {
        limitBody = 'data-storage-limit-attachment-body';
      }

      Utils.confirmAlert('data-storage-limit-alert-title',
                         limitBody,
                         'data-storage-limit-alert-cancel',
                         null, null, null,
                         'data-storage-limit-alert-setting',
                         confirmCallback, null);
    },

    creationModeCheck: function(file, isForward) {
      let blob = file.blob;
      // Please refer to MMS protocol OMA-MMS-CONF-V1_2-20050301-A Chapter 7 table 1.
      // The useful format is as followed:
      // - format       - size  -    text   -  image   -  audio   -  video   -  Pim  -
      // -  text        - 30KB  -  US-ASCII    N/A        N/A        N/A        N/A
      //                           UTF-8,
      //                           UTF-16
      //
      // - image basic  - 30KB  -  same as  -  JPEG    -  AMR-NB  -  N/A     -  vCard
      //                           text        GIF87a     13K                   vCalendar
      //                                       GIF89a
      //                                       WBMP
      // - image rich   - 100KB -  same as  -  same as -  AMR-NB  -  N/A     -  same as
      //                           text        basic      13K                   basic
      //                                                  SP-MIDI
      // - video basic  - 100KB -  same as  -  same as -  same as -  3GPP    -  same as
      //                           text        basic      rich       3GPP2      basic
      // - video rich   - 300KB -  same as  -  same as -  same as -  same as -  same as
      //                           text        basic      rich       basic      basic
      let limitSizeMap = {
        text: 30 * 1024,
        imgBasic: 30 * 1024,
        imgRich: 100 * 1024,
        videoBasic: 100 * 1024,
        videoRich: 300 * 1024
      };
      let limitTypeMap = {
        text: ['text/vcard', 'text/x-vcard'],
        image: ['image/jpeg', 'image/gif', 'image/wbmp'],
        audio: ['audio/amr', 'audio/x-midi'],
        video: ['video/3gpp', 'video/3gpp2']
      };

      let blobTypeArray = blob.type.split('/');
      let needLimit = limitTypeMap[blobTypeArray[0]].indexOf(blob.type) === -1;
      if (blobTypeArray[0] === 'text' && blob.size > limitSizeMap.text) {
        needLimit = true;
      } else if ((blobTypeArray[0] === 'audio' || blobTypeArray[0] === 'video') &&
                 blob.size > limitSizeMap.videoRich) {
        needLimit = true;
      } else if (isForward && blobTypeArray[0] === 'image' &&
                 blob.size > limitSizeMap.imgRich) {
        needLimit = true;
      }

      return needLimit;
    },

    operatorCreationMode: function(needLimit, callback) {
      // Please refer the MMS protocol OMA-MMS-CONF-V1_2-20050301-A Chapter 12.
      //  - Creation mode RESTRICTED.
      //      In this mode, a terminal SHALL only create and submit MMs belonging
      //    to the Core MM Content Domain.
      //  - Creation mode WARNING.
      //      In this mode, a terminal SHALL guide the user to create and submit
      //    only MMs belonging to the Core MM Content Domain. This guidance may,
      //    for instance, be implemented as warnings to the user. If the user
      //    chooses to create and submit an MM that is conformant with the
      //    Core MM Content Domain, the MM shall be conformant with the
      //    Core MM Content Domain. The form of the guidance and choice is not specified.
      //  - Creation mode FREE.
      //      In this mode, a terminal MAY allow the user to add any content to the MM.
      let creationMode = Settings.creationMode;
      switch (creationMode) {
        case 'restricted':
          if (needLimit) {
            this.confirmAlert('creationMode_restricted_title',
              'creationMode_restricted_alert', null, null, 'ok', null, null, null, null);
            callback(true);
          } else {
            callback(false);
          }
          break;
        case 'warning':
          if (needLimit) {
            this.confirmAlert('creationMode_warning_title',
              'creationMode_warning_alert',
              'cancel', () => {
                callback(true);
              }, null, null,
              'confirm-dialog-ok', () => {
                callback(false);
              }, () => {
                callback(true);
              }
            );
          } else {
            callback(false);
          }
          break;
        case 'free':
          callback(false);
          break;
        default:
          callback(false);
          break;
      }
    },

    findBodyContent: function(messageId, callback) {
      let needLimit = false;
      let request = MessageManager.getMessage(+messageId);
      request.onsuccess = () => {
        let message = request.result;
        if (message.type === 'sms') {
          callback(needLimit)
        } else {
          SMIL.parse(message, (elements) => {
            elements.forEach((element) => {
              if (element.blob) {
                let checkLimitResult = this.creationModeCheck(element, true);
                needLimit = needLimit || checkLimitResult;
              }
            });

            callback(needLimit);
          });
        }
      };
    },

    isNoSIMStatus: function() {
      let mozConnections = navigator.mozMobileConnections;
      for (let i = 0; i < mozConnections.length; i++) {
        if (mozConnections[i].iccId) {
          return false;
        }
      }
      return true;
    },

    canSendWhenParentControl: function(numbers) {
      return new Promise((resolveAll) => {
        navigator.hasFeature('device.capability.parental-control').then(
          (controlEnabled) => {
          if (controlEnabled) {
            let asyncTask = [];
            for (let i = 0; i < numbers.length; i++) {
              let newTask = () => new Promise((resolve) => {
                Contacts.findByPhoneNumber(numbers[i], (result) => {
                  if (result) {
                    this.findBlockNumbers('number', numbers[i]).then((blockList) => {
                      // If support parent control feature and contact number
                      // in block list, should prevent send action.
                      if (blockList && blockList.length !== 0) {
                        resolve(false);
                      } else {
                        resolve(true);
                      }
                    });
                  } else {
                    // If support parent control feature and number not contact,
                    // should prevent send action.
                    resolve(false);
                  }
                });
              });
              asyncTask.push(newTask());
            }

            Promise.all(asyncTask).then((values) => {
              let lastValue = true;
              for (let i = 0; i < values.length; i++) {
                lastValue = lastValue && values[i];
              }
              resolveAll(lastValue);
            });
          } else {
            // If not support parent control feature, we must send message.
            resolveAll(true);
          }
        });
      });
    },

    getOldSIMInfo: function() {
      return new Promise((resolve) => {
        this.getSettingsValue('ril.mms.group.oldSIM').then((value) => {
          resolve(value);
        });
      });
    },

    getNewSIMInfo: function() {
      let mozConnections = navigator.mozMobileConnections;
      let iccManager = navigator.mozIccManager;
      let newSIMInfo = [];
      let newSIMNumber = [];
      for (let i = 0; i < mozConnections.length; i++) {
        newSIMInfo.push(mozConnections[i].iccId);
        let simNumber = null;
        if (mozConnections[i].iccId) {
          let iccInfoDetail = iccManager.getIccById(mozConnections[i].iccId).iccInfo;
          if (iccInfoDetail.msisdn || iccInfoDetail.mdn) {
            simNumber = iccInfoDetail.msisdn || iccInfoDetail.mdn;
          }
        }

        newSIMNumber.push(simNumber);
      }

      // Backup original SIM number for speed use later.
      Settings.originalSIMNumberArray = newSIMNumber;
      Settings.originalSIMInfoArray = newSIMInfo;
      return newSIMInfo;
    },

    saveOldSimInfo: function(simInfo) {
      this.setSettingsValue({ 'ril.mms.group.oldSIM': simInfo });
    },

    backupFakeNumber: function() {
      let settingsArray = ['ril.mms.phoneNumber.sim1', 'ril.mms.phoneNumber.sim2'];
      for (let i = 0; i < settingsArray.length; i++) {
        this.getSettingsValue(settingsArray[i]).then((value) => {
          if (!value) {
            value = null;
          }

          Settings.fakeSIMNumberArray[i] = value;
        });
      }
    },

    judgeSwitchSIMSituation: function() {
      this.getOldSIMInfo().then((value) => {
        if (!Array.isArray(value)) {
          value = [];
        }

        let oldSIMInfo = value;
        let newSIMInfo = this.getNewSIMInfo();
        let isSwitch = false;
        // Only do 2 SIM, not consider 3 and more SIM now.
        let phoneSettings = [{ 'ril.mms.phoneNumber.sim1': null },
                             { 'ril.mms.phoneNumber.sim2': null }];

        // I think the situation that single SIM device
        // change to dual SIM device does not exist.
        if (oldSIMInfo.length === newSIMInfo.length) {
          for (let i = 0; i < oldSIMInfo.length; i++) {
            if (oldSIMInfo[i] !== newSIMInfo[i]) {
              // When SIM card switch, reset changed SIM number backup.
              this.setSettingsValue(phoneSettings[i]);
              isSwitch = true;
            }
          }
        } else {
          // Reset all number when confused appear.
          phoneSettings.forEach((eachValue) => {
            this.setSettingsValue(eachValue);
          });
          isSwitch = true;
        }

        // If SIM card changed, update the SIM info.
        if (isSwitch) {
          this.saveOldSimInfo(newSIMInfo);
        }

        this.backupFakeNumber();
      });
    },

    recoveryAlertFocus: function(messageDOM) {
      let focused = document.querySelectorAll('.focus');
      for (let i = 0; i < focused.length; i++) {
        focused[i].classList.remove('focus');
      }
      let toFocused = messageDOM;
      toFocused.setAttribute('tabindex', 1);
      toFocused.classList.add('focus');

      toFocused.focus();
      toFocused.scrollIntoView(false);
    },

    getThreadContactArray: function(numbers) {
      this.threadRecipientsMap = [];
      numbers.forEach((number) => {
        Contacts.findByAddress(number, (contact) => {
          if (contact.length === 0 || !contact[0].name) {
            this.threadRecipientsMap.push([number, '']);
          } else {
            this.threadRecipientsMap.push([number, contact[0].name[0]]);
          }
        });
      });
    },

    pickContactFromNumbers: function(sender) {
      for (let i = 0; i < this.threadRecipientsMap.length; i++) {
        if (this.threadRecipientsMap[i][0] === sender &&
            this.threadRecipientsMap[i][1] !== '') {
          return this.threadRecipientsMap[i][1];
        }
      }

      return sender;
    },

    /**
     * Promise related utilities
     */
    Promise: {
      /**
       * Returns object that contains promise and related resolve\reject methods
       * to avoid wrapping long or complex code into single Promise constructor.
       * @returns {{promise: Promise, resolve: function, reject: function}}
       */
      defer: function() {
        let deferred = {};

        deferred.promise = new Promise(function(resolve, reject) {
          deferred.resolve = resolve;
          deferred.reject = reject;
        });

        return deferred;
      },

      /**
       * Wraps a generator function that yields Promises in a way that generator
       * flow is paused until yielded Promise is resolved, so that consumer gets
       * Promise result instead of Promise instance itself.
       * See https://www.promisejs.org/generators/ as the reference.
       * @param {function*} generatorFunction Generator function that yields
       * Promises.
       * @return {function}
       */
      async: function(generatorFunction) {
        return function asyncGenerator() {
          let generator = generatorFunction.apply(this, arguments);

          function handle(result) {
            if (result.done) {
              return Promise.resolve(result.value);
            }

            return Promise.resolve(result.value).then(
              (result) => handle(generator.next(result)),
              (error) => handle(generator.throw(error))
            );
          }

          try {
            return handle(generator.next());
          } catch (error) {
            return Promise.reject(error);
          }
        };
      }
    }
  };

  exports.Utils = Utils;
}(this));
