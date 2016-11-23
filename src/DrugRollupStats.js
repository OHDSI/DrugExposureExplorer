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
import {SparkBarsChart} from './components/SparkBars';

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
    this.state = { rollup: null };
  }
  render() {
    const {rollups} = this.props;
    const {rollup} = this.state;
    if (!rollup) { // show all rollups
      /*  opens DrugList -- not used at the moment
                <a href="#" style={{cursor:'pointer'}} 
                    onClick={()=>this.setState({rollup})}>{rollup.toString()}</a>
      */
      return (
        <div className="drugrollup">
            {rollups.map(rollup =>
                <RollupTable key={rollup.toString()} rollup={rollup} />
              )}
        </div>
      );
    } else { // already picked a rollup
      return (
        <div>
          {rollup.toString()}
          <button onClick={()=>this.setState({rollup:null })}>Clear rollup selection</button>
          <DrugList rollup={rollup} />
        </div>
      );
    }
  }
}


export class RollupTable extends Component {
  constructor(props) {
    super(props);
    //this.dataList = props.rollup.children;
    //this._dataList = new DumbStore(props.rollup.children);
    this.state = {
      open: true,
      showModal: false,
      concept: null,
      noEras: false,
      maxgap: 30,
    };
  }
  closeModal() {
    this.setState({ showModal: false });
  }
  openModal() {
    this.setState({ showModal: true });
  }

  getConceptDetail() {
    const {concept, modalWidth, noEras, maxgap} = this.state;
    if (concept && modalWidth) {
      let conceptId = concept.records[0].rollupConceptId;
      return <ConceptDetail 
                width={modalWidth}
                noEras={noEras}
                maxgap={maxgap}
                concept={concept} 
                conceptId={conceptId}/>;
    }
    return <h3>no concept detail</h3>;
  }
  render() {
    var {rollup} = this.props;
    var {concept, noEras, maxgap} = this.state;
    let conceptSummary = '';
    let conceptDetail = '';
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
        <Modal bsSize="lg"
            show={this.state.showModal} 
            onHide={this.closeModal.bind(this)}
            onEntered={(() => {
              let { clientWidth } = this.refs.modalBody;
              if (this.state.modalWidth !== clientWidth)
                this.setState({modalWidth:clientWidth});
            })}
            >
          <Modal.Header closeButton>
            <Modal.Title>{concept && concept.toString()}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Checkbox onChange={()=>this.setState({noEras:!this.state.noEras})} inline={false}>
              Raw exposures only
            </Checkbox>
            <label>Combine exposures to era with gap of no more than
              &nbsp;
              <input type="number" value={this.state.maxgap}
                placeholder="Max gap days"
                onChange={evt=>{
                  this.setState({maxgap:evt.target.value})
                }} />
            </label>
            <div ref="modalBody">
              {this.getConceptDetail()}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.closeModal.bind(this)}>Close</Button>
          </Modal.Footer>
        </Modal>
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
                          this.openModal(); //THIS!!!! fix
                          this.setState({concept});
                        }}
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

export class DrugList extends Component {
  constructor(props) {
    super(props);
    this.state = { concept: null };
  }
  render() {
    const {rollup} = this.props;
    const {concept} = this.state;
    if (!concept) { // show all concepts in list
      let concepts = rollup.children.sortBy(d=>-d.aggregate(_.sum, 'personCount'));
      let list = concepts.map(concept => {
        let conceptId = concept.records[0].rollupConceptId;
        return <li key={concept.toString()} >
                  <a href="#" style={{cursor:'pointer'}} 
                    onClick={()=>this.setState({concept})}
                    >{concept.toString()}</a>:
                  <ConceptSummary
                    concept={concept}
                    conceptId={conceptId} />
                </li>;
      });
      return (
        <div className="drugrollup">
          <ul>{list}</ul>
        </div>
      );
    } else { // concept already chosen
      let conceptId = concept.records[0].rollupConceptId;
      return  <div>
                {concept.toString()}:
                <button onClick={()=>this.setState({concept:null })}>Clear concept selection</button>
                <ConceptSummary
                  concept={concept}
                  conceptId={conceptId}
                  />
                <ConceptDetail
                  concept={concept}
                  conceptId={conceptId}
                  />
              </div>;
    }
  }
}

