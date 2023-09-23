import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import BaseComponent from './base-component';
import SoftKeyStore from './soft-key-store';
import Service from './service';
import './react-dialog.scss';

let id = 0;

export default class Dialog extends BaseComponent {
  name = 'Dialog';

  static defaultProps = {
    header: '',
    content: '',
    type: 'confirm',
    inputType: 'text',
    ok: '',
    cancel: '',
    onOk: null,
    onBack: null,
    onCancel: null,
    translated: false,
    buttons: [],
    showCheckbox: false,
    checkboxCheckedByDefault: false,
    checkboxMessage: '',
    placeholder: '',
    initialValue: '',
    progressValue: '',
    progressMax: '',
    noClose: false,
    noFocus: false,
    hideCancel: false
  };

  static propTypes = {
    header: PropTypes.string,
    content: PropTypes.string,
    type: PropTypes.string,
    inputType: PropTypes.string,
    ok: PropTypes.string,
    cancel: PropTypes.string,
    onOk: PropTypes.func,
    onBack: PropTypes.func,
    onCancel: PropTypes.func,
    translated: PropTypes.bool,
    buttons: PropTypes.array,
    showCheckbox: PropTypes.bool,
    checkboxCheckedByDefault: PropTypes.bool,
    checkboxMessage: PropTypes.string,
    placeholder: PropTypes.string,
    initialValue: PropTypes.string,
    progressValue: PropTypes.string,
    progressMax: PropTypes.string
  };

