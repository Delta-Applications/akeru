
define('tmpl!cards/msg/peep_bubble.html',['tmpl'], function (tmpl) { return tmpl.toDom('<div class="msg-peep-bubble peep-bubble" dir="auto" role="option">\n  <span class="msg-peep-content p-pri"></span>\n</div>\n'); });


define('mime_to_class',[],function() {
  /**
   * Given a mime type, generates a CSS class name that uses just the first part
   * of the mime type. So, audio/ogg becomes mime-audio.
   * @param  {String} mimeType
   * @return {String} a class name usable in CSS.
   */
  return function mimeToClass(mimeType) {
    mimeType = mimeType || '';
    return 'mime-' + (mimeType.split('/')[0] || '');
  };
});


define('file_display',['require','l10n!'],function(require) {
  var mozL10n = require('l10n!');
  const kbSize = 1024;

  return {
    /**
     * Display a human-readable file size.
     */
    fileSize: function(node, sizeInBytes) {
      var fileSize;
      var unitName;
      var fileInfo = {};

      if (sizeInBytes >= kbSize * kbSize) {
        fileSize = parseFloat(sizeInBytes / kbSize / kbSize).toFixed(1);
        fileInfo = { megabytes: fileSize };
        unitName = 'attachment-size-meb';
      } else if (sizeInBytes < kbSize) {
        fileInfo = { bytes: sizeInBytes };
        unitName = 'attachment-size-byte';
      } else {
        fileSize = parseFloat(sizeInBytes / kbSize).toFixed(1);
        fileInfo = { kilobytes: fileSize };
        unitName = 'attachment-size-kib';
      }
      mozL10n.setAttributes(node, unitName, fileInfo);
    }
  };
});


define('contacts',['require'],function(require) {

  let filterFns = {
    contains: function(a, b) {
      a = a.toLowerCase();
      b = b.toLowerCase();
      return a.contains(b);
    },
    equality: function(a, b) {
      a = a.toLowerCase();
      b = b.toLowerCase();
      return a === b;
    }
  };

  function isMatch(contact, criteria, filterFn) {
    let found = {};

    outer:
    for (let i = 0, ilen = criteria.terms.length; i < ilen; i++) {
      let term = criteria.terms[i];
      for (let j = 0, jlen = criteria.fields.length; j < jlen; j++) {
        let field = criteria.fields[j];

        if (!contact[field]) {
          continue;
        }

        for (let k = 0, klen = contact[field].length; k < klen; k++) {
          let value = contact[field][k];
          if (typeof value.value !== 'undefined') {
            value = value.value;
          }

          if ((found[term] = filterFn(value.trim(), term))) {
            continue outer;
          }
        }
      }
    }

    return Object.keys(found).every(function(key) {
      return found[key];
    });
  }


  let Contacts = {
    rspaces: /\s+/,

    getCount: function() {
      return window.navigator.mozContacts.getCount();
    },

    /* callback is used to render the list of suggestions */
    findContactByString: function (filterValue, insertNode, callback) {
      let props = ['email', 'givenName', 'familyName'];
      return this.findBy({
        filterBy: props,
        filterOp: 'contains',
        filterValue: filterValue
      }, insertNode, callback);
    },

    findBy: function (filter, insertNode, callback) {
      let lower = [];
      let filterValue = (filter.filterValue || '').trim();
      let terms, request;

      if (!navigator.mozContacts || !filterValue.length) {
        setTimeout(() => {
          callback(
            typeof filter.filterValue === 'undefined' ? null :
                [], {} , insertNode
          );
        });
        return;
      }

      terms = filterValue.split(this.rspaces);

      filter.filterValue = terms.length === 1 ?
        terms[0] :
        terms.reduce((initial, term) => {
          lower.push(term.toLowerCase());
          return term.length > initial.length ? term : initial;
        }, '');

      if (filter.filterValue.length < 3) {
        filter.filterLimit = 5;
      }

      lower.splice(lower.indexOf(filter.filterValue.toLowerCase()), 1);

      lower.push.apply(lower, terms);

      request = navigator.mozContacts.find(filter);

      request.onsuccess = () => {
        let contacts = request.result.slice();
        let fields = ['email', 'givenName', 'familyName'];
        let criteria = { fields: fields, terms: lower };
        let results = [];
        let contact;

        if (terms.length > 1) {
          while ((contact = contacts.pop())) {
            if (isMatch(contact, criteria, filterFns.contains)) {
              results.push(contact);
            }
          }
        } else {
          results = contacts;
        }

        callback(results, {
          terms: terms
        }, insertNode);
      };

      request.onerror = () => {
        callback(null);
      };
    },

    isContactData: function(data) {
      return new Promise((resolve) => {
        let filter = {
          filterBy: ['email', 'tel'],
          filterValue: data,
          filterOp: 'contains'
        };

        let request = window.navigator.mozContacts.find(filter);
        request.onsuccess = () => {
          if (request.result.length > 0) {
            let contactId = request.result[0].id;
            resolve(contactId);
          } else {
            resolve();
          }
        };
      });
    },
  };

  return Contacts;
});

define('template!cards/message_reader.html',['template'], function(template) { return {
createdCallback: template.templateCreatedCallback,
template: template.objToFn({"id":"cards/message_reader.html","deps":[],"text":"<section class=\"msg-reader-header\" role=\"region\" data-statuscolor=\"default\">\n  <header>\n    <h1 class=\"msg-reader-header-label\">\n      <menu class=\"msg-reader-menu\" type=\"toolbar\">\n        <div data-prop=\"previousBtn\" class=\"msg-left-btn\">\n          <span data-prop=\"previousIcon\" class=\"icon icon-previous\"></span>\n        </div>\n        <div id=\"msg-reader-all-header\">\n          <div id=\"msg-reader-header-text-item\">\n            <div dir=\"auto\" id=\"msg-reader-header-label\"></div>\n          </div>\n        </div>\n        <div data-prop=\"nextBtn\" class=\"msg-right-btn\">\n          <span data-prop=\"nextIcon\" class=\"icon icon-next\"></span>\n        </div>\n      </menu>\n    </h1>\n    <h2 class=\"msg-reader-header-datetime\">\n      <span dir=\"auto\" id=\"msg-reader-header-date-time\"></span>\n    </h2>\n  </header>\n</section>\n<div data-prop=\"scrollContainer\"\n     class=\"scrollregion-below-header scrollregion-horizontal-too\"\n     role=\"heading\" aria-labelledby=\"message-reader-header\">\n  <div data-prop=\"envelopeBar\" class=\"msg-envelope-bar\">\n    <div class=\"msg-envelope-line msg-envelope-from-line focusable\"\n         role=\"menuitem\">\n      <span class=\"msg-envelope-key\"\n            data-event=\"click:viewSender\"\n            data-l10n-id=\"envelope-from\"></span>\n    </div>\n    <!-- the details starts out collapsed, but can be toggled -->\n    <div class=\"msg-envelope-details\">\n      <div class=\"msg-envelope-line msg-envelope-to-line focusable\"\n           role=\"menuitem\">\n        <span class=\"msg-envelope-key\"\n              data-event=\"click:viewRecipients\"\n              data-l10n-id=\"envelope-to\"></span>\n      </div>\n      <div class=\"msg-envelope-line msg-envelope-cc-line focusable\"\n           role=\"menuitem\">\n        <span class=\"msg-envelope-key\"\n              data-event=\"click:viewCc\"\n              data-l10n-id=\"envelope-cc\"></span>\n      </div>\n      <div class=\"msg-envelope-line msg-envelope-bcc-line focusable\"\n           role=\"menuitem\">\n        <span class=\"msg-envelope-key\"\n              data-event=\"click:viewBcc\"\n              data-l10n-id=\"envelope-bcc\"></span>\n      </div>\n    </div>\n    <div class=\"msg-envelope-subject-container focusable\" role=\"menuitem\">\n      <div data-prop =\"starMsg\" class =\"msg-star-btn collapsed\"></div>\n      <span class=\"msg-envelope-key\"\n            data-l10n-id=\"msg-display-subject\"></span>\n      <span aria-level=\"2\" class=\"msg-envelope-subject p-pri\"\n          data-l10n-id=\"subject\" dir=\"auto\"></span>\n    </div>\n  </div>\n  <div data-prop=\"attachmentsContainer\"\n        class=\"msg-reader-attachments-container focusable collapsed\"\n        data-event=\"click:viewReaderAttachment\" role=\"menuitem\">\n  </div>\n  <!-- Tells us about remote/not downloaded images, asks to show -->\n  <div data-prop=\"loadBar\" class=\"msg-reader-load-infobar focusable collapsed\"\n       role=\"button\">\n    <p data-prop=\"loadBarText\" class=\"msg-reader-load-infobar-text\"></p>\n  </div>\n  <div data-prop=\"rootBodyNode\"\n       class=\"msg-body-container focusable\"\n       data-l10n-id=\"message-body-container\" role=\"menuitem\">\n    <progress data-l10n-id=\"message-body-container-progress\"></progress>\n  </div>\n</div>\n"})}; });

