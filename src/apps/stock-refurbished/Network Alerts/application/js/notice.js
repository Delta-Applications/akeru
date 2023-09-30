'use strict';class Notices{constructor(){this.DEBUG=true;this.name='Notices';}
debug(s){if(this.DEBUG){console.log(`-*- CMAS ${this.name} -*- ${s}`);}}
checkNotifications(){let requests=[];return Notification.get({type:'WEA'}).then((notices)=>{for(let i=0;i<notices.length;i++){requests.push(this.sendNotification(notices[i].data));}
return Promise.all(requests);});}
sendNotification(message){this.debug('send notification');return new Promise((resolve,reject)=>{let _=window.navigator.mozL10n.get;if(!message.messageType){message.messageType='WEA';}
let notification=new window.Notification(_(message.messageType),{body:message.body,data:message,tag:message.id,type:'WEA',icon:'messages'});notification.onerror=()=>{reject(new Error('CMAS: notification API error'));};notification.onshow=resolve;notification.addEventListener('click',function nh_click(){notification.removeEventListener('click',nh_click);notification.close();});});}}