
define(['require','exports','module','tmpl!./msg/view_attachment_item.html','cards','l10n!','mime_to_class','file_display','shared/js/mime_mapper','toaster','./base','template!./message_reader_attachments.html'],function(require, exports, module) {
  let attachmentItemNode = require('tmpl!./msg/view_attachment_item.html');
  let cards = require('cards');
  let mozL10n = require('l10n!');
  let mimeToClass = require('mime_to_class');
  let fileDisplay = require('file_display');
  let MimeMapper = require('shared/js/mime_mapper');
  let toaster = require('toaster');
  let OCTET_STREAM_TYPE = 'application/octet-stream';
  let MAX_ATTCHMENT_SIZE = 5 * 1024 * 1024;
  let MAX_MAY_EMPTY_SIZE = 100;

  return [
    require('./base')(require('template!./message_reader_attachments.html')),
    {
      onArgs: function(args) {
        this.attachments = args.composer;
        this.bView = false;
        this.bShare = false;
        if (this.attachments.length > 1) {
          this.attachmentsHeader =
              mozL10n.get('msg-reader-display-attachments');
        } else {
          this.attachmentsHeader =
              mozL10n.get('msg-reader-display-attachment');
        }
        this.currentFocusedAttachment = -1;
      },

      onBack: function() {
        cards.removeCardAndSuccessors(this, 'animate');
      },

      die: function() {
        this.attachmentViewShown = false;
        window.removeEventListener('keydown', this.attachmentsKeydownHander);
      },

      getAttachmentBlob: function(attachment, callback) {
        try {
          // Get the file contents as a blob, so we can open the blob
          let storageType = attachment._file[0];
          let filename = attachment._file[1];
          let storage = navigator.getDeviceStorage(storageType);
          let getreq = storage.get(filename);

          getreq.onerror = () => {
            console.warn('Could not open attachment file: ', filename,
                          getreq.error.name);
            if ('NotFoundError' === getreq.error.name) {
              this.notFoundFileDialog();
            }
          };

          getreq.onsuccess = () => {
            // Now that we have the file, return the blob
            // within callback function
            let blob = getreq.result;
            callback(blob);
          };
        } catch (ex) {
          console.warn('Exception getting attachment from device storage:',
                       attachment._file, '\n', ex, '\n', ex.stack);
        }
      },

      onViewAttachment: function(attachment) {
        console.log('trying to open', attachment._file, 'known type:',
                    attachment.mimetype);
        if (!attachment._file && attachment.isDownloadable) {
          console.log('download this file firstly');
          this.downloadAttachment(attachment);
          this.bView = true;
          return;
        }

        if (attachment.isDownloaded) {
          this.getAttachmentBlob(attachment, (blob) => {
            try {
              // Now that we have the file, use an activity to open it
              if (!blob) {
                throw new Error('Blob does not exist');
              }
              let useType = attachment.mimetype;
              // - If it was octet-stream (or somehow missing) or
              // audio/vnd.dlna.adts, we check if DeviceStorage has an opinion.
              // we use it if so.
              if (!useType || useType === OCTET_STREAM_TYPE
                  || useType === 'audio/vnd.dlna.adts') {
                useType = blob.type;
              }
              // - If we still think it's octet-stream (or falsey), we ask the
              //   MimeMapper to map the file extension to a MIME type.
              let type = MimeMapper.guessTypeFromFileProperties(
                           attachment.filename, OCTET_STREAM_TYPE);
              if (type && type !== '' && useType !== type) {
                useType = type;
              }
              // - If it's falsey (MimeMapper returns an emptry string if it
              //   can't map), we set the value to application/octet-stream.
              if (!useType) {
                useType = OCTET_STREAM_TYPE;
              }
              // - At this point, we're fine with application/octet-stream.
              //   Although there are some file-types where we can just chuck
              //   "application/" on the front, there aren't enough of them.
              //   Apps can, however, use a regexp filter on the filename we
              //   provide to capture extension types that way.
              console.log('triggering open activity with MIME type:', useType);

              let activity;
              if (useType === 'text/x-vcard' ||
                  useType === 'text/vcard' ||
                  useType === 'text/directory') {
                activity = new MozActivity({
                  name: 'import',
                  data: {
                    type: useType,
                    filename: attachment.filename,
                    blob: blob
                  }
                });
              } else {
                activity = new MozActivity({
                  name: 'open',
                  data: {
                    type: useType,
                    filename: attachment.filename,
                    blob: blob,
                    // the PDF viewer really wants a "url".  download_helper.js
                    // provides the local filesystem path which is sketchy and
                    // non-sensical.  We just provide the filename again.
                    url: attachment.filename
                  }
                });
              }

              activity.onerror = () => {
                console.warn('Problem with "open" activity',
                    activity.error.name);
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
              activity.onsuccess = () => {
                console.log('"open" activity allegedly succeeded');
              };
            }
            catch (ex) {
              console.warn('Problem creating "open" activity:', ex, '\n',
                           ex.stack);
            }
          });
        }
      },

      doDownload: function(attachment) {
        let attachmentDownloading =
            this.currentItem.querySelector('.reader-view-attachment-downloading');
        attachment.isDownloading = true;
        this.setSoftKey();
        attachment.download(() => {
          console.log('download attachment succuss callback');
          attachment.isDownloading = false;

          if (this.className !== 'card center') {
            return;
          }
          if (!attachment._file) {
            console.log('attachment _file is null');
            // Some empty files will be refused to be downloaded by the server
            // So we add this toast to prompt user
            if (attachment.sizeEstimateInBytes < MAX_MAY_EMPTY_SIZE) {
              toaster.toast({
                text: mozL10n.get('emptyDownloadFile')
              });
            } else {
              toaster.toast({
                text: mozL10n.get('message-attachment-download-fail',
                                  { fileName: attachment.filename })
              });
            }
          }
          if (!(attachmentDownloading.classList.contains('collapsed'))) {
            attachmentDownloading.classList.add('collapsed');
          }
          if (this.attachmentViewShown) {
            this._refresh();
            this.setSoftKey();
            NavigationMap.setFocus('restore');
            if (attachment === this.currentFocusedAttachment &&
                attachment._file) {
              if (this.bShare) {
                this.shareAttachmentHelper(attachment);
              } else if (this.bView) {
                this.bView = false;
                this.onViewAttachment(attachment);
              }
            }
          }
        }, null, true);
        this.setSoftKey();
        attachmentDownloading.classList.remove('collapsed');
      },

      downloadAttachment: function(attachment) {
        let showToast = function(id) {
          toaster.toast({
            text: mozL10n.get(id)
          });
        };
        if (navigator.connection.type === 'none') {
          this.noConnectionDialog();
          return;
        }
        if (attachment.sizeEstimateInBytes > MAX_ATTCHMENT_SIZE) {
          showToast('message-attachment-too-large');
          return;
        }
        let storage = navigator.getDeviceStorage('sdcard');
        storage.available().onsuccess = (e) => {
          if (e.target.result !== 'available') {
            console.error('Can not get available memory card to download!');
          } else {
            storage.freeSpace().onsuccess = (e) => {
              if (e.target.result > attachment.sizeEstimateInBytes) {
                this.doDownload(attachment);
              } else {
                if (storage.storageName === 'sdcard') {
                  showToast('storage-full');
                } else {
                  showToast('storage-sdcard-full');
                }
              }
            }
          }
        };
      },

      shareAttachmentHelper: function(attachment) {
        console.log('go to shareAttachmentHelper');
        this.bShare = false;
        this.getAttachmentBlob(attachment, (blob) => {
          try {
            if (!blob) {
              throw new Error('Blob does not exist');
            }
            let useType = attachment.mimetype;
            if (!useType || useType === OCTET_STREAM_TYPE) {
              useType = blob.type;
            }
            if (!useType || useType === OCTET_STREAM_TYPE) {
              useType = MimeMapper.guessTypeFromFileProperties(
                attachment.filename, OCTET_STREAM_TYPE);
            }
            if (!useType) {
              useType = OCTET_STREAM_TYPE;
            }
            // Message only support the VCard share now,
            // and I do not advice open the text limit,
            // so need email have a special condition for VCard file.
            if (useType !== 'text/x-vcard' &&
                useType !== 'text/vcard') {
              useType = useType.split('/')[0] + '/*';
            } else {
              useType = 'text/vcard'
            }
            console.log('triggering share activity with MIME type:', useType);

            let activity = new MozActivity({
              name: 'share',
              data: {
                type: useType,
                number: 1,
                blobs: [blob],
                filenames: [attachment.filename],
                filepaths: [attachment.filename],
                owner: 'email'
              }
            });
            activity.onerror = () => {
              console.warn('Problem with "share" activity',
                  activity.error.name);
            };
            activity.onsuccess = () => {
              console.log('"share" activity allegedly succeeded');
            };
          }
          catch (ex) {
            console.warn('Problem creating "share" activity:', ex, '\n',
                ex.stack);
          }
        });
      },

      shareAttachment: function(attachment) {
        console.log('go to shareAttachment, attachment is ' + attachment);
        if (attachment.isDownloaded && attachment._file) {
          this.shareAttachmentHelper(attachment);
        } else if(!attachment.isDownloaded) {
          console.log('not a downloaded attachment, downloading');
          this.bShare = true;
          this.downloadAttachment(attachment);
          this.setSoftKey();
        }
      },

      noConnectionDialog: function() {
        let dialogConfig = {
          title: {
            id: 'confirmation-title',
            args: {}
          },
          body: {
            id: 'no-internet-connection',
            args: {}
          },
          cancel: {
            l10nId: 'opt-cancel',
            priority: 1
          },
          confirm: {
            l10nId: 'opt-settings',
            priority: 3,
            callback: () => {
              let activity = new MozActivity({
                name: 'configure',
                data: {
                  target: 'device',
                  section: 'connectivity-settings'
                }
              });

              activity.onerror = () => {
                console.warn('Configure activity error:', activity.error.name);
              };
            }
          }
        };
        NavigationMap.showConfigDialog(dialogConfig);
      },

      notFoundFileDialog: function() {
        let dialogConfig = {
          title: {
            id: 'attachment-download',
            args: {}
          },
          body: {
            id: 'message-attachment-not-found',
            args: {}
          },
          cancel: {
            l10nId: 'opt-cancel',
            priority: 1
          },
          confirm: {
            l10nId: 'attachment-download',
            priority: 3,
            callback: () => {
              this.currentItem.querySelector(
                  '.reader-view-attachment-downloaded-picture'
              ).classList.add('collapsed');
              this.currentFocusedAttachment.resetDownloadState();
              this.bView = true;
              this.downloadAttachment(this.currentFocusedAttachment);
            }
          }
        };
        NavigationMap.showConfigDialog(dialogConfig);
      },

      onCardVisible: function(navDirection) {
        this.attachmentsKeydownHander =
            this.handleAttachmentsKeydown.bind(this);
        window.addEventListener('keydown', this.attachmentsKeydownHander);
        this.attachmentViewShown = true;
        this._refresh();
        this.setSoftKey();
        if(navDirection === 'forward') {
          NavigationMap.setFocus('first');
        } else if( navDirection === 'back' ) {
          NavigationMap.setFocus('restore');
        }
      },

      onHidden: function() {
        this.attachmentViewShown = false;
        window.removeEventListener('keydown', this.attachmentsKeydownHander);
      },

      navSetup: function() {
        let CARD_NAME = this.localName;
        let QUERY_CHILD = '.msg-reader-view-attachment-focusable';
        let CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
      },

      handleAttachmentsKeydown: function(evt) {
        switch (evt.key) {
          case 'Backspace':
            if (option.menuVisible === false &&
                !NavigationMap.configDialogShown()) {
              evt.preventDefault();
              this.onBack();
            }
            if (NavigationMap.configDialogShown()) {
              evt.preventDefault();
            }
            break;
        }
      },

      _refresh: function() {
        console.log('go to messgae_reader_attachments --->_refresh');
        if (this.attachments && this.attachments.length) {
          this.readerViewAttachmentsContainer.innerHTML = '';
          let attachmentItemTemplate = attachmentItemNode;
          let attachmentFileName = attachmentItemTemplate
              .querySelector('.reader-view-attachment-filename');
          let attachmentFileSize = attachmentItemTemplate
              .querySelector('.reader-view-attachment-filesize');
          for (let iAttach = 0; iAttach < this.attachments.length; iAttach++) {
            let attachment = this.attachments[iAttach];
            attachmentFileName.textContent = attachment.filename;
            if (navigator.largeTextEnabled) {
              attachmentFileName.classList.add('p-pri');
              attachmentFileSize.classList.add('p-pri');
            }
            let extension = attachment.filename.split('.').pop();
            let mimeClass = mimeToClass(attachment.mimetype ||
                            MimeMapper.guessTypeFromExtension(extension));
            if (attachment.mimetype === 'application/zip') {
              mimeClass = 'mime-zip';
            } else if (attachment.mimetype === 'application/octet-stream' &&
              extension) {
              mimeClass =
                mimeToClass(MimeMapper.guessTypeFromExtension(extension));
            }

            fileDisplay.fileSize(attachmentFileSize,
                attachment.sizeEstimateInBytes);
            let attachmentNode = attachmentItemTemplate.cloneNode(true);
            attachmentNode.setAttribute('data-name',
                attachmentFileName.textContent);
            attachmentNode.classList.add(mimeClass);
            let attachementIcon =
                attachmentNode.querySelector('.reader-view-attachment-icon');
            let attachementDataIcon = '';
            switch (mimeClass) {
              case 'mime-audio':
                attachementDataIcon = 'file-audio';
                break;
              case 'mime-video':
                attachementDataIcon = 'file-video';
                break;
              case 'mime-image':
                attachementDataIcon = 'file-photo';
                break;
              case 'mime-zip':
                attachementDataIcon = 'file-compress';
                break;
              case 'mime-text':
                if (extension === 'vcf') {
                  attachementDataIcon = 'file-vcf';
                } else {
                  attachementDataIcon = 'file';
                }
                break;
              default:
                attachementDataIcon = 'file';
                break;
            }
            attachementIcon.setAttribute('data-icon', attachementDataIcon);

            let downloadedImg = attachmentNode
                .querySelector('.reader-view-attachment-downloaded-picture');
            let downloadingImg = attachmentNode
                .querySelector('.reader-view-attachment-downloading');
            if (attachment.isDownloaded) {
              downloadedImg.classList.remove('collapsed');
              downloadingImg.classList.add('collapsed');
            } else {
              if (attachment.isDownloading) {
                downloadingImg.classList.remove('collapsed');
                downloadedImg.classList.add('collapsed');
              } else {
                downloadedImg.classList.add('collapsed');
                downloadingImg.classList.add('collapsed');
              }
            }
            this.readerViewAttachmentsContainer.appendChild(attachmentNode);
          }
        }
        this.viewAttachmentsLabel.innerHTML = this.attachmentsHeader;
        this.navSetup();
      },

      setSoftKey: function() {
        let params = [];
        if (!this.currentFocusedAttachment.isDownloaded &&
            (!this.currentFocusedAttachment.isDownloading) &&
            this.currentFocusedAttachment.isDownloadable) {
          params.push({
            name: 'Download',
            l10nId: 'attachment-download',
            priority: 1,
            method: () => {
              this.downloadAttachment(this.currentFocusedAttachment);
            }
          });
        }
        if (!this.currentFocusedAttachment.isDownloading) {
          params.push({
            name: 'Select',
            l10nId: 'select',
            priority: 2,
            method: () => {
              this.onViewAttachment(this.currentFocusedAttachment);
            }
          });
          if (this.currentFocusedAttachment.isDownloadable) {
            params.push({
              name: 'Share',
              l10nId: 'attachment-share',
              priority: 3,
              method: () => {
                this.shareAttachment(this.currentFocusedAttachment);
              }
            });
          }
        }
        NavigationMap.setSoftKeyBar(params);
      },

      onFocusChanged: function(queryChild, index, item) {
        console.log(this.localName + '.onFocusChanged, queryChild=' +
                    queryChild + ', index=' + index);
        if (this.attachments[index] !== this.currentFocusedAttachment) {
          this.bShare = false;
          this.bView = false;
          this.currentFocusedAttachment = this.attachments[index];
        }
        this.currentItem = item;
        this.setSoftKey();
      }
    }
  ];
});