/*global MozActivity */

define('cards/message_reader',['require','tmpl!./msg/peep_bubble.html','cards','date','toaster','model','header_cursor','evt','iframe_shims','l10n!','query_uri','mime_to_class','file_display','contacts','message_display','./base','template!./message_reader.html'],function(require) {

let MimeMapper,
    msgPeepBubbleNode = require('tmpl!./msg/peep_bubble.html'),
    cards = require('cards'),
    date = require('date'),
    toaster = require('toaster'),
    model = require('model'),
    headerCursor = require('header_cursor').cursor,
    evt = require('evt'),
    iframeShims = require('iframe_shims'),
    mozL10n = require('l10n!'),
    queryURI = require('query_uri'),
    mimeToClass = require('mime_to_class'),
    fileDisplay = require('file_display'),
    Contacts = require('contacts'),
    messageDisplay = require('message_display');

let CONTENT_TYPES_TO_CLASS_NAMES = [
    null,
    'msg-body-content',
    'msg-body-signature',
    'msg-body-leadin',
    null,
    'msg-body-disclaimer',
    'msg-body-list',
    'msg-body-product',
    'msg-body-ads'
  ];
let CONTENT_QUOTE_CLASS_NAMES = [
    'msg-body-q1',
    'msg-body-q2',
    'msg-body-q3',
    'msg-body-q4',
    'msg-body-q5',
    'msg-body-q6',
    'msg-body-q7',
    'msg-body-q8',
    'msg-body-q9'
  ];
let MAX_QUOTE_CLASS_NAME = 'msg-body-qmax';
let stepHeight = document.documentElement.clientHeight / 8;

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const aPercent = 0.98;

// This function exists just to avoid lint errors around
// "do not use 'new' for side effects.
function sendActivity(obj) {
  return new MozActivity(obj);
}

return [
  require('./base')(require('template!./message_reader.html')),
  {
    updateSoftKey: function(type) {
      if (this.className !== 'card center') {
        return;
      }
      let params = [];
      if (!this.header) {
        NavigationMap.setSoftKeyBar(params);
        return;
      }
      if (window.option.menuVisible &&
        this.oldIsStarred === this.hackMutationHeader.isStarred) {
        return;
      }

      if (type) {
        this.softkeyType = type;
      } else {
        this.softkeyType = '';
      }
      if (type === 'open') {
        this.setLinkSoftKey();
      } else {
        if (this.canReply) {
          params.push({
            name: 'Reply',
            l10nId: 'opt-reply',
            priority: 1,
            method: this.reply.bind(this)
          });
        }

        if (type === 'select') {
          params.push({
            name: 'Select',
            l10nId: 'select',
            priority: 2
          });
        }

        if (this.iframeScale && this.iframeScale < 0.8) {
          params.push({
            name: 'Browse Mail',
            l10nId: 'browse-mail',
            priority: 5,
            method: () => {
              this.onBrowse();
            }
          });
        }
        if (this.canReply) {
          params.push({
            name: 'Reply to All',
            l10nId: 'opt-reply-all',
            priority: 5,
            method: this.replyAll.bind(this)
          });
          params.push({
            name: 'Forward',
            l10nId: 'opt-forward',
            priority: 5,
            method: this.forward.bind(this)
          });
        }
        params.push({
          name: (!this.hackMutationHeader.isStarred) ?
              'Add Flag' : 'Remove Flag',
          l10nId: (!this.hackMutationHeader.isStarred) ?
              'opt-add-flag' : 'opt-remove-flag',
          priority: 5,
          method: this.onToggleStar.bind(this)
        });
        params.push({
          name: 'Move to Folder',
          l10nId: 'opt-move-message',
          priority: 5,
          method: this.onMove.bind(this)
        });
        params.push({
          name: 'View Folders',
          l10nId: 'opt-folders',
          priority: 5,
          method: this.onViewFolders.bind(this)
        });
        params.push({
          name: 'Delete',
          l10nId: 'opt-delete-message',
          priority: 5,
          method: this.onDelete.bind(this)
        });

        NavigationMap.setSoftKeyBar(params);
      }
    },

    setLinkSoftKey: function() {
      let params = [];
      if (this.canReply) {
        params.push({
          name: 'Reply',
          l10nId: 'opt-reply',
          priority: 1,
          method: this.reply.bind(this)
        });
      }
      switch (this.linkData.type) {
        case 'number':
          params.push({
            name: 'Call',
            l10nId: 'opt-call-number',
            priority: 2,
            method: this.onHyperlinkOpen.bind(this)
          });
          break;
        case 'email':
          params.push({
            name: 'Compose',
            l10nId: 'opt-compose-mail',
            priority: 2,
            method: this.onHyperlinkOpen.bind(this)
          });
          break;
        case 'url':
          params.push({
            name: 'Open',
            l10nId: 'opt-open-url',
            priority: 2,
            method: this.onHyperlinkOpen.bind(this)
          });
          break;
      }

      let linkContent = this.linkData.content + '';
      Contacts.isContactData(linkContent).then((contactId) => {
        if (contactId) {
          params.push({
            name: 'View Contact',
            l10nId: 'view-contact',
            priority: 5,
            method: () => {
              sendActivity({
                name: 'open',
                data: {
                  type: 'webcontacts/contact',
                  params: {
                    'id': contactId
                  }
                }
              });
            }
          });
          NavigationMap.setSoftKeyBar(params);
        } else if (this.linkData.type !== 'url') {
          let content = this.linkData.content;
          let data = (this.linkData.type === 'number') ?
                     { 'tel': content } : { 'email': content };

          params.push({
            name: 'Save New Contact',
            l10nId: 'save-new-contact',
            priority: 5,
            method: () => {
              sendActivity({
                name: 'new',
                data: {
                  type: 'webcontacts/contact',
                  params: data
                }
              }).then(() => {
                this.updateSoftKey('open');
              });
            }
          });
          Contacts.getCount().then((count) => {
            if (count) {
              params.push({
                name: 'Add to Existing Contact',
                l10nId: 'add-to-exsiting-contact',
                priority: 5,
                method: () => {
                  sendActivity({
                    name: 'update',
                    data: {
                      type: 'webcontacts/contact',
                      params: data
                    }
                  }).then(() => {
                    this.updateSoftKey('open');
                  });
                }
              });
            }
            NavigationMap.setSoftKeyBar(params);
          });
        } else {
          NavigationMap.setSoftKeyBar(params);
        }
      });
    },

    createdCallback: function() {
      // The body elements for the (potentially multiple) iframes we created to
      // hold HTML email content.
      this.htmlBodyNodes = [];
      this._on('msg-reader-load-infobar', 'click', 'onLoadBarClick');

      this._emittedContentEvents = false;
      this.disableReply();

      // whether or not we've built the body DOM the first time
      this._builtBodyDom = false;

      this.focusableLinks = [];
      this.inViewFocusableLinks = [];
      this.allIframes = null;
      this.bPrevious = false;
      this.bNext = false;
      this.offSetNumber = 0;
      this.bodyRepType = '';
      this.iframeScale = null;
      this.oldIsStarred = false;

      // Bind some methods to this so they can be used as event listeners
      this.handleBodyChange = this.handleBodyChange.bind(this);
      this.onMessageSuidNotFound = this.onMessageSuidNotFound.bind(this);
      this.onCurrentMessage = this.onCurrentMessage.bind(this);

      headerCursor.on('messageSuidNotFound', this.onMessageSuidNotFound);
      headerCursor.latest('currentMessage', this.onCurrentMessage);

      // This should handle the case where we jump right into the reader.
      headerCursor.setCurrentMessage(this.header);
      this.firstVisible = true;
      this.handleRootBodyNodeFocus = this.handleRootBodyNodeFocus.bind(this);
      this.handRootBodyNodeKeydown = this.handRootBodyNodeKeydown.bind(this);
      this.observer = null;
    },

    onArgs: function(args) {
      this.messageSuid = args.messageSuid;
      this.currentFolder = args.curFolder;
    },

    _contextMenuType: {
      VIEW_CONTACT: 1,
      CREATE_CONTACT: 2,
      ADD_TO_CONTACT: 4,
      REPLY: 8,
      NEW_MESSAGE: 16
    },

    /**
     * Inform Cards to not emit startup content events, this card will trigger
     * them once data from back end has been received and the DOM is up to date
     * with that data.
     * @type {Boolean}
     */
    skipEmitContentEvents: true,

    // Method to help bind event listeners to method names, and ensures
    // a header object before activating the method, to protect the buttons
    // from being activated while the model is still loading.
    _on: function(className, eventName, method, skipProtection) {
      this.getElementsByClassName(className)[0]
      .addEventListener(eventName, (evt) => {
        if (this.header || skipProtection) {
          return this[method](evt);
        }
      }, false);
    },

    _setHeader: function(header) {
      if (this.header) {
        this.header.__die();
        this.header = null;
      }
      this.header = header.makeCopy();
      this.hackMutationHeader = header;

      // - mark message read (if it is not already)
      if (!this.header.isRead) {
        this.header.setRead(true);
      }

      if(!this.hackMutationHeader.isStarred) {
        this.starMsg.classList.add('collapsed');
      } else {
        this.starMsg.classList.remove('collapsed');
      }
      this.emit('header');
    },

    postInsert: function() {
      this._inDom = true;

      // If have a message that is waiting for the DOM, finish
      // out the display work.
      if (this._afterInDomMessage) {
        this.onCurrentMessage(this._afterInDomMessage);
        this._afterInDomMessage = null;
      }
    },

    told: function(args) {
      if (args.messageSuid) {
        this.messageSuid = args.messageSuid;
      }
    },

    handleBodyChange: function(evt) {
      if (this.className === 'card center') {
        this.buildBodyDom(evt.changeDetails);
      }
    },

    goBack: function() {
      let messageHeaderId = null;
      if (this.header) {
        messageHeaderId = this.header.id;
      }
      if (NavigationMap.searchMode) {
        NavigationMap.currentSearchId = messageHeaderId;
      } else {
        NavigationMap.currentMessageId = messageHeaderId;
      }

      if (this.offSetNumber !== 0) {
        if (this.offSetNumber < 0) {
          NavigationMap.scrollUp = 1;
        } else {
          NavigationMap.scrollUp = -1;
        }
        this.offSetNumber = 0;
      } else {
        NavigationMap.scrollUp = 0;
      }

      cards.removeCardAndSuccessors(this, 'delay-animate');
    },

    goPrevious: function() {
      this.bPrevious = true;
      this.bNext = false;
      headerCursor.advance('previous');
    },

    goNext: function() {
      this.bNext = true;
      this.bPrevious = false;
      headerCursor.advance('next');
    },

    onMessageSuidNotFound: function(messageSuid) {
      // If no message was found, then go back. This card
      // may have been created from obsolete data, like an
      // old notification for a message that no longer exists.
      // This stops atTop since the most likely case for this
      // entry point is either clicking on a message that is
      // at the top of the inbox in the HTML cache, or from a
      // notification for a new message, which would be near
      // the top.
      if (this.messageSuid === messageSuid) {
        headerCursor.removeListener('messageSuidNotFound',
            this.onMessageSuidNotFound);
        this.goBack();
      }
    },

    /**
     * Set the message we're reading.
     *
     * @param {MessageCursor.CurrentMessage} currentMessage representation of
     * the email we're currently reading.
     */
    onCurrentMessage: function(currentMessage) {
      // If the card is not in the DOM yet, do not proceed, as
      // the iframe work needs to happen once DOM is available.
      if (!this._inDom) {
        this._afterInDomMessage = currentMessage;
        return;
      }


      // Ignore doing extra work if current message is the same as the one
      // already tied to this message reader.
      if (this.header && this.header.id === currentMessage.header.id) {
        return;
      }

      if (navigator.connection.type === 'none') {
        toaster.toast({
          text: mozL10n.get('no-internet-connection')
        });
      }

      if (this.canReply) {
        this.disableReply();
      }
      // Set our current message.
      this.messageSuid = null;
      this._setHeader(currentMessage.header);

      let header = document.getElementsByClassName('msg-reader-header')[0];
      this._topStuffHeight = header.getClientRects()[0].bottom;
      this.clearDom();

      // Display the header and fetch the body for display.
      this.latestOnce('header', () => {
        // iframes need to be linked into the DOM tree before their
        // contentDocument can be instantiated.
        this.buildHeaderDom(this);

        if (this.header.bytesToDownloadForBodyDisplay > MAX_ATTACHMENT_SIZE) {
          this.rootBodyNode.classList.add('collapsed');
          toaster.toast({
            text: mozL10n.get('message-large-message-warning')
          });
          return;
        }

        this.header.getBody({ downloadBodyReps: true }, (body) => {
          // If the header has changed since the last getBody call, ignore.
          if (this.header.id !== body.id) {
            if (body && body.die) {
              body.die();
            }
            return;
          }

          this.body = body;

          // always attach the change listener.
          body.onchange = this.handleBodyChange;

          // if the body reps are downloaded show the message immediately.
          if (body.bodyRepsDownloaded) {
            this.buildBodyDom();
          }
        });
      });

      // Previous.
      let hasPrevious = currentMessage.siblings.hasPrevious;
      this.previousBtn.disabled = !hasPrevious;
      this.previousIcon.classList[hasPrevious ? 'remove' : 'add'](
          'icon-disabled');

      // Next.
      let hasNext = currentMessage.siblings.hasNext;
      this.nextBtn.disabled = !hasNext;
      this.nextIcon.classList[hasNext ? 'remove' : 'add']('icon-disabled');

      if (this.bPrevious) {
        this.bPrevious = false;
        this.offSetNumber--;
      }

      if (this.bNext) {
        this.bNext = false;
        this.offSetNumber++;
      }
    },

    reply: function() {
      cards.eatEventsUntilNextCard();
      let composer = this.header.replyToMessage(null, () => {
        cards.pushCard('compose', 'animate', {
          composer: composer,
          type: 'reply',
          title: 'cmp-reply'
        });
      });
    },

    replyAll: function() {
      cards.eatEventsUntilNextCard();
      let composer = this.header.replyToMessage('all', () => {
        cards.pushCard('compose', 'animate', {
          composer: composer,
          type: 'reply',
          title: 'cmp-reply-all'
        });
      });
    },

    viewReaderAttachment: function() {
      console.log('go to viewReaderAttachment');
      cards.eatEventsUntilNextCard();
      cards.pushCard('message_reader_attachments', 'animate', {
        composer: this.body.attachments
      });
    },

    viewSender: function() {
      cards.eatEventsUntilNextCard();
      cards.pushCard('message_reader_address', 'animate', {
        composer: this,
        type: 'sender'
      });
    },

    viewRecipients: function() {
      console.log('go to viewRecipients');
      cards.eatEventsUntilNextCard();
      cards.pushCard('message_reader_address', 'animate', {
        composer: this,
        type: 'recipients'
      });
    },

    viewCc: function() {
      console.log('go to viewCc');
      cards.eatEventsUntilNextCard();
      cards.pushCard('message_reader_address', 'animate', {
        composer: this,
        type: 'cc'
      });
    },

    viewBcc: function() {
      console.log('go to viewBcc');
      cards.eatEventsUntilNextCard();
      cards.pushCard('message_reader_address', 'animate', {
        composer: this,
        type: 'bcc'
      });
    },

    forward: function() {
      let needToPrompt = this.header.hasAttachments ||
                         this.body.embeddedImageCount > 0;
      let bForwardAttachments = false;
      let filesSize = 0;
      let unDownloadSize = 0;
      let attachments = this.body.attachments;

      if (needToPrompt) {
        for (let i = 0; i < attachments.length; i++) {
          let downloaded = attachments[i].isDownloaded && attachments[i]._file;
          if (!downloaded) {
            unDownloadSize += attachments[i].sizeEstimateInBytes;
          }
          filesSize += attachments[i].sizeEstimateInBytes;
        }
      }

      let forwardMessage = () => {
        cards.eatEventsUntilNextCard();
        let composer = this.header.forwardMessage('inline', () => {
          if (bForwardAttachments) {
            cards.pushCard('compose', 'animate', {
              composer: composer,
              title: 'cmp-forward',
              forwardAttachments: attachments,
              unDownloadFilesSize: unDownloadSize,
              filesSize: filesSize
            });
          } else {
            cards.pushCard('compose', 'animate', {
              composer: composer,
              title: 'cmp-forward'
            });
          }
        });
      };

      let contentId = attachments.length > 1 ? 'message-forward-attachments' :
          'message-forward-attachment';
      if (needToPrompt) {
        let dialogConfig = {
          title: {
            id: 'message-forward-attachment-title',
            args: {}
          },
          body: {
            id: contentId,
            args: {}
          },
          cancel: {
            l10nId: 'no',
            priority: 1,
            callback: () => {
              forwardMessage();
            }
          },
          confirm: {
            l10nId: 'yes',
            priority: 3,
            callback: () => {
              bForwardAttachments = true;
              forwardMessage();
            }
          }
        };
        NavigationMap.showConfigDialog(dialogConfig);
      } else {
        forwardMessage();
      }
    },

    // TODO: canReplyAll should be moved into GELAM.
    /** Returns true if Reply All should be shown as a distinct option. */
    canReplyAll: function() {
      // If any e-mail is listed as 'to' or 'cc' and doesn't match this
      // user's account, 'Reply All' should be enabled.
      let myAddresses = model.account.identities.map((ident) => {
        return ident.address;
      });

      let otherAddresses = (this.header.to || []).concat(this.header.cc || []);
      if (this.header.replyTo && this.header.replyTo.author) {
        otherAddresses.push(this.header.replyTo.author);
      }
      for (let i = 0; i < otherAddresses.length; i++) {
        let otherAddress = otherAddresses[i];
        if (otherAddress.address &&
            myAddresses.indexOf(otherAddress.address) === -1) {
          return true;
        }
      }

      return false;
    },

    onDelete: function() {
      let dialogConfig = {
        title: {
          id: 'confirmation-title',
          args: {}
        },
        body: {
          id: 'message-edit-delete-confirm',
          args: {}
        },
        cancel: {
          l10nId: 'message-delete-cancel',
          priority: 1
        },
        confirm: {
          l10nId: 'message-edit-menu-delete',
          priority: 3,
          callback: () => {
            let op = this.header.deleteMessage();
            cards.removeCardAndSuccessors(this, 'animate');
            toaster.toastOperation(op);
          }
        }
      };

      NavigationMap.showConfigDialog(dialogConfig);
    },

    onToggleStar: function() {
      this.oldIsStarred = this.hackMutationHeader.isStarred;
      this.hackMutationHeader.isStarred = !this.hackMutationHeader.isStarred;
      if(!this.hackMutationHeader.isStarred) {
        this.starMsg.classList.add('collapsed');
      } else {
        this.starMsg.classList.remove('collapsed');
      }
      let op = this.header.setStarred(this.hackMutationHeader.isStarred);
      let toasterText;
      if (op.operation === 'star') {
        toasterText = mozL10n.get('msg-reader-message-flagged');
      } else if (op.operation === 'unstar') {
        toasterText = mozL10n.get('msg-reader-flag-removed');
      }
      toaster.toast({
        text: toasterText
      });
      this.updateSoftKey(this.softkeyType);
    },

    onMove: function() {
      //TODO: Please verify move functionality after api landed.
      cards.folderSelector((folder) => {
        let op = this.header.moveMessage(folder);
        cards.removeCardAndSuccessors(this, 'animate');
        toaster.toastOperation(op);
      }, (folder) => {
        return folder.isValidMoveTarget;
      }, this.currentFolder);
    },

    onViewFolders: function() {
      cards.pushCard('folder_picker', 'animate', {
        onPushed: () => {},
        previousCard: this
      });
    },

    onBrowse: function() {
      // If user want to browse HTML mail, will auto load external image
      this.onLoadBarClick();

      let iframeNode = this.rootBodyNode.getElementsByTagName('iframe')[0];
      let iframeHTML = iframeNode.contentDocument.documentElement.innerHTML;
      iframeHTML = iframeHTML.replace(/overflow: hidden/g, '');
      iframeHTML = iframeHTML.replace(/focus/g, '');
      iframeHTML = iframeHTML.replace(/ext-href=/g, 'href=');

      let win = window.open('', '', 'scrollbars=yes');
      win.document.open('text/html', 'replace');
      win.document.write(iframeHTML);
      win.document.close();
    },

    setRead: function(isRead) {
      this.hackMutationHeader.isRead = isRead;
      this.header.setRead(isRead);
    },

    onMarkRead: function() {
      this.setRead(!this.hackMutationHeader.isRead);
    },

    onLoadBarClick: function(event) {
      let loadBar = this.loadBar;
      if (loadBar.classList.contains('collapsed')) {
        return;
      }
      if (!this.body.embeddedImagesDownloaded) {
        mozL10n.setAttributes(loadBar, 'external-image-downloading');
        this.body.downloadEmbeddedImages(() => {
          // this gets nulled out when we get killed, so use this to bail.
          // XXX of course, this closure will cause us to potentially hold onto
          // a lot of garbage, so it would be better to add an
          // 'onimagesdownloaded' to body so that the closure would end up as
          // part of a cycle that would get collected.
          if (!this.body) {
            return;
          }

          for (let i = 0; i < this.htmlBodyNodes.length; i++) {
            this.body.showEmbeddedImages(this.htmlBodyNodes[i]);
          }
        });
        // XXX really we should check for external images to display that load
        // bar, although it's a bit silly to have both in a single e-mail.
        loadBar.classList.add('collapsed');
      } else {
        for (let i = 0; i < this.htmlBodyNodes.length; i++) {
          this.body.showExternalImages(this.htmlBodyNodes[i]);
        }
        loadBar.classList.add('collapsed');
      }
      loadBar.classList.remove('focusable');
      NavigationMap.navSetup('cards-message-reader',
                             ':not(.collapsed).focusable');
      NavigationMap.setFocus(NavigationMap.getCurrentControl().index);
    },

    onHyperlinkOpen: function() {
      if (this.externalLinkURL) {
        switch (this.linkData.type) {
          case 'number':
            let number = this.linkData.content;
            if (number) {
              sendActivity({
                name: 'dial',
                data: {
                  type: 'webtelephony/number',
                  number: number
                }
              });
            }
            break;
          case 'email':
            // Fast path to compose. Works better than an activity, since
            // "canceling" the activity has freaky consequences: what does it
            // mean to cancel ourselves? What is the sound of one hand
            // clapping?
            let data = queryURI(this.externalLinkURL);
            cards.pushCard('compose', 'animate', {
              composerData: {
                onComposer: (composer, composeCard) => {
                  // Copy the to, cc, bcc, subject, body to the compose.
                  // It is OK to do this blind key copy since queryURI
                  // explicitly only populates expected fields, does not
                  // blindly accept input from the outside, and the queryURI
                  // properties match the property names allowed on composer.
                  Object.keys(data).forEach((key) => {
                    composer[key] = data[key];
                  });
                }
              }
            });
            break;
          case 'url':
            // Using window.open to view web url.
            window.open(this.externalLinkURL);
            break;
        }
      } else {
        console.log('there is no external link url');
      }
    },

    _populatePlaintextBodyNode: function(bodyNode, rep) {
      for (let i = 0; i < rep.length; i += 2) {
        let node = document.createElement('div'), cname;

        let etype = rep[i] & 0xf;
        if (etype === 0x4) {
          let qdepth = (((rep[i] >> 8) & 0xff) + 1);
          if (qdepth > 8) {
            cname = MAX_QUOTE_CLASS_NAME;
          } else {
            cname = CONTENT_QUOTE_CLASS_NAMES[qdepth];
          }
        }
        else {
          cname = CONTENT_TYPES_TO_CLASS_NAMES[etype];
        }
        if (cname) {
          node.setAttribute('class', cname);
          node.classList.add('p');
          node.classList.add('ul');
        }

        let subnodes = model.api.utils.linkifyPlain(rep[i + 1], document);
        for (let iNode = 0; iNode < subnodes.length; iNode++) {
          node.appendChild(subnodes[iNode]);
        }

        bodyNode.appendChild(node);
      }
      let externalLink = bodyNode.querySelectorAll('.moz-external-link');
      for (let i = 0; i < externalLink.length; i++) {
        externalLink[i].classList.add('focusable');
      }
      NavigationMap.navSetup('cards-message-reader',
                             ':not(.collapsed).focusable');
    },

    buildHeaderDom: function(domNode) {
      let header = this.header;

      // -- Header
      function updatePeep(peep) {
        let nameNode = peep.element.querySelector('.msg-peep-content');

        if (peep.type === 'from') {
          // We display the sender of the message's name in the header and the
          // address in the bubble.
          nameNode.textContent = peep.address;
          nameNode.classList.add('msg-peep-address');
        } else {
          nameNode.textContent = peep.contactName || peep.name || peep.address;
          if (!peep.contactName && !peep.name && peep.address) {
            nameNode.classList.add('msg-peep-address');
          } else {
            nameNode.classList.remove('msg-peep-address');
          }
        }
      }

      function addHeaderEmails(type, peeps) {
        let lineClass = 'msg-envelope-' + type + '-line';
        let lineNode = domNode.getElementsByClassName(lineClass)[0];

        if (!peeps || !peeps.length) {
          lineNode.classList.add('collapsed');
          return;
        }

        // Make sure it is not hidden from a next/prev action.
        lineNode.classList.remove('collapsed');

        for (let i = 0; i < peeps.length; i++) {
          let peep = peeps[i];
          peep.type = type;
          peep.element = msgPeepBubbleNode.cloneNode(true);
          peep.element.peep = peep;
          peep.onchange = updatePeep;
          updatePeep(peep);
          lineNode.appendChild(peep.element);
        }
      }

      addHeaderEmails('from', [header.author]);
      addHeaderEmails('to', header.to);
      addHeaderEmails('cc', header.cc);
      addHeaderEmails('bcc', header.bcc);

      domNode.querySelector('#msg-reader-header-label').textContent =
          header.author.name || header.author.address;
      domNode.querySelector('#msg-reader-header-date-time').textContent =
          date.showDateTime(header.date);

      messageDisplay.subject(domNode.querySelector('.msg-envelope-subject'),
                             header);
    },

    clearDom: function() {
      // Clear header emails.
      Array.slice(this.querySelectorAll('.msg-peep-bubble')).forEach(
        (node) => {
          node.parentNode.removeChild(node);
        }
      );

      // clear iframe
      this.rootBodyNode.querySelectorAll('.msg-body-container iframe').forEach(
        (node) => {
          node.contentWindow.document.write('');
          node.contentWindow.document.clear();
          node.contentWindow.close();
          node.parentNode.removeChild(node);
        }
      );

      // Nuke rendered attachments.
      let attachmentsContainer =
          this.querySelector('.msg-reader-attachments-container');
      attachmentsContainer.innerHTML = '';
      attachmentsContainer.classList.add('collapsed');

      // Nuke existing body, show progress while waiting
      // for message to load.
      this.rootBodyNode.innerHTML =
        '<progress data-l10n-id="message-body-container-progress"></progress>';

      // Make sure load bar is not shown between loads too.
      this.loadBar.classList.add('collapsed');

      this.focusableLinks = [];
      this.htmlBodyNodes = [];
      this.inViewFocusableLinks = [];
      if (this.body) {
        this.body.die();
        this.body = null;
      }
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    },

    /**
     * Render the DOM nodes for bodyReps and the attachments container.
     * If we have information on which parts of the message changed,
     * only update those DOM nodes; otherwise, update the whole thing.
     *
     * @param {object} changeDetails
     * @param {array} changeDetails.bodyReps An array of changed item indexes.
     * @param {array} changeDetails.attachments An array of changed item
     * indexes.
     */
    buildBodyDom: function(/* optional */ changeDetails) {
      let body = this.body;

      // If the card has been destroyed (so no more body, as it is nulled in
      // die()) or header has changed since this method was scheduled to be
      // called (rapid taps of the next/previous buttons), ingore the call.
      if (!body || this.header.id !== body.id) {
        if (body && body.die) {
          body.die();
        }
        return;
      }

      let domNode = this,
          rootBodyNode = this.rootBodyNode,
          reps = body.bodyReps,
          hasExternalImages = false,
          messageChange = true,
          showEmbeddedImages = body.embeddedImageCount &&
                               body.embeddedImagesDownloaded;


      this.currentLinkIndex = null;
      // The first time we build the body DOM, do one-time bootstrapping:
      if (!this._builtBodyDom) {
        this._builtBodyDom = true;
        messageChange = false;
        if (!this.keydownHandler) {
          this.keydownHandler = this.handleKeyDown.bind(this);
          window.addEventListener('keydown', this.keydownHandler);
        }
      }

      // If we have fully downloaded one body part, the user has
      // something to read so get rid of the spinner.
      // XXX: Potentially improve the UI to show if we're still
      // downloading the rest of the body even if we already have some
      // of it.
      if (reps.length && reps[0].isDownloaded) {
        // remove progress bar if we've retrieved the first rep
        let progressNode = rootBodyNode.querySelector('progress');
        if (progressNode) {
          progressNode.parentNode.removeChild(progressNode);
        }
      }

      // The logic below depends on having removed the progress node!

      for (let iRep = 0; iRep < reps.length; iRep++) {
        let rep = reps[iRep];

        // If the rep's type is fake, we should skip handle it.
        if (rep.type === 'fake') {
          continue;
        }

        // Create an element to hold this body rep. Even if we aren't
        // updating this rep right now, we need to have a placeholder.
        let repNode = rootBodyNode.childNodes[iRep];
        if (!repNode) {
          repNode = rootBodyNode.appendChild(document.createElement('div'));
        }

        // Skip updating this rep if it's not updated.
        if (changeDetails && changeDetails.bodyReps &&
            changeDetails.bodyReps.indexOf(iRep) === -1) {
          continue;
        }

        // Wipe out the existing contents of the rep node so we can
        // replace it. We can just nuke innerHTML since we add click
        // handlers on the rootBodyNode, and for text/html parts the
        // listener is a child of repNode so it will get destroyed too.
        repNode.innerHTML = '';

        let msgBodyContainer =
            document.getElementsByClassName('msg-body-container');
        if (rep.type === 'plain') {
          this._populatePlaintextBodyNode(repNode, rep.content);
          this.bodyRepType = 'plain';
          this.iframeScale = null;
          this.allIframes = null;
          let arrayLink = msgBodyContainer[0]
                          .querySelectorAll('.moz-external-link');
          for (let i = 0; i < arrayLink.length; i++) {
            this.focusableLinks.push(arrayLink[i]);
          }
        } else if (rep.type === 'html') {
          let iframeShim = iframeShims.createAndInsertIframeForContent(
            rep.content, this.scrollContainer, repNode, null,
            'interactive', null, (scale) => {
              this.iframeScale = scale;
              this.updateSoftKey(this.softkeyType);
            });
          let iframe = iframeShim.iframe;
          let bodyNode = iframe.contentDocument.body;
          this.iframeScale = iframeShim.scale * aPercent;
          this.bodyRepType = 'html';
          if (body.checkForExternalImages(bodyNode)) {
            hasExternalImages = true;
          } else if (!body.embeddedImageCount) {
            model.api.utils.linkifyHTML(iframe.contentDocument);
          }
          this.htmlBodyNodes.push(bodyNode);

          this.allIframes = msgBodyContainer[0].querySelectorAll('iframe');
          for (let i = 0; i < this.allIframes.length; i++) {
            let arrayLink = this.allIframes[i].contentDocument.body
                .querySelectorAll('.moz-external-link');
            for (let j = 0; j < arrayLink.length; j++) {
              this.focusableLinks.push(arrayLink[j]);
            }
          }

          if (showEmbeddedImages) {
            body.showEmbeddedImages(bodyNode);
          }
          iframe = null;
          bodyNode = null;
          iframeShim = null;
          this.allIframes = null;
        }

        if (messageChange) {
          this.onCardVisible('forward');
        } else {
          rootBodyNode.addEventListener('focus',
              this.handleRootBodyNodeFocus);
          rootBodyNode.addEventListener('keydown',
              this.handRootBodyNodeKeydown);
        }
      }

      // The image logic checks embedded image counts, so this should be
      // able to run every time:
      // -- HTML-referenced Images
      let loadBar = this.loadBar;
      if (body.embeddedImageCount && !body.embeddedImagesDownloaded) {
        loadBar.classList.remove('collapsed');
        loadBar.classList.add('focusable');
        NavigationMap.navSetup('cards-message-reader',
                               ':not(.collapsed).focusable');
        let size = (body.allEmbeddedImagesSize / (1024 * 1024)).toFixed(2);
        mozL10n.setAttributes(this.loadBarText,
                              'msg-reader-download-external-images',
                              { n: size });
      } else if (hasExternalImages) {
        loadBar.classList.remove('collapsed');
        loadBar.classList.add('focusable');
        NavigationMap.navSetup('cards-message-reader',
                               ':not(.collapsed).focusable');
        mozL10n.setAttributes(this.loadBarText, 'message-show-external-images');
      } else {
        loadBar.classList.add('collapsed');
        if (loadBar.classList.contains('focusable')) {
          loadBar.classList.remove('focusable');
        }
      }

      // -- Attachments (footer)
      // An attachment can be in 1 of 3 possible states for UI purposes:
      // - Not downloadable: We can't download this message because we wouldn't
      //   be able to do anything with it if we downloaded it.  Anything that's
      //   not a supported image type falls in this category.
      // - Downloadable, not downloaded: The user can trigger download of the
      //   attachment to DeviceStorage.
      // - Downloadable, downloaded: The attachment is already fully downloaded
      //   to DeviceStorage and we can trigger its display.
      let attachmentsContainer =
          domNode.querySelector('.msg-reader-attachments-container');
      if (body.attachments && body.attachments.length) {
        // If buildBodyDom is called multiple times, the attachment
        // state might change, so we must ensure the attachment list is
        // not collapsed if we now have attachments.
        console.log('attachmentsContainer.childNodes.length is ' +
                    attachmentsContainer.childNodes.length);
        if (attachmentsContainer.childNodes.length > 0) {
          console.log('no longer to update attachments in msg reader as it' +
                      ' had been updated');
          return;
        }
        attachmentsContainer.classList.remove('collapsed');

        // create element under attachmentsContainer as attachmentsContainer
        // will be cleared in clearDom
        let divElement = document.createElement('div');
        divElement.classList.add('msg-reader-attachment-info');
        attachmentsContainer.appendChild(divElement);
        let spanElementTitle = document.createElement('span');
        let spanElementName = document.createElement('span');
        let spanElementCount = document.createElement('span');

        spanElementTitle.classList.add('msg-envelope-key');
        if (navigator.largeTextEnabled) {
          spanElementTitle.classList.add('p-pri');
        }
        if (body.attachments.length === 1) {
          spanElementTitle.setAttribute('data-l10n-id',
            'msg-reader-display-attachment');
        } else if (body.attachments.length > 1) {
          spanElementTitle.setAttribute('data-l10n-id',
            'msg-reader-display-attachments');
        }
        spanElementName.classList.add('msg-reader-attachments-filename');
        spanElementName.classList.add('p-pri');
        spanElementCount.classList.add('msg-reader-attachments-count');
        spanElementCount.classList.add('p-pri');

        divElement.appendChild(spanElementTitle);
        divElement.appendChild(spanElementName);
        divElement.appendChild(spanElementCount);

        attachmentsContainer.classList.add('focusable');
        NavigationMap.navSetup('cards-message-reader',
          ':not(.collapsed).focusable');
        // We need MimeMapper to help us determining the downloadable
        // attachments but it might not be loaded yet, so load before use it.
        require(['shared/js/mime_mapper'], (mapper) => {
          if (!MimeMapper) {
            MimeMapper = mapper;
          }

          let messageReaderAttachmentFileName =
              domNode.querySelector('.msg-reader-attachments-filename');
          messageReaderAttachmentFileName.innerText = '';
          for (let iAttach = 0; iAttach < body.attachments.length; iAttach++) {
            // Skip updating this attachment if it's not updated.
            if (changeDetails && changeDetails.attachments &&
                changeDetails.attachments.indexOf(iAttach) === -1) {
              continue;
            }

            let attachment = body.attachments[iAttach];
            messageReaderAttachmentFileName.innerText +=
                attachment.filename + ' ';
          }
          domNode.querySelector('.msg-reader-attachments-count').innerText =
              ' (' + body.attachments.length + ')';
          this.enableReply();
        });
      }
      else {
        attachmentsContainer.classList.add('collapsed');
        if (attachmentsContainer.classList.contains('focusable')) {
          attachmentsContainer.classList.remove('focusable');
        }
        this.enableReply();
      }
    },

    handleRootBodyNodeFocus: function() {
      if (this.className !== 'card center') {
        return;
      }

      if (this.focusableLinks.length > 0) {
        this.updateCurrentViewFocusLinks();
        let len = this.inViewFocusableLinks.length;
        if (len > 0) {
          let index = this.currentLinkIndex;
          if (index) {
            this.setFocusRestoreElement(index);
          } else {
            this.setFocusElement(0);
          }
        }
      } else {
        this.updateSoftKey();
      }
    },

    handRootBodyNodeKeydown : function(evt) {
      let beforeScrollLength = this.inViewFocusableLinks.length;
      let afterScrollLength;
      let beforeScrollEl;

      switch (evt.key) {
        // due to our Navigation engine cannot match the UI design of
        // message reader page, so we have to handle the page scroll
        // and focus set when press ArrowDown and ArrowUp in message
        // body node.
        case 'ArrowDown':
          // we need distinguish the situation with the focusable links
          // length.
          //
          // 1. the focusable links length is 0.
          // if no inview focusable links, we should scroll the page
          // immediately.
          if (beforeScrollLength === 0) {
            this.scrollByStep(this.scrollContainer, 'down');
            afterScrollLength = this.inViewFocusableLinks.length;
            // and if has focusable links after scroll, we should set
            // focus on the first one.
            if (afterScrollLength > 0) {
              this.setFocusElement(0);
            }
          // 2. the focusable links length is 1.
          // if has one inview focusable link, we should scroll the
          // page immediately.
          } else if (beforeScrollLength === 1) {
            beforeScrollEl = this.inViewFocusableLinks[0];
            this.scrollByStep(this.scrollContainer, 'down');
            afterScrollLength = this.inViewFocusableLinks.length;
            // and if has no focusable link after scroll, we must remove all
            // focus.
            if (afterScrollLength === 0) {
              this.removeAllFocus();
              this.updateSoftKey();
            // and if has focusbale links after scroll, we must set the
            // focus to the next one.
            } else if (afterScrollLength > 0) {
              let index = this.inViewFocusableLinks.indexOf(beforeScrollEl);
              if (index === -1) {
                this.setFocusElement(0);
              } else if (index === 0 && afterScrollLength > 1) {
                this.setFocusElement(1);
              }
            }
          // 3. the focusable links length > 1
          } else if (beforeScrollLength > 1) {
            let focusedElIndex;
            // we need to know the focused link's index
            for (let i = 0; i < this.inViewFocusableLinks.length; i++) {
              let inViewFocusableLink = this.inViewFocusableLinks[i];
              if (inViewFocusableLink.classList.contains('focus')) {
                focusedElIndex = i;
                beforeScrollEl = inViewFocusableLink;
              }
            }

            // if focused link is not the last one, we only need set the
            // focus to the next one.
            if (focusedElIndex < (beforeScrollLength - 1)) {
              this.setFocusElement(focusedElIndex + 1);
              // and if focused link is the last one, we need to scroll the
              // page firstly, then check the focusable links' length after
              // scroll to determine which link should be focused.
            } else if (focusedElIndex === (beforeScrollLength - 1)) {
              this.scrollByStep(this.scrollContainer, 'down');
              afterScrollLength = this.inViewFocusableLinks.length;
              if (afterScrollLength === 0) {
                this.removeAllFocus();
              } else if (afterScrollLength > 0) {
                let index = this.inViewFocusableLinks.indexOf(beforeScrollEl);
                if (index === -1) {
                  this.setFocusElement(0);
                } else if (index > -1 && index < (afterScrollLength - 1)) {
                  this.setFocusElement(index + 1);
                }
              }
            }
          }
          evt.preventDefault();
          evt.stopPropagation();
          break;
        case 'ArrowUp':
          // we need to check if we should move the focus out of message
          // body node or not.
          if (this.isVisible(this.rootBodyNode, false)
              && (this.inViewFocusableLinks.length === 0
                  || (this.inViewFocusableLinks.length > 0
                  && this.focusableLinks[0].classList.contains('focus')))) {
            this.removeAllFocus();
            return;
          }
          // we need distinguish the situation with the focusable links
          // length.
          //
          // 1. the focusable links length is 0.
          // if no inview focusable links, we should scroll the page
          // immediately.
          if (beforeScrollLength === 0) {
            this.scrollByStep(this.scrollContainer, 'up');
            afterScrollLength = this.inViewFocusableLinks.length;
            // and if has focusable links after scroll, should set focus
            // on the last one.
            if (afterScrollLength > 0) {
              this.setFocusElement(afterScrollLength - 1);
            }
          // 2. the focusable links length is 1.
          // if has one inview focusable link, we should scroll the page
          // immediately.
          } else if (beforeScrollLength === 1) {
            beforeScrollEl = this.inViewFocusableLinks[0];
            this.scrollByStep(this.scrollContainer, 'up');
            afterScrollLength = this.inViewFocusableLinks.length;
            // and if has no focusable link after scroll, we must remove
            // all focus.
            if (afterScrollLength === 0) {
              this.removeAllFocus();
              this.updateSoftKey();
            // and if has focusbale links after scroll, we must set the
            // focus to the previous one.
            } else if (afterScrollLength > 0) {
              let index = this.inViewFocusableLinks.indexOf(beforeScrollEl);
              if (index === -1) {
                this.setFocusElement(afterScrollLength - 1);
              } else if (index === (afterScrollLength - 1)
                  && afterScrollLength > 1) {
                this.setFocusElement(index - 1);
              }
            }
          // 3. the focusable links length > 1
          } else if (beforeScrollLength > 1) {
            let focusedElIndex;
            // we need to know the focused link's index
            for (let i = 0; i < this.inViewFocusableLinks.length; i++) {
              let inViewFocusableLink = this.inViewFocusableLinks[i];
              if (inViewFocusableLink.classList.contains('focus')) {
                focusedElIndex = i;
                beforeScrollEl = inViewFocusableLink;
              }
            }

            // if focused link is not the first one, we only need set the
            // focus to the previous one.
            if (focusedElIndex > 0) {
              this.setFocusElement(focusedElIndex - 1);
            // and if focused link is the first one, we need to scroll
            // the page firstly, then check the focusable links' length
            // after scroll to determine which link should be focused.
            } else if (focusedElIndex === 0) {
              this.scrollByStep(this.scrollContainer, 'up');
              afterScrollLength = this.inViewFocusableLinks.length;
              if (afterScrollLength === 0) {
                this.removeAllFocus();
              } else if (afterScrollLength > 0) {
                let index = this.inViewFocusableLinks.indexOf(beforeScrollEl);
                if (index === -1) {
                  this.setFocusElement(afterScrollLength - 1);
                } else if (index > 0) {
                  this.setFocusElement(index - 1);
                }
              }
            }
          }
          evt.preventDefault();
          evt.stopPropagation();
          break;
      }
    },

    disableReply: function() {
      this.canReply = false;
    },

    enableReply: function() {
      this.canReply = true;
      if (!this.firstVisible) {
        this.updateSoftKey(this.softkeyType);
      }
      // Inform that content is ready. Done here because reply is only enabled
      // once the full body is available.
      if (!this._emittedContentEvents) {
        evt.emit('metrics:contentDone');
        this._emittedContentEvents = true;
      }
    },

    /**
     * Called by Cards when the this of this card type is the
     * visible card.
     */
    onCardVisible: function(navDirection) {
      const CARD_NAME = this.localName;
      const QUERY_CHILD = ':not(.collapsed).focusable';
      const CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

      // forward: new card pushed
      if (navDirection === 'forward') {
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('first');
        this.observer = NavigationMap.observeChild(CARD_NAME, QUERY_CHILD);
      }
      // back: hidden card is restored
      else if (navDirection === 'back') {
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('restore');
      }

      if (!this.keydownHandler) {
        this.keydownHandler = this.handleKeyDown.bind(this);
        window.addEventListener('keydown', this.keydownHandler);
      } else if (navDirection === 'back') {
        window.addEventListener('keydown', this.keydownHandler);
      }
      this.updateCurrentViewFocusLinks();
      if (!this.softkeyType) {
        this.softkeyType = 'select';
      }
      this.updateSoftKey(this.softkeyType);

      if (window.performance.getEntriesByName('mail-load-start',
                                              'mark').length > 0) {
        window.performance.mark('mail-load-end');
        window.performance.measure('performance-mail-loaded',
                                   'mail-load-start', 'mail-load-end');
        window.performance.clearMarks('mail-load-start');
        window.performance.clearMarks('mail-load-end');
      }
      this.firstVisible = false;
    },

    onHidden: function() {
      console.log(this.localName + ' onHidden');
      window.removeEventListener('keydown', this.keydownHandler);
    },

    onFocusChanged: function(queryChild, index, item) {
      if (this.className !== 'card center') {
        return;
      }
      let focused = document.querySelector('.focus');
      if (!focused.classList.contains('msg-body-container')) {
        if (item.classList.contains('msg-reader-attachments-container') ||
            item.classList.contains('msg-reader-load-infobar') ||
            item.classList.contains('msg-envelope-line')) {
          this.updateSoftKey('select');
        } else {
          this.updateSoftKey();
        }
      }
    },

    handleKeyDown: function(event) {
      if (window.option.menuVisible) {
        return;
      }
      switch (event.key) {
        case 'ArrowLeft':
          this.goPrevious();
          break;
        case 'ArrowRight':
          this.goNext();
          break;
        case 'BrowserBack':
        case 'Backspace':
          event.preventDefault();
          if (NavigationMap.configDialogShown()) {
            CustomDialog.hide();
          } else {
            this.goBack();
          }
          break;
      }
    },

    setFocusElement: function(index) {
      this.removeAllFocus();
      if (this.inViewFocusableLinks.length > 0) {
        let toFocused = this.inViewFocusableLinks[index];
        toFocused.classList.add('focus');
        toFocused.focus();

        for (let i = 0; i < this.focusableLinks.length; i++) {
          if (this.focusableLinks[i].classList.contains('focus') &&
              this.focusableLinks[i].hasAttribute('ext-href')) {
            this.externalLinkURL =
                this.focusableLinks[i].getAttribute('ext-href');
            if (!this.focusableLinks[i].hasAttribute('link')) {
              this.linkData = this.getLinkData();
              this.focusableLinks[i].setAttribute('link',
                  JSON.stringify(this.linkData));
            } else {
              this.linkData =
                  JSON.parse(this.focusableLinks[i].getAttribute('link'));
            }
            break;
          }
        }
        this.updateSoftKey('open');

        // update currentLinkIndex
        for (let i = 0; i < this.focusableLinks.length; i++) {
          if (this.focusableLinks[i] === toFocused) {
            this.currentLinkIndex = i;
            break;
          }
        }
      }
    },

    getLinkData: function () {
      let linkData = {};
      let data;
      if (/^callto:/i.exec(this.externalLinkURL)) {
        linkData.type = 'number';
        data = queryURI(this.externalLinkURL);
        linkData.content = data.number;
      } else if (/^mailto:/i.exec(this.externalLinkURL)) {
        linkData.type = 'email';
        data = queryURI(this.externalLinkURL);
        linkData.content = data.to;
      } else {
        linkData.type = 'url';
        linkData.content = this.externalLinkURL;
      }
      return linkData;
    },

    setFocusRestoreElement: function(index) {
      let toFocused = this.focusableLinks[index];
      toFocused.classList.add('focus');
      toFocused.focus();
      if (!this.isVisible(toFocused, true)) {
        toFocused.scrollIntoView();
      }
    },

    scrollByStep: function(el, dir) {
      let sHeight = el.scrollHeight;
      let cHeight = el.clientHeight;
      let moveHeight = sHeight - cHeight;
      let sTop = el.scrollTop;
      if (dir === 'down') {
        if (sTop < moveHeight) {
          if (sTop + stepHeight >= moveHeight) {
             el.scrollTop = moveHeight;
          } else {
             el.scrollTop = sTop + stepHeight;
          }
        }
      } else if (dir === 'up') {
        if (sTop - stepHeight >= 0) {
          el.scrollTop = sTop - stepHeight;
        } else {
          el.scrollTop = 0;
        }
      }

      if (this.focusableLinks.length > 0) {
        this.updateCurrentViewFocusLinks();
      }
    },

    updateCurrentViewFocusLinks: function() {
      this.inViewFocusableLinks = [];
      for (let i = 0; i < this.focusableLinks.length; i++) {
        if (this.isVisible(this.focusableLinks[i], true)) {
          this.inViewFocusableLinks.push(this.focusableLinks[i]);
        }
      }
    },

    isVisible: function(el, isLinks) {
      if (el.offsetWidth === 0 || el.offsetHeight === 0) {
        return false;
      }
      let height = document.documentElement.clientHeight -
                   document.getElementById('softkeyPanel').clientHeight,
          rects = el.getClientRects(),
          msgBodyRects = this.rootBodyNode.getClientRects()[0],
          topTarget = this._topStuffHeight;

      if (!this.iframeScale && isLinks) {
        this.iframeScale = 1;
      }

      for (let i = 0, l = rects.length; i < l; i++) {
        let r = rects[i];
        let originalTop = (this.bodyRepType === 'html' ? msgBodyRects.top : 0);
        let compareBottom = isLinks ?
            r.bottom * this.iframeScale + originalTop : r.bottom;
        let compareTop = isLinks ?
            r.top * this.iframeScale + originalTop : r.top;
        if ((el.classList.contains('msg-body-container')
             && compareTop < height && compareTop >= topTarget)
             || (!el.classList.contains('msg-body-container')
                  && (compareBottom > 0 && compareBottom <= height)
                  && (compareTop >= topTarget))) {
          return true;
        }
      }
      return false;
    },

    removeAllFocus: function() {
      for (let i = 0; i < this.focusableLinks.length; i++) {
        if (this.focusableLinks[i].classList.contains('focus')) {
          this.focusableLinks[i].classList.remove('focus');
        }
      }
    },

    die: function() {
      headerCursor.removeListener('messageSuidNotFound',
                                  this.onMessageSuidNotFound);
      headerCursor.removeListener('currentMessage', this.onCurrentMessage);
      window.removeEventListener('keydown', this.keydownHandler);
      this.rootBodyNode.removeEventListener('focus',
              this.handleRootBodyNodeFocus);
      this.rootBodyNode.removeEventListener('keydown',
          this.handRootBodyNodeKeydown);
      this.htmlBodyNodes = [];
      this.focusableLinks = [];
      this.inViewFocusableLinks = [];
      this.rootBodyNode.innerHTML = '';
      this.attachmentsContainer.parentNode.removeChild(
        this.attachmentsContainer
      );
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      // Our header was makeCopy()d from the message-list and so needs to be
      // explicitly removed since it is not part of a slice.
      if (this.header) {
        this.header.__die();
        this.header = null;
      }
      if (this.body) {
        this.body.die();
        this.body = null;
      }
      let id = this.localName + ' ' + ':not(.collapsed).focusable';
      NavigationMap.removeDiedControls(id);
    }
  }
];
});
