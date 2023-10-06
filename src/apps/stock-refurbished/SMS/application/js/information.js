/*global Utils, Template, Threads, ThreadUI, MessageManager, ContactRenderer,
         Contacts, Settings, Navigation
 */

/*exported Information */

(function(exports) {
  'use strict';

  /*
    Information view module is a subpanel belongs to TheadUI panel. This
    module provide some default  method for thiw view module:

    show: Reuse the ThreadUI page for information view. Hiding unrelated icon,
          reset the header, and render container for  showing the view.

    reset: Hide the view container, clean up the contact list and resume the
           icons/header for ThreadUI.

    renderContactList(participants, options): Rendering group-view style contact
                                              list inside the page. Participants
                                              is an array of contact number and
                                              option is for setting additional
                                              information for rendering other
                                              lock for contact information.
  */
  let TMPL = function createTemplate(tmpls) {
    for (let key in tmpls) {
      tmpls[key] = Template(tmpls[key]);
    }
    return tmpls;
  }({
    number: 'messages-number-tmpl',
    report: 'information-report-tmpl'
  });

  /*
   Summarized single status based on delivery and read status for mms.
   The 1st level properties represents delivery status and 2nd level properties
   represents read status.
   */
  const REPORT_MAP = {
    'not-applicable': {
      'not-applicable': 'not-applicable',
      'pending' : 'pending',
      'success' : 'read',
      'error' : 'error'
    },
    'pending' : {
      'not-applicable': 'pending',
      'pending': 'pending',
      'success' : 'read',   // should not possible
      'error' : 'error'
    },
    'success' : {
      'not-applicable': 'delivered',
      'pending': 'delivered',
      'success' : 'read',
      'error' : 'error'
    },
    'error' : {
      'not-applicable': 'error',
      'pending': 'error',
      'success' : 'error', // should not possible
      'error' : 'error'    // should not possible
    }
  };

  // Register the message events we wanted for report view refresh
  const MESSAGE_EVENTS = [
    'message-failed-to-send',
    'message-delivered',
    'message-read',
    'message-sent',
    'message-sending'
  ];

  function completeLocaleFormat(timestamp) {
    Utils.initDateTime(timestamp);
    return Utils.getInformationDate();
  }

  function l10nContainsDateSetup(element, timestamp) {
    element.textContent = completeLocaleFormat(timestamp);
  }

  // Generate report Div contains delivery report and read report for showing
  // report information within contact list
  function createReportDiv(reports) {
    let reportDiv = document.createElement('div');
    let data = {
      titleL10n: '',
      reportDateL10n: '',
      timestamp: ''
    };
    let status;
    let deliveryStatus = reports.deliveryStatus;
    let readStatus = reports.readStatus;

    if (!readStatus) {  // sms
      status = deliveryStatus === 'success' ? 'delivered' : deliveryStatus;
    } else if (deliveryStatus === 'rejected') {
      // Status = 'rejected' when receiver is not allowed to download any mms
      status = 'rejected';
    } else if (deliveryStatus in REPORT_MAP) {
      status = REPORT_MAP[deliveryStatus][readStatus];
    } else {
      console.error('Invalid message report status: ' + deliveryStatus);
      return reportDiv;
    }
    reportDiv.dataset.deliveryStatus = status;

    switch (status) {
      case 'not-applicable':
        return reportDiv;
      case 'delivered':
        data.timestamp = '' + reports.deliveryTimestamp;
        data.reportDateL10n = completeLocaleFormat(reports.deliveryTimestamp);
        break;
      case 'read':
        data.timestamp = '' + reports.readTimestamp;
        data.reportDateL10n = completeLocaleFormat(reports.readTimestamp);
        break;
    }
    data.titleL10n = 'report-status-' + status;
    reportDiv.innerHTML = TMPL.report.interpolate(data);

    return reportDiv;
  }

  function showSimInfo(element, iccId) {
    let iccManager = navigator.mozIccManager;
    // Hide the element when single SIM or no iccManager/mobileConnections
    if (!(Settings.hasSeveralSim() && iccId && iccManager)) {
      return;
    }

    let simId = Settings.getServiceIdByIccId(iccId);
    let serviceId = Settings.getServiceIdByIccId(iccId);
    let operator = '';
    if (serviceId !== null) {
      operator = Settings.getOperatorByIccId(iccId);
    }
    let iccObject = iccManager.getIccById(iccId);
    let number = '';
    if (iccObject) {
      number = iccManager.getIccById(iccId).iccInfo.msisdn;
    }
    let data = {};
    let l10nId;

    let info = [operator, number].filter(function(value) {
      return value;
    });

    let detailString = info.join(', ');

    if (simId !== null) {
      l10nId = info.length ?  'sim-detail' : 'sim-id-label';
      data = { id: simId + 1, detailString: detailString };
      navigator.mozL10n.setAttributes(
        element.querySelector('.sim-detail'),
        l10nId,
        data
      );
    } else {
      element.querySelector('.sim-detail').textContent = detailString;
    }

    if (simId !== null || number !== '' || operator !== '') {
      element.classList.remove('hide');
    } else {
      element.classList.add('hide');
    }
  }

  // Incoming message: return array of sender number string;
  // Outgoing message: return array of object(number and report div block).
  function createListWithMsgInfo(message) {
    let list = [];
    if (message.delivery === 'received' ||
        message.delivery === 'not-downloaded') { // received message
      list.push(message.sender);
      if (message.isGroup) {
        let receiverArray = Array.isArray(message.receivers) ?
                            message.receivers : [message.receivers];
        receiverArray.forEach((receiver) => {
          list.push(receiver);
        });
      }
    } else if (message.type === 'mms') { // sent mms message
      message.deliveryInfo.forEach(function(info) {
        list.push({ number: info.receiver, infoBlock: createReportDiv(info) });
      });
    } else {  // sent sms message
      let info = {};
      info.deliveryStatus = message.deliveryStatus;
      info.deliveryTimestamp = message.deliveryTimestamp;
      list.push({ number: message.receiver, infoBlock: createReportDiv(info) });
    }
    return list;
  }

  let VIEWS = {
    group: {
      name: 'participants',

      render: function renderGroup() {
        let participants = Threads.get(this.id).participants;
        this.renderContactList(participants);
        ThreadUI.setHeaderContent({
          id: 'participant',
          args: { n: participants.length }
        });
        ThreadUI.setHeaderAction('back');
      },

      setEventListener: function setEventListener() {
        this.contactList.addEventListener('click', function onListClick(event) {
          event.stopPropagation();
          event.preventDefault();

          let target = event.target;

          ThreadUI.promptContact({
            number: target.dataset.number
          });
        });
      },

      elements: ['contact-list']
    },
    report: {
      name: 'report',

      init: function() {
        this.onStatusChanged = this.onStatusChanged.bind(this);
      },

      beforeEnter: function() {
        NavigationMap.disableNav = true;
        MESSAGE_EVENTS.forEach((event) => {
          MessageManager.on(event, this.onStatusChanged);
        });
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('gaia-confirm-close', this.updateSofyKey);
      },

      removeConfirmClose: function() {
        window.removeEventListener('gaia-confirm-close', this.updateSofyKey);
      },

      handleKeyDown: function(e) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          ThreadUI.isBackToThreadUI = true;
          Navigation.toPanel('thread', { id: Threads.currentId });
        }
      },

      updateSofyKey: function() {
        ThreadUI.updateInformationSks();
      },

      afterLeave: function() {
        NavigationMap.disableNav = false;
        MESSAGE_EVENTS.forEach((event) => {
          MessageManager.off(event, this.onStatusChanged);
        });
        window.removeEventListener('keydown', this.handleKeyDown);
        this.removeConfirmClose();
      },

      render: function renderReport() {
        let setL10nAttributes = navigator.mozL10n.setAttributes;
        let request = MessageManager.getMessage(this.id);

        // Hide these dynamic fields to avoid incorrect info displayed at first
        this.subject.classList.add('hide');
        this.sizeBlock.classList.add('hide');

        request.onsuccess = (function() {
          let message = request.result;
          let type = message.type;
          let delivery = message.delivery;

          let isIncoming = delivery === 'received' ||
              delivery === 'not-downloaded';

          // Fill in the description/status/size
          if (type === 'sms') {
            setL10nAttributes(this.type, 'message-type-sms');
          } else { //mms
            setL10nAttributes(this.type, 'message-type-mms');
            // subject text content
            let subject = message.subject;

            this.subject.classList.toggle('hide', !subject);
            if (subject) {
              this.subject.querySelector('.detail').textContent = subject;
            }

            // Message total size show/hide
            if (message.attachments && message.attachments.length > 0) {
              let size = message.attachments.reduce(function(size, attachment) {
                return (size += attachment.content.size);
              }, 0);
              let params = Utils.getSizeForL10n(size);
              setL10nAttributes(this.size, params.l10nId, params.l10nArgs);
              this.sizeBlock.classList.remove('hide');
            }
          }
          this.container.dataset.delivery = delivery;

          // If incoming message is migrated from the database where sentTimestamp
          // hadn't been supported yet then we won't have valid value for it.
          this.container.classList.toggle(
            'no-valid-sent-timestamp',
            isIncoming && !message.sentTimestamp
          );

          setL10nAttributes(
            this.contactTitle,
            isIncoming ? 'report-from-title' : 'report-to-title'
          );

          if (isIncoming) {
            l10nContainsDateSetup(this.receivedTimestamp, message.timestamp);
            l10nContainsDateSetup(this.sentTimestamp, message.sentTimestamp);
            setL10nAttributes(this.sentTitle, 'message-sent');
          } else {
            if (delivery === 'sending' || delivery === 'sent') {
              setL10nAttributes(this.sentTitle, 'message-' + delivery);
            }
            if (delivery === 'error' || delivery === 'sent') {
              l10nContainsDateSetup(this.sentTimestamp, message.timestamp);
            }
          }

          if (!isIncoming && delivery === 'error') {
            this.sentTimestamp.classList.add('hide');
            this.sentFailedInfo.classList.remove('hide');
          } else {
            this.sentTimestamp.classList.remove('hide');
            this.sentFailedInfo.classList.add('hide');
          }

          //show sim information for dual sim device
          showSimInfo(this.simInfo, message.iccId);

          // Filled in the contact list. Only outgoing message contains detailed
          // report information.
          this.renderContactList(createListWithMsgInfo(message));
        }).bind(this);
      },

      // Set this flag to true only when resend is triggered.
      messageResending: false,

      isReportForMessage: function report_isReportForMessage(id) {
        return Navigation.isCurrentPanel('report-view', { id: id }) ||
               (Navigation.isCurrentPanel('report-view') &&
                this.id === id);
      },

      onStatusChanged: function report_onStatusChanged(e) {
        // If we got sending status change in report view after resend clicked
        // (messageResending is true), we should change report panel id, reset
        // messageResending flag and refresh for new message report.
        if (e.message.delivery === 'sending' && this.messageResending) {
          this.id = e.message.id;
          this.messageResending = false;
        }

        this.isReportForMessage(e.message.id) && this.refresh();
      },

      elements: ['contact-list', 'size', 'size-block', 'type', 'sent-title',
                 'sent-timestamp', 'sent-failed-info', 'received-timestamp',
                 'subject', 'sim-info', 'contact-title']
    }
  };

  let Information = function(type) {
    Object.assign(this, VIEWS[type]);

    if (this.init) {
      this.init();
    }

    let prefix = 'information-' + this.name;
    this.container = document.getElementById(prefix);
    this.parent = document.getElementById('thread-messages');
    this.elements.forEach(function(name) {
      this[Utils.camelCase(name)] = this.container.querySelector('.' + name);
    }, this);

    this.setEventListener && this.setEventListener();
    this.reset();
  };

  Information.prototype = {
    constructor: Information,

    afterEnter: function(args) {
      this.id = args.id;
      this.show();
    },

    beforeLeave: function() {
      this.reset();
      this.id = null;
    },

    show: function() {
      // Hide the Messages edit icon, view container and composer form
      this.parent.classList.add(this.name + '-information');

      this.render();
      // Append and Show the participants list
      this.container.classList.remove('hide');
    },

    refresh: function() {
      if (this.parent.classList.contains(this.name + '-information')) {
        this.render();
      }
    },

    reset: function() {
      // Hide the information view
      this.container.classList.add('hide');
      // Remove all LIs
      if (this.contactList) {
        this.contactList.textContent = '';
      }
      // Remove the timestamp and refill it when enter the details again.
      if (this.sentTimestamp) {
        this.sentTimestamp.textContent = '';
      }
      if (this.receivedTimestamp) {
        this.receivedTimestamp.textContent = '';
      }
      // Restore message list view UI elements
      this.parent.classList.remove(this.name + '-information');
    },

    // Incrementing ID for each rendering request to avoid possible race when next
    // renderContactList request earlier than list item appended to contact list
    // ul. Ignoring the rendering/appending request if the rendering ID doesn't
    // match the latest rendering ID.
    renderingId: 0,

    // Param participants could be:
    //   - Array of contact number string or
    //   - Array of object({ number: number, infoBlock: infoBlock })
    // for rendering the contact list.
    renderContactList: function(participants) {
      let ul = this.contactList;
      let renderer = ContactRenderer.flavor('group-view');
      let currentRenderingId = ++this.renderingId;
      let numberCount = 0;

      ul.textContent = '';
      participants.forEach((participant) => {
        let number, infoBlock, selector;

        if (typeof participant === 'object') {
          number = participant.number;
          infoBlock = participant.infoBlock;
          selector = '.suggestion';
        } else {
          number = participant;
        }

        Contacts.findByAddress(number, (results) => {
          // If the current rendering ID doesn't match the latest ID, skip current
          // one and only render for ID which matches latest request ID.
          numberCount++;
          if (currentRenderingId !== this.renderingId) {
            return;
          }

          let isContact = results !== null && !!results.length;

          if (isContact) {
            renderer.render({
              contact: results[0],
              input: number,
              infoBlock: infoBlock,
              infoBlockParentSelector: selector,
              target: ul
            });
          } else {
            let li = document.createElement('li');
            li.role = 'presentation';
            li.innerHTML = TMPL.number.interpolate({
              number: number
            });

            let parentBlock = li.querySelector(selector);
            if (parentBlock && infoBlock) {
              parentBlock.appendChild(infoBlock);
            }

            ul.appendChild(li);
          }
          if (numberCount === participants.length) {
            window.dispatchEvent(new CustomEvent('participants-done'));
          }
        });
      });
    }
  };

  Information.initDefaultViews = function() {
    // Create group / report information view
    exports.GroupView = new Information('group');
    exports.ReportView = new Information('report');
  };

  exports.Information = Information;
  // end global closure
}(this));

