import React, { Component } from 'react';
import _ from 'supergroup';
var d3 = require('d3');
import SparkBarsChart from './components/SparkBars';

export class DrugRollupContainer extends Component {
	constructor() {
		super();
		this.state = {
			rollups: [],
			rollup: null,
		};
	}
	componentDidMount() {
		fetch('http://0.0.0.0:3000/api/DrugRollupStats')
		.then(function(response) {
			return response.json()
		}).then(function(json) {
			//console.log('parsed json', json)
			let rollups = this.dataPrep(json);
			this.setState({rollups});
		}.bind(this)).catch(function(ex) {
			console.error('parsing failed', ex)
		});
	}
	setRollup(rollup) {
		this.setState({rollup});
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
		//console.log(this.props.children);
		var children = React.Children.map(this.props.children, 
					(child) => React.cloneElement(child, { 
						rollups: this.state.rollups, 
						rollup: this.state.rollup,
						setRollup: this.setRollup.bind(this),
					}));
		return (
			<div>
				this is the container
				{children}
			</div>
		);
	}
}
export class RollupList extends Component {
	constructor(props) {
		super(props);
		this.state = { rollup: null};
	}
	render() {
		//console.log(this.props.rollups);
		return (
			<div className="drugrollup">
				Drug rollups available:
				<ul> {this.props.rollups.map(this.renderRollup.bind(this))} </ul>
			</div>
		);
	}
	renderRollup(rollup) {
		return (
			<li key={rollup.toString()}>
				<a href="#" style={{cursor:'pointer'}} 
						onClick={()=>this.props.setRollup(rollup)}>{rollup.toString()}</a>
			</li>
		);
	}
}

var commify = d3.format(',');

export class RollupStats extends Component {
	/*
	constructor(props) {
		super(props);
	}
	*/
	render() {
		let {rollup} = this.props;
		if (rollup) {
			rollup.children = rollup.children.sortBy(d=>-d.aggregate(_.sum, 'personCount'));
		}
		console.log(rollup);
		return (
			<div className="drugrollup">Rollup Stats!!
				{rollup ? rollup.toString() : 'no rollup chosen'}
				<br/>
				<ul> {rollup && rollup.children.map(this.renderConcept.bind(this))} </ul>
			</div>
		);
	}
	renderConcept(concept) {
		return (
			<li key={concept.toString()}>
				{concept.toString()}:
				<br/>
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
			</li>
		);
	}
}
