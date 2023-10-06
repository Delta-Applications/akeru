
define(
  'activesync/folder',[
    'logic',
    '../date',
    '../syncbase',
    '../allback',
    '../db/mail_rep',
    'activesync/codepages/AirSync',
    'activesync/codepages/AirSyncBase',
    'activesync/codepages/ItemEstimate',
    'activesync/codepages/Email',
    'activesync/codepages/ItemOperations',
    'safe-base64',
    'mimetypes',
    'module',
    'require',
    'exports'
  ],
  function(
    logic,
    $date,
    $sync,
    allback,
    mailRep,
    $AirSync,
    $AirSyncBase,
    $ItemEstimate,
    $Email,
    $ItemOperations,
    safeBase64,
    mimetypes,
    $module,
    require,
    exports
  ) {


/**
 * The desired number of bytes to fetch when downloading bodies, but the body's
 * size exceeds the maximum requested size.
 */
var DESIRED_TEXT_SNIPPET_BYTES = 5120;

/**
 * This is minimum number of messages we'd like to get for a folder for a given
 * sync range. It's not exact, since we estimate from the number of messages in
 * the past two weeks, but it's close enough.
 */
var DESIRED_MESSAGE_COUNT = 50;

/**
 * Filter types are lazy initialized once the activesync code is loaded.
 */
var FILTER_TYPE, SYNC_RANGE_TO_FILTER_TYPE, FILTER_TYPE_TO_STRING;
function initFilterTypes() {
  FILTER_TYPE = $AirSync.Enums.FilterType;

  /**
   * Map our built-in sync range values to their corresponding ActiveSync
   * FilterType values. We exclude 3 and 6 months, since they aren't valid for
   * email.
   *
   * Also see SYNC_RANGE_ENUMS_TO_MS in `syncbase.js`.
   */
  SYNC_RANGE_TO_FILTER_TYPE = {
    'auto': null,
      '1d': FILTER_TYPE.OneDayBack,
      '3d': FILTER_TYPE.ThreeDaysBack,
      '1w': FILTER_TYPE.OneWeekBack,
      '2w': FILTER_TYPE.TwoWeeksBack,
      '1m': FILTER_TYPE.OneMonthBack,
     'all': FILTER_TYPE.NoFilter,
  };

  /**
   * This mapping is purely for logging purposes.
   */
  FILTER_TYPE_TO_STRING = {
    0: 'all messages',
    1: 'one day',
    2: 'three days',
    3: 'one week',
    4: 'two weeks',
    5: 'one month',
  };
}

var $wbxml, parseAddresses, $mailchew;

function lazyConnection(cbIndex, fn, failString) {
  return function lazyRun() {
    var args = Array.slice(arguments),
        errback = args[cbIndex],
        self = this;

    require(['wbxml', 'addressparser', '../mailchew'],
    function (wbxml, addressparser, mailchew) {
      if (!$wbxml) {
        $wbxml = wbxml;
        parseAddresses = addressparser.parse.bind(addressparser);
        $mailchew = mailchew;
        initFilterTypes();
      }

      self._account.withConnection(errback, function () {
        fn.apply(self, args);
      }, failString);
    });
  };
}


function ActiveSyncFolderConn(account, storage) {
  this._account = account;
  this._storage = storage;
  logic.defineScope(this, 'ActiveSyncFolderConn',
                    { folderId: storage.folderId,
                      accountId: account.id });

  this.folderMeta = storage.folderMeta;

  if (!this.syncKey)
    this.syncKey = '0';
}
ActiveSyncFolderConn.prototype = {
  get syncKey() {
    return this.folderMeta.syncKey;
  },

  set syncKey(value) {
    return this.folderMeta.syncKey = value;
  },

  get serverId() {
    return this.folderMeta.serverId;
  },

  /**
   * Get the filter type for this folder. The account-level syncRange property
   * takes precedence here, but if it's set to "auto", we'll look at the
   * filterType on a per-folder basis. The per-folder filterType may be
   * undefined, in which case, we will attempt to infer a good filter type
   * elsewhere (see _inferFilterType()).
   * ASSUMES that it is only called after lazy load of activesync code and
   * initFilterTypes() has been run.
   */
  get filterType() {
    var syncRange = this._account.accountDef.syncRange;
    if (SYNC_RANGE_TO_FILTER_TYPE.hasOwnProperty(syncRange)) {
      var accountFilterType = SYNC_RANGE_TO_FILTER_TYPE[syncRange];
      if (accountFilterType)
        return accountFilterType;
      else
        return this.folderMeta.filterType;
    }
    else {
      console.warn('Got an invalid syncRange (' + syncRange +
                   ') using three days back instead');
      return $AirSync.Enums.FilterType.ThreeDaysBack;
    }
  },

  /**
   * Get the initial sync key for the folder so we can start getting data. We
   * assume we have already negotiated a connection in the caller.
   *
   * @param {string} filterType The filter type for our synchronization
   * @param {function} callback A callback to be run when the operation finishes
   */
  _getSyncKey: lazyConnection(1, function asfc__getSyncKey(filterType,
                                                           callback) {
    var folderConn = this;
    var account = this._account;
    var as = $AirSync.Tags;

    var w = new $wbxml.Writer('1.3', 1, 'UTF-8');
    w.stag(as.Sync)
       .stag(as.Collections)
         .stag(as.Collection)

    if (account.conn.currentVersion.lt('12.1'))
          w.tag(as.Class, 'Email');

          w.tag(as.SyncKey, '0')
           .tag(as.CollectionId, this.serverId)
           .stag(as.Options)
             .tag(as.FilterType, filterType)
           .etag()
         .etag()
       .etag()
     .etag();

    account.conn.postCommand(w, function(aError, aResponse) {
      if (aError) {
        console.error(aError);
        account._reportErrorIfNecessary(aError);
        callback('unknown');
        return;
      }

      // Reset the SyncKey, just in case we don't see a sync key in the
      // response.
      folderConn.syncKey = '0';

      var e = new $wbxml.EventParser();
      e.addEventListener([as.Sync, as.Collections, as.Collection, as.SyncKey],
                         function(node) {
        folderConn.syncKey = node.children[0].textContent;
      });

      e.onerror = function() {}; // Ignore errors.
      e.run(aResponse);

      if (folderConn.syncKey === '0') {
        // We should never actually hit this, since it would mean that the
        // server is refusing to give us a sync key. On the off chance that we
        // do hit it, just bail.
        console.error('Unable to get sync key for folder');
        callback('unknown');
      }
      else {
        callback();
      }
    });
  }),

  /**
   * Get an estimate of the number of messages to be synced.  We assume we have
   * already negotiated a connection in the caller.
   *
   * @param {string} filterType The filter type for our estimate
   * @param {function} callback A callback to be run when the operation finishes
   */
  _getItemEstimate: lazyConnection(1, function asfc__getItemEstimate(filterType,
                                                                     callback) {
    var ie = $ItemEstimate.Tags;
    var as = $AirSync.Tags;

    var account = this._account;

    var w = new $wbxml.Writer('1.3', 1, 'UTF-8');
    w.stag(ie.GetItemEstimate)
       .stag(ie.Collections)
         .stag(ie.Collection);

    if (this._account.conn.currentVersion.gte('14.0')) {
          w.tag(as.SyncKey, this.syncKey)
           .tag(ie.CollectionId, this.serverId)
           .stag(as.Options)
             .tag(as.FilterType, filterType)
           .etag();
    } else if (this._account.conn.currentVersion.gte('12.0')) {
          w.tag(ie.CollectionId, this.serverId)
           .tag(as.FilterType, filterType)
           .tag(as.SyncKey, this.syncKey);
    }
    else {
          w.tag(ie.Class, 'Email')
           .tag(as.SyncKey, this.syncKey)
           .tag(ie.CollectionId, this.serverId)
           .tag(as.FilterType, filterType);
    }

        w.etag(ie.Collection)
       .etag(ie.Collections)
     .etag(ie.GetItemEstimate);

    account.conn.postCommand(w, function(aError, aResponse) {
      if (aError) {
        console.error(aError);
        account._reportErrorIfNecessary(aError);
        callback('unknown');
        return;
      }

      var e = new $wbxml.EventParser();
      var base = [ie.GetItemEstimate, ie.Response];

      var status, estimate;
      e.addEventListener(base.concat(ie.Status), function(node) {
        status = node.children[0].textContent;
      });
      e.addEventListener(base.concat(ie.Collection, ie.Estimate),
                         function(node) {
        estimate = parseInt(node.children[0].textContent, 10);
      });

      try {
        e.run(aResponse);
      }
      catch (ex) {
        console.error('Error parsing GetItemEstimate response', ex, '\n',
                      ex.stack);
        callback('unknown');
        return;
      }

      if (status !== $ItemEstimate.Enums.Status.Success) {
        console.error('Error getting item estimate:', status);
        callback('unknown');
      }
      else {
        callback(null, estimate);
      }
    });
  }),

  /**
   * Infer the filter type for this folder to get a sane number of messages.
   *
   * @param {function} callback A callback to be run when the operation
   *  finishes, taking two arguments: an error (if any), and the filter type we
   *  picked
   */
  _inferFilterType: lazyConnection(0, function asfc__inferFilterType(callback) {
    var folderConn = this;
    var Type = $AirSync.Enums.FilterType;

    var getEstimate = function(filterType, onSuccess) {
      folderConn._getSyncKey(filterType, function(error) {
        if (error) {
          callback('unknown');
          return;
        }

        folderConn._getItemEstimate(filterType, function(error, estimate) {
          if (error) {
            // If we couldn't get an estimate, just tell the main callback that
            // we want three days back.
            callback(null, Type.ThreeDaysBack);
            return;
          }

          onSuccess(estimate);
        });
      });
    };

    getEstimate(Type.TwoWeeksBack, function(estimate) {
      var messagesPerDay = estimate / 14; // Two weeks. Twoooo weeeeeeks.
      var filterType;

      if (estimate < 0)
        filterType = Type.ThreeDaysBack;
      else if (messagesPerDay >= DESIRED_MESSAGE_COUNT)
        filterType = Type.OneDayBack;
      else if (messagesPerDay * 3 >= DESIRED_MESSAGE_COUNT)
        filterType = Type.ThreeDaysBack;
      else if (messagesPerDay * 7 >= DESIRED_MESSAGE_COUNT)
        filterType = Type.OneWeekBack;
      else if (messagesPerDay * 14 >= DESIRED_MESSAGE_COUNT)
        filterType = Type.TwoWeeksBack;
      else if (messagesPerDay * 30 >= DESIRED_MESSAGE_COUNT)
        filterType = Type.OneMonthBack;
      else {
        getEstimate(Type.NoFilter, function(estimate) {
          var filterType;
          if (estimate > DESIRED_MESSAGE_COUNT) {
            filterType = Type.OneMonthBack;
            // Reset the sync key since we're changing filter types. This avoids
            // a round-trip where we'd normally get a zero syncKey from the
            // server.
            folderConn.syncKey = '0';
          }
          else {
            filterType = Type.NoFilter;
          }
          logic(folderConn, 'inferFilterType', { filterType: filterType });
          callback(null, filterType);
        });
        return;
      }

      if (filterType !== Type.TwoWeeksBack) {
        // Reset the sync key since we're changing filter types. This avoids a
        // round-trip where we'd normally get a zero syncKey from the server.
        folderConn.syncKey = '0';
      }
      logic(folderConn, 'inferFilterType', { filterType: filterType });
      callback(null, filterType);
    });
  }),

  /**
   * Sync the folder with the server and enumerate all the changes since the
   * last sync.
   *
   * @param {function} callback A function to be called when the operation has
   *   completed, taking three arguments: |added|, |changed|, and |deleted|
   * @param {function} progress A function to be called as the operation
   *   progresses that takes a number in the range [0.0, 1.0] to express
   *   progress.
   */
  _enumerateFolderChanges: lazyConnection(0,
    function asfc__enumerateFolderChanges(callback, progress) {
    var folderConn = this, storage = this._storage;

    if (!this.filterType) {
      this._inferFilterType(function(error, filterType) {
        if (error) {
          callback('unknown');
          return;
        }
        console.log('We want a filter of', FILTER_TYPE_TO_STRING[filterType]);
        folderConn.folderMeta.filterType = filterType;
        folderConn._enumerateFolderChanges(callback, progress);
      });
      return;
    }
    if (this.syncKey === '0') {
      this._getSyncKey(this.filterType, function(error) {
        if (error) {
          callback('aborted');
          return;
        }
        folderConn._enumerateFolderChanges(callback, progress);
      });
      return;
    }

    var as = $AirSync.Tags;
    var asEnum = $AirSync.Enums;
    var asb = $AirSyncBase.Tags;
    var asbEnum = $AirSyncBase.Enums;

    var w;

    logic(this, 'exchange version: ', {
      version: this._account.conn.currentVersion
    });
    // If the last sync was ours and we got an empty response back, we can send
    // an empty request to repeat our request. This saves a little bandwidth.
    if (this._account._syncsInProgress++ === 0 &&
        this._account._lastSyncKey === this.syncKey &&
        this._account._lastSyncFilterType === this.filterType &&
        this._account._lastSyncResponseWasEmpty) {
      w = as.Sync;
    }
    else {
      w = new $wbxml.Writer('1.3', 1, 'UTF-8');
      w.stag(as.Sync)
         .stag(as.Collections)
           .stag(as.Collection);

      if (this._account.conn.currentVersion.lte('12.1'))
            w.tag(as.Class, 'Email');

            w.tag(as.SyncKey, this.syncKey)
             .tag(as.CollectionId, this.serverId)
             .tag(as.GetChanges)
             .stag(as.Options)
               .tag(as.FilterType, this.filterType);

      // Older versions of ActiveSync give us the body by default. Ensure they
      // omit it.
      if (this._account.conn.currentVersion.lt('12.0')) {
              w.tag(as.MIMESupport, asEnum.MIMESupport.Never)
               .tag(as.Truncation, asEnum.MIMETruncation.TruncateAll);
      } else {
              w.tag(as.MIMESupport, asEnum.MIMESupport.Always)
               .tag(as.MIMETruncation, asEnum.MIMETruncation.NoTruncate);
      }

            w.etag()
           .etag()
         .etag()
       .etag();
    }

    this._account.conn.postCommand(w, function(aError, aResponse) {
      var added   = [];
      var changed = [];
      var deleted = [];
      var status;
      var moreAvailable = false;

      folderConn._account._syncsInProgress--;

      if (aError) {
        console.error('Error syncing folder:', aError);
        folderConn._account._reportErrorIfNecessary(aError);
        callback('aborted');
        return;
      }

      folderConn._account._lastSyncKey = folderConn.syncKey;
      folderConn._account._lastSyncFilterType = folderConn.filterType;

      if (!aResponse) {
        console.log('Sync completed with empty response');
        folderConn._account._lastSyncResponseWasEmpty = true;
        callback(null, added, changed, deleted);
        return;
      }

      folderConn._account._lastSyncResponseWasEmpty = false;
      var e = new $wbxml.EventParser();
      var base = [as.Sync, as.Collections, as.Collection];

      e.addEventListener(base.concat(as.SyncKey), function(node) {
        folderConn.syncKey = node.children[0].textContent;
      });

      e.addEventListener(base.concat(as.Status), function(node) {
        status = node.children[0].textContent;
      });

      e.addEventListener(base.concat(as.MoreAvailable), function(node) {
        moreAvailable = true;
      });

      e.addEventListener(base.concat(as.Commands, [[as.Add, as.Change]]),
                         function(node) {
        var id, guid, msg;

        for (var iter in Iterator(node.children)) {
          var child = iter[1];
          switch (child.tag) {
          case as.ServerId:
            guid = child.children[0].textContent;
            break;
          case as.ApplicationData:
            try {
              msg = folderConn._parseMessage(child, node.tag === as.Add,
                                             storage);
            }
            catch (ex) {
              // If we get an error, just log it and skip this message.
              console.error('Failed to parse a message:', ex, '\n', ex.stack);
              return;
            }
            break;
          }
        }

        msg.header.srvid = guid;

        var collection = node.tag === as.Add ? added : changed;
        collection.push(msg);
      });

      e.addEventListener(base.concat(as.Commands, [[as.Delete, as.SoftDelete]]),
                         function(node) {
        var guid;

        for (var iter in Iterator(node.children)) {
          var child = iter[1];
          switch (child.tag) {
          case as.ServerId:
            guid = child.children[0].textContent;
            break;
          }
        }

        deleted.push(guid);
      });

      try {
        e.run(aResponse);
      }
      catch (ex) {
        console.error('Error parsing Sync response:', ex, '\n', ex.stack);
        callback('unknown');
        return;
      }

      if (status === asEnum.Status.Success) {
        console.log('Sync completed: added ' + added.length + ', changed ' +
                    changed.length + ', deleted ' + deleted.length);
        callback(null, added, changed, deleted, moreAvailable);
        if (moreAvailable)
          folderConn._enumerateFolderChanges(callback, progress);
      }
      else if (status === asEnum.Status.InvalidSyncKey) {
        console.warn('ActiveSync had a bad sync key');
        callback('badkey');
      }
      else {
        // if 'status' is undefined, we should to check account, it may be
        // needed refresh policyKey or wipe device.
        if (!status) {
          callback('checkAccount');
        } else {
          console.error('Something went wrong during ActiveSync syncing ' +
          'and we got a status of ' + status);
          callback('unknown');
        }
      }
    }, null, null,
    function progressData(bytesSoFar, totalBytes) {
      // We get the XHR progress status and convert it into progress in the
      // range [0.10, 0.80].  The remaining 20% is processing the specific
      // messages, but we don't bother to generate notifications since that
      // is done synchronously.
      if (!totalBytes)
        totalBytes = Math.max(1000000, bytesSoFar);
      progress(0.1 + 0.7 * bytesSoFar / totalBytes);
    });
  }, 'aborted'),

  /**
   * Parse the DOM of an individual message to build header and body objects for
   * it.
   * ASSUMES activesync code has already been lazy-loaded.
   *
   * @param {WBXML.Element} node The fully-parsed node describing the message
   * @param {boolean} isAdded True if this is a new message, false if it's a
   *   changed one
   * @return {object} An object containing the header and body for the message
   */
  _parseMessage: function asfc__parseMessage(node, isAdded, storage) {
    var em = $Email.Tags;
    var asb = $AirSyncBase.Tags;
    var asbEnum = $AirSyncBase.Enums;

    var header, body, flagHeader;

    if (isAdded) {
      var newId = storage._issueNewHeaderId();
      // note: these will be passed through mailRep.make* later
      header = {
        id: newId,
        // This will be fixed up afterwards for control flow paranoia.
        srvid: null,
        suid: storage.folderId + '/' + newId,
        // ActiveSync does not/cannot tell us the Message-ID header unless we
        // fetch the entire MIME body
        guid: '',
        author: null,
        to: null,
        cc: null,
        bcc: null,
        replyTo: null,
        date: null,
        flags: [],
        hasAttachments: false,
        subject: null,
        snippet: null
      };

      body = {
        date: null,
        size: 0,
        attachments: [],
        relatedParts: [],
        references: null,
        bodyReps: null
      };

      flagHeader = function(flag, state) {
        if (state)
          header.flags.push(flag);
      }
    }
    else {
      header = {
        flags: [],
        mergeInto: function(o) {
          // Merge flags
          for (var iter in Iterator(this.flags)) {
            var flagstate = iter[1];
            if (flagstate[1]) {
              o.flags.push(flagstate[0]);
            }
            else {
              var index = o.flags.indexOf(flagstate[0]);
              if (index !== -1)
                o.flags.splice(index, 1);
            }
          }

          // Merge everything else
          var skip = ['mergeInto', 'suid', 'srvid', 'guid', 'id', 'flags'];
          for (var iter in Iterator(this)) {
            var key = iter[0], value = iter[1];
            if (skip.indexOf(key) !== -1)
              continue;

            o[key] = value;
          }
        },
      };

      body = {
        mergeInto: function(o) {
          for (var iter in Iterator(this)) {
            var key = iter[0], value = iter[1];
            if (key === 'mergeInto') continue;
            o[key] = value;
          }
        },
      };

      flagHeader = function(flag, state) {
        header.flags.push([flag, state]);
      }
    }

    var bodyType, bodySize;

    for (var iter in Iterator(node.children)) {
      var child = iter[1];
      var childText = child.children.length ? child.children[0].textContent :
                                              null;
      switch (child.tag) {
      case em.Subject:
        header.subject = childText;
        break;
      case em.From:
        header.author = parseAddresses(childText)[0] || null;
        break;
      case em.To:
        header.to = parseAddresses(childText);
        break;
      case em.Cc:
        header.cc = parseAddresses(childText);
        break;
      case em.ReplyTo:
        header.replyTo = parseAddresses(childText);
        break;
      case em.DateReceived:
        body.date = header.date = new Date(childText).valueOf();
        break;
      case em.Read:
        flagHeader('\\Seen', childText === '1');
        break;
      case em.Flag:
        for (var iter2 in Iterator(child.children)) {
          var grandchild = iter2[1];
          if (grandchild.tag === em.Status)
            flagHeader('\\Flagged', grandchild.children[0].textContent !== '0');
        }
        break;
      case asb.Body: // ActiveSync 12.0+
        for (var iter2 in Iterator(child.children)) {
          var grandchild = iter2[1];
          switch (grandchild.tag) {
          case asb.Type:
            var type = grandchild.children[0].textContent;
            if (type === asbEnum.Type.HTML)
              bodyType = 'html';
            else {
              // I've seen a handful of extra-weird messages with body types
              // that aren't plain or html. Let's assume they're html, though.
              if (type !== asbEnum.Type.PlainText) {
                console.warn('A message had a strange body type:', type);
                bodyType = 'html';
              } else {
                bodyType = 'plain';
              }
            }
            break;
          case asb.EstimatedDataSize:
            bodySize = grandchild.children[0].textContent;
            break;
          case asb.Data:
            bodySize = grandchild.children[0].textContent.length;
            break;
          }
        }
        break;
      case em.MIMEData:
        bodyType = 'html';
        bodySize = childText.length;
        break;
      case em.BodySize: // pre-ActiveSync 12.0
        bodyType = 'plain';
        bodySize = childText;
        break;
      case asb.Attachments: // ActiveSync 12.0+
      case em.Attachments:  // pre-ActiveSync 12.0
        for (var iter2 in Iterator(child.children)) {
          var attachmentNode = iter2[1];
          if (attachmentNode.tag !== asb.Attachment &&
              attachmentNode.tag !== em.Attachment)
            continue;

          var attachment = {
            name: null,
            contentId: null,
            type: null,
            part: null,
            encoding: null,
            sizeEstimate: null,
            file: null
          };

          var isInline = false;
          for (var iter3 in Iterator(attachmentNode.children)) {
            var attachData = iter3[1];
            var dot, ext;
            var attachDataText = attachData.children.length ?
                                 attachData.children[0].textContent : null;

            switch (attachData.tag) {
            case asb.DisplayName:
            case em.DisplayName:
              attachment.name = attachDataText;

              // Get the file's extension to look up a mimetype, but ignore it
              // if the filename is of the form '.bashrc'.
              dot = attachment.name.lastIndexOf('.');
              ext = dot > 0 ? attachment.name.substring(dot + 1).toLowerCase() :
                              '';
              attachment.type = mimetypes.detectMimeType(ext);
              break;
            case asb.FileReference:
            case em.AttName:
            case em.Att0Id:
              attachment.part = attachDataText;
              break;
            case asb.EstimatedDataSize:
            case em.AttSize:
              attachment.sizeEstimate = parseInt(attachDataText, 10);
              break;
            case asb.ContentId:
              attachment.contentId = attachDataText;
              break;
            case asb.IsInline:
              isInline = (attachDataText === '1');
              break;
            }
          }

          if (isInline)
            body.relatedParts.push(mailRep.makeAttachmentPart(attachment));
          else
            body.attachments.push(mailRep.makeAttachmentPart(attachment));
        }
        header.hasAttachments = body.attachments.length > 0;
        break;
      }
    }

    // If this is an add, then these are new structures so we need to normalize
    // them.
    if (isAdded) {
      body.bodyReps = [mailRep.makeBodyPart({
        type: bodyType,
        sizeEstimate: bodySize,
        amountDownloaded: 0,
        isDownloaded: false
      })];

      return {
        header: mailRep.makeHeaderInfo(header),
        body: mailRep.makeBodyInfo(body)
      };
    }
    // It's not an add, so this is a delta, and header/body have mergeInto
    // methods and we should not attempt to normalize them.
    else {
      return { header: header, body: body };
    }
  },

  /**
   * Download the bodies for a set of headers.
   *
   * XXX This method is a slightly modified version of
   * ImapFolderConn._lazyDownloadBodies; we should attempt to remove the
   * duplication.
   */
  downloadBodies: function(headers, options, callback) {
    if (this._account.conn.currentVersion.lt('12.0'))
      return this._syncBodies(headers, callback);

    var downloadsNeeded = 0,
        folderConn = this;

    var latch = allback.latch();
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i];
      // We obviously can't do anything with null header references.
      // To avoid redundant work, we also don't want to do any fetching if we
      // already have a snippet.  This could happen because of the extreme
      // potential for a caller to spam multiple requests at us before we
      // service any of them.  (Callers should only have one or two outstanding
      // jobs of this and do their own suppression tracking, but bugs happen.)
      if (!header || header.snippet !== null) {
        continue;
      }

      // This isn't absolutely guaranteed to be 100% correct, but is good enough
      // for indicating to the caller that we did some work.
      downloadsNeeded++;
      this.downloadBodyReps(header, options, latch.defer(header.suid));
    }
    latch.then(function(results) {
      callback(allback.extractErrFromCallbackArgs(results), downloadsNeeded);
    });
  },

  downloadBodyReps: lazyConnection(1, function(header, options, callback) {
    var folderConn = this;
    var account = this._account;

    if (account.conn.currentVersion.lt('12.0'))
      return this._syncBodies([header], callback);

    if (typeof(options) === 'function') {
      callback = options;
      options = null;
    }
    options = options || {};

    var io = $ItemOperations.Tags;
    var ioEnum = $ItemOperations.Enums;
    var as = $AirSync.Tags;
    var asEnum = $AirSync.Enums;
    var asb = $AirSyncBase.Tags;
    var Type = $AirSyncBase.Enums.Type;

    var gotBody = function gotBody(bodyInfo) {
      if (!bodyInfo)
        return callback('unknown');

      // ActiveSync only stores one body rep, no matter how many body parts the
      // MIME message actually has.
      var bodyRep = bodyInfo.bodyReps[0];
      var bodyType = bodyRep.type === 'html' ? Type.HTML : Type.PlainText;

      var truncationSize;

      // If the body is bigger than the max size, grab a small bit of plain text
      // to show as the snippet.
      if (options.maximumBytesToFetch < bodyRep.sizeEstimate) {
        bodyType = Type.PlainText;
        truncationSize = DESIRED_TEXT_SNIPPET_BYTES;
      }

      var w = new $wbxml.Writer('1.3', 1, 'UTF-8');
      w.stag(io.ItemOperations)
         .stag(io.Fetch)
           .tag(io.Store, 'Mailbox')
           .tag(as.CollectionId, folderConn.serverId)
           .tag(as.ServerId, header.srvid)
           .stag(io.Options)
             // Only get the AirSyncBase:Body element to minimize bandwidth.
             .stag(io.Schema)
               .tag(asb.Body)
             .etag()
             .stag(asb.BodyPreference)
               .tag(asb.Type, bodyType);

      if (truncationSize)
              w.tag(asb.TruncationSize, truncationSize);

            w.etag()
           .etag()
         .etag()
       .etag();

      account.conn.postCommand(w, function(aError, aResponse) {
        if (aError) {
          console.error(aError);
          account._reportErrorIfNecessary(aError);
          callback('unknown');
          return;
        }

        var status, bodyContent, parseError,
            e = new $wbxml.EventParser();
        e.addEventListener([io.ItemOperations, io.Status], function(node) {
          status = node.children[0].textContent;
        });
        e.addEventListener([io.ItemOperations, io.Response, io.Fetch,
                            io.Properties, asb.Body, asb.Data], function(node) {
          bodyContent = node.children[0].textContent;
        });

        try {
          e.run(aResponse);
        }
        catch (ex) {
          return callback('unknown');
        }

        if (status !== ioEnum.Status.Success)
          return callback('unknown');

        folderConn._updateBody(header, bodyInfo, bodyContent, !!truncationSize,
                               callback);
      });
    };

    this._storage.getMessageBody(header.suid, header.date, gotBody);
  }),

  /**
   * Sync message bodies. This function should only be used against ActiveSync
   * 2.5! XXX: This *always* downloads the bodies for all the messages, even if
   * it exceeds the maximum requested size.
   */
  _syncBodies: function(headers, callback) {
    var as = $AirSync.Tags;
    var asEnum = $AirSync.Enums;
    var em = $Email.Tags;

    var folderConn = this;
    var account = this._account;

    var w = new $wbxml.Writer('1.3', 1, 'UTF-8');
    w.stag(as.Sync)
       .stag(as.Collections)
         .stag(as.Collection)
           .tag(as.Class, 'Email')
           .tag(as.SyncKey, this.syncKey)
           .tag(as.CollectionId, this.serverId)
           .stag(as.Options)
             .tag(as.MIMESupport, asEnum.MIMESupport.Never)
           .etag()
           .stag(as.Commands);

    for (var i = 0; i < headers.length; i++) {
            w.stag(as.Fetch)
               .tag(as.ServerId, headers[i].srvid)
             .etag();
    }

          w.etag()
         .etag()
       .etag()
     .etag();

    account.conn.postCommand(w, function(aError, aResponse) {
      if (aError) {
        console.error(aError);
        account._reportErrorIfNecessary(aError);
        callback('unknown');
        return;
      }

      var latch = allback.latch();
      var iHeader = 0;

      var e = new $wbxml.EventParser();
      var base = [as.Sync, as.Collections, as.Collection];
      e.addEventListener(base.concat(as.SyncKey), function(node) {
        folderConn.syncKey = node.children[0].textContent;
      });
      e.addEventListener(base.concat(as.Status), function(node) {
        var status = node.children[0].textContent;
        if (status !== asEnum.Status.Success) {
          latch.defer('status')('unknown');
        }
      });
      e.addEventListener(base.concat(as.Responses, as.Fetch,
                                     as.ApplicationData, em.Body),
                         function(node) {
        // We assume the response is in the same order as the request!
        var header = headers[iHeader++];
        var bodyContent = node.children[0].textContent;
        var latchCallback = latch.defer(header.suid);

        folderConn._storage.getMessageBody(header.suid, header.date,
                                           function(body) {
          folderConn._updateBody(header, body, bodyContent, false,
                                 latchCallback);
        });
      });
      e.run(aResponse);

      latch.then(function(results) {
        callback(allback.extractErrFromCallbackArgs(results));
      });
    });
  },

  /**
   * Determine whether an activesync header represents a read message.
   * ActiveSync has an different header flag formant: ['flag', true/false].
   */
  _activeSyncHeaderIsSeen: function(header) {
    for (var i = 0; i < header.flags.length; i++) {
      if (header.flags[i][0] === '\\Seen' && header.flags[i][1]) {
        return true;
      }
    }
    return false;
  },

  _updateBody: function(header, bodyInfo, bodyContent, snippetOnly, callback) {
    var bodyRep = bodyInfo.bodyReps[0];

    // We neither need to store or want to deal with \r in the processing of
    // the body.
    if (!bodyContent) {
      bodyContent = '';
    }
    bodyContent = bodyContent.replace(/\r/g, '');

    var type = snippetOnly ? 'plain' : bodyRep.type;
    var data = $mailchew.processMessageContent(bodyContent, type, !snippetOnly,
                                               true);

    header.snippet = data.snippet;
    bodyRep.isDownloaded = !snippetOnly;
    bodyRep.amountDownloaded = bodyContent.length;
    if (!snippetOnly)
      bodyRep.content = data.content;

    var event = {
      changeDetails: {
        bodyReps: [0]
      }
    };

    var latch = allback.latch();
    this._storage.updateMessageHeader(header.date, header.id, false, header,
                                      bodyInfo, latch.defer('header'));
    this._storage.updateMessageBody(header, bodyInfo, {}, event,
                                    latch.defer('body'));
    latch.then(callback.bind(null, null, bodyInfo, /* flushed */ false));
  },

  sync: lazyConnection(1, function asfc_sync(accuracyStamp, doneCallback,
                                    progressCallback) {
    var folderConn = this,
        addedMessages = 0,
        changedMessages = 0,
        deletedMessages = 0;

    logic(this, 'sync_begin');
    var self = this;
    this._enumerateFolderChanges(function (error, added, changed, deleted,
                                           moreAvailable) {
      var storage = folderConn._storage;

      if (error === 'badkey') {
        // We should set sync key to '0' if got bad sync key from server,
        // and then can auto update the sync key when running sync.
        folderConn.syncKey = '0';
        folderConn._account._recreateFolder(storage.folderId, function(s) {
          // If we got a bad sync key, we'll end up creating a new connection,
          // so just clear out the old storage to make this connection unusable.
          folderConn._storage = null;
          logic(folderConn, 'sync_end', {
		    full: null, changed: null, deleted: null
		  });
        });
        return;
      } else if (error === 'checkAccount') {
        // we do syncFolderList to check if need refresh policyKey
        // or wipe device
        folderConn._account.syncFolderList((error) => {
          doneCallback(error);
        });
        return;
      } else if (error) {
        // Sync is over!
        logic(folderConn, 'sync_end', {
		  full: null, changed: null, deleted: null
        });
        doneCallback(error);
        return;
      }

      var latch = allback.latch();
      for (var iter in Iterator(added)) {
        var message = iter[1];
        // If we already have this message, it's probably because we moved it as
        // part of a local op, so let's assume that the data we already have is
        // ok. XXX: We might want to verify this, to be safe.
        if (storage.hasMessageWithServerId(message.header.srvid))
          continue;

        storage.addMessageHeader(message.header, message.body, latch.defer());
        storage.addMessageBody(message.header, message.body, latch.defer());
        addedMessages++;
      }

      for (var iter in Iterator(changed)) {
        var message = iter[1];
        // If we don't know about this message, just bail out.
        if (!storage.hasMessageWithServerId(message.header.srvid))
          continue;

        storage.updateMessageHeaderByServerId(message.header.srvid, true,
                                              function(message, oldHeader) {

          if (!self._activeSyncHeaderIsSeen(oldHeader) &&
            self._activeSyncHeaderIsSeen(message.header)) {
            storage.folderMeta.unreadCount--;
          } else if (self._activeSyncHeaderIsSeen(oldHeader) &&
            !self._activeSyncHeaderIsSeen(message.header)) {
            storage.folderMeta.unreadCount++;
          }

          message.header.mergeInto(oldHeader);
          return true;
        // Previously, this callback was called without safeguards in place
        // to prevent issues caused by the message variable changing,
        // so it is now bound to the function.
        }.bind(null, message), /* body hint */ null, latch.defer());
        changedMessages++;
        // XXX: update bodies
      }

      for (var iter in Iterator(deleted)) {
        var messageGuid = iter[1];
        // If we don't know about this message, it's probably because we already
        // deleted it.
        if (!storage.hasMessageWithServerId(messageGuid))
          continue;

        storage.deleteMessageByServerId(messageGuid, latch.defer());
        deletedMessages++;
      }

      if (!moreAvailable) {
        var messagesSeen = addedMessages + changedMessages + deletedMessages;

        // Do not report completion of sync until all of our operations have
        // been persisted to our in-memory database.  We tell this via their
        // callbacks having completed.
        latch.then(function() {
          // Note: For the second argument here, we report the number of
          // messages we saw that *changed*. This differs from IMAP, which
          // reports the number of messages it *saw*.
          logic(folderConn, 'sync_end', {
            full: addedMessages,
            changed: changedMessages,
            deleted: deletedMessages
          });
          storage.markSyncRange($sync.OLDEST_SYNC_DATE, accuracyStamp, 'XXX',
                                accuracyStamp);
          doneCallback(null, null, messagesSeen);
        });
      }
    },
    progressCallback);
  }),

  performMutation: lazyConnection(1, function(invokeWithWriter, callWhenDone) {
    var folderConn = this;

    var as = $AirSync.Tags;
    var account = this._account;

    var w = new $wbxml.Writer('1.3', 1, 'UTF-8');
    w.stag(as.Sync)
       .stag(as.Collections)
         .stag(as.Collection);

    if (account.conn.currentVersion.lt('12.1'))
          w.tag(as.Class, 'Email');

          w.tag(as.SyncKey, this.syncKey)
           .tag(as.CollectionId, this.serverId)
           // Use DeletesAsMoves in non-trash folders. Don't use it in trash
           // folders because that doesn't make any sense.
           .tag(as.DeletesAsMoves, this.folderMeta.type === 'trash' ? '0' : '1')
           // GetChanges defaults to true, so we must explicitly disable it to
           // avoid hearing about changes.
           .tag(as.GetChanges, '0')
           .stag(as.Commands);

    try {
      invokeWithWriter(w);
    }
    catch (ex) {
      console.error('Exception in performMutation callee:', ex,
                    '\n', ex.stack);
      callWhenDone('unknown');
      return;
    }

           w.etag(as.Commands)
         .etag(as.Collection)
       .etag(as.Collections)
     .etag(as.Sync);

    account.conn.postCommand(w, function(aError, aResponse) {
      if (aError) {
        console.error('postCommand error:', aError);
        account._reportErrorIfNecessary(aError);
        callWhenDone('unknown');
        return;
      }

      var e = new $wbxml.EventParser();
      var syncKey, status;

      var base = [as.Sync, as.Collections, as.Collection];
      e.addEventListener(base.concat(as.SyncKey), function(node) {
        syncKey = node.children[0].textContent;
      });
      e.addEventListener(base.concat(as.Status), function(node) {
        status = node.children[0].textContent;
      });

      try {
        e.run(aResponse);
      }
      catch (ex) {
        console.error('Error parsing Sync response:', ex, '\n', ex.stack);
        callWhenDone('unknown');
        return;
      }

      if (status === $AirSync.Enums.Status.Success) {
        folderConn.syncKey = syncKey;
        if (callWhenDone)
          callWhenDone(null);
      }
      else {
        console.error('Something went wrong during ActiveSync syncing and we ' +
                      'got a status of ' + status);
        callWhenDone('status:' + status);
      }
    });
  }),

  // XXX: take advantage of multipart responses here.
  // See http://msdn.microsoft.com/en-us/library/ee159875%28v=exchg.80%29.aspx
  downloadMessageAttachments: lazyConnection(2, function(uid,
                                                         partInfos,
                                                         callback,
                                                         progress) {
    var folderConn = this;

    var io = $ItemOperations.Tags;
    var ioStatus = $ItemOperations.Enums.Status;
    var asb = $AirSyncBase.Tags;

    var w = new $wbxml.Writer('1.3', 1, 'UTF-8');
    w.stag(io.ItemOperations);
    for (var iter in Iterator(partInfos)) {
      var part = iter[1];
      w.stag(io.Fetch)
         .tag(io.Store, 'Mailbox')
         .tag(asb.FileReference, part.part)
       .etag();
    }
    w.etag();

    this._account.conn.postCommand(w, function(aError, aResult) {
      if (aError) {
        console.error('postCommand error:', aError);
        folderConn._account._reportErrorIfNecessary(aError);
        callback('unknown');
        return;
      }

      var globalStatus;
      var attachments = {};

      var e = new $wbxml.EventParser();
      e.addEventListener([io.ItemOperations, io.Status], function(node) {
        globalStatus = node.children[0].textContent;
      });
      e.addEventListener([io.ItemOperations, io.Response, io.Fetch],
                         function(node) {
        var part = null, attachment = {};

        for (var iter in Iterator(node.children)) {
          var child = iter[1];
          switch (child.tag) {
          case io.Status:
            attachment.status = child.children[0].textContent;
            break;
          case asb.FileReference:
            part = child.children[0].textContent;
            break;
          case io.Properties:
            var contentType = null, data = null;

            for (var iter2 in Iterator(child.children)) {
              var grandchild = iter2[1];
              var textContent = grandchild.children[0].textContent;

              switch (grandchild.tag) {
              case asb.ContentType:
                contentType = textContent;
                break;
              case io.Data:
                data = safeBase64.decode(textContent);
                break;
              }
            }

            if (contentType && data)
              attachment.data = new Blob([data], { type: contentType });
            break;
          }

          if (part)
            attachments[part] = attachment;
        }
      });
      e.run(aResult);

      var error = globalStatus !== ioStatus.Success ? 'unknown' : null;
      var bodies = [];
      for (var iter in Iterator(partInfos)) {
        var part = iter[1];
        if (attachments.hasOwnProperty(part.part) &&
            attachments[part.part].status === ioStatus.Success) {
          bodies.push(attachments[part.part].data);
        }
        else {
          error = 'unknown';
          bodies.push(null);
        }
      }
      callback(error, bodies);
    });
  }),
};

