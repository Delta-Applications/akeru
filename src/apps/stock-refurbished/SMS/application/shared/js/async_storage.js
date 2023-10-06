/* globals indexedDB */
/**
 * This file defines an asynchronous version of the localStorage API, backed by
 * an IndexedDB database.  It creates a global asyncStorage object that has
 * methods like the localStorage object.
 *
 * To store a value use setItem:
 *
 *   asyncStorage.setItem('key', 'value');
 *
 * If you want confirmation that the value has been stored, pass a callback
 * function as the third argument:
 *
 *  asyncStorage.setItem('key', 'newvalue', function() {
 *    console.log('new value stored');
 *  });
 *
 * To read a value, call getItem(), but note that you must supply a callback
 * function that the value will be passed to asynchronously:
 *
 *  asyncStorage.getItem('key', function(value) {
 *    console.log('The value of key is:', value);
 *  });
 *
 * Note that unlike localStorage, asyncStorage does not allow you to store and
 * retrieve values by setting and querying properties directly. You cannot just
 * write asyncStorage.key; you have to explicitly call setItem() or getItem().
 *
 * removeItem(), clear(), length(), and key() are like the same-named methods of
 * localStorage, but, like getItem() and setItem() they take a callback
 * argument.
 *
 * The asynchronous nature of getItem() makes it tricky to retrieve multiple
 * values. But unlike localStorage, asyncStorage does not require the values you
 * store to be strings.  So if you need to save multiple values and want to
 * retrieve them together, in a single asynchronous operation, just group the
 * values into a single object. The properties of this object may not include
 * DOM elements, but they may include things like Blobs and typed arrays.
 *
 * Unit tests are in apps/gallery/test/unit/asyncStorage_test.js
 */

this.asyncStorage = (function() {
  'use strict';

  var DBNAME = 'asyncStorage';
  var DBVERSION = localStorage.async_storage_db_ver || 1;
  var STORENAME = 'keyvaluepairs';
  var db = null;
  var count = 3;

  function withDatabase(f) {
    if (db) {
      f();
    } else {
      var openreq = indexedDB.open(DBNAME, DBVERSION);
      openreq.onerror = function withStoreOnError() {
        console.error('asyncStorage: can\'t open database:',
            openreq.error.name);
        window.close();
      };
      openreq.onupgradeneeded = function withStoreOnUpgradeNeeded() {
        // First time setup: create an empty object store
        openreq.result.createObjectStore(STORENAME);
      };
      openreq.onsuccess = function withStoreOnSuccess() {
        db = openreq.result;
        // XXX, for bug 16915. There's case that when first enter
        // some app, but quit (app killed) right between db file created
        // and the asynchronous step to create related object store. Next time
        // enter the app, we have a database with no object store which may
        // lead to malfunctions. Here the workaround is to increase DB version
        // to recreate object store again if not found.

        // Not only asyncStorage, we may have same issue everywhere
        // a new indexDB is created, but chances are rare.
        if (db.objectStoreNames.contains(STORENAME)) {
          localStorage.async_storage_db_ver = DBVERSION;
          f();
        } else {
          if (count--) {
            db.close();
            db = null;
            DBVERSION++;
            withDatabase(f);
          }
        }
      };
    }
  }

  function withStore(type, callback, oncomplete) {
    withDatabase(function() {
      var transaction = db.transaction(STORENAME, type);
      if (oncomplete) {
        transaction.oncomplete = oncomplete;
      }
      callback(transaction.objectStore(STORENAME));
    });
  }

  function getItem(key, callback) {
    var req;
    withStore('readonly', function getItemBody(store) {
      req = store.get(key);
      req.onerror = function getItemOnError() {
        console.error('Error in asyncStorage.getItem(): ', req.error.name);
      };
    }, function onComplete() {
      var value = req.result;
      if (value === undefined) {
        value = null;
      }
      callback(value);
    });
  }

  function setItem(key, value, callback) {
    withStore('readwrite', function setItemBody(store) {
      var req = store.put(value, key);
      req.onerror = function setItemOnError() {
        console.error('Error in asyncStorage.setItem(): ', req.error.name);
      };
    }, callback);
  }

  function removeItem(key, callback) {
    withStore('readwrite', function removeItemBody(store) {
      var req = store.delete(key);
      req.onerror = function removeItemOnError() {
        console.error('Error in asyncStorage.removeItem(): ', req.error.name);
      };
    }, callback);
  }

  function clear(callback) {
    withStore('readwrite', function clearBody(store) {
      var req = store.clear();
      req.onerror = function clearOnError() {
        console.error('Error in asyncStorage.clear(): ', req.error.name);
      };
    }, callback);
  }

  function length(callback) {
    var req;
    withStore('readonly', function lengthBody(store) {
      req = store.count();
      req.onerror = function lengthOnError() {
        console.error('Error in asyncStorage.length(): ', req.error.name);
      };
    }, function onComplete() {
      callback(req.result);
    });
  }

  function key(n, callback) {
    if (n < 0) {
      callback(null);
      return;
    }

    var req;
    withStore('readonly', function keyBody(store) {
      var advanced = false;
      req = store.openCursor();
      req.onsuccess = function keyOnSuccess() {
        var cursor = req.result;
        if (!cursor) {
          // this means there weren't enough keys
          return;
        }
        if (n === 0 || advanced) {
          // Either 1) we have the first key, return it if that's what they
          // wanted, or 2) we've got the nth key.
          return;
        }

        // Otherwise, ask the cursor to skip ahead n records
        advanced = true;
        cursor.advance(n);
      };
      req.onerror = function keyOnError() {
        console.error('Error in asyncStorage.key(): ', req.error.name);
      };
    }, function onComplete() {
      var cursor = req.result;
      callback(cursor ? cursor.key : null);
    });
  }

  return {
    getItem: getItem,
    setItem: setItem,
    removeItem: removeItem,
    clear: clear,
    length: length,
    key: key
  };
}());

