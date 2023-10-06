/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/*global Utils, MessageManager, Compose, OptionMenu, NotificationHelper,
         Attachment, Notify, SilentSms, Threads, SMIL, Contacts,
         ThreadUI, Notification, Settings, Navigation, Startup */
/*exported ActivityHandler */

'use strict';

/**
 * Describes available data types that can be associated with the activities.
 * @enum {string}
 */
const ActivityDataType = {
  IMAGE: 'image/*',
  AUDIO: 'audio/*',
  VIDEO: 'video/*',
  URL: 'url',
  VCARD: 'text/vcard'
};

let ActivityHandler = {
  isLocked: false,
  handlerBackup: null,
  activityBackup: null,
  isCustomMessage: false,


  // Will hold current activity object
  _activity: null,
  _lastMessage: false,

  // Define the notify sound file.
  notifyAudio: '/sounds/New Message_MA.ogg',
  /* << [LIO-707]: BDC kanxj 20200731 add for AMX sms alert tone >> */
  amxNotifyAudio: '/sounds/Institucional_Rubrica.ogg',

  init: function() {
    if (!window.navigator.mozSetMessageHandler) {
      return;
    }

    Startup.isActivity = window.navigator.mozHasPendingMessage('activity');
    // A mapping of MozActivity names to their associated event handler
    window.navigator.mozSetMessageHandler('activity',
      this._onActivity.bind(this, {
        'new': this._onNewActivity,
        'share': this._onShareActivity,
        'latest-message': this._onLatestMessageActivity
      })
    );

    // We don't want to register these system handlers when app is run as
    // inline activity
    if (!Navigation.getPanelName().startsWith('activity')) {
      window.navigator.mozSetMessageHandler('sms-received',
        this.onSmsReceived.bind(this));

      window.navigator.mozSetMessageHandler('sms-delivery-success',
        this.onSmsDelivery.bind(this));

      window.navigator.mozSetMessageHandler('notification',
        this.onNotification.bind(this));
    }
  },

  isInActivity: function isInActivity() {
    return !!this._activity;
  },

  setActivity: function setActivity(value) {
    if (!value) {
      throw new Error('Activity should be defined!');
    }
    this._activity = value;
  },

  // The Messaging application's global Activity handler. Delegates to specific
  // handler based on the Activity name.
  _onActivity: function activityHandler(handlers, activity) {
    ActivityHandler._onActivityDirect(handlers, activity);
  },

  _onActivityDirect: function(handlers, activity) {
    let name = activity.source.name;
    let handler = handlers[name];

    if (typeof handler === 'function') {
      this.setActivity(activity);

      handler.call(this, activity);
    } else {
      console.error('Unrecognized activity: "' + name + '"');
    }
  },

  /**
  * Finds a contact from a number or email address.
  * Returns a promise that resolve with a contact
  * or is rejected if not found
  * @returns Promise that resolve to a
  * {number: String, name: String, source: 'contacts'}
  */
  _findContactByTarget: function findContactByTarget(target) {
    let deferred = Utils.Promise.defer();

    function findAddressCallBack(results) {
      let record, name, contact;

      // Bug 867948: results null is a legitimate case
      if (results && results.length) {
        record = results[0];
        if (record.name === null) {
          record.name = [];
        }
        name = record.name.length && record.name[0];
        contact = {
          number: target,
          name: name,
          source: 'contacts'
        };

        deferred.resolve(contact);
      } else {
        deferred.reject(new Error('No contact found with target: ' + target));
      }
    }

    Contacts.findByAddress(target, findAddressCallBack);

    return deferred.promise;
  },

  _onNewActivity: function newHandler(activity) {
    // This lock is for avoiding several calls at the same time.
    if (this.isLocked) {
      return;
    }

    this.isLocked = true;

    let viewInfo = {
      number: activity.source.data.target || activity.source.data.number,
      body: activity.source.data.body,
      contact: null,
      threadId: null
    };
    if (activity.source.data.from === 'callscreen') {
      ActivityHandler.isCustomMessage = true;
    }

    let focusComposer = false;
    let threadPromise;
    if (viewInfo.number) {
      // It's reasonable to focus on composer if we already have some phone
      // number or even contact to fill recipients input
      focusComposer = true;
      // try to get a thread from number
      // if no thread, promise is rejected and we try to find a contact
      threadPromise = MessageManager.findThreadFromNumber(viewInfo.number).then(
        function onResolve(threadId) {
          viewInfo.threadId = threadId;
        },
        function onReject() {
          return ActivityHandler._findContactByTarget(viewInfo.number)
            .then((contact) => viewInfo.contact = contact);
        }
      )
      // case no contact and no thread id: gobble the error
      .catch(() => {});
    }

    return (threadPromise || Promise.resolve()).then(
      () => this.toView(viewInfo, focusComposer)
    );
  },

  _onShareActivity: function shareHandler(activity) {
    let activityData = activity.source.data,
        dataToShare = null;

    switch(activityData.type) {
      case ActivityDataType.AUDIO:
      case ActivityDataType.VIDEO:
      case ActivityDataType.IMAGE:
        let attachments = activityData.blobs.map(function(blob, idx) {
          return new Attachment(blob, {
            name: activityData.filenames[idx],
            isDraft: true
          });
        });

        let size = attachments.reduce(function(size, attachment) {
          if (attachment.type !== 'img') {
            size += attachment.size;
          }

          return size;
        }, 0);

        if (size > Settings.mmsSizeLimitation) {
          // TODO, use a more decent dialog
          window.addEventListener('keyup', function(e) {
            if (e.key === 'BrowserBack' || e.key === 'Backspace') {
              e.preventDefault();
              ActivityHandler.leaveActivity();
            }
          });
          let dialogConfig = {
            title: { id: 'attention', args: {} },
            body: {
              id: 'attached-files-too-large',
              args: {
                n: activityData.blobs.length,
                mmsSize: (Settings.mmsSizeLimitation / 1024 / 1024).toFixed(2)
              }
            },
            desc: { id: '', args: {} },
            accept: {
              l10nId: 'confirm-dialog-ok',
              priority: 2,
              callback: function() {
                ActivityHandler.leaveActivity();
              },
            },
          };
          let dialog = new ConfirmDialogHelper(dialogConfig);
          let dialogElement =
            document.getElementById('file-large-confirmation-dialog');
          dialog.show(dialogElement);
          return;
        }

        dataToShare = attachments;
        break;
      case ActivityDataType.URL:
        dataToShare = activityData.url;
        break;
      // As for the moment we only allow to share one vcard we treat this case
      // in an specific block
      case ActivityDataType.VCARD:
        dataToShare = new Attachment(activityData.blobs[0], {
          name: activityData.filenames[0],
          isDraft: true
        });
        break;
      default:
        this.leaveActivity(
          'Unsupported activity data type: ' + activityData.type
        );
        return;
    }

    if (!dataToShare) {
      this.leaveActivity('No data to share found!');
      return;
    }

    ThreadUI.addAllEventListener();
    // We need use different append function because
    // the text and attachment are divided completely.
    if (activityData.type === 'url') {
      Navigation.toPanel('composer').then(
        Compose.append.bind(Compose, dataToShare)
      );
    } else {
      Navigation.toPanel('composer').then(
        Compose.addAttachments.bind(Compose, dataToShare)
      );
    }
  },

  _onLatestMessageActivity: function() {
    this._lastMessage = true;
    Navigation.toPanel('thread-list');
  },

  /**
   * Leaves current activity and toggles request activity mode.
   * @param {string?} errorReason String message that indicates that something
   * went wrong and we'd like to call postError with the specified reason
   * instead of successful postResult.
   */
  leaveActivity: function ah_leaveActivity(errorReason) {
    if (this.isInActivity()) {
      if (errorReason) {
        this._activity.postError(errorReason);
      } else {
        this._activity.postResult({ success: true });
      }
      this._activity = null;
    }
  },

  handleMessageNotification: function ah_handleMessageNotification(message) {
    //Validate if message still exists before opening message thread
    //See issue https://bugzilla.mozilla.org/show_bug.cgi?id=837029
    if (!message) {
      return;
    }

    MessageManager.getMessage(message.id).then((message) => {
      if (!Threads.has(message.threadId)) {
        Threads.registerMessage(message);
      }

      if (Compose.isEmpty()) {
        ActivityHandler.toView(message);
        return;
      }

      function deleteCallback() {
        ThreadUI.cleanFields();
        ActivityHandler.toView(message);
      }

      Utils.confirmAlert('confirmation-title', 'discard-new-message',
                         'no', null, null, null,
                         'yes', deleteCallback);
    }, () => Utils.alert('deleted-sms'));
  },

  // The unsent confirmation dialog provides 2 options: edit and discard
  // discard: clear the message user typed
  // edit: continue to edit the unsent message and ignore the activity
  displayUnsentConfirmation: function ah_displayUnsentConfirmtion(activity) {
    function deleteCallback() {
      ThreadUI.discardDraft();
      ActivityHandler.launchComposer(activity);
    }

    Utils.confirmAlert('unsent-message-title', 'unsent-message-description',
                       'unsent-message-option-edit', null, null, null,
                       'discard-message', deleteCallback);
  },

  // Launch the UI properly
  launchComposer: function ah_launchComposer(activity) {
    ThreadUI.addAllEventListener();
    Navigation.toPanel('composer', { activity: activity });
  },

  // Check if we want to go directly to the composer or if we
  // want to keep the previously typed text
  triggerNewMessage: function ah_triggerNewMessage(body, number, contact) {
    let activity = {
      body: body || null,
      number: number || null,
      contact: contact || null
    };

    if (Compose.isEmpty()) {
      this.launchComposer(activity);
    } else {
      // ask user how should we do
      ActivityHandler.displayUnsentConfirmation(activity);
    }
  },

  /**
   * Delivers the user to the correct view based on the params provided in the
   * "message" parameter.
   * @param {{number: string, body: string, contact: MozContact,
   * threadId: number}} message It's either a message object that belongs to a
   * thread, or a message object from the system. "number" is a string phone
   * number to pre-populate the recipients list with, "body" is an optional body
   * to preset the compose input with, "contact" is an optional MozContact
   * instance, "threadId" is an optional threadId corresponding to a new or
   * existing thread.
   * @param {Boolean} focusComposer Indicates whether we need to focus composer
   * when we navigate to Thread panel.
   */
  toView: function ah_toView(message, focusComposer) {
    this.isLocked = false;

    let navigateToView = function act_navigateToView() {
      // If we only have a body, just trigger a new message.
      if (!message.threadId) {
        ActivityHandler.triggerNewMessage(
          message.body, message.number, message.contact
        );
        return;
      }

      let messageBody = message.body;
      if (focusComposer === undefined) {
        messageBody = '';
      }

      ThreadUI.addAllEventListener();
      Navigation.toPanel(
        // we should rename id, messageId here later
        'thread', { id: message.threadId, messageId: message.id,
                    focusComposer: focusComposer, body: messageBody }
      );
    };

    navigator.mozL10n.once(function waitLocalized() {
      if (!document.hidden) {
        // Case of calling from Notification
        navigateToView();
        return;
      }

      document.addEventListener('visibilitychange', function waitVisibility() {
        document.removeEventListener('visibilitychange', waitVisibility);
        navigateToView();
      });
    });
  },

  /* === Incoming SMS support === */

  onSmsReceived: function ah_onSmsReceived(message) {
    this.smsRealReceived(message);

    // Need provide the receive event data to event_log_data module.
    if (message.type === 'sms') {
      Utils.sendEventLogs(message.sender, 'sms_receive');
    }
  },

  smsRealReceived: function(message) {
    let _ = navigator.mozL10n.get;

    // Acquire the cpu wake lock when we receive an SMS.  This raises the
    // priority of this process above vanilla background apps, making it less
    // likely to be killed on OOM.  It also prevents the device from going to
    // sleep before the user is notified of the new message.
    //
    // We'll release it once we display a notification to the user.  We also
    // release the lock after 30s, in case we never run the notification code
    // for some reason.
    let wakeLock = navigator.requestWakeLock('cpu');
    let wakeLockReleased = false;
    let timeoutID = null;
    function releaseWakeLock() {
      if (timeoutID !== null) {
        clearTimeout(timeoutID);
        timeoutID = null;
      }
      if (!wakeLockReleased) {
        wakeLockReleased = true;
        wakeLock.unlock();
      }
    }
    timeoutID = setTimeout(releaseWakeLock, 30 * 1000);

    let number = message.sender;
    let threadId = message.threadId;
    let id = message.id;

    // Class 0 handler:
    if (message.messageClass === 'class-0') {
      MessageManager.deleteMessages(message.id, () => {
        releaseWakeLock();
      });

      return;
    }

    function dispatchNotification(needManualRetrieve) {
      // The SMS app is already displayed
      if (!document.hidden) {
        if (Navigation.isCurrentPanel('thread', { id: threadId })) {
          Notify.ringtone();
          Notify.vibrate();
          releaseWakeLock();
          return;
        }
      }

      navigator.mozApps.getSelf().onsuccess = function(evt) {
        let app = evt.target.result;
        let iconURL;

        if (Settings.isDualSimDevice() && Settings.hasSeveralSim()) {
          let serviceId = Settings.getServiceIdByIccId(message.iccId);
          let simId = serviceId + 1;
          iconURL = 'messages-sim' + simId;
        } else {
          iconURL = 'messages';
        }

        // Stashing the number at the end of the icon URL to make sure
        // we get it back even via system message
        iconURL += '?';
        iconURL += [
          'threadId=' + threadId,
          'number=' + encodeURIComponent(number),
          'id=' + id
        ].join('&');

        function goToMessage() {
          app.launch();
          ActivityHandler.handleMessageNotification(message);
        }

        function continueWithNotification(sender, body) {
          let title = sender;
          /* << [LIO-707]: BDC kanxj 20200731 add for AMX sms alert tone */
          let audioFile = ActivityHandler.notifyAudio;
          var skuID = navigator.engmodeExtension.getPropertyValue('ro.boot.skuid');
          console.log('sms Notification ringtones >>> ro.boot.skuid  >>>'+ skuID);
          if(skuID == "62GMX") {
            //claro ringtone
            audioFile = ActivityHandler.amxNotifyAudio;
          }
          /* >> [LIO-707] */

          /* << [LIO-707]: BDC kanxj 20200731 add for AMX sms alert tone >> */
          let options = {
            icon: iconURL,
            body: body,
            tag: 'messageId:' + id,
            data: 'threadId:' + threadId,
            mozbehavior: {
              noscreen: true,
              soundFile: app.origin + audioFile
            }
          };

          let notification = new Notification(title, options);
          notification.addEventListener('click', goToMessage);
          releaseWakeLock();

          // Close notification if we are already in thread view and view become
          // visible.
          if (document.hidden && threadId === Threads.currentId) {
            document.addEventListener('visibilitychange',
              function onVisible() {
                document.removeEventListener('visibilitychange', onVisible);
                notification.close();
            });
          }
        }

        function getTitleFromMms(callback) {
          // If message is not downloaded notification, we need to apply
          // specific text in notification title;
          // If subject exist, we display subject first;
          // If the message only has text content, display text context;
          // If there is no subject nor text content, display
          // 'mms message' in the field.
          if (needManualRetrieve) {
            setTimeout(function notDownloadedCb() {
              callback(_('notDownloaded-title'));
            });
          }
          else if (message.subject) {
            setTimeout(function subjectCb() {
              callback(message.subject);
            });
          } else {
            SMIL.parse(message, function slideCb(slideArray) {
              let text, slidesLength = slideArray.length;
              for (let i = 0; i < slidesLength; i++) {
                if (!slideArray[i].text) {
                  continue;
                }

                text = slideArray[i].text;
                break;
              }
              text = text ? text : _('mms-message');
              callback(text);
            });
          }
        }

        Contacts.findByAddress(message.sender, function gotContact(contact) {
          let sender = message.sender;
          if (!contact) {
            console.error('We got a null contact for sender:', sender);
          } else if (contact.length && contact[0].name &&
                     contact[0].name.length && contact[0].name[0]) {
            sender = contact[0].name[0];
          }
          if (message.type === 'sms') {
            continueWithNotification(sender, message.body || '');
          } else { // mms
            getTitleFromMms(function textCallback(text) {
              continueWithNotification(sender, text);
            });
          }
        });
      };
    }

    function handleNotification(isSilent) {
      if (isSilent) {
        releaseWakeLock();
      } else {
        // If message type is mms and pending on server, ignore the notification
        // because it will be retrieved from server automatically. Handle other
        // manual/error status as manual download and dispatch notification.
        // Please ref mxr for all the possible delivery status:
        // http://mxr.mozilla.org/mozilla-central/source/dom/mms/src/ril/
        // MmsService.js#62
        if (message.type === 'sms') {
          dispatchNotification();
        } else {
          // Here we can only have one sender, so deliveryInfo[0].deliveryStatus
          // => message status from sender.
          let status = message.deliveryInfo[0].deliveryStatus;
          if (status === 'pending') {
            return;
          }

          // If the delivery status is manual/rejected/error, we need to apply
          // specific text to notify user that message is not downloaded.
          dispatchNotification(status !== 'success');
        }
      }
    }
    SilentSms.checkSilentModeFor(message.sender).then(handleNotification);

    ThreadListUI.updateThread(message, { unread: !message.read });
  },

  onSmsDelivery: function (message) {
    this.alertNotification(message);
  },

  onNotification: function ah_onNotificationClick(message) {
    // The "message" argument object does not have
    // the necessary information we need, so we'll
    // extract it from the iconURL string
    //
    // NOTE: In 1.2, use the arbitrary string allowed by
    // the new notification spec.
    //

    let params = Utils.params(message.iconURL);

    // When notification is removed from notification tray, notification system
    // message will still be fired, but "clicked" property will be equal to
    // false. This should change once bug 1139363 is landed.
    // When user clicks on notification we'll get two system messages,
    // first to notify app that notification is clicked and then, once we show
    // Thread panel to the user, we remove that notification from the tray that
    // causes the second system message with "clicked" set to false.
    if (!message.clicked) {
      // When app is run via notification system message there is no valid
      // current panel set hence app is in the invalid state, so let's fix this.
      Navigation.ensureCurrentPanel();
      return;
    }

    navigator.mozApps.getSelf().onsuccess = function(event) {
      let app = event.target.result;

      app.launch();

      // the type param is only set for class0 messages
      if (params.type === 'class0') {
        Utils.alert({ raw: message.body }, { raw: message.title });
        return;
      }

      ActivityHandler.handleMessageNotification({
        id: params.id,
        threadId: params.threadId
      });
    };
  },

  alertNotification: function thui_alertNotification(message) {
    let _ = navigator.mozL10n.get;

    navigator.mozApps.getSelf().onsuccess = function(evt) {
      function goToMessage() {
        app.launch();
        ActivityHandler.handleMessageNotification(message);
      }

      let app = evt.target.result;
      let iconURL;

      if (Settings.isDualSimDevice() && Settings.hasSeveralSim()) {
        let serviceId = Settings.getServiceIdByIccId(message.iccId);
        let simId = serviceId + 1;
        iconURL = 'messages-sim' + simId;
      } else {
        iconURL = 'messages';
      }

      iconURL += '?';
      iconURL += [
        'threadId=' + message.threadId,
        'number=' + encodeURIComponent(message.sender),
        'id=' + message.id
      ].join('&');

      let notificationBody = _('delivery-notification');
      let options = {
        icon: iconURL,
        body: notificationBody,
        tag: 'messageId:' + message.id,
        data: 'threadId:' + message.threadId
      };
      let title = _('messages');
      let notification = new Notification(title, options);
      notification.addEventListener('click', goToMessage);
    };
  }
};
