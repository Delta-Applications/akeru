
define(['require','query_string','services','cards'],function(require) {
  let queryString = require('query_string');
  let services = require('services');
  let cards = require('cards');

  // All of the oauthSecrets we know.
  let oauthSecrets = services.oauth2;
  // The secrets for the oauth we're currently doing.
  let curOauthSecrets;
  // Flag to indicate the work for redeeming the auth code is still in progress,
  // so detection of the auth window closing should not cancel the operation.
  let redeemingCode = false;

  const TIMEOUT_MS = 30 * 1000;

  const redirectUri = 'http://localhost';

  let deferred, p, oauthSettings, oauthWindow, winIntervalId;

  const WINDOW_TIMER_INTERVAL = 300;

  const state = 'KaiOSMail628842';

  /**
   * The postMessage listener called from redirect.html to indicate the final
   * data returned from the oauth jump.
   * @param  {DOMEvent} event the event sent via redirect.html's postMessage.
   */
  function onBrowserComplete(evt) {
    window.removeEventListener('message', onBrowserComplete);
    let message = evt.data;
    let data = message.data;
    if (message.type === 'oauth2Complete') {
      if (!data.code) {
        reset('reject', new Error('no code returned'));
        return;
      }

      if (data.state !== state) {
        reset('reject', new Error('return state error'));
        return;
      }

      // Okay, so we've got a code.  And now we need to redeem that code for
      // tokens.
      console.log('oauth redirect returned with code');
      redeemingCode = true;
      redeemCode(data.code).then(
        (redeemed) => {
          // Microsoft provides expires_on too but Google only provides
          // expires_in, so let's just use expires_in for now.
          let expiresInMS = parseInt(redeemed.expires_in, 10) * 1000;
          // Make the time absolute and let's take 30 seconds off the end to
          // allow for ridiculous latency.
          let expireTimeMS = Date.now() +
                             Math.max(0, expiresInMS - TIMEOUT_MS);
          let result = {
            status: 'success',
            tokens: {
              accessToken: redeemed.access_token,
              refreshToken: redeemed.refresh_token,
              expireTimeMS: expireTimeMS
            },
            secrets: curOauthSecrets
          };

          reset('resolve', result);
        },
        (err) => {
          reset('reject', err);
        });
    } else {
      // Treat anything else like a cancel, it failed or was stopped by the
      // user.
      reset('resolve', { status: 'cancel' });
    }
  }

  /**
   * Turns the code received from the oauth jump into an actual oauth token
   * data.
   * @param  {String} code the code received from the oauth2 provider.
   * @return {Promise}
   */
  function redeemCode(code) {
    console.log('redeeming oauth code');
    return new Promise((xhrResolve, xhrReject) => {
      let xhr = new XMLHttpRequest({ mozSystem: true });
      xhr.open('POST', oauthSettings.tokenEndpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.timeout = TIMEOUT_MS;

      xhr.onload = function() {
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error('token redemption failed', xhr.status,
                        xhr.responseText);
          xhrReject('status' + xhr.status);
        } else {
          try {
            // yeah, we could have just set responseType.
            let data = JSON.parse(xhr.responseText);
            console.log('oauth code redeemed. access_token? ' +
                        !!data.access_token + ', refresh_token? ' +
                        !! data.refresh_token);
            xhrResolve(data);
          } catch (ex) {
            console.error('badly formed JSON response for token redemption:',
                          xhr.responseText);
            xhrReject(ex);
          }
        }
      };

      xhr.onerror = (err) => {
        console.error('token redemption weird error:', err);
        xhrReject(err);
      };
      xhr.ontimeout = () => {
        console.error('token redemption timeout');
        xhrReject('timeout');
      };

      let redemptionArgs = {
        code: code,
        client_id: curOauthSecrets.clientId,
        client_secret: curOauthSecrets.clientSecret,
        // uh, this doesn't seem right, but the docs want it?  hopefully it just
        // gets forever ignored?
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      };

      xhr.send(queryString.fromObject(redemptionArgs));
    });
  }

  /**
   * Checks that the browser window used to show the oauth provider's oauth2
   * flow to the user is still in operation. If it is not, it means the user
   * canceled the flow by closing that browser window.
   */
  function dialogHeartbeat() {
    if ((!oauthWindow || oauthWindow.closed) && !redeemingCode) {
      reset('resolve', { status: 'cancel' });
    }
  }

  function reset(actionName, value) {
    console.log('oauth2 fetch reset with action: ' + actionName);
    let action = deferred[actionName];

    if (winIntervalId) {
      clearInterval(winIntervalId);
      winIntervalId = null;
    }

    if (oauthWindow && !oauthWindow.closed) {
      oauthWindow.close();
    }

    deferred = p = oauthWindow = null;
    redeemingCode = false;

    action(value);
  }

  /**
   * Does the OAuth dialog dance.
   *
   * @param {Object} o2Settings
   * @param {String} o2Settings.authEndpoint
   *   URL of the authorization endpoint.
   * @param {String} o2Settings.scope
   *   The scope to request.
   * @param {String} [o2Settings.secretGroup]
   *   Secret group identifier if this is an initial OAuth.  If this is a reauth
   *   then the clientId should be provided instead and reused.
   * @param {String} [o2Settings.clientId]
   *   If this is a reauth (or don't need to/want to use our internal secret
   *   table, the client_id to reuse.  clientSecret should also be provided
   *   (even though we don't use it ourselves) for consistency.
   * @param  {Object} [extraQueryObject] extra query args to pass to the
   * provider. These are typically only known at runtime vs the o2Settings.
   * The property names in the extraQueryObject will be mapped to the provider's
   * preferred names by using o2Settings.extraArgsMap
   *
   * @return {Promise} The resolved value will be an object with these
   * properties:
   * * status: String indicating status of the request. 'succcess' and 'cancel'
   * are the possible values.
   * * tokens: If status is 'success', this will be the token data in the form
   *   { accessToken, refreshToken, expireTimeMS }
   * * secrets: The clientId and clientSecret used for this oauth.
   */
  return (o2Settings, extraQueryObject) => {
    // Only one auth session at a time.
    if (deferred) {
      reset('reject', new Error('Multiple oauth calls, starting new one'));
    }
    p = new Promise((res, rej) => {
      deferred = {
        resolve: res,
        reject: rej
      };
    });

    oauthSettings = o2Settings;

    curOauthSecrets = undefined;
    if (o2Settings.clientId && o2Settings.clientSecret) {
      curOauthSecrets = {
        clientId: o2Settings.clientId,
        clientSecret: o2Settings.clientSecret
      };
    } else if (o2Settings.secretGroup) {
      curOauthSecrets = oauthSecrets[o2Settings.secretGroup];
    }
    if (!curOauthSecrets) {
      reset('reject',
            new Error('no secrets for group: ' + o2Settings.secretGroup));
      return p;
    }

    let authEndpointQuery = {
      client_id: curOauthSecrets.clientId,
      // This must match what's in our manifest so we're not considering it
      // something that's allowed to change.  Because this is currently
      // fairly gmail specific with the "installed app" flow, we (must) use
      // localhost, but we are maintaining a redirect for our theoretical
      // https://email.gaiamobile.org/ domain.
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: o2Settings.scope,
      // max_auth_age set to 0 means that google will not keep the user signed
      // in after completing the oauth jump. This is important so that if an
      // account is deleted, someone else could not then just set up another
      // account using the cached sign in cookies.
      max_auth_age: 0,
      state: state
    };

    let url = o2Settings.authEndpoint + '?' +
              queryString.fromObject(authEndpointQuery);

    if (extraQueryObject) {
      let extraArgs = queryString.fromObject(extraQueryObject);
      if (extraArgs) {
        url += '&' + extraArgs;
      }
    }

    window.addEventListener('message', onBrowserComplete);

    oauthWindow = window.open(url, '', 'dialog');
    winIntervalId = setInterval(dialogHeartbeat, WINDOW_TIMER_INTERVAL);

    return p;
  };
});
