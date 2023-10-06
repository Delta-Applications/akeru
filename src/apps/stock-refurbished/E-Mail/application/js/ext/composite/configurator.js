
/**
 * Error-handling/backoff logic.
 *
 * - All existing-account network-accessing functionality uses this module to
 *   track the state of accounts and resources within accounts that are may
 *   experience some type of time-varying failures.
 * - Account autoconfiguration probing logic does not use this module; it just
 *   checks whether there is a network connection.
 *
 * - Accounts define 'endpoints' with us when they are instantiated for each
 *   server connection type they have.  For IMAP, this means an SMTP endpoint
 *   and an IMAP endpoint.
 * - These 'endpoints' may have internal 'resources' which may manifest failures
 *   of their own if-and-only-if it is expected that there could be transient
 *   failures within the endpoint.  For IMAP, it is possible for IMAP servers to
 *   not let us into certain folders because there are other active connections
 *   inside them.  If something can't fail, there is no need to name it as a
 *   resource.
 *
 * - All endpoints have exactly one status: 'healthy', 'unreachable', or
 *   'broken'.  Unreachable implies we are having trouble talking with the
 *   endpoint because of network issues.  Broken implies that although we can
 *   talk to the endpoint, it doesn't want to talk to us for reasons of being
 *   offline for maintenance or account migration or something like that.
 * - Endpoint resources can only be 'broken' and are only tracked if they are
 *   broken.
 *
 * - If we encounter a network error for an otherwise healthy endpoint then we
 *   try again once right away, as a lot of network errors only become evident
 *   once we have a new, good network.
 * - On subsequent network errors for the previously healthy endpoint where we
 *   have already retried, we try after a ~1 second delay and then a ~5 second
 *   delay.  Then we give up and put the endpoint in the unreachable or broken
 *   state, as appropriate.  These choice of delays are entirely arbitrary.
 *
 * - We only try once to connect to endpoints that are in a degraded state.  We
 *   do not retry because that would be wasteful.
 *
 * - Once we put an endpoint in a degraded (unreachable or broken) state, this
 *   module never does anything to try and probe for the endpoint coming back
 *   on its own.  We rely on the existing periodic synchronization logic or
 *   user actions to trigger a new attempt.  WE MAY NEED TO CHANGE THIS AT
 *   SOME POINT since it's possible that the user may have queued an email for
 *   sending that they want delivered sooner than the cron logic triggers, but
 *   that's way down the road.
 **/

define(
  'errbackoff',[
    './date',
    'logic',
    'module',
    'exports'
  ],
  function(
    $date,
    logic,
    $module,
    exports
  ) {

var BACKOFF_DURATIONS = exports.BACKOFF_DURATIONS = [
  { fixedMS: 0,    randomMS: 0 },
  { fixedMS: 800,  randomMS: 400 },
  { fixedMS: 4500, randomMS: 1000 },
];

var BAD_RESOURCE_RETRY_DELAYS_MS = [
  1000,
  60 * 1000,
  2 * 60 * 1000,
];

var setTimeoutFunc = window.setTimeout.bind(window);

exports.TEST_useTimeoutFunc = function(func) {
  setTimeoutFunc = func;
  for (var i = 0; i < BACKOFF_DURATIONS.length; i++) {
    BACKOFF_DURATIONS[i].randomMS = 0;
  }
};

/**
 * @args[
 *   @param[listener @dict[
 *     @key[onEndpointStateChange @func[
 *       @args[state]
 *     ]]
 *   ]]
 * ]
 */
function BackoffEndpoint(name, listener) {
  /** @oneof[
   *    @case['healthy']
   *    @case['unreachable']
   *    @case['broken']
   *    @case['shutdown']{
   *      We are shutting down; ignore any/all errors and avoid performing
   *      activities that would result in new network traffic, etc.
   *    }
   *  ]
   */
  this.state = 'healthy';
  this._iNextBackoff = 0;

  logic.defineScope(this, 'BackoffEndpoint', { name: name });

  logic(this, 'state', { state: this.state });

  this._badResources = {};

  this.listener = listener;
}
BackoffEndpoint.prototype = {
  _setState: function(newState) {
    if (this.state === newState)
      return;
    this.state = newState;
    logic(this, 'state', { state: newState });
    if (this.listener)
      this.listener.onEndpointStateChange(newState);
  },

  noteConnectSuccess: function() {
    this._setState('healthy');
    this._iNextBackoff = 0;
  },

  /**
   * Logs a connection failure and returns true if a retry attempt should be
   * made.
   *
   * @args[
   *   @param[reachable Boolean]{
   *     If true, we were able to connect to the endpoint, but failed to login
   *     for some reason.
   *   }
   * ]
   * @return[shouldRetry Boolean]{
   *   Returns true if we should retry creating the connection, false if we
   *   should give up.
   * }
   */
  noteConnectFailureMaybeRetry: function(reachable) {
    logic(this, 'connectFailure', { reachable: reachable });
    if (this.state === 'shutdown')
      return false;

    if (reachable) {
      this._setState('broken');
      return false;
    }

    if (this._iNextBackoff > 0)
      this._setState(reachable ? 'broken' : 'unreachable');

    // (Once this saturates, we never perform retries until the connection is
    // healthy again.  We do attempt re-connections when triggered by user
    // activity or synchronization logic; they just won't get retries.)
    if (this._iNextBackoff >= BACKOFF_DURATIONS.length)
      return false;

    return true;
  },

  /**
   * Logs a connection problem where we can talk to the server but we are
   * confident there is no reason retrying.  In some cases, like bad
   * credentials, this is part of what you want to do, but you will still also
   * want to put the kibosh on additional requests at a higher level since
   * servers can lock people out if they make repeated bad authentication
   * requests.
   */
  noteBrokenConnection: function() {
    logic(this, 'connectFailure', { reachable: true });
    this._setState('broken');

    this._iNextBackoff = BACKOFF_DURATIONS.length;
  },

  scheduleConnectAttempt: function(connectFunc) {
    if (this.state === 'shutdown')
      return;

    // If we have already saturated our retries then there won't be any
    // automatic retries and this request is assumed to want us to try and
    // create a connection right now.
    if (this._iNextBackoff >= BACKOFF_DURATIONS.length) {
      connectFunc();
      return;
    }

    var backoff = BACKOFF_DURATIONS[this._iNextBackoff++],
        delay = backoff.fixedMS +
                Math.floor(Math.random() * backoff.randomMS);
    setTimeoutFunc(connectFunc, delay);
  },

  noteBadResource: function(resourceId) {
    var now = $date.NOW();
    if (!this._badResources.hasOwnProperty(resourceId)) {
      this._badResources[resourceId] = { count: 1, last: now };
    }
    else {
      var info = this._badResources[resourceId];
      info.count++;
      info.last = now;
    }
  },

  resourceIsOkayToUse: function(resourceId) {
    if (!this._badResources.hasOwnProperty(resourceId))
      return true;
    var info = this._badResources[resourceId], now = $date.NOW();
  },

  shutdown: function() {
    this._setState('shutdown');
  },
};

exports.createEndpoint = function(name, listener) {
  return new BackoffEndpoint(name, listener);
};

}); // end define
;
define('composite/incoming',[
  'logic', '../a64', '../accountmixins', '../mailslice',
  '../searchfilter', '../util', '../db/folder_info_rep', 'require', 'exports'],
  function(logic, $a64, $acctmixins, $mailslice,
  $searchfilter, $util, $folder_info, require, exports) {

var bsearchForInsert = $util.bsearchForInsert;

function cmpFolderPubPath(a, b) {
  return a.path.localeCompare(b.path);
}

/**
 * A base class for IMAP and POP accounts.
 *
 * A lot of the functionality related to handling folders,
 * orchestrating jobs, etc., is common to both IMAP and POP accounts.
 * This class factors out the common functionality, allowing the
 * ImapAccount and Pop3Account classes to only provide
 * protocol-specific code.
 *
 * @param {Class} FolderSyncer The class to instantiate for folder sync.
 *
 * The rest of the parameters match those passed to Pop3Account and
 * ImapAccount.
 */
function CompositeIncomingAccount(
      FolderSyncer,
      universe, compositeAccount, accountId, credentials,
      connInfo, folderInfos, dbConn, existingProtoConn) {

  this.universe = universe;
  this.compositeAccount = compositeAccount;
  this.id = accountId;
  this.accountDef = compositeAccount.accountDef;
  this.enabled = true;
  this._alive = true;
  this._credentials = credentials;
  this._connInfo = connInfo;
  this._db = dbConn;

  // Yes, the pluralization is suspect, but unambiguous.
  /** @dictof[@key[FolderId] @value[FolderStorage] */
  var folderStorages = this._folderStorages = {};
  /** @dictof[@key[FolderId] @value[FolderMeta] */
  var folderPubs = this.folders = [];

  // This is a class, not an instance, hence the camel case.
  this.FolderSyncer = FolderSyncer;

  /**
   * The list of dead folder id's that we need to nuke the storage for when
   * we next save our account status to the database.
   */
  this._deadFolderIds = null;

  /**
   * The canonical folderInfo object we persist to the database.
   */
  this._folderInfos = folderInfos;
  /**
   * @dict[
   *   @param[nextFolderNum Number]{
   *     The next numeric folder number to be allocated.
   *   }
   *   @param[nextMutationNum Number]{
   *     The next mutation id to be allocated.
   *   }
   *   @param[lastFolderSyncAt DateMS]{
   *     When was the last time we ran `syncFolderList`?
   *   }
   *   @param[capability @listof[String]]{
   *     The post-login capabilities from the server.
   *   }
   *   @param[overflowMap @dictof[
   *     @key[uidl String]
   *     @value[@dict[
   *       @key[size Number]
   *     ]]
   *   ]]{
   *     The list of messages that will NOT be downloaded by a sync
   *     automatically, but instead need to be fetched with a "Download
   *     more messages..." operation. (POP3 only.)
   *   }
   *   @param[uidlMap @dictof[
   *     @key[uidl String]
   *     @value[headerID String]
   *   ]]{
   *     A mapping of UIDLs to message header IDs. (POP3 only.)
   *   }
   * ]{
   *   Meta-information about the account derived from probing the account.
   *   This information gets flushed on database upgrades.
   * }
   */
  this.meta = this._folderInfos.$meta;
  /**
   * @listof[SerializedMutation]{
   *   The list of recently issued mutations against us.  Mutations are added
   *   as soon as they are requested and remain until evicted based on a hard
   *   numeric limit.  The limit is driven by our unit tests rather than our
   *   UI which currently only allows a maximum of 1 (high-level) undo.  The
   *   status of whether the mutation has been run is tracked on the mutation
   *   but does not affect its presence or position in the list.
   *
   *   Right now, the `MailUniverse` is in charge of this and we just are a
   *   convenient place to stash the data.
   * }
   */
  this.mutations = this._folderInfos.$mutations;
  for (var folderId in folderInfos) {
    if (folderId[0] === '$')
      continue;
    var folderInfo = folderInfos[folderId];

    folderStorages[folderId] =
      new $mailslice.FolderStorage(this, folderId, folderInfo, this._db,
                                   FolderSyncer);
    folderPubs.push(folderInfo.$meta);
  }
  this.folders.sort(function(a, b) {
    return a.path.localeCompare(b.path);
  });

  // Ensure we have an inbox.  This is a folder that must exist with a standard
  // name, so we can create it without talking to the server.
  var inboxFolder = this.getFirstFolderWithType('inbox');
  if (!inboxFolder) {
    this._learnAboutFolder('INBOX', 'INBOX', null, 'inbox', '/', 0, true);
  }
}
exports.CompositeIncomingAccount = CompositeIncomingAccount;
CompositeIncomingAccount.prototype = {
  ////////////////////////////////////////////////////////////////
  // ACCOUNT OVERRIDES
  runOp: $acctmixins.runOp,
  getFirstFolderWithType: $acctmixins.getFirstFolderWithType,
  getFolderByPath: $acctmixins.getFolderByPath,
  saveAccountState: $acctmixins.saveAccountState,
  runAfterSaves: $acctmixins.runAfterSaves,

  /**
   * Make a given folder known to us, creating state tracking instances, etc.
   *
   * @param {Boolean} suppressNotification
   *   Don't report this folder to subscribed slices.  This is used in cases
   *   where the account has not been made visible to the front-end yet and/or
   *   syncFolderList hasn't yet run, but something subscribed to the "all
   *   accounts" unified folder slice could end up seeing something before it
   *   should.  This is a ret-con'ed comment, so maybe do some auditing before
   *   adding new call-sites that use this, especially if it's not used for
   *   offline-only folders at account creation/app startup.
   */
  _learnAboutFolder: function(name, path, parentId, type, delim, depth,
                              suppressNotification) {
    var folderId = this.id + '/' + $a64.encodeInt(this.meta.nextFolderNum++);
    var folderInfo = this._folderInfos[folderId] = {
      $meta: $folder_info.makeFolderMeta({
        id: folderId,
        name: name,
        type: type,
        path: path,
        parentId: parentId,
        delim: delim,
        depth: depth,
        lastSyncedAt: 0,
        version: $mailslice.FOLDER_DB_VERSION
      }),
      $impl: {
        nextId: 0,
        nextHeaderBlock: 0,
        nextBodyBlock: 0,
      },
      accuracy: [],
      headerBlocks: [],
      bodyBlocks: [],
      serverIdHeaderBlockMapping: null, // IMAP/POP3 does not need the mapping
    };
    this._folderStorages[folderId] =
      new $mailslice.FolderStorage(this, folderId, folderInfo, this._db,
                                   this.FolderSyncer);

    var folderMeta = folderInfo.$meta;
    var idx = bsearchForInsert(this.folders, folderMeta, cmpFolderPubPath);
    this.folders.splice(idx, 0, folderMeta);

    if (!suppressNotification)
      this.universe.__notifyAddedFolder(this, folderMeta);
    return folderMeta;
  },

  _forgetFolder: function(folderId, suppressNotification) {
    var folderInfo = this._folderInfos[folderId],
        folderMeta = folderInfo.$meta;
    delete this._folderInfos[folderId];
    var folderStorage = this._folderStorages[folderId];
    delete this._folderStorages[folderId];
    var idx = this.folders.indexOf(folderMeta);
    this.folders.splice(idx, 1);
    if (this._deadFolderIds === null)
      this._deadFolderIds = [];
    this._deadFolderIds.push(folderId);
    folderStorage.youAreDeadCleanupAfterYourself();

    if (!suppressNotification)
      this.universe.__notifyRemovedFolder(this, folderMeta);
  },

  /**
   * Completely reset the state of a folder.  For use by unit tests and in the
   * case of UID validity rolls.  No notification is generated, although slices
   * are repopulated.
   *
   * FYI: There is a nearly identical method in ActiveSync's account
   * implementation.
   */
  _recreateFolder: function(folderId, callback) {
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

    if (this._deadFolderIds === null)
      this._deadFolderIds = [];
    this._deadFolderIds.push(folderId);

    var self = this;
    this.saveAccountState(null, function() {
      var newStorage =
        new $mailslice.FolderStorage(self, folderId, folderInfo, self._db,
                                     self.FolderSyncer);
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
   * We are being told that a synchronization pass completed, and that we may
   * want to consider persisting our state.
   */
  __checkpointSyncCompleted: function(callback, betterReason) {
    this.saveAccountState(null, callback, betterReason || 'checkpointSync');
  },

  /**
   * Delete an existing folder WITHOUT ANY ABILITY TO UNDO IT. Current
   * UX does not desire this, but the unit tests do.
   *
   * XXX: This is not quite right for POP3; address when we expose
   * deleting folders to the UI when we need to create jobs too.
   *
   * Callback is like the createFolder one, why not.
   */
  deleteFolder: function(folderId, callback) {
    if (!this._folderInfos.hasOwnProperty(folderId))
      throw new Error("No such folder: " + folderId);

    if (!this.universe.online) {
      if (callback)
        callback('offline');
      return;
    }

    var folderMeta = this._folderInfos[folderId].$meta;

    var rawConn = null, self = this;
    function gotConn(conn) {
      rawConn = conn;
      rawConn.delBox(folderMeta.path, deletionCallback);
    }
    function deletionCallback(err) {
      if (err)
        done('unknown');
      else
        done(null);
    }
    function done(errString) {
      if (rawConn) {
        self.__folderDoneWithConnection(rawConn, false, false);
        rawConn = null;
      }
      if (!errString) {
        logic(self, 'deleteFolder', { path: folderMeta.path });
        self._forgetFolder(folderId);
      }
      if (callback)
        callback(errString, folderMeta);
    }
    this.__folderDemandsConnection(null, 'deleteFolder', gotConn);
  },

  getFolderStorageForFolderId: function(folderId) {
    if (this._folderStorages.hasOwnProperty(folderId))
      return this._folderStorages[folderId];
    throw new Error('No folder with id: ' + folderId);
  },

  getFolderStorageForMessageSuid: function(messageSuid) {
    var folderId = messageSuid.substring(0, messageSuid.lastIndexOf('/'));
    if (this._folderStorages.hasOwnProperty(folderId))
      return this._folderStorages[folderId];
    throw new Error('No folder with id: ' + folderId);
  },

  getFolderMetaForFolderId: function(folderId) {
    if (this._folderInfos.hasOwnProperty(folderId))
      return this._folderInfos[folderId].$meta;
    return null;
  },

  /**
   * Create a view slice on the messages in a folder, starting from the most
   * recent messages and synchronizing further as needed.
   */
  sliceFolderMessages: function(folderId, bridgeHandle) {
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

  shutdownFolders: function() {
    // - kill all folder storages (for their loggers)
    for (var iFolder = 0; iFolder < this.folders.length; iFolder++) {
      var folderPub = this.folders[iFolder],
          folderStorage = this._folderStorages[folderPub.id];
      folderStorage.shutdown();
    }
  },

  scheduleMessagePurge: function(folderId, callback) {
    this.universe.purgeExcessMessages(this.compositeAccount, folderId,
                                      callback);
  },

  /**
   * We receive this notification from our _backoffEndpoint.
   */
  onEndpointStateChange: function(state) {
    switch (state) {
      case 'healthy':
        this.universe.__removeAccountProblem(this.compositeAccount,
                                             'connection', 'incoming');
        break;
      case 'unreachable':
      case 'broken':
        this.universe.__reportAccountProblem(this.compositeAccount,
                                             'connection', 'incoming');
        break;
    }
  },
};

}); // end define
;
define(
  'imap/folder',[
    'logic',
    '../a64',
    '../allback',
    '../date',
    '../syncbase',
    '../util',
    'module',
    'require',
    'exports'
  ],
  function(
    logic,
    $a64,
    $allback,
    $date,
    $sync,
    $util,
    $module,
    require,
    exports
  ) {

/**
 * Lazily evaluated modules
 */
var $imaptextparser = null;
var $imapsnippetparser = null;
var $imapbodyfetcher = null;
var $imapchew = null;
var $imapsync = null;

var allbackMaker = $allback.allbackMaker,
    bsearchForInsert = $util.bsearchForInsert,
    bsearchMaybeExists = $util.bsearchMaybeExists,
    cmpHeaderYoungToOld = $util.cmpHeaderYoungToOld,
    DAY_MILLIS = $date.DAY_MILLIS,
    NOW = $date.NOW,
    BEFORE = $date.BEFORE,
    ON_OR_BEFORE = $date.ON_OR_BEFORE,
    SINCE = $date.SINCE,
    TIME_DIR_AT_OR_BEYOND = $date.TIME_DIR_AT_OR_BEYOND,
    TIME_DIR_ADD = $date.TIME_DIR_ADD,
    TIME_DIR_DELTA = $date.TIME_DIR_DELTA,
    makeDaysAgo = $date.makeDaysAgo,
    makeDaysBefore = $date.makeDaysBefore,
    quantizeDate = $date.quantizeDate,
    PASTWARDS = 1, FUTUREWARDS = -1;

/**
 * Compact an array in-place with nulls so that the nulls are removed.  This
 * is done by a scan with an adjustment delta and a final splice to remove
 * the spares.
 */
function compactArray(arr) {
  // this could also be done with a write pointer.
  var delta = 0, len = arr.length;
  for (var i = 0; i < len; i++) {
    var obj = arr[i];
    if (obj === null) {
      delta++;
      continue;
    }
    if (delta)
      arr[i - delta] = obj;
  }
  if (delta)
    arr.splice(len - delta, delta);
  return arr;
}

/**
 * Number of bytes to fetch from the server for snippets.
 */
var NUMBER_OF_SNIPPET_BYTES = 256;

/**
 * Maximum bytes to request from server in a fetch request (max uint32)
 */
var MAX_FETCH_BYTES = (Math.pow(2, 32) - 1);

/**
 * Folder connections do the actual synchronization logic.  They are associated
 * with one or more `ImapSlice` instances that issue the requests that trigger
 * synchronization.  Storage is handled by `FolderStorage` instances.  All of
 * the connection life-cycle nitty-gritty is handled by the `ImapAccount`.
 *
 * == Progress
 *
 * Our progress break-down is:
 * - [0.0, 0.1]: Getting the IMAP connection.
 * - (0.1, 0.25]: Getting usable SEARCH results.  Bisect back-off does not
 *     update progress.
 * - (0.25, 1.0]: Fetching revised flags, headers, and bodies.  Since this
 *     is primarily a question of network latency, we weight things based
 *     on round-trip requests required with reduced cost for number of packets
 *     required.
 *   - Revised flags: 20 + 1 * number of known headers
 *   - New headers: 20 + 5 * number of new headers
 *   - Bodies: 30 * number of new headers
 *
 * == IDLE
 *
 * We plan to IDLE in folders that we have active slices in.  We are assuming
 * the most basic IDLE implementation where it will tell us when the number
 * of messages increases (EXISTS), or decreases (EXPUNGE and EXISTS), with no
 * notifications when flags change.  (This is my current understanding of how
 * gmail operates from internet searches; we're not quite yet to protocol
 * experimentation yet.)
 *
 * The idea is accordingly that we will use IDLE notifications as a hint that
 * we should do a SEARCH for new messages.  It is that search that will update
 * our accuracy information and only that.
 */
function ImapFolderConn(account, storage) {
  this._account = account;
  this._storage = storage;

  logic.defineScope(this, 'ImapFolderConn', {
    accountId: account.id,
    folderId: storage.folderId
  });

  this._conn = null;
  this.box = null;

  this._deathback = null;
}
ImapFolderConn.prototype = {
  /**
   * Acquire a connection and invoke the callback once we have it and we have
   * entered the folder.  This method should only be called when running
   * inside `runMutexed`.
   *
   * @args[
   *   @param[callback @func[
   *     @args[
   *       @param[folderConn ImapFolderConn]
   *       @param[storage FolderStorage]
   *     ]
   *   ]]
   *   @param[deathback Function]{
   *     Invoked if the connection dies.
   *   }
   *   @param[label String]{
   *     A debugging label to name the purpose of the connection.
   *   }
   *   @param[dieOnConnectFailure #:optional Boolean]{
   *     See `ImapAccount.__folderDemandsConnection`.
   *   }
   * ]
   */
  acquireConn: function(callback, deathback, label, dieOnConnectFailure) {
    var self = this;
    this._deathback = deathback;
    this._account.__folderDemandsConnection(
      this._storage.folderId, label,
      function gotconn(conn) {
        self._conn = conn;
        // Now we have a connection, but it's not in the folder.
        // (If we were doing fancier sync like QRESYNC, we would not enter
        // in such a blase fashion.)
        self._conn.selectMailbox(self._storage.folderMeta.path,
                           function openedBox(err, box) {
            if (err) {
              console.error('Problem entering folder',
                            self._storage.folderMeta.path);
              self._conn = null;
              // hand the connection back, noting a resource problem
              self._account.__folderDoneWithConnection(
                self._conn, false, true);
              if (self._deathback) {
                var deathback = self._deathback;
                self.clearErrorHandler();
                deathback();
              }
              return;
            }
            self.box = box;
            callback(self, self._storage);
          });
      },
      function deadconn() {
        self._conn = null;
        if (self._deathback) {
          var deathback = self._deathback;
          self.clearErrorHandler();
          deathback();
        }
      },
      dieOnConnectFailure);
  },

  relinquishConn: function() {
    if (!this._conn)
      return;

    this.clearErrorHandler();
    this._account.__folderDoneWithConnection(this._conn, true, false);
    this._conn = null;
  },

  /**
   * If no connection, acquires one and also sets up
   * deathback if connection is lost.
   *
   * See `acquireConn` for argument docs.
   */
  withConnection: function (callback, deathback, label, dieOnConnectFailure) {
    if (!this._conn) {
      this.acquireConn(function () {
        this.withConnection(callback, deathback, label);
      }.bind(this), deathback, label, dieOnConnectFailure);
      return;
    }

    this._deathback = deathback;
    callback(this);
  },

  /**
   * Resets error handling that may be triggered during
   * loss of connection.
   */
  clearErrorHandler: function () {
    this._deathback = null;
  },

  reselectBox: function(callback) {
    this._conn.selectMailbox(this._storage.folderMeta.path, callback);
  },

  /**
   * Perform a SEARCH for the purposes of folder synchronization.  In the event
   * we are unable to reach the server (we are offline, the server is down,
   * nework troubles), the `abortedCallback` will be invoked.  Note that it can
   * take many seconds for us to conclusively fail to reach the server.
   *
   * Track an isRetry flag to ensure we don't fall into an infinite retry loop.
   */
  _timelySyncSearch: function(searchOptions, searchedCallback,
                              abortedCallback, progressCallback, isRetry) {
    var gotSearchResponse = false;

    // If we don't have a connection, get one, then re-call.
    if (!this._conn) {
      // XXX the abortedCallback should really only be used for the duration
      // of this request, but it will end up being used for the entire duration
      // our folder holds on to the connection.  This is not a great idea as
      // long as we are leaving the IMAP connection idling in the folder (which
      // causes us to not release the connection back to the account).  We
      // should tie this to the mutex or something else transactional.
      this.acquireConn(
        this._timelySyncSearch.bind(this,
                                    searchOptions, searchedCallback,
                                    abortedCallback, progressCallback,
                                    /* isRetry: */ isRetry),
        abortedCallback, 'sync', true);
      return;
    }
    // We do have a connection. Hopefully the connection is still
    // valid and functional. However, since this connection may have
    // been hanging around a while, sending data now might trigger a
    // connection reset notification. In other words, if the
    // connection has gone stale, we want to grab a new connection and
    // retry before aborting.
    else {
      if (!isRetry) {
        var origAbortedCallback = abortedCallback;
        abortedCallback = (function() {
          // Here, we've acquired an already-connected socket. If we
          // were already connected, but failed to receive a response
          // from the server, this socket is effectively dead. In that
          // case, retry the SEARCH once again with a fresh connection,
          // if we haven't already retried the request.
          if (!gotSearchResponse) {
            console.warn('Broken connection for SEARCH. Retrying.');
            this._timelySyncSearch(searchOptions, searchedCallback,
                                   origAbortedCallback, progressCallback,
                                   /* isRetry: */ true);
          }
          // Otherwise, we received an error from this._conn.search
          // below (i.e. there was a legitimate server problem), or we
          // already retried, so we should actually give up.
          else {
            origAbortedCallback();
          }
        }.bind(this));
      }
      this._deathback = abortedCallback;
    }

    // Having a connection is 10% of the battle
    if (progressCallback)
      progressCallback(0.1);

    // Gmail IMAP servers cache search results until your connection
    // gets notified of new messages via an unsolicited server
    // response. Sending a command like NOOP is required to flush the
    // cache and force SEARCH to return new messages that have just
    // been received. Other IMAP servers don't need this as far as we know.
    // See <https://bugzilla.mozilla.org/show_bug.cgi?id=933079>.
    if (this._account.isGmail) {
      this._conn.exec('NOOP');
    }

    this._conn.search(searchOptions, { byUid: true }, function(err, uids) {
        gotSearchResponse = true;
        if (err) {
          console.error('Search error on', searchOptions, 'err:', err);
          abortedCallback();
          return;
        }
        searchedCallback(uids);
      });
  },

  syncDateRange: function() {
    var args = Array.slice(arguments);
    var self = this;

    require(['imap/protocol/sync'], function(_sync) {
      $imapsync = _sync;
      (self.syncDateRange = self._lazySyncDateRange).apply(self, args);
    });
  },

  /**
   * Perform a search to find all the messages in the given date range.
   * Meanwhile, load the set of messages from storage.  Infer deletion of the
   * messages we already know about that should exist in the search results but
   * do not.  Retrieve information on the messages we don't know anything about
   * and update the metadata on the messages we do know about.
   *
   * An alternate way to accomplish the new/modified/deleted detection for a
   * range might be to do a search over the UID range of new-to-us UIDs and
   * then perform retrieval on what we get back.  We would do a flag fetch for
   * all the UIDs we already know about and use that to both get updated
   * flags and infer deletions from UIDs that don't report back.  Except that
   * might not work because the standard doesn't seem to say that if we
   * specify gibberish UIDs that it should keep going for the UIDs that are
   * not gibberish.  Also, it's not clear what the performance impact of the
   * additional search constraint might be on server performance.  (Of course,
   * if the server does not have an index on internaldate, these queries are
   * going to be very expensive and the UID limitation would probably be a
   * mercy to the server.)
   *
   * IMAP servers do not treat the SINCE and BEFORE options to IMAP
   * SEARCH consistently. Because we compare messages in chunks of
   * time-ranges, a message may seem like it has been deleted, when it
   * actually just fell into the adjacent range bucket (Bug 886534).
   * To correct for this, we do the following:
   *
   * 1. When we sync (whether PASTWARDS or FUTUREWARDS), we include
   *    messages from a bit before and after the range we asked the
   *    server for.

   * 2. Compare those messages to the list the server returned. For
   *    any messages which we have locally, but the server did not
   *    return:
   *
   *    a) Delete any messages which are unambiguously within our
   *       current time range.
   *
   *    b) Mark any messages we expected to see (but didn't) with an
   *       indicator saying "we asked the server for messages in this
   *       time range, but we couldn't find it". If a message was
   *       already missing, expand the range to cover the current
   *       range also, indicating that the message still wasn't found
   *       after a wider search.
   *
   *    c) Inspect the "missing range" of each message. If the range
   *       covers at least a day before and after the header's date,
   *       delete the message. The server didn't return it to us even
   *       though we checked a full day before and after the message.
   *
   *    d) If the server returns the message in a sync and we haven't
   *       deleted it yet, clear the "missing" flag and start over.
   *
   * 3. Because we always sync time ranges farther into the past to
   *    show the user new messages, the ambiguity between "deleted or
   *    just hidden" disappears as we get information from continued
   *    syncs.
   *
   * TLDR: Messages on the ends of SEARCH ranges may fall into
   *       adjacent sync ranges. Don't freak out and delete a message
   *       just because it didn't show up in this exact range we asked
   *       for. Only delete the message if we checked all around where
   *       it was supposed to show up, and it never did.
   *
   * @args[
   *   @param[startTS @oneof[null DateMS]]{
   *     If non-null, inclusive "SINCE" constraint to use, otherwise the
   *     constraint is omitted.
   *   }
   *   @param[endTS @oneof[null DateMS]]{
   *     If non-null, exclusive "BEFORE" constraint to use, otherwise the
   *     constraint is omitted.
   *   }
   * ]
   */
  _lazySyncDateRange: function(startTS, endTS, accuracyStamp,
                               doneCallback, progressCallback) {

    var scope = logic.subscope(this, { startTS: startTS, endTS: endTS });

    if (startTS && endTS && SINCE(startTS, endTS)) {
      logic(scope, 'illegalSync');
      doneCallback('invariant');
      return;
    }

    var self = this;
    var storage = self._storage;
    var completed = false;

    console.log('syncDateRange:', startTS, endTS);
    logic(scope, 'syncDateRange_begin');

    // IMAP Search

    // We don't care about deleted messages, it's best that we're not
    // aware of them. However, it's important to keep in mind that
    // this means that EXISTS provides us with an upper bound on the
    // messages in the folder since we are blinding ourselves to
    // deleted messages.
    var searchOptions = { not: { deleted: true } };
    if (startTS) {
      searchOptions.since = new Date(startTS);
    }
    if (endTS) {
      searchOptions.before = new Date(endTS);
    }

    var imapSearchPromise = new Promise(function(resolve) {
      this._timelySyncSearch(
        searchOptions,
        resolve,
        function abortedSearch() {
          if (completed)
            return;
          completed = true;
          logic(scope, 'syncDateRange_end', {
            full: 0, flags: 0, deleted: 0
          });
          doneCallback('aborted');
        }.bind(this),
        progressCallback,
        /* isRetry: */ false);
    }.bind(this));

    // Database Fetch

    // Fetch messages from the database, extending the search by a day
    // on either side to prevent timezone-related problems (bug 886534).

    var dbStartTS = (startTS ? startTS - $sync.IMAP_SEARCH_AMBIGUITY_MS : null);
    var dbEndTS = (endTS ? endTS + $sync.IMAP_SEARCH_AMBIGUITY_MS : null);
    logic(scope, 'database-lookup', {
      dbStartTS: dbStartTS,
      dbEndTS: dbEndTS
    });
    var databaseFetchPromise = new Promise(function(resolve) {
      storage.getAllMessagesInImapDateRange(dbStartTS, dbEndTS, resolve);
    });

    // Combine the results:

    Promise.all([
      imapSearchPromise,
      databaseFetchPromise
    ]).then(function(results) {
      var serverUIDs = results[0];
      var dbHeaders = results[1];
      var effectiveEndTS = endTS || quantizeDate(NOW() + DAY_MILLIS);
      var curDaysDelta = Math.round((effectiveEndTS - startTS) / DAY_MILLIS);
      var tooMany = serverUIDs.length > $sync.TOO_MANY_MESSAGES;

      // ----------------------------------------------------------------
      // BISECTION SPECIAL CASE: If we have a lot of messages to
      // process and we're searching more than one day, we can shrink
      // our search.

      var shouldBisect = (serverUIDs.length > $sync.BISECT_DATE_AT_N_MESSAGES &&
                          curDaysDelta > 1);

      console.log(
        '[syncDateRange]',
        'Should bisect?', shouldBisect ? '***YES, BISECT!***' : 'no.',
        'curDaysDelta =', curDaysDelta,
        'serverUIDs.length =', serverUIDs.length,
        'tooMany =', tooMany);

      if (shouldBisect) {
        // mark the bisection abort...
        logic(scope, 'syncDateRange_end');
        var bisectInfo = {
          oldStartTS: startTS,
          oldEndTS: endTS,
          numHeaders: serverUIDs.length,
          curDaysDelta: curDaysDelta,
          newStartTS: startTS,
          newEndTS: endTS,
        };
        // If we were being used for a refresh, they may want us to stop
        // and change their sync strategy.
        if (doneCallback('bisect', bisectInfo, null) === 'abort') {
          self.clearErrorHandler();
          doneCallback('bisect-aborted', null);
        } else {
          self.syncDateRange(
            bisectInfo.newStartTS,
            bisectInfo.newEndTS,
            accuracyStamp,
            doneCallback,
            progressCallback);
        }
        return;
      } else if (tooMany) {
        console.log('Ignore sync because min segment range have too many mails!');
        self.clearErrorHandler();
        doneCallback(null, null, 0, startTS, endTS);
        return;
      }

      // end bisection special case
      // ----------------------------------------------------------------

      if (progressCallback) {
        progressCallback(0.25);
      }

      // Combine the UIDs from local headers with server UIDs.

      var uidSet = new Set();
      var serverUidSet = new Set();
      var localHeaderMap = {};

      dbHeaders.forEach(function(header) {
        // Ignore not-yet-synced local messages (messages without a
        // srvid), such as messages from a partially-completed local
        // move. Because they have no server ID, we can't compare them
        // to anything currently on the server anyway.
        if (header.srvid !== null) {
          uidSet.add(header.srvid);
          localHeaderMap[header.srvid] = header;
        }
      });

      serverUIDs.forEach(function(uid) {
        uidSet.add(uid);
        serverUidSet.add(uid);
      });

      var imapSyncOptions = {
        connection: self._conn,
        storage: storage,
        newUIDs: [],
        knownUIDs: [],
        knownHeaders: []
      };

      var numDeleted = 0;
      var latch = $allback.latch();

      // Figure out which messages are new, updated, or deleted.
      uidSet.forEach(function(uid) {
        var localHeader = localHeaderMap[uid] || null;
        var hasServer = serverUidSet.has(uid);

        // New
        if (!localHeader && hasServer) {
          imapSyncOptions.newUIDs.push(uid);
          logic(scope, 'new-uid', { uid: uid });
        }
        // Updated
        else if (localHeader && hasServer) {
          imapSyncOptions.knownUIDs.push(uid);
          imapSyncOptions.knownHeaders.push(localHeader);

          if (localHeader.imapMissingInSyncRange) {
            localHeader.imapMissingInSyncRange = null;
            logic(scope, 'found-missing-uid', { uid: uid });
            storage.updateMessageHeader(
              localHeader.date, localHeader.id, true, localHeader,
              /* body hint */ null, latch.defer(), { silent: true });
          }

          logic(scope, 'updated-uid', { uid: uid });
        }
        // Deleted or Ambiguously Deleted
        else if (localHeader && !hasServer) {

          // So, how long has this message been missing for?
          var fuzz = $sync.IMAP_SEARCH_AMBIGUITY_MS;
          var date = localHeader.date;

          // There are 3 possible cases for imapMissingInSyncRange:
          // 1) We don't have one, so just use the current search range.
          // 2) It's disjoint from the current search range, so just use the
          //    current search range.  We do this because we only track one
          //    range for the message, and unioning disjoint ranges erroneously
          //    assumes that we know something about the gap range *when we do
          //    not*.  This situation arises because we previously had synced
          //    backwards in time so that we were on the "old" ambiguous side
          //    of the message.  We now must be on the "new" ambiguous side.
          //    Since our sync range (currently) only ever moves backwards in
          //    time, it is safe for us to discard the information about the
          //    "old" side because we'll get that coverage again soon.
          // 3) It overlaps the current range and we can take their union.
          var missingRange;
          if (!localHeader.imapMissingInSyncRange || // (#1)
              ((localHeader.imapMissingInSyncRange.endTS < startTS) || // (#2)
               (localHeader.imapMissingInSyncRange.startTS > endTS))) {
            // adopt/clobber!
            // (Note that "Infinity" JSON stringifies to null, so be aware when
            // looking at logs involving this code.  But the values are
            // structured cloned for bridge and database purposes and so remain
            // intact.)
            missingRange = localHeader.imapMissingInSyncRange =
              { startTS: startTS || 0, endTS: endTS || Infinity };
          } else { // (#3, union!)
            missingRange = localHeader.imapMissingInSyncRange;
            // Make sure to treat 'null' startTS and endTS correctly.
            // (This is a union range.  We can state that we have not found the
            // message in the time range SINCE missingRange.startTS and BEFORE
            // missingRange.endTS.)
            missingRange.startTS = Math.min(startTS || 0,
                                            missingRange.startTS || 0);
            missingRange.endTS = Math.max(endTS || Infinity,
                                          missingRange.endTS || Infinity);
          }

          // Have we looked all around where the message is supposed
          // to be, and the server never coughed it up? Delete it.
          // (From a range perspective, we want to ensure that the missingRange
          // completely contains the date +/- fuzz range.  We use an inclusive
          // comparison in both cases because we are comparing two ranges, not
          // a single date and a range.)
          if (missingRange.startTS <= date - fuzz &&
              missingRange.endTS >= date + fuzz) {
            logic(scope, 'unambiguously-deleted-uid',
                  { uid: uid, date: date, fuzz: fuzz, missingRange: missingRange });
            storage.deleteMessageHeaderAndBodyUsingHeader(localHeader);
            numDeleted++;
          }
          // Or we haven't looked far enough... maybe it will show up
          // later. We've already marked the updated "missing" range above.
          else {
            logic(scope, 'ambiguously-missing-uid',
                  { uid: uid, missingRange: missingRange,
                    rangeToDelete: { startTS: date - fuzz, endTS: date + fuzz },
                    syncRange: { startTS: startTS, endTS: endTS }});
            storage.updateMessageHeader(
              localHeader.date, localHeader.id, true, localHeader,
              /* body hint */ null, latch.defer(), { silent: true });
          }
        }
      });

      // Now that we've reconciled the difference between the items
      // listen on the server and the items on the client, we can pass
      // the hard download work into $imapsync.Sync.
      latch.then(function() {
        var uidSync = new $imapsync.Sync(imapSyncOptions);
        uidSync.onprogress = progressCallback;
        uidSync.oncomplete = function(newCount, knownCount) {
          logic(scope, 'syncDateRange_end', {
            full: newCount,
            flags: knownCount,
            deleted: numDeleted
          });

          // BrowserBox returns an integer modseq, but it's opaque and
          // we already deal with strings, so cast it here.
          var modseq = (self.box.highestModseq || '') + '';
          storage.markSyncRange(startTS, endTS, modseq, accuracyStamp);

          if (!completed) {
            completed = true;
            self.clearErrorHandler();
            doneCallback(null, null, newCount + knownCount, startTS, endTS);
          }
        };
      });
    }.bind(this));
 },

  /**
   * Downloads all the body representations for a given message.
   *
   *
   *    folder.downloadBodyReps(
   *      header,
   *      {
   *        // maximum number of bytes to fetch total (across all bodyReps)
   *        maximumBytesToFetch: N
   *      }
   *      callback
   *    );
   *
   */
  downloadBodyReps: function() {
    var args = Array.slice(arguments);
    var self = this;

    require(
      [
        './imapchew',
        './protocol/bodyfetcher',
        './protocol/textparser',
        './protocol/snippetparser'
      ],
      function(
        _imapchew,
        _bodyfetcher,
        _textparser,
        _snippetparser
      ) {

        $imapchew =_imapchew;
        $imapbodyfetcher = _bodyfetcher;
        $imaptextparser = _textparser;
        $imapsnippetparser = _snippetparser;

        (self.downloadBodyReps = self._lazyDownloadBodyReps).apply(self, args);
    });
  },

  /**
   * Initiates a request to download all body reps for a single message. If a
   * snippet has not yet been generated this will also generate the snippet...
   */
  _lazyDownloadBodyReps: function(header, options, callback) {
    if (typeof(options) === 'function') {
      callback = options;
      options = null;
    }

    options = options || {};

    var self = this;

    var gotBody = function gotBody(bodyInfo) {
      // target for snippet generation
      var bodyRepIdx = $imapchew.selectSnippetBodyRep(header, bodyInfo);

      // assume user always wants entire email unless option is given...
      var overallMaximumBytes = options.maximumBytesToFetch;

      var bodyParser = $imaptextparser.TextParser;

      // build the list of requests based on downloading required.
      var requests = [];
      var latch = $allback.latch();
      bodyInfo.bodyReps.forEach(function(rep, idx) {
        // attempt to be idempotent by only requesting the bytes we need if we
        // actually need them...
        if (rep.isDownloaded)
          return;

        // default to the entire remaining email. We use the estimate * largish
        // multiplier so even if the size estimate is wrong we should fetch more
        // then the requested number of bytes which if truncated indicates the
        // end of the bodies content.
        var bytesToFetch = Math.min(rep.sizeEstimate * 5, MAX_FETCH_BYTES);

        if (overallMaximumBytes !== undefined) {
          // when we fetch partial results we need to use the snippet parser.
          bodyParser = $imapsnippetparser.SnippetParser;

          // issued enough downloads
          if (overallMaximumBytes <= 0) {
            return;
          }

          // if our estimate is greater then expected number of bytes
          // request the maximum allowed.
          if (rep.sizeEstimate > overallMaximumBytes) {
            bytesToFetch = overallMaximumBytes;
          }

          // subtract the estimated byte size
          overallMaximumBytes -= rep.sizeEstimate;
        }

        // For a byte-serve request, we need to request at least 1 byte, so
        // request some bytes.  This is a logic simplification that should not
        // need to be used because imapchew.js should declare 0-byte files
        // fully downloaded when their parts are created, but better a wasteful
        // network request than breaking here.
        if (bytesToFetch <= 0)
          bytesToFetch = 64;

        // CONDITIONAL LOGIC BARRIER CONDITIONAL LOGIC BARRIER DITTO DITTO
        // Do not do return/continue after this point because we call
        // latch.defer below, and we break if we call it and then throw away
        // that callback without calling it.  (Unsurprisingly.)

        var request = {
          uid: header.srvid,
          partInfo: rep._partInfo,
          bodyRepIndex: idx,
          createSnippet: idx === bodyRepIdx,
          headerUpdatedCallback: latch.defer(header.srvid + '-' + rep._partInfo)
        };

        // we may only need a subset of the total number of bytes.
        if (overallMaximumBytes !== undefined || rep.amountDownloaded) {
          // request the remainder
          request.bytes = [
            rep.amountDownloaded,
            bytesToFetch
          ];
        }

        requests.push(request);
      });

      // we may not have any requests bail early if so.
      if (!requests.length) {
        callback(null, bodyInfo); // no requests === success
        return;
      }

      var fetch = new $imapbodyfetcher.BodyFetcher(
        self._conn,
        bodyParser,
        requests
      );

      self._handleBodyFetcher(fetch, header, bodyInfo, latch.defer('body'));
      latch.then(function(results) {
        callback($allback.extractErrFromCallbackArgs(results), bodyInfo);
      });
    };

    this._storage.getMessageBody(header.suid, header.date, gotBody);
  },

  /**
   * Wrapper around common bodyRep updates...
   */
  _handleBodyFetcher: function(fetcher, header, body, bodyUpdatedCallback) {
    var event = {
      changeDetails: {
        bodyReps: []
      }
    };

    // This will be invoked once per body part that is successfully downloaded
    // or fails to download.
    fetcher.onparsed = function(err, req, resp) {
      if (err) {
        req.headerUpdatedCallback(err);
        return;
      }

      $imapchew.updateMessageWithFetch(header, body, req, resp);

      header.bytesToDownloadForBodyDisplay =
        $imapchew.calculateBytesToDownloadForImapBodyDisplay(body);

      // Always update the header so that we can save
      // bytesToDownloadForBodyDisplay, which will tell the UI whether
      // or not we can show the message body right away.
      this._storage.updateMessageHeader(
        header.date,
        header.id,
        false,
        header,
        body,
        req.headerUpdatedCallback.bind(null, null) // no error
      );

      event.changeDetails.bodyReps.push(req.bodyRepIndex);
    }.bind(this);

    // This will be invoked after all of the onparsed events have fired.
    fetcher.onend = function() {
      // Since we no longer have any updates to make to the body, we want to
      // finally update it now.
      this._storage.updateMessageBody(
        header,
        body,
        {},
        event,
        bodyUpdatedCallback.bind(null, null) // we do not/cannot error
      );
    }.bind(this);
  },

  /**
   * The actual work of downloadBodies, lazily replaces downloadBodies once
   * module deps are loaded.
   */
  _lazyDownloadBodies: function(headers, options, callback) {
    var downloadsNeeded = 0;
    var latch = $allback.latch();
    for (var i = 0; i < headers.length; i++) {
      // We obviously can't do anything with null header references.
      // To avoid redundant work, we also don't want to do any fetching if we
      // already have a snippet.  This could happen because of the extreme
      // potential for a caller to spam multiple requests at us before we
      // service any of them.  (Callers should only have one or two outstanding
      // jobs of this and do their own suppression tracking, but bugs happen.)
      var header = headers[i];
      if (!header || header.snippet !== null) {
        continue;
      }

      // This isn't absolutely guaranteed to be 100% correct, but is good enough
      // for indicating to the caller that we did some work.
      downloadsNeeded++;
      this.downloadBodyReps(headers[i], options, latch.defer(header.suid));
    }
    latch.then(function(results) {
      callback($allback.extractErrFromCallbackArgs(results), downloadsNeeded);
    });
  },

  /**
   * Download snippets or entire bodies for a set of headers.
   */
  downloadBodies: function() {
    var args = Array.slice(arguments);
    var self = this;

    require(
      ['./imapchew', './protocol/bodyfetcher', './protocol/snippetparser'],
      function(
        _imapchew,
        _bodyfetcher,
        _snippetparser
      ) {

        $imapchew =_imapchew;
        $imapbodyfetcher = _bodyfetcher;
        $imapsnippetparser = _snippetparser;

        (self.downloadBodies = self._lazyDownloadBodies).apply(self, args);
    });
  },

  downloadMessageAttachments: function(uid, partInfos, callback, progress) {
    require(['mimeparser'], function(MimeParser) {
      var conn = this._conn;
      var self = this;

      var latch = $allback.latch();
      var anyError = null;
      var bodies = [];

      partInfos.forEach(function(partInfo, index) {
        var partKey = 'body.peek[' + partInfo.part + ']';
        var partDone = latch.defer(partInfo.part);
        conn.listMessages(
          uid,
          [partKey],
          { byUid: true },
          function(err, messages) {
            if (err) {
              anyError = err;
              console.error('attachments:download-error', {
                error: err,
                part: partInfo.part,
                type: partInfo.type
              });
              partDone();
              return;
            }

            // We only receive one message per each listMessages call.
            var msg = messages[0];

            // Find the proper response key of the message. Since this
            // response object is a lightweight wrapper around the
            // response returned from the IRC server and it's possible
            // there are poorly-behaved servers out there, best to err
            // on the side of safety.
            var bodyPart;
            for (var key in msg) {
              if (/body\[/.test(key)) {
                bodyPart = msg[key];
                break;
              }
            }

            if (!bodyPart) {
              console.error('attachments:download-error', {
                error: 'no body part?',
                requestedPart: partKey,
                responseKeys: Object.keys(msg)
              });
              partDone();
              return;
            }

            // TODO: stream attachments, bug 1047032
            var parser = new MimeParser();
            // TODO: escape partInfo.type/encoding
            parser.write('Content-Type: ' + partInfo.type + '\r\n');
            parser.write('Content-Transfer-Encoding: ' + partInfo.encoding + '\r\n');
            parser.write('\r\n');
            parser.write(bodyPart);
            parser.end(); // Parsing is actually synchronous.

            var node = parser.node;

            bodies[index] = new Blob([node.content], {
              type: node.contentType.value
            });

            partDone();
          });
      });

      latch.then(function(results) {
        callback(anyError, bodies);
      });
    }.bind(this));
  },

  shutdown: function() {
  },
};

function ImapFolderSyncer(account, folderStorage) {
  this._account = account;
  this.folderStorage = folderStorage;

  logic.defineScope(this, 'ImapFolderSyncer', {
    accountId: account.id,
    folderId: folderStorage.folderId
  });

  this._syncSlice = null;
  /**
   * The timestamp to use for `markSyncRange` for all syncs in this higher
   * level sync.  Accuracy time-info does not need high precision, so this
   * results in fewer accuracy structures and simplifies our decision logic
   * in `sliceOpenMostRecent`.
   */
  this._curSyncAccuracyStamp = null;
  /**
   * @oneof[
   *   @case[1]{
   *     Growing older/into the past.
   *   }
   *   @case[-1]{
   *     Growing into the present/future.
   *   }
   * ]{
   *   Sync growth direction.  Numeric values chosen to be consistent with
   *   slice semantics (which are oriented like they are because the slices
   *   display messages from newest to oldest).
   * }
   */
  this._curSyncDir = 1;
  /**
   * Synchronization is either 'grow' or 'refresh'.  Growth is when we just
   * want to learn about some new messages.  Refresh is when we know we have
   * already synchronized a time region and want to fully update it and so will
   * keep going until we hit our `syncThroughTS` threshold.
   */
  this._curSyncIsGrow = null;
  /**
   * The timestamp that will anchor the next synchronization.
   */
  this._nextSyncAnchorTS = null;
  /**
   * In the event of a bisection, this is the timestamp to fall back to rather
   * than continuing from our
   */
  this._fallbackOriginTS = null;
  /**
   * The farthest timestamp that we should synchronize through.  The value
   * null is potentially meaningful if we are synchronizing FUTUREWARDS.
   */
  this._syncThroughTS = null;
  /**
   * The number of days we are looking into the past in the current sync step.
   */
  this._curSyncDayStep = null;
  /**
   * If non-null, then we must synchronize all the way through the provided date
   * before we begin increasing _curSyncDayStep.  This helps us avoid
   * oscillation where we make the window too large, shrink it, but then find
   * find nothing.  Since we know that there are going to be a lot of messages
   * before we hit this date, it makes sense to keep taking smaller sync steps.
   */
  this._curSyncDoNotGrowBoundary = null;
  /**
   * The callback to invoke when we complete the sync, regardless of success.
   */
  this._curSyncDoneCallback = null;

  this.folderConn = new ImapFolderConn(account, folderStorage);
}
exports.ImapFolderSyncer = ImapFolderSyncer;
ImapFolderSyncer.prototype = {
  /**
   * Although we do have some errbackoff stuff we do, we can always try to
   * synchronize.  The errbackoff is just a question of when we will retry.
   */
  syncable: true,

  /**
   * Can we grow this sync range?  IMAP always lets us do this.
   */
  get canGrowSync() {
    // Some folders, like localdrafts and outbox, cannot be synced
    // because they are local-only.
    return !this.folderStorage.isLocalOnly;
  },

  /**
   * Perform an initial synchronization of a folder from now into the past,
   * starting with the specified step size.
   */
  initialSync: function(slice, initialDays, syncCallback,
                        doneCallback, progressCallback) {
    syncCallback('sync', false /* Ignore Headers */);
    // We want to enter the folder and get the box info so we can know if we
    // should trigger our SYNC_WHOLE_FOLDER_AT_N_MESSAGES logic.
    // _timelySyncSearch is what will get called next either way, and it will
    // just reuse the connection and will correctly update the deathback so
    // that our deathback is no longer active.
    this.folderConn.withConnection(
      function(folderConn, storage) {
        // Flag to sync the whole range if we
        var syncWholeTimeRange = false;
        if (folderConn && folderConn.box &&
            folderConn.box.exists <
              $sync.SYNC_WHOLE_FOLDER_AT_N_MESSAGES) {
          syncWholeTimeRange = true;
        }

        this._startSync(
          slice, PASTWARDS, // sync into the past
          'grow',
          null, // start syncing from the (unconstrained) future
          $sync.OLDEST_SYNC_DATE, // sync no further back than this constant
          null,
          syncWholeTimeRange ? null : initialDays,
          doneCallback, progressCallback);
      }.bind(this),
      function died() {
        doneCallback('aborted');
      },
      'initialSync', true);
  },

  /**
   * Perform a refresh synchronization covering the requested time range.  This
   * may be converted into multiple smaller synchronizations, but the completion
   * notification will only be generated once the entire time span has been
   * synchronized.
   */
  refreshSync: function(slice, dir, startTS, endTS, origStartTS,
                        doneCallback, progressCallback) {
    // timezone compensation happens in the caller
    this._startSync(
      slice, dir,
      'refresh', // this is a refresh, not a grow!
      dir === PASTWARDS ? endTS : startTS,
      dir === PASTWARDS ? startTS : endTS,
      origStartTS,
      /* syncStepDays */ null, doneCallback, progressCallback);
  },

  /**
   * Synchronize into a time period not currently covered.  Growth has an
   * explicit direction and explicit origin timestamp.
   *
   * @args[
   *   @param[slice]
   *   @param[growthDirection[
   *   @param[anchorTS]
   *   @param[syncStepDays]
   *   @param[doneCallback]
   *   @param[progressCallback]
   * ]
   * @return[Boolean]{
   *   Returns false if no sync is necessary.
   * }
   */
  growSync: function(slice, growthDirection, anchorTS, syncStepDays,
                     doneCallback, progressCallback) {
    var syncThroughTS;
    if (growthDirection === PASTWARDS) {
      syncThroughTS = $sync.OLDEST_SYNC_DATE;
    }
    else { // FUTUREWARDS
      syncThroughTS = null;
    }

    this._startSync(slice, growthDirection, 'grow',
                    anchorTS, syncThroughTS, null, syncStepDays,
                    doneCallback, progressCallback);
  },

  _startSync: function ifs__startSync(slice, dir, syncTypeStr,
                                      originTS, syncThroughTS, fallbackOriginTS,
                                      syncStepDays,
                                      doneCallback, progressCallback) {
    var startTS, endTS;
    this._syncSlice = slice;
    this._curSyncAccuracyStamp = NOW();
    this._curSyncDir = dir;
    this._curSyncIsGrow = (syncTypeStr === 'grow');
    this._fallbackOriginTS = fallbackOriginTS;
    if (dir === PASTWARDS) {
      endTS = originTS;
      if (syncStepDays) {
        if (endTS)
          this._nextSyncAnchorTS = startTS = endTS - syncStepDays * DAY_MILLIS;
        else
          this._nextSyncAnchorTS = startTS = makeDaysAgo(syncStepDays);
      }
      else {
        startTS = syncThroughTS;
        this._nextSyncAnchorTS = null;
      }
    }
    else { // FUTUREWARDS
      startTS = originTS;
      if (syncStepDays) {
        this._nextSyncAnchorTS = endTS = startTS + syncStepDays * DAY_MILLIS;
      }
      else {
        endTS = syncThroughTS;
        this._nextSyncAnchorTS = null;
      }
    }
    this._syncThroughTS = syncThroughTS;
    this._curSyncDayStep = syncStepDays;
    this._curSyncDoNotGrowBoundary = null;
    this._curSyncDoneCallback = doneCallback;

    this.folderConn.relinquishConn();
    this.folderConn.syncDateRange(startTS, endTS, this._curSyncAccuracyStamp,
                                  this.onSyncCompleted.bind(this),
                                  progressCallback);
  },

  _doneSync: function ifs__doneSync(err) {
    // The desired number of headers is always a rough request value which is
    // intended to be a new thing for each request.  So we don't want extra
    // desire building up, so we set it to what we have every time.
    //
    this._syncSlice.desiredHeaders = this._syncSlice.headers.length;

    // Save our state even if there was an error because we may have accumulated
    // some partial state.  Additionally, don't *actually* complete until the
    // save has hit the disk.  This is beneficial for both tests and cronsync
    // which has been trying to shut us down in a race with this save
    // triggering.
    this._account.__checkpointSyncCompleted(function () {
      if (this._curSyncDoneCallback)
        this._curSyncDoneCallback(err);

      this._syncSlice = null;
      this._curSyncAccuracyStamp = null;
      this._curSyncDir = null;
      this._nextSyncAnchorTS = null;
      this._syncThroughTS = null;
      this._curSyncDayStep = null;
      this._curSyncDoNotGrowBoundary = null;
      this._curSyncDoneCallback = null;
    }.bind(this));
  },

  /**
   * Whatever synchronization we last triggered has now completed; we should
   * either trigger another sync if we still want more data, or close out the
   * current sync.
   *
   * ## Block Flushing
   *
   * We only cause a call to `ImapAccount.__checkpointSyncCompleted` (via a call
   * to `_doneSync`) to happen and cause dirty blocks to be written to disk when
   * we are done with synchronization.  This is because this method declares
   * victory once a non-trivial amount of work has been done.  In the event that
   * the sync is encountering a lot of deleted messages and so keeps loading
   * blocks, the memory burden is limited because we will be emptying those
   * blocks out so actual memory usage (after GC) is commensurate with the
   * number of (still-)existing messages.  And those are what this method uses
   * to determine when it is done.
   *
   * In the cases where we are synchronizing a ton of messages on a single day,
   * we could perform checkpoints during the process, but realistically any
   * device we are operating on should probably have enough memory to deal with
   * these surges, so we're not doing that yet.
   *
   * @args[
   *   @param[err]
   *   @param[bisectInfo]
   *   @param[messagesSeen Number]
   *   @param[effStartTS DateMS]{
   *     Effective start date in UTC after compensating for server tz offset.
   *   }
   *   @param[effEndTS @oneof[DateMS null]]{
   *     Effective end date in UTC after compensating for server tz offset.
   *     If the end date was open-ended, then null is passed instead.
   *   }
   * ]
   */
  onSyncCompleted: function ifs_onSyncCompleted(err, bisectInfo, messagesSeen,
                                                effStartTS, effEndTS) {
    // In the event the time range had to be bisected, update our info so if
    // we need to take another step we do the right thing.
    if (err === 'bisect') {
      var curDaysDelta = bisectInfo.curDaysDelta,
          numHeaders = bisectInfo.numHeaders;

      // If we had a fallback TS because we were synced to the dawn of time,
      // use that and start by just cutting the range in thirds rather than
      // doing a weighted bisection since the distribution might include
      // a number of messages earlier than our fallback startTS.
      if (this._curSyncDir === FUTUREWARDS && this._fallbackOriginTS) {
        this.folderStorage.clearSyncedToDawnOfTime(this._fallbackOriginTS);
        bisectInfo.oldStartTS = this._fallbackOriginTS;
        this._fallbackOriginTS = null;
        var effOldEndTS = bisectInfo.oldEndTS ||
                          quantizeDate(NOW() + DAY_MILLIS);
        curDaysDelta = Math.round((effOldEndTS - bisectInfo.oldStartTS) /
                                  DAY_MILLIS);
        numHeaders = $sync.BISECT_DATE_AT_N_MESSAGES * 1.5;
      }
      // Sanity check the time delta; if we grew the bounds to the dawn
      // of time, then our interpolation is useless and it's better for
      // us to crank things way down, even if it's erroneously so.
      else if (curDaysDelta > 1000)
        curDaysDelta = 30;

      // - Interpolate better time bounds.
      // Assume a linear distribution of messages, but overestimated by
      // a factor of two so we undershoot.  Also make sure that we subtract off
      // at least 2 days at a time.  This is to ensure that in the case where
      // endTS is null and we end up using makeDaysAgo that we actually shrink
      // by at least 1 day (because of how rounding works for makeDaysAgo).
      var shrinkScale = $sync.BISECT_DATE_AT_N_MESSAGES /
                          (numHeaders * 2),
          dayStep = Math.max(1,
                             Math.min(curDaysDelta - 2,
                                      Math.ceil(shrinkScale * curDaysDelta)));
      this._curSyncDayStep = dayStep;

      if (this._curSyncDir === PASTWARDS) {
        bisectInfo.newEndTS = bisectInfo.oldEndTS;
        this._nextSyncAnchorTS = bisectInfo.newStartTS =
          makeDaysBefore(bisectInfo.newEndTS, dayStep);
        this._curSyncDoNotGrowBoundary = bisectInfo.oldStartTS;
      }
      else { // FUTUREWARDS
        bisectInfo.newStartTS = bisectInfo.oldStartTS;
        this._nextSyncAnchorTS = bisectInfo.newEndTS =
          makeDaysBefore(bisectInfo.newStartTS, -dayStep);
        this._curSyncDoNotGrowBoundary = bisectInfo.oldEndTS;
      }

      // We return now without calling _doneSync because we are not done; the
      // caller (syncDateRange) will re-trigger itself and keep going.
      return;
    }
    else if (err) {
      this._doneSync(err);
      return;
    }

    console.log("Sync Completed!", this._curSyncDayStep, "days",
                messagesSeen, "messages synced");

    // - Slice is dead = we are done
    if (this._syncSlice.isDead) {
      this._doneSync();
      return;
    }

    // If it now appears we know about all the messages in the folder, then we
    // are done syncing and can mark the entire folder as synchronized.  This
    // requires that:
    // - The direction is pastwards. (We check the oldest header, so this
    //   is important.  We don't really need to do a future-wards variant since
    //   we always use pastwards for refreshes and the future-wards variant
    //   really does not need a fast-path since the cost of stepping to 'today'
    //   is much cheaper thana the cost of walking all the way to 1990.)
    // - The number of messages we know about is the same as the number the
    //   server most recently told us are in the folder.
    // - (There are no messages in the folder at all OR)
    // - We have synchronized past the oldest known message header.  (This,
    //   in combination with the fact that we always open from the most recent
    //   set of messages we know about, that we fully synchronize all time
    //   intervals (for now!), and our pastwards-direction for refreshes means
    //   that we can conclude we have synchronized across all messages and
    //   this is a sane conclusion to draw.)
    //
    // NB: If there are any deleted messages, this logic will not save us
    // because we ignored those messages.  This is made less horrible by issuing
    // a time-date that expands as we go further back in time.
    //
    // (I have considered asking to see deleted messages too and ignoring them;
    // that might be suitable.  We could also just be a jerk and force an
    // expunge.)
    var folderMessageCount = this.folderConn && this.folderConn.box &&
                             this.folderConn.box.exists,
        dbCount = this.folderStorage.getKnownMessageCount(),
        syncedThrough =
          ((this._curSyncDir === PASTWARDS) ? effStartTS : effEndTS);
    console.log(
      "folder message count", folderMessageCount,
      "dbCount", dbCount,
      "syncedThrough", syncedThrough,
      "oldest known", this.folderStorage.getOldestMessageTimestamp());
    if (this._curSyncDir === PASTWARDS &&
        folderMessageCount === dbCount &&
        (!folderMessageCount ||
         TIME_DIR_AT_OR_BEYOND(this._curSyncDir, syncedThrough,
                               this.folderStorage.getOldestMessageTimestamp()))
       ) {
      // expand the accuracy range to cover everybody
      this.folderStorage.markSyncedToDawnOfTime();
      this._doneSync();
      return;
    }
    // If we've synchronized to the limits of syncing in the given direction,
    // we're done.
    if (!this._nextSyncAnchorTS ||
        TIME_DIR_AT_OR_BEYOND(this._curSyncDir, this._nextSyncAnchorTS,
                              this._syncThroughTS)) {
      this._doneSync();
      return;
    }

    // - Done if this is a grow and we don't want/need any more headers.
    if (this._curSyncIsGrow &&
        this._syncSlice.headers.length >= this._syncSlice.desiredHeaders) {
        // (limited syncs aren't allowed to expand themselves)
      console.log("SYNCDONE Enough headers retrieved.",
                  "have", this._syncSlice.headers.length,
                  "want", this._syncSlice.desiredHeaders,
                  "conn knows about", this.folderConn.box.exists,
                  "sync date", this._curSyncStartTS,
                  "[oldest defined as", $sync.OLDEST_SYNC_DATE, "]");
      this._doneSync();
      return;
    }

    // - Increase our search window size if we aren't finding anything
    // Our goal is that if we are going backwards in time and aren't finding
    // anything, we want to keep expanding our window
    var daysToSearch, lastSyncDaysInPast;
    // If we saw messages, there is no need to increase the window size.  We
    // also should not increase the size if we explicitly shrank the window and
    // left a do-not-expand-until marker.
    if (messagesSeen || (this._curSyncDoNotGrowBoundary !== null &&
         !TIME_DIR_AT_OR_BEYOND(this._curSyncDir, this._nextSyncAnchorTS,
                                this._curSyncDoNotGrowBoundary))) {
      daysToSearch = this._curSyncDayStep;
    }
    else {
      this._curSyncDoNotGrowBoundary = null;
      // This may be a fractional value because of DST
      lastSyncDaysInPast = (quantizeDate(NOW()) -
                           this._nextSyncAnchorTS) / DAY_MILLIS;
      daysToSearch = Math.ceil(this._curSyncDayStep *
                               $sync.TIME_SCALE_FACTOR_ON_NO_MESSAGES);

      // These values used to be more conservative, but the importance of these
      // guards was reduced when we switched to only syncing headers.
      // At current constants (sync=3, scale=2), our doubling in the face of
      // clamping is: 3, 6, 12, 24, 45, ... 90,
      if (lastSyncDaysInPast < 180) {
        if (daysToSearch > 45)
          daysToSearch = 45;
      }
      else if (lastSyncDaysInPast < 365) { // 1 year
        if (daysToSearch > 90)
          daysToSearch = 90;
      }
      else if (lastSyncDaysInPast < 730) { // 2 years
        if (daysToSearch > 120)
          daysToSearch = 120;
      }
      else if (lastSyncDaysInPast < 1825) { // 5 years
        if (daysToSearch > 180)
          daysToSearch = 180;
      }
      else if (lastSyncDaysInPast < 3650) { // 10 years
        if (daysToSearch > 365)
          daysToSearch = 365;
      }
      else if (daysToSearch > 730) {
        daysToSearch = 730;
      }
      this._curSyncDayStep = daysToSearch;
    }

    // - Move the time range back in time more.
    var startTS, endTS;
    if (this._curSyncDir === PASTWARDS) {
      endTS = this._nextSyncAnchorTS;
      this._nextSyncAnchorTS = startTS = makeDaysBefore(endTS, daysToSearch);
    }
    else { // FUTUREWARDS
      startTS = this._nextSyncAnchorTS;
      this._nextSyncAnchorTS = endTS = makeDaysBefore(startTS, -daysToSearch);
      // If this is a bisection that originally had an endTS of null and this
      // is going to be our last step, convert endTS back to a null.
      // (We use the same step check from above for consistency.  We also
      // are trying to do the smallest perturbation to this legacy logic, so
      // we only permute endTS, not _nextSyncAnchorTS although nulling it out
      // should at first glance merely cause us to short-circuit into the
      // _doneSync case before running the check which we know will return
      // true barring the clock jumping backwards.)
      if (this._syncThroughTS === null &&
          TIME_DIR_AT_OR_BEYOND(this._curSyncDir, this._nextSyncAnchorTS,
                                this._syncThroughTS)) {
        endTS = null;
      }
    }
    this.folderConn.syncDateRange(startTS, endTS, this._curSyncAccuracyStamp,
                                  this.onSyncCompleted.bind(this));
  },

  /**
   * Invoked when there are no longer any live slices on the folder and no more
   * active/enqueued mutex ops.
   */
  allConsumersDead: function() {
    this.folderConn.relinquishConn();
  },

  shutdown: function() {
    this.folderConn.shutdown();
  },
};

/**
 * ALL SPECULATIVE RIGHT NOW.
 *
 * Like ImapFolderStorage, but with only one folder and messages named by their
 * X-GM-MSGID value rather than their UID(s).
 *
 * Deletion processing operates slightly differently than for normal IMAP
 * because a message can be removed from one of the folders we synchronize on,
 * but not all of them.  We don't want to be overly deletionary in that case,
 * so we maintain a list of folder id's that are keeping each message alive.
 */
function GmailMessageStorage() {
}
GmailMessageStorage.prototype = {
};

}); // end define
;
(function(root, factory) {
    
    if (typeof define === 'function' && define.amd) {
        define('mimeparser-tzabbr',factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.tzabbr = factory();
    }
}(this, function() {
    

    return {
        "ACDT": "+1030",
        "ACST": "+0930",
        "ACT": "+0800",
        "ADT": "-0300",
        "AEDT": "+1100",
        "AEST": "+1000",
        "AFT": "+0430",
        "AKDT": "-0800",
        "AKST": "-0900",
        "AMST": "-0300",
        "AMT": "+0400",
        "ART": "-0300",
        "AST": "+0300",
        "AWDT": "+0900",
        "AWST": "+0800",
        "AZOST": "-0100",
        "AZT": "+0400",
        "BDT": "+0800",
        "BIOT": "+0600",
        "BIT": "-1200",
        "BOT": "-0400",
        "BRT": "-0300",
        "BST": "+0600",
        "BTT": "+0600",
        "CAT": "+0200",
        "CCT": "+0630",
        "CDT": "-0500",
        "CEDT": "+0200",
        "CEST": "+0200",
        "CET": "+0100",
        "CHADT": "+1345",
        "CHAST": "+1245",
        "CHOT": "+0800",
        "CHST": "+1000",
        "CHUT": "+1000",
        "CIST": "-0800",
        "CIT": "+0800",
        "CKT": "-1000",
        "CLST": "-0300",
        "CLT": "-0400",
        "COST": "-0400",
        "COT": "-0500",
        "CST": "-0600",
        "CT": "+0800",
        "CVT": "-0100",
        "CWST": "+0845",
        "CXT": "+0700",
        "DAVT": "+0700",
        "DDUT": "+1000",
        "DFT": "+0100",
        "EASST": "-0500",
        "EAST": "-0600",
        "EAT": "+0300",
        "ECT": "-0500",
        "EDT": "-0400",
        "EEDT": "+0300",
        "EEST": "+0300",
        "EET": "+0200",
        "EGST": "+0000",
        "EGT": "-0100",
        "EIT": "+0900",
        "EST": "-0500",
        "FET": "+0300",
        "FJT": "+1200",
        "FKST": "-0300",
        "FKT": "-0400",
        "FNT": "-0200",
        "GALT": "-0600",
        "GAMT": "-0900",
        "GET": "+0400",
        "GFT": "-0300",
        "GILT": "+1200",
        "GIT": "-0900",
        "GMT": "+0000",
        "GST": "+0400",
        "GYT": "-0400",
        "HADT": "-0900",
        "HAEC": "+0200",
        "HAST": "-1000",
        "HKT": "+0800",
        "HMT": "+0500",
        "HOVT": "+0700",
        "HST": "-1000",
        "ICT": "+0700",
        "IDT": "+0300",
        "IOT": "+0300",
        "IRDT": "+0430",
        "IRKT": "+0900",
        "IRST": "+0330",
        "IST": "+0530",
        "JST": "+0900",
        "KGT": "+0600",
        "KOST": "+1100",
        "KRAT": "+0700",
        "KST": "+0900",
        "LHST": "+1030",
        "LINT": "+1400",
        "MAGT": "+1200",
        "MART": "-0930",
        "MAWT": "+0500",
        "MDT": "-0600",
        "MET": "+0100",
        "MEST": "+0200",
        "MHT": "+1200",
        "MIST": "+1100",
        "MIT": "-0930",
        "MMT": "+0630",
        "MSK": "+0400",
        "MST": "-0700",
        "MUT": "+0400",
        "MVT": "+0500",
        "MYT": "+0800",
        "NCT": "+1100",
        "NDT": "-0230",
        "NFT": "+1130",
        "NPT": "+0545",
        "NST": "-0330",
        "NT": "-0330",
        "NUT": "-1100",
        "NZDT": "+1300",
        "NZST": "+1200",
        "OMST": "+0700",
        "ORAT": "+0500",
        "PDT": "-0700",
        "PET": "-0500",
        "PETT": "+1200",
        "PGT": "+1000",
        "PHOT": "+1300",
        "PHT": "+0800",
        "PKT": "+0500",
        "PMDT": "-0200",
        "PMST": "-0300",
        "PONT": "+1100",
        "PST": "-0800",
        "PYST": "-0300",
        "PYT": "-0400",
        "RET": "+0400",
        "ROTT": "-0300",
        "SAKT": "+1100",
        "SAMT": "+0400",
        "SAST": "+0200",
        "SBT": "+1100",
        "SCT": "+0400",
        "SGT": "+0800",
        "SLST": "+0530",
        "SRT": "-0300",
        "SST": "+0800",
        "SYOT": "+0300",
        "TAHT": "-1000",
        "THA": "+0700",
        "TFT": "+0500",
        "TJT": "+0500",
        "TKT": "+1300",
        "TLT": "+0900",
        "TMT": "+0500",
        "TOT": "+1300",
        "TVT": "+1200",
        "UCT": "+0000",
        "ULAT": "+0800",
        "UTC": "+0000",
        "UYST": "-0200",
        "UYT": "-0300",
        "UZT": "+0500",
        "VET": "-0430",
        "VLAT": "+1000",
        "VOLT": "+0400",
        "VOST": "+0600",
        "VUT": "+1100",
        "WAKT": "+1200",
        "WAST": "+0200",
        "WAT": "+0100",
        "WEDT": "+0100",
        "WEST": "+0100",
        "WET": "+0000",
        "WST": "+0800",
        "YAKT": "+1000",
        "YEKT": "+0600",
        "Z": "+0000"
    };
}));
// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function(root, factory) {
    

    if (typeof define === 'function' && define.amd) {
        define('mimeparser',['mimefuncs', 'addressparser', 'mimeparser-tzabbr'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('mimefuncs'), require('wo-addressparser'), require('./mimeparser-tzabbr'));
    } else {
        root.MimeParser = factory(root.mimefuncs, root.addressparser, root.tzabbr);
    }

}(this, function(mimefuncs, addressparser, tzabbr) {
    

    /**
     * Creates a parser for a mime stream
     *
     * @constructor
     */
    function MimeParser() {
        /**
         * Returned to the write calls
         */
        this.running = true;

        /**
         * Cache for parsed node objects
         */
        this.nodes = {};

        /**
         * Root node object
         */
        this.node = new MimeNode(null, this);

        /**
         * Data is written to nodes one line at the time. If entire line
         * is not received yet, buffer it before passing on
         */
        this._remainder = '';
    }

    /**
     * Writes a chunk of data to the processing queue. Splits data to lines and feeds
     * complete lines to the current node element
     *
     * @param {Uint8Array|String} chunk Chunk to be processed. Either an Uint8Array value or a 'binary' string
     */
    MimeParser.prototype.write = function(chunk) {
        if (!chunk || !chunk.length) {
            return !this.running;
        }

        var lines = (this._remainder + (typeof chunk === 'object' ?
            mimefuncs.fromTypedArray(chunk) : chunk)).split(/\r?\n/g);
        this._remainder = lines.pop();

        for (var i = 0, len = lines.length; i < len; i++) {
            this.node.writeLine(lines[i]);
        }

        return !this.running;
    };

    /**
     * Indicates that there is no more data coming
     *
     * @param {Uint8Array|String} [chunk] Final chunk to be processed
     */
    MimeParser.prototype.end = function(chunk) {
        if (chunk && chunk.length) {
            this.write(chunk);
        }

        if (this.node._lineCount || this._remainder) {
            this.node.writeLine(this._remainder);
            this._remainder = '';
        }

        if (this.node) {
            this.node.finalize();
        }

        this.onend();
    };

    /**
     * Retrieves a mime part object for specified path
     *
     *   parser.getNode('1.2.3')
     *
     * @param {String} path Path to the node
     */
    MimeParser.prototype.getNode = function(path) {
        path = path || '';
        return this.nodes['node' + path] || null;
    };

    // PARSER EVENTS

    /**
     * Override this function.
     * Called when the parsing is ended
     * @event
     */
    MimeParser.prototype.onend = function() {};

    /**
     * Override this function.
     * Called when the parsing is ended
     * @event
     * @param {Object} node Current mime part. See node.header for header lines
     */
    MimeParser.prototype.onheader = function() {};

    /**
     * Override this function.
     * Called when a body chunk is emitted
     * @event
     * @param {Object} node Current mime part
     * @param {Uint8Array} chunk Body chunk
     */
    MimeParser.prototype.onbody = function() {};

    // NODE PROCESSING

    /**
     * Creates an object that holds and manages one part of the multipart message
     *
     * @constructor
     * @param {Object} parentNode Reference to the parent element. If not specified, then this is root node
     * @param {Object} parser MimeParser object
     */
    function MimeNode(parentNode, parser) {

        // Public properties

        /**
         * An array of unfolded header lines
         */
        this.header = [];

        /**
         * An object that holds header key=value pairs
         */
        this.headers = {};

        /**
         * Path for this node
         */
        this.path = parentNode ? parentNode.path.concat(parentNode._childNodes.length + 1) : [];

        // Private properties

        /**
         * Reference to the 'master' parser object
         */
        this._parser = parser;

        /**
         * Parent node for this specific node
         */
        this._parentNode = parentNode;

        /**
         * Current state, always starts out with HEADER
         */
        this._state = 'HEADER';

        /**
         * Body buffer
         */
        this._bodyBuffer = '';

        /**
         * Line counter bor the body part
         */
        this._lineCount = 0;

        /**
         * If this is a multipart or message/rfc822 mime part, the value
         * will be converted to array and hold all child nodes for this node
         */
        this._childNodes = false;

        /**
         * Active child node (if available)
         */
        this._currentChild = false;

        /**
         * Remainder string when dealing with base64 and qp values
         */
        this._lineRemainder = '';

        /**
         * Indicates if this is a multipart node
         */
        this._isMultipart = false;

        /**
         * Stores boundary value for current multipart node
         */
        this._multipartBoundary = false;

        /**
         * Indicates if this is a message/rfc822 node
         */
        this._isRfc822 = false;

        /**
         * Stores the raw content of this node
         */
        this.raw = '';

        // Att this node to the path cache
        this._parser.nodes['node' + this.path.join('.')] = this;
    }

    // Public methods

    /**
     * Processes an enitre input line
     *
     * @param {String} line Entire input line as 'binary' string
     */
    MimeNode.prototype.writeLine = function(line) {

        this.raw += (this.raw ? '\n' : '') + line;

        if (this._state === 'HEADER') {
            this._processHeaderLine(line);
        } else if (this._state === 'BODY') {
            this._processBodyLine(line);
        }
    };

    /**
     * Processes any remainders
     */
    MimeNode.prototype.finalize = function() {
        if (this._isRfc822) {
            this._currentChild.finalize();
        } else {
            this._emitBody(true);
        }
    };

    // Private methods

    /**
     * Processes a line in the HEADER state. It the line is empty, change state to BODY
     *
     * @param {String} line Entire input line as 'binary' string
     */
    MimeNode.prototype._processHeaderLine = function(line) {
        if (!line) {
            this._parseHeaders();
            this._parser.onheader(this);
            this._state = 'BODY';
            return;
        }

        if (line.match(/^\s/) && this.header.length) {
            this.header[this.header.length - 1] += '\n' + line;
        } else {
            this.header.push(line);
        }
    };

    /**
     * Joins folded header lines and calls Content-Type and Transfer-Encoding processors
     */
    MimeNode.prototype._parseHeaders = function() {

        // Join header lines
        var key, value, hasBinary;

        for (var i = 0, len = this.header.length; i < len; i++) {
            value = this.header[i].split(':');
            key = (value.shift() || '').trim().toLowerCase();
            value = (value.join(':') || '').replace(/\n/g, '').trim();

            if (value.match(/[\u0080-\uFFFF]/)) {
                if (!this.charset) {
                    hasBinary = true;
                }
                // use default charset at first and if the actual charset is resolved, the conversion is re-run
                value = mimefuncs.charset.decode(mimefuncs.charset.convert(mimefuncs.toTypedArray(value), this.charset || 'iso-8859-1'));
            }

            if (!this.headers[key]) {
                this.headers[key] = [this._parseHeaderValue(key, value)];
            } else {
                this.headers[key].push(this._parseHeaderValue(key, value));
            }

            if (!this.charset && key === 'content-type') {
                this.charset = this.headers[key][this.headers[key].length - 1].params.charset;
            }

            if (hasBinary && this.charset) {
                // reset values and start over once charset has been resolved and 8bit content has been found
                hasBinary = false;
                this.headers = {};
                i = -1; // next iteration has i == 0
            }
        }

        this._processContentType();
        this._processContentTransferEncoding();
    };

    /**
     * Parses single header value
     * @param {String} key Header key
     * @param {String} value Value for the key
     * @return {Object} parsed header
     */
    MimeNode.prototype._parseHeaderValue = function(key, value) {
        var parsedValue, isAddress = false;

        switch (key) {
            case 'content-type':
            case 'content-transfer-encoding':
            case 'content-disposition':
            case 'dkim-signature':
                parsedValue = mimefuncs.parseHeaderValue(value);
                break;
            case 'from':
            case 'sender':
            case 'to':
            case 'reply-to':
            case 'cc':
            case 'bcc':
            case 'abuse-reports-to':
            case 'errors-to':
            case 'return-path':
            case 'delivered-to':
                isAddress = true;
                parsedValue = {
                    value: [].concat(addressparser.parse(value) || [])
                };
                break;
            case 'date':
                parsedValue = {
                    value: this._parseDate(value)
                };
                break;
            default:
                parsedValue = {
                    value: value
                };
        }
        parsedValue.initial = value;

        this._decodeHeaderCharset(parsedValue, {
            isAddress: isAddress
        });

        return parsedValue;
    };

    /**
     * Checks if a date string can be parsed. Falls back replacing timezone
     * abbrevations with timezone values
     *
     * @param {String} str Date header
     * @returns {String} UTC date string if parsing succeeded, otherwise returns input value
     */
    MimeNode.prototype._parseDate = function(str) {
        str = (str || '').toString().trim();

        var date = new Date(str);

        if (this._isValidDate(date)) {
            return date.toUTCString().replace(/GMT/, '+0000');
        }

        // Assume last alpha part is a timezone
        // Ex: "Date: Thu, 15 May 2014 13:53:30 EEST"
        str = str.replace(/\b[a-z]+$/i, function(tz) {
            tz = tz.toUpperCase();
            if (tzabbr.hasOwnProperty(tz)) {
                return tzabbr[tz];
            }
            return tz;
        });

        date = new Date(str);

        if (this._isValidDate(date)) {
            return date.toUTCString().replace(/GMT/, '+0000');
        } else {
            return str;
        }
    };

    /**
     * Checks if a value is a Date object and it contains an actual date value
     * @param {Date} date Date object to check
     * @returns {Boolean} True if the value is a valid date
     */
    MimeNode.prototype._isValidDate = function(date) {
        return Object.prototype.toString.call(date) === '[object Date]' && date.toString() !== 'Invalid Date';
    };

    MimeNode.prototype._decodeHeaderCharset = function(parsed, options) {
        options = options || {};

        // decode default value
        if (typeof parsed.value === 'string') {
            parsed.value = mimefuncs.mimeWordsDecode(parsed.value);
        }

        // decode possible params
        Object.keys(parsed.params || {}).forEach(function(key) {
            if (typeof parsed.params[key] === 'string') {
                parsed.params[key] = mimefuncs.mimeWordsDecode(parsed.params[key]);
            }
        });

        // decode addresses
        if (options.isAddress && Array.isArray(parsed.value)) {
            parsed.value.forEach(function(addr) {
                if (addr.name) {
                    addr.name = mimefuncs.mimeWordsDecode(addr.name);
                    if (Array.isArray(addr.group)) {
                        this._decodeHeaderCharset({
                            value: addr.group
                        }, {
                            isAddress: true
                        });
                    }
                }
            }.bind(this));
        }

        return parsed;
    };

    /**
     * Parses Content-Type value and selects following actions.
     */
    MimeNode.prototype._processContentType = function() {
        var contentDisposition;

        this.contentType = this.headers['content-type'] && this.headers['content-type'][0] ||
            mimefuncs.parseHeaderValue('text/plain');
        this.contentType.value = (this.contentType.value || '').toLowerCase().trim();
        this.contentType.type = (this.contentType.value.split('/').shift() || 'text');

        if (this.contentType.params && this.contentType.params.charset && !this.charset) {
            this.charset = this.contentType.params.charset;
        }

        if (this.contentType.type === 'multipart' && this.contentType.params.boundary) {
            this._childNodes = [];
            this._isMultipart = (this.contentType.value.split('/').pop() || 'mixed');
            this._multipartBoundary = this.contentType.params.boundary;
        }

        if (this.contentType.value === 'message/rfc822') {
            /**
             * Parse message/rfc822 only if the mime part is not marked with content-disposition: attachment,
             * otherwise treat it like a regular attachment
             */
            contentDisposition = this.headers['content-disposition'] && this.headers['content-disposition'][0] ||
                mimefuncs.parseHeaderValue('');
            if ((contentDisposition.value || '').toLowerCase().trim() !== 'attachment') {
                this._childNodes = [];
                this._currentChild = new MimeNode(this, this._parser);
                this._childNodes.push(this._currentChild);
                this._isRfc822 = true;
            }
        }
    };

    /**
     * Parses Content-Trasnfer-Encoding value to see if the body needs to be converted
     * before it can be emitted
     */
    MimeNode.prototype._processContentTransferEncoding = function() {
        this.contentTransferEncoding = this.headers['content-transfer-encoding'] && this.headers['content-transfer-encoding'][0] ||
            mimefuncs.parseHeaderValue('7bit');
        this.contentTransferEncoding.value = (this.contentTransferEncoding.value || '').toLowerCase().trim();
    };

    /**
     * Processes a line in the BODY state. If this is a multipart or rfc822 node,
     * passes line value to child nodes.
     *
     * @param {String} line Entire input line as 'binary' string
     */
    MimeNode.prototype._processBodyLine = function(line) {
        var curLine, match;

        this._lineCount++;

        if (this._isMultipart) {
            if (line === '--' + this._multipartBoundary) {
                if (this._currentChild) {
                    this._currentChild.finalize();
                }
                this._currentChild = new MimeNode(this, this._parser);
                this._childNodes.push(this._currentChild);
            } else if (line === '--' + this._multipartBoundary + '--') {
                if (this._currentChild) {
                    this._currentChild.finalize();
                }
                this._currentChild = false;
            } else if (this._currentChild) {
                this._currentChild.writeLine(line);
            } else {
                // Ignore body for multipart
            }
        } else if (this._isRfc822) {
            this._currentChild.writeLine(line);
        } else {
            switch (this.contentTransferEncoding.value) {
                case 'base64':
                    curLine = this._lineRemainder + line.trim();

                    if (curLine.length % 4) {
                        this._lineRemainder = curLine.substr(-curLine.length % 4);
                        curLine = curLine.substr(0, curLine.length - this._lineRemainder.length);
                    } else {
                        this._lineRemainder = '';
                    }

                    if (curLine.length) {
                        this._bodyBuffer += mimefuncs.fromTypedArray(mimefuncs.base64.decode(curLine));
                    }

                    break;
                case 'quoted-printable':
                    curLine = this._lineRemainder + (this._lineCount > 1 ? '\n' : '') + line;

                    if ((match = curLine.match(/=[a-f0-9]{0,1}$/i))) {
                        this._lineRemainder = match[0];
                        curLine = curLine.substr(0, curLine.length - this._lineRemainder.length);
                    } else {
                        this._lineRemainder = '';
                    }

                    this._bodyBuffer += curLine.replace(/\=(\r?\n|$)/g, '').replace(/=([a-f0-9]{2})/ig, function(m, code) {
                        return String.fromCharCode(parseInt(code, 16));
                    });
                    break;
                    // case '7bit':
                    // case '8bit':
                default:
                    this._bodyBuffer += (this._lineCount > 1 ? '\n' : '') + line;
                    break;
            }
        }
    };

    /**
     * Emits a chunk of the body
     *
     * @param {Boolean} forceEmit If set to true does not keep any remainders
     */
    MimeNode.prototype._emitBody = function() {
        var contentDisposition = this.headers['content-disposition'] && this.headers['content-disposition'][0] ||
            mimefuncs.parseHeaderValue('');
        var delSp;

        if (this._isMultipart || !this._bodyBuffer) {
            return;
        }

        // Process flowed text before emitting it
        if (/^text\/(plain|html)$/i.test(this.contentType.value) &&
            this.contentType.params && /^flowed$/i.test(this.contentType.params.format)) {

            delSp = /^yes$/i.test(this.contentType.params.delsp);

            this._bodyBuffer = this._bodyBuffer.
            split('\n').
            // remove soft linebreaks
            // soft linebreaks are added after space symbols
            reduce(function(previousValue, currentValue, index) {
                var body = previousValue;
                if (delSp) {
                    // delsp adds spaces to text to be able to fold it
                    // these spaces can be removed once the text is unfolded
                    body = body.replace(/[ ]+$/, '');
                }
                if (/ $/.test(previousValue) && !/(^|\n)\-\- $/.test(previousValue)) {
                    return body + currentValue;
                } else {
                    return body + '\n' + currentValue;
                }
            }).
            // remove whitespace stuffing
            // http://tools.ietf.org/html/rfc3676#section-4.4
            replace(/^ /gm, '');
        }

        this.content = mimefuncs.toTypedArray(this._bodyBuffer);

        if (/^text\/(plain|html)$/i.test(this.contentType.value) && !/^attachment$/i.test(contentDisposition.value)) {

            if (!this.charset && /^text\/html$/i.test(this.contentType.value)) {
                this.charset = this._detectHTMLCharset(this._bodyBuffer);
            }

            // decode "binary" string to an unicode string
            if (!/^utf[\-_]?8$/i.test(this.charset)) {
                this.content = mimefuncs.charset.convert(mimefuncs.toTypedArray(this._bodyBuffer), this.charset || 'iso-8859-1');
            }

            // override charset for text nodes
            this.charset = this.contentType.params.charset = 'utf-8';
        }
        this._bodyBuffer = '';

        this._parser.onbody(this, this.content);
    };

    /**
     * Detect charset from a html file
     *
     * @param {String} html Input HTML
     * @returns {String} Charset if found or undefined
     */
    MimeNode.prototype._detectHTMLCharset = function(html) {
        var charset, input, meta;

        if (typeof html !== 'string') {
            html = html.toString('ascii');
        }

        html = html.replace(/\r?\n|\r/g, " ");

        if ((meta = html.match(/<meta\s+http-equiv=["'\s]*content-type[^>]*?>/i))) {
            input = meta[0];
        }

        if (input) {
            charset = input.match(/charset\s?=\s?([a-zA-Z\-_:0-9]*);?/);
            if (charset) {
                charset = (charset[1] || '').trim().toLowerCase();
            }
        }

        if (!charset && (meta = html.match(/<meta\s+charset=["'\s]*([^"'<>\/\s]+)/i))) {
            charset = (meta[1] || '').trim().toLowerCase();
        }

        return charset;
    };

    return MimeParser;
}));

/**
 * Abstractions for dealing with the various mutation operations.
 *
 * NB: Moves discussion is speculative at this point; we are just thinking
 * things through for architectural implications.
 *
 * == Speculative Operations ==
 *
 * We want our UI to update as soon after requesting an operation as possible.
 * To this end, we have logic to locally apply queued mutation operations.
 * Because we may want to undo operations when we are offline (and have not
 * been able to talk to the server), we also need to be able to reflect these
 * changes locally independent of telling the server.
 *
 * In the case of moves/copies, we issue a(n always locally created) id for the
 * message immediately and just set the server UID (srvid) to 0 to be populated
 * by the sync process.
 *
 * == Data Integrity ==
 *
 * Our strategy is always to avoid server data-loss, so data-destruction actions
 * must always take place after successful confirmation of persistence actions.
 * (Just keeping the data in-memory is not acceptable because we could crash,
 * etc.)
 *
 * This is in contrast to our concern about losing simple, frequently performed
 * idempotent user actions in a crash.  We assume that A) crashes will be
 * rare, B) the user will not be surprised or heart-broken if a message they
 * marked read a second before a crash needs to manually be marked read after
 * restarting the app/device, and C) there are performance/system costs to
 * saving the state which makes this a reasonable trade-off.
 *
 * It is also our strategy to avoid cluttering up the place as a side-effect
 * of half-done things.  For example, if we are trying to move N messages,
 * but only copy N/2 because of a timeout, we want to make sure that we
 * don't naively retry and then copy those first N/2 messages a second time.
 * This means that we track sub-steps explicitly, and that operations that we
 * have issued and may or may not have been performed by the server will be
 * checked before they are re-attempted.  (Although IMAP batch operations
 * are atomic, and our IndexedDB commits are atomic, they are atomic independent
 * of each other and so we could have been notified that the copy completed
 * but not persisted the fact to our database.)
 *
 * In the event we restore operations from disk that were enqueued but
 * apparently not run, we compel them to run a check operation before they are
 * performed because it's possible (depending on the case) for us to have run
 * them without saving the account state first.  This is a trade-off between the
 * cost of checking and the cost of issuing commits to the database frequently
 * based on the expected likelihood of a crash on our part.  Per comments above,
 * we expect crashes to be rare and not particularly correlated with operations,
 * so it's better for the device (both flash and performance) if we don't
 * continually checkpoint our state.
 *
 * All non-idempotent operations / operations that could result in data loss or
 * duplication require that we save our account state listing the operation.  In
 * the event of a crash, this allows us to know that we have to check the state
 * of the operation for completeness before attempting to run it again and
 * allowing us to finish half-done things.  For particular example, because
 * moves consist of a copy followed by flagging a message deleted, it is of the
 * utmost importance that we don't get in a situation where we have copied the
 * messages but not deleted them and we crash.  In that case, if we failed to
 * persist our plans, we will have duplicated the message (and the IMAP server
 * would have no reason to believe that was not our intent.)
 **/

define(
  'imap/jobs',[
    'logic',
    'mix',
    '../jobmixins',
    '../drafts/jobs',
    '../allback',
    'mimeparser',
    'module',
    'exports'
  ],
  function(
    logic,
    mix,
    $jobmixins,
    draftsJobs,
    allback,
    MimeParser,
    $module,
    exports
  ) {

/**
 * The evidence suggests the job has not yet been performed.
 */
var CHECKED_NOTYET = 'checked-notyet';
/**
 * The operation is idempotent and atomic, just perform the operation again.
 * No checking performed.
 */
var UNCHECKED_IDEMPOTENT = 'idempotent';
/**
 * The evidence suggests that the job has already happened.
 */
var CHECKED_HAPPENED = 'happened';
/**
 * The job is no longer relevant because some other sequence of events
 * have mooted it.  For example, we can't change tags on a deleted message
 * or move a message between two folders if it's in neither folder.
 */
var CHECKED_MOOT = 'moot';
/**
 * A transient error (from the checker's perspective) made it impossible to
 * check.
 */
var UNCHECKED_BAILED = 'bailed';
/**
 * The job has not yet been performed, and the evidence is that the job was
 * not marked finished because our database commits are coherent.  This is
 * appropriate for retrieval of information, like the downloading of
 * attachments.
 */
var UNCHECKED_COHERENT_NOTYET = 'coherent-notyet';

/**
 * In the event the server is horrible and does not tell us delimiter info, we
 * need to pick one.  The horrible servers I've seen all seem to use '/', so
 * let's just arbitrarily go with that.
 */
var FALLBACK_FOLDER_DELIM = '/';

/**
 * Figure out the correct name for a folder given the parent folder and
 * namespace information.  Note that because there exist certain IMAP
 * implementations out there that don't return a namespace delimiter, we
 * may still need to fall back to FALLBACK_FOLDER_DELIM.  In the future we
 * can improve on this by looking at what other delimiters have been reported.
 * (We have seen both null namespace delimiters and null INBOX delimiters.)
 *
 * We export this function so it can be unit-tested in isolation.
 *
 * @param {String} name
 *   The name of the folder we want to create.  It does not need to be encoded;
 *   that will happen in browserbox.
 * @param {Boolean} containOtherFolders
 *   Will this folder contain other folders?  The result is for us to append
 *   the delimiter if true.  The RFC 3501 semantics are that this should be
 *   passed when there will be child folders.  The real-world horrors mean
 *   that this is most likely an issue on a server using a storage mechanism
 *   where you can only have a file or a subdirectory with the given name.
 *   In general we expect to pass false for this right now.  When we support
 *   user folder creation, we'll need to do more of a survey here.  (We might
 *   want to do a probe step when creating an account to figure out what the
 *   server does to know whether we need to bother the user, etc.)
 * @param {FolderMeta} [parentFolderInfo]
 *   If we're creating this folder under another folder, the folderInfo.$meta
 *   for the folder.  This value should be null if we want to create a
 *   "top-level" folder.  Note that when the personal namespace is "INBOX."
 *   so that everything goes under the folder, passing a parentFolderInfo of
 *   INBOX or null should end up doing the same thing.  (Even if we didn't
 *   properly normalize this, the server would probably do it for us anyways;
 *   dovecot does, at least.
 *
 *   The parts of parentFolderInfo we use are just { path, delim, depth }.
 * @param {Object} personalNamespace
 *   The personal namespace info which can be characterized as { prefix,
 *   delimiter}.  We REQUIRE that the caller pass in an object here, although
 *   we do not require that the properties are present / non-null.
 *
 * @return
 *   An object of the form { path, delim, depth } where path is the path we
 *   derived, delim is what we think the effective delimiter character is at
 *   that point, and depth the depth of the folder.
 */
var deriveFolderPath = exports.deriveFolderPath =
function(name, containOtherFolders, parentFolderInfo, personalNamespace) {
  var path, delim, depth;
  // If we've got the parent folder info, we're doing pretty well but we
  // still might need to failover the delimiter.
  if (parentFolderInfo) {
    // We have seen INBOX folders and namespaces lacking indicated delimiters.
    delim = parentFolderInfo.delim ||
      personalNamespace.delimiter ||
      FALLBACK_FOLDER_DELIM;
    path = parentFolderInfo.path || '';
    depth = parentFolderInfo.depth + 1;
  } else {
    delim = personalNamespace.delimiter ||
      FALLBACK_FOLDER_DELIM;
    path = personalNamespace.prefix || '';
    depth = path ? 1: 0;
  }

  // If we're going under something, we need the delimiter.
  if (path) {
    path += delim;
  }

  path += name;

  if (containOtherFolders) {
    path += delim;
  }

  return { path: path, delimiter: delim, depth: depth };
};

/**
 * @typedef[MutationState @dict[
 *   @key[suidToServerId @dictof[
 *     @key[SUID]
 *     @value[ServerID]
 *   ]]{
 *     Tracks the server id (UID on IMAP) for an account as it is currently
 *     believed to exist on the server.  We persist this because the actual
 *     header may have been locally moved to another location already, so
 *     there may not be storage for the information in the folder when
 *     subsequent non-local operations run (such as another move or adding
 *     a tag).
 *
 *     This table is entirely populated by the actual (non-local) move
 *     operations.  Entries remain in this table until they are mooted by a
 *     subsequent move or the table is cleared once all operations for the
 *     account complete.
 *   }
 *   @key[moveMap @dictof[
 *     @key[oldSuid SUID]
 *     @value[newSuid SUID]
 *   ]]{
 *     Expresses the relationship between moved messages by local-operations.
 *   }
 * ]]
 *
 * @typedef[MutationStateDelta @dict[
 *   @key[serverIdMap @dictof[
 *     @key[suid SUID]
 *     @value[srvid @oneof[null ServerID]]
 *   ]]{
 *     New values for `MutationState.suidToServerId`; set/updated by by
 *     non-local operations once the operation has been performed.  A null
 *     `srvid` is used to convey the header no longer exists at the previous
 *     name.
 *   }
 *   @key[moveMap @dictof[
 *     @key[oldSuid SUID]
 *     @value[newSuid SUID]
 *   ]]{
 *     Expresses the relationship between moved messages by local-operations.
 *   }
 * ]]{
 *   A set of attributes that can be set on an operation to cause changes to
 *   the `MutationState` for the account.  This forms part of the interface
 *   of the operations.  The operations don't manipulate the table directly
 *   to reduce code duplication, ease debugging, and simplify unit testing.
 * }
 **/

function ImapJobDriver(account, state) {
  this.account = account;
  this.resilientServerIds = false;
  this._heldMutexReleasers = [];

  logic.defineScope(this, 'ImapJobDriver', { accountId: this.account.id });

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
exports.ImapJobDriver = ImapJobDriver;
ImapJobDriver.prototype = {
  /**
   * Request access to an IMAP folder to perform a mutation on it.  This
   * acquires a write mutex on the FolderStorage and compels the ImapFolderConn
   * in question to acquire an IMAP connection if it does not already have one.
   *
   * The callback will be invoked with the folder and raw connections once
   * they are available.  The raw connection will be actively in the folder.
   *
   * There is no need to explicitly release the connection when done; it will
   * be automatically released when the mutex is released if desirable.
   *
   * This will ideally be migrated to whatever mechanism we end up using for
   * mailjobs.
   *
   * @args[
   *   @param[folderId]
   *   @param[needConn Boolean]{
   *     True if we should try and get a connection from the server.  Local ops
   *     should pass false.
   *   }
   *   @param[callback @func[
   *     @args[
   *       @param[folderConn ImapFolderConn]
   *       @param[folderStorage FolderStorage]
   *     ]
   *   ]]
   *   @param[deathback Function]
   *   @param[label String]{
   *     The label to identify this usage for debugging purposes.
   *   }
   * ]
   */
  _accessFolderForMutation: function(folderId, needConn, callback, deathback,
                                     label) {
    var storage = this.account.getFolderStorageForFolderId(folderId),
        self = this;
    storage.runMutexed(label, function(releaseMutex) {
      var syncer = storage.folderSyncer;
      var action = function () {
        self._heldMutexReleasers.push(releaseMutex);
        try {
          callback(syncer.folderConn, storage);
        }
        catch (ex) {
          logic(self, 'callbackErr', { ex: ex });
        }
      };

      // localdrafts and outbox are synthetic folders and so we never
      // want a connection for them. This is a somewhat awkward place
      // to make this decision, but it does work.
      if (needConn && !storage.isLocalOnly) {
        syncer.folderConn.withConnection(function () {
          // When we release the mutex, the folder may not
          // release its connection, so be sure to reset
          // error handling (deathback).  We are slightly
          // abusing the mutex releasing mutex mechanism
          // here. And we do want to do this before calling
          // the actual mutex releaser since we might
          // otherwise interact with someone else who just
          // acquired the mutex, (only) theoretically.
          self._heldMutexReleasers.push(function() {
            syncer.folderConn.clearErrorHandler();
          });

          action();
        },
        // Always pass true for dieOnConnectFailure; we don't want any of our
        // operations hanging out waiting for retry backoffs.  The ops want to
        // only run when we believe we are online with a good connection.
        deathback, label, true);
      } else {
        action();
      }
    });
  },

  _partitionAndAccessFoldersSequentially:
    $jobmixins._partitionAndAccessFoldersSequentially,

  /**
   * Request access to a connection for some type of IMAP manipulation that does
   * not involve a folder known to the system (which should then be accessed via
   * _accessfolderForMutation).
   *
   * The connection will be automatically released when the operation completes,
   * there is no need to release it directly.
   */
  _acquireConnWithoutFolder: function(label, callback, deathback) {
    logic(this, 'acquireConnWithoutFolder_begin', { label: label });
    var self = this;
    this.account.__folderDemandsConnection(
      null, label,
      function(conn) {
        logic(self, 'acquireConnWithoutFolder_end', { label: label });
        self._heldMutexReleasers.push(function() {
          self.account.__folderDoneWithConnection(conn, false, false);
        });
        try {
          callback(conn);
        }
        catch (ex) {
          logic(self, 'callbackErr', { ex: ex });
        }
      },
      deathback
    );
  },

  postJobCleanup: $jobmixins.postJobCleanup,

  allJobsDone: $jobmixins.allJobsDone,

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
  // upgrade: perfom necessary upgrades when the db version changes

  local_do_upgradeDB: $jobmixins.local_do_upgradeDB,

  //////////////////////////////////////////////////////////////////////////////
  // modtags: Modify tags on messages

  local_do_modtags: $jobmixins.local_do_modtags,

  do_modtags: function(op, jobDoneCallback, undo) {
    var addTags = undo ? op.removeTags : op.addTags,
        removeTags = undo ? op.addTags : op.removeTags;

    var aggrErr = null;

    this._partitionAndAccessFoldersSequentially(
      op.messages, true,
      function perFolder(folderConn, storage, serverIds, namers, callWhenDone) {
        var uids = [];
        for (var i = 0; i < serverIds.length; i++) {
          var srvid = serverIds[i];
          // The header may have disappeared from the server, in which case the
          // header is moot.
          if (srvid)
            uids.push(srvid);
        }
        // Be done if all of the headers were moot.
        if (!uids.length) {
          callWhenDone();
          return;
        }

        var latch = allback.latch();

        if (addTags) {
          folderConn._conn.setFlags(
            uids.join(','),
            { add: addTags },
            { byUid: true },
            latch.defer('add'));
        } else if (removeTags) {
          folderConn._conn.setFlags(
            uids.join(','),
            { remove: removeTags },
            { byUid: true },
            latch.defer('remove'));
        }

        latch.then(function(results) {
          var err = (results.add && results.add[0]) ||
                (results.remove && results.remove[0]);
          if (err) {
            console.error('failure modifying tags', err);
            aggrErr = 'unknown';
          } else {
            op.progress += (undo ? -serverIds.length : serverIds.length);
          }
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
  },

  check_modtags: function(op, callback) {
    callback(null, UNCHECKED_IDEMPOTENT);
  },

  local_undo_modtags: $jobmixins.local_undo_modtags,

  undo_modtags: function(op, callback) {
    // Undoing is just a question of flipping the add and remove lists.
    return this.do_modtags(op, callback, true);
  },

  //////////////////////////////////////////////////////////////////////////////
  // delete: Delete messages

  local_do_delete: $jobmixins.local_do_delete,

  /**
   * Move the message to the trash folder.  In Gmail, there is no move target,
   * we just delete it and gmail will (by default) expunge it immediately.
   */
  do_delete: function(op, doneCallback) {
    var trashFolder = this.account.getFirstFolderWithType('trash');
    this.do_move(op, doneCallback, trashFolder.id);
  },

  check_delete: function(op, doneCallback) {
    var trashFolder = this.account.getFirstFolderWithType('trash');
    this.check_move(op, doneCallback, trashFolder.id);
  },

  local_undo_delete: $jobmixins.local_undo_delete,

  undo_delete: function(op, doneCallback) {
  },

  //////////////////////////////////////////////////////////////////////////////
  // move: Move messages between folders (in a single account)
  //
  // ## General Strategy ##
  //
  // Local Do:
  //
  // - Move the header to the target folder's storage, updating the op with the
  //   message-id header of the message for each message so that the check
  //   operation has them available.
  //
  //   This requires acquiring a write mutex to the target folder while also
  //   holding one on the source folder.  We are assured there is no deadlock
  //   because only operations are allowed to manipulate multiple folders at
  //   once, and only one operation is in-flight per an account at a time.
  //   (And cross-account moves are not handled by this operation.)
  //
  //   Insertion is done using the INTERNALDATE (which must be maintained by the
  //   COPY operation) and a freshly allocated id, just like if we had heard
  //   about the header from the server.
  //
  // Do:
  //
  // - Acquire a connection to the target folder so that we can know the UIDNEXT
  //   value prior to performing the copy.  FUTURE: Don't do this if the server
  //   supports UIDPLUS.
  //
  // (Do the following in a loop per-source folder)
  //
  // - Copy the messages to the target folder via COPY.
  //
  // - Figure out the UIDs of our moved messages.  FUTURE: If the server is
  //   UIDPLUS, we already know these from the results of the previous command.
  //   NOW: Issue a fetch on the message-id headers of the messages in the
  //   range UIDNEXT:*.  Use these results to map the UIDs to the messages we
  //   copied above.  In the event of duplicate message-id's, ordering doesn't
  //   matter, we just pick the first one.  Update our UIDNEXT value in case
  //   there is another pass through the loop.
  //
  // - Issue deletes on the messages from the source folder.
  //
  // Check: XXX TODO POSTPONED FOR PRELIMINARY LANDING
  //
  // NB: Our check implementation actually is a correcting check implemenation;
  // we will make things end up the way they should be.  We do this because it
  // is simpler than
  //
  // - Acquire a connection to the target folder.  Issue broad message-id
  //   header searches to find if the messages appear to be in the folder
  //   already, note which are already present.  This needs to take the form
  //   of a SEARCH followed by a FETCH to map UIDs to message-id's.  In theory
  //   the IMAP copy command should be atomic, but I'm not sure we can trust
  //   that and we also have the problem where there could already be duplicate
  //   message-id headers in the target which could confuse us if our check is
  //   insufficiently thorough.  The FETCH needs to also retrieve the flags
  //   for the message so we can track deletion state.
  //
  // (Do the following in a loop per source folder)
  //
  // - Acquire connections for each source folder.  Issue message-id searches
  //   like we did for the target including header results.  In theory we might
  //   remember the UIDs for check acceleration purposes, but that would not
  //   cover if we tried to perform an undo, so we go for thorough.
  //
  // -
  //
  // ## Possible Problems and their Solutions ##
  //
  // Moves are fairly complicated in terms of moving parts, so let's enumate the
  // way things could go wrong so we can make sure we address them and describe
  // how we address them.  Note that it's a given that we will have run our
  // local modifications prior to trying to talk to the server, which reduces
  // the potential badness.
  //
  // #1: We attempt to resynchronize the source folder for a move prior to
  //     running the operation against the server, resulting in us synchronizing
  //     a duplicate header into existence that will not be detected until the
  //     next resync of the time range (which will be strictly after when we
  //     actually run the mutation.
  //
  // #2: Operations scheduled against speculative headers.  It is quite possible
  //     for the user to perform actions against one of the locally /
  //     speculatively moved headers while we are offline/have not yet played
  //     the operation/are racing the UI while playing the operation.  We
  //     obviously want these changes to succeed.
  //
  // Our solutions:
  //
  // #1: Prior to resynchronizing a folder, we check if there are any operations
  //     that block synchronization.  An un-run move with a source of that
  //     folder counts as such an operation.  We can determine this by either
  //     having sufficient knowledge to inspect an operation or have operations
  //     directly modify book-keeping structures in the folders as part of their
  //     actions.  (Add blocker on local_(un)do, remove on (un)do.)  We choose
  //     to implement the inspection operation by having all operations
  //     implement a simple helper to tell us if the operation blocks entry.
  //     The theory is this will be less prone to bugs since it will be clear
  //     that operations need to implement the method, whereas it would be less
  //     clear that operations need to do call the folder-state mutating
  //     options.
  //
  // #2: Operations against speculative headers are a concern only from a naming
  //     perspective for operations.  Operations are strictly run in the order
  //     they are enqueued, so we know that the header will have been moved and
  //     be in the right folder.  Additionally, because both the UI and
  //     operations name messages using an id we issue rather than the server
  //     UID, there is no potential for naming inconsistencies.  The UID will be
  //     resolved at operation run-time which only requires that the move
  //     operation either was UIDPLUS or we manually sussed out the target id
  //     (which we do for simplicity).
  //
  // XXX problem: repeated moves and UIDs.
  // what we do know:
  // - in order to know about a message, we must have a current UID of the
  //   message on the server where it currently lives.
  // what we could do:
  // - have successor move operations moot/replace their predecessor.  So a
  //   move from A to B, and then from B to C will just become a move from A to
  //   C from the perspective of the online op that will eventually be run.  We
  //   could potentially build this on top of a renaming strategy.  So if we
  //   move z-in-A to z-in-B, and then change a tag on z-in-B, and then move
  //   z-in-B to z-in-C, renaming and consolidatin would make this a move of
  //   z-in-A to z-in-C followed by a tag change on z-in-C.
  // - produce micro-IMAP-ops as a byproduct of our local actions that are
  //   stored on the operation.  So in the A/move to B/tag/move to C case above,
  //   we would not consolidate anything, just produce a transaction journal.
  //   The A-move-to-B case would be covered by serializing the information
  //   for the IMAP COPY and deletion.  In the UIDPLUS case, we have an
  //   automatic knowledge of the resulting new target UID; in the non-UIDPLUS
  //   case we can open the target folder and find out the new UID as part of
  //   the micro-op.  The question here is then how we chain these various
  //   results together in the multi-move case, or when we write the result to
  //   the target:
  //   - maintain an output value map for the operations.  When there is just
  //     the one move, the output for the UID for each move is the current
  //     header name of the message, which we will load and write the value
  //     into.  When there are multiple moves, the output map is adjusted and
  //     used to indicate that we should stash the UID in quasi-persistent
  //     storage for a subsequent move operation.  (This could be thought of
  //     as similar to the renaming logic, but explicit.)


  local_do_move: $jobmixins.local_do_move,

  do_move: function(op, jobDoneCallback, targetFolderId) {
    var state = this._state, stateDelta = this._stateDelta, aggrErr = null;
    if (!stateDelta.serverIdMap)
      stateDelta.serverIdMap = {};
    if (!targetFolderId)
      targetFolderId = op.targetFolder;

    this._partitionAndAccessFoldersSequentially(
      op.messages, true,
      function perFolder(folderConn, sourceStorage, serverIds, namers,
                         perFolderDone){
        // XXX process UIDPLUS output when present, avoiding this step.
        var guidToNamer = {}, targetConn;

        // - got the target folder conn, now do the copies
        function gotTargetConn(targetConn, targetStorage) {
          var usingUid, nextId;
          // Some servers don't provide
          if (targetConn.box.uidNext) {
            usingUid = true;
            nextId = targetConn.box.uidNext;
          } else {
            usingUid = false;
            // Message sequence numbers are 1-based, so if 0 exist, then 1 is
            // the sequence number of the next message.  If 1 exists, its
            // number is 1, and the next number is 2.  And so on.
            nextId = targetConn.box.exists + 1;
          }

          folderConn._conn.copyMessages(serverIds.join(','),
                                        targetStorage.folderMeta.path,
                                        { byUid: true },
                                        copiedMessages_reselect);

          function copiedMessages_reselect() {
            // Force a re-select of the folder to try and force the server to
            // perceive the move.  This was necessary for me at least on my
            // dovceot test setup.  Although we had heard that the COPY
            // completed, our FETCH was too fast, although an IDLE did report
            // the new messages after that.
            targetConn._conn.selectMailbox(targetStorage.folderMeta.path,
                                           copiedMessages_findNewUIDs);
          }
          // - copies are done, find the UIDs
          function copiedMessages_findNewUIDs() {
            var fetcher = targetConn._conn.listMessages(
              nextId + ':*',
              ['UID', 'BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)]'],
              { byUid: usingUid },
              function (err, messages) {
                if (err) {
                  perFolderDone();
                } else {
                  var latch = allback.latch();
                  messages.forEach(function(msg) {
                    var messageDone = latch.defer();

                    for (var key in msg) {
                      if (/header\.fields/.test(key)) {
                        var headerParser = new MimeParser();
                        headerParser.write(msg[key] + '\r\n');
                        headerParser.end();
                        msg.headers = headerParser.node.headers;
                        break;
                      }
                    }

                    var guid = msg.headers['message-id'] &&
                          msg.headers['message-id'][0] &&
                          msg.headers['message-id'][0].value;
                    if (guid && guid[0] === '<') {
                      guid = guid.slice(1, -1); // Strip surrounding brackets.
                    }

                    if (!guidToNamer.hasOwnProperty(guid)) {
                      messageDone();
                      return;
                    }
                    var namer = guidToNamer[guid];
                    stateDelta.serverIdMap[namer.suid] = msg.uid;
                    var newSuid = state.moveMap[namer.suid];
                    var newId =
                          parseInt(newSuid.substring(newSuid.lastIndexOf('/') + 1));

                    targetStorage.updateMessageHeader(
                      namer.date, newId, false,
                      function(header) {
                        // If the header isn't there because it got
                        // moved, then null will be returned and it's
                        // up to the next move operation to fix this up.
                        if (header)
                          header.srvid = msg.uid;
                        else
                          console.warn('did not find header for', namer.suid,
                                       newSuid, namer.date, newId);

                        messageDone();
                        return true;
                      }, /* body hint */ null);
                  });
                  latch.then(foundUIDs_deleteOriginals);
                }
              });
          }
        }

        function foundUIDs_deleteOriginals() {
          folderConn._conn.deleteMessages(
            serverIds.join(','),
            { byUid: true },
            deletedMessages);
        }
        function deletedMessages(err) {
          if (err)
            aggrErr = true;
          perFolderDone();
        }

        // Build a guid-to-namer map and deal with any messages that no longer
        // exist on the server.  Do it backwards so we can splice.
        for (var i = namers.length - 1; i >= 0; i--) {
          var srvid = serverIds[i];
          if (!srvid) {
            serverIds.splice(i, 1);
            namers.splice(i, 1);
            continue;
          }
          var namer = namers[i];
          guidToNamer[namer.guid] = namer;
        }
        // it's possible all the messages could be gone, in which case we
        // are done with this folder already!
        if (serverIds.length === 0) {
          perFolderDone();
          return;
        }

        // There is nothing to do on localdrafts or outbox folders, server-wise.

        if (sourceStorage.isLocalOnly) {
          perFolderDone();
        }
        else if (sourceStorage.folderId === targetFolderId) {
          if (op.type === 'move') {
            // A move from a folder to itself is a no-op.
            perFolderDone();
          }
          else { // op.type === 'delete'
            // If the op is a delete and the source and destination folders
            // match, we're deleting from trash, so just perma-delete it.
            foundUIDs_deleteOriginals();
          }
        }
        else {
          // Resolve the target folder again.
          this._accessFolderForMutation(targetFolderId, true, gotTargetConn,
                                        function targetFolderDead() {},
                                        'move target');
        }
      }.bind(this),
      function() {
        jobDoneCallback(aggrErr);
      },
      null,
      false,
      'server move source');
  },

  /**
   * See section block comment for more info.
   *
   * XXX implement checking logic for move
   */
  check_move: function(op, doneCallback, targetFolderId) {
    // get a connection in the target folder
    // do a search on message-id's to check if the messages got copied across.
    doneCallback(null, 'moot');
  },

  local_undo_move: $jobmixins.local_undo_move,

  /**
   * Move the message back to its original folder.
   *
   * - If the source message has not been expunged, remove the Deleted flag from
   *   the source folder.
   * - If the source message was expunged, copy the message back to the source
   *   folder.
   * - Delete the message from the target folder.
   *
   * XXX implement undo functionality for move
   */
  undo_move: function(op, doneCallback, targetFolderId) {
    doneCallback('moot');
  },


  //////////////////////////////////////////////////////////////////////////////
  // append: Add a message to a folder
  //
  // Message should look like:
  // {
  //    messageText: the message body,
  //    date: the date to use as the INTERNALDATE of the message,
  //    flags: the initial set of flags for the message
  // }

  local_do_append: function(op, doneCallback) {
    doneCallback(null);
  },

  /**
   * Append a message to a folder.
   */
  do_append: function(op, callback) {
    var folderConn, self = this,
        storage = this.account.getFolderStorageForFolderId(op.folderId),
        folderMeta = storage.folderMeta,
        iNextMessage = 0;

    var gotFolderConn = function gotFolderConn(_folderConn) {
      if (!_folderConn) {
        done('unknown');
        return;
      }
      folderConn = _folderConn;
      append();
    };
    var deadConn = function deadConn() {
      callback('aborted-retry');
    };
    var append = function append() {
      var message = op.messages[iNextMessage++];

      // XXX: browserbox does not support sending blobs...
      var str = new FileReaderSync().readAsBinaryString(message.messageText);
      folderConn._conn.upload(
        folderMeta.path,
        str,
        { flags: message.flags },
        appended);
    };
    var appended = function appended(err) {
      if (err) {
        console.error('failure appending message', err);
        done('unknown');
        return;
      }
      if (iNextMessage < op.messages.length)
        append();
      else
        done(null);
    };
    var done = function done(errString) {
      if (folderConn)
        folderConn = null;
      callback(errString);
    };

    this._accessFolderForMutation(op.folderId, true, gotFolderConn, deadConn,
                                  'append');
  },

  /**
   * Check if the message ended up in the folder.
   *
   * TODO implement
   */
  check_append: function(op, doneCallback) {
    // XXX search on the message-id in the folder to verify its presence.
    doneCallback(null, 'moot');
  },

  // TODO implement
  local_undo_append: function(op, doneCallback) {
    doneCallback(null);
  },

  // TODO implement
  undo_append: function(op, doneCallback) {
    doneCallback('moot');
  },

  //////////////////////////////////////////////////////////////////////////////
  // syncFolderList
  //
  // Synchronize our folder list.  This should always be an idempotent operation
  // that makes no sense to undo/redo/etc.

  local_do_syncFolderList: function(op, doneCallback) {
    doneCallback(null);
  },

  do_syncFolderList: function(op, doneCallback) {
    var account = this.account, reported = false;
    this._acquireConnWithoutFolder(
      'syncFolderList',
      function gotConn(conn) {
        account._syncFolderList(conn, function(err) {
            if (!err)
              account.meta.lastFolderSyncAt = Date.now();
            // request an account save
            if (!reported)
              doneCallback(err ? 'aborted-retry' : null, null, !err);
            reported = true;
          });
      },
      function deadConn() {
        if (!reported)
          doneCallback('aborted-retry');
        reported = true;
      });
  },

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
  // createFolder: Create a folder

  local_do_createFolder: function(op, doneCallback) {
    // we never locally perform this operation.
    doneCallback(null);
  },

  do_createFolder: function(op, doneCallback) {
    var parentFolderInfo;
    if (op.parentFolderId) {
      if (!this.account._folderInfos.hasOwnProperty(op.parentFolderId)) {
        throw new Error("No such folder: " + op.parentFolderId);
      }
      parentFolderInfo = this.account._folderInfos[op.parentFolderId].$meta;
    }

    var personalNamespace =
          (this.account._namespaces && this.account._namespaces.personal) ||
          { prefix: '', delimiter: FALLBACK_FOLDER_DELIM };

    var derivedInfo = deriveFolderPath(
      op.folderName, op.containOtherFolders, parentFolderInfo,
      personalNamespace);
    var path = derivedInfo.path;

    var scope = logic.subscope(this, { _path: path });

    var gotConn = function(conn) {
      // - create the box
      // Paths are private.
      logic(scope, 'creatingFolder', { _path: path });
      conn.createMailbox(path, addBoxCallback);
    }.bind(this);

    var addBoxCallback = function(err, alreadyExists) {
      if (err) {
        // upgrade error message that contain "already" or "exist" to
        // mean ALREADYEXISTS.
        // TODO: make hoodiecrow support ALREADYEXISTS
        if (err.message && /already|exist/i.test(err.message)) {
          alreadyExists = true;
        } else {
          logic(scope, 'createFolderErr', { err: err });
          // TODO: do something clever in terms of making sure the folder didn't
          // already exist and the server just doesn't like to provide the
          // ALREADYEXISTS response.
          //
          // For now, give up immediately on the folder for safety.
          // ensureEssentialFolders is the only logic that creates folders and it
          // does not know about existing/pending createFolder requests, so it's
          // for the best if we simply give up permanently on this.
          done('failure-give-up', null);
          return;
        }
      }

      logic(scope, 'createdFolder', { alreadyExists: alreadyExists });

      // We originally (under imap.js) would do a LIST against the folder for
      // the path we thought we just created and then we would use that to
      // learn about the folder like we had heard about it from syncFolderList
      // (but more efficiently).  This really only was needed because we
      // potentially would screw up when it came to IMAP namespaces.  We now
      // try to correctly honor the namespace so we just assume if the folder
      // says it created the folder that it didn't do any crazy transforms
      // that it won't also do when we otherwise deal with the folder.
      //
      // An alternative would be to not learn about the folder now and instead
      // just trigger syncFolderList.  This gets tricky in the face of us
      // potentially trying to create multiple folders and infinite loops if we
      // screw up, so we don't do that.
      var folderMeta = this.account._learnAboutFolder(
        op.folderName, path, op.parentFolderId, op.folderType,
        derivedInfo.delimiter, derivedInfo.depth,
        // do not suppress the add notification
        false);
      done(null, folderMeta);
    }.bind(this);
    function done(errString, folderMeta) {
      if (doneCallback) {
        doneCallback(errString, folderMeta);
        doneCallback = null;
      }
    }
    function deadConn() {
      done('aborted-retry', null);
    }

    // Check to make sure the folder doesn't already exist and early return if
    // it does exist.  There is nothing preventing a caller from making
    // ridiculous calls like this or emergent ridiculosity from syncFolderList
    // being triggered multiple times and interacting with complicated failures.
    //
    // Note that there is a hypothetical edge case here related to case
    // normalization (ex where Gmail can report the Inbox as "Inbox" but then
    // allows subfolders to be reported like INBOX/Blah) that is already
    // mitigated by some smarts in browserbox when it builds the folder
    // hierarchies.
    var existingFolder = this.account.getFolderByPath(path);
    if (existingFolder) {
      done(null, existingFolder);
    } else {
      this._acquireConnWithoutFolder('createFolder', gotConn, deadConn);
    }
  },

  check_createFolder: function(op, doneCallback) {
    doneCallback('moot');
  },

  local_undo_createFolder: function(op, doneCallback) {
    doneCallback(null);
  },

  // TODO: port deleteFolder to be an op and invoke it here
  undo_createFolder: function(op, doneCallback) {
    doneCallback('moot');
  },

  //////////////////////////////////////////////////////////////////////////////
  // purgeExcessMessages

  local_do_purgeExcessMessages: function(op, doneCallback) {
    this._accessFolderForMutation(
      op.folderId, false,
      function withMutex(_ignoredConn, storage) {
        storage.purgeExcessMessages(function(numDeleted, cutTS) {
          // Indicate that we want a save performed if any messages got deleted.
          doneCallback(null, null, numDeleted > 0);
        });
      },
      null,
      'purgeExcessMessages');
  },

  do_purgeExcessMessages: function(op, doneCallback) {
    doneCallback(null);
  },

  check_purgeExcessMessages: function(op, doneCallback) {
    // this is a local-only modification, so this doesn't really matter
    return UNCHECKED_IDEMPOTENT;
  },

  local_undo_purgeExcessMessages: function(op, doneCallback) {
    doneCallback(null);
  },

  undo_purgeExcessMessages: function(op, doneCallback) {
    doneCallback(null);
  },

  //////////////////////////////////////////////////////////////////////////////

  local_do_sendOutboxMessages: $jobmixins.local_do_sendOutboxMessages,
  do_sendOutboxMessages: $jobmixins.do_sendOutboxMessages,
  check_sendOutboxMessages: $jobmixins.check_sendOutboxMessages,
  local_undo_sendOutboxMessages: $jobmixins.local_undo_sendOutboxMessages,
  undo_sendOutboxMessages: $jobmixins.undo_sendOutboxMessages,
  local_do_setOutboxSyncEnabled: $jobmixins.local_do_setOutboxSyncEnabled

  //////////////////////////////////////////////////////////////////////////////

};

function HighLevelJobDriver() {
}
HighLevelJobDriver.prototype = {
  /**
   * Perform a cross-folder move:
   *
   * - Fetch the entirety of a message from the source location.
   * - Append the entirety of the message to the target location.
   * - Delete the message from the source location.
   */
  do_xmove: function() {
  },

  check_xmove: function() {

  },

  /**
   * Undo a cross-folder move.  Same idea as for normal undo_move; undelete
   * if possible, re-copy if not.  Delete the target once we're confident
   * the message made it back into the folder.
   */
  undo_xmove: function() {
  },

  /**
   * Perform a cross-folder copy:
   * - Fetch the entirety of a message from the source location.
   * - Append the message to the target location.
   */
  do_xcopy: function() {
  },

  check_xcopy: function() {
  },

  /**
   * Just delete the message from the target location.
   */
  undo_xcopy: function() {
  },
};

mix(ImapJobDriver.prototype, draftsJobs.draftsMixins);


}); // end define
;
// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function(root, factory) {
    

    if (typeof define === 'function' && define.amd) {
        define('imap-formal-syntax',factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.imapFormalSyntax = factory();
    }
}(this, function() {

    

    // IMAP Formal Syntax
    // http://tools.ietf.org/html/rfc3501#section-9

    function expandRange(start, end) {
        var chars = [];
        for (var i = start; i <= end; i++) {
            chars.push(i);
        }
        return String.fromCharCode.apply(String, chars);
    }

    function excludeChars(source, exclude) {
        var sourceArr = Array.prototype.slice.call(source);
        for (var i = sourceArr.length - 1; i >= 0; i--) {
            if (exclude.indexOf(sourceArr[i]) >= 0) {
                sourceArr.splice(i, 1);
            }
        }
        return sourceArr.join('');
    }

    return {

        CHAR: function() {
            var value = expandRange(0x01, 0x7F);
            this.CHAR = function() {
                return value;
            };
            return value;
        },

        CHAR8: function() {
            var value = expandRange(0x01, 0xFF);
            this.CHAR8 = function() {
                return value;
            };
            return value;
        },

        SP: function() {
            return ' ';
        },

        CTL: function() {
            var value = expandRange(0x00, 0x1F) + '\x7F';
            this.CTL = function() {
                return value;
            };
            return value;
        },

        DQUOTE: function() {
            return '"';
        },

        ALPHA: function() {
            var value = expandRange(0x41, 0x5A) + expandRange(0x61, 0x7A);
            this.ALPHA = function() {
                return value;
            };
            return value;
        },

        DIGIT: function() {
            var value = expandRange(0x30, 0x39) + expandRange(0x61, 0x7A);
            this.DIGIT = function() {
                return value;
            };
            return value;
        },

        'ATOM-CHAR': function() {
            var value = excludeChars(this.CHAR(), this['atom-specials']());
            this['ATOM-CHAR'] = function() {
                return value;
            };
            return value;
        },

        'ASTRING-CHAR': function() {
            var value = this['ATOM-CHAR']() + this['resp-specials']();
            this['ASTRING-CHAR'] = function() {
                return value;
            };
            return value;
        },

        'TEXT-CHAR': function() {
            var value = excludeChars(this.CHAR(), '\r\n');
            this['TEXT-CHAR'] = function() {
                return value;
            };
            return value;
        },

        'atom-specials': function() {
            var value = '(' + ')' + '{' + this.SP() + this.CTL() + this['list-wildcards']() +
                this['quoted-specials']() + this['resp-specials']();
            this['atom-specials'] = function() {
                return value;
            };
            return value;
        },

        'list-wildcards': function() {
            return '%' + '*';
        },

        'quoted-specials': function() {
            var value = this.DQUOTE() + '\\';
            this['quoted-specials'] = function() {
                return value;
            };
            return value;
        },

        'resp-specials': function() {
            return ']';
        },

        tag: function() {
            var value = excludeChars(this['ASTRING-CHAR'](), '+');
            this.tag = function() {
                return value;
            };
            return value;
        },

        command: function() {
            var value = this.ALPHA() + this.DIGIT();
            this.command = function() {
                return value;
            };
            return value;
        },

        verify: function(str, allowedChars) {
            for (var i = 0, len = str.length; i < len; i++) {
                if (allowedChars.indexOf(str.charAt(i)) < 0) {
                    return i;
                }
            }
            return -1;
        }
    };
}));
// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function(root, factory) {
    

    if (typeof define === 'function' && define.amd) {
        define('imap-handler/src/imap-parser',['imap-formal-syntax'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('./imap-formal-syntax'));
    } else {
        root.imapParser = factory(root.imapFormalSyntax);
    }
}(this, function(imapFormalSyntax) {

    

    function ParserInstance(input, options) {
        this.input = (input || '').toString();
        this.options = options || {};
        this.remainder = this.input;
        this.pos = 0;
    }

    ParserInstance.prototype.getTag = function() {
        if (!this.tag) {
            this.tag = this.getElement(imapFormalSyntax.tag() + '*+', true);
        }
        return this.tag;
    };

    ParserInstance.prototype.getCommand = function() {
        var responseCode;

        if (!this.command) {
            this.command = this.getElement(imapFormalSyntax.command());
        }

        switch ((this.command || '').toString().toUpperCase()) {
            case 'OK':
            case 'NO':
            case 'BAD':
            case 'PREAUTH':
            case 'BYE':
                responseCode = this.remainder.match(/^ \[(?:[^\]]*\])+/);
                if (responseCode) {
                    this.humanReadable = this.remainder.substr(responseCode[0].length).trim();
                    this.remainder = responseCode[0];
                } else {
                    this.humanReadable = this.remainder.trim();
                    this.remainder = '';
                }
                break;
        }

        return this.command;
    };

    ParserInstance.prototype.getElement = function(syntax) {
        var match, element, errPos;
        if (this.remainder.match(/^\s/)) {
            throw new Error('Unexpected whitespace at position ' + this.pos);
        }

        if ((match = this.remainder.match(/^[^\s]+(?=\s|$)/))) {
            element = match[0];

            if ((errPos = imapFormalSyntax.verify(element, syntax)) >= 0) {
                throw new Error('Unexpected char at position ' + (this.pos + errPos));
            }
        } else {
            throw new Error('Unexpected end of input at position ' + this.pos);
        }

        this.pos += match[0].length;
        this.remainder = this.remainder.substr(match[0].length);

        return element;
    };

    ParserInstance.prototype.getSpace = function() {
        if (!this.remainder.length) {
            throw new Error('Unexpected end of input at position ' + this.pos);
        }

        if (imapFormalSyntax.verify(this.remainder.charAt(0), imapFormalSyntax.SP()) >= 0) {
            throw new Error('Unexpected char at position ' + this.pos);
        }

        this.pos++;
        this.remainder = this.remainder.substr(1);
    };

    ParserInstance.prototype.getAttributes = function() {
        if (!this.remainder.length) {
            throw new Error('Unexpected end of input at position ' + this.pos);
        }

        if (this.remainder.match(/^\s/)) {
            throw new Error('Unexpected whitespace at position ' + this.pos);
        }

        return new TokenParser(this, this.pos, this.remainder, this.options).getAttributes();
    };

    function TokenParser(parent, startPos, str, options) {
        this.str = (str || '').toString();
        this.options = options || {};
        this.parent = parent;

        this.tree = this.currentNode = this.createNode();
        this.pos = startPos || 0;

        this.currentNode.type = 'TREE';

        this.state = 'NORMAL';

        this.processString();
    }

    TokenParser.prototype.getAttributes = function() {
        var attributes = [],
            branch = attributes;

        var walk = function(node) {
            var elm, curBranch = branch,
                partial;

            if (!node.closed && node.type === 'SEQUENCE' && node.value === '*') {
                node.closed = true;
                node.type = 'ATOM';
            }

            // If the node was never closed, throw it
            if (!node.closed) {
                throw new Error('Unexpected end of input at position ' + (this.pos + this.str.length - 1));
            }

            switch (node.type.toUpperCase()) {
                case 'LITERAL':
                case 'STRING':
                case 'SEQUENCE':
                    elm = {
                        type: node.type.toUpperCase(),
                        value: node.value
                    };
                    branch.push(elm);
                    break;
                case 'ATOM':
                    if (node.value.toUpperCase() === 'NIL') {
                        branch.push(null);
                        break;
                    }
                    elm = {
                        type: node.type.toUpperCase(),
                        value: node.value
                    };
                    branch.push(elm);
                    break;
                case 'SECTION':
                    branch = branch[branch.length - 1].section = [];
                    break;
                case 'LIST':
                    elm = [];
                    branch.push(elm);
                    branch = elm;
                    break;
                case 'PARTIAL':
                    partial = node.value.split('.').map(Number);
                    if (partial.slice(-1)[0] < partial.slice(0, 1)[0]) {
                        throw new Error('Invalid partial value at position ' + node.startPos);
                    }
                    branch[branch.length - 1].partial = partial;
                    break;
            }

            node.childNodes.forEach(function(childNode) {
                walk(childNode);
            });
            branch = curBranch;
        }.bind(this);

        walk(this.tree);

        return attributes;
    };

    TokenParser.prototype.createNode = function(parentNode, startPos) {
        var node = {
            childNodes: [],
            type: false,
            value: '',
            closed: true
        };

        if (parentNode) {
            node.parentNode = parentNode;
        }

        if (typeof startPos === 'number') {
            node.startPos = startPos;
        }

        if (parentNode) {
            parentNode.childNodes.push(node);
        }

        return node;
    };

    TokenParser.prototype.processString = function() {
        var chr, i, len,
            checkSP = function() {
                // jump to the next non whitespace pos
                while (this.str.charAt(i + 1) === ' ') {
                    i++;
                }
            }.bind(this);

        for (i = 0, len = this.str.length; i < len; i++) {

            chr = this.str.charAt(i);

            switch (this.state) {

                case 'NORMAL':

                    switch (chr) {

                        // DQUOTE starts a new string
                        case '"':
                            this.currentNode = this.createNode(this.currentNode, this.pos + i);
                            this.currentNode.type = 'string';
                            this.state = 'STRING';
                            this.currentNode.closed = false;
                            break;

                            // ( starts a new list
                        case '(':
                            this.currentNode = this.createNode(this.currentNode, this.pos + i);
                            this.currentNode.type = 'LIST';
                            this.currentNode.closed = false;
                            break;

                            // ) closes a list
                        case ')':
                            if (this.currentNode.type !== 'LIST') {
                                throw new Error('Unexpected list terminator ) at position ' + (this.pos + i));
                            }

                            this.currentNode.closed = true;
                            this.currentNode.endPos = this.pos + i;
                            this.currentNode = this.currentNode.parentNode;

                            checkSP();
                            break;

                            // ] closes section group
                        case ']':
                            if (this.currentNode.type !== 'SECTION') {
                                throw new Error('Unexpected section terminator ] at position ' + (this.pos + i));
                            }
                            this.currentNode.closed = true;
                            this.currentNode.endPos = this.pos + i;
                            this.currentNode = this.currentNode.parentNode;
                            checkSP();
                            break;

                            // < starts a new partial
                        case '<':
                            if (this.str.charAt(i - 1) !== ']') {
                                this.currentNode = this.createNode(this.currentNode, this.pos + i);
                                this.currentNode.type = 'ATOM';
                                this.currentNode.value = chr;
                                this.state = 'ATOM';
                            } else {
                                this.currentNode = this.createNode(this.currentNode, this.pos + i);
                                this.currentNode.type = 'PARTIAL';
                                this.state = 'PARTIAL';
                                this.currentNode.closed = false;
                            }
                            break;

                            // { starts a new literal
                        case '{':
                            this.currentNode = this.createNode(this.currentNode, this.pos + i);
                            this.currentNode.type = 'LITERAL';
                            this.state = 'LITERAL';
                            this.currentNode.closed = false;
                            break;

                            // ( starts a new sequence
                        case '*':
                            this.currentNode = this.createNode(this.currentNode, this.pos + i);
                            this.currentNode.type = 'SEQUENCE';
                            this.currentNode.value = chr;
                            this.currentNode.closed = false;
                            this.state = 'SEQUENCE';
                            break;

                            // normally a space should never occur
                        case ' ':
                            // just ignore
                            break;

                            // [ starts section
                        case '[':
                            // If it is the *first* element after response command, then process as a response argument list
                            if (['OK', 'NO', 'BAD', 'BYE', 'PREAUTH'].indexOf(this.parent.command.toUpperCase()) >= 0 && this.currentNode === this.tree) {
                                this.currentNode.endPos = this.pos + i;

                                this.currentNode = this.createNode(this.currentNode, this.pos + i);
                                this.currentNode.type = 'ATOM';

                                this.currentNode = this.createNode(this.currentNode, this.pos + i);
                                this.currentNode.type = 'SECTION';
                                this.currentNode.closed = false;
                                this.state = 'NORMAL';

                                // RFC2221 defines a response code REFERRAL whose payload is an
                                // RFC2192/RFC5092 imapurl that we will try to parse as an ATOM but
                                // fail quite badly at parsing.  Since the imapurl is such a unique
                                // (and crazy) term, we just specialize that case here.
                                if (this.str.substr(i + 1, 9).toUpperCase() === 'REFERRAL ') {
                                    // create the REFERRAL atom
                                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 1);
                                    this.currentNode.type = 'ATOM';
                                    this.currentNode.endPos = this.pos + i + 8;
                                    this.currentNode.value = 'REFERRAL';
                                    this.currentNode = this.currentNode.parentNode;

                                    // eat all the way through the ] to be the  IMAPURL token.
                                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 10);
                                    // just call this an ATOM, even though IMAPURL might be more correct
                                    this.currentNode.type = 'ATOM';
                                    // jump i to the ']'
                                    i = this.str.indexOf(']', i + 10);
                                    this.currentNode.endPos = this.pos + i - 1;
                                    this.currentNode.value = this.str.substring(this.currentNode.startPos - this.pos,
                                        this.currentNode.endPos - this.pos + 1);
                                    this.currentNode = this.currentNode.parentNode;

                                    // close out the SECTION
                                    this.currentNode.closed = true;
                                    this.currentNode = this.currentNode.parentNode;
                                    checkSP();
                                }

                                break;
                            }
                            /* falls through */
                        default:
                            // Any ATOM supported char starts a new Atom sequence, otherwise throw an error
                            // Allow \ as the first char for atom to support system flags
                            // Allow % to support LIST '' %
                            if (imapFormalSyntax['ATOM-CHAR']().indexOf(chr) < 0 && chr !== '\\' && chr !== '%') {
                                throw new Error('Unexpected char at position ' + (this.pos + i));
                            }

                            this.currentNode = this.createNode(this.currentNode, this.pos + i);
                            this.currentNode.type = 'ATOM';
                            this.currentNode.value = chr;
                            this.state = 'ATOM';
                            break;
                    }
                    break;

                case 'ATOM':

                    // space finishes an atom
                    if (chr === ' ') {
                        this.currentNode.endPos = this.pos + i - 1;
                        this.currentNode = this.currentNode.parentNode;
                        this.state = 'NORMAL';
                        break;
                    }

                    //
                    if (
                        this.currentNode.parentNode &&
                        (
                            (chr === ')' && this.currentNode.parentNode.type === 'LIST') ||
                            (chr === ']' && this.currentNode.parentNode.type === 'SECTION')
                        )
                    ) {
                        this.currentNode.endPos = this.pos + i - 1;
                        this.currentNode = this.currentNode.parentNode;

                        this.currentNode.closed = true;
                        this.currentNode.endPos = this.pos + i;
                        this.currentNode = this.currentNode.parentNode;
                        this.state = 'NORMAL';

                        checkSP();
                        break;
                    }

                    if ((chr === ',' || chr === ':') && this.currentNode.value.match(/^\d+$/)) {
                        this.currentNode.type = 'SEQUENCE';
                        this.currentNode.closed = true;
                        this.state = 'SEQUENCE';
                    }

                    // [ starts a section group for this element
                    if (chr === '[') {
                        // allowed only for selected elements
                        if (['BODY', 'BODY.PEEK'].indexOf(this.currentNode.value.toUpperCase()) < 0) {
                            throw new Error('Unexpected section start char [ at position ' + this.pos);
                        }
                        this.currentNode.endPos = this.pos + i;
                        this.currentNode = this.createNode(this.currentNode.parentNode, this.pos + i);
                        this.currentNode.type = 'SECTION';
                        this.currentNode.closed = false;
                        this.state = 'NORMAL';
                        break;
                    }

                    if (chr === '<') {
                        throw new Error('Unexpected start of partial at position ' + this.pos);
                    }

                    // if the char is not ATOM compatible, throw. Allow \* as an exception
                    if (imapFormalSyntax['ATOM-CHAR']().indexOf(chr) < 0 && chr !== ']' && !(chr === '*' && this.currentNode.value === '\\')) {
                        throw new Error('Unexpected char at position ' + (this.pos + i));
                    } else if (this.currentNode.value === '\\*') {
                        throw new Error('Unexpected char at position ' + (this.pos + i));
                    }

                    this.currentNode.value += chr;
                    break;

                case 'STRING':

                    // DQUOTE ends the string sequence
                    if (chr === '"') {
                        this.currentNode.endPos = this.pos + i;
                        this.currentNode.closed = true;
                        this.currentNode = this.currentNode.parentNode;
                        this.state = 'NORMAL';

                        checkSP();
                        break;
                    }

                    // \ Escapes the following char
                    if (chr === '\\') {
                        i++;
                        if (i >= len) {
                            throw new Error('Unexpected end of input at position ' + (this.pos + i));
                        }
                        chr = this.str.charAt(i);
                    }

                    /* // skip this check, otherwise the parser might explode on binary input
                    if (imapFormalSyntax['TEXT-CHAR']().indexOf(chr) < 0) {
                        throw new Error('Unexpected char at position ' + (this.pos + i));
                    }
                    */

                    this.currentNode.value += chr;
                    break;

                case 'PARTIAL':
                    if (chr === '>') {
                        if (this.currentNode.value.substr(-1) === '.') {
                            throw new Error('Unexpected end of partial at position ' + this.pos);
                        }
                        this.currentNode.endPos = this.pos + i;
                        this.currentNode.closed = true;
                        this.currentNode = this.currentNode.parentNode;
                        this.state = 'NORMAL';
                        checkSP();
                        break;
                    }

                    if (chr === '.' && (!this.currentNode.value.length || this.currentNode.value.match(/\./))) {
                        throw new Error('Unexpected partial separator . at position ' + this.pos);
                    }

                    if (imapFormalSyntax.DIGIT().indexOf(chr) < 0 && chr !== '.') {
                        throw new Error('Unexpected char at position ' + (this.pos + i));
                    }

                    if (this.currentNode.value.match(/^0$|\.0$/) && chr !== '.') {
                        throw new Error('Invalid partial at position ' + (this.pos + i));
                    }

                    this.currentNode.value += chr;
                    break;

                case 'LITERAL':
                    if (this.currentNode.started) {
                        //if(imapFormalSyntax['CHAR8']().indexOf(chr) < 0){
                        if (chr === '\u0000') {
                            throw new Error('Unexpected \\x00 at position ' + (this.pos + i));
                        }
                        this.currentNode.value += chr;

                        if (this.currentNode.value.length >= this.currentNode.literalLength) {
                            this.currentNode.endPos = this.pos + i;
                            this.currentNode.closed = true;
                            this.currentNode = this.currentNode.parentNode;
                            this.state = 'NORMAL';
                            checkSP();
                        }
                        break;
                    }

                    if (chr === '+' && this.options.literalPlus) {
                        this.currentNode.literalPlus = true;
                        break;
                    }

                    if (chr === '}') {
                        if (!('literalLength' in this.currentNode)) {
                            throw new Error('Unexpected literal prefix end char } at position ' + (this.pos + i));
                        }
                        if (this.str.charAt(i + 1) === '\n') {
                            i++;
                        } else if (this.str.charAt(i + 1) === '\r' && this.str.charAt(i + 2) === '\n') {
                            i += 2;
                        } else {
                            throw new Error('Unexpected char at position ' + (this.pos + i));
                        }
                        this.currentNode.literalLength = Number(this.currentNode.literalLength);
                        this.currentNode.started = true;

                        if (!this.currentNode.literalLength) {
                            // special case where literal content length is 0
                            // close the node right away, do not wait for additional input
                            this.currentNode.endPos = this.pos + i;
                            this.currentNode.closed = true;
                            this.currentNode = this.currentNode.parentNode;
                            this.state = 'NORMAL';
                            checkSP();
                        }
                        break;
                    }
                    if (imapFormalSyntax.DIGIT().indexOf(chr) < 0) {
                        throw new Error('Unexpected char at position ' + (this.pos + i));
                    }
                    if (this.currentNode.literalLength === '0') {
                        throw new Error('Invalid literal at position ' + (this.pos + i));
                    }
                    this.currentNode.literalLength = (this.currentNode.literalLength || '') + chr;
                    break;

                case 'SEQUENCE':
                    // space finishes the sequence set
                    if (chr === ' ') {
                        if (!this.currentNode.value.substr(-1).match(/\d/) && this.currentNode.value.substr(-1) !== '*') {
                            throw new Error('Unexpected whitespace at position ' + (this.pos + i));
                        }

                        if (this.currentNode.value.substr(-1) === '*' && this.currentNode.value.substr(-2, 1) !== ':') {
                            throw new Error('Unexpected whitespace at position ' + (this.pos + i));
                        }

                        this.currentNode.closed = true;
                        this.currentNode.endPos = this.pos + i - 1;
                        this.currentNode = this.currentNode.parentNode;
                        this.state = 'NORMAL';
                        break;
                    } else if (this.currentNode.parentNode &&
                        chr === ']' &&
                        this.currentNode.parentNode.type === 'SECTION') {
                        this.currentNode.endPos = this.pos + i - 1;
                        this.currentNode = this.currentNode.parentNode;

                        this.currentNode.closed = true;
                        this.currentNode.endPos = this.pos + i;
                        this.currentNode = this.currentNode.parentNode;
                        this.state = 'NORMAL';

                        checkSP();
                        break;
                    }

                    if (chr === ':') {
                        if (!this.currentNode.value.substr(-1).match(/\d/) && this.currentNode.value.substr(-1) !== '*') {
                            throw new Error('Unexpected range separator : at position ' + (this.pos + i));
                        }
                    } else if (chr === '*') {
                        if ([',', ':'].indexOf(this.currentNode.value.substr(-1)) < 0) {
                            throw new Error('Unexpected range wildcard at position ' + (this.pos + i));
                        }
                    } else if (chr === ',') {
                        if (!this.currentNode.value.substr(-1).match(/\d/) && this.currentNode.value.substr(-1) !== '*') {
                            throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
                        }
                        if (this.currentNode.value.substr(-1) === '*' && this.currentNode.value.substr(-2, 1) !== ':') {
                            throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
                        }
                    } else if (!chr.match(/\d/)) {
                        throw new Error('Unexpected char at position ' + (this.pos + i));
                    }

                    if (chr.match(/\d/) && this.currentNode.value.substr(-1) === '*') {
                        throw new Error('Unexpected number at position ' + (this.pos + i));
                    }

                    this.currentNode.value += chr;
                    break;
            }
        }
    };

    return function(command, options) {
        var parser, response = {};

        options = options || {};

        parser = new ParserInstance(command, options);

        response.tag = parser.getTag();
        parser.getSpace();
        response.command = parser.getCommand();

        if (['UID', 'AUTHENTICATE'].indexOf((response.command || '').toUpperCase()) >= 0) {
            parser.getSpace();
            response.command += ' ' + parser.getElement(imapFormalSyntax.command());
        }

        if (parser.remainder.trim().length) {
            parser.getSpace();
            response.attributes = parser.getAttributes();
        }

        if (parser.humanReadable) {
            response.attributes = (response.attributes || []).concat({
                type: 'TEXT',
                value: parser.humanReadable
            });
        }

        return response;
    };

}));
// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function(root, factory) {
    

    if (typeof define === 'function' && define.amd) {
        define('imap-handler/src/imap-compiler',['imap-formal-syntax'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('./imap-formal-syntax'));
    } else {
        root.imapCompiler = factory(root.imapFormalSyntax);
    }
}(this, function(imapFormalSyntax) {

    

    /**
     * Compiles an input object into
     */
    return function(response, asArray, isLogging) {
        var respParts = [],
            resp = (response.tag || '') + (response.command ? ' ' + response.command : ''),
            val, lastType,
            walk = function(node) {

                if (lastType === 'LITERAL' || (['(', '<', '['].indexOf(resp.substr(-1)) < 0 && resp.length)) {
                    resp += ' ';
                }

                if (Array.isArray(node)) {
                    lastType = 'LIST';
                    resp += '(';
                    node.forEach(walk);
                    resp += ')';
                    return;
                }

                if (!node && typeof node !== 'string' && typeof node !== 'number') {
                    resp += 'NIL';
                    return;
                }

                if (typeof node === 'string') {
                    if (isLogging && node.length > 20) {
                        resp += '"(* ' + node.length + 'B string *)"';
                    } else {
                        resp += JSON.stringify(node);
                    }
                    return;
                }

                if (typeof node === 'number') {
                    resp += Math.round(node) || 0; // Only integers allowed
                    return;
                }

                lastType = node.type;

                if (isLogging && node.sensitive) {
                    resp += '"(* value hidden *)"';
                    return;
                }

                switch (node.type.toUpperCase()) {
                    case 'LITERAL':
                        if (isLogging) {
                            resp += '"(* ' + node.value.length + 'B literal *)"';
                        } else {
                            if (!node.value) {
                                resp += '{0}\r\n';
                            } else {
                                resp += '{' + node.value.length + '}\r\n';
                            }
                            respParts.push(resp);
                            resp = node.value || '';
                        }
                        break;

                    case 'STRING':
                        if (isLogging && node.value.length > 20) {
                            resp += '"(* ' + node.value.length + 'B string *)"';
                        } else {
                            resp += JSON.stringify(node.value || '');
                        }
                        break;
                    case 'TEXT':
                    case 'SEQUENCE':
                        resp += node.value || '';
                        break;

                    case 'NUMBER':
                        resp += (node.value || 0);
                        break;

                    case 'ATOM':
                    case 'SECTION':
                        val = node.value || '';

                        if (imapFormalSyntax.verify(val.charAt(0) === '\\' ? val.substr(1) : val, imapFormalSyntax['ATOM-CHAR']()) >= 0) {
                            val = JSON.stringify(val);
                        }

                        resp += val;

                        if (node.section) {
                            resp += '[';
                            node.section.forEach(walk);
                            resp += ']';
                        }
                        if (node.partial) {
                            resp += '<' + node.partial.join('.') + '>';
                        }
                        break;
                }

            };

        [].concat(response.attributes || []).forEach(walk);

        if (resp.length) {
            respParts.push(resp);
        }

        return asArray ? respParts : respParts.join('');
    };
}));
// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// UMD shim, see: https://github.com/umdjs/umd/blob/master/returnExports.js
(function(root, factory) {
    

    if (typeof define === 'function' && define.amd) {
        define('imap-handler/src/imap-handler',['./imap-parser', './imap-compiler'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require('./imap-parser'), require('./imap-compiler'));
    } else {
        root.imapHandler = factory(root.imapParser, root.imapCompiler);
    }
}(this, function(imapParser, imapCompiler) {

    

    return {
        parser: imapParser,
        compiler: imapCompiler
    };
}));
define('imap-handler',['./imap-handler/src/imap-handler'], function(imapHandler) {
  return imapHandler;
});

/**
 * Customized shim for browserbox to use 'slog' with configurable logging level
 * that can be cranked up.
 */
define('axeshim-browserbox',['require','logic'],function(require) {
  var logic = require('logic');
  var scope = logic.scope('BrowserBox');

  return {
    /**
     * Provide a .debug for things that are *only* logged when
     * sensitive logging is enabled. This exists right now mainly for
     * the benefit of the email.js libs. We're tying "debug" to
     * logSensitiveData both because we haven't audited the use of
     * debug and also because it is indeed a bit chatty.
     *
     * TODO: Address the logging detail level as a separate issue,
     * ideally while working with whiteout.io to fancify the email.js
     * logging slightly.
     */
    debug: function(ignoredTag, msg) {
      if (!logic.isCensored) {
        logic(scope, 'debug', { msg: msg });
      }
    },
    log: function(ignoredTag, msg) {
      logic(scope, 'log', { msg: msg });
    },
    warn: function(ignoredTag, msg) {
      logic(scope, 'warn', { msg: msg });
    },
    error: function(ignoredTag, msg) {
      logic(scope, 'error', { msg: msg });
    }
  };
});

// Copyright (c) 2014 Andris Reinman

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

(function(root, factory) {
    

    if (typeof define === 'function' && define.amd) {
        define('browserbox-imap',['tcp-socket', 'imap-handler', 'mimefuncs', 'axe'], function(TCPSocket, imapHandler, mimefuncs, axe) {
            return factory(TCPSocket, imapHandler, mimefuncs, axe);
        });
    } else if (typeof exports === 'object') {
        module.exports = factory(require('tcp-socket'), require('wo-imap-handler'), require('mimefuncs'), require('axe-logger'));
    } else {
        root.BrowserboxImapClient = factory(navigator.TCPSocket, root.imapHandler, root.mimefuncs, root.axe);
    }
}(this, function(TCPSocket, imapHandler, mimefuncs, axe) {
    

    var DEBUG_TAG = 'browserbox IMAP';

    /**
     * Creates a connection object to an IMAP server. Call `connect` method to inititate
     * the actual connection, the constructor only defines the properties but does not actually connect.
     *
     * @constructor
     *
     * @param {String} [host='localhost'] Hostname to conenct to
     * @param {Number} [port=143] Port number to connect to
     * @param {Object} [options] Optional options object
     * @param {Boolean} [options.useSecureTransport] Set to true, to use encrypted connection
     */
    function ImapClient(host, port, options) {
        this._TCPSocket = TCPSocket;

        this.options = options || {};

        this.port = port || (this.options.useSecureTransport ? 993 : 143);
        this.host = host || 'localhost';

        /**
         * If set to true, start an encrypted connection instead of the plaintext one
         * (recommended if applicable). If useSecureTransport is not set but the port used is 993,
         * then ecryption is used by default.
         */
        this.options.useSecureTransport = 'useSecureTransport' in this.options ? !!this.options.useSecureTransport : this.port === 993;

        /**
         * Authentication object. If not set, authentication step will be skipped.
         */
        this.options.auth = this.options.auth || false;

        /**
         * Downstream TCP socket to the IMAP server, created with TCPSocket
         */
        this.socket = false;

        /**
         * Indicates if the connection has been closed and can't be used anymore
         *
         */
        this.destroyed = false;

        /**
         * Keeps track if the downstream socket is currently full and
         * a drain event should be waited for or not
         */
        this.waitDrain = false;

        // Private properties

        /**
         * Does the connection use SSL/TLS
         */
        this.secureMode = !!this.options.useSecureTransport;

        /**
         * Is the conection established and greeting is received from the server
         */
        this._connectionReady = false;

        /**
         * As the server sends data in chunks, it needs to be split into
         * separate lines. These variables help with parsing the input.
         */
        this._remainder = '';
        this._command = '';
        this._literalRemaining = 0;

        /**
         * Is there something being processed
         */
        this._processingServerData = false;

        /**
         * Queue of received commands
         */
        this._serverQueue = [];

        /**
         * Is it OK to send something to the server
         */
        this._canSend = false;

        /**
         * Queue of outgoing commands
         */
        this._clientQueue = [];

        /**
         * Counter to allow uniqueue imap tags
         */
        this._tagCounter = 0;

        /**
         * Current command that is waiting for response from the server
         */
        this._currentCommand = false;

        /**
         * Global handlers for unrelated responses (EXPUNGE, EXISTS etc.)
         */
        this._globalAcceptUntagged = {};

        /**
         * Timer waiting to enter idle
         */
        this._idleTimer = false;

        /**
         * Timer waiting to declare the socket dead starting from the last write
         */
        this._socketTimeoutTimer = false;
    }

    // Constants

    /**
     * How much time to wait since the last response until the connection is considered idling
     */
    ImapClient.prototype.TIMEOUT_ENTER_IDLE = 1000;

    /**
     * Lower Bound for socket timeout to wait since the last data was written to a socket
     */
    ImapClient.prototype.TIMEOUT_SOCKET_LOWER_BOUND = 10000;

    /**
     * Multiplier for socket timeout:
     *
     * We assume at least a GPRS connection with 115 kb/s = 14,375 kB/s tops, so 10 KB/s to be on
     * the safe side. We can timeout after a lower bound of 10s + (n KB / 10 KB/s). A 1 MB message
     * upload would be 110 seconds to wait for the timeout. 10 KB/s === 0.1 s/B
     */
    ImapClient.prototype.TIMEOUT_SOCKET_MULTIPLIER = 0.1;

    // PUBLIC EVENTS
    // Event functions should be overriden, these are just placeholders

    /**
     * Will be run when an error occurs. Connection to the server will be closed automatically,
     * so wait for an `onclose` event as well.
     *
     * @event
     * @param {Error} err Error object
     */
    ImapClient.prototype.onerror = function() {};

    /**
     * More data can be buffered in the socket. See `waitDrain` property or
     * check if `send` method returns false to see if you should be waiting
     * for the drain event.
     *
     * @event
     */
    ImapClient.prototype.ondrain = function() {};

    /**
     * The connection to the server has been closed
     *
     * @event
     */
    ImapClient.prototype.onclose = function() {};

    /**
     * The connection to the server has been established and greeting is received
     *
     * @event
     */
    ImapClient.prototype.onready = function() {};

    /**
     * There are no more commands to process
     *
     * @event
     */
    ImapClient.prototype.onidle = function() {};

    // PUBLIC METHODS

    /**
     * Initiate a connection to the server. Wait for onready event
     */
    ImapClient.prototype.connect = function() {
        this.socket = this._TCPSocket.open(this.host, this.port, {
            binaryType: 'arraybuffer',
            useSecureTransport: this.secureMode,
            ca: this.options.ca,
            tlsWorkerPath: this.options.tlsWorkerPath
        });

        // allows certificate handling for platform w/o native tls support
        // oncert is non standard so setting it might throw if the socket object is immutable
        try {
            this.socket.oncert = this.oncert;
        } catch (E) {}

        this.socket.onerror = this._onError.bind(this);
        this.socket.onopen = this._onOpen.bind(this);
    };

    /**
     * Closes the connection to the server
     */
    ImapClient.prototype.close = function() {
        if (this.socket && this.socket.readyState === 'open') {
            this.socket.close();
        } else {
            this._destroy();
        }
    };

    /**
     * Closes the connection to the server
     */
    ImapClient.prototype.upgrade = function(callback) {
        if (this.secureMode) {
            return callback(null, false);
        }
        this.secureMode = true;
        this.socket.upgradeToSecure();
        callback(null, true);
    };

    /**
     * Schedules a command to be sent to the server. This method is chainable.
     * See https://github.com/Kreata/imapHandler for request structure.
     * Do not provide a tag property, it will be set byt the queue manager.
     *
     * To catch untagged responses use acceptUntagged property. For example, if
     * the value for it is 'FETCH' then the reponse includes 'payload.FETCH' property
     * that is an array including all listed * FETCH responses.
     *
     * Callback function provides 2 arguments, parsed response object and continue callback.
     *
     *   function(response, next){
     *     console.log(response);
     *     next();
     *   }
     *
     * @param {Object} request Structured request object
     * @param {Array} acceptUntagged a list of untagged responses that will be included in 'payload' property
     * @param {Object} [options] Optional data for the command payload, eg. {onplustagged: function(response, next){next();}}
     * @param {Function} callback Callback function to run once the command has been processed
     */
    ImapClient.prototype.exec = function(request, acceptUntagged, options, callback) {

        if (typeof request === 'string') {
            request = {
                command: request
            };
        }
        this._addToClientQueue(request, acceptUntagged, options, callback);
        return this;
    };

    /**
     * Send data to the TCP socket
     * Arms a timeout waiting for a response from the server.
     *
     * @param {String} str Payload
     */
    ImapClient.prototype.send = function(str) {
        var buffer = mimefuncs.toTypedArray(str).buffer,
            timeout = this.TIMEOUT_SOCKET_LOWER_BOUND + Math.floor(buffer.byteLength * this.TIMEOUT_SOCKET_MULTIPLIER);

        clearTimeout(this._socketTimeoutTimer); // clear pending timeouts
        this._socketTimeoutTimer = setTimeout(this._onTimeout.bind(this), timeout); // arm the next timeout

        this.waitDrain = this.socket.send(buffer);
    };

    /**
     * Set a global handler for an untagged response. If currently processed command
     * has not listed untagged command it is forwarded to the global handler. Useful
     * with EXPUNGE, EXISTS etc.
     *
     * @param {String} command Untagged command name
     * @param {Function} callback Callback function with response object and continue callback function
     */
    ImapClient.prototype.setHandler = function(command, callback) {
        this._globalAcceptUntagged[(command || '').toString().toUpperCase().trim()] = callback;
    };

    // INTERNAL EVENTS

    /**
     * Error handler for the socket
     *
     * @event
     * @param {Event} evt Event object. See evt.data for the error
     */
    ImapClient.prototype._onError = function(evt) {
        if (this.isError(evt)) {
            this.onerror(evt);
        } else if (evt && this.isError(evt.data)) {
            this.onerror(evt.data);
        } else {
            this.onerror(new Error(evt && evt.data && evt.data.message || evt.data || evt || 'Error'));
        }

        this.close();
    };

    /**
     * Ensures that the connection is closed
     */
    ImapClient.prototype._destroy = function() {
        this._serverQueue = [];
        this._clientQueue = [];
        this._currentCommand = false;

        clearTimeout(this._idleTimer);
        clearTimeout(this._socketTimeoutTimer);

        if (!this.destroyed) {
            this.destroyed = true;
            this.onclose();
        }
    };

    /**
     * Indicates that the socket has been closed
     *
     * @event
     * @param {Event} evt Event object. Not used
     */
    ImapClient.prototype._onClose = function() {
        this._destroy();
    };

    /**
     * Indicates that a socket timeout has occurred
     */
    ImapClient.prototype._onTimeout = function() {
        // inform about the timeout, _onError takes case of the rest
        var error = new Error(this.options.sessionId + ' Socket timed out!');
        axe.error(DEBUG_TAG, error);
        this._onError(error);
    };

    /**
     * More data can be buffered in the socket, `waitDrain` is reset to false
     *
     * @event
     * @param {Event} evt Event object. Not used
     */
    ImapClient.prototype._onDrain = function() {
        this.waitDrain = false;
        this.ondrain();
    };

    /**
     * Handler for incoming data from the server. The data is sent in arbitrary
     * chunks and can't be used directly so this function makes sure the data
     * is split into complete lines before the data is passed to the command
     * handler
     *
     * @param {Event} evt
     */
    ImapClient.prototype._onData = function(evt) {
        if (!evt || !evt.data) {
            return;
        }

        clearTimeout(this._socketTimeoutTimer);

        var match,
            str = mimefuncs.fromTypedArray(evt.data);

        if (this._literalRemaining) {
            if (this._literalRemaining > str.length) {
                this._literalRemaining -= str.length;
                this._command += str;
                return;
            }
            this._command += str.substr(0, this._literalRemaining);
            str = str.substr(this._literalRemaining);
            this._literalRemaining = 0;
        }
        this._remainder = str = this._remainder + str;
        while ((match = str.match(/(\{(\d+)(\+)?\})?\r?\n/))) {

            if (!match[2]) {
                // Now we have a full command line, so lets do something with it
                this._addToServerQueue(this._command + str.substr(0, match.index));

                this._remainder = str = str.substr(match.index + match[0].length);
                this._command = '';
                continue;
            }

            this._remainder = '';

            this._command += str.substr(0, match.index + match[0].length);

            this._literalRemaining = Number(match[2]);

            str = str.substr(match.index + match[0].length);

            if (this._literalRemaining > str.length) {
                this._command += str;
                this._literalRemaining -= str.length;
                return;
            } else {
                this._command += str.substr(0, this._literalRemaining);
                this._remainder = str = str.substr(this._literalRemaining);
                this._literalRemaining = 0;
            }
        }
    };

    /**
     * Connection listener that is run when the connection to the server is opened.
     * Sets up different event handlers for the opened socket
     *
     * @event
     */
    ImapClient.prototype._onOpen = function() {
        axe.debug(DEBUG_TAG, this.options.sessionId + ' tcp socket opened');
        this.socket.ondata = this._onData.bind(this);
        this.socket.onclose = this._onClose.bind(this);
        this.socket.ondrain = this._onDrain.bind(this);
    };

    // PRIVATE METHODS

    /**
     * Pushes command line from the server to the server processing queue. If the
     * processor is idle, start processing.
     *
     * @param {String} cmd Command line
     */
    ImapClient.prototype._addToServerQueue = function(cmd) {
        this._serverQueue.push(cmd);

        if (this._processingServerData) {
            return;
        }

        this._processingServerData = true;
        this._processServerQueue();
    };

    /**
     * Process a command from the queue. The command is parsed and feeded to a handler
     */
    ImapClient.prototype._processServerQueue = function() {
        if (!this._serverQueue.length) {
            this._processingServerData = false;
            return;
        } else {
            this._clearIdle();
        }

        var data = this._serverQueue.shift(),
            response;

        try {
            // + tagged response is a special case, do not try to parse it
            if (/^\+/.test(data)) {
                response = {
                    tag: '+',
                    payload: data.substr(2) || ''
                };
            } else {
                response = imapHandler.parser(data);
                axe.debug(DEBUG_TAG, this.options.sessionId + ' S: ' + imapHandler.compiler(response, false, true));
            }
        } catch (e) {
            axe.error(DEBUG_TAG, this.options.sessionId + ' error parsing imap response: ' + e + '\n' + e.stack + '\nraw:' + data);
            return this._onError(e);
        }

        if (response.tag === '*' &&
            /^\d+$/.test(response.command) &&
            response.attributes && response.attributes.length && response.attributes[0].type === 'ATOM') {
            response.nr = Number(response.command);
            response.command = (response.attributes.shift().value || '').toString().toUpperCase().trim();
        }

        // feed the next chunk to the server if a + tagged response was received
        if (response.tag === '+') {
            if (this._currentCommand.data.length) {
                data = this._currentCommand.data.shift();
                this.send(data + (!this._currentCommand.data.length ? '\r\n' : ''));
            } else if (typeof this._currentCommand.onplustagged === 'function') {
                this._currentCommand.onplustagged(response, this._processServerQueue.bind(this));
                return;
            }
            setTimeout(this._processServerQueue.bind(this), 0);
            return;
        }

        this._processServerResponse(response, function(err) {
            if (err) {
                return this._onError(err);
            }

            // first response from the server, connection is now usable
            if (!this._connectionReady) {
                this._connectionReady = true;
                this.onready();
                this._canSend = true;
                this._sendRequest();
            } else if (response.tag !== '*') {
                // allow sending next command after full response
                this._canSend = true;
                this._sendRequest();
            }

            setTimeout(this._processServerQueue.bind(this), 0);
        }.bind(this));
    };

    /**
     * Feeds a parsed response object to an appropriate handler
     *
     * @param {Object} response Parsed command object
     * @param {Function} callback Continue callback function
     */
    ImapClient.prototype._processServerResponse = function(response, callback) {
        var command = (response && response.command || '').toUpperCase().trim();

        this._processResponse(response);

        if (!this._currentCommand) {
            if (response.tag === '*' && command in this._globalAcceptUntagged) {
                return this._globalAcceptUntagged[command](response, callback);
            } else {
                return callback();
            }
        }

        if (this._currentCommand.payload && response.tag === '*' && command in this._currentCommand.payload) {

            this._currentCommand.payload[command].push(response);
            return callback();

        } else if (response.tag === '*' && command in this._globalAcceptUntagged) {

            this._globalAcceptUntagged[command](response, callback);

        } else if (response.tag === this._currentCommand.tag) {

            if (typeof this._currentCommand.callback === 'function') {

                if (this._currentCommand.payload && Object.keys(this._currentCommand.payload).length) {
                    response.payload = this._currentCommand.payload;
                }

                return this._currentCommand.callback(response, callback);
            } else {
                return callback();
            }

        } else {
            // Unexpected response
            return callback();
        }
    };

    /**
     * Adds a request object to outgoing queue. And if data can be sent to the server,
     * the command is executed
     *
     * @param {Object} request Structured request object
     * @param {Array} [acceptUntagged] a list of untagged responses that will be included in 'payload' property
     * @param {Object} [options] Optional data for the command payload, eg. {onplustagged: function(response, next){next();}}
     * @param {Function} callback Callback function to run once the command has been processed
     */
    ImapClient.prototype._addToClientQueue = function(request, acceptUntagged, options, callback) {
        var tag = 'W' + (++this._tagCounter),
            data;

        if (!callback && typeof options === 'function') {
            callback = options;
            options = undefined;
        }

        if (!callback && typeof acceptUntagged === 'function') {
            callback = acceptUntagged;
            acceptUntagged = undefined;
        }

        acceptUntagged = [].concat(acceptUntagged || []).map(function(untagged) {
            return (untagged || '').toString().toUpperCase().trim();
        });

        request.tag = tag;

        data = {
            tag: tag,
            request: request,
            payload: acceptUntagged.length ? {} : undefined,
            callback: callback
        };

        // apply any additional options to the command
        Object.keys(options || {}).forEach(function(key) {
            data[key] = options[key];
        });

        acceptUntagged.forEach(function(command) {
            data.payload[command] = [];
        });

        // if we're in priority mode (i.e. we ran commands in a precheck),
        // queue any commands BEFORE the command that contianed the precheck,
        // otherwise just queue command as usual
        var index = data.ctx ? this._clientQueue.indexOf(data.ctx) : -1;
        if (index >= 0) {
            data.tag += '.p';
            data.request.tag += '.p';
            this._clientQueue.splice(index, 0, data);
        } else {
            this._clientQueue.push(data);
        }

        if (this._canSend) {
            this._sendRequest();
        }
    };

    /**
     * Sends a command from client queue to the server.
     */
    ImapClient.prototype._sendRequest = function() {
        if (!this._clientQueue.length) {
            return this._enterIdle();
        }
        this._clearIdle();

        // an operation was made in the precheck, no need to restart the queue manually
        this._restartQueue = false;

        var command = this._clientQueue[0];
        if (typeof command.precheck === 'function') {
            // remember the context
            var context = command;
            var precheck = context.precheck;
            delete context.precheck;

            // we need to restart the queue handling if no operation was made in the precheck
            this._restartQueue = true;

            // invoke the precheck command with a callback to signal that you're
            // done with precheck and ready to resume normal operation
            precheck(context, function(err) {
                // we're done with the precheck
                if (!err) {
                    if (this._restartQueue) {
                        // we need to restart the queue handling
                        this._sendRequest();
                    }
                    return;
                }

                // precheck callback failed, so we remove the initial command
                // from the queue, invoke its callback and resume normal operation
                var cmd, index = this._clientQueue.indexOf(context);
                if (index >= 0) {
                    cmd = this._clientQueue.splice(index, 1)[0];
                }
                if (cmd && cmd.callback) {
                    cmd.callback(err, function() {
                        this._canSend = true;
                        this._sendRequest();
                        setTimeout(this._processServerQueue.bind(this), 0);
                    }.bind(this));
                }
            }.bind(this));
            return;
        }

        this._canSend = false;
        this._currentCommand = this._clientQueue.shift();
        var loggedCommand = false;

        try {
            this._currentCommand.data = imapHandler.compiler(this._currentCommand.request, true);
            loggedCommand = imapHandler.compiler(this._currentCommand.request, false, true);
        } catch (e) {
            axe.error(DEBUG_TAG, this.options.sessionId + ' error compiling imap command: ' + e + '\nstack trace: ' + e.stack + '\nraw:' + this._currentCommand.request);
            return this._onError(e);
        }

        axe.debug(DEBUG_TAG, this.options.sessionId + ' C: ' + loggedCommand);
        var data = this._currentCommand.data.shift();

        this.send(data + (!this._currentCommand.data.length ? '\r\n' : ''));
        return this.waitDrain;
    };

    /**
     * Emits onidle, noting to do currently
     */
    ImapClient.prototype._enterIdle = function() {
        clearTimeout(this._idleTimer);
        this._idleTimer = setTimeout(function() {
            this.onidle();
        }.bind(this), this.TIMEOUT_ENTER_IDLE);
    };

    /**
     * Cancel idle timer
     */
    ImapClient.prototype._clearIdle = function() {
        clearTimeout(this._idleTimer);
    };

    // HELPER FUNCTIONS

    /**
     * Method checks if a response includes optional response codes
     * and copies these into separate properties. For example the
     * following response includes a capability listing and a human
     * readable message:
     *
     *     * OK [CAPABILITY ID NAMESPACE] All ready
     *
     * This method adds a 'capability' property with an array value ['ID', 'NAMESPACE']
     * to the response object. Additionally 'All ready' is added as 'humanReadable' property.
     *
     * See possiblem IMAP Response Codes at https://tools.ietf.org/html/rfc5530
     *
     * @param {Object} response Parsed response object
     */
    ImapClient.prototype._processResponse = function(response) {
        var command = (response && response.command || '').toString().toUpperCase().trim(),
            option,
            key;

        if (['OK', 'NO', 'BAD', 'BYE', 'PREAUTH'].indexOf(command) >= 0) {
            // Check if the response includes an optional response code
            if (
                (option = response && response.attributes &&
                    response.attributes.length && response.attributes[0].type === 'ATOM' &&
                    response.attributes[0].section && response.attributes[0].section.map(function(key) {
                        if (!key) {
                            return;
                        }
                        if (Array.isArray(key)) {
                            return key.map(function(key) {
                                return (key.value || '').toString().trim();
                            });
                        } else {
                            return (key.value || '').toString().toUpperCase().trim();
                        }
                    }))) {

                key = option && option.shift();

                response.code = key;

                if (option.length) {
                    option = [].concat(option || []);
                    response[key.toLowerCase()] = option.length === 1 ? option[0] : option;
                }
            }

            // If last element of the response is TEXT then this is for humans
            if (response && response.attributes && response.attributes.length &&
                response.attributes[response.attributes.length - 1].type === 'TEXT') {

                response.humanReadable = response.attributes[response.attributes.length - 1].value;
            }
        }
    };

    /**
     * Checks if a value is an Error object
     *
     * @param {Mixed} value Value to be checked
     * @return {Boolean} returns true if the value is an Error
     */
    ImapClient.prototype.isError = function(value) {
        return !!Object.prototype.toString.call(value).match(/Error\]$/);
    };

    return ImapClient;
}));
// Copyright (c) 2014 Andris Reinman

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

(function(root, factory) {
    

    if (typeof define === 'function' && define.amd) {
        define('browserbox',['browserbox-imap', 'utf7', 'imap-handler', 'mimefuncs', 'axe'], function(ImapClient, utf7, imapHandler, mimefuncs, axe) {
            return factory(ImapClient, utf7, imapHandler, mimefuncs, axe);
        });
    } else if (typeof exports === 'object') {

        module.exports = factory(require('./browserbox-imap'), require('wo-utf7'), require('wo-imap-handler'), require('mimefuncs'), require('axe-logger'));
    } else {
        root.BrowserBox = factory(root.BrowserboxImapClient, root.utf7, root.imapHandler, root.mimefuncs, root.axe);
    }
}(this, function(ImapClient, utf7, imapHandler, mimefuncs, axe) {
    

    var DEBUG_TAG = 'browserbox';
    var SPECIAL_USE_FLAGS = ['\\All', '\\Archive', '\\Drafts', '\\Flagged', '\\Junk', '\\Sent', '\\Trash'];
    var SPECIAL_USE_BOXES = {
        '\\Sent': ['aika', 'bidaliak', 'bidalita', 'dihantar', 'e rometsweng', 'e tindami', 'elküldött', 'elküldöttek', 'enviadas', 'enviadas', 'enviados', 'enviats', 'envoyés', 'ethunyelweyo', 'expediate', 'ezipuru', 'gesendete', 'gestuur', 'gönderilmiş öğeler', 'göndərilənlər', 'iberilen', 'inviati', 'išsiųstieji', 'kuthunyelwe', 'lasa', 'lähetetyt', 'messages envoyés', 'naipadala', 'nalefa', 'napadala', 'nosūtītās ziņas', 'odeslané', 'padala', 'poslane', 'poslano', 'poslano', 'poslané', 'poslato', 'saadetud', 'saadetud kirjad', 'sendt', 'sendt', 'sent', 'sent items', 'sent messages', 'sända poster', 'sänt', 'terkirim', 'ti fi ranṣẹ', 'të dërguara', 'verzonden', 'vilivyotumwa', 'wysłane', 'đã gửi', 'σταλθέντα', 'жиберилген', 'жіберілгендер', 'изпратени', 'илгээсэн', 'ирсол шуд', 'испратено', 'надіслані', 'отправленные', 'пасланыя', 'юборилган', 'ուղարկված', 'נשלחו', 'פריטים שנשלחו', 'المرسلة', 'بھیجے گئے', 'سوزمژہ', 'لېګل شوی', 'موارد ارسال شده', 'पाठविले', 'पाठविलेले', 'प्रेषित', 'भेजा गया', 'প্রেরিত', 'প্রেরিত', 'প্ৰেৰিত', 'ਭੇਜੇ', 'મોકલેલા', 'ପଠାଗଲା', 'அனுப்பியவை', 'పంపించబడింది', 'ಕಳುಹಿಸಲಾದ', 'അയച്ചു', 'යැවු පණිවුඩ', 'ส่งแล้ว', 'გაგზავნილი', 'የተላኩ', 'បាន​ផ្ញើ', '寄件備份', '寄件備份', '已发信息', '送信済みﾒｰﾙ', '발신 메시지', '보낸 편지함'],
        '\\Trash': ['articole șterse', 'bin', 'borttagna objekt', 'deleted', 'deleted items', 'deleted messages', 'elementi eliminati', 'elementos borrados', 'elementos eliminados', 'gelöschte objekte', 'item dipadam', 'itens apagados', 'itens excluídos', 'mục đã xóa', 'odstraněné položky', 'pesan terhapus', 'poistetut', 'praht', 'prügikast', 'silinmiş öğeler', 'slettede beskeder', 'slettede elementer', 'trash', 'törölt elemek', 'usunięte wiadomości', 'verwijderde items', 'vymazané správy', 'éléments supprimés', 'видалені', 'жойылғандар', 'удаленные', 'פריטים שנמחקו', 'العناصر المحذوفة', 'موارد حذف شده', 'รายการที่ลบ', '已删除邮件', '已刪除項目', '已刪除項目'],
        '\\Junk': ['bulk mail', 'correo no deseado', 'courrier indésirable', 'istenmeyen', 'istenmeyen e-posta', 'junk', 'levélszemét', 'nevyžiadaná pošta', 'nevyžádaná pošta', 'no deseado', 'posta indesiderata', 'pourriel', 'roskaposti', 'skräppost', 'spam', 'spam', 'spamowanie', 'søppelpost', 'thư rác', 'спам', 'דואר זבל', 'الرسائل العشوائية', 'هرزنامه', 'สแปม', '‎垃圾郵件', '垃圾邮件', '垃圾電郵'],
        '\\Drafts': ['ba brouillon', 'borrador', 'borrador', 'borradores', 'bozze', 'brouillons', 'bản thảo', 'ciorne', 'concepten', 'draf', 'drafts', 'drög', 'entwürfe', 'esborranys', 'garalamalar', 'ihe edeturu', 'iidrafti', 'izinhlaka', 'juodraščiai', 'kladd', 'kladder', 'koncepty', 'koncepty', 'konsep', 'konsepte', 'kopie robocze', 'layihələr', 'luonnokset', 'melnraksti', 'meralo', 'mesazhe të padërguara', 'mga draft', 'mustandid', 'nacrti', 'nacrti', 'osnutki', 'piszkozatok', 'rascunhos', 'rasimu', 'skice', 'taslaklar', 'tsararrun saƙonni', 'utkast', 'vakiraoka', 'vázlatok', 'zirriborroak', 'àwọn àkọpamọ́', 'πρόχειρα', 'жобалар', 'нацрти', 'нооргууд', 'сиёҳнавис', 'хомаки хатлар', 'чарнавікі', 'чернетки', 'чернови', 'черновики', 'черновиктер', 'սևագրեր', 'טיוטות', 'مسودات', 'مسودات', 'موسودې', 'پیش نویسها', 'ڈرافٹ/', 'ड्राफ़्ट', 'प्रारूप', 'খসড়া', 'খসড়া', 'ড্ৰাফ্ট', 'ਡ੍ਰਾਫਟ', 'ડ્રાફ્ટસ', 'ଡ୍ରାଫ୍ଟ', 'வரைவுகள்', 'చిత్తు ప్రతులు', 'ಕರಡುಗಳು', 'കരടുകള്‍', 'කෙටුම් පත්', 'ฉบับร่าง', 'მონახაზები', 'ረቂቆች', 'សារព្រាង', '下書き', '草稿', '草稿', '草稿', '임시 보관함']
    };
    var SPECIAL_USE_BOX_FLAGS = Object.keys(SPECIAL_USE_BOXES);
    var SESSIONCOUNTER = 0;

    /**
     * High level IMAP client
     *
     * @constructor
     *
     * @param {String} [host='localhost'] Hostname to conenct to
     * @param {Number} [port=143] Port number to connect to
     * @param {Object} [options] Optional options object
     */
    function BrowserBox(host, port, options) {
        this.options = options || {};

        // Session identified used for logging
        this.options.sessionId = this.options.sessionId || '[' + (++SESSIONCOUNTER) + ']';

        /**
         * List of extensions the server supports
         */
        this.capability = [];

        /**
         * Server ID (rfc2971) as key value pairs
         */
        this.serverId = false;

        /**
         * Current state
         */
        this.state = false;

        /**
         * Is the connection authenticated
         */
        this.authenticated = false;

        /**
         * Selected mailbox
         */
        this.selectedMailbox = false;

        /**
         * IMAP client object
         */
        this.client = new ImapClient(host, port, this.options);

        this._enteredIdle = false;
        this._idleTimeout = false;

        this._init();
    }

    // State constants

    BrowserBox.prototype.STATE_CONNECTING = 1;
    BrowserBox.prototype.STATE_NOT_AUTHENTICATED = 2;
    BrowserBox.prototype.STATE_AUTHENTICATED = 3;
    BrowserBox.prototype.STATE_SELECTED = 4;
    BrowserBox.prototype.STATE_LOGOUT = 5;

    // Timeout constants

    /**
     * Milliseconds to wait for the greeting from the server until the connection is considered failed
     */
    BrowserBox.prototype.TIMEOUT_CONNECTION = 90 * 1000;

    /**
     * Milliseconds between NOOP commands while idling
     */
    BrowserBox.prototype.TIMEOUT_NOOP = 60 * 1000;

    /**
     * Milliseconds until IDLE command is cancelled
     */
    BrowserBox.prototype.TIMEOUT_IDLE = 60 * 1000;

    /**
     * Initialization method. Setup event handlers and such
     */
    BrowserBox.prototype._init = function() {
        // proxy error events
        this.client.onerror = function(err) {
            this.onerror(err);
        }.bind(this);

        // allows certificate handling for platforms w/o native tls support
        this.client.oncert = function(cert) {
            this.oncert(cert);
        }.bind(this);

        // proxy close events
        this.client.onclose = function() {
            clearTimeout(this._connectionTimeout);
            clearTimeout(this._idleTimeout);
            this.onclose();
        }.bind(this);

        // handle ready event which is fired when server has sent the greeting
        this.client.onready = this._onReady.bind(this);

        // start idling
        this.client.onidle = this._onIdle.bind(this);

        // set default handlers for untagged responses
        // capability updates
        this.client.setHandler('capability', this._untaggedCapabilityHandler.bind(this));
        // notifications
        this.client.setHandler('ok', this._untaggedOkHandler.bind(this));
        // message count has changed
        this.client.setHandler('exists', this._untaggedExistsHandler.bind(this));
        // message has been deleted
        this.client.setHandler('expunge', this._untaggedExpungeHandler.bind(this));
        // message has been updated (eg. flag change), not supported by gmail
        this.client.setHandler('fetch', this._untaggedFetchHandler.bind(this));
    };

    // Event placeholders
    BrowserBox.prototype.onclose = function() {};
    BrowserBox.prototype.onauth = function() {};
    BrowserBox.prototype.onupdate = function() {};
    BrowserBox.prototype.oncert = function() {};
    /* BrowserBox.prototype.onerror = function(err){}; // not defined by default */
    BrowserBox.prototype.onselectmailbox = function() {};
    BrowserBox.prototype.onclosemailbox = function() {};

    // Event handlers

    /**
     * Connection to the server is closed. Proxies to 'onclose'.
     *
     * @event
     */
    BrowserBox.prototype._onClose = function() {
        axe.debug(DEBUG_TAG, this.options.sessionId + ' connection closed. goodbye.');
        this.onclose();
    };

    /**
     * Connection to the server was not established. Proxies to 'onerror'.
     *
     * @event
     */
    BrowserBox.prototype._onTimeout = function() {
        clearTimeout(this._connectionTimeout);
        var error = new Error(this.options.sessionId + ' Timeout creating connection to the IMAP server');
        axe.error(DEBUG_TAG, error);
        this.onerror(error);
        this.client._destroy();
    };

    /**
     * Connection to the server is established. Method performs initial
     * tasks like updating capabilities and authenticating the user
     *
     * @event
     */
    BrowserBox.prototype._onReady = function() {
        clearTimeout(this._connectionTimeout);
        axe.debug(DEBUG_TAG, this.options.sessionId + ' session: connection established');
        this._changeState(this.STATE_NOT_AUTHENTICATED);

        this.updateCapability(function() {
            this.upgradeConnection(function(err) {
                if (err) {
                    // emit an error
                    this.onerror(err);
                    this.close();
                    return;
                }
                this.updateId(this.options.id, function() {
                    this.login(this.options.auth, function(err) {
                        if (err) {
                            // emit an error
                            this.onerror(err);
                            this.close();
                            return;
                        }
                        // emit
                        this.onauth();
                    }.bind(this));
                }.bind(this));
            }.bind(this));
        }.bind(this));
    };

    /**
     * Indicates that the connection started idling. Initiates a cycle
     * of NOOPs or IDLEs to receive notifications about updates in the server
     */
    BrowserBox.prototype._onIdle = function() {
        if (!this.authenticated || this._enteredIdle) {
            // No need to IDLE when not logged in or already idling
            return;
        }

        axe.debug(DEBUG_TAG, this.options.sessionId + ' client: started idling');
        this.enterIdle();
    };

    // Public methods

    /**
     * Initiate connection to the IMAP server
     */
    BrowserBox.prototype.connect = function() {
        axe.debug(DEBUG_TAG, this.options.sessionId + ' connecting to ' + this.client.host + ':' + this.client.port);
        this._changeState(this.STATE_CONNECTING);

        // set timeout to fail connection establishing
        clearTimeout(this._connectionTimeout);
        this._connectionTimeout = setTimeout(this._onTimeout.bind(this), this.TIMEOUT_CONNECTION);
        this.client.connect();
    };

    /**
     * Close current connection
     */
    BrowserBox.prototype.close = function(callback) {
        var promise;

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        axe.debug(DEBUG_TAG, this.options.sessionId + ' closing connection');
        this._changeState(this.STATE_LOGOUT);

        this.exec('LOGOUT', function(err) {
            if (typeof callback === 'function') {
                callback(err || null);
            }

            this.client.close();
        }.bind(this));

        return promise;
    };

    /**
     * Run an IMAP command.
     *
     * @param {Object} request Structured request object
     * @param {Array} acceptUntagged a list of untagged responses that will be included in 'payload' property
     * @param {Function} callback Callback function to run once the command has been processed
     */
    BrowserBox.prototype.exec = function() {
        var args = Array.prototype.slice.call(arguments),
            callback = args.pop();

        if (typeof callback !== 'function') {
            args.push(callback);
            callback = undefined;
        }

        args.push(function(response, next) {
            var error = null;

            if (response && response.capability) {
                this.capability = response.capability;
            }

            if (this.client.isError(response)) {
                error = response;
            } else if (['NO', 'BAD'].indexOf((response && response.command || '').toString().toUpperCase().trim()) >= 0) {
                error = new Error(response.humanReadable || 'Error');
                if (response.code) {
                    error.code = response.code;
                }
            }
            if (typeof callback === 'function') {
                callback(error, response, next);
            } else {
                next();
            }
        }.bind(this));

        this.breakIdle(function() {
            this.client.exec.apply(this.client, args);
        }.bind(this));
    };

    // IMAP macros

    /**
     * The connection is idling. Sends a NOOP or IDLE command
     *
     * IDLE details:
     *   https://tools.ietf.org/html/rfc2177
     */
    BrowserBox.prototype.enterIdle = function() {
        if (this._enteredIdle) {
            return;
        }
        this._enteredIdle = this.capability.indexOf('IDLE') >= 0 ? 'IDLE' : 'NOOP';
        axe.debug(DEBUG_TAG, this.options.sessionId + ' entering idle with ' + this._enteredIdle);

        if (this._enteredIdle === 'NOOP') {
            this._idleTimeout = setTimeout(function() {
                this.exec('NOOP');
            }.bind(this), this.TIMEOUT_NOOP);
        } else if (this._enteredIdle === 'IDLE') {
            this.client.exec({
                command: 'IDLE'
            }, function(response, next) {
                next();
            }.bind(this));
            this._idleTimeout = setTimeout(function() {
                axe.debug(DEBUG_TAG, this.options.sessionId + ' sending idle DONE');
                this.client.send('DONE\r\n');
                this._enteredIdle = false;
            }.bind(this), this.TIMEOUT_IDLE);
        }
    };

    /**
     * Stops actions related idling, if IDLE is supported, sends DONE to stop it
     *
     * @param {Function} callback Function to run after required actions are performed
     */
    BrowserBox.prototype.breakIdle = function(callback) {
        if (!this._enteredIdle) {
            return callback();
        }

        clearTimeout(this._idleTimeout);
        if (this._enteredIdle === 'IDLE') {
            axe.debug(DEBUG_TAG, this.options.sessionId + ' sending idle DONE');
            this.client.send('DONE\r\n');
        }
        this._enteredIdle = false;

        axe.debug(DEBUG_TAG, this.options.sessionId + ' idle terminated');

        return callback();
    };

    /**
     * Runs STARTTLS command if needed
     *
     * STARTTLS details:
     *   http://tools.ietf.org/html/rfc3501#section-6.2.1
     *
     * @param {Boolean} [forced] By default the command is not run if capability is already listed. Set to true to skip this validation
     * @param {Function} callback Callback function
     */
    BrowserBox.prototype.upgradeConnection = function(callback) {

        // skip request, if already secured
        if (this.client.secureMode) {
            return callback(null, false);
        }

        // skip if STARTTLS not available or starttls support disabled
        if ((this.capability.indexOf('STARTTLS') < 0 || this.options.ignoreTLS) && !this.options.requireTLS) {
            return callback(null, false);
        }

        this.exec('STARTTLS', function(err, response, next) {
            if (err) {
                callback(err);
                next();
            } else {
                this.capability = [];
                this.client.upgrade(function(err, upgraded) {
                    this.updateCapability(function() {
                        callback(err, upgraded);
                    });
                    next();
                }.bind(this));
            }
        }.bind(this));
    };

    /**
     * Runs CAPABILITY command
     *
     * CAPABILITY details:
     *   http://tools.ietf.org/html/rfc3501#section-6.1.1
     *
     * Doesn't register untagged CAPABILITY handler as this is already
     * handled by global handler
     *
     * @param {Boolean} [forced] By default the command is not run if capability is already listed. Set to true to skip this validation
     * @param {Function} callback Callback function
     */
    BrowserBox.prototype.updateCapability = function(forced, callback) {
        if (!callback && typeof forced === 'function') {
            callback = forced;
            forced = undefined;
        }

        // skip request, if not forced update and capabilities are already loaded
        if (!forced && this.capability.length) {
            return callback(null, false);
        }

        // If STARTTLS is required then skip capability listing as we are going to try
        // STARTTLS anyway and we re-check capabilities after connection is secured
        if (!this.client.secureMode && this.options.requireTLS) {
            return callback(null, false);
        }

        this.exec('CAPABILITY', function(err, response, next) {
            if (err) {
                callback(err);
            } else {
                callback(null, true);
            }
            next();
        });
    };

    /**
     * Runs NAMESPACE command
     *
     * NAMESPACE details:
     *   https://tools.ietf.org/html/rfc2342
     *
     * @param {Function} callback Callback function with the namespace information
     */
    BrowserBox.prototype.listNamespaces = function(callback) {
        var promise;

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        if (this.capability.indexOf('NAMESPACE') < 0) {
            setTimeout(function() {
                callback(null, false);
            }, 0);

            return promise;
        }

        this.exec('NAMESPACE', 'NAMESPACE', function(err, response, next) {
            if (err) {
                callback(err);
            } else {
                callback(null, this._parseNAMESPACE(response));
            }
            next();
        }.bind(this));

        return promise;
    };

    /**
     * Runs LOGIN or AUTHENTICATE XOAUTH2 command
     *
     * LOGIN details:
     *   http://tools.ietf.org/html/rfc3501#section-6.2.3
     * XOAUTH2 details:
     *   https://developers.google.com/gmail/xoauth2_protocol#imap_protocol_exchange
     *
     * @param {String} username
     * @param {String} password
     * @param {Function} callback Returns error if login failed
     */
    BrowserBox.prototype.login = function(auth, callback) {
        var command, options = {};

        if (!auth) {
            return callback(new Error('Authentication information not provided'));
        }

        if (this.capability.indexOf('AUTH=XOAUTH2') >= 0 && auth && auth.xoauth2) {
            command = {
                command: 'AUTHENTICATE',
                attributes: [{
                    type: 'ATOM',
                    value: 'XOAUTH2'
                }, {
                    type: 'ATOM',
                    value: this._buildXOAuth2Token(auth.user, auth.xoauth2),
                    sensitive: true
                }]
            };
            options.onplustagged = function(response, next) {
                var payload;
                if (response && response.payload) {
                    try {
                        payload = JSON.parse(mimefuncs.base64Decode(response.payload));
                    } catch (e) {
                        axe.error(DEBUG_TAG, this.options.sessionId + ' error parsing XOAUTH2 payload: ' + e + '\nstack trace: ' + e.stack);
                    }
                }
                // + tagged error response expects an empty line in return
                this.client.send('\r\n');
                next();
            }.bind(this);
        } else {
            command = {
                command: 'login',
                attributes: [{
                    type: 'STRING',
                    value: auth.user || ''
                }, {
                    type: 'STRING',
                    value: auth.pass || '',
                    sensitive: true
                }]
            };
        }

        this.exec(command, 'capability', options, function(err, response, next) {
            var capabilityUpdated = false;

            if (err) {
                callback(err);
                return next();
            }

            this._changeState(this.STATE_AUTHENTICATED);
            this.authenticated = true;

            // update post-auth capabilites
            // capability list shouldn't contain auth related stuff anymore
            // but some new extensions might have popped up that do not
            // make much sense in the non-auth state
            if (response.capability && response.capability.length) {
                // capabilites were listed with the OK [CAPABILITY ...] response
                this.capability = [].concat(response.capability || []);
                capabilityUpdated = true;
                axe.debug(DEBUG_TAG, this.options.sessionId + ' post-auth capabilites updated: ' + this.capability);
                callback(null, true);
            } else if (response.payload && response.payload.CAPABILITY && response.payload.CAPABILITY.length) {
                // capabilites were listed with * CAPABILITY ... response
                this.capability = [].concat(response.payload.CAPABILITY.pop().attributes || []).map(function(capa) {
                    return (capa.value || '').toString().toUpperCase().trim();
                });
                capabilityUpdated = true;
                axe.debug(DEBUG_TAG, this.options.sessionId + ' post-auth capabilites updated: ' + this.capability);
                callback(null, true);
            } else {
                // capabilities were not automatically listed, reload
                this.updateCapability(true, function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        axe.debug(DEBUG_TAG, this.options.sessionId + ' post-auth capabilites updated: ' + this.capability);
                        callback(null, true);
                    }
                }.bind(this));
            }

            next();
        }.bind(this));
    };

    /**
     * Runs ID command. Retrieves server ID
     *
     * ID details:
     *   http://tools.ietf.org/html/rfc2971
     *
     * Sets this.serverId value
     *
     * @param {Object} id ID as key value pairs. See http://tools.ietf.org/html/rfc2971#section-3.3 for possible values
     * @param {Function} callback
     */
    BrowserBox.prototype.updateId = function(id, callback) {
        if (this.capability.indexOf('ID') < 0) {
            return callback(null, false);
        }

        var attributes = [
            []
        ];
        if (id) {
            if (typeof id === 'string') {
                id = {
                    name: id
                };
            }
            Object.keys(id).forEach(function(key) {
                attributes[0].push(key);
                attributes[0].push(id[key]);
            });
        } else {
            attributes[0] = null;
        }

        this.exec({
            command: 'ID',
            attributes: attributes
        }, 'ID', function(err, response, next) {
            if (err) {
                axe.error(DEBUG_TAG, this.options.sessionId + ' error updating server id: ' + err + '\n' + err.stack);
                callback(err);
                return next();
            }

            if (!response.payload || !response.payload.ID || !response.payload.ID.length) {
                callback(null, false);
                return next();
            }

            this.serverId = {};

            var key;
            [].concat([].concat(response.payload.ID.shift().attributes || []).shift() || []).forEach(function(val, i) {
                if (i % 2 === 0) {
                    key = (val && val.value || '').toString().toLowerCase().trim();
                } else {
                    this.serverId[key] = (val && val.value || '').toString();
                }
            }.bind(this));

            callback(null, this.serverId);

            next();
        }.bind(this));
    };

    /**
     * Runs LIST and LSUB commands. Retrieves a tree of available mailboxes
     *
     * LIST details:
     *   http://tools.ietf.org/html/rfc3501#section-6.3.8
     * LSUB details:
     *   http://tools.ietf.org/html/rfc3501#section-6.3.9
     *
     * @param {Function} callback Returns mailbox tree object
     */
    BrowserBox.prototype.listMailboxes = function(callback) {
        var promise;

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        this.exec({
            command: 'LIST',
            attributes: ['', '*']
        }, 'LIST', function(err, response, next) {
            if (err) {
                callback(err);
                return next();
            }

            var tree = {
                root: true,
                children: []
            };

            if (!response.payload || !response.payload.LIST || !response.payload.LIST.length) {
                callback(null, false);
                return next();
            }

            response.payload.LIST.forEach(function(item) {
                if (!item || !item.attributes || item.attributes.length < 3) {
                    return;
                }
                var branch = this._ensurePath(tree, (item.attributes[2].value || '').toString(), (item.attributes[1] ? item.attributes[1].value : '/').toString());
                branch.flags = [].concat(item.attributes[0] || []).map(function(flag) {
                    return (flag.value || '').toString();
                });
                branch.listed = true;
                this._checkSpecialUse(branch);
            }.bind(this));

            this.exec({
                command: 'LSUB',
                attributes: ['', '*']
            }, 'LSUB', function(err, response, next) {
                if (err) {
                    axe.error(DEBUG_TAG, this.options.sessionId + ' error while listing subscribed mailboxes: ' + err + '\n' + err.stack);
                    callback(null, tree);
                    return next();
                }

                if (!response.payload || !response.payload.LSUB || !response.payload.LSUB.length) {
                    callback(null, tree);
                    return next();
                }

                response.payload.LSUB.forEach(function(item) {
                    if (!item || !item.attributes || item.attributes.length < 3) {
                        return;
                    }
                    var branch = this._ensurePath(tree, (item.attributes[2].value || '').toString(), (item.attributes[1] ? item.attributes[1].value : '/').toString());
                    [].concat(item.attributes[0] || []).map(function(flag) {
                        flag = (flag.value || '').toString();
                        if (!branch.flags || branch.flags.indexOf(flag) < 0) {
                            branch.flags = [].concat(branch.flags || []).concat(flag);
                        }
                    });
                    branch.subscribed = true;
                }.bind(this));

                callback(null, tree);

                next();
            }.bind(this));

            next();
        }.bind(this));

        return promise;
    };

    /**
     * Create a mailbox with the given path.
     *
     * CREATE details:
     *   http://tools.ietf.org/html/rfc3501#section-6.3.3
     *
     * @param {String} path
     *     The path of the mailbox you would like to create.  This method will
     *     handle utf7 encoding for you.
     * @param {Function} callback
     *     Callback that takes an error argument and a boolean indicating
     *     whether the folder already existed.  If the mailbox creation
     *     succeeds, the error argument will be null.  If creation fails, error
     *     will have an error value.  In the event the server says NO
     *     [ALREADYEXISTS], we treat that as success and return true for the
     *     second argument.
     */
    BrowserBox.prototype.createMailbox = function(path, callback) {
        var promise;

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        this.exec({
            command: 'CREATE',
            attributes: [utf7.imap.encode(path)]
        }, function(err, response, next) {
            if (err && err.code === 'ALREADYEXISTS') {
                callback(null, true);
            } else {
                callback(err, false);
            }
            next();
        });

        return promise;
    };

    /**
     * Runs FETCH command
     *
     * FETCH details:
     *   http://tools.ietf.org/html/rfc3501#section-6.4.5
     * CHANGEDSINCE details:
     *   https://tools.ietf.org/html/rfc4551#section-3.3
     *
     * @param {String} sequence Sequence set, eg 1:* for all messages
     * @param {Object} [items] Message data item names or macro
     * @param {Object} [options] Query modifiers
     * @param {Function} callback Callback function with fetched message info
     */
    BrowserBox.prototype.listMessages = function(sequence, items, options, callback) {
        var promise;

        if (!callback && typeof options === 'function') {
            callback = options;
            options = undefined;
        }

        if (!callback && typeof items === 'function') {
            callback = items;
            items = undefined;
        }

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        items = items || {
            fast: true
        };

        options = options || {};

        var command = this._buildFETCHCommand(sequence, items, options);
        this.exec(command, 'FETCH', {
            precheck: options.precheck,
            ctx: options.ctx
        }, function(err, response, next) {
            if (err) {
                callback(err);
            } else {
                callback(null, this._parseFETCH(response));
            }
            next();
        }.bind(this));

        return promise;
    };

    /**
     * Runs SEARCH command
     *
     * SEARCH details:
     *   http://tools.ietf.org/html/rfc3501#section-6.4.4
     *
     * @param {Object} query Search terms
     * @param {Object} [options] Query modifiers
     * @param {Function} callback Callback function with the array of matching seq. or uid numbers
     */
    BrowserBox.prototype.search = function(query, options, callback) {
        var promise;

        if (!callback && typeof options === 'function') {
            callback = options;
            options = undefined;
        }

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        options = options || {};

        var command = this._buildSEARCHCommand(query, options);
        this.exec(command, 'SEARCH', {
            precheck: options.precheck,
            ctx: options.ctx
        }, function(err, response, next) {
            if (err) {
                callback(err);
            } else {
                callback(null, this._parseSEARCH(response));
            }
            next();
        }.bind(this));

        return promise;
    };

    /**
     * Runs STORE command
     *
     * STORE details:
     *   http://tools.ietf.org/html/rfc3501#section-6.4.6
     *
     * @param {String} sequence Message selector which the flag change is applied to
     * @param {Array} flags
     * @param {Object} [options] Query modifiers
     * @param {Function} callback Callback function with the array of matching seq. or uid numbers
     */
    BrowserBox.prototype.setFlags = function(sequence, flags, options, callback) {
        var promise;

        if (!callback && typeof options === 'function') {
            callback = options;
            options = undefined;
        }

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        options = options || {};

        var command = this._buildSTORECommand(sequence, flags, options);
        this.exec(command, 'FETCH', {
            precheck: options.precheck,
            ctx: options.ctx
        }, function(err, response, next) {
            if (err) {
                callback(err);
            } else {
                callback(null, this._parseFETCH(response));
            }
            next();
        }.bind(this));

        return promise;
    };

    /**
     * Runs APPEND command
     *
     * APPEND details:
     *   http://tools.ietf.org/html/rfc3501#section-6.3.11
     *
     * @param {String} destination The mailbox where to append the message
     * @param {String} message The message to append
     * @param {Array} options.flags Any flags you want to set on the uploaded message. Defaults to [\Seen]. (optional)
     * @param {Function} callback Callback function with the array of matching seq. or uid numbers
     */
    BrowserBox.prototype.upload = function(destination, message, options, callback) {
        var promise;

        if (!callback && typeof options === 'function') {
            callback = options;
            options = undefined;
        }

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        options = options || {};
        options.flags = options.flags || ['\\Seen'];

        var flags = options.flags.map(function(flag) {
            return {
                type: 'atom',
                value: flag
            };
        });

        var command = {
            command: 'APPEND'
        };
        command.attributes = [{
                type: 'atom',
                value: destination
            },
            flags, {
                type: 'literal',
                value: message
            }
        ];

        this.exec(command, {
            precheck: options.precheck,
            ctx: options.ctx
        }, function(err, response, next) {
            callback(err, err ? undefined : true);
            next();
        }.bind(this));

        return promise;
    };

    /**
     * Deletes messages from a selected mailbox
     *
     * EXPUNGE details:
     *   http://tools.ietf.org/html/rfc3501#section-6.4.3
     * UID EXPUNGE details:
     *   https://tools.ietf.org/html/rfc4315#section-2.1
     *
     * If possible (byUid:true and UIDPLUS extension supported), uses UID EXPUNGE
     * command to delete a range of messages, otherwise falls back to EXPUNGE.
     *
     * NB! This method might be destructive - if EXPUNGE is used, then any messages
     * with \Deleted flag set are deleted
     *
     * Callback returns an error if the operation failed
     *
     * @param {String} sequence Message range to be deleted
     * @param {Object} [options] Query modifiers
     * @param {Function} callback Callback function
     */
    BrowserBox.prototype.deleteMessages = function(sequence, options, callback) {
        var promise;

        if (!callback && typeof options === 'function') {
            callback = options;
            options = undefined;
        }

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        options = options || {};

        // add \Deleted flag to the messages and run EXPUNGE or UID EXPUNGE
        this.setFlags(sequence, {
            add: '\\Deleted'
        }, options, function(err) {
            if (err) {
                return callback(err);
            }

            this.exec(
                options.byUid && this.capability.indexOf('UIDPLUS') >= 0 ? {
                    command: 'UID EXPUNGE',
                    attributes: [{
                        type: 'sequence',
                        value: sequence
                    }]
                } : 'EXPUNGE',
                function(err, response, next) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, true);
                    }
                    next();
                }.bind(this));
        }.bind(this));

        return promise;
    };

    /**
     * Copies a range of messages from the active mailbox to the destination mailbox.
     * Silent method (unless an error occurs), by default returns no information.
     *
     * COPY details:
     *   http://tools.ietf.org/html/rfc3501#section-6.4.7
     *
     * @param {String} sequence Message range to be copied
     * @param {String} destination Destination mailbox path
     * @param {Object} [options] Query modifiers
     * @param {Boolean} [options.byUid] If true, uses UID COPY instead of COPY
     * @param {Function} callback Callback function
     */
    BrowserBox.prototype.copyMessages = function(sequence, destination, options, callback) {
        var promise;

        if (!callback && typeof options === 'function') {
            callback = options;
            options = undefined;
        }

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        options = options || {};

        this.exec({
                command: options.byUid ? 'UID COPY' : 'COPY',
                attributes: [{
                    type: 'sequence',
                    value: sequence
                }, {
                    type: 'atom',
                    value: destination
                }]
            }, {
                precheck: options.precheck,
                ctx: options.ctx
            },
            function(err, response, next) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, response.humanReadable || 'COPY completed');
                }
                next();
            }.bind(this));

        return promise;
    };

    /**
     * Moves a range of messages from the active mailbox to the destination mailbox.
     * Prefers the MOVE extension but if not available, falls back to
     * COPY + EXPUNGE
     *
     * MOVE details:
     *   http://tools.ietf.org/html/rfc6851
     *
     * Callback returns an error if the operation failed
     *
     * @param {String} sequence Message range to be moved
     * @param {String} destination Destination mailbox path
     * @param {Object} [options] Query modifiers
     * @param {Function} callback Callback function
     */
    BrowserBox.prototype.moveMessages = function(sequence, destination, options, callback) {
        var promise;

        if (!callback && typeof options === 'function') {
            callback = options;
            options = undefined;
        }

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        options = options || {};
        if (this.capability.indexOf('MOVE') >= 0) {
            // If possible, use MOVE
            this.exec({
                    command: options.byUid ? 'UID MOVE' : 'MOVE',
                    attributes: [{
                        type: 'sequence',
                        value: sequence
                    }, {
                        type: 'atom',
                        value: destination
                    }]
                }, ['OK'], {
                    precheck: options.precheck,
                    ctx: options.ctx
                },
                function(err, response, next) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, true);
                    }
                    next();
                }.bind(this));
        } else {
            // Fallback to COPY + EXPUNGE
            this.copyMessages(sequence, destination, options, function(err) {
                if (err) {
                    return callback(err);
                }
                delete options.precheck;
                this.deleteMessages(sequence, options, callback);
            }.bind(this));
        }

        return promise;
    };

    /**
     * Runs SELECT or EXAMINE to open a mailbox
     *
     * SELECT details:
     *   http://tools.ietf.org/html/rfc3501#section-6.3.1
     * EXAMINE details:
     *   http://tools.ietf.org/html/rfc3501#section-6.3.2
     *
     * @param {String} path Full path to mailbox
     * @param {Object} [options] Options object
     * @param {Function} callback Return information about selected mailbox
     */
    BrowserBox.prototype.selectMailbox = function(path, options, callback) {
        var promise;

        if (!callback && typeof options === 'function') {
            callback = options;
            options = undefined;
        }

        if (!callback) {
            promise = new Promise(function(resolve, reject) {
                callback = callbackPromise(resolve, reject);
            });
        }

        options = options || {};

        var query = {
            command: options.readOnly ? 'EXAMINE' : 'SELECT',
            attributes: [{
                type: 'STRING',
                value: path
            }]
        };

        if (options.condstore && this.capability.indexOf('CONDSTORE') >= 0) {
            query.attributes.push([{
                type: 'ATOM',
                value: 'CONDSTORE'
            }]);
        }

        this.exec(query, ['EXISTS', 'FLAGS', 'OK'], {
            precheck: options.precheck,
            ctx: options.ctx
        }, function(err, response, next) {
            if (err) {
                callback(err);
                return next();
            }

            this._changeState(this.STATE_SELECTED);

            if (this.selectedMailbox && this.selectedMailbox !== path) {
                this.onclosemailbox(this.selectedMailbox);
            }

            this.selectedMailbox = path;

            var mailboxInfo = this._parseSELECT(response);

            callback(null, mailboxInfo);

            this.onselectmailbox(path, mailboxInfo);

            next();
        }.bind(this));

        return promise;
    };

    BrowserBox.prototype.hasCapability = function(capa) {
        return this.capability.indexOf((capa || '').toString().toUpperCase().trim()) >= 0;
    };

    // Default handlers for untagged responses

    /**
     * Checks if an untagged OK includes [CAPABILITY] tag and updates capability object
     *
     * @param {Object} response Parsed server response
     * @param {Function} next Until called, server responses are not processed
     */
    BrowserBox.prototype._untaggedOkHandler = function(response, next) {
        if (response && response.capability) {
            this.capability = response.capability;
        }
        next();
    };

    /**
     * Updates capability object
     *
     * @param {Object} response Parsed server response
     * @param {Function} next Until called, server responses are not processed
     */
    BrowserBox.prototype._untaggedCapabilityHandler = function(response, next) {
        this.capability = [].concat(response && response.attributes || []).map(function(capa) {
            return (capa.value || '').toString().toUpperCase().trim();
        });
        next();
    };

    /**
     * Updates existing message count
     *
     * @param {Object} response Parsed server response
     * @param {Function} next Until called, server responses are not processed
     */
    BrowserBox.prototype._untaggedExistsHandler = function(response, next) {
        if (response && response.hasOwnProperty('nr')) {
            this.onupdate('exists', response.nr);
        }
        next();
    };

    /**
     * Indicates a message has been deleted
     *
     * @param {Object} response Parsed server response
     * @param {Function} next Until called, server responses are not processed
     */
    BrowserBox.prototype._untaggedExpungeHandler = function(response, next) {
        if (response && response.hasOwnProperty('nr')) {
            this.onupdate('expunge', response.nr);
        }
        next();
    };

    /**
     * Indicates that flags have been updated for a message
     *
     * @param {Object} response Parsed server response
     * @param {Function} next Until called, server responses are not processed
     */
    BrowserBox.prototype._untaggedFetchHandler = function(response, next) {
        this.onupdate('fetch', [].concat(this._parseFETCH({
            payload: {
                FETCH: [response]
            }
        }) || []).shift());
        next();
    };

    // Private helpers

    /**
     * Parses SELECT response
     *
     * @param {Object} response
     * @return {Object} Mailbox information object
     */
    BrowserBox.prototype._parseSELECT = function(response) {
        if (!response || !response.payload) {
            return;
        }

        var mailbox = {
                readOnly: response.code === 'READ-ONLY'
            },

            existsResponse = response.payload.EXISTS && response.payload.EXISTS.pop(),
            flagsResponse = response.payload.FLAGS && response.payload.FLAGS.pop(),
            okResponse = response.payload.OK;

        if (existsResponse) {
            mailbox.exists = existsResponse.nr || 0;
        }

        if (flagsResponse && flagsResponse.attributes && flagsResponse.attributes.length) {
            mailbox.flags = flagsResponse.attributes[0].map(function(flag) {
                return (flag.value || '').toString().trim();
            });
        }

        [].concat(okResponse || []).forEach(function(ok) {
            switch (ok && ok.code) {
                case 'PERMANENTFLAGS':
                    mailbox.permanentFlags = [].concat(ok.permanentflags || []);
                    break;
                case 'UIDVALIDITY':
                    mailbox.uidValidity = Number(ok.uidvalidity) || 0;
                    break;
                case 'UIDNEXT':
                    mailbox.uidNext = Number(ok.uidnext) || 0;
                    break;
                case 'HIGHESTMODSEQ':
                    mailbox.highestModseq = ok.highestmodseq || '0'; // keep 64bit uint as a string
                    break;
            }
        });

        return mailbox;
    };

    /**
     * Parses NAMESPACE response
     *
     * @param {Object} response
     * @return {Object} Namespaces object
     */
    BrowserBox.prototype._parseNAMESPACE = function(response) {
        var attributes,
            namespaces = false,
            parseNsElement = function(arr) {
                return !arr ? false : [].concat(arr || []).map(function(ns) {
                    return !ns || !ns.length ? false : {
                        prefix: ns[0].value,
                        // The delimiter can legally be NIL which maps to null
                        delimiter: ns[1] && ns[1].value
                    };
                });
            };

        if (response.payload &&
            response.payload.NAMESPACE &&
            response.payload.NAMESPACE.length &&
            (attributes = [].concat(response.payload.NAMESPACE.pop().attributes || [])).length) {

            namespaces = {
                personal: parseNsElement(attributes[0]),
                users: parseNsElement(attributes[1]),
                shared: parseNsElement(attributes[2])
            };
        }

        return namespaces;
    };

    /**
     * Builds a FETCH command
     *
     * @param {String} sequence Message range selector
     * @param {Array} items List of elements to fetch (eg. `['uid', 'envelope']`).
     * @param {Object} [options] Optional options object. Use `{byUid:true}` for `UID FETCH`
     * @returns {Object} Structured IMAP command
     */
    BrowserBox.prototype._buildFETCHCommand = function(sequence, items, options) {
        var command = {
                command: options.byUid ? 'UID FETCH' : 'FETCH',
                attributes: [{
                    type: 'SEQUENCE',
                    value: sequence
                }]
            },

            query = [];

        [].concat(items || []).forEach(function(item) {
            var cmd;
            item = (item || '').toString().toUpperCase().trim();

            if (/^\w+$/.test(item)) {
                // alphanum strings can be used directly
                query.push({
                    type: 'ATOM',
                    value: item
                });
            } else if (item) {
                try {
                    // parse the value as a fake command, use only the attributes block
                    cmd = imapHandler.parser('* Z ' + item);
                    query = query.concat(cmd.attributes || []);
                } catch (E) {
                    // if parse failed, use the original string as one entity
                    query.push({
                        type: 'ATOM',
                        value: item
                    });
                }
            }
        });

        if (query.length === 1) {
            query = query.pop();
        }

        command.attributes.push(query);

        if (options.changedSince) {
            command.attributes.push([{
                type: 'ATOM',
                value: 'CHANGEDSINCE'
            }, {
                type: 'ATOM',
                value: options.changedSince
            }]);
        }
        return command;
    };

    /**
     * Parses FETCH response
     *
     * @param {Object} response
     * @return {Object} Message object
     */
    BrowserBox.prototype._parseFETCH = function(response) {
        var list;

        if (!response || !response.payload || !response.payload.FETCH || !response.payload.FETCH.length) {
            return [];
        }

        list = [].concat(response.payload.FETCH || []).map(function(item) {
            var
            // ensure the first value is an array
                params = [].concat([].concat(item.attributes || [])[0] || []),
                message = {
                    '#': item.nr
                },
                i, len, key;

            for (i = 0, len = params.length; i < len; i++) {
                if (i % 2 === 0) {
                    key = imapHandler.compiler({
                        attributes: [params[i]]
                    }).toLowerCase().replace(/<\d+>$/, '');
                    continue;
                }
                message[key] = this._parseFetchValue(key, params[i]);
            }

            return message;
        }.bind(this));

        return list;
    };

    /**
     * Parses a single value from the FETCH response object
     *
     * @param {String} key Key name (uppercase)
     * @param {Mized} value Value for the key
     * @return {Mixed} Processed value
     */
    BrowserBox.prototype._parseFetchValue = function(key, value) {
        if (!value) {
            return null;
        }

        if (!Array.isArray(value)) {
            switch (key) {
                case 'uid':
                case 'rfc822.size':
                    return Number(value.value) || 0;
                case 'modseq': // do not cast 64 bit uint to a number
                    return value.value || '0';
            }
            return value.value;
        }

        switch (key) {
            case 'flags':
                value = [].concat(value).map(function(flag) {
                    return flag.value || '';
                });
                break;
            case 'envelope':
                value = this._parseENVELOPE([].concat(value || []));
                break;
            case 'bodystructure':
                value = this._parseBODYSTRUCTURE([].concat(value || []));
                break;
            case 'modseq':
                value = (value.shift() || {}).value || '0';
                break;
        }

        return value;
    };

    /**
     * Parses message envelope from FETCH response. All keys in the resulting
     * object are lowercase. Address fields are all arrays with {name:, address:}
     * structured values. Unicode strings are automatically decoded.
     *
     * @param {Array} value Envelope array
     * @param {Object} Envelope object
     */
    BrowserBox.prototype._parseENVELOPE = function(value) {
        var processAddresses = function(list) {
                return [].concat(list || []).map(function(addr) {
                    return {
                        name: mimefuncs.mimeWordsDecode(addr[0] && addr[0].value || ''),
                        address: (addr[2] && addr[2].value || '') + '@' + (addr[3] && addr[3].value || '')
                    };
                });
            },
            envelope = {};

        if (value[0] && value[0].value) {
            envelope.date = value[0].value;
        }

        if (value[1] && value[1].value) {
            envelope.subject = mimefuncs.mimeWordsDecode(value[1] && value[1].value);
        }

        if (value[2] && value[2].length) {
            envelope.from = processAddresses(value[2]);
        }

        if (value[3] && value[3].length) {
            envelope.sender = processAddresses(value[3]);
        }

        if (value[4] && value[4].length) {
            envelope['reply-to'] = processAddresses(value[4]);
        }

        if (value[5] && value[5].length) {
            envelope.to = processAddresses(value[5]);
        }

        if (value[6] && value[6].length) {
            envelope.cc = processAddresses(value[6]);
        }

        if (value[7] && value[7].length) {
            envelope.bcc = processAddresses(value[7]);
        }

        if (value[8] && value[8].value) {
            envelope['in-reply-to'] = value[8].value;
        }

        if (value[9] && value[9].value) {
            envelope['message-id'] = value[9].value;
        }

        return envelope;
    };

    /**
     * Parses message body structure from FETCH response.
     *
     * TODO: implement actual handler
     *
     * @param {Array} value BODYSTRUCTURE array
     * @param {Object} Envelope object
     */
    BrowserBox.prototype._parseBODYSTRUCTURE = function(value) {
        // doesn't do anything yet

        var that = this;
        var processNode = function(node, path) {
            path = path || [];

            var curNode = {},
                i = 0,
                key, part = 0;

            if (path.length) {
                curNode.part = path.join('.');
            }

            // multipart
            if (Array.isArray(node[0])) {
                curNode.childNodes = [];
                while (Array.isArray(node[i])) {
                    curNode.childNodes.push(processNode(node[i], path.concat(++part)));
                    i++;
                }

                // multipart type
                curNode.type = 'multipart/' + ((node[i++] || {}).value || '').toString().toLowerCase();

                // extension data (not available for BODY requests)

                // body parameter parenthesized list
                if (i < node.length - 1) {
                    if (node[i]) {
                        curNode.parameters = {};
                        [].concat(node[i] || []).forEach(function(val, j) {
                            if (j % 2) {
                                curNode.parameters[key] = mimefuncs.mimeWordsDecode((val && val.value || '').toString());
                            } else {
                                key = (val && val.value || '').toString().toLowerCase();
                            }
                        });
                    }
                    i++;
                }
            } else {

                // content type
                curNode.type = [
                    ((node[i++] || {}).value || '').toString().toLowerCase(), ((node[i++] || {}).value || '').toString().toLowerCase()
                ].join('/');

                // body parameter parenthesized list
                if (node[i]) {
                    curNode.parameters = {};
                    [].concat(node[i] || []).forEach(function(val, j) {
                        if (j % 2) {
                            curNode.parameters[key] = mimefuncs.mimeWordsDecode((val && val.value || '').toString());
                        } else {
                            key = (val && val.value || '').toString().toLowerCase();
                        }
                    });
                }
                i++;

                // id
                if (node[i]) {
                    curNode.id = ((node[i] || {}).value || '').toString();
                }
                i++;

                // description
                if (node[i]) {
                    curNode.description = ((node[i] || {}).value || '').toString();
                }
                i++;

                // encoding
                if (node[i]) {
                    curNode.encoding = ((node[i] || {}).value || '').toString().toLowerCase();
                }
                i++;

                // size
                if (node[i]) {
                    curNode.size = Number((node[i] || {}).value || 0) || 0;
                }
                i++;

                if (curNode.type === 'message/rfc822') {
                    // message/rfc adds additional envelope, bodystructure and line count values

                    // envelope
                    if (node[i]) {
                        curNode.envelope = that._parseENVELOPE([].concat(node[i] || []));
                    }
                    i++;

                    if (node[i]) {
                        curNode.childNodes = [
                            // rfc822 bodyparts share the same path, difference is between MIME and HEADER
                            // path.MIME returns message/rfc822 header
                            // path.HEADER returns inlined message header
                            processNode(node[i], path)
                        ];
                    }
                    i++;

                    // line count
                    if (node[i]) {
                        curNode.lineCount = Number((node[i] || {}).value || 0) || 0;
                    }
                    i++;

                } else if (/^text\//.test(curNode.type)) {
                    // text/* adds additional line count values

                    // line count
                    if (node[i]) {
                        curNode.lineCount = Number((node[i] || {}).value || 0) || 0;
                    }
                    i++;

                }

                // extension data (not available for BODY requests)

                // md5
                if (i < node.length - 1) {
                    if (node[i]) {
                        curNode.md5 = ((node[i] || {}).value || '').toString().toLowerCase();
                    }
                    i++;
                }
            }

            // the following are shared extension values (for both multipart and non-multipart parts)
            // not available for BODY requests

            // body disposition
            if (i < node.length - 1) {
                if (Array.isArray(node[i]) && node[i].length) {
                    curNode.disposition = ((node[i][0] || {}).value || '').toString().toLowerCase();
                    if (Array.isArray(node[i][1])) {
                        curNode.dispositionParameters = {};
                        [].concat(node[i][1] || []).forEach(function(val, j) {
                            if (j % 2) {
                                curNode.dispositionParameters[key] = mimefuncs.mimeWordsDecode((val && val.value || '').toString());
                            } else {
                                key = (val && val.value || '').toString().toLowerCase();
                            }
                        });
                    }
                }
                i++;
            }

            // body language
            if (i < node.length - 1) {
                if (node[i]) {
                    curNode.language = [].concat(node[i] || []).map(function(val) {
                        return (val && val.value || '').toString().toLowerCase();
                    });
                }
                i++;
            }

            // body location
            // NB! defined as a "string list" in RFC3501 but replaced in errata document with "string"
            // Errata: http://www.rfc-editor.org/errata_search.php?rfc=3501
            if (i < node.length - 1) {
                if (node[i]) {
                    curNode.location = ((node[i] || {}).value || '').toString();
                }
                i++;
            }

            return curNode;
        };

        return processNode(value);
    };

    /**
     * Compiles a search query into an IMAP command. Queries are composed as objects
     * where keys are search terms and values are term arguments. Only strings,
     * numbers and Dates are used. If the value is an array, the members of it
     * are processed separately (use this for terms that require multiple params).
     * If the value is a Date, it is converted to the form of "01-Jan-1970".
     * Subqueries (OR, NOT) are made up of objects
     *
     *    {unseen: true, header: ["subject", "hello world"]};
     *    SEARCH UNSEEN HEADER "subject" "hello world"
     *
     * @param {Object} query Search query
     * @param {Object} [options] Option object
     * @param {Boolean} [options.byUid] If ture, use UID SEARCH instead of SEARCH
     * @return {Object} IMAP command object
     */
    BrowserBox.prototype._buildSEARCHCommand = function(query, options) {
        var command = {
            command: options.byUid ? 'UID SEARCH' : 'SEARCH'
        };

        var isAscii = true;

        var buildTerm = function(query) {
            var list = [];

            Object.keys(query).forEach(function(key) {
                var params = [],

                    formatDate = function(date) {
                        return date.toUTCString().replace(/^\w+, 0?(\d+) (\w+) (\d+).*/, "$1-$2-$3");
                    },

                    escapeParam = function(param) {
                        if (typeof param === "number") {
                            return {
                                type: "number",
                                value: param
                            };
                        } else if (typeof param === "string") {
                            if (/[\u0080-\uFFFF]/.test(param)) {
                                isAscii = false;
                                return {
                                    type: "literal",
                                    // cast unicode string to pseudo-binary as imap-handler compiles strings as octets
                                    value: mimefuncs.fromTypedArray(mimefuncs.charset.encode(param))
                                };
                            }
                            return {
                                type: "string",
                                value: param
                            };
                        } else if (Object.prototype.toString.call(param) === "[object Date]") {
                            // RFC 3501 allows for dates to be placed in
                            // double-quotes or left without quotes.  Some
                            // servers (Yandex), do not like the double quotes,
                            // so we treat the date as an atom.
                            return {
                                type: "atom",
                                value: formatDate(param)
                            };
                        } else if (Array.isArray(param)) {
                            return param.map(escapeParam);
                        } else if (typeof param === "object") {
                            return buildTerm(param);
                        }
                    };

                params.push({
                    type: "atom",
                    value: key.toUpperCase()
                });

                [].concat(query[key] || []).forEach(function(param) {
                    switch (key.toLowerCase()) {
                        case 'uid':
                            param = {
                                type: "sequence",
                                value: param
                            };
                            break;
                        default:
                            param = escapeParam(param);
                    }
                    if (param) {
                        params = params.concat(param || []);
                    }
                });
                list = list.concat(params || []);
            });

            return list;
        };

        command.attributes = [].concat(buildTerm(query || {}) || []);

        // If any string input is using 8bit bytes, prepend the optional CHARSET argument
        if (!isAscii) {
            command.attributes.unshift({
                type: "atom",
                value: "UTF-8"
            });
            command.attributes.unshift({
                type: "atom",
                value: "CHARSET"
            });
        }

        return command;
    };

    /**
     * Parses SEARCH response. Gathers all untagged SEARCH responses, fetched seq./uid numbers
     * and compiles these into a sorted array.
     *
     * @param {Object} response
     * @return {Object} Message object
     * @param {Array} Sorted Seq./UID number list
     */
    BrowserBox.prototype._parseSEARCH = function(response) {
        var list = [];

        if (!response || !response.payload || !response.payload.SEARCH || !response.payload.SEARCH.length) {
            return [];
        }

        [].concat(response.payload.SEARCH || []).forEach(function(result) {
            [].concat(result.attributes || []).forEach(function(nr) {
                nr = Number(nr && nr.value || nr || 0) || 0;
                if (list.indexOf(nr) < 0) {
                    list.push(nr);
                }
            });
        }.bind(this));

        list.sort(function(a, b) {
            return a - b;
        });

        return list;
    };

    /**
     * Creates an IMAP STORE command from the selected arguments
     */
    BrowserBox.prototype._buildSTORECommand = function(sequence, flags, options) {
        var command = {
                command: options.byUid ? 'UID STORE' : 'STORE',
                attributes: [{
                    type: 'sequence',
                    value: sequence
                }]
            },
            key = '',
            list = [];

        if (Array.isArray(flags) || typeof flags !== 'object') {
            flags = {
                set: flags
            };
        }

        if (flags.add) {
            list = [].concat(flags.add || []);
            key = '+';
        } else if (flags.set) {
            key = '';
            list = [].concat(flags.set || []);
        } else if (flags.remove) {
            key = '-';
            list = [].concat(flags.remove || []);
        }

        command.attributes.push({
            type: 'atom',
            value: key + 'FLAGS' + (options.silent ? '.SILENT' : '')
        });

        command.attributes.push(list.map(function(flag) {
            return {
                type: 'atom',
                value: flag
            };
        }));

        return command;
    };

    /**
     * Updates the IMAP state value for the current connection
     *
     * @param {Number} newState The state you want to change to
     */
    BrowserBox.prototype._changeState = function(newState) {
        if (newState === this.state) {
            return;
        }

        axe.debug(DEBUG_TAG, this.options.sessionId + ' entering state: ' + this.state);

        // if a mailbox was opened, emit onclosemailbox and clear selectedMailbox value
        if (this.state === this.STATE_SELECTED && this.selectedMailbox) {
            this.onclosemailbox(this.selectedMailbox);
            this.selectedMailbox = false;
        }

        this.state = newState;
    };

    /**
     * Ensures a path exists in the Mailbox tree
     *
     * @param {Object} tree Mailbox tree
     * @param {String} path
     * @param {String} delimiter
     * @return {Object} branch for used path
     */
    BrowserBox.prototype._ensurePath = function(tree, path, delimiter) {
        var names = path.split(delimiter);
        var branch = tree;
        var i, j, found;

        for (i = 0; i < names.length; i++) {
            found = false;
            for (j = 0; j < branch.children.length; j++) {
                if (this._compareMailboxNames(branch.children[j].name, utf7.imap.decode(names[i]))) {
                    branch = branch.children[j];
                    found = true;
                    break;
                }
            }
            if (!found) {
                branch.children.push({
                    name: utf7.imap.decode(names[i]),
                    delimiter: delimiter,
                    path: names.slice(0, i + 1).join(delimiter),
                    children: []
                });
                branch = branch.children[branch.children.length - 1];
            }
        }
        return branch;
    };

    /**
     * Compares two mailbox names. Case insensitive in case of INBOX, otherwise case sensitive
     *
     * @param {String} a Mailbox name
     * @param {String} b Mailbox name
     * @returns {Boolean} True if the folder names match
     */
    BrowserBox.prototype._compareMailboxNames = function(a, b) {
        return (a.toUpperCase() === 'INBOX' ? 'INBOX' : a) === (b.toUpperCase() === 'INBOX' ? 'INBOX' : b);
    };

    /**
     * Checks if a mailbox is for special use
     *
     * @param {Object} mailbox
     * @return {String} Special use flag (if detected)
     */
    BrowserBox.prototype._checkSpecialUse = function(mailbox) {
        var i, type;

        if (mailbox.flags) {
            for (i = 0; i < SPECIAL_USE_FLAGS.length; i++) {
                type = SPECIAL_USE_FLAGS[i];
                if ((mailbox.flags || []).indexOf(type) >= 0) {
                    mailbox.specialUse = type;
                    return type;
                }
            }
        }

        return this._checkSpecialUseByName(mailbox);
    };

    BrowserBox.prototype._checkSpecialUseByName = function(mailbox) {
        var name = (mailbox.name || '').toLowerCase().trim(),
            i, type;

        for (i = 0; i < SPECIAL_USE_BOX_FLAGS.length; i++) {
            type = SPECIAL_USE_BOX_FLAGS[i];
            if (SPECIAL_USE_BOXES[type].indexOf(name) >= 0) {
                mailbox.specialUse = type;
                mailbox.specialUseFlag = type;
                return type;
            }
        }

        return false;
    };

    /**
     * Builds a login token for XOAUTH2 authentication command
     *
     * @param {String} user E-mail address of the user
     * @param {String} token Valid access token for the user
     * @return {String} Base64 formatted login token
     */
    BrowserBox.prototype._buildXOAuth2Token = function(user, token) {
        var authData = [
            'user=' + (user || ''),
            'auth=Bearer ' + token,
            '',
            ''
        ];
        return mimefuncs.base64.encode(authData.join('\x01'));
    };

    /**
     * Wrapper for creating promise aware callback functions
     *
     * @param {Function} resolve Promise.resolve
     * @param {Function} reject promise.reject
     * @returns {Function} Promise wrapped callback
     */
    function callbackPromise(resolve, reject) {
        return function() {
            var args = Array.prototype.slice.call(arguments);
            var err = args.shift();
            if (err) {
                reject(err);
            } else {
                resolve.apply(null, args);
            }
        };
    }

    return BrowserBox;
}));

define('oauth',['require','exports','module','./errorutils','./syncbase','logic','./date'],function(require, exports) {

  var errorutils = require('./errorutils');
  var syncbase = require('./syncbase');
  var logic = require('logic');
  var date = require('./date');

  /**
   * A window in which a renew request can be sent as a last ditch effort to
   * get a valid access_token. This value is consulted when a connection fails
   * due to an expired access_token, but the code did not realize it needed to
   * try for a renew due to problems with an incorrect system clock. Most access
   * tokens only last about an hour. So pick a renew window time that is shorter
   * than that but would only result in one or two tries for a last ditch
   * effort. If the token is really bad or the user really needs to just
   * reauthorize the app, then do not want to keep hammering away at the renew
   * API.
   */
  var RENEW_WINDOW_MS = 30 * 60 * 1000;

  var scope = logic.scope('Oauth');

  /**
   * Decides if a renew may be feasible to do. Does not allow renew within a
   * time window. This kind of renew is only used as a last ditch effort to get
   * oauth to work, where the cached oauth2 data indicates the access token is
   * still good, but it is being fooled by things like an incorrect clock.
   *
   * This can be reset between restarts of the app, since performance.now can
   * be reset or changed. So it is possible it could try for more than
   * RENEW_WINDOW_MS if the app has been closed but restarted within that
   * window.
   */
  exports.isRenewPossible = function(credentials) {
    var oauth2 = credentials.oauth2,
        lastRenew = oauth2 && (oauth2._transientLastRenew || 0),
        now = date.PERFNOW();

    if (!oauth2) {
      return false;
    }

    if (!oauth2 || (lastRenew && (now - lastRenew) < RENEW_WINDOW_MS)) {
      return false;
    } else {
      return true;
    }
  };

  /**
   * Ensure that the credentials given are still valid, and refresh
   * them if not. For an OAUTH account, this may entail obtaining a
   * new access token from the server; for non-OAUTH accounts, this
   * function always succeeds.
   *
   * @param {object} credentials
   *   An object with (at a minimum) 'refreshToken' (and 'accessToken',
   *   if one had already been obtained).
   * @param {Function} [credsUpdatedCallback] a callback to be called if the
   * credentials have been updated via a renew.
   * @param {Boolean} [forceRenew] forces the renewAccessToken step.
   * @return {Promise}
   *   success: {boolean} True if the credentials were modified.
   *   failure: {String} A normalized error string.
   */
  exports.ensureUpdatedCredentials = function(credentials,
                                              credsUpdatedCallback,
                                              forceRenew) {
    if (forceRenew) {
      console.log('ensureUpdatedCredentials: force renewing token');
    }

    let oauth2 = credentials.oauth2;
    let accountId = credentials.username;
    // If this is an OAUTH account, see if we need to refresh the
    // accessToken. If not, just continue on our way.
    if (oauth2 &&
        (!oauth2.accessToken ||
         oauth2.expireTimeMS < date.NOW()) ||
         forceRenew) {
      oauth2._transientLastRenew = date.PERFNOW();
      return updateDBCredentials(accountId).then((data) => {
        if (data) {
          oauth2.accessToken = data.access_token;
          oauth2.expireTimeMS = data.expire_timestamp;

          logic(scope, 'credentials-changed', {
            _accessToken: oauth2.accessToken,
            expireTimeMS: oauth2.expireTimeMS
          });
        } else {
          logic(scope, 'Refresh token failed', { account: accountId });
        }

        if (credsUpdatedCallback) {
          credsUpdatedCallback(credentials);
        }
      });
    } else {
      logic(scope, 'credentials-ok');
      // Not OAUTH; everything is fine.
      return Promise.resolve(false);
    }
  };

  function updateDBCredentials(accountId) {
    return new Promise(function(resolve, reject) {
      let uid = Math.random();

      self.postMessage({
        uid: uid,
        type: 'updateCredentials',
        cmd: 'update',
        args: [accountId]
      });

      self.addEventListener('message', function onworkerresponse(evt) {
        if (evt.data.type !== 'updateCredentials' || evt.data.uid !== uid) {
          return;
        }
        self.removeEventListener(evt.type, onworkerresponse);

        let args = evt.data.args;
        let data = args[0];
        resolve(data);
      });
    });
  }
});

/**
 * imap/client.js: Wraps IMAP connection creation, to avoid redundancy
 * between connection-related setup in imap/account.js and
 * imap/probe.js.
 */
define('imap/client',['require','exports','module','browserbox','browserbox-imap','imap-handler','logic','../syncbase','../errorutils','../oauth'],function(require, exports) {

  var BrowserBox = require('browserbox');
  var ImapClient = require('browserbox-imap');
  var imapHandler = require('imap-handler');
  var logic = require('logic');
  var syncbase = require('../syncbase');
  var errorutils = require('../errorutils');
  var oauth = require('../oauth');

  var setTimeout = window.setTimeout;
  var clearTimeout = window.clearTimeout;

  exports.setTimeoutFunctions = function(setFn, clearFn) {
    setTimeout = setFn;
    clearTimeout = clearFn;
  };

  function noop() {
    // nothing
  }

  var scope = logic.scope('ImapClient');

   /**
   * Open a connection to an IMAP server.
   *
   * @param {object} credentials
   *   keys: username, password, [oauth2]
   * @param {object} connInfo
   *   keys: hostname, port, crypto
   * @param {function(credentials)} credsUpdatedCallback
   *   Callback, called if the credentials have been updated and
   *   should be stored to disk. Not called if the credentials are
   *   already up-to-date.
   * @return {Promise}
   *   resolve => {BrowserBox} conn
   *   reject => {String} normalized String error
   */

  exports.createImapConnection = function(credentials, connInfo,
                                          credsUpdatedCallback) {
    var conn;

    return oauth.ensureUpdatedCredentials(credentials, credsUpdatedCallback)
    .then(function() {
      return new Promise(function(resolve, reject) {
        conn = new BrowserBox(
          connInfo.hostname,
          connInfo.port, {
            auth: {
              user: credentials.username,
              pass: credentials.password,
              xoauth2: credentials.oauth2 ?
                         credentials.oauth2.accessToken : null
            },
            id: {
              vendor: 'KaiOS',
              name: 'GaiaMail',
              version: '0.2'
            },
            useSecureTransport: (connInfo.crypto === 'ssl' ||
                                 connInfo.crypto === true),
            requireTLS: connInfo.crypto === 'starttls',
            // In the case no encryption is explicitly requested (either for
            // testing or because a user regrettably chose to disable it via
            // manual config), we want to avoid opportunistic encryption
            // since in the latter case the user may have done this because
            // the server's certificates are invalid.
            ignoreTLS: connInfo.crypto === 'plain'
          });

        var connectTimeout = setTimeout(function() {
          conn.onerror('unresponsive-server');
          conn.close();
        }, syncbase.CONNECT_TIMEOUT_MS);

        conn.onauth = function() {
          clearTimeout(connectTimeout);
          logic(scope, 'connected', { connInfo: connInfo });
          conn.onauth = conn.onerror = noop;
          resolve(conn);
        };
        conn.onerror = function(err) {
          clearTimeout(connectTimeout);
          // XXX: if error is just expired access token, try to refresh one time
          reject(err);
        };

        conn.connect();
      });
    }).catch(function(errorObject) {
      var errorString = normalizeImapError(conn, errorObject);
      if (conn) {
        conn.close();
      }

      // Could hit an oauth reauth case due to date skews, so give a token
      // review a shot before really bailing.
      if (errorString === 'needs-oauth-reauth' &&
          oauth.isRenewPossible(credentials)) {
        return oauth.ensureUpdatedCredentials(credentials,
                                              credsUpdatedCallback, true)
        .then(function() {
          return exports.createImapConnection(credentials, connInfo,
                                              credsUpdatedCallback);
        });
      } else {
        logic(scope, 'connect-error', {
          error: errorString
        });
        throw errorString;
      }
    });
  };

  //****************************************************************
  // UNFORTUNATE IMAP WORKAROUNDS & SHIMS BEGIN HERE
  //----------------------------------------------------------------

  // ImapClient (from BrowserBox) doesn't pass along any useful error
  // information other than a human-readable string, and even then,
  // not always reliably. When we receive an IMAP protocol error
  // response form the server, all of the data we care about is in the
  // most recent 'NO' or 'BAD' response line. Until we can add
  // improved error handling upstream, cache the most recent error
  // response from the IMAP server so that we can extract detailed
  // error codes when we handle error events from the IMAP library.
  var processResponse = ImapClient.prototype._processResponse;
  ImapClient.prototype._processResponse = function(response) {
    processResponse.apply(this, arguments);

    var cmd = (response && response.command || '').toString()
          .toUpperCase().trim();

    if (['NO', 'BAD'].indexOf(cmd) !== -1) {
      logic(scope, 'protocol-error', {
        humanReadable: response.humanReadable,
        responseCode: response.code,
        // Include the command structure
        commandData: this._currentCommand && this._currentCommand.request &&
                     imapHandler.compiler(this._currentCommand.request)
      });
      this._lastImapError = {
        // To most accurately report STARTTLS issues, latch the active command
        // at the time of the failure rather than just the response.  (An evil
        // attacker could say "NO SUCKER" instead of "NO STARTTLS" or
        // something.)
        command: this._currentCommand,
        response: response
      };
    }
  };

  // ImapClient passes data directly into the `new Error()`
  // constructor, which causes err.message to equal "[Object object]"
  // rather than the actual error object with details. This is just a
  // copy of that function, with the `new Error` constructor stripped
  // out so that the error details pass through to onerror.
   ImapClient.prototype._onError = function(evt) {
    if (this.isError(evt)) {
      this.onerror(evt);
    } else if (evt && this.isError(evt.data)) {
      this.onerror(evt.data);
    } else {
      this.onerror(evt && evt.data && evt.data.message ||
                   evt.data || evt || 'Error');
    }

    this.close();
  };

  /**
   * Given an error possibly generated by the IMAP client, analyze it
   * and convert it to a normalized string if possible. Otherwise,
   * return null.
   */
  function analyzeLastImapError(lastErrInfo, conn) {
    // Make sure it's an error we know how to analyze:
    if (!lastErrInfo || !lastErrInfo.response) {
      return null;
    }

    // If the most recent command was to initiate STARTTLS, then this is a
    // security error.
    if (lastErrInfo.command && lastErrInfo.command.request &&
        lastErrInfo.command.request.command === 'STARTTLS') {
      return 'bad-security';
    }

    var wasOauth = conn && !!conn.options.auth.xoauth2;

    // Structure of an IMAP error response:
    // { "tag":"W2",
    //   "command": "NO",
    //   "code": "AUTHENTICATIONFAILED",
    //   "attributes": [
    //     {"type":"TEXT","value":"invalid password"}
    //   ],
    //   "humanReadable": "invalid password" }

    // Dovecot says after a delay and does not terminate the connection:
    //     NO [AUTHENTICATIONFAILED] Authentication failed.
    // Zimbra 7.2.x says after a delay and DOES terminate the connection:
    //     NO LOGIN failed
    //     * BYE Zimbra IMAP server terminating connection
    // Yahoo says after a delay and does not terminate the connection:
    //     NO [AUTHENTICATIONFAILED] Incorrect username or password.

    var err = lastErrInfo.response;
    var str = (err.code || '') + (err.humanReadable || '');

    if (/Your account is not enabled for IMAP use/.test(str) ||
               /IMAP access is disabled for your domain/.test(str)) {
      return 'imap-disabled';
    } else if (/UNAVAILABLE/.test(str)) {
      return 'server-maintenance';
    // If login failed and LOGINDISABLED was claimed, then it's
    // server-maintenance.  We used to be more aggressive about
    // LOGINDISABLED and would just give up if we saw it, but we had a
    // bad regression, so the balance has tipped here.  Additionally, it
    // makes a lot of sense to only report the error if we actually failed
    // to login!
    } else if (conn.capability.indexOf('LOGINDISABLED') !== -1 &&
               !conn.authenticated) {
      return 'server-maintenance';
    // The invalid-credentials case goes last, because we
    // optimistically assume that any other not-authenticated failure
    // is caused by the user's invalid credentials.
    } else if (/AUTHENTICATIONFAILED/.test(str) ||
               /Invalid credentials/i.test(str) || // Gmail bad access token
               /login failed/i.test(str) ||
               /password/.test(str) ||
               // We can't trust state since it gets updated on close, but
               // authenticated latches to true and stays that way.
               !conn.authenticated) {
      // If we got a protocol-level error but we weren't authenticated
      // yet, it's likely an authentication problem, as authenticating
      // is the first thing we do. Any other socket-level connection
      // problems (including STARTTLS, since we pass that along as an
      // exception) will be surfaced before hitting this conditional.

      if (wasOauth) {
        // Gmail returns "NO [ALERT] Invalid credentials (Failure)" in
        // the case of a failed OAUTH password.
        return 'needs-oauth-reauth';
      } else {
        return 'bad-user-or-pass';
      }
    } else {
      return null;
    }
  }

  /**
   * Here's where the cascades come in: This function accepts an error
   * of potentially unknown origin. Maybe it's an exception; maybe
   * it's an IMAP library error with details; maybe it has no useful
   * details, in which case we can see if the IMAP connection reported
   * any error responses. No matter what, we take an IMAP-related
   * error, analyze it, and convert it to our normalized string error
   * representation.
   *
   * @param {BrowserBox} conn
   *   The IMAP connection; necessary if you expect us to analyze
   *   protocol errors
   * @param {object} err
   *   The exception or error that started all the trouble.
   */
  var normalizeImapError = exports.normalizeImapError = function(conn, err) {
    var socketLevelError = errorutils.analyzeException(err);
    var protocolLevelError =
          conn && analyzeLastImapError(conn.client._lastImapError, conn);

    var reportAs = (socketLevelError ||
                    protocolLevelError ||
                    'unknown');

    logic(scope, 'normalized-error', {
      error: err,
      errorName: err && err.name,
      errorMessage: err && err.message,
      errorStack: err && err.stack,
      socketLevelError: socketLevelError,
      protocolLevelError: protocolLevelError,
      reportAs: reportAs
    });

    return reportAs;
  };

});

define(
  'imap/account',[
    'logic',
    '../a64',
    '../accountmixins',
    '../allback',
    '../errbackoff',
    '../mailslice',
    '../searchfilter',
    '../syncbase',
    '../util',
    '../composite/incoming',
    './folder',
    './jobs',
    './client',
    '../errorutils',
    '../disaster-recovery',
    'module',
    'require',
    'exports'
  ],
  function(
    logic,
    $a64,
    $acctmixins,
    $allback,
    $errbackoff,
    $mailslice,
    $searchfilter,
    $syncbase,
    $util,
    incoming,
    $imapfolder,
    $imapjobs,
    $imapclient,
    errorutils,
    DisasterRecovery,
    $module,
    require,
    exports
  ) {
var bsearchForInsert = $util.bsearchForInsert;
var allbackMaker = $allback.allbackMaker;
var CompositeIncomingAccount = incoming.CompositeIncomingAccount;

function cmpFolderPubPath(a, b) {
  return a.path.localeCompare(b.path);
}

/**
 * Account object, root of all interaction with servers.
 *
 * Passwords are currently held in cleartext with the rest of the data.  Ideally
 * we would like them to be stored in some type of keyring coupled to the TCP
 * API in such a way that we never know the API.  Se a vida e.
 *
 */
function ImapAccount(universe, compositeAccount, accountId, credentials,
                     connInfo, folderInfos,
                     dbConn, existingProtoConn) {

  // Using the generic 'Account' here, as current tests don't
  // distinguish between events on ImapAccount vs. CompositeAccount.
  logic.defineScope(this, 'Account', { accountId: accountId,
                                       accountType: 'imap' });

  CompositeIncomingAccount.apply(
      this, [$imapfolder.ImapFolderSyncer].concat(Array.slice(arguments)));

  /**
   * The maximum number of connections we are allowed to have alive at once.  We
   * want to limit this both because we generally aren't sophisticated enough
   * to need to use many connections at once (unless we have bugs), and because
   * servers may enforce a per-account connection limit which can affect both
   * us and other clients on other devices.
   *
   * Thunderbird's default for this is 5.
   *
   * gmail currently claims to have a limit of 15 connections per account:
   * http://support.google.com/mail/bin/answer.py?hl=en&answer=97150
   *
   * I am picking 3 right now because it should cover the "I just sent a
   * messages from the folder I was in and then switched to another folder",
   * where we could have stuff to do in the old folder, new folder, and sent
   * mail folder.  I have also seem claims of connection limits of 3 for some
   * accounts out there, so this avoids us needing logic to infer a need to
   * lower our connection limit.
   */
  this._maxConnsAllowed = 3;
  /**
   * The `ImapConnection` we are attempting to open, if any.  We only try to
   * open one connection at a time.
   */
  this._pendingConn = null;
  this._ownedConns = [];
  /**
   * @listof[@dict[
   *   @key[folderId]
   *   @key[callback]
   * ]]{
   *   The list of requested connections that have not yet been serviced.  An
   * }
   */
  this._demandedConns = [];
  this._backoffEndpoint = $errbackoff.createEndpoint('imap:' + this.id, this);
  this._connInfo = connInfo;

  if (existingProtoConn)
    this._reuseConnection(existingProtoConn);

  this._jobDriver = new $imapjobs.ImapJobDriver(
                          this, this._folderInfos.$mutationState);

  /**
   * Flag to allow us to avoid calling closeBox to close a folder.  This avoids
   * expunging deleted messages.
   */
  this._TEST_doNotCloseFolder = false;

  // Immediately ensure that we have any required local-only folders,
  // as those can be created even while offline.
  this.ensureEssentialOfflineFolders();
}

exports.Account = exports.ImapAccount = ImapAccount;
ImapAccount.prototype = Object.create(CompositeIncomingAccount.prototype);
var properties = {
  type: 'imap',
  supportsServerFolders: true,
  toString: function() {
    return '[ImapAccount: ' + this.id + ']';
  },

  //////////////////////////////////////////////////////////////////////////////
  // Server type indicators for quirks and heuristics like sent mail

  /**
   * Is this server gmail?  Not something that just looks like gmail, but IS
   * gmail.
   *
   * Gmail self-identifies via the nonstandard but documented X-GM-EXT-1
   * capability.  Documentation is at
   * https://developers.google.com/gmail/imap_extensions
   */
  get isGmail() {
    return this.meta.capability.indexOf('X-GM-EXT-1') !== -1;
  },

  /**
   * Is this a CoreMail server, as used by 126.com/163.com/others?
   *
   * CoreMail servers self-identify via the apparently cargo-culted
   * X-CM-EXT-1 capability.
   */
  get isCoreMailServer() {
    return this.meta.capability.indexOf('X-CM-EXT-1') !== -1;
  },

  /**
   * Is this server OutLook mail?.
   * We get the connInfo.hostname to judge server type.
   */
  get isOutLookServer() {
    return this._connInfo.hostname.indexOf('outlook.com') !== -1;
  },

  /**
   * Do messages sent via the corresponding SMTP account automatically show up
   * in the sent folder?  Both Gmail and CoreMail do this.  (It's a good thing
   * to do, it just sucks that there's no explicit IMAP capability, etc. to
   * indicate this without us having to infer from the server type.  Although
   * we could probe this if we wanted...)
   * OutLook mail also do like this.
   */
  get sentMessagesAutomaticallyAppearInSentFolder() {
    return this.isGmail || this.isCoreMailServer || this.isOutLookServer;
  },

  //////////////////////////////////////////////////////////////////////////////
  // Connection Pool-ish stuff

  get numActiveConns() {
    return this._ownedConns.length;
  },

  /**
   * Mechanism for an `ImapFolderConn` to request an IMAP protocol connection.
   * This is to potentially support some type of (bounded) connection pooling
   * like Thunderbird uses.  The rationale is that many servers cap the number
   * of connections we are allowed to maintain, plus it's hard to justify
   * locally tying up those resources.  (Thunderbird has more need of watching
   * multiple folders than ourselves, but we may still want to synchronize a
   * bunch of folders in parallel for latency reasons.)
   *
   * The provided connection will *not* be in the requested folder; it's up to
   * the folder connection to enter the folder.
   *
   * @args[
   *   @param[folderId #:optional FolderId]{
   *     The folder id of the folder that will be using the connection.  If
   *     it's not a folder but some task, then pass null (and ideally provide
   *     a useful `label`).
   *   }
   *   @param[label #:optional String]{
   *     A human readable explanation of the activity for debugging purposes.
   *   }
   *   @param[callback @func[@args[@param[conn]]]]{
   *     The callback to invoke once the connection has been established.  If
   *     there is a connection present in the reuse pool, this may be invoked
   *     immediately.
   *   }
   *   @param[deathback Function]{
   *     A callback to invoke if the connection dies or we feel compelled to
   *     reclaim it.
   *   }
   *   @param[dieOnConnectFailure #:optional Boolean]{
   *     Should we invoke the deathback for this request if we fail to establish
   *     a connection in a timely manner?  This will be immediately invoked if
   *     we are offline or if we exhaust our retries for establishing
   *     connections with the server.
   *   }
   * ]
   */
  __folderDemandsConnection: function(folderId, label, callback, deathback,
                                      dieOnConnectFailure) {
    // If we are offline, invoke the deathback soon and don't bother trying to
    // get a connection.
    if (dieOnConnectFailure && !this.universe.online) {
      window.setZeroTimeout(deathback);
      return;
    }

    var demand = {
      folderId: folderId,
      label: label,
      callback: callback,
      deathback: deathback,
      dieOnConnectFailure: Boolean(dieOnConnectFailure)
    };
    this._demandedConns.push(demand);

    // No line-cutting; bail if there was someone ahead of us.
    if (this._demandedConns.length > 1)
      return;

    // - try and reuse an existing connection
    if (this._allocateExistingConnection())
      return;

    // - we need to wait for a new conn or one to free up
    this._makeConnectionIfPossible();

    return;
  },

  /**
   * Trigger the deathbacks for all connection demands where dieOnConnectFailure
   * is true.
   */
  _killDieOnConnectFailureDemands: function() {
    for (var i = 0; i < this._demandedConns.length; i++) {
      var demand = this._demandedConns[i];
      if (demand.dieOnConnectFailure) {
        demand.deathback.call(null);
        this._demandedConns.splice(i--, 1);
      }
    }
  },

  /**
   * Try and find an available connection and assign it to the first connection
   * demand.
   *
   * @return[Boolean]{
   *   True if we allocated a demand to a conncetion, false if we did not.
   * }
   */
  _allocateExistingConnection: function() {
    if (!this._demandedConns.length)
      return false;
    var demandInfo = this._demandedConns[0];

    var reusableConnInfo = null;
    for (var i = 0; i < this._ownedConns.length; i++) {
      var connInfo = this._ownedConns[i];
      // It's concerning if the folder already has a connection...
      if (demandInfo.folderId && connInfo.folderId === demandInfo.folderId)
        logic(this, 'folderAlreadyHasConn', { folderId: demandInfo.folderId });

      if (connInfo.inUseBy)
        continue;

      connInfo.inUseBy = demandInfo;
      this._demandedConns.shift();
      logic(this, 'reuseConnection',
            { folderId: demandInfo.folderId, label: demandInfo.label });
      demandInfo.callback(connInfo.conn);
      return true;
    }

    return false;
  },

  /**
   * All our operations completed; let's think about closing any connections
   * they may have established that we don't need anymore.
   */
  allOperationsCompleted: function() {
    this.maybeCloseUnusedConnections();
  },

  /**
   * Using great wisdom, potentially close some/all connections.
   */
  maybeCloseUnusedConnections: function() {
    // XXX: We are closing unused connections in an effort to stem
    // problems associated with unreliable cell connections; they
    // tend to be dropped unceremoniously when left idle for a
    // long time, particularly on cell networks. NB: This will
    // close the connection we just used, unless someone else is
    // waiting for a connection.
    if ($syncbase.KILL_CONNECTIONS_WHEN_JOBLESS &&
        !this._demandedConns.length &&
        !this.universe.areServerJobsWaiting(this)) {
      this.closeUnusedConnections();
    }
  },

  /**
   * Close all connections that aren't currently in use.
   */
  closeUnusedConnections: function() {
    for (var i = this._ownedConns.length - 1; i >= 0; i--) {
      var connInfo = this._ownedConns[i];
      if (connInfo.inUseBy)
        continue;
      console.log('Killing unused IMAP connection.');
      // this eats all future notifications, so we need to splice...
      this._ownedConns.splice(i, 1);
      connInfo.conn.client.close();
      logic(this, 'deadConnection', { reason: 'unused' });
    }
  },

  _makeConnectionIfPossible: function() {
    if (this._ownedConns.length >= this._maxConnsAllowed) {
      logic(this, 'maximumConnsNoNew');
      return;
    }
    if (this._pendingConn) {
      return;
    }

    this._pendingConn = true;
    var boundMakeConnection = this._makeConnection.bind(this);
    this._backoffEndpoint.scheduleConnectAttempt(boundMakeConnection);
  },

  _makeConnection: function(callback, whyFolderId, whyLabel) {
    // Mark a pending connection synchronously; the require call will not return
    // until at least the next turn of the event loop.
    this._pendingConn = true;
    // Dynamically load the probe/imap code to speed up startup.
    require(['./client'], function ($imapclient) {
      logic(this, 'createConnection', {
        folderId: whyFolderId,
        label: whyLabel
      });

      $imapclient.createImapConnection(
        this._credentials,
        this._connInfo,
        function onCredentialsUpdated() {
          return new Promise(function(resolve) {
            // Note: Since we update the credentials object in-place,
            // there's no need to explicitly assign the changes here;
            // just save the account information.
            this.universe.saveAccountDef(
              this.compositeAccount.accountDef,
              /* folderInfo: */ null,
              /* callback: */ resolve);
          }.bind(this));
        }.bind(this)
      ).then(function(conn) {
          DisasterRecovery.associateSocketWithAccount(conn.client.socket, this);

          this._pendingConn = null;
          this._bindConnectionDeathHandlers(conn);
          this._backoffEndpoint.noteConnectSuccess();
          this._ownedConns.push({
            conn: conn,
            inUseBy: null
          });
          this._allocateExistingConnection();

          // If more connections are needed, keep connecting.
          if (this._demandedConns.length) {
            this._makeConnectionIfPossible();
          }

          callback && callback(null);
        }.bind(this))
      .catch(function(err) {
          logic(this, 'deadConnection', {
            reason: 'connect-error',
            folderId: whyFolderId
          });

          if (errorutils.shouldReportProblem(err)) {
            this.universe.__reportAccountProblem(
              this.compositeAccount,
              err,
              'incoming');
          }

          this._pendingConn = null;
          callback && callback(err);

          // Track this failure for backoff purposes.
          if (errorutils.shouldRetry(err)) {
            if (this._backoffEndpoint.noteConnectFailureMaybeRetry(
              errorutils.wasErrorFromReachableState(err))) {
              this._makeConnectionIfPossible();
            } else {
              this._killDieOnConnectFailureDemands();
            }
          } else {
            this._backoffEndpoint.noteBrokenConnection();
            this._killDieOnConnectFailureDemands();
          }
        }.bind(this));
    }.bind(this));
  },

  /**
   * Treat a connection that came from the IMAP prober as a connection we
   * created ourselves.
   */
  _reuseConnection: function(existingProtoConn) {
    DisasterRecovery.associateSocketWithAccount(
      existingProtoConn.client.socket, this);
    this._ownedConns.push({
      conn: existingProtoConn,
      inUseBy: null
    });
    this._bindConnectionDeathHandlers(existingProtoConn);
  },

  _bindConnectionDeathHandlers: function(conn) {

    conn.breakIdle(function() {
      conn.client.TIMEOUT_ENTER_IDLE = $syncbase.STALE_CONNECTION_TIMEOUT_MS;
      conn.client.onidle = function() {
        console.warn('Killing stale IMAP connection.');
        conn.client.close();
      };

      // Reenter the IDLE state here so that we properly time out if
      // we never send any further requests (which would normally
      // cause _enterIdle to be called when the request queue has been
      // emptied).
      conn.client._enterIdle();
    });

    conn.onclose = function() {
       for (var i = 0; i < this._ownedConns.length; i++) {
        var connInfo = this._ownedConns[i];
        if (connInfo.conn === conn) {
          logic(this, 'deadConnection', {
            reason: 'closed',
            folderId: connInfo.inUseBy &&
              connInfo.inUseBy.folderId
          });
          if (connInfo.inUseBy && connInfo.inUseBy.deathback)
            connInfo.inUseBy.deathback(conn);
          connInfo.inUseBy = null;
          this._ownedConns.splice(i, 1);
          return;
        }
      }
    }.bind(this);

    conn.onerror = function(err) {
      err = $imapclient.normalizeImapError(conn, err);
      logic(this, 'connectionError', { error: err });
      console.error('imap:onerror', JSON.stringify({
        error: err,
        host: this._connInfo.hostname,
        port: this._connInfo.port
      }));
    }.bind(this);
  },

  __folderDoneWithConnection: function(conn, closeFolder, resourceProblem) {
    for (var i = 0; i < this._ownedConns.length; i++) {
      var connInfo = this._ownedConns[i];
      if (connInfo.conn === conn) {
        if (resourceProblem)
          this._backoffEndpoint(connInfo.inUseBy.folderId);
        logic(this, 'releaseConnection', {
          folderId: connInfo.inUseBy.folderId,
          label: connInfo.inUseBy.label
        });
        connInfo.inUseBy = null;

         // We just freed up a connection, it may be appropriate to close it.
        this.maybeCloseUnusedConnections();
        return;
      }
    }
    logic(this, 'connectionMismatch');
  },

  //////////////////////////////////////////////////////////////////////////////
  // Folder synchronization

  /**
   * Helper in conjunction with `_syncFolderComputeDeltas` for use by the
   * syncFolderList operation/job.  The op is on the hook for the connection's
   * lifecycle.
   */
  _syncFolderList: function(conn, callback) {
    conn.listMailboxes(
      this._syncFolderComputeDeltas.bind(this, conn, callback));
  },

  _determineFolderType: function(box, path) {
    var attribs = (box.flags || []).map(function(flag) {
      return flag.substr(1).toUpperCase(); // Map "\\Noselect" => "NOSELECT"
    });

    var type = null;
    // NoSelect trumps everything.
    if (attribs.indexOf('NOSELECT') !== -1) {
      type = 'nomail';
    }
    else {
      // Standards-ish:
      // - special-use: http://tools.ietf.org/html/rfc6154
      //   IANA registrations:
      //   http://www.iana.org/assignments/imap4-list-extended
      // - xlist:
      //   https://developers.google.com/google-apps/gmail/imap_extensions

      // Process the attribs for goodness.
      for (var i = 0; i < attribs.length; i++) {
        switch (attribs[i]) {
          // TODO: split the 'all' cases into their own type!
          case 'ALL': // special-use
          case 'ALLMAIL': // xlist
          case 'ARCHIVE': // special-use
            type = 'archive';
            break;
          case 'DRAFTS': // special-use xlist
            type = 'drafts';
            break;
          case 'FLAGGED': // special-use
            type = 'starred';
            break;
          case 'IMPORTANT': // (undocumented) xlist
            type = 'important';
            break;
          case 'INBOX': // xlist
            type = 'inbox';
            break;
          case 'JUNK': // special-use
            type = 'junk';
            break;
          case 'SENT': // special-use xlist
            type = 'sent';
            break;
          case 'SPAM': // xlist
            type = 'junk';
            break;
          case 'STARRED': // xlist
            type = 'starred';
            break;

          case 'TRASH': // special-use xlist
            type = 'trash';
            break;

          case 'HASCHILDREN': // 3348
          case 'HASNOCHILDREN': // 3348

          // - standard bits we don't care about
          case 'MARKED': // 3501
          case 'UNMARKED': // 3501
          case 'NOINFERIORS': // 3501
            // XXX use noinferiors to prohibit folder creation under it.
          // NOSELECT

          default:
        }
      }

      // heuristic based type assignment based on the name
      if (!type) {
        // ensure that we treat folders at the root, see bug 854128
        var prefix = this._namespaces.personal[0] &&
              this._namespaces.personal[0].prefix;
        var isAtNamespaceRoot = path === (prefix + box.name);
        // If our name is our path, we are at the absolute root of the tree.
        // This will be the case for INBOX even if there is a namespace.
        if (isAtNamespaceRoot || path === box.name) {
          switch (box.name.toUpperCase()) {
            case 'DRAFT':
            case 'DRAFTS':
              type = 'drafts';
              break;
            case 'INBOX':
              // Inbox is special; the path needs to case-insensitively match.
              if (path.toUpperCase() === 'INBOX')
                type = 'inbox';
              break;
            // Yahoo provides "Bulk Mail" for yahoo.fr.
            case 'BULK MAIL':
            case 'JUNK':
            case 'SPAM':
              type = 'junk';
              break;
            case 'SENT':
              type = 'sent';
              break;
            case 'TRASH':
              type = 'trash';
              break;
            // This currently only exists for consistency with Thunderbird, but
            // may become useful in the future when we need an outbox.
            case 'UNSENT MESSAGES':
              type = 'queue';
              break;
          }
        }
      }

      if (!type)
        type = 'normal';
    }
    return type;
  },

  /**
   * A map of namespaces: { personal: { prefix: '', delimiter: '' }, ... }.
   * Populated in _syncFolderComputeDeltas.
   */
  _namespaces: {
    personal: { prefix: '', delimiter: '/' },
    provisional: true
  },

  _syncFolderComputeDeltas: function(conn, callback, err, boxesRoot) {
    var self = this;
    if (err) {
      callback(err);
      return;
    }

    // Before we walk the boxes, get namespace information.
    // In the failure case, assume no relevant namespaces.
    if (self._namespaces.provisional) {
      conn.listNamespaces(function(err, namespaces) {
        if (!err && namespaces) {
          self._namespaces = namespaces;
        }

        self._namespaces.provisional = false;

        logic(self, 'list-namespaces', {
          namespaces: namespaces
        });

        self._syncFolderComputeDeltas(conn, callback, err, boxesRoot);
      });
      return;
    }

    // - build a map of known existing folders
    var folderPubsByPath = {};
    var folderPub;
    for (var iFolder = 0; iFolder < this.folders.length; iFolder++) {
      folderPub = this.folders[iFolder];
      folderPubsByPath[folderPub.path] = folderPub;
    }

    var syncScope = logic.scope('ImapFolderSync');

    // - walk the boxes
    function walkBoxes(boxLevel, pathDepth, parentId) {
      boxLevel.forEach(function(box) {
        var boxName = box.name, meta,
            folderId;

        if (!box.path) {
          return;
        }
        var delim = box.delimiter || '/';

         if (box.path.indexOf(delim) === 0) {
          box.path = box.path.slice(delim.length);
        }

        var path = box.path;

        // - normalize jerk-moves
        var type = self._determineFolderType(box, path);

        // gmail finds it amusing to give us the localized name/path of its
        // inbox, but still expects us to ask for it as INBOX.
        if (type === 'inbox')
          path = 'INBOX';

        // - already known folder
        if (folderPubsByPath.hasOwnProperty(path)) {
          // Because we speculatively create the Inbox, both its display name
          // and delimiter may be incorrect and need to be updated.
          meta = folderPubsByPath[path];
          meta.name = box.name;
          meta.delim = delim;

          logic(syncScope, 'folder-sync:existing', {
            type: type,
            name: box.name,
            path: path,
            delim: delim
          });

          // mark it with true to show that we've seen it.
          folderPubsByPath[path] = true;
        }
        // - new to us!
        else {
          logic(syncScope, 'folder-sync:add', {
            type: type,
            name: box.name,
            path: path,
            delim: delim
          });
          meta = self._learnAboutFolder(box.name, path, parentId, type,
                                        delim, pathDepth);
        }

        if (box.children)
          walkBoxes(box.children, pathDepth + 1, meta.id);
      });
    }

    walkBoxes(boxesRoot.children, 0, null);

    // - detect deleted folders
    // track dead folder id's so we can issue a
    var deadFolderIds = [];
    for (var folderPath in folderPubsByPath) {
      folderPub = folderPubsByPath[folderPath];
      // (skip those we found above)
      if (folderPub === true)
        continue;
      // Never delete our localdrafts or outbox folder.
      if ($mailslice.FolderStorage.isTypeLocalOnly(folderPub.type))
        continue;
      logic(syncScope, 'delete-dead-folder', {
        folderType: folderPub.type,
        folderId: folderPub.id
      });
      // It must have gotten deleted!
      this._forgetFolder(folderPub.id);
    }

    // Once we've synchonized the folder list, kick off another job to
    // check that we have all essential online folders. Once that
    // completes, we'll check to make sure our offline-only folders
    // (localdrafts, outbox) are in the right place according to where
    // this server stores other built-in folders.
    this.ensureEssentialOnlineFolders();
    this.normalizeFolderHierarchy();

    callback(null);
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
    [ 'outbox', 'localdrafts' ].forEach(function(folderType) {
      if (!this.getFirstFolderWithType(folderType)) {
        this._learnAboutFolder(
          /* name: */ folderType,
          /* path: */ folderType,
          /* parentId: */ null,
          /* type: */ folderType,
          /* delim: */ '',
          /* depth: */ 0,
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
    var essentialFolders = { 'trash': 'Trash', 'sent': 'Sent' };
    var latch = $allback.latch();

    for (var type in essentialFolders) {
      if (!this.getFirstFolderWithType(type)) {
        this.universe.createFolder(
          this.id, null, essentialFolders[type], type, false, latch.defer());
      }
    }

    latch.then(callback);
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

  /**
   * Asynchronously save the sent message to the sent folder, if applicable.
   * This should only be called once the SMTP send has completed.
   *
   * If non-gmail, append a bcc-including version of the message into the sent
   * folder.  For gmail, the SMTP server automatically copies the message into
   * the sent folder so we don't need to do this.
   *
   * There are several notable limitations with the current implementation:
   * - We do not write a copy of the message into the sent folder locally, so
   *   the message must be downloaded/synchronized for the user to see it.
   * - The operation to append the message does not get persisted to disk, so
   *   in the event the app crashes or is closed, a copy of the message will
   *   not end up in the sent folder.  This has always been the emergent
   *   phenomenon for IMAP, except previously we would persist the operation
   *   and then mark it moot at 'check' time.  Our new technique of not saving
   *   the operation is preferable for disk space reasons.  (NB: We could
   *   persist it, but the composite Blob we build would be flattened which
   *   could generate an I/O storm, cause temporary double-storage use, etc.)
   */
  saveSentMessage: function(composer) {
    if (this.sentMessagesAutomaticallyAppearInSentFolder) {
      return;
    }

    composer.withMessageBlob({ includeBcc: true }, function(blob) {
      var message = {
        messageText: blob,
        // do not specify date; let the server use its own timestamping
        // since we want the approximate value of 'now' anyways.
        flags: ['\\Seen'],
      };

      var sentFolder = this.getFirstFolderWithType('sent');
      if (sentFolder) {
        this.universe.appendMessages(sentFolder.id,
                                     [message]);
      }
    }.bind(this));
  },

  shutdown: function(callback) {
    CompositeIncomingAccount.prototype.shutdownFolders.call(this);

    this._backoffEndpoint.shutdown();

    // - close all connections
    var liveConns = this._ownedConns.length;
    function connDead() {
      if (--liveConns === 0)
        callback();
    }
    for (var i = 0; i < this._ownedConns.length; i++) {
      var connInfo = this._ownedConns[i];
      if (callback) {
        connInfo.inUseBy = { deathback: connDead };
        try {
          connInfo.conn.client.close();
        }
        catch (ex) {
          liveConns--;
        }
      }
      else {
        connInfo.conn.client.close();
      }
    }

    if (!liveConns && callback)
      callback();
  },

  checkAccount: function(listener) {
    logic(this, 'checkAccount_begin');
    this._makeConnection(function(err) {
      logic(this, 'checkAccount_end', { error: err });
      listener(err);
    }.bind(this), null, 'check');
  },

  accountDeleted: function() {
    this._alive = false;
    this.shutdown();
  },


  //////////////////////////////////////////////////////////////////////////////

};

// XXX: Use mix.js when it lands in the streaming patch.
for (var k in properties) {
  Object.defineProperty(ImapAccount.prototype, k,
                        Object.getOwnPropertyDescriptor(properties, k));
}

}); // end define
;
define('md5',['require','exports','module'],function(require, exports, module) {

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

define('pop3/transport',['mimefuncs', 'exports'], function(mimefuncs, exports) {

  /**
   * This file contains the following classes:
   *
   * - Pop3Parser: Parses incoming POP3 requests
   * - Pop3Protocol: Uses the Pop3Parser to match requests up with responses
   * - Request: Encapsulates a request to the server
   * - Response: Encapsulates a response from the server
   *
   * The Pop3Client (in pop3.js) hooks together a socket and an
   * instance of Pop3Protocol to form a complete client. See pop3.js
   * for a more detailed description of the hierarchy.
   */

  var setTimeout = window.setTimeout.bind(window);
  var clearTimeout = window.clearTimeout.bind(window);

  var MAX_LINE_LENGTH = 512; // per POP3 spec, including CRLF
  var CR = '\r'.charCodeAt(0);
  var LF = '\n'.charCodeAt(0);
  var PERIOD = '.'.charCodeAt(0);
  var PLUS = '+'.charCodeAt(0);
  var MINUS = '-'.charCodeAt(0);
  var SPACE = ' '.charCodeAt(0);

  var textEncoder = new TextEncoder('utf-8', { fatal: false });

  function concatBuffers(a, b) {
    var buffer = new Uint8Array(a.length + b.length);
    buffer.set(a, 0);
    buffer.set(b, a.length);
    return buffer;
  }

  /**
   * Pop3Parser receives binary data (presumably from a socket) and
   * parse it according to the POP3 spec:
   *
   *   var parser = new Pop3Parser();
   *   parser.push(myBinaryData);
   *   var rsp = parser.extractResponse(false);
   *   if (rsp) {
   *     // do something with the response
   *   }
   */
  function Pop3Parser() {
    this.buffer = new Uint8Array(0); // data not yet parsed into lines
    this.unprocessedLines = [];
  }

  /**
   * Add new data to be parsed. To actually parse the incoming data
   * (to see if there is enough data to extract a full response), call
   * `.extractResponse()`.
   *
   * @param {Uint8Array} data
   */
  Pop3Parser.prototype.push = function(data) {
    // append the data to be processed
    var buffer = this.buffer = concatBuffers(this.buffer, data);

    // pull out full lines
    for (var i = 0; i < buffer.length - 1; i++) {
      if (buffer[i] === CR && buffer[i + 1] === LF) {
        var end = i + 1;
        if (end > MAX_LINE_LENGTH) {
          // Sadly, servers do this, so we can't bail here.
        }
        this.unprocessedLines.push(buffer.subarray(0, end + 1));
        buffer = this.buffer = buffer.subarray(end + 1);
        i = -1;
      }
    }
  }

  /**
   * Attempt to parse and return a single message from the buffered
   * data. Since the POP3 protocol does not provide a foolproof way to
   * determine whether a given message is multiline without tracking
   * request state, you must specify whether or not the response is
   * expected to be multiline.
   *
   * Multiple responses may be available; you should call
   * `.extractResponse()` repeatedly until no more responses are
   * available. This method returns null if there was not enough data
   * to parse and return a response.
   *
   * @param {boolean} multiline true to parse a multiline response.
   * @return {Response|null}
   */
  Pop3Parser.prototype.extractResponse = function(multiline) {
    if (!this.unprocessedLines.length) {
      return null;
    }
    if (this.unprocessedLines[0][0] !== PLUS) {
      multiline = false; // Negative responses are never multiline.
    }
    if (!multiline) {
      return new Response([this.unprocessedLines.shift()], false);
    } else {
      var endLineIndex = -1;
      for (var i = 1; i < this.unprocessedLines.length; i++) {
        var line = this.unprocessedLines[i];
        if (line.byteLength === 3 &&
            line[0] === PERIOD && line[1] === CR && line[2] === LF) {
          endLineIndex = i;
          break;
        }
      }
      if (endLineIndex === -1) {
        return null;
      }
      var lines = this.unprocessedLines.splice(0, endLineIndex + 1);
      lines.pop(); // remove final ".\r\n" line
      // the first line cannot be stuffed (it's the command OK/ERR
      // response). Other lines may be period-stuffed.
      for (var i = 1; i < endLineIndex; i++) {
        if (lines[i][0] === PERIOD) {
          lines[i] = lines[i].subarray(1);
        }
      }
      return new Response(lines, true);
    }
  }

  /**
   * Represent a POP3 response (both success and failure). You should
   * not have to instantiate this class directly; Pop3Parser returns
   * these objects from `Pop3Parser.extractResponse()`.
   *
   * @param {UInt8Array[]} lines
   * @param {boolean} isMultiline
   */
  function Response(lines, isMultiline) {
    this.lines = lines; // list of UInt8Arrays
    this.isMultiline = isMultiline;
    this.ok = (this.lines[0][0] === PLUS);
    this.err = !this.ok;
    this.request = null;
  }

  /**
   * Return the description text for the status line as a string.
   */
  Response.prototype.getStatusLine = function() {
    return this.getLineAsString(0).replace(/^(\+OK|-ERR) /, '');
  }

  /**
   * Return the line at `index` as a string.
   *
   * @param {int} index
   * @return {String}
   */
  Response.prototype.getLineAsString = function(index) {
    return mimefuncs.fromTypedArray(this.lines[index]);
  }

  /**
   * Return an array of strings, one for each line, including CRLFs.
   * If you want to parse the data from a response, use
   * `.getDataLines()`.
   *
   * @return {String[]}
   */
  Response.prototype.getLinesAsString = function() {
    var lines = [];
    for (var i = 0; i < this.lines.length; i++) {
      lines.push(this.getLineAsString(i));
    }
    return lines;
  }

  /**
   * Return an array of strings, _excluding_ CRLFs, starting from the
   * line after the +OK/-ERR line.
   */
  Response.prototype.getDataLines = function() {
    var lines = [];
    for (var i = 1; i < this.lines.length; i++) {
      var line = this.getLineAsString(i);
      lines.push(line.slice(0, line.length - 2)); // strip CRLF
    }
    return lines;
  }

  /**
   * Return the data portion of a multiline response as a string,
   * with the lines' CRLFs intact.
   */
  Response.prototype.getDataAsString = function() {
    var lines = [];
    for (var i = 1; i < this.lines.length; i++) {
      lines.push(this.getLineAsString(i));
    }
    return lines.join(''); // lines already have '\r\n'
  }

  /**
   * Return a string representation of the message, primarily for
   * debugging purposes.
   */
  Response.prototype.toString = function() {
    return this.getLinesAsString().join('\r\n');
  }

  /**
   * Represent a POP3 request, with enough data to allow the parser
   * to parse out a response and invoke a callback upon receiving a
   * response.
   *
   * @param {string} command The command, like RETR, USER, etc.
   * @param {string[]} args Arguments to the command, as an array.
   * @param {boolean} expectMultiline Whether or not the response will
   *                                  be multiline.
   * @param {function(err, rsp)} cb The callback to invoke when a
   *                                response is received.
   */
  function Request(command, args, expectMultiline, cb) {
    this.command = command;
    this.args = args;
    this.expectMultiline = expectMultiline;
    this.onresponse = cb || null;
  }

  exports.Request = Request;

  /**
   * Encode the request into a byte array suitable for transport over
   * a socket.
   */
  Request.prototype.toByteArray = function() {
    return textEncoder.encode(
      this.command + (this.args.length ? ' ' + this.args.join(' ') : '') + '\r\n');
  }

  /**
   * Trigger the response callback with '-ERR desc\r\n'.
   */
  Request.prototype._respondWithError = function(desc) {
    var rsp = new Response([textEncoder.encode(
      '-ERR ' + desc + '\r\n')], false);
    rsp.request = this;
    this.onresponse(rsp, null);
  }

  /**
   * Couple a POP3 parser with a request/response model, such that
   * you can easily hook Pop3Protocol up to a socket (or other
   * transport) to get proper request/response semantics.
   *
   * You must attach a handler to `.onsend`, which should fire data
   * across the wire. Similarly, you should call `.onreceive(data)` to
   * pass data back in from the socket.
   */
  function Pop3Protocol() {
    this.parser = new Pop3Parser();
    this.onsend = function(data) {
      throw new Error("You must implement Pop3Protocol.onsend to send data.");
    };
    this.unsentRequests = []; // if not pipelining, queue requests one at a time
    this.pipeline = false;
    this.pendingRequests = [];
    this.closed = false;
  }

  exports.Response = Response;
  exports.Pop3Protocol = Pop3Protocol;

  /**
   * Send a request to the server. Upon receiving a response, the
   * callback will be invoked, node-style, with an err or a response.
   * Negative replies (-ERR) are returned as an error to the callback;
   * positive replies (+OK) as a response. Socket errors are returned
   * as an error to the callback.
   *
   * @param {string} cmd The command like USER, RETR, etc.
   * @param {string[]} args An array of arguments to the command.
   * @param {boolean} expectMultiline Whether or not the response will
   *                                  be multiline.
   * @param {function(err, rsp)} cb The callback to invoke upon
   *                                receipt of a response.
   */
  Pop3Protocol.prototype.sendRequest = function(
    cmd, args, expectMultiline, cb) {
    var req;
    if (cmd instanceof Request) {
      req = cmd;
    } else {
      req = new Request(cmd, args, expectMultiline, cb);
    }

    if (this.closed) {
      req._respondWithError('(request sent after connection closed)');
      return;
    }

    if (this.pipeline || this.pendingRequests.length === 0) {
      this.onsend(req.toByteArray());
      this.pendingRequests.push(req);
    } else {
      this.unsentRequests.push(req);
    }
  }

  /**
   * Call this function to send received data to the parser. This
   * method automatically calls the appropriate response callback for
   * its respective request.
   */
  Pop3Protocol.prototype.onreceive = function(evt) {
    this.parser.push(new Uint8Array(evt.data));

    var response;
    while (true) {
      var req = this.pendingRequests[0];
      response = this.parser.extractResponse(req && req.expectMultiline);

      if (!response) {
        break;
      } else if (!req) {
        // It's unclear how to handle this in the most nondestructive way;
        // if we receive an unsolicited response, something has gone horribly
        // wrong, and it's unlikely that we'll be able to recover.
        console.error('Unsolicited response from server: ' + response);
        break;
      }
      response.request = req;
      this.pendingRequests.shift();
      if (this.unsentRequests.length) {
        this.sendRequest(this.unsentRequests.shift());
      }
      if (req.onresponse) {
        if (response.err) {
          req.onresponse(response, null);
        } else {
          req.onresponse(null, response);
        }
      }
    }
  }

  /**
   * Call this function when the socket attached to this protocol is
   * closed. Any current requests that have been enqueued but not yet
   * responded to will be sent a dummy "-ERR" response, indicating
   * that the underlying connection closed without actually
   * responding. This avoids the case where we hang if we never
   * receive a response from the server.
   */
  Pop3Protocol.prototype.onclose = function() {
    this.closed = true;
    var requestsToRespond = this.pendingRequests.concat(this.unsentRequests);
    this.pendingRequests = [];
    this.unsentRequests = [];
    for (var i = 0; i < requestsToRespond.length; i++) {
      var req = requestsToRespond[i];
      req._respondWithError('(connection closed, no response)');
    }
  }
});

/**
 *
 **/

define(
  'imap/imapchew',[
    'mimefuncs',
    '../db/mail_rep',
    '../mailchew',
    'mimeparser',
    'exports'
  ],
  function(
    mimefuncs,
    mailRep,
    $mailchew,
    MimeParser,
    exports
  ) {

function parseRfc2231CharsetEncoding(s) {
  // charset'lang'url-encoded-ish
  var match = /^([^']*)'([^']*)'(.+)$/.exec(s);
  if (match) {
    // we can convert the dumb encoding into quoted printable.
    return mimefuncs.mimeWordsDecode(
      '=?' + (match[1] || 'us-ascii') + '?Q?' +
        match[3].replace(/%/g, '=') + '?=');
  }
  return null;
}


// Given an array or string, strip any surrounding angle brackets.
function stripArrows(s) {
  if (Array.isArray(s)) {
    return s.map(stripArrows);
  } else if (s && s[0] === '<') {
    return s.slice(1, -1);
  } else {
    return s;
  }
}

function firstHeader(msg, headerName) {
  return msg.headers[headerName] && msg.headers[headerName][0] || null;
}

/**
 * Process the headers and bodystructure of a message to build preliminary state
 * and determine what body parts to fetch.  The list of body parts will be used
 * to issue another fetch request, and those results will be passed to
 * `chewBodyParts`.
 *
 * For now, our stop-gap heuristics for content bodies are:
 * - pick text/plain in multipart/alternative
 * - recurse into other multipart types looking for an alterntive that has
 *    text.
 * - do not recurse into message/rfc822
 * - ignore/fail-out messages that lack a text part, skipping to the next
 *    task.  (This should not happen once we support HTML, as there are cases
 *    where there are attachments without any body part.)
 * - Append text body parts together; there is no benefit in separating a
 *    mailing list footer from its content.
 *
 * For attachments, our heuristics are:
 * - only like them if they have filenames.  We will find this as "name" on
 *    the "content-type" or "filename" on the "content-disposition", quite
 *    possibly on both even.
 * - ignore crypto signatures, even though they are named.  S/MIME gives us
 *    "smime.p7s" as an application/pkcs7-signature under a multipart/signed
 *    (that the server tells us is "signed").  PGP in MIME mode gives us
 *    application/pgp-signature "signature.asc" under a multipart/signed.
 *
 * The next step in the plan is to get an HTML sanitizer exposed so we can
 *  support text/html.  That will also imply grabbing multipart/related
 *  attachments.
 *
 * @typedef[ChewRep @dict[
 *   @key[bodyReps @listof[ImapJsPart]]
 *   @key[attachments @listof[AttachmentInfo]]
 *   @key[relatedParts @listof[RelatedPartInfo]]
 * ]]
 * @return[ChewRep]
 */
function chewStructure(msg) {
  var attachments = [], bodyReps = [], unnamedPartCounter = 0,
      relatedParts = [];

  /**
   * Sizes are the size of the encoded string, not the decoded value.
   */
  function estimatePartSizeInBytes(partInfo) {
    var encoding = partInfo.encoding.toLowerCase();
    // Base64 encodes 3 bytes in 4 characters with padding that always
    // causes the encoding to take 4 characters.  The max encoded line length
    // (ignoring CRLF) is 76 bytes, with 72 bytes also fairly common.
    // As such, a 78=19*4+2 character line encodes 57=19*3 payload bytes and
    // we can use that as a rough estimate.
    if (encoding === 'base64') {
      return Math.floor(partInfo.size * 57 / 78);
    }
    // Quoted printable is hard to predict since only certain things need
    // to be encoded.  It could be perfectly efficient if the source text
    // has a bunch of newlines built-in.
    else if (encoding === 'quoted-printable') {
      // Let's just provide an upper-bound of perfectly efficient.
      return partInfo.size;
    }
    // No clue; upper bound.
    return partInfo.size;
  }

  function chewNode(partInfo, parentMultipartSubtype) {
    var i, filename, disposition;
    var type = partInfo.type.split('/')[0];
    var subtype = partInfo.type.split('/')[1];

    if (type === 'multipart') {
      switch (subtype) {
        // For alternative, scan from the back to find the first part we like.
        // XXX I believe in Thunderbird we observed some ridiculous misuse of
        // alternative that we'll probably want to handle.
      case 'alternative':
        for (i = partInfo.childNodes.length - 1; i >= 0; i--) {
          var subPartInfo = partInfo.childNodes[i];
          var childType = subPartInfo.type.split('/')[0];
          var childSubtype = subPartInfo.type.split('/')[1];

          switch(childType) {
          case 'text':
            // fall out for subtype checking
            break;
          case 'multipart':
            // this is probably HTML with attachments, let's give it a try
            if (chewNode(subPartInfo)) {
              return true;
            }
            break;
          default:
            // no good, keep going
            continue;
          }

          switch (childSubtype) {
          case 'html':
          case 'plain':
            // (returns true if successfully handled)
            if (chewNode(subPartInfo), subtype) {
              return true;
            }
          }
        }
        // (If we are here, we failed to find a valid choice.)
        return false;
        // multipart that we should recurse into
      case 'mixed':
      case 'signed':
      case 'related':
      case 'report':
        for (i = 0; i < partInfo.childNodes.length; i++) {
          chewNode(partInfo.childNodes[i], subtype);
        }
        return true;

      default:
        console.warn('Ignoring multipart type:', subtype);
        return false;
      }
    }
    // Otherwise, this is a leaf node:
    else {
      // Detect named parts; they could be attachments.
      // filename via content-type 'name' parameter
      if (partInfo.parameters && partInfo.parameters.name) {
        filename = mimefuncs.mimeWordsDecode(partInfo.parameters.name);
      }
      // filename via content-type 'name' with charset/lang info
      else if (partInfo.parameters && partInfo.parameters['name*']) {
        filename = parseRfc2231CharsetEncoding(partInfo.parameters['name*']);
      }
      // rfc 2231 stuff:
      // filename via content-disposition filename without charset/lang info
      else if (partInfo.dispositionParameters &&
               partInfo.dispositionParameters.filename) {
        filename = mimefuncs.mimeWordsDecode(
          partInfo.dispositionParameters.filename);
      }
      // filename via content-disposition filename with charset/lang info
      else if (partInfo.dispositionParameters &&
               partInfo.dispositionParameters['filename*']) {
        filename = parseRfc2231CharsetEncoding(
          partInfo.dispositionParameters['filename*']);
      }
      // filename via content-disposition filename might include unicode characters 
      else if (partInfo.dispositionParameters) {
        let keyAry = Object.keys(partInfo.dispositionParameters);
        let headerValue = 'content-disposition: ' + partInfo.disposition + '; ';
        for (let i = 0; i < keyAry.length; i++) {
          headerValue = headerValue + keyAry[i] + '="' + partInfo.dispositionParameters[keyAry[i]] + '"';
          if (i !== keyAry.length - 1) {
            headerValue += '; ';
          }
        }
        let structured = mimefuncs.parseHeaderValue(headerValue);
        filename = mimefuncs.mimeWordsDecode(structured.params.filename);
      }
      else {
        filename = null;
      }

      // Determining disposition:

      // First, check whether an explict one exists
      if (partInfo.disposition) {
        // If it exists, keep it the same, except in the case of inline
        // disposition without a content id.
        if (partInfo.disposition.toLowerCase() == 'inline') {
          // Displaying text-parts inline is not a problem for us, but we need a
          // content id for other embedded content.  (Currently only images are
          // supported, but that is enforced in a subsequent check.)
          if (type === 'text' || partInfo.id) {
            disposition = 'inline';
          } else {
            disposition = 'attachment';
          }
        }
        else if (partInfo.disposition.toLowerCase() == 'attachment') {
          disposition = 'attachment';
        }
        // This case should never trigger, but it's here for safety's sake
        else {
          disposition = 'inline';
        }
        // Inline image attachments that belong to a multipart/related
        // may lack a disposition but have a content-id.
        // XXX Ensure 100% correctness in the future by fixing up
        // mis-guesses during sanitization as part of
        // https://bugzil.la/1024685
      } else if (parentMultipartSubtype === 'related' && partInfo.id &&
                 type === 'image') {
        disposition = "inline";
      } else if (filename || (type !== 'text' && type !== 'message')) {
        disposition = 'attachment';
      } else {
        disposition = 'inline';
      }

      // Some clients want us to display things inline that we simply can't
      // display (historically and currently, PDF) or that our usage profile
      // does not want to automatically download (in the future, PDF, because
      // they can get big.)
      if (type !== 'text' && type !== 'image' && type !== 'message') {
        disposition = 'attachment';
      }

      // - But we don't care if they are signatures...
      if ((type === 'application') &&
          (subtype === 'pgp-signature' || subtype === 'pkcs7-signature')) {
        return true;
      }

     var makePart = function(partInfo, filename) {
        return mailRep.makeAttachmentPart({
          name: filename || 'unnamed-' + (++unnamedPartCounter),
          contentId: partInfo.id ? stripArrows(partInfo.id) : null,
          type: partInfo.type.toLowerCase(),
          part: partInfo.part,
          encoding: partInfo.encoding && partInfo.encoding.toLowerCase(),
          sizeEstimate: estimatePartSizeInBytes(partInfo),
          file: null
        });
      }

      var makeTextPart = function(partInfo) {
        return mailRep.makeBodyPart({
          type: subtype,
          part: partInfo.part || '1',
          sizeEstimate: partInfo.size,
          amountDownloaded: 0,
          // its important to know that sizeEstimate and amountDownloaded
          // do _not_ determine if the bodyRep is fully downloaded; the
          // estimated amount is not reliable
          // Zero-byte bodies are assumed to be accurate and we treat the file
          // as already downloaded.
          isDownloaded: partInfo.size === 0,
          // full internal IMAP representation
          // it would also be entirely appropriate to move
          // the information on the bodyRep directly?
          _partInfo: partInfo.size ? {
            partID: partInfo.part,
            type: type,
            subtype: subtype,
            params: valuesOnly(partInfo.parameters),
            encoding: partInfo.encoding && partInfo.encoding.toLowerCase()
          } : null,
          content: ''
        });
      }

      if (disposition === 'attachment') {
        attachments.push(makePart(partInfo, filename));
        return true;
      }

      // - We must be an inline part or structure
      switch (type) {
        // - related image
      case 'image':
        relatedParts.push(makePart(partInfo, filename));
        return true;
        break;
        // - content
      case 'text':
        if (subtype === 'plain' || subtype === 'html') {
          bodyReps.push(makeTextPart(partInfo));
          return true;
        }
        break;
      }
      return false;
    }
  }

  chewNode(msg.bodystructure);

  return {
    bodyReps: bodyReps,
    attachments: attachments,
    relatedParts: relatedParts
  };
};

/**
 * Transform a browserbox representation of an item that has a value
 * (i.e. { value: foo }) into a pure value, recursively.
 *
 *   [{ value: 1 } ] -> [1]
 *   { value: 1 } -> 1
 *   undefined -> null
 */
function valuesOnly(item) {
  if (Array.isArray(item)) {
    return item.map(valuesOnly);
  } else if (item && typeof item === 'object') {
    if ('value' in item) {
      return item.value;
    } else {
      var result = {};
      for (var key in item) {
        result[key] = valuesOnly(item[key]);
      }
      return result;
    }
  } else if (item && typeof item === 'object') {
    return item;
  } else if (item !== undefined) {
    return item;
  } else {
    return null;
  }
}

exports.chewHeaderAndBodyStructure = function(msg, folderId, newMsgId) {
  // begin by splitting up the raw imap message
  var parts = chewStructure(msg);

  msg.date = msg.internaldate && parseImapDateTime(msg.internaldate);
  msg.headers = {};

  for (var key in msg) {
    // We test the key using a regex here because the key name isn't
    // normalized to a form we can rely on. The browserbox docs in
    // particular indicate that the full key name may be dependent on
    // the ordering of the fields as returned by the mail server (i.e.
    // the key name includes every header requested). One thing we can
    // rely on instead: grabbing the right key based upon just this
    // regex.
    if (/header\.fields/.test(key)) {
      var headerParser = new MimeParser();
      headerParser.write(msg[key] + '\r\n');
      headerParser.end();
      msg.headers = headerParser.node.headers;
      break;
    }
  }

  var fromArray = valuesOnly(firstHeader(msg, 'from'));
  var references = valuesOnly(firstHeader(msg, 'references'));

  return {
    header: mailRep.makeHeaderInfo({
      // the FolderStorage issued id for this message (which differs from the
      // IMAP-server-issued UID so we can do speculative offline operations like
      // moves).
      id: newMsgId,
      srvid: msg.uid,
      // The sufficiently unique id is a concatenation of the UID onto the
      // folder id.
      suid: folderId + '/' + newMsgId,
      // The message-id header value; as GUID as get for now; on gmail we can
      // use their unique value, or if we could convince dovecot to tell us.
      guid: stripArrows(valuesOnly(firstHeader(msg, 'message-id'))),
      // mimeparser models from as an array; we do not.
      author: fromArray && fromArray[0] ||
        // we require a sender e-mail; let's choose an illegal default as
        // a stopgap so we don't die.
        { address: 'missing-address@example.com' },
      to: valuesOnly(firstHeader(msg, 'to')),
      cc: valuesOnly(firstHeader(msg, 'cc')),
      bcc: valuesOnly(firstHeader(msg, 'bcc')),
      replyTo: valuesOnly(firstHeader(msg, 'reply-to')),
      date: msg.date,
      flags: msg.flags || [],
      hasAttachments: parts.attachments.length > 0,
      subject: valuesOnly(firstHeader(msg, 'subject')),

      // we lazily fetch the snippet later on
      snippet: null
    }),
    bodyInfo: mailRep.makeBodyInfo({
      date: msg.date,
      size: 0,
      attachments: parts.attachments,
      relatedParts: parts.relatedParts,
      references: references ? stripArrows(references.split(/\s+/)) : null,
      bodyReps: parts.bodyReps
    })
  };
};

/**
 * Fill a given body rep with the content from fetching
 * part or the entire body of the message...
 *
 *    var body = ...;
 *    var header = ...;
 *    var content = (some fetched content)..
 *
 *    $imapchew.updateMessageWithFetch(
 *      header,
 *      bodyInfo,
 *      {
 *        bodyRepIndex: 0,
 *        text: '',
 *        buffer: Uint8Array|Null,
 *        bytesFetched: n,
 *        bytesRequested: n
 *      }
 *    );
 *
 *    // what just happend?
 *    // 1. the body.bodyReps[n].content is now the value of content.
 *    //
 *    // 2. we update .amountDownloaded with the second argument
 *    //    (number of bytes downloaded).
 *    //
 *    // 3. if snippet has not bee set on the header we create the snippet
 *    //    and set its value.
 *
 */
exports.updateMessageWithFetch = function(header, body, req, res) {
  var bodyRep = body.bodyReps[req.bodyRepIndex];

  // check if the request was unbounded or we got back less bytes then we
  // requested in which case the download of this bodyRep is complete.
  if (!req.bytes || res.bytesFetched < req.bytes[1]) {
    bodyRep.isDownloaded = true;

    // clear private space for maintaining parser state.
    bodyRep._partInfo = null;
  }

  if (!bodyRep.isDownloaded && res.buffer) {
    bodyRep._partInfo.pendingBuffer = res.buffer;
  }

  bodyRep.amountDownloaded += res.bytesFetched;

  var data = $mailchew.processMessageContent(
    res.text, bodyRep.type, bodyRep.isDownloaded, req.createSnippet);

  if (req.createSnippet) {
    header.snippet = data.snippet;
  }
  if (bodyRep.isDownloaded)
    bodyRep.content = data.content;
};

/**
 * Selects a desirable snippet body rep if the given header has no snippet.
 */
exports.selectSnippetBodyRep = function(header, body) {
  if (header.snippet)
    return -1;

  var bodyReps = body.bodyReps;
  var len = bodyReps.length;

  for (var i = 0; i < len; i++) {
    if (exports.canBodyRepFillSnippet(bodyReps[i])) {
      return i;
    }
  }

  return -1;
};

/**
 * Determines if a given body rep can be converted into a snippet. Useful for
 * determining which body rep to use when downloading partial bodies.
 *
 *
 *    var bodyInfo;
 *    $imapchew.canBodyRepFillSnippet(bodyInfo.bodyReps[0]) // true/false
 *
 */
exports.canBodyRepFillSnippet = function(bodyRep) {
  return (
    bodyRep &&
    bodyRep.type === 'plain' ||
    bodyRep.type === 'html'
  );
};


/**
 * Calculates and returns the correct estimate for the number of
 * bytes to download before we can display the body. For IMAP, that
 * includes the bodyReps and related parts. (POP3 is different.)
 */
exports.calculateBytesToDownloadForImapBodyDisplay = function(body) {
  var bytesLeft = 0;
  body.bodyReps.forEach(function(rep) {
    if (!rep.isDownloaded) {
      bytesLeft += rep.sizeEstimate - rep.amountDownloaded;
    }
  });
  body.relatedParts.forEach(function(part) {
    if (!part.file) {
      bytesLeft += part.sizeEstimate;
    }
  });
  return bytesLeft;
}

// parseImapDateTime and formatImapDateTime functions from node-imap;
// MIT licensed, (c) Brian White.

// ( ?\d|\d{2}) = day number; technically it's either "SP DIGIT" or "2DIGIT"
// but there's no harm in us accepting a single digit without whitespace;
// it's conceivable the caller might have trimmed whitespace.
//
// The timezone can, as unfortunately demonstrated by net-c.com/netc.fr, be
// omitted.  So we allow it to be optional and assume its value was zero if
// omitted.
var reDateTime =
      /^( ?\d|\d{2})-(.{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})(?: ([+-]\d{4}))?$/;
var HOUR_MILLIS = 60 * 60 * 1000;
var MINUTE_MILLIS = 60 * 1000;
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

/**
* Parses IMAP "date-time" instances into UTC timestamps whose quotes have
* already been stripped.
*
* http://tools.ietf.org/html/rfc3501#page-84
*
* date-day = 1*2DIGIT
* ; Day of month
* date-day-fixed = (SP DIGIT) / 2DIGIT
* ; Fixed-format version of date-day
* date-month = "Jan" / "Feb" / "Mar" / "Apr" / "May" / "Jun" /
* "Jul" / "Aug" / "Sep" / "Oct" / "Nov" / "Dec"
* date-year = 4DIGIT
* time = 2DIGIT ":" 2DIGIT ":" 2DIGIT
* ; Hours minutes seconds
* zone = ("+" / "-") 4DIGIT
* date-time = DQUOTE date-day-fixed "-" date-month "-" date-year
* SP time SP zone DQUOTE
*/
var parseImapDateTime = exports.parseImapDateTime = function(dstr) {
  var match = reDateTime.exec(dstr);
  if (!match)
    throw new Error('Not a good IMAP date-time: ' + dstr);
  var day = parseInt(match[1], 10),
      zeroMonth = MONTHS.indexOf(match[2]),
      year = parseInt(match[3], 10),
      hours = parseInt(match[4], 10),
      minutes = parseInt(match[5], 10),
      seconds = parseInt(match[6], 10),
      // figure the timestamp before the zone stuff. We don't
      timestamp = Date.UTC(year, zeroMonth, day, hours, minutes, seconds),
      // to reduce string garbage creation, we use one string. (we have to
      // play math games no matter what, anyways.)
      zoneDelta = match[7] ? parseInt(match[7], 10) : 0,
      zoneHourDelta = Math.floor(zoneDelta / 100),
      // (the negative sign sticks around through the mod operation)
      zoneMinuteDelta = zoneDelta % 100;

  // ex: GMT-0700 means 7 hours behind, so we need to add 7 hours, aka
  // subtract negative 7 hours.
  timestamp -= zoneHourDelta * HOUR_MILLIS + zoneMinuteDelta * MINUTE_MILLIS;

  return timestamp;
};

exports.formatImapDateTime = function(date) {
   var s;
   s = ((date.getDate() < 10) ? ' ' : '') + date.getDate() + '-' +
     MONTHS[date.getMonth()] + '-' +
     date.getFullYear() + ' ' +
     ('0'+date.getHours()).slice(-2) + ':' +
     ('0'+date.getMinutes()).slice(-2) + ':' +
     ('0'+date.getSeconds()).slice(-2) +
     ((date.getTimezoneOffset() > 0) ? ' -' : ' +' ) +
     ('0'+(Math.abs(date.getTimezoneOffset()) / 60)).slice(-2) +
     ('0'+(Math.abs(date.getTimezoneOffset()) % 60)).slice(-2);
   return s;
};


}); // end define
;


// XXX: This is copied from shared/js/mime_mapper.js until the
// download manager ships.

/**
 * MimeMapper helps gaia apps to decide the mapping of mimetype and extension.
 * The use cases often happen when apps need to know about the exact
 * mimetypes or extensions, such as to delegate the open web activity, we must
 * have suitable mimetypes or extensions to request the right activity
 *
 * The mapping is basically created according to:
 * http://en.wikipedia.org/wiki/Internet_media_type
 *
 * The supported formats are considered base on the deviceStorage properties:
 * http://dxr.mozilla.org/mozilla-central/toolkit/content/
 * devicestorage.properties
 *
 */
define('pop3/mime_mapper',[],function() {
return {
  // This list only contains the extensions we currently supported
  // We should make it more complete for further usages
  _typeToExtensionMap: {
    // Image
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    // Audio
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/3gpp': '3gp',
    'audio/amr': 'amr',
    // Video
    'video/mp4': 'mp4',
    'video/mpeg': 'mpg',
    'video/ogg': 'ogg',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    // Application
    // If we want to support some types, like pdf, just add
    // 'application/pdf': 'pdf'
    'application/vcard': 'vcf',
    // Text
    'text/vcard': 'vcf',
    'text/x-vcard': 'vcf'
  },

  // This list only contains the mimetypes we currently supported
  // We should make it more complete for further usages
  _extensionToTypeMap: {
    // Image
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'jpe': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    // Audio
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'm4b': 'audio/mp4',
    'm4p': 'audio/mp4',
    'm4r': 'audio/mp4',
    'aac': 'audio/aac',
    'opus': 'audio/ogg',
    'amr': 'audio/amr',
    // Video
    'mp4': 'video/mp4',
    'mpeg': 'video/mpeg',
    'mpg': 'video/mpeg',
    'ogv': 'video/ogg',
    'ogx': 'video/ogg',
    'webm': 'video/webm',
    '3gp': 'video/3gpp',
    'ogg': 'video/ogg',
    // Application
    // If we want to support some extensions, like pdf, just add
    // 'pdf': 'application/pdf'
    // Text
    'vcf': 'text/vcard'
  },
  _parseExtension: function(filename) {
    var array = filename.split('.');
    return array.length > 1 ? array.pop() : '';
  },

  isSupportedType: function(mimetype) {
    return (mimetype in this._typeToExtensionMap);
  },

  isSupportedExtension: function(extension) {
    return (extension in this._extensionToTypeMap);
  },

  isFilenameMatchesType: function(filename, mimetype) {
    var extension = this._parseExtension(filename);
    var guessedType = this.guessTypeFromExtension(extension);
    return (guessedType == mimetype);
  },

  guessExtensionFromType: function(mimetype) {
    return this._typeToExtensionMap[mimetype];
  },

  guessTypeFromExtension: function(extension) {
    return this._extensionToTypeMap[extension];
  },

  // If mimetype is not in the supported list, we will try to
  // predict the possible valid mimetype based on extension.
  guessTypeFromFileProperties: function(filename, mimetype) {
    var extension = this._parseExtension(filename);
    var type = this.isSupportedType(mimetype) ?
      mimetype : this.guessTypeFromExtension(extension);
    return type || '';
  },

  // if mimetype is not supported, preserve the original extension
  // and add the predict result as new extension.
  // If both filename and mimetype are not supported, return the original
  // filename.
  ensureFilenameMatchesType: function(filename, mimetype) {
    if (!this.isFilenameMatchesType(filename, mimetype)) {
      var guessedExt = this.guessExtensionFromType(mimetype);
      if (guessedExt) {
        filename += '.' + guessedExt;
      }
    }
    return filename;
  }
};
});

define('pop3/pop3',['module', 'exports', 'logic', 'tcp-socket', 'md5',
        './transport', 'mimeparser', 'imap/imapchew',
        'syncbase', 'date',
        'mimefuncs',
        './mime_mapper', 'allback'],
function(module, exports, logic, tcpSocket, md5,
         transport, MimeParser, imapchew,
         syncbase, dateMod, mimefuncs, mimeMapper, allback) {

  /**
   * The Pop3Client modules and classes are organized according to
   * their function, as follows, from low-level to high-level:
   *
   *      [Pop3Parser] parses raw protocol data from the server.
   *      [Pop3Protocol] handles the request/response semantics
   *                     along with the Request and Response classes,
   *                     which are mostly for internal use. Pop3Protocol
   *                     does not deal with I/O at all.
   *      [Pop3Client] hooks together the Protocol and a socket, and
   *                   handles high-level details like listing messages.
   *
   * In general, this tries to share as much code as possible with
   * IMAP/ActiveSync. We reuse imapchew.js to normalize POP3 MIME
   * messages in the same way as IMAP, to avoid spurious errors trying
   * to write yet another translation layer. All of the MIME parsing
   * happens in this file; transport.js contains purely wire-level
   * logic.
   *
   * Each Pop3Client is responsible for one connection only;
   * Pop3Account in GELAM is responsible for managing connection lifetime.
   *
   * As of this writing (Nov 2013), there was only one other
   * reasonably complete POP3 JavaScript implementation, available at
   * <https://github.com/ditesh/node-poplib>. It would have probably
   * worked, but since the protocol is simple, it seemed like a better
   * idea to avoid patching over Node-isms more than necessary (e.g.
   * avoiding Buffers, node socket-isms, etc.). Additionally, that
   * library only contained protocol-level details, so we would have
   * only really saved some code in transport.js.
   *
   * For error conditions, this class always normalizes errors into
   * the format as documented in the constructor below.
   * All external callbacks get passed node-style (err, ...).
   */

  // Allow setTimeout and clearTimeout to be shimmed for unit tests.
  var setTimeout = window.setTimeout.bind(window);
  var clearTimeout = window.clearTimeout.bind(window);
  exports.setTimeoutFunctions = function(set, clear) {
    setTimeout = set;
    clearTimeout = clear;
  }

  /***************************************************************************
   * Pop3Client
   *
   * Connect to a POP3 server. `cb` is always invoked, with (err) if
   * the connction attempt failed. Options are as follows:
   *
   * @param {string} host
   * @param {string} username
   * @param {string} password
   * @param {string} port
   * @param {boolean|'plain'|'ssl'|'starttls'} crypto
   * @param {int} connTimeout optional connection timeout
   * @param {'apop'|'sasl'|'user-pass'} preferredAuthMethod first method to try
   * @param {boolean} debug True to dump the protocol to the console.
   *
   * The connection's current state is available at `.state`, with the
   * following values:
   *
   *   'disconnected', 'greeting', 'starttls', 'authorization', 'ready'
   *
   * All callback errors are normalized to the following form:
   *
   *    var err = {
   *      scope: 'connection|authentication|mailbox|message',
   *      name: '...',
   *      message: '...',
   *      request: Pop3Client.Request (if applicable),
   *      exception: (A socket error, if available),
   *    };
   *
   */
  var Pop3Client = exports.Pop3Client = function(options, cb) {
    // for clarity, list the available options:
    this.options = options = options || {};
    options.host = options.host || null;
    options.username = options.username || null;
    options.password = options.password || null;
    options.port = options.port || null;
    options.crypto = options.crypto || false;
    options.connTimeout = options.connTimeout || 30000;
    options.debug = options.debug || false;
    options.authMethods = ['apop', 'sasl', 'user-pass'];

    logic.defineScope(this, 'Pop3Client');

    if (options.preferredAuthMethod) {
      // if we prefer a certain auth method, try that first.
      var idx = options.authMethods.indexOf(options.preferredAuthMethod);
      if (idx !== -1) {
        options.authMethods.splice(idx, 1);
      }
      options.authMethods.unshift(options.preferredAuthMethod);
    }

    // Normalize the crypto option:
    if (options.crypto === true) {
      options.crypto = 'ssl';
    } else if (!options.crypto) {
      options.crypto = 'plain';
    }

    if (!options.port) {
      options.port = {
        'plain': 110,
        'starttls': 110,
        'ssl': 995
      }[options.crypto];
      if (!options.port) {
        throw new Error('Invalid crypto option for Pop3Client: ' +
                        options.crypto);
      }
    }

    // The public state of the connection (the only one we really care
    // about is 'disconnected')
    this.state = 'disconnected';
    this.authMethod = null; // Upon successful login, the method that worked.

    // Keep track of the message IDs and UIDLs the server has reported
    // during this session (these values could change in each
    // session, though they probably won't):
    this.idToUidl = {};
    this.uidlToId = {};
    this.idToSize = {};
    // An array of {uidl: "", size: 0, number: } for each message
    // retrieved as a result of calling LIST
    this._messageList = null;
    this._greetingLine = null; // contains APOP auth info, if available

    this.protocol = new transport.Pop3Protocol();
    this.socket = tcpSocket.open(options.host, options.port, {
      useSecureTransport: (options.crypto === 'ssl' ||
                           options.crypto === true)
    });

    var connectTimeout = setTimeout(function() {
      this.state = 'disconnected';
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      cb && cb({
        scope: 'connection',
        request: null,
        name: 'unresponsive-server',
        message: 'Could not connect to ' + options.host + ':' + options.port +
          ' with ' + options.crypto + ' encryption.',
      });
    }.bind(this), options.connTimeout);

    // Hook the protocol and socket together:
    this.socket.ondata = this.protocol.onreceive.bind(this.protocol);
    this.protocol.onsend = this.socket.send.bind(this.socket);

    this.socket.onopen = function() {
      console.log('pop3:onopen');
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      this.state = 'greeting';
      // No further processing is needed here. We wait for the server
      // to send a +OK greeting before we try to authenticate.
    }.bind(this);

    this.socket.onerror = function(evt) {
      var err = evt && evt.data || evt;
      console.log('pop3:onerror', err);
      if (connectTimeout) {
        clearTimeout(connectTimeout);
        connectTimeout = null;
      }
      cb && cb({
        scope: 'connection',
        request: null,
        name: 'unresponsive-server',
        message: 'Socket exception: ' + JSON.stringify(err),
        exception: err,
      });
    }.bind(this);

    // sync cares about listening for us closing; it has no way to be informed
    // by disaster recovery otherwise
    this.onclose = null;
    this.socket.onclose = function() {
      console.log('pop3:onclose');
      this.protocol.onclose();
      this.close();
      if (this.onclose) {
        this.onclose();
      }
    }.bind(this);

    // To track requests/responses in the presence of a server
    // greeting, store an empty request here. Our request/response
    // matching logic will pair the server's greeting with this
    // request.
    this.protocol.pendingRequests.push(
    new transport.Request(null, [], false, function(err, rsp) {
      if (err) {
        cb && cb({
          scope: 'connection',
          request: null,
          name: 'unresponsive-server',
          message: err.getStatusLine(),
          response: err,
        });
        return;
      }

      // Store the greeting line, it might be needed in authentication
      this._greetingLine = rsp.getLineAsString(0);

      this._maybeUpgradeConnection(function(err) {
        if (err) { cb && cb(err); return; }
        this._thenAuthorize(function(err) {
          if (!err) {
            this.state = 'ready';
          }
          cb && cb(err);
        });
      }.bind(this));
    }.bind(this)));
  }

  /**
   * Disconnect from the server forcibly. Do not issue a QUIT command.
   */
  Pop3Client.prototype.close =
  Pop3Client.prototype.die = function() {
    if (this.state !== 'disconnected') {
      this.state = 'disconnected';
      this.socket.close();
      // No need to do anything further; we'll tear down when we
      // receive the socket's "close" event.
    }
  }

  /**
   * Fetch the capabilities from the server. If the connection
   * supports STLS and we've specified 'starttls' as the crypto
   * option, we upgrade the connection here.
   */
  // XXX: UNUSED FOR NOW. Maybe we'll use it later.
  Pop3Client.prototype._getCapabilities = function(cb) {
    this.protocol.sendRequest('CAPA', [], true, function(err, rsp) {
      if (err) {
        // It's unlikely this server's going to do much, but we'll try.
        this.capabilities = {};
      } else {
        var lines = rsp.getDataLines();
        for (var i = 0; i < lines.length; i++) {
          var words = lines[i].split(' ');
          this.capabilities[words[0]] = words.slice(1);
        }
      }
    }.bind(this));
  }

  /**
   * If we're trying to use TLS, upgrade now.
   *
   * This is followed by ._thenAuthorize().
   */
  Pop3Client.prototype._maybeUpgradeConnection = function(cb) {
    if (this.options.crypto === 'starttls') {
      this.state = 'starttls';
      this.protocol.sendRequest('STLS', [], false, function(err, rsp) {
        if (err) {
          cb && cb({
            scope: 'connection',
            request: err.request,
            name: 'bad-security',
            message: err.getStatusLine(),
            response: err,
          });
          return;
        }
        this.socket.upgradeToSecure();
        cb();
      }.bind(this));
    } else {
      cb();
    }
  }

  /**
   * Set the current state to 'authorization' and attempts to
   * authenticate the user with any available authentication method.
   * We try APOP first if the server supports it, since we can avoid
   * replay attacks and authenticate in one roundtrip. Otherwise, we
   * try SASL AUTH PLAIN, which POP3 servers are (in theory) required
   * to support if they support SASL at all. Lastly, we fall back to
   * plain-old USER/PASS authentication if that's all we have left.
   *
   * Presently, if one authentication method fails for any reason, we
   * simply try the next. We could be smarter and drop out on
   * detecting a bad-user-or-pass error.
   */
  Pop3Client.prototype._thenAuthorize = function(cb) {
    this.state = 'authorization';

    this.authMethod = this.options.authMethods.shift();

    var user = this.options.username;
    var pass = this.options.password;
    var secret;
    switch(this.authMethod) {
    case 'apop':
      var match = /<.*?>/.exec(this._greetingLine || "");
      var apopTimestamp = match && match[0];
      if (!apopTimestamp) {
        // if the server doesn't support APOP, try the next method.
        this._thenAuthorize(cb);
      } else {
        secret = md5(apopTimestamp + pass).toLowerCase();
        this.protocol.sendRequest(
          'APOP', [user, secret], false, function(err, rsp) {
          if (err) {
            this._greetingLine = null; // try without APOP
            this._thenAuthorize(cb);
          } else {
            cb(); // ready!
          }
        }.bind(this));
      }
      break;
    case 'sasl':
      secret = btoa(user + '\x00' + user + '\x00' + pass);
      this.protocol.sendRequest(
        'AUTH', ['PLAIN', secret], false, function(err, rsp) {
        if (err) {
          this._thenAuthorize(cb);
        } else {
          cb(); // ready!
        }
      }.bind(this));
      break;
    case 'user-pass':
    default:
      this.protocol.sendRequest('USER', [user], false, function(err, rsp) {
        if (err) {
          cb && cb({
            scope: 'authentication',
            request: err.request,
            name: 'bad-user-or-pass',
            message: err.getStatusLine(),
            response: err,
          });
          return;
        }
        this.protocol.sendRequest('PASS', [pass], false, function(err, rsp) {
          if (err) {
            cb && cb({
              scope: 'authentication',
              request: null, // No request logging here; may leak password.
              name: 'bad-user-or-pass',
              message: err.getStatusLine(),
              response: err,
            });
            return;
          }
          cb();
        }.bind(this));
      }.bind(this));
      break;
    }
  }

  /*********************************************************************
   * MESSAGE FETCHING
   *
   * POP3 does not support granular partial retrieval; we can only
   * download a given number of _lines_ of the message (including
   * headers). Thus, in order to download snippets of messages (rather
   * than just the entire body), we have to guess at how many lines
   * it'll take to get enough MIME data to be able to parse out a
   * text/plain snippet.
   *
   * For now, we'll try to download a few KB of the message, which
   * should give plenty of data to form a snippet. We're aiming for a
   * sweet spot, because if the message is small enough, we can just
   * download the whole thing and be done.
   */

  /**
   * Issue a QUIT command to the server, persisting any DELE message
   * deletions you've enqueued. This also closes the connection.
   */
  Pop3Client.prototype.quit = function(cb) {
    this.state = 'disconnected';
    this.protocol.sendRequest('QUIT', [], false, function(err, rsp) {
      this.close();
      if (err) {
        cb && cb({
          scope: 'mailbox',
          request: err.request,
          name: 'server-problem',
          message: err.getStatusLine(),
          response: err,
        });
      } else {
        cb && cb();
      }
    }.bind(this));
  }

  /**
   * Load a mapping of server message numbers to UIDLs, so that we
   * can interact with messages stably across sessions. Additionally,
   * this fetches a LIST of the messages so that we have a list of
   * message sizes in addition to their UIDLs.
   */
  Pop3Client.prototype._loadMessageList = function(cb) {
    // if we've already loaded IDs this session, we don't need to
    // compute them again, because POP3 shows a frozen state of your
    // mailbox until you disconnect.
    if (this._messageList) {
      cb(null, this._messageList);
      return;
    }
    // First, get UIDLs for each message.
    this.protocol.sendRequest('UIDL', [], true, function(err, rsp) {
      if (err) {
        cb && cb({
          scope: 'mailbox',
          request: err.request,
          name: 'server-problem',
          message: err.getStatusLine(),
          response: err,
        });
        return;
      }

      var lines = rsp.getDataLines();
      for (var i = 0; i < lines.length; i++) {
        var words = lines[i].split(' ');
        var number = words[0];
        var uidl = words[1];
        this.idToUidl[number] = uidl;
        this.uidlToId[uidl] = number
      }
      // because POP3 servers process requests serially, the next LIST
      // will not run until after this completes.
    }.bind(this));

    // Then, get a list of messages so that we can track their size.
    this.protocol.sendRequest('LIST', [], true, function(err, rsp) {
      if (err) {
        cb && cb({
          scope: 'mailbox',
          request: err.request,
          name: 'server-problem',
          message: err.getStatusLine(),
          response: err,
        });
        return;
      }

      var lines = rsp.getDataLines();
      var allMessages = [];
      for (var i = 0; i < lines.length; i++) {
        var words = lines[i].split(' ');
        var number = words[0];
        var size = parseInt(words[1], 10);
        this.idToSize[number] = size;
        // Push the message onto the front, so that the last line
        // becomes the first message in allMessages. Most POP3 servers
        // seem to return messages in ascending date order, so we want
        // to process the newest messages first. (Tested with Dovecot,
        // Gmail, and AOL.) The resulting list here contains the most
        // recent message first.
        allMessages.unshift({
          uidl: this.idToUidl[number],
          size: size,
          number: number
        });
      }

      this._messageList = allMessages;
      cb && cb(null, allMessages);
    }.bind(this));
  }

  /**
   * Fetch the headers and snippets for all messages. Only retrieves
   * messages for which filterFunc(uidl) returns true.
   *
   * @param {object} opts
   * @param {function(uidl)} opts.filter Only store messages matching filter
   * @param {function(evt)} opts.progress Progress callback
   * @param {int} opts.checkpointInterval Call `checkpoint` every N messages
   * @param {int} opts.maxMessages Download _at most_ this many
   *   messages during this listMessages invocation. If we find that
   *   we would have to download more than this many messages, mark
   *   the rest as "overflow" messages that could be downloaded in a
   *   future sync iteration. (Default is infinite.)
   * @param {function(next)} opts.checkpoint Callback to periodically save state
   * @param {function(err, numSynced, overflowMessages)} cb
   *   Upon completion, returns the following data:
   *
   *   numSynced: The number of messages synced.
   *
   *   overflowMessages: An array of objects with the following structure:
   *
   *       { uidl: "", size: 0 }
   *
   *     Each message in overflowMessages was NOT downloaded. Instead,
   *     you should store those UIDLs for future retrieval as part of
   *     a "Download More Messages" operation.
   */
  Pop3Client.prototype.listMessages = function(opts, cb) {
    var filterFunc = opts.filter;
    var progressCb = opts.progress;
    var checkpointInterval = opts.checkpointInterval || null;
    var maxMessages = opts.maxMessages || Infinity;
    var checkpoint = opts.checkpoint;
    var overflowMessages = [];

    // Get a mapping of number->UIDL.
    this._loadMessageList(function(err, unfilteredMessages) {
      if (err) { cb && cb(err); return; }

      // Calculate which messages we would need to download.
      var totalBytes = 0;
      var bytesFetched = 0;
      var messages = [];
      var seenCount = 0;
      // Filter out unwanted messages.
      for (var i = 0; i < unfilteredMessages.length; i++) {
        var msgInfo = unfilteredMessages[i];
        if (!filterFunc || filterFunc(msgInfo.uidl)) {
          if (messages.length < maxMessages) {
            totalBytes += msgInfo.size;
            messages.push(msgInfo);
          } else {
            overflowMessages.push(msgInfo);
          }
        } else {
          seenCount++;
        }
      }

      console.log('POP3: listMessages found ' +
                  messages.length + ' new, ' +
                  overflowMessages.length + ' overflow, and ' +
                  seenCount + ' seen messages. New UIDLs:');

      messages.forEach(function(m) {
        console.log('POP3: ' + m.size + ' bytes: ' + m.uidl);
      });

      var totalMessages = messages.length;
      // If we don't provide a checkpoint interval, just do all
      // messages at once.
      if (!checkpointInterval) {
        checkpointInterval = totalMessages;
      }

      var firstErr = null;
      // Download all of the messages in batches.
      var nextBatch = function() {
        console.log('POP3: Next batch. Messages left: ' + messages.length);
        // If there are no more messages or our connection died, we're done.
        if (!messages.length || this.protocol.closed) {
          console.log('POP3: Sync complete. ' +
                      totalMessages + ' messages synced, ' +
                      overflowMessages.length + ' overflow messages.');
          cb && cb(firstErr, totalMessages, overflowMessages);
          return;
        }

        var batch = messages.splice(0, checkpointInterval);
        var latch = allback.latch();

        // Trigger a download for every message in the batch.
        batch.forEach(function(m, idx) {
          var messageDone = latch.defer(m.number);
          this.downloadPartialMessageByNumber(m.number, function(err, msg) {
            bytesFetched += m.size;
            if (err) {
              if (!firstErr) {
                firstErr = err;
              }
            } else {
              progressCb && progressCb({
                totalBytes: totalBytes,
                bytesFetched: bytesFetched,
                size: m.size,
                message: msg
              });
            }
            messageDone(err);
          });
        }.bind(this));

        // When all messages in this batch have completed, trigger the
        // next batch to begin download. If `checkpoint` is provided,
        // we'll wait for it to tell us to continue (so that we can
        // save the database periodically or perform other
        // housekeeping during sync).
        latch.then(function(results) {
          // figure out if we actually did work so we actually need to save.
          var anySaved = false;
          for (var num in results) {
            console.log('result', num, results[num]);
            if (!results[num][0]) {
              anySaved = true;
              break;
            }
          }
          if (checkpoint && anySaved) {
            console.log('POP3: Checkpoint.');
            checkpoint(nextBatch);
          } else {
            nextBatch();
          }
        });
      }.bind(this);

      // Kick it off, maestro.
      nextBatch();

    }.bind(this));
  }

  /**
   * Retrieve the full body (+ attachments) of a message given a UIDL.
   *
   * @param {string} uidl The message's UIDL as reported by the server.
   */
  Pop3Client.prototype.downloadMessageByUidl = function(uidl, cb) {
    this._loadMessageList(function(err) {
      if (err) {
        cb && cb(err);
      } else {
        this.downloadMessageByNumber(this.uidlToId[uidl], cb);
      }
    }.bind(this));
  }

  /**
   * Retrieve a portion of one message. The returned message is
   * normalized to the format needed by GELAM according to
   * `parseMime`.
   *
   * @param {string} number The message number (on the server)
   * @param {function(err, msg)} cb
   */
  // XXX: TODO: There are some roundtrips between strings and buffers
  // here. This is generally safe (converting to and from UTF-8), but
  // it creates unnecessary garbage. Clean this up when we switch over
  // to jsmime.
  Pop3Client.prototype.downloadPartialMessageByNumber = function(number, cb) {
    // Based on SNIPPET_SIZE_GOAL, calculate approximately how many
    // lines we'll need to fetch in order to roughly retrieve
    // SNIPPET_SIZE_GOAL bytes.
    var numLines = Math.floor(syncbase.POP3_SNIPPET_SIZE_GOAL / 80);
    this.protocol.sendRequest('TOP', [number, numLines],
                              true, function(err, rsp) {
      if(err) {
        cb && cb({
          scope: 'message',
          request: err.request,
          name: 'server-problem',
          message: err.getStatusLine(),
          response: err,
        });
        return;
      }

      var fullSize = this.idToSize[number];
      var data = rsp.getDataAsString();
      var isSnippet = (!fullSize || data.length < fullSize);
      // If we didn't get enough data, msg.body.bodyReps may be empty.
      // The values we use for retrieving snippets are
      // sufficiently large that we really shouldn't run into this
      // case in nearly all cases. We assume that the UI will
      // handle this (exceptional) case reasonably.
      cb(null, this.parseMime(data, isSnippet, number));
    }.bind(this));
  }

  /**
   * Retrieve a message in its entirety, given a server-centric number.
   *
   * @param {string} number The message number (on the server)
   * @param {function(err, msg)} cb
   */
  Pop3Client.prototype.downloadMessageByNumber = function(number, cb) {
    this.protocol.sendRequest('RETR', [number], true, function(err, rsp) {
      if(err) {
        cb && cb({
          scope: 'message',
          request: err.request,
          name: 'server-problem',
          message: err.getStatusLine(),
          response: err,
        });
        return;
      }
      cb(null, this.parseMime(rsp.getDataAsString(), false, number));
    }.bind(this));
  }

  /**
   * Retrieve a header from a MimeNode given a lowercase headerName.
   */
  function safeHeader(node, headerName, defaultValue) {
    var allHeaders = node.headers[headerName];
    if (allHeaders && allHeaders[0]) {
      return allHeaders[0].value;
    } else {
      return defaultValue || null;
    }
  }

  function safeHeaderParams(node, headerName) {
    var allHeaders = node.headers[headerName];
    if (allHeaders && allHeaders[0]) {
      return allHeaders[0].params || {};
    } else {
      return {};
    }
  }

  /**
   * Convert a MimeParser-intermediate MIME tree to a structure
   * format as parsable with imapchew. This allows us to reuse much of
   * the parsing code and maintain parity between IMAP and POP3.
   */
  function mimeTreeToStructure(node, partId, partMap, partialNode) {
    var typeInfo = {};
    typeInfo.part = partId || '1';
    typeInfo.type = node.contentType.value;
    typeInfo.parameters = safeHeaderParams(node, 'content-type');

    var dispositionValue = safeHeader(node, 'content-disposition');
    if (dispositionValue) {
      typeInfo.disposition = dispositionValue;
      typeInfo.dispositionParameters =
        safeHeaderParams(node, 'content-disposition');
    }
    typeInfo.id = safeHeader(node, 'content-id');
    typeInfo.encoding = 'binary'; // we already decoded it
    typeInfo.size = node.content && node.content.length || 0;
    typeInfo.description = null; // unsupported (unnecessary)
    typeInfo.lines = null; // unsupported (unnecessary)
    typeInfo.md5 = null; // unsupported (unnecessary)
    typeInfo.childNodes = [];

    // If the node was not a multipart node (i.e. it's supposed to
    // have content), it's just an empty node. MimeParser leaves
    // 'content' undefined, but actually we want an empty array.
    if (node.content == null && !/^multipart\//.test(typeInfo.type)) {
      node.content = new Uint8Array();
    }

    if (node.content != null) {
      partMap[typeInfo.part] = node.content;
      // If this node was only partially downloaded, note it as such
      // in a special key on partMap. We'll use this key to later
      // indicate that this part's size should be calculated based on
      // the bytes we have not downloaded yet.
      if (partialNode === node) {
        partMap['partial'] = typeInfo.part;
      }
    }

    if (node._childNodes.length) {
      for (var i = 0; i < node._childNodes.length; i++) {
        var child = node._childNodes[i];
        typeInfo.childNodes.push(mimeTreeToStructure(
          child, typeInfo.part + '.' + (i + 1), partMap, partialNode));
      }
    }
    return typeInfo;
  }

  // This function is made visible for test logic external to this module.
  Pop3Client.parseMime = function(content) {
    return Pop3Client.prototype.parseMime.call(this, content);
  }

  Pop3Client.prototype.parseMime = function(mimeContent, isSnippet, number) {
    var mp = new MimeParser();
    var lastNode;
    mp.write(mimefuncs.charset.encode(mimeContent, 'utf-8'));
    mp.end();
    // mimeparser does not generate onbody events for partial pieces of body
    // so we find the "last" node through tree-traversal:
    lastNode = mp.node;
    while (lastNode._currentChild && lastNode !== lastNode._currentChild) {
      lastNode = lastNode._currentChild;
    }

    var rootNode = mp.node;
    var partialNode = (isSnippet ? lastNode : null);
    var estSize = (number && this.idToSize[number]) || mimeContent.length;
    var content;
    var dateHeader = safeHeader(rootNode, 'date'), dateTS;
    // If we got a date, clamp it to now if it's trying to live in the future
    // or it's simply invalid.  Our rational for clamping is that we don't
    // want spammers to be able to permanently lodge their mails at the top of
    // the inbox or to otherwise upset our careful invariants.
    var now = dateMod.NOW();
    if (dateHeader) {
      dateTS = Date.parse(dateHeader);
      if (isNaN(dateTS) || dateTS > now) {
        dateTS = now;
      }
    } else {
      // If we don't have a date, then just use now as the date.  The rationale
      // for this is that we are already trusting the message's claimed
      // composition date, so it's not like this can be maliciously abused.
      dateTS = now;
    }

    var headerList = [];
    for (var key in rootNode.headers) {
      headerList.push(key + ': ' + rootNode.headers[key][0].initial + '\r\n');
    }

    var partMap = {}; // partId -> content
    var msg = {
      uid: number && this.idToUidl[number], // the server-given ID
      'header.fields[]': headerList.join(''),
      internaldate: dateTS && imapchew.formatImapDateTime(new Date(dateTS)),
      flags: [],
      bodystructure: mimeTreeToStructure(rootNode, '1', partMap, partialNode)
    };

    var rep = imapchew.chewHeaderAndBodyStructure(msg, null, null);
    var bodyRepIdx = imapchew.selectSnippetBodyRep(rep.header, rep.bodyInfo);

    // Calculate the proper size for all of the parts. Any part we've
    // seen will have been fully downloaded, so we have the whole
    // thing. We must just attribute the rest of the size to the one
    // unfinished part, whose partId is stored in partMap['partial'].
    var partSizes = {};
    var usedSize = 0;
    var partialPartKey = partMap['partial'];
    for (var k in partMap) {
      if (k === 'partial') { continue; };
      if (k !== partialPartKey) {
        usedSize += partMap[k].length;
        partSizes[k] = partMap[k].length;
      }
    }
    if (partialPartKey) {
      partSizes[partialPartKey] = estSize - usedSize;
    }

    for (var i = 0; i < rep.bodyInfo.bodyReps.length; i++) {
      var bodyRep = rep.bodyInfo.bodyReps[i];

      content = mimefuncs.charset.decode(partMap[bodyRep.part], 'utf-8');
      var req = {
        // If bytes is null, imapchew.updateMessageWithFetch knows
        // that we've fetched the entire thing. Passing in [-1, -1] as a
        // range tells imapchew that we're not done downloading it yet.
        bytes: (partialPartKey === bodyRep.part ? [-1, -1] : null),
        bodyRepIndex: i,
        createSnippet: i === bodyRepIdx,
      };

      if (content != null) {
        bodyRep.size = partSizes[bodyRep.part];
        var res = {
          bytesFetched: content.length,
          text: content
        };
        imapchew.updateMessageWithFetch(rep.header, rep.bodyInfo, req, res);
      }
    }


    // Convert attachments and related parts to Blobs if we've
    // downloaded the whole thing:
    for (var i = 0; i < rep.bodyInfo.relatedParts.length; i++) {
      var relatedPart = rep.bodyInfo.relatedParts[i];
      relatedPart.sizeEstimate = partSizes[relatedPart.part];
      content = partMap[relatedPart.part];
      if (content != null && partialPartKey !== relatedPart.part) {
        relatedPart.file = new Blob([content], {type: relatedPart.type});
      }
    }

    for (var i = 0; i < rep.bodyInfo.attachments.length; i++) {
      var att = rep.bodyInfo.attachments[i];
      content = partMap[att.part];
      att.sizeEstimate = partSizes[att.part];
      if (content != null && partialPartKey !== att.part) {
        att.file = new Blob([content], {type: att.type});
      }
    }

    // If it's a snippet and we aren't sure that we have attachments,
    // guess based on what we know.
    if (isSnippet &&
        !rep.header.hasAttachments &&
        (safeHeader(rootNode, 'x-ms-has-attach') ||
         /multipart\/mixed/.test(rootNode.contentType.value) ||
         estSize > syncbase.POP3_INFER_ATTACHMENTS_SIZE)) {
      rep.header.hasAttachments = true;
    }

    // If we haven't downloaded the entire message, we need to have
    // some way to tell the UI that we actually haven't downloaded all
    // of the bodyReps yet. We add this fake bodyRep here, indicating
    // that it isn't fully downloaded, so that when the user triggers
    // downloadBodyReps, we actually try to fetch the message. In
    // POP3, we _don't_ know that we have all bodyReps until we've
    // downloaded the whole thing. There could be parts hidden in the
    // data we haven't downloaded yet.
    rep.bodyInfo.bodyReps.push({
      type: 'fake', // not 'text' nor 'html', so it won't be rendered
      part: 'fake',
      sizeEstimate: 0,
      amountDownloaded: 0,
      isDownloaded: !isSnippet,
      content: null,
      size: 0,
    });

    // POP3 can't display the completely-downloaded-body until we've
    // downloaded the entire message, including attachments. So
    // unfortunately, no matter how much we've already downloaded, if
    // we haven't downloaded the whole thing, we can't start from the
    // middle.
    rep.header.bytesToDownloadForBodyDisplay = (isSnippet ? estSize : 0);

    // to fill: suid, id
    return rep;
  }

  /**
   * Display a buffer in a debug-friendly printable format, with
   * CRLFs escaped for easy protocol verification.
   */
  function bufferToPrintable(line) {
    var s = '';
    if (Array.isArray(line)) {
      line.forEach(function(l) {
        s += bufferToPrintable(l) + '\n';
      });
      return s;
    }
    for (var i = 0; i < line.length; i++) {
      var c = String.fromCharCode(line[i]);
      if (c === '\r') { s += '\\r'; }
      else if (c === '\n') { s += '\\n'; }
      else { s += c; }
    }
    return s;
  }

}); // end define
;
define('pop3/sync',['logic', '../util', 'module', 'require', 'exports',
        '../mailchew', '../syncbase', '../date', '../jobmixins',
        '../allback', './pop3'],
function(logic, util, module, require, exports,
         mailchew, sync, date, jobmixins,
         allback, pop3) {

var PASTWARDS = 1;

/**
 * Manage the synchronization process for POP3 accounts. In IMAP and
 * ActiveSync, the work of this class is split in two (a `folderConn`
 * and syncer), but since POP3 has no concept of folders, the syncer
 * manages everything itself.
 *
 * This class still gets created for each folder for compatibiliy with
 * IMAP/ActiveSync, but we fast-path out of sync operations if the
 * folder we're looking at isn't the inbox.
 */
function Pop3FolderSyncer(account, storage) {
  this.account = account;
  this.storage = storage;

  logic.defineScope(this, 'Pop3FolderSyncer', {
    accountId: account.id,
    folderId: storage.folderId
  });

  // Only sync folders if this is the inbox. Other folders are client-side only.
  this.isInbox = (storage.folderMeta.type === 'inbox');
}
exports.Pop3FolderSyncer = Pop3FolderSyncer;

/**
 * Wrap a function with connection handling, as follows:
 * - If a successful connection can be established, fn gets called with
 *   a connection and the rest of the arguments. The argument at index
 *   cbIndex is wrapped to automatically call the connection `done`
 *   callback.
 * - If connection fails, the argument at index cbIndex is called with
 *   the connection error.
 *
 * @param {boolean} getNew If a fresh connection should always be made.
 * @param {int} cbIndex Index of the parent function's callback in args
 * @param {string} whyLabel Description for why we need the connection
 */
function lazyWithConnection(getNew, cbIndex, whyLabel, fn) {
  return function pop3LazyWithConnection() {
    var args = Array.slice(arguments);
    require([], function () {
      var next = function() {
        // Only the inbox actually needs a connection. Using the
        // connection in a non-inbox folder is an error.
        if (!this.isInbox) {
          fn.apply(this, [null].concat(args));
          return;
        }

        this.account.withConnection(function (err, conn, done) {
          var callback = args[cbIndex];
          if (err) {
            callback && callback(err);
          } else {
            args[cbIndex] = function lazyDone(err) {
              done();
              callback && callback(err);
            };
            fn.apply(this, [conn].concat(args));
          }
        }.bind(this), whyLabel);
      }.bind(this);

      // if we require a fresh connection, close out the old one first.
      if (getNew && this.account._conn &&
          this.account._conn.state !== 'disconnected') {
        this.account._conn.quit(next);
      } else {
        next();
      }
    }.bind(this));
  };
};

Pop3FolderSyncer.prototype = {
  syncable: true,
  get canGrowSync() {
    // Only the inbox can be grown in POP3.
    return this.isInbox;
  },

  /**
   * Given a list of messages, download snippets for those that don't
   * already have snippets. You need to pass an options argument so we
   * only download a snippet. If you don't do that, you are doing
   * something wrong. downloadBodyReps is the one that is for full
   * body part/message downloading. XXX rename this family of methods.
   */
  downloadBodies: lazyWithConnection(/* getNew = */ false, /* cbIndex = */ 2,
    /* whyLabel = */ 'downloadBodies',
  function(conn, headers, options, callback) {
    var latch = allback.latch();
    var storage = this.storage;

    for (var i = 0; i < headers.length; i++) {
      if (headers[i] && headers[i].snippet == null) {
        this.downloadBodyReps(headers[i], options, latch.defer(i));
      }
    }

    latch.then(function(results) {
      var err = null; // pull out the first error, if it exists
      for (var k in results) {
        err = results[k][0];
      }
      callback(err, headers.length);
    });
  }),

  /**
   * Download the full body of a message. POP3 does not distinguish
   * between message bodies and attachments, so we must retrieve them
   * all in one go.
   */
  downloadBodyReps: lazyWithConnection(/* getNew = */ false, /* cbIndex = */ 2,
    /* whyLabel = */ 'downloadBodyReps',
  function(conn, header, options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {};
    }

    console.log('POP3: Downloading bodyReps for UIDL ' + header.srvid);

    conn.downloadMessageByUidl(header.srvid, function(err, message) {
      if (err) { callback(err); return; }
      // Don't overwrite the header, because it contains useful
      // identifiers like `suid` and things we want. Plus, with POP3,
      // the server's headers will always be the same.
      // However, we do need header.bytesToDownloadForBodyDisplay:
      header.bytesToDownloadForBodyDisplay =
        message.header.bytesToDownloadForBodyDisplay;
      console.log('POP3: Storing message ' + header.srvid +
                  ' with ' + header.bytesToDownloadForBodyDisplay +
                  ' bytesToDownload.');
      // Force a flush if there were any attachments so that any memory-backed
      // Blobs get replaced with their post-save disk-backed equivalent so they
      // can be garbage collected.
      var flush = message.bodyInfo.attachments.length > 0;
      this.storeMessage(header, message.bodyInfo, { flush: flush }, function() {
        callback && callback(null, message.bodyInfo, flush);
      });
    }.bind(this));
  }),

  downloadMessageAttachments: function(uid, partInfos, callback, progress) {
    // We already retrieved the attachments in downloadBodyReps, so
    // this function should never be invoked (because callers would
    // have seen that all relevant partInfos have set `isDownloaded`
    // to true). Either way, there's nothing to do here.
    console.log('POP3: ERROR: downloadMessageAttachments called and ' +
                'POP3 shouldn\'t do that.');
    callback(null, null);
  },

  /**
   * Store a message. Depending on whether or not we've seen the
   * message before, we'll either add it as a new message in storage
   * or update the existing one.
   *
   * Our current POP3 implementation does not automatically delete
   * messages from the server when they've been fetched, so we need to
   * track which messages we've downloaded already and which ones are
   * new. Unfortunately, this means that our sync with the server will
   * take progressively longer as the server accumulates more messages
   * in its store.
   *
   * Some servers might potentially "window" messages, such that the
   * oldest messages in the message list might just drop off the
   * server's list. If so, this code doesn't change; new messages will
   * continue to be newly stored, and old messages will still be
   * known.
   *
   * @param {HeaderInfo} header Message header.
   * @param {BodyInfo} bodyInfo Body information, reps, etc.
   * @param {Object} options
   * @param {Boolean} options.flush Force a flush so the message gets reloaded,
   *                                replacing memory-backed Blobs with
   *                                disk-backed ones?
   * @param {function()} callback
   */
  storeMessage: function(header, bodyInfo, options, callback) {
    callback = callback || function() {};
    var event = {
      changeDetails: {}
    };

    var knownId = this.getMessageIdForUidl(header.srvid);

    if (header.id == null) { // might be zero.
      if (knownId == null) {
        header.id = this.storage._issueNewHeaderId();
      } else {
        header.id = knownId;
      }
      header.suid = this.storage.folderId + '/' + header.id;
      header.guid = header.guid || header.srvid;
    }

    // Save all included attachments before actually storing the
    // message. Downloaded attachments must be converted from a blob
    // to a file on disk.
    var latch = allback.latch();
    var self = this;

    for (var i = 0; i < bodyInfo.attachments.length; i++) {
      var att = bodyInfo.attachments[i];
      if (att.file instanceof Blob) {
        // We want to save attachments to device storage (sdcard),
        // rather than IndexedDB, for now.  It's a v3 thing to use IndexedDB
        // as a cache.
        console.log('Saving attachment', att.file);
        // Always register all POP3 downloads with the download manager since
        // the user didn't have to explicitly trigger download for each
        // attachment.
        var registerDownload = true;
        jobmixins.saveToDeviceStorage(
          self, att.file, 'sdcard', registerDownload, att.name, att,
          latch.defer());
        // When saveToDeviceStorage completes, att.file will
        // be a reference to the file on the sdcard.
      }
    }

    latch.then(function() {
      // Once the attachments have been downloaded, we can store the
      // message. Here, we wait to call back from storeMessage() until
      // we've saved _both_ the header and body.
      latch = allback.latch();

      if (knownId == null) {
        self.storeMessageUidlForMessageId(header.srvid, header.id);
        self.storage.addMessageHeader(header, bodyInfo, latch.defer());
        self.storage.addMessageBody(header, bodyInfo, latch.defer());
      } else {
        self.storage.updateMessageHeader(
          header.date, header.id, true, header, bodyInfo, latch.defer());
        event.changeDetails.attachments = range(bodyInfo.attachments.length);
        event.changeDetails.bodyReps = range(bodyInfo.bodyReps.length);
        var updateOptions = {};
        if (options.flush) {
          updateOptions.flushBecause = 'blobs';
        }
        self.storage.updateMessageBody(
          header, bodyInfo, updateOptions, event, latch.defer());
      }

      latch.then(function() {
        callback(null, bodyInfo);
      });
    });
  },

  /**
   * Return the folderMeta for the INBOX, upon which we store the
   * uidlMap and overflowMap. Cache it for performance, since this
   * function gets invoked frequently.
   */
  get inboxMeta() {
    // Override this getter to provide direct access in the future.
    return (this.inboxMeta = this.account.getFolderMetaForFolderId(
      this.account.getFirstFolderWithType('inbox').id));
  },

  /**
   * Retrieve the message's id (header.id) given a server's UIDL.
   *
   * CAUTION: Zero is a valid message ID. I made the mistake of doing
   * boolean comparisons on header IDs and that is a BAD IDEA. <3
   * Hence the `== null` checks in a few places in this file.
   */
  getMessageIdForUidl: function(uidl) {
    if (uidl == null) {
      return null;
    }
    this.inboxMeta.uidlMap = this.inboxMeta.uidlMap || {};
    return this.inboxMeta.uidlMap[uidl];
  },

  /**
   * Store the given message UIDL so that we know it has already been
   * downloaded. If the message was previously marked as overflow,
   * remove it from the overflow map because we know about it now.
   */
  storeMessageUidlForMessageId: function(uidl, headerId) {
    this.inboxMeta.uidlMap = this.inboxMeta.uidlMap || {};
    this.inboxMeta.uidlMap[uidl] = headerId;
    if (this.inboxMeta.overflowMap) {
      delete this.inboxMeta.overflowMap[uidl];
    }
  },

  /**
   * Mark the given message UIDL as being an "overflow message"; that
   * is, it was NOT downloaded and should be made available to
   * download during a "download more messages..." operation.
   *
   * This data is stored in INBOX's folderMeta like so:
   *
   * overflowMap: {
   *   "(message uidl)": { size: 0 },
   *   ...
   * }
   */
  storeOverflowMessageUidl: function(uidl, size) {
    this.inboxMeta.overflowMap = this.inboxMeta.overflowMap || {};
    this.inboxMeta.overflowMap[uidl] = { size: size };
  },

  /**
   * Return true if there are overflow messages. (If so, we're NOT
   * synced to the dawn of time.)
   */
  hasOverflowMessages: function() {
    if (!this.inboxMeta.overflowMap) { return false; }
    for (var key in this.inboxMeta.overflowMap) {
      return true; // if there's even a single key, we have some!
    }
    return false;
  },

  /**
   * Return whether or not the given UIDL is in the overflow map.
   */
  isUidlInOverflowMap: function(uidl) {
    if (!this.inboxMeta.overflowMap) { return false; }
    return !!this.inboxMeta.overflowMap[uidl];
  },

  /**
   * Sync the inbox for the first time. Since we set `ignoreHeaders`
   * to true, we'll notify mail slices to update after the entire sync
   * completes, so that all messages show up at once rather than one
   * at a time.
   */
  initialSync: function(slice, initialDays, syncCb, doneCb, progressCb) {
    syncCb('sync', true /* ignoreHeaders */);
    this.sync('initial', slice, doneCb, progressCb);
  },

  /**
   * Sync the inbox for a refresh. This is the same as initialSync for
   * POP3, except that we notify slices immediately upon receiving
   * each new message individually.
   */
  refreshSync: function(
      slice, dir, startTS, endTS, origStartTS, doneCb, progressCb) {
    this.sync('refresh', slice, doneCb, progressCb);
  },

  /**
   * The unit tests issue "delete on server but not locally" commands.
   * In order to mimic operations where we modify non-INBOX folders on
   * the server and expect to learn about them from the client on
   * sync, we queue up "server-only" modifications and execute them
   * upon sync. This allows us to reuse much of the existing tests for
   * certain folder operations, and becomes a no-op in production.
   *
   * @return {Boolean} true if a save is needed because we're actually doing
   * something.
   */
  _performTestAdditionsAndDeletions: function(cb) {
    var meta = this.storage.folderMeta;
    var numAdds = 0;
    var latch = allback.latch();
    var saveNeeded = false;
    if (meta._TEST_pendingHeaderDeletes) {
      meta._TEST_pendingHeaderDeletes.forEach(function(namer) {
        saveNeeded = true;
        this.storage.deleteMessageHeaderAndBody(namer.suid, namer.date,
                                                latch.defer());
      }, this);
      meta._TEST_pendingHeaderDeletes = null;
    }
    if (meta._TEST_pendingAdds) {
      meta._TEST_pendingAdds.forEach(function(msg) {
        saveNeeded = true;
        this.storeMessage(msg.header, msg.bodyInfo, {}, latch.defer());
      }, this);
      meta._TEST_pendingAdds = null;
    }
    latch.then(function(results) { cb(); });
    return saveNeeded;
  },

  /**
   * If we have overflow messages, fetch them here.
   */
  growSync: function(slice, growthDirection, anchorTS, syncStepDays,
                     doneCallback, progressCallback) {
    if (growthDirection !== PASTWARDS || !this.hasOverflowMessages()) {
      return false;
    }

    // For simplicity, we ignore anchorTS and syncStepDays, because
    // POP3's limitations make it difficult to infer anything about
    // the messages we're going to download now. All we can do here is
    // download another batch of overflow messages.
    this.sync('grow', slice, doneCallback, progressCallback);
    return true;
  },

  allConsumersDead: function() {
    // Nothing to do here.
  },

  shutdown: function() {
    // Nothing to do here either.
  },

  /**
   * Pull down new headers from the server, attempting to fetch
   * snippets for the messages.
   *
   * Pop3Client (in pop3.js) contains the variables used to determine
   * how much of each message to fetch. Since POP3 only lets us
   * download a certain number of _lines_ from the message, Pop3Client
   * selects an appropriate snippet size (say, 4KB) and attempts to
   * fetch approximately that much data for each message. That value
   * is/should be high enough that we get snippets for nearly all
   * messages, unless a message is particularly strange.
   *
   * Additionally, we don't delete messages from the server. This
   * means that when we attempt to list messages, we'll see new
   * messages along with messages we've seen before. To ensure we only
   * retrieve messages we don't know about, we keep track of message
   * unique IDs (UIDLs) and only download new messages.
   *
   * OVERFLOW MESSAGE HANDLING:
   *
   * We don't want to overwhelm a sync with a ridiculous number of
   * messages if the spool has a lot of new messagse. Instead of
   * blindly downloading all headers right away, we store excess
   * "overflow" messages for future "grow" syncs, e.g. when the user
   * clicks "Get More Messages" in the message list.
   *
   * This works as follows:
   *
   * If we're syncing normally, mark any excess messages as overflow
   * messages and don't download them. This is handled largely by
   * Pop3Client by the maxMessages option to listMessages(). We ignore
   * any messages already marked as overflow for the purposes of the
   * sync filter.
   *
   * If this is a grow sync, i.e. we want to download some overflow
   * messages, we set the download filter to _only_ include overflow
   * UIDLs. We may still have _more_ overflow messages, but that's
   * okay, because they'll just be stored in the overflowMap like
   * normal, for a future "grow" sync. Any messages we do download are
   * marked as stored and removed from the overflowMap (in
   * `this.storeMessageUidlForMessageId`).
   */
  sync: lazyWithConnection(/* getNew = */ true, /* cbIndex = */ 2,
  /* whyLabel = */ 'sync',
  function(conn, syncType, slice, realDoneCallback, progressCallback) {
    // if we could not establish a connection, abort the sync.
    var self = this;
    logic(self, 'sync:begin', { syncType: syncType });

    // Avoid invoking realDoneCallback multiple times.  Cleanup when we switch
    // sync to promises/tasks.
    var doneFired = false;
    var doneCallback = function(err) {
      if (doneFired) {
        logic(self, 'sync:duplicateDone', { syncType: syncType, err: err });
        return;
      }
      logic(self, 'sync:end', { syncType: syncType, err: err });
      doneFired = true;
      // coerce the rich error object to a string error code; currently
      // refreshSlice only likes 'unknown' and 'aborted' so just run with
      // unknown.
      realDoneCallback(err ? 'unknown' : null);
    };

    // Only fetch info for messages we don't already know about.
    var filterFunc;
    if (syncType !== 'grow') {
      // In a regular sync, download any message that we don't know
      // about that isn't in the overflow map.
      filterFunc = function(uidl) {
        return self.getMessageIdForUidl(uidl) == null && // might be 0
          !self.isUidlInOverflowMap(uidl);
      };
    } else /* (syncType === 'grow') */ {
      // In a 'grow' sync, ONLY download overflow messages.
      filterFunc = this.isUidlInOverflowMap.bind(this);
    }

    var bytesStored = 0;
    var numMessagesSynced = 0;
    var latch = allback.latch();
    // We only want to trigger a save if work is actually being done.  This is
    // ugly/complicated because in order to let POP3 use the existing IMAP tests
    // that did things in other folders, a test-only bypass route was created
    // that has us actually add the messages
    var saveNeeded;

    if (!this.isInbox) {
      slice.desiredHeaders = (this._TEST_pendingAdds &&
                              this._TEST_pendingAdds.length);
      saveNeeded = this._performTestAdditionsAndDeletions(latch.defer());
    } else {
      saveNeeded = true;
      logic(this, 'sync_begin');
      var fetchDoneCb = latch.defer();

      var closeExpected = false;
      // register for a close notification so if disaster recovery closes the
      // connection we still get a chance to report the error without breaking
      // sync.  This is the lowest priority onclose handler so all the other
      // more specific error handlers will get a chance to fire.  However, some
      // like to defer to future turns of the event loop so we we use setTimeout
      // to defer through at least two turns of the event loop.
      conn.onclose = function() {
        if (closeExpected) {
          return;
        }
        closeExpected = true;
        // see the above.  This is horrible but we hate POP3 and these error
        // handling cases are edge-casey and this actually does improve our test
        // coverage.  (test_pop3_dead_connection.js's first two test clauses
        // were written before I added this onclose handler.)
        window.setTimeout(function() {
          window.setTimeout(function() {
            doneCallback('closed');
          }, 0);
        }, 0);
      };
      // Fetch messages, ensuring that we don't actually store them all in
      // memory so as not to burden memory unnecessarily.
      conn.listMessages({
        filter: filterFunc,
        checkpointInterval: sync.POP3_SAVE_STATE_EVERY_N_MESSAGES,
        maxMessages: sync.POP3_MAX_MESSAGES_PER_SYNC,
        checkpoint: function(next) {
          // Every N messages, wait for everything to be stored to
          // disk and saved in the database. Then proceed.
          this.account.__checkpointSyncCompleted(next, 'syncBatch');
        }.bind(this),
        progress: function fetchProgress(evt) {
          // Store each message as it is retrieved.
          var totalBytes = evt.totalBytes;
          var message = evt.message;
          var messageCb = latch.defer();

          this.storeMessage(message.header, message.bodyInfo, {}, function() {
            bytesStored += evt.size;
            numMessagesSynced++;
            progressCallback(0.1 + 0.7 * bytesStored / totalBytes);
            messageCb();
          });
        }.bind(this),
      }, function fetchDone(err, numSynced, overflowMessages) {
        // Upon downloading all of the messages, we MUST issue a QUIT
        // command. This will tear down the connection, however if we
        // don't, we will never receive notifications of new messages.
        // If we deleted any messages on the server (which we don't),
        // the QUIT command is what would actually cause those to be
        // persisted. In the future, when we support server-side
        // deletion, we should ensure that this QUIT does not
        // inadvertently commit unintended deletions.
        closeExpected = true;
        conn.quit();

        if (err) {
          doneCallback(err);
          return;
        }

        // If there were excess messages, mark them for later download.
        if (overflowMessages.length) {
          overflowMessages.forEach(function(message) {
            this.storeOverflowMessageUidl(message.uidl, message.size);
          }, this);
          logic(this, 'overflowMessages', { count: overflowMessages.length });
        }

        // When all of the messages have been persisted to disk, indicate
        // that we've successfully synced. Refresh our view of the world.
        fetchDoneCb();
      }.bind(this));
    }

    latch.then((function onSyncDone() {
      // Because POP3 has no concept of syncing discrete time ranges,
      // we have to trick the storage into marking everything synced
      // _except_ the dawn of time. This has to be slightly later than
      // a value that would be interpreted as the dawn of time -- in
      // this case, it has to be one day plus one. Ideally, this
      // should be abstracted a little better; it's mostly IMAP that
      // needs more involved logic.
      this.storage.markSyncRange(
        sync.OLDEST_SYNC_DATE + date.DAY_MILLIS + 1,
        date.NOW(), 'XXX', date.NOW());

      if (!this.hasOverflowMessages()) {
        this.storage.markSyncedToDawnOfTime();
      }

      if (this.isInbox) {
        logic(this, 'sync_end');
      }
      // Don't notify completion until the save completes, if relevant.
      if (saveNeeded) {
        this.account.__checkpointSyncCompleted(doDoneStuff, 'syncComplete');
      } else {
        doDoneStuff();
      }
    }).bind(this));

    var doDoneStuff = function() {
      if (syncType === 'initial') {
        // If it's the first time we've synced, we've set
        // ignoreHeaders to true, which means that slices don't know
        // about new messages. We'll reset ignoreHeaders to false
        // here, and then instruct the database to load messages
        // again.
        //
        // We're waiting for the database to settle. Since POP3
        // doesn't guarantee message ordering (in terms of listing
        // messages in your maildrop), if we just blindly updated the
        // current slice, the UI might frantically update as new
        // messages come in. So for the initial sync, just batch them
        // all in.
        this.storage._curSyncSlice.ignoreHeaders = false;
        this.storage._curSyncSlice.waitingOnData = 'db';
        this.storage.getMessagesInImapDateRange(
          sync.OLDEST_SYNC_DATE, null,
          sync.INITIAL_FILL_SIZE, sync.INITIAL_FILL_SIZE,
          // Don't trigger a refresh; we just synced. Accordingly,
          // releaseMutex can be null.
          this.storage.onFetchDBHeaders.bind(
            this.storage, this.storage._curSyncSlice,
            false, doneCallback, null));
      } else {
        doneCallback(null);
      }
    }.bind(this);
  }),
};

/** Return an array with the integers [0, end). */
function range(end) {
  var ret = [];
  for (var i = 0; i < end; i++) {
    ret.push(i);
  }
  return ret;
}


}); // end define
;
define('pop3/jobs',['module', 'exports', 'logic', '../allback', 'mix',
        '../jobmixins', '../drafts/jobs', './pop3'],
       function(module, exports, logic, allback, mix,
                jobmixins, draftsJobs, pop3) {

/**
 * Manage the jobs for a POP3 account. POP3 does not support
 * server-side folders, so many of these operations are local-only.
 * Operations not implemented in the Pop3JobDriver are ignored and
 * assumed unsupported. For instance, issuing a "move" command will
 * execute local_do_move, but not do_move. It is assumed that unit
 * tests will ensure we've implemented all required jobs.
 */
function Pop3JobDriver(account, state) {
  this.account = account;
  this.resilientServerIds = true; // once assigned, the server never changes IDs
  this._heldMutexReleasers = [];

  logic.defineScope(this, 'Pop3JobDriver', { accountId: account.id });

  // For tracking state as used in jobmixins:
  this._stateDelta = {};
  this._state = state;
  if (!state.hasOwnProperty('suidToServerId')) {
    state.suidToServerId = {};
    state.moveMap = {};
  }
}
exports.Pop3JobDriver = Pop3JobDriver;
Pop3JobDriver.prototype = {

  /**
   * Request access to a POP3 folder for mutation. This acquires a
   * write mutex on the FolderStorage. The callback will be invoked
   * with the folder and the raw connection.
   *
   * There is no need to explicitly release the connection when done;
   * it will be automatically released when the mutex is released if
   * desirable.
   *
   * This function is used by jobmixins.
   */
  _accessFolderForMutation: function(
      folderId, needConn, callback, deathback, label) {
    var storage = this.account.getFolderStorageForFolderId(folderId);
    storage.runMutexed(label, function(releaseMutex) {
      this._heldMutexReleasers.push(releaseMutex);
      try {
        // The folderSyncer is like IMAP/ActiveSync's folderConn.
        callback(storage.folderSyncer, storage);
      } catch (ex) {
        logic(this, 'callbackErr', { ex: ex });
      }
    }.bind(this));
  },

  /**
   * Create a folder locally. (Again, no remote folders, so
   * do_createFolder is not implemented.)
   */
  local_do_createFolder: function(op, callback) {
    var path, delim, parentFolderId = null, depth = 0;

    if (op.parentFolderId) {
      if (!this.account._folderInfos.hasOwnProperty(op.parentFolderId)) {
        throw new Error("No such folder: " + op.parentFolderId);
      }
      var parentFolder = this.account._folderInfos[op.parentFolderId];
      delim = parentFolder.$meta.delim;
      path = parentFolder.$meta.path + delim;
      parentFolderId = parentFolder.$meta.id;
      depth = parentFolder.depth + 1;
    }
    else {
      path = '';
      delim = '/';
    }

    if (typeof(op.folderName) === 'string')
      path += op.folderName;
    else
      path += op.folderName.join(delim);
    if (op.containOnlyOtherFolders) {
      path += delim;
    }

    if (this.account.getFolderByPath(path)) {
      callback(null);
    } else {
      var folderMeta = self.account._learnAboutFolder(
          op.folderName, path, parentFolderId, 'normal', delim, depth);
      callback(null, folderMeta);
    }
  },

  /**
   * Delete old messages from disk. Since we currently leave mail on
   * the server, we won't incur permanent data loss.
   */
  local_do_purgeExcessMessages: function(op, callback) {
    this._accessFolderForMutation(
      op.folderId, false,
      function withMutex(_ignoredConn, storage) {
        storage.purgeExcessMessages(function(numDeleted, cutTS) {
          // Indicate that we want a save performed if any messages got deleted.
          callback(null, null, numDeleted > 0);
        });
      },
      null,
      'purgeExcessMessages');
  },

  local_do_saveSentDraft: function(op, callback) {
    var self = this;
    this._accessFolderForMutation(
      op.folderId, /* needConn*/ false,
      function(nullFolderConn, folderStorage) {
        var latch = allback.latch();

        folderStorage.addMessageHeader(op.headerInfo, op.bodyInfo,
                                       latch.defer());
        folderStorage.addMessageBody(op.headerInfo, op.bodyInfo, latch.defer());

        latch.then(function(results) {
          // header/body insertion can't fail
          callback(null, null, /* save */ true);
        });
      },
      /* no conn => no deathback required */ null,
      'saveSentDraft');
  },

  do_syncFolderList: function(op, doneCallback) {
    this.account.meta.lastFolderSyncAt = Date.now();
    doneCallback(null);
  },

  /** No-op to silence warnings. Perhaps implement someday. */
  do_modtags: function(op, doneCallback) {
    doneCallback(null);
  },

  /** No-op to silence warnings. Perhaps implement someday. */
  undo_modtags: function(op, doneCallback) {
    doneCallback(null);
  },

  // Local modifications (move, delete, and modtags) simply reuse the
  // jobmixins implementation. No server-side implementations are
  // necessary here, so they are omitted.
  local_do_modtags: jobmixins.local_do_modtags,
  local_undo_modtags: jobmixins.local_undo_modtags,
  local_do_move: jobmixins.local_do_move,
  local_undo_move: jobmixins.local_undo_move,
  local_do_delete: jobmixins.local_do_delete,
  local_undo_delete: jobmixins.local_undo_delete,

  // Download operations (for attachments) are irrelevant because
  // downloading the bodies always fetches the attachments too.

  local_do_downloadBodies: jobmixins.local_do_downloadBodies,
  do_downloadBodies: jobmixins.do_downloadBodies,
  check_downloadBodies: jobmixins.check_downloadBodies,

  check_downloadBodyReps: jobmixins.check_downloadBodyReps,
  do_downloadBodyReps: jobmixins.do_downloadBodyReps,
  local_do_downloadBodyReps: jobmixins.local_do_downloadBodyReps,


  local_do_sendOutboxMessages: jobmixins.local_do_sendOutboxMessages,
  do_sendOutboxMessages: jobmixins.do_sendOutboxMessages,
  check_sendOutboxMessages: jobmixins.check_sendOutboxMessages,
  local_undo_sendOutboxMessages: jobmixins.local_undo_sendOutboxMessages,
  undo_sendOutboxMessages: jobmixins.undo_sendOutboxMessages,
  local_do_setOutboxSyncEnabled: jobmixins.local_do_setOutboxSyncEnabled,

  local_do_upgradeDB: jobmixins.local_do_upgradeDB,

  // These utility functions are necessary.
  postJobCleanup: jobmixins.postJobCleanup,
  allJobsDone: jobmixins.allJobsDone,
  _partitionAndAccessFoldersSequentially:
      jobmixins._partitionAndAccessFoldersSequentially
};

mix(Pop3JobDriver.prototype, draftsJobs.draftsMixins);

}); // end define
;
define('pop3/account',[
  'logic',
  '../errbackoff',
  '../composite/incoming',
  './sync',
  '../errorutils',
  './jobs',
  '../drafts/draft_rep',
  '../disaster-recovery',
  'module',
  'require',
  'exports'],
function(
  logic,
  errbackoff,
  incoming,
  pop3sync,
  errorutils,
  pop3jobs,
  draftRep,
  DisasterRecovery,
  module,
  require,
  exports
) {

var CompositeIncomingAccount = incoming.CompositeIncomingAccount;

/**
 * Define a POP3 account. Much of the functionality here is similar
 * to IMAP; Pop3Account inherits the shared parts from
 * CompositeIncomingAccount.
 */
function Pop3Account(universe, compositeAccount, accountId, credentials,
                     connInfo, folderInfos, dbConn, existingProtoConn) {
  logic.defineScope(this, 'Account', { accountId: accountId,
                                       accountType: 'pop3' });

  CompositeIncomingAccount.apply(
      this, [pop3sync.Pop3FolderSyncer].concat(Array.slice(arguments)));

  // Set up connection information. We can't make much use of
  // connection pooling since the POP3 protocol only allows one client
  // to access a mailbox at a given time, so there's no connection pool.
  this._conn = null;
  this._pendingConnectionRequests = [];
  this._backoffEndpoint = errbackoff.createEndpoint('pop3:' + this.id, this);

  // If we have an existing connection from setting up the account, we
  // can reuse that during the first sync.
  if (existingProtoConn) {
    DisasterRecovery.associateSocketWithAccount(
      existingProtoConn.socket, this);
    this._conn = existingProtoConn;
  }

  // Immediately ensure that we have any required local-only folders,
  // as those can be created even while offline.
  this.ensureEssentialOfflineFolders();

  this._jobDriver = new pop3jobs.Pop3JobDriver(
      this, this._folderInfos.$mutationState);
}
exports.Account = exports.Pop3Account = Pop3Account;
Pop3Account.prototype = Object.create(CompositeIncomingAccount.prototype);
var properties = {
  type: 'pop3',
  supportsServerFolders: false,
  toString: function() {
    return '[Pop3Account: ' + this.id + ']';
  },

  /**
   * Call the callback with a live, authenticated connection. Clients
   * should call done() when finished with the connection. (In our
   * case, pop3/sync.js has a lazyWithConnection wrapper which
   * abstracts the `done` callback.)
   * @param {function(err, conn, done)} cb
   */
  withConnection: function(cb, whyLabel) {
    // This implementation serializes withConnection requests so that
    // we don't step on requests' toes. While Pop3Client wouldn't mix
    // up the requests themselves, interleaving different operations
    // could result in undesired consequences.
    this._pendingConnectionRequests.push(cb);
    var done = function() {
      var req = this._pendingConnectionRequests.shift();
      if (req) {
        var next = function(err) {
          if (err) {
            req(err);
            done();
          } else {
            req(null, this._conn, done);
          }
        }.bind(this);
        if (!this._conn || this._conn.state === 'disconnected') {
          this._makeConnection(next, whyLabel);
        } else {
          next();
        }
      }
    }.bind(this);

    if (this._pendingConnectionRequests.length === 1) {
      done();
    }
  },

  /** @override */
  __folderDoneWithConnection: function(conn) {
    // IMAP uses this function to perform folder-specific connection cleanup.
    // We don't need to do anything here.
  },

  /**
   * Create a new POP3 connection, and call the callback when we
   * have established the connection (or with an error if we failed).
   * Since POP3 only uses one connection at a time, this function also
   * assigns the given connection to this._conn.
   *
   * Don't use this function directly; instead use `withConnection` or
   * a higher-level wrapper.
   *
   * @param {function(err, conn)} callback
   * @param {String} whyLabel A descriptive name for the connection.
   */
  _makeConnection: function(callback, whyLabel) {
    // Mark a pending connection synchronously; the require call will
    // not return until at least the next turn of the event loop, so
    // we need to know that there's a pending connection request in
    // progress.
    this._conn = true;
    // Dynamically load the probe/pop3 code to speed up startup.
    require(['./pop3', './probe'], function(pop3, pop3probe) {
      logic(this, 'createConnection', { label: whyLabel });
      var opts = {
        host: this._connInfo.hostname,
        port: this._connInfo.port,
        crypto: this._connInfo.crypto,

        preferredAuthMethod: this._connInfo.preferredAuthMethod,

        username: this._credentials.username,
        password: this._credentials.password,
      };

      var conn = this._conn = new pop3.Pop3Client(opts, function(err) {
        if (err) {
          // Failed to get the connection:
          console.error('Connect error:', err.name, 'formal:', err, 'on',
                        this._connInfo.hostname, this._connInfo.port);

          err = pop3probe.normalizePop3Error(err);

          if (errorutils.shouldReportProblem(err)) {
            this.universe.__reportAccountProblem(
              this.compositeAccount, err, 'incoming');
          }

          callback && callback(err, null);
          conn.close();

          // Track this failure for backoff purposes.
          if (errorutils.shouldRetry(err)) {
            if (this._backoffEndpoint.noteConnectFailureMaybeRetry(
              errorutils.wasErrorFromReachableState(err))) {
              this._backoffEndpoint.scheduleConnectAttempt(
                this._makeConnection.bind(this));
             } else {
               this._backoffEndpoint.noteBrokenConnection();
            }
          } else {
            this._backoffEndpoint.noteBrokenConnection();
          }
        }
        // Succeeded:
        else {
          this._backoffEndpoint.noteConnectSuccess();
          callback && callback(null, conn);
        }
      }.bind(this));

      DisasterRecovery.associateSocketWithAccount(conn.socket, this);
    }.bind(this));
  },

  /**
   * Save an attachment-stripped version of the sent draft to our sent folder.
   */
  saveSentMessage: function(composer) {
    var sentFolder = this.getFirstFolderWithType('sent');
    if (!sentFolder) {
      return;
    }

    var sentStorage = this.getFolderStorageForFolderId(sentFolder.id);
    var id = sentStorage._issueNewHeaderId();
    var suid = sentStorage.folderId + '/' + id;

    var sentPieces = draftRep.cloneDraftMessageForSentFolderWithoutAttachments(
      composer.header, composer.body, { id: id, suid: suid });

    this.universe.saveSentDraft(sentFolder.id,
                                sentPieces.header, sentPieces.body);
  },

  /**
   * Delete the given folder. (This always happens locally.)
   */
  deleteFolder: function(folderId, callback) {
    if (!this._folderInfos.hasOwnProperty(folderId)) {
      throw new Error("No such folder: " + folderId);
    }
    var folderMeta = this._folderInfos[folderId].$meta;
    logic(self, 'deleteFolder', { path: folderMeta.path });
    self._forgetFolder(folderId);
    callback && callback(null, folderMeta);
  },

  /**
   * Shut down the account and close the connection.
   */
  shutdown: function(callback) {
    CompositeIncomingAccount.prototype.shutdownFolders.call(this);

    this._backoffEndpoint.shutdown();

    if (this._conn && this._conn.close) {
      this._conn.close();
    }
    callback && callback();
  },

  /**
   * Attempt to create a new, authenticated connection using the
   * current credentials. If a current connection is already
   * established, terminates the existing connection first.
   *
   * @param {function(err)} callback
   */
  checkAccount: function(callback) {
    // Disconnect first so as to properly check credentials.
    if (this._conn !== null) {
      if (this._conn.state !== 'disconnected') {
        this._conn.close();
      }
      this._conn = null;
    }
    logic(this, 'checkAccount_begin');
    this.withConnection(function(err) {
      logic(this, 'checkAccount_end', { error: err });
      callback(err);
    }.bind(this), 'checkAccount');
  },

  /**
   * Ensure that local-only folders exist. This is run immediately
   * upon account initialization. Since POP3 doesn't support server
   * folders, all folders are local-only, so this function does all
   * the hard work.
   */
  ensureEssentialOfflineFolders: function() {
    // Create required folders if necessary.
    [ 'sent', 'localdrafts', 'trash', 'outbox' ].forEach(function(folderType) {
      if (!this.getFirstFolderWithType(folderType)) {
        this._learnAboutFolder(
          /* name: */ folderType,
          /* path: */ folderType,
          /* parentId: */ null,
          /* type: */ folderType,
          /* delim: */ '',
          /* depth: */ 0,
          /* suppressNotification: */ true);
      }
    }, this);
  },

  /**
   * POP3 doesn't support server folders, so all folder creation is
   * done in `ensureEssentialOfflineFolders`.

   * @param {function} callback
   *   Called immediately, for homogeneity with other account types.
   */
  ensureEssentialOnlineFolders: function(callback) {
    // All the important work is already done. Yay POP3!
    callback && callback();
  },


  /**
   * Destroy the account when the account has been deleted.
   */
  accountDeleted: function() {
    this._alive = false;
    this.shutdown();
  },

};

// Inherit Pop3Account from CompositeIncomingAccount:
// XXX: Use mix.js when it lands in the streaming patch.
for (var k in properties) {
  Object.defineProperty(Pop3Account.prototype, k,
                        Object.getOwnPropertyDescriptor(properties, k));
}


}); // end define
;
/**
 * Customized shim for browserbox to use 'slog' with configurable logging level
 * that can be cranked up.
 */
define('axeshim-smtpclient',['require','logic'],function(require) {
  var logic = require('logic');
  var scope = logic.scope('SmtpClient');

  return {
    // see axeshim-browserbox's comment about '.debug'
    debug: function(ignoredTag, msg) {
      if (!logic.isCensored) {
        logic(scope, 'debug', { msg: msg });
      }
    },
    log: function(ignoredTag, msg) {
      logic(scope, 'log', { msg: msg });
    },
    warn: function(ignoredTag, msg) {
      logic(scope, 'warn', { msg: msg });
    },
    error: function(ignoredTag, msg) {
      logic(scope, 'error', { msg: msg });
    }
  };
});

// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function(root, factory) {
    

    if (typeof define === 'function' && define.amd) {
        define('ext/smtpclient/src/smtpclient-response-parser',factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.SmtpClientResponseParser = factory();
    }
}(this, function() {
    

    /**
     * Generates a parser object for data coming from a SMTP server
     *
     * @constructor
     */
    var SmtpResponseParser = function() {

        /**
         * If the complete line is not received yet, contains the beginning of it
         */
        this._remainder = '';

        /**
         * If the response is a list, contains previous not yet emitted lines
         */
        this._block = {
            data: [],
            lines: [],
            statusCode: null
        };

        /**
         * If set to true, do not accept any more input
         */
        this.destroyed = false;
    };

    // Event handlers

    /**
     * NB! Errors do not block, the parsing and data emitting continues despite of the errors
     */
    SmtpResponseParser.prototype.onerror = function() {};
    SmtpResponseParser.prototype.ondata = function() {};
    SmtpResponseParser.prototype.onend = function() {};

    // Public API

    /**
     * Queue some data from the server for parsing. Only allowed, if 'end' has not been called yet
     *
     * @param {String} chunk Chunk of data received from the server
     */
    SmtpResponseParser.prototype.send = function(chunk) {
        if (this.destroyed) {
            return this.onerror(new Error('This parser has already been closed, "write" is prohibited'));
        }

        // Lines should always end with <CR><LF> but you never know, might be only <LF> as well
        var lines = (this._remainder + (chunk || '')).split(/\r?\n/);
        this._remainder = lines.pop(); // not sure if the line has completely arrived yet

        for (var i = 0, len = lines.length; i < len; i++) {
            this._processLine(lines[i]);
        }
    };

    /**
     * Indicate that all the data from the server has been received. Can be called only once.
     *
     * @param {String} [chunk] Chunk of data received from the server
     */
    SmtpResponseParser.prototype.end = function(chunk) {
        if (this.destroyed) {
            return this.onerror(new Error('This parser has already been closed, "end" is prohibited'));
        }

        if (chunk) {
            this.send(chunk);
        }

        if (this._remainder) {
            this._processLine(this._remainder);
        }

        this.destroyed = true;
        this.onend();
    };

    // Private API

    /**
     * Processes a single and complete line. If it is a continous one (slash after status code),
     * queue it to this._block
     *
     * @param {String} line Complete line of data from the server
     */
    SmtpResponseParser.prototype._processLine = function(line) {
        var match, response;

        // possible input strings for the regex:
        // 250-MESSAGE
        // 250 MESSAGE
        // 250 1.2.3 MESSAGE

        if (!line.trim()) {
            // nothing to check, empty line
            return;
        }

        this._block.lines.push(line);

        if ((match = line.match(/^(\d{3})([\- ])(?:(\d+\.\d+\.\d+)(?: ))?(.*)/))) {

            this._block.data.push(match[4]);

            if (match[2] === '-') {
                if (this._block.statusCode && this._block.statusCode !== Number(match[1])) {
                    this.onerror('Invalid status code ' + match[1] +
                        ' for multi line response (' + this._block.statusCode + ' expected)');
                } else if (!this._block.statusCode) {
                    this._block.statusCode = Number(match[1]);
                }
                return;
            } else {
                response = {
                    statusCode: Number(match[1]) || 0,
                    enhancedStatus: match[3] || null,
                    data: this._block.data.join('\n'),
                    line: this._block.lines.join('\n')
                };
                response.success = response.statusCode >= 200 && response.statusCode < 300;

                this.ondata(response);
                this._block = {
                    data: [],
                    lines: [],
                    statusCode: null
                };
                this._block.statusCode = null;
            }
        } else {
            this.onerror(new Error('Invalid SMTP response "' + line + '"'));
            this.ondata({
                success: false,
                statusCode: this._block.statusCode || null,
                enhancedStatus: null,
                data: [line].join('\n'),
                line: this._block.lines.join('\n')
            });
            this._block = {
                data: [],
                lines: [],
                statusCode: null
            };
        }
    };

    return SmtpResponseParser;
}));
// Copyright (c) 2013 Andris Reinman
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function(root, factory) {
    

    var encoding;

    if (typeof define === 'function' && define.amd) {
        // AMD in browser environment
        define('ext/smtpclient/src/smtpclient',['tcp-socket', 'stringencoding', 'axe', './smtpclient-response-parser'], function(TCPSocket, encoding, axe, SmtpClientResponseParser) {
            return factory(TCPSocket, encoding.TextEncoder, encoding.TextDecoder, axe, SmtpClientResponseParser, window.btoa);
        });
    } else if (typeof exports === 'object' && typeof navigator !== 'undefined') {
        // common.js in browser environment
        encoding = require('wo-stringencoding');
        module.exports = factory(require('tcp-socket'), encoding.TextEncoder, encoding.TextDecoder, require('axe-logger'), require('./smtpclient-response-parser'), btoa);
    } else if (typeof exports === 'object') {
        // node.js
        encoding = require('wo-stringencoding');
        module.exports = factory(require('tcp-socket'), encoding.TextEncoder, encoding.TextDecoder, require('axe-logger'), require('./smtpclient-response-parser'), function(str) {
            var NodeBuffer = require('buffer').Buffer;
            return new NodeBuffer(str, 'binary').toString("base64");
        });
    } else {
        // browser global
        navigator.TCPSocket = navigator.TCPSocket || navigator.mozTCPSocket;
        root.SmtpClient = factory(navigator.TCPSocket, root.TextEncoder, root.TextDecoder, root.axe, root.SmtpClientResponseParser, window.btoa);
    }
}(this, function(TCPSocket, TextEncoder, TextDecoder, axe, SmtpClientResponseParser, btoa) {
    

    var DEBUG_TAG = 'SMTP Client';

    /**
     * Creates a connection object to a SMTP server and allows to send mail through it.
     * Call `connect` method to inititate the actual connection, the constructor only
     * defines the properties but does not actually connect.
     *
     * NB! The parameter order (host, port) differs from node.js "way" (port, host)
     *
     * @constructor
     *
     * @param {String} [host="localhost"] Hostname to conenct to
     * @param {Number} [port=25] Port number to connect to
     * @param {Object} [options] Optional options object
     * @param {Boolean} [options.useSecureTransport] Set to true, to use encrypted connection
     * @param {String} [options.name] Client hostname for introducing itself to the server
     * @param {Object} [options.auth] Authentication options. Depends on the preferred authentication method. Usually {user, pass}
     * @param {String} [options.authMethod] Force specific authentication method
     * @param {Boolean} [options.disableEscaping] If set to true, do not escape dots on the beginning of the lines
     */
    function SmtpClient(host, port, options) {
        this._TCPSocket = TCPSocket;

        this.options = options || {};

        this.port = port || (this.options.useSecureTransport ? 465 : 25);
        this.host = host || 'localhost';

        /**
         * If set to true, start an encrypted connection instead of the plaintext one
         * (recommended if applicable). If useSecureTransport is not set but the port used is 465,
         * then ecryption is used by default.
         */
        this.options.useSecureTransport = 'useSecureTransport' in this.options ? !!this.options.useSecureTransport : this.port === 465;

        /**
         * Authentication object. If not set, authentication step will be skipped.
         */
        this.options.auth = this.options.auth || false;

        /**
         * Hostname of the client, this will be used for introducing to the server
         */
        this.options.name = this.options.name || false;

        /**
         * Downstream TCP socket to the SMTP server, created with mozTCPSocket
         */
        this.socket = false;

        /**
         * Indicates if the connection has been closed and can't be used anymore
         *
         */
        this.destroyed = false;

        /**
         * Informational value that indicates the maximum size (in bytes) for
         * a message sent to the current server. Detected from SIZE info.
         * Not available until connection has been established.
         */
        this.maxAllowedSize = 0;

        /**
         * Keeps track if the downstream socket is currently full and
         * a drain event should be waited for or not
         */
        this.waitDrain = false;

        // Private properties

        /**
         * SMTP response parser object. All data coming from the downstream server
         * is feeded to this parser
         */
        this._parser = new SmtpClientResponseParser();

        /**
         * If authenticated successfully, stores the username
         */
        this._authenticatedAs = null;

        /**
         * A list of authentication mechanisms detected from the EHLO response
         * and which are compatible with this library
         */
        this._supportedAuth = [];

        /**
         * If true, accepts data from the upstream to be passed
         * directly to the downstream socket. Used after the DATA command
         */
        this._dataMode = false;

        /**
         * Keep track of the last bytes to see how the terminating dot should be placed
         */
        this._lastDataBytes = '';

        /**
         * Envelope object for tracking who is sending mail to whom
         */
        this._envelope = null;

        /**
         * Stores the function that should be run after a response has been received
         * from the server
         */
        this._currentAction = null;

        /**
         * Indicates if the connection is secured or plaintext
         */
        this._secureMode = !!this.options.useSecureTransport;
    }

    //
    // EVENTS
    //

    // Event functions should be overriden, these are just placeholders

    /**
     * Will be run when an error occurs. Connection to the server will be closed automatically,
     * so wait for an `onclose` event as well.
     *
     * @param {Error} err Error object
     */
    SmtpClient.prototype.onerror = function() {};

    /**
     * More data can be buffered in the socket. See `waitDrain` property or
     * check if `send` method returns false to see if you should be waiting
     * for the drain event. Before sending anything else.
     */
    SmtpClient.prototype.ondrain = function() {};

    /**
     * The connection to the server has been closed
     */
    SmtpClient.prototype.onclose = function() {};

    /**
     * The connection is established and idle, you can send mail now
     */
    SmtpClient.prototype.onidle = function() {};

    /**
     * The connection is waiting for the mail body
     *
     * @param {Array} failedRecipients List of addresses that were not accepted as recipients
     */
    SmtpClient.prototype.onready = function() {};

    /**
     * The mail has been sent.
     * Wait for `onidle` next.
     *
     * @param {Boolean} success Indicates if the message was queued by the server or not
     */
    SmtpClient.prototype.ondone = function() {};

    //
    // PUBLIC METHODS
    //

    // Connection related methods

    /**
     * Initiate a connection to the server
     */
    SmtpClient.prototype.connect = function() {
        if (!this.options.name && 'getHostname' in this._TCPSocket && typeof this._TCPSocket.getHostname === 'function') {
            this._TCPSocket.getHostname(function(err, hostname) {
                this.options.name = hostname || 'localhost';
                this.connect();
            }.bind(this));
            return;
        } else if (!this.options.name) {
            this.options.name = 'localhost';
        }

        this.socket = this._TCPSocket.open(this.host, this.port, {
            binaryType: 'arraybuffer',
            useSecureTransport: this._secureMode,
            ca: this.options.ca,
            tlsWorkerPath: this.options.tlsWorkerPath
        });

        // allows certificate handling for platform w/o native tls support
        // oncert is non standard so setting it might throw if the socket object is immutable
        try {
            this.socket.oncert = this.oncert;
        } catch (E) {}
        this.socket.onerror = this._onError.bind(this);
        this.socket.onopen = this._onOpen.bind(this);
    };

    /**
     * Pauses `data` events from the downstream SMTP server
     */
    SmtpClient.prototype.suspend = function() {
        if (this.socket && this.socket.readyState === 'open') {
            this.socket.suspend();
        }
    };

    /**
     * Resumes `data` events from the downstream SMTP server. Be careful of not
     * resuming something that is not suspended - an error is thrown in this case
     */
    SmtpClient.prototype.resume = function() {
        if (this.socket && this.socket.readyState === 'open') {
            this.socket.resume();
        }
    };

    /**
     * Sends QUIT
     */
    SmtpClient.prototype.quit = function() {
        axe.debug(DEBUG_TAG, 'Sending QUIT...');
        this._sendCommand('QUIT');
        this._currentAction = this.close;
    };

    /**
     * Reset authentication
     *
     * @param {Object} [auth] Use this if you want to authenticate as another user
     */
    SmtpClient.prototype.reset = function(auth) {
        this.options.auth = auth || this.options.auth;
        axe.debug(DEBUG_TAG, 'Sending RSET...');
        this._sendCommand('RSET');
        this._currentAction = this._actionRSET;
    };

    /**
     * Closes the connection to the server
     */
    SmtpClient.prototype.close = function() {
        axe.debug(DEBUG_TAG, 'Closing connection...');
        if (this.socket && this.socket.readyState === 'open') {
            this.socket.close();
        } else {
            this._destroy();
        }
    };

    // Mail related methods

    /**
     * Initiates a new message by submitting envelope data, starting with
     * `MAIL FROM:` command. Use after `onidle` event
     *
     * @param {Object} envelope Envelope object in the form of {from:"...", to:["..."]}
     */
    SmtpClient.prototype.useEnvelope = function(envelope) {
        this._envelope = envelope || {};
        this._envelope.from = [].concat(this._envelope.from || ('anonymous@' + this.options.name))[0];
        this._envelope.to = [].concat(this._envelope.to || []);

        // clone the recipients array for latter manipulation
        this._envelope.rcptQueue = [].concat(this._envelope.to);
        this._envelope.rcptFailed = [];
        this._envelope.responseQueue = [];

        this._currentAction = this._actionMAIL;
        axe.debug(DEBUG_TAG, 'Sending MAIL FROM...');
        this._sendCommand('MAIL FROM:<' + (this._envelope.from) + '>');
    };


    /**
     * Send ASCII data to the server. Works only in data mode (after `onready` event), ignored
     * otherwise
     *
     * @param {String} chunk ASCII string (quoted-printable, base64 etc.) to be sent to the server
     * @return {Boolean} If true, it is safe to send more data, if false, you *should* wait for the ondrain event before sending more
     */
    SmtpClient.prototype.send = function(chunk) {
        // works only in data mode
        if (!this._dataMode) {
            // this line should never be reached but if it does,
            // act like everything's normal.
            return true;
        }

        // TODO: if the chunk is an arraybuffer, use a separate function to send the data
        return this._sendString(chunk);
    };

    /**
     * Indicates that a data stream for the socket is ended. Works only in data
     * mode (after `onready` event), ignored otherwise. Use it when you are done
     * with sending the mail. This method does not close the socket. Once the mail
     * has been queued by the server, `ondone` and `onidle` are emitted.
     *
     * @param {Buffer} [chunk] Chunk of data to be sent to the server
     */
    SmtpClient.prototype.end = function(chunk) {
        // works only in data mode
        if (!this._dataMode) {
            // this line should never be reached but if it does,
            // act like everything's normal.
            return true;
        }

        if (chunk && chunk.length) {
            this.send(chunk);
        }

        // redirect output from the server to _actionStream
        this._currentAction = this._actionStream;

        // indicate that the stream has ended by sending a single dot on its own line
        // if the client already closed the data with \r\n no need to do it again
        if (this._lastDataBytes === '\r\n') {
            this.waitDrain = this.socket.send(new Uint8Array([0x2E, 0x0D, 0x0A]).buffer); // .\r\n
        } else if (this._lastDataBytes.substr(-1) === '\r') {
            this.waitDrain = this.socket.send(new Uint8Array([0x0A, 0x2E, 0x0D, 0x0A]).buffer); // \n.\r\n
        } else {
            this.waitDrain = this.socket.send(new Uint8Array([0x0D, 0x0A, 0x2E, 0x0D, 0x0A]).buffer); // \r\n.\r\n
        }

        // end data mode
        this._dataMode = false;

        return this.waitDrain;
    };

    // PRIVATE METHODS

    // EVENT HANDLERS FOR THE SOCKET

    /**
     * Connection listener that is run when the connection to the server is opened.
     * Sets up different event handlers for the opened socket
     *
     * @event
     * @param {Event} evt Event object. Not used
     */
    SmtpClient.prototype._onOpen = function() {
        this.socket.ondata = this._onData.bind(this);

        this.socket.onclose = this._onClose.bind(this);
        this.socket.ondrain = this._onDrain.bind(this);

        this._parser.ondata = this._onCommand.bind(this);

        this._currentAction = this._actionGreeting;
    };

    /**
     * Data listener for chunks of data emitted by the server
     *
     * @event
     * @param {Event} evt Event object. See `evt.data` for the chunk received
     */
    SmtpClient.prototype._onData = function(evt) {
        var stringPayload = new TextDecoder('UTF-8').decode(new Uint8Array(evt.data));
        axe.debug(DEBUG_TAG, 'SERVER: ' + stringPayload);
        this._parser.send(stringPayload);
    };

    /**
     * More data can be buffered in the socket, `waitDrain` is reset to false
     *
     * @event
     * @param {Event} evt Event object. Not used
     */
    SmtpClient.prototype._onDrain = function() {
        this.waitDrain = false;
        this.ondrain();
    };

    /**
     * Error handler for the socket
     *
     * @event
     * @param {Event} evt Event object. See evt.data for the error
     */
    SmtpClient.prototype._onError = function(evt) {
        if (evt instanceof Error && evt.message) {
            axe.error(DEBUG_TAG, evt);
            this.onerror(evt);
        } else if (evt && evt.data instanceof Error) {
            axe.error(DEBUG_TAG, evt.data);
            this.onerror(evt.data);
        } else {
            axe.error(DEBUG_TAG, new Error(evt && evt.data && evt.data.message || evt.data || evt || 'Error'));
            this.onerror(new Error(evt && evt.data && evt.data.message || evt.data || evt || 'Error'));
        }

        this.close();
    };

    /**
     * Indicates that the socket has been closed
     *
     * @event
     * @param {Event} evt Event object. Not used
     */
    SmtpClient.prototype._onClose = function() {
        axe.debug(DEBUG_TAG, 'Socket closed.');
        this._destroy();
    };

    /**
     * This is not a socket data handler but the handler for data emitted by the parser,
     * so this data is safe to use as it is always complete (server might send partial chunks)
     *
     * @event
     * @param {Object} command Parsed data
     */
    SmtpClient.prototype._onCommand = function(command) {
        if (typeof this._currentAction === 'function') {
            this._currentAction.call(this, command);
        }
    };

    /**
     * Ensures that the connection is closed and such
     */
    SmtpClient.prototype._destroy = function() {
        if (!this.destroyed) {
            this.destroyed = true;
            this.onclose();
        }
    };

    /**
     * Sends a string to the socket.
     *
     * @param {String} chunk ASCII string (quoted-printable, base64 etc.) to be sent to the server
     * @return {Boolean} If true, it is safe to send more data, if false, you *should* wait for the ondrain event before sending more
     */
    SmtpClient.prototype._sendString = function(chunk) {
        // escape dots
        if (!this.options.disableEscaping) {
            chunk = chunk.replace(/\n\./g, '\n..');
            if ((this._lastDataBytes.substr(-1) === '\n' || !this._lastDataBytes) && chunk.charAt(0) === '.') {
                chunk = '.' + chunk;
            }
        }

        // Keeping eye on the last bytes sent, to see if there is a <CR><LF> sequence
        // at the end which is needed to end the data stream
        if (chunk.length > 2) {
            this._lastDataBytes = chunk.substr(-2);
        } else if (chunk.length === 1) {
            this._lastDataBytes = this._lastDataBytes.substr(-1) + chunk;
        }

        axe.debug(DEBUG_TAG, 'Sending ' + chunk.length + ' bytes of payload');

        // pass the chunk to the socket
        this.waitDrain = this.socket.send(new TextEncoder('UTF-8').encode(chunk).buffer);
        return this.waitDrain;
    };

    /**
     * Send a string command to the server, also append \r\n if needed
     *
     * @param {String} str String to be sent to the server
     */
    SmtpClient.prototype._sendCommand = function(str) {
        this.waitDrain = this.socket.send(new TextEncoder('UTF-8').encode(str + (str.substr(-2) !== '\r\n' ? '\r\n' : '')).buffer);
    };

    /**
     * Intitiate authentication sequence if needed
     */
    SmtpClient.prototype._authenticateUser = function() {

        if (!this.options.auth) {
            // no need to authenticate, at least no data given
            this._currentAction = this._actionIdle;
            this.onidle(); // ready to take orders
            return;
        }

        var auth;

        if (!this.options.authMethod && this.options.auth.xoauth2) {
            this.options.authMethod = 'XOAUTH2';
        }

        if (this.options.authMethod) {
            auth = this.options.authMethod.toUpperCase().trim();
        } else {
            // use first supported
            auth = (this._supportedAuth[0] || 'PLAIN').toUpperCase().trim();
        }

        switch (auth) {
            case 'LOGIN':
                // LOGIN is a 3 step authentication process
                // C: AUTH LOGIN
                // C: BASE64(USER)
                // C: BASE64(PASS)
                axe.debug(DEBUG_TAG, 'Authentication via AUTH LOGIN');
                this._currentAction = this._actionAUTH_LOGIN_USER;
                this._sendCommand('AUTH LOGIN');
                return;
            case 'PLAIN':
                // AUTH PLAIN is a 1 step authentication process
                // C: AUTH PLAIN BASE64(\0 USER \0 PASS)
                axe.debug(DEBUG_TAG, 'Authentication via AUTH PLAIN');
                this._currentAction = this._actionAUTHComplete;
                this._sendCommand(
                    // convert to BASE64
                    'AUTH PLAIN ' +
                    btoa(unescape(encodeURIComponent(
                        //this.options.auth.user+'\u0000'+
                        '\u0000' + // skip authorization identity as it causes problems with some servers
                        this.options.auth.user + '\u0000' +
                        this.options.auth.pass))));
                return;
            case 'XOAUTH2':
                // See https://developers.google.com/gmail/xoauth2_protocol#smtp_protocol_exchange
                axe.debug(DEBUG_TAG, 'Authentication via AUTH XOAUTH2');
                this._currentAction = this._actionAUTH_XOAUTH2;
                this._sendCommand('AUTH XOAUTH2 ' + this._buildXOAuth2Token(this.options.auth.user, this.options.auth.xoauth2));
                return;
        }

        this._onError(new Error('Unknown authentication method ' + auth));
    };

    // ACTIONS FOR RESPONSES FROM THE SMTP SERVER

    /**
     * Initial response from the server, must have a status 220
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionGreeting = function(command) {
        if (command.statusCode !== 220) {
            this._onError(new Error('Invalid greeting: ' + command.data));
            return;
        }

        if (this.options.lmtp) {
            axe.debug(DEBUG_TAG, 'Sending LHLO ' + this.options.name);

            this._currentAction = this._actionLHLO;
            this._sendCommand('LHLO ' + this.options.name);
        } else {
            axe.debug(DEBUG_TAG, 'Sending EHLO ' + this.options.name);

            this._currentAction = this._actionEHLO;
            this._sendCommand('EHLO ' + this.options.name);
        }
    };

    /**
     * Response to LHLO
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionLHLO = function(command) {
        if (!command.success) {
            axe.error(DEBUG_TAG, 'LHLO not successful');
            this._onError(new Error(command.data));
            return;
        }

        // Process as EHLO response
        this._actionEHLO(command);
    };

    /**
     * Response to EHLO. If the response is an error, try HELO instead
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionEHLO = function(command) {
        var match;

        if (!command.success) {
            if (!this._secureMode && this.options.requireTLS) {
                var errMsg = 'STARTTLS not supported without EHLO';
                axe.error(DEBUG_TAG, errMsg);
                this._onError(new Error(errMsg));
                return;
            }

            // Try HELO instead
            axe.warn(DEBUG_TAG, 'EHLO not successful, trying HELO ' + this.options.name);
            this._currentAction = this._actionHELO;
            this._sendCommand('HELO ' + this.options.name);
            return;
        }

        // Detect if the server supports PLAIN auth
        if (command.line.match(/AUTH(?:\s+[^\n]*\s+|\s+)PLAIN/i)) {
            axe.debug(DEBUG_TAG, 'Server supports AUTH PLAIN');
            this._supportedAuth.push('PLAIN');
        }

        // Detect if the server supports LOGIN auth
        if (command.line.match(/AUTH(?:\s+[^\n]*\s+|\s+)LOGIN/i)) {
            axe.debug(DEBUG_TAG, 'Server supports AUTH LOGIN');
            this._supportedAuth.push('LOGIN');
        }

        // Detect if the server supports XOAUTH2 auth
        if (command.line.match(/AUTH(?:\s+[^\n]*\s+|\s+)XOAUTH2/i)) {
            axe.debug(DEBUG_TAG, 'Server supports AUTH XOAUTH2');
            this._supportedAuth.push('XOAUTH2');
        }

        // Detect maximum allowed message size
        if ((match = command.line.match(/SIZE (\d+)/i)) && Number(match[1])) {
            this._maxAllowedSize = Number(match[1]);
            axe.debug(DEBUG_TAG, 'Maximum allowd message size: ' + this._maxAllowedSize);
        }

        // Detect if the server supports STARTTLS
        if (!this._secureMode) {
            if (command.line.match(/[ \-]STARTTLS\s?$/mi) && !this.options.ignoreTLS || !!this.options.requireTLS) {
                this._currentAction = this._actionSTARTTLS;
                this._sendCommand('STARTTLS');
                return;
            }
        }

        this._authenticateUser.call(this);
    };

    /**
     * Handles server response for STARTTLS command. If there's an error
     * try HELO instead, otherwise initiate TLS upgrade. If the upgrade
     * succeedes restart the EHLO
     *
     * @param {String} str Message from the server
     */
    SmtpClient.prototype._actionSTARTTLS = function(command) {
        if (!command.success) {
            axe.error(DEBUG_TAG, 'STARTTLS not successful');
            this._onError(new Error(command.data));
            return;
        }

        this._secureMode = true;
        this.socket.upgradeToSecure();

        // restart protocol flow
        this._currentAction = this._actionEHLO;
        this._sendCommand('EHLO ' + this.options.name);
    };

    /**
     * Response to HELO
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionHELO = function(command) {
        if (!command.success) {
            axe.error(DEBUG_TAG, 'HELO not successful');
            this._onError(new Error(command.data));
            return;
        }
        this._authenticateUser.call(this);
    };

    /**
     * Response to AUTH LOGIN, if successful expects base64 encoded username
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionAUTH_LOGIN_USER = function(command) {
        if (command.statusCode !== 334 || command.data !== 'VXNlcm5hbWU6') {
            axe.error(DEBUG_TAG, 'AUTH LOGIN USER not successful: ' + command.data);
            this._onError(new Error('Invalid login sequence while waiting for "334 VXNlcm5hbWU6 ": ' + command.data));
            return;
        }
        axe.debug(DEBUG_TAG, 'AUTH LOGIN USER successful');
        this._currentAction = this._actionAUTH_LOGIN_PASS;
        this._sendCommand(btoa(unescape(encodeURIComponent(this.options.auth.user))));
    };

    /**
     * Response to AUTH LOGIN username, if successful expects base64 encoded password
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionAUTH_LOGIN_PASS = function(command) {
        if (command.statusCode !== 334 || command.data !== 'UGFzc3dvcmQ6') {
            axe.error(DEBUG_TAG, 'AUTH LOGIN PASS not successful: ' + command.data);
            this._onError(new Error('Invalid login sequence while waiting for "334 UGFzc3dvcmQ6 ": ' + command.data));
            return;
        }
        axe.debug(DEBUG_TAG, 'AUTH LOGIN PASS successful');
        this._currentAction = this._actionAUTHComplete;
        this._sendCommand(btoa(unescape(encodeURIComponent(this.options.auth.pass))));
    };

    /**
     * Response to AUTH XOAUTH2 token, if error occurs send empty response
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionAUTH_XOAUTH2 = function(command) {
        if (!command.success) {
            axe.warn(DEBUG_TAG, 'Error during AUTH XOAUTH2, sending empty response');
            this._sendCommand('');
            this._currentAction = this._actionAUTHComplete;
        } else {
            this._actionAUTHComplete(command);
        }
    };

    /**
     * Checks if authentication succeeded or not. If successfully authenticated
     * emit `idle` to indicate that an e-mail can be sent using this connection
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionAUTHComplete = function(command) {
        if (!command.success) {
            axe.debug(DEBUG_TAG, 'Authentication failed: ' + command.data);
            this._onError(new Error(command.data));
            return;
        }

        axe.debug(DEBUG_TAG, 'Authentication successful.');

        this._authenticatedAs = this.options.auth.user;

        this._currentAction = this._actionIdle;
        this.onidle(); // ready to take orders
    };

    /**
     * Used when the connection is idle and the server emits timeout
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionIdle = function(command) {
        if (command.statusCode > 300) {
            this._onError(new Error(command.line));
            return;
        }

        this._onError(new Error(command.data));
    };

    /**
     * Response to MAIL FROM command. Proceed to defining RCPT TO list if successful
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionMAIL = function(command) {
        if (!command.success) {
            axe.debug(DEBUG_TAG, 'MAIL FROM unsuccessful: ' + command.data);
            this._onError(new Error(command.data));
            return;
        }

        if (!this._envelope.rcptQueue.length) {
            this._onError(new Error('Can\'t send mail - no recipients defined'));
        } else {
            axe.debug(DEBUG_TAG, 'MAIL FROM successful, proceeding with ' + this._envelope.rcptQueue.length + ' recipients');
            axe.debug(DEBUG_TAG, 'Adding recipient...');
            this._envelope.curRecipient = this._envelope.rcptQueue.shift();
            this._currentAction = this._actionRCPT;
            this._sendCommand('RCPT TO:<' + this._envelope.curRecipient + '>');
        }
    };

    /**
     * Response to a RCPT TO command. If the command is unsuccessful, try the next one,
     * as this might be related only to the current recipient, not a global error, so
     * the following recipients might still be valid
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionRCPT = function(command) {
        if (!command.success) {
            axe.warn(DEBUG_TAG, 'RCPT TO failed for: ' + this._envelope.curRecipient);
            // this is a soft error
            this._envelope.rcptFailed.push(this._envelope.curRecipient);
        } else {
            this._envelope.responseQueue.push(this._envelope.curRecipient);
        }

        if (!this._envelope.rcptQueue.length) {
            if (this._envelope.rcptFailed.length < this._envelope.to.length) {
                this._currentAction = this._actionDATA;
                axe.debug(DEBUG_TAG, 'RCPT TO done, proceeding with payload');
                this._sendCommand('DATA');
            } else {
                this._onError(new Error('Can\'t send mail - all recipients were rejected'));
                this._currentAction = this._actionIdle;
                return;
            }
        } else {
            axe.debug(DEBUG_TAG, 'Adding recipient...');
            this._envelope.curRecipient = this._envelope.rcptQueue.shift();
            this._currentAction = this._actionRCPT;
            this._sendCommand('RCPT TO:<' + this._envelope.curRecipient + '>');
        }
    };

    /**
     * Response to the RSET command. If successful, clear the current authentication
     * information and reauthenticate.
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionRSET = function(command) {
        if (!command.success) {
            axe.error(DEBUG_TAG, 'RSET unsuccessful ' + command.data);
            this._onError(new Error(command.data));
            return;
        }

        this._authenticatedAs = null;
        this._authenticateUser.call(this);
    };

    /**
     * Response to the DATA command. Server is now waiting for a message, so emit `onready`
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionDATA = function(command) {
        // response should be 354 but according to this issue https://github.com/eleith/emailjs/issues/24
        // some servers might use 250 instead
        if ([250, 354].indexOf(command.statusCode) < 0) {
            axe.error(DEBUG_TAG, 'DATA unsuccessful ' + command.data);
            this._onError(new Error(command.data));
            return;
        }

        this._dataMode = true;
        this._currentAction = this._actionIdle;
        this.onready(this._envelope.rcptFailed);
    };

    /**
     * Response from the server, once the message stream has ended with <CR><LF>.<CR><LF>
     * Emits `ondone`.
     *
     * @param {Object} command Parsed command from the server {statusCode, data, line}
     */
    SmtpClient.prototype._actionStream = function(command) {
        var rcpt;

        if (this.options.lmtp) {
            // LMTP returns a response code for *every* successfully set recipient
            // For every recipient the message might succeed or fail individually

            rcpt = this._envelope.responseQueue.shift();
            if (!command.success) {
                axe.error(DEBUG_TAG, 'Local delivery to ' + rcpt + ' failed.');
                this._envelope.rcptFailed.push(rcpt);
            } else {
                axe.error(DEBUG_TAG, 'Local delivery to ' + rcpt + ' succeeded.');
            }

            if (this._envelope.responseQueue.length) {
                this._currentAction = this._actionStream;
                return;
            }

            this._currentAction = this._actionIdle;
            this.ondone(true);
        } else {
            // For SMTP the message either fails or succeeds, there is no information
            // about individual recipients

            if (!command.success) {
                axe.error(DEBUG_TAG, 'Message sending failed.');
            } else {
                axe.debug(DEBUG_TAG, 'Message sent successfully.');
            }

            this._currentAction = this._actionIdle;
            this.ondone(!!command.success);
        }

        // If the client wanted to do something else (eg. to quit), do not force idle
        if (this._currentAction === this._actionIdle) {
            // Waiting for new connections
            axe.debug(DEBUG_TAG, 'Idling while waiting for new connections...');
            this.onidle();
        }
    };

    /**
     * Builds a login token for XOAUTH2 authentication command
     *
     * @param {String} user E-mail address of the user
     * @param {String} token Valid access token for the user
     * @return {String} Base64 formatted login token
     */
    SmtpClient.prototype._buildXOAuth2Token = function(user, token) {
        var authData = [
            'user=' + (user || ''),
            'auth=Bearer ' + token,
            '',
            ''
        ];
        // base64("user={User}\x00auth=Bearer {Token}\x00\x00")
        return btoa(unescape(encodeURIComponent(authData.join('\x01'))));
    };

    return SmtpClient;
}));
define('smtpclient',['ext/smtpclient/src/smtpclient'], function(SmtpClient) {
  return SmtpClient;
});

/**
 * smtp/client.js: Wraps SMTP connection creation, to avoid redundancy
 * between connection-related setup in smtp/account.js and
 * smtp/probe.js.
 */
define('smtp/client',['require','exports','module','logic','smtpclient','../syncbase','../oauth'],function(require, exports) {

  var logic = require('logic');
  var SmtpClient = require('smtpclient');
  var syncbase = require('../syncbase');
  var oauth = require('../oauth');

  var setTimeout = window.setTimeout;
  var clearTimeout = window.clearTimeout;
  exports.setTimeoutFunctions = function(setFn, clearFn) {
    setTimeout = setFn;
    clearTimeout = clearFn;
  };

  var scope = logic.scope('SmtpClient');

  /**
   * Create an SMTP connection using the given credentials and
   * connection info, returning a Promise.
   *
   * @param {object} credentials
   *   keys: hostname, port, crypto
   * @param {object} connInfo
   *   keys: username, password
   * @param {function(credentials)} credsUpdatedCallback
   *   Callback, called if the credentials have been updated and
   *   should be stored to disk. Not called if the credentials are
   *   already up-to-date.
   * @return {Promise}
   *   resolve => {SmtpClient} connection
   *   reject => {String} normalized error
   */
  exports.createSmtpConnection = function(credentials, connInfo,
                                          credsUpdatedCallback) {
    var conn;

    return oauth.ensureUpdatedCredentials(credentials, credsUpdatedCallback)
    .then(function() {
      return new Promise(function(resolve, reject) {

        var auth = {
          // Someday, `null` might be a valid value, so be careful here
          user: (credentials.outgoingUsername !== undefined ?
                 credentials.outgoingUsername :
                 credentials.username),
          pass: (credentials.outgoingPassword !== undefined ?
                 credentials.outgoingPassword :
                 credentials.password),
          xoauth2: credentials.oauth2 ?
                     credentials.oauth2.accessToken : null
        };
        logic(scope, 'connect', {
          _auth: auth,
          usingOauth2: !!credentials.oauth2,
          connInfo: connInfo
        });
        conn = new SmtpClient(
          connInfo.hostname, connInfo.port,
          {
            auth: auth,
            useSecureTransport: (connInfo.crypto === 'ssl' ||
                                 connInfo.crypto === true),
            requireTLS: connInfo.crypto === 'starttls',
            // In the case no encryption is explicitly requested (either for
            // testing or because a user regrettably chose to disable it via
            // manual config), we want to avoid opportunistic encryption
            // since in the latter case the user may have done this because
            // the server's certificates are invalid.
            ignoreTLS: connInfo.crypto === 'plain'
          });

        var connectTimeout = setTimeout(function() {
          conn.onerror('unresponsive-server');
          conn.close();
        }, syncbase.CONNECT_TIMEOUT_MS);

        function clearConnectTimeout() {
          if (connectTimeout) {
            clearTimeout(connectTimeout);
            connectTimeout = null;
          }
        }

        conn.onidle = function() {
          clearConnectTimeout();
          logic(scope, 'connected', connInfo);
          conn.onidle = conn.onclose = conn.onerror = function() { /* noop */ };
          resolve(conn);
        };
        conn.onerror = function(err) {
          clearConnectTimeout();
          reject(err);
        };
        // if the connection closes without any of the other callbacks,
        // the server isn't responding properly.
        conn.onclose = function() {
          clearConnectTimeout();
          reject('server-maybe-offline');
        };

        conn.connect();
      });
    }).catch(function(err) {
      var errorString = analyzeSmtpError(conn, err, /* wasSending: */ false);
      if (conn) {
        conn.close();
      }

      // Could hit an oauth reauth case due to date skews, so give a token
      // review a shot before really bailing.
      if (errorString === 'needs-oauth-reauth' &&
          oauth.isRenewPossible(credentials)) {
        return oauth.ensureUpdatedCredentials(credentials,
                                              credsUpdatedCallback, true)
        .then(function() {
          return exports.createSmtpConnection(credentials, connInfo,
                                              credsUpdatedCallback);
        });
      } else {
        logic(scope, 'connect-error', {
          error: errorString,
          connInfo: connInfo
        });
        throw errorString;
      }
    });
  };

  //****************************************************************
  // UNFORTUNATE SMTP WORKAROUNDS & SHIMS BEGIN HERE
  //----------------------------------------------------------------

  // SmtpClient doesn't provide any useful information in its onerror
  // handlers. Instead, intercept error responses and cache them so
  // that we can retrieve the most recent server error when needed.
  var onCommand = SmtpClient.prototype._onCommand;
  SmtpClient.prototype._onCommand = function(command) {
    if (command.statusCode && !command.success) {
      this._lastSmtpError = command;
    }
    onCommand.apply(this, arguments);
  };

  // SmtpClient passes data directly into the `new Error()`
  // constructor, which causes err.message to equal "[Object object]"
  // rather than the actual error object with details. This is just a
  // copy of that function, with the `new Error` constructor stripped
  // out so that the error details pass through to onerror.
  SmtpClient.prototype._onError = function(evt) {
    if (evt instanceof Error && evt.message) {
      this.onerror(evt);
    } else if (evt && evt.data instanceof Error) {
      this.onerror(evt.data);
    } else {
      this.onerror(evt && evt.data && evt.data.message ||
                   evt.data || evt || 'Error');
    }

    this.close();
  };

  /**
   * Analyze a connection error for its cause and true nature,
   * returning a plain-old string. The error could come from the SMTP
   * dialog, or perhaps a socket error.
   *
   * @param {SmtpClient} conn
   * @param {Object} [rawError]
   *   If provided, use this error object if we couldn't find
   *   anything useful from the SMTP session's last error.
   *   For instance, socket errors will only get caught directly
   *   by the onerror handler.
   * @param {boolean} wasSending
   *   True if we were in the process of sending a message. If so,
   *   we need to interpret server error codes differently, as the
   *   SmtpClient doesn't maintain any easy-to-grab state about
   *   what mode the connection was in.
   */
  var analyzeSmtpError = exports.analyzeSmtpError =
        function(conn, rawError, wasSending) {
    var err = rawError;
    // If the error object is just an exception with no useful data,
    // try looking at recent SMTP errors.
    if ((err && !err.statusCode && err.name === 'Error') || !err) {
      err = conn && conn._lastSmtpError || null;
    }

    if (!err) {
      err = 'null-error';
    }

    var wasOauth = conn && !!conn.options.auth.xoauth2;
    var normalizedError = 'unknown';

    // If we were able to extract a negative SMTP response, we can
    // analyze the statusCode:
    if (err.statusCode) {
      // If we were processing startTLS then any failure where the server told
      // us something means it's a security problem.  Connection loss is
      // ambiguous, which is why we only do this when there's a statusCode.
      //
      // Likewise, if we were in EHLO and we generate an error, it's because
      // EHLO failed which implies no HELO.  (Note!  As of writing this comment,
      // I've just submitted the fix to smtpclient to generate the error and
      // have updated our local copy of smtpclient appropriately.  In that fix
      // I have the error messages mention STARTTLS; we could key off that, but
      // I'm expecting that might end up working differently at some point, so
      // this is potentially slightly less brittle.
      if (conn._currentAction === conn._actionSTARTTLS ||
          conn._currentAction === conn._actionEHLO) {
        normalizedError = 'bad-security';
      } else {
        // Example SMTP error:
        //   { "statusCode": 535,
        //     "enhancedStatus": "5.7.8",
        //     "data": "Wrong username or password, crook!",
        //     "line": "535 5.7.8 Wrong username or password, crook!",
        //     "success": false }
        switch (err.statusCode) {
        case 535:
          if (wasOauth) {
            normalizedError = 'needs-oauth-reauth';
          } else {
            normalizedError = 'bad-user-or-pass';
          }
          break;
        // This technically means that the auth mechanism is weaker than
        // required.  We've only seen this for the gmail case where two
        // factor is needed, we're not doing oauth, and the user is using
        // their normal password instead of an application-specific password
        // (and we've now removed support for providing a special error for
        // that).  We're calling this bad-user-or-pass because it's less
        // misleading than 'unknown' is.
        case 534:
          normalizedError = 'bad-user-or-pass';
          break;
        case 501: // Invalid Syntax
          if (wasSending) {
            normalizedError = 'bad-message';
          } else {
            normalizedError = 'server-maybe-offline';
          }
          break;
        case 550: // Mailbox Unavailable
        case 551: // User not local, will not send
        case 553: // Mailbox name not allowed
        case 554: // Transaction failed (in response to bad addresses)
          normalizedError = 'bad-address';
          break;
        case 500:
          normalizedError = 'server-problem';
          break;
        default:
          if (wasSending) {
            normalizedError = 'bad-message';
          } else {
            normalizedError = 'unknown';
          }
          break;
        }
      }
    }
    // Socket errors only have a name:
    else if (err.name === 'ConnectionRefusedError') {
      normalizedError = 'unresponsive-server';
    }
    else if (/^Security/.test(err.name)) {
      normalizedError = 'bad-security';
    }
    // If we provided a string only, it's probably already normalized
    else if (typeof err === 'string') {
      normalizedError = err;
    }

    logic(scope, 'analyzed-error', {
      statusCode: err.statusCode,
      enhancedStatus: err.enhancedStatus,
      rawError: rawError,
      rawErrorName: rawError && rawError.name,
      rawErrorMessage: rawError && rawError.message,
      rawErrorStack: rawError && rawError.stack,
      normalizedError: normalizedError,
      errorName: err.name,
      errorMessage: err.message,
      errorData: err.data,
      wasSending: wasSending
    });

    return normalizedError;
  };
});

define('smtp/account',['require','logic','./client','../disaster-recovery'],function(require) {

var logic = require('logic');
var client = require('./client');
var DisasterRecovery = require('../disaster-recovery');

function SmtpAccount(universe, compositeAccount, accountId, credentials,
                     connInfo) {
  this.universe = universe;
  logic.defineScope(this, 'Account', { accountId: accountId,
                                       accountType: 'smtp' });
  this.compositeAccount = compositeAccount;
  this.accountId = accountId;
  this.credentials = credentials;
  this.connInfo = connInfo;
  this._activeConnections = [];
}

SmtpAccount.prototype = {
  type: 'smtp',
  toString: function() {
    return '[SmtpAccount: ' + this.id + ']';
  },

  get numActiveConns() {
    return this._activeConnections.length;
  },

  shutdown: function() {
    // Nothing to do.
  },

  accountDeleted: function() {
    this.shutdown();
  },

  /**
   * Asynchronously send an e-mail message.  Does not provide retries, offline
   * remembering of the command, or any follow-on logic like appending the
   * message to the sent folder.
   *
   * @args[
   *   @param[composedMessage MailComposer]{
   *     A mailcomposer instance that has already generated its message payload
   *     to its _outputBuffer field.  We previously used streaming generation,
   *     but have abandoned this for now for IMAP Sent folder saving purposes.
   *     Namely, our IMAP implementation doesn't support taking a stream for
   *     APPEND right now, and there's no benefit to doing double the work and
   *     generating extra garbage.
   *   }
   *   @param[callback @func[
   *     @args[
   *       @param[error @oneof[
   *         @case[null]{
   *           No error, message sent successfully.
   *         }
   *         @case['bad-user-or-pass']{
   *           Authentication problem.  This should probably be escalated to
   *           the user so they can fix their password.
   *         }
   *         @case['bad-sender']{
   *           We logged in, but it didn't like our sender e-mail.
   *         }
   *         @case['bad-recipient']{
   *           There were one or more bad recipients; they are listed in the
   *           next argument.
   *         }
   *         @case['bad-message']{
   *           It failed during the sending of the message.
   *         }
   *         @case['server-maybe-offline']{
   *           The server won't let us login, maybe because of a bizarre offline
   *           for service strategy?  (We've seen this with IMAP before...)
   *
   *           This should be considered a fatal problem during probing or if
   *           it happens consistently.
   *         }
   *         @case['insecure']{
   *           We couldn't establish a secure connection.
   *         }
   *         @case['connection-lost']{
   *           The connection went away, we don't know why.  Could be a
   *           transient thing, could be a jerky server, who knows.
   *         }
   *         @case['unknown']{
   *           Some other error.  Internal error reporting/support should
   *           ideally be logging this somehow.
   *         }
   *       ]]
   *       @param[badAddresses @listof[String]]
   *     ]
   *   ]
   * ]
   */
  sendMessage: function(composer, callback) {
    var scope = this;
    this.establishConnection({
      /**
       * Send the envelope.
       * @param conn
       * @param {function()} bail Abort the connection. Used for when
       * we must gracefully cancel without sending a message.
       */
      sendEnvelope: function(conn) {
        var envelope = composer.getEnvelope();
        logic(scope, 'sendEnvelope', { _envelope: envelope });
        conn.useEnvelope(envelope);
      },

      onProgress: function() {
        // Keep the wake lock open as long as it looks like we're
        // still communicating with the server.
        composer.renewSmartWakeLock('SMTP XHR Progress');
      },
      /**
       * Send the message body.
       */
      sendMessage: function(conn) {
        // Then send the actual message if everything was cool
        logic(scope, 'building-blob');
        composer.withMessageBlob({ includeBcc: false, smtp: true },
                                 function(blob) {
          logic(scope, 'sending-blob', { size: blob.size });
          // simplesmtp's SMTPClient does not understand Blobs, so we
          // issue the write directly. All that it cares about is
          // knowing whether our data payload included a trailing
          // \r\n. We had hoped to avoid this silliness in bug 885110,
          // but SMTPClient still does not support blobs yet, so we
          // still need this.
          conn.socket.send(blob);
          // SMTPClient tracks the last bytes it has written in _lastDataBytes
          // to this end and writes the \r\n if they aren't the last bytes
          // written.  Since we know that mailcomposer always ends the buffer
          // with \r\n we just set that state directly ourselves.
          conn._lastDataBytes = '\r\n';

          // this does not actually terminate the connection; just tells the
          // client to flush stuff, etc.
          conn.end();
        });
      },
      /**
       * The send succeeded.
       */
      onSendComplete: function(conn) {
        logic(scope, 'smtp:sent');
        callback(null);
      },
      /**
       * The send failed.
       */
      onError: function(err, badAddresses) {
        logic(scope, 'smtp:error', {
          error: err,
          badAddresses: badAddresses
        });
        callback(err, badAddresses);
      }
    });
  },

  /**
   * Check the account credentials by connecting to the server. Calls
   * back with an error if we had a problem (see sendMessage for
   * details), or no arguments if we succeeded.
   *
   * @param {function(err)} callback
   */
  checkAccount: function(callback) {
    var success = false;
    this.establishConnection({
      sendEnvelope: function(conn, bail) {
        // If we get here, we've successfully connected. Sorry, SMTP
        // server friend, we aren't actually going to send a message
        // now. Psych
        success = true;
        bail();
        callback();
      },
      sendMessage: function(conn) {
        // We're not sending a message, so this won't be called.
      },
      onSendComplete: function(conn) {
        // Ibid.
      },
      onError: function(err, badAddresses) {
        // Aha, here we have an error -- we might have bad credentials
        // or something else. This error is normalized per the
        // documentation for sendMessage, so we can just pass it along.

        // We only report auth errors. When checking the account,
        // transient server connection errors don't matter; and we're
        // not trying to send a message.
        if (err === 'bad-user-or-pass') {
          this.universe.__reportAccountProblem(
            this.compositeAccount, err, 'outgoing');
        }
        callback(err);
      }.bind(this)
    });
  },

  /**
   * Abstract out connection management so that we can do different
   * things with the connection (i.e. just test login credentials, or
   * actually send a message).
   *
   * Callbacks is an object with the following functions, all required:
   *
   * sendEnvelope(conn) -- you should send the envelope
   * sendMessage(conn) -- you should send the message body
   * onSendComplete(conn) -- the message was successfully sent
   * onError(err, badAddresses) -- send failed (or connection error)
   */
  establishConnection: function(callbacks) {
    var scope = this;
    var conn;
    var sendingMessage = false;
    client.createSmtpConnection(
      this.credentials,
      this.connInfo,
      function onCredentialsUpdated() {
        return new Promise(function(resolve) {
          // Note: Since we update the credentials object in-place,
          // there's no need to explicitly assign the changes here;
          // just save the account information.
          this.universe.saveAccountDef(
            this.compositeAccount.accountDef,
            /* folderInfo: */ null,
            /* callback: */ resolve);
        }.bind(this));
      }.bind(this)
    ).then(function(newConn) {
      conn = newConn;
      DisasterRecovery.associateSocketWithAccount(conn.socket, this);
      this._activeConnections.push(conn);

      // Intercept the 'ondrain' event, which is as close as we can
      // get to knowing that we are still sending data to the
      // server. We use this to hold a wakelock open.
      var oldOnDrain = conn.socket.ondrain;
      conn.socket.ondrain = function() {
        oldOnDrain && oldOnDrain.call(conn.socket);
        callbacks.onProgress && callbacks.onProgress();
      };

      callbacks.sendEnvelope(conn, conn.close.bind(conn));

      // We sent the envelope; see if we can now send the message.
      conn.onready = function(badRecipients) {
        logic(scope, 'onready');

        if (badRecipients.length) {
          conn.close();
          logic(scope, 'bad-recipients', { badRecipients: badRecipients });
          callbacks.onError('bad-recipient', badRecipients);
        } else {
          sendingMessage = true;
          callbacks.sendMessage(conn);
        }
      };

      // Done sending the message, ideally successfully.
      conn.ondone = function(success) {
        conn.close();

        if (success) {
          logic(scope, 'sent');
          callbacks.onSendComplete(conn);
        } else {
          logic(scope, 'send-failed');
          // We don't have an error to reference here, but we stored
          // the most recent SMTP error, which should tell us why the
          // server rejected the message.
          var err = client.analyzeSmtpError(conn, null, sendingMessage);
          callbacks.onError(err, /* badAddresses: */ null);
        }
      };

      conn.onerror = function(err) {
        // Some sort of error occurred; analyze and report.
        conn.close();
        err = client.analyzeSmtpError(conn, err, sendingMessage);
        callbacks.onError(err, /* badAddresses: */ null);
      };

      conn.onclose = function() {
        logic(scope, 'onclose');

        var idx = this._activeConnections.indexOf(conn);
        if (idx !== -1) {
          this._activeConnections.splice(idx, 1);
        } else {
          logic(scope, 'dead-unknown-connection');
        }
      }.bind(this);
    }.bind(this))
      .catch(function(err) {
        err = client.analyzeSmtpError(conn, err, sendingMessage);
        callbacks.onError(err);
      });
  }

};

return {
  Account: SmtpAccount,
  SmtpAccount: SmtpAccount
};

}); // end define
;
/**
 * Configurator for fake
 **/

define(
  'composite/account',[
    'logic',
    '../accountcommon',
    '../a64',
    '../accountmixins',
    '../imap/account',
    '../pop3/account',
    '../smtp/account',
    '../allback',
    'exports'
  ],
  function(
    logic,
    $accountcommon,
    $a64,
    $acctmixins,
    $imapacct,
    $pop3acct,
    $smtpacct,
    allback,
    exports
  ) {

var PIECE_ACCOUNT_TYPE_TO_CLASS = {
  'imap': $imapacct.ImapAccount,
  'pop3': $pop3acct.Pop3Account,
  'smtp': $smtpacct.SmtpAccount,
};

/**
 * Composite account type to expose account piece types with individual
 * implementations (ex: imap, smtp) together as a single account.  This is
 * intended to be a very thin layer that shields consuming code from the
 * fact that IMAP and SMTP are not actually bundled tightly together.
 */
function CompositeAccount(universe, accountDef, folderInfo, dbConn,
                          receiveProtoConn) {
  this.universe = universe;
  this.id = accountDef.id;
  this.accountDef = accountDef;
  logic.defineScope(this, 'Account', { accountId: this.id });

  // Currently we don't persist the disabled state of an account because it's
  // easier for the UI to be edge-triggered right now and ensure that the
  // triggering occurs once each session.
  this._enabled = true;
  this.problems = [];

  // For oauth2, hold on to a "last renew attempt" timestamp. However, since it
  // uses performance.now() that can be reset depending on clock time and
  // environment (shared worker always resets to 0 for instance), always reset
  // the value here to 0. It is just a transient timestamp that is useful
  // during the lifetime of the app.
  if (accountDef.credentials && accountDef.credentials.oauth2) {
    accountDef.credentials.oauth2._transientLastRenew = 0;
  }

  this.identities = accountDef.identities;

  if (!PIECE_ACCOUNT_TYPE_TO_CLASS.hasOwnProperty(accountDef.receiveType)) {
    logic(this, 'badAccountType', { type: accountDef.receiveType });
  }
  if (!PIECE_ACCOUNT_TYPE_TO_CLASS.hasOwnProperty(accountDef.sendType)) {
    logic(this, 'badAccountType', { type: accountDef.sendType });
  }

  this._receivePiece =
    new PIECE_ACCOUNT_TYPE_TO_CLASS[accountDef.receiveType](
      universe, this,
      accountDef.id, accountDef.credentials, accountDef.receiveConnInfo,
      folderInfo, dbConn, receiveProtoConn);
  this._sendPiece =
    new PIECE_ACCOUNT_TYPE_TO_CLASS[accountDef.sendType](
      universe, this,
      accountDef.id, accountDef.credentials,
      accountDef.sendConnInfo, dbConn);

  // expose public lists that are always manipulated in place.
  this.folders = this._receivePiece.folders;
  this.meta = this._receivePiece.meta;
  this.mutations = this._receivePiece.mutations;

  // Mix in any fields common to all accounts.
  $acctmixins.accountConstructorMixin.call(
    this, this._receivePiece, this._sendPiece);
}

exports.Account = exports.CompositeAccount = CompositeAccount;
CompositeAccount.prototype = {
  toString: function() {
    return '[CompositeAccount: ' + this.id + ']';
  },
  get supportsServerFolders() {
    return this._receivePiece.supportsServerFolders;
  },
  toBridgeWire: function() {
    return {
      id: this.accountDef.id,
      name: this.accountDef.name,
      authenticatorId: this.accountDef.authenticatorId,
      label: this.accountDef.label,
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
        outgoingUsername: this.accountDef.credentials.outgoingUsername,
        // no need to send the password to the UI.
        // send all the oauth2 stuff we've got, though.
        oauth2: this.accountDef.credentials.oauth2,
        // UI need show password in settings
        password: this.accountDef.credentials.password
      },

      servers: [
        {
          type: this.accountDef.receiveType,
          connInfo: this.accountDef.receiveConnInfo,
          activeConns: this._receivePiece.numActiveConns || 0,
        },
        {
          type: this.accountDef.sendType,
          connInfo: this.accountDef.sendConnInfo,
          activeConns: this._sendPiece.numActiveConns || 0,
        }
      ],
    };
  },
  toBridgeFolder: function() {
    return {
      id: this.accountDef.id,
      name: this.accountDef.name,
      path: this.accountDef.name,
      type: 'account',
    };
  },

  get enabled() {
    return this._enabled;
  },
  set enabled(val) {
    this._enabled = this._receivePiece.enabled = val;
  },

  saveAccountState: function(reuseTrans, callback, reason) {
    return this._receivePiece.saveAccountState(reuseTrans, callback, reason);
  },

  get _saveAccountIsImminent() {
    return this.__saveAccountIsImminent;
  },
  set _saveAccountIsImminent(val) {
    this.___saveAccountIsImminent =
    this._receivePiece._saveAccountIsImminent = val;
  },

  runAfterSaves: function(callback) {
    return this._receivePiece.runAfterSaves(callback);
  },

  allOperationsCompleted: function() {
    if (this._receivePiece.allOperationsCompleted) {
      this._receivePiece.allOperationsCompleted();
    }
  },

  /**
   * Check that the account is healthy in that we can login at all.
   * We'll check both the incoming server and the SMTP server; for
   * simplicity, the errors are returned as follows:
   *
   *   callback(incomingErr, outgoingErr);
   *
   * If you don't want to check both pieces, you should just call
   * checkAccount on the receivePiece or sendPiece as appropriate.
   */
  checkAccount: function(callback) {
    var latch = allback.latch();
    this._receivePiece.checkAccount(latch.defer('incoming'));
    this._sendPiece.checkAccount(latch.defer('outgoing'));
    latch.then(function(results) {
      callback(results.incoming[0], results.outgoing[0]);
    });
  },

  /**
   * Shutdown the account; see `MailUniverse.shutdown` for semantics.
   */
  shutdown: function(callback) {
    this._sendPiece.shutdown();
    this._receivePiece.shutdown(callback);
  },

  accountDeleted: function() {
    this._sendPiece.accountDeleted();
    this._receivePiece.accountDeleted();
  },

  deleteFolder: function(folderId, callback) {
    return this._receivePiece.deleteFolder(folderId, callback);
  },

  sliceFolderMessages: function(folderId, bridgeProxy) {
    return this._receivePiece.sliceFolderMessages(folderId, bridgeProxy);
  },

  sortFolderMessages: function(folderId, bridgeHandle, fillSize) {
    return this._receivePiece.sortFolderMessages(
      folderId, bridgeHandle, fillSize);
  },

  searchFolderMessages: function(folderId, bridgeHandle, phrase, whatToSearch) {
    return this._receivePiece.searchFolderMessages(
      folderId, bridgeHandle, phrase, whatToSearch);
  },

  syncFolderList: function(callback) {
    return this._receivePiece.syncFolderList(callback);
  },

  sendMessage: function(composer, callback) {
    return this._sendPiece.sendMessage(
      composer,
      function(err, errDetails) {
        if (!err) {
          // The saving is done asynchronously as a best-effort.
          this._receivePiece.saveSentMessage(composer);
        }
        callback(err, errDetails, null);
      }.bind(this));
  },

  getFolderStorageForFolderId: function(folderId) {
    return this._receivePiece.getFolderStorageForFolderId(folderId);
  },

  getFolderMetaForFolderId: function(folderId) {
    return this._receivePiece.getFolderMetaForFolderId(folderId);
  },

  runOp: function(op, mode, callback) {
    return this._receivePiece.runOp(op, mode, callback);
  },

  /**
   * Kick off jobs to create required folders, both locally and on the
   * server. See imap/account.js and activesync/account.js for documentation.
   *
   * @param {function} callback
   *   Called when all jobs have run.
   */
  ensureEssentialOnlineFolders: function(callback) {
    return this._receivePiece.ensureEssentialOnlineFolders(callback);
  },

  getFirstFolderWithType: $acctmixins.getFirstFolderWithType,

  upgradeFolderStoragesIfNeeded: function() {
    for (var key in this._receivePiece._folderStorages) {
      var storage = this._receivePiece._folderStorages[key];
      storage.upgradeIfNeeded();
    }
  }
};

}); // end define
;
/**
 * Configurator for imap+smtp and pop3+smtp.
 **/

define(
  'composite/configurator',[
    'logic',
    '../accountcommon',
    '../a64',
    '../allback',
    './account',
    '../date',
    'require',
    'exports'
  ],
  function(
    logic,
    $accountcommon,
    $a64,
    $allback,
    $account,
    $date,
    require,
    exports
  ) {

var allbackMaker = $allback.allbackMaker;

exports.account = $account;
exports.configurator = {
  tryToCreateAccount: function(universe, userDetails, domainInfo,
                               callback) {
    var credentials, incomingInfo, smtpConnInfo, incomingType;
    if (domainInfo) {
      incomingType = (domainInfo.type === 'imap+smtp' ? 'imap' : 'pop3');
      var password = null;
      // If the account has an outgoingPassword, use that; otherwise
      // use the main password. We must take care to treat null values
      // as potentially valid in the future, if we allow password-free
      // account configurations.
      if (userDetails.outgoingPassword !== undefined) {
        password = userDetails.outgoingPassword;
      } else {
        password = userDetails.password;
      }
      credentials = {
        username: domainInfo.incoming.username,
        password: userDetails.password,
        outgoingUsername: domainInfo.outgoing.username,
        outgoingPassword: password,
      };
      if (domainInfo.oauth2Tokens) {
        credentials.oauth2 = {
          accessToken: domainInfo.oauth2Tokens.accessToken,
          expireTimeMS: domainInfo.oauth2Tokens.expireTimeMS,
          // Treat the access token like it was recently retrieved; although we
          // generally expect the XOAUTH2 case should go through without
          // failure, in the event something is wrong, immediately re-fetching
          // a new accessToken is not going to be useful for us.
          _transientLastRenew: $date.PERFNOW()
        };
      }
      incomingInfo = {
        hostname: domainInfo.incoming.hostname,
        port: domainInfo.incoming.port,
        crypto: (typeof domainInfo.incoming.socketType === 'string' ?
                 domainInfo.incoming.socketType.toLowerCase() :
                 domainInfo.incoming.socketType),
      };

      if (incomingType === 'pop3') {
        incomingInfo.preferredAuthMethod = null;
      }
      smtpConnInfo = {
        emailAddress: userDetails.emailAddress, // used for probing
        hostname: domainInfo.outgoing.hostname,
        port: domainInfo.outgoing.port,
        crypto: (typeof domainInfo.outgoing.socketType === 'string' ?
                 domainInfo.outgoing.socketType.toLowerCase() :
                 domainInfo.outgoing.socketType),
      };
    }

    // Note: For OAUTH accounts, the credentials may be updated
    // in-place if a new access token was required. We don't need to
    // explicitly save those changes here because we define the
    // account with the same object below.
    var incomingPromise = new Promise(function(resolve, reject) {
      if (incomingType === 'imap') {
        require(['../imap/probe'], function(probe) {
          probe.probeAccount(credentials, incomingInfo).then(resolve, reject);
        });
      } else {
        require(['../pop3/probe'], function(probe) {
          probe.probeAccount(credentials, incomingInfo).then(resolve, reject);
        });
      }
    });

    var outgoingPromise = new Promise(function(resolve, reject) {
      require(['../smtp/probe'], function(probe) {
        probe.probeAccount(credentials, smtpConnInfo).then(resolve, reject);
      });
    });

    // Note: Promise.all() will fire the catch handler as soon as one
    // of the promises is rejected. While this means we will only see
    // the first error that returns, it actually works well for our
    // semantics, as we only notify the user about one side's problems
    // at a time.
    Promise.all([incomingPromise, outgoingPromise])
      .then(function(results) {
        var incomingConn = results[0].conn;
        var defineAccount;

        if (incomingType === 'imap') {
          defineAccount = this._defineImapAccount;
        } else if (incomingType === 'pop3') {
          incomingInfo.preferredAuthMethod = incomingConn.authMethod;
          defineAccount = this._definePop3Account;
        }
        defineAccount.call(this,
                           universe, userDetails, credentials,
                           incomingInfo, smtpConnInfo, incomingConn,
                           callback);
      }.bind(this))
      .catch(function(ambiguousErr) {
        // One of the account sides failed. Normally we leave the
        // IMAP/POP3 side open for reuse, but if the SMTP
        // configuration falied we must close the incoming connection.
        // (If the incoming side failed as well, we won't receive the
        // `.then` callback.)
        incomingPromise.then(function incomingOkButOutgoingFailed(result) {
          result.conn.close();
          // the error is no longer ambiguous; it was SMTP
          callback(ambiguousErr, /* conn: */ null,
                   { server: smtpConnInfo.hostname });
        }).catch(function incomingFailed(incomingErr) {
          callback(incomingErr, /* conn: */ null,
                   { server: incomingInfo.hostname });
        });
     });
 },

  recreateAccount: function(universe, oldVersion, oldAccountInfo, callback) {
    var oldAccountDef = oldAccountInfo.def;

    var credentials = {
      username: oldAccountDef.credentials.username,
      password: oldAccountDef.credentials.password,
      // (if these two keys are null, keep them that way:)
      outgoingUsername: oldAccountDef.credentials.outgoingUsername,
      outgoingPassword: oldAccountDef.credentials.outgoingPassword,
      authMechanism: oldAccountDef.credentials.authMechanism,
      oauth2: oldAccountDef.credentials.oauth2
    };
    var accountId = $a64.encodeInt(universe.config.nextAccountNum++);
    var oldType = oldAccountDef.type || 'imap+smtp';
    var accountDef = {
      id: accountId,
      name: oldAccountDef.name,
      authenticatorId: oldAccountDef.authenticatorId,
      label: oldAccountDef.label,

      type: oldType,
      receiveType: oldType.split('+')[0],
      sendType: 'smtp',

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
      receiveConnInfo: {
        hostname: oldAccountDef.receiveConnInfo.hostname,
        port: oldAccountDef.receiveConnInfo.port,
        crypto: oldAccountDef.receiveConnInfo.crypto,
        preferredAuthMethod:
          oldAccountDef.receiveConnInfo.preferredAuthMethod || null,
      },
      sendConnInfo: {
        hostname: oldAccountDef.sendConnInfo.hostname,
        port: oldAccountDef.sendConnInfo.port,
        crypto: oldAccountDef.sendConnInfo.crypto,
      },

      identities: $accountcommon.recreateIdentities(universe, accountId,
                                     oldAccountDef.identities)
    };

    this._loadAccount(universe, accountDef,
                      oldAccountInfo.folderInfo, null, function(account) {
      callback(null, account, null);
    });
  },

  /**
   * Define an account now that we have verified the credentials are good and
   * the server meets our minimal functionality standards.  We are also
   * provided with the protocol connection that was used to perform the check
   * so we can immediately put it to work.
   */
  _defineImapAccount: function(universe, userDetails, credentials,
                               incomingInfo, smtpConnInfo, imapProtoConn,
                               callback) {
    var accountId = $a64.encodeInt(universe.config.nextAccountNum++);
    var accountDef = {
      id: accountId,
      name: userDetails.accountName || userDetails.emailAddress,
      authenticatorId: userDetails.authenticatorId || null,
      label: userDetails.label ||
             userDetails.emailAddress.split('@')[1].split('.')[0],
      defaultPriority: $date.NOW(),

      type: 'imap+smtp',
      receiveType: 'imap',
      sendType: 'smtp',

      syncRange: 'auto',
      syncInterval: userDetails.syncInterval || 0,
      notifyOnNew: userDetails.hasOwnProperty('notifyOnNew') ?
                   userDetails.notifyOnNew : true,
      playSoundOnSend: userDetails.hasOwnProperty('playSoundOnSend') ?
                   userDetails.playSoundOnSend : true,

      credentials: credentials,
      receiveConnInfo: incomingInfo,
      sendConnInfo: smtpConnInfo,
      syncEnable: true,
      public: false,

      identities: [
        {
          id: accountId + '/' +
                $a64.encodeInt(universe.config.nextIdentityNum++),
          name: userDetails.displayName,
          address: userDetails.emailAddress,
          replyTo: null,
          signature: null,
          signatureEnabled: false
        },
      ]
    };

    this._loadAccount(universe, accountDef, null,
                      imapProtoConn, function(account) {
      callback(null, account, null);
    });
  },

  /**
   * Define an account now that we have verified the credentials are good and
   * the server meets our minimal functionality standards.  We are also
   * provided with the protocol connection that was used to perform the check
   * so we can immediately put it to work.
   */
  _definePop3Account: function(universe, userDetails, credentials,
                               incomingInfo, smtpConnInfo, pop3ProtoConn,
                               callback) {
    var accountId = $a64.encodeInt(universe.config.nextAccountNum++);
    var accountDef = {
      id: accountId,
      name: userDetails.accountName || userDetails.emailAddress,
      authenticatorId: userDetails.authenticatorId || null,
      label: userDetails.label ||
             userDetails.emailAddress.split('@')[1].split('.')[0],
      defaultPriority: $date.NOW(),

      type: 'pop3+smtp',
      receiveType: 'pop3',
      sendType: 'smtp',

      syncRange: 'auto',
      syncInterval: userDetails.syncInterval || 0,
      notifyOnNew: userDetails.hasOwnProperty('notifyOnNew') ?
                   userDetails.notifyOnNew : true,
      playSoundOnSend: userDetails.hasOwnProperty('playSoundOnSend') ?
                   userDetails.playSoundOnSend : true,

      credentials: credentials,
      receiveConnInfo: incomingInfo,
      sendConnInfo: smtpConnInfo,
      syncEnable: true,
      public: false,

      identities: [
        {
          id: accountId + '/' +
                $a64.encodeInt(universe.config.nextIdentityNum++),
          name: userDetails.displayName,
          address: userDetails.emailAddress,
          replyTo: null,
          signature: null,
          signatureEnabled: false
        },
      ],
    };

    this._loadAccount(universe, accountDef, null,
                      pop3ProtoConn, function(account) {
      callback(null, account, null);
    });
  },

  /**
   * Save the account def and folder info for our new (or recreated) account and
   * then load it.
   */
  _loadAccount: function(universe, accountDef, oldFolderInfo, protoConn,
                         callback) {
    var canceledAddress = universe.getNeedCancelAccount();
    if (canceledAddress && canceledAddress === accountDef.name) {
      console.log('Cancel setup this account(account name: ' +
                   accountDef.name + ')!!!');
      universe.resetNeedCancelAccount();
      return;
    }
    var folderInfo;
    if (accountDef.receiveType === 'imap') {
      folderInfo = {
        $meta: {
          nextFolderNum: 0,
          nextMutationNum: 0,
          lastFolderSyncAt: 0,
          capability: (oldFolderInfo && oldFolderInfo.$meta.capability) ||
            protoConn.capability
        },
        $mutations: [],
        $mutationState: {},
      };
    } else { // POP3
      folderInfo = {
        $meta: {
          nextFolderNum: 0,
          nextMutationNum: 0,
          lastFolderSyncAt: 0,
        },
        $mutations: [],
        $mutationState: {},
      };
    }
    universe.saveAccountDef(accountDef, folderInfo);
    universe._loadAccount(accountDef, folderInfo, protoConn, callback);
  },
};

}); // end define
;