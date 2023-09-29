(window.webpackJsonp=window.webpackJsonp||[]).push([[18],{637:function(e,a,t){"use strict";t.r(a),t.d(a,"default",function(){return m});var n=t(0),s=t(21),o=t(163),c=t(26),r=t(51),i=t(599),l=t(2);t(601);function d(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function u(e,a,t){return a in e?Object.defineProperty(e,a,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[a]=t,e}var p=n.default.createElement("span",{className:"password-failed-text p-pri","data-l10n-id":"change-password-failed"}),h=n.default.createElement("span",{className:"p-pri","data-l10n-id":"field-user"}),f=n.default.createElement("p",{className:"p-sec password-text","data-l10n-id":"field-password"}),w=n.default.createElement("span",{className:"p-pri","data-l10n-id":"show-password"}),m=function(e){var a,t;function m(a){var t;return u(d(t=e.call(this,a)||this),"passwordItem",void 0),u(d(t),"changeFailedText",void 0),u(d(t),"FOCUS_SELECTOR",".change-password-focus"),u(d(t),"handleLocalize",function(){t.forceUpdate()}),u(d(t),"changePasswordSucc",function(){c.a.showToaster("change-password-succ"),r.a.go(-2)}),u(d(t),"changePasswordFailed",function(){t.setState({changePwdFailed:!0})}),u(d(t),"handleKeydown",function(e){var a=null;switch(e.key){case"Enter":case"Accept":e.stopPropagation(),e.preventDefault(),t.handlKeydownClick();break;case"Backspace":e.stopPropagation(),e.preventDefault(),r.a.go(-1);break;case"SoftRight":e.stopPropagation(),e.preventDefault(),t.changePassword();break;case"SoftLeft":e.stopPropagation(),e.preventDefault(),r.a.go(-1);break;case"ArrowDown":e.stopPropagation(),e.preventDefault(),a=t.findNext(1);break;case"ArrowUp":e.stopPropagation(),e.preventDefault(),a=t.findNext(-1)}t.changeFocusItem(a)}),u(d(t),"changeFocusItem",function(e){if(e){var a=t.element.querySelector(t.FOCUS_SELECTOR+".focus");a&&a.classList.remove("focus"),e.scrollIntoView(!1),e.classList.add("focus"),e.focus();var n=t.element.querySelector(".focus .password-input");n&&n.focus()}}),u(d(t),"updateSoftkey",function(){s.a.register({left:"cancel",center:"",right:"save"},document)}),t.state={changePwdFailed:!1},t.handleKeydown=t.handleKeydown.bind(d(t)),t}t=e,(a=m).prototype=Object.create(t.prototype),a.prototype.constructor=a,a.__proto__=t;var g=m.prototype;return g.componentDidMount=function(){this.updateSoftkey(),this.candidates=Array.from(this.element.querySelectorAll(this.FOCUS_SELECTOR)),this.element.focus();var e=this.element.querySelector(this.FOCUS_SELECTOR);e.classList.add("focus"),e.focus(),this.initAllEvents()},g.componentWillUnmount=function(){this.removeAllEvents()},g.initAllEvents=function(){window.addEventListener("localized",this.handleLocalize),o.a.on("account-change-password-success",this.changePasswordSucc),o.a.on("account-change-password-failed",this.changePasswordFailed),window.addEventListener("keydown",this.handleKeydown)},g.removeAllEvents=function(){window.removeEventListener("localized",this.handleLocalize),o.a.removeListener("account-change-password-success",this.changePasswordSucc),o.a.removeListener("account-change-password-failed",this.changePasswordFailed),window.removeEventListener("keydown",this.handleKeydown)},g.handlKeydownClick=function(){var e=this.element.querySelector(".focus"),a=this.element.querySelector(".focus .show-password-input");e&&e.click(),a&&a.click()},g.findNext=function(e){var a=Array.from(this.element.querySelectorAll(this.FOCUS_SELECTOR));if(!a.length)return null;var t=this.element.querySelector(this.FOCUS_SELECTOR+".focus")||a[0],n=-1;return a.some(function(s,o){return s===t&&(n=(o+a.length+e)%a.length,!0)}),-1===n?null:a[n]},g.handleClickCheckbox=function(e){this.passwordItem.type=e.target.checked?"text":"password"},g.changePassword=function(){if(Object(l.H)()){var e=this.props.location;o.a.managerChangePassword(e.state.account,this.passwordItem.value)}else c.a.showToaster("error-account-offline")},g.render=function(){var e=this,a=this.props.location,t=this.state.changePwdFailed,s=t?Object(l.a)("incorrect-password"):a.state.account.accountId;return n.default.createElement("div",{id:"change-password",className:"change-password",tabIndex:"-1",ref:function(a){e.element=a}},n.default.createElement(i.a,{view:"change-password",headerStr:s}),t?p:n.default.createElement("li",{className:"account-name change-password-focus",tabIndex:"-1"},h,n.default.createElement("span",{className:"p-sec"},a.state.account.accountId)),n.default.createElement("li",{className:"password change-password-focus",tabIndex:"-1"},f,n.default.createElement("input",{className:"p-pri password-input","data-ignore":"",name:"password",maxlength:"63","x-inputmode":"plain",type:"password",ref:function(a){e.passwordItem=a}})),n.default.createElement("li",{className:"show-password change-password-focus",tabIndex:"-1"},n.default.createElement("label",{className:"pack-checkbox-large"},n.default.createElement("input",{className:"show-password-input",type:"checkbox",onChange:function(a){e.handleClickCheckbox(a)}}),w)))},m}(n.default.Component)}}]);