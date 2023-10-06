/* global EventDispatcher */

/* exported SubjectComposer */
(function(exports) {
  'use strict';

  const MAX_LENGTH = 40;
  const privateMembers = new WeakMap();

  function onInput(e) {
    /* jshint validthis: true */
    privateMembers.get(this).updateValue(e.target.value);
  }

  function updateValue(newValue) {
    /* jshint validthis: true */
    let priv = privateMembers.get(this);

    // Bug 877141 - contenteditable will insert non-break spaces when
    // multiple consecutive spaces are entered, we don't want them.
    if (newValue) {
      newValue = newValue.replace(/\n\s*|\u00A0/g, ' ');
    }

    if (priv.value !== newValue) {
      priv.value = newValue;
      priv.input.value = newValue;
      this.emit('change');
    }

    return newValue;
  }

  let SubjectComposer = function(node) {
    EventDispatcher.mixin(this, [
      'focus',
      'change',
      'visibility-change'
    ]);

    if (!node) {
      throw new Error('Subject node is required');
    }

    let priv = {
      isHoldingBackspace: false,
      isEmptyOnBackspace: false,
      isVisible: false,
      value: '',

      // nodes
      node: node,
      input: null,

      // methods
      updateValue: updateValue.bind(this)
    };
    privateMembers.set(this, priv);

    priv.input = priv.node.querySelector('.subject-composer-input');

    priv.input.addEventListener('input', onInput.bind(this));
    priv.input.addEventListener('focus', this.emit.bind(this, 'focus'));
    priv.input.addEventListener('focus', this.focus.bind(this));
  };

  SubjectComposer.prototype.show = function ms_show(param) {
    this.toggle(true, param);
    Compose.updateEmptyState();
  };

  SubjectComposer.prototype.hide = function ms_hide() {
    this.toggle(false);
  };

  SubjectComposer.prototype.toggle = function ms_toggle(toggle, param) {
    let priv = privateMembers.get(this);

    priv.node.classList.toggle('hide', !toggle);
    priv.isVisible = toggle;

    if (!param) {
      this.emit('visibility-change');
    }
  };

  SubjectComposer.prototype.isVisible = function ms_is_visible() {
    return privateMembers.get(this).isVisible;
  };

  SubjectComposer.prototype.focus = function ms_focus() {
    let priv = privateMembers.get(this);
    priv.input.focus();
  };

  SubjectComposer.prototype.isFocused = function ms_is_focused() {
    return document.activeElement.id === privateMembers.get(this).input.id;
  };

  SubjectComposer.prototype.getMaxLength = function ms_get_maxLength() {
    return MAX_LENGTH;
  };

  SubjectComposer.prototype.getValue = function ms_get_value() {
    return privateMembers.get(this).value;
  };

  SubjectComposer.prototype.setValue = function ms_set_value(value) {
    let priv = privateMembers.get(this);

    if (typeof value !== 'string') {
      throw new Error('Value should be a valid string!');
    }

    priv.input.textContent = priv.updateValue(value);
  };

  SubjectComposer.prototype.reset = function ms_reset() {
    let priv = privateMembers.get(this);

    priv.updateValue('');
    priv.node.classList.add('hide');
    priv.isVisible = false;
    NavigationMap.clearSubjectStoreFocus();
  };

  exports.SubjectComposer = SubjectComposer;
})(window);
