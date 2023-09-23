(window.webpackJsonp=window.webpackJsonp||[]).push([[2],{601:function(n,o,e){var r=e(627);"string"==typeof r&&(r=[[n.i,r,""]]);var t={hmr:!0,transform:void 0,insertInto:void 0};e(66)(r,t);r.locals&&(n.exports=r.locals)},627:function(n,o,e){(n.exports=e(65)(!1)).push([n.i,'#settings {\n  display: flex;\n  width: 100%;\n  background-color: var(--color-gs00);\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--color-gs100); }\n\n.settings-container {\n  overflow: auto;\n  height: 23.6rem; }\n\n.settings-title-span {\n  width: 100%;\n  height: 2.4rem;\n  padding-left: 2rem;\n  padding-right: 2rem;\n  font-size: 1.4rem;\n  font-weight: bold;\n  color: var(--color-orange-dark);\n  text-transform: uppercase; }\n\n.settings-forward-icon {\n  color: var(--color-gs20); }\n\n.settings-button-div {\n  display: flex;\n  justify-content: center;\n  margin-top: 1rem;\n  margin-bottom: 1rem; }\n\n.account-show-details-subtitle {\n  margin: 2rem 2rem 0.4rem 2rem;\n  width: 32rem;\n  height: 1.9rem;\n  font-size: 1.4rem;\n  color: var(--color-gs60); }\n\n.hidden {\n  display: none; }\n\n.settings-container header {\n  display: block;\n  font-size: 1.5rem;\n  height: 2.4rem !important;\n  color: var(--color-gs70) !important;\n  line-height: 2.4rem !important;\n  background-color: var(--color-gs10) !important;\n  padding: 0 1rem !important; }\n\n.settings-container button {\n  width: 100%;\n  min-height: 3.6rem !important;\n  line-height: 1;\n  border: none;\n  padding: 0;\n  border-color: var(--color-gs20);\n  border-width: 0.2rem;\n  border-style: solid;\n  background: var(--color-gs20);\n  align-items: center;\n  text-align: center;\n  display: flex;\n  justify-content: center; }\n\n.settings-container button.focus {\n  color: var(--color-gs00);\n  border-style: none; }\n\n.settings-container li {\n  display: flex;\n  flex-direction: column;\n  padding-top: 0.5rem; }\n\n.settings-container li span {\n  padding: 0 1rem; }\n\n.settings-div-wrapper {\n  margin: 0 1rem; }\n\n.account-item {\n  height: 4rem;\n  padding: 1rem;\n  background-color: var(--color-gs00); }\n\n.account-item .account-text {\n  height: 4rem;\n  line-height: 4rem;\n  width: calc(100% - 3.2rem); }\n\n.account-item .icon {\n  height: 4rem;\n  line-height: 4rem;\n  font-size: 3.2rem;\n  color: var(--color-gs45);\n  right: 0.5rem; }\n\n.account-item.focus span {\n  color: var(--color-gs00); }\n\n.account-item.focus span {\n  color: var(--color-gs00); }\n\n.account-item.settings-view-focus {\n  flex-direction: row !important;\n  padding: 1rem;\n  display: flex;\n  align-items: center;\n  margin: 0; }\n\nhtml[dir="rtl"] .account-item .icon {\n  transform: rotateY(180deg); }\n\nhtml[dir="rtl"] #login-caldav #showPwd-li label.pack-checkbox-large > span {\n  width: 22rem;\n  padding-right: 0rem; }\n\n.account-name.p-pri {\n  padding: 0;\n  text-overflow: ellipsis;\n  display: block;\n  float: left;\n  overflow: hidden;\n  white-space: nowrap; }\n\n.account-show-details-text {\n  word-wrap: break-word; }\n\n.delete-account-item {\n  padding: 2rem 1rem 2rem 1rem; }\n\n.sync-switch label.pack-checkbox-large {\n  width: 100%;\n  height: 4rem; }\n\n.sync-switch label.pack-checkbox-large > span {\n  width: 19rem;\n  height: 4rem;\n  left: 0;\n  line-height: 4rem !important;\n  text-overflow: ellipsis;\n  position: absolute;\n  overflow: hidden;\n  padding-right: 3.7rem;\n  white-space: nowrap;\n  left: 1rem; }\n\n.username,\n.url,\n.account-name,\n.password,\n.show-password {\n  display: flex;\n  flex-direction: column;\n  padding: 1rem; }\n\n.username input,\n.url input,\n.password input {\n  border: 0.1rem solid var(--color-gs45);\n  border-radius: 0.2rem;\n  background: var(--color-gs00);\n  padding: 0 1rem;\n  margin: 0;\n  height: 3.6rem;\n  color: var(--color-gs90);\n  box-sizing: border-box;\n  unicode-bidi: -moz-plaintext;\n  box-shadow: none;\n  direction: block; }\n\n.show-password label,\n.show-password label span {\n  width: 22rem;\n  height: 4rem;\n  line-height: 4rem; }\n\n.password-text {\n  margin: 0; }\n\n.sync-switch {\n  padding-top: 1rem;\n  padding-bottom: 1rem; }\n\n.password-failed-text {\n  padding: 0 1rem; }\n\n.sync-account-body {\n  height: 100%;\n  text-align: center; }\n\n.sup-account {\n  padding: 1rem; }\n\n#settings .button {\n  height: 2rem;\n  line-height: 2rem;\n  min-height: auto; }\n\n.settings-view-focus.focus {\n  color: var(--highlight-text-color, #ffffff);\n  background-color: var(--highlight-color); }\n\n.settings-container .button select {\n  position: absolute;\n  -moz-padding-start: 0;\n  color: var(--color-gs90);\n  border: none;\n  height: 2.5rem;\n  line-height: 1 !important;\n  background: none;\n  font-style: normal;\n  margin: 0;\n  top: -0.5rem;\n  left: 0.7rem;\n  width: 22rem; }\n\n#settings .button {\n  border: 0;\n  background-color: var(--color-gs00); }\n\n#settings .focus .button select {\n  color: var(--color-gs00); }\n\n#settings .focus .button {\n  color: var(--color-gs00);\n  background-color: var(--highlight-color); }\n\n.login-caldav-container {\n  height: 23.6rem;\n  overflow-y: auto; }\n\n#settings .settings-button {\n  border-radius: 1.8rem;\n  background-color: var(--color-gs00);\n  color: var(--color-gs100); }\n\n#settings .settings-button.focus {\n  color: var(--color-gs00); }\n\n#add-account .login-loading {\n  align-items: center;\n  text-align: center;\n  display: flex;\n  flex-direction: column; }\n\n#add-account .loading-text {\n  margin-top: 2rem;\n  margin-bottom: 3rem; }\n',""])}}]);