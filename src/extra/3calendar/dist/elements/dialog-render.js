import React from 'react';
import Service from './service';
import BaseComponent from './base-component';
import ReactDialog from './react-dialog';

class DialogRender extends BaseComponent {
  dialog;
  constructor(props) {
    super(props);
    this.dialog = React.createRef();
    this.state = {
      dialog: false,
      options: null
    };
    Service.register('showDialog', this);
  }

  showDialog(options) {
    this.setState({
      dialog: true,
      options: options
    }, () => {
      this.dialog.current.show();
    });
  }

  componentDidMount() {
    // this.dialog.on('closed', () => {
    //   Service.request('focus');
    // });
  }

  render() {
    return (
      <div id="dialog-root" className={this.state.dialog ? 'p-pri' : 'p-pri hidden'}>
        <ReactDialog ref={this.dialog} {...this.state.options} />
      </div>
    );
  }
}

export default DialogRender;
