/*
Copyright 2016 Sigfried Gold

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
const DEBUG = true;
import React, { Component } from 'react';
import { Button, Panel, Modal, Checkbox, 
          OverlayTrigger, Tooltip,
          FormGroup, Radio } from 'react-bootstrap';

import _ from 'supergroup';
var d3 = require('d3');
//var d3tip = require('d3-tip');
if (DEBUG) window.d3 = d3;
import * as util from './utils';
import DataTable from './components/FixedDataTableSortFilt';
import {DistSeriesContainer} from './components/DistCharts';
import {SparkBarsChart} from './components/SparkBars';
import {ExposureExplorer} from './components/ExposureExplorer';

var commify = d3.format(',');
export class RollupListContainer extends Component {
  constructor(props) {
    super(props);
    this.state = { rollups: [] };
  }
  componentDidMount() {
    window.util = util;
    util.cachedJsonFetch('http://0.0.0.0:3000/api/DrugRollupStats')
      .then(function(json) {
        let rollups = this.dataPrep(json);
        this.setState({rollups});
      }.bind(this))
  }
  dataPrep(json) {
    let recs = json.map(
      record => {
        let rec = Object.assign({}, record);
        rec.avgExposureDays = parseFloat(rec.avgExposureDays);
        rec.avgGapDays = parseFloat(rec.avgGapDays);
        rec.avgGapDaysPct = parseFloat(rec.avgGapDaysPct);
        rec.expCount = parseFloat(rec.expCount);
        rec.maxGapDays = parseFloat(rec.maxGapDays);
        rec.maxGapDaysPct = parseFloat(rec.maxGapDaysPct);
        rec.minGapDays = parseFloat(rec.minGapDays);
        rec.minGapDaysPct = parseFloat(rec.minGapDaysPct);
        rec.personCount = parseFloat(rec.personCount);
        return rec;
      }
    );
    let rollups = 
      _.supergroup(recs, 
        ['rollupClass','rollupConceptName','gapDaysNtile']);
    return rollups;
  }
  render() {
    return <RollupList rollups={this.state.rollups} />
  }
}
export class RollupList extends Component {
  constructor(props) {
    super(props);
  }
  render() {
    const {rollups} = this.props;
    return (
      <div className="drugrollup">
          {rollups.map(rollup =>
              <RollupTable key={rollup.toString()} rollup={rollup} />
            )}
      </div>
    );
  }
}

export class RollupTable extends Component {
  constructor(props) {
    super(props);
    this.state = {
      open: true,
    };
  }
  render() {
    var {rollup} = this.props;
    var {concept, concept_id} = this.state;
    let conceptSummary = '';
    const coldefs = [
      {
        title: 'Concept (drug or class)',
        name: 'Concept',
        accessor: d => d.toString(),
        colProps: {fixed:true, width:100,flexGrow:1},
        searchable: true, sortable: true,
        defaultSortDir: 'DESC',
      },
      {
        title: 'Patients',
        accessor: d => d.aggregate(_.sum,'personCount'),
        fmtAccessor: function(d) {
          return commify(this.accessor(d));
        },
        colProps: {fixed:true, width:90,align:'right'},
        sortable: true,
      },
      {
        title: 'Avg exposures/person',
        accessor: d=> Math.round(
                        d.aggregate(_.sum,'expCount') /
                        d.aggregate(_.sum,'personCount')
                        * 100) / 100,
        colProps: {fixed:true, width:190,align:'right'},
        sortable: true,
      },
      {
        title: '',
        accessor: () => '',
        colProps: {fixed:true, width:20}, // right edge looks weird otherwise
              // surely must be a better way to fix
      },
    ];
    const tableProps = {
      rowHeight: 25,
      headerHeight: 55,
      width: 1000,
      height: 200,
    };
    return (
      <div className="rollup-table">
        <Button onClick={ ()=> this.setState({ open: !this.state.open })}>
          {rollup.toString()}
        </Button>
        <Panel collapsible expanded={this.state.open}>
          <br />
          <DataTable  _key={rollup.toString()}
                      data={rollup.children}
                      coldefs={coldefs}
                      tableProps={tableProps}
                      tableHeadFunc={
                        (datalist) => {
                          return <span>{datalist.getSize()} rows</span>;
                      }}
                      _onRowClick={
                        (evt, idx, obj, datalist)=>{
                          let concept = datalist.getObjectAt(idx);
                          let concept_id = concept.records[0].rollupConceptId;
                          this.setState({concept, concept_id});
                        }}
          />
          <ExposureExplorer
            concept={concept}
            concept_id={concept_id}
          />
        </Panel>
      </div>
    );
  }
}

export class ConceptSummary extends Component {
  render() {
    const {concept, concept_id} = this.props;
    return (
      <div>
        concept_id: {concept_id}<br/>
        {commify(concept.aggregate(_.sum, 'personCount'))} patients,
        {commify(concept.aggregate(_.sum, 'expCount'))} exposures,
        <SparkBarsChart
            things={concept.children}
            width={150}
            height={100} 
            valFunc={ntile=> {
              if (ntile.records.length !== 1)
                console.error('expected a single record');
              return ntile.records[0].avgGapDays;
            }}
            sortBy={ntile=>ntile.valueOf()}
            />
      </div>
    );
  }
}
