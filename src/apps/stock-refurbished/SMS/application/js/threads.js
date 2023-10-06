/*global Drafts */

(function(exports) {
  'use strict';

  let threads = new Map();

  function Thread(thread) {
    let length = Thread.FIELDS.length;
    let key;

    for (let i = 0; i < length; i++) {
      key = Thread.FIELDS[i];
      if (key === 'participants') {
        thread[key][0] = thread[key][0].replace('group', '');
      }
      this[key] = thread[key];
    }

    this.messages = [];
  }

  Thread.FIELDS = [
    'body', 'id', 'lastMessageSubject', 'lastAttachmentStatus', 'lastMessageType',
    'participants', 'timestamp', 'unreadCount', 'isGroup', 'delivery'
  ];

  Thread.getMMSPreview = function(record) {
    if (record.delivery === 'not-downloaded') {
      return 'not-download';
    }

    if (record.attachments) {
      for (let i = 0; i < record.attachments.length; i++) {
        if (record.attachments[i].content &&
            record.attachments[i].content.type !== 'text/plain') {
          return 'has-attachment';
        }
      }
    }

    return 'mms';
  };

  Thread.fromMessage = function(record, options) {
    let participants = [];

    // Thread has draft, save draft
    if (typeof record.delivery !== 'undefined') {
      if (record.delivery === 'received' ||
          record.delivery === 'not-downloaded') {
        if (record.isGroup && record.type === 'mms') {
          for (let i = 0; i < record.receivers.length; i++) {
            participants.push(record.receivers[i]);
          }
          participants.unshift(record.sender);
        } else {
          participants = [record.sender];
        }
      } else {
        participants = record.receivers || [record.receiver];
      }
    }

    let attachmentPreview = Thread.getMMSPreview(record);

    return new Thread({
      id: record.threadId,
      participants: participants,
      body: record.body,
      timestamp: record.timestamp,
      unreadCount: (options && options.unread) ? 1 : 0,
      lastMessageType: record.type || 'sms',
      lastMessageSubject: record.subject || '',
      lastAttachmentStatus: attachmentPreview,
      isGroup: record.isGroup || false
    });
  };

  Thread.fromDraft = function(record, options) {
    let participants = record.recipients && record.recipients.length ?
      record.recipients : [''];

    let body = record.content && record.content.length ?
      record.content.find(function(content) {
        if (typeof content === 'string') {
          return true;
        }
      }) : '';

    return new Thread({
      id: record.threadId || record.id,
      participants: participants,
      body: body,
      timestamp: new Date(record.timestamp),
      unreadCount: (options && options.unread) ? 1 : 0,
      lastMessageType: record.type || 'sms',
      lastMessageSubject: record.subject || '',
      lastAttachmentStatus: record.attachment.length === 0 ? '' : 'has-attachment',
      isGroup: record.isGroup || false
    });
  };

  Thread.create = function(record, options) {
    if (record instanceof Thread) {
      return record;
    }
    return record.delivery ?
      Thread.fromMessage(record, options) :
      Thread.fromDraft(record, options);
  };

  Thread.prototype = {
    constructor: Thread,
    get drafts() {
      return Drafts.byThreadId(this.id);
    },
    get hasDrafts() {
      return !!this.drafts.length;
    }
  };

  let Threads = exports.Threads = {
    registerMessage: function(message) {
      let thread = Thread.create(message);
      let threadId = message.threadId;
      if (!this.has(threadId)) {
        this.set(threadId, thread);
      }
      this.get(threadId).messages.push(message);
    },
    set: function(id, thread) {
      let old, length, key;
      id = +id;
      if (threads.has(id)) {
        // Updates the reference
        old = threads.get(id);
        length = Thread.FIELDS.length;
        for (let i = 0; i < length; i++) {
          key = Thread.FIELDS[i];
          old[key] = thread[key];
        }

        return threads;
      }
      return threads.set(id, new Thread(thread));
    },
    get: function(id) {
      return threads.get(+id);
    },
    has: function(id) {
      return threads.has(+id);
    },
    delete: function(id) {
      id = +id;

      let thread = this.get(id);

      if (thread && thread.hasDrafts) {
        Drafts.delete({ threadId: id });
        Drafts.store();
      }
      return threads.delete(id);
    },
    clear: function() {
      threads = new Map();
    },
    forEach: function(callback) {
      threads.forEach(function(v, k) {
        callback(v, k);
      });
    },
    get size() {
      // support: gecko 18 - size might be a function
      if (typeof threads.size === 'function') {
        return +threads.size();
      }
      return +threads.size;
    },
    currentId: null,
    keyword: null,
    get active() {
      return threads.get(+Threads.currentId);
    }
  };

  exports.Thread = Thread;
}(this));
