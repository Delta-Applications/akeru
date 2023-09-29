const kMasterVolume=.5,kToneVolume=.7,kShortPressDuration=.15,kAttackDuration=.025,kDecayDuration=.025,kReleaseDuration=.05,TonePlayer={audioContext:null,channel:"telephony",gainNode:null,playingNodes:[],audibleNodeCount:0,initialized:!1,audio:null,notificationVolume:0,notificationTone:null,init(){this.reset(),SettingsObserver.observe("audio.volume.notification",0,t=>{this.notificationVolume=t}),SettingsObserver.observe("notification.ringtone",null,t=>{this.notificationTone=t}),this.initialized=!0},reset(){this.audioContext&&(this.audioContext.close(),this.audioContext=null),this.gainNode=null,this.playingNodes=[],this.audibleNodeCount=0},ensureAudio(){!this.audioContext&&this.initialized&&(this.audioContext=new AudioContext({audioChannel:this.channel}))},startAt(e,i,o){const n=this.audioContext;var{sampleRate:a}=n;const s=n.createBuffer(1,(o||.05)*a,a);for(let e=0;e<s.length;e++){let t=kToneVolume;var u=e/a;u<=kAttackDuration?t=u/kAttackDuration:u-kAttackDuration<=kDecayDuration&&(t=1-(1-kToneVolume)*(u-kAttackDuration)/kDecayDuration),o?u>o-kReleaseDuration&&(t*=(o-u)/kReleaseDuration):t-=kToneVolume,s.getChannelData(0)[e]=t*kMasterVolume}const l=n.createGain();l.connect(n.destination),o||(this.gainNode=l);const t=n.createBufferSource();t.buffer=s,t.start(i),t.connect(l.gain),l.gain.setValueAtTime(o?0:kToneVolume*kMasterVolume,0);for(let t=0;t<e.length;++t){const r=this.audioContext.createOscillator();this.audibleNodeCount++,r.onended=()=>{this.audibleNodeCount--,0===this.audibleNodeCount&&this.reset()},r.type="sine",r.frequency.value=e[t],r.start(i),o?r.stop(Math.max(i,n.currentTime+.5)+o):this.playingNodes.push(r),r.connect(l)}},start(t,e){this.ensureAudio(),this.startAt(t,0,e?kShortPressDuration:0)},stop(){if(this.gainNode){const e=this.audioContext;var{sampleRate:t}=e;const{gain:i}=this.gainNode;this.gainNode=null;const o=e.createBuffer(1,kReleaseDuration*t,t);for(let t=0;t<o.length;t++)o.getChannelData(0)[t]=(o.length-t-1)/o.length*kToneVolume*kMasterVolume;const n=e.createBufferSource();for(n.buffer=o,n.start(),n.connect(i),i.setValueAtTime(0,0);this.playingNodes.length;)this.playingNodes.pop().stop(e.currentTime+kReleaseDuration+.5)}},playSequence(e){this.ensureAudio();let i=this.audioContext.currentTime+.2;for(let t=0;t<e.length;++t){const a=e[t];var o=a.slice(0,2),n=a[2]/1e3;this.startAt(o,i,n),i+=n}},stopRingtone(){this.audio&&!this.audio.paused&&this.audio.pause()},playRingtone(t){this.stopRingtone(),this.audio||(this.audio=new Audio);const e=new SettingsURL;this.audio.src=e.set(t),this.audio.mozAudioChannelType=this.channel,this.audio.play(),window.setTimeout(()=>{this.audio.pause(),this.audio.removeAttribute("src"),this.audio.load()},2e3)},playNotice(){this.notificationVolume&&this.notificationTone?this.playRingtone(this.notificationTone):navigator.vibrate([200])}};window.TonePlayer=TonePlayer;