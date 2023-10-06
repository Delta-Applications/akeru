/* global Service */
'use strict';
let ussdReceiver = {
  init: function _init() {
    navigator.mozSetMessageHandler('ussd-received', this.handleUssd.bind(this));
  },

  handleUssd: function _handleUssd(evt) {
    // evt.session means we need to user's interaction
    console.log('handle ussd ', evt);
    if (evt.session) {
      this._session = evt.session;

      let cancelSession = () => {
        // for canceling the mmi-loading dialog
        Service.request('StkDialog:hide');
        this.mmiloading = false;
        this._session.cancel();
        this._session = null;
      };
      Service.request('StkDialog:show', {
        mode: 'input',
        message: evt.message.replace(/\\r\\n|\\r|\\n/g, '\n'),
        header: navigator.mozL10n.get('confirmation'),
        onOk: (res) => {
          if (res) {
            console.log('send res = ', res);
            this.mmiloading = true;
            this._session.send(res);
            Service.request('SystemToaster:show', {
              text: navigator.mozL10n.get('message-sent')
            });
          } else {
            cancelSession();
          }
        },
        onCancel: cancelSession,
        onBack: cancelSession,
        messageType: 'ussd'
      });
    } else {
      this.onUssdReceivedNoSession(evt);
      this.mmiloading = false;
    }
  },

  onUssdReceivedNoSession: function _onUssdReceivedNoSession(evt) {
    if (this.mmiloading) {
      Service.request('StkDialog:hide');
    }

    let network = navigator.mozMobileConnections[evt.serviceId || 0].voice.network;

    Service.request('StkDialog:show', {
      mode: 'alert',
      header: network ? (network.shortName || network.longName) : '',
      message: evt.message ?
        evt.message.replace(/\\r\\n|\\r|\\n/g, '\n')
        : navigator.mozL10n.get('GetEmptyUssdPrompt'),
      messageType: 'ussd'
    });
  }
};

ussdReceiver.init();
