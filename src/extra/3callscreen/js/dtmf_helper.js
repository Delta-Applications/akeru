const DtmfHelper=function(){let t=!0,l=null,r=null,o=!1,a=!1,s="";const i={1:[697,1209],2:[697,1336],3:[697,1477],4:[770,1209],5:[770,1336],6:[770,1477],7:[852,1209],8:[852,1336],9:[852,1477],"*":[941,1209],0:[941,1336],"#":[941,1477]},c=["1","2","3","4","5","6","7","8","9","*","0","#"];function e(e){var n=CallScreen.translateKey(e.key);-1!==c.indexOf(n)&&t&&CallsHandler.canShowDtmfScreen&&("keydown"===e.type?(o&&TonePlayer.start(i[n],a),f(n),s+=n,r=n,CallScreen.showDtmfNumber(s)):(o&&TonePlayer.stop(),n===r&&(u(),r=null)))}function f(e){let n=0;n=(CallsHandler.activeCall?CallsHandler.activeCall.call:navigator.b2g.telephony.active.calls[0]).serviceId,l&&(l.stop(),l=null),l=new DtmfTone(e,a,n),l.play()}function u(){l&&(l.stop(),l=null)}return{init:function(){window.addEventListener("keydown",e),window.addEventListener("keyup",e),SettingsObserver.observe("phone.ring.keypad",!1,e=>{o=!!e}),SettingsObserver.observe("phone.dtmf.type",!1,e=>{a="short"===e})},press:function(e){f(e),TonePlayer.start(i[e],!0),setTimeout(()=>{TonePlayer.stop(),u()})},disableDtmf:function(){t=!1},enableDtmf:function(){t=!0},get dtmfNumber(){return s},set dtmfNumber(e){s=e}}}();window.DtmfHelper=DtmfHelper;