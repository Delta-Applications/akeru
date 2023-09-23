import React from 'react';
import ReactDOM from 'react-dom';
import BaseComponent from './base-component';
import SoftKeyStore from './soft-key-store';
import SimpleNavigationHelper from './simple-navigation-helper';
import './react-option-menu.scss';

export default class OptionMenu extends BaseComponent {
  name = 'OptionMenu';

  FOCUS_SELECTOR = '.menu-item';

  constructor(props) {
    super(props);
    this.state = {
      header: '',
      options: [],
      onCancel: () => {}
    };
  }

  componentDidMount() {
    this.element = ReactDOM.findDOMNode(this);
    this.navigator = new SimpleNavigationHelper(this.FOCUS_SELECTOR, this.element);
    let needFocusEl = this.element.querySelector('[data-index="0"]');
    if (needFocusEl) {
      this.navigator.setFocus(needFocusEl);
    }
    this.updateSoftKeys();
  }

  componentWillUnmount() {
    this.navigator.destroy();
    this.unregisterSoftKeys();
    this.element = null;
  }

  componentDidUpdate() {
    let needFocusEl = this.element.querySelector('[data-index="0"]');
    if (needFocusEl) {
      this.navigator.setFocus(needFocusEl);
    }
    if (this.isActive() && document.activeElement === document.body) {
      // this.focus();
    }
  }

  componentWillUpdate() {
    let needFocusEl = this.element.querySelector('[data-index="0"]');
    if (needFocusEl) {
      this.navigator.setFocus(needFocusEl);
    }
  }

  unregisterSoftKeys() {
    SoftKeyStore.unregister(this.element);
  }

  updateSoftKeys() {
  
    let aa = {
      'left': this.state.hasCancel ? 'cancel' : '',
      'center': 'select',
      'right': ''
    }
    SoftKeyStore.register(aa, document);
  }

  clear() {
    this.setState({
      header: '',
      options: [],
      onCancel: () => {}
    });
  }

  show(options) {
    this.clear();
    this.setState(options, () => {
      this.updateSoftKeys();
    });
    super.show();
  }

  onKeyDown(evt) {
    var target = evt.target;
    var key = evt.key;
    var next = null;

    switch (key) {
      case 'Enter':
        evt.stopPropagation();
        evt.preventDefault();
        var option = this.state.options[+evt.target.dataset.index];
        option && option.callback && option.callback();
        this.hide();
        break;
      case 'ArrowUp':
        evt.stopPropagation();
        evt.preventDefault();
        next = this.navigator.findPrev();
        break;
      case 'ArrowDown':
        evt.stopPropagation();
        evt.preventDefault();
        next = this.navigator.findNext();
        break;
      case 'SoftLeft':
        if (!this.state.hasCancel) {
          break;
        }
      case 'BrowserBack':
      case 'Backspace':
        evt.stopPropagation();
        evt.preventDefault();
        this.state.onCancel && this.state.onCancel();
        this.hide();
        break;
    }
    if (next) {
      next.scrollIntoView(false);
      next.focus();
    }
  }

  render() {
    var options = [];
    this.state.options.forEach((option, index) => {
      var img = '';
      if (option.icon) {
        img = <img src={option.icon} className="icon" />;
      }
      let classInfo = 'content' + (option.checked ? ' checked' : '');
      options.push(
        <div
          key={'option-' + index}
          tabIndex="-1"
          data-index={index}
          className="menu-item p-pri">
          {img}
          <div
            className={classInfo}
            data-l10n-id={option.id || ''}
            data-l10n-args={option.l10nArgs || null}
            data-icon={option.dataicon || ''}>
            {option.label || ''}
          </div>
        </div>
      );
    });

    let _className = 'option-menu-container';
    if (this.state.customClass) {
      _className += ` ${_className}--${this.state.customClass}`;
    }

    return (
      <div
        tabIndex="-1"
        role="heading"
        aria-labelledby="option-menu-header"
        className={_className}
        onKeyDown={(e) => this.onKeyDown(e)}>
        <div className="option-menu">
          <div
            id="option-menu-header"
            className="header h1"
            key="translated-header"
            data-l10n-id={this.state.header || 'options'}>
          </div>
          <div className="content p-ul">
            {this.props.children || options}
          </div>
        </div>
      </div>
    );
  }
}
