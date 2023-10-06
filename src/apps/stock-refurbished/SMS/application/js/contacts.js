/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
(function(exports) {
  'use strict';
  /*global fb, Settings, Utils */
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
  /**
   * isMatch
   *
   * Validate a contact record against a list of terms by specified fields
   *
   * @param {Object} contact a contact record object.
   *
   * @param {Object} criteria fields and terms to validate a contact.
   *        - fields (fields of a contact record).
   *        - terms (terms to validate against contact record field values).
   * @param {Function} filterFn function accepts 2 arguments for
   *                             comparison.
   *
   */
  function isMatch(contact, criteria, filterFn) {
    /**
     * Validation Strategy
     *
     * 1. Let _found_ be a register of confirmed terms
     * 2. Let _contact_ be a contact record.
     * 3. For each _term_ [...input list], with the label _outer_
     *   - For each _field_ of [givenName, familyName]
     *     - For each _value_ of _contact_[ _field_ ]
     *       - Let _found_[ _term_ ] be the result of calling
     *         _filterFn_( _value_, _term_).
     *         - If _found_[ _term_ ] is **true**, continue to
     *           loop labelled _outer_
     * 4. If every value of _key_ in _found_ is **true** return **true**,
     *    else return **false**
    */
    let found = {};

    // The outer loop is specifically labelled to allow the
    // nested condition a way out of the second and third loop.
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

    // Pending the publication of a list of ES6 features available in Firefox
    // and deemed "safe enough" for FirefoxOS development, the above code is a
    // stand-in for what should be written as:
    // outer:
    // for (var term of criteria.terms) {
    //   for (var field of criteria.fields) {
    //     for (var value of contact[field]) {
    //       if (found[term] = value.toLowerCase().contains(term)) {
    //         continue outer;
    //       }
    //     }
    //   }
    // }
    return Object.keys(found).every(function(key) {
      return found[key];
    });
  }

  exports.Contacts = {

    findBy: function contacts_findBy(filter, callback) {
      let lower = [];
      let filterValue = (filter.filterValue || '').trim();
      let terms, request;

      if (!navigator.mozContacts || !filterValue.length) {
        setTimeout(function() {
          callback(
            /**
             * Bailout Strategy
             *
             * 1. A _missing_ filter.filterValue will results in an
             *    error when passed to mozContacts.find, bailing out
             *    early avoids the additional overhead of making a
             *    request that we know will fail.
             *
             * 2. Missing navigator.mozContacts API or empty but
             *    present filter.filterValue make the app useless,
             *    so prevent unpredictable state by making the
             *    result a no-op.
             *
             */
            typeof filter.filterValue === 'undefined' ? null : [], {}
          );
        });
        return;
      }

      /**
       * Lookup Strategy
       *
       * 1. Create a list of terms from the filterValue string
       *
       * 2. If only 1 term, set filterValue to that term.
       *
       * 3. If more than 1 term, find the length predominate term.
       *     a. let initial be an empty string
       *       (Do not use default first item in terms, or it will not
       *       be pushed into the lowercase list)
       *     b. For each term of terms
       *         i. Push lowercased term into a list of lowercased terms
       *         ii. If the current term.length is greater then initial.length,
       *             return the term, otherwise return the initial.
       *
       * 4. If filterValue.length is < 3, set the filterLimit to 10
       *
       * 5. Remove the length predominate term from the list of validation terms
       *
       * 6. Add back the original search value, this is needed for matching
       *     multi-word queries
       *
       * 7. Make a mozContact.find request with the length predominate term
       *     as the filter.filterValue.
       *
       * 8. In the mozContacts.find request success handler, filter the
       *     results by evaluating each contact record against
       *     the list of validation terms.
       */

      // Step 1
      let rspaces = /\s+/;
      terms = filterValue.split(rspaces);

      filter.filterValue = terms.length === 1 ?
        // Step 2
        terms[0] :
        // Step 3
        terms.reduce(function(initial, term) {
          // Step 3.b.i
          // (used as a criteria list for isMatch)
          lower.push(term.toLowerCase());
          // Step 3.b.ii
          return term.length > initial.length ? term : initial;
        // Step 3.a
        }, '');

      // Step 4
      if (filter.filterValue.length < 3) {
        filter.filterLimit = 10;
      }

      // Step 5
      lower.splice(lower.indexOf(filter.filterValue.toLowerCase()), 1);

      // Step 6
      // This would be much nicer using spread operator
      lower.push.apply(lower, terms);

      // Step 7
      request = navigator.mozContacts.find(filter);

      request.onsuccess = function onsuccess() {
        let contacts = this.result.slice();
        let fields = ['tel', 'givenName', 'familyName', 'name'];
        if (Settings.supportEmailRecipient) {
          fields.push('email');
        }
        let criteria = { fields: fields, terms: lower };
        let results = [];
        let contact;

        // Step 8
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
        });
      };

      request.onerror = function onerror() {
        // When an error occurs, regardless of completed count,
        // clear the onsuccess handler from this request and immediately
        // invoke the callback with a `null` argument.
        this.onsuccess = this.onerror = null;
        callback(null);
      };
    },

    findByString: function contacts_findBy(filterValue, callback) {
      this.findContactByString(filterValue, callback);
    },

    findContactByString: function contacts_findBy(filterValue, callback) {
      let props = ['tel', 'givenName', 'familyName', 'name'];
      if (Settings.supportEmailRecipient) {
        props.push('email');
      }
      return this.findBy({
        filterBy: props,
        filterOp: 'contains',
        filterValue: filterValue
      }, callback);
    },

    findExact: function contacts_findBy(filterValue, callback) {
      return this.findBy({
        filterBy: ['givenName', 'familyName', 'name'],
        filterOp: 'contains',
        filterValue: filterValue
      }, (results) => {
        let contact = results && results.length ? results[0] : null;
        let criteria = {
          fields: ['name'],
          terms: [filterValue]
        };
        let isExact = false;

        if (contact) {
          isExact = isMatch(contact, criteria, filterFns.equality);
        }

        callback(isExact ? [contact] : []);
      });
    },

    findByPhoneNumber: function contacts_findByPhone(filterValue, callback) {
      return this.findBy({
        filterBy: ['tel'],
        filterOp: 'fuzzyMatch',
        filterValue: filterValue.replace(/\s+/g, '')
      },
      function(results) {
        if (results && results.length) {
          callback(results);
        } else {
          callback([]);
        }
      });
    },

    findByAddress: function contacts_findByAddress(fValue, callback) {
      if (Settings.supportEmailRecipient && Utils.isEmailAddress(fValue)) {
        this.findExactByEmail(fValue, callback);
      } else {
        this.findByPhoneNumber(fValue, callback);
      }
    },

    findExactByEmail: function contacts_findExactByEmail(fValue, callback) {
      // the lower char will be recognised by contact DB.
      fValue = fValue.toLocaleLowerCase();
      return this.findBy({
        filterBy: ['email'],
        filterOp: 'equals',
        filterValue: fValue
      }, callback);
    },
  };
}(this));