function ActiveSyncFolderSyncer(account, folderStorage) {
  this._account = account;
  this.folderStorage = folderStorage;

  logic.defineScope(this, 'ActiveSyncFolderSyncer',
                    { accountId: account.id,
                      folderId: folderStorage.folderId });

  this.folderConn = new ActiveSyncFolderConn(account, folderStorage);
}
exports.ActiveSyncFolderSyncer = ActiveSyncFolderSyncer;
ActiveSyncFolderSyncer.prototype = {
  /**
   * Can we synchronize?  Not if we don't have a server id!  (This happens for
   * the inbox when it is speculative before our first syncFolderList.)
   */
  get syncable() {
    return this.folderConn.serverId !== null;
  },

  /**
   * Can we grow this sync range?  Not in ActiveSync land!
   */
  get canGrowSync() {
    return false;
  },

  initialSync: function(slice, initialDays, syncCallback,
                        doneCallback, progressCallback) {
    syncCallback('sync', true /* Ignore Headers */);
    this.folderConn.sync(
      $date.NOW(),
      this.onSyncCompleted.bind(this, doneCallback, true),
      progressCallback);
  },

  refreshSync: function(slice, dir, startTS, endTS, origStartTS,
                        doneCallback, progressCallback) {
    this.folderConn.sync(
      $date.NOW(),
      this.onSyncCompleted.bind(this, doneCallback, false),
      progressCallback);
  },

  // Returns false if no sync is necessary.
  growSync: function(slice, growthDirection, anchorTS, syncStepDays,
                     doneCallback, progressCallback) {
    // ActiveSync is different, and trying to sync more doesn't work with it.
    // Just assume we've got all we need.
    // (There is no need to invoke the callbacks; by returning false, we
    // indicate that we did no work.)
    return false;
  },

  /**
   * Whatever synchronization we last triggered has now completed; we should
   * either trigger another sync if we still want more data, or close out the
   * current sync.
   */
  onSyncCompleted: function ifs_onSyncCompleted(doneCallback, initialSync,
                                                err, bisectInfo, messagesSeen) {
    var storage = this.folderStorage;
    console.log("Sync Completed!", messagesSeen, "messages synced");

    // Expand the accuracy range to cover everybody.
    if (!err)
      storage.markSyncedToDawnOfTime();

    // Always save state, although as an optimization, we could avoid saving
    // state if we were sure that our state with the server did not advance.
    // Do not call our callback until the save has completed.
    this._account.__checkpointSyncCompleted(function() {
      if (err) {
        doneCallback(err);
      }
      else if (initialSync) {
        storage._curSyncSlice.ignoreHeaders = false;
        storage._curSyncSlice.waitingOnData = 'db';

        // TODO: We could potentially shave some latency by doing the DB fetch
        // but deferring the doneCallback until the checkpoint has notified.
        // I'm copping out on this right now because there may be some nuances
        // in there that I would like to think about more and this is also not
        // a major slowdown concern.  We're already slow here and the more
        // important thing for us to do would just be to trigger the initial
        // sync much earlier in the UI process to save even more time.
        storage.getMessagesInImapDateRange(
          0, null, $sync.INITIAL_FILL_SIZE, $sync.INITIAL_FILL_SIZE,
          // Don't trigger a refresh; we just synced.  Accordingly,
          // releaseMutex can be null.
          storage.onFetchDBHeaders.bind(storage, storage._curSyncSlice, false,
                                        doneCallback, null)
        );
      }
      else {
        doneCallback(err);
      }
    });
  },

  allConsumersDead: function() {
  },

  shutdown: function() {
    this.folderConn.shutdown();
  }
};

}); // end define
;
define(
  'activesync/jobs',[
    'logic',
    'mix',
    '../jobmixins',
    '../drafts/jobs',
    'activesync/codepages/AirSync',
    'activesync/codepages/Email',
    'activesync/codepages/Move',
    'module',
    'require',
    'exports'
  ],
  function(
    logic,
    mix,
    $jobmixins,
    draftsJobs,
    $AirSync,
    $Email,
    $Move,
    $module,
    require,
    exports
  ) {


var $wbxml;

function lazyConnection(cbIndex, fn, failString) {
  return function lazyRun() {
    var args = Array.slice(arguments),
        errback = args[cbIndex],
        self = this;

    require(['wbxml'], function (wbxml) {
      if (!$wbxml) {
        $wbxml = wbxml;
      }

      self.account.withConnection(errback, function () {
        fn.apply(self, args);
      }, failString);
    });
  };
}

function ActiveSyncJobDriver(account, state) {
  this.account = account;
  // XXX for simplicity for now, let's assume that ActiveSync GUID's are
  // maintained across folder moves.
  this.resilientServerIds = true;
  this._heldMutexReleasers = [];

  logic.defineScope(this, 'ActiveSyncJobDriver',
                    { accountId: this.account.id });

  this._state = state;
  // (we only need to use one as a proxy for initialization)
  if (!state.hasOwnProperty('suidToServerId')) {
    state.suidToServerId = {};
    state.moveMap = {};
  }

  this._stateDelta = {
    serverIdMap: null,
    moveMap: null,
  };
}
exports.ActiveSyncJobDriver = ActiveSyncJobDriver;
ActiveSyncJobDriver.prototype = {
  //////////////////////////////////////////////////////////////////////////////
  // helpers

  postJobCleanup: $jobmixins.postJobCleanup,

  allJobsDone: $jobmixins.allJobsDone,

  _accessFolderForMutation: function(folderId, needConn, callback, deathback,
                                     label) {
    var storage = this.account.getFolderStorageForFolderId(folderId),
        self = this;
    storage.runMutexed(label, function(releaseMutex) {
      self._heldMutexReleasers.push(releaseMutex);

      var syncer = storage.folderSyncer;
      if (needConn) {
        self.account.withConnection(callback, function () {
          try {
            callback(syncer.folderConn, storage);
          }
          catch (ex) {
            logic(self, 'callbackErr', { ex: ex });
          }
        });
      } else {
        try {
          callback(syncer.folderConn, storage);
        }
        catch (ex) {
          logic(self, 'callbackErr', { ex: ex });
        }
      }
    });
  },

  _partitionAndAccessFoldersSequentially:
    $jobmixins._partitionAndAccessFoldersSequentially,

  //////////////////////////////////////////////////////////////////////////////
  // modtags

  local_do_modtags: $jobmixins.local_do_modtags,

  do_modtags: lazyConnection(1, function(op, jobDoneCallback, undo) {
    // Note: this method is derived from the IMAP implementation.
    var addTags = undo ? op.removeTags : op.addTags,
        removeTags = undo ? op.addTags : op.removeTags;

    function getMark(tag) {
      if (addTags && addTags.indexOf(tag) !== -1)
        return true;
      if (removeTags && removeTags.indexOf(tag) !== -1)
        return false;
      return undefined;
    }

    var markRead = getMark('\\Seen');
    var markFlagged = getMark('\\Flagged');

    var as = $AirSync.Tags;
    var em = $Email.Tags;

    var aggrErr = null;

    this._partitionAndAccessFoldersSequentially(
      op.messages, true,
      function perFolder(folderConn, storage, serverIds, namers, callWhenDone) {
        var modsToGo = 0;
        function tagsModded(err) {
          if (err) {
            console.error('failure modifying tags', err);
            aggrErr = 'unknown';
            return;
          }
          op.progress += (undo ? -serverIds.length : serverIds.length);
          if (--modsToGo === 0)
            callWhenDone();
        }

        // Filter out any offline headers, since the server naturally can't do
        // anything for them. If this means we have no headers at all, just bail
        // out.
        serverIds = serverIds.filter(function(srvid) { return !!srvid; });
        if (!serverIds.length) {
          callWhenDone();
          return;
        }

        folderConn.performMutation(
          function withWriter(w) {
            for (var i = 0; i < serverIds.length; i++) {
              w.stag(as.Change)
                 .tag(as.ServerId, serverIds[i])
                 .stag(as.ApplicationData);

              if (markRead !== undefined)
                w.tag(em.Read, markRead ? '1' : '0');

              if (markFlagged !== undefined)
                w.stag(em.Flag)
                   .tag(em.Status, markFlagged ? '2' : '0')
                 .etag();

                w.etag(as.ApplicationData)
             .etag(as.Change);
            }
          },
          function mutationPerformed(err) {
            if (err)
              aggrErr = err;
            callWhenDone();
          });
      },
      function allDone() {
        jobDoneCallback(aggrErr);
      },
      function deadConn() {
        aggrErr = 'aborted-retry';
      },
      /* reverse if we're undoing */ undo,
      'modtags');
  }),

  check_modtags: function(op, callback) {
    callback(null, 'idempotent');
  },

  local_undo_modtags: $jobmixins.local_undo_modtags,

  undo_modtags: function(op, callback) {
    this.do_modtags(op, callback, true);
  },

  //////////////////////////////////////////////////////////////////////////////
  // move

  local_do_move: $jobmixins.local_do_move,

  do_move: lazyConnection(1, function(op, jobDoneCallback) {
    /*
     * The ActiveSync command for this does not produce or consume SyncKeys.
     * As such, we don't need to acquire mutexes for the source folders for
     * synchronization correctness, although it is helpful for ordering
     * purposes and reducing confusion.
     *
     * For the target folder a similar logic exists as long as the server-issued
     * GUID's are resilient against folder moves.  However, we do require in
     * all cases that before synchronizing the target folder that we make sure
     * all move operations to the folder have completed so we message doesn't
     * disappear and then show up again. XXX we are not currently enforcing this
     * yet.
     */
    var aggrErr = null, account = this.account,
        targetFolderStorage = this.account.getFolderStorageForFolderId(
                                op.targetFolder);
    var mo = $Move.Tags;

    this._partitionAndAccessFoldersSequentially(
      op.messages, true,
      function perFolder(folderConn, storage, serverIds, namers, callWhenDone) {
        // Filter out any offline headers, since the server naturally can't do
        // anything for them. If this means we have no headers at all, just bail
        // out.
        serverIds = serverIds.filter(function(srvid) { return !!srvid; });
        if (!serverIds.length) {
          callWhenDone();
          return;
        }

        // Filter out any offline headers, since the server naturally can't do
        // anything for them. If this means we have no headers at all, just bail
        // out.
        serverIds = serverIds.filter(function(srvid) { return !!srvid; });
        if (!serverIds.length) {
          callWhenDone();
          return;
        }

        var w = new $wbxml.Writer('1.3', 1, 'UTF-8');
        w.stag(mo.MoveItems);
        for (var i = 0; i < serverIds.length; i++) {
          w.stag(mo.Move)
             .tag(mo.SrcMsgId, serverIds[i])
             .tag(mo.SrcFldId, storage.folderMeta.serverId)
             .tag(mo.DstFldId, targetFolderStorage.folderMeta.serverId)
           .etag(mo.Move);
        }
        w.etag(mo.MoveItems);

        account.conn.postCommand(w, function(err, response) {
          let e = new $wbxml.EventParser();
          if (err) {
            aggrErr = err;
            console.error('failure moving messages:', err);
          }

          const st = $Move.Enums.Status;
          e.addEventListener([mo.MoveItems, mo.Response, mo.Status], (node) => {
            const status = node.children[0].textContent;
            if (status != st.Success) {
              console.error('failure moving messages' + status);
            }
          });

          let count = 0;
          e.addEventListener([mo.MoveItems, mo.Response, mo.DstMsgId], (node) => {
            const value = node.children[0].textContent;
            (function (count) {
              const moveSuid = op.messages[count].moveSuid;
              const date = namers[count].date;
              targetFolderStorage.getMessageHeader(moveSuid, date, (header) => {
                let _header = header;
                  targetFolderStorage.deleteMessageHeaderUsingHeader(_header, () => {
                    _header.srvid = value;
                    targetFolderStorage.addMessageHeader(_header, null, () => {
                      console.log(' addMessageHeader callback');
                    });
                  });
                });
            })(count);
            count++;
          });

          try {
            e.run(response);
          }
          catch (ex) {
           console.error('ex is:' + ex);
          }
          callWhenDone();
        });
      },
      function allDone() {
        jobDoneCallback(aggrErr, null, true);
      },
      function deadConn() {
        aggrErr = 'aborted-retry';
      },
      false,
      'move');
  }),

  check_move: function(op, jobDoneCallback) {

  },

  local_undo_move: $jobmixins.local_undo_move,

  undo_move: function(op, jobDoneCallback) {
  },


  //////////////////////////////////////////////////////////////////////////////
  // delete

  local_do_delete: $jobmixins.local_do_delete,

  do_delete: lazyConnection(1, function(op, jobDoneCallback) {
    var aggrErr = null;
    var as = $AirSync.Tags;
    var em = $Email.Tags;

    this._partitionAndAccessFoldersSequentially(
      op.messages, true,
      function perFolder(folderConn, storage, serverIds, namers, callWhenDone) {
        // Filter out any offline headers, since the server naturally can't do
        // anything for them. If this means we have no headers at all, just bail
        // out.
        serverIds = serverIds.filter(function(srvid) { return !!srvid; });
        if (!serverIds.length) {
          callWhenDone();
          return;
        }

        folderConn.performMutation(
          function withWriter(w) {
            for (var i = 0; i < serverIds.length; i++) {
              w.stag(as.Delete)
                 .tag(as.ServerId, serverIds[i])
               .etag(as.Delete);
            }
          },
          function mutationPerformed(err) {
            if (err) {
              aggrErr = err;
              console.error('failure deleting messages:', err);
            }
            callWhenDone();
          });
      },
      function allDone() {
        jobDoneCallback(aggrErr, null, true);
      },
      function deadConn() {
        aggrErr = 'aborted-retry';
      },
      false,
      'delete');
  }),

  check_delete: function(op, callback) {
    callback(null, 'idempotent');
  },

  local_undo_delete: $jobmixins.local_undo_delete,

  // TODO implement
  undo_delete: function(op, callback) {
    callback('moot');
  },

  //////////////////////////////////////////////////////////////////////////////
  // syncFolderList
  //
  // Synchronize our folder list.  This should always be an idempotent operation
  // that makes no sense to undo/redo/etc.

  local_do_syncFolderList: function(op, doneCallback) {
    doneCallback(null);
  },

  do_syncFolderList: lazyConnection(1, function(op, doneCallback) {
    var account = this.account, self = this;

    // The inbox needs to be resynchronized if there was no server id and we
    // have active slices displaying the contents of the folder.  (No server id
    // means the sync will not happen.)
    var inboxFolder = account.getFirstFolderWithType('inbox'),
        inboxStorage;
    if (inboxFolder && inboxFolder.serverId === null)
      inboxStorage = account.getFolderStorageForFolderId(inboxFolder.id);
    account.syncFolderList(function(err) {
      if (!err)
        account.meta.lastFolderSyncAt = Date.now();
      // save if it worked
      doneCallback(err ? 'aborted-retry' : null, null, !err);

      if (inboxStorage && inboxStorage.hasActiveSlices) {
        if (!err) {
          console.log("Refreshing fake inbox");
          inboxStorage.resetAndRefreshActiveSlices();
        }
        // XXX: If we do have an error here, we should probably report
        // syncfailed on the slices to let the user retry. However, what needs
        // retrying is syncFolderList, not syncing the messages in a folder.
        // Since that's complicated to handle, and syncFolderList will retry
        // automatically, we can ignore that case for now.
      }
    });
  }, 'aborted-retry'),

  check_syncFolderList: function(op, doneCallback) {
    doneCallback(null, 'coherent-notyet');
  },

  local_undo_syncFolderList: function(op, doneCallback) {
    doneCallback('moot');
  },

  undo_syncFolderList: function(op, doneCallback) {
    doneCallback('moot');
  },

  //////////////////////////////////////////////////////////////////////////////
  // downloadBodies: Download the bodies from a list of messages

  local_do_downloadBodies: $jobmixins.local_do_downloadBodies,

  do_downloadBodies: $jobmixins.do_downloadBodies,

  check_downloadBodies: $jobmixins.check_downloadBodies,

  //////////////////////////////////////////////////////////////////////////////
  // downloadBodyReps: Download the bodies from a single message

  local_do_downloadBodyReps: $jobmixins.local_do_downloadBodyReps,

  do_downloadBodyReps: $jobmixins.do_downloadBodyReps,

  check_downloadBodyReps: $jobmixins.check_downloadBodyReps,

  //////////////////////////////////////////////////////////////////////////////
  // download: Download one or more attachments from a single message

  local_do_download: $jobmixins.local_do_download,

  do_download: $jobmixins.do_download,

  check_download: $jobmixins.check_download,

  local_undo_download: $jobmixins.local_undo_download,

  undo_download: $jobmixins.undo_download,

  //////////////////////////////////////////////////////////////////////////////

  local_do_sendOutboxMessages: $jobmixins.local_do_sendOutboxMessages,
  do_sendOutboxMessages: $jobmixins.do_sendOutboxMessages,
  check_sendOutboxMessages: $jobmixins.check_sendOutboxMessages,
  local_undo_sendOutboxMessages: $jobmixins.local_undo_sendOutboxMessages,
  undo_sendOutboxMessages: $jobmixins.undo_sendOutboxMessages,
  local_do_setOutboxSyncEnabled: $jobmixins.local_do_setOutboxSyncEnabled,

  // upgrade: perfom necessary upgrades when the db version changes

  local_do_upgradeDB: $jobmixins.local_do_upgradeDB,

  //////////////////////////////////////////////////////////////////////////////
  // purgeExcessMessages is a NOP for activesync

  local_do_purgeExcessMessages: function(op, doneCallback) {
    doneCallback(null);
  },

  do_purgeExcessMessages: function(op, doneCallback) {
    doneCallback(null);
  },

  check_purgeExcessMessages: function(op, doneCallback) {
    return 'idempotent';
  },

  local_undo_purgeExcessMessages: function(op, doneCallback) {
    doneCallback(null);
  },

  undo_purgeExcessMessages: function(op, doneCallback) {
    doneCallback(null);
  },

  //////////////////////////////////////////////////////////////////////////////
};

mix(ActiveSyncJobDriver.prototype, draftsJobs.draftsMixins);

}); // end define
;
/**
 * Implements the ActiveSync protocol for Hotmail and Exchange.
 **/

