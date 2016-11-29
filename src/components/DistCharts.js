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
import './DistCharts.css';
import React, { Component } from 'react';
import { Button, Panel, Modal, Checkbox, 
          OverlayTrigger, Tooltip,
          FormGroup, Radio,
          Row, Col,
      } from 'react-bootstrap';
var d3 = require('d3');
import _ from 'supergroup';
import * as util from '../utils';
import {commify} from '../utils';
import {distfetch} from '../appData';
import {pubsub} from '../EventEmitter';

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
      dists: null,
      ntiles: 120,
    };
  }
  componentDidMount() {
    // change to general params
    const {concept_id, bundle, maxgap} = this.props;
    this.fetchDists(concept_id, bundle, maxgap);
  }
  componentWillReceiveProps(nextProps) {
    const {concept_id, bundle, maxgap} = nextProps;
    if (nextProps.concept_id !== this.props.concept_id ||
        nextProps.maxgap !== this.props.maxgap ||
        nextProps.bundle !== this.props.bundle ||
        nextProps.measurename !== this.props.measurename)
      this.fetchDists(concept_id, bundle, maxgap);
  }
  fetchDists(concept_id, bundle, maxgap) {
    this.setState({dists: null});
    let params = {
            ntiles: this.state.ntiles,
            concept_id: concept_id,
            bundle, // exp, era, allexp, allera, single
            //measurename: 'duration',
            measurename: 'gap',
          };
    if (bundle === 'era' || bundle === 'allera') {
      params.maxgap = maxgap;
    }
    let distsToFetch = ['gap', 'duration'];
    if (!params.bundle.match(/era/)) {
      distsToFetch.unshift('overlap');
      // FOR ERAS, SHOULD DO WITHIN-ERA OVERLAP, BUT NOT READY
    }
    let promises = distsToFetch.map(
          d => {
            params.measurename = d;
            return distfetch(params, `${bundle} ${d} distributions`);
          });
    Promise.all(promises)
      .then(function(recs) {
        let dists;
        if (params.bundle === 'exp') {
          dists = _.supergroup(_.flatten(recs), 
                      ['exp_num','measurename','ntile']);
        } else if (params.bundle === 'era') {
          dists = _.supergroup(_.flatten(recs), 
                      ['era_num','measurename','ntile']);
        } else if (params.bundle === 'allexp' ||
                   params.bundle === 'allera') {
          // do I need three levels to make it work like others?
          // probably
          dists = _.supergroup(_.flatten(recs), 
                      [d=>'one group', 'measurename','ntile']);
        } else {
          throw new Error("not handling yet");
        }
        this.setState({dists});
      }.bind(this))
  }
  render() {
    const {concept, concept_id, bundle, maxgap, 
            seriesOfOne, entityName} = this.props;
    let {title} = this.props;
    const {dists, ntiles} = this.state;
    if (dists) {
      if (seriesOfOne && dists.length !== 1) {
        throw new Error("unexpected data");
      }
      return <DistSeries  concept={concept}
                          concept_id={concept_id}
                          ntiles={ntiles}
                          dists={dists}
                          maxgap={maxgap}
                          loading={maxgap}
                          bundle={bundle}
                          seriesOfOne={seriesOfOne}
                          title={title}
                          entityName={entityName}
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
      DistChartType: 'Histogram',
      ChartTypes : {
        DistBars, CumulativeDistFunc, Histogram,
      }
    };
  }
  render() {
    const {dists, ntiles, maxgap, bundle, 
            seriesOfOne, entityName} = this.props;
    let {title} = this.props;
    const {useFullHeight, DistChartType, ChartTypes} = this.state;
    let Dists = dists.map((dist,i) => {
      let bundleType;
      switch (bundle) {
        case 'exp':
          bundleType = 'Exposure records by exposure order'; break;
        case 'era':
          bundleType = 'Era'; break;
        case 'allexp':
          bundleType = 'All exposures together'; break;
        case 'allera':
          bundleType = 'All eras together'; break;
        case 'single':
          bundleType = 'Single era/patient'; break;
      }
      return <ExpGapDist
                key={i}
                distNum={i+1}
                dist={dist}
                allDists={dists}
                useFullHeight={useFullHeight}
                DistChart={ChartTypes[DistChartType]}
                bundle={bundle}
                bundleType={bundleType}
                seriesOfOne={seriesOfOne}
                entityName={entityName}
                />;
    });
    let fullHeightCheckbox = seriesOfOne ? '' :
          <Checkbox onChange={
                      ()=>this.setState({useFullHeight:!this.state.useFullHeight})
                    } inline={false}>
            Use full height
          </Checkbox>
    title = title ||
              <span>
                Gaps and exposure durations for up to {' '}
                {dists.length} {' '}
                {typeof maxgap === "undefined"
                    ? 'raw exposures'
                    : `eras based of max gap of ${maxgap}`}
              </span>;
    return  <div className="dist-series">
              <div>
                {fullHeightCheckbox}
                <div className="dist-series-title">
                  {title}
                </div>
                <Radio inline
                  checked={DistChartType==='Histogram'}
                  value={'Histogram'}
                  onChange={this.onDistChartChange.bind(this)}
                >
                  Histogram
                </Radio>
                {' '}
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
              </div>
              {Dists}
              <div style={{clear:'both'}} />
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
  render() {
    const {dist, allDists, distNum, bundleType, 
            useFullHeight, DistChart, seriesOfOne,
            entityName} = this.props;

    let chart1 = '', chart2 = '';
    const distCnt = dist.lookup('duration').aggregate(_.sum, 'count');
    const maxCnt = allDists[0].lookup('duration').aggregate(_.sum, 'count');
    let gaps = '';
    if (dist.lookup('gap')) {
      gaps = <DistChart
                dist={dist.lookup('gap')}
                allDists={allDists}
                distNum={distNum}
                getX={d=>d.avg}
                getY={(d,i)=>
                  _.sum(dist.lookup('gap').records.slice(0,i).map(d=>d.count))
                }
                useFullHeight={useFullHeight}
                distCnt={distCnt}
                maxCnt={maxCnt}
                measurename="gap"
                entityName={entityName}
              />;
    }
    let overlaps = '';
    if (dist.lookup('overlap')) {
      overlaps = <DistChart
                dist={dist.lookup('overlap')}
                allDists={allDists}
                distNum={distNum}
                getX={d=>d.avg}
                getY={(d,i)=>
                  _.sum(dist.lookup('overlap').records.slice(0,i).map(d=>d.count))
                }
                useFullHeight={useFullHeight}
                distCnt={distCnt}
                maxCnt={maxCnt}
                measurename="overlap"
                entityName={entityName}
              />;
    }
    if (distNum === 1 && !seriesOfOne) {
      gaps = <div><br/><br/>
                No gap<br/>preceding first <br/>
                {bundleType.toLowerCase()}</div>;
      if (overlaps) {
        overlaps = <div><br/><br/>
                No overlap<br/>on first <br/>
                {bundleType.toLowerCase()}</div>;
      }
    }
    let cols = 6;
    if (overlaps) {
      cols = 4;
      overlaps =
                <Col md={cols} style={{padding:0}} className="gapdist">
                  Overlaps<br/>
                  {overlaps}
                </Col>
    }
    return (<div className="expgapdist">
              <Row style={{margin:0}}>
                {overlaps}
                <Col md={cols} style={{padding:0}} className="gapdist">
                  Gaps<br/>
                  {gaps}
                </Col>
                <Col md={cols} style={{padding:0}} className="distbars">
                  Duration<br/>
                  <DistChart
                      dist={dist.lookup('duration')}
                      allDists={allDists}
                      distNum={distNum}
                      getX={d=>d.avg}
                      getY={(d,i)=>
                        _.sum(dist.lookup('duration').records.slice(0,i).map(d=>d.count))
                      }
                      useFullHeight={useFullHeight}
                      distCnt={distCnt}
                      maxCnt={maxCnt}
                      measurename="duration"
                      entityName={entityName}
                    />
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  {bundleType} {distNum}
                </Col>
              </Row>
            </div>);
  }
}
export class SmallChart extends Component {
  constructor(props) {
    super(props);
    let {svgLayoutSettings, width=150, height=150} = props;
    const layoutDefaults =
                    { top: { margin: { size: 7}, },
                      bottom: { margin: { size: 20}, },
                      left: { margin: { size: 50}, },
                      right: { margin: { size: 8}, },
                    };
    let lo = new util.SvgLayout(
              width, height,
              _.merge(layoutDefaults, svgLayoutSettings));

    this.state = {lo, ttContent: 'waiting for tooltip content'};
  }
  componentDidMount(recs) {
    const {distNum, getX, getY} = this.props;
    const {lo} = this.state;
    const {clientWidth, clientHeight} = this.svg;
    let [width, height] = [clientWidth, clientHeight];
    lo.w(width);
    lo.h(height);
    //let yDomain = this.props.yDomain || [recs.length, 0];
    let x = d3.scaleLinear()
              .range([0, lo.chartWidth()])
              // not general:
              .domain([_.min([_.min(recs.map(getX)), 0]), _.max(recs.map(getX))]);
    let xAxis = d3.axisBottom()
                .ticks(2)
                .scale(x)
    let y = d3.scaleLinear()
              .range([0, lo.chartHeight()])
              //.domain(yDomain);
    let yAxis = d3.axisLeft()
                .ticks(2)
                .scale(y)
    this.setState({ x, y, lo, xAxis, yAxis });
  }
  componentDidUpdate() {
    const {lo, y, x, xAxis, yAxis} = this.state;
    d3.select(this.xAxisG).call(xAxis);
  }
  render(insides) {
    const {lo, y, x} = this.state;
    return (
            <OverlayTrigger 
                placement="bottom" 
                overlay={
                  <Tooltip id="tooltip-distchart">
                    {this.state.ttContent}
                  </Tooltip>
                }>
              <svg  width={lo.w()}
                    height={lo.h()}
                    ref={(svg) => { 
                      this.svg = svg;
                    }}
                >
                <g className="y-axis"
                    ref={(yAxisG) => this.yAxisG = yAxisG}
                    transform={
                      `translate(${lo.zone('left')},${lo.zone('top')})`
                    } />
                <g className="x-axis"
                    ref={(xAxisG) => this.xAxisG = xAxisG}
                    transform={
                      `translate(${lo.zone('left')},${lo.chartHeight() + lo.zone('top')})`
                    } />
                <g className="small-chart"
                    ref={(chartG) => this.chartG = chartG}
                    transform={
                      `translate(${lo.zone('left')},${lo.zone('top')})`
                    }>
                    {insides}
                </g>
              </svg>
            </OverlayTrigger>
    );
  }
}
export class DistBars extends SmallChart {
  constructor(props) {
    super(props);
  }
  componentDidMount() {
    let {dist} = this.props;
    super.componentDidMount(dist.records);
  }
  render() {
    const {dist, allDists, distNum, getX, getY, 
            useFullHeight, distCnt, maxCnt} = this.props;
    const {lo, y, x, xAxis, yAxis} = this.state;
                
    let bars = '';
    if (x) {
      //const distCnt = dist.aggregate(_.sum, 'count');
      //const maxCnt = allDists[0].aggregate(_.sum, 'count');
      //y.range([0, lo.chartHeight()]) // already done in SmallChart
      if (!useFullHeight) {
        y.domain([0, maxCnt]);
      } else {
        y.domain([0, distCnt]);
      }
      d3.select(this.yAxisG).call(yAxis);
      //y.domain([dist.children.length, 0]);
      bars = dist.records.map((rec,i) => {
        //let ypos = _.sum(dist.records.slice(0,i).map(d=>d.count));
        return <line  key={i}
                      x1={x(0)} y1={y(getY(rec,i))} 
                      x2={x(getX(rec))} y2={y(getY(rec,i))} 
                      className="bar" />;
      });
    }
    return super.render(
      <g>{bars}</g>
    );
  }
}
export class CumulativeDistFunc extends SmallChart {
  constructor(props) {
    super(props);
  }
  componentDidMount() {
    let {dist} = this.props;
    super.componentDidMount(dist.records);
  }
  render() {
    const {dist, allDists, distNum, getX, getY, 
            useFullHeight, distCnt, maxCnt} = this.props;
    const {lo, y, x, xAxis, yAxis} = this.state;

    if (!x) return super.render('');

    //const distCnt = dist.aggregate(_.sum, 'count');
    //const maxCnt = allDists[0].aggregate(_.sum, 'count');
    y.range([0, lo.chartHeight()])
    if (!useFullHeight) {
      y.domain([0, maxCnt]);
    } else {
      y.domain([0, distCnt]);
    }
                
    //d3.select(this.yAxisG).call(yAxis);

    const recs = dist.records.filter(d=>getX(d) !== null);
    let data = recs.map((d,i) => {
      return {
        x: getX(d),
        y: getY(d,i),
        //y: (i+1) / cnt,
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
    x.range([0, lo.chartWidth()])
    y.range([lo.chartHeight(), 0])
    x.domain(d3.extent(data, function(d) { return d.x; })).nice();
    y.domain(d3.extent(data, function(d) { return d.y; })).nice();

    console.log(data.map(d=>`(${d.x},${d.y})`).join(' '));
    console.log(recs);

    var line = d3.line()
        .x(function(d) { return x(d.x); })
        .y(function(d) { return y(d.y); });
    let color = d3.scaleOrdinal()
                        .range(d3.schemeCategory10);

    d3.select(this.chartG).append("path")
        .datum(data)
        .attr("class", "line")
        .attr("d", line)
        .style("stroke", function(d) { 
          return color("initial"); 
        });

    return super.render('');
  }
}

export class Histogram extends SmallChart {
  // kde and histogram stuff from http://bl.ocks.org/jensgrubert/7777399
  // updated for d3.v4
  constructor(props) {
    super(props);
    this.state.highlightedBar = null;
  }
  componentDidMount() {
    let {dist} = this.props;
    super.componentDidMount(dist.records);
  }
  render() {
    const {dist, allDists, distNum, getX, getY, 
            useFullHeight, distCnt, maxCnt,
            measurename, entityName} = this.props;
    const {lo, y, x, xAxis, yAxis} = this.state;
    var numHistBins = 10; // number of bins for the histogram
    var calcHistBinsAutmoatic = true; // if true, the number of bins are calculated automatically and
    // numHistBins is overwritten
    var showKDP = true; // show the kernel density plot?
    var bandwith = 4; // bandwith (smoothing constant) h of the kernel density estimator

    if (!x) return super.render('');

    //const distCnt = dist.aggregate(_.sum, 'count');
    //const maxCnt = allDists[0].aggregate(_.sum, 'count');

    let numbers = _.flatten(dist.records.map(
      d => {
        return Array(d.count).fill(getX(d))
      }));
                
    x.range([0, lo.chartWidth()])
    y.range([lo.chartHeight(), 0])
    //x.domain(d3.extent(data, function(d) { return d.x; })).nice();
    //y.domain(d3.extent(data, function(d) { return d.y; })).nice();

    /*
    const recs = dist.records.filter(d=>getX(d) !== null);
    if (!(recs.length > 1))
      return super.render('');
    */

    //console.log(data.map(d=>`(${d.x},${d.y})`).join(' '));
    //console.log(recs);

    var histogram;
    let svg = d3.select(this.chartG);

    // calculate the number of histogram bins
    if( calcHistBinsAutmoatic == true) {
      numHistBins = Math.ceil(Math.sqrt(numbers.length));  // global variable
    }
    // the histogram function
    histogram = d3.histogram()
      //.thresholds(numHistBins);
    //.bins(x.ticks(500));
    
    var data = histogram(numbers);

    if (!useFullHeight) {
      let exp1Numbers = _.flatten(allDists[0].lookup('duration').records.map(
        d => {
          return Array(d.count).fill(getX(d))
        }));
      y.domain([0, _.max(histogram(exp1Numbers).map(d=>d.length))]);
    } else {
      y.domain([0, distCnt]);
      y.domain([0, _.max(data.map(d=>d.length))]);
    }
    x.domain(d3.extent(numbers));
    d3.select(this.yAxisG).call(yAxis);
    
    //alert("kde is " + kde.toSource());
    
    //console.log(svg.datum(kde(numbers)));

    let barWidth = lo.chartWidth() / data.length;
    /* replacing d3 append with react below
    svg.selectAll(".bar").remove();
    // this calc might be wrong, not sure if i need Math.abs
    //let barWidth = x(Math.abs(data[0].x1 - data[0].x0) + x.domain()[0]) - 1;
    //console.log(barWidth);
    if (barWidth < 0) debugger;
    svg.selectAll(".bar")
        .data(data)
      .enter().insert("rect", ".axis")
        .attr("class", "bar")
        //.attr("x", function(d) { return x(d.x0) + 1; })
        .attr("x", function(d,i) { return i * barWidth + .3; })
        .attr("y", function(d) { return y(d.length); })
        .attr("width", barWidth - .6)
        .attr("height", function(d) { return lo.chartHeight() - y(d.length); });
    */
    let bars = data.map((bar,i) => {
      //let ypos = _.sum(dist.records.slice(0,i).map(d=>d.count));
      let ttContent = 
            <p>
              {commify(bar.length)} {entityName}s {' '}
              with {measurename} {' '}
              between {bar.x0} and {bar.x1}.<br/>
              Mean: {Math.round(_.mean(bar)*100)/100}<br/>
              Median: {Math.round(_.median(bar)*100)/100}<br/>
            </p>;
      return <rect  key={i}
                    x={i * barWidth + .3}
                    width={barWidth - .6}
                    y={y(bar.length)}
                    height={lo.chartHeight() - y(bar.length)}
                    fill={
                      i === this.state.highlightedBar
                      ? 'blue'
                      : 'gray'
                    }
                    className="bar" 
                    onMouseOver={()=>{
                      this.setState({
                        ttContent,
                        highlightedBar: i,
                      });
                    }}
                    onClick={()=>{
                      pubsub.emitEvent(
                        'sampleParams', 
                        [{
                          measurename, entityName,
                          bar, from:bar.x0, to:bar.x1,
                        }]);
                    }}
                    />;
    });
    return super.render(
      <g>{bars}</g>
    );
    
    /* too slow...probably easy to make faster
    //var kde = kernelDensityEstimator(epanechnikovKernel(7), x.ticks(100));
    var kde = kernelDensityEstimator(epanechnikovKernel(2), x.ticks(40));
    y.domain(d3.extent(kde(numbers), d=>d[1]));
    
    var line = d3.line()
        .x(function(d) { return x(d[0]); })
        .y(function(d) { return y(d[1]); });

    // show the kernel density plot
    if(showKDP == true) {
      svg.append("path")
        .datum(kde(numbers))
        .attr("class", "line")
        .attr("d", line);
    }
    */

    function kernelDensityEstimator(kernel, x) {
      return function(sample) {
        return x.map(function(x) {
          //console.log(x + " ... " + d3.mean(sample, function(v) { return kernel(x - v); }));    
          return [x, d3.mean(sample, function(v) { return kernel(x - v); })];
        });
      };
    }

    function epanechnikovKernel(bandwith) {
      return function(u) {
        //return Math.abs(u /= bandwith) <= 1 ? .75 * (1 - u * u) / bandwith : 0;
        if (Math.abs(u = u /  bandwith) <= 1) {
          return 0.75 * (1 - u * u) / bandwith;
        } else 
          return 0;
      };
    }
    return super.render('');
  }
}
