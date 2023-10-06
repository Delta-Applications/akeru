
define(['require','exports','module','tmpl!./msg/address_peep_bubble.html','cards','l10n!','contacts','./base','template!./message_reader_address.html'],function(require, exports, module) {
  let recipientsCcPeepBubbleNode =
      require('tmpl!./msg/address_peep_bubble.html');
  let cards = require('cards');
  let mozL10n = require('l10n!');
  let Contacts = require('contacts');

  return [
    require('./base')(require('template!./message_reader_address.html')),
    {
      onArgs: function(args) {
        this.composer = args.composer;
        this.currentFocusPeep = -1;
        this.type = args.type;
        this.addressNode = [];

        switch (this.type) {
          case 'sender':
            this.addressHeader =
                mozL10n.get('msg-reader-sender-header');
            this.contactsList = [this.composer.header.author];
            break;
          case 'recipients':
            this.addressHeader =
                mozL10n.get('msg-reader-recipients-header') +
                ' (' + this.composer.header.to.length + ')';
            this.contactsList = this.composer.header.to;
            break;
          case 'cc':
            this.addressHeader = mozL10n.get('msg-reader-cc-header') +
                ' (' + this.composer.header.cc.length + ')';
            this.contactsList = this.composer.header.cc;
            break;
          case 'bcc':
            this.addressHeader = mozL10n.get('msg-reader-bcc-header') +
                ' (' + this.composer.header.bcc.length + ')';
            this.contactsList = this.composer.header.bcc;
            break;
        }
      },

      onBack: function() {
        cards.removeCardAndSuccessors(this, 'animate');
      },

      sendNewMail: function() {
        cards.eatEventsUntilNextCard();
        cards.pushCard('compose', 'animate', {
          composerData: {
            message: this.composer.header,
            onComposer: (composer) => {
              composer.to = [{
                address: this.currentFocusPeep.address,
                name: this.currentFocusPeep.contactName || this.currentFocusPeep.name
              }];
            }
          }
        });
      },

      viewContact: function() {
        let req = new MozActivity({
          name: 'open',
          data: {
            type: 'webcontacts/contact',
            params: {
              'id': this.currentFocusPeep.contactId
            }
          }
        });
        req.onsuccess = () => {
          console.log('view contact info success');
          NavigationMap.setFocus('restore');
        };
        req.onerror = () => {
          console.log('view contact info failed');
          NavigationMap.setFocus('restore');
        };
      },

      saveNewContact: function() {
        let params = {
          'email': this.currentFocusPeep.address
        };

        if (this.currentFocusPeep.contactName) {
          params.givenName = this.currentFocusPeep.contactName;
        } else if (this.currentFocusPeep.name) {
          params.givenName = this.currentFocusPeep.name;
        }

        let req = new MozActivity({
          name: 'new',
          data: {
            type: 'webcontacts/contact',
            params: params
          }
        });
        req.onsuccess = () => {
          console.log('save new contact success');
          this._refreshImage();
          NavigationMap.setFocus('restore');
        };
        req.onerror = () => {
          console.log('save new contact failed');
          NavigationMap.setFocus('restore');
        };
      },

      saveExistContact: function() {
        let req = new MozActivity({
          name: 'update',
          data: {
            type: 'webcontacts/contact',
            params: {
              'email': this.currentFocusPeep.address
            }
          }
        });
        req.onsuccess = () => {
          console.log('save to existing contact success');
          this._refreshImage();
          NavigationMap.setFocus('restore');
        };
        req.onerror = () => {
          console.log('save to existing contact failed');
          setTimeout(() => {
            NavigationMap.setFocus('restore');
          }, 400);
        };
      },

      updatePeepInfo: function(event) {
        if (event.detail.peep.address === this.currentFocusPeep.address) {
          document.querySelector('[data-email="' +
                                 this.currentFocusPeep.address +
                                 '"]').textContent = event.detail.peep.contactName ||
                                                     event.detail.peep.name ||
                                                     event.detail.peep.address;
          let contactImageNode = document.querySelector('[data-email="' +
                                 this.currentFocusPeep.address + '"]')
                                 .previousElementSibling;
          if (contactImageNode) {
            let contactImageLabel =
                contactImageNode.querySelector('.contact-image-label');
            if (event.detail.photo) {
              contactImageLabel.src = URL.createObjectURL(event.detail.photo);
            }
          }
          this.setSoftKey();
        }
      },

      die: function() {
        window.removeEventListener('keydown', this.keydownHandler);
        window.removeEventListener('contact-updated', this.updatePeepHander);
      },

      onCardVisible: function(navDirection) {
        this.keydownHandler = this.handleKeydown.bind(this);
        window.addEventListener('keydown', this.keydownHandler);
        this.updatePeepHander = this.updatePeepInfo.bind(this);
        window.addEventListener('contact-updated', this.updatePeepHander);

        this._refresh();
        this._refreshImage();
        this.setSoftKey();
        if (navDirection === 'forward') {
          NavigationMap.setFocus('first');
        } else if (navDirection === 'back') {
          NavigationMap.setFocus('restore');
        }
      },

      onHidden: function() {
        window.removeEventListener('keydown', this.keydownHandler);
        window.removeEventListener('contact-updated', this.updatePeepHander);
      },

      navSetup: function() {
        let CARD_NAME = this.localName;
        let QUERY_CHILD = '.msg-reader-peep-focusable';
        let CONTROL_ID = CARD_NAME + ' ' + QUERY_CHILD;

        NavigationMap.navSetup(CARD_NAME, QUERY_CHILD);
        NavigationMap.setCurrentControl(CONTROL_ID);
      },

      handleKeydown: function(evt) {
        switch (evt.key) {
          case 'Backspace':
            evt.preventDefault();
            if (this.addressDialogShown) {
              this.addressDialogShown = false;
            } else if (option.menuVisible === false) {
              this.onBack();
            }
            break;
        }
      },

      _refresh: function() {
        if (this.contactsList && this.contactsList.length) {
          this.addressContainer.innerHTML = '';
          for (let i = 0; i < this.contactsList.length; i++) {
            let peepBubbleTemplate = recipientsCcPeepBubbleNode.cloneNode(true);
            let contactName = peepBubbleTemplate
                .querySelector('.message-reader-peep-bubble-name');
            contactName.textContent = this.contactsList[i].contactName ||
                                      this.contactsList[i].name ||
                                      this.contactsList[i].address;
            contactName.setAttribute('data-email',
                this.contactsList[i].address);
            this.addressContainer.appendChild(peepBubbleTemplate);
            this.addressNode.push({
              address: this.contactsList[i].address,
              node: peepBubbleTemplate
            });
          }
        }
        this.addressLabel.innerHTML = this.addressHeader;
        this.navSetup();
      },

      _refreshImage: function() {
        this.addressNode.forEach((item) => {
          Contacts.findContactByString(item.address, item.node,
                                       this.updateImage);
        });
      },

      updateImage: function(contacts, inputValue, insertNode) {
        let contactImageNode = insertNode.querySelector(
            '.message-reader-peep-bubble-picture');
        let contactImageLabel =
            contactImageNode.querySelector('.contact-image-label');
        let blob;
        if (contacts.length > 0 && contacts[0].photo) {
          blob = contacts[0].photo[0];
        }
        if (blob) {
          contactImageNode.classList.remove('no-photo');
          contactImageLabel.classList.remove('collapsed');
          contactImageLabel.src = URL.createObjectURL(blob);
        } else {
          contactImageLabel.classList.add('collapsed');
          contactImageNode.classList.add('no-photo');
        }
      },

      setSoftKey: function() {
        let params = [];
        params.push({
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          method: () => {
            this.onBack();
          }
        });
        params.push({
          name: 'Send New Mail',
          l10nId: 'send-new-mail',
          priority: 5,
          method: () => {
            this.sendNewMail();
          }
        });
        if (this.currentFocusPeep.isContact) {
          params.push({
            name: 'View Contact',
            l10nId: 'view-contact',
            priority: 5,
            method: () => {
              this.viewContact();
            }
          });
        } else {
          if (this.currentFocusPeep.contactName &&
              this.currentFocusPeep.contactName.length > 0) {
            params.push({
              name: 'View Address',
              l10nId: 'view-address',
              priority: 5,
              method: () => {
                this.viewAddress();
              }
            });
          }
          params.push({
            name: 'Save New Contact',
            l10nId: 'save-new-contact',
            priority: 5,
            method: () => {
              this.saveNewContact();
            }
          });
          Contacts.getCount().then((count) => {
            if (count) {
              params.push({
                name: 'Add to Existing Contact',
                l10nId: 'add-to-exsiting-contact',
                priority: 5,
                method: () => {
                  this.saveExistContact();
                }
              });
            }
          });
        }
        NavigationMap.setSoftKeyBar(params);
      },

      viewAddress: function() {
        let dialogConfig = {
          title: {
            id: 'mail-address-title',
            args: {}
          },
          body: {
            id: 'mail-address',
            args: {
              address: this.currentFocusPeep.address
            }
          },
          accept: {
            l10nId: 'confirm-dialog-ok',
            priority: 2,
            callback: () => {
              this.addressDialogShown = false;
            }
          }
        };
        NavigationMap.showConfigDialog(dialogConfig);
        this.addressDialogShown = true;
      },

      onFocusChanged: function(queryChild, index, item) {
        console.log(this.localName + '.onFocusChanged, queryChild=' +
                    queryChild + ', index=' + index);
        this.currentFocusPeep = this.contactsList[index];
        this.setSoftKey();
      }
    }
  ];
});
