import React, { Component } from 'react';
//import logo from './logo.svg';
import './App.css';
import _ from 'supergroup';
import {RollupListContainer} from './DrugRollupStats';
//import * as util from './ohdsi.util';

class App extends Component {
  render() {
    return (
      <div>
				<RollupListContainer/>
      </div>
    );
  }
}

export default App;
