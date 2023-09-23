import Service from './service';

export default class SimpleNavigationHelper {
  loopable = true;

  static onBeforeKeyDown() {}

  constructor(selector, element, scrollSelector, initialFocusIndex) {
    this.selector = selector;
    this.element = element;
    this.scrollSelector = scrollSelector;
    this.initialFocusIndex = initialFocusIndex || 0;
    this.handleEvents = this.handleEvents.bind(this);
    // document.addEventListener('keydown', this.handleEvents);
    // document.addEventListener('keyup', this.handleEvents);
    this.isHoldingArrowUp = true;
    this.isHoldingArrowDown = true;
    this._mutationObserver = new MutationObserver(this.refresh.bind(this));
    this._mutationObserver.observe(this.element, {
      childList: true,
      subtree: true,
      attributes: true
    });
    // document.addEventListener('focus', this.handleEvents);
    this.refresh([]);
  }

  setElement(element) {
    if (!this.element) {
      this.element = element;
    }
  }

  // to be override
  onBeforeNavDown() {}
  onBeforeNavUp() {}

  setFocus(element, noFocus) {
    this._currentFocus = element;
    // XXX: The reason to maintain this value is because,
    // if the container is having tons of children elements,
    // the focus event handler will trigger a long restyling (2sec)
    // even with setTimeout or requestAnimationFrame.
    // So here is a hack to implicitly let other modules to focus on the
    // last active element when back from other element to this element
    // but not focus on the container directly.
    this.element.activeElement = element;
    if (noFocus) {
      return;
    }
    this.scrollIntoView(element);
    // if (this.element.contains(document.activeElement)) {
      element && element.focus();
    // }
  }

  destroy() {
    document.removeEventListener('keydown', this.handleEvents);
    document.removeEventListener('keyup', this.handleEvents);
    document.removeEventListener('focus', this.handleEvents);
    this._candidates = [];
    this._mutationObserver.disconnect();
    this._currentFocus = null;
    this.element.activeElement = null;
    this.element = null;
  }

  updateCandidates() {
    this._candidates = Array.from(this.element.querySelectorAll(this.selector));
  }

  isAriaHiddenByAncestor() {
    let isHidden = false;
    let element = this.element;
    while (element !== document.body) {
      if ('true' === element.getAttribute('aria-hidden')) {
        isHidden = true;
        break;
      }
      element = element.parentNode;
    }
    return isHidden;
  }

  refresh(mutations) {
    let shouldResetFocus = false;
    let needFocusIndex = this.initialFocusIndex;
    let nodeAdded = false;
    mutations.forEach((mutation) => {
      [].slice.call(mutation.removedNodes).forEach((node) => {
        if (node.contains(this._currentFocus)) {
          shouldResetFocus = true;
          needFocusIndex = this.getElementIndex(this._currentFocus);
        }
      });

      if (mutation.addedNodes.length > 0) {
        shouldResetFocus = true;
        nodeAdded = true;
      }
    });

    this.updateCandidates();
    if (nodeAdded) {
      needFocusIndex = this.getElementIndex(this._currentFocus);
    }
    if (shouldResetFocus ||
        ((!this._currentFocus || this._currentFocus === this.element) && this._candidates.length) ||
        this.element === document.activeElement) {
      let next = needFocusIndex === this._candidates.length
                ? this._candidates[this.initialFocusIndex]
                : this._candidates[needFocusIndex];
      if (next) {
        this._currentFocus = next;
        this.element.activeElement = next;
      } else {
        this._currentFocus = this.element;
        this.element.activeElement = null;
      }
    }
    if (this.element.contains(document.activeElement) &&
        (this._currentFocus !== document.activeElement || nodeAdded)) {
      this.scrollIntoView(this._currentFocus);
      this._currentFocus.focus();
    }
  }

  handleEvents(evt) {
    if ('keydown' === evt.type) {
      this.onKeyDown(evt);
    } else if ('keyup' === evt.type) {
      this.onKeyUp(evt);
    } else if ('focus' === evt.type) {
      if (this._currentFocus && this._currentFocus !== this.element) {
        this.scrollIntoView(this._currentFocus);
        this._currentFocus.focus();
        return;
      }
      let next = this.findNext();

      if (next) {
        this.scrollIntoView(next);
        next.focus();
        this._currentFocus = next;
        this.element.activeElement = next;
      } else {
        this._currentFocus = this.element;
        this.element.activeElement = null;
      }
    }
  }

  onKeyUp(evt) {
    if (evt.key === 'ArrowUp') {
      this.isHoldingArrowUp = true;
    } else if (evt.key === 'ArrowDown') {
      this.isHoldingArrowDown = true;
    }
  }

