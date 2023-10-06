/*global GestureDetector, Navigation, SharedComponents, Utils,
         Settings, ThreadUI */

(function(exports) {
  'use strict';
  // For Recipients it makes sense to refer to the
  // weakmap reference as "view", since that's what it
  // points to.
  //
  // For Recipients' internal data, use "data"
  //
  let view = new WeakMap();
  let priv = new WeakMap();
  let data = new WeakMap();
  let events = new WeakMap();
  let relation = new WeakMap();
  const rdigit = /^\d+$/;

  let removeIndex = 0;

  function Recipient(opts) {
    let number;

    opts = opts || {};
    this.name = opts.name || opts.number || '';
    this.number = (opts.number || '') + '';
    this.email = opts.email || '';
    this.editable = opts.editable || 'true';
    this.role = this.editable ? 'textbox' : 'button';
    this.source = opts.source || 'manual';
    this.type = opts.type || '';
    this.carrier = opts.carrier || '';
    this.className = ActivityHandler.isCustomMessage ?
      'recipient' :
      'recipient navigable';
    this.isEmail = Settings.supportEmailRecipient &&
                   Utils.isEmailAddress(this.number);
    // isLookupable
    //  the recipient was accepted by pressing <enter>
    //
    this.isLookupable = opts.isLookupable || false;

    // isInvalid
    //  the typed value is non-digit and we've determined
    //  that there are no matches in the user's contacts
    //
    this.isInvalid = opts.isInvalid || false;

    // isQuestionable
    //  the typed value is non-digit and may have a match
    //  in the user's contacts
    //
    this.isQuestionable = opts.isQuestionable || false;

    // If the recipient was entered manually and
    // the trimmed, typed text starts with a non-number
    // (ignoring the presense of a '+'), the input value
    // is questionable and may be invalid.
    number = this.number[0] === '+' ? this.number.slice(1) : this.number;

    if (this.isEmail) {
      this.className += ' email';
    } else if (this.source === 'manual' && !rdigit.test(number)) {
      this.isQuestionable = true;
    }

    // If the recipient is either questionable or invalid,
    // mark it visually for the user.
    //
    if (this.isQuestionable || this.isInvalid) {
      this.className += ' invalid';
    }
  }

  /**
   * set
   *
   * Set the value of one or more Recipient instance properties
   *
   * @param {Object}  dict  Object of one recipient data.
   *
   */
  Recipient.prototype.set = function(dict) {
    let length = Recipient.FIELDS.length;
    let key;

    for (let i = 0; i < length; i++) {
      key = Recipient.FIELDS[i];
      this[key] = dict[key];
    }
    return this;
  };

  /**
   * clone
   *
   * Create a clone Recipient record. This
   * is used for exposing a Recipient record
   * to external code, specifically in events.
   *
   * @return {Recipient}
   *
   */
  Recipient.prototype.clone = function() {
    return new Recipient(this);
  };

  Recipient.FIELDS = [
    'name', 'number', 'email', 'editable', 'source',
    'type', 'carrier', 'isQuestionable', 'isInvalid', 'isLookupable'
  ];

  /**
   * Recipients
   *
   * Create a Recipients list that backs the Recipients.View
   *
   * Recipients list will reject duplicates.
   *
   * @param {Object} setup Required parameters for created a Recipients list.
   *                  - outer, string ID of outer recipient display element.
   *                  - inner, string ID of inner recipient display element.
   *                  - template, Precompiled Template instance.
   */
  function Recipients(setup) {
    if (!setup) {
      throw new Error('`setup` missing');
    }

    if (!setup.template) {
      throw new Error('`setup.template` missing');
    }

    if (!setup.outer) {
      throw new Error('`setup.outer` missing');
    }

    if (!setup.inner) {
      throw new Error('`setup.inner` missing');
    }

    let list = [];

    Object.defineProperties(this, {
      length: {
        get: function() {
          return list.length;
        },
        set: function(value) {
          let oldLength = list.length;
          list.length = value;
          if (value < oldLength) {
            this.render();
          }
          return value;
        }
      },
      list: {
        get: function() {
          return list.slice();
        }
      },
      numbers: {
        get: function() {
          return list.reduce(function(unique, recipient) {
            let value = recipient.number || recipient.email;
            if (!recipient.isInvalid && unique.indexOf(value) === -1) {
              unique.push(value);
            }
            return unique;
          }, []);
        }
      },
      inputValue: {
        // readonly
        get: function() {
          let node = document.getElementById(setup.inner).lastElementChild;
          return (node && node.isPlaceholder) ?
            node.textContent.trim() : '';
        }
      }
    });

    data.set(this, list);
    events.set(this, { add: [], remove: [], modechange: [] });
    view.set(this, new Recipients.View(this, setup));
  }

  /**
   * on Register an event handler for an "add" or "remove" event.
   *
   * @param  {String}   type Either "add" or "remove".
   * @param  {Function} handler The function to call.
   *
   * @return {Recipients} return the recipients list.
   */
  Recipients.prototype.on = function(type, handler) {
    let handlers = events.get(this);

    if (!handlers[type]) {
      throw new Error('Invalid event type: ' + type);
    }

    handlers[type].push(handler);

    return this;
  };

  /**
   * off Unregister an event handler for an "add" or "remove" event.
   *
   * @param  {String}   type Either "add" or "remove".
   * @param  {Function} handler The reference handler.
   *
   * @return {Recipients} return the recipients list.
   */
  Recipients.prototype.off = function(type, handler) {
    let handlers = events.get(this);

    if (!handlers[type]) {
      throw new Error('Invalid event type: ' + type);
    }

    if (!handler) {
      handlers[type].length = 0;
    } else {
      handlers[type].splice(handlers[type].indexOf(handler), 1);
    }

    return this;
  };

  /**
   * emit Emit an event for an "add" or "remove".
   *
   * @param  {String}   type Either "add" or "remove".
   *
   * @return {Recipients} return the recipients list.
   */
  Recipients.prototype.emit = function(type) {
    let handlers = events.get(this);
    let args = [].slice.call(arguments, 1);
    let handler, stack;

    if (!handlers[type]) {
      throw new Error('Invalid event type: ' + type);
    }

    stack = handlers[type].slice();

    if (stack.length) {
      while ((handler = stack.pop())) {
        handler.apply(null, args);
      }
    }

    return this;
  };
  /**
   * add Push a new recipient to the current recipients list.
   *
   * @param  {Object} entry { name: '', number: '' }.
   *
   * @param  {bool} draftGroup.
   *
   * @return {Recipients} return the recipients list.
   */
  Recipients.prototype.add = function(entry, draftGroup) {
    let list = data.get(this);
    let added;
    /*
    Entry {
      name, number [, editable, source ]
    }
    */

    if (entry.number === undefined) {
      throw new Error('recipient entry missing number');
    }

    // _THIS_ "editable" property maps directly to the DOM attribute of
    // the same name and IS NOT a Boolean field.
    entry.editable = entry.editable || 'false';

    // Whitespace cleanup for the fields that are user-entered.
    ['name', 'number', 'email'].forEach(function(field) {
      if (entry[field]) {
        entry[field] = (entry[field] + '').trim();
      }
    });

    // Don't bother rejecting duplicates, always add every
    // entry to the recipients list. For reference, see:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=880628
    list.push(added = new Recipient(entry));

    if (Compose.type === 'mms' && list.length === 2) {
      ThreadUI.showGroupAlert();
    }

    // XXX: Workaround for cleaning search result while duplicate
    //      Dispatch add event no matter duplicate or not.
    //
    //      Send a "clone" of the added recipient, this protects
    //      the actual Recipient object from being written to
    //      directly.
    this.emit('add', list.length, added.clone());

    // Render the view
    this.render();

    return this;
  };

  /**
   * update Update/replace a recipient at a specific index in the list.
   *
   * @param  {Number} recipOrIndex Recipient or Index to update.
   * @param  {Object} entry { name: '', number: '' }.
   *
   * @return {Recipients} return the recipients list.
   */
  Recipients.prototype.update = function(recipOrIndex, entry) {
    let list = data.get(this);
    let index = typeof recipOrIndex === 'number' ?
      recipOrIndex : list.indexOf(recipOrIndex);

    if (index > -1) {
      // Use the normalization of new Recipient() to
      // correct any missing, but required fields.
      list[index].set(new Recipient(entry));
    }

    return this.render();
  };

  Recipients.prototype.remove = function(recipOrIndex) {
    let list = data.get(this);
    let index = typeof recipOrIndex === 'number' ?
      recipOrIndex : list.indexOf(recipOrIndex);

    if (index === -1) {
      return this;
    }

    list.splice(index, 1);

    this.emit('remove', list.length);

    removeIndex = index;

    return this.render(index);
  };

  Recipients.prototype.render = function() {
    // The view's reset method will render and
    // re-apply the event handlers
    view.get(this).reset();
    view.get(this).focus();

    // XXX, a quick workaround to fix focus issue
    // should revise logics later
    setTimeout( () => {
      NavigationMap.updateFocus();
      ThreadUI.dynamicSK();
    }, 200);
    return this;
  };

  Recipients.prototype.focus = function() {
    view.get(this).focus();
    return this;
  };

  Recipients.prototype.visible = function(type, opts) {
    view.get(this).visible(type, opts || {});
    return this;
  };

  Recipients.prototype.isFocused = function() {
    return view.get(this).isFocused();
  };

  Recipients.prototype.deleteAll = function() {
    let recipientList = data.get(this);
    recipientList.splice(0, recipientList.length);
    this.emit('remove', recipientList.length);
    return this.render();
  };

  /**
   * Recipients.View
   *
   * Create a Recipients.View: The DOM structure associated with
   * the Recipients list
   *
   * @param {Array} owner A collection of the recipients.
   *
   * @param {Object} setup Required parameters for created a Recipients list.
   *                  - outer, string ID of outer recipient display element.
   *                  - inner, string ID of inner recipient display element.
   *                  - template, Precompiled Template instance.
   */

  Recipients.View = function(owner, setup) {
    let inner = document.getElementById(setup.inner);
    let outer = document.getElementById(setup.outer);
    let template = setup.template;
    let nodes = [];
    let clone;
    let outerCss = window.getComputedStyle(outer);

    priv.set(this, {
      owner: owner,
      inner: inner,
      outer: outer,
      template: template,
      active: null,
      nodes: nodes,
      state: {
        isTransitioning: false,
        visible: 'singleline'
      },
      minHeight: parseInt(outerCss.getPropertyValue('min-height'), 10),
      mode: 'singleline-mode'
    });

    clone = inner.cloneNode(true);

    // Used by the "placeholder" accessor to produce
    // new "editable" placeholders, by cloning the
    // first child (element) node
    clone.innerHTML = template.interpolate(new Recipient());
    // empty out the template so :empty matches on placeholders
    clone.firstElementChild.innerHTML = '';

    Object.defineProperties(this, {
      last: {
        get: function() {
          return nodes[nodes.length - 1];
        }
      },
      placeholder: {
        get: function() {
          let node = clone.firstElementChild.cloneNode(true);
          node.isPlaceholder = true;
          return node;
        }
      }
    });

    this.updateMode = Utils.debounce(this.updateMode, 100);

    ['keydown', 'input'].forEach(function(type) {
      outer.addEventListener(type, this, false);
    }, this);

    new GestureDetector(outer).startDetecting();

    // Set focus on the last "placeholder" element
    this.reset().focus();
  };

  Recipients.View.isFocusable = true;

  Recipients.View.suggest = false;

  Recipients.View.prototype.reset = function() {
    // Clear any displayed text (not likely to exist)
    // Render each recipient in the Recipients object
    // Remove (if exist) and Add event listeners
    this.clear().render();
    return this;
  };
  /**
   * clear
   *
   * Empty the inner element by setting its
   * textContent to an empty string.
   *
   * @return {Recipients.View} Recipients.View instance.
   */
  Recipients.View.prototype.clear = function() {
    priv.get(this).inner.textContent = '';
    return this;
  };
  /**
   * render
   *
   * Render a visual list of recipients followed by
   * an editable placeholder.
   *
   * @param  {Object} opts Optional flags.
   *                       - addPlaceholder, force a placeholder
   *                       to be inserted at the end of the
   *                       rendered recipient list.
   *
   * @return {Recipients.View} Recipients.View instance.
   */
  Recipients.View.prototype.render = function(opts) {
    // ES6: This should use destructuring
    let view = priv.get(this);
    let [nodes, inner, template, list] = [
      view.nodes, view.inner, view.template, view.owner.list
    ];
    let length = list.length;
    let html = '';

    opts = opts || {};

    opts.addPlaceholder = opts.addPlaceholder === undefined ?
      true : opts.addPlaceholder;

    if (inner.textContent) {
      this.clear();
    }

    // Loop and render each recipient as HTML view
    for (let i = 0; i < length; i++) {
      html += template.interpolate(list[i]);
    }

    // An optionally provided "editable" object
    // may be passed to the render() method.
    // This object will be used to create a
    // "populated" recipient that the user can
    // edit at will.
    if (opts.editable) {
      opts.addPlaceholder = false;
      html += template.interpolate(opts.editable);
    }

    // If there are any rendered recipients,
    // inject them into the view
    if (html) {
      inner.innerHTML = html;
    }

    // If no specified "editable" recipient,
    // add the placeholder...
    if (opts.addPlaceholder) {
      inner.appendChild(this.placeholder);
    }

    // Truncate the array of nodes.
    // We must avoid reak the reference to the nodes array
    // which is a local binding to array stored in the WeakMap,
    // as other places expect this to remain the same nodes array
    // that it was when it was initialized. (which is why this
    // isn't a re-assignment to a fresh array)
    nodes.length = 0;


    // When there are no actual recipients in the list
    // ignore elements beyond the first editable placeholder
    if (!list.length) {
      nodes.push.apply(nodes, inner.children[0]);
    } else {
      // .apply will convert inner.children to
      // an array internally.
      nodes.push.apply(nodes, inner.children);
    }

    // Finalize the newly created nodes by registering
    // them with their recipient and updating their flags.
    nodes.forEach(function forEachNode(node, i) {
      // Make all displayed nodes contentEditable=false,
      // and ensure that each node's isPlaceholder flag is
      // set to false.
      //
      // This will make the elements appear "accepted"
      // in the recipients list.
      node.isPlaceholder = false;
      node.contentEditable = false;
      node.setAttribute('role', 'button');

      // The last node should be contentEditable=true
      // and isPlaceholder=true
      if (i === nodes.length - 1) {
        node.isPlaceholder = true;
        node.contentEditable = true;
        node.setAttribute('role', 'textbox');
        node.id = 'lastRecipient';
      } else {
        // Map the node to it's entry in the list
        // (only for actual recipient nodes)
        relation.set(node, list[i]);
      }
    });

    if (view.state.visible === 'singleline' && nodes.length) {
      inner.querySelector(':last-child').scrollIntoView(false);
    }

    this.updateMode();
    NavigationMap.reset('thread-messages');

    // Need focus again because the recipients will delete all and add all.
    if (nodes[nodes.length - 1] &&
        document.activeElement.tagName === 'BODY') {
      nodes[nodes.length - 1].focus();
    }
    return this;
  };

  Recipients.View.prototype.isFocused = function() {
    let activeId = document.activeElement.parentNode.id;
    let recipientId = priv.get(this).inner.id;
    return activeId === recipientId;
  };
  /**
   * focus
   *
   * Focus on the last editable in the list.
   * Generally, this will be the placeholder.
   *
   * The behaviour of focus in this Recipients View context can
   * be summarized as:
   *
   *   Place the cursor at the end of any existing text in
   *   an explicit node or the current placeholder node by default.
   *
   *   If the node is the current placeholder, make it editable
   *   and set focus.
   *
   * @return {Recipients.View} Recipients.View instance.
   */
  Recipients.View.prototype.focus = function(node) {
    let view = priv.get(this);
    let range = document.createRange();
    let selection = window.getSelection();

    if (Recipients.View.isFocusable) {
      if (!node) {
        node = view.inner.lastElementChild;
        if (!node.isPlaceholder) {
          node = view.inner.appendChild(this.placeholder);
        }
      }

      if (node && node.isPlaceholder) {
        node.contentEditable = true;
        node.focus();
        node.classList.add('focus');
      }

      range.selectNodeContents(node);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);

      // scroll to the bottom of the inner view
      view.inner.scrollTop = view.inner.scrollHeight;
    }

    this.updateMode();

    return this;
  };

  /**
   * Checks whether recipients view mode (single or multi line) has changed
   * since previous check and notifies listeners with 'modechange' event in this
   * case.
   */
  Recipients.View.prototype.updateMode = function() {
    let view = priv.get(this);

    let mode = view.inner.scrollHeight > view.minHeight ?
        'multiline-mode' : 'singleline-mode';

    if (view.mode !== mode) {
      view.mode = mode;

      // the list in "singleline-mode" should only have "singleline" view
      if (mode === 'singleline-mode' && view.state.visible === 'multiline') {
        this.visible('singleline', {
          refocus: this
        });
      }

      view.owner.emit('modechange', mode);
    }
  };

  const rtype = /^(multi|single)line$/;

  Recipients.View.prototype.visible = function(type, opts) {
    let view = priv.get(this);
    let state = view.state;
    const error = 'visible "type" (multiline or singleline)';

    opts = opts || {};

    if (!type) {
      throw new Error('Missing ' + error);
    }

    if (!rtype.test(type)) {
      throw new Error('Invalid ' + error);
    }

    // Requests to change the visible area
    // can interrupt transitions.
    if (state.visible !== type) {
      state.isTransitioning = false;
    }

    // Requests to change the visible area
    // to the same state that it's in, while
    // still transitioning to that state, are
    // ignored.
    if (state.isTransitioning) {
      return this;
    }

    // Requests to change the visible area
    // to the same state that it's in are
    // ignored.
    //
    // This can easily be the case when user
    // is scrolling the recipients list and
    // GestureDetector assumes the scroll is
    // a "pan" event.
    // (The physical act is identical)
    if (state.visible === type) {
      return this;
    }

    // Once the transition has ended, the set focus to
    // the last child element in the recipients list view
    view.outer.addEventListener('transitionend', function te() {
      let last = view.inner.lastElementChild;
      let previous;

      if (Navigation.isCurrentPanel('composer') &&
          state.visible === 'singleline') {
        while (last !== null && last.isPlaceholder) {
          previous = last.previousElementSibling;
          if (!last.textContent) {
            last.parentNode.removeChild(last);
          }
          last = previous;
        }

        if (opts.refocus) {
          opts.refocus.focus();
        }
      } else if (state.visible === 'multiline' && last !== null) {
        last.scrollIntoView(true);
      }

      state.isTransitioning = false;
      this.removeEventListener('transitionend', te, false);
    });

    // Commence the transition
    //
    // 1. Store the current transition states
    //
    state.visible = type;
    state.isTransitioning = true;
    //
    // 2. Set a "multiline" or "singleline" class.
    //
    // Instead of making multiple calls to classList.*
    // functions, pave over the className property.
    view.outer.className = type;
    view.inner.className = type;

    return this;
  };

  /**
   * handleEvent
   *
   * Single method for event handler delegation.
   *
   * @return {Undefined} void return.
   */
  Recipients.View.prototype.handleEvent = function(event) {
    if (event.key === 'Enter' && document.activeElement.textContent === '') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    let view = priv.get(this);
    let owner = view.owner;
    let [isPreventingDefault, isAcceptedRecipient, isEdittingRecipient,
         isDeletingRecipient, isLookupable, isDuplicateRecipient] =
        [false, false, false, false, false, false];
    let target = event.target;
    let keyCode = event.keyCode;
    let editable = 'false';
    let lastElement = view.inner.lastElementChild;
    let typed, recipient, length, toDelete, totalLength, lastString;

    // If the user moved away from the recipients field
    // and has now returned, we need to restore "focusability"
    Recipients.View.isFocusable = true;

    // All keyboard events will need some information
    // about the input that the user typed.
    if (event.type === 'input' || event.type === 'keydown') {
      typed = target.textContent.trim();
      length = typed.length;
      totalLength = target.textContent.length;
      lastString = target.textContent.charCodeAt(totalLength - 1);
    }

    switch (event.type) {
      case 'keydown':
        // XXX, if not current focus div, don't handle keydown.
        if (!event.target.classList.contains('focus')) {
          return;
        }

        if (typed) {
          this.ignore = true;
        }

        editable = event.target.getAttribute('contentEditable') === 'true' ?
            true : false;

        if (typed && keyCode === event.DOM_VK_RETURN) {
          if (Recipients.View.suggest) {
            Recipients.View.suggest = false;
          } else if (editable) {
            isAcceptedRecipient = true;
          }
          isPreventingDefault = true;
        }

        if (typed && editable &&
            ThreadUI.recipientSuggestions.classList.contains('hide') &&
            (keyCode === event.DOM_VK_DOWN || keyCode === event.DOM_VK_UP)) {
          isAcceptedRecipient = true;
        }

        if (keyCode === event.DOM_VK_BACK_SPACE ) {
          if (typed && !target.isPlaceholder) {
            toDelete = target;
          } else if (!typed) {
            toDelete = target.previousSibling;
          }

          if (toDelete && !toDelete.isPlaceholder) {
            recipient = relation.get(toDelete);
            view.owner.remove(recipient);
            isDeletingRecipient = isPreventingDefault = true;
          } else {
            if (length === 0) {
              ThreadUI.back();
            }
          }
        }
        break;
      case 'input':
        // Input rules:
        // 1. First input space, not input successfully.
        // 2. last input space, create recipients.
        const DOM_VK_SPACE = 32;
        // Present the beginning flag of Chinese characters.
        const DOM_VK_CIRCUMFLEX = 160;
        if ((lastString === DOM_VK_SPACE || lastString === DOM_VK_CIRCUMFLEX) && 
            !event.isComposing) {
          if (length === 0) {
            target.textContent = '';
          } else {
            isAcceptedRecipient = true;
          }
        }
        // When a single, non-semi-colon character is
        // typed into to the recipients list input,
        // slide the the list upward to "single line"
        // set focus to recipient
        if (!isAcceptedRecipient && (typed && typed.length >= 1)) {
          this.visible('singleline', { refocus: target });
        }

        ThreadUI.updateSksOnRecipientChanged(typed.length);
        this.updateMode();
        break;
    }

    if (isAcceptedRecipient) {
      if (typed) {
        if (ThreadUI.recipients.numbers.includes(typed)) {
          isPreventingDefault = true;
          isDuplicateRecipient = true;
          Toaster.showToast({
            messageL10nId: 'recipient-repeat',
          });
        } else {
          // Push the accepted input into the recipients list
          view.owner.add({
            name: typed,
            number: typed,
            editable: editable,
            source: 'manual',
            role: editable ? 'textbox' : 'button',
            isLookupable: isLookupable
          });
        }

        // Clear the displayed list
        // Render the recipients as a fresh list
        // Set focus on the very placeholder item.
        this.render().focus();
      }
    } else {
      if (length === 0 && event.type === 'keydown' && (keyCode === event.DOM_VK_UP ||
          keyCode === event.DOM_VK_DOWN || keyCode === event.DOM_VK_RETURN)) {
        target.textContent = '';
      }
    }

    if (isDeletingRecipient) {
      let parentNode = document.activeElement.parentNode;
      parentNode.childNodes[removeIndex].focus();
    }

    if (isEdittingRecipient) {
      // Make the last added entry "editable"
      target.contentEditable = true;
      target.setAttribute('role', 'textbox');
      target.isPlaceholder = true;
      this.focus(target);
    }

    isDuplicateRecipient &&
      document.querySelector('#lastRecipient').classList.add('focus');

    if (isPreventingDefault) {
      event.preventDefault();
    }
  };

  Recipients.View.prompts = {
    remove: function(recipient, callback) {
      callback = typeof callback === 'function' ? callback : () => {};

      let bodyTemplate = SharedComponents.phoneDetails({
        number: recipient.number,
        type: recipient.type,
        carrier: recipient.carrier
      });

      let title = document.createElement('bdi');
      title.textContent = recipient.name || recipient.number;

      Utils.confirm(
        { raw: bodyTemplate.toDocumentFragment() },
        { raw: title },
        { text: 'remove', className: 'danger' }
      ).then(() => callback(true), () => callback(false));

      Recipients.View.isFocusable = false;
    }
  };

  exports.Recipients = Recipients;
}(this));
