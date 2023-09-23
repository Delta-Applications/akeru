/* eslint no-console: "off" */
(() => {
  console.log('remote Worker start............................');
  self.getPolyFill = (
    url,
    tokenType,
    token,
    emitSendBack
  ) => {
    const xhr = new XMLHttpRequest({ mozSystem: true });
    xhr.open('GET', url);
    xhr.setRequestHeader('Authorization', `${tokenType} ${token}`);
    xhr.onreadystatechange = () => {
      if (4 === xhr.readyState) {
        const responseJson = JSON.parse(xhr.responseText);
        const { emit, msgType } = emitSendBack;
        if (emit) {
          postMessage({
            responseJson,
            token,
            tokenType,
            msgType
          });
        }
      }
    };
    xhr.send();
  };

  self.postPolyFill = (
    url,
    tokenType,
    token,
    bodyContent,
    emitSendBack
  ) => {
    const xhr = new XMLHttpRequest({ mozSystem: true });
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `${tokenType} ${token}`);
    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.onreadystatechange = () => {
      if (4 === xhr.readyState) {
        const responseJson = JSON.parse(xhr.responseText);
        const { emit, successCallBack, failedCallBack } = emitSendBack;
        if (emit) {
          if (Object.prototype.hasOwnProperty.call(responseJson, 'id')) {
            // success
            postMessage({
              responseJson,
              msgType: successCallBack
            });
          } else {
            // failed
            postMessage({
              msgType: failedCallBack
            });
          }
        }
      }
    };
    xhr.send(JSON.stringify(bodyContent));
  };

  self.updatePolyFill = (
    url,
    tokenType,
    token,
    bodyContent,
    emitSendBack
  ) => {
    const xhr = new XMLHttpRequest({ mozSystem: true });
    xhr.open('PUT', url);
    xhr.setRequestHeader('Authorization', `${tokenType} ${token}`);
    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.onreadystatechange = () => {
      if (4 === xhr.readyState) {
        const responseJson = JSON.parse(xhr.responseText);
        const { emit, successCallBack, failedCallBack } = emitSendBack;
        if (emit) {
          if (Object.prototype.hasOwnProperty.call(responseJson, 'id')) {
            // success
            postMessage({
              responseJson,
              msgType: successCallBack
            });
          } else {
            // failed
            postMessage({
              msgType: failedCallBack
            });
          }
        }
      }
    };
    xhr.send(JSON.stringify(bodyContent));
  };

  self.deletePolyFill = (
    url,
    tokenType,
    token,
    emitSendBack
  ) => {
    const xhr = new XMLHttpRequest({ mozSystem: true });
    xhr.open('DELETE', url);
    xhr.setRequestHeader('Authorization', `${tokenType} ${token}`);
    xhr.onreadystatechange = () => {
      if (4 === xhr.readyState) {
        const res = xhr.responseText;
        const { emit, successCallBack, failedCallBack } = emitSendBack;
        if (emit) {
          if ('' === res) {
            postMessage({
              msgType: successCallBack
            });
          } else {
            postMessage({
              msgType: failedCallBack
            });
          }
        }
      }
    };
    xhr.send();
  };

  self.addEventListener('message', (e) => {
    if (!e) return;
    const msg = e.data;
    if ('fetch-remote-calendar-list' === msg.action) {
      const {
        protocol, calendarList, credential, callBackAction
      } = msg;
      const { access_token, token_type } = credential;
      const fetchURL = `${protocol}${calendarList}`;
      self.getPolyFill(fetchURL, token_type, access_token, {
        emit: true,
        msgType: callBackAction
      });
    } else if ('fetch-remote-events' === msg.action) {
      const {
        token, tokenType, fetchUrl, callBackAction
      } = msg;
      self.getPolyFill(fetchUrl, tokenType, token, {
        emit: true,
        msgType: callBackAction
      });
    } else if ('new-remote-calendar-event' === msg.action) {
      const {
        fetchURL,
        callBackActionSuccess,
        credential,
        newGEvent,
        callBackActionFailed
      } = msg;
      const { access_token, token_type } = credential;
      const { content } = newGEvent;
      self.postPolyFill(fetchURL, token_type, access_token, content, {
        emit: true,
        successCallBack: callBackActionSuccess,
        failedCallBack: callBackActionFailed
      });
    } else if ('delete-remote-calendar-event' === msg.action) {
      const {
        fetchURL, callBackActionSuccess, credential, callBackActionFailed
      } = msg;
      const { access_token, token_type } = credential;
      self.deletePolyFill(fetchURL, token_type, access_token, {
        emit: true,
        successCallBack: callBackActionSuccess,
        failedCallBack: callBackActionFailed
      });
    } else if ('update-remote-calendar-event' === msg.action) {
      const {
        fetchURL,
        callBackActionSuccess,
        credential,
        updatedEvent,
        callBackActionFailed
      } = msg;
      const { access_token, token_type } = credential;
      const { content } = updatedEvent;
      self.updatePolyFill(fetchURL, token_type, access_token, content, {
        emit: true,
        successCallBack: callBackActionSuccess,
        failedCallBack: callBackActionFailed
      });
    }
  });
})();
