!function(){let K=!1,Q=!1,X=!1;Promise.all([DeviceCapabilityManager.get("device.key.volume"),DeviceCapabilityManager.get("device.vilte"),DeviceCapabilityManager.get("device.key.endcall")]).then(e=>{[K,Q,X]=e,function(){const e={header:{l10nId:"kai-incoming-call"},items:[{name:"Answer",l10nId:"kai-answer",priority:1,method(){CallsHandler.answer()}},{get name(){return Rtt.settings===RTT_ALWAYS_VISIBLE?"ANS RTT":""},get l10nId(){return Rtt.settings===RTT_ALWAYS_VISIBLE?"req-rtt-call":""},get icon(){return Rtt.settings!==RTT_ALWAYS_VISIBLE&&CallsHandler.isIncomingNumberAllowed()?"messages":null},priority:2,method(){Rtt.settings===RTT_ALWAYS_VISIBLE?Rtt.requestIncomingRtt():CallsHandler.isIncomingNumberAllowed()&&CallScreen.toggleReplyMenu(!0)}},{l10nId:"kai-decline",name:"Decline",priority:3,method(){CallsHandler.end()}}]},a={items:[{name:"Answer",get l10nId(){return"answer-rtt-call"},priority:1,method(){CallsHandler.answer()}},{get name(){return CallsHandler.isIncomingNumberAllowed()?"reply":""},get l10nId(){return CallsHandler.isIncomingNumberAllowed()?"reply":""},priority:2,method:function(){CallsHandler.isIncomingNumberAllowed()&&CallScreen.toggleReplyMenu(!0)}},{name:"Decline",l10nId:"kai-decline",priority:3,method(){CallsHandler.end()}}]},l={header:{l10nId:"kai-incoming-call"},items:[{name:"Answer",l10nId:"kai-answer",priority:1,method(){CallsHandler.answer(),CallsHandler.enableSpeakerForVT()}},{name:"Voice call",icon:"video-off",priority:2,method(){CallsHandler.answer("voice")}},{l10nId:"kai-decline",name:"Decline",priority:3,method(){CallsHandler.end()}}]},n={get name(){return CallsHandler.isBTReceiverUsed?"Sound":CallsHandler.isSpeakerEnabled?"Speaker-off":"Speaker"},get l10nId(){return CallsHandler.isBTReceiverUsed?"sound":""},get icon(){return CallsHandler.isBTReceiverUsed?null:CallsHandler.isSpeakerEnabled?"mute":"speaker-on"},priority:2,method(){var e;CallsHandler.isBTReceiverUsed?CallScreen.toggleBluetoothMenu(!0):(window.performance.mark("toggleSpeaker-start"),CallsHandler.toggleSpeaker(),CallsHandler.enableSpeaker=!!CallsHandler.isSpeakerEnabled,e=OptionHelper.getLastParamName(),OptionHelper.show(e),e=CallsHandler.isSpeakerEnabled?"kai-speaker-on-notification":"kai-speaker-off-notification",CallScreen.showToast({messageL10nId:e}),window.performance.mark("toggleSpeaker-end"),window.performance.measure("performance-toggleSpeaker","toggleSpeaker-start","toggleSpeaker-end"),window.performance.clearMarks("toggleSpeaker-start"),window.performance.clearMarks("toggleSpeaker-end"),window.performance.clearMeasures("performance-toggleSpeaker"))}},r={get name(){return CallsHandler.isMute?"Unmute":"Mute"},get l10nId(){return CallsHandler.isMute?"kai-unmute":"kai-mute"},priority:1,method(){CallsHandler.toggleMute();var e=OptionHelper.getLastParamName();OptionHelper.show(e);e=CallsHandler.isMute?"kai-microphone-mute-notification":"kai-microphone-active-notification";CallScreen.showToast({messageL10nId:e}),CallScreen.updateCallsMuteState()}},t={header:{l10nId:"softkey-options"},items:[r,n]},i={name:"Volume",l10nId:"volume",priority:11,method(){CallScreen.requestVolume("show")}},o={get name(){return CallsHandler.isAnyEmergencyCall()?"":"Add-to-call"},get l10nId(){return CallsHandler.isAnyEmergencyCall()?"":"kai-add-to-call"},priority:4,method(){LockScreen.isScreenLocked()?LockScreen.showLockScreen(!0):CallScreen.placeNewCall()}},s={name:"Video-call",l10nId:"video-call",priority:5,method(){CallsHandler.changeCallType()}},m=[{get name(){return VT.isCameraFront()?"Rear camera":"Front camera"},get l10nId(){return VT.isCameraFront()?"rear-camera":"front-camera"},priority:7,method(){CallsHandler.changeCamera()}}],d=[{get name(){return VT.isCameraOn()?"Camera off":"Camera on"},get l10nId(){return VT.isCameraOn()?"camera-off":"camera-on"},priority:8,method(){CallsHandler.toggleCamera()}},{get name(){return CallsHandler.isVideoCall()?"Voice call":"Video call"},get l10nId(){return CallsHandler.isVideoCall()?"voice-call":"video-call"},priority:9,method(){CallsHandler.changeCallType()}},{get name(){return CallsHandler.isShowInfo?"Hide info":""},get l10nId(){return CallsHandler.isShowInfo?"hide-info":""},priority:10,method(){CallsHandler.toggleShowInfo(!0)}},{get name(){return CallsHandler.isShowInfo?"":"Show info"},get l10nId(){return CallsHandler.isShowInfo?"":"show-info"},priority:10,method(){CallsHandler.toggleShowInfo(!1)}}],c=[{name:"Rtt view",l10nId:"rtt-view",priority:6,method(){CallScreen.showRttView()}},{name:"Voice call",l10nId:"voice-call",priority:7,method(){Rtt.enableRttMode(!1)}}],p={get name(){return CallsHandler.activeCallSupportRtt()?"RTT call":""},get l10nId(){return CallsHandler.activeCallSupportRtt()?"oem-rtt-call":""},priority:6,method(){CallsHandler.activeCallSupportRtt()&&Rtt.enableRttMode(!0)}},C={name:"Unhold-call",l10nId:"unhold-call",priority:4,method(){CallsHandler.holdOrResumeCallByUser()}},g={get name(){return CallsHandler.isAnyEmergencyCall()?"":"Hold-call"},get l10nId(){return CallsHandler.isAnyEmergencyCall()?"":"hold-call"},priority:4,method(){CallsHandler.holdOrResumeCallByUser()}},u={name:"messages",l10nId:"messages",priority:8,method(){CallScreen.launchMessages()}},H={name:"Manage call",l10nId:"manage-call",priority:4,method(){ConferenceGroupUI.showGroupDetails(),CallScreenHelper.showGroupCallsOptions()}},h=[{get name(){return CallsHandler.isAnyEmergencyCall()?"":"Switch-to-second-line"},get l10nId(){return CallsHandler.isAnyEmergencyCall()?"":"kai-switch-to-second-line"},priority:3,method(){CallsHandler.toggleCalls()}},{get name(){return CallsHandler.anyCallInRttMode()||CallsHandler.isAnyEmergencyCall()?"":"Merge-calls"},get l10nId(){return CallsHandler.anyCallInRttMode()||CallsHandler.isAnyEmergencyCall()?"":"kai-merge-calls"},priority:4,method(){CallsHandler.anyCallInRttMode()||CallsHandler.mergeCalls()}}],y=[{name:"Answer",l10nId:"kai-answer",priority:3,method(){dump("hold-and-answer"),CallsHandler.holdAndAnswer()}},{l10nId:"kai-decline",name:"Decline",priority:4,method(){dump("Ignore-call"),CallsHandler.ignore()}}],I=[{name:"End and answer",l10nId:"kai-end-answer",priority:3,method(){dump("end-and-answer"),CallsHandler.endAndAnswer(),window.navigator.b2g.telephony.muted&&CallsHandler.unMute()}},{l10nId:"kai-decline",name:"Decline",priority:4,method(){dump("Ignore-call"),CallsHandler.ignore()}}],S={name:"Swap Call",l10nId:"kai-switch-to-second-line",priority:4,method(){CallsHandler.toggleCalls()}};var w=Object.assign({},t);K||(w.items=t.items.concat(i));var k=Object.assign({},w);k.items=w.items.concat(o);var O=Object.assign({},k);O.items=k.items.concat(g),O.items.push(u);var f=Object.assign({},O);f.items=O.items.concat(c),O.items=O.items.concat(p);var P=Object.assign({},O);Q&&(O.items=O.items.concat(s));var v=Object.assign({},w);v.items=w.items.concat(m);var b=Object.assign({},w);b.items=w.items.concat(m),b.items=b.items.concat(d);var R=Object.assign({},k);R.items=k.items.concat(C),R.items.push(u);var A=Object.assign({},k);A.items=k.items.concat(H);const T=Object.assign({},A);T.items=A.items.concat(g);const M=Object.assign({},A);M.items=A.items.concat(C);var V=Object.assign({},w);V.items=w.items.concat(h);const L=Object.assign({},V);L.items=V.items.concat(H);const E=Object.assign({},V);E.items=E.items.concat(c),V.items=V.items.concat(p);var D=Object.assign({},w);D.items=w.items.concat(y);var j=Object.assign({},w);j.items=w.items.concat(I);var N=Object.assign({},w);N.items=w.items.concat(S);const B={l10nId:"cancel",name:"Cancel",priority:1,method(){ConferenceGroupUI.hideGroupDetails()}},U={get l10nId(){return CallsHandler.isConferenceConnected?"private":null},get name(){return CallsHandler.isConferenceConnected?"Private":null},priority:2,method(){CallsHandler.isConferenceConnected&&ConferenceGroupUI.separateCall()}},G={name:"End",l10nId:"end",priority:3,method(){ConferenceGroupUI.endCall()}},_={items:[]},F={items:[]};X?(G.priority=1,U.priority=3,_.items.push(G),F.items.push(G),F.items.push(U)):(_.items.push(B),_.items.push(G),F.items.push(B),F.items.push(U),F.items.push(G));var W={items:[{l10nId:"cancel",name:"Cancel",priority:1,method(){CallScreen.bluetoothMenu.classList.contains("display")?CallScreen.toggleBluetoothMenu(!1):CallScreen.replyMenu.classList.contains("display")&&CallScreen.toggleReplyMenu(!1)}},{name:"Select",l10nId:"select",priority:2,method(){CallScreen.replyMenu.classList.contains("display")&&CallScreen.replyItemSelected()}}]},Y={header:{l10nId:"param1"},items:[{get name(){return X?"Cancel":"Clear"},get l10nId(){return X?"cancel":"clear"},priority:1,method(){X?DialerHelper.hideDialerHelper():DialerHelper.clearPhoneNumber()}},{get l10nId(){return CallsHandler.isRttCallEnable()?"rtt-call":"call"},priority:2,method(){DialerHelper.callNumber()}},{l10nId:"more",name:"more",priority:3,method(){CallScreen.launchMore()}}]},q={header:{l10nId:"param1"},items:[{name:"Cancel",l10nId:"cancel",priority:1,method(){DialerHelper.hideDialerHelper()}}]},x={header:{l10nId:"param1"},items:[{name:"Cancel",l10nId:"cancel",priority:1,method(){CallScreen.hideDtmfNumber()}}]},z={header:{l10nId:"softkey-options"},items:[{name:"back",l10nId:"back",priority:1,method(){CallsHandler.hideRttView(),CallScreenHelper.render()}},n]};var J={header:{l10nId:"softkey-options"},items:[{name:"back",l10nId:"back",priority:1,method:function(){CallsHandler.hideRttView(),CallScreenHelper.render()}},n,{l10nId:"send",name:"Send",priority:3,method:function(){CallsHandler.sendRTTmsg()}}]};k={header:{l10nId:"softkey-options"},items:[{name:"cancel",l10nId:"cancel",priority:1,method(){CallScreenHelper.render()}}]};w={items:[{name:"Select",l10nId:"select",priority:2,method:function(){CallScreen.addCallMenu.classList.contains("display")&&CallScreen.addCallItemSelected()}}]};OptionHelper.optionParams.inCallParams=t,OptionHelper.optionParams.incommingCall=e,OptionHelper.optionParams.incommingRttCall=a,OptionHelper.optionParams.incommingVTCall=l,OptionHelper.optionParams.inActiveCallParams=O,OptionHelper.optionParams.inActiveCallNotSupportVTParams=P,OptionHelper.optionParams.inActiveConfernceCallParams=T,OptionHelper.optionParams.InConnectingVTCallParams=v,OptionHelper.optionParams.inVTCallParams=b,OptionHelper.optionParams.inRttCallParams=f,OptionHelper.optionParams.inHeldCallParams=R,OptionHelper.optionParams.inConfernceCallParams=A,OptionHelper.optionParams.inHeldConfernceCallParams=M,OptionHelper.optionParams.inConferenceTwoLinesParams=L,OptionHelper.optionParams.inCallAnswerOrHoldParams=D,OptionHelper.optionParams.inCallEndAndAnswerParams=j,OptionHelper.optionParams.inCallTwoLinesParams=V,OptionHelper.optionParams.inCallTwoLinesActiveRttParams=E,OptionHelper.optionParams.InCallCDMAswitchCalls=N,OptionHelper.optionParams.manageCallGSM=F,OptionHelper.optionParams.manageCallVoLTE=_,OptionHelper.optionParams.menuDialogParams=W,OptionHelper.optionParams.dialerHelperOption=Y,OptionHelper.optionParams.dialerHelperCommandModeOption=q,OptionHelper.optionParams.dtmfScreenOption=x,OptionHelper.optionParams.finalCallEndParams={items:[{name:"",l10nId:"",priority:2}]},OptionHelper.optionParams.rttViewParams=z,OptionHelper.optionParams.rttViewEditParams=J,OptionHelper.optionParams.addCallDialogParams=w,OptionHelper.optionParams.lockScreenParams=k}()})}(window);