export class ConceptSummary extends Component {
  render() {
    const {concept, conceptId} = this.props;
    return (
      <div>
        conceptId: {conceptId}<br/>
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
export class ConceptDetail extends Component {
  render() {
    const {concept, conceptId, width, noEras, maxgap} = this.props;
    return (<div ref='container' className="concept-detail">
              <SampleTimelinesContainer
                  width={width}
                  noEras={noEras}
                  maxgap={maxgap}
                  concept={concept}
                  conceptId={conceptId} />
              <DistSeriesContainer 
                  concept={concept}
                  conceptId={conceptId} 
                  maxgap={
                    (noEras || (typeof maxgap === "undefined"))
                    ? undefined : maxgap}
              />
            </div>);
  }
}
/* @class DistSeriesContainer
 *  data fetcher for DistSeries, a series of TimeDists
 *  there may be more items in each distribution than
 *  pixels of height to represent each with its own
 *  line, so items are grouped into ntiles.
 *
 *  need to know the number of ntiles for data fetching,
 *  but the number of ntiles needed is the pixel height
 *  of chart area...so, kinda weird. would like to set
 *  display param like height where the chart is 
 *  defined, but can't -- chart height based on ntiles
 *
 */
export class DistSeriesContainer extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      dsgpDist: null,
      ntiles: 120,
    };
  }
  componentDidMount() {
    const {conceptId, maxgap} = this.props;
    this.fetchDists(conceptId, maxgap);
  }
  componentWillReceiveProps(nextProps) {
    const {conceptId, maxgap} = nextProps;
    this.fetchDists(conceptId, maxgap);
  }
  fetchDists(conceptId, maxgap) {
    this.setState({dsgpDist: null});
    let params = {
            ntiles: this.state.ntiles,
            conceptid: conceptId,
          };
    if (typeof maxgap !== "undefined") {
      params.maxgap = parseInt(maxgap, 10);
    }
    util.cachedPostJsonFetch(
      'http://localhost:3000/api/daysupplies/dsgpPost',
      params)
    .then(function(json) {
      let recs = json.map( rec => {
          rec.ds_count = parseInt(rec.ds_count, 10);
          rec.gp_count = parseInt(rec.gp_count, 10);
          rec.exp_num = parseInt(rec.exp_num, 10);
          rec.gap_num = parseInt(rec.gap_num, 10);
          rec.ds_avg = parseFloat(rec.ds_avg);
          rec.gp_avg = parseFloat(rec.gp_avg);
          return rec;
        }
      );
      this.setState({dsgpDist: recs});
    }.bind(this))
    /*
    util.cachedPostJsonFetch(
      'http://localhost:3000/api/daysupplies/postCall',
      params)
    .then(function(json) {
      let recs = json.map( rec => {
          rec.avg = parseFloat(rec.avg);
          rec.count = parseFloat(rec.count);
          rec.exp_or_gap_num = parseFloat(rec.exp_or_gap_num);
          return rec;
        }
      );
      var daysupply = _.sortBy(recs, 'avg');
      this.setState({daysupply});
    }.bind(this))

    params.exp_or_gap = 'gap';
    util.cachedPostJsonFetch(
      'http://localhost:3000/api/daysupplies/postCall',
      params)
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
    */
  }
  render() {
    const {concept, conceptId, maxgap} = this.props;
    const {dsgpDist, ntiles} = this.state;
    if (dsgpDist) {
      return <DistSeries  concept={concept}
                          conceptId={conceptId}
                          ntiles={ntiles}
                          dsgpDist={dsgpDist}
                          maxgap={maxgap}
                          loading={maxgap}
                          />
    } else {
      return <div className="waiting">Waiting for exposure data...</div>;
    }
  }
}
/* @class DistSeries
 *  a series of TimeDists. read description of container above
 *
 *  each line in a TimeDist represents an ntile of data items.
 *  so far, just using ntile avg, but may later use
 *  min and max.
 *
 *  not sure if this component will have more general use, but
 *  writing it for showing days_supply and gap distributions
 *  for 1st, 2nd, 3rd, etc exposures to a drug.
 *
 *  trying to aim at making component general, but for now
 *  it's tied in various ways to specific use case 
 *
 *  1st exposure will always have the largest count, but
 *  for data query simplicity, getting the same number of
 *  ntiles for all exposures, so need to scale the others
 *  appropriately to show the lower counts (maxCnt is 1st
 *  exposure count)
 */
