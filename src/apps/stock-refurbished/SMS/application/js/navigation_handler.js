/* global LazyLoader, NavigationMap */

(function() {
  'use strict';

  let scrollVar = {
    block: 'start',
    behavior: 'smooth'
  };

  LazyLoader.load('js/navigation_map.js', () => {
    NavigationMap.init();
    if (NavigationMap.scrollVar) {
      scrollVar = NavigationMap.scrollVar;
    }
    window.dispatchEvent(new CustomEvent('mapLoaded'));
  });

  window.addEventListener('keydown', (e) => {
    handleKeydown(e);
  });

  window.addEventListener('menuEvent', (e) => {
    NavigationMap && (NavigationMap.optionMenuVisible = e.detail.menuVisible);
  });

  function handleKeydown(e) {
    // Prevent the key down event when attachment page focus.
    if (AttachmentMessageUI.isAttachmentPage &&
        !(NavigationMap && NavigationMap.optionMenuVisible)) {
      return;
    }

    let el = e.target,
        next;

    if (NavigationMap && NavigationMap.lockNav(e)) {
      return;
    }

    if (e.key === 'Enter' || e.key === 'Accept') {
      handleClick(e);
    } else {
      if (!e.target.classList) {
        return;
      }
      if (!e.target.classList.contains('focus')) {
        console.warn('e.target does not have focus');
        el = document.querySelector('.focus');
      }

      next = findElementFromNavProp(el, e);
      if (next && next.classList.contains('hidden') &&
          (typeof ThreadUI !== 'undefined') &&
          ThreadUI._renderingMessage &&
          e.key === 'ArrowDown') {
        // When rendering message, we will skip handle ArrowDown
        return;
      }
      if (next) {
        let prevFocused = document.querySelectorAll('.focus');
        if (next === prevFocused[0]) {
          return;
        }

        if (isRecipientFromNavProp() &&
            (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          return;
        }

        // Always focus the last recipients is better here.
        if (next.classList.contains('recipient') &&
            (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          let Childs = next.parentNode.childNodes;
          next = Childs[Childs.length - 1];
        }
        if (next.classList.contains('subject-composer-input') && 
            (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          ThreadUI.onSubjectChange();
        }

        if (prevFocused.length > 0) {
          prevFocused[0].classList.remove('focus');
        }
        if (!NavigationMap.scrollToElement) {
          next.scrollIntoView(scrollVar);
        } else {
          NavigationMap.scrollToElement(next, e);
        }
        next.classList.add('focus');
        if (NavigationMap.ignoreFocus === null || !NavigationMap.ignoreFocus) {
          next.focus();
          // App make decision to focus on next element.
          // Then, we have to prevent default here.
          e.preventDefault();
        }

        document.dispatchEvent(new CustomEvent('focusChanged', {
          detail: {
            focusedElement: next
          }
        }));
      }
    }
  }

  function isRecipientFromNavProp() {
    let activeElement = document.activeElement;
    let messagesRecipients =
      document.getElementById('messages-recipients-list');
    return ((activeElement.parentNode.id === 'messages-recipients-list') &&
            (messagesRecipients.querySelectorAll('.recipient').length > 1) &&
            (activeElement.getAttribute('contenteditable') === 'true') &&
            (activeElement.textContent));
  }

  function findElementFromNavProp(current, e) {
    if (!current || NavigationMap && NavigationMap.disableNav) {
      return null;
    }

    let style = current.style;
    let id = null;
    switch (e.key) {
      case 'ArrowLeft':
        id = style.getPropertyValue('--nav-left');
        break;
      case 'ArrowRight':
        id = style.getPropertyValue('--nav-right');
        break;
      case 'ArrowUp':
        id = style.getPropertyValue('--nav-up');
        break;
      case 'ArrowDown':
        id = style.getPropertyValue('--nav-down');
        break;
      case 'Home':
      case 'MozHomeScree':
        id = style.getPropertyValue('--nav-home');
        break;
      default:
        break;
    }

    if (!id) {
      return null;
    }

    return document.querySelector('[data-nav-id="' + id + '"]');
  }

  function handleClick(e) {
    let el = document.querySelector('.focus');
    el && el.focus();

    if (NavigationMap && NavigationMap.optionMenuVisible &&
        !e.target.classList.contains('menu-button')) {
      // workaround for case of quick click just right after option menu opening start
      let selectedMenuElement = document.querySelector('menu button.menu-button');
      selectedMenuElement && selectedMenuElement.click && selectedMenuElement.click();
    } else if (NavigationMap && NavigationMap.handleClick) {
      //customization of click action.
      NavigationMap.handleClick(e);
    } else {
      e.target.click();
      for (let i = 0; i < e.target.children.length; i++) {
        e.target.children[i].click();
      }
    }
  }
})();
