(window.webpackJsonp=window.webpackJsonp||[]).push([[4],{34:function(e,t,n){"use strict";n.d(t,"b",(function(){return i})),n.d(t,"c",(function(){return a})),n.d(t,"d",(function(){return l})),n.d(t,"e",(function(){return r})),n.d(t,"f",(function(){return c})),n.d(t,"a",(function(){return s})),n(3);const i=(e,t)=>{let n;return(...i)=>{const a=!n;return window.clearTimeout(n),n=window.setTimeout(()=>{n=null},e),a&&t(...i),n}},a=({callType:e,simNum:t})=>{let n="call";-1!==e.indexOf("rttCall")?n="call-rtt":-1!==e.indexOf("videoCall")&&(n="video-call");const i=(()=>{const{iccManager:e}=window.navigator.b2g;return e&&e.iccIds.length>1})()?t:"";return`${n}-${e.split("_")[0]}${i}`},o=e=>{const t=new Date(e);return new Date(t.getFullYear(),t.getMonth(),t.getDate()).getTime()},l=e=>{const{get:t}=window.api.l10n,n=(o(Date.now())-o(e))/1e3,i=Math.floor(n/86400),a=new Date(e),l=(new Date).getFullYear()===a.getFullYear(),r=navigator.language;return 0===i?t("today"):1===i?t("yesterday"):i<7&&i>1?a.toLocaleString(r,{weekday:"long"}):l?a.toLocaleString(r,{weekday:"short",month:"long",day:"numeric"}):a.toLocaleString(r,{weekday:"short",year:"numeric",month:"short",day:"numeric"})},r=()=>document.body.classList.contains("low-memory-device"),c=()=>DeviceCapabilityManager.get("device.parental-control").then(e=>!!e),s=()=>{document.hidden||navigator.serviceWorker.controller&&navigator.serviceWorker.controller.postMessage({name:"clearNotices"})}},35:function(e,t,n){"use strict";n.d(t,"b",(function(){return i})),n.d(t,"a",(function(){return a})),n.d(t,"d",(function(){return o})),n.d(t,"c",(function(){return l}));const i=()=>!(!ContactsManager||!ContactsManager.findBlockedNumbers),a=e=>e?ContactsManager.addBlockedNumber(e):Promise.reject(new TypeError("Invalid number")),o=e=>e?ContactsManager.removeBlockedNumber(e):Promise.reject(new TypeError("Invalid number")),l=e=>{const t={filterValue:e,filterOption:ContactsManager.FilterOption.MATCH};return ContactsManager.findBlockedNumbers(t).then(e=>!(!e||!e.length))}},37:function(e,t,n){"use strict";const i={voicemailNumbers:"",init:function(){SettingsObserver.observe("ril.iccInfo.mbdn","",e=>{this.voicemailNumbers=e,window.calllogStore&&window.calllogStore.emit("update")})},check:function(e,t){if(!e)return!1;let{voicemail:n}=window.navigator.b2g;return!(!n||n.getNumber(t)!==e)||("string"==typeof this.voicemailNumbers?this.voicemailNumbers===e:!!this.voicemailNumbers&&this.voicemailNumbers[t]===e)}};i.init(),t.a=i},38:function(e,t,n){"use strict";var i=n(0),a=n.n(i),o=({isWifiLogo:e,radioTech:t})=>{let n=null;return"ps"===t&&(n=a.a.createElement("svg",{xmlns:"http://www.w3.org/2000/svg",xmlnsXlink:"http://www.w3.org/1999/xlink",width:"32px",height:"10px",viewBox:"0 0 32 10",version:"1.1"},a.a.createElement("title",null,"ic_lte_badge"),a.a.createElement("g",{id:"ic_lte_badge",stroke:"none",strokeWidth:"1",fill:"none",fillRule:"evenodd"},a.a.createElement("rect",{id:"Rectangle",fill:"#000000",x:"3",y:"0",width:"26",height:"10",rx:"5"}),a.a.createElement("path",{d:"M10.6506,2.0002 C11.0086,2.0002 11.2996,2.2912 11.2996, 2.6502 L11.2996,2.6502 L11.2996,6.7002 L13.3496,6.7002 C13.7086, 6.7002 13.9996,6.9912 13.9996,7.3502 C13.9996,7.7092 13.7086, 8.0002 13.3496,8.0002 L13.3496,8.0002 L10.6506, 8.0002 C10.2906,8.0002 9.9996,7.7092 9.9996,7.3502 L9.9996, 7.3502 L9.9996,2.6502 C9.9996,2.2912 10.2906,2.0002 10.6506, 2.0002 Z M17.3496,2 C17.7086,2 17.9996,2.291 17.9996, 2.65 C17.9996,3.009 17.7086,3.3 17.3496,3.3 L17.3496,3.3 L16.4006, 3.3 L16.4006,7.35 C16.4006,7.709 16.1096,8 15.7496,8 C15.3906, 8 15.0996,7.709 15.0996,7.35 L15.0996,7.35 L15.0996,3.3 L14.1506, 3.3 C13.7906,3.3 13.4996,3.009 13.4996,2.65 C13.4996,2.291 13.7906, 2 14.1506,2 L14.1506,2 Z M21.8496,1.9998 C22.2086,1.9998 22.4996, 2.2908 22.4996,2.6498 C22.4996,3.0088 22.2086,3.2998 21.8496, 3.2998 L21.8496,3.2998 L19.7996,3.2998 L19.7996,4.3498 L21.5496, 4.3498 C21.9096,4.3498 22.2006,4.6408 22.2006,4.9998 C22.2006, 5.3588 21.9096,5.6498 21.5496,5.6498 L21.5496,5.6498 L19.7996, 5.6498 L19.7996,6.6998 L21.8496,6.6998 C22.2086,6.6998 22.4996, 6.9908 22.4996,7.3498 C22.4996,7.7088 22.2086,7.9998 21.8496, 7.9998 L21.8496,7.9998 L19.1506,7.9998 C18.7906,7.9998 18.4996, 7.7088 18.4996,7.3498 L18.4996,7.3498 L18.4996,2.6498 C18.4996, 2.2908 18.7906,1.9998 19.1506,1.9998 L19.1506,1.9998 Z",id:"Combined-Shape",fill:"#FFFFFF"})))),"wifi"===t&&(n=e?a.a.createElement("svg",{xmlns:"http://www.w3.org/2000/svg",xmlnsXlink:"http://www.w3.org/1999/xlink",width:"32px",height:"10px",viewBox:"0 0 32 10",version:"1.1"},a.a.createElement("title",null,"ic_wifi_badge"),a.a.createElement("g",{id:"ic_wifi_badge",stroke:"none",strokeWidth:"1",fill:"none",fillRule:"evenodd"},a.a.createElement("rect",{id:"Rectangle",fill:"#000000",x:"3",y:"0",width:"26",height:"10",rx:"5"}),a.a.createElement("path",{d:"M13.8266,2.43337 C13.9226,2.11537 14.2556,1.93637 14.5746, 2.03237 C14.8916,2.12837 15.0706,2.46337 14.9746,2.78037 L14.9746, 2.78037 L13.5246,7.57937 C13.4486,7.83337 13.2156,8.00637 12.9506, 8.00637 C12.6856,8.00637 12.4526,7.83337 12.3766,7.57937 L12.3766, 7.57937 L11.5006,4.68137 L10.6246,7.57937 C10.4716,8.08637 9.6286, 8.08637 9.4756,7.57937 L9.4756,7.57937 L8.0256,2.78037 C7.9296, 2.46337 8.1086,2.12837 8.4266,2.03237 C8.7456,1.93637 9.0786, 2.11537 9.1746,2.43337 L9.1746,2.43337 L10.0506,5.33137 L10.9266, 2.43337 C11.0786,1.92637 11.9226,1.92637 12.0746,2.43337 L12.0746, 2.43337 L12.9506,5.33137 Z M21.349,2.00407 C21.708,2.00407 21.999, 2.29507 21.999,2.65407 C21.999,3.01307 21.708,3.30407 21.349, 3.30407 L21.349,3.30407 L19.296,3.30407 L19.296,4.35407 L21.049, 4.35407 C21.408,4.35407 21.699,4.64507 21.699,5.00407 C21.699, 5.36307 21.408,5.65407 21.049,5.65407 L21.049,5.65407 L19.296, 5.65407 L19.296,7.35407 C19.296,7.71307 19.005,8.00407 18.647, 8.00407 C18.287,8.00407 17.996,7.71307 17.996,7.35407 L17.996, 7.35407 L17.996,2.65407 C17.996,2.29507 18.287,2.00407 18.647, 2.00407 L18.647,2.00407 Z M23.35,4.00107 C23.709,4.00107 24, 4.29207 24,4.65107 L24,4.65107 L24,7.35407 C24,7.71307 23.709, 8.00407 23.35,8.00407 C22.992,8.00407 22.701,7.71307 22.701, 7.35407 L22.701,7.35407 L22.701,4.65107 C22.701,4.29207 22.992, 4.00107 23.35,4.00107 Z M16.35,4.00107 C16.709,4.00107 17,4.29207 17, 4.65107 L17,4.65107 L17,7.35407 C17,7.71307 16.709,8.00407 16.35, 8.00407 C15.992,8.00407 15.701,7.71307 15.701,7.35407 L15.701, 7.35407 L15.701,4.65107 C15.701,4.29207 15.992,4.00107 16.35, 4.00107 Z M23.3496,2.00007 C23.7096,2.00007 24.0006,2.29107 24.0006, 2.65007 C24.0006,3.00907 23.7096,3.30007 23.3496,3.30007 C22.9916, 3.30007 22.7006,3.00907 22.7006,2.65007 C22.7006,2.29107 22.9916, 2.00007 23.3496,2.00007 Z M16.35,2.00017 C16.709,2.00017 17, 2.29117 17,2.65017 C17,3.00917 16.709,3.30017 16.35,3.30017 C15.992, 3.30017 15.701,3.00917 15.701,2.65017 C15.701,2.29117 15.992, 2.00017 16.35,2.00017 Z",id:"Combined-Shape",fill:"#FFFFFF"}))):a.a.createElement("svg",{xmlns:"http://www.w3.org/2000/svg",xmlnsXlink:"http://www.w3.org/1999/xlink",width:"32px",height:"10px",viewBox:"0 0 32 10",version:"1.1"},a.a.createElement("title",null,"ic_wlan_badge"),a.a.createElement("g",{id:"ic_wlan_badge",stroke:"none",strokeWidth:"1",fill:"none",fillRule:"evenodd"},a.a.createElement("rect",{id:"Rectangle",fill:"#000000",x:"3",y:"0",width:"26",height:"10",rx:"5"}),a.a.createElement("g",{id:"Group-9",transform:"translate(8.000000, 2.000000)",fill:"#FFFFFF"},a.a.createElement("path",{d:"M2.5502,0.00014 C2.8612,0.00014 3.1282,0.22114 3.1872, 0.52614 L3.1872,0.52614 L3.49287578,2.08611372 L3.8132, 0.52114 C3.87865455,0.20114 4.16642314,-0.0122484298 4.4841692, 0.00268770849 L4.5802,0.01414 C4.9322,0.08514 5.1592, 0.42914 5.0872,0.78114 L5.0872,0.78114 L4.1172,5.53114 C4.0552, 5.83314 3.7882,6.05114 3.4802,6.05114 L3.4802,6.05114 C3.1672, 6.04914 2.9022,5.82914 2.8422,5.52614 L2.8422,5.52614 L2.5502, 4.03414 L2.2582,5.52614 C2.1992,5.82914 1.9332,6.04914 1.6222, 6.05114 L1.6222,6.05114 C1.3112,6.05114 1.0452,5.83314 0.9832, 5.53114 L0.9832,5.53114 L0.0132,0.78114 C-0.0588,0.42914 0.1682, 0.08514 0.5202,0.01414 C0.8712,-0.05386 1.2152,0.16914 1.2872, 0.52114 L1.2872,0.52114 L1.6062,2.08614 L1.9122,0.52614 C1.9722, 0.22114 2.2392,0.00014 2.5502,0.00014 Z M15.3502,0.00044 C15.7092, 0.00044 16.0002,0.29144 16.0002,0.65044 L16.0002,0.65044 L16.0002, 5.40044 C16.0002,5.70144 15.7932,5.96344 15.5012,6.03244 C15.4512, 6.04544 15.4002,6.05144 15.3502,6.05144 C15.1092,6.05144 14.8822, 5.91644 14.7702,5.69344 L14.7702,5.69344 L13.6002,3.37844 L13.6002, 5.40044 C13.6002,5.76044 13.3092,6.05144 12.9502,6.05144 C12.5912, 6.05144 12.3002,5.76044 12.3002,5.40044 L12.3002,5.40044 L12.3002, 0.65044 C12.3002,0.35044 12.5072,0.08844 12.7992,0.01944 C13.0932, -0.05456 13.3952,0.08944 13.5302,0.35744 L13.5302,0.35744 L14.7002, 2.67344 L14.7002,0.65044 C14.7002,0.29144 14.9912,0.00044 15.3502, 0.00044 Z M6.0184,0.00084 C6.3774,0.00084 6.6684,0.29184 6.6684, 0.64984 L6.6684,0.64984 L6.6754,4.75084 L7.9244,4.75084 L9.0654, 0.48284 C9.1414,0.19884 9.3994,0.00084 9.6934,0.00084 L9.6934, 0.00084 L10.3064,0.00084 C10.6014,0.00084 10.8584,0.19884 10.9344, 0.48284 L10.9344,0.48284 L12.2044,5.23284 C12.2974,5.57984 12.0904, 5.93584 11.7444,6.02884 C11.6884,6.04384 11.6314,6.05084 11.5754, 6.05084 C11.2884,6.05084 11.0264,5.85884 10.9484,5.56884 L10.9484, 5.56884 L10.8034,5.02584 L9.1964,5.02584 L9.0514,5.56884 L9.0514, 5.56884 L9.0314,5.60884 C9.0164,5.65284 8.9954,5.69084 8.9714, 5.73084 C8.9514,5.76284 8.9334,5.79684 8.9074,5.82484 C8.8774, 5.85984 8.8414,5.88584 8.8044,5.91384 C8.7754,5.93484 8.7484, 5.95784 8.7154,5.97384 C8.6754,5.99484 8.6314,6.00584 8.5874, 6.01784 C8.5484,6.02884 8.5124,6.03884 8.4724,6.04184 C8.4554, 6.04284 8.4414,6.05084 8.4234,6.05084 L8.4234,6.05084 L6.0264, 6.05084 C5.6684,6.05084 5.3774,5.75984 5.3764,5.40184 L5.3764, 5.40184 L5.3684,0.65184 C5.3684,0.29284 5.6584,0.00184 6.0174, 0.00084 L6.0174,0.00084 Z M10.0004,2.02084 L9.4644,4.02584 L10.5354, 4.02584 L10.0004,2.02084 Z",id:"Combined-Shape"}))))),n};t.a=({isWifiLogo:e,iconData:t,radioTech:n})=>a.a.createElement("div",{style:{display:"flex",flexDirection:"column",flexShrink:"0",alignItems:"center"}},a.a.createElement("i",{className:"icon","data-icon":t,role:"presentation"}),a.a.createElement(o,{isWifiLogo:e,radioTech:n}))},40:function(e,t){e.exports="data:image/png;base64,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UmVhZHlxyWU8AAADhmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDAgNzkuMTYwNDUxLCAyMDE3LzA1LzA2LTAxOjA4OjIxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjRhODA2YmI0LWI0OTktNDAwNC1iY2I4LTAwYTZjMDhjM2YzYSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo3MDU5RUI4REE5Q0YxMUU4QTJENkU2MTEyMkY5N0E4MSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo3MDU5RUI4Q0E5Q0YxMUU4QTJENkU2MTEyMkY5N0E4MSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOCAoTWFjaW50b3NoKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjFkNjk0YTBjLTdlMGEtNGVjZS04ZDY2LWQ5ZWFkMzdkOWQ3YiIgc3RSZWY6ZG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOmY4ZjY0Yjc2LWFiNDgtMTE3YS05NzliLTgzMTJhMWQ0MDIyZCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pn8mbF0AAAHzSURBVHja7Jc7SwNBFIV3VSJWdiERDKKmsfQRhBT+At8ipLCwjw+iEMFW0EbFkB8gNj4w4KOwF4yFpAhiZbSwMGplI2IE4xk4C+OyiZlJQppc+JjL7Mzcs5O7MzdmPp83amkNRo2tLqDmApqcOt3B5qoEe7v6KnsHhOBxsAcy4AO8gzv2TRR6KaUdKGDDYBP4HZ61gh4wA+7BEjivVA6IMevg1Bb8BVyCJH3L/Bwr5piVELADVriYOLUSIADawBAIAi/oB/scY3JOrFwBkyBM/xOEwBS4YSDZUuDa1hdmXmgJcIEt+iLYLDgsMn6Ou2XtlCVwm2spCxDKffQTisEXwQGf+YrtQjEBY5K/phg8xi/Gaa2SBQTYZkFaMbiVE6/0B3QEeNg+agQ3bHO9OgJybE3N4MIabWspCciy7dQMLp530H/WEZCWfopexeAG57jp3+oIOJH8ZTCvEFxYtMBaf7fJqSbkdezijdcuHSqlBp/mOSDGP/F+yKlexyJxIlJgleC7UvJGdJNQ2DGI2/oGQZ9DwonL6Ihv3sL+OE/RsuqBBRYeUQYKEXEFP/AluqSEs2wDrFaiIPnh1Zrk8dotfR0eh/EZFiRnla6IxIIXYASMSnVAjt95itkuxn1XoyQzuHDiv99Vxcz6X7O6gFoL+BVgALRhgaCyL7FOAAAAAElFTkSuQmCC"},43:function(e,t,n){"use strict";n.r(t);var i=n(0),a=n.n(i),o=n(3),l=n(2),r=n(37),c=n(40),s=n.n(c);n(33);var m=()=>a.a.createElement("div",{className:"blockImg"},a.a.createElement("img",{src:s.a,width:32,height:32,className:"img",alt:"block"})),d=n(38),u=n(34),h=n(35);n(32);const{get:L}=window.api.l10n;class g extends a.a.PureComponent{constructor(e){var t,n;super(e),n=()=>{const{openDialog:e}=this.props;!e&&this.element&&document.activeElement!==this.element&&this.element.focus()},(t="focus")in this?Object.defineProperty(this,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):this[t]=n,this.name="CalllogInfoView",this.SCROLL_STEP=40,this.currentScrollPosition=0,this.state={isBlocked:void 0},this.showContactIcon=!Object(u.e)(),o.a.register("focus",this)}componentDidMount(){const{number:e}=this.props;this.updateSoftKeys(),this.element.focus(),Object(h.b)()&&Object(h.c)(e).then(e=>{this.setState({isBlocked:e}),this.updateSoftKeys()})}componentDidUpdate(){this.focus()}componentWillUnmount(){o.a.unregister("focus",this)}onKeyDown(e){const{changeView:t}=this.props,{isBlocked:n}=this.state;switch(e.key){case"MicrophoneToggle":e.preventDefault(),e.stopPropagation();break;case"Backspace":case"SoftLeft":e.preventDefault(),e.stopPropagation(),t({currentView:"listView"});break;case"SoftRight":const{number:i}=this.props;if(!i)break;n?this.unblock(i):this.block(i);break;case"ArrowUp":e.preventDefault(),e.stopPropagation(),this._scrollUp();break;case"ArrowDown":e.preventDefault(),e.stopPropagation(),this._scrollDown()}}_scrollUp(){const e=this.element.querySelector(".call-duration-list");this.currentScrollPosition>0&&(this.currentScrollPosition-=this.SCROLL_STEP,e.scrollTop=this.currentScrollPosition)}_scrollDown(){const e=this.element.querySelector(".call-duration-list"),t=window.getComputedStyle(e,null),n=parseInt(t.getPropertyValue("height").replace(/[^0-9.]+/g,""));e.scrollHeight>0&&this.currentScrollPosition+n<=e.scrollHeight&&(this.currentScrollPosition+=this.SCROLL_STEP,e.scrollTop=this.currentScrollPosition)}unblock(e){Object(h.b)()&&Object(h.d)(e).then(e=>{this.setState({isBlocked:!1}),this.updateSoftKeys()}).catch(e=>{})}block(e){const{showDialog:t}=this.props;Object(h.b)()&&t({openDialog:!0,options:{header:"confirmation",type:"confirm",ok:"block",content:"blockContact",onOk:()=>{t({openDialog:!1}),Object(h.a)(e).then(e=>{this.setState({isBlocked:!0}),this.updateSoftKeys()}).catch(e=>{})},onCancel:()=>{t({openDialog:!1})}}})}updateSoftKeys(){const{number:e}=this.props,{isBlocked:t}=this.state;e&&Object(h.b)()?l.a.register({left:"cancel",right:void 0===t?"":t?"unblock":"block"},this.element):l.a.register({left:"cancel"},this.element)}render(){const{calls:e,callType:t,emergency:n,groupKey:i,itemContact:o={},number:l,radioTech:c,simNum:s,serviceId:L,isWifiLogo:p}=this.props,{isBlocked:A}=this.state;let C=l,w=!1;const b=window.sdnContacts.get()[L];b&&b.get(l)?(C=b.get(l),w=!0):o.name&&(C=o.name);let v=C?"":"withheld-number",f="";this.showContactIcon&&(f=a.a.createElement("i",{className:"icon","data-icon":"contacts",role:"presentation"}));let E=o.type||"unknown";const y=r.a.check(l,L);if(y||n||w)v=n?"emergencyNumber":y?"voicemail":"",E="";else if(this.showContactIcon&&!w&&o.photoBlob){const e={backgroundImage:`url(\n          data:${o.photoType};base64,${o.photoBlob}\n        )`};f=a.a.createElement("i",{className:"icon",style:e,role:"presentation"})}let I="";I=E?o.type?", "+l:"":l;const S=Object(h.b)()&&A?a.a.createElement(m,null):null,k=Object(u.c)({callType:t,simNum:s}),D=(e||[this.props]).map(e=>{const n=new Date(e.date).toLocaleString(navigator.language,{hour:"numeric",minute:"numeric",hour12:window.api.hour12}),i="missed"===t.split("_")[0]?null:a.a.createElement("div",{className:"additional-info"},a.a.createElement("span",null,g._prettyDuration(e.duration)));return a.a.createElement("div",{className:"list-item",key:e.date},a.a.createElement("div",{className:"content"},a.a.createElement("div",{className:"primary-info"},a.a.createElement("span",null,n)),a.a.createElement("div",{className:"secondary-info"},a.a.createElement("span",{"data-l10n-id":t.split("_")[0]+"Call"})),i),a.a.createElement(d.a,{isWifiLogo:p,iconData:k,radioTech:c}))});return a.a.createElement("div",{id:"info-view",tabIndex:-1,ref:e=>this.element=e,onKeyDown:e=>this.onKeyDown(e)},a.a.createElement("div",{className:"header h1",id:"calllog-info","data-l10n-id":"callInformation"}),a.a.createElement("div",{className:"list"},a.a.createElement("div",{className:"list-item"},f,a.a.createElement("div",{className:"content"},a.a.createElement("div",{className:"primary-info"},a.a.createElement("span",{"data-l10n-id":v},C)),a.a.createElement("div",{className:"additional-info"},a.a.createElement("span",{"data-l10n-id":E}),a.a.createElement("span",null,I))),S),a.a.createElement("p",{className:"group-header"},Object(u.d)(i)),a.a.createElement("div",{className:"call-duration-list"},D)))}}g._prettyDuration=function(e){const t=parseInt(e/36e5),n=parseInt(e%36e5/6e4),i=parseInt(e%6e4/1e3);let a=[];return 0!==t&&a.push(L("durationHours",{value:t})),0!==n&&a.push(L("durationMinutes",{value:n})),0!==i&&a.push(L("durationSeconds",{value:i})),a.join(" ")},t.default=g}}]);