define(
  'activesync/account',[
    'logic',
    '../a64',
    '../accountmixins',
    '../mailslice',
    '../searchfilter',
    // We potentially create the synthetic inbox while offline, so this can't be
    // lazy-loaded.
    'activesync/codepages/FolderHierarchy',
    './folder',
    './jobs',
    '../util',
    '../db/folder_info_rep',
    'module',
    'require',
    'exports'
  ],
  function(
    logic,
    $a64,
    $acctmixins,
    $mailslice,
    $searchfilter,
    $FolderHierarchy,
    $asfolder,
    $asjobs,
    $util,
    $folder_info,
    $module,
    require,
    exports
  ) {


// Lazy loaded vars.
var $wbxml, $asproto, ASCP;

var bsearchForInsert = $util.bsearchForInsert;
var $FolderTypes = $FolderHierarchy.Enums.Type;
var DEFAULT_TIMEOUT_MS = exports.DEFAULT_TIMEOUT_MS = 30 * 1000;

/**
 * Randomly create a unique device id so that multiple devices can independently
 * synchronize without interfering with each other.  Our only goals are to avoid
 * needlessly providing fingerprintable data and avoid collisions with other
 * instances of ourself.  We're using Math.random over crypto.getRandomValues
 * since node does not have the latter right now and predictable values aren't
 * a concern.
 *
 * @return {String} An multi-character ASCII alphanumeric sequence.  (Probably
     10 or 11 digits.)
 */
exports.makeUniqueDeviceId = function() {
  return Math.random().toString(36).substr(2);
};

/**
 * Prototype-helper to wrap a method in a call to withConnection.  This exists
 * largely for historical reasons.  All actual lazy-loading happens within
 * withConnection.
 */
function lazyConnection(cbIndex, fn, failString) {
  return function lazyRun() {
    var args = Array.slice(arguments),
        errback = args[cbIndex],
        self = this;

    this.withConnection(errback, function () {
      fn.apply(self, args);
    }, failString);
  };
}

function ActiveSyncAccount(universe, accountDef, folderInfos, dbConn,
                           receiveProtoConn) {
  this.universe = universe;
  this.id = accountDef.id;
  this.accountDef = accountDef;
  this._db = dbConn;

  logic.defineScope(this, 'Account', { accountId: this.id,
                                       accountType: 'activesync' });

  if (receiveProtoConn) {
    this.conn = receiveProtoConn;
    this._attachLoggerToConnection(this.conn);
  }
  else {
    this.conn = null;
  }

  this.enabled = true;
  this.problems = [];
  this._alive = true;

  this.authenticatorId = accountDef.authenticatorId;
  this.syncEnable = accountDef.syncEnable;
  this.public = accountDef.public;

  this.credentials = accountDef.credentials;
  this.identities = accountDef.identities;

  this.folders = [];
  this._folderStorages = {};
  this._folderInfos = folderInfos;
  this._serverIdToFolderId = {};
  this._deadFolderIds = null;

  this._syncsInProgress = 0;
  this._lastSyncKey = null;
  this._lastSyncResponseWasEmpty = false;

  this.meta = folderInfos.$meta;
  this.mutations = folderInfos.$mutations;
  this.doReset = false;
  this.resetAccount = false;

  // Sync existing folders
  for (var folderId in folderInfos) {
    if (folderId[0] === '$')
      continue;
    var folderInfo = folderInfos[folderId];

    this._folderStorages[folderId] =
      new $mailslice.FolderStorage(this, folderId, folderInfo, this._db,
                                   $asfolder.ActiveSyncFolderSyncer);
    this._serverIdToFolderId[folderInfo.$meta.serverId] = folderId;
    this.folders.push(folderInfo.$meta);
  }

  this.folders.sort(function(a, b) { return a.path.localeCompare(b.path); });

  this._jobDriver = new $asjobs.ActiveSyncJobDriver(
                          this,
                          this._folderInfos.$mutationState);

  // Immediately ensure that we have any required local-only folders,
  // as those can be created even while offline.
  this.ensureEssentialOfflineFolders();

  // Mix in any fields common to all accounts.
  $acctmixins.accountConstructorMixin.call(
    this, /* receivePiece = */ this, /* sendPiece = */ this);
}

exports.Account = exports.ActiveSyncAccount = ActiveSyncAccount;
ActiveSyncAccount.prototype = {
  type: 'activesync',
  supportsServerFolders: true,
  toString: function asa_toString() {
    return '[ActiveSyncAccount: ' + this.id + ']';
  },

  /**
   * Manages connecting, and wiring up initial connection if it is not
   * initialized yet.
   */
  withConnection: function (errback, callback, failString) {
    // lazy load our dependencies if they haven't already been fetched.  This
    // occurs regardless of whether we have a connection already or not.  We
    // do this because the connection may have been passed-in to us as a
    // leftover of the account creation process.
    if (!$wbxml) {
      require(['wbxml', 'activesync/protocol', 'activesync/codepages'],
              function (_wbxml, _asproto, _ASCP) {
        $wbxml = _wbxml;
        $asproto = _asproto;
        ASCP = _ASCP;

        this.withConnection(errback, callback, failString);
      }.bind(this));
      return;
    }

    if (!this.conn) {
      var accountDef = this.accountDef;
      this.conn = new $asproto.Connection(accountDef.connInfo.deviceId,
          accountDef.connInfo.policyKey);
      this._attachLoggerToConnection(this.conn);
      this.conn.open(accountDef.connInfo.server,
                     accountDef.credentials.username,
                     accountDef.credentials.password);
      this.conn.timeout = DEFAULT_TIMEOUT_MS;
    }

    if (!this.conn.connected) {
      this.conn.connect(function(error) {
        if (error) {
          this._reportErrorIfNecessary(error);
          // If the error was HTTP 401 (bad user/pass), report it as
          // bad-user-or-pass so that account logic like
          // _cmd_clearAccountProblems knows whether or not to report
          // the error as user-serviceable.
          if (this._isBadUserOrPassError(error) && !failString) {
            failString = 'bad-user-or-pass';
          }
          errback(failString || 'unknown');
          return;
        }
        var policyKey = this.conn.policyKey;
        if (this.accountDef.connInfo.policyKey !== policyKey) {
          // update accountDef policyKey
          this.accountDef.connInfo.policyKey = policyKey;
          this.universe.saveAccountDef(this.accountDef);
        }
        callback();
      }.bind(this));
    } else {
      callback();
    }
  },

  _isBadUserOrPassError: function(error) {
    return (error &&
            error instanceof $asproto.HttpError &&
            error.status === 401);
  },

  /**
   * Reports the error to the user if necessary.
   */
  _reportErrorIfNecessary: function(error) {
    if (!error) {
      return;
    }

    if (this._isBadUserOrPassError(error)) {
      // prompt the user to try a different password
      this.universe.__reportAccountProblem(
        this, 'bad-user-or-pass', 'incoming');
    }
  },


  _attachLoggerToConnection: function(conn) {
    logic.defineScope(conn, 'ActiveSyncConnection',
                      { connectionId: logic.uniqueId() });
    if (!logic.isCensored) {
      conn.onmessage = this._onmessage_dangerous.bind(this, conn);
    } else {
      conn.onmessage = this._onmessage_safe.bind(this, conn);
    }
  },

  /**
   * Basic onmessage ActiveSync protocol logging function.  This does not
   * include user data and is intended for safe circular logging purposes.
   */
  _onmessage_safe: function onmessage(conn,
      type, special, xhr, params, extraHeaders, sentData, response) {
    if (type === 'options') {
      logic(conn, 'options', { special: special,
                               status: xhr.status,
                               response: response });
    }
    else {
      logic(conn, 'command', { type: type,
                               special: special,
                               status: xhr.status });
    }
  },

  /**
   * Dangerous onmessage ActiveSync protocol logging function.  This is
   * intended to log user data for unit testing purposes or very specialized
   * debugging only.
   */
  _onmessage_dangerous: function onmessage(conn,
      type, special, xhr, params, extraHeaders, sentData, response) {
    if (type === 'options') {
      logic(conn, 'options', { special: special,
                               status: xhr.status,
                               response: response });
    }
    else {
      var sentXML, receivedXML;
      if (sentData) {
        try {
          var sentReader = new $wbxml.Reader(new Uint8Array(sentData), ASCP);
          sentXML = sentReader.dump();
        }
        catch (ex) {
          sentXML = 'parse problem';
        }
      }
      if (response) {
        try {
          receivedXML = response.dump();
          response.rewind();
        }
        catch (ex) {
          receivedXML = 'parse problem';
        }
      }

      logic(conn, 'command', { type: type,
                               special: special,
                               status: xhr.status,
                               params: params,
                               extraHeaders: extraHeaders,
                               sentXML: sentXML,
                               receivedXML: receivedXML });
    }
  },

  toBridgeWire: function asa_toBridgeWire() {
    return {
      id: this.accountDef.id,
      name: this.accountDef.name,
      authenticatorId: this.accountDef.authenticatorId,
      label: this.accountDef.label,
      path: this.accountDef.name,
      type: this.accountDef.type,

      defaultPriority: this.accountDef.defaultPriority,

      enabled: this.enabled,
      problems: this.problems,

      syncRange: this.accountDef.syncRange,
      syncInterval: this.accountDef.syncInterval,
      notifyOnNew: this.accountDef.notifyOnNew,
      playSoundOnSend: this.accountDef.playSoundOnSend,

      syncEnable: this.accountDef.syncEnable,
      public: this.accountDef.public,

      identities: this.identities,

      credentials: {
        username: this.accountDef.credentials.username,
        password: this.accountDef.credentials.password,
      },

      servers: [
        {
          type: this.accountDef.type,
          connInfo: this.accountDef.connInfo
        },
      ]
    };
  },

  toBridgeFolder: function asa_toBridgeFolder() {
    return {
      id: this.accountDef.id,
      name: this.accountDef.name,
      path: this.accountDef.name,
      type: 'account',
    };
  },

  get numActiveConns() {
    return 0;
  },

  /**
   * Check that the account is healthy in that we can login at all.
   */
  checkAccount: function(callback) {
    // disconnect first so as to properly check credentials
    if (this.conn !== null) {
      if (this.conn.connected) {
        this.conn.disconnect();
      }
      this.conn = null;
    }
    this.withConnection(function(err) {
      callback(err);
    }, function() {
      callback();
    });
  },

  /**
   * We are being told that a synchronization pass completed, and that we may
   * want to consider persisting our state.
   */
  __checkpointSyncCompleted: function(callback, betterReason) {
    this.saveAccountState(null, callback, betterReason || 'checkpointSync');
  },

  shutdown: function asa_shutdown(callback) {
    if (callback)
      callback();
  },

  accountDeleted: function asa_accountDeleted() {
    this._alive = false;
    this.shutdown();
  },

  sliceFolderMessages: function asa_sliceFolderMessages(folderId,
                                                        bridgeHandle) {
    var storage = this._folderStorages[folderId],
        slice = new $mailslice.MailSlice(bridgeHandle, storage);

    storage.sliceOpenMostRecent(slice);
  },

  sortFolderMessages: function(folderId, bridgeHandle, fillSize) {
    var storage = this._folderStorages[folderId],
        slice = new $mailslice.MailSlice(bridgeHandle, storage, fillSize);

    storage.sliceOpenMostRecent(slice);
  },

  searchFolderMessages: function(folderId, bridgeHandle, phrase, whatToSearch) {
    var storage = this._folderStorages[folderId],
        slice = new $searchfilter.SearchSlice(bridgeHandle, storage, phrase,
                                              whatToSearch);
    storage.sliceOpenSearch(slice);
    return slice;
  },

  syncFolderList: lazyConnection(0, function asa_syncFolderList(callback) {
    var account = this;

    var fh = ASCP.FolderHierarchy.Tags;
    var w = new $wbxml.Writer('1.3', 1, 'UTF-8');
    w.stag(fh.FolderSync)
       .tag(fh.SyncKey, this.meta.syncKey)
     .etag();

    this.conn.postCommand(w, function(aError, aResponse) {
      var needGetPolicy = false;
      if (aError) {
        if (aError.status === 449) {
          needGetPolicy = true;
        } else {
          account._reportErrorIfNecessary(aError);
          callback(aError);
          return;
        }
      }
      var e = new $wbxml.EventParser();
      var deferredAddedFolders = [];
      var ace = ASCP.Common.Enums;
      var afe = ASCP.FolderHierarchy.Enums;

      e.addEventListener([fh.FolderSync, fh.Status], function(node) {
        var status = node.children[0].textContent;
        if (status !== afe.Status.Success) {
          if (status === ace.Status.PolicyRefresh ||
              status === ace.Status.InvalidPolicyKey ||
              needGetPolicy) {
            // Refresh policyKey if get the PolicyRefresh status from server
            console.log('Policy need refresh!!!');
            var self = account;
            account.conn.getPolicyKey(false, function(aError) {
              if (aError) {
                callback(aError);
                return;
              }

              self.conn.getPolicyKey(true, function(error) {
                if (error) {
                  callback(error);
                  return;
                }
                // update accountDef policyKey
                self.accountDef.connInfo.policyKey = self.conn.policyKey;
                self.universe.saveAccountDef(self.accountDef);
              });
            });
          } else if (status === ace.Status.RemoteWipeRequested) {
            // device wipe
            account.conn.deviceWipe(function(aError) {
              if (aError) {
                callback(aError);
              }
            });
          } else {
            // If get InvalidSyncKey from server, should delete items added
            // since last synchronization and return to synchronization key
            // zero (0).
            if (status === afe.Status.InvalidSyncKey) {
              account.resetAccount = true;
              account._clearAllFolders();
              account.meta.syncKey = '0';
            }
            aError = 'Sync folder list error, folder error status: ' + status;
            account._reportErrorIfNecessary(aError);
            callback(aError);
          }
        }
      });

      e.addEventListener([fh.FolderSync, fh.SyncKey], function(node) {
        account.meta.syncKey = node.children[0].textContent;
      });

      e.addEventListener([fh.FolderSync, fh.Changes,
                          [fh.Add, fh.Delete, fh.Update]], function(node) {
        var folder = {};
        for (var iter in Iterator(node.children)) {
          var child = iter[1];
          folder[child.localTagName] = child.children[0].textContent;
        }
        if (account.resetAccount && !account.doReset) {
          account.doReset = true;
        }

        if (node.tag === fh.Add) {
          if (!account._addedFolder(folder.ServerId, folder.ParentId,
                                    folder.DisplayName, folder.Type)) {
            deferredAddedFolders.push(folder);
          }
        } else {
          account._updateFolder(folder, node.tag === fh.Delete);
        }
      });

      try {
        e.run(aResponse);
      }
      catch (ex) {
        console.error('Error parsing FolderSync response:', ex, '\n',
                      ex.stack);
        callback('unknown');
        return;
      }

      // It's possible we got some folders in an inconvenient order (i.e. child
      // folders before their parents). Keep trying to add folders until we're
      // done.
      while (deferredAddedFolders.length) {
        var moreDeferredAddedFolders = [];
        for (var iter in Iterator(deferredAddedFolders)) {
          var folder = iter[1];
          if (!account._addedFolder(folder.ServerId, folder.ParentId,
                                    folder.DisplayName, folder.Type))
            moreDeferredAddedFolders.push(folder);
        }
        if (moreDeferredAddedFolders.length === deferredAddedFolders.length)
          throw new Error('got some orphaned folders');
        deferredAddedFolders = moreDeferredAddedFolders;
      }

      // Once we've synchonized the folder list, kick off another job
      // to check that we have all essential online folders. Once that
      // completes, we'll check to make sure our offline-only folders
      // (localdrafts, outbox) are in the right place according to
      // where this server stores other built-in folders.
      account.ensureEssentialOnlineFolders();
      account.normalizeFolderHierarchy();
      if (account.doReset) {
        account.resetAccount = false;
        account.doReset = false;
        account.universe.__notifyResetAccount(account);
      }

      console.log('Synced folder list');
      callback && callback(null);
    });
  }),

  // Map folder type numbers from ActiveSync to Gaia's types
  _folderTypes: {
     1: 'normal', // Generic
     2: 'inbox',  // DefaultInbox
     3: 'drafts', // DefaultDrafts
     4: 'trash',  // DefaultDeleted
     5: 'sent',   // DefaultSent
     6: 'normal', // DefaultOutbox
    12: 'normal', // Mail
  },

  /**
   * List of known junk folder names, taken from browserbox.js, and used to
   * infer folders that are junk folders based on their name since there is
   * no enumerated type representing junk folders.
   */
  _junkFolderNames: [
    'bulk mail', 'correo no deseado', 'courrier indésirable', 'istenmeyen',
    'istenmeyen e-posta', 'junk', 'levélszemét', 'nevyžiadaná pošta',
    'nevyžádaná pošta', 'no deseado', 'posta indesiderata', 'pourriel',
    'roskaposti', 'skräppost', 'spam', 'spamowanie', 'søppelpost',
    'thư rác', 'спам', 'דואר זבל', 'الرسائل العشوائية', 'هرزنامه', 'สแปม',
    '垃圾郵件', '垃圾邮件', '垃圾電郵'],

  /**
   * Update the internal database and notify the appropriate listeners when we
   * discover a new folder.
   *
   * @param {string} serverId A GUID representing the new folder
   * @param {string} parentServerId A GUID representing the parent folder, or
   *  '0' if this is a root-level folder
   * @param {string} displayName The display name for the new folder
   * @param {string} typeNum A numeric value representing the new folder's type,
   *   corresponding to the mapping in _folderTypes above
   * @param {string} forceType Force a string folder type for this folder.
   *   Used for synthetic folders like localdrafts.
   * @param {boolean} suppressNotification (optional) if true, don't notify any
   *   listeners of this addition
   * @return {object} the folderMeta if we added the folder, true if we don't
   *   care about this kind of folder, or null if we need to wait until later
   *   (e.g. if we haven't added the folder's parent yet)
   */
  _addedFolder: function asa__addedFolder(serverId, parentServerId, displayName,
                                          typeNum, forceType,
                                          suppressNotification) {
    if (!forceType && !(typeNum in this._folderTypes))
      return true; // Not a folder type we care about.

    var path = displayName;
    var parentFolderId = null;
    var depth = 0;
    if (parentServerId !== '0') {
      parentFolderId = this._serverIdToFolderId[parentServerId];
      // We haven't learned about the parent folder. Just return, and wait until
      // we do.
      if (parentFolderId === undefined)
        return null;
      var parent = this._folderInfos[parentFolderId];
      path = parent.$meta.path + '/' + path;
      depth = parent.$meta.depth + 1;
    }

    var useFolderType = this._folderTypes[typeNum];
    // Check if this looks like a junk folder based on its name/path.  (There
    // is no type for junk/spam folders, so this regrettably must be inferred
    // from the name.  At least for hotmail.com/outlook.com, it appears that
    // the name is "Junk" regardless of the locale in which the account is
    // created, but our current datapoint is one account created using the
    // Spanish locale.
    //
    // In order to avoid bad detections, we assume that the junk folder is
    // at the top-level or is only nested one level deep.
    if (depth < 2) {
      var normalizedName = displayName.toLowerCase();
      if (this._junkFolderNames.indexOf(normalizedName) !== -1) {
        useFolderType = 'junk';
      }
    }
    if (forceType) {
      useFolderType = forceType;
    }

    // Handle sentinel Inbox.
    if (typeNum === $FolderTypes.DefaultInbox) {
      var existingInboxMeta = this.getFirstFolderWithType('inbox');
      if (existingInboxMeta) {
        // Update the server ID to folder ID mapping.
        delete this._serverIdToFolderId[existingInboxMeta.serverId];
        this._serverIdToFolderId[serverId] = existingInboxMeta.id;

        // Update everything about the folder meta.
        existingInboxMeta.serverId = serverId;
        existingInboxMeta.name = displayName;
        existingInboxMeta.path = path;
        existingInboxMeta.depth = depth;
        return existingInboxMeta;
      }
    }

    var folderId = this.id + '/' + $a64.encodeInt(this.meta.nextFolderNum++);
    var folderInfo = this._folderInfos[folderId] = {
      $meta: $folder_info.makeFolderMeta({
        id: folderId,
        serverId: serverId,
        name: displayName,
        type: useFolderType,
        path: path,
        parentId: parentFolderId,
        depth: depth,
        lastSyncedAt: 0,
        syncKey: '0',
        version: $mailslice.FOLDER_DB_VERSION
      }),
      // any changes to the structure here must be reflected in _recreateFolder!
      $impl: {
        nextId: 0,
        nextHeaderBlock: 0,
        nextBodyBlock: 0,
      },
      accuracy: [],
      headerBlocks: [],
      bodyBlocks: [],
      serverIdHeaderBlockMapping: {},
    };

    console.log('Added folder ' + displayName + ' (' + folderId + ')');
    this._folderStorages[folderId] =
      new $mailslice.FolderStorage(this, folderId, folderInfo, this._db,
                                   $asfolder.ActiveSyncFolderSyncer);
    this._serverIdToFolderId[serverId] = folderId;

    var folderMeta = folderInfo.$meta;
    var idx = bsearchForInsert(this.folders, folderMeta, function(a, b) {
      return a.path.localeCompare(b.path);
    });
    this.folders.splice(idx, 0, folderMeta);

    if (!suppressNotification)
      this.universe.__notifyAddedFolder(this, folderMeta);

    return folderMeta;
  },

  _updateFolder: function(folder, bDelete) {
    let folderId = this._serverIdToFolderId[folder.ServerId];
    let folderMeta = this._folderInfos[folderId].$meta;
    let depFolders = [];
    let folders = [];
    let getSubFolders = (subFolder) => {
      let tempFolders = [];
      let tempFolder = null;
      for (let i = 0; i < depFolders.length; i++) {
        if (depFolders[i].depth > subFolder.depth) {
          if (depFolders[i].parentId !== subFolder.id) {
            tempFolders.push(depFolders[i]);
          } else {
            tempFolder = depFolders[i];
            folders.push(tempFolder);
          }
        }
        if (i === depFolders.length - 1 && tempFolder) {
          depFolders = tempFolders;
          getSubFolders(tempFolder);
        }
      }
    };

    for (let folderId in this._folderInfos) {
      if (this._folderInfos.hasOwnProperty(folderId)) {
        if (folderId[0] === '$') {
          continue;
        }
        let folderInfo = this._folderInfos[folderId];
        if (folderInfo.$meta.depth > folderMeta.depth) {
          if (folderInfo.$meta.parentId !== folderMeta.id) {
            depFolders.push(folderInfo.$meta);
          } else {
            folders.push(folderMeta);
            folders.push(folderInfo.$meta);
          }
        }
      }
    }

    if (folders.length > 0) {
      getSubFolders(folders[1]);
    } else {
      folders.push(folderMeta);
    }

    // Delete all related folders
    for (let i = folders.length - 1; i >= 0; i--) {
      this._deletedFolder(folders[i].serverId);
    }

    // Update new folders
    if (!bDelete) {
      // Add target folder first
      this._addedFolder(folder.ServerId, folder.ParentId,
                        folder.DisplayName, folder.Type);

      // Add all sub folders
      let parentServerId;
      for (let i = 1; i < folders.length; i++) {
        let serverId = folders[i].serverId;
        let parentId;
        let displayName = folders[i].name;
        let type = folders[i].type;

        if (i === 1) {
          parentId = folder.ServerId;
        } else {
          parentId = parentServerId;
        }
        parentServerId = serverId;
        this._addedFolder(serverId, parentId, displayName, type, type);
      }
    }
  },

  /**
   * Update the internal database and notify the appropriate listeners when we
   * find out a folder has been removed.
   *
   * @param {string} serverId A GUID representing the deleted folder
   * @param {boolean} suppressNotification (optional) if true, don't notify any
   *   listeners of this addition
   */
  _deletedFolder: function asa__deletedFolder(serverId, suppressNotification) {
    if (!serverId || !this._serverIdToFolderId[serverId]) {
      return;
    }
    var folderId = this._serverIdToFolderId[serverId],
        folderInfo = this._folderInfos[folderId],
        folderMeta = folderInfo.$meta;

    console.log('Deleted folder ' + folderMeta.name + ' (' + folderId + ')');
    delete this._serverIdToFolderId[serverId];
    delete this._folderInfos[folderId];
    delete this._folderStorages[folderId];

    var idx = this.folders.indexOf(folderMeta);
    this.folders.splice(idx, 1);

    if (this._deadFolderIds === null)
      this._deadFolderIds = [];
    this._deadFolderIds.push(folderId);

    if (!suppressNotification)
      this.universe.__notifyRemovedFolder(this, folderMeta);
  },

  _clearAllFolders: function asa__clearAllFolders() {
    let folders = [];
    let pushInFolders = (folderInfo) => {
      if (folders.length === 0) {
        folders.push(folderInfo);
      } else {
        for (let i = folders.length - 1; i >= 0; i--) {
          if (folderInfo.$meta.depth >= folders[i].$meta.depth) {
            folders.splice(i + 1, 0, folderInfo);
            break;
          }
        }
      }
    };

    for (let folderId in this._folderInfos) {
      if (this._folderInfos.hasOwnProperty(folderId)) {
        if (folderId[0] === '$') {
          continue;
        }
        pushInFolders(this._folderInfos[folderId]);
      }
    }

    for (let i = folders.length - 1; i >= 0; i--) {
      this._deletedFolder(folders[i].$meta.serverId);
    }
  },

  /**
   * Recreate the folder storage for a particular folder; useful when we end up
   * desyncing with the server and need to start fresh.  No notification is
   * generated, although slices are repopulated.
   *
   * FYI: There is a nearly identical method in IMAP's account implementation.
   *
   * @param {string} folderId the local ID of the folder
   * @param {function} callback a function to be called when the operation is
   *   complete, taking the new folder storage
   */
  _recreateFolder: function asa__recreateFolder(folderId, callback) {
    logic(this, 'recreateFolder', { folderId: folderId });
    var folderInfo = this._folderInfos[folderId];
    folderInfo.$impl = {
      nextId: 0,
      nextHeaderBlock: 0,
      nextBodyBlock: 0,
    };
    folderInfo.accuracy = [];
    folderInfo.headerBlocks = [];
    folderInfo.bodyBlocks = [];
    folderInfo.serverIdHeaderBlockMapping = {};

    if (this._deadFolderIds === null)
      this._deadFolderIds = [];
    this._deadFolderIds.push(folderId);

    var self = this;
    this.saveAccountState(null, function() {
      var newStorage =
        new $mailslice.FolderStorage(self, folderId, folderInfo, self._db,
                                     $asfolder.ActiveSyncFolderSyncer);
      for (var iter in Iterator(self._folderStorages[folderId]._slices)) {
        var slice = iter[1];
        slice._storage = newStorage;
        slice.reset();
        newStorage.sliceOpenMostRecent(slice);
      }
      self._folderStorages[folderId]._slices = [];
      self._folderStorages[folderId] = newStorage;

      callback(newStorage);
    }, 'recreateFolder');
  },

  /**
   * Create a folder that is the child/descendant of the given parent folder.
   * If no parent folder id is provided, we attempt to create a root folder.
   *
   * NOTE: This function is currently unused.  It might have been used for
   * testing at some point.  It will be used again someday but should not be
   * assumed to actually work when that day comes.
   *
   * @args[
   *   @param[parentFolderId String]
   *   @param[folderName]
   *   @param[containOnlyOtherFolders Boolean]{
   *     Should this folder only contain other folders (and no messages)?
   *     On some servers/backends, mail-bearing folders may not be able to
   *     create sub-folders, in which case one would have to pass this.
   *   }
   *   @param[callback @func[
   *     @args[
   *       @param[error @oneof[
   *         @case[null]{
   *           No error, the folder got created and everything is awesome.
   *         }
   *         @case['offline']{
   *           We are offline and can't create the folder.
   *         }
   *         @case['already-exists']{
   *           The folder appears to already exist.
   *         }
   *         @case['unknown']{
   *           It didn't work and we don't have a better reason.
   *         }
   *       ]]
   *       @param[folderMeta ImapFolderMeta]{
   *         The meta-information for the folder.
   *       }
   *     ]
   *   ]]{
   *   }
   * ]
   */
  createFolder: lazyConnection(3, function asa_createFolder(parentFolderId,
                                                      folderName,
                                                      containOnlyOtherFolders,
                                                      callback) {
    var account = this;

    var parentFolderServerId = parentFolderId ?
      this._folderInfos[parentFolderId] : '0';

    var fh = ASCP.FolderHierarchy.Tags;
    var fhStatus = ASCP.FolderHierarchy.Enums.Status;
    var folderType = ASCP.FolderHierarchy.Enums.Type.Mail;

    var w = new $wbxml.Writer('1.3', 1, 'UTF-8');
    w.stag(fh.FolderCreate)
       .tag(fh.SyncKey, this.meta.syncKey)
       .tag(fh.ParentId, parentFolderServerId)
       .tag(fh.DisplayName, folderName)
       .tag(fh.Type, folderType)
     .etag();

    this.conn.postCommand(w, function(aError, aResponse) {
      account._reportErrorIfNecessary(aError);

      var e = new $wbxml.EventParser();
      var status, serverId;

      e.addEventListener([fh.FolderCreate, fh.Status], function(node) {
        status = node.children[0].textContent;
        if (status === fhStatus.Success) {
          let folderMeta = account._addedFolder(serverId, parentFolderServerId,
              folderName, folderType);
          callback(null, folderMeta);
        } else if (status === fhStatus.FolderExists) {
          callback('already-exists');
        } else {
          callback('unknown');
        }
      });
      e.addEventListener([fh.FolderCreate, fh.SyncKey], function(node) {
        account.meta.syncKey = node.children[0].textContent;
      });
      e.addEventListener([fh.FolderCreate, fh.ServerId], function(node) {
        serverId = node.children[0].textContent;
      });

      try {
        e.run(aResponse);
      }
      catch (ex) {
        console.error('Error parsing FolderCreate response:', ex, '\n',
                      ex.stack);
        callback('unknown');
      }
    });
  }),

  /**
   * Delete an existing folder WITHOUT ANY ABILITY TO UNDO IT.  Current UX
   * does not desire this, but the unit tests do.
   *
   * Callback is like the createFolder one, why not.
   */
  deleteFolder: lazyConnection(1, function asa_deleteFolder(folderId,
                                                            callback) {
    var account = this;

    var folderMeta = this._folderInfos[folderId].$meta;

    var fh = ASCP.FolderHierarchy.Tags;
    var fhStatus = ASCP.FolderHierarchy.Enums.Status;
    var folderType = ASCP.FolderHierarchy.Enums.Type.Mail;

    var w = new $wbxml.Writer('1.3', 1, 'UTF-8');
    w.stag(fh.FolderDelete)
       .tag(fh.SyncKey, this.meta.syncKey)
       .tag(fh.ServerId, folderMeta.serverId)
     .etag();

    this.conn.postCommand(w, function(aError, aResponse) {
      account._reportErrorIfNecessary(aError);

      var e = new $wbxml.EventParser();
      var status;

      e.addEventListener([fh.FolderDelete, fh.Status], function(node) {
        status = node.children[0].textContent;
      });
      e.addEventListener([fh.FolderDelete, fh.SyncKey], function(node) {
        account.meta.syncKey = node.children[0].textContent;
      });

      try {

        e.run(aResponse);
      }
      catch (ex) {
        console.error('Error parsing FolderDelete response:', ex, '\n',
                      ex.stack);
        callback('unknown');
        return;
      }

      if (status === fhStatus.Success) {
        account._deletedFolder(folderMeta.serverId);
        callback(null, folderMeta);
      }
      else {
        callback('unknown');
      }
    });
  }),

  sendMessage: lazyConnection(1, function asa_sendMessage(composer, callback) {
    var account = this;

    // we want the bcc included because that's how we tell the server the bcc
    // results.
    composer.withMessageBlob({ includeBcc: true }, function(mimeBlob) {
      // ActiveSync 14.0 has a completely different API for sending email. Make
      // sure we format things the right way.
      if (this.conn.currentVersion.gte('14.0')) {
        var cm = ASCP.ComposeMail.Tags;
        var w = new $wbxml.Writer('1.3', 1, 'UTF-8', null, 'blob');
        w.stag(cm.SendMail)
           // The ClientId is defined to be for duplicate messages suppression
           // and does not need to have any uniqueness constraints apart from
           // not being similar to (recently sent) messages by this client.
           .tag(cm.ClientId, Date.now().toString()+'@mozgaia')
           .tag(cm.SaveInSentItems)
           .stag(cm.Mime)
             .opaque(mimeBlob)
           .etag()
         .etag();

        this.conn.postCommand(w, function(aError, aResponse) {
          if (aError) {
            account._reportErrorIfNecessary(aError);
            console.error(aError);
            callback('unknown');
            return;
          }

          if (aResponse === null) {
            console.log('Sent message successfully!');
            callback(null);
          }
          else {
            console.error('Error sending message. XML dump follows:\n' +
                          aResponse.dump());
            callback('unknown');
          }
        }, /* aExtraParams = */ null, /* aExtraHeaders = */ null,
          /* aProgressCallback = */ function() {
          // Keep holding the wakelock as we continue sending.
          composer.renewSmartWakeLock('ActiveSync XHR Progress');
        });
      }
      else { // ActiveSync 12.x and lower
        this.conn.postData('SendMail', 'message/rfc822', mimeBlob,
                           function(aError, aResponse) {
          if (aError) {
            account._reportErrorIfNecessary(aError);
            console.error(aError);
            callback('unknown');
            return;
          }

          console.log('Sent message successfully!');
          callback(null);
        }, { SaveInSent: 'T' }, /* aExtraHeaders = */ null,
          /* aProgressCallback = */ function() {
          // Keep holding the wakelock as we continue sending.
          composer.renewSmartWakeLock('ActiveSync XHR Progress');
        });
      }
    }.bind(this));
  }),

  getFolderStorageForFolderId: function asa_getFolderStorageForFolderId(
                               folderId) {
    return this._folderStorages[folderId];
  },

  getFolderStorageForServerId: function asa_getFolderStorageForServerId(
                               serverId) {
    return this._folderStorages[this._serverIdToFolderId[serverId]];
  },

  getFolderMetaForFolderId: function(folderId) {
    if (this._folderInfos.hasOwnProperty(folderId))
      return this._folderInfos[folderId].$meta;
    return null;
  },

  /**
   * Ensure that local-only folders exist. This runs synchronously
   * before we sync the folder list with the server. Ideally, these
   * folders should reside in a proper place in the folder hierarchy,
   * which may differ between servers depending on whether the
   * account's other folders live underneath the inbox or as
   * top-level-folders. But since moving folders is easy and doesn't
   * really affect the backend, we'll just ensure they exist here, and
   * fix up their hierarchical location when syncing the folder list.
   */
  ensureEssentialOfflineFolders: function() {
    // On folder type numbers: While there are enum values for outbox
    // and drafts, they represent server-side default folders, not the
    // local folders we create for ourselves, so they must be created
    // with an unknown typeNum.
    [{
      type: 'inbox',
      displayName: 'Inbox', // Intentionally title-case.
      typeNum: $FolderTypes.DefaultInbox,
    }, {
      type: 'outbox',
      displayName: 'outbox',
      typeNum: $FolderTypes.Unknown, // There is no "local outbox" typeNum.
    }, {
      type: 'localdrafts',
      displayName: 'localdrafts',
      typeNum: $FolderTypes.Unknown, // There is no "localdrafts" typeNum.
    }].forEach(function(data) {
      if (!this.getFirstFolderWithType(data.type)) {
        this._addedFolder(
          /* serverId: */ null,
          /* parentServerId: */ '0',
          /* displayName: */ data.displayName,
          /* typeNum: */ data.typeNum,
          /* forceType: */ data.type,
          /* suppressNotification: */ true);
      }
    }, this);
  },

  /**
   * Kick off jobs to create essential folders (sent, trash) if
   * necessary. These folders should be created on both the client and
   * the server; contrast with `ensureEssentialOfflineFolders`.
   *
   * TODO: Support localizing all automatically named e-mail folders
   * regardless of the origin locale.
   * Relevant bugs: <https://bugzil.la/905869>, <https://bugzil.la/905878>.
   *
   * @param {function} callback
   *   Called when all ops have run.
   */
  ensureEssentialOnlineFolders: function(callback) {
    // Our ActiveSync implementation currently assumes that all
    // ActiveSync servers always come with Sent and Trash folders. If
    // that assumption proves false, we'd add them here like IMAP.
    callback && callback();
  },

  /**
   * Ensure that local-only folders live in a reasonable place in the
   * folder hierarchy by moving them if necessary.
   *
   * We proactively create local-only folders at the root level before
   * we synchronize with the server; if possible, we want these
   * folders to reside as siblings to other system-level folders on
   * the account. This is called at the end of syncFolderList, after
   * we have learned about all existing server folders.
   */
  normalizeFolderHierarchy: $acctmixins.normalizeFolderHierarchy,

  scheduleMessagePurge: function(folderId, callback) {
    // ActiveSync servers have no incremental folder growth, so message purging
    // makes no sense for them.
    if (callback)
      callback();
  },

  upgradeFolderStoragesIfNeeded: $acctmixins.upgradeFolderStoragesIfNeeded,
  runOp: $acctmixins.runOp,
  getFirstFolderWithType: $acctmixins.getFirstFolderWithType,
  getFolderByPath: $acctmixins.getFolderByPath,
  saveAccountState: $acctmixins.saveAccountState,
  runAfterSaves: $acctmixins.runAfterSaves,

  allOperationsCompleted: function() {
  }
};

}); // end define
;
define('ext/md5',['require','exports','module'],function(require, exports, module) {

module.exports = function md5(data) {
  return hex_md5(data);
};

/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;   /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = "";  /* base-64 pad character. "=" for strict RFC compliance   */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_md5(s)    { return rstr2hex(rstr_md5(str2rstr_utf8(s))); }
function b64_md5(s)    { return rstr2b64(rstr_md5(str2rstr_utf8(s))); }
function any_md5(s, e) { return rstr2any(rstr_md5(str2rstr_utf8(s)), e); }
function hex_hmac_md5(k, d)
  { return rstr2hex(rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d))); }