  onKeyDown(evt) {
    this.constructor.onBeforeKeyDown(evt);
    var nextFocus = null;
    var handled = false;
    let retValue = {};
    if ('Enter' === evt.key || 'Accept' === evt.key) {
      // this.handleClick(evt);
    }

    // if (document.querySelector('.cache-route-uncached .monthView')) {
    //   retValue = this.handleKeydownForMonthView(evt.key);
    //   nextFocus = retValue.nextFocus;
    //   handled = retValue.handled;
    // } else {
      switch (evt.key) {
        case 'ArrowDown':
          handled = true;
          nextFocus = this.findNext();
          if (!this.isHoldingArrowDown && this.element.activeElement &&
            nextFocus.offsetTop < this.element.activeElement.offsetTop) {
            nextFocus = null;
          }
          this.isHoldingArrowDown = false;
          break;
        case 'ArrowUp':
          handled = true;
          nextFocus = this.findPrev();
          if (!this.isHoldingArrowUp  && this.element.activeElement &&
            nextFocus.offsetTop > this.element.activeElement.offsetTop) {
            nextFocus = null;
          }
          this.isHoldingArrowUp = false;
          break;
        default:
          break;
      }
    // }
    if (nextFocus) {
      this.scrollIntoView(nextFocus);
      nextFocus.focus();
      this._currentFocus = nextFocus;
      this.element.activeElement = nextFocus;
      Service.request('changeFocus');
    }
    if (handled) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }
  
  handleClick(evt) {
    let item = evt.target;

    item.click();
    for (let i = 0; i < item.children.length; i++){
      item.children[i].click();
    }
  }

  handleKeydownForMonthView(key) {
    let nextFocus = null;
    let handled = false;
    let num = null;

    switch (key) {
      case 'ArrowDown':
        handled = true;
        num = 7;
        break;
      case 'ArrowUp':
        handled = true;
        num = -7;
        break;
      case 'ArrowLeft':
        handled = true;
        num = -1;
        break;
      case 'ArrowRight':
        handled = true;
        num = 1;
        break;
      default:
        break;
    }

    if (!num) {
      return {
        nextFocus,
        handled
      };
    }

    let nextInfo = this.findNextFocus(null, num);
    if (nextInfo.next < 0) {
      Service.request('preMonth');
    } else if (nextInfo.next > 0) {
      Service.request('nextMonth');
    } else {
      nextFocus = nextInfo.candidateItem
    }

    return {
      nextFocus,
      handled
    };
  }

  scrollIntoView(element) {
    if (!element) {
      return;
    }
    if (this.scrollSelector) {
      let target = element;
      let found = false;
      while (target !== document.body) {
        if (target.matches(this.scrollSelector)) {
          found = true;
          target.scrollIntoView(false);
          break;
        }
        target = target.parentNode;
      }
      if (!found) {
        // In case the parent does no exist.
        element.scrollIntoView(false);
      }
    } else {
      element.scrollIntoView(false);
    }
  }

  getInitialFocus() {
    let candidates = this._candidates;
    if (!candidates.length) {
      return null;
    }
    return candidates[this.initialFocusIndex];
  }

  getElementIndex(element) {
    let candidates = this._candidates;
    if (!candidates || !candidates.length || !element) {
      return 0;
    }
    let elementIndex = 0;
    candidates.some((dom, index) => {
      if (dom === element) {
        elementIndex = index % candidates.length;
        return true;
      } else {
        return false;
      }
    });
    return elementIndex;
  }

  findNext(element) {
    this.onBeforeNavDown();
    element = element || document.activeElement;
    let candidates = this._candidates;
    if (!candidates.length) {
      return null;
    }
    let next = 0;
    candidates.some((dom, index) => {
      if (dom === element) {
        next = (index + 1) % candidates.length;
        return true;
      }
      return false;
    });
    if (0 === next && !this.loopable) {
      return null;
    }
    return candidates[next] || candidates[this.initialFocusIndex];
  }

  findPrev(element) {
    this.onBeforeNavUp();
    element = element || document.activeElement;
    let candidates = this._candidates;
    if (!candidates.length) {
      return null;
    }
    let next = null;
    candidates.some((dom, index) => {
      if (dom === element) {
        next = ((candidates.length + index) - 1) % candidates.length;
        return true;
      }
      return false;
    });
    if (candidates.length - 1 === next && !this.loopable) {
      return null;
    }
    return candidates[next] || candidates[this.initialFocusIndex];
  }

  findNextFocus(element, num) {
    let candidateItem = null;
    let candidates = this._candidates;
    element = element || document.activeElement;

    if (!candidates.length) {
      return null;
    }
    let next = 0;
    candidates.some((dom, index) => {
      if (dom === element) {
        next = index + num;
        return true;
      }
      return false;
    });
    if (next >= 0 && next < candidates.length) {
      candidateItem = candidates[next];
      next = 0;
    }

    return {
      next,
      candidateItem
    };
  }
}
