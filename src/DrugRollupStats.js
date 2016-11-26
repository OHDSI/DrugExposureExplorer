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
      /*
      .catch(function(ex) {
        console.error('parsing failed', ex)
      });
      */
  }
  /*
  setContainerState(obj) {
    this.setState(obj);
  }
  */
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
  /*
  render() {
    var children = React.Children.map(this.props.children, 
          (child) => React.cloneElement(child, { 
            containerState: this.state,
            setContainerState: this.setContainerState.bind(this),
          }));
    return (
      <div>
        this is the container
        {children}
      </div>
    );
  }
  */
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
  /*
  getExposureExplorer() {
    const {concept, modalWidth, noEras, maxgap} = this.state;
    if (concept && modalWidth) {
      let concept_id = concept.records[0].rollupConceptId;
      return <ExposureExplorer 
                width={modalWidth}
                noEras={noEras}
                maxgap={maxgap}
                concept={concept} 
                concept_id={concept_id}/>;
    }
    return <h3>no concept detail</h3>;
  }
  */
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
  /*
  render() {
    const {rollup} = this.props;
    return (
      <span style={{marginLeft: 10}}>
        Concepts: {rollup.children.length}
      </span>
    );
  }
  */
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
/*
export class TimeDist extends Component {
  constructor(props) {
    super(props);
    this.state = { 
    };
  }
  componentWillMount() {
    const {width, height, numbers, n, maxCnt} = this.props;
    const timeDistWidth = 300;
    let lo = new util.SvgLayout(
          width, height,
          { top: { margin: { size: 2}, },
            bottom: { margin: { size: 20}, },
            left: { margin: { size: 55}, },
            right: { margin: { size: 5}, },
          });
    let x = d3.scaleLinear()
              .range([0, lo.chartWidth()])
              .domain([_.min([_.min(numbers), 0]), _.max(numbers)]);
    let xAxis = d3.axisBottom()
                .scale(x)
    let y = d3.scaleLinear()
              .range([0,lo.chartHeight() * n / maxCnt])
              .domain([0, maxCnt])
    let yAxis = d3.axisLeft()
                .scale(y)

    this.setState({
      lo, x, xAxis, y, yAxis
    });
  }
  componentDidMount() {
    const {lo, x, xAxis, y, yAxis} = this.state;
    let node = this.refs.timedistdiv;
    d3.select(node).select('svg>g.x-axis').call(xAxis);
    d3.select(node).select('svg>g.y-axis').call(yAxis);

  }
  render() {
    const {numbers, n, maxCnt} = this.props;
    const {lo, x, xAxis, y, yAxis} = this.state;
    //if (!lo) return <div>just a second...</div>;
    let bars = numbers.map((num,i) => {
      return <line  key={i}
                    x1={x(0)} y1={y(1 + i)} 
                    x2={x(num)} y2={y(1 + i)} 
                    className="bar" />;
    });
    return (<div ref="timedistdiv" className="timedist">
              <svg 
                    width={lo.w()} 
                    height={lo.h()}>
                <g className="x-axis"
                    transform={
                      `translate(${lo.zone('left')},${lo.h() - lo.zone('bottom')})`
                    } />
                <g className="y-axis"
                    transform={
                      `translate(${lo.zone('left')},${lo.zone('top')})`
                    } />
                <rect x={1} y={1} width={lo.chartWidth()} height={lo.chartHeight()} />
                <line x1={x(0)} y1={0} x2={x(0)} y2={lo.chartHeight()} className="zero"/>
                <g className="timedist"
                    transform={
                      `translate(${lo.zone('left')},${lo.zone('top')})`
                    }>
                </g>
                  {bars}
              </svg>
            </div>);
  }
}
*/
/*
  componentDidUpdate(prevProps, prevState) {
    const {concept} = this.state;
      if (this.state.personId) {
        util.cachedFetch(
          'http://localhost:3000/api/eras/postCall',
          {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              maxgap: this.state.maxgap,
              concept_id: this.state.concept_id,
              personid: this.state.personId
            })
          })
          .then(function(json) {
            let recs = json.map( rec => {
                rec.avg = parseFloat(rec.avg);
                rec.count = parseFloat(rec.count);
                rec.exp_or_gap_num = parseFloat(rec.exp_or_gap_num);
                return rec;
              }
            );
            var gaps = _.sortBy(recs, 'avg');
            this.setState({gaps});
          }.bind(this))
          .catch(function(ex) {
            console.error('parsing failed', ex)
          });
      }
    }
  }
  */