function b64_hmac_md5(k, d)
  { return rstr2b64(rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d))); }
function any_hmac_md5(k, d, e)
  { return rstr2any(rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d)), e); }

/*
 * Perform a simple self-test to see if the VM is working
 */
function md5_vm_test()
{
  return hex_md5("abc").toLowerCase() == "900150983cd24fb0d6963f7d28e17f72";
}

/*
 * Calculate the MD5 of a raw string
 */
function rstr_md5(s)
{
  return binl2rstr(binl_md5(rstr2binl(s), s.length * 8));
}

/*
 * Calculate the HMAC-MD5, of a key and some data (raw strings)
 */
function rstr_hmac_md5(key, data)
{
  var bkey = rstr2binl(key);
  if(bkey.length > 16) bkey = binl_md5(bkey, key.length * 8);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
  return binl2rstr(binl_md5(opad.concat(hash), 512 + 128));
}

/*
 * Convert a raw string to a hex string
 */
function rstr2hex(input)
{
  try { hexcase } catch(e) { hexcase=0; }
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var output = "";
  var x;
  for(var i = 0; i < input.length; i++)
  {
    x = input.charCodeAt(i);
    output += hex_tab.charAt((x >>> 4) & 0x0F)
           +  hex_tab.charAt( x        & 0x0F);
  }
  return output;
}

