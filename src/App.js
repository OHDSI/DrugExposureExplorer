import React, { Component } from 'react';
//import logo from './logo.svg';
import './App.css';
import _ from 'supergroup';
import {RollupListContainer} from './DrugRollupStats';
//import * as util from './ohdsi.util';
import { PageHeader } from 'react-bootstrap';

class App extends Component {
  render() {
    return (
      <div>
        <PageHeader>Drug Utilization Viz
          <small></small>
        </PageHeader>
        <RollupListContainer/>
      </div>
    );
  }
}

export default App;
