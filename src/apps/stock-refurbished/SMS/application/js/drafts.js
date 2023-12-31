/*global asyncStorage,
         InterInstanceEventDispatcher,
         Utils
*/
(function(exports) {
  'use strict';

  /**
   * Drafts
   *
   * A collection of active Draft objects, indexed by thread id.
   */
  exports.Drafts = {
    /**
     * List
     *
     * An Array-like object that contains Draft objects.
     */
    List: DraftList,

    draftIndex: new Map(),

    deferredDraftRequest: null,
    /**
     * size
     *
     * Returns the number of Draft Lists.
     *
     * There is one Draft.List per Thread and
     * one Draft.List for all threadless Drafts.
     *
     * @return {Number} Maps to draftIndex size property.
     */
    get size() {
      return this.draftIndex.size;
    },
    /**
     * add
     *
     * Push a Draft object or an object that has
     * all the properties of a Draft instance
     * to the Drafts collection. If the object
     * isn't an instance of Draft, initialize
     * a new Draft.
     *
     * @param  {Object}  draft  Draft-like object.
     *
     * @return {Drafts} return the Drafts object.
     */
    add: function(draft) {
      let threadId;
      let thread;
      let stored;

      if (draft) {
        if (!(draft instanceof Draft)) {
          draft = new Draft(draft);
        }

        threadId = draft.threadId || null;
        thread = this.draftIndex.get(threadId) || [];
        stored = thread[thread.length - 1];

        // If there is an existing draft for this
        // threadId, delete it.
        // This should be replaced by a general
        // replacement method.
        if (threadId !== null && thread.length) {
          this.delete(stored);
        }

        // If there is an existing threadless draft
        // with the same id, delete it.
        // This should be replaced by a general
        // replacement method.
        if (threadId === null && thread.length) {
          thread.some(function(d) {
            if (d.id === draft.id) {
              this.delete(d);
              stored = null;
              return true;
            }
          }, this);
        }

        thread.push(draft);
        this.draftIndex.set(threadId, thread);
        this.store();
      }
      return this;
    },
    /**
     * delete
     *
     * Delete a draft record from the collection.
     *
     * @param  {Draft} draft draft to delete.
     *
     * @return {Drafts} return the Drafts object.
     */
    delete: function(draft) {
      let thread;
      let index;

      if (draft) {
        thread = this.draftIndex.get(draft.threadId);
        if (!thread) {
          return this;
        }
        index = thread.indexOf(draft);

        // For cases where the provided "draft" object
        // could not be found by object _identity_:
        //  - If a thread was found by draft.threadId, but
        //    draft had no id property, delete all drafts
        //    for this threadId
        //  - Otherwise, the draft object might be a copy,
        //    or manually composed "draft object", so iterate
        //    the drafts and look for the one matching the
        //    provided draft.id.
        if (index === -1) {
          if (thread && typeof draft.id === 'undefined') {
            thread.length = 0;
          } else {
            if (thread) {
              thread.some(function(stored, i) {
                if (stored.id === draft.id) {
                  index = i;
                  return true;
                }
              });
            }
          }
        }

        if (index > -1) {
          thread.splice(index, 1);
        }
      }
      return this;
    },
    /**
     * byThreadId
     *
     * Returns all the drafts for the specified thread id.
     *
     * Calling with `null` will return a `Draft.List` object
     * containing all of the threadless draft objects.
     *
     * eg.
     *
     *   Drafts.byThreadId(null)
     *
     *
     *
     * @param  {Number}  id thread id of the drafts to return.
     *
     * @return {Draft.List}  return Draft.List containing drafts for thread id.
     */
    byThreadId: function(id) {
      return new Drafts.List(Drafts.draftIndex.get(id));
    },
    /**
     * get
     *
     * Return the draft object with the specified id.
     *
     * @param  {Number}  id thread id of the drafts to return.
     *
     * @return {Draft}  Draft object or undefined.
     */
    get: function(id) {
      let draft;

      this.draftIndex.forEach((records) => {
        if (!draft) {
          draft = records.find(function(record) {
            // Ensure a number is used for the comparison,
            // as this value may come from a dataset property.
            return record.threadId === +id || record.id === +id;
          });
        }
      });

      return draft;
    },
    /**
     * forEach
     *
     * Call the callback on each draft in the
     * draft index (the latest draft for a valid
     * threadId and all the drafts for a null
     * threadId).
     *
     * @return {Undefined}
     */
    forEach: function(callback, thisArg) {
      if (thisArg) {
        callback = callback.bind(thisArg);
      }
      this.draftIndex.forEach(function(drafts, threadId) {
        if (threadId) {
          let latest = drafts[drafts.length - 1];
          callback(latest, threadId);
        } else {
          // All the null threadId drafts are
          // valid thread-less drafts
          drafts.forEach(function(draft) {
            callback(draft, null);
          });
        }
      });
    },
    /**
     * clear
     *
     * Delete drafts from the map.
     *
     * @return {Drafts} return the Drafts object.
     */
    clear: function() {
      this.draftIndex = new Map();
      this.deferredDraftRequest = null;
      return this;
    },
    /**
     * store
     *
     * Store draftIndex held in memory to local storage
     *
     * @return {Undefined} void return.
     */
    store: function() {
      // Once ES6 syntax is allowed,
      // replace the forEach operations below with the following line:
      // asyncStorage.setItem('draft index', [...draftIndex]);
      let entries = [];
      this.draftIndex.forEach(function(v, k) {
        entries.push([k, v]);
      });
      asyncStorage.setItem('draft index', entries, () => {
        InterInstanceEventDispatcher.emit('drafts-changed');
      });
    },
    /**
     * Requests drafts from asyncStorage or in-memory cache. Result is cached.
     * @param {Boolean} force Indicates whether we should respect already cached
     * result or _force_ asyncStorage request once again.
     * @returns {Promise.<Drafts.List>} List of threadless drafts.
     */
    request: function(force) {
      // Loading from storage only happens once or when specifically requested
      // with force parameter.
      if (this.deferredDraftRequest && !force) {
        return this.deferredDraftRequest.promise;
      }

      this.deferredDraftRequest = Utils.Promise.defer();

      asyncStorage.getItem('draft index', (records) => {
        // Convert every plain JS draft object into Draft "class" instance.
        // record[0] is the threadId or null key, record[1] is the array of
        // draft objects associated with that threadId or null key.
        records && records.forEach((record) => {
          record[1] = record[1].map((draft) => new Draft(draft));
        });
        this.draftIndex = new Map(records || []);

        // Return list of threadless drafts
        this.deferredDraftRequest.resolve(Drafts.byThreadId(null));
      });

      return this.deferredDraftRequest.promise;
    }
  };

  /**
   * DraftList
   *
   * An Array-like object containing Draft objects.
   *
   * @param  {Array}  initializer  array containing Draft objects.
   *
   * @return {Undefined} void return.
   */
  let priv = new WeakMap();
  function DraftList(initializer) {
    priv.set(this, initializer || []);
  }

  DraftList.prototype = {
    /**
     * length
     *
     * A readonly accessor that returns the number of drafts.
     *
     * @return {Number} return the length of the drafts list.
     */
    get length() {
      return priv.get(this).length;
    },
    /**
     * latest
     *
     * The latest draft for this Drafts.List
     */
    get latest() {
      let list = priv.get(this);
      return list.length ? list[list.length - 1] : null;
    },
    /**
     * forEach
     *
     * Iterate over the list of Draft objects
     * and call callback on each.
     *
     * @param  {Function} callback to call on each draft.
     * @param  {Object} thisArg set callback's this.
     *
     * @return {Undefined} void return.
     */
    forEach: function(callback, thisArg) {
      let drafts = priv.get(this);

      if (thisArg) {
        callback = callback.bind(thisArg);
      }

      for (let i = 0; i < drafts.length; i++) {
        callback(drafts[i]);
      }
    }
  };

  /**
   * Draft
   *
   * A message-like object containing unsent
   * message content to be stored temporarily
   * in a Drafts collection.
   *
   * @param {Object}  opts  Draft or empty object.
   */
  function Draft(opts) {
    let draft = opts || {};

    if (draft.id && typeof draft.id !== 'number') {
      throw new Error('Draft id must be a number');
    }

    this.id = draft.id || guid();
    this.recipients = draft.recipients || [];
    this.content = draft.content || [];
    this.subject = draft.subject || '';
    this.timestamp = +draft.timestamp || Date.now();
    this.threadId = draft.threadId || null;
    this.type = draft.type;
    this.attachment = draft.attachment || [];
    this.isEdited = false;
    this.isGroup = draft.isGroup || false;
  }

  function guid() {
    return +(Date.now() + '' + (Math.random() * 1000 | 0));
  }

  exports.Draft = Draft;
}(this));
