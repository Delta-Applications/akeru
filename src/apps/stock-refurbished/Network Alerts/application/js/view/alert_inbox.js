'use strict'; (function (exports) {
  const AlertBox = function () {
    this.DEBUG = true; this.name = 'InboxScreen'; this.screen = document.getElementById('inbox-screen');
    this.empty = document.getElementById('empty-list'); this.header = document.getElementById('alert-header'); this.list = document.getElementById('alert-list'); this.focusElement = null; this.messages = []; this.editMode = false; this.selectedMessages = new Set();
  }; AlertBox.prototype.debug = function (s) { if (this.DEBUG) { console.log(`-*- CMAS ${this.name} -*- ${s}`); } }; AlertBox.prototype.init = function () { Store.init(); Store.getAll().forEach((message) => { if (message) { this.messages.push(message); } }); this.messages.reverse(); }; AlertBox.prototype.show = function () {
    this.debug('show alert list'); this.init(); this.screen.classList.remove('hidden'); for (let i in this.messages) { this.createList(this.messages[i]); }
    SoftkeyHelper.init(); this.showBox(); document.addEventListener('keydown', this.handleKeydown.bind(this)); this.screen.addEventListener('focus', this.focusHnder.bind(this), true);
  }; A = function () { this.screen.classList.remove('hidden'); if (this.messages.length) { this.list.classList.remove('hidden'); SoftkeyHelper.setSoftKey('alert-inbox'); NavigationHelper.init('.list-items', this.list); NavigationHelper.updateCandidates(); } else { this.empty.classList.remove('hidden'); this.empty.focus(); SoftkeyHelper.setSoftKey('none'); } }; AlertBox.prototype.showDetail = function () { let element = document.activeElement; let id = element.id; this.debug('show alert detail: ', id); Store.getItem(id).then((message) => { if (message) { this.screen.classList.add('hidden'); AlertDetail.show(message); } }); }; AlertBox.prototype.deleteCB = function () { if (this.mulDel) { this.selectedMessages.forEach((id) => { this.deleteMessage(id); }); this.mulDel = false; this.editMode = false; this.showBox(); } else { let element = this.focusElement; this.deleteMessage(element.id); this.showBox(); } }; AlertBox.prototype.deleteCancelCB = function () { this.showBox(); }; AlertBox.prototype.showEditMode = function (bShow) {
    let allList = document.querySelectorAll('li'); if (!bShow && this.selectedMessages.size > 0) { this.selectMessages(false); }
    Array.prototype.forEach.call(allList, (item) => { if (bShow) { this.editMode = true; item.querySelector('.pack-checkbox').classList.remove('hidden'); item.querySelector('.list-item').classList.add('editMode'); SoftkeyHelper.editSoftKeyItem(true, true, false); } else { this.editMode = false; item.querySelector('.pack-checkbox').classList.add('hidden'); item.querySelector('.list-item').classList.remove('editMode'); SoftkeyHelper.setSoftKey('alert-inbox'); } }); NavigationHelper.init('.list-items', this.list); NavigationHelper.updateCandidates();
  }; AlertBox.prototype.updateActionBar = function () { this.actionBar.inactive = !this.selectedMessages.size; }; AlertBox.prototype.createList = function (message) {
    let li = document.createElement('li'); li.id = message.id; li.setAttribute('tabindex', '-1'); li.className = "list-items"; li.innerHTML = `
      <div class="list-item">
        <p data-l10n-id=${message.messageType}></p>
        <p>${message.body}</p>
        <p>${ViewUtils.getDate(message.timestamp)}</p>
      </div>
      <label class="hidden pack-checkbox">
        <input
          class = "checkbox-list-input"
          type="checkbox"
        />
        <span class="checkbox-list-span"></span>
      </label>
      `; let checkBox = li.querySelector('.pack-checkbox'); checkBox.itemId = message.id; this.list.appendChild(li);
  }; AlertBox.prototype.selectMessage = function () {
    let evt = document.activeElement; if (!this.editMode) { this.showDetail(evt.id); } else {
      if (!evt.classList.contains('pack-checkbox')) {
        let cc = evt.querySelector('input'); cc.checked = !cc.checked; if (cc.checked) { this.selectedMessages.add(evt.id); } else { this.selectedMessages.delete(evt.id); }
        SoftkeyHelper.editSoftKeyItem(this.selectedMessages.size !== this.messages.length, !cc.checked, this.selectedMessages.size !== 0);
      }
    }
  }; AlertBox.prototype.focusHnder = function () { if (this.editMode) { let checkBox = document.activeElement.querySelector('input'); SoftkeyHelper.editSoftKeyItem(this.selectedMessages.size !== this.messages.length, !checkBox.checked, this.selectedMessages.size !== 0); } }; AlertBox.prototype.selectMessages = function (bAllSelect) {
    let checkboxes = document.querySelectorAll('input'); for (let i = 0; i < checkboxes.length; i++) { if (checkboxes[i].checked !== bAllSelect) { let index = checkboxes[i].parentNode.itemId.lastIndexOf('/') + 1; let id = checkboxes[i].parentNode.itemId.substring(index); checkboxes[i].checked = bAllSelect; if (bAllSelect) { this.selectedMessages.add(id); } else { this.selectedMessages.delete(id); } } }
    SoftkeyHelper.editSoftKeyItem(!bAllSelect, !bAllSelect, bAllSelect);
  }; AlertBox.prototype.deleteMessage = function (id) {
    if (AlertDetail.isShown()) { AlertDetail.hide(); }
    const delLi = document.getElementById(id); this.list.removeChild(delLi); for (let i = 0; i < this.messages.length; i++) { if (this.messages[i].id.toString() === id.toString()) { this.messages.splice(i, 1); break; } }
    Store.remove(id); if (this.editMode) { this.selectedMessages.delete(id); if (this.selectedMessages.size < 1) { this.showEditMode(false); } }
    ViewUtils.dismissNotice(id);
  }; AlertBox.prototype.deleteSelectMessages = function () { this.mulDel = this.selectedMessages.size > 1; let l10n = this.mulDel ? 'delete-messages' : 'delete-message'; Dialog.show(l10n, this.deleteCB.bind(this), this.deleteCancelCB.bind(this)); }; AlertBox.prototype.isShown = function () { return !this.screen.classList.contains('hidden'); }; AlertBox.prototype.handleKeydown = function (evt) {
    switch (evt.key) {
      case 'BrowserBack': case 'Backspace': if (Dialog.isActive() || Optionmenu.isActive()) { Optionmenu.hide(); Dialog.hide(); if (this.isShown()) { this.showBox(); } else { AlertDetail.showPage(); } } else { if (this.isShown()) { if (this.editMode) { this.showEditMode(false); } else { window.close(); window.dispatchEvent(new CustomEvent('close-activity')); } } else { AlertDetail.hide(); this.showBox(); } }
        evt.preventDefault(); evt.stopPropagation(); break; default: break;
    }
  }; exports.AlertBox = new AlertBox();
})(window);