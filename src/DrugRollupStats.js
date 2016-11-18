import React, { Component } from 'react';
import _ from 'supergroup';
var d3 = require('d3');
import * as util from './utils';
var FixedDataTable = require('fixed-data-table');
const {Table, Column, Cell} = FixedDataTable;

import {SparkBarsChart} from './components/SparkBars';

var commify = d3.format(',');
export class RollupListContainer extends Component {
	constructor(props) {
		super(props);
		this.state = { rollups: [] };
	}
	componentDidMount() {
		window.util = util;
		util.cachedFetch('http://0.0.0.0:3000/api/DrugRollupStats')
			.then(function(json) {
				let rollups = this.dataPrep(json);
				this.setState({rollups});
			}.bind(this))
			.catch(function(ex) {
				console.error('parsing failed', ex)
			});
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
			return (
				<div className="drugrollup">
					Drug rollups available:
					<ul>
						{rollups.map(rollup =>
							<li key={rollup.toString()}>
								<a href="#" style={{cursor:'pointer'}} 
										onClick={()=>this.setState({rollup})}>{rollup.toString()}</a>
								<RollupTable rollup={rollup} />
							</li>)}
					</ul>
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
class DumbStore {
  constructor(arr){
		this.arr = arr;
    this.size = arr.length;
    this._cache = [];
  }

  getObjectAt(/*number*/ index) /*?object*/ {
    if (index < 0 || index > this.size){
      return undefined;
    }
    if (this._cache[index] === undefined) {
      this._cache[index] = this.arr[index];
    }
    return this._cache[index];
  }

  /**
  * Populates the entire cache with data.
  * Use with Caution! Behaves slowly for large sizes
  * ex. 100,000 rows
  */
  getAll() {
    if (this._cache.length < this.size) {
      for (var i = 0; i < this.size; i++) {
        this.getObjectAt(i);
      }
    }
    return this._cache.slice();
  }

  getSize() {
    return this.size;
  }
}
class DataListWrapper {
  constructor(indexMap, data) {
    this._indexMap = indexMap;
    this._data = data;
  }

  getSize() {
    return this._indexMap.length;
  }

  getObjectAt(index) {
    return this._data.getObjectAt(
      this._indexMap[index],
    );
  }
}

export class RollupTable extends Component {
  constructor(props) {
    super(props);

    this._dataList = new DumbStore(props.rollup.children);
    this.state = {
      filteredDataList: this._dataList,
    };

    this._onFilterChange = this._onFilterChange.bind(this);
  }

  _onFilterChange(e) {
    if (!e.target.value) {
      this.setState({
        filteredDataList: this._dataList,
      });
    }

    var filterBy = e.target.value.toLowerCase();
    var size = this._dataList.getSize();;
    var filteredIndexes = [];
    for (var index = 0; index < size; index++) {
      var conceptName = this._dataList.getObjectAt(index).toString();
      if (conceptName.toLowerCase().indexOf(filterBy) !== -1) {
        filteredIndexes.push(index);
      }
    }

    this.setState({
      filteredDataList: new DataListWrapper(filteredIndexes, this._dataList),
    });
  }

  render() {
    var {filteredDataList} = this.state;
    return (
      <div className="rollup-table">
        <input
          onChange={this._onFilterChange}
          placeholder="Filter by Concept"
        />
        <br />
        <Table
          rowHeight={25}
          rowsCount={filteredDataList.getSize()}
          headerHeight={55}
          width={1000}
          height={200}
          {...this.props}>
          <Column
            header={<Cell>Concept (drug or class)</Cell>}
            cell={<StringCell data={filteredDataList}/>}
            fixed={true}
            width={100}
						flexGrow={1}
          />
          <Column
            header={<Cell>Patients</Cell>}
            cell={<SGCell 
										func={d=>
											commify(d.aggregate(_.sum,'personCount'))}
										data={filteredDataList}/>}
            fixed={true}
            width={90}
						align="right"
          />
          <Column
            header={<Cell>Avg Exposures/Person</Cell>}
            cell={<SGCell 
										func={
											d=> 
													Math.round(
													d.aggregate(_.sum,'expCount') /
													d.aggregate(_.sum,'personCount')
													* 100) / 100
										}
										data={filteredDataList}/>}
            fixed={true}
            width={190}
						align="right"
          />
          <Column
            header={<Cell></Cell>}
            cell={<Cell></Cell>} 
            fixed={true}
            width={20}
          />
        </Table>
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


const ImageCell = ({rowIndex, data, col, ...props}) => (
  <ExampleImage
    src={data.getObjectAt(rowIndex)[col]}
  />
);

const StringCell = ({rowIndex, data, col, ...props}) => (
  <Cell {...props}>
    {data.getObjectAt(rowIndex).toString()}
  </Cell>
);
const SGCell = ({func, rowIndex, data, col, ...props}) => (
  <Cell {...props}>
    {func(data.getObjectAt(rowIndex))}
  </Cell>
);
const TextCell = ({rowIndex, data, col, ...props}) => (
  <Cell {...props}>
    {data.getObjectAt(rowIndex)[col]}
  </Cell>
);

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
			return	<div>
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
		const {concept, conceptId} = this.props;
		return (<div className="concept-detail">
							<DistSeriesContainer 
									concept={concept}
									conceptId={conceptId} />
							<SampleTimelinesContainer
									concept={concept}
									conceptId={conceptId} />
						</div>);
	}
}
export class DistSeriesContainer extends Component {
	constructor(props) {
		super(props);
		this.state = { 
			daysupply: null,
			gaps: null,
			ntiles: 120,
		};
	}
	componentDidMount() {
		const {conceptId} = this.props;
		util.cachedFetch(
				'http://localhost:3000/api/daysupplies/postCall',
				{
					method: 'post',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						ntiles: this.state.ntiles,
						conceptid: conceptId,
						exp_or_gap: 'exp'
					})
				})
				.then(function(json) {
					console.log(json);
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
				.catch(function(ex) {
					console.error('parsing failed', ex)
				});

			util.cachedFetch(
				'http://localhost:3000/api/daysupplies/postCall',
				{
					method: 'post',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						ntiles: this.state.ntiles,
						conceptid: conceptId,
						exp_or_gap: 'gap'
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
	render() {
		const {concept, conceptId} = this.props;
		const {daysupply, gaps, ntiles} = this.state;
		if (daysupply && gaps) {
			return <DistSeries	concept={concept}
													conceptId={conceptId}
													ntiles={ntiles}
													daysupply={daysupply}
													gaps={gaps} />
		} else {
			return <div className="waiting">Waiting for exposure data...</div>;
		}
	}
}
export class DistSeries extends Component {
	render() {
		const {daysupply, gaps, ntiles} = this.props;
		const timeDistWidth = 90;
		const timeDistHeight = ntiles;
		let maxn = _.sum( daysupply
									.filter(d=>d.exp_or_gap_num === 1)
									.map(d=>d.count));
		let dists = [];
		for (let i=1; i<_.max(daysupply.map(d=>d.exp_or_gap_num)); i++) {
			let ekey = `exp_${i}`;
			dists.push(<TimeDist
										key={ekey}
										_key={ekey}
										numbers={ daysupply
												.filter(d=>d.exp_or_gap_num === i)
												.map(d=>d.avg)
										}
										maxn={maxn}
										n={_.sum( daysupply
												.filter(d=>d.exp_or_gap_num === i)
												.map(d=>d.count)
												)}
										width={timeDistWidth}
										height={timeDistHeight} 
										/>);
			let gkey = `gap_${i}`;
			dists.push(<TimeDist
										key={gkey}
										_key={gkey}
										numbers={
											gaps
												.filter(d=>d.exp_or_gap_num === i)
												.map(d=>d.avg)
										}
										maxn={maxn}
										n={_.sum( gaps
												.filter(d=>d.exp_or_gap_num === i)
												.map(d=>d.count)
												)}
										width={timeDistWidth}
										height={timeDistHeight} 
										/>);
		}
		return <div>{dists}</div>;
	}
}
export class TimeDist extends Component {
	render() {
		const {width, height, numbers, n, maxn, _key} = this.props;
		let x = d3.scaleLinear()
							.range([0,width])
							.domain([_.min([_.min(numbers), 0]), _.max(numbers)]);
		// shouldn't need a y scale, height === numbers.length
		let y = d3.scaleLinear()
							.range([0,height * n / maxn])
							.domain([0,height])
		console.log(_key, maxn, n, y.range()[1]);
		let bars = numbers.map((num,i) => {
			return <line  key={i}
										x1={x(0)} y1={y(1 + i)} 
										x2={x(num)} y2={y(1 + i)} 
										className="bar" />;
		});
    return (<div className="timedist">
              <svg width={width+2} height={height+2}>
								<rect x={1} y={1} width={width} height={height} />
								<line x1={x(0)} y1={0} x2={x(0)} y2={height} className="zero"/>
								{bars}
              </svg>
            </div>);
	}
}
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
		util.cachedFetch(
			'http://localhost:3000/api/People/frequentUsersPost',
			{
				method: 'post',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					howmany: howmany,
					conceptid: conceptId,
				})
			})
			.then(function(json) {
				this.setState({frequentUsers:json});
			}.bind(this))
			.catch(function(ex) {
				console.error('parsing failed', ex)
			});
			
	}
	render() {
		const {conceptId} = this.props;
		const {frequentUsers} = this.state;
		if (frequentUsers) {
			let timelines = frequentUsers.map(person => {
				let personId = person.personId;
				return <TimelineContainer		key={personId}
																		conceptId={conceptId}
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
			eras: null,
			maxgap: 30,
		};
	}
	componentDidMount() {
		const {personId, conceptId} = this.props;
		const {maxgap} = this.state;
		util.cachedFetch(
			'http://localhost:3000/api/eras/postCall',
			{
				method: 'post',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({maxgap, 
															conceptid:conceptId,
															personid: personId
				})
			})
			.then(function(json) {
				this.setState({eras:json});
			}.bind(this))
			.catch(function(ex) {
				console.error('parsing failed', ex)
			});
			
	}
	render() {
		const {eras} = this.state;
		if (eras) {
			return <Timeline eras={eras} />;
		} else {
			return <div className="waiting">Waiting for era data...</div>;
		}
	}
}
export class Timeline extends Component {
	render() {
		const {eras} = this.props;
		return <pre>{JSON.stringify(eras, null, 2)}</pre>;
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


