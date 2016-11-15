import React, { Component } from 'react';
//import logo from './logo.svg';
import './App.css';
import _ from 'supergroup';
import {DrugRollupContainer, RollupList, RollupStats} from './DrugRollupStats';
import ReactTooltip from 'react-tooltip';

class App extends Component {
  render() {
    return (
      <div className="App">
        <div className="App-header">
          <h2>Drug Rollup Stats</h2>
        </div>
        <div className="App-intro">
					<DrugRollupContainer>
						<RollupList  />
						<RollupStats  />
					</DrugRollupContainer>
					<ReactTooltip id='sparkbar' 
						getContent={() => {
							console.log('tooltip',arguments);
							return 'blah blah';
						} }/>
					
        </div>
      </div>
    );
  }
}

export default App;