export class DistSeries extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      useFullHeight: false,
      DistChartType: 'DistBars',
      ChartTypes : {
        DistBars, CumulativeDistFunc,
      }
    };
  }
  render() {
    const {dsgpDist, ntiles, maxgap} = this.props;
    const {useFullHeight, DistChartType, ChartTypes} = this.state;
    const maxBars = ntiles; // max in series (1st has max)
    let maxCnt = _.sum( dsgpDist
                  .filter(d=>d.exp_num === 1)
                  .map(d=>d.ds_count));
    let dists = [];
    for (let i=1; i<_.max(dsgpDist.map(d=>d.exp_num)); i++) {
      const distRecs = dsgpDist.filter(d=>d.exp_num === i);
      let ekey = `exp_${i}`;
      dists.push(<ExpGapDist
                    key={ekey}
                    exp_num={i}
                    type={typeof maxgap === "undefined"
                            ? 'Exposure'
                            : 'Era'}
                    distRecs={distRecs}
                    maxCnt={maxCnt}
                    maxBars={maxBars}
                    useFullHeight={useFullHeight}
                    DistChart={ChartTypes[DistChartType]}
                    />);
      /*
      let gkey = `gap_${i}`;
      dists.push(<TimeDist
                    key={gkey}
                    numbers={
                      gaps
                        .filter(d=>d.exp_or_gap_num === i)
                        .map(d=>d.avg)
                    }
                    maxCnt={maxCnt}
                    n={_.sum( gaps
                        .filter(d=>d.exp_or_gap_num === i)
                        .map(d=>d.count)
                        )}
                    width={timeDistWidth}
                    height={timeDistHeight} 
                    />);
      */
    }
    return  <div>
              Gaps and exposure durations for up to {' '}
              {dists.length} {' '}
              {typeof maxgap === "undefined"
                  ? 'raw exposures'
                  : `eras based of max gap of ${maxgap}`}
              <Checkbox onChange={
                          ()=>this.setState({useFullHeight:!this.state.useFullHeight})
                        } inline={false}>
                Use full height
              </Checkbox>
                <Radio inline 
                  checked={DistChartType==='DistBars'}
                  value={'DistBars'}
                  onChange={this.onDistChartChange.bind(this)}
                >
                  Distribution bars (kinda weird, but I like it)
                </Radio>
                {' '}
                <Radio inline
                  checked={DistChartType==='CumulativeDistFunc'}
                  value={'CumulativeDistFunc'}
                  onChange={this.onDistChartChange.bind(this)}
                >
                  Cumulative Distribution Function
                </Radio>
                {' '}
                <Radio inline
                  title="blah blah blah"
                  disabled={true}
                  checked={DistChartType==='DensityEstimation'}
                  //checked={true}
                  value={'DensityEstimation'}
                  onChange={this.onDistChartChange.bind(this)}
                >
                  Density Estimation
                </Radio>
              {dists}
            </div>;
  }
  onDistChartChange(e) {
    this.setState({
      DistChartType: e.currentTarget.value,
    });
  }
}
/* @class ExpGapDist
 *  TimeDist of gap days leading up to days_supply
 *
 *  not sure why counts of gaps and exps don't total
 *  the same, so will probably have to fix this, but for
 *  now treating them as if they do
 *
 */
