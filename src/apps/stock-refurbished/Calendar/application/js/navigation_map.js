(function(exports) {
  const OPTION_MENU = 'option-menu';

  const MONTH_VIEW = 'month-view';
  const DAY_VIEW = 'day-view';
  const WEEK_VIEW = 'week-view';
  const MODIFY_EVENT = 'modify-event-view';
  const SETTING = 'advanced-settings-view';
  const SEARCH_VIEW = 'event-search-view';
  const CALENDAR_DISPLAY = 'settings';
  const SHOW_MULTI_EVENTS = 'multi-events-view';
  const CREATE_ACCOUNT = 'create-account-view';
  const MODIFY_ACCOUNT = 'modify-account-view';
  const MODIFY_PASSWORD = 'modify-password-view';
  const SWITCHTO_DATE_VIEW = 'switchto-date-view';
  const EVENT_VIEW = 'event-view';
  const LIMIT_ROWS = 5;

  var Path_MAP = {
    'month-view': ['/month/'],
    'day-view': ['/day/'],
    'week-view': ['/week/'],
    'modify-event-view': ['/event/edit/', '/event/add/'],
    'advanced-settings-view': ['/advanced-settings/'],
    'event-search-view': ['/search/'],
    'settings': ['/settings/'],
    'multi-events-view': ['/show-multi-events/'],
    'create-account-view': ['/select-preset/'],
    'modify-account-view': ['/create-account/', '/update-account/'],
    'modify-password-view': ['/password/'],
    'switchto-date-view': ['/switchto-date/'],
    'event-view': ['/event/show/']
  };

  var controls = {};
  var currentContainerID = null;

  var nav_id = 0;
  var _storeFocused = null;
  var multi_reset = false;
  var page_timer = null;
  var isRtl;
  var dateItem = document.querySelector('.select-value .calendarId-select');

  setTimeout(function() {
    isRtl = 'rtl' === document.dir;
  }, 200);

  function setMultiReset(value) {
    multi_reset = value;
  }

  function getMultiReset() {
    return multi_reset;
  }

  function GetIdByPath(path) {
    for (id in Path_MAP) {
      var items = Path_MAP[id];
      for (var i = 0; i < items.length; i++) {
        if ((path == items[i]) || (path.substring(0, items[i].length) == items[i])) {
          return id;
        }
      }
    }
  }

  function listViewUpdate(elements) {
    var i = 0;
    var id = nav_id;  // to avoid 'data-nav-id' reproduced with grid

    for (i = 0; i < elements.length; i++) {
      elements[i].setAttribute('data-nav-id', id);
      elements[i].style.setProperty('--nav-left', -1); //-1: invalid ID
      elements[i].style.setProperty('--nav-right', -1);
      elements[i].style.setProperty('--nav-down', id + 1);
      elements[i].style.setProperty('--nav-up', id - 1);
      elements[i].setAttribute('tabindex', 0);
      id++;
    }

    elements[0].style.setProperty('--nav-up', id - 1);
    elements[elements.length - 1].style.setProperty('--nav-down', nav_id);
    nav_id = id;
  }

  function monthViewNavUpdate(elements) {
    var i = 0;
    var id = nav_id; // to avoid 'data-nav-id' reproduced with grid

    for (i = 0; i < elements.length; i++) {
      elements[i].setAttribute('data-nav-id', id);
      elements[i].style.setProperty('--nav-left', id - 1); //-1: invalid ID
      elements[i].style.setProperty('--nav-right', id + 1);
      elements[i].style.setProperty('--nav-down', id + 7);
      elements[i].style.setProperty('--nav-up', id - 7);
      elements[i].setAttribute('tabindex', 0);
      id++;
    }

    for (i = 0; i < 7; i++) {
      elements[i].style.setProperty('--nav-up', -1);
      elements[i].style.setProperty('--pre-month-7', true);
      elements[elements.length - i - 1].style.setProperty('--nav-down', -1);
      elements[elements.length - i - 1].style.setProperty('--next-month-7', true);
    }

    elements[0].style.setProperty('--nav-left', -1);
    elements[0].style.setProperty('--pre-month-1', true);
    elements[elements.length - 1].style.setProperty('--nav-right', -1);
    elements[elements.length - 1].style.setProperty('--next-month-1', true);

    nav_id = id;
  }

  function _isPortraitMode() {
    return screen.orientation.type.startsWith('portrait');
  }

  function weekViewNavUpdate(elements) {
    var i = 0;
    var id = nav_id;  // to avoid 'data-nav-id' reproduced with grid

    for (i = 0; i < elements.length; i++) {
      elements[i].setAttribute('data-nav-id', id);
      if (isRtl) {
        elements[i].style.setProperty('--nav-left', id + 1); //-1: invalid ID
        elements[i].style.setProperty('--nav-right', id - 1);
      } else {
        elements[i].style.setProperty('--nav-left', id - 1); //-1: invalid ID
        elements[i].style.setProperty('--nav-right', id + 1);
      }
      elements[i].style.setProperty('--nav-down', id + 7);
      elements[i].style.setProperty('--nav-up', id - 7);
      elements[i].setAttribute('tabindex', 0);
      id++;
    }

    var sideElements = document.querySelectorAll("#week-view .focusBox__weekAllDay, #week-view .focusBox__weekDay");
    for (var j = 0; j < sideElements.length; j++) {
      if (isRtl) {
        sideElements[j].firstChild.style.setProperty('--nav-right', -1);
        sideElements[j].firstChild.style.setProperty('--next', true);
        sideElements[j].lastChild.style.setProperty('--nav-left', -1);
        sideElements[j].lastChild.style.setProperty('--prev', true);
      } else {
        sideElements[j].firstChild.style.setProperty('--nav-left', -1);
        sideElements[j].firstChild.style.setProperty('--prev', true);
        sideElements[j].lastChild.style.setProperty('--nav-right', -1);
        sideElements[j].lastChild.style.setProperty('--next', true);
      }
    }

    for (i = 0; i < 7; i++) {
      elements[i].style.setProperty('--nav-up',
          Number(elements[i].getAttribute('data-nav-id')) + 24 * 7);
      elements[elements.length - i - 1].style.setProperty('--nav-down',
          Number(elements[elements.length - i - 1].getAttribute('data-nav-id')) - 24 * 7);
    }
    nav_id = id;
  }

  function switchtoDateViewUpdate() {
    var i = 0;
    var id = nav_id; /// to avoid 'data-nav-id' reproduced with grid
    var elements = document.querySelectorAll('#show-switchto-date-content ul li');
    for (i = 0; i < elements.length; i++) {
      elements[i].setAttribute('data-nav-id', id);
      elements[i].style.setProperty('--nav-left', id - 1); //-1: invalid ID
      elements[i].style.setProperty('--nav-right', id + 1);
      elements[i].style.setProperty('--nav-down', -1);
      elements[i].style.setProperty('--nav-up', -1);
      elements[i].setAttribute('tabindex', 0);
      id++;
    }

    //top element
    elements[0].style.setProperty('--nav-left', id - 1);
    //bottom element
    elements[elements.length - 1].style.setProperty('--nav-right', nav_id);
    nav_id = id;
  }

  function getCurContainerId() {
    return currentContainerID;
  }

  function getCurControl() {
    var control = null;
    var containerId = getCurContainerId();

    if ( containerId ) {
      control = controls[containerId];
    }
    return control;
  }

  function getCurItem() {
    var item = null;
    var curControl = getCurControl();

    if (curControl) {
      if (curControl.index >= 0 &&
          curControl.index < curControl.elements.length) {
        item = curControl.elements[curControl.index];
      }
    }
    return item;
  }

  function sendIndexEvent(id, index, item) {
    var evt = new CustomEvent("index-changed", {
      detail: {
        panel: id,
        index: index,
        focusedItem: item
      },
      bubbles: true,
      cancelable: false
    });

    window.dispatchEvent(evt);
  }

  function setCurIndex(index) {
    var curControl = getCurControl();

    if (curControl) {
      if (index >= -1 && index < curControl.elements.length) {
        curControl.index = index;
        var focusedItem = (index == -1) ? null : curControl.elements[index];
        if (focusedItem) {
          _storeFocused = focusedItem;
        }
        sendIndexEvent(getCurContainerId(), index, focusedItem);
      }
    }
  }

  function dateFromId(id) {
    var parts = id.split('-'),
        date,
        type;

    if (parts.length > 1) {
      type = parts.shift();
      switch (type) {
        case 'd':
          date = new Date(parts[0], parts[1], parts[2]);
          break;
        case 'm':
          date = new Date(parts[0], parts[1]);
          break;
      }
    }

    return date;
  }

  function isSameDate(first, second) {
    return first.getMonth() == second.getMonth() &&
           first.getDate() == second.getDate() &&
           first.getFullYear() == second.getFullYear();
  }

  function isFocusEventOnDayView(hourItem, focusHour) {
    let startDate = new Date(hourItem.dataset.startDate);
    let endDate = new Date(hourItem.dataset.endDate);
    let startHour = startDate.getHours() + startDate.getMinutes()/60;
    let endHour = endDate.getHours() + endDate.getMinutes()/60;

    if ((startHour > focusHour && startHour < focusHour + 1) ||
      (endHour > focusHour && endHour < focusHour + 1) ||
      (startHour <= focusHour && endHour >= focusHour + 1)) {
      return true;
    } else {
      return false;
    }
  }

  var NavigationMap = {
    currentActivatedLength: 0,
    _customWeekFocus: {enable:false, type: ''},
    menuIsActive: false,

    init: function _init() {
      // Store the event object of `menuEvent` temporarily
      let menuEventObj = null;

      window.addEventListener('page-changed', function(e) {
        var id = GetIdByPath(e.detail.page);
        if (id) {
          currentContainerID = id;
          if (page_timer) {
            clearTimeout(page_timer);
            page_timer = null;
          }
          page_timer = setTimeout(() => {
            // Avoid flashing at the same time when pressing `add` and` options`.
            if (id === MODIFY_EVENT && NavigationMap.menuIsActive) {
              return;
            }
            // Close menu when switching pages.
            if (NavigationMap.menuIsActive) {
              menuEventObj.hideMenu();
            }
            NavigationMap.reset(id);
            page_timer = null;
          }, 200);
        }

      });

      document.addEventListener('focusChanged', function(e) {
        var focusedItem = e.detail.focusedElement;

        var curControl = getCurControl();
        if ( curControl && curControl.elements ) {
          /*convert to an array*/
          var elements = Array.prototype.slice.call(curControl.elements);
          /*find the index of focused item in current control*/
          var index = elements.indexOf(focusedItem);
          if ( index >= 0 ) {
            /*update index*/
            setCurIndex(index);
          }
        }
        if (window.location.pathname === '/day/') {
          var hour = focusedItem.dataset.hour;
          let focusHour = parseFloat(hour);
          var event_hours = document.querySelectorAll(".md__event");
          for (var i = 0; i < event_hours.length; i++) {
            var hourItem = event_hours[i];

            if (isFocusEventOnDayView(hourItem, focusHour)) {
              hourItem.classList.add('hasFocused');
            } else {
              hourItem.classList.remove('hasFocused');
            }
          }
          delete window.history.state.eventStartHour;
          if (hour) {
            window.history.state.selectedHour = hour;
          } else {
            window.history.state.selectedHour = 'allday';
          }
        }
      });

      document.addEventListener('tcl-date-changed', function(e) {
        if (window.location.pathname === '/month/') {
          var todate = e.detail.toDate;
          NavigationMap.navSetup(MONTH_VIEW, '.month.active .focusable');
          NavigationMap.setFocusOnMonthView(todate);
        }
      });

      document.addEventListener('kai-week-custom-focus', function(e) {
        switch (e.detail.type) {
          case 'current-date':
          case 'go-to-date':
            NavigationMap.setCustomWeekFocus(e.detail.type);
            break;
          case 'onactive':
            NavigationMap._customWeekFocus.enable = true;
            NavigationMap._customWeekFocus.type = 'onactive';
            NavigationMap._customWeekFocus.targetDate = e.detail.targetDate;
            break;
        }
      });

      window.addEventListener('menuEvent', function(e) {
        menuEventObj = e.detail.softkeyPanel;
        NavigationMap.menuIsActive = false;

        if (e.detail.menuVisible) {
          //assign id to option menu for navSetup
          NavigationMap.menuIsActive = true;
          e.detail.softkeyPanel.menu.form.id = OPTION_MENU;
          if (_storeFocused) {
            _storeFocused.classList.add('hasfocused');
            _storeFocused.classList.remove('focus');
          }
          NavigationMap.optionReset();
        } else {
          if (_storeFocused && (!dateItem.dataset.valueFlag ||
            dateItem.dataset.valueFlag === 'null')) {
            _storeFocused.classList.remove('hasfocused');
            _storeFocused.classList.add('focus');
            var el = _storeFocused.querySelector('.tcl-input-focusable');
            if (el) {
              el.focus();
            } else {
              _storeFocused.focus();
            }
          }
        }
      });

      window.addEventListener('keydown', function(e) {
        switch (e.key) {
          case 'Accept':
          case 'Enter':
            var el = document.querySelector('.focus select, .focus input, .focus textarea, .focus div[contenteditable="true"]');
            if (el) {
              el.focus();
            }
            break;
        }
      });
    },

    menuUpdate: function _menuUpdate() {
      if (_storeFocused) {
        _storeFocused.classList.remove('hasfocused');
        _storeFocused.classList.add('focus');
        var el = _storeFocused.querySelector('.tcl-input-focusable');
        if (el) {
          el.focus();
        } else {
          _storeFocused.focus();
        }
      }
    },

    setFocus: function _setFocus(id) {
      var curControl = getCurControl();
      if (!curControl) {
        console.log("setFocus failed!");
        return;
      }

      id = id || 0;
      id = (id == 'first') ? 0 :
          ((id == 'last') ? curControl.elements.length - 1 : id);

      if (id >= 0 && id < curControl.elements.length) {
        /*remove current focus, only one element has focus */
        var focused = document.querySelectorAll(".focus");
        for (var i = 0; i < focused.length; i++) {
          focused[i].classList.remove('focus');
        }

        focused = document.querySelectorAll(".hasfocused");
        for (var i = 0; i < focused.length; i++) {
          focused[i].classList.remove('hasfocused');
        }

        var toFocused = curControl.elements[id];
        toFocused.setAttribute('tabindex', 1);
        toFocused.classList.add('focus');
        toFocused.focus();
      }

      //id may be -1
      setCurIndex(id);
    },

    /*setup navigation for the items that query from a container.
    @paramters:
        containerId: the id of the container element, undefined: coantainer = body
        query: the condition to query the items
    */
    navSetup: function _setup(containerId, query) {
      var elements = null;
      var container = (containerId == undefined) ? document.body :
          document.getElementById(containerId);

      if (container) {
        elements = container.querySelectorAll(query);
        if (elements.length > 0) {
          switch (containerId) {
            case MONTH_VIEW:
              monthViewNavUpdate(elements);
              break;
            case WEEK_VIEW:
              weekViewNavUpdate(elements);
              break;
            case DAY_VIEW:
            case OPTION_MENU:
            case MODIFY_EVENT:
            case SETTING:
            case SEARCH_VIEW:
            case CALENDAR_DISPLAY:
            case SHOW_MULTI_EVENTS:
            case CREATE_ACCOUNT:
            case MODIFY_ACCOUNT:
            case MODIFY_PASSWORD:
              listViewUpdate(elements);
              break;
            case SWITCHTO_DATE_VIEW:
              switchtoDateViewUpdate();
              break;
            default:
          }

        }
      }

      if (containerId && elements) {
        if (!controls[containerId]) {
          controls[containerId] = {};
          controls[containerId].index = elements.length > 0 ? 0 : -1;
        }
        controls[containerId].elements = elements;
      }
    },

    reset_controls: function() {
      var _controls = this._controls;
      if (_controls.length) {
        var i = 0;
        var id = nav_id++;
        var prevId = id;
        var nextId = nav_id++;

        for (i = 0; i < _controls.length; i++) {
          _controls[i].style.setProperty('--nav-left',  -1);
          _controls[i].style.setProperty('--nav-right', -1);
          _controls[i].setAttribute('tabindex', 0);
          _controls[i].setAttribute('data-nav-id', id);

          _controls[i].style.setProperty('--nav-down', nextId);
          _controls[i].style.setProperty('--nav-up',   prevId);

          prevId = id;
          id = nextId;
          nextId = nav_id++;
        }
        nav_id = id;

        var lastCtrl  = _controls[_controls.length - 1];
        var firstCtrl = _controls[0];

        lastCtrl.style.setProperty('--nav-down',
          firstCtrl.getAttribute('data-nav-id'));
        firstCtrl.style.setProperty('--nav-up',
          lastCtrl.getAttribute('data-nav-id'));
      }
    },

    reset_options: function _reset() {
      NavigationMap._controls =
        document.querySelectorAll('#mainmenu .menu-button.p-pri');
      NavigationMap.reset_controls();
      var focused = document.querySelectorAll('.focus');
      for (var i = 0; i < focused.length; i++) {
        focused[i].classList.remove('focus');
      }
      if (NavigationMap._controls.length) {
        NavigationMap._controls[0].classList.add('focus');
        NavigationMap._controls[0].focus();
      }
    },

    reset: function _reset(id) {
      var index = -1;
      if (controls[id] && (controls[id].index > -1)) {
        index = controls[id].index;
      }

      switch (id) {
        case WEEK_VIEW:
          this.navSetup(id, ".focusable_week");
          break;
        case MODIFY_ACCOUNT:
        case MODIFY_PASSWORD:
          this.navSetup(id, '.accFocusable');
          break;
        case MONTH_VIEW:
          this.navSetup(id, ".month.active .focusable");
          break;
        case EVENT_VIEW:
          var el = document.getElementById('view-event-panel');
          if (el) {
            var elContent = el.querySelector('#view-event-content');
            if (elContent) {
              elContent.setAttribute('aria-label', el.textContent.replace(/(\s\s+)/g, ' '));
            }
            el.focus();
          }
          return;
        default:
          this.navSetup(id, ".focusable");
      }
      index = (index > controls[id].elements.length - 1) ? 0 : index;

      //Focus current hour when enter Day view
      if (id == CALENDAR_DISPLAY) {
        index = 0;
        NavigationMap.setFocus(index);
      } else if (id == DAY_VIEW) {
        this.setFocusOnDayView();
      } else if (id === MONTH_VIEW) {
        var currentDate = new Date();
        if ('monthselectedDay' in window.history.state && window.history.state.monthselectedDay != undefined) {
          currentDate = window.history.state.monthselectedDay;
        } else {
          if (index > -1) {
            var item = controls[id].elements[index];
            currentDate = dateFromId(item.dataset.date);
          }
        }
        this.setFocusOnMonthView(currentDate);
      } else if (id === SEARCH_VIEW || id === MODIFY_EVENT ||
        id === MODIFY_ACCOUNT || id === MODIFY_PASSWORD) {
        NavigationMap.setFocus(0);
        if (id == MODIFY_ACCOUNT || id == MODIFY_PASSWORD) {
          var input = document.querySelector(".focus");
          if (input.setSelectionRange) {
            input.setSelectionRange(0, 0);
          }
        }
      } else if (id == SHOW_MULTI_EVENTS || id == CREATE_ACCOUNT) {
        var lastIndex = controls[id].elements.length - 1;
        index = controls[id].index;
        index = (index > lastIndex) ? lastIndex : index;
        index = getMultiReset() ? ((index < 0) ? 0 : index) : 0;
        NavigationMap.setFocus(index);
      } else {
        if (NavigationMap._customWeekFocus.enable) {
          NavigationMap.setCustomWeekFocus(NavigationMap._customWeekFocus.type);
        } else {
          index = (index < 0) ? 0 : index;
          NavigationMap.setFocus(index);
        }

      }
    },

    /*option menu*/
    optionReset: function _reset() {
      this.navSetup(OPTION_MENU, '.menu-button');

      /*remove current focus, only one element has focus */
      var focused = document.querySelectorAll(".focus");
      for (var i = 0; i < focused.length; i++) {
        focused[i].classList.remove('focus');
      }

      var toFocused = controls[OPTION_MENU].elements[0];
      if (toFocused) {
        toFocused.setAttribute('tabindex', 1);
        toFocused.classList.add('focus');

        toFocused.focus();
      }
    },

    scrollToElement: function _scroll(bestElementToFocus, evt) {
      function isVisible(bestElementToFocus) {
        if (bestElementToFocus.offsetWidth === 0 ||
            bestElementToFocus.offsetHeight === 0) {
          return false;
        }
        var height = document.documentElement.clientHeight - 30;
        var rects = bestElementToFocus.getClientRects();
        for (var i = 0, l = rects.length; i < l; i++) {
          var r = rects[i];
          if (r.bottom > 0 && r.bottom <= height && r.top >= 54) {
            return true;
          }
        }
        return false;
      }

      if (window.location.pathname === '/day/' || window.location.pathname === '/week/') {
        if (bestElementToFocus.classList.contains('focusBox__weekAllDayChild')) {
          return;
        }
        var height = document.documentElement.clientHeight - 42;
        var deltaTop = window.location.pathname === '/day/' ? 86 : 126;
        var r = bestElementToFocus.getClientRects()[0];
        if (r.bottom > 0 && r.bottom <= height && r.top >= deltaTop) {
          return;
        }
        var el = window.location.pathname === '/day/' ?
            document.querySelector('#day-view .md__main') :
            document.querySelector('#week-view .md__main');
        switch (evt.key) {
          case 'ArrowDown':
            el.scrollBy(0, r.bottom - height);
            break;
          case 'ArrowUp':
            el.scrollBy(0, r.top - deltaTop);
            break;
        }
        return;
      } else if (!_isPortraitMode() && window.location.pathname === '/month/') {
        var node = bestElementToFocus.parentNode;
        var nodes = Array.prototype.slice.call(node.parentNode.children);

        if (nodes.indexOf(node) > LIMIT_ROWS) {
          nodes[1].classList.add('row-hidden');
          bestElementToFocus.parentNode.classList.remove('row-hidden');
          bestElementToFocus.parentNode.classList.add('row-visible');
        } else {
          nodes[1].classList.remove('row-hidden');
          if (nodes[LIMIT_ROWS + 1]) {
            nodes[LIMIT_ROWS + 1].classList.remove('row-visible');
            nodes[LIMIT_ROWS + 1].classList.add('row-hidden');
          }
        }
      }

      if (!isVisible(bestElementToFocus)) {
        switch (evt.key) {
          case 'ArrowDown':
            bestElementToFocus.scrollIntoView(false);
            break;
          case 'ArrowUp':
            bestElementToFocus.scrollIntoView(true);
            break;
        }
      }
    },

    getCurItem: function() {
      return getCurItem();
    },

    getCurIndex: function() {
      var curControl = getCurControl();
      if (curControl) {
        if (curControl.index >= 0 &&
        curControl.index < curControl.elements.length) {
          return curControl.index;
        }
      }
      return -1;
    },

    getDayViewIndexByDate: function(thisDate, elements) {
      var index = 0;
      var hour = thisDate.getHours();
      var curControl = getCurControl();
      var targetItem = document.querySelector('.md__hour-' + hour + ' .focusable');
      if (elements) {
        for (var i = 0, len = elements.length; i < len; i++) {
          if (elements[i] === targetItem) {
            index = i;
            break;
          }
        }
      }
      return index;
    },

    setFocusOnDayView: function() {
      var index = 0;
      var curControl = getCurControl();
      var state = window.history.state;
      if (state && state.selectedDay) {
        var firstAllDayEvent = document.querySelector('#day-view .md__allday[aria-hidden="false"] a.md__event');
        if (!firstAllDayEvent) {
          var firstNormalEvent = document.querySelector('#day-view .md__day[aria-hidden="false"] a.md__event');
          if (firstNormalEvent) {
            var date = new Date(firstNormalEvent.dataset.date);
            var hour = firstNormalEvent.dataset.hour;
            date.setHours(hour);
            index = NavigationMap.getDayViewIndexByDate(date, curControl.elements);
          } else {
            var date = new Date(curControl.elements[0].dataset.date);
            var now = new Date();
            if (isSameDate(date, now)) {
              index = NavigationMap.getFocusIndexOfDayView(curControl, now.getHours());
            }
          }
        }
      } else if (state && state.eventStartHour) {
        var hour = state.eventStartHour;
        index = hour === 'allday' ? 0 :
            NavigationMap.getFocusIndexOfDayView(curControl, hour);
      } else {
        index = curControl.index;
      }

      NavigationMap.setFocus(index);

      if (window.location.pathname === "/day/") {
        var hour = NavigationMap.getCurItem().dataset.hour;
        let focusHour = parseFloat(hour);
        var event_hours = document.querySelectorAll(".md__event");
        for (var i = 0, len = event_hours.length; i < len; i++) {
          var hourItem = event_hours[i];

          if (isFocusEventOnDayView(hourItem, focusHour)) {
            hourItem.classList.add('hasFocused');
          } else {
            hourItem.classList.remove('hasFocused');
          }
        }
        NavigationMap.scrollToElement(NavigationMap.getCurItem(), {key: 'ArrowDown'});
      }
    },

    setFocusOnMonthView: function(date) {
      var curDate = date;
      var curControl = getCurControl();
      var index = 0;
      var target = "d-" + curDate.getFullYear() + "-" + curDate.getMonth() + "-" + curDate.getDate();
      if (curControl.elements && curControl.elements.length > 0) {
        var items = curControl.elements;
        for (var i = 0; i < items.length; i++) {
          if (items[i].dataset.date === target) {
            index = i;
            break;
          }
        }
      }
      NavigationMap.setFocus(index);
    },

    setCustomWeekFocus: function(type) {
      switch (type) {
        case "current-date":
          if ('eventStartHour' in window.history.state && window.history.state.eventStartHour != undefined) {
            var hour = window.history.state.eventStartHour;
            var weekTitles = document.querySelectorAll("#week-view .md__sticky .md__alldays > [aria-hidden=false]");
            for (var i = 0; i < weekTitles.length; i++) {
              var weekTitleDate = new Date(weekTitles[i].dataset.date);
              var currentdate = new Date();
              if (weekTitleDate.getDate() === currentdate.getDate()) {
                NavigationMap.setFocus(i + 7 * (hour + 1));
              }
            }
          } else {
            var curIndex = NavigationMap.getCurIndex();
            if (curIndex % 7 !== 0) {
              NavigationMap.setFocus(curIndex - (curIndex % 7));
            }
          }
          break;
        case "go-to-date":
          var index = NavigationMap.getCurIndex();
          NavigationMap.setFocus(index - (index % 7));
          break;
        case "onactive":
          var weekTitles = document.querySelectorAll("#week-view .md__sticky .md__alldays > [aria-hidden=false]");
          let focusIndex;
          for (var i = 0; i < weekTitles.length; i++) {
            var weekTitleDate = new Date(weekTitles[i].dataset.date);
            if (weekTitleDate.getDate() === NavigationMap._customWeekFocus.targetDate.getDate()) {
              var currentdate = new Date();
              if (NavigationMap._customWeekFocus.targetDate.getDate() == currentdate.getDate()) {
                focusIndex = (isRtl ? 6 - i : i) + 7 * (currentdate.getHours() + 1);
                NavigationMap.setFocus(focusIndex);
              } else {
                focusIndex = (isRtl ? 6 - i : i);
                NavigationMap.setFocus(focusIndex);
              }
            }
          }
          break;
      }
      NavigationMap._customWeekFocus.enable = false;
      NavigationMap._customWeekFocus.type = "";
    },

    setMultiResetValue: function(value) {
      setMultiReset(value);
    },

    getFocusIndexOfDayView: function(curControl, hour) {
      var index = 0;
      var targetItem = document.querySelector(".md__hour-" + hour + " .focusable");
      if (curControl.elements && curControl.elements.length > 0) {
        var items = curControl.elements;
        for (var i = 0; i < items.length; i++) {
          if (items[i] === targetItem) {
            index = i;
          }
        }
      }
      return index;
    }
  };

  exports.NavigationMap = NavigationMap;

})(window);
