/* (c) 2017 KAI OS TECHNOLOGIES (HONG KONG) LIMITED All rights reserved. This
 * file or any portion thereof may not be reproduced or used in any manner
 * whatsoever without the express written permission of KAI OS TECHNOLOGIES
 * (HONG KONG) LIMITED. KaiOS is the trademark of KAI OS TECHNOLOGIES (HONG KONG)
 * LIMITED or its affiliate company and may be registered in some jurisdictions.
 * All other trademarks are the property of their respective owners. */

import React from 'react';
import BaseComponent from './base-component';
import OptionMenu from './react-option-menu';
import Service from './service';

export default class OptionMenuRenderer extends BaseComponent {
  constructor(props) {
    super(props);
    this.state = {
      menu: false,
      options: null
    };
    Service.register('showOptionMenu', this);
    Service.registerState('isShowOptionMenu', this);
  }

  showOptionMenu(options) {
    this.setState({
      menu: true,
      options: options
    });
  }

  isShowOptionMenu() {
    const { menu } = this.state;
    return menu;
  }

  componentDidUpdate() {
    if (!this.menu) {
      Service.request('focus');
    } else {
      this.menu.show(this.state.options);
      this.menu.on('closed', (e) => {
        this.setState({
          menu: false
        });
        Service.request('optionClosed')
      });
    }
  }

  render() {
    return (
      <div id="menu-root">
        {this.state.menu ? <OptionMenu ref={(ref) => { this.menu = ref; }}/> : null}
      </div>
    );
  }
}
