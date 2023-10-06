
define('tmpl!cards/cmp/attachment_item.html',['tmpl'], function (tmpl) { return tmpl.toDom('<li class="cmp-attachment-item cmp-attachment-focusable">\n  <span class="cmp-attachment-icon" role="presentation"></span>\n  <span class="cmp-attachment-fileinfo">\n    <span dir="auto" class="cmp-attachment-filename p-pri"></span>\n    <span class="cmp-attachment-filesize p-pri"></span>\n  </span>\n</li>'); });

define('tmpl!cards/cmp/peep_bubble.html',['tmpl'], function (tmpl) { return tmpl.toDom('<div class="cmp-peep-bubble peep-bubble" dir="auto" role="button">\n  <span class="cmp-peep-name"></span>\n  <span class="cmp-peep-address collapsed"></span>\n</div>\n'); });

define('tmpl!cards/cmp/suggestion_item.html',['tmpl'], function (tmpl) { return tmpl.toDom('<li class="suggestion-item" role="presentation">\r\n  <a class="suggestion" role="option" data-email="{{email}}" data-source="contacts" data-name="{{name}}">\r\n    <p class="name"><bdi class="ellipsis-dir-fix p-pri">{{name}}</bdi></p>\r\n    <p class="email">\r\n        <span class="description p-pri">{{type}}, </span>\r\n        <span class="email-detail p-pri">{{email}}</span>\r\n    </p>\r\n  </a>\r\n</li>\r\n'); });


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

define('template!cards/compose.html',['template'], function(template) { return {
createdCallback: template.templateCreatedCallback,
template: template.objToFn({"id":"cards/compose.html","deps":[],"text":"<section class=\"cmp-compose-header\" role=\"region\" data-statuscolor=\"default\">\n  <header data-prop=\"headerNode\">\n    <h1 id=\"compose-header\" class=\"cmp-compose-header-label\" data-prop=\"cmpTitle\"></h1>\n  </header>\n</section>\n<div data-prop=\"scrollContainer\" class=\"scrollregion-below-header\"\n     role=\"heading\" aria-labelledby=\"compose-header\">\n  <div data-prop=\"addrBar\" class=\"cmp-envelope-bar\">\n    <div class=\"cmp-addr-bar\">\n      <div data-event=\"keydown:onContainerKeydown\"\n           class=\"cmp-envelope-line cmp-combo focusable\"\n           role=\"textbox\" data-prop=\"cmp_to\">\n        <span class=\"cmp-to-label cmp-addr-label\"\n              data-l10n-id=\"compose-to\" aria-hidden=\"true\"></span>\n        <div class=\"cmp-to-container cmp-addr-container\">\n          <div class=\"cmp-bubble-container\" data-prop=\"toContainer\">\n              <input data-prop=\"toNode\"\n                     data-event=\"keydown:onAddressKeydown,input:onAddressInput,focus:onAddressFocus\"\n                     dir=\"auto\" maxlength=\"255\"\n                     class=\"cmp-to-text cmp-addr-text\" type=\"email\" />\n          </div>\n        </div>\n      </div>\n      <!-- XXX: spec calls for showing cc/bcc merged until selected,\n           but there is also the case where replying itself might need\n           to expand, so we are deferring that feature -->\n      <div data-event=\"keydown:onContainerKeydown\"\n           class=\"cmp-envelope-line cmp-combo collapsed\"\n           role=\"textbox\" data-l10n-id=\"cc-group\" data-prop=\"cmp_cc\">\n        <span class=\"cmp-cc-label cmp-addr-label\"\n               data-l10n-id=\"compose-cc\" aria-hidden=\"true\"></span>\n        <div class=\"cmp-cc-container cmp-addr-container\">\n          <div class=\"cmp-bubble-container\" data-prop=\"ccContainer\">\n            <input data-prop=\"ccNode\"\n                   data-event=\"keydown:onAddressKeydown,input:onAddressInput,focus:onAddressFocus\"\n                   dir=\"auto\" maxlength=\"255\"\n                   class=\"cmp-cc-text cmp-addr-text\" type=\"email\" />\n          </div>\n        </div>\n      </div>\n      <div data-event=\"keydown:onContainerKeydown\"\n           class=\"cmp-envelope-line cmp-combo collapsed\"\n           role=\"textbox\" data-l10n-id=\"bcc-group\" data-prop=\"cmp_bcc\">\n        <span class=\"cmp-bcc-label cmp-addr-label\"\n               data-l10n-id=\"compose-bcc\" aria-hidden=\"true\"></span>\n        <div class=\"cmp-bcc-container cmp-addr-container\">\n          <div class=\"cmp-bubble-container\" data-prop=\"bccContainer\">\n            <input data-prop=\"bccNode\"\n                   data-event=\"keydown:onAddressKeydown,input:onAddressInput,focus:onAddressFocus\"\n                   dir=\"auto\" maxlength=\"255\"\n                   class=\"cmp-bcc-text cmp-addr-text\" type=\"email\" />\n          </div>\n        </div>\n      </div>\n    </div>\n    <div class=\"cmp-envelope-line cmp-subject focusable\">\n      <span class=\"cmp-subject-label\"\n            data-l10n-id=\"compose-subject\" aria-hidden=\"true\"></span>\n      <input data-prop=\"subjectNode\"\n             data-event=\"keydown:onSubjectKeydown\"\n             dir=\"auto\" maxlength=\"255\"\n             class=\"cmp-subject-text\" type=\"text\" data-l10n-id=\"subject\" />\n    </div>\n    <div data-prop=\"errorMessage\" class=\"cmp-error-message collapsed\"></div>\n    <div data-prop=\"loadingAttachments\" class=\"cmp-loading-attachments collapsed\">\n      <span data-prop=\"loadingAttachmentsInfo\"\n            class=\"cmp-loading-progress p-pri\"\n            data-l10n-id=\"compose-attachment-loading\"></span>\n      <progress></progress>\n    </div>\n    <div data-prop=\"attachmentTotal\"\n         class=\"cmp-envelope-line cmp-attachment-total collapsed\"\n         data-event=\"click:goAttachmentsList\">\n      <span data-prop=\"attachmentLabel\"\n            class=\"cmp-attachment-label cmp-addr-label p-sec\"></span>\n      <span class=\"cmp-attachment-info\">\n        <span data-prop=\"attachmentsName\" class=\"cmp-attachment-name p-pri\"></span>\n        <span data-prop=\"attachmentsSize\" class=\"cmp-attachment-size p-pri\"></span>\n      </span>\n    </div>\n    <div data-prop=\"attachmentsContainer\" class=\"cmp-attachment-container collapsed\">\n    </div>\n    <div> </div>\n  </div>\n  <li class=\"cmp-body-li focusable\">\n    <div data-prop=\"textBodyNode\" class=\"cmp-body-text p-pri\"\n         contenteditable=\"true\" role=\"textbox\" aria-multiline=\"true\"\n         data-l10n-id=\"compose-text\" data-event=\"keydown:onBodyNodeKeydown\"></div>\n  </li>\n  <div data-prop=\"htmlBodyContainer\"\n       dir=\"auto\"\n       class=\"cmp-body-html collapsed\"\n       data-l10n-id=\"message-body-container\">\n  </div>\n  <section id=\"suggestionsContainer\" class=\"email-suggestion\"\n           data-type=\"list\" data-prop=\"suggestionsContainer\">\n    <ul data-prop=\"suggestionsList\" class=\"contact-list contact-suggestions-list\"\n        role=\"listbox\">\n    </ul>\n  </section>\n</div>\n"})}; });

/**
 * Card definitions/logic for composition, contact picking, and attaching
 * things.  Although ideally, the picking and attaching will be handled by a
 * web activity or shared code.
 **/

/*global MozActivity, NavigationMap */