/*
 * Convert a raw string to a base-64 string
 */
function rstr2b64(input)
{
  try { b64pad } catch(e) { b64pad=''; }
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var output = "";
  var len = input.length;
  for(var i = 0; i < len; i += 3)
  {
    var triplet = (input.charCodeAt(i) << 16)
                | (i + 1 < len ? input.charCodeAt(i+1) << 8 : 0)
                | (i + 2 < len ? input.charCodeAt(i+2)      : 0);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > input.length * 8) output += b64pad;
      else output += tab.charAt((triplet >>> 6*(3-j)) & 0x3F);
    }
  }
  return output;
}

/*
 * Convert a raw string to an arbitrary string encoding
 */
function rstr2any(input, encoding)
{
  var divisor = encoding.length;
  var i, j, q, x, quotient;

  /* Convert to an array of 16-bit big-endian values, forming the dividend */
  var dividend = Array(Math.ceil(input.length / 2));
  for(i = 0; i < dividend.length; i++)
  {
    dividend[i] = (input.charCodeAt(i * 2) << 8) | input.charCodeAt(i * 2 + 1);
  }

  /*
   * Repeatedly perform a long division. The binary array forms the dividend,
   * the length of the encoding is the divisor. Once computed, the quotient
   * forms the dividend for the next step. All remainders are stored for later
   * use.
   */
  var full_length = Math.ceil(input.length * 8 /
                                    (Math.log(encoding.length) / Math.log(2)));
  var remainders = Array(full_length);
  for(j = 0; j < full_length; j++)
  {
    quotient = Array();
    x = 0;
    for(i = 0; i < dividend.length; i++)
    {
      x = (x << 16) + dividend[i];
      q = Math.floor(x / divisor);
      x -= q * divisor;
      if(quotient.length > 0 || q > 0)
        quotient[quotient.length] = q;
    }
    remainders[j] = x;
    dividend = quotient;
  }

  /* Convert the remainders to the output string */
  var output = "";
  for(i = remainders.length - 1; i >= 0; i--)
    output += encoding.charAt(remainders[i]);

  return output;
}

