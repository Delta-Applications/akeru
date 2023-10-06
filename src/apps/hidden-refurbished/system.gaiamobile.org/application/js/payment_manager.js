'use strict';

(function(exports) {
  var PaymentManager = function PaymentManager() {};

  PaymentManager.EVENTS = [
    'paymentopened',
    'paymentclosed',
    'paymentopening',
    'paymentclosing',
    'launchpayment'
  ];

  BaseModule.create(PaymentManager, {
    name: 'PaymentManager',

    DEBUG: true,

    EVENT_PREFIX: 'payment-manager-',

    _handle_paymentopened: function() {
      this.publish('-activated');
    },

    _handle_paymentclosed: function() {
      this.publish('-deactivated');
    },

    isActive: function() {
      return this._paymentWindow && this._paymentWindow.isActive();
    },

    respondToHierarchyEvent: function(evt) {
      if (this['_handle_' + evt.type]) {
        return this['_handle_' + evt.type](evt);
      } else {
        return true;
      }
    },

    _handle_home: function() {
      this._paymentWindow && this._paymentWindow.close();
      return true;
    },

    setHierarchy: function(val) {
      if (val) {
        this._paymentWindow && this._paymentWindow.focus();
      }
    },

    freePaymentWindow: function() {
      /* Free the payment window unless there are active calls or the
       * payment is visible. */
      if (!this._paymentWindow.isVisible()) {
        this._paymentWindow.free();
      }
    },

    hasActiveWindow: function() {
      return this._paymentWindow && this._paymentWindow.isActive();
    },

    _start: function() {
      if (this._started) {
        throw 'Instance should not be start()\'ed twice.';
      }
      this._started = true;
      this.freePaymentWindow = this.freePaymentWindow.bind(this);

      this.readSetting('apps.payment.manifestUrl').then(function(value) {
        if (!value || !window.applications.getByManifestURL(value)) {
          this._unsubscribeEvents();
          return;
        }

        var config = {
          manifestURL: value
        };
        this._paymentWindow = new PaymentWindow(config);
        this._paymentWindow.hide();
      }.bind(this));

      Service.request('registerHierarchy', this);
      return this;
    },

    _stop: function() {
      if (!this._started) {
        return;
      }
      this._started = false;

      window.removeEventListener('launchpayment', this);
    },

    _handle_launchpayment: function() {
      this.openPayment();
    },

    openPayment: function() {
      if (this._paymentWindow) {
        this._paymentWindow.ensure();
        this._paymentWindow.open();
      }
    }
  });

}(window));
