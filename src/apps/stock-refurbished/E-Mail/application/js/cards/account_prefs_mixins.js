

/*jshint browser: true */
/*global define, console, _secretDebug */

define(['require','l10n!','cards'],function(require) {
  let mozL10n = require('l10n!'),
      cards = require('cards');

  /**
   * mixin properties for cards that share similar actions around the account
   * preferences.
   * ASSUMES the following properties have been initialized on the object
   * - this.account
   * - this.identity
   */

  return {
    // Call this in target object's constructor to wire up the common prefs.
    _bindPrefs: function(checkIntervalClassName, //sync interval select box
                         notifyEmailClassName,   //notify email checkbox
                         soundOnSendClassName,   //send sound on send checkbox
                         signatureEnabledClassName,
                         signatureBoxClassName,
                         accountLabelClassName) {

      if (checkIntervalClassName) {
        // Wire up the sync interval select box.
        let checkIntervalNode = this.nodeFromClass(checkIntervalClassName),
            currentInterval = this.account.syncInterval,
            syncIntervalString = String(currentInterval),
            extraOptions = [];

        // Allow for fast sync options set via the settings_debug
        // secret debugging screen.
        if (typeof _secretDebug !== 'undefined' && _secretDebug.fastSync) {
          extraOptions = extraOptions.concat(_secretDebug.fastSync);
        }

        // If existing sync option is not in the set shown in the UI,
        // allow for dynamically inserting it.
        let hasOption = Array.slice(checkIntervalNode.options, 0)
                        .some((option) => {
                          return syncIntervalString === option.value;
                        });
        if (!hasOption && extraOptions.indexOf(currentInterval) === -1) {
          extraOptions.push(currentInterval);
        }

        // Add any extra sync interval options.
        extraOptions.forEach(function(interval) {
          let node = document.createElement('option'),
              seconds = interval / 1000;

          node.value = String(interval);
          mozL10n.setAttributes(node, 'settings-check-dynamic',
                                { n: seconds });
          checkIntervalNode.appendChild(node);
        });

        checkIntervalNode.value = syncIntervalString;
        checkIntervalNode.addEventListener('change',
                                           this.onChangeSyncInterval.bind(this),
                                           false);
      }

      if (notifyEmailClassName) {
        let notifyMailNode = this.nodeFromClass(notifyEmailClassName);
        notifyMailNode.addEventListener('change',
                                        this.onNotifyEmailClick.bind(this),
                                        false);
        notifyMailNode.value = this.account.notifyOnNew;
      }

      if (soundOnSendClassName) {
        let soundOnSendNode = this.nodeFromClass(soundOnSendClassName);
        soundOnSendNode.addEventListener('change',
                                        this.onSoundOnSendClick.bind(this),
                                        false);
        soundOnSendNode.value = this.account.playSoundOnSend;
      }

      if (signatureEnabledClassName) {
        let signatureEnabledNode =
          this.nodeFromClass(signatureEnabledClassName);
        signatureEnabledNode.addEventListener('change',
                                    this.onSignatureEnabledClick.bind(this),
                                    false);
        signatureEnabledNode.value = this.identity.signatureEnabled;
        let signatureBox = this.nodeFromClass(signatureBoxClassName);
        if (this.identity.signatureEnabled) {
          signatureBox.parentNode.style.display = 'block';
          signatureBox.parentNode.classList.remove('hidden');
        } else {
          signatureBox.parentNode.style.display = 'none';
          signatureBox.parentNode.classList.add('hidden');
        }
      }

      if (signatureBoxClassName) {
        this.signatureBox = this.nodeFromClass(signatureBoxClassName);
        this.updateSignatureBox();
      }

      if (accountLabelClassName) {
        this.accoutLabelNode = this.nodeFromClass(accountLabelClassName);
        this.updateAccountLabel();
      }

    },

    nodeFromClass: function(className) {
      return this.getElementsByClassName(className)[0];
    },

    onChangeSyncInterval: function(event) {
      let value = parseInt(event.target.value, 10);
      console.log('sync interval changed to', value);
      this.account.modifyAccount({ syncInterval: value });
    },

    onNotifyEmailClick: function(event) {
      let value = event.target.value;
      console.log('notifyOnNew changed to: ' + value);
      let checked;
      if (value === "true") {
        checked = true;
      } else if (value === "false") {
        checked = false;
      }
      this.account.modifyAccount({ notifyOnNew: checked });
    },

    onSoundOnSendClick: function(event) {
      let value = event.target.value;
      console.log('playSoundOnSend changed to: ' + value);
      let checked;
      if (value === "true") {
        checked = true;
      } else if (value === "false") {
        checked = false;
      }
      this.account.modifyAccount({ playSoundOnSend: checked });
    },

    onSignatureEnabledClick: function(event) {
      let value = event.target.value;
      console.log('signatureEnabled changed to: ' + value);
      let checked;
      if (value === 'true') {
        checked = true;
        this.signatureBox.parentNode.style.display = 'block';
        this.signatureBox.parentNode.classList.remove('hidden');
      } else if (value === 'false') {
        checked = false;
        this.signatureBox.parentNode.style.display = 'none';
        this.signatureBox.parentNode.classList.add('hidden');
      }
      document.dispatchEvent(new Event('update-list'));
      this.identity.modifyIdentity({ signatureEnabled: checked });
    },

    updateSignatureBox: function() {
      let text = this.identity.signature || '',
          node = this.signatureBox;

      let textnode = document.createTextNode(text);
      let first_child = this.signatureBox.firstChild;
      if (!first_child || (first_child.tagName === 'BR')) {
        node.insertBefore(textnode, this.signatureBox.lastChild);
        node.innerHTML = node.innerHTML.replace(/\n/g, '<br>');
      }
    },

    updateAccountLabel: function() {
      let node = this.accoutLabelNode;
      node.value = this.account.label || '';
    },

    onClickSignature: function(index) {
     cards.pushCard(
        'settings_signature', 'animate',
        {
          account: this.account,
          index: index
        },
        'right');
    }
  };
});
