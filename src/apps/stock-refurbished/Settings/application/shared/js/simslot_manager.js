!function(t){var e=navigator.mozIccManager;t.SIMSlotManager={length:0,_instances:[],TIMEOUT_FOR_SIM2:2e3,_timerForSIM2:null,ready:!1,init:function(){e&&(this._conns=Array.prototype.slice.call(navigator.mozMobileConnections),this.length=this._conns.length,0!==this._conns.length&&(this._conns.forEach(function(t,n){this._instances.push(new SIMSlot(t,n,e.getIccById(t.iccId)))},this),e.addEventListener("iccdetected",this),this._publishSIMSlotIfReady()))},isMultiSIM:function(){return this.length>1},isSIMCardAbsent:function(t){var e=this.get(t);return e?e.isAbsent():!0},hasOnlyOneSIMCardDetected:function(){var t=this.isSIMCardAbsent(0),e=this.isSIMCardAbsent(1),n=t&&!e||!t&&e;return n},noSIMCardOnDevice:function(){return e&&e.iccIds?0===e.iccIds.length:!0},noSIMCardConnectedToNetwork:function(){return e&&e.iccIds?this._instances.every(function(t){return t.conn.voice&&t.conn.voice.emergencyCallsOnly}):!0},get:function(t){return t>this.length-1?null:this._instances[t]},getMobileConnection:function(t){return t>this.length-1?null:this._instances[t].conn},getSlots:function(){return this._instances},getSlotByIccId:function(t){var e=null;return this._instances.some(function(n){return n.conn.iccId&&n.conn.iccId===t?(e=n,!0):!1},this),e},waitForSecondSIM:function(){var t=this;this._timerForSIM2=setTimeout(function(){clearTimeout(t._timerForSIM2),t.publishSIMSlotIsReady()},this.TIMEOUT_FOR_SIM2)},publishSIMSlotIsReady:function(){this.ready||(this.ready=!0,t.dispatchEvent(new CustomEvent("simslotready")))},handleEvent:function(t){switch(t.type){case"iccdetected":var n=this.getSlotByIccId(t.iccId);n&&(n.update(e.getIccById(t.iccId)),this.isMultiSIM()?this.hasOnlyOneSIMCardDetected()?this.waitForSecondSIM():(clearTimeout(this._timerForSIM2),this.publishSIMSlotIsReady()):this.publishSIMSlotIsReady())}},_publishSIMSlotIfReady:function(){var t=0;return this._instances.forEach(function(e){e.isAbsent()||t++},this),t===this._instances.length?(this.publishSIMSlotIsReady(),void 0):!this._timerForSIM2&&this.isMultiSIM()&&this.hasOnlyOneSIMCardDetected()?(this.waitForSecondSIM(),void 0):void 0}},SIMSlotManager.init()}(window);