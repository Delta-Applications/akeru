/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/*global Compose, Recipients, Utils, AttachmentMenu, Template, Settings,
         SMIL, ErrorDialog, MessageManager, LinkHelper,
         ActivityPicker, ThreadListUI, OptionMenu, Threads, Contacts,
         Attachment, WaitingScreen, MozActivity, LinkActionHandler,
         ActivityHandler, TimeHeaders, ContactRenderer, Draft, Drafts,
         Thread, Navigation, Promise, LazyLoader,
         SharedComponents,
         Errors,
         EventDispatcher,
         SelectionHandler,
         TaskRunner
*/
/*exported ThreadUI */

(function(exports) {
  'use strict';

  let attachmentMap = new WeakMap();
  let suggestionsObserver = null;
  let inputObserver = null

  let skSend = {
    l10nId: 'send',
    priority: 1,
    method: function() {
      ThreadUI.startSendMessage();
    }
  };

  let skSendSIM1 = {
    l10nId: 'send',
    icon: 'sim-1',
    iconMixedText: true,
    priority: 1,
    method: function () {
      ThreadUI.startSendMessage();
    }
  };

  let skSendSIM2 = {
    l10nId: 'send',
    icon: 'sim-2',
    iconMixedText: true,
    priority: 1,
    method: function () {
      ThreadUI.startSendMessage();
    }
  };

  let skLinkSelect = {
    l10nId: 'select',
    priority: 2,
    method: function () {
      ThreadUI.findLinkFocus();
    }
  };

  let skAttachmentEnter = {
    l10nId: 'select',
    priority: 2,
    method: function () {
      AttachmentMessageUI.enterAttachmentPage();
    }
  };

  let skAttachmentOpen = {
    l10nId: 'open',
    priority: 2,
    method: function () {
      ThreadUI.doLinkAction('attachment');
    }
  };

  let skDialOpen = {
    l10nId: 'call',
    priority: 2,
    method: function () {
      ThreadUI.doLinkAction('dial');
    }
  };

  let skRTTDialOpen = {
    l10nId: 'rtt-call',
    priority: 2,
    method: function () {
      ThreadUI.doLinkAction('rtt-dial');
    }
  };

  let skSelectDialOpen = {
    l10nId: 'call',
    priority: 2,
    method: function () {
      ThreadUI.doLinkAction('select-dial');
    }
  };

  let skEmailOpen = {
    l10nId: 'email',
    priority: 2,
    method: function () {
      ThreadUI.doLinkAction('email');
    }
  };

  let skUrlOpen = {
    l10nId: 'open',
    priority: 2,
    method: function () {
      ThreadUI.doLinkAction('url');
    }
  };

  let skOption = {
    l10nId: 'options',
    priority: 3,
    method: function () {
      let focused = document.querySelector('.focus');
      let linkType = ThreadUI.listenLinkElement(focused);
      ThreadUI.openLinkFocus(linkType.replace('-link', ''));
    }
  };

  let skEnter = {
    l10nId: 'enter',
    priority: 2
  };

  let skSelect = {
    l10nId: 'select',
    priority: 2,
    method: function() {
      secondCall = false;
    }
  };

  let skDownload = {
    l10nId: 'download-attachment',
    priority: 2
  };

  let skAddContact = {
    l10nId: 'add-contact',
    priority: 3,
    method: function() {
      ThreadUI.requestContact();
    }
  };

  let skAddSuggestion = {
    l10nId: 'add-suggestion',
    priority: 2,
    method: function() {
      ThreadUI.selectRecipientSuggestion();
      Recipients.View.suggest = true;
    }
  };

  let skAddSubject = {
    l10nId: 'add-subject',
    priority: 5,
    method: function() {
      ThreadUI.notFocus = true;
      setTimeout(() => {
        ThreadUI.subjectManagement();
      }, 500);
    }
  };

  let skRemoveSubject = {
    l10nId: 'remove-subject',
    priority: 5,
    method: function() {
      ThreadUI.notFocus = true;
      setTimeout(() => {
        ThreadUI.subjectManagement();
      }, 500);
    }
  };

  let skAddAttachment = {
    l10nId: 'add-attachment',
    priority: 5,
    method: function() {
      if (ThreadListUI.isDiskFull) {
        Utils.alertFreeSpace('attachment');
      } else {
        ThreadUI.addEmpty = true;
        Compose.onAttachClick();
      }
    }
  };

  let skSelectMessages = {
    l10nId: 'select-messages',
    priority: 5,
    method: function() {
      ThreadUI.selectMessages();
    }
  };

  let skCall = {
    l10nId: 'call',
    priority: 5,
    method: function() {
      ThreadUI.majorCall(false);
    }
  };

  let skRTTCall = {
    l10nId: 'rtt-call',
    priority: 5,
    method: function() {
      ThreadUI.majorCall(true);
    }
  };

  let skEmail = {
    l10nId: 'email',
    priority: 5,
    method: function() {
      let mailElement = [];
      for (let i = 0; i < Threads.active.participants.length; i++) {
        if (Utils.isEmailAddress(Threads.active.participants[i])) {
          mailElement.push(Threads.active.participants[i]);
        }
      }

      // If only one recipient, email directly, else show select dialog.
      if (mailElement.length > 1) {
        ThreadUI.showSelectDialog(mailElement, 'email');
      } else {
        ActivityPicker.email(mailElement[0]);
      }
    }
  };

  let skDeleteThread = {
    l10nId: 'delete-thread',
    priority: 5,
    method: function() {
      Utils.speedPressPrevent(function() {
        ThreadUI.notFocus = true;
        ThreadUI.deleteCurrentThread('threadMode');
        ThreadUI.disableConvertNoticeBanners();
      });
    }
  };

  let skSaveAsDraft = {
    l10nId: 'sk-save-as-draft',
    priority: 5,
    method: function() {
      ThreadUI.saveDraft({ keyFlag: 'saveDraft' }, () => {
        ThreadUI.removeAllEventListener();
        if (ActivityHandler.isInActivity()) {
          ActivityHandler.leaveActivity();
        } else {
          // Do not need recover focus for normal back to list UI.
          ThreadUI.cancelRecoverFocus = true;
          Navigation.toPanel('thread-list');
        }
      });
    }
  };

  let skCancel = {
    l10nId: 'cancel',
    priority: 5,
    method: function() {
      if (Compose.isEmpty() || ThreadUI.draft && !ThreadUI.draft.isEdited) {
        ThreadUI.cancelRecoverFocus = true;
      }
      ThreadUI.back();
    }
  };

  let skForward = {
    l10nId: 'forward',
    priority: 5,
    method: function() {
      let targetItem = ThreadUI._storeFocused;
      let messageId = ThreadUI._getFocusedMessageId(targetItem);
      if (Compose.isEmpty()) {
        ThreadUI._forwardMessage(messageId);
      } else {
        if (ThreadUI.draft && !ThreadUI.draft.isEdited) {
          if (!Threads.currentId) {
            ThreadUI.saveDraft({ autoSave: true });
          } else {
            ThreadUI.draft = null;
          }
          ThreadUI._forwardMessage(messageId);
        } else {
          Utils.confirmAlert('confirmation-title', 'draft-save-content',
            'cancel', null, 'save-as-draft',
            function() {
              ThreadUI.saveDraft({ keyFlag: 'saveDraft' }, () => {
                ThreadUI._forwardMessage(messageId);
              });
            }, 'discard-message', function() {
              ThreadUI.assimilateRecipients('false');
              ThreadUI.discardDraft();
              ThreadUI._forwardMessage(messageId);
            });
        }
      }
    }
  };

  let skViewMessageReport = {
    l10nId: 'view-message-report',
    priority: 5,
    method: function() {
      let targetItem = ThreadUI._storeFocused;
      let messageId = ThreadUI._getFocusedMessageId(targetItem);
      window.addEventListener('participants-done', function updateInformation() {
        window.removeEventListener('participants-done', updateInformation);
        // Need add focus after all dom added completely for the read out feature.
        ReportView.container.focus();
        ThreadUI.updateInformationSks();
      });
      Navigation.toPanel('report-view', {
        id: messageId,
        threadId: Threads.currentId
      });
    }
  };

  let skDelete = {
    l10nId: 'delete',
    priority: 5,
    method: function() {
      window.performance.mark('message-delete-start');
      Utils.speedPressPrevent(function() {
        if (1 === ThreadUI.allInputs.length) {
          const messageId = ThreadUI._getFocusedMessageId(ThreadUI._storeFocused);
          ThreadUI.deleteCurrentThread('messageMode', messageId);
        } else {
          ThreadUI.deleteSingleMessage();
        }
      });
    }
  };

  let skResendThisMessage = {
    l10nId: 'resend-message',
    priority: 5,
    method: function() {
      let targetItem = ThreadUI._storeFocused;
      let messageId = ThreadUI._getFocusedMessageId(targetItem);
      ThreadUI.resendMessage(messageId);
    }
  };

  let skCancelViewReport = {
    l10nId: 'cancel-view-report',
    priority: 1,
    method: function() {
      ThreadUI.isBackToThreadUI = true;
      Navigation.toPanel('thread', { id: Threads.currentId });
      NavigationMap.disableNav = false;
    }
  };

  let skBlockContacts = {
    l10nId: 'blocked',
    priority: 3,
    method: function() {
      let contactList =
        document.getElementById('information-report').querySelector('.contact-list');
      let suggestionList = contactList.querySelectorAll('.suggestion');
      Utils.confirmAlert('confirmation-title', 'block-confirmation', 'cancel', () => {
        ReportView.container.focus();
      }, null, null, 'blocked', () => {
        for (let i = 0; i < suggestionList.length; i++) {
          let nodeContact = suggestionList[i].getAttribute('data-number');
          Utils.blockNumbers(nodeContact, (value) => {
            if (value) {
              suggestionList[i].classList.add('suggestion-adjust');
              suggestionList[i].parentNode.classList.add('block-tag');
            }
          });
        }
        ReportView.container.focus();
        ThreadUI.updateSKs(threadUiCancelReportWithUnblock);
      }, () => {
        ReportView.container.focus();
      });
    }
  };

  let skUnblockContacts = {
    l10nId: 'unblocked',
    priority: 3,
    method: function() {
      let contactList =
        document.getElementById('information-report').querySelector('.contact-list');
      let suggestionList = contactList.querySelectorAll('.suggestion');
      for (let i = 0; i < suggestionList.length; i++) {
        let nodeContact = suggestionList[i].getAttribute('data-number');
        Utils.unblockNumbers(nodeContact, (value) => {
          if (value) {
            suggestionList[i].classList.remove('suggestion-adjust');
            suggestionList[i].parentNode.classList.remove('block-tag');
          }
        });
      }
      ThreadUI.updateSKs(threadUiCancelReportWithBlock);
    }
  };

  // select messages's softkey
  let skSelectAll = {
    l10nId: 'select-all',
    priority: 1,
    method: function() {
      ThreadUI.clickCheckUncheckAllButton();
    }
  };

  let skDeselectAll = {
    l10nId: 'deselect-all',
    priority: 1,
    method: function() {
      ThreadUI.clickCheckUncheckAllButton();
    }
  };

  let skDeSelect = {
    l10nId: 'deselect',
    priority: 2
  };

  let skSelectDelete = {
    l10nId: 'delete',
    priority: 3,
    method: function() {
      if (ThreadUI.isInEditMode()) {
        let selected = ThreadUI.selectionHandler.selectedCount;
        if (selected === ThreadUI.allInputs.length) {
          ThreadUI.deleteCurrentThread('editMode');
        } else {
          ThreadUI.delete();
        }
      }
    }
  };

  let skRemoveAttachment = {
    l10nId: 'remove-all-attachments',
    priority: 5,
    method: function() {
      Compose.deleteAttachment();
    }
  };

  let skLastMessage = {
    l10nId: 'last-message',
    priority: 2
  };

  let skCancelToThread = {
    l10nId: 'cancel',
    priority: 1,
    method: function() {
      ThreadUI.composerContainer.classList.remove('next-focus');
      document.querySelector('.current-focus').classList.remove('current-focus');
      ThreadUI.cancelToThread();
    }
  };

  let skWait = {
    l10nId: 'wait',
    priority: 1
  };

  let threadUiComposerOptions = {
    header: { l10nId: 'options' },
    items: [skEnter, skAddSubject, skAddAttachment]
  };

  let threadUiComposerOptionsWithAttachment = {
    header: { l10nId: 'options' },
    items: [skAttachmentEnter, skAddSubject, skAddAttachment]
  };

  let threadUiComposerOptionsWithAttachment_sub = {
    header: { l10nId: 'options' },
    items: [skAttachmentEnter, skRemoveSubject, skAddAttachment]
  };

  let threadUiComposerOptionsWithAttachment_send = {
    header: { l10nId: 'options' },
    items: [skAttachmentEnter, skAddSubject, skAddAttachment]
  };

  let threadUiComposerOptionsWithAttachment_sub_send = {
    header: { l10nId: 'options' },
    items: [skAttachmentEnter, skRemoveSubject, skAddAttachment]
  };

  let threadUiNormalOptionsWithAttachment_send = {
    header: { l10nId: 'options' },
    items: [skAttachmentEnter, skAddSubject, skAddAttachment,
            skSelectMessages, skDeleteThread]
  };

  let threadUiNormalOptionsWithAttachment_sub_send = {
    header: { l10nId: 'options' },
    items: [skAttachmentEnter, skRemoveSubject, skAddAttachment,
            skSelectMessages, skDeleteThread]
  };

  let threadUiComposerOptions_noMMS = {
    header: { l10nId: 'options' },
    items: [skEnter]
  };

  let threadUiComposerOptionsWithSend = {
    header: { l10nId:'options' },
    items: [skEnter, skAddSubject, skAddAttachment]
  };

  let threadUiComposerOptionsWithSend_noMMS = {
    header: { l10nId:'options' },
    items: [skEnter]
  };

  let threadUiComposerOptionsWithSubRemove = {
    header: { l10nId:'options' },
    items: [skEnter, skRemoveSubject, skAddAttachment]
  };

  let threadUiComposerOptionsWithSubRemove_subfocused = {
    header: { l10nId:'options' },
    items: [skRemoveSubject, skAddAttachment]
  };

  let threadUiComposerOptionsWithSubRemove_Send = {
    header: { l10nId:'options' },
    items: [skEnter, skRemoveSubject, skAddAttachment]
  };

  let threadUiComposerOptionsWithSubRemove_Send_Subfocused = {
    header: { l10nId:'options' },
    items: [skRemoveSubject, skAddAttachment]
  };

  let threadUiNormalOptions = {
    header: { l10nId:'options' },
    items: [skEnter, skAddSubject, skAddAttachment,
            skSelectMessages, skDeleteThread]
  };

  let threadUiNormalOptions_noMMS = {
    header: { l10nId:'options' },
    items: [skEnter, skSelectMessages, skDeleteThread]
  };

  let threadUiNormalOptionsWithSend = {
    header: { l10nId:'options' },
    items: [skEnter, skAddSubject, skAddAttachment,
            skSelectMessages, skDeleteThread]
  };

  let threadUiNormalOptionsWithSend_noMMS = {
    header: { l10nId:'options' },
    items: [skEnter, skSelectMessages, skDeleteThread]
  };

  let threadUiNormalOptionsWithSubRemove = {
    header: { l10nId:'options' },
    items: [skEnter, skRemoveSubject, skAddAttachment,
            skSelectMessages, skDeleteThread]
  };

  let threadUiNormalOptionsWithSubRemove_Subfocused = {
    header: { l10nId:'options' },
    items: [skRemoveSubject, skAddAttachment,
            skSelectMessages, skDeleteThread]
  };

  let threadUiNormalOptionsWithSubRemove_Send = {
    header: { l10nId:'options' },
    items: [skEnter, skRemoveSubject, skAddAttachment,
            skSelectMessages, skDeleteThread]
  };

  let threadUiNormalOptionsWithSubRemove_Send_Subfocused = {
    header: { l10nId:'options' },
    items: [skRemoveSubject, skAddAttachment,
            skSelectMessages, skDeleteThread]
  };

  let threadUiAddContact = {
    header: { l10nId: 'options' },
    items: [skAddContact]
  };

  let threadUiAddContact_send = {
    header: { l10nId: 'options' },
    items: [skAddContact]
  };

  let threadUIAddContactWithInput = {
    header: { l10nId: 'options' },
    items: [skSelect, skAddContact]
  };

  let threadUiAddSuggestion = {
    header: { l10nId: 'options' },
    items: [skAddSuggestion]
  };

  let threadUiCancelReportWithUnblock = {
    header: { l10nId: 'options' },
    items:[skCancelViewReport, skUnblockContacts]
  };

  let threadUiCancelReportWithBlock = {
    header: { l10nId: 'options' },
    items:[skCancelViewReport, skBlockContacts]
  };

  let selectAllOptions = {
    header: { l10nId: 'options' },
    items: [skSelectAll, skSelect]
  };

  let selectAllWithDeleteOptions = {
    header: { l10nId: 'options' },
    items: [skSelectAll, skSelect, skSelectDelete]
  };

  let selectAllWithDeslectFocus = {
    header: { l10nId: 'options' },
    items: [skSelectAll, skDeSelect, skSelectDelete]
  };

  let selectDeselectAllwithDeleteOptions = {
    header: { l10nId: 'options' },
    items: [skDeselectAll, skDeSelect, skSelectDelete]
  };

  let selectAllOptionsWait = {
    header: { l10nId: 'options' },
    items: [skWait, skSelect]
  };

  let selectAllWithDeleteOptionsWait = {
    header: { l10nId: 'options' },
    items: [skWait, skSelect, skSelectDelete]
  };

  let selectAllWithDeslectFocusWait = {
    header: { l10nId: 'options' },
    items: [skWait, skDeSelect, skSelectDelete]
  };

  let promptContactOption = {
    header: { l10nId: 'options' },
    items: [skSelect]
  };

  let lastMessageOption = {
    header: { l10nId: 'options' },
    items: [skLastMessage]
  };

  function thui_mmsAttachmentClick(target) {
    let liElement = ThreadUI.getParents(target, 'LI');
    let isMT = true;
    if (liElement.classList.contains('outgoing')) {
      isMT = false;
    }
    let attachment = attachmentMap.get(target);
    if (!attachment) {
      return false;
    }

    attachment.view({
      allowSave: isMT,
      forEditing: false,
      inComing: isMT
    });

    return true;
  }

  // reduce the Composer.getContent() into slide format used by SMIL.generate some
  // day in the future, we should make the SMIL and Compose use the same format
  function thui_generateSmilSlides(slides, content) {
    let length = slides.length;
    if (typeof content === 'string') {
      if (!length || slides[length - 1].text) {
        slides.push({
          text: content
        });
      } else {
        slides[length - 1].text = content;
      }
    } else {
      slides.push({
        blob: content.blob,
        name: content.name
      });
    }
    return slides;
  }

  let ThreadUI = {
    CHUNK_SIZE: 5,
    IMAGE_RESIZE_DURATION: 3000,
    BANNER_DURATION: 2000,

    // Toast duration when you write a long text and need more than one SMS
    // to send it
    ANOTHER_SMS_TOAST_DURATION: 3000,

    // when sending an sms to several recipients in activity, we'll exit the
    // activity after this delay after moving to the thread list.
    LEAVE_ACTIVITY_DELAY: 3000,

    draft: null,
    recipients: null,
    // Set to |true| when in edit mode
    inEditMode: false,
    shouldChangePanelNextEvent: false,
    showErrorInFailedEvent: '',
    previousSegment: 0,
    scrollIndex: 0,
    // store the item when change focus or open option
    _storeFocused: null,
    currentMode: '',
    currentThreadId: null,
    optionMenuShown: false,
    contactPromptOptionMenuShown: false,
    currentSoftKey: null,
    optionMenu: null,
    focusableElement: null,
    backspaceTimer: null,
    EndKeySave: false,
    notFocus: false,
    addEmpty: false,
    isDownScroll: false,
    threadIdBackUp: null,

    // Decide whether the recipient be input manually.
    isManualInput: false,
    isDialing: false,
    isCall: false,
    activityContactName: '',
    isBackToThreadUI: false,
    isFirstEnterThreadUI: false,
    cancelRecoverFocus: false,

    timeouts: {
      update: null,
      subjectLengthNotice: null
    },

    FOCUS_INVALID: 0,
    FOCUS_ON_RECIPIENTS: 1,
    FOCUS_ON_SUBJECT: 2,
    FOCUS_ON_MESSAGE_INPUT: 3,
    FOCUS_ON_MESSAGE_THREAD: 4,
    FOCUS_ON_ATTACHMENT: 5,

    RECIPIENTS_INPUT_FIELD_MAX_ONE: 50,

    init: function thui_init() {
      let threadMessages = document.getElementById('thread-messages');
      if (threadMessages.innerHTML.length === 0) {
        let template = Template('thread-messages-view-tmpl');
        threadMessages.innerHTML = template.toString();
      }
      this.selector = {
        recipient: document.querySelector('#messages-recipients-list'),
        subject: document.querySelector('#subject-composer-input'),
        textField: document.querySelector('#messages-input')
      };
      this.messageInput = document.getElementById('messages-input');
      this.messageInput.dataset.placeholder = navigator.mozL10n.get(
          Utils.camelCase(this.messageInput.id) + '_placeholder'
      );
      this.subjectInput = document.getElementById('subject-composer-input');

      this.messagesComposeForm =
        document.getElementById('messages-compose-form');

      this.longPressBackUp = this.longPressEvent.bind(this);
      this.handleKeyBackUp = this.handleKeyEvent.bind(this);
      this.onFocusBackUp = this.onFocusChanged.bind(this);
      this.inputBackUp = this.handleInput.bind(this);

      let templateIds = [
        'message',
        'message-sim-information',
        'message-status',
        'not-downloaded',
        'recipient',
        'date-group',
        'header',
        'group-header'
      ];

      AttachmentMenu.init('attachment-options-menu');

      // Fields with 'messages' label
      [
        'container', 'to-field', 'recipients-list', 'compose-form', 'header',
        'edit-header', 'check-uncheck-all-button', 'contact-pick-button',
        'send-button', 'delete-button', 'call-number-button', 'options-button',
        'new-message-notice', 'edit-mode', 'edit-form', 'header-text',
        'max-length-notice', 'convert-notice', 'resize-notice',
        'subject-max-length-notice', 'sms-counter-notice',
        'recipient-suggestions'
      ].forEach((id) => {
        this[Utils.camelCase(id)] = document.getElementById('messages-' + id);
      });

      this.mainWrapper = document.getElementById('main-wrapper');
      this.threadMessages = document.getElementById('thread-messages');
      this.composerContainer = document.getElementById('composer-container');

      window.addEventListener('resize', this.resizeHandler.bind(this));

      // binding so that we can remove this listener later
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
      document.addEventListener('visibilitychange',
                                this.onVisibilityChange);

      this.messageInput.addEventListener(
        'focus', this.onMessageInputFocusChange.bind(this)
      );

      this.messageInput.addEventListener(
        'blur', this.onMessageInputFocusChange.bind(this)
      );

      this.subjectInput.addEventListener(
        'focus', this.onMessageSubjectFocusChange.bind(this)
      );

      this.subjectInput.addEventListener(
        'blur', this.onMessageSubjectFocusChange.bind(this)
      );

      this.toField.addEventListener(
        'input', this.toFieldInput.bind(this), true
      );

      this.toField.addEventListener(
        'focus', this.toFieldInput.bind(this), true
      );

      this.sendButton.addEventListener(
        'click', this.onSendClick.bind(this)
      );

      this.container.addEventListener(
        'scroll', this.manageScroll.bind(this)
      );

      this.editHeader.addEventListener(
        'action', this.cancelEdit.bind(this)
      );

      this.headerText.addEventListener(
        'click', this.onHeaderActivation.bind(this)
      );

      // These events will be handled in handleEvent function
      this.container.addEventListener('click', this);
      this.container.addEventListener('contextmenu', this);
      this.editForm.addEventListener('submit', this);
      this.composeForm.addEventListener('submit', this);

      navigator.mozContacts.addEventListener(
        'contactchange',
        this.updateHeaderData.bind(this)
      );

      this.recipientSuggestions.addEventListener(
        'click',
        this.onRecipientSuggestionClick.bind(this)
      );

      MessageManager.on('message-sending', this.onMessageSending.bind(this));
      MessageManager.on('message-sent', this.onMessageSent.bind(this));
      MessageManager.on('message-received', this.onMessageReceived.bind(this));
      MessageManager.on(
        'message-failed-to-send',
        this.onMessageFailed.bind(this)
      );
      MessageManager.on('message-delivered', this.onDeliverySuccess.bind(this));
      MessageManager.on('message-read', this.onReadSuccess.bind(this));
      MessageManager.on('custom-message', this.onCustomMessageSent.bind(this));

      this.tmpl = templateIds.reduce(function(tmpls, name) {
        tmpls[Utils.camelCase(name)] =
          Template('messages-' + name + '-tmpl');
        return tmpls;
      }, {});

      Compose.init('messages-compose-form');

      // In case of input, we have to resize the input following UX Specs.
      Compose.on('input', this.messageComposerInputHandler.bind(this));
      Compose.on('subject-change', this.onSubjectChange.bind(this));
      Compose.on('segmentinfochange', this.onSegmentInfoChange.bind(this));

      // Assimilations
      // -------------------------------------------------
      // If the user manually types a recipient number
      // into the recipients list and does not "accept" it
      // via <ENTER> or ";", but proceeds to either
      // the message or attachment options, attempt to
      // gather those stranded recipients and assimilate them.
      //
      // Previously, an approach using the "blur" event on
      // the Recipients' "messages-to-field" element was used,
      // however the to-field will frequently lose "focus"
      // to any of its recipient children. If we assimilate on
      // to-field blur, the result is entirely unusable:
      //
      //  1. Focus will jump from the recipient input to the
      //      message input
      //  2. 1 or 2 characters may remain in the recipient
      //      editable, which will be "assimilated"
      //  3. If a user has made it past 1 & 2, any attempts to
      //      select a contact from contact search results
      //      will also jump focus to the message input field
      //
      // So we assimilate recipients if user starts to interact with Composer
      Compose.on('interact', this.assimilateRecipients.bind(this));

      this.container.addEventListener(
        'click', this.assimilateRecipients.bind(this)
      );

      this.timeouts.update = null;

      this.shouldChangePanelNextEvent = false;

      this.showErrorInFailedEvent = '';

      // Bound methods to be detachables
      this.onMessageTypeChange = this.onMessageTypeChange.bind(this);
    },

    onMessageInputFocusChange: function thui_onMessageInputFocusChange(e) {
      this.messagesComposeForm.classList.toggle(
          'item-focus', e.type === 'focus');
    },

    onMessageSubjectFocusChange: function thui_onMessageSubjectFocusChange(e) {
      this.messagesComposeForm.classList.toggle(
          'subject-focus', e.type === 'focus');
    },

    onVisibilityChange: function thui_onVisibilityChange() {
      // If we leave the app and are in a thread or compose window
      // save a message draft if necessary
      if (document.hidden) {
        // Auto-save draft if the user has entered anything
        // in the composer or into To field (for composer panel only).
        let isAutoSaveRequired = false;

        if (Navigation.isCurrentPanel('thread') && !this.isCall) {
          isAutoSaveRequired = !Compose.isEmpty();
        }

        if (isAutoSaveRequired) {
          this.saveDraft({ preserve: true, autoSave: true });
        }
      } else {
        let confirmDraftElem = document.querySelector('#gaia-confirm');
        if (!confirmDraftElem) {
          this.recoveryFocus();
        }
      }
    },

    // Recovery the focus when the page switch or node change.
    recoveryFocus: function thui_recoveryFocus() {
      let toFocus = document.querySelector('.focus');
      if (toFocus) {
        toFocus.focus();
      }
    },

    /**
     * We always go back to the previous pane, unless we're in an activity, then
     * in selected cases we exit the activity.
     *
     * @private
     */
    backOrClose: function thui_backOrClose() {
      let inActivity = ActivityHandler.isInActivity();
      let isComposer = Navigation.isCurrentPanel('composer');
      let isThread = Navigation.isCurrentPanel('thread');
      let action = inActivity && (isComposer || isThread) ? 'close' : 'back';
      this[action]();
    },

    // Initialize Recipients list and Recipients.View (DOM)
    initRecipients: function thui_initRecipients() {
      let recipientsChanged = ((length, record) => {
        if (this.draft) {
          this.draft.isEdited = true;
        }
        let isOk = true;
        let strategy;

        if (record && (record.isQuestionable || record.isLookupable)) {
          if (record.isQuestionable) {
            isOk = false;
          }

          strategy = record.isLookupable ? 'searchContact' : 'exactContact';

          this[strategy](
            record.number, this.validateContact.bind(this, record)
          );
        }

        // Clean search result after recipient count change.
        this.toggleRecipientSuggestions();

        // The isOk flag will prevent "questionable" recipient entries from
        //
        //    - Updating the header
        //    - Enabling send.
        //
        //  Ideally, the contact will be found by the
        //  searchContact + validateContact operation and the
        //  handler will be re-called with a known
        //  and valid recipient from the user's contacts.
        if (isOk) {
          this.updateComposerHeader();

          this.emit('recipientschange');
        }
      });

      if (this.recipients) {
        this.recipients.length = 0;
        this.recipients.visible('singleline');
        this.recipients.focus();
      } else {
        this.recipients = new Recipients({
          outer: 'messages-to-field',
          inner: 'messages-recipients-list',
          template: this.tmpl.recipient
        });

        this.recipients.on('add', recipientsChanged);
        this.recipients.on('remove', recipientsChanged);
        this.recipients.on('modechange', (mode) => {
          this.threadMessages.classList.toggle(
            'multiline-recipients-mode',
             mode === 'multiline-mode'
          );
        });
      }
      this.hideToFieldHolder(false);
      this.toggleRecipientSuggestions();
    },

    initSentAudio: function thui_initSentAudio() {
      if (this.sentAudio) {
        return;
      }

      this.sentAudio = new Audio();
      this.sentAudio.preload = 'none';
      this.sentAudio.src = '/sounds/SMS Message sent_MA.ogg';
      this.sentAudio.mozAudioChannelType = 'notification';

      // TODO move sentAudioEnabled management to Settings
      this.sentAudioKey = 'message.sent-sound.enabled';
      this.sentAudioEnabled = false;

      try {
        Utils.getSettingsValue(this.sentAudioKey).then((value) => {
          this.sentAudioEnabled = value;
        });

        Utils.observerSettingsValue(this.sentAudioKey, (value) => {
          this.sentAudioEnabled = value;
        });
      } catch (e) {
        this.sentAudioEnabled = false;
      }
    },

    getAllInputs: function thui_getAllInputs() {
      if (this.container) {
        return Array.prototype.slice.call(
          this.container.querySelectorAll('input[type=checkbox]')
        );
      } else {
        return [];
      }
    },

    setHeaderAction: function thui_setHeaderAction(icon) {
      this.header.setAttribute('action', icon);
    },

    adjustScrollElement: function thui_adjustScrollElement() {
      if (Navigation.isCurrentPanel('thread') ||
          Navigation.isCurrentPanel('composer')) {
        let items = Navigation.isCurrentPanel('thread') ?
          document.querySelectorAll('ul.message-list li') :
          document.querySelectorAll('#messages-input br');
        let lastElement = items.item(items.length - 1);
        lastElement.scrollIntoView(false);
      }
    },

    messageComposerInputHandler: function thui_messageInputHandler() {
      if (Compose.type === 'sms') {
        this.hideMaxLengthNotice();
        this.adjustScrollElement();
        return;
      }

      if (Compose.isResizing) {
        this.resizeNotice.classList.remove('hide');

        if (this._resizeNoticeTimeout) {
          clearTimeout(this._resizeNoticeTimeout);
          this._resizeNoticeTimeout = null;
        }
      } else {
        if (this.resizeNotice.classList.contains('hide') ||
            this._resizeNoticeTimeout) {
          return;
        }

        this._resizeNoticeTimeout = setTimeout(function hideResizeNotice() {
          this.resizeNotice.classList.add('hide');
          this._resizeNoticeTimeout = null;
        }.bind(this), this.IMAGE_RESIZE_DURATION);
      }
    },

    showMaxLengthNotice: function thui_showMaxLengthNotice(opts) {
      Compose.lock();
      navigator.mozL10n.setAttributes(
        this.maxLengthNotice.querySelector('p'), opts.l10nId, opts.l10nArgs
      );
      this.maxLengthNotice.classList.remove('hide');
    },

    hideMaxLengthNotice: function thui_hideMaxLengthNotice() {
      Compose.unlock();
      this.maxLengthNotice.classList.add('hide');
    },

    showSubjectMaxLengthNotice: function thui_showSubjectMaxLengthNotice() {
      this.subjectMaxLengthNotice.classList.remove('hide');

      if (this.timeouts.subjectLengthNotice) {
        clearTimeout(this.timeouts.subjectLengthNotice);
      }
      this.timeouts.subjectLengthNotice = setTimeout(
        this.hideSubjectMaxLengthNotice.bind(this),
        this.BANNER_DURATION
      );
    },

    hideSubjectMaxLengthNotice: function thui_hideSubjectMaxLengthNotice() {
      this.subjectMaxLengthNotice.classList.add('hide');
      this.timeouts.subjectLengthNotice &&
        clearTimeout(this.timeouts.subjectLengthNotice);
    },

    addAllEventListener: function() {
      window.addEventListener('backspace-long-press', this.longPressBackUp);
      window.addEventListener(
        'backspace-long-press-div', this.longPressBackUp);
      window.addEventListener('keydown', this.handleKeyBackUp);
      window.addEventListener('message-focusChanged', this.onFocusBackUp);
      window.addEventListener('gaia-confirm-close', this.onFocusBackUp);
      window.addEventListener(
        'gaia-confirm-start-close', Utils.onDialogBeginClose);
      this.selector.subject.addEventListener(
        'keydown', this.disableInputEnter);
      document.querySelector('#subject-composer-input').addEventListener(
        'input', this.onFocusBackUp);
      document.querySelector('#messages-input').addEventListener(
        'keydown', this.inputBackUp);
    },

    removeAllEventListener: function() {
      window.removeEventListener('backspace-long-press', this.longPressBackUp);
      window.removeEventListener(
        'backspace-long-press-div', this.longPressBackUp);
      window.removeEventListener('keydown', this.handleKeyBackUp);
      window.removeEventListener('message-focusChanged', this.onFocusBackUp);
      window.removeEventListener('gaia-confirm-close', this.onFocusBackUp);
      window.removeEventListener(
        'gaia-confirm-start-close', Utils.onDialogBeginClose);
      this.selector.subject.removeEventListener(
        'keydown', this.disableInputEnter);
      document.querySelector('#subject-composer-input').removeEventListener(
        'input', this.onFocusBackUp);
      document.querySelector('#messages-input').removeEventListener(
        'keydown', this.inputBackUp);
    },

    /*
     * This function will be called before we slide to the thread or composer
     * panel. This way it can change things in the panel before the panel is
     * visible.
     */
    beforeEnter: function thui_beforeEnter(args) {
      this.clearConvertNoticeBanners();

      Recipients.View.isFocusable = true;
      this.initSentAudio();

      this.observeFocusChange_new();

      // XXX, workaround to fix a readout that will read placeholder in
      // message input when first enter Message. Set message input to hide,
      // and lter when enter thread ui, show it. We should check why placeholder
      // will be read later.
      this.messageInput.classList.remove('hide');

      this.currentMode = args.meta.next.panel;
      if (exports.option) {
        exports.option.hide();
      }
      switch (this.currentMode) {
        case 'composer':
          return this.beforeEnterComposer(args);
        case 'thread':
          return this.beforeEnterThread(args);
        default:
          console.error(
            'preEnter was called with an unexpected panel name:',
            this.currentMode
          );
          return Promise.reject();
      }
    },

    beforeEnterThread: function thui_beforeEnterThread(args) {
      // TODO should we implement hooks to Navigation so that Threads could
      // get an event whenever the panel changes?
      Threads.currentId = args.id;
      this.messageIdFromNotice = args.messageId;

      let prevPanel = args.meta.prev && args.meta.prev.panel;
      if (prevPanel !== 'group-view' && prevPanel !== 'report-view') {
        this.initializeRendering();
      }

      // Need provide the open event data to event_log_data module.
      if (prevPanel === 'thread-list' &&
          Threads.active.lastMessageType === 'sms') {
        Utils.sendEventLogs(Threads.active.participants, 'sms_open');
      }

      // Reset the recipient field.
      const recipientsNode = this.recipientsList.querySelector('.navigable');
      if (recipientsNode) {
        recipientsNode.classList.remove('navigable');
      }

      return this.updateHeaderData();
    },

    afterEnter: function thui_afterEnter(args) {
      let next = args.meta.next.panel;
      this.EndKeySave = false;
      this.isManualInput = false;
      switch (next) {
        case 'composer':
          return this.afterEnterComposer(args);
        case 'thread':
          let prev = args.meta.prev;
          if (prev && prev.panel === "report-view") {
            this.updateSKs();
          }
          return this.afterEnterThread(args);
        default:
          console.error(
            'afterEnter was called with an unexpected panel name:',
            next
          );
          return Promise.reject();
      }
    },

    afterEnterComposer: function thui_afterEnterComposer(args) {
      // TODO Bug 1010223: should move to beforeEnter
      const TIMEOUTAFTERENTER = 400;
      this.isManualInput = true;
      if (args.activity) {
        this.handleActivity(args.activity);
        NavigationMap.reset('thread-messages');

        setTimeout(() => {
          let index = this.getItemIndex(
            NavigationMap.getCurrentControl().elements, 'messages-input');
          NavigationMap.setFocus(index);
        }, TIMEOUTAFTERENTER);
      } else if (args.forward) {
        this.handleForward(args.forward);
        NavigationMap.reset('thread-messages');
        setTimeout(() => {
          NavigationMap.setFocus(0);
        }, TIMEOUTAFTERENTER);
      } else if (this.draft || args.draftId || Threads.currentId) {
        // It would be nice to revisit these conditions in Bug 1010216.
        this.handleDraft(+args.draftId);
        NavigationMap.reset('thread-messages');
        setTimeout(() => {
          let index = this.getItemIndex(
              NavigationMap.getCurrentControl().elements, 'messages-input');
          NavigationMap.setFocus(index);
        }, TIMEOUTAFTERENTER);
      } else {
        this.recipients.focus();
        NavigationMap.reset('thread-messages');
        setTimeout(() => {
          if (window.performance.getEntriesByName(
              'new-message-start', 'mark').length > 0) {
            window.performance.mark('new-message-end');
            window.performance.measure('performance-new-message',
              'new-message-start', 'new-message-end');
            window.performance.clearMarks('new-message-start');
            window.performance.clearMarks('new-message-end');
          }
          NavigationMap.setFocus(0);
        }, TIMEOUTAFTERENTER);
      }
      this.updateSKs(threadUiAddContact);

      this.enableConvertNoticeBanners();
      // not strictly necessary but better for consistency
      return Promise.resolve();
    },

    afterEnterThread: function thui_afterEnterThread(args) {
      let threadId = +args.id;
      this.currentThreadId = threadId;

      let prevPanel = args.meta.prev && args.meta.prev.panel;

      if (args.body) {
        this.messageInput.textContent = args.body;
        this.messageInput.setAttribute('data-placeholder', '');
        Compose.handlerContentChanged();
      }

      if (prevPanel !== 'group-view' && prevPanel !== 'report-view') {
        this.renderMessages(threadId);

        // Populate draft if there is one
        // TODO merge with handleDraft ? Bug 1010216
        // Need force update the draft after enter thread.
        Drafts.request(true).then(() => {
          let thread = Threads.get(threadId);
          if (thread.hasDrafts) {
            this.isFirstEnterThreadUI = true;
            this.draft = thread.drafts.latest;
            Compose.fromDraft(this.draft);
            this.draft.isEdited = false;
          } else {
            this.draft = null;
          }
          this.enableConvertNoticeBanners();
        });
      }

      // Let's mark thread only when thread list is fully rendered and target node
      // is in the DOM tree.
      ThreadListUI.whenReady().then(() => {
        ThreadListUI.mark(threadId, 'read');
        // We need update the thread backup data when enter in thread.
        let threadData = Threads.get(threadId);
        if (threadData) {
          threadData.unreadCount = 0;
          Threads.set(threadId, threadData);
        }

        // We use setTimeout (macrotask) here to allow reflow happen as soon as
        // possible and to not interrupt it with non-critical task since Promise
        // callback only (microtask) won't help here.
        setTimeout(() => MessageManager.markThreadRead(threadId));
        this.onFocusChanged();
      });

      return Utils.closeNotificationsForThread(threadId);
    },

    beforeLeave: function thui_beforeLeave(args) {
      this.stopContactNavigation();
      this.disableConvertNoticeBanners();

      let nextPanel = args.meta.next && args.meta.next.panel;

      // This should be in afterLeave, but the edit mode interface does not seem
      // to slide correctly. Bug 1009541
      this.cancelEdit();

      if (Navigation.isCurrentPanel('thread')) {
        // Revoke thumbnail URL for every image attachment rendered within thread
        let nodes = this.container.querySelectorAll(
          '.attachment-container[data-thumbnail]'
        );
        Array.from(nodes).forEach((node) => {
          window.URL.revokeObjectURL(node.dataset.thumbnail);
        });
      }

      // TODO move most of back() here: Bug 1010223
      if (nextPanel !== 'group-view' && nextPanel !== 'report-view') {
        if (nextPanel === 'thread-list') {
          ThreadListUI.isToThreadList = true;
        }
        this.cleanFields();
      }
      this.hideToFieldHolder(true);

      if (nextPanel !== 'report-view') {
        exports.option.hide();
      }
    },

    afterLeave: function thui_afterLeave(args) {
      Compose._removeSubjectFocusable();
      if (Navigation.isCurrentPanel('thread-list')) {
        this.container.textContent = '';
        this.cleanFields();
        Threads.currentId = null;
      }
      if (!Navigation.isCurrentPanel('composer')) {
        this.threadMessages.classList.remove('new');

        if (this.recipients) {
          this.recipients.length = 0;
        }

        this.toggleRecipientSuggestions();
      }
    },

    hideToFieldHolder: function(hide) {
      let placeHolder = document.querySelector('.recipient.navigable');
      if (placeHolder) {
        placeHolder.hidden = hide;
      }
    },

    handleForward: function thui_handleForward(forward) {
      let request = MessageManager.getMessage(+forward.messageId);

      request.onsuccess = (() => {
        Compose.fromMessage(request.result);

        Recipients.View.isFocusable = true;
        this.recipients.focus();
      });

      request.onerror = () => {
        console.error('Error while forwarding:', this.error.name);
      };
    },

    handleActivity: function thui_handleActivity(activity) {
      /**
       * Choose the appropriate contact resolver:
       *  - if we have a phone number and no contact, rely on findByAddress
       *    to get a contact matching the number;
       *  - if we have a contact object and no phone number, just use a dummy
       *    source that returns the contact.
       */
      let findByAddress = Contacts.findByAddress.bind(Contacts);
      let number = activity.number;
      if (activity.contact && !number) {
        findByAddress = function dummySource(contact, cb) {
          cb(activity.contact);
        };
        number = activity.contact.number || activity.contact.tel[0].value;
      }

      // Add recipients and fill+focus the Compose area.
      if (activity.contact && number) {
        this.activityContactName = activity.contact.name;
        Utils.getContactDisplayInfo(
          findByAddress, number, (data) => {
            data.source = 'contacts';
            this.recipients.add(data);
            Compose.fromMessage(activity);
            setTimeout(() => {
              // Need set focus again because the contact find interface need time.
              let index = this.getItemIndex(
                NavigationMap.getCurrentControl().elements, 'messages-input');
              NavigationMap.setFocus(index);
            });
          }
        );
      } else {
        if (number) {
          // If the activity delivered the number of an unknown recipient,
          // create a recipient directly.
          this.recipients.add({
            number: number,
            source: 'manual'
          });
        }
        Compose.fromMessage(activity);
      }


      if (number) {
        document.activeElement.blur();
        setTimeout(function () {
          Compose.focus();
        });
      } else {
        this.recipients.focus();
      }
    },

    // recalling draft for composer only
    // Bug 1010216 might use it for thread drafts too
    handleDraft: function thui_handleDraft(threadId) {
      // TODO Bug 1010216: remove this.draft
      let draft = this.draft || Drafts.get(threadId || Threads.currentId);

      // Draft recipients are added as the composer launches
      if (draft) {
        // Recipients will exist for draft messages in threads
        // Otherwise find them from draft recipient numbers
        draft.recipients.forEach((number) => {
          Contacts.findByAddress(number, (records) => {
            if (records && records.length) {
              this.recipients.add(
                Utils.basicContact(number, records[0]), true
              );
            } else {
              this.recipients.add({
                number: number
              }, true);
            }
          });
        });

        // Render draft contents into the composer input area.
        Compose.fromDraft(draft);

        // Discard this draft object and update the backing store
        Drafts.delete(draft).store();
        if (Settings.mmsEnable) {
          this.updateSKs(threadUiComposerOptions);
        } else {
          this.updateSKs(threadUiComposerOptions_noMMS);
        }
      } else {
        this.recipients.focus();
        this.updateSKs(threadUiAddContact);
      }

      if (this.draft) {
        this.draft.isEdited = false;
      }

      if (draft.isGroup) {
        Settings.isGroup = true;
        Compose.updateType();
      }
    },

    beforeEnterComposer: function thui_beforeEnterComposer(args) {
      // TODO add the activity/forward/draft stuff here
      // instead of in afterEnter: Bug 1010223

      Threads.currentId = (args.id && args.keyword !== 'forward') ? args.id : null;
      if (args.keyword) {
        Threads.keyword = args.keyword;
      }
      this.cleanFields();

      const childElement = this.recipientsList.lastChild;
      if (childElement.tagName) {
        childElement.classList.add('navigable');
      }
      
      this.initRecipients();
      this.updateComposerHeader();
      this.container.textContent = '';
      this.threadMessages.classList.add('new');

      // not strictly necessary but being consistent
      return Promise.resolve();
    },

    assimilateRecipients: function thui_assimilateRecipients(args) {
      let isNew = Navigation.isCurrentPanel('composer');
      let node = this.recipientsList.lastChild;
      let typed;

      if (!isNew || node === null) {
        return;
      }

      // Ensure that Recipients does not trigger focus
      // on itself, which will cause the cursor to "jump"
      // back to the recipients input from the message input.
      Recipients.View.isFocusable = false;

      // Restore the recipients list input area to
      // single line view.
      this.recipients.visible('singleline');

      do {
        if (node.isPlaceholder) {
          typed = node.textContent.trim();

          // Clicking on the compose input will trigger
          // an assimilation. If the recipient input
          // is a lone semi-colon:
          //
          //  1. Clear the contents of the editable placeholder
          //  2. Do not assimilate the value.
          //
          if (typed === ';') {
            node.textContent = '';
            break;
          }

          // If the user actually typed something,
          // assume it's a manually entered recipient.
          // Push a recipient into the recipients
          // list with the left behind entry.
          if (typeof args === 'string') {
            if (args === 'false') {
              node.textContent = '';
            }
            break;
          }
          if (typed) {
            this.recipients.add({
              name: typed,
              number: typed,
              source: 'manual'
            });

            break;
          }
        }
      } while ((node = node.previousSibling));
    },

    // Function for handling when a new message (sent/received)
    // is detected
    onMessage: function onMessage(message) {
      // Update the stored thread data
      Threads.set(message.threadId, Thread.create(message));

      this.appendMessage(message);
      TimeHeaders.updateAll('header[data-time-update]');

      if (window.performance.getEntriesByName(
          'SMS-existSend-start', 'mark').length > 0) {
        window.performance.mark('SMS-existSend-end');
        window.performance.measure('performance-SMS-existSend',
          'SMS-existSend-start', 'SMS-existSend-end');
        window.performance.clearMarks('SMS-existSend-start');
        window.performance.clearMarks('SMS-existSend-end');
      }
    },

    isCurrentThread: function thui_isCurrentThread(threadId) {
      return Navigation.isCurrentPanel('thread', { id: threadId }) ||
             Navigation.isCurrentPanel('report-view', { threadId: threadId }) ||
             Navigation.isCurrentPanel('group-view', { id: threadId });
    },

    onMessageReceived: function thui_onMessageReceived(e) {
      let message = e.message;

      // If user currently in other thread then there is nothing to do here
      if (!this.isCurrentThread(message.threadId)) {
        // When group message flow appear, there is a situation that
        // not download message in A thread and download message in B,
        // we need back to thread list if A only one not download message.
        setTimeout(() => {
          if (this.container.childNodes.length === 0 &&
              Navigation.isCurrentPanel('thread') && message.isGroup) {
            Navigation.toPanel('thread-list');
          }
        });

        return;
      }

      MessageManager.markMessagesRead([message.id]);

      this.onMessage(message);
      this.scrollViewToBottom();
      NavigationMap.setFocusToFixedElement('messages-input');
    },

    onMessageSending: function thui_onMessageReceived(e) {
      let message = e.message;
      if (this.isCurrentThread(message.threadId)) {
        this.onMessage(message);
        this.forceScrollViewToBottom();
      } else {
        if (this.shouldChangePanelNextEvent) {
          Navigation.toPanel('thread', { id: message.threadId });
          this.shouldChangePanelNextEvent = false;
        }
      }
      Compose.focus();

      this.dynamicSK();
    },

    /**
     * Fires once user clicks on any recipient in the suggestions list.
     */
    onRecipientSuggestionClick: function(event) {
      event.stopPropagation();
      event.preventDefault();

      // Since the "dataset" DOMStringMap property is essentially
      // just an object of properties that exactly match the properties
      // used for recipients, push the whole dataset object into
      // the current recipients list as a new entry.
      this.recipients.add(event.target.dataset).focus();
      let index = this.getItemIndex(
        NavigationMap.getCurrentControl().elements, 'lastRecipient');
      NavigationMap.setFocus(index);
    },

    // Message composer type changed:
    onMessageTypeChange: function thui_onMessageTypeChange() {
      let messageUpperType = Compose.type + '-label';
      let tranlationType = navigator.mozL10n.get(messageUpperType);
      Toaster.showToast({
        messageL10nId: 'message-converted-to-toast',
        messageL10nArgs: { 'type': tranlationType },
      });

      this.showGroupAlert();
    },

    showGroupAlert: function thui_showGroupAlert() {
      let recipientMembers;
      if (Navigation.isCurrentPanel('composer')) {
        recipientMembers = this.recipients.numbers;
      } else {
        recipientMembers = Threads.active.participants;
      }

      if (Compose.type === 'mms' && recipientMembers.length > 1 &&
          Startup.hasGroup && Settings.groupSwitchEnabled &&
          !Settings.notShownGroup) {
        Utils.groupMessageAlert();
      }
    },

    clearConvertNoticeBanners: function thui_clearConvertNoticeBanner() {
      this.convertNotice.classList.add('hide');
    },

    enableConvertNoticeBanners: function thui_enableConvertNoticeBanner() {
      Compose.on('type', this.onMessageTypeChange);
    },

    disableConvertNoticeBanners: function thui_disableConvertNoticeBanner() {
      Compose.off('type', this.onMessageTypeChange);
    },

    onSubjectChange: function thui_onSubjectChange() {
      if (Compose.isSubjectVisible && Compose.isSubjectMaxLength()) {
        this.showSubjectMaxLengthNotice();
      } else {
        this.hideSubjectMaxLengthNotice();
      }
    },

    // Triggered when the onscreen keyboard appears/disappears.
    resizeHandler: function thui_resizeHandler() {
      // Scroll to bottom
      this.scrollViewToBottom();
      // Make sure the caret in the "Compose" area is visible
      Compose.scrollMessageContent();
    },

    // Create a recipient from contacts activity.
    requestContact: function thui_requestContact() {
      if (typeof MozActivity === 'undefined') {
        console.log('MozActivity unavailable');
        return;
      }

      // Ensure that Recipients does not trigger focus on
      // itself, which causes the keyboard to appear.
      Recipients.View.isFocusable = false;
      let contactProperties = ['tel'];

      if (Settings.supportEmailRecipient) {
        contactProperties.push('email');
      }

      let activity = new MozActivity({
        name: 'pick',
        data: {
          type: 'webcontacts/select',
          contactProperties: contactProperties
        }
      });

      activity.onsuccess = (() => {
        if (!activity.result ||
            !activity.result.selectedValues ||
            !activity.result.selectedValues.length ||
            !activity.result.selectedValues[0].value) {
          console.error('The pick activity result is invalid.');
          return;
        }

        Recipients.View.isFocusable = true;

        let data = Utils.basicContact(
          activity.result.selectedValues[0].value, activity.result.contact
        );
        data.source = 'contacts';

        if (this.recipients.numbers.indexOf(
            activity.result.selectedValues[0].value) !== -1) {
          Toaster.showToast({
            messageL10nId: 'recipient-repeat',
          });
          return;
        }
        this.recipients.add(data);
      });

      activity.onerror = ((e) => {
        setTimeout(() => {
          Recipients.View.isFocusable = true;
          this.recipients.focus();
        }, 300);
        console.log('WebActivities unavailable? : ' + e);
      });
    },

    // Method for updating the header when needed
    updateComposerHeader: function thui_updateComposerHeader() {
      this.setHeaderContent('newMessage');
    },

    // We define an edge for showing the following chunk of elements
    manageScroll: function thui_manageScroll() {
      if (this.isDownScroll) {
        this.isDownScroll = false;
        return;
      }
      let scrollTop = this.container.scrollTop;
      let scrollHeight = this.container.scrollHeight;

      // kEdge will be the limit (in pixels) for showing the next chunk
      let kEdge = 30;
      if (scrollTop < kEdge) {
        this.showChunkOfMessages(this.CHUNK_SIZE);
        // We update the scroll to the previous position
        // taking into account the previous offset to top
        // and the current height due to we have added a new
        // chunk of visible messages
        this.container.scrollTop =
          (this.container.scrollHeight - scrollHeight) + scrollTop;
      }
    },

    scrollViewToBottom: function thui_scrollViewToBottom() {
      if (this.container.lastElementChild &&
          Navigation.isCurrentPanel('thread')) {
        this.container.lastElementChild.scrollIntoView(false);
      }
    },

    forceScrollViewToBottom: function thui_forceScrollViewToBottom() {
      this.scrollViewToBottom();
    },

    close: function thui_close() {
      return this._onNavigatingBack().then(() => {
        this.cleanFields();
        ActivityHandler.leaveActivity();
      }).catch(function(e) {
        // If we don't have any error that means that action was rejected
        // intentionally and there is nothing critical to report about.
        e && console.error('Unexpected error while closing the activity: ', e);

        return Promise.reject(e);
      });
    },

    back: function thui_back(close) {
      if (AttachmentMessageUI.isAttachmentPage) {
        return;
      }

      if (Navigation.isCurrentPanel('group-view') ||
          Navigation.isCurrentPanel('report-view')) {
        Navigation.toPanel('thread', { id: Threads.currentId });
        this.updateHeaderData();

        return Promise.resolve();
      }

      return this._onNavigatingBack(close).then(() => {
        if (ActivityHandler.isInActivity() && !ActivityHandler._lastMessage) {
          ActivityHandler.leaveActivity();
          this.removeAllEventListener();
        } else {
          if (close) {
            MessageCache.clear('threads-container');
            window.close();
          } else {
            let focus = document.querySelector('.focus');
            focus && focus.classList.remove('focus');
            Settings.isGroup = false;
            this.removeAllEventListener();
            Navigation.toPanel('thread-list');
            this.composerContainer.classList.remove('next-focus');
            if (Threads.currentId) {
              NavigationMap.updateCurIndex('thread-list',
                                           'thread-' + Threads.currentId);
            } else {
              if (ThreadListUI.currentThread) {
                NavigationMap.updateCurIndex('thread-list', ThreadListUI.currentThread.id);
              }
            }
          }
        }
      }, (element) => {
        // At composer, reject only appear at recipients focus.
        if (Navigation.isCurrentPanel('composer') &&
            element.tagName === 'DIV' && element.id !== 'messages-input') {
          Recipients.View.isFocusable = true;
          this.recipients.focus();
        }
      }).catch((e) => {
        e && console.error('Unexpected error while navigating back: ', e);

        return Promise.reject(e);
      });
    },

    _onNavigatingBack: function(close) {
      this.stopRendering();

      // We're waiting for the keyboard to disappear before animating back
      return this._ensureKeyboardIsHidden().then(() => {
        // Need to assimilate recipients in order to check if any entered
        this.assimilateRecipients('true');

        // If we're leaving a thread's message view,
        // ensure that the thread object's unreadCount
        // value is current (set = 0)
        if (Threads.active) {
          Threads.active.unreadCount = 0;
        }

        // If the composer is empty, we
        // do not prompt to save a draft and discard drafts
        // as the user deleted them manually
        if (Compose.isEmpty()) {
          this.discardDraft(true);
          let node = this.recipientsList.lastChild;
          node.textContent = '';
          if (node.classList && node.classList.contains('focus')) {
            node.classList.remove('focus');
          }
          return;
        }

        // If there is a draft and the content and recipients
        // never got edited, re-save if threadless,
        // then leave without prompting to replace
        if (this.draft && !this.draft.isEdited) {
          // Thread-less drafts are orphaned at this point
          // so they need to be resaved for persistence
          // Otherwise, clear the draft directly before leaving
          if (!Threads.currentId) {
            this.saveDraft({ autoSave: true });
          } else {
            this.draft = null;
          }
          return;
        }

        return this._showMessageSaveOrDiscardPrompt(close);
      });
    },

    isKeyboardDisplayed: function thui_isKeyboardDisplayed() {
      /* XXX: Detect if the keyboard is visible. The keyboard minimal height is
       * 150px; when in reduced attention screen mode however the difference
       * between window height and the screen height will be larger than 150px
       * thus correctly yielding false here. */
      return ((window.screen.height - window.innerHeight) > 150);
    },

    _ensureKeyboardIsHidden: function() {
      if (this.isKeyboardDisplayed()) {
        return new Promise(function(resolve) {
          let setTimer = window.setTimeout(resolve, 400);
          window.addEventListener('resize', function keyboardHidden() {
            window.clearTimeout(setTimer);
            window.removeEventListener('resize', keyboardHidden);
            resolve();
          });
        });
      }
      return Promise.resolve();
    },

    _showMessageSaveOrDiscardPrompt: function(close) {
      if (option.menuVisible && close) {
        option.menu.hide();
      }
      let focusBackUp = document.querySelector('.focus');

      return new Promise((resolve, reject) => {
        function cancelCallback() {
          reject(focusBackUp);
        }
        function acceptCallback() {
          ThreadUI.saveDraft({ keyFlag: 'saveDraft', keyPress: 'back' }, () => {
            resolve();
          });
        }
        function confirmCallback() {
          ThreadUI.assimilateRecipients('false');
          ThreadUI.discardDraft();
          resolve();
        }
        Utils.confirmAlert('confirmation-title', 'draft-save-content', 'cancel',
                           cancelCallback, 'save-as-draft', acceptCallback,
                           'discard-message', confirmCallback, cancelCallback);
      });
    },

    onSegmentInfoChange: function thui_onSegmentInfoChange() {
      let currentSegment = Compose.segmentInfo.segments;

      let isValidSegment = currentSegment > 0;
      let isSegmentChanged = this.previousSegment !== currentSegment;
      let isStartingFirstSegment = this.previousSegment === 0 &&
                                   currentSegment === 1;

      if (Compose.type === 'sms' && isValidSegment &&
          isSegmentChanged && !isStartingFirstSegment) {
        this.previousSegment = currentSegment;

        navigator.mozL10n.setAttributes(
          this.smsCounterNotice.querySelector('p'),
          'sms-counter-notice-label',
          { number: currentSegment }
        );
        this.smsCounterNotice.classList.remove('hide');
        window.setTimeout(function() {
          this.smsCounterNotice.classList.add('hide');
        }.bind(this), this.ANOTHER_SMS_TOAST_DURATION);
      }
    },

    checkMessageSize: function thui_checkMessageSize() {
      // Counter should be updated when image resizing complete
      if (Compose.isResizing || Compose.isReplaceFlag) {
        return false;
      }

      function removeAttach() {
        let allAttachments = document.getElementById('attachmentList').querySelectorAll('iframe');
        let focusEle = allAttachments[allAttachments.length - 1];

        Compose.removeAttachment(focusEle, () => {
          AttachmentMessageUI.updateAttachmentList();
          Compose.updateAttachmentAbstract();
          AttachmentMessageUI.updateOptionsBackUp();
        });
      }

      if (Settings.mmsSizeLimitation) {
        if (Compose.size > Settings.mmsSizeLimitation) {
          Utils.confirmAlert('attention',
            {
              id: 'multimedia-message-exceeded-max-length',
              args: {
                mmsSize: (Settings.mmsSizeLimitation / 1024 / 1024).toFixed(2)
              }
            },
            null, null, 'ok', removeAttach, null, null, removeAttach);
          return false;
        } else if (Compose.size === Settings.mmsSizeLimitation) {
          this.showMaxLengthNotice({ l10nId: 'messages-max-length-text' });
          return true;
        }
      }

      this.hideMaxLengthNotice();
      return true;
    },

    // Adds a new grouping header if necessary (today, tomorrow, ...)
    getMessageContainer:
      function thui_getMessageContainer(messageTimestamp, hidden) {
      let startOfDayTimestamp = Utils.getDayDate(messageTimestamp);
      let messageDateGroup =
        document.getElementById('mc_' + startOfDayTimestamp);

      let header,
          messageContainer;

      if (messageDateGroup) {
        header = messageDateGroup.firstElementChild;
        messageContainer = messageDateGroup.lastElementChild;

        if (messageTimestamp < header.dataset.time) {
          header.dataset.time = messageTimestamp;
        }
        return messageContainer;
      }

      // If there is no messageContainer we have to create it
      messageDateGroup = this.tmpl.dateGroup.prepare({
        id: 'mc_' + startOfDayTimestamp,
        timestamp: startOfDayTimestamp.toString(),
        headerTimeUpdate: 'repeat',
        headerTime: messageTimestamp.toString(),
        headerDateOnly: 'true'
      }).toDocumentFragment().firstElementChild;

      header = messageDateGroup.firstElementChild;
      messageContainer = messageDateGroup.lastElementChild;

      if (hidden) {
        header.classList.add('hidden');
      } else {
        TimeHeaders.update(header);
      }

      this._insertTimestampedNodeToContainer(messageDateGroup, this.container);

      return messageContainer;
    },

    // Method for updating the header with the info retrieved from Contacts API
    updateHeaderData: function thui_updateHeaderData() {
      let thread, number;
      let _ = navigator.mozL10n.get;

      thread = Threads.active;

      if (!thread) {
        return Promise.resolve();
      }

      // Get the map for number and contact before create bubble,
      // it will reduce the costs of memory and performance,
      // and it is only needed at group message.
      if (thread.isGroup) {
        Utils.getThreadContactArray(thread.participants);
      }

      number = thread.participants[0];

      // Add data to contact activity interaction
      this.headerText.dataset.number = number;

      return new Promise((resolve) => {
        Contacts.findByAddress(number, (contacts) => {
          // For the basic display, we only need the first contact's information
          // e.g. for 3 contacts, the app displays:
          //
          //    Jane Doe,... (3)
          //
          if (contacts.length !== 0 && contacts[0].name) {
            this.activityContactName = contacts[0].name[0];
          }
          let details = Utils.getContactDetails(number, contacts, {photoURL: true});
          // Bug 867948: contacts null is a legitimate case, and
          // getContactDetails is okay with that.
          let contactName = details.title || number;
          this.headerText.dataset.isContact = !!details.isContact;
          this.headerText.dataset.title = contactName;

          if (thread.participants.length > 1) {
            contactName = contactName + _('multiple-recipients-flag');
          }

          let headerContentTemplate = thread.participants.length > 1 ?
            this.tmpl.groupHeader : this.tmpl.header;
          this.setHeaderContent({
            html: headerContentTemplate.interpolate({
              name: contactName,
              participantCount: (thread.participants.length).toString()
            })
          });
          resolve();
        });
      });
    },

    /**
     * Updates header content since it's used for different panels and should be
     * carefully handled for every case. In Thread panel header contains HTML
     * markup to support bidirectional content, but other panels still use it with
     * mozL10n.setAttributes as it would contain only localizable text. We should
     * get rid of this method once bug 961572 and bug 1011085 are landed.
     * @param {string|{ html: string }|{id: string, args: Object }} contentL10n
     * Should be either safe HTML string or l10n properties.
     * @public
     */
    setHeaderContent: function thui_setHeaderContent(contentL10n) {
      if (typeof contentL10n === 'string') {
        contentL10n = { id: contentL10n };
      }

      if (contentL10n.id) {
        // Remove rich HTML content before we set l10n attributes as l10n lib
        // fails in this case
        this.headerText.firstElementChild && (this.headerText.textContent = '');
        navigator.mozL10n.setAttributes(
          this.headerText, contentL10n.id, contentL10n.args
        );
        return;
      }

      if (contentL10n.html) {
        this.headerText.removeAttribute('data-l10n-id');
        this.headerText.innerHTML = contentL10n.html;
      }
    },

    initializeRendering: function thui_initializeRendering() {
      // Clean fields
      this.cleanFields();

      // Clean list of messages
      this.container.innerHTML = '';
      // Initialize infinite scroll params
      this.messageIndex = 0;
      // reset stopRendering boolean
      this._stopRenderingNextStep = false;
      this._renderingMessage = true;
    },

    // Method for stopping the rendering when clicking back
    stopRendering: function thui_stopRendering() {
      this._stopRenderingNextStep = true;
      this._renderingMessage = false;
    },

    // Method for rendering the first chunk at the beginning
    showFirstChunk: function thui_showFirstChunk() {
      // Show chunk of messages
      this.showChunkOfMessages(this.CHUNK_SIZE);
      // Boot update of headers
      TimeHeaders.updateAll('header[data-time-update]');
      // Go to Bottom
      this.scrollViewToBottom();

      NavigationMap.reset('thread-messages');
      let focusId = null;

      if (ThreadListUI.isSwitchCase) {
        let lastNodes = document.querySelectorAll('.message');
        if (lastNodes.length !== 0) {
          let lastId = lastNodes[lastNodes.length - 1].id;
          this.messageIdFromNotice = lastId.replace('message-', '');
          ThreadListUI.isSwitchCase = false;
        }
      }

      if (this.messageIdFromNotice) {
        focusId = 'message-' + this.messageIdFromNotice;
      } else {
        focusId = 'messages-input';
      }
      let index = this.getItemIndex(
          NavigationMap.getCurrentControl().elements, focusId);
      NavigationMap.setFocus(index);

      if (window.performance.getEntriesByName(
         'SMS-newSend-start', 'mark').length > 0) {
        window.performance.mark('SMS-newSend-end');
        window.performance.measure('performance-SMS-newSend',
          'SMS-newSend-start', 'SMS-newSend-end');
        window.performance.clearMarks('SMS-newSend-start');
        window.performance.clearMarks('SMS-newSend-end');
      }

      if (window.performance.getEntriesByName(
         'SMS-enterThread-start', 'mark').length > 0) {
        window.performance.mark('SMS-enterThread-end');
        window.performance.measure('performance-SMS-enterThread',
          'SMS-enterThread-start', 'SMS-enterThread-end');
        window.performance.clearMarks('SMS-enterThread-start');
        window.performance.clearMarks('SMS-enterThread-end');
      }
    },

    createMmsContent: function thui_createMmsContent(dataArray) {
      let container = document.createDocumentFragment();

      dataArray.forEach(function(messageData) {
        if (messageData.blob) {
          let attachment = new Attachment(messageData.blob, {
            name: messageData.name
          });
          let mediaElement = attachment.render();
          container.appendChild(mediaElement);
          attachmentMap.set(mediaElement, attachment);
        }

        if (messageData.text) {
          let textElement = document.createElement('span');

          // escape text for html and look for clickable numbers, etc.
          let text = Template.escape(messageData.text);
          text = LinkHelper.searchAndLinkClickableData(text);

          textElement.innerHTML = text;
          container.appendChild(textElement);
        }
      });
      return container;
    },

    // Method for rendering the list of messages using infinite scroll
    renderMessages: function thui_renderMessages(threadId, callback) {
      // Use taskRunner to make sure message appended in proper order
      let taskQueue = new TaskRunner();
      this.threadIdBackUp = threadId;

      let onMessagesRendered = (() => {
        if (this.messageIndex < this.CHUNK_SIZE) {
          taskQueue.push(this.showFirstChunk.bind(this));
        }

        if (callback) {
          callback();
        }
        this._renderingMessage = false;
        window.dispatchEvent(new CustomEvent('messages-render-complete'));
      });

      let onRenderMessage = ((message) => {
        if (this.threadIdBackUp && (this.threadIdBackUp !== message.threadId)) {
          return false;
        }

        if (this._stopRenderingNextStep) {
          // stop the iteration and clear the taskQueue
          taskQueue = null;
          return false;
        }
        taskQueue.push(() => {
          if (!this._stopRenderingNextStep) {
            return this.appendMessage(message,/*hidden*/ true);
          }
          return false;
        });
        this.messageIndex++;
        if (this.messageIndex === this.CHUNK_SIZE) {
          taskQueue.push(this.showFirstChunk.bind(this));
        }
        return true;
      });

      if (this._stopRenderingNextStep) {
        // we were already asked to stop rendering, before even starting
        return;
      }

      let filter = { threadId: threadId };

      // We call getMessages with callbacks
      let renderingOptions = {
        each: onRenderMessage,
        filter: filter,
        invert: false,
        end: onMessagesRendered,
        chunkSize: this.CHUNK_SIZE
      };

      MessageManager.getMessages(renderingOptions);
    },

    // generates the html for not-downloaded messages - pushes class names into
    // the classNames array also passed in, returns an HTML string
    _createNotDownloadedHTML:
     function thui_createNotDownloadedHTML(message, classNames) {
      // default strings:
      let messageL10nId = 'tobedownloaded-attachment';
      let downloadL10nId = '';  // Remove the download URL because of softkey.

      // assuming that incoming message only has one deliveryInfo
      let status = message.deliveryInfo[0].deliveryStatus;

      let expireFormatted = Utils.date.format.localeFormat(
        new Date(+message.expiryDate), navigator.mozL10n.get('expiry-date-format')
      );

      let expired = +message.expiryDate < Date.now();

      if (expired) {
        classNames.push('expired');
        messageL10nId = 'expired-attachment';
      }

      if (status === 'error') {
        classNames.push('error');
      }

      if (status === 'pending') {
        downloadL10nId = 'downloading-attachment';
        classNames.push('pending');
      }

      return this.tmpl.notDownloaded.interpolate({
        messageL10nId: messageL10nId,
        messageL10nArgs: JSON.stringify({ date: expireFormatted }),
        messageL10nDate: message.expiryDate.toString(),
        messageL10nDateFormat: 'expiry-date-format',
        downloadL10nId: downloadL10nId
      });
    },

    // Check deliveryStatus for both single and multiple recipient case.
    // In multiple recipient case, we return true only when all the recipients
    // deliveryStatus set to success.
    shouldShowDeliveryStatus: function thui_shouldShowDeliveryStatus(message) {
      if (message.delivery !== 'sent') {
        return false;
      }

      if (message.type === 'mms') {
        return message.deliveryInfo.every(function(info) {
          return info.deliveryStatus === 'success';
        });
      } else {
        return message.deliveryStatus === 'success';
      }
    },

    // Check readStatus for both single and multiple recipient case.
    // In multiple recipient case, we return true only when all the recipients
    // deliveryStatus set to success.
    shouldShowReadStatus: function thui_shouldShowReadStatus(message) {
      // Only mms message has readStatus
      if (message.delivery !== 'sent' || message.type === 'sms' ||
          !message.deliveryInfo) {
        return false;
      }

      return message.deliveryInfo.every(function(info) {
        return info.readStatus === 'success';
      });
    },

    buildMessageDOM: function thui_buildMessageDOM(message, hidden) {
      let messageDOM = document.createElement('li'),
          bodyHTML = '';

      let messageStatus = message.delivery,
          isNotDownloaded = messageStatus === 'not-downloaded',
          isIncoming = messageStatus === 'received' || isNotDownloaded;

      // If the MMS has invalid empty content(message without attachment and
      // subject) or contains only subject, we will display corresponding message
      // and layout type in the message bubble.
      //
      // Returning attachments would be different based on gecko version:
      // null in b2g18 / empty array in master.
      let noAttachment = (message.type === 'mms' && !isNotDownloaded &&
                          (message.attachments === null ||
                           message.attachments.length === 0));
      let invalidEmptyContent = (noAttachment && !message.subject);

      if (this.shouldShowReadStatus(message)) {
        messageStatus = 'read';
      } else if (this.shouldShowDeliveryStatus(message)) {
        messageStatus = 'delivered';
      }

      let classNames = [
        'navigable', 'message', message.type, messageStatus,
        isIncoming ? 'incoming' : 'outgoing'
      ];

      if (hidden) {
        classNames.push('hidden');
      }

      if (message.type && message.type === 'mms' && message.subject) {
        classNames.push('has-subject');
      }

      if (message.type && message.type === 'sms') {
        let escapedBody = Template.escape(message.body || '');
        bodyHTML = LinkHelper.searchAndLinkClickableData(escapedBody);
      }

      if (isNotDownloaded) {
        bodyHTML = this._createNotDownloadedHTML(message, classNames);
      }

      if (invalidEmptyContent) {
        classNames = classNames.concat(['error', 'invalid-empty-content']);
      } else if (noAttachment) {
        classNames.push('no-attachment');
      }

      if (classNames.indexOf('error') >= 0) {
        messageStatus = 'error';
      } else if (classNames.indexOf('pending') >= 0) {
        messageStatus = 'pending';
      }

      messageDOM.className = classNames.join(' ');
      messageDOM.id = 'message-' + message.id;
      messageDOM.dataset.messageId = message.id;
      messageDOM.dataset.iccId = message.iccId;
      messageDOM.setAttribute('role', 'menuitem');
      let simServiceId = Settings.getServiceIdByIccId(message.iccId);
      let showSimInformation =
        Settings.hasSeveralSim() && simServiceId !== null;
      let simInformationHTML = '';
      if (showSimInformation) {
        simInformationHTML = this.tmpl.messageSimInformation.interpolate({
          simNumberL10nArgs: JSON.stringify({ id: simServiceId + 1 })
        });
      }

      let contactSender = message.sender;

      if (message.isGroup) {
        messageDOM.classList.add('isGroup');
        contactSender = Utils.pickContactFromNumbers(message.sender);
      }

      messageDOM.innerHTML = this.tmpl.message.interpolate({
        id: String(message.id),
        bodyHTML: bodyHTML,
        timestamp: String(message.timestamp),
        sender: String(contactSender) + navigator.mozL10n.get('colon'),
        subject: String(message.subject),
        simInformationHTML: simInformationHTML,
        messageStatusHTML: this.getMessageStatusMarkup(messageStatus).toString()
      }, {
        safe: ['bodyHTML', 'simInformationHTML', 'messageStatusHTML']
      });

      TimeHeaders.update(messageDOM.querySelector('time'));

      messageDOM.querySelector('.deliver-mark').classList
        .toggle('hide', (messageStatus === 'delivered' ? false : true));

      let pElement = messageDOM.querySelector('p');
      if (invalidEmptyContent) {
        pElement.setAttribute('data-l10n-id', 'no-attachment-text');
      }

      if (message.type === 'mms' && !isNotDownloaded && !noAttachment) { // MMS
        return this.mmsContentParser(message).then((mmsContent) => {
          pElement.appendChild(mmsContent);
          return messageDOM;
        });
      }

      return Promise.resolve(messageDOM);
    },

    mmsContentParser: function thui_mmsContentParser(message) {
      return new Promise((resolver) => {
        SMIL.parse(message, (slideArray) => {
          resolver(this.createMmsContent(slideArray));
        });
      });
    },

    getMessageStatusMarkup: function(status) {
      return ['read', 'sending', 'error'].indexOf(status) >= 0 ?
        this.tmpl.messageStatus.prepare({
          statusL10nId: 'message-delivery-status-' + status
        }) : '';
    },

    appendMessage: function thui_appendMessage(message, hidden) {
      let timestamp = +message.timestamp;

      // look for an old message and remove it first - prevent anything from ever
      // double rendering for now
      let messageDOM = document.getElementById('message-' + message.id);

      if (messageDOM) {
        this.removeMessageDOM(messageDOM);
      }

      // build messageDOM adding the links
      return this.buildMessageDOM(message, hidden).then((messageDOM) => {
        if (this._stopRenderingNextStep) {
          return;
        }

        messageDOM.dataset.timestamp = timestamp;

        // Add to the right position
        let messageContainer = this.getMessageContainer(timestamp, hidden);
        this._insertTimestampedNodeToContainer(messageDOM, messageContainer);

        if (this.inEditMode) {
          this.checkInputs();
        }

        if (!hidden) {
          // Go to Bottom
          this.scrollViewToBottom();
        }

        window.dispatchEvent(new CustomEvent('message-dom-created'));
      });
    },

    /**
     * Inserts DOM node to the container respecting 'timestamp' data attribute of
     * the node to insert and sibling nodes in ascending order.
     * @param {Node} nodeToInsert DOM node to insert.
     * @param {Node} container Container DOM node to insert to.
     * @private
     */
    _insertTimestampedNodeToContainer: function(nodeToInsert, container) {
      let currentNode = container.firstElementChild,
          nodeTimestamp = nodeToInsert.dataset.timestamp;

      while (currentNode && nodeTimestamp > +currentNode.dataset.timestamp) {
        currentNode = currentNode.nextElementSibling;
      }

      // With this function, "inserting before 'null'" means "appending"
      container.insertBefore(nodeToInsert, currentNode || null);
    },

    showChunkOfMessages: function thui_showChunkOfMessages(number, position) {
      let elements = this.container.querySelectorAll('.hidden');
      if (position === 'ArrowDown') {
        elements = Array.slice(elements, 0).slice(0, number);
        this.isDownScroll = true;
      } else {
        elements = Array.slice(elements, -number);
      }

      elements.forEach((element) => {
        element.classList.remove('hidden');
        if (element.tagName === 'HEADER') {
          TimeHeaders.update(element);
        }
      });
    },

    showOptions: function thui_showOptions() {
      /**
        * Different situations depending on the state
        * - 'Add Subject' if there's none, 'Delete subject' if already added
        * - 'Delete messages' for existing conversations
        */
      let params = {
        header: { l10nId: 'options' },
        items: []
      };

      // Subject management
      let subjectItem;
      if (Compose.isSubjectVisible) {
        subjectItem = {
          l10nId: 'remove-subject',
          method: Compose.hideSubject
        };
      } else {
        subjectItem = {
          l10nId: 'add-subject',
          method: Compose.showSubject
        };
      }
      params.items.push(subjectItem);

      // If we are on a thread, we can call to SelectMessages
      if (Navigation.isCurrentPanel('thread')) {
        params.items.push({
          l10nId: 'selectMessages-label',
          method: this.startEdit.bind(this)
        });
      }

      // Last item is the Cancel button
      params.items.push({
        l10nId: 'cancel',
        incomplete: true
      });

      new OptionMenu(params).show();
    },

    startEdit: function thui_edit() {
      function editModeSetup() {
        /*jshint validthis:true */
        this.inEditMode = true;
        this.selectionHandler.cleanForm();
        this.mainWrapper.classList.toggle('edit');
      }

      if (!this.selectionHandler) {
        LazyLoader.load('js/selection_handler.js', () => {
          this.selectionHandler = new SelectionHandler({
            // Elements
            container: this.container,
            checkUncheckAllButton: this.checkUncheckAllButton,
            // Methods
            checkInputs: this.checkInputs.bind(this),
            getAllInputs: this.getAllInputs.bind(this),
            isInEditMode: this.isInEditMode.bind(this),
            updateSKs: this.updateSKs.bind(this)
          });
          editModeSetup.call(this);
        });
      } else {
        editModeSetup.call(this);
      }
    },

    clickCheckUncheckAllButton: function() {
      this.checkUncheckAllButton.click();
    },

    isInEditMode: function thui_isInEditMode() {
      return this.inEditMode;
    },

    deleteUIMessages: function thui_deleteUIMessages(list, callback) {
      // Strategy:
      // - Delete message/s from the DOM
      // - Update the thread in thread-list without re-rendering
      // the entire list
      // - move to thread list if needed

      if (!Array.isArray(list)) {
        list = [list];
      }

      // Removing from DOM all messages to delete
      for (let i = 0, l = list.length; i < l; i++) {
        this.removeMessageDOM(
          document.getElementById('message-' + list[i])
        );
      }

      callback = typeof callback === 'function' ? callback : function() {};

      // Do we remove all messages of the Thread?
      if (!this.container.firstElementChild) {
        // Remove the thread from DOM and go back to the thread-list
        ThreadListUI.removeThread(Threads.currentId);
        callback();
        this.backOrClose();
      } else {
        // Retrieve latest message in the UI
        let lastMessage = this.container.lastElementChild.querySelector(
          'li:last-child'
        );
        // We need to make Thread-list to show the same info
        let request = MessageManager.getMessage(+lastMessage.dataset.messageId);
        request.onsuccess = function() {
          callback();
          ThreadListUI.updateThread(request.result, { deleted: true });
        };
        request.onerror = function() {
          console.error('Error when updating the list of threads');
          callback();
        };
      }
    },

    delete: function thui_delete() {
      function performDeletion() {
        /* jshint validthis: true */
        WaitingScreen.show();
        if (exports.option) {
          exports.option.hide();
        }
        let items = ThreadUI.selectionHandler.selectedList;
        let delNumList = items.map(item => +item);

        // Complete deletion in DB and in UI
        MessageManager.deleteMessages(delNumList, function onDeletionDone() {
          ThreadUI.deleteUIMessages(delNumList, function uiDeletionDone() {
            ThreadUI.cancelEdit();
            WaitingScreen.hide();
            if (Settings.mmsEnable) {
              ThreadUI.updateSKs(threadUiNormalOptions);
            } else {
              ThreadUI.updateSKs(threadUiNormalOptions_noMMS);
            }
            ThreadUI.showToaster('editMode', delNumList.length);
            NavigationMap.reset('thread-messages');
            NavigationMap.setFocusToFixedElement('messages-input');
          });
        });
      }

      function deleteCallback() {
        performDeletion();
      }
      Utils.confirmAlert('confirmation-title', 'deleteMessages-confirmation',
                         'cancel', null, null, null, 'delete', deleteCallback);
    },

    cancelEdit: function thlui_cancelEdit() {
      if (this.inEditMode) {
        this.inEditMode = false;
        this.mainWrapper.classList.remove('edit');

        if (Navigation.isCurrentPanel('thread')) {
          let items =
              document.querySelectorAll('#messages-container li.navigable');
          if (items.length > 0) {
            items[items.length - 1].scrollIntoView(true);
          }
        }
      }
    },

    checkInputs: function thui_checkInputs() {
      let selected = this.selectionHandler.selectedCount;
      let allInputs = this.allInputs;

      let isAnySelected = selected > 0;

      // Manage buttons enabled\disabled state
      if (selected === allInputs.length) {
        this.checkUncheckAllButton.setAttribute('data-l10n-id', 'deselect-all');
      } else {
        this.checkUncheckAllButton.setAttribute('data-l10n-id', 'select-all');
      }

      if (isAnySelected) {
        navigator.mozL10n.setAttributes(this.editMode, 'selected-messages',
                                        {n: selected});
      } else {
        navigator.mozL10n.setAttributes(this.editMode, 'deleteMessages-title');
      }
      navigator.mozL10n.setAttributes(this.editMode, 'deleteMessages-title');
      navigator.mozL10n.setAttributes(
          this.editMode, 'selected-messages', { n: selected });
    },

    handleMessageClick: function thui_handleMessageClick(evt) {
      let currentNode = evt.target;
      let elems = {};

      // Walk up the DOM, inspecting all the elements
      while (currentNode && currentNode.classList) {
        if (currentNode.classList.contains('bubble')) {
          elems.bubble = currentNode;
        } else if (currentNode.classList.contains('message')) {
          elems.message = currentNode;
        } else if (currentNode.classList.contains('message-status')) {
          elems.messageStatus = currentNode;
        }
        currentNode = currentNode.parentNode;
      }

      // Click event handlers that occur outside of a message element should be
      // defined elsewhere.
      if (!(elems.message && elems.bubble)) {
        return;
      }

      // handle not-downloaded messages
      if (elems.message.classList.contains('not-downloaded')) {
        // do nothing for pending downloads, or expired downloads
        if (elems.message.classList.contains('expired') ||
            elems.message.classList.contains('pending')) {
          return;
        }

        if (ThreadListUI.isDiskFull) {
          Utils.alertFreeSpace('download');
        } else {
          this.retrieveMMS(elems.message);
        }
        return;
      }

      // Do nothing for invalid empty content error because it's not possible to
      // retrieve message again in this edge case.
      if (elems.message.classList.contains('invalid-empty-content')) {
        return;
      }

      // Click events originating from a "message-status" aside of an error
      // message should trigger a prompt for retransmission.
      if (elems.message.classList.contains('error') && elems.messageStatus) {
        Utils.confirm('resend-confirmation').then(() => {
          this.resendMessage(elems.message.dataset.messageId);
        });
      }
    },

    /*
     * Given an element of a message, this function will dive into
     * the DOM for getting the bubble container of this message.
     */
    getMessageBubble: function thui_getMessageContainer(element) {
      let node = element;
      let bubble;

      do {
        if (node.classList.contains('bubble')) {
          bubble = node;
        }

        // If we have a bubble and we reach the li with dataset.messageId
        if (bubble) {
          if (node.dataset && node.dataset.messageId) {
            return {
              id: +node.dataset.messageId,
              node: bubble
            };
          }
        }

        // If we reach the container, quit.
        if (node.id === 'thread-messages') {
          return null;
        }
      } while ((node = node.parentNode));

      return null;
    },

    handleEvent: function thui_handleEvent(evt) {
      switch (evt.type) {
        case 'click':
          if (this.inEditMode) {
            return;
          }

          // if the click wasn't on an attachment check for other clicks
          if (!attachmentMap.get(evt.target)) {
            this.handleMessageClick(evt);
          }
          return;
        case 'contextmenu':
          evt.preventDefault();
          evt.stopPropagation();

          let messageBubble = this.getMessageBubble(evt.target);

          if (!messageBubble) {
            return;
          }
          let lineClassList = messageBubble.node.parentNode.classList;

          // Show options per single message
          let messageId = messageBubble.id;
          let params = {
            type: 'action',
            header: { l10nId: 'options' },
            items:[]
          };

          if (lineClassList && !lineClassList.contains('not-downloaded')) {
            params.items.push({
              l10nId: 'forward',
              method: function forwardMessage(messageId) {
                Navigation.toPanel('composer', {
                  forward: {
                    messageId: messageId
                  }
                });
              },
              params: [messageId]
            });
          }

          params.items.push(
            {
              l10nId: 'select-text',
              method: (node) => {
                this.enableBubbleSelection(
                  node.querySelector('.message-content-body')
                );
              },
              params: [messageBubble.node]
            },
            {
              l10nId: 'view-message-report',
              method: function showMessageReport(messageId) {
                // Fetch the message by id for displaying corresponding message
                // report. threadId here is to make sure thread is updatable
                // when current view report panel.
                Navigation.toPanel('report-view', {
                  id: messageId,
                  threadId: Threads.currentId
                });
              },
              params: [messageId]
            },
            {
              l10nId: 'delete',
              method: function deleteMessage(messageId) {
                Utils.confirm(
                  'deleteMessage-confirmation', null,
                  { text: 'delete', className: 'danger' }
                ).then(() => {
                  MessageManager.deleteMessages(
                    messageId, () => ThreadUI.deleteUIMessages(messageId)
                  );
                });
              },
              params: [messageId]
            }
          );

          if (lineClassList && lineClassList.contains('error') &&
              lineClassList.contains('outgoing')) {
            params.items.push({
              l10nId: 'resend-message',
              method: this.resendMessage.bind(this, messageId),
              params: [messageId]
            });
          }

          params.items.push({
            l10nId: 'cancel'
          });

          let options = new OptionMenu(params);
          options.show();

          break;
        case 'submit':
          evt.preventDefault();
          break;
      }
    },

    cleanFields: function thui_cleanFields() {
      this.previousSegment = 0;

      if (this.recipients) {
        this.recipients.length = 0;
      }

      Compose.clear();
    },

    onSendClick: function thui_onSendClick() {
      if (Compose.isEmpty()) {
        return;
      }

      // Assimilation 3 (see "Assimilations" above)
      // User may return to recipients, type a new recipient
      // manually and then click the sendButton without "accepting"
      // the recipient.
      this.assimilateRecipients();

      // not sure why this happens - replace me if you know
      this.container.classList.remove('hide');
    },

    switchThreadSelection: function thui_switchThreadSelection(callback) {
      if (this.draft && !this.draft.isEdited) {
        callback();
        return;
      }
      function acceptCallback() {
        callback();
      }
      function confirmCallback() {
        ThreadUI.discardDraft();
        Compose.clear();
        callback();
      }
      Utils.confirmAlert('confirmation-title', 'draft-save-content',
                         'cancel', null, 'save-as-draft', acceptCallback,
                         'discard-message', confirmCallback);
    },

    handleKeyEvent: function thui_handleKeyEvent(event) {
      let focusEle = document.querySelector('.focus');
      if (Navigation.isCurrentPanel('thread')) {
        switch (event.key) {
          case 'Left':
          case 'ArrowLeft':
            if (!this.isInEditMode() && !this.isAttachmentListMode() &&
                ThreadListUI._canSwitchBetweenThreads()) {
              if (Compose.isEmpty()) {
                ThreadListUI.switchPreviousThread();
              } else {
                if (document.getElementById('option-menu')) {
                  return;
                }
                this.switchThreadSelection(function() {
                  ThreadListUI.switchPreviousThread();
                });
              }
            }
            break;
          case 'Right':
          case 'ArrowRight':
            if (!this.isInEditMode() && !this.isAttachmentListMode() &&
                ThreadListUI._canSwitchBetweenThreads()) {
              if (Compose.isEmpty()) {
                ThreadListUI.switchNextThread();
              } else {
                if (document.getElementById('option-menu')) {
                  return;
                }
                this.switchThreadSelection(function() {
                  ThreadListUI.switchNextThread();
                });
              }
            }
            break;
          case 'ArrowUp':
          case 'ArrowDown':
            if ((focusEle.tagName === 'A' || focusEle.tagName === 'DIV') &&
                this.getParents(
                    focusEle, 'LI').classList.contains('message')) {
              event.preventDefault();
              event.stopPropagation();
              this.scrollLinkElement(focusEle, event.key);
              this.updateSKs();
            }
            break;
          case 'Backspace':
          case 'BrowserBack':
            event.stopPropagation();
            event.preventDefault();
            if (this.contactPromptOptionMenuShown) {
              this.optionMenu.hide();
              this.updateSKs(ThreadUI.currentSoftKey);
              this.contactPromptOptionMenuShown = false;
              return;
            }
            if (!exports.option.menuVisible) {
              if (this.isInEditMode()) {
                this.cancelEdit();
                if (Settings.mmsEnable) {
                  this.updateSKs(threadUiNormalOptions);
                } else {
                  this.updateSKs(threadUiNormalOptions_noMMS);
                }
                NavigationMap.reset('thread-messages');
                let index = this.getItemIndex(
                    NavigationMap.getCurrentControl().elements, 'messages-input');
                NavigationMap.setFocus(index);
              } else {
                if (!this.optionMenuShown) {
                  this.back();
                }
              }
            }
            break;
          case 'MicrophoneToggle':
            if (this.isDialing) {
              event.preventDefault();
              event.stopPropagation();
            }
            break;
          case 'EndCall':
            this.back(true);
            event.preventDefault();
            break;
        }
      } else if (Navigation.isCurrentPanel('composer')) {
        switch (event.key) {
          case 'Backspace':
          case 'BrowserBack':
            event.stopPropagation();
            event.preventDefault();
            if (Utils.isDialogShown()) {
              // confirm dialog will handle back event
              exports.option.show();
              return;
            }
            if (this.contactPromptOptionMenuShown) {
              this.optionMenu.hide();
              this.updateSKs(ThreadUI.currentSoftKey);
              this.contactPromptOptionMenuShown = false;
              return;
            }
            if (exports.option.menuVisible) {
              return;
            }

            if (document.activeElement.parentNode !== this.selector.recipient) {
              this.back();
            }
            break;
          case 'EndCall':
            this.back(true);
            event.preventDefault();
            break;
        }
      }
    },

    // Need pick up the situation that focused on attachment
    isAttachmentListMode: function() {
      return ((document.activeElement.parentNode.parentNode.id === 'attachmentList') &&
              (document.activeElement.tagName === 'IFRAME'));
    },

    handleInput: function(evt) {
      let currentFocus = document.querySelector('.focus');
      if (currentFocus.nodeName === 'IFRAME') {
        return;
      }
      let range = window.getSelection().getRangeAt(0);
      let currentCursor = range.startContainer;
      switch (evt.key) {
        case 'ArrowUp':
          if (((currentCursor === document.activeElement ||
                currentCursor === document.activeElement.firstChild) &&
               range.startOffset === 0)) {
            break;
          }
          evt.stopPropagation();
          break;
        case 'ArrowDown':
          let nextrange = document.activeElement.childNodes.length;
          if (((currentCursor === document.activeElement ||
                currentCursor === document.activeElement.childNodes[nextrange - 2]) &&
               isLastLine(range))) {
            break;
          }
          evt.stopPropagation();
          break;
        case 'ArrowLeft':
          if (!this.isInEditMode() &&
              ThreadListUI._canSwitchBetweenThreads()) {
            evt.stopPropagation();
            ThreadListUI.switchPreviousThread();
            break;
          }
          break;
        case 'ArrowRight':
          if (!this.isInEditMode() &&
              ThreadListUI._canSwitchBetweenThreads()) {
            evt.stopPropagation();
            ThreadListUI.switchNextThread();
            break;
          }
          break;
        case 'Backspace':
          evt.stopPropagation();
          evt.preventDefault();
          this.back();
          break;
      }

      function isLastLine(range) {
        let len = document.activeElement.childNodes.length;
        if (range.startContainer.nodeName === '#text' &&
            range.endContainer === document.activeElement.childNodes[len - 2] &&
            range.startOffset === document.activeElement.childNodes[len - 2].nodeValue.length) {
          return true;
        } else if (range.startContainer.nodeName === 'DIV' &&
          range.startOffset === document.activeElement.childNodes.length - 1) {
          return true;
        }
        return false;
      }
    },

    updateInformationSks: function() {
      this.pickContactsDestail().then((contacts) => {
        if (contacts[0].length === contacts[1].length) {
          this.updateSKs(threadUiCancelReportWithUnblock);
        } else {
          this.updateSKs(threadUiCancelReportWithBlock);
        }
      });
    },

    pickContactsDestail: function() {
      return new Promise((resolve) => {
        let contactList =
          document.getElementById('information-report').querySelector('.contact-list');
        let suggestionList = contactList.querySelectorAll('.suggestion');
        let contact = [];
        let blockContact = [];
        let asyncTask = [];
        for (let i = 0; i < suggestionList.length; i++) {
          let nodeContact = suggestionList[i].getAttribute('data-number');
          let newTask = () => new Promise((resolver) => {
            Contacts.findByAddress(nodeContact, (result) => {
              let detail;
              if (result && result.length !== 0) {
                let addresses = [];

                if (result[0].tel && result[0].tel.length) {
                  addresses = addresses.concat(result[0].tel);
                }

                if (Settings.supportEmailRecipient &&
                    result[0].email && result[0].email.length) {
                  addresses = addresses.concat(result[0].email);
                }

                let detailList = Utils.getContactDetails(nodeContact, result, null);
                let dataList = null;

                addresses.forEach((current) => {
                  if (Utils.probablyMatches(current.value, nodeContact)) {
                    dataList = Utils.getDisplayObject(detailList.title, current);
                  }
                });

                // Uppercase the first letter.
                let type = dataList.type;
                type = type.substring(0,1).toUpperCase() + type.substring(1);

                detail = {
                  contact: dataList.name,
                  type: type,
                  number: nodeContact
                };

                // Only contact recipient can be blocked.
                contact.push(detail);
              } else {
                detail = {
                  number: nodeContact
                };

                contact.push(detail);
              }

              Utils.findBlockNumbers('number', nodeContact).then((result) => {
                if (result.length !== 0) {
                  blockContact.push(detail.number);
                  suggestionList[i].classList.add('suggestion-adjust');
                  suggestionList[i].parentNode.classList.add('block-tag');
                } else {
                  suggestionList[i].classList.remove('suggestion-adjust');
                  suggestionList[i].parentNode.classList.remove('block-tag');
                }

                resolver();
              });
            });
          });
          asyncTask.push(newTask());
        }

        Promise.all(asyncTask).then(() => {
          resolve([contact, blockContact]);
        });
      });
    },

    updateSKs: function(params) {
      let skHidden = false;
      this.isDialing = false;

      function handleSoftKey(key) {
        if (key !== promptContactOption) {
          ThreadUI.currentSoftKey = key;
        }

        if (skHidden) {
          // The null softkey is necessary for some situations.
          key =  {
            header:{ l10nId: 'options' },
            items: [{
              name: '',
              priority: 2
            }]
          };
        }

        if (exports.option) {
          if (exports.option.initSoftKeyPanel) {
            exports.option.initSoftKeyPanel(key);
          } else {
            exports.option = new SoftkeyPanel(key);
          }
        } else {
          exports.option = new SoftkeyPanel(key);
        }

        exports.option.show();
      }

      if (document.getElementById(
          'loading').classList.contains('show-loading')) {
        return;
      }

      if (Utils.menuOptionVisible) {
        return;
      }

      if (!params) {
        if (this.isInEditMode()) {
          let selected = this.selectionHandler.selectedCount;

          if (selected === this.allInputs.length) {
            if (this._renderingMessage) {
              this.updateSKs(selectAllWithDeslectFocusWait);
            } else {
              this.updateSKs(selectDeselectAllwithDeleteOptions);
            }
          } else if (selected > 0) {
            if (document.activeElement.querySelectorAll('.thread-checked').length !== 0 ||
                document.activeElement.classList.contains('thread-checked')) {
              if (this._renderingMessage) {
                this.updateSKs(selectAllWithDeslectFocusWait);
              } else {
                this.updateSKs(selectAllWithDeslectFocus);
              }
            } else {
              if (this._renderingMessage) {
                this.updateSKs(selectAllWithDeleteOptionsWait);
              } else {
                this.updateSKs(selectAllWithDeleteOptions);
              }
            }
          } else {
            if (this._renderingMessage) {
              this.updateSKs(selectAllOptionsWait);
            } else {
              this.updateSKs(selectAllOptions);
            }
          }
        }
        if (this.currentMode === 'thread' && !this.isInEditMode()) {
          params = {
            header: { l10nId: 'options' },
            items: []
          };
          let focused = document.querySelectorAll('.focus');
          let focusClassList = focused[0].classList;
          if (typeof focused !== 'undefined' && focused !== null &&
              focused.length > 0) {
            if (focused[0].tagName === 'LI' &&
                focusClassList.contains('message') &&
                !focusClassList.contains('not-downloaded')) {
              if (this.getAChildFromMessage(focused[0])) {
                params.items.push(skLinkSelect);
              }
            }
            else if ((focused[0].tagName === 'A' ||
                      focused[0].tagName === 'DIV') &&
                     this.getParents(
                         focused[0], 'LI').classList.contains('message')) {
              this.composerContainer.classList.add('next-focus');
              this.getParents(focused[0], 'LI').classList.add('current-focus');
              params.items.push(skCancelToThread);
              let linkType = this.listenLinkElement(focused[0]);
              switch (linkType) {
                case 'attachment':
                  params.items.push(skAttachmentOpen);
                  break;
                case 'dial-link':
                  this.isDialing = true;
                  if (Settings.RTTEnable) {
                    if (Settings.RTTPreferred === 'always-visible-automatic') {
                      params.items.push(skRTTDialOpen);
                    } else if (Settings.RTTPreferred === 'always-visible-manual') {
                      params.items.push(skSelectDialOpen);
                    } else {
                      params.items.push(skDialOpen);
                    }
                  } else {
                    params.items.push(skDialOpen);
                  }
                  params.items.push(skOption);
                  break;
                case 'url-link':
                  params.items.push(skUrlOpen);
                  break;
                case 'email-link':
                  if (Settings.emailAppInstalled) {
                    params.items.push(skEmailOpen);
                  }
                  params.items.push(skOption);
                  break;
              }
              handleSoftKey(params);
              return;
            }

            if (focusClassList && focusClassList.contains('not-downloaded') &&
                !focusClassList.contains('expired')) {
              params.items.push(skDownload);
              if (focusClassList.contains('pending')) {
                skHidden = true;
              }
            }

            if (focusClassList && focusClassList.contains('error') &&
                focusClassList.contains('outgoing')) {
              params.items.push(skResendThisMessage);
            }

            if (focusClassList &&
                !focusClassList.contains('not-downloaded')) {
              params.items.push(skForward);
            }

            params.items.push(skDelete);
            params.items.push(skViewMessageReport);
          }
        }
      }

      if (ActivityHandler._lastMessage) {
        if (document.activeElement.id === 'messages-input') {
          params = threadUiComposerOptions_noMMS;
        } else {
          params = lastMessageOption;
        }

        params = this.removeSendElement(params);
        if ((Navigation.isCurrentPanel('composer') &&
             this.recipientsList.lastChild.textContent.length === 0 &&
             !Compose.disableSendButton()) ||
            Navigation.isCurrentPanel('thread')) {
          params = this.selectSIMSend(params);
        }
      }

      handleSoftKey(params);
    },

    removeSendElement: function(params) {
      if (params.items.indexOf(skSendSIM1) !== -1) {
        params.items.splice(params.items.indexOf(skSendSIM1), 1);
        return this.removeSendElement(params);
      } else if (params.items.indexOf(skSendSIM2) !== -1) {
        params.items.splice(params.items.indexOf(skSendSIM2), 1);
        return this.removeSendElement(params);
      } else if (params.items.indexOf(skSend) !== -1) {
        params.items.splice(params.items.indexOf(skSend), 1);
        return this.removeSendElement(params);
      }

      return params;
    },

    majorCall: function(isRTT) {
      let callElement = [];
      for (let i = 0; i < Threads.active.participants.length; i++) {
        if (!Utils.isEmailAddress(Threads.active.participants[i])) {
          callElement.push(Threads.active.participants[i]);
        }
      }

      // If only one recipient, call directly, else show select dialog.
      if (callElement.length > 1) {
        ThreadUI.showSelectDialog(callElement, 'call', isRTT);
      } else {
        ActivityPicker.dial(callElement[0], false, isRTT);
      }
    },

    updateCallOrEmail: function(param) {
      // Delete extra call or email option.
      if (param.items.indexOf(skCall) !== -1) {
        param.items.splice(param.items.indexOf(skCall), 1);
        return this.updateCallOrEmail(param);
      } else if (param.items.indexOf(skEmail) !== -1) {
        param.items.splice(param.items.indexOf(skEmail), 1);
        return this.updateCallOrEmail(param);
      } else if (param.items.indexOf(skRTTCall) !== -1) {
        param.items.splice(param.items.indexOf(skRTTCall), 1);
        return this.updateCallOrEmail(param);
      }

      /* Need consider three situations.
       * 1. Only email address -> only email option.
       * 2. Only phone address -> only phone option.
       * 3. Both of email and phone exist -> email and phone option.
       */
      let hasEmail = false;
      let hasPhone = false;
      for (let i = 0; i < Threads.active.participants.length; i++) {
        if (Utils.isEmailAddress(Threads.active.participants[i])) {
          if (Settings.emailAppInstalled) {
            hasEmail = true;
          }
        } else {
          hasPhone = true;
        }
      }

      let location = param.items.indexOf(skSelectMessages) + 1;

      if (hasPhone) {
        if (!Settings.RTTEnable) {
          param.items.splice(location, 0, skCall);
        } else {
          switch (Settings.RTTPreferred) {
            case 'visible-during-calls':
              param.items.splice(location, 0, skCall);
              break;
            case 'always-visible-automatic':
              param.items.splice(location, 0, skRTTCall);
              break;
            case  'always-visible-manual':
              param.items.splice(location, 0, skRTTCall);
              param.items.splice(location, 0, skCall);
              break;
          }
        }
      }

      if (hasEmail) {
        param.items.splice(location, 0, skEmail);
      }

      return param;
    },

    observeFocusChange_new: function() {
      suggestionsObserver && suggestionsObserver.disconnect();
      inputObserver && inputObserver.disconnect();

      let suggestionsList =
        document.querySelector('#messages-recipient-suggestions');
      suggestionsObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes') {
            if (Navigation.isCurrentPanel('composer') &&
                !suggestionsList.classList.contains('hide')) {
              if (suggestionsList.firstElementChild.children.length > 0 &&
                  suggestionsList.firstElementChild.querySelector('.selected')) {
                this.updateSKs(threadUiAddSuggestion);
              } else {
                this.updateSKs(threadUIAddContactWithInput);
              }
            } else if (Navigation.isCurrentPanel('composer') &&
                       suggestionsList.classList.contains('hide')) {
              let currentFocus = document.querySelector('.focus');
              if (currentFocus && currentFocus.tagName !== 'DIV') {
                this.updateSKs(threadUIAddContactWithInput);
              }
            }
          }
        });
      });
      let suggestionsConfig = {
        attributes: true,
        subtree: true,
        attributeOldValue: true
      };
      suggestionsObserver.observe(suggestionsList, suggestionsConfig);

      let input = document.getElementById('messages-input');
      inputObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes') {
            if (mutation.attributeName === 'class') {
              this.onFocusChanged();
            }
          } else if (mutation.type === 'childList') {
            if ((mutation.addedNodes.length > 0 &&
                 mutation.addedNodes[0].tagName === 'IFRAME') ||
                (mutation.removedNodes.length > 0 &&
                 mutation.removedNodes[0].tagName === 'IFRAME')) {
              //reset navigation when attachment added
              NavigationMap.reset('thread-messages');
            }
            if (mutation.removedNodes.length > 0 &&
                mutation.removedNodes[0].tagName === 'IFRAME') {
              let focused = document.querySelector('.focus');
              if (!focused) {
                input.classList.add('focus');
                input.focus();
              }
            }
          }
        });
      });
      let config = {
        attributes: true,
        childList: true
      };
      inputObserver.observe(input, config);
    },

    getParents: function(node, tagName) {
      let parent = node.parentNode;
      let tag = tagName.toUpperCase();
      if (parent.tagName === tag) {
        return parent;
      } else if (parent.tagName === 'BODY') {
        return document.body;
      } else {
        return this.getParents(parent, tag);
      }
    },

    getAChildFromMessage: function(node) {
      let secondFocusElement = node
        .getElementsByClassName('message-content-body')[0];
      return (secondFocusElement.querySelectorAll('.link-focus').length !== 0);
    },

    findLinkFocus: function () {
      let parentNode = document.activeElement;
      this.scrollIndex = 0;
      let secondNode = parentNode.getElementsByClassName(
          'message-content-body')[0].querySelectorAll('.link-focus');
      parentNode.blur();
      parentNode.classList.remove('focus');
      secondNode[this.scrollIndex].focus();
      secondNode[this.scrollIndex].classList.add('focus');
      this.updateSKs();
    },

    openLinkFocus: function (type) {
      let focusEle = document.querySelector('.focus');
      switch (type) {
        case 'dial':
          this.promptContact({
            number: focusEle.dataset.dial,
            inMessage: true
          });
          break;
        case 'email':
          this.promptContact({
            email: focusEle.dataset.email,
            inMessage: true
          });
          break;
      }
    },

    updateCallKey: function () {
      let callKey = skDialOpen;
      if (Settings.RTTEnable) {
        if (Settings.RTTPreferred === 'always-visible-automatic') {
          callKey = skRTTDialOpen;
        } else if (Settings.RTTPreferred === 'always-visible-manual') {
          callKey = skSelectDialOpen;
        }
      }
      this.updateSKs({
        header: { l10nId: 'options' },
        items: [skCancelToThread, callKey, skOption]
      });
    },

    doLinkAction: function (type) {
      let focusEle = document.querySelector('.focus');
      switch (type) {
        case 'attachment':
          thui_mmsAttachmentClick(focusEle);
          break;
        case 'dial':
          ActivityPicker.dial(focusEle.dataset.dial, true, false);
          break;
        case 'rtt-dial':
          ActivityPicker.dial(focusEle.dataset.dial, true, true);
          break;
        case 'select-dial':
          ThreadUI.switchCallOption('call', 'rtt-call', (rttEnable) => {
            if (rttEnable) {
              ActivityPicker.dial(focusEle.dataset.dial, true, true);
            } else {
              ActivityPicker.dial(focusEle.dataset.dial, true, false);
            }
          });
          break;
        case 'email':
          ActivityPicker.email(focusEle.dataset.email, () => {
            this.updateSKs(this.currentSoftKey);
          }, () => {
            this.updateSKs(this.currentSoftKey);
          });
          break;
        case 'url':
          ActivityPicker[type](focusEle.dataset[type]);
          break;
      }
    },

    scrollLinkElement: function (node, direction) {
      let sourceElement = this.getParents(node, 'LI');
      let secondNode = sourceElement
        .getElementsByClassName('message-content-body')[0];
      let secondElement = secondNode.querySelectorAll('.link-focus');
      let elementLength = secondElement.length;
      let nextFocusNode;
      if (direction === 'ArrowDown') {
        this.scrollIndex += 1;
      } else {
        this.scrollIndex -= 1;
      }

      if (this.scrollIndex < 0) {
        this.scrollIndex = elementLength - 1;
      }

      if (this.scrollIndex > elementLength - 1) {
        this.scrollIndex = 0;
      }

      nextFocusNode = secondElement[this.scrollIndex];
      if (nextFocusNode.tagName === 'A' || nextFocusNode.tagName === 'DIV') {
        node.blur();
        node.classList.remove('focus');
        nextFocusNode.focus();
        nextFocusNode.classList.add('focus');
        nextFocusNode.scrollIntoView(true);
      }
    },

    listenLinkElement: function (node) {
      let isAttachment = attachmentMap.get(node);
      if (isAttachment) {
        return 'attachment';
      } else {
        return node.getAttribute('data-action');
      }
    },

    cancelToThread: function () {
      let currentFocus = document.querySelector('.focus');
      let nextFocus = this.getParents(currentFocus, 'LI');
      currentFocus.blur();
      currentFocus.classList.remove('focus');
      nextFocus.focus();
      nextFocus.classList.add('focus');
      this.scrollIndex = 0;
      this.updateSKs();
    },

    selectMessages: function() {
      function startEditMode() {
        if (!window.option || !window.option.menuVisible) {
          document.removeEventListener('transitionend', startEditMode);
        }
        let items =
          document.querySelectorAll('#messages-container li.navigable');
        NavigationMap.setFocus(items.length - 1);
      }

      function updateSoftkey() {
        window.removeEventListener(
            'messages-render-complete', updateSoftkey);
        ThreadUI.updateSKs();
      }

      this.startEdit();
      NavigationMap.reset('messages-container');
      if (this._renderingMessage) {
        window.addEventListener(
            'messages-render-complete', updateSoftkey);
      }

      document.addEventListener('transitionend', startEditMode);
    },

    showToaster: function(mode, count) {
      let param = {};
      if (mode === 'messageMode') {
        param.messageL10nId = 'delete-message';
      }
      else if (mode === 'threadMode') {
        param.messageL10nId = 'deleted-threads';
      }
      else if (mode === 'editMode') {
        param.messageL10nId = 'deleted-message';
        param.messageL10nArgs = {n: count};
      }
      Toaster.showToast(param);
    },

    deleteCurrentThread: function(mode, messageId) {
      let messageIdsToDelete = [];
      let threadId = this.currentThreadId;

      function deleteRelatedThread(id) {
        MessageManager.deleteMessages(id);
        ThreadListUI.deleteThread(threadId);
        WaitingScreen.hide();
        Compose.clear();
        ThreadUI.back();
        messageIdsToDelete = null;
      }

      function onAllThreadMessagesRetrieved() {
        deleteRelatedThread(messageIdsToDelete);
      }

      function onThreadMessageRetrieved(message) {
        messageIdsToDelete.push(message.id);
        return true;
      }

      function performDelete() {
        WaitingScreen.show();
        if (exports.option) {
          exports.option.hide();
        }
        ThreadListUI.manualDeleted = true;
        if (messageId) {
          deleteRelatedThread(messageId);
        } else {
          MessageManager.getMessages({
            filter: { threadId: threadId },
            each: onThreadMessageRetrieved,
            end: onAllThreadMessagesRetrieved
          });
        }
      }

      function confirmCallback() {
        performDelete();
      }

      if (threadId) {
        let confirmation;
        if (mode === 'messageMode') {
          confirmation = 'deleteMessage-confirmation';
        }
        else if (mode === 'editMode') {
          confirmation = 'deleteMessages-confirmation';
        } else {
          confirmation = 'deleteMessage-confirmation2';
        }
        Utils.confirmAlert('confirmation-title', confirmation,
                           'cancel', null, null, null,
                           'delete', confirmCallback, null);
      }
      Utils.menuOptionVisible = false;
    },

    deleteSingleMessage: function() {
      let messageId = this._getFocusedMessageId(this._storeFocused);
      function confirmCallback() {
        WaitingScreen.show();
        if (exports.option) {
          exports.option.hide();
        }
        MessageManager.deleteMessages(
          messageId, () => ThreadUI.deleteUIMessages(messageId)
        );
        ThreadUI.showToaster('messageMode');
        NavigationMap.reset('thread-messages');
        NavigationMap.setFocusToFixedElement('messages-input');
        WaitingScreen.hide();
      }
      Utils.confirmAlert('confirmation-title', 'deleteMessage-confirmation',
                         'cancel', null, null, null, 'delete', confirmCallback);
      Utils.menuOptionVisible = false;
    },

    switchCallOption: function thui_videoCallOption(keyOne, keyTwo, callback) {
      let items = [];
      let params = {
        classes: ['group-menu', 'softkey'],
        header: navigator.mozL10n.get('select') || '',
        items: null,
        menuClassName: 'menu-button'
      };

      items.push({
        l10nId: keyOne,
        method: function() {
          ThreadUI.contactPromptOptionMenuShown = false;
          callback(false);
        }
      });

      items.push({
        l10nId: keyTwo,
        method: function() {
          ThreadUI.contactPromptOptionMenuShown = false;
          callback(true);
        }
      });

      params.items = items;

      this.optionMenu = new OptionMenu(params);
      this.optionMenu.show();
      this.contactPromptOptionMenuShown = true;
      this.updateSKs(promptContactOption);
    },

    simSelectOptions: function thui_simSelect(callback) {
      let conns = window.navigator.mozMobileConnections;
      let items = [];
      let params = {
        classes: ['group-menu', 'softkey'],
        header: navigator.mozL10n.get('select') || '',
        items: null,
        menuClassName: 'menu-button'
      };

      let carrier0 = Settings.getOperatorByIccId(conns[0].iccId);
      items.push({
        name: carrier0 ? 'SIM1 - ' + carrier0 : 'SIM1',
        method: function() {
          ThreadUI.contactPromptOptionMenuShown = false;
          if (conns[0]) {
            if (callback) {
              callback(0);
            } else {
              ThreadUI.simSelectedCallback(0);
            }
          }
        },
        disable: conns[0] ? false : true
      });

      let carrier1 = Settings.getOperatorByIccId(conns[1].iccId);
      items.push({
        name: carrier1 ? 'SIM2 - ' + carrier1 : 'SIM2',
        method: function() {
          ThreadUI.contactPromptOptionMenuShown = false;
          if (conns[1]) {
            if (callback) {
              callback(1);
            } else {
              ThreadUI.simSelectedCallback(1);
            }
          }
        },
        disable: conns[1] ? false : true
      });
      params.items = items;

      this.optionMenu = new OptionMenu(params);
      this.optionMenu.show();
      this.contactPromptOptionMenuShown = true;
      setTimeout(() => {
        this.updateSKs(promptContactOption);
      });
    },

    showSelectDialog: function(data, tag, isRTT) {
      let items = [];
      let params = {
        classes: ['group-menu', 'softkey'],
        header: navigator.mozL10n.get('select') || '',
        items: null,
        menuClassName: 'menu-button'
      };

      let promptOption = {
        header: { l10nId: 'options' },
        items: [{
          l10nId: tag,
          priority: 2,
          method: function() {
            secondCall = false;
          }
        }]
      };

      let asyncTask = [];
      for (let i = 0; i < data.length; i++) {
        let newTask = () => new Promise((resolve) => {
          Contacts.findByAddress(data[i], (result) => {
            let recipient;
            if (result.length && result[0].name && result[0].name[0]) {
              recipient = result[0].name[0];
            } else {
              recipient = data[i];
            }

            items.push({
              name: recipient,
              method: function() {
                if (tag === 'call') {
                  ActivityPicker.dial(data[i], false, isRTT);
                }

                if (tag === 'email') {
                  ActivityPicker.email(data[i]);
                }

                ThreadUI.contactPromptOptionMenuShown = false;
              }
            });

            resolve();
          });
        });

        asyncTask.push(newTask());
      }

      Promise.all(asyncTask).then(() => {
        params.items = items;

        this.optionMenu = new OptionMenu(params);
        this.optionMenu.show();
        this.contactPromptOptionMenuShown = true;
        this.updateSKs(promptOption);
      });
    },

    // FIXME/bug 983411: phoneNumber not needed.
    simSelectedCallback: function thui_simSelected(cardIndex) {
      if (Compose.isEmpty()) {
        return;
      }

      cardIndex = +cardIndex;
      if (isNaN(cardIndex)) {
        cardIndex = 0;
      }

      this.sendMessage({ serviceId: cardIndex });
    },

    sendMessage: function thui_sendMessage(opts) {
      let content = Compose.getContent(),
          subject = Compose.getSubject(),
          messageType = Compose.type,
          serviceId = opts.serviceId === undefined ? null : opts.serviceId,
          recipients;

      let inComposer = Navigation.isCurrentPanel('composer');

      // Adding the sending protection logic to prevent
      // the 'undefined' message appear.
      if (content.length === 0 && !subject) {
        return;
      }

      // Depending where we are, we get different nums
      if (inComposer) {
        if (!this.recipients.length) {
          console.error('The user tried to send the message but no recipients ' +
              'are entered. This should not happen because we should disable ' +
              'the send button in that case');
          return;
        }
        recipients = this.recipients.numbers;
      } else {
        recipients = Threads.active.participants;
      }

      if ((messageType === 'sms' && !this.isSMSAbleToSend(serviceId)) ||
          (messageType === 'mms' && !this.isMMSAbleToSend(serviceId))) {
        return;
      }

      Utils.canSendWhenParentControl(recipients).then((canSend) => {
        if (canSend) {
          if (recipients.length > 1 && messageType === 'mms' &&
              Startup.hasGroup && Settings.groupSwitchEnabled) {
            Utils.judgeNumberSituation(serviceId, () => {
              Settings.isGroup = true;
              this.realSendMessage(inComposer, messageType, recipients, content,
                                   serviceId, subject);
            });
          } else {
            this.realSendMessage(inComposer, messageType, recipients, content,
                                 serviceId, subject);
          }
        } else {
          Utils.confirmAlert('confirmation-title', 'parent-control-text',
                             null, null, 'ok', null, null, null);
        }
      });
    },

    realSendMessage: function thui_realSendMessage(inComposer, messageType,
                                                   recipients, content, serviceId,
                                                   subject) {
      // Clean composer fields (this lock any repeated click in 'send' button)
      this.disableConvertNoticeBanners();
      this.cleanFields();
      this.enableConvertNoticeBanners();

      // If there was a draft, it just got sent
      // so delete it
      if (this.draft) {
        ThreadListUI.removeThread(this.draft.id);
        Drafts.delete(this.draft).store();
        this.draft = null;
      }

      this.updateHeaderData();

      this.shouldChangePanelNextEvent = inComposer;

      // Send the Message
      if (messageType === 'sms') {
        if (!ActivityHandler.isCustomMessage) {
          ThreadListUI.messagesSent = true;
        }
        window.performance.mark('SMS-newSend-start');
        window.performance.mark('SMS-existSend-start');
        MessageManager.sendSMS({
          recipients: recipients,
          content: content[0],
          serviceId: serviceId,
          oncomplete: (requestResult) => {
            if (!requestResult.hasError) {
              this.onMessageSendRequestCompleted();
              return;
            }

            let errors = {};
            requestResult.return.forEach((result) => {
              if (result.success) {
                return;
              }

              if (errors[result.code.name] === undefined) {
                errors[result.code.name] = [result.recipient];
              } else {
                errors[result.code.name].push(result.recipient);
              }
            });

            for (let key in errors) {
              this.showMessageSendingError(key, { recipients: errors[key] });
            }
          }
        });

        if (recipients.length > 1) {
          this.shouldChangePanelNextEvent = false;
          this.removeAllEventListener();
          Navigation.toPanel('thread-list');
          ThreadListUI.updateThread(Threads.active);
          if (ActivityHandler.isInActivity()) {
            setTimeout(this.close.bind(this), this.LEAVE_ACTIVITY_DELAY);
          }
        }
      } else {
        if (Settings.dataServiceId === -1) {
          this.showMessageSendingError('NoSignalError');
          return;
        }

        let smilSlides = content.reduce(thui_generateSmilSlides, []);
        let mmsOpts = {
          recipients: recipients,
          subject: subject,
          content: smilSlides,
          serviceId: serviceId,
          onsuccess: function() {
            this.onMessageSendRequestCompleted();
          }.bind(this),
          onerror: function onError(error) {
            let errorName = error.name;
            this.showMessageSendingError(errorName);
          }.bind(this)
        };

        MessageManager.sendMMS(mmsOpts);
      }
    },

    onMessageSent: function thui_onMessageSent(e) {
      let message = e.message;

      function messageDOMCreated() {
        window.removeEventListener('message-dom-created', messageDOMCreated);
        ThreadUI.messageSentAction(message);
      }

      let sentDOM = document.getElementById('message-' + message.id);
      if (!sentDOM) {
        window.addEventListener('message-dom-created', messageDOMCreated);
      } else {
        this.messageSentAction(message);
      }
    },

    messageSentAction: function thui_messageSentAction(message) {
      this.setMessageStatus(message.id, 'sent');
      this.scrollViewToBottom();
      if (Startup.isActivity && !ActivityHandler._lastMessage) {
        ActivityHandler.leaveActivity();
      }
      Toaster.showToast({
        messageL10nId: 'message-sent-toast',
      });
    },

    onCustomMessageSent: function(evt) {
      let messageNumber = evt.message.receiver || evt.message.receivers[0];
      this.setMessageStatus(evt.message.id, 'sent');
      if (Startup.isActivity && !ActivityHandler._lastMessage) {
        ActivityHandler.leaveActivity();
      }
      Toaster.showToast({
        messageL10nId: 'custom-message-sent',
        messageL10nArgs: { name: this.activityContactName || messageNumber },
      });
      this.activityContactName = '';
      ActivityHandler.isCustomMessage = false;
    },

    /**
     * Fires once message (both SMS and MMS) send/resend request initiated by the
     * current application instance is successfully completed.
     */
    onMessageSendRequestCompleted:
     function thui_onMessageSendRequestCompleted() {
      // Play the audio notification
      if (this.sentAudioEnabled) {
        this.sentAudio.play();
      }
    },

    onMessageFailed: function thui_onMessageFailed(e) {
      let message = e.message;
      if (Startup.isActivity) {
        Toaster.showToast({
          messageL10nId: 'send-failed',
        });
        ActivityHandler.leaveActivity();
        return;
      }

      // When this is the first message in a thread, we haven't displayed
      // the new thread yet. The error flag will be shown when the thread
      // will be rendered. See Bug 874043

      // The all error logic are confirmed at gecko to make the gaia simple,
      // but the fail message may be received before sending message building
      // sometimes, so we need listen a event to mark error flag.
      function messageDOMCreated() {
        window.removeEventListener('message-dom-created', messageDOMCreated);
        ThreadUI.setMessageStatus(message.id, 'error');
        ThreadUI.scrollViewToBottom();
      }

      let messageDOM = document.getElementById('message-' + message.id);
      if (messageDOM) {
        this.setMessageStatus(message.id, 'error');
        this.scrollViewToBottom();
      } else {
        window.addEventListener('message-dom-created', messageDOMCreated);
      }
    },

    onDeliverySuccess: function thui_onDeliverySuccess(e) {
      let message = e.message;
      // We need to make sure all the recipients status got success event.
      if (!this.shouldShowDeliveryStatus(message)) {
        return;
      }

      this.setMessageStatus(message.id, 'delivered');
      this.scrollViewToBottom();
    },

    onReadSuccess: function thui_onReadSuccess(e) {
      let message = e.message;
      // We need to make sure all the recipients status got success event.
      if (!this.shouldShowReadStatus(message)) {
        return;
      }

      this.setMessageStatus(message.id, 'read');
    },

    // Some error return from sending error need some specific action instead of
    // showing the error prompt directly.
    showMessageSendingError: function thui_showMsgSendingError(errorName, opts) {
      // TODO: We handle NonActiveSimCard error in onMessageFailed because we
      // could not get message id from this error handler. Need to be removed when
      // bug 824717 is landed.
      if (errorName === 'NonActiveSimCardError') {
        this.showErrorInFailedEvent = errorName;
        return;
      }
      if (errorName === 'NotFoundError') {
        console.info('The message was deleted or is no longer available.');
        return;
      }
      this.showMessageError(errorName, opts);
    },

    showMessageError: function thui_showMessageOnError(errorCode, opts, isRetrieve) {
      if (Utils.isDialogShown()) {
        return;
      }
      let dialog = new ErrorDialog(Errors.get(errorCode, isRetrieve), opts);
      // Hide all option menus before dialog show.
      if (this.contactPromptOptionMenuShown) {
        this.optionMenu && this.optionMenu.hide();
        this.updateSKs(ThreadUI.currentSoftKey);
        this.contactPromptOptionMenuShown = false;
      }
      dialog.show();
    },

    removeMessageDOM: function thui_removeMessageDOM(messageDOM) {
      if (!messageDOM) {
        return;
      }
      let messagesContainer = messageDOM.parentNode;

      messageDOM.remove();

      // If we don't have any other messages in the list, then we remove entire
      // date group (date header + messages container).
      if (messagesContainer &&!messagesContainer.firstElementChild) {
        messagesContainer.parentNode.remove();
      }

      if (window.performance.getEntriesByName(
          'message-delete-start', 'mark').length > 0) {
        window.performance.mark('message-delete-end');
        window.performance.measure('performance-message-delete',
          'message-delete-start', 'message-delete-end');
        window.performance.clearMarks('message-delete-start');
        window.performance.clearMarks('message-delete-end');
      }
    },

    setMessageStatus: function(id, status) {
      let messageDOM = document.getElementById('message-' + id);

      if (!messageDOM || messageDOM.classList.contains(status)) {
        return;
      }

      let newStatusMarkup = this.getMessageStatusMarkup(status),
          oldStatusNode = messageDOM.querySelector('.message-status');

      messageDOM.classList.remove(
        'sending', 'pending', 'sent', 'received', 'delivered', 'read', 'error'
      );
      messageDOM.classList.add(status);
      messageDOM.querySelector('.deliver-mark').classList
        .toggle('hide', (status === 'delivered' ? false : true));

      if (oldStatusNode) {
        oldStatusNode.remove();
      }

      if (newStatusMarkup) {
        messageDOM.querySelector('.message-content-body-container').appendChild(
          newStatusMarkup.toDocumentFragment()
        );
      }
    },

    retrieveMMS: function thui_retrieveMMS(messageDOM) {
      // we need reject send/download MMS if data is OFF,
      // please check bug 56531 for detail.
      // VoWifi use data SIM card default.
      /* << [LIO-319]: BDC kanxj 20200622 merge for MMS with Mobile Data disabled >> */
      if (!Settings.allowMmsWhenDataOff && !Settings.dataEnable && !this.isVoWifiStatus(Settings.dataServiceId)) {
        Utils.alertDataOffStatus();
        return;
      }

      if (Startup.hasGroup && Settings.groupSwitchEnabled) {
        // TODO Use 0 card to retrieve MMS if not match, maybe need modify the logic.
        let serviceId = Settings.getServiceIdByIccId(messageDOM.dataset.iccId);
        serviceId = serviceId === null ? 0 : serviceId;
        Utils.judgeNumberSituation(serviceId, () => {
          this.realRetrieveMMS(messageDOM);
          Utils.recoveryAlertFocus(messageDOM);
        }, () => {
          Utils.recoveryAlertFocus(messageDOM);
        });
      } else {
        this.realRetrieveMMS(messageDOM);
      }
    },

    realRetrieveMMS: function thui_realRetrieveMMS(messageDOM) {
      // force a number
      let id = +messageDOM.dataset.messageId;
      let iccId = messageDOM.dataset.iccId;
      let request = MessageManager.retrieveMMS(id);
      let button = messageDOM.querySelector('button');

      this.setMessageStatus(id, 'pending');
      button.setAttribute('data-l10n-id', 'downloading-attachment');
      exports.option.hide();

      this.updateSKs();

      request.onsuccess = (() => {
        this.removeMessageDOM(messageDOM);

        Toaster.showToast({
          messageL10nId: 'download-complete',
          latency: 3000
        });
      });

      request.onerror = (() => {
        this.setMessageStatus(id, 'error');
        // Not need download string because softkey.
        button.setAttribute('data-l10n-id', '');
        button.textContent = '';

        // Show NonActiveSimCard/Other error dialog while retrieving MMS
        let errorCode = (request.error && request.error.name) ?
                        request.error.name : null;

        // Replacing error code to show more specific error message for this case
        if (errorCode === 'RadioDisabledError') {
          errorCode = 'RadioDisabledToDownloadError';
        }

        let serviceId = Settings.getServiceIdByIccId(iccId);
        if (errorCode === 'NonActiveSimCardError') {
          this.showMessageError('NonActiveSimCardError');
          return;
        }

        // Replacing unknown error to customize the download alert.
        if (errorCode === 'UnknownError') {
          errorCode = 'UnknownDownloadError';
        }

        if (errorCode) {
          this.showMessageError(errorCode, {
            confirmHandler: function stateResetAndRetry() {
              if (serviceId === null) {
                // TODO Bug 981077 should change this error message
                this.showMessageError('NoSimCardError');
              }
            }.bind(this)
          }, true);
        }
      });
    },

    resendMessage: function thui_resendMessage(id) {
      // force id to be a number
      id = +id;

      let request = MessageManager.getMessage(id);

      request.onsuccess = (() => {
        let message = request.result;

        let serviceId = Settings.getServiceIdByIccId(message.iccId);
        serviceId = serviceId === null ? 0 : serviceId;

        // According to the discussion, the alert order should be
        // storage full > airplane mode > no SIM > no data.
        if (Compose.type === 'mms' && ThreadListUI.isDiskFull) {
          Utils.alertFreeSpace('send');
          return;
        }

        // VoWifi use data SIM card default.
        if (this.isAirplaneState() &&
            !this.isVoWifiStatus(Settings.dataServiceId)) {
          this.showMessageError('RadioDisabledError');
          return;
        }

        if (Utils.isNoSIMStatus()) {
          this.showMessageError('NoSimCardError');
          return;
        }

        // VoWifi use data SIM card default.
        /* << [LIO-319]: BDC kanxj 20200622 merge for MMS with Mobile Data disabled >> */
        if (message.type === 'mms' && !Settings.dataEnable &&
            !this.isVoWifiStatus(Settings.dataServiceId) && !Settings.allowMmsWhenDataOff) {
          // we need reject send/download MMS if data is OFF,
          // please check bug 56531 for detail.
          Utils.alertDataOffStatus();
          return;
        }

        if (message.type === 'sms' && !this.isSMSAbleToSend(serviceId)) {
          return;
        } else if (message.type === 'mms' && !this.isMMSAbleToSend(serviceId)) {
          return;
        }

        let messageDOM = document.getElementById('message-' + id);

        if (message.type === 'mms' && Startup.hasGroup &&
            Settings.groupSwitchEnabled && message.isGroup) {
          Utils.judgeNumberSituation(serviceId, () => {
            this.realResendMessage(message, messageDOM);
            Utils.recoveryAlertFocus(messageDOM);
          }, () => {
            Utils.recoveryAlertFocus(messageDOM);
          });
        } else {
          this.realResendMessage(message, messageDOM);
        }
      });
    },

    realResendMessage: function thui_realResendMessage(message, messageDOM) {
      // Strategy:
      // - Delete from the DOM
      // - Resend (the resend will remove from the backend)
      // - resend accepts a optional callback that follows with
      // the result of the resending
      let resendOpts = {
        message: message,
        onerror: function onError(error) {
          let errorName = error.name;
          this.showMessageSendingError(errorName, { recipients: [message.receiver] });
        }.bind(this),
        onsuccess: function() {
          this.onMessageSendRequestCompleted();
        }.bind(this)
      };
      this.removeMessageDOM(messageDOM);
      // We need update the softkey information directly
      // because the DOM removed.
      this.dynamicThreadSK(this.FOCUS_ON_MESSAGE_INPUT);
      MessageManager.resendMessage(resendOpts);
    },

    toFieldKeypress: function(event) {
      if (event.keyCode === 13 || event.keyCode === event.DOM_VK_ENTER) {
        this.toggleRecipientSuggestions();
      }
    },

    toFieldInput: function(event) {
      if (event.isComposing) {
        return;
      }

      window.performance.mark('recipient-input-start');
      let typed;

      this.toField.classList.toggle('recipient-multi-line',
          this.toField.offsetHeight > this.RECIPIENTS_INPUT_FIELD_MAX_ONE);

      if (event.target.isPlaceholder) {
        typed = event.target.textContent.trim();
        if (!typed) {
          this.stopContactNavigation();
        }
        this.searchContact(typed, this.listContacts.bind(this));
      }

      this.emit('recipientschange');
    },

    exactContact: function thui_searchContact(fValue, handler) {
      Contacts.findExact(fValue, handler.bind(null, fValue));
    },

    searchContact: function thui_searchContact(fValue, handler) {
      clearTimeout(this.timer);
      if (!fValue) {
        // In cases where searchContact was invoked for "input"
        // that was actually a "delete" that removed the last
        // character in the recipient input field,
        // eg. type "a", then delete it.
        // Always remove the the existing results.
        this.toggleRecipientSuggestions();
        return;
      }

      let contactCount = navigator.mozContacts.getCount();
      contactCount.then((result) => {
        let delayTime = result * 2;
        this.timer = setTimeout(() => {
          Contacts.findByString(fValue, handler.bind(null, fValue));
        }, delayTime);
      });
    },

    validateContact: function thui_validateContact(source, fValue, contacts) {
      let isInvalid = true;
      let index = this.recipients.length - 1;
      let last = this.recipientsList.lastElementChild;
      let typed = last && last.textContent.trim();
      let isContact = false;
      let record, length, number, contact;

      if (index < 0) {
        index = 0;
      }

      let props = ['tel'];
      if (Settings.supportEmailRecipient) {
        props.push('email');
      }

      // If there is greater than zero matches,
      // process the first found contact into
      // an accepted Recipient.
      if (contacts && contacts.length) {
        isInvalid = false;
        record = contacts[0];
        let values = props.reduce((values, prop) => {
          let propValue = record[prop];
          if (propValue && propValue.length) {
            return values.concat(propValue);
          }

          return values;
        }, []);
        length = values.length;

        // Received an exact match with a single tel or email record
        if (source.isLookupable && !source.isQuestionable && length === 1) {
          if (Utils.probablyMatches(values[0].value, fValue)) {
            isContact = true;
            number = values[0].value;
          }
        } else {
          // Received an exact match that may have multiple tel records
          for (let i = 0; i < length; i++) {
            let propValue = values[i].value;
            if (this.recipients.numbers.indexOf(propValue) === -1) {
              number = propValue;
              break;
            }
          }

          // If number is not undefined, then it's safe to assume
          // that this number is unique to the recipient list and
          // can be added as an accepted recipient from the user's
          // known contacts.
          //
          // It _IS_ possible for this to appear to be a duplicate
          // of an existing accepted recipient: by display name ONLY;
          // however this case will always have a different number.
          //
          if (typeof number !== 'undefined') {
            isContact = true;
          } else {
            // If no number match could be made, then this
            // contact record is actually inValid.
            isInvalid = true;
          }
        }
      }

      // Either an exact contact with a single tel record was matched
      // or an exact contact with multiple tel records and we've taken
      // one of the non-accepted tel records to add a new recipient.
      if (isContact) {
        // Remove the last assimilated recipient entry.
        this.recipients.remove(index);

        contact = Utils.basicContact(number, record);
        contact.source = 'contacts';

        // Add the newly minted contact as an accepted recipient
        this.recipients.add(contact).focus();

        return;
      }

      // Received multiple contact matches and the current
      // contact record had a number that has already been
      // accepted as a recipient. Try the next contact in the
      // set of results.
      if (isInvalid && contacts.length > 1) {
        this.validateContact(source, fValue, contacts.slice(1));
        return;
      }

      // Plain numbers with no contact matches can never be "invalid"
      if (!source.isQuestionable && !length) {
        isInvalid = false;
      }

      // If there are no contacts matched
      // this input was definitely invalid.
      source.isInvalid = isInvalid;

      // Avoid colliding with an "edit-in-progress".
      if (!typed) {
        this.recipients.update(index, source).focus();
      }
    },

    listContacts: function thui_listContacts(fValue, contacts) {
      // If the user has cleared the typed input before the
      // results came back, prevent the results from being rendered
      // by returning immediately.
      if (!this.recipients.inputValue) {
        return;
      }

      this.toggleRecipientSuggestions();
      if (!contacts || !contacts.length) {
        if (this.listener) {
          this.stopContactNavigation();
        }
        return;
      }

      // There are contacts that match the input.
      let suggestionList = document.createDocumentFragment();

      // Render each contact in the contacts results
      let renderer = ContactRenderer.flavor('suggestion');

      contacts.forEach((contact) => {
        let rendererArg = {
          contact: contact,
          input: fValue,
          target: suggestionList,
          skip: this.recipients.numbers
        };

        renderer.render(rendererArg);
      });

      if (suggestionList.children.length > 0) {
        if (!this.listener) {
          this.startContactNavigation();
        }
        this.toggleRecipientSuggestions(suggestionList);
        if (window.performance.getEntriesByName(
            'recipient-input-start', 'mark').length > 0) {
          window.performance.mark('recipient-input-end');
          window.performance.measure('performance-recipient-input',
            'recipient-input-start', 'recipient-input-end');
          window.performance.clearMarks('recipient-input-start');
          window.performance.clearMarks('recipient-input-end');
        }
      } else if (this.listener) {
        this.stopContactNavigation();
      }
    },

    onHeaderActivation: function thui_onHeaderActivation() {
      // Do nothing while in participants list view.
      if (!Navigation.isCurrentPanel('thread')) {
        return;
      }

      let participants = Threads.active && Threads.active.participants;

      // >1 Participants will enter "group view"
      if (participants && participants.length > 1) {
        Navigation.toPanel('group-view', {
          id: Threads.currentId
        });
        return;
      }

      let number = this.headerText.dataset.number;

      let tel, email;
      if (Settings.supportEmailRecipient && Utils.isEmailAddress(number)) {
        email = number;
      } else {
        tel = number;
      }

      if (this.headerText.dataset.isContact === 'true') {
        this.promptContact({
          number: number
        });
      } else {
        this.prompt({
          number: tel,
          email: email,
          isContact: false
        });
      }
    },

    promptContact: function thui_promptContact(opts) {
      opts = opts || {};

      let inMessage = opts.inMessage || false;
      let number = opts.number || opts.email || '';
      let tel, email;

      if (Settings.supportEmailRecipient && Utils.isEmailAddress(number)) {
        email = number || '';
      } else {
        tel = number || '';
      }

      Contacts.findByAddress(number, (results) => {
        let isContact = results && results.length;
        let contact = results[0];
        let id;

        let fragment;

        if (isContact) {
          id = contact.id;
          fragment = document.createDocumentFragment();

          ContactRenderer.flavor('prompt').render({
            contact: contact,
            input: number,
            target: fragment
          });
        }

        this.prompt({
          number: tel,
          email: email,
          header: fragment,
          contactId: id,
          contact: contact,
          isContact: isContact,
          inMessage: inMessage
        });
      });
    },

    prompt: function thui_prompt(opt) {
      // If there is option menu, not create it again.
      if (document.getElementById('option-menu')) {
        return;
      }

      let complete = (() => {
        if (!Navigation.isCurrentPanel('thread')) {
          Navigation.toPanel('thread', { id: Threads.currentId });
        }
      });

      let thread = Threads.get(Threads.currentId);
      let number = opt.number || '';
      let email = opt.email || '';
      let isContact = opt.isContact || false;
      let inMessage = opt.inMessage || false;
      let header = opt.header;
      let contact = opt.contact;
      let items = [];
      let params, props;

      // Create a params object.
      //  - complete: callback to be invoked when a
      //      button in the menu is pressed
      //  - header: string or node to display in the
      //      in the header of the option menu
      //  - items: array of options to display in menu
      //
      if (!header && (number || email)) {
        header = document.createElement('bdi');
        header.className = 'unknown-contact-header';
        header.textContent = number || email;
      }

      params = {
        classes: ['group-menu', 'softkey'],
        complete: complete,
        header: header || '',
        items: null,
        menuClassName: 'menu-button'
      };

      // All non-email activations (except for single participant thread) will
      // see a "Call" option
      if (!email) {
        // Multi-participant activations or in-message numbers
        // will include a "Call" and "Send Message" options in the menu
        if ((thread && thread.participants.length > 1) || inMessage) {
          items.push({
            l10nId: 'sendMessage',
            method: function oMessage(number, contact) {
              ThreadUI.composerContainer.classList.remove('next-focus');
              document.querySelector('.current-focus').classList.remove('current-focus');
              ActivityPicker.sendMessage(number, contact);
              ThreadUI.contactPromptOptionMenuShown = false;
            },
            params: [number, contact],
            // As activity picker changes the panel we don't want
            // to call 'complete' that changes the panel as well
            incomplete: true
          });
        }
      }

      params.items = items;

      if (!isContact) {
        props = [
          number ? { tel: number } : { email: email }
        ];

        // Unknown participants will have options to
        //  - Create A New Contact
        //  - Add To An Existing Contact
        //
        params.items.push({
          l10nId: 'createNewContact',
          method: function oCreate(param) {
            ActivityPicker.createNewContact(
              param, ThreadUI.onCreateContact, function() {
                ThreadUI.updateSKs(ThreadUI.currentSoftKey);
              }
            );
            ThreadUI.contactPromptOptionMenuShown = false;
          },
          params: props
        }, {
          l10nId: 'addToExistingContact',
          method: function oAdd(param) {
            ActivityPicker.addToExistingContact(
              param, ThreadUI.onCreateContact, function() {
                ThreadUI.updateSKs(ThreadUI.currentSoftKey);
              }
            );
            ThreadUI.contactPromptOptionMenuShown = false;
          },
          params: props
        });
      }

      if (opt.contactId && !ActivityHandler.isInActivity()) {
        props = [{ id: opt.contactId }];
        params.items.push({
          l10nId: 'viewContact',
          method: function oView(param) {
            ActivityPicker.viewContact(param, () => {
              ThreadUI.updateSKs(ThreadUI.currentSoftKey);
            }, () => {
              ThreadUI.updateSKs(ThreadUI.currentSoftKey);
            });
            ThreadUI.contactPromptOptionMenuShown = false;
          },
          params: props
        });
      }

      // Menu should not be displayed if no option required, otherwise all
      // activations will see a "Cancel" option
      if (params.items.length === 0) {
        return;
      }

      if (!this.optionMenuShown) {
        if (typeof OptionMenu === 'undefined') {
          LazyLoader.load(['/shared/js/option_menu.js',
                           '/style/action_menu.css',
                           '/shared/style/option_menu.css'], () => {
            this.optionMenu = new OptionMenu(params);
            this.optionMenu.show();
            this.contactPromptOptionMenuShown = true;
            this.updateSKs(promptContactOption);
          });
        } else {
          this.optionMenu = new OptionMenu(params);
          this.optionMenu.show();
          this.contactPromptOptionMenuShown = true;
          this.updateSKs(promptContactOption);
        }
      }
    },

    onCreateContact: function thui_onCreateContact() {
      ThreadListUI.updateContactsInfo();
      // Update Header if needed
      if (Navigation.isCurrentPanel('thread')) {
        ThreadUI.updateHeaderData();
        ThreadUI.updateSKs(ThreadUI.currentSoftKey);
      }
    },

    discardDraft: function thui_discardDraft(update) {
      // If we were tracking a draft
      // properly update the Drafts object
      // and ThreadList entries
      if (this.draft) {
        Drafts.delete(this.draft).store();
        if (Threads.active) {
          ThreadListUI.updateThread(Threads.active);
        } else {
          ThreadListUI.removeThread(this.draft.id);
        }
        this.draft = null;
      }
      if ((!Compose.isEmpty() ||
           (this.recipients && this.recipients.length)) &&
          !this.EndKeySave && !update) {
        ThreadListUI.onDraftDiscarded();
      }
      if (Threads.keyword) {
        Threads.keyword = null;
      }
    },

    /**
     * saveDraft
     *
     * Saves the currently unsent message content or recipients
     * into a Draft object.  Preserves the currently marked
     * draft if specified.  Draft preservation is intended to
     * keep this.draft populated with the currently
     * showing draft when the app is hidden, so when the app
     * comes out of hiding, it knows there is a draft to continue
     * to keep track of.
     *
     * @param {Object} opts Optional parameters for saving a draft.
     *                  - preserve, boolean whether or not to preserve draft.
     *                  - autoSave, boolean whether this is an auto save.
     *
     * @param {Object} backData Necessary parameters for saving a draft.
     *                          We need backUp the need saved draft data to
     *                          confirm the correct order.
     * @param {Object} callback Optional parameters for save draft from end key.
     */
    realSaveDraft: function thui_saveDraft(opts, backData, callback) {
      let content, draft, recipients, subject, attachment, thread, threadId, type, draftId;
      content = backData.content;
      recipients = backData.recipients;
      subject = backData.subject;
      attachment = backData.attachment;
      threadId = backData.threadId;
      type = backData.type;
      draftId = backData.draftId;

      MessageManager.findThreadFromNumber(recipients).then(
        (Id) => {
          return new Promise((resolve) => {
            resolve(Id);
          });
        },
        () => {
          return new Promise((resolve) => {
            resolve(null);
          });
        }
      ).then((messageThreadId) => {
        if (!threadId) {
          threadId = messageThreadId;
        }

        draft = new Draft({
          recipients: recipients,
          content: content,
          subject: subject,
          threadId: threadId,
          type: type,
          attachment: attachment,
          id: draftId,
          isGroup: Settings.isGroup
        });

        if (threadId) {
          ThreadUI.discardDraft(true);
        }

        Drafts.add(draft);

        // If an existing thread list item is associated with
        // the presently saved draft, update the displayed Thread
        if (threadId) {
          thread = Threads.get(threadId) || Threads.active;

          // Overwrite the thread's own timestamp with
          // the drafts timestamp.

          ThreadListUI.updateThread(thread, {timestamp: draft.timestamp});
        } else {
          ThreadListUI.updateThread(draft);
        }

        // Only back to thread when save at document not hidden.
        // When switch between threads, not need recovery thread focus.
        if (!document.hidden && !(opts && opts.keyFlag === 'saveDraft')) {
          ThreadListUI.recoveryDraftFocus(threadId || draft.id);
        }

        // Clear the MessageManager draft if
        // not explicitly preserved for the
        // draft replacement case
        if (!opts || (opts && !opts.preserve)) {
          this.draft = null;
        }

        // Set the MessageManager draft if it is
        // not already set and meant to be preserved
        if (!this.draft && (opts && opts.preserve)) {
          this.draft = draft;
        }

        // Show draft saved banner if not an
        // auto save operation
        if (!opts || (opts && !opts.autoSave)) {
          ThreadListUI.onDraftSaved();
        }

        // Reset the isGroup flag when save draft completely.
        Settings.isGroup = false;
        if (opts && opts.keyFlag === 'saveDraft') {
          callback && callback();
        }
      });
    },

    saveDraft: function(opts, callback) {
      let backData = ThreadUI.backUpDraftData();

      // Need block the save draft action when low disk space
      // because the local storage fail.
      if (callback) {
        if (!opts || (opts && opts.keyFlag !== 'saveDraft')) {
          callback();
        }
      }
      if (ThreadListUI.isDiskFull) {
        if (opts && !opts.autoSave) {
          this.showLowSpaceAlert();
          if (Navigation.isCurrentPanel('composer') && opts.keyPress === 'back') {
            Recipients.View.isFocusable = true;
            this.recipients.focus();
          }
        }
      } else {
        this.realSaveDraft(opts, backData, callback);
      }
    },

    // Because the low-space data get need time, and
    // the gecko can not provide the space listen for gaia apps,
    // so have to use the backUp data to confirm the order normal.
    backUpDraftData: function() {
      let content, recipients, subject, attachment, threadId, type;
      content = Compose.getContent(true);
      subject = Compose.getSubject();
      attachment = Compose.getAttachment();
      type = Compose.type;

      if (Threads.keyword) {
        Threads.currentId = null;
        Threads.keyword = null;
      }
      if (Threads.active) {
        recipients = Threads.active.participants;
        threadId = Threads.currentId;
      } else {
        recipients = this.recipients.numbers;
      }

      let draftId = this.draft ? this.draft.id : null;

      return {
        content: content,
        recipients: recipients,
        subject: subject,
        attachment: attachment,
        threadId: threadId,
        type: type,
        draftId: draftId
      };
    },

    showLowSpaceAlert: function() {
      Toaster.showToast({
        messageL10nId: 'space-low-not-save',
      });
    },

    /**
     * Shows recipient suggestions if available, otherwise removes it from the DOM
     * and hides suggestions container.
     * @param {DocumentFragment} suggestions DocumentFragment node that contains
     * recipient suggestion to display.
     */
    toggleRecipientSuggestions: function(suggestions) {
      let contactList = this.recipientSuggestions.querySelector('.contact-list');

      this.recipientSuggestions.classList.toggle('hide', !suggestions);

      if (!suggestions) {
        contactList.textContent = '';
      } else {
        contactList.appendChild(suggestions);
        this.recipientSuggestions.scrollTop = 0;
      }
    },

    selectRecipientSuggestion: function() {
      let selected =
        document.querySelector('#messages-recipient-suggestions li.selected a');
      if (selected) {
        new Promise((resolve) => {
          selected.click();
          resolve();
        }).then(() => {
          this.stopContactNavigation();
          let recipient_focus = document.getElementById('messages-to-field');
          recipient_focus.lastChild.focus();
          this.updateSKs(threadUiAddContact);
        });
      }
    },

    /**
     * If the bubble selection mode is disabled, all the non-editable element
     * should be set to user-select: none to prevent selection triggered
     * unexpectedly. Selection functionality should be enabled only by bubble
     * context menu. While in bubble selection mode, context menu is disabled
     * temporary for better use experience.
     * Since long press is used for context menu first, selection need to be
     * triggered by selection API manually. Focus/blur events are used for
     * simulating selection changed event, which is only been used in system.
     * When the node gets blur event, bubble selection mode should be dismissed.
     * @param {Object} node element that contains message bubble text content.
     */
    enableBubbleSelection: function(node) {
      let threadMessagesClass = this.threadMessages.classList;
      let disable = () => {
        this.container.addEventListener('contextmenu', this);
        node.removeEventListener('blur', disable);
        threadMessagesClass.add('editable-select-mode');
        // TODO: Remove this once the gecko could clear selection automatically
        // in bug 1101376.
        window.getSelection().removeAllRanges();
      };

      node.addEventListener('blur', disable);
      this.container.removeEventListener('contextmenu', this);
      threadMessagesClass.remove('editable-select-mode');
      node.focus();
      window.getSelection().selectAllChildren(node);
    },

    startContactNavigation: function() {
      this.removeAllFocusable();
      NavigationMap.reset('thread-messages');
      window.addEventListener('keydown', this.handleContactList);
      this.listener = true;
    },

    stopContactNavigation: function() {
      this.recoverAllFocusable();
      NavigationMap.reset('thread-messages');
      window.removeEventListener('keydown', this.handleContactList);
      this.listener = false;
    },

    removeAllFocusable: function() {
      this.focusableElement =
        document.querySelector('#thread-messages').querySelectorAll('.navigable');
      let elements = Array.prototype.slice.call(this.focusableElement);
      elements.forEach((element) => {
        if (!element.classList.contains('recipient')) {
          element.classList.remove('navigable');
        }
      });
    },

    recoverAllFocusable: function() {
      if (this.focusableElement) {
        let elements = Array.prototype.slice.call(this.focusableElement);
        elements.forEach(function(element) {
          if (!element.classList.contains('recipient')) {
            element.classList.add('navigable');
          }
        });
        this.focusableElement = null;
      }
    },

    handleContactList: function(e) {
      let suggestionList =
        document.querySelectorAll('#messages-recipient-suggestions li');
      let selected =
        document.querySelector('#messages-recipient-suggestions li.selected');
      switch (e.key) {
        case 'ArrowUp':
          if (selected) {
            if (selected.previousSibling) {
              selected.classList.remove('selected');
              selected.previousSibling.classList.add('selected');
              document.querySelector('.selected').scrollIntoView(true);
            } else {
              selected.classList.remove('selected');
            }
          } else {
            suggestionList[suggestionList.length - 1].classList.add('selected');
            suggestionList[suggestionList.length - 1].scrollIntoView(true);
          }
          e.preventDefault();
          break;
        case 'ArrowDown':
          if (selected) {
            if (selected.nextSibling) {
              selected.classList.remove('selected');
              selected.nextSibling.classList.add('selected');
              document.querySelector('.selected').scrollIntoView(false);
            } else {
              selected.classList.remove('selected');
            }
          } else {
            suggestionList[0].classList.add('selected');
            suggestionList[0].scrollIntoView(true);
          }
          e.preventDefault();
          break;
      }
    },

    subjectManagement: function() {
      if (Compose.isSubjectVisible) {
        Compose.hideSubject();
      } else {
        Compose.showSubject();
      }
      NavigationMap.navSetup('thread-messages', '.navigable');
      option.menuVisible = false;
      let index;
      if (Compose.isSubjectVisible) {
        index = this.getItemIndex(
            NavigationMap.getCurrentControl().elements, 'subject-composer-input');
        NavigationMap.setFocus(index);
      } else {
        index = this.getItemIndex(
            NavigationMap.getCurrentControl().elements, 'messages-input');
        NavigationMap.setFocus(index);
      }
    },

    getItemIndex: function(elements, id) {
      let index, length = elements.length;
      for (let i = 0; i < length; i++) {
        if (elements[i].id === id) {
          index = i;
          break;
        }
      }
      return index;
    },

    _forwardMessage: function (messageId) {
      document.dispatchEvent(new CustomEvent('stop-getMessages'));
      Utils.findBodyContent(messageId, (needLimit) => {
        Utils.operatorCreationMode(needLimit, (isLimit) => {
          if (isLimit) {
            return;
          }

          Navigation.toPanel('composer', {
            id: Threads.currentId,
            keyword: 'forward',
            forward: {
              messageId: messageId
            }
          });
        })
      });
    },

    _getFocusedMessageId: function(forcusedItem) {
      if (forcusedItem.tagName !== 'LI') {
        let item = this.getParents(forcusedItem, 'LI');
        return item.dataset.messageId;
      } else {
        return forcusedItem.dataset.messageId;
      }
    },

    longPressEvent: function() {
      if ((Navigation.isCurrentPanel('thread') ||
           Navigation.isCurrentPanel('composer')) &&
          (Compose.isFocused() || Compose.isSubjectFocused() ||
           (!!this.recipients && this.recipients.isFocused()))) {
        if (Compose.isSubjectFocused()) {
          this.subjectManagement();
        } else if (!!this.recipients && this.recipients.isFocused()) {
          this.recipients.deleteAll();
          this.recipients.focus();
        }
      }
    },

    updateSksOnRecipientChanged: function(lenght) {
      if (lenght === 0) {
        this.updateSKs(threadUiAddContact);
      } else {
        this.updateSKs(threadUIAddContactWithInput);
      }
    },

    getSksForSaveDraft: function(skParam) {
      let updateSkParam = {
        header: { l10nId:'options' },
        items: []
      };
      updateSkParam.items = Array.prototype.concat.apply([], skParam.items);
      updateSkParam.items.push(skSaveAsDraft);
      updateSkParam.items.push(skCancel);
      return updateSkParam;
    },

    onFocusChanged: function() {
      if (document.activeElement.tagName === 'BODY') {
        document.querySelector('.focus').focus();
      }

      Utils.menuOptionVisible = false;
      this.dynamicSK();
    },

    disableInputEnter: function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    },

    getFocusState: function(focusEl) {
      let focusState = this.FOCUS_INVALID;
      if (focusEl.parentNode === this.selector.recipient) {
        focusState = this.FOCUS_ON_RECIPIENTS;
      } else if (focusEl === this.selector.subject) {
        focusState = this.FOCUS_ON_SUBJECT;
      } else if (focusEl === this.selector.textField) {
        focusState = this.FOCUS_ON_MESSAGE_INPUT;
      } else if (this.getParents(focusEl, 'UL').classList.contains('message-list')) {
        focusState = this.FOCUS_ON_MESSAGE_THREAD;
      } else if (focusEl.classList.contains('attachment-composer')) {
        focusState = this.FOCUS_ON_ATTACHMENT;
       }
      return focusState;
    },

    dynamicComposerSK: function(focusState) {
      let skParam;
      switch (focusState) {
        case this.FOCUS_INVALID:
          return;
          break;
        case this.FOCUS_ON_RECIPIENTS:
          if (this.recipientsList.lastChild.textContent.length !== 0) {
            skParam = threadUIAddContactWithInput;
          } else {
            if (Compose.disableSendButton()) {
              skParam = threadUiAddContact;
            } else {
              skParam = threadUiAddContact_send;
              skParam = this.selectSIMSend(skParam);
            }
          }
          break;
        case this.FOCUS_ON_SUBJECT:
          if (!Compose.disableSendButton()) {
            skParam = threadUiComposerOptionsWithSubRemove_Send_Subfocused;
            skParam = this.selectSIMSend(skParam);
          } else {
            skParam = threadUiComposerOptionsWithSubRemove_subfocused;
          }
          if (!Compose.isEmpty()) {
            skParam = this.getSksForSaveDraft(skParam);
          }
          break;
        case this.FOCUS_ON_MESSAGE_INPUT:
          if (!Compose.disableSendButton()) {
            if (Compose.isSubjectVisible) {
              skParam = threadUiComposerOptionsWithSubRemove_Send;
            } else {
              if (Settings.mmsEnable) {
                skParam = threadUiComposerOptionsWithSend;
              } else {
                skParam = threadUiComposerOptionsWithSend_noMMS;
              }
            }
            skParam = this.selectSIMSend(skParam);
          } else if (Compose.isSubjectVisible) {
            skParam = threadUiComposerOptionsWithSubRemove;
          } else {
            if (Settings.mmsEnable) {
              skParam = threadUiComposerOptions;
            } else {
              skParam = threadUiComposerOptions_noMMS;
            }
          }
          if (!Compose.isEmpty()) {
            skParam = this.getSksForSaveDraft(skParam);
          }

          if (Compose.size > Settings.mmsSizeLimitation &&
              skParam.items[0].l10nId === 'send') {
            skParam.items.splice(0, 1);
          }
          break;
        case this.FOCUS_ON_ATTACHMENT:
          let attachmentMessage = document.getElementById('attachmentMessage');
          if (attachmentMessage.getAttribute('aria-hidden') === 'false') {
            AttachmentMessageUI.updateSKs();
            return;
          }

          if (!Compose.disableSendButton()) {
            if (Compose.isSubjectVisible) {
              skParam = threadUiComposerOptionsWithAttachment_sub_send;
            } else {
              skParam = threadUiComposerOptionsWithAttachment_send;
            }
            skParam = this.selectSIMSend(skParam);
          } else {
            if (Compose.isSubjectVisible) {
              skParam = threadUiComposerOptionsWithAttachment_sub;
            } else {
              skParam = threadUiComposerOptionsWithAttachment;
            }
          }

          skParam = this.getSksForSaveDraft(skParam);
          break;
        default:
          break;
      }

      if (focusState !== this.FOCUS_ON_RECIPIENTS) {
        this.addSoftkeyWithRemoveAttchment(skParam);
      }
      this.updateSKs(skParam);
    },

    dynamicThreadSK: function(focusState, focusEl) {
      // When contact dialog shown, not update thread softkey.
      if (this.contactPromptOptionMenuShown) {
        return;
      }

      let skParam;
      switch (focusState) {
        case this.FOCUS_INVALID:
          return;
          break;
        case this.FOCUS_ON_SUBJECT:
          if (Compose.isEmpty()) {
            skParam = threadUiNormalOptionsWithSubRemove_Subfocused;
          } else {
            skParam = this.getSksForSaveDraft(
                threadUiNormalOptionsWithSubRemove_Send_Subfocused);
            skParam = this.selectSIMSend(skParam);
          }
          break;
        case this.FOCUS_ON_MESSAGE_INPUT:
          if (Compose.isEmpty()) {
            if (Compose.isSubjectVisible) {
              skParam = threadUiNormalOptionsWithSubRemove;
            } else {
              if (Settings.mmsEnable) {
                skParam = threadUiNormalOptions;
              } else {
                skParam = threadUiNormalOptions_noMMS;
              }
            }
          } else {
            if (Compose.isSubjectVisible) {
              skParam = threadUiNormalOptionsWithSubRemove_Send;
            } else {
              if (Settings.mmsEnable) {
                skParam = threadUiNormalOptionsWithSend;
              } else {
                skParam = threadUiNormalOptionsWithSend_noMMS;
              }
            }
            skParam = this.selectSIMSend(skParam);
            skParam = this.getSksForSaveDraft(skParam);

            if (Compose.size > Settings.mmsSizeLimitation &&
                skParam.items[0].l10nId === 'send') {
              skParam.items.splice(0, 1);
            }
          }
          break;
        case this.FOCUS_ON_MESSAGE_THREAD:
          this._storeFocused = focusEl;
          break;
        case this.FOCUS_ON_ATTACHMENT:
          let attachmentMessage = document.getElementById('attachmentMessage');
          if (attachmentMessage.getAttribute('aria-hidden') === 'false') {
            AttachmentMessageUI.updateSKs();
            return;
          }

          if (Compose.isSubjectVisible) {
            skParam = threadUiNormalOptionsWithAttachment_sub_send;
          } else {
            skParam = threadUiNormalOptionsWithAttachment_send;
          }
          skParam = this.selectSIMSend(skParam);
          skParam = this.getSksForSaveDraft(skParam);
          break;
        default:
          break;
      }

      if (focusState === this.FOCUS_ON_SUBJECT ||
          focusState === this.FOCUS_ON_MESSAGE_INPUT ||
          focusState === this.FOCUS_ON_ATTACHMENT) {
        // Add the call or email option dynamically.
        skParam = this.updateCallOrEmail(skParam);
        // Add the remove all attachments option dynamically.
        skParam = this.addSoftkeyWithRemoveAttchment(skParam);
      }

      this.updateSKs(skParam);
    },

    addSoftkeyWithRemoveAttchment: function(param) {
      if (param.items.indexOf(skRemoveAttachment) !== -1) {
        param.items.splice(param.items.indexOf(skRemoveAttachment), 1);
        return this.addSoftkeyWithRemoveAttchment(param);
      }

      let hasAttachment = !(Compose.getMessageCount() === 0);
      if (hasAttachment) {
        let addLocation = param.items.indexOf(skAddAttachment) + 1;
        param.items.splice(addLocation, 0, skRemoveAttachment);
      }

      return param;
    },

    dynamicSK: function() {
      if (window.option && window.option.menuVisible) {
        return;
      }
      if (Utils.isDialogShown()) {
        console.log('confirm dialog is showing');
        return;
      }
      let currentFocus = document.querySelector('.focus');
      if (!currentFocus) {
        return;
      }
      if (document.activeElement.id !== currentFocus.id) {
        currentFocus.focus();
      }
      let focusState = this.getFocusState(currentFocus);
      if (Navigation.isCurrentPanel('composer')) {
        this.dynamicComposerSK(focusState);
      } else if (Navigation.isCurrentPanel('thread')) {
        this.dynamicThreadSK(focusState, currentFocus);
      }
    },

    isAirplaneState: function() {
      let conn = navigator.mozMobileConnections &&
                 navigator.mozMobileConnections[0];
      return conn && conn.radioState === 'disabled';
    },

    isSMSAbleToSend: function(serviceId) {
      let conn = navigator.mozMobileConnections &&
                 navigator.mozMobileConnections[serviceId];
      let voice = conn && conn.voice;
      let imsHandler = conn && conn.imsHandler;
      // Check 4G LTE or VoWifi fist
      if (imsHandler && imsHandler.capability) {
        // can send
        return true;
      }
      // Check voice state next
      else if (voice && voice.state === 'registered') {
        // can send
        return true;
      }
      // Data is not good
      else {
        // Not air plane mode && has SIM card
        if (conn && conn.radioState === 'enabled' && conn.iccId !== null) {
          this.showMessageError('NoSignalError');
          return false;
        }

        // Handle other situations by message sending process.
        return true;
      }
    },

    isMMSAbleToSend: function(serviceId) {
      let conn = navigator.mozMobileConnections &&
                 navigator.mozMobileConnections[serviceId];
      let data = conn && conn.data;
      let imsHandler = conn && conn.imsHandler;
      // Check whether the data is active SIM card first.
      if (Settings.hasSeveralSim() && Settings.dataServiceId !== serviceId) {
        this.showMessageError('NonActiveSimCardToSendError');
        return false;
      }

      // Check 4G LTE or VoWifi.
      if (imsHandler && imsHandler.capability) {
        // can send
        return true;
      }
      // Check data state last, registered for major card.
      else if (data && data.state === 'registered') {
        // can send
        return true;
      }
      // Data is not good
      else {
        // Not air plane mode && has SIM card
        if (conn && conn.radioState === 'enabled' && conn.iccId !== null) {
          this.showMessageError('NoSignalError');
          return false;
        }

        // Handle other situations by message sending process.
        return true;
      }
    },

    isVoWifiStatus: function(serviceId) {
      if (!serviceId) {
        serviceId = 0;
      }

      let conn = navigator.mozMobileConnections &&
                 navigator.mozMobileConnections[serviceId];
      let imsHandler = conn && conn.imsHandler;
      return (imsHandler && (imsHandler.capability === 'voice-over-wifi' ||
                             imsHandler.capability === 'video-over-wifi'));
    },

    startSendMessage: function () {
      let serviceId = Settings.smsServiceId;
      if (serviceId === null) {
        serviceId = 0;
      }

      // According to the discussion, the alert order should be
      // storage full > airplane mode > no SIM > no data.
      if (Compose.type === 'mms' && ThreadListUI.isDiskFull) {
        Utils.alertFreeSpace('send');
        return;
      }

      // VoWifi use data SIM card default.
      if (this.isAirplaneState() && !this.isVoWifiStatus(Settings.dataServiceId)) {
        this.showMessageError('RadioDisabledError');
        return;
      }

      if (Utils.isNoSIMStatus()) {
        this.showMessageError('NoSimCardError');
        return;
      }

      // VoWifi use data SIM card default.
      /* << [LIO-319]: BDC kanxj 20200622 merge for MMS with Mobile Data disabled >> */
      if (Compose.type === 'mms' && !Settings.dataEnable &&
          !this.isVoWifiStatus(Settings.dataServiceId) && !Settings.allowMmsWhenDataOff) {
        // we need reject send/download MMS if data is OFF,
        // please check bug 56531 for detail.
        Utils.alertDataOffStatus();
        return;
      }

      if (serviceId === -1) {
        if (Settings.hasSeveralSim()) {
          // If there is option menu, not create it again.
          if (!document.getElementById('option-menu')) {
            this.simSelectOptions();
          }
        } else {
          let simServiceId = this.selectSIMCard();
          this.sendMessage({serviceId: simServiceId});
        }
      } else if (serviceId === 0 || serviceId === 1) {
        this.sendMessage({serviceId: serviceId});
      } else {
        console.log('Not handle serviceId = ' + serviceId);
      }
    },

    selectSIMCard: function () {
      for (let i = 0; i < Settings._serviceIds.length; i++) {
        if (Settings._serviceIds[i] !== null &&
            Settings._serviceIds[i].iccId !== null) {
          return i;
        }
      }
    },

    selectSIMSend: function (params) {
      // Confirm the send always correct.
      if (params.items.indexOf(skSendSIM1) !== -1) {
        params.items.splice(params.items.indexOf(skSendSIM1), 1);
        return this.selectSIMSend(params);
      } else if (params.items.indexOf(skSendSIM2) !== -1) {
        params.items.splice(params.items.indexOf(skSendSIM2), 1);
        return this.selectSIMSend(params);
      } else if (params.items.indexOf(skSend) !== -1) {
        params.items.splice(params.items.indexOf(skSend), 1);
        return this.selectSIMSend(params);
      }

      if (Compose.isEmpty() ||
          (Settings.mmsEnable &&
           (Compose.size > Settings.mmsSizeLimitation)) ||
          (!Settings.mmsEnable &&
           (Compose.segmentInfo.segments > Settings.maxConcatenatedMessages))) {
        return params;
      }

      if (Settings.isDualSimDevice() && Settings.hasSeveralSim()) {
        switch (Settings.smsServiceId) {
          case 0:
            params.items.unshift(skSendSIM1);
            break;
          case 1:
            params.items.unshift(skSendSIM2);
            break;
          case -1:
            params.items.unshift(skSend);
            break;
          default:
            break;
        }
      } else {
        params.items.unshift(skSend);
      }

      return params;
    }
  };

  Object.defineProperty(ThreadUI, 'allInputs', {
    get: function() {
      return this.getAllInputs();
    }
  });

  Object.defineProperty(exports, 'ThreadUI', {
    get: function () {
      delete exports.ThreadUI;

      let allowedEvents = ['recipientschange'];
      return (exports.ThreadUI = EventDispatcher.mixin(ThreadUI, allowedEvents));
    },
    configurable: true,
    enumerable: true
  });
}(this));