define('cards/compose',['require','exports','module','tmpl!./cmp/attachment_item.html','tmpl!./cmp/peep_bubble.html','tmpl!./cmp/suggestion_item.html','evt','html_cache','toaster','model','iframe_shims','l10n!','cards','mime_to_class','file_display','contacts','./base','template!./compose.html','./editor_mixins'],function(require, exports, module) {

let cmpAttachmentItemNode = require('tmpl!./cmp/attachment_item.html'),
    cmpPeepBubbleNode = require('tmpl!./cmp/peep_bubble.html'),
    suggestionItem = require('tmpl!./cmp/suggestion_item.html'),

    evt = require('evt'),
    htmlCache = require('html_cache'),
    toaster = require('toaster'),
    model = require('model'),
    iframeShims = require('iframe_shims'),
    mozL10n = require('l10n!'),
    cards = require('cards'),
    mimeToClass = require('mime_to_class'),
    fileDisplay = require('file_display'),
    Contacts = require('contacts'),
    dataIdCounter = 0;

/**
 * Max composer attachment size is defined as 5120000 bytes.
 */
let MAX_ATTACHMENT_SIZE = 5120000;

/**
 * To make it easier to focus input boxes, we have clicks on their owning
 * container cause a focus event to occur on the input.  This method helps us
 * also position the cursor based on the location of the click so the cursor
 * can end up at the edges of the input box which could otherwise be very hard
 * to do.
 */
function focusInputAndPositionCursorFromContainerClick(event, input) {
  // Do not do anything if the event is happening on the input already or we
  // will disrupt the default positioning logic!  We use explicitOriginalTarget
  // because under Gecko originalTarget may contain anonymous content.
  if (event.explicitOriginalTarget === input) {
    return;
  }
  // Stop bubbling to avoid our other focus-handlers!
  event.stopPropagation();

  // coordinates are relative to the viewport origin
  let bounds = input.getBoundingClientRect();
  let midX = bounds.left + bounds.width / 2;
  // and that's what clientX is too!
  input.focus();
  let cursorPos = 0;
  if (event.clientX >= midX) {
    cursorPos = input.value.length;
  }
  input.setSelectionRange(cursorPos, cursorPos);
}

return [
  require('./base')(require('template!./compose.html')),
  require('./editor_mixins'),
  {
    createdCallback: function() {
      // Save a cached version before anything is changed on the pristine
      // template state.
      htmlCache.cloneAndSave(module.id, this);

      this.sending = false;
      this.doActive = true;
      this.needRefresh = false;
      this.suggestionList = false;
      this.suggestionListNavListener = false;
      this.focusTo = null;
      this.cmp_params = null;

      // Management of attachment work, to limit memory use
      this._totalAttachmentsFinishing = 0;
      this._totalAttachmentsDone = 0;
      this._wantAttachment = false;
      this._onAttachmentDone = this._onAttachmentDone.bind(this);

      // Pass text node to editor mixins
      this._bindEditor(this.textBodyNode);

      // Add subject focus for larger hitbox
      let subjectContainer = this.querySelector('.cmp-subject');
      subjectContainer.addEventListener('click', (evt) => {
        focusInputAndPositionCursorFromContainerClick(
          evt, subjectContainer.querySelector('input'));
      });

      // Tracks if the card closed itself, in which case
      // no draft saving is needed. If something else
      // causes the card to die, then we want to save any
      // state.
      this._selfClosed = false;

      // Set up unique data IDs for data-sensitive operations that could be in
      // progress. These IDs are unique per kind of action, not unique per
      // instance of a kind of action. However, these IDs are just used to know
      // if a hard shutdown should be delayed a bit, and are unique enough for
      // those purposes.
      let dataId = module.id + '-' + (dataIdCounter += 1);
      this._dataIdSaveDraft = dataId + '-saveDraft';
      this._dataIdSendEmail = dataId + '-sendEmail';
      this.addWhich = 'to';
      this.handBodyContainerKeydown = this.handBodyContainerKeydown.bind(this);
    },

    onArgs: function(args) {
      this.composer = args.composer;
      this.composerData = args.composerData || {};
      this.type = args.type;
      this.activity = args.activity;
      this.forwardAttachments = args.forwardAttachments || null;
      this.unDownloadFilesSize = args.unDownloadFilesSize || 0;
      this.attachFilesSize = args.filesSize || 0;
      this.updateTitle(args);
      if ((this.type && this.type === 'reply') ||
          (this.activity && this.activity.source.data)) {
        this.toNode.classList.add('collapsed');
        this.ccNode.classList.add('collapsed');
        this.bccNode.classList.add('collapsed');
      }
    },

    updateTitle: function(args) {
      if (args.title) {
        mozL10n.setAttributes(this.cmpTitle, args.title);
      } else {
        mozL10n.setAttributes(this.cmpTitle, 'compose-header-short');
      }
    },

    handleMenu: function(evt) {
      let action = evt.detail.menuVisible;
      if (action === false) {
        setTimeout(() => {
          this.refresh();
        });
      }
    },

    changeFocus: function(isSetFocus, classNameStr) {
      let parentNode = null;
      let inputNode = null;
      switch(this.addWhich) {
        case 'to':
            parentNode = this.cmp_to;
            inputNode = this.cmp_to.querySelector('.cmp-addr-text');
          break;
        case 'cc':
            parentNode = this.cmp_cc;
            inputNode = this.cmp_cc.querySelector('.cmp-addr-text');
          break;
        case 'bcc':
            parentNode = this.cmp_bcc;
            inputNode = this.cmp_bcc.querySelector('.cmp-addr-text');
            break;
      }
      if (!parentNode || !inputNode) {
        return;
      }
      if (isSetFocus) {
        parentNode.classList.add(classNameStr);
        inputNode.focus();
      } else {
        parentNode.classList.remove(classNameStr);
        inputNode.blur();
      }
    },

    handleKeydown: function(evt) {
      switch (evt.key) {
        case 'Backspace':
          evt.preventDefault();
          let addClassName = this.inEditMode ? 'edit-mode' : 'focus';
          if (this.suggestionsList.children.length !== 0) {
            let selected = this.suggestionsList.querySelector('.selected');
            if (selected) {
              this.changeFocus(true, addClassName);
              return;
            }
          }
          if (!option.menuVisible) {
            if (NavigationMap.configDialogShown()) {
              this.hideDialog();
              NavigationMap.restoreFocus();
            } else {
              this.onBack();
            }
          }
          break;
      }
    },

    handleEndkey: function(evt) {
      let callback = evt.detail.callback;
      if (option.menuVisible) {
        option.hideMenu();
      }
      this.onBack(callback);
    },

    onCardVisible: function(navDirection) {
      let CARD_NAME = this.localName;
      let QUERY_CHILD = '.focusable';
      let CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;
      let source = this.activity ? this.activity.source : null;

      this.menuHandler = this.handleMenu.bind(this);
      window.addEventListener('menuEvent', this.menuHandler);
      this.keydownHandler = this.handleKeydown.bind(this);
      window.addEventListener('keydown', this.keydownHandler);
      this.endkeyHandler = this.handleEndkey.bind(this);
      window.addEventListener('email-endkey', this.endkeyHandler);
      NavigationMap.cardContentHeight = this.scrollContainer.clientHeight;

      if (navDirection === 'forward') {
        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
        if ((this.type && this.type === 'reply') || (source && source.data &&
            Object.keys(source.data).length)) {
          // if the compose type is 'reply', we need always set focus on text
          // body node.
          if (this.htmlBodyContainer.classList.contains('collapsed')) {
            NavigationMap.setFocus('last');
          } else {
            let length = NavigationMap.getCurrentControl().elements.length;
            NavigationMap.setFocus(length - 2);
          }
          this.textBodyNode.focus();
        } else if (!NavigationMap.configDialogShown()) {
          NavigationMap.setFocus('first');
        }
      } else if (navDirection === 'back') {
        NavigationMap.setCurrentControl(CONTROL_ID);
        NavigationMap.setFocus('restore');
      }

      this.cmp_to.addEventListener('focus', () => {
        this.toNode.focus();
        this.toNode.setSelectionRange(this.toNode.value.length,
          this.toNode.value.length);
        if (this.toContainer.children.length > 1) {
          NavigationMap.horizontal = '.cmp-to-container';
          NavigationMap.navSetup(this.localName, '.focusable');
        }
      });

      this.cmp_cc.addEventListener('focus', () => {
        this.ccNode.focus();
        this.ccNode.setSelectionRange(this.ccNode.value.length,
          this.ccNode.value.length);
        if (this.ccContainer.children.length > 1) {
          NavigationMap.horizontal = '.cmp-cc-container';
          NavigationMap.navSetup(this.localName, '.focusable');
        }
      });

      this.cmp_bcc.addEventListener('focus', () => {
        this.bccNode.focus();
        this.bccNode.setSelectionRange(this.bccNode.value.length,
          this.bccNode.value.length);
        if (this.bccContainer.children.length > 1) {
          NavigationMap.horizontal = '.cmp-bcc-container';
          NavigationMap.navSetup(this.localName, '.focusable');
        }
      });

      let cmpBodyLi = document.querySelector('.cmp-body-li');
      cmpBodyLi.addEventListener('focus', () => {
        this.textBodyNode.focus();
      });

      NavigationMap.checkStorage();
    },

    onFocusChanged: function(queryChild, index, item) {
      console.log(this.localName + '.onFocusChanged, queryChild=' +
                  queryChild + ', index=' + index);
      if (this.addATTActivity && this.addATTActivity.readyState === 'pending') {
        this.addATTActivity = null;
        return;
      }
      if (item && item.classList.contains('cmp-combo')) {
        let inputItem =
            item.lastElementChild.lastElementChild.lastElementChild;
        if (inputItem && inputItem.classList.contains('collapsed')) {
          inputItem.classList.remove('collapsed');
        }
      }
      this.updateSoftkey();
    },

    updateSoftkey: function() {
      let params = [];
      let focused = document.querySelector('.focus') ||
                    NavigationMap.getCurrentItem();

      if (focused.classList.contains('cmp-body-li')) {
        params.push({
          name: 'Enter',
          l10nId: 'enter',
          priority: 2
        });
      } else if (focused.classList.contains('cmp-attachment-total')) {
        params.push({
          name: 'Select',
          l10nId: 'select',
          priority: 2
        });
      }
      if (focused.classList.contains('cmp-combo')) {
        focused.querySelector('.cmp-addr-text').focus();
        params.push({
          name: 'Add Contact',
          l10nId: 'add-contact',
          priority: 3,
          method: () => {
            this.onContactAdd();
          }
        });
      } else {
        if (focused.classList.contains('cmp-subject')) {
          focused.querySelector('input').focus();
        }
        params.push({
          name: 'Add Attachment',
          l10nId: 'add-attachment',
          priority: 5,
          method: () => {
            this.onAttachmentAdd();
          }
        });

        // It is the controller for Cc option
        if (this.cmp_cc.classList.contains('collapsed')) {
          params.push({
            name: 'Add Cc',
            l10nId: 'add-cc',
            priority: 5,
            method: () => {
              this.onccAdd();
            }
          });
        } else {
          params.push({
            name: 'Remove Cc',
            l10nId: 'remove-cc',
            priority: 5,
            method: () => {
              this.onccRemove();
            }
          });
        }

        // It is the controller for Bcc option
        if (this.cmp_bcc.classList.contains('collapsed')) {
          params.push({
            name: 'Add Bcc',
            l10nId: 'add-bcc',
            priority: 5,
            method: () => {
              this.onbccAdd();
            }
          });
        } else {
          params.push({
            name: 'Remove Bcc',
            l10nId: 'remove-bcc',
            priority: 5,
            method: () => {
              this.onbccRemove();
            }
          });
        }

        params.push({
          name: 'Save As Draft',
          l10nId: 'save-as-draft',
          priority: 5,
          method: () => {
            this._saveDraft('explicit', () => {
              this.goBack();
            });
            toaster.toast({
              text: mozL10n.get('composer-draft-saved')
            });
          }
        });
        params.push({
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 5,
          method: () => {
            this.onBack();
          }
        });
      }
      this.cmp_params = params;
      this.setSoftkey();
    },

    setSoftkey: function() {
      let params = [];
      if (this.needSendKey) {
        params.push({
          name: 'Send',
          l10nId: 'compose-send',
          priority: 1,
          method: () => {
            this.onSend();
          }
        });
      }
      if (this.cmp_params) {
        NavigationMap.setSoftKeyBar(params.concat(this.cmp_params));
      }
    },

    switchSKtoSuggetion: function() {
      let params = [];
      params.push({
        name: 'Select',
        l10nId: 'select',
        priority: 2,
        method: () => {
          let node = this.suggestionsList.querySelector('.selected');
          node.click();
        }
      });
      NavigationMap.setSoftKeyBar(params);
    },

    /**
     * Inform Cards to not emit startup content events, this card will trigger
     * them once data from back end has been received and the DOM is up to date
     * with that data.
     * @type {Boolean}
     */
    skipEmitContentEvents: true,

    /**
     * Focus our contenteditable region and position the cursor at the last
     * valid editing cursor position.
     *
     * The intent is so that if the user taps below our editing region that we
     * still correctly position the cursor.  We previously relied on min-height
     * to do this for us, but that results in ugly problems when we have quoted
     * HTML that follows and our editable region is not big enough to satisfy
     * the height.
     *
     * Note: When we are quoting HTML, the "Bob wrote:" stuff does go in the
     * contenteditable text area, so we may actually want to get smarter and
     * position the cursor before that node instead.
     */
    _focusEditorWithCursorAtEnd: function(event) {
      if (event) {
        event.stopPropagation();
      }

      // Selection/range manipulation is the easiest way to force the cursor
      // to a specific location.
      //
      // Note: Once the user has pressed return once, the editor will create a
      // bogus <br type="_moz"> that is always the last element.  Even though
      // this bogus node will be the last child, nothing tremendously bad
      // happens.
      //
      // Note: This technique does result in our new text existing in its own,
      // new text node.  So don't make any assumptions about how text nodes are
      // arranged.
      let insertAfter = this.textBodyNode.lastChild;
      let range = document.createRange();
      range.setStartAfter(insertAfter);
      range.setEndAfter(insertAfter);

      this.textBodyNode.focus();
      let selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    },


    postInsert: function() {
      // the HTML bit needs us linked into the DOM so the iframe can be
      // linked in, hence this happens in postInsert.
      require(['iframe_shims'], () => {

        // NOTE: when the compose card changes to allow switching the From
        // account then this logic will need to change, both the acquisition of
        // the account pref and the folder to use for the composer. So it is
        // good to group this logic together, since they both will need to
        // change later.
        if (this.composer) {
          this._loadStateFromComposer();
        } else {
          let data = this.composerData;
          model.latestOnce('folder', (folder) => {
            this.composer = model.api.beginMessageComposition(data.message,
                                                              folder,
                                                              data.options,
                                                              () => {
              if (data.onComposer) {
                data.onComposer(this.composer, this);
              }

              this._loadStateFromComposer();
            });
          });
        }
      });
    },

    _loadStateFromComposer: function() {
      let self = this;
      function expandAddresses(node, addresses) {
        if (!addresses) {
          return '';
        }
        addresses.forEach((aval) => {
          let name, address;
          if (typeof(aval) === 'string') {
            // TODO: We will apply email address parser for showing bubble
            //       properly. We set both name and address same as aval string
            //       before parser is ready.
            if (self.activity) {
              Contacts.findContactByString(aval, null,
                (contacts) => {
                  if (contacts.length) {
                    name = contacts[0].name[0] ? contacts[0].name[0] : aval;
                    address = aval;
                  } else {
                    name = address = aval;
                  }
                  self.insertBubble(node, name, address);
                });
            } else {
              name = address = aval;
              self.insertBubble(node, name, address);
            }
          } else {
            name = aval.name;
            address = aval.address;
            self.insertBubble(node, name, address);
          }
        })
      }
      expandAddresses(this.toNode, this.composer.to);

      expandAddresses(this.ccNode, this.composer.cc);
      if (this.composer.cc && this.composer.cc.length > 0) {
        this.cmp_cc.classList.remove('collapsed');
        this.cmp_cc.classList.add('focusable');
      }

      expandAddresses(this.bccNode, this.composer.bcc);
      if (this.composer.bcc && this.composer.bcc.length > 0) {
        this.cmp_bcc.classList.remove('collapsed');
        this.cmp_bcc.classList.add('focusable');
      }

      this.validateAddresses();
      this.doActive = false;
      this.renderSendStatus();

      // Add attachments
      if (this.forwardAttachments) {
        this.setForwardAttachments();
      } else {
        this.renderAttachments();
      }

      this.subjectNode.value = this.composer.subject;
      // Save the initial state of the composer so that if the user immediately
      // hits the back button without doing anything we can simply discard the
      // draft. This is not for avoiding redundant saves or any attempt at
      // efficiency.
      this.origText = this.composer.body.text;

      this.populateEditor(this.composer.body.text);

      if (this.composer.body.html) {
        this.htmlBodyContainer.classList.remove('collapsed');
        this.htmlBodyContainer.classList.add('focusable');
        // Although (still) sanitized, this is still HTML we did not create and
        // so it gets to live in an iframe.  Its read-only and the user needs to
        // be able to see what they are sending, so reusing the viewing
        // functionality is desirable.
        let ishims = iframeShims.createAndInsertIframeForContent(
          this.composer.body.html, this.scrollContainer,
          this.htmlBodyContainer, /* append */ null,
          'noninteractive',
          /* no click handler because no navigation desired */ null);

        this.htmlBodyContainer.addEventListener('keydown', this.handBodyContainerKeydown);
      }

      // There is a bit more possibility of async work done in the iframeShims
      // internals, but this is close enough and is better than breaking open
      // the internals of the iframeShims to get the final number.
      if (!this._emittedContentEvents) {
        evt.emit('metrics:contentDone');
        this._emittedContentEvents = true;
      }
    },

    handBodyContainerKeydown: function(evt) {
      switch (evt.key) {
        case 'ArrowDown':
          this.scrollByStep(this.scrollContainer, 'down');
          evt.preventDefault();
          evt.stopPropagation();
          break;
        case 'ArrowUp':
          // we need to check if we should move the focus out of message
          // body node or not
          if (this.textBodyNodeIsVisible()) {
            return;
          }
          this.scrollByStep(this.scrollContainer, 'up');
          evt.preventDefault();
          evt.stopPropagation();
          break;
      }
    },

    scrollByStep: function(el, dir) {
      let sHeight = el.scrollHeight;
      let cHeight = el.clientHeight;
      let moveHeight = sHeight - cHeight;
      let sTop = el.scrollTop;
      let stepHeight = document.documentElement.clientHeight / 8;
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
    },

    textBodyNodeIsVisible: function() {
      let rects = this.textBodyNode.getClientRects();
      let top = rects[0].top;

      if (top > this.scrollContainer.offsetTop) {
        return true;
      } else {
        return false;
      }
    },

    /**
     * If this draft came from the outbox, it might have a sendStatus
     * description explaining why the send failed. Display it if so.
     *
     * The sendStatus information on this messages is provided through
     * the sendOutboxMessages job; see `jobs/outbox.js` in GELAM for details.
     */
    renderSendStatus: function() {
      let sendStatus = this.composer.sendStatus || {};
      if (sendStatus.state === 'error') {
        let badAddresses = sendStatus.badAddresses || [];

        // For debugging, report some details to the console, masking
        // recipients for privacy.
        console.log('Editing a failed outbox message. Details:',
        JSON.stringify({
          err: sendStatus.err,
          badAddressCount: badAddresses.length,
          sendFailures: sendStatus.sendFailures
        }, null, ' '));

        let l10nId;
        if (badAddresses.length || sendStatus.err === 'bad-recipient') {
          l10nId = 'send-failure-recipients';
        } else {
          l10nId = 'send-failure-unknown';
        }

        this.errorMessage.setAttribute('data-l10n-id', l10nId);
        this.errorMessage.classList.remove('collapsed');
      } else {
        this.errorMessage.classList.add('collapsed');
      }
    },

    /**
     * Return true if the given address is syntactically valid.
     *
     * @param {String} address
     *   The email address to validate, as a string.
     * @return {Boolean}
     */
    isValidAddress: function(address) {
      // An address is valid if model.api.parseMailbox thinks it
      // contains a valid address. (It correctly classifies names that
      // are not valid addresses.)
      let mailbox = model.api.parseMailbox(address);
      return mailbox && mailbox.address;
    },

    /**
     * Extract addresses from the bubbles and/or inputs, returning a map
     * with keys for 'to', 'cc', 'bcc', 'all', and 'invalid' addresses.
     */
    extractAddresses: function() {
      let allAddresses = [];
      let invalidAddresses = [];

      // Extract the addresses from the bubbles as well as any partial
      // addresses entered in the text input.
      let frobAddressNode = (node) => {
        let bubbles = node.parentNode.querySelectorAll('.cmp-peep-bubble');
        let addrList = [];
        for (let i = 0; i < bubbles.length; i++) {
          let dataSet = bubbles[i].dataset;
          addrList.push({ name: dataSet.name, address: dataSet.address });
        }
        if (node.value.trim().length !== 0) {
          let mailbox = model.api.parseMailbox(node.value);
          addrList.push({ name: mailbox.name, address: mailbox.address });
        }
        addrList.forEach((addr) => {
          allAddresses.push(addr);
          if (!this.isValidAddress(addr.address)) {
            invalidAddresses.push(addr);
          }
        });
        return addrList;
      };

      // NOTE: allAddresses contains invalidAddresses, but we never
      // actually send a message directly using either of those lists.
      // We use to/cc/bcc for that, and our send validation here
      // prevents users from sending a message with invalid addresses.

      return {
        to: frobAddressNode(this.toNode),
        cc: frobAddressNode(this.ccNode),
        bcc: frobAddressNode(this.bccNode),
        all: allAddresses,
        invalid: invalidAddresses
      };
    },

    _saveStateToComposer: function() {
      let addrs = this.extractAddresses();
      this.composer.to = addrs.to;
      this.composer.cc = addrs.cc;
      this.composer.bcc = addrs.bcc;
      this.composer.subject = this.subjectNode.value;
      this.composer.body.text = this.fromEditor();
      // The HTML representation cannot currently change in our UI, so no
      // need to save it.  However, what we send to the back-end is what gets
      // sent, so if you want to implement editing UI and change this here,
      // go crazy.
    },

    _closeCard: function() {
      this._selfClosed = true;
      cards.removeCardAndSuccessors(this, 'animate');
    },

    _saveNeeded: function() {
      let checkHeaderChange = () => {
        let bubbles = this.querySelectorAll('.cmp-peep-bubble');
        let subjectChange = (this.subjectNode.value !== this.composer.subject);
        if (!this.type || this.type !== 'reply') {
          return bubbles.length > 0 || this.toNode.value ||
                 this.ccNode.value || this.bccNode.value || subjectChange;
        } else {
          let addrs = this.extractAddresses();
          return this.isAddressChanged(addrs.to, this.composer.to) ||
                 this.isAddressChanged(addrs.cc, this.composer.cc) ||
                 this.isAddressChanged(addrs.bcc, this.composer.bcc) ||
                 subjectChange;
        }
      };

      // If no composer, then it means the card was destroyed before full
      // setup, which means there is nothing to save.
      if (!this.composer) {
        return false;
      }

      let hasNewContent = this.fromEditor() !== this.composer.body.text;

      // We need `to save / ask about deleting the draft if:
      // There's any recipients or subject changed, there's any new content in
      // the body, there are attachments, or we already created a draft for this
      // guy in which case we really want to provide the option to delete the
      // draft.
      return (checkHeaderChange() || hasNewContent ||
        this.composer.attachments.length ||
        this.composer.hasDraft);
    },

    _saveDraft: function(reason, callback) {
      // If the send process is happening, suppress automatic saves.
      // (Manual saves should not happen when 'sending' is true, but breaking
      // auto-saves would be very bad form.)
      if (this.sending && reason === 'automatic') {
        console.log('compose: skipping autosave because send in progress');
        return;
      }
      this._saveStateToComposer();
      evt.emit('uiDataOperationStart', this._dataIdSaveDraft);
      this.composer.saveDraft(() => {
        evt.emit('uiDataOperationStop', this._dataIdSaveDraft);
        if (callback) {
          callback();
        }
      });
    },

    isAddressChanged: function(currentAddrs, originalAddrs) {
      if (!originalAddrs) {
        return currentAddrs.length > 0;
      } else if (currentAddrs.length !== originalAddrs.length) {
        return true;
      }

      let isObjectValueEqual = (a, b) => {
        let aProps = Object.getOwnPropertyNames(a);
        let bProps = Object.getOwnPropertyNames(b);

        if (aProps.length !== bProps.length) {
          return false;
        }

        for (let i = 0; i < aProps.length; i++) {
          let propName = aProps[i];
          if (a[propName] !== b[propName]) {
            return false;
          }
        }
        return true;
      };

      for (let i = 0; i < currentAddrs.length; i++) {
        for (let j = 0; j < originalAddrs.length; j++) {
          if (isObjectValueEqual(currentAddrs[i], originalAddrs[j])) {
            break;
          } else if (j === originalAddrs.length - 1) {
            return true;
          }
        }
      }
      return false;
    },

    createBubbleNode: function(name, address) {
      let bubble = cmpPeepBubbleNode.cloneNode(true);
      bubble.classList.add('peep-bubble');
      bubble.classList.add('msg-peep-bubble');
      bubble.classList.add('focusable');
      bubble.setAttribute('data-address', address);
      bubble.querySelector('.cmp-peep-address').textContent = address;
      let nameNode = bubble.querySelector('.cmp-peep-name');
      if (navigator.largeTextEnabled) {
        nameNode.classList.add('p-pri');
      }
      if (!name) {
        nameNode.textContent = address.indexOf('@') !== -1 ?
                      address.split('@')[0] : address;
      } else {
        nameNode.textContent = name;
        bubble.setAttribute('data-name', name);
      }
      return bubble;
    },

    /**
     * insertBubble: We can set the input text node, name and address to
     *               insert a bubble before text input.
     */
    insertBubble: function(node, name, address, callback) {
      let container = node.parentNode;
      let cmpLine = container.parentNode.parentNode;
      let bubble = this.createBubbleNode(name || address, address);
      let bInsert = true;
      for (let i = 0; i < container.children.length - 1; i++) {
        let dataSet = container.children[i].dataset;
        if (dataSet.address === address) {
          bInsert = false;
          break;
        }
      }

      let setElementFocus = (element) => {
        if (callback) {
          callback(!this.inEditMode);
        }
        if (this.inEditMode) {
          let input = container.querySelector('.cmp-addr-text');
          input.classList.remove('cmp-edit-text');
          if (element) {
            let elements = Array.prototype.slice.call
                           (NavigationMap.getCurrentControl().elements);
            NavigationMap.setFocus(elements.indexOf(element));
          } else {
            let index = NavigationMap.getCurrentControl().index;
            NavigationMap.setFocus(index);
          }
          this.inEditMode = false;
          let editNode = document.querySelector('.edit-mode.cmp-envelope-line');
          editNode && editNode.classList.remove('edit-mode');
        }
      };

      if (bInsert) {
        container.insertBefore(bubble, node);
        if (!cmpLine.classList.contains('cmp-input-bubble')) {
          cmpLine.classList.add('cmp-input-bubble');
        }
        this.validateAddresses();
        NavigationMap.horizontal = '.' + container.parentNode.classList[0];
        NavigationMap.navSetup(this.localName, '.focusable', null,
                               (seriesElement) => {
          setElementFocus(seriesElement);
        });
      } else {
        setElementFocus();
      }

      if (!this.isBubbleInView(this.toNode)) {
        this.toNode.scrollIntoView(false);
      }
    },

    isBubbleInView: function(el) {
      let rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.bottom <= (window.innerHeight ||
          document.documentElement.clientHeight)
      );
    },

    /**
     * deleteBubble: Delete the bubble from the parent container.
     */
    deleteBubble: function(node) {
      if (!node) {
        return;
      }
      let container = node.parentNode;
      let cmpLine = container.parentNode.parentNode;
      if (node.classList.contains('cmp-peep-bubble')) {
        NavigationMap.horizontal = '.' + container.parentNode.classList[0];
        container.removeChild(node);
      }

      if (container.children.length === 1) {
        if (cmpLine.classList.contains('cmp-input-bubble')) {
          cmpLine.classList.remove('cmp-input-bubble');
        }
      }

      this.validateAddresses();
    },

    /**
     * editBubble: Turn the bubble back into editable text.
     */
    editBubble: function(node) {
      if (!node) {
        return;
      }
      let container = node.parentNode;
      if (node.classList.contains('cmp-peep-bubble')) {
        container.removeChild(node);
        let input = container.querySelector('.cmp-addr-text');
        input.classList.add('cmp-edit-text');
        // If there is already a partially or fully entered address in
        // the typing area, force it to be converted into a bubble, even
        // though the resulting address may not be valid. If it's not
        // valid, that bubble can subsequently be edited. This helps
        // avoid the user losing anything they typed in.
        if (input.value.length > 0) {
          input.value = input.value + ',';
          this.onAddressInput({ target: input }); // Bubblize if necessary.
        }
        let address = node.dataset.address;
        let selStart = input.value.length;
        let selEnd = selStart + address.length;
        input.value += address;
        input.focus();
        this.onAddressInput({ target: input }); // Force width calculations.
        input.setSelectionRange(selEnd, selEnd);
        this.inEditMode = true;
        input.parentNode.parentNode.parentNode.classList.add('edit-mode')
      }
      this.validateAddresses();
    },

    /**
     * Handle bubble deletion while keyboard backspace keydown.
     */
    onAddressKeydown: function(evt) {
      let node = evt.target;

      if (evt.key === 'Backspace') {
        let previousBubble = node.previousElementSibling;
        if (node.value === '' && previousBubble && !this.inEditMode) {
          this.deleteBubble(previousBubble);
          if (NavigationMap.horizontal) {
            NavigationMap.horizontal = null;
          }
          evt.preventDefault();
          evt.stopPropagation();
        }
      }

      if (this.inEditMode) {
        if (evt.key === 'ArrowDown') {
          if (this.suggestionsList.children.length) {
          this.changeFocus(false, 'edit-mode');
          }
          return;
        } else if (evt.key === 'ArrowUp') {
          return;
        }
      }

      if (evt.key === 'Enter') {
        if (this.addedBubble) {
          let index = NavigationMap.getCurrentControl().index;
          NavigationMap.setFocus(index);
          this.addedBubble = false;
          return;
        }
        if (!this.isValidAddress(node.value)) {
          let dialogConfig = {
            title: {
              id: 'compose-invalid-addresses-title',
              args: {}
            },
            body: {
              id: 'compose-invalid-addresses-description',
              args: {}
            },
            accept: {
              l10nId: 'confirm-dialog-ok',
              priority: 2,
              callback: () => {
                let index = NavigationMap.getCurrentControl().index;
                NavigationMap.setFocus(index);
                if (this.inEditMode) {
                  node.classList.remove('cmp-edit-text');
                  this.inEditMode = false;
                  document.querySelector('.edit-mode.cmp-envelope-line')
                    .classList.remove('edit-mode');
                }
              }
            }
          };
          evt.preventDefault();
          evt.stopPropagation();
          NavigationMap.showConfigDialog(dialogConfig);
        } else {
          // This 0 time out is in order to handle 'Enter' key asynchronous.
          // Because when press 'Enter' key very quickly during input email address,
          // if not wait the input finish event handled, the input node's value
          // cannot be set as '' in onAddressInput.
          setTimeout(() => {
            if (node.value) {
              node.value = node.value + ',';
              this.onAddressInput(evt);
            }
          });
        }
      }

      if (evt.key === 'ArrowDown' ||
          (evt.key === 'ArrowUp' && !node.classList.contains('cmp-to-text'))) {
        if (node.classList.contains('cmp-addr-text')) {
          if (node.value) {
            if (this.isValidAddress(node.value) && !this.suggestionList) {
              node.value = node.value + ',';
              this.onAddressInput(evt);
            }
          }
          if (node.value === '' &&
              node.parentNode.children.length > 1) {
            node.classList.add('collapsed');
          }
        }
      }

      if (evt.key === 'ArrowDown') {
        if (this.suggestionList) {
          let focused = document.querySelectorAll('.focus');
          for (let i = 0; i < focused.length; i++) {
            focused[i].classList.remove('focus');
          }
          document.activeElement.blur();
        }
      }
    },

    onSubjectKeydown: function(evt) {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        evt.stopPropagation();
      }
    },

    startNavOnSuggestionList: function(evt) {
      NavigationMap.navSetup(this.localName, '.focusable');
      this.navOnSuggestionListHandle = this.handleNavOnSuggestionList.bind(this);
      window.addEventListener('keydown', this.navOnSuggestionListHandle);
      this.suggestionListNavListener = true;
    },

    stopNavOnSuggestionList: function(evt) {
      let focused = document.querySelector('.focus');
      if (focused && focused.classList.contains('cmp-combo')) {
        let container = focused.querySelector('.cmp-addr-container');
        NavigationMap.horizontal = '.' + container.classList[0];
        NavigationMap.navSetup(this.localName, '.focusable');
      }
      window.removeEventListener('keydown', this.navOnSuggestionListHandle);
      this.suggestionListNavListener = false;
    },

    handleNavOnSuggestionList: function(evt) {
      let selected = this.suggestionsList.querySelector('.selected');
      let index = NavigationMap.getCurrentControl().index;
      switch (evt.key) {
        case 'ArrowDown':
          evt.preventDefault();
          evt.stopPropagation();
          if (selected) {
            if (!selected.nextElementSibling && this.inEditMode) {
              return;
            }
            selected.classList.remove('selected');
            if (selected.nextElementSibling) {
              selected.nextElementSibling.classList.add('selected');
              let focus = this.suggestionsList.querySelector('.selected');
              if (!this.isSuggestionVisible(focus)) {
                focus.scrollIntoView(false);
              }
            } else if (!this.inEditMode) {
              this.clearSuggestionList();
              this.stopNavOnSuggestionList();
              NavigationMap.setFocus(index + 1);
              NavigationMap.scrollToElement(NavigationMap.getCurrentItem(),
                { key: 'ArrowDown' });
            }
          } else {
            this.suggestionsList.children[0].classList.add('selected');
            this.switchSKtoSuggetion();
          }
          break;
        case 'ArrowUp':
          evt.preventDefault();
          evt.stopPropagation();
          if (selected) {
            selected.classList.remove('selected');
            if (selected.previousElementSibling) {
              selected.previousElementSibling.classList.add('selected');
              let focus = this.suggestionsList.querySelector('.selected');
              if (!this.isSuggestionVisible(focus)) {
                focus.scrollIntoView(false);
              }
            } else {
              if (this.inEditMode) {
                this.changeFocus(true, 'edit-mode');
              } else {
                NavigationMap.setFocus(index);
              }
              NavigationMap.scrollToElement(NavigationMap.getCurrentItem(),
                { key: 'ArrowUp' });
              this.setSoftkey();
            }
          }
          break;
      }
    },

    isSuggestionVisible: function(bestElementToFocus) {
      if (bestElementToFocus.offsetWidth === 0 ||
          bestElementToFocus.offsetHeight === 0) {
        return false;
      }

      let rects = bestElementToFocus.getClientRects();
      let softkeyHeight = document.getElementById('softkeyPanel').clientHeight;
      let topTarget;
      let inView = false;

      if (this.addWhich === 'to') {
        topTarget = this.cmp_to.clientHeight + softkeyHeight ;
      } else if (this.addWhich === 'cc') {
        topTarget = this.cmp_cc.clientHeight + softkeyHeight;
      } else if (this.addWhich === 'bcc') {
        topTarget = this.cmp_bcc.clientHeight + softkeyHeight;
      }
      let bottomTarget = topTarget + this.suggestionsContainer.clientHeight;

      for (let i = 0; i < rects.length; i++) {
        let r = rects[i];
        if ((r.bottom > 0 && r.bottom <= bottomTarget) &&
            (r.top >= topTarget)) {
          inView = true;
        }
        if (inView) {
          return true;
        }
      }
      return false;
    },

    onAddressFocus: function(evt) {
      evt.target.setSelectionRange(9999, 9999);
      this.searchContacts(evt);
    },

    /**
     * Handle bubble creation while keyboard comma input.
     */
    onAddressInput: function(evt) {
      this.searchContacts(evt);

      if (evt.isComposing) {
        return;
      }

      let node = evt.target;
      let makeBubble = false;
      // When do we want to tie off this e-mail address, put it into a bubble
      // and clear the input box so the user can type another address?
      switch (node.value.slice(-1)) {
        // If they hit space and we believe they've already typed an email
        // address!  (Space is okay in a display name or to delimit a display
        // name from the e-mail address)
        //
        // We use the presence of an '@' character as indicating that the e-mail
        // address
        case ' ':
        // We started out supporting comma, but now it's not on our keyboard at
        // all in type=email mode!  We aren't terribly concerned about it not
        // being usable in display names, although we really should check for
        // quoting...
        case ',':
        // Semicolon is on the keyboard, and we also don't care about it not
        // being usable in display names.
        case ';':
          makeBubble = true;
          break;
      }
      if (makeBubble) {
        if (!this.isValidAddress(node.value)) {
          let val = node.value;
          let dialogConfig = {
            title: {
              id: 'compose-invalid-addresses-title',
              args: {}
            },
            body: {
              id: 'compose-invalid-addresses-description',
              args: {}
            },
            accept: {
              l10nId: 'confirm-dialog-ok',
              priority: 2,
              callback: () => {
                let index = NavigationMap.getCurrentControl().index;
                NavigationMap.setFocus(index);
                if (this.inEditMode) {
                  node.classList.remove('cmp-edit-text');
                  this.inEditMode = false;
                  document.querySelector('.edit-mode.cmp-envelope-line')
                    .classList.remove('edit-mode');
                }
              }
            }
          };
          node.value = val.substr(0, val.length - 1);
          evt.preventDefault();
          evt.stopPropagation();
          NavigationMap.showConfigDialog(dialogConfig);
        } else {
          let mailbox = model.api.parseMailbox(node.value);
          this.insertBubble(node, mailbox.name, mailbox.address);
          node.value = '';
        }
      }
      // XXX: Workaround to get the length of the string. Here we create a dummy
      //      div for computing actual string size for changing input
      //      size dynamically.
      if (!this.stringContainer) {
        this.stringContainer = document.createElement('div');
        this.appendChild(this.stringContainer);

        let inputStyle = window.getComputedStyle(node);
        this.stringContainer.style.fontSize = inputStyle.fontSize;
      }
      this.stringContainer.style.display = 'inline-block';
      this.stringContainer.style.visibility = 'hidden';
      this.stringContainer.textContent = node.value;
      node.style.width = (this.stringContainer.clientWidth + 2) + 'px';

      this.validateAddresses();
    },

    onContainerKeydown: function(evt) {
      let target = evt.target;
      if (target.classList.contains('cmp-peep-bubble')) {
        switch (evt.key) {
          case 'Enter':
            evt.preventDefault();
            evt.stopPropagation();
            this.editBubble(target);
            break;
          case 'Backspace':
            evt.preventDefault();
            evt.stopPropagation();
            this.deleteBubble(target);
            NavigationMap.navSetup(this.localName, '.focusable', null,
                                   (seriesElement) => {
              let elements = Array.prototype.slice.call
                             (NavigationMap.getCurrentControl().elements);
              NavigationMap.setFocus(elements.indexOf(seriesElement));
            });
            break;
          case 'ArrowUp':
            if (target.style.getPropertyValue('--nav-up') < 0) {
              break;
            }
          case 'ArrowDown':
            let container = target.parentNode;
            let input = container.querySelector('.cmp-addr-text');
            input.classList.add('collapsed');
            break;
        }
      } else {
        if (!this.inEditMode && target.value.length > 0 &&
            (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight')) {
          evt.stopPropagation();
        }
      }
    },

    /**
     * Helper to show the appropriate error when we refuse to add attachments.
     */
    _warnAttachmentSizeExceeded: function(numAttachments) {
      let title = 'composer-attachment-large-title';
      let contentId;

      if (numAttachments > 1) {
        // Note! attachments with an "s" versus the case below.
        contentId = 'compose-attchments-size-exceeded';
      } else {
        contentId = 'compose-attchment-size-exceeded';
      }
      document.activeElement.blur();
      let dialogConfig = {
        title: {
          id: title,
          args: {}
        },
        body: {
          id: contentId,
          args: {}
        },
        accept: {
          l10nId:'confirm-dialog-ok',
          priority:2,
          callback: () => {
            let index = NavigationMap.getCurrentControl().index;
            NavigationMap.setFocus(index);
          }
        }
      };
      NavigationMap.showConfigDialog(dialogConfig);
    },

    /**
     * Used to count when attachment has been fully processed by this.composer.
     * Broken out as a separate member method to avoid inline closures in
     * addAttachmentsSubjectToSizeLimits that may lead to holding on to too much
     * memory.
     */
    _onAttachmentDone: function() {
      this._totalAttachmentsDone += 1;
      if (this._totalAttachmentsDone < this._totalAttachmentsFinishing) {
        return;
      }

      // Give a bit of time for all the DB transactions to clean up.
      // Unfortunately there are no good signals to do this decisively so just
      // adding a bit of a buffer, just to be nice for super low memory
      // devices. Not a catastrophe if work is still going on when the timeout
      // fires.
      setTimeout(() => {
        let wantAttachment = this._wantAttachment;
        this._totalAttachmentsFinishing = 0;
        this._totalAttachmentsDone = 0;
        this._wantAttachment = false;

        // Close out the toaster if it was showing. While the toaster could
        // be showing for some other reason, this is the most likely cause,
        // and want to give the user the impression of fast action.
        if (toaster.isShowing()) {
          toaster.hide();
        }

        // If the user wanted to add something else, proceed, since in many
        // cases, the user just had to wait a second or so before we could
        // proceed anyway.
        if (wantAttachment) {
          this.onAttachmentAdd();
        }
      }, 600);
    },

    /**
     * Given a list of Blobs/Files that we want to attach, attach as many as
     * possible and generate an error message for any we can't attach.  This
     * will update the UI as a side-effect; you do not need to do it.
     */
    addAttachmentsSubjectToSizeLimits: function(toAttach, replaceAttach) {
      // Tally the size of the already-attached attachments.
      let totalSize = this.calculateTotalAttachmentsSize();

      // Keep attaching until we find one that puts us over the limit.  Then
      // generate an error whose plurality is based on the number of attachments
      // we are not attaching.  We do not do any bin-packing smarts where we try
      // and see if any of the attachments in `toAttach` might fit.
      //
      // This specific behaviour is potentially a little odd; we're going with
      // consistency of the original implementation of bug 871852 but without
      // the horrible bug introduced by bug 871897 and being addressed by this
      // in bug 1006271.
      let attachedAny = false;
      let replaceSize = 0;
      while (toAttach.length) {
        let attachment = toAttach.shift();
        if (replaceAttach) {
          replaceSize = replaceAttach.blob.size;
        }
        totalSize += attachment.blob.size;
        if (totalSize >= (MAX_ATTACHMENT_SIZE + replaceSize)) {
          this._warnAttachmentSizeExceeded(1 + this.composer.attachments.length);
          break;
        }

        this._totalAttachmentsFinishing += 1;
        if (replaceAttach) {
          this.composer.replaceAttachment(replaceAttach, attachment,
                                          this._onAttachmentDone);
        } else {
          this.composer.addAttachment(attachment, this._onAttachmentDone);
        }
        attachedAny = true;
      }

      if (attachedAny) {
        this.renderAttachments();
      }
    },

    setForwardAttachments: function() {
      let attachments = this.forwardAttachments;
      let index = 0;
      let attachmentsToAdd = [];
      let addError = false;
      let setAttachments = (attachment) => {
        this.getAttachmentBlob(attachment).then((blob) => {
          if (blob) {
            attachmentsToAdd.push({
              name: attachments[index].filename,
              blob: blob
            });
          }
          index += 1;
          loadAttachments();
        }).catch((error) => {
          if ('NotFoundError' === error) {
            attachment.resetDownloadState();
            attachment.download(() => {
              setAttachments(attachment);
            }, null, false);
          } else {
            addError = true;
            index += 1;
            loadAttachments();
          }
        });
      };

      let loadAttachments = () => {
        if (index < attachments.length) {
          let attachment = attachments[index];
          if (!attachment.isDownloaded || !attachment._file) {
            // TODO, we can not get the VOLTE and VOWIFI situation, so there is missing situation,
            // maybe should use datacallmanager and wifimanager to handle it later,
            // but we need a common function to replace all onLine property.
            if (navigator.connection.type === 'none') {
              addError = true;
              index += 1;
              loadAttachments();
              return;
            }

            attachment.download(() => {
              setAttachments(attachment);
            }, null, false);
          } else {
            setAttachments(attachment);
          }
        } else {
          let someAttachmentsLoaded = attachmentsToAdd.length > 0;
          this.loadingAttachments.classList.add('collapsed');
          this.addAttachmentsSubjectToSizeLimits(attachmentsToAdd);
          if (addError) {
            this.showForwardAttention(attachments.length, someAttachmentsLoaded);
          }
          this.validateAddresses();
        }
      };

      if (this.attachFilesSize > MAX_ATTACHMENT_SIZE) {
        this._warnAttachmentSizeExceeded(attachments.length);
        return;
      }

      let storage = navigator.getDeviceStorage('sdcard');
      storage.available().onsuccess = (e) => {
        if (e.target.result === 'available') {
          storage.freeSpace().onsuccess = (e) => {
            if (e.target.result < this.unDownloadFilesSize) {
              this.showForwardAttention(attachments.length);
            } else {
              if (attachments.length > 1) {
                this.loadingAttachmentsInfo.setAttribute('data-l10n-id',
                    'compose-attachments-loading');
              }
              this.loadingAttachments.classList.remove('collapsed');
              loadAttachments();
            }
          }
        }
      }
    },

    showForwardAttention: function(numAttachments, bPartLoaded = false) {
      let bodyId = numAttachments > 1 ?
                   'compose-forward-attachments-unable-load' :
                   'compose-forward-attachment-unable-load';
      let title = 'compose-forward-attachment-error-title';
      if (bPartLoaded) {
        bodyId = 'compose-forward-attachment-load-error';
        title = 'compose-forward-attachment-error-title2';
      }
      let dialogConfig = {
        title: {
          id: title,
          args: {}
        },
        body: {
          id: bodyId,
          args: {}
        },
        accept: {
          l10nId: 'confirm-dialog-ok',
          priority: 2,
        }
      };
      NavigationMap.showConfigDialog(dialogConfig);
    },

    getAttachmentBlob: function(attachment) {
      return new Promise(function(resolve, reject) {
        let storageType = attachment._file[0];
        let filename = attachment._file[1];
        let storage = navigator.getDeviceStorage(storageType);
        let getReq = storage.get(filename);

        getReq.onerror = () => {
          reject(getReq.error.name);
        };
        getReq.onsuccess = () => {
          let blob = getReq.result;
          resolve(blob);
        };
      });
    },

    /**
     * Build the UI that displays the current attachments.  Invokes
     * `updateAttachmentsSize` too so you don't have to.
     */
    renderAttachments: function() {
      if (this.composer.attachments && this.composer.attachments.length) {
        // Clean the container before we insert the new attachments
        this.attachmentsContainer.innerHTML = '';
        this.attachmentsName.innerHTML = '';

        let attTemplate = cmpAttachmentItemNode,
            filenameTemplate =
              attTemplate.getElementsByClassName('cmp-attachment-filename')[0],
            filesizeTemplate =
              attTemplate.getElementsByClassName('cmp-attachment-filesize')[0];

        for (let i = 0; i < this.composer.attachments.length; i++) {
          let attachment = this.composer.attachments[i];

          filenameTemplate.textContent = attachment.name;
          fileDisplay.fileSize(filesizeTemplate, attachment.blob.size);
          let attachmentNode = attTemplate.cloneNode(true);
          this.attachmentsContainer.appendChild(attachmentNode);
          this.attachmentsName.innerHTML += attachment.name + ' ';

          let mimeClass = mimeToClass(attachment.blob.type);
          attachmentNode.classList.add(mimeClass);
          let attachementIcon =
              attachmentNode.querySelector('.cmp-attachment-icon');
          let attachementDataIcon = '';
          switch (mimeClass) {
            case 'mime-audio':
              attachementDataIcon = 'file-audio';
              break;
            case 'mime-video':
              attachementDataIcon = 'file-video';
              break;
            case 'mime-image':
              attachementDataIcon = 'file-photo';
              break;
            case 'mime-zip':
              attachementDataIcon = 'file-compress';
              break;
            default:
              attachementDataIcon = 'file';
              break;
          }
          attachementIcon.setAttribute('data-icon', attachementDataIcon);
        }

        this.updateAttachmentsSize();
      }
      new Promise((resolve) => {
        if (this.type !== 'reply') {
          let index = NavigationMap.getCurrentControl().index;
          NavigationMap.setFocus(index);
        }
        resolve();
      }).then(() => {
        window.dispatchEvent(new CustomEvent('cmp-attachments-update', {
          detail: { composer: this },
          bubbles: true,
          cancelable: false
        }));
      });
    },

    /**
     * Calculate the total size of all attachments included.
     */
    calculateTotalAttachmentsSize: function() {
      let totalSize = 0;
      for (let i = 0; i < this.composer.attachments.length; i++) {
        totalSize += this.composer.attachments[i].blob.size;
      }
      return totalSize;
    },

    /**
     * Update the summary that says how many attachments we have and the
     * aggregate attachment size.
     */
    updateAttachmentsSize: function() {
      mozL10n.setAttributes(this.attachmentLabel, 'compose-attachments',
                            { n: this.composer.attachments.length });

      if (this.composer.attachments.length === 0) {
        this.attachmentsSize.textContent = '';
      } else {
        fileDisplay.fileSize(this.attachmentsSize,
          this.calculateTotalAttachmentsSize());
      }

      let needFocus = false;
      if (this.composer.attachments.length >= 1) {
        this.attachmentTotal.classList.remove('collapsed');
        this.attachmentTotal.classList.add('focusable');
        needFocus = true;
      } else {
        this.attachmentTotal.classList.add('collapsed');
        this.attachmentTotal.classList.remove('focusable');
      }
      NavigationMap.navSetup(this.localName, '.focusable');
      if (needFocus) {
        let elements = Array.prototype.slice.call
                       (NavigationMap.getCurrentControl().elements);
        NavigationMap.setFocus(elements.indexOf(this.attachmentTotal));
      }
    },

    onClickRemoveAttachment: function(attachIndex) {
      let node = this.attachmentsContainer.querySelector
                 ('[data-attachindex="' + attachIndex +'"]');
      node.parentNode.removeChild(node);
      let attachment = this.composer.attachments[attachIndex];
      this.composer.removeAttachment(attachment);
      toaster.toast({
        text: mozL10n.get('cmp-remove-attach')
      });

      new Promise((resolve) => {
        if (this.composer.attachments && this.composer.attachments.length) {
          let tempName = '';
          for (let i = 0; i < this.composer.attachments.length; i++) {
            let attachment = this.composer.attachments[i];
            tempName += attachment.name + ' ';
          }
          this.attachmentsName.innerHTML = tempName;
        }
        this.updateAttachmentsSize();
        resolve();
      }).then(() => {
        window.dispatchEvent(new CustomEvent('cmp-attachments-update', {
          detail: { composer: this },
          bubbles: true,
          cancelable: false
        }));
      });
    },

    /**
     * Save the draft if there's anything to it, close the card.
     */
    goBack: function() {
      this._closeCard();
      if (this.activity) {
        // We need more testing here to make sure the behavior that back
        // to originated activity works perfectly without any crash or
        // unable to switch back.
        this.activity.postError('cancelled');
        this.activity = null;
        cards._backgroundUpdate = true;
      }
    },

    onBack: function(callback) {
      if (!this._saveNeeded()) {
        console.log('compose: back: no save needed, exiting without prompt');
        if (callback) {
          callback();
        } else {
          this.goBack();
        }
        return;
      }

      if (!NavigationMap.configDialogShown()) {
        let dialogConfig = {
          title: {
            id: 'confirm-dialog-title',
            args: {}
          },
          body: {
            id: 'compose-draft-save',
            args: {}
          },
          cancel: {
            l10nId: 'compose-draft-dialog-cancel',
            priority: 1,
            callback: () => {
              NavigationMap.restoreFocus();
              cards._endKeyClicked = false;
            }
          },
          accept: {
            l10nId: 'compose-draft-dialog-save',
            priority: 2,
            callback: () => {
              this._saveDraft('explicit');
              NavigationMap.restoreFocus();
              cards._endKeyClicked = false;
              if (callback) {
                toaster.toast({
                  text: mozL10n.get('composer-draft-saved')
                });
                callback();
              } else {
                this.goBack();
                toaster.toast({
                  text: mozL10n.get('composer-draft-saved')
                });
              }
            }
          },
          confirm: {
            l10nId: 'compose-discard-confirm',
            priority: 3,
            callback: () => {
              this.composer.abortCompositionDeleteDraft();
              NavigationMap.restoreFocus();
              cards._endKeyClicked = false;
              if (callback) {
                callback();
              } else {
                this.goBack();
              }
            }
          }
        };
        NavigationMap.showConfigDialog(dialogConfig);
      }
    },

    /**
     * Validate that the provided addresses are valid. Enable the send
     * button conditional on all addresses being correct. If all
     * addresses are correct and we had previously displayed a
     * sendStatus error, hide the sendStatus error display.
     *
     * @return {Boolean}
     *   True if all addresses are valid, otherwise false.
     */
    validateAddresses: function() {
      let addrs = this.extractAddresses();

      if (addrs.all.length === 0 ||
          !this.loadingAttachments.classList.contains('collapsed')) {
        this.needSendKey = false;
      } else {
        this.needSendKey = !(addrs.all.length === addrs.invalid.length);
      }
      // when first time enter the composer page, none softkeybar instance
      // has been created
      if (!this.doActive) {
        this.setSoftkey();
      }

      if (addrs.invalid.length === 0) {
        // If the error message is visible, meaning they opened this
        // message from the outbox after a send failure, remove the error
        // when they've corrected the recipients.
        this.errorMessage.classList.add('collapsed');
        return true; // No invalid addresses.
      } else {
        return false; // Some addresses were invalid.
      }
    },

    /**
     * If the user attempts to tap the send button while there are
     * invalid addresses, display a dialog to warn them to correct the
     * error. Otherwise, go ahead and send the message.
     */
    onSend: function() {
      if (!this.validateAddresses()) {
        document.activeElement.blur();
        let dialogConfig = {
          title: {
            id: 'compose-invalid-addresses-title',
            args: {}
          },
          body: {
            id: 'compose-invalid-addresses-description',
            args: {}
          },
          accept: {
            l10nId: 'confirm-dialog-ok',
            priority: 2,
            callback: () => {
              let index = NavigationMap.getCurrentControl().index;
              NavigationMap.setFocus(index);
            }
          }
        };
        NavigationMap.showConfigDialog(dialogConfig);
      } else {
        this.reallySend();
      }
    },

    /**
     * Actually send the message, foregoing any validation that the
     * addresses are valid (as we did in `onSend` above).
     */
    reallySend: function() {
      /* Check if already lock is enabled,
       * If so disable it and then re enable the lock
       */
      this._saveStateToComposer();

      let activity = this.activity;

      // Indicate we are sending so we can suppress any of our auto-save logic
      // from trying to fire.
      this.sending = true;

      // Initiate the send.
      console.log('compose: initiating send');
      evt.emit('uiDataOperationStart', this._dataIdSendEmail);

      this.composer.finishCompositionSendMessage(() => {
        evt.emit('uiDataOperationStop', this._dataIdSendEmail);

        // Card could have been destroyed in the meantime,
        // via an app card reset (not a _selfClosed case),
        // so do not bother with the rest of this work if
        // that was the case.
        if (!this.composer) {
          return;
        }

        if (activity) {
          // Just mention the action completed, but do not give
          // specifics, to maintain some privacy.
          activity.postResult('complete');
          activity = null;
          cards._backgroundUpdate = true;
        }

        this._closeCard();

      });
    },

    onccAdd: function() {
      this.cmp_cc.classList.remove('collapsed');
      this.cmp_cc.classList.add('focusable');
      NavigationMap.navSetup(this.localName, '.focusable');
      this.needRefresh = true;
      this.focusTo = this.cmp_cc;
      this.cmp_cc.scrollIntoView(true);
    },

    onccRemove: function() {
      let ccList = this.cmp_cc.querySelectorAll('.cmp-peep-bubble');
      this.clearContacts(ccList);
      this.cmp_cc.classList.add('collapsed');
      this.cmp_cc.classList.remove('focusable');
      NavigationMap.navSetup(this.localName, '.focusable');
      this.needRefresh = true;
      toaster.toast({
        text: mozL10n.get('compose-cc-remove')
      });
    },

    onbccAdd: function() {
      this.cmp_bcc.classList.remove('collapsed');
      this.cmp_bcc.classList.add('focusable');
      NavigationMap.navSetup(this.localName, '.focusable');
      this.needRefresh = true;
      this.focusTo = this.cmp_bcc;
      this.cmp_bcc.scrollIntoView(true);
    },

    onbccRemove: function() {
      let bccList = this.cmp_bcc.querySelectorAll('.cmp-peep-bubble');
      this.clearContacts(bccList);
      this.cmp_bcc.classList.add('collapsed');
      this.cmp_bcc.classList.remove('focusable');
      NavigationMap.navSetup(this.localName, '.focusable');
      this.needRefresh = true;
      toaster.toast({
        text: mozL10n.get('compose-bcc-remove')
      });
    },

    refresh: function() {
      if (this.needRefresh) {
        this.updateSoftkey();
        this.needRefresh = false;
      }
      if (this.focusTo) {
        let elements = NavigationMap.getCurrentControl().elements;
        elements = Array.prototype.slice.call(elements);
        NavigationMap.setFocus(elements.indexOf(this.focusTo));
        this.focusTo = null;
      }
    },

    clearContacts: function(nodes) {
      let length = nodes.length;
      for (let i = 0; i < length; i++) {
        this.deleteBubble(nodes[i]);
      }
    },

    goAttachmentsList: function() {
      if (this.addATTActivity &&
          this.addATTActivity.readyState === 'pending') {
        return;
      }
      console.log('go to attachments list');
      cards.pushCard('cmp-attachments', 'animate', {
        composer: this
      });
    },

    onContactAdd: function() {
      if (this._selfClosed) {
        return;
      }
      let contactBtn = NavigationMap.getCurrentItem();

      try {
        let activity = new MozActivity({
          name: 'pick',
          data: {
            type: 'webcontacts/email'
          }
        });
        activity.onsuccess = () => {
          if (activity.result && activity.result.email) {
            let emt = contactBtn.querySelector('.cmp-addr-text');
            let name = activity.result.name;
            if (Array.isArray(name)) {
              name = name[0];
            }
            this.insertBubble(emt, name, activity.result.email);
          }
        };
        activity.onerror = () => {
          console.log('Activities error');
          setTimeout(() => {
            NavigationMap.setFocus('restore');
          }, 300);
        }
      } catch (e) {
        console.log('WebActivities unavailable? : ' + e);
      }
    },

    onAttachmentAdd: function(event) {
      if (event) {
        event.stopPropagation();
      }

      // To be nice on memory consumption, wait for any previous attachment to
      // finish attaching before triggering another attachment action.
      if (this._totalAttachmentsFinishing > 0) {
        // Use a separate flag than testing if the toaster is showing, in case
        // the toaster is shown for some other reason. In that case, do not want
        // to trigger activity after previous attachment completes.
        this._wantAttachment = true;
        toaster.toast({
          text: mozL10n.get('compose-attachment-still-working')
        });
        return;
      }

      try {
        console.log('compose: attach: triggering web activity');
        let activity = new MozActivity({
          name: 'pick',
          data: {
            type: ['image/*', 'video/*', 'audio/*', 'application/*',
                   'text/vcard'],
            nocrop: true
          }
        });
        activity.onsuccess = () => {
          // Load the util on demand, since one small codepath needs it, and
          // it avoids needing to bundle util's dependencies in a built layer.
          require(['attachment_name'], (attachmentName) => {
            if (!activity.result.blob) {
              NavigationMap.setFocus('restore');
              return;
            }
            let blob = activity.result.blob,
                name = activity.result.blob.name || activity.result.name,
                count = this.composer.attachments.length + 1;

            name = attachmentName.ensureName(blob, name, count);
            let filename = name.substring(name.lastIndexOf('/') + 1);

            this.addAttachmentsSubjectToSizeLimits([{
              name: filename,
              pathName: name,
              blob: blob
            }]);
          });
        };
        activity.onerror = () => {
          NavigationMap.setFocus('restore');
        };

        this.addATTActivity = activity;
      } catch (e) {
        console.log('WebActivities unavailable? : ' + e);
      }
    },

    onAttachmentReplace: function() {
      let replacedIndex = document.querySelector('.hasfocused').
                          getAttribute('data-attachIndex');
      if (!replacedIndex) {
        console.log('Error index of attachment');
        return;
      }
      let replaceAttach = this.composer.attachments[replacedIndex];
      // To be nice on memory consumption, wait for any previous attachment to
      // finish attaching before triggering another attachment action.
      if (this._totalAttachmentsFinishing > 0) {
        // Use a separate flag than testing if the toaster is showing, in case
        // the toaster is shown for some other reason. In that case, do not want
        // to trigger activity after previous attachment completes.
        this._wantAttachment = true;
        toaster.toast({
          text: mozL10n.get('compose-attachment-still-working')
        });
        return;
      }

      try {
        let activity = new MozActivity({
          name: 'pick',
          data: {
            type: ['image/*', 'video/*', 'audio/*', 'application/*',
                   'text/vcard'],
            nocrop: true
          }
        });
        activity.onsuccess = () => {
          // Load the util on demand, since one small codepath needs it, and
          // it avoids needing to bundle util's dependencies in a built layer.
          require(['attachment_name'], (attachmentName) => {
            if (!activity.result.blob) {
              NavigationMap.setFocus('restore');
              return;
            }
            let blob = activity.result.blob,
                name = activity.result.blob.name || activity.result.name,
                count = this.composer.attachments.length + 1;

            name = attachmentName.ensureName(blob, name, count);

            console.log('compose: attach activity success:', name);

            name = name.substring(name.lastIndexOf('/') + 1);

            this.addAttachmentsSubjectToSizeLimits([{
              name: name,
              blob: blob
            }], replaceAttach);
          });
        };
        activity.onerror = () => {
          NavigationMap.setFocus('restore');
        };

        this.addATTActivity = activity;
      } catch (e) {
        console.log('WebActivities unavailable? : ' + e);
      }
    },

    onHidden: function() {
      window.removeEventListener('keydown', this.keydownHandler);
      window.removeEventListener('email-endkey', this.endkeyHandler);
    },

    die: function() {
      // If confirming for prompt when destroyed, just remove
      // and if save is needed, it will be autosaved below.
      if (this._savePromptMenu) {
        document.body.removeChild(this._savePromptMenu);
        this._savePromptMenu = null;
      }

      // If something else besides the card causes this card
      // to die, but we have a draft to save, do it now.
      // However, wait for the draft save to complete before
      // completely shutting down the composer.
      if (!this._selfClosed && this._saveNeeded()) {
        console.log('compose: autosaving draft because not self-closed');
        this._saveDraft('automatic');
      }

      if (this.composer) {
        this.composer.die();
        this.composer = null;
      }
      window.removeEventListener('menuEvent', this.menuHandler);
      window.removeEventListener('keydown', this.keydownHandler);
      window.removeEventListener('email-endkey', this.endkeyHandler);
      this.htmlBodyContainer.removeEventListener('keydown', this.handBodyContainerKeydown);
      this.htmlBodyContainer.querySelectorAll('.cmp-body-html iframe').forEach(
        (node) => {
          node.contentWindow.document.write('');
          node.contentWindow.document.clear();
          node.contentWindow.close();
          node.parentNode.removeChild(node);
        }
      );
    },

    searchContacts: function(evt) {
      let target = evt.target;
      let typed = evt.target.value;

      if (typed) {
        Contacts.findContactByString(typed, target,
          this.renderSuggestions.bind(this));
      } else {
        this.clearSuggestionList();
        this.stopNavOnSuggestionList();
        this.setSoftkey();
      }
    },

    renderSuggestions: function(contacts, inputValue, insertNode) {
      this.addedBubble = false;
      if (contacts.length === 0) {
        this.clearSuggestionList();
        this.stopNavOnSuggestionList();
        return;
      }

      if (document.activeElement !== insertNode) {
        return;
      }

      let itemIndex = 0;
      let pHeight = insertNode.parentNode.parentNode.parentNode.clientHeight;
      let suggestionsListHeight = this.scrollContainer.clientHeight - pHeight;
      this.suggestionsList.innerHTML = '';

      let top;
      if (this.cmp_to.classList.contains('focus') ||
        this.cmp_to.querySelector('.cmp-to-text').classList.contains('cmp-edit-text')) {
        top = this.cmp_to.clientHeight;
        this.addWhich = 'to';
      } else if (this.cmp_cc.classList.contains('focus') ||
        this.cmp_cc.querySelector('.cmp-cc-text').classList.contains('cmp-edit-text')) {
        top = this.cmp_to.clientHeight + this.cmp_cc.clientHeight;
        this.addWhich = 'cc';
      } else if (this.cmp_bcc.classList.contains('focus') ||
        this.cmp_bcc.querySelector('.cmp-bcc-text').classList.contains('cmp-edit-text')) {
        top = this.cmp_to.clientHeight + this.cmp_cc.clientHeight + this.cmp_bcc.clientHeight;
        this.addWhich = 'bcc';
      }
      this.suggestionsContainer.style.setProperty('top', top + 'px');
      this.suggestionsContainer.classList.add('show');

      this.suggestionList = true;

      contacts.forEach((contact) => {
        let name = contact.name[0];
        let emails = contact.email;
        if (!emails || emails.length === 0) {
          return true;
        }
        emails.forEach((item) => {
          let ismatch = this.isMatch(inputValue.terms, name, item.value);
          if (ismatch) {
            itemIndex++;
            let node = suggestionItem.cloneNode(true);
            node.innerHTML =
              node.innerHTML.replace(new RegExp('{{name}}', 'gm'), name)
                    .replace(new RegExp('{{type}}', 'gm'), item.type[0])
                    .replace(new RegExp('{{email}}', 'gm'), item.value);
            this.highlightMatch(inputValue.terms, node);
            this.suggestionsList.appendChild(node);
            node.addEventListener('click', () => {
              this.clearSuggestionList();
              this.insertBubble(insertNode, name, item.value,
                  (needFocus) => {
                this.addedBubble = true;
                insertNode.value = '';
                if (needFocus) {
                  let index = NavigationMap.getCurrentControl().index;
                  NavigationMap.setFocus(index);
                }
              });
            });
          }
        });
      });

      let suggestItem = this.suggestionsList.querySelector('.suggestion-item');
      let liHeight = suggestItem && suggestItem.clientHeight || suggestionsListHeight;
      suggestionsListHeight = suggestionsListHeight < liHeight ? liHeight : suggestionsListHeight;
      this.suggestionsContainer.style.setProperty('max-height',
        suggestionsListHeight + 'px');

      if (this.suggestionsList.children.length === 0) {
        this.clearSuggestionList();
        this.stopNavOnSuggestionList();
        return;
      }

      this.suggestionsContainer.scrollTop = 0;
      if (insertNode.classList.contains('cmp-cc-text')) {
        this.cmp_cc.scrollIntoView(true);
        top = this.cmp_cc.clientHeight;
      } else if (insertNode.classList.contains('cmp-bcc-text')) {
        this.cmp_bcc.scrollIntoView(true);
        top = this.cmp_bcc.clientHeight;
      }
      if (!this.suggestionListNavListener) {
        this.startNavOnSuggestionList();
      }

      if ((top + liHeight) >= this.scrollContainer.clientHeight) {
        this.suggestionsContainer.scrollIntoView(false);
      }
    },

    highlightMatch: function(text, node) {
      let name = node.querySelector('.ellipsis-dir-fix');
      let email = node.querySelector('.email-detail');

      let input = text.join(' ');
      let reg = new RegExp(input, 'mi');

      if (reg.test(name.innerHTML)) {
        name.innerHTML = name.innerHTML.split(input)
            .join('<span>' + input + '</span>');
      }
      if (reg.test(email.innerHTML)) {
        email.innerHTML = email.innerHTML.split(input)
            .join('<span>' + input + '</span>');
      }
    },

    clearSuggestionList: function(node) {
      if (node) {
        let evt = new CustomEvent('backspace-long-press');
        window.dispatchEvent(evt);
      }
      this.suggestionsContainer.classList.remove('show');
      this.suggestionsList.innerHTML = '';
      this.suggestionList = false;
      if (node && !this._selfClosed) {
        this.searchContacts({ target: node });
      }
    },

    isMatch: function(inputValue, name, email)  {
      let input = inputValue.join(' ');
      let reg = new RegExp(input, 'mi');
      return reg.test(name) || reg.test(email);
    },

    hideDialog: function() {
      CustomDialog.hide();
    },

    onBodyNodeKeydown: function(evt) {
      let range = window.getSelection().getRangeAt(0);
      let currentElement = range.startContainer;
      switch (evt.key) {
        case 'ArrowUp':
          if ((currentElement === document.activeElement ||
              currentElement === document.activeElement.firstChild)
              && range.startOffset === 0) {
            break;
          }
          evt.stopPropagation();
          break;
        case 'ArrowDown':
          if ((currentElement === document.activeElement && isLastLine(range))
              || isLastNode(range)) {
            break;
          }
          evt.stopPropagation();
          break;
      }

      function isLastLine(range) {
        if (document.activeElement.lastChild.tagName === 'BR' &&
            range.startOffset === (document.activeElement.childNodes.length - 1)
        ) {
          return true;
        } else if (range.startOffset ===
            document.activeElement.childNodes.length) {
          return true;
        }
        return false;
      }

      function isLastNode(range) {
        return range.startOffset === range.startContainer.length;
      }
    }
  }
];

});
