/*global WeakMap */

/* exported Dialog */

(function(exports) {
  'use strict';

  /*
   Generic confirm screen. Only 'cancel/default' is mandatory.

   Text fields are localized using commonly defined parameter structure:
   https://developer.mozilla.org/en-US/Firefox_OS/Developing_Gaia/
   localization_code_best_practices#Writing_APIs_that_operate_on_L10nIDs + 'raw'
   can be Node aw well.

   The constructor parameter should follow the following structure:

   {
    title: { raw: 'Non localizable title' },
    body: {
      id: 'localizableStringWithArgument',
      args: { n: count }
    },
    classes: ['specific-class'], // optional
    options: {
      // Cancel is a mandatory option. You need to define at least the text.
      cancel: {
        text: 'localizableCancelLabel'
      },
      confirm: {
        text: 'localizableRemoveLabel',
        method: function(params) {
          fooFunction(params);
        },
        params: [arg1, arg2,....],
        className: 'optionalClassName'
      }
    }
  */

  let dialog = null;

  let Dialog = function(params) {
    // Use confirm dialog helper, should refactor later.
    let dialogConfig = {
      title: params.title,
      body: params.body,
      desc: params.desc,
      accept: {
        l10nId: 'confirm-dialog-ok',
        icon: 'ok',
        priority: 2,
        callback: function() {
          if (params.options && params.options.confirm &&
              params.options.confirm.method) {
            params.options.confirm.method();
          }
        }
      }
    };

    if (params.switchSimData) {
      dialogConfig.confirm = {
        l10nId: 'settings',
        priority: 3,
        callback: function() {
          new window.MozActivity({
            name: 'configure',
            data: {
              target: 'device',
              section: 'sim-manager'
            }
          });
        }
      }
    }

    dialog = new ConfirmDialogHelper(dialogConfig);
  };

  // We prototype functions to show/hide the UI of action-menu
  Dialog.prototype.show = function() {
    dialog.show(document.getElementById('file-large-confirmation-dialog'));
  };

  Dialog.prototype.hide = function() {
    // do nothing
  };

  exports.Dialog = Dialog;
  // end global closure
}(this));

