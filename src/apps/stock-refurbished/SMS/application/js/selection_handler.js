/*exported SelectionHandler */

(function(exports) {
  'use strict';

  const REQUIRED_KEYS = [
    // elements
    'container',
    'checkUncheckAllButton',
    // methods
    'checkInputs',
    'getAllInputs',
    'isInEditMode',
    'updateSKs'
  ];

  let SelectionHandler = function constructor(options) {
    // Set the necessary properties and method for selection module and throw
    // error if not existed in options.
    if (typeof options !== 'object') {
      throw new Error('options should be a valid object');
    }

    REQUIRED_KEYS.forEach((key) => {
      if (options[key] === undefined) {
        throw new Error('Selection options does not provide required key ' + key);
      }

      this[key] = options[key];
    });

    this.selected = new Set();

    this.container.addEventListener('click', this.onSelected.bind(this));
    this.checkUncheckAllButton.addEventListener(
      'click', this.toggleCheckedAll.bind(this)
    );
  };

  SelectionHandler.prototype = {
    get selectedCount() {
      return this.selected.size;
    },

    get selectedList() {
      return Array.from(this.selected);
    },

    onSelected: function sel_onSelected(event) {
      if (!this.isInEditMode()) {
        return;
      }
      let target = event.target;
      let value = target.value;
      let existed = this.selected.has(value);

      if (target.checked && !existed) {
        this.selected.add(value);
        target.classList.add('thread-checked');
      } else if (!target.checked && existed) {
        this.selected.delete(value);
        target.classList.remove('thread-checked');
      } else {
        // Don't emit event if no selection change
        return;
      }

      this.checkInputs();
      this.updateSKs();
    },

    select: function sel_select(id) {
      this.selected.add('' + id);
    },

    unselect: function sel_unselect(id) {
      this.selected.delete('' + id);
    },

    // Update check status of input elements in the container
    updateCheckboxes: function sel_updateCheckboxes() {
      let inputs = this.container.querySelectorAll('input[type=checkbox]');
      let length = inputs.length;

      for (let i = 0; i < length; i++) {
        inputs[i].checked = this.selected.has(inputs[i].value);
        if (inputs[i].checked) {
          inputs[i].classList.add('thread-checked');
        } else {
          inputs[i].classList.remove('thread-checked');
        }
      }
    },

    // if no message or few are checked : select all the messages
    // and if all messages are checked : deselect them all.
    toggleCheckedAll: function sel_toggleCheckedAll() {
      let selected = this.selected.size;
      let allInputs = this.getAllInputs();
      let allSelected = (selected === allInputs.length);

      if (allSelected) {
        this.selected.clear();
      } else {
        Array.prototype.forEach.call(allInputs, (data) => {
          this.selected.add(data.value);
        });
      }

      this.updateCheckboxes();

      this.checkInputs();
      this.updateSKs();
    },

    cleanForm: function sel_cleanForm() {
      // Reset all inputs
      this.selected.clear();

      this.updateCheckboxes();

      // Reset vars for deleting methods
      this.checkInputs();
      this.updateSKs();
    }
  };

  exports.SelectionHandler = SelectionHandler;
}(this));