/*
 * Encode a string as utf-8.
 * For efficiency, this assumes the input is valid utf-16.
 */
function str2rstr_utf8(input)
{
  var output = "";
  var i = -1;
  var x, y;

  while(++i < input.length)
  {
    /* Decode utf-16 surrogate pairs */
    x = input.charCodeAt(i);
    y = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
    if(0xD800 <= x && x <= 0xDBFF && 0xDC00 <= y && y <= 0xDFFF)
    {
      x = 0x10000 + ((x & 0x03FF) << 10) + (y & 0x03FF);
      i++;
    }

    /* Encode output as utf-8 */
    if(x <= 0x7F)
      output += String.fromCharCode(x);
    else if(x <= 0x7FF)
      output += String.fromCharCode(0xC0 | ((x >>> 6 ) & 0x1F),
                                    0x80 | ( x         & 0x3F));
    else if(x <= 0xFFFF)
      output += String.fromCharCode(0xE0 | ((x >>> 12) & 0x0F),
                                    0x80 | ((x >>> 6 ) & 0x3F),
                                    0x80 | ( x         & 0x3F));
    else if(x <= 0x1FFFFF)
      output += String.fromCharCode(0xF0 | ((x >>> 18) & 0x07),
                                    0x80 | ((x >>> 12) & 0x3F),
                                    0x80 | ((x >>> 6 ) & 0x3F),
                                    0x80 | ( x         & 0x3F));
  }
  return output;
}

