import React from 'react';
import BaseComponent from './base-component';
import SoftKeyStore from './soft-key-store';
import './react-soft-key.scss';

function Button(props) {
  let content = props.content ? {
    'data-icon': props.content.icon,
    'data-l10n-id': props.content.text
  } : null;

  return (
    <button
      id={`software-keys-${props.pos}`}
      className="sk-button"
      data-position={props.pos}
      {...content}
    >
    </button>
  );
}

export default class SoftKey extends BaseComponent {
  constructor(props) {
    super(props);
    this.state = {
      left: props.left || '',
      center: props.center || '',
      right: props.right || ''
    };

    this.setRef = this.setRef.bind(this);
    this.softkeys = ['left', 'right', 'center'];
  }

  componentDidMount() {
    SoftKeyStore.on('change', (e) => {
      let keys = SoftKeyStore.currentKeys;
      this.softkeys.forEach((k) => {
        // uniform new & old syntax
        keys[k] = this.uniformContent(keys[k] || '');
      });
      this.setState(keys);
    });
  }

  componentWillUpdate(nextProps, nextState) {
    let buttons = Array.from(this.element.getElementsByTagName('button'));
    buttons.forEach((button) => {
      if (!nextState[button.dataset.position].text) {
        // Remove old l10n if the next l10n id is empty.
        button.textContent = '';
      }
    });
  }

  uniformContent(content) {
    if ('string' === typeof content) {
      if (content.startsWith('icon=')) {
        content = {
          icon: content.replace('icon=', '')
        };
      } else {
        content = {
          text: content
        };
      }
    }
    return content;
  }

  setRef(el) {
    this.element = el;
  }

  render() {
    return (
      <form
        className="skbar none-paddings visible focused"
        id="softkeyPanel"
        data-type="action"
        ref={this.setRef}
      >
        <Button pos="left" content={this.state.left} />
        <Button pos="center" content={this.state.center} />
        <Button pos="right" content={this.state.right} />
      </form>
    );
  }
}
