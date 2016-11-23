import './DistCharts.css';
import React, { Component } from 'react';
import { Button, Panel, Modal, Checkbox, 
          OverlayTrigger, Tooltip,
          FormGroup, Radio } from 'react-bootstrap';
var d3 = require('d3');
import _ from 'supergroup';
import * as util from '../utils';

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

function KDE() {
	// USER DEFINABLE VARIABLES START
	var numHistBins = 10; // number of bins for the histogram
	var calcHistBinsAutmoatic = true; // if true, the number of bins are calculated automatically and
	// numHistBins is overwritten
	var showKDP = true; // show the kernel density plot?
	var bandwith = 4; // bandwith (smoothing constant) h of the kernel density estimator
	var dataFN = "./faithful.json"; // the filename of the data to be visualized


	// USER DEFINABLE VARIABLES END


	var margin = {top: 20, right: 30, bottom: 30, left: 40},
			width = 960 - margin.left - margin.right,
			height = 500 - margin.top - margin.bottom;

	// the x-scale parameters
	var x = d3.scale.linear()
			.domain([30, 110])
			.range([0, width]);

	// the y-scale parameters
	var y = d3.scale.linear()
			.domain([0, .15])
			.range([height, 0]);

	var xAxis = d3.svg.axis()
			.scale(x)
			.orient("bottom");

	var yAxis = d3.svg.axis()
			.scale(y)
			.orient("left")
			.tickFormat(d3.format("%"));

	var line = d3.svg.line()
			.x(function(d) { return x(d[0]); })
			.y(function(d) { return y(d[1]); });

	// the histogram function
	var histogram;

	var svg = d3.select("body").append("svg")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
		.append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	// draw the background
	svg.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + height + ")")
			.call(xAxis)
		.append("text")
			.attr("class", "label")
			.attr("x", width)
			.attr("y", -6)
			.style("text-anchor", "end")
			.text("Time between Eruptions (min.)");

	svg.append("g")
			.attr("class", "y axis")
			.call(yAxis);


	// draw the histogram and kernel density plot	
	d3.json(dataFN, function(error, faithful) {

			// calculate the number of histogram bins
		if( calcHistBinsAutmoatic == true) {
			numHistBins = Math.ceil(Math.sqrt(faithful.length));  // global variable
		}
	// the histogram function
		histogram = d3.layout.histogram()
			.frequency(false)
			.bins(numHistBins);
		//.bins(x.ticks(500));
		
		var data = histogram(faithful);
		//var kde = kernelDensityEstimator(epanechnikovKernel(7), x.ticks(100));
		var kde = kernelDensityEstimator(epanechnikovKernel(bandwith), x.ticks(100));
		
		//alert("kde is " + kde.toSource());
		
		//console.log(svg.datum(kde(faithful)));

		svg.selectAll(".bar")
				.data(data)
			.enter().insert("rect", ".axis")
				.attr("class", "bar")
				.attr("x", function(d) { return x(d.x) + 1; })
				.attr("y", function(d) { return y(d.y); })
				.attr("width", x(data[0].dx + data[0].x) - x(data[0].x) - 1)
				.attr("height", function(d) { return height - y(d.y); });
		
		// show the kernel density plot
		if(showKDP == true) {
			svg.append("path")
				.datum(kde(faithful))
				.attr("class", "line")
				.attr("d", line);
			}

	});

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
		if(Math.abs(u = u /  bandwith) <= 1) {
		return 0.75 * (1 - u * u) / bandwith;
		} else return 0;
		};
	}
}
