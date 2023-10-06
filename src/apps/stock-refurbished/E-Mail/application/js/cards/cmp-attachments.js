
define(['require','cards','shared/js/mime_mapper','./base','template!./cmp-attachments.html'],function(require) {
  let cards = require('cards');
  let MimeMapper = require('shared/js/mime_mapper');

  return [
    require('./base')(require('template!./cmp-attachments.html')),
    {
      onArgs: function(args) {
        this.composer = args.composer;
        this.endkeyPopUp = false;
        this.currentFocusIndex = -1;
      },

      onBack: function() {
        cards.removeCardAndSuccessors(this, 'animate');
      },

      die: function() {
        window.removeEventListener('keydown', this.keydownHandler);
        window.removeEventListener('cmp-attachments-update',
                                   this.upgradeDataHander);
        window.removeEventListener('email-endkey', this.endkeyHandler);
      },

      onCardVisible: function() {
        this.keydownHandler = this.handleKeydown.bind(this);
        window.addEventListener('keydown', this.keydownHandler);
        this.upgradeDataHander = this.upgradeData.bind(this);
        window.addEventListener('cmp-attachments-update',
                                this.upgradeDataHander);
        this.endkeyHandler = this.handleEndkey.bind(this);
        window.addEventListener('email-endkey', this.endkeyHandler);

        this._refresh();
        NavigationMap.setFocus('first');
        this.setSoftKey();
      },

      navSetup: function() {
        let CARD_NAME = this.localName;
        let QUERY_CHILD = '.cmp-attachment-focusable';
        let CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
      },

      handleKeydown: function(evt) {
        switch (evt.key) {
          case 'Backspace':
            evt.preventDefault();
            if (option.menuVisible === false) {
              if (!this.endkeyPopUp) {
                this.onBack();
              } else {
                this.endkeyPopUp = false;
                cards._endKeyClicked = false;
                option.show();
                this.composer.hideDialog();
              }
            }
            break;
        }
      },

      updateHeader: function() {
        this.attachmentsSize.textContent =
          this.composer.attachmentsSize.textContent;
        this.attachmentLabel.textContent =
          this.composer.attachmentLabel.textContent;
      },

      _refresh: function(args) {
        if (args) {
          this.composer = args.composer;
        }
        this.attachmentsContainer.innerHTML =
          this.composer.attachmentsContainer.innerHTML;
        this.checkAttachments();
        this.updateHeader();
        this.navSetup();
        this.makeAttachIndex();
      },

      checkAttachments: function() {
        let length = this.composer.composer.attachments.length;
        if (length > 0) {
          return;
        }
        this.onBack();
      },

      getAttachmentBlob: function(attachment, callback) {
        try {
          // Get the file contents as a blob, so we can open the blob
          let pathName = attachment.pathName;
          let storage = navigator.getDeviceStorage('sdcard');
          let getreq = storage.get(pathName);

          getreq.onerror = () => {
            console.warn('Could not open attachment file: ', pathName,
              getreq.error.name);
          };

          getreq.onsuccess = () => {
            // Now that we have the file, return the blob within callback
            // function
            let blob = getreq.result;
            callback(blob);
          };
        } catch (ex) {
          console.warn('Exception getting attachment from device storage:',
                       attachment, '\n', ex, '\n', ex.stack);
        }
      },

      viewAttachment: function(attachment) {
        let mimetype = MimeMapper.guessTypeFromFileProperties(
            attachment.name,
            attachment.blob.type.toLowerCase()
        );
        let filename =
            MimeMapper.ensureFilenameMatchesType(attachment.name, mimetype);
        let activity = new MozActivity({
          name: 'open',
          data: {
            type: mimetype,
            filename: filename,
            blob: attachment.blob,
            // the PDF viewer really wants a "url".  download_helper.js
            // provides the local filesystem path which is sketchy and
            // non-sensical.  We just provide the filename again.
            url: filename
          }
        });

        activity.onerror = () => {
          console.warn('Problem with "open" activity', activity.error.name);
          // NO_PROVIDER is returned if there's nothing to service the
          // activity.
          if (activity.error.name === 'NO_PROVIDER') {
            let dialogConfig = {
              title: {
                id: 'message-attachment-did-not-open-label',
                args: {}
              },
              body: {
                id: 'message-attachment-did-not-open-body',
                args: {}
              },
              accept: {
                l10nId: 'confirm-dialog-ok',
                priority: 2
              }
            };
            NavigationMap.showConfigDialog(dialogConfig);
          }
        };

        activity.onsuccess = function() {
          console.log('"open" activity allegedly succeeded');
        };
      },

      getBaseName: function(filePath) {
        if (!filePath) {
          throw new Error('Filepath is not defined!');
        }
        return filePath.substring(filePath.lastIndexOf('/') + 1);
      },

      onViewAttachment: function(attachment) {
        if (this.composer.addATTActivity &&
            this.composer.addATTActivity.readyState === 'pending') {
          return;
        }
        if (attachment.blob &&
            attachment.blob.constructor.name === 'File') {
          this.viewAttachment(attachment);
        } else {
          if (attachment.blob.type.indexOf('vcard') > 0) {
            if (attachment.data) {
              attachment.blob = attachment.data;
            }
            this.viewAttachment(attachment);
            return;
          }
          this.getAttachmentBlob(attachment, (blob) => {
            try {
              if (!attachment.blob) {
                throw new Error('Blob does not exist');
              }
              attachment.blob = blob;
              this.viewAttachment(attachment);
            }
            catch (ex) {
              console.warn('Problem creating "open" activity:',
                           ex, '\n', ex.stack);
            }
          });
        }
      },

      setSoftKey: function() {
        let params = [];
        params.push({
          name: 'Select',
          l10nId: 'select',
          priority: 2,
          method: () => {
            if (!NavigationMap.configDialogShown()) {
              let currentFocusAttachment =
                  this.composer.composer.attachments[this.currentFocusIndex];
              this.onViewAttachment(currentFocusAttachment);
            }
          }
        });
        params.push({
          name: 'Remove Attachment',
          l10nId: 'remove-attachment',
          priority: 5,
          method: () => {
            let attachIndex = NavigationMap.getCurrentItem()
                .getAttribute('data-attachIndex');
            this.composer.onClickRemoveAttachment(attachIndex);
          }
        });
        params.push({
          name: 'Replace Attachment',
          l10nId: 'replace-attachment',
          priority: 5,
          method: () => {
            this.composer.onAttachmentReplace();
          }
        });
        params.push({
          name: 'Add Attachment',
          l10nId: 'add-attachment',
          priority: 5,
          method: () => {
            this.composer.onAttachmentAdd();
          }
        });
        NavigationMap.setSoftKeyBar(params);
      },

      recoverFocus: function() {
        if (this.currentFocusIndex !== -1) {
          let node = document.querySelector('[data-attachIndex="' +
                     this.currentFocusIndex + '"]');
          if (node) {
            NavigationMap.setFocus(this.currentFocusIndex);
          } else {
            NavigationMap.setFocus(this.currentFocusIndex - 1);
          }
        }
      },

      upgradeData: function(event) {
        this._refresh(event.detail);
        this.recoverFocus();
      },

      onFocusChanged: function(queryChild, index, item) {
        if (item) {
          this.currentFocusIndex = item.getAttribute('data-attachIndex');
        }
        if (this.composer.addATTActivity &&
            this.composer.addATTActivity.readyState === 'pending') {
          NavigationMap.setSoftKeyBar([]);
        } else {
          this.setSoftKey();
        }
      },

      makeAttachIndex: function() {
        let caf = '.cmp-attachment-focusable';
        // make data index for attachment-list view
        let attachments = this.attachmentsContainer.querySelectorAll(caf);
        for (let i = 0; i < attachments.length; i++) {
          attachments[i].setAttribute('data-attachIndex', i);
        }

        // make data index for composer view
        let attachlist =
            this.composer.attachmentsContainer.querySelectorAll(caf);
        for (let i = 0; i < attachlist.length; i++) {
          attachlist[i].setAttribute('data-attachIndex', i);
        }
      },

      handleEndkey: function(evt) {
        let callback = evt.detail.callback;
        this.endkeyPopUp = true;
        this.composer.onBack(callback);
      }
    }
  ];
});
