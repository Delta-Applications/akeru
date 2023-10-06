/**
 * Show a spinner in for two possible steps in the setup of an account:
 *
 * 1) During the autoconfig step, when figuring out the capabilities of the
 * server, and possibly needing an oauth jump.
 *
 * 2) During the manual config or password flow when finally connecting to the
 * service to confirm password and settings are correct.
 *
 * So the possible flows are:
 *
 * OAuth: setup_account_info -> setup_progress -> setup_account_prefs
 * autoconfig password: setup_account_info -> setup_progress ->
 *                      setup_password -> setup_progress -> setup_account_prefs
 * manual config: setup_account_info -> setup_manual_config ->
 *                setup_progress -> setup_account_prefs
 */

define(['require','api','cards','html_cache','evt','l10n!','accounts_sync','./base','template!./setup_progress.html'],function(require) {

let MailAPI = require('api'),
    cards = require('cards'),
    htmlCache = require('html_cache'),
    evt = require('evt'),
    mozL10n = require('l10n!'),
    accountsSync = require('accounts_sync');

return [
  require('./base')(require('template!./setup_progress.html')),
  {
    onArgs: function(args) {
      this.args = args;
      this.callingCard = args.callingCard;
      this.creationInProcess = true;
      this.pushedSecondaryCard = false;
      this.cardHasBeenShown = false;
      this.createOnBackground = false;
      this.createCanceled = false;
      this.activity = args.activity;
      this.autoSetup = (args.autoSetup !== undefined) ? args.autoSetup : false;

      if (this.autoSetup) {
        this.setupProgressWait.setAttribute('data-l10n-id',
                                            'setup-sync-progress-wait-msg');
      } else {
        this.setupProgressWait.setAttribute('data-l10n-id',
                                            'setup-progress-wait-msg');
      }
      // Auto setup account when in background
      if (document.hidden && this.autoSetup) {
        this.onCardVisible();
        this.createOnBackground = true;
      }
    },

    extraClasses: ['anim-fade', 'anim-overlay'],

    cancelCreation: function() {
      if (!this.creationInProcess) {
        return;
      }
      this.creationInProcess = false;
      // XXX implement cancellation
      MailAPI._cancelCreation(this.args.emailAddress);
    },

    handleKeyDown: function(e) {
      if (this.className.indexOf('card center') > 0) {
        switch (e.key) {
          case 'Backspace':
            e.preventDefault();
            if (!this.autoSetup) {
              this.onBack();
            } else {
              e.stopPropagation();
            }
            break;
        }
      }
    },

    onCardVisible: function() {
      if (this.createOnBackground) {
        return;
      }
      let menuOptions = [];
      if (!this.autoSetup) {
        menuOptions.push({
          name: 'Cancel',
          l10nId: 'cancel',
          priority: 1,
          method: () => {
            this.onBack();
          }
        });
      }
      NavigationMap.setSoftKeyBar(menuOptions);
      this.keydownHandler = this.handleKeyDown.bind(this);
      window.addEventListener('keydown', this.keydownHandler);

      if (this.cardHasBeenShown) {
        // If this card was made visible because of a cancel of a secondary
        // config card, just go back one more card. The setTimeout is a hack.
        // Without it, the final card is not actionable because the
        // onTransitionEnd is not fired on this second removeCardAndSuccessors
        // call while done as part of finishing up the previous card's
        // removeCardAndSuccessors. A queue approach as described in 973038 does
        // not help. It seems like the _transitionEnd for the second call does
        // not ever fire. Need some async delay, not sure why yet. Otherwise,
        // _eatingEventsUntilNextCard ends up as true, since the reset logic for
        // it in _onTransitionEnd does not fire. An immediate setTimeout is not
        // enough, bothersome that it needs a time threshold.
        // pushedSecondaryCard is needed besides just a cardHasBeenShown,
        // because this card calls the oauth code, which may show its own cards,
        // but then navigate back to this card for a moment. In that case, the
        // card needs to stay up and visible.
        if (this.pushedSecondaryCard) {
          setTimeout(this.onBack.bind(this), 100);
        }
      } else {
        // First time the card has been shown, can now sort out what card to
        // show next. This logic could be in onArgs, but it is racy, where
        // learnAbout could complete before the animation to this card completes
        // which would lead to a case where think we have pushed a secondary
        // card, but it is really the first time this card is shown, so it would
        // be hard to know if this card was being shown for first time setup
        // reasons, or because a cancel/back had occurred. Ideally, learnAbout()
        // would be called in setup_account_info, but since it could take a
        // moment to complete by waiting for network connections to complete as
        // part of autodiscovery, this card is shown to give the user feedback
        // that something is happening. Instead of using the card visible state
        // as a hack to know the cancel state, switch to a callingCard card
        // passing approach so the next card can give a specific callingCard
        // cancel signal. However, bug 973038 needs to be solved, or some way
        // to remove more than one card at a time. Passing `2` to the
        // removeCardAndSuccessors call from this card if callingCard cancel
        // signal was received would also work, if we get proper expectations
        // around the number of ontransitioned events in that case.
        this.cardHasBeenShown = true;
        let data = { address: this.args.emailAddress };
        if (this.autoSetup) {
          if (!this.args.password) {
            this.learnAbout();
          } else {
            // The manual config pathway.
            this.tryCreate();
          }
        } else {
          if (this.activity) {
            let account = accountsSync.checkAccountExist(this.args.emailAddress);
            if (account) {
              accountsSync.getCredential(account, false).then((credential) => {
                let nAccount = {
                  name: account.accountId,
                  username: credential.username,
                  password: credential.password,
                  type: account.authenticatorId,
                  configInfo: credential.configInfo
                };
                this.activity.postResult('complete');
                this.activity = null;
                evt.emit('userAddDone', {
                  account: nAccount,
                  activity: true
                });
              });
            } else {
              this.tryCreate();
            }
          } else {
            if (!this.args.password) {
              this.learnAbout();
            } else {
              this.checkAndCreateAccount();
            }
          }
        }
      }
    },

    onBack: function(e) {
      if (e) {
        e.preventDefault();
      }
      this.cancelCreation();
      this.createCanceled = true;
      cards.removeCardAndSuccessors(this, 'animate', 1);
    },

    checkAndCreateAccount: function(learnAboutResult = '') {
      let accountType = this.args.configInfo ?
        this.args.configInfo.type : null;
      let data = {address: this.args.emailAddress, type: accountType};
      MailAPI.checkAndUpdateAccount(data, (result) => {
        if (!result.bExist || (result.bExist && result.type !== accountType)) {
          if (this.args.type === 'activesync') {
            let account =
              accountsSync.checkAccountExist(this.args.emailAddress);
            if (account) {
              let data = {
                account: account,
                reEnable: true
              };
              evt.emit('accountSyncChanged', data);
              cards.removeCardAndSuccessors(this, 'animate', 1);
            }
          } else {
            this.learnAboutResult(learnAboutResult);
          }
        } else if (result.id) {
          let data = {
            id: result.id,
            reEnable: true
          };
          evt.emit('accountSyncChanged', data);
          cards.removeCardAndSuccessors(this, 'animate', 1);
        } else {
          this.onCreationError('user-account-exists');
          return true;
        }
      });
    },

    /**
     * Trigger the back-end's autoconfig logic based on just knowing the user's
     * email address to figure out what to do next.
     */
    learnAbout: function() {
      MailAPI.learnAboutAccount({
        emailAddress: this.args.emailAddress
      }, (details) => {
        if (!this.creationInProcess) {
          return;
        }

        this.args.configInfo = details.configInfo;
        let result = details.result;

        this.checkAndCreateAccount(result);
      });
    },

    learnAboutResult: function(result) {
      // - We can autoconfig and it's time to use oauth!
      if (result === 'need-oauth2') {
        if (this.autoSetup) {
          this.args.configInfo.oauth2Tokens = this.args.oauth2Tokens;
          this.tryCreate();
        } else {
          let group = this.args.configInfo.oauth2Settings.secretGroup;
          let authenticator =  { authenticatorId: group };
          let extraInfo = {
            email: this.args.emailAddress,
            hideUsedPage: true
          };

          let account = {
            accountId: this.args.emailAddress,
            authenticatorId: group
          };

          accountsSync.showLoginPage(authenticator, extraInfo).then((result) => {
            account.accountId = result.accountId;
            account.authenticatorId = result.authenticatorId;
            accountsSync.getCredential(account, false).then((credential) => {
              this.args.authenticatorId = group;
              this.args.configInfo.oauth2Tokens = {
                accessToken: credential.access_token,
                expireTimeMS:  credential.expire_timestamp
              };
              this.tryCreate();
            }, () => {
              this.onCreationError('unknown');
            });
          }, (err) => {
            let errId;
            switch (err) {
              case 'no network':
                errId = 'offline';
                break;
              case 'duplicate_account':
                errId = 'user-account-exists';
                break;
              case 'user cancel':
                break;
              default:
                errId = 'unknown';
                break;
            }

            if (errId) {
              this.onCreationError(errId);
            }
            this.onBack();
          });
        }
        // We can autoconfig but we need the user's password.
      } else if (result === 'need-password') {
        // Track that a secondary card was added that could lead to a cancel
        // in that case, need to cancel this card too.
        this.pushedSecondaryCard = true;
        cards.pushCard(
          'setup_account_password', 'animate',
          {
            displayName: this.args.displayName,
            emailAddress: this.args.emailAddress,
            configInfo: this.args.configInfo
          },
          'right');
        // No configuration data available, the user's only option is manual
        // config.

        // must be no-config-info and even if not, we'd want this.
      } else if (result === 'no-config-info') {
        this._divertToManualConfig();
      } else {
        this.tryCreate();
      }
    },

    /**
     * learnAbout decided the only option for the user is to manually configure
     * their account.  Sorry, user!
     */
    _divertToManualConfig: function() {
      this.pushedSecondaryCard = true;
      cards.pushCard('setup_manual_config', 'animate', {
        displayName: this.args.displayName,
        emailAddress: this.args.emailAddress
      },
      'right');
    },

    /**
     * get device imei, we use this to set device id for activeSync.
     */
    getDeviceImei: function() {
      let connection;
      if (navigator.mozMobileConnections) {
        connection = navigator.mozMobileConnections[0];
      }

      return new Promise((resolve, reject) => {
        let errorMsg;
        if (!connection) {
          errorMsg = 'No mozMobileConnections!';
          reject(errorMsg);
        }
        let request = connection.getDeviceIdentities();
        request.onsuccess = () => {
          let value = request.result.imei;
          resolve(value);
        };
        request.onerror = () => {
          errorMsg = 'Could not retrieve the IMEI code';
          reject(errorMsg);
        };
      });
    },

    getDeviceId: function(id) {
      let deviceId = id;
      return new Promise((resolve) => {
        if (deviceId) {
          resolve(deviceId);
        } else {
          this.getDeviceImei().then((value) => {
            if (!deviceId) {
              if (value) {
                deviceId = 'KaiOS' + value;
              } else {
                deviceId = Math.random().toString(36).substr(2);
              }
              resolve(deviceId);
            }
          });
        }
      });
    },

    tryCreate: function() {
      if (!this.creationInProcess) {
        return;
      }

      let args = this.args;
      let id;
      if (this.args.configInfo &&
          this.args.configInfo.incoming) {
        id = this.args.configInfo.incoming.deviceId;
      }

      this.getDeviceId(id).then((deviceId) => {
        let options = {
          displayName: args.displayName,
          emailAddress: args.emailAddress,
          password: args.password,
          outgoingPassword: args.outgoingPassword,
          deviceId: deviceId,
          authenticatorId: args.authenticatorId
        };

        MailAPI.tryToCreateAccount(
          options,
          args.configInfo || null,
          (err, errDetails, account) => {
            this.creationInProcess = false;
            if (err) {
              this.onCreationError(err, errDetails);
            } else {
              if (this.createCanceled) {
                account.deleteAccount();
              } else {
                this.onCreationSuccess(account);
              }
            }
          });
      });
    },

    onCreationError: function(err, errDetails) {
      if (this.autoSetup) {
        evt.emit('autoAddDone');
      } else {
        this.callingCard.showError(err, errDetails);
      }
      cards.removeCardAndSuccessors(this, 'animate', 1);
    },

    onCreationSuccess: function(account) {
      if (!this.activity) {
        // Clear HTML cache since the outcome of the setup will change it
        htmlCache.reset();
      }

      if (account.type === 'activesync' ||
          account.authMechanism === 'oauth2') {
        account.modifyAccount({ public: true });
        if (!this.autoSetup) {
          cards.pushCard('setup_account_usedInfo', 'animate',
            {
              account: account,
              activity: this.activity
            });
        } else {
          if (document.hidden) {
            this.identity = account.identities[0];
            this.identity.modifyIdentity({
              signatureEnabled: true,
              signature: mozL10n.get('settings-default-signature-2')
            });

            //[LIO-934]:[Email]Default signature is incorrect. overwrite the value above.
            var sig = mozL10n.get('settings-default-signature-2');
            dump.log("setup_progress.js, default signature:"+sig+" from settings-default-signature-2");

            const key = "Customization.email.Signature";
            var req = navigator.mozSettings.createLock().get(key);
            self = this;
            req.onsuccess = function () {
              var customizationSignature = req.result[key];
              dump("query Customization.email.Signature success  customizationSignature = " + customizationSignature);
              if(customizationSignature && customizationSignature !== ""){
                  defaultSignature = customizationSignature;
                  self.identity.modifyIdentity({
                      signature: defaultSignature
                  });
              }
            };
            req.onerror = function(){
              dump("query Customization.email.Signature failed!");
            };
            //[LIO-934]:modify end
            evt.emit('autoAddDone');
          } else if (!this.createOnBackground) {
            cards.pushCard('setup_account_prefs', 'animate',
              {
                account: account,
                autoSetup: true
              });
          }
          this.createOnBackground = false;
        }
      } else {
        cards.pushCard('setup_account_prefs', 'animate',
          { account: account });
      }
    },

    die: function() {
      if (!this.createOnBackground) {
        this.cancelCreation();
      }
      window.removeEventListener('keydown', this.keydownHandler);
    }
  }
];
});