  // dialogContent;
  constructor(props) {
    super(props);
    this.dialogContent = React.createRef();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.type === 'prompt') {
      ReactDOM.findDOMNode(this.refs.input).value = this.props.initialValue || '';
    }
  };

  componentDidMount() {
    this.element = ReactDOM.findDOMNode(this);
    this.content = this.element.querySelector('.content');
    Service.register('show', this);
    Service.register('hide', this);
    this.updateSoftKeys();
  };

  scrollContent(direction) {
    if (!this.content) {
      return;
    }
    var maxOffset = this.content.scrollHeight - this.content.clientHeight;
    if((this.content.scrollTop == 0 && direction < 0)
      ||(this.content.scrollTop == maxOffset && direction > 0)){
      return false;
    } else {
      var scorlloffset ;
      var distance = this.content.clientHeight - 41;
      if (direction > 0) {
        scorlloffset= this.content.scrollTop +  distance;
      } else if (direction < 0){
        scorlloffset= this.content.scrollTop -  distance;
      }

      if (scorlloffset < 0) {
        scorlloffset = 0;
      } else if (scorlloffset > maxOffset){
        scorlloffset = maxOffset;
      }
      this.content.scrollTo(0, scorlloffset);
      return true;
    }
  }

  updateSoftKeys() {
    if (this.props.type !== 'custom') {
      if (this.props.type === 'alert') {
        SoftKeyStore.register({
          left: '',
          center: 'ok',
          right: ''
        }, ReactDOM.findDOMNode(this));
      } else if ('progress' === this.props.type) {
        SoftKeyStore.register({
          left: this.props.hideCancel ? '' : (this.props.cancel || 'cancel'),
          center: '',
          right: ''
        }, ReactDOM.findDOMNode(this));
      } else {
        SoftKeyStore.register({
          left: this.props.cancel || 'cancel',
          center: '',
          right: this.props.ok || 'ok'
        }, ReactDOM.findDOMNode(this));
      }
    } else {
      var buttons = this.props.buttons;
      if (buttons.length === 3) {
        if (this.props.type !== 'alert') {
          SoftKeyStore.register({
            left: buttons[0].message,
            center: buttons[1].message,
            right: buttons[2].message
          }, ReactDOM.findDOMNode(this));
        } else {
          SoftKeyStore.register({
            left: '',
            center: 'ok',
            right: ''
          }, ReactDOM.findDOMNode(this));
        }
      } else if (buttons.length === 2) {
        SoftKeyStore.register({
          left: buttons[0].message,
          center: '',
          right: buttons[1].message
        }, ReactDOM.findDOMNode(this));
        SoftKeyStore.register({
          center: ReactDOM.findDOMNode(this.refs.checkbox).dataset.icon === 'check-on' ? 'off' : 'on'
        }, ReactDOM.findDOMNode(this.refs.checkboxContainer));
      } else if (buttons.length === 1) {
        SoftKeyStore.register({
          left: '',
          center: buttons[0].message,
          right: ''
        }, ReactDOM.findDOMNode(this));
      }
    }
  }

  focus() {
    this.focusIfPossible();
    this.updateSoftKeys();
  }

  focusIfPossible() {
    if (this.isHidden()) {
      return;
    }
    if (this.props.type === 'custom' && this.refs.checkboxContainer) {
      ReactDOM.findDOMNode(this.refs.checkboxContainer).focus();
    } else if (this.props.type === 'prompt') {
      ReactDOM.findDOMNode(this.refs.input).focus();
    } else if (!this.props.noFocus) {
      const dialogContent =
        document.querySelector('.dialog-container .content');
      if (dialogContent) {
        // For ally
        // ReactDOM.findDOMNode(this.dialogContent).focus();
        dialogContent.focus();
      } else {
        this.element.focus();
      }
    }
  };

  hide() {
    if (this.props.type === 'prompt') {
      ReactDOM.findDOMNode(this.refs.input).value = this.props.initialValue || '';
    }
    super.hide();
    Service.request('focus');
    Service.request('hideDialog');
  }

  getInstanceID() {
    if (!this._id) {
      this._id = id;
      id++;
    }
    return this._id;
  }

  onKeyDown(evt) {
    var target = evt.target;
    var next = null;
    var key = evt.key;
    var handled = false;
    switch (key) {
      case 'ArrowDown':    
        evt.stopPropagation();
        evt.preventDefault();
        this.scrollContent(1);
        break;
      case 'ArrowUp':
        evt.stopPropagation();
        evt.preventDefault();
        this.scrollContent(-1);
        break;
      case 'Enter':
        evt.stopPropagation();
        evt.preventDefault();
        if (this.props.type === 'custom') {
          if (this.props.buttons.length === 3) {
            var value = {
              selectedButton: 1
            };
            if (this.props.showCheckbox) {
              var icon = ReactDOM.findDOMNode(this.refs.checkbox).dataset.icon;
              value.checked = icon === 'check-on' ? true : false;
            }
            this.props.onOk && this.props.onOk(value);
            if (!this.props.noClose) {
              this.hide();
            }
          } else {
            if (this.props.showCheckbox &&
                document.activeElement === ReactDOM.findDOMNode(this.refs.checkboxContainer)) {
              var icon = ReactDOM.findDOMNode(this.refs.checkbox).dataset.icon;
              ReactDOM.findDOMNode(this.refs.checkbox).dataset.icon =
                icon === 'check-on' ? 'check-off' : 'check-on';
              this.updateSoftKeys();
            }
          }
        } else if (this.props.type === 'alert') {
          this.props.onOk && this.props.onOk();
          if (!this.props.noClose) {
            this.hide();
          }
        }
        break;
      case 'F1':
      case 'SoftLeft':
        evt.stopPropagation();
        evt.preventDefault();
        if (this.props.type === 'custom') {
          var value = {
            selectedButton: 0
          };
          if (this.props.showCheckbox) {
            value.checked = ReactDOM.findDOMNode(this.refs.checkbox).dataset.icon === 'check-on' ? true : false;
          }
          this.props.onOk && this.props.onOk(value);
        } else if (this.props.type !== 'alert') {
          if (this.props.hideCancel) {
            return;
          }
          this.props.onCancel && this.props.onCancel();
        }
        if (this.props.type !== 'alert') {
          this.hide();
        }
        break;
      case 'F2':
      case 'SoftRight':
        evt.stopPropagation();
        evt.preventDefault();
        if (this.props.hideCancel) {
          return;
        }
        if (this.props.type === 'custom') {
          var value = {
            selectedButton: this.props.buttons.length === 3 ? 2 : 1
          };
          if (this.props.showCheckbox) {
            value.checked = ReactDOM.findDOMNode(this.refs.checkbox).checked;
          }
          this.props.onOk && this.props.onOk(value);
        } else if (this.props.type === 'prompt') {
          this.props.onOk && this.props.onOk(ReactDOM.findDOMNode(this.refs.input).value);
        } else if (this.props.type === 'confirm') {
          this.props.onOk && this.props.onOk();
        }
        if (!this.props.noClose && this.props.type !== 'alert') {
          this.hide();
        }
        break;
      case 'BrowserBack':
      case 'Backspace':
      case 'EndCall':
        if ('INPUT' === document.activeElement.tagName && document.activeElement.value) {
          return;
        }
        evt.stopPropagation();
        evt.preventDefault();
        if (this.props.hideCancel) {
          return;
        }
        this.props.onBack && this.props.onBack();
        this.hide();
        break;
    }
  }

  render() {
    var header = '';
    if (this.props.header) {
      header = this.props.translated ?
                <div className="header h1" key="no-translated-header"
                     id={'dialog-header-' + this.getInstanceID()}>{this.props.header}</div> :
                <div className="header h1" key="translated-header" data-l10n-id={this.props.header}
                     id={'dialog-header-' + this.getInstanceID()}></div>;
    }
    return <div className="dialog-container" tabIndex="-1" onKeyDown={(e) => this.onKeyDown(e)}>
              <div role="heading" className="dialog" aria-labelledby={'dialog-header-' + this.getInstanceID()}>
                {header}
                {this.props.children ||
                  <div className="content p-ul" ref={this.dialogContent} tabIndex="-1">
                    {
                      this.props.translated ? this.props.content : <div data-l10n-id={this.props.content} />
                    }
                    {
                      this.props.type === 'prompt'
                        ? <input ref="input" type={this.props.inputType} className="primary" placeholder={this.props.placeholder}
                          defaultValue={this.props.initialValue} />
                        : ''
                    }
                    {
                      (this.props.type === 'custom' && this.props.showCheckbox) ?
                        <div tabIndex="-1" ref="checkboxContainer"><i ref="checkbox" data-icon={this.props.checkboxCheckedByDefault ? 'check-on' : 'check-off'} /><span>{this.props.checkboxMessage}</span></div> : ''
                    }
                    {
                      'progress' === this.props.type ?
                      <div>
                        <p>{this.props.progressValue}/{this.props.progressMax}</p>
                        <progress value={this.props.progressValue} max={this.props.progressMax} />
                      </div>
                      : ''
                    }
                  </div>
                }
              </div>
           </div>
  }
}
