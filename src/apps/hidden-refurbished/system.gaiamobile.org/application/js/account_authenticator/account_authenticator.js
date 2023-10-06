/* global AccountAuthenticatorConfig Oauth2Config IACHandler
  MozActivity Service
*/

'use strict'

const AccountAuthenticator = {
  init: function () {
    window.addEventListener('kaiAccountManagerChromeEvent', this)
    window.addEventListener('iac-emailcomms', this)
  },

  handleEvent: function (event) {
    if (!event || !event.type) {
      console.error('SystemAccountAuthenticator event is null')
      return
    }
    const type = event.type
    switch (type) {
      case 'kaiAccountManagerChromeEvent':
        {
          const detail = event.detail
          const messageId = detail.id
          const data = detail.data
          switch (detail.eventName) {
            case 'getPermittedOrigins':
            this.sendContentEvent({
              id: messageId,
              result: AccountAuthenticatorConfig.permittedOrigins
            })
            break
            case 'getAuthenticatorsDescriptor':
              this.sendContentEvent({
                id: messageId,
                result: AccountAuthenticatorConfig.authenticators
              })
              break
            case 'authenticate':
              if (navigator.onLine) {
                this.showLoginPage(messageId, data)
              } else {
                this.sendContentEvent({
                  id: messageId,
                  result: {
                    authenticatorId: data.authenticatorId,
                    error: 'no network'
                  }
                })
              }
              break
            case 'refreshCredential':
              if (navigator.onLine) {
                this.refreshCredential(messageId, data)
              } else {
                this.sendContentEvent({
                  id: messageId,
                  result: {
                    authenticatorId: data.authenticatorId,
                    error: 'no network'
                  }
                })
              }
              break
            case 'revokeCredential':
              this.revokeCredential(messageId, data)
              break
            default:
              break
          }
        }
        break
      case 'iac-emailcomms':
        {
          const response = event.detail
          if (response) {
            const userdata = {
              accountId: response.accountId
            }
            const data = {
              authenticatorId: 'activesync',
              credential: {
                username: response.username,
                password: response.password,
                configInfo: response.configInfo
              },
              userdata: userdata,
              credentialVisibility: ['username', 'password', 'configInfo']
            }
            if (this.easMessageId) {
              this.updateSyncSettings(response.accountId, true)
              this.sendContentEvent({
                id: this.easMessageId,
                result: data
              })
              this.easMessageId = null
            }
          }
        }
        break
      default:
        break
    }
  },

  showLoginPage: function (messageId, data) {
    const authenticatorId = data.authenticatorId
    const extraInfo = data.extraInfo
    switch (authenticatorId) {
      case 'activesync':
        {
          this.easMessageId = messageId
          if (extraInfo && extraInfo.hideSetupPage) {
            const port = IACHandler.getPort('emailcomms')
            if (port) {
              port.postMessage('requireData')
            }
            return
          }
          const activity = new MozActivity({
            name: 'setup',
            data: {
              type: 'EAS'
            }
          })
          activity.onerror = () => {
            this.sendContentEvent({
              id: messageId,
              result: {
                authenticatorId: authenticatorId,
                error: 'user cancel'
              }
            })
          }
        }
        break
      case 'google':
        {
          const authEndpointQuery = {
            client_id: Oauth2Config[authenticatorId].client_id,
            redirect_uri: Oauth2Config[authenticatorId].redirect_uri,
            response_type: 'code',
            scope: Oauth2Config[authenticatorId].scope,
            state: 'KaiOSAccountAuthenticator',
            // to use incremental authorization to request access to additional
            // scopes in context
            include_granted_scopes: true,
            // to get the refresh token
            access_type: 'offline',
            /* 'consent' to always get a refresh_token */
            /* 'select_account' to allow login multiple acocunts */
            prompt: 'select_account',
            login_hint: extraInfo && extraInfo.email ? extraInfo.email : ''
          }
          const url =
            Oauth2Config[authenticatorId].auth_uri +
            '?' +
            this.formObject(authEndpointQuery)
          const activity = new MozActivity({
            name: 'accountlogin',
            data: {
              authenticatorId: authenticatorId,
              url,
              extraInfo: extraInfo ? extraInfo : {}
            }
          })
          const self = this
          activity.onsuccess = function success() {
            if (this.result.code) {
              const requestData = {
                code: this.result.code,
                client_id: Oauth2Config[authenticatorId].client_id,
                client_secret: Oauth2Config[authenticatorId].client_secret,
                redirect_uri: Oauth2Config[authenticatorId].redirect_uri,
                grant_type: 'authorization_code'
              }
              self
                .getAccessToken(
                  Oauth2Config[authenticatorId].token_uri,
                  requestData
                )
                .then(
                  reslove => {
                    self.getGoogleAccountInfo(reslove).then(
                      accountInfo => {
                        const userdata = {
                          accountId: accountInfo.email
                        }
                        const credential = {
                          access_token: reslove.access_token,
                          token_type: reslove.token_type,
                          refresh_token: reslove.refresh_token,
                          expire_timestamp: +new Date() + reslove.expires_in * 1000
                        }
                        const data = {
                          authenticatorId: authenticatorId,
                          credential: credential,
                          credentialVisibility: [
                            'access_token',
                            'token_type',
                            'expire_timestamp'
                          ],
                          userdata: userdata
                        }
                        self.updateSyncSettings(accountInfo.email, true)
                        self.sendContentEvent({
                          id: messageId,
                          result: data
                        })
                      },
                      err => {
                        self.sendContentEvent({
                          id: messageId,
                          result: {
                            authenticatorId: authenticatorId,
                            error: err
                          }
                        })
                      }
                    )
                  },
                  err => {
                    self.sendContentEvent({
                      id: messageId,
                      result: {
                        authenticatorId: authenticatorId,
                        error: err
                      }
                    })
                  }
                )
            } else {
              // user didn't grant the permission
              self.sendContentEvent({
                id: messageId,
                result: {
                  authenticatorId: authenticatorId,
                  error: 'access denied'
                }
              })
            }
          }
          activity.onerror = () => {
            this.sendContentEvent({
              id: messageId,
              result: {
                authenticatorId: authenticatorId,
                error: 'user cancel'
              }
            })
          }
        }
        break
      default:
        break
    }
  },

  updateSyncSettings: function (accountId, isAdd) {
    if (!accountId) {
      return
    }

    const newAccountId = {
      [accountId]: true
    }

    const emailRequest = navigator.mozSettings
      .createLock()
      .get('emailSyncEnable')
    emailRequest.onsuccess = () => {
      let emailSyncEnableObj = emailRequest.result.emailSyncEnable ?
        emailRequest.result.emailSyncEnable : {}

      if (isAdd) {
        // bug 54788, do not turn on email sync value when login the exists account
        if (emailSyncEnableObj[accountId] !== false) {
          emailSyncEnableObj = Object.assign(emailSyncEnableObj, newAccountId)
        }
      } else {
        delete emailSyncEnableObj[accountId]
      }
      navigator.mozSettings.createLock().set({
        emailSyncEnable: emailSyncEnableObj
      })
    }

    const contactsRequest = navigator.mozSettings
      .createLock()
      .get('contactsSyncEnable')
    contactsRequest.onsuccess = () => {
      let contactsSyncEnableObj = contactsRequest.result.contactsSyncEnable ?
        contactsRequest.result.contactsSyncEnable : {}

      if (isAdd) {
        contactsSyncEnableObj = Object.assign(
          contactsSyncEnableObj,
          newAccountId
        )
      } else {
        delete contactsSyncEnableObj[accountId]
      }
      navigator.mozSettings.createLock().set({
        contactsSyncEnable: contactsSyncEnableObj
      })
    }

    const calendarRequest = navigator.mozSettings
      .createLock()
      .get('calendarSyncEnable')
    calendarRequest.onsuccess = () => {
      let calendarSyncEnableObj = calendarRequest.result.calendarSyncEnable ?
        calendarRequest.result.calendarSyncEnable : {}

      if (isAdd) {
        calendarSyncEnableObj = Object.assign(
          calendarSyncEnableObj,
          newAccountId
        )
      } else {
        delete calendarSyncEnableObj[accountId]
      }
      navigator.mozSettings.createLock().set({
        calendarSyncEnable: calendarSyncEnableObj
      })
    }
  },

  formObject: function (object) {
    let result = ''
    Object.keys(object).forEach(key => {
      result +=
        (result ? '&' : '') +
        encodeURIComponent(key) +
        '=' +
        encodeURIComponent(object[key])
    })
    return result
  },

  // exchange an authorization code for an access token
  getAccessToken: function (url, requestData) {
    return new Promise((xhrResolve, xhrReject) => {
      const xhr = new XMLHttpRequest({
        mozSystem: true
      })
      xhr.open('POST', url)
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
      xhr.timeout = 30 * 1000

      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error(
            'SystemAccountAuthenticator token redemption failed',
            xhr.status,
            xhr.responseText
          )
          const responseText = JSON.parse(xhr.responseText)
          xhrReject(responseText.error)
        } else {
          try {
            const data = JSON.parse(xhr.responseText)
            xhrResolve(data)
          } catch (ex) {
            xhrReject('badly formed JSON response')
          }
        }
      }

      xhr.onerror = () => {
        xhrReject('error')
      }
      xhr.ontimeout = () => {
        xhrReject('timeout')
      }
      xhr.send(this.formObject(requestData))
    })
  },
  // to get google account info
  getGoogleAccountInfo: function (data) {
    return new Promise((xhrResolve, xhrReject) => {
      const xhr = new XMLHttpRequest({
        mozSystem: true
      })
      const url = 'https://www.googleapis.com/userinfo/v2/me'
      xhr.open('GET', url)
      xhr.setRequestHeader(
        'Authorization',
        `${data.token_type} ${data.access_token}`
      )
      xhr.timeout = 30 * 1000

      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error(
            'SystemAccountAuthenticator get google info failed',
            xhr.status,
            xhr.responseText
          )
          const responseText = JSON.parse(xhr.responseText)
          xhrReject(responseText.error)
        } else {
          try {
            const response = JSON.parse(xhr.responseText)
            xhrResolve(response)
          } catch (ex) {
            xhrReject('badly formed JSON response')
          }
        }
      }

      xhr.onerror = () => {
        xhrReject('error')
      }
      xhr.ontimeout = () => {
        xhrReject('timeout')
      }
      xhr.send()
    })
  },

  verifyPassword: function (data) {
    const username = data.credential.username
    const password = data.extraInfo.password

    let baseUrl = data.credential.configInfo.server
    const servicePath = '/Microsoft-Server-ActiveSync'
    if (!baseUrl.endsWith(servicePath)) baseUrl += servicePath

    return new Promise((xhrResolve, xhrReject) => {
      const xhr = new XMLHttpRequest({
        mozSystem: true,
        mozAnon: true
      })

      xhr.open('OPTIONS', baseUrl, true)
      const authorization = 'Basic ' + btoa(username + ':' + password)
      xhr.setRequestHeader('Authorization', authorization)
      const USER_AGENT = 'KaiOS ActiveSync Client'
      xhr.setRequestHeader('User-Agent', USER_AGENT)
      xhr.timeout = 0

      xhr.upload.onprogress = xhr.upload.onload = function () {
        xhr.timeout = 0
      }

      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error(
            'SystemAccountAuthenticator verifyPassword failed: ',
            xhr.status,
            xhr.responseText
          )
          const incorrectPasswordError =
            xhr.responseText &&
            xhr.responseText.includes(
              'Access is denied due to invalid credentials'
            )
          xhrReject(
            incorrectPasswordError ? 'incorrect password' : 'server error'
          )
        } else {
          xhrResolve({
            password
          })
        }
      }

      xhr.onerror = () => {
        xhrReject('error')
      }

      xhr.ontimeout = () => {
        xhrReject('timeout')
      }

      xhr.send()
    })
  },

  refreshCredential: function (messageId, data) {
    const authenticatorId = data.authenticatorId
    const credential = data.credential
    switch (authenticatorId) {
      case 'activesync': // password verify
        {
          const extraInfo = data.extraInfo
          if (extraInfo && extraInfo.password) {
            this.verifyPassword(data).then(
              resolve => {
                const newPassword = resolve.password
                const data = {
                  authenticatorId: authenticatorId,
                  credential: {
                    username: credential.username,
                    password: newPassword,
                    configInfo: credential.configInfo
                  }
                }
                this.sendContentEvent({
                  id: messageId,
                  result: data
                })
              },
              errorMsg => {
                this.sendContentEvent({
                  id: messageId,
                  result: {
                    authenticatorId: authenticatorId,
                    error: errorMsg
                  }
                })
              }
            )
          } else {
            this.sendContentEvent({
              id: messageId,
              result: {
                authenticatorId: authenticatorId,
                error: 'no password in extrainfo'
              }
            })
          }
        }
        break
      case 'google':
        {
          const requestData = {
            refresh_token: credential.refresh_token,
            client_id: Oauth2Config[authenticatorId].client_id,
            client_secret: Oauth2Config[authenticatorId].client_secret,
            grant_type: 'refresh_token'
          }
          this.getAccessToken(
            Oauth2Config[authenticatorId].token_uri,
            requestData
          ).then(
            resolve => {
              const data = {
                authenticatorId: authenticatorId,
                credential: {
                  access_token: resolve.access_token,
                  token_type: resolve.token_type,
                  refresh_token: credential.refresh_token,
                  expire_timestamp: +new Date() + resolve.expires_in * 1000
                }
              }
              this.sendContentEvent({
                id: messageId,
                result: data
              })
            },
            error => {
              // this is for Bug 53376 feature requested
              if (error === 'invalid_grant') {
                this.addNotice(data)
              }
              this.sendContentEvent({
                id: messageId,
                result: {
                  authenticatorId: authenticatorId,
                  error: error
                }
              })
            }
          )
        }
        break
      default:
        break
    }
  },

  revokeOauth2Credential: function (authenticatorId, token) {
    return new Promise((xhrResolve, xhrReject) => {
      const xhr = new XMLHttpRequest({
        mozSystem: true
      })
      const url = `${Oauth2Config[authenticatorId].revoke_uri}?token=${token}`
      xhr.open('POST', url)
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
      xhr.timeout = 30 * 1000

      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error(
            'SystemAccountAuthenticator revokeOauth2Credential failed',
            xhr.status,
            xhr.responseText
          )
          const responseText = JSON.parse(xhr.responseText)
          if (responseText.error === 'invalid_token') {
            // if token expired or revoked, account manager also need to delete
            // account info from our device, so we return 'resolve' message
            xhrResolve()
          } else {
            xhrReject(responseText.error)
          }
        } else {
          xhrResolve()
        }
      }

      xhr.onerror = () => {
        xhrReject('error')
      }
      xhr.ontimeout = () => {
        xhrReject('timeout')
      }

      xhr.send()
    })
  },

  revokeCredential: function (messageId, data) {
    const authenticatorId = data.authenticatorId
    const credential = data.credential
    const accountId = data.accountId
    switch (authenticatorId) {
      case 'activesync':
        this.updateSyncSettings(accountId, false)
        this.sendContentEvent({
          id: messageId,
          result: {
            authenticatorId
          }
        })
        break
      case 'google':
        if (!navigator.onLine) {
          this.sendContentEvent({
            id: messageId,
            result: {
              authenticatorId: authenticatorId,
              error: 'no network'
            }
          })
          return
        }
        this.revokeOauth2Credential(
          authenticatorId,
          credential.access_token
        ).then(
          () => {
            this.updateSyncSettings(accountId, false)
            this.sendContentEvent({
              id: messageId,
              result: {
                authenticatorId: authenticatorId
              }
            })
          },
          errorMsg => {
            this.sendContentEvent({
              id: messageId,
              result: {
                authenticatorId: authenticatorId,
                error: errorMsg
              }
            })
          }
        )
        break
      default:
        break
    }
  },

  addNotice: function (accountData) {
    const _ = navigator.mozL10n.get
    // the 'id' will be 'authenticator_google_xxx@gmail.com'
    const id =
      `authenticator_${accountData.authenticatorId}_${accountData.accountId}`
    const info = {
      id: id,
      title: _('account-authenticator-invaild-grant-notice-title'),
      text: _('account-authenticator-invaild-grant-notice-text'),
      icon: 'contacts',
      type: 'account-authenticator-notification',
      dismissable: true,
      callback: () => {
        // revoke token/logout account
        const revokeData = {
          accountId: accountData.accountId,
          authenticatorId: accountData.authenticatorId
        }
        navigator.accountManager.logout(revokeData).then(
          () => {
            Service.request('NotificationStore:remove', id);
            // authenticate again
            const loginData = {
              authenticatorId: accountData.authenticatorId
            }
            const extraInfo = {
              email: accountData.accountId
            }
            navigator.accountManager.showLoginPage(loginData, extraInfo).then(
              () => {},
              error => {
                if (error === 'no network') {
                  Service.request('SystemToaster:show', {
                    text: _('account-authenticator-no-network-error')
                  });
                } else if (error === 'access denied') {
                  Service.request('SystemToaster:show', {
                    text: _('account-authenticator-access-denied-error')
                  });
                }
              }
            )
          },
          error => {
            if (error === 'no network') {
              Service.request('SystemToaster:show', {
                text: _('account-authenticator-no-network-error')
              });
            }
          }
        );
      }
    }
    Service.request('NotificationStore:add', info)
  },

  sendContentEvent: function (msg) {
    const event = new CustomEvent('kaiAccountManagerContentEvent', {
      detail: msg
    })
    window.dispatchEvent(event)
  }
}

AccountAuthenticator.init()
