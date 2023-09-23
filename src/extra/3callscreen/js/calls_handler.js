const CallsHandler=function(){const l=8,a=[];let n=null;const r=1,c=4;let o=.2,e=null,i=!1;const s=5e3;let d=null;const u=5e3;let g=null;const m=11,h=window.api.l10n.get;let f=null,t=null;const{telephony:p}=window.navigator.b2g;let C=!1,v=!1,S=!0,b="",w={answer:!1,hangUp:!1,merge:!1},T=!1,y=!1;p.oncallschanged=M,p.onringbacktone=function(e){if(dump("onRingbackTone: evt.playRingbackTone: "+e.playRingbackTone),e.playRingbackTone){dump("onRingbackTone: telephony.calls.length is: "+p.calls.length);for(let e=0;e<p.calls.length;e++){var n=p.calls[e];if(dump("onRingbackTone: call.state = "+n.state),"dialing"===n.state||"alerting"===n.state)return void function(n){if(dump("playRingbackTone"),t)dump("playRingbackTone, ringbackToneInterval is not null");else{const e=[[440,480,2e3],[0,0,4e3]];t=window.setInterval(()=>{TonePlayer.playSequence(e)},6200),TonePlayer.playSequence(e),n.addEventListener("statechange",function e(){dump("playRingbackTone, statechange Listener, call.state = "+n.state),"dialing"!==n.state&&"alerting"!==n.state&&(x(),n.removeEventListener("stateChange",e))})}}(n)}}else x()},p.onsuppservicenotification=function(e){if(e&&e.code){switch(dump("calls_handler onsuppservicenotification evt.code:"+e.code),e.code){case"mt-call_on_hold":T=!0,Rtt.isRttViewShown()&&(dump("calls_handler onsuppservicenotification Hide RTT view"),Rtt.hideRttView(),y=!0),CallScreenHelper.render(),CallScreen.showToast({messageL10nId:"mt-call-on-hold"});break;case"mt-call_retrieved":"mt-multi_party_call"!==b&&CallScreen.showToast({messageL10nId:"mt-call_retrieved"}),T=!1,CallScreenHelper.render(),y&&(CallScreen.showRttView(),y=!1);break;case"mt-multi_party_call":CallScreen.showToast({messageL10nId:"mt-multi_party_call"});break;default:return}b=e.code}},p.ontelephonycoveragelosing=function(){dump("onTelephonyCoverageLosing: remindBadWfc"),CallScreen.remindBadWfc()},window.addEventListener("keydown",function(){PowerManager.getScreenEnabled().then(e=>{e&&(i?A:N)(!0)})},!0),window.addEventListener("visibilitychange",function(){CallsHandler.isAnyOpenCalls&&de(!document.hidden)}),navigator.b2g.getFlipManager&&navigator.b2g.getFlipManager().then(e=>{e.addEventListener("flipchange",H)});const k=new BluetoothHelper;let L=!1;const E=[];function I(){a.forEach(e=>{e=e.getRecord();E.push(e)})}function R(){for(let e=0;e<p.calls.length;e++)p.calls[e].hangUp();!p.conferenceGroup.calls.length&&""===p.conferenceGroup.state||K()}function H(e){e.currentTarget.flipOpened?(SettingsObserver.getValue("quickdialmode.help.keypress").then(e=>{"triplepress"===e&&SettingsObserver.getValue("quickdialmode.enabled").then(e=>{e&&SettingsObserver.getValue("quickdial.number.info").then(e=>{e&&e.number&&1===p.calls.length&&0===p.conferenceGroup.calls.length&&-1!==p.calls[0].id.number.indexOf(e.number)&&(dump("FIH:onFlipChange-switchToReceiver"),Z())})})}),SettingsObserver.getValue("phone.answer.flipopen.enabled").then(e=>{e&&F()})):L||((e=navigator.b2g.audioChannelManager)&&e.headphones||R())}function V(e){e.detail.data.lineControl&&a[0].allowConnected()}let G=null;function M(){dump("callscreen onCallsChanged"),CallScreen.showMainCallscreen(),!G&&0<p.calls.length&&(G=navigator.b2g.requestWakeLock("high-priority")),G&&0===p.calls.length&&(G.unlock(),G=null),p.active&&p.active.addEventListener("error",P);for(let e=0;e<p.calls.length;e++){const n=p.calls[e];a.some(e=>e.call===n)||function(n){var{type:e}=window.navigator.b2g.mobileConnections[n.serviceId].voice,e=0===a.length&&-1!==["evdo0","evdoa","evdob","1xrtt","is95a","is95b"].indexOf(e)&&"dialing"===n.state;if(p.calls.length>l)n.hangUp();else{1!==p.calls.length||p.conferenceGroup.calls.length||(p.speakerEnabled&&(CallsHandler.toggleSpeaker(),OptionHelper.swapParams("inCallParams","Speaker-off","Speaker",!0)),CallScreen.hideDtmfNumber(),k.getConnectedDevicesByProfile(k.profiles.HFP,e=>{L=!(!e||!e.length),CallScreen.setBTReceiverIcon(L)}),CallScreen.switchToDefaultOut(!0),new Promise(n=>{SettingsObserver.getValue("screen.brightness").then(e=>{o=e,n()})}).then(()=>{A(!0)}));const t=new HandledCall(n);e&&(t.allowedConnected=!1),a.push(t),CallScreen.insertCall(t.node),"incoming"!==n.state&&"dialing"!==n.state&&"alerting"!==n.state||("incoming"===n.state?(A(!0),function(n){CallScreen.lockScreenWake(),n.addEventListener("statechange",function e(){p.calls.length&&"incoming"===p.calls[0].state||(n.removeEventListener("statechange",e),CallScreen.unlockScreenWake())})}(n)):N(!0),n.addEventListener("statechange",function e(){p.calls.length&&("incoming"===n.state||"dialing"===n.state||"alerting"===n.state)||((2<=p.calls.length||p.conferenceGroup.state)&&"connected"===n.state&&p.muted&&O(),n.removeEventListener("statechange",e),N(!0))})),1<a.length||1<=p.calls.length&&p.conferenceGroup.calls.length?"incoming"===n.state?CallsHandler.isVideoCall()||2===a.length&&a[0].node.querySelector(".local-video-view").classList.contains("full")||he()&&!n.emergency?X():(t.hide(),q(n)):t.show():p.ownAudioChannel&&p.ownAudioChannel()}}(n)}for(let e=a.length-1;0<=e;e--)"disconnected"===a[e].call.state&&function(e){a.splice(e,1);var{length:e}=a;let n=!1;e&&(n=a.some(e=>"incoming"===e.call.state));n&&(1<e||p.conferenceGroup.calls.length||p.conferenceGroup.state)||(n?(CallScreen.hideIncoming(),a.forEach(e=>{"incoming"===e.call.state&&e.show()})):CallScreen.incomingEnded())}(e);1===p.calls.length&&0===p.conferenceGroup.calls.length&&ee(),te()?(CallScreenHelper.setState("connected_waiting"),q(p.calls[0])):CallScreenHelper.setState(),D(CallScreen.callEndPromptTime),CallScreenHelper.render()}function x(){dump("stopRingbackTone"),window.clearInterval(t),t=null,TonePlayer.reset()}function O(){p.muted&&(CallsHandler.toggleMute(),OptionHelper.swapParams("inCallParams","Unmute","Mute",!0),CallScreen.updateCallsMuteState())}function N(n){if(!Rtt.isRttViewShown()){if(e&&clearTimeout(e),n)for(let e=0;e<p.calls.length;e++){var t=p.calls[e];if("connected"!==t.state&&"held"!==t.state){n=!1;break}}n&&(e=setTimeout(()=>{PowerManager.getScreenEnabled().then(e=>{e&&(PowerManager.setScreenBrightness(m),i=!0)})},s))}}function A(e){SettingsObserver.setValue([{name:"screen.brightness",value:o}]),N(!!e),i=!1}function P(n){if(void 0!==n.call&&n.call.error){let e=[[480,620,500],[0,0,500],[480,620,500],[0,0,500],[480,620,500],[0,0,500]];dump("CS handleBusyErrorAndPlayTone errorName:",n.call.error.name),"SipBusy"===n.call.error.name&&(e=[[200,800,500],[0,0,500],[200,800,500],[0,0,500],[200,800,500],[0,0,500]]),TonePlayer.playSequence(e)}}function q(n){var e=(n.secondId||n.id).number;n.emergency?B(n):Contacts.isBlockedNumber(e).then(e=>{e||B(n)})}function B(a){var e=CallScreen.getSimNum(a);const n=CallScreen.incomingInfo.querySelector(".status-icon");""===e?delete n.dataset.index:n.dataset.index=e,CallsHandler.isVideoCall(a)?n.dataset.video="video-":delete n.dataset.video,CallScreen.incomingStirChecked.classList.toggle("hide","pass"!==a.verStatus),CallScreen.incomingHdIcon.classList.toggle("hide","Normal"===a.voiceQuality),CallScreen.incomingInfo.classList.remove("ended"),CallScreen.showIncoming(),a.addEventListener("statechange",function e(){CallScreen.incomingContainer.classList.contains("displayed")&&"incoming"===a.state?CallScreen.incomingHdIcon.classList.toggle("hide","Normal"===a.voiceQuality):(CallScreen.incomingStirChecked.classList.add("hide"),a.removeEventListener("statechange",e))}),function(n){if(!f){const e=[[440,440,100],[0,0,100],[440,440,100]];f=window.setInterval(()=>{TonePlayer.playSequence(e)},1e4),TonePlayer.playSequence(e),n.addEventListener("statechange",function e(){"incoming"!==n.state&&(n.removeEventListener("statechange",e),ee())})}}(a);const r=(a.secondId||a.id).number;if(!r)return CallScreen.incomingNumber.textContent=h("unknown"),void(CallScreen.incomingNumberAdditionalTel.textContent="");const t=SdnContacts.get()[a.serviceId];if(t&&t.get(r))return CallScreen.incomingNumber.textContent=t.get(r),CallScreen.incomingNumberAdditionalTelType.textContent="",void(CallScreen.incomingNumberAdditionalTel.textContent=r);Contacts.findByNumber(r,(e,n)=>{let t=r,l=!1;e&&(e.name?(dump("callscreen displayCallWaiting contact.name :"+e.name),t=e.name,l=!0):e.email&&e.email.value&&(t=e.email.value,l=!0)),CallsHandler.setCNAPText(a,CallScreen.incomingNumberAdditionalTel,CallScreen.incomingNumber)?l&&(CallScreen.incomingNumber.textContent=t):e&&e.name?(CallScreen.incomingInfo.classList.add("additionalInfo"),CallScreen.incomingNumber.textContent=t,CallScreen.incomingNumberAdditionalTelType.textContent=Utils.getPhoneNumberAdditionalInfo(n),CallScreen.incomingNumberAdditionalTel.textContent=r):(CallScreen.incomingNumber.textContent=r,CallScreen.incomingNumberAdditionalTelType.textContent="",CallScreen.incomingNumberAdditionalTel.textContent=h("unknown")),dump("callscreen displayCallWaiting CallScreen.incomingNumber "+CallScreen.incomingNumber.textContent)})}function D(e){0!==a.length||p.conferenceGroup.state||p.conferenceGroup.calls.length||(document.body.classList.toggle("no-handled-calls",!0),CallScreenHelper.finalCallEndOption(),C=!1,b="",w={answer:!1,hangUp:!1,merge:!1},null!==n&&(clearTimeout(n),n=null),n=setTimeout(()=>{if(OptionHelper.softkeyPanel.hideMenu(),CallRecording.showSpaceNoticeIfNeeded(),Rtt.resetRtt(),n=null,0===a.length){A(!1);const e=E;e.splice(0,e.length),CallScreen.resetWfcRemind(),O()}else document.body.classList.toggle("no-handled-calls",!1)},e))}function _(){return p.calls.length+(p.conferenceGroup.calls.length?1:0)}function U(e){const{command:n}=e.detail.data;switch(n){case"CHUP":!function(){const t=p.active;t?t.calls?K():(oe(t,"hangUp"),t.addEventListener("statechange",function e(){var{state:n}=t;"disconnected"!==n&&""!==n||p.active||Q(),t.removeEventListener("statechange",e)})):X()}();break;case"ATA":F();break;case"CHLD=0":a.forEach(e=>{var n=e.call.state;("held"===n||"incoming"===n&&1<a.length)&&oe(e.call,"hangUp")});break;case"CHLD=1":(1===a.length&&!te()||p.conferenceGroup.state&&!p.calls.length?X:$)();break;case"CHLD=2":(1!==_()||te()?fe("incoming")?W:j:z)();break;case"CHLD=3":le();break;default:"VTS"===n.substring(0,3)&&DtmfHelper.press(n.substring(4))}}function F(e){a.length&&(1<a.length||te()||p.conferenceGroup.calls.length?W():oe(a[0].call,"answer",e))}function W(){var e,n;a.length<2&&p.calls.length<2&&!p.conferenceGroup.calls.length&&!te()||(3===p.calls.length||2<=p.calls.length&&p.conferenceGroup.calls.length?$():(p.active||2<=a.length||1===p.calls.length&&p.conferenceGroup.calls.length?(oe(e=a[a.length-1].call,"answer","voice"),(n=e)&&"full"===n.rttMode&&n.addEventListener("statechange",function e(){"incoming"===n.state&&"full"===n.rttMode||("connected"===n.state&&"off"===n.rttMode&&CallScreen.showToast({messageL10nId:"voice-only-call"}),n.removeEventListener("statechange",e))}),CallScreen.hideIncoming()):a[0].call.hold().then(()=>{CallScreen.hideIncoming()}),te()&&(k.answerWaitingCall(),CallScreenHelper.setState("connected_hold"),CallScreenHelper.render(),a[0].updateCallNumber(),ee())))}function $(){if(!(a.length<2)||te())if(p.active!==p.conferenceGroup){if(te())a[0].call.hold(),ee(),k.answerWaitingCall();else{const t=p.active||a[a.length-2].call;let n=null;a.some(e=>"incoming"===e.call.state&&(n=e.call,!0)),t&&n?(t.addEventListener("disconnected",function e(){t.removeEventListener("disconnected",e),oe(n,"answer")}),oe(t,"hangUp")):t?oe(t,"hangUp"):n&&oe(n,"answer")}CallScreen.hideIncoming(),te()&&a[0].updateCallNumber()}else K().then(()=>{CallScreen.hideIncoming()})}function j(){ne()&&!te()||(_()<2&&!te()?p.active||Q():(p.active.hold(),k.toggleCalls()))}function z(){Q()}function Q(){if(dump(`holdOrResumeSingleCall ${_()} ${p.calls.length}`),1===_()&&(!p.calls.length||"incoming"!==p.calls[0].state&&p.calls[0].switchable))if(p.active)p.active.hold();else{const e=p.calls.length?p.calls[0]:p.conferenceGroup;dump("holdOrResumeSingleCall resume"),e.resume()}}function J(){if(te())CallScreenHelper.setState(),ee(),k.ignoreWaitingCall(),CallScreen.incomingEnded();else{var e=a.length-1;const{call:n}=a[e];window.performance.mark("endIncoming-start"),n.ondisconnected=()=>{window.performance.mark("endIncoming-end"),window.performance.measure("performance-endIncoming","endIncoming-start","endIncoming-end"),window.performance.clearMarks("endIncoming-start"),window.performance.clearMarks("endIncoming-end"),window.performance.clearMeasures("performance-endIncoming")},oe(n,"hangUp")}}function K(){return p.conferenceGroup.hangUp().then(()=>{ConferenceGroupHandler.signalConferenceEnded()},()=>{dump("Failed to hangup Conference Call")})}function X(){if(ne())J();else{let t=null;p.active?t=p.active:p.conferenceGroup.calls.length||p.conferenceGroup.state?t=p.conferenceGroup:[t]=p.calls,void 0!==t&&(t.calls?K():(t.addEventListener("statechange",function e(){var{state:n}=t;"disconnected"!==n&&""!==n||p.active||Q(),t.removeEventListener("statechange",e)}),oe(t,"hangUp")))}}function Y(){k.disconnectSco(),p.speakerEnabled||(p.speakerEnabled=!0)}function Z(){k.disconnectSco(),p.speakerEnabled&&(p.speakerEnabled=!1)}function ee(){window.clearInterval(f),f=null}function ne(){let n=null;if(te())[n]=p.calls;else for(let e=0;e<a.length;e++){var t=a[e];if("incoming"===t.call.state){n=t;break}}return n}function te(){return 1===p.calls.length&&"connected"===p.calls[0].state&&p.calls[0].secondId}function le(){w.merge||(I(),w.merge=!0,p.conferenceGroup.calls.length||2!==p.calls.length?p.conferenceGroup.state&&1===p.calls.length&&p.conferenceGroup.add(p.calls[0]):p.conferenceGroup.add(p.calls[0],p.calls[1]))}function ae(n){let t=!1,l="",a;for(let e=0;e<E.length;e++){const o=E[e];var r,c;if(o.number===n){if(t=!0,""!==o.name){l=o.name;break}}else-1!==o.number.indexOf(n)||-1!==n.indexOf(o.number)?a=o.name:(r=o.number.length,c=n.length,7<=r&&7<=c&&o.number.substr(r-7)===n.substr(c-7)&&(a=o.name))}return t||void 0!==a||"unavailable"!==n&&-1===n.indexOf("anonymous")||(a=h("unknown")),t||void 0!==a?(t||void 0===a||(l=a),l):null}function re(e,n){const t={},l={};var[a]=p.calls;const{videoCallProvider:r}=a;t.state=e,t.quality="default",l.state=n,l.quality="default",r.sendSessionModifyRequest(t,l)}function ce(e){const n=document.getElementById("list-call");e=void 0===e?S:e;S=e?(n.querySelector("#callsinfo").classList.add("hide"),n.querySelector(".status-icon").classList.add("hide"),n.querySelector(".duration").classList.add("hide"),n.querySelector(".local-video-view").classList.add("large"),n.querySelector(".local-video-anchor div").classList.add("large"),!1):(n.querySelector("#callsinfo").classList.remove("hide"),n.querySelector(".status-icon").classList.remove("hide"),n.querySelector(".duration").classList.remove("hide"),n.querySelector(".local-video-view").classList.remove("large"),n.querySelector(".local-video-anchor div").classList.remove("large"),!0)}function oe(e,n,t){var l;!1===w[n]&&(w[n]=!0,e.addEventListener("statechange",ie),e.addEventListener("error",ie),"answer"===n?(l=e,"voice"===t?l.answer(r,!1):"Bidirectional"===l.videoCallState?l.answer(c,!1):"full"===l.rttMode?l.answer(r,!0):l.answer(r,!1)):e[n]())}function ie(e){w.answer=!1,w.hangUp=!1,e.call.removeEventListener("statechange",ie),e.call.removeEventListener("error",ie)}function se(){for(let e=0;e<p.calls.length;e++)if("connected"===p.calls[e].state)return p.calls[e];return null}function de(e){N(e)}function ue(e,l){const[a]=ge(e);var n=me();1==n&&localStorage.setItem("make_rtt_call",!1),dump("callscreen makecall rttCall="+n);const t=window.navigator.b2g.telephony.dial(a,1,n,l);t.then(n=>{if(n instanceof TelephonyCall){const t=ge(e);1<t.length&&n.addEventListener("connected",function e(){n.removeEventListener("connected",e),function(e,n){let t=(e=e.slice(1)).length,l=t-1;for(;""===e[l];)--l;l+=1,e=e.slice(0,l),t=e.length;let a=Promise.resolve(),r=0,c=1;for(;r<t;){for(c=1;""===e[r];)c+=1,r+=1;a=a.then(function(e,n,t){return navigator.b2g.telephony.sendTones(e,3e3*n,null,t)}(e[r],c,n)),r+=1}a}(t,l)})}else MmiHandler.handleMmi(n.result,a,l)}).catch(e=>{dump("[callscreen] makeCall and error:",e),CallScreen.handleCallError(e,a)})}function ge(e){return e.split(",")}function me(){var e=!1,e="true"===localStorage.getItem("make_rtt_call");return dump("call isRttCallEnable isRttCall="+e),e}function he(){return a.some(e=>!0===e.call.emergency)}function fe(n){for(let e=0;e<p.calls.length;e++){var t=p.calls[e];if(t.state===n)return t}return null}return{setup:function(){p&&(p.muted=!1),k.getConnectedDevicesByProfile(k.profiles.HFP,e=>{L=!(!e||!e.length),v=L,CallScreen.setBTReceiverIcon(!(!e||!e.length))}),k.onhfpstatuschanged=e=>{L=e.status,v=L,CallScreen.setBTReceiverIcon(e.status)};const e=navigator.b2g.audioChannelManager;e&&e.addEventListener("headphoneschange",()=>{CallsHandler.isAnyOpenCalls&&(e.headphones?CallScreen.switchToDefaultOut(!0):C&&!L?CallScreen.switchToSpeaker():CallScreen.switchToDefaultOut())}),k.onscostatuschanged=function(e){L=e.status,e.status?CallScreen.switchToDefaultOut():C&&CallScreen.switchToSpeaker()},window.addEventListener("bluetooth-dialer-command",U),window.addEventListener("cdma-info-rec-received",V),SettingsObserver.observe("lockscreen.remote-lock",["",""],e=>{e&&""===e[0]&&""===e[1]||R()}),!p.calls.length&&""===p.conferenceGroup.state||M()},answer:F,holdAndAnswer:W,endAndAnswer:$,toggleCalls:j,ignore:J,end:X,toggleMute:function(){p.muted=!p.muted},toggleSpeaker:function(){p.speakerEnabled?CallsHandler.switchToDefaultOut():CallsHandler.switchToSpeaker()},switchToReceiver:Z,switchToSpeaker:Y,switchToDefaultOut:function(e){p.speakerEnabled&&(p.speakerEnabled=!1),e?k.disconnectSco():k.connectSco()},holdOrResumeCallByUser:z,getCall:fe,checkCalls:M,mergeCalls:le,exitCallScreenIfNoCalls:D,getGroupDetailsText:function(){let n="";return a.forEach(e=>{e.call.group&&(n+=e.info,n+=", ")}),n=n.substring(0,n.length-2),n.split(", ").length===p.conferenceGroup.calls.length?n:function(){var{calls:n}=p.conferenceGroup;let t="";for(let e=0;e<n.length;e++){var l=ae(n[e].id.number);null!==l&&(t+=`${l||n[e].id.number}, `)}return t=t.substring(0,t.length-2),t}()},conferenceCallEnd:function(){if(1===a.length){dump("callscreen conferenceCallEnd"+h("callEnded")),CallScreen.incomingInfo.classList.add("ended"),CallScreen.incomingNumberAdditionalTelType.textContent="",CallScreen.incomingNumberAdditionalTel.textContent=h("callEnded"),CallScreen.hideIncoming();const[e]=a;"incoming"===e.call.state&&(e.show(),setTimeout(()=>{"incoming"===e.call.state&&CallScreen.render("incoming")}))}},getConferenceStartTime:function(){var e=document.querySelector("#group-call > .duration");let n=0;return void 0===e.dataset.startTime?a.forEach(e=>{e=e.getStartTime();(0===n||n>e)&&(n=e)}):n=e.dataset.startTime,n},clearConferenceStartTime:function(){const e=document.querySelector("#group-call > .duration");delete e.dataset.startTime},setCNAPText:function(e,n,t){var{name:l}=e.id;if(""===l)return!1;var{number:a}=e.id,{numberPresentation:e}=e.id;switch(t.textContent=l,e){case"allowed":n.textContent=a;break;case"restricted":case"unknown":n.textContent=h("unknown");break;case"payphone":n.textContent=h("payphone")}return!0},getImsGroupDetailsText:function(){let n="";const{calls:a}=p.conferenceGroup,{imsCallsItem:r}=ConferenceGroupHandler;r.forEach((e,n)=>{let t=!1;var{length:l}=a;for(let e=0;e<l;e++)if(a[e]===n){t=!0;break}t||(ConferenceGroupHandler.removeFromGroupDetails(e),r.delete(n))});for(let e=0;e<a.length;e++){const l=a[e];if(r.has(l))n+=`${r.get(l).textContent}, `;else{var t=ae(l.id.number);if(null!==t){n+=`${t||l.id.number}, `;const c=ConferenceGroupHandler.addToImsGroupDetails(l.id.number,t);r.set(l,c),l.ondisconnected=()=>{c.dataset.groupHangup||CallScreen.showToast({messageL10nId:"call-left-conference-toast",title:c.textContent}),ConferenceGroupHandler.removeFromGroupDetails(c),r.delete(l)}}}}return n=n.substring(0,n.length-2),n},insertImsRecord:I,isInConferenceCall:function(n){var{calls:t}=p.conferenceGroup;if(!t.length)return!1;for(let e=0;e<t.length;e++)if(t[e].id.number===n)return!0;return!1},changeCamera:function(){var[e]=p.calls;const{videoCallProvider:n}=e;VT.hideStreams("local"),n.setCamera(),e=VT.isCameraFront()?"rear":"front",VT.prepareLocalStreams(e).then(e=>{VT.localView.mozSrcObject=e,VT.localAnchor.hidden=!0,VT.showStreams("local")})},toggleCamera:function(){var[e]=p.calls;const{videoCallProvider:n}=e;VT.isCameraOn()?(VT.setCameraOn(!1),n.setCamera(),VT.hideStreams("local")):(e=VT.isCameraFront()?"front":"rear",VT.prepareLocalStreams(e).then(e=>{VT.localView.mozSrcObject=e,VT.localAnchor.hidden=!0,VT.showStreams("local")}))},changeVideoCallState:re,isVideoCall:function(e){if(p.conferenceGroup.calls.length)return!1;var{videoCallState:e}=e=e||p.calls[0];return!(!e||"TxEnabled"!==e&&"RxEnabled"!==e&&"Bidirectional"!==e&&"Paused"!==e)&&(dump("calls_handler isVideoCall() = true"),!0)},isSupportedVT:function(){if(p.conferenceGroup.calls.length)return!1;var[e]=p.calls,{capabilities:e}=e;return!(!e.vtLocalBidirectional||!e.vtRemoteBidirectional)},changeCallType:function(){if(CallsHandler.isVideoCall())re("bidirectional","audio-only"),VT.requestVoice();else{CallRecording.stopRec();const e=document.getElementById("list-call");e.querySelector(".local-video-view").classList.add("full"),VT.showLocalAnchor(!0),VT.prepareRemoteStreams().then(e=>{VT.remoteView.mozSrcObject=e,VT.remoteAnchor.hidden=!0}),re("audio-only","bidirectional"),CallScreenHelper.render()}},toggleShowInfo:ce,handleCallInfoTimer:function e(n){let t=null;1===p.calls.length&&(t=p.calls[0].videoCallState),"TxEnabled"!==t&&CallsHandler.isVideoCall()&&(d&&clearTimeout(d),n&&(d=setTimeout(()=>{"connected"===p.calls[0].state&&S&&CallsHandler.isVideoCall()&&(ce(),e(!1))},u)))},enableSpeakerForVT:function(){C=!0,v||navigator.b2g.audioChannelManager.headphones||Y()},getConnectedCall:se,enableScreenDimFeature:de,anyCallInRttMode:function(){for(let e=0;e<p.calls.length;e++)if("full"===p.calls[e].rttMode)return!0;return!1},isIncomingNumberAllowed:function(){if(!a.length)return!1;var{call:e}=a[a.length-1];return"incoming"===e.state&&"allowed"===e.id.numberPresentation&&!!e.id.number},isIncomingSupportedRtt:function(){var{length:e}=p.calls;return!!(0<e&&"incoming"===p.calls[e-1].state&&p.calls[e-1].capabilities&&p.calls[e-1].capabilities.supportRtt)},activeCallSupportRtt:function(){return!!(p.active&&p.active.capabilities&&p.active.capabilities.supportRtt)},dial:function(e){if(e=e.replace(/(\s|-|\.|\(|\))/gu,""),/^(?!,)([0-9#+*,]){1,50}$/u.test(e)){const{serviceId:l}=CallsHandler;if(dump("wss:"+e),dump("wss ATT:"+MobileOperator.isATTSimCard(SIMSlotManager.getSlots().conn)),1===p.calls.length&&"911"==e){dump("wss 911"),g=e;let t=null;p.active?t=p.active:[t]=p.calls,void 0!==t?(oe(t,"hangUp"),t.addEventListener("statechange",function e(){var{state:n}=t;dump("wss here state:"+n),"disconnected"!==n&&""!==n||ue(g,l),g=null,t.removeEventListener("statechange",e)})):dump("wss here null")}else ue(e,l)}else CallScreen.handleCallError("BadNumber")},openLines:_,replyMessage:function(e){const n=ne();if(n&&n.call){var{call:t}=n;if(navigator.b2g.mobileMessageManager){const l=navigator.b2g.mobileMessageManager.send(t.id.number,e,{serviceId:t.serviceId});l.onsuccess=()=>{var e=h("reply-to-name",{name:n.info});CallScreen.showToast({message:e})}}}},sendRTTmsg:function(){dump("callscreen: sendRTTmsg()"),Rtt.sendRTTmsg()},hideRttView:function(){dump("calls_handler: hideRttView()"),Rtt.hideRttView()},isRttCallEnable:me,get activeCall(){return function(){var n=p.active;let t=null;for(let e=0;e<a.length;e++){var l=a[e];if(n===l.call){t=l;break}}return t}()},get incomingCall(){return ne()},get canShowDtmfScreen(){return!("connected_waiting"===CallScreenHelper.cdmaState||fe("incoming")||CallsHandler.isVideoCall()||Rtt.isRttViewShown()||CallScreen.isBtMenuDisplayed()||!p.active)},get isAnyOpenCalls(){return 0<a.length||""!==p.conferenceGroup.state},get isAnyConnectedCall(){return!(!p.active||"connected"!==p.active.state)},get serviceId(){let e=0;return p.calls.length?e=p.calls[0].serviceId:p.conferenceGroup.calls.length&&(e=p.conferenceGroup.calls[0].serviceId),e},get imsRegState(){var{imsHandler:e}=navigator.b2g.mobileConnections[CallsHandler.serviceId];return e?e.capability:null},get isBtConnected(){return L},get isMute(){return p.muted},get isSpeakerEnabled(){return p.speakerEnabled},get isBTReceiverUsed(){return v},get isConferenceConnected(){return"connected"===p.conferenceGroup.state},get isConnectedCallInRttMode(){return function(){let e=!1;var n=se();return n&&"full"===n.rttMode&&(e=!0),e}()},set isMergeRequsted(e){w.merge=e},get isShowInfo(){return S},set isShowInfo(e){S=e},get handledCalls(){return a},get enableSpeaker(){return C},get isMtHold(){return T},set enableSpeaker(e){C=e},isAnyEmergencyCall:he,isFirstCallOnCdmaNetwork:function(){if(0===a.length)return!1;var e=a[0].call.serviceId,{type:e}=window.navigator.b2g.mobileConnections[e].voice;return-1!==["evdo0","evdoa","evdob","1xrtt","is95a","is95b"].indexOf(e)}}}();window.CallsHandler=CallsHandler;