export class ExpGapDist extends Component {
  constructor(props) {
    super(props);
    this.state = { 
    };
  }
  componentWillMount() {
    const {distRecs, maxBars, maxCnt} = this.props;
    const top = 12, bottom = 17, left = 40, right = 10,
          gapChartWidth = 50, expChartWidth = 80,
          width = gapChartWidth + expChartWidth + left + right,
          height = distRecs.length + top + bottom;
          
    let lo = new util.SvgLayout(
          width, height,
          { top: { margin: { size: top}, },
            bottom: { margin: { size: bottom}, },
            left: { margin: { size: left}, },
            right: { margin: { size: right}, },
          });
    this.setState({ lo, gapChartWidth, expChartWidth, });
  }
  componentDidMount() {
    let {expgapdistdiv} = this.refs;
    this.setState({expgapdistdiv});
  }
  setYScale() {
    const {distRecs, maxBars, maxCnt, exp_num, useFullHeight, DistChart} = this.props;
    const {lo, gapChartWidth, expChartWidth, expgapdistdiv} = this.state;


    const distCnt = _.sum(distRecs.map(d=>d.ds_count));
    let yScaling = distCnt / maxCnt;
    if (useFullHeight) {
      yScaling = 1;
    }
    let yrange = [lo.chartHeight() * yScaling, 0];

    let ydomain = [0, distCnt];

    let y = d3.scaleLinear().domain(ydomain).range(yrange);
    let yAxis = d3.axisLeft()
                .scale(y)
                .ticks(3)
    if (expgapdistdiv) {
      d3.select(expgapdistdiv).select('svg>g.y-axis').call(yAxis);
    }
    ydomain = [0, distRecs.length];
    y.domain(ydomain);
    return y;
  }
  render() {
    const {distRecs, maxBars, maxCnt, 
            exp_num, type, useFullHeight, DistChart} = this.props;
    const {lo, gapChartWidth, expChartWidth, expgapdistdiv} = this.state;

    let expbars = '', gapbars = '';
    let y = this.setYScale();
    if (expgapdistdiv) {
      gapbars = <DistChart
                      distRecs={distRecs}
                      getX={d=>d.gp_avg||0}
                      //barY={d=>d.gp_ntile} ? should it be this???
                      barY={(d,i)=>i}
                      maxCnt={maxCnt}
                      maxBars={maxBars}
                      width={gapChartWidth}
                      y={y}
                      exp_num={exp_num}
                    />;
      expbars = <DistChart
                      distRecs={distRecs}
                      getX={d=>d.ds_avg||0}
                      //barY={d=>d.gp_ntile} ? should it be this???
                      barY={(d,i)=>i}
                      maxCnt={maxCnt}
                      maxBars={maxBars}
                      width={expChartWidth}
                      y={y}
                      exp_num={exp_num}
                    />;
    }
    return (<div ref="expgapdistdiv" className="expgapdist">
              <div>
              <svg 
                    width={lo.w()} 
                    height={lo.h()}>
                <g className="y-axis"
                    transform={
                      `translate(${lo.zone('left')},${lo.zone('top')})`
                    } />
                <g className="gapdist"
                    transform={
                      `translate(${lo.zone('left')},${lo.zone('top')})`
                    }>
                  {gapbars}
                    />
                </g>
                <g className="expdist"
                    transform={
                      `translate(${lo.zone('left') + expChartWidth},${lo.zone('top')})`
                    }>

                  {expbars}
                </g>
              </svg>
              <div>
              {type} {exp_num}
              {exp_num === 1 ? ` (no gap preceding first ${type.toLowerCase()})` : ''}
              </div>
              </div>
            </div>);
                //<rect x={1} y={1} width={lo.chartWidth()} height={lo.chartHeight()} />
                //<line x1={x(0)} y1={0} x2={x(0)} y2={lo.chartHeight()} className="zero"/>
  }
}
export class CumulativeDistFunc extends Component {
  constructor(props) {
    super(props);
    this.state = { };
  }
  componentDidMount() {
    const {distRecs, maxBars, maxCnt, width, getX, y} = this.props;
    let x = d3.scaleLinear()
              .range([0, width])
              .domain([_.min([_.min(distRecs.map(getX)), 0]), _.max(distRecs.map(getX))]);
    let xAxis = d3.axisBottom()
                .ticks(2)
                .scale(x)
    this.setState({ x, });
    let node = this.refs.distbarsg;
    d3.select(node).select('g.x-axis').call(xAxis);


    const cnt = distRecs.length;
    let data = distRecs.map((d,i) => {
      return {
        x: getX(d) * -1,
        //y: (i+1) / cnt,
        y: -i,
      };
    });
    /*
     * getting code from http://bl.ocks.org/jdittmar/6282869
    var dataLength = data.length;
    for (var i = 0; i < dataLength; i++) {
      data[i].x =  +data[i].x*-1;
      data[i].y = +((i+1)/dataLength);
      dataLookup[data[i].orf]=data[i].x;
    };
    */
    x.domain(d3.extent(data, function(d) { return d.x; })).nice();
    y.domain(d3.extent(data, function(d) { return d.y; })).nice();

    var line = d3.line()
        .x(function(d) { return x(d.x); })
        .y(function(d) { return y(d.y); });
    let color = d3.scaleOrdinal()
                        .range(d3.schemeCategory10);

    d3.select(node).append("path")
        .datum(data)
        .attr("class", "line")
        .attr("d", line)
        .style("stroke", function(d) { 
          return color("initial"); 
        });
  }
  render() {
    const {distRecs, maxBars, maxCnt, 
            width, y, getX, exp_num} = this.props;
    const {x, xAxis, } = this.state;


    return ( <g ref="distbarsg">
                <g className="x-axis"
                    transform={
                      `translate(${0},${y.range()[0]})`
                    } />
            </g>);
                //<rect x={1} y={1} width={lo.chartWidth()} height={lo.chartHeight()} />
                //<line x1={x(0)} y1={0} x2={x(0)} y2={lo.chartHeight()} className="zero"/>
  }
}
export class DistBars extends Component {
  constructor(props) {
    super(props);
    this.state = { };
  }
  componentDidMount() {
    const {distRecs, maxBars, maxCnt, width, getX} = this.props;
    let x = d3.scaleLinear()
              .range([0, width])
              .domain([_.min([_.min(distRecs.map(getX)), 0]), _.max(distRecs.map(getX))]);
    let xAxis = d3.axisBottom()
                .ticks(2)
                .scale(x)
    this.setState({ x, });
    let node = this.refs.distbarsg;
    d3.select(node).select('g.x-axis').call(xAxis);

  }
  render() {
    const {distRecs, maxBars, maxCnt, 
            width, y, getX, exp_num} = this.props;
    const {x, xAxis, } = this.state;

    let bars = '';
    if (x) {
      bars = distRecs.map((rec,i) => {
        if (exp_num === 2 && i === 110) {
          console.log(exp_num, getX,
                      i, y(i));
        }
        return <line  key={i}
                      x1={x(0)} y1={y(i)} 
                      x2={x(getX(rec))} y2={y(i)} 
                      className="bar" />;
      });
    }
    return ( <g ref="distbarsg">
                <g className="x-axis"
                    transform={
                      `translate(${0},${y.range()[0]})`
                    } />
                {bars}
            </g>);
                //<rect x={1} y={1} width={lo.chartWidth()} height={lo.chartHeight()} />
                //<line x1={x(0)} y1={0} x2={x(0)} y2={lo.chartHeight()} className="zero"/>
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
export class SampleTimelinesContainer extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      frequentUsers: null,
      howmany: 2,
    };
  }
  componentDidMount() {
    const {conceptId} = this.props;
    const {howmany} = this.state;
    let params = {
          howmany: howmany,
          conceptid: conceptId,
    };
    util.cachedPostJsonFetch(
      'http://localhost:3000/api/People/frequentUsersPost',
      params)
    .then(function(json) {
      this.setState({frequentUsers:json});
    }.bind(this))
  }
  render() {
    const {concept, conceptId, width, noEras, maxgap} = this.props;
    const {frequentUsers} = this.state;
    if (frequentUsers) {
      let timelines = frequentUsers.map(person => {
        let personId = person.person_id;
        return <TimelineContainer   key={personId}
                                    width={width}
                                    concept={concept}
                                    conceptId={conceptId}
                                    noEras={noEras}
                                    maxgap={maxgap}
                                    personId={personId} />
      })
      return <div className="timelines">{timelines}</div>;
    } else {
      return <div className="waiting">Waiting for sample timeline data...</div>;
    }
  }
}
export class TimelineContainer extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      eras: [],
      exposures: [],
      fetchingExposures: false,
      fetchingEras: false,
    };
  }
  componentDidMount() {
    const {noEras, maxgap} = this.props;
    this.fetchEras(noEras, maxgap);
    this.fetchExposures();
  }
  componentWillReceiveProps(nextProps) {
    const {noEras, maxgap} = nextProps;
    this.fetchEras(noEras, maxgap);
    this.fetchExposures();
  }
  fetchExposures() {
    const {personId, conceptId, concept} = this.props;
    this.setState({fetchingExposures:true});
    let params = { conceptid:conceptId,
                   personid: personId };
    util.cachedPostJsonFetch(
      'http://localhost:3000/api/drug_exposure_rollups/postCall',
      params)
    .then(function(json) {
      this.setState({exposures:json, fetchingExposures:false});
    }.bind(this))
  }
  fetchEras(noEras, maxgap) {
    if (noEras) {
      this.setState({eras:[]});
      return;
    }
    const {personId, conceptId, concept} = this.props;
    maxgap = parseInt(maxgap, 10);
    if (isNaN(maxgap)) return;
    this.setState({fetchingEras:true})
    let params = { maxgap,
                   conceptid:conceptId,
                   personid: personId };
    util.cachedPostJsonFetch(
      'http://localhost:3000/api/eras/postCall', params)
    .then(function(json) {
      this.setState({eras:json, fetchingEras:false});
    }.bind(this))
  }
  render() {
    const {exposures, eras, fetchingExposures, fetchingEras} = this.state;
    const {noEras, width, concept, personId} = this.props;
    if( fetchingExposures || fetchingEras ) {
      return (
        <div className="waiting">
          {fetchingExposures ? `Fetching exposures for ${personId} / ${concept.toString()}` : ''}
          {fetchingEras ? `Fetching eras for ${personId} / ${concept.toString()}` : ''}
        </div>);
    } else if (eras.length || (noEras && exposures.length)) {
      return <Timeline exposures={exposures} eras={eras} 
                width={width} 
                concept={concept} personId={personId}/>;
    }
    return <div>Waiting for something to happen</div>;
  }
}
export class Timeline extends Component {
  constructor(props) {
    super(props);
    this.state = { 
    };
  }
  componentDidMount() {
    const {eras, exposures, concept, personId} = this.props;
    let lastday;
    if (eras && eras.length) {
      lastday = _.last(eras).days_from_first_era +
                _.last(eras).era_days;
    } else if (exposures && exposures.length) {
      lastday = _.last(exposures).days_from_first +
                _.last(exposures).days_supply;
    } else {
      throw new Error("why?");
    }
    const height = 40;
    let div = this.refs.timelinediv;
    const css = window.getComputedStyle(div, null);
    const width = div.clientWidth - parseFloat(css.paddingLeft)
                                  - parseFloat(css.paddingRight);
    let lo = new util.SvgLayout(
          width, height,
          { top: { margin: { size: 2}, },
            bottom: { margin: { size: 20}, },
            left: { margin: { size: 5}, },
            right: { margin: { size: 5}, },
          });
    let x = d3.scaleLinear()
              .range([0, lo.chartWidth()])
              .domain([0, lastday]);
    let xAxis = d3.axisBottom()
                .scale(x)
                //.tickFormat(this.chartProp.format)
                //.ticks(this.chartProp.ticks)
                //.orient(this.zone());
    /*
    let tip = d3tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(function(evt) {
        let era = eras[evt.target.attributes.getNamedItem('data-eranum').value];
        return "<strong>Frequency:</strong> <span style='color:red'>" + JSON.stringify(era,null,2) + "</span>";
      })
    */

    let drugList = _.chain(exposures)
                      .map(d=>d.drug_name)
                      .uniq()
                      .sort()
                      .value();
    const seeThroughColors = d3.schemeCategory20
            .map(d => {
              let c = d3.color(d);
              c.opacity = 0.4;
              return c;
            });
    let drugColors = d3.scaleOrdinal()
                        .range(seeThroughColors)
                        .domain(drugList);
    this.setState({
      height,
      lo, x, xAxis, lastday, drugList, drugColors,
    });
  }
  componentDidUpdate() {
    let node = this.refs.timelinediv;
    const {height, lo, x, xAxis} = this.state;
    d3.select(node).select('svg>g.axis').call(xAxis);
    //d3.select(node).select('svg').call(tip);
  }
  render() {
    const {exposures, eras, concept, personId} = this.props;
    const {height, lo, x, xAxis, lastday, drugList, drugColors} = this.state;
    if (!lo) 
      return (<div ref="timelinediv" className="timeline">
                timeline not ready
              </div>);

    //return <pre>{JSON.stringify(eras, null, 2)}</pre>;
    let exposureBars = exposures.map((exposure,i) => {
      const exposurett = (
        <Tooltip id="tooltip-exposure">
          <pre>{JSON.stringify(exposure,null,2)}</pre>
        </Tooltip>
      );
      return (
              <OverlayTrigger 
                  key={i}
                  placement="bottom" overlay={exposurett}>
                <rect  className="exposure"
                    data-expnum={i}
                    x={x(exposure.days_from_first)} 
                    width={x(exposure.days_supply)}
                    y={lo.zone('top') + lo.chartHeight() * .35}
                    height={lo.chartHeight() * .3}
                    fill={drugColors(exposure.drug_name)}
                    />
              </OverlayTrigger>);
    });
    let eraBars = eras.map((era,i) => {
      const eratt = (
        <Tooltip id="tooltip-era">
          Era {era.era_num} combines {era.exposures} exposures
          with {era.total_days_supply} total days supply
          over {era.era_days} days in era.
        </Tooltip>
      );
          //<pre>{JSON.stringify(era,null,2)}</pre>
      return (
              <OverlayTrigger 
                  key={i}
                  placement="bottom" overlay={eratt}>
                <rect  className="era"
                    data-eranum={i}
                    x={x(era.days_from_first_era)} 
                    width={x(era.era_days)}
                    y={lo.zone('top')}
                    height={lo.chartHeight()}
                    />
              </OverlayTrigger>);
    });
    let drugLegend = drugList.map(drug=>{
      return <Highlightable 
                key={drug}
                textContent={drug}
                styles={{backgroundColor:drugColors(drug)}}
              />;
    });
    let exposuresDesc = 
      <div>
        <strong>{exposures.length} exposures:</strong> {' '}
        {lastday} <span title="first day of exposure to last">days observation</span>, {' '}
        {_.sum(exposures.map(d=>d.days_supply))} total days supply, {' '}
        {_.sum( exposures
                  .map(d => d.days_from_latest)
                  .filter(d => d > 0)
          )} gap days between exposures, {' '}
        {_.sum( exposures
                  .map(d => -d.days_from_latest)
                  .filter(d => d > 0)
          )} days of exposure overlap, {' '}
        <span title="Medication Possession Ratio">MPR</span>: {' '}
        { Math.round(
            100 * _.sum(exposures.map(d=>d.days_supply)) / lastday)
        }%. <br/>
        Specific drugs: {drugLegend}
      </div>;
    let erasDesc = '';
    if (eras.length) {
      erasDesc = 
        <div>
          <strong>{eras.length} eras:</strong> {' '}
          {_.sum(eras.map(e=>e.era_days))} days in eras, {' '}
          {_.sum(eras.map(e=>e.gap_days))} gap days between eras, {' '}
          {_.sum( exposures
                  .map(d => d.days_from_latest)
                  .filter(d => d > 0)
          ) - _.sum(eras.map(e=>e.gap_days))} gap days within exposures, {' '}
          <span title="Medication Possession Ratio">MPR</span> {' '}
          ignoring days between eras: {' '}
          { Math.round(
              100 * _.sum(exposures.map(d=>d.days_supply)) / 
                    _.sum(eras.map(e=>e.era_days)))
          }%. {' '}
        </div>;
    }
    return (<div ref="timelinediv" className="timeline">
              <div className="description">
                Person {personId}: {' '}
                {exposuresDesc}
                {erasDesc}
              </div>
              <svg 
                    width={lo.w()} 
                    height={lo.h()}>
                <g className="axis"
                    transform={
                      `translate(${lo.zone('left')},${lo.h() - lo.zone('bottom')})`
                    } />
                <g className="timeline"
                    transform={
                      `translate(${lo.zone('left')},${lo.zone('top')})`
                    } />
                {eraBars}
                {exposureBars}
              </svg>
            </div>);
  }
}
export class Highlightable extends Component {
  render() {
    const {textContent, htmlContent,
            styles, triggerFunc, payload,
            listenFunc} = this.props;
                //onMouseOver={()=>triggerFunc(payload)}
    return <span style={styles}
            >
              {textContent}
            </span>;
  }
}
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
              conceptid: this.state.conceptId,
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


