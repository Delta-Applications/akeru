'use strict';(function(window){var IccManager=navigator.mozIccManager;window.SIMSlotManager={length:0,_instances:[],TIMEOUT_FOR_SIM2:2000,_timerForSIM2:null,ready:false,init:function ssm_init(){if(!IccManager){return;}
this._conns=Array.prototype.slice.call(navigator.mozMobileConnections);this.length=this._conns.length;if(this._conns.length===0){return;}
this._conns.forEach(function iterator(conn,index){this._instances.push(new SIMSlot(conn,index,IccManager.getIccById(conn.iccId)));},this);IccManager.addEventListener('iccdetected',this);this._publishSIMSlotIfReady();},isMultiSIM:function(){return(this.length>1);},isSIMCardAbsent:function ssm_isSIMCardAbsent(index){var slot=this.get(index);if(slot){return slot.isAbsent();}else{return true;}},hasOnlyOneSIMCardDetected:function(){var sim0Absent=this.isSIMCardAbsent(0);var sim1Absent=this.isSIMCardAbsent(1);var hasOneSim=(sim0Absent&&!sim1Absent)||(!sim0Absent&&sim1Absent);return hasOneSim;},noSIMCardOnDevice:function ssm_noSIMCardOnDevice(){if(!IccManager||!IccManager.iccIds){return true;}
return(IccManager.iccIds.length===0);},noSIMCardConnectedToNetwork:function ssm_noSIMCardConnectedToNetwork(){if(!IccManager||!IccManager.iccIds){return true;}
return this._instances.every(function iterator(instance){return instance.conn.voice&&instance.conn.voice.emergencyCallsOnly;});},get:function ssm_get(index){if(index>this.length-1){return null;}
return this._instances[index];},getMobileConnection:function ssm_getMobileConnection(index){if(index>this.length-1){return null;}
return this._instances[index].conn;},getSlots:function ssm_getSlots(){return this._instances;},getSlotByIccId:function ssm_getSlotByIccId(iccId){var found=null;this._instances.some(function iterator(slot,index){if(slot.conn.iccId&&slot.conn.iccId===iccId){found=slot;return true;}else{return false;}},this);return found;},waitForSecondSIM:function(){var self=this;this._timerForSIM2=setTimeout(function(){clearTimeout(self._timerForSIM2);self.publishSIMSlotIsReady();},this.TIMEOUT_FOR_SIM2);},publishSIMSlotIsReady:function(){if(!this.ready){this.ready=true;window.dispatchEvent(new CustomEvent('simslotready'));}},handleEvent:function ssm_handleEvent(evt){switch(evt.type){case'iccdetected':var slot=this.getSlotByIccId(evt.iccId);if(slot){slot.update(IccManager.getIccById(evt.iccId));if(!this.isMultiSIM()){this.publishSIMSlotIsReady();}else{if(this.hasOnlyOneSIMCardDetected()){this.waitForSecondSIM();}else{clearTimeout(this._timerForSIM2);this.publishSIMSlotIsReady();}}}
break;}},_publishSIMSlotIfReady:function(){var numDetected=0;this._instances.forEach(function iterator(slot){if(!slot.isAbsent()){numDetected++;}},this);if(numDetected===this._instances.length){this.publishSIMSlotIsReady();return;}
if(!this._timerForSIM2&&this.isMultiSIM()&&this.hasOnlyOneSIMCardDetected()){this.waitForSecondSIM();return;}}};SIMSlotManager.init();}(window));