/*
 * Encode a string as utf-16
 */
function str2rstr_utf16le(input)
{
  var output = "";
  for(var i = 0; i < input.length; i++)
    output += String.fromCharCode( input.charCodeAt(i)        & 0xFF,
                                  (input.charCodeAt(i) >>> 8) & 0xFF);
  return output;
}

function str2rstr_utf16be(input)
{
  var output = "";
  for(var i = 0; i < input.length; i++)
    output += String.fromCharCode((input.charCodeAt(i) >>> 8) & 0xFF,
                                   input.charCodeAt(i)        & 0xFF);
  return output;
}

/*
 * Convert a raw string to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */
function rstr2binl(input)
{
  var output = Array(input.length >> 2);
  for(var i = 0; i < output.length; i++)
    output[i] = 0;
  for(var i = 0; i < input.length * 8; i += 8)
    output[i>>5] |= (input.charCodeAt(i / 8) & 0xFF) << (i%32);
  return output;
}

/*
 * Convert an array of little-endian words to a string
 */
function binl2rstr(input)
{
  var output = "";
  for(var i = 0; i < input.length * 32; i += 8)
    output += String.fromCharCode((input[i>>5] >>> (i % 32)) & 0xFF);
  return output;
}

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */
function binl_md5(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);
}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

});

