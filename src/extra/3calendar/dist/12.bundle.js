(window.webpackJsonp=window.webpackJsonp||[]).push([[12],{625:function(e,t,a){var n=a(626);"string"==typeof n&&(n=[[e.i,n,""]]);var i={hmr:!0,transform:void 0,insertInto:void 0};a(66)(n,i);n.locals&&(e.exports=n.locals)},626:function(e,t,a){(e.exports=a(65)(!1)).push([e.i,'#modifyEvent {\n  display: flex;\n  width: 100%;\n  flex-direction: column;\n  overflow: hidden;\n  position: absolute;\n  height: calc(100% - var(--softkeybar-height)); }\n\n.modify-event-content-wrapper {\n  overflow: auto;\n  background-color: var(--color-gs00);\n  height: 23.6rem; }\n\n#modify-event-description .label {\n  color: var(--theme-color-d);\n  font-weight: bold; }\n\n.modify-event-content-wrapper .subtitle-2.kai-2lines-listitem {\n  font-size: calc(var(--baseline) * 1.8);\n  color: var(--color-gs100); }\n\n.modify-event-content-wrapper .subtitle-1.kai-2lines-listitem {\n  font-size: calc(var(--baseline) * 1.4);\n  color: var(--color-gs60);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap; }\n\n#update-event-dialog kai-radio {\n  pointer-events: none; }\n\n.description-container {\n  margin-right: 2rem; }\n\n.description-container .description-lable .subtitle-1 {\n  font-size: calc(var(--baseline) * 1.4);\n  color: var(--theme-color-d);\n  font-weight: bold; }\n\n#modify-event-description {\n  background-color: var(--color-gs00);\n  color: var(--color-gs100);\n  border: none;\n  margin: -1rem 2rem 0 2rem;\n  width: calc(100% - 4rem);\n  height: 2.5rem; }\n\n.description-container .mutil-line {\n  overflow: auto;\n  height: auto !important; }\n\n.event-description-line {\n  background-color: var(--color-gs20);\n  height: 0.2rem;\n  box-sizing: border-box;\n  border-radius: 0.1rem;\n  margin: 0.4rem 2rem 0 2rem;\n  width: 32rem; }\n\n.event-description-line.focus {\n  background-color: var(--theme-color); }\n\n.description-length {\n  color: var(--color-gs40);\n  margin: 0.5rem 0 2rem 2rem; }\n\n.modify-event-content-wrapper li {\n  margin: 0;\n  padding: 1rem 1rem;\n  height: 6rem; }\n\ninput[type="text"] {\n  border-radius: 0.2rem;\n  background: var(--color-gs00);\n  padding: 0 1rem;\n  margin: 0;\n  height: 3.6rem;\n  box-sizing: border-box;\n  unicode-bidi: -moz-plaintext;\n  box-shadow: none;\n  display: block;\n  width: 100%; }\n\nbody label.pack-checkbox-large > span {\n  margin-bottom: 0;\n  width: 18.8rem;\n  height: 4rem;\n  left: 0;\n  line-height: 4rem !important;\n  text-overflow: ellipsis;\n  position: absolute;\n  overflow: hidden;\n  margin-left: 0;\n  -moz-padding-start: 0;\n  padding-right: 3.7rem;\n  white-space: nowrap; }\n\n.allday.modify-event-focus,\n.start-date.modify-event-focus,\n.end-date.modify-event-focus,\n.start-time.modify-event-focus,\n.end-time.modify-event-focus,\n.repeat-event.modify-event-focus,\n.event-calendar.modify-event-focus,\n.event-reminder.modify-event-focus {\n  height: 4rem;\n  display: flex;\n  flex-direction: column;\n  background-color: white; }\n\n@media (prefers-text-size: large) {\n  .start-date.modify-event-focus,\n  .end-date.modify-event-focus,\n  .start-time.modify-event-focus,\n  .end-time.modify-event-focus {\n    height: 5rem; } }\n\n#note-pad {\n  width: 100%; }\n\n.modifyEvent .button {\n  height: 2rem;\n  line-height: 2rem;\n  min-height: auto; }\n\n.modify-event-focus.focus {\n  color: var(--highlight-text-color, #ffffff);\n  background-color: var(--highlight-color, #00b965); }\n\n.button select {\n  position: absolute;\n  -moz-padding-start: 0;\n  left: -0.5rem;\n  color: var(--color-gs90);\n  border: none;\n  height: 2.5rem;\n  line-height: 1 !important;\n  background: none;\n  font-style: normal;\n  margin: 0;\n  top: -0.5rem; }\n\n#modifyEvent .button {\n  border: 0;\n  background-color: var(--color-gs00); }\n\n#modifyEvent .focus .button select {\n  color: var(--color-gs00); }\n\n#modifyEvent .focus .button {\n  color: var(--color-gs00);\n  background-color: var(--highlight-color); }\n\nhtml[dir="rtl"] #modifyEvent .pack-checkbox-large {\n  width: 100%; }\n\nhtml[dir="rtl"] #modifyEvent .pack-checkbox-large > span {\n  padding-right: 0rem;\n  padding-left: 3.0rem; }\n\n#modifyEvent .notes.modify-event-focus {\n  height: auto;\n  background-color: white; }\n\n.modify-event-content-wrapper .p-pri {\n  color: var(--color-gs90); }\n\n.modify-event-content-wrapper .p-sec {\n  color: var(--color-gs70); }\n\n.modify-event-content-wrapper .focus .p-pri,\n.modify-event-content-wrapper .focus .p-sec {\n  color: var(--color-gs00); }\n\n.modify-event-content-wrapper .title input,\n.modify-event-content-wrapper .location input,\n.modify-event-content-wrapper .notes textarea {\n  color: var(--color-gs90) !important; }\n',""])},645:function(e,t,a){"use strict";a.r(t);var n=a(0),i=a(242),r=a.n(i),o=a(44),l=a.n(o),d=a(76),s=a.n(d),c=a(3),u=a.n(c),m=a(596),f=a.n(m),p=a(225),h=a.n(p),v=a(157),y=a.n(v),b=a(45),g=a.n(b),D=a(11),E=a(21),w=a(51),k=a(2),S=a(243),N=a.n(S);function O(e){var t=e.getFullYear();return(1+e.getMonth()).toString().padStart(2,"0")+"/"+e.getDate().toString().padStart(2,"0")+"/"+t}var T=a(26),I=a(164),C=a(599);a(625);function x(e,t,a,n,i,r,o){try{var l=e[r](o),d=l.value}catch(e){return void a(e)}l.done?t(d):Promise.resolve(d).then(n,i)}function A(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function j(e,t,a){return t in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}a.d(t,"default",function(){return te});var R=n.default.createElement("span",{id:"title-title",className:"p-sec","data-l10n-id":"event-title"}),Y=n.default.createElement("span",{id:"where-title",className:"p-sec","data-l10n-id":"event-location"}),L=n.default.createElement("span",{id:"allday-title",className:"p-pri","data-l10n-id":"event-is-allday"}),M=n.default.createElement("span",{id:"startdate-title","data-l10n-id":"event-start-date",className:"p-sec start-date-track"}),q=n.default.createElement("span",{id:"starttime-title","data-l10n-id":"event-start-time",className:"p-sec start-time-track"}),B=n.default.createElement("span",{id:"enddate-title","data-l10n-id":"event-end-date",className:"p-sec end-date-track"}),U=n.default.createElement("span",{id:"endtime-title","data-l10n-id":"event-end-time",className:"p-sec end-time-track"}),F=n.default.createElement("span",{id:"eventreminder-title","data-l10n-id":"repeat",role:"heading","aria-level":"2",className:"p-sec modify-event-reminder"}),z=n.default.createElement("option",{"data-l10n-id":"never",value:"never"}),J=n.default.createElement("option",{"data-l10n-id":"every-day",value:"every day"}),H=n.default.createElement("option",{"data-l10n-id":"every-week",value:"every week"}),P=n.default.createElement("option",{"data-l10n-id":"every-2-weeks",value:"every 2 weeks"}),K=n.default.createElement("option",{"data-l10n-id":"every-month",value:"every month"}),_=n.default.createElement("span",{id:"eventreminder-title","data-l10n-id":"modify-event-calendar",role:"heading","aria-level":"2",className:"p-sec modify-event-reminder"}),V=n.default.createElement("span",{id:"eventReminder-title","data-l10n-id":"reminder",role:"heading","aria-level":"2",className:"p-sec modify-event-reminder"}),X=n.default.createElement("span",{id:"notes-title",className:"p-sec","data-l10n-id":"event-description"}),W=n.default.createElement("option",{value:"never","data-l10n-id":"never"}),G=n.default.createElement("option",{value:"every day","data-l10n-id":"every-day"}),Q=n.default.createElement("option",{value:"every week","data-l10n-id":"every-week"}),Z=n.default.createElement("option",{value:"every 2 weeks","data-l10n-id":"every-2-weeks"}),$=n.default.createElement("option",{value:"every month","data-l10n-id":"every-month"}),ee=n.default.createElement("div",null),te=function(e){var t,a;function i(t){var a;j(A(a=e.call(this,t)||this),"busytime",void 0),j(A(a),"addOperate",void 0),j(A(a),"selectedDate",void 0),j(A(a),"description",void 0),j(A(a),"title",void 0),j(A(a),"location",void 0),j(A(a),"allDayNode",void 0),j(A(a),"startDateNode",void 0),j(A(a),"endDateNode",void 0),j(A(a),"startTimeNode",void 0),j(A(a),"endTimeNode",void 0),j(A(a),"reminderNode",void 0),j(A(a),"calendarRepeatNode",void 0),j(A(a),"calendarAccountNode",void 0),j(A(a),"allDayEventsReminderNode",void 0),j(A(a),"alldayAlarm",void 0),j(A(a),"standardAlarm",void 0),j(A(a),"dataChanged",void 0),j(A(a),"FOCUS_SELECTOR",".modify-event-focus"),j(A(a),"updateSoftkey",function(){var e=a.element.querySelector(".modify-event-focus.focus"),t=null;t=e.classList.contains("title")||e.classList.contains("location")?"":e.classList.contains("notes")?"enter":"select",E.a.register({left:"cancel",center:t,right:"save"},document)}),j(A(a),"focus",function(){a.updateSoftkey()}),j(A(a),"changeFocus",function(){var e=document.querySelector("#modifyEvent .focus"),t=document.querySelector("li.modify-event-focus:focus"),a=document.querySelector(".modify-event-focus:focus");e&&e.classList.remove("focus"),t?t.classList.add("focus"):a&&a.parentNode.classList.add("focus")}),j(A(a),"buildOptionMenuItems",function(){a.optionItems={editAllItem:{id:"edit-all-events",callback:function(){a.handleOptionMenu("allEvent")}},editAllFutureItem:{id:"edit-all-future-events",callback:function(){a.handleOptionMenu("futureEvent")}}}}),j(A(a),"showDelOptions",function(){var e=[];e.push(a.optionItems.editAllItem),e.push(a.optionItems.editAllFutureItem),D.a.request("showOptionMenu",{options:e})}),j(A(a),"showUpdateFutureOptions",function(){var e=[];e.push(a.optionItems.editAllFutureItem),D.a.request("showOptionMenu",{options:e})}),j(A(a),"showSaveDialog",function(){Object(k.P)({header:"confirmation-title",type:"confirm",cancel:"no",ok:"yes",content:"save-message-back",onCancel:function(){a.historyBack(-1)},onOk:a.handleClickSaveButton.bind(A(a)),onBack:function(){a.historyBack(-1)}})}),j(A(a),"isSelect",function(){var e=document.activeElement;return"date"===e.type||"time"===e.type||"select-one"===e.type}),j(A(a),"timeFormatChanged",function(){a.forceUpdate()}),j(A(a),"handleLocalize",function(){a.forceUpdate()});var n=a.props.location,i=window.selectedDate;a.dataChanged=!1,a.buildOptionMenuItems(),a.busytime=n.state?n.state.item:null,a.addOperate=!a.busytime,a.selectedDate=a.addOperate?f()(i)?i:h()(i,(new Date).getHours()):a.busytime.busytimeSDate;var o=new Date;o.setMinutes(0);var d=Object(k.o)(o),s=r()(o,1),c=Object(k.o)(s),m=a.addOperate?u()(a.selectedDate,"MM/DD/YYYY"):a.busytime.startDate;n.state&&(void 0!==n.state.startTime?(a.selectedDate.setHours(n.state.startTime),a.selectedDate.setMinutes(0),a.selectedDate.setSeconds(0),d=Object(k.o)(a.selectedDate),a.selectedDate=r()(a.selectedDate,1),c=Object(k.o)(a.selectedDate)):n.state.allDay&&(a.allDay=!0));var p=JSON.parse(Object(k.y)("cal-settings"));a.standardAlarm=p?p.standardAlarm:"-300",a.alldayAlarm=p?p.alldayAlarm:"32400",!a.addOperate&&a.busytime.allDayEvent?(d=a.busytime.startTime,c=a.busytime.endTime):(d=a.addOperate?d:Object(k.o)(new Date(a.busytime.startDate+" "+a.busytime.startTime)),c=a.addOperate?c:Object(k.o)(new Date(a.busytime.endDate+" "+a.busytime.endTime)));var v=!a.addOperate&&a.busytime.allDayEvent;v=a.allDay?a.allDay:v,s=g()(o,s)?a.selectedDate:l()(a.selectedDate,1);var y=a.addOperate?u()(s,"MM/DD/YYYY"):a.busytime.endDate;return a.state={title:a.addOperate?"":a.busytime.title,location:a.addOperate?"":a.busytime.location,eventsAccount:a.addOperate?"calendar-local":a.busytime.account,eventsReminder:a.addOperate?a.standardAlarm:a.busytime.reminder,startDate:m,endDate:y,startTime:d,endTime:c,repeat:a.addOperate?"never":a.busytime.repeat,allDayEvent:v,description:a.addOperate?"":a.busytime.description,changed:!1,originRepeat:a.addOperate?"":a.busytime.repeat},a.handleOptionMenu=a.handleOptionMenu.bind(A(a)),a.handleKeydown=a.handleKeydown.bind(A(a)),D.a.register("changeFocus",A(a)),a}a=e,(t=i).prototype=Object.create(a.prototype),t.prototype.constructor=t,t.__proto__=a;var o=i.prototype;return o.componentDidMount=function(){var e,t=(e=regeneratorRuntime.mark(function e(){var t,a,n,i,r,o,l;return regeneratorRuntime.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:this.element.focus(),(t=this.element.querySelector(".modify-event-focus.title")).classList.add("focus"),t.querySelector(".input-focusable").focus(),this.updateSoftkey(),document.addEventListener("keydown",this.handleKeydown),a=this.state,n=a.title,i=a.location,r=a.repeat,o=a.allDayEvent,l=a.description,this.title.value=n,this.location.value=i,this.description.value=l,this.allDayNode.checked=o,this.element.querySelector("#repeat-select").value=r,window.addEventListener("localized",this.handleLocalize),I.a.on("settings-time-format-changed",this.timeFormatChanged);case 15:case"end":return e.stop()}},e,this)}),function(){var t=this,a=arguments;return new Promise(function(n,i){var r=e.apply(t,a);function o(e){x(r,n,i,o,l,"next",e)}function l(e){x(r,n,i,o,l,"throw",e)}o(void 0)})});return function(){return t.apply(this,arguments)}}(),o.componentDidUpdate=function(){this.updateSoftkey()},o.componentWillUnmount=function(){window.removeEventListener("localized",this.handleLocalize),document.removeEventListener("keydown",this.handleKeydown),I.a.removeListener("settings-time-format-changed",this.timeFormatChanged),D.a.unregister("changeFocus",this)},o.handleKeydown=function(e){var t=null,a=this.description.parentElement.classList.contains("focus"),n=this.description.value.length;switch(e.key){case"Enter":this.element.querySelector(this.FOCUS_SELECTOR+".focus").classList.contains("notes")||(e.stopPropagation(),e.preventDefault(),this.handlKeydownClick());break;case"ArrowUp":if(a&&0!==this.description.selectionStart)break;e.stopPropagation(),e.preventDefault(),t=this.findNext(-1);break;case"ArrowDown":if(a&&this.description.selectionStart!==n)break;e.stopPropagation(),e.preventDefault(),t=this.findNext(1);break;case"BrowserBack":case"Backspace":e.stopPropagation(),e.preventDefault(),this.dataChanged?this.showSaveDialog():this.isSelect()||this.historyBack(-1);break;case"SoftRight":e.stopPropagation(),e.preventDefault(),this.handleClickSaveButton();break;case"SoftLeft":e.stopPropagation(),e.preventDefault(),this.historyBack(-1)}if(t){var i=this.element.querySelector(".modify-event-focus.focus");i&&i.classList.remove("focus"),t.classList.add("focus");var r=t.querySelector(".input-focusable");r?r.focus():t.focus();var o=this.element.querySelector(".modify-event-content-wrapper");"ArrowUp"===e.key&&(t.offsetTop<=o.scrollTop||t.classList.contains("location"))?t.scrollIntoView(!0):"ArrowDown"===e.key&&t.offsetTop+t.clientHeight>=o.scrollTop+o.clientHeight?t.scrollIntoView(!1):(t.classList.contains("notes")||t.classList.contains("title"))&&t.scrollIntoView()}this.updateSoftkey()},o.handlKeydownClick=function(){var e=this.state,t=e.startDate,a=e.startTime,n=e.endDate,i=e.endTime,r=this.element.querySelector(".focus [name=allday]"),o=this.element.querySelector(".focus .hidden-input"),l=this.element.querySelector(".focus .select");this.element.querySelector(".focus .start-time-picker")?this.startTimeNode.value=u()(new Date(t+" "+a),"HH:mm"):this.element.querySelector(".focus .end-time-picker")&&(this.endTimeNode.value=u()(new Date(n+" "+i),"HH:mm")),r&&r.click(),o&&o.focus(),l&&l.focus()},o.findNext=function(e){var t=Array.from(this.element.querySelectorAll(this.FOCUS_SELECTOR));if(!t.length||this.isSelect())return null;var a=this.element.querySelector(".modify-event-focus.focus")||t[0],n=-1;return t.some(function(i,r){return i===a&&(n=(r+t.length+e)%t.length,!0)}),-1===n?null:t[n]},o.historyBack=function(e){this.element.querySelector(".focus").focus(),w.a.go(e)},o.getAddItem=function(){var e=this.state,t=e.title,a=e.location,n=e.description,i=e.startDate,r=e.endDate,o=e.startTime,l=e.endTime,d=e.repeat,s=e.eventsReminder,c=e.eventsAccount,u=this.allDayNode.checked,m=u?Object(k.o)(new Date(i+" 00:00")):o,f=u?Object(k.o)(new Date(r+" 23:59")):l;return{uuid:Object(k.X)(),title:t||"",location:a,allDayEvent:u,startDate:i,endDate:r,startTime:m,endTime:f,repeat:d,reminder:s,description:n,eventSDate:new Date(i+" "+m),eventEDate:new Date(r+" "+f),repeatSDate:new Date(i+" "+m),repeatEDate:null,account:c,serverId:null,authenticatorId:null}},o.getUpdateItem=function(){var e=this.state,t=e.title,a=e.location,n=e.description,i=e.startDate,r=e.endDate,o=e.startTime,l=e.endTime,d=e.repeat,s=e.eventsAccount,c=e.eventsReminder,u=this.allDayNode.checked,m=new Date(this.busytime.busytimeSDate.valueOf());m=new Date(m.setUTCHours(23,59,59,0));var f=u?Object(k.n)(new Date(i+" 00:00")):o,p=u?Object(k.n)(new Date(r+" 23:59")):l;return{uuid:this.busytime.eventId,title:t||"",location:a,allDayEvent:u,startDate:i,endDate:r,startTime:f,endTime:p,repeat:d,reminder:c,description:n,eventSDate:new Date(i+" "+f),eventEDate:new Date(r+" "+p),repeatSDate:new Date(i+" "+f),repeatEDate:this.busytime.repeatEDate,oldRepeatSDate:this.busytime.repeatSDate,account:s,selectedDate:m,uuidNew:Object(k.X)(),serverId:this.busytime.serverId,authenticatorId:this.busytime.authenticatorId,busytime:this.busytime}},o.changeDateString=function(e){var t=e.split("/"),a=u()(new Date,"YYYY-MM-DD");return 3===t.length&&(a=t[2]+"-"+t[0]+"-"+t[1]),a},o.addSingleItemToEventStore=function(){T.a.add(this.getAddItem())},o.updateSingleItemToEventStore=function(){var e=this.state,t=e.originRepeat,a=e.repeat,n=this.getUpdateItem();Object(k.g)(this.busytime,n)||("never"!==t&&"never"===a?T.a.updateAll(n):T.a.update(n))},o.save=function(){this.addOperate?(window.performance.mark("calendar-save-new-event-start"),this.addSingleItemToEventStore(),this.historyBack(-1)):(this.updateSingleItemToEventStore(),this.historyBack(-2))},o.handleChangeAllDayChecked=function(e){var t=this,a=this.state,n=a.startDate,i=a.startTime,o=a.endDate,l=a.endTime,d=i,s=l,c=o;if(!e){var m=new Date;m.setMinutes(0),d=Object(k.o)(m),s=Object(k.o)(r()(m,1))}var f=new Date(o+" "+s);e&&new Date(o).valueOf()===f.valueOf()&&(f=new Date(f.valueOf()-1),c=u()(f,"MM/DD/YYYY")),this.setState({endDate:c,startTime:d,endTime:s,allDayEvent:e,eventsReminder:e?this.alldayAlarm:this.standardAlarm},function(){e||(t.startTimeNode.value=Object(k.o)(new Date(n+" "+d)),t.endTimeNode.value=Object(k.o)(new Date(o+" "+s)))})},o.handleDescriptionClass=function(e){e.indexOf("\n")>=0?this.description.classList.add("mutil-line"):this.description.classList.remove("mutil-line")},o.handleChange=function(e,t){var a=this,n=e.target.value,i=null,o=null;switch(this.dataChanged=!0,t){case"startDate":i=n.split("-"),o=new Date(i[0],parseInt(i[1],10)-1,i[2]),this.setState({startDate:O(o)},function(){a.checkDateEndBeforeStartError(0)});break;case"startTime":var l=n;if(window.api.hour12){var d=this.state.startDate;l=Object(k.o)(new Date(d+" "+l))}this.setState({startTime:l},function(){a.modifyEndTimeAndEndDate()});break;case"endDate":i=n.split("-"),o=new Date(i[0],parseInt(i[1],10)-1,i[2]),this.setState({endDate:O(o)},function(){a.checkDateEndBeforeStartError(1)});break;case"endTime":var s=this.state,c=s.startTime,u=s.endDate,m=n;window.api.hour12&&(m=Object(k.o)(new Date(u+" "+m))),this.setState({endTime:m},function(){a.endTimeNode.value=m;var e=Object(k.o)(r()(new Date(u+" "+c),1));a.checkTimeEndBeforeStartError(1,e)});break;case"eventsReminder":this.setState({eventsReminder:n});break;case"eventsAccount":this.setState({eventsAccount:n});break;case"allDayEvent":this.handleChangeAllDayChecked(e.target.checked);break;case"allDayReminder":this.setState({eventsReminder:n});break;case"repeat":this.setState({repeat:n});break;case"title":this.setState({title:n});break;case"location":this.setState({location:n});break;case"description":this.setState({description:n}),this.handleDescriptionClass(n)}},o.checkDateEndBeforeStartError=function(e){var t,a,n=this,i=this.state,r=i.startDate,o=i.endDate,l=i.startTime,d=i.endTime,s=(t=new Date(r+" "+l),a=new Date(o+" "+d),N()(t,a)),c=new Date(r+" "+l),m=new Date(o+" "+d),f=o,p=r,h=new Date(window.selectedDate),v=y()(c,h);1===s&&1===e&&Toaster.showToast({messageL10nId:"end-date-before-start-date"});var b=y()(c.setUTCHours(0,0,0,0),h.setUTCHours(0,0,0,0));(1===s||v)&&(c>m?f=r:b&&(c.setDate(window.selectedDate.getDate()),c=new Date(c.valueOf()-60*c.getTimezoneOffset()*1e3),p=u()(c,"MM/DD/YYYY"),Toaster.showToast({messageL10nId:"error-start-date-before-seleced-day"})),this.setState({startDate:p,endDate:f},function(){n.startDateNode.value=n.changeDateString(p),n.endDateNode.value=n.changeDateString(f)}))},o.checkTimeEndBeforeStartError=function(e,t){var a=this,n=this.state,i=n.startDate,r=n.endDate,o=n.startTime,l=n.endTime;Date.parse(i+" "+o)>=Date.parse(r+" "+l)&&(Toaster.showToast({messageL10nId:"end-time-before-start-time"}),this.setState({endTime:t},function(){a.endTimeNode.value=t}))},o.modifyEndTimeAndEndDate=function(){var e=this,t=this.state,a=t.endDate,n=t.startTime,i=t.startDate,r=Date.parse(a+" "+n);i!==a&&(r=s()(new Date(r),1)),this.startTimeNode.value=n,r=new Date(r.valueOf()+36e5);var o=u()(r,"MM/DD/YYYY");this.setState({endDate:o,endTime:Object(k.o)(r)},function(){e.endTimeNode.value=Object(k.o)(r),e.endDateNode.value=e.changeDateString(o)})},o.handleOptionMenu=function(e){var t=this.state.startDate,a=this.getUpdateItem(),n=e;Object(k.g)(this.busytime,a)||("allEvent"===n||"futureEvent"===n&&("never"===this.busytime.repeat||t===u()(this.busytime.repeatSDate,"MM/DD/YYYY"))?T.a.updateAll(a):"futureEvent"===n&&T.a.updateFuture(a)),w.a.go(-2)},o.handleUpdateEventDialog=function(e){var t=e.target.dataset.id;"all-event"===t?(this.updateAllEventNode.checked=!0,this.updateAllFutureEventNode.checked=!1):"all-future-event"===t&&(this.updateAllEventNode.checked=!1,this.updateAllFutureEventNode.checked=!0),this.handleOptionMenu()},o.handleChangeRepeatInterval=function(){var e=this.getUpdateItem();"never"===e.repeat?(T.a.updateAll(e),w.a.go(-2)):this.showUpdateFutureOptions()},o.showNoInternetDialog=function(){Object(k.P)({header:"dialog-title-error",type:"alert",ok:"dialog-button-ok",content:this.addOperate?"dialog-add-event-message":"dialog-edit-event-message"})},o.saveEvent=function(){var e=this.state.repeat;this.addOperate||e===this.busytime.repeat?"never"===e||this.addOperate?this.save():this.showDelOptions():this.handleChangeRepeatInterval()},o.handleClickSaveButton=function(){"calendar-local"===this.calendarAccountNode.value||Object(k.H)()?this.saveEvent():this.showNoInternetDialog()},o.renderTitle=function(){var e=this;return n.default.createElement("li",{className:"title focusable modify-event-focus title",tabIndex:"-1",key:"0",role:"menuitem"},R,n.default.createElement("input",{className:"p-pri input-focusable",name:"title",maxlength:"100","x-inputmode":"latin-prose",dir:"auto",type:"text",ref:function(t){e.title=t},oninput:function(t){return e.handleChange(t,"title")}}))},o.renderLocation=function(){var e=this;return n.default.createElement("li",{className:"location focusable modify-event-focus",tabIndex:"-1",key:"1"},Y,n.default.createElement("input",{"aria-labelledby":"where-title",className:"p-pri input-focusable",name:"location",maxlength:"100","x-inputmode":"latin-prose",dir:"auto",type:"text",ref:function(t){e.location=t},oninput:function(t){return e.handleChange(t,"location")}}))},o.renderAllDaySelector=function(){var e=this;return n.default.createElement("li",{className:"allday focusable modify-event-focus",tabIndex:"-1",key:"2"},n.default.createElement("label",{className:"pack-checkbox-large"},n.default.createElement("input",{name:"allday",type:"checkbox",onClick:function(t){return e.handleChange(t,"allDayEvent")},ref:function(t){e.allDayNode=t}}),L))},o.renderStartDate=function(){var e=this,t=this.state,a=t.startDate,i=t.startTime,r=new Date(a+" "+i),o=u()(r,"YYYY-MM-DD");return n.default.createElement("li",{role:"menuitem",className:"start-date focusable modify-event-focus",tabIndex:"-1",key:"3","aria-labelledby":"startdate-title","aria-describedby":"start-date-locale"},M,n.default.createElement("span",{role:"combobox","aria-autocomplete":"none","data-l10n-id":"start-date"},n.default.createElement("input",{"aria-hidden":"true",className:"hidden-input start-date-picker select",min:"1970-1-1",max:"2035-12-31",type:"date","data-track-class":"start-date-track",value:o,oninput:function(t){return e.handleChange(t,"startDate")},ref:function(t){e.startDateNode=t}}),n.default.createElement("span",{className:"p-pri",id:"start-date-locale","data-type":"date"},a)))},o.renderStartTime=function(){var e=this,t=this.state,a=t.startTime,i=t.startDate,r=new Date(i+" "+a);return n.default.createElement("li",{role:"menuitem",className:"start-time focusable modify-event-focus",tabIndex:"-1",key:"4",id:"startTime-Li","aria-labelledby":"starttime-title","aria-describedby":"start-time-locale"},q,n.default.createElement("span",{role:"combobox","aria-autocomplete":"none","data-l10n-id":"start-time"},n.default.createElement("input",{className:"hidden-input start-time-picker select","aria-hidden":"true",type:"time","data-track-class":"start-time-track",value:Object(k.o)(r),oninput:function(t){return e.handleChange(t,"startTime")},ref:function(t){e.startTimeNode=t}}),n.default.createElement("span",{className:"p-pri",id:"start-time-locale","data-type":"time"},Object(k.n)(r))))},o.renderEndDate=function(){var e=this,t=this.state,a=t.endDate,i=t.endTime,r=new Date(a+" "+i),o=u()(r,"YYYY-MM-DD");return n.default.createElement("li",{role:"menuitem",className:"end-date focusable modify-event-focus",tabIndex:"-1",key:"5","aria-labelledby":"enddate-title","aria-describedby":"end-date-locale"},B,n.default.createElement("span",{role:"combobox","aria-autocomplete":"none","data-l10n-id":"end-date"},n.default.createElement("input",{className:"hidden-input end-date-picker select","aria-hidden":"true",min:"1970-1-1",max:"2035-12-31",type:"date","data-track-class":"end-date-track",value:o,oninput:function(t){return e.handleChange(t,"endDate")},ref:function(t){e.endDateNode=t}}),n.default.createElement("span",{className:"p-pri",id:"end-date-locale","data-type":"date"},a)))},o.renderEndTime=function(){var e=this,t=this.state,a=t.endDate,i=t.endTime,r=new Date(a+" "+i);return n.default.createElement("li",{role:"menuitem",className:"end-time focusable modify-event-focus",tabIndex:"-1",key:"6",id:"endTime-Li","aria-labelledby":"endtime-title","aria-describedby":"end-time-locale"},U,n.default.createElement("span",{role:"combobox","aria-autocomplete":"none","data-l10n-id":"end-time"},n.default.createElement("input",{className:"hidden-input end-time-picker select","aria-hidden":"true",type:"time","data-track-class":"end-time-track",value:Object(k.o)(r),oninput:function(t){return e.handleChange(t,"endTime")},ref:function(t){e.endTimeNode=t}}),n.default.createElement("span",{className:"p-pri",id:"end-time-locale","data-type":"time"},Object(k.n)(r))))},o.renderRepeat=function(){var e=this;return n.default.createElement("li",{role:"menuitem",className:"repeat-event pack-select sk-modify-event-repeat repeat-style focusable modify-event-focus",tabIndex:"-1",key:"7"},F,n.default.createElement("span",{className:"button"},n.default.createElement("select",{id:"repeat-select",className:"p-pri select",name:"repeat",onChange:function(t){return e.handleChange(t,"repeat")},"nav-scope":!0,"nav-ignore":!0},z,J,H,P,K)))},o.renderCalendar=function(){var e=this.addOperate?"event-calendar pack-select sk-modify-event-repeat repeat-style focusable modify-event-focus":"event-calendar pack-select sk-modify-event-repeat repeat-style hidden";return n.default.createElement("li",{role:"menuitem",className:e,tabIndex:"-1",key:"8"},_,n.default.createElement("span",{className:"button"},this.renderCalendarInput()))},o.renderEventReminder=function(){var e=this.state.allDayEvent;return n.default.createElement("li",{role:"menuitem",className:"focusable event-reminder modify-event-focus",tabIndex:"-1",key:"9"},V,n.default.createElement("span",{className:"button"},e?this.renderAllDayReminderInput():this.renderReminderInput()))},o.renderEventDescription=function(){var e=this;return n.default.createElement("li",{className:"notes focusable modify-event-focus",tabIndex:"-1",key:"10"},X,n.default.createElement("textarea",{role:"textbox",maxlength:"500",tabindex:"0","aria-labelledby":"notes-title",id:"note-pad",className:"p-pri input-focusable",name:"description","x-inputmode":"latin-prose",dir:"auto",oninput:function(t){return e.handleChange(t,"description")},ref:function(t){e.description=t}}))},o.renderStartDateInput=function(){var e=this;return n.default.createElement("input",{"aria-hidden":"true",className:"hidden-input","data-track-class":"start-date-track",type:"date",onChange:function(t){return e.handleChange(t,"startDate")},ref:function(t){e.startDateNode=t}})},o.renderEndDateInput=function(){var e=this;return n.default.createElement("input",{"aria-hidden":"true",className:"hidden-input","data-track-class":"end-date-track",type:"date",onChange:function(t){return e.handleChange(t,"endDate")},ref:function(t){e.endDateNode=t}})},o.renderStartTimeInput=function(){var e=this;return n.default.createElement("input",{"aria-hidden":"true",className:"hidden-input","data-track-class":"start-time-track",type:"time",onChange:function(t){return e.handleChange(t,"startTime")},ref:function(t){e.startTimeNode=t}})},o.renderEndTimeInput=function(){var e=this;return n.default.createElement("input",{"aria-hidden":"true",className:"hidden-input","data-track-class":"end-time-track",type:"time",onChange:function(t){return e.handleChange(t,"endTime")},ref:function(t){e.endTimeNode=t}})},o.renderCalendarInput=function(){var e=this,t=this.state.eventsAccount;return n.default.createElement("select",{id:"event-calendar",className:"select p-pri",name:Object(k.a)("select-calendar"),"data-track-class":"title-calendar",onChange:function(t){return e.handleChange(t,"eventsAccount")},ref:function(t){e.calendarAccountNode=t}},window.displayAccount.map(function(e){return"calendar-local"===e.value||"caldav"===e.authenticatorId||window.calendarSync[e.authenticatorId+":"+e.value]?n.default.createElement("option",{selected:e.value===t,value:e.value},"calendar-local"===e.value?Object(k.a)("calendar-local"):e.value):null}))},o.renderRepeatInput=function(){var e=this;return n.default.createElement("select",{id:"event-calendar",name:Object(k.a)("event-repeat"),"data-track-class":"title-calendar",className:"hidden-input",onChange:function(t){return e.handleChange(t,"repeat")},ref:function(t){e.calendarRepeatNode=t}},W,G,Q,Z,$)},o.renderAllDayReminderInput=function(){var e=this,t=this.state.eventsReminder;return n.default.createElement("select",{id:"setting-allday-events-reminder",className:"select p-pri","data-track-class":"allday-reminder",name:Object(k.a)("event-reminder"),onChange:function(t){return e.handleChange(t,"allDayReminder")},ref:function(t){e.allDayEventsReminderNode=t}},n.default.createElement("option",{value:"none",selected:"none"===t,"data-l10n-id":"none","data-l10n-args":"{}"}),n.default.createElement("option",{value:"32400",selected:"32400"===t,"data-l10n-id":"alarm-at-event-allday","data-l10n-args":"{}"}),n.default.createElement("option",{value:"-54000",selected:"-54000"===t,"data-l10n-id":"days-before","data-l10n-args":JSON.stringify({value:1})}),n.default.createElement("option",{value:"-140400",selected:"-140400"===t,"data-l10n-id":"days-before","data-l10n-args":JSON.stringify({value:2})}),n.default.createElement("option",{value:"-572400",selected:"-572400"===t,"data-l10n-id":"weeks-before","data-l10n-args":JSON.stringify({value:1})}),n.default.createElement("option",{value:"-1177200",selected:"-1177200"===t,"data-l10n-id":"weeks-before","data-l10n-args":JSON.stringify({value:2})}))},o.renderReminderInput=function(){var e=this,t=this.state.eventsReminder;return n.default.createElement("select",{id:"event-reminder",className:"select p-pri",name:Object(k.a)("event-reminder"),"data-track-class":"modify-event-reminder",onChange:function(t){return e.handleChange(t,"eventsReminder")},ref:function(t){e.reminderNode=t}},n.default.createElement("option",{value:"none",selected:"none"===t,"data-l10n-id":"none","data-l10n-args":"{}"}),n.default.createElement("option",{value:"0",selected:"0"===t,"data-l10n-id":"alarm-at-event-standard","data-l10n-args":"{}"}),n.default.createElement("option",{value:"-300",selected:"-300"===t,"data-l10n-id":"minutes-before","data-l10n-args":JSON.stringify({value:5})}),n.default.createElement("option",{value:"-900",selected:"-900"===t,"data-l10n-id":"minutes-before","data-l10n-args":JSON.stringify({value:15})}),n.default.createElement("option",{value:"-1800",selected:"-1800"===t,"data-l10n-id":"minutes-before","data-l10n-args":JSON.stringify({value:30})}),n.default.createElement("option",{value:"-3600",selected:"-3600"===t,"data-l10n-id":"hours-before","data-l10n-args":JSON.stringify({value:1})}),n.default.createElement("option",{value:"-7200",selected:"-7200"===t,"data-l10n-id":"hours-before","data-l10n-args":JSON.stringify({value:2})}),n.default.createElement("option",{value:"-86400",selected:"-86400"===t,"data-l10n-id":"days-before","data-l10n-args":JSON.stringify({value:1})}))},o.render=function(){var e=this,t=this.state.allDayEvent,a=this.addOperate?Object(k.a)("new-event-header"):Object(k.a)("edit-event-header");return n.default.createElement("div",{id:"modifyEvent",className:"modifyEvent",tabIndex:"-1",ref:function(t){e.element=t},role:"heading","aria-labelledby":"modify-event-header"},n.default.createElement(C.a,{view:"modify-event-header",headerStr:a}),n.default.createElement("div",{className:"modify-event-content-wrapper"},this.renderTitle(),this.renderLocation(),this.renderAllDaySelector(),this.renderStartDate(),this.renderEndDate(),t?null:this.renderStartTime(),t?null:this.renderEndTime(),this.renderRepeat(),Object(k.z)()?ee:this.renderCalendar(),this.renderEventReminder(),this.renderEventDescription()))},i}(n.default.Component)}}]);