/**
 * Configurator for activesync
 **/

define(
  'activesync/configurator',[
    'logic',
    '../accountcommon',
    '../a64',
    './account',
    '../date',
    '../ext/md5',
    'tcp-socket',
    'require',
    'exports'
  ],
  function(
    logic,
    $accountcommon,
    $a64,
    $asacct,
    $date,
    $md5,
    tcpSocket,
    require,
    exports
  ) {

function checkServerCertificate(url, callback) {
  var match = /^https:\/\/([^:/]+)(?::(\d+))?/.exec(url);
  // probably unit test http case?
  if (!match) {
    callback(null);
    return;
  }
  var port = match[2] ? parseInt(match[2], 10) : 443,
      host = match[1];

  console.log('checking', host, port, 'for security problem');

  var sock = tcpSocket.open(host, port);
  function reportAndClose(err) {
    if (sock) {
      var wasSock = sock;
      sock = null;
      try {
        wasSock.close();
      }
      catch (ex) {
      }
      callback(err);
    }
  }
  // this is a little dumb, but since we don't actually get an event right now
  // that tells us when our secure connection is established, and connect always
  // happens, we write data when we connect to help trigger an error or have us
  // receive data to indicate we successfully connected.
  // so, the deal is that connect is going to happen.
  sock.onopen = function() {
    sock.send(
      new TextEncoder('utf-8').encode('GET /images/logo.png HTTP/1.1\n\n'));
  };
  sock.onerror = function(evt) {
    var err = evt.data || evt;
    var reportErr = null;
    if (err && typeof(err) === 'object' &&
        err.name === 'NetworkError')
      reportErr = 'bad-security';
    reportAndClose(reportErr);
  };
  sock.ondata = function(data) {
    reportAndClose(null);
  };
}

var scope = logic.scope('ActivesyncConfigurator');

exports.account = $asacct;
exports.configurator = {
  timeout: 30 * 1000,
  _getFullDetailsFromAutodiscover: function($asproto, userDetails,
                                            autoDiscoverEndpoint,
                                            callback) {
    logic(scope, 'autodiscover:begin', { server: '' });

    var autoDiscoverResult = function(error, config) {
      if (error) {
        var failureType = 'no-config-info',
            failureDetails = {};

        if (error instanceof $asproto.HttpError) {
          if (error.status === 401)
            failureType = 'bad-user-or-pass';
          else if (error.status === 403)
            failureType = 'not-authorized';
          else
            failureDetails.status = error.status;
        }
        else if (error instanceof $asproto.AutodiscoverDomainError) {
          logic(scope, 'autodiscover.error', { message: error.message });
        }
        logic(scope, 'autodiscover:end', { err: failureType });
        callback(failureType, null, failureDetails);
        return;
      }
      logic(scope, 'autodiscover:end', { server: config.mobileSyncServer.url });

      var autoconfig = {
        type: 'activesync',
        displayName: config.user.name,
        incoming: {
          server: config.mobileSyncServer.url,
          username: config.user.email
        }
      };
      callback(null, autoconfig, null);
    };

    if (autoDiscoverEndpoint.length > 1) {
      $asproto.autodiscover(userDetails.emailAddress, userDetails.password,
          self.timeout, autoDiscoverResult, false);
    } else {
      $asproto.raw_autodiscover(autoDiscoverEndpoint, userDetails.emailAddress,
          userDetails.password, self.timeout, false, autoDiscoverResult);
    }
  },

  /**
   * There are 2 scenarios we can get invoked with:
   * - Direct creation.  We already know the ActiveSync endpoint.  This happens
   *   from a hardcoded (for testing) or local (hotmail.com/outlook.com)
   *   autoconfig entry OR from a user typing that stuff in manually.
   *
   * - Indirection creation.  We just know an AutoDiscover endpoing and need
   *   to run AutoDiscover.  If our autoconfig process probed and found some
   *   AutoDiscover looking endpoints, that's how we end up here.  It's also
   *   conceivable that in the future the manual config mode could use this
   *   path.
   */
  tryToCreateAccount: function(universe, userDetails, domainInfo, callback) {
    require(['activesync/protocol'], function ($asproto) {
      if (domainInfo.incoming.autodiscoverEndpoint) {
        this._getFullDetailsFromAutodiscover(
          $asproto, userDetails, domainInfo.incoming.autodiscoverEndpoint,
          function(err, fullConfigInfo, errDetails) {
            // If we got an error, pass it directly back.
            if (err) {
              callback(err, fullConfigInfo, errDetails);
              return;
            }
            // Otherwise we have a config and should continue the creation
            // process.
            this._createAccountUsingFullInfo(
              universe, userDetails, fullConfigInfo, callback, $asproto);
          }.bind(this));
        return;
      }
      // We should have full config info then.  Just call direct in.
      this._createAccountUsingFullInfo(universe, userDetails, domainInfo,
                                       callback, $asproto);
    }.bind(this));
  },

  _createAccountUsingFullInfo: function(universe, userDetails, domainInfo,
                                        callback, $asproto) {
    logic(scope, 'create:begin', { server: domainInfo.incoming.server });
    var credentials = {
      username: domainInfo.incoming.username,
      password: userDetails.password
    };

    var deviceId = domainInfo.incoming.deviceId || $md5(userDetails.deviceId);
    var policyKey = domainInfo.incoming.policyKey;

    var self = this;
    var conn = new $asproto.Connection(deviceId, policyKey, userDetails.emailAddress);
    conn.open(domainInfo.incoming.server, credentials.username,
              credentials.password);
    conn.timeout = $asacct.DEFAULT_TIMEOUT_MS;

    conn.connect(function(error, options) {
      if (error) {
        // This error is basically an indication of whether we were able to
        // call getOptions or not.  If the XHR request completed, we get an
        // HttpError.  If we timed out or an XHR error occurred, we get a
        // general Error.
        var failureType,
            failureDetails = { server: domainInfo.incoming.server };

        if (error instanceof $asproto.HttpError) {
          if (error.status === 401) {
            failureType = 'bad-user-or-pass';
          }
          else if (error.status === 403) {
            failureType = 'not-authorized';
          }
          // Treat any other errors where we talked to the server as a problem
          // with the server.
          else {
            failureType = 'server-problem';
            failureDetails.status = error.status;
          }
        }
        else {
          // We didn't talk to the server, so it's either an unresponsive
          // server or a server with a bad certificate.  (We require https
          // outside of unit tests so there's no need to branch here.)
          checkServerCertificate(
            domainInfo.incoming.server,
            function(securityError) {
              var failureType;
              if (securityError)
                failureType = 'bad-security';
              else
                failureType = 'unresponsive-server';
              callback(failureType, null, failureDetails);
            });
          return;
        }
        logic(scope, 'create:end', {
          server: domainInfo.incoming.server,
          err: failureType
        });

        callback(failureType, null, failureDetails);
        return;
      }

      var accountId = $a64.encodeInt(universe.config.nextAccountNum++);
      var accountDef = {
        id: accountId,
        name: userDetails.accountName || userDetails.emailAddress,
        authenticatorId: userDetails.authenticatorId || 'activesync',
        label: userDetails.label ||
               userDetails.emailAddress.split('@')[1].split('.')[0],
        defaultPriority: $date.NOW(),

        type: 'activesync',
        syncRange: 'auto',

        syncInterval: userDetails.syncInterval || 0,
        notifyOnNew: userDetails.hasOwnProperty('notifyOnNew') ?
                     userDetails.notifyOnNew : true,
        playSoundOnSend: userDetails.hasOwnProperty('playSoundOnSend') ?
                     userDetails.playSoundOnSend : true,

        syncEnable: true,
        public: false,

        credentials: credentials,
        connInfo: {
          server: domainInfo.incoming.server,
          deviceId: deviceId,
          policyKey: conn.policyKey
        },

        identities: [
          {
            id: accountId + '/' +
                $a64.encodeInt(universe.config.nextIdentityNum++),
            name: userDetails.displayName || domainInfo.displayName,
            address: userDetails.emailAddress,
            replyTo: null,
            signature: null
          }
        ]
      };

      logic(scope, 'create:end', {
        server: domainInfo.incoming.server,
        id: accountId
      });

      self._loadAccount(universe, accountDef, conn, function (account) {
        callback(null, account, null);
      });
    });
  },

  recreateAccount: function cfg_as_ra(universe, oldVersion, oldAccountInfo,
                                      callback) {
    var oldAccountDef = oldAccountInfo.def;
    var credentials = {
      username: oldAccountDef.credentials.username,
      password: oldAccountDef.credentials.password,
    };
    var accountId = $a64.encodeInt(universe.config.nextAccountNum++);
    var accountDef = {
      id: accountId,
      name: oldAccountDef.name,
      authenticatorId: oldAccountDef.authenticatorId,
      label: oldAccountDef.label,

      type: 'activesync',
      syncRange: oldAccountDef.syncRange,
      syncInterval: oldAccountDef.syncInterval || 0,
      notifyOnNew: oldAccountDef.hasOwnProperty('notifyOnNew') ?
                   oldAccountDef.notifyOnNew : true,
      playSoundOnSend: oldAccountDef.hasOwnProperty('playSoundOnSend') ?
                   oldAccountDef.playSoundOnSend : true,

      syncEnable: oldAccountDef.hasOwnProperty('syncEnable') ?
                  oldAccountDef.syncEnable : true,
      public: oldAccountDef.hasOwnProperty('public') ?
              oldAccountDef.public : false,

      credentials: credentials,
      connInfo: {
        server: oldAccountDef.connInfo.server,
        deviceId: oldAccountDef.connInfo.deviceId,
        policyKey: oldAccountDef.connInfo.policyKey
      },

      identities: $accountcommon.recreateIdentities(universe, accountId,
                                     oldAccountDef.identities)
    };

    this._loadAccount(universe, accountDef, null, function (account) {
      callback(null, account, null);
    });
  },

  /**
   * Save the account def and folder info for our new (or recreated) account and
   * then load it.
   */
  _loadAccount: function cfg_as__loadAccount(universe, accountDef,
                                             protoConn, callback) {
    var canceledAddress = universe.getNeedCancelAccount();
    if (canceledAddress && canceledAddress === accountDef.name) {
      console.log('Cancel setup this account(account name: ' +
                  accountDef.name + ')!!!');
      universe.resetNeedCancelAccount();
      return;
    }
    // XXX: Just reload the old folders when applicable instead of syncing the
    // folder list again, which is slow.
    var folderInfo = {
      $meta: {
        nextFolderNum: 0,
        nextMutationNum: 0,
        lastFolderSyncAt: 0,
        syncKey: '0'
      },
      $mutations: [],
      $mutationState: {}
    };
    universe.saveAccountDef(accountDef, folderInfo);
    universe._loadAccount(accountDef, folderInfo, protoConn, callback);
  }
};

}); // end define
;